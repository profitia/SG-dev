# SRM — checked private business schema candidate

Task `SRM-E1-PRIVATE-BUSINESS-SCHEMA-20261017`, SRM / Development.
Authority at start: `ab2f0c8bdcb2b8436c5ccdc526615711a870b797`.
Status: **source candidate; not applied to Neon, activated or deployed**.

## Result and preservation

The initial private store uses the existing canonical migration manifest,
checksum inspection and ordered source/ledger steps. All 18 existing migration
files remain byte-identical. The only extraction in the existing Stage migrator
is its ordered source/parameterized-ledger plan. Its authorization, database
allowlist, transaction, initialization, dry run and CLI gates stay intact; it
continues to reject `platform_private`. There is no second migration ledger or
SQL splitter, runtime, dependency, customer-data copy or role-creation CLI.

The pure private adapter requires explicit trusted project/branch/database and
ordinary runtime identity, accepted source SHA, recorded physical installation,
accepted access/module/audit digests, disabled applications and an absent SRM
namespace. It temporarily grants database CREATE to the controlled NOLOGIN owner
and creates every source table under that owner, installs the accepted module
boundary, narrows ACLs, records a technical receipt and revokes temporary CREATE
inside **one outer operator transaction**. Live provider identity and governance
remain separate required operator evidence; SQL cannot attest a cloud project ID.

All 22 SRM tables have controlled ownership and FORCE RLS. Ledger and installation
receipt are owner-only. The accepted corporate financial knowledge is read-only
for the human report projection. Twelve private tables retain the module fence;
five unadopted surfaces retain a restrictive false fence. KYS SELECT allows the
existing report SQL to plan, but admits no rows. This is explicitly **not full
KYS feature acceptance**. The runtime has only bounded report SELECT, document
and supplier INSERT/UPDATE, scanner INSERT and archive check-metadata UPDATE
needed by PostgreSQL FOR SHARE. No DELETE or corporate knowledge write is given.

Immutable legacy migrations reference `srm_app_runtime`. In a new private project
it must be prepared as NOLOGIN, unbound and without private CONNECT. The plan
checks that it is unbound and cannot connect, removes its new namespace grants
and never alters its global role attributes. The local fixture deliberately
preserves that sibling legacy LOGIN role and its separate legacy database use.

## Verified locally before publication

- Own full fail-closed preflight, PMOS begin and require-begin PASS.
- 42 operation/configuration/private-plan/real PostgreSQL/API tests PASS, zero
  skipped. The actual report fixture now uses the same plan, not a parallel
  source loop or broad SELECT-on-all grant. Two organisations retain different
  private archive projections; actor preference scopes remain distinct.
- Wrong physical binding, active application, legacy CONNECT and unsafe default
  ACL reject before effects. A committed existing namespace/sentinel survives a
  rejected attempt. Failure after the entire plan rolls back schema, grants,
  receipt and temporary CREATE while preserving the synthetic directory. Exact
  ledger checksums, 22 owner/FORCE RLS tables and no alias/private metadata access
  are independently read back. Replay is refused.
- KYS remains row-closed under a valid module even if an accidental permissive
  policy is added. Existing forged context, current revocation, independent
  audit failure, timeout, pooling and legacy GUC denial tests still pass.
- 475 product tests, 311 promotion/migration tests and 165 release-governance
  tests PASS with their guarded loopback PostgreSQL fixtures; no skipped tests
  in the final configured runs. Typecheck and full Next16/React19 build PASS.
- Required exact-source remote SRM/platform/governance checks and the separate
  SG2 compatibility proof must pass before merge. Final SHA/run/PR evidence is
  recorded by canonical closeout after actual publication.

## Remaining acceptance boundaries

No cloud database/role/secret, Render or GitHub configuration, source migration,
app flag, domain, connection or deployment changed in this unit. The pure plan
has no automatic executor. A later separately gated operator task must verify
current resources, legacy-role preparation, snapshot and real recovery, execute
this exact accepted plan once, and read back effective roles, tables and receipt.
Unknown COMMIT or an existing namespace requires reconciliation, not reset or
blind replay. Both application bindings remain disabled according to the latest
separate cloud preparation evidence.

Full KYS/user-interest/web identity adoption, all alternate entrances,
jobs/cache/files, true browser Clerk session, actual module reuse and controlled
Development/Staging releases remain open parts of the accepted E0/E1 programme.
Passing this unit or SG2 compatibility is not its overall completion.
