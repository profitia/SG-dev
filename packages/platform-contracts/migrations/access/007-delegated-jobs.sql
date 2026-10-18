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
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_jobs FROM PUBLIC;
