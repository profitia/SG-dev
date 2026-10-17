# E1 — granica starego technicznego API forecastów, 17.10.2026

**Status: SOURCE CANDIDATE / NOT DEPLOYED.** Zadanie SG2-E1-TECHNICAL-LEGACY-BOUNDARY-20261017, SpendGuru 2.0 / SG-dev / development / local. Begin cmvctpclf0000dimwrgmeuh5o; conversationId pmos-task-v2:2af88c7802eead2e563ac790433a8908dd64fa09e3a9a0ce8b1694c743ab9185. Własne SG2 PMOS, wymagane MEMOROS/PHR; begin nie jest closeout. Podstawa: przyjęte E0/E1 kroki01–11, source baseline fc8f711a5355c811754aed3e0618678a47d5b852 i [datowana inwentaryzacja](2026-10-17-e1-second-host-and-remaining-boundaries.md). Bez rozszerzenia Production/E2–E4.

## Potwierdzona granica i zmiana

Wspólny stary adapter withInternalForecastServiceAuth obsługuje **14 metod w12 plikach route.ts**: action-trace GET/POST, capabilities GET, capability GET, execution-ledger POST, preparation/jobs GET/POST, prepare/current POST, prepared/current GET, prepared/verification GET, production GET, progressive POST, readiness GET i verification GET. Część handlerów zapisuje ślad, ledger lub zleca przygotowanie; wspólna etykieta FORECAST_READ nie dowodzi czystego odczytu. Token potwierdza starą integrację wdrożenia, nie bieżący SERVICE_GRANT, grant użytkownika, produkt, budżet lub uprawnienie do wspólnego ingestu.

Adapter jest teraz **jawnie legacy-only**. Nieustawiony PROFITIA_AUTH_PROVIDER zachowuje dotychczasowy domyślny legacy_demo; jawny legacy_demo nadal używa istniejącej stałoczasowej weryfikacji i tego samego principal/argumentów. Clerk oraz każda nieznana lub pusta jawna wartość odmawiają przed odczytem skonfigurowanego tokenu i przed wywołaniem biznesowego handlera. Prawidłowy stary token, cookie i przesłane role/ID nie otwierają tej ścieżki w nowym trybie. Nie dodano alternatywnego runtime, logowania lub domniemanego konta technicznego.

Wszystkie odpowiedzi tego adaptera przechodzą przez **ten sam** istniejący privateApiResponse, teraz eksportowany przez middleware: private/no-store i poprawnie scalony Vary Cookie,Authorization, bez zmiany body/status/pozostałych nagłówków poprawnego handlera. Nie skopiowano mechanizmu. Niespodziewany błąd providera lub SQL daje zamknięty500 i stały komunikat diagnostyczny, bez treści wyjątku. Zachowano dotychczasowe401/403 dla brakującego lub niewłaściwego starego poświadczenia.

## Wykonane testy i granice dowodów

Pełny lokalny test:operation-context wykonał **251 PASS, zero failed/cancelled/skipped**. Obejmuje wcześniejsze149 testów API/Prisma/RLS/UI, nowy test granicy i istniejący forecast-route-contract. Testy wykonano z publiczną kopią zależności zgodną z React18/Next14 oraz izolowanym PostgreSQL, bez prywatnych pakietów, ich stubów, poświadczeń chmury lub płatnego providera. Własny pusty node_modules odtworzono po przebiegach.

Rzeczywiste zamontowane14 metod odmawiają w trybach Clerk/unknown/empty, również z poprawnym syntetycznym starym credentialem i fałszywymi nagłówkami organizacji/roli. Licznik wywołań sieciowych pozostaje0; osobny test rzeczywistego wrappera potwierdza0 wywołań biznesowego callbacku. Nie jest to test tożsamości prawdziwej usługi, prawdziwej sesji Clerk ani odczytu żywego runtime. Pozytywne testy default/explicit legacy zachowują principal, argument ścieżki,202 i wynik QUEUED; wcześniejsze testy forecastów potwierdzają obecne zachowanie biznesowe na fixture. Sprawdzono brak sekretu w odmowie i brak prywatnego wyjątku w odpowiedzi/diagnostyce. Ograniczony typecheck wszystkich zmienionych modułów i nowego testu PASS; pełny typecheck/build produktu jest bramką kontrolowanego CI przed merge.

## Granice odbioru

To trwała granica odpowiedzialności starego adaptera, **nie implementacja AM-26/27**. Natywny techniczny grant, delegacja i bieżąca reautoryzacja zleceniodawcy, budżet/idempotencja płatnej operacji, prywatne metadane zlecenia oraz ograniczona publikacja wspólnej wiedzy nadal wymagają własnych dowodów. CLI/worker wywołujące bazę bez tego HTTP adaptera nie są objęte tą zmianą. Nie należy aktywować kompletnego nowego trybu produktu wyłącznie na podstawie tych odmów, dopóki wymagane funkcje biznesowe nie mają przyjętego nowego toru.

Nie zmieniono tokenu lub jego uprawnień, usług, roli/bazy, flag, źródeł danych lub wdrożeń. Żaden provider nie został wywołany i nie migrowano rekordów klienta. Historyczny census/freeze pozostaje bez zmian; niniejszy datowany dowód opisuje nowszą granicę źródła. Deployment i rzeczywiste biznesowe Development/Staging wymagają odrębnych przyjętych bramek oraz wykonalnego odzyskiwania. Całe E0/E1 pozostaje IN_PROGRESS.
