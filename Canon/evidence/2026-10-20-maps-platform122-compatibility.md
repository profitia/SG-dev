# E1 — zachowanie zgodności publicznego kanału Maps z platform1.22

Status: SOURCE_COMPATIBILITY_CANDIDATE; TARGET_ENVIRONMENT=development. Osobne zadanie SRM-E1-MAPS-PLATFORM-122-COMPATIBILITY-20261020, profil SRM, rejestracja cmvfsyhwl00001246n1gw4etn w rzeczywistej srm_pmos/neondb_owner. Nie użyto innego profilu ani historii produktu. Wymagany closeout własnego PMOS/PHR po CI/main; MEMOROS wyłączony zgodnie z profilem.

Wspólny pakiet przyjęto z producenta ARCHITECTURE-E1-PRIVATE-ACQUISITION-CONTRACT-20261019, źródło e71f9953d74f683e447f315e633db3696ec365ba. Zamknięty zakres obejmuje wyłącznie istniejący peer range maps-embed, lock platform1.22, jawne potwierdzenie i test jego dokładnego źródła. Poprzednie potwierdzenie1.21 zachowano w całości. Trzy pliki istniejącego publicznego embedded-read mają identyczne bajty i sumy; wire contract pozostaje profitia.embedded-read@1.0.0. Poprzednie przetestowane wersje pozostają jawne; dopisano tylko1.22.

Testy kanału i runtime:12/12, zero pominięć i błędów; build poprawny. Dwa lokalne buildy dla źródeł6518cf6 i poprawionego e71f9953d74f683e447f315e633db3696ec365ba mają ten sam digest artefaktu sha256:7c6c1da77c41708086059e3268d6d3abc119cf610feb56e325a41eb19916fd7d. Wciąż wymagane są kontrolowane CI/main i weryfikacja ich artefaktów przed scaleniem.

Nie zmieniono źródła funkcji Maps, UI, osadzania, geokodowania, zapisów lokalizacji, modelu organizacji, ról, Google, usług ani konfiguracji. Nie przyjęto prywatnego pozyskania, natywnej pracy SQL lub nowego montowania funkcji SRM; flagi te pozostają false. Nie wykonano wdrożenia Maps ani przepięcia jej danych. Zgodność zależności nie zastępuje osobnego developmentu biznesowego Maps i nie oznacza zakończenia E1.
