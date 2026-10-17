# E1 — prywatny host operacji i rzeczywisty przepływ raportu SRM

Status: **ISOLATED_APPLICATION_INTEGRATION**, bez aktywacji działającej trasy. Profil SRM, Development, wykonanie lokalne. Zadanie `SRM-E1-PRIVATE-PG-ADOPTION-20261017`. Pełny E1, migracja i wydania pozostają **IN_PROGRESS**.

## Przyjęty producent

Przyjęto `private-operation-host` 1.0.0 z ARCHITECTURE-E1-PRIVATE-OPERATION-HOST-20261017, [PR #402](https://github.com/profitia/SG-dev/pull/402), source `a65cf73282d19e7242160f252b5ebba82f9afbb7`, pakiet 1.4.0. Własny test SRM przypina fingerprinty hosta, identity-provider i access-store. Wspólny executor, adapter Clerk, SQL authority i writer audytu pozostają bez zmian. Osobne przyjęcie SG2 w [PR #405](https://github.com/profitia/SG-dev/pull/405) nie zastępuje niniejszego odbioru.

## Sterownik i istniejąca logika biznesowa

[Własna fabryka SRM](../../apps/srm/src/server/private-operation-host.ts) dostarcza rzeczywisty `pg.PoolClient`, jedną transakcję i osobną natywną pulę niezależnych odczytów i audytu. Gospodarz przekazuje oficjalny interfejs klienta Clerk oraz zaufane `readResources` i `projectOutput`. Nie mogą pochodzić z HTTP. Nie powstał nowy weryfikator tokenów, silnik decyzji lub writer. Clerk pozostaje aktualnym tymczasowym dostawcą; przyszły system własnego logowania nie jest częścią tej zmiany.

Czas oczekiwania na klienta jest ograniczony. Spóźnione połączenie zostaje zwolnione ze zniszczeniem, bez uruchomienia zaniechanego callbacku. Całkowity timeout transakcji obejmuje także oczekiwanie poza SQL: sterownik zamyka wyłącznie własne pobrane połączenie i nie zwraca go do ponownego użycia. Kontrolowany błąd wykonuje rollback; nie ma automatycznego replay. Błąd łączności podczas COMMIT nadal może oznaczać nieznany wynik — wymaga zachowania decision ID i rozstrzygnięcia OUTCOME/skutku przed retry.

Istniejący `createOperationReportDataHandler`, `readReportData` i odbudowa dokumentów z archiwum wykonują się w tej samej transakcji co decyzja i OUTCOME. `withOrganization` zachowuje dotychczasowy kontrakt `srm_app` dla zwykłego runtime. Nowa baza jest dopuszczona wyłącznie dla jawnie powiązanej transakcji, dodatkowo potwierdzającej rzeczywisty descriptor aplikacji SRM, nazwę bazy i aktualny `scope_allows`. Nie poszerzono `getPool` ani zewnętrznego routingu URL.

## Potrzebne polityki nowego magazynu

Rzeczywisty test wykazał, że część istniejących polityk wskazuje konkretny login `srm_app_runtime`. Sam grant tabel nowej zwykłej roli nie wystarcza. W ramach tej samej autoryzowanej integracji dodano dokładny target [db/security/private-operation-boundaries.sql](../../apps/srm/db/security/private-operation-boundaries.sql), po zabezpieczeniu własnego kandydata i ponownej pełnej bramce require-begin z rozszerzoną listą ścieżek. Oryginalna rejestracja PMOS i prompt pozostały niezmienne; rozszerzenie jest jawnym dowodem dalszego wykonania, nie przepisaniem begin.

Skrypt jest odrębnym kandydatem dla nowego magazynu, po zgodnych 18 migracjach SRM i zaakceptowanym access-store. Nie znajduje się w automatycznej kolejce starych migracji. Nie provisionuje ról i nie aktywuje aplikacji. Włącza ENABLE/FORCE RLS i dodaje dopuszczenie oraz **restrykcyjną granicę** dla 12 tabel organizacji, raportu i źródeł. Restrykcyjna polityka jest łączona AND z dawnymi politykami dopuszczającymi; dawny `srm.organization_id` nie poszerza nowego zakresu.

Trzy wskazane tabele wspólnej wiedzy finansowej mają ograniczony odczyt w aktualnym kontekście SRM i restrykcyjną odmowę globalnego INSERT/UPDATE/DELETE przez tę ścieżkę człowieka. TO PUBLIC nie nadaje ACL tabel. Ingestion i kontrolowany writer wspólnej wiedzy wymagają odrębnego przyjęcia; ten skrypt nie może zostać aktywowany jako zamiennik wszystkich dotychczasowych procesów zapisu katalogu.

## Dowody

[Własna integracja](../../apps/srm/scripts/private-host.integration.test.mjs) stosuje syntetyczną, strzeżoną bazę loopback `srm_private_host_test`, rzeczywisty zwykły login i dwie pule po dwa połączenia przy limicie roli cztery. Wszystkie inicjalizacje są odcięte od hostów dostawców i danych klientów. Zaakceptowany SQL access-store jest czytany z pakietu, a migracje biznesowe z istniejących plików. Istniejąca integracja pozostaje w wykonywanym zestawie; fixture używające wspólnych lokalnych ról są uruchamiane seryjnie.

Potwierdzono rzeczywiste odtworzenie dokumentów i odpowiedź istniejącego API, odrębność archiwów dwóch organizacji oraz odrębne identyfikatory zakresu preferencji dwóch użytkowników. Sfałszowane nagłówki, odwołana sesja i produkt powodują odmowę. Awaria OUTCOME wycofuje faktyczne odtworzenie dokumentów. Całkowity timeout wycofuje wykonany INSERT i zamyka backend również przed zakończeniem oczekiwania callbacku. Timeout pobrania połączenia nie pozostawia spóźnionego klienta do użycia, a pula dalej działa.

Testy negatywne potwierdzają: odmowę ręcznie powiązanej transakcji bez przyjętego scope, zero prywatnych rekordów przy samym dawnym GUC, brak poszerzenia przez konflikt organizacji, SQLSTATE 42501 przy obcym INSERT oraz zero aktualizowanych rekordów wspólnego katalogu mimo celowo nadanego w fixture ACL jednej kolumny metadanych. Potwierdzono sześć równoległych operacji raportu i brak kontekstu w ponownie użytym połączeniu. Minimalne UPDATE jednej kolumny metadanych archiwum jest potrzebne do istniejącego PostgreSQL FOR SHARE; nie nadano prawa do zmiany surowego źródła.

Lokalne wyniki: 28 testów starej i nowej integracji API/SQL, 0 błędów i 0 pominięć; typecheck i build PASS. Pełna regresja SRM obejmuje 464 testy, wszystkie PASS, 0 pominięć. Siedem regresji migracji wykonano na osobnym, własnym tymczasowym serwerze PostgreSQL, ponieważ ich guard wymaga nieistniejącej bazy `srm_app`. Nie usunięto ani nie przejęto istniejącej lokalnej bazy. Plik wygenerowany przez build przywrócono do wcześniejszego stanu. Kontrole CI i publikacja stanowią dodatkowy dowód związany z dokładnym SHA przed merge.

## Jawne ograniczenia

Odpowiedzi SDK są syntetyczne. Ten odbiór nie potwierdza rzeczywistego logowania Clerk, bootstrapa użytkowników, migracji danych klienta, instalacji polityk u dostawcy lub gotowości wydania. `readResources` i `projectOutput` w fixture opisują wyłącznie wskazane, zatwierdzone dane syntetyczne; nie nadają klasyfikacji całemu istniejącemu katalogowi, źródłom MGBI/Vercly lub danym osobowym.

Nie przyjęto jeszcze pełnych polityk użytkowników i ich list, KYS, jobs/cache/files, kontrolowanego ingestion i pozostałych wejść. Odrębny identyfikator preferencji nie jest dowodem osobistego RLS wszystkich tabel. Ogólna odmowa 503 dla braku członkostwa pozostaje znanym ograniczeniem access-store 1.0.0. Konfiguracja wydania musi potwierdzić budżet i timeouty pul oraz procesów; dwa odrębne obiekty puli nie zastępują tej kontroli.

Nie wykonano zdalnego SQL, zmiany credentiali lub konfiguracji Render/GitHub, live route activation, deploymentu, Staging lub Production. Obie aplikacje nowego magazynu pozostają wyłączone według ostatniego osobnego odbioru przygotowania. Działające produkty zachowują dotychczasowe bazy i wydania. **Pełny E1 pozostaje IN_PROGRESS**.
