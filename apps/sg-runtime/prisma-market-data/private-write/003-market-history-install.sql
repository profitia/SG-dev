-- REVIEWED OPERATOR ENTRY ONLY. Not called by runtime or startup.
-- Run with psql --single-transaction, as the dedicated controlled migrator,
-- against the approved direct Development endpoint. All credentials stay outside SQL.
-- Required bootstrap (separate owner approval): migrator can create the one
-- ordinary runtime role and SET ROLE profitia_ingestion_owner. The controlled
-- NOLOGIN owner already has approved SELECT/INSERT/UPDATE on the three market tables.
-- The migrator receives no market-table rights/grant options. No application admin grant.
\set ON_ERROR_STOP on
\if :{?project_id}
\else
\set project_id autumn-waterfall-65938876
\endif
\if :{?branch_id}
\else
\set branch_id br-dry-hall-b294222f
\endif
\if :{?database_name}
\else
\set database_name neondb
\endif
-- Other required variables: source_sha, boundary_digest, unmetered_digest,
-- source_digest, external_digest, native_digest, approval_digest, valid_until.
SELECT set_config('profitia.market_history.project',:'project_id',true),set_config('profitia.market_history.branch',:'branch_id',true),
 set_config('profitia.market_history.database',:'database_name',true),set_config('profitia.market_history.source_schema',:'source_digest',true),set_config('profitia.market_history.external_schema',:'external_digest',true),set_config('profitia.market_history.native_schema',:'native_digest',true),set_config('profitia.market_history.source',:'source_sha',true),
 set_config('profitia.market_history.boundary',:'boundary_digest',true),set_config('profitia.market_history.approval',:'approval_digest',true),
 set_config('profitia.market_history.valid_until',:'valid_until',true),set_config('profitia.install.unmetered_digest',:'unmetered_digest',true);
DO $guard$ BEGIN
 IF session_user<>'sg2_market_history_development_migrator' OR current_user<>session_user
  OR current_database()<>current_setting('profitia.market_history.database')
  OR current_setting('profitia.market_history.source')!~'^[a-f0-9]{40}$'
  OR current_setting('profitia.market_history.boundary')!~'^[a-f0-9]{64}$'
  OR current_setting('profitia.market_history.approval')!~'^[a-f0-9]{64}$'
  OR current_setting('profitia.market_history.valid_until')::timestamptz<=clock_timestamp()
  OR current_setting('profitia.market_history.valid_until')::timestamptz>clock_timestamp()+interval '366 days'
 THEN RAISE EXCEPTION 'Explicit exact-source Development installation approval required' USING ERRCODE='42501';END IF;
END $guard$;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL ROLE profitia_ingestion_owner;
DO $binding$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND environment='development'
  AND project_id=current_setting('profitia.market_history.project') AND branch_id=current_setting('profitia.market_history.branch')
  AND database_name=current_database() AND schema_digest='14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b')
 OR NOT EXISTS(SELECT 1 FROM profitia_external_call.installation WHERE singleton AND schema_digest=current_setting('profitia.market_history.external_schema') AND source_schema_digest=current_setting('profitia.market_history.source_schema'))
  OR NOT EXISTS(SELECT 1 FROM profitia_external_native.installation WHERE singleton AND schema_digest=current_setting('profitia.market_history.native_schema'))
 THEN RAISE EXCEPTION 'Exact existing Development Source installation required' USING ERRCODE='42501';END IF;
END $binding$;
SELECT to_regnamespace('profitia_market_history') IS NOT NULL AS already_installed \gset
\if :already_installed
DO $replay$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM profitia_market_history.installation WHERE singleton
  AND boundary_digest=current_setting('profitia.market_history.boundary') AND project_id=current_setting('profitia.market_history.project')
  AND branch_id=current_setting('profitia.market_history.branch') AND database_name=current_database()
  AND runtime_role='sg2_market_history_development_runtime' AND source_ref=current_setting('profitia.market_history.source')
  AND approval_digest=current_setting('profitia.market_history.approval') AND expires_at=current_setting('profitia.market_history.valid_until')::timestamptz)
 THEN RAISE EXCEPTION 'Conflicting existing market-history installation';END IF;
END $replay$;
\echo Exact installed boundary already present; no policies or counters rewritten.
\quit
\endif
-- Save and restore all pre-existing status values inside the same transaction.
-- Source lock/lease revalidation can reject an in-flight request; schedule the
-- approved maintenance window. A lock conflict aborts the complete transaction.
SELECT EXISTS(SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='profitia_ingestion' AND c.relname='budgets' AND a.attname='quota_mode' AND NOT a.attisdropped) AS unmetered_present \gset
\if :unmetered_present
DO $digest$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND unmetered_schema_digest=current_setting('profitia.install.unmetered_digest'))
 THEN RAISE EXCEPTION 'Different UNMETERED Source installation';END IF;
END $digest$;
\else
CREATE TEMP TABLE market_history_prior_bindings ON COMMIT DROP AS SELECT login_role,status FROM profitia_ingestion.runtime_bindings;
CREATE TEMP TABLE market_history_prior_budgets ON COMMIT DROP AS SELECT policy_id,to_jsonb(b) AS document FROM profitia_ingestion.budgets b;
CREATE TEMP TABLE market_history_prior_external ON COMMIT DROP AS SELECT policy_id,to_jsonb(p) AS document FROM profitia_external_call.policies p;
UPDATE profitia_ingestion.runtime_bindings SET status='REVOKED' WHERE status='ACTIVE';
\ir ../../../../packages/platform-contracts/migrations/access/024-unmetered-public-sources.sql
UPDATE profitia_ingestion.runtime_bindings b SET status=p.status FROM market_history_prior_bindings p WHERE b.login_role=p.login_role AND b.status<>p.status;
DO $preserve$ BEGIN
 IF EXISTS(SELECT 1 FROM market_history_prior_budgets p LEFT JOIN profitia_ingestion.budgets b USING(policy_id) WHERE p.document IS DISTINCT FROM (to_jsonb(b)-'quota_mode') OR b.quota_mode<>'METERED')
  OR EXISTS(SELECT 1 FROM market_history_prior_external p LEFT JOIN profitia_external_call.policies b USING(policy_id) WHERE p.document IS DISTINCT FROM (to_jsonb(b)-'quota_mode') OR b.quota_mode<>'METERED')
 THEN RAISE EXCEPTION 'Existing capacities, counters and paid policies must remain intact';END IF;
END $preserve$;
\endif
RESET ROLE;
DO $role$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sg2_market_history_development_runtime') THEN RAISE EXCEPTION 'Unexpected pre-existing writer role';END IF;
END $role$;
CREATE ROLE sg2_market_history_development_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 2;
-- No password is committed. Provision the new DB credential only through the
-- approved secret store after installation; reuse the existing Macrobond OAuth credentials.
SELECT has_database_privilege('profitia_ingestion_owner',current_database(),'CREATE') AS owner_already_can_create \gset
\if :owner_already_can_create
\else
DO $create_schema$ BEGIN EXECUTE format('GRANT CREATE ON DATABASE %I TO profitia_ingestion_owner',current_database());END $create_schema$;
\endif
SET LOCAL ROLE profitia_ingestion_owner;
\ir 003-market-history.sql
INSERT INTO profitia_market_history.installation
 SELECT true,'1.0.0',current_setting('profitia.market_history.boundary'),current_setting('profitia.market_history.project'),current_setting('profitia.market_history.branch'),current_database(),
 'sg2_market_history_development_runtime',jsonb_object_agg(c.relname,pg_get_userbyid(c.relowner)),current_setting('profitia.market_history.source'),current_setting('profitia.market_history.approval'),current_setting('profitia.market_history.valid_until')::timestamptz
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('market_series','market_observations','market_hydration_state');
INSERT INTO profitia_ingestion.runtime_bindings(login_role,binding_id,service_id,application_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at)
 VALUES('sg2_market_history_development_runtime',gen_random_uuid(),gen_random_uuid(),'spendguru-market-history','PLATFORM_INTERNAL',
 'srv-dapa3tid0e5s73f8bc5g:'||current_setting('profitia.market_history.source'),'sg2-market-history-dev-v1','ACTIVE',current_setting('profitia.market_history.source'),current_setting('profitia.market_history.valid_until')::timestamptz);
INSERT INTO profitia_ingestion.sources(source_id,effect_kind,data_class,payload_schema,quality_version,classification_version,projection_version,status,source_ref,expires_at)
 SELECT id,'STORED_SQL_TRANSACTION','SHARED_KNOWLEDGE',payload,quality,classification,'source-receipt-v1','ACTIVE',current_setting('profitia.market_history.source'),current_setting('profitia.market_history.valid_until')::timestamptz
 FROM(VALUES('sg2.market.history.token','external-call-control-v1','sg2-source-control-v1','technical-source-control-v1'),('sg2.market.history.api','external-call-control-v1','sg2-source-control-v1','technical-source-control-v1'),('sg2.market.history.persist','sg2-market-history-v1','validated-market-history-v1','shared-market-history-v1'))s(id,payload,quality,classification);
INSERT INTO profitia_ingestion.grants(grant_id,login_role,source_id,effect,status,source_ref,expires_at)
 SELECT gen_random_uuid(),'sg2_market_history_development_runtime',id,'ALLOW','ACTIVE',current_setting('profitia.market_history.source'),current_setting('profitia.market_history.valid_until')::timestamptz FROM unnest(ARRAY['sg2.market.history.token','sg2.market.history.api','sg2.market.history.persist'])id;
INSERT INTO profitia_ingestion.budgets(policy_id,application_id,source_id,unit,quota_mode,status,source_ref)
 SELECT gen_random_uuid(),'spendguru-market-history',id,'SOURCE_TRANSACTION','UNMETERED','ACTIVE',current_setting('profitia.market_history.source') FROM unnest(ARRAY['sg2.market.history.token','sg2.market.history.api','sg2.market.history.persist'])id;
INSERT INTO profitia_external_call.policies(policy_id,login_role,source_id,resource_id,configuration_version,origin,transport,path_rules,maximum_request_bytes,maximum_response_bytes,timeout_ms,unit,quota_mode,status,source_ref)
 SELECT gen_random_uuid(),'sg2_market_history_development_runtime',source,resource,'sg2-market-history-http-dev-v1',origin,'HTTPS',paths,65536,8388608,20000,'UPSTREAM_ATTEMPT_ADMISSION','UNMETERED','ACTIVE',current_setting('profitia.market_history.source')
 FROM(VALUES('sg2.market.history.token','sg2-market-history:token','https://apiauth.macrobondfinancial.com','[{"method":"POST","path":"/mbauth/connect/token"}]'::jsonb),
 ('sg2.market.history.api','sg2-market-history:api','https://api.macrobondfinancial.com','[{"method":"POST","path":"/v1/series/fetchseries"},{"method":"POST","path":"/v1/series/fetchentities"}]'::jsonb))p(source,resource,origin,paths);
INSERT INTO profitia_external_native.policies(policy_id,base_policy_version,path_rules,redirect_origins,maximum_response_bytes,credential_mode,completion_mode,status,expires_at,source_ref)
 SELECT policy_id,version,CASE WHEN source_id='sg2.market.history.token' THEN '[{"method":"POST","path":"/mbauth/connect/token","requestFormat":"FORM"}]'::jsonb ELSE '[{"method":"POST","path":"/v1/series/fetchseries","requestFormat":"JSON"},{"method":"POST","path":"/v1/series/fetchentities","requestFormat":"JSON"}]'::jsonb END,
 '[]'::jsonb,8388608,CASE WHEN source_id='sg2.market.history.token' THEN 'NONE' ELSE 'SERVER_HEADERS' END,'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT','ACTIVE',current_setting('profitia.market_history.valid_until')::timestamptz,current_setting('profitia.market_history.source')
 FROM profitia_external_call.policies WHERE login_role='sg2_market_history_development_runtime';
GRANT USAGE ON SCHEMA profitia_ingestion,profitia_external_call,profitia_external_native,profitia_market_history TO sg2_market_history_development_runtime;
GRANT EXECUTE ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),profitia_ingestion.lock_ingestion(text,text,text),profitia_ingestion.scope_allows(text,text),profitia_ingestion.reserve(text,text,text,text,uuid),profitia_ingestion.complete(uuid,uuid),profitia_ingestion.receipt(text,text,text,text),profitia_ingestion.append_audit(jsonb),profitia_external_call.descriptor(text,text),profitia_external_call.apply_control(uuid,uuid,text),profitia_external_call.read_status(uuid,text,text),profitia_external_native.descriptor(text,text),profitia_external_native.permits_status(uuid,integer),profitia_market_history.runtime_descriptor(),profitia_market_history.apply_history(uuid,uuid,text),profitia_market_history.read_receipt(text,text),profitia_market_history.due_series(text,timestamptz,integer) TO sg2_market_history_development_runtime;
-- No SELECT, INSERT, UPDATE, DELETE, ownership, RLS bypass or role membership
-- is granted on any canonical table to the runtime login.

RESET ROLE;
\if :owner_already_can_create
\else
DO $remove_temporary_schema_privilege$ BEGIN EXECUTE format('REVOKE CREATE ON DATABASE %I FROM profitia_ingestion_owner',current_database());END $remove_temporary_schema_privilege$;
\endif
