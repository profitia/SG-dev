-- Additive provider catalogue only. No E1, Source, licence, role or budget grants.
-- The accepted 001 bytes and installation digest remain immutable.
UPDATE source_hub.providers
SET api_families=ARRAY['news-discovery','economic-calendar','indicators','external-forecasts']
WHERE id='trading-economics';
-- The indicator-forecast licence never silently grants a different paid API.
ALTER TABLE source_hub.provider_licences ADD COLUMN allow_market_forecasts boolean NOT NULL DEFAULT false;
ALTER TABLE source_hub.provider_licences ADD CONSTRAINT market_forecasts_scope
CHECK(NOT allow_market_forecasts OR provider_id='trading-economics' AND family='external-forecasts');
