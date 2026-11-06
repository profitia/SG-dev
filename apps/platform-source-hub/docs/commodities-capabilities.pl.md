# Katalog możliwości EIA, CFTC i commodities.sh

Status: **DOCUMENTATION_BASELINE_ACTIVATION_PENDING**. Kompletność inwentaryzacji: **niepotwierdzona**.

Źródłem tej reprezentacji jest [jeden katalog JSON](../catalog/commodities-capabilities-v1.json). Zawiera pola, jednostki, trasy, częstotliwości, koszty, licencje i receipt każdego potwierdzenia. Metadane LIVE nie oznaczają przetestowania wszystkich szeregów ani historii.

| Provider | Pozycje | LIVE metadanych/operacji | Udokumentowane | Płatne, nieaktywne | Ograniczone / nieznane |
|---|---:|---:|---:|---:|---:|
| eia | 0 | 0 | 0 | 0 | 0 |
| cftc | 0 | 0 | 0 | 0 | 0 |
| commodities-sh | 30 | 0 | 9 | 19 | 2 |

## eia

Source Admission and SERVICE enrollment pending; key available privately

| Grupa / zbiór / endpoint | Status | Pola | Częstotliwości | Koszt USD |
|---|---|---:|---|---|

Dokumentacja: [źródło](https://www.eia.gov/opendata/documentation.php), [źródło](https://www.eia.gov/opendata/terms-of-service.php)

## cftc

Source Admission and SERVICE enrollment pending

| Grupa / zbiór / endpoint | Status | Pola | Częstotliwości | Koszt USD |
|---|---|---:|---|---|

Dokumentacja: [źródło](https://publicreporting.cftc.gov/stories/s/COT-Help/p2fg-u73y/), [źródło](https://www.cftc.gov/WebPolicy/index.htm)

## commodities-sh



| Grupa / zbiór / endpoint | Status | Pola | Częstotliwości | Koszt USD |
|---|---|---:|---|---|
| GET /health | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| GET /v1/catalog | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| GET /v1/calendar | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| GET /llms.txt | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| GET /llms-full.txt | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| GET /SKILL.md | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| GET /.well-known/agent.json | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| GET /.well-known/x402.json | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |
| GET /v1/price/{code} | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.01 |
| GET /v1/prices | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| GET /v1/history/{code} | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| GET /v1/inventory/eia | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| GET /v1/inventory/eia/{series} | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| GET /v1/cot/{code} | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| GET /v1/spreads/crack | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| GET /v1/spreads/crush | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| GET /v1/spreads/basis | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| GET /v1/fundamentals/wasde | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| GET /v1/fundamentals/crop-progress | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| GET /v1/fundamentals/export-sales | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.02 |
| GET /v1/fundamentals/usgs | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.03 |
| GET /v1/fx/{pair} | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.01 |
| GET /v1/snapshot/{sector} | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.05 |
| GET /v1/decision/{sector} | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.1 |
| GET /v1/snapshot/all | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.12 |
| GET /v1/decision/all | PAID_NOT_ACTIVATED | 15 | nieustalona | 0.25 |
| GET /v1/curve/{root} | UNAVAILABLE_OR_UNKNOWN | 0 | nieustalona | 0 |
| GET /v1/spreads/calendar/{root} | UNAVAILABLE_OR_UNKNOWN | 0 | nieustalona | 0 |
| POST /api/mcp | PAID_NOT_ACTIVATED | 0 | nieustalona | nieustalony |
| GET /api/mcp | DOCUMENTED_NOT_TESTED | 0 | nieustalona | 0 |

Dokumentacja: [źródło](https://commodities.sh/docs/reference), [źródło](https://commodities.sh/terms)

## Ograniczenia i licencje

EIA: bezpłatny klucz, rzeczywisty throttling dostawcy, atrybucja EIA, zastrzeżenia praw do materiałów osób trzecich. CFTC: informacje rządowe są public domain, z wyjątkami dla cudzych materiałów; atrybucja CFTC. commodities.sh: obowiązują także warunki źródeł nadrzędnych, w tym FRED. Darmowy discovery nie przyznaje prawa do redystrybucji płatnych obserwacji. Komercyjna redystrybucja wymaga sprawdzenia praw konkretnej serii. SourceHub nie utrwala treści obserwacji przy TTL 0; katalog zapisuje wyłącznie dopuszczone metadane.

## Niewiążące możliwe zastosowania

Oil Report: zapasy, produkcja, handel i ceny energii EIA oraz pozycjonowanie COT CFTC. Kalendarz Surowcowy: harmonogramy publikacji i okresy referencyjne, bez utożsamiania ich z opublikowanym odczytem. Analityka SpendGuru: porównania szeregów z zachowaniem jednostek, rewizji i semantyki instrumentów. Żadne z tych zastosowań nie jest wdrażane ani zatwierdzane przez ten katalog.
