# Karta Projektu BSDC — ciągłe doskonalenie jakości asystenta SpendGuru

| Pole | Wartość |
| --- | --- |
| initiativeId | BSDC-20261112-CIC-ASSISTANT-CONTINUOUS-QUALITY |
| projectKey / profil prowadzący | ARCHITECTURE |
| Owner biznesowy | Profitia — właściciel produktu |
| Zakres współpracy | ARCHITECTURE koordynuje projekt; CIC zachowuje reguły rozmowy; SG2 odpowiada za integrację w SpendGuru |
| Repozytorium / authority | profitia/SG-dev / main |
| Ścieżka | Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md |
| Gałąź robocza | architecture/cic-quality-stage1-control-20261112 |
| Status BSDC / projektu | COMPLETED / OWNER_APPROVED |
| Realizacja | ETAP 1 — W_TOKU; ETAP 2 — NIE_ROZPOCZĘTY / BRAK ZLECENIA |
| Aktywacja rozwiązania | NOT_ACTIVE / IMPLEMENTACJA_CZĘŚCIOWA; brak odbioru runtime |
| Zaakceptowana propozycja | Rewizja 5; commit 3f79f10a1e8b6df4dc9176634ee6339675df5f7a; blob 695164e98b1562acb00aa937ca6003726f6ca368 |
| Projekt rozwiązania | OWNER_APPROVED — zamrożona specyfikacja v1 w §4–5, decyzja DEC-03; bez aktywacji kanonu wykonawczego |
| Tryb | EXECUTION — Full Autopilot wyłącznie etap 1; DEC-06 |
| Etap | F — zakończony; A–F domknięte projektowo, 28/28 USTALONE |
| Utworzono / zaktualizowano | 2026-11-12 / 2026-11-13, Europe/Warsaw |
| Rewizja | 10 — zapis akceptacji CI, skuteczny G1 i faktyczny postęp komponentów etapu 1 |
| Rewizja bazowa ostatniej aktualizacji | PDR rewizja 9 / blob f0c81253cd20d4f2b75f8eabf2adb47d538c20fc; main 69a2cc1769d34cb6ecf1e21a552babb0006a5713. Referencja wykonawcza właściciela nadal rewizja 8. |
| Zadanie inicjalizacji | ARCH-BSDC-CIC-QUALITY-INIT-20261112 |
| Zadanie bieżącej aktualizacji | ARCH-CIC-QUALITY-STAGE1-CONTROL-20261112; zadania producentów i odbiorcy w §8.7 |
| Upoważnienie | Jawne zlecenie etapu 1 według rewizji 8, w Full Autopilot i granicach właściwych ownerów/dopuszczeń. Po wyniku weryfikacja właściciela. Bez etapu 2; zasoby owner-only i szczególne granty zachowują własne warunki. |
| Harmonogram wykonania | §8.1–8.6: 2 etapy / 19 tasków; realizowany tylko etap 1; DEC-05/06: weryfikacja właściciela i osobne GO przed etapem 2 |

Publiczna karta zawiera opis potrzeby i stan konsultacji. Nie zawiera transkryptów, wyników odczytów prywatnych systemów, danych użytkowników/klientów, materiałów prywatnego repozytorium CIC ani sekretów. Bieżący commit zapisu potwierdza się odczytem GitHuba poza plikiem. Publikacja gałęzi nie oznacza przyjęcia do main ani aktywacji. Merytoryczna akceptacja rozwiązania wynika z decyzji właściciela DEC-03.

## 1. Potrzeba i rezultat biznesowy

Właściciel chce rozwinąć CIC o automatyczną, ciągłą ocenę i poprawę jakości odpowiedzi asystenta SpendGuru na podstawie rzeczywistych interakcji. Nie może ręcznie przeglądać wszystkich rozmów, diagnozować nieprawidłowości i zlecać kolejnych poprawek. Oczekuje minimalnego własnego udziału oraz racjonalnego kosztu.

Zakres potrzeb obejmuje jakość językową, merytoryczną, logiczną i kontekstową, ustalanie przyczyn błędów, zapobieganie nawrotom, autonomiczne wykonywanie dopuszczonych napraw i sprawdzanie efektu. Analiza nocna jest możliwym sposobem realizacji, nie narzuconą technologią. Przypadek błędnego rozumienia zakresu czasu jest przykładem potrzeby, nie kompletną specyfikacją.

Odbiorcy: użytkownicy SpendGuru w różnych modułach oraz właściciel produktu. Wyjątki powinny trafiać do właściwych specjalistów, bez tworzenia kolejki rutynowych zadań dla właściciela.

Wynik: mniej istotnych błędów docierających do użytkowników, mniej nawrotów i rosnący udział skutecznych napraw zakończonych bez ręcznego zlecania kolejnych kroków. Monitoring lub samo przygotowanie PR nie realizują całego celu.

Dodatkowo potrzebny jest wspólny standard CIC/Assistant Context Gateway dla braku, nieaktualności i sprzeczności danych, niezgodności z pytaniem, niejednoznaczności, awarii integracji, braku możliwości weryfikacji oraz sprzeczności w odpowiedzi.

## 2. Ustalenia i przyjęte decyzje

Wcześniejsza rozmowa obejmowała analizę architektury, porównanie możliwości technologicznych i gotowych rozwiązań oraz doprecyzowanie przez właściciela dwóch najważniejszych braków:

- A: konkretny mechanizm automatycznego uruchamiania wykonawcy, testowania, PR, dopuszczonego scalania/promocji i odzyskiwania kontroli po niepowodzeniu;
- B: kryteria wykrywalności, fałszywych alarmów, skuteczności napraw, gotowości do autonomii i wycofania.

Te wymagania są częścią potrzeby. Właściciel przyjął granicę środowiska v1 w DEC-01 oraz projektowe limity modeli w DEC-02. Rewizja 5 scala ustalenia w kompletną propozycję v1 (§4–5). Właściciel przyjął ją w całości w DEC-03; rewizja 6 utrwala tę akceptację i zamyka BSDC, bez uruchomienia wykonania.

### 2.1. DEC-01 — decyzja właściciela, 12 listopada 2026

**PRZYJĘTA DECYZJA PROJEKTOWA:** v1 obejmuje autonomiczne naprawy, scalanie oraz wdrożenia dopuszczonych klas zmian do **Development**. **Production będzie rozpatrywane później**, poza v1. Właściciel polecił zapisanie tej decyzji i kontynuację BSDC **nadal bez implementacji**.

Decyzja ustala zakres projektowanego rozwiązania. Nie uruchamia obecnie agenta, merge do main, kosztów, nowych zasobów ani deploymentów. Nie nadaje przyszłemu systemowi prawa zmiany własnego mandatu. Staging również nie zostaje domyślnie dodany do zakresu. Wykonanie będzie wymagało przyjęcia odpowiednich reguł i odrębnego upoważnienia zgodnie z aktywnym governance.

Przyjęty kierunek v1 (DEC-03): połączyć kontrolę odpowiedzi przed jej pokazaniem z późniejszym procesem wykrycie → diagnoza → test → poprawka → niezależna weryfikacja → dopuszczone uruchomienie → sprawdzenie skutku. Wykonawca przygotowuje zmianę, a odrębny kontroler egzekwuje zakres i warunki promocji oraz nadzoruje wynik.

Przyjęto wariant v1 opisany w §4–5: reuse istniejących zdolności, ograniczony kontroler i izolowany wykonawca. Techniczne dopuszczenie konkretnej instalacji, poświadczeń i dokładnych ścieżek jest przyszłym warunkiem wykonania, nie niezamkniętą decyzją projektową BSDC.

### 2.2. DEC-02 — potwierdzony limit pilotażu, 12 listopada 2026

**PRZYJĘTA DECYZJA PROJEKTOWA:** 50 USD łącznie na dodatkowe wywołania modeli podczas 14-dniowego pilotażu, maksymalnie 5 USD na incydent, bez automatycznego zwiększania. Limit obejmuje QA, replay i wykonawcę napraw; nie jest limitem dziennym. Okres pilotażu rozpocznie się po odrębnie autoryzowanym uruchomieniu, nie w dniu tej decyzji.

Hosting, storage i CI pozostają do osobnego oszacowania. Potwierdzenie limitu nie uruchamia wydatków, nie zatwierdza nowego zasobu ani implementacji. Limit dwóch prób nie należał do samej decyzji DEC-02; został następnie przyjęty wraz z pełną rewizją 5 w DEC-03.

### 2.3. Zaakceptowane v1 w skrócie — zakres DEC-03

| Pytanie właściciela | Przyjęty projekt v1 |
| --- | --- |
| Co otrzymamy? | Ocenę realnych rozmów i pełny obieg naprawy: diagnoza → test → kod/reguła → niezależne sprawdzenie → Development → sprawdzenie skutku/rollback. |
| Co naprawia się samo? | C1: daty i zakres; C2: wierność źródłu; C3: egzekwowanie ustalonej polityki wyjątków. Inne problemy podlegają diagnozie i trafiają do ownera technicznego. |
| Gdzie kończy się autonomia? | Brak Production, nowych uprawnień/dostawców, zmian finansowych metod, własnych bramek lub mandatu. Rutynowe naprawy do Development bez właściciela po jednorazowym dopuszczeniu. |
| Kiedy uznamy sukces? | Najpierw pełny techniczny odbiór trzech różnych przypadków z recovery. W pilotażu cel ≥80% kwalifikujących się realnych incydentów zamkniętych bez ręcznego wykonania, zero krytycznych regresji, jawne pokrycie i próby. Pełne mianowniki w §5.5. |
| Co dzieje się po pogorszeniu? | Stop i kontrolowany rollback własnej wersji; cel decyzji ≤5 min i sprawdzonego LKG ≤15 min później. Nigdy cofanie cudzej nowszej zmiany lub bazy danych. |
| Dane, miejsce i koszty | Prywatny dowód do 7 dni/metadane do 90 dni; agent tylko syntetyk. Render kontroler + jednorazowa VM GitHub. Przyjęte 50 USD dotyczy modeli; zasoby i praca zespołu osobno. |
| Co oznacza akceptacja DEC-03? | Przyjęcie opisanego projektu i kryteriów. Implementacja, aktywacja mandatu, dane i wydatki wymagają późniejszego osobnego upoważnienia. |

### 2.4. DEC-03 — akceptacja pełnej propozycji v1 i zamknięcie BSDC, 12 listopada 2026

**Decyzja właściciela: OWNER_APPROVED.** Właściciel jednoznacznie zaakceptował „propozycję v1 z rewizji 5”, polecił zapis akceptacji w tej samej Karcie i zakończenie BSDC, **nadal bez implementacji**.

- Przedmiot akceptacji: [pełna rewizja 5](https://github.com/profitia/SG-dev/blob/3f79f10a1e8b6df4dc9176634ee6339675df5f7a/Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md), commit 3f79f10a1e8b6df4dc9176634ee6339675df5f7a, blob 695164e98b1562acb00aa937ca6003726f6ca368.
- Zakres: kompletny pakiet biznesowo-architektoniczny i plan v1, w tym C1–C3, R-DATA-01, R-EXEC-01, kryteria sukcesu/gotowości, limity, wyjątki, bramki promocji, stop/rollback, dwa etapy i warunki przyszłego wykonania. DEC-01 i DEC-02 zachowują moc.
- Skutek: proces projektowania/konsultacji BSDC jest zakończony, checklista A–F domknięta. Nie oznacza to osiągnięcia wskaźników lub wykonania testów produktu.
- Granica: brak upoważnienia do implementacji, aktywacji kanonu/mandatu/routingu, przetwarzania rozmów, wydatków, zasobów, merge do main i deploymentu. Production pozostaje poza v1.
- Rewizja 6 jest administracyjnym zapisem tej decyzji. **Treść specyfikacji §4–5 pozostaje identyczna z zaakceptowaną rewizją 5.** Jej historyczne etykiety „propozycja”, „DO AKCEPTACJI” lub „NOT_OWNER_APPROVED” opisują stan w chwili przedstawienia; aktualny status ustala DEC-03 i metryka tej Karty: OWNER_APPROVED / NOT_ACTIVE.


### 2.5. DEC-04 — tryb harmonogramu wykonawczego, 12 listopada 2026

Właściciel wymaga rozpisania realizacji na **etapy i taski end-to-end**, według zależności i wyników, a nie terminów lub estymat czasu, oraz zastosowania **Full Autopilot — Outcome First v2.0** podczas przyszłego wykonania. Rozwinięcie znajduje się w §8.1–8.6.

Decyzja dotyczy formy planu i trybu późniejszej realizacji. Nie jest poleceniem implementacji ani nowym grantem operacyjnym. DEC-03 i zamrożona specyfikacja rewizji 5 zachowują moc. Przykład harmonogramu innej inicjatywy służy wyłącznie jako wzorzec układu; nie przenosi jego akceptacji, zasobów, zakresu ani upoważnień. Taski pozostają NIE_ROZPOCZĘTE.

### 2.6. DEC-05 — osobno zlecane etapy i weryfikacja właściciela, 12 listopada 2026

**PRZYJĘTA ZASADA WŁAŚCICIELA:** realizacja etapowa. Najpierw osobno zlecony etap 1, następnie jego weryfikacja i potwierdzenie przez właściciela, a etap 2 dopiero po odrębnym jawnym zleceniu. Właściciel zachowuje prawo weryfikacji po zakończeniu każdego etapu. Obecna decyzja ustala tryb przyszłego wykonania i **nie uruchamia jeszcze etapu 1**.

- Full Autopilot v2.0 obowiązuje w granicach aktualnie zleconego etapu. Wykonawca sam prowadzi jego taski do pełnego wyniku i dowodów, naprawia usterki oraz wykonuje prawidłowo dopuszczone operacje. Rutynowe taski nie otrzymują nowych punktów akceptacji.
- Po spełnieniu kryteriów etapu wykonawca przedstawia rezultat, dowody, ograniczenia, stan środowiska oraz wykorzystany/pozostały koszt i czas pilotażu. Właściciel może przyjąć wynik albo wskazać braki. Konieczne korekty mieszczące się w zleceniu realizuje się w tym etapie, z zachowaniem rzeczywistych limitów i uprawnień.
- Zakończenie techniczne etapu, akceptacja jego wyniku oraz zlecenie następnego etapu są odrębnymi stanami. Sama akceptacja wyniku etapu 1 nie oznacza GO dla etapu 2, chyba że właściciel udzieli go wyraźnie w tym samym poleceniu.
- Między etapami nie uruchamia się regularnego QA ani nowych autonomicznych napraw/wydań etapu 2. Pozostają tylko dopuszczone zabezpieczenia, deterministyczny nadzór i recovery własnego wydania. Brak kolejnego zlecenia jest zaplanowaną granicą zakresu, nie błędem wykonawcy lub techniczną blokadą do obejścia.
- DEC-02 i §5.7 pozostają bez zmian: pierwsze płatne uruchomienie odbioru etapu 1 otwiera jedno wspólne okno 14 dni i ledger 50 USD. Oczekiwanie na ocenę właściciela nie zatrzymuje zegara, nie odnawia limitu i nie daje prawa do płatnych zadań po jego końcu. Inny model okna lub przedłużenie wymaga osobnej decyzji przed dodatkowym kosztem.

DEC-05 doprecyzowuje zakres przyszłych zleceń i zastępuje wcześniejsze założenie automatycznej kontynuacji między etapami w §8. Specyfikacja §4–5, klasy C1–C3, kryteria odbioru, środowisko i granice danych pozostają bez zmian. Żadnej zgody na cały proces nie domniemywa się z Full Autopilot.

### 2.7. DEC-06 — zlecenie realizacji wyłącznie etapu 1, 12 listopada 2026

Właściciel jawnie polecił: „Rozpocznij realizację wyłącznie etapu 1 w trybie Full Autopilot, zgodnie z Kartą Projektu w rewizji 8. Po zakończeniu przedstaw wynik i dowody do mojej weryfikacji. Nie rozpoczynaj etapu 2 bez mojego osobnego zlecenia.” Wskazał Universal Project Execution v1.2 i Full Autopilot v2.0 na main. Następnie potwierdził użycie istniejącego klucza OpenAI; jego wartość nie jest ujawniana lub publikowana.

Etap 1 ma zlecenie wykonawcze. Dotychczasowe zapisy „bez implementacji” w historii decyzji odnoszą się do wcześniejszego trybu; obowiązuje bieżący zakres DEC-06, z zachowaniem DEC-01/02/05. Nie oznacza to automatycznej gotowości środowiska, grantów danych, utworzenia owner-only zasobów lub przyjęcia pozamodelowych kosztów. Etap 2 nie został zlecony.

E1-T01 obejmuje rejestrację dwóch powierzchni §4/4.7 przed kodowaniem, po własnych bramkach: [dowód i granice G1](../../../evidence/2026-11-12-assistant-quality-stage1-g1-onboarding.md). Rejestracja źródeł staje się skuteczna na main; nie ustanawia sama uprawnień SERVICE do prywatnej historii ani klasowego mandatu promocji.

### 2.8. DEC-07 — akceptacja dokładnej propozycji CI i jej wykonanie

Właściciel odpowiedział **„Zatwierdzam propozycję #1061”** na pytanie wskazujące PR #1061 i wersję c5664838. Akceptacja dotyczyła wyłącznie pięciu wskazanych plików rejestracji CIC w istniejących chronionych testach, po wymaganych kontrolach. Nie obejmuje pomijania testów, nowych zasobów, dostępu do rozmów ani etapu 2.

[PR #1061](https://github.com/profitia/SG-dev/pull/1061) przyjęto jako 1e6c6e462840211d0c402ec4c8a0dd433f5c360f; kontrole dokładnego źródła i wynikowego main zakończyły się powodzeniem. Odświeżenia zachowały ten sam manifest pięciu plików oraz równoległe zmiany main. Następnie [G1 / PR #1042](https://github.com/profitia/SG-dev/pull/1042), źródło 9243d88d, przyjęto jako 69a2cc1769d34cb6ecf1e21a552babb0006a5713, również po pełnym wymaganym odbiorze źródła i main. AQC-BASE-001/002 są skutecznymi ścieżkami źródłowymi. To nadal nie jest mandat do prywatnych danych ani dowód autonomicznej naprawy w runtime.

Rewizja 10 aktualizuje stan wykonania i dowody. Nie zmienia zaakceptowanej specyfikacji §4–5, 19 tasków, limitów ani osobnego GO przed etapem 2.

## 3. Checklista BSDC A–F

Status USTALONE oznacza kompletność projektu; DEC-03 dodatkowo potwierdza jego merytoryczną akceptację. Wszystkie 28 kryteriów A–F są domknięte projektowo. Nie oznacza to osiągnięcia wskaźników, dopuszczenia nowych ścieżek, wykonania testów produktu lub wdrożenia. Warunki przyszłego wykonania pozostają obowiązujące.

| ID | Status | Ustalenie / dowód |
| --- | --- | --- |
| A1 | USTALONE | Potrzeba i ograniczenie pracy właściciela w §1. |
| A2 | USTALONE | Użytkownicy SpendGuru; właściciel produktu decyduje biznesowo; owner techniczny prowadzi wyjątki. |
| A3 | USTALONE | Definicje sukcesu technicznego, jakości i pilotażu oraz próby/niepewność w §5.5. |
| A4 | USTALONE | Priorytet: mniej błędów i pełna pętla naprawy przy minimalnym udziale właściciela, w granicach v1. |
| B1 | USTALONE | Minimalne discovery kodu SG2/ACG/E1, źródłowych testów i infrastruktury opisano w §4 i §6; prywatne odczyty poza publiczną kartą. |
| B2 | USTALONE | Źródło, propozycja i niezweryfikowane wykonanie rozdzielone; żaden projektowy próg nie oznacza wyniku pomiaru. |
| B3 | USTALONE | Reuse runtime/testów i integracja Codex; porównanie Render/GitHub/PostHog/Langfuse/OpenAI w §4.4 i §4.8. |
| B4 | USTALONE | Rekomendowany wariant i uzasadnienie prostoty/kosztu/ryzyka w §4.4–4.8; koszty wykonania oznaczono jako estymatę. |
| C1 | USTALONE | Wyzwalacz → dowód → diagnoza → test → poprawka → niezależne sprawdzenie → wydanie → odbiór/recovery w §5.3. |
| C2 | USTALONE | Kontrakty w §4.8, standard wyjątków §5.2, limity i stany §5.3 oraz rollback §5.6. |
| C3 | USTALONE | Trzy klasy C1–C3 i jawne wyłączenia w §5.1; Production poza v1. |
| C4 | USTALONE | Read-only weryfikacja aktualnego kanonu UX i istniejącej sesji asystenta; brak nowego panelu/wzorców; granice oraz realny odbiór UX w §5.2 i §5.7. |
| C5 | USTALONE | Pełny business DoD i próby negatywne w §5.5–5.7; samo PR/CI nie stanowi odbioru. |
| D1 | USTALONE | ARCHITECTURE prowadzi; CIC polityka, SG2 adopcja/runtime/dane; rozdział ról QA/agent/weryfikacja/publikacja. |
| D2 | USTALONE | Dokładne wyniki resolvera i NO_MATCH przedstawiono w §4.7; brak domniemania rejestracji lub zgody. |
| D3 | USTALONE | Drzewo istniejących i nowych ścieżek w §4, ownerzy i konieczny onboarding w §4.7. |
| D4 | USTALONE | Cztery wersjonowane kontrakty logiczne i granice producent–konsument w §4.8; schemat techniczny zamyka wykonawca w dopuszczonym zakresie. |
| D5 | USTALONE | Projekt celu, praw konta/organizacji, SERVICE, minimalizacji, retencji i usunięć w §4.5; aktywacja dopiero po mandacie. |
| D6 | USTALONE | Development, zasoby, monitoring, rezerwacje kosztu, model wykonania i recovery opisano w §4.4–4.8 oraz §5.6–5.8. |
| E1 | USTALONE | Dwa kompletne etapy rezultatowe w §5.7, pierwszy z pełną pętlą Development; rozwinięcie na 19 tasków w §8.1–8.6. |
| E2 | USTALONE | Dla obu etapów wskazano działające funkcje, komponenty i wyniki w §5.7. |
| E3 | USTALONE | Przygotowanie/uruchomienie wymaga osobnego upoważnienia i właścicieli; granice dopuszczenia w §5.4 i §7. |
| E4 | USTALONE | Weryfikacja dokładnej wersji, zamrożony holdout, negatywne próby, CI, live odbiór i rollback w §5.4–5.7. |
| E5 | USTALONE | Budżet modeli DEC-02, koszt bazowego workera, koszty nieobjęte limitem i estymaty czasu w §5.8; bez otwartego prawa do zakupów. |
| F1 | USTALONE | DEC-01/02/03, zaakceptowany zakres oraz warunki przyszłego uruchomienia zapisano w §2 i §7–8. |
| F2 | USTALONE | Zaakceptowany kanon biznesowo-architektoniczny v1 utrwalony jako zamrożona specyfikacja §4–5 rewizji 5; bez aktywacji i bez nowego pliku kanonu. |
| F3 | USTALONE | Właściciel przyjął pełną rewizję 5 w DEC-03; zapisano dokładny commit/blob oraz ograniczenie bez implementacji. |
| F4 | USTALONE | Jednoznaczny handoff projektowy w §8 i §5.7, uzupełniony harmonogramem tasków Full Autopilot w §8.1–8.6; bez promptu wykonawczego i bez uruchomienia execution. |

> **Zaakceptowana specyfikacja v1 — zamrożona treść rewizji 5.** Poniższe §4–5 są zachowane bez zmian dla wierności akceptacji. Ich historyczne etykiety statusu są zastąpione decyzją DEC-03: OWNER_APPROVED / NOT_ACTIVE. Nie są dowodem wdrożenia.

## 4. Architektura i umiejscowienie

Profil prowadzący wybrano zgodnie z delegacją właściciela i aktywnym rejestrem: inicjatywa obejmuje wspólną zdolność oraz współpracę kilku komponentów. Wybór nie przenosi prawa do kodu innych profili.

Robocze drzewo publicznego repozytorium: istniejące elementy i proponowane lokalizacje, bez ich tworzenia:

```text
profitia/SG-dev/                           authority: main
├── Canon/proposals/bsdc/ARCHITECTURE/
│   └── cic-assistant-continuous-quality.md [ISTNIEJĄCY DOKUMENT / jedyny cel aktualizacji]
├── apps/sg-runtime/                      [ISTNIEJE / potencjalne ROZSZERZENIE / SG2]
│   ├── lib/assistant/                   [ISTNIEJE / dowody i kontrola publikacji]
│   │   └── quality-evidence.ts          [NOWY — PROPOZYCJA / SG Runtime / SG2]
│   └── migrations/assistant/            [ISTNIEJE]
│       └── 002-quality-evidence.sql     [NOWY — PROPOZYCJA / SG Runtime / SG2]
├── packages/
│   ├── assistant-context-contracts/      [ISTNIEJE / INTEGRACJA / ARCHITECTURE]
│   ├── assistant-context-gateway/        [ISTNIEJE / ROZSZERZENIE / ARCHITECTURE]
│   └── assistant-quality-control/       [NOWY — PROPOZYCJA / ROUTING WYMAGA AKCEPTACJI]
│       └── src/controller.mjs           [dokładny kandydat / proponowany owner: Architecture Platform]
└── .github/workflows/
    └── assistant-quality-repair.yml     [NOWY — PROPOZYCJA / ROUTING WYMAGA AKCEPTACJI]
```

Źródło istniejących katalogów: publiczne drzewo SG-dev/main, odświeżone do 46094e56. PDR rozstrzygnięty przez aktualny resolver: Governance Source Layer / ALIGNED / ARCHITECTURE ALLOWED. Nowy dokument nie zmienia klasyfikacji powierzchni.

Pakiet kontrolera jest konkretną propozycją do weryfikacji, nie zatwierdzoną lokalizacją. Ma sens jako mała jednostka wykonawcza z własnym stanem, ograniczeniami i recovery; nie wymaga osobnej aplikacji webowej ani panelu. ACG nadal odpowiada za kontekst, CIC za politykę rozmowy, a PMOS za historię prac inżynierskich; żaden z nich nie staje się przez podobieństwo nazwy produkcyjnym kontrolerem napraw.

Jeżeli prostsze rozszerzenie istniejącej legalnej lokalizacji spełni te odpowiedzialności, zastąpi kandydata. Nowe ścieżki wymagają właściwego onboardingu przed implementacją. Integracje CIC i SG2 pozostają zadaniami ich ownerów. Obecnie nie modyfikuje się rejestrów ani kodu produktu.

### 4.1. Odpowiedzialności i kontrakty logiczne — projekt

| Element | Odpowiedzialność i wynik |
| --- | --- |
| CIC | Kryteria odpowiedzi i wspólny standard sytuacji nietypowych; wersjonowane przypadki akceptacyjne. |
| Gateway | Sprawdzenie dopasowania źródeł do zadania, ich zakresu, pochodzenia i dostępności; nie poprawia arbitralnie danych producenta. |
| Runtime SpendGuru | Zapis minimalnego dowodu oraz kontrola przed publikacją odpowiedzi; rozliczone i ograniczone próby odzyskania wyniku. |
| Kontroler | Kwalifikacja incydentu, deduplikacja, uruchomienie wykonawcy, kontrola uprawnień i kosztu, niezależne warunki scalenia/wydania i nadzór po wydaniu. |
| Wykonawca | Izolowana praca nad konkretną poprawką i testem. Zwraca zmianę i dowody; nie zatwierdza sam własnego wydania. |
| Weryfikacja i publikacja | Sprawdzenie dokładnej zmiany, obowiązkowych testów i aktualnego mandatu; dopuszczone scalenie i wydanie Development oraz realny odbiór. |

Przepływ wymaga czterech kontraktów logicznych: (1) dowód interakcji z wersjami i prawami, (2) incydent i jego kwalifikacja, (3) zadanie naprawcze z granicami i budżetem, (4) wynik sprawdzenia i wydania z możliwością odzyskania. Ich techniczne formaty nie są jeszcze zamrożone.

Rekomendacja wykonawcza R-EXEC-01: programowo uruchamiany Codex w jednorazowym środowisku GitHub Actions, sterowany przez zaufany kontroler Render (§4.4). Osobista aplikacja właściciela nie uczestniczy w działaniu. Oficjalne narzędzia zapewniają uruchamianie i obsługę wyniku, lecz nie zastępują polityki danych, kosztu, niezależnych testów ani mandatu wydania. Zwykłe publiczne CI nie otrzymuje domyślnie nowych sekretów lub uprawnień; nowy proces wymaga osobnego dopuszczenia.

### 4.2. Dane — projektowe granice

Surowy dowód interakcji i materiał źródłowy pozostają prywatne. Publiczny PR zawiera wyłącznie kod, bezpieczny syntetyczny test i opis przyczyny bez danych użytkownika. Do obserwacji trafiają potrzebne metadane i wyniki, bez domyślnego kopiowania całej rozmowy do wielu usług.

QA korzysta z odrębnego, ograniczonego celu i uprawnienia systemowego, bez podszywania się pod użytkownika. Prawa źródła, usunięcie i retencja obejmują także pochodne. Wcześniejsze użycie źródła nie oznacza nieograniczonego prawa do późniejszego replay. Okresy retencji i dopuszczeni przetwarzający pozostają do konsultacji. Żadne dane prywatne ani materiały prywatnego CIC nie są publikowane w tej karcie.

### 4.3. Odświeżone discovery i brakujący dowód odtworzenia

Poniższe ustalenia pochodzą z publicznego kodu SG-dev/main 4a15718e; w rewizji 4 potwierdzono niezmienione istotne pliki do main 46094e56. Nie są wynikiem odczytu rozmów lub potwierdzeniem aktywnego wdrożenia.

| Potwierdzone w źródłach | Wniosek projektowy |
| --- | --- |
| Historia zapisuje pytanie, odpowiedź, status, referencje/wersje źródeł i metadane źródeł. | Nadaje się do wyboru przypadków; sama nie gwarantuje pełnego odtworzenia dokładnego kontekstu i instrukcji użytych przy generacji. |
| Dostęp historii w kodzie wymaga aktora HUMAN i sprawdza zgodność użytkownika. | Nocny proces QA potrzebuje własnego, jawnie dopuszczonego kontraktu. Nie można po prostu podłączyć administratora ani podszyć się pod użytkownika. |
| Migracja definiuje wygasanie rozmów po 30 dniach, z odnowieniem przy zapisie, oraz usuwanie kaskadowe. | Trzeba sprawdzić rzeczywistą adopcję i propagację usunięć. Pilotaż QA nie otrzymuje prawa do wydłużania retencji. |
| Model używa Responses API z `store:false`; istnieje osobne rozliczanie i obsługa niepewnego kosztu. | Nie opierać replay na domniemanym archiwum dostawcy. Wykorzystać wzorzec rezerwacji kosztu, zachowując osobny cel i limit QA. |

Minimalny projektowy dowód interakcji powinien wiązać: czas otrzymania pytania i strefę czasową, rozpoznany zakres zadania, wersje aplikacji/instrukcji/modelu/Gateway, rzeczywiście przekazany kontekst lub uprawniony niezmienny odpowiednik, wynik oraz status walidacji. Skrót treści wykrywa zmianę, ale sam nie zastępuje treści potrzebnej do oceny. Przy braku praw do zachowania kontekstu wynik oceny brzmi „niewystarczający dowód”, zamiast zgadywanej winy modelu.

Replay odnosi się do czasu i danych pierwotnego pytania, nie do daty nocnego zadania. Nowsze dane mogą służyć osobnej próbie bieżącego zachowania, ale nie dowodzą, że wcześniejsza odpowiedź była błędna. Kontrole dat powinny rozdzielać termin publikacji od okresu, którego dotyczy raport.

Rekomendacja danych v1: minimalny prywatny dowód, separacja organizacji i celów, brak domyślnej kopii całych rozmów w CI/telemetrii. Materiał pochodny nie przedłuża praw ani retencji źródła; usunięcie/revokacja obejmuje kolejkę, cache i dowody zawierające dane. Do trwałej regresji trafia bezpieczny syntetyczny przypadek. Pseudonimizacja identyfikatora sama nie oznacza anonimowości. Szczegółowy mandat przetwarzania pozostaje do przyjęcia.

### 4.4. R-EXEC-01 — rekomendowane miejsce uruchamiania

**Rekomendacja, nie decyzja właściciela:** zaufany kontroler i prywatna ocena QA w małym **Render Background Worker, Development, Frankfurt**; wykonawca kodu na **jednorazowej wielordzeniowej VM GitHub-hosted Ubuntu**, uruchamianej przez dopuszczony workflow z autorytatywnej wersji. Wykorzystać oficjalny Codex GitHub Action, przypięty do sprawdzonej wersji, zamiast osobistej aplikacji właściciela. Dobór konkretnej konfiguracji i dostęp kont pozostają do dopuszczenia.

| Wariant | Ocena względem v1 |
| --- | --- |
| Render worker + GitHub-hosted VM | Rekomendowany: stały nadzór/recovery oraz odtwarzalne, jednorazowe środowisko kodu, integracja z istniejącym repozytorium i testami. |
| Tylko nocny cron | Tańszy prosty przegląd; dodatkowego mechanizmu wymaga ciągły nadzór nad zadaniem i skutkiem wydania. |
| Render Sandboxes | Sensowna alternatywa dla izolowanego kodu; aktualnie public beta, bez ogólnie dostępnego brokera poświadczeń i scoped API keys. Nie uzależniać od tego pierwszej wersji. |
| Istniejący serwer aplikacji, PMOS lub komputer właściciela | Nie rekomenduje się uruchamiania tam wygenerowanego kodu. Reuse wzorców i narzędzi nie oznacza prawa użycia cudzej usługi lub danych. |

[Render opisuje worker jako proces bez adresu do przyjmowania żądań](https://render.com/docs/background-workers), więc kontroler pobiera pracę i statusy z zewnętrznego trwałego stanu. To także powód, aby nie planować go jako publicznego serwera proxy. Ocena może być uruchamiana nocą, a kontroler pozostaje gotowy do recovery i monitorowania. Postgres wystarczy dla stanu incydentu, dzierżawy, prób i rezerwacji kosztu; Redis i osobna platforma orkiestracji nie są warunkiem v1.

[GitHub-hosted runner wielordzeniowy jest nową VM dla joba](https://docs.github.com/en/actions/concepts/runners/github-hosted-runners). [Oficjalna akcja Codex](https://learn.chatgpt.com/docs/github-action) uruchamia CLI i proxy Responses; wymagane są ograniczenia uprawnień. Jej obecność nie dowodzi bezpiecznej konfiguracji SpendGuru. [Render Sandboxes](https://render.com/docs/sandboxes) pozostaje alternatywą po sprawdzeniu ograniczeń beta i rzeczywistych uprawnień.

Kontroler, wykonawca i publikacja mają odrębne role. Wykonawca nie otrzymuje tokenów bazy, historii, E1, Render ani uprawnień do scalenia. Zwraca ograniczoną zmianę i artefakt. Kontroler sprawdza zakres i dowody; osobna zaufana faza publikuje zatwierdzoną zmianę. Candidate code nie wykonuje się w procesie z poświadczeniami instalacji/wydania, a agent nie modyfikuje własnych bramek.

Nie należy traktować sesji SDK jako jedynego stanu zadania. Nowa VM może rozpocząć świeżą sesję od zatwierdzonego manifestu, bazowego SHA i zweryfikowanej poprawki. Wznowienie logicznego incydentu nie zależy od zachowania dysku runnera. Niepewny dispatch uzgadnia się po identyfikatorze korelacji i stanie GitHuba przed ponowieniem.

### 4.5. R-DATA-01 — projekt zasad danych QA

**Wszystkie poniższe reguły są rekomendacją do kanonu, nie nowym uprawnieniem do przetwarzania.** Cel: wykrywanie i usuwanie wad działania asystenta oraz sprawdzenie skutku zmiany. V1 nie obejmuje trenowania modeli na rozmowach, profilowania pracowników ani przenoszenia prywatnej wiedzy jednej organizacji do innych.

**Warunek dopuszczenia:** aktualny cel przetwarzania, prawa konta i źródeł, dopuszczony przetwarzający oraz środowisko Development. Historia jest ACCOUNT_PRIVATE; samo członkostwo w organizacji ani zgoda administratora organizacji nie nadają prawa do wszystkich prywatnych rozmów. Wymagany jest jawny mandat także dla zakresu konta. Nie przesądza się tu prawnej podstawy ani modelu zgód — trzeba je potwierdzić z odpowiedzialnym właścicielem danych i prywatności.

Aktorem QA pozostaje SERVICE. Nowy, ograniczony kontrakt odczytu/projekcji dowodów jest domyślnie wyłączony i nie może rozszerzać po cichu obecnych operacji HUMAN ani podszywać się pod użytkownika. Powiązanie obejmuje aplikację, środowisko, serviceId, cel/policyVersion, konto, organizację dla każdej prywatnej części źródła i dopuszczoną projekcję. Uprawnienia sprawdza się przed pobraniem, wysłaniem do modelu oraz publikacją wyniku; odwołanie blokuje dalsze użycie. Kolejka, cache, deduplikacja i eksport zachowują granice konta i organizacji.

| Materiał | Gdzie / kto | Proponowana retencja i ograniczenia |
| --- | --- | --- |
| Istniejąca historia rozmów | Dotychczasowy prywatny produktowy magazyn, obecne reguły dostępu | Bez zmiany przez ten projekt. Migracja określa rolling 30 dni; aktywne wdrożenie i backupy trzeba osobno potwierdzić. |
| Minimalny dowód QA: potrzebny fragment pytania/odpowiedzi, kontekstu i wersji | Prywatny obszar danych produktu SG2; odrębny kontrakt i rola QA | Dostęp do min(7 dni od interakcji, termin źródła, odwołanie prawa/usunięcie). Ponowienie lub aktywność rozmowy nie wydłużają terminu dowodu QA. |
| Metadane incydentu i wydania bez treści | Prywatny zapis operacyjny kontrolera | Do 90 dni, z usuwaniem powiązań osobowych według żądania/polityki. Pseudonim lub hash nie jest automatycznie anonimowy. |
| Przypadek regresyjny dla wykonawcy/PR | Wyłącznie bezpieczny syntetyczny opis, kod i dane testowe | Może pozostać z testem, jeśli nie zawiera danych prywatnych ani odwracalnego powiązania z rozmową. Nie wystarcza sama zamiana nazwy firmy. |

Ważność dowodu jest sprawdzana przy każdym użyciu, niezależnie od sprzątania. Proponowany fizyczny purge aktywnych kopii: do 24 godzin od wygaśnięcia/usunięcia, z natychmiastowym odcięciem dostępu. Backupy mają osobny, zweryfikowany horyzont i nie służą QA; po restore trzeba zastosować rejestr usunięć przed udostępnieniem danych. Nie obiecuje się natychmiastowego usunięcia z wszystkich kopii dostawców.

Zachowywać tylko materiał faktycznie potrzebny do diagnozy, z wersjami i pochodzeniem. Nie pobierać ponownie płatnych/licencjonowanych źródeł bez własnego prawa i budżetu. Zmiana aktualnych danych nie zastępuje dowodu historycznego. Brak praw lub niepełny dowód oznacza wynik nierozstrzygalny i obniża raportowane pokrycie oceny; nie oznacza poprawności odpowiedzi.

**Granica wysyłki:** model oceny otrzymuje minimalny dopuszczony materiał. Wykonawca kodu dostaje wyłącznie syntetyczny przypadek i kontrakt oczekiwanego zachowania. Jeżeli bezpieczny syntetyk nie zachowuje istoty błędu albo nie można wykluczyć ujawnienia, ścieżka automatycznej publikacji nie uruchamia się. Nie przenosić surowych rozmów, wyników źródeł, PII ani sekretów do publicznych logów/artefaktów GitHuba, Sentry czy PostHog. Telemetria zawiera kody, wersje, opóźnienia i liczniki; małe kohorty i identyfikatory nadal mogą ujawniać osobę.

[OpenAI Data Controls](https://developers.openai.com/api/docs/guides/your-data) rozróżnia stan aplikacji i logi bezpieczeństwa. `store:false` nie jest obietnicą zerowej retencji; domyślne logi mogą zawierać treść. ZDR wymaga przyznania i ma ograniczenia funkcji. API nie wykorzystuje danych do treningu bez opt-in. Przed przetwarzaniem należy sprawdzić konkretny projekt, poświadczenia, procesorów i wymagania lokalizacji danych; położenie workera we Frankfurcie nie gwarantuje lokalizacji całej ścieżki AI.

### 4.6. Uprawnienia wykonawcze, koszt i odtwarzanie

Zaufany workflow jest pobierany z przyjętej wersji, uruchamiany tylko przez ograniczonego kontrolera i wiąże incydent, bazowy SHA, zakres plików, klasę, policyVersion, budżet i nonce. Manifest zawiera wyłącznie materiał bezpieczny do ujawnienia; wejście nie staje się instrukcją governance. Dla v1 proponuje się jeden aktywny wykonawca i jedno wydanie na repozytorium. Rozwiązanie konfliktu lub zmiana bazowego SHA wymaga ponowienia odpowiednich dowodów, nie ślepego merge.

Oficjalny proxy akcji chroni klucz, ale sam nie stanowi gwarancji limitu 5 USD. **Przed autonomią potrzebny jest egzekwowalny limit wywołań modelu:** kontroler rezerwuje środki, a zaufany lokalny proces pośredniczący na VM ogranicza łączny koszt zadania i maksymalny koszt następnego żądania. Proces działa poza uprawnieniami agenta; konto agenta nie może ominąć go innym kluczem ani zmienić polityki. Cały dostęp do modeli, również próby z narzędzi i testów, podlega tej kontroli. Sprawdzenie wykonalności i zgodności wybranej wersji akcji z takim ograniczeniem jest warunkiem uruchomienia, nie potwierdzoną dziś funkcją. Jeżeli akcja nie pozwoli zachować tej granicy, na tej samej odizolowanej VM użyć CLI/SDK przez dopuszczony ograniczający proces, zamiast udostępniać nielimitowany klucz. Zmiana adaptera nie rozszerza zakresu lub budżetu.

Niepewne zużycie nadal zajmuje rezerwację. Środki na ocenę skutku muszą być zabezpieczone przed wydaniem; brak budżetu na obowiązkowy odbiór blokuje publikację. DEC-02 obejmuje QA i wykonawcę łącznie. Wygaśnięcie budżetu zatrzymuje nowe płatne przebiegi, a regułowy nadzór i bezpieczne wycofanie pozostają dostępne.

Według [Render Pricing](https://render.com/pricing), odczyt 12 XI 2026, bazowy worker 0.5 CPU / 512 MB kosztuje 7 USD miesięcznie. To punkt wyjścia do wymiarowania kontrolera, bez generowania i budowania kodu na nim. Koszt ten jest **poza** zatwierdzonym limitem modeli. Zużycie bazy, transfer, storage, GitHub Actions i ewentualne zmiany planu wymagają osobnego oszacowania. Nie zakłada się zerowego kosztu całej infrastruktury ani utworzenia zasobu w tej sesji.

### 4.7. Umiejscowienie danych, routing i odbiór rekomendacji

Preferowane jest wydzielone rozszerzenie istniejącego prywatnego magazynu produktu SG2: osobny obszar QA, rola i wąska projekcja. Dokładną bazę/region i instalację musi potwierdzić owner SG2. Nie używać bazy PMOS, PHR ani laboratoryjnych baz ARCHITECTURE jako magazynu transkryptów. Kontroler zachowuje jedynie niezbędny stan; payload QA nie trafia do kanonu lub publicznego śladu engineering.

Aktualny resolver dla main 46094e56:

- `apps/sg-runtime/lib/assistant/quality-evidence.ts` i `apps/sg-runtime/migrations/assistant/002-quality-evidence.sql`: SG Runtime / ALIGNED / SG2 ALLOWED; pliki nie istnieją, wynik nie zatwierdza nowej operacji ani migracji.
- `packages/assistant-quality-control/src/controller.mjs` i `.github/workflows/assistant-quality-repair.yml`: NO_MATCH; proponowany owner Architecture Platform, wymagany onboarding routingu przed utworzeniem.
- Bieżący PDR: Governance Source Layer / ALIGNED / ARCHITECTURE ALLOWED.

Zmiany kontraktu dostępu i adopcja SG2 wymagają swoich exact paths i zadań właściwego profilu. Podział organizacyjny nie może rozbić odbioru biznesowego: kompletny etap ma nadal sam wykryć, naprawić, zweryfikować i wydać dopuszczony przypadek do Development.

Przed uruchomieniem trzeba wykazać: odmowę dla obcego konta/organizacji i niedopuszczonego źródła; przerwanie po revokacji; brak użycia przeterminowanego dowodu; usunięcie i bezpieczny restore; brak treści w publicznym logu/artefakcie; niewydanie tokenów DB/deploy agentowi; blokadę ominięcia limitu modelu; wznowienie na nowej VM bez duplikatu wydania. Obowiązują również negatywne próby z §5.4. To plan testów, nie wyniki wykonania.

### 4.8. Wybór narzędzi i zamknięcie kontraktów projektu

Rekomendacja v1: wykorzystać obecny stos Node/TypeScript, Postgres, źródłowe testy SG2/ACG/E1 i kontrolowany proces GitHuba; dobudować mały kontroler oraz logikę jakości właściwą SpendGuru. CIC pozostaje ownerem polityki rozmowy; źródłowy context-selection używa planAnalyticalConversation z pakietu cic-core. Nie oznacza to istniejącej adopcji całej projektowanej pętli.

| Opcja | Decyzja projektowa i przyczyna |
| --- | --- |
| PostHog | [Ma oceny kodowe i LLM oraz próbkowanie](https://posthog.com/docs/ai-evals). W v1 wykorzystać dopuszczone metadane/wyniki; nie uruchamiać domyślnego kopiowania promptów ani drugiego portfela wywołań modeli. |
| Langfuse | [Ma eksperymenty, zbiory i bramki regresji](https://langfuse.com/docs/evaluation/overview). Dobra alternatywa, lecz nowa platforma, retencja i utrzymanie nie są warunkiem tej wersji. |
| OpenAI Evals/Graders jako zarządzana platforma | Nie wybierać dla nowego rozwiązania. Według [deprecations](https://developers.openai.com/api/docs/deprecations#2026-06-03-evals-platform), od 31 X 2026 tylko odczyt, planowane wyłączenie dashboardu i API 30 XI 2026. Metodyka evals nadal ma zastosowanie. |
| Modele przez Responses API + istniejący harness | Rekomendowane: oceny regułowe i typowane oceny modeli, własne kryteria prawdy oraz niezależny odbiór. Pozwala kontrolować dane i wspólny koszt bez zależności od wycofywanej platformy. |
| Automatyczne trenowanie/fine-tuning | Poza v1. Trwała poprawa następuje przez naprawę przyczyny, wersjonowane reguły oraz regresję; nie przez niekontrolowaną zmianę wag lub globalną pamięć z rozmów. |

[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) pomaga egzekwować schemat wyniku, ale nie zapewnia prawdziwości. Trzeba obsłużyć refusal, wynik niekompletny i błąd API, a reguły biznesowe walidować samodzielnie. [Metodyka OpenAI](https://developers.openai.com/api/docs/guides/evaluation-best-practices) uzasadnia kalibrację ocen automatycznych do ocen eksperta i testy specyficzne dla zadania. Nie potrzebujemy do tego tworzenia obiektów na platformie Evals.

Kontrakty logiczne v1, wersjonowane i walidowane po stronie zaufanej:

- **QA_EVIDENCE_V1:** identyfikator interakcji, zakres konta/organizacji i prawa źródeł; czas UTC + strefa/rozpoznany okres; wersje aplikacji/modelu/instrukcji/kontekstu; potrzebny input/output i źródła; ważność, cel, koszt i status. Treść tylko prywatna.
- **QUALITY_VERDICT_V1:** evidenceId, wersja rubric/oceniającego, PASS / FAIL / INSUFFICIENT_EVIDENCE, wymiary jakości, szkoda, kategoria przyczyny i odwołania do dowodów. Pewność modelu nie stanowi uprawnienia.
- **REPAIR_MANIFEST_V1:** incydent/klasa, właściwy profil i repo, bazowy SHA, dokładny zakres dozwolonych plików, podpisany mandat, wersja bramek, bezpieczny syntetyk, limit prób/czasu/kosztu i identyfikator korelacji. Bez surowego payloadu QA.
- **RELEASE_RECEIPT_V1:** exact commit i artefakt, niezależne wyniki testów, poprzednie LKG, faktyczny deploy/runtime, odbiór, okno obserwacji i stan rollback. Sam opis agenta nie jest dowodem.

Nowe kontrakty nie zmieniają tożsamości ani znaczenia istniejących operacji. Dodatkowe pola producenta wymagają jawnej wersji i kompatybilnej adopcji. Dostęp QA, koszt oraz release są osobnymi uprawnieniami; odczyt danych nie przyznaje prawa do zmiany kodu.

## 5. Kompletny projekt kanonu rozwiązania v1 — DO AKCEPTACJI

**Identyfikator:** CIC-CONTINUOUS-QUALITY-V1. **Status:** PROPOSED / NOT_OWNER_APPROVED / NOT_ACTIVE. **Źródło projektu:** ta Karta, initiativeId z metryki. §4 i §5 razem stanowią kompletną propozycję, nie kanon aktywowany w governance. Wymagania są docelowymi kryteriami, nie wynikami wykonanych testów.

### 5.1. Zakres autonomii i wyłączenia

Ocena obejmuje język, sens odpowiedzi, logikę, zgodność z pytaniem, oparcie w źródłach, aktualność i uprawnienia we wszystkich obecnych modułach. Merytoryka finansowa wymaga właściwego dowodu i kalibracji domenowej; oceniający model nie tworzy prawdy referencyjnej z własnego przekonania.

**Dopuszczone klasy samodzielnej naprawy kodu/reguł v1:**

| Klasa | Co można naprawiać | Granica |
| --- | --- | --- |
| C1 — czas i zakres pytania | Rozpoznanie jawnych/relatywnych dat, strefy i granic okresu, wariantów PL/EN, dopasowanie selekcji kontekstu | Bez zmiany harmonogramu producenta, definicji wskaźnika lub wymyślania wydarzeń. |
| C2 — wierność źródłu | Mapowanie identyfikatora, daty, jednostki, cytowania/statusu i zakresu ze źródła do odpowiedzi; odrzucenie twierdzenia sprzecznego ze źródłem | Bez zmiany wartości danych źródłowych, formuł finansowych, prognoz lub licencji. |
| C3 — zastosowanie ustalonej polityki wyjątków | Zastosowanie zatwierdzonego zachowania dla braku/niedopasowania/sprzeczności/awarii, w tym komunikatu i walidacji publikacji | Naprawa egzekwowania reguły, nie samodzielne ustanawianie nowej polityki lub rozszerzanie dostępu. |

Zmiana jest kwalifikowana do autonomii tylko wtedy, gdy mieści się w klasie **i** istnieje sprawdzalna przyczyna oraz niezależny test/inwariant. Błąd z innego modułu nadal podlega diagnozie, ale podobna nazwa klasy nie omija własności i routingu.

Agent może przygotować minimalną poprawkę, dodać przypadki regresji i zaproponować zmianę. Zaufany kontroler może utworzyć PR, a po wszystkich bramkach scalić i wydać do Development bez każdorazowego udziału właściciela. Może też wycofać własną zmianę zgodnie z §5.6. W v1: jeden aktywny wykonawca i jedno wydanie naraz na repo; maksymalnie jedno nowe autonomiczne wydanie naprawcze w ciągu 24 godzin (rollback nie czeka na ten limit), maksymalnie dwie płatne próby naprawy na incydent, łącznie do 5 USD z replay i odbiorem. Drobne warianty tego samego błędu nie otrzymują nowych limitów.

Poza samodzielnym wykonaniem: uprawnienia/E1, sekrety, dostawcy i płatne pozyskiwanie danych, migracje i dane biznesowe, finanse/metody benchmarków/prognoz/rekomendacji zakupowych, zależności i modele, całościowa zmiana promptu/persony, własny kontroler/oceniający/mandat, testy bezpieczeństwa i kryteria odbioru, routing, workflow, kanony i historyczne receipty. Te obszary mogą wymagać osobnego zadania właściwego ownera. Trwały test błędu pozostaje częścią poprawki; agent nie może usuwać lub osłabiać istniejących testów.

Dokładne allowlisty plików/funkcji dla C1–C3 zostają przyjęte przy jednorazowym dopuszczeniu wykonawczym, na podstawie ścieżek §4.7. To czynność governance/bootstrap, nie prawo agenta do nadawania sobie zakresu. Prywatny kod CIC pozostaje w swoim repo/profilu i procesie; nie wolno kopiować go do publicznego PR SG-dev.

### 5.2. Wspólny standard odpowiedzi CIC / Gateway / runtime

CIC określa regułę, Gateway dostarcza sprawdzalny status/zakres źródła, runtime egzekwuje warunki publikacji. Nie polega się wyłącznie na ostrzeżeniu w prompcie.

| Sytuacja | Docelowe zachowanie |
| --- | --- |
| Brak potrzebnych danych | Dozwolona próba uzyskania właściwego kontekstu; następnie jasny zakres odpowiedzi i użyteczny następny krok. Brak wartości nie staje się zerem. |
| Dane częściowe lub stare | Wskazać zakres i datę; oddzielić potwierdzone fakty od niepewności. Niepełny kalendarz nie dowodzi pustego tygodnia. |
| Źródło nie odpowiada pytaniu | Nie przedstawiać go jako odpowiedzi. Dla „przyszłego tygodnia” ustalić okres względem czasu pytania, a potem sprawdzić źródło. |
| Różne źródła są sprzeczne | Przedstawić różnicę z pochodzeniem i datą. Bez arbitralnej średniej lub wyboru wygodniejszego wyniku; ustalony priorytet producenta tylko w jego kontrakcie. |
| Pytanie niejednoznaczne | Zapytać tylko, gdy wybór istotnie zmienia wynik; przy bezpiecznym założeniu podać je wraz z zakresem. |
| Awaria API / timeout | Nazwać niedostępność, skorzystać z dopuszczonego fallbacku; błąd pobrania nie oznacza braku zdarzeń. Nie uruchamiać samowolnie płatnego refreshu. |
| Brak możliwości weryfikacji | Wyraźnie ograniczyć twierdzenie. Wiedza ogólna jest dozwolona do ogólnego pytania, lecz nie zastępuje aktualnych faktów z aplikacji. |
| Sprzeczność generowanej odpowiedzi | Zablokować wadliwą treść przed publikacją; podać bezpieczną odpowiedź ograniczoną do dowodów i zapisać incydent. |
| Nieznana sytuacja / refusal / wynik niekompletny | Zachować prawa i dane, użyć jawnego wyniku nierozstrzygalnego/bezpiecznego zakończenia. Bez wymyślania polityki lub wznowienia w nieskończoność. |

Dla C1 domyślny tydzień oznacza poniedziałek–niedzielę. Okres wyznacza serwer względem czasu pytania i zweryfikowanej strefy konta albo jawnej konfiguracji aplikacji, nie zegara nocnego agenta. Gdy brak strefy może zmienić odpowiedź, należy ją doprecyzować. Przykład kontrolny: czas odniesienia 11 XI 2026 w Europe/Warsaw → następny tydzień 16–22 XI 2026; data publikacji i okres referencyjny raportu są osobnymi polami.

Dla odpowiedzi opartych na danych aplikacji weryfikować obowiązkowe twierdzenia (m.in. okres, identyfikatory, wartości/jednostki, status publikacji) przed pokazaniem tekstu. W częściach C1–C2 fakty (np. lista dat i wartości) renderować z zatwierdzonych pól źródła i rozpoznanego okresu, zamiast przepisywać swobodnie wygenerowaną listę modelu. Model może objaśniać zatwierdzone fakty, ale nie nadpisuje ich innymi liczbami lub datami. To upraszcza walidację i ogranicza sprzeczność zakresu z zawartością. Przy potrzebie zbuforować taką odpowiedź do walidacji; sama zgodność JSON nie wystarcza. V1 nie dodaje automatycznej drugiej generacji do wysłania użytkownika. Zachowuje obecny model jednej płatnej generacji na zlecenie; dopuszczalne ponowne dobranie kontekstu nie może samo powodować nowego płatnego pobrania. Więcej prób generacji wymagałoby odrębnego kontraktu/kosztu.

W razie wyczerpania portfela QA zostają dostępne podstawowe odpowiedzi i deterministyczne zabezpieczenia; nie przyznaje to dodatkowego prawa do płatnych ocen. Kontrola QA nie obiecuje pełnego wykrywania wszystkich subtelnych błędów przed wysyłką.

**UX v1:** istniejący jeden asystent AppShell, bez panelu jakości i dodatkowego przepływu akceptacji użytkownika. Reuse istniejących stanów busy/complete/interrupted/failed oraz prezentacji źródeł. Zbuforowanie jest widoczne jako trwające przygotowanie; nie wolno wysłać wadliwego fragmentu, a potem go „poprawić” dopiskiem. Komunikaty w PL/EN, bez technicznych identyfikatorów/progów z mechanizmu QA. Zmiana widoku/tożsamości anuluje pracę zgodnie z obecną granicą. Odczytano aktualny kanon UX i sesję runtime; częściowy demonstrator nie jest pozwoleniem na nowy UI. Odbiór obejmie rzeczywisty desktop/mobile, klawiaturę i opóźnienie pierwszego poprawnego tekstu; dziś nie deklaruje się browser acceptance.

### 5.3. Pętla naprawy i odzyskiwanie kontroli

1. Runtime zachowuje minimalny uprawniony dowód i wykonuje tanie walidacje. Nocna partia w strefie Europe/Warsaw ocenia nowe interakcje; błąd krytyczny z walidatora trafia do kontrolera od razu. Logiczny identyfikator partii zapobiega duplikatowi przy zmianie czasu. Replay używa czasu pierwotnego pytania.
2. Reguły obejmują wszystkie uprawnione interakcje. Modele oceniają próbkę warstwową: w pilotażu do 1000 interakcji/24h w ramach dostępnych środków; najpierw wszystkie sygnały ryzyka mieszczące się w limicie, potem losowo co najmniej 10% pozostałych, z reprezentacją modułów/PL/EN. Limit/przyczyna pominięcia i faktyczne pokrycie są raportowane. Nie przedstawiać próbki jako oceny wszystkich rozmów.
3. Oceniający wskazuje PASS / FAIL / INSUFFICIENT_EVIDENCE, wymiary i szkodę. Drugi niezależny oceniający rozstrzyga istotne/niepewne przypadki. Model nie zamienia własnej diagnozy w dowód. Rozmowa i dokument są niezaufanymi danymi, także gdy zawierają instrukcję zmiany oceny lub wykonania komendy. Skrócenie kontekstu dla kosztu nie może usuwać istotnego dowodu i udawać pełnej oceny. Sygnał sędziego nigdy sam nie uruchamia scalenia.
4. Kontroler grupuje według przyczyny i wersji, z zachowaniem praw konta/organizacji. Rozróżnia rozpoznanie pytania, wybór kontekstu, dane źródłowe, integrację, logikę aplikacji, instrukcję/generację i UNKNOWN. Bez odtwarzalnej przyczyny powstaje nierozstrzygnięty incydent, nie zgadywana poprawka.
5. Dla C1–C3 sprawdza mandat, dokładne ścieżki/profil, bazę, zakres danych i budżet. Tworzy zadanie engineering z własnym identyfikatorem i wymaganym PMOS/PHR/MEMOROS według profilu. Wywołuje programowy serwerowy wykonawca przez dopuszczony workflow; nie wysyła zadania do osobistego czatu/aplikacji właściciela.
6. Agent odtwarza błąd na bezpiecznym syntetyku, dodaje test i minimalnie naprawia przyczynę. Zaufany weryfikator sam sprawdza, że test wykazuje błąd na bazie i przechodzi po poprawce. Wymagane są także warianty językowe/brzegowe i niezmieniony holdout.
7. Agent oddaje artefakt; nie wykonuje push, scalenia ani publikacji. Kontroler sprawdza diff, pochodzenie, sekrety i własność, tworzy PR, zbiera niezależne dowody i stosuje §5.4.
8. Publikacja wydaje dokładny sprawdzony artefakt na Development. Kontroler uzgadnia rzeczywiste SHA/config i wykonuje autoryzowany read-only odbiór oraz obserwację. Dopiero wynik końcowy zamyka incydent; test i wzorzec przyczyny poprawiają kolejne odpowiedzi.
9. Po awarii odzyskuje zapis stanu i identyfikator zewnętrznego joba. Najpierw ustala rzeczywisty skutek operacji. Maksymalnie dwie próby kodowe, do 30 minut każda; cancel musi zostać potwierdzony po stronie wykonawcy. Niepewny koszt zostaje zajęty. Ponowienie nie tworzy nowego incydentu/budżetu.

Stany: OBSERVED → TRIAGED → REPRODUCED → PATCH_READY → VERIFIED → RELEASED → OBSERVING → CLOSED. Alternatywy: INSUFFICIENT_EVIDENCE, WAITING_INFRA, BUDGET_STOP, OUT_OF_SCOPE, ROLLED_BACK, NEEDS_TECHNICAL_REVIEW. Zmiana stanu wymaga trwałego dowodu i dzierżawy; restart nie przyznaje dodatkowej próby. Nieudane testy oznaczają najwyżej drugą próbę z ograniczonym feedbackiem. Brak infra — ograniczony backoff i uzgodnienie joba, bez ślepego ponowienia skutku.

Wyjątki trafiają do wyznaczonego ownera technicznego/domenowego z reprodukcją. Nie tworzy się kolejki rutynowych zatwierdzeń dla właściciela biznesowego. Jego decyzji wymagają nowe klasy, zmiana mandatu/budżetu lub chronionego środowiska. Początkowa kalibracja przez specjalistę i okresowy audyt nie są równoznaczne z ręcznym przeglądaniem wszystkich rozmów.

### 5.4. Kiedy system może sam scalić i wydać

**Wszystkie warunki muszą być spełnione jednocześnie:**

- C1–C3, podpisany aktualny mandat, właściwy profil/repo, dopuszczony dokładny zakres i aktualna bazowa wersja.
- Sprawdzalna przyczyna, niezależna reprodukcja przed/po, brak prywatnego materiału w artefakcie lub publicznym PR.
- Nienaruszone testy/kryteria, wszystkie obowiązkowe testy krytyczne i bezpieczeństwa, holdout oraz wymagane zwykłe i kontrolowane CI dla dokładnego SHA. Raport agenta nie zastępuje checków.
- Zachowane obecne credential/source fences. Nowe receipty mogą pochodzić wyłącznie z zaufanego dopuszczonego procesu; historyczne receipty i kryteria nie są przepisywane przez naprawę.
- Dokładnie znany wpływ merge i auto-deploy; żadna droga nie może uruchomić Production/Staging lub zmiany cudzej aplikacji.
- Dostępny działający LKG ze zgodną konfiguracją, wyłącznik nowej funkcji i sprawdzona droga rollback bez cofania danych. Autonomiczne klasy nie obejmują migracji.
- Rezerwacja kosztu obejmuje również obowiązkowy odbiór. Sprawne logowanie audytu, nadzór i kontrola kosztu; brak niewyjaśnionego wcześniejszego dispatchu.
- Zajęta dzierżawa wydania, brak nowszego równoległego deploymentu; po jakiejkolwiek zmianie bazy odpowiednie dowody są unieważnione i odtwarzane.

Obecne governance nie jest automatycznie zgodą na klasowe auto-merge. Pierwsze wykonanie musi przyjąć **jednorazowy ograniczony mandat automatyzacji** i dostosować dopuszczenie klas/receiptu do bieżących reguł, bez wyłączania kontroli. Dopiero taki mandat pozwala na rutynowe naprawy bez osobnego zatwierdzania każdego SHA przez właściciela. Agent nie może utworzyć go sobie na podstawie tego projektu.

### 5.5. Kryteria gotowości, sukcesu i miary

Poniższe liczby są **proponowanym kontraktem odbioru v1**, nie benchmarkiem rynku ani dotychczasowym wynikiem SpendGuru. Zbiory i etykiety zatwierdza kompetentny reviewer niezależny od agenta naprawy; właściciel produktu nie musi wykonywać etykietowania. Wersje i hashe zbiorów są zamrożone przed porównaniem. Rozdzielić przypadki do budowy rubryki, naprawy i chroniony holdout, także całymi rodzinami przyczyn, aby parafrazy jednego błędu nie zawyżały niezależności próby.

| Obszar | Proponowane kryterium i mianownik |
| --- | --- |
| Obowiązkowe reguły C1–C3 | 100% przejścia krytycznych przypadków i brzegów. Co najmniej 20 przypadków na każdą klasę, PL/EN, strefy/DST/granice tygodnia, brak/sprzeczność źródła; same liczby nie zastępują pokrycia. |
| Krytyczne błędy semantyczne | Recall = TP/(TP+FN) ≥95%, dolna granica dwustronnego 95% CI Wilsona ≥90%; niezależnie oznaczonych ≥300 krytycznie wadliwych przypadków. Wyniki osobno według domen. |
| Fałszywe alarmy | FPR = FP/(FP+TN) ≤2%, górna granica 95% CI ≤5%, na ≥300 poprawnych przypadkach. Nie mylić FPR z udziałem błędnych alarmów w alarmach. |
| Pokrycie i unknown | Na referencyjnie rozstrzygalnych przypadkach ≥90% ocen rozstrzygniętych. Unknown na znanym błędnym przypadku liczy się jako FN, nie znika z recall. Dodatkowo ≥60 przypadków z rzeczywiście niewystarczającym dowodem; ≥95% poprawnego wskazania nieweryfikowalności. |
| Trafność rekomendacji kwalifikacji | Precision = TP/(TP+FP) ≥99%, dolna granica 95% CI ≥95%, na ≥100 rekomendacjach. Przy 99/100 dolna granica ok.94,55% — taka próba nie spełnia warunku. To nie zastępuje żadnej bramki wydania. |
| Regresja przed wydaniem | ≥200 chronionych przypadków dobranych do zakresu; zero nowych krytycznych wad i zero naruszeń dostępu. Spadek odsetka poprawnych odpowiedzi ≤1 punkt procentowy i wzrost nieuzasadnionych odmów ≤2 pp; te same przypadki, jawna niepewność i niezmieniona rubryka. |
| Zmienność generacji | Krytyczny podzbiór powtórzony 3 razy przy stałych wersjach i referencji. Niespójne lub nierozstrzygalne wyniki nie są pozytywnym dowodem do promocji. |
| Efekt na rozpoznanej klasie | Na chronionym zestawie problemów, z ≥10 wadami wersji bazowej: co najmniej 50% względnej redukcji potwierdzonych wad, bez przesuwania ich do kategorii odmowy/unknown. Przy mniejszej bazie podać wynik absolutny, bez twierdzenia o pewnej redukcji populacyjnej. |
| Autonomia pilotażu | ≥80% wszystkich z góry kwalifikujących się, unikalnych realnych incydentów C1–C3 zamkniętych pełną pętlą bez ręcznego wykonywania naprawy. Do oceny wyniku biznesowego ≥5 niezależnych realnych incydentów; błędy, budżet i porzucone próby pozostają w mianowniku. |
| Czas naprawy | Dla ≥90% kwalifikujących się realnych incydentów pełny sprawdzony wynik w ≤48h od wykrycia. Raportować także opóźnienie wykrycia nocnego, nie tylko czas pisania kodu. |
| Bezpieczeństwo i koszt | Zero naruszeń tenant/account isolation, publikacji prywatnych danych, nieuprawnionych wydań i krytycznych regresji. Maks.50 USD / pilot i 5 USD / incydent, bez automatycznej podwyżki lub resetu prób. |

**Gotowość techniczna do ograniczonej autonomii Development:** przyjęty mandat i dane, egzekwowalny koszt, wymagane kontrole deterministyczne, odbiór live/recovery oraz co najmniej trzy różne kontrolowane incydenty przeprowadzone przez cały proces bez ręcznego podawania kolejnych kroków. Te próby mogą wykorzystywać syntetyczny przypadek, lecz rzeczywisty workflow, PR, merge, deploy i weryfikację, w dopuszczonym testowym zakresie.

Brak kalibracji sędziego semantycznego nie blokuje mechanicznie klas C1–C3, jeśli kwalifikacja ma niezależną deterministyczną reprodukcję i komplet bramek. Do czasu spełnienia tabeli semantyczny sędzia działa jako niewiążący sygnał/diagnoza. Nie może sam odblokować naprawy ani oznaczać domeny finansowej jako sprawdzonej.

**Sukces operacyjny pilotażu:** 14 dni, spełnione bezpieczeństwo/koszt, wymagany efekt na chronionych przypadkach i wyniki realnej autonomii/czasu. Wszystkie autonomiczne wydania mają zero krytycznych regresji; każda nawet drobna regresja/rollback jest osobno liczona. Dopuszczalny maksymalnie jeden skutecznie wycofany incydent niekrytyczny; ponowna wada tej samej przyczyny wstrzymuje klasę. Liczba udanych zmian nie dowodzi niezawodności i nie zwiększa mandatu.

Przy <5 realnych incydentach lub za małej próbie jakości: **INSUFFICIENT_EVIDENCE**, z osobnym wynikiem odbioru technicznego; nie „100% skuteczności”. Nie wprowadzać sztucznych wad, by nabić licznik rzeczywistych napraw. Po końcu okna/budżetu nie uruchamiać nowych płatnych zadań bez odrębnego przedłużenia.

Raport wykazuje oddzielnie: wszystkie interakcje, uprawnione do QA, ocenione regułowo/modelowo, pominięte, nierozstrzygalne, wszystkie potwierdzone błędy, udział C1–C3, udane/nieudane naprawy, nawroty, regresje, koszt i udział ręcznej pracy. Publikować proporcje per moduł/język/szkoda i CI; średnia jakości języka nie ukrywa błędu krytycznego. Metryki bez dostępu do niezbędnego źródła nie są miarą jego prawdziwości.

### 5.6. Zatrzymanie, wycofanie i wznowienie

| Sygnał | Reakcja automatyczna |
| --- | --- |
| Potwierdzone ujawnienie danych, błędne uprawnienie, zmiana poza mandatem lub krytyczna wada nowej odpowiedzi | Natychmiast zablokować kolejne promocje, odciąć dotkniętą zdolność i uruchomić kontrolowany rollback, jeśli wdrożona wersja jest nadal tą zmianą. Uruchomić obsługę incydentu technicznego. |
| 3 kolejne nieudane read-only próby poprawnego działania po wdrożeniu, w odstępach ≥60 s | Wstrzymanie i rollback po potwierdzeniu, że problem dotyczy nowej wersji, a nie wspólnej awarii dostawcy. |
| W pierwszych 30 min po wydaniu: błędy techniczne rosną o ≥5 pp względem porównywalnej bazy, na ≥20 interakcjach | Wstrzymać i sprawdzić związek z wersją; przy potwierdzeniu wycofać. Przy mniejszym ruchu decydują aktywne próby, nie losowy procent. |
| Ponowny chroniony zestaw pokazuje >2 pp spadku lub >2 pp wzrostu nieuzasadnionych odmów | Wycofać przy niezależnym potwierdzeniu niekrytycznej regresji. Sam sporny werdykt tego samego modelu nie wystarcza. |
| Brak audytu/kontroli kosztu/nadzoru, unknown deploy SHA lub niepewny dispatch | Zatrzymać nowe promocje i uzgodnić stan. Nie cofać zdrowej aplikacji tylko dlatego, że niedostępny jest oceniający. |
| Brak budżetu / dwie nieudane próby / brak dowodu / uprawnienie odwołane | Zatrzymać daną naprawę; zachować dopuszczony minimalny dowód i przekazać ownerowi technicznemu. Bez pętli automatycznych PR i podnoszenia limitów. |
| Awaria modelu/dostawcy dotykająca także LKG | Użyć ustalonego zachowania niedostępności, wstrzymać zależne zadania. Rollback kodu bez dowodu związku nie naprawia przyczyny. |

Cel operacyjny: decyzja o odcięciu/promocji rollback w ≤5 minut od potwierdzonego sygnału; przywrócenie sprawdzonego LKG w ≤15 minut od tej decyzji. To SLO do przetestowania, nie obecna gwarancja Render. Przed dopuszczeniem wydania trzeba mieć wykonalną drogę i gotowy poprzedni artefakt.

Rollback dotyczy własnej zmiany i własnego wydania. Sprawdzić aktualny SHA, konfigurację i dzierżawę. Jeśli pojawił się nowszy równoległy deploy, nie nadpisywać go starszą wersją: wstrzymać, zastosować dopuszczone odcięcie dotkniętej zdolności i eskalować. Nie cofać bazy, nie przepisywać main/history i nie anulować cudzych zmian. Po wycofaniu sprawdzić realny runtime i odpowiedź kontrolną.

Maksymalnie jeden automatyczny rollback dla incydentu; brak oscylacji deploy/rollback. Klasa pozostaje zawieszona po potwierdzonej regresji do ponownej kwalifikacji przez niezależnego ownera technicznego, z zachowaniem przyjętego mandatu. Wznowienie po zwykłej awarii infrastruktury może wykonać kontroler po potwierdzeniu stanu i środków; nie resetuje prób. Nowe klasy lub szersze uprawnienia wymagają właściciela, nie samooceny agenta.

### 5.7. Plan realizacji i pełny odbiór — po osobnej autoryzacji

**Etap 1 — działająca pętla Development i gotowość zakresu C1–C3.** Rezultat: system od kontroli odpowiedzi i prywatnego dowodu do autonomicznej naprawy, PR, merge, exact-SHA deploy, odbioru i rollback. Powstają: minimum §4.8, SERVICE QA i separacja danych SG2, worker kontrolera, izolowany wykonawca z kontrolą kosztu, niezależny weryfikator/publisher, regresje i metadane. Pierwsza kompletna próba przebiega dla C1; pozostałe klasy są przygotowane do kwalifikacji według tego samego kontraktu.

Miejsce: pakiet kontrolera/nowy dopuszczony workflow, rozszerzenie istniejącego runtime/Gateway i prywatnego magazynu SG2. Ownerzy: ARCHITECTURE + zadanie SG2, polityka po stronie CIC. Najpierw wymagane: onboarding tam, gdzie NO_MATCH, właściwy G1/mandat klasowej automatyzacji, legalne dane/processorzy/poświadczenia, dokładny koszt zasobów owner-only i odrębne upoważnienie wykonawcze. Estymata całego przygotowania: 15–25 dni inżynierskich + 2–4 dni review/QA/domeny, częściowo równolegle; nie zobowiązanie terminowe.

Przygotowanie repo/testów/infra bez wywołań modeli może poprzedzać pilotaż. Płatne próby odbioru etapu 1 otwierają wspólne okno i ledger etapu 2; nie mają dodatkowego budżetu „przed pilotażem”. Do tego momentu trzeba przygotować wszystkie elementy wymagane dla C1–C3, aby nie zużyć 14-dniowego okna na dalsze prace podstawowe.

Odbiór etapu 1:

- trzy różne bezpieczne reprodukcje przyczyny z prawdziwym przepływem Development, w tym pytanie względne PL/EN i granica czasu;
- test na bazie czerwony, po zmianie zielony, niezależna regresja i rzeczywisty poprawny wynik użytkownika;
- przerwanie/wznowienie bez duplikatu, nieudany test bez merge, inny owner/ścieżka bez promocji, wyczerpanie łącznego i incydentowego kosztu bez dalszego POST, odczyt obcej rozmowy bez ujawnienia danych;
- kontrolowana regresja → odcięcie/rollback LKG → live weryfikacja w SLO;
- próba równoległego deploymentu nie może spowodować nadpisania go rollbackiem;
- realny UI busy/źródła/odpowiedź, desktop/mobile/klawiatura; symulowany ekran nie jest dowodem. Timery, rozmowy i symulacje MagicPath nie trafiają do produktu jako integracja.

**Etap 2 — regularne działanie i pomiar 14-dniowego pilotażu v1.** Rezultat: nocna ocena między modułami, dopuszczanie C1–C3 wyłącznie po ich bramkach, kalibracja sędziego, grupowanie, trwałe regresje, mierniki i obsługa wyjątków. Działa na kontrolerze/stores/workflow etapu 1; bez nowej platformy lub dashboardu. Czas: 14 dni kalendarzowych od pierwszego płatnego uruchomienia objętego tym pilotem, w tym płatne próby technicznego odbioru, nie kolejne 14 dni po ich zakończeniu. Daty dopuszczenia klas są raportowane; nie twierdzić, że później dopuszczona klasa była obserwowana przez cały okres.

Odbiór etapu 2: §5.5 oraz próby wszystkich klas, aktualne prawa/koszt, ochrona przed prompt injection w rozmowie i artefakcie, usunięcie/restore, niesprawny nadzór i odmowa zmiany oceniającego przez agenta. Wynik: TECHNICAL_ACCEPTED plus PILOT_BUSINESS_PASS / FAIL / INSUFFICIENT_EVIDENCE z przyczyną. Brak wymaganej próby/efektu nie jest zamieniany na PASS. Bez automatycznego Production, rozszerzenia klas lub odnowienia budżetu.

Każdy etap ma właściwe exact-path zadania, ownerów i ciągłość profilu. Jeżeli przygotowanie nie pozwala zmieścić obowiązkowych prób i obserwacji w przyjętym oknie/budżecie, plan należy dopasować przed pierwszym wydatkiem. Nie wolno ukrywać dalszych kosztów pod nazwą kalibracji, testu, retry lub kolejnej części etapu.

### 5.8. Koszt, utrzymanie i ryzyka

DEC-02 pozostaje nadrzędny: 50 USD łącznie, do 5 USD na incydent, brak automatycznego zwiększania/odnowienia. Proponowany podział planistyczny: do 10 USD na ocenę/kalibrację i do 40 USD na incydenty (kod, replay i odbiór razem); nigdy dwa niezależne limity 50 USD. Kontroler rezerwuje przed dispatch i uwzględnia niepewne koszty oraz wymagany odbiór. Brak technicznie egzekwowalnego kosztu agenta blokuje tę ścieżkę autonomii.

Reguły deterministyczne mają pierwszeństwo; mały model jest kandydatem do przesiewu, mocniejszy do rozstrzygnięć. Konkretny model i snapshot muszą przejść kalibrację, nie są automatycznie wymieniane przez agenta. Wstępni kandydaci to gpt-6-luna / gpt-6.1-sol. Według [cennika odczytanego 12 XI 2026](https://developers.openai.com/api/docs/pricing), 1000 ocen po 3000 tokenów wejścia i 500 wyjścia to ok.0,55 USD na luna, a 100 takich ocen na sol ok.1,10 USD. To ilustracja tokenów; kodowanie, większe konteksty, narzędzia i dodatkowe próby mogą kosztować znacznie więcej.

Worker od ok.7 USD/miesiąc jest oddzielnym kosztem infrastruktury, poza 50 USD. Dochodzą ewentualny przyrost bazy, transfer, GitHub compute/artifacts i praca zespołu; nie zostały zatwierdzone tą decyzją. Przy bezczynności ograniczać polling, aby nie utrzymywać niepotrzebnie aktywnego compute bazy. Dla nowych zasobów wymagany jest osobny dokładny koszt i zgoda owner-only przed utworzeniem; nie zakładać darmowego wykonania całej pętli. Łączna estymata pracy to 15–25 dni inżynierskich plus 2–4 dni review/domeny, częściowo równolegle, oraz okno obserwacji. Wycena zależy od stawek, których nie podano.

Najważniejsze ryzyka: brak praw do replay lub pełnego kontekstu; skorelowane błędy modeli; zanieczyszczenie holdoutu i optymalizacja pod ocenę; mała liczba realnych incydentów; przeoczenie błędu finansowego mimo poprawnego języka; koszt agenta; niewystarczające dopuszczenie CI/mandatu; wycofanie kolidujące z innym wydaniem. Ograniczają je uprawnienia i retencja, osobny wynik unknown, niezależne etykiety/bramki, zamrożony zakres, pojedyncze wydanie i porównanie aktualnego SHA. Te środki nie zapewniają bezbłędności całej aplikacji ani samodzielnego ustanawiania wiedzy eksperckiej.

Właściciel nie zatwierdza rutynowo każdego incydentu. Potrzebny jest jednak wskazany owner techniczny i dostępny reviewer domenowy dla wyjątków oraz kalibracji. W v1 nie obiecuje się całkowitego braku udziału ludzi.

## 6. Decyzje i źródła

Przyjęte wymagania: cel ciągłego doskonalenia, nacisk na autonomiczne wykonanie i mierzalną gotowość, wspólny standard nietypowych sytuacji oraz minimalny udział właściciela. Polecenie uruchomienia BSDC i jedna karta nie stanowią zgody na implementację. DEC-01 przyjmuje autonomiczne naprawy i wdrożenia do Development w v1 oraz późniejsze rozpatrzenie Production; właściciel jawnie zachował tryb bez implementacji. DEC-02 przyjmuje limity modeli 50 USD / 14 dni i 5 USD / incydent bez automatycznego zwiększania. DEC-03 przyjmuje cały pakiet rewizji 5, w tym R-DATA-01, R-EXEC-01, progi, liczbę prób, klasy i rollback. Konsultacje BSDC zakończono. Specyfikacja jest zaakceptowana merytorycznie i zachowana w §4–5; aktywacja oraz wykonanie pozostają odrębne.

Źródła publiczne:

- [BSDC Canon](../../../v1.0-business-solution-design-and-canonization-canon.md) i [Launcher](../../../../docs/agent-instructions/bsdc-launcher-v1.0.md).
- [Rejestr projektów](../../../registries/profitia-projects-v1.json), [routing](../../../registries/current-architecture-baseline-v1.json), [aktywny manifest](../../../registries/governance-manifest-v2.json), [AGENTS.md](../../../../AGENTS.md).
- [Codex SDK — programowe wykonania](https://learn.chatgpt.com/docs/codex-sdk) i [cennik modeli](https://developers.openai.com/api/docs/pricing), odczyt 12 XI 2026; dostęp konta nie był testowany płatnym wywołaniem.
- Źródła discovery §4.3: [historia](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/lib/assistant/history.ts), [runtime](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/lib/assistant/runtime.ts), [migracja historii](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/migrations/assistant/001-history.sql), [model](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/lib/assistant/model.ts), [przebieg rozmowy](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/lib/assistant/conversation.ts). Dowód kodu, bez deklaracji aktywnego wdrożenia.
- Uzupełnienie §4.4–4.7: aktualne [operacje i granice E1](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/Canon/v1.0-operation-context-and-access-contract.md), [macierz AM-45–47](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/Canon/registries/operation-access-matrix-v1.json), [operation-context](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/packages/platform-contracts/src/operation-context.mjs), [źródłowy workflow ACG](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/.github/workflows/assistant-context-gateway-ci.yml) i [trusted CI controller](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/scripts/governance/controlled-package-ci.mjs). Dowód źródła nie jest dopuszczeniem nowego runnera lub mandatu QA.
- Oficjalne źródła technologiczne są podlinkowane przy rekomendacjach; odczyt 12 XI 2026. Nie testowano płatnym przebiegiem kont, limitów proxy, ZDR ani przydziału zasobów. Dane prywatnego odczytu infrastruktury pozostają poza publiczną kartą.
- Źródła domknięcia v1: [context-selection i CIC planner](https://github.com/profitia/SG-dev/blob/ce5044a6c87937da80ee2db86dbcb54522ddd491/apps/sg-runtime/lib/assistant/context-selection.ts), [sesja i stany UX](https://github.com/profitia/SG-dev/blob/ce5044a6c87937da80ee2db86dbcb54522ddd491/apps/sg-runtime/components/appshell/assistant-conversation-session.ts), [aktywny kanon UX](https://github.com/profitia/SG-dev/blob/ce5044a6c87937da80ee2db86dbcb54522ddd491/docs/agent-instructions/ux-ui-design-canon.md), aktualne read-only sprawdzenie kanonu MagicPath (bez publikacji prywatnego kodu lub deklaracji live binding). Przypadek pierwotnej daty jest przykładem klasy, nie twierdzeniem, że błąd nadal istnieje w aktualnym źródle.
- Uzupełnione oficjalne źródła: [OpenAI deprecations](https://developers.openai.com/api/docs/deprecations#2026-06-03-evals-platform), [eval methodology](https://developers.openai.com/api/docs/guides/evaluation-best-practices), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [PostHog evals](https://posthog.com/docs/ai-evals), [Langfuse evals](https://langfuse.com/docs/evaluation/overview), odczyt 12 XI 2026. Opis możliwości nie dowodzi dostępu/aktywacji konta SpendGuru.
- Potrzeba oraz uwagi A/B właściciela w poprzedzającej rozmowie są podstawą opisu biznesowego. Nie publikuje się rozmowy ani materiałów operacyjnych. Inna sesja kontynuuje z tej karty, bez domniemania dostępu do historii czatu.

## 7. Końcowy zapis akceptacji i zakończenia BSDC

**BSDC: COMPLETED. Rozwiązanie v1: OWNER_APPROVED / NOT_ACTIVE.** Decyzja DEC-03 dotyczy pełnej [rewizji 5](https://github.com/profitia/SG-dev/blob/3f79f10a1e8b6df4dc9176634ee6339675df5f7a/Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md), commit 3f79f10a1e8b6df4dc9176634ee6339675df5f7a, blob 695164e98b1562acb00aa937ca6003726f6ca368. W rewizji 6 zapisano akceptację i domknięcie, bez zmiany zaakceptowanej specyfikacji. Rewizja 7 dodaje harmonogram end-to-end w §8.1–8.6 i DEC-04; rewizja 8 zapisuje DEC-05: osobno zlecane etapy i weryfikację właściciela pomiędzy nimi. Żaden z tych zapisów nie uruchamia wykonania.

Przyjęty pakiet obejmuje:

1. Trzy klasy C1–C3, granice i wyłączenia; projekt automatycznego zlecenia, naprawy, PR, scalenia, wydania i rollback wyłącznie Development po dopuszczeniu mandatu.
2. Standard sytuacji nietypowych, bramki promocji, definicje metryk, próby i warunki biznesowego odbioru.
3. R-DATA-01: minimalny prywatny dowód do 7 dni, operacyjne metadane do 90 dni, prawa konta/organizacji/źródeł, usunięcia i syntetyczne wejście agenta.
4. R-EXEC-01: zaufany kontroler Render + jednorazowe GitHub-hosted VM z ograniczającym koszty dostępem do modelu; niezależna publikacja.
5. Dwa kompletne etapy i model nadzoru: rutynowe naprawy bez właściciela, wyjątki do ownera technicznego/domenowego, rozszerzenia zakresu do właściciela.
6. Warunki zatrzymania, wycofania oraz zawieszenie klasy; jedna aktywna naprawa/wydanie, dwa podejścia i brak automatycznego rozszerzania.

Akceptacja nie potwierdza wyników jakości, skuteczności modelu, bezpieczeństwa nieuruchomionego wykonawcy ani gotowości środowiska. Zawarte w specyfikacji progi są przyjętymi kryteriami przyszłego odbioru. Wnioski o dostępach/danych/retencji są przyjętą polityką projektową, nie obecnie nadanym prawem przetwarzania.

**Nie udzielono upoważnienia wykonawczego.** Implementacja, aktywacja kanonu i mandatu, rejestracja nowych ścieżek, migracje/granty, zasoby i płatne przebiegi, merge do main oraz deployment wymagają późniejszego właściwego upoważnienia. Nie zaakceptowano nieoszacowanych kosztów pozamodelowych. Warunki konkretnej instalacji, praw danych, kosztu i kontroli z §4–5 nie zostały uchylone.

Nie pozostaje żadna otwarta decyzja merytoryczna do zakończenia BSDC v1. Przygotowanie techniczne i dopuszczenia są przyszłymi warunkami egzekucji. PDR pozostaje jedyną Kartą inicjatywy; końcowy kanon biznesowo-architektoniczny jest utrwalony w niej jako zaakceptowana specyfikacja. Wyodrębnienie osobnego pliku, przyjęcie do main lub aktywacja manifestu nie były objęte tym poleceniem i nie zostały wykonane.

## 8. Handoff i harmonogram realizacji

- Gdzie skończyliśmy: właściciel zaakceptował propozycję v1 z rewizji 5; decyzję zapisano jako DEC-03; A–F zakończone, 28/28 USTALONE projektowo. Rewizja 6 utrwala zamknięcie, rewizja 7 uzupełnia harmonogram, a rewizja 8 zapisuje etapowy zakres przyszłych zleceń według DEC-05.
- Obowiązujący zakres: dokładny zaakceptowany commit 3f79f10a1e8b6df4dc9176634ee6339675df5f7a; niezmienione §4–5 tej Karty; DEC-01/02/03. Wcześniejsze robocze propozycje nie rozszerzają v1.
- Następny krok: realizować E1-T01–T13 na podstawie DEC-06. Najpierw skuteczne przyjęcie źródłowego onboardingu na main, następnie własne zadania implementacyjne i dopuszczenie zależnych operacji. Po wyniku etapu 1 weryfikacja właściciela; etap 2 pozostaje bez zlecenia.
- Przyszłe źródła wejściowe: ta Karta z DEC-03, zamrożona rewizja 5, aktywne AGENTS/manifest/profil/routing i execution wrapper na ówczesnym main. Sprawdzić stan rzeczywisty przed mutacją; akceptowany projekt nie jest snapshotem przyszłego runtime.
- Ownerzy: ARCHITECTURE koordynacja/kontroler/dopuszczenia; SG2 runtime, produktowe dane i adopcja; CIC polityka rozmowy. Każde repo/profil zachowuje swoje exact paths, PMOS/PHR/MEMOROS i uprawnienia. Brak zgody na kopiowanie prywatnego CIC do publicznego repo.
- Pierwszy przyszły wynik wykonawczy: dopuszczona, ograniczona pętla etapu 1 (§5.7), z pełnym odbiorem i recovery; etap 2 to pomiar pilotażu. Handoff obejmuje zakres, kontrakty, dane, koszt, role, metryki, odbiór i rollback, a nie prompt implementacyjny.
- Warunki startu: odrębne upoważnienie; właściwy routing/onboarding tam, gdzie NO_MATCH; mandat klas C1–C3 zgodny z aktualnym governance; legalna instalacja/dane/processorzy; ograniczone poświadczenia; sprawdzony limit kosztu; LKG/wyłącznik/rollback; osobna zgoda owner-only na nowe zasoby i pozamodelowe koszty.
- Limity zachowane: Development v1, Production później; modele 50 USD / 14 dni, do 5 USD na incydent; bez resetu/automatycznego zwiększania. Sam zapis akceptacji nie otwiera okna pilotażu ani nie uruchamia licznika wydatków.
- Stan końcowy: **DESIGN COMPLETE / OWNER_APPROVED / NOT_ACTIVE / NOT_IMPLEMENTED**. Brak aktywacji, kodu produktu, migracji, konfiguracji, zasobów, płatnych wywołań, merge do main i deploymentów w tym kroku. Brak promptu wykonawczego.


### 8.1. Harmonogram realizacji end-to-end — etapy i taski

**Status: ETAP 1 W_TOKU / ETAP 2 NIE_ROZPOCZĘTY.** Jest to rozwinięcie wykonawcze dwóch etapów z §5.7, opracowane na prośbę właściciela po zamknięciu BSDC. Harmonogram określa kolejność, zależności, zadania, odpowiedzialność i odbiór; nie ustala terminów ani nowych estymat czasowych. Nie zmienia zamrożonej specyfikacji §4–5, progów, klas autonomii ani limitów DEC-01/02/03.

Wymagany przez właściciela tryb przyszłego wykonania to **FULL AUTOPILOT — OUTCOME FIRST v2.0 w obrębie osobno zleconego etapu** (DEC-04/05). Po każdym etapie następuje weryfikacja właściciela; kolejny etap wymaga osobnego jawnego GO. Publikacja harmonogramu jest dokumentacją. Nie jest zleceniem realizacji, aktywacją systemu ani dowodem ukończenia któregokolwiek zadania. Zgody dotyczące innych inicjatyw lub planów przykładowych nie są upoważnieniem dla tej inicjatywy.

**Wiążący rezultat przyszłego wykonania:** rzeczywista interakcja SpendGuru → uprawniony prywatny dowód QA → wykrycie i diagnoza → kwalifikacja C1–C3 → samodzielne uruchomienie wykonawcy → reprodukcja i poprawka → niezależne testy → dopuszczony PR/merge → exact-SHA Development → sprawdzenie odpowiedzi i skutku → trwała regresja albo odcięcie/rollback i odzyskanie kontroli.

Sam monitoring, infrastruktura, wygenerowany task, gotowy PR, zielone CI lub deployment nie kończą realizacji. **Odbiór techniczny etapu 1 i wynik biznesowy pilotażu etapu 2 są odrębne.** Pełny sukces v1 wymaga wszystkich obowiązkowych warunków §5.5–5.7. Brak próby lub budżetu nie zamienia wyniku na PASS.

### 8.2. Zasady Full Autopilot i odpowiedzialność

Źródła wykonawcze: aktualny [Full Autopilot v2.0](../../../../docs/agent-instructions/full-autopilot-v2.md), [Universal Project Execution v1.2](../../../../docs/agent-instructions/profitia-universal-project-execution-v1.2.md), [Business Outcome Engineering v1.1](../../../../docs/agent-instructions/business-outcome-engineering-v1.1.md), aktywne profile i kanony. Dokumenty określają sposób wykonania; nie zastępują odrębnego zlecenia realizacji i szczególnych upoważnień.

- Po właściwym zleceniu etapu wykonawca prowadzi cały dopuszczony zakres tego etapu jednym ciągiem: implementuje, naprawia własne błędy, testuje, integruje, przygotowuje PR, scala i wdraża tam, gdzie operacje są prawidłowo dopuszczone, oraz sprawdza realny wynik. Nie kończy na „gotowe do uruchomienia” i nie rozszerza zlecenia na następny etap.
- Taski wewnątrz zleconego etapu nie wymagają rutynowej ponownej akceptacji. Granica między etapami jest świadomie ustanowionym przez właściciela punktem kontroli (DEC-05). Spełnienie zależności technicznej nie zastępuje zlecenia etapu 2; już udzielonych, aktualnych zgód wewnątrz bieżącego etapu nie zbiera się ponownie.
- **ARCHITECTURE** prowadzi koordynację, kontroler, kontrakty i dopuszczenia swoich powierzchni. **SG2** odpowiada za host/runtime, historię, prywatne dowody, adopcję i produktowy odbiór Development. **CIC** odpowiada za politykę rozmowy i jej integrację we własnym autorytatywnym repo/profilu. Oznaczenie kilku ownerów nie daje jednemu prawa zapisu cudzych ścieżek; zależne zadania zachowują własne wymagane rejestry i ciągłość.
- Wykonawca budujący rozwiązanie w Full Autopilot i późniejszy **agent napraw QA** mają różne mandaty. Agent QA zachowuje C1–C3, syntetyczne wejście, brak prawa zmiany sędziego, testów chronionych, własnych uprawnień i polityk promocji. Full Autopilot nie rozszerza jego mandatu.
- Wcześnie powstaje jeden konkretny pakiet rzeczywiście brakujących czynności właścicielskich: wymagane zasoby, koszty poza modelami, instalacja/dostęp, granty i szczególne dopuszczenia. Nowe zasoby owner-only Render/GitHub/Neon tworzy właściciel według przygotowanej instrukcji. W pierwszej kolejności wykorzystuje się istniejące zasoby.
- Brak uprawnienia zatrzymuje zależną operację; niezależne, dopuszczone prace trwają. Czerwony test, build lub możliwy do bezpiecznego rozwiązania konflikt jest zadaniem wykonawcy. Nowy istotny koszt, przekroczenie mandatu lub ryzyko danych wymaga jednej konkretnej decyzji właściwego ownera.
- Wznowienie następuje od pierwszej niewykonanej operacji, po odczycie rzeczywistego stanu. Nie uruchamia się ponownie niepewnego dispatchu, merge lub deploymentu bez uzgodnienia wyniku. Zachowuje się LKG, limity prób i rezerwacje kosztu.
- Ten harmonogram nie ustanawia pracy w tle w osobistym czacie. Docelowy autonomiczny proces działa na trwałym kontrolerze i wykonawcy opisanych w R-EXEC-01. Wykonanie projektu wymaga rzeczywiście dostępnego środowiska i sesji wykonawczej.

### 8.3. Kolejność i zależności

Dwa etapy biznesowe pozostają zgodne z §5.7:

1. **Etap 1: działająca pętla Development i techniczna gotowość C1–C3.** Obejmuje taski E1-T01–E1-T13, od dopuszczeń po rzeczywisty odbiór naprawy i recovery.
2. **Etap 2: regularna ocena, autonomiczne naprawy i wynik pilotażu v1.** Obejmuje E2-T01–E2-T06, kończy się rozliczeniem efektu, bezpieczeństwa i kosztu.

Po ustaleniu kontraktów można równolegle przygotowywać dane, politykę odpowiedzi, kontroler, wykonawcę i testy — wyłącznie w dopuszczonych powierzchniach i w zakresie zleconego etapu. Oczekiwanie na owner-only zasób nie blokuje niezależnych testów offline. Integracja powstaje wcześnie, a pełny odbiór wykorzystuje docelowy host, CIC/ACG, prawdziwy workflow, model i persistence.

**E1-T13 otwiera wspólne okno i ledger pilotażu przy pierwszym płatnym uruchomieniu.** Jest to kontrola kosztu odbioru etapu 1, nie uruchomienie etapu 2. Po osobnym GO task E2-T01 przejmuje istniejący ledger i pozostałe okno. Nie ma osobnych 14 dni lub dodatkowego budżetu po odbiorze technicznym; przerwa na ocenę właściciela nie zatrzymuje zegara. Przed tym momentem E1-T12 potwierdza przygotowanie całości C1–C3, referencji, kontroli kosztu i prób. Płatne przygotowanie/kalibracja nie jest wyłączane z limitu pod inną nazwą.

Po weryfikacji etapu 1 przez właściciela i jawnym zleceniu etapu 2 semantyczna kalibracja E2-T02 może trwać równolegle z dopuszczonymi deterministycznymi naprawami C1–C3. Nie skalibrowany sędzia pozostaje sygnałem diagnostycznym; nie nadaje prawa do wydania. Każda klasa wchodzi do regularnego działania dopiero po swoich bramkach. Raport zachowuje faktyczny moment jej dopuszczenia.

### 8.4. Etap 1 — działająca pętla naprawcza na Development

W poniższych tabelach A oznacza ARCHITECTURE, S — SG2, C — CIC. Są to planowane odpowiedzialności. Każdy task otrzyma właściwy wykonawczy taskId dopiero przy rzeczywistym starcie w odpowiednim profilu. Identyfikatory E1/E2 są elementami planu, nie istniejącymi ticketami lub zleceniami agenta.

| Task i owner | Zależność | Zakres i wynik do odbioru | Status / dowód |
| --- | --- | --- | --- |
| **E1-T01 — uruchomienie właściwego mandatu**; A, S, C | Osobne zlecenie etapu 1 | Krótkie sprawdzenie aktualnego main, profili, prac równoległych, routingu i Code State. Ustalić exact paths, niezbędny onboarding/G1, mandat automatyzacji C1–C3 i reguły kontrolowanego CI. Każda dopuszczona operacja ma ownera i środowisko; NO_MATCH pozostaje blokadą danej ścieżki do prawidłowego rozstrzygnięcia. | CZĘŚCIOWY / skuteczny G1; klasowy mandat i kolejne dopuszczenia pozostają otwarte; §8.7 |
| **E1-T02 — kontrakty QA i granice danych**; A + S + C | E1-T01 dla właściwych powierzchni | Uszczegółowić wersjonowane kontrakty §4.8 oraz R-DATA-01: dowód, wynik oceny, zlecenie naprawy i wynik weryfikacji. Potwierdzić SERVICE QA, prawa konta/organizacji/źródeł, minimalizację, retencję i usuwanie. Odbiór: pozytywne/negatywne testy kontraktów i jednoznaczna odpowiedzialność producent–konsument. | W_TOKU / ARCH-CIC-QUALITY-STAGE1-CONTRACTS-20261112; §8.7 |
| **E1-T03 — zasoby i bezpieczny dostęp**; A + właściwi ownerzy | E1-T01–T02; owner-only tam, gdzie wymagane | Wybrać reuse, przygotować jeden pakiet brakujących zasobów i dokładnych kosztów. Po właściwych czynnościach ownera potwierdzić Render kontrolera, GitHub VM/workflow, prywatny magazyn, tożsamości Development, role runtime/migratora i ograniczone poświadczenia. Brak sekretów w Git/telemetrii; brak prawa wykonawcy napraw do publikacji. | W_TOKU / ARCH-CIC-QUALITY-STAGE1-G1-20261112; §8.7 |
| **E1-T04 — referencja i plan dowodów**; A + reviewer domenowy + S/C | Kontrakty E1-T02 | Przygotować rozdzielone zbiory rubryki, napraw i chroniony holdout, etykiety niezależne od agenta oraz macierz wszystkich progów §5.5 i prób §5.7. Zamrozić wersje/hash i rodziny przyczyn; przygotować C1–C3, PL/EN, braki, sprzeczności i przypadki poza zakresem. Samo przygotowanie zbioru nie jest kalibracją lub wynikiem jakości. | NIE_ROZPOCZĘTY / — |
| **E1-T05 — dowód odtworzenia rzeczywistej interakcji**; S + A | E1-T02; dopuszczone dane/dostęp E1-T03 | Rozszerzyć istniejącą historię/instrumentację o minimalny replay: czas i strefę, interpretowany zakres, wersje instrukcji/modelu/kodu, faktycznie dostarczony kontekst i źródła oraz wynik/status. Egzekwować separację, retencję i usunięcia. Odbiór: kontrolowana interakcja daje odtwarzalny dowód; inny użytkownik/tenant nie uzyskuje dostępu. | NIE_ROZPOCZĘTY / — |
| **E1-T06 — standard sytuacji nietypowych i ochrona odpowiedzi**; C + S + ACG owner | E1-T02; integracja z E1-T05 | Wdrożyć przyjęte zachowania §5.2: braki, nieaktualność, sprzeczności, zły zakres, niejednoznaczność, awarie i nieweryfikowalność. Połączyć reguły C1–C3 z kontekstem i hostem. Odbiór: użytkownik otrzymuje użyteczny wynik lub precyzyjną informację o ograniczeniu; wykryta sprzeczność nie jest publikowana jako poprawna odpowiedź. | W_TOKU / CIC-QUALITY-EXCEPTION-POLICY-STAGE1-20261112; SG2-CIC-QUALITY-STAGE1-RUNTIME-20261112; §8.7 |
| **E1-T07 — ocena i diagnoza QA**; A + S/C | E1-T04–T05 | Przygotować regularną analizę, reguły deterministyczne, ocenę semantyczną z UNKNOWN, grupowanie przyczyn i kwalifikację klas. Rozróżniać model/instrukcję/kontekst/źródło/integrację/aplikację oraz brak dowodu. Odbiór offline: odtwarzalna diagnoza i brak kwalifikacji na podstawie samej opinii modelu; płatna kalibracja dopiero we wspólnym pilotażu. | NIE_ROZPOCZĘTY / — |
| **E1-T08 — trwały kontroler i kontrola kosztu**; A | E1-T02–T03; kontrakt kwalifikacji E1-T07 | Zaimplementować deduplikację, stany i dzierżawy, rezerwacje przed wywołaniem, 50 USD łącznie/5 USD na incydent, koszt niepewny, dwie próby i limit wydań. Kontroler sam zleca uprawniony incydent. Odbiór: restart nie dubluje zadania, wyczerpany limit blokuje dalszy koszt, niepewny wynik jest uzgadniany przed retry. | W_TOKU / ARCH-CIC-QUALITY-STAGE1-CONTROL-20261112; §8.7 |
| **E1-T09 — izolowany wykonawca napraw**; A + owner workflow | E1-T03, E1-T08; dopuszczone ścieżki E1-T01 | Uruchamiać jednorazową VM GitHub z Codex na dokładnej bazie i minimalnym syntetycznym przypadku. Agent reprodukuje błąd, tworzy test i minimalną poprawkę oraz oddaje artefakt. Odbiór: brak prywatnego transkryptu, poświadczeń wdrożenia, dostępu do cudzych ścieżek i prawa zmiany własnych bramek; timeout/przerwanie są odzyskiwalne. | W_TOKU / ARCH-CIC-QUALITY-STAGE1-CONTROL-20261112; PR #1071; źródła i lokalne testy, bez odbioru runtime; §8.7 |
| **E1-T10 — niezależna weryfikacja i promocja**; A + S | E1-T04, E1-T06, E1-T08–T09 | Zaufany proces sprawdza czerwony test bazowy/zielony po poprawce, chronioną regresję i obowiązkowe CI dla dokładnego SHA. Osobny publisher tworzy/przyjmuje PR i wykonuje tylko dopuszczone merge/deploy. Odbiór: nieudany test, zmiana bazy, inny owner lub naruszenie mandatu uniemożliwiają promocję; raport agenta nie jest checkiem. | W_TOKU / ARCH-CIC-QUALITY-STAGE1-CONTROL-20261112; PR #1071; źródła i lokalne testy, bez odbioru runtime; §8.7 |
| **E1-T11 — monitoring, odcięcie i rollback**; A + S | E1-T03, E1-T08; kontrakt wydania E1-T10 | Połączyć release/trace, koszty i wynik naprawy z właściwym monitoringiem. Ustalić rzeczywisty LKG lub bezpieczne przerwanie pierwszego startu; wdrożyć sygnały §5.6 i wznowienie bez resetu prób. Odbiór: rollback własnej wersji, weryfikacja runtime i brak nadpisania nowszej cudzej wersji lub cofania bazy. | NIE_ROZPOCZĘTY / — |
| **E1-T12 — integracja i gotowość do płatnego odbioru**; A + S + C | E1-T01–T11 w zakresie potrzebnym do startu | Połączyć i uruchomić dopuszczone komponenty na Development. Testami offline/kontraktowymi sprawdzić kompletną drogę i przygotowanie wszystkich C1–C3, danych, referencji, kontroli kosztu i recovery. Potwierdzić możliwość zmieszczenia prób w 14 dniach i wspólnym limicie. Odbiór: brak brakującej podstawowej capability; mock/offline nie jest odbiorem live. | NIE_ROZPOCZĘTY / — |
| **E1-T13 — rzeczywisty odbiór pętli i odzyskiwania**; A + S + C | E1-T12; aktualne wymagane zgody; wspólny ledger kosztu przed pierwszym płatnym requestem | W rzeczywistym Development przeprowadzić co najmniej trzy różne kontrolowane incydenty, od automatycznego wykrycia do poprawki, PR/merge/deploy i poprawnej odpowiedzi, bez ręcznego podawania kolejnych kroków. Pierwszy przebieg C1; PL/EN i granica czasu. Wykonać pełne próby negatywne, UI i recovery z §5.7, w tym SLO rollback oraz kolizję deploy. Odbiór: TECHNICAL_ACCEPTED z dowodami, odrębnie od wyniku pilotażu. | NIE_ROZPOCZĘTY / — |

**Rezultat etapu 1:** ograniczony system rzeczywiście sam naprawia i weryfikuje dopuszczony błąd na Development, a po niepowodzeniu odzyskuje kontrolę. Samo E1-T12 oznacza gotowość do odbioru, nie ukończenie etapu. Testowe incydenty E1-T13 nie są liczone jako realne incydenty biznesowe pilotażu.

**Granica zlecenia:** po odbiorze technicznym wykonawca przedstawia właścicielowi wynik etapu 1 i oczekuje na jego weryfikację. Nie uruchamia E2-T01–T06, nocnego QA ani regularnych napraw etapu 2. Raport obejmuje dowody całej pętli i recovery, aktualny SHA/stan środowiska, braki oraz wykorzystany i pozostały czas/budżet. Przyjęcie wyniku przez właściciela zapisuje się osobno od GO etapu 2.

### 8.5. Etap 2 — regularne doskonalenie i pełny odbiór v1

| Task i owner | Zależność | Zakres i wynik do odbioru | Status / dowód |
| --- | --- | --- | --- |
| **E2-T01 — wspólne okno i ledger pilotażu**; A | Weryfikacja etapu 1 i jawne GO etapu 2; ledger otwarty w E1-T13 | Przejąć już ustalony w E1-T13 początek 14 dni, zużycie/rezerwacje 50 USD i koszty incydentów; objąć nimi odbiór, QA, replay i wykonawcę. Zweryfikować pozostały czas i środki przed płatnym startem etapu 2. Nie otwierać nowego okna ani limitu. Odbiór: granica czasu i limit blokują nowe płatne zlecenia; nie ma ukrytego budżetu przed pilotażem ani automatycznego przedłużenia. | NIE_ROZPOCZĘTY / — |
| **E2-T02 — kalibracja sędziego i pomiar pokrycia**; A + niezależny reviewer domenowy | E1-T04, E1-T07, E2-T01 | W przyjętym budżecie wykonać i rozliczyć próby §5.5, osobno według domen i braków dowodu: recall, FPR, precision kwalifikacji, UNKNOWN/pokrycie, niepewność i zmienność generacji. Odbiór: wersjonowany wynik spełnia progi albo jawnie FAIL/INSUFFICIENT_EVIDENCE. Bez pełnego dowodu semantyczna opinia pozostaje niewiążąca. | NIE_ROZPOCZĘTY / — |
| **E2-T03 — dopuszczenie klas C1–C3 do regularnych napraw**; A + S/C + niezależny weryfikator | E1-T13 dla gotowości pętli; własne bramki każdej klasy | Potwierdzić deterministyczną reprodukcję, chronione przypadki i wszystkie warunki promocji dla każdej klasy; zapisać zakres i moment włączenia. C2/C3 przygotowane wcześniej przechodzą ten sam kontrakt co C1. Odbiór: tylko dopuszczona klasa może automatycznie wydać zmianę; brak kalibracji nie jest obchodzony samooceną, a deterministyczna ścieżka stosuje dokładnie wyjątek §5.5. | NIE_ROZPOCZĘTY / — |
| **E2-T04 — nocna ocena i autonomiczne naprawy realnych incydentów**; A + S | E1-T13, E2-T01; E2-T03 dla naprawianej klasy | Uruchomić regularne uprawnione QA między modułami, grupowanie, diagnozę i pełną pętlę napraw bez ręcznego zlecania każdego kroku. Przypadki poza mandatem obsłużyć przez właściwego ownera technicznego. Odbiór: rzeczywiste incydenty mają cały ślad wyniku, także błędów/porzuceń; brak sztucznego zasilania mianownika i rutynowej kolejki dla właściciela produktu. | NIE_ROZPOCZĘTY / — |
| **E2-T05 — trwałość efektu i bezpieczeństwo działania**; A + S/C | E2-T03–T04; przygotowane próby E1-T04/T11 | Potwierdzić utrzymanie regresji, redukcję wad na chronionych przypadkach i brak nawrotów. Sprawdzić prompt injection w rozmowie/artefakcie, usunięcie i niedopuszczenie przywróconych danych, cofnięcie praw, awarię nadzoru, retry/niepewny koszt oraz próbę zmiany sędziego przez agenta. Reuse nadal aktualnych dowodów; nowe próby tylko dla rzeczywistej luki lub zmiany. | NIE_ROZPOCZĘTY / — |
| **E2-T06 — rozliczenie i zamknięcie v1**; A koordynuje; S/C własne wyniki | Koniec wspólnego okna; wyniki E2-T01–T05 i etapu 1 | Rozliczyć cały §5.5–5.7: pokrycie jakości, wszystkie realne kwalifikujące się incydenty, skuteczność/czas, regresje, rollbacki, koszt i ręczną pracę. Wykonać wymagany closeout profili i odczyt dowodów. Odbiór: TECHNICAL_ACCEPTED oddzielnie od PILOT_BUSINESS_PASS / FAIL / INSUFFICIENT_EVIDENCE. Nie odnawiać kosztu lub działania po pilotażu bez właściwego upoważnienia. | NIE_ROZPOCZĘTY / — |

**Rezultat etapu 2:** zmierzony wynik rzeczywistego samodoskonalenia na Development. PASS oznacza spełnione przyjęte kryteria; FAIL lub INSUFFICIENT_EVIDENCE nie są opisywane jako pełny sukces. Szczególnie <5 niezależnych realnych incydentów nie wystarcza do biznesowego PASS. System może mieć ukończony odbiór techniczny i nadal nie mieć wystarczającego dowodu efektu biznesowego.

### 8.6. Rejestr postępu i końcowy odbiór

Statusy tasków/etapów: NIE_ROZPOCZĘTY, W_TOKU, CZĘŚCIOWY, ZABLOKOWANY, ZAKOŃCZONY. ZABLOKOWANY wskazuje konkretną zależność i ownera; nie zamraża niezależnych prac. ZAKOŃCZONY wymaga wyniku i dowodu z tabeli, nie samego commitu. E1-T01 jest CZĘŚCIOWY: rejestracja źródeł jest zakończona, lecz nie całość mandatu wykonawczego. E1-T02, E1-T03, E1-T06, E1-T08, E1-T09 i E1-T10 są W_TOKU. Pozostałe taski nie mają jeszcze wyniku wykonawczego i pozostają NIE_ROZPOCZĘTE. §8.7 oddziela źródła, CI, rejestr artefaktów i runtime.

Wykonawca aktualizuje kolumnę status/dowód po rzeczywistym wyniku, wskazując właściwe taskId, PR/SHA, deploy, test i aktualne braki. Operacyjne dowody są w istniejących PMOS/PHR, CI i artefaktach wydania; w publicznej Karcie pozostają wyłącznie bezpieczne referencje i podsumowania. Prywatny dowód QA nie trafia do repozytorium publicznego.

| Etap | Stan realizacji | Wynik odbioru technicznego/biznesowego | Weryfikacja właściciela / zlecenie kolejnego etapu | Dowód / braki |
| --- | --- | --- | --- | --- |
| 1. Pętla Development i techniczna gotowość C1–C3 | W_TOKU | DO_POTWIERDZENIA | DEC-06: start zlecony; wynik jeszcze NIE_PRZEDSTAWIONY | Źródłowy onboarding i zależności §8.7; brak odbioru live |
| 2. Regularne doskonalenie i wynik pilotażu | NIE_ROZPOCZĘTY | DO_POTWIERDZENIA | NIE_PRZEDSTAWIONO; brak GO etapu 2 | E2-T01–T06; okno i wydatki nieuruchomione |

Końcowy odbiór nie pomija żadnego warunku zamrożonej specyfikacji. Poniższa macierz grupuje dowody, nie zastępuje pełnego §5.5–5.7.

| ID | Obowiązkowy wynik | Taski dostarczające dowód | Stan |
| --- | --- | --- | --- |
| QA-01 | Rzeczywisty host/CIC/ACG i replay: właściwy zakres czasu, kontekst, źródła, wersje i użyteczna odpowiedź | E1-T05–T06, T13 | DO_POTWIERDZENIA |
| QA-02 | Trzy kontrolowane incydenty od automatycznego wyzwalacza do sprawdzonej naprawy, PR/merge i exact-SHA Development | E1-T08–T13 | DO_POTWIERDZENIA |
| QA-03 | Niezależna reprodukcja przed/po, chronione testy, wymagane CI i kontrola zmienionej bazy dla każdego wydania | E1-T04, T10, T13; E2-T03–T05 | DO_POTWIERDZENIA |
| QA-04 | Wszystkie progi/próby/95% CI, pokrycie, UNKNOWN i ograniczenia domen z §5.5 są rozliczone bez zmiany mianowników | E1-T04; E2-T02, T06 | DO_POTWIERDZENIA |
| QA-05 | C1–C3 mają wymagane bramki i rzeczywisty moment dopuszczenia; sędzia semantyczny nie rozszerza mandatu | E1-T01, T07, T10; E2-T02–T03 | DO_POTWIERDZENIA |
| QA-06 | Co najmniej 80% kwalifikujących się realnych incydentów naprawionych autonomicznie przy minimum 5; czas i efekt jakości zgodne z §5.5 | E2-T04–T06 | DO_POTWIERDZENIA |
| QA-07 | Standard sytuacji nietypowych i realny UX odpowiedzi, busy/źródła, desktop/mobile/klawiatura | E1-T06, T13 | DO_POTWIERDZENIA |
| QA-08 | Izolacja kont/tenantów, prawa źródeł, retencja/usuwanie, brak przywracania dostępności i brak prywatnych danych w artefaktach agenta | E1-T02, T05, T09; E2-T05 | DO_POTWIERDZENIA |
| QA-09 | Koszt, próby, dzierżawy, restart, niepewny dispatch i wyniki płatne są egzekwowane; brak nieuprawnionej promocji | E1-T08–T10, T13; E2-T01, T05 | DO_POTWIERDZENIA |
| QA-10 | Odcięcie i własny rollback w SLO §5.6, bez cofania bazy/cudzej nowszej wersji; zawieszenie i kontrolowane wznowienie klasy | E1-T11, T13; E2-T05 | DO_POTWIERDZENIA |
| QA-11 | Właściwe runtime, monitoring i release SHA, trwałe regresje, rzeczywisty koszt i rozliczenie wszystkich pominięć/niepowodzeń | E1-T11–T13; E2-T04–T06 | DO_POTWIERDZENIA |
| QA-12 | Wymagane closeout każdego profilu; końcowy raport odróżnia stan kodu, CI, deploy, odbiór techniczny i biznesowy | E2-T06 | DO_POTWIERDZENIA |

Zgodnie z DEC-05 wykonanie odbywa się w osobno zlecanych etapach. Full Autopilot prowadzi do pełnego wyniku bieżącego etapu albo rzeczywistej granicy uprawnień/bezpieczeństwa. Po wyniku etapu 1 następuje weryfikacja właściciela i osobna decyzja o etapie 2; oczekiwanie na nią jest zaplanowaną granicą zakresu. Nie oznacza ukończenia całego v1. Po etapie 2 również przedstawia się wynik właścicielowi. Jego akceptacja nie zastępuje brakujących dowodów ani nie zmienia INSUFFICIENT_EVIDENCE na PASS.

Upływ 14 dni lub limit 50 USD zamyka możliwość nowych płatnych zadań, także podczas oczekiwania między etapami. Przed przyszłym startem etapu 2 sprawdza się pozostałe okno i środki; brak ich wystarczalności wymaga odpowiedniej decyzji przed dalszym kosztem. Nie pauzuje się zegara, nie resetuje prób i nie odnawia limitu automatycznie. Production, Staging, nowe klasy i odnowienie pilotażu pozostają poza tym planem.

### 8.7. Stan realizacji etapu 1

- **Wznowienie 2026-11-13:** właściciel polecił kontynuację wyłącznie etapu 1 od punktu przywracania `02e647a9f9b8eb283c0fee05d4991db35e5431ab`. Potwierdzono zgodność 29 plików z zapisanymi SHA-256 i drzewem `0b03054c`; niezależnie odtworzono metadane Git, zachowując poprzednie. Aktualny main `0240de8a` oraz obie istniejące rejestracje ARCHITECTURE zweryfikowane. Bez ponownego begin, zmiany zamrożonej specyfikacji lub rozszerzenia mandatu. Następna operacja: aktualizacja istniejącego PR #1071 i wymagane kontrole źródła.
- **Mandat i granica etapu:** DEC-06; referencja wykonawcza właściciela nadal rewizja 8, commit 92dba2a4. Realizowany jest tylko etap 1. Etap 2 nie ma zlecenia; nie uruchomiono nocnej oceny rzeczywistych rozmów.
- **E1-T01 / G1 — komponent ZAKOŃCZONY:** [PR #1042](https://github.com/profitia/SG-dev/pull/1042), źródło 9243d88d → main 69a2cc17. Niezmienione pięć blobów i regularne tryby 100644, routing i pełne zwykłe testy PASS. [Chronione wykonanie 43282535712](https://github.com/profitia/SG-dev/actions/runs/43282535712) dla dokładnego źródła i kontrolera 4381dcec: PASS; pobrany dowód zweryfikowano niezależnie, w tym SHA-256 `e2f6ec18ed620b0a99a3767ebbca0c9816d3e89336c8d518e94c5fe7e3e831f0`. [Pełne kontrole wynikowego main](https://github.com/profitia/SG-dev/actions/runs/43285371271): PASS. PMOS/PHR dla `ARCH-CIC-QUALITY-STAGE1-G1-ACCEPT-20261112` zapisane; rejestracja zadania ukończona. Nie oznacza to końca E1-T01: nadal potrzebny jest ograniczony mandat klasowej automatyzacji i dopuszczenie jej rzeczywistej ścieżki CI.
- **DEC-07 / CI — komponent ZAKOŃCZONY:** [PR #1061](https://github.com/profitia/SG-dev/pull/1061) aktywował wyłącznie uzgodnioną regułę G1. Weryfikacja źródła, chronionego dowodu i wynikowego main PASS; `ARCH-CIC-QUALITY-STAGE1-CI-ACTIVATE-20261112` ukończone w PMOS/PHR. Ta decyzja nie jest przenoszona na przyszły kod kontrolera lub nowy pin biblioteki.
- **E1-T02 — źródła W_TOKU:** [projekt kontraktów QA / PR #1069](https://github.com/profitia/SG-dev/pull/1069), zadanie `ARCH-CIC-QUALITY-STAGE1-CONTRACTS-20261112`. Cztery typowane kontrakty w trzech nowych plikach obejmują prywatny dowód, werdykt, manifest odwołujący się wyłącznie do syntetyku oraz receipt wydania. Zachowano bez zmian istniejące metadane i eksporty prywatnego pakietu oraz protokół kontekstu 2.2.0. Dowód QA zachowuje do 64 oryginalnych zakresów organizacji/referencji/wersji z faktycznie użytej historii; nie zmienia to granicy czterech źródeł na turę Gateway. Lokalnie 12 testów kontraktowych i 20 testów historycznej kompatybilności Source Hub PASS; wcześniej 23 istniejące testy Gateway, build i deklaracje typów PASS oraz workflow ACG 43289069458 PASS. To nie jest walidacja rzeczywistych grantów, podpisów lub danych ani kalibracja merytoryczna. Chronione dopuszczenie całego nowego źródła pozostaje odrębne.
- **E1-T06 / CIC — komponent biblioteki ZAKOŃCZONY:** [CIC PR #25](https://github.com/profitia/conversational-intelligence-core/pull/25) wprowadził wspólną deterministyczną politykę wyjątków, bez nadawania uprawnień lub wywołań modeli. Pełne testy źródła i wynikowego main PASS. [CIC PR #26](https://github.com/profitia/conversational-intelligence-core/pull/26) i [#27](https://github.com/profitia/conversational-intelligence-core/pull/27) zapewniły kontrolowaną publikację. W [wykonaniu 43282280865](https://github.com/profitia/conversational-intelligence-core/actions/runs/43282280865) wydano pod znacznikiem Development core 1.8.0 oraz Profitia/Evals 1.3.6 z dokładnego źródła c0053dcd. Receipt rejestru, znaczniki, gitHead i trzy integrities porównano niezależnie z lokalnym artefaktem. Znacznik latest nie został przesunięty. Cztery zadania CIC zamknięto z wymaganymi PMOS/MEMOROS/PHR i niezależną kontrolą zapisu. Biblioteka nie jest jeszcze podłączona do działającego SpendGuru.
- **E1-T06 / SG2 — źródła W_TOKU:** [PR #1067](https://github.com/profitia/SG-dev/pull/1067), zadanie `SG2-CIC-QUALITY-STAGE1-RUNTIME-20261112`. Przygotowano rozpoznanie okresu w zaufanej strefie aplikacji, w tym granice tygodnia i dni 23/25-godzinne. 22 lokalne przypadki PL/EN i brzegowe PASS. Nie zmieniono konfiguracji usługi. Zdalne testy ujawniły wymaganą kontynuację dokładnych historycznych dowodów źródła; PR nie jest przyjęty ani wdrożony. Historyczne receipty i kryteria nie są przepisywane w celu uzyskania PASS.
- **E1-T08 — implementacja W_TOKU:** `ARCH-CIC-QUALITY-STAGE1-CONTROL-20261112`; źródła w `packages/assistant-quality-control/` oraz addytywna migracja `apps/package-limits/migrations/005-assistant-quality-usage.sql`. Przygotowano podpisany mandat/eksport syntetyku, automat stanów, trwały outbox i dzierżawę repozytorium, zachowanie prób po restarcie, rozdzielony broker kosztu i native Package & Limits. Lokalny zestaw 40 testów PASS, z ukierunkowaną kontrolą późniejszych zmian: obejmuje rzeczywisty tymczasowy PostgreSQL, konkurencyjne rezerwacje 50 USD, limit incydentu, zachowanie niepewnego kosztu, powiązanie z oryginalnym rozliczeniem kontrolowanego pytania asystenta, brak podwójnego wykonania po utracie odpowiedzi, stare dzierżawy i zawieszenie klasy. SQL uruchamiano wyłącznie w nowych tymczasowych klastrach loopback; nie instalowano go w Neon. Testy brokera używały fałszywego upstreamu. Przygotowano statyczne ograniczenie zmian funkcji i bramkę niezależnej weryfikacji podpisanego holdoutu, red/green, powtórzeń oraz progów jakości; test tej bramki używa portu testowego i nie stanowi rzeczywistego holdoutu produktu lub kalibracji. Pozostają adaptery, izolowany wykonawca, źródłowa kontynuacja dowodów, host, instalacja i odbiór runtime. Retencja/restore oraz rozstrzygnięcie wygasłych nierozliczonych zleceń również pozostają bramką instalacji. W chmurze nie działa jeszcze kontroler, broker ani wykonawca QA.
- **E1-T09/T10 — źródła W_TOKU:** [PR #1071](https://github.com/profitia/SG-dev/pull/1071), przygotowany launcher Linux, osobna tożsamość systemowa, limity procesu i sieci, przypięte narzędzia oraz pobieranie wyłącznie jawnie dopuszczonych blobów publicznego SG-dev. Trwała próba jest wiązana jednokrotnie z workflow; powtórny run nie otrzymuje nowego dopuszczenia tej samej próby. Lokalnie sprawdzono plan i odrzucanie zmienionych plików, linków, obcych artefaktów i niepotwierdzonej kwalifikacji. Nie wykonano jeszcze rzeczywistej kwalifikacji Linux/tool-loop/izolacji/anulowania. Nowy workflow zawiera wyłącznie testy źródła bez sekretów, środowiska GitHub, modeli lub trybu napraw/deploymentu. Płatny wykonawca wymaga odrębnego podpisanego pozytywnego dowodu kwalifikacji i właściwego mandatu; dzisiaj brak aktywacji.
- **E1-T03 / zasoby:** odczyt potwierdził PROFITIA WORKSPACE i brak dedykowanego workera QA. Istniejące workery innych capability nie są przejmowane. Pakiet owner-only jest przygotowywany dla małego workera Development/Frankfurt, istniejących prywatnych magazynów i ograniczonych poświadczeń. Worker od 7 USD/miesiąc jest odrębnym niezaakceptowanym jeszcze kosztem infrastruktury. Nie utworzono usługi, grantu, roli ani schematu w środowiskach chmurowych; nie zmieniono ich konfiguracji lub sekretu. Tymczasowe role/schematy lokalnych testów nie są instalacją Development.
- **Dane i koszt:** nie odczytano prywatnych rozmów. Nie wykonano płatnego requestu API systemu QA, replay ani wykonawcy; wspólne okno/ledger pilotażu jeszcze nie rozpoczęte. Istniejący klucz został wybrany przez właściciela, lecz nie udostępnia się go agentowi napraw. To nie jest twierdzenie o całkowitym koszcie sesji inżynierskiej lub zwykłego CI.
- **Odbiór:** brak TECHNICAL_ACCEPTED. Nie wykonano jeszcze trzech rzeczywistych kontrolowanych incydentów, wdrożeń napraw, odbioru UI ani prób rollback w SLO. Pozostają obowiązkowym celem etapu 1; źródła lub zielone CI ich nie zastępują.

## 9. Historia

| Rewizja | Data | Zmiana |
| --- | --- | --- |
| 1 | 2026-11-12 | Pierwsza robocza karta BSDC na podstawie wcześniejszej rozmowy; publiczny zakres biznesowy, stan A–F i punkt wznowienia. |
| 2 | 2026-11-12 | Przyjęta DEC-01: autonomia Development w v1, Production później, brak implementacji. Rozwinięto proces, klasy, proponowane umiejscowienie, kryteria odbioru i roboczy budżet; pozostałe propozycje niezaakceptowane. |
| 3 | 2026-11-12 | Przyjęta DEC-02: limity modeli 50 USD / 14 dni i 5 USD / incydent, bez automatycznego zwiększania. Odświeżono źródła historii/runtime; dodano wymagania dowodu odtworzenia, granice danych i projekt trwałego wykonania. Nadal bez implementacji. |
| 4 | 2026-11-12 | Dodano R-DATA-01 i R-EXEC-01: konkretne zasady danych QA, retencja i usunięcia, Render worker + jednorazowe GitHub-hosted VM, granice poświadczeń, kontroli kosztu i odbioru. Rekomendacje niezaakceptowane; nadal bez implementacji. |
| 5 | 2026-11-12 | Kompletna propozycja v1 do akceptacji: trzy klasy autonomii, standard wyjątków, metryki i próby, kryteria promocji, stop/rollback, dwa etapy i koszty. Domknięto checklistę projektową A–E; F3 oczekuje na właściciela. Nadal bez implementacji. |
| 6 | 2026-11-12 | DEC-03: właściciel zaakceptował pełną propozycję v1 z rewizji 5 (3f79f10a). BSDC zakończony, 28/28 USTALONE projektowo. Specyfikacja §4–5 zachowana identycznie; OWNER_APPROVED / NOT_ACTIVE / NOT_IMPLEMENTED. |
| 7 | 2026-11-12 | DEC-04: harmonogram według etapów i tasków end-to-end w Full Autopilot. Rozpisano 2 przyjęte etapy na 19 tasków z ownerami, zależnościami, wynikami, dowodami i 12 punktami odbioru. Wszystkie taski NIE_ROZPOCZĘTE; zamrożona specyfikacja §4–5 i limity bez zmian; bez implementacji. |
| 8 | 2026-11-12 | DEC-05: właściciel wybiera osobno zlecane etapy z własną weryfikacją po każdym. Full Autopilot wewnątrz bieżącego etapu; brak automatycznego przejścia do etapu 2. Rozdzielono odbiór, akceptację i GO; wspólne 14 dni/50 USD bez resetu lub pauzy. Specyfikacja §4–5 i 19 tasków zachowane; bez uruchomienia etapu 1 i bez implementacji. |
| 9 | 2026-11-12 | DEC-06: właściciel zleca wyłącznie etap 1 w Full Autopilot i wybiera istniejący klucz. Rozpoczęto źródłowy onboarding AQC-BASE-001/002 oraz przygotowanie zależności. Etap 1 W_TOKU; etap 2 bez zlecenia; brak zasobów, płatnych prób i odbioru live. |
| 10 | 2026-11-12 | DEC-07: zapisano zgodę na #1061, skuteczny i zweryfikowany G1/main oraz faktyczne komponenty CIC/kontraktów/SG2. Rozpoczęto kontroler; ujawniono zależność kontynuacji dowodów źródła. Nadal brak aktywacji QA, wydatków API pilotażu, zasobów/grantów i odbioru etapu 1; bez etapu 2. Zamrożone §4–5, referencja wykonawcza rewizji 8 i limity zachowane. |
