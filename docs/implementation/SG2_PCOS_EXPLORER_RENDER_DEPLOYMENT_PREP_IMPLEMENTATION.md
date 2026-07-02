# SG2 PCOS Explorer Render Deployment Prep Implementation

## 1. Executive summary

This task added the minimum repository-side deployment preparation needed to preview `apps/pcos-explorer` on Render without treating it as a full live cognition deployment.

The implementation focused on three gaps identified in the readiness audit:

- the app start surface was not Render-safe because it hardcoded port `3100`
- the root route still assumed live Prisma-backed cognition access unless a narrow connection-refused fallback happened at runtime
- there was no app-level operator documentation or preview blueprint for a safe mock-only deployment

The result is a safer mock-preview contract for `/`, `/datasets`, and dataset detail routes, plus an explicit operator path for manual Render setup.

## 2. Changes made

| File | Change type | Purpose |
| --- | --- | --- |
| `apps/pcos-explorer/package.json` | Updated | Made `start` respect platform `PORT` for Render |
| `apps/pcos-explorer/.env.example` | Updated | Added explicit `PCOS_EXPLORER_PREVIEW_MODE` contract |
| `apps/pcos-explorer/src/lib/org.ts` | Updated | Added shared preview-mode flags |
| `apps/pcos-explorer/src/app/page.tsx` | Updated | Added explicit mock-preview root behavior without Prisma-backed root queries |
| `apps/pcos-explorer/src/registry/navigation-registry.ts` | Updated | Hid DB-backed domain navigation in mock preview mode |
| `apps/pcos-explorer/README.md` | Added | Documented safe preview scope, env vars, commands, and Render setup |
| `apps/pcos-explorer/render.preview.yaml` | Added | Added minimal Render preview blueprint for manual setup |

## 3. Preview contract

Supported preview routes:

- `/`
- `/datasets`
- `/datasets/normalized_cost_components_mock`
- `/datasets/sync_metadata_mock`

Behavior in `PCOS_EXPLORER_PREVIEW_MODE=mock`:

- root `/` renders an intentional preview shell instead of attempting live Prisma-backed cognition queries
- navigation is narrowed to the preview-safe surface, so DB-backed domain routes are not promoted in the sidebar
- dataset preview routes remain mock-backed and safe to evaluate without live cognition data

## 4. Render prep decisions

- Kept root `render.yaml` unchanged to avoid mixing the PMOS dev-time service with app-specific preview configuration
- Added an app-local `render.preview.yaml` instead of widening the global Render blueprint prematurely
- Treated `DATABASE_URL` and `DIRECT_URL` as optional for mock preview, but still documented them because live routes remain DB-backed outside preview scope

## 5. Validation

Commands planned for validation:

1. `cd apps/pcos-explorer && npm run typecheck`
2. `cd apps/pcos-explorer && PCOS_EXPLORER_PREVIEW_MODE=mock npm run build`
3. `cd apps/pcos-explorer && PORT=<port> PCOS_EXPLORER_PREVIEW_MODE=mock npm run start`

Expected outcome:

- typecheck passes
- build passes in mock preview mode
- app starts on a platform-provided port
- root `/` renders a clear preview warning without Prisma-backed root queries

## 6. Known limits

- This is still not a production deployment contract.
- DB-backed cognition routes remain outside the supported mock preview promise.
- No auth, no PostgreSQL feature work, no Snowflake work, and no Render deployment execution were added in this task.