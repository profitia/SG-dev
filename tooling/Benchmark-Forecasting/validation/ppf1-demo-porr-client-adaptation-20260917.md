# PORR client adaptation evidence — 2026-09-17

## Decision

The dedicated PORR client now reads persisted forecast artifacts without requesting interactive preparation. All eleven selected benchmark paths passed a client-facing smoke test with a visible current forecast, Upper and Lower bands, and factual historical verification on a lawful methodology path.

This is a demo-readiness result. It does not complete or modify the frozen PPF-1 Stage 12 acceptance workstream.

## Implemented changes

- SG Runtime benchmark analytics no longer enables forecast warm-up implicitly for the PORR profile. The warm-up query flag is emitted only for an explicit operator experiment.
- The Dashboard expands a short chart range to 3Y when Historical Verification is enabled, so prepared comparison records from 2024 are visible instead of appearing absent.
- Both changes are generic and data-driven. No selected `seriesId` is embedded in production logic.

## Published revisions

| Surface | Service | Deployed commit | Deploy | State |
| --- | --- | --- | --- | --- |
| PORR client / SG Runtime | `spendguru-porr-demo` | `e70d43a9eef107a396835541af1d8651d58d7e7e` | `dep-dall74u5vjqs73fpuek0` | live, auto-deploy off |
| PORR Dashboard | `spendguru-porr-dashboard` | `35f2cff318df9b6b14fbe04d917e15eeafddeea7` | `dep-dall2jjl550s73bl58sg` | live, auto-deploy off |

## Client smoke result

The tested set was:

`b_c1_cl`, `cl_c1_cl`, `wocaes0074`, `hg2027g_cl`, `lmeofcucashask`, `ehr2027g_cl`, `hwwi_gb_ironsteel_2021_eur`, `lmescusd20270226`, `bz_c1_cl`, `hg_c1_cl`, `qm_c1_cl`.

All eleven paths rendered prepared Current Forecast output, Upper and Lower bands, and Historical Verification. The five short-history series that previously appeared to lack verification now reveal 29–30 prepared comparison points after the generic 3Y range adjustment.

A final client read for `wocaes0074` showed:

- all four model controls;
- all three methodology controls;
- Current Forecast and a 12M path;
- Upper and Lower bands;
- Historical Verification;
- no queue message, preparation action, or technical error.

From `2026-09-17T02:45:42Z` to `2026-09-17T02:46:36Z`, the new runtime instance recorded one PostgreSQL cache-hit history read and no forecast prepare route, progressive route, Rolling Daily maintenance, Rolling Daily production operation, or error. No production forecast compute was observed.

## Lawful limitations retained

- `hwwi_gb_ironsteel_2021_eur` is monthly-source data and is demonstrated through `END_OF_PERIOD`; Rolling Daily is not fabricated.
- `ehr2027g_cl` does not yet contain enough closed monthly periods for non-Naive period verification; its available Rolling Daily verification remains factual.
- `lmescusd20270226` has uncertainty calibration for the lawful 1M and 3M horizons; longer calibrated horizons are not fabricated.

Therefore the client paths pass, while strict readiness of every model × methodology identity remains false where source history makes that identity mathematically unavailable.

## Validation and boundaries

- SG Runtime targeted tests: 4/4 pass; typecheck pass.
- Dashboard targeted tests: 44/44 pass; typecheck pass.
- Neon use: SELECT-only; no database or forecast-artifact writes.
- No demo-only source code, series-specific forecast logic, manual forecast SQL, or second engine was created.
- The frozen Stage 12 branch and services were not modified, and Stage 12 completion is not claimed.
- Aggregate PMOS/PHR closeout remains deferred by the business owner until the complete demo workstream closeout.
