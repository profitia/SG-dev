# PPF-1 Stage 12 - Final Three-Benchmark Sequential Acceptance Cohort

## Outcome

Status: FAIL CLOSED AT BRENT

The final live three-benchmark acceptance cohort was executed on the same deployed Dashboard source that previously proved the Copper corrective. The official sequential order was Brent, then Copper, then Aluminium.

The cohort stopped at Brent as required by the fail-closed rule. Brent returned `HTTP 200`, but the certification result itself failed because all point-in-time variants were stale and not fully prepared. No further benchmarks were executed after that failure.

## Authority And Constraints

- `REMOTE_BRANCH_HEAD = 4e6cc5c5f7339a89ce5df460c3a1c9412aff99ae`
- `DASHBOARD_SOURCE_COMMIT_SHA = 79a8a7f6d5b2e6ecf5095a17006b80f288e4e604`
- `DASHBOARD_DEPLOY_ID = dep-dal4b5mk1f9s73dlidb0`
- `DASHBOARD_DEPLOYED_SHA = 79a8a7f6d5b2e6ecf5095a17006b80f288e4e604`
- `BENCHMARK_FINDER_DEPLOYED_SHA = 3acfa25706f6d293e0a04ac4e7f7cabfb60bea85`
- `SPENDGURU_STAGE_DEPLOYED_SHA = 3acfa25706f6d293e0a04ac4e7f7cabfb60bea85`
- `ACCEPTANCE_ONLY_TASK = YES`
- `CODE_CHANGES_ALLOWED = NO`
- `REDEPLOY_ALLOWED = NO`
- `CONFIGURATION_CHANGES_ALLOWED = NO`

Repository parity and deploy parity were independently reconfirmed before execution. The Dashboard endpoint also returned the same `sourceRevision` and `deployedRevision` both before the cohort and after the Brent failure.

## Preflight

Repository state before the cohort:

- local HEAD matched remote HEAD at `4e6cc5c5f7339a89ce5df460c3a1c9412aff99ae`
- worktree was clean

Dashboard deploy state before the cohort:

- Render deploy `dep-dal4b5mk1f9s73dlidb0` remained `LIVE`
- `sourceRevision = 79a8a7f6d5b2e6ecf5095a17006b80f288e4e604`
- `deployedRevision = 79a8a7f6d5b2e6ecf5095a17006b80f288e4e604`

An extra live Copper probe was run only to reconfirm deployed SHA parity:

- `seriesId = lmeofcucashask`
- `HTTP_STATUS = 200`
- `TIME_TOTAL = 58.492787s`
- `countedTowardOfficialCohort = NO`

## Official Cohort Execution

Required order:

1. Brent - `wocaes0074`
2. Copper - `lmeofcucashask`
3. Aluminium - `lmeofalcashask`

Only Brent was executed in the official cohort because the first run failed acceptance.

### Brent

Request:

```json
{"mode":"REVALIDATE","seriesIds":["wocaes0074"],"includeFallback":false,"diagnostics":{"enabled":true}}
```

HTTP result:

- `HTTP_STATUS = 200`
- `TIME_TOTAL = 55.552319s`
- `RNDR_ID = 11fc4252-1cbf-4504`
- `CF_RAY = a3be64b31ed288e8-WAW`

Execution identity:

- `benchmarkName = Brent`
- `executionId = demo-certification-4e9f7c52-8790-44b4-b538-cd9395bc7fbf`
- `acceptedAt = 2026-09-16T08:10:12.420Z`
- `lastVerifiedAt = 2026-09-16T08:11:07.828Z`
- `releaseSnapshot.sourceRevision = 79a8a7f6d5b2e6ecf5095a17006b80f288e4e604`
- `releaseSnapshot.deployedRevision = 79a8a7f6d5b2e6ecf5095a17006b80f288e4e604`

Certification result:

- `demoSafe = NO`
- `reason = PRECOMPUTE_FAIL`
- `precompute.status = FAIL`
- `reread.status = FAIL`
- `matrix.status = FAIL`
- `freshness.status = PASS`
- `warmRehearsal.status = FAIL`

Phase timings:

- `PRECOMPUTE = 30329ms`
- `MATRIX = 3ms`
- `WARM_REHEARSAL = 2136ms`

Failure substance:

- All four Brent point-in-time variants failed precompute: `naive`, `damped_holt`, `ets`, `arima`
- For each failing point-in-time variant: `currentReadiness = STALE`, `verificationReadiness = STALE`, `fullVerificationReadiness = NOT_PREPARED`
- The shared precompute failure reason was: `Warm revalidation requires both current readiness and exact historical verification readiness to remain READY.`
- Matrix summary: `current pass = 8`, `current fail = 4`, `verification pass = 32`, `verification fail = 16`
- Matrix failing reasons reduced to two categories: `PREPARED_STATE_NOT_READY` and `VERIFICATION_NOT_READY`
- Warm rehearsal also failed on the same point-in-time readiness surface rather than on timeout or cancellation behavior

## Control-Plane Safety Evidence

The Dashboard corrective remained intact during the failed Brent run.

Bounded-prefetch telemetry:

- `non-point-in-time prepared-read misses = 16`
- `peak prepared-read concurrency = 8`
- `elapsed window = 22937ms`
- `matrix prepared-read misses after warm-up = 0`

Remote-request telemetry:

- `logical remote requests = 73`
- `physical remote requests = 32`
- `overall peak concurrent remote reads = 12`
- `READ_CAPABILITY = 28`
- `READ_CURRENT = 29`
- `READ_VERIFICATION = 16`
- `cache hits = 41`
- `cache misses = 32`
- `PIT capability cache hits = 8`

Completion and compute safety:

- `timeoutSnapshot = null`
- `abortCount = 0`
- `activeRequestsAtCompletion = 0`
- `postResponseSgRuntimeRequests = 0`
- `prepareRouteCount = 0`
- `productionForecastComputeStarted = NO`
- `secondForecastEngineCreated = NO`
- `duplicateComputeRegression = NO`
- `canonicalSingleFlightPreserved = YES`
- `uncontrolledPrecomputeFanout = NO`

This means the published Dashboard corrective did not regress during the cohort attempt. The failure was on live benchmark readiness, not on the previously corrected timeout and cancellation behavior.

## Correlation Level

Dashboard diagnostics proved that tracked upstream requests completed before the Dashboard response ended and that no post-response requests remained active.

The in-session Render log UI for `spendguru-stage` remained insufficient for a one-to-one join on either `executionId = demo-certification-4e9f7c52-8790-44b4-b538-cd9395bc7fbf` or `RNDR_ID = 11fc4252-1cbf-4504`. Correlation is therefore service-level partial rather than request-level exact.

The unchanged upstream deployment identity remained:

1. `benchmark-finder-category-builder` - `3acfa25706f6d293e0a04ac4e7f7cabfb60bea85`
2. `spendguru-stage` - `3acfa25706f6d293e0a04ac4e7f7cabfb60bea85`

## Post-Failure Parity

One additional Brent parity check after the failed official run still returned:

- `HTTP_STATUS = 200`
- `TIME_TOTAL = 42.579176s`
- `sourceRevision = 79a8a7f6d5b2e6ecf5095a17006b80f288e4e604`
- `deployedRevision = 79a8a7f6d5b2e6ecf5095a17006b80f288e4e604`

That confirms deploy drift did not occur during the cohort window.

## Verdict

- `FULL_3_BENCHMARK_COHORT = FAIL`
- `FAILURE_BOUNDARY = BRENT_FIRST_RUN`
- `DASHBOARD_CORRECTIVE_REGRESSION = NO`
- `DASHBOARD_DEPLOY_PARITY_MAINTAINED = YES`
- `STANDALONE_COPPER_PROOF_PRESERVED = YES`
- `COPPER_OFFICIAL_COHORT_RUN = NOT_EXECUTED`
- `ALUMINIUM_OFFICIAL_COHORT_RUN = NOT_EXECUTED`
- `NEXT_OWNER = SG Runtime / benchmark data readiness authority`
- `NEXT_DECISION = Decide whether Brent point-in-time current and exact historical verification readiness must be re-prepared upstream or formally excluded from this cohort gate.`
- `PMOS_SAVE = NOT_RUN_PENDING_ARTIFACT_ABSENT`
- `FINAL_TASK_STATUS = INCOMPLETE - COHORT FAILED AND PMOS CLOSEOUT BLOCKED`