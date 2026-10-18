-- Private dispatch authority. This is NOT a scientific computation queue.
-- Source acquisition/publication and its budget belong to the separate source
-- authority (008). No role, application, grant or deployment is provisioned.
DO $guard$
BEGIN
  IF current_user <> 'profitia_access_owner' OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user
      AND NOT (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=oid)
  ) THEN RAISE EXCEPTION 'Controlled private dispatch owner required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND schema_version='1.0.0'
      AND database_name=current_database() AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2')
    OR NOT EXISTS(SELECT 1 FROM profitia_modules.installation WHERE singleton AND schema_version='1.0.0'
      AND schema_digest='c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed')
    OR NOT EXISTS(SELECT 1 FROM profitia_modules.audit_installation WHERE singleton AND envelope_version='1.0.0'
      AND schema_digest='af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac')
    OR NOT EXISTS(SELECT 1 FROM profitia_services.installation WHERE singleton AND schema_version='1.0.0'
      AND schema_digest='f7757dc5805b3759959505fa852715e70d207e94bf5d85827db3d52b0a5d0d49')
    OR NOT EXISTS(SELECT 1 FROM profitia_requests.installation WHERE singleton AND schema_version='1.0.0'
      AND schema_digest='0af5eed241ad1db08bfed89c95c47ef21a7dbeed0ee54bcccce52164ddcc4127') THEN
    RAISE EXCEPTION 'Accepted private authority installations required' USING ERRCODE='42501';
  END IF;
END $guard$;

-- Only the newly opted-in dispatch path uses this technical profile. The
-- original three business profiles and SQL001--006 source stay unchanged.
ALTER TABLE profitia_services.runtime_bindings DROP CONSTRAINT runtime_bindings_profile_id_check;
ALTER TABLE profitia_services.runtime_bindings ADD CONSTRAINT runtime_bindings_profile_id_check
  CHECK(profile_id IN ('PORR_SUITE','SPENDGURU_SAAS','SUPPLIER_INTELLIGENCE_STANDALONE','PLATFORM_INTERNAL'));
ALTER TABLE profitia_requests.intents ADD CONSTRAINT private_job_target_reference
  UNIQUE(request_id,application_id,environment,organisation_id,user_id,payload_digest,resource_id);
ALTER TABLE profitia_access.external_identities ADD CONSTRAINT private_job_identity_owner_reference
  UNIQUE(binding_id,user_id);

CREATE SCHEMA profitia_jobs AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_jobs FROM PUBLIC;
CREATE TABLE profitia_jobs.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);

-- Current deployment-owned bindings, not the configuration copied into an
-- old audit event. Different operation hosts may have different versions.
CREATE TABLE profitia_jobs.operation_bindings (
  binding_id uuid PRIMARY KEY,
  application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
  operation text NOT NULL CHECK(operation='forecast.request'),
  foreground_role name NOT NULL REFERENCES profitia_access.runtime_bindings(login_role),
  profile_id text NOT NULL CHECK(profile_id IN ('PORR_SUITE','SPENDGURU_SAAS')),
  configuration_version text NOT NULL CHECK(length(configuration_version) BETWEEN 1 AND 256),
  executor_application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
  source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 128),
  source_project_id text NOT NULL,source_branch_id text NOT NULL,source_database_name name NOT NULL,source_application_id text NOT NULL,
  source_schema_digest text NOT NULL CHECK(source_schema_digest~'^[a-f0-9]{64}$'),source_payload_schema text NOT NULL,
  source_quality_version text NOT NULL,source_classification_version text NOT NULL,
  delegation_ttl_seconds integer NOT NULL CHECK(delegation_ttl_seconds BETWEEN 10 AND 3600),
  max_attempts integer NOT NULL CHECK(max_attempts BETWEEN 1 AND 10),
  status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
  UNIQUE(application_id,operation),
  UNIQUE(binding_id,application_id,operation)
);
CREATE TABLE profitia_jobs.execution_grants (
  grant_id uuid PRIMARY KEY,
  login_role name NOT NULL REFERENCES profitia_services.runtime_bindings(login_role),
  binding_id uuid NOT NULL REFERENCES profitia_jobs.operation_bindings(binding_id),
  organisation_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),
  resource_id text CHECK(length(resource_id) BETWEEN 1 AND 256 AND resource_id NOT LIKE '%*%'),
  effect text NOT NULL CHECK(effect IN ('ALLOW','DENY')),
  status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
  UNIQUE NULLS NOT DISTINCT(login_role,binding_id,organisation_id,resource_id,effect)
);
CREATE TABLE profitia_jobs.delegations (
  delegation_id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  application_id text NOT NULL,
  environment text NOT NULL CHECK(environment IN ('development','staging','production')),
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  operation text NOT NULL CHECK(operation='forecast.request'),
  resource_id text NOT NULL,
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  binding_id uuid NOT NULL,
  binding_version bigint NOT NULL CHECK(binding_version>0),
  identity_binding_id uuid NOT NULL,
  identity_binding_version bigint NOT NULL CHECK(identity_binding_version>0),
  account_version bigint NOT NULL CHECK(account_version>0),
  status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
  CHECK(expires_at>created_at),
  FOREIGN KEY(request_id,application_id,environment,organisation_id,user_id,payload_digest,resource_id)
    REFERENCES profitia_requests.intents(request_id,application_id,environment,organisation_id,user_id,payload_digest,resource_id),
  FOREIGN KEY(binding_id,application_id,operation)
    REFERENCES profitia_jobs.operation_bindings(binding_id,application_id,operation),
  FOREIGN KEY(identity_binding_id,user_id) REFERENCES profitia_access.external_identities(binding_id,user_id),
  UNIQUE(delegation_id,request_id)
);
CREATE TABLE profitia_jobs.dispatches (
  job_id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE,
  delegation_id uuid NOT NULL UNIQUE,
  source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 128),
  delivery_key text NOT NULL UNIQUE CHECK(delivery_key ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK(status IN ('PENDING','READY','CONFIRMED','UNCERTAIN','EXPIRED','CANCELLED')),
  lease_id uuid,
  lease_expires_at timestamptz CHECK(isfinite(lease_expires_at)),
  attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK((lease_id IS NULL)=(lease_expires_at IS NULL)),
  FOREIGN KEY(delegation_id,request_id) REFERENCES profitia_jobs.delegations(delegation_id,request_id)
);
CREATE TABLE profitia_jobs.delivery_observations (
  observation_id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES profitia_jobs.dispatches(job_id),
  source_id text NOT NULL CHECK(length(source_id) BETWEEN 1 AND 128),
  source_effect_id uuid NOT NULL,
  receipt_digest text NOT NULL CHECK(receipt_digest ~ '^[a-f0-9]{64}$'),
  status text NOT NULL CHECK(status IN ('COMMITTED','PENDING','NOT_FOUND','UNCERTAIN')),
  observing_role name NOT NULL,
  observing_service_id uuid NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(job_id,source_id,source_effect_id,receipt_digest,status)
);

DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['installation','operation_bindings','execution_grants','delegations','dispatches','delivery_observations'] LOOP
    EXECUTE format('ALTER TABLE profitia_jobs.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_jobs.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_jobs.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
    EXECUTE format('CREATE POLICY private_dispatch_select_fence ON profitia_jobs.%I AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user=''profitia_access_owner'')',t);
    EXECUTE format('CREATE POLICY private_dispatch_insert_fence ON profitia_jobs.%I AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user=''profitia_access_owner'')',t);
    EXECUTE format('CREATE POLICY private_dispatch_update_fence ON profitia_jobs.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
    EXECUTE format('CREATE POLICY private_dispatch_delete_fence ON profitia_jobs.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user=''profitia_access_owner'')',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['operation_bindings','execution_grants'] LOOP
    EXECUTE format('CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_jobs.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
    EXECUTE format('CREATE TRIGGER authority_truncate_fence BEFORE TRUNCATE ON profitia_jobs.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
    EXECUTE format('CREATE TRIGGER advance_version BEFORE UPDATE ON profitia_jobs.%I FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version()',t);
  END LOOP;
END $rls$;

-- Creating one new delegation cannot invalidate the enclosing request's
-- authority lease. Changing/revoking an existing grant DOES invalidate it.
CREATE TRIGGER delegation_revocation_fence BEFORE UPDATE OR DELETE ON profitia_jobs.delegations
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER delegation_version BEFORE UPDATE ON profitia_jobs.delegations
  FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version();

CREATE FUNCTION profitia_jobs.immutable_private_metadata() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Private dispatch history is immutable' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='delegations' AND (to_jsonb(NEW)-ARRAY['status','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version'])
    OR TG_TABLE_NAME='dispatches' AND (to_jsonb(NEW)-ARRAY['status','lease_id','lease_expires_at','attempt_count','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','lease_id','lease_expires_at','attempt_count','updated_at'])
    OR TG_TABLE_NAME='delivery_observations' THEN
    RAISE EXCEPTION 'Private dispatch binding is immutable' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='dispatches' THEN
    IF NEW.attempt_count<OLD.attempt_count THEN
      RAISE EXCEPTION 'Dispatch attempt count cannot decrease' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION profitia_jobs.immutable_private_metadata() FROM PUBLIC;
CREATE TRIGGER delegation_metadata_immutable BEFORE UPDATE OR DELETE ON profitia_jobs.delegations
  FOR EACH ROW EXECUTE FUNCTION profitia_jobs.immutable_private_metadata();
CREATE TRIGGER dispatch_metadata_immutable BEFORE UPDATE OR DELETE ON profitia_jobs.dispatches
  FOR EACH ROW EXECUTE FUNCTION profitia_jobs.immutable_private_metadata();
CREATE TRIGGER observations_immutable BEFORE UPDATE OR DELETE ON profitia_jobs.delivery_observations
  FOR EACH ROW EXECUTE FUNCTION profitia_jobs.immutable_private_metadata();
CREATE FUNCTION profitia_jobs.no_history_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Private dispatch history is immutable' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER delegation_truncate_immutable BEFORE TRUNCATE ON profitia_jobs.delegations FOR EACH STATEMENT EXECUTE FUNCTION profitia_jobs.no_history_truncate();
CREATE TRIGGER dispatch_truncate_immutable BEFORE TRUNCATE ON profitia_jobs.dispatches FOR EACH STATEMENT EXECUTE FUNCTION profitia_jobs.no_history_truncate();
CREATE TRIGGER observations_truncate_immutable BEFORE TRUNCATE ON profitia_jobs.delivery_observations FOR EACH STATEMENT EXECUTE FUNCTION profitia_jobs.no_history_truncate();
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_jobs FROM PUBLIC;

CREATE FUNCTION profitia_jobs.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; i profitia_jobs.installation%ROWTYPE;
BEGIN
  d:=profitia_access.runtime_descriptor();
  SELECT * INTO STRICT i FROM profitia_jobs.installation WHERE singleton;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='profitia_access_owner'
      AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
      AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
    OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='profitia_jobs' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity
        AND c.relowner='profitia_access_owner'::regrole)<>6 THEN RETURN NULL; END IF;
  RETURN d||jsonb_build_object('jobSchemaVersion',i.schema_version,'jobSchemaDigest',i.schema_digest,'jobSourceRef',i.source_ref);
EXCEPTION WHEN no_data_found OR too_many_rows THEN RETURN NULL;
END $fn$;

-- Called inside the already authorised HUMAN request transaction, after its
-- reservation and before acceptance. A post-hoc command cannot create a grant.
CREATE FUNCTION profitia_jobs.create_dispatch(p_request uuid,p_decision uuid,p_configuration text) RETURNS jsonb
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
    OR profitia_requests.scope_allows(org,uid,r.resource_id) IS NOT TRUE THEN RETURN NULL; END IF;
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

-- Current authority only. No GUC, old audit or caller-supplied user/organisation
-- selects the target. The service keeps its own identity throughout.
CREATE FUNCTION profitia_jobs.current_job(p_job uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;j profitia_jobs.dispatches%ROWTYPE;g profitia_jobs.delegations%ROWTYPE;
  b profitia_jobs.operation_bindings%ROWTYPE;e profitia_access.external_identities%ROWTYPE;
  m profitia_access.memberships%ROWTYPE; a profitia_access.applications%ROWTYPE;
  module_grant profitia_modules.application_bindings%ROWTYPE; product_grant profitia_access.product_grants%ROWTYPE;
  deadline timestamptz; grant_expiry timestamptz; permissions jsonb; denies jsonb; target_access jsonb; target_config jsonb;
BEGIN
  d:=profitia_jobs.runtime_descriptor();s:=profitia_services.runtime_descriptor();
  IF d IS NULL OR s IS NULL OR s->>'profileId'<>'PLATFORM_INTERNAL' OR d->>'fixedOrganisationId' IS NOT NULL THEN RETURN NULL; END IF;
  SELECT * INTO j FROM profitia_jobs.dispatches WHERE job_id=p_job;
  IF NOT FOUND OR j.status IN('EXPIRED','CANCELLED') THEN RETURN NULL; END IF;
  SELECT * INTO g FROM profitia_jobs.delegations WHERE delegation_id=j.delegation_id AND status='ACTIVE'
    AND environment=d->>'environment' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
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
    AND module_id='benchmark' AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO product_grant FROM profitia_access.product_grants WHERE application_id=g.application_id
    AND organisation_id=g.organisation_id AND product='SPENDGURU' AND status='ACTIVE'
    AND features @> ARRAY['benchmark','forecast'] AND expires_at>clock_timestamp();
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
      AND organisation_id=g.organisation_id AND user_id=g.user_id AND operation=g.operation AND feature='forecast'
      AND effect='ALLOW' AND (resource_id IS NULL OR resource_id=g.resource_id))
    OR EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=g.application_id
      AND organisation_id=g.organisation_id AND user_id=g.user_id AND operation=g.operation AND feature='forecast'
      AND effect='DENY' AND (resource_id IS NULL OR resource_id=g.resource_id)) THEN RETURN NULL; END IF;
  deadline:=least((s->>'expiresAt')::timestamptz,g.expires_at,b.expires_at,e.expires_at,m.expires_at,
    module_grant.expires_at,product_grant.expires_at,grant_expiry,clock_timestamp()+interval '30 seconds');
  target_access:=jsonb_build_object('type','MEMBERSHIP','actorId',g.user_id,'organisationId',g.organisation_id,
    'status','ACTIVE','version',m.version::text||':'||(d->>'revision'),'sourceRef',m.source_ref,'expiresAt',deadline,
    'permissions',permissions,'denies',denies);
  target_config:=jsonb_build_object('appId',g.application_id,'environment',g.environment,'profileId',b.profile_id,
    'configurationVersion',b.configuration_version,'organisationId',a.fixed_organisation_id,
    'features',jsonb_build_array('forecast'),'operations',jsonb_build_array(g.operation));
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
        'resource',jsonb_build_object('id',g.resource_id,'type','forecast_request','environment',g.environment,
          'dataClass','OPERATION_AUDIT','ownerOrganisationId',g.organisation_id,'ownerUserId',g.user_id,
          'version','1','projectionVersion','request-v1'),
        'module',jsonb_build_object('id','benchmark','bindingId',module_grant.binding_id,'version',module_grant.version::text,
          'sourceRef',module_grant.source_ref,'expiresAt',deadline),
        'products',jsonb_build_array(jsonb_build_object('product',product_grant.product,'features',to_jsonb(product_grant.features),
          'organisationId',g.organisation_id,'environment',g.environment,'applicationId',g.application_id,'status',product_grant.status,
          'version',product_grant.version::text,'sourceRef',product_grant.source_ref,'source',product_grant.source,'expiresAt',product_grant.expires_at)))));
END $fn$;

CREATE FUNCTION profitia_jobs.lock_job(p_job uuid,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE state jsonb;
BEGIN
  PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
  state:=profitia_jobs.current_job(p_job);
  IF state IS NULL OR state->>'serviceBindingVersion' IS DISTINCT FROM p_proof THEN RETURN NULL; END IF;
  PERFORM set_config('profitia.job.scope',jsonb_build_array(p_job,p_proof,state->>'policyVersion',
    txid_current()::text,state->'access'->>'expiresAt')::text,true);
  RETURN state;
END $fn$;
CREATE FUNCTION profitia_jobs.scope_allows(p_job uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE marker jsonb;state jsonb;
BEGIN
  marker:=nullif(current_setting('profitia.job.scope',true),'')::jsonb;
  state:=profitia_jobs.current_job(p_job);
  RETURN coalesce(state IS NOT NULL AND marker->>0=p_job::text
    AND marker->>1=state->>'serviceBindingVersion' AND marker->>2=state->>'policyVersion'
    AND marker->>3=txid_current()::text AND (marker->>4)::timestamptz>clock_timestamp()
    AND (marker->>4)::timestamptz<=clock_timestamp()+interval '30 seconds',false);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $fn$;
-- Dispatch admission only. A READY row is NOT proof of source publication.
-- A source commit and its budget/receipt belong to the independent source DB.
CREATE FUNCTION profitia_jobs.claim_dispatch(p_job uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE j profitia_jobs.dispatches%ROWTYPE; state jsonb; attempts integer; deadline timestamptz;
BEGIN
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

-- Server adapter records an observed SOURCE receipt; never a browser's ALLOW.
-- An uncertain external effect is retained for reconciliation, never refunded.
CREATE FUNCTION profitia_jobs.delivery_state(p_job uuid,p_lease uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE j profitia_jobs.dispatches%ROWTYPE;
BEGIN
  IF profitia_jobs.scope_allows(p_job) IS NOT TRUE THEN RETURN NULL;END IF;
  SELECT * INTO j FROM profitia_jobs.dispatches WHERE job_id=p_job FOR UPDATE;
  IF j.status='CONFIRMED' THEN RETURN jsonb_build_object('jobId',p_job,'status','CONFIRMED');END IF;
  IF j.status<>'READY' OR j.lease_id IS DISTINCT FROM p_lease OR j.lease_expires_at<=clock_timestamp() THEN RETURN NULL;END IF;
  RETURN jsonb_build_object('jobId',p_job,'status','READY');
END $fn$;
CREATE FUNCTION profitia_jobs.observe_delivery(p_job uuid,p_lease uuid,p_source text,p_effect uuid,p_digest text,p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE j profitia_jobs.dispatches%ROWTYPE; s jsonb;
BEGIN
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

-- One canonical security-event writer; this entry narrows SERVICE authority.
CREATE FUNCTION profitia_jobs.append_audit(p_event jsonb) RETURNS void
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
    evidence:=jsonb_build_array(jsonb_build_object('product',p->>'product','feature','forecast','version',p->>'version',
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
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_jobs FROM PUBLIC;
