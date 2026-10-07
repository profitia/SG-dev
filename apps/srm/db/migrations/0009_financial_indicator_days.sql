-- Cash-conversion cycle is measured in days. Broaden only the unit domain;
-- existing indicator rows and tenant policy remain unchanged.
ALTER TABLE srm.catalog_financial_indicators
  ADD CONSTRAINT catalog_financial_indicators_unit_v2_check
  CHECK (unit IN ('RATIO', 'PERCENT', 'PLN', 'DAYS'));
ALTER TABLE srm.catalog_financial_indicators
  DROP CONSTRAINT catalog_financial_indicators_unit_check;
ALTER TABLE srm.catalog_financial_indicators
  RENAME CONSTRAINT catalog_financial_indicators_unit_v2_check TO catalog_financial_indicators_unit_check;
