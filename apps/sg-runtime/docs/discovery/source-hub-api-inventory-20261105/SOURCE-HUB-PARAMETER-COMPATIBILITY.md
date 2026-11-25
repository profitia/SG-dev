# Kompatybilność parametrów Source Hub

Stan 2026-11-05, kod `8dfe12b9311f24227c904c13900e373aea518490`. Macierz rozdziela zakaz dostawcy, ograniczenie implementacji, lokalną selekcję i brak dowodu. Wszystkie kombinacje poza trzema prostymi próbami z [handoffu LIVE](https://github.com/profitia/project-history-repository/blob/fffda7053c25affbb84984633a30dd1543153a87/history/2026/11/05/2026-11-05-16-51-27Z__architecture-architecture-source-hub-live-providers-phr-recovery-20261105/handoff.md) są dokumentacyjne/offline. Przykłady nie wywołują API; sekrety są pominięte. Dozwolone w referencji nie oznacza potwierdzone w konkretnym planie.

| Rodzina / endpoint | Kombinacja | Ocena | Przykład | Warunek / zachowanie UX |
| --- | --- | --- | --- | --- |
| NewsAPI Everything | q + searchIn | Dozwolone | q=oil&searchIn=title | W Hub fields wymaga q/terms. qInTitle nieudokumentowany. |
| NewsAPI Everything | AND / OR / NOT / + / - / cudzysłowy / nawiasy | Dozwolone w tym endpointcie | (Brent OR WTI) AND oil NOT cooking | Kompilator terms i tekst udokumentowane; niepotwierdzone LIVE. |
| NewsAPI Everything | sources + country/category | Nieobsługiwane w tym endpointcie | sources=reuters; bez country/category | country/category nie są filtrami Everything; nie przenosić headlines. |
| NewsAPI Everything | domains + excludeDomains | Dozwolone warunkowo | domains=iea.org&excludeDomains=example.com | Hub odrzuca tę samą domenę w obu listach. |
| NewsAPI Everything | from + to + language + sortBy | Dozwolone | from=2026-11-01&to=2026-11-05&language=en&sortBy=publishedAt | Historia i maksymalny retrievable result plan-dependent. |
| NewsAPI Headlines | sources + country | Niedozwolone przez API | sources=reuters&country=us | Hub INCOMPATIBLE_CRITERIA; kontrolki wzajemnie wykluczające. |
| NewsAPI Headlines | sources + category | Niedozwolone przez API | sources=reuters&category=business | Hub INCOMPATIBLE_CRITERIA. |
| NewsAPI Headlines | country + category + q | Dozwolone | country=us&category=business&q=oil | Aktualny enum country tylko us; semantyka edycji. |
| NewsAPI Headlines | zaawansowane operatory q | Niezweryfikowane u API / odrzucone w Hub | oil AND gas | Hub UNSUPPORTED_CRITERIA. Nie nazywać udokumentowaną gramatyką Headlines. |
| NewsAPI Sources | country + language + category | Dozwolone | country=pl&category=business | Katalog wydawców; language=pl nie ma w enum, krajpl istnieje. |
| Brave Web | site: + OR + NOT | Dozwolone składniowo; semantyka niezweryfikowana | oil site:iea.org OR site:eia.gov NOT site:example.com | Eksperymentalne; nie deklarować pierwszeństwa/grupowania. Domains Hub dodatkowo sprawdza hosty lokalnie. |
| Brave Web | (…) + AND/OR | Niezweryfikowane | (Brent OR WTI) AND oil | Oficjalne strony nie potwierdzają nawiasów. Kompilator Hub używający ich nie jest dowodem dostawcy. |
| Brave Web | freshness + country + search_lang | Dozwolone w endpointcie; brak LIVE kombinacji | freshness=pw&country=ALL&search_lang=en | Świeżość strony z publikacji/modyfikacji; language enum częściowo rozjechany z Hub. |
| Brave Web | result_filter=web + count + offset | Dozwolone | count=10&offset=1 | Offset to strona, nakładanie wyników możliwe. |
| Brave Web news cluster | count lub offset | Nieobsługiwane w Hub | result_filter=news; bez count/offset | Count Web dotyczy web; nie używać zasad dedykowanego News. |
| Brave Web | result_filter=web,news,videos | Dozwolone przez dostawcę zależnie od planu; brak Hub | result_filter=web,news,videos | Hub tylko jeden web albo news; brak ekspozycji videos. |
| Brave Dedicated News | count=30 + q | Dozwolone przez dostawcę; brak Hub | count=30&q=oil | Maks.50 i q400znaków/50słów; odrębny entitlement. |
| Brave Web | goggles + inne kryteria | Udokumentowane; brak Hub | q=oil&goggles=<zatwierdzony URL> | Re-ranking, nie gwarancja wykluczenia; maks.3Goggles. |
| Brave Web | operators_fallback + metadane zastosowania | Udokumentowane; brak Hub | operators_fallback=true | Wymaga zachowania query.search_operators.applied i flag per wynik. Nie utożsamiać z istniejącym providerQueryAltered. |
| TE News | kraj + wskaźnik + okres | Dozwolone | /news/country/poland/inflation%20rate?d1=2026-11-01&d2=2026-11-05 | Hub native selectors; lokalny limit nie dowodzi kompletności. |
| TE News | ticker + zakres dat | Niezweryfikowane dla REST; nieobsługiwane w Hub | /news/ticker/USURTOT bez d1/d2 | Nie przenosić parametrów oficjalnego MCP do surowego REST. |
| TE News | type + country/indicator/ticker | Niezweryfikowane u dostawcy; odrzucone w Hub | criteria.newsType=markets bez innych selectorów | Dopuszczone tylko rozłączne warianty przyjętego kontraktu. |
| TE News | q / text + limit | Dostępne tylko lokalnie w Hub dla text; limit rozbieżny | criteria.text=oil;criteria.limit=3 | TE Latest ma native limit/start, ale Hub ich nie wysyła; text to substring w pobranym podzbiorze. |
| TE News Latest | limit + start | Dozwolone przez dostawcę; brak natywnej paginacji Hub | limit=5&start=150 | Nie deklarować działania na wszystkich ścieżkach News. |
| TE Calendar | kraj + importance + okres | Dozwolone | /calendar/country/poland/2026-11-01/2026-11-05?importance=3 | Natywne; Hub max366dni. Brak LIVE; nie deklarować progowej semantyki importance. |
| TE Calendar | kraj + indicator + okres | Dozwolone w konkretnej ścieżce | /calendar/country/poland/indicator/inflation%20rate/2026-11-01/2026-11-30 | Historyczne daty nie gwarantują point-in-time/vintage. |
| TE Calendar | ticker + okres | Dozwolone przez API; brak Hub | /calendar/ticker/USURTOT/2026-11-01/2026-11-05 | Obecny adapter odrzuca tę kombinację. |
| TE Calendar | CalendarID + inne selektory | Niedozwolone w Hub; niezweryfikowane REST | eventIds:[174108] bez importance/dat/krajów | Nie przypisywać ograniczenia Hub dostawcy. |
| TE Calendar | values=true + f=json | Dozwolone przez dostawcę; brak Hub | /calendar?values=true&f=json | ActualValue/PreviousValue/ForecastValue/TEForecastValue są odpowiedzią; nie query filters. |
| TE Calendar | group + kraj + okres | Dozwolone przez dostawcę; brak Hub | /calendar/country/poland/group/bonds/2026-11-01/2026-11-30 | Grupy kalendarza mają własne znaczenie; pełny katalog niepotwierdzony. |
| TE Indicators snapshot | kraje + indicators | W Hub dostępne tylko jako lokalna projekcja | criteria.countries=[poland];criteria.indicators=[inflation rate] | Snapshot /country/poland; Category porównywana lokalnie. |
| TE Indicators snapshot | wiele indicators bez country | Nieobsługiwane w Hub | indicators:[gdp] — pojedynczy | Dostępny natywny /country/all/{indicator}; nie wymyślać mnogiej ścieżki. |
| TE Indicators | frequency/units + snapshot | Nieudokumentowany filtr wejściowy | Frequency/Unit pozostają polami odpowiedzi | Można lokalnie selekcjonować prezentowane rekordy w konsumencie, bez obietnicy kompletności. |
| TE Indicator Forecasts | ticker + kraj | Nieobsługiwane w Hub; różne ścieżki dostawcy | tickers:[USURTOT] ALBO countries:[united states] | Wyłączność selectorów; nie łączyć ścieżek przez analogię. |
| TE Indicator Forecasts | horizons + country/indicator | Dostępne tylko lokalnie dla horyzontów | horizons:[q1,YearEnd] | Upstream zwraca wszystkie pola; q1_date jest polem odpowiedzi. |
| TE Market Forecasts | category + symbols | Hub lokalnie; rodzina wyłączona | marketCategory:commodity;symbols:[CO1:COM] | Nie natywne zawężenie instrumentu: najpierw pobrana kategoria. |
| TE Market Forecasts | natywny symbol bez kategorii | Dozwolone przez API; brak Hub i admission | /markets/forecasts/symbol/CO1:COM,CL1:COM | Wymaga osobnego entitlement i potrzeby konsumenta; pozostaje OFF. |
| TE Forecasts | ForecastLastUpdate + historyczny vintage | Nieudokumentowane jako zapytanie vintage | Brak accepted query.asOf/vintage | Pole update nie pozwala samodzielnie odtworzyć dawnych prognoz. |

## Reguły walidacji formularzy

1. Najpierw provider i rodzina/tryb; dopiero potem dostępne kryteria. Zmiana providera wymaga jawnego przeglądu nieprzenoszalnych filtrów.
2. NewsAPI Everything wymaga tekstu/terms lub sources lub domains. Headlines wymaga text/sources/editionCountry/category. fields w Everything wymaga tekstu/terms. Daty od<=do; dozwolona pojedyncza granica NewsAPI, natomiast Hub TE wymaga obu.
3. TE tickers są alternatywą do countries/indicators; Calendar eventIds mają osobny tryb. Indicator snapshot bez countries dopuszcza jeden indicator. Pustych list i zduplikowanych nazw Hub nie przyjmuje.
4. Brave po kompilacji domen nadal musi zmieścić q w600znakach/75słowach; domains/excludedDomains maks.10 pozycji każda. Nakładanie list blokowane. Wiele stron może zawierać duplikaty.
5. Parametry local projection nie rozszerzają pobranego zbioru. Mniejszy wynik po filtrze lokalnym nie dowodzi braku informacji u dostawcy. Nie ogłaszać COMPLETE.
6. forecast horizons i pola Actual/Forecast/Unit/LastUpdate nie stają się przez obecność w odpowiedzi filtrami query. Markets pozostaje nieaktywny; nie generować aktywnego żądania bez przyjęcia.

## Zakres dowodu

[Rejestr parametrów](SOURCE-HUB-API-PARAMETERS.csv) podaje Source i Verification scope dla każdego wiersza; [przykłady](SOURCE-HUB-QUERY-EXAMPLES.md) obejmują również celowe odmowy Hub. Wszystkie operatory Brave eksperymentalne; brak gwarancji nawiasów, pierwszeństwa lub ścisłości z samego HTTP200. Reguły dostawcy wynikają z referencji przypisanej do danego endpointu w [inwentarzu](SOURCE-HUB-API-PARAMETER-INVENTORY.md).
