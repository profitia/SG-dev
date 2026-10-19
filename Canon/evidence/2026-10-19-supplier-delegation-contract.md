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

Validation is IN_PROGRESS. The new real ordinary-role PostgreSQL Supplier fixture
passes, including default-host refusal, installation/ACL checks and an actual
Forecast dispatch using the default host after SQL013 in the same database.
The first full producer run reported 818 tests, 816 passing and two failing
counts for one cause: an existing continuation fixture pins candidate.9. Its
strict version assertion needs a separately registered ARCHITECTURE correction;
it is outside this task's immutable target list. Governance also detects old
consumer lock versions pending separately governed SG2/SRM compatibility tasks.
These are unresolved validation results, not an accepted release.

No vendor acquisition, private Supplier SERVICE phase adoption, application
activation, cloud SQL/data/role/grant/secret/configuration/resource mutation or
deployment is performed here. Synthetic source delivery is not a completed
business report, vendor license or real-user acceptance. Full E0/E1 remains
IN_PROGRESS through the remaining business/data/identity/recovery requirements
and controlled Development release. Staging, Production and E2–E4 are excluded
from this finite source task.
