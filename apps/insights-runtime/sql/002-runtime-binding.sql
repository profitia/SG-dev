-- Additive product boundary. No roles, credentials, grants or activation.
DO $guard$ BEGIN
 IF current_user<>'insights_report_owner' THEN RAISE EXCEPTION 'Explicit report owner required'; END IF;
END $guard$;
CREATE TABLE insights_private.runtime_bindings (
 login_role name PRIMARY KEY,binding jsonb NOT NULL,
 organisation_id uuid NOT NULL,mode text NOT NULL CHECK(mode IN('WORKER','RECEIVER')),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),source_ref text NOT NULL
);
ALTER TABLE insights_private.runtime_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights_private.runtime_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_scope ON insights_private.runtime_bindings TO insights_report_owner USING(true) WITH CHECK(true);
REVOKE ALL ON insights_private.runtime_bindings FROM PUBLIC;
CREATE FUNCTION insights_private.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b insights_private.runtime_bindings%ROWTYPE;r pg_catalog.pg_roles%ROWTYPE;
BEGIN
 SELECT * INTO r FROM pg_catalog.pg_roles WHERE rolname=session_user;
 IF NOT FOUND OR NOT r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolinherit OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=r.oid) THEN RETURN NULL; END IF;
 SELECT * INTO b FROM insights_private.runtime_bindings WHERE login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND OR b.binding->>'role' IS DISTINCT FROM session_user::text OR b.binding->>'environment' IS DISTINCT FROM 'development'
 OR b.binding->>'databaseName' IS DISTINCT FROM current_database()
 OR (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='insights_private' AND c.relkind='r' AND c.relowner='insights_report_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity)<>3
 THEN RETURN NULL; END IF;
 RETURN b.binding;
END $fn$;
CREATE FUNCTION insights_private.scope_allows(p_org text,p_job uuid,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b insights_private.runtime_bindings%ROWTYPE;
BEGIN
 IF insights_private.runtime_descriptor() IS NULL THEN RETURN false; END IF;
 SELECT * INTO b FROM insights_private.runtime_bindings WHERE login_role=session_user;
 IF b.organisation_id::text IS DISTINCT FROM p_org THEN RETURN false; END IF;
 IF b.mode='WORKER' THEN RETURN true; END IF;
 RETURN profitia_e1_receiver.report_scope(b.organisation_id,p_job,p_write);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $fn$;
CREATE POLICY current_job_read ON insights_private.report_jobs AS RESTRICTIVE FOR SELECT TO PUBLIC USING(insights_private.scope_allows(organisation_id,id,false));
CREATE POLICY current_job_insert ON insights_private.report_jobs AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(insights_private.scope_allows(organisation_id,id,true));
CREATE POLICY current_job_update ON insights_private.report_jobs AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(insights_private.scope_allows(organisation_id,id,true)) WITH CHECK(insights_private.scope_allows(organisation_id,id,true));
CREATE POLICY current_artifact_read ON insights_private.report_artifacts AS RESTRICTIVE FOR SELECT TO PUBLIC USING(insights_private.scope_allows(organisation_id,job_id,false));
CREATE POLICY current_artifact_insert ON insights_private.report_artifacts AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(insights_private.scope_allows(organisation_id,job_id,true));
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA insights_private FROM PUBLIC;
