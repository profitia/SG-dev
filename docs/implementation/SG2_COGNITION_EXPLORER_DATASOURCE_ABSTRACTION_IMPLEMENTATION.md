# SG2 Cognition Explorer Datasource Abstraction Implementation

## 1. Executive summary

Implemented a minimal datasource abstraction in `apps/pcos-explorer` to let the existing Explorer shell render datasets through a new path: `dataset -> datasource adapter -> view config -> renderer`.

This change adds a parallel dataset layer without altering the current `domain -> query -> renderer` model used by existing cognition domains. The new layer is bootstrapped with a single mock dataset, `normalized_cost_components_mock`, and a `mock` datasource adapter so the Explorer can render a dataset-backed technical view without assuming any final Snowflake or PostgreSQL cost-components model.

## 2. Files changed

| File | Type of change | Purpose |
| --- | --- | --- |
| `apps/pcos-explorer/src/datasets/dataset-contract.ts` | New file | Defines dataset, datasource adapter, view config, metric, filter, and result contracts |
| `apps/pcos-explorer/src/datasets/dataset-registry.ts` | New file | Registers datasets and adapters and resolves dataset loads |
| `apps/pcos-explorer/src/datasets/adapters/mock-datasource-adapter.ts` | New file | Implements the minimal `mock` datasource adapter |
| `apps/pcos-explorer/src/datasets/normalized-cost-components.mock.ts` | New file | Registers the `normalized_cost_components_mock` dataset and mock records |
| `apps/pcos-explorer/src/datasets/index.ts` | New file | Bootstraps dataset registrations |
| `apps/pcos-explorer/src/datasets/dataset-page.tsx` | New file | Server-side dataset page orchestrator |
| `apps/pcos-explorer/src/components/datasets/dataset-summary-cards.tsx` | New file | Renders simple KPI cards from dataset metrics |
| `apps/pcos-explorer/src/components/datasets/dataset-table.tsx` | New file | Renders a minimal dataset table |
| `apps/pcos-explorer/src/app/datasets/[datasetId]/page.tsx` | New file | Exposes dataset rendering in the existing Explorer shell |
| `apps/pcos-explorer/src/registry/index.ts` | Updated | Bootstraps the dataset layer alongside the existing domain layer |
| `apps/pcos-explorer/src/registry/navigation-registry.ts` | Updated | Adds dataset entries to sidebar navigation without touching domain registration |
| `apps/pcos-explorer/src/components/nav/sidebar.tsx` | Updated | Adds dataset group icon support |

## 3. Architecture added

The new layer introduces a parallel dataset flow:

`dataset -> datasource adapter -> view config -> renderer`

At this stage:

- the dataset is a registry entry with identity, datasource metadata, and view configuration
- the datasource adapter is a `mock` adapter only
- the view configuration defines fields, primary field, filters, metrics, and table columns
- the renderer is a minimal technical page composed of summary cards plus a table

The goal is not to replace domain pages yet. The goal is to prove that Explorer can render a dataset through a datasource abstraction rather than only through domain-specific Prisma queries.

## 4. Backward compatibility

The existing model was preserved:

`domain -> query -> renderer`

No existing domain definitions, query modules, renderers, domain routes, Prisma schema, or lifecycle-oriented Explorer services were removed or refactored. The dataset layer was added alongside the domain layer and is bootstrapped additively through the shared registry import path.

## 5. Mock dataset

Added dataset:

`normalized_cost_components_mock`

This dataset is explicitly a temporary frontend read model used only to validate the dashboard abstraction. It is not a final Snowflake model, not a final PostgreSQL read model, and not a claim about the eventual structure of cost-components data.

Datasource-identifying fields such as source system, database, schema, and table are intentionally labeled with `mock_*` placeholder values to avoid hardcoding any real Snowflake table names or pretending that the final data contract is already known.

## 6. Validation results

Commands executed:

1. `cd apps/pcos-explorer && npm run typecheck`
   - Result: PASS

2. `cd apps/pcos-explorer && npm run lint`
   - Result: FAIL
   - Reason: existing script resolves `next lint` incorrectly in this environment as a directory argument (`Invalid project directory provided ... /pcos-explorer/lint`). This appears to be a script/tooling issue rather than a failure introduced by this change.

3. `cd apps/pcos-explorer && npm run build`
   - Result: PASS
   - Confirmed route output includes `/datasets/[datasetId]`

4. Scoped editor diagnostics on new dataset files
   - Result: PASS after a small Tailwind utility cleanup in `dataset-page.tsx`

## 7. Known gaps

- no charting library is used in this step
- no real PostgreSQL read model exists for cost components in this layer
- no Snowflake integration exists in this layer
- no final `normalized_cost_components` contract exists yet
- no dataset selector UX exists beyond the sidebar navigation entry
- filters are declarative only in this step and are not yet interactive

## 8. Recommended next step

Prepare a first real frontend read-model contract for `normalized_cost_components` so the `mock` adapter can later be replaced by either:

- a PostgreSQL read-model adapter, or
- an API-backed adapter

without changing the dataset page composition model.