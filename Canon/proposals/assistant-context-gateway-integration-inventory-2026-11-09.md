# Assistant Context Gateway — Integration Inventory (snapshot 2026-11-09)

**Rodzaj:** załącznik faktograficzny do [CIC Assistant Context & Capability Integration Amendment v1.1](https://github.com/profitia/conversational-intelligence-core/blob/main/docs/Assistant-Context-and-Capability-Integration-Amendment-v1.1.md) oraz [ADR-001](./assistant-context-gateway-adr-001-v1.md). **Nie jest nowym kanonem** i nie przyznaje operacji E1/G1.  
**Stan:** `READ_ONLY_VERIFIED_SNAPSHOT / NOT_LIVE_E2E_ACCEPTANCE`; data odniesienia 2026-11-09 (Europe/Warsaw).  
**Repo docelowe:** `profitia/SG-dev`, `Canon/proposals/assistant-context-gateway-integration-inventory-2026-11-09.md`.  
**Zasada aktualizacji:** zachować historyczne SHA i wyniki bez przepisywania faktów; nowe stany zapisywać w kolejnym datowanym snapshotcie albo w odrębnym changelogu. Status `DEPLOY` nie oznacza E2E.  
**Uwaga:** zawartość poniżej jest pełnym audytem bazowym przeprowadzonym przed przyjęciem ADR; architektura w sekcji G jest propozycją, nie wdrożeniem.

---

# SpendGuru / CIC — audyt gotowości integracji kontekstowej

**Data:** 9 listopada 2026, Europe/Warsaw  
**Charakter:** analiza read-only. Bez commitów, zmian konfiguracji, migracji, wdrożeń lub płatnych zapytań API.  
**Baza porównawcza:** SG-dev `7695eb7432ee14540fcad35b6957ff8e8a637e42`; CIC `2f561fc82161ddcfdfa2aed7b4302044155371ce`; dokumenty, kod, metadane Render i schematy Neon.  
**Status dowodu:** `KOD` = przeczytana implementacja; `DB` = metadane rzeczywistego schematu Neon; `DEPLOY` = Render oznaczył wdrożenie jako live, niekoniecznie przetestowano operację; `DRAFT` = nieprzyjęty PR; `BRAK DOWODU` = nie potwierdzono, nie oznacza dowodu absolutnej nieobecności.

## Werdykt

Nie istnieje obecnie potwierdzony, kompleksowy pipeline: **AppShell → rozmowa CIC → dobór i autoryzacja K1–K6 → odczyty API → OpenAI → streaming odpowiedzi i zapisana historia**. Znaczna część źródeł i danych istnieje. Największą luką jest nie samo źródło wiedzy, lecz **bezpieczna orkiestracja kontekstu i produkcyjny wykonawca swobodnej konwersacji**.

Rekomendacja: utworzyć lekką, wspólną capability `Assistant Context Gateway` jako pakiet backendowy w `SG-dev/packages` + kontrakty, na początku osadzony w istniejącym runtime SG2. Nie zakładać z góry osobnego Render. Gateway powinien być **równorzędny wobec Source Hub**, nie zawierać kopii danych modułów i nie przejmować sterownika konwersacji CIC. CIC nadal jest osobnym repozytorium i właścicielem polityk rozmowy.

## A. Stan rzeczywistych producentów

| Producent | Implementacja / kontrakt | Schemat / trwałość | Status wykonawczy | Wartość i luka dla asystenta |
|---|---|---|---|---|
| CIC, SG2 Advisory | `apps/sg-runtime/lib/advisory/cic-adapter.ts`, `/api/advisory`; CIC `packages/cic-*` | Historię wiadomości przesyła aktualny klient, brak zapisu w tym adapterze | Kod w SG-dev; brak potwierdzonego pełnego CIC chat runtime | Deterministyczny scoring intencji / wybór modułu; **nie jest swobodną rozmową OpenAI** |
| AppShell | `components/appshell/assistant-widget.tsx`, `assistant-content.tsx`, `assistant-screen-context.ts` | Stan interfejsu; brak trwałych transkryptów | SG2 runtime Development oznaczony live na starszym commicie | Jeden panel, awatar, odpięcie i etykieta X-Ray; pole i wysyłka oraz historia są wyłączone |
| Benchmark Finder / Market / Forecast | `app/api/benchmark/*`, `lib/benchmark/*`, `lib/forecast/*` | Neon Market Development: `market_series`, `market_observations`, `forecast_current_*`, `forecast_verification_*`; osobna baza benchmarków zawiera `Category`, `BusinessBenchmark`, `OrganizationBenchmarkSelection` | SG2 Development live, pracownicy forecast osobno na Render | API fakty i prognozy istnieją; brak kompletnego kontraktu `assistant context` dla aktywnej serii, wykresu i jego filtrów |
| Newsfeed | `apps/newsfeed-runtime/src/{server,auth,repository}.mjs`; `packages/newsfeed-contracts` | Neon Newsfeed Non-Prod: `observations`, `monitor_runs`, `publications`, `observation_publications`, `notification_outbox` | `newsfeed-api-development` live od 5.11 | Obserwowane tematy i historia są trwałe; potrzebny uprawniony read adapter dla rekomendacji, korelacji i powiadomień CIC |
| Economic Calendar | `apps/economic-calendar-runtime/{src,migrations}`, `packages/economic-calendar-contracts` | Migracja przewiduje `events`, `observations`, `sync_runs`, `preferences`, `favourites` z RLS | Nie znalazłem odpowiadającego osobnego Render Development ani potwierdzonego środowiska DB ECR | Bogaty kod kontraktów K3 i K5; dostępność runtime niepotwierdzona |
| Procurement Insights / Oil Report | Draft PR #923, `apps/insights-runtime`, `packages/insights-contracts` | **Kandydat** SQL: `insights_private.report_jobs`, `report_artifacts` z RLS | PR #923 open/draft, bez deploymentu i czterech dopuszczonych operacji E1 | Runner/scheduler/Composer/PDF istnieją w kandydacie; nie są źródłem działającego API; konieczny strukturalny read raportu dla CIC |
| SRM / X-Ray | `apps/srm/app/api/xray/*`, `packages/srm-xray/src/assistant-context.ts`, peer X-Ray presentation gateway | Neon SRM Development `srm_app`: 21 tabel, w tym `financial_facts`, `suppliers`, `organizations`, `user_supplier_interest` | `srm-development-runtime` Render live od 2.11 | Gotowe bogate dane i kontrakt snapshotu; AppShell przepuszcza tylko `supplierName` i `year`; osobny autoryzowany model read dla CIC |
| ADP | `components/appshell/adp-module-host.tsx`, `packages/srm-adp-ui` | Lokalny model sesji, nie trwały backend ADP w tym hoście | Część AppShell | Obecny montaż prezentacyjny, **bez Screen Context / CIC** i bez produkcyjnej persystencji danych formularzy |
| Identity | `apps/identity-runtime`, `apps/sg-runtime/lib/platform/account-session.ts` | Konto i `assistant-avatar` / `salutation` | `identity-runtime-development` live od 6.11 | Identyfikacja i podstawowa personalizacja konta; nie jest uniwersalną bazą kategorii/dostawców użytkownika |
| Package & Limits | `apps/package-limits` | Neon Development: `packages`, `capabilities`, `assignments`, `metrics`, `receipts`, `audit` | `limits-development` live od 30.10 | Istnieje centralna domena limitów; każdy nowy model call wymaga dopuszczenia i rzeczywistego meteringu, a nie drugiego licznika CIC |
| Platform Source Hub | `apps/platform-source-hub`, `packages/platform-source-hub-contracts` | Neon Source Hub Non-Prod: `source_records`, `acquisitions`, `providers`, `provider_licences`, `first_party_*` | `source-hub-development` live od 6.11 | Agreguje zewnętrzne źródła; **nie zarządza pełnym kontekstem ekranu/organizacji/użytkownika ani konwersacją** |
| PCOS Cognition | `apps/sg-runtime/lib/api/cognition-service.ts`; `apps/pcos-explorer/src/services/cic-readiness.ts` | Explorer ma domenowe modele H-layer | Endpointy Next istnieją, ale brakuje podłączonego singletonu i REST API Explorer | `getCognitionService()` rzuca błąd, jeśli `setCognitionService()` nie zostało wywołane; w przeszukanym SG-dev tylko deklaracja tego wywołania |

## B. Konkretne API i payloady

### CIC / SG2

- `POST /api/advisory` → `{locale:'pl'|'en', messages:[{role:'user'|'assistant',content:string}]}`; maksymalnie osiem komunikatów, 2000 znaków każdy. Zwraca `content`, `intent`, `confidence`, ewentualnie `recommendation` i `rationale`; brak streamingu.
- `POST /api/hydrate/assistant` → `{entityRef,entityType:'COMMODITY'|'SUPPLIER'|'BENCHMARK',contextType:'PROCUREMENT'|'NEGOTIATION'|'SUPPLIER'|'INTELLIGENCE'|'BENCHMARK'|'SHOULD_COST',sessionId?,maxTokens?}`. Handler deklaruje wywołanie `getCognitionService().hydrateAssistant()`. **Nie klasyfikować jako działający retrieval**, dopóki wykonawca singletonu nie zostanie podłączony.
- `POST /api/retrieval/contextual` → `{entityRef,entityType,contextType,sessionId?}`; podobny problem.
- `GET /api/procurement/context?commodityRef=...&sessionId=...&depth=shallow|deep|full`; podobny problem.

### Benchmark i Forecast

- `POST /api/benchmark/context` → `{seriesIds:string[]}` (1–8), zwraca `items` ze `BenchmarkSemanticContext` (tytuł, opisy, źródła, terminy wydań, metadane).
- `POST /api/benchmark/ai-search` → `{prompt:string}` (3–500), zwraca `{intent,candidates}`; OpenAI `responses.create` w `lib/benchmark/ai-search.ts`.
- `POST /api/category/ai-suggestions` → `{categoryName:string,description?:string}`; OpenAI `responses.create` w `lib/category/ai-suggestions.ts`; nie jest wspólnym CIC chat.
- `GET/POST /api/benchmark/selection` → odczyt zapisanych benchmarków organizacji lub zapis wybranego kandydata. Ścieżka natywna wymaga operacji `benchmark.selection.read/write`, serwerowo zweryfikowanego user/org.
- `GET /api/benchmark/forecast/current` → dostęp przez osobny handler Current Forecast; potrzebny read adapter na poziomie serii/zakresu/proweniencji, nie kopia silnika prognoz do CIC.

### Newsfeed

- `GET/POST /v1/observations` → lista lub `ObservationInput` `{name,subjectKind:'company'|'product'|'investment'|'category'|'topic',subject,request:{family:'news-discovery',operation:'search',...}}`.
- `GET/PATCH/DELETE /v1/observations/{id}` → pozycja i zmiana wersji/statusu.
- `GET /v1/observations/{id}/history` → przebieg monitoringu i powiązane publikacje.
- `POST /v1/observations/{id}/discover` → idempotentny run z Source Hub, wyłącznie autoryzowany.
- Zabezpieczenie: `personal.list.read/write`, prywatna projekcja E1 `USER_IN_ORGANISATION_PRIVATE`; scope środowisko, app, org, użytkownik. Brak uprawnień wynikających z samego peer credential.

### Economic Calendar (kod, niepotwierdzony deployment)

- `GET /v1/organisations/{orgId}/calendar/events` (+ `/{eventId}` i `/{eventId}/revisions`) z filtrami `from,to,country,indicator,importance,eventText,eventId,asKnownAt,limit,after`.
- `GET/PUT /v1/organisations/{orgId}/calendar/preferences` → `{watchedCountries,watchedIndicators,watchedTopics,savedFilters,display}`; PUT używa `expectedVersion`.
- `GET /v1/organisations/{orgId}/calendar/favourites`; `POST/DELETE /.../favourites/{eventId}`.
- E1: `knowledge.read` dla faktów publicznych/licencjonowanych, `personal.list.read/write` dla preferencji; rozdzielenie `SHARED_KNOWLEDGE` i `USER_IN_ORGANISATION_PRIVATE`.

### Platform Source Hub

- `GET /v1/capabilities` → rzeczywista oferta rodzin danych i poziom aktywacji.
- `POST /v1/acquire` → `{context:{organisationId,expectedUserId},request:HubRequest}` w trybie authenticated peer, z `Idempotency-Key` i podpisem operacji. Alternatywny first-party admission również nie zwalnia z E1 i Source rights.
- Rodziny: news-discovery, economic-calendar, indicators, external-forecasts, market-observations; commodity adapters według odrębnych kontraktów.

### Insights — tylko niepołączony Draft PR #923

- `POST /api/v1/insights/report-jobs` → `ReportCommand` `{definitionId:'oil-asphalt',profileVersion,period:{fromDate,throughDate},revision,asOf,allowPartial}`.
- `GET /api/v1/insights/report-jobs/{id}` → status joba, etapy, pokrycie, artefakty.
- `GET /api/v1/insights/report-editions` → lista wydań.
- `GET /api/v1/insights/report-editions/{id}/pdf` → plik, tylko jeśli spełniony status review.
- PR nie jest wdrożony: brakuje E1 dla czterech operacji, montażu hosta i workera; modele kosztowe i trwały runner zostały sprawdzone lokalnie.

### X-Ray / SRM

- W SG2 istnieje serwerowy gateway `POST /api/appshell/xray/presentation/[operation]`, który podpisuje żądanie do backendu SRM. SRM weryfikuje peer oraz **oryginalną** HUMAN/E1/RLS dla odczytu. Peer handshake nie gwarantuje dostępu do treści dostawcy.
- Kanoniczny `AssistantApplicationContext` zawiera: `schemaVersion`, `dashboardInstanceId`, `source`, `supplier:{id,name,nip,krs}`, `view:{page,radar,indicators,history}`, `financialSummary`.
- W SG2 `projectXrayAssistantContext()` redukuje ten model do `{supplierName,year}` tylko do wyświetlania etykiety; nie istnieje obecnie wywołanie modelu z pełnym snapshotem.

## C. Uprawnienia / właściciele danych

1. Warstwa SG2/host musi weryfikować Clerk sesję, UserID, OrganisationID i bieżącą licencję/entitlement; **nigdy nie przyjmować ich tylko z danych ekranu/promptu**.
2. Moduły są authority dla treści i operacji; gateway może wywoływać wyłącznie dopuszczone wersjonowane projekcje read-only, bez bezpośredniego SQL do prywatnych baz SRM/Insights.
3. `K4`: wiedza organizacji podlega granicom organizacji i uprawnieniom zasobu. `K5`: osobiste konto użytkownika, dokumenty i prywatne złącza mają według CIC v1.1 domyślną zasadę UserID ownership (`ACCOUNT_PRIVATE`), wymagającą nowego jawnego kontraktu E1, niezależnego od zwykłego członkostwa w organizacji.
4. Kontekst i wpisy cache muszą uwzględniać środowisko, verified user/org, scope/entitlement, licencję, źródło, okres danych, wersję i odwołanie praw. Historyczna odpowiedź nie zwalnia z ponownej autoryzacji przy odczycie.
5. Package & Limits musi być jednym źródłem dopuszczenia wywołania OpenAI i rejestracji rzeczywistych tokenów/kosztu. Nie przenosić kosztów i limitów do osobnego rejestru CIC.

## D. Sześć warstw wiedzy — stan

| Warstwa | Znaleziona reprezentacja | Braki |
|---|---|---|
| K1 ogólna | Wiedza modelu oraz częściowe istniejące wywołania OpenAI | Brak aktywnej konwersacji OpenAI w AppShell |
| K2 procurement | Wielojęzyczny corpus CIC: `domain/profitia-knowledge-intelligence`, `knowledge/pl`, `knowledge/en-US`, logika intencji | Brak zatwierdzonego, operacyjnego retrieval/versioned index w SG2 i automatycznego cytowania źródła |
| K3 rynek | Market Data/Forecast, Benchmark Finder, Newsfeed, Source Hub; kod ECR | Brak łączonego kontekstu do modelu; status danych/licencja/wersja nie zostały ujednolicone |
| K4 organizacja | SRM `organizations`, `organization_supplier_interest`, finansowe; Finder `Category`, `OrganizationBenchmarkSelection` | Brak jednego autoryzowanego profilu organizacji (branża, priorytety, zakupy, polityki) i API do CIC |
| K5 użytkownik | SRM `user_supplier_interest`; Identity avatar/salutation; kod ECR favourites/preferences; Newsfeed user-owned observations | Brak wspólnego rejestru preferencji i historii pracy, prywatnego indeksu dokumentów i złączy poczta/dyski |
| K6 ekran | Bogaty `srm-xray/assistant-context.ts`; minimalny `assistant-screen-context.ts` | Brak ustrukturyzowanych snapshotów aktywnego Benchmark/Forecast/Insights/Newsfeed/ADP przy wysłaniu wiadomości; istniejąca etykieta X-Ray nie jest kontekstem analitycznym |

## E. Historia, wykonanie modeli i streaming

**SG2 AppShell:** textarea i `Send` disabled, przycisk historii disabled. Nie ma potwierdzonego `conversationId` i trwałego transkryptu właściwego asystenta AppShell. `apps/sg-runtime/components/advisory/spendguru-advisory-widget.tsx` używa lokalnego stanu wiadomości i nie-streamingowego `/api/advisory`; to odrębna powierzchnia.

**CIC:** `packages/cic-core` kontroluje istniejący tryb Advisory/Recovery (granica czterech tur), nie analityczny, wieloturowy chat. `examples/runtime-app` zawiera demonstracyjne OpenAI Chat Completions, SSE, Redis/in-memory fallback oraz injection kontekstu, ale dokumentacja nazywa je materiałem migration reference, nie deployed authority. CIC `runtime/README.md` mówi wprost, że nie ma tam finalnego runtime.

**Profitia.pl:** osobny konsument ma rzeczywisty `app/api/chat/route.ts` z OpenAI, SSE, obsługą budget/retry, mechanizmem recovery i bibliotekami CIC. `stores/advisory-session.store.ts` trzyma stan frontendowy w Zustand; obecność sesji sklepu nie jest dowodem trwałej organizacyjnej historii SG2. To dobra baza do ponownego użycia wybranych wzorców, nie kopiowania polityki doradczej 1:1.

**Niezależne AI:** SG2 Benchmark Finder `lib/benchmark/ai-search.ts` i Category Builder `lib/category/ai-suggestions.ts` wykonują `OpenAI.responses.create`; Vector ma własną ścieżkę OpenAI. Centralizacja przyszłych wywołań CIC musi współpracować z istniejącymi właścicielami, bez nieautoryzowanej zmiany ich działań.

**Wymagane dla uruchomienia:** endpoint rozmowy w SG2 BFF z model execution, bezpieczny `POST` i strumień SSE, anulowanie, idempotencja, zapis UserID/OrganisationID conversation + messages + context snapshots z retencją, cytowania, reautoryzacja retrieval, feedback/cost/latency monitoring; projekt odrębnej polityki Analytical od istniejącego czteroturowego Advisory.

## F. Rozkład usług Development (status deklarowany przez Render)

| Serwis | Latest deploy marked live | Commit |
|---|---|---|
| SG2 Runtime | 2026-11-04 | `df75325bd537c7bc6f1f6d212f8ee0f3d83f1092` |
| SG2 Dashboard | 2026-10-26 | `32fce23eff7033e84d19ff74dc719c93eff34097` |
| SRM Development | 2026-11-02 | `76d9738ff73abb3600cf806d5b01c6b23133b451` |
| Newsfeed Development | 2026-11-05 | `8dfe12b9311f24227c904c13900e373aea518490` |
| Source Hub Development | 2026-11-06 | `d943d2ba17eeb6b07ba5a9162a4767e155513a90` |
| Identity Runtime Development | 2026-11-06 | `1cc5282c718ab1ce85fa9da4831592739c0ff899` |
| Package & Limits Development | 2026-10-30 | `727a3c788720c436790b17eed58dcf0fd8660444` |

Nie stwierdzono osobnych usług Render dla CIC / ECR / Insights w wykazie tego workspace. Nie wykonano authenticated end-to-end testów API ani porównania każdej ścieżki do deployed code; `live` to status deploymentu, nie dowód wszystkich operacji.

## G. Docelowy podział odpowiedzialności

```text
profitia/conversational-intelligence-core  [ODRĘBNE REPO]
  packages/cic-core, cic-procurement, cic-profitia, cic-evals
  └─ owner intencji, polityk rozmowy, selekcji/interpretacji kontekstu

profitia/SG-dev
  apps/sg-runtime/                       [EXISTING; host UI + BFF/AI executor]
  apps/platform-source-hub/             [EXISTING; zewnętrzne źródła]
  apps/newsfeed-runtime/                [EXISTING; newsfeed]
  apps/economic-calendar-runtime/       [EXISTING CODE; deploy not verified]
  apps/identity-runtime/                [EXISTING]
  apps/insights-runtime/                [DRAFT PR #923 only]
  packages/assistant-context-contracts/ [PROPOSED]
  packages/assistant-context-gateway/   [PROPOSED; library, initial in SG2]
```

Proponowany przepływ:

`AppShell (screen snapshot) → SG2 assistant BFF (session/E1 + model budget) → CIC conversation planner → Context Gateway (dynamic, bounded authorized read adapters) → właściciele benchmark/news/calendar/insights/supplier/org/personal → prompt/evidence assembly → OpenAI Responses + SSE → transcript + source references → AppShell.`

Proaktywne alerty muszą płynąć osobną ścieżką: domenowy event/outbox → relevance/rules → uprawniony user inbox → assistant surface; nie wywoływać modelu dla każdej aktywacji ekranu. PostHog i Sentry to pomiar i diagnostyka, a nie bazowe źródło K1–K6; ich konkretny deployment/LLM instrumentation nie został zweryfikowany.

## H. Minimalna sekwencja wdrożeniowa — rekomendacja, nie wykonana praca

| Priorytet | Rezultat | Dlaczego teraz |
|---|---|---|
| P0 | Analitical Conversation v1: dozwolona polityka CIC niezależna od 4-turn Advisory, SG2 model executor, metering, SSE, trwała historia | Bez tego wszystkie konektory służą tylko statycznym widokom |
| P1 | `AssistantScreenSnapshot v1` i `AssistantContextEnvelope v1` (typed IDs, okres/filtry, source/version/asOf, rights) | Model musi wiedzieć, o czym użytkownik mówi; nie ufać DOM/etykiecie |
| P1 | Read-only adaptery na działające API: Benchmark/Forecast + SRM X-Ray + Newsfeed, Identity K5 minima | Najszybsza rzeczywista wartość bez dodatkowej infrastruktury |
| P2 | ECR po wdrożeniu i dopuszczeniu, Insights po odblokowaniu PR #923 i operacji E1 | Nie wiązać startu chatu z jeszcze niedostępnymi usługami |
| P2 | Ujednolicone preferencje UserID/OrganizationID i pierwsze profile wiedzy | Personalizacja i rekomendacje, z wyraźnym rozdzieleniem prywatności |
| P3 | Proaktywna relevance engine + inbox, event-to-notification, ranking i deduplikacja | Rozwój od odpowiedzi do inicjatywy asystenta |

## I. Istotne ograniczenia audytu

Odczyty obejmowały drzewa/pliki dwóch repozytoriów, dodatkowo `profitia/profitia.pl`, schematy Neon wybranych zasobów, oraz wykaz/deploye Render. Nie pobierano sekretów ani danych osobowych; nie wykonywano płatnych provider calls; nie wywoływano prywatnych business endpoints pod sesją realnego użytkownika. Schemat SQL w PR albo lokalnym pliku nie dowodzi migracji na środowisku. Brak integracji w przeszukanym zakresie nie stanowi dowodu, że nie istnieje inny, nieodkryty serwis. Sentry/PostHog i dynamiczne zachowanie konkretnych scenariuszy z prawami E1 wymagają osobnej walidacji, gdy ruszy implementacja.

## J. Źródła — lokalizacje w kodzie

- [CIC main](https://github.com/profitia/conversational-intelligence-core/tree/2f561fc82161ddcfdfa2aed7b4302044155371ce)
- [CIC Assistant Context & Capability v1.1](https://github.com/profitia/conversational-intelligence-core/blob/main/docs/Assistant-Context-and-Capability-Integration-Amendment-v1.1.md)
- [SG-dev main](https://github.com/profitia/SG-dev/tree/7695eb7432ee14540fcad35b6957ff8e8a637e42)
- [CIC adapter SG2](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/advisory/cic-adapter.ts)
- [SG2 AppShell Assistant Widget](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/components/appshell/assistant-widget.tsx)
- [SG2 Screen Context](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/components/appshell/assistant-screen-context.ts)
- [SRM X-Ray Context](https://github.com/profitia/SG-dev/blob/main/packages/srm-xray/src/assistant-context.ts)
- [PCOS Cognition service adapter](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/api/cognition-service.ts)
- [Benchmark AI Search](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/benchmark/ai-search.ts)
- [Category AI Suggestions](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/category/ai-suggestions.ts)
- [Newsfeed API](https://github.com/profitia/SG-dev/blob/main/apps/newsfeed-runtime/src/server.mjs)
- [Newsfeed migrations](https://github.com/profitia/SG-dev/blob/main/apps/newsfeed-runtime/migrations/001-foundation.sql)
- [Economic Calendar API](https://github.com/profitia/SG-dev/blob/main/apps/economic-calendar-runtime/src/server.mjs)
- [Economic Calendar contracts](https://github.com/profitia/SG-dev/blob/main/packages/economic-calendar-contracts/index.d.mts)
- [Platform Source Hub API](https://github.com/profitia/SG-dev/blob/main/apps/platform-source-hub/src/server.mjs)
- [Procurement Insights PR #923](https://github.com/profitia/SG-dev/pull/923)
- [Profitia.pl Chat API](https://github.com/profitia/profitia.pl/blob/main/app/api/chat/route.ts)
- [CIC example runtime](https://github.com/profitia/conversational-intelligence-core/blob/main/examples/runtime-app/README.md)
