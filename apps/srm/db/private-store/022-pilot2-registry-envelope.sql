-- Optional SRM consumer adoption. No account, human permission, Core schema,
-- existing row, catalogue, quota or other receiver is modified.
DO $owner$ BEGIN
 IF current_user<>'profitia_access_owner'
  OR (SELECT relowner FROM pg_class WHERE oid='srm.source_snapshots'::regclass)<>'profitia_access_owner'::regrole THEN
  RAISE EXCEPTION 'Controlled SRM owner required' USING ERRCODE='42501';END IF;
END $owner$;
CREATE TABLE srm.pilot2_registry_envelope_installation(
 singleton boolean PRIMARY KEY CHECK(singleton),version text NOT NULL CHECK(version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),source_ref text NOT NULL
);
ALTER TABLE srm.pilot2_registry_envelope_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.pilot2_registry_envelope_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.pilot2_registry_envelope_installation TO profitia_access_owner USING(true) WITH CHECK(true);
REVOKE ALL ON srm.pilot2_registry_envelope_installation FROM PUBLIC;
CREATE FUNCTION srm.pilot2_registry_envelope_descriptor() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $sql$
 SELECT jsonb_build_object('version',version,'schemaDigest',schema_digest)
 FROM srm.pilot2_registry_envelope_installation WHERE singleton
$sql$;
REVOKE ALL ON FUNCTION srm.pilot2_registry_envelope_descriptor() FROM PUBLIC;
ALTER TABLE srm.source_snapshots ADD COLUMN pilot2_registry_envelope jsonb;
ALTER TABLE srm.source_snapshots ADD CONSTRAINT pilot2_registry_envelope_shape CHECK(
 pilot2_registry_envelope IS NULL OR (
  section='general' AND data_class='COMPANY'
  AND jsonb_typeof(pilot2_registry_envelope)='object'
  AND pilot2_registry_envelope->'data'=payload_json
  AND pilot2_registry_envelope#>>'{source,provider}'='KRS'
  AND pilot2_registry_envelope#>>'{source,model}'='OdpisAktualny'
  AND pilot2_registry_envelope#>>'{source,recordId}'=source_record_id
  AND pilot2_registry_envelope#>>'{data,registrySource,evidenceRef}'=source_record_id
  AND pilot2_registry_envelope->>'status' IN('SUCCESS','PARTIAL')
  AND jsonb_typeof(pilot2_registry_envelope->'warnings')='array'
  AND (pilot2_registry_envelope->>'retrievedAt')::timestamptz=retrieved_at
  AND octet_length(pilot2_registry_envelope::text)<=1048576
  ) IS TRUE);
CREATE FUNCTION srm.guard_pilot2_registry_envelope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $guard$
DECLARE d jsonb;r jsonb;
BEGIN
 IF TG_OP='UPDATE' AND NEW.pilot2_registry_envelope IS DISTINCT FROM OLD.pilot2_registry_envelope THEN
  RAISE EXCEPTION 'Registry envelope is append only' USING ERRCODE='42501';END IF;
 IF NEW.pilot2_registry_envelope IS NOT NULL THEN
  d:=srm.current_supplier_work(NEW.organization_id);
  r:=profitia_services.runtime_descriptor();
  IF session_user<>'srm_pilot2_jobs' OR d IS NULL OR d->>'unitId' IS DISTINCT FROM 'SRM_STORE_GENERAL'
   OR COALESCE(r->>'deploymentId' !~ '^srv-dbeh6srrjlhs73fmikrg:[a-f0-9]{40}:srm-jobs$',true)
   OR srm.pilot2_registry_envelope_descriptor() IS NULL THEN
   RAISE EXCEPTION 'Current PILOT2 General Work required' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $guard$;
REVOKE ALL ON FUNCTION srm.guard_pilot2_registry_envelope() FROM PUBLIC;
CREATE TRIGGER pilot2_registry_envelope BEFORE INSERT OR UPDATE ON srm.source_snapshots
 FOR EACH ROW EXECUTE FUNCTION srm.guard_pilot2_registry_envelope();
-- Preserve the original receiver and all its checks; add only this named
-- technical consumer under its real common service binding and General unit.
CREATE OR REPLACE FUNCTION srm.guard_krs_general_provider() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $guard$
DECLARE d jsonb;r jsonb;receiver boolean;
BEGIN
 IF NEW.provider='KRS' THEN
  d:=srm.current_supplier_work(NEW.organization_id);
  receiver:=session_user='srm_krs_pilot_jobs';
  IF session_user='srm_pilot2_jobs' THEN
   r:=profitia_services.runtime_descriptor();
   receiver:=COALESCE(r->>'deploymentId' ~ '^srv-dbeh6srrjlhs73fmikrg:[a-f0-9]{40}:srm-jobs$',false)
    AND srm.pilot2_registry_envelope_descriptor() IS NOT NULL;
  END IF;
  IF NOT receiver OR NEW.section<>'general' OR d IS NULL OR d->>'unitId' IS DISTINCT FROM 'SRM_STORE_GENERAL'
   OR d->>'requestId' IS DISTINCT FROM NEW.request_id::text THEN
   RAISE EXCEPTION 'Current isolated pilot General work required' USING ERRCODE='42501';END IF;
  IF NEW.provider_record_id IS NOT NULL AND NEW.provider_record_id !~ '^KRS:[0-9]{10}:[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Exact KRS evidence required' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $guard$;
