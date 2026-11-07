-- Approved role administrator only. Retain objects/evidence for forensics.
-- Execute against each approved database; never against another database.
BEGIN;
DO $expire$ BEGIN
 IF current_database()='platform_private' THEN
  SET LOCAL ROLE profitia_access_owner;
  IF NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development' AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x') THEN RAISE EXCEPTION 'D1_SCOPE_DENIED';END IF;
  REVOKE EXECUTE ON FUNCTION profitia_sg2_d1_private.read_case(text) FROM sg2_d1_private_denial_reader;
  REVOKE USAGE ON SCHEMA profitia_sg2_d1_private FROM sg2_d1_private_denial_reader;
  RESET ROLE;
  ALTER ROLE sg2_d1_private_denial_reader NOLOGIN;
 ELSIF current_database()='neondb' THEN
  SET LOCAL ROLE profitia_ingestion_owner;
  IF NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND environment='development' AND project_id='autumn-waterfall-65938876' AND branch_id='br-dry-hall-b294222f') THEN RAISE EXCEPTION 'D1_SCOPE_DENIED';END IF;
  REVOKE EXECUTE ON FUNCTION profitia_sg2_d1_source.read_case(text) FROM sg2_d1_source_denial_reader;
  REVOKE USAGE ON SCHEMA profitia_sg2_d1_source FROM sg2_d1_source_denial_reader;
  RESET ROLE;
  ALTER ROLE sg2_d1_source_denial_reader NOLOGIN;
 ELSE RAISE EXCEPTION 'D1_DATABASE_DENIED';END IF;
END $expire$;
COMMIT;
