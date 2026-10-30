-- Main SRM Development only: archive, prepare and persist an already fetched
-- structured company in the existing atomic STORE_COMPANY Work. All original
-- tenant/request/NIP checks run before this purpose composition. No policy,
-- ACL, account grant, provider quota or Source receipt is changed.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(
  SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef
   AND md5(pg_get_functiondef(oid))='bd907d29ceeb7ce63489485941f1e203')
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='srm.ready_company_work_descriptor()'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef
   AND md5(pg_get_functiondef(oid))='2848428db3c8491a975c241fb3b86873') THEN
  RAISE EXCEPTION 'Exact accepted FRESH functions and controlled owner required' USING ERRCODE='42501';
 END IF;
END $guard$;
DO $compose$ DECLARE body text;definition text;target text;BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc
  WHERE oid='srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure;
 target:='IF p_table IN(''catalog_companies'',''catalog_financial_facts'',''catalog_financial_indicators'') THEN';
 IF position(target in body)=0 OR position('u<>''SRM_PREPARE_DOCUMENTS''' in body)=0 THEN RAISE EXCEPTION 'Exact postfetch composition target required';END IF;
 body:=replace(body,'u<>''SRM_PREPARE_DOCUMENTS''','(u<>''SRM_PREPARE_DOCUMENTS'' AND NOT(u=''SRM_STORE_COMPANY'' AND srm.ready_company_work_descriptor()->>''freshPostfetchVersion''=''1.0.0''))');
 body:=replace(body,target,$replacement$
 IF u='SRM_STORE_COMPANY' AND srm.ready_company_work_descriptor()->>'freshPostfetchVersion'='1.0.0' THEN
  IF p_table='mgbi_source_archives' THEN
   RETURN p_nip=d->>'nip' AND p_section IN('general','financial');
  ELSIF p_table='financial_source_documents' THEN
   RETURN p_nip=d->>'nip';
  ELSIF p_table IN('msr_sources','msr_projections') THEN
   RETURN NOT writing AND p_nip=d->>'nip';
  END IF;
 END IF;
 IF p_table IN('catalog_companies','catalog_financial_facts','catalog_financial_indicators') THEN$replacement$);
 EXECUTE replace(definition,(SELECT prosrc FROM pg_proc WHERE oid='srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure),body);
END $compose$;
CREATE OR REPLACE FUNCTION srm.ready_company_work_descriptor() RETURNS jsonb LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.ready_company_work_installation%ROWTYPE;BEGIN
 d:=profitia_services.runtime_descriptor();IF d IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.ready_company_work_installation WHERE singleton AND runtime_role=session_user;
 IF NOT FOUND OR d->>'serviceId' IS DISTINCT FROM i.service_id::text THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('schemaDigest',i.schema_digest,'freshLookupVersion','1.0.0','freshPostfetchVersion','1.0.0');
END $fn$;
