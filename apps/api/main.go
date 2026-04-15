package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/apolzek/saasobserve/apps/api/internal/auth"
	"github.com/apolzek/saasobserve/apps/api/internal/config"
	"github.com/apolzek/saasobserve/apps/api/internal/db"
	"github.com/apolzek/saasobserve/apps/api/internal/httpx"
	"github.com/apolzek/saasobserve/apps/api/internal/tenant"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(log)

	cfg, err := config.Load()
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	store, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("db open", "err", err)
		os.Exit(1)
	}
	defer store.Close()

	if err := store.Migrate(ctx); err != nil {
		log.Error("db migrate", "err", err)
		os.Exit(1)
	}

	if err := seedDefaults(ctx, store); err != nil {
		log.Warn("seed defaults", "err", err)
	}

	oidc, err := auth.NewGoogle(ctx, cfg)
	if err != nil {
		log.Error("oidc", "err", err)
		os.Exit(1)
	}

	tenants := tenant.NewService(store, cfg.ProvisionerURL)
	h := httpx.NewRouter(cfg, store, oidc, tenants)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           h,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Info("api listening", "addr", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("listen", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	log.Info("shutting down")
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()
	_ = srv.Shutdown(shutdownCtx)
}
