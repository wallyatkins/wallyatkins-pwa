# Personal assistant access

WallyAuth at https://auth.wallyatkins.com is the only sign-in authority. PWA authentication must never depend on football authentication, local passwords, or browser-supplied roles.

The initial assistant is private to the configured WallyAuth subject, under the exact issuer. No administrator override grants access to that user's assistant. Do not broaden access unless the owner explicitly requests it.

Other users may sign in to the PWA and see modules authorized by verified WallyAuth roles. Do not route them to the owner's Hermes runtime. Before enabling assistant access for anyone else, provision a separate whole-process container, Hermes home, workspace, credentials, quotas and conversation ownership mapping for that person. Shared names, conversation IDs or profiles alone are not an isolation boundary. Do not clone the owner's memory or credentials when provisioning another user.

Private responses must use no-store and must not enter service-worker caches. The browser must never receive OpenRouter or Hermes API keys. Authorization must apply to every conversation and run action. Never accept arbitrary Hermes session IDs or server URLs from a browser.

Initial tool access is chat only. Add external tools and proactive jobs after the owner defines their scope and spending limits. Keep all agent processes separate from TV Games Party and production host administration; mount no Docker socket, SSH credentials or unrelated application volumes.
