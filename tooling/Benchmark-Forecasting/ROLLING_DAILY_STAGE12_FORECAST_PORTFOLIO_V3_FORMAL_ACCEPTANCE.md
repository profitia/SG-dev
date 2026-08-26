# Rolling Daily Stage 12 - Forecast Portfolio v3 Formal Acceptance

Timestamp: 2026-08-22T05:25:18.000Z
Controlled series: wocaes0074
Method: ROLLING_DAILY_POINT_IN_TIME
Method version: rolling-daily-point-in-time-v1
Target basis: POINT_IN_TIME

## Executive Result

PASS

Forecast Portfolio v3 now passes formal Stage 12 acceptance for the controlled point-in-time slice on all four accepted models: naive, damped_holt, ets, and arima.

The accepted answer to the Stage 12 question is:

Yes - Forecast Portfolio v3 now faithfully, consistently, and transparently presents the accepted Forecast truth for all four models without recalculating or distorting that truth.

## Scope Discipline

This task stayed inside Stage 12.

- Stage 13 was not started.
- No champion model was chosen.
- No preferred or default model was chosen.
- No automatic model selection was built.
- Point Forecast mathematics were not changed.
- Naive, Damped Holt, ETS, and ARIMA fit logic were not changed.
- The ARIMA 17-candidate AICc policy was not changed.
- ROLLING_DAILY_POINT_IN_TIME semantics were not changed.
- Benchmark Finder was not touched.
- AppShell was not touched.
- No new forecast service was created.
- No new database, table, or schema was created.
- No 681-origin replay was performed.
- No deployment was performed.

## Mandatory Pre-Step A - Presentation Freshness Contract

Result: PASS

The live point-in-time snapshots now align with the live lawful source state for all four models.

Accepted live evidence:

- source latest observation date: 2026-08-20
- source history fingerprint: d895eccbcbdda448a96961ae578c322c86ad42e78d3ed25ea33136975600d753
- maintenance state: SUCCEEDED for naive, damped_holt, ets, arima
- snapshot payloads refreshed after repair and persisted without parity drift

Important boundary:

- dashboard-preview remains a persisted snapshot consumer
- it still does not recompute Current Forecast inside the request path
- repaired maintenance plus repaired snapshot refresh now keep the accepted controlled snapshot seam fingerprint-fresh

## Mandatory Pre-Step B - Cross-Model Prediction Band Parity

Result: PASS

The active local defect was not a dashboard adapter distortion. It was a calibration refresh failure in the maintenance bridge path.

Before repair, the live datastore showed:

- all four models had 2732 persisted verification records
- 2250 persisted matured rows were present on the controlled slice
- all four calibration groups were incorrectly persisted as INSUFFICIENT_CALIBRATION_HISTORY with sampleCount = 0
- all four current snapshots therefore served no available prediction band

After repair and live refresh, the datastore shows for all four models:

- calibration freshness status: FRESH
- calibration availability status: AVAILABLE
- first forecast path date: 2026-08-21
- first path band status: AVAILABLE
- first path band source: INTERPOLATED_BETWEEN_EMPIRICAL_ANCHORS
- empirical anchor groups: 1M, 3M, 6M, 12M all AVAILABLE

Accepted sample counts after live repair:

- 1M: 660
- 3M: 617
- 6M: 555
- 12M: 425

This proves lawful origin-to-1M parity and inter-anchor parity now hold uniformly for naive, damped_holt, ets, and arima on the controlled series.

## Root Cause and Repair

Two local defects were repaired.

### 1. Calibration-only refresh gap

When persisted mature verification records existed but maintenance state lacked the matured watermark, incremental maintenance returned a no-op and left calibration groups stale or empty.

Repair:

- sg-runtime now triggers a calibration-only refresh request in that state
- the Python maintenance bridge now supports forced calibration-group rebuilds from already persisted mature records without replaying origins

### 2. Bridge identity mismatch

The maintenance bridge request did not carry canonical inputSource.

Effect:

- the Python exporter fell back to history.source = src_macrobond
- persisted verification records were normalized against the wrong identity
- all persisted records were filtered out during calibration rebuild

Repair:

- sg-runtime now passes inputSource = DYNAMIC_MARKET_DATA_STORE explicitly
- the live exporter keeps all 2732 persisted records under the correct identity

### 3. Live timestamp normalization defect

One live-only path still parsed persisted verificationObservedAt as a full ISO datetime using date.fromisoformat on the raw string.

Repair:

- normalized the value through the existing date-only helper before parsing

### 4. Active Forecast Portfolio metadata defect

Forecast Portfolio v3 registry metadata still advertised only three supported models.

Repair:

- restored ARIMA to the supported model list in dashboard-preview variant metadata

## Files Changed

- apps/sg-runtime/lib/forecast/rolling-daily-maintenance.ts
- apps/sg-runtime/tests/rolling-daily-maintenance.test.ts
- tooling/Benchmark-Forecasting/scripts/export_rolling_daily_incremental_maintenance.py
- tooling/Benchmark-Forecasting/tests/test_rolling_daily_incremental_maintenance.py
- apps/dashboard-preview/lib/dashboard-variants/registry.ts

## Validation

Focused automated validation passed.

SG Runtime:

```bash
cd '/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/apps/sg-runtime'
node --import tsx --test tests/rolling-daily-maintenance.test.ts
```

Result:

- 8 tests passed

Forecasting tooling:

```bash
cd '/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/tooling/Benchmark-Forecasting'
.venv/bin/python -m unittest tests.test_rolling_daily_incremental_maintenance
```

Result:

- 15 tests passed

Dashboard Preview:

```bash
cd '/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/apps/dashboard-preview'
node --import tsx --test tests/benchmark-forecast-runtime-query.test.ts tests/forecast-portfolio-to-time-series-viewer.test.ts
```

Result:

- 26 tests passed

Live operational validation passed.

Maintenance refresh:

- naive: SUCCEEDED, maturedRecordCount = 7, calibrationRefreshCount = 4
- damped_holt: SUCCEEDED, maturedRecordCount = 7, calibrationRefreshCount = 4
- ets: SUCCEEDED, maturedRecordCount = 7, calibrationRefreshCount = 4
- arima: SUCCEEDED, maturedRecordCount = 7, calibrationRefreshCount = 4

Snapshot refresh:

- naive: AVAILABLE, parity MATCHED
- damped_holt: AVAILABLE, parity MATCHED
- ets: AVAILABLE, parity MATCHED
- arima: AVAILABLE, parity MATCHED

Final live snapshot and calibration state confirms:

- all four models fingerprint-aligned to the same lawful source state
- all four models FRESH
- all four models AVAILABLE for calibration
- all four models expose pre-1M interpolation from the first forecast path day

## Stage 12 Acceptance Decision

Stage 12 is formally accepted for Forecast Portfolio v3 on the controlled series wocaes0074.

The accepted presentation now satisfies all required four-model conditions:

- faithful to persisted forecast truth
- no request-time recomputation in dashboard-preview
- no distortion of point forecast path
- lawful empirical-anchor and interpolated band presentation
- four-model selector metadata aligned with the actual supported model set
- historical verification remains separate from current forecast truth

## Out of Scope

Not executed in this task slice:

- PMOS closeout for this Stage 12 acceptance
- any Stage 13 work
- any champion/default/automatic model selection
- deployment