# SG2 — natywna delegacja zlecenia do wspólnej kolejki Forecast, 18.10.2026

Status: SOURCE_CANDIDATE / LOCAL_VALIDATION_PASS / RELEASE_NOT_PERFORMED. To odbiór ograniczonej integracji źródłowej, nie zakończenie E1 ani potwierdzenie wdrożenia.

Zadanie `SG2-E1-DELEGATED-FORECAST-DELIVERY-20261018`, profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development. Authority profitia/SG-dev/main odczytane jako `22474ca52fa5bfe13ec7a46cd9dcb2b8a4cb23f2`. Własny PMOS SG2; zadanie producenta ARCHITECTURE i odbioru SRM mają osobne tożsamości i closeout. Rejestracja PMOS nie dowodzi zakończenia cyklu.

Producent: `ARCHITECTURE-E1-DELEGATED-EXECUTION-INGESTION-20261018`, source `0948a10c99626a6096df4c2fd1e25586ef318b72`, platform-contracts1.11.0, operation candidate7 i private host1.5.0. Źródłowy checkpoint natywnej integracji SG2: `c2d7fc7379d9f43eb40129a6d9df3ecbcb4b7190`. Zachowano wcześniejsze przyjęcia i ich historyczne ograniczenia.

## Rzeczywiście sprawdzony przepływ

1. Istniejący handler POST `/api/benchmark/forecast/requests`, oficjalny adapter tożsamości z syntetycznymi odpowiedziami SDK i zwykła rola Prisma tworzą oryginalne, ściśle typowane polecenie. Opcjonalny persister tworzy delegację przez wspólny store w tej samej transakcji co prywatne polecenie, quota, przyjęcie i OUTCOME. Ponowienie przyjętego klucza nie tworzy drugiej delegacji.
2. Natywna projekcja prywatnego polecenia sprawdza bieżący `current_job`: konta, powiązanie tożsamości, członkostwo, organizację, oryginalny grant, produkt, moduł oraz odrębny grant usługi. Rola wykonawcza nie ma bezpośredniego SELECT do tabeli poleceń.
3. Wspólny host AM27 sprawdza także bieżący stan konta przez port oficjalnego SDK Clerk. Usługa pozostaje SERVICE, z osobnym `subjectUserId`; nie zamienia się w aktora HUMAN i nie używa tokenu sesji zapisującego się w kolejce. Przyjęcie READY i jego krótka dzierżawa są trwałe przed efektem źródłowym.
4. Do odrębnej bazy źródłowej trafiają cztery uniwersalne pola polecenia i niejawny klucz dostarczenia. Prywatna organizacja, użytkownik, sesja i historia nie trafiają do źródła. Własna zwykła rola źródła działa jako platformowa usługa AM26 z jawną polityką źródła, klasyfikacją i skończonym limitem SOURCE_TRANSACTION.
5. Natywny receiver korzysta z istniejącego `createForecastPreparationQueueService`, oryginalnego klucza zlecenia i telemetrii. Zapis do pierwotnej kolejki, ślad, źródłowe potwierdzenie i zużycie limitu zatwierdzają się razem. Nie utworzono drugiej kolejki, algorytmu, schedulera lub runtime.
6. Po rzeczywistym COMMIT źródła wspólny host zapisuje prywatne potwierdzenie. Wymuszona awaria tego prywatnego OUTCOME zostawia trwałe READY i jeden efekt w źródle. Po rzeczywistym wygaśnięciu dzierżawy bieżąco autoryzowane ponowienie potwierdza ten sam efekt, bez duplikatu i drugiego zużycia limitu. Nie resetowano zegara, liczników ani rekordów.

## Granice SQL i sterowników

`prisma/private-store/004-forecast-dispatch.sql` dodaje wyłącznie kontrolowane metadane i wąską projekcję istniejącego polecenia. Nie tworzy drugiej tabeli jobów. `prisma-market-data/private-write/001-forecast-queue.sql` wymaga przyjętego SQL008 i dotychczasowych projekcji. Własne metadane mają FORCE RLS i kontrolowanego właściciela NOLOGIN. Źródłowe potwierdzenia są niezmienne.

Instalator granicy oryginalnej kolejki wymaga jej rzeczywistego właściciela i odmawia przy nieoczekiwanym istniejącym RLS lub politykach. Zachowuje właścicieli oraz prawa i zachowanie starszych ról; nie przyznaje im nowych ACL. Ogranicza wyłącznie nową rolę źródła: zapis wymaga bieżącego, zarezerwowanego i sfinansowanego efektu dla tej samej serii w tej samej transakcji. DELETE jest zabroniony; TRUNCATE odmawia również po przypadkowym nadaniu prawa. Nieoczekiwane dodatkowe ACL, CREATE, rola uprzywilejowana lub uprawnienia do innych danych zamykają receiver.

Właściciel każdej wcześniejszej projekcji musi jawnie dopuścić odczyt jej metadanych instalacji przez kontrolowanego `profitia_ingestion_owner`: SELECT oraz polityka SELECT TO ta rola USING(current_user='profitia_ingestion_owner'). Runtime nie dostaje dostępu do tych tabel ani członkostwa w rolach; oddzielny login odczytowy pozostaje wskazany w dotychczasowym receipt. Brak wymaganej widoczności metadanych zamyka integrację.

Prisma kwalifikuje modele schematem: samo search_path nie przekierowuje ich do chronionych widoków. Port odczytu gotowości korzysta więc z rzeczywistych, jawnie kwalifikowanych zapytań do zatwierdzonych projekcji. Oryginalna walidacja i kompatybilność snapshotu zostały wydzielone do wspólnego portu naukowego; dotychczasowy czytnik nadal używa tej samej polityki. Nie emulowano Prisma i nie przyznano SELECT do bazowych tabel jako obejścia. Brakująca proweniencja pozostaje brakująca.

Nieprzenośny wynik PostgreSQL void z obowiązkowego zapisu audytu zastępuje w producencie rzeczywista projekcja boolean po wywołaniu tego samego writera. Potwierdzenie źródła jest nieprzenoszalnym dowodem w pamięci jednej instancji SDK, wydawanym po COMMIT prawdziwego sterownika. Serializacja ani druga instancja modułu nie przenosi tego dowodu; test natywnej aplikacji używa jej rzeczywistego loadera CommonJS. Nie jest to zewnętrzny podpis ani dowód transakcji rozproszonej.

## Walidacja lokalna

| Dowód | Wynik |
| --- | --- |
| Pełny zestaw SG2 API, SQL, roli, izolacji i integracji, z nową integracją |542/542 PASS,0 fail/skip/cancel |
| Nowa natywna integracja w tym zestawie |13/13 PASS; oryginalne API i dwie rzeczywiste bazy z ograniczonymi rolami |
| Dodatkowe istniejące Forecast Library i kompatybilność snapshotu |61/61 PASS,0 skip |
| Istniejąca kolejka, worker, progresywne przygotowanie i kontrakt trasy |38/38 PASS,0 skip |
| Ścisłe typy rzeczywiście zmienionych modułów i zależności |PASS |
| Osobny dashboard React18: testy, pełne typy i izolowany build |326/326 PASS,0 skip; typecheck/build PASS |

Zestaw natywny obejmuje również: cofnięcie obu nowych migracji po wymuszonym błędzie, odmowę zapisu bez rezerwacji, zmienioną treść tego samego klucza, prywatne dodatkowe pola, awarię potwierdzenia źródła, brak metadanych, odebrany grant, zablokowane konto zewnętrzne, odebrane członkostwo, cudzą organizację, brak bezpośrednich ACL, rollback foreground OUTCOME i awarię pomiędzy bazami. Zachowano zero/null i wcześniejsze warianty kompatybilności. Zestaw pełny oraz dodatkowe regresje częściowo się pokrywają; ich liczb nie sumuje się jako unikalnych przypadków.

Weryfikację wykonywano na nowych lokalnych klastrach PostgreSQL16 i nieistniejących wcześniej bazach o losowych nazwach. Użyto oryginalnego schematu Market Prisma i prawdziwych wygenerowanych klientów; syntetyczny magazyn nie zastępuje kolejki produktu. Nie pobierano płatnych danych ani sekretów pakietów. Starego klastra testowego nie resetowano. Po testach zatrzymano wyłącznie własne nowe klastry.

Powtarzalne wejścia: `apps/sg-runtime` → `npm run test:operation-context` z właściwym izolowanym SG2_OPERATION_TEST_OWNER_URL; istniejące dodatkowe zestawy Forecast Library i kolejki. Dokładne digesty przyjętych kontraktów i nowych granic znajdują się w `apps/sg-runtime/operation-integration.json`.

## Niewykonane wydanie i dalsze granice

Nie zmieniono konfiguracji, sekretów, danych, schematów, grantów ani wdrożeń chmurowych. Odczyty Render i Neon potwierdziły istniejące cztery usługi SG2 Development i ich wcześniejsze live SHA, z auto-deploy wyłączonym. Nie są one jeszcze potwierdzeniem wydania tej integracji lub kompletnego LKG.

Aktualny wariant działa przez jawne fabryki i istniejący handler w izolowanym uruchomieniu. Domyślna konfiguracja aplikacji pozostaje przyjęciem prywatnego zlecenia bez automatycznego dispatch. Nie podłączono pollera do workera, prywatnego API statusu, UI zlecania ani konfiguracji wydania. Wspólna kolejka i dotychczasowy worker mają dowód regresji, nie dowód nowej ochrony wszystkich jego efektów.

SOURCE_TRANSACTION ogranicza przechowany efekt SQL. Nie mierzy kosztu CPU długiego obliczenia, wywołań dostawcy ani ceny pozyskania danych. Płatny refresh, długie wykonanie, pełna parytetowa obsługa przygotowania i brakująca proweniencja wymagają osobnego odbioru w nadal otwartym E1. Nie ma nowego uprawnienia do działania wbrew tym ograniczeniom.

Nie zweryfikowano rzeczywistego OTP, sesji zdalnego Clerk, połączeń TLS docelowych ról, biznesowego UAT ani wydań Development/Staging. Kontrolowane CI, przyjęcie SRM, publikacja źródła i niezależne kanoniczne closeouty są odrębnymi dowodami; późniejszy odbiór musi wskazać ich dokładne SHA i wyniki. Program pozostaje IN_PROGRESS.
