# ARIMA Reproducibility Fast Serving Acceptance

Status: STAGE 2 ACCEPTANCE
Scope: `ROLLING_DAILY_POINT_IN_TIME` ARIMA reproducibility and prepared fast-serving gate
Date: 2026-08-20

## 1. Executive Result

`ARIMA Reproducibility: PASS`

`ARIMA Fast Serving Feasibility: PASS`

`Stage 3 Readiness: READY`

Stage 2 established that the current rolling-daily ARIMA result is reproducible under the same lawful input identity and can be served from a prepared shared snapshot seam without re-running ARIMA candidate fitting at read time.

## 2. Authorities Read

Authorities read for Stage 2:

- `Canon/v1.0-canonical-prompt-contract.md`
- `Canon/v1.0-vsc-mandatory-execution-canon.md`
- `Canon/v1.0-developer-lifecycle-specification.md`
- `tooling/Benchmark-Forecasting/FORECASTING_CANON.md`
- `tooling/Benchmark-Forecasting/FORECASTING_METHODS_SPEC.md`
- `tooling/Benchmark-Forecasting/ROLLING_DAILY_POINT_IN_TIME_METHOD_SPEC.md`
- `tooling/Benchmark-Forecasting/ROLLING_DAILY_PRODUCTION_FORECAST_CONTRACT.md`
- `tooling/Benchmark-Forecasting/ROLLING_DAILY_INDEPENDENT_FINAL_VALIDATION.md`
- `tooling/Benchmark-Forecasting/ROLLING_DAILY_TARGET_BASIS_CANONICALIZATION_ACCEPTANCE.md`
- `tooling/Benchmark-Forecasting/FORECAST_TARGET_BASIS_CANON.md`
- `tooling/Benchmark-Forecasting/ARIMA_ROLLING_DAILY_MODEL_CONTRACT_PARITY_AUDIT.md`
- `tooling/Benchmark-Forecasting/ARIMA_ROLLING_DAILY_CURRENT_FORECAST_ACCEPTANCE.md`
- `apps/dashboard-preview/FORECAST_DEPLOYMENT_CANON.md`

Deployment Canon: `READ / OBEYED`

## 3. Reproducibility Identity

Evidence-backed complete identity for the controlled current result:

### Forecast identity

- `seriesId = wocaes0074`
- `forecastMethod = ROLLING_DAILY_POINT_IN_TIME`
- `methodVersion = rolling-daily-point-in-time-v1`
- `targetBasis = POINT_IN_TIME`
- `modelId = arima`
- `originDate = 2026-08-18`

### Input/source identity

- `inputSource = DYNAMIC_MARKET_DATA_STORE`
- `sourceLatestObservationDate = 2026-08-18`
- `sourceHistoryFingerprint = 35ecf750e4998799462a2fa9a57758f048695b26892c5fca6436669e32138f82`

Stage 2 reuses the existing shared rolling-daily source fingerprint mechanism via `buildRollingDailyHistoryFingerprint(...)`.

### ARIMA policy identity

- `policyIdentity = ARIMA_NON_SEASONAL_BOUNDED_AICC_V1`
- `candidateCount = 17`
- `selectionCriterion = AICc`
- `tieBreakPolicy = LOWER_D_THEN_LOWER_P_PLUS_Q_THEN_P_THEN_Q`
- `fitImplementation = STATSMODELS_ARIMA_STATESPACE`

### Selected-fit metadata

- `selectedOrder = [2,1,2]`
- `trend = t`
- `seasonal_order = [0,0,0,0]`
- fitted parameter vector remains inside shared `selectedParameters`

## 4. ARIMA Policy Provenance

Actual Stage 2 provenance recorded in shared model metadata and exported through the rolling-daily current bridge:

- candidate catalog/count: `17`
- selection criterion: `AICc`
- tie-break: lower `d`, then lower `(p+q)`, then lower `p`, then lower `q`
- trend policy: `c` for `d=0`, `t` for `d=1`
- policy identity: `ARIMA_NON_SEASONAL_BOUNDED_AICC_V1`
- selected candidate: `ARIMA(2,1,2)`

This provenance is stored in the shared `selectedParameters` map rather than in an ARIMA-specific DTO.

## 5. Determinism Evidence

### Same-process repeatability

Result: `PASS`

Controlled benchmark repeated two times in the same runtime context produced canonically equivalent results.

Observed fresh compute timings:

- first compute: `13213.453292 ms`
- second compute: `12859.228291000001 ms`

### Cross-process repeatability

Result: `PASS`

Two independent Python executions of `scripts/export_rolling_daily_current_forecast.py` with the same canonical input payload produced identical serialized outputs.

Observed proof points:

- selected candidate A: `ARIMA(2,1,2)`
- selected candidate B: `ARIMA(2,1,2)`
- path length A: `365`
- path length B: `365`

### Canonical serialization equality

Result: `PASS`

Important nuance:

- raw `JSON.stringify` on the full production payload is not a valid reproducibility oracle because `audit.generatedAt` is expected to differ per computation and floating-point string formatting may differ trivially after JSONB round-trip.
- canonical equality for Stage 2 was therefore evaluated on a normalized payload with volatile generation timestamp removed and numeric values compared under the same practical tolerance already used by the shared snapshot parity seam.

## 6. Hidden Non-Determinism Audit

Checked:

- random seeds
- parallel candidate races
- unordered candidate enumeration
- unstable AICc tie handling
- library default trend delegation
- unstable fit ordering inside Stage 1 path-fit integration

Findings:

- no random search or parallel candidate race exists
- candidate enumeration remains explicit and ordered
- deterministic tie-break remains preserved
- same-input same-origin same-policy selected the same `ARIMA(2,1,2)` in same-process and cross-process runs
- no new hidden non-determinism was introduced by the rolling-daily path-fit integration

## 7. Current Serving Architecture

Evidence-backed current path for the Stage 2 controlled seam:

```text
lawful DAILY source history
    ↓
rolling-daily production forecast service
    ↓
Python current-forecast bridge
    ↓
shared production payload
    ↓
rolling_daily_current_forecast_snapshots.payloadJson
    ↓
prepared snapshot read
    ↓
consumer
```

Important distinction:

- fresh compute still invokes the Python bridge and ARIMA fitting
- prepared serving reads the stored shared payload and does not re-run ARIMA fitting

## 8. Prepared Forecast Identity

Prepared snapshot identity is keyed by existing shared fields:

- `seriesId`
- `inputSource`
- `targetBasis`
- `methodId`
- `methodVersion`
- `modelId`

Stage 2 adds source-history drift validation at read time using:

- `payload.audit.sourceHistoryFingerprint`
- request-side `sourceHistoryFingerprint`

Read behavior:

- same fingerprint -> `HIT`
- missing fingerprint -> `STALE`
- mismatched fingerprint -> `STALE`

This is a shared seam behavior, not an ARIMA-specific staleness subsystem.

## 9. Round-Trip Equality

Result: `PASS`

The following contract fields were preserved through:

```text
compute
→ persist shared snapshot
→ retrieve prepared snapshot
```

- `seriesId`
- `modelId`
- `forecastMethod`
- `methodVersion`
- `targetBasis`
- `originDate`
- path dates
- path pointForecast values
- anchors
- selected candidate
- ARIMA provenance in `selectedParameters`
- `status`

Canonical normalized round-trip equality passed.

## 10. Compute Performance

Controlled benchmark `wocaes0074`:

- candidate fits attempted: `17`
- candidate fits successful: `17`
- fresh compute #1: `13213.453292 ms`
- fresh compute #2: `12859.228291000001 ms`

Supporting Stage 1 diagnostics remain consistent:

- one direct current run measured about `11.72 s`
- one explicit fit-path timing measured about `13.29 s`

This remains a material fresh-compute cost, but not a Stage 2 blocker.

## 11. Serving Performance

Prepared-result serving timings through the shared snapshot seam:

- persistence of one prepared snapshot: `502.11279099999956 ms`
- prepared read status: `HIT`
- prepared read timings over bounded repeats:
  - `85.24512500000128 ms`
  - `56.68958399999974 ms`
  - `55.06320799999958 ms`
  - `55.401708999997936 ms`
  - `54.91166599999997 ms`

Separate experiment also observed one prepared read at `77.55712499999936 ms`.

Prepared serving is therefore materially faster than fresh ARIMA compute and does not require candidate re-fitting.

## 12. Fast Serving Gate

```text
Does user-facing serving require ARIMA refit?
NO

Can ARIMA use the same prepared Forecast serving seam?
YES

New Service Required?
NO

New ARIMA Persistence Family Required?
NO
```

`ARIMA Fast Serving Feasibility: PASS`

Reason:

- the shared rolling-daily snapshot seam can persist and read an ARIMA payload
- prepared read returns the stored canonical payload without invoking ARIMA compute
- fingerprint mismatch can be detected and surfaced as stale instead of silently reusing outdated prepared output

## 13. Production Contract Compatibility

`ARIMA-specific DTO: NO`

`Shared contract round trip: PASS`

Stage 2 used only shared rolling-daily payload structures.

## 14. Public Exposure

```text
Public SG Runtime ARIMA Exposure:
NOT ADDED

Dashboard ARIMA Exposure:
NOT ADDED
```

## 15. Persistence Changes

```text
Database:
Neon PostgreSQL / neondb / public

New Database:
NO

New ARIMA Table:
NO

Shared Schema Changed:
NO
```

Reason:

- the existing `rolling_daily_current_forecast_snapshots` table already stores generic `modelId` and JSON payload
- Stage 2 required only code-level widening of the internal snapshot seam and additional payload provenance fields

## 16. Deployment Result

```text
Deployment Performed:
NO

Standalone dashboards-library repository sync performed:
NO

Render Triggered:
NO

Benchmark Finder Touched:
NO

AppShell Touched:
NO

New Service Created:
NO
```

## 17. Three-Axis Assessment

### LOW COST

- fresh ARIMA compute remains materially expensive at about `12.9 - 13.2 s`
- prepared read is far cheaper than fresh compute
- no new service, queue, worker, or persistence family was required

### METHODOLOGICAL CORRECTNESS

- same lawful source history fingerprint and same origin reproduce the same canonical result
- ARIMA policy identity is now explicit in shared provenance
- prepared serving replays a canonical result rather than recalculating or approximating it

### FAST / REPRODUCIBLE SERVING

- prepared read does not require ARIMA refit
- prepared round-trip is canonically equal under the same practical numeric parity semantics already used by the shared seam
- source-history drift can be detected by fingerprint mismatch

## 18. Residual Risks

- fresh ARIMA compute cost remains around `13 s` on the controlled benchmark and should be revisited in Stage 7 cost characterization
- exact reproducibility across materially different runtime/library versions was not exhaustively proven in this stage; Stage 2 only made the current policy identity explicit
- the direct `sg-runtime` benchmark loader path in this local environment still depends on Macrobond credentials, so the controlled seam experiment used the already accepted local analytics-series source instead of direct provider fetch inside one script
- prepared-read equality relies on canonical normalization plus the existing `1e-9` numeric parity semantics rather than raw JSON byte identity because JSONB/storage formatting can slightly alter float string representation

## 19. Files Changed

- `tooling/Benchmark-Forecasting/forecasting/models/arima.py`
- `tooling/Benchmark-Forecasting/scripts/export_rolling_daily_current_forecast.py`
- `tooling/Benchmark-Forecasting/tests/test_rolling_daily_current_forecast_export.py`
- `apps/sg-runtime/lib/forecast/rolling-daily-production-forecast.ts`
- `apps/sg-runtime/lib/forecast/rolling-daily-current-forecast-snapshot.ts`
- `apps/sg-runtime/scripts/persist-rolling-daily-current-forecast-snapshot.ts`
- `apps/sg-runtime/tests/rolling-daily-production-forecast.test.ts`
- `apps/sg-runtime/tests/rolling-daily-current-forecast-snapshot.test.ts`
- `tooling/Benchmark-Forecasting/ARIMA_REPRODUCIBILITY_FAST_SERVING_ACCEPTANCE.md`

## 20. Stage 3 Recommendation

`Stage 3 - Path Shape Characterization`

Do not begin automatically.
