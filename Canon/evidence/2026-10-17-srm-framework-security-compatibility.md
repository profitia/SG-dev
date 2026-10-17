# SRM — bounded framework and native image security compatibility

Task `SRM-E1-FRAMEWORK-SECURITY-COMPATIBILITY-20261017`, SRM / Development.
Authority at start `b0f8abe2ffc0f4110774e7ee24eb1f1571541e1f`.
Status: **validated source increment; no activation or deployment**.

## Reason and change

The manufacturer's [October14 advisory](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
identifies Next16.4.1 as the patched16.x release and sharp0.35.5 as the native
image-library mitigation. The separately checked [cache advisory](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr)
affects Next16 through16.4.0 under its stated conditions; the
[image advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)
requires patched sharp. Presence of a vulnerable version is not proof that an
exploit occurred. No exploit was attempted against a live service.

Update only direct `next`16.3.8→16.4.1 and `sharp`0.34.5→0.35.5 plus their locked
transitive artifacts. Keep React/ReactDOM19.2.4, official identity SDK, both local
Profitia packages, all other direct dependencies and application contracts.
Version comparison confirms all changed transitive package versions belong to
Next/swc/env or sharp/libvips. The duplicate nested older sharp tree is removed;
canonical install-links representation of local packages is retained.

No forced unification with SG2's Next14/React18, business refactor, permission
engine, schema or new runtime is introduced. Installation uses the public
registry without private tokens or installation lifecycle execution. The same
accepted product, SQL and access tests then execute against the new dependencies.

## Verification

- Full own three-path preflight, PMOS begin and require-begin PASS.
- Clean installation from the exact lockfile PASS. The only manifest changes are
  those two direct pins; other direct dependencies, React and SDK are unchanged.
- Real local native probe loads sharp0.35.5 for both application ESM and Next's
  CJS resolution, with libvips8.18.7. Both convert a trusted local8×8SVG into PNG
  with the expected dimensions. Both resolve to the same installed package;
  conditional exports legitimately expose different JavaScript wrapper functions.
  An initial scratch probe incorrectly asserted reference identity, was corrected
  to package resolution plus actual conversion, and changed no product behavior.
  This native observation is darwin/arm64, not a Linux live-artifact assertion.
- 475 product tests including existing financial/PII/report/PDF boundaries,
  56 actual operation/configuration/API/ordinary-role PostgreSQL tests, and
  311 configured promotion/migration tests PASS, zero skipped. Product and
  migration suites use the same isolated database sequentially; the operation
  suite has its own fixture. No cloud data or paid provider calls were used.
- Typecheck and full Next16.4.1/React19 build PASS. Only the build-generated
  root-params import in next-env was restored after verifying the exact delta.
  Current local Server Action manifest has zero node/edge actions; this is not
  a substitute for the version fix or proof about a previous deployed artifact.
- Required exact remote SRM, platform/governance and separate SG2 compatibility
  checks precede merge. Their actual source/run/PR outcomes are recorded in
  canonical own-profile PMOS/PHR, with MEMOROS disabled.

Read-only Render metadata confirms Development `srv-db1vu6gm7kps73d0e3r0` and
Staging `srv-db496b3tqb8s73eh5sfg` remain main/autoDeploy=no. This source increment
does not deploy or reconfigure either service. An existing live version is not
claimed to contain these fixes; release still requires its own retained artifact,
configuration/migration compatibility, executable recovery and runtime proof.

Other dependency findings, SG2's14.x compatibility work, all remaining E1
integrations, current named browser session, business-module reuse and controlled
Development/Staging acceptance remain explicit. This is no assertion that all
security advisories are closed, all application entrances are adopted or E1 is
complete. There is no private application activation, secret/database/role/grant,
cloud resource, existing data, domain or Production change.
