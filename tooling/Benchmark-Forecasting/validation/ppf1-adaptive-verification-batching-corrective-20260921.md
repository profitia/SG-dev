# PPF-1 adaptive Historical Verification batching corrective

## Decision and result

The corrective is **LIVE PROVEN**. PPF-1 now preserves the fast Current Forecast and the first one-origin Historical Verification result, then grows only the serial background batch size according to observed slice time. It no longer recomputes Current Forecast after every intermediate verification slice.

## Root cause fixed

The first live implementation correctly introduced adaptive batches, but its initial Current reuse check compared two intentionally different identities: the Full Verification history fingerprint and the Current snapshot fingerprint. That made the already prepared Current snapshot look stale after every slice.

The hotfix makes the durable queue dependency the authority. A verification job can run only after its exact Current dependency has succeeded. Intermediate slices therefore skip Current refresh without comparing incompatible fingerprints. The terminal slice refreshes Current once after the historical artifact reaches its final checkpoint.

## Architecture preserved

- Current Forecast remains a separate, higher-priority durable job.
- Historical Verification remains durable and continues after the browser closes.
- Execution remains sequential; no new verification concurrency was introduced.
- The first batch remains exactly one origin.
- Allowed batch sizes are `1, 2, 4, 8, 16, 32`.
- Growth is bounded to one step; failures and hard overruns reset the next batch to one.
- Adaptive state is stored in the existing durable checkpoint.
- No second forecast engine, benchmark-specific branch, manual forecast SQL or alternate runtime was added.

## Git authority

- Source base: `5f2a72de1b150b99a2f8101623a5d56255df2be2`.
- Adaptive batching commit: `d80c37a242913caa95551cb1b8bf2fcaa0fa8955`.
- PR #32 merge: `852b090dfa52e2bf9f73a5e2dcfd7ee735fcef5c`.
- Current-refresh hotfix commit: `197e4d4840b34f771e0ecd024e7921310e617dc6`.
- PR #33 live merge: `9ca0d92613ee693a9cbbbed460d1453ef2c756a8`.

## Validation

- Targeted batching, queue and Rolling Daily tests: `39/39 PASS`.
- Broad SG Runtime regression: `464 PASS`, `0 FAIL`, `1 SKIPPED`.
- Typecheck: `PASS`.
- Production build: `PASS`.
- Git whitespace check: `PASS`.
- The skipped cross-instance test requires the isolated local PostgreSQL runtime, which was not running. No assertion failed.

## Deployment parity

All three governed SG Runtime services are live on exact source SHA `9ca0d92613ee693a9cbbbed460d1453ef2c756a8`:

- worker: `dep-daob98rtqb8s73el8tv0`;
- spendguru-stage: `dep-daob98jtqb8s73el8so0`, health HTTP 200;
- BENCHMARK-FINDER-CATEGORY-BUILDER: `dep-daob98jtqb8s73el8sb0`, health HTTP 200.

## Live canary

Exact identity:

- series: `sgx_acf2027f_cl` — SGX TSI Australia Premium Coking Coal January 2027 Close;
- model: `ets`;
- basis: `POINT_IN_TIME` / Daily;
- correlation ID: `ppf1-adaptive-hotfix-sgx-ets-20260921`;
- Current job: `aed7a18fea4248619075c9a27173282cd652834eb8522bf01606cc7bfb2ee080`;
- Verification job: `dcb6cc39a741de907de79419fd78354ae88401e5e59e1939a45057081405db41`.

Observed timeline:

- request accepted: `04:41:17.883Z`;
- Current READY: `04:41:24.782Z`, after `6.899 s`;
- first partial verification slice complete: `04:41:28.455Z`, after `10.572 s` from request;
- Full Historical Verification READY: `04:45:51.618Z`, after `273.735 s` from request.

The job processed all `704` origins in `27` durable serial slices. Batch progression was `1 → 2 → 4 → 8 → 16 → 32`, then held at 32 while inside the execution envelope. The terminal slice lawfully contained the one remaining origin.

For every intermediate slice:

- Python process count was exactly one;
- the only Python program was `export_rolling_daily_incremental_maintenance.py`;
- `rolling_daily_snapshot_compute` count was zero;
- `export_rolling_daily_current_forecast.py` count was zero.

On the terminal slice only, the worker ran maintenance and one Current snapshot refresh, then stored the job as `SUCCEEDED`. Final Dashboard state was Current `READY`, Verification `READY`, no active job and `failureCount = 0`.

## Acceptance

- Fast Current Forecast preserved: **PASS**.
- Fast first partial verification preserved: **PASS**.
- Adaptive growth proven live: **PASS**.
- Serial execution preserved: **PASS**.
- Durable completion after background execution: **PASS**.
- Repeated Current recompute removed: **PASS**.
- One terminal Current refresh: **PASS**.
- Exact GitHub/Render source parity: **PASS**.

## Residual risk

The final live canary covers the exact ETS Daily identity. The implementation is generic across model and series identity and is covered by broad regression tests, but the remaining model/basis combinations were not redundantly recomputed solely for this corrective. Render service metrics also remain service-level context; exact Node/Python job measurements continue to come from the execution ledger.
