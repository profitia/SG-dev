# Karta Projektu BSDC — ZSRIR w Benchmark Finder

| Pole | Wartość |
|---|---|
| initiativeId | BSDC-20261122-ZSRIR-BENCHMARK-FINDER |
| projectKey / profil prowadzący | SG2 / SG Runtime |
| Rewizja i data | v0.3, 22.11.2026 |
| Status projektu i roadmapy | WORKING / NOT_ACCEPTED |
| Właściciel decyzji biznesowej | Właściciel SG2 |
| Repozytorium i authority | profitia/SG-dev, main |
| Ścieżka Karty | Canon/proposals/bsdc/SG2/BSDC-20261122-ZSRIR-BENCHMARK-FINDER.md |
| Rewizja źródeł audytu v0.2 | f75c6a5a170dd4b6597f67ab9790722657a1ef35 |
| Status rewizji Karty | Wersja do recenzji. Commit i blob zapisu podaje potwierdzony odczyt GitHub. |
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

**Kwalifikacja v1.** Rodziny kandydackie obejmują drób, jaja, mleko, wieprzowinę, wołowinę i cielęcinę, baraninę, zboża, rośliny oleiste i wysokobiałkowe, owoce, warzywa, cukier, chmiel, pasze i tytoń. Kwalifikuje się udokumentowana seria cenowa z towarem i wariantem, rodzajem ceny, geografią, częstotliwością, okresem i jednostką. Dane żywnościowe klasyfikuje się jako FOOD, a pasze i tytoń jako COMMODITIES z etykietą Commodities. Przypadki niejednoznaczne rozstrzyga mapowanie rodziny i miary. Dostawcą obu kategorii jest ZSRIR, MRiRW jest wydawcą, a Gov.pl i portal ZSRIR to kanały publikacji.

**Okno historii i próg kompletności.** Propozycja obejmuje najstarszy wiarygodny okres każdej kwalifikowanej serii do zatwierdzonej daty odcięcia. 100% pozycji wykazu ma udokumentowany stan przetworzenia, kopii, odrzucenia, wyłączenia lub niedostępności. Wszystkie kwalifikowane obserwacje ze zweryfikowanego wykazu mają znaleźć się w CSV lub mieć jawnie rozstrzygniętą przyczynę braku. Raport podaje mianowniki, pokrycie okresów, sezonowość i luki per rodzina. W przyjętym CSV obowiązuje zero podwójnych kluczy, osieroconego pochodzenia i nierozstrzygniętych konfliktów. Minimalne pokrycie rodzin i data odcięcia wymagają decyzji właściciela.

## 3. Decyzje właściciela i governance

### DEC-01 — lokalizacja ZSRIR w SG Runtime / Market Data

Wiążąca decyzja właściciela z 22.11.2026, w mandacie DESIGN / REVIEW / PERSISTENCE. ZSRIR należy wyłącznie do SG Runtime / Market Data w profilu SG2. Konektor jest w istniejącym lib/benchmark, logika normalizacji i aktualizacji w lib/market-data, model trwałego zapisu w prisma-market-data, a wyszukiwanie, filtry, podgląd i zapisane serie w Finderze. Integracja reużywa platformowy Source/external-call stosowany przez Macrobond. Kompetencje nad transportem, E1, przyjęciem Source i współdzielonymi kontraktami pozostają u ich obecnych ownerów. Decyzja wiąże kierunek Karty, a akceptacja rewizji projektu i roadmapy pozostaje osobnym zdarzeniem.

### GOV-01 — punkt do uzgodnienia przed wykonaniem

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

**Harmonogram.** Reużyć zatwierdzony mechanizm zadań, jeśli spełnia warunki. Jedno ustawienie backendowe obejmuje harmonogram, strefę, lookback i cel świeżości. Niedziela o 23:00 jest przykładem. Zmiana ustawień odbywa się bez zmiany kodu. Raportować ostatnie skuteczne odświeżenie, najnowszy dostępny okres, nowe dane, korekty i błędy. Awaria źródła zachowuje poprzednie dane i ujawnia ich aktualność. Pomiar świeżości uwzględnia faktyczne daty publikacji, a sezonowa przerwa ma odrębny stan od awarii.

## 6. Checklista BSDC v1.1

| ID | Status | Ustalenie / dowód lub otwarta kwestia |
|---|---|---|
| A1 | USTALONE | Użytkownik Finder potrzebuje historii i bieżących danych MRiRW. |
| A2 | USTALONE | SG2 prowadzi, właściciel SG2 akceptuje, użytkownik Finder odbiera. |
| A3 | W_TRAKCIE | Kryteria końcowe opisane. Pokrycie, próg świeżości i środowisko do potwierdzenia. |
| A4 | USTALONE | Jedna inicjatywa od historii do odczytu bieżących notowań. |
| B1 | USTALONE | Zweryfikowano ustalenia wcześniejszych audytów portalu i Neon oraz aktualne źródła kodu i governance. |
| B2 | USTALONE | Dowody, założenia i luki pokrycia opisano osobno. |
| B3 | USTALONE | DEC-01 rozstrzyga lokalizację. Model zapisu preferuje addytywne użycie istniejącej bazy. |
| B4 | W_TRAKCIE | Potwierdzić minimalne rozszerzenia, klucz i regresję w próbie modelu zapisu. |
| C1 | W_TRAKCIE | Przepływ historii, cyklu i Finder opisany. Uzgodnić prezentację w E3. |
| C2 | W_TRAKCIE | Zasady kopii, korekt i okresów opisane. Zatwierdzić mapowania i konflikty. |
| C3 | W_TRAKCIE | Granice i rodziny v1 są propozycją do akceptacji. |
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
| E6 | W_TRAKCIE | Jedna roadmapa, taski, zależności, rejestr, STOP i końcowy DoD. Do recenzji i akceptacji. |
| F1 | W_TRAKCIE | DEC-01, GOV-01 i otwarte decyzje utrwalone w projekcie. |
| F2 | W_TRAKCIE | Domknąć governance, kontrakt i zakres odbioru. |
| F3 | DO_USTALENIA | Właściciel akceptuje wspólnie projekt i roadmapę na dokładnym commicie. |
| F4 | W_TRAKCIE | Punkt wznowienia i granice wykonania zapisane. |

## 7. Roadmapa E1–E3, DoD i rejestr

Proponowany pierwszy pełny odbiór w Development. Wszystkie poniższe taski prowadzi SG2 / SG Runtime. Ownerzy mechanizmów współdzielonych zatwierdzają użycie lub zmianę swoich kontraktów we właściwym zakresie. Wykonanie w zatwierdzonym środowisku chmurowym. Każdy etap wymaga osobnego mandatu i rozliczenia. Wstrzymanie dotyczy blokowanego zakresu aktywnego etapu, a kolejny etap wymaga nowej dyspozycji.

| Etap / task | Rezultat, zależność i DoD / dowód |
|---|---|
| **E1 — kontrakt i kompletna historia w CSV** | Zatwierdzony kontrakt i kwalifikacja v1. Wersjonowany, odtwarzalny CSV z pokryciem i pochodzeniem. STOP dla zależnego odczytu przy GOV-01 lub braku Source. Brak klucza, semantyki facetów albo nierozstrzygnięty konflikt blokuje przyjęcie zależnych obserwacji. |
| E1-T01 | Domknąć kontrakt wielu dostawców, katalog facetów i klucz logiczny obserwacji, zakres, mapowania i warunki użycia MRiRW. Zależność od mandatu E1 po akceptacji Karty. Dowód wersji kontraktu, tabeli mapowań, przypadków okresów i decyzji właściciela. |
| E1-T02 | Odtworzyć kwalifikowane wejścia ZSRIR/Gov.pl i manifest pobrań w reużywanym mechanizmie. Zależność E1-T01 w części źródeł, GOV-01 i przyjęcie Source. Dowód zakresu i tożsamości źródła, hash i próbki odtwarzalne per rodzina. |
| E1-T03 | Przygotować jeden CSV, raport pokrycia i odrzuceń. Zależność E1-T01/T02. Dowód hash, walidacja typów i kluczy, ślad źródła każdej pozycji, porównanie próbek oraz identyczny wynik powtórzenia. |
| **E2 — import Neon i cykliczne przyrosty** | Historia w istniejącym Neon oraz zaakceptowany cykl ZSRIR. STOP przy nierozwiązanej kolizji okresów, braku rozdzielenia ról, niezgodności readback, wpływie na Macrobond albo braku dopuszczenia migracji lub odtworzenia. |
| E2-T01 | Zweryfikować minimalny addytywny model i klucz fizyczny na dopuszczonym celu testowym. Zależność odebrane E1 i mandat E2. Dowód próby migracji, powtarzalności, kolizji dat, odtworzenia i negatywnego testu ról, z decyzją ownera bazy. |
| E2-T02 | Załadować jeden historyczny CSV do istniejącej gałęzi Neon Development i wykonać readback. Zależność E2-T01, przyjęty kontrakt wielu dostawców i facetów oraz dopuszczenie importu. Dowód liczebności, próbek, pochodzenia, digestu wsadu i regresji danych Macrobond. |
| E2-T03 | Uruchomić przyrost w zaakceptowanym mechanizmie zadań z jedną edytowalną konfiguracją. Przygotowanie może biec równolegle z próbą E2-T01, aktywacja po E2-T02. Dowód zmiany ustawień bez zmiany kodu, opóźnionej publikacji, korekty, ponowienia bez duplikatu i odzyskania po awarii. |
| **E3 — ZSRIR w Finderze i odbiór END-TO-END** | Działające wyszukiwanie, odczyt historii i pojawienie się nowego notowania w Finderze, z kompletem regresji Macrobond. STOP przy kolizji tożsamości lub regresji, błędzie uprawnień albo braku dopuszczenia wydania. Brak rzeczywistego nowego notowania pozostawia FINAL-03 nieodebrane. |
| E3-T01 | Ustalić prezentację Advanced Search i udostępnić wyszukiwanie, podgląd i zapisane serie w ramach przyjętego kontraktu. Zależność odebrane E2, mandat E3 i decyzja o UI przed zmianą. Dowód testów faktycznych powiązań, tożsamości dwóch dostawców, dostępu i facetów. |
| E3-T02 | Wykonać rzeczywisty odbiór FINAL na dopuszczonej wersji i środowisku. Zależność E3-T01, zgoda na wydanie i nowa publikacja MRiRW. Dowód pełnego śladu publikacja → cykl → Neon → Finder oraz odbioru właściciela. |

### Końcowy Business DoD

| ID | Warunek | Dowód |
|---|---|---|
| FINAL-01 | Uzgodniona historia jest w istniejącym Neon, zgodna z CSV i źródłami. | Hash CSV, raport pokrycia, porównanie próbek źródło–CSV–baza. |
| FINAL-02 | Ponowienia i korekty zachowują okres, tożsamość i historię źródeł. | Test nakładających się cykli, identycznych bajtów, korekty i kolizji dostawców oraz okresów. |
| FINAL-03 | Nowa rzeczywista publikacja MRiRW przez ustawiony harmonogram trafia do bazy i Findera w uzgodnionym czasie. | Identyfikator i czas publikacji, odczyt harmonogramu i rzeczywistego cyklu, readback Neon oraz ten sam punkt w Finderze. |
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

1. Właściciel SG2 potwierdza zakres v1, datę odcięcia, próg świeżości oraz końcowe środowisko odbioru.
2. Governance Source Layer i Architecture Platform rozstrzygają GOV-01. Jeśli potrzeba zmiany normatywnej, przedstawić ją do osobnej akceptacji, z zachowaniem DEC-01.
3. Owner SG2 zatwierdza kontrakt i granice modelu po próbie, a przed implementacją UI ustala prezentację facetów Advanced Search w E3.
4. Właściciel akceptuje wspólnie projekt i roadmapę z dokładnego commita. Po tej decyzji zamrozić zaakceptowany zakres i DoD. Późniejsze aktualizacje rejestru nie zmieniają zaakceptowanej treści. E1 wymaga osobnej wyraźnej dyspozycji.

**Punkt wznowienia.** v0.3 utrwala wiążącą lokalizację SG Runtime / Market Data i poprawia roadmapę, routing oraz warunki przed importem. Następny krok to niezależna recenzja tej rewizji i rozstrzygnięcie spraw otwartych. Bieżący mandat dotyczy wyłącznie projektu, recenzji i trwałego zapisu Karty. Pierwszy etap wykonawczy ma status NIE_ROZPOCZĘTY. [Kanon BSDC v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md) · [Launcher](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/bsdc-launcher-v1.1.md)
