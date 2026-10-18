-- Optional native protocol policy over the SAME source controls/counters.
-- No role grants, HTTP send, raw body storage, new writer or activation.
DO $owner$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
   OR NOT EXISTS(SELECT 1 FROM profitia_external_call.installation WHERE singleton AND schema_version='1.0.0'
     AND schema_digest='69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206') THEN
   RAISE EXCEPTION 'Accepted controlled external source owner required' USING ERRCODE='42501'; END IF;
END $owner$;
CREATE SCHEMA profitia_external_native AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_external_native FROM PUBLIC;
CREATE FUNCTION profitia_external_native.valid_rules(v jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r jsonb; n integer; BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v) NOT BETWEEN 1 AND 32 THEN RETURN false; END IF;
 FOR r IN SELECT * FROM jsonb_array_elements(v) LOOP
   IF jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RETURN false; END IF;
   SELECT count(*) INTO n FROM jsonb_object_keys(r);
   IF jsonb_typeof(r->'method') IS DISTINCT FROM 'string' OR r->>'method' NOT IN('GET','POST')
     OR jsonb_typeof(r->'requestFormat') IS DISTINCT FROM 'string' OR r->>'requestFormat' NOT IN('NONE','JSON','FORM')
     OR r->>'method'='GET' AND r->>'requestFormat'<>'NONE' THEN RETURN false; END IF;
   IF r ? 'path' THEN
     IF n<>3 OR NOT(r ?& ARRAY['method','path','requestFormat']) OR jsonb_typeof(r->'path') IS DISTINCT FROM 'string'
       OR r->>'path' !~ '^/[A-Za-z0-9/._-]{0,254}$' OR r->>'path' LIKE '%..%' OR r->>'path' LIKE '%//%' THEN RETURN false; END IF;
   ELSE
     IF n<>5 OR NOT(r ?& ARRAY['method','prefix','suffix','parameter','requestFormat'])
       OR jsonb_typeof(r->'prefix') IS DISTINCT FROM 'string' OR r->>'prefix' !~ '^/[A-Za-z0-9/._-]{0,254}$'
       OR jsonb_typeof(r->'suffix') IS DISTINCT FROM 'string' OR r->>'suffix' !~ '^[A-Za-z0-9/._-]{0,255}$'
       OR jsonb_typeof(r->'parameter') IS DISTINCT FROM 'string' OR r->>'parameter' NOT IN('HEX24','UUID','OPAQUE','STORAGE_PATH')
       OR r->>'prefix' LIKE '%..%' OR r->>'suffix' LIKE '%..%' OR r->>'prefix' LIKE '%//%' OR r->>'suffix' LIKE '%//%' THEN RETURN false; END IF;
   END IF;
 END LOOP;
 RETURN (SELECT count(*) FROM jsonb_array_elements(v))=(SELECT count(DISTINCT items.value) FROM jsonb_array_elements(v) AS items(value));
END $fn$;
CREATE FUNCTION profitia_external_native.valid_origins(v jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e jsonb; BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)>3 THEN RETURN false; END IF;
 FOR e IN SELECT * FROM jsonb_array_elements(v) LOOP
  IF jsonb_typeof(e) IS DISTINCT FROM 'string' OR NOT(e#>>'{}' ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'
    OR e#>>'{}' ~ '^http://127\.0\.0\.1:[0-9]{1,5}$') THEN RETURN false;END IF;
 END LOOP;
 RETURN (SELECT count(*) FROM jsonb_array_elements(v))=(SELECT count(DISTINCT items.value) FROM jsonb_array_elements(v) AS items(value));
END $fn$;
CREATE TABLE profitia_external_native.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_external_native.policies(
 policy_id uuid PRIMARY KEY REFERENCES profitia_external_call.policies(policy_id),base_policy_version bigint NOT NULL CHECK(base_policy_version>0),
 path_rules jsonb NOT NULL CHECK(profitia_external_native.valid_rules(path_rules)),
 redirect_origins jsonb NOT NULL CHECK(profitia_external_native.valid_origins(redirect_origins)),
 maximum_response_bytes integer NOT NULL CHECK(maximum_response_bytes BETWEEN 1 AND 33554432),
 credential_mode text NOT NULL CHECK(credential_mode IN('NONE','SERVER_HEADERS')),
 completion_mode text NOT NULL CHECK(completion_mode='ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','policies'] LOOP
  EXECUTE format('ALTER TABLE profitia_external_native.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_external_native.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_external_native.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY read_fence ON profitia_external_native.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY insert_fence ON profitia_external_native.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY update_fence ON profitia_external_native.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user=''profitia_ingestion_owner'') WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY delete_fence ON profitia_external_native.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false)',t);
 END LOOP;
END $rls$;
CREATE FUNCTION profitia_external_native.no_truncate() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Native source policy history is immutable' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON profitia_external_native.installation
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_external_native.no_truncate();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON profitia_external_native.policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_external_native.no_truncate();
CREATE FUNCTION profitia_external_native.policy_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_external_call.policies%ROWTYPE;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Native policy history is immutable' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM profitia_external_call.policies WHERE policy_id=NEW.policy_id FOR SHARE;
 IF NOT FOUND OR p.version<>NEW.base_policy_version OR NEW.expires_at>p.expires_at THEN
   RAISE EXCEPTION 'Exact finite parent policy required' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','version','expires_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','expires_at']) THEN
   RAISE EXCEPTION 'Native policy definition is immutable' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' THEN NEW.version:=OLD.version+1; END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER native_policy_change BEFORE INSERT OR UPDATE OR DELETE ON profitia_external_native.policies
 FOR EACH ROW EXECUTE FUNCTION profitia_external_native.policy_change();
CREATE FUNCTION profitia_external_native.descriptor(p_source text,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_external_native.installation%ROWTYPE;p profitia_external_native.policies%ROWTYPE;BEGIN
 d:=profitia_external_call.descriptor(p_source,p_resource);
 IF d IS NULL OR current_user<>'profitia_ingestion_owner' THEN RETURN NULL; END IF;
 SELECT * INTO i FROM profitia_external_native.installation WHERE singleton;
 IF NOT FOUND OR i.schema_version<>'1.0.0'
   OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_external_native'
     AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner='profitia_ingestion_owner'::regrole)<>2
   OR has_schema_privilege(session_user,'profitia_external_native','CREATE')
   OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_external_native' AND c.relkind='r'
     AND (has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RETURN NULL; END IF;
 SELECT * INTO p FROM profitia_external_native.policies WHERE policy_id=(d->>'policyId')::uuid
   AND base_policy_version=(d->>'policyVersion')::bigint AND status='ACTIVE' AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND OR d->>'transport'<>'LOCAL_SYNTHETIC_HTTP' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.redirect_origins)e WHERE e LIKE 'http:%') THEN RETURN NULL; END IF;
 RETURN d||jsonb_build_object('nativeSchemaVersion',i.schema_version,'nativeSchemaDigest',i.schema_digest,
   'nativePolicyVersion',p.version::text,'nativePathRules',p.path_rules,'nativeRedirectOrigins',p.redirect_origins,
   'nativeMaximumResponseBytes',p.maximum_response_bytes,'nativeCredentialMode',p.credential_mode,
   'nativeCompletionMode',p.completion_mode,'nativeSourceRef',p.source_ref,'nativeExpiresAt',p.expires_at);
END $fn$;
CREATE FUNCTION profitia_external_native.permits_status(p_policy uuid,p_status integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_external_call.policies%ROWTYPE;d jsonb;BEGIN
 SELECT * INTO p FROM profitia_external_call.policies WHERE policy_id=p_policy;
 IF NOT FOUND THEN RETURN false; END IF;
 d:=profitia_external_native.descriptor(p.source_id,p.resource_id);
 RETURN d IS NOT NULL AND d->>'policyId'=p_policy::text
   AND (p_status=304 OR p_status IN(301,302,303,307,308) AND jsonb_array_length(d->'nativeRedirectOrigins')>0);
END $fn$;
-- Genuine native redirects remain transport responses. Existing JSON hosts
-- still refuse them. No fabricated 200 code or separate settlement writer.
ALTER TABLE profitia_external_call.calls DROP CONSTRAINT calls_http_status_check;
ALTER TABLE profitia_external_call.calls ADD CONSTRAINT calls_http_status_check CHECK(http_status BETWEEN 200 AND 599);
CREATE OR REPLACE FUNCTION profitia_external_call.apply_control(p_effect uuid,p_decision uuid,p_envelope text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE v jsonb;c jsonb;d jsonb;p profitia_external_call.policies%ROWTYPE;r profitia_external_call.calls%ROWTYPE;id uuid;
BEGIN
 v:=profitia_external_call.check_control(p_effect,p_decision,p_envelope);c:=v->'content';d:=v->'descriptor';
 SELECT * INTO p FROM profitia_external_call.policies WHERE policy_id=(d->>'policyId')::uuid FOR UPDATE;
 IF NOT FOUND OR p.version::text IS DISTINCT FROM d->>'policyVersion' OR p.status<>'ACTIVE' OR p.expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'Current external policy required' USING ERRCODE='42501';END IF;
 IF c->>'action'='PLAN' THEN
  IF c->>'callId' IS NOT NULL OR c->>'status' IS NOT NULL OR c->>'httpStatus' IS NOT NULL OR c->>'responseDigest' IS NOT NULL
    OR p.admitted_count>=p.capacity THEN RAISE EXCEPTION 'External admission unavailable' USING ERRCODE='42501';END IF;
  UPDATE profitia_external_call.policies SET admitted_count=admitted_count+1 WHERE policy_id=p.policy_id;
  INSERT INTO profitia_external_call.calls(call_id,policy_id,policy_version,login_role,service_id,service_binding_version,source_policy_version,application_id,environment,source_id,resource_id,configuration_version,intent_digest,request_digest,status)
   VALUES(p_effect,p.policy_id,p.version,session_user,(d->>'serviceId')::uuid,d->>'serviceBindingVersion',d->>'sourcePolicyVersion',d->>'applicationId',d->>'environment',p.source_id,p.resource_id,p.configuration_version,c->>'intentDigest',c->>'requestDigest','PLANNED');
  RETURN jsonb_build_object('callId',p_effect,'status','PLANNED','fresh',true);
 END IF;
 id:=(c->>'callId')::uuid;
 SELECT * INTO r FROM profitia_external_call.calls WHERE call_id=id AND login_role=session_user AND policy_id=p.policy_id AND policy_version=p.version
  AND source_id=p.source_id AND resource_id=p.resource_id AND service_id::text=d->>'serviceId'
  AND service_binding_version=d->>'serviceBindingVersion' AND source_policy_version=d->>'sourcePolicyVersion' AND application_id=d->>'applicationId' AND environment=d->>'environment'
  AND configuration_version=p.configuration_version AND intent_digest=c->>'intentDigest' AND request_digest=c->>'requestDigest' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current external intent required' USING ERRCODE='42501';END IF;
 IF c->>'action'='ATTEMPT' THEN
  IF r.status<>'PLANNED' OR c->>'status' IS NOT NULL OR c->>'httpStatus' IS NOT NULL OR c->>'responseDigest' IS NOT NULL THEN
   RAISE EXCEPTION 'External attempt already reserved or invalid' USING ERRCODE='42501';END IF;
  UPDATE profitia_external_call.calls SET status='ATTEMPT_RESERVED',attempt_effect_id=p_effect,attempt_reserved_at=clock_timestamp() WHERE call_id=id;
  RETURN jsonb_build_object('callId',id,'status','ATTEMPT_RESERVED','fresh',true);
 END IF;
 IF r.status<>'ATTEMPT_RESERVED' OR jsonb_typeof(c->'status') IS DISTINCT FROM 'string' OR c->>'status' NOT IN('RESPONSE','UNVERIFIED','NOT_SENT')
  OR (c->>'status'='RESPONSE' AND (jsonb_typeof(c->'responseDigest') IS DISTINCT FROM 'string'
    OR jsonb_typeof(c->'httpStatus') IS DISTINCT FROM 'number' OR c->>'responseDigest' !~ '^[a-f0-9]{64}$' OR c->>'httpStatus' !~ '^[0-9]{3}$'
    OR (c->>'httpStatus')::integer NOT BETWEEN 200 AND 599 OR ((c->>'httpStatus')::integer BETWEEN 300 AND 399 AND profitia_external_native.permits_status(p.policy_id,(c->>'httpStatus')::integer) IS NOT TRUE)))
  OR (c->>'status'<>'RESPONSE' AND (c->>'httpStatus' IS NOT NULL OR c->>'responseDigest' IS NOT NULL)) THEN
  RAISE EXCEPTION 'External settlement unavailable' USING ERRCODE='42501';END IF;
 UPDATE profitia_external_call.calls SET status=c->>'status',settlement_effect_id=p_effect,http_status=(c->>'httpStatus')::integer,
  response_digest=c->>'responseDigest',settled_at=clock_timestamp() WHERE call_id=id;
 RETURN jsonb_build_object('callId',id,'status',c->>'status','fresh',true);
END $fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA profitia_external_native FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_external_native FROM PUBLIC;
