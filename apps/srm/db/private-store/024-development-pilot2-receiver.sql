-- Optional main Development receiver for the already installed PILOT2 General
-- envelope. Existing receivers, row ownership, Work, audit and quotas stay intact.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner'
  OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development'
   AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database())
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='srm.guard_krs_general_provider()'::regprocedure)<>'00e9ebc7383120e678db9d38465d0cf8'
  OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='srm.guard_pilot2_registry_envelope()'::regprocedure)<>'31e54444096eb6bb4dbb1f7bbc72f8a0'
  OR NOT EXISTS(SELECT 1 FROM profitia_services.runtime_bindings WHERE login_role='srm_private_development_jobs'
   AND service_id='47049035-a163-51cc-9ba5-3b455669d864' AND status='ACTIVE'
   AND deployment_id ~ '^srv-db1vu6gm7kps73d0e3r0:[a-f0-9]{40}:srm-jobs$')
 THEN RAISE EXCEPTION 'Exact existing main Development receiver and PILOT2 guards required';END IF;
END $guard$;
CREATE OR REPLACE FUNCTION srm.guard_pilot2_registry_envelope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $guard$
DECLARE d jsonb;r jsonb;receiver boolean;
BEGIN
 IF TG_OP='UPDATE' AND NEW.pilot2_registry_envelope IS DISTINCT FROM OLD.pilot2_registry_envelope THEN
  RAISE EXCEPTION 'Registry envelope is append only' USING ERRCODE='42501';END IF;
 IF NEW.pilot2_registry_envelope IS NOT NULL THEN
  d:=srm.current_supplier_work(NEW.organization_id);r:=profitia_services.runtime_descriptor();
  receiver:=(session_user='srm_pilot2_jobs'
    AND COALESCE(r->>'deploymentId' ~ '^srv-dbeh6srrjlhs73fmikrg:[a-f0-9]{40}:srm-jobs$',false))
   OR (session_user='srm_private_development_jobs'
    AND r->>'serviceId'='47049035-a163-51cc-9ba5-3b455669d864'
    AND COALESCE(r->>'deploymentId' ~ '^srv-db1vu6gm7kps73d0e3r0:[a-f0-9]{40}:srm-jobs$',false));
  IF receiver IS NOT TRUE OR d IS NULL OR d->>'unitId' IS DISTINCT FROM 'SRM_STORE_GENERAL'
   OR srm.pilot2_registry_envelope_descriptor() IS NULL THEN
   RAISE EXCEPTION 'Current accepted General Work required' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $guard$;
CREATE OR REPLACE FUNCTION srm.guard_krs_general_provider() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $guard$
DECLARE d jsonb;r jsonb;receiver boolean;
BEGIN
 IF NEW.provider='KRS' THEN
  d:=srm.current_supplier_work(NEW.organization_id);receiver:=session_user='srm_krs_pilot_jobs';
  IF session_user IN('srm_pilot2_jobs','srm_private_development_jobs') THEN
   r:=profitia_services.runtime_descriptor();
   receiver:=((session_user='srm_pilot2_jobs'
    AND COALESCE(r->>'deploymentId' ~ '^srv-dbeh6srrjlhs73fmikrg:[a-f0-9]{40}:srm-jobs$',false))
    OR (session_user='srm_private_development_jobs'
     AND r->>'serviceId'='47049035-a163-51cc-9ba5-3b455669d864'
     AND COALESCE(r->>'deploymentId' ~ '^srv-db1vu6gm7kps73d0e3r0:[a-f0-9]{40}:srm-jobs$',false)))
    AND srm.pilot2_registry_envelope_descriptor() IS NOT NULL;
  END IF;
  IF receiver IS NOT TRUE OR NEW.section<>'general' OR d IS NULL OR d->>'unitId' IS DISTINCT FROM 'SRM_STORE_GENERAL'
   OR d->>'requestId' IS DISTINCT FROM NEW.request_id::text THEN
   RAISE EXCEPTION 'Current accepted General work required' USING ERRCODE='42501';END IF;
  IF NEW.provider_record_id IS NOT NULL AND NEW.provider_record_id !~ '^KRS:[0-9]{10}:[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Exact KRS evidence required' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $guard$;
GRANT EXECUTE ON FUNCTION srm.pilot2_registry_envelope_descriptor() TO srm_private_development_jobs;
