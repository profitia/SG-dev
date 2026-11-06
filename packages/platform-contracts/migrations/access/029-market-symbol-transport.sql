-- Optional MARKET_SYMBOL transport v1.0.0, proposal only until owner adoption.
-- Existing API_PATH grammar/digest/policies are unchanged. No grant or network I/O.
DO $guard$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
   OR NOT EXISTS(SELECT 1 FROM profitia_external_api_path.installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='bd35367f22eccb34dc6c8f62b3a82bfc8947471142fc5daab45a32d67c07707c')
   OR to_regnamespace('profitia_public_web') IS NOT NULL OR to_regclass('profitia_external_native.gus_slots') IS NOT NULL THEN
  RAISE EXCEPTION 'Exact native/API_PATH owner baseline required'; END IF;
END $guard$;
-- Existing active policies cannot name this new parameter. Their scopes are not
-- rewritten or disabled by installing this independently admitted descriptor.
CREATE SCHEMA profitia_external_market_symbol AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_external_market_symbol FROM PUBLIC;
CREATE TABLE profitia_external_market_symbol.installation(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL);
ALTER TABLE profitia_external_market_symbol.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_external_market_symbol.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_external_market_symbol.installation TO profitia_ingestion_owner USING(current_user='profitia_ingestion_owner') WITH CHECK(current_user='profitia_ingestion_owner');
REVOKE ALL ON profitia_external_market_symbol.installation FROM PUBLIC;
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
       OR jsonb_typeof(r->'parameter') IS DISTINCT FROM 'string' OR r->>'parameter' NOT IN('HEX24','UUID','OPAQUE','STORAGE_PATH','API_PATH','MARKET_SYMBOL')
       OR r->>'parameter'='MARKET_SYMBOL' AND (r->>'method'<>'GET' OR r->>'requestFormat'<>'NONE' OR r->>'prefix' NOT IN('/markets/historical/','/markets/symbol/','/markets/forecasts/symbol/') OR r->>'suffix'<>'')
       OR r->>'parameter'='API_PATH' AND (r->>'method'<>'GET' OR r->>'requestFormat'<>'NONE')
       OR r->>'prefix' LIKE '%..%' OR r->>'suffix' LIKE '%..%' OR r->>'prefix' LIKE '%//%' OR r->>'suffix' LIKE '%//%' THEN RETURN false; END IF;
   END IF;
 END LOOP;
 RETURN (SELECT count(*) FROM jsonb_array_elements(v))=(SELECT count(DISTINCT items.value) FROM jsonb_array_elements(v) AS items(value));
END $fn$;
CREATE OR REPLACE FUNCTION profitia_external_native.descriptor(p_source text,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_external_native.installation%ROWTYPE;p profitia_external_native.policies%ROWTYPE; api_digest text; market_digest text;BEGIN
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
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p.path_rules) r WHERE r->>'parameter'='API_PATH') THEN
  SELECT schema_digest INTO api_digest FROM profitia_external_api_path.installation WHERE singleton AND schema_version='1.0.0';
  IF api_digest IS NULL OR has_schema_privilege(session_user,'profitia_external_api_path','CREATE') OR has_table_privilege(session_user,'profitia_external_api_path.installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN RETURN NULL; END IF;
  d:=d||jsonb_build_object('apiPathSchemaVersion','1.0.0','apiPathSchemaDigest',api_digest);
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p.path_rules) r WHERE r->>'parameter'='MARKET_SYMBOL') THEN
  SELECT schema_digest INTO market_digest FROM profitia_external_market_symbol.installation WHERE singleton AND schema_version='1.0.0';
  IF market_digest IS NULL OR has_schema_privilege(session_user,'profitia_external_market_symbol','CREATE') OR has_table_privilege(session_user,'profitia_external_market_symbol.installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') THEN RETURN NULL; END IF;
  d:=d||jsonb_build_object('marketSymbolSchemaVersion','1.0.0','marketSymbolSchemaDigest',market_digest);
 END IF;
 RETURN d||jsonb_build_object('nativeSchemaVersion',i.schema_version,'nativeSchemaDigest',i.schema_digest,
   'nativePolicyVersion',p.version::text,'nativePathRules',p.path_rules,'nativeRedirectOrigins',p.redirect_origins,
   'nativeMaximumResponseBytes',p.maximum_response_bytes,'nativeCredentialMode',p.credential_mode,
   'nativeCompletionMode',p.completion_mode,'nativeSourceRef',p.source_ref,'nativeExpiresAt',p.expires_at);
END $fn$;
