# SG2 E1 — stored market source preparation

Status: SOURCE_PREPARED_NOT_ACTIVATED. Observation: 2026-10-17 UTC (2026-10-18 in Warsaw). This is a dated source/database preparation receipt, not acceptance of E1 or an application deployment.

## Authority and exact scope

- Producer task: `SG2-E1-MARKET-READ-SOURCE-PREPARATION-20261017`, profile SG2, target Development, local isolated workspace, repository `profitia/SG-dev`, authority `main`.
- Independent regression companion: `SG2-E1-MARKET-SOURCE-PREPARATION-COMPATIBILITY-20261017`. It updates the existing runtime configuration test to verify the new independent physical receipt; it does not perform database setup.
- Implemented SQL source: `apps/sg-runtime/prisma-market-data/private-read/001-stored-history-read.sql` at `cc0274c2c3f124b1f357430d123e54c6931a7681` (PR #455); SHA-256 `596885d43b911a5ee25dee53a8a9c42f23bf2662a68aef755194a9bbb6b64304`.
- The historical PR #455 source-only observation was correct before this preparation. This new receipt supersedes that physical-state observation without rewriting its history.
- Both tasks passed their own before/begin/require-begin governance, routing, live provider drift and PMOS gates. Their targets, registrations and closeouts remain separate.

## Physical result

The existing market project `autumn-waterfall-65938876`, Development branch `br-dry-hall-b294222f`, endpoint `ep-muddy-pine-b22pdyqd`, database `neondb`, PostgreSQL 18.6, remains in its existing organization and region. No new project, repository, organization or paid plan was created. The machine-readable independent proof is `apps/sg-runtime/deployment/market-read-preparation.json`.

Only the following additive boundary was installed:

| Object | Actual boundary |
| --- | --- |
| `profitia_market_read_owner` | NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS; only explicitly required source-column SELECT grants |
| `sg2_market_read_development_runtime` | Ordinary LOGIN, no memberships/elevated flags, connection limit 1, default read-only transactions |
| `profitia_market_read.installation` | Technical installation receipt; ENABLE and FORCE RLS; runtime SELECT only |
| `profitia_market_read.series`, `profitia_market_read.observations` | Security-barrier views, approved shared MACROBOND fields, runtime SELECT only, owned by the controlled NOLOGIN role |

The original 18 public table definitions, columns, indexes, policies and owners have the same catalog digest before and after: `fdabf5c80e5b854870f896b057d926d8fea83bc31634475345489510000dce52`. Existing owner-role flags are unchanged. The original observer `neondb_owner` has bypass privileges and is not evidence of an ordinary runtime login. Existing business rows, their ownership and application connections were not reassigned or copied into the private product store.

The new read role cannot SELECT any public base table, private forecast trace or job table, UPDATE the receipt, CREATE in the database/public schema, use role membership, or execute a privileged definer function. It is a shared-data-plane reader called after the existing human operation authority; this preparation does not activate a new SERVICE principal, ingest, vendor acquisition, hydration, background worker or paid refresh.

## Independent checks and transactional recovery

1. Initial absence of both new role names and the schema was checked. The committed SQL bytes and digest were verified independently.
2. The MCP driver rejected a multi-command prepared statement before mutation. Readback confirmed no new roles/schema. The exact canonical SQL was split only at top-level statement boundaries, preserving quoted strings, dollar-quoted blocks and comments. The complete plan has 31 commands in one transaction; its digest is recorded in the receipt.
3. A retained copy-on-write backup branch and its disposable child were verified at the same parent LSN `1/925FA5C0`. The initial catalog and original owner flags matched.
4. On the disposable child, the entire 31-command plan reached an intentional final failure. Rollback removed all newly created roles/schema and preserved the original catalog. Clean reapplication then succeeded. Parent Development still had no new boundary before its own controlled application of the same plan.
5. The actual authenticated `session_user` and `current_user` were both `sg2_market_read_development_runtime` on the child and original Development. They were not simulated with SET ROLE. The role read its own receipt and nonempty approved shared projections; only counts were retained, not market rows or private payloads.
6. The exact descriptor query extracted from the committed `stored-read.ts` succeeded through that login on the actual PostgreSQL 18 source. It verified the three controlled objects, correct owner, no unrelated table access, no source writes and no privileged definer access.
7. Actual SELECT probes against `public.market_series` and `public.forecast_action_trace` were refused. A transaction explicitly switched to READ WRITE still refused an UPDATE probe with `WHERE false` on the installation receipt. This proves an ACL denial independently of the default read-only setting and changed no rows.

Only the new unused technical role required credential initialization. It remained NOLOGIN with its least-privilege ACLs in place until initialization. Neon refused password rotation on a role without a password; a random server-memory-only seed for this new role allowed provider-managed rotation before enabling its login. No existing password/token was read, reset or copied; no plaintext credential was displayed or archived. Application connections and service secrets were not changed.

## Retained recovery resources and deviation

- Snapshot creation returned HTTP 400 because Neon allows that operation only for root branches. No snapshot was created and no Production/root restore was substituted.
- Safe equivalent: retained backup `br-wandering-dawn-b2k755tg`, parent Development, LSN `1/925FA5C0`, zero compute endpoints. Neon refuses children under an expiring parent, so this backup currently has **no active expiry**. It is retained as the source Last Known Good recovery point; retention requires review after the child expires or a newer source recovery point is accepted. It is not described as an expiring snapshot.
- Disposable recovery/rehearsal child `br-dark-darkness-b2yukdxs`, endpoint `ep-lingering-frost-b2j3petw`, 0.25 CU minimum and maximum, idle suspension after 300 seconds, expiry `2026-10-18T21:51:12Z`. It was explicitly suspended and independently observed idle after the checks. Existing project compute defaults were not changed.
- Original Development was never reset, restored, swapped or rerouted. The rehearsal validates recovery of the pre-change source through the retained copy and transactional application/rollback there; it is not evidence of a retained Render application-artifact rollback.

## Compatibility and application boundary

The configured source binding remains opt-in and disabled by default. `marketRead.observedState` now reports `PREPARED_NOT_ACTIVATED`, with the independent receipt pointer. `operation-integration.json` separately records source initialization/role provisioning as true and runtime configuration/product deployment as false.

No Render/GitHub environment values, application flags, connection strings, existing credentials, auto-deployment settings or live release bindings were changed. The four SG2 Development services still reported their previous live revisions during fresh provider readback; all have auto-deployment off. The other three enabled automatic services have unrelated roots/path filters. No Staging or Production service/database was changed.

The native reader's PostgreSQL descriptor/ACL checks are proven against the actual source. The application's Prisma/TLS handshake to that source, real Clerk browser login, business E2E, configured source credential, product feature grant, application activation and controlled Development/Staging release remain separate acceptance work. No readiness is inferred from this source receipt alone.

## Local and publication validation

The complete local SG2 operation-context/API/Prisma/RLS/UI/forecast regression passed: 302 tests, zero failures, cancellations or skips. Strict changed-source and typed-test checking passed. The existing configuration regression now cross-checks the independent physical receipt, real role flags/ACLs and explicit non-activation, while retaining malformed/foreign connection and legacy/default behavior cases. Only fixed disposable loopback PostgreSQL databases were used for this regression; the cloud-role checks above were independent.

Publication must additionally pass exact-source controlled CI, public regression/build and governance checks; their actual run IDs and outcomes belong to each task's canonical closeout. Source-only preparation does not authorize a product deployment.

## Remaining scope

This increment provides an auditable least-privilege shared market source. It does not complete remaining protected entrances, forecast/provider write effects, delegated jobs, cache/files, live login/business testing, application integration/recovery, or controlled Development and Staging releases. E1 remains in progress; E2–E4 and Production are outside this task.
