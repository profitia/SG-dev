-- Explicit organization-owned Supplier inspection. No runtime ACL, data copy,
-- provider call or activation. Existing write admission remains write-only.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='srm' AND status='DISABLED')
  OR NOT EXISTS(SELECT 1 FROM srm.delegated_supplier_installation WHERE singleton AND schema_version='1.0.0'
   AND boundary_digest='803aa871051c1454c5bf64cef414a2908c1d6042bbc46391b97516f015037a36')
  OR NOT EXISTS(SELECT 1 FROM profitia_request_inspection.installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='00db4ebae666f6cd94475b789fecfbb775c0ebb2d66f87e595d674b827cdf13d') THEN
  RAISE EXCEPTION 'Controlled disabled SRM and accepted inspection installations required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.supplier_inspection_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.supplier_inspection_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_inspection_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.supplier_inspection_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY controlled_fence ON srm.supplier_inspection_installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.supplier_inspection_installation
 FOR EACH ROW EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.supplier_inspection_installation
 FOR EACH STATEMENT EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();

CREATE FUNCTION srm.current_supplier_inspection(p_org uuid DEFAULT NULL,p_request uuid DEFAULT NULL,p_nip text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE marker jsonb;d jsonb;c profitia_supplier_requests.commands%ROWTYPE;
 i srm.supplier_inspection_installation%ROWTYPE;b srm.delegated_supplier_installation%ROWTYPE;
 command_installation profitia_supplier_requests.installation%ROWTYPE;
BEGIN
 marker:=nullif(current_setting('profitia.inspection.scope',true),'')::jsonb;
 IF jsonb_typeof(marker) IS DISTINCT FROM 'array' THEN RETURN NULL;END IF;
 IF jsonb_array_length(marker)<>5 OR coalesce(marker->>0,'')!~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN RETURN NULL;END IF;
 d:=profitia_request_inspection.descriptor((marker->>0)::uuid,marker->>1);
 IF d IS NULL OR d->>'parentApplicationId' IS DISTINCT FROM 'srm' OR d->>'applicationId' IS NOT DISTINCT FROM 'srm'
  OR (p_org IS NOT NULL AND d->>'organisationId' IS DISTINCT FROM p_org::text)
  OR (p_request IS NOT NULL AND d->>'requestId' IS DISTINCT FROM p_request::text)
  OR profitia_request_inspection.scope_allows((d->>'requestId')::uuid,d->>'phaseId',(d->>'organisationId')::uuid,(d->>'subjectUserId')::uuid) IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_inspection_installation'::regclass
   AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
  OR has_table_privilege(session_user,'srm.supplier_inspection_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'srm.supplier_inspection_installation','SELECT,INSERT,UPDATE,REFERENCES')
  OR has_schema_privilege(session_user,'srm','CREATE') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.supplier_inspection_installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO b FROM srm.delegated_supplier_installation WHERE singleton;
 IF NOT FOUND OR b.boundary_digest<>'803aa871051c1454c5bf64cef414a2908c1d6042bbc46391b97516f015037a36' THEN RETURN NULL;END IF;
 SELECT * INTO command_installation FROM profitia_supplier_requests.installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO c FROM profitia_supplier_requests.commands WHERE request_id=(d->>'requestId')::uuid;
 IF NOT FOUND OR c.application_id<>'srm' OR c.environment IS DISTINCT FROM d->>'environment'
  OR c.organisation_id::text IS DISTINCT FROM d->>'organisationId' OR c.user_id::text IS DISTINCT FROM d->>'subjectUserId'
  OR c.payload_digest IS DISTINCT FROM d->>'payloadDigest' OR c.resource_id IS DISTINCT FROM d->>'resourceId'
  OR c.command_json->>'kind' IS DISTINCT FROM 'SUPPLIER_REPORT' OR coalesce(c.command_json->>'nip','')!~'^[0-9]{10}$'
  OR (p_nip IS NOT NULL AND c.command_json->>'nip' IS DISTINCT FROM p_nip) THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('nip',c.command_json->>'nip','commandBoundaryDigest',command_installation.boundary_digest,
  'delegatedBusinessBoundaryDigest',b.boundary_digest,'inspectionBusinessSchemaVersion',i.schema_version,
  'inspectionBusinessBoundaryDigest',i.boundary_digest,'inspectionBusinessSourceRef',i.source_ref);
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;

CREATE FUNCTION srm.inspected_supplier_row(p_table text,p_org uuid,p_key uuid,p_related uuid,p_supplier uuid,p_nip text,p_section text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;bound_request uuid;BEGIN
 d:=srm.current_supplier_inspection(p_org);
 IF d IS NULL THEN RETURN false;END IF;bound_request:=(d->>'requestId')::uuid;
 IF p_table='organizations' THEN RETURN p_key=p_org;
 ELSIF p_table='suppliers' THEN RETURN p_nip=d->>'nip';
 ELSIF p_table='lookup_requests' THEN RETURN p_key=bound_request AND p_nip=d->>'nip' AND EXISTS(
  SELECT 1 FROM srm.suppliers s WHERE s.organization_id=p_org AND s.id=p_supplier AND s.nip=p_nip);
 END IF;
 IF p_table NOT IN('provider_attempts','source_snapshots','section_projections','financial_facts','mgbi_source_archives','financial_source_documents')
  OR p_section IS NULL OR p_section NOT IN('general','financial') THEN RETURN false;END IF;
 IF p_table='provider_attempts' THEN RETURN p_related=bound_request;
 ELSIF p_table='source_snapshots' THEN RETURN EXISTS(
  SELECT 1 FROM srm.provider_attempts a JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id
  WHERE a.organization_id=p_org AND a.id=p_related AND a.request_id=bound_request AND a.section=p_section AND l.supplier_id=p_supplier);
 ELSIF p_table IN('section_projections','financial_facts') THEN RETURN EXISTS(
  SELECT 1 FROM srm.source_snapshots snapshot JOIN srm.provider_attempts a ON a.organization_id=snapshot.organization_id AND a.id=snapshot.attempt_id
  WHERE snapshot.organization_id=p_org AND snapshot.id=p_related AND snapshot.supplier_id=p_supplier AND snapshot.section=p_section AND a.request_id=bound_request);
 ELSE RETURN p_nip=d->>'nip';END IF;
END $fn$;

-- SELECT is additive; the old FOR ALL fence remains authoritative for writes.
-- Separate restrictive UPDATE/DELETE predicates prevent a read scope from
-- borrowing another permissive policy even when a runtime has a DML ACL.
DO $rls$ DECLARE item record;human text;write_scope text;inspection text;BEGIN
 FOR item IN SELECT * FROM(VALUES
  ('organizations','id','id','NULL::uuid','NULL::uuid','NULL::text','NULL::text'),
  ('suppliers','organization_id','id','NULL::uuid','NULL::uuid','nip','NULL::text'),
  ('lookup_requests','organization_id','id','NULL::uuid','supplier_id','identifier','NULL::text'),
  ('provider_attempts','organization_id','id','request_id','NULL::uuid','NULL::text','section'),
  ('source_snapshots','organization_id','id','attempt_id','supplier_id','NULL::text','section'),
  ('section_projections','organization_id','id','snapshot_id','supplier_id','NULL::text','section'),
  ('financial_facts','organization_id','NULL::uuid','snapshot_id','supplier_id','NULL::text',$s$'financial'$s$),
  ('mgbi_source_archives','organization_id','NULL::uuid','NULL::uuid','NULL::uuid','nip','CASE model WHEN ''pl-krs-wp-record'' THEN ''general'' WHEN ''pl-krs-rdf-record'' THEN ''financial'' ELSE NULL END'),
  ('financial_source_documents','organization_id','NULL::uuid','NULL::uuid','NULL::uuid','nip',$s$'financial'$s$)
 )AS definition(table_name,org_column,row_key,related_key,supplier_key,nip_value,section_value) LOOP
  human:=format('profitia_modules.scope_allows(''supplier_report'',%I)',item.org_column);
  write_scope:=format('CASE WHEN (profitia_access.runtime_descriptor()->>''applicationId'')=''srm'' THEN %s ELSE srm.delegated_supplier_row(%L,%I,%s,%s,%s,%s,%s) END',
   human,item.table_name,item.org_column,item.row_key,item.related_key,item.supplier_key,item.nip_value,item.section_value);
  inspection:=format('srm.inspected_supplier_row(%L,%I,%s,%s,%s,%s,%s)',item.table_name,item.org_column,item.row_key,item.related_key,item.supplier_key,item.nip_value,item.section_value);
  EXECUTE format('CREATE POLICY inspected_read_admission ON srm.%I FOR SELECT TO PUBLIC USING(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item.table_name,inspection);
  EXECUTE format('ALTER POLICY private_operation_fence ON srm.%I USING(CASE WHEN current_user=''profitia_access_owner'' THEN true ELSE ((%s) OR (%s)) END) WITH CHECK(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE (%s) END)',item.table_name,write_scope,inspection,write_scope);
  EXECUTE format('CREATE POLICY inspected_update_fence ON srm.%I AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE (%s) END) WITH CHECK(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE (%s) END)',item.table_name,write_scope,write_scope);
  EXECUTE format('CREATE POLICY inspected_delete_fence ON srm.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE (%s) END)',item.table_name,write_scope);
 END LOOP;
END $rls$;
CREATE POLICY inspection_command_read ON profitia_supplier_requests.commands FOR SELECT TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.current_supplier_inspection(organisation_id,request_id,command_json->>'nip') IS NOT NULL END);
ALTER POLICY command_read_fence ON profitia_supplier_requests.commands USING(
 CASE WHEN current_user='profitia_access_owner' THEN true ELSE
  (application_id='srm' AND application_id=(profitia_access.runtime_descriptor()->>'applicationId')
   AND environment=(profitia_access.runtime_descriptor()->>'environment')
   AND profitia_requests.scope_allows('supplier.report.refresh',organisation_id,user_id,resource_id))
  OR srm.current_delegated_supplier(organisation_id,request_id,command_json->>'nip') IS NOT NULL
  OR srm.current_supplier_inspection(organisation_id,request_id,command_json->>'nip') IS NOT NULL END);
REVOKE ALL ON srm.supplier_inspection_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.current_supplier_inspection(uuid,uuid,text),srm.inspected_supplier_row(text,uuid,uuid,uuid,uuid,text,text) FROM PUBLIC;
