# Four-Model Comparative Backtest Acceptance

Status: STAGE 5 ACCEPTANCE
Scope: `ROLLING_DAILY_POINT_IN_TIME` four-model comparative backtest for `naive`, `damped_holt`, `ets`, `arima`
Date: 2026-08-21

Historical context:

- Initial Stage 5: BLOCKED - missing common comparison surface
- Evidence completion: BLOCKED - missing ARIMA per-record forecast truth
- ARIMA recovery: NOT FOUND
- Minimal ARIMA Re-computation: PASS
- Final Evidence Completion: PASS

## 1. Executive Result

`Four-Model Comparative Backtest: PASS`

`Stage 6 Readiness: READY`

## 2. Comparison Identity

```text
seriesId:
wocaes0074

display:
Brent, Spot, FOB North Sea

forecastMethod:
ROLLING_DAILY_POINT_IN_TIME

methodVersion:
rolling-daily-point-in-time-v1

targetBasis:
POINT_IN_TIME

models:
naive
damped_holt
ets
arima
```

## 3. Method Compatibility Gate

```text
Four-Model Method Compatibility:
PASS

Target-Date Parity:
PASS

Actual Parity:
PASS

Verification Observed-At Parity:
PASS

Error Convention Parity:
PASS
```

## 4. Coverage Summary

| Model | Expected Origins | Completed | Available | Unavailable | Missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Naive | 681 | 681 | 681 | 0 | 0 |
| Damped Holt | 681 | 681 | 681 | 0 | 0 |
| ETS | 681 | 681 | 681 | 0 | 0 |
| ARIMA | 681 | 681 | 681 | 0 | 0 |

## 5. Strict Common Cohort Counts

| Horizon | Naive Verified | Holt Verified | ETS Verified | ARIMA Verified | Common Cohort | Target-Date Parity | Actual Parity | Observed-At Parity |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| 1M | 659 | 659 | 659 | 659 | 659 | PASS | PASS | PASS |
| 3M | 615 | 615 | 615 | 615 | 615 | PASS | PASS | PASS |
| 6M | 553 | 553 | 553 | 553 | 553 | PASS | PASS | PASS |
| 12M | 423 | 423 | 423 | 423 | 423 | PASS | PASS | PASS |

## 6. Native Evidence - 1M

| Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive | 659 | 5.778725341426403 | 8.858194495024614 | 8.184333023958382 | 7.194060893720248 | 0.0030349013657056147 | -0.12922610015174502 |
| Damped Holt | 659 | 5.862543057101669 | 8.99836400588865 | 8.300758503727055 | 7.287733253509776 | 0.4658573596358118 | -0.10299126456752644 |
| ETS | 659 | 5.821287630212443 | 8.945305350639753 | 8.243422731136768 | 7.240806998904312 | 0.496206373292868 | -0.10945333242792085 |
| ARIMA | 659 | 5.794185554400608 | 8.874769253629276 | 8.206393366126747 | 7.210178382606082 | 0.47040971168437024 | -0.026742784203338126 |

## 7. Native Evidence - 3M

| Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive | 615 | 9.632325203252032 | 14.74031400311978 | 13.693818883225807 | 12.045951448867363 | 0.0 | -0.383447154471545 |
| Damped Holt | 615 | 9.777763042113822 | 15.01090929435712 | 13.897293563808844 | 12.178453523534712 | 0.4634146341463415 | -0.23968783944715455 |
| ETS | 615 | 9.709989494943088 | 14.885922921511115 | 13.802448057320992 | 12.115569937531877 | 0.4845528455284553 | -0.30578419276422814 |
| ARIMA | 615 | 9.731616568699186 | 14.78355455407172 | 13.835596779919006 | 12.149204573028225 | 0.4065040650406504 | -0.07822664964227649 |

## 8. Native Evidence - 6M

| Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive | 553 | 11.348264014466546 | 15.9628401156236 | 16.19673757878532 | 14.639758989512636 | 0.0018083182640144665 | -1.9801265822784806 |
| Damped Holt | 553 | 11.350310179258589 | 15.968492899671693 | 16.19965057244383 | 14.64211686655022 | 0.4719710669077758 | -1.9827886501446668 |
| ETS | 553 | 11.348263518589514 | 15.962835002685331 | 16.19673686957643 | 14.639758668426824 | 0.49909584086799275 | -1.9801253342495475 |
| ARIMA | 553 | 11.62529182607595 | 15.976483505764302 | 16.596548412604523 | 14.971099981223333 | 0.325497287522604 | -1.3935076744303811 |

## 9. Native Evidence - 12M

| Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive | 423 | 15.425271867612292 | 18.7012201660052 | 22.115784045972507 | 19.902791151732412 | 0.0 | 0.940307328605202 |
| Damped Holt | 423 | 15.42560822212766 | 18.70800294571145 | 22.11625000538226 | 19.903155967566782 | 0.4846335697399527 | 0.9365160438770689 |
| ETS | 423 | 15.425271588770688 | 18.701214283292032 | 22.115783657591955 | 19.902790993040757 | 0.5177304964539007 | 0.9403098396453886 |
| ARIMA | 423 | 16.047546032387707 | 18.960406816558983 | 23.01583689055598 | 20.618786946038128 | 0.3049645390070922 | 2.191068121796691 |

## 10. Strict Common Cohort - 1M

| Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive | 659 | 5.778725341426403 | 8.858194495024614 | 8.184333023958382 | 7.194060893720248 | 0.0030349013657056147 | -0.12922610015174502 |
| Damped Holt | 659 | 5.862543057101669 | 8.99836400588865 | 8.300758503727055 | 7.287733253509776 | 0.4658573596358118 | -0.10299126456752644 |
| ETS | 659 | 5.821287630212443 | 8.945305350639753 | 8.243422731136768 | 7.240806998904312 | 0.496206373292868 | -0.10945333242792085 |
| ARIMA | 659 | 5.794185554400608 | 8.874769253629276 | 8.206393366126747 | 7.210178382606082 | 0.47040971168437024 | -0.026742784203338126 |

## 11. Strict Common Cohort - 3M

| Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive | 615 | 9.632325203252032 | 14.74031400311978 | 13.693818883225807 | 12.045951448867363 | 0.0 | -0.383447154471545 |
| Damped Holt | 615 | 9.777763042113822 | 15.01090929435712 | 13.897293563808844 | 12.178453523534712 | 0.4634146341463415 | -0.23968783944715455 |
| ETS | 615 | 9.709989494943088 | 14.885922921511115 | 13.802448057320992 | 12.115569937531877 | 0.4845528455284553 | -0.30578419276422814 |
| ARIMA | 615 | 9.731616568699186 | 14.78355455407172 | 13.835596779919006 | 12.149204573028225 | 0.4065040650406504 | -0.07822664964227649 |

## 12. Strict Common Cohort - 6M

| Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive | 553 | 11.348264014466546 | 15.9628401156236 | 16.19673757878532 | 14.639758989512636 | 0.0018083182640144665 | -1.9801265822784806 |
| Damped Holt | 553 | 11.350310179258589 | 15.968492899671693 | 16.19965057244383 | 14.64211686655022 | 0.4719710669077758 | -1.9827886501446668 |
| ETS | 553 | 11.348263518589514 | 15.962835002685331 | 16.19673686957643 | 14.639758668426824 | 0.49909584086799275 | -1.9801253342495475 |
| ARIMA | 553 | 11.62529182607595 | 15.976483505764302 | 16.596548412604523 | 14.971099981223333 | 0.325497287522604 | -1.3935076744303811 |

## 13. Strict Common Cohort - 12M

| Model | Verified N | MAE | RMSE | MASE | sMAPE | Directional Accuracy | Bias |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Naive | 423 | 15.425271867612292 | 18.7012201660052 | 22.115784045972507 | 19.902791151732412 | 0.0 | 0.940307328605202 |
| Damped Holt | 423 | 15.42560822212766 | 18.70800294571145 | 22.11625000538226 | 19.903155967566782 | 0.4846335697399527 | 0.9365160438770689 |
| ETS | 423 | 15.425271588770688 | 18.701214283292032 | 22.115783657591955 | 19.902790993040757 | 0.5177304964539007 | 0.9403098396453886 |
| ARIMA | 423 | 16.047546032387707 | 18.960406816558983 | 23.01583689055598 | 20.618786946038128 | 0.3049645390070922 | 2.191068121796691 |

## 14. Metric Completeness Gate

- Native Required Metric Cells: 96
- Native Numeric Metric Cells: 96
- Native Missing Metric Cells: 0
- Strict Common Required Metric Cells: 96
- Strict Common Numeric Metric Cells: 96
- Strict Common Missing Metric Cells: 0
- Identity-Set Equality 1M: PASS
- Identity-Set Equality 3M: PASS
- Identity-Set Equality 6M: PASS
- Identity-Set Equality 12M: PASS
- Native Metric Parity: PASS
- Numeric Zero Preservation: PASS

## 15. Metric Leaders - Descriptive Only

1M:
Lowest MAE: Naive
Lowest RMSE: Naive
Lowest MASE: Naive
Lowest sMAPE: Naive
Highest Directional Accuracy: ETS
Lowest Absolute Bias: ARIMA

3M:
Lowest MAE: Naive
Lowest RMSE: Naive
Lowest MASE: Naive
Lowest sMAPE: Naive
Highest Directional Accuracy: ETS
Lowest Absolute Bias: ARIMA

6M:
Lowest MAE: ETS
Lowest RMSE: ETS
Lowest MASE: ETS
Lowest sMAPE: ETS
Highest Directional Accuracy: ETS
Lowest Absolute Bias: ARIMA

12M:
Lowest MAE: ETS
Lowest RMSE: ETS
Lowest MASE: ETS
Lowest sMAPE: ETS
Highest Directional Accuracy: ETS
Lowest Absolute Bias: Damped Holt

## 16. Current Path Structure Context

`NOT HISTORICAL ACCURACY`

| Model | Forecast Range | Direction Changes | Path Volatility |
| --- | ---: | ---: | ---: |
| Naive | 0.0 | 0 | 0.0 |
| Damped Holt | 0.6464096207250947 | 0 | 0.003884513802541537 |
| ETS | 0.0 | 0 | 0.0 |
| ARIMA | 1.6604047076156405 | 16 | 0.015522561503376152 |

## 17. ARIMA Fit Provenance

`ARIMA FIT PROVENANCE`

| Selected Order | Origins | Share |
| --- | ---: | ---: |
| ARIMA(1,1,2) | 9 | 0.013215859030837005 |
| ARIMA(2,1,0) | 17 | 0.024963289280469897 |
| ARIMA(2,1,1) | 115 | 0.16886930983847284 |
| ARIMA(2,1,2) | 540 | 0.7929515418502202 |

## 18. Horizon-by-Horizon Findings

1M:
- Naive has the lowest MAE on the strict common cohort.
- ETS has the highest Directional Accuracy on the strict common cohort.
- ARIMA is closest to zero Bias on the strict common cohort.
- ARIMA Bias is -0.026742784203338126 at 1M; this remains descriptive only and is not a model ranking.

3M:
- Naive has the lowest MAE on the strict common cohort.
- ETS has the highest Directional Accuracy on the strict common cohort.
- ARIMA is closest to zero Bias on the strict common cohort.
- ARIMA Bias is -0.07822664964227649 at 3M; this remains descriptive only and is not a model ranking.

6M:
- ETS has the lowest MAE on the strict common cohort.
- ETS has the highest Directional Accuracy on the strict common cohort.
- ARIMA is closest to zero Bias on the strict common cohort.
- ARIMA Bias is -1.3935076744303811 at 6M; this remains descriptive only and is not a model ranking.

12M:
- ETS has the lowest MAE on the strict common cohort.
- ETS has the highest Directional Accuracy on the strict common cohort.
- Damped Holt is closest to zero Bias on the strict common cohort.
- ARIMA Bias is 2.191068121796691 at 12M; this remains descriptive only and is not a model ranking.

## 19. Cross-Horizon Pattern Summary

- Strict common-cohort identity sets equal the native matured identity sets for all four models on all four horizons.
- Naive retains lawful zero or near-zero Directional Accuracy values on multiple horizons, and those zeros remain numeric evidence rather than being collapsed into missing values.
- ARIMA native and strict-common metrics remain numerically identical because identity-set equality passes on 1M, 3M, 6M, and 12M.
- ETS and Damped Holt retain materially higher Directional Accuracy than Naive on the strict common cohort across all four horizons.

## 20. What Stage 5 Does NOT Establish

```text
Champion Model:
NOT DEFINED

Preferred Model:
NOT DEFINED

Automatic Model Selection:
NOT BUILT

Model Ranking:
NOT PERFORMED
```

## 21. Prediction Band Status

`NOT PART OF STAGE 5`

## 22. Cost Status

`Formal Cost Acceptance: DEFERRED TO STAGE 7`

## 23. Persistence

```text
New Database:
NO

New Table:
NO

Schema Change:
NO

Forecast Data Mutation:
NO
```

## 24. Deployment

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

## 25. PMOS Completion State

```text
Persisted HANDOFF:
PENDING CURRENT TASK CLOSEOUT

PostgreSQL Persistence:
PENDING CURRENT TASK CLOSEOUT

Event Ledger Visibility:
PENDING CURRENT TASK CLOSEOUT

Render Validation:
NOT REQUIRED
```

## 26. Files Changed

- tooling/Benchmark-Forecasting/scripts/generate_stage5_four_model_comparative_backtest.py
- tooling/Benchmark-Forecasting/validation/four_model_stage5_comparative_backtest_wocaes0074.json
- tooling/Benchmark-Forecasting/FOUR_MODEL_COMPARATIVE_BACKTEST_ACCEPTANCE.md
- tooling/Benchmark-Forecasting/tests/test_generate_stage5_four_model_comparative_backtest.py

## 27. Recommended Next Step

Stage 6 - Empirical Prediction Band for ARIMA
