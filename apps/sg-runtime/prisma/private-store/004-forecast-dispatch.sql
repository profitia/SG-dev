-- Native command projection for the existing shared delegated-job contract.
-- No second job table, scheduler, role, grant, receipt or activation is seeded.
DO $guard$ BEGIN
  IF current_user<>'profitia_access_owner'
    OR NOT EXISTS(SELECT 1 FROM profitia_jobs.installation WHERE singleton AND schema_version='1.0.0'
      AND schema_digest='6a12132efab396e6e647e15d1a9711d0a1bacaaab4482639178acd0258d518cb')
    OR NOT EXISTS(SELECT 1 FROM profitia_forecast_requests.installation WHERE singleton AND schema_version='1.0.0'
      AND boundary_digest='90f72b87071fb81a7ac594cbf48836511ef935aaf9f09ab8a7a1402b25d337d8') THEN
    RAISE EXCEPTION 'Accepted controlled private request and job authority required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE SCHEMA profitia_forecast_dispatch AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_forecast_dispatch FROM PUBLIC;
CREATE TABLE profitia_forecast_dispatch.installation(
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
ALTER TABLE profitia_forecast_dispatch.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_forecast_dispatch.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_forecast_dispatch.installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY metadata_read_fence ON profitia_forecast_dispatch.installation AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='profitia_access_owner');
CREATE POLICY metadata_insert_fence ON profitia_forecast_dispatch.installation AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY metadata_update_fence ON profitia_forecast_dispatch.installation AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY metadata_delete_fence ON profitia_forecast_dispatch.installation AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user='profitia_access_owner');
CREATE TRIGGER dispatch_metadata_revision BEFORE INSERT OR UPDATE OR DELETE ON profitia_forecast_dispatch.installation
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER dispatch_metadata_truncate BEFORE TRUNCATE ON profitia_forecast_dispatch.installation
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();

CREATE FUNCTION profitia_forecast_dispatch.command(p_job uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;i profitia_forecast_dispatch.installation%ROWTYPE;c profitia_forecast_requests.commands%ROWTYPE;
BEGIN
  d:=profitia_jobs.runtime_descriptor();s:=profitia_jobs.current_job(p_job);
  SELECT * INTO i FROM profitia_forecast_dispatch.installation WHERE singleton;
  IF d IS NULL OR s IS NULL OR NOT FOUND OR d->>'applicationId'<>'spendguru-forecast-dispatch'
    OR s#>>'{delegation,sourceId}'<>'sg2.forecast.queue'
    OR s#>>'{delegation,target,application,appId}'<>'spendguru'
    OR s#>>'{delegation,target,operation}'<>'forecast.request' THEN RETURN NULL;END IF;
  SELECT * INTO c FROM profitia_forecast_requests.commands WHERE request_id=p_job AND application_id='spendguru'
    AND environment=d->>'environment' AND organisation_id::text=s#>>'{delegation,organisationId}'
    AND user_id::text=s#>>'{delegation,subjectUserId}' AND payload_digest=s#>>'{delegation,payloadDigest}';
  IF NOT FOUND THEN RETURN NULL;END IF;
  -- Only the four universal domain fields and routing identifiers. The current
  -- external account is verified by the common host before admission/effect.
  RETURN jsonb_build_object('schemaVersion',i.schema_version,'boundaryDigest',i.boundary_digest,
    'jobId',p_job,'organisationId',c.organisation_id,'payload',c.command_json);
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_forecast_dispatch FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_forecast_dispatch FROM PUBLIC;
