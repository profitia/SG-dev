# PPF-1 Stage 10 Calibration Band Eligibility Evidence

TASK_ID = ppf-1-stage-10-calibration-band-eligibility-completion-20260911
SOURCE_BRANCH = ppf1/stage10-calibration-band-eligibility-20260911
SOURCE_SHA = 043505e0bdfa548cfaff64746750091c099c65ba
EVIDENCE_SOURCE_SHA = 043505e0bdfa548cfaff64746750091c099c65ba
GENERATED_AT = 2026-09-11T05:05:27.000Z
CLEAN_WORKTREE_REQUIRED = PASS
STAGE10_IMPLEMENTATION_DIRECTION = PASS
STAGE10_ADDITIONAL_SOURCE_CHANGE_REQUIRED = NO
UNPROVEN_OR_INCOMPATIBLE_CALIBRATION_NEVER_SERVES_BANDS = PASS
EXACT_IDENTITY_GATE = PASS
METHOD_ID_ISOLATION_GATE = PASS
METHOD_VERSION_ISOLATION_GATE = PASS
MODEL_ISOLATION_GATE = PASS
TARGET_SEMANTICS_ISOLATION_GATE = PASS
HORIZON_ISOLATION_GATE = PASS
SOURCE_REVISION_FAIL_CLOSED_GATE = PASS
MATURED_ONLY_RESIDUAL_GATE = PASS
MIN_CALIBRATION_SAMPLES_30_GATE = PASS
SAMPLE_BOUNDARY_29_30_31_GATE = PASS
COMPATIBLE_ONLY_SAMPLE_COUNT_GATE = PASS
CURRENT_WITHOUT_CALIBRATION_GATE = PASS
INLINE_HISTORICAL_CALIBRATION_REBUILD_GATE = PASS
INCREMENTAL_REUSE_GATE = PASS
CROSS_INSTANCE_NON_DUPLICATION_GATE = PASS
STAGE11_UNTOUCHED_GATE = PASS
OVERALL_STAGE10_ACCEPTANCE = PASS
TYPECHECK_CLASSIFICATION = BASELINE_FAIL_UNRELATED

## Scope

- Evidence is bound to the published Stage 10 source SHA only: `043505e0bdfa548cfaff64746750091c099c65ba`.
- The implementation surface is limited to SG Runtime rolling-daily current calibration band eligibility.
- No forecasting methodology math changed.
- `MIN_CALIBRATION_SAMPLES` remains `30`.
- Stage 11 consumer readiness and migration surfaces were not touched.

## Source Delta

- The production owner change remains in `apps/sg-runtime/lib/forecast/rolling-daily-production-forecast.ts`.
- Acceptance proof additions are limited to `apps/sg-runtime/tests/forecast-identity.test.ts`, `apps/sg-runtime/tests/forecast-capability-resolver.test.ts`, and `apps/sg-runtime/tests/rolling-daily-production-forecast.test.ts`.
- The production path now fail-closes coarse persisted calibration groups that cannot prove exact compatibility for Current Forecast serving.

## Validation Basis

- Focused Stage 10 proof suites passed `42/42`:
  `tests/forecast-identity.test.ts`
  `tests/forecast-capability-resolver.test.ts`
  `tests/rolling-daily-production-forecast.test.ts`
- Rolling-daily substrate non-regression passed `37/37`:
  `tests/forecast-calibration-lineage.test.ts`
  `tests/rolling-daily-maintenance.test.ts`
  `tests/rolling-daily-historical-admission.test.ts`
  `tests/rolling-daily-verification.test.ts`
  `tests/rolling-daily-production-operations.test.ts`
  `tests/rolling-daily-current-forecast-snapshot.test.ts`
  `tests/forecast-production-operations.test.ts`
- Db-backed Stage 3 and Stage 9 corrective cross-instance regression passed `36/36`:
  `tests/forecast-stage3-cross-instance.test.ts`
- `npm run typecheck` was executed and classified as `BASELINE_FAIL_UNRELATED`; the failures are in pre-existing typing issues outside the Stage 10 slice.

## Representative Proof

- Exact compatibility remains predicate-based, not scope-based.
- Current Forecast bands remain unavailable when calibration proof is missing, even if large coarse calibration inventories exist.
- Compatible-only sample counting is explicit at the `29/30/31` boundary.
- Current Forecast availability remains independent from prediction-band availability.
- Rolling-daily cross-instance execution still elects one authoritative owner and avoids duplicate compute.

## Non-Blocking Baseline

- The sg-runtime typecheck still fails in unrelated files outside this change set:
  `lib/forecast/prepared-state.ts`
  `lib/forecast/rolling-daily-verification.ts`
  `lib/forecast/service.ts`
  `scripts/run-forecast-stage7-evidence.ts`
  `scripts/run-forecast-stage8-bounded-historical.ts`
- These errors predate this Stage 10 publication slice and did not affect the executed Stage 10 acceptance suites.

## Final Decision

- The published Stage 10 source SHA is accepted.
- The Stage 10 calibration band eligibility contract now passes with explicit proof for exact identity isolation, compatible-only band sample thresholds, fail-closed serving, incremental reuse preservation, and cross-instance non-duplication.
- Publication is ready with separate evidence commit lineage bound to the exact source SHA.