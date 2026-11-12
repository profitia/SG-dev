# Karta Projektu BSDC — ciągłe doskonalenie jakości asystenta SpendGuru

| Pole | Wartość |
| --- | --- |
| initiativeId | BSDC-20261112-CIC-ASSISTANT-CONTINUOUS-QUALITY |
| projectKey / profil prowadzący | ARCHITECTURE |
| Owner biznesowy | Profitia — właściciel produktu |
| Zakres współpracy | ARCHITECTURE koordynuje projekt; CIC zachowuje reguły rozmowy; SG2 odpowiada za integrację w SpendGuru |
| Repozytorium / authority | profitia/SG-dev / main |
| Ścieżka | Canon/proposals/bsdc/ARCHITECTURE/cic-assistant-continuous-quality.md |
| Gałąź robocza | architecture/bsdc-cic-quality-20261112 |
| Status | WORKING / NOT_ACCEPTED |
| Tryb | DESIGN / BUSINESS CONSULTING |
| Etap | D–E: rekomendacje danych QA i wykonawcy; C oraz F pozostają otwarte |
| Utworzono / zaktualizowano | 2026-11-12 / 2026-11-12, Europe/Warsaw |
| Rewizja | 4 |
| Rewizja bazowa ostatniej aktualizacji | PDR 90fb09abafa8ff6886dfe14feff76d43a1cf5563; aktualne źródła governance main ce5044a6c87937da80ee2db86dbcb54522ddd491 |
| Zadanie inicjalizacji | ARCH-BSDC-CIC-QUALITY-INIT-20261112 |
| Zadanie bieżącej aktualizacji | ARCH-BSDC-CIC-QUALITY-DATA-EXECUTOR-20261112 |
| Upoważnienie | Uruchomienie BSDC i prowadzenie jednej roboczej karty. Bez implementacji produktu, aktywacji kanonu, zasobów, płatnych przebiegów i deploymentów. |

Publiczna karta zawiera opis potrzeby i stan konsultacji. Nie zawiera transkryptów, wyników odczytów prywatnych systemów, danych użytkowników/klientów, materiałów prywatnego repozytorium CIC ani sekretów. Bieżący commit zapisu potwierdza się odczytem GitHuba poza plikiem. Gałąź robocza nie oznacza przyjęcia do main ani akceptacji rozwiązania.

## 1. Potrzeba i rezultat biznesowy

Właściciel chce rozwinąć CIC o automatyczną, ciągłą ocenę i poprawę jakości odpowiedzi asystenta SpendGuru na podstawie rzeczywistych interakcji. Nie może ręcznie przeglądać wszystkich rozmów, diagnozować nieprawidłowości i zlecać kolejnych poprawek. Oczekuje minimalnego własnego udziału oraz racjonalnego kosztu.

Zakres potrzeb obejmuje jakość językową, merytoryczną, logiczną i kontekstową, ustalanie przyczyn błędów, zapobieganie nawrotom, autonomiczne wykonywanie dopuszczonych napraw i sprawdzanie efektu. Analiza nocna jest możliwym sposobem realizacji, nie narzuconą technologią. Przypadek błędnego rozumienia zakresu czasu jest przykładem potrzeby, nie kompletną specyfikacją.

Odbiorcy: użytkownicy SpendGuru w różnych modułach oraz właściciel produktu. Wyjątki powinny trafiać do właściwych specjalistów, bez tworzenia kolejki rutynowych zadań dla właściciela.

Wynik: mniej istotnych błędów docierających do użytkowników, mniej nawrotów i rosnący udział skutecznych napraw zakończonych bez ręcznego zlecania kolejnych kroków. Monitoring lub samo przygotowanie PR nie realizują całego celu.

Dodatkowo potrzebny jest wspólny standard CIC/Assistant Context Gateway dla braku, nieaktualności i sprzeczności danych, niezgodności z pytaniem, niejednoznaczności, awarii integracji, braku możliwości weryfikacji oraz sprzeczności w odpowiedzi.

## 2. Dotychczasowe ustalenia i rekomendacja robocza

Wcześniejsza rozmowa obejmowała analizę architektury, porównanie możliwości technologicznych i gotowych rozwiązań oraz doprecyzowanie przez właściciela dwóch najważniejszych braków:

- A: konkretny mechanizm automatycznego uruchamiania wykonawcy, testowania, PR, dopuszczonego scalania/promocji i odzyskiwania kontroli po niepowodzeniu;
- B: kryteria wykrywalności, fałszywych alarmów, skuteczności napraw, gotowości do autonomii i wycofania.

Te wymagania są częścią potrzeby. Właściciel przyjął granicę środowiska v1 w DEC-01 oraz projektowe limity modeli w DEC-02. Pozostałe propozycje, w tym progi jakości, wybór narzędzi i zakres dopuszczonych klas, nie uzyskały jeszcze statusu zaakceptowanego kanonu.

### 2.1. DEC-01 — decyzja właściciela, 12 listopada 2026

**PRZYJĘTA DECYZJA PROJEKTOWA:** v1 obejmuje autonomiczne naprawy, scalanie oraz wdrożenia dopuszczonych klas zmian do **Development**. **Production będzie rozpatrywane później**, poza v1. Właściciel polecił zapisanie tej decyzji i kontynuację BSDC **nadal bez implementacji**.

Decyzja ustala zakres projektowanego rozwiązania. Nie uruchamia obecnie agenta, merge do main, kosztów, nowych zasobów ani deploymentów. Nie nadaje przyszłemu systemowi prawa zmiany własnego mandatu. Staging również nie zostaje domyślnie dodany do zakresu. Wykonanie będzie wymagało przyjęcia odpowiednich reguł i odrębnego upoważnienia zgodnie z aktywnym governance.

Rekomendacja do dalszego sprawdzenia: połączyć kontrolę odpowiedzi przed jej pokazaniem z późniejszym procesem wykrycie → diagnoza → test → poprawka → niezależna weryfikacja → dopuszczone uruchomienie → sprawdzenie skutku. Wykonawca przygotowuje zmianę, a odrębny kontroler egzekwuje zakres i warunki promocji oraz nadzoruje wynik.

Preferowane jest rozszerzanie istniejących zdolności i wykorzystanie gotowych narzędzi tam, gdzie skraca to drogę do wyniku. Ostateczny wybór wykonawcy, oceniających, zapisu dowodów i umiejscowienia kodu nie jest jeszcze przyjęty. Historyczne rozpoznanie nie zastępuje sprawdzenia bieżącego stanu przed finalnym projektem.

### 2.2. DEC-02 — potwierdzony limit pilotażu, 12 listopada 2026

**PRZYJĘTA DECYZJA PROJEKTOWA:** 50 USD łącznie na dodatkowe wywołania modeli podczas 14-dniowego pilotażu, maksymalnie 5 USD na incydent, bez automatycznego zwiększania. Limit obejmuje QA, replay i wykonawcę napraw; nie jest limitem dziennym. Okres pilotażu rozpocznie się po odrębnie autoryzowanym uruchomieniu, nie w dniu tej decyzji.

Hosting, storage i CI pozostają do osobnego oszacowania. Potwierdzenie limitu nie uruchamia wydatków, nie zatwierdza nowego zasobu ani implementacji. Proponowany limit dwóch prób pozostaje odrębną, jeszcze nieprzyjętą regułą.

## 3. Checklista BSDC A–F

| ID | Status | Ustalenie / co pozostaje |
| --- | --- | --- |
| A1 | USTALONE | Problem ręcznego przeglądania rozmów i zlecania napraw opisany w §1. |
| A2 | USTALONE | Użytkownicy SpendGuru; owner biznesowy Profitia. |
| A3 | W_TRAKCIE | Rezultat określony; progi, mianowniki i sposób pomiaru do przyjęcia. |
| A4 | USTALONE | Priorytet: rzeczywista poprawa i naprawy, minimalny udział właściciela, racjonalny koszt. |
| B1 | W_TRAKCIE | Kod historii/runtime/migracji potwierdzony do main 46094e56; ustalenia w §4.3 oraz aktualna macierz E1/CI w §4.4–4.7. Pozostałe istotne integracje do domknięcia. |
| B2 | W_TRAKCIE | W §4.3 rozdzielono potwierdzony kod od niedowiedzionego stanu wdrożenia i proponowanych rozszerzeń. |
| B3 | W_TRAKCIE | Porównano miejsca wykonania w §4.4; wybrano rekomendację integracji gotowego wykonawcy z minimalnym własnym kontrolerem. Pozostałe wybory rozwiązania do domknięcia. |
| B4 | W_TRAKCIE | R-EXEC-01 określa miejsce wykonania i uzasadnienie; całkowity koszt, dostęp kont i końcowy wariant całego rozwiązania do domknięcia. |
| C1 | USTALONE | Projektowy przebieg od detekcji do sprawdzonego wydania i recovery w §5.1; szczegóły podlegają konsultacji, bez autoryzacji wykonania. |
| C2 | W_TRAKCIE | Ustalić wejścia, walidacje, wyjątki, ograniczenia prób i recovery. |
| C3 | W_TRAKCIE | DEC-01 przyjmuje autonomię Development i wyłączenie Production. Kandydackie klasy oraz wyłączenia v1 w §5.2 nadal do przyjęcia. |
| C4 | W_TRAKCIE | Nie zakładać nowego panelu; wpływ na stany odpowiedzi i istniejący UX sprawdzić według kanonu. |
| C5 | USTALONE | Projektowy scenariusz odbioru i negatywne próby w §5.4; liczbowe progi jakości pozostają propozycjami. |
| D1 | USTALONE | ARCHITECTURE prowadzi; CIC i SG2 zachowują własne odpowiedzialności. |
| D2 | W_TRAKCIE | PDR i kandydaci rozszerzenia SG2 rozstrzygnięci; kontroler i workflow mają NO_MATCH i wymagają onboardingu. Szczegóły w §4.7. |
| D3 | W_TRAKCIE | Drzewo obejmuje kontroler, workflow i kandydackie rozszerzenie SG2. Wyniki resolvera w §4.7; nowe lokalizacje kontrolera/workflow wymagają rejestracji. |
| D4 | W_TRAKCIE | Kontrakty logiczne, minimalny dowód i reguły wydania w §4.1–4.7; dokładne schematy, wersje oraz dopuszczenie nowych operacji nadal otwarte. |
| D5 | W_TRAKCIE | R-DATA-01 w §4.5 proponuje cel, dostęp SERVICE, klasy danych, retencję 7/90 dni i usunięcia. To rekomendacja; mandaty danych i przetwarzających nie zostały przyjęte. |
| D6 | W_TRAKCIE | R-EXEC-01 wskazuje Render worker + jednorazowe GitHub VM, nadzór i recovery. Podano koszt bazowy; pełny koszt i dopuszczenia pozostają otwarte. |
| E1 | USTALONE | Projektowa sekwencja trzech etapów rezultatowych w §5; bez uruchomienia wykonania. |
| E2 | W_TRAKCIE | Pierwszy etap ma pełny odbiór w §5.4; szczegółowe działające elementy kolejnych etapów pozostają do domknięcia. |
| E3 | W_TRAKCIE | Oddzielne mandaty ownerów i środowisk; obecnie wyłącznie projektowanie. |
| E4 | W_TRAKCIE | Test przed/po, niezależna regresja, działająca wersja, przerwanie i wycofanie. |
| E5 | W_TRAKCIE | DEC-02 obowiązuje. W §4.6 koszt bazowego kontrolera i warunek ograniczania kosztu wykonawcy; wykorzystanie baz/CI i łączny koszt do potwierdzenia. |
| F1 | W_TRAKCIE | Potrzeby właściciela i propozycje rozdzielono; otwarte decyzje w §7. |
| F2 | DO_USTALENIA | Projekt kanonu powstanie po domknięciu istotnych punktów A–E. |
| F3 | DO_USTALENIA | Brak akceptacji finalnego kanonu i planu. |
| F4 | DO_USTALENIA | Handoff do wykonania po konsultacji; bez promptu implementacyjnego obecnie. |

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

Oficjalny proxy akcji chroni klucz, ale sam nie stanowi gwarancji limitu 5 USD. **Przed autonomią potrzebny jest egzekwowalny limit wywołań modelu:** kontroler rezerwuje środki, a zaufany lokalny proces pośredniczący na VM ogranicza łączny koszt zadania i maksymalny koszt następnego żądania. Proces działa poza uprawnieniami agenta; konto agenta nie może ominąć go innym kluczem ani zmienić polityki. Cały dostęp do modeli, również próby z narzędzi i testów, podlega tej kontroli. Sprawdzenie wykonalności i zgodności wybranej wersji akcji z takim ograniczeniem jest warunkiem uruchomienia, nie potwierdzoną dziś funkcją.

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

## 5. Plan i warunki odbioru — propozycja

1. Pierwsza kompletna pętla dla ograniczonej klasy **na Development, zgodnie z DEC-01**: standard odpowiedzi, dowody, ocena, automatyczny start wykonawcy, poprawka, testy, PR, dopuszczone scalenie i wdrożenie oraz sprawdzenie skutku. Odbiór obejmuje także przerwanie i wycofanie. Wykonanie wymaga jeszcze przyjęcia szczegółowego mandatu i osobnego upoważnienia.
2. Regularne działanie i kolejne klasy: grupowanie, skalibrowane oceny, niezależne zbiory, limity prób i kosztów, obsługa wyjątków; wynik mierzy spadek błędów i nawrotów.
3. Rozszerzenie klas i ocena efektu regularnego działania v1 na Development. Production oraz inne środowiska lub konsumenci wymagają późniejszych, odrębnych decyzji; nie są ukrytym końcowym etapem v1.

### 5.1. Pełny proces naprawy — projekt do konsultacji

1. Ocena kwalifikuje problem na podstawie dowodu; brak danych do rozstrzygnięcia ma osobny wynik. Podobne problemy tworzą jeden incydent naprawczy.
2. Kontroler sprawdza dopuszczoną klasę, właściciela, środowisko Development, budżet i brak aktywnej naprawy tego samego problemu.
3. Uruchamia izolowanego wykonawcę z konkretnym przypadkiem, oczekiwaniem, bazową wersją i granicami. Treść rozmowy jest niezaufanym materiałem, nie poleceniem.
4. Wykonawca odtwarza błąd, przygotowuje test przed/po i minimalną poprawkę. Przy nierozstrzygniętej przyczynie nie wymyśla naprawy.
5. Niezależne sprawdzenie ocenia wynik na niezmienianych przez wykonawcę kryteriach. Zmiana bazy lub zakresu unieważnia odpowiednie dowody.
6. Kontroler może sam scalić i wydać dokładnie sprawdzoną zmianę, jeżeli wszystkie warunki wcześniej przyjętego mandatu są spełnione. Weryfikuje również faktyczne skutki gałęzi i automatycznych wydań: scalenie nie może pośrednio uruchomić publikacji do środowiska spoza mandatu. Brak któregoś warunku blokuje promocję; agent nie rozszerza sam uprawnień.
7. Po wydaniu kontroler sprawdza działającą wersję i nowe interakcje. Dopiero potwierdzony efekt zamyka incydent.
8. Po awarii wznawia ten sam zapis zadania od potwierdzonego stanu. Niepewny skutek operacji najpierw uzgadnia ze stanem rzeczywistym. Proponowany limit dwóch prób oraz przyjęty limit kosztu ograniczają pętlę napraw. Wyjątek trafia z dowodami do właściwego inżyniera, a pozostałe zadania mogą trwać.

Potwierdzona krytyczna regresja związana ze zmianą uruchamia wycofanie i zawieszenie kolejnych promocji jej klasy. Przy braku dowodów na bezpieczne wycofanie trzeba odciąć nową funkcję lub zastosować uzgodniony wariant bezpieczny; nie wykonywać destrukcyjnego cofania danych. Niesprawny nadzór zatrzymuje dalsze wydania.

### 5.2. Zakres klas v1 — rekomendacja, nie przyjęta lista dopuszczeń

Ocena jakości obejmuje różne moduły i problemy. Autonomiczna zmiana kodu powinna początkowo obejmować klasy sprawdzalne jednoznacznie: zakresy dat i warianty językowe, poprawne przenoszenie identyfikatorów/daty/jednostki ze źródła oraz zastosowanie istniejących zasad dla braku lub niedopasowania danych. Pierwszy pilot może udowodnić pełną pętlę na jednej z nich.

Zmiany uprawnień, licencji i źródeł, metod obliczeń finansowych/prognoz, nieodwracalne migracje, szerokie przebudowy i modyfikacje własnych bramek pozostają poza samodzielnym wykonaniem v1. Rozpoznany problem z taką przyczyną nadal podlega diagnozie i przygotowaniu dowodów. Nie wolno maskować go lokalnym obejściem.

### 5.3. Kryteria dopuszczenia — wartości do kalibracji i akceptacji

| Obszar | Proponowany punkt wyjścia |
| --- | --- |
| Klasa deterministyczna | Wszystkie obowiązkowe przypadki krytyczne i testy graniczne poprawne; błąd wykazany przed poprawką i usunięty po niej. |
| Wykrywanie krytycznych błędów semantycznych | >=95% wykrywalności; dolna granica 95% przedziału ufności >=90%, na niezależnie oznaczonych przypadkach. |
| Fałszywe alarmy | <=2% poprawnych odpowiedzi błędnie oznaczonych jako wadliwe; podać próbę i niepewność. |
| Kwalifikacja do autonomicznej naprawy | >=99% trafnych kwalifikacji, mierzone odrębnie od fałszywych alarmów i skuteczności kodowej poprawki. |
| Wydanie | Wszystkie obowiązkowe kontrole krytyczne i dostępu spełnione; brak niedopuszczalnej regresji na niezależnym zbiorze; aktualne dowody i wykonalny recovery. |

Brak wystarczającej próby dla sędziego semantycznego ogranicza jego prawo kwalifikacji do autonomii. Nie musi blokować napraw w pełni deterministycznych, które spełniają własne bramki. Liczba udanych poprawek i czas obserwacji są dodatkowymi dowodami operacyjnymi, nie samodzielną gwarancją bezpieczeństwa. Nie przyjmuje się automatycznie wcześniej zaproponowanego progu 20 poprawek.

Standard odpowiedzi: przy brakach lub sprzeczności najpierw wykonać dozwoloną próbę odzyskania właściwego kontekstu, następnie odpowiedzieć w granicach dowodów. Błąd usługi nie oznacza braku zdarzeń, niepełny kalendarz nie dowodzi pustego tygodnia, a ogólna wiedza modelu nie zastępuje aktualnego źródła. Wykryta sprzeczność blokuje publikację wadliwej odpowiedzi.

### 5.4. Odbiór pierwszego kompletnego etapu

Próba musi pokazać bez ręcznego zlecania kolejnych kroków: wykrycie bezpiecznego przypadku w rzeczywistym przepływie Development, diagnozę, uruchomienie wykonawcy, test wykazujący błąd, poprawkę, PR, dopuszczone scalenie, wdrożenie konkretnej wersji i poprawny wynik użytkownika. Syntetyczny przypadek jest dozwolony do kontrolowanego wywołania błędu, ale sama symulacja pipeline nie zastępuje działającego odbioru.

Negatywne próby obejmują: przerwanie wykonawcy i wznowienie bez duplikatu, nieudane testy bez scalenia, zmianę spoza mandatu bez promocji, wyczerpanie budżetu bez dalszych wywołań oraz potwierdzoną regresję z przywróceniem działającej wersji. Dowody nie mogą wymagać publikacji prywatnego materiału.

### 5.5. Ekonomia pilotażu — przyjęte limity i otwarte szacunki

Zgodnie z DEC-02 przyjęto projektowo: 14 dni obserwacji po pierwszym autoryzowanym uruchomieniu, **50 USD łącznie na dodatkowe wywołania modeli dla QA, replay i wykonawcy napraw**, maksymalnie 5 USD na incydent, bez automatycznego zwiększania. Maksymalnie dwie próby pozostają propozycją. To twarde granice, nie prognoza zużycia ani obecna zgoda na wydatki.

Kontroler przed uruchomieniem rezerwuje koszt wobec obu limitów: całego pilotażu i incydentu. Niepewne wywołanie nadal zajmuje rezerwację do uzgodnienia; timeout, restart lub nowy identyfikator próby nie resetują kosztu incydentu. Incydent z wyczerpanym limitem przechodzi do wstrzymania kosztowego. Automatyczne przedłużenie pilotażu ani odnowienie budżetu nie są dopuszczone.

Koszt hostingu, storage i CI należy oszacować osobno po wskazaniu miejsca wykonania; nowy płatny zasób wymaga odrębnego dopuszczenia. Limit 50 USD nie zezwala na takie zakupy. Normalne odpowiedzi użytkowników zachowują dotychczasowe rozliczenie; koszty doskonalenia są wykazywane osobno. Twardy limit zatrzymuje nowe płatne zadania, pozostawiając działające podstawowe odpowiedzi i tanie kontrole regułowe.

Przy stawkach odczytanych 12 XI 2026: 1000 ocen po 3000 tokenów wejścia i 500 wyjścia na gpt-6-luna to ok. 0,55 USD; dodatkowe 100 takich ocen na gpt-6.1-sol to ok. 1,10 USD. Jest to wyłącznie ilustracja ceny tokenów bez cache i dodatkowego rozumowania, narzędzi, wielokrotnego kontekstu lub napraw. Wykonawca kodu może zużywać znacznie więcej; o wydajności budżetu przesądzą rzeczywiste pomiary. Przekroczenie limitu nie oznacza prawa do jego podniesienia.

Do ustalenia przed autonomicznym wydawaniem: wykrywalność błędów według szkody, fałszywe alarmy, trafność kwalifikacji do naprawy, regresje, progi wycofania i wymagany materiał dowodowy. Podawać definicje, mianowniki, liczebność, niepewność i osobne wyniki domen. Krytycznych błędów nie ukrywa średnia językowa. Wzrost odmów nie może udawać poprawy.

Liczba kolejnych poprawnych napraw może być bramką operacyjną, nie gwarancją niezawodności. Niedostatek danych nie zwiększa uprawnień. Każde wydanie wymaga aktualnych dowodów i wykonalnego odzyskania. Całkowity koszt obejmie oceny, przygotowanie zmian, testy, dane i infrastrukturę. Przyjęto wyłącznie limity modeli w DEC-02; pozostałe koszty nie zostały zatwierdzone.

## 6. Decyzje i źródła

Przyjęte wymagania: cel ciągłego doskonalenia, nacisk na autonomiczne wykonanie i mierzalną gotowość, wspólny standard nietypowych sytuacji oraz minimalny udział właściciela. Polecenie uruchomienia BSDC i jedna karta nie stanowią zgody na implementację. DEC-01 przyjmuje autonomiczne naprawy i wdrożenia do Development w v1 oraz późniejsze rozpatrzenie Production; właściciel jawnie zachował tryb bez implementacji. DEC-02 przyjmuje limity modeli 50 USD / 14 dni i 5 USD / incydent bez automatycznego zwiększania. R-DATA-01 i R-EXEC-01 są autorskimi rekomendacjami, nie decyzjami właściciela. Progi jakości, liczba prób, szczegółowe klasy oraz uruchomienie nadal pozostają otwarte.

Źródła publiczne:

- [BSDC Canon](../../../v1.0-business-solution-design-and-canonization-canon.md) i [Launcher](../../../../docs/agent-instructions/bsdc-launcher-v1.0.md).
- [Rejestr projektów](../../../registries/profitia-projects-v1.json), [routing](../../../registries/current-architecture-baseline-v1.json), [aktywny manifest](../../../registries/governance-manifest-v2.json), [AGENTS.md](../../../../AGENTS.md).
- [Codex SDK — programowe wykonania](https://learn.chatgpt.com/docs/codex-sdk) i [cennik modeli](https://developers.openai.com/api/docs/pricing), odczyt 12 XI 2026; dostęp konta nie był testowany płatnym wywołaniem.
- Źródła discovery §4.3: [historia](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/lib/assistant/history.ts), [runtime](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/lib/assistant/runtime.ts), [migracja historii](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/migrations/assistant/001-history.sql), [model](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/lib/assistant/model.ts), [przebieg rozmowy](https://github.com/profitia/SG-dev/blob/4a15718ecc5b11e6749285fa528e598dda79cfc4/apps/sg-runtime/lib/assistant/conversation.ts). Dowód kodu, bez deklaracji aktywnego wdrożenia.
- Uzupełnienie §4.4–4.7: aktualne [operacje i granice E1](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/Canon/v1.0-operation-context-and-access-contract.md), [macierz AM-45–47](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/Canon/registries/operation-access-matrix-v1.json), [operation-context](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/packages/platform-contracts/src/operation-context.mjs), [źródłowy workflow ACG](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/.github/workflows/assistant-context-gateway-ci.yml) i [trusted CI controller](https://github.com/profitia/SG-dev/blob/46094e5654066552768264dd47027eaa18e833a4/scripts/governance/controlled-package-ci.mjs). Dowód źródła nie jest dopuszczeniem nowego runnera lub mandatu QA.
- Oficjalne źródła technologiczne są podlinkowane przy rekomendacjach; odczyt 12 XI 2026. Nie testowano płatnym przebiegiem kont, limitów proxy, ZDR ani przydziału zasobów. Dane prywatnego odczytu infrastruktury pozostają poza publiczną kartą.
- Potrzeba oraz uwagi A/B właściciela w poprzedzającej rozmowie są podstawą opisu biznesowego. Nie publikuje się rozmowy ani materiałów operacyjnych. Inna sesja kontynuuje z tej karty, bez domniemania dostępu do historii czatu.

## 7. Otwarte decyzje

- Szczegółowe klasy dopuszczone do naprawy; granica Development/Production została rozstrzygnięta w DEC-01.
- Mierzalne progi gotowości, liczebność prób i reguły wycofania.
- Przyjęcie R-DATA-01: minimalny prywatny dowód do 7 dni i metadane do 90 dni, prawa konta/organizacji/źródeł, usunięcia, przetwarzający i lokalizacja. Wartości są propozycjami, nie zmieniają obecnej retencji.
- Przyjęcie R-EXEC-01: Render worker + jednorazowe GitHub-hosted VM, dokładna instalacja SG2 i dopuszczenie workflow. Weryfikacja egzekwowalnego limitu modelu jest warunkiem wykonania.
- Oszacowanie infrastruktury i odpowiedzialność za wyjątki. Limity modeli pilotażu rozstrzygnięto w DEC-02; liczba prób nadal jest propozycją.

## 8. Punkt wznowienia

- Gdzie skończyliśmy: rekomendacje R-DATA-01 / R-EXEC-01, porównanie miejsc wykonania, zasady retencji/dostępu/usunięć, kontrola kosztu i aktualne rozstrzygnięcia routingu. Zapisane rekomendacje nie są implementacją ani przyjętym kanonem.
- Ostatnie zaakceptowane decyzje: DEC-01 (autonomia Development w v1, Production później) i DEC-02 (50 USD / 14 dni, do 5 USD / incydent, bez automatycznego zwiększania). Nadal bez implementacji.
- Następny krok: skonsultować rekomendowany mandat danych i wykonania, następnie domknąć klasy napraw, mianowniki/progi gotowości i kompletny plan do projektu kanonu.
- Co wymaga decyzji: R-DATA-01 i R-EXEC-01 jako część finalnego projektu; koszt infrastruktury i szczegółowy mandat. Nie ponawiać pytań o DEC-01/02. Nie zakładać zgody na dane, zasoby lub uruchomienie.
- Projekt / przyjęty kanon: BRAK — jeszcze nie przygotowano i nie zaakceptowano.

## 9. Historia

| Rewizja | Data | Zmiana |
| --- | --- | --- |
| 1 | 2026-11-12 | Pierwsza robocza karta BSDC na podstawie wcześniejszej rozmowy; publiczny zakres biznesowy, stan A–F i punkt wznowienia. |
| 2 | 2026-11-12 | Przyjęta DEC-01: autonomia Development w v1, Production później, brak implementacji. Rozwinięto proces, klasy, proponowane umiejscowienie, kryteria odbioru i roboczy budżet; pozostałe propozycje niezaakceptowane. |
| 3 | 2026-11-12 | Przyjęta DEC-02: limity modeli 50 USD / 14 dni i 5 USD / incydent, bez automatycznego zwiększania. Odświeżono źródła historii/runtime; dodano wymagania dowodu odtworzenia, granice danych i projekt trwałego wykonania. Nadal bez implementacji. |
| 4 | 2026-11-12 | Dodano R-DATA-01 i R-EXEC-01: konkretne zasady danych QA, retencja i usunięcia, Render worker + jednorazowe GitHub-hosted VM, granice poświadczeń, kontroli kosztu i odbioru. Rekomendacje niezaakceptowane; nadal bez implementacji. |
