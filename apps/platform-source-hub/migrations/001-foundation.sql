-- Version1.0.0. The migration runner substitutes only validated deployment role identifiers.
-- Canonical E1/Source schemas remain owned by their existing separate NOLOGIN owners.
CREATE SCHEMA source_hub AUTHORIZATION __OWNER_ROLE__;
REVOKE ALL ON SCHEMA source_hub FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE source_hub.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),environment text NOT NULL CHECK(environment IN('development','staging','production')),
 application_id text NOT NULL,project_id text NOT NULL,branch_id text NOT NULL,database_name name NOT NULL
);
CREATE TABLE source_hub.api_families(id text PRIMARY KEY,status text NOT NULL CHECK(status IN('IMPLEMENTED','FUTURE')));
INSERT INTO source_hub.api_families VALUES('news-discovery','IMPLEMENTED'),('economic-calendar','IMPLEMENTED'),('indicators','IMPLEMENTED'),('external-forecasts','IMPLEMENTED'),('market-observations','FUTURE');
CREATE TABLE source_hub.providers(id text PRIMARY KEY,api_families text[] NOT NULL,contract_version text NOT NULL);
INSERT INTO source_hub.providers VALUES('newsapi',ARRAY['news-discovery'],'1.0.0'),('brave',ARRAY['news-discovery'],'1.0.0'),('trading-economics',ARRAY['economic-calendar','indicators','external-forecasts'],'1.0.0');
-- This is licence provenance/retention metadata. Source/Root still owns permission and finite admission.
CREATE TABLE source_hub.provider_licences(
 provider_id text NOT NULL CHECK(provider_id IN('newsapi','brave','trading-economics')),
 family text NOT NULL CHECK(family IN('news-discovery','economic-calendar','indicators','external-forecasts','market-observations')),
 licence_ref text NOT NULL CHECK(length(licence_ref) BETWEEN 1 AND 256),version bigint NOT NULL CHECK(version>0),
 source_id text NOT NULL,resource_id text NOT NULL,source_policy_id uuid NOT NULL,
 private_consumer_use boolean NOT NULL DEFAULT false,consumer_application_ids text[] NOT NULL CHECK(cardinality(consumer_application_ids)>0),retention_seconds integer NOT NULL CHECK(retention_seconds BETWEEN 0 AND 31536000),
 redistribution text NOT NULL CHECK(redistribution='PRIVATE_AUTHORISED_CONSUMER_ONLY'),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 PRIMARY KEY(provider_id,family)
);
CREATE FUNCTION source_hub.advance_licence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF (NEW.provider_id,NEW.family) IS DISTINCT FROM (OLD.provider_id,OLD.family) THEN RAISE EXCEPTION 'Licence scope identity is immutable';END IF;
 IF (to_jsonb(NEW)-'version') IS DISTINCT FROM (to_jsonb(OLD)-'version') THEN NEW.version:=OLD.version+1;ELSE NEW.version:=OLD.version;END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER licence_version BEFORE UPDATE ON source_hub.provider_licences FOR EACH ROW EXECUTE FUNCTION source_hub.advance_licence();
CREATE TABLE source_hub.acquisitions(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 actor_id uuid NOT NULL,consumer_application_id text NOT NULL,provider_id text NOT NULL,family text NOT NULL,
 idempotency_digest text NOT NULL CHECK(idempotency_digest~'^[a-f0-9]{64}$'),request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 intent_key text NOT NULL CHECK(intent_key~'^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN('PENDING','SUCCEEDED','FAILED','UNCERTAIN')),licence_ref text NOT NULL,licence_version bigint NOT NULL,
 result jsonb,error_code text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,retention_until timestamptz,
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,id),
 UNIQUE(environment,application_id,organisation_id,owner_user_id,consumer_application_id,idempotency_digest),
 CHECK((status='PENDING' AND completed_at IS NULL) OR (status<>'PENDING' AND completed_at IS NOT NULL))
);
CREATE TABLE source_hub.source_records(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 source_record_ref text NOT NULL,provider_id text NOT NULL,family text NOT NULL,vendor_record_id text,
 licence_ref text NOT NULL,content_fingerprint text NOT NULL CHECK(content_fingerprint~'^[a-f0-9]{64}$'),metadata jsonb NOT NULL,payload jsonb NOT NULL,
 retrieved_at timestamptz NOT NULL,retention_until timestamptz NOT NULL CHECK(isfinite(retention_until)),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,id),
 UNIQUE(environment,application_id,organisation_id,owner_user_id,licence_ref,source_record_ref)
);
CREATE TABLE source_hub.provider_usage(
 acquisition_id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 provider_id text NOT NULL,family text NOT NULL,upstream_attempts integer CHECK(upstream_attempts IN(0,1)),
 outcome text NOT NULL CHECK(outcome IN('RESPONSE','NOT_SENT','UNVERIFIED')),receipt_ref text,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,acquisition_id),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,acquisition_id) REFERENCES source_hub.acquisitions(environment,application_id,organisation_id,owner_user_id,id)
);
CREATE INDEX acquisitions_private_history ON source_hub.acquisitions(environment,application_id,organisation_id,owner_user_id,created_at DESC);
CREATE INDEX records_retention ON source_hub.source_records(retention_until);
CREATE INDEX records_vendor_revision ON source_hub.source_records(provider_id,family,vendor_record_id,retrieved_at DESC);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['installation','api_families','providers','provider_licences','acquisitions','source_records','provider_usage'] LOOP
  EXECUTE format('ALTER TABLE source_hub.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE source_hub.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY schema_owner ON source_hub.%I TO __OWNER_ROLE__ USING(true) WITH CHECK(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['installation','api_families','providers','provider_licences'] LOOP
  EXECUTE format('CREATE POLICY configuration_read ON source_hub.%I FOR SELECT TO __RUNTIME_ROLE__ USING(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['acquisitions','source_records','provider_usage'] LOOP
  EXECUTE format($policy$CREATE POLICY private_scope ON source_hub.%I TO __RUNTIME_ROLE__ USING(
   environment=(SELECT i.environment FROM source_hub.installation i WHERE i.singleton) AND application_id=(SELECT i.application_id FROM source_hub.installation i WHERE i.singleton) AND environment=current_setting('profitia.environment',true) AND application_id=current_setting('profitia.application_id',true)
   AND organisation_id::text=current_setting('profitia.organisation_id',true) AND owner_user_id::text=current_setting('profitia.user_id',true)
  ) WITH CHECK(environment=(SELECT i.environment FROM source_hub.installation i WHERE i.singleton) AND application_id=(SELECT i.application_id FROM source_hub.installation i WHERE i.singleton) AND environment=current_setting('profitia.environment',true) AND application_id=current_setting('profitia.application_id',true)
   AND organisation_id::text=current_setting('profitia.organisation_id',true) AND owner_user_id::text=current_setting('profitia.user_id',true))$policy$,t);
 END LOOP;
END $policies$;
GRANT USAGE ON SCHEMA source_hub TO __RUNTIME_ROLE__;
GRANT SELECT ON source_hub.installation,source_hub.api_families,source_hub.providers,source_hub.provider_licences TO __RUNTIME_ROLE__;
GRANT SELECT,INSERT,UPDATE,DELETE ON source_hub.acquisitions,source_hub.source_records,source_hub.provider_usage TO __RUNTIME_ROLE__;
-- Lock a current licence through commit without granting UPDATE on commercial
-- configuration to the runtime. This helper grants no E1 or Source authority.
CREATE FUNCTION source_hub.current_licence(p_provider text,p_family text,p_consumer text)
RETURNS SETOF source_hub.provider_licences LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF session_user<>__RUNTIME_ROLE_LITERAL__ THEN RAISE EXCEPTION 'Ordinary private runtime required' USING ERRCODE='42501';END IF;
 RETURN QUERY SELECT l.* FROM source_hub.provider_licences l WHERE l.provider_id=p_provider AND l.family=p_family
  AND l.status='ACTIVE' AND l.private_consumer_use AND p_consumer=ANY(l.consumer_application_ids)
  AND l.expires_at>clock_timestamp() FOR SHARE OF l;
END $fn$;
REVOKE ALL ON FUNCTION source_hub.current_licence(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION source_hub.current_licence(text,text,text) TO __RUNTIME_ROLE__;
