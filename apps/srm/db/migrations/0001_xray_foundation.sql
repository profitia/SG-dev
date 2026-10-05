CREATE SCHEMA IF NOT EXISTS srm;

CREATE TABLE srm.schema_migrations (
  version text PRIMARY KEY,
  checksum_sha256 text NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE srm.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE srm.suppliers (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nip text CHECK (nip IS NULL OR nip ~ '^[0-9]{10}$'),
  krs text CHECK (krs IS NULL OR krs ~ '^[0-9]{10}$'),
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  CHECK (nip IS NOT NULL OR krs IS NOT NULL)
);
CREATE UNIQUE INDEX suppliers_nip_per_org ON srm.suppliers (organization_id, nip) WHERE nip IS NOT NULL;
CREATE UNIQUE INDEX suppliers_krs_per_org ON srm.suppliers (organization_id, krs) WHERE krs IS NOT NULL;

CREATE TABLE srm.lookup_requests (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  supplier_id uuid,
  identifier_type text NOT NULL CHECK (identifier_type IN ('NIP', 'KRS')),
  identifier text NOT NULL CHECK (identifier ~ '^[0-9]{10}$'),
  requested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  FOREIGN KEY (organization_id, supplier_id) REFERENCES srm.suppliers(organization_id, id)
);
CREATE INDEX lookup_requests_supplier_time ON srm.lookup_requests (organization_id, supplier_id, requested_at DESC);

CREATE TABLE srm.provider_attempts (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  section text NOT NULL CHECK (section IN ('general', 'financial', 'kys')),
  provider text NOT NULL CHECK (provider IN ('MGBI', 'VERCLY')),
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  status text NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'NO_DATA', 'TIMEOUT', 'ERROR')),
  correlation_id text,
  provider_record_id text,
  error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, request_id, section, attempt_no),
  FOREIGN KEY (organization_id, request_id) REFERENCES srm.lookup_requests(organization_id, id),
  CHECK ((section = 'kys' AND provider = 'VERCLY') OR (section IN ('general', 'financial') AND provider = 'MGBI')),
  CHECK ((status = 'PENDING' AND completed_at IS NULL) OR (status <> 'PENDING' AND completed_at IS NOT NULL))
);
CREATE INDEX provider_attempts_request ON srm.provider_attempts (organization_id, request_id, section);

CREATE TABLE srm.source_snapshots (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  section text NOT NULL CHECK (section IN ('general', 'financial', 'kys')),
  source_record_id text,
  payload_json jsonb,
  payload_sha256 text NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  data_class text NOT NULL CHECK (data_class IN ('COMPANY', 'FINANCIAL', 'KYS_REDACTED')),
  retrieved_at timestamptz NOT NULL,
  effective_at timestamptz,
  retention_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, attempt_id),
  FOREIGN KEY (organization_id, attempt_id) REFERENCES srm.provider_attempts(organization_id, id),
  FOREIGN KEY (organization_id, supplier_id) REFERENCES srm.suppliers(organization_id, id),
  CHECK (section <> 'kys' OR data_class = 'KYS_REDACTED')
);
CREATE INDEX source_snapshots_supplier_time ON srm.source_snapshots (organization_id, supplier_id, section, retrieved_at DESC);

CREATE TABLE srm.section_projections (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL,
  snapshot_id uuid NOT NULL,
  section text NOT NULL CHECK (section IN ('general', 'financial', 'kys')),
  projection_version integer NOT NULL CHECK (projection_version > 0),
  data_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, snapshot_id, projection_version),
  FOREIGN KEY (organization_id, supplier_id) REFERENCES srm.suppliers(organization_id, id),
  FOREIGN KEY (organization_id, snapshot_id) REFERENCES srm.source_snapshots(organization_id, id)
);
CREATE INDEX section_projections_supplier ON srm.section_projections (organization_id, supplier_id, section, created_at DESC);

CREATE TABLE srm.financial_facts (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL,
  snapshot_id uuid NOT NULL,
  metric_code text NOT NULL CHECK (metric_code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('YEAR', 'QUARTER', 'MONTH', 'OTHER')),
  statement_scope text NOT NULL CHECK (statement_scope IN ('UNIT', 'CONSOLIDATED', 'UNKNOWN')),
  amount numeric(24, 4) NOT NULL,
  currency_code text CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'),
  unit_code text NOT NULL,
  source_path text NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('VALID', 'REVIEW', 'REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, snapshot_id, metric_code, period_start, period_end, statement_scope),
  FOREIGN KEY (organization_id, supplier_id) REFERENCES srm.suppliers(organization_id, id),
  FOREIGN KEY (organization_id, snapshot_id) REFERENCES srm.source_snapshots(organization_id, id),
  CHECK (period_start <= period_end)
);
CREATE INDEX financial_facts_calculation ON srm.financial_facts (organization_id, supplier_id, metric_code, period_end DESC);

CREATE FUNCTION srm.reject_snapshot_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Source snapshots are immutable';
END;
$$;
CREATE TRIGGER immutable_source_snapshots BEFORE UPDATE ON srm.source_snapshots
  FOR EACH ROW EXECUTE FUNCTION srm.reject_snapshot_update();

ALTER TABLE srm.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON srm.organizations FOR ALL
  USING (id = nullif(current_setting('srm.organization_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('srm.organization_id', true), '')::uuid);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['suppliers', 'lookup_requests', 'provider_attempts', 'source_snapshots', 'section_projections', 'financial_facts'] LOOP
    EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_scope ON srm.%I FOR ALL USING (organization_id = nullif(current_setting(''srm.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''srm.organization_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END;
$$;
