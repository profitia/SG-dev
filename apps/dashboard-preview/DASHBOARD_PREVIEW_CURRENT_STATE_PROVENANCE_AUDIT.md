# Dashboard Preview Current-State & Provenance Audit

## 1. Audit Scope

This audit determines what the current localhost dashboard on port 3000 actually is, where the present `apps/dashboard-preview` tree came from, whether it is the newest legitimate Dashboard Preview implementation, whether a newer or more canonical candidate exists elsewhere, and whether a safe Git recovery checkpoint can be created now.

This audit is read-only with respect to product code. No Dashboard source was restored, migrated, committed, tagged, reset, or checked out. The only allowed write artifact is this audit report.

## 2. Current Localhost Identity

- Exact path: `/Users/tomaszuscinski/Documents/Visual Code Studio/SG-dev/apps/dashboard-preview`
- Process: `node` PID `76132`
- Command identity: `next-server (v14.2.29)` listening on `*:3000`
- Entry point: built Next.js production server started from the current working directory above

Observed runtime facts:

- `lsof -nP -iTCP:3000 -sTCP:LISTEN` shows the listener on port `3000`
- `ps` identifies the process as `next-server (v14.2.29)`
- `lsof -a -p 76132 -d cwd` resolves the process working directory to `SG-dev/apps/dashboard-preview`

Conclusion: current localhost is definitely being served from the physical `SG-dev/apps/dashboard-preview` directory, not from `.tmp-sg2-dashboard-preview-repair`.

## 3. Current Dashboard Functional State

- Historical data source: Prisma-backed local dashboard API reading `DrDashboardIndexRecord`
- Forecast source: provider or legacy dashboard forecast values persisted in the same dashboard data store and exposed through `/api/series`
- Forecast verification source: Prisma-backed local dashboard API reading `DrForecastAccuracyRecord`
- Confidence bounds source: `lciValue` and `uciValue` mapped into forecast lower and upper bands
- Benchmark identity model: UI-level component selection resolves to benchmark codes such as `wocaes0282`; the API path is benchmark-code driven rather than display-name driven

Evidence recovered from the running build:

- `.next/server/chunks/module-8646.pretty.js` reads `drDashboardIndexRecord.findMany`
- `.next/server/chunks/extract-series-module-256.pretty.js` builds `historical`, `forecast.central`, `forecast.upper`, and `forecast.lower`
- `.next/server/chunks/module-5111.pretty.js` maps `metricValue`, `lciValue`, `uciValue`, and `diff`
- `.next/server/chunks/extract-forecast-module-3087.pretty.js` reads forecast verification data from `drForecastAccuracyRecord`
- `.next/server/chunks/extract-forecast-module-692.pretty.js` maps forecast-vs-actual verification points and source metadata

Live payload validation:

- `/api/components` proves `FRACHT_CHINY_DRY` is a data-driven component that maps to benchmark code `wocaes0282`
- `/api/series?componentCode=wocaes0282&showForecast=true` returns historical rows plus forecast metadata and lower/upper bounds
- `/api/forecast-accuracy?componentCode=wocaes0282` returns source metadata for forecast verification, but the current dataset returned zero verification points for this benchmark at audit time
- searching the built page bundle for `FRACHT_CHINY_DRY` returned no hit, which rejects the hardcoded-frontend hypothesis

Classification:

- Current Dashboard forecast source: provider or legacy Snowflake-origin forecast persisted into the local dashboard store
- Current Dashboard historical forecast source: legacy persisted forecast verification surface, not the new Forecast Core under `tooling/Benchmark-Forecasting`
- Current Dashboard confidence bands source: persisted `lciValue` and `uciValue` values from the local dashboard store

## 4. Current Git State

- Repo HEAD: current `SG-dev` branch state was inspected in place; the dashboard-specific fact that matters is independent of the top-level dirty tree
- `apps/dashboard-preview` tracked state: `0` tracked files in the Git index
- `apps/dashboard-preview` untracked state: `195` untracked files
- `git status --short -- apps/dashboard-preview` reports `?? apps/dashboard-preview/`
- Last tracked Dashboard Preview commit in `SG-dev`: `6429e030880494c57ac271b06f2373e6b5bcf8c0` (`2026-07-11T09:43:32+02:00`, `Add dashboard preview app`)
- Revert commit removing that tracked app: `ac8bb4e0100b656df110afbf088ce7e5709e2fa2` (`2026-07-11T09:48:47+02:00`, `Revert "Add dashboard preview app"`)
- Existing stable tag: none found for `dashboard-preview-v1-stable`
- Relevant branches in `SG-dev` include `main`, `develop`, `staging`, `feature/pcos-explorer-render-preview`, and remote refs related to historical dashboard sourcing, but the current physical dashboard tree is not tracked by any present `SG-dev` branch tip

Conclusion: the running `apps/dashboard-preview` tree is not a restorable Git state in the current `SG-dev` checkout.

## 5. Dashboard Preview Git History

Tracked `SG-dev/apps/dashboard-preview` history recovered from the Git path log:

1. `d238f04f1c9155f71c58ad7ecf7b1663fd665f5a` (`2026-07-10T09:50:19+02:00`) `Add dashboard preview app for Render`
2. `327ff3402743d71653e48ab5e662d1c3094aab54` (`2026-07-10T09:55:57+02:00`) `Revert "Add dashboard preview app for Render"`
3. `6429e030880494c57ac271b06f2373e6b5bcf8c0` (`2026-07-11T09:43:32+02:00`) `Add dashboard preview app`
4. `ac8bb4e0100b656df110afbf088ce7e5709e2fa2` (`2026-07-11T09:48:47+02:00`) `Revert "Add dashboard preview app"`

Implications:

- `SG-dev` definitely contained a real tracked authored Dashboard Preview app historically
- that tracked app was definitely removed by revert
- the current physical tree under the same path is therefore not simply the present tracked continuation of the old `SG-dev` app

## 6. Current Tree Provenance

Classification: PROBABLE

Evidence:

- The current localhost tree is definitely untracked residue in `SG-dev`, because Git shows `0` tracked files and `195` untracked files for the path
- The current tree contains `.next`, `node_modules`, `tsconfig.tsbuildinfo`, `.env.local`, generated Prisma client output under `src/generated/prisma`, and the ownership canon file, but it does not contain a normal authored source surface such as `app/`, `components/`, `lib/`, `messages/`, `tests/`, `prisma/`, or `package.json`
- The last tracked authored app in `SG-dev` was commit `6429e03`, and a direct recursive comparison against `.tmp-sg2-dashboard-preview-repair` shows nearly the same source surface plus later evolved files in `.tmp`
- Important shared lineage indicators include matching app structure, matching API surfaces, matching viewer transformation layers, matching localization surfaces, and matching test surface categories
- Important later-evolution indicators in `.tmp` include changed `app/[locale]/page.tsx`, `components/dashboard-shell/index.tsx`, `components/raw-data-view/index.tsx`, `lib/time-series/series-query.ts`, `lib/time-series-viewer/time-series-viewer-contract.ts`, `messages/en.json`, `messages/pl.json`, `next.config.mjs`, `package.json`, and extra `lib/time-series-viewer/forecast-accuracy-to-time-series-viewer.ts`

Assessment:

- Current untracked tree is not identical to the last tracked historical `SG-dev` state
- Current untracked tree is best explained as a runnable build residue snapshot derived from the same dashboard lineage, not as an unrelated codebase
- Because the authored source is missing from the current `SG-dev` path, provenance is not KNOWN in the strong restorable-Git sense; it is PROBABLE through converging structural and historical evidence

## 7. Other Dashboard Implementations Found

### Candidate A: `.tmp-sg2-dashboard-preview-repair`

- Path: `/Users/tomaszuscinski/Documents/Visual Code Studio/.tmp-sg2-dashboard-preview-repair`
- Branch: `main`
- Local HEAD: `b0f84677902ad39f4ce3df4514c4da70bb991b07`
- Date: `2026-08-13T10:00:32+02:00`
- Functional summary: full standalone Next.js authored dashboard app with `app/`, `components/`, `i18n/`, `lib/`, `messages/`, `prisma/`, `tests/`, `docs/`, `runtime/`, `package.json`, `render.yaml`, and its own Git history
- Relationship to current tree: same dashboard lineage as historical `SG-dev` commit `6429e03`, but later evolved and still editable

Key local history on this candidate:

1. `ec323f1caf7a186ca4433edd863bac78396f8a12` (`2026-08-12T21:03:58+02:00`) `Add universal benchmark analytics handoff`
2. `b6c8ec29b3fef0f2116cf9a8d0621655aa0947b9` (`2026-08-13T09:17:42+02:00`) `Stabilize benchmark range requests`
3. `b0f84677902ad39f4ce3df4514c4da70bb991b07` (`2026-08-13T10:00:32+02:00`) `Add embedded dashboard preview mode`

### Candidate B: upstream `origin/main` of `.tmp-sg2-dashboard-preview-repair`

- Path: same repository as Candidate A
- Branch: `origin/main`
- Commit: `c45d257d268385538110738288af07942fd704a1`
- Date: `2026-08-14T08:13:57+02:00`
- Functional summary: newer upstream continuation of the same authored Dashboard Preview line
- Relationship to current tree: newer than local `.tmp` HEAD and therefore newer than any evidence present in current `SG-dev/apps/dashboard-preview` residue

Observed ahead commits over local `.tmp` `main`:

1. `bece5aed1b9748ae25062a22b681eb149d8a8aba` (`2026-08-14T08:11:50+02:00`) `Stage 4C benchmark preload and cache`
   - touches `app/[locale]/page.tsx`, `components/raw-data-view/index.tsx`, and `lib/time-series/series-query.ts`
2. `c45d257d268385538110738288af07942fd704a1` (`2026-08-14T08:13:57+02:00`) `Force request-time benchmark preload`
   - touches `app/[locale]/page.tsx`

Assessment of candidates:

- Candidate A is already more canonical and more editable than the current `SG-dev` residue tree
- Candidate B is the newest known upstream continuation discovered during this audit

## 8. Newer Candidate Assessment

State: NEWER CANONICAL CANDIDATE FOUND

Evidence:

- local `.tmp-sg2-dashboard-preview-repair` `main` is behind `origin/main` by `2` commits
- those two commits touch active dashboard application surfaces rather than unrelated repo areas
- the same repository declares package identity `@sg/dashboard-preview` and contains the authored implementation surface absent from `SG-dev/apps/dashboard-preview`

Conclusion: the newest known legitimate candidate identified during this audit is not the current `SG-dev/apps/dashboard-preview` residue tree and not even the local `.tmp` checkout, but `origin/main` of the `.tmp-sg2-dashboard-preview-repair` repository line.

## 9. Current Localhost Classification

State: PROBABLE LEGACY

Reasoning:

- it runs and serves real local dashboard data
- it is not represented as a tracked, reproducible, restorable Git state in `SG-dev`
- it lacks the authored source tree required for safe preservation and future controlled evolution
- a later authored implementation lineage exists elsewhere and is newer than the current residue

Current localhost should therefore not be treated as the current canonical dashboard baseline solely because it starts successfully.

## 10. Forecast Source Classification

- Current forecast: provider or legacy Snowflake-origin forecast values persisted into the dashboard data store and surfaced through `/api/series`
- Historical forecast: legacy persisted verification surface derived from `DrForecastAccuracyRecord`, not the new Forecast Core under `tooling/Benchmark-Forecasting`
- Upper/lower bounds: persisted confidence band values from `lciValue` and `uciValue`

Negative classification:

- no evidence found that the running localhost dashboard is currently reading forecast output from the new Forecast Core
- no evidence found that the running dashboard is static or mock-driven for the audited benchmark path

## 11. Ownership Canon Status

- Present: yes
- File: `apps/dashboard-preview/DASHBOARD_PREVIEW_OWNERSHIP_CANON.md`
- Status: architecturally relevant, but not sufficient as provenance proof for the surrounding physical tree

Assessment:

- The canon still captures the intended ownership boundary and Forecast UX direction
- However, the current `SG-dev/apps/dashboard-preview` directory is an untracked residue tree, so the presence of the canon file inside that directory does not by itself prove that the whole directory is the authoritative authored implementation
- Canonical path and actual editable source have drifted apart

## 12. Safe Recovery Checkpoint Status

State: REQUIRES BASELINE ESTABLISHMENT

Reasoning:

1. the current localhost residue is not reproducibly represented in Git
2. there is no existing `dashboard-preview-v1-stable` tag
3. the most credible authored implementation candidate is outside the current `SG-dev/apps/dashboard-preview` residue tree
4. a newer known upstream candidate exists beyond local `.tmp` HEAD

Additional PMOS caveat:

- runtime `npm run pmos:status` reported `handoff: PASS | pending-artifact=clear`
- direct shell checks from `apps/pmos` confirmed that `.pmos/pending-artifact.json` is currently absent in the runtime-visible filesystem
- an earlier out-of-band read surfaced stale artifact content under that path, but that state could not be reproduced by direct shell inspection and should not be treated as the live PMOS slot state for closeout purposes

That PMOS observation does not change the dashboard provenance finding. The blocker remains the missing intentional Git baseline for Dashboard Preview, not an occupied live PMOS handoff slot.

## 13. Recommended Canonical Baseline

Recommended baseline candidate:

- Path: `/Users/tomaszuscinski/Documents/Visual Code Studio/.tmp-sg2-dashboard-preview-repair`
- Branch: `origin/main`
- Commit: `c45d257d268385538110738288af07942fd704a1`
- Reason: newest known authored Dashboard Preview implementation discovered during the audit; same lineage as the historically tracked `SG-dev` dashboard app; newer than local `.tmp` HEAD; more canonical than the current untracked `SG-dev` residue because it is represented in Git and has a restorable authored source tree

Important constraint:

- this audit does not restore, migrate, copy, or adopt that candidate automatically
- the user must intentionally choose whether that upstream-authored candidate becomes the canonical recovery baseline

## 14. Recommended Next Action

No implementation should proceed yet.

Recommended next action:

1. explicitly choose the canonical Dashboard Preview baseline from the authored Git lineage rather than from the current localhost residue
2. if the chosen baseline is the `.tmp` lineage, resolve whether local `.tmp` HEAD or `origin/main` commit `c45d257d268385538110738288af07942fd704a1` is the intended preservation point
3. only after that baseline is intentionally established in a reproducible Git state should a stable checkpoint such as `dashboard-preview-v1-stable` be considered
4. only after that decision should `Forecast Portfolio v1 + Dashboard Integration Contract` resume

## Audit Outcome Summary

- Current localhost source path: `SG-dev/apps/dashboard-preview`
- Current localhost classification: PROBABLE LEGACY
- Current tree provenance: PROBABLE
- Newer canonical candidate: YES
- Safe recovery checkpoint: REQUIRES BASELINE ESTABLISHMENT
- Code changes: NONE
- Git write operations: NONE