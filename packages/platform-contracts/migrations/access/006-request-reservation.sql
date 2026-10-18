-- Additive private AM20 request intent. No command payload, queue dispatch,
-- provider call, global write or computation is implemented by this ledger.
DO $guard$
BEGIN
  IF current_user <> 'profitia_access_owner' OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user
      AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=oid)
  ) THEN RAISE EXCEPTION 'Controlled request schema owner required' USING ERRCODE='42501'; END IF;
END $guard$;

CREATE SCHEMA profitia_requests AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_requests FROM PUBLIC;
CREATE TABLE profitia_requests.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_requests.policies (
  policy_id uuid PRIMARY KEY,
  application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
  organisation_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),
  operation text NOT NULL CHECK(operation='forecast.request'),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  window_start timestamptz NOT NULL CHECK(isfinite(window_start)),
  window_end timestamptz NOT NULL CHECK(isfinite(window_end)),
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
  capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 1000000),
  accepted_count integer NOT NULL DEFAULT 0 CHECK(accepted_count>=0 AND accepted_count<=capacity),
  CHECK(window_start<window_end AND expires_at<=window_end),
  UNIQUE(policy_id,application_id,organisation_id)
);
CREATE UNIQUE INDEX one_active_request_policy ON profitia_requests.policies(application_id,organisation_id,operation) WHERE status='ACTIVE';
CREATE TABLE profitia_requests.intents (
  request_id uuid PRIMARY KEY,
  key_digest text NOT NULL UNIQUE CHECK(key_digest ~ '^[a-f0-9]{64}$'),
  binding_fingerprint text NOT NULL CHECK(binding_fingerprint ~ '^[a-f0-9]{64}$'),
  application_id text NOT NULL,
  environment text NOT NULL CHECK(environment IN ('development','staging','production')),
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  operation text NOT NULL CHECK(operation='forecast.request'),
  resource_id text NOT NULL CHECK(length(resource_id) BETWEEN 1 AND 256),
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  policy_id uuid NOT NULL,
  policy_version bigint NOT NULL CHECK(policy_version>0),
  decision_id uuid NOT NULL,
  status text NOT NULL CHECK(status IN ('RESERVED','ACCEPTED')),
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(request_id,application_id,environment,organisation_id,user_id,payload_digest),
  FOREIGN KEY(organisation_id,user_id) REFERENCES profitia_access.memberships(organisation_id,user_id),
  FOREIGN KEY(policy_id,application_id,organisation_id) REFERENCES profitia_requests.policies(policy_id,application_id,organisation_id),
  CHECK((status='RESERVED' AND receipt IS NULL) OR (status='ACCEPTED'
    AND receipt=jsonb_build_object('requestId',request_id::text,'status','ACCEPTED')))
);

-- Runtime table DML remains denied even after an accidental broad GRANT.
-- Only guarded functions execute as the controlled NOLOGIN owner.
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['installation','policies','intents'] LOOP
    EXECUTE format('ALTER TABLE profitia_requests.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_requests.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_requests.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
    EXECUTE format('CREATE POLICY immutable_runtime_insert ON profitia_requests.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_access_owner'')',t);
    EXECUTE format('CREATE POLICY immutable_runtime_update ON profitia_requests.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
    EXECUTE format('CREATE POLICY immutable_runtime_delete ON profitia_requests.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user=''profitia_access_owner'')',t);
  END LOOP;
END $rls$;
CREATE POLICY private_policy_read_fence ON profitia_requests.policies AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='profitia_access_owner');
CREATE POLICY private_installation_read_fence ON profitia_requests.installation AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='profitia_access_owner');

CREATE FUNCTION profitia_requests.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; i profitia_requests.installation%ROWTYPE;
BEGIN
  d:=profitia_access.runtime_descriptor();
  SELECT * INTO STRICT i FROM profitia_requests.installation WHERE singleton;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='profitia_access_owner'
    AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
    AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=oid))
    OR (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='profitia_requests' AND c.relname IN('installation','policies','intents')
        AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
        AND c.relowner='profitia_access_owner'::regrole)<>3 THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,
    'sourceRef',i.source_ref,'applicationId',d->>'applicationId','environment',d->>'environment',
    'projectId',d->>'projectId','branchId',d->>'branchId','databaseName',current_database(),
    'role',session_user,'owner','profitia_access_owner');
EXCEPTION WHEN no_data_found OR too_many_rows THEN RETURN NULL;
END $fn$;

CREATE FUNCTION profitia_requests.scope_allows(p_org uuid,p_user uuid,p_resource text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;
BEGIN
  d:=profitia_access.runtime_descriptor();
  IF p_org IS NULL OR p_user IS NULL OR p_resource IS NULL
    OR profitia_access.scope_allows(d->>'applicationId',p_org,p_user) IS NOT TRUE
    OR profitia_modules.scope_allows('benchmark',p_org,p_user) IS NOT TRUE THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id=d->>'applicationId'
      AND organisation_id=p_org AND product='SPENDGURU' AND status='ACTIVE'
      AND expires_at>clock_timestamp() AND 'forecast'=ANY(features))
    AND EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=d->>'applicationId'
      AND organisation_id=p_org AND user_id=p_user AND effect='ALLOW'
      AND operation='forecast.request' AND feature='forecast' AND (resource_id IS NULL OR resource_id=p_resource))
    AND NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=d->>'applicationId'
      AND organisation_id=p_org AND user_id=p_user AND effect='DENY'
      AND operation='forecast.request' AND feature='forecast' AND (resource_id IS NULL OR resource_id=p_resource));
END $fn$;

CREATE POLICY intent_read ON profitia_requests.intents FOR SELECT TO PUBLIC USING(
  profitia_requests.scope_allows(organisation_id,user_id,resource_id));
CREATE POLICY intent_read_fence ON profitia_requests.intents AS RESTRICTIVE FOR SELECT TO PUBLIC USING(
  current_user='profitia_access_owner' OR profitia_requests.scope_allows(organisation_id,user_id,resource_id));

CREATE FUNCTION profitia_requests.policy(p_org uuid,p_user uuid,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; p profitia_requests.policies%ROWTYPE;
BEGIN
  d:=profitia_access.runtime_descriptor();
  IF profitia_requests.scope_allows(p_org,p_user,p_resource) IS NOT TRUE THEN
    RETURN jsonb_build_object('status','DENIED','reasonCode','PERMISSION_DENIED'); END IF;
  SELECT * INTO p FROM profitia_requests.policies WHERE application_id=d->>'applicationId'
    AND organisation_id=p_org AND operation='forecast.request' AND status='ACTIVE'
    AND window_start<=clock_timestamp() AND window_end>clock_timestamp() AND expires_at>clock_timestamp()
    FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE'); END IF;
  RETURN jsonb_build_object('status','AVAILABLE','policyId',p.policy_id,'version',p.version::text,
    'sourceRef',p.source_ref,'expiresAt',p.expires_at,'windowStart',p.window_start,'windowEnd',p.window_end,
    'capacity',p.capacity,'used',p.accepted_count,'applicationId',d->>'applicationId',
    'environment',d->>'environment','organisationId',p_org,'operation','forecast.request','transactionId',txid_current()::text);
END $fn$;

CREATE FUNCTION profitia_requests.reserve(p_org uuid,p_user uuid,p_resource text,p_payload text,
  p_key text,p_fingerprint text,p_decision uuid,p_policy uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; p jsonb; r profitia_requests.intents%ROWTYPE; created uuid;
BEGIN
  d:=profitia_requests.runtime_descriptor();
  IF d IS NULL OR length(p_resource) NOT BETWEEN 1 AND 256 OR p_payload !~ '^[a-f0-9]{64}$'
    OR p_key !~ '^[a-f0-9]{64}$' OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_decision IS NULL
    OR p_policy IS NULL OR p_version IS NULL THEN RETURN NULL; END IF;
  p:=profitia_requests.policy(p_org,p_user,p_resource);
  IF p->>'status'='DENIED' THEN RETURN p; END IF;
  IF p->>'policyId' IS DISTINCT FROM p_policy::text OR p->>'version' IS DISTINCT FROM p_version::text THEN
    RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE'); END IF;
  SELECT * INTO r FROM profitia_requests.intents WHERE key_digest=p_key FOR UPDATE;
  IF NOT FOUND AND (p->>'used')::integer >= (p->>'capacity')::integer THEN
    RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_EXCEEDED'); END IF;
  INSERT INTO profitia_requests.intents(request_id,key_digest,binding_fingerprint,application_id,environment,
    organisation_id,user_id,operation,resource_id,payload_digest,policy_id,policy_version,decision_id,status)
    VALUES(gen_random_uuid(),p_key,p_fingerprint,d->>'applicationId',d->>'environment',p_org,p_user,
      'forecast.request',p_resource,p_payload,p_policy,p_version,p_decision,'RESERVED')
    ON CONFLICT(key_digest) DO NOTHING RETURNING request_id INTO created;
  IF created IS NULL THEN
    SELECT * INTO STRICT r FROM profitia_requests.intents WHERE key_digest=p_key FOR UPDATE;
    IF r.application_id IS DISTINCT FROM d->>'applicationId' OR r.environment IS DISTINCT FROM d->>'environment'
      OR r.organisation_id IS DISTINCT FROM p_org OR r.user_id IS DISTINCT FROM p_user
      OR r.operation<>'forecast.request' OR r.resource_id IS DISTINCT FROM p_resource
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

CREATE FUNCTION profitia_requests.accept(p_id uuid,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r profitia_requests.intents%ROWTYPE; p jsonb;
BEGIN
  SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_id FOR UPDATE;
  IF NOT FOUND OR r.decision_id IS DISTINCT FROM p_decision OR r.status<>'RESERVED'
    OR profitia_requests.scope_allows(r.organisation_id,r.user_id,r.resource_id) IS NOT TRUE THEN RETURN NULL; END IF;
  p:=profitia_requests.policy(r.organisation_id,r.user_id,r.resource_id);
  IF p->>'status'<>'AVAILABLE' OR p->>'policyId' IS DISTINCT FROM r.policy_id::text
    OR p->>'version' IS DISTINCT FROM r.policy_version::text THEN RETURN NULL; END IF;
  UPDATE profitia_requests.intents SET status='ACCEPTED',receipt=jsonb_build_object('requestId',request_id::text,'status','ACCEPTED')
    WHERE request_id=p_id RETURNING * INTO r;
  RETURN r.receipt;
END $fn$;

CREATE FUNCTION profitia_requests.immutable_policy() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-'status'-'accepted_count') IS DISTINCT FROM
      (to_jsonb(OLD)-'status'-'accepted_count') OR OLD.status='REVOKED'
    OR NOT ((NEW.status=OLD.status AND NEW.accepted_count=OLD.accepted_count+1)
      OR (NEW.status='REVOKED' AND NEW.accepted_count=OLD.accepted_count)) THEN
    RAISE EXCEPTION 'Request policy definition and counter are immutable' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER immutable_policy BEFORE UPDATE OR DELETE ON profitia_requests.policies
  FOR EACH ROW EXECUTE FUNCTION profitia_requests.immutable_policy();

CREATE FUNCTION profitia_requests.immutable_intent() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_OP='DELETE' OR OLD.status='ACCEPTED' OR NEW.request_id IS DISTINCT FROM OLD.request_id
    OR (to_jsonb(NEW)-'status'-'receipt') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'receipt')
    OR NEW.status<>'ACCEPTED' THEN RAISE EXCEPTION 'Request intent is immutable' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER immutable_intent BEFORE UPDATE OR DELETE ON profitia_requests.intents
  FOR EACH ROW EXECUTE FUNCTION profitia_requests.immutable_intent();
CREATE FUNCTION profitia_requests.require_accepted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
  IF EXISTS(SELECT 1 FROM profitia_requests.intents WHERE request_id=NEW.request_id AND status<>'ACCEPTED') THEN
    RAISE EXCEPTION 'Unaccepted request cannot commit' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER require_accepted AFTER INSERT OR UPDATE ON profitia_requests.intents
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION profitia_requests.require_accepted();
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_requests FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_requests FROM PUBLIC;
