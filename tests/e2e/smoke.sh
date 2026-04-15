#!/usr/bin/env bash
# End-to-end smoke test against a running saasobserve cluster.
#
# Assumes port-forwards:
#   UI        → http://localhost:3333
#   API       → http://localhost:3334
#   Gateway   → http://localhost:3335
#
# Exercises:
#   1. default admin login (seeded on boot)
#   2. /api/me returns the seeded user and tenant
#   3. creating + listing + revoking an API key
#   4. /internal/validate-key accepts the seeded default-dev-key
#   5. OTLP ingest through the gateway collector
#   6. new player signup + login roundtrip
#
# Exit code is non-zero if any assertion fails.

set -euo pipefail

API="${API:-http://localhost:3334}"
GW="${GW:-http://localhost:3335}"

COOKIE=$(mktemp)
trap 'rm -f "$COOKIE"' EXIT

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
step()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }

pass=0
fail=0
assert_eq() {
  if [[ "$1" == "$2" ]]; then
    green "  ✔ $3"; pass=$((pass+1))
  else
    red   "  ✘ $3  (got: $1, want: $2)"; fail=$((fail+1))
  fi
}
assert_contains() {
  if [[ "$1" == *"$2"* ]]; then
    green "  ✔ $3"; pass=$((pass+1))
  else
    red   "  ✘ $3  (got: $1)"; fail=$((fail+1))
  fi
}

# ---------------------------------------------------------------------------
step "1. healthz"
code=$(curl -s -o /dev/null -w '%{http_code}' "$API/healthz")
assert_eq "$code" "200" "API /healthz returns 200"

# ---------------------------------------------------------------------------
step "2. default admin login"
resp=$(curl -s -c "$COOKIE" -o /tmp/login.json -w '%{http_code}' \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@saasobserve.io","password":"saasobserve"}' \
  "$API/api/auth/login")
assert_eq "$resp" "200" "login returns 200"
assert_contains "$(cat /tmp/login.json)" "admin@saasobserve.io" "login response contains email"

# ---------------------------------------------------------------------------
step "3. /api/me reflects the tenant"
me=$(curl -s -b "$COOKIE" "$API/api/me")
echo "  raw: $me"
assert_contains "$me" '"tenant":"default"' "me.tenant == default"
assert_contains "$me" '"email":"admin@saasobserve.io"' "me.email matches"

# ---------------------------------------------------------------------------
step "4. API key CRUD"
created=$(curl -s -b "$COOKIE" -H "Content-Type: application/json" \
  -d '{"label":"smoke"}' "$API/api/keys")
key=$(echo "$created" | sed -n 's/.*"key":"\([^"]*\)".*/\1/p')
keyid=$(echo "$created" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [[ -z "$key" ]]; then red "  ✘ no key returned"; fail=$((fail+1)); else green "  ✔ created key ${key:0:20}…"; pass=$((pass+1)); fi

listed=$(curl -s -b "$COOKIE" "$API/api/keys")
assert_contains "$listed" "smoke" "list contains new key"

del=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE" -X DELETE "$API/api/keys/$keyid")
assert_eq "$del" "204" "delete returns 204"

# ---------------------------------------------------------------------------
step "5. internal /validate-key accepts seeded default key"
seed_key="sk_live_default0_devkeyplaceholderforlocaltesting1"
v=$(curl -s -H "Content-Type: application/json" \
  -d "{\"key\":\"$seed_key\"}" \
  "$API/internal/validate-key")
assert_contains "$v" '"valid":true' "validate-key accepts seed key"
assert_contains "$v" '"tenant":"default"' "validate-key resolves default tenant"

# ---------------------------------------------------------------------------
step "6. OTLP ingest through gateway collector"
otlp_body='{"resourceMetrics":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"smoke-e2e"}}]},"scopeMetrics":[{"scope":{"name":"smoke"},"metrics":[{"name":"smoke_hits","sum":{"aggregationTemporality":2,"isMonotonic":true,"dataPoints":[{"asInt":1,"timeUnixNano":"1700000000000000000"}]}}]}]}]}'
otlp_code=$(curl -s -o /tmp/otlp.json -w '%{http_code}' -X POST "$GW/v1/metrics" \
  -H "X-Tenant-Key: $seed_key" \
  -H "X-Saasobserve-Tenant: default" \
  -H "Content-Type: application/json" \
  --data-binary "$otlp_body")
assert_eq "$otlp_code" "200" "gateway accepts OTLP (200)"
assert_contains "$(cat /tmp/otlp.json)" "partialSuccess" "OTLP response shape"

# ---------------------------------------------------------------------------
step "7. new player signup + login roundtrip"
rand=$RANDOM
email="luigi$rand@example.com"
signup=$(curl -s -o /tmp/signup.json -w '%{http_code}' -c /tmp/new-cookie \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"mushroom1up\",\"name\":\"Luigi\"}" \
  "$API/api/auth/signup")
assert_eq "$signup" "201" "signup returns 201"

me_new=$(curl -s -b /tmp/new-cookie "$API/api/me")
assert_contains "$me_new" "$email" "new user /api/me reflects email"
assert_contains "$me_new" '"name":"Luigi"' "new user name is Luigi"

# ---------------------------------------------------------------------------
echo
printf "results: \033[32m%d passed\033[0m, \033[31m%d failed\033[0m\n" "$pass" "$fail"
[[ $fail -eq 0 ]]
