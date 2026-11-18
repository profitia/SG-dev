-- SQL034: explicit benchmark UNMETERED over the ordinary E1 request ledger.
-- SQL027 and its supplier descriptor/digest remain unchanged. No grant is seeded.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication) AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
 OR NOT EXISTS(SELECT 1 FROM profitia_requests.quota_installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='88c5014db027c40568fcc737acbcf27766bb5db1c434c32ce6c236af859d90ef')
 OR coalesce(current_setting('profitia.install.benchmark_quota_digest',true),'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Controlled owner and explicit SQL034 digest required' USING ERRCODE='42501'; END IF;
END $guard$;
LOCK TABLE profitia_requests.policies,profitia_requests.intents IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE profitia_requests.benchmark_quota_installation (LIKE profitia_requests.quota_installation INCLUDING ALL);
ALTER TABLE profitia_requests.benchmark_quota_installation DROP CONSTRAINT quota_installation_schema_version_check;
ALTER TABLE profitia_requests.benchmark_quota_installation ADD CONSTRAINT benchmark_quota_version CHECK(schema_version='1.1.0');
CREATE TABLE profitia_requests.benchmark_quota_defaults(application_id text PRIMARY KEY REFERENCES profitia_access.applications(application_id),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256));
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['benchmark_quota_installation','benchmark_quota_defaults'] LOOP
 EXECUTE format('ALTER TABLE profitia_requests.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE profitia_requests.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY controlled_owner ON profitia_requests.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format('CREATE POLICY controlled_fence ON profitia_requests.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
 END LOOP;END $rls$;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_requests.benchmark_quota_installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_requests.benchmark_quota_installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
INSERT INTO profitia_requests.benchmark_quota_installation VALUES(true,'1.1.0',current_setting('profitia.install.benchmark_quota_digest'),'SQL034_EXPLICIT_BENCHMARK_QUOTA_MODE');
ALTER TABLE profitia_requests.policies DROP CONSTRAINT supplier_unmetered_mode;
ALTER TABLE profitia_requests.policies ADD CONSTRAINT supplier_unmetered_mode CHECK(quota_mode<>'UNMETERED' OR operation IN('supplier.report.refresh','supplier.private.refresh','benchmark.discovery.request'));
ALTER TABLE profitia_requests.policies ALTER COLUMN accepted_count TYPE bigint;
CREATE OR REPLACE FUNCTION profitia_requests.immutable_policy() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND current_user='profitia_access_owner' AND OLD.status='ACTIVE' AND NEW.status='ACTIVE'
  AND OLD.operation IN('supplier.report.refresh','supplier.private.refresh','benchmark.discovery.request')
  AND OLD.quota_mode IN('FIXED','UNMETERED') AND NEW.quota_mode IN('FIXED','UNMETERED') AND NEW.quota_mode<>OLD.quota_mode
  AND NEW.version=OLD.version+1 AND length(NEW.source_ref) BETWEEN 1 AND 256
  AND(to_jsonb(NEW)-ARRAY['quota_mode','version','source_ref'])=(to_jsonb(OLD)-ARRAY['quota_mode','version','source_ref']) THEN
  INSERT INTO profitia_requests.quota_mode_events(policy_id,previous_mode,quota_mode,previous_version,version,accepted_count,source_ref)
   VALUES(OLD.policy_id,OLD.quota_mode,NEW.quota_mode,OLD.version,NEW.version,OLD.accepted_count,NEW.source_ref);
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' OR(to_jsonb(NEW)-'status'-'accepted_count') IS DISTINCT FROM(to_jsonb(OLD)-'status'-'accepted_count') OR OLD.status='REVOKED'
  OR NOT((NEW.status=OLD.status AND NEW.accepted_count=OLD.accepted_count+1) OR(NEW.status='REVOKED' AND NEW.accepted_count=OLD.accepted_count)) THEN
  RAISE EXCEPTION 'Request policy definition and counter are immutable' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION profitia_requests.benchmark_quota_runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_requests.benchmark_quota_installation%ROWTYPE;t text;BEGIN
 d:=profitia_requests.quota_runtime_descriptor();IF d IS NULL THEN RETURN NULL;END IF;
 FOREACH t IN ARRAY ARRAY['benchmark_quota_installation','benchmark_quota_defaults','quota_mode_events','policies','intents'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('profitia_requests.'||t) AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'profitia_requests.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'profitia_requests.'||t,'INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 END LOOP;
 SELECT * INTO i FROM profitia_requests.benchmark_quota_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('quotaSchemaVersion',i.schema_version,'quotaSchemaDigest',i.schema_digest,'quotaSourceRef',i.source_ref);
END $fn$;
CREATE FUNCTION profitia_requests.benchmark_quota_policy(p_operation text,p_org uuid,p_user uuid,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;p profitia_requests.policies%ROWTYPE;v jsonb;b profitia_requests.benchmark_quota_defaults%ROWTYPE;BEGIN
 d:=profitia_requests.benchmark_quota_runtime_descriptor();
 IF d IS NULL OR p_operation NOT IN('benchmark.discovery.request') OR profitia_requests.scope_allows(p_operation,p_org,p_user,p_resource) IS NOT TRUE THEN
  RETURN jsonb_build_object('status','DENIED','reasonCode','PERMISSION_DENIED');END IF;
 -- This owner quota default grants no product, module or user entitlement.
 SELECT * INTO b FROM profitia_requests.benchmark_quota_defaults WHERE application_id=d->>'applicationId' AND status='ACTIVE';
 IF FOUND AND NOT EXISTS(SELECT 1 FROM profitia_requests.policies WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND operation=p_operation) THEN
  INSERT INTO profitia_requests.policies(policy_id,application_id,organisation_id,operation,status,source_ref,window_start,window_end,expires_at,capacity,quota_mode)
   VALUES(gen_random_uuid(),d->>'applicationId',p_org,p_operation,'ACTIVE',b.source_ref,now(),now()+interval '1 day',now()+interval '1 day',1,'UNMETERED') ON CONFLICT DO NOTHING;
 END IF;
 -- A current owner default also covers organisations entitled after installation.
 IF b.status='ACTIVE' THEN
  UPDATE profitia_requests.policies SET quota_mode='UNMETERED',version=version+1,source_ref=b.source_ref WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND operation=p_operation AND status='ACTIVE' AND quota_mode='FIXED';
 END IF;
 SELECT * INTO p FROM profitia_requests.policies WHERE application_id=d->>'applicationId' AND organisation_id=p_org
  AND operation=p_operation AND status='ACTIVE' FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE');END IF;
 IF p.quota_mode<>'UNMETERED' THEN
  v:=profitia_requests.policy(p_operation,p_org,p_user,p_resource);
  IF v->>'status'<>'AVAILABLE' THEN RETURN v;END IF;
  RETURN v||jsonb_build_object('quotaMode','FIXED','quotaSchemaDigest',d->>'quotaSchemaDigest');
 END IF;
 RETURN jsonb_build_object('status','AVAILABLE','policyId',p.policy_id,'version',p.version::text,'sourceRef',p.source_ref,
  'expiresAt',NULL,'windowStart',NULL,'windowEnd',NULL,'capacity',NULL,'used',p.accepted_count,
  'applicationId',d->>'applicationId','environment',d->>'environment','organisationId',p_org,'operation',p_operation,
  'transactionId',txid_current()::text,'quotaMode','UNMETERED','quotaSchemaDigest',d->>'quotaSchemaDigest');
END $fn$;
CREATE FUNCTION profitia_requests.benchmark_quota_reserve(p_operation text,p_org uuid,p_user uuid,p_resource text,p_payload text,
  p_key text,p_fingerprint text,p_decision uuid,p_policy uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; p jsonb; r profitia_requests.intents%ROWTYPE; created uuid;
BEGIN
  d:=profitia_requests.benchmark_quota_runtime_descriptor();
  IF p_operation NOT IN('benchmark.discovery.request') THEN RETURN NULL; END IF;
  IF d IS NULL OR length(p_resource) NOT BETWEEN 1 AND 256 OR p_payload !~ '^[a-f0-9]{64}$'
    OR p_key !~ '^[a-f0-9]{64}$' OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_decision IS NULL
    OR p_policy IS NULL OR p_version IS NULL THEN RETURN NULL; END IF;
  p:=profitia_requests.benchmark_quota_policy(p_operation,p_org,p_user,p_resource);
  IF p->>'status'='DENIED' THEN RETURN p; END IF;
  IF p->>'policyId' IS DISTINCT FROM p_policy::text OR p->>'version' IS DISTINCT FROM p_version::text THEN
    RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE'); END IF;
  SELECT * INTO r FROM profitia_requests.intents WHERE key_digest=p_key FOR UPDATE;
  IF NOT FOUND AND p->>'quotaMode'<>'UNMETERED' AND (p->>'used')::bigint >= (p->>'capacity')::bigint THEN
    RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_EXCEEDED'); END IF;
  INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,
    organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status)
    VALUES(gen_random_uuid(),p_key,p_fingerprint,d->>'applicationId',d->>'environment',p_org,p_user,
      p_operation,p_resource,p_payload,p_policy,p_version,p_decision,'RESERVED')
    ON CONFLICT(key_digest) DO NOTHING RETURNING request_id INTO created;
  IF created IS NULL THEN
    SELECT * INTO STRICT r FROM profitia_requests.intents WHERE key_digest=p_key FOR UPDATE;
    IF r.application_id IS DISTINCT FROM d->>'applicationId' OR r.environment IS DISTINCT FROM d->>'environment'
      OR r.organisation_id IS DISTINCT FROM p_org OR r.user_id IS DISTINCT FROM p_user
      OR r.operation IS DISTINCT FROM p_operation OR r.resource_id IS DISTINCT FROM p_resource
      OR r.payload_digest IS DISTINCT FROM p_payload OR r.binding_fingerprint IS DISTINCT FROM p_fingerprint THEN
      RETURN jsonb_build_object('status','DENIED','reasonCode','IDEMPOTENCY_CONFLICT'); END IF;
    IF r.status<>'ACCEPTED' THEN RETURN NULL; END IF;
    RETURN jsonb_build_object('status','REPLAY','requestId',r.request_id,'value',r.receipt,
      'policyId',p_policy,'policyVersion',p_version::text,'transactionId',txid_current()::text);
  END IF;
  UPDATE profitia_requests.policies SET accepted_count=accepted_count+1 WHERE policy_id=p_policy AND quota_mode IN('FIXED','UNMETERED');
  RETURN jsonb_build_object('status','NEW','requestId',created,'policyId',p_policy,
    'policyVersion',p_version::text,'transactionId',txid_current()::text);
END $fn$;
CREATE FUNCTION profitia_requests.benchmark_quota_accept(p_operation text,p_id uuid,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r profitia_requests.intents%ROWTYPE; p jsonb;
BEGIN
  IF p_operation NOT IN('benchmark.discovery.request') OR profitia_requests.benchmark_quota_runtime_descriptor() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_id FOR UPDATE;
  IF NOT FOUND OR r.operation IS DISTINCT FROM p_operation OR r.decision_id IS DISTINCT FROM p_decision OR r.status<>'RESERVED'
    OR profitia_requests.scope_allows(p_operation,r.organisation_id,r.user_id,r.resource_id) IS NOT TRUE THEN RETURN NULL; END IF;
  p:=profitia_requests.benchmark_quota_policy(p_operation,r.organisation_id,r.user_id,r.resource_id);
  IF p->>'status'<>'AVAILABLE' OR p->>'policyId' IS DISTINCT FROM r.policy_id::text
    OR p->>'version' IS DISTINCT FROM r.policy_version::text THEN RETURN NULL; END IF;
  UPDATE profitia_requests.intents SET status='ACCEPTED',receipt=jsonb_build_object('requestId',request_id::text,'status','ACCEPTED')
    WHERE request_id=p_id RETURNING * INTO r;
  RETURN r.receipt;
END $fn$;
REVOKE ALL ON profitia_requests.benchmark_quota_installation,profitia_requests.benchmark_quota_defaults FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_requests.benchmark_quota_runtime_descriptor(),profitia_requests.benchmark_quota_policy(text,uuid,uuid,text),profitia_requests.benchmark_quota_reserve(text,uuid,uuid,text,text,text,text,uuid,uuid,bigint),profitia_requests.benchmark_quota_accept(text,uuid,uuid) FROM PUBLIC;
-- Controlled owner installation for existing and subsequently entitled orgs.
-- Version review is complete; history and counts remain in the same ledger.
CREATE FUNCTION profitia_requests.activate_benchmark_unmetered(p_app text,p_basis text,p_versions jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE versions jsonb;basis text;
BEGIN
 IF current_user<>'profitia_access_owner' OR p_app IS NULL OR p_basis IS NULL OR p_basis!~'^owner-decision:sha256:[a-f0-9]{64}$' OR jsonb_typeof(p_versions) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Explicit controlled benchmark owner decision required' USING ERRCODE='42501';END IF;
 LOCK TABLE profitia_requests.policies IN SHARE ROW EXCLUSIVE MODE;
 SELECT coalesce(jsonb_object_agg(policy_id::text,version::text),'{}'::jsonb) INTO versions FROM profitia_requests.policies WHERE application_id=p_app AND operation='benchmark.discovery.request' AND status='ACTIVE';
 IF versions IS DISTINCT FROM p_versions THEN RAISE EXCEPTION 'Benchmark policies changed since owner review' USING ERRCODE='40001';END IF;
 SELECT source_ref INTO basis FROM profitia_requests.benchmark_quota_defaults WHERE application_id=p_app AND status='ACTIVE';
 IF FOUND AND basis<>p_basis THEN RAISE EXCEPTION 'Existing benchmark owner default must be preserved' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM profitia_requests.benchmark_quota_defaults WHERE application_id=p_app AND status='REVOKED') THEN RAISE EXCEPTION 'Benchmark owner default was revoked' USING ERRCODE='42501';END IF;
 INSERT INTO profitia_requests.benchmark_quota_defaults VALUES(p_app,'ACTIVE',p_basis) ON CONFLICT DO NOTHING;
 UPDATE profitia_requests.policies SET quota_mode='UNMETERED',version=version+1,source_ref=p_basis WHERE application_id=p_app AND operation='benchmark.discovery.request' AND status='ACTIVE' AND quota_mode='FIXED';
 RETURN jsonb_build_object('status','ACTIVE','quotaMode','UNMETERED');
END $fn$;
REVOKE ALL ON FUNCTION profitia_requests.activate_benchmark_unmetered(text,text,jsonb) FROM PUBLIC;
