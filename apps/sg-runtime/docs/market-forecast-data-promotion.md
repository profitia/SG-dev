# SG2 market history and forecast artifact promotion

This runbook applies only to SG2 application data in the registered Neon branches.
PMOS/MEMOROS/PHR, sessions, queue jobs, execution ledgers and action telemetry are
Development continuity or environment-local operational state; they are not promoted.
The registered source code revision and schema migrations must be released separately
before application data is copied.

## Direction and scope

The normal data path is Development → Staging → Production. Production remains
reserved until an application stack and an approved release exist there. A one-time
Staging → Development reconciliation is supported only with `--reconcile`, to bring
already prepared client-demo data into Development. It does not reverse the code
release path or make Staging a Development database.

The command copies only missing canonical `market_series`, `market_observations`
and `market_hydration_state` rows, AVAILABLE exact Current and Verification runs
and their child rows, AVAILABLE
rolling-daily forecast snapshots and calibration groups, and MATURED rolling-daily
verification records. It does not run forecast compute or fetch Macrobond data.
An existing destination hydration state is retained because its fetch clock is
environment-local; only a missing state is copied to preserve cache coverage.
Repeated runs are additive and idempotent. Existing semantic conflicts, destination
observations absent from the source, schema-history differences, and unverified Neon
endpoints stop the run; no record is silently overwritten or deleted.

## Operator procedure

1. Confirm the active `main` release, the intended `projectKey=SG2`, the exact
   registered Neon branch IDs and the source/destination migration history. Use
   the canonical governance provider-drift preflight before touching Staging or
   Production. Keep a recoverable database snapshot for the destination.
2. Supply a branch-specific **SELECT-only source role** and a destination writer
   through `PROMOTION_SOURCE_DATABASE_URL` and `PROMOTION_DEST_DATABASE_URL`, plus
   a scoped `NEON_API_KEY` capable of reading
   endpoint metadata. The CLI rejects a source role with write privilege on any
   promoted table. Do not put credentials in source control, command arguments,
   terminal logs, PMOS or PHR. The tool checks both URL hosts against Neon branch
   endpoint inventory and the SG2 topology registry before connecting.
3. From `apps/sg-runtime`, run the dry-run below. Use a bounded `--series-ids`
   cohort first; use `--all` only after the bounded cohort has passed. Record the
   emitted `planDigest`, series counts and exact branch IDs in the release evidence.
4. Execute the same command with `--apply --approved-plan-digest=<planDigest>`.
   The tool rescans data and rejects a stale digest. Keep Development and Staging
   workers from recomputing the chosen series during the apply window.
5. Re-run the dry-run: missing counts must be zero for that cohort. Verify at
   least one prepared Current and Verification read on the destination, and
   compare counts/digests of representative histories against the source. Record
   failures and resolve conflicts explicitly before retrying; never use branch
   reset or bulk overwrite as a shortcut.

```sh
npm run market-data:promote -- --from=development --to=staging \
  --from-branch-id=br-dry-hall-b294222f \
  --to-branch-id=br-wandering-dew-b2izo8fg \
  --series-ids=b_c1_cl
```

For the initial demo reconciliation, use `--from=staging --to=development
--reconcile` and reverse the branch IDs. Production promotion uses
`--from=staging --to=production` only after Production is an active release
target. The operator must supply the dry-run digest to `--apply`; the CLI does
not schedule itself or change release policy.

## Ongoing operation

New Development data is not automatically visible in Staging or Production.
After each accepted release, run the bounded dry-run/apply/verify sequence for
the newly prepared benchmark cohort. Promote the same accepted code revision
through environments first. Keep the destination serving its existing prepared
reads during additive copy, then smoke-test the destination before declaring
the data release complete. If a prepared artifact is recomputed or a provider
revises historical values, the conflict requires an explicit migration or
recalculation decision; this tool intentionally does not merge such changes.
