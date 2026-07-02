# SG2 Cognition Explorer Dataset Selector And View Config Implementation

## 1. Executive summary

This task extends the existing dataset bootstrap in `apps/pcos-explorer` from a single technical dataset detail page into a small registry-driven dataset shell.

The implementation adds a `/datasets` listing page, strengthens the dataset view contract so rendering is driven more directly by `view config`, and confirms the pattern is multi-dataset by adding `sync_metadata_mock` alongside `normalized_cost_components_mock`.

The goal was to move the Explorer one step closer to a universal data dashboard shell without introducing real PostgreSQL reads, Snowflake integration, charts, Prisma schema changes or migrations.

## 2. Scope confirmation

Confirmed out of scope and not implemented in this task:

- No Snowflake integration
- No PostgreSQL read endpoint
- No Prisma schema changes
- No migrations
- No charting library

## 3. Files changed

| File | Change type | Purpose |
| --- | --- | --- |
| `apps/pcos-explorer/src/datasets/dataset-contract.ts` | Updated | Extended dataset view contract for config-driven rendering, mock notices and empty state |
| `apps/pcos-explorer/src/components/datasets/dataset-summary-cards.tsx` | Updated | Switched summary metrics computation to the stronger view-config contract |
| `apps/pcos-explorer/src/components/datasets/dataset-table.tsx` | Updated | Rendered table from configured columns, formats, alignment and empty state |
| `apps/pcos-explorer/src/datasets/dataset-page.tsx` | Updated | Bound header, notices, placeholder handling and metrics more directly to view config |
| `apps/pcos-explorer/src/datasets/normalized-cost-components.mock.ts` | Updated | Upgraded the existing mock dataset to the stronger config shape and clearer placeholder semantics |
| `apps/pcos-explorer/src/registry/navigation-registry.ts` | Updated | Added an `All datasets` entry while preserving existing cognition navigation |
| `apps/pcos-explorer/src/datasets/index.ts` | Updated | Bootstrapped the optional second mock dataset |
| `apps/pcos-explorer/src/components/datasets/dataset-card.tsx` | Added | Added a reusable dataset listing card |
| `apps/pcos-explorer/src/datasets/dataset-list-page.tsx` | Added | Added the dataset selector page implementation |
| `apps/pcos-explorer/src/app/datasets/page.tsx` | Added | Exposed the `/datasets` route |
| `apps/pcos-explorer/src/datasets/sync-metadata.mock.ts` | Added | Added a second small mock dataset to validate multi-dataset behavior |

## 4. Dataset selector

The dataset selector is implemented as a dedicated `/datasets` route backed by `DatasetListPage`.

It renders the current dataset registry as a list of cards showing:

- dataset title
- description
- datasource type
- mock status
- dataset id
- a direct link to the detail view

The sidebar dataset navigation remains additive. The existing `Datasets` group now includes `All datasets` plus the registered dataset detail entries.

## 5. View config

The dataset view contract now drives more of the UI directly.

The following elements are now controlled by `view config`:

- page header title and description
- datasource label
- mock state
- primary key
- field definitions
- summary metrics
- table columns
- empty state
- mock notice
- quality notice

Field definitions now support placeholder semantics more explicitly through:

- `isPlaceholder`
- `placeholderReason`

Table rendering now uses configured column keys, formats, alignment and primary-column emphasis instead of relying only on hardcoded assumptions.

## 6. Mock datasets

Available mock datasets after this task:

1. `normalized_cost_components_mock`
2. `sync_metadata_mock`

`normalized_cost_components_mock` remains explicitly non-final. The implementation keeps it as a frontend placeholder dataset and adds clearer notices that:

- data is mock-only
- Snowflake mapping is unknown
- the final contract depends on a future PostgreSQL read model

The optional second dataset was added because it stayed small and low-risk while providing a real proof that selector, registry and view config are multi-dataset rather than custom-fit to only one dataset.

## 7. Backward compatibility

The existing `domain -> query -> renderer` model was not refactored, removed or migrated.

This task only adds a parallel `dataset -> datasource adapter -> view config -> renderer` path inside `apps/pcos-explorer`.

Existing cognition routes remained present in build output, including:

- `/benchmark`
- `/embeddings`
- `/hydration`
- `/intelligence`
- `/memory`
- `/ontology`
- `/promotion`
- `/retrieval`
- `/supplier`
- `/validation`

## 8. Validation results

Commands executed:

1. `cd apps/pcos-explorer && npm run typecheck`
   - PASS

2. `cd apps/pcos-explorer && npm run build`
   - PASS
   - Build output confirmed both `/datasets` and `/datasets/[datasetId]`
   - Build output also confirmed existing domain routes remained present

Additional checks confirmed by implementation scope:

- No Prisma schema files were edited in this task
- No migrations were created
- No Snowflake integration was added
- No real PostgreSQL cost-components integration was added

`npm run lint` was not required for acceptance in this task. The repo already has a known historical `next lint` script issue from the earlier dataset-abstraction step, so lint was not used as a completion gate here.

## 9. Known gaps

- No charting layer yet
- No interactive filters yet
- No real PostgreSQL adapter yet
- No final `normalized_cost_components` read model contract yet
- No Snowflake table mapping yet
- No dataset-specific visualization definitions beyond the current table and summary primitives

## 10. Recommended next step

Best next step:

Prepare a frontend read-model contract for the future real `normalized_cost_components` dataset, while keeping the mock-first shell intact.

That should come before PostgreSQL endpoint work, because it allows the team to stabilize naming, field semantics and metric definitions before binding the dashboard to a real backend contract.