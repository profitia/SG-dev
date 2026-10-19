# E1 — pochodzenie danych i granice pierwszego uruchomienia, 19.10.2026

Status: DATED PREPARATORY BASELINE / PROGRAMME IN_PROGRESS. Zadanie
ARCHITECTURE-E1-PRIVATE-DATA-PROVENANCE-BASELINE-20261019, ARCHITECTURE,
TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority profitia/SG-dev/main,
source 0c9266e84830bd97445311a6c3ed357b197bc1d0. Odczyty i transakcje są
odrębnymi obserwacjami, nie jednym atomowym snapshotem wszystkich projektów.

[Rejestr dowodów](../registries/e1-private-data-provenance-2026-10-19.json)
zawiera dokładne projekty, gałęzie, bazy, role i zagregowane liczniki. Nie zawiera
rekordów klientów, osobowych powiązań kont, identyfikatorów organizacji lub osób, zawartości
raportów/dokumentów, danych logowania ani połączeń bazowych.

## Decyzja właściciela

Właściciel jednoznacznie wybrał: przygotowana organizacja „Profitia — organizacja
wewnętrzna” zaczyna z pustą historią i własnymi listami. Dotychczasowa historia
pozostaje zachowana przy dotychczasowym właścicielu. Nie następuje transfer do
Profitii ani przypisanie wspólnej historii demo kontu startowemu. Istniejący bootstrap
jednego konta, organizacji i członkostwa pozostaje na miejscu; decyzja nie zleca
ponownego tworzenia konta lub organizacji.

Dane uniwersalne rynku i dopuszczona wiedza o dostawcach pozostają odrębną
warstwą współdzieloną. Prywatne wybory, historia operacji i dokumenty nie stają się
wspólne przez to, że odnoszą się do dostawcy. Decyzja nie rozszerza polityki danych
osobowych, uprawnień dostawców ani zakresu infrastruktury.

## Potwierdzony stan

| Obszar | Dowód odczytu | Granica |
| --- | --- | --- |
| Prywatna platforma | 43 tabele, wszystkie FORCE RLS; rzeczywiste logowania trzech ról bez superuser/BYPASSRLS/INHERIT i bez członkostw | Aplikacje spendguru i srm nadal DISABLED; to przygotowanie, nie aktywna ochrona produktu |
| Katalog początkowy | 1 konto, 1 organizacja, 1 powiązanie IdP, 1 członkostwo, 1 bootstrap receipt; rewizja19 | Cztery jawne uprawnienia, dwa aktualne granty produktu i dwa modułu nie obejmują automatycznie wszystkich nowych funkcji |
| Nowe dane biznesowe | Dokładne fizyczne liczniki potwierdzają brak danych biznesowych SG2/SRM; zachowane wpisy instalacji i18 migracji SRM | Zera odczytane przez RLS nie były użyte jako dowód pustej bazy |
| Dotychczasowy SRM Development | 21 tabel,20 FORCE RLS; rzeczywista rola srm_app_runtime bez superuser/BYPASSRLS i bez członkostw, z INHERIT | To odrębny model od nowych ról i indywidualnego katalogu |
| Historia SRM | 1 organizacja o innym identyfikatorze,1 użytkownik SHARED_DEMO,497 wyszukiwań,49 dostawców,41 przypisań | Nie dowodzi historii konkretnej osoby; pozostaje przy starym właścicielu |
| Wspólny katalog SRM | 42 firmy,7372 fakty finansowe,4122 wskaźniki | Liczniki nie są klasyfikacją każdego pola lub odbiorem publikacji SOURCE |
| Market Development | 18 tabel public bez RLS i oddzielna przygotowana granica odczytu | Lokalizacja public nie klasyfikuje automatycznie śladów i kolejki jako wiedzy rynkowej |
| Przygotowany czytelnik rynku | Rzeczywisty login, domyślny read-only, aktualny receipt i odczyt dwóch dopuszczonych projekcji | Bez bezpośredniego dostępu do tabel public, śladów i kolejki; nie dowodzi podpięcia do żywego produktu |
| Legacy SG | Obie gałęzie projektu old-smoke są archived według metadanych | Nie reaktywowano ich i nie wykonano SQL; aktualna zawartość pozostaje niezweryfikowana |

Obserwacja uprzywilejowanych liczników jest jawnie oddzielona od dowodów zwykłych
ról runtime. Sesje administracyjne były tylko odczytowe. Nie wyłączano RLS tabel,
nie zmieniano ról ani uprawnień. Odmowy deskryptorów przy DISABLED są oczekiwane;
nie są błędem do obejścia ani dowodem odebrania biznesowego E1.

## Proweniencja i ograniczenia

42 wpisy katalogu wskazują źródłową organizację;40 ma referencję prywatnego
snapshotu general,26 finansowego. Wszystkie7372 fakty mają organizacyjne
pochodzenie i referencję snapshotu. Dla pól input_facts, source_snapshot_ids i source_document_ids
odnotowano po3146 wierszy z niepustą wartością. Odczytano wyłącznie liczniki
obecności, bez wartości
lub treści tych pól. Jest to dowód granicy migracji/projekcji; nie dowód wycieku
ani zgoda na publiczne udostępnienie prywatnej proweniencji. Przyjęte źródło
publikacji SOURCE i publiczna projekcja finansowa pozostają osobnymi mechanizmami.

Katalog KYS ma19 wierszy,14 z raportem;13 raportów ma już miniony retention_until,
a1 pozostaje w aktualnym okresie. Jest to fizyczna obserwacja administratora.
Nie sprawdzano dostępu aplikacyjnego do wygasłych treści ani ich nie odczytywano.
Polityka D1 i jej granice pozostają obowiązujące; nie rozszerzono ich ani nie
usuwano danych w tym audycie.

W prywatnej platformie nie ma jeszcze schematów późniejszych opcjonalnych
mechanizmów service/request/job/ingestion. Przyjęcie źródła SQL005–013 i nowych
adapterów nie oznacza ich instalacji, grantów, aktywacji lub gotowości wydania.
Nowe uprawnienia i podpięcia wymagają właściwych osobnych zadań produktu.

Odczyt Render potwierdza bieżące metadane usług i sześciu wybranych działających
wdrożeń. Nie odczytywano sekretów; wcześniejsza weryfikacja routingu konfiguracji
połączeń zachowuje swoją datę. Metadane deploymentu nie zastępują tego odczytu,
zachowanego artefaktu LKG ani sprawdzonego odzyskania.

Nie wykonywano migracji danych, zmiany schematu, grantów, konfiguracji produktu,
sekretów, zasobów, aktywacji lub wdrożenia. Nie przeprowadzono rzeczywistego
logowania użytkownika, biznesowego UAT ani cloud recovery rehearsal. Pełne E0/E1
pozostaje IN_PROGRESS; źródło, przygotowanie zasobów, integracja i wydanie są
odrębnymi odbiorami. Staging i Production nie zostały zmienione.
