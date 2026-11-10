# Insights report — Development E1 candidate

Producer task: ARCH-OIL-E1-REPORT-ADOPTION-20261109. Candidate only, not admission or activation.
Four explicit operations use the existing operation executor and market product feature:
start (WRITE), status/list (READ), download (EXPORT); organisation-private insights_report.
Existing matrix rows and old access modes are preserved. No existing grant admits a new operation.

HUMAN: current Clerk/Identity authority observation before and after the same receiving SQL
transaction. An authority change rolls back the queued job. The new receiver RLS validates
its signed transaction-bound proof and the exact report operation, organisation and resource.
SERVICE: ordinary SQL login, existing AccessStore identity and operation engine; separate
current report grants/profile, bounded reservations and canonical security-event writer.
The old read-only SERVICE host still cannot execute report writes.

007 extends the current central authority; 008 extends a receiver after its existing 002
foundation; 009 adds report grants/profile/reservations without changing old read grants.
Install the private report archive in the existing SG Runtime private database
spring-bread-28217539 / br-sparkling-term-b99l107x / platform_private. No directory mirror.

The previously accepted optional model Source contract is exposed as model-execution.
Its historical SQL is named 030/031 because 028/029 now belong to other accepted Source
contracts. An existing installation with the identical digest is adopted, never recreated.
032 adds owner-installed bounded attempt templates for business edition keys. Each template
issues at most one immutable policy per edition and one upstream admission per policy.
Unknown holds and reservations survive revocation; no retry or global UNMETERED change.
The legacy Source estimate is not an invoice; the application uses separately current,
source-referenced pricing and retains unknown counter liability.

No credential, role, product/permission grant, receiver, Source template or deployment is
activated by this source change. Exact source/consumer adoption and required controlled CI
must pass before merge. Existing historical receipts are not rewritten. The maintenance
installer verifies exact approved SQL hashes, existing installers, actual branch identities
and backup references; it never grants itself SET ROLE membership or logs secret bindings.
Cross-database commits are separate: keep each receipt and stop/reconcile on partial failure.

Tests: actual isolated PostgreSQL ordinary roles, four native SERVICE operations, signed
HUMAN authority/receiver proofs, parent entitlement, cross-organisation scope, current
revocation, bounded budget/edition idempotency and Source child-policy revocation.
Not a LIVE Development acceptance or provider/model request.
