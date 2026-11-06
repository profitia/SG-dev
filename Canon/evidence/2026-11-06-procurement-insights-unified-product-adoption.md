# Procurement Insights Unified Product & Assistant v1.1 — documentary adoption

Status: **OWNER_PRODUCT_DIRECTION_CONFIRMED / PROPOSED / AUTHORITY_ACCEPTANCE_BLOCKED**.
Data weryfikacji: 2026-11-06 (UTC). Profil: **ARCHITECTURE**, workspace `SG-dev Architecture`, target `development`, scope `governance`.
Task: `ARCH-PROCUREMENT-INSIGHTS-UNIFIED-CANON-V11-20261106`.
Host: `01a19fe2-0dc1-7ca2-8acf-28504684e3c1`.

## Decyzja właściciela i zachowana treść

Właściciel w tym czacie jawnie zlecił **CODEX — PROCUREMENT INSIGHTS UNIFIED CANON v1.1 — GOVERNANCE ADOPTION**, w trybie Full Autopilot, z dokumentacyjnym PR i merge wyłącznie przy spełnieniu obowiązujących bramek. Polecenie zatwierdza kierunek: równorzędny moduł Procurement Insights, zakładki Newsfeed/Raporty i jeden wspólny asystent AppShell/CIC. Nakazuje zachować nierozstrzygnięte przyjęcia PI v1.0 i CIC v1.1. To źródło zgody użytkownika, nie wygenerowane przez agenta GitHub review.

[Pełny amendment](../v1.1-procurement-insights-unified-product-and-assistant-amendment.md) jest **byte-identical** z dostarczonym `Procurement_Insights_Unified_Product_and_Assistant_Canon_v1.1_PROPOSAL.md`. SHA-256: `bca56c90d17b6a1eac3b574ed9f0b49b218799d701de6ec44d7f2129e4e4815a`.
Zachowuje status PROPOSED / NOT YET ACTIVE. Nie zastępuje ani nie kopiuje backendu Newsfeed; jest uzupełnieniem docelowego kanonu Procurement Insights.

## Aktualna authority i zależności

Punkt odniesienia SG-dev/main: `d943d2ba17eeb6b07ba5a9162a4767e155513a90`. Manifest `3.40.0` pozostaje bez zmian. Poniższe aktywne źródła odczytano w tej wersji; statusy pochodzą z rzeczywistego manifestu, nie z samej nazwy dokumentu.

| Authority | Faktyczny status / zachowana granica |
| --- | --- |
| [Newsfeed v1.0](../v1.0-newsfeed-business-and-architecture-canon.md) | ACTIVE; Architecture Platform, niezależny backend; historyczne umieszczenie pełnego UI w ADP pozostaje niezmienione do skutecznego przyjęcia amendmentu. |
| [Newsfeed v1.1](../v1.1-newsfeed-source-hub-responsibility-amendment.md) | ACTIVE; akwizycja u Hub, obserwacje/historia/powiadomienia u Newsfeed. |
| [Newsfeed v1.2](../v1.2-newsfeed-saved-searches-ownership-sharing-history-canon.md) | ACTIVE; UserID/actor/organisation osobno, wersje, sharing USER/ORG, bezterminowy dozwolony indeks, replay bez nowego pobrania; nie przenosi treści do CIC. |
| [Hub v1.0](../v1.0-platform-source-hub-business-and-architecture-canon.md) i [Universal v1.1](../v1.1-platform-source-hub-universal-first-party-consumer-access.md) | ACTIVE; wspólna akwizycja, rzeczywisty HUMAN/SERVICE i bieżące E1/Source/licencje. Nowa nazwa modułu nie nadaje grantu. |
| [Platform AppShell](../v1.0-platform-appshell-business-and-architecture-canon.md) | ACTIVE w manifeście; Architecture Platform reguluje granice, fizyczny host/Assistant UI u SG Runtime/SG2; CIC w odrębnym repozytorium. |
| [Oil & Asphalt v0.5](../v0.5-procurement-oil-insight-report-canon.md) | ACTIVE; własny standard raportu, osiem bloków, dziewięć elementów logicznych, evidence/Quality Gate, niezależny Forecast Core; bez zmian. |
| [PI v1.0 — #847](https://github.com/profitia/SG-dev/pull/847) | **OPEN / DRAFT / NOT MERGED**, head `d143ca28c583c7f65e93e7fb4a2936f079d0cc33`. Treść zatwierdzona warunkowo I1–I4; brak jej pliku i ACTIVE wpisu na main. Dotychczasowa zgoda wyłącza merge. |
| [PI G1 — #848](https://github.com/profitia/SG-dev/pull/848) | **OPEN / DRAFT / NOT MERGED**, head `998862fb3e3249e056fc1159bc4a0fcab2e76dc0`. G1 jest już GRANTED; trzy trasy Insights Domain/SG2 nie są jeszcze aktywne na main. PR wskazuje nierozwiązane controlled-CI admission; nie nadpisujemy go. |
| [CIC v1.1 — #18](https://github.com/profitia/conversational-intelligence-core/pull/18) | **OPEN / DRAFT / NOT MERGED**, head `6195f5aac547121ba816956b559a9e4dfe70b09c`. Własny owner CIC; approval C1–C3, authority-main i kontrakt producent/konsument PENDING. Dotychczasowa zgoda wyłącza merge. |
| [CIC Knowledge Freeze v1](https://github.com/profitia/conversational-intelligence-core/blob/61629b82876b19c23cba0523bb7de83658b8461e/docs/Assistant-Knowledge-Freeze-v1.md) | Istniejąca authority CIC; sześć warstw wiedzy i historyczny stan kodu, bez dowodu pełnego kontekstowego asystenta. Amendment nie zmienia Recovery/Advisory ani globalnie wiedzy CIC. |

## Zachowane warunki ownerów

- **I1:** potrzeba 7D nie jest przyjęciem matematyki, kalibracji ani live Forecast acceptance; decyzja pozostaje u Forecast ownera.
- **I2:** minimalizacja Clerk/E1 dotyczy round-tripów; nie usuwa aktualnych uprawnień, revocation, ograniczeń delegacji i ochrony chronionego skutku. Nie tworzymy operacji `insight.*` ani wieczystego ALLOW.
- **I3:** CIC policy i zweryfikowany wykonawca modeli są rozdzielone. CIC nie produkuje, nie recenzuje i nie dystrybuuje raportów; nie otrzymuje sekretów/provider transportu ani SQL Insights.
- **I4:** niezależny ludzki pilot, jakość, evidence, ekonomia i właściwa konfiguracja modeli wymagają rzeczywistego odbioru; kanon nie jest pozwoleniem na płatne próby lub autopublikację.
- **C1–C3:** kierunek K5 account/UserID zachowuje prawa organizacji i źródeł; przyszły Analytical nie uchyla obecnego Recovery/Advisory; wykonawca, entitlement i koszty mają własne przyjęcie. Ten PR niczego w CIC nie aktywuje.

Pełne historyczne warunki pozostają u właściwych ownerów w przypiętych powyżej wersjach PR; niniejszy skrót ich nie zastępuje.

## Jeden skonsolidowany blocker

**UPSTREAM_AUTHORITY_ACCEPTANCE_PENDING:** nie można przyjąć v1.1 jako ACTIVE uzupełnienia nadrzędnego PI ani aktywować docelowego ownership/asystenta, gdy bazowy PI (#847), jego już zatwierdzony G1 (#848) i kierunkowy amendment CIC (#18) nie przeszły własnego kontrolowanego przyjęcia na authority main.

Minimalna wymagana czynność ownerów: **domknąć formalne, kontrolowane przyjęcie istniejącego zestawu #847/#848 oraz CIC #18, z zachowaniem I1–I4/C1–C3 i wymaganego exact-candidate CI**. #848 ma dodatkowo istniejącą blokadę admission zaufanego kontrolera, wymagającą właściwej, wąskiej zgody, a nie obejścia. Nie ponawiać zatwierdzenia kierunku produktowego v1.1 ani udzielonego G1. Ten task nie odświeża, nie zmienia, nie scala ani nie zastępuje cudzych propozycji.

Po skutecznym zamknięciu zależności v1.1 może przejść własne kontrolowane acceptance: ponowny odczyt statusów/SHA, minimalny poprawny wpis manifestu z zależnościami i loadOrder, wymagane CI, merge i independent actual-main proof. Dzisiejszy Draft PR nie jest takim dowodem.

## Zakres tej zmiany i kontrole

Dokładnie dwa pliki: pełny amendment oraz ten zapis decyzji, zależności i historii próby przyjęcia. Oba routują do **Governance Source Layer / ALIGNED / ARCHITECTURE**. Bez nowego profilu, routingu, aktywnego wpisu manifestu lub zmiany historycznych kanonów; brak istniejącego indeksu wymagającego korekty.

Normatywny zakres załącznika pozostaje pełny: Procurement Insights z Newsfeed/Raporty, ADP tylko kontekstowe; trwała historia/indeks i sharing; Hub jako jedyny właściciel akwizycji; typowane opcjonalne EIA/CFTC/commodities.sh dopiero po kontrakcie i uprawnieniu; niezależna trwała publikacja raportów i Quality Gate; jeden asystent, opt-in i trwałe neutralne event-referencje; minimalny read-only retrieval z aktualnym E1/provenance/as-of/wersją i revocation. Bez masowego przenoszenia archiwum do globalnej wiedzy CIC.

Nie implementowano UI, API, CIC, workerów, schedulerów, migracji, E1/RLS, Source Hub ani providerów. Nie zmieniono Neon/Render, sześciu istniejących polityk UNMETERED, retencji Hub 0 lub statusów Markets; nie wykonano płatnych wywołań ani deploymentu. Nie twierdzimy, że docelowy moduł lub asystent jest LIVE.
