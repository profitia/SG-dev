-- Scoped recipient retention; no modification to global provider/cache policy.
DO $guard$ BEGIN
 IF current_user<>'source_hub_development_owner' OR to_regclass('source_hub.calendar_consumer_storage') IS NULL
 THEN RAISE EXCEPTION 'SourceHub owner and accepted008 required'; END IF;
END $guard$;
CREATE TABLE source_hub.result_consumer_storage(
 consumer_application_id text NOT NULL CHECK(consumer_application_id='profitia-economic-calendar-runtime-development'),
 provider_id text NOT NULL CHECK(provider_id='eia'),family text NOT NULL CHECK(family='series-observations'),
 dataset_id text NOT NULL CHECK(dataset_id='petroleum/stoc/wstk'),series_ids text[] NOT NULL CHECK(cardinality(series_ids)>0 AND series_ids<@ARRAY['WCESTUS1','WGTSTUS1']),
 fields text[] NOT NULL CHECK(fields=ARRAY['value']),frequency text NOT NULL CHECK(frequency='weekly'),geography text NOT NULL CHECK(geography='NUS'),
 version bigint NOT NULL CHECK(version>0),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),basis_ref text NOT NULL CHECK(length(basis_ref) BETWEEN 1 AND 256),
 retention_mode text NOT NULL CHECK(retention_mode='DURABLE_NO_FIXED_EXPIRY'),redistribution text NOT NULL CHECK(redistribution='PRIVATE_AUTHORISED_CONSUMER_ONLY'),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(consumer_application_id,provider_id,family,dataset_id)
);
CREATE TABLE source_hub.result_consumer_storage_history(LIKE source_hub.result_consumer_storage INCLUDING CONSTRAINTS);
ALTER TABLE source_hub.result_consumer_storage_history ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT clock_timestamp();
DO $policies$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['result_consumer_storage','result_consumer_storage_history'] LOOP
 EXECUTE format('ALTER TABLE source_hub.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE source_hub.%I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY schema_owner ON source_hub.%I TO source_hub_development_owner USING(true) WITH CHECK(true)',t);
 END LOOP;
END $policies$;
CREATE POLICY runtime_metadata ON source_hub.result_consumer_storage FOR SELECT TO source_hub_development_runtime USING(true);
GRANT SELECT ON source_hub.result_consumer_storage TO source_hub_development_runtime;
-- Every actual owner update is retained; runtimes have SELECT only.
CREATE FUNCTION source_hub.record_result_storage_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF TG_OP='UPDATE' AND NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Result rights version must advance'; END IF;
 INSERT INTO source_hub.result_consumer_storage_history SELECT NEW.*,clock_timestamp();RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION source_hub.record_result_storage_change() FROM PUBLIC;
CREATE TRIGGER result_storage_history AFTER INSERT OR UPDATE ON source_hub.result_consumer_storage FOR EACH ROW EXECUTE FUNCTION source_hub.record_result_storage_change();
