# Platform Source Hub

Executable HTTP backend, Stage 2A, Development. Node24.15.0. Newsfeed is the first separately authorised consumer; future consumers must adopt the public contract, their E1 and their licence/Source scope. No frontend, scheduler, worker, identity service or billing engine is created here.

```sh
npm --prefix apps/platform-source-hub ci --include=dev --install-links --ignore-scripts
npm --prefix apps/platform-source-hub run build
npm --prefix apps/platform-source-hub start
```

Run from the **whole repository** with the owner-provided configuration. `start` runs `src/main.mjs`, listens on `0.0.0.0:$PORT`, handles SIGTERM/SIGINT and performs no migration. `/health` and `/live` report the process; `/ready` verifies ordinary database/installation/E1 bindings and Source descriptors. Missing authority is a refusal, not a fixture-backed successful service.

Public metadata: `GET /v1/capabilities`. Licensed operation: `POST /v1/acquire`, `application/json`, valid `Idempotency-Key` and the existing SDK peer-operation proof over the exact bearer/body/route. The body is `{context:{organisationId,expectedUserId},request:HubRequest}`. Context assertions must originate from the consumer's verified server-side E1 context; Hub independently checks the same human and organisation. A service credential cannot grant data access.

Public contract: [`@profitia/platform-source-hub-contracts`1.0.0](../../packages/platform-source-hub-contracts/README.md). Five separate families remain distinct. Mandatory implementations: NewsAPI News Discovery, Brave Web Search/news cluster where entitled, TE Economic Calendar, TE Indicators and TE External Forecasts. Market Observations and GDELT are not implemented; optional TE News/Markets have no verified entitlement. [Capabilities and semantics](docs/provider-capabilities.pl.md). Provider status is **IMPLEMENTED_OFFLINE_VERIFIED**, with no claim of live plan/filter verification.

Existing NewsDiscovery0.1.0 implementation lives only in `src/providers/newsapi*.mjs`. Previous Newsfeed imports are thin re-exports. Original31 NewsAPI tests and public types remain compatible. Publisher country, headline edition and event geography are distinct; no invented event-location or Polish article-language support.

Acquisition uses canonical E1/private-operation-host and Source/external-call/native transport, including independently admitted API_PATH for encoded TE selectors. One provider attempt, no automatic retry, fixed HTTPS origins, no redirects, bounded body/deadline, finite Source budgets. Provider credentials remain in headers. The private acquisition ledger holds intent/request digests and attribution; licensed payloads have explicit consumer/licence/retention provenance. There is no global cross-user result cache or separate commercial quota engine.

Migrations, roles, env, exact Render settings, manual activation, E1/Source admission, limited live acceptance and rollback: [owner guide](docs/stage2b-activation.pl.md). No real infrastructure was modified by Stage 2A. Staging/Production startup is disabled.

Offline validation requires an **isolated loopback PostgreSQL16+ cluster** and an explicit `SOURCE_HUB_TEST_ADMIN_URL` pointing to its `postgres` database. Tests create/drop only generated `stage2a_test_*` databases there. They refuse remote hosts. Run `npm --prefix apps/platform-source-hub test` and the Newsfeed tests after installing both applications' public dependencies. Synthetic Clerk-interface/provider fixtures exist only under test; executable services contain no fixture/auth bypass flag. A separate smoke test starts both actual Node entrypoints with all outbound networking blocked.

Monitoring extends JSON/stdout and health diagnostics. Request IDs, operation/outcome/status/duration/count are allowed; credentials, query text, SQL, identities and provider content are excluded. Root audit stays in the canonical control plane. No new Sentry/PostHog resource or competing telemetry pipeline is introduced.
