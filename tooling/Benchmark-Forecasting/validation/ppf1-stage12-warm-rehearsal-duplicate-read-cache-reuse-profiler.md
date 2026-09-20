# PPF-1 Stage 12 Warm Rehearsal Duplicate Read Cache Reuse Profiler

TASK_ID = ppf-1-stage-12-warm-rehearsal-duplicate-read-cache-reuse-profiler-20260914
GENERATED_AT = 2026-09-14T07:02:44.045Z
VALIDATION_BRANCH = ppf1/stage12-live-acceptance-legacy-deprecation-20260911
DASHBOARD_DEPLOYED_SHA = 7e87d2fad1c20c1e4ca20a742b2809e06b40ea86
SG_RUNTIME_DEPLOYED_SHA = f7761cc3ee56dd474667b89132747910d67c2517
PRODUCT_SOURCE_MUTATION = NO
LIVE_PROFILE_MODE = REVALIDATE
PROFILE_SCOPE = COPPER_ONLY
ROOT_CAUSE = AVOIDABLE_WARM_REREADS
INTENT_IMPLEMENTATION_MISMATCH = PROVEN
SECOND_MATRIX_DUPLICATION = PROVEN
CACHE_SCOPE_BUG = PROVEN
AVOIDABLE_REMOTE_REREADS = PROVEN
PRECOMPUTE_MATRIX_AUTHORITY_PARITY = PASS
WARM_REHEARSAL_TIMEOUT_ROOT_CAUSE = PASS
PRODUCTION_FIX_IMPLEMENTED = NO

## Scope

- This artifact is profiler-only evidence for the remaining Stage 12 WARM_REHEARSAL timeout after the exact PRECOMPUTE authority corrective was deployed live.
- No product source files were modified during this profiling pass.
- The profiled live release is dashboard `7e87d2fad1c20c1e4ca20a742b2809e06b40ea86` against SG Runtime `f7761cc3ee56dd474667b89132747910d67c2517`.

## Executive Result

- The active timeout is not caused by PRECOMPUTE/MATRIX authority mismatch anymore.
- The timed-out live Copper-only `REVALIDATE` run spent `20112ms` in `PRECOMPUTE`, `40786ms` in `MATRIX`, and only `14112ms` of remaining budget in `WARM_REHEARSAL` before the benchmark hit `75000ms`.
- WARM partially reuses certification caches, but still performs avoidable remote rereads because the warm preread loop asks for artifacts that MATRIX did not populate under the same keys and because `switchBack` performs a separate cadence-less current reread before the second matrix call.
- A second matrix pass is present in source, but the saved timed-out live run never reached a second matrix capability pass. The measured blocker in that live run is the preread layer plus `switchBack`, not matrix work after it.

## Live Copper-Only REVALIDATE Evidence

- Benchmark timeout: `75000ms`
- Live phase timings:
  - `PRECOMPUTE_MS = 20112`
  - `MATRIX_MS = 40786`
  - `WARM_ELAPSED_BEFORE_TIMEOUT_MS = 14112`
- Timeout snapshot:
  - active phase: `WARM_REHEARSAL`
  - active operation: `READ_CURRENT`
  - active key: `lmeofcucashask:naive:MONTHLY_AVERAGE:none:none`
  - active cache status: `miss`
  - active elapsed at timeout: `2949ms`
- WARM remote request totals from the saved live payload:
  - `READ_CAPABILITY`: `12 hit`, `0 miss`
  - `READ_CURRENT`: `8 hit`, `4 miss`
  - `READ_VERIFICATION`: `7 hit`, `5 miss`
  - `PREPARE_CURRENT`: `0`
- Total WARM remote events recorded before timeout: `36`
- Aggregate WARM timing decomposition from the payload:
  - `warmElapsedMs = 14112`
  - `batchSpanMs = 11164`
  - `remoteElapsedCompletedMs = 74214`
  - `queueWaitCompletedMs = 0`
  - `remoteElapsedActiveMs = 2949`
  - `localOverheadMs = 0`

## Overlap And Miss Pattern

- Capability overlap between MATRIX and WARM is `100%`.
- Current-read overlap is `100%` for MATRIX keys, with four WARM-only extra current identities:
  - `naive / POINT_IN_TIME`
  - `damped_holt / POINT_IN_TIME`
  - `ets / POINT_IN_TIME`
  - `arima / POINT_IN_TIME`
- Verification-read overlap is `100%` for MATRIX keys, with five WARM-only extra verification identities:
  - `naive / MONTHLY_AVERAGE`
  - `ets / MONTHLY_AVERAGE`
  - `ets / END_OF_PERIOD`
  - `arima / MONTHLY_AVERAGE`
  - `arima / END_OF_PERIOD`
- The current WARM misses are therefore structural, not random cache churn.

## Source-Level Proof

- `runWarmRehearsal(...)` first builds all 12 required model/target-basis inputs, reads capability for each, and then reads current plus verification for each input inside `Promise.all(...)`.
- After those prereads, `runWarmRehearsal(...)` performs a separate `switchBack` current reread for the first input without passing cadence.
- Only after the `switchBack` reread does `runWarmRehearsal(...)` call `dependencies.evaluateMatrix(entry.seriesId, false, options)` for a fresh warm matrix pass.
- The acceptance matrix owns its own internal `currentReadCache` and `verificationReadCache` and uses `readPointInTimeCurrent(...)` for `POINT_IN_TIME` reads instead of the non-PIT current read path.
- In the deployed certification service, cross-phase caches are keyed by `seriesId + modelId + targetBasis + sourceFrequency + targetCadence`, while the `switchBack` reread uses `readCurrent(firstInput.seriesId, firstInput.modelId, firstInput.targetBasis)` with no cadence, producing a distinct cache identity.

## Control Experiments

- Structure-level warm harness using the observed live miss set:
  - `OBSERVED_WARM_CURRENT_STRUCTURE_MS = 14512`
  - This matches the live `14112ms` timeout slice closely enough to treat the preread set plus `switchBack` as the active cost center.
- Minimal proof control with the same warm structure but no rereads and no `switchBack`:
  - `WARM_MINIMAL_PROOF_MS = 0`
  - This is a lower bound proving the remaining warm cost is not inherent to the certification phase name itself.
- Corrected second-matrix harness with mocked persisted-artifact proof:
  - `SECOND_MATRIX_DEFAULT_MS = 19554`
  - `SECOND_MATRIX_WITH_SHARED_PIT_CACHE_MS = 1`
  - Interpretation: a fresh matrix pass becomes expensive only when it must perform the four `POINT_IN_TIME` current reads itself. Once those PIT reads are already populated under reusable keys, the same matrix path collapses to effectively zero additional time on the current live readiness state.
- Forced shared-cache warm structure control:
  - `WARM_WITH_SHARED_CACHE_MS = 0`
  - This is the lower bound for the current warm structure if the missing PIT current keys, the five extra monthly verification keys, and the cadence-less `switchBack` reread are eliminated from the remote path.

## Exact Live Capability State At Profile Time

- Copper exact capability was fully current-ready on all 12 variants.
- Copper exact capability remained verification-stale on five monthly variants:
  - `naive / MONTHLY_AVERAGE`
  - `ets / MONTHLY_AVERAGE`
  - `ets / END_OF_PERIOD`
  - `arima / MONTHLY_AVERAGE`
  - `arima / END_OF_PERIOD`
- All five stale variants still reported `fullVerificationReadiness = READY`, which is why the exact PRECOMPUTE gate now passes while WARM still spends time rereading verification payloads for variants MATRIX did not fully materialize.

## Root-Cause Classification

- `ROOT_CAUSE = AVOIDABLE_WARM_REREADS`
- `INTENT_IMPLEMENTATION_MISMATCH = PROVEN`
- `SECOND_MATRIX_DUPLICATION = PROVEN`
  - Source always calls a fresh matrix after prereads and `switchBack`.
  - The saved timed-out live run did not yet show a second matrix capability pass, so the timeout happened before that later work became material.
- `CACHE_SCOPE_BUG = PROVEN`
  - Certification-scope caches exist, but WARM still misses because later reads require identities not populated by MATRIX and because `switchBack` uses a cadence-less key.
- `AVOIDABLE_REMOTE_REREADS = PROVEN`
  - Four PIT current misses and five monthly verification misses are exactly the avoidable miss set captured in the live payload.

## Recommended Corrective Scope

- Keep any future fix inside `apps/dashboard-preview/lib/benchmark-forecast/demo-certification.ts` and the nearby acceptance-matrix seam.
- Do not widen into SG Runtime, forecasting mathematics, model fitting, queue architecture, or timeout-budget inflation.
- The bounded repair target is the WARM reread layer:
  - either remove the unconditional preread plus second-matrix duplication,
  - or align WARM to reuse the already-proven matrix evidence under the same cache identities,
  - and eliminate the cadence-less `switchBack` reread or route it through the same keyed cache.
- No production fix was implemented in this task.