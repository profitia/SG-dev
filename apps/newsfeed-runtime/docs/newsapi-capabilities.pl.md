# NewsAPI katalog kryteriów wyszukiwania dla Newsfeed

Stan na 3 listopada 2026. NewsAPI udostępnia trzy różne tryby: wyszukiwanie publikacji, nagłówki oraz katalog wydawców. Formularz obserwacji powinien wybierać tryb przed filtrami. Kraj wydawcy, kraj edycji nagłówków i lokalizacja wydarzenia wymagają osobnych pól.

**Weryfikacja live: COMPLETED. Wykonano 24 rzeczywiste zapytania w Development do wszystkich trzech interfejsów, bez ponowień.** Szesnaście odpowiedzi zawierało wyniki, pięć było pustych, a trzy potwierdziły oczekiwane odmowy parametrów lub ograniczenia planu. Nie wystąpił nieoczekiwany błąd konektora ani zaobserwowane naruszenie sprawdzanych ograniczeń odpowiedzi. Klucz i treści artykułów nie zostały zapisane. [Pełny dowód testów](newsapi-live-evidence.json).

## Tryby i potwierdzenia

| Tryb Newsfeed | Interfejs NewsAPI | Zastosowanie |
|---|---|---|
| Publikacje | `GET /v2/everything` | Frazy, firmy, historia, domeny i sortowanie. |
| Nagłówki | `GET /v2/top-headlines` | Aktualna edycja lub wybrani wydawcy; węższy zestaw filtrów. |
| Wydawcy | `GET /v2/top-headlines/sources` | Metadane i identyfikatory wydawców obsługujących nagłówki. |

Oznaczenia: **D** — aktualna dokumentacja; **T** — lokalny test kontraktu lub kontrolowanego transportu; **L*** — rzeczywisty, reprezentatywny test danej grupy parametrów. L* nie oznacza sprawdzenia każdej wartości, kombinacji ani granicy liczbowej. Przyjęcie zapytania i kontrola dostępnych metadanych są oddzielone od oceny trafności artykułów. Sukces z pustą listą nie dowodzi działania filtra; HTTP 200 dla nieudokumentowanego parametru również nie potwierdza jego obsługi.

[Opis API](https://newsapi.org/docs), [przewodnik trybów](https://newsapi.org/docs/get-started).

## Wyniki rzeczywistych zapytań

Testy wykonano 3 listopada 2026, 09:09–09:11 UTC. Okno publikacji: `2026-10-26T09:09:43.351Z` do `2026-11-02T09:09:43.351Z`. Wybrane ID wydawców: `associated-press`, `bbc-news`. Liczby po ukośniku są liczbami zgłoszonymi przez API, nie gwarancją pobrania całego zbioru.

| Sprawdzenie | HTTP | Zwrócono / zgłoszono | Wniosek |
|---|---|---|---|
| Katalog wydawców | 200 | 125 | Wyniki w neutralnym modelu |
| Wydawcy Business + en + GB | 200 | 0 | Pusta odpowiedź; nie dowód działania filtra |
| Wydawcy z kraju PL | 200 | 0 | Pusta odpowiedź; nie dowód działania filtra |
| Nieudokumentowane Sources language=pl | 200 | 0 | Puste |
| Nagłówki Business + US | 200 | 5 / 69 | Wyniki w neutralnym modelu |
| Nagłówki PL + Business + budownictwo | 200 | 0 / 0 | Puste |
| Nagłówki z dwóch wydawców | 200 | 5 / 20 | Wyniki w neutralnym modelu |
| Sprzeczne sources + country + category | 400 | — | Oczekiwana odmowa; niedozwolona kombinacja |
| Firma Budimex | 200 | 5 / 22 | Wyniki w neutralnym modelu |
| Dokładna fraza Budimex SA | 200 | 1 / 1 | Wyniki w neutralnym modelu |
| AND OR NOT + tytuł/opis + en + trafność | 200 | 5 / 18 | Wyniki w neutralnym modelu |
| Wymagane i wykluczone słowo + treść + popularność | 200 | 2 / 3301 | Wyniki w neutralnym modelu |
| Wybrane domeny | 200 | 5 / 8 | Wyniki w neutralnym modelu |
| Wykluczona domena | 200 | 2 / 3696 | Wyniki w neutralnym modelu |
| Dwóch wydawców w Everything | 200 | 5 / 8 | Wyniki w neutralnym modelu |
| Publikacje od najnowszych strona 1 | 200 | 5 / 3704 | Wyniki w neutralnym modelu |
| Publikacje od najnowszych strona 2 | 200 | 5 / 3704 | Wyniki w neutralnym modelu |
| Polskie słowo inwestycje bez language | 200 | 5 / 144 | Wyniki w neutralnym modelu |
| Inwestycje AND Mazowieckie lub Mazowsze | 200 | 0 / 0 | Pusta odpowiedź; nie dowód działania filtra |
| Nieudokumentowane Everything language=pl | 200 | 5 / 537 | Przyjęte; skuteczność parametru niepotwierdzona |
| Historia 40 dni | 426 | — | Oczekiwana odmowa; parameterInvalid |
| Nieprawidłowy sortBy | 200 | 1 / 16356 | Przyjęte; skuteczność parametru niepotwierdzona |
| Strona 101 po 100 pozycji | 426 | — | Oczekiwana odmowa; maximumResultsReached |
| Wydawcy Business + en + US | 200 | 4 | Wszystkie 4 zgodne z kategorią, językiem i krajem |

W niepustych odpowiedziach sprawdzono zakres dat, a tam, gdzie dotyczyło — kolejność, domeny lub ID wydawców. Nie zaobserwowano naruszenia tych ograniczeń. Dla języka artykułu i dokładności operatorów brak pełnej treści lub metadanych uniemożliwia dowód semantyczny każdego trafienia; zweryfikowano przyjęcie właściwego zapytania i poprawne przetworzenie odpowiedzi. Nie oceniano merytorycznej jakości ani kompletności polskich mediów.

Strony 1 i 2 zawierały po 5 wyników, z **1 wspólnym URL**. Paginacja nie zapewnia stabilnej migawki ani braku powtórzeń. Niektóre odpowiedzi zwróciły 2 pozycje przy `pageSize=5` mimo większego `totalResults`. Konektor zachowuje te rzeczywiste dane; nie uzupełnia strony ani nie obiecuje kompletnego pobrania.

Nieprawidłowy `sortBy` został przyjęty z wynikami, podobnie jak nieudokumentowane `language=pl` w Everything. Pokazuje to, dlaczego sam HTTP 200 nie wystarcza do ogłoszenia obsługi parametru. Walidator adaptera odrzuca obie niezatwierdzone wartości przed transportem.

## Wyszukiwanie publikacji

Wszystkie wiersze dotyczą `Everything`. Dostępność „natywne” opisuje parametr dostawcy, nie ocenę trafności publikacji. Wspólny kontrakt używa nazw w kolumnie zastosowania. [Specyfikacja Everything](https://newsapi.org/docs/endpoints/everything).

| Nazwa biznesowa | Parametr API | Endpoint | Typ kryterium | Dostępne wartości | Łączenie z filtrami | Dostępność | Potwierdzenie | Przydatność dla Newsfeed |
|---|---|---|---|---|---|---|---|---|
| Temat lub firma | `q` | Everything | tekst | do 500 znaków | daty, źródła, język, sortowanie | natywne | D/T/L* | `text` albo `terms` |
| Obszar tekstu | `searchIn` | Everything | lista | `title`, `description`, `content` | z `q`; kilka pól | natywne | D/T/L* | `fields`: nagłówek, opis, treść |
| Wydawcy | `sources` | Everything | lista ID | katalog; maks. 20 | pozostałe filtry | natywne | D/T/L* | `publisherIds` |
| Dozwolone domeny | `domains` | Everything | lista domen | domeny bez protokołu | pozostałe filtry | natywne | D/T/L* | `domains` |
| Wykluczone domeny | `excludeDomains` | Everything | lista domen | domeny bez protokołu | pozostałe filtry | natywne | D/T/L* | `excludedDomains` |
| Początek okresu | `from` | Everything | data ISO 8601 | granice planu | z końcem okresu | natywne | D/T/L* | `publishedAfter` |
| Koniec okresu | `to` | Everything | data ISO 8601 | granice planu | początek ≤ koniec | natywne | D/T/L* | `publishedBefore` |
| Język | `language` | Everything | wybór | LANG14 poniżej | pozostałe filtry | natywne | D/T/L* | `language` |
| Kolejność | `sortBy` | Everything | wybór | `publishedAt`, `relevancy`, `popularity` | pozostałe filtry | natywne | D/T/L* | `newest`, `relevance`, `publisherPopularity` |
| Rozmiar strony | `pageSize` | Everything | liczba | 1–100; domyślnie 100 | paginacja | natywne | D/T/L* | `pageSize` |
| Numer strony | `page` | Everything | liczba | od 1 | limit planu | natywne | D/T/L* | `page` |

Zapytania tekstowe obsługują frazę w cudzysłowie, wymagane `+`, wykluczane `-`, `AND`, `OR`, `NOT` i nawiasy. Konektor koduje całość jako jeden parametr. `terms.all` i `terms.phrases` łączy przez AND, `terms.any` przez OR, a `terms.excluded` przez NOT. Dłuższe zapytanie jest odrzucane przed wywołaniem. [Semantyka fraz i operatorów](https://newsapi.org/docs/endpoints/everything).

Adapter wymaga przynajmniej tekstu, wydawców albo domen. Podstawowe kombinacje pokazuje także [oficjalny przykład klienta NodeJS](https://newsapi.org/docs/client-libraries/node-js). Daty wejściowe przyjmuje jako `YYYY-MM-DD` lub czas UTC zakończony `Z`; nie zgaduje strefy czasowej. Odrzuca błędne daty i wspólną domenę na liście dozwolonej oraz wykluczanej. Listy ID są ograniczone do 20. Są to jawne walidacje adaptera. [Przykłady łączenia podstawowych filtrów](https://newsapi.org/docs/client-libraries/node-js).

## Nagłówki i wydawcy

[Specyfikacja Top headlines](https://newsapi.org/docs/endpoints/top-headlines), [specyfikacja Sources](https://newsapi.org/docs/endpoints/sources).

| Nazwa biznesowa | Parametr API | Endpoint | Typ kryterium | Dostępne wartości | Łączenie z filtrami | Dostępność | Potwierdzenie | Przydatność dla Newsfeed |
|---|---|---|---|---|---|---|---|---|
| Temat nagłówka | `q` | Top headlines | tekst | słowo/fraza | edycja, kategoria albo źródła | natywne | D/T | `text`; bez obietnicy gramatyki Everything |
| Kategoria nagłówków | `category` | Top headlines | wybór | CAT7 poniżej | kraj i tekst; bez `sources` | natywne | D/T/L* | `category` |
| Kraj edycji | `country` | Top headlines | wybór | aktualna referencja: `us` | kategoria i tekst; bez `sources` | natywne w podanym zakresie | D/T/L* | `editionCountry` |
| Wydawcy nagłówków | `sources` | Top headlines | lista ID | katalog źródeł | tekst; bez kraju i kategorii | natywne | D/T/L* | `publisherIds` |
| Rozmiar strony | `pageSize` | Top headlines | liczba | 1–100; domyślnie 20 | paginacja | natywne | D/T/L* | `pageSize` |
| Strona | `page` | Top headlines | liczba | od 1 | limit planu | natywne | D/T | `page` |
| Kategoria wydawcy | `category` | Sources | wybór | CAT7 | język i kraj wydawcy | natywne | D/T/L* | lista wydawców, nie klasyfikacja artykułów |
| Język wydawcy | `language` | Sources | wybór | LANG14 | kategoria i kraj | natywne | D/T/L* | `PublisherQuery.language` |
| Kraj wydawcy | `country` | Sources | wybór | COUNTRY54, w tym `pl` | język i kategoria | natywne | D/T/L* | `publisherCountry` |

CAT7: **business, entertainment, general, health, science, sports, technology**. Business to szeroka kategoria, nie filtr „kontrakt”, „inwestycja” lub „upadłość”. Parametr w Sources klasyfikuje wydawcę; w Top headlines wybiera kanał nagłówków. Artykuł nie otrzymuje przez to potwierdzonej własnej kategorii.

Top headlines nie dokumentuje zakresu dat, sortowania, `searchIn`, domen ani języka. Nie przenosimy również gramatyki Boolean, prefiksów +/− i dokładnego dopasowania w cudzysłowie z Everything: adapter odrzuca taką składnię w nagłówkach. Konektor odrzuca te kryteria. Dla `sources` stosuje bezpieczny limit adaptera 20 ID; aktualna referencja nagłówków nie podaje odrębnego maksimum ID. Sources nie dokumentuje paginacji ani wyszukiwania frazą.

**Rozbieżność dokumentacji krajów:** przewodnik ogólny reklamuje nagłówki z ponad 50 krajów, ale aktualna szczegółowa referencja Top headlines wymienia tylko `us`. Konektor przyjmuje w tym trybie wyłącznie `us`. Polska i inne kraje Europy są dostępne jako wartości filtra **wydawców** w Sources; nie przenosimy tej listy do nagłówków. Rzeczywista próba `country=pl`, Business i tekst budownictwo dała HTTP 200 z pustą listą; nie potwierdza to skutecznego filtrowania polskiej edycji. Adapter nadal odrzuca tę wartość. [Przewodnik ogólny](https://newsapi.org/docs/get-started), [bieżąca referencja nagłówków](https://newsapi.org/docs/endpoints/top-headlines).

## Język polski i europejscy wydawcy

LANG14 to udokumentowane tokeny: `ar`, `de`, `en`, `es`, `fr`, `he`, `it`, `nl`, `no`, `pt`, `ru`, `sv`, `ud`, `zh`. **Brak `pl`.** Token `ud` pochodzi z dokumentacji dostawcy; nie opisujemy go jako prawidłowego kodu ISO Urdu ani nie zamieniamy niejawnie na `ur`. Brak wyboru języka oznacza brak tego filtra, a nie automatyczne ograniczenie do języka polskiego. [Języki w Sources](https://newsapi.org/docs/endpoints/sources).

Polskie słowo `inwestycje` bez filtra języka zwróciło 5 pozycji przy zgłoszonych 144 w badanym tygodniu. Sources z `country=pl` zwróciło pustą listę; cały katalog 125 wydawców nie zawierał kraju `pl`. Nie rozstrzyga to pokrycia Everything: katalog obejmuje wydawców nagłówków, a nie wszystkie przeszukiwane domeny. Nie oceniano języka ani jakości każdej publikacji. Surowe `language=pl` w Everything także zwróciło wyniki, ale bez kontroli porównawczej nie ustalono, czy parametr filtruje, czy jest ignorowany. Pozostaje nieudokumentowany i odrzucany przez adapter; nie przedstawiamy go jako zweryfikowanego filtra polszczyzny. [Zakres katalogu](https://newsapi.org/docs/endpoints/sources).

COUNTRY54, do pobrania również przez `getCapabilities().publishers.publisherCountry`:

`ae ar at au be bg br ca ch cn co cu cz de eg fr gb gr hk hu id ie il in it jp kr lt lv ma mx my ng nl no nz ph pl pt ro rs ru sa se sg si sk th tr tw ua us ve za`.

Identyfikatory i nazwy wydawców pobiera `listPublishers()`; rzeczywisty odczyt zwrócił 125 wpisów. Katalog zawierał również metadane krajów `es`, `is`, `pk` i `zh`, których nie ma na powyższej liście parametrów; `zh` nie jest poprawnym kodem kraju ISO 3166-1. Nie promujemy tych metadanych do obsługiwanych filtrów ani nie korygujemy ich bez dowodu. Wybór domen w Everything nie wymaga obecności domeny w katalogu. [Źródła](https://newsapi.org/docs/endpoints/sources), [domeny Everything](https://newsapi.org/docs/endpoints/everything).

## Geografia i metadane

| Kryterium biznesowe | Natywny filtr | Metadana artykułu | Powiązanie z wydawcą | Wzbogacenie lub brak | Zastosowanie |
|---|---|---|---|---|---|
| Kraj edycji nagłówków | Top headlines, zakres powyżej | nie | nie jest lokalizacją wydarzenia | brak dokładności wydarzenia | osobny wybór edycji |
| Kraj wydawcy | Sources | nie | po ID źródła i zgodnym wpisie katalogu | brak ID lub wpisu oznacza nieznany | selekcja wydawców |
| Kraj opisywanego zdarzenia | brak udokumentowanego | brak | kraj wydawcy nie dowodzi kraju zdarzenia | późniejsze rozpoznanie z dowodem i niepewnością | obecnie kryterium nieobsługiwane |
| Region, województwo | brak | brak | brak | nazwa w tekście albo osobne wzbogacenie | jawne wyszukiwanie tekstowe |
| Miasto | brak | brak | brak | nazwa w tekście może być niejednoznaczna | bez gwarancji geograficznej |
| Miejsce inwestycji | brak | brak | brak | ekstrakcja i weryfikacja w późniejszym etapie | bez filtra przestrzennego |
| Współrzędne, promień, obszar | brak | brak | brak | odrębne geokodowanie po zweryfikowaniu miejsca | obecnie niedostępne |

To zestawienie porównuje udokumentowane parametry i pola trzech podstawowych endpointów; nie opisuje indywidualnej oferty Enterprise. [Everything](https://newsapi.org/docs/endpoints/everything), [Top headlines](https://newsapi.org/docs/endpoints/top-headlines), [Sources](https://newsapi.org/docs/endpoints/sources).

Artykuł: `source.id`, `source.name`, `author`, `title`, `description`, `url`, `urlToImage`, `publishedAt`, `content`. Identyfikator źródła i część treści mogą być puste. `content` jest skrótem do 200 znaków, nie pełnym artykułem; data publikacji różni się od dodanego przez konektor czasu wykrycia. Nie ma natywnych pól języka artykułu, jego kategorii ani lokalizacji zdarzenia. [Pola odpowiedzi artykułu](https://newsapi.org/docs/endpoints/top-headlines).

Wydawca: `id`, `name`, `description`, `url`, `category`, `language`, `country`. Wspólny model zwraca je osobno i nazywa kraj `publisherCountry`. Nie wzbogaca automatycznie artykułu danymi wydawcy. [Pola wydawcy](https://newsapi.org/docs/endpoints/sources).

## Rodzaje informacji biznesowych

Poniższe grupy są **propozycją słownika Newsfeed**, nie natywnymi kategoriami NewsAPI ani gotowym klasyfikatorem. Implementacja `businessTerms()` jawnie zamienia wybór na alternatywy tekstowe. Odmiana słów i wyszukiwanie synonimów wymagają osobnej oceny trafności; konektor nie obiecuje lematyzacji.

| Rodzaj informacji | Przykładowe słowa dla wyszukiwania | Dostępność |
|---|---|---|
| Kontrakty i zamówienia | kontrakt, zamówienie, contract, order | tekst; późniejsza klasyfikacja |
| Inwestycje | inwestycja, investment | tekst; późniejsza klasyfikacja |
| Fuzje i przejęcia | fuzja, przejęcie, merger, acquisition | tekst; późniejsza klasyfikacja |
| Wyniki finansowe | wyniki finansowe, earnings | tekst; późniejsza klasyfikacja |
| Restrukturyzacje i upadłości | restrukturyzacja, upadłość, bankruptcy | tekst; późniejsza klasyfikacja |
| Własność | akcjonariusz, zmiana właściciela | tekst; późniejsza klasyfikacja |
| Zarządy | zarząd, prezes, CEO | tekst; późniejsza klasyfikacja |
| Ryzyka dostawcy | ryzyko dostawcy, supplier risk | tekst; nie ocena ryzyka |
| Technologie i produkty | nowa technologia, nowy produkt | tekst; późniejsza klasyfikacja |

Pełna kwalifikacja takich zdarzeń, ekstrakcja podmiotów i lokalizacji lub OpenAI pozostają poza tym etapem. Oferta Enterprise wspomina dodatkowe wzbogacenia; nie są funkcjami standardowych endpointów ani uprawnieniem obecnego klucza. [Zakres oferty](https://newsapi.org/pricing).

## Plan, limity i błędy

Udokumentowany Developer: 100 żądań dziennie, opóźnienie publikacji 24 godziny, historia do miesiąca, wyłącznie development i testy. Business i Advanced podają historię do pięciu lat oraz odpowiednio 250 tys. i 2 mln żądań miesięcznie; mają dostęp do bieżących publikacji. **Plan dostarczonego klucza pozostaje niezweryfikowany.** Nie zmieniono abonamentu ani rozliczania nadwyżek. [Cennik i warunki użycia](https://newsapi.org/pricing).

Maksymalna strona to 100 pozycji. Łączna liczba możliwych do pobrania artykułów zależy od planu; `totalResults` nie jest gwarancją dostępności wszystkich stron. Rzeczywiste żądanie historii 40 dni zakończyło się HTTP 426 / `parameterInvalid`, a strona 101 przy rozmiarze 100 — HTTP 426 / `maximumResultsReached`. Nie wyznacza to dokładnej granicy uprawnień konta. Limit 100 żądań dziennie z cennika nie oznacza limitu 100 artykułów. Brak wyników, odrzucenie parametrów, historia i limit pobrania pozostają rozróżnione. Próba wykorzystała cały budżet 24 wywołań; nie wykonywano dalszych zapytań ani zmian abonamentu.

Konektor rozróżnia uwierzytelnienie, wyczerpanie limitu, ograniczenie częstotliwości, ograniczenie planu, odrzucenie kryteriów, błąd dostawcy, sieć, timeout i nieprawidłową odpowiedź. Surowe komunikaty dostawcy nie trafiają do błędów ani telemetrii. [Kody błędów](https://newsapi.org/docs/errors). Klucz jest przesyłany tylko nagłówkiem, zgodnie z [zaleceniem uwierzytelniania](https://newsapi.org/docs/authentication).

## Przykłady i biznesowy model filtrów

1. **Budimex, inwestycje i kontrakty:** tryb publikacji; fraza firmy AND alternatywy nazw zdarzeń; przedział dat i kolejność od najnowszych. Przy planie z opóźnieniem tydzień dostępnych publikacji nie jest tygodniem bieżących wiadomości. Plik `examples/company.json` pozwala dodać jawne daty UTC.
2. **Business, Polska, infrastruktura:** tryb nagłówków odrzuca `editionCountry=pl` w obecnej konfiguracji. Alternatywą do osobnego sprawdzenia są wyszukiwanie tekstowe w Everything lub jawny wybór wydawców; nie odtwarza to dokładnego filtra „wszystkie polskie artykuły”. `examples/industry.json` pokazuje oczekiwaną odmowę.
3. **Construction, wybrani wydawcy:** tryb publikacji, lista ID albo domen, daty dostępnego tygodnia i wybrana kolejność. `examples/publishers.json` prezentuje domeny; listę ID pobiera katalog.
4. **Nowe inwestycje w Mazowieckiem:** `examples/region.json` wymaga nazw regionu w tekście. To trafienia tekstowe; `eventLocation.region` jest odrzucane jako nieobsługiwane.

Model przyszłego formularza obserwacji:

| Pole biznesowe | Model kontraktu | Zachowanie |
|---|---|---|
| Tryb informacji | `mode` | publikacje albo nagłówki; zmienia dostępne filtry |
| Firma, produkt lub temat | `text`, `terms` | fraza, wszystkie słowa, dowolne słowa i wykluczenia |
| Rodzaj zdarzeń biznesowych | jawny słownik `businessTerms()` | widoczne rozszerzenie tekstu; bez etykiety filtra natywnego |
| Kategoria | `category` | tylko nagłówki lub wybór wydawców |
| Edycja krajowa | `editionCountry` | oddzielona od kraju wydarzenia; zakres zależny od providera |
| Wydawcy | `publisherIds`, `domains`, `excludedDomains` | katalog ID lub domeny; konflikty jawnie odrzucane |
| Język publikacji | `language` | wyłącznie obsługiwane wartości; „dowolny” usuwa filtr |
| Okres | `publishedAfter`, `publishedBefore` | daty jawne; dostępna historia zależy od planu |
| Kolejność | `order` | nowe, trafne lub popularni wydawcy; ostatnia opcja nie mierzy popularności artykułu |
| Lokalizacja wydarzenia | `eventLocation` | obecnie niedostępna; tekst miejsca jako osobne kryterium |

Możliwości są ustalane dla wybranego providera i trybu. Kryterium niedostępne musi być nazwane przed wysłaniem zapytania; brak filtra nie uruchamia automatycznego pobrania większego zbioru, wzbogacenia ani zmiany dostawcy. Nie powstał docelowy interfejs użytkownika.
