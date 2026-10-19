-- Optional read inspection of an already committed Supplier phase.
-- Reuses current job scope, original effects and canonical audit. No second
-- ledger, parent/quota, dispatch claim, provider call, role/ACL or activation.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_delegated_phases.installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='13f4bb374cbfb31604823083261bbc8f5142e88be7443b704c792a232defb6e3') THEN
  RAISE EXCEPTION 'Controlled accepted delegated phase installation required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE SCHEMA profitia_request_inspection AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_request_inspection FROM PUBLIC;
CREATE TABLE profitia_request_inspection.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
ALTER TABLE profitia_request_inspection.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_request_inspection.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_request_inspection.installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY immutable_fence ON profitia_request_inspection.installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_request_inspection.installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_request_inspection.installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();

CREATE FUNCTION profitia_request_inspection.descriptor(p_request uuid,p_phase text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_request_inspection.installation%ROWTYPE;e profitia_request_phases.effects%ROWTYPE;
BEGIN
 IF current_user<>'profitia_access_owner' OR profitia_jobs.scope_allows(p_request) IS NOT TRUE THEN RETURN NULL;END IF;
 d:=profitia_request_phases.delegated_descriptor(p_request,p_phase);
 IF d IS NULL OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='profitia_request_inspection.installation'::regclass
   AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
  OR has_table_privilege(session_user,'profitia_request_inspection.installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'profitia_request_inspection.installation','SELECT,INSERT,UPDATE,REFERENCES')
  OR has_schema_privilege(session_user,'profitia_request_inspection','CREATE') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_request_inspection.installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO e FROM profitia_request_phases.effects WHERE request_id=p_request AND phase_id=p_phase;
 IF NOT FOUND OR e.status<>'ACCEPTED' OR e.accepted_at IS NULL OR e.transaction_id=txid_current()
  OR e.application_id IS DISTINCT FROM d->>'parentApplicationId' OR e.environment IS DISTINCT FROM d->>'environment'
  OR e.organisation_id::text IS DISTINCT FROM d->>'organisationId' OR e.user_id::text IS DISTINCT FROM d->>'subjectUserId'
  OR e.resource_id IS DISTINCT FROM d->>'resourceId' OR e.payload_digest IS DISTINCT FROM d->>'payloadDigest'
  OR e.policy_version::text IS DISTINCT FROM d->>'policyVersion'
  OR EXISTS(SELECT 1 FROM profitia_request_phases.effects mixed WHERE mixed.request_id=p_request AND mixed.transaction_id=txid_current()) THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('effect','PRIVATE_SQL_READ','inspectionSchemaVersion',i.schema_version,
  'inspectionSchemaDigest',i.schema_digest,'inspectionSourceRef',i.source_ref,'inputDigest',e.input_digest,
  'acceptedTransactionId',e.transaction_id::text);
END $fn$;
CREATE FUNCTION profitia_request_inspection.evidence(p_descriptor jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT jsonb_build_object('requestId',p_descriptor->>'requestId','phaseId',p_descriptor->>'phaseId',
  'inputDigest',p_descriptor->>'inputDigest','policyVersion',p_descriptor->>'policyVersion',
  'schemaDigest',p_descriptor->>'inspectionSchemaDigest','continuationSchemaDigest',p_descriptor->>'schemaDigest',
  'delegatedSchemaDigest',p_descriptor->>'delegatedSchemaDigest','transactionId',p_descriptor->>'transactionId',
  'acceptedTransactionId',p_descriptor->>'acceptedTransactionId')
$fn$;
CREATE FUNCTION profitia_request_inspection.audit_allows(p_event jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c jsonb;d jsonb;BEGIN
 c:=p_event->'requestInspection';
 IF p_event ? 'requestContinuation' OR jsonb_typeof(c) IS DISTINCT FROM 'object'
  OR (SELECT count(*) FROM jsonb_object_keys(c))<>9
  OR EXISTS(SELECT 1 FROM jsonb_each(c) v WHERE jsonb_typeof(v.value)<>'string' OR length(v.value#>>'{}')>256)
  OR c->>'requestId' !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  OR c->>'phaseId' NOT IN('REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST')
  OR c->>'inputDigest' !~ '^[a-f0-9]{64}$' OR c->>'schemaDigest' !~ '^[a-f0-9]{64}$'
  OR c->>'continuationSchemaDigest' !~ '^[a-f0-9]{64}$' OR c->>'delegatedSchemaDigest' !~ '^[a-f0-9]{64}$'
  OR c->>'policyVersion' !~ '^[1-9][0-9]*$' OR c->>'transactionId' !~ '^[1-9][0-9]*$'
  OR c->>'acceptedTransactionId' !~ '^[1-9][0-9]*$' OR c->>'transactionId'=c->>'acceptedTransactionId'
  OR p_event->>'operation'<>'job.execute' OR p_event->>'actorKind'<>'SERVICE' THEN RETURN false;END IF;
 IF p_event->>'phase' IN('DECISION','FAILURE') THEN RETURN p_event->>'decision'='DENY';END IF;
 d:=profitia_request_inspection.descriptor((c->>'requestId')::uuid,c->>'phaseId');
 IF d IS NULL OR c IS DISTINCT FROM profitia_request_inspection.evidence(d)
  OR p_event->>'resourceId' IS DISTINCT FROM d->>'requestId' OR p_event->>'payloadDigest' IS DISTINCT FROM d->>'payloadDigest'
  OR p_event->>'applicationId' IS DISTINCT FROM d->>'applicationId' OR p_event->>'environment' IS DISTINCT FROM d->>'environment'
  OR p_event->>'actorId' IS DISTINCT FROM d->>'executorServiceId' OR p_event->>'subjectUserId' IS DISTINCT FROM d->>'subjectUserId'
  OR p_event->>'organisationId' IS DISTINCT FROM d->>'organisationId' OR p_event->>'decision'<>'ALLOW' THEN RETURN false;END IF;
 IF p_event->>'phase'='INTENT' THEN RETURN p_event->>'reasonCode'='AUTHORIZED';END IF;
 IF p_event->>'phase'<>'OUTCOME' OR p_event->>'reasonCode'<>'SUCCEEDED' THEN RETURN false;END IF;
 RETURN profitia_request_inspection.scope_allows((c->>'requestId')::uuid,c->>'phaseId',(d->>'organisationId')::uuid,(d->>'subjectUserId')::uuid)
  AND EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.decision_id=(p_event->>'decisionId')::uuid AND s.phase='INTENT'
   AND s.event->>'correlationId'=p_event->>'correlationId' AND s.event->'requestInspection'=c);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;END $fn$;

CREATE FUNCTION profitia_request_inspection.bind_scope(p_request uuid,p_phase text,p_input text,p_decision uuid,p_correlation uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 d:=profitia_request_inspection.descriptor(p_request,p_phase);
 IF d IS NULL OR d->>'inputDigest' IS DISTINCT FROM p_input OR NOT EXISTS(
  SELECT 1 FROM profitia_access.security_events s WHERE s.decision_id=p_decision AND s.phase='INTENT'
   AND s.event->>'correlationId'=p_correlation::text AND s.event->'requestInspection'=profitia_request_inspection.evidence(d)
   AND profitia_request_inspection.audit_allows(s.event)) THEN RETURN false;END IF;
 PERFORM set_config('profitia.inspection.scope',jsonb_build_array(p_request,p_phase,p_decision,p_correlation,txid_current()::text)::text,true);
 RETURN profitia_request_inspection.scope_allows(p_request,p_phase,(d->>'organisationId')::uuid,(d->>'subjectUserId')::uuid);
END $fn$;
CREATE FUNCTION profitia_request_inspection.scope_allows(p_request uuid,p_phase text,p_org uuid,p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE m jsonb;d jsonb;BEGIN
 m:=nullif(current_setting('profitia.inspection.scope',true),'')::jsonb;
 IF jsonb_typeof(m) IS DISTINCT FROM 'array' OR jsonb_array_length(m)<>5 OR m->>0 IS DISTINCT FROM p_request::text
  OR m->>1 IS DISTINCT FROM p_phase OR m->>4 IS DISTINCT FROM txid_current()::text THEN RETURN false;END IF;
 d:=profitia_request_inspection.descriptor(p_request,p_phase);
 IF d IS NULL OR d->>'organisationId' IS DISTINCT FROM p_org::text OR d->>'subjectUserId' IS DISTINCT FROM p_user::text THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.decision_id=(m->>2)::uuid AND s.phase='INTENT'
  AND s.event->>'correlationId'=m->>3 AND s.event->'requestInspection'=profitia_request_inspection.evidence(d)
  AND profitia_request_inspection.audit_allows(s.event));
EXCEPTION WHEN invalid_text_representation THEN RETURN false;END $fn$;
CREATE FUNCTION profitia_request_inspection.enforce_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.decision_id=NEW.decision_id AND s.phase='OUTCOME'
  AND s.event->>'correlationId'=NEW.event->>'correlationId' AND s.event->'requestInspection'=NEW.event->'requestInspection'
  AND profitia_request_inspection.audit_allows(s.event)) THEN
  RAISE EXCEPTION 'Private inspection needs same-transaction canonical OUTCOME' USING ERRCODE='23514';END IF;
 RETURN NULL;END $fn$;
CREATE INDEX private_inspection_transaction_idx ON profitia_access.security_events
 (application_id,environment,((event->'requestInspection'->>'transactionId')),((event->>'resourceId')))
 WHERE phase='INTENT' AND event ? 'requestInspection';
CREATE CONSTRAINT TRIGGER private_inspection_outcome AFTER INSERT ON profitia_access.security_events
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 WHEN(NEW.phase='INTENT' AND NEW.event ? 'requestInspection') EXECUTE FUNCTION profitia_request_inspection.enforce_audit();

-- Extend the SAME canonical audit writer. Defaults retain SQL014 semantics.
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
    OR EXISTS(SELECT 1 FROM jsonb_each(p_event) v WHERE v.key NOT IN ('productEvidence','moduleEvidence','requestContinuation','requestInspection')
      AND (jsonb_typeof(v.value) NOT IN ('string','null') OR length(v.value#>>'{}')>512))
    OR (p_event ? 'productEvidence' AND jsonb_typeof(p_event->'productEvidence') IS DISTINCT FROM 'array')
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_event) k WHERE k NOT IN (
      'decisionId','contractId','contractVersion','implementationVersion','applicationId','applicationProfile',
      'deploymentId','configurationVersion','environment','operationStartedAt','occurredAt','operation',
      'actorId','actorKind','subjectUserId','organisationId','identityProofRef','identityIssuer','identityAudience',
      'resourceId','payloadDigest','mode','policyVersion','accessBasisType','accessVersion','accessSourceRef',
      'feature','effect','correlationId','resourceType','dataClass','ownerOrganisationId','ownerUserId',
      'resourceVersion','projectionVersion','productEvidence','moduleEvidence','requestContinuation','requestInspection','usagePolicy','phase','decision','reasonCode')) THEN
    RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
  END IF;
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

REVOKE ALL ON profitia_request_inspection.installation FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_request_inspection.descriptor(uuid,text),profitia_request_inspection.evidence(jsonb),
 profitia_request_inspection.audit_allows(jsonb),profitia_request_inspection.bind_scope(uuid,text,text,uuid,uuid),
 profitia_request_inspection.scope_allows(uuid,text,uuid,uuid),profitia_request_inspection.enforce_audit() FROM PUBLIC;
