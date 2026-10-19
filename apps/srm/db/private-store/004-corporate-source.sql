-- Optional stored SOURCE boundary. Install as the existing controlled source
-- owner. No role/grant, provider acquisition, seed, account or activation here.
DO $guard$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid)) THEN
  RAISE EXCEPTION 'Controlled source owner required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE SCHEMA profitia_srm_catalog AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_srm_catalog FROM PUBLIC;
CREATE TABLE profitia_srm_catalog.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 version text NOT NULL CHECK(version='srm-corporate-publication-v1'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 field_schema jsonb NOT NULL CHECK(jsonb_typeof(field_schema)='object' AND octet_length(field_schema::text)<65536),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
CREATE TABLE profitia_srm_catalog.publications(
 effect_id uuid PRIMARY KEY REFERENCES profitia_ingestion.effects(effect_id),
 decision_id uuid NOT NULL UNIQUE,nip text NOT NULL CHECK(nip~'^[0-9]{10}$'),
 general_sha256 text NOT NULL,financial_sha256 text NOT NULL,
 body_digest text NOT NULL CHECK(body_digest~'^[a-f0-9]{64}$'),packet jsonb NOT NULL,
 transaction_id bigint NOT NULL DEFAULT txid_current(),recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE profitia_srm_catalog.outcome_witnesses(
 effect_id uuid PRIMARY KEY REFERENCES profitia_srm_catalog.publications(effect_id),
 event_id bigint NOT NULL UNIQUE REFERENCES profitia_ingestion.security_events(event_id),
 transaction_id bigint NOT NULL DEFAULT txid_current()
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','publications','outcome_witnesses'] LOOP
  EXECUTE format('ALTER TABLE profitia_srm_catalog.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_srm_catalog.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_srm_catalog.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY read_fence ON profitia_srm_catalog.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY insert_fence ON profitia_srm_catalog.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY update_fence ON profitia_srm_catalog.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(false) WITH CHECK(false)',t);
  EXECUTE format('CREATE POLICY delete_fence ON profitia_srm_catalog.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false)',t);
 END LOOP;
END $rls$;
CREATE FUNCTION profitia_srm_catalog.immutable() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 RAISE EXCEPTION 'Corporate source evidence is immutable' USING ERRCODE='42501';END $fn$;
DO $immutable$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','publications','outcome_witnesses'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_srm_catalog.%I FOR EACH ROW EXECUTE FUNCTION profitia_srm_catalog.immutable()',t);
  EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_srm_catalog.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_srm_catalog.immutable()',t);
 END LOOP;
END $immutable$;
CREATE FUNCTION profitia_srm_catalog.runtime_descriptor() RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_srm_catalog.installation%ROWTYPE;BEGIN
 d:=profitia_ingestion.runtime_descriptor();
 IF d IS NULL OR d->>'applicationId'<>'srm-corporate-source'
   OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='profitia_srm_catalog' AND c.relkind='r' AND c.relowner='profitia_ingestion_owner'::regrole
         AND c.relrowsecurity AND c.relforcerowsecurity)<>3
   OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='profitia_srm_catalog' AND c.relkind='r'
         AND (has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_srm_catalog.installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('version',i.version,'schemaDigest',i.schema_digest,'fieldSchema',i.field_schema,'sourceRef',i.source_ref);
END $fn$;
-- One closed packet shape, installed from the checked source file and compared
-- by the JS host. Typed business validation/calculation is still the existing
-- SRM implementation, not a second financial engine in SQL.
CREATE FUNCTION profitia_srm_catalog.valid_shape(v jsonb,s jsonb,root jsonb,depth integer DEFAULT 0) RETURNS boolean LANGUAGE plpgsql
IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE rule text;k text;child jsonb;required boolean;BEGIN
 IF v IS NULL OR s IS NULL OR depth>32 THEN RETURN false;END IF;
 IF jsonb_typeof(s)='string' THEN
  rule:=s#>>'{}';
  IF left(rule,1)='@' THEN RETURN profitia_srm_catalog.valid_shape(v,root->substr(rule,2),root,depth+1);END IF;
  IF left(rule,1)='=' THEN RETURN v=to_jsonb(substr(rule,2));END IF;
  IF rule='$bool' THEN RETURN jsonb_typeof(v)='boolean';END IF;
  IF rule='$number' THEN RETURN jsonb_typeof(v)='number';END IF;
  IF jsonb_typeof(v)<>'string' OR length(v#>>'{}')>4096 THEN RETURN false;END IF;
  CASE rule
   WHEN '$nip' THEN RETURN (v#>>'{}')~'^[0-9]{10}$';
   WHEN '$record' THEN RETURN (v#>>'{}')~'^[a-f0-9]{24}$';
   WHEN '$amount' THEN RETURN length(v#>>'{}')<=128 AND (v#>>'{}')~'^-?[0-9]+([.][0-9]+)?$';
   WHEN '$date' THEN RETURN (v#>>'{}')~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND to_char((v#>>'{}')::date,'YYYY-MM-DD')=(v#>>'{}');
   WHEN '$dateTime' THEN RETURN (v#>>'{}')~'^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?Z)?$' AND isfinite((v#>>'{}')::timestamptz);
   WHEN '$timestamp' THEN RETURN (v#>>'{}')~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?Z$' AND isfinite((v#>>'{}')::timestamptz);
   WHEN '$text' THEN RETURN true;
   ELSE RETURN false;
  END CASE;
 END IF;
 IF jsonb_typeof(s)='array' THEN
  IF jsonb_typeof(v)<>'array' OR jsonb_array_length(v)>16384 THEN RETURN false;END IF;
  FOR child IN SELECT value FROM jsonb_array_elements(v) LOOP
   IF profitia_srm_catalog.valid_shape(child,s->0,root,depth+1) IS NOT TRUE THEN RETURN false;END IF;
  END LOOP;RETURN true;
 END IF;
 IF s?'$nullable' THEN RETURN v='null'::jsonb OR profitia_srm_catalog.valid_shape(v,s->'$nullable',root,depth+1);END IF;
 IF jsonb_typeof(s)<>'object' OR jsonb_typeof(v)<>'object' THEN RETURN false;END IF;
 FOR k,child IN SELECT key,value FROM jsonb_each(v) LOOP
  IF NOT(s?k OR s?(k||'?')) OR profitia_srm_catalog.valid_shape(child,coalesce(s->k,s->(k||'?')),root,depth+1) IS NOT TRUE THEN RETURN false;END IF;
 END LOOP;
 FOR k IN SELECT jsonb_object_keys(s) LOOP
  IF right(k,1)<>'?' AND NOT(v?k) THEN RETURN false;END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;END $fn$;
-- JSONB intentionally normalizes object order. Reject duplicate raw keys before
-- parsing; otherwise a digest could attest bytes different from the stored tree.
CREATE FUNCTION profitia_srm_catalog.unique_keys(v json,depth integer DEFAULT 0) RETURNS boolean LANGUAGE plpgsql
IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE child json;BEGIN
 IF depth>32 THEN RETURN false;END IF;
 IF json_typeof(v)='object' THEN
  IF EXISTS(SELECT 1 FROM json_each(v) GROUP BY key HAVING count(*)>1) THEN RETURN false;END IF;
  FOR child IN SELECT value FROM json_each(v) LOOP IF NOT profitia_srm_catalog.unique_keys(child,depth+1) THEN RETURN false;END IF;END LOOP;
 ELSIF json_typeof(v)='array' THEN
  FOR child IN SELECT value FROM json_array_elements(v) LOOP IF NOT profitia_srm_catalog.unique_keys(child,depth+1) THEN RETURN false;END IF;END LOOP;
 END IF;RETURN true;END $fn$;
-- Fixed framing of the ORIGINAL catalog content hash, using raw JSON token
-- slices rather than JSONB's reordered keys or a second canonical serializer.
CREATE FUNCTION profitia_srm_catalog.section_hash(body json,prefix text) RETURNS text LANGUAGE sql
IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT encode(sha256(convert_to('{"status":'||(body->prefix->'status')::text
   ||',"data":'||(body->prefix->'data')::text||',"warnings":'||(body->prefix->'warnings')::text
   ||CASE WHEN prefix='financial' THEN ',"catalogMappingVersion":"2026-10-07-ccc-v2"' ELSE '' END||'}','UTF8')),'hex')
$fn$;
CREATE FUNCTION profitia_srm_catalog.open_publication(p_effect uuid,p_decision uuid,p_body text) RETURNS boolean LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;e profitia_ingestion.effects%ROWTYPE;i profitia_srm_catalog.installation%ROWTYPE;p jsonb;body_hash text;manifest text;BEGIN
 d:=profitia_srm_catalog.runtime_descriptor();
 IF d IS NULL OR p_body IS NULL OR octet_length(p_body)>33554432 OR NOT profitia_srm_catalog.unique_keys(p_body::json) THEN RETURN false;END IF;
 p:=p_body::jsonb;SELECT * INTO STRICT i FROM profitia_srm_catalog.installation WHERE singleton;
 IF profitia_srm_catalog.valid_shape(p,i.field_schema->'packet',i.field_schema) IS NOT TRUE
   OR p->'general'->'data'->>'nip' IS NOT NULL AND p->'general'->'data'->>'nip' IS DISTINCT FROM p->>'nip' THEN RETURN false;END IF;
 body_hash:=encode(sha256(convert_to(p_body,'UTF8')),'hex');
 manifest:='{"content":{"bodyDigest":'||to_json(body_hash)::text||',"nip":'||to_json(p->>'nip')::text
   ||',"version":"srm-corporate-publication-v1"},"sourceId":"srm.catalog.corporate"}';
 SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p_effect;
 IF NOT FOUND OR e.status<>'RESERVED' OR e.decision_id IS DISTINCT FROM p_decision
   OR e.application_id<>'srm-corporate-source' OR e.source_id<>'srm.catalog.corporate'
   OR e.resource_id IS DISTINCT FROM 'srm-corporate:'||(p->>'nip')
   OR e.payload_digest IS DISTINCT FROM encode(sha256(convert_to(manifest,'UTF8')),'hex')
   OR profitia_ingestion.scope_allows(e.source_id,e.resource_id) IS NOT TRUE
   OR e.service_id::text IS DISTINCT FROM profitia_ingestion.runtime_descriptor()->>'serviceId'
   OR EXISTS(SELECT 1 FROM profitia_srm_catalog.publications WHERE transaction_id=txid_current()) THEN RETURN false;END IF;
 INSERT INTO profitia_srm_catalog.publications(effect_id,decision_id,nip,body_digest,packet,general_sha256,financial_sha256)
  VALUES(p_effect,p_decision,p->>'nip',body_hash,p,profitia_srm_catalog.section_hash(p_body::json,'general'),profitia_srm_catalog.section_hash(p_body::json,'financial'));
 PERFORM set_config('profitia.srm.catalog.effect',p_effect::text,true);RETURN true;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;END $fn$;
CREATE FUNCTION profitia_srm_catalog.current_packet(p_nip text,p_write boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p profitia_srm_catalog.publications%ROWTYPE;e profitia_ingestion.effects%ROWTYPE;d jsonb;BEGIN
 IF profitia_srm_catalog.runtime_descriptor() IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO p FROM profitia_srm_catalog.publications WHERE effect_id=nullif(current_setting('profitia.srm.catalog.effect',true),'')::uuid
   AND transaction_id=txid_current() AND nip=p_nip;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p.effect_id;
 d:=profitia_ingestion.runtime_descriptor();
 IF e.status NOT IN('RESERVED','COMMITTED') OR p_write AND e.status<>'RESERVED'
   OR e.decision_id IS DISTINCT FROM p.decision_id OR e.application_id IS DISTINCT FROM d->>'applicationId'
   OR e.service_id::text IS DISTINCT FROM d->>'serviceId'
   OR profitia_ingestion.scope_allows(e.source_id,e.resource_id) IS NOT TRUE THEN RETURN NULL;END IF;
 RETURN p.packet||jsonb_build_object('effectId',p.effect_id::text,'expectedHashes',jsonb_build_object('general',p.general_sha256,'financial',p.financial_sha256));
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;
CREATE FUNCTION profitia_srm_catalog.valid_stored_section(p_nip text,prefix text,section jsonb) RETURNS boolean LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE i profitia_srm_catalog.installation%ROWTYPE;p jsonb;BEGIN
 p:=profitia_srm_catalog.current_packet(p_nip,true);
 IF p IS NULL OR prefix NOT IN('general','financial') THEN RETURN false;END IF;
 SELECT * INTO STRICT i FROM profitia_srm_catalog.installation WHERE singleton;
 RETURN profitia_srm_catalog.valid_shape(section-'catalogMappingVersion',i.field_schema->'packet'->prefix,i.field_schema)
   AND (section-ARRAY['source','retrievedAt','effectiveAt','catalogMappingVersion'])
      IS NOT DISTINCT FROM ((p->prefix)-ARRAY['source','retrievedAt','effectiveAt'])
   AND (prefix<>'financial' OR section->>'catalogMappingVersion'='2026-10-07-ccc-v2');
END $fn$;
CREATE FUNCTION profitia_srm_catalog.scope_allows(p_nip text,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT profitia_srm_catalog.current_packet(p_nip,p_write) IS NOT NULL
$fn$;
CREATE FUNCTION profitia_srm_catalog.known_proof(p_nip text,p_effect uuid) RETURNS boolean LANGUAGE sql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT profitia_srm_catalog.scope_allows(p_nip) AND EXISTS(
  SELECT 1 FROM profitia_srm_catalog.publications p JOIN profitia_ingestion.effects e USING(effect_id)
  WHERE p.nip=p_nip AND p.effect_id=p_effect AND (e.status='COMMITTED' OR p.transaction_id=txid_current()))
$fn$;
-- A PostgreSQL EXCEPTION block uses a child XID. xmin is therefore not a
-- reliable top-level transaction witness. Capture txid_current() at the real
-- immutable journal insertion instead of inferring it from a row's xmin.
CREATE FUNCTION profitia_srm_catalog.capture_outcome() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF NEW.application_id='srm-corporate-source' AND NEW.phase='OUTCOME' THEN
  INSERT INTO profitia_srm_catalog.outcome_witnesses(effect_id,event_id)
   SELECT p.effect_id,NEW.event_id FROM profitia_srm_catalog.publications p
    JOIN profitia_ingestion.effects e ON e.effect_id=p.effect_id
   WHERE p.decision_id=NEW.decision_id AND p.transaction_id=txid_current()
    AND e.status='COMMITTED' AND e.payload_digest=NEW.event->>'payloadDigest' AND NEW.event->>'decision'='ALLOW';
 END IF;RETURN NULL;END $fn$;
CREATE TRIGGER corporate_outcome_witness AFTER INSERT ON profitia_ingestion.security_events
 FOR EACH ROW EXECUTE FUNCTION profitia_srm_catalog.capture_outcome();
CREATE FUNCTION profitia_srm_catalog.require_outcome() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF NEW.transaction_id<>txid_current() OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.effects e
   JOIN profitia_srm_catalog.outcome_witnesses w ON w.effect_id=e.effect_id AND w.transaction_id=txid_current()
   JOIN profitia_ingestion.security_events a ON a.event_id=w.event_id AND a.decision_id=e.decision_id AND a.application_id=e.application_id AND a.environment=e.environment
   WHERE e.effect_id=NEW.effect_id AND e.status='COMMITTED' AND e.decision_id=NEW.decision_id
     AND a.phase='OUTCOME' AND a.event->>'decision'='ALLOW' AND a.event->>'payloadDigest'=e.payload_digest)
   OR srm.corporate_publication_complete(NEW.nip,NEW.effect_id) IS NOT TRUE THEN
  RAISE EXCEPTION 'Committed corporate publication and same transaction OUTCOME required' USING ERRCODE='42501';END IF;
 RETURN NULL;END $fn$;
CREATE CONSTRAINT TRIGGER corporate_publication_outcome AFTER INSERT ON profitia_srm_catalog.publications
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION profitia_srm_catalog.require_outcome();
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_srm_catalog FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_srm_catalog FROM PUBLIC;
