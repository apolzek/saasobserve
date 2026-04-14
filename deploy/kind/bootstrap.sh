#!/usr/bin/env bash
# Bootstraps a local saasobserve cluster end-to-end:
#   1. kind cluster
#   2. ingress-nginx
#   3. ArgoCD
#   4. platform chart (api, ui, postgres, gateway otelcol, auth-webhook, provisioner)
#   5. tenant ApplicationSet
set -euo pipefail

CLUSTER=saasobserve
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "==> kind cluster"
kind get clusters | grep -q "^${CLUSTER}$" || \
  kind create cluster --config "${ROOT}/deploy/kind/cluster.yaml" --name "${CLUSTER}"

echo "==> ingress-nginx"
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl -n ingress-nginx wait --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=300s || true

echo "==> ArgoCD"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl -n argocd wait --for=condition=available deploy/argocd-server --timeout=300s || true

echo "==> build & load images"
make -C "${ROOT}" images

echo "==> platform chart"
helm upgrade --install platform "${ROOT}/charts/platform" \
  -n saasobserve-system --create-namespace \
  -f "${ROOT}/charts/platform/values.yaml"

echo "==> tenant ApplicationSet"
kubectl apply -n argocd -f "${ROOT}/gitops/tenants/applicationset.yaml"

cat <<EOF

========================================================================
 saasobserve is up.
   UI:       kubectl -n saasobserve-system port-forward svc/ui 3000:3000
   API:      kubectl -n saasobserve-system port-forward svc/api 8080:8080
   OTLP:     localhost:4317 (gRPC) / localhost:4318 (HTTP)
   ArgoCD:   kubectl -n argocd port-forward svc/argocd-server 8081:80
========================================================================
EOF
