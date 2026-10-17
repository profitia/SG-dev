# SRM — actual financial XLSX export boundary

Task `SRM-E1-FINANCIAL-EXPORT-BOUNDARY-20261017`, SRM / Development.
Authority main at start `70ad863e0c31b551fdf506ae2eadc47468362a7c`.
Producer `ARCHITECTURE-E1-SUPPLIER-EXPORT-CONTRACT-20261017`, PR434,
source `dc1935698647e21570646f3d6a0c62492c86a004`.
Status: **validated source integration; no live activation or deployment**.

## Behavior and scope

The existing POST financial-excel entry selects its provider from server-owned
configuration. Exact/default legacy retains the existing handler, business
generator, selection checks and errors. Explicit Clerk uses the accepted common
private host and independently requires current read/project/export permissions,
product access, membership, module and exact resource/organisation scope. Unknown
or failed Clerk configuration cannot invoke legacy. Middleware forwards only the
two adopted APIs in Clerk mode; unadopted legacy entries remain closed there.

The supplier resource and approved stored corporate input use the same logical
company ID. Preparation restores the organisation's archive only after all
access checks and its distinct project INTENT. The same native pg transaction
carries limited-role SQL, module context, restoration, the file projection and
both OUTCOMEs. The new prepared-document read reuses the existing checksum,
identity, inventory and provenance logic but refuses stale/missing preparation
instead of restoring again. Saved financial data and registration restrictions
use the existing bound transaction adapter, never the old global connection.
No external provider request, catalog mutation or durable public file is created.

The unchanged business XLSX builder preserves financial precision, selected
years, accounting standard, corporate restrictions and company source identity.
The result fence verifies response classification, private/no-store/Vary, company
filename, MIME, disposition, exact length and ZIP signature before commit/release.
Explicit no-data404 and unavailable-selection409 receive NO_DATA and
SELECTION_UNAVAILABLE audit outcomes rather than a delivered-file claim. Personal
and general exports, service/delegated jobs and paid acquisition remain closed.
Live permission grants are not changed or inferred from this source adoption.

## Verification

- Own exact twelve-path preflight, SRM PMOS begin and require-begin PASS.
- Clean canonical install-links installation from the exact lockfile PASS;
  local platform package version alone changes1.6.0→1.7.0. A scratch invocation
  without required install-links was rejected by npm before installation; the
  canonical mode was then used. No credential was requested or copied.
- 64 operation/API/configuration/ordinary-role SQL tests PASS, zero skipped.
  Actual route dispatcher and middleware, temporary official-SDK adapter with
  synthetic authority responses, limited native pg role and real XLSX builder
  run together. Global network fetch is forbidden in this fixture.
- Workbook round trips for two organisations preserve distinct source values100
  and999 without crossing them. Exactly four correlated INTENT/OUTCOME events
  have two decision IDs, the same actor/organisation and business transaction
  provenance. Missing source/export permissions, explicit DENY, wrong member,
  forged identity, wrong origin, malformed/duplicate context and revocations deny.
- A triggered final export OUTCOME outage rolls back actual restored SQL rows and
  both transactional outcomes, leaves both correlated FAILUREs, releases no file,
  and recovers after the synthetic outage is removed. Existing report timeout,
  scope, role and audit tests remain green.
- 475 existing business tests,311 configured promotion/migration tests,
  typecheck and full Next16.4.1/React19 build PASS, zero skipped. Tests use guarded
  loopback databases; no cloud reset or client data. The only generated next-env
  root-params import was removed after checking its exact build-generated delta.
- The producer operation/host source digests are explicitly accepted in this
  receiver receipt. Identity, access store, module SQL and business schema remain
  unchanged. Required exact aggregate remote checks and separate SG2 acceptance
  precede merge; actual PR/run/SHA and own closeout are recorded in PMOS/PHR.

These tests do not prove a real Clerk browser session, production workload,
retained deployed artifact, full business-module reuse, all alternate entrances
or full E1. No live role, grant, account, configuration, secret, database, flag,
resource, existing service, Development/Staging deployment, domain or Production
change is performed. Current legacy environments retain their separately
verified deployment state until a controlled release with recovery evidence.
