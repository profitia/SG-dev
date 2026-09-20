# PPF-1 Stage 12 PRECOMPUTE MATRIX Shared Read Cache Corrective

TASK_ID = ppf-1-stage-12-precompute-matrix-shared-read-cache-corrective-20260914
GENERATED_AT = 2026-09-14T13:11:33.000Z
SCOPE = implementation
VALIDATION_BRANCH = ppf1/stage12-live-acceptance-legacy-deprecation-20260911
INITIAL_SOURCE_SHA = 4b3a5442fb5fc24f44676a9d8062f2f62fe8eed9
FINAL_SOURCE_SHA = db177e4931b9ce7247393b40448c11811bdc51cc
DASHBOARD_DEPLOYED_SHA = db177e4931b9ce7247393b40448c11811bdc51cc
SG_RUNTIME_DEPLOYED_SHA = f7761cc3ee56dd474667b89132747910d67c2517
INITIAL_SOURCE_COMMIT = fix(stage12): share precompute matrix read cache
FINAL_SOURCE_COMMIT = fix(stage12): sequence revalidate cache warmup
INITIAL_DEPLOY_ID = dep-dajutmad0e5s73dr49dg
FINAL_DEPLOY_ID = dep-dajv1vmk1f9s739ho6ug
PRODUCT_OWNER = apps/dashboard-preview
SG_RUNTIME_MUTATED = NO
PIT_PREWARM_INTRODUCED = NO
MATRIX_NON_PIT_REMOTE_MISSES_AFTER_FIX = 0
PRECOMPUTE_MATRIX_SHARED_READ_CACHE_PROOF = PASS
PRECOMPUTE_TIMEOUT_REGRESSION = RESOLVED
BRENT_CACHE_REUSE_GATE = PASS
ALUMINIUM_CACHE_REUSE_GATE = PASS
FULL_BENCHMARK_ACCEPTANCE = PARTIAL
RESULT = PARTIAL_SUCCESS

## Scope

- This task implemented the smallest dashboard-owned corrective that makes `REVALIDATE` PRECOMPUTE warm the same shared cadence-aware Current and Verification cache entries later reused by MATRIX.
- No SG Runtime source file was modified.
- No timeout value, MATRIX acceptance rule, or point-in-time behavior was changed.
- The final deployed dashboard host validated here is `https://dashboards-library.onrender.com` at exact source `db177e4931b9ce7247393b40448c11811bdc51cc`.

## Source Delta

- Modified `apps/dashboard-preview/lib/benchmark-forecast/demo-certification.ts`.
- Modified `apps/dashboard-preview/tests/demo-certification.test.ts`.
- First source commit `4b3a5442fb5fc24f44676a9d8062f2f62fe8eed9` added shared non-point-in-time PRECOMPUTE warm-up through the existing certification-level read caches.
- First live deploy proved the cache identity change was correct but still too concurrent because PRECOMPUTE dispatched all non-point-in-time current warm-ups at once.
- Final source commit `db177e4931b9ce7247393b40448c11811bdc51cc` kept the same shared-cache design but sequenced warm-up by variant while preserving paired Current and Verification warm-up inside each variant.
- Functional change in final state:
  - `REVALIDATE` capability checks remain unchanged as the readiness gate.
  - For lawful, required, warm-ready, non-point-in-time variants, PRECOMPUTE now warms `readCurrentOnce(...)` and `readVerificationOnce(...)` under the exact cadence-aware identity later consumed by MATRIX.
  - Warm-up iterates variants sequentially to avoid the live PRECOMPUTE fan-out that exhausted remote budget before MATRIX.
  - Point-in-time current reads are not prewarmed.
  - MATRIX semantics remain unchanged.

## Local Validation

- `node --import tsx --test tests/demo-certification.test.ts` -> `39/39 PASS`
- `npm run typecheck` in `apps/dashboard-preview` -> `PASS`
- Regression coverage now proves:
  - PRECOMPUTE warms exact non-point-in-time Current and Verification identities later reused by MATRIX.
  - MATRIX non-point-in-time remote misses drop to zero in the built-in matrix test path.
  - Cadence-derived identity is preserved.
  - Rejected warm-up promises are evicted and retried cleanly.
  - Point-in-time reads remain outside the PRECOMPUTE warm-up path.
- A local direct runtime profiler was not completed because the worktree shell lacked `SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN`; live public-route proof was used instead.

## Initial Live Failure On First Commit

- Exact dashboard deploy for initial source `4b3a5442fb5fc24f44676a9d8062f2f62fe8eed9` succeeded as `dep-dajutmad0e5s73dr49dg`.
- Brent-only deployed `REVALIDATE` proved the first hypothesis was incomplete:
  - `releaseSnapshot.deployedRevision = 4b3a5442fb5fc24f44676a9d8062f2f62fe8eed9`
  - `demoSafe = NO`
  - `reason = ENVIRONMENT_NOT_READY`
  - `precompute.status = FAIL`
  - `matrixStarted = false`
  - `peakConcurrentRemoteReads = 16`
  - `precomputeCurrentReadsNonPit = 4`
  - `precomputeVerificationReadsNonPit = 0`
  - first timeout occurred in `PRECOMPUTE / READ_CURRENT / naive / MONTHLY_AVERAGE`
- Interpretation:
  - shared cache identity was present,
  - but the first implementation still over-dispatched PRECOMPUTE remote reads,
  - so Brent failed before MATRIX could consume the warmed entries.

## Final Exact Deploy Truth

- Source branch remained `ppf1/stage12-live-acceptance-legacy-deprecation-20260911`.
- Final source commit `db177e4931b9ce7247393b40448c11811bdc51cc` was pushed and matched remote HEAD.
- Dashboard service `dashboards-library` was manually redeployed on Render from exact source `db177e4931b9ce7247393b40448c11811bdc51cc`.
- Provider truth for dashboard: deploy id `dep-dajv1vmk1f9s739ho6ug`, status `Deploy succeeded`, source `db177e4`, service live.
- Public route diagnostics reported:
  - `sourceRevision = db177e4931b9ce7247393b40448c11811bdc51cc`
  - `deployedRevision = db177e4931b9ce7247393b40448c11811bdc51cc`
  - `environment = render`
  - `environmentUrl = https://dashboards-library.onrender.com`
- Public host health remained good: `https://dashboards-library.onrender.com/` responded with HTTP redirect to locale route from Render origin.

## Brent Live Cache-Reuse Proof

- Request payload: `{ "mode": "REVALIDATE", "seriesIds": ["wocaes0074"], "includeFallback": false, "diagnostics": { "enabled": true, "maxConcurrentMatrixVariants": 1 } }`
- Result on deployed `db177e4931b9ce7247393b40448c11811bdc51cc`:
  - `demoSafe = NO`
  - `reason = REREAD_FAIL`
  - `precompute.status = PASS`
  - `matrix.status = FAIL`
  - `warmRehearsal.status = FAIL`
  - `peakConcurrentRemoteReads = 12`
  - `precomputeCurrentMissesNonPit = 8`
  - `precomputeVerificationMissesNonPit = 8`
  - `matrixCurrentMissesNonPit = 0`
  - `matrixVerificationMissesNonPit = 0`
  - `matrixCurrentHitsNonPit = 8`
  - `matrixVerificationHitsNonPit = 8`
  - `pointInTimeEvaluationBegan = true`
  - `variantsCompletedBeforeTimeout = 12`
  - `firstTimeout = null`
- Interpretation:
  - PRECOMPUTE completed successfully.
  - All non-point-in-time Current and Verification reads later needed by MATRIX were paid during PRECOMPUTE and then reused from shared cache inside MATRIX.
  - The prior pre-MATRIX timeout regression is resolved for Brent.
  - The remaining Brent outcome is a truthful reread failure, not an environment timeout caused by missed cache reuse.

## Aluminium Live Cache-Reuse Proof

- Request payload: `{ "mode": "REVALIDATE", "seriesIds": ["lmeofalcashask"], "includeFallback": false, "diagnostics": { "enabled": true, "maxConcurrentMatrixVariants": 1 } }`
- Result on deployed `db177e4931b9ce7247393b40448c11811bdc51cc`:
  - `demoSafe = NO`
  - `reason = REREAD_FAIL`
  - `precompute.status = PASS`
  - `matrix.status = FAIL`
  - `warmRehearsal.status = FAIL`
  - `peakConcurrentRemoteReads = 12`
  - `precomputeCurrentMissesNonPit = 8`
  - `precomputeVerificationMissesNonPit = 8`
  - `matrixCurrentMissesNonPit = 0`
  - `matrixVerificationMissesNonPit = 0`
  - `matrixCurrentHitsNonPit = 8`
  - `matrixVerificationHitsNonPit = 8`
  - `pointInTimeEvaluationBegan = true`
  - `variantsCompletedBeforeTimeout = 12`
  - `firstTimeout = null`
- Interpretation:
  - Aluminium matches Brent on the targeted proof surface.
  - The PRECOMPUTE to MATRIX shared non-point-in-time cache reuse is active on the final deployed revision.
  - The prior pre-MATRIX timeout regression is resolved for Aluminium as well.

## Final Decision

- The dashboard-owned corrective is implemented, locally validated, pushed, redeployed, and live on exact source `db177e4931b9ce7247393b40448c11811bdc51cc`.
- Brent and Aluminium both now prove the intended Stage 12 corrective behavior:
  - PRECOMPUTE warms exact cadence-aware non-point-in-time Current and Verification entries.
  - MATRIX reuses those entries with zero non-point-in-time remote misses.
  - Point-in-time evaluation begins and all 12 variants complete without the earlier timeout.
- The targeted pre-MATRIX timeout regression is therefore resolved.
- Both live benchmarks still finish fail-closed with `REREAD_FAIL`, so this task does not upgrade full benchmark certification to pass.
- `RESULT = PARTIAL_SUCCESS`
- `PRECOMPUTE_MATRIX_SHARED_READ_CACHE_PROOF = PASS`
- `BRENT_CACHE_REUSE_GATE = PASS`
- `ALUMINIUM_CACHE_REUSE_GATE = PASS`
- `FULL_BENCHMARK_ACCEPTANCE = PARTIAL`
- `READY_FOR_LEGACY_DEPRECATION = NO`
