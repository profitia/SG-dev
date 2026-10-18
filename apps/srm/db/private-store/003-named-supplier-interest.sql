-- Optional adoption of existing organization/user supplier choices in the NEW
-- private store. No core account creation, demo reassignment, global writer,
-- grants or activation. Original initializer and SQL001-012 remain unchanged.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
   OR NOT EXISTS(SELECT 1 FROM profitia_access.applications WHERE application_id='srm' AND status='DISABLED')
   OR NOT EXISTS(SELECT 1 FROM srm.supplier_business_installation WHERE singleton AND schema_version='1.0.0'
     AND boundary_digest='1d234a4b271e7647415efea4ea9013d8cab074ed89f2920589f08fe0e6730dcb') THEN
   RAISE EXCEPTION 'Accepted disabled private SRM and controlled owner required' USING ERRCODE='42501'; END IF;
END $guard$;
CREATE TABLE srm.named_interest_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 boundary_digest text NOT NULL CHECK(boundary_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
ALTER TABLE srm.named_interest_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.named_interest_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON srm.named_interest_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY read_fence ON srm.named_interest_installation AS RESTRICTIVE FOR SELECT TO PUBLIC USING(current_user='profitia_access_owner');
CREATE POLICY insert_fence ON srm.named_interest_installation AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user='profitia_access_owner');
CREATE POLICY update_fence ON srm.named_interest_installation AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(false) WITH CHECK(false);
CREATE POLICY delete_fence ON srm.named_interest_installation AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false);
CREATE FUNCTION srm.named_interest_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;i srm.named_interest_installation%ROWTYPE;BEGIN
 d:=srm.supplier_business_descriptor();
 IF d IS NULL OR d->>'applicationId'<>'srm' OR NOT EXISTS(SELECT 1 FROM pg_class
   WHERE oid='srm.named_interest_installation'::regclass AND relowner='profitia_access_owner'::regrole AND relrowsecurity AND relforcerowsecurity)
   OR has_table_privilege(session_user,'srm.named_interest_installation','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
   OR has_any_column_privilege(session_user,'srm.named_interest_installation','SELECT,INSERT,UPDATE,REFERENCES') THEN RETURN NULL;END IF;
 SELECT * INTO i FROM srm.named_interest_installation WHERE singleton;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN d||jsonb_build_object('namedSchemaVersion',i.schema_version,'namedBoundaryDigest',i.boundary_digest,'namedSourceRef',i.source_ref);
END $fn$;
CREATE FUNCTION srm.named_interest_actor(p_org uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE uid uuid;BEGIN
 uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
 IF uid IS NULL OR srm.named_interest_descriptor() IS NULL
   OR profitia_modules.scope_allows('supplier_report',p_org,uid) IS NOT TRUE THEN RETURN NULL;END IF;
 RETURN uid;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;END $fn$;
CREATE FUNCTION srm.named_interest_phase(p_org uuid,p_nip text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE uid uuid;r record;n integer:=0;BEGIN
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
-- Only these three tables leave their unadopted CLOSED state. The scope is a
-- current internal account in a current organization, independent of Clerk.
DO $policies$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['users','organization_supplier_interest','user_supplier_interest'] LOOP
  EXECUTE format('DROP POLICY private_unadopted_fence ON srm.%I',t);
  EXECUTE format('CREATE POLICY named_actor ON srm.%I FOR ALL TO PUBLIC USING(srm.named_interest_actor(organization_id) IS NOT NULL) WITH CHECK(srm.named_interest_actor(organization_id) IS NOT NULL)',t);
  EXECUTE format('CREATE POLICY named_no_delete ON srm.%I AS RESTRICTIVE FOR DELETE TO PUBLIC USING(false)',t);
 END LOOP;
END $policies$;
CREATE POLICY named_user_scope ON srm.users AS RESTRICTIVE FOR ALL TO PUBLIC
 USING(identity_kind='AUTHENTICATED' AND subject_key='profitia-account:'||srm.named_interest_actor(organization_id)::text)
 WITH CHECK(identity_kind='AUTHENTICATED' AND subject_key='profitia-account:'||srm.named_interest_actor(organization_id)::text);
CREATE POLICY named_personal_scope ON srm.user_supplier_interest AS RESTRICTIVE FOR ALL TO PUBLIC
 USING(EXISTS(SELECT 1 FROM srm.users u WHERE u.organization_id=user_supplier_interest.organization_id AND u.id=user_supplier_interest.user_id
   AND u.identity_kind='AUTHENTICATED' AND u.subject_key='profitia-account:'||srm.named_interest_actor(u.organization_id)::text))
 WITH CHECK(EXISTS(SELECT 1 FROM srm.users u WHERE u.organization_id=user_supplier_interest.organization_id AND u.id=user_supplier_interest.user_id
   AND u.identity_kind='AUTHENTICATED' AND u.subject_key='profitia-account:'||srm.named_interest_actor(u.organization_id)::text));
CREATE FUNCTION srm.guard_named_interest() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE uid uuid;nip text;BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Named interest history is immutable' USING ERRCODE='42501';END IF;
 uid:=srm.named_interest_actor(NEW.organization_id);
 IF uid IS NULL OR TG_OP='UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
  RAISE EXCEPTION 'Current named owner required' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='users' THEN
  IF NEW.identity_kind<>'AUTHENTICATED' OR NEW.subject_key IS DISTINCT FROM 'profitia-account:'||uid::text
    OR TG_OP='UPDATE' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
   RAISE EXCEPTION 'Immutable internal account mapping required' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' THEN NEW.created_at:=clock_timestamp();END IF;
 ELSE
  nip:=NEW.nip;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'last_selected_at') IS DISTINCT FROM (to_jsonb(OLD)-'last_selected_at') THEN
   RAISE EXCEPTION 'Interest identity and first selection are immutable' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='user_supplier_interest' THEN
   IF NOT EXISTS(SELECT 1 FROM srm.users u WHERE u.organization_id=NEW.organization_id
     AND u.id=NEW.user_id AND u.identity_kind='AUTHENTICATED' AND u.subject_key='profitia-account:'||uid::text) THEN
    RAISE EXCEPTION 'Organization-scoped authenticated user required' USING ERRCODE='42501';END IF;
  END IF;
  NEW.last_selected_at:=clock_timestamp();IF TG_OP='INSERT' THEN NEW.first_selected_at:=NEW.last_selected_at;END IF;
 END IF;
 IF srm.named_interest_phase(NEW.organization_id,nip) IS NOT TRUE THEN
   RAISE EXCEPTION 'Current accepted supplier interest phase required' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
CREATE FUNCTION srm.no_truncate_named_interest() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN RAISE EXCEPTION 'Named interest history is immutable' USING ERRCODE='42501';END $fn$;
DO $triggers$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['users','organization_supplier_interest','user_supplier_interest'] LOOP
  EXECUTE format('CREATE TRIGGER named_interest_write BEFORE INSERT OR UPDATE OR DELETE ON srm.%I FOR EACH ROW EXECUTE FUNCTION srm.guard_named_interest()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['users','organization_supplier_interest','user_supplier_interest','named_interest_installation'] LOOP
  EXECUTE format('CREATE TRIGGER named_interest_no_truncate BEFORE TRUNCATE ON srm.%I FOR EACH STATEMENT EXECUTE FUNCTION srm.no_truncate_named_interest()',t);
 END LOOP;
END $triggers$;
REVOKE ALL ON srm.named_interest_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION srm.named_interest_descriptor(),srm.named_interest_actor(uuid),srm.named_interest_phase(uuid,text),srm.guard_named_interest(),srm.no_truncate_named_interest() FROM PUBLIC;
