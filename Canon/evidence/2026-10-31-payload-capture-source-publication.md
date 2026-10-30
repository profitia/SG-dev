# Optional payload capture: bounded source publication

Task: ARCHITECTURE-PAYLOAD-CAPTURE-SOURCE-PUBLICATION-20261031.
Scope: only @profitia/platform-payload-capture1.0.0 and its producer test adapter.
Prepared input: ba3cfd238b639a65c311cc28f300ad4a3682d7dc.
Status of this pre-CI receipt: SOURCE_GO_NOT_GRANTED.

The package runtime, manifest and declaration retain their prepared bytes. The
accepted SDK1.32.3, current FRESH package, Source1.33 candidate, application code,
receipts, SQL, access/Source limits and service configuration are unchanged.
The only prepared-test correction replaces the Mac-specific temporary directory
with os.tmpdir(), so the packed public API test runs on GitHub's Linux runner.

The existing Architecture producer workflow already discovers
apps/architecture-lab/test/*.test.mjs. The new owned adapter links the package to
one local SDK peer and imports its actual22 tests in the same Node test process.
It does not spawn an inherited test runner or substitute source assertions for
the package tests. The same strict packed ESM/CommonJS/type tests run in CI.
There is no workflow, trusted controller, candidate admission, permission or
environment-policy change in this publication.

All source commits/PR and any permitted merge use [skip render]. Render's current
metadata has automatic deployment off for SG2/SRM Development and Staging, their
workers and ARCHITECTURE PMOS. Legacy main-linked automatic services outside those
surfaces still exist; the documented skip marker protects the source-only merge
without changing their settings. Provider guidance:
https://render.com/docs/deploys#skipping-an-auto-deploy
https://render.com/docs/service-previews#skipping-a-preview

Formal SOURCE_GO requires fresh authority, exact reviewed candidate, applicable
remote CI and source acceptance. A passing package suite does not replace other
mandatory checks. The trusted-main controller's current Architecture class
restricts ordinary paths and has a separate closed exception for the prior
FRESH PR817; that exception is not transferable to this package. If admission
refuses this source, record its exact PR/SHA/reason and preserve the PR. Do not
rename it into another project family, reuse unrelated proof, edit policy or
declare SOURCE_GO to pass the guard.

The repository main branch currently returns no GitHub branch-protection check
configuration. That does not waive the active Canon's required CI or producer
acceptance. Final remote status, any blocker, source identity and PMOS/PHR
closeout are recorded by the publication task after factual results exist; this
dated pre-CI receipt is not a merge, runtime install or business acceptance.

SRM retains a separate task for package/lock and capture-adapter adoption, full
mapped-input replay, regressions and any later controlled release. No provider
payload fixture, remote acquisition or deployment is part of this publication.
