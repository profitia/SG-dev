# SG2 — deployable private business schema candidate, 17 October 2026

Task `SG2-E1-PRIVATE-BENCHMARK-SCHEMA-20261017`, SG2 / Development. Starting authority `c197e5d1f8ff2add3c6460b85fbfce582d68c015`.

## Result

Added exact versioned SQL for a new private SpendGuru schema, derived from the unchanged Prisma 5.22 model definitions. The five model tables and a technical receipt belong to the controlled non-login owner and use ENABLE/FORCE RLS. It creates no identity, permission, product grant, runtime login, customer row or application activation. The accepted separate benchmark boundary admits only its three existing tables; Category and CategoryCostComponent remain closed without admission policies or table grants pending their own adoption.

DDL SHA-256: `4116e1ec8f0b2a8821c7d6af6728dc55dc949b4cb73a6435f8c614410523afae`.
Boundary SHA-256: `d17f62ef9ddf3000ff264da53f44a8afb00fb2bd8e53e6fe5fe7be80c2ebec99`.

The migration refuses the wrong owner, unaccepted control schema checksums, unexpected global default ACLs, and every pre-existing namespace. It does not adopt, reset, drop or silently replay unknown state. A checked operator transaction applies the exact DDL, accepted boundary, source/digest receipt, precise ACLs and temporary owner-privilege revocation atomically. A failed initial transaction rolls back the new schema. A later unknown commit outcome requires readback/reconciliation; code rollback is not data-deletion authority. The adjacent README defines this operator contract.

## Verification

The actual private-host API/Prisma integration suite now installs this exact SQL under `profitia_access_owner`, rather than constructing the tested store through `prisma db push`. Its existing real positive, two-organisation, permission/revocation, timeout, composite-FK, restrictive-module and durable-audit regressions therefore exercise the deployable schema.

A new real PostgreSQL suite checks missing/wrong control installations, unsafe default grants, preservation of a pre-existing sentinel namespace, atomic failure after DDL, actual owner/FORCE-RLS flags, exact Prisma schema parity, ordinary-role denial/no owner membership, accidental ACLs and closed category tables, and safe refusal of replay while preserving accepted rows and receipt.

Local result: 65 operation-context/API/SQL/configuration tests PASS, zero skipped; typecheck PASS. Exact-source clean controlled CI and required remote checks are mandatory before merge; final source/run identifiers are retained in this task's PMOS/MEMOROS/PHR closeout.

## Explicit limits

This is a source candidate and isolated test acceptance. No Neon migration, copy of historical/demo/customer data, service setting, secret, application activation or deployment was performed. It does not prove adopted categories, all protected entries, actual Clerk browser login, complete E1, a Development release or Staging acceptance. The existing business environments remain unchanged.
