-- SG2 consumer of accepted Source SQL008/009/012/023/024. No credentials,
-- roles, grants, policies, installation row or deployment are activated here.
-- Execute transactionally as the existing controlled NOLOGIN Source owner,
-- after separately approved, table-specific grants from the existing table owner.
SET LOCAL search_path=pg_catalog,pg_temp;
DO $guard$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND database_name=current_database()
   AND schema_digest='14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b' AND unmetered_schema_digest IS NOT NULL)
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN('pg_catalog','information_schema') AND has_schema_privilege(session_user,n.oid,'USAGE') AND has_function_privilege(session_user,p.oid,'EXECUTE WITH GRANT OPTION'))
  OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='profitia_market_history' AND nspowner='profitia_ingestion_owner'::regrole)
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_market_history' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner='profitia_ingestion_owner'::regrole)<>3
  OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_market_history' AND t.tgenabled='O' AND t.tgname IN('immutable_ingestions','immutable_revisions','installation_revision'))<>3
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
   AND c.relname IN('market_series','market_observations','market_hydration_state') AND c.relkind='r'
   AND has_table_privilege(current_user,c.oid,'SELECT') AND has_table_privilege(current_user,c.oid,'INSERT') AND has_table_privilege(current_user,c.oid,'UPDATE'))<>3
 THEN RAISE EXCEPTION 'Accepted unmetered Source, original tables and controlled writer owner required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE SCHEMA profitia_market_history AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_market_history FROM PUBLIC;
CREATE TABLE profitia_market_history.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),project_id text NOT NULL,branch_id text NOT NULL,
 database_name name NOT NULL,runtime_role name NOT NULL,table_owners jsonb NOT NULL,source_ref text NOT NULL,
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE TABLE profitia_market_history.ingestions(
 effect_id uuid PRIMARY KEY REFERENCES profitia_ingestion.effects(effect_id),run_id text NOT NULL,series_id text NOT NULL,
 service_id uuid NOT NULL,history_fingerprint text NOT NULL CHECK(history_fingerprint~'^[a-f0-9]{64}$'),
 provider_call_id uuid NOT NULL REFERENCES profitia_external_call.calls(call_id),response_sha256 text NOT NULL CHECK(response_sha256~'^[a-f0-9]{64}$'),
 metadata jsonb NOT NULL,previous_series jsonb,receipt jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(run_id,series_id)
);
CREATE TABLE profitia_market_history.revisions(
 effect_id uuid NOT NULL REFERENCES profitia_market_history.ingestions(effect_id) DEFERRABLE INITIALLY DEFERRED,
 observed_at timestamptz NOT NULL,previous_value numeric(24,8),new_value numeric(24,8),existed_before boolean NOT NULL,
 PRIMARY KEY(effect_id,observed_at)
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','ingestions','revisions'] LOOP
  EXECUTE format('ALTER TABLE profitia_market_history.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_market_history.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_market_history.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY read_fence ON profitia_market_history.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY insert_fence ON profitia_market_history.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY update_fence ON profitia_market_history.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user=''profitia_ingestion_owner'') WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY delete_fence ON profitia_market_history.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
 END LOOP;
END $rls$;
CREATE FUNCTION profitia_market_history.immutable_record() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Market provenance and revision history are immutable' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER immutable_ingestions BEFORE UPDATE OR DELETE OR TRUNCATE ON profitia_market_history.ingestions FOR EACH STATEMENT EXECUTE FUNCTION profitia_market_history.immutable_record();
CREATE TRIGGER immutable_revisions BEFORE UPDATE OR DELETE OR TRUNCATE ON profitia_market_history.revisions FOR EACH STATEMENT EXECUTE FUNCTION profitia_market_history.immutable_record();
CREATE TRIGGER installation_revision BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON profitia_market_history.installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_ingestion.bump_revision();
CREATE FUNCTION profitia_market_history.runtime_descriptor() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_market_history.installation%ROWTYPE;
BEGIN
 d:=profitia_ingestion.runtime_descriptor();
 SELECT * INTO i FROM profitia_market_history.installation WHERE singleton AND database_name=current_database() AND runtime_role=session_user;
 IF d IS NULL OR NOT FOUND OR d->>'applicationId'<>'spendguru-market-history' OR d->>'environment'<>'development'
  OR d->>'unmeteredSchemaDigest' IS NULL OR d->>'projectId' IS DISTINCT FROM i.project_id OR d->>'branchId' IS DISTINCT FROM i.branch_id
  OR i.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolconnlimit=2)
  OR has_database_privilege(session_user,current_database(),'CREATE')
  OR EXISTS(SELECT 1 FROM pg_namespace n WHERE n.nspname NOT IN('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'
   AND n.nspname NOT LIKE 'pg_temp%' AND has_schema_privilege(session_user,n.oid,'CREATE'))
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN('pg_catalog','information_schema')
   AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%' AND c.relkind IN('r','p','v','m','f')
   AND (has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname NOT IN('pg_catalog','information_schema')
   AND has_schema_privilege(session_user,n.oid,'USAGE') AND has_function_privilege(session_user,p.oid,'EXECUTE')
   AND NOT(n.nspname='profitia_ingestion' AND p.proname IN('runtime_descriptor','current_state','lock_ingestion','scope_allows','reserve','complete','receipt','append_audit'))
   AND NOT(n.nspname='profitia_external_call' AND p.proname IN('descriptor','apply_control','read_status'))
   AND NOT(n.nspname='profitia_external_native' AND p.proname IN('descriptor','permits_status'))
   AND NOT(n.nspname='profitia_market_history' AND p.proname IN('runtime_descriptor','apply_history','read_receipt','due_series')))
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT IN('pg_catalog','information_schema') AND has_schema_privilege(session_user,n.oid,'USAGE') AND has_function_privilege(session_user,p.oid,'EXECUTE WITH GRANT OPTION'))
  OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='profitia_market_history' AND nspowner='profitia_ingestion_owner'::regrole)
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_market_history' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner='profitia_ingestion_owner'::regrole)<>3
  OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_market_history' AND t.tgenabled='O' AND t.tgname IN('immutable_ingestions','immutable_revisions','installation_revision'))<>3
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
   AND c.relname IN('market_series','market_observations','market_hydration_state') AND i.table_owners->>c.relname=pg_get_userbyid(c.relowner))<>3
 THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('boundaryDigest',i.boundary_digest,'nativeSchemaVersion',i.schema_version,'writerMode','SOURCE_EFFECT_ONLY_NO_TABLE_ACL','expiresAt',least(i.expires_at,(d->>'expiresAt')::timestamptz));
END $fn$;
CREATE FUNCTION profitia_market_history.apply_history(p_effect uuid,p_decision uuid,p_canonical text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;e profitia_ingestion.effects%ROWTYPE;p jsonb;h jsonb;sid text;old_series public.market_series%ROWTYPE;
 changed integer;total integer;latest timestamptz;earliest timestamptz;r jsonb;points jsonb;series_name text;canonical_hash text;
BEGIN
 d:=profitia_market_history.runtime_descriptor();
 IF d IS NULL OR octet_length(p_canonical)>8388608 THEN RAISE EXCEPTION 'Market writer unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p_effect AND decision_id=p_decision AND status='RESERVED'
  AND payload_digest=encode(sha256(convert_to(p_canonical,'UTF8')),'hex');
 p:=p_canonical::jsonb;
 IF NOT FOUND OR e.application_id<>'spendguru-market-history' OR e.source_id<>'sg2.market.history.persist'
  OR e.service_id::text IS DISTINCT FROM d->>'serviceId' OR p->>'sourceId'<>e.source_id
  OR profitia_ingestion.scope_allows(e.source_id,e.resource_id) IS NOT TRUE THEN RAISE EXCEPTION 'Current exact Source effect required' USING ERRCODE='42501';END IF;
 p:=p->'content';h:=p->'history';series_name:=p->>'seriesId';points:=h->'historical';
 IF ((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p) k)<>ARRAY['acquisition','history','historyFingerprint','metadata','runId','schemaVersion','seriesId']
  OR p->>'schemaVersion'<>'1.0.0' OR p->>'runId'!~'^[A-Za-z0-9_.:-]{1,128}$' OR series_name!~'^[a-z][a-z0-9_]{0,127}$'
  OR e.resource_id<>'macrobond:'||series_name OR h#>>'{providerSeries,provider,providerCode}'<>'MACROBOND'
  OR h#>>'{providerSeries,providerSeriesId}'<>series_name OR p->>'historyFingerprint'!~'^[a-f0-9]{64}$'
  OR jsonb_typeof(p->'metadata')<>'object' OR coalesce(p#>>'{metadata,Name}','')<>series_name
  OR jsonb_typeof(points)<>'array' OR jsonb_array_length(points) NOT BETWEEN 1 AND 100000
  OR length(coalesce(h->>'displayName','')) NOT BETWEEN 1 AND 2000
  OR NOT EXISTS(SELECT 1 FROM profitia_external_call.calls c WHERE c.call_id=(p#>>'{acquisition,callId}')::uuid AND c.login_role=session_user
   AND c.application_id=e.application_id AND c.service_id=e.service_id AND c.source_id='sg2.market.history.api'
   AND c.resource_id='sg2-market-history:api' AND c.status='RESPONSE' AND c.http_status=200)
 ) IS NOT FALSE THEN RAISE EXCEPTION 'Exact validated Macrobond history and settled provenance required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(points) v WHERE (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(v) k)<>ARRAY['date','value']
  OR coalesce(v->>'date','')!~'^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$' OR (v->>'date')::timestamptz>clock_timestamp()
  OR jsonb_typeof(v->'value') NOT IN('number','null') OR jsonb_typeof(v->'value')='number' AND ((v->>'value')::numeric<>round((v->>'value')::numeric,8) OR abs((v->>'value')::numeric)>=1e16))
  OR EXISTS(SELECT 1 FROM (SELECT v->>'date' d,lag(v->>'date') OVER(ORDER BY n) prev FROM jsonb_array_elements(points) WITH ORDINALITY x(v,n)) a WHERE a.d<=a.prev)
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(points) v WHERE jsonb_typeof(v->'value')='number')
 THEN RAISE EXCEPTION 'Invalid, duplicate, future, unrepresentable or truncated history' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('sg2-market-history:'||series_name,0));
 SELECT * INTO old_series FROM public.market_series WHERE "providerCode"='MACROBOND' AND "providerSeriesId"=series_name FOR UPDATE;
 sid:=coalesce(old_series.id,gen_random_uuid()::text);
 INSERT INTO public.market_series("id","providerCode","providerSeriesId","providerSeriesKey","displayName","frequency","currency","unit","sourceLabel","createdAt","updatedAt")
 VALUES(sid,'MACROBOND',series_name,series_name,h->>'displayName',h->>'frequency',h->>'currency',h->>'unit',h->>'source',clock_timestamp(),clock_timestamp())
 ON CONFLICT("providerCode","providerSeriesId") DO UPDATE SET "providerSeriesKey"=EXCLUDED."providerSeriesKey","displayName"=EXCLUDED."displayName","frequency"=EXCLUDED."frequency","currency"=EXCLUDED."currency","unit"=EXCLUDED."unit","sourceLabel"=EXCLUDED."sourceLabel","updatedAt"=clock_timestamp()
 WHERE (market_series."providerSeriesKey",market_series."displayName",market_series."frequency",market_series."currency",market_series."unit",market_series."sourceLabel") IS DISTINCT FROM (EXCLUDED."providerSeriesKey",EXCLUDED."displayName",EXCLUDED."frequency",EXCLUDED."currency",EXCLUDED."unit",EXCLUDED."sourceLabel");
 INSERT INTO profitia_market_history.revisions(effect_id,observed_at,previous_value,new_value,existed_before)
 SELECT e.effect_id,a.date::timestamptz,o.value,a.value,o.id IS NOT NULL FROM jsonb_to_recordset(points) a(date text,value numeric)
 LEFT JOIN public.market_observations o ON o."seriesId"=sid AND o."observedAt"=a.date::timestamptz WHERE o.id IS NULL OR o.value IS DISTINCT FROM a.value;
 GET DIAGNOSTICS changed=ROW_COUNT;
 INSERT INTO public.market_observations("id","seriesId","observedAt","value","createdAt","updatedAt")
 SELECT gen_random_uuid()::text,sid,a.date::timestamptz,a.value,clock_timestamp(),clock_timestamp() FROM jsonb_to_recordset(points) a(date text,value numeric)
 ON CONFLICT("seriesId","observedAt") DO UPDATE SET "value"=EXCLUDED."value","updatedAt"=clock_timestamp() WHERE market_observations.value IS DISTINCT FROM EXCLUDED.value;
 SELECT count(*)::integer,min("observedAt"),max("observedAt") FILTER(WHERE value IS NOT NULL) INTO total,earliest,latest FROM public.market_observations WHERE "seriesId"=sid;
 INSERT INTO public.market_hydration_state("id","seriesId","lastProviderFetchAt","earliestStoredObservationAt","latestStoredObservationAt","lastHydrationStatus","lastHydratedObservationCount","createdAt","updatedAt")
 VALUES(gen_random_uuid()::text,sid,clock_timestamp(),earliest,latest,'SUCCEEDED',jsonb_array_length(points),clock_timestamp(),clock_timestamp())
 ON CONFLICT("seriesId") DO UPDATE SET "lastProviderFetchAt"=EXCLUDED."lastProviderFetchAt","earliestStoredObservationAt"=EXCLUDED."earliestStoredObservationAt","latestStoredObservationAt"=EXCLUDED."latestStoredObservationAt","lastHydrationStatus"='SUCCEEDED',"lastHydrationMessage"=NULL,"lastHydratedObservationCount"=EXCLUDED."lastHydratedObservationCount","updatedAt"=clock_timestamp();
 SELECT encode(sha256(convert_to(coalesce(string_agg(to_char("observedAt" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')||'='||coalesce(value::text,'null'),E'\n' ORDER BY "observedAt"),''),'UTF8')),'hex') INTO canonical_hash FROM public.market_observations WHERE "seriesId"=sid;
 r:=jsonb_build_object('canonicalObservationDigest',canonical_hash,'canonicalDescriptor',jsonb_build_object('displayName',h->>'displayName','frequency',h->>'frequency','currency',h->>'currency','unit',h->>'unit','source',h->>'source'),'seriesId',series_name,'effectId',e.effect_id,'historyFingerprint',p->>'historyFingerprint','changedObservationCount',changed,'storedObservationCount',total,'latestObservationDate',to_char(latest AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'status',CASE WHEN changed=0 THEN 'UNCHANGED' ELSE 'UPDATED' END);
 INSERT INTO profitia_market_history.ingestions(effect_id,run_id,series_id,service_id,history_fingerprint,provider_call_id,response_sha256,metadata,previous_series,receipt)
 VALUES(e.effect_id,p->>'runId',series_name,e.service_id,p->>'historyFingerprint',(p#>>'{acquisition,callId}')::uuid,p#>>'{acquisition,responseSha256}',p->'metadata',CASE WHEN old_series.id IS NULL THEN NULL ELSE to_jsonb(old_series) END,r);
 RETURN r;
END $fn$;
CREATE FUNCTION profitia_market_history.read_receipt(p_run text,p_series text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r jsonb;
BEGIN
 d:=profitia_market_history.runtime_descriptor();
 IF d IS NULL OR profitia_ingestion.current_state('sg2.market.history.persist','macrobond:'||p_series) IS NULL THEN RAISE EXCEPTION 'Current history authority required' USING ERRCODE='42501';END IF;
 SELECT i.receipt INTO r FROM profitia_market_history.ingestions i JOIN profitia_ingestion.effects e ON e.effect_id=i.effect_id
 WHERE i.run_id=p_run AND i.series_id=p_series AND i.service_id::text=d->>'serviceId' AND e.status='COMMITTED';RETURN r;
END $fn$;
CREATE FUNCTION profitia_market_history.due_series(p_after text,p_before timestamptz,p_limit integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF profitia_market_history.runtime_descriptor() IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_before>clock_timestamp() THEN RAISE EXCEPTION 'Bounded existing-series refresh required' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(id ORDER BY id) FROM(SELECT s."providerSeriesId" id FROM public.market_series s LEFT JOIN public.market_hydration_state h ON h."seriesId"=s.id
 WHERE s."providerCode"='MACROBOND' AND s."providerSeriesId">p_after AND (h."lastProviderFetchAt" IS NULL OR h."lastProviderFetchAt"<p_before)
 AND profitia_ingestion.current_state('sg2.market.history.persist','macrobond:'||s."providerSeriesId") IS NOT NULL ORDER BY s."providerSeriesId" LIMIT p_limit) q),'[]'::jsonb);
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_market_history FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_market_history FROM PUBLIC;
