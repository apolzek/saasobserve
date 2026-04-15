package db

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

func Open(ctx context.Context, url string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 10
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() { s.pool.Close() }

// ---------------------------------------------------------------------------
// schema

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  google_sub    TEXT UNIQUE,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name          TEXT NOT NULL,
  picture       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ALTER COLUMN google_sub DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'provisioning',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prefix        TEXT NOT NULL,
  hash          TEXT NOT NULL,
  label         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys(prefix);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL
);
`

func (s *Store) Migrate(ctx context.Context) error {
	_, err := s.pool.Exec(ctx, schema)
	return err
}

// ---------------------------------------------------------------------------
// users

type User struct {
	ID           uuid.UUID
	GoogleSub    string
	Email        string
	PasswordHash string
	Name         string
	Picture      string
	CreatedAt    time.Time
}

func (s *Store) UpsertGoogleUser(ctx context.Context, sub, email, name, picture string) (*User, error) {
	u := &User{}
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (id, google_sub, email, name, picture)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (google_sub) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, picture=EXCLUDED.picture
		RETURNING id, COALESCE(google_sub,''), email, COALESCE(password_hash,''), name, COALESCE(picture,''), created_at
	`, uuid.New(), sub, email, name, picture).
		Scan(&u.ID, &u.GoogleSub, &u.Email, &u.PasswordHash, &u.Name, &u.Picture, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

// CreateEmailUser inserts a new user authenticated with email+password.
// Returns pgx.ErrNoRows-equivalent if the email is already taken.
func (s *Store) CreateEmailUser(ctx context.Context, email, passwordHash, name string) (*User, error) {
	u := &User{}
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (id, email, password_hash, name)
		VALUES ($1, $2, $3, $4)
		RETURNING id, COALESCE(google_sub,''), email, password_hash, name, COALESCE(picture,''), created_at
	`, uuid.New(), email, passwordHash, name).
		Scan(&u.ID, &u.GoogleSub, &u.Email, &u.PasswordHash, &u.Name, &u.Picture, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	u := &User{}
	err := s.pool.QueryRow(ctx,
		`SELECT id, COALESCE(google_sub,''), email, COALESCE(password_hash,''), name, COALESCE(picture,''), created_at FROM users WHERE email=$1`, email).
		Scan(&u.ID, &u.GoogleSub, &u.Email, &u.PasswordHash, &u.Name, &u.Picture, &u.CreatedAt)
	return u, err
}

func (s *Store) GetUser(ctx context.Context, id uuid.UUID) (*User, error) {
	u := &User{}
	err := s.pool.QueryRow(ctx,
		`SELECT id, COALESCE(google_sub,''), email, COALESCE(password_hash,''), name, COALESCE(picture,''), created_at FROM users WHERE id=$1`, id).
		Scan(&u.ID, &u.GoogleSub, &u.Email, &u.PasswordHash, &u.Name, &u.Picture, &u.CreatedAt)
	return u, err
}

// ---------------------------------------------------------------------------
// sessions

func (s *Store) CreateSession(ctx context.Context, token string, userID uuid.UUID, ttl time.Duration) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
		token, userID, time.Now().Add(ttl))
	return err
}

func (s *Store) GetSessionUser(ctx context.Context, token string) (*User, error) {
	var userID uuid.UUID
	var expires time.Time
	err := s.pool.QueryRow(ctx,
		`SELECT user_id, expires_at FROM sessions WHERE token=$1`, token).Scan(&userID, &expires)
	if err != nil {
		return nil, err
	}
	if time.Now().After(expires) {
		return nil, errors.New("session expired")
	}
	return s.GetUser(ctx, userID)
}

func (s *Store) DeleteSession(ctx context.Context, token string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM sessions WHERE token=$1`, token)
	return err
}

// ---------------------------------------------------------------------------
// tenants

type Tenant struct {
	ID          string
	OwnerID     uuid.UUID
	DisplayName string
	Status      string
	CreatedAt   time.Time
}

func (s *Store) CreateTenant(ctx context.Context, t *Tenant) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO tenants (id, owner_id, display_name, status)
		VALUES ($1, $2, $3, $4)
	`, t.ID, t.OwnerID, t.DisplayName, t.Status)
	return err
}

func (s *Store) ListTenantsByOwner(ctx context.Context, ownerID uuid.UUID) ([]Tenant, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, owner_id, display_name, status, created_at FROM tenants WHERE owner_id=$1 ORDER BY created_at`,
		ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Tenant
	for rows.Next() {
		var t Tenant
		if err := rows.Scan(&t.ID, &t.OwnerID, &t.DisplayName, &t.Status, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) GetTenant(ctx context.Context, id string) (*Tenant, error) {
	t := &Tenant{}
	err := s.pool.QueryRow(ctx,
		`SELECT id, owner_id, display_name, status, created_at FROM tenants WHERE id=$1`, id).
		Scan(&t.ID, &t.OwnerID, &t.DisplayName, &t.Status, &t.CreatedAt)
	return t, err
}

func (s *Store) SetTenantStatus(ctx context.Context, id, status string) error {
	_, err := s.pool.Exec(ctx, `UPDATE tenants SET status=$1 WHERE id=$2`, status, id)
	return err
}

// ---------------------------------------------------------------------------
// api keys

type APIKey struct {
	ID        uuid.UUID
	TenantID  string
	Prefix    string
	Hash      string
	Label     string
	CreatedAt time.Time
}

func (s *Store) CreateAPIKey(ctx context.Context, k *APIKey) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO api_keys (id, tenant_id, prefix, hash, label)
		VALUES ($1, $2, $3, $4, $5)
	`, k.ID, k.TenantID, k.Prefix, k.Hash, k.Label)
	return err
}

func (s *Store) ListAPIKeys(ctx context.Context, tenantID string) ([]APIKey, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, tenant_id, prefix, hash, label, created_at FROM api_keys WHERE tenant_id=$1 ORDER BY created_at`,
		tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []APIKey
	for rows.Next() {
		var k APIKey
		if err := rows.Scan(&k.ID, &k.TenantID, &k.Prefix, &k.Hash, &k.Label, &k.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func (s *Store) DeleteAPIKey(ctx context.Context, id uuid.UUID, tenantID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM api_keys WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// FindAPIKeyByPrefix looks up candidate keys for validation.
func (s *Store) FindAPIKeyByPrefix(ctx context.Context, prefix string) ([]APIKey, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, tenant_id, prefix, hash, label, created_at FROM api_keys WHERE prefix=$1`, prefix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []APIKey
	for rows.Next() {
		var k APIKey
		if err := rows.Scan(&k.ID, &k.TenantID, &k.Prefix, &k.Hash, &k.Label, &k.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func (s *Store) TouchAPIKey(ctx context.Context, id uuid.UUID) {
	_, _ = s.pool.Exec(ctx, `UPDATE api_keys SET last_used_at=now() WHERE id=$1`, id)
}

// ErrNoRows is a convenience alias.
var ErrNoRows = pgx.ErrNoRows
