-- Full provider responses are kept separately from the person-free shared catalog.
-- They can contain personal data and are never exposed through the X-Ray API.
CREATE TABLE srm.mgbi_source_archives (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  nip text NOT NULL CHECK (nip ~ '^[0-9]{10}$'),
  model text NOT NULL CHECK (model IN ('pl-krs-wp-record', 'pl-krs-rdf-record')),
  payload_json jsonb NOT NULL,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  record_count integer NOT NULL CHECK (record_count >= 0),
  first_retrieved_at timestamptz NOT NULL,
  last_checked_at timestamptz NOT NULL,
  source_request_id uuid NOT NULL,
  PRIMARY KEY (organization_id, nip, model),
  FOREIGN KEY (organization_id, source_request_id) REFERENCES srm.lookup_requests(organization_id, id),
  CHECK (first_retrieved_at <= last_checked_at)
);

ALTER TABLE srm.mgbi_source_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.mgbi_source_archives FORCE ROW LEVEL SECURITY;
CREATE POLICY mgbi_source_archives_tenant ON srm.mgbi_source_archives FOR ALL TO srm_app_runtime
  USING (organization_id = nullif(current_setting('srm.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('srm.organization_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON srm.mgbi_source_archives TO srm_app_runtime;
