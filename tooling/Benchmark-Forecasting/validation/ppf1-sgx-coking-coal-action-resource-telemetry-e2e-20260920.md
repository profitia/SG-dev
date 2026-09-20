# PPF-1 — action/resource telemetry and SGX Coking Coal E2E

## Decision

The telemetry corrective is live and proven across the browser, Dashboard, SG Runtime, the durable preparation worker, Neon persistence, and Render observability. A single correlation ID now reconstructs the user action from request through queue admission, prepared-read readiness, first Dashboard observation, and the first confirmed UI render. Worker resource summaries provide job-attributable Node measurements and exact child-Python process measurements; Render CPU/RAM remains explicitly service-level context.

The final source authority is `f9674c955860f79816ff5fb3076bda5090c053e2`. The three required services are live on that exact commit.

## Scope delivered

1. Added the versioned `forecast-action-trace-v1` event contract and the `forecast_action_trace` persistence model.
2. Persisted `artifactReadyAt` only when the corresponding prepared-read becomes `READY`.
3. Recorded the first readiness observation performed by Dashboard.
4. Added a frontend acknowledgement after the relevant React commit and two animation frames.
5. Added a bounded Node worker-window measurement and exact `RUSAGE_CHILDREN` measurement for Python invocations.
6. Linked the resource summary to the canonical execution ledger.
7. Added `npm run forecast:trace:report -- --correlation-id <id>` to reconstruct one end-to-end timeline.
8. Ran live E2E against a previously unprepared SGX coking-coal series and reconciled Neon records with Render logs and metrics.

Telemetry failures remain best-effort: they do not retry or invalidate the product action. Forecast preparation still uses the canonical SG Runtime engine and durable queue; no second forecast runtime was introduced.

## Git and deployment authority

| Item | Authority |
|---|---|
| Initial base | `9ff72ef32c4077ee259b9e93084a1d0a35d326c3` |
| Main feature | `53663ca9867e14cbdd2140d176c4c73d5c49fc6c` / PR #28 |
| UI correlation corrective | `5d129a0dad3d3faad7b7600069171b45af2125de` / PR #29 |
| Bounded Daily continuation corrective | `402bdc21e4290ec3b7d381f001a15980052c9ba5` / PR #30 |
| Final merged source | `f9674c955860f79816ff5fb3076bda5090c053e2` |
| Migration | `20260920233000_forecast_action_trace_and_resource_summary` |

Live Render parity:

| Service | Deploy | Commit | State |
|---|---|---|---|
| `spendguru-stage` | `dep-dao475mk1f9s73ajno30` | `f9674c955860f79816ff5fb3076bda5090c053e2` | live |
| `spendguru-forecast-preparation-worker` | `dep-dao477ajnfac73ague00` | `f9674c955860f79816ff5fb3076bda5090c053e2` | live |
| `dashboards-library` | `dep-dao478ugekts73aqsdf0` | `f9674c955860f79816ff5fb3076bda5090c053e2` | live |

Neon independently confirmed the new table, resource-summary ledger columns, indexes, action records, queue state, and per-slice execution ledger records.

## Fresh benchmark

- series: `sgx_acf2027f_cl`
- instrument: Future · Singapore Exchange · SGX TSI Australia Premium Coking Coal · January 2027 · Close
- frequency and unit: Daily · USD/Metric Ton
- observed history: approximately 960 valid values from 2023-01-03 through 2026-09-18
- precondition: no current forecast, historical verification, or preparation job existed for the tested exact identities before the run

## Final current-forecast timeline

Correlation ID: `5ede2f17-4336-444d-8b7e-a89973404686`

Exact identity: Naive · Point in Time · Rolling Daily.

| Event | Timestamp UTC | Delta |
|---|---|---:|
| User action requested | 20:39:26.066 | — |
| Durable queue accepted | 20:39:26.945 | 879 ms |
| Prepared-read actually became READY | 20:39:29.926 | 2,981 ms |
| Dashboard first observed READY | 20:39:30.449 | 523 ms |
| Browser rendered the result | 20:39:32.081 | 1,632 ms |
| Server received UI ACK | 20:39:32.157 | 76 ms |

Total request-to-confirmed-render time was **6.091 s**. Dashboard's measured response-to-visible portion was **606.5 ms**.

The linked worker resource summary recorded:

- worker wall time: 1,247.349 ms;
- Node CPU: 809.641 ms user + 90.139 ms system;
- Node maximum RSS: 149,467,136 bytes;
- Node sampled peak RSS: 147,369,984 bytes;
- Python process count: 0, as this Naive current run used the Node path.

## Exact Python attribution proof

The earlier fresh ARIMA current run used correlation ID `ff0feab8-ff3c-4fac-9331-f816798cc19c` and completed from request to UI ACK in 25.042 s. Its linked resource record measured exactly one `export_rolling_daily_current_forecast.py` process:

- Python wall time: 19,260.875 ms;
- Python user CPU: 17,991.898 ms;
- Python system CPU: 580.761 ms;
- Python maximum RSS: 170,176,512 bytes;
- complete worker wall time: 21,116.305 ms.

This proves both measurement paths without attributing Render's aggregate service metrics to a single job.

## Durable historical-verification run

Correlation ID: `842467c9-1671-4c51-ac48-17307ac2132c`  
Job key: `3c5742b66d852a5370ac0160da4ff26f723e2f0f114fb11866c15e37a521375d`

The browser was closed after queue acceptance. The worker continued processing. After reopening the benchmark, the UI recovered the running state without requiring another user action; the browser was then closed again and processing continued.

At the evidence snapshot (21:00:31.643 UTC):

- job state: `RUNNING`;
- successful bounded slices: 205;
- failures: 0;
- measured Python child processes: 410;
- aggregate measured worker wall time: 1,219,636.057 ms;
- average worker window: 5,949.444 ms;
- aggregate Python wall time: 668,546.564 ms;
- peak Node sampled RSS: 291,528,704 bytes;
- peak exact Python RSS: 165,560,320 bytes.

The first slice matches across sources:

- SG Runtime accepted the request at 20:39:52.412 UTC;
- worker started at 20:39:54.163 UTC;
- worker finished successfully at 20:40:02.306 UTC and returned the job to `QUEUED` for its next bounded slice;
- ledger/resource wall time was 8,143.432 ms, including two exact Python processes totalling 5,645.609 ms.

`artifactReadyAt`, Dashboard ready observation, and UI ACK are deliberately absent for this correlation at the snapshot because full historical verification has not yet reached `READY`. This is correct fail-closed telemetry, not a missing event.

## Render resource context

For the worker during 20:38–21:01 UTC:

- instance count stayed at 1;
- maximum observed CPU was 1.0 core;
- maximum observed service memory was 393,465,860 bytes.

These values are contextual service metrics. Exact per-job attribution comes from the execution-ledger resource summary, where Node is measured across the sequential worker job window and each Python child is measured as an exact process.

## Correctives discovered by the live E2E

### UI correlation isolation

The first live verification click exposed that current-result rendering could acknowledge the active verification correlation. The correction introduced layer-qualified current and verification correlation identities and prevented polling from replacing the current render identity. The final verification trace contains no false current-result ACK.

### Productive Daily slice continuation

The first verification slice successfully persisted one historical origin and four horizons but was initially classified as terminal because a capability count was zero. The queue now uses actual historical-progress origin count for this decision. The same job subsequently completed 205 consecutive slices with no failure at the evidence snapshot.

## Validation

- Dashboard suite: 280/280 PASS after the UI correlation corrective.
- Dashboard targeted telemetry tests: 3/3 PASS.
- SG Runtime non-database suite: 453 PASS, 1 skipped, 0 failed.
- Queue tests: 13/13 PASS.
- Production-operation tests: 16/16 PASS.
- Python resource-wrapper test: PASS.
- Dashboard and SG Runtime typechecks/builds: PASS.
- Prisma validation and `git diff --check`: PASS.

The wildcard SG Runtime suite additionally includes cross-instance database tests requiring a local PostgreSQL service on `127.0.0.1:55421`; that service was absent in the isolated worktree environment. The authoritative non-database suite and live Neon/Render E2E were green, so this is recorded as an environment limitation rather than a product regression.

## Verdict

`PPF1_ACTION_RESOURCE_TELEMETRY = LIVE_PROVEN`

`CURRENT_REQUEST_TO_UI_VISIBLE = LIVE_PROVEN`

`NODE_AND_PYTHON_RESOURCE_ATTRIBUTION = LIVE_PROVEN`

`DURABLE_QUEUE_AFTER_BROWSER_CLOSE = LIVE_PROVEN`

`FULL_HISTORICAL_VERIFICATION_AT_EVIDENCE_SNAPSHOT = IN_PROGRESS_EXPECTED`

The telemetry gaps requested by this task are closed. The ongoing bounded historical preparation remains product work performed by the durable queue and is not silently presented as READY before completion.
