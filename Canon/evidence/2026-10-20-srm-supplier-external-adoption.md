# SRM — odbiór wspólnego transportu i zachowanie źródeł

Zadanie SRM-E1-SUPPLIER-EXTERNAL-ADOPTION-20261020, Development. Status: IN_PROGRESS_NOT_RELEASED.

Pakiet platform1.23.0 przyjęto z PR560, source403255c88bbf81a67e384c269e38cae848b018f1; odbiorca posiada własne PMOS. Lockfile zachowuje pozostałe zależności i przypina publiczny ipaddr.js2.2.0. Nowy zapis przyjęcia w operation-integration.json, należący do zadania SRM-E1-WORKING-SUPPLIER-HTTP-20261020, weryfikuje57 aktualnych plików SDK; wszystkie wcześniejsze pola pozostają byte-equivalent po serializacji JSON.

Test historycznego odbioru źródeł jest sprawdzany z dokładnego main0403b34da82796c9c001be9cf53c5dcb6f9d823d; bieżąca domknięta lista67 plików aplikacji jest sprawdzana osobno. Pierwszy przebieg182 rzeczywistych testów dał181 PASS oraz jeden błąd historycznego fingerprintu zmienionego transportu KRS. Po rozdzieleniu źródła historycznego i bieżącego pełne ponowienie dało182/182 PASS, zero pominięć: srm-focused-public123-final.log.

Wspólny transport nie jest jeszcze zamontowany w rozpoznawaniu strony. Nie zainstalowano SQL018, nie zmieniono ról, danych, konfiguracji ani deploymentu.

## Końcowa walidacja lokalna przepływów strony

Zintegrowana regresja odbioru, zwykłych ról i handlerów API:190/190 PASS, zero pominięć (srm-focused-web-nine-final.log). Oryginalne testy biznesowe z prawidłową osobną bazą migracyjną:590/590 PASS, zero pominięć (srm-business-web-business-isolated-create.log). Wejścia, klient i projekcja:26/26 PASS, typecheck i build PASS (e1-srm-web-entry-client-20261020).

Pierwsza próba pełnej puli biznesowej poprawnie odmówiła użycia wcześniej utworzonej lokalnej bazy; poprawiono wyłącznie runner, pozostawiając niezmienione zabezpieczenia i testy. Rozpoznawanie korzysta z jednego transportu platform1.23 i oryginalnego writera; usunięto redundantną bezpośrednią zależność ipaddr z aplikacji. Kontrola Source zachowuje stałą tożsamość logicznego żądania także po rekonstrukcji transportu i nie powtarza niepewnego GET.

Obecne źródło obejmuje9 rzeczywistych handlerów i9 dokładnych bramek. Nowa pełna lista79 plików aplikacji jest sprawdzana osobno od historycznego odbioru8 przepływów. Ten etap nie potwierdza rzeczywistej sesji klienta, aktywacji chmurowego SQL/ACL, dostawców ani deploymentu. E1 pozostaje w toku: integracja SG2, kontrolowane przyjęcie i własne wydanie Development wymagają dalszych dowodów.
