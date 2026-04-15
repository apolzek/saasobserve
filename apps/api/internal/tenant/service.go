package tenant

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/apolzek/saasobserve/apps/api/internal/db"
	"github.com/google/uuid"
)

type Service struct {
	store          *db.Store
	provisionerURL string
}

func NewService(s *db.Store, provisionerURL string) *Service {
	return &Service{store: s, provisionerURL: provisionerURL}
}

// ---------------------------------------------------------------------------
// Tenant creation

func (s *Service) EnsureTenantForUser(ctx context.Context, u *db.User) (*db.Tenant, error) {
	return s.ensureTenantWithID(ctx, u, slugFromEmail(u.Email)+"-"+shortID(4))
}

// EnsureTenantWithFixedID is used by the default-admin seed so the tenant id
// stays deterministic across restarts.
func (s *Service) EnsureTenantWithFixedID(ctx context.Context, u *db.User, id string) (*db.Tenant, error) {
	return s.ensureTenantWithID(ctx, u, id)
}

func (s *Service) ensureTenantWithID(ctx context.Context, u *db.User, id string) (*db.Tenant, error) {
	existing, err := s.store.ListTenantsByOwner(ctx, u.ID)
	if err != nil {
		return nil, err
	}
	if len(existing) > 0 {
		t := existing[0]
		return &t, nil
	}
	t := &db.Tenant{
		ID:          id,
		OwnerID:     u.ID,
		DisplayName: u.Name + "'s workspace",
		Status:      "provisioning",
	}
	if err := s.store.CreateTenant(ctx, t); err != nil {
		return nil, err
	}
	go s.notifyProvisioner(t)
	return t, nil
}

// CreateAPIKeyWithPlain lets callers (seed path) inject a known plain key so
// that a default credential can be surfaced in docs. If plain is empty, a
// fresh random key is generated like CreateAPIKey.
func (s *Service) CreateAPIKeyWithPlain(ctx context.Context, tenantID, label, plain string) (*KeyCreation, error) {
	if plain == "" {
		return s.CreateAPIKey(ctx, tenantID, label)
	}
	parts := strings.SplitN(plain, "_", 4)
	if len(parts) != 4 || parts[0] != "sk" {
		return nil, errors.New("invalid fixed key format")
	}
	prefix := parts[2]
	k := &db.APIKey{
		ID:       uuid.New(),
		TenantID: tenantID,
		Prefix:   prefix,
		Hash:     sha256Hex(plain),
		Label:    label,
	}
	if err := s.store.CreateAPIKey(ctx, k); err != nil {
		return nil, err
	}
	return &KeyCreation{ID: k.ID, Plain: plain, Prefix: prefix, Label: label}, nil
}

func (s *Service) notifyProvisioner(t *db.Tenant) {
	body, _ := json.Marshal(map[string]any{
		"event":    "tenant.created",
		"tenant":   t.ID,
		"owner":    t.OwnerID.String(),
		"display":  t.DisplayName,
		"time":     time.Now().UTC().Format(time.RFC3339),
	})
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, s.provisionerURL+"/events", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Warn("provisioner notify failed", "err", err, "tenant", t.ID)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		slog.Warn("provisioner non-2xx", "status", resp.StatusCode, "tenant", t.ID)
	}
}

// ---------------------------------------------------------------------------
// API keys

type KeyCreation struct {
	ID     uuid.UUID
	Plain  string // returned once
	Prefix string
	Label  string
}

// Keys follow the format: sk_live_<8-char prefix>_<32-char secret>
func (s *Service) CreateAPIKey(ctx context.Context, tenantID, label string) (*KeyCreation, error) {
	if label == "" {
		label = "default"
	}
	prefix := randomAlphanumeric(8)
	secret := randomAlphanumeric(32)
	plain := fmt.Sprintf("sk_live_%s_%s", prefix, secret)
	hash := sha256Hex(plain)

	k := &db.APIKey{
		ID:       uuid.New(),
		TenantID: tenantID,
		Prefix:   prefix,
		Hash:     hash,
		Label:    label,
	}
	if err := s.store.CreateAPIKey(ctx, k); err != nil {
		return nil, err
	}
	return &KeyCreation{ID: k.ID, Plain: plain, Prefix: prefix, Label: label}, nil
}

func (s *Service) ListKeys(ctx context.Context, tenantID string) ([]db.APIKey, error) {
	return s.store.ListAPIKeys(ctx, tenantID)
}

func (s *Service) DeleteKey(ctx context.Context, id uuid.UUID, tenantID string) error {
	return s.store.DeleteAPIKey(ctx, id, tenantID)
}

// ValidateKey is what auth-webhook calls. Returns tenantID if valid.
func (s *Service) ValidateKey(ctx context.Context, plain string) (string, error) {
	if !strings.HasPrefix(plain, "sk_live_") {
		return "", errors.New("invalid key format")
	}
	parts := strings.SplitN(plain, "_", 4)
	if len(parts) < 4 {
		return "", errors.New("invalid key format")
	}
	prefix := parts[2]
	candidates, err := s.store.FindAPIKeyByPrefix(ctx, prefix)
	if err != nil || len(candidates) == 0 {
		return "", errors.New("not found")
	}
	wantHash := sha256Hex(plain)
	for _, c := range candidates {
		if c.Hash == wantHash {
			s.store.TouchAPIKey(ctx, c.ID)
			return c.TenantID, nil
		}
	}
	return "", errors.New("not found")
}

// ---------------------------------------------------------------------------
// helpers

func slugFromEmail(email string) string {
	at := strings.Index(email, "@")
	if at < 0 {
		return "user"
	}
	local := email[:at]
	var b strings.Builder
	for _, r := range strings.ToLower(local) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '.' || r == '-' || r == '_':
			b.WriteRune('-')
		}
	}
	s := b.String()
	if s == "" {
		s = "user"
	}
	if len(s) > 20 {
		s = s[:20]
	}
	return s
}

const alnum = "abcdefghijklmnopqrstuvwxyz0123456789"

func randomAlphanumeric(n int) string {
	buf := make([]byte, n)
	_, _ = rand.Read(buf)
	for i := range buf {
		buf[i] = alnum[int(buf[i])%len(alnum)]
	}
	return string(buf)
}

func shortID(n int) string { return randomAlphanumeric(n) }

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
