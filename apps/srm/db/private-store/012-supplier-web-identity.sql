-- Optional private website association on the original cache and native work.
-- Controlled atomic installation only; never applies itself or creates grants.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR EXISTS(SELECT 1 FROM profitia_access.applications WHERE status<>'DISABLED')
  OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='srm' AND status='DISABLED')
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_private_acquisition_installation WHERE singleton AND schema_version='1.0.0'
   AND boundary_digest='1b1eceb75501c536386ab1f2bec2ad39d965d3fdf25ca62eefa616138c6a867c') THEN
  RAISE EXCEPTION 'Controlled disabled exact SRM private acquisition installation required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='srm' AND tablename='supplier_web_identity' AND policyname='private_unadopted_fence'
  AND permissive='RESTRICTIVE' AND qual='false' AND with_check='false') THEN
  RAISE EXCEPTION 'Unadopted private website cache required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.supplier_web_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.supplier_web_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_web_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.supplier_web_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY controlled_fence ON srm.supplier_web_installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.supplier_web_installation
 FOR EACH ROW EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.supplier_web_installation
 FOR EACH STATEMENT EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
ALTER TABLE srm.supplier_web_identity ADD COLUMN result_version uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE profitia_supplier_requests.commands DROP CONSTRAINT explicit_request_target;
ALTER TABLE profitia_supplier_requests.commands ADD CONSTRAINT explicit_request_target CHECK(
 resource_id='supplier-request:'||payload_digest OR resource_id IN('supplier-private-request:COMPANY:kys:'||payload_digest,
 'supplier-private-request:JDG:kys:'||payload_digest,'supplier-private-request:JDG:jdg:'||payload_digest,
 'supplier-private-request:COMPANY:web:'||payload_digest,'supplier-private-request:JDG:web:'||payload_digest));
CREATE FUNCTION srm.web_installation_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;a jsonb;i srm.supplier_web_installation%ROWTYPE;BEGIN
 d:=srm.private_acquisition_descriptor();a:=profitia_access.runtime_descriptor();
 IF d IS NULL OR a IS NULL OR a->>'applicationId' IS DISTINCT FROM d->>'applicationId' OR a->>'environment' IS DISTINCT FROM d->>'environment'
 OR a->>'revision' IS NULL OR has_schema_privilege(session_user,'srm','CREATE') OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_web_installation'::regclass
  AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
 OR has_table_privilege(session_user,'srm.supplier_web_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 OR has_any_column_privilege(session_user,'srm.supplier_web_installation','SELECT,INSERT,UPDATE,REFERENCES')
 OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_web_identity'::regclass AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
 OR has_table_privilege(session_user,'srm.supplier_web_identity','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
 OR has_any_column_privilege(session_user,'srm.supplier_web_identity','INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.supplier_web_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('revision',a->>'revision','webSchemaVersion',i.schema_version,'webBoundaryDigest',i.boundary_digest,'webSourceRef',i.source_ref);
END $fn$;
CREATE OR REPLACE FUNCTION srm.current_supplier_work(p_org uuid DEFAULT NULL,p_request uuid DEFAULT NULL,p_nip text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE marker jsonb;d jsonb;c profitia_supplier_requests.commands%ROWTYPE;
 i srm.supplier_work_installation%ROWTYPE;ci profitia_supplier_requests.installation%ROWTYPE;si srm.supplier_sensitive_installation%ROWTYPE;ai srm.supplier_private_acquisition_installation%ROWTYPE;wi srm.supplier_web_installation%ROWTYPE;parts text[];BEGIN
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
 IF d->>'operation'='supplier.private.refresh' AND c.resource_id~'^supplier-private-request:(COMPANY|JDG):web:[a-f0-9]{64}$' THEN
  parts:=regexp_match(c.resource_id,'^supplier-private-request:(COMPANY|JDG):web:([a-f0-9]{64})$');
  IF parts IS NULL OR parts[2]<>c.payload_digest OR d->>'operationSchemaDigest' IS DISTINCT FROM 'a0bd21a268e41f8a41befad777f7717fb3014fb851ff42cdb290004f93a98f94'
   OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_web_installation'::regclass
    AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'srm.supplier_web_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'srm.supplier_web_installation','SELECT,INSERT,UPDATE,REFERENCES')
   OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_web_identity'::regclass AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'srm.supplier_web_identity','DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.supplier_private_acquisition_installation'::regclass
    AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'srm.supplier_private_acquisition_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'srm.supplier_private_acquisition_installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
  SELECT * INTO wi FROM srm.supplier_web_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
  SELECT * INTO ai FROM srm.supplier_private_acquisition_installation WHERE singleton;IF NOT FOUND THEN RETURN NULL;END IF;
  IF NOT EXISTS(SELECT 1 FROM(VALUES('SRM_WEB_SUBJECT_READ','READ'),('SRM_WEB_CLAIM','WRITE'),('SRM_WEB_SAVE','WRITE'))v(unit,mode)
   WHERE v.unit=d->>'unitId' AND v.mode=d->>'accessMode') THEN RETURN NULL;END IF;
  RETURN d||jsonb_build_object('nip',c.command_json->>'nip','inputDigest',marker->>2,'commandBoundaryDigest',ci.boundary_digest,
   'workBusinessSchemaVersion',wi.schema_version,'workBusinessBoundaryDigest',wi.boundary_digest,'workBusinessSourceRef',wi.source_ref,
   'webWork',true,'entityType',parts[1],'section','web','webSchemaVersion',wi.schema_version,'webBoundaryDigest',wi.boundary_digest,
   'privateAcquisitionSchemaVersion',ai.schema_version,'privateAcquisitionBoundaryDigest',ai.boundary_digest,'privateAcquisitionSourceRef',ai.source_ref);
 END IF;
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

-- Retained subject reads only. They cannot change or acquire a registry report.
CREATE FUNCTION srm.web_subject_row(p_table text,p_org uuid,p_key uuid,p_related uuid,p_nip text,p_section text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 d:=srm.current_supplier_work(p_org);
 IF d IS NULL OR d->>'webWork' IS DISTINCT FROM 'true' THEN RETURN false;END IF;
 IF p_table='organizations' THEN RETURN p_key=p_org;END IF;
 IF d->>'unitId'<>'SRM_WEB_SUBJECT_READ' OR d->>'accessMode'<>'READ' THEN RETURN false;END IF;
 IF p_table='suppliers' THEN RETURN p_nip=d->>'nip';
 ELSIF p_table='catalog_companies' THEN RETURN d->>'entityType'='COMPANY' AND p_nip=d->>'nip';
 ELSIF p_table='organization_supplier_interest' THEN RETURN d->>'entityType'='COMPANY' AND p_nip=d->>'nip';
 ELSIF p_table='mgbi_source_archives' THEN RETURN d->>'entityType'='COMPANY' AND p_nip=d->>'nip' AND p_section='general';
 ELSIF d->>'entityType'<>'JDG' THEN RETURN false;
 ELSIF p_table='lookup_requests' THEN RETURN p_nip=d->>'nip' AND EXISTS(SELECT 1 FROM srm.lookup_requests l
  WHERE l.organization_id=p_org AND l.id=p_key AND l.identifier=d->>'nip' AND l.entity_type='JDG');
 ELSIF p_table='source_snapshots' THEN RETURN p_section='jdg' AND EXISTS(SELECT 1 FROM srm.source_snapshots v
  JOIN srm.suppliers z ON z.organization_id=v.organization_id AND z.id=v.supplier_id
  WHERE v.organization_id=p_org AND v.id=p_key AND v.section='jdg' AND v.retention_until>clock_timestamp() AND z.nip=d->>'nip');
 ELSIF p_table='section_projections' THEN RETURN p_section='jdg' AND EXISTS(SELECT 1 FROM srm.source_snapshots v
  JOIN srm.suppliers z ON z.organization_id=v.organization_id AND z.id=v.supplier_id
  WHERE v.organization_id=p_org AND v.id=p_related AND v.section='jdg' AND v.retention_until>clock_timestamp() AND z.nip=d->>'nip');
 END IF;RETURN false;
END $fn$;
CREATE OR REPLACE FUNCTION srm.native_supplier_row(p_table text,p_org uuid,p_key uuid,p_related uuid,p_supplier uuid,p_nip text,p_section text,p_mode text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;u text;req uuid;writing boolean:=p_mode='WRITE';BEGIN
 d:=srm.current_supplier_work(p_org);IF d IS NULL OR p_mode IS NULL OR p_mode NOT IN('READ','WRITE','LOCK') THEN RETURN false;END IF;
 u:=d->>'unitId';req:=(d->>'requestId')::uuid;
 IF writing AND d->>'accessMode'<>'WRITE' THEN RETURN false;END IF;
 IF d->>'webWork'='true' THEN RETURN NOT writing AND p_mode='READ' AND srm.web_subject_row(p_table,p_org,p_key,p_related,p_nip,p_section);END IF;
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


-- Add only SELECT visibility needed by the unchanged subject reader.
CREATE POLICY web_subject_interest ON srm.organization_supplier_interest FOR SELECT TO PUBLIC
 USING(CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.web_subject_row('organization_supplier_interest',organization_id,NULL,NULL,nip,NULL) END);
DO $interest$ DECLARE old text;BEGIN
 SELECT qual INTO old FROM pg_policies WHERE schemaname='srm' AND tablename='organization_supplier_interest' AND policyname='delegated_named_target';
 IF old IS NULL THEN RAISE EXCEPTION 'Existing named-interest fence required';END IF;
 EXECUTE format('ALTER POLICY delegated_named_target ON srm.organization_supplier_interest USING((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE srm.web_subject_row(''organization_supplier_interest'',organization_id,NULL,NULL,nip,NULL) END)',old);
END $interest$;
DO $retained$ DECLARE item record;old text;BEGIN
 FOR item IN SELECT * FROM(VALUES('source_snapshots','id','attempt_id'),('section_projections','id','snapshot_id'))v(t,k,r) LOOP
  SELECT qual INTO old FROM pg_policies WHERE schemaname='srm' AND tablename=item.t AND policyname='sensitive_payload_read';
  IF old IS NULL THEN RAISE EXCEPTION 'Existing sensitive payload fence required';END IF;
  EXECUTE format('ALTER POLICY sensitive_payload_read ON srm.%I USING((%s) OR CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE srm.web_subject_row(%L,organization_id,%I,%I,NULL,section) END)',item.t,old,item.t,item.k,item.r);
 END LOOP;
END $retained$;
CREATE FUNCTION srm.web_human_row(p_org uuid,p_nip text,p_entity text,p_version uuid,p_until timestamptz) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;uid uuid;BEGIN
 d:=srm.web_installation_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF d IS NULL OR uid IS NULL OR p_until<=clock_timestamp() OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM profitia_access.security_events e WHERE e.application_id='srm' AND e.environment=d->>'environment' AND e.phase='INTENT'
  AND e.event->>'decision'='ALLOW' AND e.event->>'actorKind'='HUMAN' AND e.event->>'actorId'=uid::text AND e.event->>'subjectUserId'=uid::text
  AND e.event->>'organisationId'=p_org::text AND e.event->>'ownerOrganisationId'=p_org::text
  AND e.event->>'dataClass'='ORGANISATION_PRIVATE' AND e.event->>'resourceVersion'=p_version::text
  AND e.event->>'resourceId'='supplier-private-web:'||p_entity||':'||p_nip
  AND e.event->>'policyVersion'='access-v1:'||(d->>'revision')
  AND e.event->'moduleEvidence'->>'moduleId'='supplier_report' AND e.event->'moduleEvidence'->>'transactionId'=txid_current()::text
  AND(e.event->'moduleEvidence'->>'expiresAt')::timestamptz>clock_timestamp()
  AND e.event->>'operation'='supplier.private.read' AND e.event->>'resourceType'='supplier_private_report' AND e.event->>'effect'='READ');
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RETURN false;END $fn$;
CREATE FUNCTION srm.web_cache_scope(p_org uuid,p_nip text,p_entity text,p_mode text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 d:=srm.current_supplier_work(p_org,NULL,p_nip);
 IF d IS NULL OR d->>'webWork' IS DISTINCT FROM 'true' OR d->>'entityType' IS DISTINCT FROM p_entity OR p_nip IS DISTINCT FROM d->>'nip' THEN RETURN false;END IF;
 RETURN CASE WHEN p_mode='READ' THEN d->>'unitId' IN('SRM_WEB_CLAIM','SRM_WEB_SAVE')
  WHEN p_mode='WRITE' THEN d->>'accessMode'='WRITE' AND d->>'unitId' IN('SRM_WEB_CLAIM','SRM_WEB_SAVE') ELSE false END;
END $fn$;
DROP POLICY private_unadopted_fence ON srm.supplier_web_identity;
CREATE POLICY web_controlled_read ON srm.supplier_web_identity FOR SELECT TO profitia_access_owner USING(true);
CREATE POLICY web_cache_read ON srm.supplier_web_identity FOR SELECT TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.web_cache_scope(organization_id,nip,entity_type,'READ')
 OR(result_json IS NOT NULL AND srm.web_human_row(organization_id,nip,entity_type,result_version,expires_at)) END);
CREATE POLICY web_cache_insert ON srm.supplier_web_identity FOR INSERT TO PUBLIC WITH CHECK(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.web_cache_scope(organization_id,nip,entity_type,'WRITE') END);
CREATE POLICY web_cache_update ON srm.supplier_web_identity FOR UPDATE TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.web_cache_scope(organization_id,nip,entity_type,'WRITE') END) WITH CHECK(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.web_cache_scope(organization_id,nip,entity_type,'WRITE') END);
CREATE POLICY web_cache_fence ON srm.supplier_web_identity AS RESTRICTIVE TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN true ELSE srm.web_cache_scope(organization_id,nip,entity_type,'READ')
 OR(result_json IS NOT NULL AND srm.web_human_row(organization_id,nip,entity_type,result_version,expires_at)) END) WITH CHECK(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.web_cache_scope(organization_id,nip,entity_type,'WRITE') END);
CREATE POLICY web_no_delete ON srm.supplier_web_identity AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false);
CREATE FUNCTION srm.guard_web_cache_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 d:=srm.current_supplier_work(NEW.organization_id,NULL,NEW.nip);
 IF d IS NULL OR d->>'webWork' IS DISTINCT FROM 'true' OR d->>'entityType' IS DISTINCT FROM NEW.entity_type
  OR srm.web_cache_scope(NEW.organization_id,NEW.nip,NEW.entity_type,'WRITE') IS NOT TRUE
  OR(TG_OP='UPDATE' AND(NEW.organization_id,NEW.nip,NEW.entity_type) IS DISTINCT FROM(OLD.organization_id,OLD.nip,OLD.entity_type)) THEN
  RAISE EXCEPTION 'Current exact website work required' USING ERRCODE='42501';END IF;
 IF d->>'unitId'='SRM_WEB_CLAIM' THEN
  IF NEW.lease_token IS NULL OR NEW.lease_until<=clock_timestamp() OR NEW.lease_until>clock_timestamp()+interval '61 seconds'
   OR(TG_OP='INSERT' AND(NEW.result_json IS NOT NULL OR NEW.checked_at IS NOT NULL))
   OR(TG_OP='UPDATE' AND((NEW.identity_hash=OLD.identity_hash AND NEW.result_json IS DISTINCT FROM OLD.result_json)
    OR(NEW.identity_hash<>OLD.identity_hash AND NEW.result_json IS NOT NULL)
    OR NEW.checked_at IS DISTINCT FROM OLD.checked_at OR NEW.expires_at IS DISTINCT FROM OLD.expires_at)) THEN
   RAISE EXCEPTION 'Only the original bounded cache claim is allowed' USING ERRCODE='42501';END IF;
 ELSIF d->>'unitId'='SRM_WEB_SAVE' THEN
  IF TG_OP<>'UPDATE' OR OLD.lease_token IS NULL OR OLD.lease_until<=clock_timestamp() OR NEW.lease_token IS NOT NULL OR NEW.lease_until IS NOT NULL
   OR NEW.identity_hash<>OLD.identity_hash OR NEW.checked_at IS NULL OR NEW.checked_at>clock_timestamp() OR NEW.checked_at<clock_timestamp()-interval '1 minute'
   OR NEW.expires_at<=clock_timestamp() OR NEW.expires_at>clock_timestamp()+interval '7 days'
   OR jsonb_typeof(NEW.result_json) IS DISTINCT FROM 'object' OR NEW.result_json->>'status' NOT IN('FOUND','NOT_FOUND','UNAVAILABLE') THEN
   RAISE EXCEPTION 'Only the original leased cache result is allowed' USING ERRCODE='42501';END IF;
 ELSE RAISE EXCEPTION 'Website writer purpose required' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.result_json IS DISTINCT FROM OLD.result_json OR NEW.checked_at IS DISTINCT FROM OLD.checked_at THEN NEW.result_version:=gen_random_uuid();
  ELSE NEW.result_version:=OLD.result_version;END IF;
 END IF;RETURN NEW;
END $fn$;
CREATE TRIGGER current_web_write BEFORE INSERT OR UPDATE ON srm.supplier_web_identity FOR EACH ROW EXECUTE FUNCTION srm.guard_web_cache_write();
CREATE FUNCTION srm.private_web_metadata(p_org uuid,p_nip text,p_entity text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;uid uuid;result jsonb;BEGIN
 d:=srm.web_installation_descriptor();uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF d IS NULL OR uid IS NULL OR p_entity NOT IN('COMPANY','JDG') OR coalesce(p_nip,'')!~'^[0-9]{10}$'
  OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('snapshotId',result_version,'ownerOrganisationId',organization_id,'nip',nip,'entityType',entity_type,
  'checkedAt',checked_at,'retentionUntil',expires_at) INTO result FROM srm.supplier_web_identity
  WHERE organization_id=p_org AND nip=p_nip AND entity_type=p_entity AND result_json IS NOT NULL AND expires_at>clock_timestamp();
 RETURN result;
END $fn$;
REVOKE ALL ON srm.supplier_web_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.web_installation_descriptor(),srm.web_subject_row(text,uuid,uuid,uuid,text,text),
 srm.web_human_row(uuid,text,text,uuid,timestamptz),srm.web_cache_scope(uuid,text,text,text),srm.guard_web_cache_write(),srm.private_web_metadata(uuid,text,text) FROM PUBLIC;
