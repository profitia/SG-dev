# SGPORR / SpendGuru 2.0 — operator runbook for the 2026-09-17 demo

## Frozen production authority

- Dashboard source SHA: `9a0ce6bce2c12fd87dd95e9b1204577a40ad8aa4`.
- SG Runtime source SHA: `4fd33ec401379e3587d5801b005772e89f6738a6`.
- Dashboard deploy: `dep-dale0vm5vjqs73f2e22g`, status `live`.
- SG Runtime deploy: `dep-dalfs8id0e5s73f8r0sg`, status `live`.
- Auto-deploy is disabled for both services.
- Do not deploy, reconfigure, hydrate, prewarm, or run preparation during the client session.
- Do not add `progressivePreparation=1` or any other preparation flag to a demo URL.

## Five-minute pre-demo check

1. Open the production Dashboard in a clean browser tab.
2. Open `wocaes0074` and confirm that Rolling Daily / ARIMA displays Forecast, Upper, Lower, and Historical Verification.
3. Switch to Naive, Damped Holt, ETS, and back to ARIMA. Each switch must remain a prepared read and must not show a technical error.
4. Open `hg_c1_cl`, select Rolling Daily / ARIMA / 12M, and confirm Forecast, Upper, Lower, and Historical Verification. This exact path passed the final post-bootstrap smoke.
5. Open `hwwi_gb_ironsteel_2021_eur`, select End of Period, and confirm the same four model choices.
6. Open `bz_c1_cl`; confirm Rolling Daily, Monthly Average, and End of Period across all four models.
7. If any prepared path is unavailable, do not press a preparation action during the meeting. Move to the fallback benchmark and record the exact series, model, and methodology after the meeting.

## Safe presentation path

| Order | Series | Client-facing story | Methodology to use | Models |
|---:|---|---|---|---|
| 1 | `b_c1_cl` | ICE Brent 1st Position | Rolling Daily; Monthly Average; End of Period | all four |
| 2 | `cl_c1_cl` | CME WTI Physical 1st Position | Rolling Daily; Monthly Average; End of Period | all four |
| 3 | `wocaes0074` | Brent Spot FOB North Sea | Rolling Daily; Monthly Average; End of Period | all four |
| 4 | `hg2027g_cl` | CME Copper February 2027 | Rolling Daily; Monthly Average; End of Period | all four |
| 5 | `lmeofcucashask` | LME Copper Cash | Rolling Daily; Monthly Average; End of Period | all four |
| 6 | `ehr2027g_cl` | North European HRC February 2027 | Rolling Daily for all four (calibrated bands at 1M only); period Current for all four; period Verification only for Naive | as stated |
| 7 | `hwwi_gb_ironsteel_2021_eur` | HWWI Iron and Steel Index | End of Period only | all four |
| 8 | `lmescusd20270226` | LME Steel Scrap February 2027 | Rolling Daily (calibrated bands at 1M and 3M); Monthly Average; End of Period | all four |
| 9 | `bz_c1_cl` | ICE Brent continuation | Rolling Daily; Monthly Average; End of Period | all four |
| 10 | `hg_c1_cl` | Copper continuation | Rolling Daily; Monthly Average; End of Period | all four |
| 11 | `qm_c1_cl` | current crude-oil continuation fallback candidate | Rolling Daily; Monthly Average; End of Period | all four |

The eleventh row must not be described as the exact WTI financial continuation until the owner approves that business substitution. The exact candidate `ws_c1_cl` is stale at 2017-07-20.

## What the presenter may say

- All four models are equal choices: Naive, Damped Holt, ETS, and ARIMA.
- The central forecast and its Lower and Upper bands come from persisted prepared artifacts.
- Historical Verification shows how forecasts generated from earlier lawful cutoffs compare with observations that became available later.
- A visible band may be model-native when fewer than 30 comparable residuals exist. Call a band calibrated only when the interface or evidence confirms at least 30 comparable residuals.
- Full Historical Verification may still enrich in the background; Current Forecast and Recent Verification do not depend on that enrichment unless explicitly stated.

## What the presenter must not say

- Do not claim that a model is the champion, preferred model, automatic winner, or recommendation.
- Do not claim calibrated uncertainty merely because Lower and Upper are visible.
- Do not claim all three methodologies for HWWI.
- Do not claim complete period Recent Verification for HRC beyond Naive.
- Do not describe Rolling Daily bands beyond 1M for HRC or beyond 3M for LME Steel Scrap as calibrated; their lawful history does not yet provide 30 comparable residuals at longer horizons.
- Do not claim PPF-1 Stage 12 or full PPF-1 production completion.

## Fallback order

1. If a continuation benchmark fails, use its prepared non-continuation counterpart: `bz_c1_cl` → `b_c1_cl`; `hg_c1_cl` → `lmeofcucashask`; crude-oil fallback → `cl_c1_cl`.
2. If a period method is unavailable, return to Rolling Daily for a daily series or End of Period for HWWI.
3. If Historical Verification is unavailable for a short-history period variant, show Current Forecast and its bands, then use a long-history peer to demonstrate Historical Verification.
4. If the page becomes unresponsive, refresh once. If the prepared path still fails, move to the next benchmark; do not invoke preparation during the client session.

## Post-demo incident record

For any failure record:

- exact `seriesId`;
- selected model;
- selected methodology;
- local Warsaw time;
- visible business message;
- HTTP status if available;
- whether Current Forecast, Lower, Upper, and Historical Verification were visible;
- whether a refresh changed the result.

Do not repair forecast artifacts manually in Neon. Any later repair must reuse canonical ingestion and SG Runtime preparation ownership.
