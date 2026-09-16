# PPF-1 Demo Readiness - Task 1 - Adaptive Short History V1

TASK_1_GATE = PASS

## Outcome

The adaptive short-history policy was implemented in the canonical Forecast Tooling and SG Runtime owners, both review-driven corrective fixes were applied, the required local regression slices passed in VS Code, and the missing real-series matrix plus long-history regression were independently completed through an authorized read-only Neon audit. Task 1 is now PASS.

## Implemented policy

- Policy version: `ADAPTIVE_SHORT_HISTORY_V1`
- Naive minimum: `1`
- Damped Holt minimum: `6`
- ETS minimum: `6`
- ETS seasonal minimum: `36`
- ARIMA minimum: `6`
- ARIMA candidate grid is sample-feasible and filtered by available sample size.
- Current Forecast and Recent Verification now share the same adaptive effective training-policy identity for period methods.
- Legacy frequency-specific current artifacts are no longer treated as exact matches for the adaptive policy.

## Corrective fixes

- Verification configuration identity is now target-specific.
- Period methods use a deterministic configuration identity containing `ADAPTIVE_SHORT_HISTORY_V1` and `maseScaleMinimumObservations = 2`.
- Rolling Daily / `POINT_IN_TIME` preserves the legacy-compatible verification configuration identity `{"minTrainingWindow":36}`.
- MASE scale is no longer fabricated for one-observation histories.
- Naive Current Forecast remains legal from one observation.
- Naive Verification origins now begin only once two observations exist, so MASE is computed lawfully.
- Empty Naive history now fails closed with controlled `ModelForecastError: INSUFFICIENT_HISTORY` instead of allowing raw `IndexError`.

## Independent live verification

This VS Code session did not execute the Neon queries directly. The live-data acceptance evidence below came from an authorized independent Codex audit executed on 2026-09-16 using read-only Neon access against the Dynamic Market Data Store production branch. Only observation counts, date boundaries, fingerprints, and variant outcomes are recorded here.

### Short-history matrix

- `SHORT_HISTORY_VARIANTS_TESTED = 36`
- `SHORT_HISTORY_VARIANTS_PASS = 36`
- `SHORT_HISTORY_VARIANTS_FAIL = 0`

`ehr2027g_cl`

- `MONTHLY_AVERAGE`: observations `6`, start `2026-03-01`, end `2026-08-01`, fingerprint `2570f7b46a2f44269851c7606cea6d04f27cb3774b42ec2102e0ea81fdd4d085`, variants `4/4 PASS`
- `END_OF_PERIOD`: observations `6`, start `2026-03-01`, end `2026-08-01`, fingerprint `4f9eb0e90848d32cad39ace57dfbb1c7ab836e0893bcc31d0c01fe1363c3eb0a`, variants `4/4 PASS`
- `POINT_IN_TIME`: observations `119`, start `2026-03-13`, end `2026-09-15`, fingerprint `6f9510f622c107c4eb7f99efd92ecce5acd430d65e7e00855b97a3c1f0e7eb92`, variants `4/4 PASS`

`lmescusd20270226`

- `MONTHLY_AVERAGE`: observations `9`, start `2025-12-01`, end `2026-08-01`, fingerprint `6fd4ea50feb69064a1195a61b3435ab99174ff870448e71a9df348633241a556`, variants `4/4 PASS`
- `END_OF_PERIOD`: observations `9`, start `2025-12-01`, end `2026-08-01`, fingerprint `30456344b47fe0a10f5e5878f4a19a6c42aba40536f83bf198ca6f3903a319de`, variants `4/4 PASS`
- `POINT_IN_TIME`: observations `199`, start `2025-12-01`, end `2026-09-15`, fingerprint `096647a7698f3ed9d58a97065a47738fa5465e1108a932d5195196ef8ddf1972`, variants `4/4 PASS`

`hg2027g_cl`

- `MONTHLY_AVERAGE`: observations `19`, start `2025-02-01`, end `2026-08-01`, fingerprint `1325789a7073e35850074335a69622c221f3c74199a84bd897bd3695b7ce74a9`, variants `4/4 PASS`
- `END_OF_PERIOD`: observations `19`, start `2025-02-01`, end `2026-08-01`, fingerprint `d812c24819f620e9ef43dedab0b675fdda3522abee50e3a0aa672098a75d79e8`, variants `4/4 PASS`
- `POINT_IN_TIME`: observations `390`, start `2025-02-27`, end `2026-09-15`, fingerprint `bb0565f4652bd1468fe824ffc8f97740065bc02428e46f0a6360114b0df63131`, variants `4/4 PASS`

### Long-history regression

- `LONG_HISTORY_VARIANTS_TESTED = 12`
- `LONG_HISTORY_VARIANTS_PASS = 12`
- `LONG_HISTORY_REGRESSION = PASS`

`lmeofcucashask`

- `MONTHLY_AVERAGE`: observations `466`, start `1987-11-01`, end `2026-08-01`, fingerprint `1b359371bcbe6d43d57a52b2ff6d62fcff960bb4f7f1401a40bc0365b81cd0d6`, variants `4/4 PASS`
- `END_OF_PERIOD`: observations `466`, start `1987-11-01`, end `2026-08-01`, fingerprint `1fd86bcab2d381ad0b56e1d86fe9e90b416f9f9b04ec63b99a1bdcde8c191fc0`, variants `4/4 PASS`
- `POINT_IN_TIME`: observations `9795`, start `1987-11-20`, end `2026-09-14`, fingerprint `ebf838de11abb5f150bd0321f40427672c862d80219a3146aa97578f6eb704c1`, variants `4/4 PASS`, path points per model `365`, anchors `1M`, `3M`, `6M`, `12M`

## Changed source

- Added SG Runtime period policy loader: `apps/sg-runtime/lib/forecast/period-forecast-policy.ts`
- Added Forecast Tooling policy loader: `tooling/Benchmark-Forecasting/forecasting/training_policy.py`
- Replaced hardcoded period minima in SG Runtime and Forecast Tooling with metadata-backed values.
- Versioned exact identity and verification configuration from the adaptive period policy.
- Lowered Damped Holt / ETS / ARIMA period minima from `36` to `6`.
- Preserved ETS seasonality as illegal below `36` observations.
- Filtered ARIMA candidates to a sample-feasible subset before fitting.
- Added and updated boundary and identity tests for `0/1/5/6/35/36` observation cases.

## Validation passed

1. `cd apps/sg-runtime && node --import tsx --test tests/forecast-identity.test.ts tests/forecast-capability-resolver.test.ts`
Exit code: `0`
Result: `40 PASS / 0 FAIL / 0 SKIP`

2. `cd apps/sg-runtime && node --import tsx --test tests/forecast-identity.test.ts tests/verification-single-flight.test.ts tests/forecast-execution-ledger.test.ts tests/persistence-ownership.test.ts`
Exit code: `0`
Result: `42 PASS / 0 FAIL / 0 SKIP`

3. `cd tooling/Benchmark-Forecasting && PYTHONPATH=. .venv/bin/python -m unittest tests.test_phase1 tests.test_phase2`
Exit code: `0`
Result: `47 PASS / 0 FAIL / 0 SKIP`

4. `cd tooling/Benchmark-Forecasting && PYTHONPATH=. .venv/bin/python -m unittest tests.test_phase2 tests.test_live_input tests.test_bounded_non_daily_verification tests.test_generic_cadence_orchestration`
Exit code: `0`
Result: `54 PASS / 0 FAIL / 0 SKIP`

5. `cd apps/sg-runtime && node --import tsx --test tests/forecast-live-input.test.ts tests/forecast-library-service.test.ts tests/forecast-route-contract.test.ts`
Exit code: `0`
Result: `109 PASS / 0 FAIL / 0 SKIP`

6. `cd apps/sg-runtime && node --import tsx --test tests/forecast-identity.test.ts tests/forecast-capability-resolver.test.ts tests/verification-single-flight.test.ts tests/forecast-live-input.test.ts tests/forecast-library-service.test.ts tests/forecast-route-contract.test.ts && npm run typecheck`
Exit code: `0`
Result: `158 PASS / 0 FAIL / 0 SKIP`

7. `cd tooling/Benchmark-Forecasting && PYTHONPATH=. .venv/bin/python -m unittest tests.test_phase1 tests.test_phase2 tests.test_live_input tests.test_bounded_non_daily_verification tests.test_generic_cadence_orchestration`
Exit code: `0`
Result: `67 PASS / 0 FAIL / 0 SKIP`

8. `cd apps/sg-runtime && npm run typecheck`
Exit code: `0`

## Local verification rerun

1. `cd apps/sg-runtime && node --import tsx --test tests/forecast-identity.test.ts tests/forecast-capability-resolver.test.ts tests/verification-single-flight.test.ts tests/forecast-live-input.test.ts tests/forecast-library-service.test.ts tests/forecast-route-contract.test.ts && npm run typecheck`
Exit code: `0`
Result: `158 PASS / 0 FAIL / 0 SKIP`

2. `cd tooling/Benchmark-Forecasting && PYTHONPATH=. .venv/bin/python -m unittest tests.test_phase1 tests.test_phase2 tests.test_live_input tests.test_bounded_non_daily_verification tests.test_generic_cadence_orchestration`
Exit code: `0`
Result: `67 PASS / 0 FAIL`

3. `git diff --check`
Exit code: `0`

4. Routing classification:
`tooling/Benchmark-Forecasting` -> `ALIGNED / Forecast Tooling`
`apps/sg-runtime` -> `ALIGNED / SG Runtime`

5. Targeted `seriesId` search over changed production code:
No selected demo series IDs were introduced into the changed generic production forecast logic.

## Safety

- No UI changes
- No bands changes
- No Historical Verification productization
- No production prewarming
- No production database writes
- No schema migration
- No Render deployment
- No service configuration changes
- No series-specific logic added in the changed production files
- No Stage 12 evidence modified

## Recommendation

PROCEED_TO_TASK_2 = NO

PROCEED_TO_TASK_2 = YES

Task 1 now authorizes planning of Task 2 only. It does not authorize Task 2 implementation, deployment, production preparation, or any Stage 12 completion claim.