# ROLLING_DAILY Stage 7 Performance & Cost Characterization

Performance & Cost Characterization: COMPLETE
Stage 8 Readiness: READY
Primary Model: ARIMA
Reference Models: Naive / Damped Holt / ETS

## Executive Characterization

- Fresh ARIMA computation: median `14378.88518749969` ms across `2` measured runs on the accepted current history.
- Historical full verification: imported Stage 4 runtime `6810.170992082974` seconds across `681` origins and `36` batches.
- Incremental maintenance: `MEASURED_WITHOUT_PERSISTENCE` with one-origin total `1753.756958001759` ms and persistence `NOT_MEASURED_SAFE_READ_ONLY`.
- Band calibration: median `1303.713915986009` ms from persisted ARIMA verification residuals only.
- Prepared serving: median `27.162020499999983` ms over `20` Dashboard Library prepared-snapshot reads without ARIMA fit.

## Historical Full-Run Evidence

| Evidence Run | Origins | Batches | Runtime | Runtime / Origin |
| --- | ---: | ---: | ---: | ---: |
| Stage 4 | 681 | 36 | 6810.170992082974 s | 10.000251089695997 s |
| Stage 5 recomputation | 681 | 36 | 6957.410418666666 s | 10.216461701419481 s |

## Current Compute

| Model | History N | Runs | Min | Median | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| naive | 10460 | 5 | 2.0556250237859786 | 2.2200840176083148 | 2.5847500073723495 |
| damped_holt | 10460 | 5 | 92.81362500041723 | 94.01499998057261 | 96.94295900408179 |
| ets | 10460 | 5 | 229.961791948881 | 240.91495899483562 | 310.37554203066975 |
| arima | 10460 | 2 | 13887.437249999493 | 14378.88518749969 | 14870.333124999888 |

## ARIMA Fit Characteristics

- Candidate Policy: `17 candidates`
- Selected order: `ARIMA(2,1,2)`
- Candidate attempts: `17`
- Candidate successes: `17`
- Current history observations: `10460`
- Fresh runtime median: `14378.88518749969` ms

## Incremental Maintenance

- Normal one-origin maintenance: `MEASURED_WITHOUT_PERSISTENCE`
- Data preparation: `0.02099998528137803` ms
- Model compute: `None`
- Verification/payload assembly: `None`
- Persistence: `NOT_MEASURED_SAFE_READ_ONLY`
- Total: `1753.756958001759` ms
- Repair/Catch-Up: `SEPARATE_NOT_MEASURED`

## Band Cost

- Calibration records read: `2724`
- P10/P50/P90 calibration runtime median: `1303.713915986009` ms
- Daily interpolation runtime median: `0.7248330512084067` ms
- Daily path length: `365`
- Historical model refits: `0`

## Prepared Serving

- Prepared read sample count: `20`
- Canonical seam: `DASHBOARD_LIBRARY_PREPARED_SNAPSHOT_DB_READ`
- Min: `25.351791999999932` ms
- Median: `27.162020499999983` ms
- P95: `34.064750000000004`
- Max: `114.81037500000014` ms
- Prepared read triggers ARIMA fit: `NO`
- Prepared read triggers historical calibration recomputation: `NO`
- Prepared read mutates forecast persistence: `NO`
- Prepared read depends on Benchmark Finder: `NO`
- Prior invalidated timing: `30.861645500000122` ms (`INVALID_FOR_CANONICAL_FORECAST_SERVING`)

## Serving Topology Audit

- Defect classification: `BENCHMARK_CONFIGURATION_DEFECT`
- Previous localhost owner app: `apps/sg-runtime`
- Previous localhost co-located UI: `Benchmark Finder`
- Previous history route owner: `apps/sg-runtime/app/api/benchmark/analytics-series/route.ts`
- Canonical prepared seam: `DASHBOARD_LIBRARY_PREPARED_SNAPSHOT_DB_READ`
- Dashboard Library presentation compatibility: `PASS`
- Forecast Core depends on Benchmark Finder: `NO`
- SG Runtime prepared serving depends on Benchmark Finder: `NO`
- Dashboard Library requires Benchmark Finder: `NO`

## Fresh Vs Prepared

| Path | Compute Characteristics | Typical Runtime |
| --- | --- | ---: |
| Fresh ARIMA Forecast | 17-candidate fit | 14378.88518749969 ms |
| Band Calibration | residual quantiles only | 1303.713915986009 ms |
| Band Interpolation | daily offset interpolation | 0.7248330512084067 ms |
| Prepared Serving | no ARIMA fit | 27.162020499999983 ms |

## Memory / CPU

- Peak RSS: `NOT_MEASURED`
- CPU: `MEASURED_PROCESS_CPU_TIME`
- ARIMA current CPU time median: `13495.543` ms

## Derived Characterization

- historicalRuntimePerOriginSeconds: `10.000251089695997`
- historicalOriginsPerMinute: `5.999849349965069`
- freshArimaPreparedReadRatio: `529.3746533877957`
- arimaToEtsFreshComputeRatio: `59.684484713993726`
- bandCalibrationToArimaFreshRatio: `0.09066863661442925`
- computeCostRatioDescriptiveOnly: `True`

## Environment

- benchmarkTimestamp: `2026-08-21T11:00:17Z`
- platform: `macOS-26.5.2-arm64-arm-64bit-Mach-O`
- system: `Darwin`
- architecture: `arm64`
- pythonVersion: `3.13.0`
- numpyVersion: `2.5.2`
- statsmodelsVersion: `0.14.6`
- processType: `python-script`
- databaseAccessMode: `network-backed-neon-via-runtime-and-snapshot-seams`

## Output Parity

- pointForecastParity: `PASS`
- selectedOrderParity: `PASS`
- bandQuantileParity: `PASS`
- bandPathParity: `PASS`
- stage6Pre1MSemantics: `PASS`

## Cost Interpretation Boundary

- Stage 7 establishes: `PERFORMANCE AND COST EVIDENCE`
- Stage 7 does NOT establish: `FINAL MODEL ACCEPTANCE`
- Stage 7 does NOT establish: `CHAMPION`
- Stage 7 does NOT establish: `DEFAULT MODEL`
- Stage 7 does NOT weight: `COST vs CORRECTNESS vs SERVING SPEED`
- Direct Currency Cost: `NOT CALCULATED`

