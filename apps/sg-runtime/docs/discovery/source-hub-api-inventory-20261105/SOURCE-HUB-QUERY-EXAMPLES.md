# Biblioteka przykładów zapytań Source Hub

Stan 2026-11-05; kod `8dfe12b9311f24227c904c13900e373aea518490`. **Wszystkie przykłady są opisami/dry-run bez wywołania providera.** N01/B01/T01 wskazują wyłącznie istniejący dowód LIVE, nie nowe uruchomienie. Daty/katalogowe identyfikatory są przykładami, nie bieżącym wynikiem. Brak sekretów, komend z kluczami i obejścia E1/Source. Poświadczenia i zaufany kontekst zapewnia backend.

Hub: POST /v1/acquire, contractVersion1.0.0. Przykłady pokazują ciało z kryteriami; nie są instrukcją samodzielnego publicznego wywołania bez prawidłowego M2M i użytkownika. Klient Newsfeed przekazuje wspólny kontrakt, a nie własny adapter dostawcy. API Search/Symbology i katalogi muszą odświeżyć wartości przed operacyjnym użyciem.


## N01 — NewsAPI — poprzednio potwierdzony prosty przepływ

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "newsapi",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "mode": "articles",
    "text": "oil",
    "page": 1,
    "pageSize": 3
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://newsapi.org/v2/everything?q=oil&page=1&pageSize=3`

**Oczekiwana semantyka:** Istniejący dowód LIVE:3 rekordy,1 próba. To zadanie nie ponawia zapytania.

**Rekomendacja UI:** Jedno pole i3 wyniki

## N02 — Brent lub WTI, wykluczone zastosowanie kuchenne

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "newsapi",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "mode": "articles",
    "terms": {
      "any": [
        "Brent",
        "WTI"
      ],
      "excluded": [
        "cooking"
      ]
    },
    "fields": [
      "headline",
      "summary"
    ],
    "language": "en",
    "order": "newest",
    "pageSize": 20
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://newsapi.org/v2/everything?q=%28%22Brent%22+OR+%22WTI%22%29+AND+NOT+%22cooking%22&searchIn=title%2Cdescription&language=en&sortBy=publishedAt&page=1&pageSize=20`

**Oczekiwana semantyka:** Kompilator cytuje literały i grupuje OR. Provider grammar udokumentowana; ta kombinacja nie była LIVE.

**Rekomendacja UI:** Dowolne z fraz; wykluczenia; podgląd składni

## N03 — Asfalt i bitum w określonym okresie publikacji

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "newsapi",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "mode": "articles",
    "text": "asphalt OR bitumen",
    "publishedAfter": "2026-11-01",
    "publishedBefore": "2026-11-05",
    "order": "newest"
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://newsapi.org/v2/everything?q=asphalt+OR+bitumen&from=2026-11-01&to=2026-11-05&sortBy=publishedAt&page=1&pageSize=100`

**Oczekiwana semantyka:** Daty publikacji, nie terminy dostaw lub wydarzeń. Dostęp do historii zależy od planu.

**Rekomendacja UI:** Zakres publikacji

## N04 — Nagłówki biznesowe edycji US

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "newsapi",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "mode": "headlines",
    "editionCountry": "us",
    "category": "business",
    "text": "oil",
    "pageSize": 20
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://newsapi.org/v2/top-headlines?q=oil&category=business&country=us&page=1&pageSize=20`

**Oczekiwana semantyka:** country określa edycję nagłówków. Nie oznacza kraju wydawcy ani miejsca wydarzenia.

**Rekomendacja UI:** Wybór trybu przed filtrami

## N05 — Nagłówki wybranych wydawców

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "newsapi",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "mode": "headlines",
    "publisherIds": [
      "reuters",
      "bbc-news"
    ]
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://newsapi.org/v2/top-headlines?sources=reuters%2Cbbc-news&page=1&pageSize=20`

**Oczekiwana semantyka:** Nie dodawać country ani category. Identyfikatory przykładowe — odświeżyć katalog i entitlement.

**Rekomendacja UI:** Wybór wydawców wyłącza pola country/category

## N06 — Katalog wydawców z Polski

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "newsapi",
  "family": "news-discovery",
  "operation": "publishers",
  "criteria": {
    "publisherCountry": "pl",
    "category": "business"
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://newsapi.org/v2/top-headlines/sources?category=business&country=pl`

**Oczekiwana semantyka:** Katalog top-headlines, nie kompletna lista150k źródeł Everything. PL to kraj wydawcy, nie wspierany language=pl.

**Rekomendacja UI:** Wyszukiwany katalog

## B01 — Brave — poprzednio potwierdzony prosty przepływ

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "oil",
    "resultType": "web",
    "count": 3,
    "offset": 0,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=oil&result_filter=web&text_decorations=false&operators=true&spellcheck=false&count=3&offset=0`

**Oczekiwana semantyka:** Istniejący LIVE:3 rekordy. Pominięcie country/language pozostawia domyślne US/en, nie ALL.

**Rekomendacja UI:** Jawne kraj i język, gdy potrzebny zakres globalny

## B02 — Brent i popyt

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "Brent AND demand",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=Brent+AND+demand&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B03 — Asfalt lub bitum

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "asphalt OR bitumen",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=asphalt+OR+bitumen&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B04 — Ropa bez kuchni

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "oil NOT cooking",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=oil+NOT+cooking&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B05 — OPEC+ — dokładna fraza

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "\"OPEC+\" production",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=%22OPEC%2B%22+production&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B06 — Zakłócenia rafineryjne

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "refinery +outage",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=refinery+%2Boutage&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B07 — Podaż i popyt z wykluczeniem

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "supply AND demand -cooking",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=supply+AND+demand+-cooking&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B08 — Ceny energii w tytule

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "intitle:energy prices",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=intitle%3Aenergy+prices&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B09 — Sankcje i geopolityka w treści

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "inbody:sanctions oil",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=inbody%3Asanctions+oil&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B10 — Alternatywne nazwy produktów

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "asphalt OR bitumen OR paving",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=asphalt+OR+bitumen+OR+paving&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B11 — Raporty PDF

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "\"oil outlook\" filetype:pdf",
    "resultType": "web",
    "country": "ALL",
    "language": "en",
    "count": 10,
    "spellcheck": false
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=%22oil+outlook%22+filetype%3Apdf&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&spellcheck=false&count=10&offset=0`

**Oczekiwana semantyka:** Operator eksperymentalny. Walidacja składni w Hub nie potwierdza ścisłych dopasowań dostawcy; brak LIVE tych operatorów.

**Rekomendacja UI:** Kafelki warunków + jawny podgląd zapytania; bez obietnicy pełnej logiki grup

## B12 — Informacje IEA i EIA z ostatniego tygodnia

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "oil",
    "domains": [
      "iea.org",
      "eia.gov"
    ],
    "excludedDomains": [
      "example.com"
    ],
    "freshness": "pw",
    "country": "ALL",
    "language": "en"
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=oil+%28site%3Aiea.org+OR+site%3Aeia.gov%29+NOT+site%3Aexample.com&result_filter=web&text_decorations=false&operators=true&country=ALL&search_lang=en&freshness=pw&count=20&offset=0`

**Oczekiwana semantyka:** Hub generuje (site:iea.org OR site:eia.gov) NOT site:example.com. Nawiasy niepotwierdzone u dostawcy; hosty dodatkowo sprawdzane lokalnie. Wynik jest podzbiorem, a freshness może dotyczyć modyfikacji.

**Rekomendacja UI:** Listy domen i okres świeżości, etykieta lokalnej weryfikacji domen

## B13 — Klaster news w Web

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "oil refinery",
    "resultType": "news",
    "freshness": "pd"
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.search.brave.com/res/v1/web/search?q=oil+refinery&result_filter=news&text_decorations=false&operators=true&freshness=pd`

**Oczekiwana semantyka:** Nie jest odrębnym /res/v1/news/search. Brak klastra powoduje CAPABILITY_NOT_CONFIRMED; brak count/offset.

**Rekomendacja UI:** Opcja po potwierdzeniu planu; osobna etykieta news cluster

## T01 — TE News — poprzednio potwierdzony przepływ

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "oil",
    "limit": 3
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/news?f=json`

**Oczekiwana semantyka:** Upstream /news?f=json, następnie lokalny substring tytułu/opisu i limit3. Nie globalne wyszukanie wszystkich wiadomości o ropie.

**Rekomendacja UI:** Informacja o selekcji podzbioru

## T02 — Komentarze rynkowe TE

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "newsType": "markets",
    "limit": 20
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/news?f=json&type=markets`

**Oczekiwana semantyka:** Natywne type=markets; bez country/indicators/tickers w tym kontrakcie.

**Rekomendacja UI:** Typ wiadomości — osobny wariant formularza

## T03 — Kraj, wskaźnik i okres w TE News

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "countries": [
      "united states"
    ],
    "indicators": [
      "inflation rate"
    ],
    "from": "2026-11-01",
    "to": "2026-11-05",
    "limit": 20
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/news/country/united%20states/inflation%20rate?f=json&d1=2026-11-01&d2=2026-11-05`

**Oczekiwana semantyka:** Natywna ścieżka country/indicator oraz d1/d2. Limit lokalny; kompletność nieznana.

**Rekomendacja UI:** Zależny wybór kraju i kategorii oraz daty

## T04 — Calendar — kraj, okres i istotność

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "economic-calendar",
  "operation": "search",
  "criteria": {
    "countries": [
      "united states",
      "poland"
    ],
    "from": "2026-11-01",
    "to": "2026-11-10",
    "importance": 3,
    "limit": 100
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/calendar/country/united%20states,poland/2026-11-01/2026-11-10?f=json&importance=3`

**Oczekiwana semantyka:** Natywne kraje/daty/importance; brak dowodu LIVE. Nie interpretować importance jako progu >= bez potwierdzenia.

**Rekomendacja UI:** Kraje, daty, jeden poziom istotności

## T05 — Calendar — konkretne wydarzenia po ID

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "economic-calendar",
  "operation": "search",
  "criteria": {
    "eventIds": [
      "174108",
      "160025"
    ]
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/calendar/calendarid/174108,160025?f=json`

**Oczekiwana semantyka:** Identyfikatory wyłączne wobec innych selektorów. Przykłady z docs, nie bieżące zdarzenia.

**Rekomendacja UI:** Wybór istniejących wydarzeń

## T06 — Calendar — tekst wydarzenia lokalnie

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "economic-calendar",
  "operation": "search",
  "criteria": {
    "countries": [
      "united states"
    ],
    "eventText": "oil",
    "limit": 20
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/calendar/country/united%20states?f=json`

**Oczekiwana semantyka:** Substring Event dopiero w pobranym podzbiorze; brak gwarancji znalezienia wszystkich wydarzeń.

**Rekomendacja UI:** Zaawansowane: filtr wyniku z etykietą lokalny

## T07 — Indicators — inflacja w wybranych krajach

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "indicators",
  "operation": "search",
  "criteria": {
    "countries": [
      "poland",
      "united states"
    ],
    "indicators": [
      "inflation rate"
    ],
    "limit": 20
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/country/poland,united%20states?f=json`

**Oczekiwana semantyka:** Upstream snapshot krajów, Category porównywana lokalnie bez uwzględniania wielkości liter.

**Rekomendacja UI:** Kraje i wybór kategorii

## T08 — Indicators — GDP wszystkich dostępnych krajów

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "indicators",
  "operation": "search",
  "criteria": {
    "indicators": [
      "gdp"
    ],
    "limit": 100
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/country/all/gdp?f=json`

**Oczekiwana semantyka:** Natywny /country/all/gdp. Tylko jeden indicator w tym wariancie Hub.

**Rekomendacja UI:** Tryb przekrojowy: jeden wskaźnik

## T09 — Prognoza inflacji — kwartalne i roczne horyzonty

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "external-forecasts",
  "operation": "search",
  "criteria": {
    "countries": [
      "poland"
    ],
    "indicators": [
      "inflation rate"
    ],
    "horizons": [
      "q1",
      "q2",
      "YearEnd"
    ]
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/forecast/country/poland/indicator/inflation%20rate?f=json`

**Oczekiwana semantyka:** Dostawca zwraca cały zestaw horyzontów; Hub wybiera pola lokalnie. YearEnd nie otrzymuje wymyślonej targetDate.

**Rekomendacja UI:** Wybór widocznych horyzontów; osobna etykieta Prognoza TE

## T10 — Prognozy ropy — tylko demonstracja istniejącego kodu

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "external-forecasts",
  "operation": "search",
  "criteria": {
    "forecastType": "markets",
    "marketCategory": "commodity",
    "symbols": [
      "CO1:COM",
      "CL1:COM"
    ],
    "limit": 20
  }
}
```

**Wynikowa metoda/parametry providera (obliczone offline):** `GET https://api.tradingeconomics.com/markets/forecasts/commodity?f=json`

**Oczekiwana semantyka:** Snapshot commodity + lokalny Symbol. Endpoint nieaktywowany, licencja niepotwierdzona. Przykładowe kody z docs, nie zatwierdzona mapa Market Data.

**Rekomendacja UI:** Kontrolka nieaktywna: wymaga entitlement i formalnego przyjęcia

## F01 — Numeryczne wartości Calendar

**Tylko dokumentacja providera — brak odpowiednika bieżącego kontraktu Hub.**

`GET /calendar/country/poland?importance=3&values=true&f=json`

**Oczekiwana semantyka:** Cztery pola numeryczne dostępne u TE; Hub nie przekazuje values ani ich nie zachowuje.

**Rekomendacja UI:** P2 — wymaga rozbudowy kontraktu i odrębnej weryfikacji

## F02 — Kalendarz po polsku

**Tylko dokumentacja providera — brak odpowiednika bieżącego kontraktu Hub.**

`GET /calendar?lang=pl&f=json`

**Oczekiwana semantyka:** Dodatkowe OCountry/OCategory/OEvent; brak obsługi Hub. Nazwy oryginalne potrzebne jako stabilna podstawa selekcji.

**Rekomendacja UI:** P2 — wymaga rozbudowy kontraktu i odrębnej weryfikacji

## F03 — Historyczne obserwacje inflacji

**Tylko dokumentacja providera — brak odpowiednika bieżącego kontraktu Hub.**

`GET /historical/country/poland/indicator/inflation%20rate/2026-01-01/2026-10-31?f=json`

**Oczekiwana semantyka:** Rzeczywisty endpoint dostawcy; aktualny Hub obsługuje snapshot, nie historię.

**Rekomendacja UI:** P2 — wymaga rozbudowy kontraktu i odrębnej weryfikacji

## F04 — Natywne prognozy konkretnych symboli

**Tylko dokumentacja providera — brak odpowiednika bieżącego kontraktu Hub.**

`GET /markets/forecasts/symbol/CO1:COM,CL1:COM?f=json`

**Oczekiwana semantyka:** U dostawcy natywnie; Hub nie wywołuje tej ścieżki, rodzina wyłączona.

**Rekomendacja UI:** P2 — wymaga rozbudowy kontraktu i odrębnej weryfikacji

## F05 — Dedykowany Brave News

**Tylko dokumentacja providera — brak odpowiednika bieżącego kontraktu Hub.**

`GET /res/v1/news/search?q=oil&count=30&country=ALL`

**Oczekiwana semantyka:** Odrębny endpoint:count do50,q do400 znaków/50 słów; brak implementacji/entitlement w Hub.

**Rekomendacja UI:** P2 — wymaga rozbudowy kontraktu i odrębnej weryfikacji

## F06 — Eksport kalendarza do ICS

**Tylko dokumentacja providera — brak odpowiednika bieżącego kontraktu Hub.**

`GET /icalendar/country/poland/indicator/inflation%20rate?span=6M`

**Oczekiwana semantyka:** Przyszłe6 miesięcy, span1M..12M; brak Hub i opublikowanego kompletnego schematu ICS.

**Rekomendacja UI:** P2 — wymaga rozbudowy kontraktu i odrębnej weryfikacji

## F07 — Grupa wydarzeń obligacyjnych

**Tylko dokumentacja providera — brak odpowiednika bieżącego kontraktu Hub.**

`GET /calendar/country/united%20states/group/bonds/2026-11-01/2026-11-30?f=json`

**Oczekiwana semantyka:** Udokumentowana ścieżka TE; nie ma criteria.group w Hub ani pełnego katalogu grup.

**Rekomendacja UI:** P2 — wymaga rozbudowy kontraktu i odrębnej weryfikacji

## X01 — Headlines sources z country

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "newsapi",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "mode": "headlines",
    "publisherIds": [
      "reuters"
    ],
    "editionCountry": "us"
  }
}
```

**Oczekiwana odmowa offline:** `INCOMPATIBLE_CRITERIA`. Nie wysyłać do providera.

**Oczekiwana semantyka:** Celowa negatywna walidacja. UI ma zapobiec wysłaniu tej kombinacji.

**Rekomendacja UI:** Walidacja przed wysłaniem

## X02 — Brave news cluster z count

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "oil",
    "resultType": "news",
    "count": 3
  }
}
```

**Oczekiwana odmowa offline:** `UNSUPPORTED_CRITERIA`. Nie wysyłać do providera.

**Oczekiwana semantyka:** Celowa negatywna walidacja. UI ma zapobiec wysłaniu tej kombinacji.

**Rekomendacja UI:** Walidacja przed wysłaniem

## X03 — TE News ticker z datami

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "tickers": [
      "USURTOT"
    ],
    "from": "2026-11-01",
    "to": "2026-11-05"
  }
}
```

**Oczekiwana odmowa offline:** `UNSUPPORTED_CRITERIA`. Nie wysyłać do providera.

**Oczekiwana semantyka:** Celowa negatywna walidacja. UI ma zapobiec wysłaniu tej kombinacji.

**Rekomendacja UI:** Walidacja przed wysłaniem

## X04 — TE Forecast ticker z krajem

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "external-forecasts",
  "operation": "search",
  "criteria": {
    "tickers": [
      "USURTOT"
    ],
    "countries": [
      "united states"
    ]
  }
}
```

**Oczekiwana odmowa offline:** `INCOMPATIBLE_CRITERIA`. Nie wysyłać do providera.

**Oczekiwana semantyka:** Celowa negatywna walidacja. UI ma zapobiec wysłaniu tej kombinacji.

**Rekomendacja UI:** Walidacja przed wysłaniem

## X05 — Calendar ID z importance

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "economic-calendar",
  "operation": "search",
  "criteria": {
    "eventIds": [
      "174108"
    ],
    "importance": 3
  }
}
```

**Oczekiwana odmowa offline:** `INCOMPATIBLE_CRITERIA`. Nie wysyłać do providera.

**Oczekiwana semantyka:** Celowa negatywna walidacja. UI ma zapobiec wysłaniu tej kombinacji.

**Rekomendacja UI:** Walidacja przed wysłaniem

## X06 — Nowy język Brave nieobecny w Hub

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "brave",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "text": "oil",
    "language": "en-gb"
  }
}
```

**Oczekiwana odmowa offline:** `UNSUPPORTED_CRITERIA`. Nie wysyłać do providera.

**Oczekiwana semantyka:** Celowa negatywna walidacja. UI ma zapobiec wysłaniu tej kombinacji.

**Rekomendacja UI:** Walidacja przed wysłaniem

## X07 — Legacy qInTitle

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "newsapi",
  "family": "news-discovery",
  "operation": "search",
  "criteria": {
    "mode": "articles",
    "qInTitle": "oil"
  }
}
```

**Oczekiwana odmowa offline:** `UNSUPPORTED_CRITERIA`. Nie wysyłać do providera.

**Oczekiwana semantyka:** Celowa negatywna walidacja. UI ma zapobiec wysłaniu tej kombinacji.

**Rekomendacja UI:** Walidacja przed wysłaniem

## X08 — Nieistniejący filtr częstotliwości snapshotu

**Kryteria Hub:**

```json
{
  "contractVersion": "1.0.0",
  "provider": "trading-economics",
  "family": "indicators",
  "operation": "search",
  "criteria": {
    "countries": [
      "poland"
    ],
    "frequency": "Monthly"
  }
}
```

**Oczekiwana odmowa offline:** `UNSUPPORTED_CRITERIA`. Nie wysyłać do providera.

**Oczekiwana semantyka:** Celowa negatywna walidacja. UI ma zapobiec wysłaniu tej kombinacji.

**Rekomendacja UI:** Walidacja przed wysłaniem

## Reguły interpretacji przykładów

- Operatory NewsAPI Everything mają własną udokumentowaną gramatykę; tej samej gramatyki nie przypisywać Headlines albo Brave.
- Znak + w OPEC+ powinien być częścią cytowanej frazy, a nie niejawnie traktowany jako operator wymagania. W URI kodować parametry biblioteką, nie ręcznym konkatenowaniem.
- Native selector nie jest lokalnym postfiltrem. TE News oil, eventText i ograniczenie wyników nie dowodzą kompletnego wyszukania dostawcy.
- Przykład istniejącego kodu Markets nie oznacza aktywnego dopuszczenia; żaden dry-run nie sprawdza zakupionego planu.
- Nowe parametry provider-only wymagają przyszłego ownership, kontraktu, admission/licencji i odpowiednich testów. Ta analiza ich nie aktywuje.

Źródła każdej metody i reguły: [pełny katalog](SOURCE-HUB-API-PARAMETER-INVENTORY.md) i [macierz kompatybilności](SOURCE-HUB-PARAMETER-COMPATIBILITY.md). Istniejący dowód LIVE: [PHR](https://github.com/profitia/project-history-repository/blob/fffda7053c25affbb84984633a30dd1543153a87/history/2026/11/05/2026-11-05-16-51-27Z__architecture-architecture-source-hub-live-providers-phr-recovery-20261105/handoff.md).
