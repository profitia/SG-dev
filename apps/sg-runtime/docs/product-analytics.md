# SG2 Product Analytics — Development

Task: `SG2-POSTHOG-20261102`. Repository authority: `profitia/SG-dev/main`.
Owner: SG Runtime. Execution: local isolated task branch. Target: Development only.

## Stage one — analytics without Benchmark Finder

Task `SG2-POSTHOG-STAGE1-NO-FINDER-20261103` activates the existing agreed
instrumentation for the remaining Development surfaces, independently of the
known Finder outage. Default OFF and explicit consenting test sessions remain
the activation boundary. No general-user identity, automatic capture or new
unsupported event signal is introduced.

The central adapter and final SDK filter reject Finder events, module/view and
entry-point values, and benchmark search/selection operations. The provider
also disables every capture while the current URL has the exact
`benchmark-finder` path segment, including PCI opened inside that module. It
does not transmit the path. Entering Finder after SDK initialization suspends
capture immediately; returning to another module resumes it with the same SDK.
Direct Finder entry never initializes the SDK. Definitions are retained for a
later separately accepted stage.

AppShell, ADP and X-Ray retain their existing allowlisted signals. The current
PCI entry is inside Finder and is included in that route's exclusion; no new
PCI entry point is introduced. Five previously unsupported definitions remain
inactive. Finder business behavior, E1, Source bindings, providers and Forecast
workers are unchanged. The known Finder live failure is recorded separately
and is not the acceptance condition for this analytics-only release. Shared
security, source-integrity, receiving and CI checks remain mandatory.

Release acceptance requires actual sanitized event receipt in project329829,
negative proof for the excluded Finder surface, unchanged unrelated business
behavior, a verified recovery point and canonical PMOS/PHR closeout.

### Ingestion-side privacy correction

The first controlled live check received three genuine AppShell events but found
backend-added GeoIP fields on all three. Their location values were not read or
exported. The operator immediately withdrew tab consent and used the verified
native OFF recovery target; those earlier test rows remain historical evidence.
The release is not accepted on those initial events.

`ip: false` and removing client-side geo properties are insufficient to prevent
PostHog ingestion enrichment. The final SDK boundary therefore forces the
per-event `$geoip_disable: true` flag after filtering all incoming properties.
It cannot be overridden by a caller or prior SDK enrichment. This changes no
event definition, business behavior, identity, Finder exclusion, shared project
setting or other environment. The pinned real SDK transport test verifies that
the flag reaches the request body. Acceptance additionally requires real events
from the corrected exact release with no stored geo fields; the earlier three
events must be reported separately, never silently deleted or counted as proof.

## Activation and privacy

`posthog-js` is pinned to `1.444.0`. Next.js `14.2.35` uses one client boundary in
`app/[locale]/layout.tsx`; there is no Next 15-only instrumentation-client entry.
The SDK is dynamically imported once, only after validated server configuration,
an allowed HTTPS hostname and explicit operator consent for the current browser tab.
All UI calls go through `lib/product-analytics/adapter.ts`.

Server configuration must contain all of:

| Variable | Required value |
| --- | --- |
| `SG2_PRODUCT_ANALYTICS_ENABLED` | `true` (default OFF) |
| `SG2_PRODUCT_ANALYTICS_CONSENT_MODE` | `explicit_test` |
| `APP_ENV` | explicit `development`, read without the existing fallback |
| `RENDER_SERVICE_ID` | `srv-dapa3tid0e5s73f8bc5g` |
| `POSTHOG_PROJECT_ID` | `329829` |
| `POSTHOG_HOST` | `https://eu.i.posthog.com` |
| `POSTHOG_PROJECT_TOKEN` | the existing project's public SDK token, supplied securely through configuration |

`RENDER_GIT_COMMIT` is included only when it is a full hexadecimal SHA. The token's
format is checked locally; its association with project 329829 must additionally
be verified against PostHog during controlled configuration. No fallback project
or token exists. The browser allows only the registered service's onrender domain
and `dev-sg2.spendguru.app`. Staging, Production, localhost and sibling services fail closed.

These are server runtime variables, serialized as public SDK configuration by the
dynamic locale layout only when all checks pass. They are not `NEXT_PUBLIC_*`
values baked into a shared build. A release must still independently verify the
actual service's rendered configuration and browser traffic before activation.

No established product-analytics consent mechanism was found. This implementation
therefore supports **explicit test sessions only**, not general user collection.
After release authorization, an authorized operator can grant test consent in the
browser console for the same Development tab and reload:

```js
sessionStorage.setItem('sg2.product-analytics.explicit-test.v1', 'granted')
location.reload()
```

To withdraw consent, remove that key and reload. Capture and final SDK filtering
also recheck consent synchronously; removal immediately stops newly initiated
captures. An already transmitted request cannot be withdrawn. There is no queue
of pre-consent interactions and no retroactive replay. This key carries no identity.

SDK persistence is disabled and memory-only. No `identify`, profile properties,
Clerk IDs or organisation IDs are sent. SDK-generated random IDs are reset when
the observed existing session changes or signs out. There is no additional auth,
E1, provider or business-data request. Returning-user metrics across reloads or
sessions are **not supported** until an approved privacy basis and pseudonymous
identity contract exist.

Telemetry belongs to Profitia's existing SpendGuru PostHog project and its access
policy. Its author is an explicitly consenting test operator represented only by
volatile random SDK IDs. This adds no product grants, shared knowledge, database
tables, RLS changes or access to another organisation's business data.

## Payload contract

`contract.ts` rejects unknown events, incorrect modules, arbitrary properties,
free text and invalid enumerations. Event-specific fields include canonical views,
sections, data areas, result counts and create/update modes confirmed against the
existing PostHog definitions. `application=SG2` and `environment=development` are
set by the adapter. Attempts use random UUIDs and bounded integer durations.

`before_send` runs after SDK enrichment and removes URLs, referrers, browser/geo
metadata, person updates and unknown fields. The pinned SDK's event UUID and
timestamp envelope, public ingestion token, random distinct/device/session/window
IDs, library name/version and no-profile markers remain. An actual SDK test
intercepts transport to prove this, without connecting to PostHog.

Autocapture, pageview/pageleave, replay, heatmaps, dead-click, console, performance,
exception capture, feature flags, surveys, conversations, tours, web experiments
and external extension loading are explicitly disabled. The SDK does not replace
Sentry. Existing Sentry scope/sanitization remains **REUSED**, with its own tests.

## Emission map

| Existing event(s) | Actual emission point |
| --- | --- |
| `auth_session_established` | Existing loaded, signed-in Clerk session, observed inside its current provider; IDs stay in a volatile ref |
| `app_opened` | First authenticated AppShell mount in the observed session |
| `module_opened` | Active AppShell module transition; PCI separately after its dialog is open |
| `screen_viewed` | Logical active AppShell/ADP view or PCI step; no URL/query |
| `operation_started/completed/failed` | Explicit Finder search or PCI analysis/save; completion follows validated response, retries do not create separate attempts |
| `benchmark_search_submitted` | Nonempty simple, advanced/exact or AI search request initiated by existing UI actions |
| `benchmark_results_displayed` | Committed current result set while Finder is active; count includes zero; stale/aborted results excluded |
| `benchmark_selected` | Existing user selection callback, without claiming persistence success |
| `pci_build_category_clicked` | Accepted Finder category action before preparing the selected benchmark; both identity branches |
| `pci_opened`, `pci_step_viewed` | Open PCI dialog and actual step transitions; legacy Category Builder redirect never emits PCI open |
| `pci_preparation_finished` | Latest nonaborted PREPARE response only; not a new user attempt; PREPARED/REFUSED/ERROR |
| `pci_analysis_requested/finished` | One explicit ANALYSE attempt; CALCULATED/PROXY_MARKET_ONLY/REFUSED/ERROR stay distinct; proxy emits no generic full-success completion |
| `pci_category_save_requested/finished` | Explicit POST/PATCH and then backend response with a valid category ID and matching existing organisation; success/error only |
| `pci_closed` | Confirmed explicit close action; not render cleanup or session-loss unmount |
| `adp_view_opened`, `adp_form_section_opened` | Active canonical navigation; eight views, five sections, three areas; Strict Mode/rerenders deduplicated |
| `adp_local_action_performed` | Current instance's existing local callback; only allowlisted action type, no arguments or values |
| `adp_returned_to_appshell` | Existing explicit onReturn callback |
| `xray_report_opened` | Public `ReportComponent` extension, after the actual report mounts in the active SG2 host; never request start |

Five definitions deliberately remain inactive:

- `benchmark_analysis_started`, `benchmark_analysis_completed`: Finder embeds an
  independently owned dashboard. Eligibility, preview fetch and iframe load do
  not confirm completed analysis. No business workflow is invented.
- `xray_supplier_search_submitted`, `xray_supplier_results_displayed`,
  `xray_financials_viewed`: the current public FullXRayWorkflow contract lacks
  explicit, reliable callbacks for these stages. The gateway is also used for
  suggestions; transport completion and assistant context are not visibility proof.
  A future producer contract and separate SG2 adoption must provide those signals.

Thus 24 of the 29 existing definitions have supported emission points. This is
source coverage, **not 24 live verified events**. Standalone SRM is untouched.

## Validation and release gates

Run `npm run test:product-analytics`, `npm run typecheck`, `npm run build` and the
applicable existing regressions. The new suite is also included in the existing
`test:operation-context` script. SDK/network tests use synthetic configuration and
intercepted transport. UI tests exercise actual host callbacks with bounded public
UI/transport fixtures, not live accounts or providers.

Existing source-integrity receipts and their tamper tests must be preserved.
The proposed additive `productAnalyticsCompatibility` record binds the exact 31
amended source paths and retains all 94 predecessor fields unchanged. Its negative
tests reject changed bytes, missing/extra scope and rewritten history. Acceptance
remains subject to normal PR review. Never replace historical hashes, skip integrity
checks or report a passing isolated suite as passing full CI.

Before deployment: reviewed PR and exact-head applicable CI, accepted exact SHA,
recorded authorization, verified retained LKG artifact/digest/configuration and
executable rollback. Configure only the existing Development service, retaining
OFF until those gates pass. Obtain the token without writing it to source,
reports, test output or logs. No Staging/Production/SRM activation is authorized.

After controlled activation, perform actual UI flows with an authorized test
account and explicit tab consent. Independently query project 329829, compare
counts, modules, results, attempt IDs and sanitized properties against those
actions; confirm no automatic noise, other environments or replay recordings.
Only then consider verifying the demonstrated definitions. Preserve dashboard
`1075924`; add real insights only after evidence exists. No live measurements or
KPI success can be claimed from the offline tests.

## Execution evidence — 2026-11-02

Result: **PARTIAL — activation BLOCKED**. Source implementation is prepared;
the prepared additive source-integrity acceptance requires normal PR review and
exact-head controlled CI before merge/release.

- Manifest validation, full SG2 preflight, canonical PMOS begin and require-begin:
  PASS, in the registered SG2 PMOS project `lucky-dream-96138453`, `neondb`, exact
  registered endpoint. No product database/schema/RLS mutation.
- `test:product-analytics`: **8/8 PASS**, including the real pinned SDK with mocked
  transport and actual provider/ADP/PCI host emission points in Strict Mode.
- Typecheck and Next.js production build: **PASS**. Build used no product secrets
  or live database/provider calls. Generated Prisma outputs were preserved
  separately and excluded from the authored change.
- Selected AppShell, ADP, PCI, X-Ray, Sentry and analytics regressions: **44/44 PASS**.
  Additional account, identity, category, operation, SQL-source, diagnostic and
  integrated-journey compatibility regressions: **127/127 PASS**. The initially
  observed byte-binding refusals are resolved through the exact additive record,
  with historical evidence retained and additional negative tamper tests. Full
  controlled CI remains independently required.
- `npm run lint` cannot execute: this app has no configured ESLint rules and Next
  offers interactive first-time setup. No new lint configuration was introduced.
- Private dependencies used separate local copies of already installed packages
  after matching all three exact required versions; public dependencies came from
  npm. No GitHub token was passed to npm. Clean credentialed CI remains unproven.
- Render read-only observation: existing Development service has auto-deploy OFF,
  correct repository/main/environment; live deploy `dep-dbjnk78u01pc7380vtug`,
  SHA `88c9e0a2074bfafd1199a9caeb50497412a200bd`. No service configuration or deploy
  was performed. A retained artifact/digest/rollback was not established, so this
  observation alone is not LKG release readiness.
- PostHog project `329829`: all 29 exact definitions found, all remain unverified;
  project reports no ingested event. IP anonymization and Europe/Warsaw are set;
  autocapture, replay, console, performance, automatic web vitals and heatmaps
  remain OFF. Dashboard `1075924` is unchanged. No actual token is in these sources.
- Live UI flows, live PostHog receipt/payload/count validation and general-user
  retention metrics: **NOT VERIFIED**. SDK remains inactive in the existing service.
- Monitoring: **REUSED**; existing Sentry tests pass. SRM standalone, Staging and
  Production were not modified or activated.

Next gate: review Draft PR #862 and the bounded additive compatibility proposal,
then verify exact-head controlled CI. Merge/configuration/deployment require
their own recorded approval, recovery evidence and consented live UI validation.
