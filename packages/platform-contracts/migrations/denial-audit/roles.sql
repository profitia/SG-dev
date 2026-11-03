-- Separately approved role administrator only; credential provisioning is external.
-- No password is embedded. These roles receive no application/base-table rights.
BEGIN;
DO $roles$ BEGIN
 IF current_database()='platform_private' THEN
  IF NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development' AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x') THEN RAISE EXCEPTION 'D1_SCOPE_DENIED';END IF;
  CREATE ROLE sg2_d1_private_denial_reader LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
 ELSIF current_database()='neondb' THEN
  IF NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND environment='development' AND project_id='autumn-waterfall-65938876' AND branch_id='br-dry-hall-b294222f') THEN RAISE EXCEPTION 'D1_SCOPE_DENIED';END IF;
  CREATE ROLE sg2_d1_source_denial_reader LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
 ELSE RAISE EXCEPTION 'D1_DATABASE_DENIED';END IF;
END $roles$;
COMMIT;
