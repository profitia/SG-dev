# SpendGuru — Development & Release Optimization
## Projekt kanonu rozwiązania i zasad realizacji | v0.3 — zaakceptowany do publikacji

| Pole | Wartość |
| --- | --- |
| Status | **OWNER_APPROVED_FOR_PUBLICATION / NOT_ACTIVE** — decyzja właściciela z 21.11.2026 |
| Data wersji | 2026-11-21 |
| Profil prowadzący | **ARCHITECTURE** |
| Profile współpracujące | SG2, SRM; inne wyłącznie przy rzeczywistym wpływie i zgodnie z routingiem |
| Repozytorium bieżącej pracy | `profitia/SG-dev` (`main`; repozytorium obecnie na koncie osobistym GitHub) |
| Rodzaj dokumentu | Projekt kanonu konkretnego rozwiązania; **nie** nowelizacja istniejących obowiązujących polityk |
| Dokument wykonawczy / backlog | [Karta Projektu v0.3](bsdc/ARCHITECTURE/spendguru-development-release-optimization.md) |
| Podstawa AS-IS | [SpendGuru-audyt-AS-IS-2026-11-21.md](https://github.com/profitia/spendguru/blob/7d10fec73cd69194523b320faf397982d9a8fd04/docs/audits/2026/11/21/SpendGuru-audyt-AS-IS-2026-11-21.md) (`ASIS-REF-01`, SHA-256 `5ee32757fe85896ab14089bd936f41a8c0fd283db67b672a60d8427a49e40683`) · prywatne repozytorium, SHA-256 potwierdzony po ponownym odczycie |
| Metoda | **BOE v1.1 i robocza Karta inspirowana BSDC v1.1** (DEC-01, decyzja właściciela z 21.11.2026). |

> **Zasada nadrzędna:** usprawnić cały przepływ od zaakceptowanego zadania do rzeczywiście działającej i odebranej zmiany w Development, zachowując niezależną weryfikację, prawa dostępu, izolację organizacji, audytowalność i możliwość odzyskania. Usprawnianie developmentu nie powinno samo bez uzasadnienia wstrzymywać developmentu.

## 1. Cel biznesowy i granice

Projekt ma ograniczyć czas, liczbę niepotrzebnych operacji i obciążenie właściciela przy zwykłych poprawkach i rozbudowie funkcjonalności SpendGuru. Obejmuje: mandaty i zachowania agentów, przepływ PMOS/PHR, CI i dowody, dopuszczanie Source, integrację, kontrolowane wydania oraz odbiór SG2/SRM. Projekt dotyczy **procesu**, nie nowej funkcji użytkowej.

**Poza zakresem:** wdrażanie nowych funkcjonalności biznesowych SG2/SRM jako takich; naprawianie obecnych zgłoszeń Identity/Onboarding/Finder w ramach tego projektu; przejęcie prac równoległych; przenoszenie repozytoriów lub zasobów na organizację GitHub; ustanawianie organizacji, nowych grantów, usług, kosztów lub zmiana widoczności repozytoriów.

**Późniejszy, osobny projekt:** **po zamknięciu niniejszej optymalizacji** planowana jest migracja SpendGuru z konta osobistego GitHub do konta organizacji. Migracja ma własny mandat, scope, zamrożenie wdrożeń, plan przełączenia i odbiór. Nie jest etapem, taskiem ani warunkiem ukończenia obecnego projektu. Rozwiązania wprowadzane teraz muszą być przygotowane do jej późniejszego wykorzystania.

## 2. System źródeł i hierarchia

1. Aktywne kanony, profil projektu, manifest, `AGENTS.md`, routing/ownership, źródła kodu, realne prawa providera i wymagane mandaty mają bezwzględne pierwszeństwo nad niniejszym projektem do chwili jego odrębnego przyjęcia i aktywacji odpowiednimi ścieżkami.
2. **AS-IS BASELINE (2026-11-21)** to historyczne źródło danych, nie normatywny zestaw reguł. Ustalenia późniejsze zapisuje się jako datowane dodatki; nie nadpisuje się wyniku pomiaru. Zamrożona wersja jest identyfikowana przez `ASIS-REF-01` oraz SHA-256 w metryce. Przed publikacją potwierdzono zgodność zawartości po odczycie z pełnego SHA commita wskazanego w metryce.
3. **Karta Projektu** jest jedynym backlogiem, roadmapą, rejestrem decyzji i statusów realizacji tej inicjatywy; nie zastępuje PMOS, MEMOROS ani PHR. Dowody referencjonuje, zamiast przepisywać.
4. **Kanon rozwiązania** definiuje docelowe granice i kryteria. Po publikacji pozostaje nadrzędnym opisem rozwiązania tylko w zakresie, w którym jest zgodny z aktywną hierarchią. Każda zmiana obowiązujących polityk wymaga osobnego poprawnego przyjęcia.
5. Obowiązujące instrukcje startowe: [Business Outcome Engineering v1.1](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/business-outcome-engineering-v1.1.md), [Universal Project Execution v1.2](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/profitia-universal-project-execution-v1.2.md), [Full Autopilot v2](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/full-autopilot-v2.md), [Mandatory Agent Execution Canon v3](https://github.com/profitia/SG-dev/blob/main/Canon/v3.0-profitia-agent-execution-canon.md), [BSDC v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md).

## 3. Dwa niezależne wymiary klasyfikacji

### 3.1. `DEVELOPMENT_IMPACT` — wpływ optymalizacji na ciągłość prac

| Klasa | Znaczenie | Reguła planowania |
| --- | --- | --- |
| **A — NON_BLOCKING** | Możliwe wdrożenie bez wstrzymania równoległych prac lub wydań | Quick win; mały odwracalny zakres; sprawdzenie konfliktów przed każdą mutacją |
| **B — SCOPED_RESTRICTION** | Czasowo ograniczony merge/release dla konkretnej ścieżki, workflow, usługi lub wspólnego kontrolera | Jawne okno, określony blast radius, właściciel, kryteria wznowienia i rollback; inne prace trwają niezależnie |
| **C — GLOBAL_FREEZE** | Bezpieczne wykonanie wymaga zatrzymania integracji/wydań całego dotkniętego zakresu SpendGuru | Tylko z dowodu konieczności i odrębnej decyzji właściciela; brak obowiązkowych tasków C na starcie |

Klasa nie jest licencją na operację: A nadal może wymagać zgody na zapis chroniony, B nie zawsze oznacza wyłączenie developmentu, C nie oznacza automatycznie zatrzymania produkcji użytkowej.

### 3.2. `SECURITY_RISK` — ryzyko treści zmiany

| Klasa | Przykłady | Minimalna zasada |
| --- | --- | --- |
| **R1** | Tekst, ikona, odstępy w niechronionym widoku, bez wpływu na zachowanie i uprawnienia | Zaufana klasyfikacja, adekwatna regresja, rzeczywisty odbiór |
| **R2** | Zwykła logika funkcjonalna w istniejącej granicy dostępu | Testy zmienionego zachowania i odpowiedniego konsumenta |
| **R3** | Współdzielone pakiety/kontrakty, build/runtime, konfiguracja wydaniowa, zależność usług | Niezależne dowody producenta i odbiorców, plan release i recovery |
| **R4** | Identity, role, tenant isolation, granty, sekrety, governance/trust, nieodwracalne migracje danych | Szczególna decyzja właściciela, niezależna kwalifikacja, pełne wymagane kontrole |

Obie klasy są przypisywane **oddzielnie**: np. zmiana kontrolera może być `B/R4`; czysto prezentacyjna korekta `A/R1`. O ryzyku decyduje skutek i zależności, nie wyłącznie katalog pliku. Przy niepewności stosuje się bezpieczniejszą kwalifikację i jawne rozstrzygnięcie. Dla wdrożenia ocenia się osobno zmianę produktu i każdą operację wydaniową. Poprawka R1 może wymagać wydania obejmującego operację R3 lub R4.

## 4. Zasady docelowe

### P-01. Najpierw istniejące uprawnienia, nie nowe dokumenty
Sprawdzamy, co obecne Canon v3, BOE, Universal Wrapper i Full Autopilot **już pozwalają** wykonać. Nie tworzymy nowej bramki ani nie prosimy o ponowną zgodę na czynność prawidłowo objętą ważnym mandatem. Nowe uprawnienie wymaga odrębnej właściwej decyzji; wrapper nigdy nie zastępuje grantu.

### P-02. Rozróżnienie bramek i dobrych praktyk
Każdy wymóg wykonawczy ma być sklasyfikowany jako: **obowiązkowy kontroler**, **warunek mandatu**, **zależność techniczna** lub **rekomendacja**. Jedynie pierwsze trzy mogą blokować wynik, zgodnie z aktywną polityką; rekomendacji nie przekształca się w nieformalny dodatkowy GO.

### P-03. Preflight oparty na zmianie wejścia
Tożsamość zadania, zakres, ownership i źródła dowodu ustala się raz, a nie na nowo w każdej wiadomości. **Przed merge i deploymentem ponownie sprawdza się** HEAD, ważność mandatu, stan źródła i środowiska, równoległe operacje, LKG oraz warunki wymagane przez politykę. Zmiana istotnych wejść unieważnia zależne dowody.

### P-04. Jedna kanoniczna mapa dowodów
Dla jednego zadania prowadzimy referencje do rzeczywistych `taskId`, PR, source SHA, proof run/attempt/artifact, decyzji, `main` SHA, deploy i wyników odbioru. PMOS/PHR korzystają z tych samych identyfikatorów. Nie likwiduje się obowiązkowej publikacji ani nie ustanawia nowego nieautoryzowanego magazynu.

### P-05. Rozdzielamy przyczynę CI od stanu dowodu
`WAITING_FOR_TRUSTED_EVIDENCE` (stan logiczny), błąd testu produktu, błąd infrastruktury i odmowa security nie są równoznaczne. Dowód dla konkretnego SHA wytwarza zaufany producent, po czym niezależny weryfikator sprawdza oryginał. Stan oczekiwania stosuje się w czasie działania właściwego producenta. Wydanie i merge pozostają wstrzymane w zakresie wymagającym tego dowodu. Błąd producenta, brak dowodu po jego zakończeniu lub po upływie dopuszczonego okna oraz niezgodność dowodu wymagają jawnego rozstrzygnięcia bez wystawienia PASS. Wymagana niezależność obejmuje uprawnienia, źródło reguł i pochodzenie dowodu.

### P-06. Minimum koniecznej pracy, kompletna walidacja
Nie powtarzamy testu tylko dlatego, że zmienił się etap dokumentacji. Wynik można użyć ponownie wyłącznie przy zgodności dokładnych wejść i polityki. `main` po merge i rzeczywisty release nadal wymagają dowodów przewidzianych aktywnymi zasadami. Żadnego uruchamiania niezaufanego kodu z podwyższonymi uprawnieniami.

### P-07. Bezpieczna autonomia wykonawcy
ChatGPT i Codex mogą realizować zadania według zdolności i aktywnych uprawnień. Nie przypisujemy na stałe konkretnych rodzajów tasków jednemu wykonawcy. Każdy przekazuje kompletny, zweryfikowany punkt wznowienia; nikt nie domniemywa aktualności stanu z poprzedniej rozmowy. Codex prowadzi rutynowe działania w granicach mandatu, a właściciel zatwierdza wyjątki i operacje szczególne.

### P-08. Ograniczanie zatrzymań developmentu
Dla każdego zadania obowiązuje karta wpływu A/B/C, zależności i `STOP CONDITIONS`. Przy klasie B zatrzymuje się wyłącznie konieczny obszar. Rozwiązanie klasy C nie może rozpocząć się bez osobnej jawnej decyzji, potwierdzenia konieczności i planu wznowienia.

### P-09. Odbiór rzeczywiście działającego wyniku
PR, PASS CI i `live` nie wystarczają same w sobie. W odpowiednim środowisku trzeba potwierdzić działanie skompilowanej wersji, poprawny stan zabezpieczeń, brak nowych regresji i możliwość odtworzenia. Dla zmiany proceduralnej odbiór to odpowiednio udokumentowany scenariusz pracy agenta.

### P-10. Przenośność organizacyjna — `NFR-GITHUB-PORTABILITY`
Projektujemy reguły, workflow i profile tak, by docelowa zmiana osobistego `owner/repo` na organizacyjne nie wymagała przebudowy logiki procesu. GitHub przy transferze zachowuje historię Git, w tym SHA commitów. Historyczne dowody zachowują metadane tożsamości i pochodzenia z czasu wykonania. W przyszłym projekcie trzeba osobno potwierdzić nowe `owner/repo`, zakres zaufania, prawa do pakietów, uprawnienia i powiązania integracji zewnętrznych. Zmianę tożsamości autoryzuje się jawnie w zaufanej konfiguracji. Obecne usprawnienia muszą działać na bieżącym koncie GitHub. [Transfer repozytorium](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)

### P-11. Jedna inicjatywa, bez mnożenia procesów
Karta Projektu zawiera jeden backlog, etapy, taski, miary, decyzje i rejestr. Nie tworzymy osobnego BSDC do każdej małej korekty. Wykonanie etapów pozostaje objęte aktywnym governance, PMOS/PHR i odrębnymi mandatami. Projekt i publikacja nie stanowią automatycznej zgody na wdrożenie.

## 5. Docelowy program zmian i priorytety

| Strumień | Wynik docelowy | Wpływ oczekiwany | Etap w Karcie |
| --- | --- | --- | --- |
| Procedura i mandat | Jedna spójna ścieżka autonomii w istniejących prawach; mniej mikrozgód i powielania PMOS/PHR | **A** | E1 |
| Równoległe prace / quick win | Koordynacja izolowanych tasków i worktrees bez nowych uprawnień lub uzależnienia od Source Governance | **A**, po kwalifikacji | **E2-T04 / QW-05** |
| CI — dowód | Producent i weryfikator działają we właściwej kolejności; brak przewidywalnego ponawiania całego zestawu | **A/B** zależnie od implementacji | E2 |
| Rzeczywisty pilot | Zmiana R1 od potrzeby do użytkowania na obowiązujących zasadach. Pomiar osobnych dopuszczeń Source i zgód wydaniowych | **A** w zakresie operacji zakwalifikowanych do pilota | E3 |
| Source Governance — **MUST** | Zaufane dopuszczenie rutynowego diffu bez automatycznej potrzeby osobnego PR-u polityki, z technicznym egzekwowaniem | **B/R4** dla zmiany kontrolera | E4 |
| Weryfikacja i wydania | **MUST:** wcześniejszy build/start rzeczywistego artefaktu (E5-T01). **CONDITIONAL:** deduplikacja testów i przebudowa zależności/wydawania (E5-T02–T04) | **A/B**, **C tylko jeśli udowodnione** | E5 |

Szczegółowe taski, zależności, ownerzy, statusy i dowody są **wyłącznie w Karcie Projektu**, a nie dublowane tutaj. **Odbiór E1–E3 nie jest zamknięciem całego projektu**. Proponowany bazowy końcowy zakres obejmuje obowiązkowy E4/GV-01/GV-02 i E5-T01/CI-02; E5-T02–T04 są warunkowe. Po przyjęciu planu rezygnacja z któregokolwiek obowiązkowego wyniku wymaga jawnej decyzji właściciela zmieniającej przyjętą rewizję i Business DoD; nie wynika automatycznie z wyniku pilota.

## 6. Business Definition of Done

Projekt można uznać za zakończony, gdy łącznie:

1. **FINAL-01:** działa przyjęta uproszczona ścieżka R1; jej zakres i granice są czytelne dla obu wykonawców.
2. **FINAL-02:** w reprezentatywnych przypadkach udokumentowano osobno `ready → merge` i `merge → działające Development`, z porównaniem do zamrożonego AS-IS; brak wyników nie jest zastępowany szacunkiem.
3. **FINAL-03:** w dopuszczonym zakresie E2 weryfikator przechodzi do sprawdzenia po wytworzeniu właściwego dowodu. Scenariusz prawidłowy kończy się bez ponowienia wyłącznie z powodu oczekiwania na dowód. Regresje, odmowy i awarie infrastruktury są wykazywane oddzielnie.
4. **FINAL-04:** każda wprowadzona optymalizacja zachowuje właściwy mandat, niezależność zaufanego dowodu, ochronę danych/tenantów, LKG oraz rollback i kontrolę środowiska; przygotowane testy negatywne pozostają skuteczne.
5. **FINAL-05:** do końcowego zamknięcia wymagana jest realizacja E1–E3, **E4/GV-01/GV-02 oraz E5-T01/CI-02**, z dowodami DoD. Dla każdej pozycji backlogu zapisujemy korzyść, klasę A/B/C, ryzyko R1–R4, wynik testu, status i uzasadnienie odroczenia. E5-T02–T04 pozostają warunkowe, chyba że właściciel podniesie je do MUST. Rezygnacja z MUST wymaga odrębnej udokumentowanej zmiany zakresu i bazowego Business DoD.
6. **FINAL-06:** żadne nowe rozwiązanie nie uzależnia realizacji zwykłych zadań od przeniesienia GitHub i nie pogarsza przyszłej przenośności; zachowano jawne kontrolowane przejście tożsamości zaufania dla osobnej migracji.
7. **FINAL-07:** wdrożone zasady i konfiguracje są opublikowane/aktywne wyłącznie w dopuszczony sposób, odbierane na rzeczywistym stanie; Karta Projektu zawiera zweryfikowane dowody, rozliczenia i ostateczną decyzję zamknięcia.

**Dwa poziomy akceptacji:** po E3 właściciel odbiera pierwszy pakiet quick wins i pilota, ale nie zamyka projektu. Zamknięcie całej inicjatywy następuje dopiero po spełnieniu wszystkich `FINAL-*` i rozliczeniu zadań MUST, bez automatycznego odroczenia E4 lub E5-T01. Warunkowe E5-T02–T04 wymagają decyzji o realizacji lub uzasadnionym odroczeniu, a nie pozornego PASS.

Progi odbioru E2 i warunki oceny E3 ustala się w Karcie przed próbą. Pojedyncze wydanie pokazuje wykonalność i czas danego przypadku. Uogólnienie oszczędności i wniosek o skalowaniu wymagają porównywalnych przypadków. Regresja bezpieczeństwa blokuje rozszerzenie.

## 7. Zasady wydań projektu optymalizacyjnego

- **Projektowanie / review:** bez uprawnień do zmiany runtime z samego faktu przygotowania dokumentów.
- **Akceptacja kanonu i Karty:** właściciel przyjmuje konkretną rewizję i zakres; publikacja/aktywacja są osobnym dopuszczonym działaniem.
- **Etap i operacja wydaniowa:** właściciel zleca etap z określeniem zakresu. Wykonanie korzysta z aktualnych mandatów i praw, w tym wymagań dopuszczenia Source oraz odrębnej autoryzacji release dokładnego SHA, gdy wymaga jej obowiązująca polityka. Docelowy stały mandat dla R1 wymaga przyjęcia odpowiedniej reguły i mechanizmu egzekwowania.
- **GO/NO-GO:** brak ważnego mandatu, nieznana tożsamość źródła, nierozstrzygnięty routing, brak zaufanego dowodu, niepewny zapis lub niekompatybilny rollback — zatrzymanie wyłącznie operacji zależnej; niezależne zadania aktywnego etapu mogą trwać.
- **Publikacja:** proponowany kanon nie zastępuje i nie nowelizuje obowiązujących dokumentów do czasu formalnej aktywacji odpowiednich zmian.

## 8. Referencje i stan decyzji

- **Diagnoza:** [SpendGuru-audyt-AS-IS-2026-11-21.md](https://github.com/profitia/spendguru/blob/7d10fec73cd69194523b320faf397982d9a8fd04/docs/audits/2026/11/21/SpendGuru-audyt-AS-IS-2026-11-21.md) (`ASIS-REF-01`, SHA-256 `5ee32757fe85896ab14089bd936f41a8c0fd283db67b672a60d8427a49e40683`).
- **Przypadki kontrolne:** [SG2 #730](https://github.com/profitia/SG-dev/pull/730) i [SG2 #1081](https://github.com/profitia/SG-dev/pull/1081), [polityka #1082](https://github.com/profitia/SG-dev/pull/1082).
- **Historyczna zmiana o wyższym ryzyku:** [#1269](https://github.com/profitia/SG-dev/pull/1269) / [#1270](https://github.com/profitia/SG-dev/pull/1270) — **nie** pilot R1.
- **Przykład obowiązującego kontrolera:** [Canon v3 §10.4](https://github.com/profitia/SG-dev/blob/main/Canon/v3.0-profitia-agent-execution-canon.md), [Platform CI](https://github.com/profitia/SG-dev/blob/main/.github/workflows/platform-contracts-ci.yml).
- **Wersja niniejsza:** właściciel zaakceptował v0.3 do publikacji 21.11.2026. Mandat wykonawczy i aktywacja pozostają odrębnymi decyzjami.

## 9. Decyzje właściciela i dalsze przyjęcia

1. Przyjęto tryb BOE v1.1 i Kartę inspirowaną BSDC v1.1 (DEC-01).
2. Przyjęto zakres i priorytety Karty, w tym E4 i E5-T01 jako MUST dla zamknięcia oraz E5-T02–T04 jako CONDITIONAL (DEC-07). Wpływ zmian podlega przeglądowi przed wykonaniem.
3. Zamknięto DEC-08 przed publikacją. Ponowny odczyt z commita `7d10fec73cd69194523b320faf397982d9a8fd04` potwierdził SHA-256 w metryce.
4. W przyszłości — przyjęcie dokładnych zmian wrappera, workflow, Canonu lub polityk w ich wymaganych ścieżkach; obecny projekt dokumentu nie jest taką zgodą.

**Status dokumentu: OWNER_APPROVED_FOR_PUBLICATION / NOT_ACTIVE.**
