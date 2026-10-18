-- Bounded discovery over the EXISTING canonical dispatch table. A hint grants
-- no execution right; the shared host rechecks authority and the external user.
DO $guard$ BEGIN
  IF current_user<>'profitia_access_owner'
    OR NOT EXISTS(SELECT 1 FROM profitia_forecast_dispatch.installation WHERE singleton
      AND schema_version='1.0.0' AND boundary_digest='4d506720351bf0f2bf1b12ef5e634acde894a98c58b64b41881ff59e13a3ae5c') THEN
    RAISE EXCEPTION 'Accepted private dispatch boundary required' USING ERRCODE='42501'; END IF;
END $guard$;
CREATE TABLE profitia_forecast_dispatch.discovery_installation(
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
ALTER TABLE profitia_forecast_dispatch.discovery_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_forecast_dispatch.discovery_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_forecast_dispatch.discovery_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY metadata_fence ON profitia_forecast_dispatch.discovery_installation AS RESTRICTIVE TO PUBLIC
  USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER discovery_metadata_revision BEFORE INSERT OR UPDATE OR DELETE ON profitia_forecast_dispatch.discovery_installation
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER discovery_metadata_truncate BEFORE TRUNCATE ON profitia_forecast_dispatch.discovery_installation
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
REVOKE ALL ON profitia_forecast_dispatch.discovery_installation FROM PUBLIC;

CREATE FUNCTION profitia_forecast_dispatch.pending(p_after uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; s jsonb; i profitia_forecast_dispatch.discovery_installation%ROWTYPE; ids jsonb;
BEGIN
  d:=profitia_jobs.runtime_descriptor(); s:=profitia_services.runtime_descriptor();
  SELECT * INTO i FROM profitia_forecast_dispatch.discovery_installation WHERE singleton;
  IF d IS NULL OR s IS NULL OR NOT FOUND OR i.expires_at<=clock_timestamp()
    OR d->>'applicationId'<>'spendguru-forecast-dispatch' OR d->>'fixedOrganisationId' IS NOT NULL
    OR s->>'profileId'<>'PLATFORM_INTERNAL'
    OR NOT EXISTS(SELECT 1 FROM profitia_forecast_dispatch.installation WHERE singleton AND schema_version='1.0.0'
      AND boundary_digest='4d506720351bf0f2bf1b12ef5e634acde894a98c58b64b41881ff59e13a3ae5c')
    OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='profitia_forecast_dispatch' AND c.relname='discovery_installation' AND c.relkind='r'
        AND c.relowner='profitia_access_owner'::regrole AND c.relrowsecurity AND c.relforcerowsecurity) THEN RETURN NULL; END IF;
  -- A bounded round-robin cursor contains only a job UUID, never cached rights.
  -- Denied external accounts cannot starve later rows on the next iteration.
  SELECT coalesce(jsonb_agg(v.job_id ORDER BY v.wrap,v.job_id),'[]'::jsonb) INTO ids FROM (
    SELECT j.job_id,CASE WHEN p_after IS NULL OR j.job_id>p_after THEN 0 ELSE 1 END AS wrap
    FROM profitia_jobs.dispatches j
    JOIN profitia_jobs.delegations g ON g.delegation_id=j.delegation_id
    JOIN profitia_jobs.operation_bindings b ON b.binding_id=g.binding_id
    WHERE j.status IN('PENDING','READY','UNCERTAIN') AND j.source_id='sg2.forecast.queue'
      AND g.application_id='spendguru' AND g.operation='forecast.request'
      AND b.executor_application_id=d->>'applicationId'
      AND j.attempt_count<b.max_attempts
      AND (j.lease_expires_at IS NULL OR j.lease_expires_at<=clock_timestamp())
      AND profitia_jobs.current_job(j.job_id) IS NOT NULL
    ORDER BY wrap,j.job_id LIMIT 8
  ) v;
  RETURN jsonb_build_object('schemaVersion',i.schema_version,'boundaryDigest',i.boundary_digest,
    'environment',d->>'environment','projectId',d->>'projectId','branchId',d->>'branchId',
    'databaseName',d->>'databaseName','role',d->>'role','jobSchemaDigest',d->>'jobSchemaDigest',
    'deploymentId',s->>'deploymentId','configurationVersion',s->>'configurationVersion','jobIds',ids);
END $fn$;
REVOKE ALL ON FUNCTION profitia_forecast_dispatch.pending(uuid) FROM PUBLIC;
