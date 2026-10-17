# E1 — przygotowanie ograniczonego loginu SRM w prywatnym magazynie

Status: **PREPARED_NOT_ACTIVATED**. Dowody: 17.10.2026, około 08:26 UTC. Profil SRM, Development, wykonanie lokalne. Zadanie: `SRM-E1-PRIVATE-STORE-PREPARATION-20261017`. Dokument potwierdza przygotowanie dostępu do nowego magazynu, nie integrację działającego SRM ani zakończenie E1.

## Podstawa i granica zmiany

Przyjęto schemat producenta ARCHITECTURE z [PR #398](https://github.com/profitia/SG-dev/pull/398), source `5347523b97b44a7a41d69d03a45372ccfe26b8dc`, access-store i schema 1.0.0, checksum SQL `356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2`. Osobne zadanie SG2 przygotowało bazę i dwa własne loginy w [PR #401](https://github.com/profitia/SG-dev/pull/401), merge `d7d683e7c4a6da4a61817f5c176a087fd88d2ae4`. Niniejsze zadanie nie przepisuje tych dowodów ani rekordów PMOS.

Zasób: istniejący, utworzony przez właściciela projekt `profitia-platform-private` / `spring-bread-28217539`, organizacja `org-nameless-field-92563437`, AWS Frankfurt, Development `br-sparkling-term-b99l107x`, endpoint `ep-late-heart-b9mxo8oi`, baza `platform_private` / `43910`. Nie tworzono projektu, organizacji, bazy lub nowej gałęzi i nie zmieniano planu lub compute.

Przed mutacją potwierdzono dokładną instalację, revision 4, jedną aplikację `spendguru` DISABLED, dwa dotychczasowe mapowania SG2, brak nowego loginu oraz zero kont, organizacji, członkostw, grantów i audytu. Fail-closed preflight z rejestracją własnego zadania SRM zakończył się PASS na `1edad1727dccb6dd3169fff91a182e0344ff0afd`.

## Addytywne przygotowanie i rzeczywisty login

Jedna transakcja utworzyła przez SQL `srm_private_development_runtime`, nadała CONNECT do tej bazy, timeouty oraz USAGE schematu i EXECUTE pięciu zaakceptowanych funkcji. Hasło wygenerowano wyłącznie po stronie dostawcy; nie odczytywano connection string lub wartości hasła. Nie użyto API tworzącego uprzywilejowaną rolę. Aplikację `srm` zapisano jako DISABLED, a mapowanie loginu jako ACTIVE. Mapowanie nie aktywuje aplikacji.

Oddzielne połączenie MCP z `role_name=srm_private_development_runtime` potwierdziło `current_user=session_user`, LOGIN true, SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS/INHERIT false, limit 4, statement timeout 15 s, lock timeout 3 s i idle-in-transaction timeout 15 s. Login nie jest członkiem ownera lub `neon_superuser`, nie ma CREATE/TEMP bazy, CREATE schematu ani bezpośrednich praw do tabel authority i audytu. Może wykonać dokładnie `runtime_descriptor`, `identity_binding`, `lock_access`, `scope_allows` i `append_audit`. Funkcje pomocnicze pozostają niedostępne.

`runtime_descriptor()` przez ten rzeczywisty login zwrócił oczekiwaną odmowę `Runtime binding unavailable`, ponieważ aplikacja pozostaje DISABLED. Odmowa nie została zastąpiona uprzywilejowanym loginem lub SET ROLE. Katalog po transakcji potwierdził revision 6, niezmieniony checksum i fizyczne identyfikatory, 10 tabel z ENABLE i FORCE RLS, zero praw PUBLIC bazy i EXECUTE funkcji oraz zero rekordów kont, powiązań tożsamości, organizacji, członkostw, grantów i audytu. Obie aplikacje są nadal DISABLED; mapowania SG2 zachowano.

## Dowody i odzyskiwanie

[Metadane SRM](../../apps/srm/deployment/private-store-preparation.json) opisują przygotowanie, nie aktywną konfigurację procesu. [Rejestr zasobu](../registries/platform-private-onboarding-v1.json) dodaje osobną referencję SRM i zachowuje historyczny odbiór SG2. Przygotowanie loginu nie dowodzi separacji biznesowych tabel SRM, sesji Clerk lub wdrożenia.

To pierwsza addytywna inicjalizacja nieużywanego dostępu SRM, bez poprzedniego artefaktu tej integracji. Bezpieczne zatrzymanie pozostawia nieużywany login i aplikację DISABLED, a dotychczasowy SRM działa ze swoją bazą i konfiguracją. Nie wykonano destrukcyjnego SQL, resetu, migracji danych klienta, bootstrapu tożsamości, zmiany sekretów lub konfiguracji Render/GitHub, deploymentu ani operacji Staging/Production. Nie zmieniono istniejących usług i baz produktów.

## Pozostałe granice E1

SRM nadal ma istniejący kontrakt połączenia do `srm_app`; nie można traktować zmiany URL na `platform_private` jako gotowej migracji. Osobne zadania muszą objąć zgodną topologię, schemat i zachowanie danych SRM, wewnętrzne konta i członkostwa z potwierdzoną tożsamością Clerk, integrację chronionych wejść, testy biznesowe, odzyskiwanie i kontrolowane wydania Development oraz Staging. Przygotowanie roli nie zamyka tych luk. **E1 pozostaje IN_PROGRESS**.
