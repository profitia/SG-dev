# D1 operational readiness — source proposal, not execution authority

Task: ARCHITECTURE-SG2-FINDER-D1-OPERATIONAL-READINESS-20261103.
Consumer readiness task: SG2-FINDER-D1-OPERATIONAL-READINESS-20261103.
Target Development only. Producer/consumer approvals A1/A2/A3 and all26original
source blobs remain unchanged. Integrated source149d16da2fa0291ca4470f1488d93855b298ac26;
current preparation base b09f072476801c289b6b1483d1bcf3b98fc2648d includes only a
separately accepted Source Hub CI admission since that integration.

## Existing physical scope and real discovery

| Store | Project / branch | Database | Controlled owner |
|---|---|---|---|
| Private/Work | spring-bread-28217539 / br-sparkling-term-b99l107x | platform_private | profitia_access_owner |
| Source | autumn-waterfall-65938876 / br-dry-hall-b294222f | neondb | profitia_ingestion_owner |

Neon project membership identifies tomasz.uscinski@profitia.pl as an organization
and project administrator on both projects. This is an identified control-plane
candidate, **not SQL execution authorization or proof of a named SQL login**.
Ordinary-role catalog inspection found no existing non-superuser/non-BYPASSRLS
CREATEROLE operator. The existing customer owner and provider administration roles
have BYPASSRLS; they were not used, adopted as fallback, or granted authority here.
Both controlled owners are NOLOGIN, NOBYPASSRLS, NOCREATEROLE. No D1 schema or reader
exists; Private revision339 and Source70 remain unchanged. The legacy project
permission endpoint returned404; current organization project-members endpoint
returned the actual membership, and is the basis of that identity finding.

Required Operations decision: designate/attest an actual named operator and
authenticate its SQL login, or explicitly approve a bounded bootstrap of the
proposed sg2_d1_private_install_operator / sg2_d1_source_install_operator logins
with NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB and temporary CREATEROLE plus
SET-only membership of the matching controlled owner. Bootstrap actor/capability
and membership grantor must be named and separately approved. No bootstrap,
CREATE ROLE, SET ROLE, GRANT, secret retrieval or login test was executed live.

## Minimal canonical PMOS bridge

New standalone module: packages/platform-contracts/src/sg2-d1-pmos-audit-adapter.mjs.
It adds no SDK export, dependency/version change, endpoint, product import, PMOS
schema, direct write path, audit store or alternate governance lifecycle.

Production binding invokes existing apps/pmos pmos:begin and pmos:save, with a
profile-bound read-only Prisma readback of prompt_executions and
conversation_artifacts. It uses the existing database identity checker and full
Development bridge preflight before and after begin. SG2 history is written only
through its own SG2 PMOS configuration. The pinned PMOS source checkout is part
of the future approval. A1/A2/A3 source acceptance is not execution approval.

audit.begin requires an actual completed SG2 canonical authorization receipt
containing d1OperationalAuthorization, the expected packet digest, separate
owner/Operations decision references, named operators, exact original producer
and consumer pins, and an unexpired at-most30-minute interval. The future receipt
must be created from actual authority decisions; the adapter never issues them.
It registers a separate execution task derived from the producer-generated
executionRef, binds the fixed5cases/max100 and actor references in promptContent,
and only acknowledges matching persisted registration after registered preflight.

audit.complete requires20matching normalized native-log references (INTENT and
OUTCOME for each of10fixed invocations across the two physical stores), then
canonical closeout/publication and a completed database registration with an
identical persisted flight record containing only counts/hash and technical
references. JSONB field ordering is normalized. Missing DB, incomplete publication,
wrong context, unknown ACK or missing logs withholds output. A lost command ACK is
reconciled by reading the exact record; it never repeats the protected read.
audit.failure records a redacted failure through canonical closeout. An existing
incomplete/successful source is not overwritten with a different failure record;
ordinary canonical pending-input recovery must reconcile it first.

Isolated tests cover actual PostgreSQL committed intent/outcome despite lost ACK,
the approved producer's five-case driver with synthetic responses, fake durability,
blocked preflight, expiry, overflow bounds, missing logs/publication, extra payload,
and immutable settlement. Test-only copies of existing model projections are not
production persistence and do not prove operational CLI/Neon readiness.

## Native Neon LOG: actual gap

Both branches expose low-cardinality log metadata; pg_endpoint queries with a
fixed never-emitted synthetic marker succeed with zero rows. No event was emitted,
no protected read_case was called and no source event was read. This confirms an
API route, not positive PostgreSQL LOG delivery, native payload normalization,
database correlation, rollback durability or retention.

Current settings are stderr, logging_collector off, log_min_messages warning;
do not infer PostgreSQL LOG exclusion from that threshold. Neon log export may
use compute-level collection. The documented3-day Functions/Storage/Realtime
retention is not evidence of native PostgreSQL retention for these projects.
See https://neon.com/docs/reference/metrics-logs and
https://neon.com/docs/introduction/monitor-logs .

The production factory therefore still requires a separately verified native
transport/normalizer; its injected interface and synthetic test references are
not an operational proof. Smallest separate probe: under an explicitly approved
non-owner ordinary connection, emit a fixed-format random technical marker with
RAISE LOG in a transaction and roll it back; retrieve only that marker from the
exact project's branch/endpoint and map dboid to current_database catalog OID.
Obtain actual retention/permission evidence. It creates no object, reads no audit
record and must not enable paid export/configuration without additional consent.
Do not run this probe under the current preparation authorization.

## Expiry, ACL and compensation

Preserve all four original SQL digests. Credentials are separately provisioned
interactively using an approved secret channel (for example psql password input)
and held only in the operator process; no secret in argv, GitHub, PMOS/PHR, logs or
committed config. External provisioning must set password VALID UNTIL no later
than function authorization expiry; the original roles.sql does not do this.
The actual chosen secret channel and bootstrap require Operations approval.

Server-side expires_at remains owner-controlled and denies after30minutes even
for already established sessions. NOLOGIN blocks new sessions but does not end
existing ones, and password expiry is not session termination. Revoke both
EXECUTE and schemaUSAGE and close the dedicated clients; retain a read-only
pg_stat_activity inventory. If remaining sessions require termination, obtain
explicit bounded session-control authority for those dedicated sessions only.
Do not grant broad pg_signal_backend to product runtimes.

Verify PRE-INSTALL, POST-INSTALL, POST-EXPIRY: physical identity; original table
ACL/RLS/FORCE RLS; function owner/SECURITY DEFINER/fixed search_path/body digest;
PUBLIC and inherited EXECUTE/USAGE; default privileges and all memberships;
reader no-admin flags and no baseSELECT/DML; current/old sessions and validity.
The isolated SCRAM test proves an expired password refuses a new login, NOLOGIN
and password expiry leave an existing session alive, and revocation denies it.
Existing accepted D1 server-side expiry evidence is reused, not silently repeated.

No distributed atomicity: if either install or ACL/native-log/ACK check fails,
stop all reads; expire successful D1 side, disable any new reader on the failed
side, restore only approved temporary memberships and retain all receipts.
Overflow or lost output/ACK means no partial disclosure and no blind retry.
REVOKE failure requires checking actual ACL and server expiry; do not claim
revocation from intent. Unresolved sessions require a separately approved bounded
termination or demonstrably expired function and removed effective privileges.
Never DROP CASCADE, delete source audit events, reset revisions/budgets or roll
back Work/Source bindings.

## Future sequence and source boundary

1. Separate source acceptance of this Draft adapter; retain original64d60019 /5f745256.
2. Actual owner and Operations decisions for exact packet, operators, bootstrap,
   secret channel, native-log transport/probe/retention and session control.
3. Canonical installation-task begin before any SQL; verify all physical identities,
   source hashes, existing approvals and effective pre-install permissions.
4. Approved actor creates only the two bounded operator/reader paths, provisions
   expiry, installs original Private then Source SQL with per-store receipts.
5. Verify both installations, effective ACL, server expiry and native-log route;
   no protected call is a setup/health check. Any such call is part of the5case read.
6. Approved driver calls read() once; its audit.begin registers its actual random
   executionRef in canonical PMOS before10fixed read_case invocations.
7. Collect technical log references, persist output hash/counts and canonical
   outcome/publication, and release bounded output only after matching readback.
8. Expire/revoke, close dedicated sessions, restore memberships, verify actual
   final ACL, and close the installation task in its own PMOS/PHR.

H1–H4 retain historical35c92848 deployment; C1 retains b4023cb0. Windows are
[T-5s,T+7s), exactly H1/H2/H3/H4/C1, total100rows across both stores. Unknown
reason remains null and firstCheckpoint NOT_RECORDED; WINDOW_ONLY is not request
causality. No Finder/Forecast replay, provider call, Render change or PostHog
activation is included. Operational status remains BLOCKED until the named
authority and positive native-log/retention evidence exist. Source testing does
not authorize a live read. Source acceptance and SG2 receiving remain separate
gates for this new Draft; no merge is authorized by this preparation task.
