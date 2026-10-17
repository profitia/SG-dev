# Private SpendGuru business schema — candidate 1.0.0

`001-business-schema.sql` creates the five unchanged Prisma models in a **new**
`sg_runtime_benchmarks` namespace, plus a technical installation receipt. It is
not a customer-data migration, application activation, role provisioner or
permission grant. Existing demo/product databases are outside this migration.

All six tables belong to the controlled `profitia_access_owner` and use ENABLE
and FORCE RLS. The accepted `../security/benchmark-private-boundaries.sql` admits
only the three benchmark tables under the existing access/module boundary.
Category and CategoryCostComponent intentionally have no admission policies.
Their future adoption requires its own policies, business tests and acceptance;
creating their Prisma shape does not enable a feature.

## Controlled operator contract

Before any cloud application, satisfy the active profile/environment governance,
PMOS when applicable, exact resource drift gates, accepted source SHA, recovery
snapshot and restore rehearsal. Verify the physical project, branch, database,
ordinary role inventory and expected **empty namespace**. Do not use a URL
copied from an old report or log, and do not print credentials.

1. Verify the published SHA-256 of this exact SQL and the separate boundary SQL.
   Confirm accepted access 001, module 002 and audit 003 installations. Validate
   the controlled owner and its default ACLs; unexpected global grants block.
2. In one checked transaction, temporarily give the controlled owner only the
   required database CREATE privilege, `SET LOCAL ROLE profitia_access_owner`,
   execute the exact business DDL and boundary SQL, and insert one
   `private_installation` row with version `1.0.0`, both actual source digests and
   the accepted non-sensitive source reference. Record the actual session user.
3. Verify every table owner, FORCE RLS, policies and foreign keys. Explicit
   ordinary table ACLs are a separate reviewed step: no default, PUBLIC, owner
   membership, schema CREATE, direct control/audit access or unadopted-category
   grants. Revoke the owner's temporary database CREATE in that same transaction
   and commit only after all exact guards pass.
4. Read back the receipt and actual ordinary-role denial; then test accepted
   operations using their shared host. This migration grants none and activates
   no application or identity provider.

The source deliberately refuses every pre-existing namespace, including an empty
one, instead of guessing its provenance. After a known or unknown commit outcome,
read and reconcile the receipt, exact digests, owners/policies and data first.
Do not automatically replay, drop, reset or rewrite state. Failure inside the
initial transaction rolls all new schema effects back. Later code rollback is
not permission to drop data; use the accepted recovery contract.

## Evidence boundary

`tests/private-business-schema.test.mjs` runs this exact SQL on a guarded local
PostgreSQL, compares the actual schema with the existing Prisma datamodel and
checks rejection, atomic failure, ACLs/RLS and preservation on retry. The existing
`private-host.integration.test.mjs` also uses this exact migration, not `db push`,
for its actual API/Prisma/module/audit business and isolation tests. Local fixture
resets are permitted only for explicitly guarded loopback test databases. They
are never a cloud migration procedure.
