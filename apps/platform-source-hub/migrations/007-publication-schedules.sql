-- Additive schema capability only. No live source, grant, licence or retention.
DO $guard$ BEGIN
 IF current_user<>'source_hub_development_owner'
 OR NOT EXISTS(SELECT 1 FROM source_hub.migrations WHERE version='006-commodity-providers')
 THEN RAISE EXCEPTION 'ACCEPTED_COMMODITY_PREDECESSOR_REQUIRED'; END IF;
END $guard$;
ALTER TABLE source_hub.provider_licences DROP CONSTRAINT commodity_provider_family,
 ADD CONSTRAINT commodity_provider_family CHECK(
 provider_id NOT IN('eia','cftc','commodities-sh')
 OR provider_id='eia' AND family IN('data-catalog','series-observations','publication-calendar')
 OR provider_id='cftc' AND family IN('data-catalog','positioning-observations')
 OR provider_id='commodities-sh' AND family IN('data-catalog','publication-calendar'));
UPDATE source_hub.providers SET api_families=array_append(api_families,'publication-calendar')
WHERE id='eia' AND NOT 'publication-calendar'=ANY(api_families);
-- Existing provider versions, licences, ledgers and policy counters are intact.
