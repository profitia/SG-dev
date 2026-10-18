-- Independent technical authority beside the shared source data. It contains
-- no customer accounts, memberships, organisation IDs, sessions or private job
-- payload. This candidate admits STORED SQL transactions only, never a paid
-- provider/CPU effect that a database rollback could not undo.
DO $owner$ BEGIN
  IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
      AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid)) THEN
    RAISE EXCEPTION 'Controlled source authority owner required' USING ERRCODE='42501'; END IF;
END $owner$;
CREATE SCHEMA profitia_ingestion AUTHORIZATION profitia_ingestion_owner;
REVOKE ALL ON SCHEMA profitia_ingestion FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE profitia_ingestion.installation(
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),environment text NOT NULL CHECK(environment IN('development','staging','production')),
  project_id text NOT NULL,branch_id text NOT NULL,database_name name NOT NULL,revision bigint NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE TABLE profitia_ingestion.runtime_bindings(
  login_role name PRIMARY KEY,binding_id uuid NOT NULL UNIQUE,service_id uuid NOT NULL,application_id text NOT NULL,
  profile_id text NOT NULL CHECK(profile_id='PLATFORM_INTERNAL'),deployment_id text NOT NULL,configuration_version text NOT NULL,
  status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  source_ref text NOT NULL,expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE TABLE profitia_ingestion.sources(
  source_id text PRIMARY KEY CHECK(length(source_id) BETWEEN 1 AND 128),
  effect_kind text NOT NULL CHECK(effect_kind='STORED_SQL_TRANSACTION'),
  data_class text NOT NULL CHECK(data_class='SHARED_KNOWLEDGE'),payload_schema text NOT NULL,
  quality_version text NOT NULL,classification_version text NOT NULL,projection_version text NOT NULL,
  status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  source_ref text NOT NULL,expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE TABLE profitia_ingestion.grants(
  grant_id uuid PRIMARY KEY,login_role name NOT NULL REFERENCES profitia_ingestion.runtime_bindings(login_role),
  source_id text NOT NULL REFERENCES profitia_ingestion.sources(source_id),resource_id text CHECK(length(resource_id) BETWEEN 1 AND 256 AND resource_id NOT LIKE '%*%'),
  effect text NOT NULL CHECK(effect IN('ALLOW','DENY')),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),source_ref text NOT NULL,expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
  UNIQUE NULLS NOT DISTINCT(login_role,source_id,resource_id,effect)
);
CREATE TABLE profitia_ingestion.budgets(
  policy_id uuid PRIMARY KEY,application_id text NOT NULL,source_id text NOT NULL REFERENCES profitia_ingestion.sources(source_id),
  unit text NOT NULL CHECK(unit='SOURCE_TRANSACTION'),capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 1000000),
  consumed_count integer NOT NULL DEFAULT 0 CHECK(consumed_count>=0 AND consumed_count<=capacity),
  window_start timestamptz NOT NULL,window_end timestamptz NOT NULL,expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
  status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),source_ref text NOT NULL,
  CHECK(isfinite(window_start) AND isfinite(window_end) AND window_start<window_end AND expires_at<=window_end)
);
CREATE UNIQUE INDEX one_active_source_budget ON profitia_ingestion.budgets(application_id,source_id) WHERE status='ACTIVE';
CREATE TABLE profitia_ingestion.effects(
  effect_id uuid PRIMARY KEY,key_digest text NOT NULL UNIQUE CHECK(key_digest~'^[a-f0-9]{64}$'),
  application_id text NOT NULL,environment text NOT NULL,service_id uuid NOT NULL,source_id text NOT NULL REFERENCES profitia_ingestion.sources(source_id),
  resource_id text NOT NULL,payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
  policy_id uuid NOT NULL REFERENCES profitia_ingestion.budgets(policy_id),policy_version bigint NOT NULL,
  decision_id uuid NOT NULL,status text NOT NULL CHECK(status IN('RESERVED','COMMITTED')),receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),committed_at timestamptz,
  CHECK(status='RESERVED' AND receipt IS NULL AND committed_at IS NULL OR status='COMMITTED' AND committed_at IS NOT NULL
    AND receipt=jsonb_build_object('effectId',effect_id::text,'status','COMMITTED'))
);
CREATE TABLE profitia_ingestion.security_events(
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  application_id text NOT NULL,environment text NOT NULL,decision_id uuid NOT NULL,
  phase text NOT NULL CHECK(phase IN('INTENT','OUTCOME','DECISION','FAILURE')),event jsonb NOT NULL,
  UNIQUE(application_id,environment,decision_id,phase)
);
DO $rls$ DECLARE t text;BEGIN
  FOREACH t IN ARRAY ARRAY['installation','runtime_bindings','sources','grants','budgets','effects','security_events'] LOOP
    EXECUTE format('ALTER TABLE profitia_ingestion.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_ingestion.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_ingestion.%I TO profitia_ingestion_owner USING(true) WITH CHECK(true)',t);
    EXECUTE format('CREATE POLICY source_select_fence ON profitia_ingestion.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
    EXECUTE format('CREATE POLICY source_insert_fence ON profitia_ingestion.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
    EXECUTE format('CREATE POLICY source_update_fence ON profitia_ingestion.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user=''profitia_ingestion_owner'') WITH CHECK(current_user=''profitia_ingestion_owner'')',t);
    EXECUTE format('CREATE POLICY source_delete_fence ON profitia_ingestion.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user=''profitia_ingestion_owner'')',t);
  END LOOP;
END $rls$;
CREATE FUNCTION profitia_ingestion.bump_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN UPDATE profitia_ingestion.installation SET revision=revision+1 WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source installation required' USING ERRCODE='42501'; END IF;RETURN NULL;
END $fn$;
CREATE FUNCTION profitia_ingestion.control_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_TABLE_NAME='budgets' AND TG_OP='UPDATE' THEN
    IF NEW.consumed_count<OLD.consumed_count THEN RAISE EXCEPTION 'Budget history cannot decrease' USING ERRCODE='42501'; END IF;
    IF (to_jsonb(NEW)-ARRAY['consumed_count','version'])=(to_jsonb(OLD)-ARRAY['consumed_count','version']) THEN
      NEW.version:=OLD.version;RETURN NEW;
    END IF;
  END IF;
  UPDATE profitia_ingestion.installation SET revision=revision+1 WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source installation required' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' THEN NEW.version:=OLD.version+1;END IF;
  IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $fn$;
DO $triggers$ DECLARE t text;BEGIN
  FOREACH t IN ARRAY ARRAY['runtime_bindings','sources','grants','budgets'] LOOP
    EXECUTE format('CREATE TRIGGER authority_change BEFORE INSERT OR UPDATE OR DELETE ON profitia_ingestion.%I FOR EACH ROW EXECUTE FUNCTION profitia_ingestion.control_change()',t);
    EXECUTE format('CREATE TRIGGER authority_truncate BEFORE TRUNCATE ON profitia_ingestion.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_ingestion.bump_revision()',t);
  END LOOP;
END $triggers$;
CREATE FUNCTION profitia_ingestion.immutable_effect() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_OP='DELETE' OR TG_TABLE_NAME='security_events' THEN RAISE EXCEPTION 'Source history is immutable' USING ERRCODE='42501';END IF;
  IF OLD.status<>'RESERVED' OR NEW.status<>'COMMITTED'
    OR (to_jsonb(NEW)-ARRAY['status','receipt','committed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','receipt','committed_at']) THEN
    RAISE EXCEPTION 'Source effect binding is immutable' USING ERRCODE='42501';END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER immutable_effect BEFORE UPDATE OR DELETE ON profitia_ingestion.effects FOR EACH ROW EXECUTE FUNCTION profitia_ingestion.immutable_effect();
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON profitia_ingestion.security_events FOR EACH ROW EXECUTE FUNCTION profitia_ingestion.immutable_effect();
CREATE FUNCTION profitia_ingestion.no_history_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Source history is immutable' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER immutable_effect_truncate BEFORE TRUNCATE ON profitia_ingestion.effects FOR EACH STATEMENT EXECUTE FUNCTION profitia_ingestion.no_history_truncate();
CREATE TRIGGER immutable_events_truncate BEFORE TRUNCATE ON profitia_ingestion.security_events FOR EACH STATEMENT EXECUTE FUNCTION profitia_ingestion.no_history_truncate();
CREATE FUNCTION profitia_ingestion.require_committed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN IF EXISTS(SELECT 1 FROM profitia_ingestion.effects WHERE effect_id=NEW.effect_id AND status<>'COMMITTED') THEN
  RAISE EXCEPTION 'Reserved source effect cannot commit' USING ERRCODE='42501';END IF;RETURN NULL;END $fn$;
CREATE CONSTRAINT TRIGGER source_effect_must_commit AFTER INSERT OR UPDATE ON profitia_ingestion.effects
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION profitia_ingestion.require_committed();

CREATE FUNCTION profitia_ingestion.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE i profitia_ingestion.installation%ROWTYPE;b profitia_ingestion.runtime_bindings%ROWTYPE;
BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication OR NOT rolcanlogin))
    OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user)) THEN
    RAISE EXCEPTION 'Ordinary source runtime required' USING ERRCODE='42501';END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='profitia_ingestion_owner'
      AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
      AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_ingestion'
      AND c.relkind='r' AND c.relowner='profitia_ingestion_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity)<>7 THEN RETURN NULL;END IF;
  SELECT * INTO i FROM profitia_ingestion.installation WHERE singleton AND database_name=current_database();
  IF NOT FOUND THEN RETURN NULL;END IF;
  SELECT * INTO b FROM profitia_ingestion.runtime_bindings WHERE login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL;END IF;
  RETURN jsonb_build_object('schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,'environment',i.environment,
    'projectId',i.project_id,'branchId',i.branch_id,'databaseName',i.database_name,'role',session_user,'revision',i.revision::text,
    'applicationId',b.application_id,'profileId',b.profile_id,'deploymentId',b.deployment_id,'configurationVersion',b.configuration_version,
    'serviceId',b.service_id,'proofRef','database-service:'||b.binding_id::text||':'||b.version::text,'sourceRef',b.source_ref,
    'expiresAt',least(b.expires_at,clock_timestamp()+interval '30 seconds'));
END $fn$;
CREATE FUNCTION profitia_ingestion.current_state(p_source text,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;s profitia_ingestion.sources%ROWTYPE;b profitia_ingestion.budgets%ROWTYPE;deadline timestamptz;grant_expiry timestamptz;
BEGIN
  d:=profitia_ingestion.runtime_descriptor();
  IF d IS NULL OR p_resource IS NULL OR length(p_resource) NOT BETWEEN 1 AND 256 THEN RETURN NULL;END IF;
  SELECT * INTO s FROM profitia_ingestion.sources WHERE source_id=p_source AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL;END IF;
  SELECT min(expires_at) INTO grant_expiry FROM profitia_ingestion.grants WHERE login_role=session_user AND source_id=p_source
    AND status='ACTIVE' AND effect='ALLOW' AND expires_at>clock_timestamp() AND (resource_id IS NULL OR resource_id=p_resource);
  IF grant_expiry IS NULL OR EXISTS(SELECT 1 FROM profitia_ingestion.grants WHERE login_role=session_user AND source_id=p_source
    AND status='ACTIVE' AND effect='DENY' AND expires_at>clock_timestamp() AND (resource_id IS NULL OR resource_id=p_resource)) THEN RETURN NULL;END IF;
  SELECT * INTO b FROM profitia_ingestion.budgets WHERE application_id=d->>'applicationId' AND source_id=p_source
    AND status='ACTIVE' AND window_start<=clock_timestamp() AND window_end>clock_timestamp() AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL;END IF;
  deadline:=least((d->>'expiresAt')::timestamptz,s.expires_at,grant_expiry,b.expires_at,b.window_end);
  RETURN jsonb_build_object('applicationId',d->>'applicationId','environment',d->>'environment','policyVersion','source-v1:'||(d->>'revision'),
    'transactionId',txid_current()::text,'serviceBindingVersion',d->>'proofRef','usagePolicy','PLATFORM_BUDGET','products','[]'::jsonb,
    'access',jsonb_build_object('type','SERVICE_GRANT','actorId',d->>'serviceId','organisationId',NULL,'status','ACTIVE',
      'version',(d->>'proofRef')||':'||(d->>'revision'),'sourceRef',d->>'sourceRef','expiresAt',deadline,
      'permissions',jsonb_build_array(jsonb_build_object('operation','knowledge.ingest','feature','knowledge_ingestion','resourceId',p_resource)),'denies','[]'::jsonb),
    'resource',jsonb_build_object('id',p_resource,'type','shared_knowledge','environment',d->>'environment','dataClass',s.data_class,
      'ownerOrganisationId',NULL,'ownerUserId',NULL,'version',s.version::text,'projectionVersion',s.projection_version,'approvedSharedProjection',true),
    'ingestion',jsonb_build_object('sourceId',s.source_id,'effectKind',s.effect_kind,'sourceVersion',s.version::text,'sourceRef',s.source_ref,
      'payloadSchema',s.payload_schema,'qualityVersion',s.quality_version,'classificationVersion',s.classification_version,'expiresAt',deadline,
      'policyId',b.policy_id,'policyVersion',b.version::text,'unit',b.unit,'capacity',b.capacity,'used',b.consumed_count,
      'windowStart',b.window_start,'windowEnd',b.window_end,'policySourceRef',b.source_ref));
END $fn$;
CREATE FUNCTION profitia_ingestion.lock_ingestion(p_source text,p_resource text,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE state jsonb;d jsonb;
BEGIN
  PERFORM 1 FROM profitia_ingestion.installation WHERE singleton FOR SHARE;
  d:=profitia_ingestion.runtime_descriptor();
  PERFORM 1 FROM profitia_ingestion.budgets WHERE application_id=d->>'applicationId' AND source_id=p_source FOR UPDATE;
  state:=profitia_ingestion.current_state(p_source,p_resource);
  IF state IS NULL OR state->>'serviceBindingVersion' IS DISTINCT FROM p_proof THEN RETURN NULL;END IF;
  PERFORM set_config('profitia.ingestion.scope',jsonb_build_array(p_source,p_resource,p_proof,state->>'policyVersion',txid_current()::text,state->'access'->>'expiresAt')::text,true);
  RETURN state;
END $fn$;
CREATE FUNCTION profitia_ingestion.scope_allows(p_source text,p_resource text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE state jsonb;m jsonb;
BEGIN
  m:=nullif(current_setting('profitia.ingestion.scope',true),'')::jsonb;
  state:=profitia_ingestion.current_state(p_source,p_resource);
  RETURN coalesce(state IS NOT NULL AND m->>0=p_source AND m->>1=p_resource
    AND m->>2=state->>'serviceBindingVersion' AND m->>3=state->>'policyVersion' AND m->>4=txid_current()::text
    AND (m->>5)::timestamptz>clock_timestamp() AND (m->>5)::timestamptz<=clock_timestamp()+interval '30 seconds',false);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $fn$;
CREATE FUNCTION profitia_ingestion.reserve(p_source text,p_resource text,p_payload text,p_key text,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE state jsonb;d jsonb;p profitia_ingestion.budgets%ROWTYPE;e profitia_ingestion.effects%ROWTYPE;
BEGIN
  IF p_payload !~ '^[a-f0-9]{64}$' OR p_key !~ '^[a-f0-9]{64}$' OR p_decision IS NULL
    OR profitia_ingestion.scope_allows(p_source,p_resource) IS NOT TRUE THEN RETURN NULL;END IF;
  state:=profitia_ingestion.current_state(p_source,p_resource);d:=profitia_ingestion.runtime_descriptor();
  SELECT * INTO STRICT p FROM profitia_ingestion.budgets WHERE policy_id=(state->'ingestion'->>'policyId')::uuid FOR UPDATE;
  SELECT * INTO e FROM profitia_ingestion.effects WHERE key_digest=p_key FOR UPDATE;
  IF FOUND THEN
    IF e.application_id IS DISTINCT FROM d->>'applicationId' OR e.environment IS DISTINCT FROM d->>'environment'
      OR e.service_id::text IS DISTINCT FROM d->>'serviceId' OR e.source_id IS DISTINCT FROM p_source
      OR e.resource_id IS DISTINCT FROM p_resource OR e.payload_digest IS DISTINCT FROM p_payload THEN
      RETURN jsonb_build_object('status','DENIED','reasonCode','IDEMPOTENCY_CONFLICT');END IF;
    IF e.status<>'COMMITTED' THEN RETURN NULL;END IF;
    RETURN jsonb_build_object('status','REPLAY','effectId',e.effect_id,'receipt',e.receipt,'policyId',p.policy_id,'policyVersion',p.version::text);
  END IF;
  IF p.consumed_count>=p.capacity THEN RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_EXCEEDED');END IF;
  INSERT INTO profitia_ingestion.effects(effect_id,key_digest,application_id,environment,service_id,source_id,resource_id,payload_digest,policy_id,policy_version,decision_id,status)
    VALUES(gen_random_uuid(),p_key,d->>'applicationId',d->>'environment',(d->>'serviceId')::uuid,p_source,p_resource,p_payload,p.policy_id,p.version,p_decision,'RESERVED') RETURNING * INTO e;
  UPDATE profitia_ingestion.budgets SET consumed_count=consumed_count+1 WHERE policy_id=p.policy_id;
  RETURN jsonb_build_object('status','NEW','effectId',e.effect_id,'policyId',p.policy_id,'policyVersion',p.version::text);
END $fn$;
CREATE FUNCTION profitia_ingestion.complete(p_effect uuid,p_decision uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e profitia_ingestion.effects%ROWTYPE;d jsonb;
BEGIN
  d:=profitia_ingestion.runtime_descriptor();
  SELECT * INTO e FROM profitia_ingestion.effects WHERE effect_id=p_effect FOR UPDATE;
  IF NOT FOUND OR e.status<>'RESERVED' OR e.application_id IS DISTINCT FROM d->>'applicationId'
    OR e.service_id::text IS DISTINCT FROM d->>'serviceId' OR e.decision_id IS DISTINCT FROM p_decision
    OR profitia_ingestion.scope_allows(e.source_id,e.resource_id) IS NOT TRUE THEN RETURN NULL;END IF;
  UPDATE profitia_ingestion.effects SET status='COMMITTED',committed_at=clock_timestamp(),
    receipt=jsonb_build_object('effectId',effect_id::text,'status','COMMITTED') WHERE effect_id=p_effect RETURNING * INTO e;
  RETURN e.receipt;
END $fn$;
CREATE FUNCTION profitia_ingestion.receipt(p_source text,p_resource text,p_key text,p_payload text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE state jsonb;d jsonb;e profitia_ingestion.effects%ROWTYPE;
BEGIN
  state:=profitia_ingestion.current_state(p_source,p_resource);d:=profitia_ingestion.runtime_descriptor();
  IF state IS NULL OR p_key !~ '^[a-f0-9]{64}$' OR p_payload !~ '^[a-f0-9]{64}$' THEN RETURN NULL;END IF;
  SELECT * INTO e FROM profitia_ingestion.effects WHERE key_digest=p_key AND source_id=p_source AND resource_id=p_resource
    AND application_id=d->>'applicationId' AND environment=d->>'environment' AND service_id::text=d->>'serviceId' AND payload_digest=p_payload;
  IF NOT FOUND THEN RETURN NULL;END IF;RETURN e.receipt;
END $fn$;

-- Source-local journal for the same operation executor protocol. This is not a
-- second PMOS/PHR writer, and private initiator/cost metadata never enters it.
CREATE FUNCTION profitia_ingestion.append_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;state jsonb;b profitia_ingestion.runtime_bindings%ROWTYPE;i profitia_ingestion.installation%ROWTYPE;
BEGIN
  d:=profitia_ingestion.runtime_descriptor();
  SELECT * INTO b FROM profitia_ingestion.runtime_bindings WHERE login_role=session_user;
  SELECT * INTO i FROM profitia_ingestion.installation WHERE singleton AND database_name=current_database();
  IF b.login_role IS NULL OR i.database_name IS NULL OR jsonb_typeof(p_event) IS DISTINCT FROM 'object' OR octet_length(p_event::text)>16384
    OR p_event->>'applicationId' IS DISTINCT FROM b.application_id OR p_event->>'environment' IS DISTINCT FROM i.environment
    OR p_event->>'organisationId' IS NOT NULL OR p_event->>'subjectUserId' IS NOT NULL
    OR p_event->>'ownerOrganisationId' IS NOT NULL OR p_event->>'ownerUserId' IS NOT NULL
    OR p_event ? 'moduleEvidence' OR coalesce(p_event->>'reasonCode','') !~ '^[A-Z_]{1,64}$'
    OR p_event::text~*'(gh[pousr]_|sk_(live|test)_|postgres(ql)?://|Bearer[[:space:]])'
    OR (p_event ? 'productEvidence' AND p_event->'productEvidence' IS DISTINCT FROM '[]'::jsonb)
    OR EXISTS(SELECT 1 FROM jsonb_each(p_event) v WHERE v.key<>'productEvidence'
      AND (jsonb_typeof(v.value) NOT IN('string','null') OR length(v.value#>>'{}')>512))
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_event) k WHERE k NOT IN(
      'decisionId','contractId','contractVersion','implementationVersion','applicationId','applicationProfile','deploymentId',
      'configurationVersion','environment','operationStartedAt','occurredAt','operation','actorId','actorKind','subjectUserId',
      'organisationId','identityProofRef','identityIssuer','identityAudience','resourceId','payloadDigest','mode','policyVersion',
      'accessBasisType','accessVersion','accessSourceRef','feature','effect','correlationId','resourceType','dataClass',
      'ownerOrganisationId','ownerUserId','resourceVersion','projectionVersion','productEvidence','usagePolicy','phase','decision','reasonCode',
      'sourceId','sourceVersion','qualityVersion','classificationVersion','payloadSchema','budgetPolicyId','budgetPolicyVersion','budgetUnit'))
    OR (p_event->>'actorId' IS NULL AND (p_event->>'actorKind' IS NOT NULL OR p_event->>'decision' IS DISTINCT FROM 'DENY'))
    OR (p_event->>'actorId' IS NOT NULL AND (p_event->>'actorKind' IS DISTINCT FROM 'SERVICE'
      OR p_event->>'actorId' IS DISTINCT FROM b.service_id::text
      OR p_event->>'identityIssuer' IS DISTINCT FROM 'urn:profitia:database-service-runtime:v1'
      OR p_event->>'identityAudience' IS DISTINCT FROM b.application_id)) THEN
    RAISE EXCEPTION 'Source audit envelope unavailable' USING ERRCODE='42501';END IF;
  IF p_event->>'decision'='ALLOW' THEN
    state:=profitia_ingestion.current_state(p_event->>'sourceId',p_event->>'resourceId');
    IF d IS NULL OR state IS NULL OR p_event->>'operation' IS DISTINCT FROM 'knowledge.ingest'
      OR p_event->>'phase' NOT IN('INTENT','OUTCOME') OR p_event->>'actorId' IS NULL
      OR p_event->>'applicationProfile' IS DISTINCT FROM 'PLATFORM_INTERNAL'
      OR p_event->>'deploymentId' IS DISTINCT FROM d->>'deploymentId'
      OR p_event->>'configurationVersion' IS DISTINCT FROM d->>'configurationVersion'
      OR p_event->>'identityProofRef' IS DISTINCT FROM d->>'proofRef'
      OR p_event->>'mode' IS DISTINCT FROM 'PLATFORM' OR p_event->>'accessBasisType' IS DISTINCT FROM 'SERVICE_GRANT'
      OR p_event->>'policyVersion' IS DISTINCT FROM state->>'policyVersion'
      OR p_event->>'accessVersion' IS DISTINCT FROM state->'access'->>'version'
      OR p_event->>'accessSourceRef' IS DISTINCT FROM d->>'sourceRef'
      OR p_event->>'feature' IS DISTINCT FROM 'knowledge_ingestion' OR p_event->>'effect' IS DISTINCT FROM 'WRITE'
      OR p_event->>'resourceType' IS DISTINCT FROM 'shared_knowledge' OR p_event->>'dataClass' IS DISTINCT FROM 'SHARED_KNOWLEDGE'
      OR p_event->>'usagePolicy' IS DISTINCT FROM 'PLATFORM_BUDGET' OR p_event->>'sourceVersion' IS DISTINCT FROM state->'ingestion'->>'sourceVersion'
      OR p_event->>'qualityVersion' IS DISTINCT FROM state->'ingestion'->>'qualityVersion'
      OR p_event->>'classificationVersion' IS DISTINCT FROM state->'ingestion'->>'classificationVersion'
      OR p_event->>'payloadSchema' IS DISTINCT FROM state->'ingestion'->>'payloadSchema'
      OR p_event->>'budgetPolicyId' IS DISTINCT FROM state->'ingestion'->>'policyId'
      OR p_event->>'budgetPolicyVersion' IS DISTINCT FROM state->'ingestion'->>'policyVersion'
      OR p_event->>'budgetUnit' IS DISTINCT FROM 'SOURCE_TRANSACTION'
      OR p_event->>'phase'='OUTCOME' AND profitia_ingestion.scope_allows(p_event->>'sourceId',p_event->>'resourceId') IS NOT TRUE THEN
      RAISE EXCEPTION 'Current source audit scope unavailable' USING ERRCODE='42501';END IF;
  ELSIF p_event->>'decision' IS DISTINCT FROM 'DENY' OR p_event->>'phase' NOT IN('DECISION','FAILURE') THEN
    RAISE EXCEPTION 'Source audit decision unavailable' USING ERRCODE='42501';END IF;
  INSERT INTO profitia_ingestion.security_events(application_id,environment,decision_id,phase,event)
    VALUES(b.application_id,i.environment,(p_event->>'decisionId')::uuid,p_event->>'phase',p_event);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'Source audit envelope unavailable' USING ERRCODE='42501';
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_ingestion FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_ingestion FROM PUBLIC;
