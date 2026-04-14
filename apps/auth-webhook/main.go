// auth-webhook is a tiny HTTP service that the gateway OpenTelemetry collector
// calls to validate an X-Tenant-Key header. It forwards the check to the
// control-plane API and caches the result for a short window to keep hot-path
// latency low under load.
//
// The collector's `bearertokenauth`/`headers_setter` pattern does not expose a
// first-class "validate and tag" flow, so we sit in front of it with a small
// auth extension contract:
//
//   POST /validate { "key": "sk_live_..." }  → 200 { "valid": true, "tenant": "acme" }
//                                             → 401 { "valid": false }
package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"sync"
	"time"
)

type cacheEntry struct {
	tenant    string
	expiresAt time.Time
}

type server struct {
	apiURL string
	mu     sync.RWMutex
	cache  map[string]cacheEntry
	ttl    time.Duration
}

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(log)

	s := &server{
		apiURL: envOr("API_URL", "http://api.saasobserve-system.svc.cluster.local:8080"),
		cache:  map[string]cacheEntry{},
		ttl:    30 * time.Second,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("POST /validate", s.validateBody)
	// nginx auth_request uses subrequests — GET/HEAD with the original
	// headers forwarded via auth-snippet. We read X-Tenant-Key from the
	// subrequest and return 200 + X-Saasobserve-Tenant on success.
	mux.HandleFunc("GET /validate", s.validateHeader)

	addr := envOr("ADDR", ":8090")
	log.Info("auth-webhook listening", "addr", addr, "api", s.apiURL)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Error("listen", "err", err)
		os.Exit(1)
	}
}

type req struct{ Key string `json:"key"` }
type res struct {
	Valid  bool   `json:"valid"`
	Tenant string `json:"tenant,omitempty"`
}

// validateHeader handles the nginx auth_request subrequest flow: the key
// arrives as a forwarded header, we respond with 200 + X-Saasobserve-Tenant
// (nginx copies it into the upstream request via auth-response-headers) or
// 401 to reject.
func (s *server) validateHeader(w http.ResponseWriter, r *http.Request) {
	key := r.Header.Get("X-Tenant-Key")
	if key == "" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	tid, err := s.resolve(r, key)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	w.Header().Set("X-Saasobserve-Tenant", tid)
	w.WriteHeader(http.StatusOK)
}

func (s *server) resolve(r *http.Request, key string) (string, error) {
	if tid, ok := s.cacheGet(key); ok {
		return tid, nil
	}
	upstream, _ := json.Marshal(req{Key: key})
	rq, _ := http.NewRequestWithContext(r.Context(), http.MethodPost,
		s.apiURL+"/internal/validate-key", bytes.NewReader(upstream))
	rq.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(rq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		return "", errInvalid
	}
	var out res
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || !out.Valid {
		return "", errInvalid
	}
	s.cacheSet(key, out.Tenant)
	return out.Tenant, nil
}

var errInvalid = errors.New("invalid key")

func (s *server) validateBody(w http.ResponseWriter, r *http.Request) {
	var body req
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Key == "" {
		writeJSON(w, http.StatusBadRequest, res{Valid: false})
		return
	}

	if tid, ok := s.cacheGet(body.Key); ok {
		writeJSON(w, http.StatusOK, res{Valid: true, Tenant: tid})
		return
	}

	upstream, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodPost,
		s.apiURL+"/internal/validate-key", bytes.NewReader(upstream))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Warn("upstream failed", "err", err)
		writeJSON(w, http.StatusBadGateway, res{Valid: false})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, resp.Body)
		writeJSON(w, http.StatusUnauthorized, res{Valid: false})
		return
	}
	var out res
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil || !out.Valid {
		writeJSON(w, http.StatusUnauthorized, res{Valid: false})
		return
	}
	s.cacheSet(body.Key, out.Tenant)
	writeJSON(w, http.StatusOK, out)
}

func (s *server) cacheGet(k string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.cache[k]
	if !ok || time.Now().After(e.expiresAt) {
		return "", false
	}
	return e.tenant, true
}
func (s *server) cacheSet(k, tid string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cache[k] = cacheEntry{tenant: tid, expiresAt: time.Now().Add(s.ttl)}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
