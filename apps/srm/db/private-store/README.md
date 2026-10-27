# SRM private business initialization candidate

`privateBusinessPlan` is a pure, checked plan for a separately authorized operator
transaction. It does not connect, provision roles, activate applications, copy
customer history, change the existing demo database or deploy a service.

The 18 pinned source files remain byte-identical. The existing Stage migrator and
this adapter consume the same `migrationStatements` and checksum/ledger logic.
The existing Stage CLI, destination allowlist and authorization remain intact.
The adapter uses native PostgreSQL `EXECUTE ... USING` for transport of unchanged
source and bound ledger statements; it neither splits SQL nor interpolates
migration placeholders. Later appended migrations require explicit private-store
adoption; they are not silently installed.

Before execution, verify the exact provider project/branch/database, accepted
source SHA, control/module/audit installations and runtime role. Supply that
trusted physical binding to the builder. Execute **every returned statement in
one outer transaction**. The plan checks the database against its recorded
installation, rejects an existing `srm` namespace, active applications, an
unbound/elevated runtime, standing owner CREATE and unsafe default ACLs. SQL
cannot independently attest a provider's project ID: live provider evidence is
still required. A returned plan is not governance or deployment authorization.

The controlled `profitia_access_owner` temporarily receives database CREATE;
all 22 tables are created by it with FORCE RLS, then temporary CREATE is revoked
before commit. Ledger and installation receipt are owner-only. The ordinary
runtime has bounded privileges for the accepted report read/projection path.
It cannot write corporate shared knowledge, DELETE business rows or read control
metadata. Five not-yet-adopted surfaces have a restrictive false fence. KYS has
SELECT only for existing report SQL planning; **no KYS rows are admitted**. This
is not full KYS feature acceptance. Identity/user interests and web identity
remain inaccessible pending their own adoption.

Immutable legacy SQL names `srm_app_runtime`. In the new project the operator
must prepare that compatibility policy role NOLOGIN, unbound and without private
CONNECT. The plan never alters its global attributes and revokes all of its new
namespace grants. Local tests intentionally preserve the sibling legacy LOGIN
role, while revoking its CONNECT only to the named private fixture database.
It is not the private runtime and receives no private credential.

On error roll back the entire transaction and inspect actual state. An existing
namespace or an uncertain COMMIT requires ledger/receipt readback and explicit
reconciliation, not blind replay or schema reset. No cloud reset/drop is supplied.
An operator must separately prove snapshot/recovery, record installation hashes,
verify effective role/table privileges and keep applications disabled until the
controlled release is functionally ready. Source tests do not prove cloud
installation, browser login, all-entry coverage or Development/Staging release.

## Optional named supplier interest — SQL003

After accepted SQL002, a controlled installer may apply
`003-named-supplier-interest.sql` only to the verified NEW private store while
SRM is disabled. Record the exact SQL digest and accepted source SHA in
`named_interest_installation`; grant the ordinary SRM runtime only the required
SELECT/INSERT/UPDATE on the three existing user/interest tables and EXECUTE on
`named_interest_descriptor()` and `named_interest_actor(uuid)`. This document and
SQL source do not perform cloud grants, activation or a migration. Keep the
original initializer and its eighteen source migrations unchanged.

The authenticated adapter is explicit opt-in through
`namedInterestBoundaryDigest`. Its `interest(selection)` method uses the existing
`RECORD_INTEREST` continuation, original accepted actor/organization/NIP/request,
current rights, same native transaction and canonical OUTCOME. It creates no
second logical request quota unit. Replay authenticates the current parent and
returns its existing phase status without executing the business writer again;
it is not a new data delivery or a new physical write.

There is one internal Profitia account ID. Existing SRM `users.id` remains a
local surrogate scoped by organization; its authenticated subject key is
`profitia-account:<internal account UUID>`. The same account in two organizations
has distinct SRM surrogates. No Clerk subject/email is an ownership key and no
core account is created by this adapter. Demo mappings and personal history are
neither converted nor reassigned.

Only `users`, `organization_supplier_interest` and `user_supplier_interest`
leave their former CLOSED state. Current module/identity scope fences all three;
personal rows additionally require the current account's own local mapping.
Writes require the exact currently RESERVED `RECORD_INTEREST` phase, owned parent
and NIP in that transaction. Identity and first-selection fields are immutable,
selection times are database-stamped, and deletion/truncation is refused. The
shared corporate catalog must already contain the company. A named user's
choice never creates a global catalog placeholder; only the unchanged legacy
path retains its existing placeholder behavior.

`recordSupplierInterest` contains the common domain persistence behind both
paths, taking an explicit client and actor key. Authentication/admission remains
with the host and SQL fences. There is no fallback pool for the named path, no
new audit writer and no HTTP endpoint or user-list UI adoption in this source
increment. KYS and web identity remain CLOSED. A source acceptance test does not
prove live directory, role, data, session or recovery readiness.

## Optional supplier locations — SQL019 + SRM SQL013 (TASK02)

This is a separate optional adoption after the existing private-store initializer.
Do not append SQL013 to the eighteen pinned baseline migrations or change their
manifest. `013-supplier-locations.sql` creates organisation/supplier collections,
locations and an immutable installation receipt. Location authors reference E1
accounts; authorship does not make the row personal. Runtime roles receive no
direct table DML, default operation permissions, activation or paid allowance.

The source is ready for a controlled Development installation; it is **not
installed or activated** by this change. The target receipt is
`../../deployment/supplier-location-targets.json`. Recompute its business digest
from the exact SQL bytes at the accepted source SHA before installation. The
current E1 prerequisites are package 1.24.0, Root candidate.16, SQL017 digest
`a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94`, and SQL019
digest `34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5`.

The release operator must complete these gates, in order:

1. Refresh authority and verify the exact accepted commit, Root eight-file digest,
   both SQL byte digests, provider project/branch/database, ordinary runtime role
   and controlled `profitia_access_owner` (NOLOGIN, NOINHERIT, no elevated flags or
   inherited memberships). Record current installation descriptors and grants.
2. Obtain an approved recovery point covering the **current** database, prove its
   restore in an authorised isolated setting, and record the current Render LKG
   commit, deployment/artifact ID and digest, configuration version and schema
   state. An older backup or another task's restore receipt is not automatically
   this task's recovery proof. Creating a new Neon branch/snapshot is reserved to
   the owner. Do not create one implicitly.
3. Obtain a coordinated Development window for **all applications in the shared
   receiver**, including SRM and SG2. Drain protected work and disable bindings
   lawfully; the SQL019/SQL013 guards require all bindings DISABLED. Do not turn
   off an active service just to satisfy the guard. Re-read state immediately
   before installation and preserve its pre-window status for restoration.
4. In one outer transaction, under the controlled owner, execute the unchanged
   accepted SQL019 installation procedure and its exact immutable receipt, then
   the unchanged SQL013 bytes. Insert the one SQL013 receipt with schema version
   `1.0.0`, the verified SQL013 SHA256 and accepted 40-character source commit.
   Do not interpolate source or relax a guard. On any error roll back the entire
   transaction. An uncertain COMMIT requires receipt readback before any retry.
5. Grant only the required EXECUTE entry points to the ordinary HUMAN runtime:
   `location_installation_descriptor`, `location_metadata`, `location_page`,
   `location_manual_write`, `location_sync_target`, `location_sync_write`,
   `location_expire`, `location_sources_admitted`, and
   `location_work_catalog_row(text,text)` (the boolean catalog RLS helper).
   Use their exact signatures from SQL013 and retain the separately adopted E1
   SQL019 descriptor/evidence/permission/location-scope grants. Internal
   SECURITY DEFINER helpers and tables receive no additional runtime privileges.
   The fixture's explicit grant list is an executable reference, not cloud
   installation authority. Never copy its test-only administrator seeding.
6. Owner-review separate current `supplier.location.read`, `.write` and `.sync`
   permissions and existing report/source rights. Read back FORCE RLS, ownership,
   PUBLIC revocations, installation receipts and effective ordinary-role grants.
   Before persisting KYS derivatives, adopt and prove the existing approved
   private-source retention cleanup through the controlled expiry port; protected
   read-time cleanup alone is not background retention acceptance.
   Prove ordinary-role read/write/replay/audit/CAS, same-organisation sharing,
   cross-organisation denial and revocation before restoring authorised bindings.
7. Build the accepted source and verify the exact artefact and rollback. Initially
   keep `PROFITIA_SUPPLIER_LOCATIONS_ENABLED=false`. After installation acceptance,
   activate core A and presentation B only with
   `PROFITIA_SUPPLIER_LOCATIONS_ENABLED=true` and
   `PROFITIA_SUPPLIER_LOCATIONS_CONFIGURATION_VERSION=srm-supplier-locations-v1`
   on the exact server-bound Development target. Verify actual authenticated
   report refresh, persistence/reload, two users and two organisations. A source
   test or feature flag alone is not release acceptance.

Paid geocoding C is **independent and inactive**. The conditional request factory
in `src/server/supplier-location-geocoding.ts` and command in Maps Runtime require
an explicitly reviewed existing SERVICE executor, current execution grants,
existing job binding, Source external-call host and owner-approved Google project,
key restrictions and positive cost budget. There is no public geocoding proxy.
Without that adoption they return WAITING_OWNER with zero provider attempts.
Grant a reviewed HUMAN requester only `location_geocode_metadata`; grant the
reviewed SERVICE only `location_geocode_target` / `location_geocode_store` plus
the already accepted common Work/Source entry points, never direct table access.

Shared Google coordinates use a 29-day cache, capped by private-source retention.
Before enabling C, approve and prove an **existing** maintenance execution at most
24 hours apart so physical expiry occurs within Google's 30-day ceiling.
`location_expire_controlled()` is a controlled-owner-only SECURITY INVOKER port;
do not grant it to HUMAN/SERVICE runtimes or create a scheduler as a side effect.
Current protected reads also perform bounded expiry and withhold expired data.
Private KYS-derived rows are removed at expiry; source-right revocation hides
their data immediately. Manual postal data survives source refresh/expiry.

Rollback starts by disabling the feature and stopping propagation, then restoring
the verified prior runtime/configuration and approved database recovery where
needed. Do not automatically reverse data migrations, drop populated tables or
overwrite newer shared work. Recovery authority and executable proof remain
mandatory before deployment.

# Financial fact guard performance (explicit adoption)

`015-financial-fact-guard.sql` is an optional, controlled operator patch after
SQL010. It skips only the sensitive KYS/JDG dispatch check for `financial_facts`,
which cannot be written by a sensitive purpose. Every row still passes the
original corporate provenance/phase guard and unchanged restrictive E1 and
tenant RLS. It does not change grants, financial values, transaction boundaries,
policy expiry, audit or the 15-second E1 deadline.

Apply only the reviewed file in one transaction as the existing
`profitia_access_owner`, after saving and verifying the exact original function.
The file refuses unknown function bytes, owner or configuration, preserves its
ACL and accepts an already applied identical patch. Restore the saved original
definition only when the current function still matches the patch digest; stop
on later source drift. Historical migration bytes and installation receipts are
unchanged. No automatic runtime migration is introduced.

When adopting Supplier Locations, the ordinary jobs role also needs EXECUTE on
`srm.location_admission_installation_descriptor()` and
`profitia_access.scope_allows(text,uuid,uuid)` used by existing restrictive RLS.
Both the ordinary jobs and corporate Source roles need EXECUTE on
`srm.location_work_catalog_row(text,text)`. Bind these exact functions to the
existing, verified environment roles; these boolean/descriptor helpers do not
grant a location operation, table access or Google geocoding permission.

## Optional Financial-only corporate publication

`018-financial-only-publication.sql` adds one controlled Source port for the
existing `preserveGeneral` writer. It requires a strictly empty `NOT_REQUESTED`
General envelope and preserves the unchanged MGBI Financial field allowlist,
current Source admission, immutable publication and same-transaction OUTCOME.
It neither fetches MGBI Registry nor labels KRS data as MGBI General.

Install atomically as the existing `profitia_ingestion_owner`; grant EXECUTE only
to the explicitly reviewed existing corporate Source role. SQL004/005, their
installation/digests, existing function definitions/ACLs and old runtime packets
remain unchanged. The application fails closed when this optional port is
absent. Artifact rollback can leave the unused additive port installed; never
erase accepted publications, financial history or counters to roll back code.

## Financial batch checks and identical-revision replay

`020-corporate-batch-guards.sql` and `021-financial-batch-guard.sql` are explicit
SRM adoptions, installed atomically by the existing `profitia_access_owner`.
They retain the original shared E1 Source/Native Work hosts and all revocation,
classification, ordinary-role, tenant, transaction and OUTCOME requirements.
No shared platform contract or historical installation digest is rewritten.

The application supplies transaction-local NIP/snapshot selectors. They are not
proofs: an uncorrelated policy subquery invokes the existing current E1 verifier
for each SQL statement. Its result admits only that exact NIP or organization,
supplier and financial snapshot. Legacy paths retain their original policy arm.
Transition-table triggers validate the actual inserted/updated rows as a set;
DELETE/TRUNCATE and private fact UPDATE remain prohibited. Packet values,
provenance, indicator input lineage and final publication completeness remain
checked. There is no request/session permission TTL or cross-statement ALLOW.

The Source publication key identifies the entire classified packet, including
source/issuer, periods and observation metadata. An identical accepted packet
uses the existing checked, audited idempotent Source receipt. Each customer's
lookup, private attempt and snapshot retain their own history. New evidence or
observation metadata produces a different publication; no financial history is
removed or relabelled.

Before installation capture exact affected policies, triggers, function
identities and ACLs, compare them to the accepted release, and retain a recovery
script. The two selector helpers copy only the existing corresponding scope
functions' EXECUTE callers; they grant no new table access or business operation.
The application remains compatible before SQL adoption (original policy arms)
and the previous runtime remains compatible afterward. Runtime rollback leaves
these equivalent SQL checks installed; restoring SQL requires the captured exact
boundary and a fresh drift check. Never drop product tables, receipts, history,
limits or counters to roll back performance code.

Local performance probes use disposable PostgreSQL, synthetic data and ordinary
runtime roles. They preserve E1/RLS/OUTCOME checks. Function profiling is enabled
only in that disposable cluster, never as an implicit live configuration change.
Identity optimization joins only concurrently outstanding same-client reads in
one HTTP trace. Settled observations, sequential checkpoints and other requests
always perform a new official SDK read, including errors and revoked accounts.

## Optional PILOT2 registry envelope

`022-pilot2-registry-envelope.sql` is a separate explicit SRM adoption; the
historical initializer, baseline migration count and their digests stay intact.
It retains the complete accepted KRS General envelope beside its existing
organisation-scoped snapshot, including warnings, effective date and original
retrieval time. The field is nullable for every earlier row. Only current
`SRM_STORE_GENERAL` Work by the named PILOT2 receiver can append it; it cannot
be replaced. Existing tenant RLS and the original snapshot/attempt guards apply.
The original KRS pilot receiver keeps its prior provider guard unchanged.

The ordinary PILOT2 job also needs SELECT on its accepted command table;
existing RLS still restricts that read to the actual current Work. Optional
Source receivers reuse the original classified Corporate/Financial and HTTP
transports, without modifying old counters, licenses, human grants or policies.
Rollback reuses the retained Scanner artifact and prior technical binding;
nullable envelope data and canonical audit/history remain preserved.


Optional SQL023 adopts one `SRM_FINANCIAL_INVENTORY` Work for the existing PILOT2
executor only. It joins the existing RDF archive write, prepared document write
and candidate/document reads in one short transaction, with no provider HTTP.
The current E1 unit, organisation/NIP fences and physical INTENT/OUTCOME remain
mandatory. The accepted predecessor bodies are checked before changing their
finite purpose lists; sensitive/JDG/website branches remain byte-for-byte.
Install atomically under the existing controlled access owner, with a source
SHA, schema digest, exact existing executor login/service ID and active unit
policy. No historical baseline is changed and no HUMAN grant is added.
Missing adoption keeps the new composition closed; all existing purposes work
without SQL023. Rollback uses the retained application artifact and original
source pins; the additive purpose can be disabled without deleting history.

## Main Development transient geocoding and searched supplier access

`018-transient-location-geocoding.sql` is an additive receiver for the existing
Maps command / Root / delegated Work / Source hosts. Its only successful write
is the guarded location CAS version, actual editor and audit request reference.
Google coordinates and place IDs remain in the active browser view for at most
15 minutes and are discarded on close, hidden view, expiry or access revocation.
They are never stored in the product database, browser storage or Source payload.
This path does not activate the persistent 29-day cache or its maintenance port.
Uncertain delivery remains fenced by the existing Source and domain mechanisms.

`018-searched-supplier-location-grants.sql` prepares exact collection policies
only for an owner-approved runtime role and organisation, current verified members
and suppliers already registered in that organisation. It never reactivates an
existing revoked policy or removes a DENY. Exact geocoding permission is prepared
only for an active location of that same supplier/member. New authority IDs are
recorded in an immutable administrative log. This preparation finishes in its own
transaction before Root admission; it cannot change an admitted access snapshot.
The runtime has no direct table ACL, owner role or generic grant capability.

Activation is confined to the registered main Development service and requires
`PROFITIA_SUPPLIER_LOCATION_ACCESS_VERSION=srm-searched-locations-v1` and, for the
paid provider, `PROFITIA_SUPPLIER_LOCATION_GEOCODING_VERSION=srm-google-geocoding-transient-v1`.
The server-only `GOOGLE_GEOCODING_API_KEY` must allow only Geocoding API and the
registered service outbound IP ranges. The existing ordinary jobs and Source
pools are reused; no worker, scheduler, role or additional connection pool is created.
Install the exact pinned SQL as the controlled owner, seed only the approved
role/org scope, grant only the named metadata/Work functions and configure the
existing E1 request, Work, Source and external-call policies before activation.
SQL027 remains scoped to report/private refresh; it is not an opt-in for location
operations. Existing location write/sync request contracts remain in force.

Rollback disables these two optional flags and restores the last verified SRM
artifact plus its three service deployment bindings. Preserve the additive
installations, source/effect/call history and all counters; revoke new opt-in
authority through the controlled owner if required. Do not delete location data
or replay an uncertain Google delivery. PILOT2 and other environments are untouched.
