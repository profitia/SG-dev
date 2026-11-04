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
