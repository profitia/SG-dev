-- COGS follows net sales - cost magnitude = gross profit in the same statement.
-- Preserve all historical/source values. No rows or previous ledger entries change.
ALTER TABLE srm.financial_facts
  DROP CONSTRAINT financial_facts_verified_cost_magnitude_check,
  ADD CONSTRAINT financial_facts_verified_cost_magnitude_check
    CHECK (normalization_rule <> 'VERIFIED_COST_MAGNITUDE_V1'
      OR ((metric_code LIKE 'PALA_OAC%'
        OR metric_code IN ('PALA_COGS', 'PALA_OOC', 'PALA_FC', 'PALA_IT'))
        AND source_amount IS NOT NULL AND amount >= 0 AND amount = abs(source_amount)));

-- Apply the same magnitude invariant to the normalized shared catalog.
ALTER TABLE srm.catalog_financial_facts
  ADD CONSTRAINT catalog_financial_facts_verified_cost_magnitude_check
    CHECK (normalization_rule <> 'VERIFIED_COST_MAGNITUDE_V1'
      OR ((metric_code LIKE 'PALA_OAC%'
        OR metric_code IN ('PALA_COGS', 'PALA_OOC', 'PALA_FC', 'PALA_IT'))
        AND source_amount IS NOT NULL AND amount >= 0 AND amount = abs(source_amount)));
