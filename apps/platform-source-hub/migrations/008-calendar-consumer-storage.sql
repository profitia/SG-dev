-- A recipient-specific durable projection. Hub cache retention stays unchanged.
-- Installation alone grants no storage rights; owner CAS activation is separate.
DO $guard$ BEGIN
 IF current_user<>'source_hub_development_owner'
 OR to_regprocedure('source_hub.current_first_party_licence(text,text)') IS NULL
 THEN RAISE EXCEPTION 'SourceHub owner and first-party predecessor required'; END IF;
END $guard$;
CREATE TABLE source_hub.calendar_consumer_storage (
 consumer_application_id text NOT NULL CHECK(consumer_application_id='profitia-economic-calendar-runtime-development'),
 provider_id text NOT NULL CHECK(provider_id IN('eia','commodities-sh')),
 family text NOT NULL DEFAULT 'publication-calendar' CHECK(family='publication-calendar'),
 version bigint NOT NULL CHECK(version>0),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 basis_ref text NOT NULL CHECK(length(basis_ref) BETWEEN 1 AND 256),
 retention_mode text NOT NULL DEFAULT 'DURABLE_NO_FIXED_EXPIRY' CHECK(retention_mode='DURABLE_NO_FIXED_EXPIRY'),
 redistribution text NOT NULL DEFAULT 'PRIVATE_AUTHORISED_CONSUMER_ONLY' CHECK(redistribution='PRIVATE_AUTHORISED_CONSUMER_ONLY'),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(consumer_application_id,provider_id,family)
);
CREATE TABLE source_hub.calendar_consumer_storage_history (
 consumer_application_id text NOT NULL,provider_id text NOT NULL,family text NOT NULL,
 version bigint NOT NULL,status text NOT NULL,basis_ref text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(consumer_application_id,provider_id,family,version)
);
ALTER TABLE source_hub.calendar_consumer_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_hub.calendar_consumer_storage FORCE ROW LEVEL SECURITY;
CREATE POLICY schema_owner ON source_hub.calendar_consumer_storage TO source_hub_development_owner USING(true) WITH CHECK(true);
CREATE POLICY runtime_metadata ON source_hub.calendar_consumer_storage FOR SELECT TO source_hub_development_runtime USING(true);
ALTER TABLE source_hub.calendar_consumer_storage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_hub.calendar_consumer_storage_history FORCE ROW LEVEL SECURITY;
CREATE POLICY schema_owner ON source_hub.calendar_consumer_storage_history TO source_hub_development_owner USING(true) WITH CHECK(true);
GRANT SELECT ON source_hub.calendar_consumer_storage TO source_hub_development_runtime;
CREATE FUNCTION source_hub.set_calendar_consumer_storage(expected_version bigint,consumer text,provider text,new_status text,owner_basis text)
RETURNS bigint LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE previous_version bigint; next_version bigint;
BEGIN
 IF current_user<>'source_hub_development_owner' OR consumer IS DISTINCT FROM 'profitia-economic-calendar-runtime-development'
 OR provider IS NULL OR provider NOT IN('eia','commodities-sh') OR new_status IS NULL OR new_status NOT IN('ACTIVE','REVOKED')
 OR owner_basis IS NULL OR length(owner_basis) NOT BETWEEN 1 AND 256 OR expected_version IS NULL OR expected_version<0
 THEN RAISE EXCEPTION 'Exact ECR calendar storage owner decision required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('calendar-consumer-storage:'||consumer||':'||provider,0));
 SELECT version INTO previous_version FROM source_hub.calendar_consumer_storage WHERE consumer_application_id=consumer AND provider_id=provider AND family='publication-calendar' FOR UPDATE;
 IF coalesce(previous_version,0)<>expected_version THEN RAISE EXCEPTION 'Calendar storage expected version changed'; END IF;
 IF new_status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM source_hub.provider_licences WHERE provider_id=provider AND family='publication-calendar'
 AND status='ACTIVE' AND expires_at>clock_timestamp() AND consumer_access_mode='SPENDGURU_PRODUCT' AND private_consumer_use)
 THEN RAISE EXCEPTION 'Current source licence required'; END IF;
 next_version:=expected_version+1;
 INSERT INTO source_hub.calendar_consumer_storage(consumer_application_id,provider_id,version,status,basis_ref) VALUES(consumer,provider,next_version,new_status,owner_basis)
 ON CONFLICT(consumer_application_id,provider_id,family) DO UPDATE SET version=excluded.version,status=excluded.status,basis_ref=excluded.basis_ref,updated_at=clock_timestamp();
 INSERT INTO source_hub.calendar_consumer_storage_history(consumer_application_id,provider_id,family,version,status,basis_ref) VALUES(consumer,provider,'publication-calendar',next_version,new_status,owner_basis);
 RETURN next_version;
END $fn$;
REVOKE ALL ON FUNCTION source_hub.set_calendar_consumer_storage(bigint,text,text,text,text) FROM PUBLIC;
