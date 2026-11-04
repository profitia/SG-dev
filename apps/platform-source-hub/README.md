# Platform Source Hub

Executable HTTP backend, Stage 2A, Development. Node24.15.0. Newsfeed is the first separately authorised consumer; future consumers must adopt the public contract, their E1 and their licence/Source scope. No frontend, scheduler, worker, identity service or billing engine is created here.

```sh
npm --prefix apps/platform-source-hub ci --include=dev --install-links --ignore-scripts
npm --prefix apps/platform-source-hub run build
npm --prefix apps/platform-source-hub start
```

Run from the **whole repository** with the owner-provided configuration. `start` runs `src/main.mjs`, listens on `0.0.0.0:$PORT`, handles SIGTERM/SIGINT and performs no migration. `/health` and `/live` report the process; `/ready` verifies ordinary database/installation/E1 bindings and Source descriptors. Missing authority is a refusal, not a fixture-backed successful service.

Public metadata: `GET /v1/capabilities`. Licensed operation: `POST /v1/acquire`, `application/json`, valid `Idempotency-Key` and the existing SDK peer-operation proof over the exact bearer/body/route. The body is `{context:{organisationId,expectedUserId},request:HubRequest}`. Context assertions must originate from the consumer's verified server-side E1 context; Hub independently checks the same human and organisation. A service credential cannot grant data access.

Public contract: [`@profitia/platform-source-hub-contracts`1.0.0](../../packages/platform-source-hub-contracts/README.md). Five separate families remain distinct. Mandatory implementations: NewsAPI News Discovery, Brave Web Search/news cluster where entitled, TE Economic Calendar, TE Indicators and TE External Forecasts. Market Observations and GDELT are not implemented; TE News is included in the current activation candidate; optional TE Markets is disabled by default and has no verified live entitlement. [Capabilities and semantics](docs/provider-capabilities.pl.md). Provider status is **IMPLEMENTED_OFFLINE_VERIFIED**, with no claim of live plan/filter verification.

Existing NewsDiscovery0.1.0 implementation lives only in `src/providers/newsapi*.mjs`. Previous Newsfeed imports are thin re-exports. Original31 NewsAPI tests and public types remain compatible. Publisher country, headline edition and event geography are distinct; no invented event-location or Polish article-language support.

Acquisition uses canonical E1/private-operation-host and Source/external-call/native transport, including independently admitted API_PATH for encoded TE selectors. One provider attempt, no automatic retry, fixed HTTPS origins, no redirects, bounded body/deadline, finite Source budgets. Provider credentials remain in headers. The private acquisition ledger holds intent/request digests and attribution; licensed payloads have explicit consumer/licence/retention provenance. There is no global cross-user result cache or separate commercial quota engine.

Migrations, roles, env, exact Render settings, manual activation, E1/Source admission, limited live acceptance and rollback: [owner guide](docs/stage2b-activation.pl.md). No real infrastructure was modified by Stage 2A. Staging/Production startup is disabled.

Offline validation requires an **isolated loopback PostgreSQL16+ cluster** and an explicit `SOURCE_HUB_TEST_ADMIN_URL` pointing to its `postgres` database. Tests create/drop only generated `stage2a_test_*` databases there. They refuse remote hosts. Run `npm --prefix apps/platform-source-hub test` and the Newsfeed tests after installing both applications' public dependencies. Synthetic Clerk-interface/provider fixtures exist only under test; executable services contain no fixture/auth bypass flag. A separate smoke test starts both actual Node entrypoints with all outbound networking blocked.

Monitoring extends JSON/stdout and health diagnostics. Request IDs, operation/outcome/status/duration/count are allowed; credentials, query text, SQL, identities and provider content are excluded. Root audit stays in the canonical control plane. No new Sentry/PostHog resource or competing telemetry pipeline is introduced.

## Development activation candidate — 2026-11-04

The accepted Stage2A and its `docs/live-evidence.json` remain historical evidence. The new task extends the existing adapter with TE News and optional category-based market forecasts. Public Hub API/family envelopes remain backward-compatible1.0.0 and legacy NewsDiscovery remains0.1.0. The shared platform SDK, SG2/SRM receipts, Forecast and Benchmark sources are unchanged.

TE News uses `family=news-discovery`, `provider=trading-economics`, `operation=search`. For example, `criteria={newsType:"markets",text:"oil",limit:20}` uses a native markets selector and a local substring filter over the bounded returned sample. Country/category/date routes are separate from the type selector. Rejected combinations are explicit in the executable catalogue. No arbitrary client URL is accepted.

Optional market forecasts use `family=external-forecasts` with `criteria={forecastType:"markets",marketCategory:"commodity",symbols:["CO1:COM"],limit:20}`. Category is native; symbols are local. The licence must explicitly set `allow_market_forecasts=true`, and the independently admitted native policy must include the five exact category paths produced by `sourceDefinition("trading-economics","external-forecasts",{includeMarketForecasts:true})`. The ordinary definition omits those paths. No implicit Market Data/Forecast adoption or live plan entitlement follows.

The additive002 migration records its own digest and adds the licence flag with defaultfalse. The accepted001 bytes/digest remain unchanged. `/ready` also verifies the002 digest through a SELECT-only configuration policy; runtime cannot apply or edit migrations. Run the existing `db:migrate` command as the separate migrator; repeat execution verifies both digests. Deployment rollback preserves the additive database migration.

Brave/TE `coverage` distinguishes the provider-returned sample, local filtering, local truncation and unknown upstream completeness. Brave operator semantics remain explicitly experimental/unverified. Telemetry reuses JSON/stdout, adding provider/family/count/cache-hit and verified successful-attempt counts; it emits no query, identity or provider body and never adds Clerk/E1 calls. Monitoring: EXTENDED; Sentry/PostHog have no newly provisioned binding.

[One consolidated owner action list](docs/development-owner-actions.pl.md) identifies the missing Development resources, roles, credentials and formal admissions. Until completed, no product migration, deployment or paid provider call is allowed by the runtime gates. The existing legacy catalogue of31 NewsAPI cases is retained.

Calendar and Procurement Insights governance proposals remain unmerged (#864, #847/#848/#877); neither is claimed as a deployed consumer. `test/consumer-handoff.test.mjs` verifies the shared API with synthetic data, preserving calendar fields and source lineage, and demonstrates UNCONFIRMED candidates matching the proposed OilMarketEvidence input from PR867 (blob11f85f3e2df66db8d2db4a1d13b506933bcecf2b). It does not adopt that draft, mint independent verification, build a ReportEvidenceBundle/Composer or publish a report. Actual live data handoff remains a blocked acceptance criterion.
