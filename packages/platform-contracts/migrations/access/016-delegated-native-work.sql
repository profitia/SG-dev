-- Optional short native SQL work units. The original job/directory and domain
-- lifecycle remain authoritative. No second domain/effect ledger, provider call,
-- role, runtime ACL, activation or data transfer is created here.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_request_inspection.installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='00db4ebae666f6cd94475b789fecfbb775c0ebb2d66f87e595d674b827cdf13d') THEN
  RAISE EXCEPTION 'Controlled accepted inspection installation required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE SCHEMA profitia_request_work AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_request_work FROM PUBLIC;
CREATE TABLE profitia_request_work.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_request_work.policies(
 application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
 unit_id text NOT NULL CHECK(unit_id~'^[A-Z][A-Z0-9_]{1,63}$'),access_mode text NOT NULL CHECK(access_mode IN('READ','WRITE')),
 status text NOT NULL CHECK(status IN('ACTIVE','DISABLED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 PRIMARY KEY(application_id,unit_id)
);
DO $metadata$ DECLARE name text;BEGIN
 FOREACH name IN ARRAY ARRAY['installation','policies'] LOOP
  EXECUTE format('ALTER TABLE profitia_request_work.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE profitia_request_work.%I FORCE ROW LEVEL SECURITY',name);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_request_work.%I TO profitia_access_owner USING(true) WITH CHECK(true)',name);
  EXECUTE format('CREATE POLICY controlled_fence ON profitia_request_work.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',name);
 END LOOP;
END $metadata$;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_request_work.installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_request_work.installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE FUNCTION profitia_request_work.guard_policy() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Retire a native unit policy instead of deleting it' USING ERRCODE='42501';END IF;
 IF (NEW.application_id,NEW.unit_id,NEW.access_mode) IS DISTINCT FROM (OLD.application_id,OLD.unit_id,OLD.access_mode) THEN
  RAISE EXCEPTION 'Native work purpose and access mode are immutable; retire its policy instead' USING ERRCODE='42501';END IF;
 NEW.version:=OLD.version+1;RETURN NEW;
END $fn$;
CREATE TRIGGER policy_version BEFORE UPDATE OR DELETE ON profitia_request_work.policies FOR EACH ROW EXECUTE FUNCTION profitia_request_work.guard_policy();
CREATE TRIGGER policy_truncate BEFORE TRUNCATE ON profitia_request_work.policies FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();

CREATE FUNCTION profitia_request_work.descriptor(p_request uuid,p_unit text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;j jsonb;i profitia_request_work.installation%ROWTYPE;p profitia_request_work.policies%ROWTYPE;
BEGIN
 d:=profitia_jobs.supplier_runtime_descriptor();s:=profitia_services.runtime_descriptor();
 IF current_user<>'profitia_access_owner' OR d IS NULL OR s IS NULL OR p_request IS NULL OR p_unit IS NULL
  OR p_unit!~'^[A-Z][A-Z0-9_]{1,63}$' OR profitia_jobs.scope_allows(p_request) IS NOT TRUE
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_request_work'
   AND c.relkind='r' AND c.relowner='profitia_access_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity)<>2
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_request_work' AND c.relkind='r'
   AND (has_table_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege(session_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
  OR has_schema_privilege(session_user,'profitia_request_work','CREATE')
  OR EXISTS(SELECT 1 FROM profitia_request_phases.effects e WHERE e.transaction_id=txid_current()) THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_request_work.installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 j:=profitia_jobs.current_job(p_request);
 IF j IS NULL OR j->'delegation'->>'requestId' IS DISTINCT FROM p_request::text
  OR j->'delegation'->'target'->>'operation' IS DISTINCT FROM 'supplier.report.refresh'
  OR s->>'serviceId' IS NOT DISTINCT FROM j->'delegation'->>'subjectUserId' THEN RETURN NULL;END IF;
 SELECT * INTO p FROM profitia_request_work.policies WHERE application_id=j->'delegation'->'target'->'application'->>'appId'
  AND unit_id=p_unit AND status='ACTIVE' AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,'owner','profitia_access_owner',
  'unitId',p.unit_id,'accessMode',p.access_mode,'operation','supplier.report.refresh','effect','PRIVATE_SQL_WORK',
  'policyVersion',p.version::text,'sourceRef',p.source_ref,'policyExpiresAt',p.expires_at,'transactionId',txid_current()::text,
  'expiresAt',least(p.expires_at,(j->'access'->>'expiresAt')::timestamptz),'requestId',p_request,
  'parentApplicationId',p.application_id,'executorServiceId',s->>'serviceId','delegationId',j->'delegation'->>'delegationId',
  'subjectUserId',j->'delegation'->>'subjectUserId','organisationId',j->'access'->>'organisationId',
  'resourceId',j->'delegation'->'target'->>'resourceId','payloadDigest',j->'delegation'->>'payloadDigest');
END $fn$;
CREATE FUNCTION profitia_request_work.evidence(p_descriptor jsonb,p_input text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT jsonb_build_object('requestId',p_descriptor->>'requestId','unitId',p_descriptor->>'unitId','accessMode',p_descriptor->>'accessMode',
  'inputDigest',p_input,'policyVersion',p_descriptor->>'policyVersion','policySourceRef',p_descriptor->>'sourceRef','policyExpiresAt',p_descriptor->>'policyExpiresAt','transactionId',p_descriptor->>'transactionId','schemaDigest',p_descriptor->>'schemaDigest')
$fn$;
CREATE FUNCTION profitia_request_work.audit_allows(p_event jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c jsonb;d jsonb;BEGIN
 c:=p_event->'requestWork';
 IF p_event ? 'requestContinuation' OR p_event ? 'requestInspection' OR jsonb_typeof(c) IS DISTINCT FROM 'object'
  OR (SELECT count(*) FROM jsonb_object_keys(c))<>9
  OR EXISTS(SELECT 1 FROM jsonb_each(c) v WHERE jsonb_typeof(v.value)<>'string' OR length(v.value#>>'{}')>256)
  OR coalesce(c->>'requestId','')!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  OR coalesce(c->>'unitId','')!~'^[A-Z][A-Z0-9_]{1,63}$' OR coalesce(c->>'accessMode','') NOT IN('READ','WRITE')
  OR coalesce(c->>'inputDigest','')!~'^[a-f0-9]{64}$' OR coalesce(c->>'schemaDigest','')!~'^[a-f0-9]{64}$'
  OR length(coalesce(c->>'policySourceRef','')) NOT BETWEEN 1 AND 256 OR isfinite((c->>'policyExpiresAt')::timestamptz) IS NOT TRUE
  OR coalesce(c->>'policyVersion','')!~'^[1-9][0-9]*$' OR coalesce(c->>'transactionId','')!~'^[1-9][0-9]*$'
  OR p_event->>'operation' IS DISTINCT FROM 'job.execute' OR p_event->>'actorKind' IS DISTINCT FROM 'SERVICE' THEN RETURN false;END IF;
 IF p_event->>'phase' IN('DECISION','FAILURE') THEN RETURN p_event->>'decision'='DENY';END IF;
 d:=profitia_request_work.descriptor((c->>'requestId')::uuid,c->>'unitId');
 IF d IS NULL OR c IS DISTINCT FROM profitia_request_work.evidence(d,c->>'inputDigest')
  OR p_event->>'resourceId' IS DISTINCT FROM d->>'requestId' OR p_event->>'payloadDigest' IS DISTINCT FROM d->>'payloadDigest'
  OR p_event->>'applicationId' IS DISTINCT FROM d->>'applicationId' OR p_event->>'environment' IS DISTINCT FROM d->>'environment'
  OR p_event->>'actorId' IS DISTINCT FROM d->>'executorServiceId' OR p_event->>'subjectUserId' IS DISTINCT FROM d->>'subjectUserId'
  OR p_event->>'organisationId' IS DISTINCT FROM d->>'organisationId' OR p_event->>'decision'<>'ALLOW' THEN RETURN false;END IF;
 IF p_event->>'phase'='INTENT' THEN RETURN p_event->>'reasonCode'='AUTHORIZED' AND NOT EXISTS(
  SELECT 1 FROM profitia_access.security_events s WHERE s.phase='INTENT' AND s.event->'requestWork'->>'transactionId'=txid_current()::text
   AND s.decision_id IS DISTINCT FROM (p_event->>'decisionId')::uuid);END IF;
 IF p_event->>'phase'<>'OUTCOME' OR p_event->>'reasonCode'<>'SUCCEEDED' THEN RETURN false;END IF;
 RETURN profitia_request_work.scope_allows((c->>'requestId')::uuid,c->>'unitId',(d->>'organisationId')::uuid,(d->>'subjectUserId')::uuid,c->>'accessMode')
  AND EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.decision_id=(p_event->>'decisionId')::uuid AND s.phase='INTENT'
   AND s.event->>'correlationId'=p_event->>'correlationId' AND s.event->'requestWork'=c);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;END $fn$;
CREATE FUNCTION profitia_request_work.bind_scope(p_request uuid,p_unit text,p_input text,p_decision uuid,p_correlation uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 d:=profitia_request_work.descriptor(p_request,p_unit);
 IF d IS NULL OR coalesce(p_input,'')!~'^[a-f0-9]{64}$' OR NOT EXISTS(
  SELECT 1 FROM profitia_access.security_events s WHERE s.decision_id=p_decision AND s.phase='INTENT' AND s.event->>'correlationId'=p_correlation::text
   AND s.event->'requestWork'=profitia_request_work.evidence(d,p_input) AND profitia_request_work.audit_allows(s.event)) THEN RETURN false;END IF;
 PERFORM set_config('profitia.native_work.scope',jsonb_build_array(p_request,p_unit,p_input,p_decision,p_correlation,txid_current()::text)::text,true);
 RETURN profitia_request_work.scope_allows(p_request,p_unit,(d->>'organisationId')::uuid,(d->>'subjectUserId')::uuid,d->>'accessMode');
END $fn$;
CREATE FUNCTION profitia_request_work.scope_allows(p_request uuid,p_unit text,p_org uuid,p_user uuid,p_mode text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE m jsonb;d jsonb;BEGIN
 m:=nullif(current_setting('profitia.native_work.scope',true),'')::jsonb;
 IF jsonb_typeof(m) IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 IF jsonb_array_length(m)<>6 OR m->>0 IS DISTINCT FROM p_request::text OR m->>1 IS DISTINCT FROM p_unit OR m->>5 IS DISTINCT FROM txid_current()::text
  OR p_mode IS NULL OR p_mode NOT IN('READ','WRITE') THEN RETURN false;END IF;
 d:=profitia_request_work.descriptor(p_request,p_unit);
 IF d IS NULL OR d->>'organisationId' IS DISTINCT FROM p_org::text OR d->>'subjectUserId' IS DISTINCT FROM p_user::text
  OR (p_mode='WRITE' AND d->>'accessMode'<>'WRITE') THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.decision_id=(m->>3)::uuid AND s.phase='INTENT'
  AND s.event->>'correlationId'=m->>4 AND s.event->'requestWork'=profitia_request_work.evidence(d,m->>2)
  AND profitia_request_work.audit_allows(s.event));
EXCEPTION WHEN invalid_text_representation THEN RETURN false;END $fn$;
CREATE FUNCTION profitia_request_work.enforce_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.decision_id=NEW.decision_id AND s.phase='OUTCOME'
  AND s.event->>'correlationId'=NEW.event->>'correlationId' AND s.event->'requestWork'=NEW.event->'requestWork'
  AND profitia_request_work.audit_allows(s.event)) THEN
  RAISE EXCEPTION 'Native SQL work needs same-transaction canonical OUTCOME' USING ERRCODE='23514';END IF;
 RETURN NULL;END $fn$;
CREATE INDEX native_work_transaction_idx ON profitia_access.security_events
 (application_id,environment,((event->'requestWork'->>'transactionId')),((event->>'resourceId'))) WHERE phase='INTENT' AND event ? 'requestWork';
CREATE CONSTRAINT TRIGGER native_work_outcome AFTER INSERT ON profitia_access.security_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 WHEN(NEW.phase='INTENT' AND NEW.event ? 'requestWork') EXECUTE FUNCTION profitia_request_work.enforce_audit();

-- An enclosing native unit seals the job context and cannot borrow dispatch,
-- delivery or once-only phase mutation functions, including through a savepoint.
CREATE FUNCTION profitia_request_work.active_in_transaction() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 d:=profitia_access.runtime_descriptor();
 RETURN d IS NOT NULL AND EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.application_id=d->>'applicationId'
  AND s.environment=d->>'environment' AND s.phase='INTENT' AND s.event->'requestWork'->>'transactionId'=txid_current()::text);
END $fn$;

CREATE OR REPLACE FUNCTION profitia_jobs.lock_job(p_job uuid,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE state jsonb;
BEGIN
 IF profitia_request_work.active_in_transaction() THEN RETURN NULL;END IF;
  PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
  state:=profitia_jobs.current_job(p_job);
  IF state IS NULL OR state->>'serviceBindingVersion' IS DISTINCT FROM p_proof THEN RETURN NULL; END IF;
  PERFORM set_config('profitia.job.scope',jsonb_build_array(p_job,p_proof,state->>'policyVersion',
    txid_current()::text,state->'access'->>'expiresAt')::text,true);
  RETURN state;
END $fn$;

CREATE OR REPLACE FUNCTION profitia_jobs.claim_dispatch(p_job uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE j profitia_jobs.dispatches%ROWTYPE; state jsonb; attempts integer; deadline timestamptz;
BEGIN
 IF profitia_request_work.active_in_transaction() THEN RETURN NULL;END IF;
  IF profitia_jobs.scope_allows(p_job) IS NOT TRUE THEN RETURN NULL; END IF;
  SELECT * INTO j FROM profitia_jobs.dispatches WHERE job_id=p_job FOR UPDATE;
  state:=profitia_jobs.current_job(p_job);
  IF state IS NULL THEN RETURN NULL; END IF;
  IF j.status='CONFIRMED' THEN RETURN jsonb_build_object('status','CONFIRMED','jobId',j.job_id,
    'sourceId',j.source_id,'deliveryKey',j.delivery_key); END IF;
  IF j.lease_expires_at>clock_timestamp() THEN RETURN jsonb_build_object('status','BUSY','jobId',j.job_id); END IF;
  SELECT b.max_attempts INTO attempts FROM profitia_jobs.operation_bindings b
    JOIN profitia_jobs.delegations g ON g.binding_id=b.binding_id WHERE g.delegation_id=j.delegation_id;
  IF j.attempt_count>=attempts THEN RETURN jsonb_build_object('status','RECONCILE_REQUIRED','jobId',j.job_id); END IF;
  deadline:=(state->'access'->>'expiresAt')::timestamptz;
  UPDATE profitia_jobs.dispatches SET status='READY',lease_id=gen_random_uuid(),lease_expires_at=deadline,
    attempt_count=attempt_count+1,updated_at=clock_timestamp() WHERE job_id=p_job RETURNING * INTO j;
  RETURN jsonb_build_object('status','READY','jobId',j.job_id,'requestId',j.request_id,'sourceId',j.source_id,
    'deliveryKey',j.delivery_key,'leaseId',j.lease_id,'expiresAt',deadline,'attempt',j.attempt_count);
END $fn$;

CREATE OR REPLACE FUNCTION profitia_jobs.delivery_state(p_job uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE j profitia_jobs.dispatches%ROWTYPE;
BEGIN
 IF profitia_request_work.active_in_transaction() THEN RETURN NULL;END IF;
  IF profitia_jobs.scope_allows(p_job) IS NOT TRUE THEN RETURN NULL;END IF;
  SELECT * INTO j FROM profitia_jobs.dispatches WHERE job_id=p_job FOR UPDATE;
  IF j.status='CONFIRMED' THEN RETURN jsonb_build_object('jobId',p_job,'status','CONFIRMED');END IF;
  IF j.status<>'READY' OR j.lease_id IS DISTINCT FROM p_lease OR j.lease_expires_at<=clock_timestamp() THEN RETURN NULL;END IF;
  RETURN jsonb_build_object('jobId',p_job,'status','READY');
END $fn$;

CREATE OR REPLACE FUNCTION profitia_jobs.observe_delivery(p_job uuid,p_lease uuid,p_source text,p_effect uuid,p_digest text,p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE j profitia_jobs.dispatches%ROWTYPE; s jsonb;
BEGIN
 IF profitia_request_work.active_in_transaction() THEN RETURN NULL;END IF;
  IF profitia_jobs.scope_allows(p_job) IS NOT TRUE OR p_effect IS NULL OR p_digest !~ '^[a-f0-9]{64}$'
    OR p_status NOT IN('COMMITTED','PENDING','NOT_FOUND','UNCERTAIN') THEN RETURN NULL; END IF;
  SELECT * INTO j FROM profitia_jobs.dispatches WHERE job_id=p_job FOR UPDATE;
  IF j.lease_id IS DISTINCT FROM p_lease OR j.lease_expires_at<=clock_timestamp()
    OR j.source_id IS DISTINCT FROM p_source OR j.status<>'READY' THEN RETURN NULL; END IF;
  s:=profitia_services.runtime_descriptor();
  INSERT INTO profitia_jobs.delivery_observations(observation_id,job_id,source_id,source_effect_id,receipt_digest,status,observing_role,observing_service_id)
    VALUES(gen_random_uuid(),p_job,p_source,p_effect,p_digest,p_status,session_user,(s->>'serviceId')::uuid)
    ON CONFLICT(job_id,source_id,source_effect_id,receipt_digest,status) DO NOTHING;
  UPDATE profitia_jobs.dispatches SET status=CASE WHEN p_status='COMMITTED' THEN 'CONFIRMED' ELSE 'UNCERTAIN' END,
    lease_id=NULL,lease_expires_at=NULL,updated_at=clock_timestamp() WHERE job_id=p_job;
  RETURN jsonb_build_object('jobId',p_job,'status',CASE WHEN p_status='COMMITTED' THEN 'CONFIRMED' ELSE 'UNCERTAIN' END);
END $fn$;

CREATE OR REPLACE FUNCTION profitia_request_phases.reserve(p_request uuid,p_phase text,p_input text,p_decision uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_requests.intents%ROWTYPE;p profitia_request_phases.policies%ROWTYPE;e profitia_request_phases.effects%ROWTYPE;
BEGIN
 IF profitia_request_work.active_in_transaction() THEN RETURN NULL;END IF;
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

-- Extend the same canonical writer; preserve the SQL015 defaults.
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
    OR EXISTS(SELECT 1 FROM jsonb_each(p_event) v WHERE v.key NOT IN ('productEvidence','moduleEvidence','requestContinuation','requestInspection','requestWork')
      AND (jsonb_typeof(v.value) NOT IN ('string','null') OR length(v.value#>>'{}')>512))
    OR (p_event ? 'productEvidence' AND jsonb_typeof(p_event->'productEvidence') IS DISTINCT FROM 'array')
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_event) k WHERE k NOT IN (
      'decisionId','contractId','contractVersion','implementationVersion','applicationId','applicationProfile',
      'deploymentId','configurationVersion','environment','operationStartedAt','occurredAt','operation',
      'actorId','actorKind','subjectUserId','organisationId','identityProofRef','identityIssuer','identityAudience',
      'resourceId','payloadDigest','mode','policyVersion','accessBasisType','accessVersion','accessSourceRef',
      'feature','effect','correlationId','resourceType','dataClass','ownerOrganisationId','ownerUserId',
      'resourceVersion','projectionVersion','productEvidence','moduleEvidence','requestContinuation','requestInspection','requestWork','usagePolicy','phase','decision','reasonCode')) THEN
    RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
  END IF;
  IF p_event ? 'requestWork' AND profitia_request_work.audit_allows(p_event) IS NOT TRUE THEN
    RAISE EXCEPTION 'Native SQL work evidence invalid' USING ERRCODE='42501';END IF;
  IF p_event->>'decision'='ALLOW' AND (
    (p_event ? 'requestWork' AND EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.phase='INTENT'
      AND (s.event->'requestInspection'->>'transactionId'=txid_current()::text OR s.event->'requestContinuation'->>'transactionId'=txid_current()::text)))
    OR ((p_event ? 'requestInspection' OR p_event ? 'requestContinuation') AND EXISTS(SELECT 1 FROM profitia_access.security_events s
      WHERE s.phase='INTENT' AND s.event->'requestWork'->>'transactionId'=txid_current()::text))) THEN
    RAISE EXCEPTION 'Native work cannot mix with a phase or inspection transaction' USING ERRCODE='42501';END IF;
  IF p_event ? 'requestInspection' AND profitia_request_inspection.audit_allows(p_event) IS NOT TRUE THEN
    RAISE EXCEPTION 'Private inspection evidence invalid' USING ERRCODE='42501';END IF;
  IF p_event ? 'requestContinuation' AND EXISTS(SELECT 1 FROM profitia_access.security_events s
    WHERE s.phase='INTENT' AND s.application_id=p_event->>'applicationId' AND s.environment=p_event->>'environment'
      AND s.event->>'resourceId'=p_event->>'resourceId' AND s.event->'requestInspection'->>'transactionId'=txid_current()::text) THEN
    RAISE EXCEPTION 'Private inspection cannot become a write phase' USING ERRCODE='42501';END IF;
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

REVOKE ALL ON ALL TABLES IN SCHEMA profitia_request_work FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_request_work FROM PUBLIC;
