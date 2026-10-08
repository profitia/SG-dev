# SRM — Database Promotion & Migration Contract

Task SRM-STAGING-ONBOARDING-READINESS-20261008. Implementacja przygotowana w Development. Żadnych zapisów do Neon Staging ani Production.

## Tożsamość i źródło DDL

Jedynym źródłem DDL jest apps/srm/db/migrations/*.sql, uporządkowane 0001–0011. SHA256 treści każdej migracji jest zapisywany w srm.schema_migrations. Live Development ma 11 rekordów, których checksums porównano ze źródłem. Nie modyfikowano istniejącego Development migratora apps/srm/scripts/migrate.mjs ani jego guarda Development-only.

Osobny apps/srm/scripts/staging-migrate.mjs akceptuje wyłącznie projekt snowy-breeze-40315151, branch br-broad-butterfly-b11t4v01, owner direct host ep-autumn-wildflower-b1mv0vda.c-5.eu-central-1.aws.neon.tech, neondb_owner, srm_app i sslmode=require. Pooler, query override, PMOS, Development i Production są odrzucane przed połączeniem. Przy apply wymagane: jawna nieprzeterminowana autoryzacja tego SHA i operacji, aktualny main z reviewed mechanizmem, identyczny zestaw DDL/kontraktów dla release SHA, full governance preflight i fresh provider snapshot.

## Zweryfikowany schemat

Schematy public i srm. Extensions: plpgsql; gen_random_uuid jest wbudowane w PostgreSQL 16. Produkt ma 15 tabel z ENABLE i FORCE RLS: organizations, suppliers, lookup_requests, provider_attempts, source_snapshots, section_projections, financial_facts, catalog_companies, catalog_financial_facts, catalog_financial_indicators, catalog_kys_reports, users, organization_supplier_interest, user_supplier_interest, mgbi_source_archives. Ledger migracji nie jest tabelą produktową i pozostaje poza runtime grants. Funkcja/trigger reject_snapshot_update chroni niezmienność source snapshots. Constraints, FK, indexes i policies wynikają z wersjonowanego DDL.

Runtime srm_app_runtime ma LOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE, NOREPLICATION i nie może dziedziczyć privileged role ani neon_superuser. Owner connection służy tylko migracji. Runtime dostaje USAGE srm, SELECT organizations, prawa podstawowych tabel oraz prawa z jawnych migracji; DELETE tylko tam, gdzie kanoniczny retention DDL je przyznaje. Nie przyznaje się runtime dostępu do ledger.

## Pierwsze uruchomienie — wyłącznie przyszły autoryzowany lifecycle

Zaimplementowany staging-lifecycle.mjs tworzy tylko brakującą srm_app na dokładnym zarejestrowanym branchu, po odrębnej autoryzacji first onboarding i kosztów. Przed każdym write weryfikuje provider snapshot, source/governance i journal fence; zapisuje INTENT/DONE oraz rzeczywisty database ID. Nie ustawia ACTIVE przed kompletną weryfikacją. W tym tasku nie wykonano tej operacji.

Następnie biblioteczny runMigrations wykonuje atomowo rolę, wszystkie brakujące migracje, grants i jedną pustą syntetyczną organizację. Przy pierwszym trybie wymagane są osobny UUID i odrębne hasło runtime >=32 znaki. Istniejącej roli nie obraca ani nie naprawia automatycznie; niebezpieczne atrybuty blokują. Zastanej organizacji nie nadpisuje. Nie kopiuje rekordów Development/Production: dostawców, osobowych KYS/PESEL, RAW, snapshots, audytu, users i caches.

## Upgrade, dry-run i retry

Ledger musi być ciągłym prefiksem kanonicznego zestawu. Nieznana wersja, duplikat, luka lub checksum drift zatrzymują operację przed DDL. Retry po COMMIT aplikuje zero już zapisanych migracji. Błąd dowolnego SQL wycofuje całą transakcję, łącznie z rolą, schematem, ledger i seed. Nie adoptujemy zastanego schematu srm bez ledger.

Offline:

~~~sh
npm --prefix apps/srm run migrate:staging:plan
~~~

To nie łączy się z bazą. Biblioteczny dryRun używa BEGIN READ ONLY i ROLLBACK, nie uruchamia DDL ani INSERT. Nie jest testem wykonalności DDL; tę część pokrywa rzeczywisty izolowany Postgres 16.

Przyszłe wykonanie odbywa się jednym kanonicznym promotorem, z autoryzacją schemaVersion 2.0 mode=onboard/promote. Nie uruchamiać starego samodzielnego apply jako obejścia ordinary RESERVED preflight. Development migrator nadal przyjmuje wyłącznie Development.

~~~sh
npm --prefix apps/srm run promote:staging -- --apply --sha "$APPROVED_SHA" --authorization /secure/staging-lifecycle-approval-v2.json
~~~

## Odzyskiwanie i rollback

Po błędzie migracji sprawdzić ledger read-only. Jeśli transakcja nie zatwierdziła się, usunąć przyczynę i ponowić ten sam zatwierdzony manifest; nie resetować brancha. Po COMMIT zachowuje się schema/data także przy błędzie Render. Poprawka wraca przez Development/PR. Rollback kodu wymaga oddzielnej autoryzacji rollback, zaakceptowanego SHA, przechodzącego CI i identycznego kompatybilnego DDL/kontraktu. Nie ma automatycznej migracji w dół, DROP schema ani resetu Neon w ścieżce produktu. DROP w teście jest ograniczony do jednorazowej lokalnej srm_migration_test na localhost; Production/Staging nie są akceptowane przez test runner.

Dowody: real first initialization, retry, actual SQL-error transaction rollback, role attributes, 15 FORCE-RLS tables, no-context/wrong-context tenant rejection, checksum drift. Szczegóły wyników znajdują się w staging-readiness.md i artefaktach SRM CI.

Final lifecycle persistence proof writes only a deterministic synthetic lookup probe under the actual Stage runtime role, then verifies durable own-tenant visibility and no/foreign-context denial. Local PostgreSQL tests cover committed persistence, retry, read-only recovery and FORCE RLS catalog drift. No external supplier request or customer record is seeded.
