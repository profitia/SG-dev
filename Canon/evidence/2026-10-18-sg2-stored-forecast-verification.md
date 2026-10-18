# SG2 E1 — stored Forecast Verification source and API candidate

Date: 2026-10-18. Profile: SG2. Target: Development. Execution: isolated local checkout and synthetic loopback PostgreSQL. Task: `SG2-E1-STORED-FORECAST-VERIFICATION-20261018`. Authority: `profitia/SG-dev/main`.

## Result and acceptance boundary

The actual `GET /api/benchmark/forecast/verification` has an explicit native dispatcher for the existing operation-context host. In native mode it requires current account/session, organisation membership, `forecast.read`, the benchmark module and the SPENDGURU forecast feature. The original legacy handler remains the explicit legacy implementation. Missing native configuration, denied access or source failure cannot invoke legacy computation.

The source reader reuses `resolvePreparedForecastVerification`, the original generic prepared service/DAOs and the original Rolling FULL/FAST/RECENT readers. FAST remains the default. Period Verification derives authority from the full canonical history; it does not substitute Current's model-specific minimal training suffix. Rolling training-prefix identity remains available for original append/revision compatibility checks. Cadence, canonical hashes, fitting, metric arithmetic, origin policy, statistical compatibility and preparation rules are unchanged.

One restricted generated source client/pool serves Current and Verification. Each read checks the exact source receipt, runtime login, ordinary role, connection limit, memberships, object/column ACLs, schema owners, functions, enum values and expiration, in the same bounded read-only Repeatable Read transaction as history and artifacts. No mutable private-store authority is cached by the source adapter. Native private authority is independently rechecked for each operation.

## Revised uninstalled source candidate

`002-stored-rolling-current.sql` is candidate schema 3.0.0. It adds approved security-barrier generic Verification run/metric/point views, Rolling verification and maintenance views, a separately owned maturity enum, pure closed JSON projections and preparation-state projections. The latest-attempt state projections retain FAILED attempts separately from reusable AVAILABLE artifacts; native capability/readiness adoption is still a separate remaining task.

Source-owner grants use only reviewed base columns. The runtime reader can select approved views and execute only reviewed pure invoker helpers; it cannot read raw/private tables, change data, grant access, create objects or use definer functions. The installed market 001 source and its digest remain unchanged. Maintenance `NO_OP` is retained because the original Rolling readers treat it as a lawful completed pass.

Private initiators, internal source run identifiers and raw failure diagnostics do not cross the approved source boundary. Known fit failures retain their identity/order but use a fixed public failure code. Invalid applicable scientific metadata refuses publication rather than silently removing observations. Unknown parameters refuse the complete parameter object. No synthetic zeros, history fingerprints, band identities or source provenance are published to replace missing evidence.

Read-only aggregate observation of the existing source found 326 generic Verification bands with known scientific policies but without stored band identity; the Current source had 1,000 bands with stored identity. Verification preserves approved scientific values and leaves missing identity absent; any supplied identity must match the actual run/point context. Current's existing exact identity validation remains unchanged. Rolling non-null bands remain refused pending an actual producer contract proving their context.

Observed source size justified the separate 8 MiB Verification response bound and 20,000 total record/failure bound, with complete refusal rather than truncation. Aggregate observer reads are not runtime-role or application TLS evidence.

## Local validation

- 443 operation-context regression tests passed, zero skipped; this includes existing Current/market/category/supplier boundaries and the new Verification tests.
- 61 original forecast-library and Rolling Current snapshot tests passed, zero skipped.
- Strict TypeScript validation of the source/host/runtime surface and typed Verification API tests passed.
- Eight fresh-process imports of the relevant source/actual routes performed zero global source-client resolutions and zero provider fetches.
- A new disposable database was created from the actual market Prisma schema. The genuine generated ORM read the closed views as an ordinary login with no raw/private/write access; no ORM substitute was used.
- All four period models, both period bases, FULL/RECENT, default FAST, original distinct period/Rolling readiness rules, Rolling calendar step variation, `NO_OP`, zero/null values, existing identity-less bands and prefix/source-correction behavior were exercised.
- Actual test API calls under independently persisted private authority verified two organisations, current revocations, dedicated-host restrictions, source receipt/ACL drift, projection refusal and audit OUTCOME failure. Audit failure withheld the valid result and preserved independently durable FAILURE. Clerk SDK responses were synthetic fixtures, not live user sessions.
- The separately retained latest FAILED attempt remained visible in its approved state projection while the older exact AVAILABLE artifact remained reusable according to the original prepared-read policy.

Exact source SHA, independent controlled CI proof, main integration/build results, PR and PMOS/MEMOROS/PHR closeout are recorded by the canonical task lifecycle after publication. This baseline does not pre-claim those later results.

## Shared parameter prerequisite

Before acceptance, a further read-only aggregate found a missing finite numeric ARIMA trend coefficient `x1` in the original shared publication whitelist. Separate SG2 task/PR #466 corrected the one existing TypeScript/SQL validator, with its own complete PMOS/MEMOROS/PHR closeout. Its authority merge is `68c6afa017d6ae2b4c6ab9edc9e1fb01380733ae`. This candidate was reintegrated from that fresh authority; the initial commit remains preserved on its original branch. Only the predictable descriptor digest conflicted, and it was recomputed from the combined SQL. No dirty/code-state bypass was used. Native Verification tests now retain the genuine numeric coefficient in both period and Rolling ARIMA fixtures. All 396,705 observed Verification parameter objects and 1,698 Current objects fit the corrected predicate; this is parameter-shape evidence, not complete artifact or runtime/TLS acceptance.

## Provider observation and known remaining gaps

A fresh read-only provider observation at 2026-10-18 02:53 UTC confirmed the four SG2 Development service deployment identities unchanged and auto-deployment disabled. The 17 repository services were checked for routing/automatic-deployment impact. No changed path targets the independently auto-deployed applications. Market Development still had zero forecast candidate schemas and zero forecast candidate roles. These are catalog observations as `neondb_owner`, not proof of a restricted live forecast reader.

No cloud SQL, roles/grants, connection credentials, environment flags, Clerk settings, product deployment, market ingestion or Staging/Production changes were performed by this task. The candidate remains uninstalled and native activation defaults OFF. Existing deployed applications remain unchanged.

Remaining: native capability/readiness adoption; retained non-daily provenance; preparation/service/job delegation; dashboard adoption; physical source and private grants with recovery evidence; actual Prisma/TLS and live login/browser business checks; controlled Development and then Staging releases and required owner review. This source/API candidate is not completion of E1, a product release or evidence of complete tenant isolation across all application entrances.
