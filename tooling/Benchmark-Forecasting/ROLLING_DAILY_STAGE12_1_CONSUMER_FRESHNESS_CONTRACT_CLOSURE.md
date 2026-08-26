# Stage 12.1 - Consumer Freshness Contract Closure

Timestamp: 2026-08-22T05:53:15.000Z
Controlled Benchmark: wocaes0074 - Brent, Spot, FOB North Sea
Method: ROLLING_DAILY_POINT_IN_TIME
Method Version: rolling-daily-point-in-time-v1
Target Basis: POINT_IN_TIME
Models: Naive / Damped Holt / ETS / ARIMA

## Executive Result

Stage 12.1 - Consumer Freshness Contract Closure: PASS

Stage 12 Fully Closed: YES

Stage 13 Readiness: READY

The dashboard-preview POINT_IN_TIME consumer can now distinguish canonical FRESH prepared truth from canonical STALE prepared truth without fitting a Forecast, without running maintenance, without rebuilding calibration, and without mutating persisted Forecast state on read.

## Freshness Authority

Snapshot Fingerprint Authority:

- `rolling_daily_current_forecast_snapshots.payloadJson.audit.sourceHistoryFingerprint`

Current Source Fingerprint Authority:

- `rolling_daily_maintenance_state.latestSourceHistoryFingerprint`

Canonical Freshness Evaluator:

- FRESH when snapshot fingerprint equals maintenance-state latest source fingerprint for the same `seriesId + inputSource + targetBasis + methodId + methodVersion + modelId` identity
- STALE when snapshot fingerprint is missing or mismatched
- MISS when the prepared snapshot row is absent

Freshness Evaluation Cost Shape:

- one prepared snapshot read
- one narrow maintenance-state identity query
- no benchmark-history hydration
- no request-time Forecast compute
- no maintenance
- no writes

Full History Read Per Consumer Request: NO

Forecast Compute Required: NO

## Implementation

Minimal contract closure applied in dashboard-preview only:

- extended the generic current Forecast DTO with a `freshness` field
- kept freshness generic across all four accepted models
- reused SG Runtime's existing identity semantics by comparing prepared snapshot fingerprint to persisted maintenance-state latest source fingerprint
- preserved MISS as distinct from STALE
- left Forecast values, bands, and historical verification untouched

Important architectural boundary preserved:

- dashboard-preview still does not fit a Forecast on read
- dashboard-preview still does not run maintenance on read
- dashboard-preview still does not refresh snapshots on read
- dashboard-preview still consumes prepared persisted truth

## Live Fresh Case

Latest Lawful Source Observation: 2026-08-20

Current Source Fingerprint: `d895eccbcbdda448a96961ae578c322c86ad42e78d3ed25ea33136975600d753`

All four live models were read through the dashboard consumer seam and returned AVAILABLE + FRESH:

| Model | Snapshot Origin | Snapshot Fingerprint | Freshness | Returned ModelId | Median ms | p95 ms |
|---|---|---|---|---|---:|---:|
| Naive | 2026-08-20 | d895eccbcbdda448a96961ae578c322c86ad42e78d3ed25ea33136975600d753 | FRESH | naive | 57.137 | 477.390 |
| Damped Holt | 2026-08-20 | d895eccbcbdda448a96961ae578c322c86ad42e78d3ed25ea33136975600d753 | FRESH | damped_holt | 54.905 | 57.654 |
| ETS | 2026-08-20 | d895eccbcbdda448a96961ae578c322c86ad42e78d3ed25ea33136975600d753 | FRESH | ets | 56.756 | 291.680 |
| ARIMA | 2026-08-20 | d895eccbcbdda448a96961ae578c322c86ad42e78d3ed25ea33136975600d753 | FRESH | arima | 55.721 | 144.821 |

Live identity invariants preserved for all four models:

- `inputSource = DYNAMIC_MARKET_DATA_STORE`
- `methodId = ROLLING_DAILY_POINT_IN_TIME`
- `methodVersion = rolling-daily-point-in-time-v1`
- `targetBasis = POINT_IN_TIME`
- returned model identity equals requested model identity

## Controlled Stale Case

Controlled fixture evidence used the dashboard consumer seam with isolated test doubles:

- Fixture Snapshot Fingerprint: `fixture-snapshot-fingerprint-a`
- Fixture Current Source Fingerprint: `fixture-current-fingerprint-b`
- Expected: different
- Consumer Freshness: STALE
- Reason: `SOURCE_HISTORY_FINGERPRINT_MISMATCH`

Required non-compute invariants in the stale case all held:

- Forecast Fit: NO
- ARIMA Candidate Search: NO
- Maintenance: NO
- Calibration: NO
- Persistence Mutation: NO
- Forecast Value Mutation: NO
- Band Payload Mutation: NO
- Determinism: PASS

## Miss Case

Required MISS distinction held:

- Missing Snapshot Result: MISS
- Incorrectly Classified STALE: NO
- Cross-Model Fallback: NO

## Four-Model Result

| Model | Fresh | Stale | Read-only | Model identity | Forecast parity |
|---|---|---|---|---|---|
| Naive | PASS | PASS | PASS | PASS | PASS |
| Damped Holt | PASS | PASS | PASS | PASS | PASS |
| ETS | PASS | PASS | PASS | PASS | PASS |
| ARIMA | PASS | PASS | PASS | PASS | PASS |

Generic Freshness Contract: PASS

## Request Path Audit

Naive Fit On Read: NO

Damped Holt Fit On Read: NO

ETS Fit On Read: NO

ARIMA Fit On Read: NO

ARIMA Candidate Search On Read: NO

Maintenance On Read: NO

Historical Verification Recompute: NO

Band Calibration On Read: NO

Forecast Persistence Mutation: NO

Read-Triggered Self-Healing: NO

## Read-Only Audit

Repeated live FRESH reads caused zero material mutation.

Snapshot persistence before and after repeated reads was identical for all four models:

- naive updatedAt `2026-08-22T05:24:08.758Z`, payload hash `325811b414688e0aad42c2a44ea350d76fd86aef8aea0ae93cd7670f5dc750a3`
- damped_holt updatedAt `2026-08-22T05:24:11.168Z`, payload hash `b43322a947dda20e626f7fd1ebe5baf7cd98cf092d2914d65fb91afd132e7000`
- ets updatedAt `2026-08-22T05:24:13.357Z`, payload hash `50b063d67c16d81ea5a2a9cd078826c3ae793f3e1e43db1b72c103d12e0ec3d8`
- arima updatedAt `2026-08-22T05:24:28.964Z`, payload hash `3c9e4517c47637566b3ac4edd1198b8683348fc3b885ef9e19afe4974a1789ba`

Maintenance state before and after repeated reads was also identical for all four models:

- all four models kept `latestSourceHistoryFingerprint = d895eccbcbdda448a96961ae578c322c86ad42e78d3ed25ea33136975600d753`
- all four models kept `lastProcessedOriginAt = 2026-08-20T00:00:00.000Z`
- all four models kept `lastMaintenanceStatus = SUCCEEDED`

Material Mutation: 0

## Forecast Truth

Point Forecast Mutation: NO

Prediction Band Mutation: NO

Historical Verification Mutation: NO

Stage 12.1 changed none of:

- Naive point Forecast: UNCHANGED
- Damped Holt point Forecast: UNCHANGED
- ETS point Forecast: UNCHANGED
- ARIMA point Forecast: UNCHANGED
- Prediction bands: UNCHANGED
- Historical verification: UNCHANGED

## Consumer Contract Result

Consumer Can Distinguish FRESH: YES

Consumer Can Distinguish STALE: YES

Consumer Can Distinguish MISS: YES

Freshness Is Generic Across Models: YES

Freshness Exposed Without Forecast Compute: YES

Freshness Exposed Without Maintenance: YES

Freshness Exposed Without Writes: YES

## Special-Case Audit

Classification: NONE

Findings:

- no ARIMA-specific freshness fork in the active dashboard consumer path
- no three-model-only freshness list
- no freshness fallback to a default model
- no read-triggered maintenance
- no read-triggered Forecast calculation
- no full-history fingerprint calculation per dashboard request

## Scope Guardrails

- Benchmark Finder Dependency: NONE
- AppShell Dependency: NONE
- Dashboard Computes Forecast: NO
- New Forecast Service: NO
- New Database: NO
- New Table: NO
- Schema Migration: NO
- Forecast Methodology: NOT CHANGED
- Model Fit Logic: NOT CHANGED
- ARIMA Candidate Policy: NOT CHANGED
- Historical Replay: NO
- Band Methodology: NOT CHANGED
- Dashboard Redesign: NO
- Live Snapshot Refresh: NOT PERFORMED
- Deployment: NOT PERFORMED
- Stage 13: NOT EXECUTED
- Champion: NOT DEFINED
- Preferred Model: NOT DEFINED
- Default Model: NOT DEFINED
- Automatic Model Selection: NOT BUILT
- Automa / Auto: NOT BUILT

## Validation

Focused dashboard consumer seam tests:

```bash
cd '/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/apps/dashboard-preview'
node --import tsx --test tests/benchmark-forecast-runtime-query.test.ts
```

Result:

- 9 tests passed

Adjacent dashboard consumer + adapter tests:

```bash
cd '/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/apps/dashboard-preview'
node --import tsx --test tests/benchmark-forecast-runtime-query.test.ts tests/forecast-portfolio-to-time-series-viewer.test.ts
```

Result:

- 29 tests passed

## Stage 12.1 Decision

Stage 12.1 passes because:

- canonical source/snapshot freshness semantics were reused
- FRESH is represented by the consumer
- STALE is represented by the consumer
- MISS remains distinct
- all four models use the same generic contract
- no Forecast model fits on read
- no ARIMA candidate selection occurs on read
- no maintenance occurs on read
- no calibration occurs on read
- no persistence mutation occurs on read
- Forecast values remain unchanged
- band values remain unchanged
- historical verification remains unchanged
- repeated reads are deterministic
- no full-history fingerprint calculation occurs per consumer request
- no Benchmark Finder dependency exists
- no AppShell dependency exists

Therefore:

- Stage 12.1: PASS
- Stage 12 Fully Closed: YES
- Stage 13 Readiness: READY

Stop after Stage 12.1.