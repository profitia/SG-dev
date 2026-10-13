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
