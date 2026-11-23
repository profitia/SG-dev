# Karta Projektu BSDC — ZSRIR w Benchmark Finder

| Pole | Wartość |
|---|---|
| initiativeId | BSDC-20261122-ZSRIR-BENCHMARK-FINDER |
| projectKey / profil prowadzący | SG2 / SG Runtime |
| Rewizja i data | v0.4, 22.11.2026 |
| Status projektu i roadmapy | OWNER_APPROVED |
| Właściciel decyzji biznesowej | Właściciel SG2 |
| Repozytorium i authority | profitia/SG-dev, main |
| Ścieżka Karty | Canon/proposals/bsdc/SG2/BSDC-20261122-ZSRIR-BENCHMARK-FINDER.md |
| Rewizja źródeł audytu v0.2 | f75c6a5a170dd4b6597f67ab9790722657a1ef35 |
| Status rewizji Karty | Zamrożona baza projektu i roadmapy: v0.4, commit `c5d9120db40596b8f267b7a908afb2a232fc76da`, blob `29e919aceb8f94ecc517299bc639c5529bbf8731`. Decyzja F3 zapisana w tej Karcie. |
| Środowisko pierwszego pełnego odbioru | Development — zatwierdzone dla FINAL-01–05 przez właściciela |
| Mandat | F3 zatwierdzone. E1 ZAKOŃCZONY w zakresie zaakceptowanego CSV i kontraktu v1.0. DEC-02 potwierdza właścicielskie uprawnienie do retencji, przetwarzania, wykorzystania w aplikacji klienckiej, udostępniania wyników normalizacji i Production. Dla tego zakresu brak ponownej bramki zgody na użycie danych. E2-T01 autoryzowany do próby po dopuszczeniu ownera bazy; E2-T02 i E3 nierozpoczęte, osobne bramki techniczne bez zmian. |

## 1. Cel biznesowy i zakres

Użytkownik Benchmark Finder wyszukuje notowania cenowe MRiRW, odczytuje historię i widzi kolejne wartości po automatycznym odświeżeniu. Przyjęta obserwacja zachowuje rodzaj ceny, jednostkę, okres i odtwarzalne pochodzenie. ZSRIR jest drugim dostawcą Findera, obok Macrobond.

Zakres v1 obejmuje pozyskanie historii i kwalifikację do jednego wystandaryzowanego CSV, jednorazowe zasilenie istniejącego Dynamic Market Data Store w Neon, aktualizację przyrostową oraz wyszukanie, podgląd historii i zapisanie serii ZSRIR w Finderze. Szczegóły prezentacji Advanced Search podlegają uzgodnieniu w E3. Semantyka dostawcy i facetów jest warunkiem importu. Prognozy i AI Search dla ZSRIR, przetwarzanie PDF-only/OCR bez osobnego rozstrzygnięcia, inne moduły SG2, osobny panel administracyjny oraz nowy runtime, aplikacja lub pakiet pozostają poza zakresem v1.

## 2. Dowody i pokrycie danych

| Dowód | Ustalenie |
|---|---|
| Inwentaryzacja Gov.pl z 22.11.2026, arkusze Excel Gov.pl, Paczki Gov.pl i Excel w paczkach | 3 210 wystąpień linków, 3 206 różnych URL do Excela, 56 paczek i 1 332 pozycje Excel w paczkach. Gov.pl obejmuje dwie strony nawigacji, osobne strony wydań i archiwa. |
| Inwentaryzacja ZSRIR, arkusze Excel ZSRIR i Formularze ZSRIR | 1 245 XLSX w 16 katalogach. Skrajne okresy plików to 01.01.2024–15.11.2026. Przegląd danych udostępnia 15 rynków i 54 formularze. Pokrycie jest różne dla poszczególnych serii. |
| Próby pobrania | 56 testów, w tym otwarcie 54 plików XLSX i potwierdzenie formatu dwóch XLS. Stwierdzono kopie między katalogami i portalami. Eksport na żądanie potwierdzono dla rzepaku. Test tej serii za I kwartał 2003 r. nie zwrócił wartości. |
| Odczyt Neon Development i audyt kodu SG-dev | Istnieją tabele serii i obserwacji z identyfikacją dostawcy. W chwili audytu 514 serii miało kod MACROBOND. Kontrolowany zapis, widoki historii i słowniki Findera są powiązane z Macrobond. |

Liczebność plików nie jest liczebnością obserwacji. Pakiet odtwarzalnych dowodów E1 ma zawierać wersję wykazu, datę odczytu, sumy kontrolne i próbki. Karta zawiera referencje do rzeczywiście opublikowanych dowodów. [Gov.pl — katalog](https://www.gov.pl/web/rolnictwo/biuletyny-informacyjne) · [Strona 2](https://www.gov.pl/web/rolnictwo/biuletyny-informacyjne?page=2&size=10) · [Archiwum](https://www.gov.pl/web/rolnictwo/archiwalne-notowania) · [Wykaz ZSRIR](https://zsrir.minrol.gov.pl/api/ZsrirData/GetReportList) · [Przegląd danych](https://zsrir.minrol.gov.pl/data)

**Kwalifikacja v1.** Rodziny kandydackie obejmują drób, jaja, mleko, wieprzowinę, wołowinę i cielęcinę, baraninę, zboża, rośliny oleiste i wysokobiałkowe, owoce, warzywa, cukier, chmiel, pasze i tytoń. Kwalifikuje się udokumentowana seria cenowa z towarem i wariantem, rodzajem ceny, geografią, częstotliwością, okresem i jednostką. Dane żywnościowe klasyfikuje się jako FOOD, a pasze i tytoń jako COMMODITIES z etykietą Commodities. Przypadki niejednoznaczne rozstrzyga mapowanie rodziny i miary. Dostawcą obu kategorii jest ZSRIR, MRiRW jest wydawcą, a Gov.pl i portal ZSRIR to kanały publikacji.

**Kompletność i kwalifikacja historii.** Rozliczyć 100% pozycji wykazu, wskazując pozycje pobrane, kopie, niedostępne oraz formaty wymagające odrębnej oceny. Raport E1 podaje mianowniki, pokrycie okresów, sezonowość i luki dla poszczególnych rodzin. Wszystkie dostępne dane pozostają identyfikowalne w zrzucie, zbiorze przejściowym lub manifestach. Po kwalifikacji uzgodnione obserwacje trafiają do jednego CSV. Każde wyłączenie z importu ma udokumentowaną przesłankę i właściwą decyzję. W przyjętym CSV obowiązuje zero podwójnych kluczy, osieroconego pochodzenia i nierozstrzygniętych konfliktów.

## 3. Decyzje właściciela i governance

### DEC-01 — lokalizacja ZSRIR w SG Runtime / Market Data

Wiążąca decyzja właściciela z 22.11.2026, w mandacie DESIGN / REVIEW / PERSISTENCE. ZSRIR należy wyłącznie do SG Runtime / Market Data w profilu SG2. Konektor jest w istniejącym lib/benchmark, logika normalizacji i aktualizacji w lib/market-data, model trwałego zapisu w prisma-market-data, a wyszukiwanie, filtry, podgląd i zapisane serie w Finderze. Integracja reużywa platformowy Source/external-call stosowany przez Macrobond. Kompetencje nad transportem, E1, przyjęciem Source i współdzielonymi kontraktami pozostają u ich obecnych ownerów. Decyzja wiąże kierunek Karty, a akceptacja rewizji projektu i roadmapy pozostaje osobnym zdarzeniem.

### Historia v1 — zatwierdzona z korektą

1. Pobrać możliwie pełny dostępny materiał historyczny MRiRW/ZSRIR ze źródeł Gov.pl i portalu ZSRIR rozpoznanych w discovery. Zachować zrzut, manifest, metadane, pochodzenie i rozliczenie kompletności. Formaty potrzebujące nowego mechanizmu, np. OCR, oznaczyć do oceny i rozliczyć w wykazie.
2. Zbudować odtwarzalny zbiór przejściowy bez automatycznego usuwania serii z lukami, nietypowymi okresami, brakującymi wartościami, konfliktami lub niepełnymi metadanymi. Zachować identyfikowalność każdego przypadku.
3. Przeanalizować jakość, luki, duplikaty, korekty, pokrycie historyczne i niejednoznaczności.
4. Przedstawić raport i rekomendacje, uzyskać właściwe decyzje dotyczące przypadków wymagających rozstrzygnięcia i udokumentować ewentualne wyłączenia. Sama luka czasowa nie jest podstawą wyłączenia.
5. Po kwalifikacji przygotować jeden wystandaryzowany CSV do importu zgodny z przyjętym kontraktem. Unikatowość kluczy i rozstrzygnięcie konfliktów obowiązują w finalnym CSV.

### Data odcięcia pierwszego wsadu — zatwierdzona

Granicą włącznie jest **22 listopada 2026 r., godz. 23:59:59, Europe/Warsaw**, według daty publikacji źródłowej. Data pobrania i okres notowania są odrębnymi polami. Dane i korekty opublikowane później objąć uzupełnieniem przed startem zwykłego cyklu. Nieustaloną datę publikacji zachować w zbiorze przejściowym z oznaczeniem do wyjaśnienia i kwalifikacji względem granicy.

### Świeżość — kierunek zatwierdzony, SLA otwarte

Stan SLA to `DO_USTALENIA_NA_PODSTAWIE_DANYCH`. W E1 zbadać faktyczną częstotliwość publikacji według rodziny, rynku i typu raportu, opóźnienie względem okresu obserwacji, nieregularność i sezonowość oraz korekty, spóźnione i uzupełniające wydania. Ocenić wykrywanie nowych i zmienionych publikacji niezależnie od kadencji notowań. Na podstawie wyników przedstawić konfigurację harmonogramu lub harmonogramów i mierzalne cele świeżości odpowiednie dla źródeł.

### Finder v1 — zatwierdzony

Zakres obejmuje wyszukiwanie, jednoznaczną identyfikację dostawcy, podgląd i odczyt historii oraz zapis serii. Kontrakt zachowuje odrębne role dostawcy ZSRIR, wydawcy MRiRW oraz kanału publikacji i używa klas `FOOD` / `COMMODITIES`. Semantyka kontraktu v1.0, serii, okresów i facetów przyjęta przez właściciela w DEC-02; prezentację facetów w Advanced Search uzgodnić podczas E3.

### Środowisko odbioru i decyzja F3 — zatwierdzone

**F3 = OWNER_APPROVED.** Właściciel SG2 w decyzji z 22.11.2026 przyjął łącznie projekt rozwiązania oraz kompletną roadmapę E1–E3 z Karty v0.4. Zatwierdzona baza to commit `c5d9120db40596b8f267b7a908afb2a232fc76da` i blob `29e919aceb8f94ecc517299bc639c5529bbf8731` z PR #1286. Właściciel potwierdził **Development jako środowisko pierwszego pełnego odbioru FINAL-01–05**. [Dokładna zaakceptowana rewizja](https://github.com/profitia/SG-dev/blob/c5d9120db40596b8f267b7a908afb2a232fc76da/Canon/proposals/bsdc/SG2/BSDC-20261122-ZSRIR-BENCHMARK-FINDER.md) · [PR #1286](https://github.com/profitia/SG-dev/pull/1286)

Akceptacja obejmuje pełne pozyskanie i zachowanie zbioru przejściowego z niekompletnymi seriami przed kwalifikacją, odcięcie 22.11.2026 o 23:59:59 w Europe/Warsaw, ustalenie harmonogramów i SLA na podstawie danych E1, Finder v1 i DEC-01. Mandat tej decyzji obejmuje zapis i publikację dokumentacyjną. Uruchomienie każdego etapu wymaga oddzielnej dyspozycji. GOV-01, dopuszczenie Source, migracje i wydania podlegają własnym bramkom technicznym i operacyjnym.

### DEC-02 — trwała decyzja właściciela o wykorzystaniu danych ZSRIR/MRiRW (23.11.2026)

**Status: OWNER_ATTESTED / OWNER_APPROVED — zakres użycia danych ustalony, bez kolejnej bramki zgody w projekcie.** Właściciel SG2 oświadcza, że **posiada wymagane uprawnienie/zgodę** i jako właściciel zatwierdza dalszą wewnętrzną retencję i przetwarzanie pozyskanych danych ZSRIR i Gov.pl (MRiRW) w Development, ich wykorzystanie w aplikacji klienckiej SpendGuru / Benchmark Finder, **udostępnianie klientom wyników normalizacji i analiz** oraz wdrożenie i korzystanie z tych danych w **Production**. Decyzja obejmuje zatwierdzony kontrakt v1.0, dane źródłowe, zatwierdzony CSV oraz późniejsze zgodne z kontraktem przyrosty i rewizje tych samych źródeł. Właściciel przyjmuje odpowiedzialność za podstawę tego umocowania; zapis jest **oświadczeniem właściciela**, a nie niezależną weryfikacją dokumentów uprawnienia.

**Warunki sposobu użycia:** pełna atrybucja MRiRW, identyfikowalne daty wytworzenia/publikacji i pozyskania w granicach dowodów źródłowych, zachowanie niezmienionych oryginałów, wyraźne odróżnienie i oznaczenie wyników normalizacji, korekt, wersji, jednostek i pochodzenia; dane niepewne nadal podlegają regułom kwalifikacji. Zachować właściwe zabezpieczenia, kontrolę dostępu i integralność danych.

**Dyspozycja dla Codex i wykonawców:** nie ponawiać w E1, E2, E3, wdrożeniu klienta ani Production pytań o zgodę na retencję, przetwarzanie, użycie w aplikacji, udostępnianie wyników normalizacji czy komercyjne wykorzystanie **w tym zatwierdzonym zakresie**. Usunąć ten punkt jako formalną bramkę procesu. Następne czynności i decyzje mają dotyczyć **technologii i bezpieczeństwa wdrożenia**: schematu i migracji, Source/Identity, ról i dostępu, importu i readback, regresji Macrobond, harmonogramów, CI, wydania i odbioru. Odrębne mandaty techniczne i właściciel bazy pozostają bez zmian. Nie rozszerza to automatycznie zakresu na inne źródła, produkty lub warunki wykorzystania.

Decyzja DEC-02 stanowi bieżące rozstrzygnięcie właściciela w zakresie użycia danych i zastępuje wcześniejsze robocze oznaczenia `DO_POTWIERDZENIA` oraz polecenia występowania o ponowną zgodę, zawarte w historycznym kontrakcie E1-T01 i przeglądzie E1, **wyłącznie dla wskazanego zakresu**. Historycznych dowodów nie zmieniać; pierwszeństwo ma bieżący zapis decyzji w Karcie.

### GOV-01 — aktywny wyjątek dla ZSRIR

Aneks GOV-01 v0.1 ma status `OWNER_APPROVED / ACTIVE`. Właściciel zatwierdził dokładny tekst i wycofał warunek dwóch odrębnych stanowisk. PR #1292, CI i odczyt wynikowy na `main` potwierdziły aktywację w §10 kanonu Source Hub. [Decyzja właściciela](https://github.com/profitia/SG-dev/issues/1285#issuecomment-7084176186) · [Aneks](https://github.com/profitia/SG-dev/blob/0d2233914d4d32a5d98abe2c4700d2827df39406/Canon/v1.0-platform-source-hub-business-and-architecture-canon.md#L86-L88) · [PR #1292](https://github.com/profitia/SG-dev/pull/1292) · [PHR](https://github.com/profitia/project-history-repository/commit/4da9fe2d5f406cf70de36458b0076539c8a20300)

Przegląd przed aktywacją GOV-01. Kanon Source Hub v1.0, §1 i tabela odpowiedzialności w wierszach 10–18, przypisuje Architecture Platform / Source Hub adaptery dostawców i pozyskiwanie zewnętrzne. Benchmark Domain / Market Data posiada serie kanoniczne, przyjęte dane rynkowe i odpowiedzialność za Macrobond. Nowela v1.1, wiersze 7–9 i 17–27, rozszerza dostęp konsumentów do przyjętych kontraktów Hub, utrzymuje odpowiedzialność Hub za pozyskiwanie odpłatne i dostęp do dostawców oraz zachowuje dotychczasowe granice Benchmark/Macrobond. Ówczesny przegląd tych zasad nie wykazał jawnego umocowania nowego ZSRIR poza Hub. Istniejące umocowanie Macrobond nie przenosi się automatycznie na nowe źródło. [Kanon Source Hub v1.0, §1](https://github.com/profitia/SG-dev/blob/f75c6a5a170dd4b6597f67ab9790722657a1ef35/Canon/v1.0-platform-source-hub-business-and-architecture-canon.md#L8-L20) · [Nowela dostępu v1.1](https://github.com/profitia/SG-dev/blob/f75c6a5a170dd4b6597f67ab9790722657a1ef35/Canon/v1.1-platform-source-hub-universal-first-party-consumer-access.md#L7-L27)

DEC-01 przypisuje konektor wyłącznie do SG Runtime / Market Data. Operacje wykorzystują istniejący Source/external-call. Dopuszczenie operacyjne wymaga powiązania dokładnej operacji z rolą, źródłem i zasobem w Development oraz zachowania kontroli Source, Identity/E1 i transportu. Zakres zgody na użycie danych jest rozstrzygnięty w DEC-02; nie stanowi ponownej bramki dopuszczenia.

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

**Harmonogram.** Reużyć zatwierdzony mechanizm zadań, jeśli spełnia warunki. Edytowalna konfiguracja backendowa obejmuje harmonogramy, strefę, lookback i cele świeżości według źródła na podstawie wyników E1. Uzupełnienie danych i korekt po dacie odcięcia poprzedza start zwykłego cyklu. Raportować ostatnie skuteczne odświeżenie, najnowszą publikację i jej okres, nowe dane, korekty i błędy. Awaria źródła zachowuje poprzednie dane i ujawnia ich aktualność. Sezonowa przerwa ma odrębny stan od awarii.

## 6. Checklista BSDC v1.1

| ID | Status | Ustalenie / dowód lub otwarta kwestia |
|---|---|---|
| A1 | USTALONE | Użytkownik Finder potrzebuje historii i bieżących danych MRiRW. |
| A2 | USTALONE | SG2 prowadzi, właściciel SG2 akceptuje, użytkownik Finder odbiera. |
| A3 | W_TRAKCIE | Data odcięcia i Development dla FINAL-01–05 zatwierdzone. Pokrycie i próg świeżości wynikną z E1. |
| A4 | USTALONE | Jedna inicjatywa od historii do odczytu bieżących notowań. |
| B1 | USTALONE | Zweryfikowano ustalenia wcześniejszych audytów portalu i Neon oraz aktualne źródła kodu i governance. |
| B2 | USTALONE | Dowody, założenia i luki pokrycia opisano osobno. |
| B3 | USTALONE | DEC-01 rozstrzyga lokalizację. Model zapisu preferuje addytywne użycie istniejącej bazy. |
| B4 | W_TRAKCIE | Potwierdzić minimalne rozszerzenia, klucz i regresję w próbie modelu zapisu. |
| C1 | W_TRAKCIE | Przepływ historii, cyklu i Finder opisany. Uzgodnić prezentację w E3. |
| C2 | W_TRAKCIE | Zasady kopii, korekt i okresów opisane. Zatwierdzić mapowania i konflikty. |
| C3 | W_TRAKCIE | Zakres Finder v1 i sekwencja historii zatwierdzone. Kwalifikacja rodzin i przypadków źródłowych nastąpi w E1. |
| C4 | DO_USTALENIA | Zweryfikować aktualne wzorce Advanced Search i ich rzeczywiste powiązania przed zmianą UI. |
| C5 | W_TRAKCIE | FINAL-01–05 przygotowane. Odbiór do potwierdzenia. |
| D1 | USTALONE | DEC-01 wyznacza wyłącznego ownera SG Runtime / Market Data. |
| D2 | W_TRAKCIE | Resolver potwierdził ścieżkę Karty i proponowane ścieżki zsrir.ts oraz zsrir-import.ts. Pełny zestaw zmian wymaga sprawdzenia przed wykonaniem. |
| D3 | USTALONE | Drzewo i granice ownership opisane zgodnie z DEC-01. |
| D4 | W_TRAKCIE | Kontrakt wielodostawcowy i CSV opisane. GOV-01 aktywny. Operacyjny kontrakt Source i kontrolowany odczyt do potwierdzenia. |
| D5 | USTALONE | Właściciel potwierdził umocowanie dla retencji, przetwarzania, klienta i Production; atrybucja i oryginały pozostają wymagane. Kontrola ról, Source, integralności i wdrożenia nadal obowiązuje jako kryterium techniczne. |
| D6 | W_TRAKCIE | Odtworzenie, monitoring i harmonogram opisane. Wolumen, czas i koszt po próbie. |
| E1 | USTALONE | E1-T01/T02/T03 odebrane w zatwierdzonym zakresie Development i CSV; zgodę na dalsze wykorzystanie danych rozstrzyga DEC-02. |
| E2 | W_TRAKCIE | Taski i DoD rozpisane w tej Karcie. |
| E3 | W_TRAKCIE | Własność SG2 i odrębne uprawnienia współdzielone zapisane. |
| E4 | W_TRAKCIE | Próby importu, izolacji, korekt, odbioru funkcji i regresji w FINAL. |
| E5 | DO_USTALENIA | Koszty i rzeczywisty wolumen po kwalifikowanej próbie. |
| E6 | USTALONE | Właściciel przyjął kompletną roadmapę, taski, zależności, rejestr, STOP i końcowy DoD na dokładnej rewizji v0.4. |
| F1 | W_TRAKCIE | Zapisano DEC-01, decyzje biznesowe v0.4, F3 i aktywację GOV-01. Otwarte pozostają parametry wynikające z E1. |
| F2 | W_TRAKCIE | GOV-01 aktywny. Dopuszczenia Source i rozstrzygnięcia wykonawcze pozostają u właściwych właścicieli. |
| F3 | USTALONE | `OWNER_APPROVED`. Właściciel wspólnie zaakceptował projekt i roadmapę v0.4 na commicie `c5d9120db40596b8f267b7a908afb2a232fc76da`. |
| F4 | W_TRAKCIE | Punkt wznowienia i granice wykonania zapisane. |

## 7. Roadmapa E1–E3, DoD i rejestr

Development jest zatwierdzonym środowiskiem pierwszego pełnego odbioru FINAL-01–05. Wszystkie poniższe taski prowadzi SG2 / SG Runtime. Ownerzy mechanizmów współdzielonych zatwierdzają użycie lub zmianę swoich kontraktów we właściwym zakresie. Wykonanie w zatwierdzonym środowisku chmurowym. Każdy etap wymaga osobnego mandatu i rozliczenia. Wstrzymanie dotyczy blokowanego zakresu aktywnego etapu, a kolejny etap wymaga nowej dyspozycji.

| Etap / task | Rezultat, zależność i DoD / dowód |
|---|---|
| **E1 — kontrakt i kompletna historia w CSV** | Przyjęty kontrakt, możliwie pełny zrzut i manifest, odtwarzalny zbiór przejściowy, raport jakości i kadencji oraz kwalifikacja do jednego wersjonowanego CSV. STOP dla zależnego pozyskania przy otwartym GOV-01 lub braku Source. Brak uzgodnionego klucza, znaczenia facetów lub nierozstrzygnięty konflikt blokuje przekazanie zależnych obserwacji do importu. |
| E1-T01 | Ustalić zakres discovery i źródeł, kanały, warunki użycia, klucz obserwacji, kontrakt wielu dostawców i znaczenie facetów. Przygotować metodę kwalifikacji względem daty publikacji oraz plan pomiaru kadencji. Zależność od mandatu E1 po akceptacji Karty. Dowód wersji kontraktu, mapowań, przypadków okresów i decyzji właściciela. |
| E1-T02 | Pobrać możliwie pełny zrzut Gov.pl i ZSRIR oraz zbudować odtwarzalny zbiór przejściowy zachowujący także luki, duplikaty, konflikty, nietypowe okresy i braki metadanych. Zależność E1-T01 w części źródeł, GOV-01 i przyjęcie Source. Dowód manifestu z hashami, metadanymi, pochodzeniem, rozliczeniem kompletności i próbkami. Zaznaczyć pozycje bez ustalonej daty publikacji i formaty oczekujące na decyzję o nowym mechanizmie. |
| E1-T03 | Przedstawić analizę jakości, pokrycia, duplikatów, korekt, konfliktów i kadencji oraz rekomendacje kwalifikacji, harmonogramów i SLA. Po właściwych rozstrzygnięciach wygenerować jeden odtwarzalny CSV do importu. Zależność E1-T01/T02. Dowody obejmują raport, decyzje o wyłączeniach, hash CSV, walidację typów i unikatowości kluczy, brak nierozstrzygniętych konfliktów, ślad źródła i powtarzalność bajtów. |
| **E2 — import Neon i cykliczne przyrosty** | Historia w istniejącym Neon oraz zaakceptowany cykl ZSRIR. STOP przy nierozwiązanej kolizji okresów, braku rozdzielenia ról, niezgodności readback, wpływie na Macrobond albo braku dopuszczenia migracji lub odtworzenia. |
| E2-T01 | Zweryfikować minimalny addytywny model i klucz fizyczny na dopuszczonym celu testowym. Zależność odebrane E1 i mandat E2. Dowód próby migracji, powtarzalności, kolizji dat, odtworzenia i negatywnego testu ról, z decyzją ownera bazy. |
| E2-T02 | Załadować jeden zakwalifikowany historyczny CSV do istniejącej gałęzi Neon Development i wykonać readback. Zależność E2-T01, odebrana kwalifikacja E1 wraz z datą odcięcia i uzasadnieniami wyłączeń, przyjęty kontrakt dostawców i facetów oraz dopuszczenie importu. Dowód liczebności, próbek, pochodzenia, digestu wsadu i regresji danych Macrobond. |
| E2-T03 | Przygotować przyrost w zaakceptowanym mechanizmie zadań według zatwierdzonych po E1 harmonogramów i celów świeżości per źródło. Przygotowanie może biec równolegle z E2-T01. Po E2-T02 uzupełnić dane i korekty po dacie odcięcia, potem uruchomić zwykły cykl. Dowód zmiany ustawień bez zmiany kodu, uzupełnienia, opóźnionej publikacji, korekty, ponowienia bez duplikatu i odzyskania po awarii. |
| **E3 — ZSRIR w Finderze i odbiór END-TO-END** | Działające wyszukiwanie, odczyt historii i pojawienie się nowego notowania w Finderze, z kompletem regresji Macrobond. STOP przy kolizji tożsamości lub regresji, błędzie uprawnień albo braku dopuszczenia wydania. Brak rzeczywistego nowego notowania pozostawia FINAL-03 nieodebrane. |
| E3-T01 | Ustalić prezentację Advanced Search i udostępnić wyszukiwanie, podgląd i zapisane serie w ramach przyjętego kontraktu. Zależność odebrane E2, mandat E3 i decyzja o UI przed zmianą. Dowód testów faktycznych powiązań, tożsamości dwóch dostawców, dostępu i facetów. |
| E3-T02 | Wykonać rzeczywisty odbiór FINAL na dopuszczonej wersji i środowisku. Zależność E3-T01, zgoda na wydanie i nowa publikacja MRiRW. Dowód pełnego śladu publikacja → cykl → Neon → Finder oraz odbioru właściciela. |

### Końcowy Business DoD

| ID | Warunek | Dowód |
|---|---|---|
| FINAL-01 | Zakwalifikowana historia według zatwierdzonej daty publikacji jest w istniejącym Neon i odpowiada jednemu zaakceptowanemu CSV. | Manifest pełnego zrzutu, odtwarzalny zbiór przejściowy, raport jakości i decyzje o wyłączeniach, hash CSV bez podwójnych kluczy i nierozstrzygniętych konfliktów oraz próbki źródło–CSV–Neon. |
| FINAL-02 | Ponowienia i korekty zachowują okres, tożsamość i historię źródeł. | Test nakładających się cykli, identycznych bajtów, korekty i kolizji dostawców oraz okresów. |
| FINAL-03 | Co najmniej jedna nowa rzeczywista publikacja MRiRW przechodzi przez automatyczny cykl i jest odczytana w Benchmark Finder. Wynik spełnia uzgodnione po E1 kryterium świeżości dla właściwego źródła. | Identyfikator i czas publikacji, zastosowany harmonogram i wynik pomiaru świeżości, rzeczywisty przebieg cyklu, readback Neon oraz ten sam punkt w Finderze. |
| FINAL-04 | Uprawniony użytkownik wyszukuje rzeczywistą serię ZSRIR, odczytuje historię i potrafi zapisać serię. | Przyjęty Advanced Search, widoczny dostawca, okres i jednostka, sprawdzalne pochodzenie, test odmowy poza uprawnieniem. |
| FINAL-05 | Macrobond przechodzi regresję, a awaria ZSRIR nie odbiera dostępu do ostatnich poprawnych danych. | Scenariusze wyszukiwania, facetów, historii i zapisów Macrobond, kontrola odizolowania zapisu ZSRIR, dowód świeżości i powrotu po awarii. |

Wszystkie FINAL mają status DO_POTWIERDZENIA. Terminy, koszty i przepustowość DO_OSZACOWANIA po kwalifikowanej próbie. Jeśli odbiór ma obejmować Staging lub Production, do zaakceptowanej rewizji włączyć właściwe kryteria wydania, mandaty i dowody dla tych środowisk.

### Rejestr wykonania

| ID | Status | Owner / profil | Daty, taskId, PR/SHA, CI, wydanie, testy i dowody |
|---|---|---|---|
| E1 | ZAKOŃCZONY | SG Runtime / SG2 | 23.11.2026. Zakończone E1-T01/T02/T03, semantyka v1.0 i pierwszy CSV 125 827 obserwacji zaakceptowane. Retencja, przetwarzanie, klient, normalizacja i Production: decyzja właściciela DEC-02; bez ponownej bramki formalnej. [Wcześniejszy przegląd E1 w PHR](https://github.com/profitia/project-history-repository/commit/01bbff82f00f07240579bd72619cd30a8cf47a07). |
| E1-T01 | ZAKOŃCZONY | SG Runtime / SG2 | 23.11.2026. Kontrakt v1.0 serii, okresów, facetów i reguł kwalifikacji przyjęty w DEC-02. 12 testów offline PASS, wyniki E1-T03 potwierdzają pierwszy zakres. Wcześniejsza kwalifikacja CZĘŚCIOWY historyczna, decyzje dotyczące użycia rozstrzygnięte przez właściciela. [Kontrakt v1.0](https://github.com/profitia/SG-dev/blob/6ee9364ee91e773107b8cac565ba2d9c27bf0862/Canon/evidence/2026-11-22-sg2-zsrir-e1-t01-contract-v1.md). |
| E1-T02 | ZAKOŃCZONY | SG Runtime / SG2 | 23.11.2026 · `SG2-BSDC-ZSRIR-E1-T02-COMPLETION-20261123`. GET: 7 570 pozycji rozliczonych, 7 556 oryginałów i 5 100 712 560 B. Osobno rozliczono 14 przekierowań, w tym niedostępny `Chm_paź_21.xls` bez odnalezionej oficjalnej kopii XLS. Pobrano cztery RAR w ośmiu zakresach HTTP 206. SHA-256, ponowny odczyt i wydobycie 205 XLSX potwierdzone. POST: 208 z 208 pozycji planu, 293 zapisanych XLSX z pilotem. Wszystkie kombinacje POST rozliczono, w tym przez okna uzupełniające. Łącznie 7 849 oryginałów, 5 103 606 592 B i odtwarzalny zbiór przejściowy dla wszystkich zapisanych oryginałów. Indeks `sg2-zsrir-e1-t02/stage/extract-v1/snapshot-index.json`, SHA-256 `fe25446427a83472a99a1b94df1ef161411ca1eec28922799b60ff56fc5b3ff0`. [Rozliczenie PHR](https://github.com/profitia/project-history-repository/commit/bc4d5ed2659ffe80e98c07a5ab6793b9e9e88d49) |
| E1-T03 | ZAKOŃCZONY | SG Runtime / SG2 | 23.11.2026. Właściciel zatwierdził pierwszy wsad. 125 827 obserwacji w sg2-zsrir-e1-t02/qualification/e1-t03/v1.0/zsrir-historical-v1.0.csv, 510125219 B, SHA-256 c8f434296e4b28e21c2a86e3c7954e8b7668a8a7cb46b9152a5e3b02ca8e382e. Dwa niezależne odtworzenia, unikatowe klucze i pełny ponowny odczyt potwierdzone. Z 5 513 493 wierszy rozpoznano 268 172 klucze. Czasowo odłożono 142 345 kluczy, w tym 10 855 z konkurencyjnymi wartościami oraz 93 777 bez dowodu daty publikacji eksportu. Pochodzenie i możliwość uzupełnienia zachowano. Manifest sg2-zsrir-e1-t02/qualification/e1-t03/v1.0/qualification-manifest-v1.0.json, SHA-256 9bfe63e798c88c847073f9b80970972d7442d02c4ca29c7e7f4695f6a024d865. [Analiza](https://github.com/profitia/project-history-repository/commit/7f246615658549f38aba82fc9c89e5d8f8efe9f4) · [Akceptacja i rozliczenie](https://github.com/profitia/project-history-repository/commit/aafbdd8f2184adbbb0b7135af5bee8dd455e9c7b). |
| E2 | W_TRAKCIE | SG Runtime / SG2 | 23.11.2026. E2-T01 rozpoczęty w ramach mandatu właściciela. E2-T02 i E2-T03 nierozpoczęte. |
| E2-T01 | CZĘŚCIOWY | SG Runtime / SG2, owner bazy | 23.11.2026 · `SG2-BSDC-ZSRIR-E2-T01-20261123`. Próba addytywnego modelu na izolowanym PostgreSQL 18.6 z odtworzonym schematem i danymi syntetycznymi. 9/9 grup SQL PASS i 25/25 testów Macrobond zarówno na schemacie odniesienia, jak i z modelem ZSRIR. Zrzuty schematu przed i po rollback są identyczne bajtowo. Katalog działającej bazy Development zgodny przed i po próbie. Neon odrzucił gałąź schema-only dla projektu z istniejącą rolą `profitia_market_read_owner`. Weryfikacja na docelowym Neon pozostaje otwarta. [Rozliczenie PMOS / MEMOROS / PHR](https://github.com/profitia/project-history-repository/commit/f23b7c0eef5ed4302d86f2b8f53456692478482f) Kontynuacja wykazała 6/6 testów kontrolowanego zapisu na izolowanym PostgreSQL 18.6, w tym na uruchomieniu przygotowanym dla CI. Zapis rozdziela staging, efekt Source i kontrolowaną projekcję, odmawia konfliktów i zachowuje rewizje. Dopasowanie katalogu i podstawowych pól zweryfikowano odczytowo dla 125 827 wierszy i 235 332 referencji. [Kandydat kodu PR #1302](https://github.com/profitia/SG-dev/pull/1302), SHA `c23570b293922334cf26460e765c20b6920e3ac6`. Zarządzany Neon 18.7 przeszedł 6/6. Brakuje kwalifikującego kontrolowanego CI. [Dopuszczenie Source PR #1304](https://github.com/profitia/SG-dev/pull/1304). |
| E2-T02 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E2-T03 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E3 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E3-T01 | NIE_ROZPOCZĘTY | SG Runtime / SG2 | — |
| E3-T02 | NIE_ROZPOCZĘTY | SG Runtime / SG2, właściciel odbioru | — |

Po istotnych decyzjach i rozliczeniu tasku lub etapu aktualizować ten sam plik, z następnym krokiem i brakami. Dla SG2 Development zachować właściwe PMOS, MEMOROS i PHR. Opublikowane pakiety PHR w history/ potwierdzać odczytem i linkować z Karty. Pełne dane i CSV pozostają w zatwierdzonym środowisku chmurowym. Dowody zawierają ograniczone przykłady, digests i fakty wymagane do odbioru. [Profil SG2](https://github.com/profitia/SG-dev/blob/main/Canon/adapters/sg2-project-adapter-v1.md) · [PHR](https://github.com/profitia/project-history-repository/tree/main/history/) · [Wrapper wykonawczy](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/profitia-universal-project-execution-v1.2.md)

## 8. Otwarte sprawy i wznowienie

1. E1-T03 rozliczył pokrycie i kwalifikację oraz dostarczył rekomendacje na podstawie kadencji. Parametry eksploatacyjne do zatwierdzenia przed E2-T03.
2. E1-T02 jest rozliczony. Dalsze operacje Source wymagają właściwego dopuszczenia dla wykonywanego zakresu.
3. Owner SG2 zatwierdza kontrakt i granice modelu po próbie, a przed implementacją UI ustala prezentację facetów Advanced Search w E3.
4. Projekt i roadmapa mają zamrożoną bazę zaakceptowaną w F3. Dalsze aktualizacje rejestru zachowują przyjęty zakres i DoD. E1 wymaga osobnej wyraźnej dyspozycji właściciela.

**Rozliczenie odbioru E1 z 23.11.2026 — HISTORYCZNY PRZEGLĄD, ZAKOŃCZONY DEC-02.** Przyjęcie E1-T03 i zakresu CSV odnotowano. Pełną semantykę kontraktu v1.0 oraz użycie danych w Development, kliencie i Production potwierdza właściciel w DEC-02; formalna bramka nie wymaga ponownego odbioru.

- Tożsamość serii to para dostawca–seria. Obserwacja ma obie granice okresu. Kontrakt oddziela rynek, towar z wariantem, miarę, geografię, częstotliwość oraz jednostkę i walutę. Dostawca oraz kategoria FOOD/COMMODITIES są wymiarami katalogu. Filtry i liczniki działają w obrębie uprawnionego katalogu dostawcy z rozróżnieniem stanów: brak metadanych, brak wyniku, facet niewspierany. Wydawca i kanał są w pochodzeniu. Prezentacja Advanced Search zaplanowana w E3. [Kontrakt](https://github.com/profitia/SG-dev/blob/6ee9364ee91e773107b8cac565ba2d9c27bf0862/Canon/evidence/2026-11-22-sg2-zsrir-e1-t01-contract-v1.md)
- Właściciel przyjął E1-T03 wraz z jednym CSV obejmującym 125 827 obserwacji. SHA-256 CSV c8f434296e4b28e21c2a86e3c7954e8b7668a8a7cb46b9152a5e3b02ca8e382e. 142 345 odłożonych kluczy zachowano z przyczyną i pochodzeniem. Dotyczy to między innymi 10 855 konfliktów i 93 777 kluczy bez dowodu daty publikacji eksportu. [Odbiór CSV](https://github.com/profitia/project-history-repository/commit/aafbdd8f2184adbbb0b7135af5bee8dd455e9c7b)
- Właściciel SG2 oświadczył, że posiada wymagane uprawnienia do retencji, przetwarzania, użycia danych i wyników normalizacji w aplikacji klienckiej oraz Production (DEC-02). Obowiązują pełna atrybucja MRiRW, odróżnienie niezmienionych oryginałów od przekształceń i zapis dat/provenance. W zatwierdzonym zakresie nie kierować nowych pytań o formalną zgodę ani wniosków do MRiRW jako kroku wdrożenia. [Zasady MRiRW](https://www.gov.pl/web/rolnictwo/ponowne-wykorzystywanie) · [Biuletyny informacyjne](https://www.gov.pl/web/rolnictwo/biuletyny-informacyjne)
- Rekomendacje do prób: kontrola raz dziennie, lookback 56 dni dla rynków tygodniowych i 180 dni dla pasz oraz cukru. Dla chmielu, baraniny i tytoniu odpowiednio 720, 365 i 730 dni. Dla datowanych publikacji proponowany P95 publikacja–wykrycie ≤24 h, wykrycie–zweryfikowany zapis ≤6 h. To cele do sprawdzenia w Development i zatwierdzenia przed E2-T03. Szczegóły i rozkłady są w publication-cadence.json w manifeście kwalifikacji.

**Odbiór próby zarządzanego Neon, 23.11.2026.** Projekt `restless-water-02985628`, gałąź `br-floral-cake-bg78q6zd`, compute `ep-young-breeze-bgzay0km`, PostgreSQL 18.7 w `eu-central-1`. Utworzono nowy projekt z jedną gałęzią bez rodzica i potwierdzono 0 tabel użytkownika przed odtworzeniem DDL. Odtworzone z katalogu trzy tabele otrzymały wyłącznie syntetyczne wiersze i role. Model i zapis z transportu `a7e4b76ffea3273490b5109c075ca6d161abd840`. SQL odtwarzanego schematu SHA-256 `ce0192789d12546b35fbc26b2cf34d64b452d8d2f3c5d7bd042c34173e84cb3a`.

- PASS 6/6. Model wdrożony dwa razy w próbie i wycofany. Zweryfikowano oba końce okresu, pełne pochodzenie, wymagany efekt Source, integralność, korekty, odmowę konfliktu oraz próbę zapisu i odczytu Macrobond. Rzeczywiste loginy administracyjny i cztery zwykłe w odizolowanym projekcie. Końcowo 0 rekordów w tabelach bazowych, 0 ról testowych, model próbny i granica zapisu wycofane.
- Dostosowanie wyłącznie izolowanej kopii testu. Certyfikat i TLS potwierdzono na połączeniu klienta z proxy Neon, gdy backend raportował TLS false. Zwykłe role testowe usunięto po usunięciu schematów zawierających ich granty. Pierwsza próba sprzątania zatrzymała się na `DROP OWNED`. Kwalifikowany kod, cztery bloby i przypadki testowe są bez zmian. SHA-256 testu z GitHub `670ac3946f3acfce8340231f547f09ea3f6b4de5199618198a80b75b3bec2d99`, wykonanej kopii `5d93a7bae851803d409ff4e8a36e8672c15e9c6d072e8ffe3c53cc7bba58eb64`, logu `4a9cbd9e277e0874d0d3c2e8ff5128a57f33184a5d41c4ecf5f1c9cfe175d9b4`. [Kod i tożsamość próby](https://github.com/profitia/SG-dev/pull/1302)
- Katalog działającego Development sprawdzony przed i po próbnej sesji. 38 elementów, sygnatura `b6d9e639901f09f043812360ade844b7`, brak próbnego modelu i serii ZSRIR.
- Projekt próbny usunięty po zapisaniu dowodu na GitHub w commicie `a9cd351aae570e34f693e382bbc415044712ef98`. API Neon potwierdziło usunięcie właściwego identyfikatora. Projekt zniknął z listy aktywnych i widnieje wyłącznie w odzyskiwalnych do 2026-11-30T11:53:39Z. Brak aktywnego compute. Limity 0,25 CU, 1 GiB i 4 godziny aktywności z retencją 0. Odczyt rozliczeniowy po usunięciu: 156 CU-sekund i 67223 B transferu. Przy 0,222 USD/CU-h compute to około 0.00962 USD. Faktura końcowa pozostaje po stronie Neon. [Cennik Neon](https://neon.com/blog/major-compute-price-reduction-on-neon).
- Dokładne dopuszczenie obejmuje cztery bloby źródła `c23570b293922334cf26460e765c20b6920e3ac6`. Rekord #1304 ma wyłącznie ten zakres. Bramka zwykłego przyjęcia zgłasza `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA` dla commita `58be05464f2e6a0f74ab9eb54509b4fc830c7a3a`. Zwykły tryb odtwarza `LOCAL_DEPENDENCY_REJECTED` na tym samym lockfile z main, a pliku rejestru nie można dopuszczać jako zwykłego źródła. Brak kwalifikującego kontrolowanego CI dla PR #1302. E2-T01 pozostaje CZĘŚCIOWY, E2-T02 NIE_ROZPOCZĘTY. [PR #1304](https://github.com/profitia/SG-dev/pull/1304) · [Bramka CI](https://github.com/profitia/SG-dev/actions/runs/45167644412/job/137668646455)

**Punkt wznowienia.** Kontrakt bazowy przyjęty do E1-T02. [GOV-01 aktywny](https://github.com/profitia/SG-dev/issues/1285). Zrzut, kwity Source i odtwarzalny zbiór przejściowy dostępne w prywatnym buckecie `sg2-zsrir-e1-t02`. Wykaz GET i POST rozliczony. E1-T03 ZAKOŃCZONY. Zatwierdzony CSV wraz z manifestem kwalifikacji i materiałem do uzupełnień w prywatnym magazynie Development. [Odbiór E1-T03](https://github.com/profitia/project-history-repository/commit/aafbdd8f2184adbbb0b7135af5bee8dd455e9c7b). E1 ZAKOŃCZONY przez decyzję właściciela DEC-02. E2-T01 CZĘŚCIOWY. Właściciel dopuścił próbę modelu. Próba SQL i regresja Macrobond przeszły w izolowanym PostgreSQL. [SQL modelu](https://github.com/profitia/SG-dev/blob/b202bff360efc6c348b12e4522698ba52c0b5110/apps/sg-runtime/prisma-market-data/rehearsals/zsrir-e2-t01/schema.sql) i [testy](https://github.com/profitia/SG-dev/blob/b202bff360efc6c348b12e4522698ba52c0b5110/apps/sg-runtime/prisma-market-data/rehearsals/zsrir-e2-t01/verify.sql) zachowano w dokładnym commicie próby poza `main`. Kontrolowany CI zakończył się `LOCAL_DEPENDENCY_REJECTED` przed uruchomieniem aplikacyjnych testów kandydata w CI. [Wynik bramki CI](https://github.com/profitia/SG-dev/actions/runs/45156424309/job/137630426819). Próba na zarządzanym Neon ukończona na pustym projekcie tymczasowym. Dopuszczenie trusted-main w #1304 czeka na dowód kontrolowanego CI dla commita metadanych. [PR #1302](https://github.com/profitia/SG-dev/pull/1302) zachowuje dokładnego kandydata i metadane PROPOSED dla istniejącej ścieżki Source Admission. Zwykły kontroler odtwarza LOCAL_DEPENDENCY_REJECTED także na niezmienionym lockfile z main. Dokończenie próby Neon i przyjęcie kontrolowanej ścieżki zapisu ZSRIR poprzedzają decyzję o E2-T02. E2-T02 i E3 pozostają NIE_ROZPOCZĘTE; techniczne warunki importu i wydania nadal obowiązują. F3 zachowuje zamrożoną rewizję v0.4. [Rozliczenie PHR](https://github.com/profitia/project-history-repository/commit/bc4d5ed2659ffe80e98c07a5ab6793b9e9e88d49) · [Kanon BSDC v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md) · [Launcher](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/bsdc-launcher-v1.1.md)
