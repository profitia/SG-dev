# SRM — jeden przebieg raportu spółki z jawnymi zależnościami, 19.10.2026

Status: SOURCE_CANDIDATE_NOT_RELEASED / PROGRAMME_IN_PROGRESS.

Zadanie `SRM-E1-COMPANY-ORCHESTRATION-20261019`, profil SRM, workspace SG-dev Codespaces SRM, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority: profitia/SG-dev/main; punkt wyjścia `98aa36cdd81aee9f58cd7fff363b8810894fe95e`. Własny PMOS/PHR; MEMOROS wyłączony profilem. Rejestracja nie jest dowodem closeout.

## Zmiana i zachowanie biznesowe

Dotychczasowy `runXrayLookup` łączył cały przebieg z domyślną bazą i klientami dostawców. `createXrayCompanyLookup` umożliwia jawne podłączenie kompletu szesnastu funkcji serwerowych do **tej samej** implementacji przebiegu. Nie powstał drugi algorytm raportu. Dotychczasowi odbiorcy zachowują wszystkie pierwotne zależności.

Zachowano kolejność i warunki rejestracji, cache, historii rejestru i PKD, reprojekcji, prywatnych archiwów, dokumentów i MSR, snapshotów, publikacji katalogu, obliczania wskaźników oraz zapisu zainteresowania dostawcą. Porównanie źródeł potwierdziło równość całego dotychczasowego przebiegu po znormalizowaniu kwalifikacji zależności. `persistSection`, poprzedzająca go implementacja i cały przebieg KYS pozostały identyczne bajtowo.

Konstruktor wymaga wszystkich funkcji jako zwykłych własnych właściwości; odmawia przy brakach, dodatkowych polach, symbolach i getterach. Przechwytuje referencje funkcji, a każde wywołanie kopiuje i zamraża wybór NIP przed pierwszą operacją asynchroniczną. Nie uzupełnia częściowej konfiguracji połączeniem demo ani klientem dostawcy. Jawny port obsługi wyjątków pozwala natywnej integracji przerwać przebieg po odmowie dostępu, zachowując dotychczasową obsługę błędów dostawcy w starym przepływie.

Te porty **nie nadają uprawnień**. Właściwa integracja musi osobno wiązać każdą operację z aktualnym dopuszczeniem HUMAN albo SOURCE. Sam konstruktor ani poprawny numer organizacji nie stanowią dowodu uwierzytelnienia lub izolacji SQL.

## Wykonana walidacja

- 12 nowych testów wykonuje rzeczywisty wspólny przebieg i oryginalne klienty/mapowania MGBI na syntetycznych odpowiedziach. Efekty trwałego zapisu są w tych testach jawnymi szpiegami; nie przedstawia się ich jako integracji z natywną bazą lub żywym dostawcą.
- Sprawdzono kolejność prywatnego archiwum i snapshotów, pochodzenie wejść wskaźników oraz rzeczywiste obliczenie CURRENT_RATIO=1.500000. Sprawdzono aktualny cache bez pozyskiwania danych, reprojekcję i odświeżanie metadanych MSR, ograniczony status rejestrowy, niejednoznaczną tożsamość, odmowę dostępu oraz przerwanie po błędzie archiwum lub zapisu.
- Pełna regresja: **511 testów produktu**, **132 testy natywnej ochrony danych**, **311 testów promocji** — wszystkie PASS, zero pominięć. Zestaw 511 obejmuje nowe 12; liczb nakładających się nie sumuje się.
- Typecheck oraz pełny build Next16/React19: PASS. Wygenerowaną przez build zmianę `next-env.d.ts` zachowano poza źródłem, a jego dokładne wcześniejsze bajty przywrócono.
- Pierwsza próba połączenia zestawów bazowych na jednym klastrze uruchomiła zabezpieczenia dwóch testów przed adopcją istniejącej bazy. Użyto nowego, odrębnego klastra zgodnego z ich kontraktem; zabezpieczeń ani testów nie osłabiono. Wszystkie własne klastry zatrzymano. Wcześniejsze wyniki zachowano.

Manifest integracji zachowuje pełny poprzedni zapis źródeł named-interest i osobno identyfikuje jego bieżącą rewalidację oraz nowy przebieg. Nie przepisano historycznych dowodów ani SQL.

## Granice odbioru

Nie podłączono jeszcze tych portów do pełnej natywnej orkiestracji HUMAN/SOURCE. Nie aktywowano HTTP, nie zmieniono SQL, ról, grantów, danych, konfiguracji, sekretów ani zasobów chmurowych. Nie rozszerzono KYS/JDG, zasad pól osobowych ani publikowania wspólnej wiedzy. Nie wykonano deploymentu.

Przyrost wymaga dokładnego CI kandydata i main oraz kanonicznego closeout; niniejszy dokument sam ich nie dowodzi. Pełne E0/E1 pozostaje IN_PROGRESS: dalsza integracja i parytet chronionych wejść, aktualne dane/role/directory, odzyskiwanie, rzeczywista sesja użytkownika i kontrolowane wydanie Development wymagają własnych dowodów. Nie jest to odbiór Staging, Production ani E2–E4.
