# E1 — kandydat powiązania aplikacji z modułem danych

Status: **CANDIDATE_FOR_SEPARATE_CONSUMER_ADOPTION**. Profil ARCHITECTURE, Development, wykonanie lokalne. Zadanie `ARCHITECTURE-E1-MODULE-SCOPE-20261017`. Baseline authority: `b4595b40826a201592d07d0aae838d99e6db51f2`. Pełny E1 pozostaje **IN_PROGRESS**.

## Intencja i granica odpowiedzialności

Ten sam moduł ma działać w różnych zatwierdzonych aplikacjach. Definicja modułu nie może zawierać jednego stałego hosta, Organisation ID lub User ID. Własność prywatnych rekordów nadal wynika z ich organizacji i, dla danych osobistych, użytkownika. Dopuszczenie aplikacji do modułu jest osobnym, wyższym powiązaniem; nie zastępuje praw użytkownika lub dostępu organizacji do produktu.

Dotychczasowe ograniczone odbiory SG2 i SRM potwierdziły rzeczywiste sterowniki, API i polityki własnych obecnych gospodarzy. Nie potwierdziły jeszcze przenośności tych polityk do dowolnej nowej aplikacji. Ten kandydat uzupełnia warstwę wspólną; nie przełącza istniejących polityk produktów.

## Dostarczony dodatek

Pakiet `@profitia/platform-contracts` 1.5.0 dodaje opcjonalny `module-scope` 1.0.0: [implementację](../../packages/platform-contracts/src/module-scope.mjs), typy i [oddzielną migrację](../../packages/platform-contracts/migrations/access/002-module-scope.sql). Dotychczasowe operation-context, identity-provider, access-store, SQL001 i private-operation-host zachowano bajtowo, wraz z ich wcześniejszymi fingerprintami. Nie dodano Reacta, zależności zewnętrznej, nowego runtime, engine decyzji lub writera audytu.

Nowy namespace `profitia_modules` ma metadane instalacji i jawne, wygasające powiązania aplikacja–moduł. Zamknięty katalog obejmuje `benchmark`, `category` i `supplier_report`. Moduły wymagają odpowiednio SPENDGURU/benchmark, SPENDGURU/category lub SUPPLIER_INTELLIGENCE/supplier_report. Sama instalacja nie tworzy powiązania, konta, aplikacji, produktu lub grantu. `category` nie staje się przez to nową obsługiwaną operacją executora; jego niezmieniony katalog nadal obejmuje dziewięć operacji.

Obie nowe tabele mają ENABLE i FORCE RLS, z kontrolowanym ownerem NOLOGIN. Runtime nie otrzymuje bezpośrednich praw do authority. Trzy funkcje SECURITY DEFINER mają ustalony search_path, z pg_temp na końcu, i odwołania kwalifikowane schematem. GRANT dla wybranych zwykłych ról i inicjalizacja checksum są odrębnymi operacjami odbiorcy. Zmiany powiązań korzystają z istniejącej revision fence i wersjonowania, bez równoległego mechanizmu unieważniania.

## Zachowanie podczas operacji

Gospodarz najpierw ustanawia zaakceptowany kontekst tożsamości i dostępów w prywatnym hoście. Następnie, przed odczytem danych modułu, wywołuje `createModuleScopeGuard(...).bind` na tym samym query/transakcji. Dodatek wymaga rzeczywistego bindingu loginu/aplikacji, aktualnego członkostwa, aktywnego powiązania modułu i właściwego produktu/funkcji. Niezmieniony executor osobno wymaga obsługiwanej operacji, ceilingu profilu i dokładnego permission; dane klienta nie nadają tych praw.

Polityka danych używa `profitia_modules.scope_allows(moduleId,rowOrganisationId,rowUserId)`. Dla istniejących polityk dopuszczających należy zachować restrykcyjną granicę, tak aby alternatywne OR nie omijało nowego scope. Moduł jest ten sam, a aktualna zatwierdzona aplikacja wynika z rzeczywistego loginu i konfiguracji. Kolejny host wymaga własnego onboardingu, roli/ACL, powiązania i odbioru; nie wpisania jego nazwy do definicji komponentu.

Marker jest LOCAL i związany z aplikacją, aktorem, organizacją, wersją tożsamości/polityki, powiązaniem modułu i transakcją. Nie można go ponownie związać z innym, nawet poprawnym członkostwem w tej transakcji. Termin może wyłącznie skrócić istniejący lease. Wygaśnięcie po skutku powoduje rollback przez niezmienioną granicę OUTCOME/finalnej weryfikacji; zmiana grantu jest serializowana dotychczasową fence. Nie powstaje token pozwolenia do ponownego użycia.

## Weryfikacja lokalna

Wykonano **227 testów producenta i laboratorium**, zero błędów i pominięć, oraz **33 testy governance, workspace i kontrolera CI**, zero błędów i pominięć. Build pakietu przechodzi. Nowe dowody obejmują 15 testów adaptera i 12 rzeczywistych scenariuszy SQL. PostgreSQL używa dotychczasowej strzeżonej bazy loopback `platform_access_test` i rzeczywistych zwykłych loginów. Dane i bindingi są syntetyczne.

Potwierdzono użycie niezmienionej tabeli/modułu przez dwa jawnie dopuszczone hosty testowe, zachowanie organizacji oraz osobistego właściciela, brak odczytu przy samym bazowym lease, odmowę bez bindingu lub produktu, brak rozszerzenia na inny moduł, SQLSTATE 42501 dla cudzych zapisów, zakaz ponownego związania z inną organizacją, skracanie terminu, rollback rzeczywistego zapisu po wygaśnięciu, blokowanie odwołania przez aktywną fence oraz brak markerów i authority ACL po ponownym użyciu puli.

Nazwy hostów `sg2-test` i `srm-test` pochodzą z istniejącego fixture i opisują syntetyczne aplikacje z jawnymi grantami SPENDGURU. Test nie nadaje rzeczywistej aplikacji SRM Standalone produktu SPENDGURU i nie zastępuje jej ceilingu. Nie jest również testem osadzenia biznesowego modułu lub UI w drugim działającym gospodarzu. Ten odbiór pozostaje osobny.

Fingerprint SQL dodatku: `c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed`. Fingerprint źródła/typów/SQL: `1a37a9c5ccb19515baf343a122b3c9a9e246c18995b421854c4a0ef7b4211bf8`. Odbiorcy muszą przyjąć je osobno od zachowanych fingerprintów bazowych. CI i publikacja wymagają dowodu związanego z dokładnym source SHA przed merge.

## Ograniczenia i dalsze odbiory

Nie wykonano zdalnego SQL, nie provisionowano praw klientów lub infrastruktury, nie aktywowano loginu, ścieżek produktów lub deploymentu. Nie zastąpiono Clerka. Aktualne polityki i adaptery aplikacji nie zostały automatycznie rozluźnione. Przyjęcie wymaga osobnych zadań SG2/SRM, właściwych ról, danych, migracji i testów każdego wejścia.

Zwracane metadane modułu są przeznaczone dla serwera. Dotychczasowy audyt zapisuje policy revision i product evidence, lecz nie zawiera jeszcze odrębnego, typowanego module-binding evidence. Przed deklaracją pełnego audytu żywego modułu wymagany jest odbiór wspólnej koperty audytu i zachowanie provenance zmian operatora. Nie obchodzono allowlisty zdarzeń i nie utworzono drugiego writera. Wygaśnięcie wykryte podczas zapisu OUTCOME może obecnie otrzymać ogólną klasyfikację odmowy audytu; ten test dowodzi rollbacku, nie docelowej semantyki kodu HTTP.

Dodatek nie dostarcza bootstrapu, zarządzania rolami, usług/delegacji, limitów i rezerwacji, ingestion lub płatnych operacji, cache/plików/eksportu, pełnego katalogu operacji, migracji klientów, UI React18/19 ani wydań Development/Staging. RLS i jego kontekst pozostają granicą zaufanego backendu; nie uwierzytelniają posiadacza skradzionego poświadczenia SQL i nie chronią przed uprzywilejowanym administratorem migracji. Te ograniczenia nie zostały przedstawione jako wykonane funkcje lub pełny odbiór E1.
