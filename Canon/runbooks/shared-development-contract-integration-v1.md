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
