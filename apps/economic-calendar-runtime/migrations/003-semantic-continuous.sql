-- Global semantics are ECR-owned. No tenant/user keys or identity directory.
-- Ordinary ingestion can update source facts and work state, never curate meaning.
DO $guard$ BEGIN
 IF current_user<>'economic_calendar_development_owner'
 OR NOT EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND multi_source_schema_digest IS NOT NULL)
 THEN RAISE EXCEPTION 'ECR owner and accepted Stage03 predecessor required'; END IF;
END $guard$;
ALTER TABLE economic_calendar.installation ADD COLUMN semantic_schema_digest text CHECK(semantic_schema_digest~'^[a-f0-9]{64}$');
CREATE TABLE economic_calendar.semantic_revisions(
 kind text NOT NULL CHECK(kind IN('concept','mapping','measure','rule','relevance')),entity_id text NOT NULL CHECK(length(entity_id) BETWEEN 1 AND 256),
 version bigint NOT NULL CHECK(version>0),status text NOT NULL CHECK(status IN('candidate','accepted','rejected','retired')),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object' AND NOT(data ?| ARRAY['userId','organisationId','organizationId'])),
 evidence jsonb NOT NULL CHECK(jsonb_typeof(evidence)='array' AND jsonb_array_length(evidence)>0),
 curator_ref text NOT NULL CHECK(length(curator_ref) BETWEEN 1 AND 4096),fingerprint text NOT NULL CHECK(fingerprint~'^[a-f0-9]{64}$'),
 effective_at timestamptz NOT NULL CHECK(isfinite(effective_at)),recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 approved_at timestamptz,CHECK((status='accepted')=(approved_at IS NOT NULL)),PRIMARY KEY(kind,entity_id,version)
);
CREATE INDEX semantic_as_known ON economic_calendar.semantic_revisions(kind,entity_id,recorded_at DESC,version DESC);
CREATE TABLE economic_calendar.result_storage_policies(
 provider_id text NOT NULL CHECK(provider_id='eia'),family text NOT NULL CHECK(family='series-observations'),dataset_id text NOT NULL,
 series_ids text[] NOT NULL CHECK(cardinality(series_ids)>0),licence_ref text NOT NULL,basis_ref text NOT NULL,
 version bigint NOT NULL CHECK(version>0),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 retention_mode text NOT NULL CHECK(retention_mode='DURABLE_NO_FIXED_EXPIRY'),redistribution text NOT NULL CHECK(redistribution='PRIVATE_AUTHORISED_CONSUMER_ONLY'),
 PRIMARY KEY(provider_id,family,dataset_id)
);
CREATE TABLE economic_calendar.result_observations(
 observation_id text NOT NULL,sequence bigint NOT NULL CHECK(sequence>0),event_id text REFERENCES economic_calendar.events(event_id),
 concept_id text NOT NULL,measure_id text NOT NULL,measure_version bigint NOT NULL CHECK(measure_version>0),provider_id text NOT NULL CHECK(provider_id='eia'),dataset_id text NOT NULL,series_id text NOT NULL,
 reference_period text NOT NULL,geography text NOT NULL,unit text NOT NULL,
 actual numeric,previous numeric,forecast numeric,revised numeric,
 published_at timestamptz,source_updated_at timestamptz,source_retrieved_at timestamptz NOT NULL,observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 fingerprint text NOT NULL CHECK(fingerprint~'^[a-f0-9]{64}$'),receipt_ref uuid NOT NULL,source_record_ref text NOT NULL,source_url text NOT NULL,
 licence_ref text NOT NULL,basis_ref text NOT NULL,rights_version text NOT NULL,
 adopted_as_current boolean NOT NULL,change_kind text NOT NULL CHECK(change_kind IN('FIRST_OBSERVED','VALUE_CHANGED','SOURCE_METADATA_CHANGED','STALE_SOURCE_OBSERVATION')),
 correlation_status text NOT NULL CHECK(correlation_status IN('MATCHED_REFERENCE_PERIOD','UNRESOLVED_EDITION')),
 CHECK((event_id IS NOT NULL)=(correlation_status='MATCHED_REFERENCE_PERIOD')),
 CHECK(previous IS NULL AND forecast IS NULL AND revised IS NULL),
 PRIMARY KEY(observation_id,sequence)
);
CREATE TABLE economic_calendar.result_storage_policy_history(LIKE economic_calendar.result_storage_policies INCLUDING CONSTRAINTS);
ALTER TABLE economic_calendar.result_storage_policy_history ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT clock_timestamp();
CREATE UNIQUE INDEX result_storage_policy_version ON economic_calendar.result_storage_policy_history(provider_id,family,dataset_id,version);
CREATE INDEX result_event ON economic_calendar.result_observations(event_id,measure_id,observed_at DESC,sequence DESC);
CREATE TABLE economic_calendar.result_links(
 observation_id text NOT NULL,version bigint NOT NULL CHECK(version>0),source_sequence bigint NOT NULL,
 event_id text REFERENCES economic_calendar.events(event_id),recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 method text NOT NULL CHECK(method='EXACT_EIA_WPSR_REFERENCE_PERIOD/1'),
 status text NOT NULL CHECK(status IN('MATCHED_REFERENCE_PERIOD','UNRESOLVED_EDITION')),
 CHECK((event_id IS NOT NULL)=(status='MATCHED_REFERENCE_PERIOD')),
 FOREIGN KEY(observation_id,source_sequence) REFERENCES economic_calendar.result_observations(observation_id,sequence),PRIMARY KEY(observation_id,version)
);
CREATE TABLE economic_calendar.result_acquisitions(
 intent_digest text PRIMARY KEY CHECK(intent_digest~'^[a-f0-9]{64}$'),request_digest text NOT NULL,content_digest text NOT NULL,
 receipt_ref uuid NOT NULL UNIQUE,result jsonb NOT NULL,observed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE economic_calendar.sync_jobs(
 job_id text PRIMARY KEY,provider_id text NOT NULL,command_template jsonb NOT NULL,organisation_id uuid NOT NULL,grant_id uuid NOT NULL,
 interval_seconds integer NOT NULL CHECK(interval_seconds BETWEEN 900 AND 2678400),
 status text NOT NULL CHECK(status IN('ACTIVE','PAUSED')),next_due_at timestamptz NOT NULL,
 intent_id uuid,active_command jsonb,attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),lease_token uuid,lease_until timestamptz,
 last_success_at timestamptz,last_error_code text,last_receipt_ref uuid,last_result jsonb,
 CHECK((lease_token IS NULL)=(lease_until IS NULL))
);
CREATE TABLE economic_calendar.sync_attempts(
 attempt_id uuid PRIMARY KEY,job_id text NOT NULL REFERENCES economic_calendar.sync_jobs(job_id),intent_id uuid NOT NULL,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),finished_at timestamptz,
 trigger_kind text NOT NULL CHECK(trigger_kind IN('SCHEDULED','MANUAL_VALIDATION')),outcome text NOT NULL CHECK(outcome IN('RUNNING','SUCCEEDED','RETRY','BLOCKED','INTERRUPTED')),
 error_code text,receipt_ref uuid,result jsonb
);
CREATE INDEX sync_due ON economic_calendar.sync_jobs(next_due_at) WHERE status='ACTIVE';
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['semantic_revisions','result_storage_policies','result_storage_policy_history','result_observations','result_links','result_acquisitions','sync_jobs','sync_attempts'] LOOP
 EXECUTE format('ALTER TABLE economic_calendar.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE economic_calendar.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY schema_owner ON economic_calendar.%I TO economic_calendar_development_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $policies$;
CREATE FUNCTION economic_calendar.record_result_policy() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Result policy requires next version'; END IF;
 INSERT INTO economic_calendar.result_storage_policy_history SELECT NEW.*,clock_timestamp();RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION economic_calendar.record_result_policy() FROM PUBLIC;
CREATE TRIGGER result_policy_history AFTER INSERT OR UPDATE ON economic_calendar.result_storage_policies FOR EACH ROW EXECUTE FUNCTION economic_calendar.record_result_policy();
CREATE POLICY entitled_reader ON economic_calendar.semantic_revisions FOR SELECT TO economic_calendar_development_runtime
 USING((SELECT profitia_e1_receiver.calendar_scope('events',NULL,false)) AND EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE'));
CREATE POLICY ingester_metadata ON economic_calendar.semantic_revisions FOR SELECT TO economic_calendar_development_ingest USING(true);
CREATE POLICY result_policy_metadata ON economic_calendar.result_storage_policies FOR SELECT TO economic_calendar_development_ingest,economic_calendar_development_runtime USING(true);
CREATE FUNCTION economic_calendar.result_allowed(provider text,dataset text,series text,licence text,basis text) RETURNS boolean LANGUAGE sql STABLE
 SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT EXISTS(SELECT 1 FROM economic_calendar.result_storage_policies p WHERE p.provider_id=provider AND p.dataset_id=dataset
 AND series=ANY(p.series_ids) AND p.licence_ref=licence AND p.basis_ref=basis AND p.status='ACTIVE')
$fn$;
REVOKE ALL ON FUNCTION economic_calendar.result_allowed(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION economic_calendar.result_allowed(text,text,text,text,text) TO economic_calendar_development_runtime,economic_calendar_development_ingest;
CREATE POLICY result_reader ON economic_calendar.result_observations FOR SELECT TO economic_calendar_development_runtime USING(
 (SELECT profitia_e1_receiver.calendar_scope('events',NULL,false)) AND EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE')
 AND economic_calendar.result_allowed(provider_id,dataset_id,series_id,licence_ref,basis_ref));
CREATE POLICY result_ingester ON economic_calendar.result_observations TO economic_calendar_development_ingest USING(
 economic_calendar.result_allowed(provider_id,dataset_id,series_id,licence_ref,basis_ref)) WITH CHECK(
 economic_calendar.result_allowed(provider_id,dataset_id,series_id,licence_ref,basis_ref));
CREATE POLICY licensed_link_reader ON economic_calendar.result_links FOR SELECT TO economic_calendar_development_runtime,economic_calendar_development_ingest
 USING(EXISTS(SELECT 1 FROM economic_calendar.result_observations o WHERE o.observation_id=result_links.observation_id AND o.sequence=result_links.source_sequence));
CREATE POLICY licensed_link_writer ON economic_calendar.result_links FOR INSERT TO economic_calendar_development_ingest
 WITH CHECK(EXISTS(SELECT 1 FROM economic_calendar.result_observations o WHERE o.observation_id=result_links.observation_id AND o.sequence=result_links.source_sequence));
DO $work$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['result_acquisitions','sync_jobs','sync_attempts'] LOOP
 EXECUTE format('CREATE POLICY ingester ON economic_calendar.%I TO economic_calendar_development_ingest USING(true) WITH CHECK(true)',t);
 END LOOP;
END $work$;
-- Public synchronization metadata contains no command, organisation or grant IDs.
CREATE POLICY freshness_reader ON economic_calendar.sync_jobs FOR SELECT TO economic_calendar_development_runtime
 USING((SELECT profitia_e1_receiver.calendar_scope('events',NULL,false)));
GRANT SELECT ON economic_calendar.semantic_revisions,economic_calendar.result_storage_policies,economic_calendar.result_observations TO economic_calendar_development_ingest,economic_calendar_development_runtime;
GRANT INSERT ON economic_calendar.result_observations TO economic_calendar_development_ingest;
GRANT SELECT ON economic_calendar.result_links TO economic_calendar_development_runtime,economic_calendar_development_ingest;
GRANT INSERT ON economic_calendar.result_links TO economic_calendar_development_ingest;
GRANT SELECT,INSERT ON economic_calendar.result_acquisitions TO economic_calendar_development_ingest;
GRANT SELECT,UPDATE ON economic_calendar.sync_jobs TO economic_calendar_development_ingest;
GRANT SELECT,INSERT,UPDATE ON economic_calendar.sync_attempts TO economic_calendar_development_ingest;
GRANT SELECT(job_id,provider_id,status,next_due_at,last_success_at,last_error_code,last_receipt_ref,last_result,lease_until) ON economic_calendar.sync_jobs TO economic_calendar_development_runtime;
