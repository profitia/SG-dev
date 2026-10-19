# E1 — jawne zależności oryginalnych silników JDG i KYS, 19.10.2026

Status: SOURCE CANDIDATE / NOT RELEASED. Zadanie `SRM-E1-SENSITIVE-ORCHESTRATION-20261019`, profil SRM, workspace SG-dev Codespaces SRM, TARGET_ENVIRONMENT=development, wykonanie lokalne. Authority profitia/SG-dev/main, punkt wyjścia `cb7a2bad1570801d643a19db618fc4edb59fab61`. Własny PMOS/PHR; MEMOROS wyłączony profilem. Pełne E1 i wydanie Development pozostają IN_PROGRESS.

## Zmiana i zgodność

`createJdgLookup` wymaga kompletu sześciu funkcji, a `createXrayKysLookup` — siedmiu. Fabryki przechwytują jawne zależności serwera i odrzucają brakujące, odziedziczone, niejawne lub dodatkowe porty oraz niepoprawny wybór organizacji/identyfikatora. Nie nadają tożsamości ani uprawnień. Późniejszy adapter musi podać rzeczywistą autoryzowaną persystencję i odrębnie dopuszczony transport dostawcy.

Pozostaje po jednym oryginalnym silniku JDG i KYS. Dotychczasowe `runJdgLookup` i `runXrayKysLookup` wywołują ten sam silnik z dotychczasowymi zależnościami. Porównanie treści z authority potwierdza identyczność obu oryginalnych ciał po usunięciu kwalifikacji `ports.`; walidacja nowych fabryk jest odrębna. Nie powstał drugi writer, cache, rejestr zamówień lub runtime. Nie zmieniono klientów CEIDG/Vercly, obliczeń, SQL, retencji ani UI.

Manifest zachowuje wszystkie historyczne hasze i dodaje bieżący, jawny zbiór34 źródeł. Dawny odczyt F22 pozostaje rekordem historycznym. Nowy odczyt nie stwierdza przyjęcia danych osobowych przez natywny tryb. Wspólne kontrakty pozostają niezależne od Reacta; żaden pakiet platformy lub blokada zależności nie są zmieniane.

## Wykonane testy

Jedenaście nowych testów przeszło bez pominięć. Obejmują kolejność i zakończenia JDG, klasę snapshotu i30-dniową retencję, odmowę zapisu, niezmienne zależności, nieprawidłowe selektory i porty. Dla KYS wykonują oryginalny `getOrFetchKys` z jawnym syntetycznym magazynem: zachowanie cache, rozdzielenie COMPANY/JDG, ograniczenia rejestracji, anulowanie oraz blokadę niepewnego przyjętego zamówienia bez ponownego POST. To nie są testy chmurowego SQL ani licencji dostawcy.

Pełna regresja SRM564/564, natywne testy API/SQL ze zwykłymi rolami226/226 oraz kontrola typów przeszły; brak błędów i pominięć. Testy natywne obejmują nadal pełny przepływ firmowy i jego dotychczasowe granice. Wydanie źródła wymaga dodatkowo rzeczywistego CI dokładnego kandydata, niezależnego odbioru SG2, kontroli main i kanonicznych closeoutów; ich wyniki nie są tu dopisywane przed wykonaniem.

## Jawne granice

Ten przyrost przygotowuje przyjęcie istniejącej logiki, lecz nie wdraża prywatnego cache KYS, rozszerzonych celów SQL/ACL/RLS dla JDG/KYS, ochrony PESEL/PDF ani ich wejść HTTP. Dotychczasowy globalny cache KYS nie staje się przez fabrykę magazynem prywatnym. Te granice wymagają właściwej adopcji i testów przed przełączeniem aplikacji.

Nie wykonano zmian schematów, ról, grantów, prywatnych danych, konfiguracji, sekretów, infrastruktury, zewnętrznych zamówień lub wdrożeń. Organizacja Profitia zaczyna z własną pustą historią; dawny właściciel zachowuje historię demo. Maps, Staging, Production i E2–E4 pozostają poza tym zadaniem.
