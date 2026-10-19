# E1 — zgodność istniejącego kanału Maps z platform1.21, 19.10.2026

Status: RECEIVER SOURCE CANDIDATE / EXACT-CI ACCEPTANCE PENDING. Zadanie `SRM-E1-MAPS-PLATFORM-121-COMPATIBILITY-20261019`, profil SRM, logiczny właściciel Maps Capability, TARGET_ENVIRONMENT=development. Osobny PMOS/PHR, MEMOROS wyłączony. Przyrost jest koniecznym odbiorem wspólnego SDK w istniejącym kanale; nie rozbudowuje map.

Rzeczywiste CI39315170315 kandydata PR553 wykazało, że test odbiorcy nadal wymaga platform1.20. Trzy rzeczywiste źródła publicznego kanału embedded-read mają identyczne skróty jak pełny zachowany odbiór1.20. Jawnie dodano1.21 do dotychczasowych dopuszczonych wersji peer, wyrównano odpowiadające wpisy istniejącego pliku zależności i zarejestrowano producenta PR551/source `fe5b31f1390d2a9b12f7d16df7e35249c1a75402`. Pełny poprzedni dokument odbioru pozostaje w previousAcceptance; nie nadpisano jego odcisków lub pól adopcji.

Rzeczywista czysta instalacja, lokalny build i12/12 testów przeszły. Zestaw obejmuje niezależnego gospodarza, rzeczywisty MessageChannel, odmowę aktualnego dostępu, obce origin/window/version, zamknięcie kanału, ograniczone publiczne HTTP i syntetyczne błędy dostawcy. Lokalny build nie jest artefaktem wydania. Przed odbiorem połączonej wersji wymagane są zielone dokładne CI i zweryfikowane artefakty main.

Nie zmieniono kodu funkcjonalnego map, UI, konfiguracji Google, tożsamości lub przechowywania lokalizacji. Nie przyjęto nowych prywatnych operacji Supplier, private inspection ani natywnego SQL do map. Rzeczywiste wdrożenie Maps pozostaje bez zmian i poza tym zadaniem. Pełne E1, Development SG2/SRM, Staging i Production nie są wykonane przez ten odbiór źródłowy.
