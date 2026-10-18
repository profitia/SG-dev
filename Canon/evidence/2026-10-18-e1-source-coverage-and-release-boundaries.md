# E0/E1 — uzgodnienie pokrycia źródeł i granic wydania, 18.10.2026

Status: DATED SOURCE SNAPSHOT / PROGRAMME IN_PROGRESS. Zadanie `ARCHITECTURE-E1-COVERAGE-RECONCILIATION-20261018`, profil ARCHITECTURE, workspace SG-dev Architecture, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority profitia/SG-dev/main, badany source `ff49783ce72c547158c54aaf7c0f86191fc0e61d`. Własny PMOS/PHR, MEMOROS wyłączony profilem; rejestracja nie jest closeout. To audyt do przyjętego E0/E1, nie nowa polityka, zgoda na E2–E4 ani odbiór wydania.

## Wynik

Wspólny mechanizm oraz ograniczone integracje mają rzeczywiste dowody źródłowe. Pełne przełączenie aplikacji na indywidualne logowanie nadal wymaga zachowania pozostałych działających przepływów. Samo zamknięcie starego wejścia zapewnia odmowę; nie zapewnia jego funkcji biznesowej w nowym trybie.

[Maszynowy snapshot](../registries/e0-e1-source-coverage-2026-10-18.json) obejmuje84 pliki route.ts i90 metod HTTP:60 Runtime,15 dashboard i15 SRM. Dawny baseline obejmował81/87. Trzy nowe pliki to prywatne zlecenie Forecast i wspólne podsumowanie finansowe w dwóch gospodarzach. Historyczne pola baseline i mapy efektów zachowano; dopisano jedynie odnośnik do tej obserwacji. Snapshot zawiera hasze każdego wejścia,51 referencji rodzin efektów i16 jawnych granic poza trasami. Głębokość: kompletny census oraz wybrane rzeczywiste łańcuchy fabryk, UI i workera; nie przegląd każdej linii i każdego zewnętrznego endpointu.

| Gałąź źródłowa przy jawnym trybie Clerk | Metody | Znaczenie |
| --- | ---: | --- |
| Przyjęta gałąź natywna |24 |16 Runtime,5 dashboard,3 SRM; testy w izolacji, wymagane flagi i dokładny kontekst; bez odbioru żywego wdrożenia |
| Odrębna polityka publiczna lub logowania |7 |Nie nadaje praw produktu; publiczny OpenAPI nadal zależy od niepodłączonego singletonu |
| Niepodłączony wcześniej Cognition |23 |Brak produkcyjnego miejsca wywołania setCognitionService w badanych źródłach aplikacji; nie zleca się przy okazji tworzenia nowych funkcji |
| Stare alternatywy techniczne Forecast |11 |Zamknięte; trzeba uzgodnić odbiorców z nowym przepływem, nie ponownie otwierać starego tokenu |
| Pozostałe gałęzie dashboardu |10 |Wymagają rozróżnienia odbiorców, prywatnych DR i diagnostyki; odmowa nie jest adopcją |
| Działające przepływy wymagające parytetu |15 |6 metod Finder oraz9 SRM; blokują pełne przełączenie przed właściwym przyjęciem |

Liczby nie są procentem ukończenia. Natywny /api/series dashboardu dotyczy wyłącznie dopuszczonej gałęzi wspólnej serii; /api/records nie został przez tę zmianę przyjęty. Wspólny kod i metadane wiadomości nie stają się uprawnieniem użytkownika.

## Potwierdzone przyjęcie i granice dowodów

PR483 połączył osobne zadania producenta ARCHITECTURE i odbiorców SG2/SRM. GitHub potwierdził PR481/482 jako MERGED przez ten sam merge `ff49783`; nie wykonano osobnych niezweryfikowanych merge. Kontrolowane CI39145215282 sprawdziło dokładny kandydat `f10a2412530d31ceef1200d58d7a067df838af91`; oficjalny walidator PASS. Publiczne CI39145183340 po uzupełnieniu wymaganego dowodu oraz osobne SRM39145183426 przeszły. Dla main: platform39145645366, governance39145645356 i SRM39145645377; trzy odrębne artefakty SG2, dashboardu i SRM zostały niezależnie zweryfikowane. Poświadczenie instalacji usunięto przed wykonaniem kodu kandydata; polityka kontrolera pozostała bez zmian.

Wykonane zestawy obejmują576 testów Runtime/API/SQL z prawdziwym Prisma i zwykłymi rolami,332 dashboardu,69 natywnych SRM,490 produktu/migracji SRM,311 procesu promocji oraz616 kontraktu/laboratorium. Podzbiory61 regresji biznesowych i38 kolejki pokrywają się z innymi zestawami; liczb nie sumuje się. Pełne buildy i typy dwóch technologicznych gospodarzy przeszły. Testy odpowiedzi IdP pozostają syntetyczne; nie zastępują rzeczywistego OTP/TLS, named-user UAT ani wydania.

Przyjęta logika obejmuje aktualne konta/członkostwa/granty/produkt w objętych operacjach, prywatne wybory i kategorie, projekcję/Excel raportu, współdzielone podsumowanie, ograniczone odczyty rynku i prognoz, jawne zlecenie/delegację oraz istniejący worker. Rozdzielono tożsamość zewnętrzną od wewnętrznych ID, prywatne zlecenie od wspólnej nauki i przyjęcie202 od rzeczywistego READY. Ograniczony SQL i FORCE RLS badano dla określonych zwykłych ról. Nie jest to gwarancja dla każdej bazy, dowolnego SQL, administratora bazy lub przejętego backendu.

## Pozostałe konkretne granice

Finder nadal wywołuje stare search GET/POST, metadata, metadata values, context i ai-search. W trybie Clerk ich stary resolver odmawia. Odczyt wspólnej wiedzy nie daje automatycznie prawa do zapisu źródła, zewnętrznego AI ani nielimitowanych wywołań dostawcy.

Rzeczywisty kontroler raportu SRM wywołuje search, report-data i KYS/JDG, a widok również web-identity. Natywnie przyjęto report-data, financial-excel i financial-summary; pozostałe9 metod lookup/search/JDG/KYS/PESEL/KRS/PDF/web pozostaje po stronie legacy. Dane osób i prywatne dokumenty nie są uniwersalną wiedzą korporacyjną. Osobny upstream KYS wymaga własnej authority i dowodów; kontrola proxy SG-dev ich nie zastępuje. Nie wykonywano nowej próby odczytu cudzych danych z upstream.

Natywny Current/Verification i delegacja używają ograniczonych ról oraz starej nauki; dispatch już wymaga natywnego workera. Inne CLI hydratacji, promocji i utrzymania nie uzyskują przez to zbiorczego odbioru. Zachowana proweniencja szeregów o częstotliwości innej niż dzienna nadal wymaga dowodu. Jednostka SOURCE_TRANSACTION opisuje efekt SQL, nie rachunek CPU lub płatnego dostawcy.

Zatwierdzona nazwa organizacji startowej nie dowodzi weryfikacji rzeczywistego konta IdP, członkostwa ani prawa przypisania historii demo/PORR tej osobie lub innej organizacji. Początkowe dane i skończone granty wymagają kontrolowanego bootstrap. Retencja, zakres pól osobowych, limity i uprawnienia dostawców muszą mieć właściwą jawną politykę; nie wynikają z brakującego limitu lub nazwy OWNER. Konto, organizacja, aplikacja i moduł pozostają odrębnymi odpowiedzialnościami.

## Wdrożenia, bazy i odbiór

Odczyty metadanych Render z18.10 potwierdzają dotychczasowe artefakty. Runtime SG2 Development: `c55c551`, dashboard Development: `dbd3e47`, workery: `993f539`; SRM Development/Staging: `6eede5c`; SG2 Staging: `48dfcd8`, dashboard Staging: `518f1ad`. Pełne SHA i deployment ID są w snapshot. Status live nie oznacza biznesowego UAT ani odtworzenia starego artefaktu. Obserwacja zależności Staging w tym audycie źródeł nie jest zadaniem wdrożeniowym Staging i nie tworzy jego historii PMOS/PHR.

Neon potwierdził istniejące gałęzie SRM w `snowy-breeze-40315151` oraz dwie gałęzie nowego prywatnego projektu `spring-bread-28217539`; nie zaobserwowano tam gałęzi Staging. Metadane ready nie są SQL readback roli, schematu, kont lub flag. Nie odświeżano tych dowodów przez zapytania do prywatnych rekordów i nie przypisuje się starszym odczytom daty tego audytu. Wygasłego rehearsal nie użyto ponownie; nazwa starej gałęzi zawierająca LKG nie stanowi potwierdzenia wykonalnego odzyskania.

| Odbiór | Stan tego audytu |
| --- | --- |
| Ograniczony przyrost źródłowy PR483 |Przyjęty z dokładnym CI |
| Wszystkie18 rodzin regresji w pełnym produkcie |Dowody częściowe; limity opisane osobno w snapshot |
| Rzeczywisty bootstrap i logowanie |Brak nowego dowodu wykonania |
| Zachowany artefakt i zgodne dane/konfiguracja jako LKG |Wymagane w kontrakcie konkretnego wydania |
| Wydanie E1 Development |Nie wykonano |
| Wydanie E1 Staging i owner review |Nie wykonano |
| Pełne E0/E1 |IN_PROGRESS |

Audyt nie zmienia kodu aplikacji, danych, schematów, ról, grantów, sekretów, flag, zasobów ani wdrożeń. Po jego faktycznym closeout prace są kontynuowane jako odrębne zadania właściwych profili w już zaakceptowanym E0/E1. Nie wprowadza E2–E4, Production ani nowego terminu programu.
