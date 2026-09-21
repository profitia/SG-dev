# PPF-1 Full Matrix Telemetry E2E

Task: `PPF1-FULL-MATRIX-TELEMETRY-E2E-20260921`

## Decyzja

`FULL_PPF1_MATRIX_ACCEPTANCE = BLOCKED_BY_CORRECTIVE`

Test potwierdził szybkie i kompletne przygotowanie Current Forecast dla wszystkich 12 tożsamości model × target basis. Nie potwierdził jednak celu użytkownika dla Historycznej Sprawdzalności: SG Runtime osiąga adaptacyjny stan `FAST_READY`, ale Dashboard nadal czyta wyłącznie `FULL`, dlatego użytkownik nie widzi szybkiego wyniku i czeka na pełną historię.

To jest wynik fail-closed pełnego testu, a nie awaria trwałej kolejki. Wszystkie 12 intencji sprawdzalności zostało trwale przyjętych, żadna nie zakończyła się błędem, a praca kontynuuje się po zakończeniu sesji przeglądarki.

## Authority i warunki testu

- repozytorium: `profitia/SG-dev`;
- baseline `origin/main`: `29a6b717d9e043baa2ec0719fdce06edb64b061a`;
- wszystkie cztery usługi Render były `live` na źródłowym SHA `b7ae5a69f789146bdf209b078bf224e0778c44bb`;
- Neon: projekt `autumn-waterfall-65938876`, branch `br-purple-shape-b2az1npx`, wyłącznie read-only;
- test nie wykonywał ręcznych zapisów artefaktów forecastowych, zmian konfiguracji ani deploymentu.

Świeży benchmark:

- `cnprod4431` / `cmssipq3j000dsobhcp0pohy1`;
- `Tangshan Billet, Daily`, MACROBOND, Daily, Tonnes;
- 1 643 prawidłowe obserwacje, od `2020-01-02` do `2026-09-20`;
- przed testem: 0 Current runs, 0 Verification runs, 0 daily snapshots i 0 trwałych zadań.

Macierz obejmowała cztery modele (`naive`, `damped_holt`, `ets`, `arima`), trzy target basis i cztery horyzonty sprawdzalności (`1M`, `3M`, `6M`, `12M`). Jedna tożsamość sprawdzalności przechowuje wszystkie cztery horyzonty, dlatego test uruchomił 12 zadań Current i 12 zadań Verification, reprezentujących 48 komórek prezentacyjnych sprawdzalności.

## Current Forecast — 12/12 PASS

Każdą tożsamość uruchomiono rzeczywistym kliknięciem w interfejsie. Dla każdej zarejestrowano: żądanie, przyjęcie do kolejki, gotowość artefaktu, pierwszy gotowy odczyt Dashboardu, faktyczny render wykresu i frontendowy ACK.

| Model | Target basis | Od kliknięcia do ACK |
| --- | --- | ---: |
| Naive | Daily | 4,759 s |
| Naive | Monthly Average | 38,125 s |
| Naive | End of Period | 15,782 s |
| Damped Holt | Daily | 8,819 s |
| Damped Holt | Monthly Average | 12,978 s |
| Damped Holt | End of Period | 17,522 s |
| ETS | Daily | 9,698 s |
| ETS | Monthly Average | 13,190 s |
| ETS | End of Period | 14,851 s |
| ARIMA | Daily | 22,234 s |
| ARIMA | Monthly Average | 52,072 s |
| ARIMA | End of Period | 52,093 s |

Rozkład całkowity: minimum `4 759 ms`, p50 `15 316 ms`, p95 `52 081 ms`, maksimum `52 093 ms`, średnia `21 844 ms`.

Średnie etapy:

- kliknięcie → przyjęcie do kolejki: `1 655 ms`;
- kolejka → gotowy artefakt: `14 946 ms`;
- gotowy artefakt → pierwszy odczyt Dashboardu: `4 386 ms`;
- odczyt Dashboardu → ACK po renderze: `856 ms`.

Wniosek: szybka ścieżka Current Forecast działa. Największy potencjał pozostaje w obliczeniu i opóźnieniu odpytywania po gotowości, szczególnie dla ARIMA i nie-dziennych targetów; sam render UI nie jest dominującym kosztem.

## Historyczna Sprawdzalność — kolejka PASS, szybka prezentacja FAIL

Wszystkie 12 akcji zostało przyjętych do trwałej kolejki. W kontrolowanym punkcie `2026-09-21T08:58:35.429Z`:

- 7/12 tożsamości osiągnęło `FAST_READY`;
- 4/12 osiągnęły również terminalne `FULL_READY`;
- 5/12 nadal wykonywało adaptacyjne paczki;
- liczba failures wynosiła 0.

Najważniejszy ślad: `naive / END_OF_PERIOD`, correlation ID `3552fee4-c1d5-462f-b6fa-6733c55ad71e`.

- kliknięcie: `08:30:50.042Z`;
- przyjęcie kolejki: `08:30:56.112Z`;
- adaptacyjny artefakt `FAST_READY`: `08:37:34.475Z`;
- pełna historia: `08:41:53.757Z`;
- UI ACK: `08:41:53.965Z`;
- `dashboardFirstReadyObservedAt`: brak;
- strata `FAST_READY → UI ACK`: `259 490 ms`, czyli 4 min 19,49 s.

Interfejs w okresie po `FAST_READY` nadal pokazywał, że sprawdzalność nie została przygotowana. Wykres i panel jakości pojawiły się dopiero wraz z `FULL_READY`.

Przyczyna jest jednoznaczna w aktywnym kodzie: `getBenchmarkForecastVerification()` w Dashboardzie zawsze wysyła `verificationScope: 'FULL'`. SG Runtime prawidłowo rozdziela `FAST_READY` i `FULL_READY`, lecz szybki artefakt nie ma konsumenta prezentacyjnego. Poprzedni live canary tego nie wykrył, ponieważ na krótkiej historii FAST i FULL zostały osiągnięte w tej samej terminalnej paczce.

Dla ukończonej tożsamości Naive / End of Period zweryfikowano rzeczywisty render wszystkich horyzontów:

| Horyzont | Średnia sprawdzalność | Zgodność kierunku | Wiarygodność |
| --- | ---: | ---: | --- |
| 1M | 84,1% | 0,0% | wystarczająca |
| 3M | 68,5% | 0,0% | wystarczająca |
| 6M | 70,1% | 0,0% | wystarczająca |
| 12M | 67,2% | 0,0% | wystarczająca |

Nie kontynuowano wielogodzinnego oczekiwania wyłącznie po to, aby pełna historia ARIMA doszła do końca. Kolejka została pozostawiona aktywna i bezpieczna, a dalsze oczekiwanie nie mogłoby zmienić decyzji: dopóki Dashboard żąda `FULL`, szybki wynik nie trafia do użytkownika.

## Telemetria i zasoby

Execution ledger w punkcie pomiarowym:

| Operation family | Wykonania | Resource summary | Śr. compute | Maks. compute | Śr. persist |
| --- | ---: | ---: | ---: | ---: | ---: |
| CURRENT | 12 | 4 | 11 890 ms | 41 035 ms | 191 ms |
| HISTORICAL_MAINTENANCE | 26 | 26 | 9 218 ms | 30 632 ms | 396 ms |
| VERIFICATION | 43 | 0 | 15 825 ms | 55 268 ms | 209 ms |

Render, okno `08:20–08:55Z`:

| Usługa | Szczyt CPU / limit | Szczyt RAM / limit | Wniosek |
| --- | --- | --- | --- |
| SG Runtime | 2,0 / 2,0 CPU | 1,67 / 4,29 GB | chwilowe nasycenie CPU i skok połączeń/klientów |
| Worker | 1,0 / 1,0 CPU | 0,55 / 2,15 GB | stałe wąskie gardło CPU; RAM ma duży zapas |
| Dashboard | 0,034 / 0,5 CPU | 0,185 / 0,537 GB | brak presji zasobowej |
| Finder | 0,0014 / 1,0 CPU | 0,149 / 2,15 GB | poza ścieżką krytyczną |

Wniosek infrastrukturalny: zwiększanie RAM nie jest pierwszym corrective. Worker jest CPU-bound, ale najpierw trzeba naprawić ścieżkę FAST oraz amplifikację odczytów; dopiero potem zmierzyć wpływ większego CPU lub kontrolowanej równoległości.

## Incydent połączeniowy

Podczas fan-outu o `08:32:03Z` SG Runtime zarejestrował sześć równoczesnych błędów `Can't reach database server` wobec endpointu Neon pooler. Nastąpił fallback do Macrobond. Jedno odpytywanie stanu w SG Runtime zwróciło HTTP 500 po `14 477 ms`, a odpowiadający mu Dashboard progressive endpoint zwrócił HTTP 500 po `14 506 ms`.

Aktywny klient Prisma w SG Runtime jest zapisywany w globalnym singletonie tylko wtedy, gdy `NODE_ENV !== 'production'`. W produkcji kolejne wywołania mogą tworzyć kolejne klienty/pule. W połączeniu z wielokrotnymi identycznymi odczytami rynku jest to najbardziej prawdopodobna przyczyna amplifikacji. Końcowy snapshot Neon pokazywał tylko 7 połączeń: 1 aktywne i 6 bezczynnych `ClientRead`, bez dowodu lock contention. Nie ma podstaw do uznania samego limitu Neon za główną przyczynę.

## Zarejestrowane luki telemetryczne

1. Dashboard nie ma prezentacyjnego odczytu `FAST`; żąda wyłącznie `FULL`.
2. Polling sprawdzalności może użyć correlation ID Current, dlatego `dashboardFirstReadyObservedAt` pozostaje pusty dla właściwej akcji Verification.
3. Nie-dzienne Current i Verification nie zapisują exact per-action resource summary; pełne dane są tylko dla dziennego maintenance.
4. Przełączanie horyzontu `1M/3M/6M/12M` nie tworzy osobnego śladu action-to-render.
5. Pojedynczy błąd progressive polling kończy pętlę zamiast wykonać bounded retry/backoff.
6. Metryki Render CPU/RAM pozostają service-level context i nie dają ścisłego przypisania do correlation ID.
7. Zegary klienta i serwera wykazały rozjazd rzędu dziesiątek–setek ms, więc sub-sekundowa kolejność cross-host nie jest w pełni wiarygodna.

## Corrective — kolejność rekomendowana

1. `P0`: pozwolić Dashboardowi czytać i renderować `FAST`, zachowując działającą w tle kolejkę do `FULL_READY`.
2. `P1`: prowadzić oddzielny Verification correlation ID przez progressive polling i pierwszy gotowy odczyt.
3. `P1`: zrobić z klienta market-data Prisma produkcyjny singleton i ograniczyć/coalescować identyczne odczyty.
4. `P1`: dodać bounded retry/backoff dla przejściowego błędu progressive polling.
5. `P1`: rozszerzyć exact resource summary na nie-dzienne Current i Verification.
6. Po poprawkach funkcjonalnych ponowić macierz i wtedy ocenić większy CPU Workera lub kontrolowaną równoległość; nie zwiększać RAM jako pierwszego ruchu.
7. `P2`: lawful `NOT_PREPARED` pokazywać jako stan możliwy do przygotowania, a nie „Niewspierane”.

## Końcowe gates

- `CURRENT_FORECAST_MATRIX = PASS`
- `DURABLE_VERIFICATION_QUEUE = PASS`
- `ADAPTIVE_BATCHING = PASS_WITH_LONG_RUNNING_WORK`
- `FAST_VERIFICATION_COMPUTE = PARTIAL_7_OF_12_AT_CUTOFF`
- `FAST_VERIFICATION_PRESENTATION = FAIL`
- `END_TO_END_TELEMETRY_COMPLETENESS = FAIL`
- `FULL_PPF1_MATRIX_ACCEPTANCE = BLOCKED_BY_CORRECTIVE`

Nie wykonano zmian kodu produktu ani deploymentu. Następny task powinien być celowanym corrective konsumpcji `FAST_READY` wraz z correlation i polling resilience, po którym należy powtórzyć tę samą macierz jako test akceptacyjny.
