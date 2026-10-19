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

## Executed checks and first activation

- Connector11/11 tests PASS, zero skips; build and strict public declarations PASS; secret scan PASS. Actual remote governance39221751949 and Maps39221752034 SUCCESS for PR520/60c9d4a. Merge e88fbc849b19903bc0efc1e9d9cf3407889892c3.
- New service srv-dbat5ulg1s2s73defcp0, exact SRM Development environment evm-dapbd70ae00c73cgrup0, existing workspace tea-d7lps8rbc2fs73cn80dg; Frankfurt/free, manual deployments, previews off, no database. Actual URL https://profitia-maps-development-runtime.onrender.com . Existing SRM/SG2/E1 services were not redeployed.
- Initial LIVE dep-dbat5v5g1s2s73defdtg; corrected Node configuration LIVE dep-dbat6alg1s2s73degmng at the same merge SHA. Actual deployed application manifest SHA256 0ee2b415952ead07021aa963d7b327d334cddfc3c05023ef2825b3fb3565b1e2 equals the locally tested application artifact. This is an application-content digest, not a provider OCI-image digest.
- Existing Google project profitia-maps-development, existing browser key maps-browser-development restricted to Maps JavaScript API, existing Vector Map ID237c53e16123ae7c62b3b1c6. Preserved SRM origin; added the new Maps origin and two exact localhost origins for3410. No key values committed or included in evidence. No Staging/Production key changes or new Google project.
- Actual browser at the deployed runtime rendered Google tiles and two synthetic markers without Google user login. Unresolved entry remained in the list. A WebAssembly CSP error/deprecated marker handler was then observed; the follow-up adds only wasm-unsafe-eval (not JavaScript unsafe-eval) and the current gmp-click API. Patched local runtime3410 embedded in independent static host3411 rendered its Gdansk point through the actual E1 channel; error/warning console empty. Recheck the deployed correction before final acceptance.

## Honest chronology and remaining boundaries

The Render environment-variable update operation unexpectedly triggered a second deployment while the first bootstrap was already LIVE. Its absence baseline had been recorded, but the complete preceding LIVE artifact/configuration readback was not captured before that automatic trigger. This chronology is retained as a procedural deviation; later verification does not retroactively satisfy that earlier ordering requirement. The change only corrected the new runtime Node version, retained the same application SHA/digest and touched no product data. Future source deployments require a complete verified LKG first.

Canonical onboarding closeout initially rejected manually supplied completion fields and then missing targetEnvironment before persistence. Corrected input used the canonical writer, preserved rejected inputs, and completed PMOS/PHR. These were operator-input corrections, not history rewrites or source gate waivers.

Live server Geocoding, MGBI mapping, private location CRUD, organization persistence/RLS, business E1 admission, SRM feature mounting and customer UAT remain outside this connector slice. Standalone Maps connection and public transport readiness do not imply user readiness in SRM.

## Retained-artifact rehearsal and corrected rendering

Actual rollback POST to retained dep-dbat5v5g1s2s73defdtg produced dep-dbataebncjis73abklj0, LIVE; reverse restore of dep-dbat6alg1s2s73degmng produced dep-dbatb3m7bikc73at8r80, LIVE. Both retained the exact old source/application digest, configured HTTP200 and no database. These were actual provider rollback executions, not source rebuilds or mocked tests. Configuration fingerprints and scoped API responses remain in the isolated task evidence. The deletion procedure was also checked using the CLI's no-confirm dry run; no service was deleted.

After exact PR521 CI39223045014/39223045061 and exact merged-main CI39223336406/39223336420 SUCCESS, pinned b161db4fa165b6c609e7a56533b9dbc0426f70e2 was deployed as dep-dbatc0e7bikc73atc1lg, LIVE. Health reports Node v22.23.3. Its real browser map rendered without warnings/errors; selecting Warsaw in the location list updated selection and panned/zoomed the Google map. Application digest67718120c894263458e6253e8921f0e37d54d3b3d2796fdbf0a12bc3fdc993bb.

The final startup follow-up separates the default90s runtime boot deadline from the unchanged maximum15s E1 read deadline. Official Render Free guidance documents wake-up of about a minute; the old shared15s timer could abort an otherwise valid cold start. Regression test delays the runtime ready handshake beyond its read deadline and still completes the real E1 channel exchange. Actual15-minute idle/sleep/wake was not waited out. Free is a technical Development choice; do not infer production availability or unlimited artifact retention (only two prior deploys on Free).
