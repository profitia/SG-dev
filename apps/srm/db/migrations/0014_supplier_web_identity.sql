-- Independent, tenant-scoped website enrichment. Does not change financial or provider snapshots.
CREATE TABLE srm.supplier_web_identity (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  nip text NOT NULL CHECK (nip ~ '^[0-9]{10}$'),
  entity_type text NOT NULL CHECK (entity_type IN ('COMPANY', 'JDG')),
  identity_hash text NOT NULL CHECK (identity_hash ~ '^[0-9a-f]{64}$'),
  result_json jsonb,
  checked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  PRIMARY KEY (organization_id, nip, entity_type),
  CHECK (result_json IS NULL OR (jsonb_typeof(result_json) = 'object' AND octet_length(result_json::text) <= 250000))
);
ALTER TABLE srm.supplier_web_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_web_identity FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON srm.supplier_web_identity FOR ALL TO srm_app_runtime
  USING (organization_id = nullif(current_setting('srm.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('srm.organization_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON srm.supplier_web_identity TO srm_app_runtime;
