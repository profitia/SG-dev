# SG2 E1 — alternate stored market analytics API

Status: SOURCE_CANDIDATE_NOT_DEPLOYED. Date: 2026-10-18 Europe/Warsaw (2026-10-17 UTC). This receipt does not complete E1 or activate individual login in an existing business environment.

## Authority and scope

Task `SG2-E1-STORED-MARKET-ANALYTICS-20261018`, profile SG2, workspace SG-dev, local isolated branch, TARGET_ENVIRONMENT=development, repository `profitia/SG-dev`, authority `main`. Base source: `84ac1ac7984082f1278c3e59b96f0ffb264c6fa6`, after PR #456. Twelve exact targets passed before/begin/require-begin governance, routing and actual provider drift checks. PMOS derives the task conversation identity; another profile's records are not copied.

The existing `GET /api/benchmark/analytics-series?seriesId=…&range=…` is an alternate entrance to market history. Its previous signed legacy handler called `getBenchmarkAnalyticsSeries`, which normally uses the provider-backed/read-through history service. It cannot be described as a pure prepared-data read merely because it is a GET.

## Resulting source behavior

| Mode | Behavior |
| --- | --- |
| Existing `legacy_demo` | Same signed handler, query parser, default history resolution, range/units/null/zero semantics and generic business-error behavior |
| Explicit individual Clerk with complete accepted configuration | Current `knowledge.read` through the existing common native authority; own market permission, product feature, membership, module and audit required; the existing separately constrained stored-history reader |
| Explicit individual mode without analytics capability/configuration | Safe 503, no fallback to a signed demo session or provider-backed legacy handler |
| Configured authenticator refuses identity / current permission is absent | 401 / 403 respectively; failed policy or durable audit remains unavailable |

The source now injects a historical reader into the existing analytics formatter only for the native branch. It does not replace the original default service or invent new data calculations. Business services are still loaded lazily in native runtime composition, preserving initialization behavior.

Both preview and analytics use the same native host factory, common operation kernel/access store, private business/audit pools, separately restricted shared-source pool and source reader. The source pool remains one connection. No new policy engine, runtime, database role, SQL/view/receipt digest, dependency, framework version, vendor package or lock file was introduced.

The server chooses the analytics representation when composing the host. Its resource prefix is `market-analytics:` and projection is `sg2-stored-market-analytics-v1`; the preview resource/projection retain their original behavior. The client cannot choose a representation, operation, user, role, database or host. Query `organisationId` is a requested scope, validated by current authority rather than trusted as permission.

Output uses the existing bounded closed shared-data schema without preview-only change metrics. Extra private fields, wrong series/range/resource and mixed preview representations are refused. Date/value/unit/null handling remains the existing formatter's behavior. Approved shared facts do not include private requester, organization or audit metadata. Responses remain private/no-store with authentication-aware Vary.

## Validation

- Complete local SG2 operation-context regression: **316 tests passed, zero failures, cancellations or skips**. The added cases execute the actual native API/common authority and Prisma transactions with an ordinary restricted SQL source role in fixed disposable loopback databases.
- Two currently authorized organizations read identical shared facts and retain separate actor/audit scope. Selection permissions alone, missing market product feature, another member without permission, unknown organization, forged unsigned identity, current membership suspension, explicit DENY and product revocation cannot invoke the source read.
- The actual source reader refuses a foreign installation receipt. A preview host cannot serve the analytics representation. A tainted otherwise valid shared response is withheld. A durable OUTCOME failure withholds valid data and leaves an independent correlated FAILURE. No real provider acquisition occurs in these new flows/tests.
- Typed tests verify original analytics formatting/ranges, zero/null/original units, closed selectors/output, body bounds, method and error distinctions, optional capability refusal and actual mounted-route configuration refusal. Existing signed legacy route tests remain active; their old blanket Clerk refusal expectation is updated for the newly adopted route's 503 configuration state, not used as proof of configured identity.
- Initial strict checking found TypeScript widening the shared composition's operation literals to `string[]`. An explicit constructor-parameter type corrected the declaration without a runtime change. The subsequent strict changed-source and typed-test check passed. The earlier failed type check is not counted as a passing run.

Exact candidate and merged-source controlled/public/dashboard/governance/build CI remain required for publication and are recorded with actual run IDs in the canonical closeout. Local SQL fixtures and earlier PR #456 physical SQL proofs do not establish a live Prisma/TLS connection, real Clerk browser login, business E2E or release rollback.

## Protected existing environments and remaining work

No live SQL, role/grant/credential, application flag, connection, Render/GitHub setting or deployment was changed by this task. The market opt-in remains disabled by default. No Staging or Production resource was changed. The prepared market source remains independently documented in `apps/sg-runtime/deployment/market-read-preparation.json`; that receipt is not rewritten by this API increment.

Discovery/search/metadata/semantic context, provider acquisition and global writes, forecast preparation, delegated jobs, cache/files and remaining application entrances still require their own current-authority/effect boundaries. Controlled Development/Staging releases, real individual login and executable artifact/data recovery remain separate E1 acceptance work. E2–E4 and Production are not authorized here.
