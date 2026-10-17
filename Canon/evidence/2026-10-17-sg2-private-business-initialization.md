# SG2 — private business store preparation, 17 October 2026

Status **PREPARED_NOT_ACTIVATED**, SG2 / Development. Task `SG2-E1-PRIVATE-BUSINESS-INITIALIZATION-20261017`. This accepts a database preparation unit; the complete E1 and its Development/Staging releases remain in progress.

## Accepted material and exact target

The exact DDL accepted through PR #420/#421, source `341ec2297ecf733c460267bc34181281b58c1b5d`, was applied to the owner-created `profitia-platform-private`, project `spring-bread-28217539`, branch `br-sparkling-term-b99l107x`, endpoint `ep-late-heart-b9mxo8oi`, database `platform_private`. The existing Neon organisation/Scale plan, Frankfurt region, 0.25 CU min/max and 300-second suspend remain unchanged.

Business DDL SHA-256: `4116e1ec8f0b2a8821c7d6af6728dc55dc949b4cb73a6435f8c614410523afae`. Separate accepted benchmark boundary: `d17f62ef9ddf3000ff264da53f44a8afb00fb2bd8e53e6fe5fe7be80c2ebec99`. The source passed 65 real API/SQL/configuration tests and the exact-source clean controlled CI/build. No db push or rewritten migration source was used at Neon.

Own begin, full require-begin and additional canonical live-provider preflight passed with real Render/Neon API observations. The source and actual directory/resource state were checked again before the primary transaction.

## Recovery and rehearsal

Snapshot `snap-square-tree-b931qvch` captures the pre-change private directory, created 12:07:42 UTC, expiring 24 October 2026 at 12:07:40 UTC. An actual restore into a **new** branch, `br-orange-heart-b9f7nqoo`, was performed with `finalize=false`. Primary/default/name and the original endpoint were independently checked and preserved. No restore was finalized onto the current branch.

The restored branch has endpoint `ep-frosty-paper-b9s952xu`, 0.25 CU min/max, suspend 300 seconds, and expires 18 October 2026 at 12:08:34 UTC. It contains a private copy of the internal directory, not a synthetic-only database; no customer history was copied. The snapshot and restored directory matched the pre-change SHA-256 state digest.

A deliberate error after business DDL demonstrated real transactional rollback: no business namespace survived, the copied source branch binding was restored, the owner's temporary database CREATE was absent, and the directory digest stayed identical. The same exact DDL/boundary/receipt/ACL transaction then succeeded on the restored branch. Actual ordinary logins were checked; the runtime INSERT was denied before any row persisted, and the disabled descriptor rejected access. A SELECT over empty tables returned no rows; that alone is explicitly **not** an independent denial proof.

## Primary result and ordinary roles

After rehearsal, the exact accepted files were executed in one checked transaction under `profitia_access_owner`. The source/hash receipt, precise runtime ACLs and revocation of the owner's temporary database CREATE were part of the same transaction. Provider prepared-statement restrictions were respected using PostgreSQL's native execution of the unchanged, hash-verified source inside a bounded DO statement, not a homemade SQL splitter.

Readback at approximately 12:16 UTC confirmed 21 of 21 control/business tables with ENABLE/FORCE RLS and the controlled owner. The six new tables are the five unchanged Prisma models plus a technical installation receipt. Four business foreign keys are validated. Both category tables have zero admission policies and no runtime grants.

Actual `current_user=session_user` checks through each of the three ordinary login credentials confirmed no SUPERUSER, BYPASSRLS, CREATEDB, CREATEROLE, INHERIT or owner membership; connection limit 4 remains. Only `sg2_private_development_runtime` receives schema USAGE and SELECT/INSERT/UPDATE on the three accepted benchmark tables. It has no DELETE, category, receipt or direct account-table read. The dashboard and SRM roles have no SG2 business schema or table access. All three disabled runtime descriptors reject access. Initial metadata probes by denied roles could not resolve schema-qualified table names; catalog-OID privilege checks then verified the actual absence of ACLs without granting schema access.

Business benchmarks, mappings and selections remain empty. No demo or customer history was reassigned. The account/identity/organisation/membership/permission/product/module/bootstrap directory digest before the snapshot, after restoration and after the primary migration is identical: `3a88763edc6c949b61638b78e3463e3c55a0a7fc35edc435e3691fe404831edc`. One account, organisation, membership and bootstrap receipt remain. No personal values or connection strings are published here.

## Existing products and acceptance boundary

Both new-store application bindings remain **DISABLED**. No Render/GitHub setting, secret, application connection, identity-provider flag, domain or live product release changed. Fresh Render readback confirms unchanged live deploy IDs/source SHAs for SG2 Development runtime/dashboard, SRM Development and both existing Staging runtimes; exact references are in [preparation metadata](../../apps/sg-runtime/deployment/private-business-preparation.json).

The database context remains a trusted-backend boundary under OC-R15; these RLS controls do not replace verified identity, parameterized SQL or secret protection. No compromised-backend containment, actual Clerk browser session, all-entry integration or completed product release is claimed. The prepared store can safely remain unused and disabled. Recovery of a later state must preserve post-snapshot work; this preparation never authorizes an automatic reset, destructive data rollback or blind replay.

The [resource registry](../registries/platform-private-onboarding-v1.json) now records this separate current observation. Earlier preparation evidence remains historical and dated. Further E1 work includes SRM business data, all included entry points, jobs/cache/files, actual business-module reuse, real sessions and controlled releases.
