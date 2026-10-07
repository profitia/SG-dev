-- Shared, provider-neutral company projections. KYS/person data is deliberately excluded.
-- Organization and user interest remains tenant-scoped and never grants direct DB access.
CREATE TABLE srm.catalog_companies (
  nip text PRIMARY KEY CHECK (nip ~ '^[0-9]{10}$'),
  general_json jsonb,
  financial_json jsonb,
  general_sha256 text CHECK (general_sha256 IS NULL OR general_sha256 ~ '^[0-9a-f]{64}$'),
  financial_sha256 text CHECK (financial_sha256 IS NULL OR financial_sha256 ~ '^[0-9a-f]{64}$'),
  general_checked_at timestamptz,
  financial_checked_at timestamptz,
  general_source_organization_id uuid,
  general_source_snapshot_id uuid,
  financial_source_organization_id uuid,
  financial_source_snapshot_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((general_json IS NULL) = (general_sha256 IS NULL)),
  CHECK ((financial_json IS NULL) = (financial_sha256 IS NULL))
);

CREATE TABLE srm.catalog_financial_facts (
  nip text NOT NULL REFERENCES srm.catalog_companies(nip),
  metric_code text NOT NULL CHECK (metric_code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  period_start date NOT NULL,
  period_end date NOT NULL,
  statement_scope text NOT NULL CHECK (statement_scope IN ('UNIT', 'CONSOLIDATED', 'UNKNOWN')),
  period_type text NOT NULL CHECK (period_type IN ('YEAR', 'QUARTER', 'MONTH', 'OTHER')),
  amount numeric(24,4) NOT NULL,
  source_amount numeric(24,4) NOT NULL,
  normalization_rule text NOT NULL,
  currency_code text,
  unit_code text NOT NULL,
  source_path text NOT NULL,
  validation_status text NOT NULL CHECK (validation_status IN ('VALID', 'REVIEW', 'REJECTED')),
  source_organization_id uuid,
  source_snapshot_id uuid,
  retrieved_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nip, metric_code, period_start, period_end, statement_scope),
  CHECK (period_start <= period_end)
);
CREATE INDEX catalog_financial_facts_period ON srm.catalog_financial_facts(nip, period_end DESC, statement_scope);

CREATE TABLE srm.users (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_key text NOT NULL CHECK (length(subject_key) BETWEEN 3 AND 200),
  identity_kind text NOT NULL CHECK (identity_kind IN ('SHARED_DEMO', 'AUTHENTICATED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, subject_key)
);
CREATE TABLE srm.organization_supplier_interest (
  organization_id uuid NOT NULL REFERENCES srm.organizations(id),
  nip text NOT NULL REFERENCES srm.catalog_companies(nip),
  first_selected_at timestamptz NOT NULL DEFAULT now(),
  last_selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, nip)
);
CREATE TABLE srm.user_supplier_interest (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  nip text NOT NULL,
  first_selected_at timestamptz NOT NULL DEFAULT now(),
  last_selected_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, nip),
  FOREIGN KEY (organization_id, user_id) REFERENCES srm.users(organization_id, id),
  FOREIGN KEY (organization_id, nip) REFERENCES srm.organization_supplier_interest(organization_id, nip)
);

-- Reuse existing normalized projections and facts without rewriting immutable snapshots.
INSERT INTO srm.catalog_companies(nip)
SELECT DISTINCT nip FROM srm.suppliers WHERE nip IS NOT NULL
ON CONFLICT (nip) DO NOTHING;

WITH latest AS (
  SELECT DISTINCT ON (supplier.nip) supplier.nip, snapshot.organization_id, snapshot.id,
    snapshot.payload_sha256, snapshot.retrieved_at,
    jsonb_build_object('status', 'SUCCESS', 'source', jsonb_build_object('provider', 'MGBI', 'model', 'pl-krs-wp-record', 'recordId', snapshot.source_record_id),
      'retrievedAt', snapshot.retrieved_at, 'effectiveAt', snapshot.effective_at, 'data', projection.data_json, 'warnings', '[]'::jsonb) AS envelope
  FROM srm.source_snapshots snapshot
  JOIN srm.suppliers supplier ON supplier.organization_id = snapshot.organization_id AND supplier.id = snapshot.supplier_id
  JOIN srm.section_projections projection ON projection.organization_id = snapshot.organization_id AND projection.snapshot_id = snapshot.id
  WHERE snapshot.section = 'general' AND supplier.nip IS NOT NULL
  ORDER BY supplier.nip, snapshot.retrieved_at DESC, snapshot.id DESC
)
UPDATE srm.catalog_companies catalog SET general_json = latest.envelope, general_sha256 = latest.payload_sha256,
  general_checked_at = latest.retrieved_at, general_source_organization_id = latest.organization_id, general_source_snapshot_id = latest.id
FROM latest WHERE catalog.nip = latest.nip;

WITH latest AS (
  SELECT DISTINCT ON (supplier.nip) supplier.nip, snapshot.organization_id, snapshot.id,
    snapshot.payload_sha256, snapshot.retrieved_at,
    jsonb_build_object('status', 'SUCCESS', 'source', jsonb_build_object('provider', 'MGBI', 'model', 'pl-krs-rdf-record', 'recordId', snapshot.source_record_id),
      'retrievedAt', snapshot.retrieved_at, 'effectiveAt', snapshot.effective_at, 'data', projection.data_json, 'warnings', '[]'::jsonb) AS envelope
  FROM srm.source_snapshots snapshot
  JOIN srm.suppliers supplier ON supplier.organization_id = snapshot.organization_id AND supplier.id = snapshot.supplier_id
  JOIN srm.section_projections projection ON projection.organization_id = snapshot.organization_id AND projection.snapshot_id = snapshot.id
  WHERE snapshot.section = 'financial' AND supplier.nip IS NOT NULL
  ORDER BY supplier.nip, snapshot.retrieved_at DESC, snapshot.id DESC
)
UPDATE srm.catalog_companies catalog SET financial_json = latest.envelope, financial_sha256 = latest.payload_sha256,
  financial_checked_at = latest.retrieved_at, financial_source_organization_id = latest.organization_id, financial_source_snapshot_id = latest.id
FROM latest WHERE catalog.nip = latest.nip;

INSERT INTO srm.catalog_financial_facts(nip, metric_code, period_start, period_end, statement_scope, period_type,
  amount, source_amount, normalization_rule, currency_code, unit_code, source_path, validation_status,
  source_organization_id, source_snapshot_id, retrieved_at)
SELECT DISTINCT ON (supplier.nip, fact.metric_code, fact.period_start, fact.period_end, fact.statement_scope)
  supplier.nip, fact.metric_code, fact.period_start, fact.period_end, fact.statement_scope, fact.period_type,
  fact.amount, coalesce(fact.source_amount, fact.amount),
  CASE WHEN fact.source_amount IS NULL THEN 'LEGACY_SOURCE_AMOUNT_UNKNOWN' ELSE fact.normalization_rule END,
  fact.currency_code, fact.unit_code, fact.source_path,
  CASE WHEN fact.source_amount IS NULL THEN 'REVIEW' ELSE fact.validation_status END,
  fact.organization_id, fact.snapshot_id, snapshot.retrieved_at
FROM srm.financial_facts fact
JOIN srm.suppliers supplier ON supplier.organization_id = fact.organization_id AND supplier.id = fact.supplier_id
JOIN srm.source_snapshots snapshot ON snapshot.organization_id = fact.organization_id AND snapshot.id = fact.snapshot_id
WHERE supplier.nip IS NOT NULL
ORDER BY supplier.nip, fact.metric_code, fact.period_start, fact.period_end, fact.statement_scope,
  snapshot.retrieved_at DESC, fact.id DESC;

INSERT INTO srm.organization_supplier_interest(organization_id, nip, first_selected_at, last_selected_at)
SELECT organization_id, nip, min(created_at), max(updated_at) FROM srm.suppliers WHERE nip IS NOT NULL
GROUP BY organization_id, nip ON CONFLICT DO NOTHING;

-- The shared demo password cannot identify a person. Link existing Development
-- selections to one clearly technical actor per organization until named login exists.
INSERT INTO srm.users(organization_id, subject_key, identity_kind)
SELECT DISTINCT organization_id, 'demo-shared', 'SHARED_DEMO'
FROM srm.organization_supplier_interest
ON CONFLICT (organization_id, subject_key) DO NOTHING;

INSERT INTO srm.user_supplier_interest(organization_id, user_id, nip, first_selected_at, last_selected_at)
SELECT interest.organization_id, demo.id, interest.nip, interest.first_selected_at, interest.last_selected_at
FROM srm.organization_supplier_interest interest
JOIN srm.users demo ON demo.organization_id = interest.organization_id AND demo.subject_key = 'demo-shared'
ON CONFLICT (organization_id, user_id, nip) DO NOTHING;

ALTER TABLE srm.catalog_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.catalog_companies FORCE ROW LEVEL SECURITY;
CREATE POLICY catalog_from_authenticated_tenant ON srm.catalog_companies FOR ALL TO srm_app_runtime
  USING (nullif(current_setting('srm.organization_id', true), '')::uuid IS NOT NULL)
  WITH CHECK (nullif(current_setting('srm.organization_id', true), '')::uuid IS NOT NULL);
ALTER TABLE srm.catalog_financial_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.catalog_financial_facts FORCE ROW LEVEL SECURITY;
CREATE POLICY catalog_facts_from_authenticated_tenant ON srm.catalog_financial_facts FOR ALL TO srm_app_runtime
  USING (nullif(current_setting('srm.organization_id', true), '')::uuid IS NOT NULL)
  WITH CHECK (nullif(current_setting('srm.organization_id', true), '')::uuid IS NOT NULL);

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['users', 'organization_supplier_interest', 'user_supplier_interest'] LOOP
    EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_scope ON srm.%I FOR ALL TO srm_app_runtime USING (organization_id = nullif(current_setting(''srm.organization_id'', true), '''')::uuid) WITH CHECK (organization_id = nullif(current_setting(''srm.organization_id'', true), '''')::uuid)', table_name);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON srm.catalog_companies, srm.catalog_financial_facts,
  srm.users, srm.organization_supplier_interest, srm.user_supplier_interest TO srm_app_runtime;
