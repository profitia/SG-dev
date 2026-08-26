# ARIMA Path Shape Characterization

Status: STAGE 3 CHARACTERIZATION
Scope: four equal Forecast Models under `ROLLING_DAILY_POINT_IN_TIME`
Date: 2026-08-20

## 1. Executive Result

`Path Characterization: COMPLETE`

`Stage 4 Readiness: READY`

Stage 3 completed a lawful descriptive characterization of the four Current Forecast paths for the same controlled benchmark, source history state, origin, method semantics, target dates, and horizon. No model ranking was performed.

## 2. Authorities Read

Authorities read for Stage 3:

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
- `tooling/Benchmark-Forecasting/ARIMA_ROLLING_DAILY_CURRENT_FORECAST_ACCEPTANCE.md`
- `tooling/Benchmark-Forecasting/ARIMA_REPRODUCIBILITY_FAST_SERVING_ACCEPTANCE.md`
- `apps/dashboard-preview/FORECAST_DEPLOYMENT_CANON.md`

Deployment Canon: `READ / OBEYED`

## 3. Characterization Definitions

All four models were characterized with the same shared helper: `forecasting/path_characterization.py`.

Numerical tolerance:

- `tolerance = 1e-9`
- daily delta with `abs(delta) <= tolerance` is treated as zero for direction-change logic and change-derived metrics

Definitions:

- `forecastRange = maxForecast - minForecast`
- `delta[t] = forecast[t] - forecast[t-1]`
- `directionChanges` = number of sign flips between consecutive non-zero normalized deltas, ignoring zero plateaus
- `medianAbsoluteDailyChange = median(abs(delta[t]))` using normalized deltas and including zeros
- `maximumAbsoluteDailyChange = max(abs(delta[t]))` using normalized deltas
- `pathVolatility = population standard deviation of normalized daily deltas`
- `uniqueForecastValues` = count of distinct forecast values under the shared tolerance, using tolerance-aware grouping rather than raw float-string uniqueness

## 4. Controlled Input

```text
seriesId:
wocaes0074

benchmark display:
Brent, Spot, FOB North Sea

frequency:
DAILY

historyStart:
1985-10-01

historyEnd:
2026-08-18

originDate:
2026-08-18

sourceHistoryFingerprint:
35ecf750e4998799462a2fa9a57758f048695b26892c5fca6436669e32138f82

forecastMethod:
ROLLING_DAILY_POINT_IN_TIME

methodVersion:
rolling-daily-point-in-time-v1

targetBasis:
POINT_IN_TIME
```

Execution note:

- Stage 3 used one fresh controlled current computation per model from the same lawful source history payload to guarantee common origin and common date-grid identity across all four models.

## 5. Date-Grid Parity

```text
Common Origin:
PASS

Common Target Dates:
PASS

Common Horizon Semantics:
PASS
```

Observed shared method dates:

- path start: `2026-08-19`
- path end: `2027-08-18`
- `1M`: `2026-09-18`
- `3M`: `2026-11-18`
- `6M`: `2027-02-18`
- `12M`: `2027-08-18`

## 6. Full Four-Model Characterization Table

| Metric | Naive | Damped Holt | ETS | ARIMA |
| --- | ---: | ---: | ---: | ---: |
| Origin Date | 2026-08-18 | 2026-08-18 | 2026-08-18 | 2026-08-18 |
| Path Length | 365 | 365 | 365 | 365 |
| Unique Forecast Values | 1 | 261 | 1 | 261 |
| Minimum | 90.25 | 90.27087196604253 | 90.24996497579856 | 90.06581584130399 |
| Maximum | 90.25 | 90.91728158676763 | 90.24996497579856 | 91.72622054891963 |
| Forecast Range | 0.0 | 0.6464096207250947 | 0.0 | 1.6604047076156405 |
| Direction Changes | 0 | 0 | 0 | 16 |
| Median Absolute Daily Change | 0.0 | 0.00006331638048351351 | 0.0 | 0.005983404715209417 |
| Maximum Absolute Daily Change | 0.0 | 0.020219277917320255 | 0.0 | 0.15876256950942036 |
| Path Volatility | 0.0 | 0.003884513802541537 | 0.0 | 0.015522561503376152 |

## 7. Anchor Comparison

| Model | 1M | 3M | 6M | 12M |
| --- | --- | --- | --- | --- |
| Naive | 2026-09-18 / 90.25 | 2026-11-18 / 90.25 | 2027-02-18 / 90.25 | 2027-08-18 / 90.25 |
| Damped Holt | 2026-09-18 / 90.59603233582794 | 2026-11-18 / 90.83545859344228 | 2027-02-18 / 90.9073770005129 | 2027-08-18 / 90.91728158676763 |
| ETS | 2026-09-18 / 90.24996497579856 | 2026-11-18 / 90.24996497579856 | 2027-02-18 / 90.24996497579856 | 2027-08-18 / 90.24996497579856 |
| ARIMA | 2026-09-18 / 90.31392180812654 | 2026-11-18 / 90.55935733782876 | 2027-02-18 / 90.9543600481612 | 2027-08-18 / 91.72622054891963 |

## 8. Shape Summary Table

| Model | Forecast Range | Direction Changes | Path Volatility | Median Abs Daily Change | Max Abs Daily Change |
| --- | ---: | ---: | ---: | ---: | ---: |
| Naive | 0.0 | 0 | 0.0 | 0.0 | 0.0 |
| Damped Holt | 0.6464096207250947 | 0 | 0.003884513802541537 | 0.00006331638048351351 | 0.020219277917320255 |
| ETS | 0.0 | 0 | 0.0 | 0.0 | 0.0 |
| ARIMA | 1.6604047076156405 | 16 | 0.015522561503376152 | 0.005983404715209417 | 0.15876256950942036 |

## 9. Model-by-Model Descriptive Findings

### Naive

Naive produced a constant path with one unique forecast value, zero day-to-day movement, zero direction changes, and identical anchor values at `1M`, `3M`, `6M`, and `12M`.

### Damped Holt

Damped Holt produced a monotonic increasing path with no reversals, a moderate forecast range, small median daily movement, and a higher terminal level than Naive and ETS by `12M`.

### ETS

ETS produced an effectively constant path for this benchmark and current origin, with one unique forecast value, zero range, zero reversals, and identical anchor values across the full horizon.

### ARIMA

ARIMA produced the widest path range, the highest terminal level, and the only path with repeated direction reversals. Its day-to-day movement and path volatility were materially higher than the other three models under the same lawful source history and date grid.

## 10. ARIMA Structural Contribution

For this controlled benchmark, ARIMA contributes:

- the largest forecast range among the four models
- the only non-monotonic path with repeated direction reversals
- the highest median and maximum absolute daily change
- the highest path volatility
- the highest `12M` terminal point forecast

This is a structural description only. It is not a model-quality verdict.

## 11. Numerical Sanity

```text
Finite Values:
PASS

Strict Date Ordering:
PASS

Duplicate Dates:
NONE

Direction Change Noise Check:
PASS
```

Direction-change sanity inspection result:

- only ARIMA reported `directionChanges > 0`
- inspected change points were associated with actual sign flips in daily deltas, not duplicate dates or ordering errors
- the smallest inspected non-zero reversal-adjacent absolute delta was `0.0001664329063544301`, which remains well above the shared numerical tolerance `1e-9`

## 12. Regression Tests

Focused Stage 3 validation:

```text
.venv/bin/python -m unittest \
  tests.test_path_characterization \
  tests.test_rolling_daily_method \
  tests.test_rolling_daily_current_forecast_export \
  tests.test_phase2
```

Result:

- `54 tests`
- `OK`

Regression coverage status:

- Naive current forecast regressions: `PASS`
- Damped Holt current forecast regressions: `PASS`
- ETS current forecast regressions: `PASS`
- ARIMA current forecast regressions: `PASS`

## 13. Historical Verification Status

`Historical Rolling Verification: NOT RUN`

## 14. Prediction Band Status

`Prediction Bands: NOT IMPLEMENTED / NOT EVALUATED`

Stage 3 characterized point-forecast paths only.

## 15. Public Exposure

```text
Public SG Runtime ARIMA Exposure:
NOT ADDED

Dashboard ARIMA Exposure:
NOT ADDED
```

## 16. Persistence

```text
New Database:
NO

New Table:
NO

New Path-Shape Persistence:
NO
```

## 17. Deployment

```text
Deployment:
NOT PERFORMED

Render:
NOT TOUCHED

Benchmark Finder:
NOT TOUCHED

AppShell:
NOT TOUCHED
```

## 18. PMOS Completion State

This section is completed by the canonical PMOS closeout path for the Stage 3 task execution.

The authoritative resulting status is recorded in the PMOS closeout evidence sidecar after `pmos:save`, runtime update, and continuity verification complete.

## 19. Files Changed

- `tooling/Benchmark-Forecasting/forecasting/path_characterization.py`
- `tooling/Benchmark-Forecasting/tests/test_path_characterization.py`
- `tooling/Benchmark-Forecasting/scripts/characterize_rolling_daily_current_paths.py`
- `tooling/Benchmark-Forecasting/ARIMA_PATH_SHAPE_CHARACTERIZATION.md`

## 20. Stage 4 Recommendation

`Stage 4 - Historical Rolling Verification`

Do not begin automatically.
