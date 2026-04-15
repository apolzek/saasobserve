package httpx

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/apolzek/saasobserve/apps/api/internal/auth"
	"github.com/apolzek/saasobserve/apps/api/internal/config"
	"github.com/apolzek/saasobserve/apps/api/internal/db"
	"github.com/apolzek/saasobserve/apps/api/internal/tenant"
	"github.com/google/uuid"
)


type server struct {
	cfg     *config.Config
	store   *db.Store
	oidc    *auth.Google
	tenants *tenant.Service
}

func NewRouter(cfg *config.Config, store *db.Store, g *auth.Google, t *tenant.Service) http.Handler {
	s := &server{cfg: cfg, store: store, oidc: g, tenants: t}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("GET /api/auth/google/start", s.authStart)
	mux.HandleFunc("GET /api/auth/google/callback", s.authCallback)
	mux.HandleFunc("POST /api/auth/signup", s.signup)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("POST /api/auth/logout", s.logout)

	mux.HandleFunc("GET /api/me", s.authed(s.me))
	mux.HandleFunc("GET /api/tenants", s.authed(s.listTenants))
	mux.HandleFunc("GET /api/keys", s.authed(s.listKeys))
	mux.HandleFunc("POST /api/keys", s.authed(s.createKey))
	mux.HandleFunc("DELETE /api/keys/{id}", s.authed(s.deleteKey))

	// Called by auth-webhook (in-cluster only — ingress should not expose this).
	mux.HandleFunc("POST /internal/validate-key", s.validateKey)

	return withCORS(cfg, mux)
}

// ---------------------------------------------------------------------------
// auth

const sessionCookie = "saasobserve_session"

func (s *server) authStart(w http.ResponseWriter, r *http.Request) {
	if !s.oidc.Enabled() {
		http.Error(w, "google oidc not configured — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET", http.StatusServiceUnavailable)
		return
	}
	state := randHex(16)
	http.SetCookie(w, &http.Cookie{
		Name: "oauth_state", Value: state, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: 600,
	})
	http.Redirect(w, r, s.oidc.Config.AuthCodeURL(state), http.StatusFound)
}

func (s *server) authCallback(w http.ResponseWriter, r *http.Request) {
	ck, err := r.Cookie("oauth_state")
	if err != nil || ck.Value != r.URL.Query().Get("state") {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	claims, err := s.oidc.Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	u, err := s.store.UpsertGoogleUser(r.Context(), claims.Sub, claims.Email, claims.Name, claims.Picture)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	// Make sure the user has a tenant provisioned.
	if _, err := s.tenants.EnsureTenantForUser(r.Context(), u); err != nil {
		slog.Warn("tenant ensure failed", "err", err, "user", u.ID)
	}

	token := randHex(32)
	if err := s.store.CreateSession(r.Context(), token, u.ID, 7*24*time.Hour); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: token, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteLaxMode, MaxAge: 7 * 24 * 3600,
	})
	http.Redirect(w, r, s.cfg.PublicBaseURL+"/dashboard", http.StatusFound)
}

// signup creates a new email/password user, immediately logs them in, and
// makes sure a tenant exists for them.
func (s *server) signup(w http.ResponseWriter, r *http.Request) {
	var body struct{ Email, Password, Name string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}
	if len(body.Password) < 6 || body.Email == "" {
		http.Error(w, "email and password (≥6 chars) required", http.StatusBadRequest)
		return
	}
	if body.Name == "" {
		body.Name = body.Email
	}
	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		http.Error(w, "hash failed", http.StatusInternalServerError)
		return
	}
	u, err := s.store.CreateEmailUser(r.Context(), body.Email, hash, body.Name)
	if err != nil {
		http.Error(w, "email already registered", http.StatusConflict)
		return
	}
	if _, err := s.tenants.EnsureTenantForUser(r.Context(), u); err != nil {
		slog.Warn("tenant ensure", "err", err)
	}
	s.issueSession(w, r, u)
	writeJSON(w, http.StatusCreated, map[string]any{"id": u.ID, "email": u.Email, "name": u.Name})
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var body struct{ Email, Password string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}
	u, err := s.store.GetUserByEmail(r.Context(), body.Email)
	if err != nil || u.PasswordHash == "" || !auth.CheckPassword(u.PasswordHash, body.Password) {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	s.issueSession(w, r, u)
	writeJSON(w, http.StatusOK, map[string]any{"id": u.ID, "email": u.Email, "name": u.Name})
}

func (s *server) issueSession(w http.ResponseWriter, r *http.Request, u *db.User) {
	token := randHex(32)
	if err := s.store.CreateSession(r.Context(), token, u.ID, 7*24*time.Hour); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: token, Path: "/", HttpOnly: true,
		SameSite: http.SameSiteLaxMode, MaxAge: 7 * 24 * 3600,
	})
}

func (s *server) logout(w http.ResponseWriter, r *http.Request) {
	if ck, err := r.Cookie(sessionCookie); err == nil {
		_ = s.store.DeleteSession(r.Context(), ck.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1})
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// authed endpoints

type ctxKey int

const userKey ctxKey = 1

func (s *server) authed(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ck, err := r.Cookie(sessionCookie)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		u, err := s.store.GetSessionUser(r.Context(), ck.Value)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		r = r.WithContext(withUser(r.Context(), u))
		h(w, r)
	}
}

func (s *server) me(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r.Context())
	ts, _ := s.store.ListTenantsByOwner(r.Context(), u.ID)
	var tenantID, grafanaURL string
	if len(ts) > 0 {
		tenantID = ts[0].ID
		grafanaURL = "https://" + tenantID + "." + s.cfg.GrafanaBaseDomain
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":         u.ID,
		"email":      u.Email,
		"name":       u.Name,
		"picture":    u.Picture,
		"tenant":     tenantID,
		"grafanaUrl": grafanaURL,
	})
}

func (s *server) listTenants(w http.ResponseWriter, r *http.Request) {
	u := userFrom(r.Context())
	ts, err := s.store.ListTenantsByOwner(r.Context(), u.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, ts)
}

func (s *server) currentTenant(r *http.Request) (string, error) {
	u := userFrom(r.Context())
	ts, err := s.store.ListTenantsByOwner(r.Context(), u.ID)
	if err != nil {
		return "", err
	}
	if len(ts) == 0 {
		return "", errors.New("no tenant")
	}
	return ts[0].ID, nil
}

func (s *server) listKeys(w http.ResponseWriter, r *http.Request) {
	tid, err := s.currentTenant(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ks, err := s.tenants.ListKeys(r.Context(), tid)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	out := make([]map[string]any, 0, len(ks))
	for _, k := range ks {
		out = append(out, map[string]any{
			"id":        k.ID,
			"label":     k.Label,
			"prefix":    k.Prefix,
			"createdAt": k.CreatedAt,
			"masked":    "sk_live_" + k.Prefix + "_" + strings.Repeat("•", 8),
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *server) createKey(w http.ResponseWriter, r *http.Request) {
	tid, err := s.currentTenant(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var body struct{ Label string }
	_ = json.NewDecoder(r.Body).Decode(&body)
	kc, err := s.tenants.CreateAPIKey(r.Context(), tid, body.Label)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"id":    kc.ID,
		"label": kc.Label,
		"key":   kc.Plain, // shown once
	})
}

func (s *server) deleteKey(w http.ResponseWriter, r *http.Request) {
	tid, err := s.currentTenant(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	if err := s.tenants.DeleteKey(r.Context(), id, tid); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// internal: called by auth-webhook

func (s *server) validateKey(w http.ResponseWriter, r *http.Request) {
	var body struct{ Key string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}
	tid, err := s.tenants.ValidateKey(r.Context(), body.Key)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"valid": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"valid": true, "tenant": tid})
}

// ---------------------------------------------------------------------------
// helpers

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func randHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func withCORS(cfg *config.Config, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", cfg.PublicBaseURL)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}
