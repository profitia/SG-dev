## Stage 12 single-flight waiter publication evidence

This evidence bundle publishes the proven Stage 12 waiter corrective and the governed bounded catch-up outcome for task `ppf-1-stage-12-single-flight-waiter-publication-20260913`.

The original runtime artifacts were produced under `/tmp/stage12-bg-catchup/` during the validated catch-up run and post-fix Aluminium overlap proof, but those temporary files expired before publication. The files in this directory are transcript-derived evidence built from the same recorded session outputs rather than a rerun.

Published facts:

- Source corrective SHA: `d4ad71f5a4baf29afb74ba2311191a8ec8cb0896`
- Publication base SHA: `69f3b755317b6d51eaccd16e35412d028abfc99e`
- Bounded catch-up batch size: `maxOriginsPerRun = 50`
- Copper ARIMA PIT: `2024-01-25 -> 2026-09-11`, `14` runs, `665` origins advanced, final `READY/fullReady=true`, bounded `NO_OP` confirmed
- Aluminium ARIMA PIT: `2024-01-12 -> 2026-09-11`, `14` runs, `673` origins advanced, final `READY/fullReady=true`, bounded `NO_OP` confirmed
- Brent ARIMA PIT: remained `READY/fullReady=true`, no new background catch-up required
- Aluminium post-fix same-key overlap: one `OWNER`, one `WAITER`, both requests `SUCCEEDED`, checkpoint `2024-01-11 -> 2024-01-12`, rows `20 -> 24`

The manifest and transcript-derived JSON files in this subtree are the publication artifacts for this task.