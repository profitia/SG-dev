# E1 — weryfikacja nowego prywatnego projektu

Status: RESOURCE_VERIFIED_SCHEMA_PENDING. To odbiór zasobu Development i jego ustawień, bez odbioru tożsamości, separacji danych lub migracji produktów.

Zadanie `ARCHITECTURE-E1-PRIVATE-RESOURCE-ONBOARDING-20261017`, ARCHITECTURE / SG-dev Architecture / Development / local. Source baseline `8b39f0ec1dfc00d4f2eeb806cbf550d51ba49581`. Właściciel osobiście utworzył projekt i przekazał adres endpointu bez hasła. Begin `cmvc1ie7b00003j9pz03l1z15`; conversationId `pmos-task-v2:7e2b37ef11531a93539b18d9f35e5ce06f4177a5a84dd544d41f470047981205`. Rejestracja nie jest closeout.

## Potwierdzone fakty

[Rejestr zasobu](../registries/platform-private-onboarding-v1.json) zapisuje rzeczywiste identyfikatory. Neon API potwierdziło projekt `spring-bread-28217539`, nazwę `profitia-platform-private`, dotychczasową organizację `org-nameless-field-92563437`, AWS Frankfurt i PostgreSQL 16. Gałąź `development` ma ID `br-sparkling-term-b99l107x`, endpoint `ep-late-heart-b9mxo8oi`. Adres podany przez właściciela odpowiada dokładnie temu endpointowi.

Lista baz wykazała jedynie `neondb`, ID43720, owner `neondb_owner`. Odczyt katalogu przez MCP w tej bazie potwierdził PostgreSQL16.15, zero tabel użytkownika oraz zero schematów `auth`/`neon_auth`. Odczyt ownera nie dowodzi istnienia ograniczonej roli runtime; takich ról ani ich uprawnień jeszcze nie odebrano. Panel pokazuje Better Auth jako usługę do uruchomienia; nie aktywowano jej ani Data API.

## Wykonana korekta

Początkowe default settings projektu i istniejący endpoint miały min0.25/max8CU oraz suspend timeout0. Po pełnym preflight i własnym begin skorygowano wyłącznie te ustawienia do min=max0.25CU i suspend300s. Domyślne ustawienia zmieniono przez Neon API, istniejący endpoint przez jego formularz Computes. Niezależny odczyt API potwierdził oba stany końcowe. Plan organizacji, region, wersja Postgres, historia1dzień i ustawienia dostępu pozostały bez zmian.

Przed korektą potwierdzono pusty katalog i brak odbiorcy produktu w tym nowym projekcie. Zmiana compute może krótko przerwać połączenie tego endpointu; nie dotyczyła istniejących endpointów produktów. Przywrócenie ustawień jest odwracalne do zapisanej wartości poprzedniej, lecz nie jest wymagane: końcowy stan odpowiada uzgodnionej konfiguracji. Nie wykonywano deploymentu, migracji, backup restore, resetu lub kopiowania danych. Usypianie ogranicza czas rozliczany, nie ustanawia twardego limitu kosztu.

## Granice dalszego użycia

Zasób służy przyszłej prywatnej warstwie: własnym identyfikatorom i uprawnieniom Profitii oraz prywatnym danym SpendGuru, oddzielonym od wiedzy rynkowej. Nie jest magazynem PMOS ani laboratorium ARCHITECTURE. Ten pomocniczy rejestr nie zastępuje aktywnych topologii SG2/SRM i nie aktywuje połączenia produktu.

Schemat, osobne bazy i role, powiązania odbiorców, bootstrap zweryfikowanej tożsamości oraz migracje mają otrzymać własne zadania i dowody. Nie utworzono gałęzi Staging ani Production. ARCHITECTURE Staging pozostaje RESERVED; zadania produktów zachowują właściwe środowiska i źródła dowodów. Działające Development i Staging SG2/SRM nadal korzystają z dotychczasowych zasobów. Cały program E0/E1 pozostaje IN_PROGRESS.
