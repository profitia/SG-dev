-- Explicit private acquisition on the existing SRM command/native Work path.
-- Atomic controlled installation only; no runtime ACL, grant or activation.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR EXISTS(SELECT 1 FROM profitia_access.applications WHERE status<>'DISABLED')
  OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='srm' AND status='DISABLED')
  OR NOT EXISTS(SELECT 1 FROM profitia_requests.operation_installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94')
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_sensitive_installation WHERE singleton AND schema_version='1.0.0' AND boundary_digest='b42f494e69d7380b80af59d7a17018ca7abdd62fd83b2ca57884d263de4140e1') THEN
  RAISE EXCEPTION 'Controlled disabled private SRM and exact accepted installations required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.supplier_private_acquisition_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.supplier_private_acquisition_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_private_acquisition_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.supplier_private_acquisition_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY controlled_fence ON srm.supplier_private_acquisition_installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.supplier_private_acquisition_installation
 FOR EACH ROW EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.supplier_private_acquisition_installation
 FOR EACH STATEMENT EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
DO $constraint$ DECLARE n integer:=0;c record;a smallint;b smallint;BEGIN
 SELECT attnum INTO a FROM pg_attribute WHERE attrelid='profitia_supplier_requests.commands'::regclass AND attname='resource_id';
 SELECT attnum INTO b FROM pg_attribute WHERE attrelid='profitia_supplier_requests.commands'::regclass AND attname='payload_digest';
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='profitia_supplier_requests.commands'::regclass AND contype='c'
  AND cardinality(conkey)=2 AND conkey @> ARRAY[a,b]::smallint[] LOOP
  n:=n+1;EXECUTE format('ALTER TABLE profitia_supplier_requests.commands DROP CONSTRAINT %I',c.conname);
 END LOOP;
 IF n<>1 THEN RAISE EXCEPTION 'Exact existing resource/digest constraint required';END IF;
END $constraint$;
ALTER TABLE profitia_supplier_requests.commands ADD CONSTRAINT explicit_request_target CHECK(
 resource_id='supplier-request:'||payload_digest OR
 resource_id IN('supplier-private-request:COMPANY:kys:'||payload_digest,
 'supplier-private-request:JDG:kys:'||payload_digest,'supplier-private-request:JDG:jdg:'||payload_digest));
ALTER TABLE profitia_supplier_requests.commands ADD COLUMN request_operation text GENERATED ALWAYS AS
 (CASE WHEN resource_id='supplier-request:'||payload_digest THEN 'supplier.report.refresh' ELSE 'supplier.private.refresh' END) STORED NOT NULL;
ALTER POLICY command_read ON profitia_supplier_requests.commands USING(application_id='srm'
 AND application_id=profitia_access.runtime_descriptor()->>'applicationId' AND environment=profitia_access.runtime_descriptor()->>'environment'
 AND profitia_requests.scope_allows(request_operation,organisation_id,user_id,resource_id));
DO $fence$ DECLARE previous text;BEGIN
 SELECT qual INTO previous FROM pg_policies WHERE schemaname='profitia_supplier_requests' AND tablename='commands' AND policyname='command_read_fence';
 IF previous IS NULL OR position('supplier.report.refresh' IN previous)=0 THEN RAISE EXCEPTION 'Existing command read fence required';END IF;
 EXECUTE format('ALTER POLICY command_read_fence ON profitia_supplier_requests.commands USING(%s)',replace(previous,quote_literal('supplier.report.refresh')||'::text','request_operation'));
END $fence$;
ALTER POLICY command_insert ON profitia_supplier_requests.commands WITH CHECK(application_id='srm'
 AND application_id=profitia_access.runtime_descriptor()->>'applicationId' AND environment=profitia_access.runtime_descriptor()->>'environment'
 AND profitia_requests.scope_allows(request_operation,organisation_id,user_id,resource_id));
ALTER POLICY command_insert_fence ON profitia_supplier_requests.commands WITH CHECK(application_id='srm'
 AND application_id=profitia_access.runtime_descriptor()->>'applicationId' AND environment=profitia_access.runtime_descriptor()->>'environment'
 AND profitia_requests.scope_allows(request_operation,organisation_id,user_id,resource_id)
 AND EXISTS(SELECT 1 FROM profitia_requests.intents i WHERE i.request_id=commands.request_id AND i.application_id=commands.application_id
 AND i.operation=commands.request_operation AND i.environment=commands.environment AND i.organisation_id=commands.organisation_id
 AND i.user_id=commands.user_id AND i.resource_id=commands.resource_id AND i.payload_digest=commands.payload_digest
 AND i.decision_id=commands.decision_id AND i.status='RESERVED'));
CREATE FUNCTION srm.private_acquisition_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.supplier_private_acquisition_installation%ROWTYPE;c profitia_supplier_requests.installation%ROWTYPE;BEGIN
 d:=profitia_requests.operation_runtime_descriptor();
 IF d IS NULL OR d->>'applicationId' IS DISTINCT FROM 'srm' OR d->>'operationSchemaDigest' IS DISTINCT FROM 'a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94'
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_private_acquisition_installation'::regclass
  AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
 OR has_table_privilege(session_user,'srm.supplier_private_acquisition_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 OR has_any_column_privilege(session_user,'srm.supplier_private_acquisition_installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.supplier_private_acquisition_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO c FROM profitia_supplier_requests.installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('privateAcquisitionSchemaVersion',i.schema_version,'privateAcquisitionBoundaryDigest',i.boundary_digest,
 'privateAcquisitionSourceRef',i.source_ref,'commandBoundaryDigest',c.boundary_digest);
END $fn$;
CREATE OR REPLACE FUNCTION srm.current_supplier_work(p_org uuid DEFAULT NULL,p_request uuid DEFAULT NULL,p_nip text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE marker jsonb;d jsonb;c profitia_supplier_requests.commands%ROWTYPE;
 i srm.supplier_work_installation%ROWTYPE;ci profitia_supplier_requests.installation%ROWTYPE;si srm.supplier_sensitive_installation%ROWTYPE;ai srm.supplier_private_acquisition_installation%ROWTYPE;parts text[];BEGIN
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
 IF d->>'operation'='supplier.private.refresh' THEN
  parts:=regexp_match(c.resource_id,'^supplier-private-request:(COMPANY|JDG):(kys|jdg):([a-f0-9]{64})$');
  IF parts IS NULL OR parts[3]<>c.payload_digest OR parts[2]='jdg' AND parts[1]<>'JDG'
   OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_private_acquisition_installation'::regclass
    AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'srm.supplier_private_acquisition_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'srm.supplier_private_acquisition_installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
  SELECT * INTO ai FROM srm.supplier_private_acquisition_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
  IF d->>'operationSchemaDigest' IS DISTINCT FROM 'a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94'
   OR EXISTS(SELECT 1 FROM srm.lookup_requests l WHERE l.id=(d->>'requestId')::uuid AND l.organization_id=(d->>'organisationId')::uuid
    AND l.entity_type IS DISTINCT FROM parts[1])
   OR d->>'unitId' LIKE 'SRM_JDG_%' AND parts[2]<>'jdg'
   OR d->>'unitId' LIKE 'SRM_KYS_%' AND parts[2]<>'kys' THEN RETURN NULL;END IF;
 ELSIF d->>'operation' IS DISTINCT FROM 'supplier.report.refresh' OR c.resource_id<>'supplier-request:'||c.payload_digest THEN RETURN NULL;
 END IF;
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
  IF d->>'operation' IS DISTINCT FROM 'supplier.private.refresh' THEN RETURN NULL;END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_sensitive_installation'::regclass
   AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'srm.supplier_sensitive_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'srm.supplier_sensitive_installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
  SELECT * INTO si FROM srm.supplier_sensitive_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
  RETURN d||jsonb_build_object('nip',c.command_json->>'nip','inputDigest',marker->>2,'commandBoundaryDigest',ci.boundary_digest,
   'workBusinessSchemaVersion',si.schema_version,'workBusinessBoundaryDigest',si.boundary_digest,'workBusinessSourceRef',si.source_ref,
   'sensitiveWork',true,'entityType',parts[1],'section',parts[2],
   'privateAcquisitionSchemaVersion',ai.schema_version,'privateAcquisitionBoundaryDigest',ai.boundary_digest,'privateAcquisitionSourceRef',ai.source_ref);
 END IF;
 IF d->>'operation' IS DISTINCT FROM 'supplier.report.refresh' THEN RETURN NULL;END IF;
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
CREATE OR REPLACE FUNCTION srm.sensitive_supplier_row(p_table text,p_org uuid,p_key uuid,p_related uuid,p_supplier uuid,p_nip text,p_section text,p_mode text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;req uuid;writing boolean:=p_mode IN('WRITE','DELETE');BEGIN
 d:=srm.current_supplier_work(p_org);
 IF d IS NULL OR d->>'sensitiveWork' IS DISTINCT FROM 'true' OR p_org IS NULL OR p_mode IS NULL OR p_mode NOT IN('READ','WRITE','DELETE') THEN RETURN false;END IF;
 IF d->>'section' IS NOT NULL AND p_section IS NOT NULL AND d->>'section' IS DISTINCT FROM p_section THEN RETURN false;END IF;
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
CREATE OR REPLACE FUNCTION srm.sensitive_cache_scope(p_org uuid,p_nip text,p_entity text,p_retrieved timestamptz,p_retention timestamptz,p_mode text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;BEGIN
 d:=srm.current_supplier_work(p_org);
 IF d IS NULL OR d->>'sensitiveWork' IS DISTINCT FROM 'true' OR p_org IS NULL OR p_entity IS NULL OR p_entity NOT IN('COMPANY','JDG') OR p_mode IS NULL OR p_mode NOT IN('READ','WRITE') THEN RETURN false;END IF;
 IF d->>'section' IS NOT NULL AND (d->>'section'<>'kys' OR d->>'entityType' IS DISTINCT FROM p_entity) THEN RETURN false;END IF;
 u:=d->>'unitId';
 IF u='SRM_SENSITIVE_PURGE' THEN RETURN d->>'accessMode'='WRITE' AND p_retention<=clock_timestamp();END IF;
 IF p_nip IS DISTINCT FROM d->>'nip' OR NOT EXISTS(SELECT 1 FROM srm.lookup_requests l WHERE l.organization_id=p_org
  AND l.id=(d->>'requestId')::uuid AND l.identifier=p_nip AND l.entity_type=p_entity) THEN RETURN false;END IF;
 RETURN CASE WHEN p_mode='READ' THEN u IN('SRM_KYS_CACHE_READ','SRM_KYS_CACHE_CLAIM','SRM_KYS_CACHE_SAVE','SRM_KYS_CACHE_HOLD','SRM_KYS_CACHE_RENEW','SRM_KYS_CACHE_RELEASE')
  ELSE d->>'accessMode'='WRITE' AND u IN('SRM_KYS_CACHE_CLAIM','SRM_KYS_CACHE_SAVE','SRM_KYS_CACHE_HOLD','SRM_KYS_CACHE_RENEW','SRM_KYS_CACHE_RELEASE') END;
END $fn$;
CREATE OR REPLACE FUNCTION srm.guard_sensitive_supplier_write(p_table text,p_op text,n jsonb,o jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;v jsonb;org uuid;req uuid;sid uuid;section text;row_snapshot srm.source_snapshots%ROWTYPE;BEGIN
 v:=CASE WHEN p_op='DELETE' THEN o ELSE n END;
 IF v IS NULL OR p_op IS NULL OR p_op NOT IN('INSERT','UPDATE','DELETE') THEN RETURN false;END IF;
 org:=(v->>'organization_id')::uuid;d:=srm.current_supplier_work(org);
 IF d IS NULL OR d->>'sensitiveWork' IS DISTINCT FROM 'true' OR d->>'accessMode'<>'WRITE' THEN RETURN false;END IF;
 IF d->>'section' IS NOT NULL AND v->>'section' IS NOT NULL AND d->>'section' IS DISTINCT FROM v->>'section' THEN RETURN false;END IF;
 IF p_table IN('lookup_requests','catalog_kys_reports') AND d->>'entityType' IS NOT NULL AND d->>'entityType' IS DISTINCT FROM v->>'entity_type' THEN RETURN false;END IF;
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
REVOKE ALL ON srm.supplier_private_acquisition_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.private_acquisition_descriptor() FROM PUBLIC;
