# PPF-1 Stage 12 Live PIT Persisted-Proof Prisma Wiring Corrective

TASK_ID = ppf-1-stage-12-live-pit-persisted-proof-prisma-wiring-corrective-20260914
GENERATED_AT = 2026-09-14T15:12:52.000Z
SCOPE = implementation
VALIDATION_BRANCH = ppf1/stage12-live-acceptance-legacy-deprecation-20260911
REMOTE_BASE_SHA = 200c693269728880602feecbd15dae843fde88aa
FINAL_SOURCE_SHA = 8b09a58fd7f2aac42dad431659d43e0be515e36a
DASHBOARD_DEPLOYED_SHA = 8b09a58fd7f2aac42dad431659d43e0be515e36a
SG_RUNTIME_DEPLOYED_SHA = f7761cc3ee56dd474667b89132747910d67c2517
FINAL_SOURCE_COMMIT = fix(stage12): wire matrix persisted proof prisma
FINAL_DEPLOY_ID = dep-dak0q4uq1p3s739ro5ig
PRODUCT_OWNER = apps/dashboard-preview
SG_RUNTIME_MUTATED = NO
MATRIX_SEMANTICS_MUTATED = NO
PIT_ARTIFACTS_REBUILT = NO
TIMEOUT_MUTATED = NO
BRENT_PIT_PRISMA_UNAVAILABLE_FAIL_COUNT = 0
ALUMINIUM_PIT_PRISMA_UNAVAILABLE_FAIL_COUNT = 0
BRENT_PIT_MISSING_ARTIFACT_FAIL_COUNT = 0
ALUMINIUM_PIT_MISSING_ARTIFACT_FAIL_COUNT = 0
BRENT_FINAL_GATE = PASS
ALUMINIUM_FINAL_GATE = PASS
FULL_BENCHMARK_ACCEPTANCE = PASS
RESULT = SUCCESS

## Scope

- This task implemented the smallest evidence-backed corrective for the remaining Stage 12 MATRIX failure by changing only the dashboard-owned default persisted-proof Prisma wiring in `createDemoCertificationService(...)`.
- The corrective restores the certification matrix path to the same canonical market-data Prisma provider already used by `acceptance-matrix` when no custom dependency is injected.
- No SG Runtime source file was modified.
- No MATRIX acceptance rule, timeout, or PIT artifact generation path was changed.
- No PIT artifact rebuild was performed.

## Source Delta

- Modified `apps/dashboard-preview/lib/benchmark-forecast/demo-certification.ts`.
- Modified `apps/dashboard-preview/tests/demo-certification.test.ts`.
- Functional production delta:
  - imported `getMarketDataPrismaClient` from `@/lib/db/market-data-prisma`
  - changed `const getMatrixPrisma = dependencies.getMatrixPrisma ?? (() => null)`
  - to `const getMatrixPrisma = dependencies.getMatrixPrisma ?? getMarketDataPrismaClient`
- Regression coverage added:
  - default built-in MATRIX evaluation uses the canonical cached market-data Prisma for POINT_IN_TIME persisted-proof checks
  - explicit `getMatrixPrisma` injection still overrides the production default

## Local Validation

- `cd apps/dashboard-preview && node --import tsx --test tests/demo-certification.test.ts` -> `41/41 PASS`
- `cd apps/dashboard-preview && node --import tsx --test tests/forecast-acceptance-matrix.test.ts` -> `19/19 PASS`
- `cd apps/dashboard-preview && npm run typecheck` -> `PASS`
- Compiler/editor validation on the touched files reported no errors.

## Exact Deploy Truth

- Source branch remained `ppf1/stage12-live-acceptance-legacy-deprecation-20260911`.
- Exact source commit `8b09a58fd7f2aac42dad431659d43e0be515e36a` was pushed to remote.
- Dashboard service `dashboards-library` was manually redeployed on Render from that exact commit.
- Provider truth for dashboard: deploy id `dep-dak0q4uq1p3s739ro5ig`, status `Deploy succeeded`, source `8b09a58`, service live.
- Public route release snapshot reported:
  - `sourceRevision = 8b09a58fd7f2aac42dad431659d43e0be515e36a`
  - `deployedRevision = 8b09a58fd7f2aac42dad431659d43e0be515e36a`
  - `environment = render`
  - `environmentUrl = https://dashboards-library.onrender.com`

## Brent Live Proof

- Request payload: `{ "mode": "REVALIDATE", "seriesIds": ["wocaes0074"], "includeFallback": false, "diagnostics": { "enabled": true, "maxConcurrentMatrixVariants": 1 } }`
- Result on deployed `8b09a58fd7f2aac42dad431659d43e0be515e36a`:
  - `demoSafe = YES`
  - `reason = null`
  - `precompute.status = PASS`
  - `matrix.status = PASS`
  - `warmRehearsal.status = PASS`
  - `peakConcurrentRemoteReads = 12`
  - `precomputeCurrentMissesNonPit = 8`
  - `precomputeVerificationMissesNonPit = 8`
  - `matrixCurrentMissesNonPit = 0`
  - `matrixVerificationMissesNonPit = 0`
  - `matrixCurrentHitsNonPit = 8`
  - `matrixVerificationHitsNonPit = 8`
  - `pointInTimeEvaluationBegan = true`
  - `variantsCompletedBeforeTimeout = 12`
  - `pitFailCount = 0`
  - `pitMissingArtifactCount = 0`
  - `pitPrismaUnavailableCount = 0`
- Interpretation:
  - Brent no longer reproduces the prior PIT persisted-proof failure class.
  - The null-Prisma dependency defect is absent on the deployed revision.
  - PRECOMPUTE, MATRIX, and WARM_REHEARSAL all pass without changing the underlying matrix rules.

## Aluminium Live Proof

- Request payload: `{ "mode": "REVALIDATE", "seriesIds": ["lmeofalcashask"], "includeFallback": false, "diagnostics": { "enabled": true, "maxConcurrentMatrixVariants": 1 } }`
- Result on deployed `8b09a58fd7f2aac42dad431659d43e0be515e36a`:
  - `demoSafe = YES`
  - `reason = null`
  - `precompute.status = PASS`
  - `matrix.status = PASS`
  - `warmRehearsal.status = PASS`
  - `peakConcurrentRemoteReads = 12`
  - `precomputeCurrentMissesNonPit = 8`
  - `precomputeVerificationMissesNonPit = 8`
  - `matrixCurrentMissesNonPit = 0`
  - `matrixVerificationMissesNonPit = 0`
  - `matrixCurrentHitsNonPit = 8`
  - `matrixVerificationHitsNonPit = 8`
  - `pointInTimeEvaluationBegan = true`
  - `variantsCompletedBeforeTimeout = 12`
  - `pitFailCount = 0`
  - `pitMissingArtifactCount = 0`
  - `pitPrismaUnavailableCount = 0`
- Interpretation:
  - Aluminium matches Brent on the corrected deployed surface.
  - The prior POINT_IN_TIME `POSTGRES_ARTIFACT / MISSING_ARTIFACT` failure shape is removed.
  - The dashboard-only wiring corrective is sufficient for the targeted Stage 12 defect.

## Final Decision

- The dashboard-owned corrective is implemented, locally validated, pushed, redeployed, and live on exact source `8b09a58fd7f2aac42dad431659d43e0be515e36a`.
- Brent and Aluminium both now prove the intended Stage 12 outcome:
  - no artificial PIT Prisma-unavailable failures remain
  - no PIT missing-artifact failures remain on the certification matrix path
  - PRECOMPUTE, MATRIX, and WARM_REHEARSAL all pass on deployed `REVALIDATE`
- The audit-proven dependency-wiring defect is resolved without SG Runtime mutation, PIT regeneration, timeout changes, or MATRIX semantic changes.
- `RESULT = SUCCESS`
- `BRENT_FINAL_GATE = PASS`
- `ALUMINIUM_FINAL_GATE = PASS`
- `FULL_BENCHMARK_ACCEPTANCE = PASS`