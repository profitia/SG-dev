# PPF-1 Demo Task 4 — Eleven-benchmark production readiness

## Verdict

`TASK_4_GATE = PARTIAL_AWAITING_OWNER_DECISION`

`DEMO_ELEVEN_BENCHMARKS_READY = NO`

`PREPARED_SUPPORTED_DEMO_PATHS_READY = YES`

Prepared client reads are live and the Dashboard remains frozen. The SG Runtime source advanced to the exact demo branch commit recorded below to repair Brent-continuation history selection and generic Macrobond measurement metadata. The strict contract is still not met, so this evidence deliberately does not declare final demo readiness.

## Live authorities

- SG Runtime: `spendguru-stage`, service `srv-d98a73btqb8s73fabp90`, deploy `dep-dalfs8id0e5s73f8r0sg`, source `4fd33ec401379e3587d5801b005772e89f6738a6`, status `live`.
- Dashboard: `dashboards-library`, service `srv-da2i7j9t0dsc73ag7qv0`, deploy `dep-dale0vm5vjqs73f2e22g`, status `live`.
- Persistence: Neon project `autumn-waterfall-65938876`, branch `br-purple-shape-b2az1npx`, database `neondb`; verification was SELECT-only.
- Frozen Stage 12 reference remains `2f0e93c828fef22241affd4b703fc139b1759ca8` and was not modified.

## Prepared benchmark paths

| Series | Intended demo identity | History through | Period Current | Period Recent Verification | Rolling Daily | Supported UI smoke |
|---|---|---:|---:|---:|---:|---:|
| `b_c1_cl` | ICE Brent 1st Position | 2026-09-15 | 8/8 | 8/8 | 4/4 Current; 16/16 calibrated | PASS |
| `cl_c1_cl` | CME WTI Physical 1st Position | 2026-09-15 | 8/8 | 8/8 | 4/4 Current; 16/16 calibrated | PASS |
| `wocaes0074` | Brent Spot FOB North Sea | 2026-09-15 | 8/8 | 8/8 | 4/4 Current; 16/16 calibrated | PASS |
| `hg2027g_cl` | CME Copper Feb 2027 | 2026-09-15 | 8/8 | 8/8 | 4/4 Current; 16/16 calibrated | PASS |
| `lmeofcucashask` | LME Copper Cash | 2026-09-15 | 8/8 | 8/8 | 4/4 Current; 16/16 calibrated | PASS |
| `ehr2027g_cl` | North European HRC Feb 2027 | 2026-09-15 | 8/8 | 2/8 | 4/4 Current; 4/16 calibrated (1M only) | PASS |
| `hwwi_gb_ironsteel_2021_eur` | HWWI Iron and Steel Index | 2026-08-31 | EOP 4/4 | EOP 4/4 | unsupported | PASS |
| `lmescusd20270226` | LME Steel Scrap Feb 2027 | 2026-09-15 | 8/8 | 8/8 | 4/4 Current; 8/16 calibrated (1M, 3M) | PASS |
| `bz_c1_cl` | ICE Brent continuation | 2026-09-15 | 8/8 | 8/8 | 4/4 Current; 16/16 calibrated | PASS |
| `hg_c1_cl` | Copper continuation | 2026-09-15 | 8/8 | 8/8 | 4/4 Current; 16/16 calibrated | PASS |
| `qm_c1_cl` | NYMEX E-mini Crude continuation candidate | 2026-09-15 | 8/8 | 8/8 | 4/4 Current; 16/16 calibrated | PASS |

For period methods, 8/8 means four equal models under Monthly Average and End of Period. For HWWI only End of Period is lawful and supported. `qm_c1_cl` remains a candidate pending owner approval; the exact financial WTI continuation `ws_c1_cl` is stale at 2017-07-20 and is not safe for the demo.

## Exact remaining gaps

1. The production tables do not yet contain `trainingWindowPolicyId` and `effectiveTrainingPolicyId`. Prepared rows therefore reconstruct as `LEGACY_UNRESOLVED`; strict capability reads reject Recent Verification as an exact policy match and report zero `FAST_READY` variants across the cohort. This is not a missing-history, stale-fingerprint, or cold-compute failure.
2. Macrobond identifies `hwwi_gb_ironsteel_2021_eur` as `DataType=average`, `Frequency=Monthly`, `Unit=Index`, while the current provenance resolver exposes only End of Period from `Class=stock`. Treating provider-published monthly averages as `MONTHLY_AVERAGE` requires an explicit financial-methodology decision; Point in Time remains unsupported for a monthly source.
3. `ehr2027g_cl` has all eight period Current Forecast variants and all four Rolling Daily models. Its six closed monthly observations produce period Recent Verification only for Naive; Damped Holt, ETS, and ARIMA need one more closed month to create a lawful matured verification origin under `ADAPTIVE_SHORT_HISTORY_V1`.
4. The fresh WTI continuation substitute is not yet a business decision. `qm_c1_cl` is prepared and smoke-tested, while `ws_c1_cl` is materially stale.

These are distinct persistence-identity, provenance, sample-maturity, and business-identity issues. They must not be collapsed into a generic readiness flag or repaired by fabricated artifacts.

## Metadata authority

- Direct Macrobond exact lookups confirm the intended business currency, source, frequency, and unit for all eleven series.
- The canonical history endpoint previously ignored Macrobond `DisplayUnit`; this is why all eleven `market_series.unit` values were null even though exact provider metadata contained `USD/Barrel`, `USD/lb`, `USD/Metric Ton`, `EUR/Metric Ton`, or `Index`.
- Commit `788c720abad2c2c98a22a7fe5cbf12f86137f2d9` adds generic, provider-driven metadata enrichment and converts `Currency Unit/...` to the exact currency-aware unit. It contains no selected-series branching.
- Commit `d24477b0f50d5502d0bb72517b8a99c5cea4c4f0` adds an arbitrary-list, bounded-concurrency operator entry point over the existing canonical provider and repository owner. It contains no selected-series branching.
- Commits `f1ca0ba3b183c3c1e7dce0873e932e3cba25812d` and `4fd33ec401379e3587d5801b005772e89f6738a6` extend the same generic enrichment to exact provider display titles and human-readable source labels.
- All eleven series were rehydrated through that canonical path with concurrency 2. The final operation completed in 5.842 seconds with 11 successes and 0 failures.
- A subsequent Neon SELECT confirmed exact business labels, source frequency, currency and unit for all eleven records, their unchanged latest dates, and zero duplicate timestamps. No direct SQL write was used.

## Rolling Daily calibration readiness

The controlled canonical bootstrap increased calibrated Rolling Daily identities from 112/160 to 140/160. All 28 recoverable missing identities were prepared; seven bounded operator executions completed successfully, persisted 210 new historical origins, and refreshed 28 calibration groups. No execution failed and no duplicate compute was observed.

| Series | Calibrated identities | Minimum ready sample count | Remaining gap |
|---|---:|---:|---|
| `b_c1_cl` | 16/16 | 30 | none |
| `bz_c1_cl` | 16/16 | 428 | none |
| `cl_c1_cl` | 16/16 | 31 | none |
| `ehr2027g_cl` | 4/16 | 30 | 3M, 6M and 12M have zero lawful residuals for every model |
| `hg2027g_cl` | 16/16 | 30 | none |
| `hg_c1_cl` | 16/16 | 30 | none |
| `lmeofcucashask` | 16/16 | 432 | none |
| `lmescusd20270226` | 8/16 | 30 | 6M has 13 residuals and 12M has zero for every model |
| `qm_c1_cl` | 16/16 | 31 | none |
| `wocaes0074` | 16/16 | 443 | none |

The final `hg_c1_cl` ARIMA operation completed in 5,006,624 ms with 30 new origins, four refreshed calibration groups, one refreshed Current snapshot, matched persistence parity, and no error. The post-run Neon SELECT confirmed `AVAILABLE` with 31 residuals for ARIMA at 1M, 3M, 6M and 12M. Render returned to idle CPU and approximately 164 MB memory on the same single instance, and no forecast-compute process remained.

The remaining 20 identities are structural short-history gaps, not preparation failures. They were not filled by lowering the accepted 30-residual calibration requirement or by fabricating artifacts. The production schema also lacks the durable execution-ledger table; the canonical operation still emitted a single owner execution identity, but no schema migration was authorized or attempted.

## Client UI and prepared-read proof

- The actual production Dashboard was used for all eleven supported paths.
- Forecast, Upper, Lower, and Historical Verification were visible where the selected capability supplies them.
- All four equal models were explicitly switched on a representative prepared series; no champion or recommended model was introduced.
- No technical error appeared and the browser console remained clear.
- Observed Dashboard requests returned HTTP 200 in approximately 10–1980 ms.
- In the final post-hydration smoke window `2026-09-16T20:25:29Z/2026-09-16T20:25:45Z`, HWWI first returned the expected non-daily guidance for Point in Time and then rendered the prepared End of Period forecast, upper/lower bands, and Historical Verification. All Dashboard and SG Runtime requests were GET with HTTP 200; the SG Runtime capability read completed in 137 ms.
- No POST request, preparation route invocation, or SG Runtime production-compute log was observed during the final UI smoke window.
- After the final calibration bootstrap, the actual Dashboard rendered `hg_c1_cl` across all four models under Rolling Daily and across all three methodologies under ARIMA. The final selected view was ARIMA, Rolling Daily, 12M and visibly contained Forecast, Upper, Lower and Historical Verification.
- During the final `2026-09-17T00:41:34Z/2026-09-17T00:42:16Z` smoke window, SG Runtime recorded four capability GET requests with HTTP 200 in 1,839-2,282 ms. Market data came from PostgreSQL cache hits with zero provider hydration. A targeted Render log audit through `2026-09-17T00:46:40Z` found no POST and no Rolling Daily compute event.
- Therefore the tested UI paths used prepared artifacts and did not make the client the bootstrap trigger.

## Recommended decision

For tomorrow's demo, the lowest-risk lawful option is to approve the fresh `qm_c1_cl` substitute and constrain each benchmark to capabilities that are already prepared and visibly verified. Formal `FAST_READY` cannot be claimed until the versioned training-policy identity migration is separately risk-reviewed and authorized. If the business contract still requires all three methodologies for every series, additional financial-methodology work is required and the demo cannot yet be declared ready.

## Safety and continuity

- `DEMO_ONLY_SOURCE_CODE_CREATED = NO`
- `SERIES_SPECIFIC_FORECAST_LOGIC_CREATED = NO`
- `MANUAL_FORECAST_ARTIFACT_SQL_USED = NO`
- `SECOND_FORECAST_ENGINE_CREATED = NO`
- `CANONICAL_INGESTION_REUSED = YES`
- `CANONICAL_PPF_PREPARATION_REUSED = YES`
- `BATCH_PREPARATION_GENERIC = YES`
- `BATCH_PREPARATION_IDEMPOTENT = YES`
- `FULL_PPF1_REUSE_PRESERVED = YES`
- `STAGE_12_MODIFIED = NO`
- `STAGE_12_COMPLETION_CLAIMED = NO`

PMOS save and PHR publication remain deferred to the owner-requested aggregate closeout after the complete demo-readiness workstream. No pending artifact was created manually.
