# Platform contracts

Owner: ARCHITECTURE. The Development contract identifies a governance track; `projectKey` does not replace Organisation ID or User ID. SG2 and SRM retain separate governed adoption tasks, versions and source digests. Source merge and product deployment remain separate. Run `npm test` and `npm run build` here; see `Canon/runbooks/shared-development-contract-integration-v1.md` for the existing adoption protocol.

`development-context` retains contract 1.0.0 and its existing source digest. Package 1.11.0 retains the separate `operation-context` export: contract `profitia.operation-context` 1.0.0, implementation `1.0.0-candidate.7`. The Node24 import and require conditions point to the same implementation; hosts use `isOperationDenied` to transport errors safely across bundler/module copies. Audit events bind UTC time, identity proof reference, resource classification/owner/version, access basis and exact product-grant source/version without credentials or payload contents. No network service or framework upgrade is required.

## Embedded read presentation transport

Package1.9.0 adds `embedded-read-channel`, contract `profitia.embedded-read@1.0.0`. It uses only Web MessagePort, JSON and AbortSignal. It imports no React, Clerk, Node module, network client or storage. This is a transport candidate for embedded UI with separate framework builds; it changes no existing operation, identity, policy, SQL, grant or audit implementation. It is not a login, session-sharing, token-exchange or alternative authorisation mechanism.

The application must check the exact child window/source/origin **before** transferring a port. It must bind the parent session, organisation, selected subject and lifetime from trusted application state, use its own closed `parseSelection`, and invoke the actual protected backend for every read. The backend still independently checks current identity, membership, product, operation, source and audit. Only an admitted projected result may be returned by `read`; JSON validity does not classify data or prove that it contains no private fields. Credentials and session values stay in the host and are not channel selections/results. Never accept an endpoint, actor, organisation or permission because a child supplies it.

`openEmbeddedReadHost` and `openEmbeddedReadClient` require an already admitted port and a per-instance identifier. The identifier is correlation, never authority. Exact protocol/version/instance and strictly increasing request IDs refuse replay. Limits are16KiB JSON selection,8MiB JSON result,4 in-flight reads and15s timeout; callers may only reduce them. JSON depth is limited to24; cyclic, sparse, non-JSON and accessor-bearing values are refused. UTF8 byte limits are measured, not estimated from string length. There is no result/grant cache, durable storage, global listener or automatic fallback. Non-success results and unexpected failures carry only a generic diagnostic.

Cancellation crosses the port through AbortSignal. Closing either side aborts outstanding host work and rejects client requests. Host deadlines withhold late data. The optional client `onClose` observer also invalidates an idle view immediately; it runs after cleanup, once, and cannot reopen the channel. A reader must cooperate with cancellation: JavaScript cannot stop arbitrary noncooperative work. Such a reader continues occupying its concurrency slot until it settles; a timeout does not create unbounded replacement work. The application must close ports and unmount/clear the consumer on session/organisation/subject change and verify its window handshake, actual UI/business behavior and backend revocation separately. Library tests do not prove that those application responsibilities have been adopted.

`readPresentationJson` provides the same bounded JSON decoding for already admitted HTTP responses before presentation. It checks JSON MIME, actual UTF8 bytes and shape, releases reader locks and cancels malformed/oversized bodies. It makes no request and checks no credential, destination, status, publisher or operation context: those remain mandatory caller checks. Consumers must not use a JSON decoder as an admission policy. This helper allows parent and server adapters to share one response decoder rather than copying a second one.

SG2 and SRM require separately registered version/compatibility acceptance. An embedded consumer also needs its own actual integration, browser origin/session tests and controlled release. Source package1.9.0 is not proof of live UI readiness, authentication or complete E1.

## Bounded operation candidate

Implemented rules: account settings read/write, market knowledge read, benchmark selection read/write, category read/write, supplier assignment read/write, shared forecast read, personal list read/write, supplier report pure read, organisation-local projection the bounded organisation export, and HUMAN-only private forecast-request acceptance below. Every other operation fails closed. This is not delivery of all 30 target rules, login/onboarding, role administration, delegation/jobs, metered refresh, billing, support or general file/export access.

The host explicitly accepts the implementation/type digest and supplies server-owned authentication, authoritative locked policy/resource/product loading, transaction and output-projection adapters. HTTP headers, a `verified` flag, role names and a previously issued decision cannot grant access. Products and actor permissions are independent. Personal data preserves both organisation and effective-user ownership. A service grant does not impersonate a person; delegation is denied in this candidate.

`withTransaction` must bind the actual limited-role business connection, lock current authority rows (including entitlement/resource versions), set transaction-local organisation/user context, and roll back on any error. The action receives only this transaction and an immutable context. It must not use an owner connection, another transaction, a global singleton, external side effects or an unguarded alternate persistence path. The host projects/validates the result before release. READ operations must have no business writes. Selected WRITE operations are local, idempotent upserts/projections; paid/provider operations are not enabled.

`recordAudit` durably appends INTENT before the action and DENY/FAILURE after rollback. `recordOutcome` writes OUTCOME atomically with the business transaction. If either audit step fails, no result is released and an uncommitted business effect rolls back. Audit storage is append-only to the runtime; record IDs, versions and payload digest, never credentials or payload contents. Database commit failure must retain the intent and produce failure/reconciliation evidence. Returned decisions are diagnostic receipts, not reusable bearer capabilities.

`apps/architecture-lab/src/operation-test-authority.mjs` is a random-key synthetic issuer for isolated tests only. It is not a customer IdP and must never be imported by a deployed route. Real deployment adoption needs separately accepted identity, membership, policy, storage and release adapters; current PORR demo behaviour is preserved until that migration.

Unit tests verify the executor and actual signature checks. Ordinary-role database/API integration, app builds and existing regression suites are separately evidenced by SG2/SRM consumer tasks. Unit PASS is not a product or production security certification.

## Temporary identity provider adapter

Package1.2.0 adds `identity-provider`1.0.0 without changing the development or operation implementation/type digests. `createClerkIdentityAuthenticator` receives a server-owned official Clerk SDK client and a current binding reader. SDK signature verification is followed by fresh session and user authority reads. An absent, revoked, expired, banned, locked, deprovisioned, foreign-origin or impersonated identity fails closed. Provider failures do not fall back to demo, headers or cached ALLOW.

The binding key is environment + exact issuer + provider subject. Internal UUIDs remain Profitia identities; no user is provisioned or linked by email, and no Clerk role, organization or billing claim grants product access. The operation executor still requires current membership, policy, resource and product evidence inside the host's protected transaction. Session revocation is checked at authentication; in-flight operation/revocation semantics still require the separately accepted host authority/transaction and job adapters.

Clerk Development configuration is rejected for Staging/Production. Exact authorized origins and browser mutation origin checks are mandatory. The returned audience is a server-side application binding established through verified issuer/azp, not a claim that the provider supplied a JWT `aud`. Call the adapter for each operation, never treat its returned actor as a reusable permission token. There is no network service, React dependency, provider credential or live account in this package. The lab pins `@clerk/backend`3.25.0 for real SDK tests on synthetic signed tokens and a loopback provider fixture. Product route adoption and real bootstrap remain separate tasks.

## Transactional internal access store candidate

Package1.3.0 adds optional `access-store`1.0.0 and a separately fingerprinted initial SQL schema. It does not change any previously accepted implementation/type digest. There is no automatic migration, startup bootstrap, role grant or live route adoption. `accessSchemaUrl` is an immutable URL string; `accessSchemaDigest()` fingerprints the SQL and `accessStoreSourceDigest()` binds SQL, implementation and types for explicit adoption.

The physical candidate uses ONE private database with separate product schemas/ordinary logins and a `profitia_access` authority schema. Current product databases remain unchanged until separately accepted migrations. Keeping authority, product effects and OUTCOME in the same transaction avoids an unsupported cross-database atomicity claim. Shared market knowledge remains separately bound. Ordinary runtime has only selected SECURITY DEFINER entry points into the authority schema; their owner is a separate NOLOGIN/NOINHERIT/NOBYPASSRLS role, which runtime cannot assume. Every authority table FORCEs RLS, with an explicit controlled-owner policy for those functions. This policy intentionally permits the privileged schema owner; it is not protection against a compromised migration administrator.

`resolveBinding(query,key)` checks actual database/login/role flags, installation and the schema digest, then reads the current provider binding. A request-local host adapter retains that binding as provenance from the verified provider lookup. It never takes this object from HTTP or a cached actor. `lockAccess(query,{actor,identityBinding,organisationId})` rechecks its exact identity/version under a shared policy fence, loads current membership/explicit application permissions/product grants, and binds LOCAL context with a finite deadline and transaction ID. An autocommit/pool-level query cannot acquire a usable lease. A serialized lease cannot be reused.

The host MUST use that same real transaction/query connection for resource loading, business SQL, `verifyScope`, OUTCOME and commit. Product RLS includes the exact application ID and `scope_allows(applicationId,organisationId,userId)`; composite private foreign keys preserve ownership. New DENY insertion and membership/product/account changes conflict with the fence, not just updates of previously selected rows. The fence remains until the host commits or rolls back. Use bounded transaction/statement/idle timeouts; the candidate's global per-installation fence is intentionally simple and needs workload verification before larger SaaS use. No external provider work, network side effect or cross-database write is made atomic by these helpers.

`appendAudit` rejects payloads, unknown/nested fields and recognizable credential forms. Runtime cannot read, update, delete or truncate audit rows. OUTCOME requires the original live lease and is written in the product transaction. Independent INTENT/DENY/FAILURE use a separate audit connection. An unavailable OUTCOME writer rolls back business SQL and may leave a durable unresolved INTENT when FAILURE is also unavailable; that is recovery evidence, not a completed operation or a fabricated audit pair. No reconciler, external log anchoring, service grant, delegation, administration UI or full E1 acceptance is delivered here. See the separate initialization runbook and dated evidence.

## Shared private-operation host candidate

Package1.4.0 adds optional `private-operation-host`1.0.0. It composes the unchanged identity, access-store and operation executor; it does not supply another policy engine, IdP, database writer or runtime. Accept its implementation/type digest **and** the independent identity, access-store/schema and operation digests. Adding this export does not activate an existing application.

`createPrivateOperationHost` snapshots server-owned application and physical store configuration. Each `execute` constructs a request-local authenticator and retains exactly the binding read through that authenticator's current authority lookup. Overlapping requests never share identity/binding state. A provider adapter is injected as `createAuthenticator({resolveBinding})`; the temporary Clerk adapter fits this interface without making Clerk the authorization authority or requiring it in a future identity adapter.

The host supplies `independentQuery` for fresh binding reads and independently committed INTENT/DENY/FAILURE, plus `transact(work,limits)` for the actual ORM/driver transaction. The latter must await the callback once, preserve one ordinary login/connection, enforce the **total** timeout and commit only the returned successful callback. It rolls back on throw. The shared module also sets LOCAL statement/lock/idle timeouts, obtains the live access fence, verifies scope before business execution and before commit, writes OUTCOME in that transaction and rejects detectable skipped/replayed callbacks, pool-level/autocommit SQL or early commit. PostgreSQL16 has no native `transaction_timeout`; SQL statement and idle timeouts alone do not bound several consecutive statements. Each real product driver needs its own cancellation/rollback evidence.

`readResources` returns only server-resolved resource descriptors and optional inputs; it cannot replace membership, policy or products. It must be read-only, respect the bound scope and avoid private logging. `projectOutput` must enforce the output boundary. Business code receives the host transaction; it may not issue transaction-control SQL, switch connections or perform external effects. These are trusted adapter contracts requiring real application tests, not capabilities proven by a configuration string. A malicious adapter or a database credential holder is outside this guarantee. A network failure during COMMIT may leave an unknown outcome: preserve the durable decision ID and reconcile actual OUTCOME/effect before retry; do not claim that every driver error proves rollback or automatically replay an effect.

The package1.4.0 candidate supported the same nine operations. It does not implement the remaining operation catalogue, bootstrap, service grants/jobs, usage reservations, refresh/export, product migrations, live routes or releases. Local PostgreSQL tests verify composition, concurrent identities, RLS, atomic effect/audit, rollback and a driver total-timeout fixture. Official SDK signature/session tests remain a separate complementary proof. SG2's Prisma and SRM's PostgreSQL driver, React18/19 UI and actual deployment acceptance remain distinct receiver tasks.

## Application-to-module scope candidate

Package1.5.0 adds optional `module-scope`1.0.0 and `002-module-scope.sql`. Existing operation, identity, access-store/schema001 and host bytes/fingerprints remain unchanged. The new namespace is initialized separately; no role, application, member, product or module grant is created automatically. This is an additional data boundary inside the accepted private host, with the same policy fence and writer.

An operator-approved, finite-lived application-to-module binding sits above reusable data. It does not put an organisation/user ID or one host application name into the component definition. The current closed catalogue is `benchmark`, `category` and `supplier_report`. Binding a module still requires the actual application/login, current organisation/member scope and matching active product feature. The unchanged operation engine separately requires its supported rule, profile ceiling and exact permission. Enabling an optional module does not implement a new operation or entitlement workflow.

Call `createModuleScopeGuard(...).bind(transactionQuery, scope)` after the private host established its lease and before module resource/data reads. Product RLS uses `profitia_modules.scope_allows(moduleId,rowOrganisationId,rowUserId)`; use a restrictive fence when older permissive policies coexist. It accepts the trusted actual application's approved mapping and preserves the row's organisation/user owners. A marker binds application, actor, organisation, current identity/policy, module-binding version and transaction; it cannot be rebound to another otherwise valid membership in that transaction. Expiry can only narrow the existing lease. The unchanged host's final scope verification rolls back an expired effect.

Module bindings are protected by FORCE RLS under the existing controlled NOLOGIN owner, without direct runtime authority-table ACL. Changes share the installation revision fence. Runtime receives only selected SECURITY DEFINER functions with fixed search paths; its database credentials remain a trusted backend boundary. This does not authenticate an HTTP request, grant module access to a tenant administrator, replace product/operation permissions, create a service grant, or supply another authorization runtime.

The helper returns server-only module provenance. At package1.5.0, the canonical audit recorded policy revision and product evidence and did **not yet add a typed module-binding evidence field**; package1.6.0 adds the optional acceptance described below. Preserve operator change provenance and complete the common audit-envelope acceptance before claiming a full live module audit. No parallel audit writer was introduced. Current product policy files are not automatically relaxed or switched by installing this package. Actual applications, business-module/UI reuse, profile-specific data migrations and releases need separate receiver acceptance.


## Common access candidate 1.6.0

At package1.6.0 the single executor supported **14 explicitly enabled, NOT_APPLICABLE-usage operations**, adding organisation-private category read/write, supplier-assignment read/write and approved shared forecast read. Application features and operations, profile ceilings, membership, explicit permission/DENY and current product grants are still independent requirements. Supplier assignment requires an eligible SPENDGURU or SUPPLIER_INTELLIGENCE offer that explicitly grants `supplier_workspace`; a standalone host cannot borrow SPENDGURU. The chosen entitlement is rechecked after an effect rather than switching products after expiry. At that version paid requests, refresh/export, ingestion, jobs, billing and E2–E4 administration remained closed. Package1.7.0 adds only the bounded organisation export below.

A valid missing/revoked authority result is an access denial; malformed/missing driver rows, configuration/role mismatch and outages remain technical fail-closed. The same distinction survives expiry at INTENT/OUTCOME. Both cases roll back effects. SQL003 uses redacted SQLSTATE `PT403` only for a passed module deadline; pg and Prisma error shapes are normalized without exposing diagnostics. An unknown commit outcome still requires reconciliation, not automatic replay.

A private host can explicitly enable `module: { id, schemaDigest, auditSchemaDigest }`. This binds the existing module guard on the same transaction before resource reads, verifies the separately accepted audit capability, and places immutable server-owned module-binding evidence in context and the same INTENT/OUTCOME/FAILURE writer. Null or incomplete explicit module configuration is rejected. SQL001, SQL002 and the identity verifier remain byte-identical; new SQL003 adds one FORCE RLS installation table and a limited descriptor, then extends **the same** `profitia_access.append_audit`. It preserves previous ordinary append ACLs and creates no account, role, app, permission or module grant. New descriptor EXECUTE is a deliberate receiver grant. Current module provenance, schema digests, owner and deadline are checked; OUTCOME must match its actual transaction scope. DENY/FAILURE preserves historical provenance after rollback/revocation. Runtime still cannot read or rewrite the audit/authority tables.

`clerk-configuration` is one server-only, SDK/React-independent parser for both products. Hosts pass explicit deployment-owned fields. The result contains only publishable key and immutable application/environment/issuer/origins; no credential, DB connection or authority. Development requires test keys; release environments require live keys, HTTPS and a non-Development issuer. Configuration validity does not authenticate a session or prove a real key. Separate receivers must replace their local parser and verify their official SDK/UI compatibility.

These changed operation/store/host fingerprints require separate SG2/SRM tasks and explicit acceptance before publication; a local producer test does not waive a divergent consumer digest. Module activation additionally requires accepted SQL002/SQL003, appropriate ordinary-role ACL, product data policies and real receiver tests. This candidate performs no remote migration, grant, bootstrap, route activation or deployment. Operator-change provenance, retention/reconciliation, full entry/job/cache/file/export coverage, actual business-module reuse and Development/Staging release evidence remain separate E1 work. Database administrators and stolen backend SQL credentials remain outside the HTTP authentication guarantee.

## Initial directory metadata migration

Optional SQL004 adds private display names to internal accounts/organisations, a separately pinned directory installation and an append-only operator-bootstrap receipt. This additive schema does not change the existing operation, store, identity or host APIs/fingerprints and creates no account, membership, product/operation/module grant or application activation. It does not implement self-service onboarding or role administration. Names confer no rights and are never resolved from an HTTP header or used to merge identities.

Only the existing controlled NOLOGIN owner may apply the migration after SQL001–003 acceptance. Its new tables have FORCE RLS and no PUBLIC or ordinary runtime table ACL. An insert trigger validates the same active internal member and exact external binding, and stamps the actual database session user and time. Historical references deliberately do not prevent later authorised identity migration or revocation. Even the controlled data owner cannot UPDATE, DELETE or TRUNCATE a receipt through ordinary DML. A privileged database administrator remains a trusted boundary able to alter schema/disable triggers; this is not an externally anchored tamper-proof ledger. The receipt documents this initial operator action, while normal operation INTENT/OUTCOME remains in the existing single writer.

Execute initial identities, membership, explicit finite grants and the mandatory receipt in one controlled transaction after checking the exact provider subject and approved organisation. Do not link by email alone or assign demo history automatically. Pin the plan digest and actor/source reference without a backend secret or unnecessary personal data in evidence. A failed receipt must roll back the bootstrap. Verify recovery and ordinary-role denial before activation; a prepared database or provider-account read does not prove a real browser session or a deployed application's access boundary.

## Bounded supplier export candidate 1.7.0

Operation candidate.5 adds the fifteenth operation, the organisation-private subset of existing AM24 `supplier.report.export`. It requires an explicit export permission plus current `supplier.report.read` and `supplier.report.project` permissions for the same logical resource, enabled application operations and feature, and SUPPLIER_INTELLIGENCE product access. Exactly two declared inputs are accepted: one approved `SHARED_KNOWLEDGE` supplier_report without private ownership, and one `ORGANISATION_PRIVATE` supplier_projection owned by the active organisation. Both IDs must match the export ID. Personal/account data, foreign ownership, unversioned inputs and unapproved shared projections remain denied. This subset does not implement all of AM24.

Private host1.2.0 requires a server-owned `prepareInputs` callback when export is enabled. Resource descriptor loading must still be free of business effects. Only after all input/permission/product checks does the executor persist export INTENT, then a distinct `supplier.report.project` INTENT with its own decision ID and the same correlation, actor and current authority. Preparation receives the immutable project context and the very same bounded transaction/query used for the export. It may restore scoped private SQL documents; it must not fetch external providers, incur costs, create global knowledge, use another connection or release an external file. The child OUTCOME and export OUTCOME commit atomically with private SQL. A later error rolls those outcomes and changes back, and the existing independent writer attempts correlated FAILURE for both durable intents. Unavailable failure recording leaves recovery evidence, not fabricated completion. An unknown commit outcome still requires reconciliation and cannot safely trigger automatic replay.

After output validation, optional server-owned `describeOutcome` distinguishes `SUCCEEDED`, `NO_DATA` and `SELECTION_UNAVAILABLE`. No-data/invalid-year results do not claim a delivered file. Invalid descriptors fail closed. The previous fourteen operations keep their default SUCCEEDED protocol; preparation is never called for them. Expired actor/access, product or module authority prevents release and rolls back local effects. The host remains framework-neutral; it neither implements Excel nor changes a product route, UI, role, grant, database, flag or deployment. Identity, access-store and SQL001–004 are unchanged. Each product must separately accept the changed operation/host fingerprints and prove its actual SQL/API/output flow before integration or release is claimed.


## Database-authenticated service reads, package1.8.0

At package1.8, access-store1.2.0 and private-operation-host1.3.0 added `createServiceReadHost` to the **same host composition and15-operation executor**. That addition retained operation candidate.5, identity provider semantics and SQL001–004. The current candidate.6 adds only the separately bounded HUMAN request path; service reads remain read-only. Existing human hosts do not load SQL005 or authenticate services; they reject an explicit service binding. Consumers must separately accept the changed store/host fingerprints even when retaining only their human flows.

The service constructor is an internal server/CLI adapter for precisely `knowledge.read`, `forecast.read` and `supplier.report.read`. These normative rows have NOT_APPLICABLE usage. It derives SERVICE/serviceId from the authenticated ordinary SQL login and a current deployment/profile/configuration binding; there is no userId, Clerk account, user membership, request-header identity or on-behalf-of permission. A business application/organisation, exact operation/resource, current explicit service grant, DENY and product feature remain independent requirements. A service grant does not grant its rights to an HTTP caller. This adapter must not be exposed as an unauthenticated public endpoint.

SQL005 creates only three FORCE-RLS technical authority tables and narrow functions, under the controlled NOLOGIN owner. It creates no login/role, application, product grant, customer account or business data. Its technical installation receipt contains the independently pinned full SQL digest. The service binding is explicit: `binding.service = {schemaDigest,profileId,deploymentId,configurationVersion}`; it must agree with the host and actual SQL descriptor. A receipt alone does not prove the SQL catalog after an administrative change. Installation and role/data/ACL acceptance require a separately controlled target, snapshot/rehearsal and exact-catalog validation; this package does not run DDL automatically or upgrade a live role.

An eventual service role needs the accepted base `runtime_descriptor()` entry, the service schema's `runtime_descriptor()`, `lock_read(uuid,text,text,text)`, `scope_allows(text,uuid,text,text)` and constrained `append_audit(jsonb)` entries, plus SELECT only on the specifically accepted prepared projection. Do **not** grant the base unrestricted audit entry, human identity/lock functions, metadata table access, private records, DML or owner membership. Consumer-owned restrictive SELECT policies must bind the approved shared projection to service scope; the fixture policies are examples in a disposable database, not installed product policies. A getter with read-through hydration, source upsert or paid fetch does not qualify as one of these prepared-only reads.

Each execution freshly derives identity, then locks current authority and binds operation/resource/organisation to its actual transaction with LOCAL scope. A short identity/scope deadline is rechecked before outcome/commit; a serialized or pooled scope is insufficient. GUCs are backend scope, not credentials. The authenticated login and current grant determine authority. Installation revision fences serialize revocation against the protected transaction. The independent durable INTENT checks current state without taking a second conflicting SHARE lock behind a queued revocation. OUTCOME remains in the product transaction; errors withhold output and retain correlated FAILURE.

The constrained service audit entry verifies the actual service actor, null subject user, current deployment/profile/grant, shared classification and READ effect, and then invokes the **existing canonical security-event writer**. There is no second event store/writer, fictional HUMAN history or authority from a supplied audit payload. Runtime has no audit UPDATE/DELETE rights.

Local validation:276 package tests and118 full laboratory tests PASS, zero skipped. The new25-test native PostgreSQL family verifies ordinary login, absent customer accounts, all three exact operations, two organisations, current revocation/DENY/product/deployment/digest, fixed/standalone ceilings, private/read-only boundaries under false permissive policies with actual DML ACLs, forged audit refusal, real expiry, independent audit failure, four concurrent reads within business3+audit1, queued revocation without audit deadlock, cross-transaction/serialized lease refusal and full additive-DDL rollback/reapplication. Strict public declarations compile. Product integration and real deployments remain separate evidence.

This bounded foundation grants no AM26 global ingestion, AM27 job execution, delegation, private personal/account data, source writes, provider request, billing or usage budget. Those obligations cannot be inferred from this read role. No product activation or framework/React change is performed by publishing the source.


## Bounded private request reservation candidate 1.10.0

Operation candidate.6 and private-operation-host1.4.0 add the HUMAN-only subset of AM20 forecast.request. It accepts one organisation/user-owned OPERATION_AUDIT request intent, not a forecast result or execution grant. The existing fifteen operations retain their NOT_APPLICABLE usage behavior. New requests require the actual current human identity/member/permission/product/module boundaries, benchmark module evidence, a bounded idempotency key and an explicit current finite PRODUCT_POLICY. The private host requires requestLedger.schemaDigest for SQL006 in the same physical database and ordinary role; missing configuration cannot silently activate a different store. No default or omitted limit becomes an unmetered offer.

request-ledger1.0.0 supplies only a transaction-bound adapter and additive SQL006. The existing controlled NOLOGIN profitia_access_owner remains the schema/function owner; no parallel identity or permission source is introduced. All three new tables use FORCE RLS. Runtime cannot directly insert/update/delete even after an accidental broad table grant. Scoped intent SELECT requires the current user, organisation, module, exact operation permission and product. Owner/member and composite policy/application/organisation foreign keys prevent mismatched ownership independently of the API. Policy definitions and accepted intents are immutable; counters move only forward through closed functions. A deferred database constraint refuses committing an unaccepted reservation.

An opaque client key is hashed with the application/environment/actor/operation. A separate full binding fingerprint also includes organisation, resource and canonical payload digest. Reusing that actor key with changed scope/data conflicts; different actors retain private independent keys. Raw client keys, command payloads, credentials, provider data and scientific results are not stored by this ledger. Its closed receipt is only requestId/status:ACCEPTED. A product adapter may write its own typed private command referencing the request ID in this same SQL transaction. That command is not another forecast compute queue.

After current authority and durable INTENT, the ledger locks the explicit policy, reserves one accepted-request unit and the action writes its private SQL intent. Acceptance, quota and OUTCOME commit together; an error rolls them back while independent INTENT/FAILURE remains. Replays require current authority and policy, skip the action/quota, and project/audit the stored internal receipt afresh. Projection and policy expiry remain checked before return. The SQL/functions bind the actual runtime descriptor, source digest, current module scope, transaction, owner and immutable metadata. The adapter retains per-request policy/reservation provenance, not a reusable access-result cache.

A unit counts one accepted private request. It is not a provider charge, currency quota, measured CPU reservation or proof that computation ran. No provider/global Market write, dispatch, delegated SERVICE execution, job.execute or PLATFORM knowledge.ingest is delivered here. The existing queue and worker remain the sole forecast computation implementation. Those remaining E1 effects, original business preparation/UI integration and controlled Development/Staging release still need their own tested adoption. SQL001–005 and identity/access-store sources remain unchanged. This package does not install SQL, seed a policy, grant privileges, activate a route/flag, publish a registry package or deploy a product automatically.

## Delegated stored-source delivery candidate 1.11.0

Candidate.7/private-operation-host1.5.0 add bounded AM27 `job.execute` and AM26 `knowledge.ingest` paths. The prior sixteen operations remain separate; a service-read host still refuses writes/jobs, and a business profile cannot become PLATFORM_INTERNAL by adding a role label. Universal contracts remain independent of React and UI embedding.

Additive private SQL007 uses the existing NOLOGIN access owner. It provisions no application, runtime, grant or policy. An opted-in HUMAN forecast acceptance can create its private delegation/dispatch inside the same reserved request transaction; a completed historical request or old ALLOW cannot mint another delegation. The protected current operation binding records the initiating application/configuration/profile, foreground runtime, separate executor application, explicit delegation lifetime and exact source project/branch/database/application/schema/quality/classification binding. Composite foreign keys bind request, actor, organisation, resource, payload and original external identity. Private metadata is immutable, FORCE RLS fenced and never a scientific computation queue.

`createDelegatedJobHost().admit()` authenticates the actual ordinary SQL SERVICE and rechecks the current account, original identity binding, organisation, membership, exact target permission/DENY, product, benchmark module and operation/deployment binding. The common executor applies its existing permission/resource/product checks to that current target without manufacturing a HUMAN actor. A fresh replaceable account-status port reads the exact current external account; the Clerk port uses official `users.getUser` without a stored session, email linking, provider organisation or cached ALLOW. Its short observation is not a credential or grant. The private actor and subject remain distinct in audit.

Admission commits READY, an opaque delivery key and a bounded attempt lease before any source effect. It is not publication success. Optional `deliver()` requires a fixed, branded `createPlatformDeliveryPort` from an accepted native source host; caller JSON or a serialized receipt cannot mint it. Before any source query, the private store compares that port's environment and exact source binding with the protected current delegation. A new current private revocation fence then spans source delivery. The port receives only universal content/source/key, with no private actor, organisation, session, command history or private SQL transaction.

SQL008 belongs beside the shared source data under a separate controlled NOLOGIN `profitia_ingestion_owner`. Its seven tables contain technical source/runtime/grant/budget/effect/journal metadata and no customer account, membership or private job schema. PLATFORM ingestion is SERVICE-only with null organisation and subject, explicit SHARED_KNOWLEDGE classification, fixed accepted schema/quality versions, a real ordinary role and current source ALLOW with DENY precedence. The source host requires a native validator of the actual shared payload/catalog; JSON validity or a generic digest does not classify content. Native writes must use its supplied transaction and specifically granted source tables/policies. SQL/GUC scope is trusted backend context, not authentication for arbitrary database clients.

This candidate admits `STORED_SQL_TRANSACTION` only. One finite `SOURCE_TRANSACTION` unit counts one admitted source SQL transaction, not measured CPU, dollars or an external provider charge. After independent durable INTENT, source data, budget consumption, immutable receipt and OUTCOME commit together. The same funded key/data replays without another native write or unit even at capacity; altered data conflicts. Concurrent effects serialize against the finite budget. Replacing an approved window uses a new policy while retaining the old funded history; counters cannot be reset or refunded through runtime access.

A source commit is independent of a later private confirmation. The receipt observation is branded only after the real source driver reports COMMIT; it binds content/key and exact source identity. Private confirmation uses a newly current scope and preserves SERVICE/subject provenance. A source attempt followed by a private failure reports DELIVERY_UNCERTAIN and leaves the prior durable READY admission; the source's committed effect and unit remain. Retrying reauthorises both authorities and observes that same effect. Expired delegations, exhausted attempts or unavailable source authority require controlled reconciliation; they do not authorize a refund, blind repeat or bypass.

These ports add no scheduler, computation algorithm, alternate identity store, auth provider, PMOS writer or product runtime. Actual Forecast queue/worker integration, user-visible preparation behavior, product consumers, exact CI/main proofs and controlled Development/Staging releases require their own evidence. Paid acquisition/refresh, long-running worker CPU/vendor budgets and a private job-status API are not delivered by these generic stored-SQL ports. Existing SQL001–006 bytes are unchanged. No live schema, role, grant, data, secret, flag, service or product deployment is changed by this source candidate.


### Explicit embedded commands — source candidate1.12.0

`embedded-command-channel` is a separate fixed `profitia.embedded-command@1.0.0` presentation contract. It carries a caller intent UUID and an application-parsed JSON command, with one in-flight request,16KiB request,64KiB response and15s observation limits. Only202 is acceptance;200 and read-channel envelopes are refused. The existing `profitia.embedded-read@1.0.0` API and wire semantics remain unchanged. Both wrappers reuse one internal bounded JSON/MessagePort engine. Limits can only be lowered.

The application must admit the exact parent/child window and origin before transferring a port, derive its own environment/series/organisation context, keep credentials in the host, parse a closed domain command and invoke the current protected backend. An intent UUID and MessagePort grant no access. The application owns stable backend idempotency across explicit retries and must verify the actual202 receipt and publication context. Transport does not deduplicate backend effects, choose a destination, sign an actor, retry or store a command. It is independent of React, Clerk and the operation policy engine.

Timeout, cancellation, page/session change or port close stop observation; the backend may already have committed. They never prove absent delivery, rollback, refund, queue state or scientific readiness. A transport failure exposes only a generic unavailable observation; preserve the intent on an explicit retry. A202 acceptance remains separate from actual shared queue/prepared states. Application integration and live release require their own evidence.

Consumer source acceptance must cover the transitive `embedded-channel-core.mjs` bytes as well as the selected wrapper and types, rather than treat the read wrapper hash alone as the complete implementation. SG2 embedding adoption and SRM compatibility use separate governed tasks and their own continuity. No source package version activates a product or changes live resources.


## Optional external-call admission candidate (1.13.0)

`@profitia/platform-contracts/external-call` composes the existing authentic
`platform-ingestion` host and its single source audit writer. Optional SQL009
is installed by the same controlled NOLOGIN owner. Old SQL008, operation
catalogue, private request/delegation and browser READ/COMMAND APIs stay unchanged.
No React version or new worker/runtime/queue is involved.

This source primitive is **not** a HUMAN supplier refresh, Finder AI entitlement,
KYS/PII approval, tenant authorization, vendor billing counter or customer charge.
The receiving application must admit those separately. Source/installation,
physical ordinary role, application/environment, source actor/binding revision,
source policy revision, fixed origin/path/method and finite external policy are
checked against the real database. Missing policy denies. HTTP is allowed only
for actual Development loopback tests with `SYNTHETIC_ONLY`; HTTPS is required
otherwise. No TLS verification bypass is supported.

A server caller supplies a private random 256-bit intent key, kept outside logs
and never derived from a public button/selection key. Reuse it for recovery of
that exact intent. Input values and the signal reference are captured for the
entire invocation. Different input with the same key conflicts. A unique opaque
intent binding survives technical actor, role, policy and configuration changes;
a new source proof does not reopen a previously admitted intent. Request and
projected-response bindings use HMAC with that key; the shared control store
contains only opaque identifiers/digests and states. No query, body, response,
credential, user or organisation is stored there. Do not mint a new intent key
as an automatic retry of an uncertain prior attempt.

PLAN atomically consumes one `UPSTREAM_ATTEMPT_ADMISSION`. ATTEMPT must be freshly
written and its actual commit observed by this adapter before the one fetch
invocation. PLAN/ATTEMPT/SETTLE each separately consume the existing truthful
`SOURCE_TRANSACTION` unit. Admissions are conservative, finite and never refunded
automatically. They are not evidence of vendor requests received or vendor cost.
An acknowledgement lost after PLAN may recover the still PLANNED intent. Lost
ATTEMPT acknowledgement, transport failure, timeout or caller cancellation cannot
mint another fetch. Lost response or SETTLE acknowledgement cannot report success
or recreate an unretained body. Replays expose no body: result availability is
intentionally distinct from a durable source receipt. No exactly-once network or
billing guarantee is made; a process crash can leave an admitted attempt unused
or unresolved. Operator reconciliation is a separately governed future task.

Request bytes (URL plus optional JSON body), response JSON, depth, duration and
cancellation are bounded. Destination and projection are server-owned, redirects
are refused, credentials are deferred until after the observed attempt commit,
and policy is rechecked after credential lookup and before result publication.
The deadline cannot exceed the observed current authority expiry. Projection is
a pure, bounded server callback and cannot hide another side effect.
Credential callbacks may only return already available header values; token
exchange or other network work needs its own admission. Revocation observed after
a response denies publication; a database check and a remote effect are not one
atomic transaction. Retaining an admission is not permission to retain vendor
content; licensing, retention and customer privacy rules remain caller duties.

Only the actual returned result has in-process `externalCallEvidence`. Copying a
receipt/result does not grant authority. HTTP 4xx/5xx with an admitted projection
are observed responses, not business success. Generic unavailability discloses
only `NOT_SENT`, `UNVERIFIED` or `RESULT_NOT_RETAINED`, with automatic retry disabled.

The candidate has no automatic application adoption, package registry publication,
cloud SQL installation, grants, provider request or product deployment. Explicit
SG2/SRM lock and compatibility acceptance and controlled releases remain required.


## Private supplier refresh request admission (1.14 source candidate)

The existing operation executor/private host/request ledger additionally accept
bounded HUMAN `supplier.report.refresh` (AM23). This accepts an organisation/user
private intent under the current supplier_report module, membership, explicit
product/permission and finite PRODUCT_POLICY. SQL010 extends the same SQL006
ledger and canonical writer; old Forecast signatures are adapters to the same
operation-bound logic. An operation-inclusive foreign key prevents funding a
supplier intent with a Forecast policy. SQL006 source stays unchanged.

The AM23 host requires both the base SQL006 digest and accepted SQL010 extension
digest. The receipt means ACCEPTED private intent only. It performs no provider
I/O, queue dispatch, data acquisition, KYS/person-data access, global write or
customer billing. It cannot be used as a network delivery receipt or authorise
an automatic retry/refund. Actual external delivery, caller adoption and product
release remain independent requirements. Raw command bodies are not retained
in the shared intent ledger. Positive/negative isolated tests do not install a
cloud migration or activate a product flag.
