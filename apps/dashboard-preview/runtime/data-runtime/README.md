# Data Runtime

`runtime/data-runtime` is the narrow SpendGuru synchronization runtime responsible for loading source data into PostgreSQL read models used by dashboard-serving consumers.

Current owned surfaces:
- Prisma runtime schema and migrations
- Registry bootstrap CLI
- Pipeline execution CLI
- Dashboard store persistence
- Forecast accuracy persistence

Supported commands:
	- `npm test`
- `npm run db:generate`
- `npm run typecheck`
- `npm run build`
- `npm run db:bootstrap-registry:dry-run --` with explicit `DATA_RUNTIME_ENV=STAGING|PRODUCTION`
- `npm run db:bootstrap-registry:apply --` with explicit `DATA_RUNTIME_ENV` and production confirmation when targeting production
- `npm run db:bootstrap-registry:staging` as a deprecated compatibility alias for explicit staging dry-run only
- `npm run run:source-sync -- --source market-indexes --mode full|incremental`
- `npm run run:pipeline -- --source market-indexes --pipeline dashboard|forecast-accuracy --mode full|incremental`
	- `npm run run:recover-stale -- --organization-id <id> --stale-after-seconds <n> [--limit <n>]`

Hydration lifecycle contract:
- Durable `dr_runs` and `dr_run_datasets` are created as `RUNNING` after registry resolution and before connector execution.
	- Execution leases are implemented for lease-aware runs and remain disabled by default until explicitly enabled.
	- Lease-aware runs keep the raw lease token only in worker memory and persist only the SHA-256 token hash.
	- Heartbeat renews authoritative lease state every 30 seconds with bounded retries and cooperative cancellation on lease loss.
- `SUCCEEDED` is persisted only after all stages finish and success postconditions are complete.
- Any stage failure after lifecycle creation finalizes dataset `FAILED` and run `FAILED` with a bounded sanitized error.
- `PARTIAL` remains a reserved schema capability and helper-level contract for a future multi-dataset aggregation path.
- The current active runtime execution path terminates an executed dataset run as `SUCCEEDED` or `FAILED`; it does not currently produce `PARTIAL`.

Failure and watermark contract:
	- Lease loss is cooperative cancellation: the active `AbortSignal` is propagated through execution and stale workers do not continue into new durable boundaries.
- Failure diagnostics are persisted through lifecycle fields only after secret redaction.
- Failed stage attribution is stored in `dr_runs.stats_json.lifecycle`.
- Dashboard watermarks are written only after target upserts succeed.
	- Dashboard watermark persistence re-verifies active lease authority in the same database transaction.
	- Forecast accuracy persistence remains watermark-free.
- A watermark write failure prevents `SUCCEEDED` finalization.
- Target rows are not destructively rolled back when a later lifecycle step fails; reruns must rely on idempotent upserts.

Recovery contract:
- Failed runs are immutable evidence and are not resumed in place.
- `run:recover-stale` is a read-only stale execution planner and performs zero writes.
	- Recovery planning requires an explicit organization boundary and a positive `--stale-after-seconds` threshold.
	- Recovery planning uses PostgreSQL authority time for lease expiry, grace, and stale-threshold classification.
	- Planner output distinguishes lease classification from recovery eligibility, including explicit `LEASE_LOST` cases.
- Legacy `RUNNING` executions are not automatically finalized.
	- Recovery Apply is implemented as an explicit single-run path only.
	- Recovery Apply is disabled by default and requires both `DATA_RUNTIME_RECOVERY_APPLY_ENABLED=true` and `ALLOW_STALE_HYDRATION_RECOVERY_APPLY=true`.
	- Recovery Apply requires exact `--organization-id`, exact `--run-id`, matching `--confirm-run-id`, and a positive `--stale-after-seconds` threshold.
	- `--confirm-run-id` must exactly match `--run-id` before any write path can execute; there is no interactive confirmation prompt.
	- Legacy lease-less `RUNNING` rows are excluded from normal Recovery Apply.
	- This worktree does not perform a production migration, production Hydration, or Recovery Apply on real data.
- Recovery planning never deletes raw rows, never deletes target rows, never resets a watermark and never triggers a Hydration rerun.

Feature flags:
	- `DATA_RUNTIME_EXECUTION_LEASES_ENABLED` defaults to `false`.
	- `DATA_RUNTIME_RECOVERY_APPLY_ENABLED` defaults to `false`.
	- `ALLOW_STALE_HYDRATION_RECOVERY_APPLY` must be the exact value `true` before any apply path is allowed.

Secret-redaction contract:
- Persisted lifecycle diagnostics never include connection strings, usernames, passwords, bearer tokens, authorization headers, private keys or raw source payload rows.
- Error text is normalized into a bounded single-line summary before persistence.

Production registry bootstrap safety contract:
- Production dry-run and apply both require provider-backed Neon target verification.
- Required production env vars are `DATA_RUNTIME_ENV=PRODUCTION`, `DATA_RUNTIME_ORGANIZATION_ID`, `DATABASE_URL`, `DATA_RUNTIME_NEON_API_KEY` or `NEON_API_KEY`, and production apply additionally requires `ALLOW_PRODUCTION_REGISTRY_BOOTSTRAP=true` with `--apply`.
- `DATA_RUNTIME_EXPECTED_PROJECT_ID` and `DATA_RUNTIME_EXPECTED_BRANCH_ID` remain override hooks, but production defaults are fail-closed to the canonical Neon project and branch when overrides are not supplied.
- The official Neon API root is `https://console.neon.tech/api/v2`.
- Production verification uses the fixed read-only request sequence `PROJECT_LOOKUP -> BRANCH_LOOKUP -> ENDPOINT_LOOKUP -> DATABASE_LOOKUP`.
- The verifier resolves the active endpoint host from `DATABASE_URL`, then confirms the actual Neon project, branch, endpoint and database through the Neon control-plane API before any write path can proceed.
- Production base URL overrides are rejected unless they exactly match the official Neon API origin and canonical `/api/v2` path. Bearer tokens are never sent to arbitrary origins.
- Explicit process environment values win over `.env.local` defaults. Local env loading is not required for production execution when variables are already exported.
- Apply is blocked when conflict evaluation is incomplete or when any registry conflict is detected.

Provider verifier troubleshooting:
- `401` - invalid or inactive Neon credential.
- `403` - credential lacks access to the required Neon resource.
- `404` during `PROJECT_LOOKUP` - project unavailable at the official Neon API route.
- `404` during `BRANCH_LOOKUP` - branch unavailable for the expected project.
- `404` during `ENDPOINT_LOOKUP` - endpoint list unavailable or the target endpoint cannot be matched.
- `404` during `DATABASE_LOOKUP` - database list unavailable or the expected database cannot be matched.
- `PROVIDER_TARGET_IDENTITY_MALFORMED_RESPONSE` - provider returned JSON missing required fields.
- `PROVIDER_TARGET_IDENTITY_NETWORK_ERROR` - transport failure before a response was received.

Secret-handling rules:
- Never log `Authorization` headers, API tokens, connection strings, usernames, passwords, or raw provider responses.
- Operator-facing diagnostics may include `requestStage`, `resourceKind`, `httpStatus`, `providerErrorCode`, and `retryable` only.

Registry bootstrap conflict taxonomy:
- `DUPLICATE_CANONICAL_KEY`
- `DUPLICATE_EXISTING_KEY`
- `IMMUTABLE_IDENTITY_MISMATCH`
- `PARENT_RELATIONSHIP_MISMATCH`
- `DATASET_RELATIONSHIP_MISMATCH`
- `TARGET_STORE_MISMATCH`
- `AMBIGUOUS_EXISTING_STATE`
- `CONFLICT_EVALUATION_INCOMPLETE`

Registry bootstrap JSON comparison contract:
- Object key order is ignored for registry JSON comparison.
- Nested object key order is ignored for registry JSON comparison.
- Array element order remains significant.
- `null` and a missing property remain different values.
- Empty objects and empty arrays remain different values.
- Registry comparison does not mutate input values.
- Registry comparison does not rewrite stored PostgreSQL JSON.

Local-only files must not be committed:
- `.env.local`
- `snowflake.log`
- `dist/`
- `node_modules/`

This package is environment-aware through runtime env vars, but publishing the package does not authorize production database mutation by itself.

Schema initialization, registry bootstrap and hydration are separate operator-controlled stages.