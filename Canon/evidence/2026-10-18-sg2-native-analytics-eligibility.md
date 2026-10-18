# Native Analytics eligibility — 18 October 2026

Status: locally verified source candidate. Exact source/main CI and canonical closeout are separate acceptance evidence. No product deployment or native configuration activation.

Task `SG2-E1-NATIVE-ANALYTICS-ELIGIBILITY-20261018`; SG2; workspace SG-dev; target Development; execution local. Exactly ten aligned paths, full before/begin/require-begin preflight. Own registration `cmvdg6a9e00006szt4neb30rs` uses the SG2 PMOS database. No other profile history is written.

## Behavior and authority

The existing analytics-eligibility GET now explicitly dispatches native requests through the existing protected Market Analytics handler. Current account/session, organisation membership, product/market feature, module, knowledge.read permission, ordinary stored source and durable access audit all precede returning a chart address. No second access policy, source client or provider fallback is introduced. Organisation selection is routing context; downstream requests must independently revalidate it.

Native chart routing is separately disabled by default. Enabling it requires the existing stored Market capability and the exact public Development Dashboard origin and configuration version. It cannot borrow the legacy base URL, Production fallback, localhost, Staging or another application. The original URL builder accepts an explicit trusted base while preserving its original defaults and legacy warmup behavior for existing callers.

Native selection is closed: locale, series identity, optional display name and optional organisation. Duplicate/unknown parameters, automatic warmup, experiment flags and unsupported methods refuse before source. The admitted backend contract/application/environment and Market projection/resource metadata, selected series and range must match before a URL is produced. Responses and refusals are private/no-store. No credential, cookie or secret is placed in the address. Native URLs retain locale, series, display name, range1Y and organisation, with preparedReadsOnly and without warmCurrentForecast.

The original eligibility code constructs a URL; it does not itself execute provider preparation or computation. This increment controls native routing and its prerequisites. It does not assert that the child UI is ready, prevent computation in an unadopted child implementation, or grant forecast execution rights. Native Dashboard pages remain closed until their separate UI/session adoption and release acceptance.

## Verification

499 operation/API/actual SQL tests plus61 original Forecast/snapshot tests and strict typecheck pass, zero skipped. The operation suite now includes the unchanged original analytics URL regressions. Actual private-host tests use the real access store and ordinary Market source: two independently authorised organisations receive scoped addresses for the same shared facts and separate actor/organisation audit. The explicit configured default is also checked. This A/B fixture uses an authorised test application profile; the physical dedicated runtime remains pinned to its configured organisation and does not thereby admit arbitrary organisations.

Current session, membership, explicit permission and product revocation refuse before source. Wrong source receipt and durable OUTCOME failure withhold the address; correlated INTENT/FAILURE are preserved. Removing native publication metadata after a genuine authorised and audited read still refuses. Unsupported warmup or a foreign child binding never reaches source. Provider-call traps remain unchanged. The SDK identity fixture is synthetic and is not real Clerk signature or browser verification.

Configuration tests cover disabled defaults, required Market capability, exact deployment topology, foreign or absent bindings, unknown versions, malformed flags, environment/application mismatch and refusal of a legacy fallback. No package or dependency changed.

## Remaining boundaries

No cloud schema, data, role, grant, secret, source flag, configuration or deployment changes. Existing product auto-deploy remains disabled; the three unrelated automatic services exclude these paths. No new runtime, package publication, profile authority exception or own identity system.

The full E0/E1 programme remains in progress. Real Clerk/browser and child UI adoption, remaining protected operations, delegated jobs/cache/files, source preparation and controlled Development then Staging releases require their own evidence. A source increment and a URL are not a live release or full multi-tenant acceptance.
