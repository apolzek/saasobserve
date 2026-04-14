# saasobserve

Open, self-hostable alternative to Grafana Cloud. Multi-tenant observability platform on Kubernetes: OpenTelemetry ingest, per-tenant metrics/logs/traces backends, and a dedicated Grafana per customer — all provisioned via GitOps.

## What you get

- **Single OTLP endpoint** for customers to point their OTel SDKs / Collectors at.
- **Per-tenant isolation** via Kubernetes namespaces (`tenant-<id>`).
- **Per-tenant stack**: OTel Collector → VictoriaMetrics (metrics) + ClickHouse (logs & traces) + Grafana (SSO).
- **Self-service signup** with Google SSO, API key generation, and a polished dashboard.
- **GitOps provisioning**: signup triggers a commit to a manifests repo; ArgoCD `ApplicationSet` reconciles.
- **Scale-tested** to 100 tenants with k6 (see `tests/load/`).

## Architecture

```
                  ┌────────────────────────────────────────────────┐
                  │                 public internet                 │
                  └───────────────┬─────────────────┬───────────────┘
                                  │ OTLP            │ HTTPS
                                  ▼                 ▼
                      ┌──────────────────┐   ┌──────────────┐
                      │  otel gateway    │   │     ui       │
                      │  (routing +      │   │  (Next.js)   │
                      │   authextension) │   └──────┬───────┘
                      └───────┬──────────┘          │
                              │   asks "is this     │ /api/*
                              │    key valid?"      ▼
                              │             ┌──────────────┐
                              ▼             │    api       │◄── Postgres
                      ┌──────────────┐      │   (Go)       │
                      │ auth-webhook │◄─────┤              │
                      │    (Go)      │      └──────┬───────┘
                      └──────────────┘             │ tenant.created
                                                   ▼
                                            ┌──────────────┐    commits
                                            │ provisioner  │───────────┐
                                            │    (Go)      │           │
                                            └──────────────┘           │
                                                                       ▼
                                                               ┌──────────────┐
                                                               │   gitops/    │
                                                               │   (GitHub)   │
                                                               └──────┬───────┘
                                                                      │ sync
                  ┌───────────────────────────────────────────────────┴───────┐
                  │                       ArgoCD ApplicationSet                │
                  └───┬─────────────────────────┬──────────────────────────┬──┘
                      ▼                         ▼                          ▼
           ┌──────────────────┐      ┌──────────────────┐        ┌──────────────────┐
           │    tenant-a      │      │    tenant-b      │  ...   │    tenant-n      │
           │  ┌────────────┐  │      │  ┌────────────┐  │        │  ┌────────────┐  │
           │  │  otelcol   │  │      │  │  otelcol   │  │        │  │  otelcol   │  │
           │  └─────┬──────┘  │      │  └─────┬──────┘  │        │  └─────┬──────┘  │
           │  ┌─────▼──────┐  │      │  ┌─────▼──────┐  │        │  ┌─────▼──────┐  │
           │  │ victoria-  │  │      │  │ victoria-  │  │        │  │ victoria-  │  │
           │  │  metrics   │  │      │  │  metrics   │  │        │  │  metrics   │  │
           │  └────────────┘  │      │  └────────────┘  │        │  └────────────┘  │
           │  ┌────────────┐  │      │  ┌────────────┐  │        │  ┌────────────┐  │
           │  │ clickhouse │  │      │  │ clickhouse │  │        │  │ clickhouse │  │
           │  └────────────┘  │      │  └────────────┘  │        │  └────────────┘  │
           │  ┌────────────┐  │      │  ┌────────────┐  │        │  ┌────────────┐  │
           │  │  grafana   │  │      │  │  grafana   │  │        │  │  grafana   │  │
           │  └────────────┘  │      │  └────────────┘  │        │  └────────────┘  │
           └──────────────────┘      └──────────────────┘        └──────────────────┘
```

## Quick start (local kind)

```bash
# 1. Bring up cluster + ArgoCD + platform
./deploy/kind/bootstrap.sh

# 2. Open UI
kubectl port-forward -n saasobserve-system svc/ui 3000:3000
open http://localhost:3000

# 3. Sign in with Google, copy your API key, send data
curl -X POST http://localhost:4318/v1/metrics \
  -H "X-Tenant-Key: sk_live_..." \
  -H "Content-Type: application/json" \
  -d @tests/load/sample-metrics.json
```

See [docs/quickstart.md](docs/quickstart.md) and [docs/architecture.md](docs/architecture.md) for details.

## Layout

```
apps/               # Go + Next.js services (control plane)
  api/              # auth, tenants, API keys — Postgres-backed
  auth-webhook/     # called by gateway otelcol to validate keys
  provisioner/      # renders manifests and commits to gitops/tenants
  ui/               # Next.js + Tailwind customer UI
charts/
  platform/         # gateway collector, api, ui, postgres, auth-webhook
  tenant-stack/     # per-tenant: otelcol + VM + CH + Grafana
gitops/
  platform/         # ArgoCD app-of-apps for the control plane
  tenants/          # ApplicationSet + per-tenant values (written by provisioner)
deploy/
  kind/             # local cluster bootstrap
  argocd/           # ArgoCD install overlay
tests/load/         # k6 scripts + 100-tenant scale harness
docs/               # architecture, quickstart
```

## Production profile

All workloads default to **1 CPU / 1 GiB RAM** (`values-production.yaml`). The scale-test profile (`values-scale-test.yaml`) drops requests so you can run 100 tenants in a single kind cluster.

## License

Apache 2.0.
