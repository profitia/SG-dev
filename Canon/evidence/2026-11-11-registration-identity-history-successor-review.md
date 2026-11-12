# Stage I registration: exact Identity-history verifier successor

Status: PROPOSED — separate owner decision required. This is an inert review packet.
Task: ARCH-REGISTRATION-IDENTITY-HISTORY-SUCCESSOR-PROPOSAL-20261111.
It does not activate a verifier, install SQL, send invitations or deploy a product.

## Business and implementation consequence

Continue the accepted account-to-organisation-and-team outcome without dropping
the accepted recurring functionality or native Identity draft API. Additional
historical compatibility tests found a missing predecessor mapping in the
approved test helper. The prepared source remains unpublished and unmerged.
Application and production SDK changes are not part of this successor.

The owner approved [PR1016](https://github.com/profitia/SG-dev/pull/1016), frozen
document7a6c4aca86119fe77120a22d69acaa1ce6f4e555. Its implementation
[PR1017](https://github.com/profitia/SG-dev/pull/1017) is accepted at
mainb6df3533750d0278440b0a432e412731bff47a42. Exact policy checks passed:
212 controller and79 governance/routing cases; protected
[43073980681](https://github.com/profitia/SG-dev/actions/runs/43073980681)
1501 tests plus typecheck/build; public43073946843 attempt2 and governance43073946914.
The entire resulting-main
[43077086510](https://github.com/profitia/SG-dev/actions/runs/43077086510)
passed, including actual SRM API, ordinary-role SQL, typecheck/build and SG2's
verified protected proof. Main governance43077086611 passed.

Those policy successes do not mean the unpublished joint source has passed.
The unchanged approved65 physical files passed the trusted65/165/368 provenance
guard, helper4, core99, PostgreSQL16 onboarding16 and full Identity401 cases.
The additional Architecture and SG2 historical suites produced1 pass/3 failures:
current native Identity HTTP hash362687ff03605bc908443992844f887aba69d7e263383f2f38893bbb2fca3ca0
was exposed where the unchanged recurring guard expected predecessore4eb8d7c649340114c3de71fa19362ffef8ccd44f4d7a355d74eb49d10df323e.
The helper projected SDK/test/consumer maps, but not native Identity sources
outside those maps. No assertion has been waived and no alternate reader run.

## Exact correction and retained boundary

Change only these two test-only files:

- packages/platform-contracts/test/organisation-sdk-compatibility.mjs
- packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs

The same65 path/status/mode/owner bindings remain:34 Architecture,17 SG2,14 SRM.
63 blobs are identical to1016. The production SDK165 files, all application
source, source recordccf680f0a83b61f3944dd2823259e9487ddae5c2a7707b8d05e793241c4aae40,
48 SDK/3 optional fingerprints, both original receipts, Root16 default and
isolated optional21/22 implementations remain unchanged.

For the reconciled1.36.0 record only, authenticate all eight already-approved
Identity source/document bytes against their exact immutable producers
5a963f313317d57e1946e1d7aabd28192db9c7bd and
6dd651bee360d80a644f7526cf1397f60a0db461 before exposing any historical view.
Then project those eight paths to the actual0775 predecessor. A newly added
path remains absent in that predecessor; it does not silently use current bytes.
Original020 and approved25fea /1.34.0 source graphs retain their behavior.

The added regressions cover every current Identity mutation, every immutable
Identity producer forgery, actual predecessor bytes and absent predecessor files.
Existing all-SDK/peer/receipt/history/path tests remain.

The inert controller patch preserves the original1016 full65 map under
REGISTRATION_SDK_RECONCILED_REVIEW and adds only the exact two-blob successor.
Same-length review selection compares every path/blob/status and rejects mixed
maps. The physical overlay authenticates either complete known65 map before
projecting to the unchanged368 recurring graph. Fixture tests cover old, new,
mixed, native tamper and recurring-only tamper cases. All initial41/48/59/1012
and recurring119/123/124 reviews remain available unchanged.

No generic file pattern, altered credential scope, proof waiver, application
activation, PMOS authority transfer or grant/package bypass is proposed.

## Exact frozen material

See adjacent [source-review.json](../proposals/registration-identity-history-successor-20261111/source-review.json),
[helper text](../proposals/registration-identity-history-successor-20261111/organisation-sdk-compatibility.mjs.txt),
[test text](../proposals/registration-identity-history-successor-20261111/organisation-sdk-compatibility.test.mjs.txt)
and [controller patch](../proposals/registration-identity-history-successor-20261111/controller-amendment.patch).

Prepared source 4b35bddaa2d30e29b59a1b25f937870c8dad0753; tree 99e021a428f68f9a7766ee4e34096ab002d20e57; base b6df3533750d0278440b0a432e412731bff47a42.

Exact entry-map SHA256 3dfc27a7152b5fb451db069e2c250dbd2713dedd93ddf4ecbc7291a16eca3c11.

- packages/platform-contracts/test/organisation-sdk-compatibility.mjs: Git blob857e029d2326452071572ce1709584eaeb807752; SHA256b7ffd9a187482c0601d9bdef568147ea90ac449bbe4ae9e2e7d41b36e32f3d08.
- packages/platform-contracts/test/organisation-sdk-compatibility.test.mjs: Git blob891bd121e8699f5070571f8aadc19a6c108bd39f; SHA2568faa9346c7313add20c981423c823a4786527d7944b3e7596efd9e8f932d7a5b.

Inert controller patch SHA256 d925fe985b46302c2171e9743a4d028c11c7e6edb312488e0302336e8382d3a1.

The prepared Git source object is not a published source transport. It preserves
972ad35fbbdf89f507749a49efda5f98a8caee86 and6dd651 as parents so accepted
historical source is available after ephemeral branch cleanup. Existing983 remains
the coordinated source transport after approval and all required acceptance.
Never publish the known-failing unchanged source just to advance a CI gate.

## Validation and execution after decision

Before the decision: inert construction, exact65/63+2 blob/status/mode comparison,
all eight producer/current byte comparisons, unchanged record and application/SDK
checks, syntax-only parsing and patch applicability. The changed verifier and its
new regressions have not been imported or executed. This is not a claim of PASS.

After explicit acceptance of this exact packet:

1. Apply the bounded trusted-controller successor; retain all former full maps.
   Run old/new/negative policy tests and required exact-head protected/public/
   governance checks and resulting-main checks.
2. Materialize only the two approved helper/test blobs into the prepared source.
   Run helper regressions, the previously failing Architecture/SG2 historical
   suites, native Identity, core and PostgreSQL16 checks.
3. Preserve owner input histories and the same65 source scope, refresh onto
   accepted policy main with identical reviewed versions, and use existing983.
   Require actual owner SOURCE GO, full exact-source protected/public gates and
   resulting-main evidence before coordinated source adoption.
4. Keep Stage I product outcome open. Native full organisation/invitation/package/
   Development tenant routing and real UAT, canonical PORR identification and
   governed007/008 installation remain separate required work.

The active [integration runbook](../runbooks/shared-development-contract-integration-v1.md#stage-i-registration--recurring-reconciliation--approved1016-2026-11-11)
binds refresh to “all65 exact reviewed versions unchanged”. This packet replaces
two of those versions, so the prior1016 decision cannot silently approve it.
No SQL, permission/package assignment, provider/model call, email, paid operation,
DNS or application deployment follows from this source/test decision.

All durable artifacts belong on GitHub and canonical Architecture PMOS/PHR.
Source65 validation and parent Stage I tasks remain active.
