-- SG2 native receiver, NOT another forecast queue or computation authority.
-- Define once as the controlled source owner. Runtime fencing is a separate,
-- explicit call by the EXISTING table owner; this never transfers ownership.
-- No role, application, grant, installation receipt or live migration is seeded.
-- Prerequisite, applied by EACH existing read projection owner: grant this
-- NOLOGIN source owner SELECT on its installation metadata and an explicit
-- SELECT RLS policy TO profitia_ingestion_owner USING
-- (current_user='profitia_ingestion_owner'). This does not grant the source
-- login access to receipts or replace the separate read login in those receipts.
-- Missing metadata visibility fails closed in runtime_descriptor().
DO $owner$ BEGIN
  IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
    AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
    AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
    OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND database_name=current_database()
      AND schema_version='1.0.0' AND schema_digest='14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b')
    OR to_regclass('public.forecast_preparation_job') IS NULL OR to_regclass('public.forecast_action_trace') IS NULL THEN
    RAISE EXCEPTION 'Accepted source authority, original tables and controlled owner required' USING ERRCODE='42501';END IF;
END $owner$;
CREATE SCHEMA profitia_forecast_admission AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_forecast_admission FROM PUBLIC;
CREATE TABLE profitia_forecast_admission.installation(
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),
  source_schema_digest text NOT NULL CHECK(source_schema_digest='14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b'),
  market_schema_digest text NOT NULL CHECK(market_schema_digest='596885d43b911a5ee25dee53a8a9c42f23bf2662a68aef755194a9bbb6b64304'),
  forecast_schema_digest text NOT NULL CHECK(forecast_schema_digest='c5d3122371a7f038acf02f7f9f41fce0d34a2cb770e273e6cc78b2c73af31e90'),
  project_id text NOT NULL,branch_id text NOT NULL,database_name name NOT NULL,runtime_role name NOT NULL,
  queue_owner name NOT NULL,trace_owner name NOT NULL,source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE TABLE profitia_forecast_admission.deliveries(
  effect_id uuid PRIMARY KEY REFERENCES profitia_ingestion.effects(effect_id),resource_id text NOT NULL,
  command_digest text NOT NULL CHECK(command_digest~'^[a-f0-9]{64}$'),job_key text REFERENCES public.forecast_preparation_job("jobKey"),
  outcome text NOT NULL CHECK(outcome IN('READY','FAST_READY','QUEUED','PREPARING')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
DO $rls$ DECLARE t text;BEGIN
  FOREACH t IN ARRAY ARRAY['installation','deliveries'] LOOP
    EXECUTE format('ALTER TABLE profitia_forecast_admission.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_forecast_admission.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_forecast_admission.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
    EXECUTE format('CREATE POLICY native_metadata_read ON profitia_forecast_admission.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
    EXECUTE format('CREATE POLICY native_metadata_insert ON profitia_forecast_admission.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
    EXECUTE format('CREATE POLICY native_metadata_update ON profitia_forecast_admission.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user=''profitia_ingestion_owner'') WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
    EXECUTE format('CREATE POLICY native_metadata_delete ON profitia_forecast_admission.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
  END LOOP;
END $rls$;
CREATE FUNCTION profitia_forecast_admission.immutable_delivery() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Native source receipt is immutable' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER immutable_delivery BEFORE UPDATE OR DELETE ON profitia_forecast_admission.deliveries
  FOR EACH ROW EXECUTE FUNCTION profitia_forecast_admission.immutable_delivery();
CREATE TRIGGER immutable_delivery_truncate BEFORE TRUNCATE ON profitia_forecast_admission.deliveries
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_forecast_admission.immutable_delivery();
CREATE TRIGGER native_installation_authority BEFORE INSERT OR UPDATE OR DELETE ON profitia_forecast_admission.installation
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_ingestion.bump_revision();
CREATE TRIGGER native_installation_truncate BEFORE TRUNCATE ON profitia_forecast_admission.installation
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_ingestion.bump_revision();

CREATE FUNCTION profitia_forecast_admission.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE i profitia_forecast_admission.installation%ROWTYPE;d jsonb;fences boolean;
BEGIN
  d:=profitia_ingestion.runtime_descriptor();
  SELECT * INTO i FROM profitia_forecast_admission.installation WHERE singleton AND database_name=current_database() AND runtime_role=session_user;
  IF d IS NULL OR NOT FOUND OR i.expires_at<=clock_timestamp() OR i.project_id IS DISTINCT FROM d->>'projectId'
    OR i.branch_id IS DISTINCT FROM d->>'branchId' OR i.source_schema_digest IS DISTINCT FROM d->>'schemaDigest'
    OR d->>'applicationId'<>'spendguru-forecast-source' OR d->>'profileId'<>'PLATFORM_INTERNAL'
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolconnlimit=2)
    OR has_database_privilege(session_user,current_database(),'CREATE')
    OR has_schema_privilege(session_user,'public','CREATE') OR has_schema_privilege(session_user,'profitia_forecast_admission','CREATE')
    OR (SELECT count(*) FROM pg_roles WHERE rolname IN('profitia_market_read_owner','profitia_forecast_read_owner')
      AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
      AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))<>2
    OR (SELECT count(*) FROM pg_namespace WHERE (nspname='profitia_market_read' AND nspowner='profitia_market_read_owner'::regrole)
      OR (nspname='profitia_forecast_read' AND nspowner='profitia_forecast_read_owner'::regrole))<>2
    OR EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname NOT IN('pg_catalog','information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%' AND has_schema_privilege(session_user,n.oid,'CREATE'))
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
      AND c.relkind IN('r','p','v','m','f') AND (has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
      AND NOT(n.nspname='public' AND c.relname IN('forecast_preparation_job','forecast_action_trace'))
      AND NOT(n.nspname='profitia_market_read' AND c.relname IN('series','observations'))
      AND NOT(n.nspname='profitia_forecast_read' AND c.relname IN('rolling_daily_current_forecast_snapshots','forecast_current_runs',
        'forecast_current_points','forecast_verification_runs','forecast_verification_metrics','forecast_verification_points',
        'rolling_daily_verification_records','rolling_daily_maintenance_state','forecast_current_states','forecast_verification_states')))
    OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN('profitia_market_read','profitia_forecast_read') AND c.relkind IN('r','p','v','m','f')
      AND (has_table_privilege(session_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,SELECT WITH GRANT OPTION')
        OR has_any_column_privilege(session_user,c.oid,'INSERT,UPDATE,REFERENCES,SELECT WITH GRANT OPTION')))
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef
      AND n.nspname NOT IN('pg_catalog','information_schema') AND has_schema_privilege(session_user,n.oid,'USAGE')
      AND has_function_privilege(session_user,p.oid,'EXECUTE')
      AND NOT(n.nspname='profitia_ingestion' AND p.proname IN('runtime_descriptor','current_state','lock_ingestion','scope_allows','reserve','complete','receipt','append_audit'))
      AND NOT(n.nspname='profitia_forecast_admission' AND p.proname IN('runtime_descriptor','bind_effect','scope_allows','record_delivery')))
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN('profitia_ingestion','profitia_forecast_admission','profitia_market_read','profitia_forecast_read')
      AND has_function_privilege(session_user,p.oid,'EXECUTE WITH GRANT OPTION'))
    OR NOT EXISTS(SELECT 1 FROM profitia_market_read.installation WHERE singleton AND database_name=current_database()
      AND project_id=i.project_id AND branch_id=i.branch_id AND schema_digest=i.market_schema_digest)
    OR NOT EXISTS(SELECT 1 FROM profitia_forecast_read.installation WHERE singleton AND database_name=current_database()
      AND project_id=i.project_id AND branch_id=i.branch_id AND schema_version='3.0.1' AND schema_digest=i.forecast_schema_digest
      AND market_schema_digest=i.market_schema_digest)
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_forecast_admission'
      AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner='profitia_ingestion_owner'::regrole)<>2 THEN RETURN NULL;END IF;
  SELECT count(*)=2 INTO fences FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN('forecast_preparation_job','forecast_action_trace') AND c.relrowsecurity AND c.relforcerowsecurity
      AND c.relowner=CASE WHEN c.relname='forecast_preparation_job' THEN i.queue_owner::regrole ELSE i.trace_owner::regrole END
      AND EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='profitia_native_source_fence' AND NOT p.polpermissive
        AND (SELECT oid FROM pg_roles WHERE rolname=i.runtime_role)=ANY(p.polroles))
      AND NOT has_table_privilege(session_user,c.oid,'DELETE,TRUNCATE,REFERENCES,TRIGGER,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION')
      AND NOT has_any_column_privilege(session_user,c.oid,'REFERENCES,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION');
  RETURN jsonb_build_object('schemaVersion',i.schema_version,'boundaryDigest',i.boundary_digest,'sourceSchemaDigest',i.source_schema_digest,
    'projectId',i.project_id,'branchId',i.branch_id,'databaseName',i.database_name,'role',session_user,
    'sourceId','sg2.forecast.queue','payloadSchema','sg2-forecast-command-v1','qualityVersion','stored-forecast-authority-v1',
    'classificationVersion','shared-market-command-v1','fencesInstalled',fences,'expiresAt',i.expires_at);
END $fn$;

CREATE FUNCTION profitia_forecast_admission.bind_effect(p_effect uuid,p_decision uuid,p_payload text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;e profitia_ingestion.effects%ROWTYPE;
BEGIN
  d:=profitia_forecast_admission.runtime_descriptor();
  IF d IS NULL OR d->>'fencesInstalled'<>'true' THEN RETURN false;END IF;
  SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p_effect AND status='RESERVED' AND decision_id=p_decision AND payload_digest=p_payload;
  IF NOT FOUND OR e.source_id<>'sg2.forecast.queue' OR e.application_id<>'spendguru-forecast-source'
    OR e.service_id::text IS DISTINCT FROM profitia_ingestion.runtime_descriptor()->>'serviceId'
    OR profitia_ingestion.scope_allows(e.source_id,e.resource_id) IS NOT TRUE THEN RETURN false;END IF;
  PERFORM set_config('profitia.forecast.source_effect',jsonb_build_array(e.effect_id,e.decision_id,e.payload_digest,txid_current()::text)::text,true);
  RETURN true;
END $fn$;
CREATE FUNCTION profitia_forecast_admission.scope_allows(p_series text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;m jsonb;e profitia_ingestion.effects%ROWTYPE;
BEGIN
  d:=profitia_forecast_admission.runtime_descriptor();m:=nullif(current_setting('profitia.forecast.source_effect',true),'')::jsonb;
  IF d IS NULL OR d->>'fencesInstalled'<>'true' OR m->>3 IS DISTINCT FROM txid_current()::text THEN RETURN false;END IF;
  SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=(m->>0)::uuid AND decision_id=(m->>1)::uuid AND payload_digest=m->>2 AND status='RESERVED';
  RETURN coalesce(FOUND AND e.source_id='sg2.forecast.queue' AND e.resource_id=p_series AND e.application_id='spendguru-forecast-source'
    AND e.service_id::text=profitia_ingestion.runtime_descriptor()->>'serviceId'
    AND profitia_ingestion.scope_allows(e.source_id,p_series),false);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $fn$;

CREATE FUNCTION profitia_forecast_admission.record_delivery(p_effect uuid,p_decision uuid,p_command text,p_job text,p_outcome text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e profitia_ingestion.effects%ROWTYPE;c jsonb;canonical_command text;envelope text;
BEGIN
  c:=p_command::jsonb;
  IF jsonb_typeof(c) IS DISTINCT FROM 'object' THEN RETURN false;END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(c))<>4 OR EXISTS(SELECT 1 FROM jsonb_each(c) v
      WHERE v.key NOT IN('kind','modelId','seriesId','targetSemantics') OR jsonb_typeof(v.value) IS DISTINCT FROM 'string' OR length(v.value#>>'{}') NOT BETWEEN 1 AND 256)
    OR c->>'kind' NOT IN('CURRENT','VERIFICATION') OR c->>'modelId' NOT IN('naive','damped_holt','ets','arima')
    OR c->>'targetSemantics' NOT IN('MONTHLY_AVERAGE','END_OF_PERIOD','ROLLING_DAILY_POINT_IN_TIME')
    OR p_outcome NOT IN('READY','FAST_READY','QUEUED','PREPARING') THEN RETURN false;END IF;
  canonical_command:='{"kind":'||to_json(c->>'kind')::text||',"modelId":'||to_json(c->>'modelId')::text
    ||',"seriesId":'||to_json(c->>'seriesId')::text||',"targetSemantics":'||to_json(c->>'targetSemantics')::text||'}';
  IF canonical_command IS DISTINCT FROM p_command THEN RETURN false;END IF;
  envelope:='{"content":'||p_command||',"sourceId":"sg2.forecast.queue"}';
  SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p_effect AND decision_id=p_decision AND status='RESERVED'
    AND payload_digest=encode(sha256(convert_to(envelope,'UTF8')),'hex');
  IF NOT FOUND OR profitia_forecast_admission.scope_allows(c->>'seriesId') IS NOT TRUE
    OR e.resource_id IS DISTINCT FROM c->>'seriesId' OR (p_job IS NULL AND p_outcome<>'READY')
    OR (p_job IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.forecast_preparation_job j WHERE j."jobKey"=p_job
      AND j."seriesId"=c->>'seriesId' AND j."modelId"=c->>'modelId' AND j."targetSemantics"=c->>'targetSemantics'
      AND j."jobKind"=c->>'kind')) THEN RETURN false;END IF;
  INSERT INTO profitia_forecast_admission.deliveries(effect_id,resource_id,command_digest,job_key,outcome)
    VALUES(p_effect,e.resource_id,encode(sha256(convert_to(p_command,'UTF8')),'hex'),p_job,p_outcome);
  RETURN true;
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $fn$;
CREATE FUNCTION profitia_forecast_admission.expected_runtime_role() RETURNS name
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
  SELECT i.runtime_role FROM profitia_forecast_admission.installation i
    JOIN profitia_ingestion.runtime_bindings b ON b.login_role=i.runtime_role
    JOIN pg_roles r ON r.rolname=i.runtime_role
  WHERE i.singleton AND i.database_name=current_database() AND i.expires_at>clock_timestamp()
    AND b.application_id='spendguru-forecast-source' AND b.profile_id='PLATFORM_INTERNAL'
    AND b.status='ACTIVE' AND b.expires_at>clock_timestamp() AND r.rolcanlogin AND r.rolconnlimit=2
    AND NOT(r.rolsuper OR r.rolbypassrls OR r.rolinherit OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
    AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
$fn$;
CREATE FUNCTION profitia_forecast_admission.prevent_runtime_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
  IF session_user::regrole::oid::text=TG_ARGV[0] THEN
    RAISE EXCEPTION 'Native source runtime cannot truncate scientific state' USING ERRCODE='42501';END IF;
  RETURN NULL;
END $fn$;

-- Invocation requires the ORIGINAL table owner, not runtime authority. Its
-- per-role restrictive fence preserves every existing role/owner/ACL behavior.
-- Unexpected existing RLS/policies are refused before the first ALTER.
CREATE FUNCTION profitia_forecast_admission.install_runtime_fences() RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE runtime_role name;runtime_oid oid;t text;
BEGIN
  runtime_role:=profitia_forecast_admission.expected_runtime_role();
  SELECT oid INTO runtime_oid FROM pg_roles WHERE rolname=runtime_role;
  IF runtime_role IS NULL OR runtime_oid IS NULL OR current_user=runtime_role
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN('forecast_preparation_job','forecast_action_trace')
        AND c.relkind='r' AND c.relowner=current_user::regrole AND NOT c.relrowsecurity AND NOT c.relforcerowsecurity
        AND NOT EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid))<>2 THEN
    RAISE EXCEPTION 'Original clean table owner and accepted ordinary runtime required' USING ERRCODE='42501';END IF;
  FOREACH t IN ARRAY ARRAY['forecast_preparation_job','forecast_action_trace'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
    -- This admits no new SQL privileges. Before this controlled installation,
    -- existing grantees already had the same unrestricted shared table access.
    EXECUTE format('CREATE POLICY profitia_existing_shared_access ON public.%I FOR ALL TO PUBLIC USING(true) WITH CHECK(true)',t);
    EXECUTE format('CREATE POLICY profitia_native_source_fence ON public.%I AS RESTRICTIVE FOR ALL TO %I USING(profitia_forecast_admission.scope_allows("seriesId")) WITH CHECK(profitia_forecast_admission.scope_allows("seriesId"))',t,runtime_role);
    EXECUTE format('CREATE POLICY profitia_native_delete_fence ON public.%I AS RESTRICTIVE FOR DELETE TO %I USING(false)',t,runtime_role);
    EXECUTE format('CREATE TRIGGER profitia_native_truncate_fence BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_forecast_admission.prevent_runtime_truncate(%L)',t,runtime_oid::text);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO %I',t,runtime_role);
    EXECUTE format('REVOKE DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.%I FROM %I',t,runtime_role);
  END LOOP;
  RETURN true;
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_forecast_admission FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_forecast_admission FROM PUBLIC;

-- Existing table owners already control these shared tables. Give ONLY them
-- the explicit invoker installer and its scalar helper, never the runtime.
DO $installer_acl$ DECLARE legacy_owner name;BEGIN
  FOR legacy_owner IN SELECT DISTINCT r.rolname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='public' AND c.relname IN('forecast_preparation_job','forecast_action_trace') LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA profitia_forecast_admission TO %I',legacy_owner);
    EXECUTE format('GRANT EXECUTE ON FUNCTION profitia_forecast_admission.expected_runtime_role(),profitia_forecast_admission.prevent_runtime_truncate(),profitia_forecast_admission.install_runtime_fences() TO %I',legacy_owner);
  END LOOP;
END $installer_acl$;
