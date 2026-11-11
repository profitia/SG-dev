# PROFITIA — UNIVERSAL PROJECT EXECUTION WRAPPER
## PMOS · Code Routing · Code State · E1/Access · PHR · Observability · Release | v1.2 (OWNER APPROVED — PUBLISHED — ACTIVE)

**Status:** `OWNER_APPROVED / PUBLISHED / ACTIVE`  
**Podstawa:** przyjęty kierunek v1.1 i recenzje v1.2 z 11 listopada 2026 r.; właściciel zatwierdził publikację, a następnie odrębnie aktywację v1.2 jako wspólnego standardu wykonawczego SG2, ARCHITECTURE i SRM.  
**Przeznaczenie:** wspólny wrapper wykonawczy Codex dla zarejestrowanych projektów Profitii, w szczególności `SG2`, `ARCHITECTURE`, `SRM`; z możliwością użycia w `CIC` na podstawie jego odrębnego profilu.  
**Tryb:** `PROJECT-AWARE EXECUTION / OUTCOME FIRST / GOVERNED FULL AUTOPILOT`  
**Źródło standaryzacji:** dotychczasowy `sg2-e1-wrapper.md` i aktywne kanony/adaptery projektów.  
**Cel:** zachować rygor profilo-zależnego PMOS/continuity, PHR, routingu, klasyfikacji kodu, E1, UX/UI, monitoringu i release, eliminując twarde przypisanie zasad do SG2 i dublowanie ich definicji.  
**Zakres dokumentu:** instrukcja zachowania wykonawcy; **nie** jest nowym kanonem, grantem G1, zmianą rejestrów, zgodą na mutację, koszt, nowe zasoby, PR/merge ani deployment.  
**Akceptacja właściciela:** właściciel zatwierdził wcześniejszą wersję v1.1 dnia 11 listopada 2026 r., następnie publikację v1.2 bez aktywacji. Odrębnym poleceniem „aktywuj wrapper” z 11 listopada 2026 r. zatwierdził aktywację niniejszego dokumentu dla SG2, ARCHITECTURE i SRM. Obowiązujące kanony, profile, uprawnienia i polityki continuity zachowują pierwszeństwo; aktywacja nie wyłącza MEMOROS ani nie upoważnia do zmian aplikacji lub środowisk.
**Aktywne źródło:** [profitia/SG-dev · main · Universal Wrapper v1.2](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/profitia-universal-project-execution-v1.2.md), ładowane przez `AGENTS.md` i aktywny manifest. Biblioteka na `docs/codex-wrapper-library-20261110` zawiera zsynchronizowaną kopię.  
**Zakres stosowania:** `SG2`, `ARCHITECTURE`, `SRM`. Business Outcome Engineering v1.1 obowiązuje w obu trybach: konsultacji i wykonania; Full Autopilot v2.0 pozostaje standardem pomocniczym wykonania. CIC zachowuje odrębne źródło instrukcji i nie jest aktywowany przez tę zmianę.
**Zatwierdzone wersje odniesień:** [Business Outcome Engineering v1.1](https://github.com/profitia/SG-dev/blob/0fe00d579b31ad72bb45724e7080afc94a262be1/docs/agent-instructions/business-outcome-engineering-v1.1.md), [Full Autopilot v2.0](https://github.com/profitia/SG-dev/blob/0fe00d579b31ad72bb45724e7080afc94a262be1/docs/agent-instructions/full-autopilot-v2.md) i [UX/UI Design Canon — warunkowo](https://github.com/profitia/SG-dev/blob/0fe00d579b31ad72bb45724e7080afc94a262be1/docs/agent-instructions/ux-ui-design-canon.md). Przy aktywnym użyciu stosuj te utrwalone wersje; źródła gałęziowe w Aneksie B dokumentują pochodzenie.

> **Zasada nadrzędna:** Osiągnij i zweryfikuj cały zaakceptowany rezultat biznesowy, stosując **rzeczywistą konfigurację wybranego projektu**. Myśl autonomicznie; wykonuj autonomicznie tylko dopuszczone operacje. Nie twórz nowego governance ani nie obchodź istniejącego.

---

## 0. Relacja do innych wrapperów i źródeł prawdy

Używaj **jednego wrappera uniwersalnego** do wyboru i zastosowania właściwego profilu wykonawczego; nie traktuj zbioru dokumentów referencyjnych jako kilku niezależnych, konkurencyjnych procedur.

**Tryb BUSINESS CONSULTING / analiza i projektowanie:**
- **BUSINESS OUTCOME ENGINEERING v1.1** jest nadrzędną metodą interpretacji potrzeby, wyboru najlepszego rozwiązania, minimum sufficient diagnosis i wyniku biznesowego. W tym trybie nie stosuj wykonawczego lifecycle do samej rozmowy tylko dlatego, że użytkownik opisuje przyszłe zadanie; wyraźne zarządzane zadania audytowe lub governance stosują swoje rzeczywiste kontrakty.

**Tryb BUSINESS EXECUTION / realizacja zaakceptowanego zadania:**
- **FULL AUTOPILOT — OUTCOME FIRST v2.0** jest pomocniczym standardem prowadzenia autoryzowanego zadania do rezultatu; stosuj go w zakresie niesprzecznym z aktywnym governance. Business Outcome Engineering nadal wyznacza priorytet rezultatu, ale nie jest drugim checklistowym lifecycle PMOS.

**Warunkowo, przy zakresie UX/UI:**
- **UX/UI DESIGN CANON — MagicPath Integration Context** jest wymaganym odniesieniem dla projektowania, modyfikacji, adaptacji lub implementacji interfejsu SG2/SRM i komponentów kanonicznych. Respektuj live binding, klasyfikację `PRODUKT / TYLKO PROJEKT / SYMULACJA`, Global Navigation oraz reguły działania z bieżącej biblioteki. Gdy zadanie nie dotyka UX/UI, oznacz `NOT_APPLICABLE` bez osobnego audytu MagicPath.

**Źródła nadrzędne dla każdej zarządzanej operacji:**
- aktywny **Profitia Mandatory Agent Execution Canon v3.0** (albo jego następca), odpowiednie `AGENTS.md`, aktywny rejestr projektów, manifest, routing, kontrakty i adapter **konkretnego projektu**;
- aktualne polityki bezpieczeństwa, rzeczywiste uprawnienia, mechanizmy preflightu i rozstrzygnięcia ownera — mają pierwszeństwo przed niniejszym wrapperem i standardami pomocniczymi.

Nie stosuj historycznych dokumentów `SUPERSEDED` jako źródła uprawnień. Nie modyfikuj walidatora, by pozornie uzyskać `PASS`. Nie kopiuj procedur PMOS, routingu i E1 do dalszych wariantów wrappera: korzystaj z aktualnego źródła i profilu.

### Referencje aktywne przy opracowaniu v1.2

- `Canon/v3.0-profitia-agent-execution-canon.md`
- `Canon/v1.1-repository-routing-and-module-ownership-canon.md`
- `Canon/v1.0-post-migration-architecture-state-and-change-classification-canon.md` (w zakresie jego obowiązywania)
- `Canon/v1.0-operation-context-and-access-contract.md` i właściwa macierz dostępów (gdy dotyczy)
- `Canon/v1.0-profitia-environment-and-release-promotion-canon.md`
- `Canon/registries/profitia-projects-v1.json`
- `Canon/registries/governance-manifest-v2.json`
- adapter wskazany przez aktywny profil, a nie wszystkie adaptery naraz.

**Repozytoria i załadunek:** dokumenty pomocnicze BOE, Full Autopilot i UX/UI znajdują się obecnie w bibliotece na gałęzi `docs/codex-wrapper-library-20261110`, a nie w `main` SG-dev. Przed operacyjnym wymaganiem ich załadowania potwierdź trwałą, dostępną referencję zatwierdzonej wersji. Nie twierdź, że sam plik na tej gałęzi jest aktywnym kanonem. CIC używa własnego repozytorium i `AGENTS.md`; nie przypisuj jego kodu do SG-dev.

---

## 1. Rozpoznaj tryb pracy, projekt i granice mandatu

1. Ustal z intencji użytkownika, czy trwa **BUSINESS CONSULTING** (analiza/projektowanie) czy **BUSINESS EXECUTION** (autoryzowane wykonanie). Samo pytanie, analiza, akceptacja koncepcji albo publikacja kanonu **nie** upoważniają do implementacji.
2. W trybie wykonawczym ustal `projectKey` na podstawie przyjętego zadania, aktywnego rejestru i rzeczywistego ownership. Dopuszczalne są tylko aktywne, zarejestrowane profile; **nie zgaduj projektu na podstawie nazwy folderu**.
3. Rozpoznaj `TARGET_ENVIRONMENT`, repozytorium authority, branch, workspace, execution host, adapter oraz **czy PMOS i publikacje downstream obowiązują w tym dokładnym środowisku**. Jeżeli obowiązują, odczytaj bazę continuity i politykę z aktywnego profilu; jeżeli nie, zbierz właściwe dowody wydania bez tworzenia PMOS/PHR. Rozbieżności z rejestrem wskaż jawnie; nie zmieniaj polityki samą instrukcją wrappera.
4. Rozdziel: **cel biznesowy**, **zakres zatwierdzonego zadania**, **uprawnienie do konkretnej operacji**, **faktyczną gotowość środowiska**. To różne pojęcia.
5. Gdy projekt, właściciel, środowisko lub uprawnienie są niejednoznaczne, przeprowadź dopuszczoną diagnozę odczytową; **nie** wykonuj ryzykownej mutacji na podstawie domniemania.

### Wiążący mechanizm profili

| Profil | Wybór konfiguracji — nie wpisuj jej na sztywno w wrapper |
|---|---|
| `SG2` | `Canon/adapters/sg2-project-adapter-v1.md` lub następca z rejestru; własny PMOS i właściwy PHR |
| `ARCHITECTURE` | `Canon/adapters/architecture-project-adapter-v1.md` lub następca; własny PMOS i właściwy PHR |
| `SRM` | `Canon/adapters/srm-project-adapter-v2.md` lub następca; własny PMOS i właściwy PHR; odrębna polityka środowisk |
| `CIC` | `Canon/adapters/cic-project-adapter-v1.md` lub następca; odrębne repozytorium; własny PMOS i właściwy PHR |

**Nie przenoś** bazy PMOS, historii, credentiali, usług, kluczy, grantów ani uprawnień z jednego projektu do drugiego. Obowiązki PHR, tożsamość bazy continuity oraz ograniczenia środowiskowe odczytuj za każdym razem z aktualnego rejestru; powyższa tabela jest jedynie wskazówką.

---

## 2. Preflight projektu, źródła i prac równoległych

Przed każdą zarządzaną operacją wykonaj odpowiednie bramki z profilu, `AGENTS.md` i aktywnego kanonu. Dla Development obejmuje to również zarządzany audyt read-only; dla innych środowisk stosuj ich własne obowiązujące gate'y, nie przenoś na nie automatycznie Development PMOS:

1. Załaduj root i właściwe zagnieżdżone `AGENTS.md`, aktywny manifest, dokumenty CORE i dokumenty wybranego projektu w obowiązującej kolejności oraz jego aktualny adapter.
2. Potwierdź prawdziwy `git remote`, repozytorium, branch, HEAD, upstream, divergence, working tree, aktualne `origin/main`, równoległe branch/PR i współdzielone zasoby. Nie opieraj authority na nazwie checkoutu lub IDE.
3. Zadeklaruj **stabilny `taskId`**, profil, właściwy workspace, realne miejsce wykonania, `TARGET_ENVIRONMENT`, zakres, kryteria odbioru i dokładne planowane `target paths`. Oddziel środowisko uruchomieniowe od środowiska docelowego.
4. Wykonaj właściwą walidację manifestu i **pełny wymagany fail-closed preflight**, raportując niezależne gate'y z aktywnego kanonu; nie zastępuj jednego testu ogólnym `PASS`.
5. Najpierw ustal `PMOS_APPLICABILITY` według **profilu + `TARGET_ENVIRONMENT`**. Wyłącznie gdy PMOS jest wymagany, zweryfikuj jego projekt Neon, bazę, endpoint i rolę wskazaną przez profil; samo zgodne `databaseName` nie wystarcza. Gdy nie obowiązuje, nie otwieraj połączenia continuity tylko po to, aby „zaliczyć” check.
6. Uwzględnij LKG i aktywne współbieżne wdrożenia/migracje w zakresie zadania. Użyj izolowanego branch/worktree, zachowaj cudze zmiany.

Obowiązkowe kontrole zachowaj. Poza nimi stosuj **minimum necessary work**: żadnych ponawianych pełnych audytów, jeśli świeży i zakresowo właściwy dowód już istnieje.

---

## 3. Code Routing, Ownership i dokładna lokalizacja zmian

**Przed edycją każdego pliku** przejdź obowiązującą kolejność:

`PROJECT PROFILE → EXACT REPOSITORY → CAPABILITY → LOGICAL OWNER → EXACT TARGET PATH → ARCHITECTURE STATE → AFFECTED DEPLOYMENT`.

- Wybieraj jedno źródło prawdy i jednego ownera dla danej odpowiedzialności; korzystaj z aktualnego routing registry wskazanego przez projekt.
- Przyporządkuj **każdą** planowaną ścieżkę, w tym nowo tworzone pliki i workflow, do zarejestrowanego właściciela. Najbardziej szczegółowa reguła ścieżki wygrywa z regułą ogólną.
- `NO_MATCH`, `CONFLICT`, brak rejestru, niejednoznaczny owner, niewłaściwy profil lub niedopuszczony zapis do legacy → `ROUTING_GATE = BLOCKED` dla tej powierzchni. Nie wybieraj ścieżki według istniejącego importu, adresu URL, nazwy deploymentu lub wygody.
- Nowa **first-class capability**, właściciel, path family albo istotna zmiana routingu wymagają prawidłowej decyzji architektonicznej i rejestracji; sam kod/PR nie tworzy G1.
- Zmiana producenta współdzielonego kontraktu i adopcja w SG2/SRM/CIC pozostają rozdzielonymi zadaniami właściwych ownerów, z własnym PMOS/ciągłością. Wspólny cel biznesowy nie zezwala na pisanie po cudzych ścieżkach.
- Rozszerzenie zakresu o kolejne target paths wymaga ponowienia odpowiednich gate'ów **przed** ich modyfikacją, bez odtwarzania wszystkich niezmienionych testów.

**Nie dubluj** usługi platformowej w konsumentach, jeśli istnieje właściwy producent. Reuse-first jest regułą, nie powodem do obchodzenia ownera.

---

## 4. ACTUAL, Code State i klasyfikacja zmian

Oddziel **cztery wymiary**:

1. **ACTUAL / runtime reality** — potwierdzony stan repozytorium, implementacji, bazy i faktycznie wdrożonego zachowania. `ACTUAL` **nie jest** formalnym baseline path state.
2. **Baseline path state** — klasyfikacja konkretnej ścieżki z rejestru: `ALIGNED` albo `LEGACY` (w zakresie obowiązywania danego kanonu).
3. **Change classification** — np. `TRANSITIONAL`, jeżeli obowiązujący mechanizm klasyfikuje tak zmianę. Nie oznacza ona stanu całej aplikacji, nowego ownera ani ścieżki do zapisu.
4. **Cleanup findings i deployment state** — ostrzeżenia architektoniczne oraz stan/dowód wdrożenia; nie nadają ani ownership, ani zgody na zapis.

**Zasada LEGACY:** `READ FROM LEGACY — WRITE TO CURRENT CANONICAL OWNER`. Legacy nie jest domyślną lokalizacją nowego developmentu. Zapis w LEGACY wymaga dokładnego, uprzednio dopuszczonego `LEGACY_WRITE_EXCEPTION` oraz spełnienia warunków aktywnego kanonu. Nie używaj legacy jako trwałego obejścia architektury.

**ALIGNED** nie wyklucza bardziej szczegółowego override LEGACY. Rozpoznawaj nested paths mechanicznie, nie na podstawie nazwy aplikacji.

Dla source-changing task przygotuj przed mutacją zwięzły zapis gate'u (w formacie wymaganym przez właściwy aktywny kanon):

```text
ARCHITECTURE_STATE_GATE
Project / repository / capability =
Logical owner =
Exact canonical target path(s) =
ACTUAL (verified code/deployment state) =
Baseline path state = ALIGNED / LEGACY / per-active-registry
Nested legacy override = YES / NO
Change classification = TRANSITIONAL / NOT_APPLICABLE / UNRESOLVED
Cleanup finding involved = YES / NO
Legacy consulted = YES / NO
Legacy write exception required / authorized = YES / NO
Affected deployment (impact only) =
ARCHITECTURE_STATE_GATE = PASS / BLOCKED
```

Nie stosuj `ACTUAL / LEGACY / TRANSITIONAL` jako jednego, płaskiego enumu. W CIC i innych profilach korzystaj z ich aktualnej klasyfikacji i nie narzucaj historycznych szczegółów SG2 tam, gdzie nie obowiązują.

---

## 5. PMOS — warunkowa rejestracja, wykonanie, odzyskiwanie i closeout

Stosuj **jedną kanoniczną implementację PMOS** i aktywny lifecycle Profitia Agent Execution Canon, bez forków projektowych. PMOS jest control plane zadań, a **nie** bazą produktu. Nigdy nie wyprowadzaj obowiązku `pmos:begin` z samego faktu, że zadanie dotyczy SG2/SRM/Architecture.

**Warunek stosowalności, ustalany przed rejestracją:**

- `PMOS_APPLICABILITY = REQUIRED` — tylko gdy zarejestrowany profil danego projektu wymaga continuity dla podanego `TARGET_ENVIRONMENT`. Dla SG2, ARCHITECTURE i SRM w aktualnym rejestrze dotyczy to `development`.
- `PMOS_APPLICABILITY = NOT_APPLICABLE` — gdy profil nie obejmuje tego środowiska (dla SG2, ARCHITECTURE i SRM nie rejestruj PMOS przy `staging` ani `production`). Nie wykonuj `pmos:begin`, `pmos:save`, PMOS closeout ani zapisów do PHR/MEMOROS w takim zadaniu. Obowiązują jednak właściwe kontrole wydania i dowody z GitHub, Render, Neon oraz kontraktu środowiska.
- Dla innych profili, w tym CIC, odczytaj bieżącą regułę z rejestru, bez wyciągania analogii.

**Gdy `REQUIRED`:**

1. Wykonaj `pmos:begin` dla stabilnego `taskId` we właściwej bazie PMOS, **po wymaganym preflight i przed zarządzaną pracą**; obejmuje także audyt read-only, gdy profil i kanon tego wymagają.
2. Przekaż prawdziwy stabilny `hostConversationId`, jeśli jest udostępniany; w przeciwnym razie jawnie oznacz jego brak. Nie wymyślaj identyfikatorów. `conversationId` wyprowadza PMOS.
3. Zapis rejestracji obejmuje projekt, zadanie, środowisko, host/workspace, zakres, ścieżki, pierwotne zlecenie i stan gate'ów. Begin nie może zawierać przyszłego sukcesu.
4. Po begin ponów wymagany preflight z `--require-begin` i tą samą tożsamością hosta, jeżeli tak stanowi kontrakt.
5. Wykonuj zadanie i gromadź rzeczywiste dowody. Wznawiaj idempotentnie; nie dubluj już zarejestrowanego zadania.
6. Przeprowadź `pmos:save` i kanoniczny closeout, wraz z **wszystkimi downstream publications wymaganymi przez aktywny profil**, weryfikacją tożsamości, persistencji, readbackiem i zwolnieniem pending slot.
7. Brak obowiązkowej publikacji, awaria zapisu lub niezwolniony pending slot oznaczają nieukończony, odzyskiwalny closeout, nie `SUCCESS`.

Nie przekierowuj PMOS pomiędzy projektami/środowiskami, nie zapisuj continuity w bazach produktu i nie dopisuj VECTOR jako uczestnika lifecycle.

---

## 6. PHR i aktualna polityka publikacji — obowiązkowy dowód, gdy dotyczy

**Reguła wykonawcza:** nie ustanawiaj w wrapperze alternatywnego modelu continuity. Wykonuj dokładnie **wszystkie obowiązkowe publikacje downstream** wynikające z aktywnego kanonu, rejestru projektu i `TARGET_ENVIRONMENT`. Nie wolno zastąpić obowiązkowej publikacji innym artefaktem ani zmienić polityki za pomocą zmiennej środowiskowej.

**Stan obecny w profilu Development (11 listopada 2026, do weryfikacji w aktualnym rejestrze przy wykonaniu):**

| Profil | PMOS | MEMOROS (bieżąca polityka techniczna) | PHR |
|---|---|---|---|
| `SG2` | wymagany | wymagany | wymagany |
| `ARCHITECTURE` | wymagany | wyłączony | wymagany |
| `SRM` | wymagany | wyłączony | wymagany |
| `CIC` | według obowiązującego profilu | wymagany, gdy continuity dotyczy zadania | wymagany, gdy continuity dotyczy zadania |

Ta tabela **nie aktywuje** continuity poza środowiskami, dla których profil je przewiduje. Dla SG2, ARCHITECTURE i SRM przy `staging` i `production` PMOS/PHR nie są rejestrowane; dowód wydania zapewniają właściwe reguły środowiskowe.

**Kiedy `PMOS_APPLICABILITY = REQUIRED`:**

- Zmiana kodu, danych, governance, infrastruktury, deployment lub zaakceptowanej decyzji: wykonaj cały profilowy closeout, w tym PHR i każdego nadal obowiązkowego uczestnika downstream.
- Zwykły audyt read-only: PMOS; publikacja do PHR wyłącznie jeśli audyt ustanawia zaakceptowaną decyzję lub nowy baseline, zgodnie z kanonem.
- PHR musi zawierać właściwy `projectKey`, identyfikatory zadania, istotne PR/SHA, zakres i dowody bez sekretów i prywatnych danych. Potwierdź rzeczywisty zapis i readback/acknowledgement.
- Jeżeli dowolna wymagana publikacja nie powiedzie się, pozostaw closeout nieukończony i odzyskiwalny. Nie deklaruj `PMOS COMPLETE` ani `BUSINESS SUCCESS` przy niespełnionych obligatoryjnych gate'ach.

**Kierunek uproszczenia:** właściciel chce docelowo modelu **PMOS + PHR bez MEMOROS**. Jest to **propozycja przyszłej zmiany governance**, a nie obowiązująca instrukcja wykonawcza. Zakres i warunki zmiany umieszczono w Aneksie B; niniejszy wrapper sam jej nie wprowadza.

---

## 7. E1, Identity, dostęp i własność danych — odpowiednio do wpływu zadania

**PMOS i E1 to niezależne odpowiedzialności.** PMOS rejestruje pracę; E1 kontroluje dopuszczalne operacje na danych i uprawnieniach produktu. Nie narzucaj pełnej procedury E1 dla zmian, które nie dotykają danych/dostępu; zachowaj krótki zapis `NOT_APPLICABLE` z powodem.

Jeżeli zadanie dotyka tożsamości, organizacji, prywatnych danych, źródeł, API, cache, eksportów, jobów, raportów lub uprawnień:

1. Załaduj aktualny Operation Context & Access Contract, access matrix i właściwe kontrakty producenta/odbiorcy.
2. Rozróżnij normę docelową, kod faktycznie istniejący i **adopcję konkretnej operacji** przez dany runtime. Sam dokument ACTIVE nie dowodzi, że konsument już stosuje E1.
3. Ustal klasę danych, właściciela, autora, zakres widoczności (wspólne/platformowe, OrganisationID, UserID), źródło, licencję, retencję oraz właściwe operacje i role.
4. Weryfikuj `UserID`, `OrganisationID` i prawo do operacji po stronie zaufanego backendu według realnej tożsamości i autorytatywnego stanu dostępu. ID z requestu, URL, formularza lub nagłówka nie jest samodzielnym grantem.
5. Zachowaj segregację tenantów oraz prawa we wszystkich dotkniętych API, zadaniach w tle, plikach, cache, telemetrii, bazach i integracjach. Nie obchodź RLS, E1 ani Source admission przez pożyczony klucz, tryb demo lub role uprzywilejowane.
6. Minimalizuj niepotrzebne wywołania Clerk/E1, wykorzystując bezpiecznie nadal ważny kontekst; nie usuwaj koniecznej autoryzacji operacji.
7. Dla testów przygotuj odpowiednie przypadki pozytywne/negatywne, izolację innych użytkowników/organizacji i revocation, proporcjonalnie do wpływu. Funkcjonalny dostęp konta testowego nie znosi granic danych.

Nie zakodowuj stałych ID PORR ani żadnego klienta w reużywalnej capability. Architecture może projektować/utrzymywać E1 jako producent, a SG2/SRM jako konsumenci — ich zadania i routingi pozostają niezależne.

---

## 8. Architektura, ponowne użycie i zakres funkcjonalny

- Domyślnie buduj rozwiązania wielokrotnego użytku, niezależne od pojedynczej organizacji, klienta lub wdrożenia; pierwsza konfiguracja PORR nie definiuje tożsamości technicznej produktu.
- Oddziel pełne możliwości funkcjonalne komponentu, szczegółowe przypisania ról biznesowych i nieprzekraczalne bieżące granice danych/dostępu. Odkładana macierz ról nie oznacza zakończonego odbioru bezpieczeństwa.
- Jeśli istnieje zgodny komponent lub kontrakt, rozbuduj go zamiast tworzyć duplikat runtime, magazynu, connectora, dashboardu lub biblioteki.
- Nie rozciągaj zaakceptowanego zadania na niepowiązane refaktoryzacje, migracje UX, przebudowę kanonów lub poprawki „na przyszłość”.
- Gdy potrzeba producenta i odbiorcy przekracza ownership jednego profilu, wyodrębnij prawidłowe zależne zadania profilowe; **utrzymuj jeden skoordynowany rezultat biznesowy**, nie przejmuj cudzych ścieżek.
- Rzeczywiste braki w kontrakcie lub konieczność nowej capability poddaj właściwemu procesowi decyzji zamiast maskować lokalną protezą.

---

## 9. Observability by Default — monitoring i koszty

Każda nowa lub zmieniana funkcjonalność dziedziczy istniejący, **właściwy dla jej runtime i środowiska** monitoring. Rozszerz go tylko tam, gdzie uzasadnia to realna potrzeba.

- Użyj właściwych istniejących projektów i instrumentacji Sentry oraz zaakceptowanej telemetrii/PostHog, jeśli dotyczą funkcjonalności. Nie kieruj zdarzeń SRM, CIC ani Architecture do projektu Sentry SG2 tylko dlatego, że współdzielą repozytorium.
- Rejestruj istotne błędy techniczne, etapy procesów biznesowych, czas, wynik, źródło awarii, wersję i środowisko. Odróżniaj oczekiwane odmowy/braki danych od awarii; sam HTTP 200 nie dowodzi sukcesu.
- Nowy worker/usługa wymaga potwierdzenia instrumentacji w **swoim** runtime, a nie założenia dziedziczenia monitoringu z monorepo.
- Chroń PII, hasła, tokeny, OTP, cookies, surowe dane finansowe i prywatne requesty przed wysłaniem do logów, PHR, Sentry i PostHog. Stosuj sanitizację, zakresy dostępu i właściwą retencję.
- Monitoring nie powinien blokować funkcji, powodować dodatkowych autoryzacji E1, powielać zapytań płatnych ani istotnie zwiększać latency.
- Potwierdzaj monitoring proporcjonalnie do zmiany. Nie uruchamiaj dodatkowego audytu Sentry przy każdej drobnej poprawce; pierwsza nowa integracja wymaga realnego sygnału w autoryzowanym środowisku.
- Koszty/tokeny/requesty/upstream/cache/retry raportuj według rzeczywistych receipts; `NOT_MEASURED`/`UNKNOWN` nie jest równe `0`.

W handoffie podaj status: `REUSED / EXTENDED / NOT_APPLICABLE / BLOCKED` oraz istotny dowód, jeśli zmiana rozszerzała instrumentację.

---

## 10. UI/UX, MagicPath i kanoniczne wzorce projektowe

**Design Canon First.** Jeżeli zadanie dotyczy tworzenia lub zmiany UI/UX, projektowania interakcji, wdrożenia zatwierdzonego prototypu albo zmiany współdzielonego komponentu wizualnego SG2/SRM, **załaduj i zastosuj** aktualny [UX/UI DESIGN CANON — MagicPath Integration Context](https://github.com/profitia/SG-dev/blob/docs/codex-wrapper-library-20261110/docs/agent-instructions/ux-ui-design-canon.md). Centralnym źródłem kanonicznych wzorców projektowych jest [Kanon SpendGuru w MagicPath](https://www.magicpath.ai/files/460628300646219776). Nie zastępuje on źródła prawdy dla kodu aplikacyjnego, kontraktów danych ani dostępu.

1. **Sprawdź obowiązujący wzorzec przed tworzeniem.** Odczytaj aktualny element biblioteki, jego identyfikator (np. `SRM-Cxx`), warianty, typografię, rozmiary, stany i interakcje. Wykorzystuj istniejący wzorzec, zamiast tworzyć drugi system projektowy.
2. **Projektuj flow, nie tylko wygląd.** Dla nowego lub istotnie zmienianego UX określ odpowiednie scenariusze użytkownika, loading/empty/error/success, zachowanie klawiatury, dostępność, responsywność i integrację z rzeczywistą logiką aplikacji. Nie dokładaj elementów bez potrzeby; zachowuj estetykę, przejrzystość, proporcje i dotychczasowy flow.
3. **Zachowuj rzeczywiste Canon Live Binding.** W MagicPath stosuj powiązane komponenty kanoniczne i warianty, a nie niezależne kopie jedynie podobne wizualnie. Zachowaj identyfikatory oraz metadane używane przez inspektor `CTRL + I`; sprawdzaj rzeczywisty mechanizm współdzielenia i propagacji. Sama wspólna nazwa lub identyfikator w opisie nie dowodzi synchronizacji.
4. **Kwalifikuj niezależnie trzy wymiary:** `UI`, `DANE`, `ZACHOWANIE`. Rozróżnij `PRODUKT / TYLKO PROJEKT / SYMULACJA` zgodnie z odpowiednim rozdziałem kanonu MagicPath. Brak jawnego dopuszczenia oznacza STOP dla przeniesienia elementu do produktu. Nie kopiuj do aplikacji demonstracyjnych requestów, syntetycznych danych, kontrolek projektowych ani atrap backendu.
5. **Respektuj Global Navigation i ownership hosta.** AppShell jest właścicielem nawigacji globalnej SpendGuru; moduły nie tworzą jej duplikatów. Stosuj zaakceptowane wzorce GN oraz zasadę selective placement. Samodzielny SRM zachowuje właściwy dla siebie shell. Nie kopiuj syntetycznej historii nawigacji demonstratora do runtime.
6. **Nie kopiuj bezrefleksyjnie kodu MagicPath.** Projekt jest referencją wyglądu i zachowania, GitHub — źródłem implementacji, kontraktów i autoryzacji. Implementuj w poprawnym profilu/routingu, łącz z prawdziwymi danymi i testuj z uwzględnieniem rozdzielenia producentów i konsumentów.
7. **Proste poprawki nie wymagają obowiązkowej nowej makiety.** Jednoznaczne naprawy błędów, duplikatów UI, theme toggle czy zgodności z istniejącą biblioteką można wykonać bez nowego projektu, po sprawdzeniu odpowiedniego kanonu.
8. **Nowy standard UX/UI wymaga właściwej akceptacji i kanonizacji.** Nie oznaczaj demonstracji jako wdrożonego wzorca i nie deklaruj aktualizacji biblioteki ani synchronizacji projektów bez rzeczywistego potwierdzenia.

Jeżeli zadanie **nie dotyka UI/UX**, oznacz `MAGICPATH_UI_CANON = NOT_APPLICABLE`; nie wykonuj dodatkowego audytu. Jeżeli dostęp do MagicPath jest niedostępny, jasno oznacz ograniczenie, korzystaj wyłącznie z potwierdzonych wzorców i nie twórz fikcyjnej akceptacji ani Live Binding.
---

## 11. Testy, CI i weryfikacja Business Outcome

Dobierz testy do efektu i ryzyka, nie liczby plików:

1. Potwierdź główny scenariusz użytkownika, istotne warianty negatywne, błędy graniczne i dotknięte granice danych/bezpieczeństwa.
2. Testy lokalne, typecheck, build, kontraktowe i CI wykonuj według obowiązujących gate'ów; unikaj zbędnego powtarzania identycznych pozytywnych dowodów dla tego samego SHA, konfiguracji i zależności.
3. Gdy błąd wynika z kodu, napraw przyczynę u ownera i dodaj adekwatną regresję. Nie zmieniaj testów ani kanonów wyłącznie dla zielonego PASS.
4. Dla nowych integracji sprawdź reprezentatywny scenariusz na rzeczywistych, dopuszczonych źródłach; syntetyczny fixture nie zastępuje LIVE.
5. Oddziel `CODE READY`, `CI PASS`, `DEPLOYED`, `RUNTIME VERIFIED` od `BUSINESS OUTCOME VERIFIED`.
6. Nie kończ po PR, CI, migracji, przygotowanej infrastrukturze albo samym `ready`, jeżeli mandat obejmuje faktycznie działający rezultat.

---

## 12. Deployment, równoległa praca, LKG i rollback

- Zawsze wyznacz właściwy projekt, środowisko, usługę i konkretny source SHA. Branch, nazwa usługi i adres URL nie są same w sobie dowodem uprawnień do środowiska.
- Nie dotykaj Staging/Production bez dokładnego, aktualnego upoważnienia i zgodnej topologii projektu. Development nie daje mandatu do promocji; w zadaniach Staging/Production zamiast PMOS/PHR stosuj wymagane release evidence.
- **Przed każdym deploymentem, nie tylko ryzykownym**, ustal i zweryfikuj Last Known Good lub — przy pierwszym wdrożeniu — jawnie udokumentowany brak poprzedniej wersji wraz ze sposobem bezpiecznego przerwania i usunięcia skutków nieudanego startu. Dla istniejącego LKG potwierdź poprzedni działający SHA, identyfikator i digest zachowanego artefaktu, zgodność konfiguracji bez sekretów, stan migracji i praktycznie wykonalny sposób odtworzenia. Szczegóły stosuj według aktywnego kanonu wydania; sam SHA nie jest kompletnym LKG.
- Dla zmian danych zapewnij wymagany backup/snapshot/branch i ocenę odwracalności; nie cofaj automatycznie nieodwracalnych migracji ani wspólnej bazy, nie nadpisuj cudzych danych.
- **Owner-only resources:** nowe repozytoria/projekty GitHub oraz nowe projekty, usługi i bazy/zasoby Render i Neon objęte aktywną zasadą tworzenia przez właściciela **tworzy właściciel**, nie agent. Agent może w dozwolonym zakresie przygotować konfigurację, instrukcję utworzenia, skrypty i późniejszą weryfikację, ale sama akceptacja projektu nie deleguje prawa do stworzenia owner-only zasobu. Każdą dopuszczalną zmianę istniejących zasobów rozstrzygaj według aktualnego kanonu i dokładnego grantu.
- Równoległy development jest normalnym stanem. Przed mutacją współdzielonych zasobów sprawdź aktualną podstawę oraz kolejkę PR, deploymentów i migracji; nie wykonuj force push, global reset, destrukcyjnego restore ani nieautoryzowanej konkurencyjnej migracji.
- Weryfikuj faktycznie uruchomioną wersję, logi i scenariusz biznesowy. W razie regresji zatrzymaj propagację, napraw najwęziej albo wróć do prawidłowo autoryzowanego LKG. Nie nadpisuj nowszej wersji innego zadania.

---

## 13. Zgody, STOP CONDITION i autonomia

- **A — rutynowa technika w przyjętym zakresie:** podejmij decyzję i wykonaj ją bez pytania (w tym odpowiednie poprawki, testy, PR oraz merge/deploy, jeśli dokładnie autoryzowane).
- **B — istniejące ważne dopuszczenie:** wykorzystaj je dokładnie w jego zakresie; nie proś ponownie o tę samą zgodę.
- **C — nowy istotny mandat:** nie domniemuj prawa do zmiany ownera, grantów E1/Source, licencji, sekretów, kosztów, nowych zasobów, zakresu projektu, środowiska ani nieodwracalnych operacji. Przygotuj jedną skonsolidowaną, konkretną decyzję.

STOP dotyczy **konkretnej ryzykownej operacji i jej zależności**, nie automatycznie całego programu. Zabezpiecz stan, zachowaj dowody, kontynuuj niezależne dozwolone prace. Nie obchodź `BLOCKED` alternatywnym kontem, bezpośrednim HTTP, starszym wrapperem ani zmianą ścieżki.

Etapy organizacyjne nie są obowiązkowymi punktami ponownej akceptacji, jeśli mandat i dopuszczenia już obejmują przejście dalej.

---

## 14. Zakończenie i wymagany raport

Status `SUCCESS` wymaga łącznie:

- **Business Outcome Verified** — rzeczywistego rezultatu i reprezentatywnego testu w dopuszczonym zakresie;
- wymaganych gate'ów, testów, routingu/Code State, kontroli bezpieczeństwa i dotkniętych kontraktów;
- faktycznej integracji/release do właściwego środowiska, gdy to objęte mandatem, oraz readbacku aktualnego SHA/runtime i danych/telemetrii;
- LKG/recovery tam, gdzie wymagają tego charakter zmiany i polityka release;
- **gdy `PMOS_APPLICABILITY = REQUIRED`**: poprawnego PMOS closeout i wszystkich obligatoryjnych publikacji downstream (w tym PHR, gdy wymagany), z potwierdzonym readbackiem;
- **gdy `PMOS_APPLICABILITY = NOT_APPLICABLE`**: właściwego dowodu wykonania lub promocji z GitHub/Render/Neon i wymaganych kontroli środowiska, **bez** nieprawidłowego uruchamiania PMOS/PHR.

Raport końcowy: `SUCCESS / PARTIAL / BLOCKED`, wynik dla użytkownika, profil i środowisko, istotne PR/merge/SHA/deploy, wynik testu rzeczywistego kontra syntetycznego, routing/Code State (gdy dotyczy), monitoring, koszt (jeśli mierzony), `PMOS_APPLICABILITY`, adekwatne potwierdzenia continuity **albo** release, i rzeczywiste ograniczenia. Nie myl zakończonej dokumentacji lub CI PASS z ukończoną funkcjonalnością.

---

## 15. Granice przyszłej standaryzacji

Ten wrapper **wyłącznie unifikuje wykonanie** w istniejących projektach. Nie projektuje nowego procesu odkrywania potrzeb biznesowych, szablonu kanonu ani standardu tworzenia nowych capability. Te zagadnienia pozostają osobnym zadaniem.

**Zasada końcowa:** `BUSINESS OUTCOME FIRST · CORRECT PROJECT/ENVIRONMENT PROFILE · CODE ROUTING & STATE · E1 WHERE APPLICABLE · PROFILE-REQUIRED CONTINUITY OR RELEASE EVIDENCE · VERIFIED DELIVERY`.

---

## Aneks A — krótki preflight kontrolny (nie dodatkowa procedura)

- [ ] Wybrany tryb `CONSULTING / EXECUTION`; przy wykonaniu ustalony mandat i właściwy pomocniczy Full Autopilot.
- [ ] Aktywny `projectKey`, profil, adapter, repozytorium authority i `TARGET_ENVIRONMENT` ustalone z rejestru.
- [ ] `AGENTS.md`, wymagane kanony i manifest załadowane, właściwe gate'y oraz routing target paths sprawdzone.
- [ ] Rozdzielono ACTUAL, `ALIGNED/LEGACY`, klasyfikację `TRANSITIONAL` i stan deploymentu; legacy write wyłącznie z dopuszczonym wyjątkiem.
- [ ] Ustalono `PMOS_APPLICABILITY = REQUIRED / NOT_APPLICABLE` **na podstawie profilu i środowiska**.
- [ ] Jeśli `REQUIRED`: właściwe projekt/baza/endpoint/rola PMOS, `pmos:begin` i wymagany preflight; po pracy closeout i wszystkie publikacje zgodne z aktywnym profilem.
- [ ] Jeśli `NOT_APPLICABLE`: bez PMOS/PHR continuity; zamiast tego właściwe gate'y i dowody release (GitHub/Render/Neon), jeśli dotyczy.
- [ ] Wpływ na Identity/E1, Source, dane i licencje określony lub uzasadnione `NOT_APPLICABLE`.
- [ ] Przy UX/UI załadowano aktualny kanon MagicPath, zweryfikowano reużycie i klasyfikację PRODUCT/DESIGN/SIMULATION; w innym przypadku `NOT_APPLICABLE`.
- [ ] Przed **każdym deploymentem** potwierdzono LKG albo prawdziwy przypadek first deployment; zakres owner-only zasobów pozostaje u właściciela.
- [ ] Po wykonaniu potwierdzono rzeczywisty rezultat, release SHA/runtime oraz obowiązkowe dowody, bez fikcyjnego sukcesu.

---

## Aneks B — źródła, migracja i zamierzona zmiana polityki (informacyjny)

### B.1. Źródła dokumentacyjne

- Business Outcome Engineering v1.1: https://github.com/profitia/SG-dev/blob/docs/codex-wrapper-library-20261110/docs/agent-instructions/business-outcome-engineering-v1.1.md
- Full Autopilot — Outcome First v2.0: https://github.com/profitia/SG-dev/blob/docs/codex-wrapper-library-20261110/docs/agent-instructions/full-autopilot-v2.md
- UX/UI Design Canon — MagicPath: https://github.com/profitia/SG-dev/blob/docs/codex-wrapper-library-20261110/docs/agent-instructions/ux-ui-design-canon.md
- SG2/E1 — wcześniejszy wrapper: https://github.com/profitia/SG-dev/blob/docs/codex-wrapper-library-20261110/docs/agent-instructions/sg2-e1-wrapper.md
- SRM/E1 — wcześniejszy wrapper: https://github.com/profitia/SG-dev/blob/docs/codex-wrapper-library-20261110/docs/agent-instructions/srm-e1-wrapper.md
- Agent Execution Canon v3.0: https://github.com/profitia/SG-dev/blob/main/Canon/v3.0-profitia-agent-execution-canon.md
- Rejestr profili: https://github.com/profitia/SG-dev/blob/main/Canon/registries/profitia-projects-v1.json
- Environment & Release Canon: https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-profitia-environment-and-release-promotion-canon.md

**Status źródeł:** biblioteka `docs/agent-instructions` istnieje na gałęzi `docs/codex-wrapper-library-20261110`. Przy publikacji i aktywacji trzeba rozstrzygnąć jej trwałą lokalizację/wersjonowanie, przejść obowiązujące bramki i potwierdzić realną dostępność dla agentów. Sam URL na gałęzi dokumentacyjnej nie stanowi rejestracji w aktywnym governance `main`.

### B.2. Migracja istniejących wrapperów

Po osobnej akceptacji wersji v1.2 i prawidłowej publikacji można zastąpić wspólną treść SG2/E1 i SRM/E1 nowym wrapperem; stary plik może zostać krótkim selektorem odpowiedniego `projectKey`. Nie usuwaj aktywnego wrappera ani nie przekierowuj wykonywanych zadań bez zgodnego procesu wdrożenia dokumentacji. Nie modyfikuj adapterów i rejestrów przy samej publikacji tekstu.

### B.3. Zamierzone uproszczenie PMOS + PHR — jeszcze nieobowiązujące

Właściciel wskazał docelowy model **PMOS + PHR bez MEMOROS**. W bieżącym governance `SG2` i `CIC` nadal wymagają MEMOROS dla zadań, w których stosuje się continuity, a `ARCHITECTURE` i `SRM` mają ten uczestnik wyłączony. Uproszczenie wymaga osobnego, jawnie zatwierdzonego zadania we właściwym profilu/ownerze: aktualizacji kanonu wykonania, profili i adapterów w razie potrzeby, wykonalnej implementacji PMOS i closeout, testów pozytywnych/negatywnych oraz potwierdzonej publikacji na aktywnym źródle. **Do tego czasu nie wyłączaj wymaganego uczestnika i nie deklaruj, że PHR go zastępuje.**

Aneks A jest checklistą stosowania reguł, aneks B nie tworzy uprawnień ani nowych bramek. Oba aneksy są integralną częścią pliku wrappera.
