-- Add bounded HUMAN AM23 to the existing private AM20 ledger and writer.
-- No provider call, command-body retention, queue dispatch or global write.
DO $guard$
BEGIN
  IF current_user <> 'profitia_access_owner' OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user
      AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=oid)
  ) THEN RAISE EXCEPTION 'Controlled request schema owner required' USING ERRCODE='42501'; END IF;
END $guard$;

-- Extend the same private ledger. Old SQL006 remains the base installation.
-- An ACCEPTED receipt grants no provider I/O, queue delivery or global write.
ALTER TABLE profitia_requests.policies DROP CONSTRAINT policies_operation_check;
ALTER TABLE profitia_requests.policies ADD CONSTRAINT policies_operation_check CHECK(operation IN ('forecast.request','supplier.report.refresh'));
ALTER TABLE profitia_requests.intents DROP CONSTRAINT intents_operation_check;
ALTER TABLE profitia_requests.intents ADD CONSTRAINT intents_operation_check CHECK(operation IN ('forecast.request','supplier.report.refresh'));
ALTER TABLE profitia_requests.policies ADD CONSTRAINT request_policy_operation_key UNIQUE(policy_id,application_id,organisation_id,operation);
ALTER TABLE profitia_requests.intents ADD CONSTRAINT intent_policy_operation_fkey FOREIGN KEY(policy_id,application_id,organisation_id,operation)
  REFERENCES profitia_requests.policies(policy_id,application_id,organisation_id,operation);

CREATE TABLE profitia_requests.external_installation (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
ALTER TABLE profitia_requests.external_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_requests.external_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_requests.external_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY runtime_fence ON profitia_requests.external_installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');

CREATE FUNCTION profitia_requests.external_runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; i profitia_requests.external_installation%ROWTYPE;
BEGIN
 d:=profitia_requests.runtime_descriptor();
 SELECT * INTO STRICT i FROM profitia_requests.external_installation WHERE singleton;
 IF d IS NULL OR (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='profitia_requests' AND c.relname IN('installation','policies','intents','external_installation')
   AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity AND c.relowner='profitia_access_owner'::regrole)<>4
 THEN RETURN NULL; END IF;
 RETURN d||jsonb_build_object('externalSchemaVersion',i.schema_version,'externalSchemaDigest',i.schema_digest,'externalSourceRef',i.source_ref);
EXCEPTION WHEN no_data_found OR too_many_rows THEN RETURN NULL;
END $fn$;

CREATE FUNCTION profitia_requests.scope_allows(p_operation text,p_org uuid,p_user uuid,p_resource text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; m text; f text; product_id text;
BEGIN
  d:=profitia_requests.external_runtime_descriptor();
  IF d IS NULL OR p_operation IS NULL OR p_operation NOT IN ('forecast.request','supplier.report.refresh') THEN RETURN false; END IF;
  m:=CASE WHEN p_operation='forecast.request' THEN 'benchmark' ELSE 'supplier_report' END;
  f:=CASE WHEN p_operation='forecast.request' THEN 'forecast' ELSE 'supplier_report' END;
  product_id:=CASE WHEN p_operation='forecast.request' THEN 'SPENDGURU' ELSE 'SUPPLIER_INTELLIGENCE' END;
  IF p_org IS NULL OR p_user IS NULL OR p_resource IS NULL
    OR profitia_access.scope_allows(d->>'applicationId',p_org,p_user) IS NOT TRUE
    OR profitia_modules.scope_allows(m,p_org,p_user) IS NOT TRUE THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id=d->>'applicationId'
      AND organisation_id=p_org AND product=product_id AND status='ACTIVE'
      AND expires_at>clock_timestamp() AND f=ANY(features))
    AND EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=d->>'applicationId'
      AND organisation_id=p_org AND user_id=p_user AND effect='ALLOW'
      AND operation=p_operation AND feature=f AND (resource_id IS NULL OR resource_id=p_resource))
    AND NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=d->>'applicationId'
      AND organisation_id=p_org AND user_id=p_user AND effect='DENY'
      AND operation=p_operation AND feature=f AND (resource_id IS NULL OR resource_id=p_resource));
END $fn$;

CREATE FUNCTION profitia_requests.policy(p_operation text,p_org uuid,p_user uuid,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; p profitia_requests.policies%ROWTYPE;
BEGIN
  d:=profitia_requests.external_runtime_descriptor();
  IF profitia_requests.scope_allows(p_operation,p_org,p_user,p_resource) IS NOT TRUE THEN
    RETURN jsonb_build_object('status','DENIED','reasonCode','PERMISSION_DENIED'); END IF;
  SELECT * INTO p FROM profitia_requests.policies WHERE application_id=d->>'applicationId'
    AND organisation_id=p_org AND operation=p_operation AND status='ACTIVE'
    AND window_start<=clock_timestamp() AND window_end>clock_timestamp() AND expires_at>clock_timestamp()
    FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE'); END IF;
  RETURN jsonb_build_object('status','AVAILABLE','policyId',p.policy_id,'version',p.version::text,
    'sourceRef',p.source_ref,'expiresAt',p.expires_at,'windowStart',p.window_start,'windowEnd',p.window_end,
    'capacity',p.capacity,'used',p.accepted_count,'applicationId',d->>'applicationId',
    'environment',d->>'environment','organisationId',p_org,'operation',p_operation,'transactionId',txid_current()::text);
END $fn$;

CREATE FUNCTION profitia_requests.reserve(p_operation text,p_org uuid,p_user uuid,p_resource text,p_payload text,
  p_key text,p_fingerprint text,p_decision uuid,p_policy uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; p jsonb; r profitia_requests.intents%ROWTYPE; created uuid;
BEGIN
  d:=profitia_requests.external_runtime_descriptor();
  IF d IS NULL OR length(p_resource) NOT BETWEEN 1 AND 256 OR p_payload !~ '^[a-f0-9]{64}$'
    OR p_key !~ '^[a-f0-9]{64}$' OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_decision IS NULL
    OR p_policy IS NULL OR p_version IS NULL THEN RETURN NULL; END IF;
  p:=profitia_requests.policy(p_operation,p_org,p_user,p_resource);
  IF p->>'status'='DENIED' THEN RETURN p; END IF;
  IF p->>'policyId' IS DISTINCT FROM p_policy::text OR p->>'version' IS DISTINCT FROM p_version::text THEN
    RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE'); END IF;
  SELECT * INTO r FROM profitia_requests.intents WHERE key_digest=p_key FOR UPDATE;
  IF NOT FOUND AND (p->>'used')::integer >= (p->>'capacity')::integer THEN
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
  UPDATE profitia_requests.policies SET accepted_count=accepted_count+1 WHERE policy_id=p_policy;
  RETURN jsonb_build_object('status','NEW','requestId',created,'policyId',p_policy,
    'policyVersion',p_version::text,'transactionId',txid_current()::text);
END $fn$;

CREATE FUNCTION profitia_requests.accept(p_operation text,p_id uuid,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r profitia_requests.intents%ROWTYPE; p jsonb;
BEGIN
  SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_id FOR UPDATE;
  IF NOT FOUND OR r.operation IS DISTINCT FROM p_operation OR r.decision_id IS DISTINCT FROM p_decision OR r.status<>'RESERVED'
    OR profitia_requests.scope_allows(p_operation,r.organisation_id,r.user_id,r.resource_id) IS NOT TRUE THEN RETURN NULL; END IF;
  p:=profitia_requests.policy(p_operation,r.organisation_id,r.user_id,r.resource_id);
  IF p->>'status'<>'AVAILABLE' OR p->>'policyId' IS DISTINCT FROM r.policy_id::text
    OR p->>'version' IS DISTINCT FROM r.policy_version::text THEN RETURN NULL; END IF;
  UPDATE profitia_requests.intents SET status='ACCEPTED',receipt=jsonb_build_object('requestId',request_id::text,'status','ACCEPTED')
    WHERE request_id=p_id RETURNING * INTO r;
  RETURN r.receipt;
END $fn$;

-- Preserve old signatures as bounded forecast adapters to the single writer.
CREATE OR REPLACE FUNCTION profitia_requests.scope_allows(p_org uuid,p_user uuid,p_resource text) RETURNS boolean
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $sql$
 SELECT profitia_requests.scope_allows('forecast.request',p_org,p_user,p_resource) $sql$;
CREATE OR REPLACE FUNCTION profitia_requests.policy(p_org uuid,p_user uuid,p_resource text) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $sql$
 SELECT profitia_requests.policy('forecast.request',p_org,p_user,p_resource) $sql$;
CREATE OR REPLACE FUNCTION profitia_requests.reserve(p_org uuid,p_user uuid,p_resource text,p_payload text,
 p_key text,p_fingerprint text,p_decision uuid,p_policy uuid,p_version bigint) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $sql$
 SELECT profitia_requests.reserve('forecast.request',p_org,p_user,p_resource,p_payload,p_key,p_fingerprint,p_decision,p_policy,p_version) $sql$;
CREATE OR REPLACE FUNCTION profitia_requests.accept(p_id uuid,p_decision uuid) RETURNS jsonb
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $sql$
 SELECT profitia_requests.accept('forecast.request',p_id,p_decision) $sql$;
ALTER POLICY intent_read ON profitia_requests.intents USING(profitia_requests.scope_allows(operation,organisation_id,user_id,resource_id));
ALTER POLICY intent_read_fence ON profitia_requests.intents USING(current_user='profitia_access_owner'
 OR profitia_requests.scope_allows(operation,organisation_id,user_id,resource_id));
REVOKE ALL ON profitia_requests.external_installation FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_requests FROM PUBLIC;
