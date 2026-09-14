# PPF-1 Stage 12 PRE-WARM MATRIX Fan-Out and Cache-Reuse Profiler

TASK_ID = ppf-1-stage-12-pre-warm-matrix-fanout-cache-reuse-profiler-20260914
GENERATED_AT = 2026-09-14T11:53:37.000Z
SCOPE = audit
UPSTREAM_IDENTITY_AUTHORITY = EXTERNAL_CHATGPT_PROMPT_AUTHORING_LAYER
NEW_CONVERSATION_ID = a619f3ef-7a76-4d9c-a747-c9f9a9917de4
VALIDATION_BRANCH = ppf1/stage12-live-acceptance-legacy-deprecation-20260911
EVIDENCE_BASELINE_COMMIT = 91174df504e05a93c8757d7ecc0cc4040b735d7d

## Deployment

- `DASHBOARD_DEPLOYED_SHA = b78ff87645c83f7c9eeebf7dbe21ed18eb94e2ee`
- `SG_RUNTIME_DEPLOYED_SHA = f7761cc3ee56dd474667b89132747910d67c2517`
- Accepted prior result preserved:
  - `WARM_REHEARSAL_CORRECTIVE_IMPLEMENTATION = PASS`
  - `SECOND_MATRIX_DUPLICATION_REMOVED = PASS`
  - `WARM_VERIFICATION_REREADS_REMOVED = PASS`
  - `SWITCHBACK_CACHE_IDENTITY_CORRECTED = PASS`

## Source Call Graph

- `MATRIX_CALL_GRAPH_MAPPED = PASS`
- `createDemoCertificationService().run(...)` performs:
  - `PRECOMPUTE` capability fan-out across all `4 models x 3 target bases = 12` variants
  - `MATRIX` by calling `matrixEvaluator(entry.seriesId, mode === 'CERTIFY', ...)`
  - `WARM_REHEARSAL` only after MATRIX returns
- `matrixEvaluator(...)` is created by `createMatrixEvaluator(...)`, which instantiates `createForecastAcceptanceMatrixService(...)` with dashboard wrappers for:
  - capability lookup
  - preparation lookup
  - Current read
  - Verification read
- `evaluateSeries(...)` inside the matrix service performs:
  - all non-PIT variants first through a single `Promise.all(...)`
  - then `beforePointInTimeEvaluation`
  - then PIT variants sequentially in a `for ... of` loop
- Per variant inside `evaluateSeries(...)`:
  - `evaluateCurrentCell(...)`
  - `Promise.all(DEFAULT_VERIFICATION_HORIZONS.map(...evaluateVerificationCell...))`
- `pointInTimeEvaluationBegan = false` is therefore explained by source ordering: PIT does not begin until all non-PIT variants finish.

## Cache Topology

- Certification-level caches in `demo-certification.ts`:
  - capability cache key: `seriesId::modelId::targetBasis`
  - preparation cache key: `seriesId::modelId::targetBasis`
  - Current read cache key: `seriesId::modelId::targetBasis::sourceFrequency::targetCadence`
  - Verification read cache key: `seriesId::modelId::targetBasis::sourceFrequency::targetCadence`
- MATRIX-local caches in `acceptance-matrix.ts`:
  - readiness cache key: `seriesId::modelId::targetBasis`
  - preparation cache key: `seriesId::modelId::targetBasis`
  - Current read cache key: `seriesId::modelId::targetBasis`
  - Verification read cache key: `seriesId::modelId::targetBasis`
- Cache reuse findings for this deployed `REVALIDATE` task:
  - `PRECOMPUTE_MATRIX_CAPABILITY_CACHE_SHARED = YES`
  - `PRECOMPUTE_MATRIX_CURRENT_CACHE_SHARED = NO`
  - `PRECOMPUTE_MATRIX_VERIFICATION_CACHE_SHARED = NO`
  - `MATRIX_LOCAL_CACHE_DUPLICATES_CERTIFICATION_CACHE = YES`
  - `MATRIX_LOCAL_CACHE_WORKS = YES`
  - `MATRIX_LOCAL_CACHE_SCOPE_TOO_NARROW = YES`
- Why:
  - PRECOMPUTE in `REVALIDATE` populates capability cache only.
  - MATRIX reuses those capability entries as `CACHE_REUSED`.
  - MATRIX still issues first Current and first Verification reads for each non-PIT variant because PRECOMPUTE did not populate those caches.
  - MATRIX-local caches prevent duplicate reads inside one matrix evaluation, but they are instantiated inside the matrix service and cannot carry data from earlier PRECOMPUTE work on their own.

## Identity Key Comparison

- Capability identity:
  - PRECOMPUTE key: `seriesId::modelId::targetBasis`
  - MATRIX capability key: `seriesId::modelId::targetBasis`
  - `CAPABILITY_KEY_MATCH_COUNT = 8` on the observed non-PIT MATRIX path before timeout
- Current identity:
  - PRECOMPUTE populated keys: none in this `REVALIDATE` flow
  - MATRIX key: `seriesId::modelId::targetBasis::sourceFrequency::targetCadence`
  - Observed MATRIX non-PIT keys all included cadence `DAILY::MONTHLY`
  - `CURRENT_CACHE_KEY_MATCH_COUNT = 0`
  - `CURRENT_CACHE_KEY_MISMATCH_COUNT = 8`
- Verification identity:
  - PRECOMPUTE populated keys: none in this `REVALIDATE` flow
  - MATRIX key: `seriesId::modelId::targetBasis::sourceFrequency::targetCadence`
  - Observed MATRIX non-PIT keys all included cadence `DAILY::MONTHLY`
  - `VERIFICATION_CACHE_KEY_MATCH_COUNT = 0`
  - `VERIFICATION_CACHE_KEY_MISMATCH_COUNT = 7`
- Persisted-proof identity:
  - non-PIT deployed path does not require local persisted proof
  - PIT did not begin
  - `PERSISTED_PROOF_KEY_MISMATCH_COUNT = 0`
- Observed Brent non-PIT MATRIX Current keys:
  - `wocaes0074::naive::MONTHLY_AVERAGE::DAILY::MONTHLY`
  - `wocaes0074::naive::END_OF_PERIOD::DAILY::MONTHLY`
  - `wocaes0074::damped_holt::MONTHLY_AVERAGE::DAILY::MONTHLY`
  - `wocaes0074::damped_holt::END_OF_PERIOD::DAILY::MONTHLY`
  - `wocaes0074::ets::MONTHLY_AVERAGE::DAILY::MONTHLY`
  - `wocaes0074::ets::END_OF_PERIOD::DAILY::MONTHLY`
  - `wocaes0074::arima::MONTHLY_AVERAGE::DAILY::MONTHLY`
  - `wocaes0074::arima::END_OF_PERIOD::DAILY::MONTHLY` was started and timed out before completion

## Brent MATRIX Operation Accounting

- `MATRIX_READ_CAPABILITY_COUNT = 8`
- `MATRIX_READ_CURRENT_COUNT = 7`
- `MATRIX_READ_VERIFICATION_COUNT = 7`
- `MATRIX_PERSISTED_CURRENT_PROOF_COUNT = 0`
- `MATRIX_PERSISTED_VERIFICATION_PROOF_COUNT = 0`
- `MATRIX_PREPARE_CURRENT_COUNT = 0`
- `MATRIX_CURRENT_HITS = 0`
- `MATRIX_CURRENT_MISSES = 7`
- `MATRIX_VERIFICATION_HITS = 0`
- `MATRIX_VERIFICATION_MISSES = 7`
- Capability reuse detail:
  - all 8 MATRIX capability lookups were `cacheStatus = hit`
  - total MATRIX capability remote time = `0ms`
- Direct implication:
  - the timeout is not caused by MATRIX capability fan-out
  - it is caused by serial non-PIT Current and Verification rereads after PRECOMPUTE

## PRECOMPUTE To MATRIX Overlap

- Brent PRECOMPUTE remote operations in `REVALIDATE`:
  - `READ_CAPABILITY x 12`
  - `READ_CURRENT x 0`
  - `READ_VERIFICATION x 0`
  - `PREPARE_CURRENT x 0`
- Observed overlap:
  - `PRECOMPUTE_MATRIX_CAPABILITY_KEY_OVERLAP = 8`
  - `PRECOMPUTE_MATRIX_CURRENT_KEY_OVERLAP = 0`
  - `PRECOMPUTE_MATRIX_VERIFICATION_KEY_OVERLAP = 0`
  - `OVERLAPPING_CURRENT_KEYS_REREAD_REMOTELY = 0`
  - `OVERLAPPING_VERIFICATION_KEYS_REREAD_REMOTELY = 0`
- Explanation:
  - overlap is zero for Current and Verification because PRECOMPUTE never populated those key spaces in `REVALIDATE`.
  - MATRIX therefore performs first remote Current and Verification reads itself even when capability already proves readiness.

## Brent Variant Timeline

- `VARIANTS_COMPLETED_BEFORE_TIMEOUT = 7`
- `VARIANTS_ACTIVE_AT_TIMEOUT = ["arima::END_OF_PERIOD"]`
- `VARIANTS_NOT_STARTED_AT_TIMEOUT = ["naive::POINT_IN_TIME", "damped_holt::POINT_IN_TIME", "ets::POINT_IN_TIME", "arima::POINT_IN_TIME"]`
- Completed non-PIT sequence:
  - `naive::MONTHLY_AVERAGE`
  - `naive::END_OF_PERIOD`
  - `damped_holt::MONTHLY_AVERAGE`
  - `damped_holt::END_OF_PERIOD`
  - `ets::MONTHLY_AVERAGE`
  - `ets::END_OF_PERIOD`
  - `arima::MONTHLY_AVERAGE`
- Active at timeout:
  - `arima::END_OF_PERIOD` during `READ_CURRENT`
- Root scheduling observation:
  - all 8 non-PIT variants were scheduled at MATRIX start
  - only one variant ran at a time
  - PIT variants were blocked behind the non-PIT completion barrier and never started

## Brent Concurrency And Timing

- `PRECOMPUTE_ELAPSED_MS = 20986`
- `BUDGET_REMAINING_AT_MATRIX_START_MS = 54014`
- `MATRIX_ELAPSED_BEFORE_ABORT_MS = 54073`
- `MATRIX_CURRENT_P50_MS = 3369`
- `MATRIX_CURRENT_P95_MS = 3630`
- `MATRIX_VERIFICATION_P50_MS = 4176`
- `MATRIX_VERIFICATION_P95_MS = 4549`
- `MATRIX_QUEUE_WAIT_TOTAL_MS = 0`
- `MATRIX_REMOTE_ELAPSED_TOTAL_MS = 52053`
- Matrix concurrency facts:
  - `peakVariantConcurrency = 1`
  - `maxConcurrentVariants = 1`
  - `peakConcurrentRemoteReads = 12` comes from PRECOMPUTE capability fan-out, not from simultaneous MATRIX variants
- Budget at Brent non-PIT dispatch points:
  - `naive::MONTHLY_AVERAGE current` -> `54013ms`
  - `naive::END_OF_PERIOD current` -> `46695ms`
  - `damped_holt::MONTHLY_AVERAGE current` -> `39471ms`
  - `damped_holt::END_OF_PERIOD current` -> `32540ms`
  - `ets::MONTHLY_AVERAGE current` -> `24954ms`
  - `ets::END_OF_PERIOD current` -> `17147ms`
  - `arima::MONTHLY_AVERAGE current` -> `9630ms`
  - `arima::END_OF_PERIOD current` timed out before dispatch metadata was finalized

## Budget Analysis

- `MATRIX_ISOLATED_COMPLETES_WITHIN_75S = NO`
- Reasoning:
  - Brent non-PIT MATRIX already spent `52053ms` of remote Current plus Verification time across 7 completed variants.
  - the 8th non-PIT Current read was still active at timeout.
  - PIT had not even begun.
  - removing PRECOMPUTE would restore roughly `20986ms`, but MATRIX would still need the unfinished 8th non-PIT path plus all 4 PIT variants.
  - therefore a full 12-variant MATRIX pass still does not fit cleanly inside `75000ms` without reducing redundant read cost.

## Persisted Proof Cost

- `CURRENT_PERSISTED_PROOF_MS = 0` on the observed non-PIT Brent path
- `VERIFICATION_PERSISTED_PROOF_MS = 0` on the observed non-PIT Brent path
- `PERSISTED_PROOF_IS_PRIMARY_COST = NO`
- Why:
  - deployed dashboard source requires local persisted-proof checks only for PIT or non-deployed environments
  - Brent timed out before PIT began
  - persisted-proof lookups therefore were not part of the observed timeout path

## Why PIT Never Started

- `POINT_IN_TIME_EVALUATION_BEGAN = NO`
- `PIT_NOT_STARTED_ROOT_CAUSE = Non-PIT completion barrier exhausted the benchmark budget before beforePointInTimeEvaluation and the PIT loop could start.`

## Aluminium Confirmation

- `ALUMINIUM_MATRIX_ROOT_CAUSE_MATCHES_BRENT = YES`
- Matching signals:
  - `PRECOMPUTE_ELAPSED_MS ≈ 21000`
  - `peakConcurrentRemoteReads = 12`
  - `peakVariantConcurrency = 1`
  - `variantsCompletedBeforeTimeout = 7`
  - `pointInTimeEvaluationBegan = false`
  - timeout remained in non-PIT `arima::END_OF_PERIOD`
- Aluminium timing distribution:
  - `MATRIX_CURRENT_P50_MS = 3140`
  - `MATRIX_CURRENT_P95_MS = 3453`
  - `MATRIX_VERIFICATION_P50_MS = 3630`
  - `MATRIX_VERIFICATION_P95_MS = 4083`
- Delta from Brent:
  - Aluminium reached the final variant's Verification step before timing out.
  - Brent timed out slightly earlier during the final variant's Current step.
  - This changes the last observed request, not the structural cause.

## Compute Safety

- `PREPARE_CURRENT_COUNT = 0`
- `PREPARE_VERIFICATION_COUNT = 0`
- `MODEL_FIT_COUNT = 0`
- `PIT_MATERIALIZATION_COUNT = 0`
- `HISTORICAL_COMPUTE_COUNT = 0`
- `DUPLICATE_FORECAST_COMPUTE = 0`

## Root Cause Classification

- `ROOT_CAUSE = CUMULATIVE_BUDGET_EXHAUSTION`
- Supporting proof:
  - PRECOMPUTE consumes about `21s` on a 12-request capability fan-out.
  - MATRIX then runs non-PIT variants effectively serially with `peakVariantConcurrency = 1`.
  - capability is reused successfully, so capability mismatch is not the blocker.
  - Current and Verification cache sharing across PRECOMPUTE and MATRIX is absent in `REVALIDATE`, so MATRIX must perform first remote Current and Verification reads for each non-PIT variant.
  - those reads are not unusually slow relative to direct baselines; they simply add up to more than the remaining benchmark budget before PIT can begin.

## Recommended Smallest Corrective

- `RECOMMENDED_MATRIX_CORRECTIVE = Inject one shared cadence-aware Current/Verification read cache across PRECOMPUTE and MATRIX in REVALIDATE so MATRIX can reuse already-authoritative non-PIT read results instead of paying fresh serial remote reads for each variant while preserving matrix cell evaluation semantics.`
- `READY_FOR_MATRIX_CORRECTIVE = YES`
- Forbidden directions remain excluded:
  - no timeout increase
  - no SG Runtime change
  - no forecast-math change
  - no readiness weakening

## PMOS Closeout Status

- Canonical execution-handoff input prepared successfully for `ppf-1-stage-12-pre-warm-matrix-fanout-cache-reuse-profiler-20260914`.
- `npm run pmos:save -- --bootstrap-input .pmos/recovery/bootstrap-inputs/2026-09-14_ppf-1-stage-12-pre-warm-matrix-fanout-cache-reuse-profiler-20260914.json` -> `SUCCEEDED`
- Persisted PMOS conversation: `2026-09-14-13:55_ppf-1-stage-12-pre-warm-matrix-fanout-cache-reuse-profiler-20260914`
- Persisted closeout evidence:
  - `CLOSEOUT_STATE = CLOSEOUT_COMPLETE`
  - `PMOS_SAVE = SUCCEEDED`
  - `ARCHIVE_COMPLETENESS = PASS`
  - `EXECUTION_TRAIL_STATUS = PRESENT`
  - `HANDOFF_PUBLICATION_STATUS = SUCCEEDED`
  - `VECTOR_REBUILD_STATUS = SUCCEEDED`
  - `RUNTIME_CONTEXT_INTEGRITY = PASS`
- `npm run pmos:verify-runtime` -> `PASS`
- `PENDING_SLOT_FINAL = CLEAR`

## Final

- `MATRIX_PROFILER = PASS`
- `WARM_REHEARSAL_CORRECTIVE_FULL_LIVE_ACCEPTANCE = NOT_PROVEN`
- `READY_FOR_COPPER_FRESHNESS_REPAIR = NO`
- `PRE_DEPRECATION_ACCEPTANCE = BLOCKED`
- `LEGACY_DEPRECATION_ALLOWED = NO`