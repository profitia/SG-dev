# Karta Projektu — SpendGuru Development & Release Optimization
## Karta v0.3 — zaakceptowana do publikacji | 2026-11-21

| Pole | Wartość |
| --- | --- |
| Status | **OWNER_APPROVED_FOR_PUBLICATION** · E1 **OWNER_ACCEPTED / SUCCESS** · 21.11.2026 |
| `initiativeId` | `ARCH-DEV-RELEASE-OPT-20261121` |
| `projectKey` / owner merytoryczny | **ARCHITECTURE** / właściciel Profitia (decyzje biznesowe) |
| Współpracujące profile | SG2, SRM i właściwi ownerzy wspólnych kontraktów |
| Repozytorium authority | `profitia/SG-dev` / `main` |
| Ścieżka Karty | `Canon/proposals/bsdc/ARCHITECTURE/spendguru-development-release-optimization.md` |
| Kanon rozwiązania | [Projekt kanonu v0.3](../../spendguru-development-release-optimization-canon-v0.3.md) |
| Zamrożona baza AS-IS | [SpendGuru-audyt-AS-IS-2026-11-21.md](https://github.com/profitia/spendguru/blob/7d10fec73cd69194523b320faf397982d9a8fd04/docs/audits/2026/11/21/SpendGuru-audyt-AS-IS-2026-11-21.md) (`ASIS-REF-01`, SHA-256 `5ee32757fe85896ab14089bd936f41a8c0fd283db67b672a60d8427a49e40683`) · prywatne repozytorium, SHA-256 potwierdzony po ponownym odczycie |
| Metodologia | **BOE v1.1 i Karta inspirowana BSDC v1.1** (DEC-01, decyzja właściciela z 21.11.2026). |
| Bieżący mandat wykonawczy | **BRAK** · mandat E1-T01–E1-T04 rozliczony |
| Odbiór E1 | **OWNER_ACCEPTED / SUCCESS** · 21.11.2026 |

## 1. Potrzeba biznesowa i rezultat

**Problem:** tworzenie, testowanie, dopuszczanie i wydawanie nawet prostych poprawek SG2/SRM wymaga nadmiernej liczby operacji, ponowień CI, dodatkowych PR-ów polityki, technicznych decyzji i nieprzewidywalnego czasu dojścia do działającego Development.

**Rezultat:** bezpieczny, możliwie autonomiczny przepływ „zaakceptowana potrzeba → implementacja → niezależna walidacja → integracja → rzeczywiście działające i odebrane Development”, w którym obciążenie właściciela jest proporcjonalne do ryzyka.

**Nie rozwiązujemy w tym projekcie:** funkcjonalności produktowych, bieżących awarii SG2/SRM, przeniesienia repozytoriów na organizację GitHub ani organizacji migracyjnego freeze. Po **formalnym zamknięciu obecnego projektu** planowana jest **oddzielna inicjatywa migracji SpendGuru na konto organizacji GitHub**. Obecne usprawnienia muszą być przenośne i możliwe do wykorzystania także po tej migracji; migracja **nie jest zadaniem obecnego backlogu**.

## 2. Zamrożony AS-IS — fakty i ograniczenia

**Źródło:** [SpendGuru-audyt-AS-IS-2026-11-21.md](https://github.com/profitia/spendguru/blob/7d10fec73cd69194523b320faf397982d9a8fd04/docs/audits/2026/11/21/SpendGuru-audyt-AS-IS-2026-11-21.md) (`ASIS-REF-01`, SHA-256 `5ee32757fe85896ab14089bd936f41a8c0fd283db67b672a60d8427a49e40683`). czterotygodniowy pomiar od 24 października do 21 listopada 2026. Punkt startowy to najpóźniejszy z dostępnych sygnałów otwarcia PR-u, zapisu końcowego commitu i przejścia do `Ready for review`. Punkt końcowy to pierwsze udane wdrożenie na właściwej usłudze Render, które potwierdziło oczekiwaną zawartość badanych plików. Odbiór funkcjonalny mierzy się osobno. Późniejsze ustalenia zapisuje się jako datowane uzupełnienia migawki.

| Miara z audytu Codexa | Stan bazowy | Ograniczenie |
| --- | --- | --- |
| `ready → Development`, SG2 | mediana **1 h 6 min**, p90 **9 h 40 min** | 54 potwierdzone przypadki, nie cała populacja |
| `ready → Development`, SRM | mediana **27 min**, p90 **10 h 9 min** | 61 potwierdzonych przypadków |
| `merge → Development`, SG2 | mediana **36 min**, p90 **9 h 40 min** | Główna usługa SG2 |
| `merge → Development`, SRM | mediana **20 min**, p90 **9 h 47 min** | Główna usługa SRM |
| PR-y z ponowieniem CI na tym samym HEAD | **126/169** | Uruchomienia na zdarzeniu `pull_request`. Część ponowień mogła być zasadna |
| Dodatkowe wykonania na tym samym HEAD | **179** (174 próby, 5 dodatkowych run IDs) | nieznana część rzeczywiście usuwalna |
| Dodatkowe powiązane PR-y polityki/dopuszczenia | **co najmniej 23** dla 19 PR-ów źródłowych | tylko udowodnione związki |
| PR-y z opisem decyzji/zgody właściciela | **47** | nie jest liczbą unikalnych zgód |

**Utrwalenie AS-IS (DEC-08):** przed publikacją Karty i kanonu zapisano raport w prywatnym `profitia/spendguru` i potwierdzono SHA-256 odczytem z pełnego SHA commita. [SpendGuru-audyt-AS-IS-2026-11-21.md](https://github.com/profitia/spendguru/blob/7d10fec73cd69194523b320faf397982d9a8fd04/docs/audits/2026/11/21/SpendGuru-audyt-AS-IS-2026-11-21.md) (`ASIS-REF-01`, SHA-256 `5ee32757fe85896ab14089bd936f41a8c0fd283db67b672a60d8427a49e40683`). Datowane erraty pozostają osobnym śladem, bez zmieniania pliku bazowego.

**Istotne przykłady:** [#730](https://github.com/profitia/SG-dev/pull/730) — drobna zmiana typografii i oczekiwanie na dowód; [#1081](https://github.com/profitia/SG-dev/pull/1081)/[#1082](https://github.com/profitia/SG-dev/pull/1082) — ikona, dodatkowy PR polityki, ponowienia i wydanie; [#1269](https://github.com/profitia/SG-dev/pull/1269)/[#1270](https://github.com/profitia/SG-dev/pull/1270) — przypadek kontrolny wysokiego ryzyka, nie pilot klasy R1.

**Ustalenia i hipotezy.** Audyt potwierdził osobne PR-y dopuszczenia, przedwczesne uruchomienie weryfikatora i sprzężenie części wydań z bindingami w Neon. Oszczędność z ograniczenia dokumentacji i łączny udział usuwalnych ponowień wymagają pomiaru. Wyniki głównych usług SG2 i SRM stanowią tło. Pilot porównuje przypadki o podobnej klasie ryzyka na SG2 Development Dashboard, np. #730.

## 3. Zasada doboru zadań i priorytety

### 3.1. Dwie osie oceny

- `DEVELOPMENT_IMPACT`: **A** — bez wstrzymania prac; **B** — ograniczone okno/zakres integracji lub wydań; **C** — rzeczywista potrzeba pełnego freeze, **nie przesądzona**.
- `SECURITY_RISK`: **R1** — prezentacja; **R2** — zwykła funkcja; **R3** — współdzielone kontrakty/build/runtime; **R4** — Identity, dane/tenant, granty, sekrety, źródła zaufania lub governance.
- `MIGRATION_COMPATIBILITY` stosuje się do rozwiązań dotykających tożsamości repozytorium, uprawnień i integracji. **READY** oznacza przenośność logiki, **NEEDS_ADAPTER** oznacza przyszłą adaptację konfiguracji lub autoryzacji, a **BLOCKED** oznacza sprzeczność z wymaganiem przenośności. Dla pozostałych zadań stosuje się **N/A**.
- Priorytety: **P0** natychmiastowe quick wins, **P1** kolejny cykl, **P2** większy lub odroczony nakład. Klasa nie przesądza automatycznie zgody wykonawczej. **Obowiązkowość wyniku (MUST/CONDITIONAL) jest odrębna od P0/P1/P2**; w bazowym projekcie E4 i E5-T01 są MUST, E5-T02–T04 są CONDITIONAL.

### 3.2. Backlog — jeden rejestr inicjatywy

| ID | Zadanie / rezultat | Priorytet | Wpływ / ryzyko (wstępne) | Zależność | Stan |
| --- | --- | --- | --- | --- | --- |
| **QW-01** | Retrospekcja #730 i #1081 oraz rozpoznanie zasadnych uproszczeń | P0 | A / analiza tylko do odczytu | AS-IS | NIE_ROZPOCZĘTY |
| **QW-02** | Jeden spójny kontrakt w Universal Wrapper: istniejący mandat, rodzaje bramek, preflight, eskalacje, błędy CI | P0 | A / R4 dla publikacji governance | QW-01 | NIE_ROZPOCZĘTY |
| **QW-03** | Wspólna mapa referencji PMOS/PHR/CI, ponowne użycie ważnego dowodu i minimalny handoff | P0 | A / R2–R4 zależnie od kontraktu | QW-01 | NIE_ROZPOCZĘTY |
| **QW-04** | NFR-GITHUB-PORTABILITY we wszystkich proponowanych zmianach; bez migracji i bez obchodzenia repo trust | P0 | A / R2 | Start projektu | NIE_ROZPOCZĘTY |
| **QW-05** | Bezpieczna koordynacja równoległych tasków i worktrees na obecnym GitHub/Codespaces; szybki test współistnienia dwóch zadań | P1 — **wcześnie, E2** | A / R2, do ponownej oceny przy zmianach chronionych | QW-02; **bez zależności od CI-01 i E4** | NIE_ROZPOCZĘTY |
| **CI-01** | Zaufany producent → niezależny weryfikator; jawny stan oczekiwania; ograniczenie przedwczesnych rerunów | P0 | **A/B** / R4 dla kontrolera | QW-01, QW-02 | NIE_ROZPOCZĘTY |
| **CI-02** | Wczesny produkcyjny build/start odpowiadający późniejszemu wydaniu, adekwatne bezpieczne smoke — **MUST w E5** | P1 | A/B / R3 | CI-01 | NIE_ROZPOCZĘTY |
| **CI-03** | Pomiar i warunkowa redukcja powtarzanych testów po porównaniu dokładnych wejść; brak kasowania obowiązkowych kontroli — **CONDITIONAL w E5** | P1 | B / R3 | CI-01, wynik analizy opłacalności | NIE_ROZPOCZĘTY |
| **PL-01** | Sprawdzenie nowej ścieżki względem retrospekcji E1 i rzeczywisty pilot R1 w SG2 Dashboard | P0 | A / R1 dla kandydata, odrębna ocena wydania | QW-02, CI-01, kwalifikowalny kandydat i wydanie | NIE_ROZPOCZĘTY |
| **GV-01** | Docelowe zaufane dopuszczenie rutynowego źródła bez osobnego PR-u polityki — **MUST w E4** | P1 | B / R4 | Pilot, architektura trust | NIE_ROZPOCZĘTY |
| **GV-02** | Techniczne egzekwowanie odpowiednich wymaganych statusów CI, merge i release bez nowych niejawnych bramek — **MUST w E4** | P1 | B / R4 | GV-01 lub kompatybilny kontroler | NIE_ROZPOCZĘTY |
| **RL-01** | Warunkowe zmniejszenie kosztu wydawania i sprzężenia SG2/Findera z SHA/Neon — **CONDITIONAL w E5, bez ingerencji przy HOLD** | P2 | B; C wyłącznie po dowodzie / R4 | Analiza wariantów, test recovery | NIE_ROZPOCZĘTY |
| **RL-02** | Warunkowa koordynacja wydań wielousługowych, bezpieczna promocja i rollback — **CONDITIONAL w E5** | P2 | B; C wyłącznie po dowodzie / R3–R4 | RL-01 lub osobna analiza | NIE_ROZPOCZĘTY |

**Nie ma tasków dotyczących utworzenia organizacji GitHub, transferu repozytoriów, zmiany konta, wdrożenia Merge Queue na docelowym koncie ani obsługi migracyjnego freeze.** Są to zadania przyszłego, odrębnego projektu.

## 4. Proponowane etapy realizacji END-TO-END

Każdy etap to komplet rezultatów. Właściciel określa zakres zleconego etapu. Dopuszczone zadania aktywnego etapu mogą wykonywać ChatGPT lub Codex zależnie od możliwości i praw. Rozliczenie etapu wykorzystuje dowody z istniejących rejestrów. Rekomendowany **pierwszy pakiet wyników to E1–E3**, który ma osobny odbiór i **nie oznacza zamknięcia całego projektu**. W proponowanym bazowym zakresie **E4 (GV-01/GV-02) jest obowiązkowym rezultatem końcowym**, a w E5 obowiązkowe jest **E5-T01 (CI-02: wczesna walidacja realnego buildu/startu)**. E5-T02–T04 są **warunkowe**, uruchamiane po ocenie korzyści, zależności i ryzyka. Zmiana tego podziału, również rezygnacja z E4, wymaga osobnej, jawnej decyzji właściciela zmieniającej zaakceptowany zakres i DoD; samo rozliczenie E3 nie pozwala automatycznie zakończyć projektu ani odroczyć zadań obowiązkowych (DEC-07).

### E1 — Diagnostyka kontrfaktyczna i pierwszy pakiet proceduralny (quick wins)

- **Cel:** upewnić się, które nadmiarowe czynności można usunąć bez zmiany bezpieczeństwa i dostarczyć mały, odwracalny pakiet usprawnień instrukcyjnych.
- **Owner/profil/środowisko:** ARCHITECTURE, GitHub; analiza read-only, późniejsze dopuszczone zmiany instrukcji na `main`.
- **Wpływ:** zasadniczo A; każda aktualizacja normatywna R4 wymaga właściwej kwalifikacji.
- **DoD E1:** odtworzone #730 i #1081, jawne rozróżnienie policy vs wrapper vs workflow, opublikowany wyłącznie zatwierdzony zakres instrukcyjny, reprezentatywny scenariusz u uprawnionego wykonawcy i zachowanie praw oraz ciągłości PMOS/PHR. Zakres osobnego odbioru u drugiego wykonawcy zależy od tego, czy jest objęty celem wdrożenia.

| Task | Rezultat | Zależność | Dowód DoD |
| --- | --- | --- | --- |
| **E1-T01 / QW-01** | Replay #730 i #1081 z osią czasu, liczbą zgód i powtórzeń, co da się uprościć | baseline | Analiza z identyfikatorami źródeł i kwalifikacją dowodów |
| **E1-T02 / QW-02** | Minimalna korekta wspólnego wrappera; nie dublować istniejących reguł BOE/Canon | E1-T01 | Diff, wymagane przyjęcie, testy/regresja interpretacji mandatu |
| **E1-T03 / QW-03** | Mapa aktualnych referencji do dowodów i reguły reuse | E1-T01 | Scenariusze PMOS/PHR, recovery i ponownego wykonania po zmianie wejść |
| **E1-T04 / QW-04** | Lista warunków przenośności zastosowana do zmian E1 i przyszłego backlogu | E1-T02 | Checklist `READY/NEEDS_ADAPTER/BLOCKED` bez przeprowadzania migracji |

### E2 — Koordynacja CI i dowodów oraz wczesny quick win równoległych prac

- **Cel:** usunąć przewidywalne uruchomienia weryfikatora zanim istnieje wymagany dowód **oraz niezależnie wdrożyć QW-05**, jeśli potwierdzono brak wpływu na chronione kontrolery.
- **Owner:** ARCHITECTURE; konsumenci SG2/SRM zgodnie z routingiem.
- **Wpływ:** CI-01: A/B, ostatecznie wyznaczony z aktualnych workflow i otwartych PR-ów; QW-05: **A tylko przy rzeczywiście nieblokującej implementacji**. Nie wolno niejawnie blokować innych wydań.
- **DoD E2:** niezależny producent i weryfikator, prawidłowe powiązanie SHA, pochodzenia artefaktu i mandatu. Przypadek pozytywny przechodzi bez ponowienia wyłącznie z powodu oczekiwania na dowód. Jeżeli producent nie dostarcza dowodu, kończy się błędem albo dowód pochodzi z innego źródła, jest nieaktualny lub niezgodny, zależna operacja pozostaje zablokowana. Sprawdzamy zachowanie wobec istniejących PR-ów podczas zmiany i odtworzenie poprzedniego wariantu. **Dodatkowy DoD QW-05:** dwie niezależne prace w izolowanych worktrees nie nadpisują sobie stanu ani dowodów, nie blokują niepowiązanych integracji; wymagany jest scenariusz rzeczywisty lub adekwatny kontrolowany test. Jeżeli QW-05 wymaga zmian w chronionym kontrolerze, zakres jest ponownie klasyfikowany i nie jest na siłę wciskany do klasy A.

| Task | Rezultat | Zależność | Dowód DoD |
| --- | --- | --- | --- |
| **E2-T01 / CI-01a** | Minimalny projekt sekwencjonowania CI i trybu przejściowego | Ustalenia E1-T01, zlecony E2 | Schemat wykonania i przypadki graniczne. Szkic do konsultacji może korzystać z wyników E1-T01 podczas prac nad wrapperem |
| **E2-T02 / CI-01b** | Dopuszczona zmiana workflow/kontrolera | E2-T01 | PR, exact SHA, CI, powtórzenie scenariuszy odmowy i sukcesu |
| **E2-T03 / CI-01c** | Porównanie liczby uruchomień i czasu przed/po zmianie | E2-T02 | Nowe metryki przy identycznej definicji przyczyny ponowienia |
| **E2-T04 / QW-05** | Wczesna koordynacja dwóch niezależnych tasków/worktrees na obecnym koncie; nie czeka na przebudowę Source ani na wynik E2-T02 | E1-T02 (QW-02); odrębny zakres A | Test izolacji, brak kolizji, czytelna obsługa równoległych PR oraz dowody PMOS/PHR |

### E3 — Pilot rzeczywistej zmiany R1

- **Cel:** potwierdzić przyspieszenie dostarczenia bez pogorszenia kontroli.
- **Owner:** ARCHITECTURE (eksperyment), SG2 (komponent i release), oddzielne uprawnienia dla chronionych operacji.
- **Wpływ i warunek wejścia:** kandydat prezentacyjny R1 oraz osobna kwalifikacja pełnego wydania wyłącznie na wskazany SG2 Development Dashboard. Zweryfikować routing, konfigurację, LKG i zależności, w tym bindingi Neon. Jeżeli wydanie wymaga chronionego zapisu, wybrać kwalifikowalny kandydat w zakresie pilota albo przedstawić zależność i oznaczyć etap jako zablokowany.
- **DoD E3:** jedna nowa, rzeczywiście potrzebna korekta prezentacyjna na wzór #730 z pomiarem `ready → merge` i `merge → Development` według definicji AS-IS. Osobno zapisujemy odbiór faktycznie działającego widoku, wynik kontroli regresji, ponowienia według przyczyn, dodatkowe PR-y i decyzje. Pilot przechodzi obowiązującą ścieżką dopuszczenia Source i autoryzacji wydania dla dokładnego SHA. Jeśli ta ścieżka wymaga dodatkowego PR-u lub odrębnego GO, zapisujemy ten koszt. Eliminację dodatkowego PR-u ocenia E4, a docelowy stały mandat R1 wymaga osobnego przyjęcia.

| Task | Rezultat | Zależność | Dowód DoD |
| --- | --- | --- | --- |
| **E3-T01 / PL-01a** | Sprawdzenie nowej ścieżki na przypadkach z jednej retrospekcji E1 | Wynik retrospekcji E1-T01 i wdrożona zmiana E2 | Różnica między odnotowanym a nowym przebiegiem w tym samym materiale dowodowym |
| **E3-T02 / PL-01b** | Nowa zaakceptowana korekta R1 i jej normalne wydanie | E3-T01, mandat SG2 | PR, CI, main SHA, release, działający widok |
| **E3-T03 / PL-01c** | Ocena wykonalności i korzyści oraz decyzja o następnym pakiecie | E3-T02 | Metryki pojedynczego przypadku, wyniki testów bezpieczeństwa i decyzja właściciela. Rozszerzenie ścieżki wymaga porównywalnych przypadków |

### E4 — Zmiana Source Governance i egzekwowania merge (**MUST w bazowym zakresie projektu**)

- **Cel:** umożliwić zwykłym zmianom przejście przez zaufane dopuszczenie bez obowiązkowego dodatkowego PR-u polityki, tam gdzie to bezpieczne.
- **Owner:** ARCHITECTURE/Governance; SG2/SRM jako odbiorcy.
- **Wpływ:** B/R4, C wyłącznie jeśli ocena wykaże konieczność.
- **Status końcowy:** obowiązkowy rezultat projektu, nie tylko opcjonalna inwestycja po pilocie. Nie wolno uznać projektu za zakończony po E1–E3 bez E4 albo jawnej zmiany zatwierdzonego zakresu przez właściciela.
- **DoD E4:** zaufane dopuszczenie rutynowej zmiany pozwala w przyjętym zakresie uniknąć osobnego PR-u Source, a kandydat nie może autoryzować sam siebie; dokładny diff i źródło zaufania powiązane z mandatem; testy fałszywych źródeł/nieaktualnego SHA; techniczne egzekwowanie przy merge, release, rollback i udokumentowane odwrócenie. Zakres koniecznej zmiany polityki wyraźnie zaakceptowany.

| Task | Rezultat | Zależność | Dowód DoD |
| --- | --- | --- | --- |
| **E4-T01 / GV-01a** | Projekt alternatyw zaufanego source admission i plan migracji samego mechanizmu | E3 | Threat model, warianty, decyzja ownera; nie dotyczy migracji GitHub |
| **E4-T02 / GV-01b** | Minimalna, formalnie przyjęta implementacja i dual-run/adwersarialne testy | E4-T01 | PR, source proofs, negatywne testy, rollback |
| **E4-T03 / GV-02** | Adekwatna branch/merge/release enforcement dla klas ryzyka | E4-T02 lub zatwierdzona kompatybilna ścieżka | Testy blokad i ścieżek prawidłowych; brak martwej blokady |

### E5 — Wczesna walidacja buildów (**MUST**) i warunkowa optymalizacja testów/wydań

- **Cel:** zmniejszyć długie ogony czasu po merge, wykrywać prawdziwe błędy pakowania wcześniej, ograniczyć koszt wydawania wielu usług.
- **Owner:** ARCHITECTURE; SG2/SRM/Identity/Limits tylko w zakresie faktycznego wpływu i poprawnych mandatów.
- **Wpływ:** A/B. Kategoria C nie jest z góry przyjmowana; w razie konieczności osobna decyzja i okno.
- **Zakres obowiązkowy:** E5-T01 / CI-02 — wcześniejsza walidacja buildu i startu artefaktu z reprezentatywnymi bezpiecznymi smoke oraz przypadkiem błędu. **DoD obowiązkowego E5:** potwierdzona zgodność artefaktu/konfiguracji z docelowym środowiskiem w zakresie objętym testem, wykrycie awarii przed wydaniem i zachowanie niezależnych kontroli oraz rollbacku.
- **Zakres warunkowy:** E5-T02 / CI-03, E5-T03 / RL-01 i E5-T04 / RL-02 — po osobnej ocenie danych, kosztów i zagrożeń oraz decyzji w ramach mandatu. Odroczenie musi mieć zapisane uzasadnienie i dowód, ale nie blokuje odbioru obowiązkowego E5-T01 ani zamknięcia projektu. Jeśli task warunkowy zostanie jednak jawnie przyjęty jako obowiązkowy, jego niespełnione DoD blokuje zamknięcie.
- **Pomiar:** p50/p90 post-merge tylko dla wystarczająco porównywalnej próby i z podaniem liczebności; bez udawania statystycznego wyniku przy jednym wydaniu.

| Task | Rezultat | Zależność | Dowód DoD |
| --- | --- | --- | --- |
| **E5-T01 / CI-02 — MUST** | Wcześniejszy build/start skompilowanego artefaktu i bezpieczne smoke | E2 | Dowód zgodności testowanego artefaktu i test awarii build/runtime |
| **E5-T02 / CI-03 — CONDITIONAL** | Ocena opłacalności i ewentualna deduplikacja testów dla identycznych wejść | E5-T01; pozytywna ocena | Porównanie pokrycia/ryzyka i czasu; albo uzasadnione odroczenie |
| **E5-T03 / RL-01 — CONDITIONAL** | Zmniejszenie sprzężenia SG2–Finder/Neon tylko przy dowodzie równoważnej autoryzacji | E4, kwalifikacja R4, osobny mandat | Projekt, testy częściowego wykonania i rollback; brak naruszenia HOLD lub uzasadnione odroczenie |
| **E5-T04 / RL-02 — CONDITIONAL** | Lżejsza, bezpieczna koordynacja wydania wielu usług | E5-T03 lub niezależna decyzja i osobny mandat | Przebieg release i odbiór E2E, dowód LKG; albo uzasadnione odroczenie |

**QW-05 nie jest częścią E5** — został przeniesiony do **E2-T04**, bez zależności od przebudowy Source Governance.

## 5. Business DoD — odbiór końcowy

| ID | Kryterium | Dowód wymagany | Stan |
| --- | --- | --- | --- |
| FINAL-01 | Prosta R1 dostarczana w przyjętej, uproszczonej ścieżce | PR/CI/deploy/odbiór | NIE_ROZPOCZĘTY |
| FINAL-02 | Porównanie `ready→merge` i `merge→Development` względem baseline | Pomiar z metodą i liczebnością próby | NIE_ROZPOCZĘTY |
| FINAL-03 | Przypadek pozytywny w przyjętym zakresie E2 przechodzi bez ponowienia wywołanego samą kolejnością dowodu | Wyniki CI przed/po, odmowa przy braku właściwego dowodu i rozliczenie przyczyn ponowień | NIE_ROZPOCZĘTY |
| FINAL-04 | Wszystkie wymagane negatywne testy trust/Source/Identity/tenant nadal skuteczne | Niezależne wyniki CI i kontroli | NIE_ROZPOCZĘTY |
| FINAL-05 | **Warunek zamknięcia całego projektu:** ukończone E1–E3, **E4 / GV-01 i GV-02**, **E5-T01 / CI-02**, a także zadania warunkowe jedynie wtedy, gdy osobno przyjęte jako obowiązkowe. Każda zmiana zakresu wymaga jawnej, wersjonowanej decyzji właściciela | Rejestr etapów, dowody DoD, decyzje właściciela i zaakceptowana rewizja | NIE_ROZPOCZĘTY |
| FINAL-06 | NFR przenośności spełnione dla nowych rozwiązań; migracja nie wykonana w tym projekcie | Checklista zgodności, jawna lista późniejszych adapterów | NIE_ROZPOCZĘTY |
| FINAL-07 | Opublikowane tylko autoryzowane normatywne zmiany; działający rezultat i zamknięty rejestr | Rewizje, PR, handoff, PMOS/PHR, odbiór | NIE_ROZPOCZĘTY |

**Dwa odbiory, dwie różne decyzje:** odbiór pakietu **E1–E3** potwierdza szybkie usprawnienia i pilot, lecz **nie kończy inicjatywy**. Formalne zamknięcie wymaga spełnienia FINAL-01–FINAL-07, w tym obowiązkowych wyników **E4 i E5-T01**. Wykonane zadanie warunkowe rozliczamy jako `ZAKOŃCZONY`. Przy odroczeniu zachowujemy rzeczywisty status zadania i zapisujemy adnotację „odroczony decyzją właściciela” wraz z uzasadnieniem. Zmiana bazowego DoD wymaga osobnej decyzji oraz rewizji planu, nie automatycznej interpretacji handoffu E3.

**Pomiar wpływu.** Dla pilota podać czasy pojedynczych przypadków, liczebność oraz otwarte lub zablokowane przypadki. Po zebraniu porównywalnych wyników raportować medianę i p90 z liczebnością próby, osobno według usługi i klasy ryzyka. Oddzielnie rozliczyć czas do faktycznego odbioru, incydenty, powtórzenia i decyzje. Zasady oceny uzgodnić przed próbą (DEC-05).

## 6. Przenośność do przyszłej organizacji GitHub

Jedyny zakres dotyczący migracji w niniejszej Karcie to **wymaganie `NFR-GITHUB-PORTABILITY`**:

- Rozdzielić logiczne profile od konkretnego `owner/repo` tam, gdzie pozwala na to bezpieczeństwo.
- Nie otwierać zaufania automatycznie na nieznany nowy owner/repo; zapisać przyszłą konieczność nowego dopuszczenia tożsamości i uprawnień.
- Unikać rozwiązań zależnych wyłącznie od możliwości lub ograniczeń konta osobistego, jeśli istnieje neutralny, poprawny wariant.
- W nowych rozwiązaniach sprawdzić działanie na obecnym repozytorium i możliwość podmiany jawnie zatwierdzonej konfiguracji zaufania. Przy natywnym transferze GitHub zachowuje SHA historii Git. Historyczne dowody pozostają związane z tożsamością, pod którą zostały wytworzone. [Transfer repozytorium](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)
- Dla zadań objętych wymaganiem zapisać `READY`, `NEEDS_ADAPTER` lub `BLOCKED`. Dla skupionych na treści instrukcji stosować `N/A`, jeśli zmiana nie dotyka repo trust ani integracji.

**Projekt następny, poza zakresem:** po zamknięciu tego projektu uruchomienie **odrębnego** projektu transferu SpendGuru na konto organizacji GitHub, ze swoim AS-IS, mandatem, freeze, planem przełączenia i odbiorem. Nie dopisuje się go do E1–E5.

## 7. Lokalizacja i odpowiedzialność — propozycja do routingu

Zidentyfikowane istniejące źródła w `profitia/SG-dev` (odczyt 2026-11-21):

```text
SG-dev/                                      [ISTNIEJE; authority main]
├── AGENTS.md                                [ISTNIEJE; entrypoint]
├── Canon/
│   ├── v3.0-profitia-agent-execution-canon.md [ISTNIEJE; governance]
│   ├── v1.1-business-solution-design-and-canonization-canon.md [ISTNIEJE; metodologia]
│   ├── registries/
│   │   ├── profitia-projects-v1.json        [ISTNIEJE; profile]
│   │   ├── governance-manifest-v2.json      [ISTNIEJE; manifest]
│   │   └── controlled-source-admissions-v1.json [ISTNIEJE; source admissions]
│   └── proposals/bsdc/ARCHITECTURE/         [ISTNIEJE; folder kart; NOWA KARTA — PROPOZYCJA]
├── docs/agent-instructions/
│   ├── business-outcome-engineering-v1.1.md [ISTNIEJE; referencja]
│   ├── profitia-universal-project-execution-v1.2.md [ISTNIEJE; QW-02]
│   └── full-autopilot-v2.md                 [ISTNIEJE; referencja]
├── .github/workflows/
│   └── platform-contracts-ci.yml           [ISTNIEJE; CI-01 / kandydat]
└── scripts/governance/
    ├── development-execution.mjs            [ISTNIEJE; GV-01 / kandydat]
    └── controlled-package-ci.mjs            [ISTNIEJE; CI/GV / kandydat]
```

**Uwaga:** wymienione exact paths to miejsca do analizy, a nie zatwierdzone cele mutacji. Ownership, routing ALIGNED/LEGACY, prawa publikacji, wpływ na otwarte PR-y i wymagane upoważnienia muszą być potwierdzone aktualnym resolverem i preflightem **przed** jakimkolwiek zapisem. Nie tworzyć nowej aplikacji ani bazy backlogu.

## 8. Rejestr wykonania (jedyny rejestr inicjatywy)

| Etap | Status | Mandat | PR/SHA/CI/deploy/PHR | Warunek przejścia |
| --- | --- | --- | --- | --- |
| E1 | ZAKOŃCZONY | E1-T01–E1-T04, 21.11.2026 | PMOS `ARCH-DEV-RELEASE-OPT-20261121-E1`, T02 `ARCH-DEV-RELEASE-OPT-20261121-E1-T02`, [PR #1273](https://github.com/profitia/SG-dev/pull/1273), dowody w §§8.1–8.4 | **OWNER_ACCEPTED / SUCCESS** · 21.11.2026 |
| E2 | NIE_ROZPOCZĘTY | BRAK | — | Oddzielny GO po rozliczeniu E1; QW-05 (E2-T04) niezależnie od E2-T02 |
| E3 | NIE_ROZPOCZĘTY | BRAK | — | Oddzielny GO po rozliczeniu E2 |
| E4 — MUST | NIE_ROZPOCZĘTY | BRAK | — | Odrębny GO po E3; obligatoryjne DoD GV-01/GV-02 dla pełnego zamknięcia, chyba że owner zmieni zakres |
| E5 — MUST: T01 | NIE_ROZPOCZĘTY | BRAK | — | Odrębny GO po E4; E5-T01 obowiązkowy, T02–T04 warunkowe |

Rejestr tasków: pozycje E2–E5 mają status `NIE_ROZPOCZĘTY`. Bieżące wyniki E1 są poniżej. Po publikacji aktualizować **w tej samej Karcie** statusy, daty, executor, `taskId`, PR, exact source/main SHA, CI, deploy, wymagane potwierdzenie i blocker. Dozwolone stany: `NIE_ROZPOCZĘTY`, `W_TOKU`, `CZĘŚCIOWY`, `ZABLOKOWANY`, `ZAKOŃCZONY`. Nie dopisywać fikcyjnego dowodu.

**Autonomia wykonawcy:** decyzję, które taski prowadzi ChatGPT, a które Codex, podejmuje się przy uruchomieniu i w toku etapu na podstawie realnego dostępu, bezpieczeństwa i efektywności. Zgody, routing, owner-only, CI, PMOS/PHR, LKG i STOP nie przechodzą automatycznie na drugiego wykonawcę.

| Zadanie | Rezultat ujęty w tej rewizji | Dowód i status odbioru |
| --- | --- | --- |
| E1-T01 / QW-01 | Retrospekcja dwóch przypadków | ZAKOŃCZONY · ODEBRANY PRZEZ WŁAŚCICIELA · §8.1 i przypięte dowody |
| E1-T02 / QW-02 | Dokładne usprawnienie Universal v1.2 | ZAKOŃCZONY · ODEBRANY PRZEZ WŁAŚCICIELA · §8.2 · opublikowana i aktywna delta potwierdzona odczytem i CI |
| E1-T03 / QW-03 | Praktyczna mapa dowodów i wznowienia | ZAKOŃCZONY · ODEBRANY PRZEZ WŁAŚCICIELA · §8.3 · testy i kanoniczny closeout E1 w PHR |
| E1-T04 / QW-04 | Zastosowanie NFR GitHub do wyników E1 | ZAKOŃCZONY · ODEBRANY PRZEZ WŁAŚCICIELA · §8.4 |

### 8.1. E1-T01 — retrospekcja dwóch zmian SG2

Stan systemu i starsze metryki pochodzą z zamrożonego AS-IS. Poniższe czasy uzupełniają go o odczyty GitHub Actions, artefakty ich producentów, Render i PHR. Godziny w tabelach podano w CET. Czas „do Development” oznacza zakończenie pierwszego skutecznego wdrożenia zgodnego SHA. Odbiór widoku i dalsze operacje zapisano osobno.

| Zdarzenie | #730 · 26.10.2026 | #1081 / #1082 · 13.11.2026 |
| --- | --- | --- |
| Zakres źródła | CSS typografii i digest zgodności, 2 pliki. Końcowe źródło `f64d2eae28ede756c007a2b0cb51560009f0b7fd` 10:44:15, PR otwarty 10:44:20. GitHub nie wykazał osobnego `Ready for review`. [Diff #730](https://github.com/profitia/SG-dev/pull/730/files) | Dostępna ikona powiadomień AppShell i domknięcie grafu dowodów, 7 plików. PR otwarty 15:23:43, końcowe źródło `74b2010b2225b82d389e4b1803a953bb5b599128` 15:39:01, `Ready for review` 18:42:35. [Diff i przebieg #1081](https://github.com/profitia/SG-dev/pull/1081) |
| Pierwsza przeszkoda | O 10:45:41 publiczny weryfikator zwrócił `CONTROLLED_VALIDATION_REQUIRED_FOR_EXACT_SHA`. Oryginalny producent działał od 10:44:47 i ukończył pracę o 10:48:43. Odczytany artefakt wskazuje wymagane SHA kandydata, kontroler `5a5fdd74…` i PASS testów, typecheck oraz buildu. [Pierwsza próba](https://github.com/profitia/SG-dev/actions/runs/40301876943/attempts/1) · [Producent i artefakt](https://github.com/profitia/SG-dev/actions/runs/40301928602#artifacts) | Pierwsze publiczne próby zawierały rzeczywiste błędy integralności. Na końcowym SHA o 15:51:30 brakowało dowodu, a niezależny job odrzucił też źródło PI (`PI_LIVE_ACCEPTANCE_SOURCE_REJECTED`). Nowe uruchomienie po dostarczeniu dowodu nadal miało ten drugi błąd. [Próba końcowego SHA](https://github.com/profitia/SG-dev/actions/runs/43446512047) · [Nieudany świeży CI](https://github.com/profitia/SG-dev/actions/runs/43475359063/attempts/1) |
| Polityka i decyzje | W badanym #730 przeszła dotychczasowa ścieżka w oparciu o już zaakceptowane `main`. Odczytane zdarzenia nie wykazały dodatkowego PR-u polityki ani nowej odrębnej zgody dla tego follow-upu. Handoff utrwala mandat i odbiór szerszej pracy SG2, więc nie liczymy zera zgód dla całego wydania. [PHR SG2](https://github.com/profitia/project-history-repository/blob/b59a60f8ea42617830cd97ebff8179bec30ec2a2/history/2026/10/26/2026-10-26-10-07-18Z__sg2-sg2-benchmark-canon-polish-20261026/handoff.md) | Osobny #1082 zmienił kontroler i jego test. Udokumentowano co najmniej dwie decyzje właścicielskie: mandat pilota SG2 do odbioru Development i zgodę na dokładny patch polityki ARCHITECTURE. Nie ustalono dokładnych godzin decyzji ani pełnej liczby zgód operacyjnych. Bootstrap #1082 zakończył się o 17:36:30, polityka została scalona o 18:04:44 do `3901ff15…`, a CI tego main zakończył się o 18:32:21. [PR #1082](https://github.com/profitia/SG-dev/pull/1082) · [Bootstrap](https://github.com/profitia/SG-dev/actions/runs/43462623540) · [CI polityki na main](https://github.com/profitia/SG-dev/actions/runs/43469151894) · [Dowód decyzji w PHR](https://github.com/profitia/project-history-repository/blob/b59a60f8ea42617830cd97ebff8179bec30ec2a2/history/2026/11/13/2026-11-13-17-50-23Z__architecture-arch-appshell-notifications-ci-20261113/handoff.md) |
| Ponowienia i merge | Dwie próby jednego uruchomienia na końcowym HEAD. Druga, po udostępnieniu dowodu, zaczęła się o 10:56:20 i przeszła o 10:57:11. Merge `32fce23e…` o 10:57:37. Wcześniejsze przebiegi tej samej gałęzi mają inne SHA. [Druga próba](https://github.com/profitia/SG-dev/actions/runs/40301876943/attempts/2) · [Merge #730](https://github.com/profitia/SG-dev/commit/32fce23eff7033e84d19ff74dc719c93eff34097) | #1082 miał jedno ponowienie publicznego CI po dostępności bootstrapu. Na końcowym SHA #1081 zarejestrowano cztery próby w trzech uruchomieniach: dwie nieudane, jedno ponowienie anulowane (brak potwierdzonej przyczyny), jedno świeże udane. Producent z przyjętego `3901ff15…` zakończył się o 18:21:59 i dostarczył oryginalny artefakt dla `74b2010b…`. Świeże publiczne CI skończyło się o 19:09:00, merge `80875d8f…` o 19:11:26. [Ponowienie #1082](https://github.com/profitia/SG-dev/actions/runs/43461945875/attempts/2) · [Oryginalny dowód #1081](https://github.com/profitia/SG-dev/actions/runs/43469498045#artifacts) · [Anulowana próba](https://github.com/profitia/SG-dev/actions/runs/43475359063/attempts/2) · [Świeży PASS](https://github.com/profitia/SG-dev/actions/runs/43477877269) |
| Development i odbiór | Dashboard `dep-dbfi89q9lscs73a8jirg` ukończony o 10:59:25 na `32fce23e…`. Około **15 min 5 s** od otwarcia i **1 min 48 s** od merge. Handoff utrwala odczyt działającego widoku, m.in. etykiety 10 px i wskaźniki 4 × 4 px. Końcowe wydanie usług i odnowienie istniejących bindingów należały do szerszej pracy SG2. [Render Dashboard](https://dashboard.render.com/web/srv-dapa3ujm8hqs73a9t2og/deploys/dep-dbfi89q9lscs73a8jirg) · [Odbiór w PHR](https://github.com/profitia/project-history-repository/blob/b59a60f8ea42617830cd97ebff8179bec30ec2a2/history/2026/10/26/2026-10-26-10-07-18Z__sg2-sg2-benchmark-canon-polish-20261026/handoff.md) | Pierwsze skuteczne wdrożenie `dep-dbrmjg3m8hqs73d8rtq0` o 20:52:09, ok. **2 h 10 min** od `Ready for review`, **1 h 41 min** od merge. Dwie wcześniejsze próby Render miały `update_failed`. PHR rejestruje odbiór koordynatora (8 wariantów UI, klawiatura) oraz oddzielne operacje synchronizacji i rollbacku bindingów. Render pokazał kolejny skuteczny deploy dokładnie tego SHA o 21:32:41. Status bieżący historycznych deployów to `deactivated`. [CI wynikowego main](https://github.com/profitia/SG-dev/actions/runs/43480186462) · [Pierwszy skuteczny Render](https://dashboard.render.com/web/srv-dapa3tid0e5s73f8bc5g/deploys/dep-dbrmjg3m8hqs73d8rtq0) · [Późniejszy Render](https://dashboard.render.com/web/srv-dapa3tid0e5s73f8bc5g/deploys/dep-dbrn6bgu01pc73e1e21g) · [Odbiór i ograniczenia PHR](https://github.com/profitia/project-history-repository/blob/b59a60f8ea42617830cd97ebff8179bec30ec2a2/history/2026/11/13/2026-11-13-20-12-58Z__sg2-sg2-cloud-appshell-notifications-20261113/handoff.md) |

| Kategoria | Możliwe wtedy i dzisiaj | Właściwy etap i granica |
| --- | --- | --- |
| **WRAPPER / PROCEDURAL OVERHEAD** | Gdy oryginalny producent jest aktywny, wykazać oczekiwanie i zachować wynik pierwszej próby. Przy następnym kroku użyć istniejącej ważnej zgody oraz aktualnych dowodów na te same wejścia. W #730 właściwy producent działał w chwili odmowy. GitHub i PHR nie wykazują, ile powtórnych rozmów o mandacie rzeczywiście odbyto. | **E1** doprecyzowuje interpretację i ręczne wznowienie wyłącznie w dozwolonym momencie. **E2** odpowiada za automatyczne sekwencjonowanie producenta i weryfikatora. Podstawy to oryginalny log #730 oraz Canon v3 §§10.1–10.2. |
| **POLICY / MANDATORY GATE** | Przy odmowie grafu/Source na #1081 samo czekanie nie dawało dopuszczenia. Wtedy użyto dokładnego #1082. Dzisiaj sprawdza się najpierw dopuszczalność w aktywnym ledgerze i kompletność dowodu, z zachowaniem granicy zwykłego dopuszczenia. | **E1** rozpoznaje granicę i kwalifikuje właściwą ścieżkę. **E4** może zmienić mechanizm przy odrębnym mandacie. Źródła to #1082 i Canon v3 §10.4. |
| **TECHNICAL DEPENDENCY** | Osobno mierzyć gotowość producenta, rzeczywisty job architektoniczny, CI wynikowego main, kolejkę wydania i runtime. Dodatkowy błąd źródła PI oraz próby deploy #1081 pozostają przypisane do własnych przyczyn. Z dostępnego śladu nie wynika, że całą przerwę po merge wywołał jeden warunek. | **E1** zachowuje osobne dowody i pełną metrykę. **E2** dotyczy koordynacji CI. **E5** dotyczy build/runtime i release, z zastosowaniem LKG oraz własnej autoryzacji. |
| **OWNER DECISION / NEW AUTHORIZATION** | Używać istniejącego mandatu dla tej samej operacji i zakresu, a przy chronionej zmianie przedstawić jeden wniosek obejmujący dokładne wejścia. W #1082 decyzja wiązała digest dokładnego patcha, nie zastępowała walidacji i wydania #1081. | **E1** usuwa potrzebę ponownego pytania o tę samą zgodę w reprezentatywnym przebiegu. Nowy Source, chronione bajty i release związany ze SHA pozostają pod właściwym kontraktem. |

### 8.2. E1-T02 — propozycja minimalnej zmiany Universal v1.2

Status po przyjęciu tej rewizji do `main` to `OWNER_APPROVED / ACTIVE` dla dokładnie zatwierdzonej delty w dotychczasowej ścieżce Universal v1.2. Cel to jedna krótsza instrukcja odsyłająca do istniejących reguł. Diff dotyczy §11 oraz Aneksu A. Zastępuje 11 wierszy powtórzonej checklisty dwoma akapitami odsyłającymi do właściwych, nadal obowiązujących sekcji. Rozstrzyga, jak opisać brak dowodu podczas pracy producenta i jak zachować oryginalny wynik CI. Zachowuje preflight, właściwy mandat, granicę Source, LKG i continuity przez odwołanie do aktywnych sekcji wrappera i Canon v3.

- Plik docelowy i owner to `docs/agent-instructions/profitia-universal-project-execution-v1.2.md` i Governance Source Layer. Przejście routingu `ALIGNED` określa ownership, zgodę na dokładne bajty określa odrębne przyjęcie. Podstawa to `f70dcac89fc5d05f22d192a80c12fc3a5bb58e20`, SHA-256 bieżącego pliku `69c97acd3a1b87c3b3ea8eb9de821ff1d0934eb6f98951db285b3641cc1d10ff`.
- SHA-256 źródłowego diffu z kontekstem to `514f7b14d3245b2daca0538b36553449cb9cf15c4adca5e903b587f124fb44d8`. SHA-256 pełnego pliku po nałożeniu to `4bfceb8d50fc4c4a3e54709b31ae276eea2e3b6f8afa3193917b6561beb3b3c9`. `git apply --check` przeszedł na wskazanej podstawie. Właściciel przyjął jeden ujawniony pakiet dokładnych bajtów do opublikowania i aktywacji dla SG2, SRM i ARCHITECTURE, z zachowaniem wymaganej kwalifikacji. Wycofanie przyjętej zmiany odbywa się przez zwykły revert odpowiedniego PR-u. [Aktywny Universal v1.2](https://github.com/profitia/SG-dev/blob/f70dcac89fc5d05f22d192a80c12fc3a5bb58e20/docs/agent-instructions/profitia-universal-project-execution-v1.2.md) · [Canon v3](https://github.com/profitia/SG-dev/blob/f70dcac89fc5d05f22d192a80c12fc3a5bb58e20/Canon/v3.0-profitia-agent-execution-canon.md)

Podgląd zatwierdzonej zmiany.

```diff
--- a/docs/agent-instructions/profitia-universal-project-execution-v1.2.md
+++ b/docs/agent-instructions/profitia-universal-project-execution-v1.2.md
@@ -256,7 +256,7 @@
 Dobierz testy do efektu i ryzyka, nie liczby plików:

 1. Potwierdź główny scenariusz użytkownika, istotne warianty negatywne, błędy graniczne i dotknięte granice danych/bezpieczeństwa.
-2. Testy lokalne, typecheck, build, kontraktowe i CI wykonuj według obowiązujących gate'ów; unikaj zbędnego powtarzania identycznych pozytywnych dowodów dla tego samego SHA, konfiguracji i zależności.
+2. Testy lokalne, typecheck, build, kontraktowe i CI wykonuj według obowiązujących gate'ów; unikaj zbędnego powtarzania identycznych pozytywnych dowodów dla tego samego SHA, konfiguracji i zależności. Gdy log wskazuje brak dowodu dla dokładnego SHA i właściwy producent jeszcze pracuje, zachowaj wynik próby i odnotuj oczekiwanie. Ponów zależny weryfikator po dostępności właściwego dowodu, zgodnie z obowiązującym kontraktem CI. Błąd testu, awarię infrastruktury oraz odmowę Source lub brak autoryzacji rozlicz osobno.
 3. Gdy błąd wynika z kodu, napraw przyczynę u ownera i dodaj adekwatną regresję. Nie zmieniaj testów ani kanonów wyłącznie dla zielonego PASS.
 4. Dla nowych integracji sprawdź reprezentatywny scenariusz na rzeczywistych, dopuszczonych źródłach; syntetyczny fixture nie zastępuje LIVE.
 5. Oddziel `CODE READY`, `CI PASS`, `DEPLOYED`, `RUNTIME VERIFIED` od `BUSINESS OUTCOME VERIFIED`.
@@ -329,17 +329,9 @@

 ## Aneks A — krótki preflight kontrolny (nie dodatkowa procedura)

-- [ ] Wybrany tryb `CONSULTING / EXECUTION`; przy wykonaniu ustalony mandat i właściwy pomocniczy Full Autopilot.
-- [ ] Aktywny `projectKey`, profil, adapter, repozytorium authority i `TARGET_ENVIRONMENT` ustalone z rejestru.
-- [ ] `AGENTS.md`, wymagane kanony i manifest załadowane, właściwe gate'y oraz routing target paths sprawdzone.
-- [ ] Rozdzielono ACTUAL, `ALIGNED/LEGACY`, klasyfikację `TRANSITIONAL` i stan deploymentu; legacy write wyłącznie z dopuszczonym wyjątkiem.
-- [ ] Ustalono `PMOS_APPLICABILITY = REQUIRED / NOT_APPLICABLE` **na podstawie profilu i środowiska**.
-- [ ] Jeśli `REQUIRED`: właściwe projekt/baza/endpoint/rola PMOS, `pmos:begin` i wymagany preflight; po pracy closeout i wszystkie publikacje zgodne z aktywnym profilem.
-- [ ] Jeśli `NOT_APPLICABLE`: bez PMOS/PHR continuity; zamiast tego właściwe gate'y i dowody release (GitHub/Render/Neon), jeśli dotyczy.
-- [ ] Wpływ na Identity/E1, Source, dane i licencje określony lub uzasadnione `NOT_APPLICABLE`.
-- [ ] Przy UX/UI załadowano aktualny kanon MagicPath, zweryfikowano reużycie i klasyfikację PRODUCT/DESIGN/SIMULATION; w innym przypadku `NOT_APPLICABLE`.
-- [ ] Przed **każdym deploymentem** potwierdzono LKG albo prawdziwy przypadek first deployment; zakres owner-only zasobów pozostaje u właściciela.
-- [ ] Po wykonaniu potwierdzono rzeczywisty rezultat, release SHA/runtime oraz obowiązkowe dowody, bez fikcyjnego sukcesu.
+Stosuj bramki właściwe dla operacji i profilu według §§2–7 oraz §§11–13. Rozróżnij obowiązkowy kontroler, warunek mandatu, zależność techniczną i rekomendację.
+
+Przy kolejnej operacji w przyjętym zakresie użyj ważnego mandatu z §13. Zachowaj wymagane ponowne sprawdzenia i odśwież dowody, których wejścia się zmieniły.

 ---

```

### 8.3. E1-T03 — mapa dowodów, wznowienie i próby interpretacji

| Co potwierdzamy | Źródło prawdy i klucz powiązania | Reuse, zmiana lub brak |
| --- | --- | --- |
| Mandat i PMOS begin | Decyzja właściciela i zapis rejestracji PMOS. `projectKey`, `taskId`, host, zakres operacji, zasób, środowisko, termin i dokładny SHA tam, gdzie wymagany. | Użyć ważnego zakresu dla kolejnych kroków. Zmiana uprawnień, zakresu lub SHA objętego exact GO wymaga weryfikacji nowych warunków. |
| Source | Aktualny trusted main, właściwy rekord lub zamknięty review oraz GitHub PR i dokładny head. Zaufany kontroler wiąże bazę, komplet ścieżek, blobów, trybów i ownerów. | Zmiana wejść unieważnia dowód, którego dotyczą. Dla odświeżonej podstawy użyć udokumentowanej zgodnej ścieżki z aktualnym dokładnym SHA i dowodem. |
| CI | GitHub Actions `runId/attempt`, oryginalny artefakt i niezależna weryfikacja `candidateSha/controlSha`, zaufanego workflow i kontraktu. CI PR i wynikowego main mają odrębne tożsamości. | Oczekiwanie wymaga potwierdzonego aktywnego producenta i właściwej przyczyny w logu. Odmowa pochodzenia, brak producenta, błąd testu i awaria infrastruktury mają różne następne kroki. |
| Wydanie i odbiór | GitHub merge SHA, właściwa usługa Render i deploy ID, dokładny odczyt runtime, LKG oraz właściwy dowód po operacji na danych, jeśli dotyczy. | Wznowienie następuje na pierwszej brakującej operacji po odczycie stanu. Wynik poprzedniego wydania nie dowodzi nowego deployu. |
| Closeout i przejęcie | PMOS `taskId/conversationId`, PHR `publicationId` i istniejący commit plus readback. Przekazanie zawiera ostatni potwierdzony krok, stan pending/receiptu, brakujący gate, właściciela operacji i następny dopuszczony krok. | Przy publikacji już obecnej użyć kanonicznego recovery z oryginalnym commit/bundle. Przy awarii publikacji zachować pending i dowody. Przejmujący sprawdza własny mandat i current authority. |

**Scenariusze wykonane.** Codex zastosował bieżące instrukcje do tej Karty. Użył mandatu E1 i istniejącej diagnozy. Wykonał odczyt aktualnego main, pełny preflight, pojedynczy `pmos:begin` dla etapu i wymagany preflight z rejestracją. Historyczne dowody odczytano ponownie tylko dla dwóch przypadków i skutków decyzji. Zapis opiera się na istniejącym PMOS/PHR.

| Próba | Wynik i materiał |
| --- | --- |
| Ważny mandat i te same wejścia | Rejestracja tej Karty i test kontraktu `same valid scope reuses the recorded mandate` potwierdziły ścieżkę bez ponownej zgody dla czynności objętych E1. |
| Zmiana dokładnego SHA, zakresu lub ścieżki | Istniejące testy odmowy obcego SHA, niedozwolonych chronionych plików, złej tożsamości i zmienionych bajtów potwierdziły granicę. Próba E1 użyła rzeczywistego różnego źródła #1082 jako negatywnej pary do #1081 i porównała pola artefaktów. |
| Oczekiwanie na dowód i rzeczywisty błąd | Oryginalna odmowa #730 podczas pracy właściwego producenta została zakwalifikowana jako oczekiwanie na exact proof. #1081 zachowuje osobny błąd integralności PI nawet przy ukończonym producencie. Anulowanej próbie nie przypisano przyczyny bez dowodu. |
| Brak lub obcy producent | Oryginalne proofy #730, #1082 i #1081 zawierają różne pary kandydat/kontroler. Testy rzeczywistej wersji kontraktu odrzucają użycie obcej pary i dopuszczenie chronionej ścieżki przez zwykły rekord. Wynik kontroli na aktualnym kodzie to 8/8 w wybranym zestawie. |
| Błąd PHR i wznowienie | Istniejące testy PMOS (6/6 w wybranym zestawie) sprawdziły zachowanie pending przy błędzie i uznanie publikacji po sukcesie. Rzeczywisty wcześniejszy przypadek v0.3 zakończył się `RECOVERED / VERIFIED_EXISTING`, ponownym `ALREADY_COMPLETE` i pustym pending slot. [Oryginalny pakiet v0.3](https://github.com/profitia/project-history-repository/blob/b59a60f8ea42617830cd97ebff8179bec30ec2a2/history/2026/11/21/2026-11-21-15-37-37Z__architecture-architecture-dev-release-opt-v03-publication-20261121/manifest.json) |
| Przejęcie pracy | Odtworzenie następnika z istniejących artefaktów w tej retrospekcji i test `resume selects the first unverified operation` sprawdziły punkt wznowienia. Niezależny odbiór przez ChatGPT może ponowić odczyt podanych dowodów, używając własnych uprawnień. |

### 8.4. E1-T04 — przenośność GitHub

| `NFR-GITHUB-PORTABILITY` | Ocena i następstwo |
| --- | --- |
| Karta i projekt diffu wrappera | `READY`. Logiczny profil i reguły są pobierane z aktywnego rejestru. Dodane adresy GitHub identyfikują historyczne dowody, a decyzja i delta wrappera identyfikują dokładne bajty. |
| Ciągłość i proofy pod kontrolą GitHub | `NEEDS_ADAPTER` przy zmianie authority. Ponownie rozwiązać mapę repo/owner/branch i prawa GitHub Actions, PHR i pakietów oraz sprawdzić wiązania workflow z rzeczywistym repozytorium. Historyczne dowody zachowują swoje pierwotne tożsamości. GitHub zachowuje historię Git przy transferze. Pochodzenie, role i delegację w SpendGuru trzeba uzgodnić dla nowej tożsamości. [Transfer repozytorium w GitHub](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository) |
| Wydanie, Render/Neon i Merge Queue | `N/A` dla materiałów E1. Zależności integracji pozostają w osobnym projekcie migracyjnym. |

**Punkt wznowienia i odbiór.** Właściwe źródło statusu to niniejsza Karta i rejestracja PMOS `ARCH-DEV-RELEASE-OPT-20261121-E1`. W PHR pakiet ma `publicationId=ARCHITECTURE:ARCH-DEV-RELEASE-OPT-20261121-E1`. Aktualne CI i dokładny zapis repozytoryjny można sprawdzić w [historii zmian Karty](https://github.com/profitia/SG-dev/commits/main/Canon/proposals/bsdc/ARCHITECTURE/spendguru-development-release-optimization.md) oraz [pakietach PHR](https://github.com/profitia/project-history-repository/tree/main/history/2026/11/21). Właściciel odebrał wynik 21.11.2026 po niezależnej weryfikacji ChatGPT oraz odczycie `main` i PHR. Przejście do E2 wymaga oddzielnego mandatu właściciela.

**Odbiór właściciela E1 · 21.11.2026.** Wynik `OWNER_ACCEPTED / SUCCESS` obejmuje E1-T01–E1-T04. Podstawą jest handoff Codexa, niezależna weryfikacja ChatGPT i potwierdzone dowody wykonania. Zweryfikowany SHA E1 to `82638ac73f7865170ec14a25e7abdaf2104df52c`. Administracyjny zapis decyzji ma odrębny `taskId` `ARCH-DEV-RELEASE-OPT-20261121-E1-OWNER-ACCEPTANCE`. [PR #1273](https://github.com/profitia/SG-dev/pull/1273) · [CI wynikowego main](https://github.com/profitia/SG-dev/actions/runs/44935565469) · [PHR E1](https://github.com/profitia/project-history-repository/blob/5850e963968f10a4e6b47eedb5033589248aa9bf/history/2026/11/21/2026-11-21-18-30-54Z__architecture-arch-dev-release-opt-20261121-e1/manifest.json) · [PHR E1-T02](https://github.com/profitia/project-history-repository/blob/4b34a5a220029888f41765b07cb0d05ff18e1d7c/history/2026/11/21/2026-11-21-18-30-17Z__architecture-arch-dev-release-opt-20261121-e1-t02/manifest.json)

### 8.5. E2 — sekwencjonowanie i pomiar

Mandat właściciela obejmuje E2-T01–E2-T04. Rejestracja wykonawcza PMOS `ARCH-DEV-RELEASE-OPT-20261121-E2`. Stan wykonania `W_TOKU`.

**DEC-03 — wpływ i zakres.** CI-01: **B/R4**. Właściciel ścieżek to Governance Source Layer, projekt ARCHITECTURE, repozytorium `profitia/SG-dev`. Granica dotyczy sprawdzania dowodów SG2, w tym ścieżek Architecture/SRM wymagających tego samego dowodu. Własny test operacyjny SRM oraz Architecture contract and lab działają osobno. QW-05: **A/R2** w zakresie izolacji zadań i rejestracji continuity. Kwalifikacja chronionych bajtów CI-01 wymaga jawnej decyzji właściciela na dokładny pakiet zgodnie z Canon v3 §10. Skoordynowanie zadań oczekujących na dowód ogranicza się do ścieżek korzystających z tej bramki.

**DEC-05 — definicja przed próbą.** Jednostka pomiaru to dokładny HEAD kandydata i kolejne wykonania kroku niezależnej weryfikacji. Zapisujemy osobno odczyt stanu producenta i właściwą weryfikację. Ponowienie klasyfikujemy jako przedwczesne wyłącznie wtedy, gdy jedyną przyczyną pierwszej odmowy była niedostępność właściwego dowodu, który ostatecznie doprowadził ten sam HEAD do PASS. Błąd testu, autoryzacji, Source, infrastruktury lub zmiana SHA mają odrębne przyczyny. W każdej próbie mierzymy czas od gotowości kandydata do weryfikacji, gotowość dowodu według statusu producenta i widoczności artefaktu, czas oczekiwania, czas właściwej weryfikacji, liczbę decyzji właściciela i blokady niepowiązanych prac. Czas Render stanowi oddzielną metrykę poza próbą E2.

Kryteria kontrolowanego odbioru to **0 ponowień tylko z powodu kolejności** w scenariuszu pozytywnym, realna niezależna weryfikacja po gotowości oraz **0 nieuprawnionych PASS i 0 nowych blokad niepowiązanych prac**. Raport wskazuje liczebność, dokładne źródło czasu i ograniczenia obserwacji. AS-IS `126/169` i `179` dotyczy wszystkich przyczyn. Do porównania przyczynowego służą dwa potwierdzone przypadki #730 i #1082 oraz odrębny przypadek mieszany #1081 z §8.1. Próba sytuacji kontrolowanych nie daje estymacji oszczędności dla całej kolejki.

## 9. Otwarte decyzje, ryzyka i STOP

| ID | Decyzja / ryzyko | Zalecenie / stan |
| --- | --- | --- |
| DEC-01 | Tryb prowadzenia projektu | **Przyjęto 21.11.2026:** BOE v1.1 i Karta inspirowana BSDC v1.1. |
| DEC-02 | Gdzie i jak przyjąć dokumenty? | Jedna Karta jako rejestr inicjatywy. Projekt kanonu jako opis rozwiązania. Przed publikacją potwierdzić treść, dokładne ścieżki i routing. Zmiany aktywnych polityk przechodzą własną ścieżkę przyjęcia |
| DEC-03 | Klasyfikacja i uprawnienia E2 | CI-01 B/R4, QW-05 A/R2. Chronione dopuszczenie CI-01 wymaga odrębnej decyzji. Zob. §8.5. |
| DEC-04 | Czy zadania klasy C są konieczne? | Na starcie **brak**; wymaga osobnego uzasadnienia i GO |
| DEC-05 | Progi odbioru E2 i kryteria porównania E3 | Definicja i progi E2 w §8.5. E3 dokumentuje porównywalność, nakład i bezpieczeństwo pojedynczego wydania. |
| DEC-06 | Nowy source admission i zależności release | Dopuszczać dopiero po ocenie zagrożeń, testów negatywnych i możliwości odtworzenia |
| DEC-07 | Granica odbioru E1–E3 a końcowe zamknięcie | **Przyjęto 21.11.2026:** E1–E3 = pierwszy pakiet, **E4 (GV-01/GV-02) + E5-T01 (CI-02) = obowiązkowe dla końcowego DoD**, E5-T02–T04 = warunkowe. Ograniczenie E4 lub T01 wymaga jawnej rewizji zakresu i świadomej decyzji ownera; nie wynika automatycznie z odbioru E3 |
| DEC-08 | Trwała lokalizacja AS-IS (`ASIS-REF-01`) | **Rozliczono przed publikacją.** Ponowny odczyt z pełnego SHA commita potwierdził bajty raportu. [SpendGuru-audyt-AS-IS-2026-11-21.md](https://github.com/profitia/spendguru/blob/7d10fec73cd69194523b320faf397982d9a8fd04/docs/audits/2026/11/21/SpendGuru-audyt-AS-IS-2026-11-21.md) (`ASIS-REF-01`, SHA-256 `5ee32757fe85896ab14089bd936f41a8c0fd283db67b672a60d8427a49e40683`). |

**Warunki zatrzymania operacji:** brak ważnego mandatu, niezgodny owner/routing, nieaktualny source SHA, brak wymaganej niezależnej kwalifikacji, ryzyko naruszenia tenant/Identity/sekretów, niepewny stan zapisu Neon, brak LKG lub kolizja z aktywnym wydaniem. Stop dotyczy zależnej operacji; bezpieczne prace niezależne mogą być kontynuowane **w aktywnym etapie**.

## 10. Historia i punkt wznowienia

- **21.11.2026:** przyjęto kierunek projektu w rozmowie: AS-IS → lekka Karta → projekt kanonu → etapowe wykonanie; quick wins A, kontrolowane B, C tylko jeśli konieczne.
- **21.11.2026:** właściciel wyłączył z zakresu migrację do organizacji GitHub; zachowano jedynie wymóg przenośności i informację o późniejszym odrębnym projekcie.
- **21.11.2026:** przygotowano lokalną wersję dokumentów **do opiniowania**, bez formalnej publikacji, mandatu wykonawczego lub deklaracji aktywacji.
- **21.11.2026 — v0.3:** zaproponowano E4 i E5-T01 jako obowiązkowe wyniki końcowe, QW-05 przeniesiono do E2 oraz dodano weryfikowalny SHA-256 i bramkę trwałego utrwalenia audytu AS-IS przed publikacją.

**Stan v0.3:** właściciel zaakceptował Kartę i kanon do publikacji, przyjął DEC-01 oraz DEC-07 i potwierdził docelową lokalizację audytu. DEC-08 rozliczono odczytem z commita `7d10fec73cd69194523b320faf397982d9a8fd04`.
**E1 · 21.11.2026:** właściciel udzielił mandatu na E1-T01–E1-T04 i przyjął publikację oraz aktywację dokładnie wskazanej delty Universal v1.2. Punkt odbioru stanowią §§8.1–8.4, exact main, CI i potwierdzony closeout. Migracja do organizacji GitHub ma status odrębnej inicjatywy po zamknięciu tego projektu.

- **21.11.2026 — formalny odbiór E1:** właściciel przyjął E1-T01–E1-T04 z wynikiem `OWNER_ACCEPTED / SUCCESS`. E2 ma status `NIE_ROZPOCZĘTY / NO_MANDATE`.
