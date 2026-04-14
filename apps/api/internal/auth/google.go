package auth

import (
	"context"
	"errors"

	"github.com/apolzek/saasobserve/apps/api/internal/config"
	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type Google struct {
	Provider *oidc.Provider
	Config   oauth2.Config
	Verifier *oidc.IDTokenVerifier
}

func NewGoogle(ctx context.Context, c *config.Config) (*Google, error) {
	if c.GoogleClientID == "" || c.GoogleClientSecret == "" {
		// Allow the API to boot without OIDC so local kind installs don't
		// break before Google credentials are wired up. /api/auth/* endpoints
		// will return a helpful error in that mode.
		return &Google{}, nil
	}
	p, err := oidc.NewProvider(ctx, "https://accounts.google.com")
	if err != nil {
		return nil, err
	}
	return &Google{
		Provider: p,
		Config: oauth2.Config{
			ClientID:     c.GoogleClientID,
			ClientSecret: c.GoogleClientSecret,
			RedirectURL:  c.GoogleRedirectURL,
			Endpoint:     p.Endpoint(),
			Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
		},
		Verifier: p.Verifier(&oidc.Config{ClientID: c.GoogleClientID}),
	}, nil
}

func (g *Google) Enabled() bool { return g.Provider != nil }

type Claims struct {
	Sub     string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func (g *Google) Exchange(ctx context.Context, code string) (*Claims, error) {
	if !g.Enabled() {
		return nil, errors.New("google oidc not configured")
	}
	tok, err := g.Config.Exchange(ctx, code)
	if err != nil {
		return nil, err
	}
	raw, ok := tok.Extra("id_token").(string)
	if !ok {
		return nil, errors.New("no id_token in response")
	}
	idt, err := g.Verifier.Verify(ctx, raw)
	if err != nil {
		return nil, err
	}
	var c Claims
	if err := idt.Claims(&c); err != nil {
		return nil, err
	}
	return &c, nil
}
