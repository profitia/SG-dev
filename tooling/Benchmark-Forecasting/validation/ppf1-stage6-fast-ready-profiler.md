# PPF-1 Stage 6 FAST_READY Profiler

Generated at: 2026-09-08T07:36:11.450Z
Branch: ppf1/stage6-fast-ready-profiler-gate-20260907
Git HEAD: 5474cf1f535361826bc9d12cc7616c723ebe781e
Expected source SHA: 5474cf1f535361826bc9d12cc7616c723ebe781e
Cold samples per profile: 1
Warm prepared-hit samples per profile: 1
Recent Verification candidates: 1
FAST_READY budget: 15000 ms

## Final Gate

FAST_READY profiler gate: FAIL
Performance corrective required: true
Profiles passing: 28
Profiles failing: 4
Stage 4 non-regression: PASS
Stage 5 non-regression: PASS

## Global Decision

Recommendation: INLINE_WITH_GLOBAL_N_FAST
Global N_FAST: 1
Profile-specific controls required: false

## Profiles

| Profile | Gate | Cold conservative ms | Warm hit p95/max ms | Dominant bottleneck | Max inline recent N |
| --- | --- | ---: | ---: | --- | ---: |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|naive | PASS | 3158.151 | 56.158 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|damped_holt | PASS | 2586.102 | 54.579 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|ets | PASS | 2988.977 | 53.671 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|arima | PASS | 3857.018 | 55.593 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|naive | PASS | 2553.799 | 54.576 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|damped_holt | PASS | 2655.451 | 64.996 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|ets | PASS | 4092.334 | 79.525 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|arima | PASS | 4935.547 | 58.881 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|naive | FAIL | 117.803 | 75.151 | DATABASE_ADMISSION | N/A |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|damped_holt | FAIL | 1715.535 | 83.03 | OTHER | N/A |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|ets | FAIL | 1397.841 | 69.597 | OTHER | N/A |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|arima | FAIL | 2662.201 | 69.138 | OTHER | N/A |
| ppf1-stage6-weekly-profile-v1|END_OF_PERIOD|naive | PASS | 2456.606 | 1227.577 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-weekly-profile-v1|END_OF_PERIOD|damped_holt | PASS | 2478.887 | 1207.302 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-weekly-profile-v1|END_OF_PERIOD|ets | PASS | 2692.898 | 1232.964 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-weekly-profile-v1|END_OF_PERIOD|arima | PASS | 3607.3 | 1285.257 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-monthly-profile-v1|END_OF_PERIOD|naive | PASS | 3805.435 | 1297.932 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-monthly-profile-v1|END_OF_PERIOD|damped_holt | PASS | 3316.912 | 1352.672 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-monthly-profile-v1|END_OF_PERIOD|ets | PASS | 2864.125 | 1263.364 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-monthly-profile-v1|END_OF_PERIOD|arima | PASS | 6554.892 | 1484.849 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-monthly-profile-v1|MONTHLY_AVERAGE|naive | PASS | 2818.199 | 1326.781 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-monthly-profile-v1|MONTHLY_AVERAGE|damped_holt | PASS | 2499.682 | 1212.809 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-monthly-profile-v1|MONTHLY_AVERAGE|ets | PASS | 2834.006 | 1257.157 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-monthly-profile-v1|MONTHLY_AVERAGE|arima | PASS | 4609.7 | 1333.846 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-quarterly-profile-v1|END_OF_PERIOD|naive | PASS | 2477.647 | 9.718 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-quarterly-profile-v1|END_OF_PERIOD|damped_holt | PASS | 2750.392 | 9.101 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-quarterly-profile-v1|END_OF_PERIOD|ets | PASS | 2486.368 | 9.602 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-quarterly-profile-v1|END_OF_PERIOD|arima | PASS | 3964.079 | 8.556 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-semiannual-profile-v1|END_OF_PERIOD|naive | PASS | 2508.617 | 8.58 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-semiannual-profile-v1|END_OF_PERIOD|damped_holt | PASS | 3130.151 | 9.727 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-semiannual-profile-v1|END_OF_PERIOD|ets | PASS | 2445.923 | 8.223 | PYTHON_PROCESS_STARTUP | 1 |
| ppf1-stage6-semiannual-profile-v1|END_OF_PERIOD|arima | PASS | 3261.957 | 8.862 | PYTHON_PROCESS_STARTUP | 1 |

## Notes

- Period Current uses exact SG Runtime Current preparation plus exact prepared-read confirmation.
- Rolling Daily phase gaps remain explicitly marked as NOT_SEPARATELY_MEASURABLE where the runtime does not expose an isolated lawful timing boundary.
- Recent Verification capacity is measured directly from repeated same-policy prepared Current executions over the latest matured historical origins, rather than estimated from Full Verification scaling.
