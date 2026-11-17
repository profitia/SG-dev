# PROFITIA — BSDC LAUNCHER v1.1
## Krótka komenda uruchomienia procesu w ChatGPT lub Codex

**Status:** `ACTIVE` — obowiązuje po publikacji launchera i BSDC Canon v1.1 w aktywnym manifeście na `main`\
**Cel:** rozpocząć lub wznowić prowadzenie nowej inicjatywy metodą BSDC, z **jedną trwałą Kartą Projektu BSDC** na GitHubie, bez automatycznego uruchamiania developmentu.\
**Zależność:** aktywny [BSDC Canon v1.1](../../Canon/v1.1-business-solution-design-and-canonization-canon.md) jest źródłem 29 kryteriów checklisty A–F (w tym E6), statusów, formatu Karty Projektu, zintegrowanej roadmapy i zasad mandatów etapowych.\
**Zastosowanie:** identyczny tekst w ChatGPT i Codex; nazwa narzędzia nie zmienia reguł.

## 1. Launcher — komenda do skopiowania

> **URUCHOM BSDC v1.1**\
> Potrzeba biznesowa: **[OPISZ SWÓJ POMYSŁ]**\
> Projekt/profil (jeśli znany): **[SG2 / ARCHITECTURE / SRM / inny / ustal sam]**\
>
> Pracuj zgodnie z aktywnym **BSDC Canon v1.1** oraz **Business Outcome Engineering v1.1**. Prowadź ze mną konsultacje przez checklistę A–F, nie wymagając ręcznego wypełniania pól.\
>
> **Na samym początku** sprawdź, czy ta inicjatywa ma już Kartę Projektu BSDC. Jeśli istnieje, wznów ją. Jeśli nie, **utwórz w tej sesji jeden nowy, trwały, projektowy dokument „Karta Projektu BSDC / Project Design Record” na GitHubie**, we właściwej ścieżce i przez dopuszczony workflow. Zapisz w nim opis potrzeby, pełną checklistę A–F z 29 kryteriami (w tym E6), status `WORKING / NOT_ACCEPTED`, ustalenia, rozwijaną wewnątrz Karty roadmapę END-TO-END z rejestrem wykonania oraz punkt wznowienia. Nie traktuj go jako zaakceptowanego kanonu rozwiązania.\
>
> **W pierwszej odpowiedzi zwróć bezpośredni, zweryfikowany link do zapisanej Karty Projektu**, jej `initiativeId`, status A–F i proponowany kolejny krok. Każdą istotną decyzję i stan pracy aktualizuj **w tym samym pliku**, tak aby można było wznowić projekt w ChatGPT lub Codex, niezależnie od historii rozmowy. Przy wznowieniu zawsze odczytaj aktualną wersję z GitHuba.\
>
> Jeżeli zapis jest niemożliwy z powodu braku uprawnień, dostępu do narzędzi lub routingu, **nie wymyślaj linku ani nie deklaruj trwałego zapisu**. Zwróć `PERSISTENCE_BLOCKED`, gotową treść dokumentu i najmniejsze konkretne działanie potrzebne do jego utworzenia.\
>
> Zadaj mi tylko niezbędne pytania biznesowe, samodzielnie zweryfikuj odpowiednie istniejące komponenty i kanony. W sekcji D przedstaw **drzewo katalogów monorepo** z proponowanym nowym/rozszerzanym komponentem i jego ownership/routingiem. Pokazuj krótki status A–F; pełną checklistę na żądanie i przed odbiorem.\
>
> Rezultatem BSDC ma być **projekt kanonu biznesowo-architektonicznego wraz z kompletną roadmapą END-TO-END w tej samej Karcie Projektu**. Ustal końcowy **Business Definition of Done** całego rozwiązania. Dla wszystkich etapów `E1`, `E2`, ... określ konkretne rezultaty, ownera/profil, środowisko, zależności i DoD. W każdym etapie opracuj numerowane taski `E1-T01`, `E1-T02`, ... z zakresem, rezultatem, zależnościami, DoD i wymaganymi dowodami. Ostatni etap prowadzi do rzeczywiście uruchomionego i odebranego rozwiązania.\
>
> **Roadmapę, harmonogram, rejestr realizacji i status projektu utrzymuj wewnątrz tej samej Karty. Nie twórz dla nich osobnych plików.** Rejestr obejmuje każdy etap i task: status, daty, ownera, taskId, PR, commit SHA, CI, deployment, testy, dowody odbioru, braki i następny krok. PMOS/PHR pozostają właściwymi systemami dowodowymi; Karta zawiera referencje do nich.\
>
> **Przed zamknięciem BSDC przedstaw mi do akceptacji cały projekt rozwiązania wraz z pełną roadmapą i końcowym Business DoD.** Zapisz decyzję, zakres i dokładną rewizję/commit akceptacji obu części. Po akceptacji część projektowa i bazowy plan pozostają zamrożone; statusy, dowody i rejestr wykonania aktualizuj dalej, bez cichej zmiany zakresu lub DoD.\
>
> **Akceptacja rozwiązania i całej roadmapy nie uruchamia implementacji ani żadnego etapu. Nie implementuj, nie modyfikuj kodu produktu, nie twórz zasobów i nie wdrażaj bez odrębnego upoważnienia.** Właściciel osobno zleca konkretny etap, np. `URUCHOM ETAP E1`. Codex realizuje dopuszczone taski tylko tego etapu w **Full Autopilot**, aktualizuje rejestr w Karcie, przedstawia rozliczenie i **zatrzymuje wykonanie przed następnym etapem**. Nowy etap wymaga nowej, wyraźnej dyspozycji właściciela. Stosuj **Universal Project Execution v1.2** i **Full Autopilot v2.0**, z obowiązującym profilem, routingiem, continuity i szczególnymi uprawnieniami.

## 2. Wznowienie projektu — krótka komenda

> **WZNÓW BSDC v1.1** z Karty Projektu: **[WKLEJ LINK GITHUB LUB initiativeId]**.\
> Odczytaj najnowszą Kartę, jej rewizję, status akceptacji, stan A–F, roadmapę i rejestr wykonania. Pokaż ostatnią decyzję oraz następny krok; kontynuuj w tej samej Karcie. Nie zakładaj znajomości poprzedniej rozmowy i nie twórz nowej karty. Wznowienie projektowania nie uruchamia etapu wykonawczego. Dla trwającej inicjatywy v1.0 przy merytorycznym wznowieniu stosuj reguły uzupełnienia E6 z kanonu v1.1; nie unieważniaj wcześniejszych decyzji.

## 3. Uruchomienie jednego zaakceptowanego etapu

> **URUCHOM ETAP E1** projektu **[LINK DO KARTY PROJEKTU LUB initiativeId]**, zgodnie z zaakceptowaną roadmapą BSDC, w Full Autopilot.\
> Odczytaj aktualną Kartę, zaakceptowaną rewizję projektu i roadmapy, rejestr realizacji, rozliczenie poprzedniego etapu, jeśli dotyczy, oraz wymagane dopuszczenia. Wykonaj wszystkie autoryzowane taski **wyłącznie E1**, wraz z rutynowymi poprawkami, testami, integracją i odbiorem objętymi mandatem, bez mikrozgód pomiędzy taskami. Przestrzegaj aktywnego governance i szczególnych granic uprawnień.\
> Aktualizuj rejestr etapów i tasków **w tej samej Karcie**. Po wyczerpaniu dopuszczonego zakresu przedstaw rozliczenie: rezultat, spełnione i niespełnione DoD, status, PR/SHA/CI/deployment, testy, dowody, braki i następny krok. Zachowaj prawdziwy status `CZĘŚCIOWY` lub `ZABLOKOWANY`, jeśli DoD nie jest spełniona.\
> **Po rozliczeniu E1 zakończ mandat wykonawczy i zatrzymaj pracę. Nie rozpoczynaj E2 ani jego niezależnych przygotowań, preflightu mutacji, migracji, zmian zasobów czy deploymentów. E2 wymaga nowej wyraźnej dyspozycji właściciela.** Plan następnego etapu można odczytać i opisać wyłącznie informacyjnie.

Dla następnego etapu użyj tej samej komendy, zmieniając identyfikator na `E2`, `E3` itd. Nie twórz osobnych launcherów etapowych. Skrócona komenda `URUCHOM ETAP E1` wystarcza, gdy bieżący kontekst jednoznacznie wskazuje istniejącą Kartę i zaakceptowaną roadmapę; w nowej rozmowie podaj jej link lub initiativeId. Nie zgaduj inicjatywy ani zakresu.

**ONE STAGE → ONE EXPLICIT OWNER MANDATE → FULL AUTOPILOT WITHIN THAT STAGE → STAGE CLOSEOUT → STOP → NEXT OWNER MANDATE.**

Akceptacja roadmapy, zakończenie taska, CI PASS, merge ani rozliczenie poprzedniego etapu nie zastępują dyspozycji startu następnego. Niezależne autoryzowane prace przy lokalnej blokadzie można kontynuować wyłącznie w bieżącym etapie. Decyzję o rozpoczęciu kolejnego etapu mimo niepełnego wcześniejszego DoD zapisz jawnie zgodnie z kanonem, bez fałszowania statusów.

## 4. Źródła referencyjne launchera

Obowiązujące dokumenty instrukcyjne znajdują się na `main` repozytorium `profitia/SG-dev`. `AGENTS.md` i manifest governance są źródłami mechanizmu ładowania, a nie zastępstwem dla aktywnego kanonu BSDC. Wcześniejszy PR #1031 dokumentuje pochodzenie czterech instrukcji referencyjnych.

- **BSDC Canon v1.1:** https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md — potwierdź aktywny wpis manifestu na aktualnym `main`.
- **BUSINESS OUTCOME ENGINEERING v1.1:** https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/business-outcome-engineering-v1.1.md
- **UNIVERSAL PROJECT EXECUTION v1.2 — ACTIVE:** https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/profitia-universal-project-execution-v1.2.md
- **FULL AUTOPILOT v2.0:** https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/full-autopilot-v2.md
- **UX/UI Design Canon / MagicPath** — stosuj warunkowo: https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/ux-ui-design-canon.md

## 5. Oczekiwany format pierwszej odpowiedzi

```text
BSDC: STARTED / RESUMED / PERSISTENCE_BLOCKED
Inicjatywa: <nazwa>
projectKey: <właściwy projekt>
initiativeId: <stabilny identyfikator>
Karta Projektu: <zweryfikowany link GitHub albo BRAK — z powodem>
Stan A–F: A=..., B=..., C=..., D=..., E=..., F=...
Ustalone: <jedno lub dwa zdania>
Następny krok / decyzja: <jedno konkretne pytanie albo propozycja>
```

Przy `PERSISTENCE_BLOCKED` nie przedstawiaj nieistniejącego linku. Zwróć minimalne instrukcje dokończenia inicjalizacji w uprawnionym środowisku. Przy `STARTED` i `RESUMED` potwierdź odczytem, że karta rzeczywiście istnieje.


## 6. Zgodność wsteczna

Zakończone i zaakceptowane inicjatywy v1.0 zachowują ważność decyzji, statusów i zamrożonych rewizji. Nie oznaczaj E6 jako wstecznie niespełnionego warunku ich akceptacji. Objęcie takiego projektu v1.1 wymaga wyraźnej decyzji właściciela.

Trwające inicjatywy uzupełniają E6 w tej samej Karcie przy kolejnym merytorycznym wznowieniu zgodnie z kanonem v1.1. Nie aktualizuj automatycznie istniejących Kart podczas publikacji standardu. Żadna migracja ani komenda wznowienia BSDC nie jest zgodą na wykonanie etapu.

---

**Launcher nie jest grantem wykonawczym.** Autoryzuje rozpoczęcie rozmowy projektowej oraz zapis roboczej karty wyłącznie wtedy, gdy dopuszczają to aktywne reguły i uprawnienia. Nie wymusza nowych zasobów, obejść governance ani wdrożenia produktu.
