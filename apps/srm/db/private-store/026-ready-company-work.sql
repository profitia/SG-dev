-- Explicit main-Development adoption of one atomic two-section Work. This
-- changes no common E1 host, paid admission, KYS/JDG purpose or existing receipt.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR to_regclass('srm.ready_report_reads') IS NULL
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)) THEN
  RAISE EXCEPTION 'Controlled ready-report owner required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.ready_company_work_installation(
 singleton boolean PRIMARY KEY CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$'),runtime_role name NOT NULL,service_id uuid NOT NULL
);
ALTER TABLE srm.ready_company_work_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.ready_company_work_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.ready_company_work_installation TO profitia_access_owner USING(true) WITH CHECK(true);
REVOKE ALL ON srm.ready_company_work_installation FROM PUBLIC;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.ready_company_work_installation
 FOR EACH ROW EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.ready_company_work_installation
 FOR EACH STATEMENT EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE FUNCTION srm.ready_company_work_descriptor() RETURNS jsonb LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.ready_company_work_installation%ROWTYPE;BEGIN
 d:=profitia_services.runtime_descriptor();IF d IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.ready_company_work_installation WHERE singleton AND runtime_role=session_user;
 IF NOT FOUND OR d->>'serviceId' IS DISTINCT FROM i.service_id::text THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('schemaDigest',i.schema_digest);
END $fn$;
REVOKE ALL ON FUNCTION srm.ready_company_work_descriptor() FROM PUBLIC;
DO $adopt$ DECLARE b text;f text;BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO b,f FROM pg_proc WHERE oid='srm.current_supplier_work(uuid,uuid,text)'::regprocedure AND proowner='profitia_access_owner'::regrole AND prosecdef;
 IF b IS NULL OR md5(b) NOT IN('7101006e4ff0b8f91e86497197e03d5b','5e7e617951d940a47f6fce4309fb77b3') THEN RAISE EXCEPTION 'Exact accepted inventory Work predecessor required';END IF;
 IF position('(''SRM_STORE_GENERAL'',''WRITE''),(''SRM_STORE_FINANCIAL'',''WRITE'')' in b)=0 THEN RAISE EXCEPTION 'Composite Work target missing';END IF;
 b:=replace(b,'(''SRM_STORE_GENERAL'',''WRITE''),(''SRM_STORE_FINANCIAL'',''WRITE'')','(''SRM_STORE_COMPANY'',''WRITE''),(''SRM_STORE_GENERAL'',''WRITE''),(''SRM_STORE_FINANCIAL'',''WRITE'')');
 IF position('d:=profitia_request_work.descriptor((marker->>0)::uuid,marker->>1);' in b)=0 THEN RAISE EXCEPTION 'Composite Work descriptor target missing';END IF;
 b:=replace(b,'d:=profitia_request_work.descriptor((marker->>0)::uuid,marker->>1);','d:=profitia_request_work.descriptor((marker->>0)::uuid,marker->>1);
 IF d->>''unitId''=''SRM_STORE_COMPANY'' AND srm.ready_company_work_descriptor() IS NULL THEN RETURN NULL;END IF;');
 EXECUTE replace(f,(SELECT prosrc FROM pg_proc WHERE oid='srm.current_supplier_work(uuid,uuid,text)'::regprocedure),b);
 SELECT prosrc,pg_get_functiondef(oid) INTO b,f FROM pg_proc WHERE oid='srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure AND proowner='profitia_access_owner'::regrole AND prosecdef;
 IF b IS NULL OR md5(b) NOT IN('5deaf2e9cca6dc96dd30c48b76a1db1b','fd4a64b3d13f5af1d3a10fa7b7c61ff5') THEN RAISE EXCEPTION 'Exact accepted inventory row predecessor required';END IF;
 IF position('(u IS DISTINCT FROM CASE p_section WHEN ''general'' THEN ''SRM_STORE_GENERAL'' ELSE ''SRM_STORE_FINANCIAL'' END)' in b)=0 THEN RAISE EXCEPTION 'Composite section target missing';END IF;
 b:=replace(b,'(u IS DISTINCT FROM CASE p_section WHEN ''general'' THEN ''SRM_STORE_GENERAL'' ELSE ''SRM_STORE_FINANCIAL'' END)',
  '(u<>''SRM_STORE_COMPANY'' AND u IS DISTINCT FROM CASE p_section WHEN ''general'' THEN ''SRM_STORE_GENERAL'' ELSE ''SRM_STORE_FINANCIAL'' END)');
 EXECUTE replace(f,(SELECT prosrc FROM pg_proc WHERE oid='srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure),b);
 -- The new read metadata wrapper stays intact; adopt only its unchanged
 -- native-phase predecessor, preserving both old lanes and their ACLs.
 SELECT prosrc,pg_get_functiondef(oid) INTO b,f FROM pg_proc WHERE oid='srm.supplier_business_phase_before_ready_v1(uuid,text,uuid,text[])'::regprocedure AND proowner='profitia_access_owner'::regrole AND prosecdef;
 IF b IS NULL OR md5(b)<>'2348c8489dc98513606d6cf760125ae0' THEN RAISE EXCEPTION 'Exact accepted native phase predecessor required';END IF;
 IF position('WHEN d->>''unitId''=''SRM_REGISTER_LOOKUP''' in b)=0 THEN RAISE EXCEPTION 'Composite phase target missing';END IF;
 b:=replace(b,'WHEN d->>''unitId''=''SRM_REGISTER_LOOKUP''','WHEN d->>''unitId''=''SRM_STORE_COMPANY'' THEN cardinality(p_phases)>0 AND p_phases<@ARRAY[''STORE_GENERAL'',''STORE_FINANCIAL'']::text[]
   WHEN d->>''unitId''=''SRM_REGISTER_LOOKUP''');
 EXECUTE replace(f,(SELECT prosrc FROM pg_proc WHERE oid='srm.supplier_business_phase_before_ready_v1(uuid,text,uuid,text[])'::regprocedure),b);
END $adopt$;
DO $acl$ DECLARE a record;BEGIN
 FOR a IN SELECT x.grantee FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
  WHERE p.oid='srm.current_supplier_work(uuid,uuid,text)'::regprocedure AND x.privilege_type='EXECUTE' AND x.grantee<>p.proowner LOOP
  EXECUTE format('GRANT EXECUTE ON FUNCTION srm.ready_company_work_descriptor() TO %s',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END);
 END LOOP;
END $acl$;
