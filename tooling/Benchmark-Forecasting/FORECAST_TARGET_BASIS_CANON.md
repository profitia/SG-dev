# SpendGuru Benchmark Forecast Target Basis Canon

Document status: CANONICAL
Module: SpendGuru Benchmark Forecasting MVP
Audience: Developers, reviewers, implementation agents, maintainers
Purpose class: Authoritative semantic specification for forecast target meaning and lawful Actual matching
Last updated: 2026-08-23

## 1. Purpose

This document defines the canonical semantics of:

- Forecast Target Basis
- the first lawful Target Basis values
- how each Target Basis determines lawful Actual selection
- how each Target Basis affects Forecast identity, Verification semantics, and presentation honesty

This document defines what value of the underlying benchmark a Forecast observation means.

It does not define model mathematics.

Model mathematics remain governed by:

- `FORECASTING_METHODS_SPEC.md`

Runtime timing and alignment remain governed by:

- `apps/sg-runtime/FORECAST_HISTORICAL_DATA_ALIGNMENT_CONTRACT.md`

Forecast persistence and reuse architecture remain governed by:

- `apps/dashboard-preview/DASHBOARD PREVIEW FORECAST RUNTIME & PERSISTENCE CANON.md`

Dashboard UX ownership remains governed by:

- `apps/dashboard-preview/DASHBOARD PREVIEW EXPERIENCE CANON.md`

## 2. Scope

This document is semantic authority for the accepted native-frequency family:

- Daily
- Weekly
- Monthly
- Bimonthly
- Quarterly
- Quadmonthly
- Semiannual
- Annual

and the user-facing Forecast target family:

- Daily
- Average
- End of Period

Current production implementation remains narrower than this semantic target. Existing rolling-daily and monthly Forecast behavior remains unchanged until a separately authorized implementation stage closes the documented capability, cadence, horizon, identity, and verification gaps.

This document does not implement:

- END_OF_PERIOD canonicalization code
- schema changes
- forecast recomputation
- backtest rebuilds
- Dashboard selectors
- tooltip UX
- persistence migration

## 3. Canonical Definition

Forecast Target Basis defines the business meaning of each canonical Forecast observation - that is, what value of the underlying benchmark the model is trained to forecast and against what lawful Actual the Forecast is verified.

Forecast Target Basis is independent of:

- Forecast Model
- Horizon
- chart range
- provider
- Dashboard geometry
- persistence transport format

## 4. Forecast Target Basis Is Not Forecast Model

Forecast Target Basis and Forecast Model are separate identity dimensions.

Example:

```text
Target Basis: END_OF_PERIOD
Model: Damped Holt
Horizon: 6M
```

These are three different dimensions.

Target Basis defines what is being forecast.

Model defines how it is forecast.

Horizon defines how far ahead the Forecast was made.

## 5. Canonical User-Facing Target Family

The accepted user-facing Forecast target family is:

- `DAILY`, displayed as `Daily`
- `AVERAGE`, displayed as `Average`
- `END_OF_PERIOD`, displayed as `End of Period`

These names define business semantics. They do not require a global rename of existing persisted identities.

Current compatibility identities remain valid:

- `POINT_IN_TIME` remains the internal identity used by `ROLLING_DAILY_POINT_IN_TIME`.
- `MONTHLY_AVERAGE` remains the internal identity of existing monthly-average artifacts.
- `END_OF_PERIOD` remains the current internal EoP identity.

Presentation may map the existing internal `MONTHLY_AVERAGE` identity to the user-facing `Average` label when, and only when, capability and artifact identity prove that the prepared artifact has monthly target cadence. Generic non-monthly Average artifacts must remain distinguishable by cadence-bearing identity.

### 5.1 Generic target period

A target period is one lawful interval in the declared target cadence. Period membership must be deterministic, timezone-normalized, and boundary-safe. The preferred representation is a half-open interval:

```text
[periodStart, nextPeriodStart)
```

Period construction must follow the normalized native cadence. It must not infer sparse native periods by interpolating calendar months or inventing observations.

### 5.2 Daily

`DAILY` means:

> Forecast target is the lawful provider observation associated with the exact target date.

Daily is available only for a native Daily source series. Weekly, Monthly, Bimonthly, Quarterly, Quadmonthly, Semiannual, and Annual sources must not be interpolated, forward-filled, or otherwise expanded into fake Daily observations.

The existing `ROLLING_DAILY_POINT_IN_TIME` methodology is preserved unchanged by this Canon update.

### 5.3 Average

`AVERAGE` means:

> Unweighted arithmetic mean of all lawful numeric provider observations whose timestamps belong to the target period.

Formally:

```text
AVERAGE = SUM(lawful numeric observations in target period)
          / COUNT(lawful numeric observations in target period)
```

Only lawful numeric provider observations participate. No interpolation, forward-fill, weighting, synthetic observation, invented value, or provider-economic reinterpretation is allowed.

### 5.4 End of Period

`END_OF_PERIOD` means:

> Latest lawful numeric provider observation whose timestamp belongs to the target period.

No cross-period fallback, interpolation, forward-fill, synthetic observation, invented value, or provider-economic reinterpretation is allowed.

### 5.5 Empty and single-observation periods

If a closed target period contains no lawful numeric observation:

- no target Actual exists for that period
- the period must be unavailable or skipped according to the owning preparation contract
- no Forecast or Verification artifact may invent a replacement Actual

If a target period contains exactly one lawful numeric observation:

```text
AVERAGE = END_OF_PERIOD = that observation
```

This equality is lawful and expected. No additional observation may be generated merely to make the targets differ.

### 5.6 Canonical example

Given lawful provider observations:

```text
Q1 = 10
Q2 = 5
target period = H1
```

the lawful targets are:

```text
AVERAGE = (10 + 5) / 2 = 7.5
END_OF_PERIOD = 5
```

The values must not be reinterpreted as stock, flow, total, level, state, quarter-end economic quantity, or period-total economic quantity. Forecast target preparation uses lawful numeric provider observations and their timestamps, not a new provider-economic classification layer.

### 5.7 Accepted source-frequency and target matrix

| Native source frequency | Daily | Average | End of Period |
| --- | --- | --- | --- |
| Daily | YES | YES | YES |
| Weekly | NO | YES | YES |
| Monthly | NO | YES | YES |
| Bimonthly | NO | YES | YES |
| Quarterly | NO | YES | YES |
| Quadmonthly | NO | YES | YES |
| Semiannual | NO | YES | YES |
| Annual | NO | YES | YES |

This matrix is accepted target architecture, not a statement that production capability is already implemented. Average and End of Period must use shared generic period membership and reducers; frequency-specific Forecast implementations such as `quarterly_average_forecast` or `annual_eop_forecast` are not approved.

## 6. MONTHLY_AVERAGE Compatibility Profile

### 6.1 Business meaning

For existing monthly artifacts, `MONTHLY_AVERAGE` means:

> Forecast value represents the average lawful benchmark level across the complete target calendar month.

### 6.2 Canonicalization identity

Existing approved canonicalization remains fully valid:

```text
AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS
@
daily-market-price-monthly-average-v2
```

This is the current approved canonicalization identity for `MONTHLY_AVERAGE` market-price input derived from lawful DAILY observations.

### 6.3 Lawful Actual

For a closed target month:

> Monthly Average Actual = arithmetic average of lawful numeric provider observations belonging to that target calendar month.

Existing approved semantics remain preserved, including:

- explicit `null` placeholders are treated as missing-day placeholders
- only lawful numeric observations participate
- no synthetic values
- non-finite values fail closed
- provider holidays and weekends do not require synthetic fills
- the open month is excluded

### 6.4 Verification basis

Verification for `MONTHLY_AVERAGE` is:

```text
Forecast Monthly Average
vs
Realized Monthly Average
```

It is never:

- Forecast Monthly Average vs last daily observation
- Forecast Monthly Average vs nearest chart point
- Forecast Monthly Average vs a daily point selected for visual convenience

### 6.5 Open-period rule

Partial current-month observations do not create a lawful `MONTHLY_AVERAGE` Actual.

The lawful Actual exists only after target-period closure under the approved monthly close semantics.

### 6.6 Provider provenance semantics

`MONTHLY_AVERAGE` derives from lawful provider observations inside the target month, but its realized Actual is an aggregated period value rather than a single provider observation timestamp.

### 6.7 POINT_IN_TIME Compatibility Profile

#### 6.7.1 Business meaning

`POINT_IN_TIME` means:

> Forecast value represents the lawful observed benchmark level for the target calendar date itself, not a period aggregate.

Current approved scope for `POINT_IN_TIME` is the rolling-daily production method:

```text
forecastMethod = ROLLING_DAILY_POINT_IN_TIME
targetBasis = POINT_IN_TIME
verificationSemantics = AS_OF_TARGET_DATE
```

#### 6.7.2 Lawful Actual selection

For a target calendar date `T`:

> Point-in-Time Actual = latest lawful numeric provider observation whose observation date is less than or equal to `T`.

This canon preserves the existing rolling-daily method mathematics.

It changes semantic identity only.

#### 6.7.3 Verification basis

Verification for `POINT_IN_TIME` is:

```text
Forecast benchmark level as of target calendar date
vs
Lawful observed benchmark level as of target calendar date
```

This is not monthly averaging semantics.

This is not closed-period end-of-period semantics.

#### 6.7.4 Prohibited reinterpretation

`ROLLING_DAILY_POINT_IN_TIME` must not persist or present itself under `MONTHLY_AVERAGE` merely because its target dates are later grouped into `1M`, `3M`, `6M`, and `12M` horizon labels.

Those labels define forecast distance, not target-basis meaning.

## 7. END_OF_PERIOD

### 7.1 Business meaning

`END_OF_PERIOD` means:

> Forecast value represents the benchmark value at the end of the target period.

For existing monthly EoP artifacts, the target period is a calendar month. Under generic period semantics, the same reducer applies to any accepted native target cadence.

### 7.2 Proposed canonicalization identity

The semantic transformer concept for `END_OF_PERIOD` is:

```text
LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD
```

The proposed canonicalization version is:

```text
daily-market-price-end-of-period-v1
```

This document defines the semantic identity only.

Implementation status after Stage 3:

- semantic method implemented: `LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD`
- canonicalization version implemented: `daily-market-price-end-of-period-v1`
- canonical monthly cadence identity remains first-of-month UTC period timestamps
- source observation provenance is carried additively as canonical `sourceObservedAt`
- future verification persistence mapping is: canonical `sourceObservedAt` -> `ForecastVerificationPoint.actualObservedAt`

This does not by itself authorize public Forecast compute enablement.

### 7.3 Lawful Actual selection

For a closed target period:

> End-of-Period Actual = last lawful numeric provider observation whose observation timestamp belongs to that target period.

If `31 Mar` has a lawful provider observation, use `31 Mar`.

If `31 Mar` has no lawful provider observation, use the latest lawful provider observation still inside March.

### 7.4 Weekend / holiday behavior

If the final calendar day of the month has no lawful observation because of provider calendar behavior, weekends, or holidays, the lawful Actual is still the latest lawful provider observation inside that same month.

Do not leave the month to find a replacement point.

### 7.5 Open-period rule

Partial current-month observations do not create a lawful `END_OF_PERIOD` Actual.

The lawful Actual exists only after the target period closes and the last lawful observation within that closed period is known.

### 7.6 `actualObservedAt` semantics

`END_OF_PERIOD` requires explicit provenance to the provider observation actually used for Verification.

Runtime implementation may carry this provenance internally as `sourceObservedAt` during canonical history materialization.

The semantic meaning is the same and is the approved precursor of persisted `actualObservedAt`.

For canonical history identity, this provenance remains identity-bearing.
Equivalent forms such as `2026-03-31` and `2026-03-31T00:00:00.000Z` must normalize to the same exact UTC observation instant before fingerprinting.
Different lawful observation instants must remain different identities even when the realized value is unchanged.

Conceptually:

```text
targetPeriod = 2026-03
actualObservedAt = 2026-03-31T00:00:00Z
actualValue = 103.46
```

If the last lawful observation was on `2026-03-30`, then:

```text
targetPeriod = 2026-03
actualObservedAt = 2026-03-30T00:00:00Z
```

### 7.7 Prohibited fallbacks

The following are forbidden for `END_OF_PERIOD`:

- averaging observations
- using the first observation of the next month
- forward-filling from the next period
- interpolating a synthetic month-end value
- using the nearest observation regardless of the period boundary

The lawful Actual must come from a lawful raw provider observation inside the target period.

## 8. Target Period Identity vs Observation Timestamp

Forecast Target Period is not the same thing as Actual Observation Timestamp.

For `END_OF_PERIOD`:

- `Forecast Target Period = March 2026` is the business target
- `actualObservedAt = March 31` or `March 30` is the provider timestamp used to realize that target

For all period-based Forecasts:

```text
Forecast Target Period
!=
Actual Observation Timestamp
```

## 9. Open-Period Rule For Period Targets

For both `AVERAGE` and `END_OF_PERIOD`:

- lawful Actuals exist only for closed target periods
- partial current-period observations do not create realized Actuals
- Current Forecast does not become Realized merely because lawful source observations already exist inside the open period

## 10. Runtime Request Boundary Semantics

Runtime request handling must obey the following rules:

- missing `targetBasis` at the public request boundary defaults to `MONTHLY_AVERAGE`
- invalid explicit `targetBasis` fails validation and must not silently normalize to another basis
- explicit `END_OF_PERIOD` is a recognized canonical request value and is compute-enabled only on approved runtime paths
- `ROLLING_DAILY_POINT_IN_TIME` owns internal persisted identity `targetBasis = POINT_IN_TIME` and verification semantics `AS_OF_TARGET_DATE`
- the first approved public compute path is live `wocaes0074` using Dynamic Market Data Store canonical monthly history under both Current Forecast and Verification
- explicit `END_OF_PERIOD` must not fall back to `MONTHLY_AVERAGE` computation, reuse `MONTHLY_AVERAGE` cache artifacts, or create placeholder persisted Forecast artifacts
- on non-approved paths, explicit `END_OF_PERIOD` must still fail closed as `UNSUPPORTED`

This document does not require a new error framework.

It requires that runtime behavior remain explicit, safe, and basis-honest during partial rollout.

## 10. Current Forecast Semantics

If the latest lawful closed target period is `N`, then:

- `Forecast Origin = N`
- first future target = `N+1`

The meaning of that `N+1` point depends on Target Basis.

For `AVERAGE`:

```text
N+1 forecast = forecast average benchmark level across target period N+1
```

For `END_OF_PERIOD`:

```text
N+1 forecast = forecast end-of-period benchmark value for target period N+1
```

`N+1` means the next lawful target-cadence step. It must not always be implemented as one calendar month.

## 11. Same Target Period, Different Lawful Values

The same target period may have different lawful Actuals under different Target Bases.

Example:

```text
Target Period: March 2026

MONTHLY_AVERAGE Actual = 98.23
END_OF_PERIOD Actual = 103.46
```

Both values may be simultaneously correct.

They are not duplicates.

They are not conflicting Actuals.

They represent different Target Basis semantics.

## 12. Canonical History Must Differ By Target And Cadence

For the same lawful source history:

```text
MONTHLY_AVERAGE canonical history
!=
END_OF_PERIOD canonical history
```

Each Target Basis and target cadence creates its own lawful canonical series.

Each such series has its own:

- canonicalization method/version
- lawful history identity
- `historyFingerprint`

## 13. Forecast Core Must Remain Provider-Neutral

Forecast Core must not contain provider-specific branching such as:

```text
if provider == Macrobond then take month end
```

Canonical architecture remains:

```text
Provider observations
        ↓
Normalized native frequency and lawful ordering
        ↓
Generic target-period membership and Target Basis reduction
        ↓
Canonical regular series for Forecast Core
```

Forecast Core continues to consume deterministic canonical time series.

## 14. Forecast Mathematics Remain Unchanged

This Target Basis canon does not change:

- Naive
- Damped Holt
- ETS
- ARIMA
- rolling-origin methodology
- metrics
- minimum training history
- error convention

Future implementation may generalize cadence validation, target-date generation, horizon conversion, and rolling-origin orchestration. Those wrapper changes must preserve the accepted model mathematics and require separate production authorization.

## 15. Same Model Can Produce Different Forecasts By Basis

The following are different Forecast contexts:

```text
Damped Holt + MONTHLY_AVERAGE
Damped Holt + END_OF_PERIOD
```

Their results must not be reused as though they were equivalent.

## 16. Forecast Identity

Target Basis is a first-class Forecast identity dimension.

Conceptually, lawful Forecast artifact identity must distinguish at least:

```text
seriesId
+
targetBasis
+
sourceFrequency / targetPeriodCadence
+
canonicalizationMethod/version
+
historyFingerprint
+
modelId
+
methodVersion
```

Cross-basis reuse is not allowed.

## 17. Forecast Library Architecture Direction

Target Basis must extend one shared Forecast Library identity model.

Preferred direction:

```text
one Forecast Library
with Target Basis as an identity dimension
```

Not preferred:

```text
separate forecast_average_* and forecast_eop_* table families
as two independent systems
```

This document sets the architectural direction only.

It does not authorize schema changes in this stage.

## 18. Raw Market Data Must Not Be Duplicated

Both Target Bases consume the same raw market history.

Do not duplicate:

- `market_series`
- `market_observations`
- raw provider history

The duplication boundary is canonical target-series identity, not raw data ownership.

## 19. Runtime Target Behavior

Forecast Target Bases are independent reusable Forecast contexts and should be resolved lazily.

Canonical target behavior:

```text
selected Target Basis
        ↓
CHECK
        ↓
REUSE persisted artifact if lawful
        ↓
COMPUTE only if missing or stale
        ↓
PERSIST
        ↓
SERVE
```

Benchmark availability does not imply computing all Target Bases.

Opening the Dashboard does not imply computing:

- `MONTHLY_AVERAGE`
- `END_OF_PERIOD`
- all models
- all horizons
- all Verification runs

## 20. Controlled Reference Exception

Controlled validation may intentionally compute all Target Bases for a benchmark slice.

Current reference exception:

```text
wocaes0074
```

In later stages it may be computed for both:

- `MONTHLY_AVERAGE`
- `END_OF_PERIOD`

across:

- Naive
- Damped Holt
- ETS
- `1M`, `3M`, `6M`, `12M`
- Current Forecast and Rolling-Origin Verification

This is a reference-validation exception only.

It must not be generalized into eager-compute policy.

## 21. Future Single-Basis Product Mode

This canon must support future product modes such as:

```text
enabledTargetBases = [END_OF_PERIOD]
```

or:

```text
enabledTargetBases = [MONTHLY_AVERAGE]
```

If one Target Basis is disabled, the other does not need to be loaded, computed, or rendered.

Persisted historical artifacts for a disabled Target Basis may still remain for audit and history.

## 22. Presentation Contract

Dashboard presentation must always reflect the selected Target Basis honestly.

It must not present:

- Monthly Average Forecast as though it were End-of-Period Forecast
- End-of-Period Forecast as though it were Monthly Average Forecast

For `MONTHLY_AVERAGE`:

```text
Verification Delta = Forecast Monthly Average vs Realized Monthly Average
```

The DAILY historical line is market context.

It is not required to be the exact visual boundary point for the Verification delta.

For `END_OF_PERIOD`:

```text
Verification Delta = Forecast End-of-Period value vs actual provider EoP observation
```

The realized Actual should be presentable with provenance to the exact DAILY provider observation used.

Dashboard must be able to distinguish conceptually:

```text
Forecast Target
Monthly Average
End of Period
```

This document does not freeze final wording, iconography, tooltip layout, or control geometry.

## 23. Forecast Origin Remains Separate

Regardless of Target Basis:

> Forecast Origin means the lawful period from which the Forecast was generated.

It is not:

- the target period
- the Actual provider observation timestamp
- the browser current date

## 24. Verification Horizon Semantics Remain Separate

For `1M`, `3M`, `6M`, `12M`:

- Horizon defines how early the Forecast was made
- Target Basis defines what was forecast
- Model defines how it was forecast

## 25. Three-Dimension Example

Example Forecast identity:

```text
Benchmark: Brent
Target Basis: END_OF_PERIOD
Model: Damped Holt
Horizon: 6M
Target: Jul 2026
```

Meaning:

> Damped Holt forecast of Brent end-of-period value for Jul 2026, generated from the lawful history available six months earlier.

## 26. Forecast Target Basis Design Gates

No Target Basis should be considered production-ready unless all three gates are satisfied equally.

### 26.1 Calculation Correctness

Forecast artifact is correct only if:

- Target Basis
- canonical history
- Forecast model
- horizon
- Actual verification basis

are semantically aligned.

Forbidden example:

```text
train on MONTHLY_AVERAGE
verify against END_OF_PERIOD Actual
```

### 26.2 Presentation Correctness

Dashboard must not display one Target Basis using labels, geometry, or Actual semantics that imply the other basis.

### 26.3 Cost & Performance Correctness

Unused Target Basis must not create mandatory runtime cost.

In particular, there must be no automatic requirement for:

- dual fetch
- dual canonicalization
- dual Forecast compute
- dual Verification compute
- dual render

Persisted results may coexist without all being loaded.

## 27. Canonical Versioning

Each Target Basis transformer must have explicit version identity.

Current approved identity:

```text
MONTHLY_AVERAGE
→
AVERAGE_OF_LAWFUL_DAILY_OBSERVATIONS@daily-market-price-monthly-average-v2
```

Proposed semantic identity for the future EoP transformer:

```text
END_OF_PERIOD
→
LAST_LAWFUL_OBSERVATION_IN_CLOSED_PERIOD@daily-market-price-end-of-period-v1
```

## 28. Version Change Invalidates Reuse

A change in Target Basis canonicalization semantics or version creates a different lawful history identity.

Forecast artifacts computed under the previous canonicalization version must not be reused as equivalent current results.

## 29. Current Average Results Remain Valid

Existing `MONTHLY_AVERAGE` results remain mathematically valid.

They remain valid under their existing monthly cadence identity and must not be migrated or globally renamed merely to expose the user-facing `Average` label.

Generic Average artifacts for another cadence must not collide with or be returned by exact lookup as existing `MONTHLY_AVERAGE` artifacts. If current identity and lookup surfaces cannot prove cadence equality, a future implementation must add a cadence-bearing compatibility dimension before enabling non-monthly preparation.

The issue addressed by this canon is not that earlier average results were wrong.

The issue is that the business semantics were not yet explicitly separated from `END_OF_PERIOD` semantics.

## 30. Stage Boundary

This stage must not:

- relabel existing database rows
- rebuild Forecast artifacts
- delete Verification data
- mutate cache keys in code
- migrate schema
- modify Dashboard implementation

## 31. Required Example - `wocaes0074`

For:

```text
Benchmark: wocaes0074 / Brent
Target Period: Mar 2026
```

two lawful Actuals may coexist:

```text
MONTHLY_AVERAGE = 98.23
END_OF_PERIOD = actual provider value from the last lawful March observation
```

These values answer different analytical questions and must never be mixed inside one Forecast or Verification context.