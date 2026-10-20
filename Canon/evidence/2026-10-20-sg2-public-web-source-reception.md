# SG2 — odbiór źródła publicznego transportu 1.23

Status: SOURCE_COMPATIBILITY_PENDING_VALIDATION. Zadanie SG2-E1-PUBLIC-WEB-SOURCE-RECEPTION-20261020, Development.

Odbiorca przyjmuje kandydata ARCHITECTURE PR #560, source403255c88bbf81a67e384c269e38cae848b018f1. Zachowano wszystkie wcześniejsze pola i fingerprinty; oddzielny zapis obejmuje pełne57 plików SDK oraz aktualne digesty. Historyczne źródła weryfikowane są z dokładnego Git authority, a aktualne z instalowanego pakietu. Oba lockfile dodają publiczne ipaddr.js2.2.0; prywatne pakiety i kontrolowany CI zachowują dotychczasowe reguły.

Root candidate.15 i katalog1.2.0 pozostają niezmienione. Ten odbiór nie aktywuje HTTP, SQL018, ról, grantów ani deploymentu. Wyniki rzeczywistych testów zostaną dopisane po ich wykonaniu.

Odbiór źródła403255c i poprawka testowej zależności w kandydacie d6ddd3cef5da6b0d125248b1eff51274feecada2 przeszły [kontrolowane CI39377420545](https://github.com/profitia/SG-dev/actions/runs/39377420545):605/605 testów, bez pominięć, typecheck i build. Status odbioru tego źródła: SOURCE_COMPATIBILITY_VERIFIED_NOT_RELEASED. Dowód nie oznacza aktywacji ani wdrożenia i nie obejmuje późniejszych zmian Findera.
