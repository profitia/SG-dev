# SpendGuru Benchmark Forecasting MVP - Forecasting Methods Specification

Document status: CANONICAL
Module: SpendGuru Benchmark Forecasting MVP
Audience: Developers, reviewers, implementation agents, maintainers
Purpose class: Authoritative mathematical and methodological specification
Last updated: 2026-08-23

## 1. Purpose

This document defines the authoritative statistical methodology for the first SpendGuru Benchmark Forecasting MVP model portfolio.

It exists to freeze the accepted mathematical baseline from Phase 1 and to define, before any further implementation, the exact methodological choices for:

- Naive
- Damped Holt
- ETS
- ARIMA

This document is the source of truth for:

- model definitions
- eligibility rules
- fitting rules
- parameter selection rules
- failure handling
- backtest fairness
- leakage prevention
- determinism expectations
- comparison policy

Implementation must follow this document.

This document does not implement any model.

Forecast Target Basis semantics are governed separately by:

- `FORECAST_TARGET_BASIS_CANON.md`

## 2. Scope

This specification applies to the current SpendGuru Forecasting MVP laboratory flow:

- canonical historical source: PostgreSQL runtime snapshot
- canonical benchmark history: Historical rows only
- current accepted benchmark set: three MONTHLY series from Phase 1
- current accepted backtest procedure: expanding-window rolling-origin

Additive approved live-input exception for forecast-input readiness:

- `wocaes0074` may enter Forecast Core through an explicit provider-neutral monthly payload derived from Dynamic Market Data Store daily market-price history
- the currently approved Target Bases for this live-input exception are `MONTHLY_AVERAGE` and `END_OF_PERIOD`
- `MONTHLY_AVERAGE` uses `AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS@daily-market-price-monthly-average-v2`
- `END_OF_PERIOD` uses `LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD@daily-market-price-end-of-period-v1`
- only closed calendar months are eligible for Forecast Core input
- explicit `null` daily rows are treated as missing-day placeholders and are excluded from monthly averaging
- the resulting canonical series must still satisfy the shared MONTHLY contract: first-of-month timestamps, regular monthly cadence, one numeric value per month, no synthetic gap repair
- for `END_OF_PERIOD`, canonical history must preserve exact `sourceObservedAt` provenance so SG Runtime can persist `ForecastVerificationPoint.actualObservedAt`
- this exception does not authorize broad frequency-generalized orchestration or silent conversion of arbitrary display series

`END_OF_PERIOD` remains governed semantically by `FORECAST_TARGET_BASIS_CANON.md`; this methods specification change does not alter model mathematics.

This specification is monthly-first.

It is authoritative for regular MONTHLY series under the current MVP.

It does not define a production confidence engine, automatic champion switching, SARIMA runtime, or broad frequency-generalized model orchestration.

## 3. Locked Phase 1 Baseline

The following baseline is already accepted and is locked for subsequent model work.

### 3.1 Naive baseline

For any forecast horizon h:

```text
y_hat(T+h) = y(T)
```

### 3.2 Shared backtest baseline

```text
Method: expanding-window rolling-origin
Minimum training window: 36 MONTHLY observations
```

### 3.3 Horizon baseline

For regular MONTHLY series:

```text
1M  = T + 1
3M  = T + 3
6M  = T + 6
12M = T + 12
```

### 3.4 Error convention

```text
error = forecast - actual
```

Positive error means over-forecasting.

Negative error means under-forecasting.

### 3.5 Locked metrics

The following metric definitions are locked unless a future canon change is approved explicitly:

- MAE
- RMSE
- MASE
- sMAPE
- Directional Accuracy
- Bias

## 4. Shared Forecasting Contract

All models in this MVP must operate on the same provider-neutral canonical contract.

### 4.1 Required input contract

Each model consumes a regular canonical time series with:

- one ordered observation per timestamp
- one scalar numeric target value per observation
- no duplicate timestamps
- no conflicting duplicate values
- no missing timestamps inside the declared cadence
- no missing target values
- no forecast-derived target contamination

### 4.2 Required current cadence assumptions

For the first portfolio implementation, the shared statistical methods contract assumes:

- frequency = MONTHLY
- cadence = regular monthly steps
- timestamps already canonicalized to first-of-month dates

### 4.3 Shared output contract

Each model must be able to produce:

- one-step and multi-step point forecasts for `1M`, `3M`, `6M`, `12M`
- origin-local backtest records
- model metadata sufficient for audit

### 4.4 Shared benchmark unit of evaluation

The fundamental evaluation unit is:

```text
benchmark + model + horizon
```

Not all horizons are assumed to have the same best-performing model.

## 5. Shared Backtesting Methodology

Every model in scope must use exactly the same backtesting geometry.

### 5.1 Core rule

For a series with observations:

```text
y_1, y_2, ..., y_N
```

and horizon h in monthly steps, the rolling-origin backtest must evaluate origins:

```text
T = 36, 37, ..., N - h
```

At each origin T:

- training history = `y_1 ... y_T`
- target value = `y_(T+h)`
- forecast origin date = timestamp of `y_T`
- forecast date = timestamp of `y_(T+h)`

### 5.2 Fairness rule

All models must be evaluated on the same:

- forecast origins
- target dates
- actual observations
- horizon semantics

No model may receive an easier evaluation window than another.

### 5.3 Eligibility interaction with fairness

To preserve fair same-origin comparisons in the first implementation, the operative minimum history requirement for model participation in the shared monthly backtest is:

```text
36 observations
```

If a model family is theoretically valid on shorter history, that does not change the shared MVP comparison window.

### 5.4 Current full-history forecast rule

After backtesting, a current forecast for each model family is produced by:

1. selecting the latest lawful contiguous canonical MONTHLY training suffix that ends at the Current Forecast origin
2. verifying that suffix satisfies the existing model minimum observation requirement
3. selecting the family configuration using that suffix only
4. fitting the selected configuration on that suffix only
5. forecasting `1M`, `3M`, `6M`, and `12M`

For Current Forecast only, a historical monthly gap that falls strictly before the selected latest lawful contiguous suffix does not invalidate preparation.

No interpolation, forward-fill, synthetic observation, or segment splicing is allowed. If the latest lawful contiguous suffix remains shorter than the existing model minimum, Current Forecast must remain unavailable and report insufficient contiguous history truthfully.

Historical Verification does not change under this rule. Verification origin policy, including `PREFERRED_BACKTEST_ORIGIN_FLOOR = 2024-01-01`, continues to bound origins only and does not truncate lawful pre-origin training history.

This step is allowed because it is not a historical backtest claim.

### 5.5 Generic backtest origin boundary

For a future separately authorized native-frequency extension, the preferred historical Forecast-origin floor is:

```text
PREFERRED_BACKTEST_ORIGIN_FLOOR = 2024-01-01
```

This is a compute and validation origin bound. It is not training-history truncation. Every origin continues to receive the full lawful training history available up to that origin.

Origins must advance through lawful eligible observations in the declared cadence, not through invented calendar points. If the lawful strict common cohort at or after the preferred floor is smaller than a separately approved minimum-origin policy, preparation may move the effective origin floor backward only to additional lawful model-eligible origins. It must never move earlier than the first origin allowed by the applicable training-history requirement.

If all available lawful eligible origins still fall below the approved minimum, preparation must use the available cohort and report limited-sample status truthfully. It must not create synthetic origins, interpolate, forward-fill, or derive the fallback floor by hardcoded calendar-year subtraction.

No numeric `MIN_BACKTEST_ORIGINS` value is frozen by this section. The value `24` remains a design candidate pending evidence-backed approval and must not be treated as a production constant.

## 6. Shared Metric Definitions

### 6.1 MAE

```text
MAE = mean(abs(forecast - actual))
```

### 6.2 RMSE

```text
RMSE = sqrt(mean((forecast - actual)^2))
```

### 6.3 sMAPE

```text
sMAPE = 100 * mean(2 * abs(F - A) / (abs(A) + abs(F)))
```

If:

```text
A = 0 and F = 0
```

then the contribution is:

```text
0
```

### 6.4 Bias

```text
Bias = mean(forecast - actual)
```

### 6.5 Directional Accuracy

Direction classes are:

- UP
- FLAT
- DOWN

They are determined by the sign of the change from the forecast origin value.

```text
predicted_direction = sign(forecast - origin_value)
actual_direction    = sign(actual - origin_value)
```

Directional Accuracy is the fraction of cases where both directions match exactly.

### 6.6 MASE

At each rolling origin T, define the origin-local naive scaling denominator on the training history only:

```text
scale_T = mean(abs(y_t - y_(t-1)))
```

computed only over observations available up to origin T.

Then:

```text
scaled_error_T = abs(forecast - actual) / scale_T
```

Final MASE:

```text
MASE = mean(scaled_error_T)
```

Rules:

- no future observations may contribute to `scale_T`
- do not hardcode `MASE(Naive) = 1`
- if `scale_T = 0` and `abs(forecast - actual) = 0`, contribution is `0`
- if `scale_T = 0` and `abs(forecast - actual) > 0`, contribution is `inf`

## 7. Naive Specification

### 7.1 Canonical definition

For any horizon h:

```text
y_hat(T+h) = y(T)
```

### 7.2 Statistical meaning

Naive is a persistence baseline.

It assumes the best forecast for the future is the most recent observed value.

### 7.3 Procurement explanation

The most recent observed benchmark value is used as the forecast for all requested horizons.

This is the minimum benchmark any more complex model must beat.

### 7.4 Eligibility

- minimum history for shared monthly comparison: 36 observations
- regular cadence required: YES
- missing values allowed: NO
- negative values allowed: YES
- seasonality required: NO
- positive-only assumption: NO

### 7.5 Parameters

Naive has no fitted statistical parameters.

### 7.6 Failure policy

Naive is INVALID only if:

- history is empty
- cadence contract is broken
- history contains non-finite values

## 8. Damped Holt Specification

### 8.1 Canonical model family

SpendGuru Damped Holt means:

```text
additive level
additive trend
damped trend
no seasonality
```

### 8.2 Canonical equations

Let:

- `l_t` = level at time t
- `b_t` = trend at time t
- `alpha` = level smoothing parameter
- `beta` = trend smoothing parameter
- `phi` = damping parameter

State updates:

```text
l_t = alpha * y_t + (1 - alpha) * (l_(t-1) + phi * b_(t-1))
b_t = beta * (l_t - l_(t-1)) + (1 - beta) * phi * b_(t-1)
```

h-step forecast:

```text
y_hat(T+h|T) = l_T + (phi + phi^2 + ... + phi^h) * b_T
```

If `phi = 1`, the model reduces to undamped Holt linear trend.

### 8.3 Business meaning

Damped Holt recognizes:

- the current level
- the recent trend
- the fact that the recent trend should weaken over longer horizons instead of extending linearly forever

This is useful for procurement benchmarks because many price and cost series move in trends for some time, but those trends often soften rather than continuing at full speed indefinitely.

### 8.4 Canonical implementation target

Preferred implementation target:

```python
statsmodels.tsa.holtwinters.ExponentialSmoothing(
    endog,
    trend="add",
    damped_trend=True,
    seasonal=None,
    initialization_method="estimated",
    use_boxcox=False,
)
```

Recommended fit posture:

```python
fit(
    optimized=True,
    remove_bias=False,
    method="L-BFGS-B",
    use_brute=False,
)
```

### 8.5 Parameter policy

Estimated from training history only:

- `alpha`
- `beta`
- `phi`
- initial level
- initial trend

Fixed policy decisions:

- `trend = "add"`
- `damped_trend = True`
- `seasonal = None`
- `initialization_method = "estimated"`
- `use_boxcox = False`
- `remove_bias = False`

### 8.6 Eligibility

- minimum history for shared monthly comparison: 36 observations
- regular cadence required: YES
- missing values allowed: NO
- negative values allowed: YES
- seasonality required: NO
- positive-only assumption: NO

### 8.7 Failure policy

Damped Holt candidate is INVALID if any of the following occurs:

- fit raises an exception
- fitted parameters are non-finite
- fitted forecast values are NaN or inf
- optimizer reports non-convergence where exposed by the library
- fitted state is numerically unstable enough to prevent finite forecast generation

No silent fallback is allowed.

If Damped Holt is INVALID at an origin, it is recorded as unavailable for that origin.

## 9. ETS Specification

### 9.1 Canonical meaning of ETS in SpendGuru

SpendGuru ETS does not mean "any exponential smoothing model".

SpendGuru ETS v1 means a bounded additive-error ETS family selected from a small predefined catalog.

### 9.2 Allowed ETS candidate catalog

Allowed candidates are:

- `ETS(A,N,N)`
- `ETS(A,A,N)`
- `ETS(A,Ad,N)`
- `ETS(A,N,A)`
- `ETS(A,A,A)`
- `ETS(A,Ad,A)`

Interpretation:

- `A` = additive
- `Ad` = additive damped
- `N` = none

### 9.3 Explicitly forbidden ETS variants in MVP v1

Not allowed:

- multiplicative error
- multiplicative trend
- multiplicative seasonality
- Box-Cox transformed ETS
- ad hoc seasonal period fallback such as `seasonality = 2`

Reason:

- additive-only variants are simpler
- additive-only variants remain valid for non-positive values
- additive-only variants are easier to explain and audit
- additive-only variants reduce instability and avoid hidden data-transformation assumptions

### 9.4 Seasonal ETS policy

Seasonal ETS is allowed only when all of the following are true:

- series frequency is MONTHLY
- cadence is regular monthly
- training history length is at least 36 observations
- no missing values are present

Seasonal period is fixed as:

```text
seasonal_periods = 12
```

If any of the above conditions fail:

```text
seasonal ETS = NOT ELIGIBLE
```

There is no fallback seasonal period of `2` or any other synthetic seasonal hack.

### 9.5 Seasonal presence policy

SpendGuru ETS v1 does not add a second external seasonality hypothesis test before fitting.

Instead:

- seasonal variants enter the candidate catalog only if the monthly seasonal eligibility rules are met
- the origin-local selector decides whether a seasonal or non-seasonal variant is preferred using training-history-only information

This avoids unstable pretest branching while still preventing illegal seasonal fits on insufficient history.

### 9.6 Canonical implementation target

Preferred implementation target:

```python
statsmodels.tsa.exponential_smoothing.ets.ETSModel(
    endog,
    error="add",
    trend=...,            # None or "add"
    damped_trend=...,     # False or True
    seasonal=...,         # None or "add"
    seasonal_periods=12,  # when seasonal is not None
    initialization_method="estimated",
)
```

Recommended fit posture:

```python
fit(
    maxiter=1000,
    full_output=True,
    disp=False,
)
```

### 9.7 Parameter policy

Estimated from training history only where applicable:

- `smoothing_level`
- `smoothing_trend`
- `smoothing_seasonal`
- `damping_trend`
- initial level
- initial trend
- initial seasonal states

Fixed methodological decisions:

- `error = "add"`
- `trend in {None, "add"}` only
- `seasonal in {None, "add"}` only
- `damped_trend in {False, True}` only where catalog requires it
- `initialization_method = "estimated"`

### 9.8 Intra-family selection policy

At each rolling origin:

1. build the eligible ETS candidate set from the fixed catalog
2. fit each candidate on training history only
3. discard invalid candidates
4. among remaining valid candidates, select the one with lowest AICc
5. if AICc tie is within a negligible tolerance, choose the simpler candidate according to this deterministic precedence:

```text
ETS(A,N,N)
ETS(A,A,N)
ETS(A,Ad,N)
ETS(A,N,A)
ETS(A,A,A)
ETS(A,Ad,A)
```

AICc is an intra-family selector only.

It is not the final cross-family quality criterion.

### 9.9 Eligibility

For the ETS family overall:

- minimum history for shared monthly comparison: 36 observations
- regular cadence required: YES
- missing values allowed: NO
- negative values allowed: YES
- positive-only assumption: NO

Additional seasonal requirement:

- `seasonal_periods = 12` requires monthly cadence and at least 36 observations

### 9.10 Failure policy

An ETS candidate is INVALID if any of the following occurs:

- fit raises an exception
- optimizer fails to produce a valid fitted result
- fitted parameters are non-finite
- AICc is non-finite
- forecast values are NaN or inf
- fitted state is numerically unstable enough to prevent finite forecast generation

If all ETS candidates are invalid at an origin:

```text
ETS = NOT AVAILABLE
```

No silent fallback is allowed.

## 10. ARIMA Specification

### 10.1 Canonical meaning of ARIMA in SpendGuru

SpendGuru ARIMA v1 means a bounded non-seasonal ARIMA family with deterministic candidate generation.

No seasonal ARIMA behavior is part of this first implementation.

### 10.2 Canonical model family

General form:

```text
ARIMA(p,d,q)
```

with:

- `p` = autoregressive order
- `d` = differencing order
- `q` = moving average order

### 10.3 Canonical candidate space

SpendGuru ARIMA v1 uses this bounded candidate set:

```text
p in {0, 1, 2}
d in {0, 1}
q in {0, 1, 2}
exclude (0, 0, 0)
```

This yields a small controlled search space.

No larger automatic search is allowed.

### 10.4 Differencing policy

`d` is not chosen by an unconstrained automatic search.

Instead:

- both `d = 0` and `d = 1` are represented explicitly inside the bounded candidate set
- no higher differencing order is allowed in MVP v1

Stationarity tests may be logged later as diagnostics, but they do not govern candidate generation in MVP v1.

Reason:

- unit-root tests can be unstable at this sample size
- bounded candidate evaluation is simpler and more reproducible

### 10.5 Constant and drift policy

This policy is explicit and must not be delegated to library defaults.

For `d = 0` candidates:

```text
trend = "c"
```

Meaning:

- constant mean is allowed
- no linear time trend is allowed

For `d = 1` candidates:

```text
trend = "t"
```

Meaning:

- drift is allowed through a linear trend in the integrated specification
- constant-only integrated candidates are not used

Not allowed:

- `trend = "ct"`
- library-default trend delegation

### 10.6 Canonical implementation target

Preferred implementation target:

```python
statsmodels.tsa.arima.model.ARIMA(
    endog,
    order=(p, d, q),
    seasonal_order=(0, 0, 0, 0),
    trend=...,
    enforce_stationarity=True,
    enforce_invertibility=True,
    concentrate_scale=False,
    validate_specification=True,
)
```

Recommended fit posture:

```python
fit(
    method="statespace",
    low_memory=False,
)
```

### 10.7 Parameter policy

Estimated from training history only:

- AR coefficients
- MA coefficients
- intercept when `d = 0`
- drift-equivalent trend term when `d = 1`
- innovation variance

Fixed methodological decisions:

- `seasonal_order = (0, 0, 0, 0)`
- `enforce_stationarity = True`
- `enforce_invertibility = True`
- no exogenous regressors

### 10.8 Intra-family selection policy

At each rolling origin:

1. enumerate the fixed ARIMA candidate set
2. fit each candidate on training history only
3. discard invalid candidates
4. among remaining valid candidates, select the one with lowest AICc
5. if AICc tie is within a negligible tolerance, choose deterministically by:

```text
lower d
then lower (p + q)
then lower p
then lower q
```

AICc is an intra-family selector only.

It is not the final cross-family quality criterion.

### 10.9 Eligibility

- minimum history for shared monthly comparison: 36 observations
- regular cadence required: YES
- missing values allowed: NO
- negative values allowed: YES
- positive-only assumption: NO
- seasonality required: NO

### 10.10 Failure policy

An ARIMA candidate is INVALID if any of the following occurs:

- fit raises an exception
- optimizer fails to converge where convergence status is exposed
- parameters are non-finite
- AICc is non-finite
- fitted forecast values are NaN or inf
- model violates the enforced stationarity or invertibility constraints
- the fitted result is numerically unstable enough to prevent finite forecast generation

If all ARIMA candidates are invalid at an origin:

```text
ARIMA = NOT AVAILABLE
```

No silent fallback is allowed.

## 11. Model Eligibility

### 11.1 Shared eligibility rules

All models require:

- regular MONTHLY cadence
- one value per monthly timestamp
- no missing values
- no duplicate timestamps after canonicalization
- no forecast-derived training targets
- at least 36 observations for shared monthly comparison

### 11.2 Eligibility table

| Model | Minimum history | Regular cadence required | Missing values allowed | Negative values allowed | Positive-only assumption | Seasonality required |
| --- | --- | --- | --- | --- | --- | --- |
| Naive | 36 | YES | NO | YES | NO | NO |
| Damped Holt | 36 | YES | NO | YES | NO | NO |
| ETS non-seasonal | 36 | YES | NO | YES | NO | NO |
| ETS seasonal | 36 | YES | NO | YES | NO | MONTHLY with seasonal_periods=12 |
| ARIMA | 36 | YES | NO | YES | NO | NO |

## 12. Model Fitting Rules

### 12.1 Shared fitting rule

Every fit must use only training history available at the current origin.

No parameter, state, differencing decision, seasonal state, or model variant may be imported from a future origin.

### 12.2 Shared origin procedure

For a family with one fixed specification:

```text
origin T
  -> fit on y_1...y_T
  -> forecast T+h
```

For a family with internal candidates:

```text
origin T
  -> build candidate set from y_1...y_T
  -> fit valid candidates on y_1...y_T
  -> select candidate on y_1...y_T only
  -> forecast T+h
```

### 12.3 Full-history current forecast procedure

For current production-like forecast generation:

```text
full history y_1...y_N
  -> build candidate set on y_1...y_N only
  -> fit valid candidates on y_1...y_N only
  -> select candidate on y_1...y_N only
  -> forecast future horizons
```

## 13. Parameter Selection Policy

### 13.1 Locked shared policy

SpendGuru uses:

- fixed family definitions
- small bounded candidate catalogs
- origin-local estimation
- origin-local selection

SpendGuru does not use:

- unconstrained auto-search
- manual hidden tuning inside backtest
- full-series preselection reused across historical origins

### 13.2 Selection levels

Selection happens at two levels only.

Level 1: inside family

- Damped Holt: no variant selection, only parameter estimation
- ETS: AICc selects among valid bounded ETS candidates
- ARIMA: AICc selects among valid bounded ARIMA candidates

Level 2: across families

- cross-family judgment uses rolling backtest metrics only
- information criteria do not replace out-of-sample evaluation

### 13.3 Why AICc

AICc is preferred over plain AIC inside ETS and ARIMA family selection because sample sizes are small at many origins.

## 14. Failure Policy

### 14.1 Shared principle

Failure handling must be explicit.

The canonical logic is:

```text
candidate fails
  -> mark candidate INVALID
  -> continue with remaining candidates
```

If all candidates in a family fail:

```text
family = NOT AVAILABLE
```

### 14.2 Explicitly forbidden behavior

Not allowed:

- silent fallback
- replacing failed outputs with invented values
- falling back to future-fitted parameters
- claiming a model succeeded when fit diagnostics show failure

### 14.3 Invalid output conditions

At minimum, any candidate producing one of the following is INVALID:

- exception during fit
- non-finite fitted parameters
- non-finite AICc when AICc is required for selection
- non-finite forecast values
- numerically broken state that prevents auditable prediction

## 15. Data Leakage Prevention

### 15.1 No future leakage rule

At each origin T, the following may use only data up to and including T:

- fit
- parameter estimation
- initialization
- seasonal state estimation
- differencing choice inside bounded candidate evaluation
- AICc computation
- candidate selection
- MASE scaling denominator

### 15.2 Explicit leakage prohibition

Forbidden:

```text
full series
  -> choose best ETS or ARIMA configuration
  -> reuse that configuration for all past origins
```

This is leakage.

### 15.3 Allowed backtest family selection pattern

Allowed:

```text
origin T
  -> training y_1...y_T
  -> choose valid family configuration on y_1...y_T only
  -> fit on y_1...y_T only
  -> forecast T+h
```

### 15.4 Source-data leakage prevention

Training history must exclude:

- rows where `VALUE_TYPE = Forecast`
- `LCI_VALUE`
- `UCI_VALUE`
- `% DIFF`
- forecast-accuracy pipeline outputs

Ground truth is historical realized value only.

## 16. Determinism

### 16.1 Required posture

All models in this MVP must be:

- deterministic
- reproducible
- auditable

### 16.2 Determinism rules

Required:

- fixed candidate catalogs
- fixed tie-break order
- fixed trend policy for ARIMA
- fixed seasonal period for seasonal ETS
- no random train/test split
- no stochastic model class
- no automatic data transformation search

### 16.3 Implementation guidance

Avoid optimization settings that introduce unnecessary nondeterministic search behavior.

In particular, MVP implementations should avoid:

- basin-hopping style global search
- randomized starts
- hidden data-dependent candidate generation outside the canon

### 16.4 Known residual nondeterminism surface

Numerical optimizers can still produce tiny floating-point differences across environments.

This is acceptable if:

- selected candidate identity remains stable
- backtest metrics remain materially stable
- differences are at floating-point tolerance scale only

## 17. Model Comparison

### 17.1 Comparison principle

Every challenger is compared first against:

```text
Naive baseline
```

### 17.2 Required reporting surface

For each benchmark and horizon, report at least:

- MAE
- RMSE
- MASE
- sMAPE
- Directional Accuracy
- Bias

### 17.3 No composite champion rule

SpendGuru MVP v1 does not define one global composite score.

### 17.4 Comparison posture

Primary lens:

- MASE relative to Naive

Secondary lenses:

- RMSE
- sMAPE
- Directional Accuracy
- Bias

Interpretation rule:

- better MASE matters strongly
- but a model is not considered clearly superior if it wins only on one metric while materially degrading the others

### 17.5 Human decision posture

The first implementation should present full metric evidence.

It should not auto-select a global champion across all horizons.

## 18. Horizon-Specific Evaluation

Horizon-specific evaluation is mandatory.

Allowed conclusion pattern:

```text
1M  -> ARIMA best
3M  -> ETS best
6M  -> Damped Holt best
12M -> Damped Holt best
```

Not allowed:

- assuming a model that wins on one horizon wins on all horizons
- collapsing all horizons into one undifferentiated score for MVP v1

## 19. Explainability

### 19.1 Naive

Statistical explanation:

- future value equals the latest observed value

Procurement explanation:

- the market is assumed to stay where it is now until evidence proves otherwise

### 19.2 Damped Holt

Statistical explanation:

- the model tracks current level and trend
- the trend contribution decays with horizon through the damping parameter

Procurement explanation:

- recent benchmark movement continues into the forecast, but its influence fades with distance into the future

### 19.3 ETS

Statistical explanation:

- the family models level, optional trend, optional damping, and optional seasonality under additive-error exponential smoothing

Procurement explanation:

- the model can capture stable monthly level behavior, medium-term trend, and repeating yearly patterns when the data support them

### 19.4 ARIMA

Statistical explanation:

- the model explains the series using autoregressive memory, moving-average shock structure, and optional first differencing

Procurement explanation:

- the forecast uses how the benchmark has been changing, not only its last value or a smoothed trend, and can capture serial patterns that smoothing models may miss

## 20. Prediction Interval Posture

Prediction intervals are not part of the current Forecasting MVP output contract.

### 20.1 Naive

- no native interval method in the current custom baseline
- future step only

### 20.2 Damped Holt

- chosen `holtwinters.ExponentialSmoothing` path is not the canonical interval engine for this MVP
- interval handling is future work

### 20.3 ETS

- native interval-capable surface exists through `ETSResults.get_prediction()`
- not used in current MVP

### 20.4 ARIMA

- native interval-capable surface exists through `ARIMAResults.get_forecast()` / `get_prediction()`
- not used in current MVP

### 20.5 Canonical posture

Current MVP produces point forecasts only.

Prediction intervals remain a future extension and require a separate approved interval design.

## 21. Future SARIMA

SARIMA is a future seasonal challenger only.

It is not part of the first implementation covered by this spec.

If a future SARIMA task is approved, it must define separately:

- seasonal candidate space
- seasonal differencing policy
- seasonal leakage-safe selection
- runtime cost limits

Current methods spec does not authorize SARIMA runtime implementation.

## 22. Implementation Mapping to statsmodels

| Family | Canonical implementation target | Canonical configuration posture |
| --- | --- | --- |
| Naive | in-repo custom model | `y_hat(T+h) = y(T)` |
| Damped Holt | `statsmodels.tsa.holtwinters.ExponentialSmoothing` | `trend="add"`, `damped_trend=True`, `seasonal=None`, `initialization_method="estimated"`, `use_boxcox=False` |
| ETS | `statsmodels.tsa.exponential_smoothing.ets.ETSModel` | additive-error bounded catalog only |
| ARIMA | `statsmodels.tsa.arima.model.ARIMA` | bounded non-seasonal candidate set only |

Additional mapping rules:

- Damped Holt fit should keep `remove_bias=False`
- ETS fit should use training-history-only AICc for intra-family candidate selection
- ARIMA fit should use `seasonal_order=(0, 0, 0, 0)` and explicit trend policy

## 23. Mathematical Test Requirements

This section defines the minimum test expectations for the next implementation task.

### 23.1 Shared tests required for every model family

- deterministic repeatability on the same input history
- no future leakage inside backtest
- correct horizon indexing for `1M`, `3M`, `6M`, `12M`
- insufficient-history behavior
- failure handling when fit is invalid
- no use of forecast-derived source fields

### 23.2 Naive tests

- returns the last observed value for every horizon
- flat synthetic series stays flat
- monotone synthetic series still returns the last value, not extrapolated trend

### 23.3 Damped Holt tests

- upward linear synthetic series produces positive short-horizon continuation
- long-horizon increment is damped relative to undamped linear continuation
- flat synthetic series remains near-flat
- insufficient history is rejected explicitly if the implementation imposes stricter preconditions
- optimizer failure path marks candidate invalid

### 23.4 ETS tests

- `ETS(A,N,N)` behaves sensibly on flat series
- trend variants outperform level-only variants on clean linear-trend synthetic data
- seasonal variants are not eligible when seasonal requirements fail
- seasonal variants can be eligible on synthetic monthly seasonal data with sufficient history
- intra-family AICc selection is deterministic
- invalid candidates are skipped without silent fallback

### 23.5 ARIMA tests

- bounded candidate generation matches the canon exactly
- `d=0` candidates use constant policy only
- `d=1` candidates use drift policy only
- family selection uses only training data at each origin
- known synthetic AR or ARMA-like series produce stable finite forecasts
- fit failure or non-convergence marks candidate invalid

## 24. Explicit Non-Goals

This specification does not authorize:

- implementation of new model runtime in this task
- multiplicative ETS variants
- SARIMA runtime
- automatic champion switching
- composite global score
- Box-Cox transformation
- outlier removal
- winsorization
- smoothing of raw history before fitting
- interpolation of large gaps
- forecast persistence to PostgreSQL
- Dashboard Preview changes

## 25. Open Empirical Decisions

The following items do not block the first implementation, but may deserve later empirical review.

### 25.1 Damped Holt damping bounds

OPEN - REQUIRES EMPIRICAL VALIDATION

Current v1 decision:

- optimize `phi` within the library's admissible parameter handling

Question for later:

- whether a narrower business-stability bound such as high-but-below-1 damping improves robustness enough to justify deviating from default admissible optimization

This does not block first implementation.

### 25.2 ETS seasonal gating beyond bounded candidate competition

OPEN - REQUIRES EMPIRICAL VALIDATION

Current v1 decision:

- use monthly regularity + minimum history as the seasonal eligibility gate
- let AICc choose between seasonal and non-seasonal eligible ETS variants

Question for later:

- whether an extra seasonality diagnostic materially improves quality without introducing unstable pretest branching

This does not block first implementation.

### 25.3 ARIMA candidate pruning

OPEN - REQUIRES EMPIRICAL VALIDATION

Current v1 decision:

- use the bounded `p in {0,1,2}`, `d in {0,1}`, `q in {0,1,2}` grid, excluding `(0,0,0)`

Question for later:

- whether some orders can be removed with no meaningful loss of quality but lower runtime cost

This does not block first implementation.

## 26. Decision Table

| Area | Canonical decision | Reason |
| --- | --- | --- |
| Naive | `y_hat(T+h) = y(T)` | locked accepted baseline |
| Damped Holt | additive level + additive damped trend + no seasonality | simple, explainable, conservative trend model |
| Damped Holt configuration | `ExponentialSmoothing(... trend="add", damped_trend=True, seasonal=None, initialization_method="estimated", use_boxcox=False)` | direct classical implementation, low complexity |
| Damped Holt eligibility | regular MONTHLY, no missing values, 36 observations | same-origin fairness with shared backtest |
| Damped Holt failure policy | invalid on fit error, non-finite params, non-finite forecast, non-convergence | no silent fallback |
| ETS | bounded additive-error family | interpretable and stable without multiplicative assumptions |
| ETS allowed variants | `ANN`, `AAN`, `AAdN`, `ANA`, `AAA`, `AAdA` | small controlled family with optional trend and seasonality |
| ETS seasonality policy | seasonal variants allowed only for regular MONTHLY data with `seasonal_periods=12` and at least 36 observations | no fake seasonality, preserve fairness |
| ETS selection policy | origin-local AICc among valid candidates, deterministic tie-break | bounded complexity and leakage-safe selection |
| ETS failure policy | invalid candidate on fit error, non-finite AICc, non-finite forecast, numerical instability | explicit failure handling |
| ARIMA | bounded non-seasonal ARIMA family | classical non-smoothing challenger with controlled search |
| ARIMA candidate space | `p in {0,1,2}`, `d in {0,1}`, `q in {0,1,2}`, exclude `(0,0,0)` | deterministic and small compared with auto-ARIMA |
| ARIMA differencing policy | `d` comes from bounded candidate set, not from auto-search or a hard gate from a unit-root test | reproducible and simple |
| ARIMA constant/drift policy | `trend="c"` for `d=0`, `trend="t"` for `d=1` | explicit library-independent behavior |
| ARIMA selection policy | origin-local AICc among valid candidates, deterministic tie-break | leakage-safe intra-family selection |
| ARIMA failure policy | invalid candidate on fit error, non-convergence, non-finite params/AICc/forecast | no silent fallback |
| Backtesting | expanding-window rolling-origin, minimum window 36 | locked Phase 1 accepted methodology |
| Metrics | MAE, RMSE, MASE, sMAPE, Directional Accuracy, Bias | locked accepted methodology |
| Model selection | information criteria only inside ETS and ARIMA families; cross-family judgment remains out-of-sample | fairness and interpretability |
| Leakage policy | fit, selection, initialization, and MASE scaling use training history only | prevents historical simulation contamination |
