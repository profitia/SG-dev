# SpendGuru Production Registry Bootstrap Runbook

## Canonical Scope

- Canonical repository: `profitia/spendguru`
- Canonical runtime path: `runtime/data-runtime`
- Canonical registry definitions: `runtime/data-runtime/src/runtime/runtime-configuration.ts`

Schema initialization, registry bootstrap and hydration are separate operator-controlled stages.

## Execution Order

1. Schema initialization
2. Schema verification
3. Registry dry-run
4. Registry apply
5. Registry verification
6. Hydration readiness
7. Hydration

Registry bootstrap does not execute schema initialization, Prisma migrations, `prisma db push`, or hydration.

## Safety Contract

- `DATA_RUNTIME_ENV` must be set explicitly to `STAGING` or `PRODUCTION`
- `--dry-run` or `--apply` must be set explicitly
- Production apply requires `ALLOW_PRODUCTION_REGISTRY_BOOTSTRAP=true`
- Dry-run performs zero writes
- Apply is transactional, idempotent, and non-destructive
- Structured output is redacted and must not contain connection strings, passwords, or tokens

## Target Identity

Bootstrap verifies the active database target before any write path begins.

- Production expected database: `neondb`
- Production expected Neon project ID: `rough-field-86336647`
- Production expected Neon branch ID: `br-crimson-moon-asiphd7t`

Project ID and branch ID are verified when they are available through safe non-secret operator inputs.

If the resolved target does not match the expected production identity, bootstrap stops with `DATABASE_TARGET_IDENTITY_MISMATCH`.

## Schema Prerequisites

Required runtime schema tables:

- `dr_connectors`
- `dr_sources`
- `dr_datasets`
- `dr_pipelines`
- `dr_runs`
- `dr_run_datasets`
- `dr_watermarks`
- `dr_raw_records`
- `dr_dashboard_index_records`
- `dr_forecast_accuracy_records`

If these tables are missing or incomplete, production bootstrap stops with `PRODUCTION_SCHEMA_NOT_READY`.

Execution prerequisite when production is still empty:

- `PRODUCTION_SCHEMA_INITIALIZATION_REQUIRED`

## Commands

Dry-run:

```bash
DATA_RUNTIME_ENV=PRODUCTION \
DATA_RUNTIME_ORGANIZATION_ID=<organization-id> \
npm run db:bootstrap-registry:dry-run
```

Apply:

```bash
DATA_RUNTIME_ENV=PRODUCTION \
DATA_RUNTIME_ORGANIZATION_ID=<organization-id> \
ALLOW_PRODUCTION_REGISTRY_BOOTSTRAP=true \
npm run db:bootstrap-registry:apply
```

Deprecated compatibility alias:

```bash
npm run db:bootstrap-registry:staging
```

This alias maps to explicit staging dry-run only.

## Structured Summary

The bootstrap summary reports:

- environment
- mode
- database name
- schema name
- schema readiness and missing tables
- registry definition counts
- create count
- update count
- unchanged count
- conflict count
- rows inserted
- rows updated
- rows deleted
- transaction committed
- duration
- final status

## Failure Statuses

- `INVALID_BOOTSTRAP_MODE`
- `DATABASE_URL_MISSING`
- `PRODUCTION_BOOTSTRAP_CONFIRMATION_MISSING`
- `DATABASE_TARGET_IDENTITY_MISMATCH`
- `PRODUCTION_SCHEMA_NOT_READY`
- `SCHEMA_NOT_READY`
- `CANONICAL_REGISTRY_DEFINITION_CONFLICT`
- `REGISTRY_BOOTSTRAP_TRANSACTION_FAILED`

## Stage Matrix

| Stage | Writes | Preconditions | Expected result | Rollback |
| --- | --- | --- | --- | --- |
| Schema initialization | Yes | Approved database change window, migration plan, canonical runtime schema | Runtime schema exists and matches tracked migrations | Database backup or migration rollback plan |
| Registry dry-run | No | Explicit environment, readable target database, schema ready | Planned creates, updates, unchanged rows, and conflicts reported with zero writes | None required |
| Registry apply | Yes | Explicit environment, production confirmation for production, schema ready, target identity verified | Canonical registry definitions are present transactionally and can be re-run safely | Transaction failure rolls back automatically; post-commit rollback is operator-controlled |
| Hydration | Yes | Schema ready, registry ready, source connectivity approved, separate operational approval | Dashboard and forecast read models are populated | Operator-controlled data remediation or rerun |

## Rollback Boundaries

- Git rollback boundary: task branch or follow-up repository change
- Database rollback boundary: outside this runbook and operator-controlled
- Render rollback boundary: not part of registry bootstrap

## Secret Handling

- Never print `DATABASE_URL`, `DIRECT_URL`, full connection strings, passwords, or tokens
- Treat project and branch identifiers as non-secret metadata only when they are provided safely
- Use redacted structured output for all failures