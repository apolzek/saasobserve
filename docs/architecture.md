# Architecture

## Goals

- **Self-service multi-tenant observability** — signup to "data flowing into my own Grafana" in under two minutes.
- **Hard tenant isolation** — every customer gets a dedicated namespace with its own collector, metrics store, logs+traces store, and Grafana.
- **GitOps-native provisioning** — no direct `kubectl` from the control plane. All tenant resources are committed to a Git repo and reconciled by ArgoCD.
- **Open by default** — OpenTelemetry at the edge, VictoriaMetrics / ClickHouse / Grafana in the middle, no proprietary formats on the wire.

## Request paths

### Customer telemetry ingest

```
OTel SDK / Collector
    │ (POST /v1/metrics, header: X-Tenant-Key: sk_live_...)
    ▼
nginx ingress  ─── auth_request ───▶  auth-webhook
    │                                      │
    │                                      ▼
    │                               POST /internal/validate-key
    │                                      │
    │                                      ▼
    │                                     api (Postgres)
    │                                      │
    │◀──── 200 + X-Saasobserve-Tenant ─────┘
    │
    ▼
gateway-otelcol  (reads X-Saasobserve-Tenant from client metadata)
    │ transform → resource[tenant.id] = <id>
    │ routing   → picks exporter by tenant.id
    ▼
otelcol.tenant-<id>.svc:4318
    │
    ├─▶ VictoriaMetrics (metrics)
    └─▶ ClickHouse      (logs + traces)
                │
                ▼
          Grafana (tenant namespace)
```

### Tenant provisioning

```
user --Google SSO--> ui --▶ api /api/auth/google/callback
                                │
                                │ upsert user, ensure tenant row
                                │ fire event tenant.created
                                ▼
                          provisioner /events
                                │
                                ├─ writes gitops/tenants/<id>/values.yaml
                                ├─ appends gitops/tenants/gateway-tenants.yaml
                                └─ git commit + push
                                │
                                ▼
                          ArgoCD ApplicationSet (git directory generator)
                                │
                                ├─ new Application tenant-<id>
                                └─ platform Application re-renders
                                      (gateway routing table includes <id>)
                                │
                                ▼
                          Helm install tenant-stack in tenant-<id>
```

## Why these components

| Concern              | Choice                | Rationale                                                                                             |
|----------------------|-----------------------|-------------------------------------------------------------------------------------------------------|
| Ingest protocol      | OTLP (gRPC + HTTP)    | Vendor-neutral, single SDK story across languages.                                                    |
| Metrics store        | VictoriaMetrics       | Single binary, low footprint per tenant, remote-write compatible with the collector.                 |
| Logs + traces store  | ClickHouse            | One database, two tables — the OTel Collector `clickhouse` exporter handles schema creation.         |
| Dashboards           | Grafana               | Everybody knows it, datasources auto-provisioned per tenant.                                          |
| Provisioning         | ArgoCD ApplicationSet | Git-directory generator matches exactly how the provisioner writes tenants.                          |
| Auth at the edge     | nginx auth_request    | No custom Envoy filters; the ingress controller already ships with this primitive.                   |
| Control plane DB     | Postgres              | Boring, durable, good enough for signups + keys + tenants.                                            |

## Isolation guarantees

- **Namespace per tenant** (`tenant-<id>`) — kubelet, RBAC, and quota boundaries apply.
- **NetworkPolicy** — the tenant collector only accepts traffic from `saasobserve-system` (the gateway). Everything else inside the tenant namespace accepts only pods in that namespace plus `ingress-nginx` for Grafana.
- **Data path** — tenants never share a VictoriaMetrics or ClickHouse instance. Compromising one tenant's collector cannot read another tenant's data because the target service DNS is namespaced (`victoria-metrics.tenant-a.svc` vs `tenant-b.svc`).
- **API keys** — stored as `sha256(plain)`. The lookup is prefix-indexed so validation is O(1) in Postgres; the full hash is compared in Go.

## Tradeoffs we deliberately made

- **1 Grafana per tenant** is expensive but gives a dedicated UI surface and admin realm per customer. Alternative: shared Grafana with org-per-tenant — cheaper, but customers lose the ability to install plugins or customise settings.
- **ClickHouse single-node per tenant** will bottleneck a heavy user. For a real production rollout, sharding or tiered storage per tenant is the obvious next step; the helm chart leaves the template simple so you can fork it per-plan.
- **Gateway routing table via git** means onboarding latency is bounded by ArgoCD reconcile (~30–90s) rather than milliseconds. A future iteration could move the routing table into a Redis-backed custom exporter for instant onboarding.
- **No RUM / profiling** yet — the OpenTelemetry spec is still settling on both; easier to add later than to walk back opinions.

## Scaling notes

- The gateway collector is horizontally scalable — the routing table is stateless. Put an NLB in front of it and scale on `otelcol_receiver_accepted_spans`.
- ClickHouse gets the most pressure per tenant; the next iteration should batch more aggressively at the tenant collector (`timeout: 10s`, `send_batch_size: 65536`).
- Postgres holds only users, tenants, and keys — for 100k tenants, still well under a single `db.m5.large` worth of load.
