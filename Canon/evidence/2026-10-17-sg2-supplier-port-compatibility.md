# SG2 — compatibility with the SRM supplier-port producer

Task `SG2-E1-SUPPLIER-PORT-COMPATIBILITY-20261017`, SG2 / Development.
Authority at start `1f06d80d39b83cfe46895c9199587fc220faa9d3`.
Producer: SRM, task `SRM-E1-SUPPLIER-SUMMARY-PUBLIC-PORT-20261017`,
[PR439](https://github.com/profitia/SG-dev/pull/439), source
`db5a94caeb842be1daefc3bca183453c19063370` (including correction of the
initial rejected CI directory-context definition).

## Bounded receiver acceptance

The producer exposes existing Supplier Intelligence summary data/rules/UI
through narrow public package ports. It removes a runtime React dependency from
pure formatting/rules, preserves old exports and explicitly limits React18
acceptance to those ports and the selected summary leaf. Its public isolated
consumer does not import private SRM app code. Existing SRM retains React19.

This SG2 unit verifies that the unchanged existing SpendGuru application and
dashboard remain compatible with the exact combined source. SG2's React18,
Next14.2.35, dependencies, operation receipt, contract fingerprints, benchmark
permissions, routes and business behavior are unchanged. No artificial adoption
receipt or dependency was added merely to satisfy CI. No supplier permission
or backend gateway was inferred from presentation compatibility.

The local isolated runtime dependency directory remains empty. Consequently
there is no claim of local full SG2 API/Prisma/SQL, typecheck or build. The
approved controlled CI must validate its real locked runtime at the exact
aggregate after the credential phase ends. The independent exact-source public
dashboard job, common lab, SRM API/SQL compatibility, complete SRM build and new
public React18 producer probe must also pass before merge. Actual source, runs,
results and own PMOS/MEMOROS/remote-PHR closeout are recorded after those gates.
This evidence is not itself a completed CI result.

## Explicit limits

SG2 has not yet integrated or displayed the supplier module through a protected
business flow. Shared types, pure logic, SSR and callback tests do not meet the
second-host business reuse criterion. That integration remains a separate
accepted E1 receiver task with its own gateway, authorization, regression and
framework-build proof. This unit neither activates Clerk/private product routes
nor changes vendor package access, the controlled-CI authority, secrets, data,
roles, grants, environments, deployments or domains. Existing Development and
Staging continue on their existing releases until controlled promotion.
