-- Widen the verified magnitude invariant to other operating costs, financial
-- costs and income tax. Existing rows and raw source amounts remain unchanged.
ALTER TABLE srm.financial_facts
  DROP CONSTRAINT financial_facts_verified_cost_magnitude_check,
  ADD CONSTRAINT financial_facts_verified_cost_magnitude_check
    CHECK (normalization_rule <> 'VERIFIED_COST_MAGNITUDE_V1'
      OR ((metric_code LIKE 'PALA_OAC%'
        OR metric_code IN ('PALA_OOC', 'PALA_FC', 'PALA_IT'))
        AND amount >= 0 AND source_amount IS NOT NULL));
