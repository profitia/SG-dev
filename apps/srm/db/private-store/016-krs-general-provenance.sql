-- Additive, explicit isolated Development pilot adoption. Existing MGBI,
-- CEIDG, VERCLY rows, privileges, RLS and canonical E1 guards remain unchanged.
DO $owner$ BEGIN
 IF current_user<>'profitia_access_owner'
  OR (SELECT relowner FROM pg_class WHERE oid='srm.provider_attempts'::regclass)<>'profitia_access_owner'::regrole THEN
  RAISE EXCEPTION 'Controlled SRM owner required' USING ERRCODE='42501';END IF;
END $owner$;
ALTER TABLE srm.provider_attempts
 DROP CONSTRAINT provider_attempts_provider_check,
 DROP CONSTRAINT provider_attempts_check,
 ADD CONSTRAINT provider_attempts_provider_check CHECK(provider IN('MGBI','VERCLY','CEIDG','KRS')),
 ADD CONSTRAINT provider_attempts_check CHECK(
  (section='kys' AND provider='VERCLY') OR
  (section='general' AND provider IN('MGBI','KRS')) OR
  (section='financial' AND provider='MGBI') OR
  (section='jdg' AND provider='CEIDG'));
CREATE FUNCTION srm.guard_krs_general_provider() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $guard$
DECLARE d jsonb;
BEGIN
 IF NEW.provider='KRS' THEN
  d:=srm.current_supplier_work(NEW.organization_id);
  IF session_user<>'srm_krs_pilot_jobs' OR NEW.section<>'general'
   OR d IS NULL OR d->>'unitId' IS DISTINCT FROM 'SRM_STORE_GENERAL'
   OR d->>'requestId' IS DISTINCT FROM NEW.request_id::text THEN
   RAISE EXCEPTION 'Current isolated pilot General work required' USING ERRCODE='42501';END IF;
  IF NEW.provider_record_id IS NOT NULL AND NEW.provider_record_id !~ '^KRS:[0-9]{10}:[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Exact KRS evidence required' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION srm.guard_krs_general_provider() FROM PUBLIC;
CREATE TRIGGER krs_general_provider BEFORE INSERT OR UPDATE ON srm.provider_attempts
 FOR EACH ROW EXECUTE FUNCTION srm.guard_krs_general_provider();
