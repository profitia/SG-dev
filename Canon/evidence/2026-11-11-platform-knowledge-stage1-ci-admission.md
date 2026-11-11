# Platform Knowledge — gotowy wniosek o zamknięte dopuszczenie CI etapu 1

Data: 2026-11-11, Europe/Warsaw. Profil: ARCHITECTURE / Development. Status: DRAFT / CONTROLLER_OWNER_DECISION_PENDING. To propozycja poprawki koniecznej do kontynuacji zleconego etapu pierwszego, bez aktywacji przed wymaganą decyzją.

## Konkretny problem

[PR999](https://github.com/profitia/SG-dev/pull/999), HEAD `174cb59fd9770f1ced8d4b1108f6090934937a4f`, zawiera siedem plików G1 i przygotowania Platform Knowledge. Publiczny job SG2 operation integration, run `43008734584`, job `130482670923`, zakończył się `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA`. Zaufany main nie posiada zamkniętej klasy tego nowego przeglądu governance. Zielone testy routingu i pozostałych źródeł nie zastępują wymaganej walidacji SG2.

Obowiązujący [kontrakt kontrolowanego CI](../runbooks/controlled-package-ci-v1.md) rozdziela przyjęcie produktu i zmianę samej polityki. Nowa zamknięta klasa jest osobnym bootstrapem ARCHITECTURE, z testami i decyzją właściciela kontrolera przed aktywacją. Nie obchodzimy bramki merge, nie wyłączamy testu i nie udostępniamy poświadczenia kandydatowi.

## Proponowana poprawka

Stała `PLATFORM_KNOWLEDGE_G1_REVIEW` dopuszcza tylko PR999, dokładną gałąź i HEAD oraz wszystkie siedem blobów i statusów z tego kandydata. Checkout dodatkowo wymaga regularnego trybu 100644, zgodności rzeczywistego diff/tree/blob i braku symlinków. Weryfikacja wykorzystuje istniejący routing Governance Source Layer / ALIGNED / ARCHITECTURE.

Bootstrap zmienia wyłącznie kontroler, dedykowany test polityki, niniejszy dowód i odpowiedni dodatek runbooka. Nie zmienia workflow, Environment/main-only, sekretów, prywatnych nazw lub pinów pakietów, aplikacji, E1, zasobów, migracji ani deploymentu. Nie wprowadza ogólnego dopuszczenia `Canon/**`, narzędzi lub nowych pakietów PK.

Po wymaganej akceptacji i istniejących bramkach: walidacja exact SHA bootstrapu dotychczasowym main, kontrolowany merge polityki, odczyt authority, walidacja PR999 nowym kontrolerem, świeży proof i ponowienie publicznego weryfikatora. Dopiero pełne wymagane kontrole umożliwiają przyjęcie G1. Zmiana źródła PR999 wymaga nowego przeglądu pinów; nie jest automatycznie dozwolona.

Rollback: przeglądany revert wyłącznie tej klasy z zachowaniem dotychczasowych ograniczeń i historii. Nie dotyka produktu ani danych. Do czasu decyzji można kontynuować niezależne czynności przygotowania zasobów; nowe powierzchnie produktu nadal nie są aktywne na main.

## Wykonana walidacja projektu

`node --test scripts/governance/platform-knowledge-ci-admission.test.mjs scripts/governance/controlled-package-ci.test.mjs scripts/governance/controlled-package-ci-path-coverage.test.mjs`: 201 testów PASS. Nowe przypadki obejmują dokładny dopuszczony zestaw, zmieniony/brakujący/dodatkowy/zdublowany plik, zmianę statusu lub rename, inny PR/branch/author/fork/HEAD, niezaufany kontekst oraz rzeczywiste sprawdzenie diff/tree/blob i odmowę podmienionych bajtów lub symlinka. Prywatne nazwy pakietów i lista lokalnych zależności nie są rozszerzone.

Preflight ARCHITECTURE/Development z własnym `pmos:begin` i potwierdzeniem rejestracji PASS; `git diff --check` PASS. Nie deklaruje się aktywnego dopuszczenia lub skutecznego kontrolowanego run przed jego rzeczywistym wykonaniem i readbackiem.
