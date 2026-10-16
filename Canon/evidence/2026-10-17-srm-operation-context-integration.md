# SRM — izolowane przyjęcie kontekstu operacji

17.10.2026. Task SRM-OPERATION-CONTEXT-INTEGRATION-20261017, profil SRM, workspace SG-dev Codespaces SRM, wykonanie lokalne, TARGET_ENVIRONMENT=development. Osobny odbiorca programu Full Autopilot; historia wyłącznie srm_pmos i PHR. Producent ARCHITECTURE-OPERATION-CONTEXT-ENGINE-20261016/PR380; poprawiony kandydat z PR382/main52eda56757e48ffe942629767222981cd1c76fbd.

## Zmienione zachowanie w izolowanej integracji

Jawne przyjęcie w operation-integration.json: kontrakt profitia.operation-context1.0.0, implementacja1.0.0-candidate.2, pakiet1.1.2, digest implementacji/deklaracji `fff7529fb8c8dcad9cf7c29099b79d1efb0acdef37777c3e5750609e911e2c43`. Osobny adapter createOperationReportDataHandler korzysta ze wspólnego executora i rzeczywistego reportDataHandler/readReportData. Sprawdza supplier.report.project oraz osobne prawo do supplier.report.read i zakres wejść. Operacja jest projekcją mogącą zapisywać dane; nie jest nazywana czystym odczytem.

Zaufany host przekazuje capability aktywnej transakcji do istniejącego withOrganization. Capability jest związana z dokładną organizacją, nie jest flagą z JSON. Istniejąca funkcja nadal weryfikuje rzeczywistą bazę, rolę, brak obejścia RLS i przygotowaną organizację. W tej ścieżce nie rozpoczyna i nie zatwierdza wewnętrznej transakcji. Błąd audytu może zatem wycofać również prawdziwe odtworzenie dokumentów. Zwykły pool zachowuje wcześniejszą ścieżkę BEGIN/COMMIT/ROLLBACK i stały kontekst demo.

Domyślne reportDataHandler() i opublikowana trasa pozostają na istniejącym uwierzytelnieniu demo. Nie aktywowano nowego adaptera w Render ani przez zmienną środowiskową. Nowy host rozróżnia nazwanych użytkowników w kluczu ustawień; wspólnego aktora demo nie przypisano arbitralnie osobie.

## Wykonane lokalne dowody

- 14 testów integracji i przyjęcia: PASS, 0 skip. Test wywołuje prawdziwy handler HTTP Request/Response, readReportData, odtworzenie dokumentów i zapisy PostgreSQL. Nie jest to wdrożony endpoint ani test przeglądarkowy.
- Nowa baza srm_app na loopback, obecne18migracji z pełnymi checksumami, zwykła rola srm_app_runtime bez SUPERUSER/BYPASSRLS. Nie użyto produktu lub PMOS w Neon. Wspólny syntetyczny katalog finansowy jest czytany przez obie organizacje, podczas gdy ich różne prywatne archiwa i projekcje pozostają odrębne.
- Dwie organizacje, dwie osoby w jednej i jedno konto w dwóch. Podmiana roli/organizacji w body lub nagłówku nie nadaje praw. Poprawnie podpisane tożsamości dla obcej aplikacji, środowiska lub po wygaśnięciu są odrzucane. Preferencje dwóch osób mają różne zakresy; nie jest to migracja osobistych list.
- Brak supplier.report.read przy prawie project, odwołane członkostwo i wygasły produkt dają odmowę. Niewłaściwa metoda HTTP nie uruchamia projekcji. Właścicielska rola bazy i obca capability organizacji są odrzucone przez istniejącą granicę persystencji.
- Brak trwałego INTENT blokuje odtworzenie dokumentów. Awaria OUTCOME po rzeczywistym INSERT nie pozostawia dokumentów organizacji A; nie doszło do wcześniejszego, zagnieżdżonego COMMIT. Ponowienie po przywróceniu audytu działa.
- RLS odmawia odczytu bez kontekstu i filtruje drugą organizację. Kontekst organizacji/użytkownika znika po zwolnieniu transakcji. Runtime nie może przepisywać audytu i autorytatywnych praw. Hash i zawartość archiwów pozostają niezmienione.
- Pełna lokalna istniejąca regresja:464testy,457PASS,7SKIP,0FAIL. Skipy zależą od odrębnej bazy testów migracji i nie są zaliczane jako sukces. Typecheck i pełny build: PASS. Standardowy SRM CI ma własne testy migracji, a nowe CI integracji ma osobną bazę; ich faktyczne wyniki dla publikowanego SHA są osobnymi dowodami PMOS/PHR i odbioru programu.

## Governance i granice odbioru

Osobna przestrzeń źródeł, zależności, kontekstu i PHR zachowuje bieżący development biznesowy. Routing dziewięciu dokładnych ścieżek ALIGNED; pełny preflight, canonical begin i require-begin PASS. Rejestracja cmvbizyl800009rd07fde9h1s, conversationId pmos-task-v2:e56f067a6868a6d8879ce725b190642ee47a7f97fd72324abe31c964d970a379, rzeczywisty host01a133c2-c245-77a0-bb6b-33165e2ad80c. Memoros pozostaje disabled z profilu; finalizacja PMOS/PHR następuje po publikacji i weryfikacji.

Testowy issuer i autorytatywne rekordy polityki w schemacie operation_test są syntetyczne. Nie wdrożono docelowego dostawcy logowania, zarządzania członkostwami/rolami, cennika ani rozliczeń. Nie zmieniono migracji produktu, kontraktów finansowych, surowych danych ani retencji. Wszystkie zewnętrzne pobrania są zabronione w teście. Skorygowano wyłącznie interfejs współdzielenia transakcji i jawne przyjęcie adaptera.

Nie wykonano deploymentu lub migracji istniejących Development/Staging/Production. Dotychczasowe luki per-user, pozostałe API, odświeżanie/eksport, cache/queue i gotowość całego SaaS nie otrzymują statusu DONE. Testy obecnego RLS i nowej bramki w izolacji nie dowodzą, że nowy model jest już uruchomiony dla PORR. Odbiór dotyczy ograniczonego przyrostu kodu gotowego do osobnego procesu aktywacji i wydania.
