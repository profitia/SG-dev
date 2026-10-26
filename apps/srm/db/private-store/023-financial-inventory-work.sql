-- Optional, role-bound inventory adoption. No data rewrite, human grant,
-- quota or baseline migration change. Install only in one checked transaction.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
  RAISE EXCEPTION 'Controlled SRM owner required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.financial_inventory_installation(
 singleton boolean PRIMARY KEY CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$'),runtime_role name NOT NULL,service_id uuid NOT NULL
);
ALTER TABLE srm.financial_inventory_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.financial_inventory_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.financial_inventory_installation TO profitia_access_owner USING(true) WITH CHECK(true);
REVOKE ALL ON srm.financial_inventory_installation FROM PUBLIC;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.financial_inventory_installation
 FOR EACH ROW EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.financial_inventory_installation
 FOR EACH STATEMENT EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE FUNCTION srm.financial_inventory_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.financial_inventory_installation%ROWTYPE;BEGIN
 d:=profitia_services.runtime_descriptor();IF d IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.financial_inventory_installation WHERE singleton AND runtime_role=session_user;
 IF NOT FOUND OR d->>'serviceId' IS DISTINCT FROM i.service_id::text THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('schemaDigest',i.schema_digest);
END $fn$;
REVOKE ALL ON FUNCTION srm.financial_inventory_descriptor() FROM PUBLIC;
-- Preserve the exact current sensitive/JDG/website implementation. Both
-- admitted predecessor shapes are checked; no unchecked textual patching.
DO $adopt$ DECLARE b text;f text;BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO b,f FROM pg_proc WHERE oid='srm.current_supplier_work(uuid,uuid,text)'::regprocedure AND proowner='profitia_access_owner'::regrole AND prosecdef;
 IF b IS NULL OR md5(b) NOT IN('1ef5e82c70e258e5b981cfcb2003085b','64972ca5220b29a6d912301f9e4830e8') THEN RAISE EXCEPTION 'Exact current current_supplier_work required' USING ERRCODE='42501';END IF;
 IF position('(''SRM_ARCHIVE_GENERAL'',''WRITE''),(''SRM_ARCHIVE_FINANCIAL'',''WRITE'')' in b)=0 THEN RAISE EXCEPTION 'Inventory adoption target missing';END IF;
 b:=replace(b,'(''SRM_ARCHIVE_GENERAL'',''WRITE''),(''SRM_ARCHIVE_FINANCIAL'',''WRITE'')','(''SRM_FINANCIAL_INVENTORY'',''WRITE''),(''SRM_ARCHIVE_GENERAL'',''WRITE''),(''SRM_ARCHIVE_FINANCIAL'',''WRITE'')');
 IF position('d:=profitia_request_work.descriptor((marker->>0)::uuid,marker->>1);' in b)=0 THEN RAISE EXCEPTION 'Inventory adoption target missing';END IF;
 b:=replace(b,'d:=profitia_request_work.descriptor((marker->>0)::uuid,marker->>1);','d:=profitia_request_work.descriptor((marker->>0)::uuid,marker->>1);
 IF d->>''unitId''=''SRM_FINANCIAL_INVENTORY'' AND srm.financial_inventory_descriptor() IS NULL THEN RETURN NULL;END IF;');
 EXECUTE replace(f,(SELECT prosrc FROM pg_proc WHERE oid='srm.current_supplier_work(uuid,uuid,text)'::regprocedure),b);
 SELECT prosrc,pg_get_functiondef(oid) INTO b,f FROM pg_proc WHERE oid='srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure AND proowner='profitia_access_owner'::regrole AND prosecdef;
 IF b IS NULL OR md5(b) NOT IN('d1b2129c4d3d0b40f8d9753172cad957','4e4f9668f4689999885463c7d6ce3297') THEN RAISE EXCEPTION 'Exact current native_supplier_row required' USING ERRCODE='42501';END IF;
 IF position('u=''SRM_ARCHIVE_FINANCIAL''' in b)=0 THEN RAISE EXCEPTION 'Inventory adoption target missing';END IF;
 b:=replace(b,'u=''SRM_ARCHIVE_FINANCIAL''','u IN(''SRM_ARCHIVE_FINANCIAL'',''SRM_FINANCIAL_INVENTORY'')');
 IF position('''SRM_FINANCIAL_REPROJECT_READ'',''SRM_ARCHIVE_FINANCIAL''' in b)=0 THEN RAISE EXCEPTION 'Inventory adoption target missing';END IF;
 b:=replace(b,'''SRM_FINANCIAL_REPROJECT_READ'',''SRM_ARCHIVE_FINANCIAL''','''SRM_FINANCIAL_INVENTORY'',''SRM_FINANCIAL_REPROJECT_READ'',''SRM_ARCHIVE_FINANCIAL''');
 IF position('ARRAY[''SRM_PREPARE_DOCUMENTS''' in b)=0 THEN RAISE EXCEPTION 'Inventory adoption target missing';END IF;
 b:=replace(b,'ARRAY[''SRM_PREPARE_DOCUMENTS''','ARRAY[''SRM_FINANCIAL_INVENTORY'',''SRM_PREPARE_DOCUMENTS''');
 IF position('''SRM_PREPARE_DOCUMENTS'',''SRM_READ_DOCUMENTS''] END)' in b)=0 THEN RAISE EXCEPTION 'Inventory adoption target missing';END IF;
 b:=replace(b,'''SRM_PREPARE_DOCUMENTS'',''SRM_READ_DOCUMENTS''] END)','''SRM_PREPARE_DOCUMENTS'',''SRM_READ_DOCUMENTS'',''SRM_FINANCIAL_INVENTORY''] END)');
 EXECUTE replace(f,(SELECT prosrc FROM pg_proc WHERE oid='srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure),b);
 SELECT prosrc,pg_get_functiondef(oid) INTO b,f FROM pg_proc WHERE oid='srm.supplier_business_phase(uuid,text,uuid,text[])'::regprocedure AND proowner='profitia_access_owner'::regrole AND prosecdef;
 IF b IS NULL OR md5(b) NOT IN('7405aac3b9f88c717aa5ade2563f7916') THEN RAISE EXCEPTION 'Exact current supplier_business_phase required' USING ERRCODE='42501';END IF;
 IF position('IN(''SRM_STORE_FINANCIAL'',''SRM_ARCHIVE_FINANCIAL''' in b)=0 THEN RAISE EXCEPTION 'Inventory adoption target missing';END IF;
 b:=replace(b,'IN(''SRM_STORE_FINANCIAL'',''SRM_ARCHIVE_FINANCIAL''','IN(''SRM_FINANCIAL_INVENTORY'',''SRM_STORE_FINANCIAL'',''SRM_ARCHIVE_FINANCIAL''');
 EXECUTE replace(f,(SELECT prosrc FROM pg_proc WHERE oid='srm.supplier_business_phase(uuid,text,uuid,text[])'::regprocedure),b);
END $adopt$;
DO $acl$ DECLARE a record;BEGIN
 FOR a IN SELECT x.grantee FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
  WHERE p.oid='srm.current_supplier_work(uuid,uuid,text)'::regprocedure AND x.privilege_type='EXECUTE' AND x.grantee<>p.proowner LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION srm.financial_inventory_descriptor() TO %s',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END);
 END LOOP;
END $acl$;
