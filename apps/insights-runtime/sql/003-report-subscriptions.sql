-- Additive user orders. No producer publication, SERVICE delegation, email or
-- paid operation is enabled by this migration. Existing roles only.
DO $guard$ BEGIN IF current_user<>'insights_report_owner' THEN RAISE EXCEPTION 'Existing Insights owner required'; END IF; END $guard$;
CREATE TABLE insights_private.subscription_migrations(version text PRIMARY KEY,digest text NOT NULL CHECK(digest~'^[a-f0-9]{64}$'));
CREATE TABLE insights_private.report_subscriptions(
 id uuid PRIMARY KEY,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,created_by_actor_id uuid NOT NULL,
 definition_id text NOT NULL,profile_version text NOT NULL,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),status text NOT NULL CHECK(status IN('ACTIVE','PAUSED','ENDED')),
 execution_state text NOT NULL DEFAULT 'WAITING_AUTHORIZATION' CHECK(execution_state IN('WAITING_AUTHORIZATION','READY','QUEUED','ENDED')),
 definition jsonb NOT NULL CHECK(octet_length(definition::text)<=16384),next_due_at timestamptz,
 idempotency_digest text NOT NULL CHECK(idempotency_digest~'^[a-f0-9]{64}$'),request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(organisation_id,owner_user_id,id),UNIQUE(organisation_id,owner_user_id,idempotency_digest)
);
CREATE TABLE insights_private.subscription_versions(
 subscription_id uuid NOT NULL REFERENCES insights_private.report_subscriptions(id) ON DELETE CASCADE,
 organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,version bigint NOT NULL,definition jsonb NOT NULL,status text NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(subscription_id,version)
);
CREATE TABLE insights_private.subscription_runs(
 id uuid PRIMARY KEY,subscription_id uuid NOT NULL REFERENCES insights_private.report_subscriptions(id),organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,
 subscription_version bigint NOT NULL,slot_key text NOT NULL,producer_job_id uuid,
 status text NOT NULL CHECK(status IN('WAITING_AUTHORIZATION','QUEUED','RUNNING','AWAITING_REVIEW','PUBLISHED','FAILED','UNCERTAIN','CANCELLED')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(subscription_id,slot_key),
 FOREIGN KEY(subscription_id,subscription_version) REFERENCES insights_private.subscription_versions(subscription_id,version)
);
CREATE INDEX subscriptions_own_list ON insights_private.report_subscriptions(organisation_id,owner_user_id,updated_at DESC,id DESC);
CREATE INDEX subscriptions_due ON insights_private.report_subscriptions(next_due_at,id) WHERE status='ACTIVE' AND execution_state='READY';
-- A producer's review candidate is not a publication. Only the already
-- authorised domain owner may record the separately accepted publication
-- decision. Runtime/worker roles receive no publication writer.
CREATE TABLE insights_private.published_editions(
 producer_job_id uuid PRIMARY KEY REFERENCES insights_private.report_jobs(id),organisation_id uuid NOT NULL,
 edition_id text NOT NULL,definition_id text NOT NULL,profile_version text NOT NULL,title text NOT NULL CHECK(length(title) BETWEEN 1 AND 300),
 period jsonb NOT NULL,as_of timestamptz NOT NULL,published_at timestamptz NOT NULL CHECK(isfinite(published_at)),
 approval_ref text NOT NULL CHECK(length(approval_ref) BETWEEN 1 AND 500),
 pdf_kind text NOT NULL DEFAULT 'pdf' CHECK(pdf_kind='pdf'),markdown_kind text NOT NULL DEFAULT 'markdown' CHECK(markdown_kind='markdown'),
 pdf_sha256 text NOT NULL CHECK(pdf_sha256~'^[a-f0-9]{64}$'),markdown_sha256 text NOT NULL CHECK(markdown_sha256~'^[a-f0-9]{64}$'),
 FOREIGN KEY(producer_job_id,pdf_kind) REFERENCES insights_private.report_artifacts(job_id,kind),
 FOREIGN KEY(producer_job_id,markdown_kind) REFERENCES insights_private.report_artifacts(job_id,kind),UNIQUE(organisation_id,edition_id)
);
CREATE FUNCTION insights_private.publication_scope(p_org uuid,p_job uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;actor uuid;b insights_private.runtime_bindings%ROWTYPE;
BEGIN
 SELECT * INTO b FROM insights_private.runtime_bindings WHERE login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR b.mode<>'RECEIVER' OR b.organisation_id<>p_org OR NOT profitia_e1_receiver.report_scope(p_org,p_job,false) THEN RETURN false; END IF;
 p:=(nullif(current_setting('profitia.current_e1_proof',true),'')::jsonb->>'payload')::jsonb;
 IF p->'actor'->>'kind'<>'HUMAN' THEN RETURN false; END IF;actor:=(p->'actor'->>'userId')::uuid;
 RETURN EXISTS(SELECT 1 FROM insights_private.subscription_runs WHERE organisation_id=p_org AND owner_user_id=actor AND producer_job_id=p_job);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
CREATE FUNCTION insights_private.immutable_publication() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Published edition is immutable' USING ERRCODE='42501';END $fn$;
CREATE FUNCTION insights_private.validate_publication() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE j insights_private.report_jobs%ROWTYPE;pdf insights_private.report_artifacts%ROWTYPE;md insights_private.report_artifacts%ROWTYPE;
BEGIN
 SELECT * INTO STRICT j FROM insights_private.report_jobs WHERE id=NEW.producer_job_id FOR SHARE;
 SELECT * INTO STRICT pdf FROM insights_private.report_artifacts WHERE job_id=j.id AND kind='pdf';
 SELECT * INTO STRICT md FROM insights_private.report_artifacts WHERE job_id=j.id AND kind='markdown';
 IF j.status<>'AWAITING_REVIEW' OR j.organisation_id<>NEW.organisation_id::text OR j.definition_id<>NEW.definition_id
 OR j.document->>'editionId' IS DISTINCT FROM NEW.edition_id OR j.document->'command'->>'profileVersion' IS DISTINCT FROM NEW.profile_version
 OR j.document->'command'->'period' IS DISTINCT FROM NEW.period OR coalesce(j.document->>'asOf',j.document->'command'->>'asOf')::timestamptz IS DISTINCT FROM NEW.as_of
 OR pdf.sha256<>NEW.pdf_sha256 OR md.sha256<>NEW.markdown_sha256
 OR encode(public.digest(pdf.bytes,'sha256'),'hex')<>NEW.pdf_sha256 OR encode(public.digest(md.bytes,'sha256'),'hex')<>NEW.markdown_sha256
 THEN RAISE EXCEPTION 'Publication candidate mismatch' USING ERRCODE='42501';END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER validate_publication BEFORE INSERT ON insights_private.published_editions FOR EACH ROW EXECUTE FUNCTION insights_private.validate_publication();
CREATE TRIGGER immutable_publication BEFORE UPDATE OR DELETE ON insights_private.published_editions FOR EACH ROW EXECUTE FUNCTION insights_private.immutable_publication();
ALTER TABLE insights_private.published_editions ENABLE ROW LEVEL SECURITY;ALTER TABLE insights_private.published_editions FORCE ROW LEVEL SECURITY;
CREATE POLICY publication_owner ON insights_private.published_editions TO insights_report_owner USING(true) WITH CHECK(true);
CREATE POLICY entitled_publication ON insights_private.published_editions FOR SELECT TO PUBLIC USING(insights_private.publication_scope(organisation_id,producer_job_id));
CREATE FUNCTION insights_private.subscription_scope(p_org uuid,p_user uuid,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;b insights_private.runtime_bindings%ROWTYPE;
BEGIN
 SELECT * INTO b FROM insights_private.runtime_bindings WHERE login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp();
 -- A pre-existing organisation-wide worker grant never becomes a private
 -- user's recurring delegation. Receiver proof is mandatory here.
 IF NOT FOUND OR b.mode<>'RECEIVER' OR b.organisation_id<>p_org THEN RETURN false; END IF;
 IF NOT profitia_e1_receiver.report_scope(p_org,NULL,p_write) THEN RETURN false; END IF;
 p:=(nullif(current_setting('profitia.current_e1_proof',true),'')::jsonb->>'payload')::jsonb;
 RETURN p_user=(p->'actor'->>'userId')::uuid AND p->'actor'->>'kind'='HUMAN';
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
CREATE TABLE insights_private.subscription_events(
 id uuid PRIMARY KEY,organisation_id uuid NOT NULL,owner_user_id uuid NOT NULL,producer_job_id uuid NOT NULL REFERENCES insights_private.published_editions(producer_job_id),
 event_kind text NOT NULL CHECK(event_kind='REPORT_PUBLISHED'),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),read_at timestamptz,
 UNIQUE(organisation_id,owner_user_id,producer_job_id,event_kind)
);
ALTER TABLE insights_private.subscription_events ENABLE ROW LEVEL SECURITY;ALTER TABLE insights_private.subscription_events FORCE ROW LEVEL SECURITY;
CREATE POLICY event_owner ON insights_private.subscription_events TO insights_report_owner USING(true) WITH CHECK(true);
CREATE POLICY own_event_read ON insights_private.subscription_events FOR SELECT TO PUBLIC USING(insights_private.subscription_scope(organisation_id,owner_user_id,false));
CREATE POLICY own_event_update ON insights_private.subscription_events FOR UPDATE TO PUBLIC USING(insights_private.subscription_scope(organisation_id,owner_user_id,true)) WITH CHECK(insights_private.subscription_scope(organisation_id,owner_user_id,true));
CREATE FUNCTION insights_private.publication_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 INSERT INTO insights_private.subscription_events(id,organisation_id,owner_user_id,producer_job_id,event_kind)
 SELECT gen_random_uuid(),NEW.organisation_id,r.owner_user_id,NEW.producer_job_id,'REPORT_PUBLISHED' FROM insights_private.subscription_runs r
 JOIN insights_private.report_subscriptions s ON s.id=r.subscription_id AND s.organisation_id=r.organisation_id AND s.owner_user_id=r.owner_user_id
 WHERE r.producer_job_id=NEW.producer_job_id AND r.organisation_id=NEW.organisation_id AND s.definition->'notifications'->>'assistant'='true'
 GROUP BY r.owner_user_id ON CONFLICT DO NOTHING;
 RETURN NEW;
END $fn$;
CREATE TRIGGER publication_event AFTER INSERT ON insights_private.published_editions FOR EACH ROW EXECUTE FUNCTION insights_private.publication_event();
CREATE FUNCTION insights_private.subscription_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 INSERT INTO insights_private.subscription_versions(subscription_id,organisation_id,owner_user_id,version,definition,status) VALUES(NEW.id,NEW.organisation_id,NEW.owner_user_id,NEW.version,NEW.definition,NEW.status);
 RETURN NEW;
END $fn$;
-- AFTER INSERT is needed because the version has a real parent FK. UPDATE
-- versioning is handled separately before the new immutable version is added.
CREATE FUNCTION insights_private.subscription_preserve_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF (NEW.id,NEW.organisation_id,NEW.owner_user_id,NEW.created_by_actor_id) IS DISTINCT FROM (OLD.id,OLD.organisation_id,OLD.owner_user_id,OLD.created_by_actor_id) THEN RAISE EXCEPTION 'Subscription ownership is immutable' USING ERRCODE='42501';END IF;
 NEW.version:=OLD.version+1;NEW.updated_at:=clock_timestamp();RETURN NEW;
END $fn$;
CREATE TRIGGER subscription_owner BEFORE UPDATE ON insights_private.report_subscriptions FOR EACH ROW EXECUTE FUNCTION insights_private.subscription_preserve_owner();
CREATE TRIGGER subscription_history AFTER INSERT OR UPDATE ON insights_private.report_subscriptions FOR EACH ROW EXECUTE FUNCTION insights_private.subscription_snapshot();
DO $rls$ DECLARE t text; r name;BEGIN
 FOREACH t IN ARRAY ARRAY['report_subscriptions','subscription_versions','subscription_runs'] LOOP
  EXECUTE format('ALTER TABLE insights_private.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('ALTER TABLE insights_private.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY domain_owner ON insights_private.%I TO insights_report_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY own_read ON insights_private.%I FOR SELECT TO PUBLIC USING(insights_private.subscription_scope(organisation_id,owner_user_id,false))',t);
 END LOOP;
 CREATE POLICY own_insert ON insights_private.report_subscriptions FOR INSERT TO PUBLIC WITH CHECK(insights_private.subscription_scope(organisation_id,owner_user_id,true));
 CREATE POLICY own_update ON insights_private.report_subscriptions FOR UPDATE TO PUBLIC USING(insights_private.subscription_scope(organisation_id,owner_user_id,true)) WITH CHECK(insights_private.subscription_scope(organisation_id,owner_user_id,true));
 CREATE POLICY own_run_insert ON insights_private.subscription_runs FOR INSERT TO PUBLIC WITH CHECK(status<>'PUBLISHED' AND insights_private.subscription_scope(organisation_id,owner_user_id,true));
 FOR r IN SELECT login_role FROM insights_private.runtime_bindings WHERE mode='RECEIVER' AND status='ACTIVE' AND expires_at>clock_timestamp() LOOP
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON insights_private.report_subscriptions TO %I',r);
  EXECUTE format('GRANT SELECT ON insights_private.subscription_versions,insights_private.subscription_runs,insights_private.subscription_migrations TO %I',r);
  EXECUTE format('GRANT SELECT ON insights_private.published_editions TO %I',r);
  EXECUTE format('GRANT SELECT,UPDATE(read_at) ON insights_private.subscription_events TO %I',r);
  EXECUTE format('GRANT INSERT ON insights_private.subscription_runs TO %I',r);
  EXECUTE format('GRANT EXECUTE ON FUNCTION insights_private.subscription_scope(uuid,uuid,boolean) TO %I',r);
  EXECUTE format('GRANT EXECUTE ON FUNCTION insights_private.publication_scope(uuid,uuid) TO %I',r);
 END LOOP;
END $rls$;
REVOKE ALL ON FUNCTION insights_private.subscription_scope(uuid,uuid,boolean),insights_private.subscription_snapshot(),insights_private.subscription_preserve_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION insights_private.publication_scope(uuid,uuid),insights_private.immutable_publication(),insights_private.validate_publication() FROM PUBLIC;
REVOKE ALL ON FUNCTION insights_private.publication_event() FROM PUBLIC;
ALTER TABLE insights_private.subscription_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights_private.subscription_migrations FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_scope ON insights_private.subscription_migrations TO insights_report_owner USING(true) WITH CHECK(true);
CREATE POLICY version_read ON insights_private.subscription_migrations FOR SELECT TO PUBLIC USING(true);
-- Preserve the physical binding and existing checks while admitting exactly
-- the four additional, owner-controlled FORCE-RLS tables of this migration.
CREATE OR REPLACE FUNCTION insights_private.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b insights_private.runtime_bindings%ROWTYPE;r pg_catalog.pg_roles%ROWTYPE;
BEGIN
 SELECT * INTO r FROM pg_catalog.pg_roles WHERE rolname=session_user;
 IF NOT FOUND OR NOT r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolinherit OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid) THEN RETURN NULL;END IF;
 SELECT * INTO b FROM insights_private.runtime_bindings WHERE login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR b.binding->>'role' IS DISTINCT FROM session_user::text OR b.binding->>'environment' IS DISTINCT FROM 'development' OR b.binding->>'databaseName' IS DISTINCT FROM current_database()
 OR (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='insights_private' AND c.relkind='r' AND c.relowner='insights_report_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity AND c.relname IN('report_jobs','report_artifacts','runtime_bindings','subscription_migrations','report_subscriptions','subscription_versions','subscription_runs','published_editions','subscription_events'))<>9
 THEN RETURN NULL;END IF;RETURN b.binding;
END $fn$;
