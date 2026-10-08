-- Shared normalized KYS projection. Raw provider responses are never stored here.
-- This table includes personal data, so runtime access requires an organization context.
CREATE TABLE srm.catalog_kys_reports (
  nip text NOT NULL CHECK (nip ~ '^[0-9]{10}$'),
  entity_type text NOT NULL CHECK (entity_type IN ('COMPANY', 'JDG')),
  report_json jsonb,
  report_sha256 text CHECK (report_sha256 IS NULL OR report_sha256 ~ '^[0-9a-f]{64}$'),
  retrieved_at timestamptz,
  retention_until timestamptz,
  source_organization_id uuid,
  source_snapshot_id uuid,
  lease_owner uuid,
  lease_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nip, entity_type),
  CHECK ((report_json IS NULL) = (report_sha256 IS NULL)),
  CHECK (report_json IS NULL OR (retrieved_at IS NOT NULL AND retention_until IS NOT NULL
    AND retention_until > retrieved_at AND retention_until <= retrieved_at + interval '7 days')),
  CHECK ((lease_owner IS NULL) = (lease_until IS NULL))
);
CREATE INDEX catalog_kys_reports_expiry ON srm.catalog_kys_reports(retention_until);
ALTER TABLE srm.catalog_kys_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.catalog_kys_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY catalog_kys_from_authenticated_tenant ON srm.catalog_kys_reports FOR ALL TO srm_app_runtime
  USING (nullif(current_setting('srm.organization_id', true), '')::uuid IS NOT NULL)
  WITH CHECK (nullif(current_setting('srm.organization_id', true), '')::uuid IS NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON srm.catalog_kys_reports TO srm_app_runtime;

-- A cached result is recorded as an attempt, but must not imply a new provider call.
ALTER TABLE srm.provider_attempts ADD COLUMN retrieval_method text NOT NULL DEFAULT 'PROVIDER'
  CHECK (retrieval_method IN ('PROVIDER', 'CACHE'));
