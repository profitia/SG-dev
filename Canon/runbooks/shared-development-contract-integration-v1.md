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
