-- Additive Source transaction fence. Only the existing native Source ledger
-- can supply a visible RESERVED effect; its deferred constraint forbids a
-- committed unfinished reservation. No second grant or budget ledger exists.
CREATE FUNCTION krs_registry.require_native_source() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE marker jsonb; descriptor jsonb; id text; effect uuid;
BEGIN
 marker:=nullif(current_setting('profitia.ingestion.scope',true),'')::jsonb;
 IF marker IS NULL OR marker->>0<>'krs.registry.catalog'
  OR marker->>1 !~ '^krs-catalog:[0-9]{10}$'
  OR profitia_ingestion.scope_allows('krs.registry.catalog',marker->>1) IS NOT TRUE THEN
  RAISE EXCEPTION 'Current native KRS Source required' USING ERRCODE='42501';END IF;
 descriptor:=profitia_ingestion.runtime_descriptor();
 SELECT e.effect_id INTO effect FROM profitia_ingestion.effects e
  WHERE e.status='RESERVED' AND e.source_id='krs.registry.catalog' AND e.resource_id=marker->>1
   AND e.application_id=descriptor->>'applicationId' AND e.environment='development'
   AND e.service_id::text=descriptor->>'serviceId';
 IF effect IS NULL THEN RAISE EXCEPTION 'Native Source reservation required' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME<>'metadata' THEN
  id:=CASE WHEN TG_OP='DELETE' THEN OLD.krs ELSE NEW.krs END;
  IF 'krs-catalog:'||id<>marker->>1 THEN RAISE EXCEPTION 'Exact KRS scope required' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_TABLE_NAME='snapshots' THEN
  IF TG_OP<>'INSERT' OR NEW.effect_ref<>effect::text THEN
   RAISE EXCEPTION 'Exact Source effect required' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION krs_registry.require_native_source() FROM PUBLIC;
ALTER FUNCTION krs_registry.require_native_source() OWNER TO profitia_ingestion_owner;
DO $triggers$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['metadata','companies','snapshots','company_sources','identifiers','names'] LOOP
  EXECUTE format('CREATE TRIGGER native_source_write BEFORE INSERT OR UPDATE OR DELETE ON krs_registry.%I FOR EACH ROW EXECUTE FUNCTION krs_registry.require_native_source()',table_name);
 END LOOP;
END $triggers$;
