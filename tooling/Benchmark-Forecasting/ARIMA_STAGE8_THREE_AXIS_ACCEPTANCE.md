# ARIMA Stage 8 Three-Axis Acceptance

Status: STAGE 8 ACCEPTANCE
Date: 2026-08-21T18:49:40Z

## Executive Result

ARIMA Three-Axis Acceptance: PASS
Stage 9 Readiness: READY
Controlled Benchmark: wocaes0074
Model: ARIMA
Method: ROLLING_DAILY_POINT_IN_TIME
Method Version: rolling-daily-point-in-time-v1
Target Basis: POINT_IN_TIME

## Three-Axis Summary

| Axis | Status | Core Evidence | Key Limitation |
| --- | --- | --- | --- |
| Methodological Correctness | PASS | ARIMA_ROLLING_DAILY_MODEL_CONTRACT_PARITY_AUDIT.md; ARIMA_ROLLING_DAILY_CURRENT_FORECAST_ACCEPTANCE.md | Base rolling-daily method spec still contains a stale pre-Stage-1 sentence disabling ARIMA; current implementation and accepted Stage 1-7 evidence supersede that line under the implementation-wins rule. |
| Low Cost | PASS | ARIMA_HISTORICAL_ROLLING_VERIFICATION_ACCEPTANCE.md; rolling_daily_stage7_performance_cost_wocaes0074.json | Incremental maintenance persistence timing was intentionally not measured separately to avoid mutating canonical runtime truth during characterization. |
| Fast / Reproducible Serving | PASS | ARIMA_REPRODUCIBILITY_FAST_SERVING_ACCEPTANCE.md; rolling_daily_stage7_performance_cost_wocaes0074.json | Prepared-read latency is runtime datastore-read evidence, not full deployed browser/network latency. |

## Methodological Correctness

No leakage: PASS
Bounded ARIMA policy: PASS
Historical Origin Coverage: 681 / 681
Common Cohort Parity: PASS
Reproducibility: PASS
Band Methodology: PASS
Point Forecast Mutation: NO
Final Axis: PASS

ARIMA remains a model inside the accepted ROLLING_DAILY_POINT_IN_TIME method, not a separate forecast method. Stage 4 and Stage 5 evidence show lawful DAILY-only execution, full pre-origin training history retention, no synthetic observations, no future leakage, one fit per origin, and strict common-cohort parity against naive, damped_holt, and ets on the same benchmark, target identities, actuals, and metric definitions.

Selected-order distribution from accepted evidence remains internally consistent with the required 681-origin universe: ARIMA(1,1,2)=9, ARIMA(2,1,0)=17, ARIMA(2,1,1)=115, ARIMA(2,1,2)=540. Stage 6 adds a leakage-free empirical P10/P90 residual band with no point-forecast mutation and corrected origin-to-1M interpolation semantics.

Key limitation: Base rolling-daily method spec still contains a stale pre-Stage-1 sentence disabling ARIMA; current implementation and accepted Stage 1-7 evidence supersede that line under the implementation-wins rule.

## Low Cost

Fresh ARIMA compute: 14378.88518749969 ms median
Historical full verification: 6810.170992082974 s for 681 origins
Incremental maintenance evidence: 1753.756958001759 ms total without separate persistence timing
Band calibration: 1303.713915986009 ms median
Band interpolation: 0.7248330512084067 ms median
Prepared read: 27.162020499999983 ms median
Bounded Compute: PASS
Request-Time Fit: NO
Full Historical Replay During Normal Use: NO
Dedicated ARIMA Infrastructure: NO
Direct Currency Cost: NOT CALCULATED
Final Low Cost Axis: PASS

ARIMA is materially more expensive to fit than naive, damped_holt, and ets. That cost does not enter the accepted user-facing path because the architecture is bounded to one 17-candidate non-seasonal AICc search, historical verification is offline, calibration is built from persisted residual evidence, incremental maintenance is a separate maintenance unit, and Dashboard serving consumes prepared state without refitting ARIMA.

Key limitation: Incremental maintenance persistence timing was intentionally not measured separately to avoid mutating canonical runtime truth during characterization.

## Fast / Reproducible Serving

Canonical Prepared Read Owner: rollingDailyCurrentForecastSnapshot
Canonical Dashboard Read Seam: apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts
Prepared Read Median: 27.162020499999983 ms
ARIMA Fit On Request: NO
Historical Calibration On Request: NO
Persistence Mutation On Read: NO
Benchmark Finder Dependency: NO
Forecast Reproducibility: PASS
Final Serving Axis: PASS

The corrected Stage 7 authority is the Dashboard Library prepared-snapshot read path from rollingDailyCurrentForecastSnapshot through apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts. That read stays deterministic, read-only, model-specific, independent of Benchmark Finder and AppShell, and does not trigger ARIMA fitting, historical verification recomputation, or calibration rebuilds.

Post-Stage-7 Dashboard v3 demo work is acknowledged only as consumer-level context: ARIMA was added to the existing Forecast Portfolio v3 model union and the dashboard read seam preserves modelId-specific snapshot and verification reads. This is practical serving confirmation, not a UI acceptance gate.

Key limitation: Prepared-read latency is runtime datastore-read evidence, not full deployed browser/network latency.

## Acceptance Logic

Overall acceptance rule:

PASS = all three axes PASS

FAIL = one or more axes FAIL

BLOCKED = no axis FAIL, but at least one axis lacks sufficient evidence

No weighted score. No majority rule.

## What This Does Not Mean

Stage 8 PASS does not mean ARIMA is the best model.
Stage 8 PASS does not mean ARIMA becomes Champion.
Stage 8 PASS does not mean ARIMA becomes default.
Stage 8 PASS does not mean automatic model selection exists.

Stage 8 PASS means ARIMA is accepted as a first-class eligible Forecast Model under the three equal architectural/product constraints.

## Comparative Context

| Horizon | ARIMA MAE | ARIMA Bias | Lowest MAE Model | Highest Directional Accuracy Model | Lowest Absolute Bias Model |
| --- | ---: | ---: | --- | --- | --- |
| 1M | 5.794185554400608 | -0.026742784203338126 | naive | ets | arima |
| 3M | 9.731616568699186 | -0.07822664964227649 | naive | ets | arima |
| 6M | 11.62529182607595 | -1.3935076744303811 | ets | ets | arima |
| 12M | 16.047546032387707 | 2.191068121796691 | ets | ets | damped_holt |

ARIMA is competitive but not dominant across all horizons. Naive is stronger on 1M and 3M MAE-family metrics, ETS is stronger on 6M and 12M MAE-family metrics and directional accuracy, while ARIMA is closest to zero Bias at 1M, 3M, and 6M but weaker on 12M Bias. These are descriptive findings only and do not redefine methodological correctness.

## Deferred Work

Stage 9: NOT EXECUTED
Stage 10: NOT EXECUTED
Stage 11 Formal Acceptance: NOT EXECUTED
Stage 12 Formal Acceptance: NOT EXECUTED
Stage 13: NOT EXECUTED
Naive/Holt/ETS Prediction Band Pre-1M Parity: DEFERRED
Benchmark Finder Contamination Audit: DEFERRED
Deployment Hardening: DEFERRED
Broader Regression Tests: DEFERRED
