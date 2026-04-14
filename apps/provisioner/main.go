// provisioner receives tenant.created events from the control plane API and
// materialises per-tenant manifests into a Git repository. ArgoCD's
// ApplicationSet (gitops/tenants/applicationset.yaml) watches the same repo
// and reconciles the tenant-stack Helm chart into a fresh tenant-<id>
// namespace.
//
// State machine:
//
//   api → POST /events → provisioner
//                │
//                ├─ write gitops/tenants/<id>/values.yaml
//                ├─ append to gitops/tenants/gateway-tenants.yaml
//                ├─ git add / commit / push
//                └─ ArgoCD ApplicationSet picks up
//
// We use a small mutex to serialise git operations; concurrency is not a
// goal here — signups happen at human speed.
package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

type config struct {
	addr      string
	repoURL   string
	branch    string
	tenantDir string // path inside the repo, e.g. "gitops/tenants"
	author    string
	email     string
	token     string
	workDir   string
}

func loadConfig() config {
	return config{
		addr:      envOr("ADDR", ":8091"),
		repoURL:   envOr("GIT_REPO", "https://github.com/apolzek/saasobserve.git"),
		branch:    envOr("GIT_BRANCH", "main"),
		tenantDir: envOr("GIT_PATH", "gitops/tenants"),
		author:    envOr("GIT_AUTHOR", "saasobserve-provisioner"),
		email:     envOr("GIT_EMAIL", "bot@saasobserve.io"),
		token:     os.Getenv("GIT_TOKEN"),
		workDir:   envOr("WORK_DIR", "/var/lib/provisioner/repo"),
	}
}

type provisioner struct {
	cfg config
	mu  sync.Mutex
	log *slog.Logger
}

type tenantEvent struct {
	Event   string `json:"event"`
	Tenant  string `json:"tenant"`
	Owner   string `json:"owner"`
	Display string `json:"display"`
	Time    string `json:"time"`
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(log)

	p := &provisioner{cfg: loadConfig(), log: log}
	if err := p.ensureRepo(); err != nil {
		log.Error("repo init", "err", err)
		os.Exit(1)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("POST /events", p.handleEvent)

	log.Info("provisioner listening", "addr", p.cfg.addr)
	if err := http.ListenAndServe(p.cfg.addr, mux); err != nil {
		log.Error("listen", "err", err)
		os.Exit(1)
	}
}

// ---------------------------------------------------------------------------
// git plumbing

func (p *provisioner) ensureRepo() error {
	if _, err := os.Stat(filepath.Join(p.cfg.workDir, ".git")); err == nil {
		return p.git("fetch", "origin", p.cfg.branch)
	}
	if err := os.MkdirAll(p.cfg.workDir, 0o755); err != nil {
		return err
	}
	url := p.repoURLWithAuth()
	out, err := exec.Command("git", "clone", "--branch", p.cfg.branch, url, p.cfg.workDir).CombinedOutput()
	if err != nil {
		return fmt.Errorf("clone: %v: %s", err, out)
	}
	if err := p.git("config", "user.name", p.cfg.author); err != nil {
		return err
	}
	return p.git("config", "user.email", p.cfg.email)
}

func (p *provisioner) repoURLWithAuth() string {
	if p.cfg.token == "" {
		return p.cfg.repoURL
	}
	// Inject the token into the https URL for non-interactive push.
	return insertAuth(p.cfg.repoURL, "x-access-token", p.cfg.token)
}

func (p *provisioner) git(args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Dir = p.cfg.workDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git %v: %v: %s", args, err, out)
	}
	return nil
}

// ---------------------------------------------------------------------------
// event handling

func (p *provisioner) handleEvent(w http.ResponseWriter, r *http.Request) {
	var ev tenantEvent
	if err := json.NewDecoder(r.Body).Decode(&ev); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if ev.Event != "tenant.created" || ev.Tenant == "" {
		http.Error(w, "bad event", http.StatusBadRequest)
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if err := p.git("pull", "--ff-only"); err != nil {
		p.log.Warn("pull", "err", err)
	}

	if err := p.writeTenantValues(ev); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := p.appendGatewayTenant(ev.Tenant); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	msg := fmt.Sprintf("provision tenant %s", ev.Tenant)
	if err := p.git("add", "-A"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := p.git("commit", "-m", msg); err != nil {
		// Empty commit is fine — means the tenant already existed.
		p.log.Info("nothing to commit", "tenant", ev.Tenant)
		w.WriteHeader(http.StatusOK)
		return
	}
	if err := p.git("push", "origin", p.cfg.branch); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	p.log.Info("provisioned", "tenant", ev.Tenant, "time", time.Now().UTC())
	w.WriteHeader(http.StatusOK)
}

func (p *provisioner) writeTenantValues(ev tenantEvent) error {
	dir := filepath.Join(p.cfg.workDir, p.cfg.tenantDir, ev.Tenant)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	values := fmt.Sprintf(`# Generated by saasobserve-provisioner. Do not edit by hand.
tenant:
  id: %q
  displayName: %q
grafana:
  ingress:
    host: "%s.grafana.saasobserve.local"
`, ev.Tenant, ev.Display, ev.Tenant)
	return os.WriteFile(filepath.Join(dir, "values.yaml"), []byte(values), 0o644)
}

func (p *provisioner) appendGatewayTenant(id string) error {
	path := filepath.Join(p.cfg.workDir, p.cfg.tenantDir, "gateway-tenants.yaml")
	existing, _ := os.ReadFile(path)
	out := string(existing)
	line := fmt.Sprintf("  - id: %s\n    endpoint: http://otelcol.tenant-%s.svc.cluster.local:4318\n", id, id)
	if contains(out, "id: "+id+"\n") {
		return nil
	}
	if out == "" {
		out = "# Generated by saasobserve-provisioner. Tenants routed by the gateway collector.\ngatewayCollector:\n  tenants:\n"
	}
	out += line
	return os.WriteFile(path, []byte(out), 0o644)
}

// ---------------------------------------------------------------------------
// helpers

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func contains(hay, needle string) bool {
	return len(hay) >= len(needle) && (stringIndex(hay, needle) >= 0)
}

func stringIndex(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// insertAuth turns https://host/foo into https://user:token@host/foo.
func insertAuth(url, user, token string) string {
	const p = "https://"
	if len(url) < len(p) || url[:len(p)] != p {
		return url
	}
	return p + user + ":" + token + "@" + url[len(p):]
}
