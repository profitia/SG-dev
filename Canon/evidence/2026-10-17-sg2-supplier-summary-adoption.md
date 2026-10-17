# E1 — przyjęcie Supplier Intelligence w drugim gospodarzu SG2, 17.10.2026

**Task:** SG2-E1-SUPPLIER-SUMMARY-ADOPTION-20261017; SpendGuru 2.0 / SG-dev / development / local. Begin cmvcqe1ct00007de2e9rgpjh3; conversationId pmos-task-v2:c8ea70fa2fe0c01f266877622a49e446bc4a9c83721e6cd90ba65cb113e26a72. Własne PMOS SG2 oraz wymagane MEMOROS i PHR. Begin nie jest closeout.

**Producent:** SRM-E1-SHARED-SUMMARY-CONTRACT-PORT-20261017, profitia/SG-dev, [PR446](https://github.com/profitia/SG-dev/pull/446), source702fc1d70ce4ed4797c5030ddae093694bc04e21. [Dowód producenta](2026-10-17-srm-shared-summary-contract-port.md) rozróżnia czysty port, faktyczne UI React18 i dotychczasowy backend SRM. Kontrolowana polityka lokalnego pakietu została uprzednio przyjęta i sprawdzona na main13b23ddead36a3c039cad8ea5585d374e5255a45, z nowym policy digest, bez zmiany prywatnych pobrań.

## Rzeczywista kompozycja source

SG2 przyjmuje lokalny @profitia/srm-xray0.2.1 przez publiczne contracts, executive-summary, executive-summary-rules, financial-value i shared-financial-summary. Nie kopiuje komponentu ani reguł finansowych. Receipt, zainstalowana wersja, eksporty i bytes publicznego portu są porównywane z zadeklarowanym producer SHA. Trzy prywatne pakiety i ich pins/integrity pozostają niezmienione.

Nowy GET /api/supplier/financial-summary używa własnego native Prisma hosta SG2 i tego samego wspólnego executora/access store/adaptera Clerk. Rozszerzono obecny runtime; oba executory współdzielą istniejące business3 + audit1 połączenia. Każdy moduł ma własny current module binding. supplier.report.read wymaga własnego użytkownika, członkostwa, grantu i SUPPLIER_INTELLIGENCE dla spendguru; benchmark nie nadaje tych praw. Nie dodano klientowi możliwości wyboru roli, modułu, operacji lub bazy.

Po własnej autoryzacji i trwałym INTENT serwer wywołuje wyłącznie przypięty do Development peer SRM /api/xray/financial-summary. Przesyła wyłącznie ten sam bearer i autoryzowane organisationId/NIP/entityType; pomija cookies, role i nagłówki tożsamości. Nie przyjmuje adresu peer od klienta i nie podąża za przekierowaniami. SRM niezależnie sprawdza bieżącą tożsamość i własne uprawnienia tego użytkownika. SG2 nie dziedziczy praw SRM i nie udaje delegacji serwisowej.

Timeout5s, anulowanie, limit rzeczywistej odpowiedzi4MiB, kontrola MIME/cache/Vary oraz wspólny closed JSON fence chronią odbiór. Odpowiedź powstaje ponownie z zatwierdzonego JSON; nie kopiuje nagłówków, cookies lub diagnostyki peer. Wymuszono private/no-store i Vary Cookie/Authorization. Nie odczytuje się KYS, prywatnych dokumentów/eksportów, nie wykonuje project/refresh ani płatnego pobierania.

Version zasobu SG2 oznacza wersję zaakceptowanej reprezentacji odczytu. Zmienna tożsamość źródła finansowego pozostaje financial.sourceVersion i elementem odczytu/audytu SRM. Są to dwie niezależnie autoryzowane i audytowane transakcje READ, a nie rozproszona atomowa migracja lub wspólny rollback. Odrzucenie lokalnego OUTCOME wstrzymuje wynik SG2 i daje FAILURE, lecz nie anuluje prawidłowo wykonanego odczytu peer. Ten odczyt nie wykonuje biznesowego zapisu lub płatnego pozyskiwania danych.

## UI i tożsamość

Strona /[locale]/supplier-intelligence rzeczywiście osadza wspólny ExecutiveSummary w React18. Udostępnia wybór NIP/okresu, pozycje sprawozdania i zapisane wskaźniki oraz obsługuje callbacki źródeł. Wszystkie szczegóły są powiązane z aktualnym NIP, zakresem i jednoznacznym okresem; obcy lub niejednoznaczny wybór nie ujawnia starych liczb. Obsługiwana jednostka korzysta ze wspólnego formattera; inna jednostka źródłowa nie jest przemianowana na PLN. Brak danych nie staje się zerem.

Komponent nie zawiera organisationId/userId, własnych zasad dostępu, trwałej historii ani magazynu tokenów. Bieżąca sesja jest obsługiwana przez dotychczasowy keyed session boundary; zmiana wyboru/unmount przerywa zapytania i odrzuca stare wyniki. Browser pobiera swój token SDK tylko dla odczytu i wysyła go do własnego API bez cookies. UI SDK nie nadaje praw backendu.

Nowy moduł wymaga osobnego server-owned PROFITIA_SUPPLIER_SUMMARY_ENABLED=true i jawnej konfiguracji Clerk/private store; default pozostaje wyłączony. W legacy nie ma fallback nowego API. Dotychczasowy Finder/benchmark/legacy zachowuje zachowanie; neutralna strona nie zastępuje autoryzacji danych. Zachowano publiczny polski tekst modułu; nie deklaruje się pełnej lokalizacji angielskiej.

## Walidacja lokalna i jej granica

Rzeczywisty test:operation-context wykonał129 testów PASS, zero skipped. Wykorzystano jawnie ograniczoną publiczną kopię zależności z wersjami zgodnymi z lockfile oraz istniejące strzeżone lokalne bazy i zwykłe role. Nie kopiowano prywatnych pakietów ani credentiali i nie tworzono ich stubów. Oryginalny pusty node_modules aplikacji przywracano po każdym przebiegu. Nie jest to dowód czystej instalacji wszystkich zależności produktu ani pełnego buildu; te wymagają kontrolowanego CI.

Prisma/API sprawdzają własny grant/product/module i brak domniemania praw z benchmarku; dwie organizacje odczytują te same wspólne fakty i generują własne poprawnie skorelowane module INTENT/OUTCOME. Zawieszenie członkostwa, SDK revocation, obcy członek, explicit DENY, cofnięcie produktu/modułu i wybór innej organizacji w dedicated profile odmawiają przed peer. W poprawnym supplier lease rzeczywiste RLS nadal odmawia prywatnych rekordów benchmarku. Snapshot wszystkich tabel własnego store pozostaje identyczny. Cztery równoległe odczyty zachowują limit4 połączeń. Awaria OUTCOME daje503 i własne INTENT/FAILURE bez biznesowej mutacji i bez fałszywego rollbacku peer.

Dodatkowe przypadki obejmują captured bearer zamiast cookie/x-clerk authority, błędne/duplikowane parametry, podstawienie peer/operacji/NIP, dodatkowe prywatne pola, MIME/redirect/cache/header/size/abort/timeout, niedostępność konfiguracji i brak demo fallback. Rzeczywisty widok React18, callbacki, source details, brak danych i zmiany kontekstu przeszły testy. Ograniczony typecheck nowych modułów PASS. Początkowy test użył nieistniejącego REVOKED dla memberships; poprawiono go na kanoniczne SUSPENDED bez zmiany SQL/polityki. Test provenance używa createRequire dla zgodności z CJS/tsx. Publiczną kopię uzupełniono o istniejący Sharp0.35.5; nie zmieniono wersji produktu.

## Niewykonane i dalszy odbiór

Pełny czysty kontrolowany install/test/typecheck/build oraz exact PR/merge wymagają potwierdzenia po tej wersji. Fixture peer jest syntetycznym interfejsem odpowiedzi; faktyczny SRM projector/SQL/API są sprawdzane osobno w zadaniu producenta. Nie przedstawia się tego jako pełnego live połączenia obu serwerów, rzeczywistej sesji Clerk, odebranego biznesowego E2E lub wykonanego wydania. Wymagane są kolejne wspólne i wydaniowe dowody.

Nie zmieniono żywych ról, grantów, sekretów, konfiguracji, danych, usług lub flag. Nie wykonano deploymentu Development/Staging/Production. Pozostałe powierzchnie E1 i oba kontrolowane cykle wydania pozostają dalszą częścią programu; ten przyrost nie kończy E1.
