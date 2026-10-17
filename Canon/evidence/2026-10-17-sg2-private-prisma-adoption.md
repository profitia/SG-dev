# E1 — przyjęcie prywatnego mechanizmu przez adapter i API SG2

Status: **ISOLATED_APPLICATION_INTEGRATION**, bez aktywacji działających tras. Profil SG2, Development, wykonanie lokalne. Zadanie `SG2-E1-PRIVATE-PRISMA-ADOPTION-20261017`. Przyrost realizuje integrację wybranej pary operacji; pełny E1 i wydania pozostają **IN_PROGRESS**.

## Przyjęty producent i odpowiedzialności

Przyjęto `private-operation-host` 1.0.0 z ARCHITECTURE-E1-PRIVATE-OPERATION-HOST-20261017, [PR #402](https://github.com/profitia/SG-dev/pull/402), source `a65cf73282d19e7242160f252b5ebba82f9afbb7`, pakiet 1.4.0. Test odbiorcy przypina odrębne fingerprinty opcjonalnego hosta, adaptera tożsamości i access-store oraz checksum schematu SQL. Nie zmieniono źródeł producenta, silnika decyzji, writera audytu ani istniejącego receipt ograniczonej integracji operation-context.

Własna fabryka [private-host.ts](../../apps/sg-runtime/lib/platform/private-host.ts) łączy rzeczywisty `Prisma.TransactionClient`, ograniczony login i zaakceptowany magazyn uprawnień ze wspólnym mechanizmem oraz aktualnym adapterem Clerk. Otrzymuje zaufaną konfigurację i oficjalny interfejs klienta Clerk. Nie weryfikuje samodzielnie JWT, nie tworzy kont i nie wyprowadza tożsamości z e-maila lub nagłówków x-clerk. Własny system logowania nie jest zakresem tego zadania.

Fabryka obsługuje wyłącznie `benchmark.selection.read/write`. Istniejące handlery, service i repozytorium Prisma wykonują zapis i odczyt w tej samej transakcji co OUTCOME audytu. Niezależne zdarzenia zapisuje ten sam ograniczony writer access-store, przez wymagany osobny klient i natywną pulę Prisma. Gospodarz musi rezerwować jej pojemność w całkowitym budżecie roli; test stosuje dwie pule po dwa połączenia przy limicie roli cztery i potwierdza sześć równoległych żądań bez zagłodzenia audytu. Sam odrębny obiekt klienta nie potwierdza poprawnego budżetu wielu procesów lub usług — konfiguracja wydania wymaga osobnego sprawdzenia. Prisma egzekwuje całkowity timeout, również podczas oczekiwania na pracę inną niż SQL. Funkcja `append_audit` zwraca PostgreSQL void; adapter wykonuje niezmienione wywołanie bez deserializacji wyniku, której Prisma nie obsługuje. Nie jest to drugi writer ani alternatywny closeout.

## Granice SQL i zgodność biznesowa

Schemat Prisma dodaje unikalność rodzica `(id, organizationId)` oraz złożone FK mapowania i wyboru benchmarku do rodzica tej samej organizacji. Pozostają dotychczasowe identyfikatory, DTO i semantyka wspólnego wyboru organizacji. `createdByUserId` oznacza autora, nie osobistego właściciela rekordu organizacji.

[Kandydat polityk SQL](../../apps/sg-runtime/prisma/security/benchmark-private-boundaries.sql) włącza ENABLE/FORCE RLS dla trzech tabel benchmarku, oparty na przyjętym `scope_allows` i właściwej aplikacji. Polityka TO PUBLIC nie nadaje ACL tabel; zwykłe role wymagają odrębnego provisionowania. Skrypt wymaga zgodnego schematu access-store w tej samej bazie. Jest przeznaczony do nowego prywatnego magazynu, po zgodnej migracji schematu, nie do automatycznej naprawy starej bazy lub kopiowania historii demo. Kategorie i ich komponenty nie są objęte tym ograniczonym odbiorem.

## Weryfikacja

[Testy integracyjne](../../apps/sg-runtime/tests/private-host.integration.test.mjs) uruchamiają rzeczywisty istniejący handler Next, service, Prisma, zaakceptowany SQL access-store i nowe polityki na syntetycznej bazie `sg2_private_host_test`, wyłącznie loopback. Guard sprawdza źródłowy host, konto i nazwę bazy; inicjalizacja nie może wskazać dostawcy lub danych klienta. Rzeczywisty zwykły login, nie administracyjne SET ROLE, wykonuje operacje produktu.

Potwierdzono odrzucenie sfałszowanych nagłówków przed wywołaniem providera lub efektem, bieżące sprawdzenie sesji i issuer, brak zapisu dla użytkownika tylko do odczytu, wspólny widok organizacji, jeden użytkownik w dwóch organizacjach, świeży DENY i odwołanie produktu. Błędny branch w konfiguracji zostaje odrzucony. Odrębnie potwierdzono rzeczywiste SQLSTATE 42501 przy próbie zapisu do cudzej organizacji oraz 23503 dla rodzica z innej organizacji, brak takich rekordów, atomowy rollback po błędzie OUTCOME, rollback wykonanego zapisu po całkowitym timeout oraz dalsze działanie puli bez zachowanego kontekstu. Runtime nie czyta authority i nie przepisuje audytu.

Odpowiedzi interfejsu SDK w tym teście są syntetyczne i jawnie oznaczone. Nie są dowodem rzeczywistego logowania e-mail/OTP w Clerk. Rzeczywista weryfikacja podpisu przez oficjalne SDK pozostaje osobnym dowodem producenta; aktywacja sesji właściciela i odbiór logowania w aplikacji nadal wymagają wykonania.

Istniejąca i nowa integracja są wykonywane przez kanoniczne `test:operation-context`, bez wyłączania poprzednich przypadków. Wykonano kontrolę typów i build SG2. Lokalne zależności opcjonalnego pakietu odświeżono z jego dokładnego lokalnego archiwum npm; nie pozyskiwano sekretów lub prywatnych pakietów inną drogą. Pełny clean install wymaganych prywatnych pinów potwierdza osobno kontrolowany CI związany z dokładnym SHA przed merge. Odtwarzalne pliki wygenerowane przez build przywrócono do stanu sprzed komendy; nie stanowią zmian źródłowych.

## Jawne ograniczenia i wydania

Access-store 1.0.0 zgłasza ogólne POLICY_UNAVAILABLE, gdy `lock_access` nie znajduje członkostwa. Aktualny adapter HTTP zwraca w takim przypadku 503; test potwierdza odmowę i brak efektu, lecz nie przedstawia jej jako docelowej klasyfikacji 403. Doprecyzowanie tej odpowiedzi wymaga osobnej zmiany producenta i zgodności odbiorców. Błędy SQL pozostają ukryte w odpowiedzi API, a właściwy SQLSTATE jest sprawdzany wyłącznie wewnątrz testu.

Nie podłączono fabryki do działającej trasy demo, nie zmieniono konfiguracji lub sekretów Render/GitHub i nie wykonano zdalnego SQL, bootstrapu, migracji danych lub deploymentu. Sam build nie uruchamia migracji. Nie zmieniono SG2 Development/Staging, SRM lub baz rynku. Przed przyjęciem do wydania wymagane są pełne chronione wejścia, pozostałe tabele i operacje, bootstrap i rzeczywiste sesje Clerk, zgodna migracja danych, odzyskiwanie, Development i następnie Staging. Brak live adoption jest jawnym stanem, nie domniemaniem bezpieczeństwa całego produktu.
