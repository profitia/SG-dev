-- Shared, tenant-neutral derived values. Facts and source snapshots remain the audit authority.
CREATE TABLE srm.catalog_financial_indicators (
  nip text NOT NULL REFERENCES srm.catalog_companies(nip),
  indicator_code text NOT NULL CHECK (indicator_code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  period_start date NOT NULL,
  period_end date NOT NULL,
  statement_scope text NOT NULL CHECK (statement_scope IN ('UNIT', 'CONSOLIDATED')),
  formula_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('AVAILABLE', 'UNAVAILABLE')),
  value numeric(30,6),
  unit text NOT NULL CHECK (unit IN ('RATIO', 'PERCENT', 'PLN')),
  importance smallint NOT NULL CHECK (importance BETWEEN 1 AND 3),
  reason_code text,
  input_facts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(input_facts) = 'array'),
  source_snapshot_ids uuid[] NOT NULL DEFAULT '{}',
  source_document_ids text[] NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nip, indicator_code, period_start, period_end, statement_scope, formula_version),
  CHECK (period_start <= period_end),
  CHECK ((status = 'AVAILABLE' AND value IS NOT NULL AND reason_code IS NULL)
    OR (status = 'UNAVAILABLE' AND value IS NULL AND reason_code IS NOT NULL))
);
CREATE INDEX catalog_financial_indicators_latest ON srm.catalog_financial_indicators(nip, period_end DESC, statement_scope);
ALTER TABLE srm.catalog_financial_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.catalog_financial_indicators FORCE ROW LEVEL SECURITY;
CREATE POLICY catalog_indicators_from_authenticated_tenant ON srm.catalog_financial_indicators FOR ALL TO srm_app_runtime
  USING (nullif(current_setting('srm.organization_id', true), '')::uuid IS NOT NULL)
  WITH CHECK (nullif(current_setting('srm.organization_id', true), '')::uuid IS NOT NULL);
GRANT SELECT, INSERT, UPDATE ON srm.catalog_financial_indicators TO srm_app_runtime;
