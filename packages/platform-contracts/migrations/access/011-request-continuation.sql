-- Optional private SQL continuation only. SQL001-010 remain byte-for-byte
-- unchanged. No role grants, remote work, global source write or activation.
DO $owner$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles
  WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_requests.installation WHERE singleton
   AND schema_digest='0af5eed241ad1db08bfed89c95c47ef21a7dbeed0ee54bcccce52164ddcc4127')
  OR NOT EXISTS(SELECT 1 FROM profitia_requests.external_installation WHERE singleton
   AND schema_digest='8244a3a02d4ef5821822a6684023148c41bc9caac355c9f1200215e1a339df79') THEN
  RAISE EXCEPTION 'Controlled owner and accepted request schemas required' USING ERRCODE='42501';END IF;
END $owner$;
CREATE SCHEMA profitia_request_phases AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_request_phases FROM PUBLIC;
CREATE TABLE profitia_request_phases.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE profitia_request_phases.policies(
 application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
 phase_id text NOT NULL CHECK(phase_id~'^[A-Z][A-Z0-9_]{0,63}$'),
 sequence integer NOT NULL CHECK(sequence BETWEEN 1 AND 32),predecessor text,
 operation text NOT NULL CHECK(operation='supplier.report.refresh'),effect text NOT NULL CHECK(effect='PRIVATE_SQL_PHASE'),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 PRIMARY KEY(application_id,phase_id),UNIQUE(application_id,sequence),
 FOREIGN KEY(application_id,predecessor) REFERENCES profitia_request_phases.policies(application_id,phase_id),
 CHECK(sequence=1 AND predecessor IS NULL OR sequence>1 AND predecessor IS NOT NULL AND predecessor<>phase_id)
);
CREATE TABLE profitia_request_phases.effects(
 request_id uuid NOT NULL REFERENCES profitia_requests.intents(request_id),phase_id text NOT NULL,
 application_id text NOT NULL,environment text NOT NULL,organisation_id uuid NOT NULL,user_id uuid NOT NULL,
 resource_id text NOT NULL,payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
 input_digest text NOT NULL CHECK(input_digest~'^[a-f0-9]{64}$'),policy_version bigint NOT NULL CHECK(policy_version>0),
 decision_id uuid NOT NULL,transaction_id bigint NOT NULL,
 status text NOT NULL CHECK(status IN('RESERVED','ACCEPTED')),
 reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(),accepted_at timestamptz,
 PRIMARY KEY(request_id,phase_id),FOREIGN KEY(application_id,phase_id) REFERENCES profitia_request_phases.policies(application_id,phase_id),
 CHECK(status='RESERVED' AND accepted_at IS NULL OR status='ACCEPTED' AND accepted_at IS NOT NULL)
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','policies','effects'] LOOP
  EXECUTE format('ALTER TABLE profitia_request_phases.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_request_phases.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY controlled_owner ON profitia_request_phases.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY read_fence ON profitia_request_phases.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_access_owner'')',t);
  EXECUTE format('CREATE POLICY insert_fence ON profitia_request_phases.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_access_owner'')',t);
  EXECUTE format('CREATE POLICY update_fence ON profitia_request_phases.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
  EXECUTE format('CREATE POLICY delete_fence ON profitia_request_phases.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false)',t);
 END LOOP;
END $rls$;

CREATE FUNCTION profitia_request_phases.descriptor(p_phase text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_request_phases.installation%ROWTYPE;p profitia_request_phases.policies%ROWTYPE;
BEGIN
 d:=profitia_requests.external_runtime_descriptor();
 IF d IS NULL OR current_user<>'profitia_access_owner' THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_request_phases.installation WHERE singleton;
 IF NOT FOUND OR i.schema_version<>'1.0.0'
  OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='profitia_request_phases' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
    AND c.relowner='profitia_access_owner'::regrole)<>3
  OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='profitia_request_phases' AND c.relkind='r'
    AND (has_table_privilege(session_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(session_user,c.oid,'INSERT,UPDATE,REFERENCES')))
  OR has_schema_privilege(session_user,'profitia_request_phases','CREATE') THEN RETURN NULL;END IF;
 SELECT * INTO p FROM profitia_request_phases.policies WHERE application_id=d->>'applicationId' AND phase_id=p_phase
  AND status='ACTIVE' AND expires_at>clock_timestamp() FOR SHARE;
 IF NOT FOUND OR (p.sequence>1 AND NOT EXISTS(SELECT 1 FROM profitia_request_phases.policies prior
    WHERE prior.application_id=p.application_id AND prior.phase_id=p.predecessor AND prior.sequence=p.sequence-1)) THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,'owner','profitia_access_owner',
  'phaseId',p.phase_id,'operation',p.operation,'effect',p.effect,'policyVersion',p.version::text,
  'sourceRef',p.source_ref,'expiresAt',p.expires_at,'transactionId',txid_current()::text);
END $fn$;

CREATE FUNCTION profitia_request_phases.parent_available(p_request uuid,p_org uuid,p_user uuid,p_resource text,p_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_requests.intents%ROWTYPE;
BEGIN
 d:=profitia_requests.external_runtime_descriptor();
 IF d IS NULL OR profitia_requests.scope_allows('supplier.report.refresh',p_org,p_user,p_resource) IS NOT TRUE THEN RETURN false;END IF;
 SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request FOR UPDATE;
 RETURN FOUND AND r.status='ACCEPTED' AND r.operation='supplier.report.refresh'
  AND r.application_id=d->>'applicationId' AND r.environment=d->>'environment'
  AND r.organisation_id=p_org AND r.user_id=p_user AND r.resource_id=p_resource AND r.payload_digest=p_digest;
END $fn$;

CREATE FUNCTION profitia_request_phases.reserve(p_request uuid,p_phase text,p_input text,p_decision uuid,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;r profitia_requests.intents%ROWTYPE;p profitia_request_phases.policies%ROWTYPE;e profitia_request_phases.effects%ROWTYPE;
BEGIN
 d:=profitia_request_phases.descriptor(p_phase);
 IF d IS NULL OR p_request IS NULL OR p_decision IS NULL OR p_input IS NULL OR p_input !~ '^[a-f0-9]{64}$'
  OR p_version IS DISTINCT FROM (d->>'policyVersion')::bigint THEN RETURN NULL;END IF;
 SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request FOR UPDATE;
 IF NOT FOUND OR profitia_request_phases.parent_available(r.request_id,r.organisation_id,r.user_id,r.resource_id,r.payload_digest) IS NOT TRUE
  THEN RETURN jsonb_build_object('status','DENIED','reasonCode','RESOURCE_SCOPE_MISMATCH');END IF;
 SELECT * INTO p FROM profitia_request_phases.policies WHERE application_id=r.application_id AND phase_id=p_phase;
 SELECT * INTO e FROM profitia_request_phases.effects WHERE request_id=p_request AND phase_id=p_phase FOR UPDATE;
 IF FOUND THEN
  IF e.input_digest IS DISTINCT FROM p_input THEN RETURN jsonb_build_object('status','DENIED','reasonCode','IDEMPOTENCY_CONFLICT');END IF;
  IF e.status<>'ACCEPTED' OR e.policy_version<>p_version THEN RETURN NULL;END IF;
  RETURN jsonb_build_object('status','REPLAY','phaseId',p_phase,'inputDigest',p_input,'decisionId',e.decision_id,'transactionId',txid_current()::text);
 END IF;
 IF p.predecessor IS NOT NULL AND NOT EXISTS(SELECT 1 FROM profitia_request_phases.effects
  WHERE request_id=p_request AND phase_id=p.predecessor AND status='ACCEPTED') THEN
  RETURN jsonb_build_object('status','DENIED','reasonCode','RESOURCE_SCOPE_MISMATCH');END IF;
 INSERT INTO profitia_request_phases.effects(request_id,phase_id,application_id,environment,organisation_id,user_id,
  resource_id,payload_digest,input_digest,policy_version,decision_id,transaction_id,status)
  VALUES(p_request,p_phase,r.application_id,r.environment,r.organisation_id,r.user_id,r.resource_id,r.payload_digest,p_input,p_version,p_decision,txid_current(),'RESERVED');
 RETURN jsonb_build_object('status','NEW','phaseId',p_phase,'inputDigest',p_input,'decisionId',p_decision,'transactionId',txid_current()::text);
END $fn$;

CREATE FUNCTION profitia_request_phases.accept(p_request uuid,p_phase text,p_input text,p_decision uuid,p_version bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;e profitia_request_phases.effects%ROWTYPE;
BEGIN
 d:=profitia_request_phases.descriptor(p_phase);
 IF d IS NULL OR p_version IS DISTINCT FROM (d->>'policyVersion')::bigint THEN RETURN false;END IF;
 SELECT * INTO e FROM profitia_request_phases.effects WHERE request_id=p_request AND phase_id=p_phase FOR UPDATE;
 IF NOT FOUND OR e.status<>'RESERVED' OR e.decision_id IS DISTINCT FROM p_decision OR e.input_digest IS DISTINCT FROM p_input
  OR e.policy_version IS DISTINCT FROM p_version OR e.transaction_id<>txid_current()
  OR profitia_request_phases.parent_available(e.request_id,e.organisation_id,e.user_id,e.resource_id,e.payload_digest) IS NOT TRUE THEN RETURN false;END IF;
 UPDATE profitia_request_phases.effects SET status='ACCEPTED',accepted_at=clock_timestamp() WHERE request_id=p_request AND phase_id=p_phase;
 RETURN true;
END $fn$;

CREATE FUNCTION profitia_request_phases.immutable_effect() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF TG_OP='DELETE' OR OLD.status<>'RESERVED' OR NEW.status<>'ACCEPTED'
  OR OLD.transaction_id<>txid_current() OR NEW.accepted_at IS NULL
  OR (to_jsonb(NEW)-ARRAY['status','accepted_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','accepted_at']) THEN
  RAISE EXCEPTION 'Immutable private continuation' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER immutable_effect BEFORE UPDATE OR DELETE ON profitia_request_phases.effects
 FOR EACH ROW EXECUTE FUNCTION profitia_request_phases.immutable_effect();

CREATE FUNCTION profitia_request_phases.immutable_policy() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-ARRAY['status','expires_at','version'])
  IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','expires_at','version']) THEN
  RAISE EXCEPTION 'Private phase policy definition is immutable' USING ERRCODE='23514';END IF;
 NEW.version:=OLD.version+1;
 RETURN NEW;
END $fn$;
CREATE TRIGGER immutable_policy BEFORE UPDATE OR DELETE ON profitia_request_phases.policies
 FOR EACH ROW EXECUTE FUNCTION profitia_request_phases.immutable_policy();

CREATE FUNCTION profitia_request_phases.require_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e profitia_request_phases.effects%ROWTYPE;
BEGIN
 SELECT * INTO e FROM profitia_request_phases.effects WHERE request_id=NEW.request_id AND phase_id=NEW.phase_id;
 IF NOT FOUND OR e.status<>'ACCEPTED' OR e.transaction_id<>txid_current() OR NOT EXISTS(
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
CREATE CONSTRAINT TRIGGER completed_private_phase AFTER INSERT OR UPDATE ON profitia_request_phases.effects
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION profitia_request_phases.require_completion();
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_request_phases FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_request_phases FROM PUBLIC;
