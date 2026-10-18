# E1 — private external request admission candidate

Date: 2026-10-18. Profile ARCHITECTURE, TARGET_ENVIRONMENT=development.
Task: ARCHITECTURE-E1-EXTERNAL-REQUEST-ADMISSION-20261018.
Base: profitia/SG-dev main34f7e6f0c038711fd709d79c1bb74c89be9ebea0.
Status: SOURCE CANDIDATE / LOCAL VALIDATION PASS / RECEIVER AND CI PENDING. Whole E0/E1 remains IN_PROGRESS.

The owner resumed the accepted E1 programme and re-authorised Development
release after completed implementation, tests and all release criteria. This
supersedes the earlier owner hold; it does not authorise immediate release or
waive current governance, safe recovery or product acceptance. Previous PMOS
archives remain unchanged. This source task does not itself deploy.

## Boundary

Optional bounded HUMAN AM23 supplier.report.refresh is private request acceptance
under the current supplier_report module, membership, own user/organisation,
resource, operation permission, product grant and finite PRODUCT_POLICY. The
existing executor, private host and same profitia_requests ledger/writer provide
INTENT and atomic acceptance/OUTCOME; no parallel permission or audit engine.
SQL010 extends existing tables and delegates old Forecast signatures to the
same operation-bound implementation. SQL006 source remains unchanged. Policies
and receipt acceptance cannot be substituted across operations or modules.

No remote acquisition, queue dispatch, private raw command-body retention, KYS/
person-data right, global write, vendor-cost/customer-billing rule, automatic
network retry/refund or exactly-once delivery is provided by ACCEPTED. Caller
integration and remote delivery need their own tested and authorised scope.

## Observed validation so far

-173 executor/host/request unit checks passed, zero skipped.
-20 real disposable PostgreSQL checks passed, zero skipped: current authority,
 concurrency, finite quota, idempotency/content binding, revocation, ordinary
 role/FORCE RLS, audit rollback, exact operation policy FK, cross-operation
 acceptance denial and old Forecast signatures after extension installation.
-Full package/laboratory rerun:703of703 passed, zero skipped. The first run
 exposed one old literal in service-read.test.mjs. Separate governed task
 ARCHITECTURE-E1-SERVICE-READ-COMPATIBILITY-20261018, source d97a8ba, explicitly
 accepted candidate8/host1.6 while retaining every SERVICE read denial. It did
 not change the engine, remove the assertion or rewrite the producer begin.
-Strict public positive and expected-negative TypeScript checks and package
 build passed. Receiver adoption and exact candidate/main CI remain pending.
 No full product or E0/E1 acceptance is claimed.

No cloud schema/role/grant/data/secret/config/flag, provider call, new resource/
cost or deployment was performed. Production/E2-E4 are outside this task.
