# Procurement Oil Insight — Report Canon v0.2

**Status:** `DRAFT_FOR_BUSINESS_REVIEW` — rewizja v0.2 po audycie OpenAI Platform z 2026-11-02; nie jest jeszcze kontraktem przyjętym do produkcji.  
**Data:** 2026-11-02  
**Produkt:** SpendGuru 2.0 / Procurement Insights  
**Pierwszy typ raportu:** `OIL_MARKET_OUTLOOK` — WTI (`cl_c1_cl`) i Brent (`b_c1_cl`)  
**Kadencja referencyjna:** tygodniowa; horyzont prognozy: dokładnie 7 dni kalendarzowych od ostatniej uprawnionej obserwacji (`D7`).  
**Relacja do istniejącego kanonu:** specjalizacja redakcyjna projektowanego `Procurement Insights — Business & Architecture Canon v1.0` (Draft PR #847); nie zmienia jego authority ani zasad Forecast, Source, E1, prywatności i publikacji.
**Zmiana v0.2:** doprecyzowanie kontraktu OpenAI, bramek dostępu, telemetrii, kosztów i pilotażu. Dziewięć sekcji, metodologia sprawdzalności, źródła użytkownika i kontekst kategorii zakupowej pozostają bez zmian.

## 1. Cel i zasada jakości

Celem raportu jest dostarczenie kupcowi **krótkiej, selektywnej i udokumentowanej prasówki**, która łączy rzeczywiste notowania, niezależne wyniki Forecast Core, wydarzenia na rynku ropy i warunkową interpretację zakupową.

Raport musi odpowiedzieć na trzy pytania: **co się wydarzyło, co może wpłynąć na najbliższy tydzień i co to może oznaczać dla mojego konkretnego zakupu?** Priorytetem jest istotność informacji, a nie liczba cytowanych artykułów lub objętość tekstu. Jeśli nie ma wartościowych nowych wiadomości, system informuje o braku istotnych potwierdzonych sygnałów; nie wypełnia raportu ogólnikami.

Kanon dotyczy wyłącznie rynku ropy i powiązanych kosztów zakupowych. Nie jest uniwersalnym promptem dla LPG, pszenicy czy innych surowców. Przyszłe raporty branżowe mogą współdzielić infrastrukturę Insights i wzorce redakcyjne, ale muszą mieć własne profile czynników cenotwórczych i źródeł.

## 2. Definicja Insightu i kontekst użytkownika

Podczas tworzenia `OIL_MARKET_OUTLOOK` użytkownik określa:

| Pole | Wymaganie | Znaczenie |
| --- | --- | --- |
| Nazwa Insightu | Obowiązkowe | Np. „Oil Market Outlook — Asphalt”. |
| Benchmarki | Domyślnie WTI i Brent, świadomie zatwierdzone | Wyłącznie zweryfikowane serie z Benchmark Domain; dwa odrębne instrumenty futures. |
| **Kategoria zakupowa** | **Obowiązkowe** | Np. „Asfalt drogowy”, „Paliwa transportowe”, „Surowce petrochemiczne”. |
| Produkt / zastosowanie | Opcjonalne | Uściśla kategorię, jeśli potrzebna jest bardziej konkretna interpretacja. |
| Rynek / region zakupu | Opcjonalne | Np. Polska / Europa Środkowa. Brak nie upoważnia do przyjęcia lokalnych cen lub spreadów. |
| Horyzont decyzji i elastyczność terminu | Opcjonalne | Czy użytkownik musi zakontraktować w tym tygodniu, czy ma możliwość poczekania. |
| **Własne źródła użytkownika** | **Opcjonalne: 0..N adresów HTTPS** | Strony, sekcje portali, publikacje i kanały RSS, które użytkownik chce uwzględniać. |
| Harmonogram, odbiorca, widoczność | Według istniejącego kontraktu Insights | Domyślnie tylko autor/UserID; udostępnienie organizacji wymaga świadomej decyzji i uprawnienia. |

Kategoria zakupowa **nie zmienia matematyki WTI/Brent**. Zmienia dobór kontekstu gospodarczego i treść wskazówki zakupowej. System nie może zakładać marż, formuł indeksacyjnych, wolumenu, pozycji kontraktowej ani terminu płatności, jeśli użytkownik tego nie podał.

## 3. Polityka źródeł: niezależny research + źródła użytkownika

Każdy cykl łączy dwa strumienie poszukiwań:

**A. Niezależny research rynkowy:** priorytet dla weryfikowalnych źródeł pierwotnych i urzędowych, odpowiednio do tematu: EIA, IEA, OPEC/OPEC+, oficjalne dane makroekonomiczne i energetyczne, statystyka zapasów, produkcji, transportu i rafinerii, a następnie wiarygodne publikacje branżowe.

**B. Źródła wskazane przez użytkownika:** system podejmuje próbę sprawdzenia dodanych adresów w każdym cyklu; istotne materiały mogą zasilić `ReportEvidenceBundle`. Są **priorytetem przeglądu, nie automatycznym autorytetem**. Nie mogą wypierać faktów z innych źródeł ani wymuszać z góry określonego wniosku.

Dla każdego adresu system przechowuje status: `CHECKED_RELEVANT`, `CHECKED_NO_RELEVANT_UPDATE`, `INACCESSIBLE`, `NOT_CHECKED` albo `UNSUPPORTED`. Status „brak nowości” jest dozwolony tylko po faktycznym, skutecznym sprawdzeniu. Zwykły URL nie oznacza gwarancji odczytania wszystkich treści domeny ani śledzenia stron wymagających logowania.

Dla materiałów, które trafiły do analizy, zachowujemy: URL/identyfikator, tytuł, wydawcę, datę zdarzenia, datę publikacji, datę odczytu, istotność dla ropy i kategorii użytkownika, status potwierdzenia, ograniczenia licencyjne oraz identyfikator dowodu (`evidenceRef`). Materiały o tej samej pierwotnej informacji podlegają deduplikacji. Rozbieżne źródła są opisane jako rozbieżne, nie automatycznie uśredniane.

Adresy użytkownika i pozyskane teksty wymagają kontroli bezpieczeństwa: bez wewnętrznych adresów sieciowych, bez obchodzenia paywalli, bez nieuprawnionej redystrybucji. Treści stron są **niezaufanymi danymi, nigdy instrukcjami systemowymi**. Zestaw adresów należy do definicji użytkownika i nie przechodzi domyślnie do współdzielonego zasobu organizacji.

## 4. Profil analityczny rynku ropy — obowiązkowy filtr istotności

Research i selekcja faktów uwzględniają przede wszystkim:

- **Podaż:** decyzje OPEC+, wydobycie, ograniczenia eksportu, sankcje, zakłócenia infrastruktury i transportu.
- **Popyt:** aktywność przemysłowa, konsumpcja paliw, gospodarka Chin/USA/Europy, sezonowość i rafinerie.
- **Bilans krótkoterminowy:** zapasy komercyjne, wykorzystanie rafinerii, dostępność produktów, przepływy regionalne.
- **Makro i finansowanie:** istotne komunikaty banków centralnych, inflacja, aktywność gospodarcza i dolar, wyłącznie jeśli wykazano relewantny mechanizm związku z cenami.
- **Geopolityka:** faktyczne incydenty oraz racjonalnie uzasadnione scenariusze; bez mylenia ryzyka z wydarzeniem potwierdzonym.
- **Transmisja na kategorię kupca:** np. dla asfaltu także sytuacja rafinerii, dostępność bitumu, sezon budowlany, region, transport i formuła kontraktowa. Sam Brent/WTI nie jest ceną asfaltu.

Każde wydarzenie oceniane jest według: **nowość → wiarygodność → mechanizm wpływu → możliwy kierunek/niepewność → znaczenie dla konkretnej kategorii**. Wiadomości nieistotne są pomijane, nawet jeśli pojawiły się w preferowanych portalach.

## 5. Dziewięć obowiązkowych sekcji raportu

### 5.1 Header

Tytuł; wersja raportu; data przygotowania i `asOf`; benchmarki i identyfikatory instrumentów; kategoria zakupowa; ostatnia data obserwacji; daty prognozy `origin` i `target`; zakres analizy tygodniowej; status danych i status akceptacji raportu. Daty D7 od obserwacji i „kolejne 7 dni od publikacji” nie są synonimami.

### 5.2 Executive Snapshot

Maksymalnie trzy istotne wnioski: (1) faktyczny ruch benchmarków, (2) dominujący nowy czynnik lub napięcie rynkowe, (3) najważniejszy sygnał dla kategorii zakupowej. Bez ponownego streszczania całego raportu i bez nieudokumentowanego prognozowania zdarzeń.

### 5.3 Wykresy WTI + Brent — D7

Dwa sąsiadujące wykresy na szerszych ekranach, pionowo na wąskich. Każdy przedstawia osobno: rzeczywiste obserwacje, ostatni close, punkt `origin`, dokładną datę `target D7` i cztery **odrębne prognozy punktowe**: Naive, Damped Holt, ETS, ARIMA. Przy dostępności pośrednich kroków można pokazać ich udokumentowany przebieg; nie wolno interpolować nieistniejących wartości jako wyników modelu. Nie rysować przedziałów 7D bez przyjętej kalibracji. Oznaczyć `EXPERIMENTAL_7D` do formalnego przyjęcia metody. Wykresy korzystają z danych Forecast/Benchmark Domain — nie ze swobodnych obliczeń LLM.

### 5.4 Tabela 1 — Snapshot rynku

Dla WTI i Brent oddzielnie: nazwa i ID serii, ostatnia dostępna cena zamknięcia, data obserwacji, USD/bbl, zmiana 1W wyznaczona z uprawnionych obserwacji porównywalnych oraz status świeżości. Jeżeli brakuje prawidłowego punktu odniesienia, zamiast zmiany wpisać `N/D`. Nie mylić futures, spot i cen fizycznych produktów pochodnych.

### 5.5 Tabela 2 — Forecast D7 i sprawdzalność

Wiersze: **benchmark × model**. Pola: `lastClose`, `forecastOrigin`, `targetDate`, `forecastD7`, `forecastDeltaPct` (zmiana prognozowana względem origin), ostatnie **dojrzałe** porównanie (`previousOrigin`, `previousTarget`, `previousForecast`, `observedActual`, `lastCaseVerificationPercent`) oraz ocena historyczna (`historicalAverageVerificationPercent`, `directionalAccuracyPercent`, `maturedN`, `quality/limitationStatus`). Przy dużej szerokości tabelę można przedstawić jako dwie tabele WTI/Brent lub wersję skróconą z rozwinięciem; nazwy i znaczenie miar pozostają te same.

Ważne: nie zastępować pojedynczego wyniku poprzedniej prognozy średnią historyczną. „Sprawdzalność 95%” bez wskazania benchmarku, modelu, horyzontu i próby jest niedopuszczalna.

### 5.6 Co wydarzyło się w ubiegłym tygodniu?

Krótki opis rzeczywistego ruchu cen i historycznej zgodności prognoz, następnie **2–4 najistotniejsze wydarzenia** z poprzednich siedmiu dni: makro, podaż/popyt, geopolityka. Przy każdym: co się wydarzyło, kiedy, źródło i dlaczego jest istotne. Związek przyczynowy wyłącznie przy wystarczających dowodach; w pozostałych przypadkach „mogło wpływać”, „jest czynnikiem ryzyka” itp.

### 5.7 Na co patrzeć w najbliższym tygodniu?

**2–4 sygnały**: zaplanowane publikacje, oczekiwane decyzje, czynniki gospodarcze i geopolityczne o znaczeniu dla rynku. Rozróżnić `SCHEDULED`, `RELEASED`, `REVISED`, `CANCELLED` i `UNCONFIRMED`. Podać moment zdarzenia/strefę czasu, jeśli potwierdzony, oraz to, jaki wynik lub rozwój sytuacji mógłby zmienić interpretację.

### 5.8 Procurement Insight — dla kategorii użytkownika

Ostatnia, biznesowo najważniejsza sekcja. W 3–5 zdaniach wskazuje: dominujący scenariusz i jego warunki, ryzyko przyspieszenia versus odroczenia zakupu, jedno lub dwa zdarzenia wyzwalające ponowną ocenę oraz ograniczenia transferu WTI/Brent na produkt użytkownika. Dopuszczalne warianty: `CONSIDER_EARLIER_COMMITMENT`, `CONSIDER_WAITING_FOR_SIGNAL`, `CONSIDER_STAGED_PURCHASE`, `INSUFFICIENT_EVIDENCE` — **jako interpretacje warunkowe, nie bezwzględne instrukcje transakcyjne**. W przypadku asfaltu brak cen lokalnych, podaży bitumu lub warunków kontraktu musi być jawny.

### 5.9 Methodology & caveats

Zwięzłe, obowiązkowe ograniczenia widoczne przy raporcie: typ i waluta instrumentu, origin/target D7, status kalibracji, brak pasm, ograniczenia rolloveru i historycznych vintages, poziom weryfikacji oraz zasięg źródeł użytkownika. Rozszerzona metryka przechowuje pełną bibliografię, lineage i wersje, ale nie zastępuje najważniejszych ostrzeżeń w widocznym raporcie.

## 6. Kanoniczna matematyka sprawdzalności — bez drugiego algorytmu

**Źródło prawdy:** Forecast Core oraz istniejąca polityka `FORECAST_VERIFICATION_QUALITY_V1`, konsumowana przez Benchmark Finder. Insights nie liczy alternatywnej „trafności”.

Dla dojrzałego przypadku (`forecast = F`, `actual = A`) zdefiniuj jednostkowy znormalizowany błąd symetryczny:

`e_i = 2 × |F − A| / (|F| + |A|)`; gdy obie wartości są zerowe, `e_i = 0`.

Wówczas **sprawdzalność pojedynczej prognozy**:

`verification_i = clamp((1 − e_i) × 100%, 0%, 100%)`.

Dla wielu dojrzałych porównań użyj tej samej kanonicznej agregacji co Forecast:

`historical_sMAPE_percent = mean(e_i × 100)`  
`historical_verification_percent = clamp(100 − historical_sMAPE_percent, 0, 100)`.

To odpowiada regule użytkowej **(1 − błąd) × 100%**, pod warunkiem, że `błąd` oznacza sMAPE w postaci ułamka, a nie signed error lub `deltaPct`. Nie wolno zamieniać `deltaPct` (prognozowana zmiana ceny od origin) na błąd prognozy.

`directionalAccuracyPercent = clamp(100 × directionalAccuracy, 0, 100)` jest **osobną miarą** poprawnego kierunku względem wartości origin, a nie składnikiem poprzedniego wzoru. `n`, przygotowanie i wiarygodność oceny muszą być pokazane obok procentu. Zaokrąglenia wyłącznie na etapie prezentacji.

**Status D7:** eksperyment D0 korzysta z tej samej rodziny miar (`sMAPE`, `directional_accuracy`) i 40 dojrzałych porównań na serię i model w zbadanym przebiegu; **nie oznacza to jeszcze wdrożenia ani produkcyjnej certyfikacji `FORECAST_VERIFICATION_QUALITY_V1` dla D7**. Dla D7 nie przypisywać bez dowodu miesięcznej polityki progów/poziomów pewności. Przed włączeniem produkcyjnym wymagane jest jawne przyjęcie przez właściciela Forecast i dowód zgodności metryk oraz porównywanych originów w obu interfejsach.

## 7. Analiza wykonywana przez OpenAI

OpenAI otrzymuje wyłącznie wersjonowany, kontrolowany `ReportEvidenceBundle` zawierający: ceny, serię/instrument, cztery prognozy D7 i ich weryfikację, `asOf`, fakty rynkowe wraz z `evidenceRefs`, statusy monitorowania źródeł, kategorię zakupową użytkownika i ograniczenia. Odpowiedź ma postać schematu strukturalnego odpowiadającego dziewięciu sekcjom oraz identyfikatorów referencji. Dopiero renderowanie tworzy raport wizualny.

OpenAI może: porządkować istotność, wyjaśniać zgodności/rozbieżności i mechanizmy wpływu, budować warunkowe scenariusze, redagować tekst. OpenAI nie może: obliczać ani modyfikować liczb Forecast, wymyślać wydarzeń, cytatów, dat, wyników zaplanowanych publikacji, przyjętych przedziałów, modelowego „consensusu” ani własnego współczynnika sprawdzalności.

Model i prompt są wersjonowanymi parametrami wykonania; żaden model nie zostaje „kanonicznie najlepszy” bez odrębnego porównania jakości/czasu/kosztu. Wynik niepewnego żądania (`UNVERIFIED`) nie jest uznawany za ukończony i nie jest po cichu ponawiany.

## 7.1. Kontrakt generowania przez OpenAI — aktualizacja v0.2

Poniższe wymagania są **stałymi regułami jakości i wykonania**. Nie ustanawiają jednego modelu, cennika ani wartości timeout jako normy biznesowej.

1. **Warstwa Author / Composer.** Do wygenerowania narracji i identyfikatorów źródeł stosować Responses API ze ściśle określonym schematem `text.format` / `json_schema` / `strict:true`, o ile wspiera go wybrany i dopuszczony model. Schemat odwzorowuje dziewięć sekcji, oddziela pola liczbowe i referencje od komentarza oraz określa jawne braki danych. Gdy model zwraca odmowę, wynik niekompletny lub brak zgodnego obiektu, nie wolno tworzyć pozornego gotowego raportu. **Zgodność schematu nie stanowi dowodu prawdziwości twierdzeń.**
2. **Oddzielność danych liczbowych i języka.** Ceny, modelowe wartości D7, miary weryfikacji oraz dane wykresów i tabel pochodzą z referencyjnego, wersjonowanego `ReportEvidenceBundle` i Forecast/Benchmark Domain. Composer generuje narrację i referencje, a nie nadpisuje liczb, nie przelicza sMAPE i nie wpisuje samodzielnie wartości tabel.
3. **Model jest parametrem wykonania Insights, nie globalnym fallbackiem SG2.** Konkretny `modelId`, wysiłek rozumowania, budżet tokenów, wersja promptu/schematu i `serviceTier` są związane z operacją i jej dowodem. Nie zmieniać globalnego `OPENAI_MODEL` tylko po to, aby poprawić Insights, jeśli modyfikowałoby to jednocześnie Benchmark Finder lub inne moduły. Model można wybrać dopiero po potwierdzeniu dostępu **rzeczywistym kluczem/konfiguracją SG2**, nie samą polityką „Allow all models” innego, niezweryfikowanego projektu.
4. **Dwustopniowe pozyskanie informacji.** Niezależny research i dozwolony odczyt źródeł użytkownika są oddzielnym kontrolowanym etapem Source/Intelligence przed kompozycją. Włączenie Web Search w koncie OpenAI **nie oznacza**, że SG2 ma dopuszczoną operację raportową z wyszukiwaniem. Każda nowa funkcja retrieval musi mieć odpowiedni Source admission, weryfikację źródeł i wynik w `ReportEvidenceBundle`; nie wolno przypisywać modelowi ogólnej zdolności „przeczytania wszystkich podanych portali”.
5. **Czas i zakończenie.** Timeout, liczba tokenów oraz deadline całego `Insight Run` muszą być odpowiednie do uzgodnionego trybu, mierzone i kontrolowane; nie należy używać przypadkowego timeoutu Findera jako domyślnego SLA pełnego raportu. Rozróżniać co najmniej operacyjne wyniki `COMPLETED`, `INCOMPLETE`, `REFUSED`, `FAILED`, `UNVERIFIED` (nazwy logiczne, bez wymuszania nowego schematu). `UNVERIFIED` po wysłaniu żądania nie oznacza „nie wysłano” ani „koszt zero”; nie wykonywać ukrytego ponowienia. Tryb background wymaga niezależnej akceptacji sposobu odczytu, anulowania, retencji i własności odpowiedzi.
6. **Audyt i diagnostyka bez sekretów.** Dla każdego wywołania utrwalać własny `runId`/correlation ID, identyfikator operacji Source, identyfikator modelu, wersje schematu i promptu, znacznik wejściowego `ReportEvidenceBundle`, czasy, wynik, faktycznie zwrócone `usage` i rozliczenie kosztu lub ich status `UNKNOWN`. Rejestrować `x-request-id` / `x-client-request-id` oraz Response ID, **gdy dostępne i bezpiecznie dopuszczone przez kontrakt transportu**. Brak identyfikatorów nie może być zastąpiony domniemaniem sukcesu. Sentry nie powinno przechowywać pełnych promptów, treści prywatnych, kluczy ani odpowiedzi wrażliwych.
7. **Budżet i publikacja.** Każda próba i recenzja mają osobną kontrolę kosztu, rezerwację i rozliczenie według E1/Package & Limits; alert z portalu dostawcy nie jest jedyną blokadą budżetową. Nie wolno utożsamiać limitów żądań Source z pieniędzmi lub OpenAI RPM/TPM. Po kompozycji obowiązują wszystkie kontrole §8, limit objętości §9 i ręczne dopuszczenie pilota.

**Rozdział odpowiedzialności:** ten kanon określa wymogi, natomiast wartości operacyjne modeli, timeoutów, tokenów, budżetów i polityk retencji należą do oddzielnego, wersjonowanego **OpenAI Execution Profile**. Ich proponowane wartości nie są automatyczną zgodą na zmianę Source, klucza, wdrożenia ani finansowego limitu organizacji.

## 8. Quality Gate — to, co naprawdę chroni wartość prasówki

Warunki do sprawdzenia przed dopuszczeniem wydania:

1. **Forecast parity:** wszystkie ceny, daty, jednostki, 4 modele i miary zgodne z referencyjnym Forecast/Benchmark Finder; brak dodatkowej matematyki w Insights.
2. **Źródła i czas:** każda znacząca teza ma `evidenceRef`, a informacja była dostępna w chwili `asOf`; przyszłe wydarzenie nie jest dokonanym faktem.
3. **Własne portale:** rozliczone statusy prób sprawdzenia; brak pozorowanego monitorowania i fałszywego zapewnienia, że portal nie opublikował nic nowego.
4. **Relewancja:** każda istotna wiadomość zawiera uzasadniony mechanizm związku z ropą oraz, gdy dotyczy, kategorią użytkownika. Powtórzenia tej samej informacji nie zwiększają jej wagi.
5. **Wartość przyrostowa:** raport pokazuje istotną zmianę względem poprzedniego tygodnia lub stwierdza brak potwierdzonych nowych sygnałów. Nie dopisuje generycznych akapitów.
6. **Procurement utility:** końcowy wniosek wyjaśnia warunki decyzji, możliwe koszty pomyłki i sygnały do rewizji; nie przenosi mechanicznie zmiany futures na cenę asfaltu.
7. **Ograniczenia:** ujawnione nieprzyjęte D7, rollover, brak pasm, latest-vintage i zakres geograficzny danych.
8. **Redakcja i forma:** dziewięć sekcji; język zrozumiały dla kupca, bez sztucznej pewności i powtórzeń; deterministyczna kontrola objętości.
9. **Niezależna recenzja:** sprawdzenie liczb i źródeł kodem, odrębna ocena merytoryczna/redakcyjna oraz obowiązkowa akceptacja człowieka w pilotażu; utrwalenie wyniku dla dokładnej wersji raportu.

Wynik może być `PASS`, `NEEDS_REVISION` lub `BLOCKED`. Brak wystarczających faktów lub dowodów dla rekomendacji oznacza `INSUFFICIENT_EVIDENCE` w treści i odpowiednią decyzję recenzenta. Zmiana treści po recenzji unieważnia poprzedni `PASS`. Bez `APPROVED_FOR_PUBLICATION` nie ma publikacji, PDF ani wysyłki.

## 9. Długość i reprezentacja

W istniejącym kandydacie `Procurement Insights Canon v1.0` obowiązuje propozycja **maksymalnie 4000 znaków ze spacjami dla widocznej treści wraz z tabelą**. Ten dokument **nie zmienia samodzielnie** tej reguły. Dla tak zdefiniowanych dziewięciu sekcji, dwóch wykresów i dwóch tabel może ona okazać się zbyt restrykcyjna. Rozdzielenie limitu narracji i danych tabelarycznych jest **propozycją do osobnej decyzji właścicielskiej**, po testach na realnym raporcie. W pilotażu raport należy uczciwie oznaczyć jako niezgodny z limitem, jeśli się w nim nie mieści; nie wolno ukrywać ostrzeżeń ani danych dla pozornego zaliczenia.

Wizualizacje, tabele, wersje i pełna lista źródeł są odrębnymi elementami struktury raportu, ale muszą powstawać z tego samego zestawu liczb i dowodów. Układ desktop: dwa wykresy obok siebie; mobile: jeden pod drugim. Osobna lista „Wykorzystane źródła” i „Status źródeł użytkownika” może być rozwijalna, bez sztucznego wydłużania głównej prasówki.

## 10. Wydania, zasięg i odpowiedzialność

Jedna definicja użytkownika może tworzyć wiele niezmiennych tygodniowych wydań. Każde wydanie ma identyfikator i fingerprint: `definitionId`, `runId`, `reportVersionId`, `authorUserId`, `asOf`, `forecastRefs`, `evidenceManifest`, `sourceCheckManifest`, `modelId`, `promptVersion`, `reviewVersion`, `approvedAt` (jeśli dotyczy) oraz status publikacji i doręczenia. Brak automatycznego udostępnienia preferowanych źródeł lub kontekstu zakupowego całej organizacji.

Dane Forecast pozostają własnością Forecast Core; ceny i identyfikatory rynkowe — Market Data/Benchmark Domain; informacje dostępowe — E1/Source; raport, recenzja i publikacja — Insights. Nie tworzyć drugiego Forecast Core, konkurencyjnej tabeli sprawdzalności, własnego proxy Macrobond ani osobnego mechanizmu CIC. Bez osobnej zgody nie ma merge, deploymentu, nowego Source grant ani automatycznej publikacji.

## 11. Minimalny test pilotażowy

Po potwierdzeniu właściwego projektu/klucza i dopuszczeniu bezpiecznej, rozliczanej operacji OpenAI wykonać najpierw **jedną pełną próbę z potwierdzonym wynikiem**. Następnie, na rzeczywistym pakiecie WTI/Brent, wykonać co najmniej dwa porównywalne przebiegi: **A:** niezależny research bez własnych adresów; **B:** ten sam benchmark/kategoria i dodatkowe źródła użytkownika. Obydwa na tym samym zestawie danych Forecast, z utrwalonymi informacjami `asOf`. Porównać istotność i nowość informacji, zgodność źródeł, poprawność matematyki, trafność mechanizmów wpływu, konkretność porady dla asfaltu, błędy, czas i koszt API. Raport odrzucony przez recenzję pozostaje dowodem eksperymentu, nie materiałem do publikacji.

## 12. Otwarte decyzje do formalnej akceptacji

- Przyjęcie matematyki i kontraktu **D7** przez właściciela Forecast oraz zgodnego mapowania jakości w Benchmark Finderze/Insights; osobno brak pasm i niepotwierdzony rollover.
- Czy limit 4000 znaków dotyczy całej widocznej zawartości, czy samej narracji po wyłączeniu tabel i etykiet wizualizacji — wymaga zmiany właściwego kanonu nadrzędnego.
- Precyzyjna polityka pobierania źródeł użytkownika (liczba URL, cadence, limity techniczne, RSS/API, licencje, archiwizacja) i odpowiedni Source admission.
- Zakres informacji opcjonalnych o zakupie oraz ich uprawnienia i retencja.
- Kryteria oceny branżowej jakości raportu po pierwszych rzeczywistych przebiegach OpenAI API.
- Potwierdzenie projektu i uprawnienia **klucza faktycznie używanego przez SG2 Development**; polityka dozwolonych modeli na koncie nie wystarcza.
- Formalnie dopuszczona operacja dłuższego generowania w Source, diagnostyka identyfikatorów i rozliczanie `UNVERIFIED`; bez zmian globalnych timeoutów Findera.
- Dopuszczenie kontroli Web Search / stron użytkownika do Source i uzgodnienie retencji, zanim raport uzna te dane za monitorowane.
- Wybór i zatwierdzenie wersjonowanego profilu uruchomieniowego OpenAI na podstawie wyników pilota, a nie samej dostępności modelu.

**Status tej wersji:** `READY_FOR_BUSINESS_REVIEW` — kompletna rewizja projektu struktury i zasad dla Oil Market Outlook, **nie** zgoda na wdrożenie, zmianę modelu w SG2 ani certyfikacja wyników Forecast D7.
