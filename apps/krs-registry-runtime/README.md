# KRS Registry Runtime 1.0.0

The versioned `@profitia/krs-registry-runtime/identity` entry exposes the existing
`resolveIdentity` and `revalidateAcceptedIdentity` validators for company evidence.
It issues no user identity or permission and does not authorize Financial calls.
Consumers retain their own E1 admission and explicit package-source acceptance.

Source-only ARCHITECTURE implementation. **ACTIVATION DEFERRED.** No Render service, production database, E1 policy installation, automatic scheduler or SRM provider switch is part of this package. The executable server exposes minimal health and returns unavailable for protected operations until independently accepted producer/storage bindings exist. Offline fixture success does not establish live E1 acceptance.

The runtime owns public-company registry facts and discovery. Organisation supplier records, identity authority, Request/Work/Source permission/cost/receipt ledgers and MGBI Financial remain with their existing owners. Financial acquisition code is absent. A name candidate has `financiallyVerified:false`; selected KRS/NIP evidence is still subject to current consumer E1 and company/document reconciliation in Stage03.

## Build, verification and start

From the monorepo root, with Node24.15.0 and npm's install-links option:

```sh
npm --prefix packages/krs-registry-contracts ci --ignore-scripts --no-audit --no-fund
npm --prefix packages/krs-registry-contracts run typecheck
npm --prefix packages/krs-registry-contracts run build
npm --prefix packages/krs-registry-contracts test
npm --prefix apps/krs-registry-runtime ci --install-links --ignore-scripts --no-audit --no-fund
npm --prefix apps/krs-registry-runtime run lint
npm --prefix apps/krs-registry-runtime run typecheck
npm --prefix apps/krs-registry-runtime run build
npm --prefix apps/krs-registry-runtime test
npm --prefix apps/krs-registry-runtime run test:postgres
npm --prefix apps/krs-registry-runtime run artifact
npm --prefix apps/krs-registry-runtime start
```

`test:postgres` creates a disposable local PostgreSQL cluster, restrictive synthetic roles and `krs_registry_test`, runs real integration/performance tests, stops it and removes its own temporary directory even on failure. It also accepts `KRS_FIXTURE_OWNER_URL` only for that exact database/owner on localhost without URL options. CI supplies its isolated PostgreSQL16 service. No PMOS or product store is a test catalog. The test owner is a test provisioning principal, never a runtime credential.

Start binds `0.0.0.0:${PORT:-3501}`. `/health` returns only `{"status":"ok"}`. Termination closes the HTTP listener. Boot creates no database pool, ingestion, timer or scheduled acquisition. Enabling an activation flag or supplying a catalog database URL fails startup until source adoption of an accepted binding is explicitly implemented. This preserves BUILD COMPLETE / ACTIVATION DEFERRED without a usable configuration bypass.

`dist/krs-registry-runtime.zip` contains the compiled runtime, production dependency closure (including the accepted platform source/migration files), migration sources and a deterministic release manifest. Unpack and run `node runtime/dist/main.js` with Node24. The package needs no source checkout or compiler to start. ZIP timestamps/order/modes are fixed; the manifest binds exact Git SHA, source/lock/contract/migration digests and every file. Performance/proof timestamps stay outside the reproducible binary. Build twice and compare `dist/artifact-proof.json`. This is a retained source artifact, not deployed LKG evidence.

## API and catalog

`GET /v1/companies/search?q=...&limit=1..50&cursor=...`, `GET /v1/companies/:10-digit-krs`, and `POST /v1/identity/resolve` are protected operations. Resolve accepts exactly `selectedKrs`, `nip`, `regon`, using explicit nulls. Body4KiB, query200characters, duplicate query keys and identity/authority overrides denied. Only health is anonymous. Missing read producer =>503; offline access revocation/audit failure =>403 with no payload or query echo. `RegistryReadBoundary` is an injected producer adapter seam, not an installed operation or E1 replacement. The shipped main never installs an offline boundary.

Schema `krs_registry`: metadata/generation, companies, immutable snapshots, per-register/extract current pointers, historical identifiers, normalized names, daily checkpoints and revision-qualified durable items. Identifiers are not globally unique. DML writes run inside the injected producer's admitted transaction; E1 owns the durable effect reference and audit. Read/ingest/migrator are separate; the read role cannot mutate/DDL, ingestion cannot modify/delete snapshots, and neither inherits migrator/owner privileges. Migration/down are source only; down is destructive and tested solely in the disposable fixture. A future shared store needs separate physical/storage/receipt acceptance and deployment authority.

Name indexing uses B-tree `text_pattern_ops` and GIN `pg_trgm`; see [PostgreSQL16 index documentation](https://www.postgresql.org/docs/16/pgtrgm.html). Ł/ł, combining diacritics and whitespace normalize for search; displayed legal names remain intact. Exact, normalized, prefix and fragment matches have stable ranking/KRS ties; historical aliases remain discoverable and deduplicate before pagination. Prefix starts at1character, fragment at3. Patterns are escaped and parameterized. Cursors bind query/limit and catalog generation in a repeatable-read transaction; changed generation requires a fresh search. No request/query/user data is stored in the global catalog.

Coverage is always PROGRESSIVE with observed count, last retrieval, unknown total/backlog when unavailable. A zero match is NOT_IN_CATALOG, never a national nonexistence assertion. There is no universal NIP mapper: only current accepted local mappings; ambiguity remains blocked. MF/GUS integration and a complete/free national catalog are not claimed.

## Official client, provenance and identity

The four GET operations in the accepted official [Open API KRS documentation](https://prs.ms.gov.pl/krs/openApi) have a fixed HTTPS origin, closed KRS/register/calendar/hour parameters, no credentials/redirect destinations,20s deadline,4MiB maximum, one in-flight call, finite per-client budget and bounded circuit breaker. Source dispatch uses existing `createExternalCallHost` native credentialMode NONE; absent real Source/settlement denies. No direct fetch fallback exists. Tests use explicit offline transport fixtures; these do not create accepted receipts.

Current and full extracts use their distinct header/scalar/history structures. `RejP`/`RejS` headers must agree with P/S request. Full identifiers retain wrapper intervals and full names/legal forms/addresses/header entries retain history; absent/ambiguous open values stay unknown. Unsupported forms are explicit partial warnings. Missing fields or unknown `stanPozycji` never imply deregistration. Personal representation fields and raw company JSON are excluded from shared snapshots. Dates stay dates; unzoned generation clocks are not UTC.

Raw digest binds bytes; content digest binds allowlisted facts; sourceVersion includes provider/register/extract/KRS/official entry/as-of/content/normalizer. Retrieval/generated clocks do not churn business versions. Address version conservatively normalizes case/Unicode/space and excludes provider/evidence clocks. No address merge or geocoding is performed here.

Closed `profitia.krs-company-identity/1.0.0` rejects unknown nested keys, duplicate JSON keys, forged source/digests, unsupported versions, invalid identifiers, selected-KRS substitution, stale/future/superseded evidence. VERIFIED has retrieval-based300s expiry and30s future skew; a cache check cannot renew it. Receiver revalidation retrieves the current accepted referenced snapshot and compares identifiers/source/hash; a hash is not authority. Names and predecessor candidates grant no financial eligibility. Existing SRM continuity is not copied.

REGON9 and REGON14 use applicable checksums and preserve their observed lengths. A fourteen-digit source value ending00000 may be a padded legal-unit display rather than a valid local-unit REGON; it remains INVALID_REGON under the accepted wire policy, with General retained. No blind truncation. [GUS defines legal-unit9 and local-unit14 separately](https://stat.gov.pl/metainformacje/slownik-pojec/pojecia-stosowane-w-statystyce-publicznej/2963%2Cpojecie.html); [GUS Lublin documents a nine-digit value padded00000 in its own form](https://lublin.stat.gov.pl/specjalizacja-urzedu/wyszukiwarka-osob-do-kontaktu/). Accepting that representation in KRS identity needs an explicit relation/policy decision; the observed ORLEN-shaped padded example is a denial fixture, not silently legalized.

## Disabled synchronization

`npm run sync -- validate-plan /path/to/finite-plan.json` validates only a source plan. Required keys: approvalRef, explicit1..31 closed Warsaw days, maximumItems1..10000, maximumCalls1..1000, maximumMilliseconds1..3600000. Validation is not execution or legal approval. There is no shipped command that activates a worker.

The injected synchronizer implements daily acquisition, bulletin padding/deduplication, P/S resolution, atomic queue/checkpoint publication, finite lease claims with SKIP LOCKED, expiry/recovery, audit/transaction rollback, same-intent conflict, replay, late revised lists and explicit approved same-list revisit reference. Its source/publication bindings and enabled state must be supplied server-side. COMPLETE requires every current-revision item DONE. Failed items require explicit bounded replay. UNCERTAIN is excluded: reconcile existing E1 outcome first; no local raw retry/reset command. Prior revisions/snapshots/aliases remain. Hourly client exists, but hourly synchronization is deliberately not selected until inclusivity/DST/provider semantics are accepted.

See [producer dependencies](docs/producer-dependencies.md), [Stage03 handoff](docs/stage03-handoff.md) and [task evidence](docs/task02-evidence.json). Activation remains conditional on those independent gates.

## NIP mapping producer 1.2.0

The optional GUS BIR1.2 source maps an explicitly requested NIP to a legal-unit
REGON and only register138/REJESTR PRZEDSIĘBIORCÓW to a candidate KRS. It is not a
national catalog or browser search. GUS requests require the additive SOAP policy
SQL021, their own ordinary Source binding/budget and server-only key/session.
Every HTTP session/search/report/logout operation is admitted by the existing
Source host. The current pilot remains one instance. Its mapper receives the SQL021 shared
rate gate, serialized across processes with conservative3/s,120/min,6000/h slots.
A slot is scheduling only and never substitutes for current Source admission.
No grants or budgets are installed by this package.

After confirmed CEIDG absence, a consumer may use the combined3000ms mapper/KRS
deadline. Missing mappings and explicit provider failures may select the bounded,
visible MGBI Registry fallback under current authority/budget. Identity ambiguity,
conflicts and E1 denials never select a paid provider. Financial remains MGBI.
Native on-demand KRS acquisition requires process-owned evidence of the settled
GUS mapping and validates current KRS/NIP before publishing the existing catalog.
No arbitrary KRS allowlist removal, numeric enumeration or private supplier
assignment is introduced. Source code and offline tests do not prove activation.

### Bounded extract transport profile (1.6.3)

`createNativeNipRegistrySource` and `createAdmittedKrsSource` accept the optional server-owned `transportProfile: "EXTRACTS_ONLY"`. It declares only the existing CURRENT and FULL extract paths, matching an already bounded native Source policy. The default retains its existing four paths. This option issues no permission and changes no SQL policy: descriptor equality, admission, settlement, company evidence and audit remain mandatory. Consumers must separately adopt the version and verify their actual installed policy.
