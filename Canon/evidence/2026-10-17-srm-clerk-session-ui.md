# SRM — bounded Clerk session presentation and lifecycle

Task `SRM-E1-CLERK-SESSION-UI-20261017`, SRM / Development.
Authority at start `3e5a412ba476f2b2ace35694b7d54eb38bba2467`.
Status: **validated source candidate; no provider activation or deployment**.

## Confirmed problem and behavior

The existing SignIn redirected to missing `/xray`, while the real application is
`/`. Middleware redirected Clerk root requests back to login. The official
frontend provider existed only on the login page, and the business logout form
only removed a demo cookie. Those source defects would prevent the individual
session flow even with correct backend configuration.

The server now chooses one application-wide official ClerkProvider with only
public presentation configuration. The root layout is dynamic so a build-time
legacy decision cannot silently become the deployed Clerk decision. Invalid
explicit configuration renders unavailability, never demo. SignIn redirects to
the real root. The same Polish SDK/localization and backend identity/configuration
contracts remain unchanged; no authentication engine, membership, permission,
role or provider claim is reimplemented in the browser.

In explicit Clerk mode root/login can serve a neutral public shell. The report
subtree mounts only after the official SDK reports a loaded individual session.
Its React identity includes both provider user and session; changing either
replaces the subtree containing useSupplierReport, whose existing cleanup
disposes the controller and requests. The controller is deliberately inside
that boundary, rather than merely wrapping its output after hooks run.
This is a presentation/reset boundary, **not backend authentication or an API
permission**. Current backend verification, internal identity/membership,
application/product/permission/resource/module checks and ordinary-role RLS
remain independently required. Unadopted legacy pages/APIs remain closed in
Clerk mode. No fake report operation is executed to grant the landing page.

Named logout uses the official SignOutButton and returns to `/login`. It is
available before a first search as well as in a report. Exact/default legacy
preserves its existing form, cookie handling, header visibility, layout and
business CANON IDs. No business report, financial rule, package dependency or
backend access-store fingerprint is changed.

## Verification and limits

- Own nine-path before/begin/require-begin preflight PASS. Own SRM PMOS, with
  MEMOROS disabled and required PHR after actual source acceptance.
- 481 business/presentation/CANON tests PASS, zero skipped. Tests cover the
  actual provider on React19 without a backend secret/demo form, real SignIn
  target, withholding report output before session readiness, missing/invalid
  provider, different principal/session subtree keys, named controls before
  search and preservation of the legacy logout/header. Key tests establish React
  tree identity; they are not a real browser unmount or provider logout trace.
- 64 actual API/ordinary-role SQL/configuration tests PASS, zero skipped,
  including independent identity/permission/product/module/export boundaries.
  Neutral page forwarding does not admit another private page or alternate API.
- Typecheck and full Next16.4.1/React19 build PASS. Only the exact generated
  root-params import in next-env is removed after verifying the build delta.
- Local production-build HTTP smoke uses two isolated synthetic profiles,
  explicit empty private connection and an unmatched service ID. Named root200
  renders session-loading rather than search/report content; login200 has no
  secret or legacy form, an unadopted page redirects, and forged identity at the
  real report API fails503 before any private pool can be selected. Unknown
  provider root redirects and login shows unavailability without demo fallback.
  Only loopback is contacted; test-owned servers are stopped afterward.
- HTTP observation distinguishes actual response headers from middleware intent:
  Next renders neutral pages with its RSC/router Vary fields, replacing the
  middleware Cookie/Authorization Vary there. Actual page private/no-store is
  preserved. The protected API independently returns Cookie/Authorization Vary
  and private/no-store. Neutral pages contain no server-rendered private report;
  the test was corrected to this actual framework behavior, with API requirements
  retained. No cache or access guard was relaxed to obtain PASS.

Remote exact-source SRM/governance checks and actual merge remain required; their
PR/run/SHA results and complete own PMOS/PHR are recorded at closeout. The
platform workflow's explicit path filters do not include these changed UI/test
paths, and no shared or SG2 source is changed. This task does not fabricate a
new SG2 acceptance or reuse an old exact-source proof.

No real Clerk OTP, browser session, provider logout/revocation, deployed artifact,
business module reuse, remaining private entrances/jobs or complete E1 acceptance
is proved here. A client cannot revoke already observed data; every new backend
operation still checks current authority. No live secret, flag, role, grant,
account, database, provider resource, environment, Development/Staging deployment,
domain or Production change occurs. Existing applications retain their live
state until their separately controlled releases and executable recovery checks.
