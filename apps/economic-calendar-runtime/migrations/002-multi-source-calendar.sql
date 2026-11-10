-- Additive ECR-owned storage; no SourceHub cache, identity or business grants.
DO $guard$ BEGIN
 IF current_user<>'economic_calendar_development_owner' OR to_regclass('economic_calendar.events') IS NULL
 THEN RAISE EXCEPTION 'Accepted ECR owner and predecessor required'; END IF;
END $guard$;
ALTER TABLE economic_calendar.installation ADD COLUMN multi_source_schema_digest text CHECK(multi_source_schema_digest~'^[a-f0-9]{64}$');
CREATE TABLE economic_calendar.storage_policies (
 provider_id text PRIMARY KEY CHECK(provider_id IN('eia','commodities-sh')),
 family text NOT NULL DEFAULT 'publication-calendar' CHECK(family='publication-calendar'),
 version bigint NOT NULL CHECK(version>0),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 licence_ref text NOT NULL CHECK(length(licence_ref) BETWEEN 1 AND 256),basis_ref text NOT NULL CHECK(length(basis_ref) BETWEEN 1 AND 256),
 retention_mode text NOT NULL CHECK(retention_mode='DURABLE_NO_FIXED_EXPIRY'),
 redistribution text NOT NULL CHECK(redistribution='PRIVATE_AUTHORISED_CONSUMER_ONLY'),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE economic_calendar.storage_policy_history (
 provider_id text NOT NULL,version bigint NOT NULL,status text NOT NULL,licence_ref text NOT NULL,basis_ref text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(provider_id,version)
);
CREATE TABLE economic_calendar.publications (
 publication_id text PRIMARY KEY CHECK(publication_id~'^ecr_pub_[a-f0-9]{64}$'),
 provider text NOT NULL CHECK(provider IN('eia','commodities-sh')),publication_ref text NOT NULL,
 current_fingerprint text NOT NULL CHECK(current_fingerprint~'^[a-f0-9]{64}$'),current_data jsonb NOT NULL CHECK(jsonb_typeof(current_data)='object'),
 current_sequence bigint NOT NULL CHECK(current_sequence>0),first_observed_at timestamptz NOT NULL,current_observed_at timestamptz NOT NULL,last_observed_at timestamptz NOT NULL,
 current_receipt_ref uuid NOT NULL,current_source_retrieved_at timestamptz NOT NULL,last_receipt_ref uuid NOT NULL,last_source_retrieved_at timestamptz NOT NULL,
 UNIQUE(provider,publication_ref)
);
CREATE TABLE economic_calendar.publication_observations (
 publication_id text NOT NULL REFERENCES economic_calendar.publications(publication_id),sequence bigint NOT NULL CHECK(sequence>0),
 fingerprint text NOT NULL CHECK(fingerprint~'^[a-f0-9]{64}$'),data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),observed_at timestamptz NOT NULL,
 source_retrieved_at timestamptz NOT NULL,receipt_ref uuid NOT NULL REFERENCES economic_calendar.sync_runs(receipt_ref) DEFERRABLE INITIALLY DEFERRED,
 adopted_as_current boolean NOT NULL,change_kind text NOT NULL CHECK(change_kind IN('FIRST_OBSERVED','DEFINITION_OR_SCHEDULE_CHANGED','STALE_SOURCE_OBSERVATION')),
 PRIMARY KEY(publication_id,sequence)
);
ALTER TABLE economic_calendar.events DROP CONSTRAINT events_provider_check;
ALTER TABLE economic_calendar.events ADD CONSTRAINT events_provider_check CHECK(provider IN('trading-economics','eia','commodities-sh'));
ALTER TABLE economic_calendar.events ADD COLUMN publication_id text REFERENCES economic_calendar.publications(publication_id);
ALTER TABLE economic_calendar.sync_runs ADD COLUMN provider_id text NOT NULL DEFAULT 'trading-economics',ADD COLUMN source_licence_ref text;
CREATE INDEX events_by_publication ON economic_calendar.events(publication_id,event_id);
CREATE INDEX publication_observations_as_known ON economic_calendar.publication_observations(publication_id,observed_at DESC,sequence DESC);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['storage_policies','storage_policy_history','publications','publication_observations'] LOOP
 EXECUTE format('ALTER TABLE economic_calendar.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE economic_calendar.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY schema_owner ON economic_calendar.%I TO economic_calendar_development_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $policies$;
CREATE POLICY storage_metadata ON economic_calendar.storage_policies FOR SELECT TO economic_calendar_development_runtime,economic_calendar_development_ingest USING(true);
CREATE FUNCTION economic_calendar.retained_source_allowed(provider text,licence text) RETURNS boolean LANGUAGE sql STABLE
SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT provider='trading-economics' OR EXISTS(SELECT 1 FROM economic_calendar.storage_policies p WHERE p.provider_id=provider AND p.licence_ref=licence AND p.status='ACTIVE')
$fn$;
REVOKE ALL ON FUNCTION economic_calendar.retained_source_allowed(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION economic_calendar.retained_source_allowed(text,text) TO economic_calendar_development_runtime,economic_calendar_development_ingest;
CREATE POLICY current_event_reader ON economic_calendar.publications FOR SELECT TO economic_calendar_development_runtime USING(
 EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND (SELECT profitia_e1_receiver.calendar_scope('events',NULL,false))
 AND economic_calendar.retained_source_allowed(provider,current_data->'source'->>'licenceRef'));
CREATE POLICY current_event_reader ON economic_calendar.publication_observations FOR SELECT TO economic_calendar_development_runtime USING(
 EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND (SELECT profitia_e1_receiver.calendar_scope('events',NULL,false))
 AND economic_calendar.retained_source_allowed(data->'source'->>'provider',data->'source'->>'licenceRef'));
CREATE POLICY enrolled_ingester ON economic_calendar.publications TO economic_calendar_development_ingest USING(
 EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND economic_calendar.retained_source_allowed(provider,current_data->'source'->>'licenceRef')) WITH CHECK(
 EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND economic_calendar.retained_source_allowed(provider,current_data->'source'->>'licenceRef'));
CREATE POLICY enrolled_ingester ON economic_calendar.publication_observations TO economic_calendar_development_ingest USING(
 EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND economic_calendar.retained_source_allowed(data->'source'->>'provider',data->'source'->>'licenceRef')) WITH CHECK(
 EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND economic_calendar.retained_source_allowed(data->'source'->>'provider',data->'source'->>'licenceRef'));
ALTER POLICY current_event_reader ON economic_calendar.events USING(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND (SELECT profitia_e1_receiver.calendar_scope('events',NULL,false)) AND economic_calendar.retained_source_allowed(provider,current_data->'source'->>'licenceRef'));
ALTER POLICY current_event_reader ON economic_calendar.observations USING(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND (SELECT profitia_e1_receiver.calendar_scope('events',NULL,false)) AND economic_calendar.retained_source_allowed(data->'source'->>'provider',data->'source'->>'licenceRef'));
ALTER POLICY current_event_reader ON economic_calendar.sync_runs USING(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND (SELECT profitia_e1_receiver.calendar_scope('events',NULL,false)) AND economic_calendar.retained_source_allowed(provider_id,source_licence_ref));
GRANT SELECT ON economic_calendar.storage_policies,economic_calendar.publications,economic_calendar.publication_observations TO economic_calendar_development_runtime,economic_calendar_development_ingest;
GRANT INSERT,UPDATE ON economic_calendar.publications TO economic_calendar_development_ingest;
GRANT INSERT ON economic_calendar.publication_observations TO economic_calendar_development_ingest;
CREATE FUNCTION economic_calendar.set_storage_policy(expected_version bigint,provider text,licence text,owner_basis text,new_status text)
RETURNS bigint LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE previous_version bigint; next_version bigint;
BEGIN
 IF current_user<>'economic_calendar_development_owner' OR provider IS NULL OR provider NOT IN('eia','commodities-sh')
 OR new_status IS NULL OR new_status NOT IN('ACTIVE','REVOKED') OR licence IS NULL OR length(licence) NOT BETWEEN 1 AND 256
 OR owner_basis IS NULL OR length(owner_basis) NOT BETWEEN 1 AND 256 OR expected_version IS NULL OR expected_version<0
 THEN RAISE EXCEPTION 'Exact ECR licence owner decision required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ecr-storage-policy:'||provider,0));
 SELECT version INTO previous_version FROM economic_calendar.storage_policies WHERE provider_id=provider FOR UPDATE;
 IF coalesce(previous_version,0)<>expected_version THEN RAISE EXCEPTION 'Storage policy expected version changed'; END IF;
 next_version:=expected_version+1;
 INSERT INTO economic_calendar.storage_policies(provider_id,version,status,licence_ref,basis_ref,retention_mode,redistribution)
 VALUES(provider,next_version,new_status,licence,owner_basis,'DURABLE_NO_FIXED_EXPIRY','PRIVATE_AUTHORISED_CONSUMER_ONLY')
 ON CONFLICT(provider_id) DO UPDATE SET version=excluded.version,status=excluded.status,licence_ref=excluded.licence_ref,basis_ref=excluded.basis_ref,updated_at=clock_timestamp();
 INSERT INTO economic_calendar.storage_policy_history(provider_id,version,status,licence_ref,basis_ref) VALUES(provider,next_version,new_status,licence,owner_basis);
 RETURN next_version;
END $fn$;
REVOKE ALL ON FUNCTION economic_calendar.set_storage_policy(bigint,text,text,text,text) FROM PUBLIC;
