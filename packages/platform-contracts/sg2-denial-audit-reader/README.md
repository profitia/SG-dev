# D1 five-case technical denial reader — source preparation

Status: preparation candidate, not installed or operational. Owner authority is
`SG2-FINDER-D1-AUDIT-READER-20261103`; producer task is
`ARCHITECTURE-SG2-D1-AUDIT-READER-20261103`. Private E1/Work producer and Source
producer require independent architectural approval before installation. SG2
consumer adoption and operational installation approval remain separate.

The only cases are H1/H2/H3/H4 on02Nov16:59:12/17:10:07/17:10:56/17:13:51UTC and
C1 on03Nov04:22:49UTC. Every window is[T−5s,T+7s). Historical deployment35c9284,
currentb402, exact full IDs are fixed in SQL and JavaScript. The operator reads all
five cases from both stores; no client filters, arbitrary SQL or generic audit API.

## Producer boundaries and least privilege

Private projection: `profitia_access.security_events` in platform_private,
spring-bread-28217539/br-sparkling-term-b99l107x, existing NOLOGIN owner
profitia_access_owner. Source projection: `profitia_ingestion.security_events` in
neondb, autumn-waterfall-65938876/br-dry-hall-b294222f, owner
profitia_ingestion_owner. Current catalog columns were independently inspected:
both expose event_id/recorded_at/application_id/environment/decision_id/phase/event;
Private has an object/size CHECK, Source has additional restrictive owner fences.
No equivalence of complete schemas is assumed; original migrations remain intact.

Each dedicated reader gets only USAGE on its new projection schema and EXECUTE on
read_case(text). No original table/schema privileges, DML, owner membership,
admin/BYPASSRLS/CREATEROLE/CREATEDB/REPLICATION or inheritance. Both existing FORCE
RLS policies remain unchanged. session_user must be the dedicated LOGIN principal;
its role attributes and absence of memberships are rechecked per call. Another
role, including a controlled owner session, cannot use its EXECUTE to impersonate
the reader. Function SECURITY DEFINER is required to project under the existing
owner-only RLS. Fixed pg_catalog,pg_temp search_path, qualified relations and no
dynamic SQL prevent caller name resolution from choosing a table/function.

The new owner-only authorization row expires30minutes after installation. No
automatic renewal or reinstall: CREATE fails when objects already exist. Extending
authorization requires a new explicit operator approval; runtime cannot update
the row. Credentials are not generated or stored by these artifacts; separately
approved operator provisioning must confine them to the controlled driver and
limit credential lifetime to the same window. expire.sql removes EXECUTE/USAGE
and sets NOLOGIN, preserving all objects/history for forensics. Role expiry alone
does not terminate existing connections; EXECUTE removal and function expiry are
the enforced controls, with residual sessions inventoried during closeout.

## Output and execution audit

Only DENY DECISION/FAILURE rows matching exact environment/application-operation
pairs, deploymentId and recorded_at window are projected. No raw event, actor,
organisation, resource, decision/correlation IDs or business/private payload.
Known reason codes use the existing E1 closed enum; malformed/unknown reason is
null, never echoed. recorded_at is canonical UTC; event timestamps and optional
historical correlation are deliberately omitted as unnecessary for this minimal
version. firstCheckpoint=NOT_RECORDED; correlationEvidence=WINDOW_ONLY. A row is
not correlated to a particular HTTP request merely because its timestamp matches.
Empty results mean NOT_RECORDED, not absence of a denial.

The only source public function is createFiveCaseReader. It requires a trusted
durable audit adapter. A valid begin acknowledgement with bounded expiry precedes
every protected query; an outcome with output SHA256 precedes output release.
The driver buffers both stores/all five cases, checks the strict output schema and
total<=100, and releases nothing after overflow, malformed data, missing database
or lost outcome acknowledgement. Each SQL function also stops above100rows.
The combined quota is enforced by the controlled driver; SQL credentials must
never be made available for unrestricted direct repeated invocation.

Native fixed-format RAISE LOG INTENT/OUTCOME/REJECTED records are independent of
caller transaction rollback. Only new execution references, fixed store/case and
counts are logged, not historical IDs or event contents. Local PostgreSQL tests
verify both delivered log messages and physical server log after caller ROLLBACK.
Active Neon native logging, retention and retrieval have NOT been verified. Those
are mandatory installation gates. This is separate from Sentry; no product
instrumentation or SDK configuration changes. Monitoring: NOT_APPLICABLE to the
unchanged SG2 runtime; operator execution audit is mandatory, not optional telemetry.

The adapter interface is not proof of a deployed audit sink. The SG2 execution
adapter must obtain real canonical PMOS begin/save acknowledgements and bind
the10native invocation references before release. Test acknowledgements are
synthetic. No direct PMOS database writes or alternate continuity are introduced.

## Installation plan — NOT AUTHORIZED

1. Obtain exact producer SHA/SQL digests and separate Private, Source, SG2 adoption
   and infrastructure approvals. Designate named authenticated role administrators
   and controlled-schema operators for each database; none is currently approved
   for this task. Never default to an owner connection from a URL/MCP tool.
2. Snapshot physical project/branch/database, base installation revisions,
   columns/constraints/RLS/policies, role attributes/memberships/ACLs and absence of
   the new schemas/roles. Preserve checksums and canonical pre-install PMOS intent.
   Unexpected existing objects, endpoint or concurrent authority change stops work.
3. Separately authorized role administrator executes roles.sql only in its exact
   approved database and provisions credentials using the protected provider path.
   This is a proposed CREATE ROLE, not a grant of permission to run it now.
4. Controlled operator assumes only the approved existing NOLOGIN owner for the
   matching private.sql/source.sql. Each artifact is one transaction; no atomocity
   across databases is claimed. Record source digest, installed function definition,
   granted USAGE/EXECUTE and expires_at. Shared Access/Source revisions must remain
   unchanged: no binding, source policy, original audit or installation row update.
5. Verify actual ordinary-role denial of raw SELECT/DML/owner escalation, expiry,
   native log retrieval and bounded positive read with canonical operator audit.
   Use fixed historical cases only; no new Finder/Forecast/provider activity.
6. Invoke the audited driver once for all five cases/both databases. Missing store,
   overflow or insufficient native/durable audit proof withholds output. Reconcile
   lost acknowledgement before any repeat; no inferred checkpoint or root cause.
7. Persist redacted output, invocation references, counts/hash and qualification in
   canonical PMOS/PHR before output release. Execute separately approved expire.sql
   in both databases, verify NOLOGIN/EXECUTE/USAGE removal and active sessions,
   preserve original logs and receipts, and prove unchanged authority revisions.

If role preparation succeeds but schema installation fails, disable only that
new dedicated role via the approved role administrator. If one schema installation
fails after the other commits, stop all reads, expire the successful side with
expire.sql and disable the other new role. Preserve both attempts, receipts and
objects; inspect actual state before retry. No DROP CASCADE, role membership,
RLS changes, base-table mutation or shared-revision compensation is needed.

Exact digests belong to the final PR/installation manifest. A changed artifact,
operator, scope or approval invalidates installation authority. No merge, live
installation, environment changes, binding repair, deployment or SDK activation
is performed by this source preparation.
