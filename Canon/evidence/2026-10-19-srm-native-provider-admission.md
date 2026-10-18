# SRM — natywne dopuszczenie klientów dostawców, 19.10.2026

Status: SOURCE_CANDIDATE_NOT_RELEASED; pełne E0/E1 IN_PROGRESS. Zadanie `SRM-E1-NATIVE-PROVIDER-ADMISSION-20261019`, profil SRM, workspace SG-dev Codespaces SRM, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority profitia/SG-dev/main; baza tej jednostki `7a9a101ee7415547902fceb3eb6661fc9bb06edf`. Własne PMOS/PHR; MEMOROS wyłączony profilem. Rejestracja nie jest closeout.

## Przyjęty kod i granice

Adapter źródłowy składa istniejące `platform-ingestion` i `external-call` z opcjonalnym protokołem natywnym1.0. Nie tworzy klienta MGBI/Vercly/CEIDG od nowa. Rzeczywiste, niezmienione funkcje `fetchMgbiGeneral`, `fetchMgbiFinancial`, `fetchMgbiPages`, `fetchVerclyKys` i `fetchCeidgJdg` korzystają z wstrzykniętego, chronionego fetchera. Zachowują mapowanie, kompletność archiwum, rozróżnienie braku danych, ograniczone stronicowanie i odpytywanie oraz jednokrotne płatne POST. Dotychczasowe miejsca ich wywołania i tryb legacy nie zostały przez tę jednostkę przełączone.

Z istniejącego hosta prywatnego wydzielono jego niezmieniony sterownik transakcji pg. Oba hosty korzystają z jednego sterownika: oddzielnej puli audytu, ograniczonego oczekiwania i czasu transakcji, odrzucenia spóźnionego połączenia i zamknięcia połączenia po przekroczeniu terminu. Nie dodano silnika tożsamości, uprawnień, audytu ani osobnego runtime.

Każde rzeczywiste wywołanie wymaga bieżącej zwykłej roli, fizycznego powiązania bazy oraz polityki źródła i transportu. Używa tych samych transakcji PLAN, ATTEMPT i SETTLE, liczników i kanonicznego audytu. Transakcja SQL nie obejmuje oczekiwania na dostawcę. Źródłowa jednostka UPSTREAM_ATTEMPT_ADMISSION opisuje dopuszczenie próby, nie potwierdzenie rachunku dostawcy. SOURCE_TRANSACTION dotyczy krótkiej transakcji kontrolnej, nie pobranego raportu.

NIP jest ustalony dla konstrukcji. Dozwolone są wyłącznie istniejące ścieżki modeli MGBI, zapytanie CEIDG i POST/GET weryfikacji Vercly. Zapytania, format body i nagłówki mają zamknięte reguły. GET Vercly wymaga korelacji faktycznie odebranej z poprzedniego POST. Strony MGBI muszą następować kolejno. Brak automatycznego przekierowania lub fallbacku do niechronionego fetch. Sekret dostawcy jest jawną zależnością serwera, poza komendą i rejestrem; tokeny nie są pobierane z Render przez tę jednostkę.

Jawny, prywatny klucz operacji256bit oraz identyfikator źródła i kolejność wywołania wyprowadzają stabilny intent. Zmieniony NIP przy tym samym miejscu operacji powoduje konflikt, a odtworzenie transportu nie otwiera drugiego zakupu. Jeden transport nie przyjmuje równoległego wywołania, drugiego POST ani dalszej pracy po niepewnym wyniku. Nie ma automatycznego retry, losowania nowego klucza po awarii lub zwrotu zużytej jednostki. Odtworzenie już rozliczonej odpowiedzi nie jest zaimplementowane; receipt nie zastępuje utrzymanego wyniku dostawcy.

## Rzeczywiste testy tej jednostki

Na własnym PostgreSQL16 i serwerze HTTP loopback wykonano132 testy natywne, bez skipów. To117 dotychczasowych przypadków oraz15 testów tej adopcji, w tym nadrzędny test integracji. Wykonano oryginalne klienty i rzeczywiste połączenia HTTP, SQL oraz COMMIT pod zwykłą rolą. Nie użyto kont ani poświadczeń klientów.

Pokrycie obejmuje firmę i finanse MGBI, kompletne dwie strony i odrzucenie niekompletnego wyniku, oryginalny POST-once/poll/Retry-After Vercly, dopasowanie JDG CEIDG i prawdziwą pustą odpowiedź204. Negatywne przypadki obejmują obcy NIP, origin, query, nagłówek, płatne body, korelację, replay i zmianę NIP-u pod tym samym intentem, niepewny POST, odwołane bieżące źródło lub politykę, budżet, złą rolę, digest i środowisko, anulowanie i przekierowanie. Awaria OUTCOME wycofuje rzeczywisty PLAN przed HTTP. Surowe wyniki, NIP, credential i klucz operacji nie trafiają do kontrolnego dziennika; zwykła rola nie ma bezpośredniego odczytu tego dziennika.

Zestawy produktu499 i promocji311 przeszły bez skipów; strict typecheck i build Next16/React19 przeszły. Zestawy nakładają się na inne dowody i nie są sumowane. Pierwszy przebieg wychwycił rozdzielne tożsamości klas błędów pomiędzy loaderami TS/ESM w teście. Sprawdzany jest pełny zamknięty kontrakt błędu, w tym certainty i brak prawa do retry; nie zmieniono odmów wykonania. Końcowe testy są niezależne od tego pierwszego nieudanego przebiegu.

Dowody dokładnego kandydata i main po publikacji należą do kanonicznego closeoutu, nie wynikają z samych powyższych testów lokalnych. `operation-integration.json` przypina osiem rzeczywistych plików sterownika, adaptera i oryginalnych klientów; starsza akceptacja źródła wspólnego pozostaje historyczna.

## Czego ten dowód nie obejmuje

Techniczne dopuszczenie źródła nie przyznaje użytkownikowi prawa do raportu, danych osobowych, PESEL lub pliku. Wynik transportu jest wewnętrznym, jeszcze niesklasyfikowanym wejściem do istniejącego parsera i późniejszej kontrolowanej publikacji. Nie jest zatwierdzoną wspólną projekcją. Istniejący kanon zakresu pól i retencji nadal obowiązuje.

Ta jednostka nie przyjmuje jeszcze HUMAN lookup/KYS/JDG, nie publikuje globalnego katalogu, nie wiąże sesji użytkownika z cyklem pobierania ani nie zmienia prywatnych snapshotów/archiwów. Pliki MSR/KRS, pozostałe chronione wejścia i obecna orkiestracja raportu wymagają odrębnej adopcji. Nie zmieniono common SQL001–012, oryginalnego18-migracyjnego initializera, baz chmurowych, ról, grantów, kluczy, flag, zasobów lub wdrożeń. Żadnego dostawcy zewnętrznego nie wywołano. Loopback jest jawnie dopuszczony wyłącznie w Development fixture; instancja Staging/Production go odmawia.

Pełne E1 wymaga dalszego parytetu biznesowego, bieżącego katalogu kont i praw, migracji/odzyskiwania, rzeczywistej sesji użytkownika i późniejszego kontrolowanego wydania Development. Nie wykonano wydania Staging ani Production, nie zlecono E2–E4.
