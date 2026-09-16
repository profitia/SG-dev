# PPF-1 Stage 12 - Copper Live Certification 75s Timeout Root-Cause Audit

## Authority

`TASK_ID = ppf-1-stage-12-copper-live-certification-timeout-root-cause-audit-20260916`

`PARENT_TASK_ID = ppf-1-stage-12-copper-dashboard-certification-corrective-20260916`

`REMOTE_BASE_SHA = 25f25c1d143160cf04d0e4d42d3255ac2374a441`

`REMOTE_HEAD_VERIFY = PASS`

`DASHBOARD_DEPLOYED_SHA = 25f25c1d143160cf04d0e4d42d3255ac2374a441`

`SG_RUNTIME_DEPLOYED_SHA = 3acfa25706f6d293e0a04ac4e7f7cabfb60bea85`

`DASHBOARD_SOURCE_DEPLOY_PARITY = PASS`

Live route audited:

`https://dashboards-library.onrender.com/api/benchmark-forecast/demo-certification`

Configured Dashboard SG Runtime target:

`DASHBOARD_PRIMARY_SG_RUNTIME_TARGET = https://sg2-0-charts-preview.onrender.com`

Observed fallback inventory in source:

`FALLBACK_TARGET_AVAILABLE = YES`

Observed fallback target list includes:

`https://benchmark-finder-category-builder.onrender.com`

Important source facts:

1. `DEFAULT_BENCHMARK_TIMEOUT_MS = 75000`
2. `INTERNAL_FORECAST_TIMEOUT_MS = 20000`
3. deployed environments default `maxConcurrentMatrixVariants = 1`
4. explicit `SG_RUNTIME_BASE_URL` disables timeout fallback for prepared reads

## Preserved Inputs

`FAILED_LIVE_EVIDENCE_PRESERVED = YES`

Preserved prior failed-live evidence artifacts:

1. `tooling/Benchmark-Forecasting/validation/ppf1-stage12-copper-dashboard-certification-corrective.md`
2. `tooling/Benchmark-Forecasting/validation/ppf1-stage12-copper-dashboard-certification-corrective.json`

Preserved one clean diagnostic repro payloads used by this audit:

1. `/tmp/stage12-timeout-audit.json`
2. `/tmp/stage12-timeout-audit-headers.txt`
3. `/tmp/stage12-spendguru-stage-logs.json`
4. `/tmp/stage12-dashboard-request-log.json`

## Live Reproduction

Input:

```json
{
  "mode": "REVALIDATE",
  "seriesIds": ["lmeofcucashask"],
  "includeFallback": false,
  "diagnostics": {
    "enabled": true
  }
}
```

Observed result:

`LIVE_REVALIDATE_HTTP = 200`

`BENCHMARK_EXECUTION_ID = demo-certification-ed5a3143-895c-4e75-a2ee-6dfdaaf392e4`

`BENCHMARK_TIMEOUT_MS = 75000`

`TIMEOUT_PHASE = MATRIX`

`TIMEOUT_ACTIVE_REQUEST_COUNT = 0`

`TOTAL_REMOTE_REQUESTS = 30`

`PEAK_CONCURRENT_REMOTE_READS = 12`

`MAX_CONCURRENT_MATRIX_VARIANTS = 1`

`summary.demoSafe = 0`

`reason = ENVIRONMENT_NOT_READY`

`error = Demo certification benchmark timed out after 75000ms.`

`CURRENT_PASS = 0 / 12`

`VERIFICATION_PASS = 0 / 48`

Why `TIMEOUT_PHASE = MATRIX`:

1. `PRECOMPUTE` completed successfully.
2. Matrix diagnostics show `phaseStartedAt = 2026-09-16T06:16:20.534Z` and `phaseCompletedAt = null`.
3. Matrix entered point-in-time evaluation and stopped mid-phase.
4. Warm rehearsal never started.

## Timing

`PRECOMPUTE_ELAPSED_MS = 21219`

`MATRIX_ELAPSED_MS = 6686`

`WARM_REHEARSAL_ELAPSED_MS = 0`

`UNPHASED_REREAD_ELAPSED_MS = 47159`

`TOTAL_QUEUE_WAIT_MS = 0`

`TOTAL_REMOTE_ELAPSED_MS = 276692`

`MAX_SINGLE_REMOTE_REQUEST_MS = 21212`

`TIME_ACCOUNTING_COVERS_75S_BUDGET = YES`

Budget reconstruction:

1. `PRECOMPUTE` consumed `21219ms`.
2. The non-matrix reread window between `PRECOMPUTE` completion and `MATRIX` start consumed `47159ms`.
3. Partial `MATRIX` execution consumed `6686ms` before timeout snapshot.
4. Total accounted wall time: `75064ms`, which matches the 75s benchmark envelope.

## Diagnostics

### Phase accounting

Observed named phase event:

```json
{
  "phase": "PRECOMPUTE",
  "startedAt": "2026-09-16T06:15:12.156Z",
  "completedAt": "2026-09-16T06:15:33.375Z",
  "elapsedMs": 21219,
  "outcome": "SUCCESS"
}
```

Observed matrix state at timeout:

1. `phaseStartedAt = 2026-09-16T06:16:20.534Z`
2. `nonPointInTimeCompletedAt = 2026-09-16T06:16:20.618Z`
3. `pointInTimeEvaluationStartedAt = 2026-09-16T06:16:20.618Z`
4. `pointInTimeEvaluationCompletedAt = null`
5. `variantsCompletedBeforeTimeout = 10`
6. `timeoutSnapshot.capturedAt = 2026-09-16T06:16:27.220Z`

### Remote operation accounting

Miss-path diagnostic events:

1. `READ_CAPABILITY = 12`
2. `READ_CURRENT = 8`
3. `READ_VERIFICATION = 10`

Miss-path by phase:

1. `PRECOMPUTE = 28`
2. `MATRIX = 2`

Operation totals:

1. `READ_CAPABILITY`: `count = 12`, `completed = 12`, `timedOut = 0`, `error = 0`, `queueWaitMs = 0`, `remoteElapsedMs = 186702`, `maxRemoteElapsedMs = 21212`
2. `READ_CURRENT`: `count = 8`, `completed = 8`, `timedOut = 0`, `error = 0`, `queueWaitMs = 0`, `remoteElapsedMs = 41664`, `maxRemoteElapsedMs = 6019`
3. `READ_VERIFICATION`: `count = 10`, `completed = 10`, `timedOut = 0`, `error = 0`, `queueWaitMs = 0`, `remoteElapsedMs = 48326 + 1171`, `maxRemoteElapsedMs = 6284`

Important nuance:

1. The last 2 `READ_VERIFICATION` miss-path events happened inside `MATRIX` for `POINT_IN_TIME` and completed in `568ms` and `603ms`.
2. Those two events are certification operations, but they are not outbound SG Runtime fetches.
3. All outbound network cost was already effectively spent before matrix point-in-time evaluation began.

### Timeout snapshot

```json
{
  "capturedAt": "2026-09-16T06:16:27.220Z",
  "activeRequests": []
}
```

Implications:

1. No request was still in-flight when the 75s timeout fired.
2. This was not a single hung request caught at timeout.
3. The budget was already spent by earlier successful work.

### Matrix variant accounting

`MATRIX_SERIALIZATION_OBSERVED = YES`

`MATRIX_SERIALIZATION_IS_ROOT_CAUSE = NO`

Evidence:

1. `peakVariantConcurrency = 1`
2. Non-point-in-time variants all completed by `2026-09-16T06:16:20.618Z`.
3. Matrix started with only about `6686ms` of benchmark budget remaining.
4. Only 2 point-in-time verification variants completed before timeout.
5. Matrix itself did not consume the first 68s of the benchmark.

Slowest observed matrix variants:

1. `naive / POINT_IN_TIME = 3414ms`
2. `damped_holt / POINT_IN_TIME = 2290ms`
3. `ets / POINT_IN_TIME` started, persisted-current proof completed in `6ms`, but the variant did not complete before timeout.

## Render Correlation

### Dashboard logs

`DASHBOARD_REQUESTS_CORRELATED = YES`

Observed inbound request log:

```text
2026-09-16T06:16:27.266284638Z
POST /api/benchmark-forecast/demo-certification
responseTimeMS=75211
status=200
requestID=c2abd017-a52d-482c
```

This matches the clean live repro.

### SG Runtime logs

`SG_RUNTIME_REQUESTS_CORRELATED = YES`

Configured target service:

1. service: `spendguru-stage`
2. service ID: `srv-d98a73btqb8s73fabp90`
3. URL: `https://sg2-0-charts-preview.onrender.com`
4. live SHA: `3acfa25706f6d293e0a04ac4e7f7cabfb60bea85`

Observed backend request classes during the exact repro window:

1. `READ_CAPABILITY = 14` request-log entries
2. `READ_CURRENT = 8` request-log entries
3. `READ_VERIFICATION = 8` request-log entries

The extra 2 capability entries are the point-in-time matrix rereads for `naive` and `damped_holt` after matrix began.

Representative backend log evidence:

```text
2026-09-16T06:15:33.371399146Z
GET /api/internal/forecast/capability?seriesId=lmeofcucashask&modelId=naive&targetSemantics=END_OF_PERIOD
responseTimeMS=21104
```

```text
2026-09-16T06:15:32.829994213Z
GET /api/internal/forecast/capability?seriesId=lmeofcucashask&modelId=arima&targetSemantics=MONTHLY_AVERAGE
responseTimeMS=20554
```

```text
2026-09-16T06:15:39.396837404Z
GET /api/internal/forecast/prepared/verification?seriesId=lmeofcucashask&model=naive&targetBasis=MONTHLY_AVERAGE&sourceFrequency=DAILY&targetCadence=MONTHLY
responseTimeMS=5976
```

```text
2026-09-16T06:16:20.463627332Z
GET /api/internal/forecast/prepared/verification?seriesId=lmeofcucashask&model=arima&targetBasis=END_OF_PERIOD&sourceFrequency=DAILY&targetCadence=MONTHLY
responseTimeMS=5415
```

Correlation conclusions:

1. The deployed Dashboard did send live internal requests to `spendguru-stage`.
2. Backend response times match the in-band diagnostic timings.
3. There is no evidence of Dashboard aborting an active remote request at the timeout instant.
4. There is no evidence of an uncaught backend error preceding the timeout.

## Runtime Query Audit

`LOCAL_RUNTIME_QUERY_DIFF_EXISTS = NO`

`LOCAL_RUNTIME_QUERY_DIFF_CAUSAL = NO`

Evidence:

1. The exact local `runtime-query.ts` that participated in the successful local `48/48` Copper run matches the published `runtime-query.ts` byte-for-byte.
2. The earlier debugging-only `runtime-query.ts` edit was not present in the successful published source surface.

`FULL_VERIFICATION_RECEIVES_GENERIC_PREPARED_AUTHORITY = NO`

Evidence from published source:

1. `getBenchmarkForecastCurrent(...)` forwards `buildPreparedReadAuthorityHeaders(capability)` only for prepared current reads.
2. `getBenchmarkForecastVerification(...)` forwards correlation headers only.
3. Full verification requests do not receive `x-sg-prepared-history-fingerprint` or the other generic prepared-read authority headers.

`REMOTE_ATTEMPTS_PER_LOGICAL_READ = 1`

Why:

1. `SG_RUNTIME_BASE_URL` is explicitly configured in the deployed Dashboard.
2. With an explicit base URL, timeout fallback is disabled for prepared reads.
3. Backend log counts match one outbound request per non-point-in-time current/verification logical read.
4. No retry multiplication was observed in the clean repro.

## Live Dependencies

### Dashboard environment/config presence

`SECRETS_EXPOSED = NO`

Visible deployed env keys:

1. `DATABASE_URL = PRESENT`
2. `MARKET_DATA_DATABASE_URL = PRESENT`
3. `SG_RUNTIME_BASE_URL = PRESENT`
4. `SG_RUNTIME_INTERNAL_FORECAST_SERVICE_TOKEN = PRESENT`

Visible linked environment groups:

`NONE`

Observed certification-specific overrides:

1. no visible timeout override key
2. no visible certification concurrency override key

### Database latency

`MARKET_DATA_DB_LATENCY_NORMAL = NOT_PROVEN`

Evidence and limit:

1. Point-in-time persisted proof work observed inside matrix was small: `5ms`, `6ms`, `47ms`, `114ms`, `637ms`.
2. The timeout was already mostly spent before matrix point-in-time proof evaluation began.
3. The exact deployed generic `forecastVerificationRun.findFirst(...)` fingerprint-specific lookup was not directly measurable without secret DB access or source instrumentation.

## Compute Safety

`FORECAST_COMPUTE_STARTED = 0`

`CURRENT_COMPUTE_STARTED = 0`

`RECENT_VERIFICATION_COMPUTE_STARTED = 0`

`FULL_HISTORICAL_COMPUTE_STARTED = 0`

Evidence:

1. Diagnostics and backend logs show only `READ_CAPABILITY`, `READ_CURRENT`, and `READ_VERIFICATION` operations.
2. No `PREPARE_CURRENT`, `PREPARE_VERIFICATION`, or production compute route activity was observed.
3. This timeout occurred on a read-only certification path.

## Local vs Live Delta

| Surface | Local pass surface | Live deployed surface | Effect |
| --- | --- | --- | --- |
| Dashboard source SHA | corrective local worktree | `25f25c1d143160cf04d0e4d42d3255ac2374a441` | same certification source |
| runtime-query content | same as published | same as local | not causal |
| SG Runtime route target | local `http://localhost:3001` authenticated loopback | `https://sg2-0-charts-preview.onrender.com` | material network/runtime delta |
| SG Runtime code SHA | accepted local authority | `3acfa25706f6d293e0a04ac4e7f7cabfb60bea85` | same revision |
| Dashboard internal auth | present | present | not blocker |
| Dashboard market-data DB presence | present | present | not blocker |
| Matrix concurrency default | no deployed single-variant default | `1` on Render | observed secondary contributor |
| Benchmark timeout | `75000ms` | `75000ms` | same contract |
| Primary capability latency | local pass completed within budget | live capability calls reach `18.8s - 21.2s` | material latency delta |
| Pre-matrix reread wall | local pass stayed within budget | live reread wall = `47159ms` | material budget delta |

`LOCAL_PASS_LIVE_FAIL = YES`

## Root Cause

`PRIMARY_ROOT_CAUSE = CUMULATIVE_BUDGET_EXHAUSTION`

`SECONDARY_CONTRIBUTORS = ["SG_RUNTIME_PRIMARY_TARGET_LATENCY", "MATRIX_SERIALIZATION_OBSERVED"]`

`ROOT_CAUSE_PROVEN = YES`

Why this classification wins:

1. The timeout snapshot shows `0` active requests at timeout, so a single hung request is not the cause.
2. `PRECOMPUTE` finished successfully in `21219ms`.
3. The next `47159ms` was spent on successful non-point-in-time rereads against the configured SG Runtime target.
4. Matrix began with only about `6.7s` remaining.
5. Matrix serialization is real, but it is not what burned the first `68.4s`.
6. The live-only delta is explained by the latency characteristics of the configured remote SG Runtime path plus the certification flow's cumulative serial reread budget.

More specific causal statement:

The deployed Dashboard points to `spendguru-stage`, where monthly and end-of-period capability calls for Copper take roughly `19s - 21s` each and prepared current/verification reads take about `5s - 6s` each. The certification benchmark completes those operations successfully, but their cumulative wall time consumes nearly the entire 75-second budget before point-in-time matrix evaluation can finish.

## Recommended Next Corrective

`RECOMMENDED_CORRECTIVE_OWNER = DASHBOARD_PREVIEW`

`RECOMMENDED_CORRECTIVE = Remove the live serial non-point-in-time reread window from the certification benchmark by reusing the already obtained non-point-in-time prepared current and verification results for matrix admission instead of issuing 16 additional live rereads before MATRIX begins.`

Why this is the narrowest evidenced next move:

1. It directly targets the `47159ms` wall-time block that consumed the budget after `PRECOMPUTE`.
2. It does not require increasing timeouts.
3. It does not require increasing concurrency.
4. It does not require SG Runtime source changes.
5. It does not assume that merely repointing the environment would solve the latency delta.

Alternative hypothesis explicitly not selected:

`ENV_CONFIGURATION_DEFECT = NOT_PROVEN`

Reason:

The configured target differs from the public SG Runtime service previously inspected, but the configured target is live on the accepted `3acfa257...` SHA and there is not yet comparative evidence proving that a different target alone would remove the timeout.

## Publication

`SOURCE_CHANGE_REQUIRED = NO`

`PUBLICATION_COMMIT_SHA = 611e80c602cb50554342d42a288ca8edbccd0aa8`

`REMOTE_EVIDENCE_VERIFY = PASS`

This diagnostic task publishes repository evidence only.

No business-code files were changed.

## PMOS

`PMOS_SAVE = NOT_RUN_PENDING_ARTIFACT_ABSENT`

`PMOS_CLOSEOUT = REPOSITORY_EVIDENCE_ONLY`

Reason:

The authoritative PMOS pending artifact is absent, and this task does not synthesize governance artifacts.

## Stage Status

`COPPER_DASHBOARD_CERTIFICATION_CORRECTIVE = NOT_YET_LIVE_PROVEN`

`READY_FOR_FINAL_THREE_BENCHMARK_COHORT = NO`

`DURABLE_EXECUTION_LEDGER_STILL_PENDING = YES`

`PRE_DEPRECATION_ACCEPTANCE = BLOCKED`

`LEGACY_DEPRECATION_ALLOWED = NO`