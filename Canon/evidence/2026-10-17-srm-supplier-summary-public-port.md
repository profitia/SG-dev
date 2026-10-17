# SRM — bounded public Supplier Intelligence module ports

Task `SRM-E1-SUPPLIER-SUMMARY-PUBLIC-PORT-20261017`, SRM / Development.
Authority at start `1f06d80d39b83cfe46895c9199587fc220faa9d3`.
Status: **tested source candidate; exact-source CI and separate receiver acceptance required**.

## Confirmed change

The existing executive-summary rules and supplier snapshot imported their value
formatter at runtime from financial-history, a React component. Financial units
and exact formatting now live in the existing pure financial-value utility. The
definition moved byte-for-byte (SHA256
`c1d18fe40fd3ac501ae044d625f7dad63c94eee79d6c4e15ef196146f2554577`).
The old financial-history re-exports remain available. FinancialPeriodSelection
is now a data contract, with the old financial-dashboard type export preserved.
No ExecutiveSummary markup, business rule, formula or normalized source value
was changed. The initial missing local financialUnits import was caught by
typecheck and corrected before acceptance; no guard or business test was relaxed.

Private repository package0.2.0 adds narrow public contracts, formatting,
executive-summary-rules and executive-summary subpaths. The former root/CSS
exports remain. Its peer range permits React18.3.1 and React19.2.4, with an
explicit bounded compatibility matrix: only the pure ports and the selected
summary leaf have React18 acceptance. Root/composite and other mounts retain
their existing React19 acceptance; this is no blanket React18 guarantee.
SRM's own React19, Next16.4.1 and other locked pins remain unchanged.

The host retains identity, internal organisation, product access, permission,
resource, transport and persistence authority. The component receives an already
authorized normalized DTO and presentation callbacks. No private app source,
router, secret, grant, database connection or provider transport becomes a module
dependency. Common operation/private-host source fingerprints are unchanged.

## Verification

- Own thirteen-path manifest/routing/before/begin/require-begin gates PASS.
- Headless public import runs in its own Node process with React/react-dom
  resolution actively forbidden. A deliberately attempted React import proves
  the guard; existing pure rules and exact/compact formatting then load and pass.
- Isolated public file consumer: four tests PASS, zero skipped, on actual
  React/DOM18.3.1. The existing UI renders confirmed values, preserves precision
  and invokes source, finance and details callbacks. Wrong supplier, period,
  scope, loading, absent metadata and unverified facts do not become confirmed
  values. Typecheck PASS against React18 types. This local probe uses a copied
  working-tree package, not a claim of an already published exact commit.
- Existing actual SRM application on React19:482 product/presentation tests,
  64 actual API/ordinary-role SQL/configuration tests and311 promotion tests
  PASS, zero skipped; application typecheck and production build PASS.
  Product and promotion migrations ran sequentially against one disposable
  loopback database; operation tests used a separate disposable database.
-165 release-governance regressions PASS, zero skipped. The existing staging
  workflow, owner review, deployment jobs and permissions remain unchanged.
- The new public React18 CI job checks the exact source, uses minimal read
  permission, no environment or credentials, checkout without persisted token,
  pinned public direct dependencies and disabled installation scripts. It
  installs a separate file consumer and publishes only a sanitized bounded proof.
  Existing React19 CI and separate SG2/common/dashboard compatibility remain
  required before merge; task closeout records their actual runs and source.

Only the verified generated Next root-params import was removed after build.
No private package credential was read, copied or requested. No package was
published, no cloud role/grant/data/flag/secret changed and no product was deployed.
The full authorized E1 program continues after this producer unit.

## Remaining acceptance boundary

Public-port SSR and callback compatibility are **not** actual use by a second
application. SG2 must separately integrate this real business module, prove its
protected DTO flow and build its own host. These tests do not prove a real Clerk
browser session, cross-host authorization, Development/Staging deployment,
retained-artifact rollback or full E1 completion. Existing business environments
and data remain in place until their own controlled release.
