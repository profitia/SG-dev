# ARIMA Empirical Prediction Band Acceptance

Status: STAGE 6 ACCEPTANCE
Scope: deterministic empirical residual P10/P90 band for ARIMA under ROLLING_DAILY_POINT_IN_TIME on wocaes0074
Date: 2026-08-21

## 1. Executive Result

`ARIMA Empirical Prediction Band: PASS`
`Stage 7 Readiness: NOT STARTED`

The accepted implementation attaches a deterministic, leakage-free, non-parametric empirical residual band to the existing ARIMA current point-forecast path without mutating the point forecast path, without historical model refits, and without public-surface or deployment changes.

## 2. Comparison Identity

```text
seriesId: wocaes0074
display: Brent, Spot, FOB North Sea
forecastMethod: ROLLING_DAILY_POINT_IN_TIME
methodVersion: rolling-daily-point-in-time-v1
targetBasis: POINT_IN_TIME
modelId: arima
currentOrigin: 2026-08-18
```

## 3. Band Method

- Method: `EMPIRICAL_RESIDUAL_QUANTILES`
- Version: `empirical-residual-quantiles-v1`
- Residual rule: `actual - forecast`
- Lower quantile: `0.1`
- Median diagnostic quantile: `0.5`
- Upper quantile: `0.9`
- Quantile interpolation: `HF7_LINEAR_INTERPOLATION`
- Daily interpolation: `CALENDAR_TIME_LINEAR_INTERPOLATION` over `CALENDAR_TIME`
- Minimum calibration samples: `30`

## 4. Per-Horizon Calibration

| Horizon | Sample | P10 Residual | P50 Residual | P90 Residual | Status |
| --- | ---: | ---: | ---: | ---: | --- |
| 1M | 659 | -7.447065428 | -0.38882793 | 7.427345650000007 | AVAILABLE |
| 3M | 615 | -12.584608044 | -2.32269084 | 16.89735407600004 | AVAILABLE |
| 6M | 553 | -12.408579959999999 | -4.08283176 | 30.986183802000003 | AVAILABLE |
| 12M | 423 | -19.512656728 | -9.4377865 | 31.017605450000012 | AVAILABLE |

## 5. Historical Expanding Validation

| Horizon | Evaluated | Insufficient | Inside Band | Outside Band | Diagnostic Coverage | First Available Origin |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1M | 609 | 50 | 399 | 210 | 0.6551724137931034 | 2024-03-12 |
| 3M | 522 | 93 | 281 | 241 | 0.5383141762452107 | 2024-05-10 |
| 6M | 394 | 159 | 220 | 174 | 0.5583756345177665 | 2024-08-12 |
| 12M | 133 | 290 | 10 | 123 | 0.07518796992481203 | 2025-02-12 |

## 6. Current Anchor Bands

| Horizon | Target Date | Point Forecast | Lower | Upper | Lower Offset | Upper Offset | Sample |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1M | 2026-09-18 | 90.31392180812654 | 82.86685638012653 | 97.74126745812654 | -7.447065428 | 7.427345650000007 | 659 |
| 3M | 2026-11-18 | 90.55935733782876 | 77.97474929382875 | 107.4567114138288 | -12.584608044 | 16.89735407600004 | 615 |
| 6M | 2027-02-18 | 90.9543600481612 | 78.54578008816121 | 121.9405438501612 | -12.408579959999999 | 30.986183802000003 | 553 |
| 12M | 2027-08-18 | 91.72622054891963 | 72.21356382091963 | 122.74382599891965 | -19.512656728 | 31.017605450000012 | 423 |

## 7. Guardrails

- minimumCalibrationSamples: `30`
- minimumCalibrationSampleGate: `PASS`
- historicalVerificationRefitsPerformed: `0`
- historicalForecastMutationsPerformed: `0`
- currentForecastFitsPerformed: `1`
- anchorPathParity: `True`
- pathEndsAt12MAnchor: `True`
- pre1MCurrentBandPolicy: `INTERPOLATE_FROM_ORIGIN_ZERO_TO_1M_EMPIRICAL_ANCHOR`
- availabilityRule: `verificationObservedAt <= calibrationOrigin`
- pointForecastMutation: `NOT_PERFORMED`
- historicalRefitPolicy: `FORBIDDEN`

## Pre-1M Current Band Semantics Verification

- Meaning: `Current daily band is present after origin and expands linearly by actual lead days from origin zero-width to the 1M empirical anchor under CALENDAR_MONTH_CLAMP.`
- Policy: `INTERPOLATE_FROM_ORIGIN_ZERO_TO_1M_EMPIRICAL_ANCHOR`
- Origin date: `2026-08-18`
- 1M target date: `2026-09-18`
- Origin invariant: `includedInPath=False, lowerResidualOffset=0.0, upperResidualOffset=0.0, bandWidth=0.0`
- Pre-1M path dates: `30`
- Zero-width pre-1M dates: `0`
- Non-zero-width pre-1M dates: `30`
- First post-origin point: `2026-08-19` with offsets `-0.24022791703225807` / `0.23959179516129053` at fraction `0.03225806451612903` from `ORIGIN` to `1M`
- 1M anchor offsets: `-7.447065428` / `7.427345650000007` on `2026-09-18`
- Current band withheld before 1M: `False`
- Verification pass: `True`

## 8. Deployment and Ranking

- Stage 7: `NOT STARTED`
- Ranking: `NOT PERFORMED`
- Deployment: `NOT PERFORMED`
- Dashboard/public API changes: `NOT PERFORMED`

