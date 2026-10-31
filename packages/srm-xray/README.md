# SRM X-Ray public module ports

Owner: SRM. Package 0.4.0 remains private and repository-owned. Installing it does
not authorize a product, account, organisation, data source or deployment.

| Public entry | Responsibility | Accepted host boundary |
| --- | --- | --- |
| `/contracts` | Normalized data and selection types | No React runtime dependency |
| `/executive-summary-rules` | Existing selection of confirmed facts/limitations | Headless, React resolution forbidden by test |
| `/financial-value` | Existing exact/compact display formatting | Headless; no financial calculation or persistence |
| `/executive-summary` | Existing Supplier Intelligence summary UI | Bounded React18.3.1 probe and existing React19.2.4 SRM tests |
| `/full-workflow`, `/full-report`, `/full-report.css` | Complete shared product composition | React18 SG2 and React19 SRM require independent host acceptance |
| `/full-report-operations` | Closed presentation commands and bounded responses | Signed same-origin gateway; original native HUMAN/E1 admission |

The peer range permits the React18 consumer and existing React19 host.
Consumers must use an explicitly accepted public entry and prove their own
framework build, input, gateway and protected business flow. No consumer may
import private `apps/srm/**` source or bypass a peer conflict with force flags.

The summary receives the existing normalized ExecutiveSummaryInput and host
callbacks. It owns neither login nor routing, tenant selection, grants, provider
transport, database connections, billing or authority. The host verifies the
current actor/organisation/application/product/operation/resource before obtaining
or releasing the DTO. A callback is a presentation port, not permission to an API.
Never pass tokens, backend credentials, raw provider payloads or an unverified
role into a browser component. The current presentation copy is Polish; this
candidate does not promise a new localized business model.

The formatter definitions move byte-for-byte into the existing pure utility.
The previous financial-history export and financial-dashboard selection type
remain available. ExecutiveSummary markup and business rules are unchanged;
only their dependency on UI-based formatting/type declarations is removed.

The React18 job uses public dependencies and an isolated file consumer, with
credentials absent and installation scripts disabled. It checks the real module's
SSR and host callbacks, source/period binding and no-data behavior. Existing SRM
tests/build verify the React19 application. These are producer compatibility
proofs, not a real second application integration, authorization proof, browser
session, actual business-module reuse or Development/Staging release. Separate
SG2 and release tasks must provide those remaining proofs.

## Native workflow 0.3 / wire contract 1.0.0

`@profitia/srm-xray/workflow` exposes `SupplierXRayWorkflow`,
`SupplierReportController` and `useSupplierReport`. The standalone application's
previous controller/hook paths are adapters to this one SRM-owned implementation.
A consumer supplies only PL/EN locale, light/dark theme, active lifecycle,
return navigation and authenticated same-origin transport. It supplies no user
or organisation authority. Mounting/reactivation performs no acquisition.
An explicit retry retains an uncertain logical idempotency key; a new completed
user action gets a new key. Inactivation aborts delivery and ignores late results.
The host must remount the entire module when user/session/organisation changes.
No persistent browser storage is used. Private KYS presentation expires locally
at the validity returned by its current authorized SRM read.

Version 0.4 replaces the former simplified workflow with the complete
`FullXRayWorkflow`. The compatibility workflow entry delegates to that same
composition. Both hosts render the same full scanner, indicators, statements,
history dialogs, KYS and locations. The host supplies authenticated transport
and its single assistant slot. Native-only telemetry remains in its native
adapter. Conditional sections follow the current SRM composition; dormant
components are not enabled as new product features.

Import `@profitia/srm-xray/full-report.css` (or its compatibility entry
`workflow.css`). The generated stylesheet scopes product rules to
`.srm-xray-product`; its font family has a private name. Regenerate using
`npm run build:presentation-css` in this package and verify with
`npm run check:presentation-css`. There are no SG2 product style overrides.

The additive presentation contract exposes ten fixed native operations for
XLSX, KYS/KRS PDF, authorized PESEL reveal, registry search/verification, web
identity, locations and map readiness. The original five workflow operations
and their wire version remain unchanged. Binary exports use the existing SRM
generators. Maps use the existing Maps runtime and protected SRM locations;
the runtime's host-origin allowlist must explicitly admit the SG2 public origin.
No provider, financial calculation, identity, grant or database policy moves
into this package. Local fixtures prove presentation behavior only; deployed
parity still requires controlled browser acceptance of both live hosts.

`@profitia/srm-xray/workflow-contract` defines the closed command mapping,
validated versioned response envelope and bounded JSON reader. The wire card
has optional source provenance: omitted source remains omitted. The contract
checks the projected company, financial and masked KYS shapes before delivery;
raw PESEL values and unknown projection fields are not accepted. Existing native
handlers retain their original response shape for standalone requests. Only an
independently authenticated peer request gets this versioned envelope.

The five approved POST operations are search, stored report metadata, company
KYS, sole-trader KYS and continuation of a server-confirmed KRS selection.
A signed caller proof is not product access. The SRM receiver runs the unchanged
Clerk session/account/binding validation and current E1 tenant/resource/product
checks under the captured end-user bearer. Provider work, audit, persistence,
cache, financial rules and idempotency remain SRM responsibilities.

Activation is disabled until deployment-owned `PROFITIA_XRAY_PEER_VERSION=1.0.0`,
a dedicated `PROFITIA_XRAY_PEER_KEY_ID` and a matching base64url server-only
`PROFITIA_XRAY_PEER_KEY` are installed in the existing Development services.
SRM's authorized parties must include the existing SG2 and SRM public origins.
This does not require a new Identity runtime, grants, database or CORS exception.
The wire id/version is independent of the UI package release. Compatible SRM backend releases retain wire 1.0.0 and can deploy independently.
A public UI change is bundled by its receiving host and requires its rebuild.
No deployment or live acceptance is claimed by this source proposal.
