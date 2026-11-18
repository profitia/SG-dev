# Platform Knowledge R6 — jednorazowy bootstrap zatwierdzonej polityki CI

**Status: PROPOZYCJA — wymagana odrębna decyzja właściciela. To nie jest zgoda ani dowód wdrożenia.**

Zadanie `ARCH-PK-STAGE2-TECHNICAL-CONT-20261117`, wyłącznie Development. Aktualne GO R6 pozostaje ważne: [niezmieniony pakiet wykonawczy](https://github.com/profitia/SG-dev/blob/02044f7d7315f960c91a535a36ea07b7e81861ac/Canon/evidence/2026-11-18-platform-knowledge-stage2-acg-composition-release-r6.md). Ten aneks nie dodaje funkcji, migracji, grantów, usług ani kosztów.

## Jedyna dodatkowa decyzja

Proponowana jest **jednorazowa zgoda na zwykłe przyjęcie PR #1194 z dwoma już zatwierdzonymi plikami CI, mimo braku przedmerge'owego kontrolowanego dowodu kandydata tej samej polityki**. Dokładny kandydat: `b7fb0a1aae1c0de1e9e8d3e495dfd2477710f663`; bazowy przyjęty main: `037c15fdc3c4edce163a3811e2e7e7e6b0b7435b`. To zwykły transport zatwierdzonego `627f4bfa43b073c3228bbf8293f7fe4b82f88af2`, zachowujący nowy przyjęty wpis dokumentacji ACG. Każdy inny śledzony plik i tryb jest identyczny z bazowym main.

| Jedyny zmieniany plik | Dokładny zatwierdzony SHA256 |
| --- | --- |
| `scripts/governance/controlled-package-ci.mjs` | `95845d9169f580f7a4316b33fb445a8d3d4a51426f6883bceb4a05ab3dcb1b36` |
| `scripts/governance/controlled-package-ci-path-coverage.test.mjs` | `4404819247280bf631dd13f7782dbdb617353e1e214902952984fc3be1b5c9f3` |

Zgoda obejmowałaby mechaniczne odświeżenie tej samej gałęzi tylko przy identycznych dwóch postimage'ach, zachowaniu całego świeżego main i braku jakichkolwiek innych własnych zmian. Nie obejmuje nowych bajtów kontrolera ani osłabienia jego warunków. Jeżeli równoległa zmiana zmieni wymagane wejścia zaufanego kontrolera, potrzebne są świeże kontrole; wcześniejszego dowodu nie wolno przepiąć na inny SHA.

## Ustalona przyczyna blokady

Rzeczywisty kontrolowany przebieg [44338910936](https://github.com/profitia/SG-dev/actions/runs/44338910936), zadanie `134923135551`, odmówił `FINDER_MONITOR_SOURCE_BYTES_REJECTED` w `check-candidate`, zanim wykonał kod kandydata lub użył danych instalacyjnych. Stary zaufany czytnik odrzuca identycznie **już przyjęty main z ACG/AA**. Osobny zaufany weryfikator przyjętej ACG/AA potwierdził 44 pliki i 27 historycznych pokwitowań. Kandydat polityki zmienia wyłącznie dwa pliki powyżej. To rozpoznany problem dopuszczenia samej aktualizacji kontrolera, a nie zgoda na pominięcie testów aplikacji.

Nowa polityka R6 uwierzytelnia pełne 478 wejść Platform Knowledge i 33 historyczne pokwitowania przed ograniczonym odczytem poprzednika KG → przyjęta ACG/AA → historyczne źródła. Nie uruchamia helpera z kandydata jako zaufanego kodu. Historyczne zamknięte przeglądy i testy odmów pozostają zachowane.

W [PR #1192 / main a039](https://github.com/profitia/SG-dev/commit/a03956b6752227a7a14e44887feabd50a0ad1054) właściciel odrębnie zatwierdził analogiczny jednorazowy wyjątek bootstrap dla Findera. **Tamta zgoda nie upoważnia do obecnego przyjęcia PK.** Właśnie dlatego ten aneks wymaga własnej decyzji zgodnie z CORE §10.1 i §10.7.

## Dowody i ich rzeczywiste granice

Kontrolowany [baseline przyjętego main a039 — 44342231863](https://github.com/profitia/SG-dev/actions/runs/44342231863) zakończył się **SUCCESS**: rzeczywista czysta instalacja przypiętych pakietów, testy, typecheck i build. Oryginalny artefakt `14444539714` ma SHA256 ZIP `25cf691079c3f4e417b580693a7f591348e59e317f7a90ab24b2ea654d1a5ee1`; sam `proof.json`: `6ab1bb7b090024d8be524531fd54ae84e8a0b23602868309d6831222f11dddfa`. Niezależny kanoniczny weryfikator z tego samego przyjętego main potwierdził schemat 2, `AUTHORITY_MAIN_VALIDATION`, dokładne SHA i digest 10 wejść `ed73b81913d2dc9332a41ac9a8f3a3a0de833af5f438fc8711a0430719356a35`, bez skrótu same-run. **Jest to dowód bazowego a039, nie dowód kandydata b7fb ani późniejszego wydania.**

Pełne prywatne testy tych samych dwóch zatwierdzonych bajtów: policy-first **686/686 PASS**, źródła+polityka **687/687 PASS**, bez skip; baza `2faf889c...`. Rzeczywiste natywne CI źródeł `65b0e573...`: SRM **1488 PASS** i integracja PostgreSQL **762 PASS**, bez skip. Te wyniki nie oznaczają pełnego CI PASS końcowego SHA.

Bieżące zwykłe kontrole polityki: [44350302241](https://github.com/profitia/SG-dev/actions/runs/44350302241), governance [44350302493](https://github.com/profitia/SG-dev/actions/runs/44350302493). Kompozycja aplikacji `bda2d6e827896d549ffc158117da9ecdea45ce64` zachowuje aktualny main, wszystkie 145 własnych plików i dwa pliki polityki; jej [kontrole 44351072516](https://github.com/profitia/SG-dev/actions/runs/44351072516) są oddzielne od przyjęcia polityki. Na dokładnym b7fb zadanie Architecture `134963785148` już zakończyło się SUCCESS: **2094/2094 kontrakty i 443/443 governance, 0 skip**; dashboard i obie adopcje również PASS. Integracja SRM `134963785118` również zakończyła się SUCCESS: **762/762 PASS, 0 skip, typecheck i build PASS**. Jedyny niezaliczony odczyt publicznego SG2 to `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA`; brakujący dowód nie jest oznaczany jako PASS. Dokładny, datowany stan zadań znajduje się w [towarzyszącym zapisie dowodowym](../proposals/platform-knowledge-stage2-r6/policy-bootstrap-evidence.json). Oczekiwany brak przedmerge'owego controlled proof pozostaje zapisany jako brak, nigdy jako PASS.

Dla dokładnej świeżej kompozycji `bda2...` zakończono też rzeczywiste testy: Architecture `134966522132` **2130 kontraktów PASS, 1 odziedziczony skip natywnego centralnego SQL; 444/444 governance PASS, 0 skip**; natywny SRM `134966523695` **1488/1488 PASS, 0 skip**, a integracja PostgreSQL `134966522794` **762/762 PASS, 0 skip**, oba typecheck/build PASS. Odziedziczony skip nie zastępuje wymaganej rzeczywistej instalacji i weryfikacji Identity/E1 na Development.

Trzy kontrole źródeł kompozycji `bda2...` (Package Limits `44351072454`, Newsfeed `44351072854`, Source Hub `44351072604`) rzeczywiście odmawiają `Exact complete current Knowledge diff required`: widzą 147 zamiast 145 plików, ponieważ dwa pliki polityki nie są jeszcze przyjęte. **Nie proponuje się wyjątku dla tych kontroli.** Po przyjęciu samej polityki i zwykłym odświeżeniu źródeł ich diff musi wrócić dokładnie do zatwierdzonych 145, a wszystkie trzy niezmienione bramki muszą rzeczywiście przejść. Pełne CI kompozycji bda2 nie ma statusu PASS.

## Warunki wykonania po ewentualnym GO

1. Przed merge potwierdzić świeży main, dokładną gałąź, podpis, dwa identyczne postimage'y i brak innych własnych zmian. Wszystkie wykonywane zwykłe testy Architecture, governance, SRM, dashboard i adopcji muszą przejść. Każdy rzeczywisty błąd testów zatrzymuje przyjęcie. Jedyny wyjątek dotyczy brakującego przedmerge'owego controlled candidate proof samej aktualizacji CI oraz zależnego od niego publicznego odczytu tego samego proof.
2. Zwykły merge wyłącznie PR #1194, bez force push, zmiany branch protection, tokenów, uprawnień workflow, testów lub strażników. Natychmiast uruchomić wymagane resulting-main CI oraz rzeczywistą kontrolowaną walidację authority-main. Niezależnie sprawdzić oryginalny artefakt dla rzeczywistego resulting-main. Do tych PASS brak dopuszczenia kodu aplikacji i aktywacji runtime.
3. Odświeżyć istniejące źródła PK z przyjętym main; ponownie potwierdzić 145/478/33 i identyczne dwa pliki CI. Uzyskać pełne wymagane CI, rzeczywisty oryginalny controlled proof dokładnego kandydata aplikacji, source admission i resulting-main CI. Nie przenosić dowodu między SHA.
4. Dopiero wtedy istniejący ścisły selektor R6 wybierze dokładne rzeczywiście zweryfikowane wydanie. Dalej obowiązują wszystkie zatwierdzone kontrole migracji, Identity/E1, 11 ograniczonych grantów, trzech istniejących usług, wdrożenia, odzyskiwania i rzeczywistego E2E. USD 10 łącznie / USD 1 na dokument; bez zmian dat i limitu 24 transakcji centralnego właściciela.

## Odzyskiwanie i stan

Jeżeli resulting-main nie przejdzie, zatrzymać dopuszczenie źródeł i aktywację, zachować prawdziwe wyniki i rozpoznać przyczynę. Gdy potrzebne przywrócenie polityki, wykonać zwykłą kontrolowaną zmianę wyłącznie dwóch własnych plików, zachowując wszystkie przyjęte cudze zmiany. Bez odtwarzania bazy, cofania cudzych wdrożeń i przepisywania historii. Po aktywacji pozostaje oryginalna procedura LKG R6.

**W chwili publikacji tego aneksu: 0 migracji trwałych, 0 zmian grantów/bindingów, 0 zmian środowiska Render, 0 deploymentów, 0 importów i 0 płatnych wywołań tego zadania. PMOS RUNNING; formalny odbiór Etapów 2/3 bez zmian.**
