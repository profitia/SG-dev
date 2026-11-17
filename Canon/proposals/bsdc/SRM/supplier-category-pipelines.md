# Karta Projektu BSDC — Supplier & Category Pipelines

> **Rewizja projektowa 2 — pakiet do łącznej akceptacji rozwiązania i całej roadmapy E1–E2.**
> **WORKING / NOT_ACCEPTED.** Zdefiniowanie projektu, przyjęcie decyzji biznesowych oraz zakończenie zadania dokumentacyjnego nie oznaczają akceptacji całości ani uruchomienia etapu wykonawczego.
> Jedna inicjatywa → jedna Karta z projektem, roadmapą, rejestrem i punktem wznowienia. Dokumentacja i dowody na GitHubie; bez lokalnych dokumentów na komputerze użytkownika.

| Pole | Wartość |
| --- | --- |
| initiativeId | BSDC-20261117-SUPPLIER-CATEGORY-PIPELINES |
| projectKey / profil prowadzący | SRM / SRM Runtime |
| Nazwa biznesowa | Dostawcy i pipeline’y w ADP |
| Konsument / owner integracji | SG2 / SG Runtime — AppShell (w poleceniu także UPShell) |
| Producent wspólnych kontraktów dostępu | ARCHITECTURE / Architecture Platform; wyłącznie własne powierzchnie, oddzielne taski |
| Repozytorium authority / branch authority | profitia/SG-dev / main |
| Jedyny plik Karty | Canon/proposals/bsdc/SRM/supplier-category-pipelines.md |
| Gałąź robocza / przegląd | sg2/bsdc-srm-supplier-category-pipelines-20261117 / [PR #1123](https://github.com/profitia/SG-dev/pull/1123), Draft |
| Status / gotowość przeglądu | WORKING / NOT_ACCEPTED / READY_FOR_JOINT_REVIEW |
| Utworzono / aktualizacja | 2026-11-17 / 2026-11-17, Europe/Warsaw |
| Zweryfikowany main discovery | f8a422fe88cc0a6166a6401c7238803ec5c44761 |
| Odczytana poprzednia rewizja Karty | Commit 6bca96beddfc5f6129b079fa053cacb8ef90c6c7, blob 4d1baeb039884c9b618fce4fbf3fd92d84821e9b |
| Właściciel decyzji i odbioru | tomasz@profitia.pl |
| Środowisko etapów i końcowego odbioru | Development |
| Dane odbiorowe | Reprezentatywne, syntetyczne dane dwóch organizacji; brak poufnej treści ADP i dokumentów PORR |
| Tryb / mandat wykonawczy produktu | DESIGN / BUSINESS CONSULTING; BRAK mandatu E1 i E2 |
| taskId wznowienia dokumentacyjnego | SRM-BSDC-SCP-DESIGN-R2-20261117 |
| PMOS begin wznowienia | cmwkubpfb00003rd0mtq3an92; srm_pmos; pełny require-begin PASS |
| Tożsamość czatu | hostConversationId niedostępny, jawne null w begin; nie wywnioskowano identyfikatora z katalogu |
| Akceptacja rozwiązania i roadmapy | OCZEKIWANA — brak zaakceptowanego commitu obu części |

**Znaczenie statusów checklisty:** USTALONE oznacza opisany i uzasadniony punkt projektu do przeglądu. Rekomendacje są jawnie odróżnione od decyzji właściciela. Nie oznacza to istniejącej implementacji, gotowego dostępu, instalacji schematu ani akceptacji właściciela całego pakietu. F3 pozostaje W_TRAKCIE do jego decyzji względem dokładnej rewizji.

## 1. Projekt rozwiązania — potrzeba, zakres i reguły

### 1.1. Cel i sprawdzalny efekt

Kupiec PORR wybiera ADP na biurku AppShell, trafia do „Dostawcy i pipeline’y” i domyślnie otwartego „Katalogu dostawców”. Wyszukuje lub dodaje firmę, otwiera jedną Kartę Dostawcy, sprawdza opiekuna, kategorie przypisane na karcie, potwierdzone informacje o ADP i uczestnictwo w procesach. Nie odtwarza wiedzy z maili, arkuszy ani niezależnych list.

Jedna firma w katalogu organizacji ma jeden stabilny supplierId i jeden znormalizowany NIP. Firma może mieć zero lub jedno aktywne przypisanie do pipeline’ów typu „Dostawcy” oraz wiele niezależnych aktywnych przypisań do nazwanych pipeline’ów kategorii. Etap należy do konkretnego uczestnictwa w konkretnym procesie.

Miarą sukcesu jest pełny scenariusz FINAL-01–FINAL-10 na rzeczywistej wersji Development: trwały odczyt drugiej osoby w tej samej organizacji, odmowy z innej organizacji i niezależność zmian. Dokument, PR, screenshot, HTTP 200 i sam deploy nie wystarczają.

### 1.2. Zakres pierwszej kompletnej wersji

| W v1 | Wynik dla użytkownika |
| --- | --- |
| Katalog | Wyszukiwanie po nazwie, NIP-ie i kategoriach przypisanych na karcie; tworzenie, edycja, archiwizacja i przywracanie. Widoczne również firmy bez pipeline’u. |
| Jedna Karta Dostawcy | Dane identyfikacyjne/kontaktowe, wiele kategorii ze słownika organizacji, opiekun lub brak, odczyt statusu ADP, lista procesów/etapów oraz podstawowa historia tych zmian. Ta sama karta z każdego wejścia przez supplierId. |
| Słownik kategorii dostawców | Kontrolowana lista organizacji; tworzenie/edycja/archiwizacja/przywracanie przez uprawnionych użytkowników tej organizacji; brak niezależnych swobodnych nazw kategorii w formularzu firmy. |
| Pipeline’y „Dostawcy” | Definicje procesów i etapów, przypisania, zmiana etapu, zakończenie przypisania i jawne przeniesienie do innego procesu. Zero lub jedno aktywne przypisanie firmy w całym tym typie. |
| Pipeline’y kategorii | Wiele nazwanych procesów w tej samej kategorii; wybór firmy z katalogu i etapu. Jedna firma raz aktywnie w każdym konkretnym procesie, z niezależnymi etapami. |
| Spójność i dostęp | Trwałość, kontrola współbieżności, transakcje, historia zmian, jednakowe możliwości członków organizacji oraz izolacja w bazie i na API. |

**Poza v1 bez osobnej decyzji zakresowej:** pełny obieg/wypełnianie/wysyłka/podpis/odnowienie ankiety ADP; upload, przechowywanie i podgląd dokumentów lub umów; współpraca i obroty/projekty, aktywności/Outlook, oceny, X-Ray, Newsfeed, SAP/importy, dostawcy bez poprawnego polskiego NIP-u, scalanie firm, automatyczne zakładanie firmy z rejestru, płatne źródła oraz nowy asystent. Historia zmian katalogu/przypisań jest częścią integralności v1, nie modułem „Aktywności”. Układ Karty zachowuje zaakceptowane flow; niedostarczone obszary nie mogą sugerować działającej usługi.

PL i EN oraz jeden responsywny interfejs pozostają wymogami SRM. Brak NIP-u nie ma ścieżki obejścia w v1; przyszłe identyfikatory zagraniczne/firmy bez NIP-u wymagają rozszerzenia kontraktu.

### 1.3. Reguły NIP-u i rozpoznawania firmy — decyzje właściciela

1. NIP jest obowiązkowy przy tworzeniu. Normalizacja usuwa białe znaki i myślniki; zapisuje się 10 cyfr. Walidacja formalna obejmuje format i cyfrę kontrolną, z odrzuceniem oczywistych atrap. Reuse reguł istniejących w validateXrayRequest i normalizePolishNip (§2); ewentualny prefiks PL obsługuje wyłącznie jawny adapter tej samej reguły, nie drugi klucz tożsamości.
2. „Poprawny” w tym kontrakcie oznacza poprawność formalną. Nie jest to potwierdzenie istnienia przedsiębiorcy ani statusu VAT. Weryfikacja zewnętrzna nie jest warunkiem zapisu v1 i nie uruchamia się przy tej okazji płatnego źródła.
3. Równe NIP-y po normalizacji oznaczają tę samą firmę **w katalogu tej samej organizacji**, niezależnie od nazwy, skrótu lub odstępów w nazwie. Nazwa nie jest kluczem deduplikacji. Identyczny NIP innej organizacji nie ujawnia jej rekordu ani nie blokuje własnego katalogu.
4. Ograniczenie unikalności w bazie obejmuje również archiwalne rekordy. Archiwizacja nie uwalnia NIP-u do utworzenia drugiej firmy; prowadzi do jej istniejącej karty z możliwością jawnego przywrócenia.
5. Edycja tego samego supplierId z niezmienionym NIP-em jest dozwolona. Zmiana na NIP innego supplierId daje konflikt. Nie następuje automatyczne scalanie ani nadpisanie istniejącej nazwy danymi z próby dodania.
6. Brak/błąd NIP-u blokuje zapis; komunikat przy polu z aria-describedby i fokusem po próbie zapisu. Wstępny lookup nie zastępuje kontroli podczas COMMIT.
7. Dwie osoby zapisujące ten sam znormalizowany NIP uzyskują jeden rekord: pierwsza operacja tworzy go, druga dostaje kontrolowany konflikt i odnośnik do tego samego supplierId. Oba żądania mogą przejść wcześniejszy lookup; o wyniku decyduje unikalność transakcyjna.

### 1.4. Istniejący NIP — akcja zależna od miejsca rozpoczęcia

W **tym samym formularzu**, pod polem NIP, pokazujemy komunikat „Ten dostawca istnieje w katalogu”, nazwę znalezionej firmy i NIP. Nie otwieramy osobnego obowiązkowego ekranu, nie podmieniamy po cichu jej danych i nie tworzymy duplikatu.

| Początek działania | Główna akcja po znalezieniu NIP-u | Dalszy wynik |
| --- | --- | --- |
| Katalog | **Otwórz Kartę Dostawcy** | Ta sama karta przez supplierId, zachowany kontekst powrotu do katalogu. |
| Wybrany pipeline | **Wybierz istniejącego dostawcę** | W tym kontekście wybór etapu; przypisanie dopiero po odrębnym zatwierdzeniu. |
| Istniejąca firma zarchiwizowana | Otwórz Kartę Dostawcy + jawne Przywróć | Brak nowego rekordu; dopiero przywrócona firma może dostać nowe aktywne przypisanie. |
| Firma już aktywna w tym procesie | **Pokaż przypisanie** | Pokazany istniejący etap, bez drugiego uczestnictwa. |
| Firma już aktywna w innym pipeline’ie „Dostawcy” | Informacja o obecnym procesie + **Przenieś do tego pipeline’u** | Jawne potwierdzenie przeniesienia i wybór etapu; zwykłe „Dodaj” jest odrzucone. |

Jeśli starszy rekord SRM ma NIP, lecz brak display_name, UI wyświetla „Nazwa nieuzupełniona” i NIP. Nie dopisuje nazwy z niezatwierdzonej próby. Otwarcie karty jest odczytem, nie ukrytym utworzeniem nowego mastera. Ewentualne uzupełnienie danych jest jawnym zapisem.

### 1.5. Kategorie i uczestnictwo — osobne relacje

- Kategorie na karcie opisują ofertę/klasyfikację firmy; użytkownik przypisuje i odpina je osobnymi akcjami.
- Pipeline typu CATEGORY ma jedną kategorię i własną nazwę, np. „Asfalt — kwalifikacja 2026” oraz „Asfalt — umowy ramowe”. categoryId nie jest pipelineId.
- Dodanie firmy do pipeline’u nie wymaga kategorii na karcie i **nie dopisuje jej automatycznie**. Odpięcie kategorii na karcie nie usuwa ani nie zmienia uczestnictwa w procesach.
- Firma może być raz aktywnie w każdym z tych dwóch procesów i jednocześnie w „Betonie”, z trzema różnymi etapami.
- Wyszukiwanie według kategorii w katalogu odnosi się do kategorii **na karcie**. Uczestnictwo według kategorii procesu jest osobną perspektywą/oznaczeniem; nie miesza się obu znaczeń w jednym polu.
- Typ pipeline’u jest niezmienny. Kategoria użytego pipeline’u nie jest przepisywana na inną; dla nowej kategorii tworzy się nowy proces. Nazwę można zmienić z zachowaniem historii.

### 1.6. Uprawnienia i współbieżność

Każdy zalogowany, aktualnie uprawniony członek organizacji ma w niej jednakowe możliwości obsługi v1. Opiekun relacji nie staje się wyłącznym edytorem. Konto bez aktywnego członkostwa nie ma dostępu. Członkostwo nie zastępuje wymaganej dostępności funkcji produktu i przyjęcia operacji E1/Access.

Organizację, konto, uprawnienia operacji i środowisko ustala serwer z zaufanych źródeł. Body/URL może wskazywać żądany zasób, ale nie dowodzi jego właściciela. Odczyt, lookup NIP-u, zapis, archiwizacja, przywrócenie, historia i każde powiązanie podlegają tej samej granicy organizacji.

Zmiany wymagają expectedVersion właściwego agregatu. Stara wersja daje 409 VERSION_CONFLICT; UI zachowuje szkic, odświeża stan i pozwala ponowić świadomą decyzję. Nie stosuje się cichego last-write-wins. Dla skutków mutacji wymagany jest idempotencyKey związany z aktorem, organizacją, operacją i digestem payloadu. Retry nie powiela firmy, przypisania, przeniesienia ani historii i nadal wymaga aktualnego dostępu.

### 1.7. Cykl życia — konkretna rekomendacja do łącznej akceptacji

Poniższe reguły są **rekomendacją projektu**, zgodną z punktem wyjścia właściciela. Nie są oznaczone jako wcześniej wdrożone.

| Obiekt / operacja | Reguła v1 | Zachowanie historii i relacji |
| --- | --- | --- |
| „Usuń dostawcę” | UI nazywa skutek **Archiwizuj dostawcę**. Dotyczy także nieużytego rekordu; brak fizycznego kasowania przez użytkownika w v1. Potwierdzenie pokazuje liczbę aktywnych przypisań. | W jednej transakcji zamyka aktywne przypisania we wszystkich procesach; pozostawia kartę, NIP, kategorie, dawne etapy, autorów i czasy. Nie zmienia innych firm. |
| Przywróć dostawcę | Odtwarza dostępność tego samego supplierId i NIP-u w katalogu. | Nie reaktywuje dawnych przypisań. Użytkownik wybiera nowe procesy i etapy jawnie. |
| „Usuń pipeline” | **Archiwizuj pipeline** z liczbą aktywnych firm. | Zamyka jego aktywne przypisania atomowo, zachowuje etapy i historię; nie archiwizuje firm i nie zmienia innych pipeline’ów. Przywrócenie nie wskrzesza uczestnictw. |
| „Usuń z pipeline’u” | Kończy konkretne aktywne uczestnictwo. Dla „Dostawców” dopuszczalny jest wynik zero aktywnych przypisań. | Firma i inne procesy pozostają; zakończone uczestnictwo widoczne w historii karty/procesu. |
| Przenieś firmę między pipeline’ami „Dostawcy” | Osobna komenda: obecny proces/etap → docelowy aktywny proces/etap; potwierdzenie i powód opcjonalny. Nie używa dwóch niezależnych kliknięć „Usuń” i „Dodaj”. | Zamknięcie starego i utworzenie nowego przypisania wraz z zapisem historii w **jednej transakcji**. Błąd lub konflikt zostawia stary stan. Brak chwilowego drugiego aktywnego przypisania. |
| Usuń pusty etap | Możliwe, jeśli pozostaje co najmniej jeden aktywny etap. | Etap znika z tablicy; zachowany identyfikator/nazwa w historii, bez fizycznego usunięcia śladów. |
| Usuń zajęty etap | Dialog pokazuje aktualną liczbę firm i wymaga innego aktywnego etapu **tego samego pipeline’u**. CTA: **Przenieś 4 firmy i usuń etap**. | Przenosi wszystkie bieżące uczestnictwa i usuwa etap z aktywnej konfiguracji atomowo. Karty i inne procesy bez zmian. Ostatniego aktywnego etapu nie usuwa się. |
| Rozdziel firmy do kilku etapów przed usunięciem | Użytkownik anuluje dialog i rozdziela je na tablicy, a następnie ponawia usunięcie. | Bez częściowego zbiorczego przeniesienia podczas anulowania. |
| Archiwizuj kategorię słownika | Znosi dostępność dla nowych przypisań na karcie i nowych definicji pipeline’u. | Dawne kategorie na kartach i istniejące procesy zachowują categoryId oraz oznaczenie archiwalne. Aktywny istniejący pipeline może kontynuować proces; archiwizacja kategorii nie archiwizuje pipeline’u. |
| Zmiana nazwy/etapów | Stabilne identyfikatory, niepuste nazwy; etapy unikalne po normalizacji nazwy w danym procesie; kolejność zmieniana jawnie. | Wersja konfiguracji i historia; zmianą nazwy nie przepisuje się dawnych zdarzeń. |
| Zmiana NIP-u istniejącej karty | Walidacja i unikalność jak przy tworzeniu; przy użytej firmie potwierdzenie „Zmiana identyfikatora firmy”. | Ten sam supplierId, audyt starego/nowego NIP-u; bez automatycznego scalania i bez przenoszenia relacji do innego supplierId. |

**Race podczas usuwania etapu:** dialog wiąże expectedPipelineVersion oraz oczekiwaną liczbę firm. Jeśli liczba/wersja zmieni się przed zapisem, serwer zwraca konflikt i aktualny bezpieczny stan. Użytkownik widzi nową liczbę i potwierdza ponownie; system nie przenosi po cichu firm dodanych po obejrzeniu dialogu. Zapis przypisań i operacja usuwania blokują ten sam agregat pipeline’u, aby uniknąć fantomowego uczestnictwa w usuwanym etapie.

Archiwalne dane pozostają odczytywalne w kontekście organizacji, z filtrem „Archiwalne”. Ślad domenowy zawiera kto/co/kiedy, identyfikatory i wersje przed/po; nie jest ogólnym modułem aktywności ani uprawnieniem do technicznego audytu platformy. Użytkownik nie kasuje historii. v1 nie wprowadza automatycznego purge; nie stanowi to zgody na bezterminową retencję realnych danych klienta. Przed przyszłym użyciem poufnych danych PORR wymagane są jego zaakceptowane reguły retencji/usuwania i operacyjnego odzyskania. Odbiór obecnego zakresu dotyczy testowych danych Development.

### 1.8. ADP — źródło, aktualność i uczciwe stany v1

**Potwierdzone źródła projektu:**
- SRM-CAP-005 określa kierunek stanów missing/current/outdated-or-expired/renewal-required i pochodzenie z zaakceptowanej ankiety PORR.
- Obecny publiczny AdpPresentationModel przekazuje adpStatus i adpDetails jako teksty prezentacyjne. Nie jest źródłem potwierdzenia istnienia ani aktualności ADP.
- Obecny host ADP korzysta z lokalnego modelu; makieta wylicza demonstracyjny status z rodzaju scenariusza, ma stałą datę i notę „maksymalny wiek 3 lata; sposób liczenia wymaga potwierdzenia”. **Nie jest to przyjęta reguła kalendarzowa ani dowód stanu dokumentu.**
- W sprawdzonych kontraktach nie znaleziono autorytatywnego, przyjętego interfejsu odczytu aktualności ADP. Nie deklaruje się jego wdrożenia.

**Projekt źródła v1:** SRM jest producentem odczytowej projekcji AdpStatusSnapshot przez jawny port SupplierAdpStatusReader. Port może konsumować tylko zaakceptowane metadane z organizacyjnego źródła ADP wskazanego przez PORR; nie czyta prywatnych tabel innego ownera ani treści dokumentów. Nie dodajemy ręcznego ustawiania statusu, importera, wysyłki ankiet czy obiegu dokumentów do rdzenia v1.

**Jawna granica odbioru:** jeśli takie źródło nie jest przyjęte i dostępne, rzeczywista odpowiedź v1 jest UNKNOWN / „Brak potwierdzonych danych”. Ten stan jest prawidłowym, sprawdzalnym wynikiem v1. Nie przyjmuje się, że E1 lub E2 obejmuje nową integrację z nieustalonym repozytorium ADP. Potwierdzone stany i daty pokazujemy wyłącznie, gdy istnieją fakty z dozwolonego źródła. Przyszłe podłączenie źródła wymaga jawnego przyjęcia kontraktu, właściciela i dostępu.

| Warunek źródłowy | Widoczny stan | Data / reguła |
| --- | --- | --- |
| Brak dozwolonego źródła, brak dowodu, błąd lub niepewna aktualność źródła | **Brak potwierdzonych danych** | Brak wymyślonej daty. Ostatnią znaną datę można pokazać jako „Ostatnie potwierdzenie”, nie jako bieżącą ważność. |
| Źródło jawnie potwierdza brak ADP dla tej firmy | **Brak ADP** | „Stan potwierdzony na …”, jeśli źródło podaje datę. Pusta odpowiedź lub brak integracji nie spełnia tego warunku. |
| Źródło potwierdza aktualne ADP | **Aktualne według źródła** | confirmedAt/asOf i ewentualne validUntil; brak validUntil oznacza „Termin ważności niepodany”, a nie bezterminowość. |
| Jawne validUntil minęło lub źródło potwierdza nieaktualność | **Nieaktualne** | Data ważności ze źródła; dla daty kalendarzowej koniec dnia w strefie organizacji, dla PORR Europe/Warsaw. |
| Źródło wskazuje konieczność odnowienia | **Do odnowienia** | Powód i data tylko w dozwolonej projekcji; brak uruchomienia procesu odnowienia. |

Nie wyliczamy automatycznie signedAt + 3 lata. Gdy źródło nie podaje terminu ani zaakceptowanej polityki, nie ustalamy go ze screenshotu, liczby uzupełnionych pól, daty edycji karty czy lokalnej daty makiety. Jeśli potwierdzony termin minął, ma pierwszeństwo przed niezgodną tekstową etykietą „aktualne”; sprzeczne/niepełne dowody zwracają stan bez potwierdzenia. Pełny provenance pozostaje serwerowo; przeglądarka dostaje wyłącznie dopuszczoną informację o statusie i dacie.

### 1.9. Konkretne stany ekranów — weryfikacja wobec makiety

Odczytano kod i podgląd ADP: projekt 465405993031966720, komponent 465415479037693952, rewizja 470946438948491264. Przegląd stanów poniżej jest **weryfikacją projektu względem źródeł**, nie twierdzeniem, że nowe zachowanie działa już w prototypie albo backendzie.

| Stan | Co potwierdzono w obecnej makiecie / kodzie | Docelowy stan zatwierdzany tą Kartą |
| --- | --- | --- |
| UX-01 wejście | AdpHome otwiera catalog; trzy zakładki: katalog i dwa typy pipeline’ów. | Zachować flow i domyślny katalog w AppShell, powrót i rzeczywistą historię nawigacji hosta. |
| UX-02 dodawanie/edycja | Obecny formularz sprawdza głównie nazwę; NIP może być pusty; nowa firma powstaje lokalnie. | NIP wymagany, błąd przy polu, blokada zapisu, ta sama walidacja po stronie serwera i bazy. |
| UX-03 duplikat | Obecne sprawdzenie po równej nazwie nie odpowiada decyzji o NIP-ie. | Inline nazwa/NIP istniejącej firmy; właściwe CTA z §1.4; zachowany kontekst katalogu/pipeline’u także po konflikcie współbieżnym. |
| UX-04 dodanie do procesu | Obecny assign wybiera pierwszy etap automatycznie. | Jawny wybór etapu przed zatwierdzeniem, także po wybraniu istniejącego dostawcy z formularza. |
| UX-05 kategorie | Kategorie na karcie i katalogu mają odrębny lokalny stan; brak wymogu kategorii na karcie w eligible. | Dwie jawne relacje i odrębne sekcje Karty; dodanie do procesu nie zmienia tagów na karcie. |
| UX-06 firma zajęta w „Dostawcach” | Eligible filtruje firmy już przypisane do tego typu; brak pełnej komendy transferu. | Odmowa zwykłego drugiego przypisania oraz dialog jawnego transferu obecny→nowy proces/etap; wynik zero/jedno aktywne. |
| UX-07 usunięcie zajętego etapu | savePipeline odmawia z komunikatem o wcześniejszym przeniesieniu firm. | Dialog z liczbą firm, wyborem celu i CTA „Przenieś 4 firmy i usuń etap”; anulowanie prowadzi do ręcznego rozdzielenia na tablicy; konflikt wymaga ponownego potwierdzenia. |
| UX-08 archiwizacja | Brak kompletnego trwałego cyklu życia w modelu lokalnym. | Dialog skutków i liczby przypisań, filtr archiwalne, karta historyczna, jawne przywrócenie bez auto-przypisań. |
| UX-09 karta z wielu miejsc | onOpenSupplier przekazuje nazwę i tworzy nowy klucz instancji. | Stały supplierId i ten sam snapshot/version z API; powrót do poprzedniego filtra/tablicy, nie nowa firma na podstawie nazwy. |
| UX-10 ADP | Stały status/daty w demonstratorze; publiczny UI ma fallback „Brak ADP”. | Stany §1.8, ze szczególnym rozdzieleniem MISSING i UNKNOWN; bez demonstracyjnych dat i sukcesów. |
| UX-11 loading/error/conflict | Makieta ma lokalne scenariusze, nie dowodzi odmowy API. | Loading, pusty katalog/tablica, brak wyników, błąd/retry, 409 z zachowaniem szkicu, odmowa i utrata sesji bez cudzych danych. |
| UX-12 dostępność i rozmiary | Istnieją kanoniczne prymitywy, globalna nawigacja i theme owner; podgląd źródłowy jest demonstratorem. | PL/EN, light/dark, 390/768/1440/2560 px, klawiatura/focus/dialog; zmiana etapu dostępna także przez select, bez wymogu drag-and-drop. Ochrona niezapisanych zmian i brak drugiego AppShell/asystenta. |

**Kwalifikacja trzech osi i reuse:** UI kompozycji v1 oraz docelowe zachowania UX-01–12 są propozycją PRODUKT do przyjęcia wraz z tą Kartą. Dane demonstracyjne i dotychczasowe lokalne operacje pozostają SYMULACJA; inspektory, scenariusze, delivery registry i panele projektowe pozostają TYLKO PROJEKT. Dopuszczenie kontenera nie dopuszcza wszystkich potomków ani dodatkowych zakładek.

Centralna biblioteka została odczytana: projekt 460628300646219776, komponent 460628347660177408, rewizja 470946417440075776. W obu projektach są lokalne pliki CanonElements/CanonHeader/tokenów; porównane pliki nie są identyczne. Obecny source-contract pakietu jawnie zapisuje PINNED_PROVENANCE_NO_AUTOMATIC_SYNC. **Nie potwierdzono automatycznego live binding między projektami MagicPath.** Tę różnicę zachowujemy jako znane ograniczenie narzędziowe, nie maskujemy metadanymi.

E2 ma użyć jednej rzeczywistej implementacji prymitywów i tokenów w publicznym pakiecie konsumowanym przez hosta, z przypiętym pochodzeniem i kontrolowanym przyjęciem zmian kanonu. Nowe kompozycje/dialogi wymagają kwalifikacji i właściwej kanonizacji przed transferem. Nie tworzyć niezależnej drugiej biblioteki. Jeżeli obowiązujący proces wymaga mechanizmu współdzielenia niedostępnego dla konkretnego wzorca, zatrzymać jego transfer i przedstawić konkretną różnicę; nie deklarować automatycznej synchronizacji. W tej rewizji nie zmieniano canvas ani kodu produktu.

## 2. Discovery, fakty i wybór rozwiązania

### 2.1. Fakty z aktualnych materiałów

| Źródło na sprawdzonym main | Potwierdzone znaczenie / ograniczenie |
| --- | --- |
| Canon/v1.0-srm-business-capability-canon.md, CAP-001/003/005/008 | Jedna tożsamość dostawcy; kontrolowana taksonomia; odrębne ADP i oceny; opiekun relacji. Kierunek capability nie dowodzi jej implementacji. |
| apps/srm/db/migrations/0001_xray_foundation.sql | srm.suppliers ma PK (organization_id,id), dopuszcza NIP lub KRS, ma unikalny NIP per organizacja i złożone FK. To punkt reuse, nie zgoda na globalne NOT NULL NIP dla wszystkich dawnych funkcji. |
| apps/srm/db/private-store/README.md | Prywatny store ma jawne instalacje/adopcje, FORCE RLS, ograniczone role i zamknięte nieprzyjęte powierzchnie. Kolejna migracja wymaga własnego przyjęcia; nie dopisuje się jej do 18 niezmiennych migracji bazowych. |
| apps/srm/src/server/db.ts | Kontekst organizacji i natywnej transakcji jest związany z uprawnionym wykonaniem; nie ma prawa otworzyć dowolnej puli ani pożyczyć scope’u X-Ray dla nowego zapisu katalogu. |
| apps/srm/src/server/xray-lookup.ts, validateXrayRequest | Usuwanie whitespace/myślników, 10 cyfr, suma kontrolna z wagami 6,5,7,2,3,4,5,6,7, odrzucenie reszty 10. |
| packages/platform-contracts/src/organisation-profile.mjs, normalizePolishNip | Istnieje czysta normalizacja/walidacja NIP-u, w tym odrzucenie powtarzanej jednej cyfry. Reuse przez publiczny kontrakt/pure adapter; bez importowania ciężkiego kodu providerów do UI. |
| packages/srm-adp-ui/src/types.ts, source-contract.json, README.md | AdpWorkspace 1.0.0 to PRESENTATION_ONLY / LOCAL_STATE. Nie zawiera katalogu/pipeline backendu ani autorytatywnego statusu ADP. |
| apps/sg-runtime/components/appshell/adp-module-host.tsx i lib/appshell/adp-local-model.ts | SG2 hostuje pakiet i lokalne reakcje; wymaga jawnej adopcji nowego kontraktu, nie włączenia sieci pod starą obietnicą v1. |
| packages/platform-contracts/src/operation-context.mjs | Istnieją supplier.assignment.read/write, feature supplier_workspace. Sam wpis nie przyjmuje pełnego katalogu, nowych zasobów ani dowolnego SQL; unknown operations są DENY. |
| apps/srm/src/server/peer-xray-presentation.ts i xray-presentation.ts | Jest wzorzec jawnego peer entry i przekazania oryginalnego zweryfikowanego requestu. Nie kopiować tożsamości/ALLOW ani nie rozbudowywać portu X-Ray o cudzą operację bez adopcji. |
| apps/srm/deployment/private-runtime-targets.json | Wskazuje kandydata istniejącego prywatnego Development: platform_private / schema srm, spring-bread-28217539, br-sparkling-term-b99l107x; statusy historyczne, nie świeży dowód aktywacji. |
| Canon/registries/srm-environment-topology-v1.json | Zachowuje także historyczny application store srm_app. Nie wolno utożsamić go z platform_private, bazą PMOS ani wydzielonym środowiskiem właściciela PORR. |

**Nie potwierdzono w tej konsultacji:** aktualnego stanu instalacji i grantów nowych operacji, live bindingu nowych zasobów, rzeczywistej zawartości bazy produktu, źródła metadanych ADP ani własności PORR nad dedykowanymi zasobami. Te fakty są warunkami rzeczywistego uruchomienia, a nie wpisami SUCCESS w projekcie.

### 2.2. Rekomendacja architektoniczna i alternatywy

**Wybrany do akceptacji wariant:** rozszerzenie istniejącego SRM jako producenta danych i operacji, istniejącego publicznego pakietu ADP jako UI oraz istniejącego AppShell SG2 jako konsumenta. Jedna tożsamość supplierId, osobne relacje kategorii i uczestnictw, wersjonowany kontrakt, istniejące Identity/E1/Access i ograniczone transakcje.

Rozważono:
- zachowanie lokalnego modelu: małe zmiany, ale nie spełnia trwałości, współpracy ani izolacji;
- drugi katalog/backend w SG2: dubluje tożsamość i reguły oraz narusza ownership SRM;
- nowa aplikacja/pakiet/usługa/SaaS CRM: zwiększa integrację i przenoszenie danych bez potrzeby biznesowej; nieuzasadnione przy istniejących granicach;
- rozszerzenie SRM i publicznego mountu: najmniej nowych granic, reuse NIP/identity/tenant modelu i zgodność z zatwierdzonym flow.

Nie wyprowadza się logiki procesu do MagicPath, do przeglądarki ani do SG2. Nie zmienia się SRM Standalone wyłącznie z powodu sposobu osadzenia w AppShell; wspólne UI używa jawnego wariantu hosta.

## 3. Checklista BSDC v1.1 — wszystkie 29 kryteriów

| ID | Kryterium | Status | Ustalenie / dowód |
| --- | --- | --- | --- |
| A1 | Potrzeba użytkownika | USTALONE | §1.1: jedna wiedza o dostawcy i procesach zamiast historii rozproszonej. |
| A2 | Odbiorcy, kontekst, owner | USTALONE | Kupcy/uprawnieni członkowie organizacji; PORR jako pierwszy odbiorca; tomasz@profitia.pl; SRM prowadzi, SG2 hostuje. |
| A3 | Sprawdzalny efekt i sukces | USTALONE | FINAL-01–10; E1 trwały kontrakt i dwa konta + obca organizacja; E2 pełny AppShell na Development. |
| A4 | Priorytet i granice | USTALONE | Rdzeń katalog/karta/dwa typy procesów i odczyt statusu ADP; wyłączenia §1.2. Brak domyślnej adopcji całej makiety. |
| B1 | Istniejące funkcje i kontrakty | USTALONE | Wąskie discovery §2.1, model srm.suppliers, prywatny store, walidatory, pakiet UI, host i Operation Context. |
| B2 | Fakty vs hipotezy/luki | USTALONE | Rozdzielono ACTUAL źródeł, projektowane zachowanie i niepotwierdzone live instalacje/ADP/PORR/binding. |
| B3 | Reuse/extension/integration/new | USTALONE | Cztery warianty §2.2; preferencja rozszerzenia istniejących zdolności. |
| B4 | Wybór i uzasadnienie | USTALONE | SRM producer + publiczny pakiet ADP + SG2 adapter; brak nowego mastera, runtime’u i źródeł płatnych. |
| C1 | Scenariusz end-to-end | USTALONE | §1 i UX-01–12: wejście, katalog, duplikat, karta, wybór etapu, niezależne procesy, ponowny odczyt i odmowy. |
| C2 | Dane, walidacje, edge cases | USTALONE | §1.3–1.8 i §4: NIP obowiązkowy, edycja/race, archiwalne NIP-y, CAS, transfer, stage removal, retry i ADP UNKNOWN. |
| C3 | v1 i wyłączenia | USTALONE | §1.2 i §4.5: bez pełnej ankiety/dokumentów i dodatkowych modułów; poufne treści wymagają osobnego zakresu. |
| C4 | UX/MagicPath/stany/kwalifikacja | USTALONE | §1.9: źródła i podgląd pinned, macierz zmian i trzy osie; wymagania responsywności. Brak automatycznego bindingu jest jawny; wdrożeniowa zgodność i transfer mają własne DoD E2, nie są deklarowane jako wykonane. |
| C5 | Odbiór funkcjonalny | USTALONE | FINAL-01–10, dane §5.1, live/API/DB i dwa etapy odbioru §5.2; demo nie jest dowodem persystencji. |
| D1 | Profile, ownerzy, granice | USTALONE | SRM domena/API/UI, SG2 AppShell/BFF, ARCHITECTURE wspólny dostęp. Oddzielne taski/continuity ownerów. |
| D2 | Routing i Code State | USTALONE | §4.1: resolver wszystkich proponowanych exact paths RESOLVED/ALIGNED/ALLOWED w ich właściwych profilach; aktualny main f8a422fe88cc0a6166a6401c7238803ec5c44761. |
| D3 | Drzewo monorepo | USTALONE | §4.1: ISTNIEJE/ROZSZERZENIE/NOWY–PROPOZYCJA, ownerzy, brak nowej aplikacji; przyszłe przyjęcie capability/dostępu nie jest domniemane z routingu. |
| D4 | Kontrakty i przepływ danych | USTALONE | §4.2–4.4: srm.supplier-pipelines/1.0.0, UI 2.0.0, DTO/komendy/błędy/CAS/idempotencja i autoryzowany peer. |
| D5 | Własność, prywatność i dostęp | USTALONE | §1.6, §4.3/4.5: organisation-private, RLS/kompozytowe FK/bounded SQL, równi członkowie przez jawne operacje; docelowy PORR owner boundary odróżniony od Dev i shared knowledge. |
| D6 | Środowisko, zasoby, monitoring/recovery | USTALONE | §4.5 i §5.3: Development, istniejący prywatny binding do rewalidacji, bez nowych zasobów; LKG, recovery, role, prywatne logi i brak customer content. |
| E1 | Krótkie etapy rezultatowe | USTALONE | Dwa etapy: działający SRM/kontrakt, następnie działający scenariusz AppShell. |
| E2 | Co działa po etapach | USTALONE | §5.2: konkretne wyniki, pięć tasków E1 i trzy E2, API/dane oraz późniejszy pełny UI. |
| E3 | Zależności, mandaty, ownerzy | USTALONE | Własne profile i dostępy, uzgodnione Development, osobny start każdego etapu, gates danych/operacji/release i warunki STOP. |
| E4 | Testy i dowody | USTALONE | §5.1–5.2: dane dwóch org, równoczesne zapisy, atomic rollback, dwa realne konta, direct API foreign tenant, zwykła rola DB i pełny E2E. |
| E5 | Koszt, ryzyko, czas | USTALONE | §5.3: brak zewnętrznych płatnych wywołań/nowych zasobów w bazowym planie; jawne niewycenione hosting/czas, krytyczna ścieżka i warunki nowej decyzji zamiast fikcyjnych dat lub kwot. |
| E6 | Roadmapa i rejestr w tej Karcie | USTALONE | §5 zawiera FINAL-*, wszystkie etapy/taski, ownerów, środowiska, DoD, dowody, zależności, osobne mandaty i statusy. Brak osobnego planu. |
| F1 | Decyzje i niepewności | USTALONE | Rejestr §6; nowsze decyzje jawnie zastępują dawne otwarte opcje. Braki live i rekomendacje nie są ukryte. |
| F2 | Spójny pakiet A–E | USTALONE | Projekt zachowuje istniejące granice; nowe operacje i kontrakty opisane jako wymagające przyszłego przyjęcia. Nie rozszerza po cichu presentation-only 1.0.0. |
| F3 | Łączna akceptacja i rewizja | W_TRAKCIE | Ta rewizja przedstawia kompletny projekt i roadmapę do łącznej akceptacji. Brak decyzji właściciela i zamrożonego commitu obu części. |
| F4 | Handoff do etapów | USTALONE | §8: źródła, E1-T01–T05/E2-T01–T03, brak mandatów, aktualizacja jednej Karty, rozliczenie/STOP i aktywne wrappery. |

**Stan A–F: A=USTALONE, B=USTALONE, C=USTALONE, D=USTALONE, E=USTALONE, F=W_TRAKCIE (F3). 28 kryteriów opisanych jako USTALONE, 1 oczekuje decyzji właściciela.** Odbiór funkcji i wykonanie roadmapy nadal nie zostały rozpoczęte.

## 4. Architektura, model danych i kontrakt SRM–SG2

### 4.1. Drzewo monorepo i routing

Authority discovery: profitia/SG-dev/main, f8a422fe88cc0a6166a6401c7238803ec5c44761. Istnienie katalogów i plików ustalono z Git tree i odczytu źródeł. NOWY–PROPOZYCJA nie oznacza utworzenia pliku.

    SG-dev/
    ├── Canon/
    │   ├── proposals/bsdc/SRM/supplier-category-pipelines.md    [ISTNIEJE / ta Karta / Governance]
    │   └── registries/operation-access-matrix-v1.json           [ISTNIEJE / ROZSZERZENIE wspólnego kontraktu]
    ├── apps/srm/                                              [ISTNIEJE / SRM Runtime / profil SRM]
    │   ├── app/api/adp/v1/[...segments]/route.ts                [NOWY–PROPOZYCJA / adapter HTTP]
    │   ├── src/server/
    │   │   ├── supplier-pipelines-contract.ts                   [NOWY–PROPOZYCJA / schemat wire i walidacja]
    │   │   ├── supplier-pipelines-domain.ts                     [NOWY–PROPOZYCJA / przypadki użycia]
    │   │   ├── supplier-pipelines-store.ts                      [NOWY–PROPOZYCJA / port ograniczonej transakcji]
    │   │   ├── supplier-pipelines-http.ts                       [NOWY–PROPOZYCJA / kontroler autoryzowanych operacji]
    │   │   ├── supplier-adp-status.ts                           [NOWY–PROPOZYCJA / odczytowy port statusu]
    │   │   └── db.ts                                           [ISTNIEJE / reuse granicy, bez fallbacku]
    │   ├── db/private-store/supplier-pipelines-v1.sql           [NOWY–PROPOZYCJA / jawnie przyjmowana migracja]
    │   └── deployment/supplier-pipelines-targets.json            [NOWY–PROPOZYCJA / binding, bez sekretów]
    ├── packages/srm-adp-ui/                                   [ISTNIEJE / SRM Runtime / profil SRM]
    │   ├── src/pipelines-contract.ts                           [NOWY–PROPOZYCJA / publiczne DTO i props]
    │   ├── src/pipelines-workspace.tsx                         [NOWY–PROPOZYCJA / UI v1 biznesowego]
    │   ├── src/index.ts                                       [ISTNIEJE / publiczny eksport]
    │   └── source-contract.json                               [ISTNIEJE / jawny nowy pin]
    ├── apps/sg-runtime/                                       [ISTNIEJE / SG Runtime / profil SG2]
    │   ├── components/appshell/adp-module-host.tsx              [ISTNIEJE / INTEGRACJA]
    │   ├── lib/appshell/adp-pipelines-client.ts                 [NOWY–PROPOZYCJA / adapter konsumenta]
    │   ├── lib/appshell/adp-pipelines-routes.ts                 [NOWY–PROPOZYCJA / route-state kontraktu]
    │   └── app/api/adp/v1/[...segments]/route.ts                [NOWY–PROPOZYCJA / jawny BFF/peer]
    ├── packages/platform-contracts/                           [ISTNIEJE / Architecture Platform / ARCHITECTURE]
    │   ├── src/operation-context.mjs                           [ISTNIEJE / bounded rozszerzenie]
    │   ├── src/supplier-workspace-access.mjs                    [NOWY–PROPOZYCJA / zasoby i operacje]
    │   ├── migrations/access/supplier-workspace-v1.sql          [NOWY–PROPOZYCJA / jawna adopcja Work/Access]
    │   └── test/supplier-workspace-access.test.mjs              [NOWY–PROPOZYCJA / granice bezpieczeństwa]
    └── .github/workflows/
        ├── srm-ci.yml                                         [ISTNIEJE / SRM / rozszerzenie testów]
        └── srm-adp-ui-ci.yml                                   [ISTNIEJE / SRM / rozszerzenie kontraktu]

Weryfikacja aktualnym resolverem objęła **wszystkie 24 wymienione w planie dokładne target paths** odpowiednio w SRM, SG2 i ARCHITECTURE: RESOLVED / ALIGNED / ALLOWED, bez NO_MATCH/CONFLICT. Grupowe wyniki:
- Karta i macierz: SG2-BASE-019 / Governance Source Layer; mutacja Karty SRM dozwolona, zmiana wspólnej macierzy jest osobnym zadaniem właściwego producenta.
- apps/srm: SG2-BASE-016 / SRM Runtime / SRM only.
- pakiet ADP: SRM-ADP-BASE-001; CI pakietu SRM-ADP-BASE-002 / SRM only.
- srm-ci.yml: SG2-BASE-017 / SRM only.
- apps/sg-runtime: SG2-BASE-001 / SG Runtime / SG2 only.
- packages/platform-contracts: ARCH-BASE-001 / Architecture Platform / ARCHITECTURE only.

ALIGNED jest stanem ścieżki; ACTUAL oznacza ustalone fakty źródeł. Nie nadaje to uprawnień do nowej operacji, migracji, zmiany polityki lub deploymentu. Reuse istniejących ownerów nie jest rejestracją nowego first-class runtime’u. Dla nowych wymaganych testów/plansz/migracyjnych wpisów instalatora exact paths i źródła wymagają ponownego resolvera przed zmianą; nie udziela się zapisu wildcardem do całego repozytorium. Nazwa SQL nie dopisuje pliku do zamkniętej listy instalacji — jawne włączenie, digest i receipt są częścią E1-T02/T03.

Jedyna mutacja bieżącego zadania to ta Karta w PR #1123. Równoległe zmiany main dotyczyły innych zadań; nie są cofaniem ani częścią tej inicjatywy. Przed każdym przyszłym źródłowym taskiem odświeżyć main, otwarte PR i konflikty jego exact paths; techniczna zmiana nazwy nowego pliku nie zmienia zakresu business DoD, lecz wymaga jawnej aktualizacji routingu/planu w Karcie.

### 4.2. Model danych — reuse tożsamości i odrębne relacje

Nazwy nowych tabel poniżej są projektem, nie potwierdzeniem instalacji.

| Encja | Projekt kluczy i odpowiedzialność |
| --- | --- |
| srm.suppliers — ISTNIEJE | Master tożsamości w organizacji: (organization_id,id), istniejąca unikalność (organization_id,nip). NIP nowego zapisu katalogu jest znormalizowany i poprawny. Nie tworzyć równoległej tabeli firm w SG2. |
| srm.supplier_workspace_profiles — NOWA | Rozszerzenie 1:1 mastera w organizacji: kontakty, relationshipOwnerAccountId lub null, wersja, archivedAt, autor/czasy. Sam GET nie tworzy profilu. Dane bazowe mastera pozostają jednym rekordem. |
| srm.supplier_categories — NOWA | Słownik organizacji: categoryId, displayName, normalizedName, version, archivedAt. Unikalna nazwa znormalizowana również wśród archiwalnych; przy kolizji wskazanie istniejącej kategorii/przywrócenia. |
| srm.supplier_category_links — NOWA | Jawne przypisania kategorii na karcie: organizacja, supplierId, categoryId, początek/koniec. Brak zależności od uczestnictwa w procesie. |
| srm.supplier_pipelines — NOWA | Organizacja, pipelineId, kind SUPPLIER/CATEGORY, name, categoryId tylko dla CATEGORY, version, lifecycle. Kilka pipeline’ów może mieć ten sam categoryId. |
| srm.supplier_pipeline_stages — NOWA | Organizacja, pipelineId, stageId, name, order, deletedAt; wersjonowana konfiguracja. Historyczne identyfikatory nie są usuwane z audytu. |
| srm.supplier_pipeline_memberships — NOWA | Organizacja, membershipId, supplierId, pipelineId, kind związany FK z pipeline’em, stageId, version, startedAt, endedAt, endReason. Zakończone rekordy zachowane. |
| srm.supplier_workspace_events — NOWA | Organizacyjny, dopisywalny ślad zdarzeń: actorAccountId, commandId, obiekt, zmiana wersji, stare/nowe referencje, occurredAt. Bez payloadów poufnych ankiet, sekretów i logów innych organizacji. |
| AdpStatusSnapshot — PROJEKCJA, nie repozytorium dokumentów | Tylko dozwolone metadane z §1.8; brak tabeli binarnych dokumentów, pełnego formularza i nowej kopii źródła ADP w tym zakresie. |

**Istniejące rekordy KRS-only:** NIP nie staje się globalnym NOT NULL w srm.suppliers, ponieważ obecny X-Ray dopuszcza także tożsamość KRS. W v1 katalogu nowa firma i jej nowe przypisanie wymagają poprawnego NIP-u. Starsze rekordy bez NIP-u nie są automatycznie kasowane, scalane, otrzymywane z losowym NIP-em ani przerabiane na nową firmę. Poprawny istniejący NIP w masterze oznacza reuse tego samego supplierId, także gdy brak jeszcze profilu workspace. Niedopuszczone starsze rekordy wymagają jawnego uzupełnienia, zanim uczestniczą w nowym procesie.

**Twarde niezmienniki bazy i transakcji:**
- Każdy klucz/filtrowanie/kompozytowy FK nowych tabel zawiera organization_id; stageId musi należeć do wskazanego pipelineId, a wszystkie końce relacji do jednej organizacji.
- FORCE RLS i zwykłe role bez BYPASSRLS/owner/superuser; granica dostępu jest związana z bieżącym, przyjętym requestem i transakcją. Samo ustawienie dowolnego GUC z organizacją nie daje uprawnienia do cudzych danych.
- Runtime dostaje wyłącznie potrzebne bounded entry points, bez ogólnego dostępu do tabel, CREATE, migracji, kontroli grantów lub technicznego audytu.
- Unikalny NIP per organizacja zostaje ostateczną ochroną race. Walidację checksum dla nowych zapisów katalogu wykonuje również kontrolowany writer bazy, nie tylko UI.
- Aktywne uczestnictwo to endedAt=null w aktywnych obiektach. Unikalność (organizacja,pipelineId,supplierId) dla aktywnych blokuje duplikat w konkretnym procesie.
- Dodatkowa unikalność (organizacja,supplierId) dla kind=SUPPLIER i aktywnego rekordu gwarantuje **zero lub jedno aktywne przypisanie** niezależnie od liczby pipeline’ów tego typu. Kind musi być związany z definicją procesu, nie swobodną wartością z body.
- Funkcje bazy sprawdzają aktywność firmy/pipeline’u/celu, expectedVersion i referencje; transakcje transferu, archiwizacji i usunięcia etapu mają wspólną kontrolę dostępu oraz atomowy commit/rollback z historią.
- Unikat/funkcja nie mogą zwracać nazw ani ID cudzej organizacji w komunikatach. Foreign key do obcej organizacji jest odmową bez częściowego zapisu.
- Usuń/archiwizuj nie oznacza DELETE CASCADE mastera ani niszczenia dawnych raportów SRM. Bez regresji istniejących providerów i X-Ray.

### 4.3. Kontrakt producent–konsument i autoryzacja

**Propozycja wersji do akceptacji:**
- HTTP/domain: contractId **srm.supplier-pipelines**, contractVersion **1.0.0**, projectionVersion **1**.
- Publiczny UI @profitia/srm-adp-ui: **2.0.0** z nowym publicznym SupplierPipelinesWorkspace i typami w pipelines-contract.ts. Dotychczasowy AdpWorkspace/kontrakt 1.0.0 nie otrzymuje po cichu transportu lub persystencji.
- UI pozostaje prezentacyjne: host dostarcza snapshoty, locale/theme, bezpieczną nawigację i kontrolowane callbacks async; stan zapisu pochodzi z serwera. Pakiet nie dostaje sekretów, bezpośredniego DB, własnej tożsamości/routera/assistant ani ukrytego localStorage jako źródła prawdy.
- SRM publikuje schemat i kontraktowe przykłady; SG2 przypina dokładną przyjętą wersję i sourceDigest/receipt. Nie używa moving latest ani prywatnych importów z apps/srm.
- Zmiana wymaganych pól, znaczenia statusu lub autoryzacji jest zmianą kontraktu. Niezgodna wersja daje jawny brak zgodności, nie przejście do symulacji.

**Przepływ:** zweryfikowana sesja członka → SG2 AppShell/BFF → jawnie skonfigurowany peer SRM → bieżąca weryfikacja oryginalnej tożsamości/organizacji i operacji → kontrolowana transakcja SRM → dozwolony snapshot/version → publiczny UI. Bez bezpośredniego czytania bazy SRM przez SG2. Host nie wybiera backendu na podstawie URL-u dostarczonego przez klienta.

Wzorzec peer może być rozszerzeniem istniejącej publicznej granicy po jej własnym przyjęciu, ale **nie** pożyczaniem operacji X-Ray lub kopiowaniem z niej ALLOW/identity proof. W każdym requestcie odbiorca potwierdza aktora, scope, rights i aktualne odwołania. Dla SERVICE zachowuje prawdziwego wykonawcę i onBehalfOf użytkownika. Same nagłówki x-user/x-org, branding PORR, email i nazwa roli nie są autoryzacją. Mutacje sesji cookie mają ochronę CSRF/origin zgodną z hostem.

| Rodzina operacji | Do przyjęcia przez właściwego producenta | Zakres |
| --- | --- | --- |
| Katalog/karta | supplier.catalog.read / supplier.catalog.write — NOWE, wymagają jawnej adopcji | Odczyt/walidowane tworzenie/edycja/archiwizacja/przywrócenie organizacyjnej firmy. |
| Słownik i kategorie na karcie | supplier.category.read / supplier.category.write — NOWE | Nie utożsamiać z kategoriami benchmarków SG2; brak modyfikacji globalnej taksonomii. |
| Procesy i etapy | supplier.pipeline.read / supplier.pipeline.write — NOWE | Definicja, zmiana/archiwizacja, etap i atomowe przeniesienie jego firm. |
| Uczestnictwo/transfer | supplier.assignment.read / supplier.assignment.write — reuse z rozszerzonym, przyjętym dowodem zasobu | Payload wiąże supplierId/pipelineId/stageId i zakres; obecny wpis nie nadaje automatycznie nowych efektów SQL. |
| Status ADP | supplier.adp-status.read — NOWE | Minimalne metadane, bez uprawnienia do treści dokumentów lub ich eksportu. |

Rodziny te korzystają z istniejącego Operation Context/Access, macierzy, Work/SQL i autorytatywnego membership/product admission. **E1-T02** ma przyjąć konkretną wersję operacji, mapowanie feature/resource/dataClass i ograniczone funkcje w istniejącej warstwie ARCHITECTURE. Oznaczenie ich tutaj nie aktywuje ich w Root, nie tworzy wildcardu, trwałego grantu ani nowej polityki komercyjnej.

Przyjęta polityka biznesowa ma zapewnić identyczny zestaw tych operacji wszystkim aktualnie uprawnionym członkom organizacji w tej funkcji, z tymi samymi ograniczeniami. Nadal obowiązują jawne DENY, utrata membership, wygaśnięcie dostępu i zgoda na konkretny produkt/funkcję. Jeśli bieżące granty tego nie realizują, wymagane jest odpowiednie przyjęcie przez ownera; nie wstawia się allow=true w SG2.

### 4.4. Schemat wire, komendy, błędy i spójność

| Typ | Wymagane znaczenie pól |
| --- | --- |
| SupplierCard | supplierId, nipNormalized, displayName, contacts[{contactId,name,role,email,phone}], relationshipOwner{accountId,displayName,state} lub null, cardCategories[], memberships[], adp, lifecycle, version, updatedAt. Braki są jawne, nie zastępowane danymi demonstracyjnymi. |
| Category | categoryId, name, lifecycle, version; wybór wyłącznie w katalogu organizacji. |
| Pipeline | pipelineId, kind, name, categoryId dla CATEGORY, stages[{stageId,name,order}], activeCount, lifecycle, version. |
| Membership | membershipId, supplierId, pipelineId, stageId, kind, version, startedAt, endedAt/endReason; historia zawiera dawne nazwy/wartości potrzebne do odczytu. |
| AdpStatusSnapshot | status UNKNOWN/MISSING/CURRENT/OUTDATED/RENEWAL_REQUIRED; confirmedAt/asOf, validUntil i signedAt opcjonalne; dozwolony sourceLabel/projectionVersion. Brak dowodu → UNKNOWN. Brak treści dokumentu i prywatnego source URL w UI. |
| Mutation | contractVersion, idempotencyKey, expectedVersion właściwych agregatów, typed command. Actor/org/environment nie są autorytatywnym inputem użytkownika. |
| Success | contractId/version, requestId, serverTime, wynik i aktualne version; sukces dopiero po commit. Odpowiedź zbiorczej operacji zawiera movedCount i skuteczne wersje. |
| Error | code, message, fieldErrors opcjonalnie, requestId, retryable. existingSupplier zawiera supplierId/name/lifecycle tylko dla aktualnej organizacji i bieżącego dostępu. Brak surowych SQL, grantów, tokenów i cudzych metadanych. |

Baza REST producenta: **/api/adp/v1**; odpowiadający jej ograniczony BFF SG2 ma to samo wersjonowane znaczenie, nie jest drugim producerem.

| Endpoint / metoda | Skutek i niezbędna walidacja |
| --- | --- |
| GET /suppliers?q=&categoryId=&lifecycle=&cursor= | Lista tenant-scoped; wyszukiwanie NIP po normalizacji, nazwy jako wyszukiwanie nie deduplikacja. Kategoria to przypisanie na karcie. |
| GET /suppliers/by-nip?nip= | Lookup wyłącznie w organizacji, także archiwalne; brak wyniku nie dowodzi nic o innych organizacjach. |
| POST /suppliers | Wymagany poprawny NIP i nazwa, optional kontakty/kategorie/opiekun; 201 po zapisie albo 409 DUPLICATE_NIP z existingSupplier. |
| GET /suppliers/{id}; PATCH /suppliers/{id} | Ta sama karta; edycja CAS i walidacja własnego/nowego NIP-u; zero automatycznego merge. |
| POST /suppliers/{id}/archive lub /restore | Reguły §1.7, expectedVersion; archiwizacja z zamknięciem przypisań atomowo. |
| GET/POST /categories; PATCH /categories/{id}; POST …/archive lub …/restore | Kontrolowany słownik, nazwy unikalne po normalizacji w organizacji, prawa operacji. |
| PUT/DELETE /suppliers/{id}/categories/{categoryId} | Jawne przypisanie/odpięcie kategorii na karcie z CAS; DELETE tu kończy relację, nie kasuje słownika ani procesów. |
| GET/POST /pipelines; GET/PATCH /pipelines/{id} | Rodzaj/kategoria/nazwa/etapy; kontrola wersji, co najmniej jeden etap; brak zmiany użytej kategorii/typu. |
| POST /pipelines/{id}/archive lub /restore | Zbiorczy skutek §1.7; dostawcy i inne procesy pozostają. |
| POST/PATCH /pipelines/{id}/stages | Jawne dodanie, nazwy i kolejność w jednej wersji konfiguracji. |
| POST /pipelines/{id}/stages/{stageId}/remove | targetStageId obowiązkowy przy zajętym etapie, expectedPipelineVersion i expectedCount; komenda z §1.7, jedna transakcja. |
| POST /pipelines/{id}/memberships | supplierId i jawnie wybrany stageId; kategoria na karcie nie jest warunkiem; ponowne uczestnictwo nie powiela aktywnego wiersza. |
| PATCH /memberships/{id} | Zmiana etapu tylko w tym pipeline’ie, CAS; aktualność celu i zakresu. |
| POST /memberships/{id}/end | Jawne zakończenie uczestnictwa bez archiwizacji firmy. |
| POST /supplier-pipeline-transfers | supplierId, sourceMembershipId/sourceVersion, targetPipelineId/targetStageId i expectedTargetVersion; dwa różne aktywne pipeline’y SUPPLIER tej samej organizacji; zamknięcie/utworzenie atomowe. |
| GET /suppliers/{id}/pipeline-history | Historia domenowa w organizacji; bez ogólnego technicznego audytu i bez cudzych danych. |
| GET /suppliers/{id}/adp-status | Reguły §1.8; jawne UNKNOWN jest wynikiem, nie fałszywym „brakiem dokumentu”. |

Listy i historie używają stabilnego cursor pagination, domyślnie 50 i maksymalnie 100 rekordów odpowiedzi; tablica ma rzeczywiste liczniki i możliwość doładowania, bez cichego pomijania firm. Wielkie pola/wartości i schema input mają jawne limity kontraktu; brak arbitralnego SQL/URL z przeglądarki.

**Kody:** 422 NIP_REQUIRED/INVALID_NIP/FIELD_INVALID; 409 DUPLICATE_NIP, ACTIVE_SUPPLIER_ASSIGNMENT_EXISTS, VERSION_CONFLICT, PIPELINE_CHANGED, IDEMPOTENCY_CONFLICT, LAST_STAGE, RECORD_ARCHIVED; 401 brak ważnej tożsamości; 403 brak operacji; 404 obcy/niewidoczny zasób bez potwierdzania jego istnienia; 503 prawdziwa niedostępność core. Dla samego niedostępnego źródła ADP karta pozostaje dostępna z UNKNOWN. Klient nie traktuje 409 jako ogólnego błędu sieci.

**Zakończenie żądania i bezpieczeństwo efektu:** bieżące prawa i scope sprawdzane także na granicy rzeczywistego skutku; unieważnienie nie może być obchodzone starym cache lub retry. Audyt techniczny używa przyjętego hosta, a domenowy event powstaje w transakcji z operacją. Zerwane połączenie po COMMIT nie może utworzyć drugiego skutku. Brak aktualnego dostępu przy odczycie starego wyniku idempotentnego nadal daje odmowę.

### 4.5. Miejsca zapisu, prywatność i docelowa granica PORR

**W v1 Development:** domenowe dane testowych organizacji zapisuje SRM w istniejącym, osobno zweryfikowanym prywatnym store produktu z właściwym bindingiem i rolą. Wskazany w source metadata kandydat to platform_private / schema srm z private-runtime-targets.json. E1 ma potwierdzić jego bieżący stan, source receipts, role i uprawnienia przed jakąkolwiek instalacją. Źródłowe „SCHEMA_PREPARED_APPLICATION_DISABLED” z 2026-10-17 nie jest aktualną informacją o działaniu.

Nie zapisujemy danych domeny do srm_pmos, do bazy SG2, do shared corporate knowledge ani do GitHuba. GitHub przechowuje projekt i sanitizowane dowody, nie dane klientów. Nie przechodzimy na legacy srm_app/demo tylko dlatego, że nowy prywatny port nie jest gotowy. Jeśli rewalidacja zasobu/grantów/okna/recovery się nie powiedzie, zależny task E1 pozostaje ZABLOKOWANY.

**Docelowo poufna treść ADP i dokumenty PORR — rekomendacja w nawiązaniu do wcześniejszej konsultacji:**
- PORR kontroluje instancje, dane, pliki, backupy, uprawnienia i operacje. Relacyjna poufna treść oraz metadane dokumentów trafiają do oddzielnego środowiska danych pod jego kontrolą; pliki do jego object storage, np. Azure Blob. Wcześniej rozważany PORR-owned Neon/PostgreSQL albo środowisko Azure pozostają wariantami fizycznymi tej samej granicy, nie utworzonymi zasobami.
- Wymóg „bez kopii i bez dostępu operatora SpendGuru” wymaga także kontroli PORR nad runtime’em przetwarzającym poufne dane, sekretami/kluczami, wdrożeniami, logami, cache, analityką, pochodnymi i kopiami zapasowymi. Sama zmiana storage nie dowodzi braku dostępu operatora.
- Używać tej samej wersjonowanej implementacji SRM/kontraktów z tenant configuration; nie klientowego forka i nie drugiego systemu tożsamości. Dla bezwzględnego braku dostępu operatora poufny przepływ musi pozostawać w kontrolowanym przez PORR runtime/host, a nie przechodzić przez wspólny SG2 BFF.
- Do współdzielonego AppShell można przekazywać wyłącznie odrębnie dozwoloną minimalną projekcję, np. status/daty. Nie wysyła się tam poufnej treści dokumentów, surowych ankiet, załączników, tokenów storage czy podpisanych linków. Nie przekazuje się jej do CIC, PostHog, Sentry, shared cache lub publicznych dowodów.
- Obecne wpisy platform_private i rejestry SRM są zasobami technicznego Development, **nie dowodem własności lub kontroli PORR**. Wcześniejsza propozycja wydzielenia pozostawała koncepcją, a nie zgodą na provisioning/transfer danych.
- Wybór właściciela konta/chmury, zasobów i regionu, uprawnień operatorów, umów, retencji i odzyskiwania dla poufnych treści wymaga osobnej decyzji zakresowej przed ich użyciem. Ten projekt niczego nie tworzy i niczego nie kopiuje.

Granica ta **nie blokuje określonego przez właściciela odbioru v1 na reprezentatywnych danych testowych**. Przyjęcie v1 nie akceptuje realnych dokumentów PORR w ogólnym środowisku Development i nie obiecuje, że wydzielone środowisko już działa.

**Monitoring i operacje v1:** użyć istniejących adapterów/metod sanitizacji; rejestrować operation code, bezpieczny correlationId, wynik/opóźnienie i typ konfliktu. Bez nazw firm/NIP-ów/kontaktów/treści w analityce i logach błędów. Chroniony audyt operacyjny pozostaje w dozwolonym store z właściwą retencją. Sygnały to błędy zapisu, 409, odmowy i dostępność, nie surowy payload.


## 5. Roadmapa END-TO-END i rejestr wykonania — część tej samej Karty

**Baza do łącznej akceptacji: rewizja projektowa 2, §1–5 i rejestr decyzji §6.** Kolejność jest rezultatowa i obejmuje działające rozwiązanie. Oba etapy pozostają NIE_ROZPOCZĘTE. Obecne zlecenie jest wznowieniem projektowania, nie poleceniem wykonania E1.

### 5.1. Końcowy Business Definition of Done i dane odbiorowe

Wszystkie FINAL-* wymagają dowodu dla rzeczywistego source SHA, wersji kontraktu, artefaktu i konfiguracji Development. Odbiera tomasz@profitia.pl. Dowody są sanitizowane i publikowane na GitHubie przez właściwe PMOS/PHR; dane domeny nie stają się dokumentacją repozytorium.

| ID | Warunek biznesowy / test | Dowód wymagany |
| --- | --- | --- |
| FINAL-01 | Uprawniony kupiec wybiera ADP z biurka AppShell/UPShell i trafia do „Dostawcy i pipeline’y”, domyślnie katalogu. Nawigacja działa także po refresh/deep linku. | Realny scenariusz E2 na wydanym SG2 i dokładnej wersji publicznego UI/SRM. |
| FINAL-02 | Wymagany poprawny NIP: brak lub błędny NIP blokuje tworzenie i edycję przy polu. Ten sam NIP po usunięciu spacji/myślników przy różnej pisowni/skrócie/odstępach nazwy prowadzi do tej samej firmy. Edycja nie koliduje ze sobą, ale odrzuca NIP innego rekordu. Dwa równoczesne zapisy dają jeden master i kontrolowany konflikt z linkiem, bez nadpisania cudzych danych. | Walidacja UI/API/DB; dwa rzeczywiste konta + race na API; odczyt liczby i stable supplierId; oba kontekstowe CTA oraz archived duplicate. |
| FINAL-03 | Katalog i oba typy pipeline’ów otwierają tę samą Kartę przez supplierId. Identyfikacja, kontakty, opiekun lub brak, kategorie na karcie i procesy są spójne. ADP rozróżnia potwierdzone MISSING i UNKNOWN, daty tylko ze źródła; bez źródła realnie pokazuje „Brak potwierdzonych danych”. | Odczyty tej samej wersji z różnych wejść; testy projekcji known/unknown/missing; realny stan braku przyjętego źródła nie jest zastąpiony fikcyjnym ADP. |
| FINAL-04 | Firma ma **zero lub jedno aktywne przypisanie** do wszystkich pipeline’ów typu „Dostawcy”. Drugie równoległe jest odrzucone także przy wyścigu. Jawny transfer kończy stare i tworzy nowe uczestnictwo atomowo; błąd pozostawia stary stan. | Test zwykłej roli DB/API, dwóch równoległych żądań, zakończenia do zero i transferu rollback/idempotent retry; historia, brak wpływu na procesy kategorii. |
| FINAL-05 | Firma bez danej kategorii na karcie może wejść do jej procesu. Może być w „Asfalcie”, „Betonie” i drugim nazwanym procesie „Asfaltu”; raz w każdym. Zmiana etapu dotyczy tylko wybranego procesu. Zapis/odpięcie kategorii na karcie nie zmienia uczestnictw, a udział nie dopisuje tagu. | Dane przed/po i odczyt trwały po nowej sesji; realny UI E2 i kontrola w bazie/API E1. |
| FINAL-06 | Po E1 drugi uprawniony użytkownik tej samej organizacji w nowej sesji odczytuje zapis pierwszego: firmę, kategorię, pipeline, etap, opiekuna i historię. Po E2 robi to przez AppShell. Restart/nowa sesja nie odtwarza fixtures. | Dwa odrębne aktualne konta HUMAN, requestId, wersje rekordów i odczyt z właściwego store; brak kont demo/shared. |
| FINAL-07 | Konto innej organizacji nie czyta ani nie zmienia danych odbiorowej organizacji przez **bezpośrednie API**: katalog, lookup NIP, kartę, historię, kategorię, proces, etap, przypisanie, transfer i ADP-status. Podmienione referencje oraz zwykła rola SQL nie tworzą cross-tenant relacji. Ten sam NIP w katalogu własnej organizacji nie ujawnia cudzej firmy. Unieważniony dostęp jest odrzucany. | Realne konto organizacji B i bezpośrednie requesty do tego samego wydanego API; brak wycieku danych/istnienia, brak zapisu; FORCE RLS, composite FK, negatywne testy bazy i revocation. |
| FINAL-08 | Uprawnieni członkowie organizacji mają te same możliwości **operacji v1**; brak/odwołanie prawa daje odmowę. Przyjęty cykl życia zachowuje historię i referencje: archiwizacja użytych obiektów, przywrócenie bez auto-przypisań, jawne zakończenie/transfer, osobne kategorie. Stary version i powtórzony/inny digest idempotencji nie nadpisują danych. | Macierz operacja×organizacja×stan dostępu, testy archiwizacji/restoration i CAS, audyt domenowy, odmowa nieprzyjętych operacji. Nie opierać odbioru na samej nazwie roli. |
| FINAL-09 | Usunięcie zajętego etapu pokazuje liczbę i wymaga celu w tym samym procesie. „Przenieś 4 firmy i usuń etap” zapisuje całość albo nic; karty/pozostałe procesy nietknięte. Anulowanie i ręczne rozdzielenie oraz konflikt zmienionej liczby działają. UX-01–12 zachowują zaakceptowane flow, PL/EN, motyw, dostępność i responsywność. | Realne przypadki success/cancel/version conflict/rollback na API i UI; ostatni etap chroniony; screenshoty + sekwencje działań, testy klawiatury/szerokości. |
| FINAL-10 | SRM i SG2 wydały dokładnie przyjęte wersje w Development; działają obserwowalność bez danych klienta, odczyt/recovery i uzgodniony rollback. Odbiór dotyczy testowych danych. Poufne ADP/dokumenty mają opisaną granicę PORR i nie trafiają do współdzielonych store/logów/GitHuba. | PR/SHA/CI, wersje i source digests, release receipts, aktualny LKG/recovery, dowód rzeczywistego E1/E2, decyzja odbioru tomasz@profitia.pl oraz końcowe PMOS/PHR. |

**Reprezentatywny zestaw danych (projekt, nie dane już utworzone):**
- organizacja A: dwóch aktywnych użytkowników UA1/UA2; organizacja B: odrębny użytkownik UB1 z własnym aktualnym dostępem;
- co najmniej 51 syntetycznych firm w A, by sprawdzić pagination, oraz firma o tym samym formalnie poprawnym NIP-ie w B; nazwy/kontakty wyraźnie fikcyjne i brak wywołań zewnętrznych rejestrów;
- firmy aktywne bez procesu, zarchiwizowane i istniejące po NIP-ie z różnymi wariantami nazwy;
- dwa pipeline’y „Dostawcy”; trzy kategoriowe: „Asfalt — kwalifikacja”, „Asfalt — umowy”, „Beton”; firma testowa w różnych etapach bez odpowiednich kategorii na karcie;
- etap z dokładnie czterema firmami i pusty etap docelowy; wariant z dodatkowym zapisem po otwarciu dialogu; ostatni pozostały etap;
- jawne brak opiekuna, długie wartości, wiele kontaktów/kategorii, pusty katalog i brak wyników;
- źródłowe metadane ADP known/MISSING/UNKNOWN jako kontrolowane testy kontraktu; w rzeczywistym uruchomieniu brak przyjętego źródła daje rzeczywiste UNKNOWN. Testowy provider nie trafia do produkcyjnej ścieżki jako fałszywy source.

Dowody muszą rozróżniać: test źródłowy/integracyjny, autoryzowany API live, UI live i aktualny odczyt bazy. Żaden z tych poziomów nie zastępuje pozostałych, gdy wymagają ich FINAL-*.

### 5.2. Dwa etapy i numerowane taski

#### E1. Działający kontrakt i trwała zdolność SRM

**Wynik po etapie:** wersjonowany kontrakt srm.supplier-pipelines/1.0.0 jest dostępny na rzeczywistym SRM Development. API zapisuje i odczytuje katalog, dane karty, słownik i procesy zgodnie z regułami. Drugi użytkownik A widzi zapis w nowej sesji; osobno wykazana odmowa użytkownika B. Działa transakcyjny cykl życia i metadane ADP bez fałszywego źródła. Pełne UI AppShell jest wynikiem E2.

**Owner/profil/środowisko:** SRM prowadzi i odpowiada za producenta; ARCHITECTURE przyjmuje swoje operacje/granice. Każdy ma oddzielny task i continuity właściwego profilu. Development. Dokładny istniejący zasób/rola są potwierdzane przed użyciem; żadna baza PMOS nie jest bazą produktu.

**Warunki rozpoczęcia:** łączna akceptacja projektu i roadmapy względem commitu; osobne **URUCHOM ETAP E1**; mandaty właściwych ownerów i operacji, aktualne gates/begin. Tam, gdzie operacja wymaga szczególnego przyjęcia (polityka zaufania, SQL/role/grant, exact source, koszt, aktywacja, release), musi ono być skuteczne przed tą operacją. Akceptacja planu nie jest takim grantem.

| Task ID | Zakres i rezultat | Owner / exact paths lub komponent | Zależność | Definition of Done i wymagany dowód |
| --- | --- | --- | --- | --- |
| E1-T01 | Zamrozić przyjętą wersję kontraktu SRM–SG2, schemat DTO/komend/błędów, testowe wektory NIP, lifecycle i port ADP. Jawnie opisać odmowę/UNKNOWN i stabilny ID. | SRM; apps/srm/src/server/supplier-pipelines-contract.ts; packages/srm-adp-ui/src/pipelines-contract.ts i publiczny src/index.ts; właściwy pin kontraktu. | Akceptowana rewizja PDR, mandat E1, routing. | Kontrakt maszynowo walidowany; poprawne/niepoprawne przykłady NIP, duplikatu, stage/transfer/version/errors; kompatybilność i odrzucenie unsupported version; PR/SHA/CI. Kontrakt nie importuje prywatnych modułów aplikacji. |
| E1-T02 | Przyjąć bounded operacje/zasoby i wejścia Work/SQL, mapowanie tej samej polityki dla uprawnionych członków i odbiorcę peer. Zweryfikować istniejący private binding, role i wymagane instalacje; zamknąć właściwe owner-only dopuszczenia. | ARCHITECTURE we własnym tasku; packages/platform-contracts/src/supplier-workspace-access.mjs, src/operation-context.mjs, migrations/access/supplier-workspace-v1.sql, test/supplier-workspace-access.test.mjs; Canon/registries/operation-access-matrix-v1.json. SRM dostarcza wymagania konsumenta. | E1-T01; jawne przyjęcie zmian wspólnych, grantów/okna/recovery przez uprawnionego ownera. | Zgodny kontrakt operacji i prywatnej transakcji; zwykły runtime bez ogólnego DML/elevated praw; realne, ograniczone uprawnienia i revocation; brak wykorzystania cudzej operacji X-Ray. PR/SHA/CI/receipts i odczyt faktycznej instalacji. Jeśli brak odpowiedniej decyzji, task ZABLOKOWANY, nie pozornie „gotowy”. |
| E1-T03 | Rozszerzyć istniejący master i zbudować transakcyjny store: profile/kategorie/procesy/etapy/uczestnictwa/historia, unikalność NIP i aktywnych przypisań, CAS/idempotencja, archive/restore, transfer i occupied-stage removal. | SRM; apps/srm/db/private-store/supplier-pipelines-v1.sql; src/server/supplier-pipelines-domain.ts i supplier-pipelines-store.ts; deployment/supplier-pipelines-targets.json; meaningful domain/DB integration tests w tym samym ownerze po exact-path preflight. | E1-T01/T02; zatwierdzone aktualne źródła, fizyczny binding, recovery i instalacja. | Zwykła rola DB potwierdza niezmienniki §4.2; race dwóch zapisów NIP/przypisania, cross-FK odmowy, rollback obu operacji zbiorczych, archiwalne NIP-y i brak reaktywacji dawnych członkostw. Bez zmiany 18 bazowych migracji i bez globalnego NOT NULL dla KRS-only. PR/SHA/CI, digests migracji, install/readback/recovery. |
| E1-T04 | Udostępnić autoryzowane HTTP i odczyt ADP, połączyć kontrakt z rzeczywistym store oraz przeprowadzić testy całego API w tym receiverze. | SRM; apps/srm/app/api/adp/v1/[...segments]/route.ts; src/server/supplier-pipelines-http.ts i supplier-adp-status.ts; reuse właściwych publicznych granic Identity/E1/peer. | E1-T01–T03, rzeczywiste operacje przyjęte u producenta. | Lista endpointów §4.4, zgodny JSON, maskowanie obcego zasobu, brak zaufania do org/user z body, obsługa CSRF/versji/retry, realne UNKNOWN przy braku źródła ADP. Kontrakt/HTTP/integration/security tests i CI na exact SHA. |
| E1-T05 | Wydać część SRM i odebrać trwałość oraz izolację na Development przez co najmniej dwa konta A i konto B; przekazać konsumentowi wersję/receipt. Rozliczyć E1. | SRM; właściwy istniejący runtime Development, srm-ci.yml i własne release gates; PDR rejestr + PMOS/PHR. | E1-T01–T04, exact-source admission, właściwy release GO, aktualny LKG/recovery i konta. | Live zapis UA1 → nowa sesja UA2 odczytuje te same ID/wersje; UB1 bezpośrednio odpytuje/zapisuje API i ma odmowę; brak widoczności i efektów w obcej org. Dowody FINAL-02/04/05/06/07/08 oraz backendowych 03/09/10, PR/SHA/CI/deploy, wersja kontraktu/bindingu. Test lokalny nie spełnia tego taska. |

**DoD E1:** wszystkie pięć tasków i warunki etapu spełnione; dowód wersjonowanego kontraktu, live persystencji po zmianie sesji i odmowy z innej organizacji, integralności/rollbacku, aktualnego wydania i recovery. SRM udostępnia bezpieczny punkt adopcji SG2. Status nie wynika wyłącznie z liczby commitów. Po rozliczeniu E1 — **STOP przed E2**.

#### E2. Działające „Dostawcy i pipeline’y” w AppShell i pełny odbiór

**Wynik po etapie:** kupiec realizuje cały scenariusz z biurka AppShell przez katalog i wspólną Kartę do niezależnych etapów, z rzeczywistymi zapisami i prawami organizacji, na odebranej wersji Development. tomasz@profitia.pl akceptuje wszystkie FINAL-*.

**Owner/profil/środowisko:** SRM odpowiada za publiczne UI, SG2 za host/BFF/nawigację i przyjęcie kontraktu; osobne taski i polityki ciągłości. Development. Poprawki producenta mają jego własny scope/PR, nie prywatne importy do SG2.

**Warunki rozpoczęcia:** rozliczenie E1 i nowa wyraźna dyspozycja **URUCHOM ETAP E2**, przyjęte wersje i zależności producenta. Zgoda na całe BSDC, ukończenie E1, merge lub CI nie jest dyspozycją E2. E2 nie rozpoczyna się niezależnymi przygotowaniami „przy okazji”.

| Task ID | Zakres i rezultat | Owner / exact paths lub komponent | Zależność | Definition of Done i wymagany dowód |
| --- | --- | --- | --- | --- |
| E2-T01 | Zbudować publiczny SupplierPipelinesWorkspace 2.0.0 zgodny z UX-01–12, uzupełnić tylko potrzebne projekty/delta UX, kwalifikację i reuse prymitywów. Pozostawić transport po stronie hosta. | SRM; packages/srm-adp-ui/src/pipelines-workspace.tsx, pipelines-contract.ts, src/index.ts, source-contract.json; istniejące style/prymitywy i srm-adp-ui-ci.yml; właściwe projekty MagicPath bez nowego kanonu-kopii. | Rozliczenie E1, mandat E2, stabilny kontrakt i przyjęcie nowych kompozycji do produktu. | Ten sam supplierId z wszystkich wejść; inline duplicate CTA, jawny wybór etapu/transfer, dialog z liczbą i celem, archive/restore, MISSING/UNKNOWN; PL/EN/light/dark/keyboard/390–2560; trzy osie kwalifikacji i import/chunk scan bez symulacji oraz projektowych narzędzi. Publiczny export/version/digest i CI. |
| E2-T02 | Jawnie przyjąć nowy kontrakt i UI w SG2; podłączyć właściwy server peer, dane, komendy, stany błędu i rzeczywistą nawigację hosta. | SG2; apps/sg-runtime/components/appshell/adp-module-host.tsx; lib/appshell/adp-pipelines-client.ts; adp-pipelines-routes.ts; app/api/adp/v1/[...segments]/route.ts; właściwy consumer receipt/lock i testy po exact-path preflight. | E2-T01 i wydany E1; osobny task SG2, własny preflight/begin/admission/release. | Biurko→ADP→katalog domyślny; katalog/karta/proces stable IDs; refresh/deep links/Back/Forward/filter return/dirty guard; jedna preferencja motywu i jeden asystent AppShell; brak local fixtures/fallbacku, sekretów i SQL w UI; peer weryfikuje aktualną tożsamość/organizację. Build/CI/integration i kontraktowe odmowy. |
| E2-T03 | Wydać integrację i przeprowadzić pełny odbiór biznesowy z reprezentatywnymi danymi, dwoma użytkownikami A i użytkownikiem B. Naprawić rutynowe błędy w mandacie i rozliczyć całość. | SG2 + SRM w swoich taskach; tomasz@profitia.pl odbiera; istniejące Development release i właściwe PMOS/MEMOROS/PHR według profilu. | E2-T01/T02, aktualne release GO/LKG/recovery, realne konta i uzgodniony dataset. | **Wszystkie FINAL-01–10** z rzeczywistym dowodem wersji/środowiska. Sekwencja katalog+duplikat+jedna karta+zero/jedno+Asfalt/Beton+drugi Asfalt+occupied removal+archive/restore+ponowny login+direct foreign API. Regresja granic AppShell/SRM, monitoring i LKG/rollback. Odbiór właściciela, aktualny rejestr i finalny handoff; brak automatycznej promocji Staging/Production. |

**DoD E2 i całości:** wszystkie taski E2 oraz FINAL-* spełnione i odebrane. W Karcie zapisano faktyczne wersje/PR/SHA/CI/deploy, testy, braki i decyzję odbioru. Niespełnione DoD dają CZĘŚCIOWY/ZABLOKOWANY; nie obniża się kryteriów do „wdrożono kod”.

### 5.3. Zależności, koszt/ryzyko, mandaty i odzyskanie

- Krytyczna ścieżka: E1-T01 → E1-T02 → E1-T03 → E1-T04 → E1-T05 → rozliczenie i STOP → osobny start E2 → E2-T01 → E2-T02 → E2-T03.
- W E1 można równolegle opracować/zweryfikować czyste kontraktowe przypadki i projekt migracji po E1-T01, lecz **mutacja chronionego store wymaga E1-T02**. W E2 po stabilnym kontrakcie możliwa jest równoległa praca SRM nad UI i SG2 nad adapterem; integracja i odbiór pozostają wspólne. Równoległość nie obejmuje rozpoczęcia następnego etapu.
- Full Autopilot obejmuje wszystkie dozwolone taski, rutynowe poprawki, testy i rozliczenie **tylko uruchomionego etapu**. Nie ma mikrozgód na zwykłe poprawki. Nowe koszty, zasoby, prawa, zmiana zaufania, zakresu, source SHA objętego exact GO lub środowiska podlegają własnym rzeczywistym regułom.
- Przy lokalnej blokadzie kontynuować wyłącznie niezależne autoryzowane taski aktywnego etapu; zapisać realną blokadę/owner decyzji. Brak dopuszczenia operacji nie jest powodem do pożyczenia uprawnień innej funkcji, wyłączenia RLS albo uruchomienia E2.
- Plan używa istniejących runtime’ów i store Development. **Budżet wywołań zewnętrznych v1: 0, ponieważ nie ma ich w zakresie. Nowe zasoby/scaling: nie są objęte bazowym planem.** Utrzymanie już istniejących usług oraz przyrost CPU/storage nie zostały wycenione i nie są deklarowane jako darmowe; przy realizacji mierzy się je w istniejących metrykach.
- Czasu kalendarzowego ani stawki nie deklaruje się bez dowodu gotowości nowych operacji, instalacji i okna. Wąskie gardło to przyjęcie bounded Access/SQL i rzeczywisty odbiór dwóch organizacji, następnie consumer release. Daty i ewentualny koszt wykraczający poza istniejący mandat wymagają uzasadnionej decyzji, a nie dopisania fikcyjnej estymaty. Przyjęcie projektu nie obejmuje otwartego budżetu.
- Ryzyka materialne: wyścig NIP/przypisania; atomowość transferu/usunięcia etapu; pomylenie kategorii; przeciek przez lookup/API/FK; legacy KRS-only; niezgodny UI contract; nieautorytatywny status ADP; pomylenie prywatnego Dev z PORR-owned. Każde ma przeciwdziałanie i test w §1/4/FINAL-*.
- Recovery przed migracją: aktualne, właściwe źródła i ledger/receipts; znany punkt odzyskania bazy i udowodniona dozwolona ścieżka restore; nowy snapshot/branch tylko przy właściwej zgodzie ownera. Przy niepewnym COMMIT odczytać receipt/stan, nie odtwarzać migracji w ciemno.
- Migracje rozszerzające nie modyfikują niezmiennych migracji bazowych ani nie niszczą mastera/raportów. Prawdziwy aktualny LKG wydania, artefaktu, konfiguracji i schematu jest wymagany przed release.
- Rollback: wyłączyć nową funkcję zgodnie z bieżącym mandatem i przywrócić znany artefakt/konfigurację; zachować zgodne dane/historię. Nie dropować nowych wypełnionych tabel i nie wykonywać odwrotnej migracji jako rutynowego cofnięcia UI.
- Staging/Production, nowe środowisko PORR, pliki klienta i obieg dokumentów są poza tymi etapami. Zmiana tej granicy wymaga nowej decyzji zakresowej.
- Akceptowany projekt i plan zostają zamrożone względem dokładnego commitu. Aktualizacje statusów/dowodów nie zmieniają po cichu zakresu, kolejności krytycznej ani DoD. Właściciel może jawnie zmienić plan; decyzja jest zapisana w tej Karcie.

### 5.4. Rejestr realizacji etapów i tasków

Bieżący mandat produktu: **BRAK**. Ostatnia czynność: wznowienie i przygotowanie projektu/roadmapy do przeglądu w tym samym PR #1123. Zakończenie dokumentacji nie jest rozliczeniem E1. Dyspozycja startu E1/E2: **BRAK**.

| ID | Status | Początek / koniec | Wykonawczy taskId / owner / środowisko | PR / SHA / CI / deploy / test / odbiór | Braki i następny krok |
| --- | --- | --- | --- | --- | --- |
| E1 | NIE_ROZPOCZĘTY | — | Do nadania / SRM prowadzi / Development | — | Akceptacja łączna i osobny start E1, właściwe dopuszczenia. |
| E1-T01 | NIE_ROZPOCZĘTY | — | Do nadania / SRM / Development | — | Przyjęta rewizja kontraktu i modelu. |
| E1-T02 | NIE_ROZPOCZĘTY | — | Do nadania / ARCHITECTURE / Development | — | Właściwe operacje, zasoby, źródła, instalacje i mandaty. |
| E1-T03 | NIE_ROZPOCZĘTY | — | Do nadania / SRM / Development | — | T01/T02, migracja i niezmienniki DB. |
| E1-T04 | NIE_ROZPOCZĘTY | — | Do nadania / SRM / Development | — | T01–T03, autoryzowane API i ADP status reader. |
| E1-T05 | NIE_ROZPOCZĘTY | — | Do nadania / SRM / Development | — | Wydanie, realny drugi użytkownik i odmowa obcej organizacji. |
| E2 | NIE_ROZPOCZĘTY | — | Do nadania / SG2 + SRM / Development | — | Rozliczenie E1 i nowy wyraźny start E2. |
| E2-T01 | NIE_ROZPOCZĘTY | — | Do nadania / SRM / Development | — | Publiczne UI i właściwy transfer UX. |
| E2-T02 | NIE_ROZPOCZĘTY | — | Do nadania / SG2 / Development | — | Jawna adopcja kontraktu i integracja hosta. |
| E2-T03 | NIE_ROZPOCZĘTY | — | Do nadania / SG2 + SRM; odbiera tomasz@profitia.pl / Development | — | Wszystkie FINAL-* i rzeczywisty odbiór. |

Każdy wykonawca uzupełnia wiersz po istotnym wyniku/zmianie: faktyczne daty, taskId, owner, PR, commit, CI, deploy/config/wersja, test i dowód odbioru, braki i następny krok. Etap agreguje wyniki tasków i własny DoD. Dokument nie jest konkurencyjną bazą PMOS/PHR. PR #1123 i zadania dokumentacyjne nie są wpisywane jako produktowe wykonanie tych tasków.

### 5.5. Lista końcowego odbioru

| ID | Środowisko / zakres | Status | Rzeczywisty dowód |
| --- | --- | --- | --- |
| FINAL-01 | Development / AppShell → ADP → katalog | DO_POTWIERDZENIA | — |
| FINAL-02 | Development / obowiązkowy NIP, nazwy, edycja i współbieżność | DO_POTWIERDZENIA | — |
| FINAL-03 | Development / jedna karta i uczciwe metadane ADP | DO_POTWIERDZENIA | — |
| FINAL-04 | Development / zero lub jedno aktywne przypisanie i atomowy transfer | DO_POTWIERDZENIA | — |
| FINAL-05 | Development / niezależne kategorie i nazwane procesy | DO_POTWIERDZENIA | — |
| FINAL-06 | Development / drugi członek tej samej organizacji | DO_POTWIERDZENIA | — |
| FINAL-07 | Development / bezpośrednie API obcej organizacji, baza i revocation | DO_POTWIERDZENIA | — |
| FINAL-08 | Development / uprawnienia operacji w organizacji i cykl życia | DO_POTWIERDZENIA | — |
| FINAL-09 | Development / occupied-stage removal i UX-01–12 | DO_POTWIERDZENIA | — |
| FINAL-10 | Development / wydanie, recovery i końcowy odbiór | DO_POTWIERDZENIA | — |

**Zamknięcie całości:** dopiero wszystkie FINAL-* i wymagane DoD etapów potwierdzone na rzeczywistych wersjach. Przedtem wynik pozostaje częściowy w razie braków. Ta Karta pozostaje aktualizowana także po zamknięciu samego projektowania BSDC.


## 6. Rejestr decyzji i rekomendacji

### 6.1. Decyzje zachowane z inicjalizacji

| ID | Stan / znaczenie |
| --- | --- |
| DEC-01 | Właściciel uruchomił BSDC v1.1, jedną Kartę i pracę krokową. Obowiązuje. |
| DEC-02 | Jeden rekord firmy, jeden typ procesów „Dostawcy” z ograniczeniem i wiele niezależnych procesów kategorii. Uściślone przez DEC-15 do zero/jednego aktywnego przypisania. |
| DEC-03 | Flow makiety zaakceptowane, dopuszczalne niewielkie korekty widoków. Nie jest zgodą na dane demo i dodatkowe moduły. |
| DEC-04 | SRM prowadzi, SG2 odpowiada za AppShell; ARCHITECTURE zachowuje wspólne kontrakty i własne dopuszczenia. Potwierdzone w bieżącym zleceniu. |
| DEC-05 | Brak akceptacji całego rozwiązania/roadmapy i brak mandatów E1/E2. Nadal obowiązuje do konkretnych nowych decyzji. |
| DEC-06 | Tworzenie pipeline’u przed doborem firm i etapów. Dawna otwarta opcja synchronizacji kategorii została zamknięta przez DEC-14. |
| DEC-07 | Duplikat NIP prowadzi do istniejącej karty. Dawny pomysł dodatkowego ekranu zastępuje DEC-13: stan w tym samym formularzu i CTA zależne od kontekstu. |
| DEC-08 | Jednakowe możliwości uprawnionych członków we własnej organizacji i izolacja multi-tenant w bazie. Uściślone przez DEC-17, bez znoszenia autoryzacji operacji. |
| DEC-09 | Development i odbiór przez tomasz@profitia.pl. Obowiązuje. |
| DEC-10 | Szczegóły ADP i dodatkowych zakładek były otwarte; DEC-18 zamyka rdzeń v1 i wyłączenia. |
| DEC-11 | Karta, decyzje i dowody na GitHubie; brak lokalnych dokumentów na komputerze użytkownika. Lokalna kopia z inicjalizacji została wcześniej usunięta. Obowiązuje. |

### 6.2. Bieżące decyzje właściciela — 2026-11-17

| ID | Przyjęte wymaganie biznesowe / ślad zmiany |
| --- | --- |
| DEC-12 | NIP obowiązkowy i poprawny, normalizacja spacji/myślników, unikalność per organizacja także przy edycji i wyścigu. Ta sama wartość przy innej nazwie oznacza tę samą firmę. Zamyka dawną opcję tworzenia bez NIP-u. |
| DEC-13 | Znaleziony NIP: nazwa w tym samym formularzu; katalog → Otwórz Kartę Dostawcy; pipeline → Wybierz istniejącego dostawcę → wybór etapu. Wyłącznie bieżąca organizacja. |
| DEC-14 | Kategorie na karcie i procesy są osobne. Nie trzeba kategorii na karcie i nie powstaje ona automatycznie przy dodaniu do pipeline’u. W jednej kategorii wiele nazwanych procesów; raz w każdym, etapy niezależne. Zastępuje wcześniejszą roboczą sugestię synchronizacji. |
| DEC-15 | W typie „Dostawcy” firma ma zero lub jedno aktywne przypisanie. Zwykłe drugie równoległe przypisanie odrzucane. Jawny transfer jest punktem wyjścia do rekomendacji REC-01. |
| DEC-16 | Zajęty etap: aktualna liczba, obowiązkowy etap docelowy, akcja typu „Przenieś 4 firmy i usuń etap”, anulowanie i ręczne rozdzielenie, jeden atomowy zapis i brak wpływu na inne procesy/karty. |
| DEC-17 | Zalogowani użytkownicy uprawnieni do organizacji mają jednakowe możliwości. Multi-tenant obejmuje bazę, odczyt/zapis/duplikaty i wszystkie powiązania. Odbiór musi obejmować direct API z konta innej organizacji. |
| DEC-18 | v1 = katalog, karta, oba typy pipeline’ów i odczyt statusu/daty ADP, gdy znane. „Brak ADP” różni się od „Brak potwierdzonych danych”. Reszta modułów i pełny obieg ankiety wymagają osobnej decyzji. |
| DEC-19 | E1: kontrakt SRM, trwały zapis i drugi użytkownik tej samej org plus osobna odmowa obcej. E2: pełny scenariusz AppShell. Development, reprezentatywne dane testowe, ten sam odbierający. Opis poufnych treści ma odnieść się do wcześniejszej propozycji wydzielenia PORR. |
| DEC-20 | Właściciel zlecił domknięcie projektu w tej samej Karcie/PR1123, aktualizację 29 kryteriów, kontraktu, roadmapy i FINAL-02/04/08 oraz przedstawienie całego pakietu do łącznej akceptacji. To nie zlecenie realizacji etapów. |

### 6.3. Rekomendacje zawarte w bazie do akceptacji

| ID | Rekomendacja / zakres łącznej akceptacji |
| --- | --- |
| REC-01 | Archiwizacja zamiast fizycznego usuwania w v1, również dla nieużytych rekordów; zachowanie historii i NIP-u; restore bez reaktywacji przypisań; jawny atomowy transfer SUPPLIER. Szczegóły §1.7. |
| REC-02 | Usunięcie etapu z zachowaniem historycznej tożsamości, zakaz usunięcia ostatniego aktywnego etapu, wersja/liczba wiążą dialog i COMMIT. |
| REC-03 | Archiwizacja kategorii nie przepisuje kart ani procesów; blokuje nowe klasyfikacje/nowe procesy, ale istniejący aktywny proces może trwać. Typ pipeline’u i użyta kategoria nie są przepisywane. |
| REC-04 | Reuse srm.suppliers i opcjonalnego rozszerzenia workspace, bez globalnej zmiany dawnych rekordów KRS-only; źródło prawdy po stronie SRM. |
| REC-05 | Odczytowy status ADP tylko na podstawie dozwolonych metadanych. Bez przyjętego źródła jawne UNKNOWN jest kompletnym wynikiem v1. Nota „3 lata” nie jest automatyczną regułą; pełny workflow/import pozostaje poza zakresem. |
| REC-06 | Prywatny istniejący SRM Development do testowego odbioru po rewalidacji. Poufne treści/docelowe dokumenty w kontrolowanym przez PORR runtime/store/object storage; brak takiego provisioningu i danych klienta w tych etapach. |
| REC-07 | Kontrakt domain 1.0.0 i nowy publiczny UI 2.0.0, jawne operacje i ograniczony peer; bez cichej zmiany kontraktu presentation-only 1.0.0. |
| REC-08 | Zabezpieczenia CAS, idempotencja i bounded transakcje z FORCE RLS/FK/unikatami oraz sanitizowanymi dowodami; jednakowe prawa członków realizowane przez jawnie przyjęte operacje, bez wildcardu. |

Akceptacja całego projektu i roadmapy ma objąć te rekomendacje, zakres ADP UNKNOWN, granicę danych testowych Development i wyłączenia. Nie zakłada się, że zostały zaakceptowane samym wcześniejszym flow albo odpowiedzią o multi-tenant.

## 7. Otwarte zależności, realne ryzyka i granice twierdzeń

### 7.1. Brak ukrytych decyzji zakresowych

Na potrzeby **zdefiniowanego odbioru v1 Development na danych testowych** projekt nie wymaga kolejnej decyzji przed przedstawieniem do łącznej akceptacji. Właściciel ma rozstrzygnąć cały pakiet, w tym jawne rekomendacje REC-01–08. Brak potwierdzonego źródła ADP jest obsługiwanym stanem produktu, nie ukrytym zadaniem integracyjnym.

Następujące zmiany wymagałyby ponownej decyzji, bo zmieniają zakres/bezpieczeństwo/odbiór:
- wymaganie rzeczywiście zasilanego CURRENT/MISSING dla realnych dokumentów zamiast dopuszczonego UNKNOWN przy braku źródła;
- włączenie pełnej ankiety, plików, dokumentów, umów, ocen, aktywności, X-Ray lub Newsfeed;
- realne poufne dane PORR w środowisku dotychczas używanym do testów albo udostępnienie ich operatorowi/innemu systemowi;
- dopuszczenie firm bez poprawnego NIP-u, współdzielonego prywatnego katalogu między organizacjami, drugiego aktywnego przypisania SUPPLIER, fizycznego kasowania historii albo automatycznej synchronizacji kategorii z procesem;
- nowy zasób, koszt, grant, polityka zaufania, inny owner lub inne środowisko poza faktycznym mandatem.

### 7.2. Zależności wykonawcze, które nie są jeszcze spełnione

- Nie ma obecnie dowodu wdrożenia nowego kontraktu, operacji i schematu. Wszystkie taski E1/E2 są NIE_ROZPOCZĘTE.
- Nowe operacje Access/Root/Work i SQL wymagają dopuszczenia właściwego ownera w E1-T02; same wpisy w planie nie dają ALLOW.
- Przed instalacją trzeba potwierdzić actual binding, role, recovery i okno, nie ufać historycznemu statusowi JSON. Brak gotowości blokuje zależny task, bez fallbacku do demo/shared lub PMOS.
- Nie udowodniono automatycznego bindingu MagicPath. Docelowy transfer wymaga rzeczywistego reuse i przyjętej kwalifikacji, bez ogłaszania propagacji na podstawie podobieństwa.
- Rzeczywiste poufne środowisko PORR, źródło ADP i jego polityki retencji nie są aktywowane. Włączenie ich później jest odrębnym zakresem.
- Daty kalendarzowe i liczbowy przyrost kosztu hostingu pozostają niewyznaczone do chwili mierzalnej gotowości; nie stanowią zgody na nowe wydatki.
- W razie niedostępności realnych kont dwóch organizacji E1-T05 i E2-T03 nie mogą być oznaczone jako zakończone na podstawie fixtures, demo cookies lub sztucznego ALLOW.

### 7.3. Dowody dokumentacyjne i publikacja

Inicjalizacja tej samej Karty: task SRM-BSDC-SUPPLIER-CATEGORY-20261117, commit dokumentacji 6bca96beddfc5f6129b079fa053cacb8ef90c6c7; [historia i closeout na GitHubie](https://github.com/profitia/project-history-repository/blob/c962d6899e6f72938d16f1bc701017353cbb31d5/history/2026/11/17/2026-11-17-14-40-35Z__srm-srm-bsdc-supplier-category-20261117/manifest.json).

Bieżące wznowienie: SRM-BSDC-SCP-DESIGN-R2-20261117; PMOS begin cmwkubpfb00003rd0mtq3an92; conversationId pmos-task-v2:98c2caa21f32994194ee326c25e6bf4875edacf2517cb426794e69b766626d17; host niedostępny jawnie. Manifest, project/repository/target/code state/routing/runtime i require-begin przeszły PASS przed mutacją.

Kontrola bezpośrednio przed publikacją: main 0adddc61c9955e68ac3e300012a337f125df8bc2, pełny require-begin PASS. Równoległe zmiany od snapshotu discovery dotyczyły innych zadań i rejestru dopuszczeń; nie zmieniały sprawdzonych granic domeny ani routingu tej Karty.

Mutacja dotyczy wyłącznie jednego PDR w istniejącym PR #1123. Nowy commit będzie zweryfikowany niezależnym odczytem GitHub; jego identyfikator jest źródłem rewizji do akceptacji. PMOS/PHR wznowienia są rozliczeniem **zadania dokumentacyjnego**, nie wykonaniem E1. Bieżąca historia pliku i PR są źródłem najnowszego SHA; nie wstawia się do treści samoodnoszącego się, wyliczonego z góry commitu.

## 8. Łączna akceptacja, freeze i punkt wznowienia

### 8.1. Przedmiot decyzji właściciela

Do akceptacji przedstawiono **łącznie**:
1. projekt rozwiązania z §1–4, w tym reguły cyklu życia, dostęp, źródło/UNKNOWN ADP, kontrakt i granicę PORR;
2. całą roadmapę E1–E2 z §5: pięć tasków E1, trzy taski E2, ich DoD, zależności, ownerów/środowiska, FINAL-01–10, sposób rozliczenia i osobne mandaty.

Decyzja musi wskazać dokładny commit tej Karty. Wzorzec odpowiedzi: **Akceptuję projekt rozwiązania oraz całą roadmapę E1–E2 z Karty BSDC-20261117-SUPPLIER-CATEGORY-PIPELINES w rewizji <zweryfikowany commit>.** Samo przyjęcie części nie przyjmuje po cichu drugiej części.

Po akceptacji należy zapisać aktora, datę, zakres obu części, dokładny zaakceptowany commit i granice zgody w tym samym pliku; F3 otrzymuje USTALONE dopiero z tym dowodem. Zamrożony projekt i bazowy plan pozostają odtwarzalne z tego commitu. Późniejsze statusy/dowody/receipts aktualizuje się dalej, bez zmiany zakresu i DoD. Publikacja ewentualnego aktywnego normatywnego rozszerzenia podlega właściwemu governance; nie jest automatycznym skutkiem akceptacji roboczej Karty.

**Akceptacja projektu i roadmapy nie uruchamia implementacji.** Osobny przyszły start E1 obejmuje tylko dopuszczone taski E1; po rozliczeniu STOP. E2 wymaga nowego wyraźnego polecenia. Same CI, merge, wydanie czy zakończenie taska nie zastępują kolejnego mandatu.

### 8.2. Punkt wznowienia

- Najnowsza centralna Karta: ten sam plik/gałąź w PR #1123. Przed wznowieniem zawsze odczytać aktualny GitHub, SHA/blob, decyzję właściciela i rejestr. Nie tworzyć drugiej Karty.
- Gdzie skończono: rewizja projektowa 2 przygotowana do wspólnego przeglądu; decyzje DEC-12–20 wprowadzone, kompletne §1–5 i rekomendacje REC-01–08.
- Stan checklisty: A–E USTALONE, F W_TRAKCIE wyłącznie z powodu oczekiwanej decyzji F3.
- Ostatnia przyjęta decyzja: wymagania biznesowe z bieżącego polecenia. Projekt i roadmapa **niezaakceptowane** do decyzji o konkretnym commicie.
- Aktywny mandat wykonawczy produktu / ostatni wykonany etap: BRAK. E1 i E2 oraz wszystkie ich taski NIE_ROZPOCZĘTE.
- Następny krok: łączna akceptacja albo konkretne uwagi właściciela. Przy zmianie merytorycznej zaktualizować tę samą Kartę i ponownie wskazać rewizję całego pakietu.
- Po akceptacji, dopiero po osobnym zleceniu: rozpocząć E1-T01, prowadzić wszystkie dozwolone taski E1 z własnymi taskId i profilami. Nowe wspólne operacje w ARCHITECTURE mają osobny task/PMOS/PHR, SG2 zachowuje własny lifecycle przy E2.
- Stosować aktywny Business Outcome Engineering v1.1, Universal Project Execution v1.2, Full Autopilot v2.0 oraz aktualne AGENTS/manifest/profil/routing/środowisko. Nie kopiować procedur ani poświadczeń między projektami.
- Karta jest jedynym planem i rejestrem inicjatywy; PMOS/PHR pozostają dowodami. Dokumentów i dowodów nie przechowywać lokalnie na komputerze użytkownika.

### 8.3. Źródła i granice odniesień

Źródła GitHub poniżej dotyczą sprawdzonego main discovery; późniejsza realizacja wymaga świeżego odczytu ownerów i źródeł, nie wieczystego przypięcia runtime’u do historycznego HEAD.

- [BSDC Canon v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md), [Launcher v1.1](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/bsdc-launcher-v1.1.md).
- [AGENTS](https://github.com/profitia/SG-dev/blob/main/AGENTS.md), [aktywny manifest](https://github.com/profitia/SG-dev/blob/main/Canon/registries/governance-manifest-v2.json), [profile projektów](https://github.com/profitia/SG-dev/blob/main/Canon/registries/profitia-projects-v1.json), [routing](https://github.com/profitia/SG-dev/blob/main/Canon/registries/current-architecture-baseline-v1.json).
- [Business Outcome Engineering](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/business-outcome-engineering-v1.1.md), [Universal Project Execution](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/profitia-universal-project-execution-v1.2.md), [Full Autopilot](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/full-autopilot-v2.md), [UX/UI canon](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/ux-ui-design-canon.md).
- [SRM capability canon](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/Canon/v1.0-srm-business-capability-canon.md), [architektura SRM](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/Canon/v1.0-srm-architecture-and-component-placement-canon.md), [ADP presentation-only amendment](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/Canon/v1.1-srm-adp-presentation-mounting-amendment.md).
- [Istniejący master i RLS](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/apps/srm/db/migrations/0001_xray_foundation.sql), [private-store adoption](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/apps/srm/db/private-store/README.md), [powiązana transakcja SRM](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/apps/srm/src/server/db.ts).
- [Walidacja NIP w SRM](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/apps/srm/src/server/xray-lookup.ts), [wspólna czysta normalizacja](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/packages/platform-contracts/src/organisation-profile.mjs).
- [Operation Context canon](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/Canon/v1.0-operation-context-and-access-contract.md), [aktualna implementacja operacji](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/packages/platform-contracts/src/operation-context.mjs).
- [UI types](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/packages/srm-adp-ui/src/types.ts), [źródłowy pin i ograniczenia](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/packages/srm-adp-ui/source-contract.json), [host ADP](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/apps/sg-runtime/components/appshell/adp-module-host.tsx).
- [Kandydat istniejącego prywatnego Development](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/apps/srm/deployment/private-runtime-targets.json), [historyczne przygotowanie store](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/apps/srm/deployment/private-store-preparation.json), [topologia SRM](https://github.com/profitia/SG-dev/blob/f8a422fe88cc0a6166a6401c7238803ec5c44761/Canon/registries/srm-environment-topology-v1.json).
- [Makieta ADP](https://www.magicpath.ai/files/465405993031966720) i [centralny Kanon SpendGuru](https://www.magicpath.ai/files/460628300646219776): identyfikatory komponentów i odczytane rewizje podano w §1.9. Makieta jest źródłem flow/stylu, a nie prawa dostępu, źródła statusu lub dowodu backendu.
- Wcześniejsza konsultacja o PORR-owned danych/runtime/storage pozostawała propozycją. W tej Karcie została odtworzona i jawnie utrwalona jako rekomendacja §4.5/REC-06; nie przedstawia się jej jako aktywnego wpisu rejestru, utworzonego zasobu lub wykonanej migracji.

