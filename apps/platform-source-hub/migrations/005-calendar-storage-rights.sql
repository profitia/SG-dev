-- Storage permission is distinct from the existing transient Hub cache TTL.
-- Installation grants no new licence, consumer, retention right or Source quota.
DO $guard$ BEGIN
 IF current_user<>'source_hub_development_owner'
 OR to_regprocedure('source_hub.current_first_party_licence(text,text)') IS NULL
 THEN RAISE EXCEPTION 'Accepted SourceHub owner and universal-consumer predecessor required'; END IF;
END $guard$;
ALTER TABLE source_hub.provider_licences
 ADD COLUMN consumer_storage_mode text NOT NULL DEFAULT 'TRANSIENT_ONLY'
 CHECK(consumer_storage_mode IN('TRANSIENT_ONLY','DURABLE_OWNER_ENTITLEMENT')),
 ADD COLUMN consumer_storage_basis_ref text,
 ADD CONSTRAINT calendar_durable_storage_basis CHECK(
   consumer_storage_mode='TRANSIENT_ONLY' AND consumer_storage_basis_ref IS NULL
   OR provider_id='trading-economics' AND family='economic-calendar' AND consumer_access_mode='SPENDGURU_PRODUCT'
   AND consumer_storage_mode='DURABLE_OWNER_ENTITLEMENT' AND consumer_storage_basis_ref IS NOT NULL AND length(consumer_storage_basis_ref) BETWEEN 1 AND 256
 );
-- Existing owner transaction / expected-version guard. This is never granted to
-- the ordinary Hub runtime or any consumer and performs no source/identity grant.
CREATE FUNCTION source_hub.set_calendar_storage_rights(expected_version bigint,mode text,basis_ref text)
RETURNS bigint LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE next_version bigint;
BEGIN
 IF current_user<>'source_hub_development_owner' OR mode IS NULL OR mode NOT IN('TRANSIENT_ONLY','DURABLE_OWNER_ENTITLEMENT')
 OR mode='DURABLE_OWNER_ENTITLEMENT' AND (basis_ref IS NULL OR length(basis_ref) NOT BETWEEN 1 AND 256)
 OR mode='TRANSIENT_ONLY' AND basis_ref IS NOT NULL THEN RAISE EXCEPTION 'Explicit calendar licence owner decision required'; END IF;
 UPDATE source_hub.provider_licences SET consumer_storage_mode=mode,consumer_storage_basis_ref=basis_ref
 WHERE provider_id='trading-economics' AND family='economic-calendar' AND version=expected_version
 AND status='ACTIVE' AND expires_at>clock_timestamp() AND private_consumer_use
 AND consumer_access_mode='SPENDGURU_PRODUCT' RETURNING version INTO next_version;
 IF next_version IS NULL THEN RAISE EXCEPTION 'Calendar licence unavailable or expected version changed'; END IF;
 RETURN next_version;
END $fn$;
REVOKE ALL ON FUNCTION source_hub.set_calendar_storage_rights(bigint,text,text) FROM PUBLIC;
