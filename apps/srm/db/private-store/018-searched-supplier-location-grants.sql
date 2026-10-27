-- Optional owner-configured enrollment for searched suppliers. No scope is
-- seeded; no runtime gets table access, owner membership or a generic GRANT port.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner'
  OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development')
  OR NOT EXISTS(SELECT 1 FROM srm.organisation_location_installation WHERE singleton AND schema_version='1.0.0') THEN
  RAISE EXCEPTION 'Controlled Development location owner required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR UPDATE;
END $guard$;
CREATE TABLE srm.searched_location_scopes(
 login_role name NOT NULL REFERENCES profitia_access.runtime_bindings(login_role),organisation_id uuid NOT NULL REFERENCES profitia_access.organisations,
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),
 geocoding_enabled boolean NOT NULL DEFAULT false,source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),PRIMARY KEY(login_role,organisation_id)
);
CREATE TABLE srm.searched_location_enrolments(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 login_role name NOT NULL,organisation_id uuid NOT NULL,supplier_id uuid NOT NULL,user_id uuid NOT NULL,
 location_id uuid,kind text NOT NULL CHECK(kind IN('COLLECTION_POLICY','GEOCODING_PERMISSION')),
 authority_id uuid NOT NULL,source_ref text NOT NULL
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['searched_location_scopes','searched_location_enrolments'] LOOP
  EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owner ON srm.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY owner_fence ON srm.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
  EXECUTE format('REVOKE ALL ON srm.%I FROM PUBLIC',t);
 END LOOP;
END $rls$;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.searched_location_enrolments FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.searched_location_enrolments FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE FUNCTION srm.enrol_searched_supplier_locations(p_org uuid,p_user uuid,p_supplier uuid,p_location uuid,p_schema text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s srm.searched_location_scopes%ROWTYPE;v_operation text;authority uuid;resource text;BEGIN
 -- Administrative metadata is prepared in a separate transaction BEFORE Root
 -- admission. Never change the access revision inside admitted business work.
 IF nullif(current_setting('profitia.module.supplier_report',true),'') IS NOT NULL
  OR nullif(current_setting('profitia.native_work.scope',true),'') IS NOT NULL THEN
  RAISE EXCEPTION 'Enrollment must precede Root admission' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM srm.searched_location_scopes WHERE login_role=session_user AND organisation_id=p_org
  AND status='ACTIVE' AND expires_at>clock_timestamp() AND schema_digest=p_schema FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM profitia_access.runtime_bindings b JOIN profitia_access.applications a USING(application_id)
  WHERE b.login_role=session_user AND b.application_id='srm' AND b.status='ACTIVE' AND a.status='ACTIVE'
   AND(a.fixed_organisation_id IS NULL OR a.fixed_organisation_id=p_org))
  OR NOT EXISTS(SELECT 1 FROM profitia_access.memberships m JOIN profitia_access.accounts a USING(user_id)
   JOIN profitia_access.organisations o USING(organisation_id) WHERE m.organisation_id=p_org AND m.user_id=p_user
    AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND a.status='ACTIVE' AND o.status='ACTIVE')
  OR NOT EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id='srm' AND organisation_id=p_org
   AND product='SUPPLIER_INTELLIGENCE' AND status='ACTIVE' AND expires_at>clock_timestamp() AND 'supplier_report'=ANY(features))
  OR NOT EXISTS(SELECT 1 FROM srm.suppliers WHERE organization_id=p_org AND id=p_supplier) THEN
  RAISE EXCEPTION 'Searched supplier enrollment unavailable' USING ERRCODE='42501';END IF;
 resource:='supplier-locations:'||p_supplier::text;
 FOREACH v_operation IN ARRAY ARRAY['supplier.location.read','supplier.location.write','supplier.location.sync'] LOOP
  IF NOT EXISTS(SELECT 1 FROM profitia_access.organisation_location_policies p WHERE p.application_id='srm'
   AND p.organisation_id=p_org AND p.operation=v_operation AND p.resource_id=resource) THEN
   authority:=NULL;
   INSERT INTO profitia_access.organisation_location_policies(application_id,organisation_id,operation,resource_id,status,source_ref,expires_at)
   VALUES('srm',p_org,v_operation,resource,'ACTIVE',s.source_ref,s.expires_at)
   ON CONFLICT(application_id,organisation_id,operation,resource_id) DO NOTHING RETURNING policy_id INTO authority;
   IF authority IS NOT NULL THEN INSERT INTO srm.searched_location_enrolments(login_role,organisation_id,supplier_id,user_id,kind,authority_id,source_ref)
    VALUES(session_user,p_org,p_supplier,p_user,'COLLECTION_POLICY',authority,s.source_ref);END IF;
  END IF;
 END LOOP;
 IF p_location IS NOT NULL AND s.geocoding_enabled THEN
  IF NOT EXISTS(SELECT 1 FROM srm.supplier_locations WHERE organization_id=p_org AND supplier_id=p_supplier
   AND location_id=p_location AND lifecycle='ACTIVE') THEN RAISE EXCEPTION 'Foreign location' USING ERRCODE='42501';END IF;
  resource:='supplier-location-geocode:'||p_location::text;
  -- Never reactivate a revoked collection or override an explicit user DENY.
  IF EXISTS(SELECT 1 FROM profitia_access.organisation_location_policies p WHERE p.application_id='srm'
   AND p.organisation_id=p_org AND p.resource_id='supplier-locations:'||p_supplier::text AND p.operation='supplier.location.read'
   AND p.status='ACTIVE' AND p.expires_at>clock_timestamp())
   AND NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants p WHERE p.application_id='srm' AND p.organisation_id=p_org
    AND p.user_id=p_user AND p.operation='supplier.location.geocode' AND p.feature='supplier_report'
    AND(p.resource_id IS NULL OR p.resource_id=resource)) THEN
   authority:=gen_random_uuid();
   INSERT INTO profitia_access.permission_grants(grant_id,application_id,organisation_id,user_id,effect,operation,feature,resource_id)
    VALUES(authority,'srm',p_org,p_user,'ALLOW','supplier.location.geocode','supplier_report',resource);
   INSERT INTO srm.searched_location_enrolments(login_role,organisation_id,supplier_id,user_id,location_id,kind,authority_id,source_ref)
    VALUES(session_user,p_org,p_supplier,p_user,p_location,'GEOCODING_PERMISSION',authority,s.source_ref);
  END IF;
 END IF;
END $fn$;
REVOKE ALL ON FUNCTION srm.enrol_searched_supplier_locations(uuid,uuid,uuid,uuid,text) FROM PUBLIC;
