# E1 — przyjęcie prywatnego kontraktu Supplier przez SRM, 19.10.2026

Status: RECEIVER SOURCE CANDIDATE / EXACT-CI ACCEPTANCE PENDING. Zadanie `SRM-E1-PRIVATE-SUPPLIER-CONTRACT-RECEPTION-20261019`, profil SRM, TARGET_ENVIRONMENT=development, izolowane wykonanie lokalne, własny PMOS/PHR; MEMOROS wyłączony. Pełne E1 i wydanie Development pozostają IN_PROGRESS.

Przyjęto producenta ARCHITECTURE `ARCHITECTURE-E1-SUPPLIER-PRIVATE-ACCESS-CONTRACT-20261019` i osobne zadanie przypięć `ARCHITECTURE-E1-PRIVATE-ACCESS-REGRESSION-PINS-20261019`: PR551, źródło `fe5b31f1390d2a9b12f7d16df7e35249c1a75402`, platform1.21.0/candidate14. Pierwszy kandydat48714e8 zachowano jako initialSourceSha. Osobne przyjęcie SG2 ma taskId `SG2-E1-PRIVATE-SUPPLIER-CONTRACT-RECEPTION-20261019`.

Wyrównano wyłącznie istniejący wpis wersji lokalnego SDK. Aktywny producer wskazuje dokładny kod; dotychczasowy łańcuch pozostaje w previousAcceptance. Nowy rekord zawiera51 skrótów aktualnego SDK, a historyczne odciski i operacje pozostają zachowane. Aktualizacja nie dodaje prywatnych operacji do dotychczasowego hosta finansowego i nie nadaje nowych grantów.

Po poprawce producenta ponowna instalacja publicznych zależności i228/228 rzeczywistych testów natywnych API/SQL przeszły bez pominięć. Trzy nowe prywatne operacje są odrzucane przez obecny host przed efektem biznesowym; kanoniczny predykat rozpoznaje odmowę także między modułami. Pierwsze przebiegi z nieaktualnym przypięciem i asercją klasy zachowano jako diagnostykę. Zestaw produktu564/564 przeszedł przy pierwszej instalacji platform1.21; po poprawce ponownie przeszły typecheck i build. Końcowe kontrolowane CI oraz artefakty dokładnego kandydata i main mają potwierdzić cały połączony zestaw przed przyjęciem. Wygenerowany przez własny build plik typów zachowano poza źródłem i przywrócono jego dokładną poprzednią treść.

To przyjęcie nie wdraża prywatnego cache KYS/JDG, PESEL/PDF ani pozostałych natywnych wejść biznesowych. Nie zmienia UI, Reacta, klientów i silników dostawców, SQL, chmurowych ról/grantów/danych, sekretów, konfiguracji lub deploymentu. Nie obejmuje Maps, Staging, Production i E2–E4.
