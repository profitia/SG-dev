# PROFITIA — BSDC LAUNCHER v1.0
## Krótka komenda uruchomienia procesu w ChatGPT lub Codex

**Status:** `ACTIVE` — obowiązuje po publikacji launchera i BSDC Canon v1.0 w aktywnym manifeście na `main`  
**Cel:** rozpocząć lub wznowić prowadzenie nowej inicjatywy metodą BSDC, z **jedną trwałą Kartą Projektu BSDC** na GitHubie, bez automatycznego uruchamiania developmentu.  
**Zależność:** aktywny [BSDC Canon v1.0](../../Canon/v1.0-business-solution-design-and-canonization-canon.md) jest źródłem checklisty A–F, statusów i formatu Karty Projektu.  
**Zastosowanie:** identyczny tekst w ChatGPT i Codex; nazwa narzędzia nie zmienia reguł.

## 1. Launcher — komenda do skopiowania

> **URUCHOM BSDC v1.0**  
> Potrzeba biznesowa: **[OPISZ SWÓJ POMYSŁ]**  
> Projekt/profil (jeśli znany): **[SG2 / ARCHITECTURE / SRM / inny / ustal sam]**  
>  
> Pracuj zgodnie z aktywnym **BSDC Canon v1.0** oraz **Business Outcome Engineering v1.1**. Prowadź ze mną konsultacje przez checklistę A–F, nie wymagając ręcznego wypełniania pól.  
>  
> **Na samym początku** sprawdź, czy ta inicjatywa ma już Kartę Projektu BSDC. Jeśli istnieje, wznów ją. Jeśli nie, **utwórz w tej sesji jeden nowy, trwały, projektowy dokument „Karta Projektu BSDC / Project Design Record” na GitHubie**, we właściwej ścieżce i przez dopuszczony workflow. Zapisz w nim opis potrzeby, checklistę A–F, status `WORKING / NOT_ACCEPTED`, ustalenia oraz punkt wznowienia. Nie traktuj go jako zaakceptowanego kanonu rozwiązania.  
>  
> **W pierwszej odpowiedzi zwróć bezpośredni, zweryfikowany link do zapisanej Karty Projektu**, jej `initiativeId`, status A–F i proponowany kolejny krok. Każdą istotną decyzję i stan pracy aktualizuj **w tym samym pliku**, tak aby można było wznowić projekt w ChatGPT lub Codex, niezależnie od historii rozmowy. Przy wznowieniu zawsze odczytaj aktualną wersję z GitHuba.  
>  
> Jeżeli zapis jest niemożliwy z powodu braku uprawnień, dostępu do narzędzi lub routingu, **nie wymyślaj linku ani nie deklaruj trwałego zapisu**. Zwróć `PERSISTENCE_BLOCKED`, gotową treść dokumentu i najmniejsze konkretne działanie potrzebne do jego utworzenia.  
>  
> Zadaj mi tylko niezbędne pytania biznesowe, samodzielnie zweryfikuj odpowiednie istniejące komponenty i kanony. W sekcji D przedstaw **drzewo katalogów monorepo** z proponowanym nowym/rozszerzanym komponentem i jego ownership/routingiem. Pokazuj krótki status A–F; pełną checklistę na żądanie i przed odbiorem.  
>  
> Rezultatem BSDC ma być **projekt kanonu biznesowo-architektonicznego z planem etapów i kryteriami odbioru**, a po konsultacjach — kanon do mojej akceptacji. **Nie implementuj, nie modyfikuj kodu produktu, nie twórz zasobów i nie wdrażaj bez odrębnego upoważnienia.** Po autoryzacji realizacji stosowane będą **Universal Project Execution v1.2** i **Full Autopilot v2.0**, z obowiązującym profilem, routingiem i governance.

## 2. Wznowienie projektu — krótka komenda

> **WZNÓW BSDC v1.0** z Karty Projektu: **[WKLEJ LINK GITHUB LUB initiativeId]**.  
> Odczytaj najnowszy zapis, pokaż etap A–F, ostatnią decyzję i następny krok; kontynuuj w tej samej Karcie Projektu. Nie zakładaj znajomości poprzedniej rozmowy i nie twórz nowej karty.

## 3. Źródła referencyjne launchera

Obowiązujące dokumenty instrukcyjne znajdują się na `main` repozytorium `profitia/SG-dev`. `AGENTS.md` i manifest governance są źródłami mechanizmu ładowania, a nie zastępstwem dla aktywnego kanonu BSDC. Wcześniejszy PR #1031 dokumentuje pochodzenie czterech instrukcji referencyjnych.

- **BSDC Canon v1.0:** https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-business-solution-design-and-canonization-canon.md — potwierdź aktywny wpis manifestu na aktualnym `main`.
- **BUSINESS OUTCOME ENGINEERING v1.1:** https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/business-outcome-engineering-v1.1.md
- **UNIVERSAL PROJECT EXECUTION v1.2 — ACTIVE:** https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/profitia-universal-project-execution-v1.2.md
- **FULL AUTOPILOT v2.0:** https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/full-autopilot-v2.md
- **UX/UI Design Canon / MagicPath** — stosuj warunkowo: https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/ux-ui-design-canon.md

## 4. Oczekiwany format pierwszej odpowiedzi

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

---

**Launcher nie jest grantem wykonawczym.** Autoryzuje rozpoczęcie rozmowy projektowej oraz zapis roboczej karty wyłącznie wtedy, gdy dopuszczają to aktywne reguły i uprawnienia. Nie wymusza nowych zasobów, obejść governance ani wdrożenia produktu.
