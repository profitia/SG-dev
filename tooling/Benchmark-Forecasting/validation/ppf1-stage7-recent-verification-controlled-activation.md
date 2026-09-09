# PPF-1 Stage 7 Recent Verification Controlled Activation

Generated at: 2026-09-09T10:30:00.559Z
Branch: UNKNOWN
Git head: 2ded49e4870867b3afddd67e822556500722baea
Profile count: 32

## Final Gate

STAGE7_FINAL_EVIDENCE_GATE = PASS
FAST_READY_EXACT_CURRENT_AND_REQUIRED_EXACT_RECENT_RENDERABLE = YES
GLOBAL_N_FAST_EQUALS_1 = YES
REAL_PROGRESSIVE_ORCHESTRATION_PATH_EXERCISED = YES
FULL_VERIFICATION_EXCLUDED_FROM_FAST_READY = YES
WARM_REUSE_PRESERVED = YES
CROSS_CONTEXT_REUSE_PRESERVED = YES
RECENT_CONCURRENCY_SINGLE_OWNER_GATE = PASS

## Concurrency

Profile: ppf1-stage6-daily-profile-v1|END_OF_PERIOD|arima
Requests: 5
Recent owners: 1
Recent waiters: 0
Recent verification computes: 1
Non-recent verification computes: 0
Reasons: NONE

## Watchlists

| Profile | Cold ready ms | Warm ms | Cross-context ms | Current computes | Recent computes | Non-recent verification computes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|ets | 9111.219 | 3068.326 | 2847.277 | 1 | 1 | 0 |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|arima | 12213.086 | 4341.179 | 2759.311 | 1 | 1 | 0 |
| ppf1-stage6-quarterly-profile-v1|END_OF_PERIOD|arima | 17030.65 | 4349.172 | 2839.674 | 1 | 1 | 0 |

## Profiles

| Profile | Cold ready ms | Snapshot ready ms | Warm ms | Cross-context ms | Current status | Verification status | Current computes | Recent computes | Non-recent verification computes | Gate |
| --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|naive | 11145.49 | 14123.469 | 2765.736 | 2675.489 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|damped_holt | 10898.791 | 15208.518 | 2883.986 | 4055.723 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|ets | 9595.592 | 12804.192 | 2565.508 | 2705.423 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|MONTHLY_AVERAGE|arima | 11093.423 | 13889.978 | 2656.152 | 2634.798 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|naive | 9555.313 | 12398.458 | 2797.273 | 3053.709 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|damped_holt | 12249.774 | 15322.364 | 2689.326 | 2744.758 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|ets | 9111.219 | 11925.736 | 3068.326 | 2847.277 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|END_OF_PERIOD|arima | 12213.086 | 15527.138 | 4341.179 | 2759.311 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|naive | 2015.664 | 2015.659 | 75.119 | 71.828 | HIT | NOT_REQUIRED | 0 | 0 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|damped_holt | 1762.106 | 1762.102 | 75.476 | 76.739 | HIT | NOT_REQUIRED | 0 | 0 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|ets | 1971.681 | 1971.678 | 81.147 | 78.301 | HIT | NOT_REQUIRED | 0 | 0 | 0 | PASS |
| ppf1-stage6-daily-profile-v1|ROLLING_DAILY_POINT_IN_TIME|arima | 3201.472 | 3201.468 | 68.258 | 66.351 | HIT | NOT_REQUIRED | 0 | 0 | 0 | PASS |
| ppf1-stage6-weekly-profile-v1|END_OF_PERIOD|naive | 8794.2 | 11333.677 | 2699.714 | 2734.582 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-weekly-profile-v1|END_OF_PERIOD|damped_holt | 9409.055 | 12137.546 | 3212.125 | 2823.222 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-weekly-profile-v1|END_OF_PERIOD|ets | 9965.329 | 12826.517 | 3514.058 | 2967.354 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-weekly-profile-v1|END_OF_PERIOD|arima | 12764.185 | 17190.859 | 10326.513 | 8057.129 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-monthly-profile-v1|END_OF_PERIOD|naive | 17036.54 | 21104.723 | 3025.045 | 2957.724 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-monthly-profile-v1|END_OF_PERIOD|damped_holt | 10298.905 | 13445.578 | 2979.966 | 2886.444 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-monthly-profile-v1|END_OF_PERIOD|ets | 10317.34 | 13460.388 | 3981.372 | 2833.122 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-monthly-profile-v1|END_OF_PERIOD|arima | 16787.286 | 20385.644 | 2941.557 | 2578.218 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-monthly-profile-v1|MONTHLY_AVERAGE|naive | 9314.157 | 12703.766 | 2971.089 | 2982.244 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-monthly-profile-v1|MONTHLY_AVERAGE|damped_holt | 10970.012 | 14045.44 | 3121.051 | 3580.226 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-monthly-profile-v1|MONTHLY_AVERAGE|ets | 10650.485 | 13625.526 | 4612.289 | 2716.555 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-monthly-profile-v1|MONTHLY_AVERAGE|arima | 13657.724 | 16332.528 | 3801.238 | 3169.56 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-quarterly-profile-v1|END_OF_PERIOD|naive | 10272.074 | 13438.183 | 3529.826 | 2900.098 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-quarterly-profile-v1|END_OF_PERIOD|damped_holt | 11668.769 | 15719.017 | 3524.909 | 2518.182 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-quarterly-profile-v1|END_OF_PERIOD|ets | 9331.584 | 12397.174 | 2668.715 | 3174.619 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-quarterly-profile-v1|END_OF_PERIOD|arima | 17030.65 | 19781.163 | 4349.172 | 2839.674 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-semiannual-profile-v1|END_OF_PERIOD|naive | 9202.689 | 11859.238 | 2918.129 | 2842.777 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-semiannual-profile-v1|END_OF_PERIOD|damped_holt | 10444.546 | 13244.151 | 2715.395 | 3022.164 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-semiannual-profile-v1|END_OF_PERIOD|ets | 10453.022 | 13736.379 | 2810.078 | 3172.039 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |
| ppf1-stage6-semiannual-profile-v1|END_OF_PERIOD|arima | 13978.258 | 16868.504 | 2953.656 | 2924.411 | AVAILABLE | AVAILABLE | 1 | 1 | 0 | PASS |

