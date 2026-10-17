# E1 — przygotowanie prywatnego magazynu Development

Status: **PREPARED_NOT_ACTIVATED**. Data dowodów: 17.10.2026, około 07:55 UTC. Profil SG2 / SpendGuru 2.0, Development, wykonanie lokalne. Zadanie: `SG2-E1-PRIVATE-STORE-PREPARATION-20261017`. Jest to przygotowanie bazy odbiorcy, nie wdrożenie mechanizmu do działającego produktu ani zamknięcie E1.

## Podstawa i zakres

Właściciel zlecił E0/E1 w trybie Full Autopilot i osobiście utworzył projekt `profitia-platform-private`. Osobne zadanie ARCHITECTURE zweryfikowało zasób i ograniczyło compute. Przyjęto dokładny SQL producenta [PR #398](https://github.com/profitia/SG-dev/pull/398), source `5347523b97b44a7a41d69d03a45372ccfe26b8dc`, pakiet 1.3.0, access-store i schemat 1.0.0. Checksum SQL: `356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2`. Treść migracji nie została zmieniona podczas wykonania u dostawcy.

Zapisano [metadane przygotowania SG2](../../apps/sg-runtime/deployment/private-store-preparation.json) i zaktualizowano [rejestr nowego zasobu](../registries/platform-private-onboarding-v1.json). Są to dowody przygotowania; plik w katalogu deployment nie jest aktywną konfiguracją procesu.

## Rzeczywisty zasób i stan przed operacją

- Organizacja Neon: `org-nameless-field-92563437`, dotychczasowy plan Scale, bez zmiany planu lub organizacji.
- Projekt: `spring-bread-28217539`, AWS Frankfurt, PostgreSQL 16.
- Development: `br-sparkling-term-b99l107x`, endpoint `ep-late-heart-b9mxo8oi`.
- Przed inicjalizacją ponownie odczytano tylko bazę `neondb`, zero tabel użytkownika i brak przygotowywanych ról. Nie kopiowano danych istniejących produktów.
- Nowa baza: `platform_private`, ID `43910`. Pierwotna `neondb` pozostała na miejscu.

## Próba przed inicjalizacją

Z pustej gałęzi Development utworzono techniczną gałąź `br-odd-unit-b9937sdw`, endpoint `ep-summer-voice-b95e670q`, baza `platform_private` / `43876`. Odczytano automatyczne wygaśnięcie `2026-10-17T13:40:39Z`, compute min=max 0.25 CU i usypianie 300 s. Nie usuwano gałęzi ani danych produktów. Dane próby są wyłącznie syntetyczne.

Pierwsza próba tworzenia loginów przez API ujawniła domyślne członkostwo `neon_superuser` i BYPASSRLS. Nie użyto tych loginów w aplikacjach. Próby odebrania im uprzywilejowania zakończyły się odmową i rollbackiem. Zgodnie z [dokumentacją Neon dotyczącą ról](https://neon.com/docs/manage/roles) zwykłe loginy utworzono następnie przez SQL, z losowym hasłem generowanym wyłącznie po stronie dostawcy. Agent nie pobierał ani nie zapisywał wartości haseł. Dwa własne, nieużyte loginy z API usunięto po odczycie zero posiadanych obiektów i zero aktywnych sesji. Ponowny katalog potwierdził ich brak. Nie zmieniono żadnej cudzej roli.

Próba przy użyciu **rzeczywistych loginów** `sg2_private_sql_fixture` i `srm_private_sql_fixture`, a nie uprzywilejowanego połączenia z SET ROLE, potwierdziła:

- wszystkie flagi SUPERUSER, CREATEDB, CREATEROLE, BYPASSRLS i INHERIT są false, brak członkostwa ownera i `neon_superuser`;
- dwaj użytkownicy tej samej organizacji widzą po jednym własnym rekordzie osobistym oraz wspólny rekord organizacji;
- jeden użytkownik należący do dwóch organizacji widzi wyłącznie dane wybranej organizacji;
- bez kontekstu i po wygaśnięciu kontekstu wynik zawiera zero prywatnych rekordów; kontekst LOCAL nie pozostaje po transakcji;
- zapis do cudzej organizacji i do danych innego użytkownika kończy się odmową RLS, a odwołanie do rodzica z innej organizacji odmową klucza obcego;
- druga aplikacja nie uzyskuje zakresu pierwszej i nie ma dostępu do jej schematu biznesowego;
- runtime nie czyta tabel authority, nie przyjmuje roli ownera i nie ma praw odczytu lub przepisywania tabeli audytu;
- dozwolony zapis syntetycznego zdarzenia DENY przez ograniczoną funkcję działa.

Katalog potwierdził 10 tabel dostępu z ENABLE i FORCE RLS, NOLOGIN ownera oraz pięć funkcji SECURITY DEFINER z ustalonym search_path, bez EXECUTE dla PUBLIC. Szczegółowe testy adaptera, serializacji odwołania i atomowości skutku/audytu pozostają dodatkowym dowodem producenta z PR #398; ta próba nie zastępuje testu rzeczywistych aplikacji lub sesji Clerk.

## Przygotowanie właściwego Development

Po pomyślnej próbie zastosowano tę samą migrację w jednej transakcji do nowej bazy Development. Oddzielny owner `profitia_access_owner` ma NOLOGIN, NOINHERIT i brak BYPASSRLS. Uprzywilejowany administrator dostawcy pozostaje granicą zaufania do migracji; nie jest runtime aplikacji. Po inicjalizacji odebrano ownerowi niepotrzebne CREATE na poziomie bazy.

Loginy `sg2_private_development_runtime` i `sg2_private_development_dashboard` utworzono przez SQL. Niezależne połączenia przez każdy login potwierdziły `current_user=session_user`, wszystkie pięć flag uprzywilejowania false, brak członkostwa ownera i `neon_superuser`, limit 4 połączeń, statement timeout 15 s, lock timeout 3 s i idle-in-transaction timeout 15 s. Nie nadano CREATE/TEMP bazy ani bezpośrednich praw do tabel authority i audytu. PUBLIC nie ma CONNECT/TEMP tej nowej bazy.

Runtime ma USAGE schematu i EXECUTE wyłącznie pięciu funkcji z zaakceptowanego kontraktu. Oba loginy przypisano do `spendguru`, lecz aplikacja pozostaje **DISABLED**. Wywołanie `runtime_descriptor()` przez każdy rzeczywisty login zakończyło się oczekiwaną odmową `Runtime binding unavailable`.

Odczyt po operacji potwierdził 10 tabel z FORCE RLS i prawidłowym ownerem, dokładny schema digest, fizyczne identyfikatory instalacji oraz zero kont, zewnętrznych powiązań, organizacji, członkostw, grantów uprawnień i produktów oraz zdarzeń audytu. Brak danych klienta jest zamierzony; nie przypisywano historii demo administratorowi.

## Ochrona działających aplikacji i odzyskiwanie

To pierwsza, addytywna inicjalizacja nieużywanego magazynu. Nie istnieje poprzedni artefakt tej bazy; nie zapisano fikcyjnego LKG. Bezpieczne zatrzymanie polega na pozostawieniu aplikacji DISABLED i zachowaniu niewykorzystywanego schematu. Nie uruchamiano DROP, resetu, TRUNCATE, kasowania danych ani cofania migracji.

Nie zmieniono istniejących baz SG2/SRM, konfiguracji Render/GitHub, credentiali produktów, domen, polityk dostępu do infrastruktury, Staging lub Production. Nie wykonywano deploymentu ani przepięcia połączeń. Nowe role nie są poświadczeniami PMOS lub ARCHITECTURE Lab.

## Jawne granice odbioru

Potwierdzono przygotowanie magazynu i syntetyczne granice SQL. Nadal wymagają osobnych jednostek: bootstrap potwierdzonej tożsamości, własne role i schemat SRM, prywatny schemat biznesowy SG2, zgodna migracja danych, aktualne granty, integracja wszystkich wejść produktów, zadania/cache/pliki, audyt aplikacyjny, rzeczywiste sesje, odzyskiwanie oraz kontrolowane wydania Development i Staging. Przygotowanie bazy nie dowodzi ich wdrożenia. Pełny E1 pozostaje **IN_PROGRESS**.
