-- Optional closed Supplier target for the SAME private job/dispatch engine.
-- Historical SQL001--012 remain unchanged. No source effect, worker, role,
-- runtime grant, seed, account or deployment is created by this migration.
DO $owner$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
   OR NOT EXISTS(SELECT 1 FROM profitia_jobs.installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='6a12132efab396e6e647e15d1a9711d0a1bacaaab4482639178acd0258d518cb')
   OR NOT EXISTS(SELECT 1 FROM profitia_requests.external_installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='8244a3a02d4ef5821822a6684023148c41bc9caac355c9f1200215e1a339df79') THEN
  RAISE EXCEPTION 'Accepted controlled job and external request installations required' USING ERRCODE='42501';END IF;
END $owner$;
CREATE SCHEMA profitia_supplier_jobs AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_supplier_jobs FROM PUBLIC;
CREATE TABLE profitia_supplier_jobs.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
ALTER TABLE profitia_supplier_jobs.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_supplier_jobs.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_supplier_jobs.installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY read_fence ON profitia_supplier_jobs.installation AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='profitia_access_owner');
CREATE POLICY insert_fence ON profitia_supplier_jobs.installation AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY update_fence ON profitia_supplier_jobs.installation AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(false) WITH CHECK(false);
CREATE POLICY delete_fence ON profitia_supplier_jobs.installation AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false);
CREATE FUNCTION profitia_supplier_jobs.immutable() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 RAISE EXCEPTION 'Supplier delegation installation is immutable' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_supplier_jobs.installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_supplier_jobs.installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE FUNCTION profitia_jobs.supplier_runtime_descriptor() RETURNS jsonb LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i profitia_supplier_jobs.installation%ROWTYPE;BEGIN
 d:=profitia_jobs.runtime_descriptor();
 IF d IS NULL OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='profitia_supplier_jobs.installation'::regclass
   AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'profitia_supplier_jobs.installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'profitia_supplier_jobs.installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM profitia_supplier_jobs.installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('supplierSchemaVersion',i.schema_version,'supplierSchemaDigest',i.schema_digest,'supplierSourceRef',i.source_ref);
END $fn$;
ALTER TABLE profitia_jobs.operation_bindings DROP CONSTRAINT operation_bindings_operation_check;
ALTER TABLE profitia_jobs.operation_bindings ADD CONSTRAINT operation_bindings_operation_check CHECK(operation IN('forecast.request','supplier.report.refresh'));
ALTER TABLE profitia_jobs.operation_bindings DROP CONSTRAINT operation_bindings_profile_id_check;
ALTER TABLE profitia_jobs.operation_bindings ADD CONSTRAINT operation_bindings_profile_id_check CHECK(
 operation='forecast.request' AND profile_id IN('PORR_SUITE','SPENDGURU_SAAS')
 OR operation='supplier.report.refresh' AND profile_id IN('PORR_SUITE','SPENDGURU_SAAS','SUPPLIER_INTELLIGENCE_STANDALONE'));
ALTER TABLE profitia_jobs.delegations DROP CONSTRAINT delegations_operation_check;
ALTER TABLE profitia_jobs.delegations ADD CONSTRAINT delegations_operation_check CHECK(operation IN('forecast.request','supplier.report.refresh'));

CREATE OR REPLACE FUNCTION profitia_jobs.create_dispatch(p_request uuid,p_decision uuid,p_configuration text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; r profitia_requests.intents%ROWTYPE; b profitia_jobs.operation_bindings%ROWTYPE;
  e profitia_access.external_identities%ROWTYPE; uid uuid; org uuid; account_version bigint;
  created uuid; deadline timestamptz;
BEGIN
  d:=profitia_jobs.runtime_descriptor();
  uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
  org:=nullif(current_setting('profitia.organisation_id',true),'')::uuid;
  SELECT * INTO r FROM profitia_requests.intents WHERE request_id=p_request FOR UPDATE;
  IF d IS NULL OR NOT FOUND OR r.status<>'RESERVED' OR r.decision_id IS DISTINCT FROM p_decision
    OR r.user_id IS DISTINCT FROM uid OR r.organisation_id IS DISTINCT FROM org
    OR r.application_id IS DISTINCT FROM d->>'applicationId' OR r.environment IS DISTINCT FROM d->>'environment'
    OR profitia_requests.scope_allows(r.operation,org,uid,r.resource_id) IS NOT TRUE
    OR r.operation NOT IN('forecast.request','supplier.report.refresh')
    OR r.operation='supplier.report.refresh' AND profitia_jobs.supplier_runtime_descriptor() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO b FROM profitia_jobs.operation_bindings WHERE application_id=r.application_id
    AND operation=r.operation AND foreground_role=session_user AND configuration_version=p_configuration
    AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT a.version INTO account_version FROM profitia_access.accounts a WHERE user_id=uid AND status='ACTIVE';
  SELECT * INTO e FROM profitia_access.external_identities WHERE user_id=uid AND status='ACTIVE'
    AND expires_at>clock_timestamp() AND binding_id::text||':'||version::text||':'||account_version::text
      =current_setting('profitia.identity_binding_version',true);
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Explicit delegation lifetime, independent of a short-lived browser token.
  -- Current account/binding/membership/product/module are read again at use.
  deadline:=least(clock_timestamp()+b.delegation_ttl_seconds*interval '1 second',b.expires_at,e.expires_at);
  created:=gen_random_uuid();
  INSERT INTO profitia_jobs.delegations(delegation_id,request_id,application_id,environment,organisation_id,user_id,
    operation,resource_id,payload_digest,binding_id,binding_version,identity_binding_id,identity_binding_version,
    account_version,status,source_ref,expires_at)
    VALUES(created,r.request_id,r.application_id,r.environment,org,uid,r.operation,r.resource_id,r.payload_digest,
      b.binding_id,b.version,e.binding_id,e.version,account_version,'ACTIVE',b.source_ref,deadline);
  INSERT INTO profitia_jobs.dispatches(job_id,request_id,delegation_id,source_id,delivery_key,status)
    VALUES(r.request_id,r.request_id,created,b.source_id,
      encode(sha256(convert_to(jsonb_build_array(d->>'projectId',d->>'branchId',r.environment,r.application_id,r.request_id,b.source_id)::text,'UTF8')),'hex'),'PENDING');
  RETURN jsonb_build_object('jobId',r.request_id,'requestId',r.request_id,'status','PENDING');
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION profitia_jobs.current_job(p_job uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;j profitia_jobs.dispatches%ROWTYPE;g profitia_jobs.delegations%ROWTYPE;
  b profitia_jobs.operation_bindings%ROWTYPE;e profitia_access.external_identities%ROWTYPE;
  m profitia_access.memberships%ROWTYPE; a profitia_access.applications%ROWTYPE;
  module_grant profitia_modules.application_bindings%ROWTYPE; product_grant profitia_access.product_grants%ROWTYPE;
  deadline timestamptz; grant_expiry timestamptz; permissions jsonb; denies jsonb; target_access jsonb; target_config jsonb;
  target_feature text;target_module text;target_product text;required_features text[];target_resource text;target_projection text;
BEGIN
  d:=profitia_jobs.runtime_descriptor();s:=profitia_services.runtime_descriptor();
  IF d IS NULL OR s IS NULL OR s->>'profileId'<>'PLATFORM_INTERNAL' OR d->>'fixedOrganisationId' IS NOT NULL THEN RETURN NULL; END IF;
  SELECT * INTO j FROM profitia_jobs.dispatches WHERE job_id=p_job;
  IF NOT FOUND OR j.status IN('EXPIRED','CANCELLED') THEN RETURN NULL; END IF;
  SELECT * INTO g FROM profitia_jobs.delegations WHERE delegation_id=j.delegation_id AND status='ACTIVE'
    AND environment=d->>'environment' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF g.operation='forecast.request' THEN
   target_feature:='forecast';target_module:='benchmark';target_product:='SPENDGURU';required_features:=ARRAY['benchmark','forecast'];target_resource:='forecast_request';target_projection:='request-v1';
  ELSIF g.operation='supplier.report.refresh' AND profitia_jobs.supplier_runtime_descriptor() IS NOT NULL THEN
   target_feature:='supplier_report';target_module:='supplier_report';target_product:='SUPPLIER_INTELLIGENCE';required_features:=ARRAY['supplier_report'];target_resource:='supplier_report_request';target_projection:='external-request-v1';
  ELSE RETURN NULL;END IF;
  IF NOT EXISTS(SELECT 1 FROM profitia_requests.intents WHERE request_id=g.request_id AND status='ACCEPTED') THEN RETURN NULL; END IF;
  SELECT * INTO b FROM profitia_jobs.operation_bindings WHERE binding_id=g.binding_id AND version=g.binding_version
    AND application_id=g.application_id AND operation=g.operation AND status='ACTIVE' AND expires_at>clock_timestamp()
    AND executor_application_id=d->>'applicationId' AND source_id=j.source_id;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM profitia_access.runtime_bindings
    WHERE login_role=b.foreground_role AND application_id=b.application_id AND status='ACTIVE') THEN RETURN NULL; END IF;
  SELECT * INTO a FROM profitia_access.applications WHERE application_id=g.application_id AND status='ACTIVE';
  IF NOT FOUND OR (b.profile_id='PORR_SUITE' AND a.fixed_organisation_id IS DISTINCT FROM g.organisation_id)
    OR (b.profile_id<>'PORR_SUITE' AND a.fixed_organisation_id IS NOT NULL) THEN RETURN NULL; END IF;
  SELECT e1.* INTO e FROM profitia_access.external_identities e1 JOIN profitia_access.accounts u USING(user_id)
    WHERE e1.binding_id=g.identity_binding_id AND e1.version=g.identity_binding_version AND e1.user_id=g.user_id
      AND e1.status='ACTIVE' AND e1.expires_at>clock_timestamp() AND u.status='ACTIVE' AND u.version=g.account_version;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT mm.* INTO m FROM profitia_access.memberships mm JOIN profitia_access.organisations o USING(organisation_id)
    WHERE mm.organisation_id=g.organisation_id AND mm.user_id=g.user_id AND mm.status='ACTIVE'
      AND mm.expires_at>clock_timestamp() AND o.status='ACTIVE';
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO module_grant FROM profitia_modules.application_bindings WHERE application_id=g.application_id
    AND module_id=target_module AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO product_grant FROM profitia_access.product_grants WHERE application_id=g.application_id
    AND organisation_id=g.organisation_id AND product=target_product AND status='ACTIVE'
    AND features @> required_features AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT min(expires_at) INTO grant_expiry FROM profitia_jobs.execution_grants
    WHERE login_role=session_user AND binding_id=b.binding_id AND organisation_id=g.organisation_id
      AND effect='ALLOW' AND status='ACTIVE' AND expires_at>clock_timestamp()
      AND (resource_id IS NULL OR resource_id=g.resource_id);
  IF grant_expiry IS NULL OR EXISTS(SELECT 1 FROM profitia_jobs.execution_grants
    WHERE login_role=session_user AND binding_id=b.binding_id AND organisation_id=g.organisation_id
      AND effect='DENY' AND status='ACTIVE' AND expires_at>clock_timestamp()
      AND (resource_id IS NULL OR resource_id=g.resource_id)) THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id)) FILTER(WHERE effect='ALLOW'),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id)) FILTER(WHERE effect='DENY'),'[]'::jsonb)
    INTO permissions,denies FROM profitia_access.permission_grants WHERE application_id=g.application_id
      AND organisation_id=g.organisation_id AND user_id=g.user_id;
  IF NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=g.application_id
      AND organisation_id=g.organisation_id AND user_id=g.user_id AND operation=g.operation AND feature=target_feature
      AND effect='ALLOW' AND (resource_id IS NULL OR resource_id=g.resource_id))
    OR EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=g.application_id
      AND organisation_id=g.organisation_id AND user_id=g.user_id AND operation=g.operation AND feature=target_feature
      AND effect='DENY' AND (resource_id IS NULL OR resource_id=g.resource_id)) THEN RETURN NULL; END IF;
  deadline:=least((s->>'expiresAt')::timestamptz,g.expires_at,b.expires_at,e.expires_at,m.expires_at,
    module_grant.expires_at,product_grant.expires_at,grant_expiry,clock_timestamp()+interval '30 seconds');
  target_access:=jsonb_build_object('type','MEMBERSHIP','actorId',g.user_id,'organisationId',g.organisation_id,
    'status','ACTIVE','version',m.version::text||':'||(d->>'revision'),'sourceRef',m.source_ref,'expiresAt',deadline,
    'permissions',permissions,'denies',denies);
  target_config:=jsonb_build_object('appId',g.application_id,'environment',g.environment,'profileId',b.profile_id,
    'configurationVersion',b.configuration_version,'organisationId',a.fixed_organisation_id,
    'features',jsonb_build_array(target_feature),'operations',jsonb_build_array(g.operation));
  RETURN jsonb_build_object('applicationId',d->>'applicationId','environment',d->>'environment',
    'policyVersion','access-v1:'||(d->>'revision'),'transactionId',txid_current()::text,
    'serviceBindingVersion',s->>'proofRef','usagePolicy','NOT_APPLICABLE','products','[]'::jsonb,
    'access',jsonb_build_object('type','DELEGATED_USER','actorId',s->>'serviceId','organisationId',g.organisation_id,
      'status','ACTIVE','version',g.version::text||':'||(d->>'revision'),'sourceRef',g.source_ref,'expiresAt',deadline,
      'permissions',jsonb_build_array(jsonb_build_object('operation','job.execute','feature','job_execution','resourceId',j.job_id)), 'denies','[]'::jsonb),
    'resource',jsonb_build_object('id',j.job_id,'type','job','environment',g.environment,'dataClass','ORGANISATION_PRIVATE',
      'ownerOrganisationId',g.organisation_id,'ownerUserId',NULL,'version',g.version::text,'projectionVersion','private-dispatch-v1'),
    'delegation',jsonb_build_object('delegationId',g.delegation_id,'jobId',j.job_id,'requestId',g.request_id,
      'sourceId',j.source_id,'deliveryKey',j.delivery_key,'status',j.status,'payloadDigest',g.payload_digest,
      'sourceBinding',jsonb_build_object('projectId',b.source_project_id,'branchId',b.source_branch_id,'databaseName',b.source_database_name,'applicationId',b.source_application_id,
        'schemaDigest',b.source_schema_digest,'payloadSchema',b.source_payload_schema,'qualityVersion',b.source_quality_version,
        'classificationVersion',b.source_classification_version),
      'subjectUserId',g.user_id,'organisationId',g.organisation_id,'executorApplicationId',d->>'applicationId',
      'bindingId',b.binding_id,'bindingVersion',b.version::text,'expiresAt',deadline,
      'identityKey',jsonb_build_object('environment',g.environment,'issuer',e.issuer,'subject',e.subject),
      'target',jsonb_build_object('application',target_config,'operation',g.operation,'resourceId',g.resource_id,
        'policyVersion','access-v1:'||(d->>'revision'),'access',target_access,
        'resource',jsonb_build_object('id',g.resource_id,'type',target_resource,'environment',g.environment,
          'dataClass','OPERATION_AUDIT','ownerOrganisationId',g.organisation_id,'ownerUserId',g.user_id,
          'version','1','projectionVersion',target_projection),
        'module',jsonb_build_object('id',target_module,'bindingId',module_grant.binding_id,'version',module_grant.version::text,
          'sourceRef',module_grant.source_ref,'expiresAt',deadline),
        'products',jsonb_build_array(jsonb_build_object('product',product_grant.product,'features',to_jsonb(product_grant.features),
          'organisationId',g.organisation_id,'environment',g.environment,'applicationId',g.application_id,'status',product_grant.status,
          'version',product_grant.version::text,'sourceRef',product_grant.source_ref,'source',product_grant.source,'expiresAt',product_grant.expires_at)))));
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
  PERFORM profitia_access.append_audit(p_event);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'Delegated audit envelope unavailable' USING ERRCODE='42501';
END $fn$;
-- Existing ACLs survive replacement. Only this new introspection entry needs
-- an explicit controlled grant on adoption; this file supplies no runtime ACL.
REVOKE ALL ON FUNCTION profitia_jobs.supplier_runtime_descriptor() FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_supplier_jobs FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_supplier_jobs FROM PUBLIC;
