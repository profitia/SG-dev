-- Optional PUBLIC_WEB mode over the SAME Source external control engine.
-- No HTTP, grants, raw URLs/bodies, additional effect ledger or activation.
DO $owner$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_external_call.installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206')
  OR NOT EXISTS(SELECT 1 FROM profitia_external_native.installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='6faff5f258b71cf2525d705c8fcf38c8aef9331c4e8f0bdd6f1af74e6cf76bde')
  OR EXISTS(SELECT 1 FROM profitia_ingestion.runtime_bindings WHERE status='ACTIVE') THEN
  RAISE EXCEPTION 'Exact controlled disabled Source installation required' USING ERRCODE='42501';END IF;
END $owner$;
CREATE SCHEMA profitia_public_web AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_public_web FROM PUBLIC;
ALTER TABLE profitia_external_call.policies ALTER COLUMN origin DROP NOT NULL;
ALTER TABLE profitia_external_call.policies DROP CONSTRAINT policies_transport_check;
ALTER TABLE profitia_external_call.policies ADD CONSTRAINT external_transport_mode CHECK(transport IN('HTTPS','LOCAL_SYNTHETIC_HTTP','PUBLIC_WEB'));
DO $origin$ DECLARE c record;n integer:=0;a smallint;b smallint;BEGIN
 SELECT attnum INTO a FROM pg_attribute WHERE attrelid='profitia_external_call.policies'::regclass AND attname='origin';
 SELECT attnum INTO b FROM pg_attribute WHERE attrelid='profitia_external_call.policies'::regclass AND attname='transport';
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='profitia_external_call.policies'::regclass AND contype='c'
  AND conkey @> ARRAY[a,b]::smallint[] LOOP
  n:=n+1;EXECUTE format('ALTER TABLE profitia_external_call.policies DROP CONSTRAINT %I',c.conname);
 END LOOP;
 IF n<>1 THEN RAISE EXCEPTION 'Exact original network-origin constraint required' USING ERRCODE='42501';END IF;
END $origin$;
ALTER TABLE profitia_external_call.policies ADD CONSTRAINT external_network_origin CHECK(
 transport='HTTPS' AND origin IS NOT NULL AND origin~'^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'
 OR transport='LOCAL_SYNTHETIC_HTTP' AND origin IS NOT NULL AND source_ref='SYNTHETIC_ONLY' AND origin~'^http://127\.0\.0\.1:[0-9]{1,5}$'
 OR transport='PUBLIC_WEB' AND origin IS NULL AND path_rules='[{"method":"GET","path":"/"}]'::jsonb
  AND maximum_request_bytes<=8192 AND maximum_response_bytes<=2000000 AND timeout_ms<=8000);
CREATE OR REPLACE FUNCTION profitia_external_native.valid_rules(v jsonb) RETURNS boolean
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
       OR jsonb_typeof(r->'parameter') IS DISTINCT FROM 'string' OR r->>'parameter' NOT IN('HEX24','UUID','OPAQUE','STORAGE_PATH','PUBLIC_PATH')
       OR r->>'parameter'='PUBLIC_PATH' AND(r->>'method'<>'GET' OR r->>'prefix'<>'/' OR r->>'suffix'<>'' OR r->>'requestFormat'<>'NONE')
       OR r->>'prefix' LIKE '%..%' OR r->>'suffix' LIKE '%..%' OR r->>'prefix' LIKE '%//%' OR r->>'suffix' LIKE '%//%' THEN RETURN false; END IF;
   END IF;
 END LOOP;
 RETURN (SELECT count(*) FROM jsonb_array_elements(v))=(SELECT count(DISTINCT items.value) FROM jsonb_array_elements(v) AS items(value));
END $fn$;
CREATE TABLE profitia_public_web.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_public_web.policies(
 policy_id uuid PRIMARY KEY REFERENCES profitia_external_call.policies(policy_id),
 base_policy_version bigint NOT NULL CHECK(base_policy_version>0),
 maximum_redirects integer NOT NULL CHECK(maximum_redirects=4),
 synthetic_origin text CHECK(synthetic_origin IS NULL OR synthetic_origin~'^http://127\.0\.0\.1:[0-9]{1,5}$'),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
 CHECK(synthetic_origin IS NULL OR source_ref='SYNTHETIC_ONLY')
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','policies'] LOOP
  EXECUTE format('ALTER TABLE profitia_public_web.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_public_web.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_public_web.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY read_fence ON profitia_public_web.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY insert_fence ON profitia_public_web.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY update_fence ON profitia_public_web.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user=''profitia_ingestion_owner'') WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY delete_fence ON profitia_public_web.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false)',t);
 END LOOP;
END $rls$;
CREATE FUNCTION profitia_public_web.immutable_installation() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN RAISE EXCEPTION 'Public network installation is immutable' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER immutable_installation BEFORE UPDATE OR DELETE ON profitia_public_web.installation
 FOR EACH ROW EXECUTE FUNCTION profitia_public_web.immutable_installation();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON profitia_public_web.installation
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_public_web.immutable_installation();
CREATE TRIGGER no_truncate BEFORE TRUNCATE ON profitia_public_web.policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_public_web.immutable_installation();
CREATE FUNCTION profitia_public_web.policy_change() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_external_call.policies%ROWTYPE;n profitia_external_native.policies%ROWTYPE;i profitia_ingestion.installation%ROWTYPE;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Public network policy history is immutable' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM profitia_external_call.policies WHERE policy_id=NEW.policy_id FOR SHARE;
 IF NOT FOUND OR p.transport<>'PUBLIC_WEB' OR p.origin IS NOT NULL OR p.version<>NEW.base_policy_version
  OR NEW.expires_at>p.expires_at THEN RAISE EXCEPTION 'Exact public network parent required' USING ERRCODE='42501';END IF;
 SELECT * INTO n FROM profitia_external_native.policies WHERE policy_id=p.policy_id AND base_policy_version=p.version;
 IF NOT FOUND OR n.path_rules<>'[{"method":"GET","prefix":"/","parameter":"PUBLIC_PATH","suffix":"","requestFormat":"NONE"}]'::jsonb
  OR n.credential_mode<>'NONE' OR n.redirect_origins<>'[]'::jsonb OR n.maximum_response_bytes<>p.maximum_response_bytes
  OR n.expires_at<NEW.expires_at THEN RAISE EXCEPTION 'Exact credential-free public native policy required' USING ERRCODE='42501';END IF;
 IF NEW.synthetic_origin IS NOT NULL THEN
  SELECT * INTO i FROM profitia_ingestion.installation WHERE singleton;
  IF NOT FOUND OR i.environment<>'development' OR p.source_ref<>'SYNTHETIC_ONLY' OR n.source_ref<>'SYNTHETIC_ONLY'
   OR NEW.source_ref<>'SYNTHETIC_ONLY' THEN RAISE EXCEPTION 'Development synthetic-only authority required' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF(to_jsonb(NEW)-ARRAY['status','version','expires_at']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['status','version','expires_at']) THEN
   RAISE EXCEPTION 'Public network policy definition is immutable' USING ERRCODE='42501';END IF;
  NEW.version:=OLD.version+1;
 END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER public_policy_change BEFORE INSERT OR UPDATE OR DELETE ON profitia_public_web.policies
 FOR EACH ROW EXECUTE FUNCTION profitia_public_web.policy_change();
CREATE FUNCTION profitia_public_web.descriptor(p_source text,p_resource text) RETURNS jsonb LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_public_web.installation%ROWTYPE;p profitia_public_web.policies%ROWTYPE;BEGIN
 d:=profitia_external_native.descriptor(p_source,p_resource);
 IF d IS NULL OR current_user<>'profitia_ingestion_owner' OR d->>'transport'<>'PUBLIC_WEB' OR d->'origin'<>'null'::jsonb
  OR d->>'nativeCredentialMode'<>'NONE' OR d->'nativeRedirectOrigins'<>'[]'::jsonb
  OR d->'nativePathRules'<>'[{"method":"GET","prefix":"/","parameter":"PUBLIC_PATH","suffix":"","requestFormat":"NONE"}]'::jsonb
  OR(d->>'nativeMaximumResponseBytes')::integer<>(d->>'maximumResponseBytes')::integer THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_public_web.installation WHERE singleton;
 IF NOT FOUND OR i.schema_version<>'1.0.0'
  OR(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_public_web'
   AND c.relkind='r'AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner='profitia_ingestion_owner'::regrole)<>2
  OR has_schema_privilege(session_user,'profitia_public_web','CREATE')
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_public_web'AND c.relkind='r'
   AND(has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RETURN NULL;END IF;
 SELECT * INTO p FROM profitia_public_web.policies WHERE policy_id=(d->>'policyId')::uuid
  AND base_policy_version=(d->>'policyVersion')::bigint AND status='ACTIVE'AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND OR p.synthetic_origin IS NOT NULL AND(d->>'environment'<>'development'OR p.source_ref<>'SYNTHETIC_ONLY'OR d->>'sourceRef'<>'SYNTHETIC_ONLY'
  OR d->>'nativeSourceRef'<>'SYNTHETIC_ONLY') THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('publicWebSchemaVersion',i.schema_version,'publicWebSchemaDigest',i.schema_digest,
  'publicWebPolicyVersion',p.version::text,'publicWebMaximumRedirects',p.maximum_redirects,'publicWebSyntheticOrigin',p.synthetic_origin,
  'publicWebSourceRef',p.source_ref,'publicWebExpiresAt',p.expires_at);
END $fn$;
CREATE OR REPLACE FUNCTION profitia_external_native.permits_status(p_policy uuid,p_status integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_external_call.policies%ROWTYPE;d jsonb;BEGIN
 SELECT * INTO p FROM profitia_external_call.policies WHERE policy_id=p_policy;IF NOT FOUND THEN RETURN false;END IF;
 IF p.transport='PUBLIC_WEB' THEN
  d:=profitia_public_web.descriptor(p.source_id,p.resource_id);
  RETURN d IS NOT NULL AND d->>'policyId'=p_policy::text AND p_status IN(301,302,303,307,308);
 END IF;
 d:=profitia_external_native.descriptor(p.source_id,p.resource_id);
 RETURN d IS NOT NULL AND d->>'policyId'=p_policy::text
  AND(p_status=304 OR p_status IN(301,302,303,307,308) AND jsonb_array_length(d->'nativeRedirectOrigins')>0);
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_public_web FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_public_web FROM PUBLIC;
