-- Optional adoption of actual delegated Supplier business phases. Original
-- private SQL001--005 and all eighteen product migrations remain unchanged.
-- No role, runtime ACL, account, data copy, provider call or activation.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='srm' AND status='DISABLED')
  OR NOT EXISTS(SELECT 1 FROM srm.supplier_business_installation WHERE singleton AND boundary_digest='1d234a4b271e7647415efea4ea9013d8cab074ed89f2920589f08fe0e6730dcb')
  OR NOT EXISTS(SELECT 1 FROM srm.named_interest_installation WHERE singleton AND boundary_digest='2f7d5a37f7ee23f9aa02974e1f110c3c1aa3a3e2212d37373ee99c766881a4c6')
  OR NOT EXISTS(SELECT 1 FROM profitia_delegated_phases.installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='13f4bb374cbfb31604823083261bbc8f5142e88be7443b704c792a232defb6e3') THEN
  RAISE EXCEPTION 'Controlled disabled private SRM and accepted delegated phase installations required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE TABLE srm.delegated_supplier_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.delegated_supplier_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.delegated_supplier_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.delegated_supplier_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY controlled_fence ON srm.delegated_supplier_installation AS RESTRICTIVE TO PUBLIC
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
CREATE FUNCTION srm.immutable_delegated_supplier_installation() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 RAISE EXCEPTION 'Delegated supplier installation is immutable' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON srm.delegated_supplier_installation FOR EACH ROW EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON srm.delegated_supplier_installation FOR EACH STATEMENT EXECUTE FUNCTION srm.immutable_delegated_supplier_installation();

CREATE FUNCTION srm.delegated_supplier_descriptor(p_request uuid,p_phase text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.delegated_supplier_installation%ROWTYPE;b srm.supplier_business_installation%ROWTYPE;
 c profitia_supplier_requests.installation%ROWTYPE;
BEGIN
 d:=profitia_request_phases.delegated_descriptor(p_request,p_phase);
 IF d IS NULL OR d->>'parentApplicationId' IS DISTINCT FROM 'srm' OR d->>'applicationId' IS NOT DISTINCT FROM 'srm'
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.delegated_supplier_installation'::regclass AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
  OR has_table_privilege(session_user,'srm.delegated_supplier_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  OR has_any_column_privilege(session_user,'srm.delegated_supplier_installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.delegated_supplier_installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO b FROM srm.supplier_business_installation WHERE singleton;
 IF NOT FOUND OR b.boundary_digest<>'1d234a4b271e7647415efea4ea9013d8cab074ed89f2920589f08fe0e6730dcb' THEN RETURN NULL;END IF;
 SELECT * INTO c FROM profitia_supplier_requests.installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_request_phases.effects e JOIN profitia_supplier_requests.commands command ON command.request_id=e.request_id
   WHERE e.request_id=p_request AND e.phase_id=p_phase AND e.application_id='srm' AND e.environment=d->>'environment'
    AND e.organisation_id::text=d->>'organisationId' AND e.user_id::text=d->>'subjectUserId'
    AND command.application_id=e.application_id AND command.environment=e.environment AND command.organisation_id=e.organisation_id
    AND command.user_id=e.user_id AND command.resource_id=e.resource_id AND command.payload_digest=e.payload_digest
    AND profitia_request_phases.delegated_scope_allows(e.request_id,e.phase_id,e.input_digest,e.organisation_id,e.user_id)) THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('businessSchemaVersion',b.schema_version,'businessBoundaryDigest',b.boundary_digest,'businessSourceRef',b.source_ref,
  'commandBoundaryDigest',c.boundary_digest,'delegatedBusinessSchemaVersion',i.schema_version,
  'delegatedBusinessBoundaryDigest',i.boundary_digest,'delegatedBusinessSourceRef',i.source_ref);
END $fn$;

-- Finds exactly one real RESERVED effect of this SQL executor/transaction.
-- Caller values only narrow that scope. No user/module GUC impersonation.
CREATE FUNCTION srm.current_delegated_supplier(p_org uuid DEFAULT NULL,p_request uuid DEFAULT NULL,p_nip text DEFAULT NULL,
 p_phases text[] DEFAULT ARRAY['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST']) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r record;d jsonb;result jsonb;marker jsonb;bound_request uuid;n integer:=0;
BEGIN
 marker:=nullif(current_setting('profitia.job.scope',true),'')::jsonb;
 IF jsonb_typeof(marker) IS DISTINCT FROM 'array' OR jsonb_array_length(marker)<>5
  OR coalesce(marker->>0,'') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN RETURN NULL;END IF;
 bound_request:=(marker->>0)::uuid;
 -- The marker only narrows the PK lookup. Descriptor and canonical phase
 -- scope verify every authority, role, transaction and deadline independently.
 IF p_phases IS NULL OR cardinality(p_phases) NOT BETWEEN 1 AND 4
  OR NOT p_phases <@ ARRAY['REGISTER_LOOKUP','STORE_GENERAL','STORE_FINANCIAL','RECORD_INTEREST'] THEN RETURN NULL;END IF;
 FOR r IN SELECT e.request_id,e.phase_id,e.input_digest,e.organisation_id,e.user_id,c.command_json->>'nip' nip
  FROM profitia_request_phases.effects e JOIN profitia_supplier_requests.commands c ON c.request_id=e.request_id
  WHERE e.request_id=bound_request AND e.executor_role=session_user AND e.transaction_id=txid_current() AND e.status='RESERVED'
   AND e.application_id='srm' AND e.phase_id=ANY(p_phases)
   AND (p_org IS NULL OR e.organisation_id=p_org) AND (p_request IS NULL OR e.request_id=p_request)
   AND (p_nip IS NULL OR c.command_json->>'nip'=p_nip)
   AND c.organisation_id=e.organisation_id AND c.user_id=e.user_id LOOP
  n:=n+1;IF n>1 THEN RETURN NULL;END IF;
  d:=srm.delegated_supplier_descriptor(r.request_id,r.phase_id);IF d IS NULL THEN RETURN NULL;END IF;
  result:=d||jsonb_build_object('nip',r.nip,'inputDigest',r.input_digest);
 END LOOP;
 RETURN result;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END $fn$;

CREATE FUNCTION srm.delegated_supplier_row(p_table text,p_org uuid,p_key uuid,p_related uuid,p_supplier uuid,p_nip text,p_section text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;bound_request uuid;BEGIN
 d:=srm.current_delegated_supplier(p_org);
 IF d IS NULL THEN RETURN false;END IF;bound_request:=(d->>'requestId')::uuid;
 IF p_table='organizations' THEN RETURN p_key=p_org;
 ELSIF p_table='suppliers' THEN RETURN p_nip=d->>'nip';
 ELSIF p_table='lookup_requests' THEN RETURN p_key=bound_request AND p_nip=d->>'nip' AND EXISTS(
  SELECT 1 FROM srm.suppliers s WHERE s.organization_id=p_org AND s.id=p_supplier AND s.nip=p_nip);
 END IF;
 IF p_table NOT IN('provider_attempts','source_snapshots','section_projections','financial_facts','mgbi_source_archives','financial_source_documents')
  OR p_section IS NULL OR p_section NOT IN('general','financial')
  OR d->>'phaseId' IS DISTINCT FROM (CASE p_section WHEN 'general' THEN 'STORE_GENERAL' ELSE 'STORE_FINANCIAL' END) THEN RETURN false;END IF;
 IF p_table='provider_attempts' THEN RETURN p_related=bound_request;
 ELSIF p_table='source_snapshots' THEN RETURN EXISTS(
  SELECT 1 FROM srm.provider_attempts a JOIN srm.lookup_requests l ON l.organization_id=a.organization_id AND l.id=a.request_id
  WHERE a.organization_id=p_org AND a.id=p_related AND a.request_id=bound_request AND a.section=p_section AND l.supplier_id=p_supplier);
 ELSIF p_table IN('section_projections','financial_facts') THEN RETURN EXISTS(
  SELECT 1 FROM srm.source_snapshots snapshot JOIN srm.provider_attempts a ON a.organization_id=snapshot.organization_id AND a.id=snapshot.attempt_id
  WHERE snapshot.organization_id=p_org AND snapshot.id=p_related AND snapshot.supplier_id=p_supplier AND snapshot.section=p_section AND a.request_id=bound_request);
 ELSE RETURN p_nip=d->>'nip';END IF;
END $fn$;

CREATE OR REPLACE FUNCTION srm.supplier_business_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; i srm.supplier_business_installation%ROWTYPE;
BEGIN
 IF profitia_services.runtime_descriptor() IS NOT NULL THEN RETURN srm.current_delegated_supplier();END IF;

 d:=profitia_access.runtime_descriptor();
 IF d->>'applicationId' IS DISTINCT FROM 'srm' OR NOT EXISTS(SELECT 1 FROM pg_class
   WHERE oid='srm.supplier_business_installation'::regclass AND relrowsecurity AND relforcerowsecurity
     AND relowner='profitia_access_owner'::regrole)
   OR has_table_privilege(session_user,'srm.supplier_business_installation','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'srm.supplier_business_installation','INSERT,UPDATE,REFERENCES') THEN RETURN NULL; END IF;
 SELECT * INTO i FROM srm.supplier_business_installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN d||jsonb_build_object('businessSchemaVersion',i.schema_version,'businessBoundaryDigest',i.boundary_digest,'businessSourceRef',i.source_ref);
END $fn$;

CREATE OR REPLACE FUNCTION srm.supplier_business_phase(p_org uuid,p_nip text,p_lookup uuid,p_phases text[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; uid uuid;
BEGIN
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
DECLARE uid uuid;BEGIN
 IF profitia_services.runtime_descriptor() IS NOT NULL THEN RETURN (srm.current_delegated_supplier(p_org,NULL,NULL,ARRAY['RECORD_INTEREST'])->>'subjectUserId')::uuid;END IF;

 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF uid IS NULL OR srm.named_interest_descriptor() IS NULL
   OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE THEN RETURN NULL;END IF;
 RETURN uid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;

-- All nine actual business tables keep FORCE RLS. A NOLOGIN/NOINHERIT owner
-- may read internally for the closed FK/row-scope functions; ordinary logins
-- cannot assume that role. CASE prevents recursive RLS helper evaluation.
-- This adds no owner DML admission and no runtime table/function ACL.
DO $rls$ DECLARE item record;human text;delegated text;lane text;BEGIN
 FOR item IN SELECT * FROM(VALUES
  ('organizations','id','id','NULL::uuid','NULL::uuid','NULL::text','NULL::text'),
  ('suppliers','organization_id','id','NULL::uuid','NULL::uuid','nip','NULL::text'),
  ('lookup_requests','organization_id','id','NULL::uuid','supplier_id','identifier','NULL::text'),
  ('provider_attempts','organization_id','id','request_id','NULL::uuid','NULL::text','section'),
  ('source_snapshots','organization_id','id','attempt_id','supplier_id','NULL::text','section'),
  ('section_projections','organization_id','id','snapshot_id','supplier_id','NULL::text','section'),
  ('financial_facts','organization_id','NULL::uuid','snapshot_id','supplier_id','NULL::text',$section$'financial'$section$),
  ('mgbi_source_archives','organization_id','NULL::uuid','NULL::uuid','NULL::uuid','nip','CASE model WHEN ''pl-krs-wp-record'' THEN ''general'' WHEN ''pl-krs-rdf-record'' THEN ''financial'' ELSE NULL END'),
  ('financial_source_documents','organization_id','NULL::uuid','NULL::uuid','NULL::uuid','nip',$section$'financial'$section$)
 )AS definition(table_name,org_column,row_key,related_key,supplier_key,nip_value,section_value) LOOP
  human:=format('profitia_modules.scope_allows(''supplier_report'',%I)',item.org_column);
  delegated:=format('srm.delegated_supplier_row(%L,%I,%s,%s,%s,%s,%s)',item.table_name,item.org_column,item.row_key,item.related_key,item.supplier_key,item.nip_value,item.section_value);
  lane:=format('CASE WHEN (profitia_access.runtime_descriptor()->>''applicationId'')=''srm'' THEN %s ELSE %s END',human,delegated);
  EXECUTE format('ALTER POLICY private_operation_admission ON srm.%I USING(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE (%s) END) WITH CHECK(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE (%s) END)',item.table_name,lane,lane);
  EXECUTE format('ALTER POLICY private_operation_fence ON srm.%I USING(CASE WHEN current_user=''profitia_access_owner'' THEN true ELSE (%s) END) WITH CHECK(CASE WHEN current_user=''profitia_access_owner'' THEN false ELSE (%s) END)',item.table_name,lane,lane);
  EXECUTE format('CREATE POLICY delegated_controlled_read ON srm.%I FOR SELECT TO profitia_access_owner USING(true)',item.table_name);
 END LOOP;
END $rls$;

-- Foreground command creation stays HUMAN-only and immutable. A Service can
-- read only its own currently reserved command, never another queued request.
CREATE POLICY delegated_command_read ON profitia_supplier_requests.commands FOR SELECT TO PUBLIC USING(
 CASE WHEN current_user='profitia_access_owner' THEN false ELSE srm.current_delegated_supplier(organisation_id,request_id,command_json->>'nip') IS NOT NULL END);
ALTER POLICY command_read_fence ON profitia_supplier_requests.commands USING(
 CASE WHEN current_user='profitia_access_owner' THEN true ELSE
  (application_id='srm' AND application_id=(profitia_access.runtime_descriptor()->>'applicationId')
   AND environment=(profitia_access.runtime_descriptor()->>'environment')
   AND profitia_requests.scope_allows('supplier.report.refresh',organisation_id,user_id,resource_id))
  OR srm.current_delegated_supplier(organisation_id,request_id,command_json->>'nip') IS NOT NULL END);
-- Named actor is the actual initiator; personal lists remain scoped to that
-- account. A Service interest phase cannot enumerate other NIPs in the org.
CREATE POLICY delegated_named_target ON srm.organization_supplier_interest AS RESTRICTIVE FOR ALL TO PUBLIC USING(
 ((profitia_access.runtime_descriptor()->>'applicationId')='srm' AND srm.current_delegated_supplier(organization_id,NULL,NULL,ARRAY['RECORD_INTEREST']) IS NULL) OR nip=(srm.current_delegated_supplier(organization_id,NULL,NULL,ARRAY['RECORD_INTEREST'])->>'nip')) WITH CHECK(
 ((profitia_access.runtime_descriptor()->>'applicationId')='srm' AND srm.current_delegated_supplier(organization_id,NULL,NULL,ARRAY['RECORD_INTEREST']) IS NULL) OR nip=(srm.current_delegated_supplier(organization_id,NULL,NULL,ARRAY['RECORD_INTEREST'])->>'nip'));
CREATE POLICY delegated_named_target ON srm.user_supplier_interest AS RESTRICTIVE FOR ALL TO PUBLIC USING(
 ((profitia_access.runtime_descriptor()->>'applicationId')='srm' AND srm.current_delegated_supplier(organization_id,NULL,NULL,ARRAY['RECORD_INTEREST']) IS NULL) OR nip=(srm.current_delegated_supplier(organization_id,NULL,NULL,ARRAY['RECORD_INTEREST'])->>'nip')) WITH CHECK(
 ((profitia_access.runtime_descriptor()->>'applicationId')='srm' AND srm.current_delegated_supplier(organization_id,NULL,NULL,ARRAY['RECORD_INTEREST']) IS NULL) OR nip=(srm.current_delegated_supplier(organization_id,NULL,NULL,ARRAY['RECORD_INTEREST'])->>'nip'));
REVOKE ALL ON srm.delegated_supplier_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.immutable_delegated_supplier_installation(),srm.delegated_supplier_descriptor(uuid,text),
 srm.current_delegated_supplier(uuid,uuid,text,text[]),srm.delegated_supplier_row(text,uuid,uuid,uuid,uuid,text,text) FROM PUBLIC;
