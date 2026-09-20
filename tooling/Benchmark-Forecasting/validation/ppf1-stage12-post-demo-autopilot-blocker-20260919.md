# PPF-1 Stage 12 — post-demo autopilot blocker

## Status

`PLAN ZATRZYMANY — BLOCKER`

Aluminium readiness was completed successfully, but the updated release candidate cannot be deployed to all three official services. The Benchmark Finder build fails while downloading a newly introduced private package from GitHub Packages.

## Completed in this run

- Integrated the demo implementation with the current `main` line on branch `ppf1/stage12-post-demo-release-candidate-20260919`.
- Published release-candidate HEAD `200375cee46e62eeacbcb47132d8a70e7ba4b726`.
- Revalidated SG Runtime typecheck and production build.
- Revalidated the advisory widget tests (`4/4`) and execution-ledger tests (`14/14`).
- Completed Aluminium exact prepared state:
  - Current Forecast: `8/8 AVAILABLE` for Monthly Average and End of Period across four models.
  - Full Verification: `8/8 AVAILABLE` for Monthly Average and End of Period across four models.
  - Point-in-time Current: four models.
  - Point-in-time historical verification: four models.

## Blocker

The exact-SHA deployment of `200375cee46e62eeacbcb47132d8a70e7ba4b726` failed only for `BENCHMARK-FINDER-CATEGORY-BUILDER`:

- deploy: `dep-danft9egekts738rjkkg`
- result: `BUILD_FAILED`
- failure: `npm E401` for `@profitia/cic-procurement` from GitHub Packages

No secret value was read, logged, copied, or modified. Resolving this requires a governed GitHub Packages credential with read access to the required `@profitia` packages, or attaching the Finder to the approved secret source used by the service that builds successfully.

## Last Known Good

All three official services were restored to and independently confirmed LIVE on:

`c9c2dc4b38563b2da47edea357b1c7fe6a63e52c`

- `spendguru-stage`: deploy `dep-danfv48ae00c73el7ngg`, health HTTP 200
- `BENCHMARK-FINDER-CATEGORY-BUILDER`: deploy `dep-danb85uk1f9s7384s0sg`, health HTTP 200
- `dashboards-library`: deploy `dep-danfv5142hec73ecd42g`, smoke HTTP 200

The failed Finder build never replaced the active service. Forecast artifacts persisted in Neon and remained intact through rollback.

## Resume point

After the Finder package credential is corrected:

1. deploy one exact release-candidate SHA to all three official services;
2. run the single targeted expired-owner recovery audit;
3. run the official Brent → Copper → Aluminium cohort;
4. on PASS, remove the implicit in-memory production admission fallback;
5. redeploy and run the short post-deprecation cohort;
6. create and merge the final PR;
7. perform PMOS/PHR closeout when the authoritative pending artifact exists.

`PMOS_SAVE = NOT_RUN_PENDING_ARTIFACT_ABSENT`
