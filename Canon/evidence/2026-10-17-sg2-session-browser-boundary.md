# SG2 — individual session presentation and browser history boundary

Task `SG2-E1-SESSION-BROWSER-BOUNDARY-20261017`, SG2 / Development.
Authority at start `8b08602afc107ea819da8a68728904daea7ded70`.
Status: **source candidate; full exact-source controlled CI required before merge**.

## Confirmed source and change

The existing login provided Clerk only on its own page. Middleware and the
benchmark-finder page still used the demo cookie, while recent searches and the
locale-switch snapshot shared two unscoped sessionStorage keys. Reusing those
keys for a new individual account would incorrectly adopt another context's
query/AI prompt/result state. The existing Finder cleanup already aborts its
search, previews, analytics eligibility, semantic context and metadata requests.

One official ClerkProvider now covers the locale host, with the same public key,
official SDK and Polish/English localization. The locale layout is dynamic so
server-selected runtime configuration is not frozen as legacy at build time.
SignIn retains its existing validated local return path without another nested
provider. Explicit Clerk does not upgrade or trust a demo cookie. It forwards
only neutral locale/login/Finder shells; invalid provider fails503 and unadopted
pages fail403. Every data API retains its independent current backend boundary.
The Finder subtree mounts only after SDK session readiness; a different user or
session replaces the complete subtree, including its existing abort cleanup and
in-memory caches. Official logout is available in that named view.

Presentation state is not a verified internal user, organisation, permission or
product receipt. No IdP organisation/role/header becomes authority. No new
verifier, permission engine, runtime, data grant or backend contract is created.
Exact/default legacy keeps the previous session, cookie, Finder business rules,
locales, shell and browser keys. The unadopted advisory widget is disabled only
in the new Clerk context so it cannot adopt an unrelated legacy chat history;
CIC source, reporting and existing legacy widget behavior are unchanged.

## Explicit browser persistence policy

All four existing Finder browser-storage helpers receive an explicit policy.
Only the explicit legacy host may resolve its historical sessionStorage adapter.
Unknown/individual context does not even resolve the storage object and cannot
read, overwrite or remove either old key. There is no global current actor,
guessed tenant namespace, migration of demo preferences or second persistence
fallback. Unavailable legacy browser storage leaves the current in-memory view
usable; it does not become a privileged data source.

Without a backend-authoritative organisation/user cache scope, named recent
history and locale-switch snapshots remain **in memory only**. Persistence across
reloads/navigation and restoration of those private preferences are not delivered
by this increment. In particular, named locale navigation cannot promise the
legacy persisted search snapshot. Canonical benchmark selections still use the
existing protected backend. This explicit closed capability must not be described
as full user-settings delivery or used to justify live E1 acceptance.

## Verification

- Full own thirteen-path before/begin/require-begin preflight PASS.
- Nine browser-policy tests PASS, zero skipped. Explicit legacy keeps its keys
  and behavior; volatile/unknown/forged policy cannot resolve storage or touch
  existing data. Unavailable storage has no alternate persistence fallback.
- Twenty-two limited public frontend tests PASS, zero skipped: actual official
  provider SSR on React18.3.1 in both locales, SignIn target, loaded-session
  presentation, principal/session subtree identity, missing configuration,
  original demo cookie behavior, Clerk neutral-page allowlist, unknown-mode
  denial and browser policy. These include the nine policy tests above; counts
  must not be added as independent coverage.
- Four additional existing bilingual UI/portfolio/login regressions PASS, zero
  skipped. The current screen, canonical eleven-benchmark portfolio, version and
  locale content remain intact. These tests are included in the ongoing CI suite.
- That local frontend probe used a separate temporary fixture with only public
  direct versions taken from the app lockfile: React/DOM18.3.1, Next14.2.35,
  next-intl3.26.5, official Clerk pins, zod and tsx. Its dependency tree is not
  the full locked SG2 runtime. Installation had empty token variables, public
  registry, no user config and disabled lifecycle scripts. Only the verified
  empty isolated node_modules directory was temporarily linked to it; the local
  platform source was linked from this checkout. No private vendor package was
  copied, installed or exposed, and the link was removed after tests, restoring
  the empty directory. Original business workspaces were untouched.
- Consequently no local full API/Prisma/SQL, typecheck or runtime build is claimed.
  Those require the approved controlled CI on the exact candidate after its
  credential phase ends. The operation test script now includes the real
  middleware, browser-policy and bilingual UI tests as well as its existing API/SQL tests.
  Relevant public/common/dashboard checks and actual merge remain required.

Own task closeout records actual source/PR/run, MEMOROS and remote PHR only after
those gates pass. Source publication is not a real Clerk browser session,
membership/revocation test, UI unmount trace, persisted personal settings,
Supplier Intelligence reuse, live isolation proof, controlled release or full
E1 completion. No live secret, flag, role, grant, account, schema/data, provider
resource, Development/Staging deployment, domain or Production change occurs.
