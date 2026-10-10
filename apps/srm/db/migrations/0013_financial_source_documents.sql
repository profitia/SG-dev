-- Tenant-only, person-free full XML balance sheet / profit and loss projection.
-- Raw MGBI archives and the shared dashboard catalog retain their existing boundaries.
CREATE TABLE srm.financial_source_documents (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  nip text NOT NULL CHECK (nip ~ '^[0-9]{10}$'),
  record_id text NOT NULL,
  document_json jsonb NOT NULL CHECK (jsonb_typeof(document_json) = 'object'),
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  mapping_version text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, nip, record_id)
);
ALTER TABLE srm.financial_source_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.financial_source_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY financial_source_documents_tenant ON srm.financial_source_documents FOR ALL TO srm_app_runtime
  USING (organization_id = nullif(current_setting('srm.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('srm.organization_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON srm.financial_source_documents TO srm_app_runtime;
