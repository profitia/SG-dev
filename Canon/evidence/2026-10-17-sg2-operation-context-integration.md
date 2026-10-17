# SG2 — izolowane przyjęcie kontekstu operacji

17.10.2026. Task SG2-OPERATION-CONTEXT-INTEGRATION-20261017, profil SG2, workspace SG-dev, wykonanie lokalne, TARGET_ENVIRONMENT=development. Podstawa: odrębne zlecenie czterech etapów Full Autopilot. Producent: ARCHITECTURE-OPERATION-CONTEXT-ENGINE-20261016, PR380/main dde7d08262c693df7c86e0a8f16c6bcb95512f92; rzeczywiste poprawki zgodności: PR383/mainea06cd05df9168c01b7621baf6724bc04b74b760.

## Rzeczywiste przyjęcie

`operation-integration.json` jawnie przyjmuje profitia.operation-context1.0.0, implementację1.0.0-candidate.3, pakiet1.1.3 i digest implementacji/deklaracji `e37a11798ed41b1c0a30f2ac3b539c6d19db59246c8ceae94005afeb10a08455`. Instalowana kopia i repozytoryjne źródło muszą mieć ten sam digest. Stary Development-context pozostaje odrębny i niezmieniony.

Nowy host-adapter createOperationBenchmarkSelectionHandlers korzysta z tego executora i tych samych handlerów, usługi selectBenchmark/getSavedBenchmarks oraz repozytorium Prisma, które obsługują dotychczasowe API. Nie zastąpiono biznesowego zapisu makietą. Opcjonalna przekazana transakcja obejmuje zarówno istniejący zapis, jak i OUTCOME audytu. Odczyt korzysta z roli mającej wyłącznie SELECT do tabel biznesowych. Operacja jest przypisana przez serwer do handlera; podmiana metody żądania nie zmienia read w write.

Domyślna trasa Next nadal używa istniejącego withCognitionAuth. Nowy adapter nie jest automatycznie aktywowany przez flagę środowiskową ani merge. Zachowano kształt odpowiedzi, walidację kandydatów, metadane, przypisanie organizacyjne i zwykłe zachowanie demo. Fabryka nowego hosta nie przyjmuje roli z nagłówka ani gotowego ALLOW. Tożsamość syntetyczna w testach ma rzeczywisty podpis, kontrolę odbiorcy, środowiska i ważności; nie jest dostawcą logowania klientów.

## Wykonane lokalne dowody

- 14 testów przyjęcia i integracji: PASS, 0 skip. Wykonują HTTP Request/Response na rzeczywistym handlerze i istniejący zapis/odczyt Prisma w PostgreSQL16. To nie jest test przeglądarkowy ani dowód uruchomienia nowego adaptera w serwisie Render.
- Dwie organizacje, dwie osoby w jednej organizacji i jedno konto w dwóch organizacjach. Wspólny identyfikator serii daje odrębne przypisania. Organizacyjny zasób utworzony przez A jest dostępny uprawnionemu B; etykieta admin bez prawa zapisu nie pozwala na zapis.
- Potwierdzone odmowy: podrobione nagłówki, podpis dla innej aplikacji/środowiska lub wygasły, brak członkostwa, cofnięte członkostwo, brak produktu, obcy właściciel zasobu, niewłaściwy handler/metoda. Niedozwolone operacje nie wywołują dostawcy i nie zapisują danych.
- Rzeczywiste role sg2_operation_runtime i sg2_operation_reader bez SUPERUSER/BYPASSRLS. Brak kontekstu daje 0 prywatnych wierszy. RLS i kontrola relacji odrzucają FK do benchmarku innej organizacji. Rola odczytu nie może aktualizować tabel biznesowych. Kontekst nie pozostaje w puli po transakcji.
- Odebranie INSERT do audytu blokuje działanie przed pobraniem metadanych. Awaria OUTCOME po prawdziwym zapisie Prisma wycofuje biznesowe wiersze; pozostają skorelowane INTENT/FAILURE. Powtórzenie dozwolonego przypisania pozostaje idempotentne. Runtime nie może przepisywać audytu lub JSON uprawnień.
- 44 istniejące testy benchmarków, persystencji, routingu i demo: PASS, 0 skip. Typecheck i pełny build aplikacji: PASS. Końcowe kontrole CI przypięte do publikowanego SHA są odrębnymi dowodami w PMOS/PHR i odbiorze programu.

## Odtwarzalność i granice

Test wymaga jawnego SG2_OPERATION_TEST_OWNER_URL do nowej bazy sg2_operation_test na loopback. Sprawdza cel przed połączeniem; poza tym celem nie uruchamia inicjalizacji. Używa obecnego schematu Prisma oraz testowego pliku operation-schema.sql. Ten plik nie jest migracją produktu i nie zmienia żadnej bazy Neon. Dostawca metadanych jest atrapą sieciową z zamkniętą listą odpowiedzi; nie wykonano płatnych pobrań. Baza i issuer zawierają wyłącznie dane syntetyczne.

Lokalna czysta instalacja prywatnych pakietów nie była możliwa: brak jednej paczki w cache i403 dla istniejącego poświadczenia GitHub CLI bez read:packages. Do lokalnej walidacji użyto niezależnej kopii istniejącego zestawu zależności SG2; nie współdzielono node_modules i nie odczytano tokenu Render. Wersje potwierdzono npm ls, a trzy prywatne paczki mają utrwalone hashe plików w dowodach zadania. To nie jest deklaracja sukcesu czystej instalacji. Początkowy CI ze standardową tożsamością Actions z packages:read zakończył się403read_package. Poniższa kontynuacja opisuje odrębny, wybrany przez właściciela kontrolowany tor; nie nadano publicznemu repozytorium bezpośredniego dostępu Actions do prywatnych pakietów.

Własne wygenerowane przez build pliki klienta zachowano w lokalnym recovery i przywrócono wyłącznie własne różnice. Inne checkouty/prace SG2 i SRM są zachowane. Dokładne12ścieżek przeszło routing ALIGNED, rejestrację PMOS cmvbizvvi0000vlr4nbm6ednl i require-begin. conversationId pmos-task-v2:f53724434cb975f51741a567ad186cd4ada0ed6f262f7c80b9a7a7a3c2e9ad50; rzeczywisty host01a133c2-c245-77a0-bb6b-33165e2ad80c. Finalny closeout wymaga własnej bazy SG2, Memoros i zdalnego PHR.

Nie wdrożono nowej tożsamości klientów ani modelu członkostw do działających usług. Bieżąca granica nagłówków SG2, owner role i brak RLS w istniejącej prywatnej bazie, znane powiązania baz oraz pozostałe operacje produktu nie zostały naprawione tym testem. Testowy RLS nie jest potwierdzeniem wdrożonej migracji. Kategorie, forecast, osobiste listy aplikacji, eksporty, kolejki i płatności pozostają poza przyjęciem tego odbiorcy. Brak deploymentu i zmian danych Development/Staging/Production; przyrost wymaga osobnego zakresu aktywacji i wydania.

Finalny audyt kandydata3 zapisuje czas UTC fazy i początku operacji, referencję dowodu tożsamości, wersję/źródło uprawnienia i produktu oraz klasę/właściciela/wersję zasobu. Integracja niezależnie odczytała te pola z trwałych rekordów własnej bazy testowej.

## Kontynuacja odbioru przez kontrolowany CI

Pierwotne zadanie zakończono PARTIAL_SUCCESS, z PHR6afc4978657548f792c70aba13ebfc7c5fea2a3b i zachowanym PR384. Nie przepisano jego historii. Nowe zadanie SG2-OPERATION-CONTEXT-ACCEPTANCE-20261017 zarejestrowano we własnym PMOS jako cmvbyej9m000011na16bbbson; conversationId pmos-task-v2:54917119e7d17fce7a3d4c3de697de50d4a6c24d8e6ece723b237967371c44a2. Profil, rzeczywisty host, Development i12ścieżek pozostają rozdzielone od ARCHITECTURE i SRM.

Po zintegrowaniu bieżącego main otrzymano kandydata c084ad9166639451f98813ae702a7b41f478871c. [Kontrolowana walidacja39006468466](https://github.com/profitia/SG-dev/actions/runs/39006468466) z authority482219037971903b2ed26b42ed6f12e62aed418e wykonała rzeczywistą czystą instalację,14testów PASS0skip, typecheck i pełny build. To zastępuje brak czystej odtwarzalności dla tego dokładnego źródła, bez ukrywania lokalnej wcześniejszej kopii zależności. Publiczny CI nie otrzymał pakietów lub tokenu.

Właściciel utworzył poświadczenie i potwierdził jego wymianę po początkowym zapisaniu jako zwykłej zmiennej. Agent potwierdził wyłącznie metadane Environment secret i brak zmiennej. Kontrolowany instalator sprawdził tylko konto profitia, read:packages i ograniczoną ważność, a następnie zakończył fazę z tokenem przed wykonaniem kodu kandydata. Nie odczytywano wartości do czatu, repozytorium, PMOS lub PHR. Polityka Environment nadal main-only. Szczegóły granic credentiala: [runbook](../runbooks/controlled-package-ci-v1.md).

Publiczna weryfikacja pierwszego dowodu ujawniła historyczny base.sha PR384 wskazujący ea06cd05, sprzed utworzenia kontrolera. To błąd konfiguracji checkout, a nie nieudany test aplikacji. Poprawka authority należy do zadania ARCHITECTURE-CONTROLLED-PACKAGE-CI-20261017 i zachowuje sprawdzanie bieżącego digestu polityki. Zmieniony HEAD lub polityka wymagają ponownej walidacji. Ostateczne numery run, SHA, merge oraz niezależny closeout nowego zadania są zapisywane po ich faktycznym wykonaniu w PMOS/PHR i końcowym odbiorze programu; ten wcześniejszy dowód nie jest przypisywany późniejszym commitom.
