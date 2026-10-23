-- Explicit operator adoption only; run in one controlled transaction as the
-- existing profitia_access_owner. This changes no grants, RLS, data or E1 limits.
-- Financial facts are never sensitive KYS/JDG writes. Their ordinary branch
-- still validates the current exact Supplier phase for EVERY row below.
DO $financial_fact_guard$
DECLARE
  original text;
  candidate text;
  original_acl aclitem[];
  original_owner oid;
BEGIN
  IF current_user <> 'profitia_access_owner' THEN
    RAISE EXCEPTION 'Controlled SRM owner required' USING ERRCODE='42501';
  END IF;
  SELECT pg_get_functiondef(p.oid),p.proacl,p.proowner
    INTO original,original_acl,original_owner
    FROM pg_proc p WHERE p.oid='srm.guard_supplier_business_write()'::regprocedure
      AND p.proowner='profitia_access_owner'::regrole AND p.prosecdef
      AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp'];
  IF original IS NULL THEN RAISE EXCEPTION 'Exact SRM guard owner and configuration required';END IF;
  IF md5(original)='1528f903448f0dac2c0e99565f141157' THEN RETURN;END IF;
  IF md5(original)<>'7b0976a9fae26cae3708884edea56cbe' THEN
    RAISE EXCEPTION 'SRM business guard source drift; reconciliation required';
  END IF;
  candidate:=replace(original,
    ' d:=srm.current_supplier_work();',
    ' IF TG_TABLE_NAME<>''financial_facts'' THEN d:=srm.current_supplier_work();END IF;');
  IF md5(candidate)<>'1528f903448f0dac2c0e99565f141157' THEN
    RAISE EXCEPTION 'Unexpected financial guard replacement';
  END IF;
  EXECUTE candidate;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p
    WHERE p.oid='srm.guard_supplier_business_write()'::regprocedure
      AND p.proowner=original_owner AND p.proacl IS NOT DISTINCT FROM original_acl
      AND p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog, pg_temp']
      AND md5(pg_get_functiondef(p.oid))='1528f903448f0dac2c0e99565f141157') THEN
    RAISE EXCEPTION 'Financial guard identity or ACL changed';
  END IF;
END $financial_fact_guard$;
