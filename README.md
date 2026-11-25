# Wally Atkins PWA

The canonical installable application is **https://app.wallyatkins.com/**. The public installation description remains at **https://wallyatkins.com/app/**. The earlier deployed `/pwa/` installation is left available during migration; existing installations do not automatically move across origins.

## Independent identity

A dedicated confidential `wally-pwa` WallyAuth OIDC client signs the PWA in through `/auth/login` and `/auth/callback`. The server uses Authorization Code with PKCE, state, nonce and ID-token validation, then creates an opaque HttpOnly Secure SameSite=Lax host-only session. Provider access tokens are encrypted in server-side SQLite. Sessions expire no later than the access token or eight hours, and userinfo/roles are revalidated after five minutes when the session is used. There is no football API dependency for PWA identity, preferences or authorization.

`GET /api/me` returns verified user information, module capabilities and a CSRF token. All mutation endpoints require the token and the exact browser origin. The browser cannot assign roles or supply Hermes runtime/session identifiers. Anonymous API requests fail closed; private responses use `Cache-Control: no-store, private`. The service worker caches only public app assets, not authentication or API responses.

## Modules and assistant

Verified `football-player`, `mud-player` and `tasks-user` roles reveal launch cards for their respective existing applications. These cards open the full services separately. Their prior embedded frontends remain in source but are not used on this new origin: their APIs still require separate integration with the independent PWA identity. Do not silently proxy existing authentication cookies or assume a PWA role creates a service session.

The Assistant module is initially authorized only for the configured immutable WallyAuth owner subject under the exact issuer. Other users, including administrators, cannot access that runtime. See [the access policy](deploy/ASSISTANT-POLICY.md). Before supporting another assistant user, provision a distinct whole-process runtime and private storage; do not share the owner's Hermes home or credentials.

The first chat transport uses Hermes' durable Runs API with a persistent request ID, backend-owned conversation mapping, polling/reconnection and stop controls. The PWA currently polls run state every 2.5 seconds; token-by-token streaming is a follow-up. An uncertain submission is retried only with its original idempotency key. Unknown execution outcomes block new turns until reviewed rather than silently repeating work. No arbitrary tools, model overrides or user-supplied system instructions are exposed by the bridge.

## Development

Frontend: Node 20+; backend: Node **24+** (uses `node:sqlite`).

```bash
npm ci
npm run build
cd server
npm ci
npm test
```

Backend configuration is documented in `deploy/pwa.env.example`. Generate a unique 32-byte hex session encryption key. Actual env files and state must stay outside this repository. A development backend still uses secure cookies, so test the full login flow through HTTPS. The local Vite proxy points at backend port 3001; override `PORT=3001` for development.

## Oracle deployment

- Source: `/home/ubuntu/wally-pwa-source`
- Private configuration/state: `/opt/wally-assistant` (restricted directory)
- PWA: Compose project `wally-assistant`, private listener `127.0.0.1:3103`
- Hermes: official ARM64 image pinned by digest, separate container, no published ports, private Hermes data volume, memory/CPU limits
- HTTPS: existing Caddy proxy with a dedicated `app.wallyatkins.com` host and private network connectivity
- WallyAuth callback: `https://app.wallyatkins.com/auth/callback`

Deploy subsequent PWA changes using `scripts/deploy.sh`; it targets Oracle and never writes over the public installation page. The initial DNS, TLS and identity provisioning are separate operator steps documented in the release record.

## OpenRouter activation remains gated

The initial installation sets `ASSISTANT_ENABLED=false`. The runtime has no selected model or OpenRouter key; health does not imply inference readiness. No paid model calls were made during this installation.

Create a dedicated capped OpenRouter key. From your own terminal, install it without echoing it or adding it to shell history:

```bash
ssh -t oci-arm 'sudo /opt/wally-assistant/configure-openrouter'
```

The helper validates the key against OpenRouter, requires a configured spending limit, stores it with mode 600 and leaves chat disabled. Confirm the monthly budget with the owner, select models using the current OpenRouter catalogue/pricing, configure per-platform tools, then perform a controlled inference test before enabling `ASSISTANT_ENABLED`. Proactive jobs and external service credentials require explicit scope decisions. The assistant name is still undecided.

## Validation and remaining gates

Security tests cover anonymous access, browser-bound OIDC transactions, owner-only assistant access despite an unrelated admin role, missing module roles, CSRF, conversation ownership, duplicate-submission protection, session expiration and logout invalidation. The full PWA production build passes.

Interactive WallyAuth sign-in as the owner, live OpenRouter inference, full run reconnection/cancellation and physical installed-PWA acceptance need real credentials/user participation. Keep these gates explicit; a mocked upstream test does not prove a live model round trip.
