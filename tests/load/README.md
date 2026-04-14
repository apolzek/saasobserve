# Load tests

The goal: prove that saasobserve can provision and serve **100 tenants** end-to-end on a single kind cluster, and sustain ingest against the gateway collector under a realistic OTLP mix.

## Files

- `k6-ingest.js` — k6 script that round-robins across a list of API keys and POSTs OTLP/HTTP metric payloads to the gateway. Thresholds: 98% accepted, p95 < 500ms.
- `scale-100-tenants.sh` — end-to-end harness: provisions tenants, waits for ArgoCD sync, collects keys, runs k6.

## Running locally

```bash
# 1. Bring up the cluster in scale-test profile (values-scale-test.yaml is already the default for the ApplicationSet)
./deploy/kind/bootstrap.sh

# 2. Port-forward the gateway
kubectl -n saasobserve-system port-forward svc/gateway-otelcol 4318:4318 &

# 3. Run the harness
make loadtest                # or: tests/load/scale-100-tenants.sh
```

## What "passes" looks like

- **100 ArgoCD Applications** reach `Synced + Healthy` within 15 minutes.
- k6 reports `http_req_failed rate < 2%` and `http_req_duration p(95) < 500ms`.
- Gateway collector metrics (`otelcol_exporter_sent_metric_points`) grow
  continuously during the run with no sustained dropped batches.

If a run fails, first check:

1. `kubectl top pods -A` — look for OOMKills (bump requests in `values-scale-test.yaml` temporarily).
2. `kubectl -n saasobserve-system logs deploy/gateway-otelcol` — routing table must include every tenant.
3. `kubectl -n argocd get applications` — any `OutOfSync` means the provisioner didn't commit cleanly.

## Real-world profile

In production use `values.yaml` (not `values-scale-test.yaml`) — the reduced profile cuts requests to the point where any real customer would throttle. The scale test only exists to validate that the orchestration path holds together, not that the backends have production capacity.
