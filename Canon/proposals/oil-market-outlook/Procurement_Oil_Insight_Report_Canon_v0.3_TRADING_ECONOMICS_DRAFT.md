# Procurement Oil Insight — Report Canon v0.3

**Status:** `DRAFT_V0_3_TRADING_ECONOMICS_AMENDMENT / OWNER_REVIEW_REQUIRED` — propozycja aktualizacji źródeł; nie jest ACTIVE ani zgodą na integrację lub wykonanie. **Wersja v0.2 została wcześniej przyjęta warunkowo (D1/BC1–BC6) dla swoich dokładnych bajtów i zachowuje swoją odrębną tożsamość.**  
**Data:** 2026-11-03  
**Produkt:** SpendGuru 2.0 / Procurement Insights  
**Pierwszy typ raportu:** `OIL_MARKET_OUTLOOK` — WTI (`cl_c1_cl`) i Brent (`b_c1_cl`)  
**Kadencja referencyjna:** tygodniowa; horyzont prognozy: dokładnie 7 dni kalendarzowych od ostatniej uprawnionej obserwacji (`D7`).  
**Relacja do istniejącego kanonu:** specjalizacja redakcyjna projektowanego `Procurement Insights — Business & Architecture Canon v1.0` (Draft PR #847); nie zmienia jego authority ani zasad Forecast, Source, E1, prywatności i publikacji.
**Dziedziczone z v0.2:** dziewięć elementów raportu w czterech nadrzędnych sekcjach, metodologia sprawdzalności, warunki D1–D5, BC1–BC6, EP1–EP6, limit 4000 widocznych znaków i rozdział ownership pozostają bez zmian.  
**Zmiana v0.3:** dodanie Trading Economics (TE) jako komercyjnego, licencjonowanego źródła: kalendarz, news, wskaźniki, rynki (w tym ropa i bitumen), prognozy; kontrakt rozpoznawania instrumentu bazowego i bezpiecznej porównywalności CFD/OTC z futures; provenance, data as-of, reguły priorytetu oraz granice pilota B1. Żadna cena TE nie staje się automatycznie ceną referencyjną Forecast Core.  
**Ślad zatwierdzeń:** warunkowo zaakceptowany załącznik v0.2 SHA-256 `031f9d88f4da52fdaea64f173b9ca5acd258973670f648bf0d3fd38239f23222`; v0.3 wymaga własnego, nowego rozstrzygnięcia i nie zastępuje tego SHA.

## 1. Cel i zasada jakości

Celem raportu jest dostarczenie kupcowi **krótkiej, selektywnej i udokumentowanej prasówki**, która łączy rzeczywiste notowania, niezależne wyniki Forecast Core, wydarzenia na rynku ropy i warunkową interpretację zakupową.

Raport musi odpowiedzieć na trzy pytania: **co się wydarzyło, co może wpłynąć na najbliższy tydzień i co to może oznaczać dla mojego konkretnego zakupu?** Priorytetem jest istotność informacji, a nie liczba cytowanych artykułów lub objętość tekstu. Jeśli nie ma wartościowych nowych wiadomości, system informuje o braku istotnych potwierdzonych sygnałów; nie wypełnia raportu ogólnikami.

Kanon dotyczy wyłącznie rynku ropy i powiązanych kosztów zakupowych. Nie jest uniwersalnym promptem dla LPG, pszenicy czy innych surowców. Przyszłe raporty branżowe mogą współdzielić infrastrukturę Insights i wzorce redakcyjne, ale muszą mieć własne profile czynników cenotwórczych i źródeł.

## 2. Definicja Insightu i kontekst użytkownika

Podczas tworzenia `OIL_MARKET_OUTLOOK` użytkownik określa:

| Pole | Wymaganie | Znaczenie |
| --- | --- | --- |
| Nazwa Insightu | Obowiązkowe | Np. „Oil Market Outlook — Asphalt”. |
| Benchmarki | Domyślnie WTI i Brent, świadomie zatwierdzone | Wyłącznie zweryfikowane serie z Benchmark Domain; dwa odrębne instrumenty futures. |
| **Kategoria zakupowa** | **Obowiązkowe** | Np. „Asfalt drogowy”, „Paliwa transportowe”, „Surowce petrochemiczne”. |
| Produkt / zastosowanie | Opcjonalne | Uściśla kategorię, jeśli potrzebna jest bardziej konkretna interpretacja. |
| Rynek / region zakupu | Opcjonalne | Np. Polska / Europa Środkowa. Brak nie upoważnia do przyjęcia lokalnych cen lub spreadów. |
| Horyzont decyzji i elastyczność terminu | Opcjonalne | Czy użytkownik musi zakontraktować w tym tygodniu, czy ma możliwość poczekania. |
| **Własne źródła użytkownika** | **Opcjonalne: 0..N adresów HTTPS** | Strony, sekcje portali, publikacje i kanały RSS, które użytkownik chce uwzględniać. |
| Harmonogram, odbiorca, widoczność | Według istniejącego kontraktu Insights | Domyślnie tylko autor/UserID; udostępnienie organizacji wymaga świadomej decyzji i uprawnienia. |

Kategoria zakupowa **nie zmienia matematyki WTI/Brent**. Zmienia dobór kontekstu gospodarczego i treść wskazówki zakupowej. System nie może zakładać marż, formuł indeksacyjnych, wolumenu, pozycji kontraktowej ani terminu płatności, jeśli użytkownik tego nie podał.

## 3. Polityka źródeł: niezależny research + źródła użytkownika

Każdy cykl łączy dwa strumienie poszukiwań:

**A. Niezależny research rynkowy:** priorytet dla weryfikowalnych źródeł pierwotnych i urzędowych, odpowiednio do tematu: EIA, IEA, OPEC/OPEC+, oficjalne dane makroekonomiczne i energetyczne, statystyka zapasów, produkcji, transportu i rafinerii, a następnie wiarygodne publikacje branżowe.

**B. Źródła wskazane przez użytkownika:** system podejmuje próbę sprawdzenia dodanych adresów w każdym cyklu; istotne materiały mogą zasilić `ReportEvidenceBundle`. Są **priorytetem przeglądu, nie automatycznym autorytetem**. Nie mogą wypierać faktów z innych źródeł ani wymuszać z góry określonego wniosku.

**C. Trading Economics (TE):** licencjonowane, ustrukturyzowane źródło kalendarza makroekonomicznego, wiadomości/komentarzy rynkowych, wskaźników, rynkowych notowań i prognoz zewnętrznych. TE dostarcza wyszukiwalne dane i kontekst; nie otrzymuje statusu uniwersalnego źródła prawdy dla futures WTI/Brent, Forecast Core ani źródeł pierwotnych. Szczegółowy kontrakt v0.3 określa §3.1–§3.6.

Dla każdego adresu system przechowuje status: `CHECKED_RELEVANT`, `CHECKED_NO_RELEVANT_UPDATE`, `INACCESSIBLE`, `NOT_CHECKED` albo `UNSUPPORTED`. Status „brak nowości” jest dozwolony tylko po faktycznym, skutecznym sprawdzeniu. Zwykły URL nie oznacza gwarancji odczytania wszystkich treści domeny ani śledzenia stron wymagających logowania.

Dla materiałów, które trafiły do analizy, zachowujemy: URL/identyfikator, tytuł, wydawcę, datę zdarzenia, datę publikacji, datę odczytu, istotność dla ropy i kategorii użytkownika, status potwierdzenia, ograniczenia licencyjne oraz identyfikator dowodu (`evidenceRef`). Materiały o tej samej pierwotnej informacji podlegają deduplikacji. Rozbieżne źródła są opisane jako rozbieżne, nie automatycznie uśredniane.

Adresy użytkownika i pozyskane teksty wymagają kontroli bezpieczeństwa: bez wewnętrznych adresów sieciowych, bez obchodzenia paywalli, bez nieuprawnionej redystrybucji. Treści stron są **niezaufanymi danymi, nigdy instrukcjami systemowymi**. Zestaw adresów należy do definicji użytkownika i nie przechodzi domyślnie do współdzielonego zasobu organizacji.

### 3.1. Trading Economics — zakres i licencja

Dostawca: **Trading Economics** (`sourceProviderId = TRADING_ECONOMICS`, `sourceKind = LICENSED_STRUCTURED_API`). **Właściciel produktu oświadcza, że posiadana subskrypcja obejmuje dostęp do wszystkich serwisów API TE oraz prawo redystrybucji danych w produktach SpendGuru**. To jawne wejście biznesowe do kanonu, a nie domniemanie o bezpłatnej/publicznej licencji. Nie ustanawia się sztucznej przeszkody „brak licencji na dane” w planowaniu raportu. Dla egzekwowalnej integracji należy jednak powiązać wykorzystanie z identyfikatorem/wersją właściwego kontraktu i warunkami atrybucji, retencji i dystrybucji; nie trzeba ponownie kwestionować deklarowanego zakresu, chyba że konkretne postanowienie umowne mu przeczy.

TE jest **kanałem danych**, nie nowym modelem AI, niezależnym Forecast Core ani ogólnym scraperem WWW. Dostęp serwerowy przez przyjęty Source/provider admission, tajny klucz poza kodem, logami, URL i klientem; kontrola limitów/czasów/kosztu/API oraz zgodne przechowywanie. Sama zmiana kanonu nie tworzy uprawnień, grantu ani działającego połączenia TE.

### 3.2. Portfel TE i zastosowanie w raporcie Oil

| Produkt TE API | Status / rola w `OIL_MARKET_OUTLOOK` | Reguła jakości i granica |
| --- | --- | --- |
| **Economic Calendar** | **Wysoki priorytet** dla §5.6 i §5.7: zakończone i zaplanowane publikacje, faktyczne wyniki, konsensus, poprzednia wartość, rewizje i istotność | Zapis `CalendarId`, `Date`, `DateSpan`, `Actual`, `Forecast`, `TEForecast`, `Previous`, `Revised`, `LastUpdate`, `Source/SourceURL`; precyzja terminu i status wyniku rozłączne |
| **News / Analysis** | **Wysoki priorytet** dla selektywnej prasówki i mechanizmów makro/ropa | Komentarz TE jest **źródłem wtórnym**; zachować ID, wydawcę, tekst/licencję, datę, URL, ticker i typ; ważne fakty i twierdzenia przyczynowe weryfikować u źródła pierwotnego |
| **Markets — Quotes / Historical** | WTI, Brent, rafinacja, waluty i **bitumen** jako obserwacje rynkowe i sygnały dla kupca | Każdy rekord ma zidentyfikowany typ ceny/instrumentu, `symbol`, walutę, jednostkę, timestamp i status mapowania do benchmarku; bez automatycznej zamiany na Macrobond |
| **Indicators — Snapshot / Historical / Revisions** | Makro: aktywność przemysłowa, PMI, inflacja, popyt, czynniki rafineryjne i gospodarcze | Rozróżnić okres referencyjny od publikacji i od `asOf`; wzmiankować tylko wskaźniki o uzasadnionym mechanizmie wpływu |
| **Forecasts — Markets / Indicators** | Zewnętrzny kontekst oczekiwań i scenariuszy, jeśli istotny | Prognozy TE odróżnić od 4 modeli D7 SG2, zachować target/okres i czas pozyskania; **nie** mieszać do kanonicznej tabeli Forecast ani miar sMAPE |
| **Financials / Corporate Events** | Opcjonalne tło sektora energetycznego / rafinerii | Nieobowiązkowe dla krótkiej cotygodniowej prasówki; unikać rozbudowy produktu bez wpływu na decyzję kupca |

Dane mogą pochodzić z tych serwisów w jednym wydaniu, lecz `providerId = TRADING_ECONOMICS` nie jest dowodem niezależności kilku rekordów: na przykład komentarz TE o danych EIA i kalendarz TE o tych samych danych **nie są dwoma niezależnymi potwierdzeniami**. Deduplikować je po pierwotnym zdarzeniu i źródle urzędowym.

### 3.3. Underlying: reguła dla WTI, Brent i innych rynków CFD/OTC

**Kanon nie odrzuca CFD/OTC.** Takie kwotowanie może odzwierciedlać ekonomicznie wskazany futures lub jego benchmark. Trzeba jednak ustalić **co dokładnie jest instrumentem bazowym i jak konstruowana jest cena**, a nie zakładać tożsamość tylko na podstawie słowa „WTI”, „Brent” lub zbliżonej wartości.

Dla każdego kandydata TE→Benchmark/Market Data utrwalić, jeżeli dane są dostępne:

- `teSymbol`, `teName`, `teQuoteType` (`CFD`, `OTC`, `FUTURES`, `SPOT`, `OTHER`, `UNKNOWN`), `teMarketDataSource` oraz URL/metadane TE;
- `underlyingAsset`, `underlyingExchange`, `underlyingContractCode`, `underlyingExpiryOrTenor`, `contractSelectionRule` (front month, explicit maturity, continuous, spot/index itp.) i dowód pochodzenia mapowania;
- `canonicalBenchmarkId`, `canonicalInstrumentType`, `currency`, `unit`, `priceConvention`, `asOf`, `tradingSession`, `timeZone`, `quoteTime`, `closeVsLast`, `rolloverMethod`, znacznik opóźnienia i wersję mapy;
- podstawę zgodności: karta instrumentu u TE, symbologia, opis rynku/giełdy, dokumentacja instrumentu bazowego; gdy pola nie są udostępnione, **`UNVERIFIED`**, nie dopisanie z pamięci.

**Status mapowania:** `SAME_INSTRUMENT_VERIFIED` (ten sam instrument i porównywalne zasady obserwacji), `RELATED_UNDERLYING_VERIFIED` (zidentyfikowany bazowy benchmark, lecz cena nie jest identycznym close/settlement), `UNDERLYING_UNRESOLVED` (niewystarczający dowód) albo `MISMATCH` (inny instrument / jednostka / termin). Do zwykłego kontekstu rynkowego można używać danych `RELATED_UNDERLYING_VERIFIED` z jawną etykietą; **do zastąpienia danych Forecast wymagane byłoby osobne przyjęcie tożsamości, obserwacji, rolloveru, praw do serii oraz dowód parytetu.** Nie wolno uznać samego `SAME_INSTRUMENT_VERIFIED` za zgodę na taką zmianę.

TE publikuje rynkowe odniesienia ropy WTI oparte na OTC/CFD i rozróżnia je od oficjalnych rozliczeń NYMEX; odpowiadające dokumenty futures wymagają potwierdzenia serii, kontraktu i konwencji. Endpoint **Markets Symbology** jest pomocą w wyszukiwaniu symboli/ISIN/Bloomberg/Reuters, ale jego istnienie **nie dowodzi**, że dla każdego towaru zwraca ciągłość kontraktu i underlying — wymaga sprawdzenia konkretnych rekordów. **Nie wpisywać w kanonie niezweryfikowanych symboli TE dla WTI, Brent i bitumenu.**

**Bitumen:** TE przedstawia cenę w `CNY/T`, z odniesieniem do rynku chińskiego; opis wskazuje na bitumen drogowy 70# Class-A i handel na Shanghai Futures Exchange. Używać jako *regionalnego wskaźnika sygnałowego*, nie ceny zakupu asfaltu drogowego w Polsce. W razie potwierdzenia mapować także klasę/jakość, region dostawy, specyfikację, walutę, koszty transportu i sezonowość; brak tych danych nie upoważnia do przeliczenia na PLN/t ani bezwarunkowej rekomendacji zakupowej.

### 3.4. Economic Calendar: zdarzenie, wynik, konsensus i rewizja

Dla każdego zdarzenia kalendarza użyć stabilnego `CalendarId`, `Date` w UTC, `Reference/ReferenceDate`, `Source/SourceURL`, `Country`, `Event`, `Importance`, `DateSpan`, `LastUpdate` oraz dostępnych wartości `Actual`, `Previous`, `Revised`, `Forecast` (konsensus), `TEForecast` (odrębna prognoza TE), `Unit` i `Currency`. Wartości nie mogą być mieszane: `Actual − Forecast` stanowi możliwą podstawę opisu zaskoczenia dopiero po zgodnej normalizacji jednostek i gdy obie wartości są dostępne. Brak `Actual` oznacza **wynik nieznany**, a nie zero. `Revised` i `Previous` rozróżniają stan sprzed i po rewizji; ich nazwy i semantyka muszą pozostać zgodne z dokumentacją konkretnego endpointu.

Przy `DateSpan=1` termin traktować jako szacowany; przy potwierdzonej publikacji trzeba odróżnić **czas planowanego zdarzenia**, czas publikacji wyniku i `LastUpdate`. Można korzystać z funkcji point-in-time, ale tylko z rzeczywiście dostępną wersją/snapshotem z chwili `asOf`: retrospektywny bieżący odczyt nie może bez dowodu udawać historycznego konsensusu. Określać precyzyjnie stan (`SCHEDULED`, `RELEASED`, `REVISED`, `CANCELLED`, `UNCONFIRMED`) i nie eksponować przyszłych wyników jako faktów.

Wynik raportu: **kalendarium konkretnych 2–4 zdarzeń**, a nie zrzut całej bazy TE; szczególny priorytet dla istotnych publikacji EIA, danych USA/Chiny/Europa i wskaźników wpływających na popyt i rafinerie. Selekcja według znaczenia dla ropy i danej kategorii zakupowej, nie wyłącznie według `Importance` TE.

### 3.5. News, Forecasts i wartość dla Procurement Insight

Dla wiadomości TE przechowywać `id`, `title`, `date`, `description`, `country`, `category`, `symbol`, `url`, `importance`, `retrievedAt`, `eventAt` (jeżeli dostępny) i `verificationStatus`. Pola i filtry API (m.in. `type=markets`/`economy`, ticker, data, country, indicator) mogą wstępnie ograniczać wyniki, ale **ważność u TE nie jest równoznaczna z ważnością dla kupca asfaltu**. Stosować ten sam filtr: nowość → fakt → mechanizm → wpływ → niepewność → implikacja zakupowa. Uzgodnione prawa do redystrybucji nie uzasadniają kopiowania nadmiarowego tekstu do zwięzłej prasówki; bezpieczniej stosować zredagowane, przypisane źródłu syntezy i kompletne lineage.

Forecasts TE i nasze D7 mają różne modele/cele/horyzonty; można wskazać zgodność albo rozbieżność *kierunku oczekiwań*, lecz nie przedstawiać prognoz TE jako piątego modelu D7, nie przypisywać im sMAPE SG2 ani nie zestawiać bez wspólnego targetu. Odróżniać wynik modelowy TE od konsensusu `Forecast` z kalendarza.

Na kategorii **asfalt drogowy** przydatność TE należy oceniać według transmisji: ropa → rafinacja/pozostałości → bitumen → dostępność regionalna/logistyka → warunki ofertowe kupca. Ceny WTI/Brent i regionalny bitumen pozostają różnymi szeregami; warunkowe rekomendacje zależą od potwierdzenia regionu, formuły indeksacji, FX, ekspozycji, kontraktów i terminu. Jeśli ich brak, deklarować ograniczenie wnioskowania.

### 3.6. Provenance, statusy i rozdział authority

Dla każdej obserwacji/zdarzenia TE w `ReportEvidenceBundle` lub odpowiadającym mu wersjonowanym manifestcie zapisać: `providerId`, `apiFamily`, `endpointVersion`, `vendorRecordId`, `vendorSymbol`, `underlyingMappingRef/status` (dla rynków), `publishedAt`/`eventAt`/`referencePeriod`, `retrievedAt`, `availableAt` albo jawne `UNKNOWN`, `asOf`, `licenceRef`, `redistributionPermitted`, `qualityStatus`, `sourceUrl`, `sourcePrimaryRef`, `evidenceRef`, `contentFingerprint`. Dodatkowo utrzymać metadane rewizji/konsensusu i status porównania dla kalendarza. Pola niedostępne w API pozostają jawnie puste/`UNVERIFIED`; nie domniemywać ich istnienia.

**Hierarchia odpowiedzialności:** Market Data / Benchmark Domain kontroluje ID i typ instrumentu; **Forecast Core nadal wyłącznie kontroluje** kanoniczne ceny do D7, prognozy i ich weryfikację; TE służy jako licencjonowany provider kontekstu i pomocniczych rynkowych szeregów; Source/E1 kontroluje uwierzytelnienie i przyjęcie operacji; Insights selekcjonuje fakty i komponuje raport. Nie tworzyć nowego proxy Forecast ani alternatywnego autorytetu dla jego wyników.

**Zasada niedostępności:** brak odpowiedzi TE, błąd uwierzytelnienia, brak potwierdzonego underlyingu lub pusty wynik News nie oznaczają braku zdarzeń. Oznaczyć odpowiednio `INACCESSIBLE`, `SOURCE_NOT_ADMITTED`, `UNDERLYING_UNRESOLVED`, `CHECKED_NO_RELEVANT_UPDATE` (tylko po udanym, pełnym sprawdzeniu) lub `NOT_CHECKED`. Raport nie może udawać pełnej kompletności ani eksponować niezweryfikowanej wartości jako oficjalnego settlement.

## 4. Profil analityczny rynku ropy — obowiązkowy filtr istotności

Research i selekcja faktów uwzględniają przede wszystkim:

- **Podaż:** decyzje OPEC+, wydobycie, ograniczenia eksportu, sankcje, zakłócenia infrastruktury i transportu.
- **Popyt:** aktywność przemysłowa, konsumpcja paliw, gospodarka Chin/USA/Europy, sezonowość i rafinerie.
- **Bilans krótkoterminowy:** zapasy komercyjne, wykorzystanie rafinerii, dostępność produktów, przepływy regionalne.
- **Makro i finansowanie:** istotne komunikaty banków centralnych, inflacja, aktywność gospodarcza i dolar, wyłącznie jeśli wykazano relewantny mechanizm związku z cenami.
- **Geopolityka:** faktyczne incydenty oraz racjonalnie uzasadnione scenariusze; bez mylenia ryzyka z wydarzeniem potwierdzonym.
- **Transmisja na kategorię kupca:** np. dla asfaltu także sytuacja rafinerii, dostępność bitumu (w tym pomocniczy wskaźnik TE z regionem i jednostką), sezon budowlany, region, transport i formuła kontraktowa. Sam Brent/WTI nie jest ceną asfaltu.

Każde wydarzenie oceniane jest według: **nowość → wiarygodność → mechanizm wpływu → możliwy kierunek/niepewność → znaczenie dla konkretnej kategorii**. Wiadomości nieistotne są pomijane, nawet jeśli pojawiły się w preferowanych portalach.

## 5. Dziewięć obowiązkowych sekcji raportu

### 5.1 Header

Tytuł; wersja raportu; data przygotowania i `asOf`; benchmarki i identyfikatory instrumentów; kategoria zakupowa; ostatnia data obserwacji; daty prognozy `origin` i `target`; zakres analizy tygodniowej; status danych i status akceptacji raportu. Daty D7 od obserwacji i „kolejne 7 dni od publikacji” nie są synonimami.

### 5.2 Executive Snapshot

Maksymalnie trzy istotne wnioski: (1) faktyczny ruch benchmarków, (2) dominujący nowy czynnik lub napięcie rynkowe, (3) najważniejszy sygnał dla kategorii zakupowej. Istotne fakty TE można wykorzystać ze źródłowym `evidenceRef`; ceny TE odróżniać od kanonicznego close i ich underlying. Bez ponownego streszczania całego raportu i bez nieudokumentowanego prognozowania zdarzeń.

### 5.3 Wykresy WTI + Brent — D7

Dwa sąsiadujące wykresy na szerszych ekranach, pionowo na wąskich. Każdy przedstawia osobno: rzeczywiste obserwacje, ostatni close, punkt `origin`, dokładną datę `target D7` i cztery **odrębne prognozy punktowe**: Naive, Damped Holt, ETS, ARIMA. Przy dostępności pośrednich kroków można pokazać ich udokumentowany przebieg; nie wolno interpolować nieistniejących wartości jako wyników modelu. Nie rysować przedziałów 7D bez przyjętej kalibracji. Oznaczyć `EXPERIMENTAL_7D` do formalnego przyjęcia metody. Wykresy korzystają z danych Forecast/Benchmark Domain — nie ze swobodnych obliczeń LLM.

### 5.4 Tabela 1 — Snapshot rynku

Dla WTI i Brent oddzielnie: nazwa i ID serii, ostatnia dostępna cena zamknięcia, data obserwacji, USD/bbl, zmiana 1W wyznaczona z uprawnionych obserwacji porównywalnych oraz status świeżości. Jeżeli brakuje prawidłowego punktu odniesienia, zamiast zmiany wpisać `N/D`. Nie mylić futures, spot, kwotowań CFD/OTC i cen fizycznych produktów pochodnych. Jeśli wskazana jest pomocnicza cena TE, podać typ kwotowania i `underlyingMappingStatus`; nie nadpisywać kanonicznych wartości.

### 5.5 Tabela 2 — Forecast D7 i sprawdzalność

Wiersze: **benchmark × model**. Pola: `lastClose`, `forecastOrigin`, `targetDate`, `forecastD7`, `forecastDeltaPct` (zmiana prognozowana względem origin), ostatnie **dojrzałe** porównanie (`previousOrigin`, `previousTarget`, `previousForecast`, `observedActual`, `lastCaseVerificationPercent`) oraz ocena historyczna (`historicalAverageVerificationPercent`, `directionalAccuracyPercent`, `maturedN`, `quality/limitationStatus`). Przy dużej szerokości tabelę można przedstawić jako dwie tabele WTI/Brent lub wersję skróconą z rozwinięciem; nazwy i znaczenie miar pozostają te same.

Ważne: nie zastępować pojedynczego wyniku poprzedniej prognozy średnią historyczną. „Sprawdzalność 95%” bez wskazania benchmarku, modelu, horyzontu i próby jest niedopuszczalna.

### 5.6 Co wydarzyło się w ubiegłym tygodniu?

Krótki opis rzeczywistego ruchu cen i historycznej zgodności prognoz, następnie **2–4 najistotniejsze wydarzenia** z poprzednich siedmiu dni: makro, podaż/popyt, geopolityka. Przy każdym: co się wydarzyło, kiedy, źródło i dlaczego jest istotne. Selekcja może korzystać z TE News/Calendar, z zachowaniem `CalendarId`/News ID, rozróżnieniem danych urzędowych od komentarzy TE i deduplikacją po zdarzeniu. Związek przyczynowy wyłącznie przy wystarczających dowodach; w pozostałych przypadkach „mogło wpływać”, „jest czynnikiem ryzyka” itp.

### 5.7 Na co patrzeć w najbliższym tygodniu?

**2–4 sygnały**: zaplanowane publikacje, oczekiwane decyzje, czynniki gospodarcze i geopolityczne o znaczeniu dla rynku. Rozróżnić `SCHEDULED`, `RELEASED`, `REVISED`, `CANCELLED` i `UNCONFIRMED`. Podać moment zdarzenia/strefę czasu, jeśli potwierdzony, oraz to, jaki wynik lub rozwój sytuacji mógłby zmienić interpretację. Dla TE wykorzystać `DateSpan` i osobno konsensus `Forecast`, prognozę TE `TEForecast` i ewentualny `Actual`; przyszłe `Actual` jest nieznane.

### 5.8 Procurement Insight — dla kategorii użytkownika

Ostatnia, biznesowo najważniejsza sekcja. W 3–5 zdaniach wskazuje: dominujący scenariusz i jego warunki, ryzyko przyspieszenia versus odroczenia zakupu, jedno lub dwa zdarzenia wyzwalające ponowną ocenę oraz ograniczenia transferu WTI/Brent na produkt użytkownika. Dopuszczalne warianty: `CONSIDER_EARLIER_COMMITMENT`, `CONSIDER_WAITING_FOR_SIGNAL`, `CONSIDER_STAGED_PURCHASE`, `INSUFFICIENT_EVIDENCE` — **jako interpretacje warunkowe, nie bezwzględne instrukcje transakcyjne**. W przypadku asfaltu brak cen lokalnych, podaży bitumu lub warunków kontraktu musi być jawny. Wskaźnik TE bitumenu (np. CNY/t dla rynku chińskiego) może być dodatkowym sygnałem po weryfikacji instrumentu, nie przybliżeniem ceny polskiej bez odrębnego modelu transmisji.

### 5.9 Methodology & caveats

Zwięzłe, obowiązkowe ograniczenia widoczne przy raporcie: typ i waluta instrumentu (dla TE także typ CFD/OTC i status underlying, jeżeli przywołano jego cenę), origin/target D7, status kalibracji, brak pasm, ograniczenia rolloveru i historycznych vintages, poziom weryfikacji oraz zasięg źródeł użytkownika. Rozszerzona metryka przechowuje pełną bibliografię, lineage i wersje, ale nie zastępuje najważniejszych ostrzeżeń w widocznym raporcie.

## 6. Kanoniczna matematyka sprawdzalności — bez drugiego algorytmu

**Źródło prawdy:** Forecast Core oraz istniejąca polityka `FORECAST_VERIFICATION_QUALITY_V1`, konsumowana przez Benchmark Finder. Insights nie liczy alternatywnej „trafności”.

Dla dojrzałego przypadku (`forecast = F`, `actual = A`) zdefiniuj jednostkowy znormalizowany błąd symetryczny:

`e_i = 2 × |F − A| / (|F| + |A|)`; gdy obie wartości są zerowe, `e_i = 0`.

Wówczas **sprawdzalność pojedynczej prognozy**:

`verification_i = clamp((1 − e_i) × 100%, 0%, 100%)`.

Dla wielu dojrzałych porównań użyj tej samej kanonicznej agregacji co Forecast:

`historical_sMAPE_percent = mean(e_i × 100)`  
`historical_verification_percent = clamp(100 − historical_sMAPE_percent, 0, 100)`.

To odpowiada regule użytkowej **(1 − błąd) × 100%**, pod warunkiem, że `błąd` oznacza sMAPE w postaci ułamka, a nie signed error lub `deltaPct`. Nie wolno zamieniać `deltaPct` (prognozowana zmiana ceny od origin) na błąd prognozy.

`directionalAccuracyPercent = clamp(100 × directionalAccuracy, 0, 100)` jest **osobną miarą** poprawnego kierunku względem wartości origin, a nie składnikiem poprzedniego wzoru. `n`, przygotowanie i wiarygodność oceny muszą być pokazane obok procentu. Zaokrąglenia wyłącznie na etapie prezentacji.

**Status D7:** eksperyment D0 korzysta z tej samej rodziny miar (`sMAPE`, `directional_accuracy`) i 40 dojrzałych porównań na serię i model w zbadanym przebiegu; **nie oznacza to jeszcze wdrożenia ani produkcyjnej certyfikacji `FORECAST_VERIFICATION_QUALITY_V1` dla D7**. Dla D7 nie przypisywać bez dowodu miesięcznej polityki progów/poziomów pewności. Przed włączeniem produkcyjnym wymagane jest jawne przyjęcie przez właściciela Forecast i dowód zgodności metryk oraz porównywanych originów w obu interfejsach.

## 7. Analiza wykonywana przez OpenAI

OpenAI otrzymuje wyłącznie wersjonowany, kontrolowany `ReportEvidenceBundle` zawierający: ceny, serię/instrument, cztery prognozy D7 i ich weryfikację, `asOf`, fakty rynkowe wraz z `evidenceRefs`, statusy monitorowania źródeł, kategorię zakupową użytkownika i ograniczenia. Odpowiedź ma postać schematu strukturalnego odpowiadającego dziewięciu sekcjom oraz identyfikatorów referencji. Dopiero renderowanie tworzy raport wizualny.

OpenAI może: porządkować istotność, wyjaśniać zgodności/rozbieżności i mechanizmy wpływu, budować warunkowe scenariusze, redagować tekst. OpenAI nie może: obliczać ani modyfikować liczb Forecast, wymyślać wydarzeń, cytatów, dat, wyników zaplanowanych publikacji, przyjętych przedziałów, modelowego „consensusu” ani własnego współczynnika sprawdzalności.

Model i prompt są wersjonowanymi parametrami wykonania; żaden model nie zostaje „kanonicznie najlepszy” bez odrębnego porównania jakości/czasu/kosztu. Wynik niepewnego żądania (`UNVERIFIED`) nie jest uznawany za ukończony i nie jest po cichu ponawiany.

## 7.1. Kontrakt generowania przez OpenAI — aktualizacja v0.2

Poniższe wymagania są **stałymi regułami jakości i wykonania**. Nie ustanawiają jednego modelu, cennika ani wartości timeout jako normy biznesowej.

1. **Warstwa Author / Composer.** Do wygenerowania narracji i identyfikatorów źródeł stosować Responses API ze ściśle określonym schematem `text.format` / `json_schema` / `strict:true`, o ile wspiera go wybrany i dopuszczony model. Schemat odwzorowuje dziewięć sekcji, oddziela pola liczbowe i referencje od komentarza oraz określa jawne braki danych. Gdy model zwraca odmowę, wynik niekompletny lub brak zgodnego obiektu, nie wolno tworzyć pozornego gotowego raportu. **Zgodność schematu nie stanowi dowodu prawdziwości twierdzeń.**
2. **Oddzielność danych liczbowych i języka.** Ceny, modelowe wartości D7, miary weryfikacji oraz dane wykresów i tabel pochodzą z referencyjnego, wersjonowanego `ReportEvidenceBundle` i Forecast/Benchmark Domain. Composer generuje narrację i referencje, a nie nadpisuje liczb, nie przelicza sMAPE i nie wpisuje samodzielnie wartości tabel.
3. **Model jest parametrem wykonania Insights, nie globalnym fallbackiem SG2.** Konkretny `modelId`, wysiłek rozumowania, budżet tokenów, wersja promptu/schematu i `serviceTier` są związane z operacją i jej dowodem. Nie zmieniać globalnego `OPENAI_MODEL` tylko po to, aby poprawić Insights, jeśli modyfikowałoby to jednocześnie Benchmark Finder lub inne moduły. Model można wybrać dopiero po potwierdzeniu dostępu **rzeczywistym kluczem/konfiguracją SG2**, nie samą polityką „Allow all models” innego, niezweryfikowanego projektu.
4. **Dwustopniowe pozyskanie informacji.** Niezależny research (w tym, po odrębnym Source admission, TE API) i dozwolony odczyt źródeł użytkownika są oddzielnym kontrolowanym etapem Source/Intelligence przed kompozycją. Włączenie Web Search w koncie OpenAI **nie oznacza**, że SG2 ma dopuszczoną operację raportową z wyszukiwaniem. Każda nowa funkcja retrieval musi mieć odpowiedni Source admission, weryfikację źródeł i wynik w `ReportEvidenceBundle`; nie wolno przypisywać modelowi ogólnej zdolności „przeczytania wszystkich podanych portali”.
5. **Czas i zakończenie.** Timeout, liczba tokenów oraz deadline całego `Insight Run` muszą być odpowiednie do uzgodnionego trybu, mierzone i kontrolowane; nie należy używać przypadkowego timeoutu Findera jako domyślnego SLA pełnego raportu. Rozróżniać co najmniej operacyjne wyniki `COMPLETED`, `INCOMPLETE`, `REFUSED`, `FAILED`, `UNVERIFIED` (nazwy logiczne, bez wymuszania nowego schematu). `UNVERIFIED` po wysłaniu żądania nie oznacza „nie wysłano” ani „koszt zero”; nie wykonywać ukrytego ponowienia. Tryb background wymaga niezależnej akceptacji sposobu odczytu, anulowania, retencji i własności odpowiedzi.
6. **Audyt i diagnostyka bez sekretów.** Dla każdego wywołania utrwalać własny `runId`/correlation ID, identyfikator operacji Source, identyfikator modelu, wersje schematu i promptu, znacznik wejściowego `ReportEvidenceBundle`, czasy, wynik, faktycznie zwrócone `usage` i rozliczenie kosztu lub ich status `UNKNOWN`. Rejestrować `x-request-id` / `x-client-request-id` oraz Response ID, **gdy dostępne i bezpiecznie dopuszczone przez kontrakt transportu**. Brak identyfikatorów nie może być zastąpiony domniemaniem sukcesu. Sentry nie powinno przechowywać pełnych promptów, treści prywatnych, kluczy ani odpowiedzi wrażliwych.
7. **Budżet i publikacja.** Każda próba i recenzja mają osobną kontrolę kosztu, rezerwację i rozliczenie według E1/Package & Limits; alert z portalu dostawcy nie jest jedyną blokadą budżetową. Nie wolno utożsamiać limitów żądań Source z pieniędzmi lub OpenAI RPM/TPM. Po kompozycji obowiązują wszystkie kontrole §8, limit objętości §9 i ręczne dopuszczenie pilota.

**Rozdział odpowiedzialności:** ten kanon określa wymogi, natomiast wartości operacyjne modeli, timeoutów, tokenów, budżetów i polityk retencji należą do oddzielnego, wersjonowanego **OpenAI Execution Profile**. Ich proponowane wartości nie są automatyczną zgodą na zmianę Source, klucza, wdrożenia ani finansowego limitu organizacji.

## 8. Quality Gate — to, co naprawdę chroni wartość prasówki

Warunki do sprawdzenia przed dopuszczeniem wydania:

1. **Forecast parity:** wszystkie ceny, daty, jednostki, 4 modele i miary zgodne z referencyjnym Forecast/Benchmark Finder; brak dodatkowej matematyki w Insights.
2. **Źródła i czas:** każda znacząca teza ma `evidenceRef`, a informacja była dostępna w chwili `asOf`; przyszłe wydarzenie nie jest dokonanym faktem. Dla TE weryfikować `CalendarId`, `DateSpan`, `Actual`/`Forecast`/`TEForecast`, rewizje i niezależność pierwotnego źródła.
3. **Własne portale:** rozliczone statusy prób sprawdzenia; brak pozorowanego monitorowania i fałszywego zapewnienia, że portal nie opublikował nic nowego.
4. **Relewancja:** każda istotna wiadomość zawiera uzasadniony mechanizm związku z ropą oraz, gdy dotyczy, kategorią użytkownika. Powtórzenia tej samej informacji nie zwiększają jej wagi.
5. **Wartość przyrostowa:** raport pokazuje istotną zmianę względem poprzedniego tygodnia lub stwierdza brak potwierdzonych nowych sygnałów. Nie dopisuje generycznych akapitów.
6. **Procurement utility:** końcowy wniosek wyjaśnia warunki decyzji, możliwe koszty pomyłki i sygnały do rewizji; nie przenosi mechanicznie zmiany futures na cenę asfaltu.
7. **Ograniczenia:** ujawnione nieprzyjęte D7, rollover, brak pasm, latest-vintage i zakres geograficzny danych.
8. **Redakcja i forma:** dziewięć sekcji; język zrozumiały dla kupca, bez sztucznej pewności i powtórzeń; deterministyczna kontrola objętości.
9. **Niezależna recenzja:** sprawdzenie liczb i źródeł kodem, odrębna ocena merytoryczna/redakcyjna oraz obowiązkowa akceptacja człowieka w pilotażu; utrwalenie wyniku dla dokładnej wersji raportu. **Dodatkowy TE gate:** żaden rynkowy rekord CFD/OTC nie zastępuje kanonicznej obserwacji bez dowodu instrumentu bazowego, konwencji i oddzielnej adopcji; każda regionalna cena bitumenu ma etykietę jednostki i rynku.

Wynik może być `PASS`, `NEEDS_REVISION` lub `BLOCKED`. Brak wystarczających faktów lub dowodów dla rekomendacji oznacza `INSUFFICIENT_EVIDENCE` w treści i odpowiednią decyzję recenzenta. Zmiana treści po recenzji unieważnia poprzedni `PASS`. Bez `APPROVED_FOR_PUBLICATION` nie ma publikacji, PDF ani wysyłki.

## 9. Długość i reprezentacja

W istniejącym kandydacie `Procurement Insights Canon v1.0` obowiązuje propozycja **maksymalnie 4000 znaków ze spacjami dla widocznej treści wraz z tabelą**. Ten dokument **nie zmienia samodzielnie** tej reguły. Dla tak zdefiniowanych dziewięciu sekcji, dwóch wykresów i dwóch tabel może ona okazać się zbyt restrykcyjna. Rozdzielenie limitu narracji i danych tabelarycznych jest **propozycją do osobnej decyzji właścicielskiej**, po testach na realnym raporcie. W pilotażu raport należy uczciwie oznaczyć jako niezgodny z limitem, jeśli się w nim nie mieści; nie wolno ukrywać ostrzeżeń ani danych dla pozornego zaliczenia.

Wizualizacje, tabele, wersje i pełna lista źródeł są odrębnymi elementami struktury raportu, ale muszą powstawać z tego samego zestawu liczb i dowodów. Układ desktop: dwa wykresy obok siebie; mobile: jeden pod drugim. Osobna lista „Wykorzystane źródła” i „Status źródeł użytkownika” może być rozwijalna, bez sztucznego wydłużania głównej prasówki.

## 10. Wydania, zasięg i odpowiedzialność

Jedna definicja użytkownika może tworzyć wiele niezmiennych tygodniowych wydań. Każde wydanie ma identyfikator i fingerprint: `definitionId`, `runId`, `reportVersionId`, `authorUserId`, `asOf`, `forecastRefs`, `evidenceManifest`, `sourceCheckManifest`, `modelId`, `promptVersion`, `reviewVersion`, `approvedAt` (jeśli dotyczy) oraz status publikacji i doręczenia. Brak automatycznego udostępnienia preferowanych źródeł lub kontekstu zakupowego całej organizacji. Publikowane dane TE podlegają deklarowanej licencji redystrybucyjnej, a ich provenance zachowuje dostawcę, klasę danych, datę oraz potwierdzoną tożsamość underlyingu tam, gdzie dotyczy.

Dane Forecast pozostają własnością Forecast Core; ceny i identyfikatory rynkowe — Market Data/Benchmark Domain; licencjonowane rekordy TE — provider Source i właściwy zasób danych, bez zmiany autorytetu Forecast; informacje dostępowe — E1/Source; raport, recenzja i publikacja — Insights. Nie tworzyć drugiego Forecast Core, konkurencyjnej tabeli sprawdzalności, własnego proxy Macrobond ani osobnego mechanizmu CIC. Bez osobnej zgody nie ma merge, deploymentu, nowego Source grant ani automatycznej publikacji.

## 11. Minimalny test pilotażowy

Po potwierdzeniu właściwego projektu/klucza i dopuszczeniu bezpiecznej, rozliczanej operacji OpenAI wykonać najpierw **jedną pełną próbę z potwierdzonym wynikiem**. **Wydany już kandydat B1 i jego dokładne request/evidence SHA nie są automatycznie zmieniane przez ten kanon**. Jeśli właściciel zdecyduje o dodaniu TE do tej jednej próby, potrzebne są nowe zamrożone `ReportEvidenceBundle`, `asOf`, źródłowe dowody, fingerprint i odrębne przyjęcie dokładnego artefaktu przed GO; nie wolno dopisać nowych zdarzeń TE retrospektywnie do starego `asOf`. Nie opóźniać już przygotowanego B1 samym faktem istnienia nowego źródła, jeżeli właściciel nie zarządzi rewizji jego danych. Następnie, na rzeczywistym pakiecie WTI/Brent, wykonać co najmniej dwa porównywalne przebiegi: **A:** niezależny research bez własnych adresów; **B:** ten sam benchmark/kategoria i dodatkowe źródła użytkownika. Obydwa na tym samym zestawie danych Forecast, z utrwalonymi informacjami `asOf`. Porównać istotność i nowość informacji, zgodność źródeł, poprawność matematyki, trafność mechanizmów wpływu, konkretność porady dla asfaltu, błędy, czas i koszt API. Raport odrzucony przez recenzję pozostaje dowodem eksperymentu, nie materiałem do publikacji.

## 12. Otwarte decyzje do formalnej akceptacji

**Nowe decyzje v0.3 (Trading Economics):**

- Przyjęcie **włączenia TE do polityki źródeł Oil** w zakresie Economic Calendar, News, Markets, Indicators, Forecasts i opcjonalnych Financials; bez ustanawiania TE kanonicznym Forecast Core. Uprawnienie do redystrybucji jest zadeklarowane przez właściciela produktu; pozostała ewidencja kontraktowa/atrybucja do wykonania przy integracji.
- Odrębny **Source admission i provider binding** TE (sekrety, limity, monitorowanie, retencja i lineage) — sama akceptacja kanonu nie aktywuje pobierania ani nowych grantów.
- **Instrument/underlying mapping acceptance:** mapy WTI, Brent, bitumen i powiązanych produktów; identyfikator TE, kontrakt bazowy, terminy, rollover, sesja i cena quote/settlement. Żaden zgodny ticker nie zmienia bezpośrednio serii Macrobond `cl_c1_cl` / `b_c1_cl`.
- Czy **aktualną jedną próbę B1** wykonać na wcześniej zamrożonym evidence (domyślnie bez zmian), czy jawnie utworzyć i zatwierdzić nowy evidence bundle uwzględniający TE. To odrębna decyzja zakresu pilota, nie automatyczny skutek v0.3.


- Przyjęcie matematyki i kontraktu **D7** przez właściciela Forecast oraz zgodnego mapowania jakości w Benchmark Finderze/Insights; osobno brak pasm i niepotwierdzony rollover.
- Czy limit 4000 znaków dotyczy całej widocznej zawartości, czy samej narracji po wyłączeniu tabel i etykiet wizualizacji — wymaga zmiany właściwego kanonu nadrzędnego.
- Precyzyjna polityka pobierania źródeł użytkownika (liczba URL, cadence, limity techniczne, RSS/API, licencje, archiwizacja) i odpowiedni Source admission.
- Zakres informacji opcjonalnych o zakupie oraz ich uprawnienia i retencja.
- Kryteria oceny branżowej jakości raportu po pierwszych rzeczywistych przebiegach OpenAI API.
- Potwierdzenie projektu i uprawnienia **klucza faktycznie używanego przez SG2 Development**; polityka dozwolonych modeli na koncie nie wystarcza.
- Formalnie dopuszczona operacja dłuższego generowania w Source, diagnostyka identyfikatorów i rozliczanie `UNVERIFIED`; bez zmian globalnych timeoutów Findera.
- Dopuszczenie kontroli Web Search / stron użytkownika do Source i uzgodnienie retencji, zanim raport uzna te dane za monitorowane.
- Wybór i zatwierdzenie wersjonowanego profilu uruchomieniowego OpenAI na podstawie wyników pilota, a nie samej dostępności modelu.

## 13. Trading Economics — źródła dokumentacyjne i weryfikacja

Dostępne publicznie kontrakty dokumentacyjne TE użyte do tej aktualizacji (odczyt 2026-11-03):

- API overview i uwierzytelnienie: https://docs.tradingeconomics.com/get_started/
- Calendar: pola i point-in-time: https://docs.tradingeconomics.com/economic_calendar/schema/ oraz https://docs.tradingeconomics.com/economic_calendar/point-in-time/
- News (w tym `type=markets`/`economy`): https://docs.tradingeconomics.com/news/news-by-type/
- Market quotes, historical i symbology: https://docs.tradingeconomics.com/markets/symbols/ , https://docs.tradingeconomics.com/markets/historical/ , https://docs.tradingeconomics.com/markets/symbology/
- Forecasts rynkowe: https://docs.tradingeconomics.com/forecasts/markets/
- Opis instrumentów referencyjnych: https://tradingeconomics.com/commodity/crude-oil , https://tradingeconomics.com/commodity/bitumen

**Granica dowodu:** dokumentacja publiczna potwierdza istnienie rodzin API i przykładowych pól, **nie** potwierdza konkretnych symboli/underlying w licencjonowanym strumieniu ani odpowiedzi dla klucza użytkownika. Taką weryfikację należy wykonać po osobnym przyjęciu połączenia TE, bez sekretu w kodzie lub logach. Nie wykonano w ramach tej rewizji wywołania uwierzytelnionego TE ani OpenAI.

**Status tej wersji:** `PROPOSED_FOR_OWNER_REVIEW` — v0.3 uwzględnia Trading Economics jako pełnoprawne licencjonowane źródło kontekstu Oil. **Nie** jest aktywacją źródła, zmianą już zaakceptowanych bajtów v0.2, zmianą modelu w SG2, certyfikacją D7, zgodą na merge/deployment ani GO na płatne API.
