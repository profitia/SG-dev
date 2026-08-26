# ROLLING_DAILY_POINT_IN_TIME Method Specification

## Scope

`ROLLING_DAILY_POINT_IN_TIME` is a Forecast Core method for lawful DAILY-origin forecasting without changing existing monthly Forecast Core behavior.

This method is an orchestration layer over existing model families. It does not introduce new forecasting mathematics. It reuses:

- `naive`
- `damped_holt`
- `ets`
- `arima`

The method is implemented in:

- `forecasting/date_grid.py`
- `forecasting/rolling_daily_contracts.py`
- `forecasting/rolling_daily_point_in_time.py`

## Input Contract

Required series properties:

- frequency must be `DAILY`
- observations must be strictly increasing by calendar date
- duplicate dates are rejected
- minimum lawful numeric history is controlled by `minimum_training_observations` and defaults to `60`

The method operates on lawful numeric DAILY observations only. Upstream explicit `null` placeholders remain excluded before Forecast Core input formation, consistent with the target-basis canon.

## Method Semantics

### Forecast origin

- Each forecast origin is a lawful observed DAILY date already present in the input history.
- Current forecast origin is the last lawful observation in the input series.
- Backtest origins start at `minimum_training_observations - 1` and roll one lawful observation at a time.

### Calendar target rule

- Target horizons are expressed in calendar months, not in a fixed count of business days.
- Target dates are computed with calendar-month clamp semantics.
- Default anchor horizons are `1M`, `3M`, `6M`, `12M`.

### Verification observation rule

- For each origin and target calendar date, the method resolves the latest lawful observation on or before that target date.
- If no lawful verification observation exists, that origin-horizon pair is skipped from expected coverage.

### Path generation rule

- One model fit is performed per origin.
- The fitted model generates a DAILY path in projected lawful step space.
- Projected steps are derived from the observed weekday set in history rather than from synthetic fills.
- Current output exposes the full projected daily path plus anchor points.

### Model reuse policy

- `naive` reuses last-value persistence.
- `damped_holt` reuses the existing fitted path helper.
- `ets` reuses the ETS candidate-selection path helper.
- `arima` reuses the bounded non-seasonal ARIMA candidate-selection path helper under the same rolling-daily origin, target, verification, and training-history rules as the other accepted models.

For `arima` under the rolling daily method, the orchestration keeps the accepted bounded non-seasonal policy:

- `17` candidate orders
- AICc-based selection
- deterministic tie-break behavior
- one fit per origin
- no `auto_arima`

For `ets` under the rolling daily method, the orchestration uses the non-seasonal candidate subset:

- `ETS(A,N,N)`
- `ETS(A,A,N)`
- `ETS(A,Ad,N)`

This avoids imposing artificial monthly seasonality on lawful DAILY-origin projection.

## Error and metric semantics

- Error convention remains `forecast - actual`.
- Metrics remain aligned with the existing Forecast Core canon: `MAE`, `RMSE`, `MASE`, `sMAPE`, `Directional Accuracy`, `Bias`.

## Prediction bands

- Prediction bands are empirical, not model-parametric.
- Residuals are gathered independently per anchor horizon from rolling backtest records.
- Bands use empirical `p10` and `p90` residual quantiles.
- Band statuses are:
  - `AVAILABLE`
  - `INSUFFICIENT_CALIBRATION_HISTORY`
  - `NOT_AVAILABLE`

## Availability and failure states

Current forecast status may be:

- `AVAILABLE`
- `UNSUPPORTED_FREQUENCY`
- `INSUFFICIENT_HISTORY`
- `MODEL_NOT_AVAILABLE`
- `INSUFFICIENT_CALIBRATION_HISTORY`
- `FAILED`

## Regression boundary

This method must not mutate locked monthly behavior. Monthly regressions remain governed by the existing Phase 1 and Phase 2 Forecast Core test surfaces.

## Non-goals

- no UI work
- no Dashboard implementation
- no implicit DAILY-to-MONTHLY training conversion inside this method
- no synthetic weekend or holiday fills
- no separate ARIMA forecast method outside `ROLLING_DAILY_POINT_IN_TIME`