CREATE SCHEMA newsfeed AUTHORIZATION __OWNER_ROLE__;
REVOKE ALL ON SCHEMA newsfeed FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE newsfeed.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),environment text NOT NULL CHECK(environment IN('development','staging','production')),
 application_id text NOT NULL,project_id text NOT NULL,branch_id text NOT NULL,database_name name NOT NULL
);
CREATE TABLE newsfeed.observations(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 created_by_actor_id uuid NOT NULL,updated_by_actor_id uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200),subject_kind text NOT NULL CHECK(subject_kind IN('company','product','investment','category','topic')),
 subject text NOT NULL CHECK(length(subject) BETWEEN 1 AND 1000),filters jsonb NOT NULL CHECK(octet_length(filters::text)<=16384),
 status text NOT NULL CHECK(status IN('ACTIVE','PAUSED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,id)
);
CREATE TABLE newsfeed.monitor_runs(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 observation_id uuid NOT NULL,actor_id uuid NOT NULL,observation_version bigint NOT NULL,
 idempotency_digest text NOT NULL CHECK(idempotency_digest~'^[a-f0-9]{64}$'),request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 status text NOT NULL CHECK(status IN('PENDING','SUCCEEDED','FAILED','UNCERTAIN')),error_code text,detected_count integer NOT NULL DEFAULT 0 CHECK(detected_count>=0),publication_count integer NOT NULL DEFAULT 0 CHECK(publication_count>=0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),completed_at timestamptz,
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,id),
 UNIQUE(environment,application_id,organisation_id,owner_user_id,observation_id,idempotency_digest),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,observation_id) REFERENCES newsfeed.observations(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE,
 CHECK(status='PENDING' AND completed_at IS NULL OR status<>'PENDING' AND completed_at IS NOT NULL)
);
CREATE TABLE newsfeed.publications(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 provider_id text NOT NULL,source_record_ref text NOT NULL,fingerprint text NOT NULL CHECK(fingerprint~'^[a-f0-9]{64}$'),
 url text NOT NULL CHECK(url~'^https?://'),headline text,published_at timestamptz,discovered_at timestamptz NOT NULL,
 kind text NOT NULL CHECK(kind IN('NEWS_ARTICLE','WEB_PAGE')),metadata jsonb NOT NULL,licence_ref text NOT NULL,
 retention_until timestamptz NOT NULL CHECK(isfinite(retention_until)),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,id),
 UNIQUE(environment,application_id,organisation_id,owner_user_id,provider_id,source_record_ref)
);
CREATE TABLE newsfeed.observation_publications(
 environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 observation_id uuid NOT NULL,publication_id uuid NOT NULL,first_run_id uuid NOT NULL,detected_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 publication_status text NOT NULL DEFAULT 'DETECTED' CHECK(publication_status IN('DETECTED','PUBLISHED','WITHHELD')),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,observation_id,publication_id),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,observation_id) REFERENCES newsfeed.observations(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,publication_id) REFERENCES newsfeed.publications(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE,
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,first_run_id) REFERENCES newsfeed.monitor_runs(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE
);
-- Future delivery foundation only; this stage starts no scheduler, sender or inbox.
CREATE TABLE newsfeed.notification_outbox(
 id uuid NOT NULL,environment text NOT NULL,application_id text NOT NULL,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 publication_id uuid NOT NULL,event_kind text NOT NULL CHECK(event_kind='PUBLICATION_DETECTED'),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','DELIVERED','CANCELLED')),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(environment,application_id,organisation_id,owner_user_id,id),
 UNIQUE(environment,application_id,organisation_id,owner_user_id,publication_id,event_kind),
 FOREIGN KEY(environment,application_id,organisation_id,owner_user_id,publication_id) REFERENCES newsfeed.publications(environment,application_id,organisation_id,owner_user_id,id) ON DELETE CASCADE
);
CREATE INDEX observations_own_list ON newsfeed.observations(environment,application_id,organisation_id,owner_user_id,status,updated_at DESC);
CREATE INDEX observation_monitor_history ON newsfeed.monitor_runs(environment,application_id,organisation_id,owner_user_id,observation_id,created_at DESC);
CREATE INDEX publication_retention ON newsfeed.publications(retention_until);
CREATE FUNCTION newsfeed.preserve_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF (NEW.environment,NEW.application_id,NEW.organisation_id,NEW.owner_user_id,NEW.created_by_actor_id,NEW.id)
  IS DISTINCT FROM (OLD.environment,OLD.application_id,OLD.organisation_id,OLD.owner_user_id,OLD.created_by_actor_id,OLD.id) THEN
  RAISE EXCEPTION 'Observation ownership is immutable' USING ERRCODE='42501';END IF;
 NEW.version:=OLD.version+1;NEW.updated_at:=clock_timestamp();RETURN NEW;
END $fn$;
CREATE TRIGGER observation_ownership BEFORE UPDATE ON newsfeed.observations FOR EACH ROW EXECUTE FUNCTION newsfeed.preserve_owner();
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['installation','observations','monitor_runs','publications','observation_publications','notification_outbox'] LOOP
  EXECUTE format('ALTER TABLE newsfeed.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE newsfeed.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY schema_owner ON newsfeed.%I TO __OWNER_ROLE__ USING(true) WITH CHECK(true)',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['observations','monitor_runs','publications','observation_publications','notification_outbox'] LOOP
  EXECUTE format($policy$CREATE POLICY private_scope ON newsfeed.%I TO __RUNTIME_ROLE__ USING(
   environment=(SELECT i.environment FROM newsfeed.installation i WHERE i.singleton) AND application_id=(SELECT i.application_id FROM newsfeed.installation i WHERE i.singleton) AND environment=current_setting('profitia.environment',true) AND application_id=current_setting('profitia.application_id',true)
   AND organisation_id::text=current_setting('profitia.organisation_id',true) AND owner_user_id::text=current_setting('profitia.user_id',true)
  ) WITH CHECK(environment=(SELECT i.environment FROM newsfeed.installation i WHERE i.singleton) AND application_id=(SELECT i.application_id FROM newsfeed.installation i WHERE i.singleton) AND environment=current_setting('profitia.environment',true) AND application_id=current_setting('profitia.application_id',true)
   AND organisation_id::text=current_setting('profitia.organisation_id',true) AND owner_user_id::text=current_setting('profitia.user_id',true))$policy$,t);
 END LOOP;
END $policies$;
CREATE POLICY configuration_read ON newsfeed.installation FOR SELECT TO __RUNTIME_ROLE__ USING(true);
GRANT USAGE ON SCHEMA newsfeed TO __RUNTIME_ROLE__;
GRANT SELECT ON newsfeed.installation TO __RUNTIME_ROLE__;
GRANT SELECT,INSERT,UPDATE,DELETE ON newsfeed.observations,newsfeed.monitor_runs,newsfeed.publications,newsfeed.observation_publications,newsfeed.notification_outbox TO __RUNTIME_ROLE__;
