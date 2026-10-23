-- Optional, explicitly installed unmetered Source policy. Historical SQL008/009,
-- effects, counters, user authority and paid policies remain intact.
-- Capacity/windows are NULL only for an explicitly selected UNMETERED policy.
-- Authentication, current revocation, Source admission and audit remain mandatory.
DO $guard$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR EXISTS(SELECT 1 FROM profitia_ingestion.runtime_bindings WHERE status='ACTIVE')
  OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND schema_version='1.0.0')
  OR NOT EXISTS(SELECT 1 FROM profitia_external_call.installation WHERE singleton AND schema_version='1.0.0')
  OR to_regprocedure('profitia_external_native.permits_status(uuid,integer)') IS NULL
  OR coalesce(current_setting('profitia.install.unmetered_digest',true),'') !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Disabled Source bindings and explicit accepted extension digest required' USING ERRCODE='42501';END IF;
END $guard$;
ALTER TABLE profitia_ingestion.installation ADD COLUMN unmetered_schema_digest text
 CHECK(unmetered_schema_digest~'^[a-f0-9]{64}$');
UPDATE profitia_ingestion.installation SET unmetered_schema_digest=current_setting('profitia.install.unmetered_digest'),revision=revision+1 WHERE singleton;
ALTER TABLE profitia_ingestion.budgets
 ADD COLUMN quota_mode text NOT NULL DEFAULT 'METERED' CHECK(quota_mode IN('METERED','UNMETERED')),
 ALTER COLUMN capacity DROP NOT NULL,ALTER COLUMN window_start DROP NOT NULL,
 ALTER COLUMN window_end DROP NOT NULL,ALTER COLUMN expires_at DROP NOT NULL,
 ALTER COLUMN consumed_count TYPE bigint,
 ADD CONSTRAINT source_quota_mode CHECK(
  quota_mode='METERED' AND capacity IS NOT NULL AND window_start IS NOT NULL AND window_end IS NOT NULL AND expires_at IS NOT NULL
  OR quota_mode='UNMETERED' AND capacity IS NULL AND window_start IS NULL AND window_end IS NULL AND expires_at IS NULL),
 ADD CONSTRAINT source_counter_range CHECK(consumed_count BETWEEN 0 AND 9007199254740991);
ALTER TABLE profitia_external_call.policies
 ADD COLUMN quota_mode text NOT NULL DEFAULT 'METERED' CHECK(quota_mode IN('METERED','UNMETERED')),
 ALTER COLUMN capacity DROP NOT NULL,ALTER COLUMN window_start DROP NOT NULL,
 ALTER COLUMN window_end DROP NOT NULL,ALTER COLUMN expires_at DROP NOT NULL,
 ALTER COLUMN admitted_count TYPE bigint,
 ADD CONSTRAINT external_quota_mode CHECK(
  quota_mode='METERED' AND capacity IS NOT NULL AND window_start IS NOT NULL AND window_end IS NOT NULL AND expires_at IS NOT NULL
  OR quota_mode='UNMETERED' AND capacity IS NULL AND window_start IS NULL AND window_end IS NULL AND expires_at IS NULL),
 ADD CONSTRAINT external_counter_range CHECK(admitted_count BETWEEN 0 AND 9007199254740991);


CREATE OR REPLACE FUNCTION profitia_ingestion.runtime_descriptor() RETURNS jsonb
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
  RETURN jsonb_build_object('unmeteredSchemaDigest',i.unmetered_schema_digest,'schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,'environment',i.environment,
    'projectId',i.project_id,'branchId',i.branch_id,'databaseName',i.database_name,'role',session_user,'revision',i.revision::text,
    'applicationId',b.application_id,'profileId',b.profile_id,'deploymentId',b.deployment_id,'configurationVersion',b.configuration_version,
    'serviceId',b.service_id,'proofRef','database-service:'||b.binding_id::text||':'||b.version::text,'sourceRef',b.source_ref,
    'expiresAt',least(b.expires_at,clock_timestamp()+interval '30 seconds'));
END $fn$;

CREATE OR REPLACE FUNCTION profitia_ingestion.current_state(p_source text,p_resource text) RETURNS jsonb
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
    AND status='ACTIVE' AND (quota_mode='UNMETERED' OR window_start<=clock_timestamp() AND window_end>clock_timestamp() AND expires_at>clock_timestamp());
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
      'quotaMode',b.quota_mode,'unmeteredSchemaDigest',d->>'unmeteredSchemaDigest','policyId',b.policy_id,'policyVersion',b.version::text,'unit',b.unit,'capacity',b.capacity,'used',b.consumed_count,
      'windowStart',b.window_start,'windowEnd',b.window_end,'policySourceRef',b.source_ref));
END $fn$;

CREATE OR REPLACE FUNCTION profitia_ingestion.reserve(p_source text,p_resource text,p_payload text,p_key text,p_decision uuid) RETURNS jsonb
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
  IF p.quota_mode='METERED' AND p.consumed_count>=p.capacity THEN RETURN jsonb_build_object('status','DENIED','reasonCode','LIMIT_EXCEEDED');END IF;
  INSERT INTO profitia_ingestion.effects(effect_id,key_digest,application_id,environment,service_id,source_id,resource_id,payload_digest,policy_id,policy_version,decision_id,status)
    VALUES(gen_random_uuid(),p_key,d->>'applicationId',d->>'environment',(d->>'serviceId')::uuid,p_source,p_resource,p_payload,p.policy_id,p.version,p_decision,'RESERVED') RETURNING * INTO e;
  UPDATE profitia_ingestion.budgets SET consumed_count=consumed_count+1 WHERE policy_id=p.policy_id;
  RETURN jsonb_build_object('status','NEW','effectId',e.effect_id,'policyId',p.policy_id,'policyVersion',p.version::text);
END $fn$;

CREATE OR REPLACE FUNCTION profitia_external_call.descriptor(p_source text,p_resource text) RETURNS jsonb
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
  AND status='ACTIVE' AND (quota_mode='UNMETERED' OR window_start<=clock_timestamp() AND window_end>clock_timestamp() AND expires_at>clock_timestamp());
 IF NOT FOUND OR p.transport='LOCAL_SYNTHETIC_HTTP' AND (i.environment<>'development' OR p.source_ref<>'SYNTHETIC_ONLY') THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,'sourceSchemaDigest',i.source_schema_digest,
  'projectId',i.project_id,'branchId',i.branch_id,'databaseName',current_database(),'role',session_user,
  'applicationId',d->>'applicationId','serviceId',d->>'serviceId','serviceBindingVersion',d->>'proofRef',
  'sourcePolicyVersion',s->>'policyVersion','environment',i.environment,'sourceId',p_source,'resourceId',p_resource,
  'policyId',p.policy_id,'policyVersion',p.version::text,'configurationVersion',p.configuration_version,
  'origin',p.origin,'transport',p.transport,'pathRules',p.path_rules,'maximumRequestBytes',p.maximum_request_bytes,
  'maximumResponseBytes',p.maximum_response_bytes,'timeoutMs',p.timeout_ms,'unit',p.unit,'capacity',p.capacity,
  'quotaMode',p.quota_mode,'unmeteredSchemaDigest',d->>'unmeteredSchemaDigest','admittedCount',p.admitted_count,'sourceRef',p.source_ref,
  'expiresAt',least(p.expires_at,p.window_end,(s->'access'->>'expiresAt')::timestamptz));
END $fn$;

CREATE OR REPLACE FUNCTION profitia_external_call.apply_control(p_effect uuid,p_decision uuid,p_envelope text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE v jsonb;c jsonb;d jsonb;p profitia_external_call.policies%ROWTYPE;r profitia_external_call.calls%ROWTYPE;id uuid;
BEGIN
 v:=profitia_external_call.check_control(p_effect,p_decision,p_envelope);c:=v->'content';d:=v->'descriptor';
 SELECT * INTO p FROM profitia_external_call.policies WHERE policy_id=(d->>'policyId')::uuid FOR UPDATE;
 IF NOT FOUND OR p.version::text IS DISTINCT FROM d->>'policyVersion' OR p.status<>'ACTIVE' OR p.quota_mode='METERED' AND p.expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'Current external policy required' USING ERRCODE='42501';END IF;
 IF c->>'action'='PLAN' THEN
  IF c->>'callId' IS NOT NULL OR c->>'status' IS NOT NULL OR c->>'httpStatus' IS NOT NULL OR c->>'responseDigest' IS NOT NULL
    OR p.quota_mode='METERED' AND p.admitted_count>=p.capacity THEN RAISE EXCEPTION 'External admission unavailable' USING ERRCODE='42501';END IF;
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
    OR (c->>'httpStatus')::integer NOT BETWEEN 200 AND 599 OR ((c->>'httpStatus')::integer BETWEEN 300 AND 399 AND profitia_external_native.permits_status(p.policy_id,(c->>'httpStatus')::integer) IS NOT TRUE)))
  OR (c->>'status'<>'RESPONSE' AND (c->>'httpStatus' IS NOT NULL OR c->>'responseDigest' IS NOT NULL)) THEN
  RAISE EXCEPTION 'External settlement unavailable' USING ERRCODE='42501';END IF;
 UPDATE profitia_external_call.calls SET status=c->>'status',settlement_effect_id=p_effect,http_status=(c->>'httpStatus')::integer,
  response_digest=c->>'responseDigest',settled_at=clock_timestamp() WHERE call_id=id;
 RETURN jsonb_build_object('callId',id,'status',c->>'status','fresh',true);
END $fn$;

-- No grants or policy-mode changes are performed by this migration.
-- Existing grants, native transport paths/credentials and rate scheduling survive.
REVOKE ALL ON FUNCTION profitia_ingestion.runtime_descriptor(),profitia_ingestion.current_state(text,text),
 profitia_ingestion.reserve(text,text,text,text,uuid),profitia_external_call.descriptor(text,text),
 profitia_external_call.apply_control(uuid,uuid,text) FROM PUBLIC;
