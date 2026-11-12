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
| Etap | C–E: doprecyzowanie funkcji, autonomii i odbioru; F przed akceptacją |
| Utworzono / zaktualizowano | 2026-11-12 / 2026-11-12, Europe/Warsaw |
| Rewizja | 2 |
| Rewizja bazowa ostatniej aktualizacji | PDR 589ee4c8187174161cc685505ef8397d43e1be5b; aktualne źródła governance main ec8afc3a6ec3501c97f4af49425626f868572b8a |
| Zadanie inicjalizacji | ARCH-BSDC-CIC-QUALITY-INIT-20261112 |
| Zadanie bieżącej aktualizacji | ARCH-BSDC-CIC-QUALITY-DESIGN-20261112 |
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

Te wymagania są częścią potrzeby. Właściciel przyjął dodatkowo granicę środowiska v1 opisaną w DEC-01 poniżej. Pozostałe propozycje, w tym liczby, wybór narzędzi i zakres dopuszczonych klas, nie uzyskały jeszcze statusu zaakceptowanego kanonu.

### 2.1. DEC-01 — decyzja właściciela, 12 listopada 2026

**PRZYJĘTA DECYZJA PROJEKTOWA:** v1 obejmuje autonomiczne naprawy, scalanie oraz wdrożenia dopuszczonych klas zmian do **Development**. **Production będzie rozpatrywane później**, poza v1. Właściciel polecił zapisanie tej decyzji i kontynuację BSDC **nadal bez implementacji**.

Decyzja ustala zakres projektowanego rozwiązania. Nie uruchamia obecnie agenta, merge do main, kosztów, nowych zasobów ani deploymentów. Nie nadaje przyszłemu systemowi prawa zmiany własnego mandatu. Staging również nie zostaje domyślnie dodany do zakresu. Wykonanie będzie wymagało przyjęcia odpowiednich reguł i odrębnego upoważnienia zgodnie z aktywnym governance.

Rekomendacja do dalszego sprawdzenia: połączyć kontrolę odpowiedzi przed jej pokazaniem z późniejszym procesem wykrycie → diagnoza → test → poprawka → niezależna weryfikacja → dopuszczone uruchomienie → sprawdzenie skutku. Wykonawca przygotowuje zmianę, a odrębny kontroler egzekwuje zakres i warunki promocji oraz nadzoruje wynik.

Preferowane jest rozszerzanie istniejących zdolności i wykorzystanie gotowych narzędzi tam, gdzie skraca to drogę do wyniku. Ostateczny wybór wykonawcy, oceniających, zapisu dowodów i umiejscowienia kodu nie jest jeszcze przyjęty. Historyczne rozpoznanie nie zastępuje sprawdzenia bieżącego stanu przed finalnym projektem.

## 3. Checklista BSDC A–F

| ID | Status | Ustalenie / co pozostaje |
| --- | --- | --- |
| A1 | USTALONE | Problem ręcznego przeglądania rozmów i zlecania napraw opisany w §1. |
| A2 | USTALONE | Użytkownicy SpendGuru; owner biznesowy Profitia. |
| A3 | W_TRAKCIE | Rezultat określony; progi, mianowniki i sposób pomiaru do przyjęcia. |
| A4 | USTALONE | Priorytet: rzeczywista poprawa i naprawy, minimalny udział właściciela, racjonalny koszt. |
| B1 | W_TRAKCIE | Wykorzystać wcześniejsze rozpoznanie i odświeżyć tylko istotne źródła. |
| B2 | W_TRAKCIE | W finalnym projekcie oddzielić obecny kod, działanie środowiska, dokumentację i hipotezy. |
| B3 | W_TRAKCIE | Porównać reuse, rozszerzenie, integrację i gotowe usługi. |
| B4 | W_TRAKCIE | Rekomendacja z §2 wymaga domknięcia wyboru i kosztów. |
| C1 | USTALONE | Projektowy przebieg od detekcji do sprawdzonego wydania i recovery w §5.1; szczegóły podlegają konsultacji, bez autoryzacji wykonania. |
| C2 | W_TRAKCIE | Ustalić wejścia, walidacje, wyjątki, ograniczenia prób i recovery. |
| C3 | W_TRAKCIE | DEC-01 przyjmuje autonomię Development i wyłączenie Production. Kandydackie klasy oraz wyłączenia v1 w §5.2 nadal do przyjęcia. |
| C4 | W_TRAKCIE | Nie zakładać nowego panelu; wpływ na stany odpowiedzi i istniejący UX sprawdzić według kanonu. |
| C5 | USTALONE | Projektowy scenariusz odbioru i negatywne próby w §5.4; liczbowe progi jakości pozostają propozycjami. |
| D1 | USTALONE | ARCHITECTURE prowadzi; CIC i SG2 zachowują własne odpowiedzialności. |
| D2 | W_TRAKCIE | Ścieżka PDR dopuszczona. Dokładne przyszłe ścieżki produktu wymagają własnego resolvera. |
| D3 | W_TRAKCIE | W §4 dodano konkretny kandydat pakietu kontrolera i workflow. Nowe ścieżki nie są zarejestrowane; nie jest to zgoda na utworzenie. |
| D4 | W_TRAKCIE | Odpowiedzialności i kontrakty logiczne w §4.1; formaty oraz wersje do domknięcia. |
| D5 | W_TRAKCIE | W §4.2 wskazano separację danych i dostęp QA; okresy retencji i podstawa przetwarzania do przyjęcia. |
| D6 | W_TRAKCIE | Ustalić środowiska, koszt, obserwację i bezpieczne odzyskiwanie. |
| E1 | USTALONE | Projektowa sekwencja trzech etapów rezultatowych w §5; bez uruchomienia wykonania. |
| E2 | USTALONE | Pierwszy etap kończy się pełną autonomiczną pętlą Development, z dowodem działania i recovery; opis w §5.4. |
| E3 | W_TRAKCIE | Oddzielne mandaty ownerów i środowisk; obecnie wyłącznie projektowanie. |
| E4 | W_TRAKCIE | Test przed/po, niezależna regresja, działająca wersja, przerwanie i wycofanie. |
| E5 | W_TRAKCIE | Robocze granice kosztu i plan pilotażu w §5.5; budżet wymaga decyzji właściciela. |
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
│   └── lib/assistant/                   [ISTNIEJE / dowody i kontrola publikacji]
├── packages/
│   ├── assistant-context-contracts/      [ISTNIEJE / INTEGRACJA / ARCHITECTURE]
│   ├── assistant-context-gateway/        [ISTNIEJE / ROZSZERZENIE / ARCHITECTURE]
│   └── assistant-quality-control/       [NOWY — PROPOZYCJA / ROUTING WYMAGA AKCEPTACJI]
│       └── src/controller.mjs           [dokładny kandydat / proponowany owner: Architecture Platform]
└── .github/workflows/
    └── assistant-quality-repair.yml     [NOWY — PROPOZYCJA / ROUTING WYMAGA AKCEPTACJI]
```

Źródło istniejących katalogów: publiczne drzewo SG-dev/main, odświeżone do ec8afc3a. PDR rozstrzygnięty przez aktualny resolver: Governance Source Layer / ALIGNED / ARCHITECTURE ALLOWED. Nowy dokument nie zmienia klasyfikacji powierzchni.

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

Rekomendacja wykonawcza: uruchamiany programowo Codex w odizolowanym środowisku, niezależnie od dostępności osobistej aplikacji właściciela. SDK zapewnia programowy start i wznowienie; konkretne środowisko, tożsamość i uprawnienia wymagają osobnej weryfikacji. Publiczne CI pozostaje wolne od prywatnych rozmów i danych oraz nie otrzymuje automatycznie sekretów modeli lub wydania. Sam wybór narzędzia nie uchyla obecnych kontroli repozytorium.

### 4.2. Dane — projektowe granice

Surowy dowód interakcji i materiał źródłowy pozostają prywatne. Publiczny PR zawiera wyłącznie kod, bezpieczny syntetyczny test i opis przyczyny bez danych użytkownika. Do obserwacji trafiają potrzebne metadane i wyniki, bez domyślnego kopiowania całej rozmowy do wielu usług.

QA korzysta z odrębnego, ograniczonego celu i uprawnienia systemowego, bez podszywania się pod użytkownika. Prawa źródła, usunięcie i retencja obejmują także pochodne. Wcześniejsze użycie źródła nie oznacza nieograniczonego prawa do późniejszego replay. Okresy retencji i dopuszczeni przetwarzający pozostają do konsultacji. Żadne dane prywatne ani materiały prywatnego CIC nie są publikowane w tej karcie.

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
8. Po awarii wznawia ten sam zapis zadania od potwierdzonego stanu. Niepewny skutek operacji najpierw uzgadnia ze stanem rzeczywistym. Proponowany limit dwóch prób i budżet zapobiegają nieskończonej pętli. Wyjątek trafia z dowodami do właściwego inżyniera, a pozostałe zadania mogą trwać.

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

### 5.5. Ekonomia pilotażu — propozycja do decyzji

Rekomendowany punkt wyjścia: 14 dni obserwacji po pierwszym uruchomieniu, **50 USD łącznie na dodatkowe wywołania modeli dla QA, replay i wykonawcy napraw**, z proponowanym podlimitem 5 USD na incydent i maksymalnie dwiema próbami. Rezerwacje obejmują skutki niepewnych wywołań; brak rozliczenia nie uwalnia automatycznie budżetu. To proponowane granice, nie prognoza zużycia ani obecna zgoda na wydatki.

Koszt hostingu, storage i CI należy oszacować osobno po wskazaniu miejsca wykonania; nowy płatny zasób wymaga odrębnego dopuszczenia. Limit 50 USD nie zezwala na takie zakupy. Normalne odpowiedzi użytkowników zachowują dotychczasowe rozliczenie; koszty doskonalenia są wykazywane osobno. Twardy limit zatrzymuje nowe płatne zadania, pozostawiając działające podstawowe odpowiedzi i tanie kontrole regułowe.

Przy stawkach odczytanych 12 XI 2026: 1000 ocen po 3000 tokenów wejścia i 500 wyjścia na gpt-6-luna to ok. 0,55 USD; dodatkowe 100 takich ocen na gpt-6.1-sol to ok. 1,10 USD. Jest to wyłącznie ilustracja ceny tokenów bez cache i dodatkowego rozumowania, narzędzi, wielokrotnego kontekstu lub napraw. Wykonawca kodu może zużywać znacznie więcej; o wydajności budżetu przesądzą rzeczywiste pomiary. Przekroczenie limitu nie oznacza prawa do jego podniesienia.

Do ustalenia przed autonomicznym wydawaniem: wykrywalność błędów według szkody, fałszywe alarmy, trafność kwalifikacji do naprawy, regresje, progi wycofania i wymagany materiał dowodowy. Podawać definicje, mianowniki, liczebność, niepewność i osobne wyniki domen. Krytycznych błędów nie ukrywa średnia językowa. Wzrost odmów nie może udawać poprawy.

Liczba kolejnych poprawnych napraw może być bramką operacyjną, nie gwarancją niezawodności. Niedostatek danych nie zwiększa uprawnień. Każde wydanie wymaga aktualnych dowodów i wykonalnego odzyskania. Całkowity koszt obejmie oceny, przygotowanie zmian, testy, dane i infrastrukturę. Budżet nie został jeszcze zatwierdzony.

## 6. Decyzje i źródła

Przyjęte wymagania: cel ciągłego doskonalenia, nacisk na autonomiczne wykonanie i mierzalną gotowość, wspólny standard nietypowych sytuacji oraz minimalny udział właściciela. Polecenie uruchomienia BSDC i jedna karta nie stanowią zgody na implementację. DEC-01 przyjmuje autonomiczne naprawy i wdrożenia do Development w v1 oraz późniejsze rozpatrzenie Production; właściciel jawnie zachował tryb bez implementacji. Liczby, narzędzia i szczegółowe klasy pozostają propozycjami.

Źródła publiczne:

- [BSDC Canon](../../../v1.0-business-solution-design-and-canonization-canon.md) i [Launcher](../../../../docs/agent-instructions/bsdc-launcher-v1.0.md).
- [Rejestr projektów](../../../registries/profitia-projects-v1.json), [routing](../../../registries/current-architecture-baseline-v1.json), [aktywny manifest](../../../registries/governance-manifest-v2.json), [AGENTS.md](../../../../AGENTS.md).
- [Codex SDK — programowe wykonania](https://learn.chatgpt.com/docs/codex-sdk) i [cennik modeli](https://developers.openai.com/api/docs/pricing), odczyt 12 XI 2026; dostęp konta nie był testowany płatnym wywołaniem.
- Potrzeba oraz uwagi A/B właściciela w poprzedzającej rozmowie są podstawą opisu biznesowego. Nie publikuje się rozmowy ani materiałów operacyjnych. Inna sesja kontynuuje z tej karty, bez domniemania dostępu do historii czatu.

## 7. Otwarte decyzje

- Szczegółowe klasy dopuszczone do naprawy; granica Development/Production została rozstrzygnięta w DEC-01.
- Mierzalne progi gotowości, liczebność prób i reguły wycofania.
- Cel i zakres przetwarzania danych QA, prawa i retencja.
- Najprostsze umiejscowienie i wybór narzędzi po aktualnej weryfikacji.
- Budżet modeli pilotażu (propozycja 50 USD / 14 dni), osobne oszacowanie infrastruktury i odpowiedzialność za wyjątki.

## 8. Punkt wznowienia

- Gdzie skończyliśmy: zapis DEC-01 i rozwinięcie projektowego przepływu, klas v1, odpowiedzialności, kryteriów oraz odbioru. Proces A–F pozostaje otwarty.
- Ostatnia zaakceptowana decyzja: v1 autonomicznie naprawia i wdraża do Development; Production później; nadal bez implementacji.
- Następny krok: uzgodnić budżet projektowy pilotażu, domknąć dane i umiejscowienie, następnie przygotować spójny projekt kanonu oraz plan do konsultacji.
- Jedna decyzja od właściciela: czy przyjąć w projekcie limit 50 USD łącznie na modele dla 14-dniowego pilotażu, z podlimitem 5 USD na incydent i bez automatycznego zwiększania? Przyjęcie limitu w projekcie nie uruchamia kosztów ani nie zatwierdza nowej infrastruktury.
- Projekt / przyjęty kanon: BRAK — jeszcze nie przygotowano i nie zaakceptowano.

## 9. Historia

| Rewizja | Data | Zmiana |
| --- | --- | --- |
| 1 | 2026-11-12 | Pierwsza robocza karta BSDC na podstawie wcześniejszej rozmowy; publiczny zakres biznesowy, stan A–F i punkt wznowienia. |
| 2 | 2026-11-12 | Przyjęta DEC-01: autonomia Development w v1, Production później, brak implementacji. Rozwinięto proces, klasy, proponowane umiejscowienie, kryteria odbioru i roboczy budżet; pozostałe propozycje niezaakceptowane. |
