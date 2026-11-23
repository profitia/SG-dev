# Karta Projektu BSDC v1.1 — Precomputed Forecasts / Benchmark Finder — Karta 1.0

**SpendGuru SG2 · Karta Projektu 1.0 · 23 listopada 2026**

> **Zakres bezwzględny: DEVELOPMENT ONLY.** Karta obejmuje zaprojektowanie, wdrożenie, uruchomienie, automatyczną eksploatację i odbiór funkcji w zarejestrowanym środowisku **SG2 Development**. Nie jest kartą wydania na inne środowiska, promocji danych ani aktywacji odrębnego środowiska aplikacyjnego. Takie działania podlegają osobnym zasadom i nie są warunkiem ukończenia tego przedsięwzięcia.
>
> **OWNER_APPROVED / PUBLISHED — KARTA 1.0.** Owner zaakceptował projekt rozwiązania wraz z roadmapą E1–E2 oraz końcowymi kryteriami FINAL-01–10. Akceptacja i publikacja Karty nie są mandatem wykonawczym: nie uruchomiono żadnego etapu ani nie udzielono upoważnienia do zmian w zasobach.

| Metryka | Ustalenie |
| --- | --- |
| `initiativeId` | `BSDC-20261123-SG2-PRECOMPUTED-FORECASTS` — identyfikator zaakceptowanej inicjatywy |
| `projectKey`, profil prowadzący | `SG2` / SG Runtime, SG2 Platform, Forecast Operations w granicach swoich właścicieli |
| Repozytorium / authority | [`profitia/SG-dev`](https://github.com/profitia/SG-dev) / `main`; historyczna rewizja discovery: `ed2eebb1ccacbaab66978fb60ab0cfbe140a4858` |
| Lokalizacja PDR | `Canon/proposals/bsdc/SG2/BSDC-20261123-SG2-PRECOMPUTED-FORECASTS.md` — zaakceptowana ścieżka publikacji w authority `main` |
| Środowisko prac i końcowego odbioru | **SG2 Development**; Neon `autumn-waterfall-65938876` / `br-dry-hall-b294222f` / `neondb`, zgodnie z aktualną topologią |
| Stan | `OWNER_APPROVED / PUBLISHED`, Karta `1.0`; podstawa merytoryczna: v0.5 po uzgodnionym Cross-Model Review |
| Liczba etapów | **2:** E1 pilot, E2 kompletne działanie i odbiór Development |
| Liczba tasków | **9:** E1-T01–T04 oraz E2-T01–T05 |
| Kryteria końcowe | **FINAL-01–FINAL-10**, wyłącznie dla Development |
| Decyzja Ownera o starcie | **BRAK** — zaakceptowano Kartę i roadmapę; `URUCHOM ETAP E1` wymaga osobnej dyspozycji, a `URUCHOM ETAP E2` osobnego mandatu po rozliczeniu E1 |

## 0. Rejestr kluczowych decyzji projektowych

| Obszar | Uzgodniony projekt — podlega akceptacji całej Karty, jeśli nie wynika wprost z dyspozycji Ownera |
| --- | --- |
| Granica projektu | **Wyłącznie Development**. Utrzymanie cykli, odbiór i dowody pozostają w tym środowisku; inne procesy wydaniowe nie są zadaniami ani DoD tej Karty. |
| Funkcja | 11 prawidłowo zidentyfikowanych instrumentów; 4 istniejące modele; wszystkie rzeczywiście dopuszczone warianty i horyzonty. |
| Stan początkowy | W Neon Development istnieją zapisane prognozy i weryfikacje dla obecnych 11 ID; kwalifikacja `READY` poprzedza obliczanie braków. |
| Sposób pracy | Reuse istniejących Forecast Core / Neon / prepared reads i przyrostowego maintenance; bez nowego silnika. |
| Historia | Trzy oddzielne klasy: strict point-in-time, rekonstruowana diagnostyka oraz ocena rzeczywiście opublikowanej prognozy. |
| Użytkownik i Clerk/E1 | **Bez ponownego interaktywnego potwierdzania** podczas zwykłej pracy po poprawnym wejściu do Findera, również po przełączeniu na drugą organizację, w której użytkownik ma aktualne prawa. Serwer ponownie wiąże uprawniony kontekst; stary kontekst nie uprawnia do odczytu w nowej organizacji. Niezbędna autoryzacja każdej operacji pozostaje automatyczna i aktualna. |
| Codex | **Maksymalna autonomia wewnątrz osobno uruchomionego etapu**: bez mikrozgód, zbędnych reviewerów i sztucznych bramek; rzeczywiście wymagane owner-only/CI/branch protection nadal obowiązują. |
| Odbiorcy | Jeden rzeczywiście działający, autoryzowany scenariusz odczytu w Development dla kategorii kosztowej/PCI oraz jeden dla ACG; bez nowych ekranów, bez nieuprawnionych zmian współdzielonego ACG. |
| Odbiór | Odczyt `READY` całej przyjętej macierzy, automatyczny przyrost Development **przed uzgodnionym po E1 terminem gotowości**, szybki Finder, licencja i izolacja, dwa konsumery, monitoring i recovery. `NO_OP` tylko po potwierdzeniu braku nowego wejścia i dojrzałych celów; wyjątki źródła raportowane oddzielnie. |

## 1. Potrzeba biznesowa i granice rozwiązania

Kupiec otwiera Benchmark Finder, wybiera benchmark, model, kadencję/semantykę i horyzont. Powinien **od razu** zobaczyć aktualną, wcześniej przygotowaną prognozę i wiarygodnie sklasyfikowaną informację o jej historycznej sprawdzalności. Przy każdej zmianie wyboru nie może czekać na wieloletni fitting, pełny backtest ani nowe żądanie danych Macrobond. Te same kontrolowane, zapisane wyniki powinny być możliwe do wykorzystania przez funkcję kosztową i ACG, zgodnie z rzeczywistymi uprawnieniami.

**Zakres v1:** 11 instrumentów, modele `naive`, `damped_holt`, `ets`, `arima`; kwalifikowane kombinacje `series × model × cadence × semantics × horizon`; historyczny bootstrap z reuse; per-wariant T0; trwały Current/Verification, nocny przyrost, matured verification, rewizje, odczyt prepared-only w Finderze, dwa konkretne scenariusze konsumpcji i obserwowalna eksploatacja **w Development**.

**Wyłączenia:** redesign interfejsu, zmiany matematyki modeli, nowe modele, bezuzasadniona przebudowa Market Data, nowy magazyn/worker/silnik bez dowodu konieczności, masowy onboarding kolejnych serii, zmiany współdzielonego kodu ACG poza właściwym mandatem oraz osobne procesy wydaniowe. Uzgodnione wymaganie nie upoważnia do obchodzenia licencji, Source/E1 ani polityk bezpieczeństwa.

**Parametry przyjętej Karty, wymagające wskazanego doprecyzowania w E1:** P95 ≤ 3,0 s od wyboru do wyświetlenia gotowej prognozy i odpowiedniego stanu sprawdzalności. Co najmniej 100 reprezentatywnych pomiarów Development (w tym ≥20 pierwszych wyświetleń po nowej sesji), obejmujących 11 serii, cztery modele i dopuszczone warianty. Dopuszczalny cut-off i termin gotowości nocnej aktualizacji wynikają z lawful publikacji oraz pomiarów E1; **zostaną ustalone i zaakceptowane przy rozliczeniu E1 przed mandatem E2** (w razie potrzeby osobno dla grup serii/kalendarzy). Przed tą decyzją nie ma arbitralnej godziny zobowiązania.

## 2. Fakty, diagnoza, zakres ponownego użycia

### 2.1. Potwierdzony stan źródłowy i ograniczenia dowodów

- Obecna konfiguracja portfela PORR zawiera 11 `seriesId`, ale jest **konfiguracją prezentacyjną**, nie źródłem zatwierdzonych biznesowo definicji instrumentów: [`porr-demo-forecast-portfolio.ts`](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/benchmark/porr-demo-forecast-portfolio.ts).
- W kodzie istnieją cztery modele, osiem rozpoznanych częstotliwości (`DAILY`, `WEEKLY`, `MONTHLY`, `BIMONTHLY`, `QUARTERLY`, `QUADMONTHLY`, `SEMIANNUAL`, `ANNUAL`), [resolver możliwości](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/forecast/capability-resolver.ts), prepared read, oddzielne ścieżki obliczeń oraz [rolling-daily maintenance](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/forecast/rolling-daily-maintenance.ts). Nie każda kombinacja enumeracji jest legalna lub zaimplementowana.
- **Nieaktualna diagnoza `0/11` jest odwołana.** Odczyt Codexa przez ograniczone widoki zwrócił 124 okresowe Current i 182 okresowe Verification ze statusem `AVAILABLE` dla 11 dotychczasowych ID. Niezależny odczyt ChatGPT tabel `public` w tym samym branchu Development zwrócił 234 Current, 271 Verification, 95 snapshotów Rolling Daily dla 10 ID, 69 844 dojrzałych i 17 248 oczekujących rekordów Rolling Daily Verification dla 10 ID. Są to **różne zakresy i role odczytu**, nie dwie porównywalne miary `READY`. E1 ustala zakres i przyczynę rozbieżności bez wymagania wyrównania liczników.
- W bezpośrednim odczycie aktualizacje zapisanych przebiegów okresowych i `historyEndAt` mogły być starsze od bieżących obserwacji rynkowych; `AVAILABLE` w bazie nie stanowi dowodu aktualności, zgodności wariantu, licencji ani rzeczywistego uprawnionego readbacku.
- [`interactive-preparation.ts`](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/forecast/interactive-preparation.ts) zawiera odczyt przygotowanych danych i ścieżkę przygotowania, która w wybranych sytuacjach może wykonywać obliczenia. Wymagany jest dowód całej ścieżki klient → serwer → Forecast, nie wyłącznie flaga UI `preparedReadsOnly`.
- [`history-runtime.ts`](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/market-data/history-runtime.ts) i [`source-worker-runtime.ts`](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/forecast/source-worker-runtime.ts) mają wiązania środowiskowe, które należy zachować podczas modyfikacji; ten projekt używa wyłącznie skonfigurowanego Development.
- Rejestr, workflow i stan usługi nie dowodzą automatycznie działającego nocnego cyklu. E1 potwierdza uruchomienie, Source, przyrost, licencję i uprawnienia, a E2 realizuje brakujący zakres na Development.

### 2.2. Portfel do formalnej kwalifikacji

| # | Oczekiwany instrument biznesowy | Obecny kandydat `seriesId` | Wymagana weryfikacja |
| --- | --- | --- | --- |
| 1 | ICE Brent Crude — front | `b_c1_cl` | ICE, settlement, front/roll i jednostka |
| 2 | WTI Physical — front | `cl_c1_cl` | fizyczna dostawa, pozycja, kontrakt i settlement |
| 3 | Brent Spot North Sea | `wocaes0074` | spot, a nie futures; region, waluta i data publikacji |
| 4 | Brent — continuous | `bz_c1_cl` | metodologia continuous i odrębność od pozycji 1 |
| 5 | E-mini Crude Oil — continuous | `qm_c1_cl` | właściwy rynek i reguła rolowania |
| 6 | Copper LME futures — front | `hg2027g_cl` | obecny kandydat opisuje **luty 2027**; potwierdzić giełdę i dynamiczny front |
| 7 | LME Copper Cash Seller | `lmeofcucashask` | cash ask/seller, waluta i jednostka |
| 8 | Copper — continuous | `hg_c1_cl` | zweryfikować rynek; nie utożsamiać automatycznie z LME |
| 9 | North European HRC futures — front | `ehr2027g_cl` | obecny kandydat opisuje **luty 2027**; sprawdzić front i region |
| 10 | HWWI Iron Ore & Steel Scrap Index | `hwwi_gb_ironsteel_2021_eur` | **seria miesięczna**; wersja indeksu, data publikacji i zamknięcie okresu |
| 11 | LME Steel Scrap futures — front | `lmescusd20270226` | obecny kandydat opisuje **luty 2027**; potwierdzić front i serię właściwą |

Wymagany rekord kwalifikacji: biznesowy instrument → provider ID → giełda/rodzaj instrumentu → waluta i jednostka → częstotliwość/semantyka/roll → zgodność licencyjna → ostatnia dostępna obserwacja → pokrycie historii → zgodne modele i horyzonty → decyzja o użyciu. Nie zastępować błędnych ID milcząco. Stare artefakty zachowują pierwotną tożsamość.

### 2.3. Wybór wariantu architektonicznego

1. **Rekomendowany: reuse + wąskie rozszerzenie.** Existing Forecast Core, Market Data, Neon, capability resolver, prepared reads, Rolling Daily i obecne operacje Forecast otrzymują potrzebną koordynację, brakujące delty oraz kontrolowaną projekcję odbiorców.
2. Samo zwiększanie szybkości fittingu *on-click* nie usuwa powtarzanych, kosztownych obliczeń, więc nie jest strategią główną.
3. Nowy engine, warehouse lub odrębna platforma nie są uzasadnione bez konkretnego dowodu luki, kosztu i decyzji Ownera.

**Reguła bootstrapu:** dla każdej przyjętej tożsamości `series × model × cadence × semantics × horizon × method/policy version` najpierw ustalić `EXISTS`, zgodność, `REUSABLE`, świeżość i wynik autoryzowanego odczytu. Dopiero brakujące lub nieaktualne kwalifikowane fragmenty liczyć w granicach dopuszczonej polityki. Te kody są etykietami diagnostycznymi, nie nową publiczną enumeracją.

## 3. Pełna checklista BSDC v1.1 — 29 kryteriów A–F

Statusy robocze: `USTALONE`, `W_TRAKCIE`, `DO_USTALENIA`, `NIE_DOTYCZY`, `ZABLOKOWANE`. `USTALONE` wskazuje ustalenie projektowe, nie właścicielską akceptację ani wykonany test. Warunki, których dowód powstanie w E1/E2, nie stają się wsteczną blokadą podpisania planu.

| ID | Status | Ustalenie, granica lub wymagany dowód |
| --- | --- | --- |
| A1 | USTALONE | Problem kupca: opóźnienia Current i Verification podczas interaktywnego wyboru. |
| A2 | USTALONE | Finder, odbiorca kategorii kosztowej, ACG; decyzje biznesowe Owner SG2. |
| A3 | W_TRAKCIE | Mierzalny wynik i pełne `FINAL-01–10`; proponowane P95 wymaga zatwierdzenia Ownera. |
| A4 | USTALONE | Priorytet: szybki, legalny i wiarygodny wynik, reuse, **wyłącznie Development**. |
| B1 | W_TRAKCIE | Przegląd kodu i Neon; E1 sprawdza faktyczne Source, artefakty i działa­jący proces. |
| B2 | USTALONE | Rozdzielono publiczne liczniki, ograniczone widoki, status `AVAILABLE` i stan `READY`. |
| B3 | USTALONE | Rozważono reuse/extension, on-click tuning i nową platformę. |
| B4 | USTALONE | Rekomendacja: rozszerzyć istniejącą platformę, nie duplikować Forecast. |
| C1 | USTALONE | Trzy przepływy: historyczny bootstrap, nocna delta, autoryzowany odczyt odbiorców. |
| C2 | W_TRAKCIE | Walidacja kalendarza, rewizji, Actual, rozłączeń, idempotencji i braku dostępu; szczegóły E1. |
| C3 | USTALONE | Zakres v1 i wyłączenia ograniczone do Development, bez nowych ekranów. |
| C4 | W_TRAKCIE | Istniejący Finder; brak nowego MagicPath, test jego stanów i płynnej sesji. |
| C5 | USTALONE | Funkcjonalny odbiór: pełna macierz `READY`, UI, dwa konsumery, delta. |
| D1 | W_TRAKCIE | SG2 prowadzi; potwierdzenie ownera rzeczywistego PCI/ACG oraz granic ARCHITECTURE w E1. |
| D2 | W_TRAKCIE | Wymagany aktualny resolver Code Routing/Code State/ACTUAL przed mutacją. |
| D3 | USTALONE | Drzewo realnych ścieżek i ewentualnych małych rozszerzeń w §4.5; nowy path warunkowy. |
| D4 | USTALONE | Kontrakt źródło/Forecast/read oraz granice danych i odbiorców w §4. |
| D5 | W_TRAKCIE | E1, licencja, sesja, UserID/OrganisationID, prawa operacji i zasobu, brak eksponowania prywatnych danych. |
| D6 | W_TRAKCIE | Neon/Render **Development**, koszty, monitoring, LKG, retry i recovery; pomiary E1. |
| E1 | USTALONE | Dwa etapy rezultatowe E1 pilot, E2 gotowy i odebrany produkt Development. |
| E2 | USTALONE | Konkretne działanie i testowalny DoD każdego z dziewięciu tasków. |
| E3 | USTALONE | Profil, ograniczenia Source/E1, osobny mandat na E1 i E2, owner-only tylko gdy konieczny. |
| E4 | USTALONE | Testy business/readback/negative/CI/live delta i pełny scenariusz użytkownika. |
| E5 | W_TRAKCIE | Szacunki kosztu i czasu wykonania wynikną z reprezentatywnej próby E1; bez fikcyjnych dat. |
| E6 | USTALONE | Roadmapa END-TO-END, zadania, ownerzy, DoD, STOP, rejestr i `FINAL-*` w **tej samej Karcie**. |
| F1 | USTALONE | Decyzje, fakty, hipotezy, granice i ryzyka w §0, §2 i §6. |
| F2 | W_TRAKCIE | Zgodność z aktywnym BSDC i SG2; aktualny routing/adopcja kontraktów przed zapisem. |
| F3 | DO_USTALENIA | Właściciel nie zaakceptował jeszcze jednej kanonicznej Karty ani jej roadmapy/DoD/revision. |
| F4 | USTALONE | Handoff i rejestr etapowy w §5 i §7; bez automatycznej implementacji. |

## 4. Funkcjonalność i architektura

### 4.1. Pełny przepływ Development

`Autoryzowane źródło → istniejąca historia Market Data/Neon Development → kwalifikacja wariantu → reuse lub uzupełnienie Current/Verification → T0 i state → nocna delta → prepared-only odczyt SG Runtime → Finder / kategoria / ACG`

- **Bootstrap i T0.** Dla każdej serii i wariantu ustalić ostatni dopuszczalny okres treningowy, `forecastOrigin`, pierwszy przyszły target (`N+1`), fingerprint, wersję polityki, source cut-off. Osobno utrzymywać stan ostatniego obsłużonego originu i dojrzałych/otwartych celów weryfikacji. Niczego nie publikować jako dawno opublikowanej prognozy, jeśli faktycznie zostało rekonstruowane później.
- **Historia PIT.** `strict PIT` wymaga wersji **wartości, metadanych, transformacji, wyboru modelu/parametrów i informacji kalibracyjnej dostępnych w historycznym momencie decyzji**. `history.end`, dzisiejszy fingerprint czy bieżąca wartość końca okresu nie dowodzą tego. `reconstructed/latest-vintage` pozostaje odrębną diagnostyką; weryfikacja wcześniej opublikowanej prognozy ma własną klasę i jej pierwotna wartość pozostaje niezmieniona. E1 sprawdza możliwość spełnienia wymaganego pokrycia; odstępstwo od decyzji Ownera wymaga nowej decyzji przed E2.
- **Delta.** Tylko nowe *lawful* originy oraz weryfikacje, których Actual dopiero dojrzał. Nie wykonywać pełnego historycznego backtestu codziennie. `NO_OP` jest dopuszczalne wyłącznie po **pozytywnym potwierdzeniu**, że nie pojawiło się nowe dopuszczalne wejście, nie ma dojrzałych celów weryfikacji ani innej pracy należnej w danym cyklu. Brak oczekiwanej publikacji po terminie, awaria lub odmowa Source oraz nierozliczona odpowiedź są odrębnymi statusami, nie `NO_OP`. Awaria jednej serii nie przesuwa innych cursorów i nie narusza LKG. Spóźnione wartości, przerwana transakcja, rewizja prefiksu i nowa wersja polityki skutkują kontrolowaną, ograniczoną odbudową lub jawnym `REBUILD_REQUIRED`.
- **Scheduler.** Działający, trwały wyzwalacz **w Development**, niezależny od Codespace; preferencja reuse istniejących operacji i workerów. Niezbędne Source/API requests i koszt podlegają realnym grantom. E1 ustala kalendarz publikacji, cut-off danych wejściowych oraz mierzalny termin gotowości wyników, przyjęte przy rozliczeniu E1; E2 wykazuje ich dotrzymanie w faktycznym, automatycznym cyklu, z pomiarem lag i rejestrem wyjątków. Nie tworzyć nowej usługi bez dowodu luki i prawidłowego dopuszczenia.
- **Odczyt.** Wszystkie przyjęte legalne warianty/horyzonty osiągają `READY` w faktycznie autoryzowanej projekcji. `MISSING`, `NOT_PREPARED`, `STALE`, `PROVENANCE_UNKNOWN` to braki odbiorowe, a nie sposób zaliczenia zakresu. `UNSUPPORTED` wolno użyć tylko dla uzasadnionego i formalnie wyłączonego wariantu. Stan brakującej weryfikacji nie powoduje wygenerowania fikcyjnej metryki ani on-click fittingu.

### 4.2. E1/Clerk — zero dodatkowego potwierdzania przy zwykłej pracy

**Wymaganie biznesowo-funkcjonalne:** po prawidłowym otwarciu Findera na ważnej sesji Clerk w serwerowo ustalonym kontekście `UserID × OrganisationID` użytkownik może bez dodatkowych ekranów, zgód, challenge ani ponownego logowania zmieniać uprawnione benchmarki, modele, kadencje i horyzonty. Nie wymagamy ponownego ręcznego potwierdzania posiadanych praw do Findera przy każdej zmianie wyboru. To samo dotyczy odczytu przygotowanej sprawdzalności.

**Zasada bezpieczeństwa:** możliwość wyświetlenia ekranu nie jest sama w sobie nieograniczonym grantem do każdego zasobu. **Każda chroniona operacja `forecast.read` pozostaje automatycznie autoryzowana po stronie serwera** z kontrolą aktualnej sesji/tożsamości, organizacji, uprawnień produktu, zasobu, licencji i cofnięcia praw. Kontekst z URL/klienta nie zastępuje serwerowego dowodu. Należy **bezpiecznie ponownie wykorzystywać aktualny, zaufany kontekst/receipts i eliminować zbędne wywołania Clerk/E1**, o ile kontrakt dopuszcza reuse i wymagane unieważnienie nadal działa. **Zmiana organizacji nie jest automatycznym powodem odmowy**: backend ustala i weryfikuje nowy kontekst organizacji oraz aktualne prawa. Dla ważnej sesji i uprawnień w nowej organizacji `forecast.read` działa bez dodatkowego interaktywnego potwierdzenia; poprzedni kontekst nie może już autoryzować odczytu w nowej organizacji ani umożliwiać wycieku danych przez cache lub żądania w toku. Brak członkostwa, prawa do zasobu, cofnięcie grantu lub wygaśnięcie sesji skutkują odmową albo standardowym ponownym uwierzytelnieniem, gdy jest rzeczywiście potrzebne.

**Test:** w istniejącym UI wykonać serię przełączeń uprawnionych wariantów z jedną ważną sesją. Wynik nie może wywołać dodatkowego interaktywnego uwierzytelnienia, a trasowanie wskazuje liczbę i powód wywołań zewnętrznych. **Dwa scenariusze zmiany organizacji:** (A) sesja ważna, prawa w docelowej organizacji obecne → automatycznie zweryfikowany nowy kontekst i poprawny odczyt bez dodatkowego challenge; (B) brak praw w docelowej organizacji albo sesja nieważna → odmowa, bez przecieku danych. W obu przypadkach stary kontekst i cache nie dają prawa do odczytu nowej organizacji. Osobno sprawdzić cofnięcie grantu, obcą serię i wygaśnięcie sesji. Nie wymagamy „zero technicznych kontroli serwerowych”; wymagamy **zero zbędnego tarcia** i braku nieuprawnionych odczytów.

### 4.3. Integracje kosztowe i ACG

Owner określa dwa rzeczywiste scenariusze biznesowe, nie arbitralne nowe ekrany. E1 identyfikuje autoryzowany entrypoint i ownera dla kategorii kosztowej/PCI oraz adaptera SG Runtime do ACG. W E2 co najmniej jedna uprawniona selekcja na odbiorcę **rzeczywiście czyta** przygotowaną prognozę i odpowiednio sklasyfikowaną sprawdzalność w Development. Zachować walutę, jednostkę, okres, `as-of`, fingerprint/provenance i prywatne dane organizacji. `inputAsOf` = koniec obserwacji nie jest dowodem strict PIT. Jeśli aktualna projekcja nie potrafi wiarygodnie przenieść klasyfikacji metryki, oznaczyć ją zgodnie z kontraktem albo pominąć; nie prezentować reconstructed jako strict PIT. Żadnych zmian wspólnego pakietu `packages/assistant-context-gateway` z mandatu SG2; zależność innego ownera wymaga oddzielnego upoważnienia, a o ewentualnej zmianie zakresu biznesowego decyduje Owner.

### 4.4. Odpowiedzialności, licencja i odporność

| Powierzchnia | Logiczny owner i granica |
| --- | --- |
| Market Data / Macrobond | SG2 Platform / Source: istniejąca historia, metadane, licencja, proweniencja, dopuszczony import. |
| Forecast runtime | SG Runtime: kwalifikacja, przygotowanie, istniejący zapis i read API, tożsamość prognozy. |
| Forecast Operations | Utrzymanie cykli, scheduler, obserwowalność, idempotencja, retry, alarmy. |
| Finder i Dashboard | SG Runtime i właściwy owner Dashboard Preview: istniejące widoki, prepared-only, szybkość i stany UX. |
| Kategoria/PCI | Rzeczywisty owner i adapter ustalony w E1, bez domniemania, że `lib/cost-analysis` obejmuje cały produkt. |
| ACG | Adapter SG Runtime w granicach SG2; współdzielony gateway ma niezależnego ownera. |

Prawa Source do pobrania i przechowywania nie oznaczają automatycznie prawa do udostępniania pochodnych, wyświetlania ich innym odbiorcom ani przekazania do procesora AI. UserID/OrganisationID i dokumenty klienta nie są publiczną historią rynkową. Nie logować tajnych kluczy, prywatnych wag, licencjonowanych wartości ani prywatnego kontekstu. Ograniczone operacje i role SERVICE są serwerowo weryfikowane; klient nie otrzymuje dostępu do Neon.

Monitoring: status cyklu, liczba variant due/NO_OP/FAILED, nowy origin, matured count, freshness względem kalendarza, koszt/provider calls, retry, opóźnienie, P95 UI, LKG i recoverability. Dowody w zapisanych systemach PMOS/PHR, bez ich dublowania w osobnych plikach.

### 4.5. Drzewo monorepo i routing (ścieżki proponowane, nie przyznane uprawnienia)

```text
profitia/SG-dev @ main
├── Canon/proposals/bsdc/SG2/
│   └── BSDC-20261123-SG2-PRECOMPUTED-FORECASTS.md    [KARTA PDR 1.0 — OWNER_APPROVED / PUBLISHED]
├── apps/
│   ├── sg-runtime/                                     [ISTNIEJE / SG Runtime]
│   │   ├── lib/benchmark/
│   │   │   ├── porr-demo-forecast-portfolio.ts         [REUSE / kwalifikacja 11 ID]
│   │   │   └── analytics-eligibility-handlers.ts        [REUSE/ROZSZERZENIE / bez nowego logowania]
│   │   ├── lib/market-data/history-runtime.ts           [ISTNIEJE / Source; kontrola legalnej konfiguracji]
│   │   ├── lib/forecast/
│   │   │   ├── contracts.ts; cadence.ts                  [REUSE / modele i kadencje]
│   │   │   ├── capability-resolver.ts                    [REUSE / legalna macierz]
│   │   │   ├── interactive-preparation.ts                [REUSE/ROZSZERZENIE / tylko prepared read w Finderze]
│   │   │   ├── production-operations.ts; service.ts      [REUSE/ROZSZERZENIE / koordynacja delta]
│   │   │   ├── rolling-daily-maintenance.ts             [REUSE / przyrost]
│   │   │   ├── source-worker-runtime.ts                 [ISTNIEJE / worker dla Development]
│   │   │   └── stored-*-read.ts                          [REUSE / exact read]
│   │   ├── lib/platform/
│   │   │   ├── private-runtime.ts                        [ISTNIEJE / sesja i uprawnienia]
│   │   │   └── organisation-context.ts                  [ISTNIEJE / kontekst organizacji]
│   │   ├── lib/cost-analysis/market-data-adapter.ts      [KANDYDAT DO INTEGRACJI / owner do potwierdzenia]
│   │   ├── lib/assistant/sources.ts                      [REUSE / adapter ACG SG Runtime]
│   │   ├── components/benchmark-finder/
│   │   │   └── benchmark-finder-client.tsx               [ISTNIEJE / brak redesignu]
│   │   └── scripts/run-forecast-production-operations.ts [REUSE / existing CLI]
│   └── dashboard-preview/                               [ISTNIEJE / istniejący widok i stany]
├── tooling/Benchmark-Forecasting/                        [ISTNIEJE / nie zmieniać matematyki bez mandatu]
└── .github/workflows/forecast-production-operations.yml  [ISTNIEJE / ewentualny reuse po preflight]
```

Węzły z nazwą `production-operations` to **istniejące nazwy modułów Forecast**, a nie deklaracja pracy na innym środowisku. Nowy cienki orkiestrator lub adapter wolno dodać tylko wtedy, gdy analiza potwierdzi lukę, a aktualny resolver `Code Routing / Code State / ACTUAL`, profil i G1 dopuszczą dokładne ścieżki. Obowiązuje `READ FROM LEGACY — WRITE TO CANONICAL OWNER`; nie mutować shared ACG z niewłaściwego profilu.

## 5. Roadmapa END-TO-END, Business DoD i rejestr wykonania

### 5.1. Końcowy Business Definition of Done — **wyłącznie Development**

Wszystkie `FINAL-01–10` muszą być potwierdzone na rzeczywistym SG2 Development i właściwym kodzie/danych/uprawnieniach. Kontrolowane replay/awarie mogą działać na dopuszczonych izolowanych zakresach Development, nie zmieniając niezależnych zasobów. **PR, CI PASS i sam endpoint nie zastępują działania produktu.**

| ID | Obowiązkowy wynik | Sposób odbioru i dowód |
| --- | --- | --- |
| **FINAL-01** | **11 poprawnych instrumentów i `READY` całej przyjętej macierzy.** | Metadane i decyzje o ID. Dla każdej dopuszczonej tożsamości/horyzontu osobno `EXISTS`, status, zgodność, freshness, licencja i autoryzowany readback; przyjęte warianty mają `READY`, a `MISSING/STALE/NOT_PREPARED` **nie zaliczają odbioru**. Wyłączenia tylko przez resolver i przyjętą decyzję zakresową. |
| **FINAL-02** | **Prawidłowy T0, historia i uczciwa sprawdzalność.** | Historia/training origin, wersje wejścia, proveniencja, otwarte i dojrzałe cele. Raport historyczny klasyfikuje strict PIT, reconstructed i prospective. Dla przyjętego okna strict PIT: dowód historycznych wartości i metadanych, transformacji, selekcji parametrów i kalibracji według as-of. Ograniczenia tylko według jawnej polityki Ownera. |
| **FINAL-03** | **Rzeczywisty, terminowy automatyczny przyrost nocny Development.** | Cut-off danych wejściowych i termin gotowości są mierzalnie ustalone na podstawie E1 i zatwierdzone przy jego rozliczeniu przed E2. E2 dowodzi ich dotrzymania w co najmniej jednym **rzeczywistym, automatycznym** cyklu poza Codespace: nowy lawful origin → przygotowanie i zapis → autoryzowany readback z timestampami publikacji, startu i zakończenia. Dodatkowy cykl lub kontrolowany replay tych samych danych dowodzi idempotencji i `NO_OP` **tylko po potwierdzeniu braku nowej dopuszczalnej obserwacji i dojrzałych celów**. Spóźniona lub brakująca oczekiwana publikacja, błąd/odmowa Source i niepewny wynik są raportowane oddzielnie, bez fałszywego `NO_OP`. Replay miesięcznej weryfikacji nie udaje rzeczywistej historycznej publikacji. T0 i cursory są środowiskowo właściwe dla Development. |
| **FINAL-04** | **Idempotencja, rewizje, awarie i LKG.** | Dowody przerwania, resume, równoległości, spóźnionego Actual, prefiksowej rewizji, awarii Source i braku nowej publikacji. Zachować opublikowane wartości prognoz, nie przesunąć kursora przez nieukończony zakres, nie przeciekać do innych organizacji. |
| **FINAL-05** | **Szybki Finder bez interaktywnego compute i dodatkowych potwierdzeń użytkownika.** | Co najmniej 100 prób Development (w tym ≥20 pierwszych po nowej sesji), wszystkie 11 serii, 4 modele i reprezentatywne kadencje; od wyboru do renderu, raport P50/P95, proponowane P95 ≤3 s po akceptacji Ownera. Żadne kliknięcie nie uruchamia fittingu, pełnego backtestu, pobrania Macrobond ani nowego zadania. Przy ważnej sesji zmiany wyborów nie uruchamiają interaktywnych potwierdzeń Clerk/E1; zbędne wywołania identyfikowane i usunięte, konieczna serwerowa autoryzacja zachowana. |
| **FINAL-06** | **Jeden działający scenariusz kategorii kosztowej/PCI.** | Właściwy zaakceptowany entrypoint w Development czyta przygotowany wynik z prawidłową walutą, jednostką, okresem, proweniencją i prywatnym kontekstem; obca organizacja/zasób — odmowa. Nie mylić przygotowania kontraktu z rzeczywistą konsumpcją. |
| **FINAL-07** | **Jeden działający scenariusz ACG.** | Adapter SG Runtime w Development generuje uprawniony, minimalny kontekst i bezpiecznie prezentuje metryki zgodnie z ich klasą PIT; `inputAsOf` nie jest dowodem strict PIT. Test nieuprawnionego podmiotu, niedostępnej serii i obcej organizacji. Zmiana shared ARCHITECTURE nie następuje z mandatu SG2. |
| **FINAL-08** | **Rozszerzalność portfela.** | Dopuszczona, już licencjonowana seria kontrolna poza początkową jedenastką lub odwracalny non-private fixture przechodzi kwalifikację, Current, Verification i delta bez odrębnego pipeline'u; brak konieczności kupowania nowego źródła wyłącznie do testu. |
| **FINAL-09** | **E1, licencja i izolacja przy minimalnym tarciu, także po zmianie organizacji.** | Dla ważnej sesji i praw do nowej organizacji serwer automatycznie weryfikuje jej kontekst i autoryzuje `forecast.read` **bez dodatkowego interaktywnego potwierdzenia**; stary kontekst nie może autoryzować nowej organizacji. Dla braku praw w nowej organizacji, obcego zasobu/roli, cofniętego grantu lub wygasłej sesji następuje odmowa lub rzeczywiście wymagane ponowne uwierzytelnienie; bez ujawnienia danych poprzedniej lub obcej organizacji. Test obejmuje **oba wyniki przełączenia organizacji**, revocation/recency i izolację cache/żądania. Zachować licencję oraz brak niedozwolonych pól w logach/ACG. |
| **FINAL-10** | **Faktycznie uruchomione i odebrane Development.** | Zgodne SHA, CI, działający runtime i worker, powiązanie właściwego Neon Development, automatyczny job i monitoring, dowody `FINAL-01–09`, pozytywny end-to-end UX, recovery, rzeczywisty szacunek miesięcznego kosztu oraz decyzja Ownera o odbiorze. |

### 5.2. Etapy i numerowane taski wykonawcze

#### E1 — Kwalifikacja, reuse i działający pilot (Development)

**Wynik:** prawidłowo rozpoznane lub jawnie nierozstrzygnięte tożsamości 11 instrumentów; macierz wariantów; przegląd już istniejących artefaktów; reprezentatywny end-to-end pilot **na jednej serii dziennej i jednej miesięcznej**; pomiar kosztu, opóźnień, PIT i liczby zbędnych wywołań Clerk/E1. Ten etap ma dostarczyć pierwszą wartość, **nie tylko dokument audytu**.

**Mandat:** wyłącznie po akceptacji PDR/roadmapy i osobnym `URUCHOM ETAP E1` Ownera. Full Autopilot w dozwolonych granicach Dev; specjalny koszt/Source/grant zachowuje osobną, dokładną zgodę, jeśli rzeczywiście wymaganą.

| Task | Zakres / komponenty | Owner / zależności | DoD / wymagany dowód |
| --- | --- | --- | --- |
| **E1-T01** | Skwalifikować 11 instrumentów, legalną macierz wariantów oraz istniejące `public`/restricted artefakty. `porr-demo-forecast-portfolio.ts`, resolver, Neon/Source. | SG2 Platform/Market Data + SG Runtime; równolegle z T02. | Macierz 11 ID i owner rozbieżnych definicji; dokładne role/widoki/liczniki; `REUSABLE/STALE/MISSING/WRONG_ID` i gotowość faktycznego readbacku. |
| **E1-T02** | Sprawdzić skuteczny Development Source → ingest → worker → persist → read; E1/Clerk, harmonogram/role, źródłowy PIT/licencję, entrypointy kategorii i ACG, routing oraz kalendarze publikacji Source. | SG Runtime + Forecast Operations + Source i właściwi owners; równolegle z T01. | Aktualne powiązania Dev, wymagane dopuszczenia, macierz as-of, granice Source/ARCHITECTURE, mapa publikacji i wstępne możliwości terminowe oraz dowód, które wywołania Clerk/E1 są zbędne. Nie wymagać wyniku tej próby przed przyjęciem Karty. |
| **E1-T03** | Reuse lub mały bootstrap oraz delta dla jednej serii dziennej i jednej miesięcznej (jeżeli właściwy HWWI — preferowany), bez nowych silników. | Forecast + Market Data; po kwalifikacji i dozwolonych dostępach. | Dwa uprawnione Current+Verification, T0, origin, matured/open targets; potwierdzony `NO_OP` wyłącznie przy braku nowego wejścia i należnych celów, kontrolowany replay, rozdział Source failure/late publication i klasyfikacja PIT; rzeczywisty koszt. |
| **E1-T04** | Odczytać wynik w istniejącym Finderze, zmierzyć UX i koszty zewnętrzne; sprawdzić płynną sesję i zmianę organizacji. | SG Runtime + Dashboard + Forecast Operations; po T03. | Działający pilot UI bez fittingu po kliknięciu i bez nowych interaktywnych potwierdzeń; P50/P95 próby, koszty, liczba wywołań Clerk/E1, testy obu rezultatów przełączenia organizacji. Wynik prób nocnego cut-off i czasu przetwarzania umożliwia ustalenie SLO przy rozliczeniu E1. Dowód exact SHA/Neon Dev. |

**DoD E1:** dwa realne, prawidłowo zakwalifikowane wyniki i odczyty w Development; wiarygodny status wszystkich 11 instrumentów; zakres reuse/braków; koszty i luki; wiarygodny plan domknięcia E2. **Przy rozliczeniu E1 Owner przyjmuje wynikający z pomiarów cut-off i termin gotowości danych/wyników, stosowne do kalendarzy serii, albo jawnie rozstrzyga ograniczenie.** Nie wymaga się znajomości tych godzin przed próbą E1. Jeżeli źródło, licencja lub PIT uniemożliwia przyjęte wymaganie, zachować `CZĘŚCIOWY` lub `ZABLOKOWANY` i przed E2 uzyskać odpowiednią decyzję Ownera. Nie udawać wykonania reszty portfela.

#### E2 — Kompletny produkt, automatyzacja i odbiór END-TO-END (Development)

**Wynik:** pełna zaakceptowana macierz `READY`, trwałe Current/Verification, naturalny przyrost poza ścieżką użytkownika, płynny przygotowany odczyt w Finderze, działający konsument kosztowy i ACG, monitoring i **kompletny odbiór FINAL-01–10 w Development**.

**Mandat:** dopiero po rozliczeniu E1 i osobnym `URUCHOM ETAP E2`. Codex wykonuje wszystkie dozwolone taski E2 autonomicznie, również zwykłe zmiany kodu, testy, CI, commit/push/PR, dozwolony merge oraz autoryzowane uruchomienie Development; bez ponownych pytań o rutynowe kroki. Bez przejścia na inne środowiska i bez działań poza rzeczywistą właściwością SG2. Istotne nowe koszty/granty/własność wymagają właściwego rozstrzygnięcia; zadania niezależne trwają dalej.

| Task | Zakres / komponenty | Owner / zależności | DoD / wymagany dowód |
| --- | --- | --- | --- |
| **E2-T01** | Domknąć portfel 11 serii, pełny reuse + uzupełniający bootstrap i T0, dojrzałe/otwarte Verification, klasyfikację PIT. | Forecast Runtime + Market Data; po E1 i akceptacji ewentualnych zmian portfela/PIT. | `READY` dla każdego przyjętego wariantu w realnym odczycie; dokładne liczniki, identity, freshness, provenance, PIT i brak niezapisanych braków. `FINAL-01/02`. |
| **E2-T02** | Przyrostowy koordynator, rzeczywisty nocny scheduler i trwałe uruchomienie Development; retry, rewizja, prawidłowy `NO_OP`, telemetry. | Forecast Operations + SG Runtime; logika może powstawać równolegle z T01, aktywacja portfela po gotowym T01. | Wykazany automatyczny lawful przyrost i readback **przed zatwierdzonym po E1 terminem gotowości**, z datami/czasami i rozdzieleniem braku pracy od problemu Source; replay no-op tylko przy potwierdzonym zerowym przyroście i braku matured targets, kontrolowane awarie, spójny cursor, monitoring/recovery, koszt. `FINAL-03/04/08`. |
| **E2-T03** | Prepared-only Finder oraz brak ponownych interaktywnych wywołań Clerk/E1 w normalnej sesji, także po uprawnionym przełączeniu organizacji; zaufany kontekst bezpiecznie reuse. | SG Runtime + Dashboard; równolegle z T02 po rozpoznaniu źródła w E1. | Istniejący UX, brak fittingu i dodatkowego logowania, pomiary P95, prawidłowe stany braków i odmów, oba rezultaty zmiany organizacji, weryfikacja odrzucenia starego kontekstu/cache i test revocation. `FINAL-05/09`. |
| **E2-T04** | Dwa konkretne przypadki konsumpcji przygotowanego Forecast w kategorii kosztowej/PCI i ACG. | SG Runtime + właściwi consumer owners; E1 wybiera entrypoint, test po gotowym T01. | Dwa rzeczywiste autoryzowane scenariusze, prawidłowe jednostki/okres, licencja/tenant i PIT, odmowy obcych organizacji; bez niezleconych zmian shared ACG. `FINAL-06/07/09`. |
| **E2-T05** | Pełna integracja i odbiór Development, monitoring, koszt, restart/recovery, rejestr finalnych dowodów. | SG Runtime + Forecast Operations + Owner SG2; po T01–T04. | Działający end-to-end Dev, wszystkie `FINAL-01–10` z rzeczywistymi dowodami; brak dodatkowego recenzenta tylko „dla pewności”; właściwe PR/SHA/CI/run, raport kosztu, niezamknięte braki i jednoznaczna decyzja Ownera o odbiorze. |

**DoD E2:** wszystkie `FINAL-01–10` mają status `ZAKOŃCZONY` i dowody z Development; rzeczywisty codzienny proces pracuje bez Codespace, a użytkownik korzysta z Findera bez dodatkowego potwierdzania tożsamości. Brak któregokolwiek obowiązującego kryterium oznacza `CZĘŚCIOWY` lub `ZABLOKOWANY`, nie fikcyjny sukces.

### 5.3. Autonomia, kolejność, prawa i STOP

**Zasada centralna:** `ONE STAGE → ONE EXPLICIT OWNER MANDATE → FULL AUTOPILOT FOR ALL AUTHORIZED TASKS → STAGE CLOSEOUT → STOP`. W tej Karcie są dwa etapy, zatem **dwa osobne mandaty etapowe**, niezależne od wcześniejszej akceptacji projektu. Owner nie autoryzuje każdej poprawki, commitu, testu, PR czy zwykłej decyzji technicznej.

- **Autonomia Codexa:** samodzielny preflight właściwego zakresu, implementacja, aktualizacja testów, usuwanie błędów, odtwarzanie testów, commit/push/PR, dozwolony merge, prawidłowy start Dev, kontrola jakości i końcowy handoff. Nie tworzyć nieprzewidzianych bramek „manual review”, „drugi recenzent” ani powtórnej zgody na uprzednio autoryzowaną operację. Gdy GitHub/kanon **rzeczywiście** wymaga review, nie obchodzić go ani nie tworzyć pozornych dowodów; blokuje się tylko odpowiedni zakres.
- **Zachowanie E1:** bez interaktywnego potwierdzania uprawnień podczas normalnej sesji użytkownika, ale bez wyłączenia obowiązkowej autoryzacji każdej chronionej operacji. Nie obejść licencji, tenant isolation ani cofnięcia uprawnień przez zaufanie do samego ekranu Findera.
- **Własność i zależności:** E1 może równolegle kwalifikować metadane i diagnozować runtime; E2 może równolegle rozwijać scheduler, Finder i adaptory, ale odbiór zależy od prawidłowych wyników Forecast. Nie rozpoczynać E2 przed nowym mandatem. Potrzeby współdzielonego ACG rozliczać odrębnie przez jego ownera, bez samowolnego zapisu w cudzym profilu.
- **Istotne STOP:** brak mandatu na aktywny etap; nowy przywilej, niedopuszczony Source/licencja lub koszt; niewłaściwy owner/path; niebezpieczne naruszenie LKG; obowiązująca chroniona bramka; niepewność danych. Zatrzymać konkretne operacje, kontynuować pozostałe dozwolone taski danego etapu i przedstawić **jedną skonsolidowaną decyzję**, zamiast serii mikropytań.
- **Czas i koszt:** rzeczywisty zakres, pokrycie PIT, czas delty i licencjonowane requesty mierzy E1. E2 używa tych dowodów i nie tworzy fikcyjnych terminów, nowej infrastruktury ani pustych review tylko w celu formalnej zgodności.
- **PMOS/PHR:** PDR pozostaje jednym rejestrem decyzji i przebiegu; prawdziwe dowody są linkowane do właściwych systemów, nie kopiowane do osobnych plików roadmapy.

### 5.4. Rejestr realizacji (w tej samej Karcie)

Statusy etapów i tasków: `NIE_ROZPOCZĘTY`, `W_TOKU`, `CZĘŚCIOWY`, `ZABLOKOWANY`, `ZAKOŃCZONY`.

| ID | Owner / miejsce | Status | Daty; taskId; PR/SHA/CI/run/test | Dowód rzeczywisty | Brak / następny krok |
| --- | --- | --- | --- | --- | --- |
| E1 | SG2 · Development | NIE_ROZPOCZĘTY | — | — | Brak zaakceptowanej Karty i mandatu E1 |
| E1-T01 | SG2 Platform + Forecast | NIE_ROZPOCZĘTY | — | — | Zweryfikować 11 ID i artefakty |
| E1-T02 | SG Runtime + Source + Forecast Ops | NIE_ROZPOCZĘTY | — | — | Sprawdzić Dev runtime, Clerk/E1 i entrypointy |
| E1-T03 | Forecast + Market Data | NIE_ROZPOCZĘTY | — | — | Dwa pilotażowe warianty |
| E1-T04 | SG Runtime + Dashboard | NIE_ROZPOCZĘTY | — | — | Działający UI i pomiary |
| E2 | SG2 · Development | NIE_ROZPOCZĘTY | — | — | Wymaga rozliczenia E1 i osobnego mandatu |
| E2-T01 | Forecast + Market Data | NIE_ROZPOCZĘTY | — | — | Pełna macierz i T0 |
| E2-T02 | Forecast Operations | NIE_ROZPOCZĘTY | — | — | Automatyczny cykl Dev |
| E2-T03 | SG Runtime + Dashboard | NIE_ROZPOCZĘTY | — | — | Prepared UI i płynna sesja |
| E2-T04 | SG Runtime + owners konsumentów | NIE_ROZPOCZĘTY | — | — | Dwa autoryzowane odczyty |
| E2-T05 | SG2 + Owner | NIE_ROZPOCZĘTY | — | — | Wszystkie FINAL i realny odbiór |

**Bieżący mandat:** `BRAK`. **Ostatnie rozliczenie etapu:** `N/D`. **Decyzja o starcie następnego etapu:** `BRAK`. Aktualizacje tego rejestru następują po formalnym zapisie PDR i legalnym uruchomieniu prac. Dowód `ZAKOŃCZONY` = realny wynik na odpowiednim SHA i Development, nie tylko PR/CI.

### 5.5. Końcowy scenariusz odbioru

Uprawniony użytkownik z aktywną sesją otwiera istniejący Benchmark Finder **w Development**. Bez powtórnych pytań Clerk/E1 przełącza się między dopuszczonymi seriami i modelami; widzi wcześniej przygotowane Current i historię Verification z prawidłowo oznaczoną proweniencją. **Przełączenie na inną organizację z aktualnym grantem skutkuje serwerową weryfikacją nowego kontekstu i poprawnym odczytem bez ponownego interaktywnego logowania; brak prawa do wybranej organizacji albo wygasła sesja skutkują odmową.** Stary kontekst i cache nie ujawniają danych między organizacjami. Odczyt wszystkich przyjętych wariantów/horyzontów ma status `READY` przez właściwą, serwerowo uprawnioną projekcję. W ścieżce wyboru nie uruchamia się fitting ani nowe pobranie Source. Zapisany Forecast jest realnie odczytywany przez działającą kategorię kosztową i adapter ACG w granicach uprawnień. **Po naturalnym przyroście rynkowym** trwały proces Dev aktualizuje wyniki automatycznie i bez duplikacji, **w dotrzymanym cut-off i terminie gotowości zatwierdzonym przy rozliczeniu E1**. `NO_OP` oznacza potwierdzony brak nowego lawful wejścia i celów do weryfikacji; brak oczekiwanej publikacji, odmowa lub błąd Source są raportowane osobno. Owner otrzymuje dowody `FINAL-01–10` i ocenia całość.

| Kryterium | Status | Evidence / decyzja |
| --- | --- | --- |
| FINAL-01 | OCZEKUJE NA ODBIÓR | — |
| FINAL-02 | OCZEKUJE NA ODBIÓR | — |
| FINAL-03 | OCZEKUJE NA ODBIÓR | — |
| FINAL-04 | OCZEKUJE NA ODBIÓR | — |
| FINAL-05 | OCZEKUJE NA ODBIÓR | — |
| FINAL-06 | OCZEKUJE NA ODBIÓR | — |
| FINAL-07 | OCZEKUJE NA ODBIÓR | — |
| FINAL-08 | OCZEKUJE NA ODBIÓR | — |
| FINAL-09 | OCZEKUJE NA ODBIÓR | — |
| FINAL-10 | OCZEKUJE NA ODBIÓR | — |

## 6. Decyzje, koszty i otwarte ryzyka

| ID | Temat | Status/decyzja Ownera i moment technicznej weryfikacji |
| --- | --- | --- |
| DEC-01 | Zakres środowiskowy | **USTALONE przez Ownera: DEVELOPMENT ONLY.** Nie rozszerzać ani listy tasków, ani odbioru poza Development. |
| DEC-02 | 11 biznesowych instrumentów i ich odpowiedniki | **Reguła:** nie zamieniać fixed na front ani giełdy bez jawnej decyzji. E1 uzyskuje metadane i wskazuje dokładne rozbieżności, a Owner rozstrzyga przed E2, jeśli dotyczą zakresu. |
| DEC-03 | Minimalne okno i pokrycie strict PIT | **DO DECYZJI OWNERA** dla docelowego DoD: określić wymaganą regułę albo warunkowy próg z jawną ścieżką rozstrzygnięcia po E1. Nie żądać historycznego dowodu przed wykonaniem E1. |
| DEC-04 | Dwa scenariusze konsumpcji | **DO AKCEPTACJI OWNERA:** jeden scenariusz kategorii kosztowej/PCI, jeden ACG. Techniczny entrypoint, owner, licencja i projekcja wynikają z E1. Niemożliwość w granicy SG2 wymaga jawnej decyzji przed E2. |
| DEC-05 | P95, cut-off, termin gotowości, koszty | **DO AKCEPTACJI OWNERA:** proponowane P95 ≤ 3 s i reprezentatywna próba ≥100, mierzenie od wyboru do renderu. **Przy rozliczeniu E1, na podstawie publikacji lawful i pomiarów, zatwierdzić mierzalny cut-off oraz termin gotowości wyników (w razie potrzeby per kalendarz/grupa serii) jako warunek E2 i FINAL-03.** Bez arbitralnej godziny przed E1. Faktyczne koszty cyklu i dalsze granice autoryzować według uprawnień. |
| DEC-06 | Legalność użycia i Source/vintages | W E1 zweryfikować realne licencje/granty na pobranie i pochodne dla obu odbiorców, publikację i przekazanie do AI. Nowy grant/zasób wymaga rzeczywistego upoważnienia właściwego właściciela. |
| DEC-07 | Brak tarcia i autonomia | **USTALONE co do celu Ownera:** zwykła praca w Finderze bez kolejnych interaktywnych potwierdzeń E1/Clerk; wykonanie etapów przez Codexa bez mikrozgód, dodatkowego human review i powtórzeń zgód, z zachowaniem realnych obowiązkowych autoryzacji. E1 mierzy obecny stan, E2 domyka i dowodzi. |

**Ryzyka:** błędna tożsamość serii może dać sprawnie działającą, ale nieprawidłową prognozę; niepełne vintages może uniemożliwić przyjęty standard PIT; okresowe weryfikacje mogą wymagać dodatkowego trwałego śladu ich faktycznej publikacji; wycofanie uprawnień nie może być przykryte cache; wspólne właścicielstwo ACG nie może być ominięte; pełny bootstrap może być kosztowny lub wejść w konflikt z równoległymi zmianami Forecast. Mitigacja: rzeczywista próba E1, wersjonowana macierz, wąskie rozszerzenia istniejących komponentów, zamknięcie istotnych rozbieżności przed E2, bez fikcyjnych statusów.

**Estymacja:** `DO_OSZACOWANIA` po E1. Wymagany pomiar faktycznego kosztu i czasu brakujących wariantów, wielkości historii, liczby licencjonowanych zapytań, czasu cyklu i pamięci, składowania w Neon, P50/P95 UI. Wskaźniki kosztowe nie uprawniają do tworzenia zasobów; jeśli brakuje budżetu, zatrzymać tylko odpowiednią operację, kontynuować prace niezależne.

## 7. Punkt wznowienia / zgodność z governance

To jest **centralna Karta Projektu BSDC 1.0**, zaakceptowana przez Ownera jako jedna baza projektu, roadmapy E1–E2, checklisty A–F, rejestru wykonania i `FINAL-01–10`. Zgodnie z [Launcherem BSDC v1.1](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/bsdc-launcher-v1.1.md) przy wznowieniu należy odczytać najnowszą rewizję tej samej Karty na GitHubie. **Nie tworzyć duplikatu.** Akceptacja i publikacja nie uruchamiają E1. Osobno `URUCHOM ETAP E1`; po jego rozliczeniu i decyzjach wskazanych dla E1 dopiero osobny mandat `URUCHOM ETAP E2`. E2 kończy się działającym, odebranym Development; inne środowiska nie są warunkiem odbioru. Przyjęta baza projektu i roadmapy nie zmienia się bez jawnej decyzji Ownera; rejestr wykonania i dowody aktualizuje się w tej samej Karcie.

**Status A–F:** A — projekt i decyzje metryczne; B — analiza reuse, fakty do weryfikacji E1; C — scenariusze i UX; D — routing i właściciele do preflight; E — kompletna roadmapa 2-etapowa z 9 taskami; F — projekt i roadmapa 1.0 zatwierdzone przez Ownera; wykonanie wymaga osobnego mandatu.

**Ostatnia decyzja:** Owner przyjął Kartę 1.0 w zakresie **wyłącznie Development**, łącznie z dwoma etapami, 9 zadaniami, 10 kryteriami FINAL oraz zasadą maksymalnej płynności użytkowania i wykonania. Podstawą jest uzgodniona v0.5 po Cross-Model Review. **Następny krok:** przegląd pozostających decyzji biznesowych i warunków E1, a następnie **osobna dyspozycja Ownera `URUCHOM ETAP E1`**. Bez działań wykonawczych przed mandatem; otwarte szczegóły wskazane w DEC-02–06 rozstrzygać we właściwych momentach roadmapy, nie traktować jako już dowiedzionych.

### Materiały normatywne

- [BSDC Canon v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md) — 29 kryteriów A–F i E6.
- [BSDC Launcher v1.1](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/bsdc-launcher-v1.1.md) — jedna wersjonowana Karta i osobne mandaty etapów.
- [Business Outcome Engineering v1.1](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/business-outcome-engineering-v1.1.md).
- [Universal Project Execution v1.2](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/profitia-universal-project-execution-v1.2.md).
- [Full Autopilot v2.0](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/full-autopilot-v2.md) — unikanie dodatkowych bramek i zbędnych Clerk/E1.
- [Operation Context & Access Contract](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-operation-context-and-access-contract.md) — serwerowe decyzje i fail-closed.
- [History alignment](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/FORECAST_HISTORICAL_DATA_ALIGNMENT_CONTRACT.md) — semantyka PIT i ochrony historii.
- [Aktywna topologia SG2](https://github.com/profitia/SG-dev/blob/main/Canon/registries/sg2-environment-topology-v1.json) — w tym projekcie użyta wyłącznie do identyfikacji Development.

---

**STATUS:** `CARD_1.0 / OWNER_APPROVED / PUBLISHED / DEVELOPMENT_ONLY / NO_EXECUTION_MANDATE`.