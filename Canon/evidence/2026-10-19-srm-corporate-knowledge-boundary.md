# SRM — granica pól wiedzy korporacyjnej, 19.10.2026

Status: SOURCE_CANDIDATE_NOT_RELEASED / PROGRAMME_IN_PROGRESS.

Zadanie `SRM-E1-CORPORATE-KNOWLEDGE-BOUNDARY-20261019`, profil SRM, workspace SG-dev Codespaces SRM, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority: profitia/SG-dev/main; punkt wyjścia `4ea954de3da61e754a1d1cc81606808a32112e34`. Własny PMOS/PHR; MEMOROS wyłączony profilem. Rejestracja nie jest closeout.

## Potwierdzenie problemu i wynik

Rzeczywisty kalkulator wskaźników zwraca również wewnętrzne `nip`, `inputFacts`, `sourceSnapshotIds` i `sourceDocumentIds`. Poprzedni `toPublicSection` usuwał pole źródła sekcji, lecz przekazywał jej dane bez filtrowania tych rozszerzeń. Wykonanie starego pomocnika na wyłącznie syntetycznym przykładzie potwierdziło zachowanie wszystkich czterech pól. Nie odczytywano danych klientów ani nie obserwowano w tej próbie odpowiedzi żywego HTTP.

Obecna projekcja dla rzeczywistego modelu finansowego MGBI i historycznego aliasu KRS-RDF zwraca wyłącznie zadeklarowane pola wskaźnika. Zachowuje kwoty, daty, status, powód niedostępności, jednostkę, wagę oraz wersję formuły. Wewnętrzny wynik kalkulatora pozostaje nienaruszony. Nie zmieniono obliczeń, parserów ani znaczenia danych finansowych.

## Granica struktury danych

`corporate-knowledge.ts` definiuje wersję `srm-corporate-knowledge-v1` dla istniejących GeneralCompanyData i FinancialData. Jawnie sprawdza pola spółki KRS i zgodność NIP, historię rejestru, okresy, fakty, korekty i dane porównawcze, metadane standardu oraz numeryczne pozycje MSR i zadeklarowane wyniki wskaźników. Zachowuje rozróżnienie brakującej wartości, null i rzeczywistego zera. Nie dopisuje wersji jakości, relacji rejestrowej ani dowodu źródła.

Ścisły odczyt kandydata wspólnej wiedzy odmawia przy nieznanych polach, osobach, surowych odpowiedziach dostawców, obcych identyfikatorach właściciela i wewnętrznych rozszerzeniach kalkulatora. Dla odpowiedzi publicznej istnieje osobna, jawna projekcja usuwająca cztery znane rozszerzenia. Pozostałe nieznane pola nadal powodują odmowę. Zakres obejmuje znane pola struktury; pochodzenie, licencja, jakość, dostęp i osobowe treści ukryte w dowolnym tekście wymagają właściwych odrębnych kontroli.

Granice zasobów obejmują32MiB znormalizowanego JSON, głębokość32, limit liczby elementów i węzłów oraz długości pól. Gettery, symbole, cykle, obiekty o obcym prototypie, rzadkie tablice i wartości niebędące skończonym JSON są odrzucane przed serializacją. Moduł korzysta z samych typów kontraktu i nie importuje Reacta, logowania, bazy ani klienta dostawcy w runtime. Sam nie nadaje uprawnień i niczego nie publikuje.

## Wykonana walidacja

- 18 nowych testów: oryginalne mapowanie MGBI, rzeczywisty kalkulator i niezmieniony CURRENT_RATIO=1.500000, usunięcie identyfikatorów pochodzenia z odpowiedzi, zachowanie wszystkich pól publicznych i prywatnego wyniku na serwerze, poprawna historia KRS/MSR/korekt, brak automatycznego podnoszenia jakości, odmowy nieznanych i prywatnych pól w zagnieżdżeniach, odmienne NIP/KRS, niepoprawne liczby/daty oraz kontrola zasobów i serializacji.
- **529 testów produktu**, **132 natywnej ochrony danych** i **311 promocji**: PASS, zero pominięć, na osobnych świeżych klastrach PostgreSQL. Zestaw529 obejmuje nowe18; liczb nakładających się nie sumuje się. Własne klastry zatrzymano.
- Typecheck i pełny build Next16/React19: PASS. Wygenerowaną zmianę `next-env.d.ts` zachowano poza źródłem i przywrócono dokładne wcześniejsze bajty.
- Osobne porównanie źródeł: całe `persistSection`, przebieg raportu spółki i przebieg KYS są identyczne bajtowo z punktem wyjścia. Jedyną celową zmianą zachowania istniejącego przepływu jest zakres publicznej projekcji finansowej.

Manifest zachowuje poprzednie dowody i wskazuje bieżącą rewalidację źródeł. Dokładne CI kandydata/main oraz trwały closeout są wymagane osobno; ten dokument nie deklaruje ich z wyprzedzeniem.

## Granice odbioru

Nie wykonano publikacji wspólnego katalogu, pełnej natywnej orkiestracji, nowej adopcji KYS/JDG, zmian zasad PII lub licencji, SQL, migracji, danych, ról, grantów, konfiguracji, sekretów, zasobów ani deploymentu. Zgodność wszystkich starych projekcji z żywych baz wymaga osobnego odczytu i, w razie potrzeby, kontrolowanej reprojekcji; test aktualnego mappera nie dowodzi przebadania każdego historycznego rekordu.

Pełne E0/E1 pozostaje IN_PROGRESS. Dalsza kompozycja HUMAN/SOURCE, parytet chronionych wejść, aktualne role/directory/dane, odzyskiwanie, rzeczywista sesja i odbiór Development nadal wymagają dowodów przed wydaniem. Brak odbioru Staging, Production i E2–E4.
