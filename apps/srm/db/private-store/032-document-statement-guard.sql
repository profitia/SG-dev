-- Optional, main SRM Development only. Ordinary row ownership/NIP predicates
-- remain per row; the SAME full native Work check is evaluated once per SQL
-- statement for the accepted main STORE_COMPANY context. No cross-statement
-- authorization cache, role, ACL, trigger or source-history change.
-- Cloud activation requires separate explicit owner approval and exact backup.
DO $document_statement$ DECLARE p record; q text; w text; old_call text; replacement text; action text; changed integer:=0; BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(
  SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.financial_source_documents'::regclass
   AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef AND md5(pg_get_functiondef(oid))='dcdb56ade81f04e67a1faa6768be8c42')
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='srm.ready_company_work_descriptor()'::regprocedure
   AND proowner='profitia_access_owner'::regrole AND prosecdef AND md5(pg_get_functiondef(oid))='eac5fa80b59a0df3fd45f15920123020') THEN
  RAISE EXCEPTION 'Exact accepted main document guard and controlled owner required' USING ERRCODE='42501';END IF;
 FOR p IN SELECT d.*,e.expected_command,e.expected_digest FROM pg_policies d
  JOIN (VALUES ('inspected_update_fence','UPDATE','51fca1de956013b5107d32de1402531b'),('native_work_insert','INSERT','92fb28e6331451d818ad78ea06322608'),('native_work_read','SELECT','1faf79bc6c357a1fe771d99a9e44a42f'),('native_work_update','UPDATE','64b39d57e9f5b6c45bed4aee970b3734'),('private_operation_fence','ALL','6a7df79b54c1d0ffe9d095f949d96d83'))e(name,expected_command,expected_digest) ON d.policyname=e.name
  WHERE d.schemaname='srm' AND d.tablename='financial_source_documents' ORDER BY d.policyname LOOP
  IF p.cmd<>p.expected_command OR md5(coalesce(p.qual,'')||E'\n'||coalesce(p.with_check,''))<>p.expected_digest THEN
   RAISE EXCEPTION 'Exact previous document policy required' USING ERRCODE='42501';END IF;
  q:=p.qual;w:=p.with_check;
  FOREACH action IN ARRAY ARRAY['READ','WRITE'] LOOP
   old_call:=format('srm.native_supplier_row(''financial_source_documents''::text, organization_id, NULL::uuid, NULL::uuid, NULL::uuid, nip, ''financial''::text, %L::text)',action);
   replacement:=format($guard$CASE WHEN ARRAY[organization_id::text,nip] = (
    WITH target AS MATERIALIZED (SELECT srm.current_supplier_work() d)
    SELECT ARRAY[d->>'organisationId',d->>'nip'] FROM target
     WHERE d->>'unitId'='SRM_STORE_COMPANY'
      AND srm.ready_company_work_descriptor()->>'freshPostfetchVersion'='1.0.0'
      AND srm.native_supplier_row('financial_source_documents',(d->>'organisationId')::uuid,
       NULL::uuid,NULL::uuid,NULL::uuid,d->>'nip','financial',%L)
   ) THEN true ELSE %s END$guard$,action,old_call);
   q:=replace(q,old_call,replacement);w:=replace(w,old_call,replacement);
  END LOOP;
  IF q IS NOT DISTINCT FROM p.qual AND w IS NOT DISTINCT FROM p.with_check THEN
   RAISE EXCEPTION 'Exact native document predicates required' USING ERRCODE='42501';END IF;
  EXECUTE format('ALTER POLICY %I ON srm.financial_source_documents%s%s',p.policyname,
   CASE WHEN q IS NULL THEN '' ELSE ' USING ('||q||')' END,
   CASE WHEN w IS NULL THEN '' ELSE ' WITH CHECK ('||w||')' END);
  changed:=changed+1;
 END LOOP;
 IF changed<>5 THEN RAISE EXCEPTION 'All five exact document policies required' USING ERRCODE='42501';END IF;
END $document_statement$;
