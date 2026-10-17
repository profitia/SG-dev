# E1 — kandydat wspólnego adaptera prywatnej operacji

Status: **CANDIDATE / NOT_ADOPTED_BY_LIVE_PRODUCTS**. Data: 17.10.2026. Zadanie producenta `ARCHITECTURE-E1-PRIVATE-OPERATION-HOST-20261017`, profil ARCHITECTURE, Development, wykonanie lokalne. Jednostka należy do odrębnie zleconego E0/E1 Full Autopilot01–11. Nie uruchamia E2–E4.

## Zmiana

Opcjonalny eksport `private-operation-host`1.0.0 w `platform-contracts`1.4.0 składa istniejące mechanizmy: tymczasowy adapter tożsamości, własny magazyn dostępu i ten sam executor operacji. Nie tworzy drugiego silnika polityk, dostawcy kont, usługi ani writera audytu. Nie zmienia katalogu dziewięciu obsługiwanych operacji.

Konfiguracja aplikacji i fizycznego magazynu pochodzi z serwera. Każde wykonanie ma własną fabrykę uwierzytelnienia oraz bieżący binding environment/issuer/subject, zachowany wyłącznie w tym wykonaniu. Brak bindingu, powtórny odczyt lub niezgodny użytkownik odmawiają dostępu; równoległe żądania nie przechowują wspólnego aktora. Nie bierze się bindingu, członkostwa ani grantu z HTTP.

Wstrzyknięty adapter drivera zachowuje jedną rzeczywistą transakcję i przekazuje związany z nią query oraz klient ORM/SQL. Wspólny adapter pobiera aktualne prawa pod fence, ustawia ograniczone timeouty LOCAL, ładuje serwerowy opis zasobu i ponownie sprawdza scope. Trwały INTENT korzysta z niezależnego połączenia, natomiast OUTCOME oraz prywatny skutek z transakcji produktu. Przed commit wykonywany jest kolejny verifyScope. Opisy zasobów nie mogą zastąpić authority lub produktów.

## Dowody lokalne

Testy obejmują konstrukcję i błędną konfigurację, a w rzeczywistym lokalnym PostgreSQL16 ze zwykłymi loginami również:

- dwa nakładające się wykonania jednego adaptera dla różnych użytkowników tej samej organizacji, ze świadomie odwróconą kolejnością zakończenia weryfikacji tożsamości;
- poprawne ograniczenie rekordów przez RLS i brak kontekstu po zwrocie połączenia do puli;
- atomowy skutek i OUTCOME, niezależny INTENT oraz rollback przy błędzie działania;
- odmowę aktora bez aktualnie odczytanego bindingu, bindingu innego użytkownika, nieczłonka i próby zastąpienia praw przez loader zasobu;
- wykrycie pominiętego lub ponowionego callbacku drivera i pool-level query;
- wykrycie przedwczesnego commit w loaderze przed wykonaniem kodu biznesowego;
- całkowity timeout drivera dla kilku instrukcji, z których każda oddzielnie mieści się w statement timeout, i rollback ich zapisu.

To syntetyczny backend tożsamości w tej próbie SQL. Weryfikacja podpisu RSA i aktualnych sesji oficjalnym Clerk SDK jest osobnym testem producenta; tej próby nie przedstawia się jako rzeczywistej sesji klienta. Nie kontaktowano się z klientowskim dostawcą tożsamości, Neon ani Render w trakcie testów kandydata. Reset obejmuje wyłącznie jawnie disposable bazę loopback chronioną istniejącym guardem.

Dotychczasowe source/type digests pozostają byte-identical:

| Mechanizm | SHA-256 |
| --- | --- |
| operation-context | `e37a11798ed41b1c0a30f2ac3b539c6d19db59246c8ceae94005afeb10a08455` |
| identity-provider | `7db7627d36a5b0296c3620c1888a118da665682815aa19c8881d01c7cae2a0e6` |
| access-store wraz z SQL | `4e56e58220815661c3882c59ec897b0d740bf84bbf0485c84fb82007d6e00e50` |
| SQL schematu | `356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2` |

Nowy fingerprint implementacji i typów adaptera: `c9ebdef2de453f10346f7e3f8268b21391f1a32a0911ef8f5441163db7aa067b`. Jego przyjęcie wymaga również akceptacji powyższych zależności. Lokalnie przeszło 200 testów kontraktów/laboratorium bez błędów lub pominięć, w tym 16 testów konstrukcji/fingerprintów i 11 nowych scenariuszy rzeczywistego SQL. Dodatkowo przeszły 33 testy governance/workspace/kontrolera CI, build pakietu i strict TypeScript probe z rzeczywistymi typami ClerkClient, Prisma TransactionClient oraz pg PoolClient. Próba typów nie jest wdrożeniem tych driverów. Publikacja podlega oddzielnej kontroli kompatybilności obecnych SG2/SRM i pełnemu closeout producenta; dowody dokładnego CI/source SHA należą do zapisu tego zadania, nie do deklaracji wdrożenia produktu.

## Granice gwarancji i dalszego odbioru

Driver pozostaje zaufaną granicą: musi egzekwować timeout całego callbacku, await, commit/rollback i obsługę niejednoznacznego COMMIT. PostgreSQL16 nie ma transaction_timeout, więc same statement i idle timeouty nie wystarczają. Test drivera laboratorium nie jest testem konkretnego adaptera Prisma SG2 lub PostgreSQL SRM. Nie deklaruje się możliwości cofnięcia efektu już zatwierdzonego przez błędny lub złośliwy driver. Kod biznesowy nie może wydawać COMMIT, przełączać połączeń lub wykonywać zewnętrznych skutków w tym callbacku.

Nieznany wynik COMMIT wymaga sprawdzenia trwałego decision ID/OUTCOME i skutku przed ponowieniem. Błąd połączenia sam nie dowodzi rollbacku; kandydat nie dodaje automatycznego replay ani reconciliatora. Zewnętrzna sesja Clerk nadal ma osobną granicę odwołania od wewnętrznego fence SQL. RLS/GUC nie uwierzytelniają posiadacza credentiala backendu.

Własne role/schema i bootstrap, migracja historii, faktyczne podłączenie driverów oraz loaderów, wszystkie wejścia aplikacji, pozostałe operacje, zadania/cache/pliki, osadzenie UI i kontrolowane wydania Development/Staging pozostają odrębnymi odbiorami zaakceptowanego programu. Nie zmieniono istniejących konfiguracji lub danych produktów. Pełny E1 pozostaje **IN_PROGRESS**.
