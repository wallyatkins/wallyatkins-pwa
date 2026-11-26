# Personal assistant access

WallyAuth at https://auth.wallyatkins.com is the only sign-in authority. PWA authentication must never depend on football authentication, local passwords, or browser-supplied roles.

The initial assistant is private to the configured WallyAuth subject, under the exact issuer. No administrator override grants access to that user's assistant. Do not broaden access unless the owner explicitly requests it.

Other users may sign in to the PWA and see modules authorized by verified WallyAuth roles. Users granted Assist access must each be provisioned their own isolated Hermes profile (`hermes profile create <name>`, served via `/p/<name>/` on the multiplexed gateway) with separate `SOUL.md`, `memories/`, and `config.yaml`, plus strict per-subject conversation ownership in the PWA. Never route another user into the owner's `default` profile or clone the owner's private memory or credentials.

Private responses must use no-store and must not enter service-worker caches. The browser must never receive OpenRouter or Hermes API keys. Authorization must apply to every conversation and run action. Never accept arbitrary Hermes session IDs or server URLs from a browser.

Initial tool access is chat only. Add external tools and proactive jobs after the owner defines their scope and spending limits. Keep all agent processes separate from TV Games Party and production host administration; mount no Docker socket, SSH credentials or unrelated application volumes.
