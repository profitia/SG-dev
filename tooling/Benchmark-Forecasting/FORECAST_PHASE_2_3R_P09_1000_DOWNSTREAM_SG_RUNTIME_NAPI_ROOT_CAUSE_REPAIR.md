# FORECAST PHASE 2.3R P09@1000 DOWNSTREAM SG RUNTIME N-API FAILURE ROOT-CAUSE & REPAIR

## 1. Executive Summary

The downstream N-API failure is strongly supported as unsafe concurrent materialization of duplicate multi-megabyte Prisma result strings. Exact-series in-flight ownership restores canonical correctness without changing C01 or response semantics. Phase 2.3R passes.

## 2. Objective

Identify the exact N-API throw site and causal inputs before repair, apply the minimum repair, and prove P09 and P10 without reopening Phase 2.3 or starting Phase 2.4.

## 3. Accepted Phase State

C01 remains accepted with causal effect CONFIRMED. Historical Phase 2.3 remains FAIL at 107/108 solely because its immutable P09@1000 returned HTTP 500.

## 4. Historical Phase 2.3 Gate

FAIL, 107/108. The historical gate and workload evidence were read only and were not regenerated or overwritten.

## 5. C01 Accepted Authority

The accepted C01 source hash remains exact. Focused and controlled evidence still shows one application-record owner/read and zero duplicate reads.

## 6. Historical P09@1000 Failure Authority

Immutable result: 0/1000 correct, 1000 HTTP failures, one C01 owner, 999 joiners, one application read, zero duplicate reads.

## 7. Scope Boundary

Only SG Runtime exact-series stored-read ownership, its tests, and Phase 2.3R evidence/tooling changed. Query, filtering, indexes, pools, timeouts, HTTP, infrastructure, Forecast, Current, Verification, persistence, C01, and Phase 2.4 did not change.

## 8. Immutable Evidence Authority

PASS across {"status":"PASS","before":22,"originalB4":3,"phase1r":1,"b4r":7,"phase22c":9,"phase22d":6,"phase23":9,"historicalP09RawSha256":"97b72dffe9cd369a7d4c6914e459b0ffd848e5c56a55932d3a1cc1cfb889c06b"}.

## 9. Exact Request Path

dashboard-preview GET /api/components -> getComponentList -> listDashboardRecords (C01) -> dashboard-preview GET /api/series -> getSeries -> getBenchmarkSeries -> sg-runtime GET /api/benchmark/analytics-series -> getBenchmarkAnalyticsSeries -> getBenchmarkHistory -> resolveBenchmarkHistoricalSeries -> resolveHistoricalSeries -> readStoredSeriesFromPrisma -> prisma.marketSeries.findUnique -> Prisma library engine query result -> napi::ToNapiValue<&String> -> napi_create_string_utf8

## 10. SG Runtime Analytics-Series Path

GET /api/benchmark/analytics-series -> getBenchmarkAnalyticsSeries -> getBenchmarkHistory -> resolveBenchmarkHistoricalSeries -> resolveHistoricalSeries -> readStoredSeriesFromPrisma.

## 11. Native / N-API Dependency Inventory

Prisma 5.22.0; napi 2.16.13; apps/sg-runtime/generated/market-data-client/libquery_engine-darwin-arm64.dylib.node.

## 12. Environment Authority

Node v24.15.0, N-API 10, modules 137, darwin/arm64, Next.js 14.2.29 development server.

## 13. Exact Throw Site

ToNapiValue for &String::to_napi_value calls napi_create_string_utf8 while returning the Prisma query-result String to JavaScript.

## 14. Exact Error Authority

Failed to convert rust `String` into napi `string`

## 15. Value at Failure Boundary

Rust String containing the Prisma JSON query result; lawful largest fixture 4729100 UTF-8 bytes and 21718 observations.

## 16. Value Origin

PostgreSQL marketSeries.findUnique result with hydrationState and all ordered observations

## 17. Value Validity Analysis

The series ID is a present primitive 10-byte ASCII string. Successful result serialization is valid UTF-8 with no NUL or unpaired surrogate. Content invalidity is rejected.

## 18. Concurrency Dependence

Required. Calls pass through 74 overlaps and deterministically fail at 75 overlaps for the large result.

## 19. Data Dependence

Required. Metadata-only and a 318-point series pass at 1000 overlaps; the 21,718-point, 4.73 MB result fails at the overlap boundary.

## 20. Minimal Reproduction Design

Direct generated Prisma market-data client; Dashboard HTTP, C01, application DB, filtering, workload harness, and provider excluded

## 21. Minimal Reproduction Result

Before: 0/75; 75 GenericFailure N-API errors. After: 1000/1000 production-service callers succeed with zero N-API failures.

## 22. Root-Cause Candidate Matrix

17 candidates record evidence, counterevidence, and confidence. STRING_SIZE_BOUNDARY and SERIALIZATION_HANDOFF_DEFECT are strongly supported; invalid-value alternatives are rejected.

## 23. Root-Cause Evidence

Concurrent duplicate full-history Prisma reads materialize many multi-megabyte native query-result Strings at once. At the measured large-series boundary, napi_create_string_utf8 cannot create the JavaScript strings and Prisma returns GenericFailure. The individual values are valid; concurrent large-result multiplicity is the unsafe condition.

## 24. Root-Cause Counterevidence

A single large result and 74 overlaps pass, so this is not an individual string-size or encoding limit. Native scheduling remains opaque, so confidence is STRONGLY_SUPPORTED rather than PROVEN.

## 25. Root-Cause Confidence

STRONGLY_SUPPORTED

## 26. Explanation of P09@100 vs P09@1000

YES. The unsafe condition is aggregate overlapping multi-megabyte native-to-JS materialization, not the validity of any individual series or string.

## 27. Throw Site vs Root Cause

The throw site is napi_create_string_utf8. The cause is concurrent duplicate large-result materialization reaching that boundary; the two are explicitly distinct.

## 28. C01 Non-Causation / Contribution Analysis

C01 caused NO and contributed NO. It shares only the preceding application-record Promise; no C01 object enters Prisma.

## 29. Shared Result Lifetime

C01 lifetime is irrelevant to SG Runtime series reads. The repair introduces a separate exact-series owner only for overlapping stored-series reads.

## 30. Shared Result Mutation Analysis

No shared result mutation exists. Callers receive the canonical repository result; no clone, copy, fallback, or transformation was added.

## 31. Repair Selection

Share one exact-series database read only while overlapping, eliminating duplicate native result materialization at its owning application boundary.

## 32. Repair Scope

Process-local, exact-series, in-flight-only coalescing of MarketDataRepository.readStoredSeries

## 33. Repair Correctness Contract

All callers receive the same canonical full-history result or the same owner error. Cleanup is identity-safe and retry remains possible after failure.

## 34. Dependency Version Impact

No dependency version changed. Prisma/client/engine remains 5.22.0.

## 35. Repair Implementation

A process-local Map keyed by exact seriesId stores only the unsettled repository-read Promise; finally removes only the matching owner Promise.

## 36. Repair Rollback Boundary

Remove inFlightStoredSeriesReads and readStoredSeries from apps/sg-runtime/lib/market-data/service.ts. Restore the resolveHistoricalSeries call to resolvedDependencies.repository.readStoredSeries(seriesId). Remove only the Phase 2.3R market-data coalescing tests; C01 rollback remains separate.

## 37. Reproduction Before Repair

74/74 PASS; 0/75; 75 GenericFailure N-API errors.

## 38. Reproduction After Repair

1000/1000 correct, 0 failures, 0 N-API failures.

## 39. Failure Regression Fixture

Persisted synthetic historical N-API error fixture passes and proves owner sharing prevents duplicate threshold entry while preserving error propagation and retry.

## 40. Concurrency Repair Proof

1000 callers, 3 exact-series owners, 997 joiners, 0 N-API failures, zero active entries after settlement.

## 41. SG Runtime Integration Proof

Focused SG Runtime market-data tests 11/11 PASS; full P09 route results also pass at 100 and 1000.

## 42. C01 Structural Regression

PASS: accepted C01 source is hash-identical; focused proof remains 10 requests, one owner, nine joiners, one read, zero duplicates, zero active entries.

## 43. P09 Lower-Control Authorization

Authorized after root-cause, repair, focused tests, direct repaired proof, source guards, and clean-state preparation passed.

## 44. P09 Lower-Control Result

100/100 correct, zero failures and timeouts, settlement PASS.

## 45. P09 Lower-Control N-API Correctness

0 N-API failures.

## 46. P09 Lower-Control C01 Correctness

1 owner, 99 joiners, 1 read, 0 duplicates, registry 0.

## 47. High-Concurrency Authorization

YES. It ran only after all lower gates passed and its accounting limit was one attempt.

## 48. Phase 2.3R P09@1000 Result

1000/1000 correct, 0 HTTP failures, one authorized execution, settlement PASS.

## 49. High-Concurrency N-API Correctness

0 historical N-API failures and no other failure classes.

## 50. High-Concurrency C01 Correctness

1 owner, 999 joiners, 1 read, 0 duplicates, registry 0.

## 51. Historical vs Repair Failure Comparison

Historical: 1000/1000 N-API HTTP failures. Repaired: 0/1000 N-API failures and 1000/1000 canonical responses. Same-cause resolution is YES.

## 52. New Failure Classification

NEW_DOWNSTREAM_FAILURE = NO. No new failure class occurred in the authorized repaired high wave.

## 53. Capacity / UX Evidence

CAPACITY_EFFECT = IMPROVED and UX_EFFECT = IMPROVED based on restored 1000/1000 correctness with zero HTTP failures; no unsupported causal latency claim is made.

## 54. Resource Evidence

RESOURCE_EFFECT = NOT_COMPARABLE because canonical pre-wave and peak memory fields are null. Settlement and pool checks pass, but no unsupported resource ratio is claimed.

## 55. P10 Isolation

P10 ran once in isolation only after the P09@1000 process and database settlement passed.

## 56. P10 Non-Regression

10/10 correct, 10 prepared-resolution spans, zero Forecast compute/owners/writes/provider calls, and zero C01 activity.

## 57. SUCCESS_COMPUTED Label Semantics

Historical harness naming for a successful prepared response only. Direct telemetry proves Forecast compute, owner, and writes were all zero.

## 58. C02 Trigger Status

NOT_TRIGGERED. The repaired authorized high wave is canonically correct with no downstream failure; no C02 implementation is authorized.

## 59. C03 Trigger Status

NOT_TRIGGERED. There are no timeouts or retained-work settlement failures; no cancellation change is authorized.

## 60. Cross-Instance Boundaries

The repair and C01 remain process-local. Cross-instance ownership is neither implemented nor claimed.

## 61. Forecast / Verification / Persistence Guards

PASS: Search remains Forecast- and Verification-compute-free, P10 remains Forecast-owner/write-free, and all ownership/persistence implementations are unchanged.

## 62. Functional Regression

15/15 checks PASS: Forecast Core 218/218, SG Runtime 175/175, Dashboard 106/106, phase tooling 31/31, typechecks, build, accepted gates, JSON, and source hygiene. Stress execution observed = NO.

## 63. Methodology / Scope Guards

PASS: no timeout increase, concurrency reduction, throttling, error swallowing, fallback data, query/filter/index/pool/HTTP/infrastructure change, or Phase 2.4 work.

## 64. Migration Readiness

PASS with 55 task-attributed paths, zero nested Git repositories, and zero external source repositories.

## 65. Phase 2.3R Final Gate

PASS: 100/100 PASS, 0 BLOCKED, 0 FAIL.

## 66. Phase 2.3 Series State

PHASE_2_3_SERIES_COMPLETE = YES. Historical Phase 2.3 remains immutable FAIL; Phase 2.3R accepts the downstream repair without rewriting history.

## 67. Recommended Next Decision

AUTHORIZE PHASE 2.4 - PRODUCTION ARCHITECTURE FREEZE. Do not begin it; authorization remains a separate human decision.

## 68. STOP

STOP — PHASE 2.3R P09@1000 DOWNSTREAM SG RUNTIME N-API FAILURE ROOT-CAUSE & REPAIR COMPLETE. PHASE 2.4 NOT AUTHORIZED.
