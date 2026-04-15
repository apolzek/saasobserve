package main

import (
	"context"
	"errors"
	"log/slog"

	"github.com/apolzek/saasobserve/apps/api/internal/auth"
	"github.com/apolzek/saasobserve/apps/api/internal/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Default admin identity and API key — surfaced in docs for local testing.
// Override via env in production (or just delete the user after first login).
const (
	defaultAdminEmail    = "admin@saasobserve.io"
	defaultAdminPassword = "saasobserve"
	defaultAdminName     = "Default Admin"
	defaultAdminTenant   = "default"
	defaultAdminKey      = "sk_live_default0_devkeyplaceholderforlocaltesting1"
)

// seedDefaults makes a fresh cluster usable without touching psql.
func seedDefaults(ctx context.Context, store *db.Store) error {
	user, err := store.GetUserByEmail(ctx, defaultAdminEmail)
	if errors.Is(err, pgx.ErrNoRows) {
		hash, err := auth.HashPassword(defaultAdminPassword)
		if err != nil {
			return err
		}
		user, err = store.CreateEmailUser(ctx, defaultAdminEmail, hash, defaultAdminName)
		if err != nil {
			return err
		}
		slog.Info("seeded default admin", "email", defaultAdminEmail, "id", user.ID)
	} else if err != nil {
		return err
	}
	return ensureSeedTenantAndKey(ctx, store, user)
}

func ensureSeedTenantAndKey(ctx context.Context, store *db.Store, u *db.User) error {
	if _, err := store.GetTenant(ctx, defaultAdminTenant); errors.Is(err, pgx.ErrNoRows) {
		if err := store.CreateTenant(ctx, &db.Tenant{
			ID: defaultAdminTenant, OwnerID: u.ID, DisplayName: "Default workspace", Status: "ready",
		}); err != nil {
			return err
		}
		slog.Info("seeded default tenant", "tenant", defaultAdminTenant)
	} else if err != nil {
		return err
	}
	keys, err := store.ListAPIKeys(ctx, defaultAdminTenant)
	if err != nil {
		return err
	}
	if len(keys) == 0 {
		if err := store.CreateAPIKey(ctx, &db.APIKey{
			ID:       uuid.New(),
			TenantID: defaultAdminTenant,
			Prefix:   "default0",
			Hash:     sha256Hex(defaultAdminKey),
			Label:    "default-dev-key",
		}); err != nil {
			return err
		}
		slog.Info("seeded default api key", "tenant", defaultAdminTenant)
	}
	return nil
}
