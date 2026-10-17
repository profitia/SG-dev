# E1 — rzeczywisty podgląd zapisanej wiedzy rynkowej w SG2, 17.10.2026

**Status: SOURCE CANDIDATE / NOT INITIALIZED OR DEPLOYED.** SG2 / SG-dev / development / local; authority profitia/SG-dev/main, baseline97b746804558b314b945d2fbc31898b2f1e75626. Przyjęte E0/E1 kroki01–11, bez Production/E2–E4.

Zadanie SG2-E1-STORED-MARKET-PREVIEW-20261017, begin cmvcwif2f00001weibi3xdbrj, conversationId pmos-task-v2:21f46fa99e08bf32b01a9ea9eeb601612ec536aa409c19051ccda9deb3f4c704. Własne SG2 PMOS/MEMOROS/PHR; begin nie stanowi closeout. Dokładne16ścieżek przeszły routing ALIGNED i pełne before/begin/require-begin. Nie zmieniono wspólnego15-operacyjnego kontraktu, jego digestów ani zależności produktów.

## Przyjęta granica i zachowanie biznesowe

Rzeczywisty GET /api/benchmark/preview otrzymuje osobny dispatcher. Default i jawny legacy_demo zachowują poprzedni parser, formatter, obsługę błędów i read-through do istniejącego providera. Nowy tryb jest osobnym server-owned opt-in PROFITIA_MARKET_READ_ENABLED=false domyślnie. Brak lub błędna konfiguracja Clerk/źródła nie przechodzi na legacy.

Nowy tor korzysta z tego samego oficjalnego adaptera tożsamości, wspólnego executora/access store oraz zwykłej prywatnej puli3business+1audit i bieżącego module binding benchmark. Wymaga **własnego knowledge.read/market i funkcji produktu SPENDGURU**; prawa wyboru benchmarku nie wystarczają. Dane historyczne mają klasę SHARED_KNOWLEDGE, bez właściciela osobowego/organizacyjnego; metadane wywołania i audyt pozostają w zakresie rzeczywistego aktora/organizacji. Dwie uprawnione organizacje mogą otrzymać identyczne wspólne fakty, bez współdzielenia prywatnego audytu.

Istniejący getBenchmarkPreview otrzymał jawną zależność czytającą historyczne dane. Domyślna pozostaje niezmieniona; nowa wykorzystuje zapisany rynek i ten sam formatter zakresów/zmian. Nie skopiowano logiki wykresów. Zachowano null, rzeczywiste0 i oryginalne jednostki. Brak zapisanej serii/punktów oznacza404 STORED_HISTORY_NOT_AVAILABLE, bez wymyślonych zer ani automatycznego zewnętrznego pobrania. Limit100000punktów daje jawne413, nie obcięcie udające kompletność. Zamknięta projekcja publiczna odrzuca obcą serię/zakres/zasób, dodatkowe prywatne pola i niepoprawne liczby/daty; granica body4MiB.

## Odrębny fizyczny odczyt źródła

Kod używa osobnego istniejącego sterownika Prisma i zwykłej roli źródłowej z limitem1połączenia. Nie korzysta z właścicielskiego MARKET_DATA_DATABASE_URL i nie dziedziczy praw prywatnej bazy. URL musi odpowiadać zatwierdzonemu hostowi/roli/bazie Development; dowolne options/schema/sslmode=disable lub inny endpoint są odrzucane przed połączeniem. Transport jest strict TLS; rzeczywisty handshake Neon nie został jeszcze odebrany.

Addytywny SQL001 tworzy tylko dwa widoki security_barrier ze wspólnymi polami rynku i techniczny receipt FORCE RLS, jako ograniczony NOLOGIN profitia_market_read_owner. Nie tworzy loginu, grantu, receiptu, konta, produktu ani danych. Nie otwiera bazowych tabel, hydration state, trace, ledger lub prywatnych zapisów. Rola aplikacji ma w przyszłej kontrolowanej instalacji wyłącznie SELECT na trzech tych obiektach. Sam plik nie jest zgodą lub dowodem instalacji.

Przed danymi reader sprawdza rzeczywiste current/session login, bazę, flagi roli/członkostwa, limit1, brak CREATE, właścicieli/RLS/widoki, brak innych ACL lub dostępnych pozasystemowych security-definer funkcji, dokładny i ważny source receipt. Wykonuje stałe parametryzowane SELECT w READ ONLY, pod ograniczonym search_path i limitem całego callbacku5s/statement4s. Systemowe katalogi są jawnie kwalifikowane. Nie ma ścieżki fetch/hydration/persist do providera. To odczyt globalnych faktów z oddzielnej bazy; nie deklaruje rozproszonej transakcji lub cofania wyniku odczytu źródła przy awarii prywatnego audytu. Taki wynik jest zatrzymywany przed odpowiedzią.

## Fakty dostawcy i walidacja

Odczyt metadata i katalogu SQL, bez rekordów klientów, haseł lub connection stringów: projekt autumn-waterfall-65938876, obecna organizacja org-nameless-field-92563437, Frankfurt, **PostgreSQL18.6**; gałąź Development br-dry-hall-b294222f, endpoint ep-muddy-pine-b22pdyqd.18publicznych tabel. Zgodność kolumn market_series/market_observations z użytym źródłem potwierdzona. Kandydackiej roli sg2_market_read_development_runtime i schema profitia_market_read **nie ma**. Nie zmieniono parametrów projektu, roli, danych lub usług. Odczyt neondb_owner był obserwacją katalogu, nie dowodem runtime zwykłej roli.

Lokalny test:operation-context wykonał **302PASS,0failed/cancelled/skipped**, strict zmienionego źródła i nowych testów PASS. Realne PostgreSQL16/Prisma, własne jednoznacznie guardowane loopback fixture. Zawiera całą wcześniejszą regresję i nowy pełny przepływ API → bieżący common host → osobna zwykła SQL rola → ten sam formatter → closed output → trwały audyt. Sprawdzono osobne prawa/produkt, dwie organizacje, drugiego członka, fałszywe nagłówki, bieżący DENY, zły receipt i awarię OUTCOME. Oddzielne fizyczne testy obejmują rollback całego DDL i ponowne zastosowanie, zwykły login, brak prywatnych/bazowych SELECT i DML, odmowę po błędnym dodatkowym ACL, prawdziwe READ ONLY, błędną bazę/rolę/branch/digest, expiry oraz0zewnętrznych pobrań. PostgreSQL16 fixture nie jest dowodem instalacji ani wydajności PostgreSQL18Neon.

Pierwszy lokalny przebieg przerwano: zbyt wczesny statyczny import serwisu zmieniał odczyt konfiguracji fixture, a nowy zagnieżdżony test oczekiwał na rodzeństwo zamiast potomka. Odroczono ładowanie serwisu do użycia nowej funkcji i poprawiono kontekst testu. Diagnostyczne logi importu usunięto. Poprawny302przebieg obejmuje również niezmienione dotychczasowe selekcje, kategorie, Supplier Intelligence, UI i forecasty. Żaden nieudany/przerwany przebieg nie jest zaliczony do PASS.

## Granice odbioru i dalsza praca

Pełny kontrolowany typecheck/build z prywatnymi pakietami, publiczne kontrole, dokładny merge/main i kanoniczne closeout pozostają wymagane przed odbiorem źródła. Nie powstał nowy projekt, login, grant, zewnętrzne pobranie, migracja chmurowa lub deployment. Nowe flagi pozostają wyłączone. Nie przyjęto instalacji źródła, prawdziwego browser OTP, żywego biznesowego E2E, nowego Staging ani wykonalności retained-artifact rollback.

Ten przyrost nie otwiera discovery/search/AI/context/metadata/analytics lub forecastów w Clerk mode i nie implementuje globalnego ingestu, płatnych limitów, delegowanych jobów ani refresh. Te operacje zachowują jawny status pozostałej pracy E1. Całe E0/E1 pozostaje IN_PROGRESS; obecne działające środowiska zachowują swój cykl wydań.
