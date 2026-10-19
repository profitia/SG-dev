# SG2 — zgodność z publikacją katalogu SRM, 19.10.2026

Status: SOURCE_COMPATIBILITY_CANDIDATE / PROGRAMME_IN_PROGRESS.

Zadanie `SG2-E1-CORPORATE-SOURCE-REGRESSION-20261019`, profil SG2, workspace SG-dev Codespaces SG2, TARGET_ENVIRONMENT=development, wykonanie lokalne. Własny PMOS/PHR i wymagany MEMOROS. Rejestracja nie jest closeout.

Źródło SRM: zadanie `SRM-E1-CORPORATE-SOURCE-PUBLICATION-20261019`, commit `1636fa7fb44e91d815bbb5b2e8d5ec26a6d9dcb2`, PR https://github.com/profitia/SG-dev/pull/510. Authority przed tym przyrostem: `3d9c177d174e2e74f92c16254e8d176b34525088`. Zmiana SG2 obejmuje wyłącznie niniejszy dokument. Kod i zależności Runtime oraz Dashboardu, źródła producenta kontraktu, lockfile i workflow pozostają bez zmian.

SRM korzysta z istniejącego hosta SOURCE i natywnego sterownika pg oraz jednego zapisu katalogu i kalkulatora. Opcjonalny zapis sklasyfikowanego pakietu oraz dowód OUTCOME nie aktywują integracji SpendGuru i nie nadają HUMAN zapisu globalnego. Nie wprowadzono zależności kontraktu od wersji Reacta.

Lokalne dowody SRM:146 testów natywnych,534 produktu,311 promocji, typecheck i pełny build, bez błędów lub pominięć. Stanowią dowód źródeł SRM; nie zastępują dowodów SG2. Wymagane są kontrolowane CI dokładnego kandydata oraz odrębne rzeczywiste artefakty Runtime, Dashboardu, ochrony HTTP, testów natywnych i buildów po przyjęciu do main, wraz z niezależnymi kontrolami SRM i governance.

Gałąź walidacji SG2 zachowuje commit właściciela SRM i dodaje własny dokument. Wykorzystuje istniejący kontroler z zaufanego main; nie poszerza zakresu poświadczeń, polityki CI ani dozwolonych nazw, wersji i sum pakietów. Pakiety prywatne są instalowane wyłącznie przez ten kontrolowany CI. Nie pobiera się lokalnie sekretów Render.

Nie wykonano zmian chmurowych baz, danych, ról, grantów, konfiguracji, sekretów, usług ani deploymentu. Nie ustanowiono drugiego źródła katalogu, nie przeniesiono historii i nie wydano przyrostu. Przygotowanie tego źródła nie dowodzi pełnej orkiestracji, sesji użytkownika, migracji prywatnych danych ani gotowości całego E1. Programme pozostaje IN_PROGRESS. Brak odbioru Staging, Production i E2–E4.

Dokładne wyniki CI, commity i późniejsze odbiory są zapisywane w kanonicznym closeout PMOS/PHR; niniejszy dokument nie deklaruje ich przed wykonaniem.
