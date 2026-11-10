-- Candidate only. Apply through an explicitly approved Development installer.
BEGIN;
CREATE SCHEMA IF NOT EXISTS insights_private;
CREATE TABLE IF NOT EXISTS insights_private.report_jobs (
 id uuid PRIMARY KEY, organisation_id text NOT NULL, business_key char(64) NOT NULL,
 definition_id text NOT NULL, period_start date NOT NULL, period_end date NOT NULL, revision integer NOT NULL CHECK(revision>0),
 version bigint NOT NULL DEFAULT 0, lease_token uuid, lease_until timestamptz,
 status text NOT NULL, document jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id,organisation_id), UNIQUE (organisation_id,business_key), UNIQUE(organisation_id,definition_id,period_start,period_end,revision),
 CHECK(document->>'id'=id::text), CHECK(document->>'organisationId'=organisation_id),
 CHECK(document->>'status'=status), CHECK(period_end=period_start+6), CHECK(extract(isodow from period_start)=2)
);
CREATE TABLE IF NOT EXISTS insights_private.report_artifacts (
 job_id uuid NOT NULL,organisation_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('pdf','markdown','appendix')),sha256 char(64) NOT NULL,bytes bytea NOT NULL,
 PRIMARY KEY(job_id,kind), FOREIGN KEY(job_id,organisation_id) REFERENCES insights_private.report_jobs(id,organisation_id), CHECK(octet_length(bytes)<=20971520)
);
ALTER TABLE insights_private.report_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights_private.report_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE insights_private.report_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights_private.report_artifacts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_jobs ON insights_private.report_jobs USING (organisation_id=current_setting('insights.organisation_id',true)) WITH CHECK(organisation_id=current_setting('insights.organisation_id',true));
CREATE POLICY tenant_artifacts ON insights_private.report_artifacts USING (organisation_id=current_setting('insights.organisation_id',true)) WITH CHECK(organisation_id=current_setting('insights.organisation_id',true));
REVOKE ALL ON SCHEMA insights_private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA insights_private FROM PUBLIC;
-- Grant only schema USAGE; jobs SELECT/INSERT/UPDATE, artifacts SELECT/INSERT to the separately
-- approved non-owner runtime role. No role creation, membership or E1 grants here.
COMMIT;
