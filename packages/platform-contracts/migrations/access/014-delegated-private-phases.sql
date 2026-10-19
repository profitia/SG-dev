-- Optional delegated Supplier PRIVATE_SQL_PHASE in the SAME phase ledger.
-- SQL001--013, HUMAN defaults and Forecast dispatch are unchanged. No runtime
-- role, ACL, seed, worker, network effect or product activation is provisioned.
DO $owner$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_request_phases.installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='d12b2e404cd6a9174f954c233982633076501f7ea493facd0cabf34c709604c1')
  OR NOT EXISTS(SELECT 1 FROM profitia_supplier_jobs.installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='cd12f9b88397da88241499548b8a5977d0aca830ad83c53a1bcf146265503555') THEN
  RAISE EXCEPTION 'Accepted controlled private phases and Supplier delegation required' USING ERRCODE='42501';END IF;
END $owner$;
CREATE SCHEMA profitia_delegated_phases AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_delegated_phases FROM PUBLIC;
CREATE TABLE profitia_delegated_phases.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
ALTER TABLE profitia_delegated_phases.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_delegated_phases.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_delegated_phases.installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY immutable_fence ON profitia_delegated_phases.installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_delegated_phases.installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_delegated_phases.installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
ALTER TABLE profitia_request_phases.effects
 ADD COLUMN executor_role name REFERENCES profitia_services.runtime_bindings(login_role),
 ADD COLUMN executor_service_id uuid,
 ADD COLUMN executor_application_id text REFERENCES profitia_access.applications(application_id),
 ADD COLUMN delegation_id uuid REFERENCES profitia_jobs.delegations(delegation_id),
 ADD CONSTRAINT delegated_phase_executor CHECK(
  executor_role IS NULL AND executor_service_id IS NULL AND executor_application_id IS NULL AND delegation_id IS NULL
  OR executor_role IS NOT NULL AND executor_service_id IS NOT NULL AND executor_application_id IS NOT NULL AND delegation_id IS NOT NULL);

-- This is metadata/current authority, not an independent bearer capability.
-- The parent application remains distinct from the authenticated executor.
CREATE FUNCTION profitia_request_phases.delegated_descriptor(p_request uuid,p_phase text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;j jsonb;i profitia_delegated_phases.installation%ROWTYPE;
 base profitia_request_phases.installation%ROWTYPE;p profitia_request_phases.policies%ROWTYPE;
BEGIN
 d:=profitia_jobs.supplier_runtime_descriptor();s:=profitia_services.runtime_descriptor();
 IF d IS NULL OR s IS NULL OR current_user<>'profitia_access_owner' OR p_request IS NULL
  OR p_phase IS NULL OR p_phase NOT IN('REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST')
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='profitia_delegated_phases.installation'::regclass
    AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
  OR has_table_privilege(session_user,'profitia_delegated_phases.installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'profitia_delegated_phases.installation','SELECT,INSERT,UPDATE,REFERENCES')
  OR has_schema_privilege(session_user,'profitia_delegated_phases','CREATE')
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='profitia_request_phases' AND c.relkind='r' AND c.relowner='profitia_access_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity)<>3
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='profitia_request_phases' AND c.relkind='r' AND
    (has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
  OR has_schema_privilege(session_user,'profitia_request_phases','CREATE') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_delegated_phases.installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO base FROM profitia_request_phases.installation WHERE singleton;
 IF NOT FOUND OR base.schema_digest<>'d12b2e404cd6a9174f954c233982633076501f7ea493facd0cabf34c709604c1' THEN RETURN NULL;END IF;
 j:=profitia_jobs.current_job(p_request);
 IF j IS NULL OR j->'delegation'->>'requestId' IS DISTINCT FROM p_request::text
  OR j->'delegation'->'target'->>'operation' IS DISTINCT FROM 'supplier.report.refresh' THEN RETURN NULL;END IF;
 SELECT * INTO p FROM profitia_request_phases.policies WHERE application_id=j->'delegation'->'target'->'application'->>'appId'
  AND phase_id=p_phase AND status='ACTIVE' AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND OR p.sequence IS DISTINCT FROM array_position(ARRAY['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'],p_phase)
  OR p.predecessor IS DISTINCT FROM (ARRAY[NULL::text,'REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL'])[p.sequence] THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('schemaVersion',base.schema_version,'schemaDigest',base.schema_digest,'owner','profitia_access_owner',
  'delegatedSchemaVersion',i.schema_version,'delegatedSchemaDigest',i.schema_digest,
  'phaseId',p.phase_id,'operation',p.operation,'effect',p.effect,'policyVersion',p.version::text,'sourceRef',p.source_ref,
  'transactionId',txid_current()::text,'expiresAt',least(p.expires_at,(j->'access'->>'expiresAt')::timestamptz),
  'requestId',p_request,'parentApplicationId',p.application_id,'executorServiceId',s->>'serviceId',
  'delegationId',j->'delegation'->>'delegationId','subjectUserId',j->'delegation'->>'subjectUserId',
  'organisationId',j->'access'->>'organisationId','resourceId',j->'delegation'->'target'->>'resourceId',
  'payloadDigest',j->'delegation'->>'payloadDigest');
END $fn$;

CREATE OR REPLACE FUNCTION profitia_request_phases.parent_available(p_request uuid,p_org uuid,p_user uuid,p_resource text,p_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_requests.intents%ROWTYPE;j jsonb;
BEGIN
 IF profitia_services.runtime_descriptor() IS NOT NULL THEN
  j:=profitia_jobs.current_job(p_request);
  IF j IS NULL OR profitia_jobs.scope_allows(p_request) IS NOT TRUE
   OR j->'delegation'->'target'->>'operation' IS DISTINCT FROM 'supplier.report.refresh'
   OR j->'access'->>'organisationId' IS DISTINCT FROM p_org::text
   OR j->'delegation'->>'subjectUserId' IS DISTINCT FROM p_user::text
   OR j->'delegation'->'target'->>'resourceId' IS DISTINCT FROM p_resource
   OR j->'delegation'->>'payloadDigest' IS DISTINCT FROM p_digest THEN RETURN false;END IF;
  SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request FOR UPDATE;
  RETURN FOUND AND r.status='ACCEPTED' AND r.operation='supplier.report.refresh'
   AND r.application_id=j->'delegation'->'target'->'application'->>'appId'
   AND r.environment=j->>'environment' AND r.organisation_id=p_org AND r.user_id=p_user
   AND r.resource_id=p_resource AND r.payload_digest=p_digest;
 END IF;
 d:=profitia_requests.external_runtime_descriptor();
 IF d IS NULL OR profitia_requests.scope_allows('supplier.report.refresh',p_org,p_user,p_resource) IS NOT TRUE THEN RETURN false;END IF;
 SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request FOR UPDATE;
 RETURN FOUND AND r.status='ACCEPTED' AND r.operation='supplier.report.refresh'
  AND r.application_id=d->>'applicationId' AND r.environment=d->>'environment'
  AND r.organisation_id=p_org AND r.user_id=p_user AND r.resource_id=p_resource AND r.payload_digest=p_digest;
END $fn$;
CREATE OR REPLACE FUNCTION profitia_request_phases.reserve(p_request uuid,p_phase text,p_input text,p_decision uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_requests.intents%ROWTYPE;p profitia_request_phases.policies%ROWTYPE;e profitia_request_phases.effects%ROWTYPE;
BEGIN
 d:=CASE WHEN profitia_services.runtime_descriptor() IS NOT NULL THEN profitia_request_phases.delegated_descriptor(p_request,p_phase) ELSE profitia_request_phases.descriptor(p_phase) END;
 IF d IS NULL OR p_request IS NULL OR p_decision IS NULL OR p_input IS NULL OR p_input !~ '^[a-f0-9]{64}$'
  OR p_version IS DISTINCT FROM (d->>'policyVersion')::bigint THEN RETURN NULL;END IF;
 SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request FOR UPDATE;
 IF NOT FOUND OR profitia_request_phases.parent_available(r.request_id,r.organisation_id,r.user_id,r.resource_id,r.payload_digest) IS NOT TRUE
  THEN RETURN jsonb_build_object('status','DENIED','reasonCode','RESOURCE_SCOPE_MISMATCH');END IF;
 SELECT * INTO p FROM profitia_request_phases.policies WHERE application_id=r.application_id AND phase_id=p_phase;
 SELECT * INTO e FROM profitia_request_phases.effects WHERE request_id=p_request AND phase_id=p_phase FOR UPDATE;
 IF FOUND THEN
  IF e.input_digest IS DISTINCT FROM p_input OR e.executor_service_id IS DISTINCT FROM (d->>'executorServiceId')::uuid
    OR e.executor_application_id IS DISTINCT FROM (CASE WHEN d ? 'executorServiceId' THEN d->>'applicationId' ELSE NULL END)
    OR e.delegation_id IS DISTINCT FROM (d->>'delegationId')::uuid THEN RETURN jsonb_build_object('status','DENIED','reasonCode','IDEMPOTENCY_CONFLICT');END IF;
  IF e.status<>'ACCEPTED' OR e.policy_version<>p_version THEN RETURN NULL;END IF;
  RETURN jsonb_build_object('status','REPLAY','phaseId',p_phase,'inputDigest',p_input,'decisionId',e.decision_id,'transactionId',txid_current()::text);
 END IF;
 IF p.predecessor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM profitia_request_phases.effects
  WHERE request_id=p_request AND phase_id=p.predecessor AND status='ACCEPTED') THEN
  RETURN jsonb_build_object('status','DENIED','reasonCode','RESOURCE_SCOPE_MISMATCH');END IF;
 INSERT INTO profitia_request_phases.effects(request_id,phase_id,application_id,environment,organisation_id,user_id,
  resource_id,payload_digest,input_digest,policy_version,decision_id,transaction_id,status,executor_role,executor_service_id,executor_application_id,delegation_id)
  VALUES(p_request,p_phase,r.application_id,r.environment,r.organisation_id,r.user_id,r.resource_id,r.payload_digest,p_input,p_version,p_decision,txid_current(),'RESERVED',CASE WHEN d ? 'executorServiceId' THEN session_user ELSE NULL END,
   (d->>'executorServiceId')::uuid,CASE WHEN d ? 'executorServiceId' THEN d->>'applicationId' ELSE NULL END,(d->>'delegationId')::uuid);
 RETURN jsonb_build_object('status','NEW','phaseId',p_phase,'inputDigest',p_input,'decisionId',p_decision,'transactionId',txid_current()::text);
END $fn$;
CREATE OR REPLACE FUNCTION profitia_request_phases.accept(p_request uuid,p_phase text,p_input text,p_decision uuid,p_version bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;e profitia_request_phases.effects%ROWTYPE;
BEGIN
 d:=CASE WHEN profitia_services.runtime_descriptor() IS NOT NULL THEN profitia_request_phases.delegated_descriptor(p_request,p_phase) ELSE profitia_request_phases.descriptor(p_phase) END;
 IF d IS NULL OR p_version IS DISTINCT FROM (d->>'policyVersion')::bigint THEN RETURN false;END IF;
 SELECT * INTO e FROM profitia_request_phases.effects WHERE request_id=p_request AND phase_id=p_phase FOR UPDATE;
 IF NOT FOUND OR e.status<>'RESERVED' OR e.decision_id IS DISTINCT FROM p_decision OR e.input_digest IS DISTINCT FROM p_input
  OR e.executor_service_id IS DISTINCT FROM (d->>'executorServiceId')::uuid
  OR e.executor_application_id IS DISTINCT FROM (CASE WHEN d ? 'executorServiceId' THEN d->>'applicationId' ELSE NULL END)
  OR e.delegation_id IS DISTINCT FROM (d->>'delegationId')::uuid OR e.policy_version IS DISTINCT FROM p_version OR e.transaction_id<>txid_current()
  OR profitia_request_phases.parent_available(e.request_id,e.organisation_id,e.user_id,e.resource_id,e.payload_digest) IS NOT TRUE THEN RETURN false;END IF;
 UPDATE profitia_request_phases.effects SET status='ACCEPTED',accepted_at=clock_timestamp() WHERE request_id=p_request AND phase_id=p_phase;
 RETURN true;
END $fn$;

-- RLS consumers use this for the current bounded phase effect, never only an
-- audit replay. An accepted row from an old transaction cannot grant a write.
CREATE FUNCTION profitia_request_phases.delegated_scope_allows(p_request uuid,p_phase text,p_input text,p_org uuid,p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 d:=profitia_request_phases.delegated_descriptor(p_request,p_phase);
 RETURN coalesce(d IS NOT NULL AND profitia_jobs.scope_allows(p_request) AND EXISTS(
  SELECT 1 FROM profitia_request_phases.effects e WHERE e.request_id=p_request AND e.phase_id=p_phase
   AND e.input_digest=p_input AND e.organisation_id=p_org AND e.user_id=p_user
   AND e.status='RESERVED' AND e.transaction_id=txid_current() AND e.executor_role=session_user
   AND e.executor_service_id::text=d->>'executorServiceId' AND e.executor_application_id=d->>'applicationId'
   AND e.delegation_id::text=d->>'delegationId' AND e.policy_version::text=d->>'policyVersion'),false);
END $fn$;

CREATE FUNCTION profitia_request_phases.audit_allows(p_event jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c jsonb;d jsonb;e profitia_request_phases.effects%ROWTYPE;
BEGIN
 c:=p_event->'requestContinuation';
 IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(c))<>7
  OR EXISTS(SELECT 1 FROM jsonb_each(c) v WHERE v.key NOT IN('requestId','phaseId','inputDigest','schemaDigest','delegatedSchemaDigest','policyVersion','transactionId')
   OR jsonb_typeof(v.value) IS DISTINCT FROM 'string' OR length(v.value#>>'{}') NOT BETWEEN 1 AND 256)
  OR c->>'requestId' IS DISTINCT FROM p_event->>'resourceId' OR p_event->>'actorKind' IS DISTINCT FROM 'SERVICE'
  OR p_event->>'operation' IS DISTINCT FROM 'job.execute' OR c->>'phaseId' NOT IN('REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST')
  OR coalesce(c->>'requestId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  OR coalesce(c->>'inputDigest','') !~ '^[a-f0-9]{64}$' OR coalesce(c->>'schemaDigest','') !~ '^[a-f0-9]{64}$'
  OR coalesce(c->>'delegatedSchemaDigest','') !~ '^[a-f0-9]{64}$' OR coalesce(c->>'policyVersion','') !~ '^[1-9][0-9]*$'
  OR coalesce(c->>'transactionId','') !~ '^[1-9][0-9]*$' THEN RETURN false;END IF;
 -- Denials retain historical bounded evidence, never grant an effect.
 IF p_event->>'decision'='DENY' THEN RETURN p_event->>'phase' IN('DECISION','FAILURE');END IF;
 d:=profitia_request_phases.delegated_descriptor((c->>'requestId')::uuid,c->>'phaseId');
 IF d IS NULL OR c->>'schemaDigest' IS DISTINCT FROM d->>'schemaDigest'
  OR c->>'delegatedSchemaDigest' IS DISTINCT FROM d->>'delegatedSchemaDigest'
  OR c->>'policyVersion' IS DISTINCT FROM d->>'policyVersion' OR p_event->>'actorId' IS DISTINCT FROM d->>'executorServiceId'
  OR p_event->>'subjectUserId' IS DISTINCT FROM d->>'subjectUserId' OR p_event->>'organisationId' IS DISTINCT FROM d->>'organisationId'
  OR p_event->>'payloadDigest' IS DISTINCT FROM d->>'payloadDigest' THEN RETURN false;END IF;
 IF p_event->>'phase'='INTENT' THEN RETURN p_event->>'reasonCode'='AUTHORIZED';END IF;
 IF p_event->>'phase'<>'OUTCOME' OR p_event->>'reasonCode'<>'SUCCEEDED'
  OR c->>'transactionId'<>txid_current()::text OR profitia_jobs.scope_allows((c->>'requestId')::uuid) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.application_id=p_event->>'applicationId'
   AND s.environment=p_event->>'environment' AND s.decision_id=(p_event->>'decisionId')::uuid AND s.phase='INTENT'
   AND s.event->>'decision'='ALLOW' AND s.event->>'reasonCode'='AUTHORIZED'
   AND s.event->>'correlationId'=p_event->>'correlationId' AND s.event->'requestContinuation'=c) THEN RETURN false;END IF;
 SELECT * INTO e FROM profitia_request_phases.effects WHERE request_id=(c->>'requestId')::uuid AND phase_id=c->>'phaseId';
 RETURN FOUND AND e.status='ACCEPTED' AND e.input_digest=c->>'inputDigest'
  AND e.policy_version::text=c->>'policyVersion' AND e.executor_service_id::text=d->>'executorServiceId'
  AND e.delegation_id::text=d->>'delegationId';
EXCEPTION WHEN invalid_text_representation THEN RETURN false;
END $fn$;
CREATE OR REPLACE FUNCTION profitia_request_phases.require_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e profitia_request_phases.effects%ROWTYPE;
BEGIN
 SELECT * INTO e FROM profitia_request_phases.effects WHERE request_id=NEW.request_id AND phase_id=NEW.phase_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Private phase unavailable' USING ERRCODE='23514';END IF;
 IF e.executor_service_id IS NOT NULL THEN
  IF e.status<>'ACCEPTED' OR e.transaction_id<>txid_current() OR NOT EXISTS(
   SELECT 1 FROM profitia_access.security_events s WHERE s.application_id=e.executor_application_id AND s.environment=e.environment
    AND s.decision_id=e.decision_id AND s.phase='OUTCOME' AND s.event->>'decision'='ALLOW' AND s.event->>'reasonCode'='SUCCEEDED'
    AND s.event->>'actorId'=e.executor_service_id::text AND s.event->>'subjectUserId'=e.user_id::text
    AND s.event->>'organisationId'=e.organisation_id::text AND s.event->>'resourceId'=e.request_id::text
    AND s.event->'requestContinuation'->>'phaseId'=e.phase_id AND s.event->'requestContinuation'->>'inputDigest'=e.input_digest
    AND s.event->'requestContinuation'->>'transactionId'=e.transaction_id::text
    AND profitia_request_phases.audit_allows(s.event)) THEN
   RAISE EXCEPTION 'Delegated phase needs same-transaction canonical OUTCOME' USING ERRCODE='23514';END IF;
  RETURN NULL;
 END IF;
 IF e.status<>'ACCEPTED' OR e.transaction_id<>txid_current() OR NOT EXISTS(
  SELECT 1 FROM profitia_access.security_events s WHERE s.application_id=e.application_id AND s.environment=e.environment
   AND s.decision_id=e.decision_id AND s.phase='OUTCOME' AND s.event->>'decision'='ALLOW'
   AND s.event->>'reasonCode'='SUCCEEDED' AND s.event->>'operation'='supplier.report.refresh'
   AND s.event->>'actorId'=e.user_id::text AND s.event->>'organisationId'=e.organisation_id::text
   AND s.event->>'resourceId'=e.resource_id AND s.event->>'payloadDigest'=e.payload_digest
   AND s.event->'moduleEvidence'->>'moduleId'='supplier_report'
   AND s.event->'moduleEvidence'->>'transactionId'=e.transaction_id::text) THEN
  RAISE EXCEPTION 'Private phase needs same-transaction acceptance and canonical OUTCOME' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $fn$;
CREATE OR REPLACE FUNCTION profitia_access.append_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, profitia_access, profitia_modules, pg_temp AS $fn$
DECLARE d jsonb;
BEGIN
  d := profitia_access.runtime_descriptor();
  IF jsonb_typeof(p_event) IS DISTINCT FROM 'object' OR octet_length(p_event::text)>16384
    OR p_event->>'applicationId' IS DISTINCT FROM d->>'applicationId'
    OR p_event->>'environment' IS DISTINCT FROM d->>'environment'
    OR coalesce(p_event->>'phase','') NOT IN ('INTENT','OUTCOME','DECISION','FAILURE')
    OR coalesce(p_event->>'decision','') NOT IN ('ALLOW','DENY')
    OR coalesce(p_event->>'reasonCode','') !~ '^[A-Z_]{1,64}$'
    OR p_event::text ~* '(gh[pousr]_|sk_(live|test)_|postgres(ql)?://|Bearer[[:space:]])'
    OR EXISTS(SELECT 1 FROM jsonb_each(p_event) v WHERE v.key NOT IN ('productEvidence','moduleEvidence','requestContinuation')
      AND (jsonb_typeof(v.value) NOT IN ('string','null') OR length(v.value#>>'{}')>512))
    OR (p_event ? 'productEvidence' AND jsonb_typeof(p_event->'productEvidence') IS DISTINCT FROM 'array')
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_event) k WHERE k NOT IN (
      'decisionId','contractId','contractVersion','implementationVersion','applicationId','applicationProfile',
      'deploymentId','configurationVersion','environment','operationStartedAt','occurredAt','operation',
      'actorId','actorKind','subjectUserId','organisationId','identityProofRef','identityIssuer','identityAudience',
      'resourceId','payloadDigest','mode','policyVersion','accessBasisType','accessVersion','accessSourceRef',
      'feature','effect','correlationId','resourceType','dataClass','ownerOrganisationId','ownerUserId',
      'resourceVersion','projectionVersion','productEvidence','moduleEvidence','requestContinuation','usagePolicy','phase','decision','reasonCode')) THEN
    RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
  END IF;
  IF p_event ? 'requestContinuation' AND profitia_request_phases.audit_allows(p_event) IS NOT TRUE THEN
    RAISE EXCEPTION 'Delegated private phase evidence invalid' USING ERRCODE='42501';END IF;
  IF p_event ? 'productEvidence' THEN
    IF jsonb_array_length(p_event->'productEvidence')>32 THEN RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_event->'productEvidence') item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object') THEN RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_event->'productEvidence') item,
      LATERAL jsonb_each(item) v WHERE v.key NOT IN ('product','version','sourceRef','source','expiresAt','feature')
        OR jsonb_typeof(v.value) IS DISTINCT FROM 'string' OR length(v.value#>>'{}') NOT BETWEEN 1 AND 256) THEN
      RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
    END IF;
  END IF;
  IF p_event ? 'moduleEvidence' THEN
    IF jsonb_typeof(p_event->'moduleEvidence') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Module audit evidence invalid' USING ERRCODE='42501';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_event->'moduleEvidence'))<>8
      OR EXISTS(SELECT 1 FROM jsonb_each(p_event->'moduleEvidence') v
        WHERE v.key NOT IN ('moduleId','moduleBindingId','version','sourceRef','expiresAt','transactionId','moduleSchemaDigest','auditSchemaDigest')
          OR jsonb_typeof(v.value) IS DISTINCT FROM 'string' OR length(v.value#>>'{}') NOT BETWEEN 1 AND 256)
      OR coalesce(p_event->'moduleEvidence'->>'moduleId','') NOT IN ('benchmark','category','supplier_report')
      OR coalesce(p_event->'moduleEvidence'->>'moduleBindingId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR coalesce(p_event->'moduleEvidence'->>'version','') !~ '^[1-9][0-9]*$'
      OR coalesce(p_event->'moduleEvidence'->>'transactionId','') !~ '^[0-9]+$'
      OR coalesce(p_event->'moduleEvidence'->>'moduleSchemaDigest','') !~ '^[a-f0-9]{64}$'
      OR coalesce(p_event->'moduleEvidence'->>'auditSchemaDigest','') !~ '^[a-f0-9]{64}$'
      OR coalesce(p_event->>'actorId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR coalesce(p_event->>'organisationId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR p_event->>'actorKind' IS DISTINCT FROM 'HUMAN'
      OR p_event->>'subjectUserId' IS DISTINCT FROM p_event->>'actorId'
      OR isfinite((p_event->'moduleEvidence'->>'expiresAt')::timestamptz) IS NOT TRUE THEN
      RAISE EXCEPTION 'Module audit evidence invalid' USING ERRCODE='42501';
    END IF;
    -- DENY/FAILURE retains the historical accepted provenance after rollback or
    -- revocation. ALLOW must still match the current installation and binding.
    IF p_event->>'decision'='ALLOW' THEN
      IF (p_event->'moduleEvidence'->>'expiresAt')::timestamptz<=clock_timestamp() THEN
        RAISE EXCEPTION 'Current module access expired' USING ERRCODE='PT403';
      END IF;
      IF p_event->>'phase' NOT IN ('INTENT','OUTCOME')
        OR p_event->>'policyVersion' IS DISTINCT FROM 'access-v1:'||(d->>'revision')
        OR (p_event->'moduleEvidence'->>'expiresAt')::timestamptz>clock_timestamp()+interval '30 seconds'
        OR NOT EXISTS(SELECT 1 FROM profitia_modules.installation i,profitia_modules.audit_installation a,
          profitia_modules.application_bindings m JOIN profitia_access.product_grants g ON g.application_id=m.application_id
          WHERE i.singleton AND a.singleton AND i.schema_digest=p_event->'moduleEvidence'->>'moduleSchemaDigest'
            AND a.schema_digest=p_event->'moduleEvidence'->>'auditSchemaDigest'
            AND m.application_id=d->>'applicationId' AND m.module_id=p_event->'moduleEvidence'->>'moduleId'
            AND m.binding_id::text=p_event->'moduleEvidence'->>'moduleBindingId'
            AND m.version::text=p_event->'moduleEvidence'->>'version'
            AND m.source_ref=p_event->'moduleEvidence'->>'sourceRef'
            AND m.status='ACTIVE' AND m.expires_at>= (p_event->'moduleEvidence'->>'expiresAt')::timestamptz
            AND g.organisation_id=(p_event->>'organisationId')::uuid AND g.status='ACTIVE'
            AND g.product=CASE WHEN m.module_id='supplier_report' THEN 'SUPPLIER_INTELLIGENCE' ELSE 'SPENDGURU' END
            AND g.features @> ARRAY[m.module_id]
            AND g.expires_at>= (p_event->'moduleEvidence'->>'expiresAt')::timestamptz) THEN
        RAISE EXCEPTION 'Current module audit scope unavailable' USING ERRCODE='42501';
      END IF;
      IF p_event->>'phase'='OUTCOME' AND (
        p_event->'moduleEvidence'->>'transactionId' IS DISTINCT FROM txid_current()::text
        OR profitia_modules.scope_allows(p_event->'moduleEvidence'->>'moduleId',(p_event->>'organisationId')::uuid,(p_event->>'actorId')::uuid) IS NOT TRUE
        OR current_setting('profitia.module.'||(p_event->'moduleEvidence'->>'moduleId'),true)::jsonb->>3 IS DISTINCT FROM p_event->'moduleEvidence'->>'moduleBindingId'
        OR current_setting('profitia.module.'||(p_event->'moduleEvidence'->>'moduleId'),true)::jsonb->>4 IS DISTINCT FROM p_event->'moduleEvidence'->>'version') THEN
        RAISE EXCEPTION 'Module outcome scope unavailable' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  INSERT INTO profitia_access.security_events(application_id,environment,decision_id,phase,event)
    VALUES(d->>'applicationId',d->>'environment',(p_event->>'decisionId')::uuid,p_event->>'phase',p_event);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
END $fn$;
CREATE OR REPLACE FUNCTION profitia_jobs.append_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; s jsonb; state jsonb; b profitia_services.runtime_bindings%ROWTYPE; evidence jsonb; p jsonb;
BEGIN
  d:=profitia_jobs.runtime_descriptor();s:=profitia_services.runtime_descriptor();
  SELECT * INTO b FROM profitia_services.runtime_bindings WHERE login_role=session_user;
  IF jsonb_typeof(p_event) IS DISTINCT FROM 'object' OR d IS NULL
    OR p_event->>'applicationId' IS DISTINCT FROM d->>'applicationId'
    OR p_event->>'environment' IS DISTINCT FROM d->>'environment' OR p_event ? 'moduleEvidence'
    OR (p_event->>'actorId' IS NULL AND (p_event->>'actorKind' IS NOT NULL OR p_event->>'decision' IS DISTINCT FROM 'DENY'))
    OR (p_event->>'actorId' IS NOT NULL AND (b.service_id IS NULL OR p_event->>'actorKind' IS DISTINCT FROM 'SERVICE'
      OR p_event->>'actorId' IS DISTINCT FROM b.service_id::text
      OR p_event->>'identityIssuer' IS DISTINCT FROM 'urn:profitia:database-service-runtime:v1'
      OR p_event->>'identityAudience' IS DISTINCT FROM d->>'applicationId')) THEN
    RAISE EXCEPTION 'Delegated audit envelope unavailable' USING ERRCODE='42501'; END IF;
  IF p_event->>'decision'='ALLOW' THEN
    state:=profitia_jobs.current_job((p_event->>'resourceId')::uuid);
    p:=state->'delegation'->'target'->'products'->0;
    evidence:=jsonb_build_array(jsonb_build_object('product',p->>'product','feature',CASE state->'delegation'->'target'->>'operation' WHEN 'forecast.request' THEN 'forecast' WHEN 'supplier.report.refresh' THEN 'supplier_report' ELSE NULL END,'version',p->>'version',
      'sourceRef',p->>'sourceRef','source',p->>'source','expiresAt',p->>'expiresAt'));
    IF s IS NULL OR state IS NULL OR p_event->>'operation' IS DISTINCT FROM 'job.execute'
      OR p_event->>'phase' NOT IN('INTENT','OUTCOME') OR p_event->>'actorId' IS NULL
      OR p_event->>'subjectUserId' IS DISTINCT FROM state->'delegation'->>'subjectUserId'
      OR p_event->>'organisationId' IS DISTINCT FROM state->'access'->>'organisationId'
      OR p_event->>'applicationProfile' IS DISTINCT FROM s->>'profileId'
      OR p_event->>'deploymentId' IS DISTINCT FROM s->>'deploymentId'
      OR p_event->>'configurationVersion' IS DISTINCT FROM s->>'configurationVersion'
      OR p_event->>'identityProofRef' IS DISTINCT FROM s->>'proofRef'
      OR p_event->>'mode' IS DISTINCT FROM 'ORGANISATION' OR p_event->>'accessBasisType' IS DISTINCT FROM 'DELEGATED_USER'
      OR p_event->>'accessVersion' IS DISTINCT FROM state->'access'->>'version'
      OR p_event->>'accessSourceRef' IS DISTINCT FROM state->'access'->>'sourceRef'
      OR p_event->>'policyVersion' IS DISTINCT FROM state->>'policyVersion'
      OR p_event->>'payloadDigest' IS DISTINCT FROM state->'delegation'->>'payloadDigest'
      OR p_event->>'ownerOrganisationId' IS DISTINCT FROM state->'resource'->>'ownerOrganisationId'
      OR p_event->>'ownerUserId' IS DISTINCT FROM state->'resource'->>'ownerUserId'
      OR p_event->>'feature' IS DISTINCT FROM 'job_execution' OR p_event->>'resourceType' IS DISTINCT FROM 'job'
      OR p_event->>'dataClass' IS DISTINCT FROM 'ORGANISATION_PRIVATE' OR p_event->>'effect' IS DISTINCT FROM 'EXECUTE_BOUND_OPERATION'
      OR p_event->>'usagePolicy' IS DISTINCT FROM 'NOT_APPLICABLE' OR p_event->'productEvidence' IS DISTINCT FROM evidence
      OR p_event->>'phase'='OUTCOME' AND profitia_jobs.scope_allows((p_event->>'resourceId')::uuid) IS NOT TRUE THEN
      RAISE EXCEPTION 'Current delegated audit scope unavailable' USING ERRCODE='42501'; END IF;
  ELSIF p_event->>'decision' IS DISTINCT FROM 'DENY' OR p_event->>'phase' NOT IN('DECISION','FAILURE') THEN
    RAISE EXCEPTION 'Delegated audit decision unavailable' USING ERRCODE='42501';
  END IF;
  IF p_event ? 'requestContinuation' AND profitia_request_phases.audit_allows(p_event) IS NOT TRUE THEN
    RAISE EXCEPTION 'Current delegated private phase audit unavailable' USING ERRCODE='42501';END IF;
  PERFORM profitia_access.append_audit(p_event);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'Delegated audit envelope unavailable' USING ERRCODE='42501';
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_delegated_phases FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_delegated_phases FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_request_phases.delegated_descriptor(uuid,text),profitia_request_phases.delegated_scope_allows(uuid,text,text,uuid,uuid),profitia_request_phases.audit_allows(jsonb) FROM PUBLIC;
