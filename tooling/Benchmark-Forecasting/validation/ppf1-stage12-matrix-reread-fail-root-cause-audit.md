# PPF-1 Stage 12 MATRIX Fail-Cell / REREAD_FAIL Root-Cause Audit

TASK_ID = ppf-1-stage-12-matrix-reread-fail-root-cause-audit-20260914
GENERATED_AT = 2026-09-14T14:27:51.000Z
SCOPE = audit
UPSTREAM_IDENTITY_AUTHORITY = EXTERNAL_CHATGPT_PROMPT_AUTHORING_LAYER
NEW_CONVERSATION_ID = 7f2e9d6a-1c84-4d79-93a6-2b7f0c4e8a51
VALIDATION_BRANCH = ppf1/stage12-live-acceptance-legacy-deprecation-20260911
REMOTE_HEAD = 3c714e34946b89f086d822d32b5e197e36ad2e63
EVIDENCE_HEAD = 3c714e34946b89f086d822d32b5e197e36ad2e63
DASHBOARD_DEPLOYED_SHA = db177e4931b9ce7247393b40448c11811bdc51cc
SG_RUNTIME_DEPLOYED_SHA = f7761cc3ee56dd474667b89132747910d67c2517
REREAD_FAIL_IS_MATRIX_DERIVED = YES
INDEPENDENT_REREAD_OPERATION_EXISTS = NO
REREAD_FAIL_LABEL_SEMANTICALLY_PRECISE = NO
WARM_FAILURE_IS_DOWNSTREAM_OF_MATRIX = YES
ROOT_CAUSE = OTHER
CORRECTIVE_OWNER = DASHBOARD_PREVIEW
READY_FOR_CORRECTIVE = YES

## Scope

- This task is diagnosis only.
- No product source file was modified before evidence publication.
- No SG Runtime change was made.
- No Copper repair was performed.
- No cache architecture, timeout, forecasting methodology, readiness rule, or MATRIX semantics were changed.

## Source Truth

- `REREAD_FAIL` is not an independently measured phase.
- In `apps/dashboard-preview/lib/benchmark-forecast/demo-certification.ts` the `reread` gate is defined directly from `matrix.status` and `matrix.failingReasons`.
- `resolveDemoSafeReason(...)` then returns `REREAD_FAIL` immediately when `reread.status === 'FAIL'`.
- There is no separate benchmark-level reread phase outside this label.
- The only later read activity is `WARM_REHEARSAL`, which is a distinct stage and not the source of the `reread` label.

## Primary Root-Cause Finding

- The remaining Brent and Aluminium failures are not caused by missing PIT data in the deployed dashboard routes.
- Public deployed PIT routes on `https://dashboards-library.onrender.com` return `AVAILABLE` for Current and `AVAILABLE` for Verification across all four models on both Brent and Aluminium.
- All four PIT verification horizons (`1M`, `3M`, `6M`, `12M`) are present for both series on all four models.
- The live matrix still fails exactly the 20 PIT-required cells because the certification service defaults `getMatrixPrisma` to `() => null` in `createDemoCertificationService(...)`.
- `acceptance-matrix.ts` requires persisted proof for all `POINT_IN_TIME` cells and fails with `POSTGRES_ARTIFACT / MISSING_ARTIFACT` when `getPrisma()` returns null, before any PIT canonical read identity or fingerprint can be bound into the matrix cell.
- This is therefore a dashboard-owned dependency-wiring defect in certification matrix evaluation, not a PIT data absence, not a cache-reuse issue, and not an SG Runtime defect.

## Brent Live Result

- Deployed request: `POST /api/benchmark-forecast/demo-certification`
- Payload: `{ "mode": "REVALIDATE", "seriesIds": ["wocaes0074"], "includeFallback": false, "diagnostics": { "enabled": true, "maxConcurrentMatrixVariants": 1 } }`
- Result:
  - `demoSafe = NO`
  - `reason = REREAD_FAIL`
  - `precompute.status = PASS`
  - `matrix.status = FAIL`
  - `warmRehearsal.status = FAIL`
  - `reread.status = FAIL`
  - `reread.reason = MISSING_ARTIFACT`
- Matrix summary:
  - `BRENT_REQUIRED_CURRENT_CELL_COUNT = 12`
  - `BRENT_REQUIRED_CURRENT_FAIL_COUNT = 4`
  - `BRENT_REQUIRED_VERIFICATION_CELL_COUNT = 48`
  - `BRENT_REQUIRED_VERIFICATION_FAIL_COUNT = 16`
  - `BRENT_NON_PIT_FAIL_COUNT = 0`
  - `BRENT_PIT_FAIL_COUNT = 20`
  - `BRENT_FAILURE_DOMAIN = BOTH`
  - `BRENT_REASON_CODE_COUNTS = { MISSING_ARTIFACT: 20 }`
  - layer counts = `{ POSTGRES_ARTIFACT: 20 }`

## Brent Failing Cells

Current failures:
- `naive / POINT_IN_TIME / CURRENT / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `damped_holt / POINT_IN_TIME / CURRENT / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `ets / POINT_IN_TIME / CURRENT / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `arima / POINT_IN_TIME / CURRENT / POSTGRES_ARTIFACT / MISSING_ARTIFACT`

Verification failures:
- `naive / POINT_IN_TIME / 1M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `naive / POINT_IN_TIME / 3M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `naive / POINT_IN_TIME / 6M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `naive / POINT_IN_TIME / 12M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `damped_holt / POINT_IN_TIME / 1M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `damped_holt / POINT_IN_TIME / 3M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `damped_holt / POINT_IN_TIME / 6M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `damped_holt / POINT_IN_TIME / 12M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `ets / POINT_IN_TIME / 1M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `ets / POINT_IN_TIME / 3M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `ets / POINT_IN_TIME / 6M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `ets / POINT_IN_TIME / 12M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `arima / POINT_IN_TIME / 1M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `arima / POINT_IN_TIME / 3M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `arima / POINT_IN_TIME / 6M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`
- `arima / POINT_IN_TIME / 12M / POSTGRES_ARTIFACT / MISSING_ARTIFACT`

All Brent fail-cell diagnostics are identical:
- `diagnostic = Market-data Prisma client is unavailable.`

## Readiness Comparison

- For every Brent failing PIT variant, deployed capability truth returns:
  - `CAPABILITY_STATUS = AVAILABLE`
  - `CURRENT_READINESS = READY`
  - `VERIFICATION_READINESS = READY`
  - `FULL_VERIFICATION_READINESS = READY`
- For those same variants, deployed public PIT current and verification routes return `AVAILABLE`.
- Therefore `CONSISTENT_WITH_CAPABILITY = NO` for all Brent failing PIT variants.
- The disagreement is not between capability and PIT data.
- The disagreement is between the matrix persisted-proof dependency wiring and the deployed dashboard consumer routes that already have access to PIT data.

## PIT Artifact State

Brent point-in-time current route proof:
- all four models return `status = AVAILABLE`
- current history fingerprint is present on all four models
- Brent PIT current fingerprint: `f141dff21e828a2887b55946ab4e49d28dbbedbe698c1b08c9ffdf3af912ba54`

Brent point-in-time verification route proof:
- all four models return `status = AVAILABLE`
- horizons present on all four models: `1M`, `3M`, `6M`, `12M`
- Brent PIT verification fingerprint is present on all four models
- Brent PIT verification fingerprint: `65cd369878e332ad93637bf46aa5530f0235e4bac4f47693916167ded900f5e3`
- Brent verification record counts per horizon on every model:
  - `1M = 675`
  - `3M = 632`
  - `6M = 567`
  - `12M = 440`

Interpretation:
- `PIT_CURRENT_ARTIFACT_STATE = AVAILABLE_ON_PUBLIC_ROUTE_BUT_INVISIBLE_TO_MATRIX_PERSISTED_PROOF`
- `PIT_VERIFICATION_ARTIFACT_STATE = AVAILABLE_ON_PUBLIC_ROUTE_BUT_INVISIBLE_TO_MATRIX_PERSISTED_PROOF`
- The matrix fail path binds `historyFingerprint = null` because it exits at the persisted-proof layer before canonical PIT reads are consulted.
- `FINGERPRINT_MISMATCH_COUNT = 0`

## Failure Revealed After Timeout Removal

- `FAILURE_REVEALED_AFTER_TIMEOUT_REMOVAL = YES`
- Before the shared read-cache corrective, Brent and Aluminium timed out before point-in-time evaluation began.
- After timeout removal, `POINT_IN_TIME_EVALUATION_BEGAN = YES` and all 12 variants completed.
- The PIT-only persisted-proof wiring defect then became visible as the remaining benchmark-level failure.

## Aluminium Confirmation

- Aluminium matches Brent on the same root-cause shape.
- Live deployed PIT capability truth returns `AVAILABLE / READY / READY / READY` on all four models.
- Public deployed PIT current and verification routes return `AVAILABLE` on all four models with all four verification horizons present.
- The simulated deployed matrix path with `getPrisma() = null` reproduces the same 4 current PIT failures and 16 verification PIT failures with `POSTGRES_ARTIFACT / MISSING_ARTIFACT`.
- `ALUMINIUM_ROOT_CAUSE_MATCHES_BRENT = YES`
- `ALUMINIUM_REASON_CODE_COUNTS = { MISSING_ARTIFACT: 20 }`

Aluminium PIT route fingerprints:
- PIT current fingerprint on all four models: `c37c1f02210d41fbc92fa7f5ee1ce083a9e7244b47facd2e6bcb5ce08b882e8b`
- PIT verification fingerprint on all four models: `66ab9637bc2685c14030dc5ae334c50556b3d71525a3dfaf41d4233d7a716c91`
- verification record counts per horizon on every model:
  - `1M = 660`
  - `3M = 617`
  - `6M = 555`
  - `12M = 429`

## WARM Interpretation

- `WARM_FAILURE_IS_DOWNSTREAM_OF_MATRIX = YES`
- `runWarmRehearsal(...)` seeds verification failures directly from required primary matrix verification cells that are already not `PASS`.
- It also records primary matrix current failures before issuing any current reread checks.
- The live warm failure string exactly mirrors the same 20 PIT matrix failures.
- No independent warm cache regression is required to explain this failure.

## Label Semantics

- `REREAD_FAIL_LABEL_SEMANTICALLY_PRECISE = NO`
- What it currently represents is: required matrix cells failed, and the top-level certification maps that matrix failure into the derived label `REREAD_FAIL`.
- In this audit, the actual failure semantics are: PIT matrix persisted-proof dependency unavailable in the certification matrix path.
- The label does not distinguish matrix-failing layer, reason code, or owner.

## Compute Safety

- Brent diagnostics timeline counts:
  - `PREPARE_CURRENT_COUNT = 0`
  - `PREPARE_VERIFICATION_COUNT = 0`
- Brent and Aluminium PIT capability traces show:
  - `MODEL_FIT_COUNT = 0`
- PIT current and verification public route paths are persisted-read consumers, not request-path materializers.
- No evidence of request-path historical recompute or duplicate forecast compute was observed.
- Therefore:
  - `PIT_MATERIALIZATION_COUNT = 0`
  - `HISTORICAL_COMPUTE_COUNT = 0`
  - `DUPLICATE_FORECAST_COMPUTE = 0`

## Root Cause / Owner / Next Corrective

- `ROOT_CAUSE = OTHER`
- Explanation: the certification matrix path requires PIT persisted-proof access but `createDemoCertificationService(...)` defaults `getMatrixPrisma` to `() => null`, so PIT matrix cells fail at the `POSTGRES_ARTIFACT` layer even though deployed PIT consumer routes are already `AVAILABLE`.
- `CORRECTIVE_OWNER = DASHBOARD_PREVIEW`
- `RECOMMENDED_NEXT_CORRECTIVE = wire a live market-data Prisma dependency into the deployed certification matrix path for POINT_IN_TIME persisted-proof checks so MATRIX evaluates the same available PIT artifacts already served by the public dashboard current and verification routes`
- `READY_FOR_CORRECTIVE = YES`

## Final Decision

- `REREAD_FAIL_AUDIT = PASS`
- `WARM_REHEARSAL_CORRECTIVE_FULL_LIVE_ACCEPTANCE = NOT_PROVEN`
- `READY_FOR_COPPER_FRESHNESS_REPAIR = NO`
- `PRE_DEPRECATION_ACCEPTANCE = BLOCKED`
- `LEGACY_DEPRECATION_ALLOWED = NO`

## PMOS Closeout Status

- `PMOS_SAVE = SUCCEEDED`
- `CLOSEOUT_STATE = CLOSEOUT_COMPLETE`
- `PENDING_SLOT_FINAL = CLEAR`
- persisted PMOS conversation base:
  - `2026-09-14-16:29_ppf-1-stage-12-matrix-reread-fail-root-cause-audit-20260914`
- persisted closeout evidence:
  - `ARCHIVE_COMPLETENESS = PASS`
  - `EXECUTION_TRAIL_STATUS = PRESENT`
  - `HANDOFF_PUBLICATION_STATUS = SUCCEEDED`
  - `VECTOR_REBUILD_STATUS = SUCCEEDED`
  - `RUNTIME_CONTEXT_INTEGRITY = PASS`
  - `RECOVERY_REQUIRED = false`
- `npm run pmos:verify-runtime` -> `PASS`
