-- Opt-in native scientific worker boundary. No role, grant, installation,
-- capacity, service binding or live activation is seeded by this migration.
-- SOURCE_TRANSACTION measures committed SQL (including a start admission),
-- never CPU time or supplier charges. Long computation runs OUTSIDE SQL.
DO $owner$ BEGIN
  IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
    AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
    AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
    OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND database_name=current_database()
      AND schema_digest='14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b')
    OR to_regclass('profitia_forecast_admission.deliveries') IS NULL THEN
    RAISE EXCEPTION 'Accepted source authority and original native queue required' USING ERRCODE='42501';END IF;
END $owner$;
CREATE SCHEMA profitia_forecast_worker AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_forecast_worker FROM PUBLIC;
CREATE TABLE profitia_forecast_worker.installation(
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),project_id text NOT NULL,branch_id text NOT NULL,
  database_name name NOT NULL,runtime_role name PRIMARY KEY,job_kind text NOT NULL UNIQUE CHECK(job_kind IN('CURRENT','VERIFICATION')),original_owner name NOT NULL,source_ref text NOT NULL,
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE TABLE profitia_forecast_worker.starts(
  job_id text NOT NULL REFERENCES public.forecast_preparation_job(id),lease_version integer NOT NULL CHECK(lease_version>0),
  owner_token text NOT NULL,effect_id uuid NOT NULL UNIQUE REFERENCES profitia_ingestion.effects(effect_id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(job_id,lease_version)
);
CREATE TABLE profitia_forecast_worker.children(
  job_key text PRIMARY KEY REFERENCES public.forecast_preparation_job("jobKey"),
  parent_id text NOT NULL,parent_lease_version integer NOT NULL,effect_id uuid NOT NULL REFERENCES profitia_ingestion.effects(effect_id),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(parent_id,parent_lease_version) REFERENCES profitia_forecast_worker.starts(job_id,lease_version)
);
DO $rls$ DECLARE t text;BEGIN
  FOREACH t IN ARRAY ARRAY['installation','starts','children'] LOOP
    EXECUTE format('ALTER TABLE profitia_forecast_worker.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_forecast_worker.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_forecast_worker.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
    EXECUTE format('CREATE POLICY worker_metadata_owner ON profitia_forecast_worker.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_ingestion_owner'') WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  END LOOP;
END $rls$;
CREATE FUNCTION profitia_forecast_worker.immutable_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Scientific worker receipt is immutable' USING ERRCODE='42501';END $fn$;
DO $immutable$ DECLARE t text;BEGIN
  FOREACH t IN ARRAY ARRAY['starts','children'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_receipt BEFORE UPDATE OR DELETE ON profitia_forecast_worker.%I FOR EACH ROW EXECUTE FUNCTION profitia_forecast_worker.immutable_receipt()',t);
    EXECUTE format('CREATE TRIGGER immutable_receipt_truncate BEFORE TRUNCATE ON profitia_forecast_worker.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_forecast_worker.immutable_receipt()',t);
  END LOOP;
END $immutable$;
CREATE TRIGGER worker_installation_change BEFORE INSERT OR UPDATE OR DELETE ON profitia_forecast_worker.installation
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_ingestion.bump_revision();
CREATE TRIGGER worker_installation_truncate BEFORE TRUNCATE ON profitia_forecast_worker.installation
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_ingestion.bump_revision();

CREATE FUNCTION profitia_forecast_worker.tables() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT ARRAY['forecast_preparation_job','forecast_action_trace','forecast_preparation_execution_ledger',
 'forecast_current_runs','forecast_current_points','forecast_verification_runs','forecast_verification_metrics','forecast_verification_points',
 'rolling_daily_verification_records','rolling_daily_calibration_groups','rolling_daily_maintenance_state','rolling_daily_current_forecast_snapshots']::text[]
$fn$;
CREATE FUNCTION profitia_forecast_worker.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $fn$
DECLARE i profitia_forecast_worker.installation%ROWTYPE;d jsonb;fenced boolean;
BEGIN
 d:=profitia_ingestion.runtime_descriptor();
 SELECT * INTO i FROM profitia_forecast_worker.installation WHERE database_name=current_database() AND runtime_role=session_user;
 IF d IS NULL OR NOT FOUND OR i.expires_at<=clock_timestamp() OR i.project_id IS DISTINCT FROM d->>'projectId'
   OR i.branch_id IS DISTINCT FROM d->>'branchId' OR d->>'applicationId'<>'spendguru-forecast-worker'
   OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolconnlimit=CASE WHEN i.job_kind='VERIFICATION' THEN 4 ELSE 2 END)
   OR has_database_privilege(session_user,current_database(),'CREATE')
   OR (SELECT count(*) FROM pg_roles WHERE rolname IN('profitia_market_read_owner','profitia_forecast_read_owner')
     AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
     AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))<>2
   OR (SELECT count(*) FROM pg_namespace WHERE (nspname='profitia_market_read' AND nspowner='profitia_market_read_owner'::regrole)
     OR (nspname='profitia_forecast_read' AND nspowner='profitia_forecast_read_owner'::regrole))<>2
   OR NOT EXISTS(SELECT 1 FROM profitia_market_read.installation WHERE singleton AND database_name=current_database()
     AND project_id=i.project_id AND branch_id=i.branch_id AND schema_digest='596885d43b911a5ee25dee53a8a9c42f23bf2662a68aef755194a9bbb6b64304')
   OR NOT EXISTS(SELECT 1 FROM profitia_forecast_read.installation WHERE singleton AND database_name=current_database()
     AND project_id=i.project_id AND branch_id=i.branch_id AND schema_version='3.0.2'
     AND schema_digest='98d771788def50d39c305e466696ab5da6ab8a3c604bc0b27889a98fef4fae38')
   OR EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname NOT IN('pg_catalog','information_schema')
     AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%' AND has_schema_privilege(session_user,n.oid,'CREATE'))
   OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
     AND c.relkind IN('r','p','v','m','f') AND (has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
     AND NOT(n.nspname='public' AND c.relname=ANY(profitia_forecast_worker.tables()))
     AND NOT(n.nspname='profitia_market_read' AND c.relname IN('series','observations'))
     AND NOT(n.nspname='profitia_forecast_read' AND c.relname IN('rolling_daily_current_forecast_snapshots','forecast_current_runs',
       'forecast_current_points','forecast_verification_runs','forecast_verification_metrics','forecast_verification_points',
       'rolling_daily_verification_records','rolling_daily_maintenance_state','forecast_current_states','forecast_verification_states')))
   OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname IN('public','profitia_market_read','profitia_forecast_read') AND c.relkind IN('r','p','v','m','f')
       AND (has_table_privilege(session_user,c.oid,'TRUNCATE,REFERENCES,TRIGGER,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION,DELETE WITH GRANT OPTION')
         OR has_any_column_privilege(session_user,c.oid,'REFERENCES,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION')))
   OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname IN('profitia_market_read','profitia_forecast_read') AND c.relkind IN('r','p','v','m','f')
       AND (has_table_privilege(session_user,c.oid,'INSERT,UPDATE,DELETE') OR has_any_column_privilege(session_user,c.oid,'INSERT,UPDATE')))
   OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef
     AND n.nspname NOT IN('pg_catalog','information_schema') AND has_schema_privilege(session_user,n.oid,'USAGE')
     AND has_function_privilege(session_user,p.oid,'EXECUTE')
     AND NOT(n.nspname='profitia_ingestion' AND p.proname IN('runtime_descriptor','current_state','lock_ingestion','scope_allows','reserve','complete','receipt','append_audit'))
     AND NOT(n.nspname='profitia_forecast_worker' AND p.proname IN('runtime_descriptor','peek','bind_effect','scope_allows','record_start','record_child')))
   OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname IN('profitia_ingestion','profitia_forecast_worker','profitia_market_read','profitia_forecast_read')
       AND has_function_privilege(session_user,p.oid,'EXECUTE WITH GRANT OPTION'))
   OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_forecast_worker'
     AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner='profitia_ingestion_owner'::regrole)<>3 THEN RETURN NULL;END IF;
 SELECT count(*)=12 INTO fenced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname=ANY(profitia_forecast_worker.tables()) AND c.relkind='r'
     AND c.relowner=i.original_owner::regrole AND c.relrowsecurity AND c.relforcerowsecurity
     AND EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='profitia_worker_fence' AND NOT p.polpermissive
       AND (SELECT oid FROM pg_roles WHERE rolname=i.runtime_role)=ANY(p.polroles));
 RETURN jsonb_build_object('schemaVersion',i.schema_version,'boundaryDigest',i.boundary_digest,'projectId',i.project_id,'branchId',i.branch_id,
   'databaseName',i.database_name,'role',session_user,'jobKind',i.job_kind,'fencesInstalled',fenced,'expiresAt',i.expires_at);
END $fn$;
-- Original Verification can create its Current prerequisite in the SAME
-- admitted source transaction. Follow only that exact original dependency;
-- a guessed legacy job key or a scientific row is not an admission receipt.
CREATE FUNCTION profitia_forecast_worker.native_admission(p_job text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT EXISTS(SELECT 1 FROM public.forecast_preparation_job j
   WHERE j.id=p_job AND (
     EXISTS(SELECT 1 FROM profitia_forecast_admission.deliveries r JOIN profitia_ingestion.effects e USING(effect_id)
       JOIN public.forecast_preparation_job v ON v."jobKey"=r.job_key
       WHERE e.status='COMMITTED' AND e.source_id='sg2.forecast.queue' AND e.application_id='spendguru-forecast-source'
         AND e.resource_id=j."seriesId" AND (r.job_key=j."jobKey"
           OR j."jobKind"='CURRENT' AND v."jobKind"='VERIFICATION' AND v."dependencyJobKey"=j."jobKey"
           AND v."seriesId"=j."seriesId" AND v."modelId"=j."modelId" AND v."targetSemantics"=j."targetSemantics"
           AND v."sourceFrequency"=j."sourceFrequency" AND v."targetCadence"=j."targetCadence"))
     OR EXISTS(SELECT 1 FROM profitia_forecast_worker.children r JOIN profitia_ingestion.effects e USING(effect_id)
       WHERE r.job_key=j."jobKey" AND e.status='COMMITTED' AND e.source_id='sg2.forecast.worker'
         AND e.application_id='spendguru-forecast-worker' AND e.resource_id=j."seriesId")))
$fn$;
-- Metadata discovery is read-only. It exposes only a funded original native
-- command or its explicitly recorded calibration child, under CURRENT grants.
CREATE FUNCTION profitia_forecast_worker.peek(p_kinds text[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $fn$
DECLARE j public.forecast_preparation_job%ROWTYPE;d jsonb;s jsonb;
BEGIN
 d:=profitia_forecast_worker.runtime_descriptor();IF d IS NULL OR d->>'fencesInstalled'<>'true' OR p_kinds IS DISTINCT FROM ARRAY[d->>'jobKind'] THEN RETURN NULL;END IF;
 FOR j IN SELECT * FROM public.forecast_preparation_job q
   WHERE q."jobKind"=ANY(p_kinds) AND q."availableAt"<=clock_timestamp()
     AND (q.status IN('QUEUED','RETRY_WAIT') OR q.status='RUNNING' AND q."leaseExpiresAt"<clock_timestamp())
     AND profitia_forecast_worker.native_admission(q.id)
   ORDER BY q.priority,q."availableAt",q."requestedAt" LIMIT 100 LOOP
   s:=profitia_ingestion.current_state('sg2.forecast.worker',j."seriesId");
   IF s IS NOT NULL AND (s->'ingestion'->>'used')::integer<(s->'ingestion'->>'capacity')::integer THEN
     RETURN jsonb_build_object('jobId',j.id,'seriesId',j."seriesId",'modelId',j."modelId",'targetSemantics',j."targetSemantics",
       'jobKind',j."jobKind",'leaseVersion',j."leaseVersion",'queueVersion',j."updatedAt"::text||':'||j.status);END IF;
 END LOOP;RETURN NULL;
END $fn$;
CREATE FUNCTION profitia_forecast_worker.bind_effect(p_effect uuid,p_decision uuid,p_payload text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $fn$
DECLARE d jsonb;c jsonb;e profitia_ingestion.effects%ROWTYPE;j public.forecast_preparation_job%ROWTYPE;envelope text;
BEGIN
 d:=profitia_forecast_worker.runtime_descriptor();c:=p_payload::jsonb;
 IF d IS NULL OR d->>'fencesInstalled'<>'true' OR jsonb_typeof(c) IS DISTINCT FROM 'object'
   OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(c) key) IS DISTINCT FROM
     ARRAY['argumentsDigest','jobId','jobKind','leaseOwnerToken','leaseVersion','modelId','phase','queueVersion','seriesId','step','targetSemantics']::text[]
   OR c->>'phase' NOT IN('CLAIM','STEP') OR c->>'argumentsDigest' !~ '^[a-f0-9]{64}$'
   OR c->>'step' NOT IN('CLAIM','QUEUE','QUEUE_CHILD','READ','ARTIFACT','ADMISSION','LEDGER','TELEMETRY') THEN RETURN false;END IF;
 envelope:='{"content":'||p_payload||',"sourceId":"sg2.forecast.worker"}';
 SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p_effect AND decision_id=p_decision AND status='RESERVED'
   AND payload_digest=encode(sha256(convert_to(envelope,'UTF8')),'hex');
 IF NOT FOUND OR e.source_id<>'sg2.forecast.worker' OR e.application_id<>'spendguru-forecast-worker'
   OR e.resource_id IS DISTINCT FROM c->>'seriesId' OR e.service_id::text IS DISTINCT FROM profitia_ingestion.runtime_descriptor()->>'serviceId'
   OR profitia_ingestion.scope_allows(e.source_id,e.resource_id) IS NOT TRUE THEN RETURN false;END IF;
 SELECT * INTO j FROM public.forecast_preparation_job WHERE id=c->>'jobId' FOR UPDATE;
 IF NOT FOUND OR j."seriesId" IS DISTINCT FROM c->>'seriesId' OR j."modelId" IS DISTINCT FROM c->>'modelId'
   OR j."targetSemantics" IS DISTINCT FROM c->>'targetSemantics' OR j."jobKind" IS DISTINCT FROM c->>'jobKind'
   OR j."jobKind" IS DISTINCT FROM d->>'jobKind'
   OR j."leaseVersion" IS DISTINCT FROM (c->>'leaseVersion')::integer THEN RETURN false;END IF;
 IF c->>'phase'='CLAIM' THEN
   IF c->>'step'<>'CLAIM' OR c->>'leaseOwnerToken' IS NOT NULL
     OR c->>'queueVersion' IS DISTINCT FROM j."updatedAt"::text||':'||j.status
     OR NOT(j.status IN('QUEUED','RETRY_WAIT') OR j.status='RUNNING' AND j."leaseExpiresAt"<clock_timestamp())
     OR profitia_forecast_worker.native_admission(j.id) IS NOT TRUE THEN RETURN false;END IF;
 ELSE
   IF NOT(j.status='RUNNING' AND j."leaseExpiresAt">clock_timestamp() AND j."leaseOwnerToken"=c->>'leaseOwnerToken'
       OR c->>'step' IN('TELEMETRY','LEDGER') AND j.status IN('SUCCEEDED','FAILED','RETRY_WAIT','QUEUED') AND j."leaseOwnerToken" IS NULL)
     OR NOT EXISTS(SELECT 1 FROM profitia_forecast_worker.starts r JOIN profitia_ingestion.effects v USING(effect_id)
       WHERE r.job_id=j.id AND r.lease_version=j."leaseVersion" AND r.owner_token=c->>'leaseOwnerToken' AND v.status='COMMITTED') THEN RETURN false;END IF;
 END IF;
 PERFORM set_config('profitia.forecast.worker_scope',jsonb_build_array(e.effect_id,e.decision_id,e.payload_digest,txid_current()::text,c)::text,true);
 RETURN true;
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $fn$;
CREATE FUNCTION profitia_forecast_worker.scope_allows(p_series text,p_model text,p_target text,p_job text DEFAULT NULL,p_table text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $fn$
DECLARE m jsonb;c jsonb;e profitia_ingestion.effects%ROWTYPE;j public.forecast_preparation_job%ROWTYPE;canonical_payload text;
BEGIN
 m:=nullif(current_setting('profitia.forecast.worker_scope',true),'')::jsonb;c:=m->4;
 IF m->>3 IS DISTINCT FROM txid_current()::text OR c->>'seriesId' IS DISTINCT FROM p_series
   OR c->>'modelId' IS DISTINCT FROM p_model OR c->>'targetSemantics' IS DISTINCT FROM p_target
   OR c->>'phase'='CLAIM' AND (p_job IS NULL OR c->>'jobId' IS DISTINCT FROM p_job
     AND NOT(p_table='forecast_preparation_job_read' AND EXISTS(SELECT 1 FROM public.forecast_preparation_job parent
       JOIN public.forecast_preparation_job dependency ON dependency."jobKey"=parent."dependencyJobKey"
       WHERE parent.id=c->>'jobId' AND dependency.id=p_job AND parent."jobKind"='VERIFICATION' AND dependency."jobKind"='CURRENT'
       AND parent."seriesId"=dependency."seriesId" AND parent."modelId"=dependency."modelId" AND parent."targetSemantics"=dependency."targetSemantics")))
   OR c->>'phase'='STEP' AND p_job IS NOT NULL AND c->>'jobId' IS DISTINCT FROM p_job AND c->>'step'<>'QUEUE_CHILD'
   THEN RETURN false;END IF;
 SELECT '{'||string_agg(to_json(key)::text||':'||value::text,',' ORDER BY key COLLATE "C")||'}' INTO canonical_payload FROM jsonb_each(c);
 SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=(m->>0)::uuid AND decision_id=(m->>1)::uuid
   AND payload_digest=m->>2 AND status='RESERVED'
   AND payload_digest=encode(sha256(convert_to('{"content":'||canonical_payload||',"sourceId":"sg2.forecast.worker"}','UTF8')),'hex');
 IF NOT FOUND THEN RETURN false;END IF;
 IF c->>'phase'='STEP' THEN
   SELECT * INTO j FROM public.forecast_preparation_job WHERE id=c->>'jobId';
   IF NOT FOUND OR j."leaseVersion" IS DISTINCT FROM (c->>'leaseVersion')::integer
     OR NOT(j.status='RUNNING' AND j."leaseExpiresAt">clock_timestamp() AND j."leaseOwnerToken"=c->>'leaseOwnerToken'
       OR c->>'step' IN('TELEMETRY','LEDGER') AND p_table IN('forecast_action_trace','forecast_preparation_execution_ledger','forecast_preparation_job_read')
         AND j.status IN('SUCCEEDED','FAILED','RETRY_WAIT','QUEUED') AND j."leaseOwnerToken" IS NULL)
     THEN RETURN false;END IF;
 END IF;
 RETURN coalesce(e.source_id='sg2.forecast.worker' AND e.resource_id=p_series
   AND e.application_id='spendguru-forecast-worker' AND e.service_id::text=profitia_ingestion.runtime_descriptor()->>'serviceId'
   AND profitia_ingestion.scope_allows(e.source_id,p_series),false);
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $fn$;
CREATE FUNCTION profitia_forecast_worker.record_start(p_effect uuid,p_job text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $fn$
DECLARE j public.forecast_preparation_job%ROWTYPE;m jsonb;
BEGIN
 m:=nullif(current_setting('profitia.forecast.worker_scope',true),'')::jsonb;
 SELECT * INTO j FROM public.forecast_preparation_job WHERE id=p_job AND status='RUNNING' AND "leaseExpiresAt">clock_timestamp();
 IF NOT FOUND OR m->>0 IS DISTINCT FROM p_effect::text OR m->4->>'phase'<>'CLAIM'
   OR j."leaseVersion"<>(m->4->>'leaseVersion')::integer+1
   OR profitia_forecast_worker.scope_allows(j."seriesId",j."modelId",j."targetSemantics",j.id) IS NOT TRUE THEN RETURN false;END IF;
 INSERT INTO profitia_forecast_worker.starts(job_id,lease_version,owner_token,effect_id) VALUES(j.id,j."leaseVersion",j."leaseOwnerToken",p_effect);
 RETURN true;
END $fn$;
CREATE FUNCTION profitia_forecast_worker.record_child(p_effect uuid,p_job text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $fn$
DECLARE j public.forecast_preparation_job%ROWTYPE;p public.forecast_preparation_job%ROWTYPE;m jsonb;
BEGIN
 m:=nullif(current_setting('profitia.forecast.worker_scope',true),'')::jsonb;
 SELECT * INTO p FROM public.forecast_preparation_job WHERE id=m->4->>'jobId';
 SELECT * INTO j FROM public.forecast_preparation_job WHERE "jobKey"=p_job;
 IF NOT FOUND OR m->>0 IS DISTINCT FROM p_effect::text OR m->4->>'step'<>'QUEUE_CHILD' OR p."jobKind"<>'CURRENT'
   OR j."jobKind"<>'VERIFICATION' OR j."modelId"<>'naive' OR j."targetSemantics"<>'ROLLING_DAILY_POINT_IN_TIME'
   OR j."checkpointJson"->>'calibrationOnly'<>'true'
   OR profitia_forecast_worker.scope_allows(j."seriesId",j."modelId",j."targetSemantics",j.id) IS NOT TRUE THEN RETURN false;END IF;
 INSERT INTO profitia_forecast_worker.children(job_key,parent_id,parent_lease_version,effect_id)
   VALUES(p_job,p.id,p."leaseVersion",p_effect) ON CONFLICT(job_key) DO NOTHING;
 RETURN true;
END $fn$;
CREATE FUNCTION profitia_forecast_worker.prevent_runtime_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN IF session_user::regrole::oid::text=ANY(string_to_array(TG_ARGV[0],',')) THEN
 RAISE EXCEPTION 'Scientific runtime cannot truncate shared state' USING ERRCODE='42501';END IF;RETURN NULL;END $fn$;
-- Read-only installation projection for the original table owner. It reveals
-- role names, never credentials, and grants no runtime metadata/table access.
CREATE FUNCTION profitia_forecast_worker.fence_targets() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT jsonb_agg(jsonb_build_object('role',i.runtime_role,'originalOwner',i.original_owner,'oid',r.oid::text) ORDER BY i.runtime_role)
 FROM profitia_forecast_worker.installation i JOIN pg_roles r ON r.rolname=i.runtime_role
 JOIN profitia_ingestion.runtime_bindings b ON b.login_role=i.runtime_role
 WHERE i.database_name=current_database() AND i.expires_at>clock_timestamp()
 AND b.application_id='spendguru-forecast-worker' AND b.profile_id='PLATFORM_INTERNAL' AND b.status='ACTIVE' AND b.expires_at>clock_timestamp()
 AND r.rolcanlogin AND r.rolconnlimit=CASE WHEN i.job_kind='VERIFICATION' THEN 4 ELSE 2 END AND NOT(r.rolsuper OR r.rolbypassrls OR r.rolinherit OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication)
 AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
$fn$;
-- Explicit original-owner installation preserves previous owners/ACLs and
-- original roles. Refuse unexpected existing policies before any ALTER.
CREATE FUNCTION profitia_forecast_worker.install_runtime_fences() RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE targets jsonb;entry jsonb;runtime_roles text;runtime_oids text;t text;predicate text;read_predicate text;
BEGIN
 targets:=profitia_forecast_worker.fence_targets();
 IF targets IS NULL OR jsonb_array_length(targets) NOT BETWEEN 1 AND 2
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(targets) v WHERE v->>'originalOwner' IS DISTINCT FROM current_user OR v->>'role'=current_user)
   OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=ANY(profitia_forecast_worker.tables()) AND c.relkind='r' AND c.relowner=current_user::regrole)<>12
   OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=ANY(profitia_forecast_worker.tables())
       AND c.relname NOT IN('forecast_preparation_job','forecast_action_trace') AND (c.relrowsecurity OR c.relforcerowsecurity))
   OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
     AND c.relname IN('forecast_preparation_job','forecast_action_trace') AND c.relrowsecurity AND c.relforcerowsecurity
     AND (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid)=3)<>2
   OR EXISTS(SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=ANY(profitia_forecast_worker.tables())
       AND NOT(c.relname IN('forecast_preparation_job','forecast_action_trace')
         AND p.polname IN('profitia_existing_shared_access','profitia_native_source_fence','profitia_native_delete_fence')))
   THEN RAISE EXCEPTION 'Original owner and known native boundaries required' USING ERRCODE='42501';END IF;
 SELECT string_agg(format('%I',v->>'role'),','),string_agg(v->>'oid',',') INTO runtime_roles,runtime_oids FROM jsonb_array_elements(targets) v;
 FOREACH t IN ARRAY profitia_forecast_worker.tables() LOOP
   IF t='forecast_current_points' THEN
     predicate:='EXISTS(SELECT 1 FROM public.forecast_current_runs r WHERE r.id="runId" AND profitia_forecast_worker.scope_allows(r."seriesId",r."modelId",r."targetBasis"::text,NULL,'''||t||'''))';
   ELSIF t IN('forecast_verification_metrics','forecast_verification_points') THEN
     predicate:='EXISTS(SELECT 1 FROM public.forecast_verification_runs r WHERE r.id="runId" AND profitia_forecast_worker.scope_allows(r."seriesId",r."modelId",r."targetBasis"::text,NULL,'''||t||'''))';
   ELSIF t='forecast_preparation_job' THEN
     predicate:='profitia_forecast_worker.scope_allows("seriesId","modelId","targetSemantics",id,''forecast_preparation_job'')';
   ELSIF t IN('forecast_action_trace','forecast_preparation_execution_ledger') THEN
     predicate:='profitia_forecast_worker.scope_allows("seriesId","modelId","targetSemantics",NULL,'''||t||''')';
   ELSIF t LIKE 'rolling_daily_%' THEN
     predicate:='profitia_forecast_worker.scope_allows("seriesId","modelId",''ROLLING_DAILY_POINT_IN_TIME'',NULL,'''||t||''')';
   ELSE predicate:='profitia_forecast_worker.scope_allows("seriesId","modelId","targetBasis"::text,NULL,'''||t||''')';END IF;
   read_predicate:=CASE WHEN t='forecast_preparation_job' THEN replace(predicate,'''forecast_preparation_job''','''forecast_preparation_job_read''') ELSE predicate END;
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',t);
   IF t NOT IN('forecast_preparation_job','forecast_action_trace') THEN
     EXECUTE format('CREATE POLICY profitia_existing_shared_access ON public.%I TO PUBLIC USING(true) WITH CHECK(true)',t);END IF;
   EXECUTE format('CREATE POLICY profitia_worker_fence ON public.%I AS RESTRICTIVE TO %s USING(%s) WITH CHECK(%s)',t,runtime_roles,read_predicate,predicate);
   IF t NOT IN('forecast_current_points','forecast_verification_metrics','forecast_verification_points') THEN
     EXECUTE format('CREATE POLICY profitia_worker_delete_fence ON public.%I AS RESTRICTIVE FOR DELETE TO %s USING(false)',t,runtime_roles);END IF;
   EXECUTE format('CREATE TRIGGER profitia_worker_truncate_fence BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_forecast_worker.prevent_runtime_truncate(%L)',t,runtime_oids);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO %s',t,runtime_roles);
   IF t IN('forecast_current_points','forecast_verification_metrics','forecast_verification_points') THEN
     EXECUTE format('GRANT DELETE ON public.%I TO %s',t,runtime_roles);END IF;
 END LOOP;RETURN true;
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_forecast_worker FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA profitia_forecast_worker FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_forecast_worker FROM PUBLIC;
