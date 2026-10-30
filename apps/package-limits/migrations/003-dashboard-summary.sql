-- Additive read contract. Base installation and immutable commercial history stay unchanged.
DO $guard$ BEGIN
 IF current_user<>'profitia_limits_owner' OR current_database()<>'neondb' OR NOT EXISTS(SELECT 1 FROM profitia_limits.installation WHERE singleton AND environment='development' AND project_id='lingering-thunder-05075810' AND branch_id='br-green-hall-b9s837k0') OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profitia_limits' AND c.relname='dashboard_installation') THEN RAISE EXCEPTION 'EXACT_DASHBOARD_INSTALLATION_REQUIRED';END IF;
END $guard$;
SET LOCAL search_path=profitia_limits,pg_catalog;
CREATE TABLE dashboard_installation(singleton boolean PRIMARY KEY CHECK(singleton),schema_digest text NOT NULL,installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE dashboard_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON dashboard_installation TO profitia_limits_owner USING(true) WITH CHECK(true);
INSERT INTO dashboard_installation VALUES(true,'__DASHBOARD_SCHEMA_DIGEST__',clock_timestamp());
CREATE TRIGGER immutable_dashboard_receipt BEFORE UPDATE OR DELETE OR TRUNCATE ON dashboard_installation FOR EACH STATEMENT EXECUTE FUNCTION immutable_history();
CREATE FUNCTION dashboard_health() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits AS $fn$
BEGIN PERFORM ordinary_runtime();IF NOT EXISTS(SELECT 1 FROM dashboard_installation WHERE singleton AND schema_digest='__DASHBOARD_SCHEMA_DIGEST__') THEN RAISE EXCEPTION 'DASHBOARD_INSTALLATION_REQUIRED';END IF;RETURN '__DASHBOARD_SCHEMA_DIGEST__';END $fn$;
CREATE FUNCTION dashboard(p_actor uuid,p_until bigint,p_tx text,p_json text,p_proof text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits AS $fn$
DECLARE result jsonb;
BEGIN
 -- Reuse the current signed operator boundary. The proof authorises this read only.
 PERFORM api(p_actor,p_until,p_tx,'authorize',p_json,p_proof);
 PERFORM dashboard_health();
 WITH current_assignments AS MATERIALIZED (
  SELECT a.id,a.organisation_id,a.product_id,coalesce(
   (SELECT v.payload FROM assignment_revisions v WHERE v.assignment_id=a.id AND v.effective_at<=clock_timestamp() ORDER BY v.revision DESC LIMIT 1),
   (SELECT v.payload FROM assignment_revisions v WHERE v.assignment_id=a.id ORDER BY v.revision LIMIT 1)) AS payload
  FROM assignments a
 ), statuses AS MATERIALIZED (
  SELECT *,status_of(payload) AS status,((payload->'terms'->>'assignmentEnd')::date::timestamp AT TIME ZONE (payload->'terms'->>'timezone')) AS end_at FROM current_assignments
 )
 SELECT jsonb_build_object(
  'products',(SELECT count(*) FROM products),'packages',(SELECT count(*) FROM packages),
  'versions',(SELECT count(*) FROM package_versions),'publishedVersions',(SELECT count(*) FROM package_versions WHERE state='PUBLISHED'),
  'organisations',(SELECT count(DISTINCT organisation_id) FROM assignments),
  'activeAssignments',(SELECT count(*) FROM statuses WHERE status='ACTIVE'),'plannedAssignments',(SELECT count(*) FROM statuses WHERE status='PLANNED'),
  'nearestEnds',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT id,organisation_id,product_id,payload->'packageSnapshot'->>'name' AS package_name,end_at FROM statuses WHERE status IN('ACTIVE','PLANNED') ORDER BY end_at,id LIMIT 5)t)
 ) INTO result;
 RETURN result;
END $fn$;
REVOKE ALL ON dashboard_installation FROM PUBLIC,profitia_limits_runtime;
REVOKE ALL ON FUNCTION dashboard_health(),dashboard(uuid,bigint,text,text,text) FROM PUBLIC,profitia_limits_runtime;
GRANT EXECUTE ON FUNCTION dashboard_health(),dashboard(uuid,bigint,text,text,text) TO profitia_limits_runtime;
