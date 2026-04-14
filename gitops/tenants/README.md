# gitops/tenants

Per-tenant values files live here, one directory per tenant:

```
gitops/tenants/
├── applicationset.yaml        # ArgoCD ApplicationSet that watches this dir
├── gateway-tenants.yaml       # routing table consumed by the platform chart
└── <tenant-id>/
    └── values.yaml            # Helm values for charts/tenant-stack
```

**Do not hand-edit** tenant subdirectories — the `provisioner` service is
responsible for creating, updating, and removing them in response to
`tenant.*` events from the control plane API. Edits made by hand will be
overwritten on the next reconcile.

`gateway-tenants.yaml` is merged into the platform chart values so that the
gateway OpenTelemetry collector's routing table stays in sync with the set of
provisioned tenants.
