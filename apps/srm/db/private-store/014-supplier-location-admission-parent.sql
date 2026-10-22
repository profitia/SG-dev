-- SRM P1 receiver SOURCE ONLY. Additive; SQL013 and SQL019 remain immutable.
-- Install by the existing controlled NOLOGIN owner with all apps disabled.
-- No runtime ACL, grant, policy, receiver key or active binding is seeded.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR EXISTS(SELECT 1 FROM profitia_access.applications WHERE status<>'DISABLED') THEN
  RAISE EXCEPTION 'Controlled disabled installation required' USING ERRCODE='42501'; END IF;
 IF to_regclass('profitia_requests.location_admission_installation') IS NULL
  OR to_regclass('srm.supplier_location_installation') IS NULL THEN
  RAISE EXCEPTION 'SQL020 and SRM013 required before SQL014' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_requests.location_installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='34ec633dbf38dfffd6b3954ae79b0ef6f771d75ad8f0443882be71ca78b084e5')
  OR NOT EXISTS(SELECT 1 FROM profitia_requests.location_admission_installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='90ac1d28103f689edc8d11979210ce83cd6218e9f3549f37150fd307d165e9cc')
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_location_installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='b3f05a4c56f32bd32c0c59dcc8b60c486d4d4813823665301ce08318f793704b') THEN
  RAISE EXCEPTION 'Controlled disabled exact SQL019 SQL020 SRM013 required' USING ERRCODE='42501'; END IF;
END $guard$;

CREATE TABLE srm.supplier_location_admission_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$'),
 installed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE srm.supplier_location_admission_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_location_admission_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.supplier_location_admission_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY receiver_fence ON srm.supplier_location_admission_installation AS RESTRICTIVE TO PUBLIC USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.supplier_location_admission_installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.supplier_location_admission_installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
REVOKE ALL ON srm.supplier_location_admission_installation FROM PUBLIC;

CREATE FUNCTION srm.location_admission_installation_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.supplier_location_admission_installation%ROWTYPE;BEGIN
 d:=srm.location_installation_descriptor();
 IF d IS NULL OR profitia_requests.location_admission_descriptor() IS NULL
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_location_admission_installation'::regclass
    AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
  OR has_table_privilege(session_user,'srm.supplier_location_admission_installation','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'srm.supplier_location_admission_installation','INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.supplier_location_admission_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('parentSchemaVersion',i.schema_version,'parentSchemaDigest',i.schema_digest,'parentSourceRef',i.source_ref);
END $fn$;
-- PostgreSQL applies UPDATE visibility even to SELECT ... FOR UPDATE. Permit
-- the controlled definer to LOCK a parent in a current E1 scope only. Preserve
-- the original restrictive WITH CHECK byte-for-byte: it still denies owner
-- business UPDATE. No ordinary-role policy, ACL or DELETE/INSERT is extended.
DO $parent_lock$ DECLARE prior_using text;prior_check text;visibility text;BEGIN
 SELECT qual,with_check INTO prior_using,prior_check FROM pg_policies
  WHERE schemaname='srm' AND tablename='suppliers' AND policyname='inspected_update_fence' AND permissive='RESTRICTIVE';
 IF prior_using IS NULL OR prior_check IS NULL THEN RAISE EXCEPTION 'Existing parent DML fence required' USING ERRCODE='42501';END IF;
 visibility:=$p$(current_user='profitia_access_owner' AND srm.location_admission_installation_descriptor() IS NOT NULL
  AND profitia_access.scope_allows('srm',organization_id,nullif(current_setting('profitia.user_id',true),'')::uuid)
  AND profitia_modules.scope_allows('supplier_report',organization_id,nullif(current_setting('profitia.user_id',true),'')::uuid))$p$;
 EXECUTE format('CREATE POLICY location_parent_lock ON srm.suppliers FOR UPDATE TO profitia_access_owner USING(%s) WITH CHECK(false)',visibility);
 EXECUTE format('ALTER POLICY inspected_update_fence ON srm.suppliers USING((%s) OR (%s)) WITH CHECK(%s)',prior_using,visibility,prior_check);
END $parent_lock$;

-- The parent grant is only a pre-admission CREATE basis. SQL020 still requires
-- the signed server-assigned child ID before any write/intent can be accepted.
CREATE FUNCTION srm.location_admission_parent(p_org uuid,p_supplier uuid,p_operation text,p_action text,p_location uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c bigint;r text;BEGIN
 IF srm.location_admission_installation_descriptor() IS NULL
  OR p_org IS NULL OR p_supplier IS NULL
  OR NOT(p_operation='supplier.location.write' AND p_action IN('CREATE','UPDATE','DEACTIVATE') AND p_location IS NOT NULL
    OR p_operation='supplier.location.sync' AND p_action='SYNC' AND p_location IS NULL) THEN RETURN NULL;END IF;
 r:=CASE WHEN p_action IN('CREATE','SYNC') THEN 'supplier-locations:'||p_supplier::text ELSE p_location::text END;
 IF srm.location_authority(p_org,p_supplier,p_operation,r,false) IS NOT TRUE THEN RETURN NULL;END IF;
 -- Always lock the real parent first, even when no collection/child exists.
 PERFORM 1 FROM srm.suppliers WHERE organization_id=p_org AND id=p_supplier AND nip~'^[0-9]{10}$' FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF srm.location_authority(p_org,p_supplier,p_operation,r,false) IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT version INTO c FROM srm.supplier_location_collections WHERE organization_id=p_org AND supplier_id=p_supplier FOR UPDATE;
 RETURN jsonb_build_object('supplierId',p_supplier,'organisationId',p_org,'collectionId','supplier-locations:'||p_supplier::text,'version',coalesce(c,0)::text);
END $fn$;

-- Minimal current child facts for readResources before the signed CREATE proof.
-- No address/body, arbitrary query or direct runtime table access is exposed.
CREATE FUNCTION srm.location_admission_metadata(p_org uuid,p_supplier uuid,p_operation text,p_action text,p_location uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE p jsonb;l srm.supplier_locations%ROWTYPE;BEGIN
 p:=srm.location_admission_parent(p_org,p_supplier,p_operation,p_action,p_location);IF p IS NULL THEN RETURN NULL;END IF;
 IF p_location IS NOT NULL THEN SELECT * INTO l FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier AND location_id=p_location FOR UPDATE;END IF;
 RETURN jsonb_build_object('supplierId',p_supplier,'collectionVersion',p->>'version','exists',l.location_id IS NOT NULL,
  'origin',l.origin,'version',l.version::text,'addressVersion',l.address_version);
END $fn$;
REVOKE ALL ON FUNCTION srm.location_admission_installation_descriptor(),srm.location_admission_parent(uuid,uuid,text,text,uuid),srm.location_admission_metadata(uuid,uuid,text,text,uuid) FROM PUBLIC;
