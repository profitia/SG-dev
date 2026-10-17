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
