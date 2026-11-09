# ADR-001 — Assistant Context Gateway: wspólna warstwa integracji kontekstowej SpendGuru

**Data decyzji kierunkowej:** 2026-11-09 (Europe/Warsaw)  
**Status:** `OWNER_DIRECTION_APPROVED / DOCUMENTATION_ONLY / NOT_RUNTIME_ADMITTED`  
**Rodzaj:** Architecture Decision Record (ADR), **nie nowy kanon** i nie amendment zastępujący CIC v1.1  
**Właściciel logiczny proponowanej capability:** Architecture Platform (`SG-dev`), z uwzględnieniem obowiązującego routingu  
**Authority dokumentacyjna po przyjęciu:** `profitia/SG-dev`, `main`; proponowana ścieżka: `Canon/proposals/assistant-context-gateway-adr-001-v1.md`  
**Powiązanie normatywne:** [CIC — Assistant Context & Capability Integration Amendment v1.1](https://github.com/profitia/conversational-intelligence-core/blob/main/docs/Assistant-Context-and-Capability-Integration-Amendment-v1.1.md) (przyjęty w CIC PR #18 dnia 2026-11-07)  
**Powiązana inwentaryzacja:** [`Canon/proposals/assistant-context-gateway-integration-inventory-2026-11-09.md`](./assistant-context-gateway-integration-inventory-2026-11-09.md)  
**Stan faktyczny:** nie istnieje potwierdzony, kompletny produkcyjny przepływ konwersacyjny SG2 z K1–K6; ten ADR nie jest dowodem wdrożenia.

## 1. Cel i problem, który rozstrzygamy

Asystent SpendGuru ma rozmawiać z użytkownikiem w oparciu o wiedzę ogólną i procurement (K1–K2), dane rynkowe (K3), wiedzę organizacji (K4), osobistą wiedzę użytkownika (K5) oraz aktywny ekran (K6). Informacje te pochodzą od odrębnych producentów: Benchmark Finder/Market Data/Forecast, X-Ray/SRM, Newsfeed, Economic Calendar, Procurement Insights, Identity, a docelowo z autoryzowanych źródeł osobistych.

**Decyzja:** potrzebna jest jedna wspólna **logiczna** granica dostarczania kontekstu, nazwana roboczo `Assistant Context Gateway` (ACG). **Nie przesądza to stworzenia osobnej aplikacji, bazy lub serwisu Render.** ACG ma koordynować uprawnione odczyty i zbudować spójną projekcję źródeł dla rozmowy; nie ma kopiować danych właścicieli ani przejmować funkcji CIC.

## 2. Granice i właściciele — bez zmiany istniejących kanonów

| Warstwa | Odpowiedzialność | Czego nie przejmuje |
|---|---|---|
| **Platform AppShell / SG Runtime** | Jeden UI asystenta, aktywny moduł, widok i jego migawka; host sesji i wykonanie HTTP/BFF w przyjętej implementacji | Danych domenowych producentów i polityk rozmowy CIC |
| **CIC (osobne repozytorium)** | Rozumienie pytania, polityka rozmowy, dobór semantycznie potrzebnego kontekstu, interpretacja i testy odpowiedzi | Sekretów API, autoryzacji E1, bezpośrednich prywatnych baz i hostingu SG Runtime |
| **Assistant Context Gateway (logiczna capability Architecture Platform)** | Techniczne planowanie dostępu z polecenia CIC/hosta, kierowanie do wersjonowanych read adapterów, agregacja i minimalizacja danych, provenance/freshness i statusów | Własności źródeł, licencji providerów, scoringu ryzyka, prognoz i generowania tekstu |
| **Producenci danych** | Własne read API, uprawnienia do rekordu, projekcje, wersje, semantyka, jednostki, historia | Wspólnej konwersacji, globalnego profilu AI |
| **Identity / E1 / Package & Limits** | Zaufana tożsamość, aktualne prawa, admission, rozliczenie kosztów | Alternatywnego, lokalnego silnika uprawnień ACG |
| **Platform Source Hub** | Zewnętrzne pobieranie danych i licencje, provider admission, transport i źródłowe receipts | Screen Context, konwersacji, łączenia wewnętrznych domenowych projekcji |

ACG jest **logicznie równorzędny względem Source Hub**, ale używa jego dopuszczonych kontraktów wtedy, gdy potrzebna jest nowa akwizycja danych zewnętrznych. Nie powstaje drugi Source Hub. CIC nie zostaje przeniesiony do `SG-dev`, a pakiety CIC nie stają się wykonawcą infrastruktury SG2.

## 3. Topologia i docelowy przebieg

Rekomendowana pierwsza forma: współdzielony pakiet backendowy `packages/assistant-context-gateway/` z osobnym, wersjonowanym kontraktem `packages/assistant-context-contracts/`, wykonywany w istniejącym `apps/sg-runtime` w obrębie jego zaufanej granicy serwerowej. **To proponowane ścieżki dla przyszłej implementacji, nie istniejące ani przyjęte G1 powierzchnie kodu.** Przed utworzeniem katalogów Code Owner/Architecture musi potwierdzić właściwy routing i dopuszczenie nowej capability.

Przepływ na potrzeby pojedynczej wiadomości:

```text
Użytkownik / AppShell
  -> wiadomość + conversationRef + referencja do snapshotu aktywnego widoku
SG Runtime / asystent BFF
  -> zaufana tożsamość, aktualna sesja, E1, produkt i budżet
CIC — semantyczny Context Plan (jakiej wiedzy potrzeba, nie uprawnienie)
  -> ACG — walidacja planu i wywołanie minimalnych wersjonowanych read tools
  -> producenci API (Benchmark/Forecast, SRM/X-Ray, Newsfeed, ECR, Insights, Profile)
  -> zweryfikowane fragmenty z provenance, asOf, wersją, jednostką i stanem dostępu
SG Runtime / model executor
  -> kontrolowany OpenAI call, metering, streaming, recheck kontekstu
  -> odpowiedź z referencjami i historią pod prawidłowym zakresem
```

CIC określa **co** jest potrzebne do odpowiedzi; ACG wykonuje **jak i skąd** można bezpiecznie odczytać te informacje. Nie każdy prompt wymaga wszystkich warstw K1–K6. Nie przenosić wielkich zestawów danych i historii do modelu „na zapas”.

## 4. Minimalna granica kontraktowa — nie zamrożone DTO

Docelowy wersjonowany kontrakt, do opracowania przy implementacji, powinien nieść:

1. **Żądanie:** `conversationRef`, `turnRef`, typ intencji/kontekstu, wybrane `sourceModule/viewId`, referencję snapshotu, wybrane referencje encji/okres/filtry i budżet/limit. Identyfikatory klienta nie są dowodem uprawnienia.
2. **Zaufane wykonanie:** scope zweryfikowany przez host (UserID, opcjonalne OrganisationID, account scope, environment, application, operacja/E1, uprawnienia, ważność), przekazany jako kontrolowany kontekst wykonania, a nie dowolny JSON w body.
3. **Odpowiedź źródłowa:** `sourceType`, `sourceRef`, `sourceVersion`, `subjectRef`, `asOf/observedAt/publishedAt`, zakres i jednostki, `dataClassification`, status licencji/przydatności, `retrievalStatus` (`OK`, `EMPTY`, `PARTIAL`, `DENIED`, `UNAVAILABLE`, `STALE`), referencje pozwalające zweryfikować cytowania.
4. **Kontrola skali:** ograniczenia ilościowe i czasowe, deadline, deduplikacja, ranking względem pytania, brak danych zamiast wymyślonej wartości, odrębne statusy źródłowe.
5. **Ślad:** identyfikatory wersji, użytych narzędzi, kosztu i decyzji autoryzacyjnych bez przechowywania sekretów ani pełnej treści w telemetryce.

Nazwy pól w tym ADR są semantycznym szkicem — **nie tworzą aktywnego API, operation ID ani E1 grantów**. Finalny typowany kontrakt musi zostać przyjęty przez producentów i konsumenta w ich własnych ścieżkach.

## 5. Kontekst ekranu, historia i proaktywność

- Kontekst K6 pochodzi z ustrukturyzowanych projekcji danych **pod wizualizacją**, nie ze screenshotów, OCR ani DOM. Snapshot jest związany z konkretną turą; należy ponownie zweryfikować rekord, zakres, wersję i uprawnienie przed użyciem oraz przed wyświetleniem opóźnionej odpowiedzi.
- Historia konwersacji należy do **osobnego kontraktu i polityki CIC/hosta**; ACG nie staje się trwałym magazynem transkryptów, nie łączy rozmów pomiędzy organizacjami ani nie dubluje danych źródłowych. Retencja K5 i izolacja prywatnych źródeł wymagają właściwych decyzji.
- Powiadomienia proaktywne to **osobny tor**: zdarzenie producenta/outbox → ocena istotności, deduplikacja i obowiązujące uprawnienia → prywatny inbox → UI asystenta. Samo wejście na ekran lub nowa wiadomość nie powinny automatycznie inicjować płatnego model call.
- Do analiz źródłowych podawać datę i pochodzenie oraz odróżniać `AS_PUBLISHED` od `LATEST`. Źródła zewnętrzne są danymi, a nie instrukcjami dla modelu.

## 6. Co świadomie odkładamy

Nie zatwierdza się: osobnego service Render, nowej bazy, niezależnego auth, modeli embeddingów/RAG, kopii danych z SRM lub Insights, nowych licencji/sekretów, konkretnych operacji E1, katalogów implementacyjnych ani uruchomienia OpenAI. Skalowanie ACG do osobnego runtime wolno rozważać **dopiero** przy konkretnych potrzebach (izolacja, wielu konsumentów, niezależne SLA lub deployment).

Alternatywy odrzucone na tym etapie:

- **Bezpośrednie indywidualne integracje CIC z każdym producentem:** mnożenie adapterów, różnych polityk audytu/retencji i punktów awarii; trudniejszy rozwój wspólnego asystenta.
- **Wykorzystanie Source Hub jako uniwersalnego kontekstu:** błędne rozszerzenie właściciela od pozyskiwania danych zewnętrznych do prywatnych danych biznesowych i UI.
- **Samodzielny centralny serwis + centralna kopia danych od pierwszego dnia:** zbyt wiele infrastruktury i ryzyko naruszenia ownership przy braku dowodu skali.

## 7. Warunki wejścia do implementacji i publikacji

- Wersjonowane read kontrakty i ownership rzeczywistych producentów, oddzielne ich przyjęcie i wymagane E1.
- Pierwszy przyrost: **działająca Analytical Conversation + streaming i historia**, a następnie snapshot K6 i uprawnione adaptery Benchmark/Forecast, SRM/X-Ray i Newsfeed. ECR i Insights tylko po uruchomieniu ich odpowiednich backendów.
- Testy należy koncentrować na rzeczywistych granicach: zmiana konta/organizacji, cofnięcie uprawnień w trakcie streamingu, niedostępność źródła, złe jednostki/wersja, dane zastąpione, brak rozliczonego kosztu i odmowa ujawnienia między użytkownikami.
- Dokumentacja nie zastępuje dowodu LIVE: `KOD`, `DB`, `DEPLOY`, `E2E` są odrębnymi statusami.
- **Niniejsza zgoda pozwala na dokumentacyjne przyjęcie i publikację ADR oraz inwentaryzacji, nie na G1 nowych ścieżek, migracje, wywołania zewnętrzne, nowe granty ani deployment.** Obowiązujące checki i routing są zachowane.

## 8. Reguła jednego źródła prawdy i odniesienia

Nie powtarzać w kolejnych ADR-owych wersjach normatywnych treści istniejących kanonów. Zamiast tego stosować odesłania:

- [CIC v1.1, §§3–4, 7–13, 15](https://github.com/profitia/conversational-intelligence-core/blob/main/docs/Assistant-Context-and-Capability-Integration-Amendment-v1.1.md): polityka K1–K6, dobór kontekstu, uprawnienia, snapshot i testy.
- [AppShell v1.0, §§3, 9](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-platform-appshell-business-and-architecture-canon.md): jeden UI i właściciel widoku.
- [Source Hub v1.0](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-platform-source-hub-business-and-architecture-canon.md): licencje, adaptery zewnętrzne, provenance.
- [Procurement Insights unified v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-procurement-insights-unified-product-and-assistant-amendment.md): Newsfeed/raporty i komunikacja z CIC.
- [E1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-operation-context-and-access-contract.md), [Package & Limits](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-profitia-package-and-limits-management-canon.md), [routing](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-repository-routing-and-module-ownership-canon.md): odpowiednio access, metering, ownership.
- [Inwentaryzacja 2026-11-09](./assistant-context-gateway-integration-inventory-2026-11-09.md): fakty kodu, dostępności, luki i odczyt środowisk. Aktualizować z datą i SHA; **nie używać jej jako zamiennika kanonu**.

**Zasada:** jeden temat ma jeden dokument normatywny. ADR zapisuje tylko brakującą decyzję o granicy ACG; inwentaryzacja opisuje fakty. Dokumenty nie modyfikują przyjętego CIC v1.1.
