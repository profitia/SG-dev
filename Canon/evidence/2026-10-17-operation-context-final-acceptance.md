# Kontekst operacji — końcowy odbiór przyrostu

Data: 17.10.2026, Europe/Warsaw. Profil ARCHITECTURE, workspace SG-dev Architecture, TARGET_ENVIRONMENT=development; wykonanie lokalne i GitHub Actions. Authority: profitia/SG-dev, main.

**ACCEPTED — przyrost obejmujący wspólny mechanizm oraz dwa rzeczywiste, izolowane przyjęcia przez SG2 i SRM.** To datowany dowód wykonania osobno zleconych czterech etapów, nie potwierdzenie zakończenia całych E0–E4, gotowości SaaS ani zgoda na uruchomienie modelu u klientów. Aktywny kanon i manifest pozostają bez zmian.

## Podstawa i granice

Właściciel zlecił: implementację wspólnego mechanizmu ARCHITECTURE, osobne przyjęcia w istniejącym kodzie SG2/SRM, testy API/persystencji/odmów/regresji i buildy oraz poprawki i odbiór z PMOS/PHR. Później wybrał kontrolowany dostęp CI do prywatnych pakietów. Nowe repozytoria/projekty nadal tworzy osobiście; nie były potrzebne. Nie zlecono deploymentu istniejących produktów, migracji ich baz, uruchomienia logowania klientów, Stripe, płatnych pobrań lub zmiany polityki raportowania Staging/Production.

Task odbioru: ARCHITECTURE-OPERATION-CONTEXT-FINAL-ACCEPTANCE-20261017; rejestracja cmvbz37bn0000vu8oyqyvtud8. Rzeczywisty hostConversationId: 01a133c2-c245-77a0-bb6b-33165e2ad80c. conversationId wyprowadzony przez PMOS: pmos-task-v2:aaee66578edbc8ab05d7f58f0275858047e7b5ed73118029025e6c2f67365922. Własna architecture_pmos z wymaganą rolą architecture_pmos_runtime; pełne bramki i require-begin PASS. Dokładna ścieżka tego raportu: Governance Source Layer / ALIGNED.

## Osiągnięty rezultat

| Etap | Potwierdzony rezultat | Granica odbioru |
| --- | --- | --- |
| Wspólny mechanizm | Jeden executor w packages/platform-contracts; implementacja 1.0.0-candidate.3, pakiet 1.1.3. | Kandydat kontraktu, bez dostawcy tożsamości klientów. |
| Przyjęcia SG2 i SRM | Istniejące handlery, usługi i rzeczywiste zapisy bazowe korzystają z tego samego executora w odrębnych testowych uruchomieniach. | Domyślne działanie aplikacji zachowane; liveRouteUsesContract:false. |
| Walidacja | Pozytywne i negatywne testy API, kontroli kontekstu, separacji, audytu i rollbacku; czyste instalacje, typecheck i buildy obu aplikacji na wspólnym main. | Syntetyczny PostgreSQL i podpisany issuer testowy; brak customer UAT lub migracji produkcyjnego RLS. |
| Poprawki i odbiór | Naprawy wspólnego rozpoznawania odmów ESM/CJS, praw blokowania rekordów audytu i authority CI; osobne historie producenta/odbiorców/CI oraz ten raport. | Końcowa publikacja PMOS/PHR tego tasku jest odrębnym, weryfikowanym dowodem; plik nie poświadcza własnego closeout. |

Kontrakt: profitia.operation-context 1.0.0. Digest wspólnego źródła i deklaracji: e37a11798ed41b1c0a30f2ac3b539c6d19db59246c8ceae94005afeb10a08455. SG2 i SRM jawnie przypinają ten sam kontrakt i digest w operation-integration.json; zmiana producenta sama nie zmienia przyjęcia aplikacji. Dotychczasowy kontrakt Development pozostaje odrębny i niezmieniony.

Executor rozdziela zweryfikowaną tożsamość, organizację, aplikację, funkcjonalność, operację, uprawnienie oraz dostęp produktu. Sprawdza bieżące źródła i wersje polityk, członkostwa i zasobu; rola administracyjna nie zastępuje konkretnego prawa. Wspólna wiedza rynkowa i raport źródłowy mogą być odczytywane wspólnie, natomiast przypisania i projekcje mają własny zakres organizacji lub użytkownika. Wspólny kod nie otrzymuje na stałe ID klienta.

Zaimplementowano 9 z 30 operacji macierzy: account.settings.read/write, knowledge.read, benchmark.selection.read/write, personal.list.read/write, supplier.report.read/project. Pozostałe 21 kończy się odmową; nie otrzymują pozornej implementacji. SG2 przyjmuje konkretnie odczyt/zapis wyboru benchmarku. SRM przyjmuje odczyt raportu i jego projekcję, która wykonuje istniejący zapis, więc nie jest traktowana jako czysty odczyt. Pozostałe operacje executora są testowane w laboratorium; nie oznacza to ich wdrożenia w aplikacjach.

## Dokładne źródło i dowody CI

| Dowód | Źródło / wynik |
| --- | --- |
| Producent po poprawkach | [PR383](https://github.com/profitia/SG-dev/pull/383), main ea06cd05df9168c01b7621baf6724bc04b74b760; historia PR380–382 zachowana. |
| Przyjęcie SRM | [PR385](https://github.com/profitia/SG-dev/pull/385), source 872ca2996fe16ebcb54f94ca5f9f55cf54c9e887, merge ee9c5ccce878f4292f1dfb22088949edc4d1a4b3. |
| Przyjęcie SG2 | [PR384](https://github.com/profitia/SG-dev/pull/384), source d5b1b785533a95db56c3b4836419093fab72f3ae, merge 2f1fb406bbdab02f90b83a465a95a3d661c8a7cb. |
| Czysta walidacja kandydata SG2 | [39006902928](https://github.com/profitia/SG-dev/actions/runs/39006902928), control 16716f1b0ca150f3f653f013fbb9cb1182d1802c, dokładny source PR384; 14 testów, typecheck/build PASS. |
| Publiczna weryfikacja SG2 | [39006884979](https://github.com/profitia/SG-dev/actions/runs/39006884979), attempt2 SUCCESS; odczytuje dowód, nie instaluje pakietów. |
| Wspólny main obu aplikacji | [39007089392](https://github.com/profitia/SG-dev/actions/runs/39007089392), dokładny 2f1fb406bbdab02f90b83a465a95a3d661c8a7cb: wszystkie wymagane joby SUCCESS; governance [39007089451](https://github.com/profitia/SG-dev/actions/runs/39007089451) SUCCESS. |
| Publikacja dowodów CI | [PR392](https://github.com/profitia/SG-dev/pull/392), source b41cb135712271ead889b7064c3c69a94098e5ec, merge f56f7d9d59d42304a121b3311d7a31cf08838f60; wyłącznie dokumentacja. |

Wspólny main faktycznie wykonał czystą instalację SG2, 14 testów API/persystencji, typecheck i pełny build, a następnie zweryfikował własny dowód ukończonego chronionego joba. SRM w tym samym run wykonało własną czystą instalację, 14 testów integracji, typecheck i build. Niezależnie pobrane proof.json SG2 i operation-context-proof.json SRM wskazują dokładny wspólny main i identyczny kontrakt; productDeploymentPerformed:false, customerIdentityAdapterVerified:false. Nie zastąpiono tych dowodów zielonym jobem, który pominął wykonanie aplikacji.

Producent/laboratorium: 74 testy PASS, 0 skip; dwa dotychczasowe testy przyjęcia w każdej aplikacji dają łącznie 78, bez utożsamiania liczby testów z liczbą wymagań biznesowych. Workflow ma osobny zestaw 33 testów governance/workspace/kontrolera. Lokalny zestaw z bridge zawiera 35 testów PASS, 0 skip. SG2 ma dodatkowo 44 wcześniejsze dobrane regresje PASS, 0 skip; kod biznesowy apps/sg-runtime w końcowym kandydacie jest identyczny z przetestowanym pierwotnym źródłem bcf4dbcb. Starsza lokalna instalacja korzystała z ujawnionej niezależnej kopii zależności, a nowy sukces czystego CI jest osobnym dowodem. SRM ma również wcześniejszy standardowy CI38978246151: 464 testy aplikacji, 311 promotion i165 governance, wszystkie PASS, 0 skip.

Źródło wykonawcze pakietów, aplikacji, workflow i mechanizmów governance po dokumentacyjnym PR392 jest identyczne z przetestowanym wspólnym main2f1fb406. Ten raport również zmienia tylko dokumentację. Z tego powodu nie przypisuje się późniejszym dokumentacyjnym SHA nowego wykonania testów; dowód wykonania pozostaje przypięty do rzeczywistego SHA.

## Co rzeczywiście sprawdzono

Testy obejmują dwie organizacje, dwóch użytkowników jednej organizacji i konto należące do dwóch organizacji; współdzieloną wiedzę i prywatne przypisania; podrobiony, wygasły i niewłaściwy kontekst; odebrane członkostwo, uprawnienie i produkt; klasę/właściciela zasobu i operację przypisaną przez serwer. Testowa baza korzysta z rzeczywistych zwykłych ról, braku SUPERUSER/BYPASSRLS, ograniczonego prawa zapisu i rzeczywistych odmów SQL/FK. Brak kontekstu nie ujawnia prywatnych wierszy, a kontekst nie pozostaje w puli.

Audyt INTENT musi zostać trwale zapisany przed efektem. Niedostępny audyt blokuje działanie, a awaria OUTCOME wycofuje rzeczywiste zapisy biznesowe w jednej transakcji; niezależne INTENT/FAILURE pozostają skorelowane. Odczyt trwałych rekordów potwierdził czas UTC, dowód tożsamości, źródło/wersję prawa i produktu oraz klasę/właściciela/wersję zasobu. Branded odmowa rozpoznaje poprawnie ESM/CJS i odrzuca podszywającą się strukturę JSON. Nie uznano błędu503 za poprawną odmowę403.

To dowody izolowanego przyrostu, nie dowód wdrożenia RLS lub bezpiecznego modelu tożsamości w istniejących bazach klientów. Znane wcześniejsze luki rzeczywistego auth, owner role i powiązań baz nie zostały tutaj zamknięte.

## Kontrolowany CI i granice poświadczenia

Repozytorium SG-dev pozostaje PUBLIC. Nie wykonano Manage Actions access grant dla prywatnych pakietów. Zaufany kontroler main i istniejące architecture-development/24168168252 dopuszczają tylko main/typebranch, właściwy workflow i konto wykonujące oraz dokładny wewnętrzny kandydat SG2. Credential jest wyłącznie Environment secret. Instalacja z ignore-scripts jest oddzielona od kodu aplikacji; prywatne paczki, node_modules i cache nie są publikowane.

Rzeczywisty policy-probe39005608185 został odrzucony przez GitHub przed pierwszym krokiem niedozwolonej gałęzi; main39005609857 został dopuszczony. Brak tokenu39005611227 przerwał przed instalacją. Pozytywne runy potwierdzają minimalny zakres i ważność tokenu oraz pełne testy bez jego obecności. Publiczny brak dowodu dokładnego SHA zakończył się odmową, potem przeszedł dopiero po rzeczywistej walidacji. Stary pull_request.base.sha naprawiono przez [PR391](https://github.com/profitia/SG-dev/pull/391), zachowując aktualny digest i niezależny odczyt źródła kontrolera.

Token classic read:packages ma rzeczywisty zakres pakietów dostępnych kontu; ograniczenie trzech nazw/pinów pochodzi z kontrolera, nie z samego credentiala. Model nie izoluje złośliwego administratora ani świadomie zatwierdzonego złośliwego kodu main. Nie wykonano rzeczywistego testu nowego forka; testy negatywne kontekstu i rzeczywista odmowa gałęzi są odrębnymi dowodami. Właściciel potwierdził wymianę i odwołanie omyłkowo zapisanego jako zmienna tokenu; agent nie odczytywał jego wartości ani statusu odwołania. Wygaśnięcie nowego tokenu ma blokować CI do osobistego odnowienia. Szczegóły: [runbook](../runbooks/controlled-package-ci-v1.md) i [chronologia CI](2026-10-17-controlled-package-ci-verification.md).

## PMOS i PHR — odrębne historie

Poniższe zamknięcia niezależnie ponownie zweryfikowano: registration completed, CLOSEOUT_COMPLETE, archive PASS, trail PRESENT, save/context/handoff SUCCEEDED, właściwe publikacje, commit obecny w zdalnym authority, brak pending i blokad.

| Profil / taskId | PHR commit | MEMOROS |
| --- | --- | --- |
| ARCHITECTURE / ARCHITECTURE-OPERATION-CONTEXT-ENGINE-20261016 | 24812ecbc4f779db486fdf917aafc829455c6eb7 | disabled zgodnie z profilem |
| SRM / SRM-OPERATION-CONTEXT-INTEGRATION-20261017 | 1a3264ecdf54678d0ca982b05a6db5cd749a4f97 | disabled zgodnie z profilem |
| SG2 / SG2-OPERATION-CONTEXT-ACCEPTANCE-20261017 | 104cf14a6991c92e5c7473cad999f05d09666b84 | DELIVERED |
| ARCHITECTURE / ARCHITECTURE-CONTROLLED-PACKAGE-CI-20261017 | bf4e6f6d4eeb1d93173237d4a317697deefe1868 | disabled zgodnie z profilem |

Wpisy PARTIAL_SUCCESS pierwotnego SG2 i wcześniejszego odbioru ARCHITECTURE pozostają niezmienione. [Historyczny odbiór i sprostowanie](2026-10-17-operation-context-integration-acceptance.md) nie są przepisywane jako sukces wsteczny. Zapisano wyłącznie referencje projectKey/taskId/repozytorium/PR/source SHA, bez kopiowania obcych rekordów lub relacyjnych ID między bazami. SG2/SRM PMOS nie deklarują takiej samej kontroli ograniczonej roli jak ARCHITECTURE; ograniczone role baz testowych nie są dowodem ograniczonej roli ich PMOS.

Końcowy task ARCHITECTURE tego raportu ma własny closeout po przyjęciu dokumentu, przez tego samego kanonicznego writera i własny PHR. Jego wynik oraz dokładny commit publikacji są potwierdzane niezależnie, poza samopoświadczającą treścią dokumentu.

## Zachowanie działających produktów

| Środowisko | Usługa Render | Zachowane wdrożenie / SHA |
| --- | --- | --- |
| SG2 Development | srv-dapa3tid0e5s73f8bc5g | dep-daqd0uh42hec7398f5vg / c55c551091b3584673726bd0a78254eb091c7197 |
| SG2 Staging | srv-daclno3m8hqs73bb7rrg | dep-db0dhbm1egvs73f70kr0 / 48dfcd8af93fa9f5e9708653a868b89c138b6b91 |
| SRM Development | srv-db1vu6gm7kps73d0e3r0 | dep-db97cj6k1f9s738na1r0 / 6eede5cd19fd3a4519d66298effe9ef94633757a |
| SRM Staging | srv-db496b3tqb8s73eh5sfg | dep-db97qcjl550s73d2f170 / 6eede5cd19fd3a4519d66298effe9ef94633757a |

Wszystkie cztery mają autoDeploy=off, wdrożenia LIVE i poprawny, zweryfikowany TLS health z właściwym środowiskiem. Nie wykonano deploymentu, migracji schematu/danych, zmiany powiązań baz lub domen. Istniejące checkouty developmentu biznesowego zachowano. Health i niezmienność wdrożenia nie zastępują pełnego biznesowego UAT. Nie było operacji wydania produktu wymagającej stworzenia fikcyjnego LKG lub rollbacku bazy.

## Odstępstwa, ustalenia poza zakresem i dalsze zadania

Bezpieczne korekty wykonania obejmowały ESM/CJS tożsamość odmowy, techniczne prawa blokowania PostgreSQL bez prawa zmiany polityki, istniejący zamiast nowego workflow/Environment, kontrolowany zamiast bezpośredniego publicznego grantu pakietów i naprawę historycznego authority PR. Wcześniejszy błąd sekwencji fail-closed przy PR386 oraz późniejsze sprostowanie bezpieczeństwa są jawnie zachowane w [historycznej chronologii](2026-10-17-operation-context-integration-acceptance.md); późniejszy PASS nie legalizuje wcześniejszego naruszenia. W kontynuacji polecenie usunięcia już nieistniejącej zmiennej przed odnowionym preflight zwróciło404 i nie zmieniło konfiguracji; fakt zachowano w historii CI. Cudzej pracy nie resetowano.

Dalsze zadania do osobnego zatwierdzenia, bez domniemanej zgody na implementację:

1. Rzeczywisty dostawca tożsamości, konta, organizacje, członkostwa i panel administratora; autorytatywne uprawnienia i dostęp produktu. Ustalenie migracji konta PORR bez utraty obecnych funkcji.
2. Klasyfikacja i rzeczywiste granice danych we wszystkich repozytoriach, rolach i bazach produktu, w tym współdzielona wiedza kontra prywatne przypisania; testy oraz odwracalne migracje RLS i audytu. Laboratorium nie zastępuje tej pracy.
3. Osobne przyjęcia pozostałych operacji przez SG2/SRM i kolejne komponenty; domknięcie 21 niewdrożonych reguł, delegacji/jobs, cache, eksportów i limitów zgodnie z macierzą.
4. Odrębne przygotowanie wydania i kontrolowanej aktywacji w produktach: zweryfikowane zasoby, zachowany artefakt LKG, zgodność konfiguracji i migracji, wykonywalny rollback oraz biznesowy UAT.
5. Scenariusze produktowe PORR/AppShell, samodzielny Supplier Intelligence i pełny SpendGuru SaaS: własny onboarding zakresu i zasobów, katalog produktów i ewentualny Stripe, bez pożyczania profilu innego produktu.

Rezultat dla Profitii: jeden sprawdzony mechanizm wspólny, dwa rzeczywiste przyjęcia istniejącego kodu oraz odtwarzalny, audytowalny sposób walidacji; bez przebudowy działających środowisk. Nie stanowi to gwarancji bezpieczeństwa całej obecnej platformy ani zamknięcia rozpoznanych luk produkcyjnych.
