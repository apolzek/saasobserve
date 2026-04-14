#!/usr/bin/env bash
# Scale harness: provisions N tenants end-to-end by calling the control plane
# API directly (bypassing the OAuth flow) and then blasts the gateway with k6.
#
# Prereqs:
#   - a running saasobserve cluster (make bootstrap)
#   - k6 installed locally
#   - psql reachable via port-forward for the seed step (below)
#
# The script exercises the path:
#
#   seed tenants → wait for ArgoCD sync → collect API keys → run k6 ingest
#
set -euo pipefail

N="${N:-100}"
NAMESPACE="${NAMESPACE:-saasobserve-system}"
ENDPOINT="${ENDPOINT:-http://localhost:4318}"
KEYS_FILE="${KEYS_FILE:-$(mktemp)}"

echo "==> seeding ${N} tenants via internal API"
API_POD="$(kubectl -n "${NAMESPACE}" get pod -l app=api -o jsonpath='{.items[0].metadata.name}')"

for i in $(seq 1 "${N}"); do
  id="loadtest-$(printf '%03d' "${i}")"
  kubectl -n "${NAMESPACE}" exec "${API_POD}" -- /api --seed-tenant "${id}" >/dev/null 2>&1 || true
done

echo "==> waiting for ArgoCD to reconcile (${N} Applications)"
deadline=$(( $(date +%s) + 900 ))
while true; do
  synced=$(kubectl -n argocd get applications.argoproj.io -l saasobserve.io/tenant -o json \
    | jq '[.items[] | select(.status.sync.status=="Synced" and .status.health.status=="Healthy")] | length')
  echo "  synced: ${synced}/${N}"
  [[ "${synced}" -ge "${N}" ]] && break
  [[ $(date +%s) -gt "${deadline}" ]] && { echo "timeout"; break; }
  sleep 10
done

echo "==> collecting API keys"
: > "${KEYS_FILE}"
for i in $(seq 1 "${N}"); do
  id="loadtest-$(printf '%03d' "${i}")"
  key=$(kubectl -n "${NAMESPACE}" exec "${API_POD}" -- /api --issue-key "${id}")
  echo "${key}" >> "${KEYS_FILE}"
done
echo "==> wrote ${N} keys to ${KEYS_FILE}"

echo "==> running k6"
k6 run -e ENDPOINT="${ENDPOINT}" -e KEYS_FILE="${KEYS_FILE}" "$(dirname "$0")/k6-ingest.js"
