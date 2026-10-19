# E1 — explicit Supplier target in the existing delegated job contract

Task: ARCHITECTURE-E1-SUPPLIER-DELEGATION-20261019. Profile ARCHITECTURE,
TARGET_ENVIRONMENT=development, isolated local workspace, authority
profitia/SG-dev main. Base 7cba6e0719d6f99d91cf5810a799c367f0b4cb89.

This producer candidate adds the closed `supplier.report.refresh` target to the
existing delegated job engine. It retains the actual SERVICE executor and a
separate human initiator, current rights, finite delegation, the existing private
request ledger, dispatch state, immutable audit and source-delivery protocol.
Default stores remain Forecast-only. Supplier requires explicit configuration
and a verified optional SQL013 installation. No second queue or worker is added.

Supplier admits PORR_SUITE, SPENDGURU_SAAS and
SUPPLIER_INTELLIGENCE_STANDALONE only with the Supplier module, current product
access and the exact operation/resource/payload. Optional controlled-owner SQL013
replaces the same functions and extends their checked operation/profile pairs.
Original SQL001–012 bytes and existing Forecast semantics are preserved.

Source versions: platform-contracts 1.17.0, operation implementation candidate.10,
private host 1.8.0 and delegated job 1.1.0. Public operation contract remains 1.0.
Shared contracts are independent of React; consumer compatibility is separate.

Local producer/laboratory validation passes: 818 tests, zero failures and zero
skips on a fresh own ordinary-role PostgreSQL fixture, stopped after verification.
This includes Supplier dispatch/source delivery and default Forecast execution
after SQL013 in the same database. Public positive/expected-negative TypeScript
consumers pass. Original SQL001–012 byte preservation is independently checked.

The first full run's 816/818 passing result and exact old version-pin failure
remain recorded. Separately registered
ARCHITECTURE-E1-CANDIDATE10-REGRESSION-20261019 preserves the strict audit assertion
and updates its exact expected implementation to candidate.10. Consumer lock and
source fingerprints require separate SG2/SRM tasks and controlled candidate/main
checks before acceptance. No local source result substitutes for those checks.

No vendor acquisition, private Supplier SERVICE phase adoption, application
activation, cloud SQL/data/role/grant/secret/configuration/resource mutation or
deployment is performed here. Synthetic source delivery is not a completed
business report, vendor license or real-user acceptance. Full E0/E1 remains
IN_PROGRESS through the remaining business/data/identity/recovery requirements
and controlled Development release. Staging, Production and E2–E4 are excluded
from this finite source task.
