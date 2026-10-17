# SRM X-Ray public module ports

Owner: SRM. Package0.2.0 remains private and repository-owned. Installing it does
not authorize a product, account, organisation, data source or deployment.

| Public entry | Responsibility | Accepted host boundary |
| --- | --- | --- |
| `/contracts` | Normalized data and selection types | No React runtime dependency |
| `/executive-summary-rules` | Existing selection of confirmed facts/limitations | Headless, React resolution forbidden by test |
| `/financial-value` | Existing exact/compact display formatting | Headless; no financial calculation or persistence |
| `/executive-summary` | Existing Supplier Intelligence summary UI | Bounded React18.3.1 probe and existing React19.2.4 SRM tests |
| Root and previous CSS entries | Existing SRM composite/mount surface | Existing React19 acceptance; other React18 mounts are **not** accepted |

The peer range permits the tested React18 leaf consumer and existing React19
host. It does not assert that every root/composite export works on React18.
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
