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
| Etap | A–B; C–F do domknięcia w konsultacjach |
| Utworzono / zaktualizowano | 2026-11-12 / 2026-11-12, Europe/Warsaw |
| Rewizja | 1 |
| Rewizja bazowa ostatniej aktualizacji | NOWY PLIK; governance sprawdzone na bfc4a228d9f3d583c37c5fd984c7e4da602bf75d |
| Zadanie inicjalizacji | ARCH-BSDC-CIC-QUALITY-INIT-20261112 |
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

Te wymagania są częścią potrzeby. Szczegóły zaproponowane wcześniej przez asystenta, w tym liczby, wybór narzędzi i środowisk, pozostają rekomendacjami bez akceptacji właściciela.

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
| C1 | W_TRAKCIE | Pełny proces od wyzwalacza do potwierdzonej naprawy jest wymagany; doprecyzować przejścia. |
| C2 | W_TRAKCIE | Ustalić wejścia, walidacje, wyjątki, ograniczenia prób i recovery. |
| C3 | W_TRAKCIE | Określić jedną kompletną wersję v1 i późniejsze rozszerzenia. |
| C4 | W_TRAKCIE | Nie zakładać nowego panelu; wpływ na stany odpowiedzi i istniejący UX sprawdzić według kanonu. |
| C5 | W_TRAKCIE | Odbiór musi pokazać rzeczywisty efekt dla użytkownika i kontrolowane niepowodzenie. |
| D1 | USTALONE | ARCHITECTURE prowadzi; CIC i SG2 zachowują własne odpowiedzialności. |
| D2 | W_TRAKCIE | Ścieżka PDR dopuszczona. Dokładne przyszłe ścieżki produktu wymagają własnego resolvera. |
| D3 | W_TRAKCIE | Drzewo w §4 jest początkowe; umiejscowienie kontrolera nieprzyjęte. |
| D4 | DO_USTALENIA | Kontrakty i przepływy między komponentami do opracowania. |
| D5 | DO_USTALENIA | Własność, cel QA, dostęp, retencja i zasady wykorzystania danych do przyjęcia. |
| D6 | W_TRAKCIE | Ustalić środowiska, koszt, obserwację i bezpieczne odzyskiwanie. |
| E1 | W_TRAKCIE | Proponowane etapy rezultatowe w §5. |
| E2 | W_TRAKCIE | Pilot ma obejmować wykonawcę i potwierdzenie działania, nie tylko ocenę. |
| E3 | W_TRAKCIE | Oddzielne mandaty ownerów i środowisk; obecnie wyłącznie projektowanie. |
| E4 | W_TRAKCIE | Test przed/po, niezależna regresja, działająca wersja, przerwanie i wycofanie. |
| E5 | DO_USTALENIA | Całkowity budżet i czas do pierwszego wyniku do oszacowania. |
| F1 | W_TRAKCIE | Potrzeby właściciela i propozycje rozdzielono; otwarte decyzje w §7. |
| F2 | DO_USTALENIA | Projekt kanonu powstanie po domknięciu istotnych punktów A–E. |
| F3 | DO_USTALENIA | Brak akceptacji finalnego kanonu i planu. |
| F4 | DO_USTALENIA | Handoff do wykonania po konsultacji; bez promptu implementacyjnego obecnie. |

## 4. Architektura i umiejscowienie

Profil prowadzący wybrano zgodnie z delegacją właściciela i aktywnym rejestrem: inicjatywa obejmuje wspólną zdolność oraz współpracę kilku komponentów. Wybór nie przenosi prawa do kodu innych profili.

Początkowe drzewo publicznego repozytorium, bez nowych lokalizacji produktu:

```text
profitia/SG-dev/                           authority: main
├── Canon/proposals/bsdc/ARCHITECTURE/
│   └── cic-assistant-continuous-quality.md [NOWY DOKUMENT / jedyny cel bieżącego zapisu]
├── apps/sg-runtime/                      [ISTNIEJE / potencjalne ROZSZERZENIE / owner według rejestru]
└── packages/
    ├── assistant-context-contracts/      [ISTNIEJE / potencjalna INTEGRACJA]
    └── assistant-context-gateway/        [ISTNIEJE / potencjalne ROZSZERZENIE]
```

Źródło istniejących katalogów: publiczne drzewo SG-dev/main bfc4a228. PDR rozstrzygnięty przez aktualny resolver: Governance Source Layer / ALIGNED / ARCHITECTURE ALLOWED. Nowy dokument nie zmienia klasyfikacji powierzchni.

Dokładna lokalizacja kontrolera, kontrakty i wpływ na inne repozytoria pozostają do ustalenia. Nie tworzy się nowej aplikacji lub pakietu dla samej checklisty. Przed projektowaniem nowego komponentu sprawdzić prostsze rozszerzenie istniejącego właściciela; wymagane nowe ścieżki i uprawnienia wskazać jawnie przed implementacją. Obecnie nie modyfikuje się rejestrów ani kodu produktu.

## 5. Plan i warunki odbioru — propozycja

1. Pierwsza kompletna pętla dla ograniczonej klasy: standard odpowiedzi, dowody, ocena, automatyczny start wykonawcy, poprawka, testy, PR, dopuszczone scalenie i uruchomienie oraz sprawdzenie skutku. Odbiór obejmuje także przerwanie i wycofanie. Środowisko i mandat wymagają przyjęcia.
2. Regularne działanie i kolejne klasy: grupowanie, skalibrowane oceny, niezależne zbiory, limity prób i kosztów, obsługa wyjątków; wynik mierzy spadek błędów i nawrotów.
3. Rozszerzenie autonomii i adopcji po własnych dowodach oraz odrębnych decyzjach dla kolejnych środowisk i konsumentów.

Do ustalenia przed autonomicznym wydawaniem: wykrywalność błędów według szkody, fałszywe alarmy, trafność kwalifikacji do naprawy, regresje, progi wycofania i wymagany materiał dowodowy. Podawać definicje, mianowniki, liczebność, niepewność i osobne wyniki domen. Krytycznych błędów nie ukrywa średnia językowa. Wzrost odmów nie może udawać poprawy.

Liczba kolejnych poprawnych napraw może być bramką operacyjną, nie gwarancją niezawodności. Niedostatek danych nie zwiększa uprawnień. Każde wydanie wymaga aktualnych dowodów i wykonalnego odzyskania. Całkowity koszt obejmie oceny, przygotowanie zmian, testy, dane i infrastrukturę. Budżet nie został jeszcze zatwierdzony.

## 6. Decyzje i źródła

Przyjęte wymagania: cel ciągłego doskonalenia, nacisk na autonomiczne wykonanie i mierzalną gotowość, wspólny standard nietypowych sytuacji oraz minimalny udział właściciela. Polecenie z 12 XI 2026 uruchamia BSDC i jedną kartę, nie implementację. Szczegółowe propozycje wcześniejszej rozmowy nie uzyskały przez to statusu zaakceptowanego kanonu.

Źródła publiczne:

- [BSDC Canon](../../../v1.0-business-solution-design-and-canonization-canon.md) i [Launcher](../../../../docs/agent-instructions/bsdc-launcher-v1.0.md).
- [Rejestr projektów](../../../registries/profitia-projects-v1.json), [routing](../../../registries/current-architecture-baseline-v1.json), [aktywny manifest](../../../registries/governance-manifest-v2.json), [AGENTS.md](../../../../AGENTS.md).
- Potrzeba oraz uwagi A/B właściciela w poprzedzającej rozmowie są podstawą opisu biznesowego. Nie publikuje się rozmowy ani materiałów operacyjnych. Inna sesja kontynuuje z tej karty, bez domniemania dostępu do historii czatu.

## 7. Otwarte decyzje

- Zakres v1 i klasy dopuszczone do samodzielnej naprawy oraz promocji.
- Mierzalne progi gotowości, liczebność prób i reguły wycofania.
- Cel i zakres przetwarzania danych QA, prawa i retencja.
- Najprostsze umiejscowienie i wybór narzędzi po aktualnej weryfikacji.
- Całościowy budżet pilotażu i odpowiedzialność za wyjątki.

## 8. Punkt wznowienia

- Gdzie skończyliśmy: uruchomienie BSDC i konsolidacja potrzeby oraz uwag A/B w jednej roboczej karcie. Proces A–F pozostaje otwarty.
- Ostatnia zaakceptowana decyzja: uruchomienie procesu i delegowanie wyboru profilu. Brak zgody na wykonanie produktu.
- Następny krok: przyjąć granicę v1 i autonomii, następnie doprecyzować architekturę, dane, miary i harmonogram w tej samej karcie.
- Jedna decyzja od właściciela: czy pierwsza kompletna wersja ma samodzielnie scalać i wdrażać wcześniej dopuszczone klasy napraw do Development, z osobną późniejszą decyzją o Production? Jest to rekomendacja projektowa, nie bieżące upoważnienie do wdrożenia.
- Projekt / przyjęty kanon: BRAK — jeszcze nie przygotowano i nie zaakceptowano.

## 9. Historia

| Rewizja | Data | Zmiana |
| --- | --- | --- |
| 1 | 2026-11-12 | Pierwsza robocza karta BSDC na podstawie wcześniejszej rozmowy; publiczny zakres biznesowy, stan A–F i punkt wznowienia. |
