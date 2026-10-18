# SG2 E1 — native Dashboard forecast read integration

Date: 2026-10-18. Task `SG2-E1-DASHBOARD-NATIVE-FORECAST-READS-20261018`, profile SG2, workspace SG-dev, TARGET_ENVIRONMENT=development; local isolated execution. Authority `profitia/SG-dev/main`, baseline `0b89d371040613a7f4b6a36f9322904118a6772d` after independently closed PR468.

## Consumer behavior

Four existing Dashboard GET APIs now have an explicit native path: Current, Verification, exact capability and capabilities. They send the untrusted user session to the current private SG Runtime guard, which remains the authority for verified identity, organisation membership, product/feature, module, permission, resource, source and durable audit. The relay does not grant access or cache identities/rights/results.

The existing business interface is retained: MONTHLY_AVERAGE remains the default, Dashboard Verification remains FAST, and Dashboard capabilities remains the original lighter state-only readiness snapshot. The latter maps to the backend readiness endpoint, not its detailed capabilities endpoint. Rolling Current is converted to the existing frontend DTO using the original identity, anchors and freshness functions; zero values, horizon-month display semantics, source fingerprint, units and the embedded Rolling payload are retained. It does not expose a new preparation operation or silently select another Verification scope.

Native calls use only the pinned, verified Development runtime origin, explicit configuration version, matching APP_ENV/TARGET_ENVIRONMENT and, when supplied by Render, the registered consumer service ID. There is no inherited legacy URL fallback. Staging and Production are not admitted by this candidate configuration. A test reproduced acceptance of a conflicting TARGET_ENVIRONMENT before the final guard was corrected; the negative regression now passes.

The relay forwards only the incoming Authorization value. Cookies, legacy technical credentials, prepared-authority headers, caller identities, tracing headers and arbitrary destinations are not forwarded. Duplicate/unknown selections, invalid identities and non-GET requests are refused. Transport is bounded, private/no-store, time-limited and does not follow redirects; errors do not publish upstream diagnostics.

## Verified publication boundary

After its existing private publication validation, the native SG Runtime host adds nonsecret contract, application, environment, projection and resource metadata from the admitted server context. Caller headers do not supply it. The relay requires the exact expected metadata before accepting a successful response, including its representation and scientific selection. An old or legacy response at the same URL, or a response for another environment/resource, is withheld.

These headers are a versioned publication binding over the pinned transport, not a user credential or an independent signature. They do not replace backend authentication, source validation, audit or release verification. Backend deployment and native-mode verification must precede any activation of the Dashboard relay configuration. This task changes no live configuration and sends no valid-shaped session to a live product backend.

## Minimal legacy reconciliation and ownership

Dashboard Preview owns the aligned relay, pure mapper, consumer routes, middleware/configuration and consumer tests. SG Runtime owns its native publication metadata and genuine authority/source/HTTP integration fixture. The receipt belongs to Governance Source. No new first-class owner, runtime or shared contract implementation is introduced.

The exact `LEGACY_WRITE_EXCEPTION` is `apps/dashboard-preview/lib/benchmark-forecast/runtime-query.ts`. Under the accepted E0/E1 consumer-integration and necessary-refactoring mandate, this task explicitly limits the exception to relocating six original pure functions and four constants into aligned `current-publication.ts`, removing their former bodies and importing them from the canonical owner. All six function bodies remain byte-identical. No native logic is added to the legacy bridge; its datastore, provider, token and legacy serving behavior are retained.

The seven exception conditions were recorded before mutation: registered LEGACY path; current serving dependency; a local boundary preventing reuse without importing the owner-datastore graph or duplicating the mapper; exact named path; explicit task authorization; minimal relocation/import only; aligned replacement boundary. The currently advertised live Dashboard source `dbd3e47196b3aeb65b77fe6d76bbf2fae2d68119` was read: its Current route imports this bridge and the bridge contains the Rolling mapper/datastore dependency. This is source-dependency evidence, not retained-artifact or business-UAT proof. The full preflight uses only the official exact-path exception, with no routing reclassification or bypass.

## Validation

- 313 Dashboard tests and its whole-app strict typecheck passed, zero skipped. The existing legacy, Current, Verification, middleware and frontend behavior tests remain intact. Five fresh relay/actual-route imports resolve neither the legacy owner datastore nor a provider.
- 475 SG2 operation tests, 61 original forecast/snapshot regressions and strict source/runtime types passed, zero skipped.
- A genuine loopback HTTP server runs the actual native backend route factories, current private authority and restricted generated source ORM. The Dashboard relay reaches all four representations. Independently authorised organisations A/B retain identical shared statistics; current session, membership and permission revocation refuses before source access. No owner-datastore or provider fallback occurs. A missing publication binding withholds a successful response. An actual OUTCOME audit failure remains unavailable through the relay and independently retains correlated INTENT/FAILURE.
- That fixture uses explicitly synthetic SDK/session identities; it is not evidence of real Clerk signatures, live browser login or cloud TLS. Its database roles, SQL source boundary and current authority checks are genuine.
- A separate isolated copy of public dependencies, without env files and with unreachable loopback database URLs, passed the full Dashboard build. No framework upgrade was required: this Dashboard remains Next14/React18; SRM is the separately verified Next16/React19 consumer.
- The actual local production build was launched with a Development target. Without configuration its pages/APIs refuse with 503. With explicit native configuration the four read APIs refuse an opaque/unverified identity with 401 before backend fetch; pages, writes and other data APIs remain closed. Forged cookies/identity and middleware-bypass headers do not open those surfaces. This is an isolated build smoke, not a Production or product deployment.

Exact candidate/main CI, independent source proofs, normal PR/merge and canonical SG2 PMOS/MEMOROS/PHR closeout are recorded by this task lifecycle after publication, not pre-claimed here.

## Activation boundary and remaining E1

The four configured native GET APIs are the only new middleware admission. Native pages, preparation/writes, other data APIs and an open preview remain closed until their own integrations. Explicit legacy mode still uses its original handlers; native errors never invoke them as a fallback.

No provider data/schema/role/grant, secret, live flag/configuration, product deployment, DNS or ownership was changed. The checked SG2 Development deployments remain at their prior source versions. This is an API-consumer candidate, not a native UI activation, live login/TLS proof, recovery acceptance or full E1 completion. Remaining work includes the other Dashboard data/UI consumers, delegated preparation/jobs/cache/files, installed source/private configuration, real login, executable recovery and controlled Development then Staging releases. E2–E4 and Production remain outside the accepted scope. SG2 uses only its own Development PMOS/MEMOROS/PHR lifecycle.
