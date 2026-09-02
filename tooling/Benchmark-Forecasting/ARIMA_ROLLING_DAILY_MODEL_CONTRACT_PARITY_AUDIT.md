# ARIMA Rolling Daily Model Contract Parity Audit

Status: STAGE 0 AUDIT
Scope: ARIMA as the fourth equal Forecast Model candidate for `ROLLING_DAILY_POINT_IN_TIME`
Date: 2026-08-20

## 1. Executive Result

`ARIMA Model Contract Parity: PASS`

`ARIMA Deployment Architecture Parity: PASS`

`Stage 1 Readiness: READY`

Short rationale:

- The existing ARIMA implementation already lives inside the same Python Forecast Core model family catalog as `naive`, `damped_holt`, and `ets`.
- ARIMA already uses a bounded deterministic candidate policy rather than unbounded `auto_arima`-style search.
- The current incompatibilities are local and evidence-bounded: monthly-only input validation, no rolling-daily path-fit helper, and user-facing SG Runtime type restrictions that still expose only `naive`, `damped_holt`, and `ets`.
- Repository evidence does not justify a separate ARIMA Forecast Method, persistence lifecycle, deployment topology, database, service, repository, or Dashboard backend.

The Stage 0 verdict is therefore `PASS`, but only as a parity-with-minimal-change result. ARIMA is not currently rolling-daily enabled.

## 2. Authorities Read

Authorities read directly for this audit:

- `Canon/v1.0-canonical-prompt-contract.md`
- `Canon/v1.0-vsc-mandatory-execution-canon.md`
- `Canon/v1.0-developer-lifecycle-specification.md`
- `tooling/Benchmark-Forecasting/FORECASTING_CANON.md`
- `tooling/Benchmark-Forecasting/FORECASTING_METHODS_SPEC.md`
- `tooling/Benchmark-Forecasting/ROLLING_DAILY_POINT_IN_TIME_METHOD_SPEC.md`
- `tooling/Benchmark-Forecasting/ROLLING_DAILY_PRODUCTION_FORECAST_CONTRACT.md`
- `tooling/Benchmark-Forecasting/ROLLING_DAILY_INDEPENDENT_FINAL_VALIDATION.md`
- `tooling/Benchmark-Forecasting/ROLLING_DAILY_TARGET_BASIS_CANONICALIZATION_ACCEPTANCE.md`
- `tooling/Benchmark-Forecasting/FORECAST_TARGET_BASIS_CANON.md`
- `apps/dashboard-preview/DASHBOARD PREVIEW FORECAST TARGET BASIS PRESENTATION CONTRACT.md`
- `apps/dashboard-preview/DASHBOARD PREVIEW CHART RENDERING CANON.md`
- `apps/dashboard-preview/FORECAST_DEPLOYMENT_CANON.md`

Deployment Canon: `READ / OBEYED`

Repository identity established before conclusions:

- Workspace root: `SG-dev`
- Git top-level: `/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev`
- Verified remotes include `origin = https://github.com/profitia/pmos-sg20-development.git`
- Worktree is dirty with many unrelated tracked/untracked PMOS and governance artifacts, so no unrelated resets or cleanup were performed.

## 3. Existing Architecture Map

Current evidence-backed architecture flow:

```text
Forecast model family implementation
    tooling/Benchmark-Forecasting/forecasting/models/*.py
        ↓

Monthly shared model contract
    ForecastModel.forecast_with_metadata(history, horizon_steps)
        ↓

Monthly orchestration
    forecasting/backtest.py
    forecasting/service.py
        ↓

Rolling-daily sibling orchestration
    forecasting/rolling_daily_point_in_time.py
    fit_path_model(...)
        ↓

Python bridge / SG Runtime production mapper
    scripts/export_rolling_daily_current_forecast.py
    apps/sg-runtime/lib/forecast/rolling-daily-production-forecast.ts
        ↓

Persistence / serving boundary
    apps/sg-runtime/prisma-market-data/schema.prisma
    rolling_daily_verification_records
    rolling_daily_calibration_groups
    rolling_daily_maintenance_state
    rolling_daily_current_forecast_snapshots
```

Current reality is not a single formal interface reused everywhere.

There are two effective contracts:

1. Monthly model contract:
   `ForecastModel.forecast_with_metadata(history, horizon_steps) -> ModelForecast`
2. Rolling-daily path-fit contract:
   a structural helper returning `metadata` plus `forecast_path(horizon_steps)` from one fit per origin

`naive`, `damped_holt`, and `ets` already participate in the rolling-daily path-fit contract through `fit_path_model(...)` in `forecasting/rolling_daily_point_in_time.py`.

`arima` currently participates only in the monthly contract.

## 4. Existing ARIMA Implementation

Location:

- `tooling/Benchmark-Forecasting/forecasting/models/arima.py`

Entry points:

- `ARIMAModelFamily.forecast_with_metadata(...)`
- `ARIMAModelFamily.fit_candidate(...)`
- `ARIMA_CANDIDATE_GRID`

Dependencies:

- `statsmodels.tsa.arima.model.ARIMA`
- shared helpers in `forecasting/models/statsmodels_utils.py`

Current input contract:

- `history: Sequence[Observation]`
- `horizon_steps: int`
- monthly-only validation via `validate_monthly_history(...)`
- minimum history `36`

Current output contract:

- `ModelForecast`
- one scalar `forecast_value`
- `ForecastMetadata` carrying selected variant, parameters, AICc score, fit status

Current frequency assumptions:

- regular monthly cadence required
- broken monthly cadence raises `BROKEN_CADENCE`
- no daily execution path exists in the current ARIMA model family

Current order selection:

- bounded non-seasonal grid
- `p in {0,1,2}`
- `d in {0,1}`
- `q in {0,1,2}`
- exclude `(0,0,0)`
- deterministic sort via `_arima_tie_break_key`
- select lowest AICc

Current fitting behavior:

- one statsmodels fit per candidate
- `seasonal_order=(0,0,0,0)`
- `trend='c'` when `d=0`
- `trend='t'` when `d=1`
- `enforce_stationarity=True`
- `enforce_invertibility=True`
- `concentrate_scale=False`
- `validate_specification=True`
- `.fit(method='statespace', low_memory=False)`

Current forecast behavior:

- after candidate selection, returns only the requested horizon value
- does not expose the selected fitted result for full-path reuse
- therefore cannot currently satisfy rolling-daily one-fit-per-origin path generation

## 5. Effective Forecast Model Contract

The real common contract currently used by `naive`, `damped_holt`, and `ets` in the monthly core is defined structurally by:

- `forecasting/models/base.py`
- `forecasting/backtest.py`
- `forecasting/service.py`

Effective shared monthly contract:

- stable `model_id`
- input = ordered `Observation` history + integer `horizon_steps`
- output = `ModelForecast(forecast_value, metadata)`
- failure = `ModelForecastError(reason)`
- no future data inside model invocation

Rolling-daily uses a stricter structural contract in `forecasting/rolling_daily_point_in_time.py`:

- model identity still comes from `ForecastModel.model_id`
- orchestration computes one origin-local projected step grid
- model branch must produce one fitted path object
- fitted path object must expose `metadata`
- fitted path object must expose `forecast_path(horizon_steps)`

Current rolling-daily participation by model:

- `naive`: `_fit_naive_path(...)`
- `damped_holt`: `fit_damped_holt_endog(...)` returning `DampedHoltPathFit`
- `ets`: `fit_selected_ets_endog(...)` returning `ETSPathFit`
- `arima`: no branch, explicit `MODEL_NOT_AVAILABLE`

Therefore ARIMA fits the same model-family architecture, but not yet the same rolling-daily path-fit contract.

## 6. Four-Model Contract Parity Matrix

| Contract Dimension | Naive | Damped Holt | ETS | ARIMA | ARIMA Classification |
| --- | --- | --- | --- | --- | --- |
| Stable `modelId` | Yes | Yes | Yes | Yes (`arima`) | `NONE` |
| Accepts lawful history up to origin | Yes | Yes | Yes | Yes | `NONE` |
| Daily-compatible today | Yes | Yes via rolling-daily helper | Yes via rolling-daily helper | No, monthly validator blocks it | `MODEL-INTERNAL CHANGE` |
| No future leakage | Yes | Yes | Yes | Yes | `NONE` |
| One fit per origin possible | Yes | Yes | Yes | Not today | `MODEL-INTERNAL CHANGE` |
| One `+12M` path possible | Yes | Yes | Yes | Not exposed today | `MODEL-INTERNAL CHANGE` |
| Shared target-date semantics possible | Yes | Yes | Yes | Yes | `NONE` |
| Deterministic configuration | Yes | Yes | Yes | Yes | `NONE` |
| Configuration serializable | Yes | Yes | Yes | Mostly yes | `MINOR ADAPTER` |
| Same Production Contract possible | Yes | Yes | Yes | Yes, but not exposed | `SHARED CONTRACT CHANGE` |
| Same persistence lifecycle possible | Yes | Yes | Yes | Yes | `NONE` |
| Same maintenance lifecycle possible | Yes | Yes | Yes | Structurally yes, not enabled | `MODEL-INTERNAL CHANGE` |
| Separate deployment required | No | No | No | Must remain No | `NONE` |

## 7. `(p,d,q)` Audit

Exact current behavior from `forecasting/models/arima.py`:

- Candidate count: `17`
- Candidate generation: explicit bounded grid, no auto-search
- Candidate family: non-seasonal only
- `d` values: `0` and `1` only
- `trend` policy: `c` for `d=0`, `t` for `d=1`
- Selection metric: `AICc`
- Tie tolerance: `AICC_TIE_TOLERANCE = 1e-9`
- Tie break order: lower `d`, then lower `(p+q)`, then lower `p`, then lower `q`
- Failure handling: invalid candidate skipped; all invalid => `ALL_CANDIDATES_INVALID`
- Convergence handling: warning or failed convergence => candidate invalid
- Timeout handling: none present
- Parallel search: none present
- Random selection: none present

Stage 0 verdict on `(p,d,q)` policy:

- bounded: `PASS`
- deterministic: `PASS`
- architecture-compatible with common model family: `PASS`
- Stage 1 likely change: no policy redesign required; only path-fit reuse and daily-input compatibility are missing.

## 8. Daily Compatibility Audit

Current daily compatibility is not yet present inside ARIMA.

Evidence:

- `ARIMAModelFamily.forecast_with_metadata(...)` calls `validate_monthly_history(...)`
- `validate_monthly_history(...)` rejects anything except exact monthly cadence
- rolling-daily `fit_path_model(...)` currently handles `naive`, `damped_holt`, and `ets` only

Important nuance:

- The rolling-daily method already separates calendar-target semantics from model-step semantics.
- `fit_path_model(...)` for `damped_holt` and `ets` validates only numeric history via `validate_history_values(...)`, not monthly cadence.
- ARIMA can likely follow the same pattern because statsmodels ARIMA consumes an ordered numeric series and forecast step count, while rolling-daily already owns the calendar clamp and observed-weekday projection logic.

Current daily compatibility verdict:

- frequency assumptions: monthly-first today
- time grid: no separate ARIMA calendar engine exists
- missing dates: not handled inside ARIMA; rolling-daily would supply lawful ordered observations only
- weekends / business days: not modeled inside ARIMA; rolling-daily projection owns this concern
- forecast steps: compatible in principle with shared projected-step semantics, but not implemented in current ARIMA branch

Audit result: `REQUIRES MODEL-INTERNAL CHANGE`

## 9. Monthly Legacy Audit

Discovered legacy assumptions:

| Legacy Assumption | Evidence | Classification |
| --- | --- | --- |
| Exact monthly cadence required | `validate_monthly_history(...)` in `forecasting/models/statsmodels_utils.py` | `MUST BE REMOVED` for rolling-daily path |
| Monthly min history `36` inside ARIMA family | `ARIMAModelFamily.min_history = 36` | `NEEDS ADAPTER` |
| Monthly orchestration fits per horizon | `forecasting/service.py` and `forecasting/backtest.py` | `SAFE FOR DAILY` because Stage 1 uses sibling rolling-daily path, not monthly service |
| Monthly horizon semantics in shared service | `add_months(...)` in `forecasting/backtest.py` | `SAFE FOR DAILY` because rolling-daily already bypasses it |
| Seasonal monthly assumption | none in ARIMA, `seasonal_order=(0,0,0,0)` | `SAFE FOR DAILY` |
| Monthly seasonality period 12 | not used in ARIMA | `SAFE FOR DAILY` |
| Stationarity tests governing `d` | none | `SAFE FOR DAILY` |

The only true ARIMA-internal blockers are the monthly cadence validator and the lack of a path-fit object.

## 10. One-Fit-Per-Origin Audit

Explicit result: `REQUIRES MINOR CHANGE`

Evidence:

- monthly contract today is horizon-oriented: each `forecast_with_metadata(history, horizon_steps)` call selects candidates and returns only one scalar horizon value
- rolling-daily requires one fitted workflow per origin and one full path reused for all anchors
- `damped_holt` and `ets` already satisfy this through `DampedHoltPathFit` and `ETSPathFit`
- ARIMA currently discards the selected fitted result after producing one requested horizon forecast

Conclusion:

- current ARIMA does not yet support one-fit-per-origin path reuse
- the change required is local: add an ARIMA path-fit helper analogous to Damped Holt / ETS and let rolling-daily call that helper once per origin
- this is not evidence for a separate method or separate architecture

## 11. No-Leakage Audit

Result: `PASS`

Evidence:

- ARIMA candidate fitting always uses the `history` slice passed into `forecast_with_metadata(...)`
- no global cached full-series analysis is present
- no stationarity or differencing tests read beyond the provided history
- candidate selection occurs inside the origin-local loop
- `tests/test_phase2.py` contains `test_arima_no_future_leakage_for_same_origin`

Implication for Stage 1:

- if rolling-daily passes only `history <= T` into the future ARIMA path-fit helper, the existing architecture remains no-leakage lawful
- the leakage risk is not the current ARIMA selection policy; it is only whether Stage 1 uses the existing rolling-daily history boundary correctly

## 12. Determinism / Reproducibility Audit

Current architecture is capable of deterministic reproducibility, but not all useful ARIMA identity fields are first-class at the SG Runtime boundary yet.

Current deterministic evidence:

- bounded candidate catalog
- explicit `trend` policy
- explicit tie-break rule
- explicit statsmodels fit posture
- no random seed usage
- no parallel race-based candidate selection
- tests asserting deterministic repeated selection

ARIMA-specific configuration that would need to be reproducible per origin:

- `modelId = arima`
- selected `order = [p,d,q]`
- selected `trend`
- `seasonal_order = [0,0,0,0]`
- `selectionMetric = AICc`
- `selectionScore`
- fitted parameter map from statsmodels
- candidate policy version / bounded grid identity
- source/history fingerprint when the accepted lifecycle requires it

Additional fixed code-level assumptions worth recording at runtime or audit layer:

- `enforce_stationarity = True`
- `enforce_invertibility = True`
- fit method = `statespace`

Deterministic reproducibility capability: `GAP`

Reason:

- the core is deterministic, but the later serving boundary would benefit from explicitly capturing the fixed candidate policy/version and fit posture, not only the selected order and score

## 13. Production Contract Parity

Result: `GAP`

Positive evidence:

- `apps/sg-runtime/lib/forecast/rolling-daily-production-forecast.ts` uses generic model fields such as `model.id: string`
- `RollingDailyProductionForecastRequest.modelId` is `string`
- persistence identity and returned payloads do not require ARIMA-specific DTO shape

Current parity gaps:

- `apps/sg-runtime/lib/forecast/contracts.ts` restricts `USER_FACING_FORECAST_MODELS` to `naive`, `damped_holt`, `ets`
- `apps/sg-runtime/lib/forecast/request-contract.ts` validates route `model` using that same enum
- `apps/sg-runtime/lib/forecast/production-routing.ts` types `modelId` as `UserFacingForecastModelId`
- `apps/sg-runtime/lib/forecast/rolling-daily-current-forecast-snapshot.ts` restricts snapshot requests to `naive | damped_holt | ets`

Conclusion:

- no ARIMA-specific DTO is required
- later user-facing exposure requires shared-contract enum widening, not a separate contract

## 14. Persistence & Maintenance Parity

Persistence parity: `PASS`

Maintenance parity: `GAP`

Persistence evidence:

- `apps/sg-runtime/prisma-market-data/schema.prisma` defines rolling-daily tables with `modelId String`
- no per-model enum or per-model table exists for:
  - `rolling_daily_verification_records`
  - `rolling_daily_calibration_groups`
  - `rolling_daily_maintenance_state`
  - `rolling_daily_current_forecast_snapshots`
- identity keys are generic over `modelId`

Therefore the current DB model can hold `modelId = arima` without requiring:

- `arima_verification_records`
- `arima_calibration`
- `arima_maintenance_state`
- `arima_snapshot`

Maintenance evidence:

- `apps/sg-runtime/lib/forecast/rolling-daily-maintenance.ts` uses generic `modelId: string`
- `tooling/Benchmark-Forecasting/scripts/export_rolling_daily_incremental_maintenance.py` accepts `modelId: str` and routes it through `build_model(model_id)`
- Stage 9 tests currently validate `SUPPORTED_MODELS = ('naive', 'damped_holt', 'ets')`
- the actual execution blocker is still `fit_path_model(...)`, which returns `MODEL_NOT_AVAILABLE` for ARIMA

Conclusion:

- common maintenance lifecycle is already structurally generic
- enabling ARIMA does not require a separate maintenance subsystem
- but current maintenance execution remains blocked until ARIMA participates in the same path-fit contract

## 15. Deployment Architecture Parity

Post-migration reconciliation note:

- The standalone deployment-repository wording used in the original Stage 0 audit is historical only.
- Current write authority is defined by `apps/dashboard-preview/FORECAST_DEPLOYMENT_CANON.md`.

Development Workspace: `SG-dev`

Database Authority: `Neon PostgreSQL / neondb / public`

Database ENV Authority: `MARKET_DATA_DATABASE_URL`

Canonical Source Repository: `profitia/SG-dev`

Canonical Source Branch: `main`

Canonical Source Path: `apps/dashboard-preview`

Historical Standalone Repository Role: `SUPERSEDED / HISTORICAL ONLY`

Render Service Identity: `dashboards-library`

Render Service ID: `srv-da2i7j9t0dsc73ag7qv0`

New ARIMA Database Required: `NO`

New ARIMA Service Required: `NO`

New ARIMA Repository Required: `NO`

Benchmark Finder Touched: `NO`

AppShell Touched: `NO`

Deployment performed: `NO`

Evidence:

- `apps/dashboard-preview/FORECAST_DEPLOYMENT_CANON.md` is explicit that deployment target must not be inferred from code location
- ARIMA code living under `tooling/Benchmark-Forecasting` or `apps/sg-runtime` does not imply a separate deployment surface
- the current ARIMA implementation is a Python execution concern only, not a deployment-topology concern

Verdict: `PASS`

## 16. Three-Axis Architecture Risk Assessment

### LOW COST

- Positive: bounded `17`-candidate ARIMA grid, no uncontrolled `auto_arima`, no separate infrastructure component
- Risk: Stage 1 path-fit helper must avoid repeated refits per anchor horizon
- Risk: statsmodels ARIMA is more expensive than naive and likely more expensive than damped Holt; request-time widening should remain bounded to one fit per origin

### METHODOLOGICAL CORRECTNESS

- Positive: no-leakage structure already exists, no stationarity-test-driven future leakage, no synthetic daily interpolation is required in ARIMA itself
- Risk: current monthly cadence validator must be bypassed lawfully for rolling-daily
- Risk: Stage 1 must preserve rolling-daily ownership of calendar clamp and verification semantics rather than letting ARIMA infer target semantics itself

### FAST / REPRODUCIBLE SERVING

- Positive: deterministic candidate search and selected-order metadata already exist
- Risk: SG Runtime route contracts and snapshot persistence still treat only three models as user-facing
- Risk: full reproducibility at serving boundary should record candidate policy/version and fixed fit posture explicitly

## 17. Gaps Requiring Stage 1 Work

### Gap 1

Gap: ARIMA has no rolling-daily path-fit helper.

Evidence: `fit_path_model(...)` in `forecasting/rolling_daily_point_in_time.py` has branches for `naive`, `damped_holt`, and `ets` only, then raises `MODEL_NOT_AVAILABLE`.

Classification: `MODEL-INTERNAL CHANGE`

Why it matters: rolling-daily requires one fit per origin and one shared path for all anchors.

Minimum likely change: add ARIMA path-fit helper returning `metadata` plus `forecast_path(horizon_steps)` from the selected fitted candidate.

Stage: `1`

### Gap 2

Gap: current ARIMA model family is monthly-cadence-only.

Evidence: `ARIMAModelFamily.forecast_with_metadata(...)` calls `validate_monthly_history(...)`.

Classification: `MODEL-INTERNAL CHANGE`

Why it matters: lawful rolling-daily history is DAILY observation order, not regular monthly cadence.

Minimum likely change: introduce a rolling-daily ARIMA fit path using `validate_history_values(...)` instead of `validate_monthly_history(...)`.

Stage: `1`

### Gap 3

Gap: ARIMA still lacks an explicit rolling-daily current-forecast validation surface.

Evidence: rolling-daily tests and Stage 9 maintenance tests only cover `naive`, `damped_holt`, and `ets`.

Classification: `MINOR ADAPTER`

Why it matters: Stage 1 needs a focused proof that ARIMA now satisfies one-fit-per-origin, daily path generation, and no-leakage on the shared method.

Minimum likely change: extend focused rolling-daily tests and one narrow real-data smoke only if needed.

Stage: `1`

### Gap 4

Gap: SG Runtime user-facing contract still exposes only three models.

Evidence: `USER_FACING_FORECAST_MODELS` and route schemas exclude `arima`; snapshot request types also exclude it.

Classification: `SHARED CONTRACT CHANGE`

Why it matters: later user-facing serving and snapshot persistence cannot expose `modelId = arima` without widening shared TS contracts.

Minimum likely change: extend user-facing model enums and snapshot request unions when the program reaches the serving/snapshot stages.

Stage: `10+ / 11+ / 12`

### Gap 5

Gap: ARIMA serving identity should capture fixed candidate policy/version and fit posture more explicitly.

Evidence: current metadata captures selected order/trend and statsmodels parameters, but not a named candidate-policy version or fixed solver posture.

Classification: `MINOR ADAPTER`

Why it matters: Stage 2 reproducibility gate benefits from explicit identity rather than relying only on code constants.

Minimum likely change: include candidate policy/version and any fixed ARIMA config fields in runtime provenance where accepted.

Stage: `2`

## 18. Minimal Stage 1 Change Plan

If Stage 1 proceeds, the smallest evidence-based plan is:

1. Add an ARIMA path-fit helper inside `forecasting/models/arima.py` or a neighboring local helper that returns the selected fitted result and exposes `forecast_path(horizon_steps)`.
2. Extend `fit_path_model(...)` in `forecasting/rolling_daily_point_in_time.py` with one `arima` branch that validates lawful daily numeric history, not monthly cadence.
3. Preserve the existing bounded `(p,d,q)` candidate grid, tie-break rule, and AICc selection exactly as-is.
4. Keep calendar target semantics, observed-weekday projection, verification semantics, and band logic entirely inside the existing rolling-daily method orchestration.
5. Add focused rolling-daily tests for:
   - ARIMA one-fit-per-origin path reuse
   - current forecast full-path generation
   - no-leakage at fixed origin
   - deterministic selected candidate on repeated runs
6. Do not widen SG Runtime public route enums, snapshot persistence unions, Dashboard UX, or deployment surfaces in Stage 1.

This plan preserves the existing architecture:

```text
ROLLING_DAILY_POINT_IN_TIME
    ├── naive
    ├── damped_holt
    ├── ets
    └── arima
```

without introducing a separate ARIMA pipeline.

## 19. Files Inspected

Important implementation files inspected for this audit:

- `tooling/Benchmark-Forecasting/forecasting/models/base.py`
- `tooling/Benchmark-Forecasting/forecasting/models/naive.py`
- `tooling/Benchmark-Forecasting/forecasting/models/damped_holt.py`
- `tooling/Benchmark-Forecasting/forecasting/models/ets.py`
- `tooling/Benchmark-Forecasting/forecasting/models/arima.py`
- `tooling/Benchmark-Forecasting/forecasting/models/statsmodels_utils.py`
- `tooling/Benchmark-Forecasting/forecasting/contracts.py`
- `tooling/Benchmark-Forecasting/forecasting/backtest.py`
- `tooling/Benchmark-Forecasting/forecasting/service.py`
- `tooling/Benchmark-Forecasting/forecasting/runtime_catalog.py`
- `tooling/Benchmark-Forecasting/forecasting/rolling_daily_point_in_time.py`
- `tooling/Benchmark-Forecasting/forecasting/rolling_daily_contracts.py`
- `tooling/Benchmark-Forecasting/scripts/export_rolling_daily_current_forecast.py`
- `tooling/Benchmark-Forecasting/scripts/export_rolling_daily_incremental_maintenance.py`
- `tooling/Benchmark-Forecasting/tests/test_phase2.py`
- `tooling/Benchmark-Forecasting/tests/test_rolling_daily_method.py`
- `tooling/Benchmark-Forecasting/tests/test_rolling_daily_incremental_maintenance.py`
- `apps/sg-runtime/lib/forecast/contracts.ts`
- `apps/sg-runtime/lib/forecast/request-contract.ts`
- `apps/sg-runtime/lib/forecast/production-routing.ts`
- `apps/sg-runtime/lib/forecast/service.ts`
- `apps/sg-runtime/lib/forecast/rolling-daily-production-forecast.ts`
- `apps/sg-runtime/lib/forecast/rolling-daily-maintenance.ts`
- `apps/sg-runtime/lib/forecast/rolling-daily-current-forecast-snapshot.ts`
- `apps/sg-runtime/prisma-market-data/schema.prisma`

## 20. Files Changed

Expected changed file set:

- `tooling/Benchmark-Forecasting/ARIMA_ROLLING_DAILY_MODEL_CONTRACT_PARITY_AUDIT.md`

No runtime, persistence, deployment, Dashboard UX, Benchmark Finder, or AppShell files were modified in this Stage 0 audit.
