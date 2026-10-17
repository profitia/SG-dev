# Prywatny magazyn dostępu — przygotowanie i granice inicjalizacji

Status: RUNBOOK_WITH_DATED_DEVELOPMENT_PREPARATION / NO_PRODUCT_ACTIVATION. Wykonanie wymaga odrębnego zadania właściwego profilu i środowiska. Dokument ani dostępność SQL w pakiecie nie uruchamiają migracji. Potwierdzony przyrost z17.10 znajduje się na końcu; wcześniejszy opis inicjalnego kandydata nie jest bieżącym stanem pustej bazy.

## Wariant fizyczny

Minimalny kandydat wykorzystuje jedną prywatną bazę `platform_private`: wspólny schemat `profitia_access` i oddzielne schematy oraz loginy aplikacji. Pozwala to połączyć kontrolę aktualnych praw, prywatny skutek i OUTCOME w jednej rzeczywistej transakcji. Wcześniej rozważane osobne bazy dla tożsamości i danych produktu nie zostały utworzone; nie przypisujemy im atomowości, której nie zapewniają.

[Zasób utworzony przez właściciela](../registries/platform-private-onboarding-v1.json) został początkowo przekazany jako pusty projekt z bazą `neondb`. Osobne przygotowania utworzyły później `platform_private`, role i schematy; aktualne fakty określa rejestr i datowane dowody. Nie zmieniono aktywnych topologii produktów. SRM i SG2 wymagają osobnych odbiorów oraz bezpiecznej migracji; współdzielenie schematu dostępu nie przenosi ich historii PMOS. Wspólna wiedza rynkowa pozostaje oddzielną warstwą, z własnymi połączeniami i prawami. Prywatne źródła SRM nie stają się globalne przez przeniesienie do innej bazy.

## Wymagania przed inicjalizacją

1. Potwierdź z aktualnej topologii i Neon dokładne project/branch/endpoint/database IDs, środowisko oraz rzeczywisty host połączenia i TLS. Metadane `installation` są deklaracją kontrolowanej migracji, nie samodzielnym dowodem fizycznej gałęzi. Klon może odziedziczyć te metadane; przed użyciem musi otrzymać właściwą tożsamość i własne poświadczenia, a adapter ma odrzucać stare wiązanie. Stan ARCHITECTURE Staging RESERVED nie jest upoważnieniem do utworzenia produkcyjnego magazynu pod profilem laboratorium.
2. Uruchom właściwe bramki i cykl PMOS tylko wtedy, gdy obejmuje profil i rzeczywiste środowisko. Nowe projekty tworzy właściciel. Zapisz zakres migracji, source SHA, checksum SQL, stan poprzedni i sprawdzony recovery. Przy pierwszym wdrożeniu jawnie oznacz brak poprzedniego artefaktu; nie wpisuj fikcyjnego LKG.
3. Magazyn produktu nie używa poświadczeń ARCHLAB ani PMOS. Przygotuj odrębnego migratora oraz `profitia_access_owner`: NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, bez praw tworzenia ról i baz. Migrator może jawnie przyjąć tego właściciela podczas kontrolowanej inicjalizacji. Runtime nie może być jego członkiem ani członkiem `neon_superuser`; nie może otrzymać właścicielstwa bazy, schematu, tabel lub funkcji.
4. W nowej, sprawdzonej bazie ogranicz CONNECT i TEMP do rzeczywistych odbiorców, usuwając niepotrzebne prawa PUBLIC. Loginy aplikacji są osobne dla aplikacji i środowiska, NOINHERIT i bez superuser/BYPASSRLS/CREATEDB/CREATEROLE. Ustal ograniczone pule, statement/lock/idle-in-transaction oraz całkowity timeout transakcji. Zanim zmienisz uprawnienia istniejącej bazy, potwierdź wszystkich odbiorców i zgodność ich funkcji.
5. Inicjalizację wykonuj tylko przy potwierdzonym braku tego schematu. SQL jest jedną wersjonowaną migracją, nie skryptem resetującym. Istniejący schemat wymaga porównania ledger/digest i osobnego przyrostu; nie stosuj DROP, resetu ani ukrytego IF NOT EXISTS jako naprawy rozbieżności.

## Schemat i minimalne granty

Źródłem jest `packages/platform-contracts/migrations/access/001-internal-access.sql`, schemat1.0.0, pakiet1.3.0. `accessSchemaDigest()` wylicza checksum SQL; `accessStoreSourceDigest()` obejmuje SQL, implementację i typy. Odbiorca przypina oba dowody. W jednej transakcji migrator jawnie przyjmuje rolę właściciela, wykonuje dokładny SQL i zapisuje w `installation` rzeczywiste środowisko, projectId, branchId, databaseName, schemaVersion oraz checksum. Zapisuje także dowody wykonania poza produktem. Sam tekst checksum w tabeli nie mierzy niezależnie treści funkcji; odbiór obejmuje rzeczywisty katalog, polityki, właścicieli, granty i testy właściwego runtime.

Wszystkie10 tabel `profitia_access` mają ENABLE i FORCE RLS. Polityka kontrolowanego NOLOGIN ownera jawnie umożliwia funkcjom odczyt/zapis. Funkcje SECURITY DEFINER ustawiają własny search_path i używają kwalifikowanych nazw tabel. Jest to ograniczony interfejs bazy, nie ukryty BYPASSRLS runtime. Administrator migracji pozostaje uprzywilejowaną granicą zaufania i podlega osobnej kontroli.

Runtime otrzymuje wyłącznie USAGE schematu oraz EXECUTE: `runtime_descriptor()`, `identity_binding(text,text)`, `lock_access(uuid,uuid,text,text,text)`, `scope_allows(text,uuid,uuid)` i `append_audit(jsonb)`. Nie otrzymuje SELECT/INSERT/UPDATE/DELETE/TRUNCATE tabel dostępu/audytu, sekwencji ani możliwości modyfikacji funkcji. Każdy login ma jedno jawne wiązanie aplikacyjne. Schematy biznesowe mają odrębne granty i polityki z dokładnym App ID oraz właściwym Organisation/User ID; klucze obce prywatnych rekordów uwzględniają ich właściciela.

## Tożsamość i transakcja gospodarza

Kontrolowany bootstrap zapisuje wewnętrzny UUID oraz dokładny potwierdzony issuer/subject. Unikalny bindingId i rosnące wersje zapobiegają użyciu starego powiązania po odwołaniu/przywróceniu. Nie wyszukuje ani nie scala kont po e-mailu. Historia demo zachowuje dotychczasowe znaczenie. Źródło, czas i zakres początkowego członkostwa/grantów są jawne; fixture, nazwa OWNER lub sam zakup nie nadają praw.

Adapter gospodarza zachowuje binding odczytany podczas potwierdzenia dostawcy w lokalnym kontekście pojedynczego żądania. `lockAccess` otrzymuje go ze źródła serwerowego, ponownie potwierdza bieżącą tożsamość i wersję, członkostwo oraz prawa pod blokadą. Nie przyjmuje bindingu ani aktora z HTTP. W tej samej transakcji ustawia LOCAL kontekst aplikacji/środowiska/użytkownika/organizacji, policyVersion, bindingVersion, deadline i transaction ID. Dwie następujące po sobie instrukcje potwierdzają zachowanie tego samego transaction ID; autocommit nie daje używalnego lease.

Zmiany kont, bindingów, organizacji, aplikacji, członkostw, pozwoleń i produktów aktualizują wspólną rewizję przed mutacją. Konfliktują z blokadą aktywnej operacji, także gdy dodawany jest nowy wiersz DENY. To prosty fence całej instalacji, wymagający testu obciążenia przed szerszym SaaS. Nie opisujemy go jako blokady niezależnej dla każdej organizacji. Twarde timeouty i bezpieczne przerwanie transakcji pozostają obowiązkiem adaptera gospodarza.

Wykonawca operacji sprawdza uprawnienia i produkt, a RLS egzekwuje właścicielstwo w SQL. Backend jest granicą zaufania dla ustawiania kontekstu: RLS/GUC nie uwierzytelniają posiadacza skradzionego poświadczenia SQL. Zasoby i ich projekcje dostarcza aplikacja ze swojej transakcji. `verifyScope` i OUTCOME muszą używać tej samej transakcji co skutek. Wcześniejszy commit, serializacja lease, stary kontekst puli lub brak/nieprawidłowy/nieskończony deadline odmawiają dostępu.

Clerk nadal jest odrębną granicą: świeży odczyt sesji potwierdza stan przy uwierzytelnieniu. Blokada w Postgres nie blokuje administratora Clerk ani nie ustanawia liniowej gwarancji odwołania zewnętrznej sesji już podczas trwającej operacji. Aktywacja produktów wymaga własnego odbioru tej semantyki; nie wolno utożsamiać jej z serializowanym odwołaniem wewnętrznego członkostwa.

## Audyt i odzyskiwanie

INTENT jest trwały przed skutkiem. OUTCOME zapisuje się razem z prywatnym skutkiem, DENY/FAILURE po rollbacku niezależnym połączeniem. Runtime nie czyta ani nie przepisuje historii. Koperty odrzucają payload, nieznane/zagnieżdżone pola, rozpoznawalne postacie credentiali i obcą aplikację/środowisko; nie jest to automatyczna klasyfikacja każdej możliwej tajemnicy w dowolnym stringu. Wartości muszą pochodzić z dozwolonych serwerowych referencji.

Jeżeli nie działa zapis OUTCOME i następnie FAILURE, prywatny skutek jest cofnięty, a trwały INTENT pozostaje nierozliczony. Zachowaj go do kontrolowanego recovery; nie dopisuj fikcyjnego sukcesu lub pary zdarzeń. Ten kandydat nie dostarcza jeszcze reconciliatora, zewnętrznego kotwiczenia logu lub retencji. Brak pełnego closeout nie oznacza braku śladu.

Rekonstrukcja bazy lub cofnięcie migracji nie wynika z rollbacku aplikacji. Zachowaj dane zapisane przez nową wersję i potwierdź kompatybilność LKG przed wydaniem. Dopiero osobne integracje SG2/SRM, testy biznesowe i kontrolowane wydania mogą potwierdzić działanie tego modelu w rzeczywistym Development/Staging. Pełny onboarding, administrowanie rolami, delegacje, limity i billing pozostają własnymi zakresami.

## Potwierdzone przygotowanie Development — 17.10.2026

Zadanie `ARCHITECTURE-E1-INITIAL-DIRECTORY-PREPARATION-20261017` zastosowało przyjęte SQL002–004 i przeprowadziło jednorazowy kontrolowany bootstrap w nowym prywatnym magazynie. Aktualny [rejestr katalogu](../registries/platform-initial-directory-v1.json) i [dowód](../evidence/2026-10-17-initial-profitia-directory-preparation.md) rozróżniają przygotowanie od działania produktów. Źródło SQL004: PR #416, source `521efc36f2861352b284835a4cc53fe92cd9e076`; skoordynowane source `b28bb48286540f596849d0fcf26a00c04e4bd18b`; osobne QA SG2 w PR417. SQL001 i jego schemat1.0.0 zachowano; rozszerzenia mają osobne ledgery/checksumy.

Clerk został odczytany oficjalnym SDK z kluczem wyłącznie w pamięci procesu. Potwierdzono dokładną instancję i wskazany przez właściciela subject, zweryfikowany adres oraz brak blokady konta. Sam e-mail nie nadawał praw i nie służył łączeniu kont. Właściciel wskazał organizację wewnętrzną **Profitia**. Utworzono nowe wewnętrzne identyfikatory, jedno powiązanie, członkostwo, cztery konkretne uprawnienia dla przetestowanych ścieżek benchmarku/raportu, dwa dostępy produktu i dwa wiązania modułów. Granty mają jawny termin, bez wildcardu wynikającego z nazwy administratora. Nie przeniesiono historii demo ani danych klienta.

SQL004 dodaje prywatne nazwy oraz chroniony receipt inicjalizacji. Trigger sprawdza aktualne powiązania, zapisuje rzeczywisty czas i użytkownika sesji bazy; odrzuca późniejszy UPDATE/DELETE/TRUNCATE. Historyczne referencje nie blokują przyszłej kontrolowanej zmiany IdP. Receipt i dane kont pozostają poza bezpośrednimi prawami runtime. Wszystkie15 tabel kontrolnych mają FORCE RLS i kontrolowanego NOLOGIN ownera. DBA pozostaje uprzywilejowaną granicą; nie jest to zewnętrznie zakotwiczony log.

Kopię sprzed zmian odtworzono na osobnej gałęzi; zweryfikowano zgodność stanu oraz syntetyczny bootstrap i rollback po błędzie receiptu. Gałąź kopii nie ma endpointu. Neon odrzuca termin wygaśnięcia rodzica mającego gałąź potomną; faktyczne kopie i retencja są opisane w rejestrze. Nie usuwano gałęzi ręcznie. Kopia sprzed inicjalizacji nie stanowi zgody na skasowanie nowego konta lub późniejszych danych; dalsze zmiany wymagają aktualnej kopii i zgodnego odtworzenia.

Obie aplikacje są nadal `DISABLED` w nowym magazynie. Rzeczywiste ordinary loginy trzech usług potwierdziły odmowę descriptoru i brak bezpośrednich praw do kont, organizacji, ledgeru i receiptu. Istniejące połączenia i deploymenty Development/Staging pozostały bez zmian. Nie potwierdzono sesji przeglądarkowej, migracji schematów biznesowych, wszystkich wejść lub pełnego E1. Dalsze włączenie wymaga własnych odbiorów produktów i wydań.
