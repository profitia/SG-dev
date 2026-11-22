# Karta Projektu BSDC — ZSRIR w Benchmark Finder

| Pole | Wartość |
|---|---|
| initiativeId | BSDC-20261122-ZSRIR-BENCHMARK-FINDER |
| projectKey / profil prowadzący | SG2 / SG Runtime |
| Rewizja i data | v0.3-D1, 22.11.2026 — zapis decyzji właściciela do v0.3 |
| Status projektu i roadmapy | WORKING / NOT_ACCEPTED |
| Właściciel decyzji biznesowej | Właściciel SG2 |
| Repozytorium i authority | profitia/SG-dev, main |
| Ścieżka Karty | Canon/proposals/bsdc/SG2/BSDC-20261122-ZSRIR-BENCHMARK-FINDER.md |
| Rewizja źródeł audytu v0.2 | f75c6a5a170dd4b6597f67ab9790722657a1ef35 |
| Status rewizji Karty | Do końcowej akceptacji projektu i roadmapy. Podstawa v0.3 na main `e840afed5935ffcc5afd6ba7d9597b0ffcd06616`. |
| Środowisko pierwszego pełnego odbioru | Development — do potwierdzenia przy akceptacji roadmapy |
| Mandat | DESIGN / REVIEW / PERSISTENCE. E1, E2 i E3 NIE_ROZPOCZĘTE. |

## 1. Cel biznesowy i zakres

Użytkownik Benchmark Finder wyszukuje notowania cenowe MRiRW, odczytuje historię i widzi kolejne wartości po automatycznym odświeżeniu. Przyjęta obserwacja zachowuje rodzaj ceny, jednostkę, okres i odtwarzalne pochodzenie. ZSRIR jest drugim dostawcą Findera, obok Macrobond.

Zakres v1 obejmuje jeden wystandaryzowany CSV historii, jednorazowe zasilenie istniejącego Dynamic Market Data Store w Neon, aktualizację przyrostową oraz wyszukanie, podgląd historii i zapisanie serii ZSRIR w Finderze. Szczegóły prezentacji Advanced Search podlegają uzgodnieniu w E3. Semantyka dostawcy i facetów jest warunkiem importu. Prognozy i AI Search dla ZSRIR, PDF-only/OCR, inne moduły SG2, osobny panel administracyjny oraz nowy runtime, aplikacja lub pakiet pozostają poza zakresem v1.

## 2. Dowody i pokrycie danych

| Dowód | Ustalenie |
|---|---|
| Inwentaryzacja Gov.pl z 22.11.2026, arkusze Excel Gov.pl, Paczki Gov.pl i Excel w paczkach | 3 210 wystąpień linków, 3 206 różnych URL do Excela, 56 paczek i 1 332 pozycje Excel w paczkach. Gov.pl obejmuje dwie strony nawigacji, osobne strony wydań i archiwa. |
| Inwentaryzacja ZSRIR, arkusze Excel ZSRIR i Formularze ZSRIR | 1 245 XLSX w 16 katalogach. Skrajne okresy plików to 01.01.2024–15.11.2026. Przegląd danych udostępnia 15 rynków i 54 formularze. Pokrycie jest różne dla poszczególnych serii. |
| Próby pobrania | 56 testów, w tym otwarcie 54 plików XLSX i potwierdzenie formatu dwóch XLS. Stwierdzono kopie między katalogami i portalami. Eksport na żądanie potwierdzono dla rzepaku. Test tej serii za I kwartał 2003 r. nie zwrócił wartości. |
| Odczyt Neon Development i audyt kodu SG-dev | Istnieją tabele serii i obserwacji z identyfikacją dostawcy. W chwili audytu 514 serii miało kod MACROBOND. Kontrolowany zapis, widoki historii i słowniki Findera są powiązane z Macrobond. |

Liczebność plików nie jest liczebnością obserwacji. Pakiet odtwarzalnych dowodów E1 ma zawierać wersję wykazu, datę odczytu, sumy kontrolne i próbki. Karta zawiera referencje do rzeczywiście opublikowanych dowodów. [Gov.pl — katalog](https://www.gov.pl/web/rolnictwo/biuletyny-informacyjne) · [Strona 2](https://www.gov.pl/web/rolnictwo/biuletyny-informacyjne?page=2&size=10) · [Archiwum](https://www.gov.pl/web/rolnictwo/archiwalne-notowania) · [Wykaz ZSRIR](https://zsrir.minrol.gov.pl/api/ZsrirData/GetReportList) · [Przegląd danych](https://zsrir.minrol.gov.pl/data)

**Pełne pozyskanie.** Maksymalnie kompletny zrzut dostępnych danych historycznych MRiRW ze źródeł rozpoznanych na Gov.pl i w portalu ZSRIR. Każda pozycja discovery ma stan, metadane, pochodzenie, wersję lub skrót, gdy dostępne, oraz wynik kontroli kompletności pobrania. Niedostępne pozycje i formaty wymagające odrębnego mechanizmu, np. OCR, pozostają w wykazie ze statusem do oceny.

**Zbiór przejściowy.** Zachować odtwarzalne dane oraz identyfikatory źródeł i przypadków problematycznych. Luki, nietypowe okresy, brakujące wartości lub metadane, sprzeczne obserwacje, kopie i niejednoznaczne daty publikacji pozostają dostępne do analizy. Brak ciągłości szeregu sam w sobie nie stanowi przesłanki wyłączenia.

**Analiza jakości.** Rozliczyć 100% pozycji wykazu, wskazując pokrycie, luki, duplikaty, korekty i niejednoznaczności według rodziny i źródła. Przedstawić wyniki i rekomendacje rozstrzygnięć przed kwalifikacją. Rodziny z audytu obejmują drób, jaja, mleko, wieprzowinę, wołowinę i cielęcinę, baraninę, zboża, rośliny oleiste i wysokobiałkowe, owoce, warzywa, cukier, chmiel, pasze i tytoń.

**Kwalifikacja i CSV.** Dopiero po analizie i udokumentowanych decyzjach o wyłączeniach przygotować jeden wystandaryzowany CSV zgodny z przyjętym kontraktem. Wyniki kwalifikacji muszą dać się powiązać ze zbiorem przejściowym lub manifestem. W zaakceptowanym CSV obowiązuje zero podwójnych kluczy, osieroconego pochodzenia i nierozstrzygniętych konfliktów. Odtwarzalny zrzut i zbiór przejściowy zachowują dane potrzebne do oceny tych przypadków.

## 3. Decyzje właściciela i governance

### DEC-01 — lokalizacja ZSRIR w SG Runtime / Market Data

Wiążąca decyzja właściciela z 22.11.2026, w mandacie DESIGN / REVIEW / PERSISTENCE. ZSRIR należy wyłącznie do SG Runtime / Market Data w profilu SG2. Konektor jest w istniejącym lib/benchmark, logika normalizacji i aktualizacji w lib/market-data, model trwałego zapisu w prisma-market-data, a wyszukiwanie, filtry, podgląd i zapisane serie w Finderze. Integracja reużywa platformowy Source/external-call stosowany przez Macrobond. Kompetencje nad transportem, E1, przyjęciem Source i współdzielonymi kontraktami pozostają u ich obecnych ownerów. Decyzja wiąże kierunek Karty, a akceptacja rewizji projektu i roadmapy pozostaje osobnym zdarzeniem.

### Decyzje właściciela z 22.11.2026

| ID | Status | Ustalenie |
|---|---|---|
| DEC-02 — Historia v1 | ZATWIERDZONA Z KOREKTĄ | Pełne pozyskanie i zbiór przejściowy poprzedzają analizę, decyzje kwalifikacyjne i jeden CSV importowy zgodnie z sekcją 2. Wyłączenie z importu wymaga udokumentowanej przesłanki i decyzji właściwego właściciela. |
| DEC-03 — Odcięcie | ZATWIERDZONA | Pierwszy wsad obejmuje publikacje źródłowe do **22.11.2026, 23:59:59, Europe/Warsaw** włącznie. Data pobrania i okres notowania mają odrębne znaczenie. Niejasne daty pozostają w zbiorze przejściowym do kwalifikacji. Późniejsze publikacje i korekty podlegają uzupełnieniu przed zwykłym cyklem. |
| DEC-04 — Świeżość | ZATWIERDZONY KIERUNEK | Harmonogramy i kryteria wynikają z pomiaru publikacji w E1. SLA ma status `DO_USTALENIA_NA_PODSTAWIE_DANYCH`. Odbiór obejmuje rzeczywistą publikację przeprowadzoną automatycznie do Findera. |
| DEC-05 — Finder v1 | ZATWIERDZONA | Wyszukiwanie serii ZSRIR, jednoznaczna identyfikacja dostawcy, podgląd i odczyt historii oraz zapis serii. ZSRIR to dostawca, MRiRW to wydawca, a Gov.pl i portal ZSRIR to kanały publikacji. Kategorie są odrębne od dostawcy. Dane żywnościowe mają kategorię `FOOD`, a pasze i tytoń `COMMODITIES` z etykietą Commodities. Przypadki niejednoznaczne rozstrzyga mapowanie rodziny i miary. Kontrakt i znaczenie facetów uzgodnić przed importem, a prezentację Advanced Search ustalić w E3. |
| Środowisko pełnego odbioru | PROPOZYCJA | Development pozostaje propozycją z v0.3 do potwierdzenia przez właściciela. |

### GOV-01 — punkt do uzgodnienia przed wykonaniem

Aneks GOV-01 v0.1 ma status `PROPOSED / NOT_ACTIVE`. Do zamknięcia wymagane są decyzje Governance Source Layer i Architecture Platform oraz kontrolowana aktywacja. [GOV-01 #1285](https://github.com/profitia/SG-dev/issues/1285)

Aktywny Kanon Source Hub v1.0, §1 i tabela odpowiedzialności w wierszach 10–18, przypisuje Architecture Platform / Source Hub adaptery dostawców i pozyskiwanie zewnętrzne. Benchmark Domain / Market Data posiada serie kanoniczne, przyjęte dane rynkowe i odpowiedzialność za Macrobond. Nowela v1.1, wiersze 7–9 i 17–27, rozszerza dostęp konsumentów do przyjętych kontraktów Hub, utrzymuje odpowiedzialność Hub za pozyskiwanie odpłatne i dostęp do dostawców oraz zachowuje dotychczasowe granice Benchmark/Macrobond. Przegląd tych zasad nie wykazał jawnego umocowania nowego ZSRIR poza Hub. Istniejące umocowanie Macrobond nie przenosi się automatycznie na nowe źródło. [Kanon Source Hub v1.0, §1](https://github.com/profitia/SG-dev/blob/f75c6a5a170dd4b6597f67ab9790722657a1ef35/Canon/v1.0-platform-source-hub-business-and-architecture-canon.md#L8-L20) · [Nowela dostępu v1.1](https://github.com/profitia/SG-dev/blob/f75c6a5a170dd4b6597f67ab9790722657a1ef35/Canon/v1.1-platform-source-hub-universal-first-party-consumer-access.md#L7-L27)

**Minimalne uzgodnienie do odrębnej akceptacji.** Governance Source Layer wraz z Architecture Platform oraz SG Runtime potwierdzają wiążący sposób zastosowania obowiązującej normy. Jeśli obecny zapis nie obejmuje decyzji DEC-01, przedłożyć wąską zmianę albo wyjątek normatywny dotyczący wyłącznie ZSRIR jako dostawcy SG2, poza Source Hub, z reużyciem transportu, źródłową atrybucją i kontrolami E1. Odrębnie uzyskać dopuszczenie dokładnych operacji, powierzchni zewnętrznych, roli i zakresu źródła. Wniosek o zmianę normy i dopuszczenie wykonania pozostają odrębnymi decyzjami. Do rozstrzygnięcia GOV-01 obowiązuje STOP dla zależnego pozyskiwania wykonywanego przez nowy konektor i jego wdrożenia. Kierunek DEC-01 pozostaje wiążący dla Karty.

## 4. Architektura, routing i integracja wielodostawcowa

### 4.1. Drzewo monorepo

~~~text
profitia/SG-dev
├── apps/sg-runtime/                              [SG Runtime / SG2]
│   ├── lib/benchmark/
│   │   ├── macrobond.ts                          [ISTNIEJE / BEZ REGRESJI]
│   │   ├── zsrir.ts                              [NOWY / PROPOZYCJA]
│   │   ├── contracts.ts                          [ROZSZERZENIE]
│   │   └── service.ts                            [ROZSZERZENIE]
│   ├── lib/market-data/
│   │   ├── history-ingestion.ts                  [WZORZEC REUSE]
│   │   ├── service.ts                            [REUSE / ROZSZERZENIE]
│   │   ├── stored-read.ts                        [REUSE / ROZSZERZENIE]
│   │   └── zsrir-import.ts                        [NOWY / PROPOZYCJA]
│   ├── prisma-market-data/                       [MODEL I MIGRACJE]
│   ├── app/api/benchmark/                        [INTEGRACJA API]
│   └── components/benchmark-finder/              [INTEGRACJA FINDER]
└── Canon/proposals/bsdc/SG2/
    └── BSDC-20261122-ZSRIR-BENCHMARK-FINDER.md       [KARTA]
~~~

Wzorzec apps/sg-runtime/** ma właściciela SG Runtime, profil SG2, SG2-BASE-001 / ALIGNED. Ścieżka Karty ma Governance Source Layer, SG2-BASE-019 / ALIGNED, z dopuszczonym SG2. Przed wykonaniem sprawdzić dokładny zestaw plików i wybrać najmniejsze rozszerzenie istniejących funkcji. W v0.2 osobny workflow .github/workflows/zsrir-refresh.yml zwrócił NO_MATCH. W pierwszej kolejności zweryfikować istniejący mechanizm zadań i jego dopuszczenie. Proponowane nowe pliki są oznaczone w drzewie. [Rejestr routingu](https://github.com/profitia/SG-dev/blob/main/Canon/registries/current-architecture-baseline-v1.json)

### 4.2. Powierzchnie Macrobond i zachowanie zgodności

| Powierzchnia | Potwierdzony stan i kierunek rozszerzenia |
|---|---|
| Kontrakty i discovery | lib/benchmark/contracts.ts ma tylko MACROBOND. discovery-operation.ts używa literału dostawcy i pojedynczych identyfikatorów w części komend. Zachować dotychczasowe żądania i dodać wersjonowaną, jawną obsługę ZSRIR. |
| Wyszukiwanie, kontekst, Source | service.ts używa Macrobond do wyszukiwania, metadanych i kontekstu. discovery-api.ts, discovery-http.ts, discovery-runtime.ts, discovery-source.ts i provider-scope.ts wiążą ścieżkę z obecnymi dostawcami i polityką transportu. ZSRIR wyszukuje przyjęty katalog. Pobranie MRiRW korzysta z przyjętej operacji Source/external-call, z własną tożsamością źródła i dowodem. |
| Kontrolowany odczyt | preview-handlers.ts, analytics-handlers.ts, lib/platform/market-preview.ts i private-host.ts używają pojedynczego ID w żądaniu, zasobie lub walidacji. Projekcja rozpoznaje MACROBOND. Dodać kontrolowany wariant ZSRIR z parą dostawca–seria w zasobie, zapytaniu i odpowiedzi. |
| Historia i zapis | lib/market-data/service.ts, history-contract.ts, history-source.ts, history-runtime.ts i history-ingestion.ts są związane z Macrobond. W private-write/003-market-history.sql zapis wymaga zasobu i potwierdzenia wywołania Macrobond. stored-read.ts i private-read/001-stored-history-read.sql filtrują Macrobond. Zachować ścieżkę Macrobond i użyć istniejącego mechanizmu bezpieczeństwa z odrębną, dopuszczoną operacją dla ZSRIR. |
| Zapisane serie | selection-handlers.ts waliduje Macrobond literalnie. repository.ts zapisuje dostawcę, lecz odtwarza część wyników jako Macrobond. prisma/schema.prisma ma unikatowość organizacja–dostawca–seria. Reużyć klucz i zapewnić odczyt rzeczywistego mapowania ZSRIR. |
| Facety, klient i konsumenci | metadata-store.ts i private-read/003-metadata-discovery.sql używają słownika Macrobond. metadata-prefetch.ts, benchmark-finder-client.tsx i picker wymagają kontroli kluczy cache, zasobów i porównań ID. W E3 sprawdzić kwalifikację i zakres analityki oraz zachować obecne kontrakty Category Builder, Forecast i innych konsumentów. |

Kontrakt v1 przyjmuje parę providerCode i providerSeriesId w wyszukiwaniu, cache, zapisanym wyborze i zasobie odczytu. Dotychczasowa semantyka żądań Macrobond zostaje zachowana. ZSRIR używa odrębnego słownika, proponowane facety to rynek lub towar, rodzaj ceny, geografia, częstotliwość i kategoria SG2. Kategoria biznesowa nie jest kategorią definicji facetu ani kategorią Macrobond. Brak lub niedostępność filtra mają jawny stan. Semantykę i zakres filtrów uzgodnić przed importem. Decyzja o ich prezentacji w Advanced Search przypada na projekt integracji E3.

[Kontrakt discovery](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/benchmark/discovery-operation.ts) · [Odczyt](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/market-data/stored-read.ts) · [Zapis](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/prisma-market-data/private-write/003-market-history.sql) · [Zapisane serie](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/benchmark/repository.ts)

## 5. Trwały model danych, CSV i harmonogram

**Zapis.** Preferowane jest addytywne użycie market_series i market_observations w istniejącym Dynamic Market Data Store, z uzupełnieniami dla kategorii, okresu, źródeł i rewizji. Użyć istniejącej identyfikacji dostawca–seria oraz wspólnego kontrolowanego mechanizmu zapisu i odczytu. Staging wsadu i publikacja mają mieć odrębne, zawężone uprawnienia ZSRIR. Próba przed importem potwierdza izolację, kompatybilność Macrobond, transakcyjność i odtworzenie. Jeśli udokumentowana kolizja okresów, wymaganie retencji lub uprawnień uniemożliwi bezpieczne rozszerzenie, przygotować uzasadnienie i uzyskać akceptację przed wprowadzeniem osobnego schematu lub magazynu. [Model Market Data](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/prisma-market-data/schema.prisma#L28-L76)

**Klucz logiczny do zatwierdzenia przed importem.** Stabilny identyfikator serii reprezentuje dostawcę, towar i wariant, rodzaj ceny, geografię, częstotliwość oraz porównywalną jednostkę i walutę. Proponowany klucz obserwacji to (provider_code, provider_series_id, period_start, period_end). observed_at jest polem zgodności odczytu, typowo równym końcowi okresu. Przy takiej samej dacie końcowej i różnych początkach zachowujemy różne okresy, chyba że źródło potwierdza zmianę granic jako korektę tej samej obserwacji. Jeżeli oba okresy są zasadne, obecny unikatowy klucz (seriesId, observedAt) sam ich nie pomieści. E2-T01 sprawdza addytywne rozwiązanie ze zgodnością istniejących odczytów, zanim zależny import zostanie uruchomiony.

**Kontrakt jednego CSV.**

~~~csv
provider_code,provider_series_id,category_code,display_name,market_code,product_code,metric_code,geography_code,frequency,unit,currency,period_start,period_end,observed_at,value,provenance,normalization_version
~~~

UTF-8, przecinek, jednoznaczne cytowanie i kodowanie braków, daty ISO oraz wartości porównywalne z numeric(24,8). Sortować po kluczu logicznym. Stałe wejścia i wersja mapowania dają te same bajty. Jeden wspólny normalizator obsługuje historię i aktualizacje. Czas pobrania należy do dowodu wsadu. Data publikacji zachowuje odrębne znaczenie w każdym wpisie pochodzenia. Zachować precyzję i strefę, jeżeli podaje je źródło.

**Pochodzenie i korekty.** Każdy wiersz zawiera deterministycznie uporządkowaną listę źródeł z plikiem, pozycją lub parametrami eksportu, datą publikacji i skrótem lub identyfikatorem wersji, gdy dostępne. Identyczne pliki rozpoznawać po skrócie. Zgodne obserwacje scalać po kluczu i przeliczonej wartości z zachowaniem źródeł. Rozbieżność wymaga reguły pierwszeństwa, a potwierdzona korekta zachowuje poprzednią wartość, dowód i aktualną rewizję. Niewyjaśniony przypadek zatrzymuje przyjęcie obserwacji. Klucz, identyfikator wsadu oraz historia rewizji wspierają idempotentne ponowienie i równoległe cykle.

**Harmonogram.** Reużyć zatwierdzony mechanizm zadań, jeśli spełnia warunki. W E1 profilować rzeczywistą kadencję publikacji według rodzin, rynków i typów raportu, odstęp od końca okresu do publikacji, sezonowość, nieregularność, opóźnione wydania, korekty i uzupełnienia. Osobno sprawdzić, kiedy nową publikację lub rewizję można wykryć względem częstotliwości notowań. Na podstawie pomiarów i udokumentowanych luk w datach zaproponować harmonogram lub harmonogramy, lookback, sposób pomiaru oraz mierzalny cel świeżości dla właściwych źródeł. SLA pozostaje `DO_USTALENIA_NA_PODSTAWIE_DANYCH`. Przyjęte harmonogramy, strefy czasowe, lookback i kryteria świeżości mają jedno edytowalne miejsce w backendzie. Raportować ostatnie skuteczne odświeżenie, najnowszy dostępny okres, nowe dane, korekty i błędy. Zachować ostatnie poprawne dane podczas awarii i rozróżniać przerwę sezonową od awarii.

## 6. Checklista BSDC v1.1

| ID | Status | Ustalenie / dowód lub otwarta kwestia |
|---|---|---|
| A1 | USTALONE | Użytkownik Finder potrzebuje historii i bieżących danych MRiRW. |
| A2 | USTALONE | SG2 prowadzi, właściciel SG2 akceptuje, użytkownik Finder odbiera. |
| A3 | W_TRAKCIE | Reguła pozyskania, odcięcie i zakres Findera zatwierdzone. SLA z E1. Środowisko pełnego odbioru do decyzji. |
| A4 | USTALONE | Jedna inicjatywa od historii do odczytu bieżących notowań. |
| B1 | USTALONE | Zweryfikowano ustalenia wcześniejszych audytów portalu i Neon oraz aktualne źródła kodu i governance. |
| B2 | USTALONE | Dowody, założenia i luki pokrycia opisano osobno. |
| B3 | USTALONE | DEC-01 rozstrzyga lokalizację. Model zapisu preferuje addytywne użycie istniejącej bazy. |
| B4 | W_TRAKCIE | Potwierdzić minimalne rozszerzenia, klucz i regresję w próbie modelu zapisu. |
| C1 | W_TRAKCIE | Przepływ od zrzutu do Findera i zakres funkcji v1 ustalone. Prezentacja Advanced Search do uzgodnienia w E3. |
| C2 | W_TRAKCIE | Zasady kopii, korekt i okresów opisane. Zatwierdzić mapowania i konflikty. |
| C3 | USTALONE | Zakres pozyskania i funkcji v1 potwierdzony w DEC-02 i DEC-05. Kwalifikacja danych następuje po analizie. |
| C4 | DO_USTALENIA | Zweryfikować aktualne wzorce Advanced Search i ich rzeczywiste powiązania przed zmianą UI. |
| C5 | W_TRAKCIE | FINAL-01–05 przygotowane. Odbiór do potwierdzenia. |
| D1 | USTALONE | DEC-01 wyznacza wyłącznego ownera SG Runtime / Market Data. |
| D2 | W_TRAKCIE | Resolver potwierdził ścieżkę Karty i proponowane ścieżki zsrir.ts oraz zsrir-import.ts. Pełny zestaw zmian wymaga sprawdzenia przed wykonaniem. |
| D3 | USTALONE | Drzewo i granice ownership opisane zgodnie z DEC-01. |
| D4 | W_TRAKCIE | Kontrakt wielodostawcowy i CSV opisane. GOV-01 oraz dokładny kontrakt Source i odczytu do zamknięcia. |
| D5 | W_TRAKCIE | Dane publiczne z atrybucją. Potwierdzić warunki użycia, role, Source i E1 przed operacjami. |
| D6 | W_TRAKCIE | Odtworzenie, monitoring i harmonogram opisane. Wolumen, czas i koszt po próbie. |
| E1 | W_TRAKCIE | Trzy etapy rezultatowe. |
| E2 | W_TRAKCIE | Taski i DoD rozpisane w tej Karcie. |
| E3 | W_TRAKCIE | Własność SG2 i odrębne uprawnienia współdzielone zapisane. |
| E4 | W_TRAKCIE | Próby importu, izolacji, korekt, odbioru funkcji i regresji w FINAL. |
| E5 | DO_USTALENIA | Koszty i rzeczywisty wolumen po kwalifikowanej próbie. |
| E6 | W_TRAKCIE | Roadmapa w tej Karcie uwzględnia decyzje właściciela, zależności kwalifikacji i świeżości oraz ewidencję etapów. Oczekuje na wspólną akceptację z projektem. |
| F1 | W_TRAKCIE | DEC-01–05 zapisane. GOV-01, środowisko odbioru i parametry do ustalenia w E1 jawnie otwarte. |
| F2 | W_TRAKCIE | Domknąć governance, kontrakt i zakres odbioru. |
| F3 | DO_USTALENIA | Właściciel akceptuje wspólnie projekt i roadmapę na dokładnym commicie. |
| F4 | W_TRAKCIE | Punkt wznowienia i granice wykonania zapisane. |

## 7. Roadmapa E1–E3, DoD i rejestr

Proponowany pierwszy pełny odbiór w Development. Wszystkie poniższe taski prowadzi SG2 / SG Runtime. Ownerzy mechanizmów współdzielonych zatwierdzają użycie lub zmianę swoich kontraktów we właściwym zakresie. Wykonanie w zatwierdzonym środowisku chmurowym. Każdy etap wymaga osobnego mandatu i rozliczenia. Wstrzymanie dotyczy blokowanego zakresu aktywnego etapu, a kolejny etap wymaga nowej dyspozycji.

| Etap / task | Rezultat, zależność i DoD / dowód |
|---|---|
| **E1 — kontrakt i kompletna historia w CSV** | Pełne pozyskanie z discovery, odtwarzalny zbiór przejściowy, raport jakości i kadencji, decyzje kwalifikacyjne oraz jeden wersjonowany CSV do granicy DEC-03. STOP dla zależnego odczytu przy otwartym GOV-01 lub braku dopuszczenia Source. Przed zatwierdzeniem CSV wymagane są przyjęty kontrakt i rozstrzygnięcia dotyczące problematycznych danych. |
| E1-T01 | Ustalić zakres discovery i manifestu, warunki użycia MRiRW oraz szkic kontraktu wielodostawcowego, znaczenia facetów i klucza obserwacji. Zależność od mandatu E1 po akceptacji Karty. Dowód wersji kontraktu i planu pozyskania oraz mapowania i przykłady okresów do weryfikacji w E1-T03. |
| E1-T02 | Wykonać maksymalnie kompletny zrzut rozpoznanych źródeł z manifestem, metadanymi, pochodzeniem i kontrolą kompletności. Zbudować odtwarzalny zbiór przejściowy z przypadkami wymagającymi oceny. Zależności E1-T01 w części źródeł, GOV-01 oraz dopuszczenie Source dla zależnego pozyskiwania. Dowód rozliczenia wykazu, skróty wersji i próbki odtwarzalne według rodzin. |
| E1-T03 | Przeanalizować jakość i pokrycie oraz kadencje publikacji zgodnie z sekcją 5. Przedstawić rekomendacje kwalifikacji, harmonogramów, lookback i SLA. Po decyzjach kwalifikacyjnych i zatwierdzeniu kontraktu, klucza i znaczenia facetów przygotować jeden CSV według DEC-03. Zależności E1-T01/T02. Dowód raportów, decyzji o wyłączeniach, walidacji typów, kluczy i pochodzenia oraz powtarzalnego skrótu CSV. |
| **E2 — import Neon i cykliczne przyrosty** | Historia w istniejącym Neon oraz zaakceptowany cykl ZSRIR. STOP przy nierozwiązanej kolizji okresów, braku rozdzielenia ról, niezgodności readback, wpływie na Macrobond albo braku dopuszczenia migracji lub odtworzenia. |
| E2-T01 | Zweryfikować minimalny addytywny model i klucz fizyczny na dopuszczonym celu testowym. Zależności odebrane E1, przyjęty kontrakt i mandat E2. Dowód próby migracji, powtarzalności, kolizji dat, odtworzenia i negatywnego testu ról, z decyzją ownera bazy. |
| E2-T02 | Załadować jeden zaakceptowany CSV do istniejącej gałęzi Neon Development i wykonać readback. Zależności E2-T01, raport i decyzje kwalifikacji E1, spójność z odcięciem DEC-03, przyjęte kontrakt i facety oraz dopuszczenie importu. Dowód liczebności, próbek, pochodzenia, digestu wsadu i regresji danych Macrobond. |
| E2-T03 | Przyjąć konfigurację harmonogramów, lookback i kryteria świeżości na podstawie E1. Przygotowanie może biec równolegle z E2-T01. Po E2-T02 uzupełnić późniejsze publikacje i korekty zgodnie z DEC-03, a następnie uruchomić zwykły cykl w zaakceptowanym mechanizmie zadań. Dowód uzupełnienia, zmiany konfiguracji bez zmiany kodu, obsługi opóźnień i korekt, ponowienia bez duplikatu i powrotu po awarii. |
| **E3 — ZSRIR w Finderze i odbiór END-TO-END** | Działające wyszukiwanie, odczyt historii i pojawienie się nowego notowania w Finderze, z kompletem regresji Macrobond. STOP przy kolizji tożsamości lub regresji, błędzie uprawnień albo braku dopuszczenia wydania. Brak rzeczywistego nowego notowania pozostawia FINAL-03 nieodebrane. |
| E3-T01 | Ustalić prezentację Advanced Search i udostępnić wyszukiwanie, podgląd i zapisane serie w ramach przyjętego kontraktu. Zależność odebrane E2, mandat E3 i decyzja o UI przed zmianą. Dowód testów faktycznych powiązań, tożsamości dwóch dostawców, dostępu i facetów. |
| E3-T02 | Wykonać rzeczywisty odbiór FINAL na dopuszczonej wersji i środowisku. Zależność E3-T01, zgoda na wydanie i nowa publikacja MRiRW. Dowód pełnego śladu publikacja → cykl → Neon → Finder oraz odbioru właściciela. |

### Końcowy Business DoD

| ID | Warunek | Dowód |
|---|---|---|
| FINAL-01 | Zakwalifikowana historia zgodna z DEC-03 znajduje się w istniejącym Neon i odpowiada zaakceptowanemu CSV. Źródła, przypadki problematyczne i wyłączenia są rozliczone. | Manifest, zbiór przejściowy, raport jakości i decyzje kwalifikacyjne, skrót CSV oraz uzgodnienie liczebności i próbek źródło–CSV–Neon. |
| FINAL-02 | Ponowienia i korekty zachowują okres, tożsamość i historię źródeł. | Test nakładających się cykli, identycznych bajtów, korekty i kolizji dostawców oraz okresów. |
| FINAL-03 | Co najmniej jedna rzeczywista nowa publikacja MRiRW przechodzi przez automatyczny cykl do Neon i jest odczytywana w Finderze zgodnie z przyjętymi w oparciu o E1 kryteriami danego źródła. | Identyfikator i czas publikacji oraz wykrycia, konfiguracja i wykonanie cyklu, czas odczytu w Neon i Finderze oraz porównanie z przyjętym kryterium. |
| FINAL-04 | Uprawniony użytkownik wyszukuje rzeczywistą serię ZSRIR, odczytuje historię i potrafi zapisać serię. | Przyjęty Advanced Search, widoczny dostawca, okres i jednostka, sprawdzalne pochodzenie, test odmowy poza uprawnieniem. |
| FINAL-05 | Macrobond przechodzi regresję, a awaria ZSRIR nie odbiera dostępu do ostatnich poprawnych danych. | Scenariusze wyszukiwania, facetów, historii i zapisów Macrobond, kontrola odizolowania zapisu ZSRIR, dowód świeżości i powrotu po awarii. |

Wszystkie FINAL mają status DO_POTWIERDZENIA. Terminy, koszty i przepustowość DO_OSZACOWANIA po kwalifikowanej próbie. Jeśli odbiór ma obejmować Staging lub Production, do zaakceptowanej rewizji włączyć właściwe kryteria wydania, mandaty i dowody dla tych środowisk.

### Rejestr wykonania

| ID | Status | Owner / profil | Daty, taskId, PR/SHA, CI, wydanie, testy i dowody |
|---|---|---|---|
| E1 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E1-T01 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E1-T02 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E1-T03 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E2 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E2-T01 | NIE_ROZPOCZĘTY | SG Runtime / SG2, owner bazy | — |
| E2-T02 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E2-T03 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E3 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E3-T01 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E3-T02 | NIE_ROZPOCZĘTY | SG Runtime / SG2, właściciel odbioru | — |

Po istotnych decyzjach i rozliczeniu tasku lub etapu aktualizować ten sam plik, z następnym krokiem i brakami. Dla SG2 Development zachować właściwe PMOS, MEMOROS i PHR. Opublikowane pakiety PHR w history/ potwierdzać odczytem i linkować z Karty. Pełne dane i CSV pozostają w zatwierdzonym środowisku chmurowym. Dowody zawierają ograniczone przykłady, digests i fakty wymagane do odbioru. [Profil SG2](https://github.com/profitia/SG-dev/blob/main/Canon/adapters/sg2-project-adapter-v1.md) · [PHR](https://github.com/profitia/project-history-repository/tree/main/history/) · [Wrapper wykonawczy](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/profitia-universal-project-execution-v1.2.md)

## 8. Otwarte sprawy i wznowienie

1. Właściciel SG2 potwierdza środowisko pierwszego pełnego odbioru. Development pozostaje propozycją.
2. Governance Source Layer i Architecture Platform rozstrzygają [GOV-01 #1285](https://github.com/profitia/SG-dev/issues/1285). Aktywacja wymaga osobnej kontrolowanej decyzji z zachowaniem DEC-01.
3. Po osobnym uruchomieniu E1 właściciel rozstrzyga kwalifikację problematycznych danych i zatwierdza kontrakt, klucz oraz semantykę facetów przed importem. Harmonogramy, lookback i mierzalne SLA ustala na podstawie dowodów E1. Prezentację Advanced Search rozstrzyga w E3.
4. Właściciel akceptuje wspólnie projekt i roadmapę z dokładnego commita. Po decyzji zamrozić przyjęty zakres i DoD. Późniejsze aktualizacje rejestru nie zmieniają zaakceptowanej treści. E1 wymaga osobnej wyraźnej dyspozycji.

**Punkt wznowienia.** Rewizja v0.3-D1 zapisuje DEC-02–05 przy zachowaniu DEC-01 i roadmapy E1–E3. Następny krok to końcowa recenzja i osobna decyzja F3 dla dokładnego commita oraz domknięcie otwartych uzgodnień. Bieżący mandat obejmuje wyłącznie dokumentację. E1, E2 i E3 są NIE_ROZPOCZĘTE. [Kanon BSDC v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md) · [Launcher](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/bsdc-launcher-v1.1.md)
