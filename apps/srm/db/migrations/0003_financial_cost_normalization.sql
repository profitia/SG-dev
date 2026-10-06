-- Preserve historical facts exactly as written. New facts carry both the provider value
-- and the display/calculation value; only mathematically verified costs use magnitude.
ALTER TABLE srm.financial_facts
  ADD COLUMN source_amount numeric(24, 4),
  ADD COLUMN normalization_rule text NOT NULL DEFAULT 'LEGACY_SOURCE_SIGNED'
    CHECK (normalization_rule IN ('LEGACY_SOURCE_SIGNED', 'SOURCE_VALUE',
      'VERIFIED_COST_MAGNITUDE_V1', 'UNVERIFIED_COST_SIGN')),
  ADD CONSTRAINT financial_facts_verified_cost_magnitude_check
    CHECK (normalization_rule <> 'VERIFIED_COST_MAGNITUDE_V1'
      OR (metric_code LIKE 'PALA_OAC%' AND amount >= 0 AND source_amount IS NOT NULL));
