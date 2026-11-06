# Oil v0.5 Commodity Intelligence - stan wykonania

Task: `SG2-OIL-V05-COMMODITY-INTELLIGENCE-20261106`. Środowisko: Development.

**BUSINESS RESULT: BLOCKED / raport nie został wygenerowany.** Dokument opisuje przygotowanie konkretnego wykonania i brakujące uprawnienia; nie jest raportem rynkowym, wynikiem LIVE ani przyjęciem nowych źródeł do kanonu.

Aktualizacja po decyzji właściciela: cztery granty i odrębne 5 USD zostały zatwierdzone. Aktywny owner potwierdził jednak, że klucz podpisujący i jednorazowe polityki Source poprzedniego zadania nie mogą obsłużyć drugiej próbki. Pierwotny pakiet pominął tę techniczną zależność. Nie wykonano instalacji przed uzgodnionym oknem ani resetu poprzednich limitów. Wąski nowy wniosek jest w `supplemental-admission-v1`; nie ponawia wniosku finansowego.

## Zweryfikowane fakty

- Authority: `profitia/SG-dev`, osobny branch `sg2/oil-v05-commodity-intelligence-20261106`, baza `d24336a14437c773ba28a2dd6f2a276c47cf08a0`. Kanon v0.5 pozostaje niezmieniony, SHA-256 `5edb1848d3abd5b90ce7bcee2e894e764b354a6482665d8307e1f6d42a42ad41`.
- Równoległy Extended TE nadal pracuje. Jego aktualny komunikat potwierdza 48 rekordów z siedmiu pobrań i oczekiwanie na kontrolowaną aktywację TE Markets; nie istnieje jeszcze potwierdzona końcowa próbka Extended TE do porównania. Nie zmieniono jego plików, instalacji ani budżetu.
- Odczyt centralnego E1 z 2026-11-06 21:19:10 UTC potwierdził aktywny komponent `procurement-insights-oil-v05` i pięć grantów do dotychczasowych rodzin. Nie obejmują EIA, CFTC ani commodities.sh. Wygasający v0.4 nie stanowi alternatywnego dostępu.
- Odczyt Hub z 21:29:48 UTC potwierdził sześć aktywnych licencji nowych dostawców w trybie `SPENDGURU_PRODUCT`, retencję 0 i ważność do 2026-12-04 22:19:09 UTC. Licencja dostawcy nie zastępuje grantu SERVICE Oil.
- Zastosowano kontrakt surowcowy `1.1.0` i istniejące SDK z pakietu kontraktów `1.3.0`; nowy transport nie powstał. Dwa przygotowane requesty CFTC i darmowego kalendarza przeszły istniejący parser offline. To nie jest dowód LIVE tych requestów.
- PMOS begin: `cmw5hmt5p00004ezpt4omlvrq`; host chat `01a1b2b8-6c64-7c40-a1c2-289eafe03b32`. Pełny właściwy preflight z `--require-begin` przeszedł. Rejestracja pozostaje otwarta, ponieważ raportu nie dostarczono.

## Wybór danych, bez powtarzania inwentaryzacji

Główne grupy: EIA-100 (komercyjne zapasy ropy bez rezerwy strategicznej oraz destylaty), EIA-082 (wykorzystanie i przerób rafinerii), EIA-101 (Product Supplied jako przybliżenie konsumpcji). EIA-096 (handel) i EIA-004/EIA-005 (STEO) tylko po potwierdzeniu ich wartości analitycznej, jednostek oraz właściwych dat i horyzontów. Oznaczenia biznesowe nie są identyfikatorami pojedynczych serii API.

Istniejący katalog potwierdza LIVE metadanych tych tras, lecz większość konkretnych odczytów nie została przetestowana. Nie przeniesiono trzech przykładowych obserwacji EIA do nowego raportu ani nie odtworzono wartości z hashy. Docelowe przekroje wybierze autoryzowane pobranie słowników EIA w SourceHub, a następnie jedno ograniczone pobranie obserwacji dla każdej użytecznej trasy.

CFTC: `72hh-3qpy`, Disaggregated - Futures Only, kandydat WTI-PHYSICAL - NEW YORK MERCANTILE EXCHANGE. Metadane potwierdzają nazwę wariantu i kolumny Managed Money, lecz ten konkretny odczyt pozostaje niepotwierdzony. Przy pobraniu trzeba sprawdzić nazwę i kod kontraktu, jednostki, wariant, duplikaty oraz zgodność dat. Netto = long minus short; Open Interest i jego zmianę porównujemy wyłącznie w tym samym kontrakcie i wariancie. Data pozycji nie jest datą publikacji; nieznana data publikacji pozostaje UNKNOWN. Pozycjonowanie nie mierzy fizycznego popytu i nie dowodzi przyszłego kierunku cen.

commodities.sh: tylko darmowe `publication-calendar`. Istniejący receipt potwierdza sześć harmonogramów, ale nie zachował ich nazw i terminów. Nie da się odtworzyć kalendarza z liczby ani hashy. Nowe pobranie może dostarczyć konkretne przyszłe daty; sam opis cykliczności nie upoważnia do wygenerowania terminów. TE Economic Calendar pozostaje wyłączony.

## Jedna konkretna decyzja dostępowa i kosztowa

Lokalny pakiet `decision-packet/ACCESS_PROFILE.json` zawiera dokładnie cztery granty `knowledge.read / market` dla istniejącego Oil SERVICE, zatwierdzone późniejszą bezpośrednią decyzją właściciela:

1. `api.eia.data-catalog` - rozpoznanie rzeczywistych selektorów serii.
2. `api.eia.series-observations` - obserwacje i dostępne projekcje EIA.
3. `api.cftc.positioning-observations` - właściwy wariant COT dla WTI.
4. `api.commodities-sh.publication-calendar` - bezpłatne harmonogramy.

Zmiana wymaga właściciela E1 (`profitia_access_owner`) w centralnym projekcie Development `spring-bread-28217539`, branch `br-sparkling-term-b99l107x`, baza `platform_private`. Dotyczy roli `sg2_oil_v05_e1_report_development`, komponentu `procurement-insights-oil-v05`, organizacji `225e465b-8b89-467d-92d1-7fef61b555fe`. Nie rozszerza obecnego terminu ważności: 2026-11-07 20:49:55.971 UTC / 21:49:55.971 czasu Warszawy.

Instalacja wyłącznie po uzgodnieniu bezpiecznego okna z aktywnym ownerem. Nie powstają nowe role ani dostawcy; dotychczasowe klucze, granty, licencje i polityki pozostają zachowane. Cztery nowe identyfikatory grantów są w pakiecie. Cofnięcie usuwa wyłącznie te identyfikatory. Jeśli obecny profil, ważność lub dostęp do własnego runtime Oil nie spełnia warunków, należy zatrzymać wykonanie i uzyskać prawidłowe dopuszczenie właścicielskie. Nie wolno wydobywać klucza z równoległego procesu ani używać tożsamości inwentaryzacyjnej.

Osobny `COST_MANDATE_PROPOSAL.json` został zatwierdzony bezpośrednim komunikatem właściciela: maksymalnie 5 USD dla tej próbki, jeden finalny licznik wejścia i jedno generowanie przez profil `gpt-6.1-sol`, bez automatycznych retry. Rezerwacje istniejącego profilu wynoszą 0.10 + 4.90 USD. Nie jest to odnowienie poprzedniego limitu. Nowy ledger jest pusty; całe 5 USD pozostaje niewykorzystane. Finansowe GO nie instaluje osobnej technicznej tożsamości ani polityki Source.

## Gotowy przebieg po dopuszczeniu

1. Wykorzystać finalną, faktycznie odebraną implementację Extended TE; nie kopiować aktywnych plików ani sekretów. Jeśli próbka nadal nie istnieje, jawnie użyć ostatniej rzeczywistej v0.4 jako ograniczonego punktu porównania.
2. Pobrać wybrane dane wyłącznie przez SourceHub. Receipt pierwszego pobrania jest zarazem dowodem integracji; bez dodatkowych testów providera tylko dla telemetrii. Plan ogranicza nowe pobrania do maksymalnie 10 EIA, jednego CFTC i jednego darmowego kalendarza, bez automatycznych powtórzeń. Nie jest to nowa polityka Source ani quota Hub.
3. Zamrozić rzeczywiste `asOf`, sprawdzić jednostki, daty, rewizje, porównywalność, dostęp i retencję. Surowe obserwacje TTL0 pozostają wyłącznie przejściowe. Trwałe raporty, dopuszczone pochodne i przypisy wymagają właściwej podstawy; przechowuje się dozwolone metadane, receipts i fingerprinty.
4. Zachować kanoniczne notowania i Forecast Core. STEO pozostaje odrębną prognozą zewnętrzną. Nie przeliczać Brent/WTI na asfalt w PLN/t. Dane chińskiego bitumenu nie są polską ofertą dostawy.
5. Przygotować spójną polską analizę w ośmiu istniejących blokach, około 8000-10000 znaków, 3-4 strony, z numerowanymi przypisami i wyraźnym rozróżnieniem faktów, prognoz i hipotez.
6. Jedno dopuszczone generowanie, istniejący Quality Gate, render PDF i oględziny stron. Pełna telemetria z rzeczywistymi czasami, upstream requests i kosztami; nieznane pomiary pozostają UNKNOWN.
7. Porównać gotowe raporty, rozdzielając efekt źródeł, standardu redakcji i innego `asOf`. Dopiero potem końcowy PMOS/MEMOROS/PHR i wydanie artefaktów. Samo przygotowanie tego dokumentu ani begin nie kończy zadania.

## Rzeczywiste artefakty i braki

Przygotowano wybór metadanych, plan pobrań, zatwierdzone cztery granty i mandat kosztowy oraz odrębny wniosek techniczny Source/E1. Siedem testów obliczeń i kalendarza przeszło. Własne wywołania providerów i OpenAI: 0. Nie ma nowego PDF, narracji, faktycznego aneksu obserwacji ani oceny przyrostu jakości. Status pozostaje BLOCKED, nie SUCCESS. Historyczny pakiet decyzji i jego archiwum pozostają niezmienione; aktualna kontynuacja ma osobny zapis.
