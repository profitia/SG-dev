# PPF-1 Demo Task 4 — Eleven-benchmark production readiness

## Verdict

`TASK_4_GATE = PARTIAL_AWAITING_OWNER_DECISION`

`DEMO_ELEVEN_BENCHMARKS_READY = NO`

`PREPARED_SUPPORTED_DEMO_PATHS_READY = YES`

Both canonical services are live at `9a0ce6bce2c12fd87dd95e9b1204577a40ad8aa4`, their auto-deploy setting is disabled, and all eleven supported client paths passed a production UI smoke test as prepared reads. The strict contract requiring every benchmark to expose all four models under all three methodologies is not yet met, so this evidence deliberately does not declare final demo readiness.

## Live authorities

- SG Runtime: `spendguru-stage`, service `srv-d98a73btqb8s73fabp90`, deploy `dep-dale0iu1egvs73e93mv0`, status `live`.
- Dashboard: `dashboards-library`, service `srv-da2i7j9t0dsc73ag7qv0`, deploy `dep-dale0vm5vjqs73f2e22g`, status `live`.
- Persistence: Neon project `autumn-waterfall-65938876`, branch `br-purple-shape-b2az1npx`, database `neondb`; verification was SELECT-only.
- Frozen Stage 12 reference remains `2f0e93c828fef22241affd4b703fc139b1759ca8` and was not modified.

## Prepared benchmark paths

| Series | Intended demo identity | History through | Period Current | Period Recent Verification | Rolling Daily | Supported UI smoke |
|---|---|---:|---:|---:|---:|---:|
| `b_c1_cl` | ICE Brent 1st Position | 2026-09-15 | 8/8 | 8/8 | 4/4 | PASS |
| `cl_c1_cl` | CME WTI Physical 1st Position | 2026-09-15 | 8/8 | 8/8 | 4/4 | PASS |
| `wocaes0074` | Brent Spot FOB North Sea | 2026-09-15 | 8/8 | 8/8 | 4/4 | PASS |
| `hg2027g_cl` | CME Copper Feb 2027 | 2026-09-15 | 8/8 | 8/8 | 4/4 | PASS |
| `lmeofcucashask` | LME Copper Cash | 2026-09-15 | 8/8 | 8/8 | 4/4 | PASS |
| `ehr2027g_cl` | North European HRC Feb 2027 | 2026-09-15 | 8/8 | 2/8 | 4/4 | PASS |
| `hwwi_gb_ironsteel_2021_eur` | HWWI Iron and Steel Index | 2026-08-31 | EOP 4/4 | EOP 4/4 | unsupported | PASS |
| `lmescusd20270226` | LME Steel Scrap Feb 2027 | 2026-09-15 | 8/8 | 8/8 | 4/4 | PASS |
| `bz_c1_cl` | ICE Brent continuation | 2026-09-15 | 0/8 | 0/8 | 4/4, calibrated | PASS |
| `hg_c1_cl` | Copper continuation | 2026-09-15 | 8/8 | 8/8 | 4/4 | PASS |
| `qm_c1_cl` | NYMEX E-mini Crude continuation candidate | 2026-09-15 | 8/8 | 8/8 | 4/4 | PASS |

For period methods, 8/8 means four equal models under Monthly Average and End of Period. For HWWI only End of Period is lawful and supported. `qm_c1_cl` remains a candidate pending owner approval; the exact financial WTI continuation `ws_c1_cl` is stale at 2017-07-20 and is not safe for the demo.

## Exact remaining gaps

1. `bz_c1_cl` has current lawful daily history and a fully prepared, calibrated Rolling Daily path, but canonical period preparation fails all eight variants with `DATA_NOT_AVAILABLE`.
2. `hwwi_gb_ironsteel_2021_eur` is ready for End of Period. Monthly Average fails closed with `PROVENANCE_REQUIRED`; Point in Time is unsupported for this monthly series.
3. `ehr2027g_cl` has all eight period Current Forecast variants and all four Rolling Daily models. Its six closed monthly observations produce period Recent Verification only for Naive; Damped Holt, ETS, and ARIMA need one more closed month to create a lawful matured verification origin under `ADAPTIVE_SHORT_HISTORY_V1`.
4. The fresh WTI continuation substitute is not yet a business decision. `qm_c1_cl` is prepared and smoke-tested, while `ws_c1_cl` is materially stale.

These are distinct capability, provenance, sample-maturity, and business-identity issues. They must not be collapsed into a generic readiness flag or repaired by fabricated artifacts.

## Client UI and prepared-read proof

- The actual production Dashboard was used for all eleven supported paths.
- Forecast, Upper, Lower, and Historical Verification were visible where the selected capability supplies them.
- All four equal models were explicitly switched on a representative prepared series; no champion or recommended model was introduced.
- No technical error appeared and the browser console remained clear.
- Observed Dashboard requests returned HTTP 200 in approximately 10–1980 ms.
- No POST request, preparation route invocation, or SG Runtime production-compute log was observed during the final UI smoke window.
- Therefore the tested UI paths used prepared artifacts and did not make the client the bootstrap trigger.

## Recommended decision

For tomorrow's demo, the lowest-risk lawful option is to approve the fresh `qm_c1_cl` substitute and constrain each benchmark to capabilities that are already prepared and verified. If the business contract still requires all three methodologies for every one of the eleven series, additional financial-methodology and data-provenance work is required and the demo cannot yet be declared ready.

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
