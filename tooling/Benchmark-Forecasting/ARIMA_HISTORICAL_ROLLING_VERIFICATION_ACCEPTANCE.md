# ARIMA Historical Rolling Verification Acceptance

Status: STAGE 4 ACCEPTANCE
Scope: `ROLLING_DAILY_POINT_IN_TIME` historical rolling verification for `modelId = arima`
Date: 2026-08-20

## 1. Executive Result

`ARIMA Historical Verification: PASS`

`Stage 5 Readiness: READY`

Reason:

- the Stage 4 semantics and lifecycle integration checks passed locally
- the existing generic historical verification bridge accepted `modelId = arima`
- the full controlled resumable `wocaes0074` canonical run completed lawfully with complete coverage reconciliation and final horizon metrics

Per the stage instruction, methodology was not reduced at any point. The final result is accepted on complete computation evidence rather than approximation.

## 2. Authorities Read

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
- `tooling/Benchmark-Forecasting/ARIMA_PATH_SHAPE_CHARACTERIZATION.md`
- `apps/dashboard-preview/FORECAST_DEPLOYMENT_CANON.md`

Deployment Canon: `READ / OBEYED`

## 3. Historical Verification Semantics

Locked semantics used for Stage 4:

- Historical Origin Floor: `2024-01-01`
- DAILY origin rule: only lawful observed DAILY dates may become origins
- expanding-window rule: full lawful history `<= T`
- no-leakage rule: nothing after origin `T` may influence candidate selection or fit
- target-date rule: `CALENDAR_MONTH_CLAMP`
- Actual resolution: `AS_OF_TARGET_DATE`
- error sign convention: `error = forecast - actual`
- residual sign convention: `residual = actual - forecast`

## 4. Controlled Input

```text
seriesId:
wocaes0074

display:
Brent, Spot, FOB North Sea

frequency:
DAILY

full lawful history start:
1985-10-01

history end used by the controlled runtime path:
2026-08-18

first historical verification origin target:
2024-01-01 floor

last historical verification origin target:
2026-08-18
```

## 5. Training History Boundary Evidence

Result: `PASS`

Evidence:

- focused ARIMA maintenance tests now prove that `historicalOriginStartDate = 2024-01-01` does not truncate training history
- the first generated ARIMA historical record after the floor uses `trainingHistoryStartAt < 2024-01-01`
- `trainingHistoryEndAt = forecastOriginAt` remains preserved

## 6. No-Leakage Evidence

Result: `PASS`

Evidence:

- Stage 1 and Stage 2 no-leakage tests remain green
- the Stage 4 bridge still delegates one origin-local history slice into the same rolling-daily path-fit abstraction
- no Stage 4 code introduced any post-origin data access into ARIMA candidate selection or fit

## 7. One-Fit-Per-Origin Evidence

Result: `PASS`

Evidence:

- the historical verification bridge uses `fit_path_model(model, history)` once per origin and then reuses one path for all horizons
- focused Stage 4 ARIMA maintenance tests confirm one fit-path call per lawful new origin

## 8. Target-Date Semantics

```text
CALENDAR_MONTH_CLAMP:
PASS

AS_OF_TARGET_DATE:
PASS
```

Evidence:

- focused Stage 4 ARIMA maintenance test confirms matured records resolve `verificationObservedAt <= targetCalendarDate`
- immature targets preserve `actualValue = null`, `errorValue = null`, and `residualValue = null`

## 9. Horizon Verification Summary

Full canonical controlled metrics table from the completed checkpoint:

| Horizon | Generated Origins | Mature | Verified | Immature | Failures | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |
| 1M | 681 | 659 | 659 | 22 | 0 | 5.7941855544144065 | 8.874769253866956 | 8.20639336614635 | 7.2101783826219386 | 0.47040971168437024 | -0.026742784350466575 |
| 3M | 681 | 615 | 615 | 66 | 0 | 9.731616568937747 | 14.783554554180725 | 13.835596780258019 | 12.149204573356208 | 0.4065040650406504 | -0.07822664959024453 |
| 6M | 681 | 553 | 553 | 128 | 0 | 11.625291826222197 | 15.97648350590702 | 16.596548412813934 | 14.971099981420421 | 0.325497287522604 | -1.3935076743134316 |
| 12M | 681 | 423 | 423 | 258 | 0 | 16.047546032206817 | 18.96040681637324 | 23.015836890298054 | 20.61878694578448 | 0.3049645390070922 | 2.1910681217675427 |

## 10. Historical Metrics

Result: `AVAILABLE`

The completed checkpoint produced final 1M / 3M / 6M / 12M sample counts and shared metrics for the full lawful origin universe.

## 11. Selected ARIMA Order Distribution

Result: `AVAILABLE`

| Selected Order | Origins | Share |
| --- | ---: | ---: |
| ARIMA(1,1,2) | 9 | 0.013215859030837005 |
| ARIMA(2,1,0) | 17 | 0.024963289280469897 |
| ARIMA(2,1,1) | 115 | 0.16886930983847284 |
| ARIMA(2,1,2) | 540 | 0.7929515418502202 |

## 12. Failure / Unavailable Summary

Semantic and lifecycle findings:

- the generic rolling-daily maintenance bridge accepted `modelId = arima`
- ARIMA-specific focused Stage 4 maintenance tests passed after fixture correction
- a tiny synthetic ARIMA sample through the maintenance bridge returned `AVAILABLE`
- the full controlled resumable `wocaes0074` ARIMA historical verification run completed with final machine-readable output in `validation/arima_stage4_historical_verification_wocaes0074.json`

Coverage reconciliation from the canonical checkpoint:

- Expected Origins: `681`
- Completed Origins: `681`
- Remaining Origins: `0`
- Missing Origins: `0`
- Unexpected Origins: `0`
- Duplicate Canonical Origins: `0`

## 13. Persistence Parity

```text
Generic Rolling Daily Verification Persistence:
PASS

ARIMA-specific Table:
NO

New Database:
NO
```

Evidence:

- existing bridge and SG Runtime maintenance owner are already generic over `modelId`
- no ARIMA-specific verification schema or table was introduced

## 14. Execution / Cost Observation

Formal cost acceptance: `DEFERRED TO STAGE 7`

Observed Stage 4 operational evidence:

- synthetic ARIMA maintenance test module: `10 tests`, `OK`, about `164.667s`
- resumable coverage helper tests plus incremental maintenance tests: `15 tests`, `OK`, about `165.856s`
- full mixed focused Stage 4 validation slice after fixes: `64 tests`, `OK`, about `187.101s`
- completed resumable controlled historical verification: `36` batches, `6810.170992082974s` verification time, `0.8595881250221282s` fetch time, `2724` total verification records

This is sufficient evidence to accept the canonical Stage 4 run as computationally complete under the unchanged methodology.

## 15. Regression Result

Focused regression status:

- `tests.test_rolling_daily_incremental_maintenance`: `PASS`
- `tests.test_arima_historical_verification_resume`: `PASS`
- `tests.test_path_characterization`: `PASS`
- `tests.test_rolling_daily_method`: `PASS`
- `tests.test_rolling_daily_current_forecast_export`: `PASS`
- `tests.test_phase2`: `PASS`

## 16. Prediction Band Status

`Prediction Band: NOT IMPLEMENTED IN STAGE 4`

## 17. Four-Model Ranking Status

```text
Model Ranking:
NOT PERFORMED

Champion:
NOT DEFINED
```

## 18. Public Exposure

```text
Public SG Runtime ARIMA Exposure:
NOT ADDED

Dashboard ARIMA Exposure:
NOT ADDED
```

## 19. Deployment

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

## 20. PMOS Completion State

Result: `CLOSEOUT_COMPLETE`

Evidence:

- `cd apps/pmos && npm run pmos:save -- --bootstrap-input .pmos/recovery/bootstrap-inputs/2026-08-20_arima-stage-4-historical-rolling-verification-v1-02.json`: `PASS`
- `cd apps/vector && npm run runtime:build-context`: `PASS` via delegated `pmos:context`
- `cd apps/pmos && npm run pmos:verify-runtime`: `PASS`
- `cd apps/pmos && npm run recovery:check-execution-trail -- --base 2026-08-20-23:21_arima-stage-4-historical-rolling-verification-v1`: `PASS`
- `cd apps/pmos && npm run recovery:check-archive -- --base 2026-08-20-23:21_arima-stage-4-historical-rolling-verification-v1`: `PASS`

Closeout evidence confirms `closeoutState = CLOSEOUT_COMPLETE` for conversation `2026-08-20-arima-stage-4-historical-rolling-verification-v1-02`.

## 21. Files Changed

- `tooling/Benchmark-Forecasting/tests/test_rolling_daily_incremental_maintenance.py`
- `tooling/Benchmark-Forecasting/tests/test_arima_historical_verification_resume.py`
- `tooling/Benchmark-Forecasting/scripts/validate_arima_historical_rolling_verification.py`
- `tooling/Benchmark-Forecasting/validation/arima_stage4_historical_verification_wocaes0074.json`
- `tooling/Benchmark-Forecasting/ARIMA_HISTORICAL_ROLLING_VERIFICATION_ACCEPTANCE.md`
- `apps/pmos/.pmos/recovery/bootstrap-inputs/2026-08-20_arima-stage-4-historical-rolling-verification-v1-02.json`

## 22. Stage 5 Recommendation

Stage 4 is complete and Stage 5 is `READY`, but Stage 5 work remains out of scope for this task and was not started here.
