# Karta Projektu BSDC — Supplier & Category Pipelines

> Jedna robocza Karta Projektu BSDC, przechowywana na GitHubie. Status `WORKING / NOT_ACCEPTED`.
> Roadmapa i rejestr wykonania pozostają wewnątrz tej Karty. Projekt rozwiązania i etapy wykonawcze wymagają odrębnych decyzji zgodnie z BSDC v1.1.

| Pole | Wartość |
| --- | --- |
| initiativeId | BSDC-20261117-SUPPLIER-CATEGORY-PIPELINES |
| projectKey | SRM |
| Nazwa | Supplier & Category Pipelines / Dostawcy i pipeline’y |
| Profil prowadzący / logical owner | SRM / SRM Runtime |
| Konsument | SG2 / SG Runtime — AppShell i adapter ADP; osobne zadania konsumenta |
| Współodpowiedzialność warunkowa | ARCHITECTURE — wyłącznie wymagane zmiany wspólnych kontraktów Identity/E1 lub governance; brak mandatu wykonawczego |
| Repozytorium / authority | profitia/SG-dev / main |
| Docelowy plik | Canon/proposals/bsdc/SRM/supplier-category-pipelines.md |
| Status projektu | WORKING / NOT_ACCEPTED |
| Gałąź robocza / przegląd dokumentacji | `sg2/bsdc-srm-supplier-category-pipelines-20261117` / [Draft PR #1123](https://github.com/profitia/SG-dev/pull/1123) |
| Pierwsza odczytana rewizja Karty | Commit `64418eb0eec57a65aa517f6fcc0e2de6adc85ec7`, blob `65ba6e07c68c47bbe8cd8c9c103e976cd83aa143`; bieżąca rewizja wynika z historii GitHub |
| Status trwałości | GITHUB / PERSISTED — pierwszy zapis potwierdzony niezależnym odczytem |
| Bieżący obszar BSDC | A–C: potrzeba i reguły pierwszej wersji; B/D rozpoczęte |
| Utworzono / zaktualizowano | 2026-11-17 / 2026-11-17, Europe/Warsaw |
| Zweryfikowane authority main przed pierwszym zapisem | f005e19c454093fb749a466713b4f343027cb065 |
| Właściciel decyzji i odbioru Development | Użytkownik `tomasz@profitia.pl` |
| taskId inicjalizacji | SRM-BSDC-SUPPLIER-CATEGORY-20261117 |
| hostConversationId | Niedostępny jako potwierdzony identyfikator platformy; nie zastąpiono identyfikatorem wywnioskowanym |
| Tryb | BUSINESS CONSULTING / DESIGN; żaden etap wykonawczy nie został uruchomiony |
| Środowisko wykonania i końcowego odbioru | Development — potwierdzone przez właściciela 2026-11-17 |

## 1. Potrzeba użytkownika i oczekiwany rezultat

Kupiec PORR wybiera ADP na biurku AppShell i otwiera widok „Dostawcy i pipeline’y”, domyślnie „Katalog dostawców”. Może znaleźć firmę po nazwie, NIP-ie lub kategorii zakupowej, dodać albo zaktualizować firmę oraz otworzyć jedną Kartę Dostawcy z katalogu i obu typów pipeline’ów.

Karta przedstawia dane identyfikacyjne i kontaktowe, wiele kategorii z kontrolowanego słownika, opiekuna relacji albo jego brak, status i aktualność ADP oraz wszystkie przypisania do procesów z bieżącymi etapami. Zespół korzysta z zapisanej wiedzy bez odtwarzania jej z maili, arkuszy i osobnych list.

### Reguły biznesowe przekazane przez użytkownika

1. Jedna firma ma jeden rekord w katalogu PORR, również bez przypisań. Udział w procesie nie tworzy drugiej firmy. Relacja do ewentualnej wspólnej tożsamości prawnej firmy wymaga sprawdzenia istniejącego modelu SRM.
2. Dostawca może należeć jednocześnie do najwyżej jednego pipeline’u typu „dostawcy”. Próba drugiego równoległego przypisania ma zostać odrzucona.
3. Dostawca może uczestniczyć w wielu pipeline’ach kategorii. „Asfalt” i „Beton” są dwoma niezależnymi przypisaniami; etap jednego nie zmienia drugiego. Dwa pipeline’y w scenariuszu odbioru nie oznaczają limitu dwóch.
4. Użytkownik może tworzyć procesy, definiować kolejność etapów i zmieniać etap dostawcy. Każdy zalogowany użytkownik SpendGuru, w obrębie własnej organizacji, ma mieć możliwość obsługi tej funkcjonalności, dodawania/usuwania dostawców, pipeline’ów i kategorii. Nie wprowadzamy odrębnych ról biznesowych bez nowej potrzeby; obowiązują rzeczywista tożsamość, uprawniony kontekst organizacji i aktywne kontrakty dostępu.
5. Dane są trwałe i współdzielone w ramach uprawnień organizacji PORR, także po ponownym zalogowaniu oraz przez innego uprawnionego członka zespołu.
6. Flow z makiety jest zaakceptowane przez użytkownika; dopuszczalne są niewielkie korekty widoków. Akceptacja flow nie oznacza przyjęcia syntetycznych danych, lokalnej symulacji ani nowego backendu.
7. „UPShell” w opisie odbioru interpretujemy jako AppShell, zgodnie z pozostałą treścią potrzeby.

### Pierwsza działająca wersja — zakres wyjściowy

| Obszar | Oczekiwane zachowanie |
| --- | --- |
| Katalog dostawców | Wyszukiwanie, dodawanie i aktualizacja firmy; jeden rekord; firmy bez przypisań pozostają widoczne. |
| Karta Dostawcy | Jeden stabilny identyfikator i ta sama karta z każdego punktu wejścia; identyfikacja, kontakty, kategorie, opiekun, ADP i przypisania. |
| Pipeline’y dostawców | Definicja procesu i etapów; najwyżej jedno równoległe członkostwo firmy w tym typie procesu. |
| Pipeline’y kategorii | Proces powiązany z kontrolowaną kategorią; wiele niezależnych członkostw i etapów tej samej firmy. |
| Dostęp i trwałość | Rzeczywisty zapis po stronie właściciela danych, uprawnienia operacji i izolacja organizacji. |

### Zakres wymagający decyzji

Współpraca, aktywności, dokumenty i umowy, oceny, X-Ray i Newsfeed nie mają jeszcze zaakceptowanego zakresu w tym wydaniu. Nie są domyślnie dopisane do implementacji. Należy ustalić także minimalny zakres zmian samego formularza ADP, źródło jego statusu i reguły aktualności.

### Doprecyzowania właściciela — 2026-11-17

- **Pipeline kategorii:** użytkownik najpierw tworzy pipeline, następnie dodaje dostawców i przyporządkowuje ich do poszczególnych etapów. To jest przyjęte flow. Właściciel nie rozstrzygnął osobno technicznej synchronizacji kategorii na karcie. Rekomendacja do pokazania w finalnych widokach: bez wymagania osobnej wcześniejszej wizyty na karcie; powiązanie kategorii powinno być spójne i jawne przy dodawaniu do procesu.
- **Duplikat po NIP-ie:** po wpisaniu NIP-u istniejącego dostawcy użytkownik otrzymuje dodatkowy ekran/stan: „Ta firma istnieje, ten dostawca istnieje w bazie” oraz link do istniejącej Karty Dostawcy. Nie powstaje nowy rekord. Wyszukiwanie i link działają wyłącznie w dozwolonym kontekście organizacji i nie ujawniają danych innych organizacji. Zasady dla firm bez NIP-u pozostają otwarte.
- **Użytkownicy:** każdy zalogowany użytkownik SpendGuru ma dostęp do funkcjonalności i dodawania/usuwania dostawców, pipeline’ów i kategorii **w obrębie własnej organizacji**. Właściciel dodatkowo potwierdził: „cały czas utrzymujemy zasadę multi-tenant i izolacji organizacji w bazie danych”. Jest to obowiązująca reguła danych, zapytań, modyfikacji, powiązań, walidacji duplikatów i autoryzacji. Projekt musi uwzględnić zabezpieczenia na poziomie bazy oraz testy uniemożliwiające powiązanie dostawcy, procesu, etapu lub kategorii z cudzą organizacją; sama filtracja interfejsu nie jest wystarczającym dowodem izolacji.
- **ADP i obszary dodatkowe:** statusy, aktualność i szczegóły zakresu zostaną doprecyzowane na konkretnych finalnych widokach. Jest to odroczenie decyzji, a nie domyślne włączenie całej makiety do v1.
- **Środowisko i odbiór:** Development; odpowiedzialny użytkownik `tomasz@profitia.pl`.
- **Przechowywanie dokumentacji:** Karta, decyzje i dowody mają być na GitHubie we właściwych miejscach. Wcześniejsza lokalna Karta i tymczasowa kopia repozytorium zostały usunięte z komputera użytkownika. Nie tworzyć kolejnych lokalnych dokumentów ani równoległej roadmapy.

## 2. Aktualne rozwiązanie i kluczowe ustalenia

### Fakty zweryfikowane 2026-11-17

- Launcher BSDC v1.1 oraz Canon v1.1 są ACTIVE w `Canon/registries/governance-manifest-v2.json` na odczytanym main. Obowiązuje 29 kryteriów, w tym E6.
- Nie znaleziono Karty tej inicjatywy na odczytanym main ani gałęzi zawierających „pipeline” w wyniku wyszukiwania GitHub. Nie jest to gwarancja braku nieopublikowanej pracy w innych sesjach. Przed pierwszym zapisem powtórzyć wąską kontrolę duplikatu.
- MagicPath ADP: projekt `465405993031966720`, komponent `465415479037693952`, odczytana rewizja canvas `470946438948491264`; dostęp OWNER, odczyt źródeł i podglądu skuteczny.
- Centralny Kanon SpendGuru: projekt `460628300646219776`, dostęp OWNER potwierdzony metadanymi. Pełna kontrola aktualnych powiązań i kwalifikacji elementów nie została jeszcze wykonana.
- Makieta w `AdpHome.tsx` otwiera katalog domyślnie. Oddziela pipeline’y typu `supplier` i `category`, przechowuje etap pod parą pipeline/dostawca i filtruje firmy zajęte już przez pipeline dostawców.
- Makieta dopuszcza dodanie firmy do pipeline’u kategorii bez sprawdzenia wcześniejszego przypisania tej kategorii na karcie. Jest to obserwacja symulacji, wymagająca decyzji biznesowej przed kontraktem backendowym.
- Przykładowy katalog w makiecie ma pojedyncze pole `category`, podczas gdy Karta Dostawcy pokazuje wielokrotne kategorie. Docelowy model musi wyjaśnić tę różnicę i korzystać z jednej kontrolowanej klasyfikacji.
- Demonstracyjne dodawanie firmy sprawdza powtórzenie nazwy bez rozróżnienia wielkości liter. Nie potwierdzono docelowego rozpoznawania po NIP-ie, firm bez NIP-u, duplikatów przy edycji ani ochrony przed równoczesnym dodaniem.
- Makieta przekazuje do otwarcia karty nazwę firmy. Docelowo potrzebny jest stabilny identyfikator rekordu; sposób jego współdzielenia należy ustalić w kontrakcie.
- Makieta zarządza tymi danymi w stanie React, oznacza demonstracyjne dane/zachowania i informuje o zapisie tylko w bieżącej sesji. Nie dowodzi trwałości ani autoryzacji.
- Aktualny `packages/srm-adp-ui/README.md` i `apps/sg-runtime/components/appshell/adp-module-host.tsx` potwierdzają granicę `PRESENTATION_ONLY / LOCAL_STATE`. Host używa lokalnego modelu i lokalnych zdarzeń. To nie jest obecnie kontrakt trwałej obsługi dostawców i pipeline’ów.
- ADP należy logicznie do SRM. SG2 jest konsumentem i właścicielem fizycznego hosta AppShell. Rozszerzenie wymaga jawnie przyjętego nowego/rozszerzonego kontraktu; nie należy dodawać operacji danych pod obietnicą niezmienionego kontraktu presentation-only.

### Rekomendowany kierunek — do opracowania i akceptacji

Rozszerzyć istniejącą zdolność SRM i reużywalny interfejs ADP, zachować AppShell jako hosta, a dane organizacji, reguły przypisań i trwałość utrzymywać po stronie SRM. Wykorzystać istniejące Identity/E1 i słowniki tam, gdzie ich przydatność zostanie potwierdzona. Nie tworzyć osobnej aplikacji, bazy ani równoległego systemu tożsamości na podstawie samej makiety.

Nie potwierdzono jeszcze rzeczywistego schematu danych, gotowości operacji E1, aktualnego słownika kategorii ani wdrożonego zachowania tych nowych funkcji. Nie są one oznaczone jako dostępne.

## 3. Checklista BSDC A–F — 29 kryteriów

Statusy odnoszą się do projektu rozwiązania. Stan wykonania etapów znajduje się osobno w §5.4.

| ID | Kryterium | Status | Ustalenie / brakujący dowód |
| --- | --- | --- | --- |
| A1 | Problem użytkownika | USTALONE | Kupiec i zespół PORR potrzebują jednego katalogu, karty relacji i widocznych niezależnych procesów zamiast historii rozproszonej w mailach i arkuszach. |
| A2 | Odbiorcy, kontekst i owner decyzji | USTALONE | Kupcy i uprawniony zespół PORR; inicjator projektu znany. Odbiera `tomasz@profitia.pl` na Development; jednakowe możliwości użytkowników w ich własnej organizacji. |
| A3 | Sprawdzalny rezultat i miara sukcesu | USTALONE | Scenariusz wyszukania/dodania, jednej karty, 1 pipeline’u dostawców i 2 kategorii, niezależności etapów i odczytu po ponownym logowaniu. Środowisko odbioru: Development; odbierający `tomasz@profitia.pl`. |
| A4 | Priorytet i granice potrzeby | W_TRAKCIE | Rdzeń v1 opisany; dodatkowe obszary makiety i kolejność potrzeb wymagają uzgodnienia. |
| B1 | Istniejące funkcje, kod, kontrakty, kanony | W_TRAKCIE | Odczytano granicę ADP, host, routing i makietę; pozostaje wąskie discovery modelu dostawców/kategorii i operacji dostępu. |
| B2 | Fakty, hipotezy i luki | USTALONE | Rozdzielone w §2 i §7; nie utożsamiono makiety i danych lokalnych z działającym backendem. |
| B3 | Reuse / extension / integration / new build | W_TRAKCIE | Rekomendowane rozszerzenie SRM i reuse ADP/AppShell; potwierdzić model i zakres dostępnych komponentów. |
| B4 | Wybór wariantu i uzasadnienie | DO_USTALENIA | Po weryfikacji niezbędnych kontraktów, danych i decyzji biznesowych. |
| C1 | Scenariusz od wejścia do wyniku | USTALONE | AppShell → ADP → katalog → jedna karta → przypisania → niezależne etapy → trwały odczyt zespołu. |
| C2 | Dane, walidacje, wyniki, edge cases | W_TRAKCIE | Znane reguły członkostwa i równe możliwości użytkowników w organizacji. Dla istniejącego NIP-u komunikat i link do karty bez nowego rekordu. Otwarte firmy bez NIP-u, cykl życia kategorii, usuwanie/archiwizacja i współbieżność. |
| C3 | v1, późniejsze usprawnienia i wyłączenia | W_TRAKCIE | Cztery główne obszary określone; dodatkowe zakładki i pełny workflow ADP do decyzji. |
| C4 | MagicPath, stany, responsywność i kwalifikacja | W_TRAKCIE | Dostęp i rewizja ADP potwierdzone; pełna kwalifikacja UI/danych/zachowania i binding z biblioteką do sprawdzenia przed zmianami. |
| C5 | Odbiór funkcjonalny użytkownika | W_TRAKCIE | Wyjściowy scenariusz zapisano w FINAL-*; uzupełnić testy decyzji biznesowych i docelowe środowisko. |
| D1 | Profil, ownerzy i granice | USTALONE | SRM prowadzi; SG2 odpowiada za AppShell/adopcję; ARCHITECTURE tylko właściwe wspólne kontrakty i governance. |
| D2 | Code Routing i Code State | W_TRAKCIE | PDR i wskazane propozycje SRM rozwiązuje aktualny resolver jako ALIGNED/ALLOWED; pełne exact paths wykonania jeszcze niezamknięte. |
| D3 | Rzeczywiste i proponowane drzewo monorepo | W_TRAKCIE | Wstępne drzewo §4; nowe pliki są propozycją, nie decyzją implementacyjną ani G1. |
| D4 | API, dane, źródła i producent–konsument | DO_USTALENIA | Potrzebny wersjonowany kontrakt SRM ↔ SG2; brak prawa importowania prywatnego kodu i bezpośredniego dostępu hosta do bazy SRM. |
| D5 | Własność, prywatność, Identity i dostęp | W_TRAKCIE | Właściciel potwierdził multi-tenant i izolację organizacji w bazie. Każdy zalogowany użytkownik działa tylko w swojej organizacji. Wyszukiwanie duplikatów i linki także podlegają izolacji; techniczna adopcja E1 i klasy pól do doprecyzowania. |
| D6 | Środowiska, zasoby, monitoring, koszt i odzyskanie | W_TRAKCIE | Development jest uzgodnionym środowiskiem realizacji i odbioru; wymagane źródła, migracje, monitoring i recovery do zaplanowania bez domniemania nowych zasobów. |
| E1 | Krótka sekwencja etapów rezultatowych | W_TRAKCIE | Roboczo 2 etapy: zdolność SRM oraz integracja i odbiór AppShell. |
| E2 | Co rzeczywiście działa po każdym etapie | W_TRAKCIE | Wyniki etapów zapisano w §5.2, zależą od zamknięcia projektu. |
| E3 | Zależności, ownerzy, zgody i środowiska | W_TRAKCIE | SRM i SG2 rozdzielone; brak mandatów etapowych i szczególnych dopuszczeń. |
| E4 | Testy i dowody business DoD | W_TRAKCIE | FINAL-* obejmują niezależne etapy, odmowę przypisania, trwałość i izolację; szczegóły po rozstrzygnięciach. |
| E5 | Koszt, ryzyko i czas do użytecznego wyniku | DO_USTALENIA | Brak podstaw do liczbowej estymaty; bez fikcyjnej daty dostawy. |
| E6 | Pełna roadmapa i rejestr w tej Karcie | W_TRAKCIE | Początkowy plan i rejestr istnieją w §5; nie jest to kompletna zaakceptowana baza END-TO-END. |
| F1 | Decyzje, założenia i otwarte kwestie | W_TRAKCIE | Zapisano ustalenia wejściowe i luki; konsultacje trwają. |
| F2 | Spójność z kanonami, routingiem i A–E | DO_USTALENIA | Wymaga zamknięcia discovery i nowego kontraktu wykraczającego poza presentation-only. |
| F3 | Akceptacja rozwiązania i roadmapy z rewizją | DO_USTALENIA | Nie przedstawiono jeszcze całości do akceptacji; brak zaakceptowanego commitu i brak zgody na wykonanie. |
| F4 | Handoff do wykonania etapów i tasków | DO_USTALENIA | Obecny handoff dotyczy wznowienia projektowania i pierwszego centralnego zapisu, nie implementacji. |

Skrót: **A=W_TRAKCIE, B=W_TRAKCIE, C=W_TRAKCIE, D=W_TRAKCIE, E=W_TRAKCIE, F=DO_USTALENIA**.

## 4. Architektura i drzewo monorepo — wstępna propozycja

Źródło istnienia katalogów: Git tree authority main `1c82689265ef0e776100808531a8f77a83a429e7`, nie nazwy usług ani lokalnych folderów.

```text
SG-dev/
├── Canon/
│   └── proposals/bsdc/SRM/
│       └── supplier-category-pipelines.md   [NOWY — PROPOZYCJA / ta jedna Karta]
├── apps/
│   ├── srm/                                [ISTNIEJE / SRM Runtime / profil SRM]
│   │   ├── app/api/                        [ISTNIEJE / kontrakty HTTP do zaprojektowania]
│   │   ├── src/server/                     [ISTNIEJE]
│   │   │   ├── supplier-catalog.ts          [NOWY — PROPOZYCJA]
│   │   │   └── supplier-pipelines.ts        [NOWY — PROPOZYCJA]
│   │   └── db/migrations/                  [ISTNIEJE / migracja po rozpoznaniu schematu i dopuszczeniu]
│   └── sg-runtime/                         [ISTNIEJE / SG Runtime / profil SG2]
│       └── components/appshell/
│           └── adp-module-host.tsx          [ROZSZERZENIE / INTEGRACJA / oddzielne zadanie SG2]
└── packages/
    └── srm-adp-ui/                          [ISTNIEJE / SRM Runtime / profil SRM]
        └── publiczny mount i typy           [ROZSZERZENIE / wersjonowany kontrakt; exact files do discovery]
```

### Routing i granice

- Docelowy PDR: resolver `RESOLVED`, `SG2-BASE-019`, Governance Source Layer, ALIGNED, SRM ALLOWED przez `Canon/**`.
- Proponowane `apps/srm/src/server/supplier-catalog.ts` i `supplier-pipelines.ts`: resolver `RESOLVED`, `SG2-BASE-016`, SRM Runtime, ALIGNED, SRM ALLOWED.
- Publiczny pakiet ADP: `SRM-ADP-BASE-001`, SRM Runtime, SRM only; aktualna odpowiedzialność nadal presentation-only. Sam routing nie przyznaje nowego zakresu backendowego pakietowi UI.
- Host `apps/sg-runtime/**` należy do SG2; PDR nie udziela SRM prawa jego edycji. Przed wykonaniem zadanie SG2 musi osobno przejść routing i własną ciągłość.
- Nowe katalogi domenowe, osobne pakiety kontraktowe lub first-class moduły nie zostały przyjęte. Gdy discovery wykaże ich konieczność, wskazać exact paths i właściwe G1 przed mutacją. Preferować rozszerzenie istniejących miejsc.
- ALIGNED jest stanem ścieżki, a nie dowodem implementacji, schematu, release ani zgody na migrację.
- Stan otwartych PR-ów i ewentualnych równoległych zmian konkretnych przyszłych plików wymaga odświeżenia przed ich wyborem do wykonania.

## 5. Roadmapa realizacji END-TO-END

> PLAN POCZĄTKOWY / NIEZAAKCEPTOWANY. Identyfikatory etapów są roboczą bazą konsultacji. Żaden etap nie ma mandatu wykonawczego. Pełne exact paths, kontrakty, zasoby i DoD zostaną zamknięte przed akceptacją łączną rozwiązania i roadmapy.

### 5.1. Cel końcowy i Business Definition of Done

Wszystkie warunki wymagają rzeczywistej wersji na uzgodnionym środowisku **Development**, z odbiorem przez **tomasz@profitia.pl**, nie tylko prototypu, PR, zielonego CI albo odpowiedzi HTTP 200.

| ID | Warunek końcowy | Oczekiwany dowód |
| --- | --- | --- |
| FINAL-01 | Uprawniony kupiec PORR wybiera ADP na biurku AppShell i trafia do „Dostawcy i pipeline’y”, domyślnie katalogu. | Rzeczywisty scenariusz użytkownika, SHA hosta i wersja kontraktu. |
| FINAL-02 | Wyszukiwanie po nazwie, NIP-ie i kontrolowanej kategorii, dodawanie oraz aktualizacja zachowują jeden rekord firmy według przyjętej polityki duplikatów. | Przypadki zwykłe i negatywne, także bez NIP-u i przy równoczesnym dodaniu. |
| FINAL-03 | Katalog i oba typy pipeline’ów otwierają tę samą kartę przez stabilny identyfikator, z danymi, kategoriami, opiekunem, statusem i aktualnością ADP oraz przypisaniami. | Spójność identyfikatora i danych ze wszystkich wejść, brak sztucznych danych. |
| FINAL-04 | Firma ma jedno przypisanie do pipeline’u dostawców; druga równoległa próba jest odrzucona przez serwer bez częściowego zapisu. | Test API i użytkownika oraz test współbieżności. |
| FINAL-05 | Ta sama firma jest w „Asfalcie” i „Betonie” z różnymi etapami; zmiana w jednym procesie nie zmienia drugiego. | Porównanie zapisów przed i po oraz odczyt po ponownym logowaniu. |
| FINAL-06 | Drugi uprawniony członek PORR po zalogowaniu widzi tę samą firmę, przypisania i zapisane etapy. | Dwa rzeczywiste uprawnione konta, odrębne sesje i odczyt trwałego stanu. |
| FINAL-07 | Osoba bez odpowiednich uprawnień i użytkownik innej organizacji nie mogą odczytać ani zmienić danych PORR, także przez bezpośrednie wywołanie API. | Odmowy operacji i testy izolacji, zmiany/utraty kontekstu organizacji oraz unieważnienia dostępu. |
| FINAL-08 | Role mogą wykonywać tylko przyjęte operacje; zmiany etapów, usuwanie/archiwizacja i relacja kategorii spełniają przyjęte reguły bez utraty danych. | Testy macierzy ról, integralności i przypadków negatywnych po decyzjach biznesowych. |
| FINAL-09 | Uruchomiona funkcja zachowuje przyjęte flow, kanoniczne stany błędu/pusto/loading, obsługę niezapisanych zmian i nawigację AppShell; demonstratory nie udają produktu. | Weryfikacja UX, klawiatury i ustalonych szerokości ekranu, kwalifikacja UI/danych/zachowania. |
| FINAL-10 | Właściwi ownerzy wydali i zweryfikowali swoje części; znany jest sposób odzyskania, monitoring oraz odbiór operacyjny. | PR/SHA/CI/release receipts, testy środowiskowe, LKG/recovery i decyzja odbioru. |

### 5.2. Etapy i taski wykonawcze — propozycja

#### E1. Trwała zdolność SRM i reużywalny interfejs

- Wynik: katalog, karta i oba rodzaje pipeline’ów działają na trwałych danych SRM, z właściwym dostępem i publicznym kontraktem dla hosta. Gotowość dla konsumenta musi być udowodniona.
- Owner/profil: SRM Runtime / SRM; wymagane zmiany wspólne realizuje właściwy producent w odrębnym zadaniu. Nie pożycza się uprawnień ARCHITECTURE ani SG2.
- Środowisko: Development, zgodnie z decyzją właściciela; fizyczne zasoby i dopuszczenia wymagają potwierdzenia.
- Warunki rozpoczęcia: akceptacja projektu i całej roadmapy względem commitu, osobna dyspozycja `URUCHOM ETAP E1`, aktualny preflight/begin oraz konieczne dopuszczenia kontraktów, operacji danych i release.
- DoD etapu: wszystkie E1-T* spełnione; rzeczywista trwałość, izolacja i integralność; wydany kontrakt i działający punkt integracji. Sam kod lub offline test nie zamyka etapu.

| Task ID | Zakres i rezultat | Owner / miejsce | Zależność | DoD i wymagany dowód |
| --- | --- | --- | --- | --- |
| E1-T01 | Przyjąć wersjonowany kontrakt modelu, operacji i UI wynikający z zaakceptowanych reguł; zamknąć wymagane dopuszczenia przed zmianami danych. | SRM; istniejący publiczny pakiet ADP, serwer SRM; wspólne E1 przez właściwego producenta. Exact paths do zamknięcia w BSDC. | Akceptacja BSDC i osobny mandat E1; konieczne decyzje wspólnego ownera. | Schemat operacji, role, błędy, tożsamość firmy, kategorie, migracja i przyjęcie konsumenta opisane/testowalne; brak ukrytej zmiany v1 presentation-only. |
| E1-T02 | Zbudować trwały katalog, dane karty i przypisania z niezależnymi etapami, ochroną duplikatów i uprawnień. | SRM / `apps/srm/`; proponowane pliki §4, API i migracja po rozpoznaniu schematu. | E1-T01, zaakceptowane zasoby i operacje danych. | Testy persystencji, serwerowej unikalności, współbieżności, kategorii i izolacji organizacji; przegląd migracji/recovery oraz właściwe dowody bazy. |
| E1-T03 | Rozszerzyć reużywalne UI o katalog i pipeline’y oraz spójną Kartę Dostawcy, zachowując flow i kanon. | SRM / `packages/srm-adp-ui/`; korekty MagicPath w zaakceptowanym zakresie. | E1-T01; integracja z E1-T02. | Jedna karta przez ID; właściwe puste/błędne/loading stany; kanoniczne komponenty, kwalifikacja i dostępność; test publicznego kontraktu. |
| E1-T04 | Uruchomić i odebrać część SRM na przyjętym środowisku, przygotować konkretny kontrakt do adopcji przez SG2. | SRM; istniejący runtime/CI/release, PDR i właściwe PMOS/PHR. | E1-T02, E1-T03, wymagane release GO i gotowość dostępu. | PR/SHA/CI/deploy, rzeczywisty odczyt po nowej sesji, test odmów i niezależnych etapów, LKG oraz rozliczenie E1 z brakami. |

#### E2. Integracja AppShell i odbiór całego scenariusza PORR

- Wynik: użytkownik realizuje pełny scenariusz z biurka AppShell na rzeczywistych, uprawnionych i trwałych danych.
- Owner/profil: SG Runtime / SG2 dla hosta; SRM dla korekt producenta i wsparcia kontraktu. Każdy zachowuje własne zadanie i ciągłość.
- Środowisko realizacji i końcowego odbioru: **Development**. Odbierający: **tomasz@profitia.pl**. Staging/Production pozostają poza tym zleceniem.
- Zależności: rozliczenie E1 i gotowość kontraktu; osobna dyspozycja właściciela na E2; właściwe dopuszczenia SG2 i testowe tożsamości PORR.
- DoD etapu: potwierdzone wszystkie FINAL-*, rozliczenie obu ownerów, operacyjny odbiór i aktualny rejestr. Niespełnione warunki dają CZĘŚCIOWY albo ZABLOKOWANY.

| Task ID | Zakres i rezultat | Owner / miejsce | Zależność | DoD i wymagany dowód |
| --- | --- | --- | --- | --- |
| E2-T01 | Przyjąć dokładną wersję publicznego kontraktu SRM i podłączyć autoryzowany transport w AppShell, zachowując hostową nawigację, motyw i jedną Kartę Dostawcy. | SG2 / `apps/sg-runtime/`, w tym `components/appshell/adp-module-host.tsx`; exact files po zamknięciu projektu. | E1, osobny mandat E2, operacje dostępu i wersja kontraktu. | Wyjście z lokalnych fixtures na prawdziwe dane; test wejścia ADP/katalogu, błędów transportu, odświeżenia, deep linku i zmiany tożsamości. |
| E2-T02 | Wydać integrację i przeprowadzić realny odbiór PORR, w tym dwie osoby, ponowne logowanie, konflikt przypisania i niezależne etapy kategorii. | SG2 + SRM w swoich zakresach; odbierający biznesowy PORR. | E2-T01, dozwolone środowisko/release i konta odbiorowe. | Wszystkie FINAL-* z dowodem na konkretnej wersji; regresja AppShell, odmowy dostępu, recovery/monitoring i rozliczenie etapu. |

### 5.3. Kolejność, autonomia i wymagane decyzje

- E1-T02 i E1-T03 mogą postępować równolegle dopiero po stabilnym E1-T01 i w granicach aktywnego E1. Zmiany wspólnych producentów muszą zostać osobno przyjęte, jeśli są potrzebne.
- Nie rozpoczynać E2, jego tasków ani niezależnych przygotowań wykonawczych przed rozliczeniem E1 i nową wyraźną dyspozycją właściciela.
- Każdy etap jest realizowany w Full Autopilot wyłącznie w granicach przyznanego mandatu, z Universal Project Execution v1.2, aktualnym governance i szczególnymi dopuszczeniami.
- Akceptacja kanonu/roadmapy nie jest zgodą na implementację, migrację, nowe zasoby, granty, koszt, merge ani deployment. Konkretne operacje mogą zostać objęte mandatem tylko zgodnie z aktywnymi regułami.
- Nowe zasoby i uprawnienia nie są założone. Przy potrzebie nowego ownership/path family wymagane jest właściwe przyjęcie G1.
- Koszt, czas, skala katalogu i liczba współbieżnych użytkowników: DO_OSZACOWANIA po minimalnym discovery. Nie przyjęto fikcyjnych dat.
- Warunek zamknięcia BSDC: pełny projekt i kompletna roadmapa w tej Karcie, wszystkie 29 kryteriów z uzasadnieniem, akceptacja właściciela obu części względem konkretnej rewizji.

### 5.4. Rejestr realizacji etapów i tasków

Bieżący mandat wykonawczy: **BRAK**. Zlecenie obejmuje konsultacje BSDC i dopuszczony zapis roboczej Karty. E1 i E2 nie zostały uruchomione.

Rozliczenie ostatniego etapu: nie dotyczy — brak wykonania. Dyspozycja następnego etapu: BRAK. PR/commit Karty dokumentują projektowanie. CI produktu, deployment i dowody końcowego odbioru: BRAK.

| ID | Status | Początek / koniec | taskId / owner | Dowody PR / SHA / CI / deploy / test | Braki / następny krok |
| --- | --- | --- | --- | --- | --- |
| E1 | NIE_ROZPOCZĘTY | — | Do nadania / SRM | — | Najpierw zamknięcie BSDC, akceptacja i osobny mandat. |
| E1-T01 | NIE_ROZPOCZĘTY | — | Do nadania / SRM i właściwi producenci | — | Kontrakt i reguły biznesowe. |
| E1-T02 | NIE_ROZPOCZĘTY | — | Do nadania / SRM | — | E1-T01 oraz właściwe dopuszczenia danych. |
| E1-T03 | NIE_ROZPOCZĘTY | — | Do nadania / SRM | — | Przyjęta kwalifikacja i kontrakt UI. |
| E1-T04 | NIE_ROZPOCZĘTY | — | Do nadania / SRM | — | Rzeczywiste uruchomienie i odbiór etapu. |
| E2 | NIE_ROZPOCZĘTY | — | Do nadania / SG2 + SRM | — | Rozliczenie E1 i osobna dyspozycja E2. |
| E2-T01 | NIE_ROZPOCZĘTY | — | Do nadania / SG2 | — | Wersja producenta, mandat, własne bramki konsumenta. |
| E2-T02 | NIE_ROZPOCZĘTY | — | Do nadania / SG2 + SRM + PORR | — | Środowisko, wydanie i pełny odbiór FINAL-*. |

Po akceptacji projektu bazowy zakres i DoD zostają zamrożone z referencją do commitu. Rejestr jest nadal aktualizowany w tym samym pliku; statusy i dowody nie zmieniają po cichu przyjętej bazy. PMOS/PHR pozostają właściwymi systemami dowodowymi.

### 5.5. Końcowy odbiór END-TO-END

| ID | Warunek / środowisko | Status | Dowód rzeczywisty |
| --- | --- | --- | --- |
| FINAL-01 | Wejście AppShell → ADP → katalog / Development | DO_POTWIERDZENIA | — |
| FINAL-02 | Wyszukiwanie, zapis i deduplikacja | DO_POTWIERDZENIA | — |
| FINAL-03 | Jedna spójna Karta Dostawcy | DO_POTWIERDZENIA | — |
| FINAL-04 | Najwyżej jeden pipeline dostawców, także przy współbieżności | DO_POTWIERDZENIA | — |
| FINAL-05 | Wiele kategorii i niezależne etapy | DO_POTWIERDZENIA | — |
| FINAL-06 | Trwały odczyt przez drugiego kupca PORR | DO_POTWIERDZENIA | — |
| FINAL-07 | Odmowy operacji i izolacja organizacji | DO_POTWIERDZENIA | — |
| FINAL-08 | Przyjęte role i integralność cyklu życia | DO_POTWIERDZENIA | — |
| FINAL-09 | Flow, stany i kanoniczny UX | DO_POTWIERDZENIA | — |
| FINAL-10 | Wydanie, monitoring, recovery i operacyjny odbiór | DO_POTWIERDZENIA | — |

## 6. Decyzje, założenia i źródła

### Rejestr ustaleń wejściowych

| ID | Ustalenie | Źródło / status |
| --- | --- | --- |
| DEC-01 | Prowadzenie inicjatywy metodą BSDC v1.1 i krokowe konsultacje. | Polecenie użytkownika, 2026-11-17. |
| DEC-02 | Jeden rekord firmy, najwyżej jeden pipeline dostawców i wiele niezależnych pipeline’ów kategorii. | Potrzeba i warunek odbioru użytkownika. |
| DEC-03 | Flow makiety zaakceptowane; widoki mogą wymagać niewielkiej korekty. | Polecenie użytkownika. Nie obejmuje automatycznej kwalifikacji wszystkich osi do produktu. |
| DEC-04 | Profil prowadzący SRM, konsument SG2. | Wybór w ramach „ustal sam”, na podstawie aktualnego ownership ADP i hosta. |
| DEC-05 | Projekt i roadmapa pozostają robocze; brak akceptacji całości i brak mandatów E1/E2. | Granice polecenia i aktywnego BSDC. |
| DEC-06 | Pipeline powstaje przed dodawaniem dostawców z przyporządkowaniem do etapów; brak osobnej decyzji o synchronizacji kategorii na karcie. | Odpowiedź właściciela 2026-11-17. |
| DEC-07 | Istniejący NIP → komunikat o duplikacie i link do istniejącej karty w tej organizacji; bez tworzenia drugiego rekordu. | Odpowiedź właściciela 2026-11-17. |
| DEC-08 | Każdy zalogowany użytkownik może obsługiwać funkcję we własnej organizacji; multi-tenant i izolacja organizacji w bazie danych są obowiązkowe. | Odpowiedź oraz dwa jawne potwierdzenia właściciela 2026-11-17. |
| DEC-09 | Development; odbiór przez tomasz@profitia.pl. | Odpowiedź właściciela 2026-11-17. |
| DEC-10 | Szczegóły ADP i obszarów dodatkowych omawiane na finalnych widokach; nadal nie przyjęto ich pełnego zakresu. | Odpowiedź właściciela 2026-11-17. |
| DEC-11 | Dokumentacja, Karta i dowody wyłącznie na GitHubie; lokalne kopie na komputerze użytkownika usunięte. | Dyspozycja właściciela i wykonana korekta 2026-11-17. |

### Źródła authority

- [Launcher BSDC v1.1](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/bsdc-launcher-v1.1.md)
- [BSDC Canon v1.1](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-business-solution-design-and-canonization-canon.md)
- [AGENTS.md](https://github.com/profitia/SG-dev/blob/main/AGENTS.md)
- [Manifest](https://github.com/profitia/SG-dev/blob/main/Canon/registries/governance-manifest-v2.json)
- [Rejestr projektów](https://github.com/profitia/SG-dev/blob/main/Canon/registries/profitia-projects-v1.json)
- [Routing i ownership](https://github.com/profitia/SG-dev/blob/main/Canon/registries/current-architecture-baseline-v1.json)
- [Agent Execution Canon v3.0](https://github.com/profitia/SG-dev/blob/main/Canon/v3.0-profitia-agent-execution-canon.md)
- [Business Outcome Engineering v1.1](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/business-outcome-engineering-v1.1.md)
- [Universal Project Execution v1.2](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/profitia-universal-project-execution-v1.2.md)
- [Full Autopilot v2.0](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/full-autopilot-v2.md)
- [UX/UI Design Canon](https://github.com/profitia/SG-dev/blob/main/docs/agent-instructions/ux-ui-design-canon.md)
- [SRM architecture](https://github.com/profitia/SG-dev/blob/main/Canon/v1.0-srm-architecture-and-component-placement-canon.md)
- [ADP presentation mounting amendment](https://github.com/profitia/SG-dev/blob/main/Canon/v1.1-srm-adp-presentation-mounting-amendment.md)
- [Aktualny kontrakt pakietu ADP](https://github.com/profitia/SG-dev/blob/main/packages/srm-adp-ui/README.md)
- [Aktualny host ADP](https://github.com/profitia/SG-dev/blob/main/apps/sg-runtime/components/appshell/adp-module-host.tsx)
- [Makieta ADP](https://www.magicpath.ai/files/465405993031966720), komponent/revizja zapisane w §2.
- [Kanon SpendGuru](https://www.magicpath.ai/files/460628300646219776)

Przed wznowieniem odczytać aktualne authority main i centralną Kartę, jeśli już powstała; powyższa rewizja jest dowodem odczytu, nie obietnicą braku dalszych zmian.

## 7. Otwarte kwestie i rzeczywiste blokery

### Pozostałe decyzje na konkretnych finalnych widokach

1. **Kategoria a członkostwo:** czy wejście do pipeline’u wymaga wcześniejszego przypisania kategorii na karcie? Czy dodanie do procesu może jawnie przypisać kategorię? Co z odpięciem kategorii przy istniejącym członkostwie?
2. **Duplikaty:** zasady normalizacji NIP-u, identyfikatorów zagranicznych i firm bez NIP-u; podejrzenie duplikatu, blokada, wyjaśnienie i ewentualne scalanie bez utraty przypisań. Nie zakładać, że taka sama nazwa zawsze oznacza tę samą firmę.
3. **Dostęp — ROZSTRZYGNIĘTE:** każdy zalogowany użytkownik działa w swojej organizacji; multi-tenant i izolacja w bazie są obowiązkowe. Pozostaje projekt technicznej adopcji istniejących kontraktów, a nie ponowna decyzja o odrębnych rolach.
4. **ADP:** definicje statusów i aktualności, źródło informacji i osoba uprawniona do ich zmiany. Czy v1 obejmuje tylko zapis metadanych, czy też pełny workflow formularza, weryfikacji i odnowienia?
5. **Zakres v1:** decyzja o współpracy, aktywnościach, dokumentach/umowach, ocenach, X-Ray i Newsfeed; co działa, co jest pominięte i jakie stany pokazuje karta.
6. **Cykl życia:** archiwizacja procesu/firmy, przejście między pipeline’ami dostawców, zmiana/usunięcie zajętego etapu, historia zmian i reakcja na równoczesną edycję. Znaczenie „jednocześnie” musi być spójne z archiwizacją.
7. **Odbiór — ROZSTRZYGNIĘTE:** Development i tomasz@profitia.pl. Pozostaje przygotowanie realnych kont oraz reprezentatywnej skali danych w ramach przyszłego mandatu.

Nie są to wady promptu ani powód do zatrzymania konsultacji. Są to decyzje, które metodologia ma pomóc wypracować.

### Trwały zapis i kontrola inicjalizacji

Kontrole przeprowadzono w istniejącym Codespace SRM, na izolowanym aktualnym checkoutcie authority `f005e19c454093fb749a466713b4f343027cb065`.

- Manifest: PASS; 80 aktywnych dokumentów zwalidowanych narzędziem repozytorium.
- Profil SRM, repozytorium, Code State, topologia Development, wejście taska i routing docelowego pliku: PASS.
- PMOS_RUNTIME_GATE: PASS po kanonicznym odświeżeniu kontekstu właściwego projektu SRM.
- Canonical `pmos:begin`: REGISTERED, `registrationId=cmwkso3b70000gxj1pg625oy3`, baza ciągłości `srm_pmos`.
- `conversationId=pmos-task-v2:fa4089380809f7f0dd89e22da63a8b02e61eae0bb4c9a081c8d032461afa0353`; `hostConversationId=null`, ponieważ host nie udostępnił potwierdzonego stabilnego ID.
- Pełny preflight `--require-begin`: PASS, bez blocking gates.
- Zakres zadania: `documentation`, `taskId=SRM-BSDC-SUPPLIER-CATEGORY-20261117`; wyłącznie ten jeden PDR. Nie uruchomiono etapu E1/E2 ani operacji produktowych.
- Plan transportu dokumentacyjnego odczytano z aktualnego `development-execution.mjs`. Użyta gałąź ma wymagany prefiks `sg2/`; nazwa gałęzi nie zmienia profilu prowadzącego SRM ani ownership.
- Centralny plik: `Canon/proposals/bsdc/SRM/supplier-category-pipelines.md` na gałęzi `sg2/bsdc-srm-supplier-category-pipelines-20261117`. Jest to roboczy dokument inicjatywy, nie aktywacja kanonu rozwiązania ani dowód przyjęcia do main.
- Pierwszy zapis potwierdzono niezależnym odczytem GitHub i porównaniem całej treści: commit `64418eb0eec57a65aa517f6fcc0e2de6adc85ec7`, blob `65ba6e07c68c47bbe8cd8c9c103e976cd83aa143`. Bieżący commit wynika z historii tego pliku; brak zaakceptowanego commitu projektu/roadmapy.
- Utworzono [Draft PR #1123](https://github.com/profitia/SG-dev/pull/1123) zawierający jeden plik dokumentacyjny. PR pozostaje roboczy; nie deklaruje się przyjęcia do main ani spełnienia przyszłych bramek merge/release.
- PMOS/PHR są systemami dowodowymi zadania; ich finalny zapis odwołuje się do tego taskId i rzeczywistej rewizji PDR. Dokumentacja i dowody publikowane są na GitHubie; lokalna Karta i tymczasowy checkout na komputerze użytkownika zostały usunięte.

Poprzedni `PERSISTENCE_BLOCKED` dotyczył stanu przed uruchomieniem właściwego środowiska i zamknięciem jego bramek. Nie jest bieżącym statusem tej zapisanej Karty.

## 8. Punkt wznowienia — handoff ChatGPT / Codex

- Ostatni wynik: jedna robocza Karta na GitHubie, z odpowiedziami właściciela; właściwy profil SRM, routing i wymagane bramki potwierdzone. Projektowanie trwa.
- Aktywny zakres: projektowanie BSDC i pierwsze utrwalenie jednej Karty, nie implementacja produktu.
- Pierwszy krok wznowienia: odczytać najnowszy PDR na wskazanej gałęzi GitHub, sprawdzić ewentualne przyjęcie do main i kontynuować w tym samym pliku bez tworzenia duplikatu.
- Każdą istotną decyzję aktualizować w tym samym pliku na GitHubie. Nie utrzymywać lokalnych kopii dokumentacji, Karty ani dowodów na komputerze użytkownika.
- Następna konsultacja: projekt finalnych widoków i stanów w przyjętym flow. Doprecyzować zachowanie kategorii, ADP i firm bez NIP-u na konkretnych przykładach ekranów; nie wracać do rozstrzygniętych zasad dostępu i środowiska.
- Ostatnie decyzje: flow makiety, tworzenie pipeline’u przed dodawaniem dostawców z wyborem etapów, wykrywanie istniejącego NIP-u, równe możliwości użytkowników we własnej organizacji, multi-tenant w bazie, Development, odbiór przez tomasz@profitia.pl i dokumentacja wyłącznie na GitHubie. Nie zaakceptowano jeszcze kompletnego rozwiązania/roadmapy.
- Aktywny etap wykonawczy: BRAK. Wszystkie taski E1/E2 pozostają NIE_ROZPOCZĘTE.
- Pozostałe zadania projektowe: minimalne discovery SRM/Identity/kategorii, decyzje §7, kwalifikacja UX i binding, kontrakty, exact paths, pełna roadmapa/DoD/mandaty oraz łączny przegląd do akceptacji konkretnej rewizji.
- Po akceptacji: zamrozić projekt i plan względem commitu, utrzymywać dalej rejestr w tej Karcie, oczekiwać odrębnego zlecenia konkretnego etapu.
