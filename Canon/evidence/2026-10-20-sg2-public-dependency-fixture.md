# SG2 — rzeczywista zależność publiczna w testach obu gospodarzy

Zadanie: SG2-E1-PUBLIC-DEPENDENCY-FIXTURE-20261020. Profil SG2, Development. Status: LOCAL_FIXTURE_VERIFIED; pełne CI odbiorcy wymaga ponownego wykonania.

Kontrolowany CI [39374860276](https://github.com/profitia/SG-dev/actions/runs/39374860276) potwierdził zaufany kontroler, dokładny kandydat i instalację pakietów, po czym zatrzymał testy na istniejącej odmowie nowych zależności SDK. Platform1.23 wprowadza publiczną ipaddr.js2.2.0. Odmowa była prawidłową bramką wymagającą osobnego przeglądu konfiguracji testów.

Istniejący pomocnik dopuszcza wyłącznie tę wersję, dokładny URL i integralność w trzech lockfile oraz fingerprinty faktycznie zainstalowanych plików. Odrzuca dalsze zależności i poświadczenia obecne podczas wykonania. Dodaje wyłącznie brakujące lokalne dowiązania do prawdziwego SDK i zweryfikowanej biblioteki. Nie pobiera pakietów ani nie wykonuje hooków instalacji. Zachowuje obce i zmienione pliki; sprzątanie sprawdza tożsamość utworzonych dowiązań i katalogów.

19/19 testów zakończonych pozytywnie, bez pominięć: rzeczywisty transport SDK w obu gospodarzach, odmowy zmiany zależności, lockfile, wykonywalnych plików, dowiązań, obecności poświadczeń oraz zachowanie materiału do recovery. Lokalnie wykorzystano publiczne pliki z wcześniejszej czystej instalacji SRM; nie odczytywano prywatnego tokenu ani usług Render. Test włączono do istniejącego polecenia testów SG2. To nie jest dowód pełnego buildu SG2 ani wdrożenia. Nie zmieniono reguł dostępu, kontrolera prywatnych pakietów, konfiguracji usług, schematów ani danych.

Pełne ponowione [CI39377420545](https://github.com/profitia/SG-dev/actions/runs/39377420545) dla dokładnego kandydata d6ddd3cef5da6b0d125248b1eff51274feecada2 zakończyło się SUCCESS:605/605 testów, bez pominięć, typecheck i build. Status tej poprawki: CONTROLLED_CI_VERIFIED_NOT_RELEASED. Nie jest to odbiór późniejszych zmian ani deploymentu.
