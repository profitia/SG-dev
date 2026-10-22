# Identity Runtime — B2 source foundation

Architecture Platform / ARCHITECTURE / Development. Node24.15+, TypeScript5.9.3, official `@clerk/backend@3.25.0`; native HTTP avoids changing SG2 Next14/React18 or SRM Next16/React19. No UI, new identity provider, password store, custom session cookie, token verifier or authorization engine.

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm run build
npm test
npm start
```

Default startup binds `127.0.0.1:3600`, serves `/healthz`, and returns503 for `/readyz` and protected APIs. This is explicitly unconfigured, not an operational login. `HOST`/`PORT` are deployment-owned. No live secret or product connection is needed for source validation. `dist/` is generated and ignored.

## Boundaries

`readConfiguration` accepts a closed Development-only server registry: exact application ID/origin/issuer/publishable key and target ID → exact application/origin/static route-key map. HTTP cannot override it. Official initializer reuses `readClerkConfiguration`, disables telemetry, and uses the standard Clerk Backend API. Real session verification reuses `createClerkIdentityAuthenticator`; production binding reads reuse `createAccessStore`. Every request performs fresh session/user/binding reads. An absent/disabled/revoked/expired Profitia binding denies; there is no renewal or implicit provisioning.

APIs are `GET /v1/session`, `POST /v1/flows`, `POST /v1/flows/consume` and `POST /v1/session/logout`. Mutations require exact Origin and JSON. Cookie and bearer credentials are verified by the SDK; forwarded identity headers grant nothing. Public responses omit actors, tokens, keys and DB metadata. API `handshake` fails closed; this API does not copy SDK redirect/debug headers. Future C/D and consumer UI/SSR must use the official Clerk SDK handshake, not a custom cookie bridge.

Flow creation accepts only `{targetId,routeKey,flow}` (`registration`, `login`, `recovery`). The opaque32-byte navigation nonce binds the current internal user, session/binding proof, receiving origin, Development environment, destination, flow identity and finite expiry (at most60s and within current binding). Consume takes only `{state}`; it deletes atomically before returning, reauthenticates before/after consumption, and returns303 exclusively to the registered URL. It never grants a target session or product permission. The receiver must authenticate independently on arrival, then authorize product operations through its own accepted Access Store/operation host.

The bounded in-memory store is for **one process only**. Restart discards pending flows; it cannot create authentication. Multiple workers/replicas require a separately reviewed shared atomic store and routing/deployment decision. No cloud store was created. Logout clears pending user navigation and marks the current session denied locally before calling official `sessions.revokeSession`; an unsuccessful or unconfirmed revocation returns503. This is a deny cache, not session authority. Cross-process/durable logout relies on confirmed Clerk revocation and fresh receiver checks, never on the local cache alone.

## Future deployment inputs — not provisioned

`IDENTITY_RUNTIME_ENABLED=true` is an explicit later activation flag, never set by B2. Only a separately authorized deployment may provide `IDENTITY_RUNTIME_CONFIGURATION` (the reviewed nonsecret registry), `CLERK_SECRET_KEY`, `IDENTITY_DATABASE_URL` and `IDENTITY_ACCESS_BINDING`. Main requires ordinary `identity_b1_runtime`, exact configured app/environment and verified TLS; accepted Access Store descriptor validates the actual DB role/installation. B2 obtains no private credential, key or policy. Current private Neon app/binding remain DISABLED and profile policy absent. A malformed/incomplete enabled configuration fails startup without a demo fallback.

Source tests use isolated fixtures, including real official SDK RSA verification and actual loopback Backend API decoding/revocation. They do not prove live Clerk login or cross-domain browser SSO. See the [consumer adoption runbook](../../Canon/runbooks/identity-runtime-b2-consumer-adoption-v1.md) and [B2 evidence](../../Canon/evidence/2026-10-22-identity-b2-session-compatibility.md).
## Self-service first use (source proposal)

Default-off `IDENTITY_SELF_SERVICE_ENABLED` adds a central official-Clerk account completion page and `/v1/account`. Same-origin POST delegates to existing B1 provisioning; GET is a current authenticated account read, including the existing explicitly bounded bearer-only peer GET. No organisation or product grant is created. A verified primary email, active provider session/user, correct private descriptor, real transaction and current binding are required. Missing/expired/revoked/disabled authority fails closed.

The companion SG2 source is a separate owner/task/PR. See `Canon/runbooks/identity-self-service-development-v1.md` for exact flags, closed return routes, existing B1 inputs, missing lifecycle approval, real-browser acceptance and recovery/release gates. This source does not enable the deployed HEALTH_ONLY service or install a key/policy/migration.

### Explicit on-demand renewal candidate

`IDENTITY_BINDING_RENEWAL_ENABLED` defaults off and requires enabled self-service plus an explicit64-character `IDENTITY_RENEWAL_SCHEMA_DIGEST`. It opts the same-origin account POST into aggregate package1.24.0 with independently versioned API1.0.0's additive SQL002 contract. The official primary SDK requests a fresh token (`skipCache`) before the POST. Account reads and peer GETs remain read-only; an expired or revoked identity still fails those reads. A returning user completes the central native account/login step to request renewal, then the consumer independently verifies the account again.

The proposed policy permits ACTIVE near-expiry renewal within30s and separately enabled recovery of an expired ACTIVE binding for at most7 days. Each lease is bounded by fresh provider proof and the configured maximum300s. Revoked/disabled authority is never repaired. The operator must approve/install SQL002, register its digest, grant its narrow APIs and explicitly enable the policy before activation. This source changes none of those deployed settings.
