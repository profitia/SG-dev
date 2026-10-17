# SRM — private business initialization, 17 October 2026

Task `SRM-E1-PRIVATE-BUSINESS-INITIALIZATION-20261017`, SRM / Development. Status **PREPARED_NOT_ACTIVATED**.
Authority at start `7041da6b93287c4065c5d9fb302765804507533d`; accepted unchanged initializer
source `7e9def92fd367137258696aae211ac4e6554e7fd`, PR424 with separate SG2 compatibility PR425.
Verified at `2026-10-17T13:25:47.122Z`; provider reads are dated observations, not one
atomic multi-provider snapshot.

## Applied result

The accepted 18-source canonical plan was applied once in the existing private
project `spring-bread-28217539`, branch `br-sparkling-term-b99l107x`, endpoint
`ep-late-heart-b9mxo8oi`, database `platform_private`. The new SRM namespace has
22 controlled-owner FORCE RLS tables. All **43/43** tables across the existing
access/module/SG2 and new SRM namespaces independently pass ownership and FORCE
RLS readback. All18 ledger versions/checksums exactly match the accepted manifest.

Schema digest `3d8367474454eb15a8171c28bf99f80f51299b58746efa8dfb4f65289de57dcd`; boundary digest
`19220c7bb31365ed058bc55a99bca2aa4a9f38b7f8ca2a2ddde52ec71ed16ed4`. Actual receipt installation time:
`2026-10-17T13:22:35.564347+00:00`. No existing SRM/SG2 product database was changed.
No business data or demo history was copied or assigned to the initial user.
All20 SRM business tables and all5 SG2 business tables independently contain zero
rows; ledger and technical installation receipt are separate control records.

The compatibility policy role `srm_app_runtime` did not exist in this **new**
project before preparation. It was created only here as NOLOGIN/NOINHERIT, without
superuser/BYPASSRLS/CREATEDB/CREATEROLE, connection limit0 and no private CONNECT
or namespace/table/function grants. The existing role of the same name in the
separate legacy SRM project was not modified. It is not the new runtime.

Actual logins for the three existing private runtime roles were verified through
independently authenticated provider SQL connections. Each has limit4, no elevated
flags, no owner/neon-admin membership and no database CREATE/TEMP. SRM cannot use
the SG2 business schema; SG2 runtime and dashboard cannot use SRM's namespace.
They cannot read account authority or SRM installation metadata. SRM receives
only the bounded source-plan report grants. The controlled owner has no standing
database CREATE. Public/alias table and function grants are zero; five unadopted
surfaces retain their restrictive false fence; no foreign key is unvalidated.

Both applications remain **DISABLED**. Each actual runtime login's descriptor
refuses operation (`Runtime binding unavailable`). The same ordinary SRM login
also refused a test INSERT on the restored branch before any row effect. Merely
observing an empty table was not used as proof of denial. Resolving a foreign
schema-qualified metadata name was itself refused to SG2; final ACL readback
uses catalog OIDs without granting it foreign schema access.

## Backup, recovery and preservation

Before primary DDL, snapshot `snap-lingering-mouse-b9mbogk0` was created from the
unchanged Development branch at `2026-10-17T13:18:43Z`, expiring
`2026-10-24T13:18:42Z`. It was actually restored with
`finalize:false` to new branch `br-fragrant-shadow-b9u4sf9l`, endpoint
`ep-bitter-meadow-b99cvhlc`. The original primary/default branch and
endpoint were not swapped. Rehearsal compute is0.25/0.25CU, suspends after300s,
and the branch expires `2026-10-18T13:19:09Z`.

The restored copy contains the real internal directory; it is **not a synthetic
only laboratory**. It remains inside the same private project. No customer
business history was copied. Failure injected after the entire source plan
rolled back namespace, receipt, all grants, compatibility-role creation, temporary
CREATE and clone-only physical rebinding; readback confirmed the original21
tables and absent new schema/role. A subsequent exact successful transaction and
independent readback proved43 tables and the18 accepted ledger entries.

A new explicit digest method, SHA256 over UTF8 JSONB object values with each full
row array ordered by its JSONB text, covers accounts, external identities,
organisations, memberships, permission/product grants, bootstrap receipts and
module bindings. Before, restored copy and after primary application all equal
`b27ee6c26a1af9cda995d46f17b12a8f275101c113de41b4c2db0b08468031c9`. This dated method
is recorded separately; the earlier digest in historical evidence is not
reinterpreted. Existing SG2 schema/boundary/source receipt and zero business rows
were also independently confirmed unchanged.

No DROP, reset, destructive restore, existing-row update on the primary, blind
replay or customer-history reassignment occurred. Snapshot recovery was proved
on a **new** branch; automatic replacement of the primary is not authorized.
Any future recovery must preserve work written after this snapshot and explicitly
reconcile the state before routing services or changing data.

## Gates and live boundaries

Full source/target routing, manifest, own SRM PMOS begin/require-begin and live
Render/Neon drift preflight PASS. Source and local/remote test evidence is in the
separate [candidate acceptance](2026-10-17-srm-private-business-schema.md); these
tests were not relabelled as live browser or deployed product acceptance.

The five existing SG2 runtime/dashboard, SRM Development and both Staging
service deployments were read back live with their previous exact deployment
IDs/SHAs unchanged; details are in
`apps/srm/deployment/private-business-preparation.json`. This unit did not change
Render/GitHub settings, secrets, existing connections, domains, compute plans,
automatic deployments or any product deployment.

The prepared private SRM business organisation rows, business content, full KYS,
user interests and web identity are not yet adopted. KYS SELECT exists only to
plan existing report SQL; no KYS row is admitted. Real Clerk browser session,
all-entry/exports/jobs/cache/files integration, actual Supplier Intelligence
business reuse and controlled Development then Staging releases remain required.
The overall E0/E1 programme is **IN_PROGRESS**, not completed by this preparation.
Own canonical PMOS/PHR closeout follows source publication; MEMOROS stays disabled
for SRM. No Staging/Production continuity is reported as Development.
