# SG2 — oryginalny worker Forecast pod kontrolą wspólnego kontraktu, 18.10.2026

Status: SOURCE_CANDIDATE / LOCAL_VALIDATION_PASS / RELEASE_NOT_PERFORMED. Dokument opisuje ograniczony przyrost kodu. Pełne E0/E1 i wydania Development/Staging pozostają w toku.

Zadanie `SG2-E1-PLATFORM-FORECAST-WORKER-20261018`, profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority profitia/SG-dev/main: `0fa766fdf19bd110864f20afaf82db84f2e64b3c`. Własny cykl PMOS SG2 obejmuje MEMOROS i PHR według adaptera; rejestracja nie jest closeout. Przyjęty producent ARCHITECTURE pozostaje platform-contracts1.11.0, source `0948a10c99626a6096df4c2fd1e25586ef318b72`. Nie zmieniono wspólnego pakietu ani macierzy dostępu.

## Rzeczywisty mechanizm

Istniejący `createForecastPreparationWorker`, pierwotna kolejka i jej klucze, dzierżawy, batching, checkpointy, single-flight, biblioteka Forecast oraz algorytmy Python pozostają właścicielami obliczeń. Nowa kompozycja przekazuje im jawne zależności. Nie powstała druga kolejka, kopia algorytmów ani osobny proces wykonawczy. Dotychczasowy CLI ma domyślnie wyłączony wariant natywny i zachowuje starszą ścieżkę.

Worker wspólnej wiedzy działa jako własna usługa PLATFORM_INTERNAL, z organisationId=null, bieżącym grantem źródła i limitem. Nie udaje człowieka i nie otrzymuje jego sesji. Osobna prywatna delegacja z poprzedniego przyrostu autoryzuje dostarczenie uniwersalnego polecenia; worker sprawdza przyjęcie tego polecenia w oryginalnym źródle. Śledzi również wyłącznie oryginalny prerequisite Current i jawnie zapisane zadanie kalibracji. Stary lub odgadnięty klucz kolejki sam nie daje uprawnienia do rozpoczęcia pracy.

Wspólny host1.11 rezerwuje skończone SOURCE_TRANSACTION dla krótkich rzeczywistych transakcji SQL. Przyjęcie konkretnego jobu i wersji dzierżawy, oryginalny claim i niezmienne potwierdzenie startu zatwierdzają się przed rozpoczęciem obliczeń. Praca CPU odbywa się poza transakcją SQL. Poszczególne odczyty i zapisy naukowe ponownie przechodzą przez wspólny host i granicę jobu/serii/modelu/semantyki. Current i Verification mają osobne loginy oraz fizycznie przypisane tory; konfiguracja jest przypięta do dwóch istniejących usług Development.

Test rzeczywistego sterownika zatwierdza oryginalny claim, a następnie wymusza utratę jego potwierdzenia po stronie klienta. Start i zużycie pozostają zapisane, obliczenie nie rozpoczyna się na podstawie niepewnego potwierdzenia, a oryginalne wygaśnięcie dzierżawy umożliwia kolejną, odrębnie rozliczoną próbę. Nie usunięto potwierdzeń, nie cofnięto liczników i nie utworzono alternatywnego odzyskiwania.

## Granice danych i wykonania

`prisma-market-data/private-write/002-forecast-worker.sql` dodaje trzy chronione tabele metadanych z FORCE RLS i kontrolowanym właścicielem NOLOGIN. Nie tworzy loginów, grantów biznesowych, instalacji, pojemności limitu ani powiązań usług. Potwierdzenia startu i zadania potomnego są niezmienne. Kontrolowany instalator, uruchamiany jako oryginalny właściciel, obejmuje12 oryginalnych tabel naukowych oraz kolejki/telemetrii. Zachowuje dotychczasowych właścicieli i starsze ACL; odmawia przy nieoczekiwanym RLS lub politykach. Nowe role wykonawcze mają wymuszone granice, nie mogą tworzyć schematów, nadawać praw, czytać innych tabel ani usuwać całego stanu. Nadmiarowe prawa do tabel, kolumn lub funkcji powodują odmowę. Granice obejmują rzeczywistą transakcję i aktualną dzierżawę, a nie samo ustawienie zmiennej sesji.

Oryginalne repozytoria przyjmują rzeczywisty Prisma.TransactionClient; jawny wariant nie otwiera globalnego połączenia i nie zatwierdza zagnieżdżonej transakcji. Kontrola naukowa workera korzysta z oryginalnego repozytorium stanu w granicach jego RLS. Publiczny port prezentacji zachowuje dotychczasową politykę. Nie wyprowadzono brakującej proweniencji danych okresowych z samych zapisanych wyników.

Jądra Python otrzymują jawne dane zapisane w źródle, bez poświadczeń baz, dostawców, rejestru pakietów lub tożsamości. Obowiązuje120s limit pojedynczego wywołania oraz jeden wątek bibliotek obliczeniowych. Transakcja źródła ma limit15s. Nie są to pomiary kosztu CPU, taryfy dostawcy ani gwarancja natychmiastowego przerwania już pracującego procesu po odebraniu grantu. Nie wykonuje się pobrań dostawców ani płatnego refresh.

Aktualnie zaobserwowane repliki Render to1 Current i2 Verification. Kandydat wymaga odpowiednio2 i4 połączeń loginu: osobna pula biznesowa i audytu po jednym połączeniu na replikę. Sama publikacja plików nie tworzy tych ról ani nie zmienia liczby replik.

## Walidacja lokalna

| Dowód | Wynik |
| --- | --- |
| Pełny zestaw SG2 API, SQL, izolacji, uprawnień i integracji |562/562 PASS,0 fail/skip/cancel |
| Dodatkowe istniejące Forecast Library i snapshot |61/61 PASS |
| Dodatkowe istniejące kolejka, progresywne przygotowanie i trasy |38/38 PASS |
| Ścisłe typy zmienionych modułów i ich zależności |PASS |
| Rzeczywiste jądra Current |naive, damped_holt, ETS, ARIMA; zapisane oryginalne artefakty |
| Rzeczywista weryfikacja historyczna |pełna ścieżka naive Daily→Monthly oraz Daily Current z kalibracją |

Zestawy częściowo się pokrywają; liczb nie sumuje się jako unikalnych przypadków. Historia fixture zawiera2191 syntetycznych obserwacji dziennych. Test używa oryginalnego schematu i wygenerowanego klienta Prisma, odrębnych zwykłych loginów i prawdziwego PostgreSQL16 na nowym lokalnym klastrze. Kontrolowany właściciel służy wyłącznie instalacji i odczytowi asercji; dowód wykonania pochodzi z ograniczonych loginów. Nowe klastry po zakończeniu zatrzymano. Nie resetowano starego klastra i nie pobierano sekretów pakietów.

Sprawdzono dodatnio faktyczne zapisy artefaktów/punktów, ledger i telemetrię, oryginalny batching, kalibrację, przyjęcie zadania potomnego i odzyskiwanie po utracie obserwacji COMMIT. Negatywne przypadki obejmują: zapis bez sfinansowanego kontekstu, błędny tor, zmieniony marker, wygasłą dzierżawę, awarię wymaganego audytu, współbieżne wywołanie tego samego workera, odebrany grant, nadmiarowy ACL, wyczerpaną pojemność na obu granicach oraz wycofanie DDL i instalacji polityk po wymuszonym błędzie. Nawet celowo błędny globalny adres bazy nie jest używany przez wariant natywny; liczba rozwiązań globalnego klienta i żądań HTTP pozostaje0.

Zachowano filtr limitu w natywnym discovery. Osobny test wykorzystuje kandydata odnalezionego przed wyczerpaniem limitu i potwierdza odmowę wspólnego SDK przed wejściem w zapis. Nie osłabiono granicy w celu przejścia testów.

Powtarzalne wejścia: `npm run test:operation-context` i `npm run test:source-worker`, z izolowanym SG2_OPERATION_TEST_OWNER_URL. Korzystają z istniejącego bootstrap bibliotek Python; testów naukowych nie pomija się. Lokalne uruchomienie wykorzystało oddzielny tymczasowy venv z rzeczywistymi bibliotekami. Kontrolowane CI musi dodatkowo potwierdzić pełne typy i build dokładnego kandydata. Dokładne digesty źródła, SQL i testów znajdują się w `apps/sg-runtime/operation-integration.json`.

## Otwarte granice przed wydaniem

Odczyt dostawców z18.10 potwierdził17 usług SG-dev i6 gałęzi rynku. Cztery usługi SG2 Development zachowują poprzednie live SHA i wyłączone auto-deploy. Automatyczne PCOS, Vector i PMOS mają inne root/filter niż zmieniane pliki. Nie wykonano DDL, zmian ról/grantów, danych, sekretów, konfiguracji, usług, aktywacji ani deploymentu chmurowego. Brak wydania oznacza też brak nowego zdalnego LKG.

W trakcie rzeczywistego obliczenia wykryto odrębną niespójność publicznej projekcji: oryginalny zapis Current może być oznaczany jako STALE. Worker wykorzystuje właściwy oryginalny port naukowy; publicznych kryteriów nie poluzowano. Zgodność projekcji z rzeczywistymi wynikami wymaga osobnego przyrostu przed aktywacją. Pozostają również: brakująca proweniencja non-daily, połączenie prywatnego dispatch z runtime, autoryzowany status zlecenia i parytet przeglądarki, rzeczywiste logowanie, TLS ról docelowych, kontrolowane inicjalizacje, pełny LKG i wydania Development→Staging. Kalibracji Daily nie przedstawia się jako pełnej weryfikacji historycznej wszystkich modeli.

To kandydat wspólnego mechanizmu w istniejącym workerze, nie dowód kompletnej wielodostępności aplikacji. Kontrolowane CI, normalny merge, dowody main i kanoniczny closeout tego zadania pozostają odrębnymi krokami. Po nich program jest kontynuowany w zaakceptowanym zakresie E0/E1.
