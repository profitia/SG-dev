# Assistant Quality Control — Stage 1 source

Producer: Architecture Platform / ARCHITECTURE. Product host: SG2. Accepted
business and execution scope is the single
[Project Design Record](../../Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md),
specification revision 5 and commissioned Stage 1 against revision 8.

Stage1 technical implementation is **partial**. The monitoring worker is live
on Development with both native stores connected and disabled, as recorded in
the Project Design Record. Host integration, qualified execution and independent
publishing remain under implementation; neither project TECHNICAL_READY nor
Stage1 acceptance is claimed. Paid repairs, promotion and the pilot clock remain
off. This does not start nightly QA or Stage2.

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
- `executor.mjs` and `provenance.mjs`: prepared Linux launcher, pinned CLI,
  separate UID, empty capabilities/no_new_privs, cgroup, kernel egress fence and
  upstream Codex Action socket protection. The public projection reads exact
  committed SG-dev blobs; payloads, local .env, private packages and holdout are
  excluded. Actual file collection rejects extra changes, links and executable
  regression files. **Linux execution is not yet qualified**: a separate signed
  keyless tool-loop/isolation/cancellation receipt is required before paid work.

The workflow at `.github/workflows/assistant-quality-repair.yml` runs keyless
source tests, including isolated PostgreSQL. Its separate main-only
`keyless-qualify` mode prepares a real CLI/tool-loop, filesystem, kernel egress,
Unix service and process-tree cancellation rehearsal on a fresh hosted VM.
It uses synthetic files, an in-memory fake cost port and a fake upstream with
no network implementation. Ephemeral test signatures reach the actual launcher;
they are discarded and never installed as production trust. The published result
contains unsigned observations only. Independent run/artifact verification and
an installed verifier are still needed to attest a successful qualification.
No qualification PASS is claimed until that actual workflow succeeds.

Commands extend the built-in workspace profile with root/tmp denial and minimal
runtime reads. Cancellation reports a stop proof only after the entire cgroup
is empty. The workflow exposes no repair, promotion or deployment mode, secret
or Environment and does not change the existing protected package controller.

QA contracts are additive source modules under `assistant-context-contracts/src`.
Existing private package metadata, export surface and context protocol 2.2.0 stay
byte-identical. The QA evidence envelope preserves up to 64 original scopes
across included history; this does not raise Gateway's four-source-per-turn cap.

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

The authorised Development bootstrap and its exact installation evidence are
recorded in the Project Design Record and PR1104. Source migrations seed no
installation row or credential. Ordinary roles and installed disabled bindings
were provisioned separately by the authorised owners. Replace the literal
`__QUALITY_CONTROL_SCHEMA_DIGEST__` / `__QUALITY_USAGE_SCHEMA_DIGEST__` with the
SHA-256 of the original corresponding source, before substitution.

The controller database is the existing SG2 private product store
`autumn-waterfall-65938876 / br-dry-hall-b294222f / neondb`; native money
authority remains `lingering-thunder-05075810 / br-green-hall-b9s837k0 / neondb`.
These metadata bindings are not E1, source, account or QA-purpose grants.
New resources, credentials, data/service rights and the limited automation
mandate remain owner-controlled. No private conversation or signing/provider
key belongs in Git, agent inputs, artifacts or telemetry.

The monitoring entrypoint and bounded GitHub/Render clients exist. The GitHub
client can dispatch exact-main qualification once and reconcile a lost reply or
request cancellation without asserting that an executor stopped. Deployment
job composition, Linux qualification, independent publisher credentials and
coordination, accepted product integration, and live recovery verification
remain required before paid work or full technical/Stage1 acceptance. Operational metadata purge currently
only handles reconciled terminal incidents; expiry/reconciliation of retained
pending intents is a remaining retention gate, not an active 90-day guarantee.

## Bounded operational monitoring

The optional worker clients use the existing SpendGuru PostHog project329829
and Sentry sg-porr project4512356940120144, with the approved Development client
configuration. Set AQC_POSTHOG_PROJECT_TOKEN, AQC_POSTHOG_HOST and AQC_SENTRY_DSN
in the worker's private environment; no actual value belongs in Git.

Only source SHA, time, fixed service binding, disabled-store state, closed error
codes and disabled payment/promotion/pilot switches are exported. PostHog
receives a technical heartbeat with person-profile processing and GeoIP off;
Sentry receives one startup readiness event and bounded failure events. There
is no conversation/QA payload, user identifier, raw exception or SQL export.
The Sentry client has no global instrumentation, integrations, tracing, profiling,
logs or automatic AI/MCP/request/database content collection; beforeSend rebuilds
only internally registered primitive metadata and discards SDK enrichments.
Missing/failed telemetry never relaxes the native safety checks or blocks work.

The clients are configured once per process, have bounded queues and requests,
and shutdown is bounded to one second. A configured SDK is not delivery proof:
actual Development ingestion must be checked after the new source is deployed.
This telemetry does not perform regular quality evaluation or start Stage2.

References: https://posthog.com/docs/libraries/node and
https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/.
