-- Consumer of optional E1 SQL022. Organization owns manual locations;
-- original author/editor and all existing guarded writers remain unchanged.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM profitia_access.organisation_location_installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='88211a1c8e601fe81cb04ad73321f86135f4585e45d3f176f34507e136632e11')
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_location_admission_installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='2a22a1962ab5f9a9cd8249c5816ac71b7916338d5c4ff6cb1f6a30d038381ef8') THEN
  RAISE EXCEPTION 'Controlled owner and exact E1/SRM parent installations required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR UPDATE;
END $guard$;
CREATE TABLE srm.organisation_location_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.organisation_location_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.organisation_location_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY owner ON srm.organisation_location_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY owner_fence ON srm.organisation_location_installation AS RESTRICTIVE TO PUBLIC USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
REVOKE ALL ON srm.organisation_location_installation FROM PUBLIC;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.organisation_location_installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.organisation_location_installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE FUNCTION srm.register_organisation_location_child() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF NEW.origin<>'MANUAL' THEN RETURN NEW;END IF;
 IF NEW.location_group<>'USER_LOCATIONS' THEN RAISE EXCEPTION 'Manual group mismatch' USING ERRCODE='42501';END IF;
 INSERT INTO profitia_access.organisation_location_children(application_id,organisation_id,collection_id,location_id)
 VALUES('srm',NEW.organization_id,'supplier-locations:'||NEW.supplier_id::text,NEW.location_id)
 ON CONFLICT(application_id,organisation_id,location_id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.organisation_location_children WHERE application_id='srm'
  AND organisation_id=NEW.organization_id AND collection_id='supplier-locations:'||NEW.supplier_id::text AND location_id=NEW.location_id) THEN
  RAISE EXCEPTION 'Manual child identity conflict' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION srm.register_organisation_location_child() FROM PUBLIC;
CREATE TRIGGER register_organisation_child AFTER INSERT ON srm.supplier_locations FOR EACH ROW EXECUTE FUNCTION srm.register_organisation_location_child();
-- Backfill identity metadata only; no addresses, product data or rights are changed.
INSERT INTO profitia_access.organisation_location_children(application_id,organisation_id,collection_id,location_id)
SELECT 'srm',organization_id,'supplier-locations:'||supplier_id::text,location_id FROM srm.supplier_locations
WHERE origin='MANUAL' AND location_group='USER_LOCATIONS';
