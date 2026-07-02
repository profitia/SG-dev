# SG2 PCOS Explorer UI Stabilization Implementation

## 1. Executive summary

This task stabilized the local UX/UI shell of `apps/pcos-explorer` so the dashboard can be evaluated as a coherent dark technical interface instead of partially unstyled HTML.

The most important fix was not visual redesign, but restoring the missing CSS processing path for the app by adding a local `postcss.config.mjs` compatible with Tailwind v4. Once utility classes started compiling correctly, the shell, sidebar, cards, listing and dataset detail views could be refined with small, local component updates.

The result is a more readable local dashboard across:

- `/`
- `/datasets`
- `/datasets/normalized_cost_components_mock`
- `/datasets/sync_metadata_mock`

## 2. Root cause

The problem was primarily a **CSS pipeline issue plus overly raw shell primitives**, not a missing data architecture feature.

Root cause breakdown:

- `apps/pcos-explorer/src/app/layout.tsx` already imported `globals.css`
- `apps/pcos-explorer/src/app/globals.css` already defined dark theme tokens and Tailwind theme variables
- component files already contained Tailwind utility classes
- but `apps/pcos-explorer` was missing its own local `postcss.config.mjs`

That meant the app visually behaved like utility classes were not being processed correctly in local preview, which matched the user-visible symptoms:

- default-looking links
- raw-looking layout
- broken visual hierarchy
- shell elements reading like plain HTML

After fixing the missing PostCSS/Tailwind processing surface, the remaining issues were mostly due to minimal dashboard primitives rather than missing CSS loading.

So the root cause was a **combination**, with a clear primary cause:

1. missing local CSS/PostCSS processing config
2. secondary need for shell-level polish in sidebar, cards, headers and dataset views

## 3. Files changed

| File | Change type | Purpose |
| --- | --- | --- |
| `apps/pcos-explorer/postcss.config.mjs` | Added | Restored local Tailwind v4 PostCSS processing for the app |
| `apps/pcos-explorer/src/app/globals.css` | Updated | Improved shell-level global polish, selection, link defaults and sidebar width |
| `apps/pcos-explorer/src/app/layout.tsx` | Updated | Strengthened the global dashboard shell background and body styling |
| `apps/pcos-explorer/src/components/nav/sidebar.tsx` | Updated | Improved sidebar hierarchy, spacing, header identity and nav readability |
| `apps/pcos-explorer/src/components/ui/card.tsx` | Updated | Upgraded dashboard card primitives and stat cards |
| `apps/pcos-explorer/src/components/ui/page-header.tsx` | Updated | Made headers clearer, larger and more dashboard-like |
| `apps/pcos-explorer/src/components/ui/misc.tsx` | Updated | Improved empty states and small utility presentation |
| `apps/pcos-explorer/src/components/datasets/dataset-card.tsx` | Updated | Made dataset listing cards more readable and actionable |
| `apps/pcos-explorer/src/datasets/dataset-list-page.tsx` | Updated | Added better listing structure and selector context |
| `apps/pcos-explorer/src/datasets/dataset-page.tsx` | Updated | Improved dataset detail hierarchy, notices and layout grouping |
| `apps/pcos-explorer/src/components/datasets/dataset-table.tsx` | Updated | Improved table spacing, headers, hover states and empty state presentation |

## 4. UX improvements

### Global shell

Improved:

- wider sidebar
- more deliberate dark background
- stronger shell framing
- better header scale and content spacing
- removal of default link appearance through global anchor styling

### Sidebar

Improved:

- app identity block
- environment and org presentation
- nav spacing and grouping readability
- active and hover states
- more dashboard-like link rows
- clearer `Datasets` section with `All datasets` and mock dataset entries

### Root dashboard

Improved:

- local preview fallback now reads as an intentional notice card
- metric cards are visually grouped and readable
- empty states render cleanly instead of as loose text blocks

### Dataset listing `/datasets`

Improved:

- added selector context card at the top
- dataset cards are larger and easier to scan
- mock state, datasource and view-config metadata are clearer
- cards now include a clearer open action cue

### Dataset detail `/datasets/[datasetId]`

Improved:

- stronger header/action treatment
- clearer dataset shell context card
- better mock/quality notice block
- field metadata grouped into more readable cards
- right-side informational support blocks for filters and placeholder fields

### Table and summary cards

Improved:

- summary cards have stronger hierarchy and spacing
- table container looks like a dashboard panel
- table headers are clearer
- row separation and hover behavior are easier to read
- numeric columns remain right-aligned where configured

## 5. Scope confirmation

Confirmed not added in this task:

- No Snowflake integration
- No PostgreSQL read endpoint
- No Prisma schema changes
- No migrations
- No charting library
- No backend endpoints

This remained a local shell/UI stabilization task only.

## 6. Validation results

Commands executed:

1. `cd apps/pcos-explorer && npm run typecheck`
   - PASS

2. `cd apps/pcos-explorer && npm run build`
   - PASS

3. `cd apps/pcos-explorer && npm run dev`
   - PASS
   - Local URL: `http://localhost:3100`

Routes checked in local browser:

- `/`
- `/datasets`
- `/datasets/normalized_cost_components_mock`
- `/datasets/sync_metadata_mock`

Observed result:

- all four routes render
- sidebar is styled and readable
- dataset listing is card-based and scannable
- dataset details show notices, summary cards and table panels
- root page fallback remains readable when local Prisma source is unavailable

## 7. Known gaps

- still no live PostgreSQL-backed overview data in local preview when the read-only source is unavailable
- still no real dataset read model
- still no filters with interaction
- still no charts
- still no final BI/dashboard presentation layer
- still no public deployment changes from this task
