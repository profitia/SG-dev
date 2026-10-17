# ARCHITECTURE — bounded supplier export candidate

Task `ARCHITECTURE-E1-SUPPLIER-EXPORT-CONTRACT-20261017`, ARCHITECTURE / Development.
Authority at start `70ad863e0c31b551fdf506ae2eadc47468362a7c`.
Status: **producer source candidate validated; receiver integration and release remain separate**.

## Implemented boundary

Package1.7.0, operation contract1.0.0 / implementation1.0.0-candidate.5, private
host1.2.0. The existing single executor implements the organisation-private
subset of normative AM24. This is fifteen implemented operations, not all thirty
normative rows and not personal/account export support. Read, private projection
and export each require their own enabled operation and explicit current
permission. Existing product, profile, environment, actor, membership, resource,
transaction, module and output guards remain required. An export grant cannot
grant read/project access, perform paid acquisition or enable a job/service.

Inputs are exactly one approved shared supplier_report with no private owner and
one supplier_projection owned by the active organisation. Both must identify the
same logical company as the export; personal data and unversioned/foreign inputs
are refused. No new permission is assigned to a real user by this source change.

Preparation is an explicit server-owned SQL callback, invoked only after all
those checks. It receives the same bounded driver transaction/query and an
immutable project context. Export INTENT and a separate correlated project INTENT
use the existing independent writer. Private restoration, child OUTCOME and
export OUTCOME share one transaction. Later failure rolls those changes/outcomes
back and attempts correlated FAILURE records for each durable intent through the
same writer. A failed FAILURE write preserves an unresolved intent; unknown commit
outcome requires reconciliation and is not safe automatic replay. There is no
second writer, policy engine, runtime, external side-effect atomicity claim or
SQL schema change. SQL001–004, identity adapter and access-store fingerprints are
unchanged. The backend remains trusted to bind its SQL context.

An optional server-owned outcome descriptor records SUCCEEDED, NO_DATA or
SELECTION_UNAVAILABLE after output validation. The latter two do not assert that
a file was delivered. Invalid descriptors fail closed. Existing fourteen
operations retain default outcomes and never invoke export preparation.

## Verification and adoption

- Full exact-path preflight, own PMOS begin and require-begin PASS before edits.
- Package syntax/build PASS; 258 package tests PASS, zero skipped.
- Combined package/laboratory suite: 351 tests PASS, zero skipped, including
  existing ordinary-role PostgreSQL/identity/module/initial-directory fixtures.
  These existing SQL fixtures establish compatibility of the unchanged store;
  actual SQL-backed export/preparation integration belongs to the SRM receiver.
- Dedicated export tests verify independent read/project/export rights and DENY,
  foreign inputs/environment/application, private ownership, personal exclusion,
  versions, preparation order, immutable correlated contexts, audit outage,
  preparation/action/output failure, atomic rollback, actor/product/module expiry,
  accurate no-data outcomes and failed failure-recording behavior.
- Governance suite: 205 tests PASS, zero skipped. No tests weakened to obtain PASS.
- Operation source/type digest:
  `0b19f9ab0aba5623b5557cad37fd38d6548fbdef127dfb2b436db5609bbcc563`.
  Private host source/type digest:
  `b79ba004bfd4d8ca37209e71d81fd3619b95ef9665ebee9780c0413caccdc442`.

Separate SRM receiver must exercise the existing financial XLSX builder and
ordinary-role SQL preparation on its actual API. Separate SG2 receiver must
accept the changed fingerprints and prove existing business compatibility.
Exact aggregate source, PR/CI outcomes and own-profile PMOS/PHR closeout are
recorded by those governed tasks; producer source alone proves neither adoption
nor deployment. No product file, schema, live data, role, grant, credential,
application flag, provider configuration, Development/Staging deployment, domain
or Production resource was changed by this producer task. Full E1 remains open.
