-- PROPOSED product-store owner operation, after exact owner GO and migration002.
-- Binding/proof must equal the independently read-back central receiver. No
-- runtime env key, mirrored user directory or private-preference grant is added.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('ecr-stage03-activation',0));
SET LOCAL ROLE profitia_access_owner;
DO $receiver$
DECLARE b jsonb:=current_setting('ecr.stage03_binding',true)::jsonb;
 key_hex text:=current_setting('ecr.stage03_proof_key_hex',true);
 decision text:=current_setting('ecr.stage03_owner_ref',true);
BEGIN
 IF b->>'databaseName' IS DISTINCT FROM current_database() OR b->>'applicationId' IS DISTINCT FROM 'profitia-economic-calendar-runtime-development'
 OR b->>'environment' IS DISTINCT FROM 'development' OR b->>'projectId' IS DISTINCT FROM 'delicate-queen-44677134' OR b->>'branchId'='br-orange-salad-ba2llks7'
 OR b->>'role' IS DISTINCT FROM 'economic_calendar_development_runtime' OR coalesce(key_hex,'')!~'^[a-f0-9]{64}$' OR coalesce(decision,'')!~'^owner-decision:sha256:[a-f0-9]{64}$'
 OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment=b->>'environment' AND project_id=b->>'projectId' AND branch_id=b->>'branchId' AND database_name=current_database() AND schema_digest=b->>'schemaDigest') THEN RAISE EXCEPTION 'ACTUAL_PRODUCT_BINDING_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM profitia_e1_receiver.installation) THEN RAISE EXCEPTION 'RECEIVER_EXISTS_RECONCILE'; END IF;
 INSERT INTO profitia_e1_receiver.installation VALUES(true,'economic_calendar_development_runtime',b,'https://identity-runtime-development.onrender.com','economic-calendar','ecr-product-receiver-stage03-v1',decode(key_hex,'hex'),'ACTIVE',decision,'2026-12-04T22:19:09.000Z');
END $receiver$;
SET LOCAL ROLE economic_calendar_development_owner;
SELECT economic_calendar.set_storage_policy(0,'eia','source-hub-eia-official-publication-schedules-20261109',current_setting('ecr.stage03_owner_ref'),'ACTIVE');
SELECT economic_calendar.set_storage_policy(0,'commodities-sh','source-hub-commodity-commodities-sh-publication-calendar-20261106',current_setting('ecr.stage03_owner_ref'),'ACTIVE');
COMMIT;
