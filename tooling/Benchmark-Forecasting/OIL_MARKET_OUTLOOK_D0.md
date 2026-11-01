# Oil Market Outlook D0 — bounded Forecast experiment

Status: **EXPERIMENTAL / PARTIAL_READY / NO PRODUCTION ACCEPTANCE**. Task `SG2-OIL-MARKET-OUTLOOK-D0-20261101`, profile SG2, Development, authority `profitia/SG-dev/main`, starting SHA `019ee20c039fb92b13857e27d2866f7daf13abc3`. No merge or deployment is authorised.

## Fixed sources and access

The business-selected Macrobond futures are exactly `cl_c1_cl` (Crude Oil, Future, Light Sweet (WTI) Physical, 1st Position, Close, USD) and `b_c1_cl` (Crude Oil, Future, ICE Brent Crude, 1st Position, Close, USD). Never substitute spot, E-mini or another continuation. Private local source snapshots preserve the stored descriptions and original observations; no licensed raw histories are included in this PR. The one-off export driver is retained with the local task evidence and does not add an application script, route or product operation.

The retained private local task driver `operational-tools/export-oil-outlook-d0-source.mts` reuses `createStoredMarketHistoryReader` and the registered Development binding. The existing ordinary `sg2_market_read_development_runtime` login must pass the adapter's receipt, schema, object ownership, ACL, lease and role checks. Queries are read-only and limited to the two series. No owner login, provider fallback, SQL write, hydration, user impersonation, request API, E1 change or new grant is introduced. This PR changes only the four Forecast-owned files; SG Runtime source and the operation-integration receipt remain identical to main.

Source data are SHARED_KNOWLEDGE owned by SG2 Market Data. The task authorises an offline Development export and experiment, not a new product operation. It creates no personal/organisation records. Future shared product consumption still requires authoritative server-side identity, current rights, the adopted E1 contract and audit. A local path or task ID is not a UserID or entitlement. Local exports/cache are private files, not a new organisation-independent production service.

Independent ordinary-role readback on 1 November 2026 found Daily / USD / USD/Barrel in both stored series. WTI's latest lawful observation was **2026-09-23** (39 calendar days old); Brent's was **2026-10-15** (17 days old). These are stored provider-labelled observations, not a fresh independent provider verification. The bounded export performs **zero provider calls**. The former four-call approval question was task-specific. The owner explicitly superseded it on 1 November2026 with standing approval for ordinary licensed Macrobond reads, confirming no incremental per-request fee. The original stored-data experiment remains reproducible and unchanged; technical Source/E1 and storage safeguards still apply.

## Source and rollover verification

| Required item | Evidence/status |
| --- | --- |
| Exact series IDs | Stored identity matches the fixed business choices |
| Futures / first position | Business source selection is fixed; full provider metadata is not retained in the stored projection |
| FuturesPosition | NOT_AVAILABLE_FROM_STORED_SOURCE; do not infer a metadata value from the code |
| UnderlyingInstrument / UnderlyingInstrumentInfo | NOT_AVAILABLE_FROM_STORED_SOURCE |
| Frequency / currency / unit | Daily / USD / USD/Barrel confirmed by ordinary-role read |
| Last observation / freshness | Dates above; both STALE_FOR_D0 on 2026-11-01 |
| Macrobond automatic rollover rule / switch time | ROLLOVER_RULE_UNVERIFIED |
| Raw/unadjusted/adjusted history | UNVERIFIED |
| Historical individual contract-switch dates | NOT_AVAILABLE |

Macrobond's [official metadata reference](https://help.macrobond.com/common-metadata/) explains the position and underlying-instrument fields. Its [position-series tutorial](https://help.macrobond.com/tutorials-training/macrobond-analysis-user-guides/3-analyzing-data/mixing-analyses-and-formulas/futures/) demonstrates futures position series. Neither source establishes the exact roll trigger or adjustment method for these two stored snapshots. Do not equate exchange expiry with Macrobond rollover. A large observed move is only a possible market/roll stress marker, never proof of a contract switch. No observations or returns are silently adjusted, deleted or replaced on this basis.

## 7D mathematics and calendar

`forecasting/oil_outlook_d0.py` calls the existing `fit_path_model` portfolio: Naive, Damped Holt, non-seasonal ETS and bounded non-seasonal ARIMA. The statistical implementations, candidate grids, AICc selection and existing 1M/3M/6M/12M horizons are unchanged. Tests compare all four short-path point results with their unchanged long-path model results. No champion is selected.

Origin is the last lawful numeric observation at the source cutoff. Target is **origin + seven calendar days**, independent of report publication. Projected step counts use the existing `OBSERVED_WEEKDAY_SET_V1` strategy on the training prefix. A target without a projected trading step uses the last projected step on/before the exact target; no synthetic observed value is created. This is an observed-weekday approximation, not a verified exchange holiday calendar.

Training mirrors existing SG Runtime `CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX@current-fast-minimal-lawful-suffix-v1`: observations strictly after origin minus 12 clamped calendar months; extend only to the last 60 lawful observations if needed. This is RECENT verification with the current policy, not FULL expanding-history verification. The technical minimum of 60 is not claimed to establish 7D methodological sufficiency.

All D0 bands are **NOT_AVAILABLE**, with null lower/upper values. Existing 1M+ empirical anchors, pre-1M interpolation, native model intervals and the 40 evaluation residuals are not promoted into an accepted 7D confidence band. The older ETAP10 text and later current band code are distinct dated authorities; this experiment claims neither as 7D calibration approval.

## Historical verification

For each model and source, select up to 40 recent origins separated by at least seven calendar days whose exact target is no later than the source's latest observation. Fit only the prefix available by each origin; infer weekdays and select training from that prefix. No future prices or future observation counts select the fit or forecast step. Resolve actuals as the last real post-origin observation on/before the target, expose its actual date and lag, and never compare an immature target.

Crucial limitation: the stored data have no historical vintages or per-observation release timestamps. Results are **latest-vintage, observation-date-cutoff experiments**, not certified revision-safe real-time backtests. Values are observed in the exported snapshot; historical publication-time availability cannot be proved. This is recorded in every verification record, rather than claiming full no-look-ahead certification.

Results are separate per model, with sample/failed counts, origin/target dates, source fingerprints, versions, selected parameters, MAE/RMSE/bias in USD/Barrel, sMAPE in percent, MASE, and directional accuracy as a 0–1 fraction. Forecast-minus-actual is the error convention. A flat Naive forecast does not automatically count as directionally correct. Samples are descriptive; no formal sufficiency or model superiority is asserted. Possible large moves remain included, flagged and unclassified by rollover.

## Persistence, cache and production gap

`ExperimentalCache` is a local, content-addressed, immutable file store under a caller-supplied private task directory. Forecast identity includes exact series/model/method versions, engine/dependency fingerprints, full source prefix fingerprint, selected training fingerprint/policy, origin, exact target, horizon, frequency and calendar policy. Files are mode 0600. Exclusive locks reject concurrent misses before a second fit. Atomic publication never overwrites accepted local artifacts; integrity mismatch fails closed. Reopening the cache returns the existing record without fitting. Mature verification is an independent immutable namespace and cannot modify a forecast. Raw provider data and credentials are not written into source control.

This **does not implement production Forecast Library persistence**. Independent Development readback found existing accepted rolling-daily snapshots for both series and all four models, with different origins and freshness. Some current snapshots are mutable upserts. A prepared row or JSON field is not evidence of accepted immutable 7D semantics.

The present generic current/verification stores have string horizon fields and identity/version support; they may be reusable. Dedicated rolling-daily verification additionally requires `horizonMonths`, which must not be falsified as zero for a seven-day horizon. Production adoption needs an exact versioned 7D identity, approved calendar/verification rules, rights and ordinary writer adoption, immutable forecast history, separate actual maturation, source-vintage rules and idempotency tests. First assess reuse of the generic records or extraction from an exact trusted existing daily snapshot. A database migration is **not assumed necessary or authorised**. If a generic horizon unit/value is required, propose the exact additive migration, old-row invariants, role/ACL impact and recovery plan for separate approval before executing it.

## Reproduction and demo package

1. Run the retained local task driver from the canonical `apps/sg-runtime` checkout, using its existing `tsx` loader, a protected `OIL_D0_MARKET_READ_DATABASE_URL`, explicit `OIL_D0_RUNTIME_ROOT` and an absolute private output directory. Its original used bytes, reproducible task version and digests are retained locally. It exports both exact series through the existing reader.
2. From this tooling directory, run `scripts/export_oil_outlook_d0.py --source <WTI-export.json> --source <Brent-export.json> --as-of 2026-11-01 --origins 40 --cache <private-experimental-directory> --output <private-demo-directory>` with the existing pinned scientific environment. Keep BLAS threads bounded.
3. The JSON package includes source file digests, origins/targets, all four point forecasts, explicit unavailable bands, model metadata, historical per-model records/metrics, freshness, rollover limitations and cache receipts. Repeating the exact inputs reuses all forecast/verification artifacts. The first real-source run produced 328 forecasts and 320 mature verification records; replay reused all 648 without fitting or new cache writes.
4. D0 artifacts remain EXTERNAL LOCAL EXPERIMENTAL evidence, never accepted production data. An exact package location and final source/CI/continuity receipts are provided in the task handoff outside this PR.

Required local checks: new D0 tests; existing Phase1/Phase2 and rolling-daily/export regressions; runtime market-data/Forecast Library/current-snapshot tests; runtime typecheck; manifest/routing/governance; exact-source remote CI. Record actual failures and pending checks rather than inferring success. No benchmark UI horizon, Insights Runtime/contracts, CIC, assistant/LLM, scheduler, email, PDF, product schema, resource, merge or deployment is added.

## Real owner decisions / remaining gates

Insights Canon #847 has explicit I1–I4 owner approval but remains Draft/unmerged. G1 #848 has explicit governance approval but remains Draft/unmerged; its routes are not active on main. This task uses existing Forecast Tooling and SG Runtime routes only and does not depend on activating Insights Runtime.

Before claiming READY_FOR_DEMO: obtain sufficiently fresh lawful source data, confirm futures/rollover/adjustment provenance or disclose the exact unresolved source limitation, separately accept the 7D evaluation/calendar/vintage policy, and approve any future calibrated band methodology. Production persistence and product integration require their own accepted contract and gates. This experiment makes no production or deployment success claim.

## Owner-approved fresh continuation (1 November2026)

Task `SG2-OIL-D0-FRESH-LICENSED-20261101` reused the unchanged `fetchMacrobondEntityMetadata`, `createFinderSourceTransport` and ordinary `sg2_benchmark_source_development_runtime` service with its independent Source audit. Both live metadata responses confirm the exact full requested futures descriptions, `FuturesPosition=c1`, Daily/USD and last value date **2026-10-30**. WTI underlying is `cl2026z_cl`; Brent underlying is `b2026z_cl`; both report “December,2026”. The provider's display unit is `Currency Unit/Barrel`. These values do not prove a roll trigger, adjustment method, or historical vintages: **ROLLOVER_RULE_UNVERIFIED** remains.

Fresh observation values and canonical hydration are **BLOCKED**. The existing Source adapter and live native policy admit metadata/search endpoints but exclude `/v1/series/fetchseries`; the real adapter rejected the history request before its HTTP send. The canonical Market Data connection is the ordinary read-only role, and the Source role has no market-table INSERT/UPDATE rights. Stored re-read still ends2026-09-23 for WTI and2026-10-15 for Brent. Do not relabel metadata's last-value date as an acquired observation or reuse stale points as fresh forecasts. No privileged fallback, direct unscoped fetch, policy edit or DB write is authorised by the read approval.

The continuation retains a new immutable blocked acquisition package with fresh metadata, exact source fingerprints, prior scientific result references and the required technical next step. Previous raw snapshots, cache, model mathematics and packages are preserved. A separate ARCHITECTURE Draft PR proposes the permanent commercial policy; documentary merge does not block otherwise technically admitted reads. Full-history Source admission and a protected canonical Market Data writer still require their own controlled adoption/installation scope.

Monitoring: **REUSED** for the unchanged SG Runtime instrumented request/source code; controlled-transport regression verifies sanitisation and technical phases. **NOT_APPLICABLE** to offline Python/cache artifacts and one-off local operational invocations: no new application runtime is deployed or routed to the PORR Sentry project. Local acquisition stages retain timestamps, duration, outcome and technical reason. No new live Sentry receipt is claimed.
