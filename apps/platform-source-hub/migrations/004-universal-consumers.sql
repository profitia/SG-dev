-- Additive operational ledger for HUMAN and genuine SERVICE actors. Historical
-- Newsfeed rows and the six Source policies/budgets/retention remain unchanged.
DO $guard$ BEGIN
 IF current_user<>'source_hub_development_owner' OR to_regprocedure('profitia_e1_receiver.source_scope(text,uuid,text,uuid,text,text)') IS NULL THEN RAISE EXCEPTION 'Accepted first-party receiver migration required'; END IF;
END $guard$;
ALTER TABLE source_hub.provider_licences ADD COLUMN consumer_access_mode text NOT NULL DEFAULT 'LEGACY_APPLICATION' CHECK(consumer_access_mode IN('LEGACY_APPLICATION','SPENDGURU_PRODUCT'));
-- No licence is widened by installing this schema. Its owner explicitly chooses
-- product reuse only where the accepted commercial entitlement permits it.
CREATE FUNCTION source_hub.current_first_party_licence(p_provider text,p_family text)
RETURNS SETOF source_hub.provider_licences LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF session_user<>'source_hub_development_runtime' THEN RAISE EXCEPTION 'Ordinary private runtime required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT l.* FROM source_hub.provider_licences l WHERE l.provider_id=p_provider AND l.family=p_family
 AND l.status='ACTIVE' AND l.private_consumer_use AND l.consumer_access_mode='SPENDGURU_PRODUCT' AND l.expires_at>clock_timestamp() FOR SHARE OF l;
END $fn$;
REVOKE ALL ON FUNCTION source_hub.current_first_party_licence(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION source_hub.current_first_party_licence(text,text) TO source_hub_development_runtime;
CREATE TABLE source_hub.first_party_acquisitions(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,actor_kind text NOT NULL CHECK(actor_kind IN('HUMAN','SERVICE')),actor_id uuid NOT NULL,component_id text NOT NULL,
 consumer_application_id text NOT NULL,provider_id text NOT NULL,family text NOT NULL,resource_id text GENERATED ALWAYS AS ('api.'||provider_id||'.'||family) STORED,
 idempotency_digest text NOT NULL CHECK(idempotency_digest~'^[a-f0-9]{64}$'),request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 intent_key text NOT NULL CHECK(intent_key~'^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN('PENDING','SUCCEEDED','FAILED','UNCERTAIN')),licence_ref text NOT NULL,licence_version bigint NOT NULL,
 result jsonb,error_code text,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,retention_until timestamptz,
 PRIMARY KEY(environment,application_id,organisation_id,actor_kind,actor_id,component_id,id),
 UNIQUE(environment,application_id,organisation_id,actor_kind,actor_id,component_id,consumer_application_id,idempotency_digest),
 CHECK((status='PENDING' AND completed_at IS NULL) OR (status<>'PENDING' AND completed_at IS NOT NULL))
);
CREATE TABLE source_hub.first_party_records(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,actor_kind text NOT NULL CHECK(actor_kind IN('HUMAN','SERVICE')),actor_id uuid NOT NULL,component_id text NOT NULL,
 source_record_ref text NOT NULL,provider_id text NOT NULL,family text NOT NULL,resource_id text GENERATED ALWAYS AS ('api.'||provider_id||'.'||family) STORED,vendor_record_id text,
 licence_ref text NOT NULL,content_fingerprint text NOT NULL CHECK(content_fingerprint~'^[a-f0-9]{64}$'),metadata jsonb NOT NULL,payload jsonb NOT NULL,
 retrieved_at timestamptz NOT NULL,retention_until timestamptz NOT NULL CHECK(isfinite(retention_until)),
 PRIMARY KEY(environment,application_id,organisation_id,actor_kind,actor_id,component_id,id),
 UNIQUE(environment,application_id,organisation_id,actor_kind,actor_id,component_id,licence_ref,source_record_ref)
);
CREATE TABLE source_hub.first_party_usage(
 acquisition_id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,actor_kind text NOT NULL CHECK(actor_kind IN('HUMAN','SERVICE')),actor_id uuid NOT NULL,component_id text NOT NULL,
 provider_id text NOT NULL,family text NOT NULL,resource_id text GENERATED ALWAYS AS ('api.'||provider_id||'.'||family) STORED,upstream_attempts integer CHECK(upstream_attempts IN(0,1)),
 outcome text NOT NULL CHECK(outcome IN('RESPONSE','NOT_SENT','UNVERIFIED')),receipt_ref text,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,application_id,organisation_id,actor_kind,actor_id,component_id,acquisition_id),
 FOREIGN KEY(environment,application_id,organisation_id,actor_kind,actor_id,component_id,acquisition_id) REFERENCES source_hub.first_party_acquisitions(environment,application_id,organisation_id,actor_kind,actor_id,component_id,id)
);
CREATE INDEX first_party_acquisitions_history ON source_hub.first_party_acquisitions(environment,application_id,organisation_id,actor_kind,actor_id,component_id,created_at DESC);
CREATE INDEX first_party_records_retention ON source_hub.first_party_records(retention_until);
CREATE INDEX first_party_records_vendor_revision ON source_hub.first_party_records(provider_id,family,vendor_record_id,retrieved_at DESC);

DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['first_party_acquisitions','first_party_records','first_party_usage'] LOOP
 EXECUTE format('ALTER TABLE source_hub.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE source_hub.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY schema_owner ON source_hub.%I TO source_hub_development_owner USING(true) WITH CHECK(true)',t);
 EXECUTE format($policy$CREATE POLICY current_first_party_scope ON source_hub.%I TO source_hub_development_runtime USING(
 environment='development' AND application_id=(SELECT i.application_id FROM source_hub.installation i WHERE i.singleton)
 AND profitia_e1_receiver.source_scope(application_id,organisation_id,actor_kind,actor_id,component_id,resource_id)) WITH CHECK(
 environment='development' AND application_id=(SELECT i.application_id FROM source_hub.installation i WHERE i.singleton)
 AND profitia_e1_receiver.source_scope(application_id,organisation_id,actor_kind,actor_id,component_id,resource_id))$policy$,t);
 END LOOP;
 CREATE POLICY current_consumer_application ON source_hub.first_party_acquisitions AS RESTRICTIVE TO source_hub_development_runtime USING(profitia_e1_receiver.source_application(consumer_application_id)) WITH CHECK(profitia_e1_receiver.source_application(consumer_application_id));
END $policies$;
GRANT SELECT,INSERT,UPDATE,DELETE ON source_hub.first_party_acquisitions,source_hub.first_party_records,source_hub.first_party_usage TO source_hub_development_runtime;
