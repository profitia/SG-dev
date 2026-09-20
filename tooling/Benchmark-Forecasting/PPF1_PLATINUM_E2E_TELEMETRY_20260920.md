# PPF-1 Platinum E2E and telemetry audit — 2026-09-20

## Executive verdict

The test confirmed the primary PPF-1 product promise for a previously unprepared benchmark: the durable queue accepted the request quickly, canonical Current Forecast artifacts were created in the background, and subsequent prepared reads were fast and did not start duplicate compute. Closing the browser did not cancel Historical Verification preparation.

The tested contract (`pl2023g_cl`) contains only 61 daily observations from 2022-11-28 through 2023-02-24. It is sufficient for six lawful Current Forecast identities, but it cannot produce a factual Historical Verification comparison for the requested 1M, 3M, 6M, and 12M horizons. The correct result for full verification is therefore `INSUFFICIENT_VERIFICATION_HISTORY`, not a long-running preparation.

The E2E test found four production defects and two projection inconsistencies. All were fixed, regression-tested, merged, and deployed during the test:

1. exact Daily reads could incorrectly reuse legacy snapshots without exact identity;
2. a terminal `SUCCEEDED` queue row could not be reopened when its exact artifact was still missing;
3. reopened jobs retained timestamps and counters from the previous attempt;
4. zero-origin verification jobs repeated forever instead of terminating;
5. the fast batch-readiness projection could contradict the exact capability read for zero-origin verification.
6. a selected durable progress snapshot could label other ready controls as unsupported.

The measured user-facing Current Forecast path is acceptable but has an avoidable presentation delay: the first persisted artifact was available about 6 seconds after submission, while the polling client observed readiness at about 13 seconds. The next optimization should reduce observation latency and add one correlation identity across the complete browser-to-worker path.

## Scope and authority

- Repository: `profitia/SG-dev`
- Baseline `origin/main`: `a367bbcbbd2a2c448f2c6d63a0f95a9f2cf0a6f0`
- Test branch: `test/ppf1-platinum-e2e-telemetry-20260920`
- Benchmark: `pl2023g_cl`
- Internal market-data series id: `cmtm79kbh000nh4hhwx3wtbqd`
- Display identity: Platinum / Future / CME Group / 24 February 2023 / Close / Daily / USD per Troy Ounce
- Persistence authority: Neon project `autumn-waterfall-65938876`, branch `br-purple-shape-b2az1npx`, database `neondb`
- Runtime authority: Render services `dashboards-library`, `spendguru-stage`, `BENCHMARK-FINDER-CATEGORY-BUILDER`, and `spendguru-forecast-preparation-worker`

No manual forecast-artifact SQL writes were made. Neon was used read-only for source history, job state, artifact identity, and timestamps.

## Source history and initial state

- Observation count: 61
- Earliest observation: 2022-11-28
- Latest observation: 2023-02-24
- Source frequency: Daily
- Current exact PPF-1 artifacts at test start: none
- Exact Historical Verification artifacts/jobs at test start: none
- Legacy state: three Rolling Daily snapshots (`naive`, `damped_holt`, `arima`) created on 2026-09-04 with null exact-identity columns; ETS had no legacy snapshot.

This was a valid cold test for exact PPF-1 identities, but not a pristine database with no earlier legacy rows. That distinction was decisive in finding the legacy fallback defect.

## End-to-end timeline

All timestamps below are UTC on 2026-09-20.

| Stage | Evidence | Result |
|---|---|---|
| Search | Public benchmark search | HTTP 200; 1.770 s total; exact `pl2023g_cl` returned |
| Initial capability | 12 model × target-basis identities | 6 Current identities lawful; 6 complex monthly identities correctly rejected for insufficient history |
| First Current submit | Naive / Monthly Average | Queue acknowledgement HTTP 200 in 0.641 s; Dashboard bridge 535 ms |
| Durable request | `requestedAt=16:28:23.316` | Persisted independently of browser lifetime |
| Worker start | `startedAt=16:28:24.253` | Queue wait about 0.937 s |
| Artifact creation | 16:28:28.456 | First renderable artifact about 5.14 s after durable request |
| Job completion | 16:28:28.593 | Worker execution about 4.34 s; approximately 6 s from user/API submit |
| Client observed ready | next polling cycle | about 13 s from submit, exposing about 7 s observation delay |
| Warm prepared read | same identity | HTTP 200 in 0.133 s |
| Verification submit | Naive / Monthly Average at 16:34:19.693 | Durable queue accepted request |
| Browser closure | 16:34:23.168 | Worker continued without browser session |
| Zero-origin detection after corrective | five verification identities | All terminated as `FAILED / INSUFFICIENT_VERIFICATION_HISTORY`; no indefinite loop remained |

The Current Forecast cold reference was produced without duplicate forecast engines, a second runtime, or a browser-owned task.

## Final 12-identity capability result

`Ready` below refers to Current Forecast. Historical Verification is evaluated separately because this expired contract has no lawful verification origins for the requested horizons.

| Target basis | Model | Current result | Historical Verification result |
|---|---|---|---|
| Daily / Point in Time | Naive | Ready | Not prepared; insufficient verification history |
| Daily / Point in Time | Damped Holt | Ready | Not prepared; insufficient verification history |
| Daily / Point in Time | ETS | Ready | Not prepared; insufficient verification history |
| Daily / Point in Time | ARIMA | Ready | Not prepared; insufficient verification history |
| Monthly Average | Naive | Ready | Not prepared; zero lawful comparisons |
| End of Period | Naive | Ready | Not prepared; zero lawful comparisons |
| Monthly Average | Damped Holt | Insufficient history | Not eligible |
| Monthly Average | ETS | Insufficient history | Not eligible |
| Monthly Average | ARIMA | Insufficient history | Not eligible |
| End of Period | Damped Holt | Insufficient history | Not eligible |
| End of Period | ETS | Insufficient history | Not eligible |
| End of Period | ARIMA | Insufficient history | Not eligible |

The six complex monthly identities have only four contiguous monthly observations against a six-observation technical minimum. The result is factual and is not a PPF-1 execution failure.

## Current Forecast performance

### Cold-path observations

- Durable queue acknowledgement: 0.63–0.89 s for the submitted identities.
- Naive Monthly artifact: about 5.14 s after persisted request.
- ETS Daily exact Current: about 5.54 s worker duration.
- Naive End of Period exact Current: about 5.60 s worker duration.
- ARIMA Daily after backlog and legacy repair: artifact created 17.441 s after persisted request; the additional delay came from worker backlog, not model execution alone.
- First client-visible readiness on the reference request: about 13 s, versus artifact availability at about 6 s.

### Warm prepared reads

| Identity | HTTP result | Total time |
|---|---:|---:|
| Naive / Monthly Average | 200 / available | 1.302 s |
| Naive / End of Period | 200 / available | 0.227 s |
| Naive / Daily | 200 / available | 0.842 s |
| Damped Holt / Daily | 200 / available | 0.611 s |
| ETS / Daily | 200 / available | 0.645 s |
| ARIMA / Daily | 200 / available | 0.575 s |

The ARIMA Daily payload contained the four requested forecast anchors and a 365-day path. Repeated prepared reads did not start a new production compute.

## Historical Verification durability and boundedness

The browser was closed approximately 3.5 seconds after the first verification request. The durable job continued, proving that execution ownership is server-side and restart-safe rather than tied to the browser.

Before the corrective, the five tested verification jobs repeatedly recomputed/re-read a completed zero-origin artifact:

| Identity | Final slice count | Final state |
|---|---:|---|
| Naive / Monthly Average | 118 | Failed — insufficient verification history |
| Naive / End of Period | 103 | Failed — insufficient verification history |
| Naive / Daily | 121 | Failed — insufficient verification history |
| Damped Holt / Daily | 75 | Failed — insufficient verification history |
| ETS / Daily | 71 | Failed — insufficient verification history |

The final durable state has no active lease and no running verification job for `pl2023g_cl`. Each terminal job exposes the explicit failure code `INSUFFICIENT_VERIFICATION_HISTORY` and a factual reason.

## Resource behavior

The single worker instance was saturated by the zero-origin loop:

- CPU repeatedly reached 0.68–1.00 CPU from about 16:36 through 17:16.
- Memory rose from about 223 MB before verification to a peak of about 683 MB.
- After terminal zero-origin handling went live, CPU fell to roughly 0.002–0.114 CPU and memory stabilized around 159–228 MB.

This is strong causal evidence that the loop, rather than legitimate multi-hour model work, was the main resource problem for this benchmark.

## Defects found and corrected

### 1. Legacy Daily snapshot accepted as exact

**Cause:** after an exact lookup missed, the fallback could accept a legacy payload fingerprint even though the deployed schema already had exact identity columns. The queue then reported success without creating an exact artifact.

**Correction:** legacy fallback is allowed only when the schema lacks exact identity columns. With the current schema, a legacy row returns `EXACT_SNAPSHOT_IDENTITY_MISSING` and canonical ownership rebuilds the artifact.

### 2. Stale terminal queue row could not be reopened

**Cause:** an existing `SUCCEEDED` row suppressed re-enqueue even when exact capability still reported missing readiness.

**Correction:** terminal success is revalidated against exact persisted truth and conditionally reopened. A second readiness check prevents an enqueue/worker race from creating duplicate compute.

### 3. Reopened-attempt telemetry contaminated by old timestamps

**Cause:** `startedAt`, `completedAt`, slice state, and lease fields survived a reopen, making the new attempt appear to have run since the earlier execution.

**Correction:** attempt-local timestamps, checkpoint, slice counter, and lease state are reset; lifetime request count remains durable.

### 4. Zero-origin verification loop

**Cause:** completed/reused verification with zero lawful comparisons was considered complete by compute but non-renderable by the prepared reader. The worker interpreted this mismatch as more work and repeated indefinitely.

**Correction:** the worker terminally fails the job with `INSUFFICIENT_VERIFICATION_HISTORY` when a completed/reused result has zero lawful comparisons.

### 5. Batch/exact readiness contradiction

**Cause:** the fast series snapshot intentionally avoided payload reads and trusted `historicalPreparedState=READY`, even when owner metadata reported `verificationEvidenceState=NOT_AVAILABLE`.

**Correction:** the fast projection remains payload-free but now requires non-zero verification evidence before projecting Recent or Full verification as ready. The exact and batch endpoints agree.

### 6. Peer controls became unsupported during selected queue progress

**Cause:** once a progressive snapshot existed for the selected identity, model and target-basis controls defaulted every identity absent from that narrow snapshot to `UNSUPPORTED`, ignoring the series capability snapshot.

**Correction:** progressive state overrides only the exact identity it describes. All peer controls fall back to their own capability truth. The live Platinum UI therefore preserves `Ready` for prepared Daily models while showing the selected verification outcome independently.

## Telemetry coverage and gaps

| Process segment | Current evidence | Coverage | Gap / consequence |
|---|---|---|---|
| User click | Browser observation | Partial | Click timestamp is not persisted |
| Dashboard request and bridge | HTTP time and bridge timing | Partial | No durable correlation id propagated to queue/worker |
| Queue acknowledgement | HTTP and durable `requestedAt` | Good | Client polling cadence is not recorded with the job |
| Queue wait | `requestedAt` → `startedAt` | Good for a clean attempt | Historical reopened jobs had contaminated timestamps before the fix |
| Worker execution | job state, slice count, timestamps | Good | No first-class processed/expected origin progress or ETA |
| Market-data reads | structured logs with DB/provider/persist timing | Good | Logs cannot be joined to one E2E request id |
| Model compute | aggregate operation duration | Partial | Python/model-fit sub-stages are not consistently timed |
| Persistence | artifact creation and completion timestamps | Good | No attempt entity separate from the durable identity row |
| Browser presentation | external measurement | Weak | Artifact-ready → first-render delay is not persisted |
| Resource use | Render 60-second CPU/memory series | Aggregate | No per-job CPU or memory attribution |
| Deployment interruption | lease timestamps | Partial | A running job can wait for lease expiry after SIGTERM |

The most important telemetry gap is the missing universal correlation identity. During this run, Dashboard diagnostic context fields such as request id, phase, operation, series, model, and target basis were not available as one durable chain. The API, queue, Neon artifacts, Render logs, and browser timings had to be joined by identity and timestamps.

## Validation

- Dashboard targeted tests: pass.
- Dashboard full package tests: 276/276 pass.
- Dashboard typecheck: pass.
- Dashboard production build: pass.
- SG Runtime targeted route and durable-queue suites: 57/57 pass after the final readiness parity change.
- SG Runtime typecheck: pass.
- SG Runtime production build: pass.
- `git diff --check`: pass.
- Full SG Runtime wildcard test run: all non-database-dependent tests completed; the DB-backed cross-instance suite could not connect to the test Postgres expected at `127.0.0.1:55421`. This is a local test-environment dependency, not evidence of a product regression.
- Live Render SHA parity and post-deploy API/UI checks: recorded in the companion JSON evidence artifact.
- Neon verification: read-only; source history, artifacts, queue jobs, timestamps, failure codes, and cleared leases confirmed.

## Publication chain

| PR | Purpose | Merge commit |
|---|---|---|
| [#17](https://github.com/profitia/SG-dev/pull/17) | Durable verification action and UI projection | `db1cfe5d1c63884dcda0f9753e9433f2000af8fb` |
| [#18](https://github.com/profitia/SG-dev/pull/18) | Exact Daily recovery from legacy snapshot state | `ace2c8bf45c68997ad09f24745542b43dbe87239` |
| [#19](https://github.com/profitia/SG-dev/pull/19) | Reopen stale succeeded preparation jobs | `6dc1165da9f4d960af02d45c812082e07dd22f3f` |
| [#20](https://github.com/profitia/SG-dev/pull/20) | Reset attempt telemetry on reopen | `fb8dcefeeca79884146f6f415516ea817667ede9` |
| [#21](https://github.com/profitia/SG-dev/pull/21) | Terminate zero-origin verification jobs | `66746ee5cc8b91f67c4305e295ca06c4829b1bcd` |
| [#22](https://github.com/profitia/SG-dev/pull/22) | Reject zero-comparison exact readiness | `3ff24a02e7a71107afb4746fb220879bc466c59d` |
| [#23](https://github.com/profitia/SG-dev/pull/23) | Align fast batch readiness with exact evidence | `06250b8c047d28efd7457cfbf4988f3441446a20` |
| [#24](https://github.com/profitia/SG-dev/pull/24) | Preserve peer readiness during selected queue progress | `1a1f69c8e0dac763b2deb297dd2615df9e1da883` |

## Final live authority and smoke test

- Dashboard: deploy `dep-dao1k8dg1s2s7393q09g`, source `1a1f69c8e0dac763b2deb297dd2615df9e1da883`, status `live`.
- SG Runtime: deploy `dep-dao1fu8473hc73b3fnv0`, source `06250b8c047d28efd7457cfbf4988f3441446a20`, status `live`.
- Benchmark Finder: deploy `dep-dao1fsugekts73ai0cog`, source `06250b8c047d28efd7457cfbf4988f3441446a20`, status `live`.
- Preparation Worker: deploy `dep-dao1fvg473hc73b3fsg0`, source `06250b8c047d28efd7457cfbf4988f3441446a20`, status `live`.

The final browser smoke test searched the benchmark, expanded analytics, enabled forecasts, enabled Historical Verification, and switched from ARIMA/Daily to Naive/Daily. Both selected Current Forecast identities showed `Gotowe`; peer controls no longer showed `Niewspierane`; and the interface exposed the `Przygotuj sprawdzalność` action with the explicit statement that the user may safely close the browser.

## Recommended next optimizations

### P0 — one E2E correlation identity

Create one id at the browser action and propagate it through Dashboard, SG Runtime, queue row, execution ledger, worker logs, model stages, and artifact metadata. This will turn future E2E timing from timestamp inference into exact trace evidence.

### P0 — pre-admission verification feasibility

Before enqueueing Historical Verification, calculate and expose the lawful comparison count per horizon. If all horizons have zero comparisons, return the terminal insufficiency immediately and explain it in the UI. This prevents even one unnecessary worker claim.

### P1 — reduce artifact-ready to UI-visible delay

Replace fixed polling with server-sent events, adaptive short polling, or an immediate poll after queue acknowledgement. The tested reference lost about seven seconds after the artifact already existed.

### P1 — graceful lease release on worker deployment

On SIGTERM, stop accepting new work and release/checkpoint the current lease when safe. A deployment currently can leave a row `RUNNING` until the ten-minute lease expires.

### P1 — attempt-level telemetry

Keep the durable job identity, but persist individual attempts with their own requested/start/complete timestamps and outcome. This avoids mixing lifetime request count with attempt duration and makes retries auditable.

### P1 — factual progress contract

Expose processed origins, expected lawful origins, active horizon, checkpoint, and an evidence-based ETA. Do not estimate progress only from slice count.

### P2 — finer model-stage timings

Record preparation, model fit, Python process, verification aggregation, and persistence separately for every identity.

### P2 — worker sizing and concurrency review

Repeat the resource test with a benchmark that has enough history for real 1M/3M/6M/12M verification. Use per-job correlation first; then decide whether concurrency or worker size needs adjustment.

## Decision

PPF-1 Current Forecast on-demand preparation is live-proven for this cold exact identity, including prepared reuse and durable background ownership. Historical Verification queue durability is also live-proven. Full verification cannot be certified as successful on this particular expired 61-observation contract; the correct certified outcome is a fast, explicit insufficiency result. The corrected system now reaches that terminal state instead of consuming resources indefinitely.

This report is suitable as the baseline for the next optimization task. It does not replace the formal Stage 12 cohort acceptance for benchmark series with sufficient verification history.
