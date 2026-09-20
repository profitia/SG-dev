# PPF-1 Stage 12 — post-demo final acceptance

## Verdict

`PASS — READY FOR PR AND MERGE`

The durable cross-instance execution ledger is live-proven, the official Brent → Copper → Aluminium cohort passed, the implicit production in-memory admission fallback was removed, and the post-deprecation cohort passed on the exact release SHA.

## Exact release authority

- Branch: `ppf1/stage12-post-demo-release-candidate-20260919`
- Pre-deprecation release: `200375cee46e62eeacbcb47132d8a70e7ba4b726`
- Post-deprecation release: `7885466e64a1fed4971c1c3a5550c6646625312b`
- `spendguru-stage`: `dep-dannifuk1f9s739b1uj0` — LIVE
- `BENCHMARK-FINDER-CATEGORY-BUILDER`: `dep-dannifp42hec73f3g52g` — LIVE
- `dashboards-library`: `dep-dannifp42hec73f3g5dg` — LIVE
- All three public health/smoke checks returned HTTP 200.

## Durable recovery proof

The targeted `hg2027g_cl / HISTORICAL_MAINTENANCE / ets` audit used the exact historical execution identity, including `maxOriginsPerRun=64`.

- Expired primary: `a95f6102-25a0-40aa-941a-e2c33615c8dd`
- Primary terminal state: `FAILED / FINALIZATION`
- Recovery: `842a5a8e-a91e-4739-b396-c803deeb4769`
- Recovery lineage: `RECOVERY / RECOVERY_RESUME`
- Recovery terminal state: `COMPLETED / NO_OP / cache hit`
- `recoveredFromExecutionId` points exactly to the expired primary.

This proves that an expired owner is fenced and superseded by one durable recovery owner across process instances.

## Official cohort

The first Aluminium pass failed closed because three new source observations had appeared after the previous readiness preparation. A single targeted audit identified this as incremental data drift, not a code or methodology regression. Canonical incremental maintenance processed the three new origins for Naive, Damped Holt, ETS, and ARIMA, refreshed their snapshots with parity `MATCHED`, and the repeated Aluminium certification passed.

Final pre-deprecation outcome:

- Brent: `demoSafe=YES`
- Copper: `demoSafe=YES`
- Aluminium: `demoSafe=YES`

## Legacy admission fallback deprecation

Commit `7885466e64a1fed4971c1c3a5550c6646625312b` removes the implicit production fallback from durable PostgreSQL admission to process-local memory.

- Missing durable ledger authority now fails closed.
- The explicit in-memory adapter remains available for unit tests and dependency injection.
- No forecast math, model version, training window, verification methodology, scheduler, queue architecture, or concurrency policy changed.

## Post-deprecation cohort

All three benchmarks passed on exact deployed SHA `7885466e64a1fed4971c1c3a5550c6646625312b`:

- Brent execution `demo-certification-b76fc149-2b13-420f-85d1-88c4850523ee`
- Copper execution `demo-certification-331d16e7-9cc7-49b5-83b7-6db045937610`
- Aluminium execution `demo-certification-b50519df-9ba7-4a64-9d24-db1ff2c702bb`

For every benchmark:

- `precompute = PASS`
- `reread = PASS`
- `matrix = PASS`
- `freshness = PASS`
- `warmRehearsal = PASS`
- `demoSafe = YES`
- `timeoutSnapshot = null`

Compute safety remained unchanged: no second forecast engine, no duplicate compute regression, canonical single-flight preserved, and no uncontrolled precompute fan-out.

## Validation

- Execution-ledger targeted suite: `14/14 PASS`
- SG Runtime typecheck: `PASS`
- Full SG Runtime non-database suite: `PASS`
- SG Runtime production build: `PASS`
- `git diff --check`: `PASS`
- The local cross-instance suite was not rerun because its dedicated PostgreSQL fixture was not listening on `127.0.0.1:55421`; the equivalent production recovery lineage was independently proven in live Render/Neon.

## PMOS / PHR

`apps/pmos/.pmos/pending-artifact.json` is absent. Therefore formal PMOS save remains:

`NOT_RUN_PENDING_ARTIFACT_ABSENT`

This absence does not invalidate the technical Stage 12 acceptance evidence, but PMOS/PHR closeout must be completed when the authoritative pending artifact is restored.
