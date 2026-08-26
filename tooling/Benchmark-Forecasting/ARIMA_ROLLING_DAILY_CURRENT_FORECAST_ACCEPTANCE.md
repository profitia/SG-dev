# ARIMA Rolling Daily Current Forecast Acceptance

Status: STAGE 1 ACCEPTANCE
Scope: `modelId = arima` inside `ROLLING_DAILY_POINT_IN_TIME` Current Forecast only
Date: 2026-08-20

## 1. Executive Result

`ARIMA Current Rolling Daily Forecast: PASS`

`Stage 2 Readiness: READY`

Stage 1 integrated ARIMA into the existing rolling-daily Current Forecast path without creating a new Forecast Method, new persistence architecture, new deployment surface, or public SG Runtime exposure.

## 2. Authorities Read

Authorities read for this Stage 1 task:

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
- `tooling/Benchmark-Forecasting/ARIMA_ROLLING_DAILY_MODEL_CONTRACT_PARITY_AUDIT.md`
- `apps/dashboard-preview/FORECAST_DEPLOYMENT_CANON.md`

Deployment Canon: `READ / OBEYED`

## 3. Implementation Summary

Files changed:

- `tooling/Benchmark-Forecasting/forecasting/models/arima.py`
- `tooling/Benchmark-Forecasting/forecasting/rolling_daily_point_in_time.py`
- `tooling/Benchmark-Forecasting/tests/test_rolling_daily_method.py`
- `tooling/Benchmark-Forecasting/tests/test_rolling_daily_current_forecast_export.py`
- `tooling/Benchmark-Forecasting/ARIMA_ROLLING_DAILY_CURRENT_FORECAST_ACCEPTANCE.md`

Implementation result:

- preserved the existing bounded deterministic ARIMA policy
- added ARIMA path-fit parity for rolling-daily by introducing a selected-fit object that exposes `forecast_path(...)`
- reused the existing `fit_path_model(...)` orchestration branch shape instead of introducing a separate ARIMA pipeline
- kept rolling-daily calendar semantics, anchor semantics, and target-basis semantics unchanged
- did not widen Dashboard-facing or public SG Runtime user-facing model unions

## 4. Rolling Daily Contract Result

```text
modelId:
arima

forecastMethod:
ROLLING_DAILY_POINT_IN_TIME

targetBasis:
POINT_IN_TIME

methodVersion:
rolling-daily-point-in-time-v1

frequency:
DAILY
```

## 5. ARIMA Configuration

Code-backed configuration preserved in Stage 1:

- candidate count: `17`
- candidate family: non-seasonal `ARIMA(p,d,q)` only
- `p in {0,1,2}`
- `d in {0,1}`
- `q in {0,1,2}`
- exclude `(0,0,0)`
- selection criterion: `AICc`
- tie-break behavior: lower `d`, then lower `(p+q)`, then lower `p`, then lower `q`
- `trend='c'` for `d=0`
- `trend='t'` for `d=1`
- fit posture: statsmodels `ARIMA(...).fit(method='statespace', low_memory=False)`

Controlled current benchmark selected order:

- selected candidate: `ARIMA(2,1,2)`

## 6. One-Fit-Per-Origin Evidence

Result: `PASS`

Evidence:

- `forecasting/models/arima.py` now exposes `ARIMAPathFit.forecast_path(horizon_steps)` for the selected fitted ARIMA candidate
- `forecasting/rolling_daily_point_in_time.py` now resolves `model_id == 'arima'` inside the existing `fit_path_model(...)` abstraction
- `tests/test_rolling_daily_method.py::test_current_forecast_arima_fits_once_for_full_path_and_all_anchors`
  confirms one ARIMA fit-selection workflow is used for one current origin and all four shared anchors

## 7. No-Leakage Evidence

Result: `PASS`

Evidence:

- Stage 1 does not widen ARIMA beyond origin-local history input
- rolling-daily still passes one lawful history slice per origin
- ARIMA candidate selection and fit continue to consume only the supplied `history`
- `tests/test_phase2.py::test_arima_no_future_leakage_for_same_origin` remains green
- `tests/test_rolling_daily_method.py::test_arima_same_origin_ignores_future_shock` proves the rolling-daily path-fit result is unchanged when observations after the audited same-origin slice are altered

## 8. Controlled Benchmark Result

Controlled benchmark:

- `seriesId = wocaes0074`
- display: `Brent, Spot, FOB North Sea`

Controlled current forecast result:

- history start: `1985-10-01`
- history end: `2026-08-18`
- origin date: `2026-08-18`
- observation count: `10460`
- path start: `2026-08-19`
- path end: `2027-08-18`
- path length: `365`
- selected order: `ARIMA(2,1,2)`

Anchors from the same path:

- `1M`: `2026-09-18 / 90.31392180812654`
- `3M`: `2026-11-18 / 90.55935733782876`
- `6M`: `2027-02-18 / 90.9543600481612`
- `12M`: `2027-08-18 / 91.72622054891963`

## 9. Determinism Sanity Check

Result: `PASS`

Evidence:

- `tests/test_rolling_daily_method.py::test_current_forecast_arima_is_deterministic_for_same_input` is green
- controlled benchmark current forecast was executed twice through the same bridge input and produced byte-identical serialized output

## 10. Current Forecast Diagnostics

Diagnostics only, not model-quality acceptance criteria:

- unique forecast values: `261`
- min forecast: `90.06581584130399`
- max forecast: `91.72622054891963`
- forecast range: `1.6604047076156405`
- candidate fits attempted in one current run: `17`
- candidate fits successful in one current run: `17`
- current-run elapsed time: `11.718741332995705s`
- explicit selected-fit measurement: `13.286846083006822s` for one direct fit-path call on the same history
- 3M path extraction after fit: `0.001314207969699055s`
- 12M path extraction after fit: `0.002956166979856789s`

These values are Stage 1 diagnostics only.

## 11. Regression Result

Focused regression suite run:

```text
.venv/bin/python -m unittest \
  tests.test_phase2 \
  tests.test_rolling_daily_method \
  tests.test_rolling_daily_current_forecast_export
```

Result:

- `48 tests`
- `OK`

Regression status:

- Naive regression: `PASS`
- Damped Holt regression: `PASS`
- ETS regression: `PASS`

These models remain covered by the same focused rolling-daily method suite that passed after ARIMA integration.

## 12. Production Contract Boundary

`ARIMA-specific Production DTO: NO`

`Public SG Runtime ARIMA Exposure Added: NO`

Stage 1 keeps ARIMA inside the existing internal rolling-daily Current Forecast lifecycle only.

Public/user-facing SG Runtime model unions remain intentionally unchanged.

## 13. Persistence Result

```text
New Database:
NO

New Table:
NO

ARIMA-specific Persistence:
NO
```

No Current Forecast persistence change was required to make the Python rolling-daily Current Forecast path ARIMA-capable.

## 14. Deployment Result

```text
Deployment Performed:
NO

GitHub Deployment Repository Modified:
NO

Render Triggered:
NO

New Service:
NO

Benchmark Finder Touched:
NO

AppShell Touched:
NO
```

## 15. PMOS Completion State

This section is completed by the canonical PMOS closeout path for the task execution that produced this artifact.

The authoritative resulting status is recorded in the PMOS closeout evidence sidecar for this Stage 1 task after `pmos:save`, runtime update, and continuity verification complete.

## 16. Stage 2 Recommendation

`Stage 2 - Reproducibility & Fast Serving Gate`

Do not begin automatically.
