# Platform Source Hub — inwentarz API i wymagań funkcjonalnych

Stan analizy: **2026-11-05**. Baza kodu: [`8dfe12b9311f24227c904c13900e373aea518490`](https://github.com/profitia/SG-dev/blob/8dfe12b9311f24227c904c13900e373aea518490). Zakres: dokumentacja i UX discovery SG2; provider adapters i kontrakty Architecture Platform pozostają bez zmian. To materiał analityczny, nie rozszerzenie kanonu ani aktywacja nowych funkcji.

Rejestry: **518 wierszy parametrów/operatorów**, **3352 wierszy pól odpowiedzi i nagłówków**, **67 metod/wariantów endpointów**, **44 przykładów**. Powtarzające się nazwy mają osobne wiersze dla każdego endpointu. Pełne ścieżki zagnieżdżone Brave są rozwinięte, łącznie z opcjonalnymi bogatymi klastrami; `any` oznacza nieopublikowany schemat potomny, którego nie dopisujemy.

## Jak korzystać

- [Parametry CSV](SOURCE-HUB-API-PARAMETERS.csv) — wszystkie wymagane22 kolumny oraz lokalizacja, wykonanie u providera, ograniczenia Hub i zakres dowodu.
- [Pola odpowiedzi CSV](SOURCE-HUB-API-RESPONSE-FIELDS.csv) — osobny rejestr; `[].` oznacza element listy, `[]` w Brave tablicę, `?` opcjonalność w schemacie. Optional nie jest automatycznie gwarancją nullable.
- [Kompatybilność](SOURCE-HUB-PARAMETER-COMPATIBILITY.md), [macierz UX](SOURCE-HUB-UX-FUNCTIONAL-MATRIX.md), [przykłady](SOURCE-HUB-QUERY-EXAMPLES.md), [skoroszyt](SOURCE-HUB-API-INVENTORY.xlsx).
- CSV: UTF-8 z BOM, separator przecinek, cudzysłowy zgodne z CSV. W Excelu importować jako UTF-8/przecinek; kody, identyfikatory i przykłady jako tekst. XLSX zachowuje przykłady jako tekst, nie formuły.

## Cztery niezależne poziomy pewności

`Implemented` dotyczy kodu Hub; `Partial` oznacza podzbiór, stałą techniczną lub inną semantykę; `Missing` brak ekspozycji; `Unsupported` celowo niedostępne/niepotwierdzone jako parametr. Nie są deklaracją gotowego ekranu.

`Live Verified` dotyczy wyłącznie dokładnej próby i wartości opisanych w Verification scope. `Offline Verified` to kod i testy bez dostawcy, `Documented` tylko referencja, `Unknown` nierozstrzygnięta rozbieżność. HTTP200 nie jest dowodem działania wszystkich filtrów. Ustawienia pominięte w żądaniu nie są osobno LIVE verified.

`Confirmed` oznacza zaobserwowany dostęp do konkretnej operacji w istniejącym dowodzie, nie potwierdzenie pełnego pakietu praw do treści. `Unknown` to niezweryfikowany zakres planu/praw danego parametru. `Entitlement Required` oznacza dodatkowy plan lub formalne przyjęcie przed użyciem. Deklaracja właściciela licencji i aktywne admission nie zastępują szczegółowego zakresu produktów dostawcy.

`Filter execution` opisuje faktyczną drogę w Hub, jeśli istnieje; `Provider execution` odrębnie wskazuje natywną możliwość dostawcy. Wiersze `Hub only/local` są jawnie oznaczonymi kryteriami kontraktu, **nie nowymi parametrami providera**. Operatory mają lokalizację `q — składnia`.

## Bieżąca implementacja i dowody

Hub **1.0.0**, Newsfeed **1.0.0**, zgodność NewsDiscovery **0.1.0**. Rodziny kontraktu: news-discovery, economic-calendar, indicators, external-forecasts oraz przyszła market-observations. Kod capabilities nadal raportuje `IMPLEMENTED_OFFLINE_VERIFIED`; nie zmieniamy go na podstawie trzech pojedynczych prób.

[Istniejący handoff LIVE](https://github.com/profitia/project-history-repository/blob/fffda7053c25affbb84984633a30dd1543153a87/history/2026/11/05/2026-11-05-16-51-27Z__architecture-architecture-source-hub-live-providers-phr-recovery-20261105/handoff.md) potwierdza po jednej próbie: NewsAPI Everything `oil/page=1/pageSize=3`; Brave Web `oil/count=3/offset=0/spellcheck=false`; TE News `/news`, następnie lokalnie `text=oil/limit=3`. Każda dała3 rekordy do Newsfeed. Brak LIVE zaawansowanych operatorów, Calendar, Indicators i Forecasts. Niniejsze zadanie: **0 nowych wywołań API, 0 zmian usług/baz/uprawnień**.

Sześć dopuszczeń Development pozostaje UNMETERED. Liczba rekordów/znaków/rozmiar odpowiedzi/timeout to ograniczenia techniczne lub dostawcy, **nie przywracane kwoty API**. TE Markets Forecasts pozostaje domyślnie wyłączone. Retencja treści providerów w bieżącym Development wynosi0s; nie projektować trwałej biblioteki pełnych artykułów na tej podstawie.

## NewsAPI — interpretacja i ograniczenia

Everything przeszukuje bazę artykułów, top-headlines bieżące nagłówki, sources katalog wyłącznie wydawców headlines. Id źródła nie zawsze istnieje. `content` to fragment do200 znaków; Hub nie deklaruje pełnego tekstu.

Everything: q do500znaków i obowiązkowe URL-encoding, maks.20 sources, searchIn title/description/content, from/to, language, sortBy, page/pageSize. Hub waliduje długość przed kodowaniem URL; referencja nie rozstrzyga odrębnie sposobu liczenia po kodowaniu. `qInTitle` nie ma w aktualnej referencji; odpowiednik to q + searchIn=title.

Udokumentowany enum języków: `ar de en es fr he it nl no pt ru sv ud zh`. `ud` zachowuje zapis dostawcy; nie przypisujemy mu automatycznie standardu językowego. `pl` nie jest językiem API, choć istnieje kraj wydawcy pl. Bieżąca lista country Headlines zawiera **us**; stary przykład Germany/de na tej samej stronie jest niespójny z listą. Nie rozszerzamy przez analogię.

Kraj edycji nagłówków ≠ kraj wydawcy ≠ miejsce wydarzenia. Kategoria wydawcy/nagłówków nie jest kategorią każdego artykułu Everything. Metadane języka/kategorii artykułu mogą pozostać null nawet przy użyciu filtra. Historia, opóźnienie, maksymalna liczba pobieralnych wyników i redystrybucja zależą od planu; totalResults nie oznacza pełnej dostępności. [Referencja Everything](https://newsapi.org/docs/endpoints/everything), [Headlines](https://newsapi.org/docs/endpoints/top-headlines), [Sources](https://newsapi.org/docs/endpoints/sources).

## Brave — Web, klaster news i dedykowane News

Hub wywołuje tylko `/res/v1/web/search`. `resultType=news` wybiera jego klaster news; nie jest wywołaniem odrębnego `/res/v1/news/search`. Web: q600znaków/75słów, count1..20, offset0..9; count dotyczy tylko web, strony mogą się pokrywać. Dedykowane News: q400znaków/50słów, count1..50, domyślne SafeSearch strict zamiast Web moderate. Ten endpoint nie jest zaimplementowany w Hub ani potwierdzony zakupionym zakresem.

country domyślnieUS, search_lang en, ui_lang en-US. ALL trzeba ustawić jawnie. Bieżący enum dostawcy zawiera en-gb, ja, pt-br, pt-pt, których Hub nie przyjmuje; Hub przyjmuje jeszcze pt, którego nie ma w nowej tabeli. uiLanguage Hub sprawdza wzorem xx-YY zamiast enumem. Rejestr zachowuje pełne aktualne enumy, a nie tylko wartości obecnego adaptera.

freshness pd/pw/pm/py oznacza24h/7d/31d/365d albo zakres dat strony, wyznaczany z publikacji **lub modyfikacji**. `publishedAt` Brave pozostaje null; age/page_age to osobne providerDateMetadata. spellcheck może wykonać zmienione query; Hub zachowuje tylko Boolean providerQueryAltered. Hub nie zachowuje oryginalnego/zmienionego tekstu ani `query.search_operators.applied` / flag `search_operators_fallback` wyników.

Goggles zmienia ranking, nie gwarantuje ścisłego filtra. result_filter pozwala dostawcy wybrać wiele klastrów zależnie od planu; Hub tylko pojedynczy web/news. text_decorations=false i operators=true są stałe Hub. summary dotyczy klucza usługi summarizer, nie gotowej funkcji AI Newsfeed. extra_snippets ma w referencji typ string, ale Hub używa Boolean; tę rozbieżność zapisano jawnie. Nagłówki lokalizacji są przyszłą opcją wymagającą celu i świadomego udostępnienia danych klienta, a nie domyślnym filtrem miejsca zdarzenia. [Web reference](https://api-dashboard.search.brave.com/api-reference/web/search/get), [News reference](https://api-dashboard.search.brave.com/api-reference/news/news_search/get).

### Wszystkie oficjalnie opisane operatory Brave

**Wszystkie są eksperymentalne i nie były weryfikowane LIVE w przyjętym dowodzie.** Hub przekazuje składnię, bez gwarancji logicznej. AND/OR/NOT zapisuje się wielkimi literami. Wiersz nawiasów to celowo zaznaczona luka, nie potwierdzony operator. Nie dodajemy inurl/before/after jako pewnych możliwości. Źródła: [API operators](https://api-dashboard.search.brave.com/documentation/resources/search-operators), [Brave Help](https://search.brave.com/help/operators).

| Operator / aliasy | Składnia | Znaczenie | Przykład biznesowy | UX |
| --- | --- | --- | --- | --- |
| AND | A AND B | Wymaga obu pojęć według deklaracji operatora. | oil AND demand | Wszystkie słowa |
| OR | A OR B | Alternatywne pojęcia; nie gwarantuje grupowania nawiasów. | asphalt OR bitumen | Dowolne z podanych słów |
| NOT | A NOT B | Wykluczenie słowa lub warunku. | oil NOT cooking | Wykluczone słowa |
| + | +słowo | Preferencja obowiązkowego wystąpienia wskazanego słowa w deklarowanej semantyce. | refinery +outage | Wymagane słowo |
| - | -słowo | Wykluczenie wskazanego słowa. | oil -cooking | Wykluczone słowo |
| "…" | "dokładna fraza" | Wyszukiwanie frazy w podanej kolejności. | "OPEC+" production | Dokładna fraza |
| site: | site:domena | Ograniczenie witryny/domeny; wykluczenie przez -site: lub NOT site:. | oil site:iea.org | Domeny włączone / wykluczone |
| intitle: | intitle:słowo | Wskazane pojęcie w tytule strony. | intitle:refinery outage | Szukaj w tytule |
| inbody: | inbody:słowo | Wskazane pojęcie w treści strony. | inbody:bitumen demand | Szukaj w treści |
| inpage: | inpage:słowo | Wskazane pojęcie w tytule lub treści strony. | inpage:asphalt supply | Szukaj na stronie |
| lang: / language: | lang:kod / language:kod | Język treści; używać kodów z dokumentacji, a nie języka UI. | bitumen lang:en | Język tekstu — operator |
| loc: / location: | loc:kod / location:kod | Region/kraj witryny lub wyników; nie dowód miejsca zdarzenia. | refinery loc:gb | Region wyszukiwania — operator |
| ext: | ext:rozszerzenie | Rozszerzenie pliku strony, np.pdf. | "oil outlook" ext:pdf | Rodzaj dokumentu |
| filetype: | filetype:typ | Typ pliku, np.pdf; odrębny udokumentowany operator. | bitumen filetype:pdf | Rodzaj dokumentu |
| (…) | (A OR B) AND C | Grupowanie NIE jest potwierdzone na przejrzanych oficjalnych stronach Brave. Nie obiecywać drzewa logicznego z tą semantyką. | (Brent OR WTI) AND oil | Przyszłe grupy dopiero po dowodzie semantyki |

Łączenie operatorów jest możliwe jako tekst q, lecz pierwszeństwo i grupowanie nawiasów nie zostały ustalone przez przejrzane strony. `domains` w Hub generuje nawiasy i OR, następnie niezależnie sprawdza hosty lokalnie; lokalny dowód domeny nie oznacza kompletnego wyszukania sieci. Dla query.search_operators.applied dostawca opisuje true jako pełne ścisłe dopasowanie, false jako częściowe/ignorowane operatory; obecny Hub odrzuca te metadane. Nie przedstawiać zaawansowanego kreatora jako ścisłego silnika Boolean bez przyszłej walidacji.

## Trading Economics — interpretacja rodzin

**News:** type=markets/economy, kraj, kategoria/indicator, ticker i daty mają odrębne ścieżki. Nie ma udokumentowanego natywnego fulltext q w przejrzanej referencji REST. Hub text to lokalny substring Title/Description. Latest News ma native limit/start, ale obecny Hub ich nie wysyła i tnie dopiero pobrany podzbiór. Nie podajemy nieudokumentowanego sortBy ani jednolitej paginacji wszystkich metod. Historyczne wiadomości mogą być selekcjonowane d1/d2 na wskazanych ścieżkach, zależnie od planu. Ticker+date i type+inne selektory nie są przyjęte w Hub. Country TE może być krajem, regionem lub klasą typu Commodity; nie jest krajem wydawcy ani wywnioskowaną geolokalizacją. [News](https://docs.tradingeconomics.com/news/latest/), [typy](https://docs.tradingeconomics.com/news/news-by-type/).

**Calendar:** termin wydarzenia UTC, okres referencyjny, aktualizacja i pobranie są różnymi datami. Actual to bieżąca publikacja; Previous poprzedni okres **po rewizji**; Revised poprzednio raportowana wartość **sprzed rewizji**. Forecast to konsensus ekonomistów, TEForecast własna prognoza TE. DateSpan0 oznacza znany termin,1 szacunkowy. Status Hub REPORTED/SCHEDULED/UNKNOWN jest wyprowadzony z Actual i relacji czasu, nie jest dostarczonym przez TE pełnym statusem anulowania/przełożenia. Numeric values=true dodaje cztery pola *Value tylko JSON; Hub ich nie pobiera ani nie zachowuje. Nie parsować 178K, procentów i walut naiwnie.

Ticker+zakres dat istnieje u dostawcy, lecz nie w Hub. group, dokładny event w ścieżce, lang, katalog wydarzeń/indicators, updates, streaming i ICS są opisane osobno jako możliwości przyszłe. **Strona point-in-time pokazuje zwykłą ścieżkę kalendarza z historycznym okresem, bez jednoznacznego parametru asOf/vintage. Nie jest to wystarczający dowód odtwarzania oryginalnej publikacji.** [Schema](https://docs.tradingeconomics.com/economic_calendar/schema/), [PIT](https://docs.tradingeconomics.com/economic_calendar/point-in-time/).

**Indicators:** snapshot /country/{country}, /country/all/{indicator}, /country/ticker/{ticker}. countries+indicators w Hub to snapshot kraju z lokalnym dopasowaniem Category. Native group snapshotu oznacza CategoryGroup, a Group katalogu krajów oznacza związki regionalne/organizacyjne — różne pojęcia. Frequency, Unit, LatestValueDate i LastUpdate są polami odpowiedzi, bez potwierdzonych równoważnych filtrów zapytania. Historia obserwacji /historical jest odrębną metodą, nie jest obsługiwana przez obecny Hub. LatestValueDate jest okresem wartości; opis dostawcy bywa sformułowany jako data ostatniej publikacji, dlatego nie wykorzystywać go jako dokładnego czasu release bez dodatkowego dowodu. CategoryGroup, Adjustment, CreateDate, FirstValueDate, Highest/LowestValue nie są zachowywane w aktualnym normalized/native. [Snapshot](https://docs.tradingeconomics.com/indicators/snapshot/), [historia](https://docs.tradingeconomics.com/indicators/historical/).

**Indicator Forecasts:** q1..q4 i daty q1_date..q4_date oraz YearEnd/YearEnd2/YearEnd3 to pola odpowiedzi. Hub horizons to lokalna projekcja, nie query do TE. YearEnd oznacza bieżący rok, kolejne pola dwa następne; brak explicit YearEnd_date w schema, więc targetDate pozostaje null. ForecastLastUpdate nie daje dostępu do poprzednich vintage. Dokumentacja aktualizacji ma rozbieżność /forecasts/updates versus /forecast/updates — oba warianty niezweryfikowane i poza Hub. Prognozy TE pozostają zewnętrzne, forecastCorePrediction=false. [Prognozy](https://docs.tradingeconomics.com/forecasts/indicators/), [updates](https://docs.tradingeconomics.com/forecasts/updates/).

**Market Forecasts — WYŁĄCZONE:** pięć kategorii index/currency/crypto/commodity/bond oraz odrębny natywny endpoint /markets/forecasts/symbol/{symbols}. Hub potrafi tylko snapshot kategorii i lokalny wybór symboli; nie wywołuje native symbol route. CO1:COM (Brent) i CL1:COM (Crude Oil/WTI) są przykładami identyfikatorów w oficjalnej dokumentacji, wymagają odświeżenia katalogu i nie są przyjętą mapą Market Data SpendGuru. Forecast1..4 i ForecastDate1..4 to horyzonty odpowiedzi. Schema oznacza ForecastDate jako number mimo daty w przykładach; Last ma niejasny opis „ostatniej prognozy” przy przykładzie przypominającym cenę. Nie używać tych niejasności jako danych kanonicznych Forecast Core/Benchmark. Wymagane osobne entitlement, potrzeba raportu i przyjęcie. [Markets Forecasts](https://docs.tradingeconomics.com/forecasts/markets/), [Search](https://docs.tradingeconomics.com/markets/search/), [Symbology](https://docs.tradingeconomics.com/markets/symbology/), [przykłady identyfikatorów w oficjalnym MCP](https://docs.tradingeconomics.com/mcp/tools/).

### Katalogi dynamiczne i granice protokołów

Kraje/ISO/regiony: GET /country. Kategorie/CategoryGroup: GET /indicators. Kategorie kalendarza: GET /indicators?calendar=1, opcjonalnie country. Wydarzenia: GET /calendar/events/country/{country}. Tickery/CalendarId/HistoricalDataSymbol odczytywać z odpowiednich rekordów, nie z wymyślonej stałej listy. Symbole Markets wyszukiwać przez /markets/search i sprawdzać /markets/symbology. Ścieżki pomocnicze Markets Search/Symbology służą tu identyfikacji katalogu; ich dane notowań nie rozszerzają zakresu o pełne Quotes/Historical Markets/Financials.

Nie ma potwierdzonego pełnego katalogu grup kalendarza w przejrzanych źródłach. Katalog krajów Group/Continent można wykorzystać u konsumenta do wyznaczenia krajów — nie udawać natywnego filtra countryGroup. Metody SDK i oficjalne MCP mają własne nazwy argumentów oraz inne envelope; nie przenosimy ich parametrów lub struktury columns/rows do REST.

TE ogólnie dokumentuje URL do260 znaków, Calendar do1000 rekordów/żądanie, historyczne dane do10000 rekordów i ogólną częstotliwość2 żądania/s; szczegóły zależą od planu. Hub dopuszcza ścieżkę do1024 znaków i listy do10 nazw, co nie gwarantuje przyjęcia długiego URL przez TE. Te granice należy pokazać jako ograniczenia transportu/dostawcy, bez zmiany sześciu polityk UNMETERED. [Rate limits](https://docs.tradingeconomics.com/get_started/rate-limits/).

## Normalizacja, provenance i użycie w raporcie

W rejestrze mapowania `payload.*` i `metadata.*` są ścieżkami pojedynczego items[]; skrót `native.*` oznacza payload.native, **nie pełny surowy JSON**. Hub wybiera whitelistę pól, a nie zachowuje całej odpowiedzi providera. Envelope używa `page.page/pageSize/total/more/truncated`; dostępność total/more bywa null. Metadata zawiera providerId, apiFamily, vendorRecordId lub null, sourceRecordRef, contentFingerprint, sourceUrl, retrievedAt, availableAt/asOf lub null, licenceRef, retentionUntil, qualityStatus i usageReceiptRef. fingerprint zapewnia spójność rekordu, nie ocenę prawdziwości.

Provider-reported nie znaczy zweryfikowane merytorycznie. Calendar consensusForecast/vendorForecast i wskaźniki value/referencePeriod muszą zachować Unit/Frequency/źródło. NewsAPI content i Brave snippets to fragmenty; otwarcie i ocena źródła oraz selekcja materiału należą do Insights. Hub nie tworzy raportu, nie ocenia evidence i nie przejmuje Composer/ReportEvidenceBundle. E1, izolacja i aktualne admission obowiązują niezależnie od formularza. Wartości null/unknown nie stają się zerem ani datą pobrania.

## Pełny katalog metod i parametrów

Poniższe tabele obejmują każdy wiersz rejestru. CSV dodatkowo zawiera osobno wymaganie, default, kompatybilność, status LIVE/licencji i źródło każdego pola. Nagłówki uwierzytelnienia są opcjami serwera, nie kontrolkami produktu. Parametry nieobecne w oficjalnym API są oznaczone jawnie jako luka/Hub-only.

| Provider | Rodzina | Metoda / ścieżka | Hub | Uwaga |
| --- | --- | --- | --- | --- |
| NewsAPI | News Discovery / articles | GET /v2/everything | Implemented | Katalog źródeł dotyczy top-headlines, nie całej bazy Everything. |
| NewsAPI | News Discovery / headlines | GET /v2/top-headlines | Implemented | Katalog źródeł dotyczy top-headlines, nie całej bazy Everything. |
| NewsAPI | News Discovery / publishers | GET /v2/top-headlines/sources | Implemented | Katalog źródeł dotyczy top-headlines, nie całej bazy Everything. |
| Brave | Web Search | GET /res/v1/web/search | Implemented | Web result_filter=news jest klastrem Web; nie wywołuje odrębnego News Search. |
| Brave | Dedicated News Search | GET /res/v1/news/search | Missing | Web result_filter=news jest klastrem Web; nie wywołuje odrębnego News Search. |
| Trading Economics | News | GET /news | Implemented | type opisany osobno w news-by-type; d1/d2 w news-by-date; limit/start tylko latest. Nie deklarujemy wspólnej kombinacji wszystkich pięciu opcji. |
| Trading Economics | News | GET /news/country/{countries} | Implemented |  |
| Trading Economics | News | GET /news/indicator/{indicators} | Implemented |  |
| Trading Economics | News | GET /news/country/{countries}/{indicators} | Implemented |  |
| Trading Economics | News | GET /news/ticker/{ticker} | Implemented | Ticker + d1/d2 nie są potwierdzone dla HTTP REST; Hub odrzuca takie połączenie. |
| Trading Economics | Economic Calendar | GET /calendar | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/country/All/{from}/{to} | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/country/{countries} | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/country/{countries}/{from}/{to} | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/indicator/{indicators} | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/indicator/{indicators}/{from}/{to} | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/country/{countries}/indicator/{indicators} | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/country/{countries}/indicator/{indicators}/{from}/{to} | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/ticker/{ticker} | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/ticker/{ticker}/{from}/{to} | Missing | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/calendarid/{calendarIDs} | Implemented | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/group/{group} | Missing | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/group/{group}/{from}/{to} | Missing | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/country/{country}/group/{group} | Missing | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/country/{country}/group/{group}/{from}/{to} | Missing | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Economic Calendar | GET /calendar/country/{country}/event/{event}/{from}/{to} | Missing | importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane. |
| Trading Economics | Calendar catalogue | GET /calendar/events/country/{country} | Missing |  |
| Trading Economics | Calendar catalogue | GET /indicators?calendar=1 | Missing |  |
| Trading Economics | Calendar updates | GET /calendar/updates | Missing |  |
| Trading Economics | Calendar iCalendar | GET /icalendar/country/{countries}/indicator/{indicators} | Missing |  |
| Trading Economics | Calendar iCalendar | GET /icalendar/ticker/{ticker} | Missing |  |
| Trading Economics | Indicators snapshot | GET /country/{country} | Implemented |  |
| Trading Economics | Indicators snapshot | GET /country/all/{indicator} | Implemented |  |
| Trading Economics | Indicators snapshot | GET /country/ticker/{ticker} | Implemented |  |
| Trading Economics | Indicators historical | GET /historical/country/{country}/indicator/{indicator} | Missing |  |
| Trading Economics | Indicators historical | GET /historical/country/{countries}/indicator/{indicators}/{from}/{to} | Missing |  |
| Trading Economics | Indicators historical | GET /historical/ticker/{ticker}/{date} | Missing |  |
| Trading Economics | Indicators historical | GET /historical/latest | Missing |  |
| Trading Economics | Indicators historical updates | GET /historical/updates | Missing |  |
| Trading Economics | Indicators catalogue | GET /indicators | Missing |  |
| Trading Economics | Countries catalogue | GET /country | Missing |  |
| Trading Economics | Indicators updates | GET /updates | Missing |  |
| Trading Economics | Indicators updates | GET /updates/{date} | Missing |  |
| Trading Economics | Indicators updates | GET /updates/country/{country} | Missing |  |
| Trading Economics | Indicators updates | GET /updates/country/{country}/{date} | Missing |  |
| Trading Economics | Indicators changes | GET /changes | Missing |  |
| Trading Economics | Indicators changes | GET /changes/{date} | Missing |  |
| Trading Economics | Indicators changes | GET /country/all/discontinued | Missing |  |
| Trading Economics | Indicators changes | GET /country/{countries}/discontinued | Missing |  |
| Trading Economics | Indicators peers | GET /peers/{ticker} | Missing |  |
| Trading Economics | Indicators peers | GET /peers/country/{country}/{category} | Missing |  |
| Trading Economics | Indicators credit ratings | GET /credit-ratings | Missing | Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE. |
| Trading Economics | Indicators credit ratings | GET /credit-ratings/updates | Missing | Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE. |
| Trading Economics | Indicators credit ratings | GET /credit-ratings/country/{country} | Missing | Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE. |
| Trading Economics | Indicators credit ratings | GET /credit-ratings/historical | Missing | Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE. |
| Trading Economics | Indicators credit ratings | GET /credit-ratings/historical/country/{country} | Missing | Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE. |
| Trading Economics | Indicators credit ratings | GET /credit-ratings/historical/country/{country}/d1={from}/d2={to} | Missing | Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE. |
| Trading Economics | Indicator Forecasts | GET /forecast/country/{countries} | Implemented |  |
| Trading Economics | Indicator Forecasts | GET /forecast/indicator/{indicators} | Implemented |  |
| Trading Economics | Indicator Forecasts | GET /forecast/country/{countries}/indicator/{indicators} | Implemented |  |
| Trading Economics | Indicator Forecasts | GET /forecast/ticker/{tickers} | Implemented |  |
| Trading Economics | Indicator Forecasts updates | GET /forecasts/updates | Missing | Niejednoznaczność: szablony REST używają /forecasts/updates, przykłady SDK/HTTP /forecast/updates. Wymaga wyjaśnienia; oba warianty w inwentarzu, bez obietnicy działania. |
| Trading Economics | Indicator Forecasts updates | GET /forecast/updates | Missing | Wariant z przykładów; patrz rozbieżność z /forecasts/updates. |
| Trading Economics | Market Forecasts | GET /markets/forecasts/{category} | Partial | Kod snapshot kategorii istnieje, ale rodzina pozostaje wyłączona: allow_market_forecasts=false. symbols to dopiero lokalna projekcja kategorii. |
| Trading Economics | Market Forecasts | GET /markets/forecasts/symbol/{symbols} | Missing | Natywny wybór symboli dostawcy. Hub nie wywołuje tej ścieżki; nie aktywowano uprawnień. |
| Trading Economics | News Streaming | WebSocket wss://stream.tradingeconomics.com/ — news | Missing | Brak implementacji w Hub; licencja i kontrakt strumienia wymagają odrębnego przyjęcia. |
| Trading Economics | Calendar Streaming | WebSocket wss://stream.tradingeconomics.com/ — calendar | Missing | Brak implementacji w Hub; licencja i kontrakt strumienia wymagają odrębnego przyjęcia. |

### NewsAPI — GET /v2/everything

[Źródło](https://newsapi.org/docs/endpoints/everything). Katalog źródeł dotyczy top-headlines, nie całej bazy Everything.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| apiKey [query — alternatywa dla nagłówka] | Uwierzytelnienie serwerowe; preferowany nagłówek X-Api-Key zamiast sekretu w URL. | string: Dowolny tekst zgodny ze składnią | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.newsapi / Implemented |
| X-Api-Key [header] | Alternatywa dla apiKey; Hub używa wyłącznie nagłówka. | string: Dowolny tekst zgodny ze składnią | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.newsapi / Implemented |
| q [query] | Everything: wyszukiwanie słów i fraz z operatorami; top-headlines: słowa lub fraza, bez potwierdzenia zaawansowanej składni. | string: Everything: słowa, "fraza", +słowo, -słowo, AND, OR, NOT, (grupy); Headlines: zwykłe słowa/fraza | Nie podano; Everything: maks.500 znaków i obowiązkowe URL-encoding; referencja nie rozstrzyga sposobu liczenia po kodowaniu. Hub waliduje 500 znaków przed URL-encoding. Headlines: dostawca nie podaje takiego maksimum; Hub500.; Nie dotyczy / patrz opis | criteria.text / criteria.terms / Implemented |
| sources [query] | Identyfikatory wydawców, rozdzielone przecinkami. Katalog top-headlines nie wyczerpuje wydawców Everything. | array<string> jako lista CSV: Aktualne id z /v2/top-headlines/sources; inne id Everything wymagają potwierdzenia dostawcy | Nie podano; Everything maks.20; headlines brak jawnego maksimum w referencji. Hub maks.20 w obu trybach.; Unikalne identyfikatory [a-z0-9-], maks.20 | criteria.publisherIds / Implemented |
| page [query] | Numer strony liczony od 1; dostępność głębokiej paginacji zależy od planu. | integer: Całkowita >=1 | 1; totalResults nie gwarantuje prawa do pobrania wszystkich stron.; Nie dotyczy / patrz opis | criteria.page / Implemented |
| pageSize [query] | Żądana liczba artykułów w jednej stronie; odpowiedź może być krótsza. | integer: 1..100 | 100; Maks.100; limit całego zbioru i historia zależne od planu.; Nie dotyczy / patrz opis | criteria.pageSize / Implemented |
| searchIn [query] | Wybór części artykułu przeszukiwanych przez q. | enum / CSV: title, description, content — dowolny podzbiór | Nie podano; Brak dodatkowego zakresu w dokumentacji; headline→title; summary→description; body→content; maks.3 | criteria.fields / Implemented |
| domains [query] | Ograniczenie do podanych domen. | array<string> jako CSV: Nazwy hostów bez schematu i ścieżki | Nie podano; Dostawca nie podaje limitu listy; Hub maks.100 domen po253 znaki.; Poprawny hostname, bez URL i ścieżki | criteria.domains / Implemented |
| excludeDomains [query] | Wyłączenie podanych domen. | array<string> jako CSV: Nazwy hostów bez schematu i ścieżki | Nie podano; Dostawca nie podaje limitu listy; Hub maks.100 domen po253 znaki.; Poprawny hostname, bez URL i ścieżki | criteria.excludedDomains / Implemented |
| from [query] | Granica czasu publikacji artykułu, a nie daty wydarzenia. | ISO8601 date/datetime: YYYY-MM-DD lub czas ISO8601 | Najstarsza dostępna data planu; Historia i opóźnienie zależne od planu; brak uniwersalnej długości historii.; Data lub timestamp UTC z Z; poprawny dzień kalendarzowy | criteria.publishedAfter / Implemented |
| to [query] | Granica czasu publikacji artykułu, a nie daty wydarzenia. | ISO8601 date/datetime: YYYY-MM-DD lub czas ISO8601 | Najnowszy dostępny artykuł; Historia i opóźnienie zależne od planu; brak uniwersalnej długości historii.; Data lub timestamp UTC z Z; poprawny dzień kalendarzowy | criteria.publishedBefore / Implemented |
| sortBy [query] | Ranking trafności, popularności źródła lub daty publikacji. | enum: relevancy, popularity, publishedAt | publishedAt; Popularity nie jest oceną wiarygodności źródła.; relevance→relevancy; publisherPopularity→popularity; newest→publishedAt | criteria.order / Implemented |
| qInTitle [query] | Nie występuje w aktualnej oficjalnej referencji Everything. Zamiast obiecywać obsługę, użyć q + searchIn=title. | string: Niepotwierdzone | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Unsupported |
| language [query] | Nie oznacza języka interfejsu. Token ud jest zapisany tak jak u dostawcy, bez przypisywania mu innego standardu. | enum: ar de en es fr he it nl no pt ru sv ud zh | Wszystkie dostępne języki; pl nie jest udokumentowany; nie mylić z publisherCountry=pl.; Nie dotyczy / patrz opis | criteria.language / Implemented |

### NewsAPI — GET /v2/top-headlines

[Źródło](https://newsapi.org/docs/endpoints/top-headlines). Katalog źródeł dotyczy top-headlines, nie całej bazy Everything.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| apiKey [query — alternatywa dla nagłówka] | Uwierzytelnienie serwerowe; preferowany nagłówek X-Api-Key zamiast sekretu w URL. | string: Dowolny tekst zgodny ze składnią | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.newsapi / Implemented |
| X-Api-Key [header] | Alternatywa dla apiKey; Hub używa wyłącznie nagłówka. | string: Dowolny tekst zgodny ze składnią | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.newsapi / Implemented |
| q [query] | Everything: wyszukiwanie słów i fraz z operatorami; top-headlines: słowa lub fraza, bez potwierdzenia zaawansowanej składni. | string: Everything: słowa, "fraza", +słowo, -słowo, AND, OR, NOT, (grupy); Headlines: zwykłe słowa/fraza | Nie podano; Everything: maks.500 znaków i obowiązkowe URL-encoding; referencja nie rozstrzyga sposobu liczenia po kodowaniu. Hub waliduje 500 znaków przed URL-encoding. Headlines: dostawca nie podaje takiego maksimum; Hub500.; Nie dotyczy / patrz opis | criteria.text / Implemented |
| sources [query] | Identyfikatory wydawców, rozdzielone przecinkami. Katalog top-headlines nie wyczerpuje wydawców Everything. | array<string> jako lista CSV: Aktualne id z /v2/top-headlines/sources; inne id Everything wymagają potwierdzenia dostawcy | Nie podano; Everything maks.20; headlines brak jawnego maksimum w referencji. Hub maks.20 w obu trybach.; Unikalne identyfikatory [a-z0-9-], maks.20 | criteria.publisherIds / Implemented |
| page [query] | Numer strony liczony od 1; dostępność głębokiej paginacji zależy od planu. | integer: Całkowita >=1 | 1; totalResults nie gwarantuje prawa do pobrania wszystkich stron.; Nie dotyczy / patrz opis | criteria.page / Implemented |
| pageSize [query] | Żądana liczba artykułów w jednej stronie; odpowiedź może być krótsza. | integer: 1..100 | 20; Maks.100; limit całego zbioru i historia zależne od planu.; Nie dotyczy / patrz opis | criteria.pageSize / Implemented |
| country [query] | Headlines: edycja wiadomości; katalog: kraj pochodzenia wydawcy. Żaden nie określa miejsca wydarzenia. | enum: us | Brak filtra; Headlines: bieżąca lista dopuszczalnych wartości zawiera tylko us; stary przykład de w dokumentacji jest niespójny z listą.; Nie dotyczy / patrz opis | criteria.editionCountry / Implemented |
| category [query] | Kategoria tematyczna nagłówków albo wydawcy w katalogu. | enum: business entertainment general health science sports technology | Brak filtra; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.category / Implemented |

### NewsAPI — GET /v2/top-headlines/sources

[Źródło](https://newsapi.org/docs/endpoints/sources). Katalog źródeł dotyczy top-headlines, nie całej bazy Everything.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| apiKey [query — alternatywa dla nagłówka] | Uwierzytelnienie serwerowe; preferowany nagłówek X-Api-Key zamiast sekretu w URL. | string: Dowolny tekst zgodny ze składnią | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.newsapi / Implemented |
| X-Api-Key [header] | Alternatywa dla apiKey; Hub używa wyłącznie nagłówka. | string: Dowolny tekst zgodny ze składnią | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.newsapi / Implemented |
| language [query] | Nie oznacza języka interfejsu. Token ud jest zapisany tak jak u dostawcy, bez przypisywania mu innego standardu. | enum: ar de en es fr he it nl no pt ru sv ud zh | Wszystkie dostępne języki; pl nie jest udokumentowany; nie mylić z publisherCountry=pl.; Nie dotyczy / patrz opis | criteria.language / Implemented |
| country [query] | Headlines: edycja wiadomości; katalog: kraj pochodzenia wydawcy. Żaden nie określa miejsca wydarzenia. | enum: ae ar at au be bg br ca ch cn co cu cz de eg fr gb gr hk hu id ie il in it jp kr lt lv ma mx my ng nl no nz ph pl pt ro rs ru sa se sg si sk th tr tw ua us ve za | Brak filtra; Headlines: bieżąca lista dopuszczalnych wartości zawiera tylko us; stary przykład de w dokumentacji jest niespójny z listą.; Nie dotyczy / patrz opis | criteria.publisherCountry / Implemented |
| category [query] | Kategoria tematyczna nagłówków albo wydawcy w katalogu. | enum: business entertainment general health science sports technology | Brak filtra; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.category / Implemented |

### Brave — GET /res/v1/web/search

[Źródło](https://api-dashboard.search.brave.com/api-reference/web/search/get). Web result_filter=news jest klastrem Web; nie wywołuje odrębnego News Search.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| x-subscription-token [header] | Sekret serwera; nie podawać w formularzu użytkownika. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | secrets.brave / Implemented |
| q [query] | Zapytanie tekstowe. Eksperymentalne operatory nie gwarantują ścisłego dopasowania. | string: Zgodnie z opisem | Nie podano; 600 znaków / 75 słów; Także po dodaniu domen limit600 znaków/75 słów; domeny mają dodatkowe sprawdzenie hosta w zwróconym podzbiorze. | criteria.text / Implemented |
| country [query] | Kraj związany z doborem wyników; ALL oznacza wyszukiwanie globalne. Nie jest krajem wydarzenia. | string: AR, AU, AT, BE, BR, CA, CL, DK, FI, FR, DE, GR, HK, IN, ID, IT, JP, KR, MY, MX, NL, NZ, NO, CN, PL, PT, PH, RU, SA, ZA, ES, SE, CH, TW, TR, GB, US, ALL | US; AR, AU, AT, BE, BR, CA, CL, DK, FI, FR, DE, GR, HK, IN, ID, IT, JP, KR, MY, MX, NL, NZ, NO, CN, PL, PT, PH, RU, SA, ZA, ES, SE, CH, TW, TR, GB, US, ALL; default US; Nie dotyczy / patrz opis | criteria.country / Implemented |
| search_lang [query] | Preferowany język wyników, odrębny od ui_lang. | string: ar, eu, bn, bg, ca, zh-hans, zh-hant, hr, cs, da, nl, en, en-gb, et, fi, fr, gl, de, el, gu, he, hi, hu, is, it, ja, jp, kn, ko, lv, lt, ms, ml, mr, nb, pl, pt-br, pt-pt, pa, ro, ru, sr, sk, sl, es, sv, ta, te, th, tr, uk, vi | en; ar, eu, bn, bg, ca, zh-hans, zh-hant, hr, cs, da, nl, en, en-gb, et, fi, fr, gl, de, el, gu, he, hi, hu, is, it, ja, jp, kn, ko, lv, lt, ms, ml, mr, nb, pl, pt-br, pt-pt, pa, ro, ru, sr, sk, sl, es, sv, ta, te, th, tr, uk, vi; default en; Hub odrzuca en-gb, ja, pt-br, pt-pt; nadal akceptuje pt spoza bieżącej listy dostawcy. Wymaga przyszłego uzgodnienia. | criteria.language / Partial |
| ui_lang [query] | Preferowany język etykiet/metadanych odpowiedzi; nie zastępuje search_lang. | string: es-AR, en-AU, de-AT, nl-BE, fr-BE, pt-BR, en-CA, fr-CA, es-CL, da-DK, fi-FI, fr-FR, de-DE, el-GR, zh-HK, en-IN, en-ID, it-IT, ja-JP, ko-KR, en-MY, es-MX, nl-NL, en-NZ, no-NO, zh-CN, pl-PL, en-PH, ru-RU, en-ZA, es-ES, sv-SE, fr-CH, de-CH, zh-TW, tr-TR, en-GB, en-US, es-US | en-US; es-AR, en-AU, de-AT, nl-BE, fr-BE, pt-BR, en-CA, fr-CA, es-CL, da-DK, fi-FI, fr-FR, de-DE, el-GR, zh-HK, en-IN, en-ID, it-IT, ja-JP, ko-KR, en-MY, es-MX, nl-NL, en-NZ, no-NO, zh-CN, pl-PL, en-PH, ru-RU, en-ZA, es-ES, sv-SE, fr-CH, de-CH, zh-TW, tr-TR, en-GB, en-US, es-US; default en-US; Hub sprawdza tylko wzór xx-YY; nie pełny enum dostawcy. | criteria.uiLanguage / Partial |
| count [query] | Żądany rozmiar strony; w Web dotyczy tylko wyników web. | integer: 1-20 | 20; 1-20; default 20; Hub: tylko resultType=web. Klaster news odrzuca count i offset. | criteria.count / Implemented |
| offset [query] | Liczba stron do pominięcia; nie numer pojedynczego rekordu. Wyniki stron mogą się pokrywać. | integer: 0-9 | 0; 0-9; default 0; Hub: tylko resultType=web. Klaster news odrzuca count i offset. | criteria.offset / Implemented |
| safesearch [query] | Poziom filtrowania treści dla dorosłych. | string: off, moderate, strict | moderate; off, moderate, strict; default moderate; Nie dotyczy / patrz opis | criteria.safeSearch / Implemented |
| spellcheck [query] | Po włączeniu wyszukiwarka może wykonać zmienione zapytanie; query.altered pokazuje zmieniony tekst. Hub zachowuje tylko informację, czy tekst zmieniono. | boolean: default true | true; default true; Nie dotyczy / patrz opis | criteria.spellcheck / Implemented |
| freshness [query] | Wiek strony na podstawie relewantnej daty: publikacji ALBO modyfikacji; nie jest ścisłym filtrem daty publikacji artykułu. | string: default | Brak filtra; default ; Nie dotyczy / patrz opis | criteria.freshness / Implemented |
| text_decorations [query] | Znaczniki dekoracji w tytułach i fragmentach. Hub wymusza false. | boolean: default true | true; default true; Nie dotyczy / patrz opis | stała false / Partial |
| result_filter [query] | Wybór klastrów; dostęp zależy także od planu. query i type pozostają w odpowiedzi. | string: discussions, faq, infobox, news, query, summarizer, videos, web, locations | Nie podano; Brak dodatkowych ograniczeń w tabeli; Tylko pojedynczy web albo news; brak pozostałych klastrów i ich kombinacji. | criteria.resultType / Partial |
| units [query] | Jednostki w wynikach lokalnych i bogatych: metryczne lub imperialne. | string: imperial, metric | Nie podano; imperial, metric; Nie dotyczy / patrz opis | Brak / Missing |
| goggles_id [query] | Wycofywany parametr rankingu; zastąpiony przez goggles. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | Brak / Missing |
| goggles [query] | URL lub definicja profilu zmieniającego ranking; do3 profili. Nie jest gwarancją ścisłego filtrowania. | string: Zgodnie z opisem | Nie podano; Pojedynczy profil lub lista maks.3; URL lub definicja; Nie dotyczy / patrz opis | Brak / Missing |
| extra_snippets [query] | Do5 alternatywnych fragmentów strony. Referencja oznacza parametr jako string, Hub wysyła true/false. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Hub Boolean; referencja dostawcy string. Brak dowodu LIVE tego wariantu. | criteria.extraSnippets / Implemented |
| summary [query] | Włącza generowanie klucza summarizer; nie jest gotowym podsumowaniem ani funkcją Newsfeed AI summary. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | Brak / Missing |
| enable_rich_callback [query] | Zezwala na bogate wyniki dostarczane przez callback; wymagany plan Search. | boolean: default false | false; default false; Nie dotyczy / patrz opis | Brak / Missing |
| include_fetch_metadata [query] | Prosi o dodatkowe informacje o pobraniu strony przez wyszukiwarkę; nie jest czasem pobrania przez Hub. | boolean: default false | false; default false; Nie dotyczy / patrz opis | Brak / Missing |
| operators [query] | Włączenie interpretacji operatorów. Hub ustawia true; nie weryfikuje ich semantyki. | boolean: default true | true; default true; Nie dotyczy / patrz opis | stała true / Partial |
| operators_fallback [query] | Zezwala na zachowanie awaryjne dla operatorów. Opisy Web i News różnią się szczegółem kolejności; odczyt applied i flag wyników jest konieczny. | boolean: default false | false; default false; Nie dotyczy / patrz opis | Brak / Missing |
| x-loc-lat [header] | Lokalizacja klienta dla wyników lokalnych; wymaga świadomego udostępnienia i celu. | string: -90-90 | Nie podano; -90-90; Nie dotyczy / patrz opis | Brak / Missing |
| x-loc-long [header] | Lokalizacja klienta dla wyników lokalnych; nie miejsce wydarzenia. | string: -180-180 | Nie podano; -180-180; Nie dotyczy / patrz opis | Brak / Missing |
| x-loc-timezone [header] | Identyfikator IANA strefy urządzenia; nie zmienia semantyki dat publikacji. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | Brak / Missing |
| x-loc-city [header] | Nazwa miasta klienta dla lokalnych wyników. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | Brak / Missing |
| x-loc-state [header] | Kod pierwszego poziomu podziału ISO3166-2, do3 znaków według opisu. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | Brak / Missing |
| x-loc-state-name [header] | Pełna nazwa regionu klienta. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | Brak / Missing |
| x-loc-country [header] | Kod kraju lokalizacji klienta; inne znaczenie niż query.country i operator loc:. | string: AD, AE, AF, AG, AI, AL, AM, AO, AQ, AR, AS, AT, AU, AW, AX, AZ, BA, BB, BD, BE, BF, BG, BH, BI, BJ, BL, BM, BN, BO, BQ, BR, BS, BT, BV, BW, BY, BZ, CA, CC, CD, CF, CG, CH, CI, CK, CL, CM, CN, CO, CR, CU, CV, CW, CX, CY, CZ, DE, DJ, DK, DM, DO, DZ, EC, EE, EG, EH, ER, ES, ET, FI, FJ, FK, FM, FO, FR, GA, GB, GD, GE, GF, GG, GH, GI, GL, GM, GN, GP, GQ, GR, GS, GT, GU, GW, GY, HK, HM, HN, HR, HT, HU, ID, IE, IL, IM, IN, IO, IQ, IR, IS, IT, JE, JM, JO, JP, KE, KG, KH, KI, KM, KN, KP, KR, KW, KY, KZ, LA, LB, LC, LI, LK, LR, LS, LT, LU, LV, LY, MA, MC, MD, ME, MF, MG, MH, MK, ML, MM, MN, MO, MP, MQ, MR, MS, MT, MU, MV, MW, MX, MY, MZ, NA, NC, NE, NF, NG, NI, NL, NO, NP, NR, NU, NZ, OM, PA, PE, PF, PG, PH, PK, PL, PM, PN, PR, PS, PT, PW, PY, QA, RE, RO, RS, RU, RW, SA, SB, SC, SD, SE, SG, SH, SI, SJ, SK, SL, SM, SN, SO, SR, SS, ST, SV, SX, SY, SZ, TC, TD, TF, TG, TH, TJ, TK, TL, TM, TN, TO, TR, TT, TV, TW, TZ, UA, UG, UM, US, UY, UZ, VA, VC, VE, VG, VI, VN, VU, WF, WS, YE, YT, ZA, ZM, ZW | Nie podano; AD, AE, AF, AG, AI, AL, AM, AO, AQ, AR, AS, AT, AU, AW, AX, AZ, BA, BB, BD, BE, BF, BG, BH, BI, BJ, BL, BM, BN, BO, BQ, BR, BS, BT, BV, BW, BY, BZ, CA, CC, CD, CF, CG, CH, CI, CK, CL, CM, CN, CO, CR, CU, CV, CW, CX, CY, CZ, DE, DJ, DK, DM, DO, DZ, EC, EE, EG, EH, ER, ES, ET, FI, FJ, FK, FM, FO, FR, GA, GB, GD, GE, GF, GG, GH, GI, GL, GM, GN, GP, GQ, GR, GS, GT, GU, GW, GY, HK, HM, HN, HR, HT, HU, ID, IE, IL, IM, IN, IO, IQ, IR, IS, IT, JE, JM, JO, JP, KE, KG, KH, KI, KM, KN, KP, KR, KW, KY, KZ, LA, LB, LC, LI, LK, LR, LS, LT, LU, LV, LY, MA, MC, MD, ME, MF, MG, MH, MK, ML, MM, MN, MO, MP, MQ, MR, MS, MT, MU, MV, MW, MX, MY, MZ, NA, NC, NE, NF, NG, NI, NL, NO, NP, NR, NU, NZ, OM, PA, PE, PF, PG, PH, PK, PL, PM, PN, PR, PS, PT, PW, PY, QA, RE, RO, RS, RU, RW, SA, SB, SC, SD, SE, SG, SH, SI, SJ, SK, SL, SM, SN, SO, SR, SS, ST, SV, SX, SY, SZ, TC, TD, TF, TG, TH, TJ, TK, TL, TM, TN, TO, TR, TT, TV, TW, TZ, UA, UG, UM, US, UY, UZ, VA, VC, VE, VG, VI, VN, VU, WF, WS, YE, YT, ZA, ZM, ZW; Nie dotyczy / patrz opis | Brak / Missing |
| x-loc-postal-code [header] | Doprecyzowanie lokalizacji klienta; nie przekazywać domyślnie. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | Brak / Missing |
| api-version [header] | Wersja protokołu w formacie YYYY-MM-DD; Hub jej nie przypina nagłówkiem. | string: Zgodnie z opisem | Najnowsza dostępna; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | Brak / Missing |
| accept [header] | Akceptowany typ treści odpowiedzi; nie parametr wyszukiwania. | string: application/json, */* | application/json; application/json, */*; default application/json; Nie dotyczy / patrz opis | Brak / Missing |
| cache-control [header] | no-cache jest obsługiwane best effort. cache:no-store klienta HTTP nie dowodzi wyłączenia cache dostawcy. | string: no-cache | Nie podano; no-cache; Nie dotyczy / patrz opis | Brak / Missing |
| user-agent [header] | Może zmieniać dobór odpowiedzi. Hub nie przekazuje arbitralnie nagłówka przeglądarki. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Nie dotyczy / patrz opis | Brak / Missing |
| AND [q — składnia, nie osobny query parameter] | Wymaga obu pojęć według deklaracji operatora. | operator tekstowy: A AND B | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| OR [q — składnia, nie osobny query parameter] | Alternatywne pojęcia; nie gwarantuje grupowania nawiasów. | operator tekstowy: A OR B | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| NOT [q — składnia, nie osobny query parameter] | Wykluczenie słowa lub warunku. | operator tekstowy: A NOT B | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| + [q — składnia, nie osobny query parameter] | Preferencja obowiązkowego wystąpienia wskazanego słowa w deklarowanej semantyce. | operator tekstowy: +słowo | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| - [q — składnia, nie osobny query parameter] | Wykluczenie wskazanego słowa. | operator tekstowy: -słowo | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| "…" [q — składnia, nie osobny query parameter] | Wyszukiwanie frazy w podanej kolejności. | operator tekstowy: "dokładna fraza" | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| site: [q — składnia, nie osobny query parameter] | Ograniczenie witryny/domeny; wykluczenie przez -site: lub NOT site:. | operator tekstowy: site:domena | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| intitle: [q — składnia, nie osobny query parameter] | Wskazane pojęcie w tytule strony. | operator tekstowy: intitle:słowo | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| inbody: [q — składnia, nie osobny query parameter] | Wskazane pojęcie w treści strony. | operator tekstowy: inbody:słowo | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| inpage: [q — składnia, nie osobny query parameter] | Wskazane pojęcie w tytule lub treści strony. | operator tekstowy: inpage:słowo | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| lang: / language: [q — składnia, nie osobny query parameter] | Język treści; używać kodów z dokumentacji, a nie języka UI. | operator tekstowy: lang:kod / language:kod | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| loc: / location: [q — składnia, nie osobny query parameter] | Region/kraj witryny lub wyników; nie dowód miejsca zdarzenia. | operator tekstowy: loc:kod / location:kod | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| ext: [q — składnia, nie osobny query parameter] | Rozszerzenie pliku strony, np.pdf. | operator tekstowy: ext:rozszerzenie | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| filetype: [q — składnia, nie osobny query parameter] | Typ pliku, np.pdf; odrębny udokumentowany operator. | operator tekstowy: filetype:typ | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | criteria.text (przekazanie składni); domains/excludedDomains dodatkowo dla site: / Partial |
| (…) [q — składnia, nie osobny query parameter] | Grupowanie NIE jest potwierdzone na przejrzanych oficjalnych stronach Brave. Nie obiecywać drzewa logicznego z tą semantyką. | operator tekstowy: (A OR B) AND C | Nie dotyczy; Operator eksperymentalny; brak testu LIVE. Logiczne AND/OR/NOT zapisywać wielkimi literami. Całe q maks.600 znaków/75 słów.; Nie dotyczy / patrz opis | Kompilator domains używa nawiasów, ale nie dowodzi ich wykonania przez dostawcę / Partial |

### Brave — GET /res/v1/news/search

[Źródło](https://api-dashboard.search.brave.com/api-reference/news/news_search/get). Web result_filter=news jest klastrem Web; nie wywołuje odrębnego News Search.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| x-subscription-token [header] | Sekret serwera; nie podawać w formularzu użytkownika. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| q [query] | Zapytanie tekstowe. Eksperymentalne operatory nie gwarantują ścisłego dopasowania. | string: Zgodnie z opisem | Nie podano; 400 znaków / 50 słów; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| search_lang [query] | Preferowany język wyników, odrębny od ui_lang. | string: ar, eu, bn, bg, ca, zh-hans, zh-hant, hr, cs, da, nl, en, en-gb, et, fi, fr, gl, de, el, gu, he, hi, hu, is, it, ja, jp, kn, ko, lv, lt, ms, ml, mr, nb, pl, pt-br, pt-pt, pa, ro, ru, sr, sk, sl, es, sv, ta, te, th, tr, uk, vi | en; ar, eu, bn, bg, ca, zh-hans, zh-hant, hr, cs, da, nl, en, en-gb, et, fi, fr, gl, de, el, gu, he, hi, hu, is, it, ja, jp, kn, ko, lv, lt, ms, ml, mr, nb, pl, pt-br, pt-pt, pa, ro, ru, sr, sk, sl, es, sv, ta, te, th, tr, uk, vi; default en; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| ui_lang [query] | Preferowany język etykiet/metadanych odpowiedzi; nie zastępuje search_lang. | string: es-AR, en-AU, de-AT, nl-BE, fr-BE, pt-BR, en-CA, fr-CA, es-CL, da-DK, fi-FI, fr-FR, de-DE, el-GR, zh-HK, en-IN, en-ID, it-IT, ja-JP, ko-KR, en-MY, es-MX, nl-NL, en-NZ, no-NO, zh-CN, pl-PL, en-PH, ru-RU, en-ZA, es-ES, sv-SE, fr-CH, de-CH, zh-TW, tr-TR, en-GB, en-US, es-US | en-US; es-AR, en-AU, de-AT, nl-BE, fr-BE, pt-BR, en-CA, fr-CA, es-CL, da-DK, fi-FI, fr-FR, de-DE, el-GR, zh-HK, en-IN, en-ID, it-IT, ja-JP, ko-KR, en-MY, es-MX, nl-NL, en-NZ, no-NO, zh-CN, pl-PL, en-PH, ru-RU, en-ZA, es-ES, sv-SE, fr-CH, de-CH, zh-TW, tr-TR, en-GB, en-US, es-US; default en-US; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| country [query] | Kraj związany z doborem wyników; ALL oznacza wyszukiwanie globalne. Nie jest krajem wydarzenia. | string: AR, AU, AT, BE, BR, CA, CL, DK, FI, FR, DE, GR, HK, IN, ID, IT, JP, KR, MY, MX, NL, NZ, NO, CN, PL, PT, PH, RU, SA, ZA, ES, SE, CH, TW, TR, GB, US, ALL | US; AR, AU, AT, BE, BR, CA, CL, DK, FI, FR, DE, GR, HK, IN, ID, IT, JP, KR, MY, MX, NL, NZ, NO, CN, PL, PT, PH, RU, SA, ZA, ES, SE, CH, TW, TR, GB, US, ALL; default US; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| safesearch [query] | Poziom filtrowania treści dla dorosłych. | string: off, moderate, strict | strict; off, moderate, strict; default strict; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| count [query] | Żądany rozmiar strony; w Web dotyczy tylko wyników web. | integer: 1-50 | 20; 1-50; default 20; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| offset [query] | Liczba stron do pominięcia; nie numer pojedynczego rekordu. Wyniki stron mogą się pokrywać. | integer: 0-9 | 0; 0-9; default 0; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| spellcheck [query] | Po włączeniu wyszukiwarka może wykonać zmienione zapytanie; query.altered pokazuje zmieniony tekst. Hub zachowuje tylko informację, czy tekst zmieniono. | boolean: default true | true; default true; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| freshness [query] | Wiek strony na podstawie relewantnej daty: publikacji ALBO modyfikacji; nie jest ścisłym filtrem daty publikacji artykułu. | string: default | Brak filtra; default ; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| extra_snippets [query] | Do5 alternatywnych fragmentów strony. Referencja oznacza parametr jako string, Hub wysyła true/false. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| goggles [query] | URL lub definicja profilu zmieniającego ranking; do3 profili. Nie jest gwarancją ścisłego filtrowania. | string: Zgodnie z opisem | Nie podano; Pojedynczy profil lub lista maks.3; URL lub definicja; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| include_fetch_metadata [query] | Prosi o dodatkowe informacje o pobraniu strony przez wyszukiwarkę; nie jest czasem pobrania przez Hub. | boolean: default false | false; default false; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| operators [query] | Włączenie interpretacji operatorów. Hub ustawia true; nie weryfikuje ich semantyki. | boolean: default true | true; default true; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| operators_fallback [query] | Zezwala na zachowanie awaryjne dla operatorów. Opisy Web i News różnią się szczegółem kolejności; odczyt applied i flag wyników jest konieczny. | boolean: default false | false; default false; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| api-version [header] | Wersja protokołu w formacie YYYY-MM-DD; Hub jej nie przypina nagłówkiem. | string: Zgodnie z opisem | Najnowsza dostępna; Brak dodatkowych ograniczeń w tabeli; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| accept [header] | Akceptowany typ treści odpowiedzi; nie parametr wyszukiwania. | string: application/json, */* | application/json; application/json, */*; default application/json; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| cache-control [header] | no-cache jest obsługiwane best effort. cache:no-store klienta HTTP nie dowodzi wyłączenia cache dostawcy. | string: no-cache | Nie podano; no-cache; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |
| user-agent [header] | Może zmieniać dobór odpowiedzi. Hub nie przekazuje arbitralnie nagłówka przeglądarki. | string: Zgodnie z opisem | Nie podano; Brak dodatkowych ograniczeń w tabeli; Brak odrębnego konektora endpointu News; nie utożsamiać z Web news cluster. | Brak / Missing |

### Trading Economics — GET /news

[Źródło](https://docs.tradingeconomics.com/news/latest/). type opisany osobno w news-by-type; d1/d2 w news-by-date; limit/start tylko latest. Nie deklarujemy wspólnej kombinacji wszystkich pięciu opcji.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| type [query] | Natywny podział wiadomości globalnych na rynkowe i ekonomiczne. | string: markets, economy | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.newsType / Implemented |
| d1 [query] | Natywna selekcja wiadomości według dat publikacji; nie data opisywanego wydarzenia. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.from / Implemented |
| d2 [query] | Natywna selekcja wiadomości według dat publikacji; nie data opisywanego wydarzenia. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.to / Implemented |
| limit [query] | TE Latest News ma natywne limit. Hub nie przekazuje tego parametru; criteria.limit tnie dopiero pobrany podzbiór. | integer: Dodatnia liczba; dostawca nie podaje tu górnej granicy | 100 w Hub, dostawca nie podaje; Hub1..1000, domyślnie100; nie kontroluje liczby zwróconej przez upstream przed projekcją.; Nie dotyczy / patrz opis | criteria.limit (tylko lokalnie) / Partial |
| start [query] | Natywny indeks rozpoczęcia listy Latest News; nieobsługiwany przez Hub. | integer: Indeks liczbowy, np.150; dokładna dolna granica nie podana | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| text (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring bez rozróżnienia wielkości liter; brak udokumentowanego natywnego fulltext TE REST. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.text / Implemented |

### Trading Economics — GET /news/country/{countries}

[Źródło](https://docs.tradingeconomics.com/news/news-by-country-and-date/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.countries / Implemented |
| d1 [query] | Natywna selekcja wiadomości według dat publikacji; nie data opisywanego wydarzenia. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.from / Implemented |
| d2 [query] | Natywna selekcja wiadomości według dat publikacji; nie data opisywanego wydarzenia. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.to / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| text (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring bez rozróżnienia wielkości liter; brak udokumentowanego natywnego fulltext TE REST. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.text / Implemented |

### Trading Economics — GET /news/indicator/{indicators}

[Źródło](https://docs.tradingeconomics.com/news/news-by-indicator-and-date/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.indicators / Implemented |
| d1 [query] | Natywna selekcja wiadomości według dat publikacji; nie data opisywanego wydarzenia. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.from / Implemented |
| d2 [query] | Natywna selekcja wiadomości według dat publikacji; nie data opisywanego wydarzenia. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.to / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| text (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring bez rozróżnienia wielkości liter; brak udokumentowanego natywnego fulltext TE REST. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.text / Implemented |

### Trading Economics — GET /news/country/{countries}/{indicators}

[Źródło](https://docs.tradingeconomics.com/news/news-by-country-indicator-and-date/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.countries / Implemented |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.indicators / Implemented |
| d1 [query] | Natywna selekcja wiadomości według dat publikacji; nie data opisywanego wydarzenia. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.from / Implemented |
| d2 [query] | Natywna selekcja wiadomości według dat publikacji; nie data opisywanego wydarzenia. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.to / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| text (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring bez rozróżnienia wielkości liter; brak udokumentowanego natywnego fulltext TE REST. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.text / Implemented |

### Trading Economics — GET /news/ticker/{ticker}

[Źródło](https://docs.tradingeconomics.com/news/news-by-ticker/). Ticker + d1/d2 nie są potwierdzone dla HTTP REST; Hub odrzuca takie połączenie.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| ticker [path] | Natywny identyfikator konkretnej serii/wydarzenia; pobrać ze snapshotu lub katalogu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.tickers / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| text (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring bez rozróżnienia wielkości liter; brak udokumentowanego natywnego fulltext TE REST. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.text / Implemented |

### Trading Economics — GET /calendar

[Źródło](https://docs.tradingeconomics.com/economic_calendar/snapshot/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| importance [query] | Poziom1 niski,2 średni,3 wysoki. Nie deklarować semantyki >= bez dowodu dostawcy. | enum integer: 1, 2, 3 | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.importance / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| eventText (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring Event; nie to samo co natywny endpoint event po dokładnej nazwie. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.eventText / Implemented |

### Trading Economics — GET /calendar/country/All/{from}/{to}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/snapshot/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | criteria.from / Implemented |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | criteria.to / Implemented |
| importance [query] | Poziom1 niski,2 średni,3 wysoki. Nie deklarować semantyki >= bez dowodu dostawcy. | enum integer: 1, 2, 3 | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.importance / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| eventText (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring Event; nie to samo co natywny endpoint event po dokładnej nazwie. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.eventText / Implemented |

### Trading Economics — GET /calendar/country/{countries}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/country/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.countries / Implemented |
| importance [query] | Poziom1 niski,2 średni,3 wysoki. Nie deklarować semantyki >= bez dowodu dostawcy. | enum integer: 1, 2, 3 | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.importance / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| eventText (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring Event; nie to samo co natywny endpoint event po dokładnej nazwie. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.eventText / Implemented |

### Trading Economics — GET /calendar/country/{countries}/{from}/{to}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/country/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.countries / Implemented |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | criteria.from / Implemented |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | criteria.to / Implemented |
| importance [query] | Poziom1 niski,2 średni,3 wysoki. Nie deklarować semantyki >= bez dowodu dostawcy. | enum integer: 1, 2, 3 | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.importance / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| eventText (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring Event; nie to samo co natywny endpoint event po dokładnej nazwie. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.eventText / Implemented |

### Trading Economics — GET /calendar/indicator/{indicators}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/indicator/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.indicators / Implemented |
| importance [query] | Poziom1 niski,2 średni,3 wysoki. Nie deklarować semantyki >= bez dowodu dostawcy. | enum integer: 1, 2, 3 | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.importance / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| eventText (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring Event; nie to samo co natywny endpoint event po dokładnej nazwie. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.eventText / Implemented |

### Trading Economics — GET /calendar/indicator/{indicators}/{from}/{to}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/indicator/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.indicators / Implemented |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | criteria.from / Implemented |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | criteria.to / Implemented |
| importance [query] | Poziom1 niski,2 średni,3 wysoki. Nie deklarować semantyki >= bez dowodu dostawcy. | enum integer: 1, 2, 3 | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.importance / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| eventText (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring Event; nie to samo co natywny endpoint event po dokładnej nazwie. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.eventText / Implemented |

### Trading Economics — GET /calendar/country/{countries}/indicator/{indicators}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/country/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.countries / Implemented |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.indicators / Implemented |
| importance [query] | Poziom1 niski,2 średni,3 wysoki. Nie deklarować semantyki >= bez dowodu dostawcy. | enum integer: 1, 2, 3 | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.importance / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| eventText (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring Event; nie to samo co natywny endpoint event po dokładnej nazwie. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.eventText / Implemented |

### Trading Economics — GET /calendar/country/{countries}/indicator/{indicators}/{from}/{to}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/point-in-time/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.countries / Implemented |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.indicators / Implemented |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | criteria.from / Implemented |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | criteria.to / Implemented |
| importance [query] | Poziom1 niski,2 średni,3 wysoki. Nie deklarować semantyki >= bez dowodu dostawcy. | enum integer: 1, 2, 3 | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | criteria.importance / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| eventText (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring Event; nie to samo co natywny endpoint event po dokładnej nazwie. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.eventText / Implemented |

### Trading Economics — GET /calendar/ticker/{ticker}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/ticker/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| ticker [path] | Natywny identyfikator konkretnej serii/wydarzenia; pobrać ze snapshotu lub katalogu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.tickers / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| eventText (Hub only) [Hub criteria — nie parametr dostawcy] | Lokalny substring Event; nie to samo co natywny endpoint event po dokładnej nazwie. | string: Do200 znaków | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.eventText / Implemented |

### Trading Economics — GET /calendar/ticker/{ticker}/{from}/{to}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/ticker/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| ticker [path] | Natywny identyfikator konkretnej serii/wydarzenia; pobrać ze snapshotu lub katalogu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /calendar/calendarid/{calendarIDs}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/snapshot/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| calendarIDs [path] | Identyfikatory z CalendarId/CalendarID w odpowiedzi TE. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub maks.20 ID, każde1..20 cyfr; ID wykluczają kraje/wskaźniki/tickery/okres/importance/eventText. | criteria.eventIds / Implemented |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |

### Trading Economics — GET /calendar/group/{group}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/group/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| group [path] | Grupa kalendarza, np. bonds; brak udokumentowanego pełnego endpointu katalogu grup. Nie jest grupą krajów. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /calendar/group/{group}/{from}/{to}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/group/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| group [path] | Grupa kalendarza, np. bonds; brak udokumentowanego pełnego endpointu katalogu grup. Nie jest grupą krajów. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /calendar/country/{country}/group/{group}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/country/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| group [path] | Grupa kalendarza, np. bonds; brak udokumentowanego pełnego endpointu katalogu grup. Nie jest grupą krajów. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /calendar/country/{country}/group/{group}/{from}/{to}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/country/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| group [path] | Grupa kalendarza, np. bonds; brak udokumentowanego pełnego endpointu katalogu grup. Nie jest grupą krajów. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /calendar/country/{country}/event/{event}/{from}/{to}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/country/). importance jest dokumentowane dla snapshot/country/indicator. values i lang są rozszerzeniami formatu JSON, a nie zmianą zbioru wydarzeń. Złożenia poza przykładami są niezweryfikowane.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| event [path] | Pełna nazwa wydarzenia z GET /calendar/events/country/{country}; wybór po nazwie w ścieżce, nie lokalny eventText. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| values [query] | Dodaje ActualValue, PreviousValue, ForecastValue, TEForecastValue zamiast konieczności parsowania skrótów K/M/%; oryginalne pola nadal odrębne. | Boolean: true | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| lang [query] | Tłumaczenie nazw; OCountry/OCategory/OEvent zachowują nazwy oryginalne. | string: it, zh, ru, es, pl, tr, ja, pt, da, fa, ko, fr, no, id, de, hu, ar, sv | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /calendar/events/country/{country}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/snapshot/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /indicators?calendar=1

[Źródło](https://docs.tradingeconomics.com/economic_calendar/indicator/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| calendar [query] | Wybiera wskaźniki dostępne w kalendarzu, a nie pełny katalog Indicators. | string: 1 | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| country [query] | Kraj dla katalogu lub listy aktualizacji. Nie jest dodatkowym path selector z innej metody. | string: GET /country | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /calendar/updates

[Źródło](https://docs.tradingeconomics.com/economic_calendar/snapshot/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /icalendar/country/{countries}/indicator/{indicators}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/icalendar/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| span [query] | Przyszłe wydarzenia iCalendar w kolejnych miesiącach. | string: 1M..12M | Nie podano; 1..12 miesięcy; plik .ics, brak opublikowanego pełnego schematu VEVENT.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /icalendar/ticker/{ticker}

[Źródło](https://docs.tradingeconomics.com/economic_calendar/icalendar/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| ticker [path] | Natywny identyfikator konkretnej serii/wydarzenia; pobrać ze snapshotu lub katalogu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| span [query] | Przyszłe wydarzenia iCalendar w kolejnych miesiącach. | string: 1M..12M | Nie podano; 1..12 miesięcy; plik .ics, brak opublikowanego pełnego schematu VEVENT.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /country/{country}

[Źródło](https://docs.tradingeconomics.com/indicators/snapshot/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.countries / Implemented |
| group [query] | Natywna CategoryGroup dla snapshotu kraju; nie grupa krajów i nie grupa kalendarza. | string: Wartości CategoryGroup z GET /indicators (np.GDP) | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| indicators (Hub local) [Hub criteria — nie parametr dostawcy] | Lokalne dokładne dopasowanie Category; nie natywna ścieżka country+indicator snapshot. | array<string>: Maks.10 nazw | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.indicators / Implemented |

### Trading Economics — GET /country/all/{indicator}

[Źródło](https://docs.tradingeconomics.com/indicators/snapshot/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| indicator [path] | Nazwa kategorii z GET /indicators; w kalendarzu katalog /indicators?calendar=1. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.indicators / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |

### Trading Economics — GET /country/ticker/{ticker}

[Źródło](https://docs.tradingeconomics.com/indicators/snapshot/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| ticker [path] | Natywny identyfikator konkretnej serii/wydarzenia; pobrać ze snapshotu lub katalogu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.tickers / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |

### Trading Economics — GET /historical/country/{country}/indicator/{indicator}

[Źródło](https://docs.tradingeconomics.com/indicators/historical/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| indicator [path] | Nazwa kategorii z GET /indicators; w kalendarzu katalog /indicators?calendar=1. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /historical/country/{countries}/indicator/{indicators}/{from}/{to}

[Źródło](https://docs.tradingeconomics.com/indicators/historical/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |

### Trading Economics — GET /historical/ticker/{ticker}/{date}

[Źródło](https://docs.tradingeconomics.com/indicators/historical/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| ticker [path] | Natywny identyfikator konkretnej serii/wydarzenia; pobrać ze snapshotu lub katalogu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| date [path] | Dzień selekcji historii/aktualizacji; znaczenie zależy od metody, nie od daty forecast target. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /historical/latest

[Źródło](https://docs.tradingeconomics.com/indicators/historical/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [query] | Kraj dla katalogu lub listy aktualizacji. Nie jest dodatkowym path selector z innej metody. | string: GET /country | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| date [query] | Dzień wyboru latest historical, zgodnie z przykładem dostawcy; nie selektor vintage. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /historical/updates

[Źródło](https://docs.tradingeconomics.com/indicators/historical/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /indicators

[Źródło](https://docs.tradingeconomics.com/indicators/indicators-countries/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /country

[Źródło](https://docs.tradingeconomics.com/indicators/indicators-countries/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /updates

[Źródło](https://docs.tradingeconomics.com/indicators/latest_updates/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /updates/{date}

[Źródło](https://docs.tradingeconomics.com/indicators/latest_updates/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| date [path] | Dzień selekcji historii/aktualizacji; znaczenie zależy od metody, nie od daty forecast target. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| time [query] | Doprecyzowanie daty na /updates/{date}; przykład15:20. Dokładna reguła inkluzywności wymaga potwierdzenia. | string: HH:MM | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /updates/country/{country}

[Źródło](https://docs.tradingeconomics.com/indicators/latest_updates/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /updates/country/{country}/{date}

[Źródło](https://docs.tradingeconomics.com/indicators/latest_updates/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| date [path] | Dzień selekcji historii/aktualizacji; znaczenie zależy od metody, nie od daty forecast target. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /changes

[Źródło](https://docs.tradingeconomics.com/indicators/changes/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /changes/{date}

[Źródło](https://docs.tradingeconomics.com/indicators/changes/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| date [path] | Dzień selekcji historii/aktualizacji; znaczenie zależy od metody, nie od daty forecast target. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /country/all/discontinued

[Źródło](https://docs.tradingeconomics.com/indicators/changes/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /country/{countries}/discontinued

[Źródło](https://docs.tradingeconomics.com/indicators/changes/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /peers/{ticker}

[Źródło](https://docs.tradingeconomics.com/indicators/peers/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| ticker [path] | Natywny identyfikator konkretnej serii/wydarzenia; pobrać ze snapshotu lub katalogu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /peers/country/{country}/{category}

[Źródło](https://docs.tradingeconomics.com/indicators/peers/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| category [path] | Dla Markets: index/currency/crypto/commodity/bond. Dla peers: nazwa wskaźnika ekonomicznego. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /credit-ratings

[Źródło](https://docs.tradingeconomics.com/indicators/credit-rating/). Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /credit-ratings/updates

[Źródło](https://docs.tradingeconomics.com/indicators/credit-rating/). Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /credit-ratings/country/{country}

[Źródło](https://docs.tradingeconomics.com/indicators/credit-rating/). Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /credit-ratings/historical

[Źródło](https://docs.tradingeconomics.com/indicators/credit-rating/). Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /credit-ratings/historical/country/{country}

[Źródło](https://docs.tradingeconomics.com/indicators/credit-rating/). Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |

### Trading Economics — GET /credit-ratings/historical/country/{country}/d1={from}/d2={to}

[Źródło](https://docs.tradingeconomics.com/indicators/credit-rating/). Pomocnicza metoda sekcji Indicators. Nietypowa składnia dat d1=/d2= zachowana z oficjalnej strony; brak walidacji LIVE.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [path] | Nazwa kraju; katalog GET /country. Regiony/grupy z katalogu służą do lokalnego wyznaczenia listy krajów, nie stanowią automatycznie nazwy endpointu. | string: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | Brak / Missing |
| from [path] | Data graniczna w ścieżce, według rodziny: publikacja wiadomości / czas wydarzenia / okres obserwacji. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |
| to [path] | Końcowa data zakresu; nie jest selektorem historycznej wersji danych. | ISO8601 date: YYYY-MM-DD | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: obie granice obowiązkowo razem, from<=to, maks.366 dni; ograniczenie walidacji zakresu, nie kwota API. | Brak / Missing |

### Trading Economics — GET /forecast/country/{countries}

[Źródło](https://docs.tradingeconomics.com/forecasts/indicators/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.countries / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| horizons (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja pól po pobraniu wszystkich horyzontów; nie selektor wersji historycznej. | array<enum>: q1,q2,q3,q4,YearEnd,YearEnd2,YearEnd3 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.horizons / Implemented |

### Trading Economics — GET /forecast/indicator/{indicators}

[Źródło](https://docs.tradingeconomics.com/forecasts/indicators/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.indicators / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| horizons (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja pól po pobraniu wszystkich horyzontów; nie selektor wersji historycznej. | array<enum>: q1,q2,q3,q4,YearEnd,YearEnd2,YearEnd3 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.horizons / Implemented |

### Trading Economics — GET /forecast/country/{countries}/indicator/{indicators}

[Źródło](https://docs.tradingeconomics.com/forecasts/indicators/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| countries [path] | Jedna lub kilka nazw krajów rozdzielonych przecinkami; aktualne wartości GET /country. Country w News może oznaczać także region/klasę, np. Commodity. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.countries / Implemented |
| indicators [path] | Nazwy z właściwego katalogu danej rodziny; nie dowolny identyfikator instrumentu. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.indicators / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| horizons (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja pól po pobraniu wszystkich horyzontów; nie selektor wersji historycznej. | array<enum>: q1,q2,q3,q4,YearEnd,YearEnd2,YearEnd3 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.horizons / Implemented |

### Trading Economics — GET /forecast/ticker/{tickers}

[Źródło](https://docs.tradingeconomics.com/forecasts/indicators/).

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| tickers [path] | Lista identyfikatorów serii z metadanych dostawcy. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.tickers / Implemented |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| horizons (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja pól po pobraniu wszystkich horyzontów; nie selektor wersji historycznej. | array<enum>: q1,q2,q3,q4,YearEnd,YearEnd2,YearEnd3 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.horizons / Implemented |

### Trading Economics — GET /forecasts/updates

[Źródło](https://docs.tradingeconomics.com/forecasts/updates/). Niejednoznaczność: szablony REST używają /forecasts/updates, przykłady SDK/HTTP /forecast/updates. Wymaga wyjaśnienia; oba warianty w inwentarzu, bez obietnicy działania.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [query] | Kraj dla katalogu lub listy aktualizacji. Nie jest dodatkowym path selector z innej metody. | string: GET /country | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| start_date [query] | Data selekcji aktualizacji; nie historyczna wersja prognozy. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /forecast/updates

[Źródło](https://docs.tradingeconomics.com/forecasts/updates/). Wariant z przykładów; patrz rozbieżność z /forecasts/updates.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| country [query] | Kraj dla katalogu lub listy aktualizacji. Nie jest dodatkowym path selector z innej metody. | string: GET /country | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |
| start_date [query] | Data selekcji aktualizacji; nie historyczna wersja prognozy. | date: YYYY-MM-DD | Nie podano; Ogólne ograniczenia TE i planu; brak dodatkowej jawnej granicy.; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — GET /markets/forecasts/{category}

[Źródło](https://docs.tradingeconomics.com/forecasts/markets/). Kod snapshot kategorii istnieje, ale rodzina pozostaje wyłączona: allow_market_forecasts=false. symbols to dopiero lokalna projekcja kategorii.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | secrets.tradingEconomics / Implemented |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | stała f=json / Partial |
| category [path] | Rodzina instrumentów Markets; nie kategoria wskaźnika ekonomicznego. | string: index, currency, crypto, commodity, bond | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Hub: nazwy maks.10, każda do200 znaków, bez dwukropka i bez .. lub kodowanych sekwencji %xx; ścieżka do1024 znaków. Dostawca ogólnie URL do260 znaków — nie gwarantować pełnej kombinacji10 długich nazw. | criteria.marketCategory / Partial |
| limit (Hub only) [Hub criteria — nie parametr dostawcy] | Projekcja lokalna pobranego podzbioru; nie natywna paginacja TE. | integer: 1..1000; domyślnie100 | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.limit / Implemented |
| symbols (Hub local) [Hub criteria — nie parametr dostawcy] | Lokalne dopasowanie Symbol w pobranym snapshot kategorii. Rodzina nadal wyłączona. | array<string>: Maks.10; np.CO1:COM | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | criteria.symbols / Implemented |

### Trading Economics — GET /markets/forecasts/symbol/{symbols}

[Źródło](https://docs.tradingeconomics.com/forecasts/markets/). Natywny wybór symboli dostawcy. Hub nie wywołuje tej ścieżki; nie aktywowano uprawnień.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| c [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| client [query] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| Authorization [header] | Trzy alternatywy tego samego uwierzytelnienia; Hub używa Authorization i nie umieszcza sekretu w URL. | string: Sekret z zatwierdzonego magazynu | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| f [query] | Wybór JSON albo CSV; Hub zawsze JSON i nie oferuje CSV dostawcy jako trybu pobierania. | enum: json, csv | Nie podano jednoznacznie w referencji; values=true i tłumaczenia kalendarza zoptymalizowane dla JSON.; Nie dotyczy / patrz opis | Brak / Missing |
| symbols [path] | Identyfikatory TE Markets; wyszukać w /markets/search, zweryfikować w /markets/symbology. Nie utożsamiać z Forecast Core. | array<string> w ścieżce: Katalog dynamiczny opisany w Opis | Nie podano; Zakres dat i głębokość historii zależne od planu; URL260 znaków wg ogólnej dokumentacji TE.; Bez natywnej ścieżki symbol w Hub. Obecne criteria.symbols filtruje lokalnie snapshot kategorii, max10, pozwala na dwukropek. | Brak / Missing |

### Trading Economics — WebSocket wss://stream.tradingeconomics.com/ — news

[Źródło](https://docs.tradingeconomics.com/news/streaming/). Brak implementacji w Hub; licencja i kontrakt strumienia wymagają odrębnego przyjęcia.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| client [query] | Uwierzytelnienie połączenia WebSocket. | string: Sekret serwerowy | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| topic [message] | Typ komunikatu subskrypcji; nie kategoria wiadomości. | enum: subscribe | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| to [message] | Nazwa subskrybowanego kanału. | enum: news | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |

### Trading Economics — WebSocket wss://stream.tradingeconomics.com/ — calendar

[Źródło](https://docs.tradingeconomics.com/economic_calendar/streaming/). Brak implementacji w Hub; licencja i kontrakt strumienia wymagają odrębnego przyjęcia.

| Parametr / lokalizacja | Znaczenie | Typ / wartości | Default / ograniczenia | Pole Hub / status |
| --- | --- | --- | --- | --- |
| client [query] | Uwierzytelnienie połączenia WebSocket. | string: Sekret serwerowy | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| topic [message] | Typ komunikatu subskrypcji; nie kategoria wiadomości. | enum: subscribe | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |
| to [message] | Nazwa subskrybowanego kanału. | enum: calendar | Nie podano; Brak dodatkowego zakresu w dokumentacji; Nie dotyczy / patrz opis | Brak / Missing |

## Źródła i data kontroli

Publiczne strony zweryfikowane 2026-11-05; odczyt dokumentacji nie jest wywołaniem API. Pełne URL źródłowe znajdują się w każdym wierszu CSV. Bieżący stan konta/planów nie został odpytywany. Nie stosowano nieoficjalnych opisów jako potwierdzenia parametrów.

- [https://api-dashboard.search.brave.com/api-reference/news/news_search/get/index.html.md](https://api-dashboard.search.brave.com/api-reference/news/news_search/get/index.html.md) — 2026-11-05, SHA-256 źródła `a0b4e501cdab75da273d907db1227f60cd4e99936caa63d0779b060a6c188690`.
- [https://api-dashboard.search.brave.com/api-reference/web/search/get](https://api-dashboard.search.brave.com/api-reference/web/search/get) — 2026-11-05, SHA-256 źródła `e8c1b789f42adf5836df028f368d9bce5eeb2c70688bc5c80e895b6084f25728`.
- [https://api-dashboard.search.brave.com/api-reference/web/search/get/index.html.md](https://api-dashboard.search.brave.com/api-reference/web/search/get/index.html.md) — 2026-11-05, SHA-256 źródła `0d8da1bff954da4ed869f5837f529d3cab983aa3158e80ae0e89d88ac2566643`.
- [https://api-dashboard.search.brave.com/documentation/guides/rate-limiting/index.html.md](https://api-dashboard.search.brave.com/documentation/guides/rate-limiting/index.html.md) — 2026-11-05, SHA-256 źródła `54eaa26e22e436f81ac3c9055833140c1e3358bc5efcdaca18db5ab608672f73`.
- [https://api-dashboard.search.brave.com/documentation/resources/goggles/index.html.md](https://api-dashboard.search.brave.com/documentation/resources/goggles/index.html.md) — 2026-11-05, SHA-256 źródła `c6c63c367b6a28c09bde12cd9b11416c0d6a775b1d9572bfb00b4c5f76835f66`.
- [https://api-dashboard.search.brave.com/documentation/resources/search-operators/index.html.md](https://api-dashboard.search.brave.com/documentation/resources/search-operators/index.html.md) — 2026-11-05, SHA-256 źródła `85d5ed80e6a02398fd9e42208958442abfdd73f7197f5ff6992fc8030185c564`.
- [https://api-dashboard.search.brave.com/documentation/services/news-search/index.html.md](https://api-dashboard.search.brave.com/documentation/services/news-search/index.html.md) — 2026-11-05, SHA-256 źródła `6c82a96c88ea890915ff2d6ba635d484bc0a8194f6e80bc223c64e4c0d288b8b`.
- [https://api-dashboard.search.brave.com/documentation/services/web-search/index.html.md](https://api-dashboard.search.brave.com/documentation/services/web-search/index.html.md) — 2026-11-05, SHA-256 źródła `f52ba32d8cafc338d008381e5f68f050e05a77d12eb5921e4d14e1818230a820`.
- [https://docs.tradingeconomics.com/change_log/](https://docs.tradingeconomics.com/change_log/) — 2026-11-05, SHA-256 źródła `19e99e95f8b1ff3659aa3e250a0b36ad4e4e8863b77429d25437c23183846e12`.
- [https://docs.tradingeconomics.com/economic_calendar/country/](https://docs.tradingeconomics.com/economic_calendar/country/) — 2026-11-05, SHA-256 źródła `43e4ebeb8af658ebef4bebb649e4d05afbe0ee5f0c68b577ddc092b3c5739d54`.
- [https://docs.tradingeconomics.com/economic_calendar/group/](https://docs.tradingeconomics.com/economic_calendar/group/) — 2026-11-05, SHA-256 źródła `0dae1048859d901dedeb1b2beeb29d7e94fa6d6eaed36ce8369e0e0bcc755b02`.
- [https://docs.tradingeconomics.com/economic_calendar/icalendar/](https://docs.tradingeconomics.com/economic_calendar/icalendar/) — 2026-11-05, SHA-256 źródła `d2c2a72410b5515215bb40b1edcb424c19c43287e59d2e0b1854daae410bb599`.
- [https://docs.tradingeconomics.com/economic_calendar/indicator/](https://docs.tradingeconomics.com/economic_calendar/indicator/) — 2026-11-05, SHA-256 źródła `8aab7983447ba8b127002555f98e98caa8f9bdac284a38dd2da8f301dffc5907`.
- [https://docs.tradingeconomics.com/economic_calendar/point-in-time/](https://docs.tradingeconomics.com/economic_calendar/point-in-time/) — 2026-11-05, SHA-256 źródła `6719a74bfb4ddaa1ac28b5f18a9689e4f5f87bc3b1f5704ed71f18b8af1737c4`.
- [https://docs.tradingeconomics.com/economic_calendar/schema/](https://docs.tradingeconomics.com/economic_calendar/schema/) — 2026-11-05, SHA-256 źródła `44b3b1f36b5e8bdff047d9e01f135fe061ef388dfee177e0a5ca2e88895d41b6`.
- [https://docs.tradingeconomics.com/economic_calendar/snapshot/](https://docs.tradingeconomics.com/economic_calendar/snapshot/) — 2026-11-05, SHA-256 źródła `8441c6c998b13abb6e09893b5af878638e5ff06a7eb5928a79708111eef5743c`.
- [https://docs.tradingeconomics.com/economic_calendar/streaming/](https://docs.tradingeconomics.com/economic_calendar/streaming/) — 2026-11-05, SHA-256 źródła `4f51f2fb9e09fa8bde77794cf0c65760e28b531001ffbdca4665c9e96aedf759`.
- [https://docs.tradingeconomics.com/economic_calendar/ticker/](https://docs.tradingeconomics.com/economic_calendar/ticker/) — 2026-11-05, SHA-256 źródła `1e594bb09f1d50dc84b8e1c8b0fd142c3d9f9bb67ddab126d4e3bb3e755e43cc`.
- [https://docs.tradingeconomics.com/economic_calendar/translations/](https://docs.tradingeconomics.com/economic_calendar/translations/) — 2026-11-05, SHA-256 źródła `d6783f4ca5e4db99939d32a97c3b70bb708e20663f4cd87a8595ff16fa008a53`.
- [https://docs.tradingeconomics.com/forecasts/indicators/](https://docs.tradingeconomics.com/forecasts/indicators/) — 2026-11-05, SHA-256 źródła `448724bbef54d195fd6e7f1088498e3bb4f673516a23306698f9a92f9b5e6e9c`.
- [https://docs.tradingeconomics.com/forecasts/markets/](https://docs.tradingeconomics.com/forecasts/markets/) — 2026-11-05, SHA-256 źródła `c54b6445de5e76ee933740c61444a28b458ba60a052105151c53f07a8dd50695`.
- [https://docs.tradingeconomics.com/forecasts/updates/](https://docs.tradingeconomics.com/forecasts/updates/) — 2026-11-05, SHA-256 źródła `5365aeee3e46170d5daed7499664bb2c209c06f6c46204dfc65c2af947c42aee`.
- [https://docs.tradingeconomics.com/get_started/authentication/](https://docs.tradingeconomics.com/get_started/authentication/) — 2026-11-05, SHA-256 źródła `16cd8217c367c7460a504a536449a5191c466fe209830c12b8d8385be541c814`.
- [https://docs.tradingeconomics.com/get_started/rate-limits/](https://docs.tradingeconomics.com/get_started/rate-limits/) — 2026-11-05, SHA-256 źródła `1fa14bd9052797cbd5fc66738f4ea52e15d68e2d5f3662fce19f0feeb67041e4`.
- [https://docs.tradingeconomics.com/indicators/changes/](https://docs.tradingeconomics.com/indicators/changes/) — 2026-11-05, SHA-256 źródła `3c3094110ff5e8a7175072ea73dfc6c79087e531ac38be3788356b7132aa9490`.
- [https://docs.tradingeconomics.com/indicators/credit-rating/](https://docs.tradingeconomics.com/indicators/credit-rating/) — 2026-11-05, SHA-256 źródła `e34804ab3f7c01b30c524db8868ea174204deac7d92fbd90b6b2ebce170021ec`.
- [https://docs.tradingeconomics.com/indicators/historical/](https://docs.tradingeconomics.com/indicators/historical/) — 2026-11-05, SHA-256 źródła `4c37eff963878a377f23b0f48d30d12678e643fc11e9304e20eeb9a98cc44317`.
- [https://docs.tradingeconomics.com/indicators/indicators-countries/](https://docs.tradingeconomics.com/indicators/indicators-countries/) — 2026-11-05, SHA-256 źródła `973eaca9a8acb3a74f47db5271d32b619b7488b23cb6cb54d53b4a97542263ab`.
- [https://docs.tradingeconomics.com/indicators/latest_updates/](https://docs.tradingeconomics.com/indicators/latest_updates/) — 2026-11-05, SHA-256 źródła `e061bb57698ac340ec73d3ee80a67f2e7001233282f7b0818685833323e040ec`.
- [https://docs.tradingeconomics.com/indicators/peers/](https://docs.tradingeconomics.com/indicators/peers/) — 2026-11-05, SHA-256 źródła `5122155cf15c8266c67e06f20a05ffeee99ac0c612aa1cda6a0c0b9ea12182ed`.
- [https://docs.tradingeconomics.com/indicators/snapshot/](https://docs.tradingeconomics.com/indicators/snapshot/) — 2026-11-05, SHA-256 źródła `47f1a20fc6006a2fd60fcb04652b51ea7c6386df7eeee87cba2b19b95137f14b`.
- [https://docs.tradingeconomics.com/news/latest/](https://docs.tradingeconomics.com/news/latest/) — 2026-11-05, SHA-256 źródła `0206732b890bb789ab90f362125538c3a2dc2b2d226944647e68af17490f90d4`.
- [https://docs.tradingeconomics.com/news/news-by-country-and-date/](https://docs.tradingeconomics.com/news/news-by-country-and-date/) — 2026-11-05, SHA-256 źródła `5be88a6f72354dae9a1888b68d314d8a674cae5dee1ccc6c74b74bbaad384e11`.
- [https://docs.tradingeconomics.com/news/news-by-country-and-indicator/](https://docs.tradingeconomics.com/news/news-by-country-and-indicator/) — 2026-11-05, SHA-256 źródła `77b662759335426065fd104ba6dca6a5ebb106cb9c1d27c7e8920f5b665e0197`.
- [https://docs.tradingeconomics.com/news/news-by-country-indicator-and-date/](https://docs.tradingeconomics.com/news/news-by-country-indicator-and-date/) — 2026-11-05, SHA-256 źródła `2c2b03e4613192a694495e36d4667dbcd63644e95b440db5fe85776796f27002`.
- [https://docs.tradingeconomics.com/news/news-by-country/](https://docs.tradingeconomics.com/news/news-by-country/) — 2026-11-05, SHA-256 źródła `b0c981f9ed26d56226d2cee6daacd8c8541f51e795fae78382868291ce74143b`.
- [https://docs.tradingeconomics.com/news/news-by-date/](https://docs.tradingeconomics.com/news/news-by-date/) — 2026-11-05, SHA-256 źródła `232ee21d37bd89d66802364335b3ac6ea54c66255845ae63240fb84763606bfe`.
- [https://docs.tradingeconomics.com/news/news-by-indicator-and-date/](https://docs.tradingeconomics.com/news/news-by-indicator-and-date/) — 2026-11-05, SHA-256 źródła `c323aea7b4428ec9b5544007467aaf72a97acb5375d8ac2a2e22dc9194a546bc`.
- [https://docs.tradingeconomics.com/news/news-by-indicator/](https://docs.tradingeconomics.com/news/news-by-indicator/) — 2026-11-05, SHA-256 źródła `65b6e042c6818eab92abbbbd0893d4912bb3351bde47492eeaf9a930e832148e`.
- [https://docs.tradingeconomics.com/news/news-by-ticker/](https://docs.tradingeconomics.com/news/news-by-ticker/) — 2026-11-05, SHA-256 źródła `6fc5a1c162e5cdfcdfeb88e33717848890742738dfd9d60262b829658cd27eb6`.
- [https://docs.tradingeconomics.com/news/news-by-type/](https://docs.tradingeconomics.com/news/news-by-type/) — 2026-11-05, SHA-256 źródła `f157b48e360a5f93331d6315a3b36fa1182fedadebcd3a1b512cb9198c2547df`.
- [https://docs.tradingeconomics.com/news/response-fields/](https://docs.tradingeconomics.com/news/response-fields/) — 2026-11-05, SHA-256 źródła `eeca9d8287de3750526697f5c2c57ea62390e897878e58d505cc4c62c3c640e9`.
- [https://docs.tradingeconomics.com/news/streaming/](https://docs.tradingeconomics.com/news/streaming/) — 2026-11-05, SHA-256 źródła `f753ba221dfdac7760a269813cb5a090d6145f0327adda7ea58735d9a5b34632`.
- [https://docs.tradingeconomics.com/search/](https://docs.tradingeconomics.com/search/) — 2026-11-05, SHA-256 źródła `931588e9d6e26d7669180dbed09cff736492eca43b3e235e9e9520671c4f2559`.
- [https://newsapi.org/docs/authentication](https://newsapi.org/docs/authentication) — 2026-11-05, SHA-256 źródła `bae9c7b325473f712910338ba27f7ffbc23915dbc23c3a1cc048174762e26692`.
- [https://newsapi.org/docs/endpoints/everything](https://newsapi.org/docs/endpoints/everything) — 2026-11-05, SHA-256 źródła `9e11841ead870ed8d81efd354ab06ab3b9218b835824b0751f5e61429441178b`.
- [https://newsapi.org/docs/endpoints/sources](https://newsapi.org/docs/endpoints/sources) — 2026-11-05, SHA-256 źródła `95eeaae627d911ebcea1b0d1b81a14f2899a279564fabb8dd1d0f84de6fea67d`.
- [https://newsapi.org/docs/endpoints/top-headlines](https://newsapi.org/docs/endpoints/top-headlines) — 2026-11-05, SHA-256 źródła `3b74414afda2f7467cb65ad0706533a9bb6fc8924f84a03e55271c22708ef779`.
- [https://newsapi.org/docs/errors](https://newsapi.org/docs/errors) — 2026-11-05, SHA-256 źródła `efddc49b3aa69c92e9ab702d3f0d95ad5f3b66dbd60337f7a702008f61f2445b`.
- [https://newsapi.org/pricing](https://newsapi.org/pricing) — 2026-11-05, SHA-256 źródła `933896d71ba78e786af490c253a3e415b9612786d79ea29af4c3ee93cf38a7d4`.
- [https://search.brave.com/help/operators](https://search.brave.com/help/operators) — 2026-11-05, SHA-256 źródła `e51808f0308cffd757b7490db528c57a26cea13890475766d046febdf871b0de`.
