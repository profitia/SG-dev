# Dane do Kalendarza Surowcowego — inwentaryzacja Stage 01B

Stan: **9 listopada 2026**. Profil ARCHITECTURE; materiał do późniejszej selekcji biznesowej i projektu UX. Nie aktywuje ECR ani nowych praw do danych.

[Pobierz Excel](ecr-calendar-inventory-v1.xlsx) · [Katalog metadanych JSON](../catalog/ecr-calendar-inventory-v1.json)

## Zakres i sposób czytania

Skoroszyt zawiera 11 arkuszy: Przegląd, Publikacje, Wskaźniki, Harmonogramy, UX i filtry, Selekcja biznesowa, Instrumenty i serie, Pola i metadane, Źródła i API, Słowniki oraz Luki. Tabele mają filtry i zamrożone nagłówki. Żółte pola selekcji są puste; żadnej decyzji nie podjęto za właściciela.

| Zakres | EIA | commodities.sh |
|---|---:|---:|
| Pozycje przyjętego katalogu źródłowego | 259 węzłów w 14 grupach | 33 pozycje, w tym 30 operacji OpenAPI |
| Trasy z miarami | 232 | Nieporównywalne: katalog operacji |
| Pozycje biznesowe | 111 rodzin / możliwości danych | 63 instrumenty / rodziny / możliwości |
| Definicje publikacji z aktywnych harmonogramów | 2 | 6 |
| Instrumenty i serie referencyjne | Wymiary zależne od trasy | 30 instrumentów i 7 serii operacyjnych |

Wspólny WPSR daje łącznie **7 różnych definicji publikacji i 8 wariantów źródłowych**: WPSR, WNGSR, COT Disaggregated, WASDE, Crop Progress, Export Sales i STEO. To pokrycie przyjętych kanałów, nie wszystkich publikacji EIA, USDA czy CFTC w internecie. Dataset, rodzina wskaźników i wydanie raportu są odrębnymi poziomami.

Słownik obejmuje **467 definicji pól** i **1552 dokładne powiązania ze źródłami**: 388 wystąpień miar i 892 wymiarów EIA oraz 272 pól commodities.sh. Zachowano identyfikatory 174 pozycji wcześniejszego katalogu biznesowego. Każdą relację można odtworzyć w JSON; wszystkie identyfikatory dokumentacji i dowodów mają rozwinięcie w arkuszu Źródła i API.

## Co rzeczywiście sprawdzono LIVE

- Przyjęty pełny snapshot metadanych pochodzi z 6 listopada. Pięć nowych, autoryzowanych odczytów przez SourceHub 9 listopada potwierdziło korzeń EIA, katalog i OpenAPI agregatora oraz dwa słowniki trasy `petroleum/stoc/wstk`. Native Source receipts potwierdzają pięć odpowiedzi HTTP 200. Niezmienione metadane nie oznaczają ponownego sprawdzenia wszystkich tras.
- Dwa pełne słowniki tej jednej trasy zawierają **33 produkty i 11 obszarów**. Pozostałych słowników wymiarów nie enumerowano. Obszar nie musi być krajem, a etykiety `NA` pozostają nieopisane.
- Ponownie wykorzystano [utrwalony dowód Stage 01](https://github.com/profitia/project-history-repository/blob/7109e35247efca628664534eaae441c215dfe146/history/2026/11/09/2026-11-09-20-00-08Z__architecture-architecture-ecr-stage01-schedule-sources-20261109/handoff.md): sześć harmonogramów agregatora, pięć terminów WPSR w sprawdzonym oknie oraz dwa wydania STEO, powtarzalne przed i po restarcie. Cztery terminy WPSR wynikały z reguły; jeden był oficjalnym wyjątkiem.
- Numeryczne LIVE to wcześniejsza próbka **3 obserwacji z jednej trasy EIA**. Nie potwierdzono wszystkich szeregów, historii ani wartości commodities.sh. W tym zadaniu nie pobierano nowych obserwacji i nie wykonywano płatnych zapytań.

## Możliwości UX i istotne granice

Macierz 20 możliwości odróżnia pola bezpośrednie, lokalną klasyfikację i przyszłe prace. Dane dają podstawy filtrowania po dostawcy, publikacji, zakresie dat i cykliczności, wyszukiwania nazw, sortowania z uwzględnieniem dokładności oraz szczegółów z provenance. Surowce i geografia wymagają jawnych słowników. Zapisywanie zestawów, obserwowanie i powiadomienia wymagają późniejszych preferencji ECR; nie są funkcją obecnej integracji.

W harmonogramach `actual`, `previous`, `forecast`, `publishedAt` i `sourceUpdatedAt` są puste. Brakuje przyjętej korelacji wydarzenie–wynik oraz historii rewizji. Projekcja STEO nie jest konsensusem rynkowym. Granice historii datasetu nie gwarantują pokrycia każdej serii.

Agregator daje daty bez potwierdzonej godziny. Zwyczajowa pora publikacji nie ustanawia dokładnego timestampu. W sprawdzonym przypadku WPSR agregator podał dzień wcześniejszy od oficjalnego wyjątku EIA; zachowano oba dowody. Miniony plan nie potwierdza opublikowania wyniku.

Harmonogramy są odczytywane na żądanie przez SourceHub. Stały interwał odświeżania po stronie dostawców pozostaje niepotwierdzony; cykliczność raportu nie jest częstotliwością odświeżania API. Synchronizacji ECR nie uruchomiono.

**19 płatnych pozycji commodities.sh pozostaje nieaktywnych; dwie operacje mogą być stubami.** Wszystkie 14 grup ograniczeń opisano w arkuszu Luki.

JSON jest pochodnym widokiem [kanonicznego katalogu technicznego](../catalog/commodities-capabilities-v1.json) i [wcześniejszej inwentaryzacji biznesowej](../catalog/commodities-business-inventory-v1.json), ze wskazaniem ich SHA-256. Nie zastępuje kontraktów ani rejestrów. Zachowano retencję 0: nowe artefakty utrwalają dozwolone metadane i dowody, bez instancji kalendarza, wartości obserwacji i sekretów. Nie zmieniono runtime, grantów, baz ani deploymentów.
