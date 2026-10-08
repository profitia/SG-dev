# SRM — Database Promotion & Migration Contract

Task SRM-STAGING-READINESS-20261008. Implementacja przygotowana w Development. Żadnych zapisów do Neon Staging ani Production.

## Tożsamość i źródło DDL

Jedynym źródłem DDL jest apps/srm/db/migrations/*.sql, uporządkowane 0001–0011. SHA256 treści każdej migracji jest zapisywany w srm.schema_migrations. Live Development ma 11 rekordów, których checksums porównano ze źródłem. Nie modyfikowano istniejącego Development migratora apps/srm/scripts/migrate.mjs ani jego guarda Development-only.

Osobny apps/srm/scripts/staging-migrate.mjs akceptuje wyłącznie projekt snowy-breeze-40315151, branch br-broad-butterfly-b11t4v01, owner direct host ep-autumn-wildflower-b1mv0vda.c-5.eu-central-1.aws.neon.tech, neondb_owner, srm_app i sslmode=require. Pooler, query override, PMOS, Development i Production są odrzucane przed połączeniem. Przy apply wymagane: jawna nieprzeterminowana autoryzacja tego SHA i operacji, aktualny main z reviewed mechanizmem, identyczny zestaw DDL/kontraktów dla release SHA, full governance preflight i fresh provider snapshot.

## Zweryfikowany schemat

Schematy public i srm. Extensions: plpgsql; gen_random_uuid jest wbudowane w PostgreSQL 16. Produkt ma 15 tabel z ENABLE i FORCE RLS: organizations, suppliers, lookup_requests, provider_attempts, source_snapshots, section_projections, financial_facts, catalog_companies, catalog_financial_facts, catalog_financial_indicators, catalog_kys_reports, users, organization_supplier_interest, user_supplier_interest, mgbi_source_archives. Ledger migracji nie jest tabelą produktową i pozostaje poza runtime grants. Funkcja/trigger reject_snapshot_update chroni niezmienność source snapshots. Constraints, FK, indexes i policies wynikają z wersjonowanego DDL.

Runtime srm_app_runtime ma LOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION i nie może dziedziczyć privileged role ani neon_superuser. Owner connection służy tylko migracji. Runtime dostaje USAGE srm, SELECT organizations, prawa podstawowych tabel oraz prawa z jawnych migracji; DELETE tylko tam, gdzie kanoniczny retention DDL je przyznaje. Nie przyznaje się runtime dostępu do ledger.

## Pierwsze uruchomienie — po legalnym S0

Utworzenie bazy Neon nie jest wykonywane tym migratorem. W obecnym tasku nie wolno go wykonywać. S0 musi wcześniej legalnie utworzyć bazę i onboarding/identyfikatory, zgodnie z runbookiem. Ten warunek jest blokerem gotowości, nie pozorną automatyzacją.

Po S0 opcja initialize wymaga osobnej operacji initialize w autoryzacji, nowego UUID SRM_STAGING_ORGANIZATION_ID i odrębnego runtime hasła min. 32 znaki. Jedna transakcja: advisory lock, bezpieczna create-if-absent rola, walidacja ledger, wszystkie brakujące migracje, ograniczone grants, jedna syntetyczna organizacja slug srm-staging-acceptance, COMMIT. Istniejącej roli nie obraca się ani nie naprawia automatycznie; niebezpieczne atrybuty blokują. Istniejącej organizacji nie nadpisuje się. Nie kopiujemy danych Dev/Prod: supplier records, personal KYS/PESEL, RAW, snapshots, audit, user records i caches pozostają w źródle. Aplikacja uzupełnia dane tylko przez późniejsze jawnie autoryzowane użycie integracji.

## Upgrade, dry-run i retry

Ledger musi być ciągłym prefiksem kanonicznego zestawu. Nieznana wersja, duplikat, luka lub checksum drift zatrzymują operację przed DDL. Retry po COMMIT aplikuje zero już zapisanych migracji. Błąd dowolnego SQL wycofuje całą transakcję, łącznie z rolą, schematem, ledger i seed. Nie adoptujemy zastanego schematu srm bez ledger.

Offline:

~~~sh
npm --prefix apps/srm run migrate:staging:plan
~~~

To nie łączy się z bazą. Biblioteczny dryRun używa BEGIN READ ONLY i ROLLBACK, nie uruchamia DDL ani INSERT. Nie jest testem wykonalności DDL; tę część pokrywa rzeczywisty izolowany Postgres 16.

Przyszłe wykonanie po S0, z chronionymi env i jawną autoryzacją:

~~~sh
node apps/srm/scripts/staging-migrate.mjs --apply --initialize --sha "$APPROVED_SHA" --authorization /secure/approval.json --provider-snapshot /secure/provider-snapshot.json
~~~

Gdy schema/role/organization już istnieją, pomija się initialize. Nie publikować connection strings ani password values.

## Odzyskiwanie i rollback

Po błędzie migracji sprawdzić ledger read-only. Jeśli transakcja nie zatwierdziła się, usunąć przyczynę i ponowić ten sam zatwierdzony manifest; nie resetować brancha. Po COMMIT zachowuje się schema/data także przy błędzie Render. Poprawka wraca przez Development/PR. Rollback kodu wymaga oddzielnej autoryzacji rollback, zaakceptowanego SHA, przechodzącego CI i identycznego kompatybilnego DDL/kontraktu. Nie ma automatycznej migracji w dół, DROP schema ani resetu Neon w ścieżce produktu. DROP w teście jest ograniczony do jednorazowej lokalnej srm_migration_test na localhost; Production/Staging nie są akceptowane przez test runner.

Dowody: real first initialization, retry, actual SQL-error transaction rollback, role attributes, 15 FORCE-RLS tables, no-context/wrong-context tenant rejection, checksum drift. Szczegóły wyników znajdują się w staging-readiness.md i artefaktach SRM CI.
