# ZSRIR · kontrakt danych E1-T01 v1.0

**Status `REVIEW_REQUIRED` · projekt SG2 · profil Development · data 22.11.2026.** Opracowanie kontraktu i testy offline w mandacie E1-T01. Akceptacja projektu i roadmapy F3 dotyczy zamrożonej Karty v0.4. Decyzje operacyjne i kontraktowe poniżej mają wskazanych właścicieli. DEC-01 przypisuje ZSRIR do SG Runtime / Market Data. [Zamrożona Karta v0.4](https://github.com/profitia/SG-dev/blob/c5d9120db40596b8f267b7a908afb2a232fc76da/Canon/proposals/bsdc/SG2/BSDC-20261122-ZSRIR-BENCHMARK-FINDER.md) · [GOV-01 #1285](https://github.com/profitia/SG-dev/issues/1285)

## 1. Dowody, kanały i warunki użycia

Podstawą jest istniejąca inwentaryzacja MRiRW/ZSRIR z 22.11.2026, SHA-256 `b3f1f111f346b9eb5b476d78f329944738be70b2e85c25a10e18915a5f56cbe2`. Liczby odnoszą się do tego obrazu, a pełne pokrycie danych zostanie rozliczone w E1-T02. Karta §2 opisuje zakres wcześniejszego audytu. Odczyt workbooka obejmował jego kopię już dostępną w obszarze roboczym. Źródła zewnętrzne pozostawały w tym zadaniu poza zakresem wywołań. [Dowody w Karcie](https://github.com/profitia/SG-dev/blob/c5d9120db40596b8f267b7a908afb2a232fc76da/Canon/proposals/bsdc/SG2/BSDC-20261122-ZSRIR-BENCHMARK-FINDER.md#L23-L36)

| Kanał i typ | Ustalenie z inwentaryzacji | Tożsamość pozycji wykazu |
|---|---|---|
| `GOV_PL` / `BULLETIN` | Dwie strony indeksu, 13 rynków i archiwum. 3 210 wystąpień linków Excel, 3 206 różnych URL. Wydania mogą występować bezpośrednio w katalogu lub przez sekcję roczną, kolejne strony i stronę wydania. Drób 2024 ma sześć stron i 51 wydań. | Strona nadrzędna i wydanie, lokalny identyfikator załącznika lub stabilny URL, rzeczywisty format. Paginacja, przekierowania i przypadki PDF bez Excela zachowują odrębny wpis. |
| `GOV_PL` / `ARCHIVE_MEMBER` | 56 paczek, 28 ZIP i 28 RAR. W spisach 1 332 pliki Excel, 1 283 XLSX i 49 XLS. Paczki także w nowszych wydaniach. | Identyfikator i hash paczki oraz oryginalna ścieżka i hash pliku w paczce. Indeks opakowania nie zastępuje okresu i daty wydania członu. |
| `ZSRIR_PORTAL` / `BULLETIN` | 16 katalogów i 2 419 pozycji, w tym 1 245 XLSX i 1 174 PDF. Znane są identyfikatory katalogu i pliku. Audyt odnotował katalog 16 jako PDF-only. | ID katalogu i pliku, URL wydania i pliku, wersja treści, surowe granice okresu i pole publikacji. PDF-only do wykazu oceny mechanizmu. |
| `ZSRIR_PORTAL` / `DYNAMIC_EXPORT` | 15 rynków i 54 formularze. Próba krajowego rzepaku 19.10–15.11.2026 dała cztery obserwacje i XLSX w zł/tona. Próba I kw. 2003 zwróciła serię bez wartości. Parametry obejmują rynek, formularz, towar, okres i agregację. | ID rynku, formularza i pełna ścieżka opcji wraz z agregacją i selektorami zakresu. Zachować identyfikator lub fingerprint odpowiedzi i poszczególnych punktów. Wytworzenie pliku eksportu ma osobny czas. |
| Formaty i pozycje do oceny | W próbach otwarto 54 XLSX. Dwa XLS rozpoznano po sygnaturze OLE/BIFF. Wydanie może łączyć tabele tygodniowe, miesięczne, handel i inne miary. | Rozróżniać znalezione, pobrane i odczytane. XLS, PDF/OCR, błędy i nowe formaty rozliczyć w manifeście z przyczyną i dalszą dyspozycją. |

Rozpoznane w audycie lokalizacje to indeks, paginacja i archiwum Gov.pl oraz katalog biuletynów i przegląd danych ZSRIR. Audyt odnotował ścieżki odczytowe aplikacji dla list plików, pobrań oraz generowania eksportów. Raport opisuje je jako powierzchnie aplikacji webowej, a dokumentację API jako opis raportowania przez uprawnionych dostawców. Ścieżki aplikacji zapisane w audycie są kandydatami do ograniczonego dopuszczenia per operacja. Odpowiedź aplikacji i wynik wcześniejszej próby dostępu potwierdzają techniczną dostępność w chwili audytu. [Gov.pl — indeks](https://www.gov.pl/web/rolnictwo/biuletyny-informacyjne) · [Gov.pl — archiwum](https://www.gov.pl/web/rolnictwo/archiwalne-notowania) · [ZSRIR — katalog](https://zsrir.minrol.gov.pl/api/ZsrirData/GetReportList) · [ZSRIR — przegląd](https://zsrir.minrol.gov.pl/data)

**Warunki użycia.** Arkusz „Wynik” przypisuje instrukcji ZSRIR wymóg wskazania pochodzenia. Kontrakt wymaga atrybucji MRiRW i identyfikowalności wydania oraz odrębnego opisania przekształceń i korekt. Dla obu kanałów wynik weryfikacji pełnego zakresu praw jest `DO_POTWIERDZENIA`. Dostępne dowody nie zawierają kompletnej wersjonowanej podstawy dla pobrań automatycznych, retencji źródłowych plików, użycia w produkcie, publikacji wykresu i udostępniania przetworzonych danych klientom. Właściciel Source i właściwy właściciel polityki użycia mają udokumentować źródło normy, wersję, zakres plików i operacji, okres przechowywania, atrybucję, dopuszczony krąg odbiorców i ograniczenia. Licencja wyniku ani dopuszczenie transportu nie mogą być dziedziczone z Macrobond. Instrukcja ZSRIR jest wskazaniem do weryfikacji z istniejącego audytu. [Atrybucja i reguły źródłowe w kanonie](https://github.com/profitia/SG-dev/blob/997b477dee3a9a40a947cfad242daf6d4eccf23d/Canon/v1.0-platform-source-hub-business-and-architecture-canon.md#L44-L48)

## 2. Kontrakt wielu dostawców i tożsamość

**Kontrakt v1.0** zachowuje parę `(provider_code, provider_series_id)` w katalogu, wyszukiwaniu, kluczu pamięci podręcznej, zapisanej serii oraz autoryzowanym zasobie odczytu. Dostawca przyjmuje `MACROBOND` albo `ZSRIR` w przyszłej wersjonowanej ścieżce. Macrobond zachowuje dotychczasowe identyfikatory, kontrakty i listy filtrów. ZSRIR wyszukuje przyjęty katalog SG2. `MRIRW` oznacza wydawcę ZSRIR, a kanał jest częścią pochodzenia. Dostawca, wydawca, kanał i kategoria stanowią osobne wymiary. Dwie publikacje MRiRW o tej samej definicji i wartości mogą dać jedną obserwację z wieloma referencjami. Kolizja z identyfikatorem lub nazwą Macrobond rozwiązuje się w przestrzeni dostawcy, także w zapisanych seriach i cache. [Kontrakty](https://github.com/profitia/SG-dev/blob/997b477dee3a9a40a947cfad242daf6d4eccf23d/apps/sg-runtime/lib/benchmark/contracts.ts) · [Zapisane serie](https://github.com/profitia/SG-dev/blob/997b477dee3a9a40a947cfad242daf6d4eccf23d/apps/sg-runtime/lib/benchmark/repository.ts) · [Kontrolowany odczyt](https://github.com/profitia/SG-dev/blob/997b477dee3a9a40a947cfad242daf6d4eccf23d/apps/sg-runtime/lib/market-data/stored-read.ts)

**Klucz ZSRIR.** Propozycja deterministycznego identyfikatora `zsrir:v1:<sha256>`, gdzie wejściem jest zwarta tablica JSON kodów bez spacji między elementami, zapisana jako UTF-8 w kolejności `[market_code, product_code, metric_code, geography_code, frequency, unit, currency, aggregation_code]`. Słowniki wydawane z wersją mapowania zapewniają stabilne kody ASCII. `product_code` obejmuje wariant towaru, a `metric_code` rodzaj ceny i podstawę notowania, w tym odrębność skupu, sprzedaży, detalu oraz wartości ważonej, jeśli formularz potwierdza jej znaczenie. `aggregation_code` rozróżnia pozostały zakres agregacji źródła. Katalog przechowuje pełny tuple i powiązania z natywnymi identyfikatorami. Przy hash collision różniące się tuple wstrzymują przyjęcie, zachowując oba wejścia. Etykieta, kategoria, kanał publikacji, data detekcji i korekta wartości nie uczestniczą w tożsamości. Istotna zmiana definicji tworzy odrębną serię, a aktualizacja etykiety utrzymuje klucz.

**Klucz logiczny obserwacji** to `(provider_code, provider_series_id, period_start, period_end)`. Obie granice to daty kalendarzowe włącznie. `observed_at` jest projekcją końca okresu do istniejących odczytów, wyrażoną w CSV jako data ISO. Odtwarzalne mapowanie znaczenia i czasu tej projekcji na typ bieżącego magazynu weryfikuje E2-T01 w przewidzianej próbie. Różne początki przy tym samym końcu stanowią różne klucze, dopóki dowód źródłowy nie wykaże korekty granic tej samej obserwacji. Obecna unikatowość `(seriesId, observedAt)` jest w tym przypadku za wąska. Zachować fizyczną ścieżkę Macrobond i rozstrzygnąć model okresów w E2-T01 przed importem. [Aktualny model Neon w repo](https://github.com/profitia/SG-dev/blob/997b477dee3a9a40a947cfad242daf6d4eccf23d/apps/sg-runtime/prisma-market-data/schema.prisma#L28-L76)

## 3. Mapowanie rynku, towaru, miary i facetów

Identyfikatory pochodzą z arkuszy „Rynki i katalogi” i „Formularze ZSRIR”. ID katalogu biuletynów ma inną przestrzeń niż ID rynku formularzy. Powiązanie w tabeli wyznacza rodzinę do kwalifikacji. Ustalenie tożsamości dwóch serii wymaga dodatkowo zgodności definicji produktu, miary, agregacji, geografii, okresu i jednostki.

| Kod rynku SG2 (propozycja) | Katalog ZSRIR | Rynek formularzy | Formularze (ID) |
|---|---:|---:|---|
| `SHEEP` — baranina | 10 | 12 | 26 |
| `HOPS` — chmiel | 5 | 15 | 36, 37 |
| `SUGAR` — cukier | 9 | 17 | 34, 1059, 1063, 1064, 1081 |
| `POULTRY` — drób | 6 | 2 | 39, 40, 41, 42 |
| `EGGS` — jaja | 7 | 8 | 46, 47, 48 |
| `DAIRY` — mleko i przetwory | 1 | 3 | 17, 19, 21, 22, 23, 24, 25, 1056 |
| `FRUIT` — owoce | 11 | 6 | 1038, 1040, 1041, 1083 |
| `FEED` — pasze | 8 | 14 | 49, 50, 51 |
| `OILSEEDS` — oleiste | 3 | 13 | 53, 54 |
| `TOBACCO` — tytoń | 4 | 19 | 1054, 1055 |
| `VEGETABLES` — warzywa | 12 | 10 | 1039, 1082 |
| `PORK` — wieprzowina | 14 | 1 | 1048, 1049, 1051, 1052 |
| `BEEF_VEAL` — wołowina i cielęcina | 13 | 18 | 55, 57, 58, 59, 60, 61 |
| `HIGH_PROTEIN_CROPS` — wysokobiałkowe | — | 20 | 62, 63 |
| `GRAINS` — zboża | 2 | 5 | 1043, 1044, 1045, 1046, 1047, 1058 |

Katalog 15 (bieżące notowania) i 16 (przegląd syntetyczny) nie stanowią jednej rodziny serii. Rynek przypisać z właściwej tabeli danej publikacji. Analogicznie z góry nie przypisywać całego archiwum Gov.pl do jednej rodziny. Gov.pl prowadzi owoce i warzywa przez jeden katalog, a portal rozdziela je na dwa. Ten sam hash w dwóch katalogach zachowuje dwie referencje wydania.

| Wejście lub etykieta | Reguła v1.0 |
|---|---|
| Formularz 53, opcje `commodityGroup_422` i `commodityGroup_421` | Dwa oddzielne warianty rzepaku krajowego i importowanego. Krajowość w etykiecie to wariant pochodzenia towaru, a geografia notowania pochodzi z osobnego wymiaru. Cena skupu w przykładzie ma jednostkę zł/tona. |
| Formularze 39–42 | Rozdziel skup drobiu, sprzedaż mięsa, sprzedaż mrożonego mięsa i zakup detaliczny. Opcja towarowa zachowuje cały łańcuch formy, nadrzędnej grupy i wariantu. |
| Formularze 19 i 22 | Rozdziel mleko i mleko ekologiczne, nawet przy zgodnych etykietach okresu i jednostki. Oba cykle w wykazie są miesięczne. |
| Formularze 62 i 63 | Osobne produkty i rytmy obserwacji. Soja zgłoszona tygodniowo, strączkowe miesięcznie. |
| Jednostka i waluta | Przykład `zł/tona` mapuje się do `unit=PLN/t`, `currency=PLN`. Ujednolicać wyłącznie równoważne skale przy jawnej regule konwersji i zachowaniu źródłowej miary. Rozróżnić m.in. masę żywą, tuszę, opakowanie, sztukę i różne waluty. Brak podstawy do domyślnego przeliczenia. |
| Filtry w formularzu | Natywny token, ścieżka nadrzędna i etykieta trafiają do mapowania. Opcje ukryte i brak metadanych zachowują stan w zbiorze przejściowym. Brak mapowania wstrzymuje wrzucenie w produkt i wskazuje pozycję do oceny. |
| Kategoria | Żywność `FOOD`. Pasze i tytoń `COMMODITIES`, etykieta „Commodities”. Cel klasyfikacji to użycie biznesowe. Niejednoznaczne pozycje, np. przemysłowy wariant surowca, wymagają mapowania zgodnego z rodziną i miarą. |

**Facety Findera.** Do uzgodnienia przed importem. Implementacja i prezentacja Advanced Search należą do E3.

| Facet | Semantyka |
|---|---|
| `provider_code` | Jawny `MACROBOND` / `ZSRIR`. Liczniki, uprawnienia i zbiór wartości są liczone dla dostępnego katalogu. |
| `category_code` | Kategoria biznesowa SG2 `FOOD` / `COMMODITIES`. Istniejące pole rodzaju definicji facetu `business` / `technical` ma osobne znaczenie. |
| `market_code`, `product_code`, `metric_code` | Rynek, towar z wariantem oraz rodzaj ceny i podstawa notowania. Filtr kategorii nie podstawia wartości towaru lub wskaźnika. |
| `geography_code`, `frequency` | Geografia obserwacji oraz częstotliwość okresu `WEEKLY`, `MONTHLY` lub jawna `IRREGULAR` według źródła i tabeli. Kadencja publikacji jest odrębną metryką. Brak rozpoznania to `UNKNOWN`. |

W wersjonowanym katalogu AND między kluczami i OR w obrębie listy wartości tam, gdzie kontrakt dopuszcza wybór wielu. Nieznany brak metadanych, znany brak wyników i facet niewspierany przez dostawcę mają różne stany. Jawnie zastosowany filtr nie może zostać pominięty ani przeniesiony do słownika drugiego dostawcy. Kanał i wydawcę pokaże pochodzenie. Ważność mapowań i tożsamość serii rozstrzyga wersja katalogu, a nie podobieństwo nazw.

## 4. Trzy warstwy i kwalifikacja do pierwszego wsadu

| Warstwa | Zawartość i reguły |
|---|---|
| Surowy zrzut + manifest | Pełny spis rozpoznanych pozycji i referencji, identyfikatory, typ/formę, hierarchię, surowy nośnik i SHA-256, gdy uzyskany. Jeden hash może mieć wiele URL, wpisów i dat publikacji. Mianownik to wszystkie pozycje wykazu z uzasadnionym stanem i osobne liczniki pozycji oraz unikatowych hashy. Rozliczyć etapy `DISCOVERED`, `ACQUIRED`, `UNAVAILABLE` i `NEEDS_FORMAT_REVIEW` oraz osobno wynik odczytu i mapowania tabel. Powiązanie kopii z payloadem pozostawia oryginalną pozycję wykazu. |
| Zbiór przejściowy | Jedna pozycja zachowuje lokalizator źródłowy, surową wartość lub stan braku, okres, metadane i deklarowaną precyzję. Zachować m.in. puste wartości, znane maskowania, nieczytelne komórki, format do oceny, kopie, odstające okresy, wiele rewizji, nierozstrzygnięte konflikty i daty publikacji nieweryfikowalne. Raport rozlicza przejścia oraz decyzje według rodziny i źródła. Luki same nie stanowią podstawy wyłączenia. |
| Jeden CSV importowy | Wyłącznie uzgodniona reprezentacja kwalifikowanych obserwacji. Zero podwójnych kluczy, nierozstrzygniętych kolizji i osieroconych referencji. Powiązać każde wyłączenie z pozycją przejściową, przesłanką i decyzją. Stały snapshot wejściowy i wersja mapowania dają te same bajty. |

**Pochodzenie.** Każda referencja w polu `provenance` zawiera co najmniej `provider_code`, `publisher_code`, `channel_code`, `report_type`, `publication_ref`, `artifact_ref`, `locator`, `publication_time` (tekst źródłowy, precyzja, ustalona strefa albo jej brak, referencja dowodu), `revision_ref` oraz `sha256` albo identyfikator wersji, jeśli istnieją. `locator` to np. arkusz, tabela i komórka, ścieżka w paczce albo znormalizowane publiczne parametry eksportu oraz identyfikator punktu. Dla agregacji zachować metodę, a dla liczb surową jednostkę i regułę przeliczenia. Funkcja hash identyfikuje bajty, a wpis manifestu reprezentuje wystąpienie źródła. Czas pobrania, pierwszy odczyt, migawka i dowody warunków użycia są w manifeście. Unikać umieszczania poświadczeń i prywatnych parametrów w referencjach. Wersjonowane mapowanie i udokumentowana rewizja łączą plik z konkretną obserwacją.

**Odcięcie.** Zatwierdzona chwila inkluzywna to `2026-11-22T23:59:59+01:00` (`2026-11-22T22:59:59Z`, Europe/Warsaw). Porównywać chwilę udokumentowanej publikacji tej wersji. Zachować ułamki sekund bez zaokrąglania przed porównaniem. Czas pobrania, data końca okresu, generacja eksportu, identyfikator pliku i rok katalogu nie potwierdzają daty publikacji. Dla Gov.pl zachować odrębnie „Data na liście” i „Pierwsza publikacja WWW” wraz z dowodem, że dotyczą konkretnego pliku lub wydania. W audycie lista ma datę dla 3 206 z 3 210 wierszy wystąpień, a pole pierwszej publikacji WWW dla 315. Dla portalu odczytano 1 245 z 1 245 pól publikacji, wszystkie bez jawnego offsetu w zapisanym materiale.

- `BEFORE_OR_AT_CUTOFF` gdy wiarygodny timestamp z offsetem lub udokumentowaną strefą, albo cały uzasadniony przedział możliwych chwil, znajduje się po stronie pierwszego wsadu.
- `AFTER_CUTOFF` gdy całość możliwych chwil jest późniejsza. Publikacje i korekty z tej grupy obejmuje uzupełnienie przed zwykłym cyklem. Ścisła granica `23:59:59` nie oznacza automatycznego przesunięcia do północy.
- `NEEDS_DATE_REVIEW` gdy chwili lub znaczenia pola nie można udokumentować, dowody daty się wykluczają albo jej precyzja lub strefa dają przedział przecinający granicę. Dotyczy m.in. daty bez czasu z samego dnia odcięcia, dopóki właściciel nie zaakceptuje dowodu pozwalającego ją rozstrzygnąć. Niepewną datę zachować w zbiorze przejściowym. Dla strefowej godziny dwuznacznej przy zmianie czasu zachować obie możliwości, a dla godziny nieistniejącej zgłosić błąd danych.

**Kopie i rewizje.** Identyczne bajty można przechować raz przy utrzymaniu wszystkich referencji. Zgodne wartości scalać po pełnym kluczu i porównywalnej miarze. Ponowna publikacja lub kopia nie zmienia czasu pierwotnego dopuszczonego dowodu tej wersji. Udokumentowana korekta tworzy rewizję z powiązaniem poprzednika, zachowuje dawną wartość, czas i identyfikator, a zmiana granic wymaga dowodu zastąpienia. Korekta po odcięciu nie nadpisuje wstecz obrazu pierwszego wsadu. Sprzeczność bez dowodu pierwszeństwa pozostaje nierozstrzygnięta. Puste, zamaskowane i niedostępne wartości mają typowane, odrębne stany. Audyt odnotował w instrukcji próg liczby dostawców. Konkretne pole otrzymuje stan maskowania tylko przy wskazaniu tego przez źródło lub potwierdzonym dowodzie. Zero pochodzi wyłącznie z wartości źródłowej.

~~~csv
provider_code,provider_series_id,category_code,display_name,market_code,product_code,metric_code,geography_code,frequency,unit,currency,period_start,period_end,observed_at,value,provenance,normalization_version
~~~

UTF-8 bez BOM, separator przecinek, LF oraz cudzysłowy CSV z podwojeniem znaków wewnętrznych. Daty ISO `YYYY-MM-DD`. Liczba z kropką, bez separatora tysięcy i wykładnika, w granicach `numeric(24,8)`. Uzgodnione reguły zapisują liczbę bez końcowych zer ułamkowych i z kanonicznym `0`. Brak jawnego rozstrzygnięcia o rzeczywistym `NULL` w CSV oznacza skierowanie braku do decyzji, z zachowaniem materiału. `provenance` to kompaktowa tablica JSON z sortowaniem referencji i kluczy po kanonicznych identyfikatorach. Wersja normalizacji wskazuje użyty zestaw mapowań i zasad kwalifikacji. Wiersze sortować po czteropolowym kluczu logicznym. Porównać SHA-256 przy dwóch odtworzeniach tego samego snapshotu.

## 5. Pomiar kadencji i świeżości

Jednostka pomiaru rytmu publikacji to rodzina × rynek × typ raportu × kanał. Edycję główną, publikację zbiorczą, korektę, uzupełnienie i duplikat oznaczać odrębnie. Grupować rzeczywiste wydania po tożsamości i wersji treści. Skonsolidować kopie między kanałami dla porównania z zasięgiem kanałów, zachowując statystyki czasu per kanał. Publikacja i pierwszy widoczny odczyt pozostają osobnymi zdarzeniami. Dynamiczne eksporty grupować po pochodzeniu danych, bez utożsamiania tworzenia odpowiedzi na żądanie z publikacją.

1. Zliczyć pokrycie dat publikacji i okresów, dokładne daty i daty szacowane jako przedziały, przypadki ujemnych lagów, luki i wyłączenia. Zachować wielkość próby, okno i mianownik. Rytm raportowania w audycie to 39 formularzy tygodniowych i 15 miesięcznych. To punkt odniesienia przy opisie, a faktyczny rytm wynika z dat wydań.
2. W każdej grupie policzyć odstępy pomiędzy datami różnych publikacji oraz `published_at − end_of_period` dla punktów z dowodem obu dat. Stratę dokładności raportować osobno. Pokazać medianę, P90 z metodą najbliższej rangi, maksimum i rozkład dni tygodnia oraz godzin, gdy znane. Dla zdarzeń z tą samą datą lub czasem rozróżnić osobne wydania, wydanie zbiorcze i kopie, a nie sztucznie rozciągać odstęp.
3. Przedstawiać okresy o innej deklarowanej częstotliwości, sezonowe przerwy i spóźnione publikacje osobno. Raportować też odstęp od publikacji pierwotnej do korekty, rozkład publikacji poza zwykłym terminem i czas po końcu okresu. Oznaczyć małe próby i grupy bez wystarczającej rozdzielczości, aby uniknąć ekstrapolacji.
4. W dopuszczonej późniejszej próbie rozdzielić `first_detected_at − published_at`, `available_in_neon_at − first_detected_at` i `available_in_finder_at − available_in_neon_at`. Zapisać ostatni brak widoczności i pierwszy skuteczny odczyt, gdy pomiar ma granice przedziału. Okresowy brak nowych wydań, błąd źródła i błąd cyklu to trzy odrębne stany. Sposób wykrywania ocenić na identyfikatorach wydania, zawartości i korektach dostępnych w dopuszczonych powierzchniach.
5. Po analizie przedstawić harmonogram lub harmonogramy, strefę, lookback oraz mierzalne kryteria z podaniem źródeł, zakresów i uzasadnienia. SLA ma status `DO_USTALENIA_NA_PODSTAWIE_DANYCH`. Odbiór E3 pozostaje zależny od rzeczywistej nowej publikacji widocznej w Finderze po automatycznym cyklu.

## 6. Przypadki testowe

„Audyt” oznacza odczyt istniejącego dowodu. „Syntetyczny” oznacza weryfikację projektowej reguły bez wywołań źródła i bazy. Odbiór wykonawczy znajdujący się w Karcie pozostaje przyszłym etapem.

| ID | Przypadek i oczekiwany wynik | Typ |
|---|---|---|
| T01 | Tytoń sezonowy i drób 2024 z sześcioma stronami. Manifest zachowuje strony i wydania, nie generuje brakujących roczników z szablonu. | Audyt |
| T02 | Drób 23–29.12.2024 z datą na liście 09.01.2025. Data okresu, data na liście i nieobecna pierwsza publikacja WWW to osobne pola. | Audyt |
| T03 | Okres 30.12.2019–05.01.2020. Zachować obie daty w różnych latach i projekcję końca na 05.01.2020. Luty roku przestępnego ma dzień 29. | Audyt i syntetyczny |
| T04 | 01–15.11 i 09–15.11 w jednej serii. Ten sam observed_at, dwa klucze logiczne. Wiersze zachować, a model fizyczny kwalifikuje E2-T01. | Syntetyczny |
| T05 | Identyfikator serii taki sam u dwóch dostawców. Rozdzielić zasób, pamięć podręczną i zapisane serie po parze dostawca–ID. | Syntetyczny |
| T06 | Taki sam plik drobiu w Gov.pl i ZSRIR. Oryginał według hasha jest wspólny, a wystąpienia mają dwie referencje. Podobnie owoce/warzywa w dwóch katalogach ZSRIR. | Audyt |
| T07 | Dwukrotna serializacja tego samego snapshotu daje identyczne bajty. Stara wartość i późniejsza korekta mają odrębny ślad. Konflikt bez dowodu zastąpienia jest przedmiotem kwalifikacji. | Syntetyczny |
| T08 | `22:59:59Z` mieści się w granicy. `22:59:59.0000001Z` jest po niej. `23:59:59+01:00` reprezentuje tę samą chwilę co granica UTC. | Syntetyczny |
| T09 | Data dzienna w dniu odcięcia, brak publikacji, dynamiczny eksport lub godzina bez udokumentowanej strefy przecinająca granicę. Stan `NEEDS_DATE_REVIEW`. | Syntetyczny |
| T10 | Dwa różne punkty z pustą wartością i źródłowym zerem. Brak zachować wraz ze statusem, zero normalizuje się do `0`; żadna luka nie usuwa całej serii. | Syntetyczny |
| T11 | Towar rzepak krajowy/importowany w formie 53. Rozdzielić warianty. Cztery punkty z próby 2026 oraz pusta próba 2003 nie rozstrzygają początku pełnej historii. | Audyt |
| T12 | Odstępy 7, 7, 14, 21 dni, kopia oraz osobna korekta. Mediana głównych odstępów 10,5, P90 metodą najbliższej rangi 21. Kopię i korektę rozliczać poza główną próbą. | Syntetyczny |

**Wykonanie offline, 22.11.2026.** T01–T12 uzyskały PASS w odczycie istniejącej inwentaryzacji lub w reprezentatywnych próbach syntetycznych. Przykład T07 sprawdził stabilną serializację po przestawieniu wierszy i referencji oraz odróżnienie zmienionej wartości. Reguła pierwszeństwa korekt w rzeczywistych wydaniach pozostaje do kwalifikacji. Wynik nie stanowi testu implementacji, rzeczywistego pokrycia historii ani decyzji o SLA.

## 7. Decyzje otwarte i warunki E1-T02

| ID | Właściciel decyzji | Rozstrzygnięcie i moment |
|---|---|---|
| D1 | Governance Source Layer / Architecture Platform oraz właściciel Source i warunków użycia | Rozstrzygnięcie obu recenzji GOV-01 #1285 i kontrolowana aktywacja. Odrębnie udokumentować prawa do konkretnych eksportów, plików, retencji i użycia w Finderze, a następnie zakres Source na właściwe środowisko, operację, host, ścieżkę, metodę, rolę oraz reguły transportu, limitów i potwierdzeń. Brama przed zależnym pozyskaniem. |
| D2 | SG2 / SG Runtime, właściciel Karty | Przyjąć wersję logicznych kluczy, mapowanie rynku i znaczenie facetów. Zatwierdzić instrukcję przyjęcia braków oraz sposób rozstrzygania niejednoznacznej kategorii, korekt i kolizji. Znane przypadki otrzymają decyzję kwalifikacyjną z raportem w E1-T03. Przyjęty kontrakt importowy jest wymagany przed E2-T02. |
| D3 | SG2 / SG Runtime oraz właściwy właściciel Source | Potwierdzić znaczenie pól publikacji i strefy dla obu kanałów, w szczególności znaczniki ZSRIR bez offsetu i politykę przypadków granicznych. Niepewne pozycje nadal podlegają pełnemu zapisowi i oznaczeniu w zbiorze przejściowym. |
| D4 | Właściciel Karty / SG2 | Na bazie raportu E1 zatwierdzić harmonogramy, lookback, mierzalną świeżość, kwalifikację danych oraz osobno rozstrzygnąć formaty wymagające nowych mechanizmów. E2-T03 wymaga zatwierdzonych ustawień aktualizacji. |

`GOV-01 = PROPOSED / NOT_ACTIVE`. W przeglądniętej Karcie, przepisach kodu Source i rejestrach repozytorium brak dowodu operacyjnego dopuszczenia ZSRIR dla E1-T02. `SOURCE_E1_T02 = BRAK_POTWIERDZONEGO_DOPUSZCZENIA`. Odczyt tego stanu dotyczy dostępnych dowodów, a mandat E1-T01 obejmuje wyłącznie opracowanie kontraktu. Po uzgodnieniu części źródłowej E1-T01, rozstrzygnięciu D1 z aktywacją i osobnym dopuszczeniem Source, start E1-T02 wymaga wyraźnej dyspozycji właściciela i świeżego preflightu SG2 dla nazwanych ścieżek i operacji. Uzgodnienia opóźnione do E1-T03/E2 wstrzymują właściwą kwalifikację, import lub cykl zgodnie z Kartą.

**Werdykt E1-T01 `CZĘŚCIOWY`.** Dostarczono wersjonowany kontrakt, mapowania źródeł oraz przypadki offline i plan pomiaru. Pozostają weryfikacja warunków użycia i decyzje wymagane przez DoD, w tym przyjęcie ustawień klucza i facetów. E1-T02 i E1-T03 nieuruchomione. STOP na E1-T01.
