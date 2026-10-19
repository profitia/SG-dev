-- Optional native Supplier SQL work. No runtime ACL, domain copy, source
-- acquisition, effect ledger, identity transfer or cloud activation.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='srm' AND status='DISABLED')
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_inspection_installation WHERE singleton AND schema_version='1.0.0'
   AND boundary_digest='5da7c345e8137ff45e4c14faecbe0a81e9f798b8ec2ed77af821828696c4eb07')
  OR NOT EXISTS(SELECT 1 FROM profitia_request_work.installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='19fb1d9045bccdb3299317b4c5b7df41e361e971c83ab683a55b56d6fbc8e5fe') THEN
  RAISE EXCEPTION 'Controlled disabled SRM and accepted native work installations required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.supplier_work_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.supplier_work_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_work_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.supplier_work_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY controlled_fence ON srm.supplier_work_installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.supplier_work_installation
 FOR EACH ROW EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.supplier_work_installation
 FOR EACH STATEMENT EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();

CREATE FUNCTION srm.current_supplier_work(p_org uuid DEFAULT NULL,p_request uuid DEFAULT NULL,p_nip text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE marker jsonb;d jsonb;c profitia_supplier_requests.commands%ROWTYPE;
 i srm.supplier_work_installation%ROWTYPE;ci profitia_supplier_requests.installation%ROWTYPE;BEGIN
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

CREATE FUNCTION srm.native_supplier_row(p_table text,p_org uuid,p_key uuid,p_related uuid,p_supplier uuid,p_nip text,p_section text,p_mode text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;req uuid;writing boolean:=p_mode='WRITE';BEGIN
 d:=srm.current_supplier_work(p_org);IF d IS NULL OR p_mode IS NULL OR p_mode NOT IN('READ','WRITE','LOCK') THEN RETURN false;END IF;
 u:=d->>'unitId';req:=(d->>'requestId')::uuid;
 IF writing AND d->>'accessMode'<>'WRITE' THEN RETURN false;END IF;
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

CREATE OR REPLACE FUNCTION srm.supplier_business_phase(p_org uuid,p_nip text,p_lookup uuid,p_phases text[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; uid uuid;
BEGIN

 d:=srm.current_supplier_work(p_org,p_lookup,p_nip);
 IF d IS NOT NULL THEN
  RETURN d->>'accessMode'='WRITE' AND CASE
   WHEN d->>'unitId'='SRM_REGISTER_LOOKUP' THEN 'REGISTER_LOOKUP'=ANY(p_phases)
   WHEN d->>'unitId' IN('SRM_STORE_GENERAL','SRM_ARCHIVE_GENERAL') THEN 'STORE_GENERAL'=ANY(p_phases)
   WHEN d->>'unitId' IN('SRM_STORE_FINANCIAL','SRM_ARCHIVE_FINANCIAL','SRM_PREPARE_DOCUMENTS','SRM_MSR_SAVE','SRM_MSR_PROJECT') THEN 'STORE_FINANCIAL'=ANY(p_phases)
   WHEN d->>'unitId'='SRM_RECORD_INTEREST' THEN 'RECORD_INTEREST'=ANY(p_phases) ELSE false END;
 END IF;

 IF profitia_services.runtime_descriptor() IS NOT NULL THEN RETURN srm.current_delegated_supplier(p_org,p_lookup,p_nip,p_phases) IS NOT NULL;END IF;

 d:=srm.supplier_business_descriptor(); uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF d IS NULL OR uid IS NULL OR p_nip IS NULL OR p_nip!~'^[0-9]{10}$'
   OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE THEN RETURN false; END IF;
 RETURN EXISTS(SELECT 1 FROM profitia_request_phases.effects e
   JOIN profitia_supplier_requests.commands c ON c.request_id=e.request_id
   JOIN profitia_request_phases.policies p ON p.application_id=e.application_id AND p.phase_id=e.phase_id
   WHERE e.application_id='srm' AND e.environment=d->>'environment' AND e.organisation_id=p_org AND e.user_id=uid
     AND e.phase_id=ANY(p_phases) AND e.status='RESERVED' AND e.transaction_id=txid_current()
     AND (p_lookup IS NULL OR e.request_id=p_lookup)
     AND p.status='ACTIVE' AND p.version=e.policy_version AND p.expires_at>clock_timestamp()
     AND c.organisation_id=p_org AND c.user_id=uid AND c.command_json->>'nip'=p_nip
     AND profitia_requests.scope_allows('supplier.report.refresh',p_org,uid,e.resource_id));
END $fn$;

CREATE OR REPLACE FUNCTION srm.named_interest_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.named_interest_installation%ROWTYPE;BEGIN

 d:=srm.current_supplier_work();
 IF d IS NOT NULL THEN
  IF d->>'unitId'<>'SRM_RECORD_INTEREST' OR d->>'accessMode'<>'WRITE' THEN RETURN NULL;END IF;
  SELECT * INTO i FROM srm.named_interest_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
  RETURN d||jsonb_build_object('namedSchemaVersion',i.schema_version,'namedBoundaryDigest',i.boundary_digest,'namedSourceRef',i.source_ref);
 END IF;

 IF profitia_services.runtime_descriptor() IS NOT NULL THEN
  d:=srm.current_delegated_supplier();IF d IS NULL THEN RETURN NULL;END IF;
  SELECT * INTO i FROM srm.named_interest_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
  RETURN d||jsonb_build_object('namedSchemaVersion',i.schema_version,'namedBoundaryDigest',i.boundary_digest,'namedSourceRef',i.source_ref);END IF;

 d:=srm.supplier_business_descriptor();
 IF d IS NULL OR d->>'applicationId'<>'srm' OR NOT EXISTS(SELECT 1 FROM pg_class
   WHERE oid='srm.named_interest_installation'::regclass AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'srm.named_interest_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'srm.named_interest_installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.named_interest_installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('namedSchemaVersion',i.schema_version,'namedBoundaryDigest',i.boundary_digest,'namedSourceRef',i.source_ref);
END $fn$;

CREATE OR REPLACE FUNCTION srm.named_interest_actor(p_org uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE native jsonb; uid uuid;BEGIN

 native:=srm.current_supplier_work(p_org);
 IF native IS NOT NULL THEN
  IF native->>'unitId'='SRM_RECORD_INTEREST' AND native->>'accessMode'='WRITE' THEN RETURN (native->>'subjectUserId')::uuid;END IF;
  RETURN NULL;
 END IF;

 IF profitia_services.runtime_descriptor() IS NOT NULL THEN RETURN (srm.current_delegated_supplier(p_org,NULL,NULL,ARRAY['RECORD_INTEREST'])->>'subjectUserId')::uuid;END IF;

 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF uid IS NULL OR srm.named_interest_descriptor() IS NULL
   OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE THEN RETURN NULL;END IF;
 RETURN uid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;

CREATE OR REPLACE FUNCTION srm.named_interest_phase(p_org uuid,p_nip text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE native jsonb; uid uuid;r record;n integer:=0;BEGIN

 native:=srm.current_supplier_work(p_org,NULL,p_nip);
 IF native IS NOT NULL THEN RETURN native->>'unitId'='SRM_RECORD_INTEREST' AND native->>'accessMode'='WRITE';END IF;

 uid:=srm.named_interest_actor(p_org);IF uid IS NULL THEN RETURN false;END IF;
 FOR r IN SELECT e.request_id,c.command_json->>'nip' AS nip FROM profitia_request_phases.effects e
   JOIN profitia_supplier_requests.commands c ON c.request_id=e.request_id
   WHERE e.application_id='srm' AND e.organisation_id=p_org AND e.user_id=uid
     AND e.phase_id='RECORD_INTEREST' AND e.status='RESERVED' AND e.transaction_id=txid_current()
     AND c.organisation_id=p_org AND c.user_id=uid LOOP
  n:=n+1;
  IF n>1 OR p_nip IS NOT NULL AND p_nip IS DISTINCT FROM r.nip
    OR srm.supplier_business_phase(p_org,r.nip,r.request_id,ARRAY['RECORD_INTEREST']) IS NOT TRUE THEN RETURN false;END IF;
 END LOOP;
 RETURN n=1;
END $fn$;

-- Preserve existing HUMAN, once-only phase and committed inspection policies.
-- Native SELECT/INSERT/UPDATE admission is explicit; no native DELETE exists.
DO $rls$ DECLARE item record;rd text;wr text;update_visibility text;old_using text;old_check text;private_using text;private_check text;BEGIN
 FOR item IN SELECT * FROM(VALUES
  ('organizations','id','id','NULL::uuid','NULL::uuid','NULL::text','NULL::text'),
  ('suppliers','organization_id','id','NULL::uuid','NULL::uuid','nip','NULL::text'),
  ('lookup_requests','organization_id','id','NULL::uuid','supplier_id','identifier','NULL::text'),
  ('provider_attempts','organization_id','id','request_id','NULL::uuid','NULL::text','section'),
  ('source_snapshots','organization_id','id','attempt_id','supplier_id','NULL::text','section'),
  ('section_projections','organization_id','id','snapshot_id','supplier_id','NULL::text','section'),
  ('financial_facts','organization_id','NULL::uuid','snapshot_id','supplier_id','NULL::text',$s$'financial'$s$),
  ('mgbi_source_archives','organization_id','NULL::uuid','NULL::uuid','NULL::uuid','nip','CASE model WHEN ''pl-krs-wp-record'' THEN ''general'' WHEN ''pl-krs-rdf-record'' THEN ''financial'' ELSE NULL END'),
  ('financial_source_documents','organization_id','NULL::uuid','NULL::uuid','NULL::uuid','nip',$s$'financial'$s$),
  ('msr_sources','organization_id','NULL::uuid','NULL::uuid','NULL::uuid','nip',$s$'financial'$s$),
  ('msr_projections','organization_id','NULL::uuid','NULL::uuid','NULL::uuid','nip',$s$'financial'$s$)
 )v(table_name,org,row_key,related,supplier,nip,section) LOOP
  rd:=format('srm.native_supplier_row(%L,%I,%s,%s,%s,%s,%s,''READ'')',item.table_name,item.org,item.row_key,item.related,item.supplier,item.nip,item.section);
  wr:=format('srm.native_supplier_row(%L,%I,%s,%s,%s,%s,%s,''WRITE'')',item.table_name,item.org,item.row_key,item.related,item.supplier,item.nip,item.section);
  update_visibility:=wr;
  IF item.table_name='mgbi_source_archives' THEN
   update_visibility:=format('(%s) OR srm.native_supplier_row(%L,%I,%s,%s,%s,%s,%s,''LOCK'')',wr,item.table_name,item.org,item.row_key,item.related,item.supplier,item.nip,item.section);
  END IF;
  EXECUTE format('CREATE POLICY native_work_read ON srm.%I FOR SELECT TO PUBLIC USING(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item.table_name,rd);
  EXECUTE format('CREATE POLICY native_work_insert ON srm.%I FOR INSERT TO PUBLIC WITH CHECK(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item.table_name,wr);
  EXECUTE format('CREATE POLICY native_work_update ON srm.%I FOR UPDATE TO PUBLIC USING(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END) WITH CHECK(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item.table_name,update_visibility,wr);
  SELECT qual,with_check INTO old_using,old_check FROM pg_policies WHERE schemaname='srm' AND tablename=item.table_name AND policyname='private_operation_fence';
  IF old_using IS NULL OR old_check IS NULL THEN RAISE EXCEPTION 'Existing private fence required';END IF;
  private_using:=old_using;private_check:=old_check;
  EXECUTE format('ALTER POLICY private_operation_fence ON srm.%I USING((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END) WITH CHECK((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item.table_name,old_using,rd,old_check,wr);
  SELECT qual,with_check INTO old_using,old_check FROM pg_policies WHERE schemaname='srm' AND tablename=item.table_name AND policyname='inspected_update_fence';
  IF FOUND THEN EXECUTE format('ALTER POLICY inspected_update_fence ON srm.%I USING((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END) WITH CHECK((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item.table_name,old_using,update_visibility,old_check,wr);END IF;
  IF item.table_name IN('msr_sources','msr_projections') THEN
   EXECUTE format('CREATE POLICY native_controlled_read ON srm.%I FOR SELECT TO profitia_access_owner USING(true)',item.table_name);
   EXECUTE format('ALTER POLICY private_operation_fence ON srm.%I USING(current_user=''profitia_access_owner'' OR (%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END) WITH CHECK((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item.table_name,private_using,rd,private_check,wr);
  END IF;
 END LOOP;
END $rls$;
CREATE POLICY native_command_read ON profitia_supplier_requests.commands FOR SELECT TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.current_supplier_work(organisation_id,request_id,command_json->>'nip') IS NOT NULL END);
DO $commands$ DECLARE old_using text;BEGIN
 SELECT qual INTO old_using FROM pg_policies WHERE schemaname='profitia_supplier_requests' AND tablename='commands' AND policyname='command_read_fence';
 IF old_using IS NULL THEN RAISE EXCEPTION 'Existing command fence required';END IF;
 EXECUTE format('ALTER POLICY command_read_fence ON profitia_supplier_requests.commands USING((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE srm.current_supplier_work(organisation_id,request_id,command_json->>''nip'') IS NOT NULL END)',old_using);
END $commands$;
DO $named$ DECLARE item text;old_using text;old_check text;native text;BEGIN
 FOREACH item IN ARRAY ARRAY['organization_supplier_interest','user_supplier_interest'] LOOP
  SELECT qual,with_check INTO old_using,old_check FROM pg_policies WHERE schemaname='srm' AND tablename=item AND policyname='delegated_named_target';
  IF old_using IS NULL OR old_check IS NULL THEN RAISE EXCEPTION 'Existing named target fence required';END IF;
  native:='nip=(srm.current_supplier_work(organization_id,NULL,nip)->>''nip'') AND (srm.current_supplier_work(organization_id,NULL,nip)->>''unitId'')=''SRM_RECORD_INTEREST''';
  EXECUTE format('ALTER POLICY delegated_named_target ON srm.%I USING((%s) OR (%s)) WITH CHECK((%s) OR (%s))',item,old_using,native,old_check,native);
 END LOOP;
END $named$;
-- Existing Source publication rights remain unchanged. Private work gets only
-- a SELECT of the approved shared NIP; the old write fences remain authoritative.
DO $shared$ DECLARE item text;old_using text;native text;BEGIN
 FOREACH item IN ARRAY ARRAY['catalog_companies','catalog_financial_facts','catalog_financial_indicators'] LOOP
  native:=format('srm.native_supplier_row(%L,(srm.current_supplier_work()->>''organisationId'')::uuid,NULL,NULL,NULL,nip,NULL,''READ'')',item);
  EXECUTE format('CREATE POLICY native_shared_read ON srm.%I FOR SELECT TO PUBLIC USING(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item,native);
  SELECT qual INTO old_using FROM pg_policies WHERE schemaname='srm' AND tablename=item AND policyname='private_shared_fence';
  IF old_using IS NULL THEN RAISE EXCEPTION 'Existing shared fence required';END IF;
  EXECUTE format('ALTER POLICY private_shared_fence ON srm.%I USING((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE %s END)',item,old_using,native);
 END LOOP;
END $shared$;
REVOKE ALL ON srm.supplier_work_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.current_supplier_work(uuid,uuid,text),srm.native_supplier_row(text,uuid,uuid,uuid,uuid,text,text,text) FROM PUBLIC;
