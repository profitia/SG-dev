# SRM — protected shared corporate-financial read port

Task `SRM-E1-SHARED-FINANCIAL-READ-PORT-20261017`, SRM / Development.
Authority at start `c330f526add59872152363c3cd24b914b71bf0ff`.
Status: **tested source candidate; exact-source publication and receiver proof remain required**.

## Purpose and boundary

The existing report-data route restores private documents and can save scanner
frames. It therefore remains AM22 projection, with its previous behavior and
permissions. A second application needs a real protected business-data port,
rather than copying that logic or treating projection as a pure shared read.

New GET `/api/xray/financial-summary` is AM21 `supplier.report.read`, using the
existing server runtime, ordinary pg role, common executor, identity adapter,
current membership/product/permission/module binding and protected audit. It
requires a bearer session token; a fresh Request containing only that header is
passed to the official SDK so an unrelated cookie or forged context header
cannot win token selection. Token syntax alone authenticates nobody. Application,
deployment, environment and fixed organisation remain server-owned. Duplicate,
unknown and malformed query fields are refused. The new port has no demo
implementation or fallback, and its private configuration is not activated here.

The reader selects only stored corporate catalog, facts and indicators. It uses
the same financial SELECT fields and existing projectReportData; no financial
formula, fact qualification, history or DTO logic is duplicated in another host.
The old REPORT_DATA_SQL was compared byte-for-byte before and after extracting
the common SELECT prefix, with an identical result. Existing report/export paths,
frameworks, package pins and common contract fingerprints are unchanged.

The source hash must match the resource version admitted by the operation. A
changed supplier/source, missing row or malformed stored source is refused. An
explicit absent source yields truthful empty data. Known shared catalog removal
or liquidation suppresses financial results under the existing restriction.
This port reads the shared catalog's current recorded status; it does not inspect
or claim validation of any organisation's private archive or successor identity.

No KYS, PESEL, private source archive, financial document, preference, export,
source file, private scanner frame or scanner capability is returned. KYS is
explicitly NOT_REQUESTED/ABSENT, including null private attempt/retention dates.
The output fence rejects supplier substitution, scanner/preferences/export
capabilities, private KYS metadata, cache changes and unexpected headers. No paid
provider fetch, refresh, restore, business write, background work or new driver
is performed. INTENT/OUTCOME and failure records still use the accepted writer.

## Verification performed

- Own eleven-path before/begin/require-begin gates PASS.
-488 SRM product/presentation tests,68 actual API/ordinary-role SQL/configuration
  tests and311 promotion tests PASS, zero skipped. Typecheck and production build
  PASS. Product/promotion migrations ran sequentially on their disposable loopback
  database; operation tests used a separate isolated database.
- Six new data/boundary tests are included in the488 product tests. The actual
  existing summary rules receive the existing projector's verified revenue and
  negative net value, preserving precision. Unknown/changed source and forbidden
  output are rejected. The first synthetic assertion assumed grouping for a
  four-digit Polish number; it was corrected to preserve the existing formatter,
  without changing product behavior.
- The actual API fixture temporarily revokes the ordinary role's SELECT on all
  SRM tables, then grants only the three corporate catalog tables. Shared reads
  still succeed for two allowed organisations, returning the same corporate100
  while their private archive values differ100/999. Private archives cannot be
  selected. Exact original grants are restored in finally inside the guarded
  disposable fixture. No cloud grant is touched.
- All22 business-table contents are compared before/after shared reads. They
  remain identical. Each request has only its own correlated AM21 INTENT/OUTCOME,
  SHARED_KNOWLEDGE and supplier module evidence. No private file read is performed;
  external provider fetch is disabled in the fixture. Missing/forged bearer, foreign membership, provider
  revocation, explicit DENY, revoked product/module and fixed-profile foreign
  organisation are refused.
- A wrong source version is tested inside the actual authorized module/SQL
  context. OUTCOME-writer outage releases only503, records INTENT/FAILURE and
  changes no business data. Explicit no-data stays empty rather than becoming0.
- Local production-build HTTP checks confirm401 for missing bearer/forged cookie
  context and503 for an unconfigured bearer request, with private/no-store and
  Cookie/Authorization Vary. No database or real identity secret was configured;
  no real session or successful live request is claimed. The own server was stopped.

## Remaining evidence

Exact-source CI, full receiver compatibility, merge and canonical own PMOS/PHR
closeout are recorded separately after their gates. The public summary component
from SRM PR439 is prepared; SG2 has not yet integrated this new protected port.
No cross-host token policy, service routing, new grant, cloud state, secret,
Development/Staging deployment or retained-artifact rollback is changed or
proved here. A new host must independently prove its application/product access,
bounded transport, DTO handling and actual UI/build. Full E1 remains in progress.
