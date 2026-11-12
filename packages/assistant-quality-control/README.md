# Assistant Quality Control — Stage 1 source

Producer: Architecture Platform / ARCHITECTURE. Product host: SG2. Accepted
business and execution scope is the single
[Project Design Record](../../Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md),
specification revision 5 and commissioned Stage 1 against revision 8.

This source checkpoint is **partial and inactive**. No worker, cloud executor,
application integration, independent OS execution, live release or Stage 1
acceptance is claimed. It does not start nightly QA or Stage 2.

## Implemented foundation

- `manifest.mjs`: role-specific Ed25519 verification of the owner mandate and
  independent synthetic export; exact base, Development service, C1–C3 paths,
  two attempts, 30-minute attempts, $5/$50 bounds and Stage 1 scope.
- `controller.mjs`: finite repair lifecycle and durable-intent ports. A lost
  dispatch response remains unresolved until the same nonce is reconciled.
  Confirmed cancellation and lack of effects are required before clearing it.
  Existing releases retain free safety monitoring when paid authority expires.
- `store.mjs` and `migrations/001-control.sql`: transactional metadata, repository
  lease, persistent attempts, class suspension, release rate and recovery in
  the existing SG2 private product store. Execute-only ordinary runtime role,
  HMAC commands, exact installation binding and FORCE RLS; no transcript read.
- `budget.mjs` and
  [`005-assistant-quality-usage.sql`](../../apps/package-limits/migrations/005-assistant-quality-usage.sql):
  native Package & Limits authority. Atomic $50 pilot / $5 incident holds;
  $1 of each incident is reserved for assistant acceptance, leaving $4 for the
  executor across both attempts. Existing product reservations, entitlement and
  HUMAN identity remain required for controlled assistant interactions. Unknown
  dispatched cost retains its upper bound, including after incident closure.
  The one 336-hour clock starts before the first possible paid dispatch and
  is not renewed by an attempt, incident, restart or later stage.
- `openai-broker.mjs`: root-owned loopback Responses transport. It keeps the
  provider key outside the agent, counts inputs, reserves a conservative bound
  and records dispatch before the only inference POST. No automatic paid retry,
  hosted tools, remote conversation, project file or arbitrary provider URL.
- `source-policy.mjs`: static TypeScript checks on the admitted function bodies,
  preserving all outside bytes and preventing imported implementation reflection.
  This supplements the required OS isolation; it is not a JavaScript sandbox.
- `verify.mjs`: inert canonical regression data and parent-owned comparison
  against an independently signed, frozen reference pack. It enforces red/green,
  >=200 cases, class/language and critical coverage, three critical repetitions,
  correctness/refusal gates and the required effect when >=10 baseline defects
  exist. It does not accept the agent's tests or PASS statement as authority.

## Local verification

Install public dependencies with `npm ci --ignore-scripts`, then `npm test`.
Node.js 24 and locally installed PostgreSQL (`pg_config`, `initdb`, `pg_ctl`)
are required. Database tests create and remove their own loopback-only temporary
clusters. They accept no database URL and cannot select an existing Neon store.
Broker tests use a local server and fake upstream fetch, not an OpenAI key.

The reference cases in `verify.test.mjs` test the verifier's refusal conditions
through a fake execution port. They are not a calibrated product holdout or
proof that an actual SpendGuru answer improved. Native database tests do exercise
the actual SQL, concurrency, leases, RLS, cost holds and settlement transitions.

## Installation boundary

Both migrations are source plans. No installation row or credential is seeded.
The existing database owners must separately install the exact reviewed SQL and
ordinary roles through the authorised bootstrap. Replace the literal
`__QUALITY_CONTROL_SCHEMA_DIGEST__` / `__QUALITY_USAGE_SCHEMA_DIGEST__` with the
SHA-256 of the original corresponding source, before substitution.

The controller database is the existing SG2 private product store
`autumn-waterfall-65938876 / br-dry-hall-b294222f / neondb`; native money
authority remains `lingering-thunder-05075810 / br-green-hall-b9s837k0 / neondb`.
These metadata bindings are not E1, source, account or QA-purpose grants.
New resources, credentials, data/service rights and the limited automation
mandate remain owner-controlled. No private conversation or signing/provider
key belongs in Git, agent inputs, artifacts or telemetry.

The deployment entrypoint, real GitHub/Render adapters, isolated runner, trusted
publisher, protected source-continuity adoption, product capture/guards and
operational retention/restore verification remain to be completed before any
installation, paid run or live acceptance. Operational metadata purge currently
only handles reconciled terminal incidents; expiry/reconciliation of retained
pending intents is a remaining retention gate, not an active 90-day guarantee.
