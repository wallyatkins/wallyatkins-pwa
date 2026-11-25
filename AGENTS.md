# PWA invariants

Read deploy/ASSISTANT-POLICY.md before changing identity, capabilities or assistant execution.

The canonical installable app origin is https://app.wallyatkins.com/. The public installation description remains at https://wallyatkins.com/app/. Do not deploy the app bundle over that page or use football APIs as the PWA identity authority.

Use WallyAuth OIDC for identity and derive permissions on the backend. No implicit admin bypass grants access to an individual user's assistant. Every assistant conversation and run operation must verify ownership. Keep provider credentials on the server and private API responses out of offline caches.

Never enable additional users on the owner's Hermes runtime. Separate operating-system isolation and private state are required before extending access. Do not change these policies without an explicit owner instruction.

Validate backend access controls with server/package.json's test command under Node 24 and build the PWA before deployment. Keep runtime secrets outside the repository.
