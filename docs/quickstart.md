# Quickstart

Local end-to-end bring-up on kind. Takes ~5–10 minutes on a laptop.

## Prereqs

- Docker
- kind ≥ 0.24
- kubectl ≥ 1.30
- helm ≥ 3.15
- Go ≥ 1.23 (to build images)
- Node ≥ 20 (to build the UI)
- `gh` optional, for publishing

## Bring it up

```bash
make bootstrap
```

This runs, in order:

1. `kind create cluster` with the saasobserve config
2. ingress-nginx (for the OTLP and UI ingresses)
3. ArgoCD
4. builds all four images (`api`, `ui`, `auth-webhook`, `provisioner`) and loads them into the kind nodes
5. `helm install platform charts/platform` into `saasobserve-system`
6. applies the tenant `ApplicationSet`

## Sign up

```bash
kubectl -n saasobserve-system port-forward svc/ui 3000:3000
open http://localhost:3000/login
```

**Google OAuth client setup** (one-time): create an OAuth 2.0 Client ID in the
Google Cloud console with `http://localhost:8080/api/auth/google/callback`
as an authorized redirect URI. Drop the client id + secret into
`charts/platform/values.yaml` (or a `-f overrides.yaml`) and re-run
`helm upgrade`.

## Send data

After signup, the dashboard shows a fresh API key. Point any OTel client at
the gateway:

```bash
# Port-forward the gateway (or use the kind host port 4318)
kubectl -n saasobserve-system port-forward svc/gateway-otelcol 4318:4318 &

curl -X POST http://localhost:4318/v1/metrics \
  -H "X-Tenant-Key: sk_live_..." \
  -H "Content-Type: application/json" \
  --data-binary @tests/load/sample-metrics.json
```

## Watch it land

```bash
kubectl get applications -n argocd               # your tenant Application reconciling
kubectl -n tenant-<id> get pods                  # otelcol + VM + CH + Grafana
kubectl -n tenant-<id> port-forward svc/grafana 3001:3000
open http://localhost:3001                       # admin / change-me-in-production
```

Pick the pre-provisioned `VictoriaMetrics` datasource and query
`requests_total` — you should see whatever you just sent through the gateway.
