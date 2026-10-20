# SRM — odbiór wspólnego transportu i zachowanie źródeł

Zadanie SRM-E1-SUPPLIER-EXTERNAL-ADOPTION-20261020, Development. Status: IN_PROGRESS_NOT_RELEASED.

Pakiet platform1.23.0 przyjęto z PR560, source403255c88bbf81a67e384c269e38cae848b018f1; odbiorca posiada własne PMOS. Lockfile zachowuje pozostałe zależności i przypina publiczny ipaddr.js2.2.0. Nowy zapis przyjęcia w operation-integration.json, należący do zadania SRM-E1-WORKING-SUPPLIER-HTTP-20261020, weryfikuje57 aktualnych plików SDK; wszystkie wcześniejsze pola pozostają byte-equivalent po serializacji JSON.

Test historycznego odbioru źródeł jest sprawdzany z dokładnego main0403b34da82796c9c001be9cf53c5dcb6f9d823d; bieżąca domknięta lista67 plików aplikacji jest sprawdzana osobno. Pierwszy przebieg182 rzeczywistych testów dał181 PASS oraz jeden błąd historycznego fingerprintu zmienionego transportu KRS. Po rozdzieleniu źródła historycznego i bieżącego pełne ponowienie dało182/182 PASS, zero pominięć: srm-focused-public123-final.log.

Wspólny transport nie jest jeszcze zamontowany w rozpoznawaniu strony. Nie zainstalowano SQL018, nie zmieniono ról, danych, konfiguracji ani deploymentu.
