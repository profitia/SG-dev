-- Additive, owner-installed extension. Installs no live admission or grant.
DO $guard$ BEGIN
 IF current_user<>'source_hub_development_owner'
 OR to_regprocedure('source_hub.current_first_party_licence(text,text)') IS NULL
 THEN RAISE EXCEPTION 'Accepted SourceHub owner and first-party predecessor required'; END IF;
END $guard$;
ALTER TABLE source_hub.provider_licences
 DROP CONSTRAINT provider_licences_provider_id_check,
 DROP CONSTRAINT provider_licences_family_check,
 ADD CONSTRAINT provider_licences_provider_id_check CHECK(provider_id IN('newsapi','brave','trading-economics','eia','cftc','commodities-sh')),
 ADD CONSTRAINT provider_licences_family_check CHECK(family IN('news-discovery','economic-calendar','indicators','external-forecasts','market-observations','data-catalog','series-observations','positioning-observations','publication-calendar')),
 ADD CONSTRAINT commodity_provider_family CHECK(
 provider_id NOT IN('eia','cftc','commodities-sh')
 OR provider_id='eia' AND family IN('data-catalog','series-observations')
 OR provider_id='cftc' AND family IN('data-catalog','positioning-observations')
 OR provider_id='commodities-sh' AND family IN('data-catalog','publication-calendar')),
 ADD COLUMN allow_catalog_inventory boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT catalogue_metadata_storage_only CHECK(NOT allow_catalog_inventory OR family='data-catalog' AND provider_id IN('eia','cftc','commodities-sh') AND consumer_access_mode='SPENDGURU_PRODUCT');
INSERT INTO source_hub.api_families(id,status) VALUES
 ('data-catalog','IMPLEMENTED'),('series-observations','IMPLEMENTED'),('positioning-observations','IMPLEMENTED'),('publication-calendar','IMPLEMENTED');
INSERT INTO source_hub.providers(id,api_families,contract_version) VALUES
 ('eia',ARRAY['data-catalog','series-observations'],'1.1.0'),
 ('cftc',ARRAY['data-catalog','positioning-observations'],'1.1.0'),
 ('commodities-sh',ARRAY['data-catalog','publication-calendar'],'1.1.0');
-- Historical acquisitions, counters, licences and consumer storage modes stay
-- byte-for-byte untouched. New metadata retention needs its own owner decision.
