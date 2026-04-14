package config

import (
	"errors"
	"os"
)

type Config struct {
	Addr               string
	DatabaseURL        string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	SessionSecret      string
	ProvisionerURL     string
	PublicBaseURL      string
	GrafanaBaseDomain  string
}

func Load() (*Config, error) {
	c := &Config{
		Addr:               getenv("ADDR", ":8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  getenv("GOOGLE_REDIRECT_URL", "http://localhost:8080/api/auth/google/callback"),
		SessionSecret:      getenv("SESSION_SECRET", "dev-insecure-secret-change-me"),
		ProvisionerURL:     getenv("PROVISIONER_URL", "http://provisioner.saasobserve-system.svc.cluster.local:8090"),
		PublicBaseURL:      getenv("PUBLIC_BASE_URL", "http://localhost:3000"),
		GrafanaBaseDomain:  getenv("GRAFANA_BASE_DOMAIN", "grafana.saasobserve.local"),
	}
	if c.DatabaseURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}
	return c, nil
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
