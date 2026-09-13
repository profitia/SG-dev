# PPF-1 Stage 12 Series-Scoped Capability Batch Corrective Evidence

TASK_ID = ppf-1-stage-12-series-scoped-capability-batch-corrective-20260913
GENERATED_AT = 2026-09-13T16:51:57.000Z
IMPLEMENTATION_BRANCH = ppf1/stage12-live-acceptance-legacy-deprecation-20260911
BASE_HEAD_BEFORE_CORRECTIVE = 462000e9f526e15286d56a0d448faa942821d844
CAPABILITY_AUTHORITY_REUSE_GATE = PASS
EXACT_ENDPOINT_PRESERVATION_GATE = PASS
PRECOMPUTE_BATCH_REDUCTION_GATE = PASS
INTERACTIVE_PARITY_GATE = PASS
SG_RUNTIME_FOCUSED_TEST_GATE = PASS
DASHBOARD_FOCUSED_TEST_GATE = PASS
SG_RUNTIME_TYPECHECK_GATE = PASS
DASHBOARD_TYPECHECK_GATE = PASS
LIVE_DEPLOY_PERFORMED = NO

## Scope

- Certification PRECOMPUTE no longer performs twelve exact remote capability reads per benchmark.
- SG Runtime now exposes one internal authenticated series-scoped capability snapshot route backed by the existing `resolveForecastCapabilitiesBySeriesId(seriesId)` authority.
- Dashboard PRECOMPUTE now consumes one snapshot per benchmark and reuses exact interactive semantics by local variant lookup.
- The exact internal capability endpoint remains unchanged.
- No live deploy was performed in this task.

## Product Change

- Added SG Runtime series-scoped interactive capability projection using the existing readiness helper and existing series authority.
- Added internal authenticated route `GET /api/internal/forecast/capabilities?seriesId=...`.
- Added dashboard bridge support for the new series snapshot route.
- Switched certification PRECOMPUTE to a benchmark-scoped snapshot cache with force-refresh only after lawful current preparation.
- Preserved exact capability semantics, exact readiness gating, and non-PRECOMPUTE paths.

## Focused Validation

- `cd apps/sg-runtime && node --import tsx --test tests/forecast-route-contract.test.ts` -> PASS (`44` tests)
- `cd apps/dashboard-preview && node --import tsx --test tests/benchmark-forecast-current-preparation.test.ts tests/demo-certification.test.ts` -> PASS (`57` tests)
- `cd apps/sg-runtime && npm run typecheck` -> PASS
- `cd apps/dashboard-preview && npm run typecheck` -> PASS

## Key Assertions Proven

- Series snapshot path preserves exact interactive capability semantics for the same variant.
- Certification PRECOMPUTE uses one series capability snapshot miss per benchmark instead of twelve exact capability misses.
- PRECOMPUTE refreshes the series snapshot once after lawful current preparation when readiness changes.
- Dashboard bridge keeps internal auth server-side and forwards only series identity to the new batch route.

## Changed Files

- `apps/sg-runtime/lib/forecast/interactive-preparation.ts`
- `apps/sg-runtime/lib/forecast/interactive-route-handlers.ts`
- `apps/sg-runtime/app/api/internal/forecast/capabilities/route.ts`
- `apps/sg-runtime/tests/forecast-route-contract.test.ts`
- `apps/dashboard-preview/lib/benchmark-forecast/acceptance-matrix.ts`
- `apps/dashboard-preview/lib/benchmark-forecast/demo-certification.ts`
- `apps/dashboard-preview/lib/benchmark-forecast/forecast-contract.ts`
- `apps/dashboard-preview/lib/benchmark-forecast/interactive-current-preparation.ts`
- `apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts`
- `apps/dashboard-preview/tests/benchmark-forecast-current-preparation.test.ts`
- `apps/dashboard-preview/tests/benchmark-forecast-runtime-query.test.ts`
- `apps/dashboard-preview/tests/demo-certification.test.ts`
- `apps/dashboard-preview/tests/forecast-acceptance-matrix.test.ts`
- `apps/dashboard-preview/tests/interactive-current-client.test.ts`
- `tooling/Benchmark-Forecasting/validation/ppf1-stage12-series-scoped-capability-batch-corrective.json`
- `tooling/Benchmark-Forecasting/validation/ppf1-stage12-series-scoped-capability-batch-corrective.md`