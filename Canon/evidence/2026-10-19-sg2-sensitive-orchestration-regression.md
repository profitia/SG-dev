# E1 — odrębny odbiór zgodności SG2 przy jawnych zależnościach JDG/KYS, 19.10.2026

Status: RECEIVING SOURCE CANDIDATE / NOT RELEASED. Zadanie `SG2-E1-SENSITIVE-ORCHESTRATION-REGRESSION-20261019`, profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development, wykonanie lokalne. Własny PMOS, wymagany MEMOROS i PHR; rejestracja nie jest closeout. Authority profitia/SG-dev/main, punkt odniesienia `cb7a2bad1570801d643a19db618fc4edb59fab61`.

Producent SRM: `SRM-E1-SENSITIVE-ORCHESTRATION-20261019`, PR549, source `aca804fcb66fe9049f2ff96908bbbd6ffa9b95aa`. Udostępnia komplet jawnych zależności dwóch oryginalnych silników, zachowując ich dotychczasowe ciała, klienty, cache, retencję i tryb legacy. Nie przyjmuje jeszcze natywnie prywatnych ścieżek danych osobowych. SG2 nie staje się odbiorcą funkcji KYS/JDG przez sam ten zapis.

Niezależne porównanie do authority potwierdza niezmieniony SDK, Runtime i dashboard, SQL, pakiety i blokady zależności, kontroler CI oraz Maps. Manifest SG2 dodaje własne przyjęcie dokładnego commita i skrótu zbioru34 źródeł producenta; zachowuje dotychczasowe rekordy. Zmieniają się wyłącznie dwa własne pliki odbioru. Nie przenosi się rekordów ani identyfikatorów relacji między bazami PMOS.

Pełny odbiór tej jednostki wymaga rzeczywistego kontrolowanego CI dokładnego połączonego kandydata, sprawdzenia opublikowanych bajtów i odrębnych artefaktów Runtime/dashboardu/SRM z zaakceptowanego main. Build, typy i testy API/SQL nie są zastępowane deklaracją w tym dokumencie. Końcowe wyniki i kanoniczne publikacje są zapisywane po ich wykonaniu.

Nie zmienia się usług, danych, ról, grantów, sekretów, konfiguracji, klientów dostawców ani wdrożeń. To przyjęcie źródła i regresja zgodności, nie dowód rzeczywistego logowania, natywnej ochrony KYS/JDG, UAT lub wydania Development. Pełne E1 pozostaje IN_PROGRESS; Staging, Production i E2–E4 są poza tym zadaniem.
