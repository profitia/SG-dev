-- Immutable tenant-owned financial reference frames. No person data or provider payloads.
CREATE TABLE srm.financial_scanner_frames (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  nip text NOT NULL CHECK (nip ~ '^[0-9]{10}$'),
  frame_id text NOT NULL CHECK (frame_id ~ '^[0-9a-f]{64}$'),
  frame_json jsonb NOT NULL CHECK (jsonb_typeof(frame_json) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,nip,frame_id)
);
ALTER TABLE srm.financial_scanner_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.financial_scanner_frames FORCE ROW LEVEL SECURITY;
CREATE POLICY financial_scanner_frames_tenant ON srm.financial_scanner_frames FOR ALL TO srm_app_runtime
  USING (organization_id = nullif(current_setting('srm.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('srm.organization_id', true), '')::uuid);
-- Runtime may read/append; no UPDATE/DELETE permission, even for its own frames.
GRANT SELECT, INSERT ON srm.financial_scanner_frames TO srm_app_runtime;
