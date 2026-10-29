-- Main SRM Development: keep the statement-scoped financial guard on the
-- accepted composite Work as well as its original single-section Work.
-- No policy, ACL, role or Source history is changed. The current Work still
-- authenticates the exact tenant/request/snapshot at each statement.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(
  SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='srm.financial_statement_target()'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef
   AND md5(pg_get_functiondef(oid))='1c98b3619c7566161df6d92bf8c5aee9') THEN
  RAISE EXCEPTION 'Exact accepted financial statement guard and controlled owner required' USING ERRCODE='42501';
 END IF;
END $guard$;
CREATE OR REPLACE FUNCTION srm.financial_statement_target() RETURNS uuid[] LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE snapshot uuid;d jsonb;target uuid[];BEGIN
 snapshot:=nullif(current_setting('profitia.srm.financial.snapshot',true),'')::uuid;
 IF snapshot IS NULL THEN RETURN NULL;END IF;
 d:=srm.current_supplier_work();
 IF d IS NULL OR d->>'unitId' NOT IN('SRM_STORE_FINANCIAL','SRM_STORE_COMPANY') OR d->>'accessMode'<>'WRITE' THEN RETURN NULL;END IF;
 SELECT ARRAY[s.organization_id,s.supplier_id,s.id] INTO target FROM srm.source_snapshots s
  JOIN srm.provider_attempts a ON a.organization_id=s.organization_id AND a.id=s.attempt_id AND a.section='financial'
  JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id AND l.supplier_id=s.supplier_id
  WHERE s.id=snapshot AND s.organization_id=(d->>'organisationId')::uuid AND s.section='financial'
   AND l.id=(d->>'requestId')::uuid AND l.identifier=d->>'nip' AND l.entity_type='COMPANY';
 RETURN target;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;
