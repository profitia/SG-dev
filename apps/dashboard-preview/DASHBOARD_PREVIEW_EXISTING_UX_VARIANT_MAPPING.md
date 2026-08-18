# Dashboard Preview Existing UX Variant Mapping

## 1. Purpose

This document maps the two known pre-registry Dashboard Preview UX working IDs to authored source states.

Its purpose is to separate:

- real authored provenance,
- behavioral resemblance observed on localhost,
- Git recovery state,
- and future formal UX registry work.

This document does not create a UX variant registry.

## 2. Terminology

`UX Variant` is not the same thing as `Git version`.

The required distinction is:

- `Git commit` or `Git tag` = exact recoverable source state
- `UX Variant` = parallel user-facing composition or experience carried by one or more source states

One UX variant may span multiple commits.

One commit may advance an existing UX variant without creating a new variant.

No claim in this document promotes a working ID to a Git naming scheme.

## 3. historical-v1

### Working ID

`historical-v1`

### Expected visual fingerprint

- `Obszar analityczny`
- `FRACHT_CHINY_DRY`
- `Pokaż prognozy`
- `Pokaż trafność prognoz`
- `Odchylenie %`
- `Historyczna prognoza`
- forecast horizon controls `1M / 3M / 6M / 12M`
- legacy `Forecast / LCI / UCI` style overlays

### Mapped source state

Best authored source state: `32c80e3b70cf5d3b8596ef8de88e0482853fd9f3`

- Commit date: `2026-07-15T18:09:43+02:00`
- Commit subject: `Stabilize forecast accuracy mobile layout`
- Additional anchor: annotated repository tag `dashboard-preview-import-baseline-2026-07-20`

### Provenance classification

`PROBABLE`

### Why this mapping

The authored lineage immediately below `32c80e3` contains the exact forecast-accuracy and historical-forecast interaction family that matches the known historical localhost experience:

- `0b7a5282283c62b1848a1e0d639aa113a0f15d92` adds historical forecast interactions and helpers
- `7dcdf8547929b7a71d396c71363c336ad5ffe0b8` refines the dashboard forecast accuracy UX around the time-series viewer adapter
- `9ed9b929e727b5728f237e2340c90b1b739cfd46` fixes historical forecast tooltip label typing
- `32c80e3b70cf5d3b8596ef8de88e0482853fd9f3` stabilizes the mobile layout for that same UX family

### Key files

- `components/raw-data-view/index.tsx`
- `lib/forecast-accuracy/historical-forecast-view.ts`
- `lib/time-series-viewer/forecast-accuracy-to-time-series-viewer.ts`
- `lib/time-series/series-query.ts`
- `app/globals.css`

### Route and component posture

- locale page driven Dashboard Preview surface
- non-embedded dashboard-first composition
- component-oriented flow rather than benchmark embed flow

### Data source

The authored source family matches the legacy local dashboard data path:

- historical series queried from the local dashboard APIs
- forecast overlays sourced from the same local dashboard dataset
- historical forecast verification sourced from the local forecast-accuracy API

This is consistent with the audited localhost runtime, which read from persisted dashboard data rather than from the new Forecast Core.

### Forecast behavior

- legacy persisted forecast overlays
- legacy LCI/UCI bounds overlays
- historical forecast-vs-actual verification interactions
- no evidence of Forecast Core integration

### Confidence of mapping

`PROBABLE`

### Missing or ambiguous elements

- no literal `historical-v1` identifier exists in source history
- no explicit variant registry or authored tag names this UX directly as `historical-v1`
- the mapping is behavior-derived from authored code and commit sequence, not from an explicit source label

## 4. finder-embedded-v2

### Working ID

`finder-embedded-v2`

### Expected visual fingerprint

- clean embedded benchmark chart
- benchmark title such as `Brent`
- Historical line
- range controls `3M / 6M / 1Y / 3Y / 5Y / ALL`
- business tooltip `WARTOŚCI BIZNESOWE`
- formatted value and unit
- actions such as `Rozpocznij budowę kategorii` and `Dodaj do porównania`
- embedding and universal handoff behavior

### Mapped source state

Best current authored UX state: `a39529dba13c161e84ef3877306148e21ecd3a89`

- Commit date: `2026-08-14T19:52:32+02:00`
- Commit subject: `Refine embedded dashboard mobile layout`

Repository tip equivalence:

- `origin/main` currently resolves to `266324b7e0afc9aae63d659463433271c68e53ce`
- `266324b7...` is an empty deploy-trigger commit and does not introduce additional Dashboard Preview source changes beyond `a39529d...`
- therefore the latest authored tree for this UX family is the `origin/main` tree, with `a39529d...` as the last content-changing Dashboard Preview commit

### Provenance classification

`PROBABLE`

### Why this mapping

The authored lineage for this UX is cumulative rather than one-commit-only:

- `ec323f1caf7a186ca4433edd863bac78396f8a12` introduces universal benchmark analytics handoff
- `b6c8ec29b3fef0f2116cf9a8d0621655aa0947b9` stabilizes benchmark range and display-name handling
- `b0f84677902ad39f4ce3df4514c4da70bb991b07` adds embedded route plumbing
- `bece5aed1b9748ae25062a22b681eb149d8a8aba` adds benchmark preload and server cache behavior
- `c45d257d268385538110738288af07942fd704a1` forces request-time preload and is the strongest preload-era baseline
- `2829ae7b0f2109d7ed0a1dab3d6ef0db4ec0b5a7` syncs the benchmark experience into a stripped chart-first embedded shell and adds parent resize messaging
- `a39529dba13c161e84ef3877306148e21ecd3a89` refines the embedded and mobile layout of the same UX family

### Key files

- `app/[locale]/page.tsx`
- `components/dashboard-shell/index.tsx`
- `components/raw-data-view/index.tsx`
- `lib/time-series/series-query.ts`
- `app/globals.css`
- `next.config.mjs`

### Embedded behavior

- benchmark-driven route via `seriesId`
- range handoff via `range`
- optional title handoff via `displayName`
- embedded rendering switch via `embed=1`
- chart-first shell for embedded use
- parent resize `postMessage` behavior in the later embedded family

### Benchmark-range behavior

- `ec323f1...` begins the benchmark analytics handoff path
- `b6c8ec2...` stabilizes benchmark range requests
- `c45d257...` is the last preload-era checkpoint before the later stripped embedded-shell refinements
- `2829ae7...` and `a39529d...` remain in the same UX family and do not constitute an unrelated experiment

### Data source and host-integration posture

- benchmark analytics handoff mediated through `lib/time-series/series-query.ts`
- host context passed as benchmark identity and display hints rather than as chart implementation details
- still not a Forecast Core integration surface

### Confidence of mapping

`PROBABLE`

### Missing or ambiguous elements

- no literal `finder-embedded-v2` identifier exists in source history
- no single commit introduces every visual fingerprint element atomically
- some observed product-facing labels and action copy belong to the same family but were not independently re-derived from a single explicit variant registry entry

## 5. Commit-to-UX Matrix

### historical-v1 family anchors

- `0b7a5282283c62b1848a1e0d639aa113a0f15d92` - historical forecast interactions and helpers appear
- `7dcdf8547929b7a71d396c71363c336ad5ffe0b8` - forecast accuracy UX is reorganized around the viewer adapter
- `9ed9b929e727b5728f237e2340c90b1b739cfd46` - tooltip typing fix in the same family
- `32c80e3b70cf5d3b8596ef8de88e0482853fd9f3` - stabilized snapshot of the same family; best authored mapping target

### finder-embedded-v2 family anchors

- `ec323f1caf7a186ca4433edd863bac78396f8a12` - finder handoff precursor begins
- `b6c8ec29b3fef0f2116cf9a8d0621655aa0947b9` - range request stabilization in the same family
- `b0f84677902ad39f4ce3df4514c4da70bb991b07` - first embedded route plumbing
- `bece5aed1b9748ae25062a22b681eb149d8a8aba` - preload and cache added to the embedded benchmark family
- `c45d257d268385538110738288af07942fd704a1` - strongest preload-era baseline for the family
- `2829ae7b0f2109d7ed0a1dab3d6ef0db4ec0b5a7` - stripped embedded shell and parent resize messaging added without leaving the same family
- `a39529dba13c161e84ef3877306148e21ecd3a89` - latest content-changing authored UX in the same family
- `266324b7e0afc9aae63d659463433271c68e53ce` - current `origin/main` tip, empty deploy-trigger commit, tree-equivalent to `a39529d...`

## 6. Current Localhost Relationship

The earlier localhost dashboard running from `SG-dev/apps/dashboard-preview` was behaviorally useful but not provenance-safe.

Observed relationship:

- it resembled the `historical-v1` family closely enough to support behavioral fingerprinting
- it used the same legacy persisted data family audited through `DrDashboardIndexRecord`, `DrForecastAccuracyRecord`, and `lciValue` or `uciValue`
- it did not provide authored source proof because the directory contained build artifacts, generated Prisma output, and runtime residue instead of `app/`, `components/`, `lib/`, `messages/`, `prisma/`, and `tests/`

Conclusion:

- localhost residue can support behavioral observation
- localhost residue cannot serve as canonical authored proof
- no authored source unique to the residue was found during baseline establishment

## 7. Mapping Conclusion

Final provenance classifications:

- `historical-v1` = `PROBABLE`
- `finder-embedded-v2` = `PROBABLE`

No mapping was promoted to `KNOWN` because:

- there is no explicit variant registry in the recovered source history
- neither working ID appears as a literal source-level identifier
- the mappings are supported by authored code, commit sequence, and behavioral fit rather than by an explicit variant label