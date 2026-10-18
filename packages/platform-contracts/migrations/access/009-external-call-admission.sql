-- Optional control extension. SQL008 and its source/audit writer stay unchanged.
-- A committed control transaction is not evidence that an upstream responded.
-- No request, response, credential, customer identity or organisation is stored.
DO $owner$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
   OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND schema_version='1.0.0') THEN
  RAISE EXCEPTION 'Accepted controlled source owner required' USING ERRCODE='42501';END IF;
END $owner$;
CREATE SCHEMA profitia_external_call AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_external_call FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE FUNCTION profitia_external_call.valid_paths(v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT CASE WHEN jsonb_typeof(v)<>'array' THEN false ELSE jsonb_array_length(v) BETWEEN 1 AND 32
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v) e WHERE jsonb_typeof(e)<>'object'
    OR (SELECT count(*) FROM jsonb_object_keys(e))<>2 OR NOT(e ?& ARRAY['method','path'])
    OR jsonb_typeof(e->'method') IS DISTINCT FROM 'string' OR jsonb_typeof(e->'path') IS DISTINCT FROM 'string'
    OR e->>'method' NOT IN('GET','POST') OR e->>'path' !~ '^/[A-Za-z0-9/._-]{0,255}$'
    OR e->>'path' LIKE '%..%' OR e->>'path' LIKE '%//%') END
$fn$;
CREATE TABLE profitia_external_call.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_schema_digest text NOT NULL CHECK(source_schema_digest~'^[a-f0-9]{64}$'),
 environment text NOT NULL CHECK(environment IN('development','staging','production')),
 project_id text NOT NULL,branch_id text NOT NULL,database_name name NOT NULL
);
CREATE TABLE profitia_external_call.policies(
 policy_id uuid PRIMARY KEY,login_role name NOT NULL REFERENCES profitia_ingestion.runtime_bindings(login_role),
 source_id text NOT NULL REFERENCES profitia_ingestion.sources(source_id),resource_id text NOT NULL CHECK(length(resource_id) BETWEEN 1 AND 256 AND resource_id NOT LIKE '%*%'),
 configuration_version text NOT NULL CHECK(configuration_version~'^[A-Za-z0-9._:-]{1,128}$'),
 origin text NOT NULL,transport text NOT NULL CHECK(transport IN('HTTPS','LOCAL_SYNTHETIC_HTTP')),
 path_rules jsonb NOT NULL CHECK(profitia_external_call.valid_paths(path_rules)),
 maximum_request_bytes integer NOT NULL CHECK(maximum_request_bytes BETWEEN 1 AND 1048576),
 maximum_response_bytes integer NOT NULL CHECK(maximum_response_bytes BETWEEN 1 AND 8388608),
 timeout_ms integer NOT NULL CHECK(timeout_ms BETWEEN 100 AND 120000),
 unit text NOT NULL CHECK(unit='UPSTREAM_ATTEMPT_ADMISSION'),capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 1000000),
 admitted_count integer NOT NULL DEFAULT 0 CHECK(admitted_count BETWEEN 0 AND capacity),
 window_start timestamptz NOT NULL,window_end timestamptz NOT NULL,expires_at timestamptz NOT NULL,
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),source_ref text NOT NULL,
 CHECK(isfinite(window_start) AND isfinite(window_end) AND isfinite(expires_at) AND window_start<window_end AND expires_at<=window_end),
 CHECK(transport='HTTPS' AND origin~'^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'
  OR transport='LOCAL_SYNTHETIC_HTTP' AND source_ref='SYNTHETIC_ONLY' AND origin~'^http://127\.0\.0\.1:[0-9]{1,5}$')
);
CREATE UNIQUE INDEX one_active_external_policy ON profitia_external_call.policies(login_role,source_id,resource_id) WHERE status='ACTIVE';
CREATE TABLE profitia_external_call.calls(
 call_id uuid PRIMARY KEY REFERENCES profitia_ingestion.effects(effect_id),
 policy_id uuid NOT NULL REFERENCES profitia_external_call.policies(policy_id),policy_version bigint NOT NULL,
 login_role name NOT NULL,service_id uuid NOT NULL,service_binding_version text NOT NULL,source_policy_version text NOT NULL,
 application_id text NOT NULL,environment text NOT NULL,source_id text NOT NULL,resource_id text NOT NULL,
 configuration_version text NOT NULL,intent_digest text NOT NULL CHECK(intent_digest~'^[a-f0-9]{64}$'),request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN('PLANNED','ATTEMPT_RESERVED','RESPONSE','UNVERIFIED','NOT_SENT')),
 attempt_effect_id uuid UNIQUE REFERENCES profitia_ingestion.effects(effect_id),
 settlement_effect_id uuid UNIQUE REFERENCES profitia_ingestion.effects(effect_id),
 http_status integer CHECK(http_status BETWEEN 200 AND 599 AND http_status NOT BETWEEN 300 AND 399),
 response_digest text CHECK(response_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),attempt_reserved_at timestamptz,settled_at timestamptz,
 CHECK(status='PLANNED' AND attempt_effect_id IS NULL AND settlement_effect_id IS NULL AND http_status IS NULL AND response_digest IS NULL AND attempt_reserved_at IS NULL AND settled_at IS NULL
  OR status='ATTEMPT_RESERVED' AND attempt_effect_id IS NOT NULL AND settlement_effect_id IS NULL AND http_status IS NULL AND response_digest IS NULL AND attempt_reserved_at IS NOT NULL AND settled_at IS NULL
  OR status IN('RESPONSE','UNVERIFIED','NOT_SENT') AND attempt_effect_id IS NOT NULL AND settlement_effect_id IS NOT NULL AND attempt_reserved_at IS NOT NULL AND settled_at IS NOT NULL
    AND (status='RESPONSE' AND http_status IS NOT NULL AND response_digest IS NOT NULL OR status<>'RESPONSE' AND http_status IS NULL AND response_digest IS NULL))
);
CREATE UNIQUE INDEX one_external_intent ON profitia_external_call.calls(application_id,environment,source_id,resource_id,intent_digest);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','policies','calls'] LOOP
  EXECUTE format('ALTER TABLE profitia_external_call.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_external_call.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_external_call.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY direct_read_fence ON profitia_external_call.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY direct_insert_fence ON profitia_external_call.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY direct_update_fence ON profitia_external_call.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user=''profitia_ingestion_owner'') WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY direct_delete_fence ON profitia_external_call.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
 END LOOP;
END $rls$;

CREATE FUNCTION profitia_external_call.descriptor(p_source text,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;i profitia_external_call.installation%ROWTYPE;p profitia_external_call.policies%ROWTYPE;
BEGIN
 d:=profitia_ingestion.runtime_descriptor();s:=profitia_ingestion.current_state(p_source,p_resource);
 IF d IS NULL OR s IS NULL OR s->'ingestion'->>'payloadSchema' IS DISTINCT FROM 'external-call-control-v1'
  OR s->'ingestion'->>'effectKind' IS DISTINCT FROM 'STORED_SQL_TRANSACTION' OR s->'ingestion'->>'unit' IS DISTINCT FROM 'SOURCE_TRANSACTION' THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_external_call.installation WHERE singleton;
 IF NOT FOUND OR i.schema_version<>'1.0.0' OR i.database_name<>current_database()
  OR i.environment IS DISTINCT FROM d->>'environment' OR i.project_id IS DISTINCT FROM d->>'projectId'
  OR i.branch_id IS DISTINCT FROM d->>'branchId' OR i.source_schema_digest IS DISTINCT FROM d->>'schemaDigest'
  OR current_user<>'profitia_ingestion_owner'
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_external_call'
    AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner='profitia_ingestion_owner'::regrole)<>3
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_external_call'
    AND c.relkind='r' AND (has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RETURN NULL;END IF;
 SELECT * INTO p FROM profitia_external_call.policies WHERE login_role=session_user AND source_id=p_source AND resource_id=p_resource
  AND status='ACTIVE' AND window_start<=clock_timestamp() AND window_end>clock_timestamp() AND expires_at>clock_timestamp();
 IF NOT FOUND OR p.transport='LOCAL_SYNTHETIC_HTTP' AND (i.environment<>'development' OR p.source_ref<>'SYNTHETIC_ONLY') THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,'sourceSchemaDigest',i.source_schema_digest,
  'projectId',i.project_id,'branchId',i.branch_id,'databaseName',current_database(),'role',session_user,
  'applicationId',d->>'applicationId','serviceId',d->>'serviceId','serviceBindingVersion',d->>'proofRef',
  'sourcePolicyVersion',s->>'policyVersion','environment',i.environment,'sourceId',p_source,'resourceId',p_resource,
  'policyId',p.policy_id,'policyVersion',p.version::text,'configurationVersion',p.configuration_version,
  'origin',p.origin,'transport',p.transport,'pathRules',p.path_rules,'maximumRequestBytes',p.maximum_request_bytes,
  'maximumResponseBytes',p.maximum_response_bytes,'timeoutMs',p.timeout_ms,'unit',p.unit,'capacity',p.capacity,
  'admittedCount',p.admitted_count,'sourceRef',p.source_ref,
  'expiresAt',least(p.expires_at,p.window_end,(s->'access'->>'expiresAt')::timestamptz));
END $fn$;

CREATE FUNCTION profitia_external_call.check_control(p_effect uuid,p_decision uuid,p_envelope text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e profitia_ingestion.effects%ROWTYPE;v jsonb;c jsonb;d jsonb;
BEGIN
 IF p_envelope IS NULL OR octet_length(p_envelope)>4096 THEN RAISE EXCEPTION 'External control unavailable' USING ERRCODE='42501';END IF;
 v:=p_envelope::jsonb;c:=v->'content';
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(v))<>2 OR NOT(v ?& ARRAY['content','sourceId'])
  OR jsonb_typeof(c) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(c))<>8
  OR NOT(c ?& ARRAY['action','callId','configurationVersion','httpStatus','intentDigest','requestDigest','responseDigest','status'])
  OR jsonb_typeof(v->'sourceId') IS DISTINCT FROM 'string' OR jsonb_typeof(c->'action') IS DISTINCT FROM 'string'
  OR jsonb_typeof(c->'configurationVersion') IS DISTINCT FROM 'string' OR jsonb_typeof(c->'requestDigest') IS DISTINCT FROM 'string'
  OR jsonb_typeof(c->'intentDigest') IS DISTINCT FROM 'string' OR c->>'intentDigest' !~ '^[a-f0-9]{64}$'
  OR c->>'action' NOT IN('PLAN','ATTEMPT','SETTLE') OR c->>'configurationVersion' !~ '^[A-Za-z0-9._:-]{1,128}$'
  OR c->>'requestDigest' !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'External control unavailable' USING ERRCODE='42501';END IF;
 SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p_effect AND status='RESERVED' AND decision_id=p_decision
  AND payload_digest=encode(sha256(convert_to(p_envelope,'UTF8')),'hex') AND source_id=v->>'sourceId';
 IF NOT FOUND OR NOT profitia_ingestion.scope_allows(e.source_id,e.resource_id) THEN
  RAISE EXCEPTION 'Current reserved source control required' USING ERRCODE='42501';END IF;
 d:=profitia_external_call.descriptor(e.source_id,e.resource_id);
 IF d IS NULL OR d->>'serviceId' IS DISTINCT FROM e.service_id::text OR d->>'applicationId' IS DISTINCT FROM e.application_id OR d->>'environment' IS DISTINCT FROM e.environment
  OR d->>'configurationVersion' IS DISTINCT FROM c->>'configurationVersion' THEN RAISE EXCEPTION 'Current external policy required' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('descriptor',d,'content',c);
END $fn$;

CREATE FUNCTION profitia_external_call.apply_control(p_effect uuid,p_decision uuid,p_envelope text) RETURNS jsonb
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
    OR (c->>'httpStatus')::integer NOT BETWEEN 200 AND 599 OR (c->>'httpStatus')::integer BETWEEN 300 AND 399))
  OR (c->>'status'<>'RESPONSE' AND (c->>'httpStatus' IS NOT NULL OR c->>'responseDigest' IS NOT NULL)) THEN
  RAISE EXCEPTION 'External settlement unavailable' USING ERRCODE='42501';END IF;
 UPDATE profitia_external_call.calls SET status=c->>'status',settlement_effect_id=p_effect,http_status=(c->>'httpStatus')::integer,
  response_digest=c->>'responseDigest',settled_at=clock_timestamp() WHERE call_id=id;
 RETURN jsonb_build_object('callId',id,'status',c->>'status','fresh',true);
END $fn$;

CREATE FUNCTION profitia_external_call.read_status(p_call uuid,p_source text,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_external_call.calls%ROWTYPE;
BEGIN
 d:=profitia_external_call.descriptor(p_source,p_resource);IF d IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO r FROM profitia_external_call.calls WHERE call_id=p_call AND login_role=session_user
  AND source_id=p_source AND resource_id=p_resource AND policy_id=(d->>'policyId')::uuid AND policy_version::text=d->>'policyVersion'
  AND configuration_version=d->>'configurationVersion' AND service_id::text=d->>'serviceId'
  AND service_binding_version=d->>'serviceBindingVersion' AND source_policy_version=d->>'sourcePolicyVersion' AND application_id=d->>'applicationId' AND environment=d->>'environment';
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('callId',r.call_id,'status',r.status);
END $fn$;

CREATE FUNCTION profitia_external_call.policy_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.admitted_count<>0 THEN RAISE EXCEPTION 'Fresh external policy requires zero admissions' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 IF NEW.admitted_count<OLD.admitted_count THEN RAISE EXCEPTION 'External admissions cannot be refunded' USING ERRCODE='42501';END IF;
 IF NEW.admitted_count<>OLD.admitted_count THEN
  IF NEW.admitted_count<>OLD.admitted_count+1 OR NOT profitia_ingestion.scope_allows(OLD.source_id,OLD.resource_id)
    OR (to_jsonb(NEW)-ARRAY['admitted_count','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['admitted_count','version']) THEN
   RAISE EXCEPTION 'Current source admission required' USING ERRCODE='42501';END IF;NEW.version:=OLD.version;
 ELSE NEW.version:=OLD.version+1;END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER external_policy_change BEFORE INSERT OR UPDATE ON profitia_external_call.policies FOR EACH ROW EXECUTE FUNCTION profitia_external_call.policy_change();
CREATE FUNCTION profitia_external_call.protect_calls() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e profitia_ingestion.effects%ROWTYPE;id uuid;
BEGIN
 IF TG_OP IN('DELETE','TRUNCATE') THEN RAISE EXCEPTION 'External control history is immutable' USING ERRCODE='42501';END IF;
 IF NOT profitia_ingestion.scope_allows(NEW.source_id,NEW.resource_id) OR NEW.login_role<>session_user THEN
  RAISE EXCEPTION 'Current external source required' USING ERRCODE='42501';END IF;
 IF TG_OP='INSERT' THEN id:=NEW.call_id;
 ELSE
  IF (to_jsonb(NEW)-ARRAY['status','attempt_effect_id','settlement_effect_id','http_status','response_digest','attempt_reserved_at','settled_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','attempt_effect_id','settlement_effect_id','http_status','response_digest','attempt_reserved_at','settled_at']) THEN
   RAISE EXCEPTION 'External intent binding is immutable' USING ERRCODE='42501';END IF;
  IF OLD.status='PLANNED' AND NEW.status='ATTEMPT_RESERVED' THEN
   IF NEW.settlement_effect_id IS NOT NULL OR NEW.http_status IS NOT NULL OR NEW.response_digest IS NOT NULL OR NEW.settled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invalid external attempt' USING ERRCODE='42501';END IF;id:=NEW.attempt_effect_id;
  ELSIF OLD.status='ATTEMPT_RESERVED' AND NEW.status IN('RESPONSE','UNVERIFIED','NOT_SENT') THEN
   IF NEW.attempt_effect_id IS DISTINCT FROM OLD.attempt_effect_id OR NEW.attempt_reserved_at IS DISTINCT FROM OLD.attempt_reserved_at THEN
    RAISE EXCEPTION 'External attempt binding is immutable' USING ERRCODE='42501';END IF;id:=NEW.settlement_effect_id;
  ELSE RAISE EXCEPTION 'External control history is immutable' USING ERRCODE='42501';END IF;
 END IF;
 SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=id AND status='RESERVED' AND source_id=NEW.source_id
  AND resource_id=NEW.resource_id AND application_id=NEW.application_id AND environment=NEW.environment;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current reserved external control required' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER external_call_history BEFORE INSERT OR UPDATE OR DELETE ON profitia_external_call.calls FOR EACH ROW EXECUTE FUNCTION profitia_external_call.protect_calls();
CREATE TRIGGER external_call_no_truncate BEFORE TRUNCATE ON profitia_external_call.calls FOR EACH STATEMENT EXECUTE FUNCTION profitia_external_call.protect_calls();
CREATE FUNCTION profitia_external_call.control_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF current_user<>'profitia_ingestion_owner' THEN RAISE EXCEPTION 'Controlled external policy owner required' USING ERRCODE='42501';END IF;RETURN NULL;
END $fn$;
CREATE TRIGGER external_policy_no_direct_truncate BEFORE TRUNCATE ON profitia_external_call.policies FOR EACH STATEMENT EXECUTE FUNCTION profitia_external_call.control_truncate();
CREATE TRIGGER external_installation_no_direct_truncate BEFORE TRUNCATE ON profitia_external_call.installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_external_call.control_truncate();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_external_call FROM PUBLIC;
