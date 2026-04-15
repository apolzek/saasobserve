# Google OIDC setup

saasobserve supports two ways to sign in:

1. **Email + password** — enabled by default. A seeded admin user is created
   on first boot (`admin@saasobserve.io` / `saasobserve`). You don't need to
   do anything to use this path.
2. **Google SSO (OIDC)** — optional. When configured, the "Continue with
   Google" button on the login screen works end-to-end.

This document walks through wiring up Google SSO.

## 1. Create the OAuth client in Google Cloud

1. Open <https://console.cloud.google.com/apis/credentials>.
2. Pick (or create) a project for saasobserve.
3. **OAuth consent screen** → `External` → fill in the app name (e.g.
   `saasobserve local`), your support email, and the developer email. You
   don't need to add any scopes beyond the default `openid`, `email`,
   `profile`.
4. **Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `saasobserve`
   - **Authorized JavaScript origins**:
     - `http://localhost:3333` — the UI in local dev (the port saasobserve
       forwards to)
     - your production URL, e.g. `https://app.saasobserve.io`
   - **Authorized redirect URIs**:
     - `http://localhost:3334/api/auth/google/callback` — the API port in
       local dev (saasobserve forwards API to 3334)
     - `https://api.saasobserve.io/api/auth/google/callback` in production
5. Copy the **Client ID** and **Client secret** from the modal that pops up.

> **Why two redirect URIs?** In local dev the browser hits the UI at 3333,
> but the OAuth callback has to hit the API at 3334 because that's where the
> code-exchange logic lives. In production both are served from the same
> domain by the ingress, so you only need one.

## 2. Wire the credentials into the platform chart

The platform Helm chart reads the client id and secret from
`api.google.clientId` / `api.google.clientSecret` in its values file.

### Option A — local override file (recommended for dev)

Create `charts/platform/values-oidc.yaml` (it is `.gitignore`d):

```yaml
api:
  google:
    clientId:     "123456-abc.apps.googleusercontent.com"
    clientSecret: "GOCSPX-yourSecretHere"
  # Where the UI runs in your local port-forward:
  publicBaseUrl: "http://localhost:3333"
```

Then upgrade the release:

```bash
helm upgrade platform charts/platform \
  -n saasobserve-system \
  --kube-context kind-saasobserve \
  -f charts/platform/values.yaml \
  -f charts/platform/values-oidc.yaml
```

### Option B — sealed secret or external secret manager (production)

Don't put the secret in a committed values file. Instead:

```yaml
# charts/platform/values.yaml (safe)
api:
  google:
    clientId: "123456-abc.apps.googleusercontent.com"
    clientSecret: ""   # populated from a secret manager
```

Then patch the `api` Secret out-of-band:

```bash
kubectl -n saasobserve-system create secret generic api-google \
  --from-literal=GOOGLE_CLIENT_SECRET="GOCSPX-..." \
  --dry-run=client -o yaml | kubectl apply -f -
```

…and add an `envFrom` entry for `api-google` in `charts/platform/templates/api.yaml`,
or use a sealed-secret / external-secrets operator to manage it.

## 3. Verify

1. Open <http://localhost:3333/login>.
2. Click **Continue with Google**.
3. Grant consent on the Google screen.
4. You should be redirected back to `/dashboard` and see your Google
   display name + avatar in the top-right.

If you get `redirect_uri_mismatch`, double check that the exact URL the
browser reaches — including scheme, host, port and path — matches one of
the authorized redirect URIs you registered in step 1.4.

## Environment variables the API reads

| Variable              | Default (chart)                                      | Notes                                                  |
|-----------------------|------------------------------------------------------|--------------------------------------------------------|
| `GOOGLE_CLIENT_ID`     | (empty)                                             | From Google credentials modal.                        |
| `GOOGLE_CLIENT_SECRET` | (empty)                                             | From Google credentials modal.                        |
| `GOOGLE_REDIRECT_URL`  | `http://localhost:8080/api/auth/google/callback`    | Must exactly match one authorized redirect URI.       |
| `PUBLIC_BASE_URL`      | `http://localhost:3000`                             | Where the UI runs — used for post-login redirects.    |
| `SESSION_SECRET`       | `dev-insecure-change-me`                            | Change in production.                                 |

All of these are mapped from `charts/platform/values.yaml` →
`charts/platform/templates/api.yaml` (Deployment + Secret). Change the values
there rather than the templates.

## What happens at runtime

```
user clicks Continue with Google
        │
        ▼
UI → GET /api/auth/google/start        (api sets oauth_state cookie,
        │                               returns 302 to accounts.google.com)
        ▼
user grants consent on Google
        │
        ▼
Google → GET /api/auth/google/callback?code=…&state=…
        │
        ├─ verify state cookie
        ├─ exchange code → id_token (coreos/go-oidc verifier)
        ├─ upsert user by google_sub
        ├─ ensure tenant exists, fire tenant.created to provisioner
        ├─ set saasobserve_session cookie (7d)
        └─ 302 → $PUBLIC_BASE_URL/dashboard
```

## Skipping OIDC entirely

If you don't want Google SSO at all, leave `api.google.clientId` empty. The
API will log `google oidc not configured` on boot, the `/api/auth/google/*`
endpoints will return `503`, and the **Continue with Google** button will
send users to a helpful error — email+password signup still works.
