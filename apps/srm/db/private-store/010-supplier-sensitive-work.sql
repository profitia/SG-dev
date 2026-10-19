-- Optional organization-private Supplier/KYS domain extension. Apply atomically
-- only to the accepted NEW private store with disabled applications. No cloud
-- installation, runtime ACL, grants, source acquisition or history copying.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR EXISTS(SELECT 1 FROM profitia_access.applications WHERE status<>'DISABLED')
  OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='srm' AND status='DISABLED')
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_work_installation WHERE singleton AND schema_version='1.0.0'
   AND boundary_digest='faf4322f620c609dc0c30965f289f4ebece0f0652dc19a73a96a5cbd63ad86f8') THEN
  RAISE EXCEPTION 'Controlled disabled private store and exact native Supplier installation required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.catalog_kys_reports'::regclass
  AND relowner=current_user::regrole AND relrowsecurity AND relforcerowsecurity) THEN
  RAISE EXCEPTION 'Controlled private cache required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.supplier_sensitive_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.supplier_sensitive_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_sensitive_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.supplier_sensitive_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY controlled_fence ON srm.supplier_sensitive_installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.supplier_sensitive_installation
 FOR EACH ROW EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.supplier_sensitive_installation
 FOR EACH STATEMENT EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();

-- A global populated cache is never relabelled as customer data. This DDL is
-- confined to the empty new private store; the original legacy database stays intact.
CREATE POLICY sensitive_controlled_read ON srm.catalog_kys_reports FOR SELECT TO profitia_access_owner USING(true);
DROP POLICY private_unadopted_fence ON srm.catalog_kys_reports;
DO $empty$ BEGIN IF EXISTS(SELECT 1 FROM srm.catalog_kys_reports) THEN
 RAISE EXCEPTION 'Refuse conversion of populated global/private KYS cache' USING ERRCODE='42501';END IF;END $empty$;
ALTER TABLE srm.catalog_kys_reports ADD COLUMN organization_id uuid NOT NULL REFERENCES srm.organizations(id);
ALTER TABLE srm.catalog_kys_reports DROP CONSTRAINT catalog_kys_reports_pkey;
ALTER TABLE srm.catalog_kys_reports ADD PRIMARY KEY(organization_id,nip,entity_type);
ALTER TABLE srm.catalog_kys_reports ADD CONSTRAINT private_kys_owner CHECK(source_organization_id IS NULL OR source_organization_id=organization_id);
ALTER TABLE srm.section_projections ADD COLUMN private_envelope jsonb;
ALTER TABLE srm.section_projections ADD CONSTRAINT private_envelope_matches_projection CHECK(private_envelope IS NULL OR
 (section IN('kys','jdg') AND jsonb_typeof(private_envelope)='object' AND private_envelope->'data'=data_json
 AND private_envelope->'source'->>'provider'=CASE section WHEN 'kys' THEN 'VERCLY' ELSE 'CEIDG' END));

CREATE OR REPLACE FUNCTION srm.current_supplier_work(p_org uuid DEFAULT NULL,p_request uuid DEFAULT NULL,p_nip text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE marker jsonb;d jsonb;c profitia_supplier_requests.commands%ROWTYPE;
 i srm.supplier_work_installation%ROWTYPE;ci profitia_supplier_requests.installation%ROWTYPE;si srm.supplier_sensitive_installation%ROWTYPE;BEGIN
 marker:=nullif(current_setting('profitia.native_work.scope',true),'')::jsonb;
 IF jsonb_typeof(marker) IS DISTINCT FROM 'array' THEN RETURN NULL;END IF;
 IF jsonb_array_length(marker)<>6 OR coalesce(marker->>0,'')!~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN RETURN NULL;END IF;
 d:=profitia_request_work.descriptor((marker->>0)::uuid,marker->>1);
 IF d IS NULL OR d->>'parentApplicationId' IS DISTINCT FROM 'srm' OR d->>'applicationId' IS NOT DISTINCT FROM 'srm'
  OR (p_org IS NOT NULL AND d->>'organisationId' IS DISTINCT FROM p_org::text)
  OR (p_request IS NOT NULL AND d->>'requestId' IS DISTINCT FROM p_request::text)
  OR profitia_request_work.scope_allows((d->>'requestId')::uuid,d->>'unitId',(d->>'organisationId')::uuid,(d->>'subjectUserId')::uuid,d->>'accessMode') IS NOT TRUE
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_work_installation'::regclass
   AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
  OR has_table_privilege(session_user,'srm.supplier_work_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'srm.supplier_work_installation','SELECT,INSERT,UPDATE,REFERENCES')
  OR has_schema_privilege(session_user,'srm','CREATE') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.supplier_work_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO ci FROM profitia_supplier_requests.installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO c FROM profitia_supplier_requests.commands WHERE request_id=(d->>'requestId')::uuid;
 IF NOT FOUND OR c.application_id<>'srm' OR c.environment IS DISTINCT FROM d->>'environment'
  OR c.organisation_id::text IS DISTINCT FROM d->>'organisationId' OR c.user_id::text IS DISTINCT FROM d->>'subjectUserId'
  OR c.payload_digest IS DISTINCT FROM d->>'payloadDigest' OR c.resource_id IS DISTINCT FROM d->>'resourceId'
  OR c.command_json->>'kind' IS DISTINCT FROM 'SUPPLIER_REPORT' OR coalesce(c.command_json->>'nip','')!~'^[0-9]{10}$'
  OR (p_nip IS NOT NULL AND c.command_json->>'nip' IS DISTINCT FROM p_nip) THEN RETURN NULL;END IF;
 -- Sensitive purposes require their own optional installation receipt. Existing
 -- corporate purposes retain their complete prior guard and source identity.
 IF EXISTS(SELECT 1 FROM(VALUES
 ('SRM_SENSITIVE_REGISTER','WRITE'),
 ('SRM_SENSITIVE_STATUS','READ'),
 ('SRM_SENSITIVE_REPLAY','READ'),
 ('SRM_SENSITIVE_PURGE','WRITE'),
 ('SRM_JDG_START','WRITE'),
 ('SRM_JDG_STORE','WRITE'),
 ('SRM_JDG_FINISH','WRITE'),
 ('SRM_KYS_STORE','WRITE'),
 ('SRM_KYS_CACHE_READ','READ'),
 ('SRM_KYS_CACHE_CLAIM','WRITE'),
 ('SRM_KYS_CACHE_SAVE','WRITE'),
 ('SRM_KYS_CACHE_HOLD','WRITE'),
 ('SRM_KYS_CACHE_RENEW','WRITE'),
 ('SRM_KYS_CACHE_RELEASE','WRITE')
 )v(unit,mode) WHERE v.unit=d->>'unitId' AND v.mode=d->>'accessMode') THEN
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_sensitive_installation'::regclass
   AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'srm.supplier_sensitive_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'srm.supplier_sensitive_installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
  SELECT * INTO si FROM srm.supplier_sensitive_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
  RETURN d||jsonb_build_object('nip',c.command_json->>'nip','inputDigest',marker->>2,'commandBoundaryDigest',ci.boundary_digest,
   'workBusinessSchemaVersion',si.schema_version,'workBusinessBoundaryDigest',si.boundary_digest,'workBusinessSourceRef',si.source_ref,
   'sensitiveWork',true);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM(VALUES
  ('SRM_REGISTER_LOOKUP','WRITE'),('SRM_CACHE_READ','READ'),('SRM_GENERAL_METADATA_READ','READ'),
  ('SRM_FINANCIAL_REPROJECT_READ','READ'),('SRM_STORE_GENERAL','WRITE'),('SRM_STORE_FINANCIAL','WRITE'),
  ('SRM_ARCHIVE_GENERAL','WRITE'),('SRM_ARCHIVE_FINANCIAL','WRITE'),('SRM_PREPARE_DOCUMENTS','WRITE'),
  ('SRM_READ_DOCUMENTS','READ'),('SRM_MSR_CANDIDATES','READ'),('SRM_MSR_READ','READ'),('SRM_MSR_CLAIM','WRITE'),
  ('SRM_MSR_RECEIVE','WRITE'),('SRM_MSR_SAVE','WRITE'),('SRM_MSR_PROJECT','WRITE'),('SRM_MSR_BLOCK','WRITE'),
  ('SRM_RECORD_INTEREST','WRITE')
 )v(unit,mode) WHERE v.unit=d->>'unitId' AND v.mode=d->>'accessMode') THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('nip',c.command_json->>'nip','inputDigest',marker->>2,'commandBoundaryDigest',ci.boundary_digest,
  'workBusinessSchemaVersion',i.schema_version,'workBusinessBoundaryDigest',i.boundary_digest,'workBusinessSourceRef',i.source_ref);
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;

-- Exact native purposes. All private rows retain their organization and current
-- accepted parent; eligibility/retention have deliberately narrower projections.
CREATE FUNCTION srm.sensitive_supplier_row(p_table text,p_org uuid,p_key uuid,p_related uuid,p_supplier uuid,p_nip text,p_section text,p_mode text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;req uuid;writing boolean:=p_mode IN('WRITE','DELETE');BEGIN
 d:=srm.current_supplier_work(p_org);
 IF d IS NULL OR d->>'sensitiveWork' IS DISTINCT FROM 'true' OR p_org IS NULL OR p_mode IS NULL OR p_mode NOT IN('READ','WRITE','DELETE') THEN RETURN false;END IF;
 u:=d->>'unitId';req:=(d->>'requestId')::uuid;
 IF writing AND d->>'accessMode'<>'WRITE' THEN RETURN false;END IF;
 IF p_table='organizations' THEN RETURN NOT writing AND p_key=p_org;
 ELSIF p_table='suppliers' THEN RETURN p_nip=d->>'nip' AND (NOT writing OR u='SRM_SENSITIVE_REGISTER');
 ELSIF p_table='lookup_requests' THEN RETURN p_key=req AND p_nip=d->>'nip' AND (NOT writing OR u='SRM_SENSITIVE_REGISTER')
  AND EXISTS(SELECT 1 FROM srm.suppliers v WHERE v.organization_id=p_org AND v.id=p_supplier AND v.nip=p_nip);
 ELSIF p_table='catalog_companies' THEN RETURN NOT writing AND u='SRM_SENSITIVE_STATUS' AND p_nip=d->>'nip';
 ELSIF p_table='mgbi_source_archives' THEN RETURN NOT writing AND u='SRM_SENSITIVE_STATUS' AND p_nip=d->>'nip' AND p_section='general';
 END IF;
 IF u='SRM_SENSITIVE_PURGE' THEN
  IF p_table='source_snapshots' THEN RETURN EXISTS(SELECT 1 FROM srm.source_snapshots v WHERE v.organization_id=p_org AND v.id=p_key
   AND v.data_class IN('KYS_PERSONAL','JDG_REGISTRY') AND v.retention_until<=clock_timestamp());
  ELSIF p_table='section_projections' THEN RETURN EXISTS(SELECT 1 FROM srm.source_snapshots v WHERE v.organization_id=p_org AND v.id=p_related
   AND v.data_class IN('KYS_PERSONAL','JDG_REGISTRY') AND v.retention_until<=clock_timestamp());END IF;
  RETURN false;
 END IF;
 IF p_mode='DELETE' OR NOT EXISTS(SELECT 1 FROM srm.lookup_requests l WHERE l.organization_id=p_org AND l.id=req
  AND l.identifier_type='NIP' AND l.identifier=d->>'nip' AND l.entity_type IN('COMPANY','JDG')) THEN RETURN false;END IF;
 IF p_table='provider_attempts' THEN RETURN p_related=req AND
  ((p_section='jdg' AND u IN('SRM_JDG_START','SRM_JDG_STORE','SRM_JDG_FINISH','SRM_SENSITIVE_REPLAY'))
   OR(p_section='kys' AND u IN('SRM_KYS_STORE','SRM_SENSITIVE_REPLAY')));
 ELSIF p_table='source_snapshots' THEN RETURN p_section IN('jdg','kys') AND
  ((NOT writing AND u='SRM_SENSITIVE_REPLAY') OR u=CASE p_section WHEN 'jdg' THEN 'SRM_JDG_STORE' ELSE 'SRM_KYS_STORE' END)
  AND EXISTS(SELECT 1 FROM srm.provider_attempts a JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id
   WHERE a.organization_id=p_org AND a.id=p_related AND a.request_id=req AND a.section=p_section AND l.supplier_id=p_supplier);
 ELSIF p_table='section_projections' THEN RETURN p_section IN('jdg','kys') AND
  ((NOT writing AND u='SRM_SENSITIVE_REPLAY') OR u=CASE p_section WHEN 'jdg' THEN 'SRM_JDG_STORE' ELSE 'SRM_KYS_STORE' END)
  AND EXISTS(SELECT 1 FROM srm.source_snapshots v JOIN srm.provider_attempts a ON a.organization_id=v.organization_id AND a.id=v.attempt_id
   WHERE v.organization_id=p_org AND v.id=p_related AND v.supplier_id=p_supplier AND v.section=p_section AND a.request_id=req);
 END IF;
 RETURN false;
END $fn$;

CREATE FUNCTION srm.sensitive_cache_scope(p_org uuid,p_nip text,p_entity text,p_retrieved timestamptz,p_retention timestamptz,p_mode text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;BEGIN
 d:=srm.current_supplier_work(p_org);
 IF d IS NULL OR d->>'sensitiveWork' IS DISTINCT FROM 'true' OR p_org IS NULL OR p_entity IS NULL OR p_entity NOT IN('COMPANY','JDG') OR p_mode IS NULL OR p_mode NOT IN('READ','WRITE') THEN RETURN false;END IF;
 u:=d->>'unitId';
 IF u='SRM_SENSITIVE_PURGE' THEN RETURN d->>'accessMode'='WRITE' AND p_retention<=clock_timestamp();END IF;
 IF p_nip IS DISTINCT FROM d->>'nip' OR NOT EXISTS(SELECT 1 FROM srm.lookup_requests l WHERE l.organization_id=p_org
  AND l.id=(d->>'requestId')::uuid AND l.identifier=p_nip AND l.entity_type=p_entity) THEN RETURN false;END IF;
 RETURN CASE WHEN p_mode='READ' THEN u IN('SRM_KYS_CACHE_READ','SRM_KYS_CACHE_CLAIM','SRM_KYS_CACHE_SAVE','SRM_KYS_CACHE_HOLD','SRM_KYS_CACHE_RENEW','SRM_KYS_CACHE_RELEASE')
  ELSE d->>'accessMode'='WRITE' AND u IN('SRM_KYS_CACHE_CLAIM','SRM_KYS_CACHE_SAVE','SRM_KYS_CACHE_HOLD','SRM_KYS_CACHE_RENEW','SRM_KYS_CACHE_RELEASE') END;
END $fn$;

CREATE FUNCTION srm.guard_sensitive_supplier_write(p_table text,p_op text,n jsonb,o jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;v jsonb;org uuid;req uuid;sid uuid;section text;row_snapshot srm.source_snapshots%ROWTYPE;BEGIN
 v:=CASE WHEN p_op='DELETE' THEN o ELSE n END;
 IF v IS NULL OR p_op IS NULL OR p_op NOT IN('INSERT','UPDATE','DELETE') THEN RETURN false;END IF;
 org:=(v->>'organization_id')::uuid;d:=srm.current_supplier_work(org);
 IF d IS NULL OR d->>'sensitiveWork' IS DISTINCT FROM 'true' OR d->>'accessMode'<>'WRITE' THEN RETURN false;END IF;
 u:=d->>'unitId';req:=(d->>'requestId')::uuid;
 IF p_op='UPDATE' AND (n->>'organization_id') IS DISTINCT FROM (o->>'organization_id') THEN RETURN false;END IF;
 IF p_table='catalog_kys_reports' THEN
  IF p_op='DELETE' OR srm.sensitive_cache_scope(org,v->>'nip',v->>'entity_type',(v->>'retrieved_at')::timestamptz,(v->>'retention_until')::timestamptz,'WRITE') IS NOT TRUE THEN RETURN false;END IF;
  IF p_op='UPDATE' AND (n-ARRAY['report_json','report_sha256','retrieved_at','retention_until','source_organization_id','source_snapshot_id','lease_owner','lease_until','updated_at'])
   IS DISTINCT FROM(o-ARRAY['report_json','report_sha256','retrieved_at','retention_until','source_organization_id','source_snapshot_id','lease_owner','lease_until','updated_at']) THEN RETURN false;END IF;
  IF u='SRM_KYS_CACHE_CLAIM' THEN RETURN n->'report_json' IS NOT DISTINCT FROM coalesce(o->'report_json','null'::jsonb)
   AND n->>'lease_owner' IS NOT NULL AND (n->>'lease_until')::timestamptz>clock_timestamp()
   AND (n->>'lease_until')::timestamptz<=clock_timestamp()+interval '5 minutes'
   AND(p_op='INSERT' OR (n-ARRAY['lease_owner','lease_until','updated_at'])=(o-ARRAY['lease_owner','lease_until','updated_at']));
  ELSIF p_op<>'UPDATE' THEN RETURN false;
  ELSIF u='SRM_KYS_CACHE_SAVE' THEN RETURN o->>'lease_owner' IS NOT NULL AND (o->>'lease_until')::timestamptz>clock_timestamp()
   AND n->>'lease_owner' IS NULL AND n->>'lease_until' IS NULL AND n->>'source_organization_id'=org::text
   AND n->'report_json'->>'status'='SUCCESS' AND n->'report_json'->'source'->>'provider'='VERCLY'
   AND jsonb_typeof(n->'report_json'->'data'->'pepMatches')='array'
   AND(n->'report_json'->>'retrievedAt')::timestamptz=(n->>'retrieved_at')::timestamptz;
  ELSIF u='SRM_KYS_CACHE_HOLD' THEN RETURN o->>'lease_owner' IS NOT NULL AND n->>'lease_until'='infinity'
   AND(n-'lease_until')=(o-'lease_until');
  ELSIF u='SRM_KYS_CACHE_RENEW' THEN RETURN o->>'lease_owner' IS NOT NULL AND (o->>'lease_until')::timestamptz>clock_timestamp()
   AND(n-'lease_until')=(o-'lease_until') AND((n->>'lease_until'='infinity' AND o->>'lease_until'='infinity')
    OR((n->>'lease_until')::timestamptz>clock_timestamp() AND(n->>'lease_until')::timestamptz<=clock_timestamp()+interval '5 minutes'));
  ELSIF u='SRM_KYS_CACHE_RELEASE' THEN RETURN n->>'lease_owner' IS NULL AND n->>'lease_until' IS NULL
   AND(n-ARRAY['lease_owner','lease_until'])=(o-ARRAY['lease_owner','lease_until']);
  ELSIF u='SRM_SENSITIVE_PURGE' THEN RETURN n->>'report_json' IS NULL AND n->>'report_sha256' IS NULL
   AND(n-ARRAY['report_json','report_sha256'])=(o-ARRAY['report_json','report_sha256']);END IF;
  RETURN false;
 END IF;
 IF p_op='DELETE' THEN
  IF u<>'SRM_SENSITIVE_PURGE' THEN RETURN false;END IF;
  IF p_table='source_snapshots' THEN RETURN v->>'data_class' IN('KYS_PERSONAL','JDG_REGISTRY') AND(v->>'retention_until')::timestamptz<=clock_timestamp();
  ELSIF p_table='section_projections' THEN RETURN srm.sensitive_supplier_row(p_table,org,(v->>'id')::uuid,(v->>'snapshot_id')::uuid,(v->>'supplier_id')::uuid,NULL,v->>'section','DELETE');END IF;
  RETURN false;
 ELSIF p_table='suppliers' THEN RETURN u='SRM_SENSITIVE_REGISTER' AND n->>'nip'=d->>'nip'
  AND(p_op='INSERT' OR(n-'updated_at')=(o-'updated_at'));
 ELSIF p_table='lookup_requests' THEN RETURN p_op='INSERT' AND u='SRM_SENSITIVE_REGISTER' AND n->>'id'=req::text
  AND n->>'identifier_type'='NIP' AND n->>'identifier'=d->>'nip' AND n->>'entity_type' IN('COMPANY','JDG')
  AND EXISTS(SELECT 1 FROM srm.suppliers z WHERE z.organization_id=org AND z.id=(n->>'supplier_id')::uuid AND z.nip=d->>'nip');
 ELSIF p_table='provider_attempts' THEN RETURN srm.sensitive_supplier_row(p_table,org,(n->>'id')::uuid,(n->>'request_id')::uuid,NULL,NULL,n->>'section','WRITE')
  AND(p_op='INSERT' OR(n-ARRAY['status','completed_at','correlation_id','provider_record_id','error_code'])=(o-ARRAY['status','completed_at','correlation_id','provider_record_id','error_code']));
 END IF;
 IF p_op<>'INSERT' OR p_table NOT IN('source_snapshots','section_projections') THEN RETURN false;END IF;
 section:=n->>'section';IF section NOT IN('kys','jdg') THEN RETURN false;END IF;
 IF p_table='source_snapshots' THEN
  RETURN srm.sensitive_supplier_row(p_table,org,(n->>'id')::uuid,(n->>'attempt_id')::uuid,(n->>'supplier_id')::uuid,NULL,section,'WRITE')
   AND n->>'data_class'=CASE section WHEN 'kys' THEN 'KYS_PERSONAL' ELSE 'JDG_REGISTRY' END
   AND isfinite((n->>'retrieved_at')::timestamptz) AND isfinite((n->>'retention_until')::timestamptz)
   AND(n->>'retention_until')::timestamptz>(n->>'retrieved_at')::timestamptz
   AND(n->>'retention_until')::timestamptz<=(n->>'retrieved_at')::timestamptz+CASE section WHEN 'kys' THEN interval '7 days' ELSE interval '30 days' END;
 END IF;
 SELECT * INTO row_snapshot FROM srm.source_snapshots z WHERE z.organization_id=org AND z.id=(n->>'snapshot_id')::uuid AND z.supplier_id=(n->>'supplier_id')::uuid;
 IF NOT FOUND OR row_snapshot.section<>section OR jsonb_typeof(n->'private_envelope') IS DISTINCT FROM 'object' THEN RETURN false;END IF;
 RETURN srm.sensitive_supplier_row(p_table,org,(n->>'id')::uuid,(n->>'snapshot_id')::uuid,(n->>'supplier_id')::uuid,NULL,section,'WRITE')
  AND n->'private_envelope'->'data'=n->'data_json'
  AND n->'private_envelope'->'source'->>'provider'=CASE section WHEN 'kys' THEN 'VERCLY' ELSE 'CEIDG' END
  AND(n->'private_envelope'->'source'->>'recordId') IS NOT DISTINCT FROM row_snapshot.source_record_id
  AND(n->'private_envelope'->>'retrievedAt')::timestamptz=row_snapshot.retrieved_at;
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RETURN false;
END $fn$;

CREATE OR REPLACE FUNCTION srm.native_supplier_row(p_table text,p_org uuid,p_key uuid,p_related uuid,p_supplier uuid,p_nip text,p_section text,p_mode text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;req uuid;writing boolean:=p_mode='WRITE';BEGIN
 d:=srm.current_supplier_work(p_org);IF d IS NULL OR p_mode IS NULL OR p_mode NOT IN('READ','WRITE','LOCK') THEN RETURN false;END IF;
 u:=d->>'unitId';req:=(d->>'requestId')::uuid;
 IF writing AND d->>'accessMode'<>'WRITE' THEN RETURN false;END IF;
 IF d->>'sensitiveWork'='true' THEN RETURN srm.sensitive_supplier_row(p_table,p_org,p_key,p_related,p_supplier,p_nip,p_section,p_mode);END IF;
 -- LOCK is only an internal PostgreSQL UPDATE-USING visibility predicate for
 -- the existing restoration transaction. It is not a Root access mode or a
 -- data-write check. UPDATE WITH CHECK still requires the archive writer unit.
 IF p_mode='LOCK' AND (d->>'accessMode'<>'WRITE' OR u<>'SRM_PREPARE_DOCUMENTS'
  OR p_table<>'mgbi_source_archives' OR p_section IS DISTINCT FROM 'financial') THEN RETURN false;END IF;
 IF p_table='organizations' THEN RETURN NOT writing AND p_key=p_org;
 ELSIF p_table='suppliers' THEN RETURN p_nip=d->>'nip' AND (NOT writing OR u='SRM_REGISTER_LOOKUP');
 ELSIF p_table='lookup_requests' THEN RETURN p_key=req AND p_nip=d->>'nip' AND (NOT writing OR u='SRM_REGISTER_LOOKUP') AND EXISTS(
  SELECT 1 FROM srm.suppliers s WHERE s.organization_id=p_org AND s.id=p_supplier AND s.nip=p_nip);
 END IF;
 -- Every other private purpose requires its actual current lookup, not a
 -- caller-selected NIP or a historical row belonging to a different request.
 IF NOT EXISTS(SELECT 1 FROM srm.lookup_requests l WHERE l.organization_id=p_org AND l.id=req AND l.identifier=d->>'nip' AND l.entity_type='COMPANY') THEN RETURN false;END IF;
 IF p_table IN('catalog_companies','catalog_financial_facts','catalog_financial_indicators') THEN
  RETURN NOT writing AND p_nip=d->>'nip' AND u IN('SRM_CACHE_READ','SRM_GENERAL_METADATA_READ','SRM_RECORD_INTEREST');
 ELSIF p_table='mgbi_source_archives' THEN
  RETURN p_nip=d->>'nip' AND CASE WHEN writing THEN
   (p_section='general' AND u='SRM_ARCHIVE_GENERAL') OR (p_section='financial' AND u='SRM_ARCHIVE_FINANCIAL')
   ELSE (p_section='general' AND u IN('SRM_CACHE_READ','SRM_GENERAL_METADATA_READ','SRM_ARCHIVE_GENERAL'))
    OR (p_section='financial' AND u IN('SRM_FINANCIAL_REPROJECT_READ','SRM_ARCHIVE_FINANCIAL','SRM_PREPARE_DOCUMENTS','SRM_READ_DOCUMENTS','SRM_MSR_CANDIDATES','SRM_MSR_SAVE','SRM_MSR_PROJECT')) END;
 ELSIF p_table='financial_source_documents' THEN
  RETURN p_nip=d->>'nip' AND u=ANY(CASE WHEN writing THEN ARRAY['SRM_PREPARE_DOCUMENTS','SRM_MSR_SAVE','SRM_MSR_PROJECT']
   ELSE ARRAY['SRM_PREPARE_DOCUMENTS','SRM_READ_DOCUMENTS','SRM_MSR_SAVE','SRM_MSR_PROJECT'] END);
 ELSIF p_table='msr_sources' THEN
  RETURN p_nip=d->>'nip' AND u=ANY(CASE WHEN writing THEN ARRAY['SRM_MSR_CLAIM','SRM_MSR_RECEIVE','SRM_MSR_SAVE','SRM_MSR_BLOCK']
   ELSE ARRAY['SRM_MSR_READ','SRM_MSR_CLAIM','SRM_MSR_RECEIVE','SRM_MSR_SAVE','SRM_MSR_PROJECT','SRM_MSR_BLOCK','SRM_PREPARE_DOCUMENTS','SRM_READ_DOCUMENTS'] END);
 ELSIF p_table='msr_projections' THEN
  RETURN p_nip=d->>'nip' AND u=ANY(CASE WHEN writing THEN ARRAY['SRM_MSR_SAVE','SRM_MSR_PROJECT']
   ELSE ARRAY['SRM_MSR_READ','SRM_MSR_SAVE','SRM_MSR_PROJECT','SRM_PREPARE_DOCUMENTS','SRM_READ_DOCUMENTS'] END);
 END IF;
 IF p_section IS NULL OR p_section NOT IN('general','financial') OR (u IS DISTINCT FROM CASE p_section WHEN 'general' THEN 'SRM_STORE_GENERAL' ELSE 'SRM_STORE_FINANCIAL' END) THEN RETURN false;END IF;
 IF p_table='provider_attempts' THEN RETURN p_related=req;
 ELSIF p_table='source_snapshots' THEN RETURN EXISTS(SELECT 1 FROM srm.provider_attempts a JOIN srm.lookup_requests l
  ON l.organization_id=a.organization_id AND l.id=a.request_id WHERE a.organization_id=p_org AND a.id=p_related AND a.request_id=req AND a.section=p_section AND l.supplier_id=p_supplier);
 ELSIF p_table IN('section_projections','financial_facts') THEN RETURN EXISTS(SELECT 1 FROM srm.source_snapshots s JOIN srm.provider_attempts a
  ON a.organization_id=s.organization_id AND a.id=s.attempt_id WHERE s.organization_id=p_org AND s.id=p_related AND s.supplier_id=p_supplier AND s.section=p_section AND a.request_id=req);
 END IF;
 RETURN false;
END $fn$;

CREATE OR REPLACE FUNCTION srm.guard_supplier_business_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE nip text; lookup_id uuid; section text; phases text[]; d jsonb;
BEGIN
 d:=srm.current_supplier_work();
 IF d->>'sensitiveWork'='true' THEN
  IF NOT srm.guard_sensitive_supplier_write(TG_TABLE_NAME,TG_OP,to_jsonb(NEW),to_jsonb(OLD)) THEN
   RAISE EXCEPTION 'Current exact sensitive Supplier write required' USING ERRCODE='42501';END IF;
  IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
 END IF;

 IF TG_TABLE_NAME='catalog_kys_reports' THEN RAISE EXCEPTION 'Current sensitive cache purpose required' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Supplier business deletion refused' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)->>'organization_id') IS DISTINCT FROM (to_jsonb(OLD)->>'organization_id') THEN
   RAISE EXCEPTION 'Supplier business owner is immutable' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='suppliers' THEN
   nip:=NEW.nip; phases:=ARRAY['REGISTER_LOOKUP'];
   IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN
     RAISE EXCEPTION 'Supplier identity is immutable' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='lookup_requests' THEN
   nip:=NEW.identifier; lookup_id:=NEW.id; phases:=ARRAY['REGISTER_LOOKUP'];
   IF TG_OP<>'INSERT' OR NEW.identifier_type<>'NIP' OR NEW.entity_type<>'COMPANY'
     OR NOT EXISTS(SELECT 1 FROM srm.suppliers s WHERE s.organization_id=NEW.organization_id AND s.id=NEW.supplier_id AND s.nip=NEW.identifier) THEN
     RAISE EXCEPTION 'Bound supplier lookup required' USING ERRCODE='42501'; END IF;
 ELSIF TG_TABLE_NAME='mgbi_source_archives' THEN
   IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['payload_json','payload_sha256','payload_jsonb_sha256','record_count','last_checked_at','source_request_id'])
     IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['payload_json','payload_sha256','payload_jsonb_sha256','record_count','last_checked_at','source_request_id']) THEN
     RAISE EXCEPTION 'Archive identity is immutable' USING ERRCODE='42501'; END IF;
   nip:=NEW.nip; lookup_id:=NEW.source_request_id;
   phases:=CASE NEW.model WHEN 'pl-krs-wp-record' THEN ARRAY['STORE_GENERAL'] WHEN 'pl-krs-rdf-record' THEN ARRAY['STORE_FINANCIAL'] ELSE ARRAY[]::text[] END;
 ELSE
   IF TG_TABLE_NAME='provider_attempts' THEN lookup_id:=NEW.request_id; section:=NEW.section;
     IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','completed_at','correlation_id','provider_record_id','error_code'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','completed_at','correlation_id','provider_record_id','error_code']) THEN
       RAISE EXCEPTION 'Attempt identity is immutable' USING ERRCODE='42501'; END IF;
   ELSIF TG_TABLE_NAME='source_snapshots' THEN
     SELECT a.request_id INTO lookup_id FROM srm.provider_attempts a WHERE a.organization_id=NEW.organization_id AND a.id=NEW.attempt_id AND a.section=NEW.section;
     section:=NEW.section;
     IF TG_OP<>'INSERT' OR NEW.data_class IS DISTINCT FROM (CASE section WHEN 'general' THEN 'COMPANY' WHEN 'financial' THEN 'FINANCIAL' END)
       OR NOT EXISTS(SELECT 1 FROM srm.lookup_requests l WHERE l.organization_id=NEW.organization_id AND l.id=lookup_id AND l.supplier_id=NEW.supplier_id) THEN
       RAISE EXCEPTION 'Bound corporate snapshot required' USING ERRCODE='42501'; END IF;
   ELSE
     SELECT a.request_id,s.section INTO lookup_id,section FROM srm.source_snapshots s JOIN srm.provider_attempts a
       ON a.organization_id=s.organization_id AND a.id=s.attempt_id
       WHERE s.organization_id=NEW.organization_id AND s.id=NEW.snapshot_id AND s.supplier_id=NEW.supplier_id;
     IF TG_OP<>'INSERT' OR (TG_TABLE_NAME='financial_facts' AND section<>'financial')
       OR (TG_TABLE_NAME='section_projections' AND to_jsonb(NEW)->>'section' IS DISTINCT FROM section) THEN
       RAISE EXCEPTION 'Bound corporate projection required' USING ERRCODE='42501'; END IF;
   END IF;
   SELECT l.identifier INTO nip FROM srm.lookup_requests l WHERE l.organization_id=NEW.organization_id AND l.id=lookup_id;
   phases:=CASE section WHEN 'general' THEN ARRAY['STORE_GENERAL'] WHEN 'financial' THEN ARRAY['STORE_FINANCIAL'] ELSE ARRAY[]::text[] END;
 END IF;
 IF (TG_TABLE_NAME<>'suppliers' AND lookup_id IS NULL) OR srm.supplier_business_phase(NEW.organization_id,nip,lookup_id,phases) IS NOT TRUE THEN
   RAISE EXCEPTION 'Current private supplier phase required' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $fn$;

CREATE TRIGGER private_cache_purpose BEFORE INSERT OR UPDATE OR DELETE ON srm.catalog_kys_reports
 FOR EACH ROW EXECUTE FUNCTION srm.guard_supplier_business_write();
CREATE POLICY sensitive_cache_read ON srm.catalog_kys_reports FOR SELECT TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.sensitive_cache_scope(organization_id,nip,entity_type,retrieved_at,retention_until,'READ') END);
CREATE POLICY sensitive_cache_insert ON srm.catalog_kys_reports FOR INSERT TO PUBLIC WITH CHECK(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.sensitive_cache_scope(organization_id,nip,entity_type,retrieved_at,retention_until,'WRITE') END);
CREATE POLICY sensitive_cache_update ON srm.catalog_kys_reports FOR UPDATE TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.sensitive_cache_scope(organization_id,nip,entity_type,retrieved_at,retention_until,'WRITE') END) WITH CHECK(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.sensitive_cache_scope(organization_id,nip,entity_type,retrieved_at,retention_until,'WRITE') END);
CREATE POLICY sensitive_cache_fence ON srm.catalog_kys_reports AS RESTRICTIVE TO PUBLIC USING(
 current_user='profitia_access_owner' OR srm.sensitive_cache_scope(organization_id,nip,entity_type,retrieved_at,retention_until,'READ')) WITH CHECK(
 current_user<>'profitia_access_owner' AND srm.sensitive_cache_scope(organization_id,nip,entity_type,retrieved_at,retention_until,'WRITE'));
-- Explicit retention DELETE admission; the existing restrictive corporate fence
-- also calls the extended native row function, and every trigger checks expiry.
CREATE POLICY sensitive_retention_delete ON srm.source_snapshots FOR DELETE TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.sensitive_supplier_row('source_snapshots',organization_id,id,attempt_id,supplier_id,NULL,section,'DELETE') END);
CREATE POLICY sensitive_retention_delete ON srm.section_projections FOR DELETE TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.sensitive_supplier_row('section_projections',organization_id,id,snapshot_id,supplier_id,NULL,section,'DELETE') END);
-- The earlier inspection fence intentionally refuses every other deletion.
-- Extend that exact fence only for the new current retention purpose; adding a
-- permissive DELETE policy alone cannot override a restrictive policy.
DO $retention$ DECLARE item record;previous text;predicate text;BEGIN
 FOR item IN SELECT * FROM(VALUES('source_snapshots','attempt_id'),('section_projections','snapshot_id'))v(table_name,related) LOOP
  SELECT qual INTO previous FROM pg_policies WHERE schemaname='srm' AND tablename=item.table_name AND policyname='inspected_delete_fence';
  IF previous IS NULL THEN RAISE EXCEPTION 'Existing inspection DELETE fence required' USING ERRCODE='42501';END IF;
  predicate:=format('srm.sensitive_supplier_row(%L,organization_id,id,%I,supplier_id,NULL,section,''DELETE'')',item.table_name,item.related);
  EXECUTE format('ALTER POLICY inspected_delete_fence ON srm.%I USING((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item.table_name,previous,predicate);
 END LOOP;
END $retention$;
REVOKE ALL ON srm.supplier_sensitive_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.sensitive_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text),
 srm.sensitive_cache_scope(uuid,text,text,timestamptz,timestamptz,text),srm.guard_sensitive_supplier_write(text,text,jsonb,jsonb) FROM PUBLIC;

-- One canonical INTENT is the current operation receipt; no second audit writer
-- or copied permission engine. Shared/financial intents cannot read private PII.
CREATE FUNCTION srm.sensitive_installation_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.supplier_sensitive_installation%ROWTYPE;BEGIN
 d:=profitia_access.runtime_descriptor();
 IF d IS NULL OR d->>'applicationId'<>'srm' OR has_schema_privilege(session_user,'srm','CREATE')
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_sensitive_installation'::regclass
   AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
  OR has_table_privilege(session_user,'srm.supplier_sensitive_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'srm.supplier_sensitive_installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.supplier_sensitive_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('sensitiveSchemaVersion',i.schema_version,'sensitiveBoundaryDigest',i.boundary_digest,'sensitiveSourceRef',i.source_ref);
END $fn$;

CREATE FUNCTION srm.sensitive_human_snapshot(p_org uuid,p_snapshot uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;uid uuid;BEGIN
 d:=srm.sensitive_installation_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF d IS NULL OR uid IS NULL OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM profitia_access.security_events e
  WHERE e.application_id='srm' AND e.environment=d->>'environment' AND e.phase='INTENT'
   AND e.event->>'decision'='ALLOW' AND e.event->>'actorKind'='HUMAN'
   AND e.event->>'actorId'=uid::text AND e.event->>'subjectUserId'=uid::text
   AND e.event->>'organisationId'=p_org::text AND e.event->>'ownerOrganisationId'=p_org::text
   AND e.event->>'dataClass'='ORGANISATION_PRIVATE' AND e.event->>'resourceVersion'=p_snapshot::text
   AND e.event->>'policyVersion'='access-v1:'||(d->>'revision')
   AND e.event->'moduleEvidence'->>'moduleId'='supplier_report'
   AND e.event->'moduleEvidence'->>'transactionId'=txid_current()::text
   AND(e.event->'moduleEvidence'->>'expiresAt')::timestamptz>clock_timestamp()
   AND(e.event->>'operation',e.event->>'resourceType',e.event->>'effect') IN(
    ('supplier.private.read','supplier_private_report','READ'),('supplier.private.reveal','supplier_private_identifier','READ'),
    ('supplier.private.export','supplier_private_export','EXPORT')))
  AND EXISTS(SELECT 1 FROM srm.source_snapshots v WHERE v.organization_id=p_org AND v.id=p_snapshot
   AND v.data_class IN('KYS_PERSONAL','JDG_REGISTRY') AND v.retention_until>clock_timestamp());
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RETURN false;
END $fn$;

-- Metadata has no personal report fields. The common executor authorizes the
-- exact selected resource before a payload SELECT can pass the INTENT fence.
CREATE FUNCTION srm.private_supplier_metadata(p_org uuid,p_nip text,p_entity text,p_section text,p_snapshot uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;uid uuid;result jsonb;BEGIN
 d:=srm.sensitive_installation_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF d IS NULL OR uid IS NULL OR p_section NOT IN('kys','jdg')
  OR(p_snapshot IS NULL AND(coalesce(p_nip,'')!~'^[0-9]{10}$' OR p_entity IS NULL OR p_entity NOT IN('COMPANY','JDG')))
  OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('snapshotId',v.id,'ownerOrganisationId',v.organization_id,'nip',l.identifier,'entityType',l.entity_type,
  'section',v.section,'dataClass',v.data_class,'retrievedAt',v.retrieved_at,'retentionUntil',v.retention_until,
  'projectionVersion',p.projection_version,'sourceRecordId',v.source_record_id)
 INTO result FROM srm.source_snapshots v JOIN srm.provider_attempts a ON a.organization_id=v.organization_id AND a.id=v.attempt_id
 JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id AND l.supplier_id=v.supplier_id
 JOIN srm.section_projections p ON p.organization_id=v.organization_id AND p.snapshot_id=v.id AND p.supplier_id=v.supplier_id AND p.section=v.section
 WHERE v.organization_id=p_org AND v.section=p_section AND p.private_envelope IS NOT NULL
  AND(v.data_class='KYS_PERSONAL' AND p_section='kys' OR v.data_class='JDG_REGISTRY' AND p_section='jdg')
  AND(p_snapshot IS NULL OR v.id=p_snapshot) AND(p_nip IS NULL OR l.identifier=p_nip) AND(p_entity IS NULL OR l.entity_type=p_entity)
 ORDER BY l.requested_at DESC,a.started_at DESC,p.projection_version DESC LIMIT 1;
 RETURN result;
END $fn$;

CREATE FUNCTION srm.private_jdg_activity_metadata(p_org uuid,p_nip text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;uid uuid;result jsonb;BEGIN
 d:=srm.sensitive_installation_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 -- Current delegated eligibility work may inspect status before registering a
 -- lookup. Human private PDF uses the same minimal original JDG projection.
 IF d IS NULL THEN
  d:=srm.current_supplier_work(p_org,NULL,p_nip);
  IF d IS NULL OR d->>'sensitiveWork' IS DISTINCT FROM 'true' OR d->>'unitId'<>'SRM_SENSITIVE_STATUS' THEN RETURN NULL;END IF;
 ELSIF uid IS NULL OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('entries',(SELECT jsonb_agg(jsonb_build_object('status',e->>'status','fields',
  (SELECT coalesce(jsonb_agg(f),'[]'::jsonb) FROM jsonb_array_elements(e->'fields')f WHERE f->>'key'='dataWykreslenia')))
  FROM jsonb_array_elements(p.data_json->'entries')e)) INTO result
 FROM srm.suppliers z JOIN srm.section_projections p ON p.organization_id=z.organization_id AND p.supplier_id=z.id
 JOIN srm.source_snapshots v ON v.organization_id=p.organization_id AND v.id=p.snapshot_id
 WHERE z.organization_id=p_org AND z.nip=p_nip AND p.section='jdg' AND v.retention_until>clock_timestamp()
 ORDER BY p.created_at DESC,p.projection_version DESC LIMIT 1;
 RETURN result;
END $fn$;

CREATE POLICY sensitive_payload_read ON srm.source_snapshots AS RESTRICTIVE FOR SELECT TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN true ELSE section NOT IN('kys','jdg') OR srm.sensitive_human_snapshot(organization_id,id)
 OR srm.sensitive_supplier_row('source_snapshots',organization_id,id,attempt_id,supplier_id,NULL,section,'READ') END);
CREATE POLICY sensitive_payload_read ON srm.section_projections AS RESTRICTIVE FOR SELECT TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN true ELSE section NOT IN('kys','jdg') OR srm.sensitive_human_snapshot(organization_id,snapshot_id)
 OR srm.sensitive_supplier_row('section_projections',organization_id,id,snapshot_id,supplier_id,NULL,section,'READ') END);
REVOKE ALL ON FUNCTION srm.sensitive_installation_descriptor(),srm.sensitive_human_snapshot(uuid,uuid),
 srm.private_supplier_metadata(uuid,text,text,text,uuid),srm.private_jdg_activity_metadata(uuid,text) FROM PUBLIC;
