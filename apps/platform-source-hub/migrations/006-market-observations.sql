-- Additive producer registration only; no licence, Source or SERVICE grants.
UPDATE source_hub.api_families SET status='IMPLEMENTED' WHERE id='market-observations';
UPDATE source_hub.providers SET api_families=array_append(api_families,'market-observations') WHERE id='trading-economics' AND NOT('market-observations'=ANY(api_families));
