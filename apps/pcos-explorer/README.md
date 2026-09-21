# PCOS Explorer - Render Preview

Minimal deployment prep for a safe Render preview of the mock dataset experience in `apps/pcos-explorer`.

## Scope

This preview surface is intentionally limited.

Safe preview routes:

- `/`
- `/datasets`
- `/datasets/normalized_cost_components_mock`
- `/datasets/sync_metadata_mock`

Routes outside that scope still belong to the live cognition explorer surface and require an explicitly configured PCOS-owned PostgreSQL source. They are not part of the mock preview contract.

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

Notes:

- In `mock` preview mode, the root dashboard does not execute Prisma-backed queries.
- Dataset preview routes are mock-backed and do not require the live cognition database.
- `DATABASE_URL` and `DIRECT_URL` must not be configured on the mock preview service.
- A live cognition deployment must use a separate, PCOS-owned database profile. A PMOS endpoint or PMOS database is never a valid PCOS source.

## Database and schema authority

The checked-in Prisma schema is a frozen, read-only legacy reference. The former `db:sync` command pointed to the removed `apps/pcos-runtime` tree and has been retired. Do not regenerate or overwrite the reference schema until a current PCOS runtime authority is explicitly restored and registered in governance.

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

- `Root Directory`: empty (commands are repository-root relative)
- `Build Command`: `cd apps/pcos-explorer && npm ci --include=dev && npx prisma generate && PCOS_EXPLORER_PREVIEW_MODE=mock npm run build`
- `Start Command`: `cd apps/pcos-explorer && npm run start`
- `Included Paths`: `apps/pcos-explorer/**`, `packages/pcos-contracts/**`
- `Ignored Paths`: empty

## Deployment notes

- Do not treat this as a production deployment contract.
- Do not expose DB-backed cognition routes as part of the preview promise.
- Do not configure PMOS database credentials on this service.
- Keep the preview branch/commit set isolated and intentional before any push.
