# ROLLING_DAILY_POINT_IN_TIME - ETAP 10 Production Forecast Contract

## Executive Result

PASS

ETAP 10 is accepted for the minimal production contract slice.

The accepted implementation establishes `sg-runtime` as the canonical owner of the external production forecast contract for `ROLLING_DAILY_POINT_IN_TIME`, keeps Python as the internal current-forecast computation engine, and serves a stable daily-path payload without rebuilding historical verification or recalculating calibration at request time.

## Accepted Scope

This ETAP 10 slice covers only the narrow production contract boundary required to serve rolling-daily current forecasts safely:

- a new SG Runtime-owned contract and mapper for rolling-daily production serving
- a dedicated Python bridge that exports the internal current-forecast result shape
- provider-neutral benchmark metadata mapping from SG Runtime market data
- prepared calibration authority and freshness mapping from persisted Stage 9 state
- focused runtime and Python validations for contract semantics and unavailable-state behavior

It does not add API productization, UI surfaces, scheduler changes, or any new methodology.

## Ownership Decision

The canonical ownership split is now explicit:

- SG Runtime owns the production contract consumed by application code
- Python Forecast Core owns current forecast computation and internal rolling-daily semantics
- SG Runtime Dynamic Market Data Store owns source history and benchmark metadata
- SG Runtime Forecast Library owns persisted calibration authority and maintenance freshness state

This preserves the Stage 8 architecture rule that request time may compute the current forecast and interpolate the daily band path, but must not rebuild verification or recompute calibration.

## Contract Semantics

The accepted production contract serves these semantics:

- origin is the latest lawful DAILY source observation
- path is a full daily presentation path up to exactly `12M`
- anchor horizons are first-class: `1M`, `3M`, `6M`, `12M`
- exact anchor points expose `EMPIRICAL_ANCHOR` provenance
- inter-anchor points expose `INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS` provenance
- points before the first empirical anchor withhold bands with `BEFORE_FIRST_EMPIRICAL_ANCHOR`
- band availability and reason codes are explicit rather than inferred from nulls
- calibration freshness is explicit: `FRESH` or `STALE`
- stale calibration may still serve last-good bands, but only with a warning
- contract version is first-class and separate from method version
- date serialization is `YYYY-MM-DD` only, with no UTC-shift semantics introduced by runtime mapping

The runtime mapper also enforces two critical invariants:

- anchor values and anchor-date path values must match
- the final path point must terminate at the exact `12M` anchor date

## Request-Time Behavior

The accepted request-time flow is:

1. SG Runtime loads provider-neutral benchmark identity and DAILY history.
2. SG Runtime loads prepared calibration groups and maintenance freshness state.
3. SG Runtime invokes the Python current-forecast bridge once.
4. SG Runtime maps the returned internal forecast into the production contract.

The accepted flow explicitly does not:

- rerun historical backtests
- rebuild calibration summaries
- fit a second model inside SG Runtime
- persist an expanded daily path

## Validation Commands

Validated with:

```bash
cd '/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/tooling/Benchmark-Forecasting' && ./.venv/bin/python -m unittest tests.test_rolling_daily_current_forecast_export
cd '/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/apps/sg-runtime' && node --import tsx --test tests/rolling-daily-production-forecast.test.ts
cd '/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/apps/sg-runtime' && npm run typecheck
cd '/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/apps/sg-runtime' && node --import tsx --test tests/rolling-daily-maintenance.test.ts tests/rolling-daily-production-forecast.test.ts
```

These validations accepted all of the following behaviors:

- provider-neutral benchmark identity is preserved in the production payload
- stale calibration is surfaced as a warning instead of silently hidden
- exact anchor semantics and interpolated-point provenance are exported correctly
- points before `1M` do not fabricate prediction bands
- unavailable bridge states map to explicit contract reason codes
- the new serving slice does not regress the Stage 9 maintenance tests

## Files Added

The minimal ETAP 10 slice is implemented in:

- `apps/sg-runtime/lib/forecast/rolling-daily-production-forecast.ts`
- `apps/sg-runtime/tests/rolling-daily-production-forecast.test.ts`
- `tooling/Benchmark-Forecasting/scripts/export_rolling_daily_current_forecast.py`
- `tooling/Benchmark-Forecasting/tests/test_rolling_daily_current_forecast_export.py`

Machine-readable evidence was written to:

- `validation/rolling_daily_stage10_wocaes0074_production_contract.json`

## Deferred Work

This acceptance intentionally defers:

- public route or endpoint integration
- wider real-data contract artifact generation beyond the focused bridge/runtime tests
- full broader Python regression rerun beyond the new bridge test
- ETAP 10 PMOS closeout lifecycle