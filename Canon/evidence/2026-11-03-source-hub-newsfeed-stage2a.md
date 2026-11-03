# Source Hub / Newsfeed Stage 2A — implementation candidate and acceptance requirements

Owner Architecture Platform; task `ARCHITECTURE-SOURCE-HUB-NEWSFEED-STAGE2A-20261103`; Development, code/offline only. Stage1B authority `9bce78138e1396765ce67b9b1b29841efdb017f2`. The candidate was refreshed without conflicts onto `36b07672f572ff7c1c81117e3f3b01fa93ec1e65`, preserving the parallel SG2 analytics acceptance. PMOS registration, actual host task identity and all applicable preflights precede implementation. This source document does not substitute for exact PR/main CI or the final independently verified PMOS/PHR closeout.

## Authorised implementation and scope amendment

The owner's Stage2A request explicitly authorises two executable APIs, controlled extraction, contracts/migrations/offline tests, CI and main acceptance; it prohibits real Neon/Render provisioning, migration and deployment. The attached addendum adds Brave and TE Calendar/Indicators/Forecasts to the mandatory implementation. GDELT and UI/scheduler/AI/Insights are excluded.

After reviewing the unapplied API_PATH proposal the owner explicitly approved: “Zatwierdzam ten wąski wyjątek i dalszą realizację”. The approval permits the separately versioned shared SDK extension and only the SG2/SRM contract acceptance records and their tests needed for it. Business logic, UI, grants, infrastructure and deployment of SG2/SRM remain excluded. Those consumer integrations require their own project registrations/routing and evidence. The producer's extended exact targets passed Architecture routing/PMOS preflight; the original PMOS request/registration is retained unchanged with this explicit scope supplement.

## Implemented result

- Source Hub1.0.0: real Node HTTP entrypoint, explicit Development configuration, health/live/ready, peer proof with fresh canonical E1, provider catalogue, versioned acquisition, bounded single attempts, normalized family payloads/errors, licensed provenance and private idempotency/usage persistence.
- Newsfeed Runtime1.0.0: independent HTTP API/database, own observations create/list/read/versioned update/pause/resume/delete, manual Hub discovery and history/publication linkage. Owner, actor, app/org/env remain distinct and server derived. No Supplier ID or SRM view is required.
- NewsAPI: one unchanged implementation apart from producer/type import paths, physically owned by Hub. Original imports in Newsfeed are thin re-exports. Existing31 tests remain byte-preserved. NewsDiscovery0.1.0 public semantics/types remain compatible.
- Brave Web Search and entitled news cluster, TE Calendar, TE Indicators and TE External Forecasts: concrete documented adapter paths, separate payloads, explicit filter support and honest unknown metadata. Calendar consensus/vendor forecasts, previous/revised values and time precision are not conflated; forecasts are not Forecast Core output.
- Two actual Node main processes have a test that starts them with all outbound networking prohibited. Full business flow tests use real local HTTP servers and ordinary PostgreSQL logins with canonical E1/Source SQL; only identity-provider and external-provider responses are synthetic.

Public versions: Source Hub contract1.0.0, Newsfeed observation API1.0.0, preserved NewsDiscovery0.1.0, Platform SDK1.33.0, API_PATH1.0.0, existing peer-operation1.0.0/private-operation-host1.11.0. Exact producer digests/migration checksums and consumer scope are in [Newsfeed operation adoption](../../apps/newsfeed-runtime/operation-integration.json).

The Stage1B canonical family registry remains its accepted design snapshot, with five separate families and no universal payload. This explicitly authorised Stage2A provides concrete runtime contracts for four operational families. Market Observations remains future; no endpoint pretends to implement it. Runtime catalogue/state and the addendum define this implementation scope without rewriting historical acceptance evidence.

## Source protocol and compatibility

Existing STORAGE_PATH cannot represent encoded TE names/lists. SDK1.33.0 adds opt-in API_PATH GET/NONE/HTTPS, separate SQL028 digest and immutable admitted policy. It preserves existing default transport semantics and SQL001/008/009/012 bytes. SQL028 targets the new disabled Hub baseline and refuses active Source/PUBLIC_WEB/GUS SOAP installations; it is not applied to SG2/SRM databases. No budget, grant, counter or identity is created by the extension. Canonical Source/external host remains the sole network sender.

Compatibility rollback is atomic: restore the complete reviewed Stage2A source bundle, SDK/consumer adoption and original Newsfeed compatibility paths together under normal main gates. Do not revert only a digest or leave a consumer on an unaccepted SDK. Before removing a shim later, identify all remaining0.1.0 consumers and accept their public1.0.0 adoption. No deprecation/removal occurs in this stage. Future first-deployment rollback stops the new services and revokes their new admissions; there is no previous Hub server to fabricate as last known good.

## Data, security and monitoring

Both capability migrations are versioned and transactional, with physical environment/app binding, composite tenant/user constraints, indexes, idempotent writes and forced RLS. Ordinary runtime/source runtime/migrator/NOLOGIN owners are separate. Private observations, intent/attribution/usage and licensed records are separated. Raw search criteria are retained only in the private Newsfeed observation; Hub idempotency needs a digest, not another raw query copy. Retained results require explicit licence/consumer/expiry and are withheld after revocation/expiry. No paid automatic retry, global private cache or new commercial meter exists.

Canonical private-operation-host revalidates current official Clerk session/account, identity binding, membership, product/operation and scope. Business errors use a transaction savepoint and remain distinguishable while failed changes roll back; they never bypass E1. Provider work occurs outside a private SQL transaction, with fresh E1 on persistence/disclosure. A revoked operation may leave PENDING/UNCERTAIN evidence for owner reconciliation; a service credential cannot force a write as the human.

Monitoring status **EXTENDED**: redacted JSON/stdout, HTTP health and existing canonical Root audit. Provider contents, queries, SQL, identities and credentials are excluded from application logs. No competing telemetry system or new Sentry/PostHog project/configuration was introduced.

## Verification and final acceptance

Required: original31 NewsAPI tests; all new family/contract tests; real HTTP and ordinary-role SQL, migration repeat/role separation, user/org/app/env isolation, M2M forgery, unsupported filters, licence/Source revocation, revocation during I/O, idempotency and failure/no-retry tests; actual entrypoint smoke; both builds/typechecks; SDK type/transport regressions; SG2/SRM consumer acceptance and their required isolated CI. Historical Stage1B invariants remain tested at the accepted SHA and current extraction parity is checked separately.

PR HEAD, actual main result SHA and exact successful run references are final acceptance evidence, recorded in the PR/CI and PMOS/PHR closeout. Never mark this candidate accepted from a local test or HTTP200 alone. A new trusted-CI exception, if required, must be a separately owner-approved exact candidate/blob review rather than a broad path allowance.

Provider state: **IMPLEMENTED_OFFLINE_VERIFIED** for all five mandatory provider APIs. No live provider calls were made; supplied key files were not loaded. Optional TE News/Markets are UNAVAILABLE_OR_NOT_ENTITLED and unimplemented, GDELT/Market Observations NOT_IMPLEMENTED. [Exact scope and evidence classification](../../apps/platform-source-hub/docs/live-evidence.json), [capabilities](../../apps/platform-source-hub/docs/provider-capabilities.pl.md).

Real E1/Source/licence/budget activation is **NOT_ACTIVATED**. Product Neon migration, Render resource/configuration changes and deployment are **NOT_PERFORMED**. Staging/Production remain inactive. The executable package is intended for owner-provisioned Development after controlled main acceptance; this stage does not start Stage2B.

Complete owner checklist, exact roles/commands/env, two Render service settings, admission inputs, readiness tests and rollback: [manual Stage2B activation](../../apps/platform-source-hub/docs/stage2b-activation.pl.md), also linked from the canonical provisioning runbook. Final Stage2A completion additionally requires successful exact main readback and PMOS/PHR closeout; neither is asserted prematurely by this candidate document.
