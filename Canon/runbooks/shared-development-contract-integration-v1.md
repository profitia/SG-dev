# Przyjmowanie wspólnych kontraktów Development

Zakres: E0-A-06, trzy tory SG2, SRM i ARCHITECTURE. Project key developmentu nie zastępuje Organisation ID ani User ID produktu.

ARCHITECTURE utrzymuje jeden pakiet packages/platform-contracts i techniczny harness apps/architecture-lab. Integracje aplikacji prowadzą osobne zadania i PR-y właścicieli SG2/SRM, z referencją do taskId, wersji, SHA i digestu kontraktu. Producent został przyjęty w PR280; odbiorcy w osobnych PR281 (SG2) i PR282 (SRM). Workflow platform-contracts-ci.yml sprawdza oba rzeczywiste przyjęcia. Dated proof: Canon/evidence/2026-10-13-e0-a-06-controlled-integration.md.

1. Eksperyment wykonuje się w gałęzi architektury i własnym laboratorium. Nie dotyka to kodu ani danych aplikacji.
2. Stabilny kandydat przechodzi testy kontraktu. SG2/SRM przyjmują go jawnie w oddzielnych zadaniach, zapisując wersję i digest źródła w swoich integration manifests.
3. Wspólny CI uruchamia testy zależnych odbiorców przy zmianie kontraktu lub ich integracji. Rozbieżny digest blokuje publikację do czasu kontrolowanego przyjęcia przez oba tory. Wersja w monorepo sama nie gwarantuje izolacji.
4. Merge źródeł i deployment są odrębne. SG2/SRM mają własne reguły release i pozostają na zaakceptowanym SHA do świadomego wdrożenia. ARCHITECTURE PMOS ma osobny manual exact-SHA deployment. Przy zmianach samych narzędzi CI nie wykonuje zbędnego deploymentu produktu.
5. Przed każdym merge aktualizuje się main i powtarza właściwe bramki oraz testy. Zapis PMOS/PHR zawiera referencje do obcych zadań; nie tworzy cudzych lokalnych relacji w innej bazie.

Kontrolowany kontrakt Development jest sprawdzany z rzeczywistymi rejestrami profilu i workspace. Testy odbiorców nie wymagają haseł baz ani paid provider calls. Pełny build i regresja aplikacji pozostają kontrolami właściwego projektu. Wszystkie workflow są bez automatycznego deploymentu produktów.

## Wykonywanie i dowody CI

Workflow Platform contract integration uruchamia się na PR oraz push main po zmianie źródła kontraktu/laboratorium, przyjęcia lub komendy odbiorcy, rejestru profilu/workspace albo samego workflow. Trzy niezależne jobs: producer oraz SG2/SRM adoption. fail-fast:false pozwala zobaczyć wynik obu odbiorców. Wymagane kontrole powinny przejść przed merge; workflow nie ma dostępu do deploymentów, baz, credentiali lub płatnych providerów i niczego automatycznie nie wdraża.

Testy konsumentów są konkretnymi testami weryfikacji Development, uruchamianymi przez npm run test:platform-contract. Czytają aktualne rejestry i porównują jawnie przyjętą wersję/digest z jednym źródłem kontraktu. Nie zastępują pełnego produktu E2E, typechecku/builda ani istniejącego SRM CI. SG2 private-package installation nie jest potrzebna do tych testów; workflow nie pobiera sekretów Render.

Każdy konsument publikuje w GitHub Actions sanitized proof: projectKey, targetEnvironment, acceptedVersion, sourceDigest, producerSourceSha, rzeczywisty validationSha checkoutu oraz candidateHeadSha. Dla PR checkout może reprezentować syntetyczny merge; oba SHA są nazwane osobno. Artefakt nie zawiera danych aplikacyjnych, połączeń lub haseł.


## TASK02-R — proposed atomic source publication, awaiting owner acceptance

This is a source proposal, not an active exception or merge authority. The existing
separate owner PRs and their PMOS/PHR remain the source of ownership. Producer604,
SG2 607, Maps608, Identity611 and SRM613 are immutable inputs, subject to a fresh
exact-SHA read. The SRM FAST-TRACK UI follow-up and KRS CI follow-up have their own
actual owner scope. None authorizes runtime installation or activation.

The present checks require platform1.25 and every consumer receipt together;
merging either side first leaves main invalid. A source-only composite may be
assembled locally for testing from exact owner commits, without changing main.
It is not proof that the independent PR checks passed. Before publishing a single
aggregate transport PR, the owner must explicitly accept this coordinated
publication procedure and its exact input manifest. No all-owner aggregate PR is
authorized by this proposed text alone.

Proposed procedure: preserve all original owner PRs and receipts; construct one
transport commit from current main and only exact reviewed owner commits. Its
manifest lists owner, task, PR, input SHA, changed-path/blob digests, and historical
receipt. Reject unowned, extra, conflicting or manually overwritten owner paths.
Run all ordinary owner jobs and trusted-main controlled CI on the exact final
candidate. Keep complete path partitions and actual-owner governance results.
Credential-bearing package installation remains separate from candidate code.
No controller, workflow pin, author/repository fence or privileged policy changes
are included. The existing controller accepts internal srm/* candidates; the
branch prefix never grants ownership over dependency commits.

Obtain explicit SOURCE GO for the final immutable candidate only after checks
pass. Promote atomically so main never contains half the adoption; original PRs
are not individually merged in a failing order. Refresh main, provenance and
checks before promotion; a changed SHA or main invalidates the proposed GO.
Verify final main CI and record actual integration lineage. Any unresolved
mandatory check prevents promotion. INSTALLATION GO, R2 protected recovery
scope, Identity/cohort provisioning and ACTIVATION GO remain separate decisions.


## Source Hub Stage2A — owner-approved closed CI source review (2026-11-04)

The owner approved this separate four-file policy bootstrap in the same chat: “Zatwierdzam poprawkę.” Activation still requires its controlled main acceptance and all required CI. The closed review binds PR #885, branch `architecture/source-hub-newsfeed-stage2a-20261103`, reviewed source `b3afbbb7dd0575b1f855084a55be76a1a0de0c65` and all 131 exact path/blob/status/mode/owner bindings in `SOURCE_HUB_STAGE2A_REVIEW`. Main refresh may retain identical reviewed file versions; any changed, missing, added or renamed file requires a new review. Each file resolves through its own registered Architecture/SG2/SRM profile. This grants no generic application, workflow or optional-package path admission.

The existing MapsEmbed 0.1.2 recognizes the explicit SDK peer range ending in 1.33.0 alongside the preceding reviewed range. Trusted manifests must still match. An old-trusted-to-new-candidate peer transition is allowed only for the pinned Maps manifest within this exact admitted candidate. Lock peer metadata must equal the actual local manifest. Private registry artifact pins, credential scope, main-only environment, author/repository/head checks, ignore-scripts installation and credential removal before candidate execution remain mandatory.

After bootstrap main CI, dispatch the existing controlled contract workflow for the exact PR head and retry its public proof verification. Require all ordinary owner jobs, controlled SG2 tests/typecheck/build and resulting main checks. This source review authorizes no provider requests, identity grants, Neon/Render mutation, deployment or Stage2B activation.


### Existing Stage2A test and receiver metadata reconciliation

The current instruction is to finish the existing Stage2A acceptance without new functionality or intermediate product stages. Required CI found eight SG2 receiver metadata assertions and two producer tests that assumed historical Git trees were present in a shallow checkout. Under the same Architecture CI/producer tasks and SG2 adoption task, the final review binds source `f6ac8b08073c46d9bb8b4f109cb873b8c22ff893`: the same131 paths, statuses, modes and actual-owner routes.126 original blobs are immutable; only three SG2 adoption/test files and two existing producer test files receive new exact pins. SG2 keeps its original consumer edit closure; six exact dependency hashes are a separate read-only peer closure. Producer tests reconstruct only the explicitly accepted peer metadata edit and retain the frozen predecessor fingerprint, so missing Git history cannot weaken the byte check. No implementation, business/UI, permission, SQL, provider or deployment source changes. A negative test binds the full original review after restoring exactly those five prior blobs, and pins unchanged status/mode/owner maps. All existing exact-source controlled, owner and resulting-main gates remain mandatory.


### Final closed test binding

The final required SG2 historical SDK suite also accepts current SDK bytes through the already-existing SourceHub receipt layer, retaining immutable historical receipt and producer checks. The active final review binds source `4036cb1d9c4ee0f3274cf2a150b4f4e28019f9ee`, base `776071fcd2a711292dafbfd08bce5ef04aca6596`, the same131 paths/statuses/modes/routes and125 unchanged original blobs. Its complete six-file test/adoption replacement set is recorded in `Canon/evidence/2026-11-04-source-hub-stage2a-ci-admission.md`. The original full-map reconstruction negative test now restores exactly those six original blobs; status, mode and owner hashes remain unchanged. No general path admission, new scope, product implementation or credential-policy change is introduced. All exact-candidate proof, consumer CI and resulting-main gates remain mandatory.


### Preserve concurrent accepted SG2 monitoring

The mandatory current-main preflight blocked the stale base after PR889. The final active review binds source `00d56c11e4f2b4d9d1ca4a120f237f0c158dd5b1`, base `62d21fc81cec846ff58d6f5b6fdac35c777314bc`, the same131 paths/statuses/modes/routes and115 unchanged original blobs. The16 exact test/adoption replacements preserve all current main monitoring product bytes and its complete receipt before adding the SourceHub layer. They remain within the existing task edit paths, with read-only peer metadata separate. The full original-map reconstruction negative test pins every unchanged blob plus the unchanged status/mode/owner maps. Exact-candidate controlled proof, all owner checks and resulting-main CI remain mandatory; no deployment or infrastructure scope is added.


### Preserve accepted AppShell ownership

After the GitHub incident delayed policy merge, independent Git readback identified PR891 at `a3e64a93801cb197af856bf2d282a6158b01c71d`. The active review now binds source `5dd883015b5b31b78739ec603f524c0621e29809` over that main: same131 paths/statuses/modes/actual-owner routes,115 unchanged original blobs and16 exact test/adoption versions. The entire accepted AppShell/monitoring receipt and product bytes remain unchanged beneath the SourceHub compatibility layer. The unchanged D1 historical checkout test and full exact-candidate tests/typecheck/build must pass in controlled CI; local partial-clone limitations grant no exception. All original credential/proof fences and resulting-main gates remain mandatory.


## Current central E1 — proposed closed CI review (2026-11-05)

Proposed only, awaiting explicit owner acceptance. The new review is restricted to PR897, branch `architecture/source-hub-e1-current-authority-20261105`, reviewed candidate `1d1c33e557bbf134493f037a39e5ef3041dfe7b1` and its31 exact path/blob/status/mode/actual-owner bindings. It permits a main refresh only with identical reviewed file versions. No generic optional package, application or workflow admission is added. The canonical SDK1.33.0, SG2/SRM product bytes, grants and receipts remain unchanged. The separate policy proposal changes only the controller, its existing tests, this runbook and the dated evidence.

After explicit acceptance and controlled main admission of this policy, dispatch the existing trusted-main integration for the current exact PR head; require every public producer/backend/Identity/consumer gate, controlled SG2 tests/typecheck/build and resulting-main CI. Do not merge the feature, mutate E1 databases or release a runtime based on a partial proof. Credential scope, immutable package versions, main-only environment and token-removal fences remain mandatory. This proposal authorizes no provider calls, deployment or infrastructure configuration.

Owner acceptance in the same execution chat: "Zatwierdzam poprawkę CI i dalszą realizację" (2026-11-05). This accepts the finished four-file PR898 proposal and its closed PR897/31-file review; activation still requires all applicable CI and trusted-main gates. No deployment, Render change or Source policy mutation is authorized.


## ECR G1 — proposed exact CI review (2026-11-06)

Proposed only, awaiting the separate CI-policy decision. The owner has explicitly granted ECR G1 and authorized governed activation; that approval is preserved in PR906. Required integration reports CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA, and the current trusted controller rejects the new twelve-file governance candidate with ARCHITECTURE_PATH_REJECTED. The proposed closed review binds PR906, branch architecture/ecr-sourcehub-backend-20261106, reviewed candidate253bdbd0f445914e2f964d42cd2206de093cb460 and all12 exact regular-file blob/status/mode bindings in ECR_G1_GOVERNANCE_REVIEW. All resolve under ARCHITECTURE to Governance Source Layer on current main. Main refresh may preserve only those identical file versions; no generic Canon, app, workflow or optional-package pattern is added.

A separate four-file bootstrap uses the existing sg2/ transport namespace while every source path retains its actual ARCHITECTURE routing and separate PMOS identity. After explicit acceptance, require its exact trusted-main controlled proof and public CI before controlled main adoption. Then dispatch the same trusted-main workflow for PR906 exact current head, retry public proof verification, require all candidate and resulting-main gates and independently verify real ECR routing before source implementation. Main-only Environment, internal repository/author/branch/head checks, complete API pagination/race fences, immutable private pins, read:packages-only credential, ignore-scripts installation and token removal before candidate code remain mandatory. G1, review or PMOS is not a CI proof. No resource, grant, provider call or runtime deployment is authorized by this admission.


## ECR backend — proposed exact source CI review (2026-11-06)

PROPOSED / CI_POLICY_APPROVAL_PENDING. Existing accepted G1 and PR907 admit the twelve governance files only. The actual PR908 backend candidate 253e20369fcd26f1985fc14188fd3e7f927a8faa is44 exact regular files and is rejected by trusted main with ARCHITECTURE_PATH_REJECTED; the required SG2 check lacks its exact controlled proof. ECR_BACKEND_REVIEW binds that PR/branch and every source blob/status/mode plus actual ARCHITECTURE owner/surface. A normal main refresh may preserve only these identical reviewed versions. No generic runtime, optional-package, source or workflow pattern is admitted.

This separate four-file policy proposal requires explicit owner acceptance before trusted-main activation. The prior twelve-doc approval is not transferred to backend code. Then use the existing trusted-main controlled workflow for the exact policy bootstrap, accept only after all required checks, validate the exact refreshed PR908 head, independently verify its proof and all public/resulting-main gates. Existing read:packages-only credentials, private pins, main-only Environment, ignore-scripts installation and token removal before candidate execution remain unchanged. The sg2/ policy transport namespace is not ownership. No G1 repeat, administrative grant, resource, provider access or runtime deployment follows from this CI review.

## Oil report E1 — proposed coordinated source admission (2026-11-09)

PROPOSED / OWNER_CI_AND_COORDINATION_APPROVAL_PENDING. No activation is implied.
The existing Oil continuation requires four common E1 operations, SG Runtime host
integration and compatibility with SRM. Separate owner candidates are Architecture
PR925 at4809359af22b854cf393aca22b8f731711297625, SG2 PR923 at
fdc4395b11e2d67be04609c6097f6ce8ab45d345 and SRM PR927 at
3167a7d26efbb39cf6a3f149ba841113453a52db. The actual SDK producer bytes are
b696932487ef12ef43b862f677931afc5719f733. All previous receipts remain intact.

The local-only composite a3c707b1f7e95c5b69cf2751777752b8423527da over main
14f756e77e920ed94cd7ede1626558955f173e11 has tree
97aa0103e9ce652f7904c6f19c33c76c89d047c0. It has not been published as
an aggregate, adopted or deployed. OIL_REPORT_E1_REVIEW binds all93 exact source
paths, blobs, statuses, modes and actual Architecture/SG2/SRM routing results.
The one feature branch exception is existing PR923 on
feat/oil-autonomous-runner-20261109; no generic feat branch admission is added.

This separate four-file bootstrap proposes that closed review and four precise
local package catalog entries: insights-runtime, insights-contracts,
platform-current-e1-authority and platform-source-hub-contracts. Two existing
optional manifests have exact reviewed peer ranges. A new local package absent
from main still requires this complete source review and its exact manifest blob;
a boolean, unreviewed manifest or changed file grants no admission. Private
registry artifacts/scopes, main-only execution, internal author/repository/head
checks, ignore-scripts installation and token removal remain unchanged.

After explicit owner acceptance of this bootstrap and coordinated procedure,
validate and adopt the four-file policy through the existing trusted-main CI.
Refresh the local composite onto resulting main only if every93 reviewed source
entry remains identical. Preserve the original owner PRs/tasks as provenance;
use a fast-forward of existing PR923 as the coordinated transport only after that
procedure is authorized. Dispatch exact-head controlled CI, verify all ordinary
owner and peer checks, then obtain the required exact SOURCE GO after checks.
Never merge the producer first while its consumers reject the shared source.
A changed/missing/extra source entry invalidates this closed review.

This proposal and its acceptance authorize no SQL installation, role/permission
change, runtime configuration, model request, budget, deployment or scheduled
cost. Those remain their own exact installation/recovery/release gates. Neither
this source proof nor a historical PDF replay is Development LIVE acceptance.


## Concurrent main refresh — SourceHub1.5 (2026-11-09)

The owner accepted the original packet5a5968eaf46e96c3343ed2b25a693d8beb7e6f57f8daea368713f14240ac27b8
and policy sourcedbca1516bf4a104c338e35b439e1af50c245dda6. That decision remains
recorded and is not represented as activation of a different source version.

While the decision was pending, accepted SourceHub PR929 advanced main to
f77cde55bab9adb130a79754929a5ee03b3d508b and its contract package to1.5.0.
A normal main merge preserves that work. The original current-source policy test
correctly rejected the new optional peer version; it was not skipped. The bounded
refresh recognizes only1.4.0 and1.5.0 with the same exact existing peer range;
1.6.0 and broader peer ranges remain rejected. No provider family, E1 grant,
credential scope or runtime is activated.

The refreshed local composite is63f464be456c54a382f99edd6808e333513236d0, tree
c4d61019f6b12d38d81e9f6611c895901d121f0a. Inputs: PR925 397ff306b7b32ed175da59e6b417a6c96ce84fc8; PR923 8643ff2d0a90d15b74320be79dc11cbb50dfea0c; PR927 6f7d5f8b6aedcd750d22cb0b6f86d43a2c5230d1.
All93 paths, statuses, modes and owners are identical to the original review;
only five reviewed blobs change: the two Insights/SG dependency locks, the two
SG2/SRM compatibility records and the shared historical-source test. The latter
preserves the full accepted PR929 schedule closure and the immutable old receipt.
The report still uses commodity protocol1.1.0; it does not opt into schedules1.2.0.

This refresh is a reviewable amendment, not an assertion that the original exact
packet approved new hashes. Required CI must pass before controlled source
adoption, and the final feature SOURCE GO remains separate.


## Lab history compatibility correction — proposed closed94-file review

The original93-file review remains historical. The updated exact review adds only
apps/architecture-lab/test/sdk-compatibility.test.mjs under Architecture Platform /
ARCH-BASE-002. It incorporates the separate SourceHub owner repair PR930 source
c3592a012c328216844cc9747f436a258ecdb53e and validates the five immutable,
explicitly reviewed Oil successor digests without rewriting SDK1.33/1.34 receipts.
The shared lab/foundation tests pass14/14, including negative cases for changed
metadata, source and predecessor records.

The new local-only composite is91dfa48a4b97c0476cb4fd39875347a6d970c0e4, tree
943c513b8d74393504353f0d48042ae663b1e288. PR925 source is
00ddd847b9e600514b45fabb02189cf4f6d9dbec; PR923/927 remain the SourceHub1.5
compatibility inputs above. All original93 path/status/mode/owner bindings remain;
this is one additional exact test path, not general lab-path admission.

Current main has the PR929 historical-test regression. The SG2 controlled component
for the previous policy revision passed1395 tests, typecheck and build in run
42687244892, but the whole run failed. It is not accepted as a valid canonical
proof. PR930 repair and the policy refresh remain unadopted; no failing-run proof,
owner decision, PMOS entry or component result replaces the required CI gates.
The final feature SOURCE GO and every installation/release/cost boundary remain.


## Proposed one-time CI baseline repair admission — PR930 only

OWNER_ACCEPTANCE_REQUIRED; no exception is active. This proposal is limited to
PR930, branch architecture/sourcehub-sdk-history-test-20261109, head
c3592a012c328216844cc9747f436a258ecdb53e, over unchanged main
f77cde55bab9adb130a79754929a5ee03b3d508b. The sole changed file is
apps/architecture-lab/test/sdk-compatibility.test.mjs. It changes no SDK source,
product code/dependencies, old receipt, CI controller, workflow, grant or runtime.

The main producer regression prevents a successful trusted-main workflow; the
repair's public SG2 verifier requires that same workflow for the repair SHA.
The existing controller also rejects this new exact Architecture test path.
This is a baseline-repair admission decision, not a normal passing source gate.

An explicit Governance Source Layer owner decision may accept the following
closed evidence substitution solely to admit this exact repair through its PR:

- PR930 Architecture producer, dashboard and SG2/SRM contract jobs pass; SRM
  operation tests/typecheck/build also pass before any merge.
- Trusted-main run42687244892 SG2 controlled job129397239468 passed1395 tests,
  typecheck and build with sanitized receipt13704548027. The full run FAILED and
  is not relabelled or accepted by assertProof as a successful canonical proof.
- The repair, main and tested candidate969c86940a7487b11c6bf22e38ddf0250374bf34
  have byte-identical SG2/SRM/SDK package trees and locks. All control-policy
  files are identical between repair and main. The new test itself has13 local
  checks and a successful actual GitHub Architecture producer job.
- The only permitted failed PR930 job is SG2 operation integration, exclusively
  CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA. Any other failure invalidates
  this proposal. Main/head movement or a changed repair blob also invalidates it.

No admin/force merge, ruleset modification, false check/status, broader path
allowlist, Environment change, credential access or assertProof relaxation is
permitted. Native GitHub restrictions must continue to be enforced. If they block
the exact normal PR merge, stop. After repair adoption, require successful real
main and trusted-main validation; do not adopt policy PR928 or publish the Oil
aggregate until their normal exact-head CI can complete successfully.

This narrowly scoped proposal would be exhausted by the single repair. It cannot
be reused for PR928, the94-file Oil candidate, any feature/source merge, deployment,
grant, installation, paid call or later failure. All those retain their original
mandatory controls. Without explicit acceptance, the repair remains BLOCKED.

## ACG M1 — proposed closed G1 source admission (2026-11-09)

OWNER_APPROVED_BOUNDED_M1 / CI_ADMISSION_CANDIDATE_NOT_ACTIVE. The owner approved
the whole bounded M1 decision in host01a1c177-a1ff-7a52-aad1-96606021f3c5;
PHR SG2/SG2-ACG-M1-20261109/OWNER-APPROVAL.md records that actual decision.
This closed validation implements only that already approved G1 scope. Its source is PR931,
`architecture/acg-m1-g1-20261109`, source `5497a96bbc64fc02b8f7a977757dce5cd85a3037`.
Trusted-main run42698320182/job129436039202 refused it with
`ARCHITECTURE_PATH_REJECTED`; no check is waived or relabelled.

`ACG_G1_REVIEW` binds exactly two modified regular files and their blobs:
`Canon/registries/current-architecture-baseline-v1.json` =
`f9000e3b157b276d6f7d69df6a2ed27299881bf7`, and
`Canon/v1.1-repository-routing-and-module-ownership-canon.md` =
`47fc6dda78cc407969453c9d3d2865502cd98bb2`. It requires the same internal PR/branch,
trusted main, actual Architecture routing/owners, exact source/status/mode and
complete API/checkout diff. Missing/extra/changed/renamed files or executable and
symlink modes deny. A normal main refresh is permitted only while both reviewed
payloads stay byte-identical. No generic registry, workflow, app, package or
runtime path is admitted. Private names/pins, credential scope/removal,
main-only environment, assertions and all previous closed reviews remain unchanged.

Require normal exact-head three-file bootstrap CI and controlled main
acceptance before this candidate becomes active, then validate
PR931 through the resulting trusted-main controller and require every normal
PR/resulting-main gate before G1 adoption. This is source validation only: no
schema, grant, provider execution, cost or deployment follows. Evidence, owner
provenance and handoffs live only in remote PHR under
`reports/2026/11/09/ARCHITECTURE/ARCH-ACG-M1-CI-20261109/`.
The existing `sg2/` bootstrap transport namespace does not select ownership:
this task and every changed path remain ARCHITECTURE/Governance Source Layer.

## Assistant Context Gateway M1 — bounded source admission (2026-11-10)

The owner accepted the complete M1 decision in PHR (`reports/2026/11/09/SG2/SG2-ACG-M1-20261109/OWNER-APPROVAL.md`). The coordinated dependency review binds PR937, branch `architecture/acg-m1-execution-20261109`, source `1f25d37589d0c8e0e0020f014ab9788b4a04417b` over `adce82d074984743eb2f3c1cab10690fcc0aa0ff`, and exactly 63 regular-file blob/status/mode/actual-owner bindings. Architecture, SG2 and SRM retain separate profiles and tasks; receiving dependency PRs938 and939 retain their respective ownership. A main refresh may preserve only the identical reviewed versions. No generic package, application or workflow path is admitted.

The default Root remains candidate16 and the explicit assistant extension is candidate20. Root provenance now closes over the two fixed imported assistant-usage implementation/type files when the exact assistant declaration is present; an imported dependency cannot fall back to the older eight-file closure. A separately named current acceptance binds those real imported bytes while preserving the complete historical receipt unchanged. Controlled proof and public proof verification use that explicit current contract.

CIC analytical consumption is restricted to the single published `@profitia/cic-core`1.3.0 artifact, its exact registry URL and SHA512 integrity. Advisory Widget and Procurement pins, the three allowed private package names, the sole `read:packages` scope, owner/main/environment fences, clean ignore-scripts installation and removal of credentials before candidate execution are preserved. No alternative artifact or floating version is accepted.

Require exact-candidate trusted CI, ordinary producer/native/receiving checks and resulting-main checks before installation or release. This source policy itself installs no schema, adds no product grant, deploys no service and makes no model call. The already-approved controlled Development pilot remains a subsequent, independently verified execution step.

Full consumer CI additionally binds the existing Newsfeed SDK adoption, the exact SRM Root source digest and test metadata, closed SourceHub routing for these M1 consumer records, and full historical Git checkout in the existing Identity producer regression. No Newsfeed/SRM operation, grant, deployment or provider activation is introduced. Historical receipts and hashes remain immutable.

The actual owner organisation already has an operator-confirmed OPENAI_ASSISTANCE licence with a Warsaw calendar-month total-token limit. The adapter honours that existing limit and its override, separately from the hard seven-day pilot caps, without changing the commercial assignment. Native PostgreSQL tests cover previous-month settled usage, conservative unresolved reservations, malformed period/anchor/timezone, and global pilot concurrency. No new commercial licence is inferred.

The final source correction changes two historical current-HUMAN-read comparisons to the explicitly adopted current SDK digest and refreshes the paired immutable consumer continuations. All six peer/history tests pass locally. No product or SDK implementation byte, path scope, grant, SQL or runtime flag changes in this correction.

Before any product installation, isolated PostgreSQL reproduced temporary-table shadowing of the new history/admission installations (history run42737956351; admission run42738239882). New Assistant definer functions now put pg_temp last, and native tests require the real HMAC/owner and effective protected function configuration. The hardened SDK producer is `6a7863459977f5651bf30100935118e1613021fd`; complete immutable predecessor and consumer checks remain mandatory. The source inventory remains63; no product namespace, grant or provider execution was activated.

## Oil report — proposed current-main compatibility closure (2026-11-10)

PROPOSED_NOT_ACTIVE. Owner approval v5 for PR934/71a9bec5 remains valid for its
exact historical111-file candidate1eebfb93. Main subsequently accepted Assistant
M1 and its chart corrective through7ed96210. Their protected SDK and consumer
history overlap40 Oil paths; the old four blobs cannot replace current main.

The reconciled source candidatee67564d29a7391432bba9726d300b94a118a6881 on existing PR923
contains112 exact owner-routed blob/status/mode bindings. It retains every M1
runtime byte, AM45–47, hardened Assistant definer, CIC1.3.0 pin and chart change.
Oil keeps AM41–44 and its original report runner. Two existing test helpers
validate the newest Oil source before projecting complete immutable M1 history.
The combined producer is e189433899349ddda6664c37988255c13845b3e2. The control
recognises only this separately named Oil Root and the pinned112-file inventory;
the prior M1, ACG, ECR and all generic credential/proof rules remain unchanged.

This proposal needs a new exact technical scope decision and ordinary full CI.
It does not reuse the exhausted PR930 exception or certify new source using old
proof. Preserve all old receipts and fingerprints. No source installation,
SERVICE grant, deployment, budget, provider call or scheduler activation is
admitted. Final feature SOURCE GO remains separate after successful full CI.
See `Canon/evidence/2026-11-09-oil-report-ci-consumer-closure.md`.

## Oil consumer metadata regression — proposed continuation (2026-11-10)

PROPOSED_NOT_ACTIVE. PR934 accepted the112-file review without activating product
source. Actual controlled SG2 CI and SRM CI exposed stale current SDK/optional
Root expectations after the accepted M1 integration. This continuation corrects
the current-view selectors and test-source maps, while verifying the actual SDK,
producer, schema, target roles and complete immutable acceptance history. It
does not remove assertions or change runtime code, SQL, grants or access.

The proposed113-file source is `5866c06f553328e93450b1c4d98d03706b4ccc55`. Relative to the refreshed112-file
candidate f48d4cab, five existing consumer test files are corrected, one SRM
optional Root test enters the closed review, and the three existing current
metadata/helper files bind the exact bytes. All remaining source blobs stay
identical. Historical M1/Root receipts and the existing closed112 review evidence
remain unchanged. The CI delta changes only the closed review table, regression
tests and this appended note. Current Root recognition, producer, model/SQL,
private packages, M1/ACG/ECR controls and normal original-proof requirements
remain unchanged. Earlier94/111/112 inventories are explicitly rejected.

Requires an exact technical scope decision, a narrow CI PR with ordinary full
CI and independent proof, its normal main acceptance, then full feature CI.
Final feature SOURCE GO remains separate. No installation, grant, deployment,
new budget, provider/model call or recurring schedule is admitted.
