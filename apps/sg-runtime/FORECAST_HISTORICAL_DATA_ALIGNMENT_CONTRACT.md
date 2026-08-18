# SG Runtime Forecast Historical / Forecast Data Alignment Contract

## Purpose

This document is the authority for how SG Runtime distinguishes:

- displayed historical market data
- lawful Forecast Core input history
- forecast origin and target timing

It is additive. It does not change Forecast Core mathematics, benchmark selection, chart ownership, or forecast horizons.

## Scope

In scope:

- `apps/sg-runtime/app/api/benchmark/forecast/current`
- `apps/sg-runtime/app/api/benchmark/forecast/verification`
- `apps/sg-runtime/app/api/benchmark/analytics-series`
- `apps/sg-runtime/lib/forecast/service.ts`
- `apps/sg-runtime/lib/market-data/service.ts`
- downstream consumers such as Dashboard Preview

Out of scope:

- changing forecast model math
- aggregating daily display data into monthly forecast input data inside SG Runtime
- making `forecast-portfolio-v3` runnable

## Definitions

Displayed Historical Series
- The raw historical series returned by `analytics-series` from the Dynamic Market Data Store.
- This series is consumer-facing and may be daily, weekly, monthly, or other provider frequencies.
- Its latest point reflects provider hydration state, not Forecast Core training authority.

Lawful Forecast History
- The historical bundle returned by Forecast Core through the forecasting bridge.
- This is the only history allowed to define forecast cache identity, forecast origin, and current forecast targets.
- Its identity is captured by `historyFingerprint`.

N
- The last lawful historical period used by Forecast Core for a given forecast run.
- In SG Runtime current forecast responses, `N` is `history.end`.
- In persistence, `N` is stored as `historyEndAt`.

Forecast Origin
- The origin period for the current forecast.
- For SG Runtime current forecast, `forecastOrigin` must equal `N`.
- In persistence, this is stored as `forecastOriginAt`.

First Current Forecast Target
- The first target period returned by the current forecast payload.
- Operationally, this is the smallest `horizonSteps` point in `currentForecast`.
- For the contract to be aligned, this first target must be `N+1` in the training frequency used by Forecast Core.

Displayed Latest Observation
- The last hydrated point in the displayed historical series.
- This may be later than `N`.
- It must not be treated as forecast origin unless Forecast Core input history itself has advanced to that period.

Lawful Actual
- The canonical Actual value for a forecast target period at the forecast frequency used by Forecast Core.
- A raw provider observation is not automatically a lawful Actual for Forecast lifecycle purposes.

Current Forecast
- The subset of forecast targets that remain beyond the latest lawful known Actual period.
- A forecast point can be lawfully persisted and still stop being Current once its target period becomes known through a lawful Actual.

Realized / Ex-post Verification
- A previously generated Current Forecast point paired later with the lawful Actual for the same canonical target period.
- This is production forecast evidence, not simulated backtest evidence.

Rolling-Origin Backtest Verification
- Historical simulation evidence produced by fitting only on information available at each historical origin and comparing the simulated target against the known historical Actual.
- This remains separate from Realized / Ex-post Verification.

## Normative Rules

1. `AVAILABLE` does not imply `ALIGNED` or `CURRENT`.
- A historical series can be available and fresh for display while still extending beyond the lawful Forecast Core history used by the current forecast.
- A persisted forecast artifact may remain lawful and auditable even after time passes and some of its target periods cease to be Current.

2. `history.end` is the lawful boundary for forecast input.
- Consumers must treat `history.end` from the forecast route as the last historical period used by Forecast Core.
- Consumers must not infer this boundary from `analytics-series` latest dates, chart range, or cache freshness.

3. `forecastOrigin` must equal `N`.
- For current forecast payloads, `forecastOrigin = history.end`.
- If this equality fails, the payload is temporally unaligned.

4. The first current forecast target must be `N+1`.
- For current forecast payloads, the first target is the point with the smallest `horizonSteps`.
- If that point is not the one-step-ahead target after `forecastOrigin`, the payload is temporally unaligned.

5. Current Forecast MUST NEVER overlap lawful known Actuals.
- Current Forecast may contain only target periods beyond the latest lawful known Actual period in the canonical forecast frequency.
- If a lawful Actual already exists for a forecast target period, that point is no longer eligible to be presented as Current Forecast.

6. A former Current Forecast point becomes Realized / Ex-post Verification when the lawful Actual for its target period appears.
- The earlier Forecast value must remain historically preserved.
- It must not be overwritten by the Actual.
- The correct lifecycle is `Forecast Point + Actual Point = Realized Verification`, not `Forecast Point replaced by Actual`.

7. When the lawful Historical Input State advances, `N` advances.
- `old N -> new lawful Actual -> new N`
- The new Current Forecast must originate at the new `N`.
- The first Current Forecast target must again start at `new N+1`.

8. Display frequency may differ from forecast training frequency.
- A daily displayed history and a monthly forecast history can coexist lawfully.
- This does not authorize SG Runtime to aggregate display data into forecast input history silently.

9. Raw provider observation does not automatically imply lawful Forecast input change.
- New Macrobond provider data should trigger lifecycle evaluation.
- It does not by itself require every forecast model to be recomputed immediately.
- Recompute authority exists when the provider-state change advances the lawful canonical Historical Input State used by Forecast Core.

10. Actual matching must use canonical forecast-period semantics.
- Realized Verification may be formed only when the Forecast target period and the Actual refer to the same lawful canonical period.
- Matching must not rely naively on an arbitrary raw timestamp when the Forecast Core operates on period semantics.

11. Partial periods must not be prematurely realized.
- If Forecast Core is `MONTHLY` and the provider emits `DAILY` observations, the first daily row inside a month does not by itself realize the monthly target.
- Realization occurs only when a lawful canonical Actual exists for that forecast period according to the approved frequency methodology.

12. Chart range must not mutate forecast input identity.
- UI range presets such as `1Y` or `ALL` can change what is displayed.
- They must not change lawful forecast history, `historyFingerprint`, `forecastOrigin`, or forecast cache reuse.

13. Recompute authority remains on Forecast Core history change.
- SG Runtime may reuse a persisted forecast only when the lawful Forecast Core history fingerprint matches.
- Additional displayed historical points alone do not invalidate current forecast cache identity.

14. Rolling-origin Backtest Verification remains separate from Realized / Ex-post Verification.
- A backtest point must not be presented as a real previously published Forecast point.
- A realized production Forecast point must not be collapsed into simulated backtest provenance.

## Alignment States

`ALIGNED`
- `history.end = forecastOrigin`
- the first current forecast target is one step ahead of `forecastOrigin`

`UNALIGNED`
- `history.end` and `forecastOrigin` disagree, or
- the first current forecast target is not the one-step-ahead target

`INDETERMINATE`
- the payload does not expose enough information to prove alignment

Important:
- display freshness is separate from alignment status
- display recency is separate from forecast training authority
- `AVAILABLE != ALIGNED`

## Availability, Alignment, and Currentness

`AVAILABLE`
- a lawful Forecast artifact exists

`ALIGNED`
- Forecast Origin and the `N / N+1` relationship are internally correct

`CURRENT`
- the Forecast target remains beyond lawful known Actuals

A Forecast may therefore be:

```text
AVAILABLE
ALIGNED
NOT CURRENT
```

because time has passed and a lawful Actual is now known for its earlier target period.

In that case the Forecast Run may remain mathematically valid and auditable, but the affected point belongs to Realized / Ex-post Verification rather than Current Forecast.

## Machine-readable Runtime Surface

Current forecast responses now expose explicit alignment metadata:

- `history.frequency`
- `history.end`
- `forecastOrigin`
- `alignment.status`
- `alignment.trainingFrequency`
- `alignment.lastHistoricalPeriod`
- `alignment.forecastOrigin`
- `alignment.firstForecastTarget`

Interpretation:

- `alignment.lastHistoricalPeriod` is `N`
- `alignment.forecastOrigin` is expected to equal `N`
- `alignment.firstForecastTarget` is expected to be `N+1`

Verification responses already remain machine-readable at the record level through:

- `verification[*].records[*].forecastOrigin`
- `verification[*].records[*].forecastDate`
- `verification[*].records[*].horizonSteps`

No separate alignment summary is required there, because verification contains many forecast origins by design.

The `analytics-series` route intentionally remains raw display history and does not expose Forecast Core alignment metadata.

Current SG Runtime responses do not yet materialize a dedicated Realized / Ex-post Verification surface or a persisted `CURRENT` vs `NOT CURRENT` classification.

That is a future lifecycle/persistence concern, not a reason to reinterpret the existing backtest persistence as realized verification.

## Consumer Contract

Consumers such as Dashboard Preview must follow these rules:

1. Use `analytics-series` for displayed history.
2. Use `forecast/current` for lawful forecast timing.
3. Anchor the current forecast overlay from `forecastOrigin`, not from the latest displayed historical point.
4. If displayed historical data extends beyond `N`, treat that tail as post-origin display data outside the current forecast training window.
5. Do not infer `N` from chart range, provider freshness, or Dynamic Market Data Store hydration state.
6. Never draw a Forecast Point as Current Forecast for a period that is already represented by a lawful Actual in the canonical forecast frequency.
7. More granular displayed Actuals may exist, but only a lawful canonical Actual determines the Forecast-to-Realized transition for the forecast frequency.

## Example: `wocaes0280`

Observed runtime evidence:

- displayed historical series: daily
- displayed latest observation: `2026-08-16T22:00:00Z`
- lawful forecast history frequency: monthly
- lawful forecast history end: `2026-04-01`
- forecast origin: `2026-04-01`
- first current forecast target: `2026-05-01`

Interpretation:

- the displayed series is newer than the lawful Forecast Core history
- this does not break the forecast contract
- it means the display surface has post-origin data that Forecast Core did not use for this forecast run
- the current forecast remains aligned because `N = 2026-04-01`, `forecastOrigin = 2026-04-01`, and the first target is `2026-05-01`

Important clarification:

- the above statement addresses Forecast Run mathematical validity and alignment
- it does not mean that a Forecast Point may continue to be presented as Current once a lawful Actual exists for its target period
- once a lawful Actual exists for that target period, the point is no longer Current and belongs to Realized / Ex-post Verification evidence

## Monthly Lifecycle Example

### September

```text
Actual:
... → 2026-09

N:
2026-09

Forecast Origin:
2026-09

Current Forecast:
2026-10 = 125
```

### October Actual arrives

```text
Actual:
2026-10 = 121
```

Then:

```text
Old Forecast:
2026-10 = 125

Realized Verification:
Forecast = 125
Actual = 121
Error = +4
```

Historical state advances:

```text
new N = 2026-10
```

New Current Forecast:

```text
Forecast Origin = 2026-10

First Forecast Target:
2026-11
```

No overlap exists.

## Future Lifecycle Direction

Recommended target sequence:

```text
1. Macrobond Actual arrives

2. Determine whether lawful canonical Historical state changed

3. Match newly lawful Actual periods against earlier Current Forecast Points

4. Materialize Realized / Ex-post Verification

5. Advance N

6. Recompute Current Forecast from new N

7. Persist new Forecast Run

8. Dashboard consumes Historical Actual + Realized Verification + Current Forecast
```

## Implementation Notes

Current SG Runtime implementation already satisfies the core contract here:

- `mapCurrentArtifact()` sets `forecastOrigin` from Forecast Core `history.end`
- cache identity is based on Forecast Core history, not chart range
- market-data freshness logic is independent from Forecast Core alignment logic

Current implementation does not yet materialize dedicated Realized / Ex-post Verification persistence.

That remains a future implementation requirement and must be designed separately from the existing `forecast_current_*` and `forecast_verification_*` backtest persistence.

The additive alignment metadata exists to remove ambiguity for downstream consumers and to lock the contract in tests.
