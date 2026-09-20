# PPF-1 Demo Task 2 — Truthful uncertainty bands and Historical Verification V1

## Verdict

`TASK_2_GATE = PASS`

`PROCEED_TO_TASK_3 = YES`

Task 2 adds reusable, versioned 80% uncertainty bands and a factual Historical Verification contract without changing the four-model choice, forecast methodology, database schema, or canonical ownership.

## Implemented policy

- Band policy: `ADAPTIVE_UNCERTAINTY_BANDS_V1`.
- Empirical source: `EMPIRICAL_EXACT_RESIDUALS`, lawful only from 30 exact comparable residuals.
- Short-history source: `MODEL_NATIVE_SHORT_HISTORY`, never reported as empirically calibrated.
- Coverage: P10/P90, or 80%.
- Naive uses its own innovation RMS and needs at least two observations for a band.
- Damped Holt uses deterministic simulation from the fitted Damped Holt model (`seed=1729`, `repetitions=1000`).
- ETS uses deterministic simulation from the selected ETS fit (`seed=1729`, `repetitions=1000`).
- ARIMA uses the selected ARIMA forecast distribution with `alpha=0.2`.
- No scale, residual, MASE value, or band width is fabricated.

The point forecast and band come from the same selected model fit. A controlled A/B regression against Task 1 base SHA `5da1394924b6681de79e6c0eeff4f9cc29de54b0` compared 192 point forecasts and found 192 exact matches, zero failures, and maximum absolute delta `0`.

## Exact identity and persistence

The band identity contains forecast identity, input source, source and target cadence, horizon and target date, source-history fingerprint, training policies, band policy and source, calibration method/version, and calibration cutoff.

Model-native bands are stored inside existing Current Forecast point metadata. The metadata round-trip test passed through the legacy-compatible persistence path. No schema migration or new table was introduced. Prepared reads remain read-only and do not call a prepare route or production compute.

Rolling Daily point identity and calendar projection semantics remain unchanged. Exact empirical Rolling Daily calibration remains preferred at 30 or more compatible residuals; interpolation remains unchanged; a sub-30 inventory uses an explicitly model-native fallback.

## Historical Verification

Contract: `HISTORICAL_VERIFICATION_V1`.

Statuses are `AVAILABLE`, `LIMITED_SAMPLE`, `INSUFFICIENT_HISTORY`, `NOT_PREPARED`, and `FAILED`. Each prepared result exposes factual successful, expected, and failed origin counts plus coverage. Zero lawful origins are `INSUFFICIENT_HISTORY`; zero records are never reported as successful verification; fitted in-sample values and model-native bands are never relabeled as Historical Verification. Current Forecast is not blocked by limited or unavailable Historical Verification.

Readiness remains separated into `FAST_READY`, `BANDS_READY`, `CALIBRATED_READY`, `RECENT_VERIFICATION_READY`, and `FULL_READY`. A lawful model-native band may satisfy `BANDS_READY`, but `CALIBRATED_READY` additionally requires an exact persisted empirical band and at least 30 compatible residuals.

## Live read-only validation

Authority: Neon project `autumn-waterfall-65938876`, branch `br-purple-shape-b2az1npx`, database `neondb`. The audit performed SELECT-only retrieval into a temporary local process. It made no Neon writes and committed no raw observations.

| Series | Lawful daily observations | Contiguous monthly observations | Variants | Pass |
|---|---:|---:|---:|---:|
| `ehr2027g_cl` | 119 | 7 | 12 | 12 |
| `lmescusd20270226` | 199 | 10 | 12 | 12 |
| `hg2027g_cl` | 390 | 20 | 12 | 12 |
| `lmeofcucashask` | 9,795 | 467 | 12 | 12 |

Final matrix: `48 PASS / 0 FAIL` across four equal models and all three methodologies. Every validated Current path exposed finite ordered Lower/Upper bounds with truthful source and calibration state. Period-method Historical Verification executed lawful 1M out-of-sample origins, up to 24 per exact variant: short histories reported `LIMITED_SAMPLE`, the long history reported `AVAILABLE`, and no origins failed. The Rolling Daily portion verified lawful matured-origin capacity and Current/band execution; it did not create or claim production verification artifacts.

An earlier 46/48 diagnostic was rejected as non-authoritative because it compared two independent ETS fits after simulation. The controlled Task 1-versus-Task 2 A/B test superseded it and proved 192/192 point forecasts unchanged; the final full matrix then passed 48/48.

## Local validation

- SG Runtime focused regression: `175 PASS / 0 FAIL / 0 SKIP`; typecheck `PASS`.
- Forecast Tooling focused regression: `109 PASS / 0 FAIL`.
- Boundary tests cover 29/30/31 empirical residuals, Naive 1/2 observations, and model-native bands at 6/9/19 observations.
- Persistence, prepared-read, identity isolation, Historical Verification state, Rolling Daily empirical/interpolation, and Task 1 adaptive-history regressions passed.
- `git diff --check = PASS`.
- No selected demo series identifier was added to changed production logic.

## Safety and scope

- `SCHEMA_MIGRATION_USED = NO`
- `NEON_WRITES = NO`
- `RAW_MARKET_DATA_COMMITTED = NO`
- `DEPLOYMENT_PERFORMED = NO`
- `PRODUCTION_PREWARM_PERFORMED = NO`
- `STAGE_12_MODIFIED = NO`
- `STAGE_12_COMPLETION_CLAIMED = NO`
- `DEMO_ONLY_SOURCE_CODE_CREATED = NO`
- `SERIES_SPECIFIC_FORECAST_LOGIC_CREATED = NO`
- `MANUAL_FORECAST_ARTIFACT_SQL_USED = NO`
- `SECOND_FORECAST_ENGINE_CREATED = NO`
- `FULL_PPF1_REUSE_PRESERVED = YES`

PMOS save and PHR publication are intentionally deferred to the owner-requested aggregate closeout after the complete demo-readiness workstream. No pending artifact was created manually.

The final commit SHA is reported in the external handoff after publication, avoiding a self-referential evidence commit.
