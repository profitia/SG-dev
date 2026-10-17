# SG2 E1 — stored Rolling Daily current forecast

Status: SOURCE_CANDIDATE_NOT_DEPLOYED. Date: 2026-10-18 Europe/Warsaw (2026-10-17 UTC). This source increment does not complete E1, activate individual login or release a product.

## Authority and scope

Task `SG2-E1-STORED-ROLLING-CURRENT-FORECAST-20261018`, profile SG2, workspace SG-dev, local isolated branch, TARGET_ENVIRONMENT=development; repository `profitia/SG-dev`, authority `main`. Base: `00d6bebce77fcade264e56ba891c9194799c8756` after PR #457. Seventeen exact paths passed the before/begin/require-begin gates. Own SG2 PMOS identity is derived from the real host identity; no foreign continuity records are copied.

The mounted `GET /api/benchmark/forecast/current` has an explicit native branch for prepared POINT_IN_TIME Rolling Daily results. The existing factory, parser, MONTHLY_AVERAGE default, algorithms, persistence and signed legacy handler remain available unchanged under the existing legacy mode. An unavailable native capability never borrows the legacy handler. Generic-period Current, verification, preparation and jobs are outside this unit.

## Access and execution

| Boundary | Required behavior |
| --- | --- |
| Private authority | Existing official Clerk adapter and common executor; current internal account, organization membership, explicit `forecast.read`, SPENDGURU `forecast` feature, benchmark module binding and durable audit |
| Resource | Server-derived series/model/POINT_IN_TIME identity, `market_forecast`, SHARED_KNOWLEDGE, no organization/user ownership on shared facts; projection `sg2-stored-rolling-current-v1` |
| Caller | Existing series/model query; strict bounded selector; requested organization checked by current authority; duplicate, unknown, actor/operation and prepared-authority header inputs refused |
| Source | Separate pinned ordinary forecast role, one generated Market Prisma connection; the same existing market project/Development branch/database; no private business connection for source reads |
| Stored result | Original `buildRollingDailyHistoryFingerprint` and actual `readRollingDailyCurrentForecastSnapshot` with its statistical identity, training policy, method/version and legacy compatibility logic |
| Missing/stale result | Original honest NOT_AVAILABLE/MISS/STALE envelope, no fabricated path, refit, Python, provider acquisition, hydration, file or job fallback; audit outcome NO_DATA |
| Errors and caching | Invalid identity 401, forbidden current authority 403, policy/source/audit failure 503; private/no-store and Cookie/Authorization Vary; internal diagnostics withheld |

The original history query/formatter is extracted for reuse after each caller's own source verification. Existing market preview/analytics keep their original three-object descriptor, receipt and SQL digest. Snapshot DAO changes only narrow the read dependency to a genuine generated Prisma client or transaction; persistence and default-client behavior are preserved. The forecast business graph/client are initialized lazily inside the authorized callback. The existing private three-connection pool and separate one-connection audit pool remain unchanged.

## Source candidate and observed cloud facts

Catalog-only observation recorded at 2026-10-17T22:55:57.166Z: project `autumn-waterfall-65938876`, branch `br-dry-hall-b294222f`, database `neondb`, PostgreSQL 18.6. The owner observer is `neondb_owner`; it is explicitly not an ordinary-runtime proof. The physical snapshot has the 20 columns required by the generated model, including training/effective policy and source fingerprint. The public enum has MONTHLY_AVERAGE, END_OF_PERIOD and POINT_IN_TIME. The two approved stored-market views exist. Candidate forecast roles/schema were absent. No payload rows or credentials were read for this observation.

Candidate SQL `002-stored-rolling-current.sql` creates only a future `profitia_forecast_read` schema under its own NOLOGIN owner, an independent enum matching the generated ORM, a FORCE RLS installation receipt, three pure immutable SECURITY INVOKER SQL projection helpers and a security-barrier view. A future installer must supply exact column-only source grants and only the approved shared-history/view/receipt access to the new runtime role. The existing market role is not broadened.

The view mirrors the generated model while setting input-run and raw error fields to null. Nested statistical JSON is explicitly projected; private requester/organization/job metadata and raw warning/error text cannot pass through raw ORM reads. Reviewed finite scalar/model-policy parameters are allowed; unknown parameter records and oversized statistical paths are withheld. Raw input projection is bounded to 4 MiB, the path to 366 points and anchors to the existing four-horizon contract. This does not change the estimator or statistical policy.

The native reader verifies actual session/login/database, ordinary LOGIN flags and connection budget, no inherited roles, both controlled owners, four approved objects, three pure helpers, enum identity, receipt/digests/expiry and absence of extra table/column access, source writes/grant options, CREATE and callable definers. History and snapshot are read in one bounded REPEATABLE READ, READ ONLY source transaction. Source configuration uses strict TLS and exact deployment pins. Configuration syntax is not evidence of an actual TLS login.

**No candidate SQL, forecast role/grant, receipt, credential, application flag, source connection or live configuration was applied by this task.** The opt-in defaults off; source installation/activation requires separate governed preparation and recovery evidence.

## Validation

- **352 local SG2 operation tests passed; zero failed, cancelled or skipped.** They include the seven original snapshot DAO regressions; that original suite also passed independently. Strict checking of changed source and typed tests passed.
- Genuine generated Market Prisma and actual ordinary PostgreSQL logins exercise exact SQL, enum/model queries and canonical source identity. All four existing models retain their reviewed stored parameters, zeros, units and original fingerprint. Direct ORM reads cannot obtain private marker fields.
- Exact source DDL rolls back completely on forced failure and cleanly reapplies in fixed disposable loopback databases. Raw/private table reads, writes, CREATE, foreign/expired receipts, training/effective/method/fingerprint drift, column-only private grants, write grants and callable-definer drift are denied or withhold the unavailable artifact as appropriate. The existing market reader remains valid and cannot borrow the new forecast schema.
- Actual native API tests use the common authority/private Prisma plus the independent generated source ORM. Two authorized organizations receive identical shared facts with separate audit scope. Selection/knowledge permissions, absent forecast product feature, another member, unknown organization, forged identity, revoked session, disabled account, suspended membership, explicit DENY, revoked product/module and foreign dedicated-profile choice cannot invoke source reads.
- Native missing/stale responses contain no computed replacement. Private fields added to otherwise valid output are withheld. Audit OUTCOME outage withholds the valid result and retains independent correlated FAILURE. New source/API flows make no provider call.
- Initial test fixtures omitted required description metadata, used a noncanonical account status and asserted the wrong audit field; they were corrected to the existing contracts. Earlier failed runs are not passing evidence. The sandbox initially denied local database connections; the authorized isolated test run then executed successfully. No product/schema policy was relaxed for tests.

Exact candidate and merged-main controlled/public/dashboard/governance CI, source build and own canonical closeout remain publication requirements. Their actual run/commit references are recorded in PMOS/PHR, not invented in this source receipt.

## Remaining acceptance

Local PostgreSQL fixtures and catalog metadata do not prove live Prisma/TLS, real Clerk browser login, business UAT or executable retained-artifact recovery. No Development or Staging product release is claimed. Existing business Development/Staging remain untouched; Production and E2–E4 are outside this task.

Generic-period/verification/preparation/delegated jobs, discovery/provider acquisition/global writes, remaining entrances, cache/files and controlled Development then Staging releases remain E1 work. The separately reviewed original market reader's table-level ACL drift check is not expanded by this extraction; additional column-level drift hardening for that existing reader remains an explicit follow-up, rather than being silently counted as delivered here.
