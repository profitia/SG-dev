# Standalone Maps connector — Development

Task: SRM-MAPS-CONNECTOR-DEVELOPMENT-20261019
Authority: profitia/SG-dev/main; SRM profile; local isolated execution.

## Scope and source

Independent `apps/maps-runtime` plus framework-neutral contracts and public host adapter. Real Maps SDK rendering, explicit read-only synthetic test/harness, bounded data projection, server geocoding adapter without public admission, existing E1 embedded-read transport. No SRM button/mount, MGBI read, customer location persistence, migrations, product secrets or E1 source changes.

Onboarding PR519 merged e9eabd4bbab398185f6e42fc876e167e0a814ecd; governance19/19 and exact-head remoteCI39220089194 succeeded. Parallel E1 changes were preserved from current main. Separate SRM PMOS tasks use only srm_pmos and mandatory PHR; MEMOROS disabled.

## Verification status

Local connector tests/build and independent-origin browser/provider verification are recorded after execution. A configured health response is not live Google proof. Synthetic channel tests are not private E1/RLS or customer UAT. Live server Geocoding, supplier records, CRUD, organization persistence and SRM feature integration are not claimed by this slice.

## Deployment and rollback

New Maps runtime only; no existing product deployment replacement. Before initial bootstrap record the absent-service baseline, source/build manifest, environment configuration fingerprint, zero database/migrations and executable containment/removal procedure. Preserve exact resulting provider deployment/artifact evidence for later releases. Staging/Production remain untouched. Deployment remains pending until these checks complete.
