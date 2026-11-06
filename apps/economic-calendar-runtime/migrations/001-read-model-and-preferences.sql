-- ECR product storage only. Roles and resource allocation are owner prerequisites.
-- No CREATE ROLE, user directory, business grant, provider licence or PMOS data.
DO $guard$ BEGIN
 IF current_user<>'economic_calendar_development_owner'
 OR to_regprocedure('profitia_e1_receiver.calendar_scope(text,uuid,boolean)') IS NULL
 THEN RAISE EXCEPTION 'ECR owner and accepted current E1 calendar receiver required'; END IF;
END $guard$;
CREATE SCHEMA economic_calendar AUTHORIZATION economic_calendar_development_owner;
REVOKE ALL ON SCHEMA economic_calendar FROM PUBLIC;
CREATE TABLE economic_calendar.installation (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 receiver_base_digest text NOT NULL CHECK(receiver_base_digest~'^[a-f0-9]{64}$'),
 calendar_receiver_digest text NOT NULL CHECK(calendar_receiver_digest~'^[a-f0-9]{64}$'),
 application_id text NOT NULL CHECK(application_id='profitia-economic-calendar-runtime-development'),
 environment text NOT NULL CHECK(environment='development'),
 project_id text NOT NULL,branch_id text NOT NULL,database_name text NOT NULL,
 status text NOT NULL CHECK(status IN('ACTIVE','DISABLED')),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
CREATE TABLE economic_calendar.events (
 event_id text PRIMARY KEY CHECK(event_id~'^ecr_evt_[a-f0-9]{64}$'),
 provider text NOT NULL CHECK(provider='trading-economics'),vendor_event_id text NOT NULL,
 current_fingerprint text NOT NULL CHECK(current_fingerprint~'^[a-f0-9]{64}$'),
 current_data jsonb NOT NULL CHECK(jsonb_typeof(current_data)='object'),
 current_sequence bigint NOT NULL CHECK(current_sequence>0),
 current_receipt_ref uuid NOT NULL,current_source_retrieved_at timestamptz NOT NULL,
 last_receipt_ref uuid NOT NULL,last_source_retrieved_at timestamptz NOT NULL,
 first_observed_at timestamptz NOT NULL CHECK(isfinite(first_observed_at)),
 current_observed_at timestamptz NOT NULL CHECK(isfinite(current_observed_at)),
 last_observed_at timestamptz NOT NULL CHECK(isfinite(last_observed_at)),
 UNIQUE(provider,vendor_event_id)
);
CREATE TABLE economic_calendar.sync_runs (
 receipt_ref uuid PRIMARY KEY,
 intent_digest text NOT NULL UNIQUE CHECK(intent_digest~'^[a-f0-9]{64}$'),
 request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 content_digest text NOT NULL CHECK(content_digest~'^[a-f0-9]{64}$'),
 observed_at timestamptz NOT NULL CHECK(isfinite(observed_at)),
 source_retrieved_at timestamptz NOT NULL CHECK(isfinite(source_retrieved_at)),
 coverage jsonb NOT NULL CHECK(jsonb_typeof(coverage)='object'),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object')
);
CREATE TABLE economic_calendar.observations (
 event_id text NOT NULL REFERENCES economic_calendar.events(event_id),
 sequence bigint NOT NULL CHECK(sequence>0),
 fingerprint text NOT NULL CHECK(fingerprint~'^[a-f0-9]{64}$'),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 observed_at timestamptz NOT NULL CHECK(isfinite(observed_at)),
 source_retrieved_at timestamptz NOT NULL CHECK(isfinite(source_retrieved_at)),
 receipt_ref uuid NOT NULL REFERENCES economic_calendar.sync_runs(receipt_ref) DEFERRABLE INITIALLY DEFERRED,
 adopted_as_current boolean NOT NULL,
 change_kinds text[] NOT NULL CHECK(cardinality(change_kinds)>0),
 PRIMARY KEY(event_id,sequence)
);
CREATE INDEX events_by_date ON economic_calendar.events((current_data->>'eventAt'),event_id);
CREATE INDEX events_by_country_indicator ON economic_calendar.events((current_data->>'country'),(current_data->>'indicator'),event_id);
CREATE INDEX observations_as_known ON economic_calendar.observations(event_id,observed_at DESC,sequence DESC) WHERE adopted_as_current;
CREATE INDEX sync_runs_observed ON economic_calendar.sync_runs(observed_at DESC);
CREATE TABLE economic_calendar.preferences (
 user_id uuid PRIMARY KEY,
 revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0),
 data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_write_organisation_id uuid NOT NULL
);
-- Deliberately no cascading FK into provider facts. A saved reference remains
-- personal and never silently binds to a replacement release or disappears.
CREATE TABLE economic_calendar.favourites (
 user_id uuid NOT NULL REFERENCES economic_calendar.preferences(user_id),
 event_id text NOT NULL CHECK(event_id~'^ecr_evt_[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,event_id)
);
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['installation','events','sync_runs','observations','preferences','favourites'] LOOP
 EXECUTE format('ALTER TABLE economic_calendar.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE economic_calendar.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY schema_owner ON economic_calendar.%I TO economic_calendar_development_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['events','sync_runs','observations'] LOOP
 EXECUTE format($p$CREATE POLICY current_event_reader ON economic_calendar.%I FOR SELECT TO economic_calendar_development_runtime USING(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND profitia_e1_receiver.calendar_scope('events',NULL,false))$p$,t);
 EXECUTE format($p$CREATE POLICY enrolled_ingester ON economic_calendar.%I TO economic_calendar_development_ingest USING(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE')) WITH CHECK(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE'))$p$,t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['preferences','favourites'] LOOP
 EXECUTE format($p$CREATE POLICY private_read ON economic_calendar.%I FOR SELECT TO economic_calendar_development_runtime USING(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND profitia_e1_receiver.calendar_scope('preferences',user_id,false))$p$,t);
 EXECUTE format($p$CREATE POLICY private_insert ON economic_calendar.%I FOR INSERT TO economic_calendar_development_runtime WITH CHECK(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND profitia_e1_receiver.calendar_scope('preferences',user_id,true))$p$,t);
 EXECUTE format($p$CREATE POLICY private_update ON economic_calendar.%I FOR UPDATE TO economic_calendar_development_runtime USING(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND profitia_e1_receiver.calendar_scope('preferences',user_id,true)) WITH CHECK(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND profitia_e1_receiver.calendar_scope('preferences',user_id,true))$p$,t);
 EXECUTE format($p$CREATE POLICY private_delete ON economic_calendar.%I FOR DELETE TO economic_calendar_development_runtime USING(EXISTS(SELECT 1 FROM economic_calendar.installation WHERE singleton AND status='ACTIVE') AND profitia_e1_receiver.calendar_scope('preferences',user_id,true))$p$,t);
 END LOOP;
END $policies$;
CREATE POLICY runtime_installation ON economic_calendar.installation FOR SELECT TO economic_calendar_development_runtime,economic_calendar_development_ingest USING(true);
GRANT USAGE ON SCHEMA economic_calendar TO economic_calendar_development_runtime,economic_calendar_development_ingest;
GRANT SELECT ON economic_calendar.installation,economic_calendar.events,economic_calendar.observations,economic_calendar.sync_runs TO economic_calendar_development_runtime;
GRANT SELECT,INSERT,UPDATE ON economic_calendar.preferences TO economic_calendar_development_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON economic_calendar.favourites TO economic_calendar_development_runtime;
GRANT SELECT ON economic_calendar.installation TO economic_calendar_development_ingest;
GRANT SELECT,INSERT,UPDATE ON economic_calendar.events TO economic_calendar_development_ingest;
GRANT SELECT,INSERT ON economic_calendar.observations,economic_calendar.sync_runs TO economic_calendar_development_ingest;
