-- Additive candidate for the accepted NEW private store. Controlled installation
-- only; no grants, activation, data copying or changes to the 18-source baseline.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles
   WHERE rolname=current_user AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole))
   OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='srm' AND status='DISABLED')
   OR NOT EXISTS(SELECT 1 FROM srm.private_installation WHERE singleton AND schema_version='1.0.0'
     AND boundary_digest='19220c7bb31365ed058bc55a99bca2aa4a9f38b7f8ca2a2ddde52ec71ed16ed4')
   OR NOT EXISTS(SELECT 1 FROM profitia_request_phases.installation WHERE singleton AND schema_version='1.0.0'
     AND schema_digest='d12b2e404cd6a9174f954c233982633076501f7ea493facd0cabf34c709604c1') THEN
   RAISE EXCEPTION 'Controlled disabled SRM and accepted private schemas required' USING ERRCODE='42501'; END IF;
END $guard$;
CREATE TABLE srm.supplier_business_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.supplier_business_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_business_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.supplier_business_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY runtime_read_fence ON srm.supplier_business_installation AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='profitia_access_owner');
CREATE POLICY runtime_insert_fence ON srm.supplier_business_installation AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY runtime_update_fence ON srm.supplier_business_installation AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(false) WITH CHECK(false);
CREATE POLICY runtime_delete_fence ON srm.supplier_business_installation AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false);

CREATE FUNCTION srm.supplier_business_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; i srm.supplier_business_installation%ROWTYPE;
BEGIN
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

-- Joins protected phase receipts rather than trusting a caller-supplied phase
-- GUC. The common deferred constraint still requires same-transaction OUTCOME.
CREATE FUNCTION srm.supplier_business_phase(p_org uuid,p_nip text,p_lookup uuid,p_phases text[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb; uid uuid;
BEGIN
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

CREATE FUNCTION srm.guard_supplier_business_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE nip text; lookup_id uuid; section text; phases text[];
BEGIN
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
DO $triggers$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['suppliers','lookup_requests','provider_attempts','source_snapshots','section_projections','financial_facts','mgbi_source_archives'] LOOP
   EXECUTE format('CREATE TRIGGER supplier_business_phase BEFORE INSERT OR UPDATE OR DELETE ON srm.%I FOR EACH ROW EXECUTE FUNCTION srm.guard_supplier_business_write()',name);
 END LOOP;
END $triggers$;
REVOKE ALL ON srm.supplier_business_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.supplier_business_descriptor(),srm.supplier_business_phase(uuid,text,uuid,text[]),srm.guard_supplier_business_write() FROM PUBLIC;
