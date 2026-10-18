# E1 — SG2 regression at SRM named supplier-interest source

Task SG2-E1-NAMED-SUPPLIER-INTEREST-REGRESSION-20261019; SG2 Development.
SRM / SRM-E1-NAMED-SUPPLIER-INTEREST-20261019 / profitia/SG-dev / PR502 /
source761658643e70ce4449aec0e551f54f5c9ed8ff41.

SG2 Runtime, Dashboard and common platform source remain byte-identical to
accepted main1594b5ef9170ea6657817d59f8c6c3b63d5e2414. This is exact
cross-consumer regression verification, not adoption of named SRM interest or
new supplier endpoints in SG2. Existing trusted-main controlled CI alone
installs approved private artifacts with the owner-provisioned credential.
No controller, credential or access policy is changed.

SRM local evidence:117 native/ordinary PostgreSQL tests,499 product and311
promotion tests pass without skips, strict types and actual build pass.
Exact combined candidate/main CI, actual artifact proof and controlled merge
are required before final acceptance. Own SG2 PMOS/MEMOROS/PHR follow the
active Development profile. No cloud product configuration or deployment;
full E0/E1 remains IN_PROGRESS before business/identity/data/recovery/user UAT
and the later authorized Development release. No Staging/Production/E2-E4.
