# PCOS Explorer - Render Preview

Minimal deployment prep for a safe Render preview of the mock dataset experience in `apps/pcos-explorer`.

## Scope

This preview surface is intentionally limited.

Safe preview routes:

- `/`
- `/datasets`
- `/datasets/normalized_cost_components_mock`
- `/datasets/sync_metadata_mock`

Routes outside that scope still belong to the live cognition explorer surface and may require a Prisma-backed PostgreSQL source.

## Preview modes

`PCOS_EXPLORER_PREVIEW_MODE` controls the root experience:

- `live` - use Prisma-backed cognition queries
- `mock` - skip Prisma-backed root overview queries and keep only the root shell plus dataset preview routes exposed in navigation

For a Render preview of mock datasets, use `PCOS_EXPLORER_PREVIEW_MODE=mock`.

## Environment variables

Required for mock preview:

- `PCOS_EXPLORER_PREVIEW_MODE=mock`
- `PCOS_EXPLORER_ENV=SANDBOX`
- `PCOS_EXPLORER_ORG_ID=pcos-default`

Optional for mock preview:

- `DATABASE_URL`
- `DIRECT_URL`

Notes:

- In `mock` preview mode, the root dashboard does not execute Prisma-backed queries.
- Dataset preview routes are mock-backed and do not require the live cognition database.
- Live cognition routes should not be treated as supported preview routes unless the database connection is configured.

## Local validation

```bash
npm ci
npx prisma generate
PCOS_EXPLORER_PREVIEW_MODE=mock npm run build
PORT=3100 PCOS_EXPLORER_PREVIEW_MODE=mock npm run start
```

## Render preview blueprint

Use [render.preview.yaml](render.preview.yaml) as the minimal service blueprint reference for a manual Render Web Service setup.

Recommended Render service settings:

- `Root Directory`: `apps/pcos-explorer`
- `Build Command`: `npm ci && npx prisma generate && npm run build`
- `Start Command`: `npm run start`

## Deployment notes

- Do not treat this as a production deployment contract.
- Do not expose DB-backed cognition routes as part of the preview promise.
- Keep the preview branch/commit set isolated and intentional before any push.