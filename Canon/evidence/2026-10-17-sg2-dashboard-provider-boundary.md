# SG2 — dashboard provider boundary and independent source regression CI

Task `SG2-E1-DASHBOARD-PROVIDER-BOUNDARY-20261017`, SG2 / Development.
Authority at start `b0f8abe2ffc0f4110774e7ee24eb1f1571541e1f`.
Status: **source hardening, not individual dashboard adoption or deployment**.

## Result

Dashboard middleware now checks the deployment-owned provider discriminator
before choosing either the retained demo or the open library policy. Default or
exact `legacy_demo` preserves those policies. Explicit Clerk, unknown, empty or
whitespace-altered provider values return a neutral private 503. A valid legacy
cookie, forged identity/role headers or caller organisation/pipeline query cannot
open that path. This host has not yet adopted its own common private guard; a
provider string alone cannot establish identity or permission.

Enabled demo responses from middleware now use private/no-store and vary on
Cookie/Authorization, preserving existing Vary selectors or wildcard semantics.
Signed sessions, environment cookie separation, login redirects and the explicit
open preview policy remain unchanged. These middleware headers are not claimed
to independently prove every downstream handler's output or resource boundary.
Organisation-bearing DR rows are not reclassified as universal knowledge.

The existing shared contract CI adds an independent dashboard job and both
PR/main path triggers for dashboard source. It installs only existing public
lockfile dependencies, generates existing clients without a database connection,
runs all dashboard tests/typecheck/build and checks the actual production HTTP
boundary on loopback. It checks out the exact candidate head and writes a
sanitised source proof with that SHA. It uses no environment/registry secret,
private package token or product deployment. The main-only private controller,
its package set, credential phase, topology and public-proof rules are unchanged.
The dashboard job is skipped during controlled SG2 validation/policy-probe
manual modes; those modes cannot claim candidate-dashboard validation. The PR
job and ordinary main/integration runs provide their actual checked source.

## Verification

- Own four-path routing, clean preflight, PMOS begin and require-begin PASS.
- All 303 dashboard tests PASS, zero skipped; 11 additional middleware cases cover
  explicit provider/closed or open profile combinations, valid signed cookie,
  forged inputs, preserved legacy pages/API/preview and cache-bound refusals.
- Dashboard typecheck and full Next14/React18 build PASS. Four real HTTP requests
  against that production build refuse page/API/forged identity, including a
  caller middleware-subrequest header, with 503/private/no-store/Vary and no
  redirect. This proves those four refusal paths, not complete backend adoption,
  paid-provider behavior, named-user E2E or every framework bypass.
- All 33 governance/workspace/controlled-package policy tests PASS, zero skipped.
  YAML parsed; both path triggers are present. New job contains no environment
  or secret reference. Exact remote candidate CI is required before merge.
- Read-only Render metadata during the task confirms all three consumers of this
  app source remain autoDeploy=no: `srv-dapa3ujm8hqs73a9t2og` Development,
  `srv-dacln50jo6nc738lbag0` existing PORR dashboard, and library
  `srv-da2i7j9t0dsc73ag7qv0`. No provider configuration was mutated.

## Findings and remaining release limits

Dependency installation flags the existing Next14.2.29 pin. The manufacturer's
[December advisory](https://nextjs.org/blog/security-update-2025-12-11) identifies
an App Router DoS fix in14.2.35. The current
[October advisory](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
also requires review of newer upstream issues. Current SG2/dashboard build
manifests have zero node/edge Server Actions and dangerouslyAllowSVG=false;
those observations are not a blanket security exemption or live-artifact proof.
SRM's checked lockfile separately retains Next16.3.8/sharp0.34.5, whose relevant
compatibility/security patches require its own profile/task. No dependency was
upgraded here and no exploit was attempted against a live service. Dependency
closure and actual artifact/runtime checks remain prerequisites to release GO.

No database, role/grant, secret, flag, cloud resource, existing deployment or
business-data assignment changed. No Staging/Production work was reported as
Development. Full individual dashboard access, resource controls, provider/job
context, business reuse and controlled Development/Staging releases remain E1.
Own SG2 PMOS/MEMOROS/PHR closeout records the actual source/CI outcome separately.
