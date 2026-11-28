# KARTA PROJEKTU BSDC v1.1 — v0.4
## Procurement Insights — Analytical Composer 2.0 & Oil/Asphalt Market Outlook v1.0

> **STATUS: OWNER_APPROVED — dokładna rewizja v0.4 (28.11.2026).** Akceptacja właściciela obejmuje specyfikację Oil & Asphalt Market Outlook v1.0 w §3, zintegrowaną roadmapę E6 w §7 oraz FINAL-01–10. **E1: `NOT_STARTED / NOT_AUTHORIZED`.** DEC-04 pozostaje otwarta przed przyszłą płatną próbą LIVE. Akceptacja Karty i mandat jej publikacji obejmują zapis dokumentu według governance. Odrębna aktywacja kanonu normatywnego i wykonanie E1 podlegają osobnym uprawnieniom.
>
> **Zmiana v0.2 → v0.3:** uzgodnienie dwóch recenzji z 28.11.2026 — technicznej Codexa (`AMEND`) oraz niezależnej zgodności z `ARCH-DEV-RELEASE-OPT-20261121` (`COMPATIBLE WITH CONDITIONS`). Ustalono dodatnie dowody dla Market i Procurement Research, rzeczywiste minimum spot/front i 12M, jednoznaczny proces UI → job → prywatny PDF, semantykę stopy i matury, wersjonowanie wydania oraz izolację prac od pilota #1339. **Bez nowej architektury i bez dodatkowych etapów: jeden E1, pięć tasków.** Statusy operacyjne są migawką, do ponownej weryfikacji przed integracją.
>
> **Zmiana v0.3 → v0.4:** po końcowej recenzji Codexa `AMEND` przyjęto trzy punktowe korekty: zapis decyzji właściciela, ujednolicenie minimum spread/12M oraz jednoznaczny `T0` i warunek uruchomienia płatnej próby. **Jeden E1, pięć tasków i istniejąca architektura — bez zmian.**
>
> **Zasada uzgodnień:** mandat publikacji obejmuje zaakceptowaną Kartę i wymagane czynności governance. Wykonanie etapu, płatna próba i wydanie wymagają właściwych osobnych uprawnień.
>
> **Zasada metodologiczna:** najpierw hipotezy i pytania zakupowe, potem rzetelny test w świetle dowodów — **nigdy wybieranie danych, aby potwierdzić z góry założoną rekomendację**.

| Pole | Propozycja / stan |
| --- | --- |
| `projectKey` | `SG2` — prowadzący profil produktu; Insights Domain / Architecture Platform i SG Runtime w granicach aktualnego routingu |
| `initiativeId` | `BSDC-20261128-SG2-PI-ANALYTICAL-REPORT-V1` |
| Autor koncepcji | ChatGPT na podstawie uzgodnień biznesowych i feedbacku PORR. Końcowa recenzja techniczna Codexa: `ACCEPT`. |
| Rewizja | **v0.4 / 2026-11-28**; zastępuje lokalne drafty v0.1–v0.3, NIE zastępuje aktywnych kanonów |
| Owner biznesowy | Właściciel produktu Profitia; użytkownik docelowy: kupiec/menedżer zakupów, w pierwszej kolejności PORR |
| Środowisko celu | **SG2 Development ONLY**; bez Staging/Production, bez automatycznej publikacji raportu klientom |
| Centralna Karta | `Canon/proposals/bsdc/SG2/BSDC-20261128-SG2-PI-ANALYTICAL-REPORT-V1.md` |
| Metoda | [BSDC Canon v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md) · [Launcher v1.1](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/bsdc-launcher-v1.1.md) · BOE v1.1 · Universal Execution v1.2 · Full Autopilot v2.0 |
| Optymalizacja wydań | [ARCH-DEV-RELEASE-OPT-20261121](https://github.com/profitia/SG-dev/blob/main/Canon/proposals/bsdc/ARCHITECTURE/spendguru-development-release-optimization.md): użyć **tylko aktywnych i dopuszczonych** ułatwień, klasyfikacja R1–R4 i wpływ A/B/C |
| Status A–F | Rozwiązanie (§3) i zintegrowana roadmapa E6 (§7), dokładna rewizja v0.4: **`OWNER_APPROVED`**. Statusy 29 kryteriów w §8. Dowody LIVE pozostają do E1. |
| Mandat wykonawczy | **E1: `NOT_STARTED / NOT_AUTHORIZED`**. Uruchomienie wymaga osobnej dyspozycji właściciela. |

## 1. Potrzeba i zamierzony efekt biznesowy (A)

**Problem:** obecny raport Oil & Asphalt potrafi przytaczać wiarygodne dane, ale jego narracja jest zbyt zachowawcza, sztuczna, słabo syntetyzuje rozbieżne sygnały i proponuje działania niedopasowane do sposobu zakupu asfaltu przez PORR. Sam mocny model OpenAI API nie eliminuje tego problemu, jeżeli nie zna właściwego kontekstu, otrzymuje zbyt ubogi pakiet analityczny i jest rozliczany głównie z formalnej struktury odpowiedzi.

**Rezultat:** użytkownik w istniejącym Procurement Insights uruchamia generowanie i otrzymuje profesjonalny, konkretny, czytelny raport Oil & Asphalt, który automatycznie: diagnozuje rynek, wyjaśnia mechanizmy, pokazuje prognozy i scenariusze, rozróżnia pewność od hipotez, interpretuje front spot–futures oraz wspiera decyzję o terminie zabezpieczenia ceny asfaltu. Nie powinien potrzebować konwersacji z analitykiem, aby uzyskać podstawowe wnioski.

**Główne pytanie użytkownika:** „Czy obecne sygnały rynkowe przemawiają za zabezpieczeniem ceny asfaltu teraz, czy uzasadniają dalsze oczekiwanie — i jakie są koszty pomyłki?”. **Raport rynkowy** nie jest poleceniem zawarcia konkretnej transakcji bez bieżącej oferty, ekspozycji, harmonogramu i limitu ryzyka.

**Priorytety:** (1) rzeczywista jakość analityczna, (2) szybki czas dostarczenia, (3) minimalny koszt implementacji i użycia API, (4) ponowne wykorzystanie komponentów, (5) brak nieuprawnionego rozszerzenia źródeł i publikacji. Cel organizacyjny MVP: **1–2 dni wykonania od kompletnej zgody i dostępności zależności**; to target, nie gwarancja ani zgoda na omijanie bramek.

**Podział odpowiedzialności:** właściciel + ChatGPT zamrażają **logikę biznesową, ekonomiczną i kryteria odbioru**. Codex ma autonomię w doborze technologii, strukturze kodu, adapterach, testach i integracji, w granicach aktywnych kontraktów. Codex może zakwestionować założenia niepoprawne lub niewykonalne, ale **nie zmienia po cichu semantyki wyniku, wzorów, rekomendacji ani Business DoD**.

**Definicja jakości docelowej:** raport ma być samowystarczalny i porównywalny *użytecznością analityczną* do profesjonalnej analizy przygotowanej w rozmowie z ChatGPT znającym kontekst kupca. Nie obiecujemy identyczności każdej generacji; wymagamy konkretnej, mierzonej próby odbiorowej na rzeczywistych danych i znanej bazie porównawczej.

## 2. Zakres produktu i decyzje projektowe (B/C)

### 2.1. MUST — pierwsza wersja kompletna

1. **Nowy Oil & Asphalt Market Outlook Canon v1.0:** specjalistyczny standard zastępujący v0.5 po odrębnej akceptacji/publikacji; uniwersalny [Narrative & Editorial v1.0](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-procurement-insights-narrative-and-editorial-canon.md) pozostaje aktywny, bez przepisywania.
2. **Analytical Composer 2.0 / Buyer Context:** role i standard analityczny, zatwierdzona wiedza kategorii, bezpieczny profil zakupowy PORR, aktualne dowody i jawny **Analytical Brief** (tezy, uzasadniające i przeciwne fakty, mechanizm, wniosek, ryzyko, sygnał rewizji). Start od jednego wywołania modelu, bez ujawniania ukrytego toku rozumowania.
3. **Thematic Market Intelligence Search:** z góry ustalona biblioteka zapytań Brave o bieżący stan ropy i asfaltu; bazowo 8 tematycznych kwerend, do 7 dodatkowych zależnie od pokrycia i budżetu. Okno odkrywania wiadomości T0−7 dni, uczciwa kwalifikacja faktycznej daty publikacji.
4. **Procurement Context Enrichment:** drugi profil zapytań Brave, dotyczący **mechanizmów cenowych i realnej pracy kupca**, z szerszym oknem źródeł. Zweryfikowane ustalenia trafiają do oddzielnej warstwy kontekstu Composera i nie zastępują kanonu ani danych organizacji. Bez nowego crawlera, bazy wektorowej i dedykowanego agenta.
5. **Dane i prognozy:** reuse Source Hub, EIA, Macrobond / Market Data i dostępnego Forecast Core, a także legalnie dopuszczonych prognoz instytucjonalnych. Backend oblicza statystyki historyczne. Model nie wylicza sam cen, spreadów ani prognoz 12M.
6. **Spot–Futures Analytics:** mała deterministyczna, neutralna względem surowca funkcja. Dla zakwalifikowanego spot i front futures zwraca spread kwotowy/procentowy, kierunek relacji spot–front, maturę, annualizowany **implied net convenience yield** tylko przy poprawnym finansowaniu i danych. Definicja wzorów, edge cases i gotowe referencyjne testy w §3.4.
7. **Raport PDF:** 9 logicznych rozdziałów + 4 adekwatne aneksy (§3.2), naturalna polszczyzna, trzykolumnowe interpretacje „sygnał → mechanizm → wniosek kupca”, identyfikowalne źródła, brak pozornej pewności i niekwalifikowanych liczb. Reuse renderera.
8. **Quality Gate i odbiór:** kontrole struktury, liczb, dowodów, spójności tezy i kontrargumentów, terminów i buyer relevance; **realna generacja OpenAI API na SG2 Development wyłącznie po właściwym dopuszczeniu kosztu i Source**, PDF dostępny uprawnionej osobie, a następnie porównanie do wzorca jakości PORR. `AWAITING_REVIEW` pozostaje; **bez automatycznej publikacji klientom**.
9. **Pozytywne minimum Business DoD:** co najmniej jeden rzeczywiście kwalifikowany spread spot–futures na wybranym benchmarku, datowana perspektywa do 12 miesięcy z dopuszczonego źródła oraz po jednym materialnym, licencjonowanym ustaleniu z profili M i P wpływającym na argumentację raportu. Zastępstwo lub brak któregoś z tych dowodów oznacza jawny wynik `CZĘŚCIOWY` dla tego kryterium i wymaga właścicielskiego rozstrzygnięcia, nie fikcyjnego `PASS`. Net convenience yield pozostaje **warunkowy**, bez fałszywych liczb.
10. **Dostęp do wyniku:** istniejący widok Raporty musi obsługiwać zlecenie, historię jobów i **prywatne pobranie PDF w stanie `AWAITING_REVIEW`** po prawidłowej autoryzacji; brak automatycznej publikacji klientom.

**Ważne ograniczenie aktualnego kodu:** adapter `apps/insights-runtime/src/source-adapters.mjs` ogranicza `news-discovery` do **3 trwałych projekcji na zapytanie** i oznacza materiał `TITLE_ONLY`. Sama zmiana listy keywordów **nie daje modelowi pełnej treści artykułów**. E1 musi dobrać minimalną, legalną projekcję przydatnych fragmentów / potwierdzonych ustaleń *jeżeli prawa Source pozwalają*; jeśli nie, wynik pozostaje odkryciem źródła, a nie podstawą szczegółowego twierdzenia. Nie należy obiecywać bogatej analizy treści na podstawie samych tytułów.

### 2.2. SHOULD — tylko jeśli już dostępne bez istotnej rozbudowy

- Wykres kilku–kilkunastu tygodni zapasów EIA; **dodatkowe pośrednie punkty prognoz 3M i 6M**, o ile są rzeczywiście publikowane i kwalifikowane przez źródło (sama **datowana perspektywa do 12M jest MUST** zgodnie z §2.1 i FINAL-05); dodatkowa zmiana tygodniowa spreadu i convenience yield przy porównywalnej maturze; krótkie porównanie wcześniejszej prognozy do notowania rzeczywistego, jeśli historyczne snapshoty i matching są już potwierdzone.
- Odczyt gotowych prognoz 1M/3M/6M/12M Forecast Core, **tylko jeśli rzeczywiście gotowe dla uprawnionego profilu i zgodne z aktualnym targetem**; nie uruchamiać nowego treningu ani pracy nad oddzielną inicjatywą Precomputed Forecasts.

### 2.3. OUT OF SCOPE — bez cichego rozszerzania

- Nowy model matematyczny prognozowania ropy, przebudowa Forecast Core, pełna krzywa futures 12M, prognoza przyszłego convenience yield, procentowe prawdopodobieństwa scenariuszy bez kalibracji, real-time hedge optimizer, automatyczne składanie zleceń, dashboard od zera, nowy worker/serwis infrastrukturalny, agent researchowy, nowy silnik Brave, baza wektorowa/RAG, nieautoryzowane nowe źródła lub licencje, Staging/Production, zmiany Identity/E1/tenant i pełna automatyczna publikacja raportu klientowi.
- Niezwiązany redesign UI, masowy refactoring, przebudowa PMOS/PHR, modyfikacja chronionego workflow tylko dla skrócenia procesu.

### 2.4. Reguła priorytetu

**Najpierw kompletna merytorycznie generacja na istniejącym, legalnym pakiecie danych; potem opcjonalne nowe wskaźniki.** Brak kwalifikowanej pary spot/futures, wiarygodnego źródła lub zewnętrznej prognozy nie uprawnia do fikcyjnego wyniku. Brak twardych danych w źródle Brave nie uprawnia do dopisywania wiedzy z wyobraźni. Jeśli luka realnie uniemożliwia Business DoD, zgłosić bloker do decyzji właściciela, nie usuwać po cichu kryterium.

**Bez potwierdzania założonej tezy:** dane rynkowe nie są ozdobnikami uzasadniającymi wcześniejszą rekomendację. Research ma wyszukać także informacje przeciwne, a wniosek ma zostać ustalony *po* ich ocenie. Stały profil wiedzy kieruje pytaniami i metodą interpretacji, nie dyktuje wyniku rynku.

### 2.5. Trzy zasady interpretacji odbioru po recenzji Codexa

1. **Brak dowodu to nie sukces:** technicznie prawidłowe `N/A` dla yield nie może zastąpić całego rzeczywistego przykładu spot/front; pojedynczy news `TITLE_ONLY` nie dowodzi dynamicznego wzbogacenia treścią; sama obecność zaprojektowanej prognozy nie oznacza wiarygodnej perspektywy 12M.
2. **Brak uprawnionego źródła nie zezwala na obejście:** przy braku licencji, maturowalnego kontraktu lub wiarygodnego snapshotu można ukończyć niezależny kod i testy, ale oznaczyć nieodebrany element Business DoD jako `CZĘŚCIOWY`. Zmiana minimalnego standardu wymaga jawnej decyzji właściciela.
3. **Wdrożenie oznacza rzeczywisty odbiór użytkownika:** `PUBLISHED` oraz `AWAITING_REVIEW` to różne uprawnienia i ścieżki pobierania. Dla MVP wymagamy prywatnego odbioru, nie publicznej dystrybucji.

## 3. PROJEKT KANONU ROZWIĄZANIA v0.1 — Oil & Asphalt Market Outlook v1.0

**Status:** `OWNER_APPROVED` jako specyfikacja rozwiązania w dokładnej Karcie v0.4. Docelowe zastąpienie obejmuje wyłącznie specjalistyczny [Oil & Asphalt v0.5](https://github.com/profitia/SG-dev/blob/main/Canon/v0.5-procurement-oil-insight-report-canon.md) z zachowaniem historycznego dokumentu i jego dowodów. Uniwersalny Narrative & Editorial v1.0 obowiązuje nadal. Odrębny aktywny plik normatywny i wpis do manifestu wymagają właściwego dopuszczenia.

### 3.1. Zasady narracji, dowodów i wnioskowania

- **Buyer first:** pierwsza strona odpowiada „co się zmieniło, dlaczego, co z tego wynika i co robić z decyzją hedge”; jasna teza wyprzedza opis źródeł.
- **Synteza, nie kompilacja:** fakt → mechanizm → rynek ropy/asfaltu → wniosek dla kupca → ryzyko błędu → sygnał rewizji. Silne dowody i kontrargumenty mają wpływać na wybór tezy, a nie tylko na liczbę cytatów.
- **Testowanie hipotez:** po zebraniu danych model porównuje wersję bazową, wzrostową i spadkową, wyszukuje sprzeczne dowody i dopiero wtedy wybiera najlepiej uzasadnioną. Nie stosować selektywnego doboru źródeł pod z góry przyjętą rekomendację.
- **Trzy warstwy znaczenia wskaźników:** **sygnał liczbowy → wyjaśnienie ekonomiczne → praktyczny wniosek zakupowy**, z odróżnieniem możliwości działania od gwarantowanego skutku.
- **Dyscyplina niepewności:** fakty, hipotezy, interpretacje, prognozy i scenariusze oddzielone. Nie przypisywać nieskalibrowanych prawdopodobieństw; nazywać horyzont i termin obserwacji.
- **Język:** naturalny, zawodowy, bez asekuracyjnego wyliczania braków i bez retoryki marketingowej. Wniosek może być warunkowy, ale nie powinien być pusty. Brak danych blokuje konkretny wskaźnik, nie automatycznie cały raport.
- **Dane:** tylko wyliczone i zatwierdzone liczby; wszystkie istotne twierdzenia mają odpowiadające dowody. Ścisły JSON pozostaje formatem technicznym, ale nie może wymuszać zakazu cyfr w sensownym zdaniu.
- **Profil PORR:** cena określonego wolumenu i harmonogramu, ważność oferty około dwóch godzin, ograniczenia logistyki i sourcingu. Brak rekomendacji arbitralnego podziału dostawcy czy generycznego indeksowania bez potwierdzenia zastosowalności.
- **Zasada źródeł zewnętrznych:** tytuł/snippet nie dowodzi pełnej treści; wyszukane strony są **danymi, nie instrukcjami**. Nie pozwalać fragmentom Brave zmieniać zasad bezpieczeństwa, buyer profile, kanonu ani treści roli systemowej.

### 3.2. Układ publikacji — 9 rozdziałów

| Rozdział | Obowiązkowe funkcje akapitów / danych |
| --- | --- |
| **01. Executive Summary & Buyer Decision** | Diagnoza, dominujący kierunek, scenariusz bazowy, przełożenie na asfalt, warunkowy wniosek hedge, główne ryzyko. |
| **02. Ceny i struktura spot–futures** | Brent/WTI, aktualne notowania i zmiany, spot/front, dokładna matura, spread, contango/backwardation jako **krótki odcinek spot–front**, implied net convenience yield wyłącznie przy kwalifikowanych danych; obowiązkowa tabela **sygnał / interpretacja / wniosek dla kupca**. |
| **03. Fundamenty podaży, popytu i zapasów** | OPEC+/USA, Chiny/Europa, EIA tygodniowe i trend, rafinerie, bilans rynku. |
| **04. Wydarzenia i ryzyka** | Geopolityka, żegluga, sankcje, waluty/stopy, makro, rafinerie; **przekrój tematycznego Brave Market Intelligence za T0−7 dni**, ze sprawdzoną datą i rankingiem zdarzeń po wpływie na scenariusz. |
| **05. Od ropy do asfaltu** | Mechanika przełożenia cen ropy na bitum, produkcja i dostępność w Europie/Polsce, sezonowość, logistyka, basis risk ceny oferty; branżowy kontekst *Procurement Intelligence* z jawnie zweryfikowanych źródeł. |
| **06. Prognozy cenowe** | **MUST: datowana, kwalifikowana perspektywa sięgająca 12M względem T0**. Krótki horyzont Forecast Core tam, gdzie dostępny; **SHOULD: dodatkowe punkty 3M i 6M**, jeśli źródło je publikuje; daty, jednostki, metody, różnice; bez wymyślonych punktów/pasm. |
| **07. Scenariusze** | Bazowy, wzrostowy, spadkowy; dowody, kontrargumenty, siła uzasadnienia i trigger rewizji. |
| **08. Decyzja hedge** | Zalety/ryzyka zabezpieczenia teraz, poczekania lub częściowego zabezpieczenia; wnioski z trendu, prognoz, spot–front, convenience yield **i rzeczywistych ograniczeń kupca**; brak bezwarunkowej porady bez danych oferty. |
| **09. Monitoring i kalendarz** | Co zmieniło się od poprzedniego wydania, przydatne daty EIA/IEA/OPEC/CFTC, warunki weryfikacji scenariusza i powrotu do decyzji. |

**Aneks A:** źródła, daty, provenance; **B:** jakość modeli (MAE, trafność kierunku, liczebności, ograniczenia); **C:** metodologia instrumentów, spot/futures/spread/convenience yield; **D:** brakujące dane, zakres i ograniczenia. Sekcje mogą być krótsze/scalane wizualnie, ale nie mogą znikać kluczowe funkcje merytoryczne; żadnego sztucznego „wypełniania” braków.

**Reguła horyzontu 12M (MUST):** w rozdziale prognoz nie wolno przedstawiać bieżącej krzywej futures jako prognozy przyszłego spot. Minimum to **datowane, wiarygodne i prawnie dopuszczone źródło perspektywy cen ropy sięgającej horyzontu 12M względem T0**, np. istniejący zaakceptowany snapshot EIA STEO lub inny dopuszczony forecast instytucjonalny. Dla źródła miesięcznego kwalifikuje się rzeczywisty **okres obejmujący miesiąc docelowy T0 + 12 miesięcy** (z jawnym opisem, że jest to np. średnia w tym miesiącu, a nie punktowa prognoza ceny w konkretnym dniu). Oznaczyć datę wydania, wartość referencyjną, instrument, walutę, jednostkę, rodzaj prognozowanej wartości, miesiąc/okres docelowy i horyzont. Punkty 3M i 6M są **SHOULD** tylko gdy źródło je rzeczywiście publikuje; nie interpolować ani nie wymyślać miesięcy. Brak snapshotu z prawem do wykorzystania w modelu → `TWELVE_MONTH_OUTLOOK_NOT_AVAILABLE`, odbiór FINAL-05 częściowy; nie uruchamiać przez to osobnego Forecast Core ani nie otwierać niedopuszczonego `external-forecasts`.

### 3.3. Context Layer, Procurement Intelligence i schemat syntezy

**Cel:** sprawić, żeby API OpenAI otrzymywało nie tylko liczby i linki, lecz również **właściwe pytanie zakupowe, zatwierdzoną wiedzę branżową i sprawdzone aktualne argumenty**. Kontekst formowany per raport / per organizacja, nie przez kolejną rozmowę człowieka z modelem.

| Warstwa | Zawartość | Status autorytetu i odświeżanie |
| --- | --- | --- |
| **L1. Analytical & Editorial Policy** | Rola analityka, hierarchizacja dowodów, scenariusze, styl, antyhalucynacje i kontrola jakości | Zatwierdzony uniwersalny kanon; instrukcje wersjonowane, **nigdy edytowane przez Brave** |
| **L2. Category Knowledge — Oil & Asphalt** | Mechanizmy ropa→rafinerie→bitum, seasonality, bazy cenowe, ryzyka i strukturę terminową | Zatwierdzony kanon kategorii; dynamiczne źródła mogą **uzupełnić**, nie przejąć jego władzy |
| **L3. Buyer Context — PORR** | Pytanie hedge, harmonogram/ilość, ważność ofert, logistyka, dostępny sposób kontraktowania, ryzyko | Pochodzi z uprawnionych danych klienta lub jawnie zatwierdzonego profilu; tenant-safe; **brak tekstów PORR w publicznym shared context** |
| **L4. Procurement Context Enrichment** | Zewnętrznie potwierdzone mechanizmy kategorii, praktyki zakupowe i ryzyka (np. basis risk, transport, formuły indeksacji) | Dłuższe okno researchu; niższy autorytet niż L1–L3, z referencjami, bez trwałej redystrybucji bez licencji |
| **L5. Market Intelligence & Metrics** | Zmiany 7D, EIA, OPEC, IEA, Macrobond, Futures/Spot, prognozy, świeże wydarzenia | Bieżący `asOf`, oddzielne czas i dane historyczne; jedynie potwierdzone liczby, daty, źródła |

**Proponowany logiczny kontrakt `ReportGenerationContext` (do zmapowania na istniejące struktury, nie nakaz wprowadzenia nowego publicznego API):**

```text
contextVersion / categoryProfileVersion / editorialProfileVersion
buyerContextRef + authorisedBuyerFacts (organisation-scoped)
marketEvidenceRefs + calculatedMetrics + qualifiedForecasts
marketResearch: [{questionId, evidenceRefs, publishedAtStatus, relevance, supportingOrContradicting}]
procurementResearch: [{questionId, verifiedFinding, evidenceRefs, materialDepth, validity}]
dataAsOf / knowledgeCutoff / sourceCoverage / limitations
```

**Analytical Brief** w tym samym wywołaniu modelu (preferowana minimalna wersja):

```text
marketDiagnosis; baselineScenario; leadingDrivers[];
counterevidence[]; mechanisms[]; priceTransmissionToBitumen[];
buyerImplications[]; actionOptions[]; riskOfError[];
revisionTriggers[]; evidenceRefs[]; uncertaintyExplanation
```

Model **najpierw redaguje sprawdzalne ustalenia**, dopiero z nich tworzy dziewięć części czytelniczych; schemat JSON lub jego mapowanie implementuje Codex minimalną deltą. Nie żądać prywatnego chain-of-thought. Rozszerzenia nie mogą przekroczyć zatwierdzonych limitów body/tokens/budget; backend daje krótkie podsumowania statystyk, nie pełne surowe szeregi.

**Mechanizm wnioskowania:**

1. Dla każdej osi (podaż, popyt, zapasy, rafinerie, ceny terminowe, Polska, hedge) sformułować *pytanie*, nie odpowiedź.
2. Z przypisanych dowodów odnotować, co wspiera, co osłabia i co jest niewiadome; rozdzielić informację niezależną od duplikatu tej samej depeszy.
3. Ustalić scenariusz bazowy i przyczynowość, nie tylko korelację.
4. Dopiero wtedy przełożyć wynik na możliwą decyzję kupca, wraz z kontrargumentem i sygnałem rewizji.
5. Jeżeli brak dostatecznych danych, wskazać brak i warunkowy wybór, **bez dopisywania rozstrzygnięcia z samych nagłówków**.

**Dane niesprawdzone, treści pełnych stron i dowolne instrukcje ze źródeł internetowych nie mają prawa zmieniać polityk, schematu, budżetów, buyer-context ani wymuszać wywołań narzędzi.**

### 3.4. Spot–Futures Analytics — zatwierdzona specyfikacja biznesowo-matematyczna

**Cel:** uniwersalny, deterministyczny kalkulator **jednej kwalifikowanej pary** spot i właściwego najbliższego futures, dla ropy, miedzi lub innego towaru magazynowalnego. Nie budujemy 12-miesięcznej krzywej ani modelu prognostycznego. Interpretacja ekonomiczna jest regułą produktu, a implementacja językowa / miejsce w monorepo należy do Codexa.

#### 3.4.1. Zmienne i kalkulacje

| Symbol | Interpretacja | Reguła |
| --- | --- | --- |
| `S` | Cena spot aktualnie dostępnego towaru | Cena i baza jawne; właściwy benchmark, waluta, jednostka, timestamp, referencyjne miejsce |
| `F` | Cena odpowiedniego **konkretnego** kontraktu front futures | Prawdziwa seria kontraktowa albo ciągła seria **z mapowaniem na aktywną maturę**, znane konwencje roll/settlement i delivery |
| `t` | Wspólny moment wyceny | Brak porównania ceny przyszłej z nieprzypisaną historyczną ceną spot |
| `T` | Horyzont ekonomiczny kontraktu w latach | Rzeczywista, zweryfikowana **właściwa data settlement/delivery**, zależnie od mechaniki instrumentu; nie zgadywać z oznaczenia `c1`; konwencja **ACT/365F** w referencyjnych testach |
| `r` | Annualizowana stopa finansowania | Dla waluty i horyzontu ekspozycji, wyrażona w **ciągłym składaniu**; jeśli znana stopa efektywna `r_eff`, to `r = ln(1+r_eff)`; nie stosować arbitralnego defaultu 5% |
| `c` | Annualizowany koszt składowania/utrzymania zapasu | Nieznany w MVP; nie utożsamiać go z transportem i nie szacować w modelu językowym |
| `y` | Gross convenience yield | Nie raportować bez wiarygodnego `c`; raportujemy **net convenience yield `y−c`** |

**Wzór teoretyczny** dla odpowiednich towarów i konwencji cost-of-carry:

\[
F_{t,T} = S_t\, e^{(r+c-y)T}
\]

**Obliczenia backendu:**

\[
\Delta_{\mathrm{abs}} = F-S,\qquad
\Delta_{\mathrm{pct}} = 100\left(\frac{F}{S}-1\right),\qquad
q = \frac{\ln(F/S)}{T}
\]

\[
\boxed{y-c = r-q = r-\frac{\ln(F/S)}{T}}
\]

`Δpct` jest wynikiem liczbowym **wyrażonym w procentach** (np. `2,5` oznacza `2,5%`); `r`, `y-c` i `q` w powyższych wzorach są stopami rocznymi jako ułamki (np. `0,05` = `5%` rocznie).

`netConvenienceYieldPctAnnual = 100 * (y-c)`. Nie odejmować magazynowania po raz drugi; w wyniku API wskazać jawnie skale procentów i stóp. `Δabs` w walucie/jednostce, `Δpct` tylko jeśli `S ≠ 0`. Wskaźnik logarytmiczny/yield tylko przy `S>0`, `F>0`, `T>0` i poprawnym finansowaniu. Historycznie dopuszczalne ujemne notowania futures nie mogą być arbitralnie usuwane jako „błąd”; mogą dawać spread absolutny i status `YIELD_NOT_COMPUTABLE`, bez logarytmu.

**Klasyfikacja krótkiej relacji spot–front:** `F>S`: **CONTANGO_LIKE / futures premium**; `F<S`: **BACKWARDATION_LIKE / futures discount**; `F=S`: `FLAT`. Do czytelnika można użyć słów *contango / backwardation*, ale zawsze z doprecyzowaniem: **„w relacji spot–najbliższy futures”**, a nie twierdzeniem o całej krzywej futures. W klasycznej definicji kształt krzywej opisuje również spready między **różnymi maturami futures**. Żadnej nieudokumentowanej klasyfikacji całej 12M krzywej z jednego punktu.

#### 3.4.2. Twarde reguły kwalifikacji i braków

- **Parzystość ekonomiczna:** underlying, grade, punkt dostawy / basis, jednostka, waluta, notowanie (spot vs futures settlement) i timestamp muszą być porównywalne. Ekonomiczna różnica basis może czynić wynik nieinterpretowalnym — nie usuwać jej automatycznie mnożnikiem walutowym.
- **Synchronizacja cen:** wyceny w uzgodnionym `asOf` / tej samej porównywalnej sesji i znanych regułach cut-off. Tolerancja staleness to jawna polityka kategorii, nie dowolne `nearest()`. Brak porównania danych przy niedopasowaniu dni/sesji.
- **Matura:** rozróżnić `lastTradingDate` (koniec handlu), **datę/okres ekonomicznej dostawy bądź rozliczenia** właściwy dla wycenianego kontraktu oraz `rollDate` (zmiana składnika serii ciągłej). Do `T` przyjmować **udokumentowany, ekonomicznie porównywalny termin** z uzasadnieniem. Nie podstawiać automatycznie ostatniego dnia handlu za punkt realizacji ekspozycji. `T ≤ 0` nie reprezentuje przyszłej matury. ICE Brent i NYMEX WTI mają różne warunki rozliczenia/dostawy; nie uniwersalizować ich terminów. Kody `b_c1_cl`, `cl_c1_cl` są **kandydatami** serii ciągłej, a nie potwierdzonymi kontraktami grudniowymi/styczniowymi. Historyczny punkt po rollover wymaga historycznej identyfikacji aktywnego kontraktu w danej sesji.
- **Blisko wygaśnięcia:** dla annualizacji MVP stosować zatwierdzony w **DEC-02** próg co najmniej **14 dni kalendarzowych** do właściwej matury (`13` dni → `NEAR_EXPIRY`, `14` dni → uprawnienie do kalkulacji, o ile wszystkie pozostałe warunki spełnione). Przy krótszym terminie można wybrać kolejny zweryfikowany płynny kontrakt *zamiast* front, nadal tylko **jedną** parę spot–futures; jeśli nie ma takiego kontraktu, `NEAR_EXPIRY` i brak annualized yield. Sam spread można pokazać przy poprawnej porównywalności, z adnotacją.
- **Stopa finansowania:** wymagane `r` pochodzące z legalnego, datowanego źródła i właściwej konwencji/currency/tenoru. Jeśli źródło podaje roczną stopę efektywną, `r_cont = ln(1+r_eff)` dla prawidłowego `r_eff`. Jeśli podaje stopę prostą money-market, **najpierw** wyznaczyć rzeczywisty czynnik wzrostu `A = 1 + i·days/basis` według udokumentowanej konwencji źródła, następnie `r_cont = ln(A)/T` z `T` według przyjętego ACT/365F; wymaga `A>0`. Dla źródła złożonego według innej konwencji użyć jego rzeczywistego czynnika akumulacji. Nie mylić stopy procentowej w % ze współczynnikiem ułamkowym; w dowodzie zapisać bazę day-count i `fundingSource`. **Brak stopy → spread/structure dostępne, yield `FUNDING_MISSING`; nigdy `r=0` w milczeniu.**
- **Walidacja metadanych:** kody spot Brent `wocaes0074`, WTI `uscaes0301`, futures ICE Brent `b_c1_cl` i WTI `cl_c1_cl` to wyłącznie **kandydaci do kwalifikacji przez actual provider metadata**. Nie tworzyć nowego entitlements dla celów tej Karty.
- **Przedziały czasowe:** `asOf` raportu, data pobrania, `observationAt` i `maturityDate` to różne pola. Nie mieszać ostatniego dostępnego settlement z rzekomym „live dziś”.
- **Nieporównywalne futures/spot:** jeśli znana jest tylko zbieżna nazwa, ale brak kwalifikacji instrumentów, nie publikować fałszywego yield. Zwrócić status i powód, a raport może działać bez tego wskaźnika.

**Minimalne statusy kalkulacji** (Codex może nazwać je zgodnie z istniejącym kontraktem, bez zmiany znaczenia): `AVAILABLE`, `NOT_COMPARABLE`, `STALE`, `MATURITY_UNKNOWN`, `FUNDING_MISSING`, `NEAR_EXPIRY`, `YIELD_NOT_COMPUTABLE`, `SOURCE_NOT_ADMITTED`. Obsługa oddzielnego statusu spreadu i yield, bo nie każde ograniczenie yield unieważnia sam spread.

**Oczekiwany wynik logiczny:** `spot/future identifiers`, `dataAsOf`, `maturityBasis`, `maturityDate`, `T`, `currency/unit`, `spotValue`, `futureValue`, `spreadAbsolute`, `spreadPct`, `structureLabel`, `rateSource/rateConvention`, `netConvenienceYieldPctAnnual?`, `statusReason`, `evidenceRefs[]`, `methodVersion`. Brak automatycznej zmiany metodologii w kodzie.

#### 3.4.3. Interpretacja — trzy poziomy dla kupca

| Sygnał | Co mówi o rynku? | **Co powinien z tego rozumieć kupiec?** |
| --- | --- | --- |
| **Contango (spot–front: F>S)** | Futures na wskazany termin jest dziś **droższy** niż spot; może odzwierciedlać koszty finansowania, magazynowania i mniejszą premię za natychmiastową dostępność | Sama premia futures **nie uzasadnia odkładania zabezpieczenia ceny** — przyszła cena kontraktowa jest dziś wyższa niż spot. Przy prognozach wzrostowych warto rozważyć wcześniejsze ustalenie ceny; to nie jest automatyczny sygnał „kup” |
| **Backwardation (spot–front: F<S)** | Futures na wskazany termin jest dziś **tańszy** niż spot; bieżąca dostępność może być szczególnie cenna | Rynek wycenia kontrakt na późniejszy termin taniej niż bieżący spot. **W połączeniu z niezależnymi prognozami spadkowymi, rosnącymi zapasami i malejącymi napięciami** może to wzmacniać argument za odroczeniem decyzji o cenie hedge dla przyszłych dostaw; przy niedoborach fizycznych argument może być przeciwny |
| **Wysoki implied net convenience yield** | Duża implikowana wartość posiadania fizycznego surowca teraz, po uwzględnieniu stopy finansowania i netto wobec storage | Zwiększa wagę ryzyka natychmiastowej dostępności; zweryfikować zapasy i realne dostawy, zanim kupiec zdecyduje czekać |
| **Rosnący net convenience yield** | Jeśli pomiary są porównywalne metodologicznie i co do matury, może sygnalizować napięcia bieżącego rynku fizycznego | Ponownie ocenić ekspozycję na brak towaru i ryzyko opóźnienia hedge; sam kierunek yield nie wyznacza przyszłej ceny |
| **Malejący net convenience yield** | Przy porównywalnych odczytach może oznaczać łagodzenie presji na natychmiastowy dostęp | Z trendem spadkowym i potwierdzonymi prognozami może **zwiększać zasadność oczekiwania** z ustaleniem ceny, jeśli harmonogram i tolerancja ryzyka pozwalają |
| **Brak prawidłowego wskaźnika** | Dane nieporównywalne, brak matury/funding lub za krótki termin | **Nie wolno** zastępować wskaźnika przypuszczeniem; decyzję oprzeć na niezależnie dostępnych zapasach, prognozach, zdarzeniach i kontekście dostaw |

**Obowiązkowa zasada:** *futures na dany termin* to cena kontraktu **obserwowana dzisiaj**, a **nie** gwarancja ceny spot w przyszłości ani cena fizycznej dostawy asfaltu dla PORR. `net convenience yield` nie jest kosztem transportu, nie jest prognozą zapasów, a połączenie ze spreadem nie wystarcza do bezwarunkowego polecenia kupna / zwlekania.

**Instrukcja do Composera:** liczby i kwalifikacje z backendu → opis mechanizmu → potwierdzenie/kontrargument ze stanem rynku (EIA, podaży, rafinerii, forecast) → **przełożenie na realną decyzję kupca**. Jeżeli dane sobie przeczą, wyjaśnić konflikt, zamiast go pomijać.

#### 3.4.4. Referencyjne testy matematyczne (źródło prawdy dla implementacji)

Wszystkie liczby **syntetyczne**, nie przedstawiają realnych notowań. Wartości `T=0,25` są zadane wprost, niezależnie od przeliczenia konkretnej liczby dni; `r=0,05` jest roczną **stopą ciągłą**. Tolerancja liczbowa: `1e-6` dla spreadu w jednostce i `1e-4` punktu procentowego dla wyników procentowych po zaokrągleniu testowym. Do PDF można zaokrąglać prezentację, ale przechowywać wynik wyliczony precyzyjnie.

| Test | S | F | T | r | Spread | Spread % | Net CY % p.a. | Klasa / oczekiwane zachowanie |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| REF-01 | 80 | 78 | 0,25 | 0,05 | −2 | −2,500000% | **15,127123%** | BACKWARDATION_LIKE |
| REF-02 | 80 | 82 | 0,25 | 0,05 | +2 | +2,500000% | **−4,877045%** | CONTANGO_LIKE; ujemny net yield matematycznie dopuszczalny |
| REF-03 | 80 | 80 | 0,25 | 0,05 | 0 | 0% | **5,000000%** | FLAT; przy F=S yield netto to `r`, nie zero |
| REF-04 | 80 | 78 | 0,25 | **brak** | −2 | −2,5% | **N/A** | Spread możliwy; `FUNDING_MISSING` dla yield |
| REF-05 | 80 | 78 | **10 dni** | 0,05 | −2 | −2,5% | **N/A** | `NEAR_EXPIRY` przy proponowanej granicy 14 dni, annualizacja wyłączona |
| REF-06 | 80 | 78 | **matura nieznana** | 0,05 | −2 | −2,5% | **N/A** | `MATURITY_UNKNOWN`; nie wywnioskować daty z `c1` |
| REF-07 | 80 | **−2** | 0,25 | 0,05 | −82 | −102,5% | **N/A** | Ujemny futures wymaga kwalifikacji; log/yield niedostępne, nie kasować historycznej obserwacji |
| REF-08 | 80 | 78 | 0,25 | 0,05 | **N/A** | **N/A** | **N/A** | Inna baza/kwalifikacja → `NOT_COMPARABLE` |

Dodatkowe testy: `r_eff → r_cont = ln(1+r_eff)`; money-market `r_cont=ln(1+i·days/basis)/(days/365)` przy jawnej konwencji; test **13/14 dni**; `T = days/365` wg ACT/365F; zerowe `S` (spread kwotowy może być, procent nie); brak dostawy/rollover; brak jednego źródła; odczyt historyczny vs `asOf`; stale quote; różne waluty/jednostki; różny underlying; konsekwentna jednostka procentowa; brak przypadkowego wykorzystania ujemnego futures do `ln`.

**Odbiór ekonomiczny:** implementacja musi przejść referencyjne testy i na potrzeby raportu pokazać trzykolumnową interpretację. Gdy nie ma kwalifikowanej rzeczywistej pary i stopy, `N/A` jest poprawnym wynikiem matematycznym, ale raport nie może przedstawiać go jako obliczonego wskaźnika. Nie zmieniać REF bez decyzji merytorycznej właściciela.

### 3.5. Thematic Market Intelligence — profil wyszukiwania Brave

**Cel:** regularne identyfikowanie faktycznie nowych zdarzeń i raportów rynkowych, z których Composer wyciąga argumenty ekonomiczne. Nie używać jednego ogólnego `oil bitumen refinery supply OPEC demand` jako pełnej strategii. Zapytania podzielone na tematy, a nie uruchamiane jako jedno masywne wyrażenie `OR`.

**Domyślny profil wejścia do istniejącego Source Hub:** `provider: brave`, `family: news-discovery`, `operation: search`, `resultType: web`, `freshness: pw`, `count: 10` (do dopuszczonego limitu), `extraSnippets: true` jeżeli dostępne i dopuszczone, `language: en`, `country: ALL`; wariant polski `language: pl`, `country: PL`. `resultType: news` tylko jeśli konkretny klaster jest rzeczywiście dopuszczony przez providera (nie założyć entitlement). Obecny adapter Brave `count` i `offset` obsługuje dla `web`, a dla `news` ich nie przyjmuje.

**8 zapytań podstawowych (MUST jako biblioteka; liczba realnie wykonanych requestów podlega budżetowi/kwalifikacji):**

| ID | Cel | `criteria.text` |
| --- | --- | --- |
| M01 | Stan cen ropy i outlook | `crude oil market outlook Brent WTI` |
| M02 | Globalny bilans | `oil supply demand balance IEA EIA outlook` |
| M03 | OPEC+ | `OPEC+ oil production output cuts quotas` |
| M04 | Zapasy / wykorzystanie rafinerii | `EIA crude oil inventories refinery utilization` |
| M05 | Spready i bieżąca struktura | `Brent futures backwardation contango time spreads` |
| M06 | Rafinerie europejskie | `Europe refinery maintenance shutdown bitumen supply` |
| M07 | Bitumen Europa | `European bitumen market prices supply` |
| M08 | Asfalt Polska | `asfalt drogowy ceny podaż rafinerie Polska` (PL) |

**7 dodatkowych (uruchamiane tylko przy realnej luce w pokryciu lub ważnym sygnale):**

| ID | Cel | `criteria.text` |
| --- | --- | --- |
| M09 | Fizyczny Brent | `North Sea Brent physical crude differentials` |
| M10 | Ciężkie frakcje / bitumen | `heavy crude refinery residue bitumen production` |
| M11 | Geopolityka / logistyka | `crude oil supply disruption sanctions shipping routes` |
| M12 | Popyt Chin | `China oil demand refinery throughput imports` |
| M13 | Marże rafineryjne | `European diesel crack spreads refinery margins` |
| M14 | Popyt lokalny | `budownictwo drogowe zapotrzebowanie asfalt sezon Polska` (PL) |
| M15 | Nowe prognozy | `EIA IEA Brent crude oil price forecast outlook` |

**T0 = niezmienne `job.command.asOf` nadane przez serwer przy przyjęciu jednorazowego zamówienia; patrz §3.7 i §6. Okno `[T0−7 dni, T0]` jest wymogiem dla zdarzeń tygodnia, nie dla każdej wiedzy ekonomicznej.** `freshness: pw` to filtr odkrywania, a NIE dowód daty publikacji: Brave zwraca `age/page_age`, które mogą oznaczać datę publikacji **albo modyfikacji**; adapter świadomie ustawia `publishedAt: null`. Jeżeli wymagamy ścisłej daty publikacji, kwalifikujemy ją z wiarygodnej metadanej źródłowej albo z dopuszczonego NewsAPI `publishedAfter/publishedBefore`; w przeciwnym razie `PUBLICATION_DATE_UNKNOWN`, artykuł nie jest przedstawiany jako potwierdzony „nowy w tygodniu”. W raporcie historycznym trzeba respektować rzeczywisty knowledge cut-off i brak look-ahead; samo wyszukiwanie dziś nie odtwarza informacji dostępnej wcześniej.

**Deduplikacja:** jeden artykuł może pojawić się w M01, M02 i M03; liczyć go jako **jedną** informację. Priorytet materiałów pierwotnych i niezależnych; nie traktować kopii tej samej depeszy jako potwierdzających się źródeł. Zwracać `coverage` i wykaz luk tematycznych zamiast deklarować kompletność rynku.

**Budget / stop search:** najpierw osiem tematów w minimalnym zakresie, bez ponownego pobierania tych samych wyników, plus dodatkowe do siedmiu zapytań **tylko gdy informacja zmienia diagnozę/odkrywa lukę i koszt jest dopuszczony**. Jeśli ograniczenia budżetu wymagają mniej niż osiem płatnych wywołań, zachować priorytety M01–M08 i uczciwie oznaczyć niepokryte obszary. Nie uruchamiać nowego background cron tylko na potrzeby tego raportu.

**M — kryterium dodatniego dowodu (FINAL-09):** samo złożenie zapytania i sama lista tytułów nie spełniają wyniku. W rzeczywistym wydaniu wymagane jest **co najmniej jedno** materialne zdarzenie o potwierdzonej publikacji w `[T0−7 dni, T0]` i dostępności w `T0`, z jednoznacznym źródłem, datą, zakresem licencji, wystarczającą głębokością treści oraz widocznym wpływem na tezę, kontrargument albo ważny mechanizm. Dopuszczona kwalifikacja może wykorzystać NewsAPI tylko dla **tego samego artykułu** dopasowanego po kanonicznym URL/ID wydawcy; nie „po podobnym tytule”. Jeśli brakuje dowodu, odnotować `MARKET_RESEARCH_DEPTH_OR_DATE_NOT_PROVEN`; niezależne przygotowanie raportu możliwe, lecz FINAL-09 = `CZĘŚCIOWY`, nie `PASS`. Wspólny URL rozpoznaje tę samą publikację w wielu kwerendach; różny opis wyniku nie tworzy osobnego źródła.

### 3.6. Procurement Context Enrichment — dynamiczny research wiedzy zakupowej

**Cel:** dostarczyć OpenAI nie tylko „co się stało”, ale *jak działa zakup tej kategorii i jakie opcje ma kupiec*. Research kupiecki **nie jest ograniczony do T0−7 dni**, bo mechanika kontraktowania i procesy rafineryjne zmieniają się wolniej. Preferowane wiarygodne źródła branżowe / instytucjonalne; okno przykładowe do 12 miesięcy **lub starszy ważny materiał źródłowy**, jeżeli wciąż aktualny. Odróżniać publikacje normatywne/evergreen od aktualnych stawek rynkowych.

| ID | Pytanie, które ma zrozumieć Composer | Przykładowe zapytanie Brave |
| --- | --- | --- |
| P01 | Co kształtuje cenę bitumu? | `bitumen price formation crude oil refinery margins Europe` |
| P02 | Jaki jest opóźniony/nieliniowy wpływ ropy na asfalt? | `crude oil price impact bitumen asphalt prices time lag` |
| P03 | Kiedy ustala się cenę/hedge? | `bitumen procurement fixed price timing price risk management` |
| P04 | Jakie jest ryzyko oczekiwania? | `asphalt purchasing price volatility fixed price contracts risks` |
| P05 | Jak logistyka wpływa na cenę dostarczoną? | `bitumen supply chain transport costs refinery distance` |
| P06 | Jakie ograniczenia ma hedge ropy jako proxy asfaltu? | `bitumen hedging crude oil futures basis risk` |
| P07 | Jak działa sezonowość i popyt? | `European bitumen seasonal demand road construction supply` |
| P08 | Jak przestoje rafinerii zmieniają podaż? | `bitumen refinery maintenance production capacity supply Europe` |

**Wariant MVP bez automatycznego uruchamiania całej ósemki:** wybrać **P01, P03, P05, P06 jako priorytetowe**; P02/P04/P07/P08 aktywować przy udokumentowanej luce lub gdy wpływają na bieżący scenariusz. W celu oszczędności dozwolone jest reuse wcześniej **prawnie dopuszczonego, aktualnego** kontekstu lub zatwierdzonej wiedzy kategorii — nie zakładać automatycznego prawa do magazynowania/cachowania surowych stron.

**Najważniejsza granica rzeczywistej implementacji:** obecny `source-adapters.mjs` dla wiadomości tworzy `TITLE_ONLY`; pole opisu / fragmentów Brave **nie trafia** do `composerEvidence()` jako potwierdzona treść. Samo dodanie wyszukania P01–P08 nie tworzy „wiedzy branżowej”. Aby realnie wzbogacić kontekst trzeba mieć **legalnie uprawnioną projekcję przydatnego, ograniczonego opisu/snippetu lub ustalonego faktu** przez istniejący Source Hub, z `materialDepth`, provenance i poprawnym licencyjnym `projectionPolicy`. To jest punkt weryfikacji Codexa, nie domniemana istniejąca funkcja LIVE.

**Dopuszczalne minimum:** przy braku licencji na opis/snippet nie dodawać nowego scrapa. Używać zatwierdzonych L1–L3 oraz materiałów źródłowych o wystarczająco udokumentowanej treści; tytuł traktować jako sygnał *do sprawdzenia*, nie podstawę do tezy. Taki przypadek to `ENRICHMENT_LIMITED_BY_SOURCE_DEPTH`, nie fałszywy sukces. Nowy płatny dostęp albo nowa retencja wymaga osobnej zgody i nie powinna automatycznie blokować reszty E1.

**Produkt wyjściowy `ProcurementResearchBrief`** (wersjonowany blok logiczny, nie nowa baza): dla każdego pytania `mechanismFinding`, `scope`, `supportingEvidenceRefs[]`, `contradictoryEvidenceRefs[]`, `sourceDateStatus`, `materialDepth`, `buyerRelevance`, `limitations`; **nie wolno** wyprowadzać udokumentowanego mechanizmu z tytułu, nie wolno wprowadzać „praktyk PORR” z internetowego poradnika i nie wolno nadpisywać profilu kupca. Krótki `ProcurementResearchBrief` trafia do Composera razem z Market Research Brief; dane są przetwarzane zgodnie z istniejącym zakresem licencji, E1 i retencji 0 w Source Hub.

**P — kryterium dodatniego dowodu (FINAL-10):** w rzeczywistym raporcie **co najmniej jedno** potwierdzone ustalenie kategorii zakupowej z profilu P musi wynikać z materiału o prawidłowej głębokości i prawie użycia oraz **rzeczywiście** wpływać na argument, ryzyko lub warunek rekomendacji. Podawać `sourceRecordRef`, `materialDepth`, zakres mechanizmu i ograniczenia oraz możliwy kontrargument. `TITLE_ONLY` może wskazywać temat do dalszego sprawdzenia, lecz nie jest dowodem znajomości mechanizmu. Jeśli brak legalnej głębokości, można użyć zatwierdzonej wiedzy L1–L3 jako fallback do bezpiecznej analizy, ale **nie wolno zaliczyć dynamicznego P**; `FINAL-10 = CZĘŚCIOWY` lub wymaga jawnej decyzji właściciela o zmianie standardu.

**Prawa do wyników Source rozdzielać co najmniej na:** (a) samo wyszukanie/pozyskanie, (b) przetworzenie i wysłanie opisu/snippetu do OpenAI, (c) zapis ograniczonego materiału lub wyekstrahowanego ustalenia w prywatnym jobie, (d) możliwość cytowania/publikacji w PDF. Zgoda na (a) **nie dowodzi** (b)–(d). Nie proponować ominięcia polityki przez scraping.

### 3.7. Quality Gate — minimalny wiarygodny standard

**Kontrakt pojedynczej generacji:** istniejące zliczenie dokładnego body przez `/v1/responses/input_tokens`, następnie **jedno** płatne wywołanie generacyjne OpenAI (bez osobnego modelu-researchera). Wynik prywatny: `Analytical Brief` z referencjami oraz **dziewięć** rozdziałów czytelniczych w wersjonowanym strict JSON. Brief walidowany **oddzielnie**; `editorial.mjs` ocenia sekcje czytelnicze. Zmiana musi uwzględnić obecny schemat ośmiu kluczy, zakaz cyfr w narracji, `qualityGate()` i sztywne cztery strony Pythona — to nie jest sama poprawka promptu. Tabele/liczby można deterministycznie renderować ze zweryfikowanych metryk/referencji. Nie przyjmować wzrostu limitów modelu ani dodatkowych płatnych wezwań bez rzeczywistej konieczności.

**Twarde kontrole:** zgodność time/`asOf`, prawidłowy zakres organizacji, brak nowych licencji/grantów, liczb i źródeł bez dowodu, identyczny `sourceRecordRef`, brak zmyślonych dat Brave, właściwy basis futures/spot, nieuprawnione cytowanie `TITLE_ONLY`, status `AWAITING_REVIEW` i czytelny PDF.

**Jeden moment graniczny wiedzy T0:** dla jednorazowego zlecenia `T0 = job.command.asOf`, ustalony **po stronie serwera przy przyjęciu zamówienia** i niezmienny w całym jobie. T0 kwalifikuje daty publikacji, dostępność źródeł i stan wiedzy potrzebny do prognoz i raportu. Czas rzeczywistej akwizycji (`retrievedAt`) oraz czas zamknięcia pakietu dowodowego (techniczne `job.asOf`, jeśli używane do zapisu) są **osobnymi znacznikami**, które nie przesuwają T0. Materiał pobrany po T0 nie otrzymuje automatycznie statusu „dostępny w T0”; przy raporcie historycznym wymaga wiarygodnego punktowego dowodu dostępności i braku look-ahead.

**Reguła kompletności źródeł i kontrolowanej próby płatnej:** aktualny `buildEvidence()` bezwarunkowo ustawia `PARTIAL_READY`, a runner nie egzekwuje `allowPartial`; konieczna jest jawna, deterministyczna kwalifikacja braków. **Przed licznikiem tokenów `/v1/responses/input_tokens` i przed wywołaniem generacyjnym OpenAI** odbiorowa próba LIVE musi potwierdzić w wejściu: rzeczywistą kwalifikowaną parę do FINAL-04, datowany 12M do FINAL-05 oraz po jednym kwalifikowanym, licencjonowanym materiale M i P o odpowiedniej dacie/głębokości/prawie użycia do FINAL-09/10. Brak dowolnego obowiązkowego wejścia zatrzymuje **tę próbę odbiorową przed płatnym krokiem**, wskazując dokładne niespełnione kryterium; brak fikcyjnego `PASS` i brak automatycznego płatnego retry. `allowPartial: false` w jednorazowym zamówieniu UI ma być rzeczywiście respektowane. Częściowa generacja może być osobno dopuszczona tylko przez **jawny, uprawniony tryb** (nie implicit fallback), bez zaliczania brakujących FINAL. **Rzeczywisty materialny wpływ dowodów M/P na tezę i rekomendację jest oceniany dopiero po wygenerowaniu raportu przez recenzenta** — tego nie da się potwierdzić wyłącznie przed generacją. Deduplikacja i refs odnoszą się do **faktycznej projekcji wysłanej do modelu**, a nie tylko do szerszego bundle.

**Jakościowe kontrole:** obecność tezy, przyczynowego mechanizmu, niezależnego kontrargumentu, rzetelnej oceny stopnia pewności i **praktycznej konsekwencji zakupowej**, w tym skutku spot/front/carry dla decyzji hedge. Gdy wniosek jest sprzeczny z dowodami lub myli future z przyszłym spot, fail/recenzja; nie zasłaniać się poprawnym JSON.

**Niska cena wdrożenia:** na start jeden generacyjny call OpenAI, obecna `ED-01–ED-12`, celowane testy i **jedna realna recenzja merytoryczna** na Development. Dodatkowy płatny AI-reviewer lub automatyczny rewrite dopiero po rzeczywistym pomiarze konieczności. Kontrola jakości nie zastępuje człowieka przy publikacji; nie obiecywać pełnej, w 100% autonomicznej publikacji w tym zakresie.

## 4. Istniejące komponenty, architektura i ownership (B/D)

### 4.1. Potwierdzone ponowne wykorzystanie

| Komponent | Źródło w SG-dev | Planowana czynność |
| --- | --- | --- |
| Composer i Quality Gate | `apps/insights-runtime/src/composer.mjs`, `editorial.mjs` | Wąska adaptacja kontekstu, analizy i schematu, bez zmiany modelu na start |
| Planowanie i dowody | `apps/insights-runtime/src/planner.mjs`, `evidence.mjs`, `source-adapters.mjs` | Profil M01–M15/P01–P08, deduplikacja, `TITLE_ONLY` → ewentualna legalna projekcja minimalnej treści, przypięte refs; żadnych obejść Source Hub |
| PDF | `apps/insights-runtime/src/renderer.mjs`, `render/report.py` | Ponowne użycie z nową kolejnością i blokami |
| Runtime/API | `apps/insights-runtime/src/runner.mjs`, `api.mjs`, `host.mjs`, `subscription-api.mjs`, `store.mjs` | Ponowne użycie operacji generacji, wersjonowania zleceń i istniejących reguł E1/Source; rozróżnić stan wydania od publikacji |
| Kontrakt raportu | `packages/insights-contracts/index.mjs` | Minimalne rozszerzenie **tylko jeśli wymagane** (R3) |
| Macrobond / history | `apps/sg-runtime/lib/benchmark/macrobond.ts`, `apps/sg-runtime/lib/market-data/*` | Istniejące serie, metadata i read; zweryfikować maturę, settlement, basis i datę; brak nowego providera |
| Forecast | `apps/sg-runtime/lib/forecast/*` | Odczyt dostępnych wyników; nie zmieniać treningu |
| Produkt/entrypoint | `apps/sg-runtime/app/api/v1/insights/[...report]/route.ts`, `components/procurement-insights/reports.tsx`, `lib/insights/autonomous-runtime.ts`, `lib/insights/subscriptions.ts` | Istniejące zlecenie → historia jobów → **autoryzowane prywatne pobranie `AWAITING_REVIEW`**; potwierdzić ścieżkę na Development |

### 4.2. Drzewo proponowanych zmian monorepo — D3

```text
SG-dev/ (main authority)
├── Canon/
│   ├── proposals/bsdc/SG2/
│   │   └── BSDC-20261128-SG2-PI-ANALYTICAL-REPORT-V1.md   [PDR v0.4 — OWNER_APPROVED]
│   ├── v0.5-procurement-oil-insight-report-canon.md         [HISTORYCZNY, bez przepisywania]
│   └── [nowy Oil & Asphalt Canon v1.0 — ścieżka do zatwierdzenia, tylko jeśli potrzebna normatywna aktywacja]
├── apps/
│   ├── insights-runtime/                                  [ISTNIEJE — Insights Domain]
│   │   ├── src/composer.mjs                               [ROZSZERZENIE]
│   │   ├── src/editorial.mjs                              [ROZSZERZENIE / reuse]
│   │   ├── src/planner.mjs, src/evidence.mjs               [ROZSZERZENIE: Market/Procurement Research]
│   │   ├── src/source-adapters.mjs                        [TYLKO GDY DOPUSZCZONY LEGALNY DEPTH > TITLE_ONLY]
│   │   ├── src/renderer.mjs, render/report.py              [ROZSZERZENIE / PAGINACJA I PRZYPISY]
│   │   ├── src/spot-futures-analytics.mjs                  [NOWY CZYSTY MODUŁ — LOKALIZACJA KANDYDACKA]
│   │   └── tests/                                        [TESTY CELowane]
│   └── sg-runtime/                                       [ISTNIEJE — SG2; producent/odbiorca wg routingu]
│       ├── components/procurement-insights/reports.tsx  [ISTNIEJE / MAŁA ZMIANA: PRYWATNY PDF]
│       ├── lib/insights/autonomous-runtime.ts             [ISTNIEJE / AUTHORIZED READ]
│       ├── lib/insights/subscriptions.ts                  [ISTNIEJE / REUSE]
│       ├── lib/benchmark/macrobond.ts                    [REUSE / READ]
│       ├── lib/market-data/                             [REUSE / READ]
│       └── lib/forecast/                                [REUSE / READ]
└── packages/insights-contracts/                          [ISTNIEJE — rozszerzyć wyłącznie gdy niezbędne]
```

**Decyzja architektoniczna do przeglądu Codex:** bez nowego pakietu/frameworku na start. Profil zapytań M/P jako lokalna wersjonowana konfiguracja lub niewielki plik w `insights-runtime` tylko jeśli potrzebny do utrzymania; nie tworzyć drugiej usługi/source transport. Kalkulator jest matematycznie neutralny względem surowca i ma czysty, testowalny kontrakt. Jeżeli aktualny routing wskazuje istniejący właściwy współdzielony moduł, umieścić go tam, bez kopiowania i bez niedozwolonego importu domeny SG Runtime do Insights. Dla wszystkich nowych ścieżek sprawdzić rzeczywisty Code Routing/Code State; nazwy i ownerzy w drzewie są **kandydatami**, nie autoryzacją.

### 4.3. Granice i istniejące zależności

- Insights Domain jest producentem treści; Source Hub/Market Data są producentami danych, Forecast Core prognoz; **Brave to istniejący provider Source Hub, a Newsfeed jest osobnym konsumentem**. Nie obchodzić Hub przez Newsfeed i nie tworzyć drugiego konektora Brave/Macrobond ani silnika prognoz.
- Żadne wywołanie do Brave, NewsAPI, Macrobond, Trading Economics, EIA, OpenAI ani nowa konfiguracja Source nie jest upoważnione samą Kartą. Dostępność modelu `gpt-6.1-sol/high` z profilu przykładowego nie dowodzi modelu użytego w historycznym PDF ani gotowości dzisiejszego LIVE.
- Odczyt repo potwierdza **kod Brave Web Search z `freshness=pw`, `resultType=web/news`**, ale deklaracja katalogu Source Hub `IMPLEMENTED_OFFLINE_VERIFIED / SOURCE_ADMISSION_AND_LICENCE_REQUIRED` nie jest dowodem jego dostępności dla tej generacji, pakietu/licencji ani zgody na przekazywanie wycinków treści do modelu.
- **Bezpośrednia kolizja plikowa:** [PR #1205](https://github.com/profitia/SG-dev/pull/1205) obejmuje `composer.mjs`, `renderer.mjs`, `report.py` i zależności. W E1-T01 rozstrzygnąć **jedną** kanoniczną implementację cytowań względem bieżącej bazy, nie kopiować w ciemno całego draftu. Dodatkowe przecinające powierzchnie: [#1166](https://github.com/profitia/SG-dev/pull/1166) (konsument/raporty), [#1150](https://github.com/profitia/SG-dev/pull/1150) (kontekst i lifecycle), [#1147](https://github.com/profitia/SG-dev/pull/1147) (UI nawigacja), [#884](https://github.com/profitia/SG-dev/pull/884) (starszy eksperyment Oil). [#1214](https://github.com/profitia/SG-dev/pull/1214) jest możliwą zależnością Source, **nie** automatycznie wymaganym całym pakietem. Nie wznawiać, nie scalać ani nie zamykać starych PR-ów bez własnych decyzji ownerów.
- Istnieje osobna [Karta BSDC Precomputed Forecasts](https://github.com/profitia/SG-dev/blob/main/Canon/proposals/bsdc/SG2/BSDC-20261123-SG2-PRECOMPUTED-FORECASTS.md). Ten projekt konsumuje gotowe wyniki, nie przejmuje jej etapów i zleceń.
- Nie aktywować niezatwierdzonych opcji GV-01/GV-02; zgodnie z [kartą optymalizacji wydania](https://github.com/profitia/SG-dev/blob/main/Canon/proposals/bsdc/ARCHITECTURE/spendguru-development-release-optimization.md), pilot R1 jest aktualnie zawężony do konkretnej poprawki Dashboardu, a nie ogólnego Composera.

**Stan operacyjny z niezależnej recenzji Codexa (28.11.2026; odczyt bez uprawnionej sesji klienta):** SG2 Runtime miał działający artefakt `2fd1db48…`, Source Hub odpowiadał `/health` i `/ready`, lecz anonimowe odczyty raportów zwróciły `503 INSIGHTS_NOT_ADMITTED` / `SUBSCRIPTIONS_UNAVAILABLE`. **To nie dowodzi awarii dla autoryzowanego użytkownika**. W E1-T01/T05 wymagany jest krótki realny preflight: katalog profili, worker, prywatny storage, granty Source i operacje OpenAI counter/generate, autoryzowane odczyty i odpowiadające im SHA/bindingi oraz LKG. Potwierdzenie muszą dać rzeczywiste środowiska, a nie samo `main` ani historyczny dokument.

## 5. Ryzyko, klasyfikacja i szybka ścieżka wydań

| Powierzchnia zmiany | `SECURITY_RISK` — wstępnie | `DEVELOPMENT_IMPACT` — wstępnie | Walidacja |
| --- | --- | --- | --- |
| Niezachowujące zachowania etykiety i wygląd PDF | R1 (tylko czyste presentation) | A | Test wyniku/renderera i integracji według aktywnego zakresu |
| Instrukcje, buyer context, czysta logika syntezy, lista kwerend Brave | R2; R3 przy zmianie kontraktu Source / pakietu | A, ewentualnie B | Testy semantyczne, datowania, izolacji org, kosztu i polityki materiału `TITLE_ONLY` |
| Kalkulator `F−S`/net yield i istniejące odczyty | R2; R3 jeśli nowy wspólny kontrakt | A | Testy liczbowe, matury, null/fail-closed, realna para źródeł |
| Schemat Composera, pakiet, build, renderer i zależne usługi | R3 | A lub ograniczone B | Testy producenta/konsumenta, dokładnego artefaktu, integracja i recovery |
| Nowy normatywny wpis governance/grant/sekret/E1 | R4 dla tej operacji | wg rzeczywistego wpływu | Odrębna decyzja ownera i właściwa pełna kwalifikacja |

**Twarda reguła:** licencyjna zmiana projekcji materiału z `TITLE_ONLY` na snippet nie jest automatycznie R2 — ocenę wpływu na współdzielone kontrakty, retencję i prawa Source należy wykonać osobno. Klasa integracji określana dla rzeczywistego PR względem bieżącej bazy, **osobno** klasa wydania dla całej różnicy od LKG do docelowego SHA. Nie uśredniać ryzyk. Używać wyłącznie aktywnych uproszczeń, nie trzymać projektu z powodu niedokończonego E4-T03, nie podnosić rutynowych kontroli do nieformalnych zgód, nie obchodzić wciąż obowiązkowych checków. Rzeczywista klasa przez zaufany mechanizm, nie przez samoocenę kandydata.

### 5.1. Development Acceleration Compatibility — `COMPATIBLE WITH CONDITIONS`

- Źródło decyzji: [ARCH-DEV-RELEASE-OPT-20261121](https://github.com/profitia/SG-dev/blob/main/Canon/proposals/bsdc/ARCHITECTURE/spendguru-development-release-optimization.md), DEC-11/12 i dwie recenzje 28.11.2026. E1 projektu optymalizacji i E3 pilot zostały odebrane; E2-T02/T03 pozostają odroczone; E5-T01 odebrano **tylko dla Dashboard Development**, nie jako dowód buildu Insights/SG2 Runtime. E4/GV-01b ma dowody dopuszczenia w ustalonym zakresie, a E4-T03 nie jest odebranym ogólnym skrótem dla R2/R3. Według recenzji Codexa na `main` działa bazowy strict check `sgdev-gv02-pr-baseline`, ale ogólne automatyczne R1/auto-merge i prawa pilota dla PI **nie zostały potwierdzone**.
- [PR #1339](https://github.com/profitia/SG-dev/pull/1339) jest **równoległym pilotem R1 Dashboardu**, a nie zmianą plików Insights. Jest jednak wrażliwy na dokładną kompozycję `main`, lease i wspólne wydanie. **Nie scalać nawet dokumentacyjnego PR-u PI ani nie wydawać na współdzielone Development, jeżeli rzeczywiście unieważni to aktywne dowody pilota.** Nie wprowadzać globalnego, bezterminowego HOLD: przy integracji ponownie sprawdzić faktyczną sekwencję i zwolnić tylko kolidujące operacje.
- Po osobnym mandacie E1 **można działać w odrębnym Codespace/worktree**, rozwijać i lokalnie testować kod. Publikacja PR, kontrolowany CI, merge i deploy następują dopiero po odpowiednim preflighcie kolizji, źródła i dokładnego SHA.
- **NIE DOTYKAĆ** dla potrzeb PI: workflow CI, Source Admission i frozen governance v5, rulesetów, SDK authority, uprawnień pilota oraz jego release. Prace nad nowym raportem nie mogą modyfikować projektu optymalizacji.
- Oddzielnie klasyfikować rzeczywistą deltę PR-u (wstępnie R2/R3) i **całą** deltę wydania od LKG. Według recenzji Codexa między wcześniejszym LKG SG2 Runtime a sprawdzonym `main` występowała także delta chronionych plików; finalna kwalifikacja release może zatem wymagać R4 mimo R3 samego PR-u. Tylko aktualny zaufany mechanizm i realne dowody rozstrzygają; nie zakładać R4 ani jej braku przed porównaniem dokładnych wersji.

## 6. Przepływ end-to-end i scenariusze funkcjonalne (C)

`Uprawniony użytkownik → widok Raporty → zamówienie/subscription API (serwer ustala niezmienne T0 = job.command.asOf, allowPartial:false) → istniejący job/runner → serwerowa autoryzacja Buyer Context → [L1-L3 policy/category/buyer] + Market Research [T0−7d,T0] + Procurement Research przez Source Hub → kwalifikacja praw/dat/głębokości/deduplikacja względem T0 → Market Evidence + Market Data + kwalifikowana perspektywa 12M → deterministyczny Spot–Futures → PRE-GENERATION GATE: gotowe wejścia FINAL-04/05/09/10 → licznik dokładnego body → jedno generacyjne OpenAI (prywatny Analytical Brief + 9 rozdziałów) → Quality Gate → ReportLab PDF + przypisy + prywatny store → status AWAITING_REVIEW → historia zlecenia i autoryzowane prywatne pobranie przez insights.report.download → recenzja materialnego wpływu M/P i rzeczywisty odbiór na SG2 Development`.

**Warunek T0 / próby:** T0 zapisane na starcie zamówienia pozostaje niezmienne mimo późniejszego `retrievedAt` lub zapisu `job.asOf` po akwizycji. W domyślnym zleceniu `allowPartial:false` brak któregoś pozytywnego wejścia FINAL-04/05/09/10 musi zatrzymać odbiorowy przebieg **przed licznikiem i generacją**. Zapis braków/coverage nie oznacza odebranego raportu. Tylko odrębnie autoryzowany tryb częściowy pozwala na przygotowanie `PARTIAL`, zawsze bez fałszywego sukcesu.

**Warunek wersjonowania:** UI może ustawiać `revision:1`, a obecny klucz wydania nie zawsze rozróżnia wersję profilu. Dla tej samej organizacji i okresu v0.5/v1.0 może powodować `EDITION_PROFILE_CONFLICT`. W E1-T01 uzgodnić jawną autoryzowaną rewizję wydania **albo pierwszy wolny okres odbiorowy**, bez zmiany historycznego PDF, bez wyłączania deduplikacji i bez drugiego nieplanowanego zakupu generacji. `AWAITING_REVIEW` nie jest `PUBLISHED`; prywatny odczyt istnieje po stronie API, ale obecny UI biblioteki może udostępniać tylko PUBLISHED — poprawić minimalną ścieżką w istniejącym widoku.

**Scenariusze i alternatywy:**

1. **Normalny:** uprawniony kupiec otrzymuje konkretny raport, wszystkie ważne wskaźniki i warunkową rekomendację. Źródła z datą i proweniencją.
2. **Brave zwraca tytuły bez treści:** system nie dopowiada mechanizmów na podstawie nagłówka, używa pozostałych dowodów, ujawnia ograniczoną głębokość materiału; `Procurement Context Enrichment` nie otrzymuje pozornego PASS.
3. **Brave `pw`, ale brak wiarygodnej daty publikacji:** `PUBLICATION_DATE_UNKNOWN`; bez zaliczenia do 7-dniowych zdarzeń. Dopuszczony NewsAPI może potwierdzić datę w swojej semantyce.
4. **Brak entitlement/licencji/Source lub limit budżetu:** nie wykonywać wywołań niedopuszczonych, oznaczyć `NOT_ADMITTED`; jeśli reszta danych pozwala na raport, zachować czytelną analizę, a jeśli brakuje krytycznej podstawy — rzeczywisty STOP dla generacji.
5. **Konflikt źródeł:** model pokazuje obie strony i wybiera uzasadniony scenariusz, a nie powtarza tego samego newsa z trzech domen.
6. **Spot/futures niekompletne:** brak matury, różna baza, staleness, nieznany `r`, data na wygaśnięciu, różna waluta, ujemne wartości — zgodnie z §3.4 publikować jedynie te wyniki, które da się poprawnie obliczyć.
7. **Niepełne prognozy 12M / 7D:** nie tworzyć syntetycznych 12 punktów; podawać dostępne horyzonty, daty i niepewność.
8. **Brak szczegółów oferty PORR:** rekomendować *warunkowo moment zabezpieczenia*, nie składać deklaracji transakcyjnej lub opóźniać fizycznych dostaw.
9. **Błędy techniczne:** brak budżetu tokenów, jakości PDF, brak uprawnień E1, próba odczytu obcego buyer profile, równoległy job, niezgodny pakiet, konflikt PR/deployment — fail-closed/obowiązujący retry/rollback, bez obchodzenia autoryzacji.

**UX:** reuse bieżącego Procurement Insights; brak obowiązku nowego MagicPath. Widoczne rzeczywiste stany `GENERATING`, `AWAITING_REVIEW`, brak źródła, brak wskaźnika, partial; nigdy „PUBLISHED” bez odrębnej decyzji i rzeczywistej operacji publikacji. Nie wymuszać wybierania przez użytkownika fraz researchu — profil kategorii działa automatycznie.

## 7. Roadmapa BSDC E6 — pełny rezultat w jednym etapie wykonawczym

### 7.1. Warunek rozpoczęcia

Właściciel zaakceptował **rozwiązanie i pełną roadmapę E6 dokładnej rewizji v0.4** w dniu 28.11.2026. Po kontrolowanej publikacji Karty uruchomienie wymaga osobnego zlecenia `URUCHOM ETAP E1` dla SG2 Development w granicach zatwierdzonych operacji. Koszt i prawa płatnej próby LIVE wymagają osobnej decyzji przed wywołaniami (DEC-04).

### 7.2. E1 — Implementacja, integracja i rzeczywisty odbiór raportu v1.0 na Development

**Wynik E1:** uprawniony użytkownik generuje na SG2 Development PDF Oil & Asphalt według zaakceptowanego kanonu v1.0, z użyciem aktualnego kontekstu, uzasadnionej syntezy i aktualnych kwalifikowanych wskaźników, zachowując bieżący gate publikacji.

**Owner/profil:** SG2 jako profil prowadzący, Insights Domain jako owner Composera; odrębni właściciele Source/Forecast/kanonu/chronionych zmian tylko dla ich realnego zakresu. **Środowisko:** SG2 Development. **Tryb:** Full Autopilot w ramach zaakceptowanego etapu, bez mikro-zleceń, lecz z bezwzględnym STOP przy nieobjętej zgodą zmianie właściciela, kosztu, uprawnień lub chronionego Source.

| Task ID | Działanie i wynik | Owner / propozycja miejsc | Zależność | DoD taska / dowód |
| --- | --- | --- | --- | --- |
| **E1-T01** | Finalizacja specjalistycznego Oil Canon v1.0, profilu PORR, pytań Market/Procurement Research, zatwierdzenie matematyki i schematu Analytical Brief | SG2/Insights Domain + właściwy owner `Canon/` | Akceptacja Karty, routing i zgoda normatywna | Wersjonowany kanon/profil i prywatny kontrakt Brief + 9 sekcji, M/P i metodologia §3.4; polityka minimalnych dowodów/12M, źródła/licencje, routing, kolizja #1205, instalacja Dev, wersja/revision; v0.5 historyczny, ED bez podmiany |
| **E1-T02** | Pure Spot–Futures Analytics i adapter istniejących metadanych Macrobond; bez długiej krzywej | SG2/owner danych wg routingu, `apps/insights-runtime/src/*` lub właściwa ścieżka | Kwalifikacja spot/front/matury/funding | Testy REF-01–08 + 13/14 dni, fundusz ACT/365F i konwencja stopy, maturity/delivery/roll/units/basis, 3 kolumny; **pozytywny rzeczywisty spread** albo `CZĘŚCIOWY` dla Business DoD (nie fałszywy PASS); net yield wyłącznie warunkowo |
| **E1-T03** | Wdrożenie Market/Procurement Brave research, autoryzowanej projekcji materiału, Context Enrichment, Analytical Brief, Composer, Evidence, Quality Gate — 1 model call na start | Insights Domain + Source Hub owner dla ewentualnego rozszerzenia zakresu, istniejące `src/*`, ewent. `packages/insights-contracts` | T01; T02 konsumowane po gotowości | M/P query plan (M01–M08 + P01/P03/P05/P06 jako priorytet), limit płatnych calli, licencje/daty i dozwolony depth, pozytywne dowody FINAL-09/10, 12M snapshot albo jawny częściowy status, analiza braków przed OpenAI, prawidłowe refs i izolacja tenant, jeden call generation |
| **E1-T04** | Adaptacja PDF do 9 rozdziałów, aneksów i 3-kolumnowej interpretacji spot/front, bez nowego frontendu | Insights Domain `renderer.mjs`, `report.py` | T01/T03 | Płynna paginacja (bez twardych 4 stron), 9 rozdziałów, aneksy, przypisy, trzy kolumny i liczby/metody; **małe podpięcie prywatnego `AWAITING_REVIEW` download w istniejącym UI**; test prawidłowego i obcego odbiorcy, wsteczny odczyt v0.5 |
| **E1-T05** | Zgodne z klasą ryzyka Source/CI, integracja i wydanie na SG2 Development; rzeczywiste wywołanie modelu i recenzja porównawcza | SG2 + właściciele operacji CI/Source/Release | T01–T04, aktywne mandaty, koszt i LKG | Dokładny SHA/artefakt i LKG, osobne oceny PR i pełnej delty release, ochrona pilota #1339, kontrolowany Development E2E z autoryzowanej sesji (jeden opłacony raport), prywatny PDF/hash i odmowy cross-tenant, **FINAL-01–10** i rubryka jakości, PHR/PMOS/rollback |

**Dozwolona równoległość:** po T01 T02 oraz przygotowanie T03/T04 mogą powstawać równolegle w ramach jednego autoryzowanego E1; wybór research queries i sprawdzenie obecnego `TITLE_ONLY` mogą następować wcześnie, ale zmiany Source wymagają osobnego routingu/mandatu; T05 scala i wydaje. W toku E1 Codex sam naprawia rutynowe błędy; nie czeka na osobne GO dla każdej poprawki. Jeśli nowy kontrakt/Source/retencja/G1 jest konieczny, zatrzymać tylko zależną operację, nie całą możliwą pracę.

### 7.3. Business Definition of Done — rzeczywisty odbiór

| ID | Warunek końcowy | Dowód wymagany |
| --- | --- | --- |
| **FINAL-01** | Właściwie uprawniony użytkownik: **Raporty → zlecenie → job → `AWAITING_REVIEW` → prywatne pobranie rzeczywistego PDF**, bez publikowania klientom | Uprawniona sesja E2E, aktywny profil/worker/store/Source/E1/OpenAI, ślad API/job/edition, readback PDF/hash i odmowa innej organizacji; żadnego PASS z anonimowego 503 ani samego API |
| **FINAL-02** | Raport odpowiada na pytanie hedge i przedstawia konkretną, **opartą na danych, a nie założoną z góry** tezę, mechanizm, kontrargument, scenariusz bazowy i alternatywy oraz warunki rewizji | Ocena względem feedbacku PORR na realnym raporcie, nie fixture |
| **FINAL-03** | Kontekst PORR jest poprawny, a niewłaściwe rekomendacje (negocjacje, arbitralny split) nie pojawiają się bez uzasadnienia | Odbiór recenzenta + test profilu innego kupca, bez przenikania danych |
| **FINAL-04** | **Co najmniej jeden rzeczywisty, kwalifikowany i porównywalny spread spot–futures dla jednego uzgodnionego benchmarku** (z metadanymi pary), poprawny kalkulator i trzy poziomy interpretacji. **Ujemny, zerowy i dodatni znak spreadu są równie dopuszczalne.** Net convenience yield wyłącznie przy prawidłowej dacie ekonomicznej kontraktu i zgodnym finansowaniu; `N/A` dla yield jest dozwolone, ale **nie** zamiast całego przykładu spot/front | REF-01–08, 13/14 dni, funding i lifecycle kontraktu, realny snapshot i pełne lineage w PDF; brak rzeczywistej porównywalnej pary = `CZĘŚCIOWY` |
| **FINAL-05** | Raport zawiera **rzeczywistą, datowaną perspektywę cen ropy sięgającą 12M względem T0** z kwalifikowanego i dopuszczonego źródła. Dla prognozy miesięcznej kwalifikuje się **okres obejmujący miesiąc docelowy**; jawnie wskazać czy jest to np. średnia miesięczna. Dodatkowe 3M i 6M są `SHOULD` tylko jeśli publikuje je źródło, bez interpolacji; brak fikcyjnych szans, historii lub prognoz | Kontrola wydania źródłowego (np. dopuszczony STEO), instrumentu/horyzontu/licencji, `asOf` i liczb; brak kwalifikowanego 12M → `CZĘŚCIOWY` |
| **FINAL-06** | PDF ma nową strukturę, profesjonalny język, czytelne aneksy, **przełożenie Market/Procurement Intelligence na argumentację**, bez obcych fragmentów i technicznych identyfikatorów | PDF render acceptance i ocena pięciu wymiarów: teza, argumentacja, kontekst, język, niepewność |
| **FINAL-07** | Nie wprowadzono nieuprawnionych zmian E1/tenant, nowych grantów, schematów publikacji; kontrola publikacji `AWAITING_REVIEW` zachowana | Negatywne testy autoryzacji i sprawdzenie rzeczywistych bindingów/operacji |
| **FINAL-08** | Wymagane źródłowe/testowe/release checks dla klasy integracji i pełnego wydania od LKG przeszły; Development działa na rzeczywiście zbudowanych bajtach, recovery istnieje | PR/SHA/CI, potwierdzenie pakietu, deployment i PHR, rollback LKG |
| **FINAL-09** | **Market Intelligence — pozytywny efekt:** co najmniej jedno rzeczywiście datowane, licencjonowane wydarzenie z `[T0−7d,T0]` o prawidłowej głębokości materiału **wpływa na ważną tezę/kontrargument raportu**; M01–M08 są zdefiniowane, M09–M15 opcjonalne; `pw` sam nie stanowi dowodu daty | Rzeczywisty Source record + publication timestamp + evidenceRef i weryfikowalny fragment argumentu; dedup URL i raport coverage; wyłącznie `TITLE_ONLY` lub data UNKNOWN → `CZĘŚCIOWY` |
| **FINAL-10** | **Procurement Intelligence — pozytywny efekt:** przynajmniej jedno zweryfikowane branżowe ustalenie z profilu P (lub jawnie zaakceptowany odpowiednik) ma legalną, wystarczającą głębokość i **realny wpływ na mechanizm, ryzyko lub warunek rekomendacji kupca**. Nie podszywać się `TITLE_ONLY` pod dowód, nie nadpisywać L1–L3 ani danych PORR | Source record + materialDepth + zakres praw + przypięta argumentacja, dwie strony tezy/kontrargumentu, test prompt-injection/cross-tenant; wyłącznie tytuł lub dozwolony fallback L1–L3 bez pozytywnego researchu = `CZĘŚCIOWY` |

**OWNER_APPROVED — obowiązujący próg jakości / Business DoD (decyzja właściciela z 28.11.2026):** pięć wymiarów (konkluzja, argumentacja, kontekst PORR, język, prawidłowa niepewność), każdy oceniony przez uprawnionego recenzenta w skali 1–5: **minimum 4/5 w każdym wymiarze i zero błędów krytycznych**. Właściciel zatwierdził również pozytywne minimum FINAL-04/05/09/10 oraz **model wykonania jako jedno E1 z pięcioma taskami**. Full Autopilot wymaga osobnego `URUCHOM ETAP E1`; dopuszczenie płatnej próby oraz operacyjne granty/Source/CI/release wymagają odrębnych praw i zgód. Test porównawczy z wersją wyjściową na możliwie tych samych faktach i bazie referencyjnej; ewentualne dodatkowe płatne generacje dopiero po odrębnej zgodzie kosztowej. **Próg nie jest gwarancją identycznego raportu jak ChatGPT** — wymaga rzeczywistej recenzji.

### 7.4. Koszt, harmonogram i ograniczenia

- **Koszt implementacji:** zmiany w istniejącym repo bez nowych stałych zasobów; brak nowego modelu, osobnego workera, bazy i agenta. Brave M/P to płatne requesty zależnie od posiadanego planu; **profil bazowy do 12 logicznych kwerend (8 M + 4 P), profil rozszerzony do 23 (15 M + 8 P)** — faktyczny limit upstream calli/kosztu zostaje ustalony przez aktywną licencję i ownera. Brave Source ma osobny koszt/limit niż rezerwacja OpenAI w runnerze. Nie uruchamiać mechanizmu wielokrotnych płatnych prób w celu „dobicia” jakości; jedno kwalifikowane wywołanie LIVE przy odbiorze, dalsze tylko na właściwej zgodzie. Koszt API/source i limit wywołań określić przed LIVE na podstawie faktycznych cen i uprawnień.
- **Cel czasu:** 1 dzień prac technicznych, maksymalny cel organizacyjny 2 dni **po pełnej gotowości mandatów i danych**. Nie deklarować gwarantowanego terminu; realna kwalifikacja R3, niezależne dopuszczenia lub niedostępność źródła mogą ten cel wydłużyć.
- **Ścieżka:** aktywny [ARCH-DEV-RELEASE-OPT-20261121](https://github.com/profitia/SG-dev/blob/main/Canon/proposals/bsdc/ARCHITECTURE/spendguru-development-release-optimization.md) i najkrótsza dozwolona walidacja; nie używać pilotażowego checka GV-02 jako uniwersalnego R1/R2/R3.
- **Ryzyko wydania:** obecny `main` nie musi odpowiadać Live LKG SG2 Runtime. Pełna delta do wydania może zawierać chronione zmiany wykonane przez inne taski — zweryfikować osobno wymagany zestaw kontroli, a nie deklarować R3 dla całego release na podstawie wąskiego PR-u PI. Jeśli konieczne R4 dla wydania, dotyczy konkretnej kompozycji, nie rozszerza automatycznie klasy samego kalkulatora.
- **STOP:** nowy E1/grant/sekret/licencja, nieuprawniona projekcja snippet/full text, próba retencji poza prawem, zmiana aktywnego kontrolera, przekroczenie kosztu, niepewne dane/maturity, błędy lineage, brak LKG, rzeczywista kolizja pilota #1339 lub otwartego PR i innego release, brak dopuszczenia dokładnego SHA. Odrębne decyzje owner-only pozostają obowiązkowe. STOP dotyczy **wyłącznie zależnej operacji**, nie globalnie projektu.

### 7.5. Rejestr wykonania — część tej samej Karty, nie osobny plik

| ID | Status | Task/owner | Start/koniec | Dowody PR/SHA/CI/deploy/PHR | Braki / następny krok |
| --- | --- | --- | --- | --- | --- |
| E1 | `NOT_STARTED / NOT_AUTHORIZED` | SG2 / Insights Domain | — | — | Karta v0.4 przyjęta. Oczekuje odrębnego mandatu E1. |
| E1-T01 | NIE_ROZPOCZĘTY | kanon/Context | — | — | Normatywna adopcja, jeśli wymaga osobnego dopuszczenia |
| E1-T02 | NIE_ROZPOCZĘTY | Spot–Futures | — | — | Kwalifikacja serii/matury/routing |
| E1-T03 | NIE_ROZPOCZĘTY | Market/Procurement Search + Context + Composer | — | — | Source depth/licencja, dowody za i przeciw, jakość |
| E1-T04 | NIE_ROZPOCZĘTY | PDF + prywatny odczyt UI | — | — | 9 rozdziałów, aneksy, 3 kolumny i odbiór AWAITING_REVIEW przez właściwą sesję |
| E1-T05 | NIE_ROZPOCZĘTY | integracja i release | — | — | CI, ochrona #1339, autoryzowany paid LIVE, prywatny PDF, LKG i ocena 4/5 |

**Po E1:** rzeczywiste closeout z dowodami FINAL-*, PMOS/PHR. Jeżeli pełne DoD nie zostało spełnione, `CZĘŚCIOWY / ZABLOKOWANY` i wskazanie rzeczywistej blokady; nie ogłaszać SUCCESS na podstawie PR/CI/HTTP 200.

## 8. Checklista BSDC v1.1 — 29 kryteriów, projekt po recenzji końcowej

Status `USTALONE` oznacza uzgodnioną definicję projektową. **Dokładna rewizja v0.4 rozwiązania i roadmapy E6 oraz DEC-01, DEC-02, DEC-03 i model wykonania DEC-05 mają status `OWNER_APPROVED`**. Potwierdzenia techniczne i operacyjne weryfikuje się przy dopuszczonych działaniach E1.

| ID | Status | Konkretne ustalenie / brak |
| --- | --- | --- |
| **A1** | USTALONE | Problem: report summarization zamiast analizy i użytecznej decyzji hedge; §1. |
| **A2** | USTALONE | Kupiec/manager procurement; profil prowadzący SG2 i właściciel Profitia; §1. |
| **A3** | USTALONE | FINAL-01–10, testy §3.4 i **zatwierdzony próg 4/5 we wszystkich pięciu wymiarach, zero błędów krytycznych**; dowody działania LIVE powstaną w E1. |
| **A4** | USTALONE | Business quality i time-to-value; wyłączenia §2.3, bez rozbudowy platformy. |
| **B1** | USTALONE | Odczytano Composer, Evidence, Planner, Source adapters, Brave Hub (`freshness`, `TITLE_ONLY`), Forecast/Macrobond, BSDC, release opt; LIVE do potwierdzenia. |
| **B2** | W_TRAKCIE | Kod ≠ LIVE; `freshness=pw` ≠ potwierdzona data publikacji; `TITLE_ONLY` ≠ treść; `c1` ≠ matura; profil modelu ≠ wykonane wywołanie. |
| **B3** | USTALONE | Reuse/extension wybrane przed nową aplikacją lub nowym modelem; §4. |
| **B4** | USTALONE | Reuse Brave/Hub + Planner, kontrolowany M/P search, jeden model call i deterministyczne obliczenia; bez agenta i nowych stałych zasobów. |
| **C1** | USTALONE | Pełne UI → job → prywatny PDF opisane §6 i FINAL-01; LIVE sprawdza E1-T05. |
| **C2** | W_TRAKCIE | Input/statusy, okno T0−7, kontekst PORR, edge cases i REF-01–08; odczyt licencji/metadanych LIVE do potwierdzenia. |
| **C3** | USTALONE | MUST/SHOULD/OUT zapisane w §2. |
| **C4** | W_TRAKCIE | Reuse istniejącego UI; potwierdzić bieżącą gotowość dostępnego widoku na Dev, bez wymuszania MagicPath. |
| **C5** | USTALONE | FINAL-01–10 + merytoryczna recenzja Market/Procurement Intelligence i decyzji hedge. |
| **D1** | W_TRAKCIE | SG2 prowadzący; Insights Domain / Architecture Platform / SG Runtime w granicach ustalonych ownerów; routing do potwierdzenia. |
| **D2** | W_TRAKCIE | Codex zgłosił `ALIGNED` dla ścieżek Insights/SG Runtime i odmowę zapisu SG2 do Source Hub; potwierdzić ponownie na exact paths przed mutacją. |
| **D3** | W_TRAKCIE | §4.2 obejmuje istniejące `lib/insights` i `reports.tsx`, oraz proponowany kalkulator; exact routing/Source/Canon podlegają preflightowi. |
| **D4** | W_TRAKCIE | Kontrakt Analytical Brief, Spot–Futures, MarketResearch i ProcurementResearch, Source/Forecast; mapping do strict JSON/projection do recenzji. |
| **D5** | W_TRAKCIE | Buyer context per organizacja, licencje Brave/NewsAPI/Macrobond i reguły snippets/projection/retencji wymagają potwierdzenia; bez nowych grantów domyślnie. |
| **D6** | W_TRAKCIE | Development-only, koszty, proweniencja, LKG, budżet OpenAI, brak nowego hosta; dokładna instalacja do sprawdzenia. |
| **E1** | USTALONE | Jeden kompletny etap E1, z realnym produktem końcowym. |
| **E2** | USTALONE | E1-T01–T05: kanon, kalkulator, M/P search + Composer, PDF, Dev E2E. |
| **E3** | W_TRAKCIE | Granice Source, CI, release, E1 i właścicieli opisane; wymagane zgody do potwierdzenia. |
| **E4** | USTALONE | FINAL-01–10 z pozytywnymi dowodami M/P, realnym spreadem, 12M, autoryzowanym prywatnym PDF, REF-01–08 i przypadkami granicznymi, CI i E2E. |
| **E5** | W_TRAKCIE | Target 1–2 dni i oszczędne wykonanie; koszt modelu i rzeczywisty harmonogram do zatwierdzenia. |
| **E6** | USTALONE | Roadmapa E2E, taski, mandaty, rejestr i Business DoD w tej samej Karcie (§7). |
| **F1** | USTALONE | Akceptacja v0.4 i decyzje właściciela zapisane w §9. DEC-04 pozostaje otwarta przed płatną próbą LIVE. |
| **F2** | W_TRAKCIE | Koncepcja zgodna z BSDC/ED, lecz Source projection-depth, routing i adopcja nowego kanonu niezweryfikowane. |
| **F3** | USTALONE | Właściciel zaakceptował rozwiązanie (§3) oraz roadmapę E6 (§7) dokładnej rewizji v0.4 dnia 28.11.2026. Kontrolowany zapis dokumentu obejmuje bieżący mandat publikacji. |
| **F4** | USTALONE | Warunki przyszłego uruchomienia opisane w §§7 i 10. E1: `NOT_STARTED / NOT_AUTHORIZED`. |

## 9. Źródła, decyzje i otwarte rozstrzygnięcia

**Podstawa recenzji i stan (28.11.2026):** [dokładny main `6e78652794051709a2e6d763aa0df5eb871df63a`](https://github.com/profitia/SG-dev/commit/6e78652794051709a2e6d763aa0df5eb871df63a), recenzja techniczna Codexa `AMEND` (dostarczona przez właściciela), niezależna zgodność z Development Optimization `COMPATIBLE WITH CONDITIONS` (dostarczona przez właściciela); lokalna v0.2 i porównanie źródeł. Autor v0.3 przeglądał ponownie istniejący kod/kanon i potwierdził status GitHub: [#1339](https://github.com/profitia/SG-dev/pull/1339), [#1205](https://github.com/profitia/SG-dev/pull/1205), [#1214](https://github.com/profitia/SG-dev/pull/1214), [#1166](https://github.com/profitia/SG-dev/pull/1166), [#1150](https://github.com/profitia/SG-dev/pull/1150), [#1147](https://github.com/profitia/SG-dev/pull/1147), [#884](https://github.com/profitia/SG-dev/pull/884) pozostawały otwarte podczas kontroli; statusy należy ponownie odczytać przed operacjami.

**Kanon i implementacja:** [BSDC v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md), [Launcher](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/bsdc-launcher-v1.1.md), [Oil v0.5](https://github.com/profitia/SG-dev/blob/main/Canon/v0.5-procurement-oil-insight-report-canon.md), [Narrative & Editorial](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-procurement-insights-narrative-and-editorial-canon.md), [Insights Composer](https://github.com/profitia/SG-dev/blob/main/apps/insights-runtime/src/composer.mjs), [Planner](https://github.com/profitia/SG-dev/blob/main/apps/insights-runtime/src/planner.mjs), [Source Adapter](https://github.com/profitia/SG-dev/blob/main/apps/insights-runtime/src/source-adapters.mjs), [Brave Source Hub](https://github.com/profitia/SG-dev/blob/main/apps/platform-source-hub/src/providers/brave.mjs), [Renderer](https://github.com/profitia/SG-dev/blob/main/apps/insights-runtime/src/renderer.mjs), [Runtime source](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/lib/insights/autonomous-runtime.ts), [Release Optimization](https://github.com/profitia/SG-dev/blob/main/Canon/proposals/bsdc/ARCHITECTURE/spendguru-development-release-optimization.md).

**Rejestr decyzji właściciela — formalna akceptacja dokładnej rewizji v0.4 z 28.11.2026:**

| ID | Rozstrzygnięcie | Status | Zakres / ograniczenie |
| --- | --- | --- | --- |
| DEC-01 | Pozytywne minimum FINAL-04/05/09/10: rzeczywisty kwalifikowany spread (dowolny znak), datowana perspektywa 12M, materialny i uprawniony research M/P; yield warunkowy | **OWNER_APPROVED** | Brak dowodu nie jest `SUCCESS`; niespełnione FINAL ma jawny status częściowy |
| DEC-02 | Operacyjny próg **14 dni** dla annualizacji yield (testy 13/14 dni) | **OWNER_APPROVED** | Jawny wybór ostrożnościowy MVP, nie prawo ekonomiczne; testy już zaprojektowane |
| DEC-03 | Minimum 4/5 w **każdym** z pięciu wymiarów jakości i zero błędów krytycznych | **OWNER_APPROVED** | Ocena uprawnionego recenzenta na rzeczywistym raporcie, bez gwarancji identyczności z ChatGPT |
| DEC-04 | Budżet jednej kwalifikowanej płatnej próby i realne prawa OpenAI/Source/Brave | **OPEN** | Odrębna zgoda kosztowa i operacyjna wyłącznie przed przyszłą płatną próbą LIVE. Bez automatycznych ponowień ani domniemanych grantów. |
| DEC-05 | **Model wykonania: jedno kompletne E1 z pięcioma taskami**, izolowane prace i kontrolowana integracja Development | **OWNER_APPROVED — MODEL WYKONANIA** | Uruchomienie E1 wymaga osobnego mandatu. |

**Akceptacja dokładnej rewizji:** właściciel formalnie zaakceptował v0.4, w tym specyfikację rozwiązania w §3 i zintegrowaną roadmapę E6 oraz FINAL-01–10 w §7, w dyspozycji „Formalna akceptacja i publikacja Karty Projektu BSDC v0.4” z 28.11.2026. Status obu części: **`OWNER_APPROVED`**. SHA-256 źródłowego dokumentu przekazanego do akceptacji: `cc41c782294e01d332b1c34e852f503baf850f6f4e593cebe1b55e76ff55363e`. Ta redakcja utrwala metadane akceptacji i granice mandatu.

**Do rozstrzygnięcia przez Codexa w realizacji, bez podnoszenia do dodatkowych decyzji biznesowych, jeżeli nie wchodzi w chroniony zakres:** lokalne nazwy prywatnego JSON, mapowanie PDF, deduplikacja URL i ograniczenie materiału, dopasowanie UI do prywatnego `AWAITING_REVIEW`, numer rewizji i konflikt `EDITION_PROFILE_CONFLICT`, konkretny kwalifikowany instrument i semantyka jego metadanych, wykorzystanie istniejącego datowanego STEO, kwalifikacja braków przed płatnym modelem, ref lineage zgodnie z #1205, preflight LKG i równoległy pilot #1339.

**Niepotwierdzone:** rzeczywisty status licencji i praw wykorzystania Brave do modelu/PDF, faktyczny runtime binding Source/Market/Forecast/OpenAI dla uprawnionego konta PORR, dokładna porównywalna para spot/front i termin finansowania, rzeczywisty przyjęty snapshot 12M, ostateczna skuteczność rulesetu/CI oraz pełna klasa wydania względem LKG. To są konkretne zadania preflightu, a nie powód do reaudytu całego SpendGuru.

## 10. Procedura uzgodnienia, publikacji i wznowienia

1. **Końcowa recenzja techniczna Codexa:** `ACCEPT` dla dokładnej rewizji v0.4.
2. **Decyzje właściciela:** `OWNER_APPROVED` dla v0.4 rozwiązania i roadmapy E6 oraz DEC-01, DEC-02, DEC-03 i modelu wykonania DEC-05. DEC-04 ma status `OPEN` przed przyszłą płatną próbą LIVE.
3. **Zapis Karty według BSDC v1.1:** zapis i przyszłe aktualizacje roadmapy, rejestru i dowodów prowadzić w **jednej** Karcie we właściwym routingu. Normatywny Oil v1.0 wydzielić wyłącznie przy wymaganiu właściwej aktywacji. Nie zmieniać historycznego v0.5. Przed **jakimkolwiek merge do `main`** sprawdzić aktualny exact lease pilota #1339 i czy commit wpłynąłby na jego kwalifikację; opóźnienie dotyczy tylko kolidującej operacji, bez sztucznego wstrzymywania przygotowania.
4. **Etap wykonawczy wyłącznie po odrębnym mandacie `URUCHOM ETAP E1`:** Codex pracuje w Full Autopilot nad E1-T01–T05 na izolowanym Codespace/worktree, respektując prawa Source/E1, rzeczywiste klasy ryzyka i płatne limity. Integruje i wydaje dopiero według aktualnych warunków release; wynik odbieramy na uprawnionej sesji przez prywatny PDF i rzeczywiste FINAL-01–10.
5. **Zamknięcie:** wynik `SUCCESS` tylko po wszystkich zaakceptowanych Business DoD. Przy brakach źródeł, licencji, realnego snapshotu albo niedostępnym wydaniu: oznaczyć `CZĘŚCIOWY` z dowodem, kontynuować niezależne dozwolone zadania aktywnego etapu, nie tworzyć automatycznie E2.

## 11. Rejestr konsolidacji i uzgodnień v0.2 → v0.4 (bez dodatkowego dokumentu)

| Uwaga recenzentów | Decyzja redakcyjno-projektowa | Lokalizacja w Karcie |
| --- | --- | --- |
| AMEND — model otrzymuje same nagłówki | Wymagany dodatni, datowany i licencjonowany fakt M oraz znaczący kontekst P, bez zaliczania `TITLE_ONLY` | §§2.1, 3.5, 3.6, FINAL-09/10 |
| AMEND — `N/A` i 12M nie wystarczają do efektu biznesowego | Jeden rzeczywisty kwalifikowany spot/front, yield warunkowy, datowana wiarygodna perspektywa 12M i precyzyjny format horyzontów | §§2.5, 3.2, 3.4, FINAL-04/05 |
| AMEND — brak ścieżki prywatnego PDF | Podpięcie istniejącego download do UI Raporty, sesja i cross-tenant refusal, `AWAITING_REVIEW` bez publikacji | §§2.1, 4, 6, E1-T04/05, FINAL-01 |
| AMEND — dokładniejsza matematyka | Rozdzielone last trading/delivery/roll, konwersja simple/eff funding, test 13/14 dni | §3.4, E1-T02 |
| AMEND — profil v1.0 może kolidować z historycznym wydaniem | Autoryzowana rewizja lub wolny okres; deduplikacja i jeden kontrolowany koszt | §6, E1-T01/T05 |
| COMPATIBLE WITH CONDITIONS — pilot #1339 | Izolowany Codespace, ochrona exact lease/CI/main/release, brak nieograniczonego freeze | §5.1, §10 |
| PR-y starszych prac PI | Uzgodnienie #1205, bez wznawiania i scalania niepowiązanych draftów | §4.3 |
| Zbyt dużo nowych obowiązków | Zachowano **jedno E1 / pięć tasków**, rozdzielono Business DoD od poprawnego technicznie partial | §7 |
| v0.3 → v0.4: wcześniejsze trzy decyzje ownera wciąż robocze | Wprowadzono `OWNER_APPROVED` dla DEC-01/03 i modelu DEC-05, bez sugerowania zgody na całą rewizję lub płatny LIVE | metryka, §§7.3, 8–10 |
| v0.3 → v0.4: niejednoznaczne `SHOULD` 12M i słowo „pozytywny spread” | 12M `MUST`, 3M/6M `SHOULD`, znak spreadu dowolny; miesięczny punkt pokrywa miesiąc T0+12M | §§2.2, 3.2, FINAL-04/05 |
| v0.3 → v0.4: niejednoznaczny `asOf`, ryzyko płatnej próby przy brakach | Niezmienne serwerowe T0=`job.command.asOf`, czasy pobrania/seal odrębne, pre-paid gate FINAL-04/05/09/10, materialny wpływ M/P po generacji | §§3.5, 3.7, 6, FINAL-09/10 |

---

**STATUS KARTY:** `OWNER_APPROVED / v0.4` — rozwiązanie i zintegrowana roadmapa E6. **E1: `NOT_STARTED / NOT_AUTHORIZED`. DEC-04: `OPEN`.** Odrębna aktywacja kanonu normatywnego i przyszła płatna próba LIVE wymagają właściwych osobnych dopuszczeń.
