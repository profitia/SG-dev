# SG2 private Forecast request acceptance — 18 October 2026

Status: locally verified receiver candidate; exact combined candidate/main CI, canonical closeout and later controlled releases remain required. No live activation or actual dispatch is claimed.

Task SG2-E1-FORECAST-PRIVATE-REQUEST-20261018, SG2, workspace SG-dev, target Development, local execution. Own registration cmvdmyqdt0000xoiizz4heqng in SG2 neondb, MEMOROS required. Sixteen declared aligned paths, including the existing mandatory test command. Full manifest, current provider snapshot, before-begin and require-begin gates passed. No external PHR authority exception is reused.

## Producer and bounded result

Accepted producer ARCHITECTURE-E1-FORECAST-REQUEST-RESERVATION-20261018, source cd3c5567a705cf575b708af315dd8e598c6f8259, platform1.10.0, operation candidate.6, private host1.4. Runtime and Dashboard file-dependency locks agree. The existing official Clerk adapter, current private access/module/product authority and ordinary Prisma transaction remain the only decision path.

The new separately default-off POST /api/benchmark/forecast/requests requires an actual session authorization header, bounded JSON, a closed existing ForecastPreparationCommandSchema command and a bounded opaque idempotency key. Organisation selection is checked against current membership/profile; user identity and command ownership come from verified context. Cookies or forged headers alone cannot write. Unknown command fields, wildcard identity, wrong type, body encoding and oversized input are refused. The queue's unchanged schema loads only when the new request adapter needs it; unrelated host initialization does not load the preparation graph.

The same private transaction reserves a finite current policy unit and stores a typed domain command, its common immutable intent and correlated OUTCOME. The receipt is only requestId/status:ACCEPTED, projected afresh as a private/no-store202 response. A retry reauthorises without another command/unit. Changed organisation or payload under the same actor key conflicts. A different actor has a separate key namespace.

The original Forecast queue, worker, scientific functions, public source schema and generated clients are unchanged. Acceptance does not mean QUEUED, dispatched, computed or paid. The private domain command is a delivery intent for later authorised dispatch, not a second compute scheduler. SERVICE delegation, execution budget, job state and UI preparation parity remain separate E1 work. SRM independently accepts source compatibility without adopting this operation.

## Database boundary

Additive private-store003 creates only profitia_forecast_requests installation/commands under the existing controlled NOLOGIN owner. Explicit common SQL006 installation/digest is required. Both tables FORCE RLS. Runtime grants remain explicit in release preparation; no role, grant, policy, user or application is provisioned by this source.

The command references common request/application/environment/organisation/user/payload by a composite foreign key. Its stored UTF8 text is independently hashed with PostgreSQL16 built-in SHA256 and must equal that immutable intent's digest. Generated JSON has exactly four required string fields. The resource is the digest-derived request identity. Runtime insertion additionally requires current request permission/module/product/user scope and the matching RESERVED parent/decision. Accepted commands and installation metadata resist mutation under accidental broad runtime grants; ordinary unscoped SELECT exposes no commands. This does not claim resistance to a database administrator or stolen fully privileged backend credentials.

| Accepted source | SHA256 |
| --- | --- |
| Operation candidate.6 | f642b1c7bdaff44a1ff649d8a3d415253e39885f5e2a50d31d57d8b7641f3ec2 |
| Private host1.4 | 31c6a0ec35e6ba59ec8f24939a9784b6587c5833e3ce353bbeb3c9a484cfd94d |
| Common SQL006 | 0af5eed241ad1db08bfed89c95c47ef21a7dbeed0ee54bcccce52164ddcc4127 |
| SG2 private command SQL003 | 90f72b87071fb81a7ac594cbf48836511ef935aaf9f09ab8a7a1402b25d337d8 |

## Local verification and limitations

529 whole SG2 integration tests,61 existing Forecast business tests and strict affected public declarations/types pass, zero failed/skipped. New real API cases use actual Next handlers, ordinary native Prisma and uniquely named databases in newly initialised local PostgreSQL16 clusters. Existing databases and cloud are untouched. Tests cover CURRENT/VERIFICATION original-schema parity, concurrent one-effect retries, scoped ownership, changed key/scope conflicts, current session/member/product/module/permission revocation, finite capacity/missing policy, boundary mismatch, malformed input and default-off entries. SQL independently refuses substituted owner/environment/command bytes. OUTCOME failure rolls back domain command, common intent and quota; durable INTENT/FAILURE remains. Network/provider/dispatch calls are trapped and no compute queue exists in the fixture.

Initial local harness failures are retained: one test incorrectly expected the same actor/key to succeed after an organisation change; the specified contract correctly conflicts. The new adapter initially imported existing API projection helpers eagerly; their legacy environment module captured configuration before the existing test set its synthetic provider values. A temporary local preset made those tests green but CI correctly reproduced52 downstream failures. The adapter now imports those helpers only during its new publication. The full529+61/strict proof was repeated with real secrets removed and without that preset, matching CI initialization; all passed without relaxing assertions. The cross-host guard correctly rejected the old locally installed Dashboard1.9 SDK until genuine1.10 bytes were installed. Diagnostic wrappers were removed; a redacted synthetic audit-reason assertion remains useful on future failures.

No live/cloud DDL, data, role, grant, request policy, secret, configuration, feature activation, package registry publication or deployment. Existing Development and Staging products keep their current artifacts. Real Clerk login, full preparation/job functionality, executable recovery and controlled Development then Staging acceptance remain required by the overall programme. No Production/E2–E4 expansion or full E0/E1 completion claim.
