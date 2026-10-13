# E0-A-03: instrukcja przygotowania zasobów Architecture Development

**Status:** E0_A_03_COMPLETE — właściciel przyjął pozostanie w obecnej organizacji Neon Scale; zasoby i konfiguracja zostały odebrane. Profil ARCHITECTURE pozostaje nieaktywny.

**Wersja:** 1.2, 13 października 2026.

**Podstawa:** [plan wykonawczy E0-A](../v1.0-architecture-parallel-development-onboarding-plan.md) i [dowody wykonania 01–02](../evidence/2026-10-13-e0-a-01-02-implementation-verification.md).

Właściciel wykonuje poniższe czynności, a następnie potwierdza ich wykonanie i poleca kontynuację E0-A-03. Agent odczyta rzeczywiste ID przez istniejące połączenia i sprawdzi przeznaczenie, konfigurację oraz koszt. Ta instrukcja przygotowuje infrastrukturę; nie aktywuje profilu ARCHITECTURE ani nie potwierdza gotowości trzech torów.

## Aktualny wynik wykonania

Instrukcję wykonano i zweryfikowano 13 października. [Historyczne dowody zasobów i korekt](../evidence/2026-10-13-e0-a-03-resource-configuration-verification.md) zachowują pierwotne ustalenia i otwarty wówczas wyjątek kosztowy. [Końcowy odbiór 03](../evidence/2026-10-13-e0-a-03-shared-organization-acceptance.md) rozstrzyga ten wyjątek decyzją właściciela: oba projekty pozostają w org-nameless-field-92563437 na Scale, bez nowej organizacji i transferu. Poprawne przypisanie: PMOS to billowing-credit-07394675 / br-curly-dream-b94be6uh, laboratorium to fancy-cell-49425728 / br-divine-fog-baohc5ay. Oba compute i project defaults mają 0.25–1 CU i 300 sekund usypiania. Render development jest pusty i ma Blocked cross-environment connections. GitHub environment jest poprawny, a konto profitia korzysta z miesięcznego Pro.

Poniższe kroki pozostają instrukcją odtworzenia. Nie należy ponownie tworzyć wymienionych zasobów. Etap 03 zakończono; dalsze etapy 04–09 nie zostały rozpoczęte i nie są uruchamiane przez tę instrukcję.

## 1. Neon — dwa nowe projekty i puste bazy

Otwórz [Neon Console](https://console.neon.tech). Użyj tej samej organizacji, w której znajdują się SRM i spendGuru 20 PMOS: org-nameless-field-92563437. Odczyt 13 października potwierdził obecny plan Scale; pozostaw ten plan organizacji.

| Projekt do utworzenia | PostgreSQL | Gałąź | Bazy na tej gałęzi | Przeznaczenie |
| --- | --- | --- | --- | --- |
| profitia-architecture-pmos | 17 | development | architecture_pmos | Historia i ciągłość prac architektury |
| profitia-architecture-lab | 18 | development | architecture_sg_lab oraz architecture_srm_lab | Oddzielne, puste magazyny testowych instancji SG i SRM |

Wersja 17 odpowiada obecnemu PMOS. Wersja 18 odpowiada odczytanym SRM i Dynamic Market Data Store. Są to ustawienia nowych projektów, nie aktualizacja istniejących baz.

### Utworzenie projektów

1. Kliknij **New Project**.
2. Wpisz nazwę z tabeli i wybierz **AWS / Frankfurt**, region aws-eu-central-1.
3. W **Services** pozostaw **Postgres database**. Rozwiń jego ustawienia i wybierz wersję z tabeli. Auth, Functions, Object Storage i AI Gateway nie są potrzebne w tym kroku.
4. Kliknij **Create project**. Powtórz dla drugiego projektu. [Dokumentacja tworzenia projektów](https://neon.com/docs/manage/projects).

### Gałąź Development

1. Wejdź do NOWEGO projektu i wybierz **Branches → New branch**.
2. Parent branch: początkowa, pusta gałąź tego nowego projektu. Konsola zwykle nazywa ją production; ta nazwa nie oznacza istniejącej bazy produkcyjnej SG lub SRM.
3. Branch name: **development**. Wybierz **Schema only**, aby nie przenosić danych.
4. Odznacz **Automatically delete branch after**. Ten Development ma być trwały.
5. Utwórz gałąź z compute umożliwiającym połączenie. Powtórz w drugim nowym projekcie. [Dokumentacja gałęzi i wygasania](https://neon.com/docs/manage/branches).

### Puste bazy

1. Wybierz projekt i gałąź **development** w górnym menu konsoli.
2. Otwórz **Postgres database → Databases → Add database**.
3. Dodaj bazę lub bazy z tabeli. Wybierz domyślnego właściciela tego NOWEGO projektu.
4. Pozostaw bazy puste. Nie importuj danych ani nie uruchamiaj ręcznych migracji. Domyślna pusta baza neondb może pozostać niewykorzystywana. [Dokumentacja baz](https://neon.com/docs/manage/databases).

### Moc, automatyczne usypianie i koszt

1. Dla development otwórz **Postgres database → Computes → Edit**.
2. Ustaw autoscaling **minimum 0.25 CU, maximum 1 CU**.
3. Włącz **Scale to Zero** po **5 minutach** bezczynności; zapisz ustawienia.
4. Zastosuj te ustawienia również do compute początkowej gałęzi nowego projektu, żeby nie pozostawić jej stale aktywnej z większym limitem.
5. W ustawieniach nowego projektu, **Postgres → Compute defaults**, ustaw te same wartości dla przyszłych compute. Zmiana defaults nie aktualizuje już istniejących compute. [Compute settings](https://neon.com/docs/manage/computes), [defaults](https://neon.com/docs/manage/projects), [Scale to Zero](https://neon.com/docs/introduction/scale-to-zero).

Limit 1 CU ogranicza moc, a nie miesięczny rachunek. Scale to Zero ogranicza czas aktywnego compute; storage i historia mają osobne rozliczenie. W potwierdzeniu podaj akceptowany miesięczny limit kosztu nowych zasobów oraz limit jednorazowy. Nie zmieniaj planu organizacji ani ustawień obecnych projektów biznesowych.

Nie trzeba przekazywać haseł ani connection stringów w czacie. Po potwierdzeniu agent odczyta ID projektów, gałęzi, baz i endpointów. Połączenia i późniejsze role runtime zostaną przygotowane w przeznaczonej chronionej konfiguracji, po kontroli tożsamości nowych zasobów.

## 2. GitHub — środowisko architektury

Otwórz [Settings → Environments w profitia/SG-dev](https://github.com/profitia/SG-dev/settings/environments).

1. Kliknij **New environment**.
2. Nazwa: **architecture-development**. Kliknij **Configure environment**.
3. W **Deployment branches and tags** wybierz **Selected branches and tags** i dodaj branch **main**.
4. W tym Development pozostaw wyłączone Required reviewers i Wait timer. Zasady obecnych Staging/Production oraz ochrona main pozostają właściwe dla tych obszarów.
5. W **Environment variables** dodaj trzy niesekretne zmienne:

| Nazwa zmiennej | Wartość |
| --- | --- |
| PROJECT_KEY | ARCHITECTURE |
| TARGET_ENVIRONMENT | development |
| PMOS_MEMOROS_MODE | disabled |

Są to parametry przyszłego workflow. Samo ich dodanie nie uruchamia profilu ani nie zmienia konfiguracji działających aplikacji. Sekrety dla nowego obszaru zostaną dodane po weryfikacji zasobów; nie kopiuj sekretów innych środowisk. [Dokumentacja GitHub Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## 3. Render — pusty projekt i środowisko

Otwórz [Render Dashboard](https://dashboard.render.com) i wybierz **PROFITIA WORKSPACE**, workspace tea-d7lps8rbc2fs73cn80dg.

1. Kliknij **New → Project**.
2. Project name: **ARCHITECTURE**.
3. First environment name: **development**.
4. Kliknij **Create a project**. Pozostaw środowisko puste — bez przenoszenia istniejących usług.
5. W ustawieniach środowiska włącz blokowanie prywatnego ruchu między środowiskami, jeżeli opcja jest dostępna w obecnym planie. Jeśli wymaga zmiany planu, odnotuj to w potwierdzeniu. Nie uruchamiaj upgrade'u na potrzeby tego kroku. [Projekty i środowiska Render](https://render.com/docs/projects).

W tym punkcie nie twórz jeszcze usług web, workers, cron, Postgres ani Key Value na Render i nie konfiguruj domen/DNS. Bazy tego obszaru są w Neon. Dokładne deklaracje usług i ich uruchomienie wymagają konfiguracji workspace i aktywacji profilu z etapów 04–05, a raportowanie jest odbierane w 07. Pusty projekt Render jest miejscem na te usługi, nie dowodem działającej aplikacji.

Kontrola prywatnej sieci Render nie obejmuje zewnętrznych połączeń z Neon. Właściwe projekty, połączenia, role i sekrety będą weryfikowane osobno.

## 4. PHR i pozostałe komponenty

PHR zachowuje repozytorium profitia/project-history-repository. Dla tego przebiegu agent przygotował osobny lokalny klon i potwierdził publikacje etapów 01–02. Właściciel nie tworzy nowego repozytorium PHR ani nowej implementacji PMOS.

CIC, SpendGuru, SRM, Memoros, MGBI i Vercly nie wymagają czynności serwisowych w tym punkcie. Laboratorium otrzyma kontrolowane dane testowe w późniejszym zakresie; nie importuje prywatnych danych PORR.

## 5. Procedura potwierdzenia przy odtwarzaniu zasobów

Aktualny odbiór E0-A-03 jest zakończony. Przy odtwarzaniu zasobów można przekazać potwierdzenie w tej postaci, uzupełniając kwoty i ewentualne odstępstwa:

> Neon: oba projekty i development bez automatycznego wygasania utworzone; trzy puste bazy gotowe; compute 0.25–1 CU, Scale to Zero 5 minut, również na początkowych gałęziach.
>
> GitHub: architecture-development utworzone, main dodany i trzy zmienne ustawione.
>
> Render: ARCHITECTURE / development utworzone, środowisko puste; blokada prywatnej sieci włączona / niedostępna w obecnym planie.
>
> Akceptowany limit nowych zasobów: … USD miesięcznie i … USD jednorazowo. Odstępstwa: … . Możesz kontynuować E0-A-03.

Jeżeli użyjesz innych nazw, podaj nazwy lub adresy stron konfiguracji bez sekretów. Nie musisz kopiować technicznych ID: agent odczyta je i porówna z zasobami istniejącymi, aby potwierdzić brak przepięcia.

Po potwierdzeniu agent zweryfikuje stan serwisów i przygotuje dalszą konfigurację etapu 03 w jego zakresie. E0-A-04 do 09 nie są uruchamiane automatycznie przez potwierdzenie tej instrukcji. Do aktywacji w 05 ARCHITECTURE pozostaje nieznanym projektem dla zwykłego wykonania zadań.
