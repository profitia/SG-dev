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
