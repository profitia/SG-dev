# E1 — brak rozwiązywania globalnego klienta przy imporcie forecastów

Data: 18.10.2026. Profil SG2, workspace SG-dev, TARGET_ENVIRONMENT=development; wykonanie lokalne. Zadanie `SG2-E1-FORECAST-IMPORT-BOUNDARY-20261018` należy do odrębnie zaakceptowanego programu E0/E1. Bazą jest `profitia/SG-dev/main` na `7298da03c039c84a3c3fd162c1290d561b5adc43`, po zweryfikowanym closeout PR #463.

PMOS begin: `cmvd5z7pk0000146l9lr3qzyj`. Task conversationId: `pmos-task-v2:fb511b4bdf0cfbe8587ba9f06f8de1868506168e0eeded52f324d152ec0f888d`. Rzeczywisty hostConversationId: `01a133c2-c245-77a0-bb6b-33165e2ad80c`. Sam begin nie dowodzi closeout. Dokładne CI, merge i późniejszy zapis PMOS/MEMOROS/PHR należą do kanonicznego zamknięcia zadania.

## Potwierdzony problem

Świeży proces z ustawioną syntetyczną konfiguracją oraz getterem odmawiającym dostępu do globalnego klienta wykazał jedno rozwiązanie tego klienta podczas samego importu `service.ts` i `stored-current-read.ts`. Źródłem był domyślny rejestr wykonań inicjalizowany przez domyślny serwis. Wcześniejsze testy wywołań czytnika po statycznym imporcie nie obejmowały tej fazy. Nie stwierdzono przez ten test odczytu danych ani wycieku; potwierdzono niepotrzebne powiązanie inicjalizacji modułu z globalnym klientem legacy.

## Naprawa u źródła

Istniejący `createPrismaStore` zachowuje dotychczasowy wybór magazynu przy braku konfiguracji. Dla skonfigurowanego magazynu pobiera klienta dopiero przy pierwszej rzeczywistej operacji rejestru i zachowuje tę samą instancję w jego zamknięciu. Odczyt, upsert oraz atomowe dopisanie telemetrii korzystają z tego klienta. Utrata konfiguracji przed pierwszą operacją powoduje błąd, a nie ciche uznanie zapisu za wykonany.

Zapytania SQL, pola utrwalanych rekordów, obsługa brakującej historycznej relacji, kolejność zdarzeń i polityki admission pozostają bez zmian. Nie wprowadzono nowego writera, magazynu, runtime ani implementacji audytu. Istniejące zachowanie legacy bez konfiguracji nie jest dowodem dostarczenia audytu. Natywne odczyty nadal jawnie odmawiają użycia portów rejestru obliczeń; ich trwały audyt dostępu należy do zewnętrznego wykonawcy operacji.

## Walidacja

- Sześć osobnych, świeżych procesów importuje rzeczywisty serwis, czytnik Current, czytnik Rolling Verification, konfigurację prywatnego runtime i oba wejścia API Current/Verification. Każdy proces potwierdza zero rozwiązań globalnego klienta oraz zero wywołań zabronionego `fetch`. Nowe testy wykazywały błąd przed poprawką i przechodzą po niej.
- Testy cyklu klienta potwierdzają brak jego rozwiązania w konstruktorze, rozwiązanie przy pierwszym użyciu, zachowanie tej samej instancji dla odczytu i zapisu, propagację rzeczywistej odmowy delegata bez zmiany klienta, błąd przy utracie konfiguracji i niezmieniony wybór legacy przy pustej konfiguracji. To testy inicjalizacji z kontrolowanymi delegatami, a nie nowy dowód działania SQL w chmurze.
- Zestaw importu/rejestru: 25 PASS. Pełne `test:operation-context`: 423 PASS, 0 pominiętych, w tym dotychczasowe rzeczywiste testy PostgreSQL. Oryginalne testy biblioteki forecastów i snapshotów Current: 61 PASS. Odrębne testy biblioteki/gotowości/Rolling Daily: 67 PASS; zestawy częściowo się pokrywają.
- Ścisły typecheck zmienionego źródła i dotychczasowej powierzchni integracji: PASS. Pięć dokładnych ścieżek, routing SG2, 32 aktualne dokumenty CORE/SG2 i pełne bramki before/begin/require-begin zostały zweryfikowane.

## Granice

Nie zmieniono schematu, ról, grantów, danych ani konfiguracji chmurowej, źródeł, sekretów lub flag. Nie wykonano wdrożenia produktu ani aktywacji Clerka. Brak efektu ubocznego importu nie oznacza przyjęcia natywnego Verification, gotowości, interfejsu lub delegowanych zadań. Te prace i kontrolowane wydania Development/Staging pozostają w programie E1. Dokument nie jest odbiorem całego E1 ani zgodą na Production lub E2–E4.
