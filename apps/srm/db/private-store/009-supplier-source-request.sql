-- Optional closed Supplier Source admission. Install under the existing
-- controlled Source owner; no grants, activation, provider calls or customer
-- data here. The accepted Root effects table IS the request record. These
-- two tables attest installation and same-transaction canonical OUTCOME only.
DO $guard$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid)) THEN
  RAISE EXCEPTION 'Controlled Source owner required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE SCHEMA profitia_srm_acquisition AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_srm_acquisition FROM PUBLIC;
CREATE TABLE profitia_srm_acquisition.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 version text NOT NULL CHECK(version='srm-supplier-source-request-v1'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 root_schema_digest text NOT NULL CHECK(root_schema_digest~'^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
CREATE TABLE profitia_srm_acquisition.outcome_witnesses(
 effect_id uuid PRIMARY KEY REFERENCES profitia_ingestion.effects(effect_id),
 event_id bigint NOT NULL UNIQUE REFERENCES profitia_ingestion.security_events(event_id),
 transaction_id bigint NOT NULL DEFAULT txid_current()
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','outcome_witnesses'] LOOP
  EXECUTE format('ALTER TABLE profitia_srm_acquisition.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_srm_acquisition.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_srm_acquisition.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY read_fence ON profitia_srm_acquisition.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY insert_fence ON profitia_srm_acquisition.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
  EXECUTE format('CREATE POLICY update_fence ON profitia_srm_acquisition.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(false) WITH CHECK(false)',t);
  EXECUTE format('CREATE POLICY delete_fence ON profitia_srm_acquisition.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false)',t);
 END LOOP;
END $rls$;
CREATE FUNCTION profitia_srm_acquisition.immutable() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 RAISE EXCEPTION 'Supplier Source control evidence is immutable' USING ERRCODE='42501';END $fn$;
DO $immutable$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','outcome_witnesses'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_srm_acquisition.%I FOR EACH ROW EXECUTE FUNCTION profitia_srm_acquisition.immutable()',t);
  EXECUTE format('CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_srm_acquisition.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_srm_acquisition.immutable()',t);
 END LOOP;
END $immutable$;
CREATE FUNCTION profitia_srm_acquisition.runtime_descriptor() RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_srm_acquisition.installation%ROWTYPE;BEGIN
 d:=profitia_ingestion.runtime_descriptor();
 IF d IS NULL OR d->>'applicationId' IS DISTINCT FROM 'srm-provider-source'
   OR has_schema_privilege(session_user,'profitia_srm_acquisition','CREATE')
   OR has_schema_privilege(session_user,'profitia_ingestion','CREATE')
   OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='profitia_srm_acquisition' AND c.relkind='r' AND c.relowner='profitia_ingestion_owner'::regrole
         AND c.relrowsecurity AND c.relforcerowsecurity)<>2
   OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='profitia_srm_acquisition' AND c.relkind='r'
         AND (has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_srm_acquisition.installation WHERE singleton;
 IF NOT FOUND OR i.root_schema_digest IS DISTINCT FROM d->>'schemaDigest'
   OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.sources WHERE source_id='srm.supplier.source-request'
    AND status='ACTIVE' AND expires_at>clock_timestamp() AND effect_kind='STORED_SQL_TRANSACTION'
    AND data_class='SHARED_KNOWLEDGE' AND payload_schema='supplier-command-v1'
    AND quality_version='srm-supplier-source-request-v1' AND classification_version='srm-supplier-source-request-control-v1'
    AND projection_version='source-request-v1') THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('version',i.version,'schemaDigest',i.schema_digest,'rootSchemaDigest',i.root_schema_digest,'sourceRef',i.source_ref);
END $fn$;
-- All variable content is a validated ten-digit NIP. The command's canonical
-- Root envelope is reconstructible; no second command/dispatch ledger exists.
CREATE FUNCTION profitia_srm_acquisition.command_digest(p_nip text) RETURNS text LANGUAGE sql
IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT CASE WHEN p_nip~'^[0-9]{10}$' AND p_nip<>'0000000000' THEN encode(sha256(convert_to(
  '{"content":{"kind":"SUPPLIER_REPORT","nip":"'||p_nip||'"},"sourceId":"srm.supplier.source-request"}','UTF8')),'hex') END
$fn$;
CREATE FUNCTION profitia_srm_acquisition.admit(p_nip text,p_effect uuid,p_decision uuid) RETURNS boolean LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;e profitia_ingestion.effects%ROWTYPE;BEGIN
 IF profitia_srm_acquisition.runtime_descriptor() IS NULL
   OR profitia_ingestion.scope_allows('srm.supplier.source-request',p_nip) IS NOT TRUE THEN RETURN false;END IF;
 d:=profitia_ingestion.runtime_descriptor();SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p_effect;
 RETURN coalesce(e.source_id='srm.supplier.source-request' AND e.resource_id=p_nip
  AND e.status='RESERVED' AND e.decision_id=p_decision AND e.application_id=d->>'applicationId'
  AND e.environment=d->>'environment' AND e.service_id::text=d->>'serviceId'
  AND e.payload_digest=profitia_srm_acquisition.command_digest(p_nip),false);
END $fn$;
CREATE FUNCTION profitia_srm_acquisition.capture_outcome() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF NEW.application_id='srm-provider-source' AND NEW.phase='OUTCOME' THEN
  INSERT INTO profitia_srm_acquisition.outcome_witnesses(effect_id,event_id)
   SELECT e.effect_id,NEW.event_id FROM profitia_ingestion.effects e
    WHERE e.source_id='srm.supplier.source-request' AND e.decision_id=NEW.decision_id
     AND e.application_id=NEW.application_id AND e.environment=NEW.environment AND e.status='COMMITTED'
     AND e.payload_digest=NEW.event->>'payloadDigest' AND NEW.event->>'decision'='ALLOW';
 END IF;RETURN NULL;END $fn$;
CREATE TRIGGER supplier_source_outcome_witness AFTER INSERT ON profitia_ingestion.security_events
 FOR EACH ROW EXECUTE FUNCTION profitia_srm_acquisition.capture_outcome();
CREATE FUNCTION profitia_srm_acquisition.require_outcome() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF NEW.source_id='srm.supplier.source-request' AND (profitia_srm_acquisition.runtime_descriptor() IS NULL
   OR profitia_ingestion.scope_allows(NEW.source_id,NEW.resource_id) IS NOT TRUE
   OR NEW.payload_digest IS DISTINCT FROM profitia_srm_acquisition.command_digest(NEW.resource_id)
   OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.effects e
    JOIN profitia_srm_acquisition.outcome_witnesses w ON w.effect_id=e.effect_id AND w.transaction_id=txid_current()
    JOIN profitia_ingestion.security_events a ON a.event_id=w.event_id AND a.decision_id=e.decision_id
      AND a.application_id=e.application_id AND a.environment=e.environment
    WHERE e.effect_id=NEW.effect_id AND e.status='COMMITTED' AND e.decision_id=NEW.decision_id
     AND a.phase='OUTCOME' AND a.event->>'decision'='ALLOW' AND a.event->>'payloadDigest'=e.payload_digest)) THEN
  RAISE EXCEPTION 'Committed Supplier Source and same transaction OUTCOME required' USING ERRCODE='42501';END IF;
 RETURN NULL;END $fn$;
CREATE CONSTRAINT TRIGGER supplier_source_requires_outcome AFTER INSERT ON profitia_ingestion.effects
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION profitia_srm_acquisition.require_outcome();
CREATE FUNCTION profitia_srm_acquisition.receipt(p_nip text,p_key text) RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r jsonb;BEGIN
 IF profitia_srm_acquisition.runtime_descriptor() IS NULL THEN RETURN NULL;END IF;
 r:=profitia_ingestion.receipt('srm.supplier.source-request',p_nip,p_key,profitia_srm_acquisition.command_digest(p_nip));
 IF r IS NULL OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.effects e
   JOIN profitia_srm_acquisition.outcome_witnesses w ON w.effect_id=e.effect_id
   JOIN profitia_ingestion.security_events a ON a.event_id=w.event_id AND a.decision_id=e.decision_id
    AND a.application_id=e.application_id AND a.environment=e.environment
   WHERE e.effect_id::text=r->>'effectId' AND e.status='COMMITTED' AND a.phase='OUTCOME'
    AND a.event->>'decision'='ALLOW' AND a.event->>'payloadDigest'=e.payload_digest) THEN RETURN NULL;END IF;
 RETURN r;
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_srm_acquisition FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_srm_acquisition FROM PUBLIC;
