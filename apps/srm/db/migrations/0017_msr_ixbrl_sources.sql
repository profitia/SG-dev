-- Licensed ESEF/iXBRL originals and every parsed fact remain tenant scoped.
-- REQUESTED is committed before the paid endpoint: interrupted/ambiguous calls
-- cannot be repeated by an ordinary lookup. No runtime DELETE or DDL privileges.
CREATE TABLE srm.msr_sources (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  nip text NOT NULL CHECK (nip ~ '^[0-9]{10}$'),
  record_id text NOT NULL CHECK (record_id ~ '^[a-f0-9]{24}$'),
  identity_sha256 text NOT NULL CHECK (identity_sha256 ~ '^[0-9a-f]{64}$'),
  claim_id uuid NOT NULL,
  source_request_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('REQUESTED','RECEIVED','READY','BLOCKED','DEFERRED')),
  original_bytes bytea,
  original_sha256 text,
  original_format text CHECK (original_format IN ('XHTML','XBRL')),
  original_container text CHECK (original_container IN ('ZIP','DOCUMENT')),
  parsed_json jsonb,
  parsed_sha256 text,
  mapping_version text,
  error_code text CHECK (error_code IS NULL OR error_code ~ '^MSR_[A-Z0-9_]{1,80}$'),
  requested_at timestamptz NOT NULL DEFAULT now(),
  retrieved_at timestamptz,
  PRIMARY KEY (organization_id,nip,record_id),
  FOREIGN KEY (organization_id,source_request_id) REFERENCES srm.lookup_requests(organization_id,id),
  CHECK (original_bytes IS NULL OR octet_length(original_bytes) BETWEEN 1 AND 20971520),
  CHECK ((original_bytes IS NULL AND original_sha256 IS NULL) OR
    (original_bytes IS NOT NULL AND original_sha256 IS NOT NULL AND original_sha256 = encode(sha256(original_bytes),'hex'))),
  CHECK (parsed_json IS NULL OR (parsed_sha256 IS NOT NULL AND jsonb_typeof(parsed_json)='object' AND
    parsed_sha256 = encode(sha256(convert_to(parsed_json::text,'UTF8')),'hex')
    AND parsed_json->>'sourceChecksum' = original_sha256 AND parsed_json->>'mappingVersion' = mapping_version)),
  CHECK (state <> 'READY' OR (original_bytes IS NOT NULL AND parsed_json IS NOT NULL
    AND original_format IS NOT NULL AND original_container IS NOT NULL
    AND mapping_version IS NOT NULL AND retrieved_at IS NOT NULL AND error_code IS NULL))
);
ALTER TABLE srm.msr_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.msr_sources FORCE ROW LEVEL SECURITY;
CREATE POLICY msr_sources_tenant ON srm.msr_sources FOR ALL TO srm_app_runtime
  USING (organization_id = nullif(current_setting('srm.organization_id',true),'')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('srm.organization_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON srm.msr_sources TO srm_app_runtime;

CREATE FUNCTION srm.protect_msr_original() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF (NEW.organization_id,NEW.nip,NEW.record_id,NEW.identity_sha256,NEW.claim_id,NEW.requested_at,NEW.source_request_id)
      IS DISTINCT FROM (OLD.organization_id,OLD.nip,OLD.record_id,OLD.identity_sha256,OLD.claim_id,OLD.requested_at,OLD.source_request_id)
    OR (OLD.original_bytes IS NOT NULL AND
      (NEW.original_bytes,NEW.original_sha256,NEW.original_format,NEW.original_container,NEW.retrieved_at)
      IS DISTINCT FROM (OLD.original_bytes,OLD.original_sha256,OLD.original_format,OLD.original_container,OLD.retrieved_at))
    OR (OLD.state <> 'REQUESTED' AND NEW.state = 'REQUESTED' AND NOT
      (OLD.state='DEFERRED' AND OLD.original_bytes IS NULL AND OLD.error_code IN ('MSR_FILE_BUDGET_EXHAUSTED','MSR_BUDGET_UNAVAILABLE','MSR_PROVIDER_NOT_CONFIGURED')))
    OR (OLD.state='READY' AND NEW.state<>'READY')
    OR (OLD.state='BLOCKED' AND NEW.state<>'BLOCKED')
    OR (NEW.state='DEFERRED' AND OLD.state<>'REQUESTED') THEN
    RAISE EXCEPTION 'MSR original identity is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER msr_original_immutable BEFORE UPDATE ON srm.msr_sources
FOR EACH ROW EXECUTE FUNCTION srm.protect_msr_original();
