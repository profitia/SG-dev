# ROLLING_DAILY Stage 11 Current Snapshot / Fast Presentation

## Executive Result

Status: PASS
Series: wocaes0074 - Brent, Spot, FOB North Sea
Models: naive / damped_holt / ets / arima
Forecast Method: ROLLING_DAILY_POINT_IN_TIME
Target Basis: POINT_IN_TIME

Stage 11 accepted the current-snapshot freshness lifecycle and fast presentation seam.

At task start, all four prepared snapshots were stale against the live lawful source state. Canonical incremental maintenance advanced the persisted rolling-daily state from 2026-08-18 to 2026-08-20 without a rebuild, the prepared snapshots were refreshed through the existing snapshot persistence path, and post-refresh reads were HIT for all four models against the live source fingerprint.

The dashboard-preview POINT_IN_TIME seam then served repeated prepared reads directly from persisted snapshots with fetchCalls = 0, deterministic payloads, and no snapshot mutation.

## Starting Live State

- Live lawful source date: 2026-08-20
- Live lawful source fingerprint: d895eccbcbdda448a96961ae578c322c86ad42e78d3ed25ea33136975600d753
- Starting maintenance date for all four models: 2026-08-18
- Starting snapshot origin for all four models: 2026-08-18
- Starting freshness verdict: STALE for naive / damped_holt / ets / arima

Starting stale reasons:

- naive: source date mismatch, source fingerprint mismatch, snapshot origin lag, missing snapshot source fingerprint
- damped_holt: source date mismatch, source fingerprint mismatch, snapshot origin lag, missing snapshot source fingerprint
- ets: source date mismatch, source fingerprint mismatch, snapshot origin lag, missing snapshot source fingerprint
- arima: source date mismatch, source fingerprint mismatch, snapshot origin lag

## Controlled Catch-Up

Canonical path used:

- createRollingDailyMaintenanceService().runIncrementalMaintenance(...)
- fullRebuild = false
- no 681-origin replay
- snapshot refresh only through persist-rolling-daily-current-forecast-snapshot.ts

Catch-up result:

- naive: SUCCEEDED | newOriginCount=2 | maturedRecordCount=0 | calibrationRefreshCount=4 | runtimeMs=3442
- damped_holt: SUCCEEDED | newOriginCount=2 | maturedRecordCount=0 | calibrationRefreshCount=4 | runtimeMs=2688
- ets: SUCCEEDED | newOriginCount=2 | maturedRecordCount=0 | calibrationRefreshCount=4 | runtimeMs=3094
- arima: SUCCEEDED | newOriginCount=2 | maturedRecordCount=0 | calibrationRefreshCount=4 | runtimeMs=27317

Operational fix applied during Stage 11:

- apps/sg-runtime/scripts/persist-rolling-daily-current-forecast-snapshot.ts now loads .env.local before execution, so the canonical snapshot refresh command works standalone instead of failing with MARKET_DATA_DATABASE_URL is not configured.

## Post Catch-Up Freshness

Post-refresh source/date/fingerprint parity:

- naive: FRESH | maintenance=2026-08-20 | snapshot origin=2026-08-20 | preparedRead=HIT
- damped_holt: FRESH | maintenance=2026-08-20 | snapshot origin=2026-08-20 | preparedRead=HIT
- ets: FRESH | maintenance=2026-08-20 | snapshot origin=2026-08-20 | preparedRead=HIT
- arima: FRESH | maintenance=2026-08-20 | snapshot origin=2026-08-20 | preparedRead=HIT

All four refreshed snapshots now carry the live fingerprint d895eccbcbdda448a96961ae578c322c86ad42e78d3ed25ea33136975600d753 and calibration freshnessStatus = FRESH.

## Fast Presentation Acceptance

Canonical dashboard seam audited:

- current read owner: apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts
- POINT_IN_TIME path: getBenchmarkForecastCurrent(...) -> getPersistedRollingDailyCurrentForecast(...) -> rollingDailyCurrentForecastSnapshot.findFirst(...)
- consumer owner: apps/dashboard-preview/lib/time-series-viewer/forecast-portfolio-to-time-series-viewer.ts
- consumer parity: buildPointInTimeCurrentForecastSeries consumes rollingDailySnapshot.path directly for central, upper, and lower day-resolution series

Repeated prepared-read timing on the real dashboard seam, 5 reads per model:

- naive: min 33.398 ms | median 33.698 ms | max 38.726 ms
- damped_holt: min 33.650 ms | median 34.180 ms | max 112.231 ms
- ets: min 33.893 ms | median 35.297 ms | max 35.568 ms
- arima: min 28.157 ms | median 34.274 ms | max 99.398 ms

Prepared-read acceptance results:

- fetch fallback: NO
- persistence mutation on read: NO
- deterministic repeated payloads: PASS
- request-time ARIMA fit on read: NO
- historical calibration rebuild on read: NO
- Benchmark Finder dependency: NONE

## Executed Validations

- Preflight PASS: Prompt Contract loaded, Execution Canon loaded, Developer Lifecycle loaded, pmos:verify-runtime PASS, pending-artifact clear, MEMOROS configured, MEMOROS health ok
- Live starting probe PASS: confirmed all four models stale at task start against live source date 2026-08-20
- Incremental catch-up PASS: canonical append-only maintenance advanced all four models by exactly two origins without rebuild
- Snapshot refresh PASS: all four models AVAILABLE with parityStatus MATCHED
- Post catch-up prepared-read contract PASS: HIT for all four models against live source fingerprint
- Dashboard prepared-read regression PASS: node --import tsx --test tests/benchmark-forecast-runtime-query.test.ts
- Dashboard prepared-read timing PASS: repeated POINT_IN_TIME reads from the real dashboard seam completed with fetchCalls = 0 and no snapshot mutation

## Guardrails

- No Stage 12 work started
- No Stage 13 work started
- No deployment performed
- No Dashboard UX change
- No forecast methodology change
- No fitting logic change
- No ARIMA candidate policy change
- No Benchmark Finder change
- No AppShell change
- No new forecast service
- No new database/table/schema

## Overall Matrix

- startingFreshnessMatrix: PASS
- controlledCatchUp: PASS
- snapshotRefresh: PASS
- postCatchUpFreshness: PASS
- preparedReadFastPath: PASS
- preparedReadDeterminism: PASS
- presentationConsumerParity: PASS
- overall: PASS

## Deferred

- NO_STAGE_12_WORK_STARTED
- NO_STAGE_13_WORK_STARTED
- NO_FORECAST_METHODOLOGY_CHANGE
- NO_MODEL_FITTING_LOGIC_CHANGE
- NO_ARIMA_CANDIDATE_POLICY_CHANGE
- NO_DASHBOARD_UX_CHANGE
- NO_BENCHMARK_FINDER_CHANGE
- NO_APPSHELL_CHANGE
- NO_DEPLOYMENT