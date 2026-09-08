# PPF-1 Stage 6 FAST_READY Profiler

Generated at: 2026-09-08T04:20:15.024Z
Branch: ppf1/stage6-fast-ready-profiler-gate-20260907
Git HEAD: c27a2629e1a188b66751cc962a3807d3a6b60203
Cold samples per profile: 5
Warm prepared-hit samples per profile: 10
Recent Verification candidates: 1, 3, 6, 12
FAST_READY budget: 15000 ms

## Global Decision

Recommendation: INLINE_WITH_GLOBAL_N_FAST
Global N_FAST: 12
Profile-specific controls required: false

## Profiles

| Profile | Cold conservative ms | Warm hit p95/max ms | Dominant bottleneck | Max inline recent N |
| --- | ---: | ---: | --- | ---: |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|naive | 2976.526 | 30.189 | PYTHON_PROCESS_STARTUP | 12 |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|naive | 2502.063 | 22.701 | PYTHON_PROCESS_STARTUP | 12 |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|naive | 115.738 | 19.319 | OTHER | N/A |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|damped_holt | 2536.316 | 21.562 | PYTHON_PROCESS_STARTUP | 12 |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|damped_holt | 2545.862 | 23.363 | PYTHON_PROCESS_STARTUP | 12 |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|damped_holt | 1442.083 | 23.427 | OTHER | N/A |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|ets | 3364.312 | 22.973 | PYTHON_PROCESS_STARTUP | 12 |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|ets | 3509.773 | 21.811 | PYTHON_PROCESS_STARTUP | 12 |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|ets | 1768.883 | 26.771 | DATABASE_ADMISSION | N/A |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|arima | 3827.407 | 22.416 | PYTHON_PROCESS_STARTUP | 12 |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|arima | 4166.99 | 20.907 | PYTHON_PROCESS_STARTUP | 12 |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|arima | 2746.99 | 18.453 | OTHER | N/A |

## Notes

- Period Current uses exact SG Runtime Current preparation plus exact prepared-read confirmation.
- Rolling Daily phase gaps remain explicitly marked as NOT_SEPARATELY_MEASURABLE where the runtime does not expose an isolated lawful timing boundary.
- Recent Verification capacity is estimated from measured full Verification wall time and explicit origin-count scaling, matching the existing repository rule that validation-origin count is a workload bound and does not alter the full training history.
