# Standalone Maps connector — Development

Task: SRM-MAPS-CONNECTOR-DEVELOPMENT-20261019
Authority: profitia/SG-dev/main; SRM profile; local isolated execution.

## Scope and source

Independent `apps/maps-runtime` plus framework-neutral contracts and public host adapter. Real Maps SDK rendering, explicit read-only synthetic test/harness, bounded data projection, server geocoding adapter without public admission, existing E1 embedded-read transport. No SRM button/mount, MGBI read, customer location persistence, migrations, product secrets or E1 source changes.

Onboarding PR519 merged e9eabd4bbab398185f6e42fc876e167e0a814ecd; governance19/19 and exact-head remoteCI39220089194 succeeded. Parallel E1 changes were preserved from current main. Separate SRM PMOS tasks use only srm_pmos and mandatory PHR; MEMOROS disabled.

## Verification status

Executed test and provider results are recorded below. A configured health response is not live Google proof. Synthetic channel tests are not private E1/RLS or customer UAT. Live server Geocoding, supplier records, CRUD, organization persistence and SRM feature integration are not claimed by this slice.

## Deployment and rollback

New Maps runtime only; no existing product deployment replacement. Before initial bootstrap record the absent-service baseline, source/build manifest, environment configuration fingerprint, zero database/migrations and executable containment/removal procedure. Preserve exact resulting provider deployment/artifact evidence for later releases. Staging/Production remain untouched. The executed deployment and rollback evidence is recorded below.

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

## Final standalone acceptance — 19 October 2026

Final runtime0.1.1 source **db2df0a6cccb994ea4654ae0eb5b3af4b46867ff**, deployment **dep-dbati9rrjlhs73akpsj0**, actual **LIVE**, Node **v22.23.3**. Exact deployed application-content digest **357464b3948e1141e73f8877f4bc42047d2fc7fcc1299e913d8ad98c6fabb984** matches the tested local manifest. Public HTTP health/configured/source/runtime checks passed; a malformed request returned400 and the next health request returned200. No server Geocoding or location-write endpoint is exposed.

Final browser check used the actual deployed runtime inside a separate host at http://127.0.0.1:3411: the host and map reported ready, Google tiles and its own Gdansk point rendered, with zero current error/warning logs. Unmount removed the iframe cleanly. A separate final standalone check rendered Warsaw/Krakow plus the unresolved list entry with no current errors/warnings. The earlier corrected-rendering check also verified list selection/panning/zoom. Native automation could not click inside Google's closed marker shadow root; direct marker-click UI verification is not claimed. Selection event binding and unknown-ID denial were exercised through the real MessageChannel test. Provider error logs after final release were empty.

| Check | Result |
|---|---|
| Connector tests |11/11 PASS; zero failures/skips, including actual local HTTP, delayed handshake, channel denial, malformed target and provider doubles|
| Public declarations |Strict TypeScript check PASS|
| Build / secret scan / diff |PASS; runtime has3 local packages and no external runtime npm packages|
| Onboarding routing |19/19 PASS|
| Exact final PR CI |Maps39224582631 / Governance39224582618 SUCCESS|
| Exact final main CI |Maps39224962205 / Governance39224962195 SUCCESS|
| Actual Google Maps JavaScript |LIVE browser rendering verified|
| Separate-origin host |Actual deployed runtime embedded and unmounted successfully|
| Retained-artifact rollback |Actual rollback + reverse restore LIVE and HTTP/digest verified before subsequent source releases|
| Supplier/MGBI/private persistence |Not implemented by this task|
| Live server Geocoding |Not verified; adapter only, tested with controlled responses|
| Private business E1/RLS |Not adopted/exercised; existing public presentation channel only|
| SRM user feature / business UAT |Not mounted / not performed|
| Existing product deployments |SRM Development health200; Development/Staging service configuration timestamps unchanged from16October; no product deployment or DB mutation|

Source PRs: [519](https://github.com/profitia/SG-dev/pull/519) onboarding, [520](https://github.com/profitia/SG-dev/pull/520) connector, [521](https://github.com/profitia/SG-dev/pull/521) vector CSP, [522](https://github.com/profitia/SG-dev/pull/522) startup and malformed HTTP. The final evidence update is documentation-only and does not redeploy the application. Task branch: srm/maps-connector-runtime-20261019. Actual application source above remains distinct from the later evidence commit.

Screenshots are retained in the task's requested local output folder: Google Maps/maps-connector-development-2026-10-19.png and maps-independent-host-2026-10-19.png. No credentials are included. Google attributions remain visible.

## Operational handoff and SRM readiness

**The standalone Google Maps connection is ready for Development integration. An SRM user will not yet see a Maps feature.** The next separately coordinated slice needs the supplier-card mount, MGBI headquarters/available branches, real server geocoding admission/credentials, organization-owned manual locations, E1 operation rights and product persistence/isolation tests. Existing interface capabilities or supplied IDs do not grant those rights.

This initial Free runtime can sleep and wake slowly. Startup waiting is bounded separately from E1 reads; actual15-minute idle wake-up was not exercised. Free rollback retention is limited to two previous deploys, so preserve/reverify the exact eligible LKG before every subsequent release. The recorded digest identifies application content and does not claim provider OCI-image parity.

Development continuity uses only SRM/srm_pmos. Onboarding task SRM-MAPS-RUNTIME-ONBOARDING-20261019 is independently read back as completed/CLOSEOUT_COMPLETE. Final implementation task SRM-MAPS-CONNECTOR-DEVELOPMENT-20261019 closes through the canonical writer after this evidence is merged; its PMOS/PHR result must be read back rather than inferred from source publication. MEMOROS is disabled by the registered SRM profile. No Staging/Production mutation, customer data migration or external chat message occurred.

## Execution-compliance findings and independent authority reconciliation

The functional standalone connector outcome is complete, but execution compliance is **PARTIAL_SUCCESS**, not an unqualified claim that every historical gate ordering requirement was met. Preserve the initial Node-configuration automatic-deploy deviation described above.

A second operator error occurred during final report publication. The full preflight reported CODE_STATE_GATE=BLOCKED at HEAD54cdefbb4bf50cdc958872769a8c6aaffa3600eb because origin/main had advanced to cdddaf69a7ea0e40b6d3262b51d08fcc2e0177e0. Operator orchestration invoked the documentation-only PR523 merge before checking that failed preflight result. Mergeffab6ca5d34763dc57e02f3b0a56c65cdb874853 is retained; it is not retroactively authorized by later checks. No application deployment or product data mutation resulted from this merge.

The concurrent authority change was [ARCHITECTURE PR524](https://github.com/profitia/SG-dev/pull/524). It reconciled the already-created Maps service into the primary SRM Development topology. The Maps task initially registered its own Maps topology only; that did not satisfy the primary SRM topology used by E1's stricter live-provider gate, which correctly refused an unregistered service until the separate Architecture correction. This is an integration-governance gap attributable to the Maps onboarding, not a reason to weaken the E1 gate. The Architecture task's17-line reconciliation evidence, exact service identity and reference to Maps topology were read and preserved.

Independent reconciliation then refreshed main, fast-forwarded the clean isolated branch toffab6ca5d34763dc57e02f3b0a56c65cdb874853, proved that all deployed Maps application/package files remained byte-identical todb2df0a6cccb994ea4654ae0eb5b3af4b46867ff, and reran the complete SRM preflight with the actual task registration: PASS, no blocked gates. The Maps deployment remains LIVE at its verified source/digest. This current-state verification does not rewrite either earlier failed verdict or represent a blanket waiver. This corrective evidence is published only after an observed passing gate; future orchestration must check the actual preflight result before dispatching any dependent mutation.

Outside-scope tooling finding: installing the unchanged PMOS dependencies reported13 npm audit findings, including one critical. They were not investigated or upgraded by this connector task. No claim of security acceptance for existing PMOS tooling is made; the Maps runtime itself has only its three local package dependencies.
