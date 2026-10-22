-- P1 SOURCE ONLY: optional SQL020; no role, key, policy, grant or activation is seeded.
-- Same E1 intent ledger. The separate receiver key attests server-owned current
-- parent reads inside this SQL transaction; SQL credentials/GUCs cannot mint it.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR EXISTS(SELECT 1 FROM profitia_access.applications WHERE status<>'DISABLED')
  OR NOT EXISTS(SELECT 1 FROM profitia_requests.location_installation WHERE singleton AND schema_version='1.0.0'
    AND schema_digest='34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5')
  OR to_regprocedure('public.hmac(bytea,bytea,text)') IS NULL THEN
  RAISE EXCEPTION 'Controlled disabled installation, exact SQL019 and preinstalled HMAC required' USING ERRCODE='42501'; END IF;
END $guard$;
CREATE TABLE profitia_requests.location_admission_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_requests.location_admission_receivers(
 login_role name PRIMARY KEY REFERENCES profitia_access.runtime_bindings(login_role),
 enabled boolean NOT NULL DEFAULT false,proof_key bytea NOT NULL CHECK(octet_length(proof_key)=32)
);
DO $rls$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['location_admission_installation','location_admission_receivers'] LOOP
  EXECUTE format('ALTER TABLE profitia_requests.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_requests.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_requests.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY receiver_fence ON profitia_requests.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
 END LOOP;
END $rls$;
CREATE TRIGGER immutable_admission_installation BEFORE UPDATE OR DELETE ON profitia_requests.location_admission_installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_admission_truncate BEFORE TRUNCATE ON profitia_requests.location_admission_installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER admission_receiver_revision BEFORE INSERT OR UPDATE OR DELETE ON profitia_requests.location_admission_receivers FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
ALTER TABLE profitia_requests.policies ADD COLUMN quota_mode text NOT NULL DEFAULT 'FIXED' CHECK(quota_mode IN('FIXED','ROLLING_24H'));
DO $counter$ DECLARE c name;BEGIN
 SELECT conname INTO STRICT c FROM pg_constraint WHERE conrelid='profitia_requests.policies'::regclass AND contype='c'
  AND pg_get_constraintdef(oid) LIKE '%accepted_count >= 0%' AND pg_get_constraintdef(oid) LIKE '%accepted_count <= capacity%';
 EXECUTE format('ALTER TABLE profitia_requests.policies DROP CONSTRAINT %I',c);
END $counter$;
ALTER TABLE profitia_requests.policies ALTER COLUMN accepted_count TYPE bigint;
ALTER TABLE profitia_requests.policies ADD CONSTRAINT accepted_count_by_mode CHECK(accepted_count>=0 AND(quota_mode='ROLLING_24H' OR accepted_count<=capacity));
ALTER TABLE profitia_requests.policies ADD CONSTRAINT location_rolling_capacity CHECK(quota_mode='FIXED' OR(operation IN('supplier.location.write','supplier.location.sync') AND capacity=100));
ALTER TABLE profitia_requests.intents ADD COLUMN accepted_at timestamptz CHECK(accepted_at IS NULL OR isfinite(accepted_at));
ALTER TABLE profitia_requests.intents ADD COLUMN location_admission jsonb CHECK(location_admission IS NULL OR octet_length(location_admission::text)<=24576);
CREATE INDEX location_rolling_accepted ON profitia_requests.intents(environment,organisation_id,operation,accepted_at) WHERE status='ACCEPTED';

CREATE FUNCTION profitia_requests.location_admission_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; i profitia_requests.location_admission_installation%ROWTYPE; t text; BEGIN
 d:=profitia_requests.location_runtime_descriptor();
 IF d IS NULL OR NOT EXISTS(SELECT 1 FROM profitia_requests.location_admission_receivers WHERE login_role=session_user AND enabled) THEN RETURN NULL; END IF;
 FOREACH t IN ARRAY ARRAY['location_admission_installation','location_admission_receivers','policies','intents'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('profitia_requests.'||t) AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'profitia_requests.'||t,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'profitia_requests.'||t,'INSERT,UPDATE,REFERENCES') THEN RETURN NULL; END IF;
 END LOOP;
 IF has_table_privilege(session_user,'profitia_requests.location_admission_receivers','SELECT')
  OR has_any_column_privilege(session_user,'profitia_requests.location_admission_receivers','SELECT') THEN RETURN NULL; END IF;
 SELECT * INTO i FROM profitia_requests.location_admission_installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN d||jsonb_build_object('admissionSchemaVersion',i.schema_version,'admissionSchemaDigest',i.schema_digest,'admissionSourceRef',i.source_ref);
END $fn$;
CREATE FUNCTION profitia_requests.location_admission_current() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;a jsonb;s text;k bytea;ms bigint;BEGIN
 d:=profitia_requests.location_admission_descriptor();a:=nullif(current_setting('profitia.location.admission',true),'')::jsonb;
 s:=current_setting('profitia.location.admission_signature',true);ms:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
 IF d IS NULL OR a IS NULL OR s IS NULL OR s!~'^[a-f0-9]{64}$' THEN RETURN false; END IF;
 IF(profitia_requests.location_shape(a,ARRAY['contractVersion','projectId','branchId','databaseName','schemaDigest','environment','applicationId','role','transactionId','operation','organisationId','userId','resourceId','payloadDigest','action','evidence','parent','expiresAt'])
  AND a->>'contractVersion'='1.0.0' AND a->>'projectId'=d->>'projectId' AND a->>'branchId'=d->>'branchId'
  AND a->>'databaseName'=current_database() AND a->>'schemaDigest'=d->>'admissionSchemaDigest' AND a->>'environment'=d->>'environment' AND a->>'applicationId'=d->>'applicationId'
  AND a->>'role'=session_user::text AND a->>'transactionId'=txid_current()::text
  AND a->>'operation' IN('supplier.location.write','supplier.location.sync') AND (a->>'organisationId')::uuid IS NOT NULL AND(a->>'userId')::uuid IS NOT NULL
  AND a->>'payloadDigest'~'^[a-f0-9]{64}$' AND length(a->>'resourceId') BETWEEN 1 AND 256
  AND(a->>'expiresAt')::bigint>ms AND(a->>'expiresAt')::bigint<=ms+5000
  AND profitia_requests.location_shape(a->'parent',ARRAY['supplierId','organisationId','collectionId','version'])
  AND a->'parent'->>'supplierId'=a->'evidence'->>'supplierId' AND a->'parent'->>'organisationId'=a->>'organisationId'
  AND a->'parent'->>'collectionId'='supplier-locations:'||(a->'evidence'->>'supplierId') AND length(a->'parent'->>'version') BETWEEN 1 AND 256
  AND profitia_requests.location_evidence_current(a->'evidence',d->>'applicationId',(a->>'organisationId')::uuid,(a->>'userId')::uuid)) IS NOT TRUE THEN RETURN false; END IF;
 IF a->>'operation'='supplier.location.write' THEN
  IF a->>'action' NOT IN('CREATE','UPDATE','DEACTIVATE') OR a->'evidence'->>'origin'<>'MANUAL' OR a->'evidence'->>'group'<>'USER_LOCATIONS'
   OR a->'evidence'->>'locationId' IS DISTINCT FROM a->>'resourceId' OR a->'evidence'->'executorApplicationId'<>'null'::jsonb THEN RETURN false; END IF;
 ELSE
  IF a->>'action'<>'SYNC' OR a->'evidence'->>'origin'<>'COLLECTION' OR a->'evidence'->'locationId'<>'null'::jsonb
   OR a->>'resourceId' IS DISTINCT FROM a->'parent'->>'collectionId' THEN RETURN false; END IF;
 END IF;
 SELECT proof_key INTO k FROM profitia_requests.location_admission_receivers WHERE login_role=session_user AND enabled;
 RETURN s=encode(public.hmac(convert_to(a::text,'UTF8'),k,'sha256'),'hex');
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $fn$;
CREATE FUNCTION profitia_requests.bind_location_admission(p jsonb,p_signature text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 PERFORM set_config('profitia.location.admission',coalesce(p::text,''),true),set_config('profitia.location.admission_signature',coalesce(p_signature,''),true);
 IF profitia_requests.location_admission_current() IS NOT TRUE THEN
  PERFORM set_config('profitia.location.admission','',true),set_config('profitia.location.admission_signature','',true);RETURN false;
 END IF;
 RETURN true;
END $fn$;
CREATE FUNCTION profitia_requests.location_quota_lock(p_org uuid,p_operation text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF p_org IS NULL OR p_operation NOT IN('supplier.location.write','supplier.location.sync') THEN RAISE EXCEPTION 'Bounded location quota required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('profitia.location-budget@1:'||(SELECT environment FROM profitia_access.installation WHERE singleton)||':'||p_org::text||':'||p_operation,0));
END $fn$;
CREATE FUNCTION profitia_requests.location_rolling_used(p_org uuid,p_operation text,p_at timestamptz) RETURNS bigint
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT count(*) FROM profitia_requests.intents WHERE environment=(SELECT environment FROM profitia_access.installation WHERE singleton)
 AND organisation_id=p_org AND operation=p_operation AND status='ACCEPTED' AND accepted_at>p_at-interval '24 hours' AND accepted_at<=p_at
$fn$;
-- No runtime EXECUTE grant is provided for the internal aggregate/time parameter.
CREATE FUNCTION profitia_requests.location_policy_rotation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF NEW.operation IN('supplier.location.write','supplier.location.sync') THEN PERFORM profitia_requests.location_quota_lock(NEW.organisation_id,NEW.operation); END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER a_location_policy_rotation BEFORE INSERT OR UPDATE ON profitia_requests.policies FOR EACH ROW EXECUTE FUNCTION profitia_requests.location_policy_rotation();
CREATE FUNCTION profitia_requests.capture_location_admission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF NEW.operation IN('supplier.location.write','supplier.location.sync') AND profitia_requests.location_admission_current() THEN
  NEW.location_admission:=current_setting('profitia.location.admission',true)::jsonb;
  IF NEW.location_admission->>'operation' IS DISTINCT FROM NEW.operation OR NEW.location_admission->>'organisationId' IS DISTINCT FROM NEW.organisation_id::text
   OR NEW.location_admission->>'userId' IS DISTINCT FROM NEW.user_id::text OR NEW.location_admission->>'resourceId' IS DISTINCT FROM NEW.resource_id
   OR NEW.location_admission->>'payloadDigest' IS DISTINCT FROM NEW.payload_digest THEN RAISE EXCEPTION 'Admission binding mismatch' USING ERRCODE='42501'; END IF;
 ELSIF EXISTS(SELECT 1 FROM profitia_requests.policies WHERE policy_id=NEW.policy_id AND quota_mode='ROLLING_24H') OR NEW.location_admission IS NOT NULL THEN
  RAISE EXCEPTION 'Fresh server admission required' USING ERRCODE='42501';
 END IF;
 IF NEW.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Acceptance clock is database-owned' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER location_admission_capture BEFORE INSERT ON profitia_requests.intents FOR EACH ROW EXECUTE FUNCTION profitia_requests.capture_location_admission();
CREATE FUNCTION profitia_requests.location_acceptance_clock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE t timestamptz;m text;BEGIN
 IF OLD.status='RESERVED' AND NEW.status='ACCEPTED' AND NEW.operation IN('supplier.location.write','supplier.location.sync') THEN
  PERFORM profitia_requests.location_quota_lock(NEW.organisation_id,NEW.operation);t:=clock_timestamp();
  SELECT quota_mode INTO m FROM profitia_requests.policies WHERE policy_id=NEW.policy_id;
  IF m='ROLLING_24H' THEN
   IF current_setting('transaction_isolation')<>'read committed' OR NOT profitia_requests.location_admission_current()
    OR NEW.location_admission IS DISTINCT FROM current_setting('profitia.location.admission',true)::jsonb THEN
    RAISE EXCEPTION 'Current READ COMMITTED server admission required' USING ERRCODE='42501'; END IF;
   IF EXISTS(SELECT 1 FROM profitia_requests.intents WHERE environment=NEW.environment AND organisation_id=NEW.organisation_id AND operation=NEW.operation AND status='ACCEPTED' AND accepted_at IS NULL) THEN
    RAISE EXCEPTION 'Unknown historical acceptance time' USING ERRCODE='42501'; END IF;
   IF profitia_requests.location_rolling_used(NEW.organisation_id,NEW.operation,t)>=100 THEN RAISE EXCEPTION 'Moving quota exceeded' USING ERRCODE='PT429'; END IF;
  ELSIF EXISTS(SELECT 1 FROM profitia_requests.policies WHERE organisation_id=NEW.organisation_id AND operation=NEW.operation AND quota_mode='ROLLING_24H') THEN
   RAISE EXCEPTION 'Organisation rolling budget cannot downgrade' USING ERRCODE='42501';
  END IF;
  NEW.accepted_at:=t;
 ELSIF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at THEN RAISE EXCEPTION 'Acceptance time immutable' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER a_location_acceptance_clock BEFORE UPDATE ON profitia_requests.intents FOR EACH ROW EXECUTE FUNCTION profitia_requests.location_acceptance_clock();
CREATE OR REPLACE FUNCTION profitia_requests.immutable_intent() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF TG_OP='DELETE' OR OLD.status='ACCEPTED' OR NEW.request_id IS DISTINCT FROM OLD.request_id
  OR(to_jsonb(NEW)-'status'-'receipt'-'accepted_at') IS DISTINCT FROM(to_jsonb(OLD)-'status'-'receipt'-'accepted_at') OR NEW.status<>'ACCEPTED' THEN
  RAISE EXCEPTION 'Request intent immutable' USING ERRCODE='42501'; END IF;RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION profitia_requests.location_access(p_operation text,p_org uuid,p_user uuid,p_resource text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; a jsonb;BEGIN
 d:=profitia_requests.location_runtime_descriptor();
 a:=nullif(current_setting('profitia.location.admission',true),'')::jsonb;
 RETURN d IS NOT NULL AND p_operation IN('supplier.location.read','supplier.location.write','supplier.location.sync','supplier.location.geocode')
  AND profitia_access.scope_allows(d->>'applicationId',p_org,p_user) IS TRUE AND profitia_modules.scope_allows('supplier_report',p_org,p_user) IS TRUE
  AND EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND product='SUPPLIER_INTELLIGENCE' AND status='ACTIVE' AND expires_at>clock_timestamp() AND 'supplier_report'=ANY(features))
  AND CASE WHEN profitia_requests.location_admission_current() AND a->>'action'='CREATE' THEN
    p_operation='supplier.location.write' AND a->>'resourceId'=p_resource AND a->>'organisationId'=p_org::text AND a->>'userId'=p_user::text
    AND EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND user_id=p_user
      AND operation=p_operation AND feature='supplier_report' AND effect='ALLOW' AND resource_id=a->'parent'->>'collectionId')
    AND NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND user_id=p_user
      AND operation=p_operation AND feature='supplier_report' AND effect='DENY' AND (resource_id IS NULL OR resource_id IN(p_resource,a->'parent'->>'collectionId')))
  ELSE profitia_requests.location_permission(d->>'applicationId',p_org,p_user,p_operation,p_resource) END;
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $fn$;
CREATE OR REPLACE FUNCTION profitia_requests.location_bound_current(p_operation text,p_org uuid,p_user uuid,p_resource text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;p jsonb;BEGIN
 d:=profitia_requests.location_runtime_descriptor();p:=nullif(current_setting('profitia.location.scope',true),'')::jsonb;
 RETURN d IS NOT NULL AND current_setting('profitia.location.operation',true)=p_operation AND current_setting('profitia.location.organisation',true)=p_org::text
  AND current_setting('profitia.location.user',true)=p_user::text AND current_setting('profitia.location.resource',true)=p_resource
  AND current_setting('profitia.location.transaction',true)=txid_current()::text AND profitia_requests.location_evidence_current(p,d->>'applicationId',p_org,p_user)
  AND (nullif(current_setting('profitia.location.admission',true),'') IS NULL OR
    (profitia_requests.location_admission_current() AND (current_setting('profitia.location.admission',true)::jsonb->'evidence')=p
      AND current_setting('profitia.location.payload',true)=current_setting('profitia.location.admission',true)::jsonb->>'payloadDigest'));
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $fn$;
CREATE OR REPLACE FUNCTION profitia_requests.policy(p_operation text,p_org uuid,p_user uuid,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; p profitia_requests.policies%ROWTYPE; used_count bigint;
BEGIN
  d:=profitia_requests.external_runtime_descriptor();
  IF profitia_requests.scope_allows(p_operation,p_org,p_user,p_resource) IS NOT TRUE THEN
    RETURN jsonb_build_object('status','DENIED','reasonCode','PERMISSION_DENIED'); END IF;
  IF p_operation IN('supplier.location.write','supplier.location.sync') THEN PERFORM profitia_requests.location_quota_lock(p_org,p_operation); END IF;
  SELECT * INTO p FROM profitia_requests.policies WHERE application_id=d->>'applicationId'
    AND organisation_id=p_org AND operation=p_operation AND status='ACTIVE'
    AND window_start<=clock_timestamp() AND window_end>clock_timestamp() AND expires_at>clock_timestamp()
    FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE'); END IF;
  IF p.operation IN('supplier.location.write','supplier.location.sync') THEN
    IF p.quota_mode='ROLLING_24H' THEN
      IF NOT profitia_requests.location_admission_current() THEN RETURN jsonb_build_object('status','DENIED','reasonCode','PERMISSION_DENIED'); END IF;
      IF EXISTS(SELECT 1 FROM profitia_requests.intents WHERE environment=d->>'environment' AND organisation_id=p_org AND operation=p_operation AND status='ACCEPTED' AND accepted_at IS NULL) THEN
        RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE'); END IF;
      used_count:=profitia_requests.location_rolling_used(p_org,p_operation,clock_timestamp());
    ELSIF EXISTS(SELECT 1 FROM profitia_requests.policies WHERE organisation_id=p_org AND operation=p_operation AND quota_mode='ROLLING_24H') THEN
      RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE');
    END IF;
  END IF;
  RETURN jsonb_build_object('status','AVAILABLE','policyId',p.policy_id,'version',p.version::text,
    'sourceRef',p.source_ref,'expiresAt',p.expires_at,'windowStart',p.window_start,'windowEnd',p.window_end,
    'capacity',p.capacity,'used',coalesce(used_count,p.accepted_count),'applicationId',d->>'applicationId',
    'environment',d->>'environment','organisationId',p_org,'operation',p_operation,'transactionId',txid_current()::text);
END $fn$;
CREATE OR REPLACE FUNCTION profitia_requests.reserve(p_operation text,p_org uuid,p_user uuid,p_resource text,p_payload text,
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
  UPDATE profitia_requests.policies SET accepted_count=accepted_count+1 WHERE policy_id=p_policy AND quota_mode='FIXED';
  RETURN jsonb_build_object('status','NEW','requestId',created,'policyId',p_policy,
    'policyVersion',p_version::text,'transactionId',txid_current()::text);
END $fn$;
CREATE OR REPLACE FUNCTION profitia_requests.accept(p_operation text,p_id uuid,p_decision uuid) RETURNS jsonb
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
  UPDATE profitia_requests.policies SET accepted_count=accepted_count+1 WHERE policy_id=r.policy_id AND quota_mode='ROLLING_24H';
  RETURN r.receipt;
END $fn$;

CREATE FUNCTION profitia_requests.location_admission_policy(p_operation text,p_org uuid,p_user uuid,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;BEGIN
 IF current_setting('transaction_isolation')<>'read committed' OR profitia_requests.location_admission_current() IS NOT TRUE THEN
  RETURN jsonb_build_object('status','DENIED','reasonCode','PERMISSION_DENIED'); END IF;
 p:=profitia_requests.policy(p_operation,p_org,p_user,p_resource);
 IF p->>'status'='AVAILABLE' AND NOT EXISTS(SELECT 1 FROM profitia_requests.policies WHERE policy_id=(p->>'policyId')::uuid AND quota_mode='ROLLING_24H') THEN
  RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_POLICY_UNAVAILABLE'); END IF;
 RETURN p;
END $fn$;
REVOKE ALL ON profitia_requests.location_admission_installation,profitia_requests.location_admission_receivers FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_requests FROM PUBLIC;
