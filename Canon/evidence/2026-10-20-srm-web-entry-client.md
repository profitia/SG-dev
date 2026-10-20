# SRM — klient i wejście rozpoznawania strony

Zadanie SRM-E1-WEB-ENTRY-CLIENT-20261020, Development. Status: SOURCE_IMPLEMENTATION_VALIDATING_NOT_RELEASED.

Przed dodaniem dokładnego wejścia backend przeszedł67/67 rzeczywistych testów PostgreSQL/HTTP (srm-focused-web-physical-fences.log), zero pominięć. Sprawdzono oryginalne algorytmy i zapisy, dwa rodzaje podmiotów, granice organizacji, Source bez prawa do prywatnego cache, odmowę po cofnięciu read w czasie HTTP, brak audytu, fizyczny FORCE RLS i niepożądany TRUNCATE.

Klient zachowuje oryginalne identifier/entityType; dodaje wyłącznie klucz idempotencji logicznego żądania. Przerwane połączenie i PENDING zachowują klucz. Backend buduje tożsamość i własność. Po sukcesie kolejne świadome odświeżenie ma nowy klucz. Kod helpera nie zależy od Reacta. Tylko dokładny /api/xray/web-identity przechodzi middleware do aktualnej autoryzacji; podobne i nieznane ścieżki pozostają zamknięte.

To przyrost źródłowy. Brak aktywacji Clerk, SQL, grantów, konfiguracji i deploymentu; Development wymaga własnego kontrolowanego wydania.

## Końcowa walidacja lokalna przepływów strony

Zintegrowana regresja odbioru, zwykłych ról i handlerów API:190/190 PASS, zero pominięć (srm-focused-web-nine-final.log). Oryginalne testy biznesowe z prawidłową osobną bazą migracyjną:590/590 PASS, zero pominięć (srm-business-web-business-isolated-create.log). Wejścia, klient i projekcja:26/26 PASS, typecheck i build PASS (e1-srm-web-entry-client-20261020).

Pierwsza próba pełnej puli biznesowej poprawnie odmówiła użycia wcześniej utworzonej lokalnej bazy; poprawiono wyłącznie runner, pozostawiając niezmienione zabezpieczenia i testy. Rozpoznawanie korzysta z jednego transportu platform1.23 i oryginalnego writera; usunięto redundantną bezpośrednią zależność ipaddr z aplikacji. Kontrola Source zachowuje stałą tożsamość logicznego żądania także po rekonstrukcji transportu i nie powtarza niepewnego GET.

Obecne źródło obejmuje9 rzeczywistych handlerów i9 dokładnych bramek. Nowa pełna lista79 plików aplikacji jest sprawdzana osobno od historycznego odbioru8 przepływów. Ten etap nie potwierdza rzeczywistej sesji klienta, aktywacji chmurowego SQL/ACL, dostawców ani deploymentu. E1 pozostaje w toku: integracja SG2, kontrolowane przyjęcie i własne wydanie Development wymagają dalszych dowodów.
