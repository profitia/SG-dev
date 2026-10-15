-- Additive rollback: previous runtime ignores this table. Original paid receipts
-- and historical projections remain unchanged; never reverse source migrations.
CREATE TABLE srm.msr_projections (
  organization_id uuid NOT NULL,
  nip text NOT NULL,
  record_id text NOT NULL,
  projection_version text NOT NULL,
  original_sha256 text NOT NULL CHECK (original_sha256 ~ '^[0-9a-f]{64}$'),
  projection_json jsonb NOT NULL,
  projection_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,nip,record_id,projection_version),
  FOREIGN KEY (organization_id,nip,record_id) REFERENCES srm.msr_sources(organization_id,nip,record_id),
  CHECK (projection_sha256 = encode(sha256(convert_to(projection_json::text,'UTF8')),'hex')),
  CHECK (projection_json#>>'{document,checksum}' IS NOT NULL AND projection_json#>>'{document,checksum}' = original_sha256),
  CHECK (projection_json#>>'{document,mappingVersion}' IS NOT NULL AND projection_json#>>'{document,mappingVersion}' = projection_version)
);
ALTER TABLE srm.msr_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.msr_projections FORCE ROW LEVEL SECURITY;
CREATE POLICY msr_projections_tenant ON srm.msr_projections FOR ALL TO srm_app_runtime
  USING (organization_id = nullif(current_setting('srm.organization_id',true),'')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('srm.organization_id',true),'')::uuid);
GRANT SELECT,INSERT ON srm.msr_projections TO srm_app_runtime;
CREATE FUNCTION srm.protect_msr_projection() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'MSR projection is immutable' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM srm.msr_sources s WHERE s.organization_id=NEW.organization_id
    AND s.nip=NEW.nip AND s.record_id=NEW.record_id AND s.original_sha256=NEW.original_sha256) THEN
    RAISE EXCEPTION 'MSR projection original mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER msr_projection_immutable BEFORE INSERT OR UPDATE OR DELETE ON srm.msr_projections
FOR EACH ROW EXECUTE FUNCTION srm.protect_msr_projection();
