# Platform Knowledge — przygotowanie ograniczonych ról Neon Development

Status: instrukcja wykonania przez właściciela lub wyraźnie upoważnionego wykonawcę; samo opublikowanie nie oznacza instalacji. Korekta pierwszej inicjalizacji haseł: 2026-11-11.

Powiązanie: [kanon v1](../v1.0-platform-knowledge-business-and-architecture-canon.md), [harmonogram](platform-knowledge-development-delivery-plan-v1.md), etap 1. Nie tworzy tabel produktu ani nie nadaje dostępu do dokumentów. Nie zastępuje migracji i odbioru etapu 2.

## 1. Wybór zasobu

W Neon Console wybierz projekt `sparkling-sky-79692560`, gałąź `development` / `br-billowing-grass-b9ko5s4f`, a następnie bazę **`platform_knowledge`** i rolę administracyjną `neondb_owner` w SQL Editor. Sprawdź identyfikatory projektu i gałęzi w konsoli — sama nazwa bazy nie dowodzi wyboru właściwego środowiska. Nie uruchamiaj w PMOS, Memoros, Staging ani Production.

Potwierdzony compute: `ep-wild-mode-b972j8k0`, Frankfurt, PostgreSQL 18; rozszerzenie `vector` 0.8.6 istnieje w tej bazie. Ten skrypt nie instaluje rozszerzeń. Nie zmienia istniejących innych baz i ich uprawnień.

## 2. Jednorazowe przygotowanie

Uruchom cały blok jako jedną operację. Pierwsza kontrola zatrzymuje transakcję przy innej nazwie bazy. Ponowne wykonanie jest bezpieczne dla zgodnego stanu. Istniejące role o niezgodnych atrybutach powodują błąd zamiast cichej zmiany ich uprawnień.

```sql
BEGIN;
DO $guard$
BEGIN
  IF current_database() <> 'platform_knowledge' THEN
    RAISE EXCEPTION 'Wrong database: expected platform_knowledge';
  END IF;
END
$guard$;
SELECT pg_advisory_xact_lock(hashtextextended('platform-knowledge-role-bootstrap-v1', 0));

DO $roles$
DECLARE
  role_name text;
  expected_login boolean;
  initial_password text;
  actual record;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'platform_knowledge_owner', 'platform_knowledge_api',
    'platform_knowledge_worker', 'platform_knowledge_migrator'
  ] LOOP
    expected_login := role_name <> 'platform_knowledge_owner';
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      IF expected_login THEN
        initial_password := replace(pg_catalog.gen_random_uuid()::text, '-', '')
                         || replace(pg_catalog.gen_random_uuid()::text, '-', '');
        EXECUTE format(
          'CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
          role_name, initial_password
        );
        initial_password := NULL;
      ELSE
        EXECUTE format(
          'CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', role_name
        );
      END IF;
    END IF;
    SELECT * INTO actual FROM pg_roles WHERE rolname = role_name;
    IF actual.rolcanlogin <> expected_login OR actual.rolinherit
       OR actual.rolsuper OR actual.rolcreatedb OR actual.rolcreaterole
       OR actual.rolreplication OR actual.rolbypassrls THEN
      RAISE EXCEPTION 'Unexpected attributes for role %', role_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_auth_members m
    JOIN pg_roles member_role ON member_role.oid = m.member
    JOIN pg_roles granted_role ON granted_role.oid = m.roleid
    WHERE member_role.rolname IN (
      'platform_knowledge_owner', 'platform_knowledge_api',
      'platform_knowledge_worker', 'platform_knowledge_migrator'
    ) AND NOT (
      member_role.rolname = 'platform_knowledge_migrator'
      AND granted_role.rolname = 'platform_knowledge_owner'
    )
  ) THEN
    RAISE EXCEPTION 'Unexpected role membership: manual review required';
  END IF;
  EXECUTE format('GRANT platform_knowledge_owner TO %I', current_user);
END
$roles$;

GRANT platform_knowledge_owner TO platform_knowledge_migrator;
REVOKE ALL ON DATABASE platform_knowledge FROM PUBLIC;
GRANT CONNECT ON DATABASE platform_knowledge
  TO platform_knowledge_api, platform_knowledge_worker, platform_knowledge_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS platform_knowledge AUTHORIZATION platform_knowledge_owner;
DO $schema_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner
    WHERE n.nspname = 'platform_knowledge' AND r.rolname = 'platform_knowledge_owner'
  ) THEN
    RAISE EXCEPTION 'Unexpected owner of platform_knowledge schema';
  END IF;
END
$schema_guard$;
REVOKE ALL ON SCHEMA platform_knowledge FROM PUBLIC;
GRANT USAGE ON SCHEMA platform_knowledge TO platform_knowledge_api, platform_knowledge_worker;

-- Global defaults for this owner's future objects in this database.
-- A per-schema REVOKE would not remove the global PUBLIC EXECUTE default.
ALTER DEFAULT PRIVILEGES FOR ROLE platform_knowledge_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE platform_knowledge_owner REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE platform_knowledge_owner REVOKE ALL ON SEQUENCES FROM PUBLIC;

ALTER ROLE platform_knowledge_api IN DATABASE platform_knowledge
  SET search_path = pg_catalog, platform_knowledge;
ALTER ROLE platform_knowledge_worker IN DATABASE platform_knowledge
  SET search_path = pg_catalog, platform_knowledge;
ALTER ROLE platform_knowledge_migrator IN DATABASE platform_knowledge
  SET search_path = pg_catalog, platform_knowledge;
COMMIT;
```

Rola instalacyjna zachowuje członkostwo w `platform_knowledge_owner`, aby przygotowywać schemat. Migrator używa jawnego `SET ROLE platform_knowledge_owner`; API i Worker nie otrzymują tego członkostwa. Role są ograniczone atrybutami i grantami — `NOINHERIT` samo w sobie nie zastępuje kontroli członkostwa.

Skrypt zakłada pusty, nowy schemat produktu. Nie odbiera grantów istniejącym tabelom lub funkcjom; jeśli schemat zawiera już obiekty produktu, przerwij i ustal ich stan przed uruchomieniem. Publiczne rozszerzenie `vector` będzie adresowane jawnie przez migracje; nie dodawaj zapisywalnego schematu do `search_path` runtime.

## 3. Hasła i konfiguracja połączeń

Nowe role LOGIN otrzymują w tym skrypcie losowe hasła startowe generowane przez serwer, bez wypisywania wartości. Hasło nie jest nadawane roli NOLOGIN. Powtórzenie skryptu nie zmienia haseł istniejących ról. Dla runtime przygotuj odrębne silne poświadczenia i zachowaj je w bezpiecznej konfiguracji. Nie wstawiaj docelowych haseł do GitHub, rozmowy, historii poleceń ani raportów.

**Role utworzone poprzednią wersją skryptu bez PASSWORD:** konsola Neon może zwrócić `cannot update password for role without password`. Najpierw potrzebna jest jednorazowa inicjalizacja przez autoryzowane połączenie SQL, poleceniem `ALTER ROLE ... WITH PASSWORD ...`, z zachowaniem tożsamości roli i istniejących grantów. Po tym kroku można użyć panelu Reset password. Nie usuwaj ani nie odtwarzaj ról i nie nadawaj `neon_superuser` w celu obejścia problemu.

Neon wymaga przekazania hasła jawnego do operacji SQL przez szyfrowane połączenie i nie obsługuje haseł wstępnie zahashowanych. Dlatego nie używamy tu `psql \password`, które wysyła wstępnie wyliczony verifier. Docelowe wartości należy wczytać z autoryzowanego źródła sekretów w kontrolowanym kliencie, bez wypisywania SQL i odpowiedzi zawierających hasła, zamiast wpisywać je do historii SQL Editora. Nie zakładamy, że ta instrukcja zmienia zasady logowania po stronie dostawcy. [Neon: zarządzanie rolami i hasłami](https://neon.com/docs/manage/roles#manage-roles-with-sql).

W Development potwierdzono inicjalizację trzech istniejących ról przez SQL oraz logowanie każdą z nich. Odczyt zachował NOINHERIT oraz brak superuser/createdb/createrole/replication/bypassrls. Nie wykonano migracji tabel produktu. Wartości haseł nie są częścią dokumentacji.

W konfiguracji usług Render zapisz połączenia bezpośrednio jako sekrety:

| Odbiorca | Rola | Host | Baza | Zastosowanie |
| --- | --- | --- | --- | --- |
| API | `platform_knowledge_api` | `ep-wild-mode-b972j8k0-pooler.c-7.eu-central-1.aws.neon.tech` | `platform_knowledge` | wyłącznie jawnie dopuszczone funkcje API po migracji |
| Worker | `platform_knowledge_worker` | ten sam host pooled | `platform_knowledge` | wyłącznie jawnie dopuszczone funkcje zadań po migracji |
| Kontrolowana instalacja | `platform_knowledge_migrator` | `ep-wild-mode-b972j8k0.c-7.eu-central-1.aws.neon.tech` | `platform_knowledge` | migracje, osobno od działających usług |

Wymagane TLS; zachowaj ustawienia bezpieczeństwa generowane przez Neon. API/Worker nie otrzymują połączenia migratora ani `neondb_owner`. Po tym przygotowaniu nie mają dostępu do tabel produktu: granty konkretnych funkcji, RLS i ewentualne uprawnienia robocze są częścią kontrolowanych migracji. Nie stosuj `GRANT ALL` do runtime. Domyślna baza `neondb` pozostaje poza konfiguracją produktu; ten skrypt nie twierdzi, że zmienia jej PUBLIC CONNECT.

## 4. Odczyt wyniku i potwierdzenie właściciela

```sql
SELECT current_database() AS database_name, current_user AS setup_role;
SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolcreatedb, rolcreaterole,
       rolreplication, rolbypassrls
FROM pg_roles WHERE rolname LIKE 'platform_knowledge_%' ORDER BY rolname;
SELECT n.nspname, r.rolname AS schema_owner
FROM pg_namespace n JOIN pg_roles r ON r.oid = n.nspowner
WHERE n.nspname = 'platform_knowledge';
SELECT member_role.rolname AS member_role, granted_role.rolname AS granted_role
FROM pg_auth_members m
JOIN pg_roles member_role ON member_role.oid = m.member
JOIN pg_roles granted_role ON granted_role.oid = m.roleid
WHERE member_role.rolname LIKE 'platform_knowledge_%';
```

Przekaż wyłącznie: projekt, branch, nazwę bazy, potwierdzenie wykonania i ustawienia trzech haseł. Nie przesyłaj connection strings. Agent następnie odczyta metadane i zweryfikuje połączenia usług po ich utworzeniu. Błąd transakcji oznacza brak gotowości, a nie zgodę na użycie konta właścicielskiego w runtime.

## 5. Weryfikacja instrukcji i granice

Weryfikacja 2026-11-11: PASS w izolowanym lokalnym PostgreSQL 16.14, instalacja przez niesuperużytkownika `pk_setup_owner` z CREATEROLE. Sprawdzono odmowę w innej bazie bez utworzenia ról, dwukrotne wykonanie, atrybuty i członkostwa, brak możliwości tworzenia obiektów i przejęcia roli właściciela przez API/Worker oraz brak dostępu do nowej tabeli i automatycznego PUBLIC EXECUTE nowej funkcji. Po korekcie sprawdzono również obecność haseł wyłącznie trzech ról LOGIN oraz zachowanie tych samych verifierów przy ponownym uruchomieniu; ich wartości nie były wypisywane. Klaster testowy zatrzymano. Wynik lokalny nie zastępuje odczytu rzeczywistej instalacji na Neon PostgreSQL 18; agent nie wykonał instalacji w Neon.

Przy błędzie przed COMMIT wycofaj transakcję. Po pomyślnym COMMIT nie usuwaj automatycznie ról ani schematu: najpierw sprawdź, czy rozpoczęły się migracje lub pojawiły się zależne obiekty. Zatrzymanie nieudanego pierwszego uruchomienia usług nie wymaga kasowania przygotowanej bazy.
