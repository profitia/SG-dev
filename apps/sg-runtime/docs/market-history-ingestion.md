# Canonical licensed Macrobond history ingestion — SG2 Development

Status: **SOURCE CANDIDATE / LOCAL SQL VALIDATED / LIVE INSTALLATION AND RELEASE PENDING FORMAL ACCEPTANCE**.
Task `SG2-MARKET-HISTORY-INGESTION-20261102`. Business authority: owner's 2 November2026 Permanent Macrobond & Market Data Access addendum. Repository authority `profitia/SG-dev/main`. No merge, live role/policy/schema change or deployment is performed by this candidate.

## Two receiving boundaries

1. `history-source.ts` is a dedicated receiver of the existing shared native Source engine. The original Macrobond adapter owns OAuth and history formatting; the receiver admits only token exchange and exact, single-selected-series `fetchentities`/`fetchseries` bodies. No Finder/search/OpenAI proxy is exposed. The existing Finder code and endpoint boundary are unchanged. The optional `enrichDisplay:false` argument leaves every existing caller's default behaviour unchanged while preventing display-search fallback in this closed history operation.
2. `history-ingestion.ts` admits validated data through the existing platform ingestion host, then calls the narrow `profitia_market_history.apply_history` operation in that SAME Source transaction. Its ordinary login has no canonical-table ACL, administrative flag, owner membership or privileged URL fallback. The existing read-only Market Data role independently reads back every value, source descriptor, row count and canonical observation digest.

All data are deliberately **SHARED_KNOWLEDGE**, owned by SG2 Market Data, authored by the authoritative database SERVICE. No customer actor, organisation, request ownership or user ID is invented. Source identity is resolved from the current service binding/grant, not a browser identifier. Product/HUMAN consumption remains subject to its existing, separately adopted E1 read boundary. This internal operation creates no public unauthenticated API.

## Generic operation and permanent business policy

The receiver accepts a validated canonical Macrobond series ID; production code contains no WTI/Brent special case. The closed server operation selects the series for each acquisition and rejects a substituted name, arbitrary endpoint/origin/body, uncertain exchange replay, malformed dates, duplicate/unsorted rows, mismatched arrays, all-null history or values not representable in the existing `numeric(24,8)` store. It never truncates a provider result or converts missing values to zero; negative WTI values remain legal.

Source transport, admission/settlement and persistence use explicit **UNMETERED** policies from accepted optional SQL024. Counters/audits remain; no per-download price, arbitrary business request/write count or additional owner approval is introduced. Cache/deduplication and controlled concurrency are technical controls. Existing provider licence/rate-limit/authentication decisions remain effective. Other existing metered policies and their counters are preserved.

Technical bounds: one refresh at a time per composition, two ordinary Source connections plus one existing read-only connection; 8MiB provider/command limit,100000 observations,20s provider deadline, existing15s Source transaction ceiling. Oversize inputs fail; they are not silently shortened. Different consumers/more parallelism require deliberate capacity tuning, not purchase of downloads. No automatic retry follows an uncertain Source result. The caller supplies a durable `runId`; reconstructing that same cycle cannot send an old settled/uncertain exchange again. A completed cycle returns its recorded receipt only while current canonical values and metadata still match its digest; newer values cannot masquerade as that prior version.

Security leases may expire/revoke independently of business UNMETERED. The install request pins an initial validity period of at most366days; renewal/credential rotation is ordinary controlled security maintenance, not a new per-download business decision. This is a permanent reusable operation, not a temporary two-series grant.

## Canonical storage and provenance

The three original tables remain canonical: `market_series`, `market_observations`, `market_hydration_state`. Upsert only changes/new observations; absent old dates are retained. Unchanged values keep their original update timestamp. Metadata changes preserve the previous series descriptor. `profitia_market_history.ingestions` records the immutable Source effect, run/series identity, settled provider call, response fingerprint, provider metadata, descriptor and canonical readback digest. `revisions` preserves the previous/new value, including nulls. Neither history table can be updated/deleted/truncated. Installation has a pinned SQL boundary digest, physical project/branch/database, exact ordinary login, original table owners, source SHA and formal approval digest.

`apply_history` requires the exact currently reserved Source effect/decision/resource/payload digest and a settled successful Macrobond API call from the same service. Direct ordinary SQL writes and fake effects deny. New financial data and the provenance/revision records commit atomically with Source completion/outcome; a persistence/audit failure rolls them back. A timeout is not interpreted as successful business completion.

## Automatic and explicit refresh in the existing runtime

The canonical hydration CLI now calls this same operation; the former unscoped writer path is not a fallback:

```text
run-market-data-hydration --runId=<durable-cycle-id> --seriesIds=<licensed-id>,<licensed-id>
run-market-data-hydration --runId=<durable-cycle-id> --dueBefore=<UTC-cutoff> --after=<cursor> --limit=100
```

The due mode selects only existing Macrobond benchmarks through current Source authority and returns a keyset cursor for the next bounded page. An already authorised automation/runner can invoke the same operation, persist `runId`/cursor and stop on failures. This candidate creates no independent daemon, scheduler, service or new paid resource. Successful refreshes update canonical freshness and become available to the unchanged Forecast reader. Refresh orchestration does not claim that a scheduled live job is already running.

Activation defaults OFF. `readMarketHistoryConfiguration` requires Development, the registered existing Render service, exact release SHA/configuration and exact Neon endpoints/database/ordinary roles. No host/SQL options, owner login, private database or alternative provider URL is accepted. Reuse the existing Macrobond credentials; provision only the new restricted DB-role secret through the approved secret mechanism.

## Formal installation and release

Live read-only inspection on2November found no `quota_mode` extension, no market-history namespace and no proposed runtime role. There is no existing limited writer to reuse: only administrative logins have writes on the three market tables. They are not used by this operation.

The shared Source producer already supports the required optional SQL024/native ports; its code/contracts stay unchanged. SG2 receives that accepted producer. A separate producer change/PR is therefore unnecessary. The consumer's two controlled SQL files and target registry are the proposed installation:

- `003-market-history.sql`: guarded definitions only; creates no login/grant/policy/receipt and performs no hydration.
- `003-market-history-install.sql`: explicitly approved operator entry, never startup/runtime. Use `psql --no-psqlrc --single-transaction` as dedicated `sg2_market_history_development_migrator`, never as the application or `neondb_owner`. It requires the exact source/boundary/shared SQL/approval digests, physical Source binding and validity period. A different existing installation aborts. Exact replay changes no policies/counters.
- Bootstrap rights require separate formal operator approval: permission to create the one ordinary role; SET ROLE to the existing NOLOGIN Source owner; the table owner grants only SELECT/INSERT/UPDATE on the three named market tables directly to that controlled owner; temporary schema-creation privilege. The migrator has no market-table ACL or grant options. The application receives only the enumerated narrow functions and schema usage, connection limit2 and no administrative flags/table ACL/membership. No provider credential is replaced or created.

If SQL024 is absent, the installer temporarily revokes/restores pre-existing Source binding statuses inside one atomic transaction, installs the exact accepted SQL024 and verifies old capacities/windows/counters remain intact as METERED. Source proof versions change, so schedule the approved maintenance window and pause new Source intake. Existing in-flight calls can fail closed during revalidation; do not blindly retry an uncertain exchange. Capture and review all affected bindings/configuration with the authorised operator before proceeding. A5s lock conflict aborts the entire transaction.

Before live execution, obtain exact owner acceptance of the published candidate and privileged installation plan. Pin the actual selected **release SHA** after the approved merge/release procedure; the Source binding's deployment ID must equal `srv-dapa3tid0e5s73f8bc5g:<actual-render-source-sha>`. A PR head and a resulting-main merge SHA are distinct. Verify resulting-main scope/CI before deploying; never install a binding for a candidate SHA and silently deploy another SHA. Forecast D0 PR853 remains an independent experimental source and is not merged by this release.

Save only reviewed additive environment keys, with no automatic deploy: `PROFITIA_MARKET_HISTORY_ENABLED`, `PROFITIA_MARKET_HISTORY_CONFIGURATION_VERSION`, `PROFITIA_MARKET_HISTORY_DATABASE_URL`. Preserve existing `MARKET_DATA_DATABASE_URL` read-only role and all existing provider/application settings. GitHub environment and provider release gates, retained LKG artifact/configuration, recoverable database/Source metadata backup, restore verification and actual runtime/Sentry acceptance remain live-release prerequisites; local tests do not satisfy them.

## Recovery

The separately approved bootstrap ACLs must be captured and restored by the operator if installation aborts; the installation transaction does not erase earlier bootstrap work. A failed install is one PostgreSQL transaction: schema, role, policy, Source status and counter changes roll back together. The local installer fixture deliberately tests a late Source-ID collision and confirms complete rollback. Exact successful replay does not reset counters or rewrite history.

For a live application regression: stop the new intake, set the new flag false, revoke only the new Source grants/binding and disable its login, then restore the verified retained SG2 artifact/configuration through the accepted release mechanism. Preserve all market data, append-only provenance, Source effects and previous receipts. Do not drop the namespace, undo global SQL024, reset a Neon branch or delete financial history as an automatic rollback. Data recovery, if needed, uses the verified pre-release backup/recorded revisions under a separately reviewed controlled recovery action; no arbitrary ordinary-role SQL update is exposed.

## Observability and evidence

Monitoring **EXTENDED** through the existing Sentry SDK/project/environment/release configuration. Recognisable `SOURCE_HISTORY_ACQUIRE`, `VALIDATE`, `PERSIST`, `READBACK`, `REFRESH_DUE` spans retain stage duration, bounded SUCCEEDED/DENIED/FAILED outcomes and technical reasons. Existing Source diagnostic phases remain the sole observer for provider transport failures. A distinct persistence incident is sanitised once; ordinary denials/data-unavailability do not create incident spam. No secret, raw financial data, private body, series value or extra identity/provider read is added to telemetry. Telemetry failure cannot repeat/block the business operation. Controlled real-SDK transport tests verify the new signals and privacy. Live event receipt is a separate acceptance step for the authorised release.

Meaningful validation includes real local PostgreSQL with ordinary roles and the unchanged generated reader, a synthetic HTTP provider, full12000-point history, revision/null preservation, idempotency/reconstructed cycles, mismatched/oversized/invalid source rejection, wrong runtime binding, fake effect/table writes, revocation before/in-flight, atomic failure, due refresh and explicit UNMETERED counters. The actual operator installer is tested as a restricted migrator with old metered-policy preservation, late-failure rollback and exact replay. Existing SG2 tests/receipt history remain protected; one additive receipt binds every current changed file and preserves every previous receipt byte. All new tests are reachable from the normal operation-context CI entry.

`SOURCE_READY`, `PERSISTENCE_READY`, `FORECAST_7D_READY` and `DEMO_READY` are reported independently in the task handoff. Until formal install/release and live readback, the first two are not live-ready and the fresh D0 remains blocked. Once available, use the unchanged experimental four-model D0,7calendar days,NOT_AVAILABLE bands/latest-vintage caveat and a new immutable package. No new Forecast mathematics or monthly horizons are introduced here.
