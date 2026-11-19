-- Supplier & Category Pipelines business-schema proposal, contract 1.0.0.
-- NOT an installer or an activation grant. Execute only in one checked outer
-- transaction after E1-T02 adoption, exact source/recovery/window approval.
-- Existing master, its policies and the eighteen frozen migrations are retained.
DO $guard$
BEGIN
 IF current_user <> 'profitia_access_owner' OR current_database() <> 'platform_private'
  OR to_regclass('srm.private_installation') IS NULL
  OR to_regprocedure('profitia_supplier_workspace.scope_allows(uuid,text,uuid)') IS NULL
  OR to_regprocedure('profitia_supplier_workspace.member_allowed(uuid,uuid)') IS NULL
  OR coalesce(current_setting('profitia.install.source_sha',true),'') !~ '^[a-f0-9]{40}$'
  OR coalesce(current_setting('profitia.install.schema_digest',true),'') !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Accepted Supplier Workspace bridge, checked owner, binding and installation source required' USING ERRCODE='42501'; END IF;
 IF to_regclass('srm.supplier_workspace_profiles') IS NOT NULL THEN
  RAISE EXCEPTION 'Supplier Workspace schema already exists; reconcile receipt instead of replay' USING ERRCODE='55000'; END IF;
END $guard$;

CREATE FUNCTION srm.workspace_valid_nip(value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE total integer:=0;weights integer[]:=ARRAY[6,5,7,2,3,4,5,6,7];i integer;
BEGIN
 IF value !~ '^[0-9]{10}$' OR value='0000000000' THEN RETURN false;END IF;
 FOR i IN 1..9 LOOP total:=total+substring(value,i,1)::integer*weights[i];END LOOP;
 RETURN total%11<>10 AND total%11=substring(value,10,1)::integer;
END $fn$;
REVOKE ALL ON FUNCTION srm.workspace_valid_nip(text) FROM PUBLIC;

CREATE TABLE srm.supplier_workspace_profiles(
 organization_id uuid NOT NULL, supplier_id uuid NOT NULL,
 contacts jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK(jsonb_typeof(contacts)='array' AND jsonb_array_length(contacts)<=20 AND octet_length(contacts::text)<=32768),
 relationship_owner_account_id uuid,version bigint NOT NULL DEFAULT 1 CHECK(version>=1 AND version<=9007199254740991),
 archived_at timestamptz,created_by_account_id uuid NOT NULL,updated_by_account_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,supplier_id),
 FOREIGN KEY(organization_id,supplier_id) REFERENCES srm.suppliers(organization_id,id)
);
CREATE TABLE srm.supplier_categories(
 organization_id uuid NOT NULL REFERENCES srm.organizations(id),id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),
 normalized_name text GENERATED ALWAYS AS (lower(btrim(regexp_replace(normalize(name,NFKC),'[[:space:]]+',' ','g')))) STORED,
 version bigint NOT NULL DEFAULT 1 CHECK(version>=1 AND version<=9007199254740991),archived_at timestamptz,
 created_by_account_id uuid NOT NULL,updated_by_account_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,normalized_name),CHECK(length(normalized_name) BETWEEN 1 AND 200)
);
CREATE TABLE srm.supplier_category_links(
 organization_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),supplier_id uuid NOT NULL,category_id uuid NOT NULL,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),ended_at timestamptz,
 created_by_account_id uuid NOT NULL,ended_by_account_id uuid,
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,supplier_id) REFERENCES srm.suppliers(organization_id,id),
 FOREIGN KEY(organization_id,category_id) REFERENCES srm.supplier_categories(organization_id,id),
 CHECK(ended_at IS NULL OR ended_at>=started_at),
 CHECK((ended_at IS NULL)=(ended_by_account_id IS NULL))
);
CREATE UNIQUE INDEX supplier_category_links_active ON srm.supplier_category_links(organization_id,supplier_id,category_id) WHERE ended_at IS NULL;
CREATE TABLE srm.supplier_pipelines(
 organization_id uuid NOT NULL REFERENCES srm.organizations(id),id uuid NOT NULL DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN('SUPPLIER','CATEGORY')),name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),
 category_id uuid,version bigint NOT NULL DEFAULT 1 CHECK(version>=1 AND version<=9007199254740991),
 archived_at timestamptz,created_by_account_id uuid NOT NULL,updated_by_account_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,id,kind),
 FOREIGN KEY(organization_id,category_id) REFERENCES srm.supplier_categories(organization_id,id),
 CHECK((kind='CATEGORY')=(category_id IS NOT NULL))
);
CREATE TABLE srm.supplier_pipeline_stages(
 organization_id uuid NOT NULL,pipeline_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),
 normalized_name text GENERATED ALWAYS AS (lower(btrim(regexp_replace(normalize(name,NFKC),'[[:space:]]+',' ','g')))) STORED,
 stage_order integer CHECK(stage_order BETWEEN 0 AND 49),deleted_at timestamptz,
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,pipeline_id,id),
 FOREIGN KEY(organization_id,pipeline_id) REFERENCES srm.supplier_pipelines(organization_id,id),
 CHECK(deleted_at IS NOT NULL OR stage_order IS NOT NULL),CHECK(length(normalized_name) BETWEEN 1 AND 200),
 UNIQUE(organization_id,pipeline_id,stage_order) DEFERRABLE INITIALLY DEFERRED
);
CREATE UNIQUE INDEX supplier_pipeline_stage_names ON srm.supplier_pipeline_stages(organization_id,pipeline_id,normalized_name) WHERE deleted_at IS NULL;
CREATE TABLE srm.supplier_pipeline_memberships(
 organization_id uuid NOT NULL,id uuid NOT NULL DEFAULT gen_random_uuid(),supplier_id uuid NOT NULL,
 pipeline_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('SUPPLIER','CATEGORY')),stage_id uuid NOT NULL,
 version bigint NOT NULL DEFAULT 1 CHECK(version>=1 AND version<=9007199254740991),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),ended_at timestamptz,
 end_reason text CHECK(end_reason IN('ENDED','TRANSFERRED','SUPPLIER_ARCHIVED','PIPELINE_ARCHIVED')),
 pipeline_name_at_end text,stage_name_at_end text,
 created_by_account_id uuid NOT NULL,updated_by_account_id uuid NOT NULL,
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,supplier_id) REFERENCES srm.suppliers(organization_id,id),
 FOREIGN KEY(organization_id,pipeline_id,kind) REFERENCES srm.supplier_pipelines(organization_id,id,kind),
 FOREIGN KEY(organization_id,pipeline_id,stage_id) REFERENCES srm.supplier_pipeline_stages(organization_id,pipeline_id,id),
 CHECK((ended_at IS NULL)=(end_reason IS NULL)),CHECK(ended_at IS NULL OR ended_at>=started_at)
);
CREATE UNIQUE INDEX supplier_membership_active_per_process ON srm.supplier_pipeline_memberships(organization_id,pipeline_id,supplier_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX supplier_membership_one_supplier_process ON srm.supplier_pipeline_memberships(organization_id,supplier_id) WHERE ended_at IS NULL AND kind='SUPPLIER';
CREATE INDEX supplier_membership_active_stage ON srm.supplier_pipeline_memberships(organization_id,pipeline_id,stage_id) WHERE ended_at IS NULL;

CREATE TABLE srm.supplier_workspace_events(
 organization_id uuid NOT NULL REFERENCES srm.organizations(id),id uuid NOT NULL DEFAULT gen_random_uuid(),
 actor_account_id uuid NOT NULL,root_decision_id uuid NOT NULL DEFAULT (profitia_supplier_workspace.current_scope()).decision_id,command_id text NOT NULL CHECK(command_id~'^[a-zA-Z0-9_-]{8,128}$'),
 action text NOT NULL CHECK(action~'^[A-Z_]{3,64}$'),supplier_id uuid,pipeline_id uuid,
 before_state jsonb,after_state jsonb,occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,supplier_id) REFERENCES srm.suppliers(organization_id,id),
 FOREIGN KEY(organization_id,pipeline_id) REFERENCES srm.supplier_pipelines(organization_id,id),
 CHECK(before_state IS NULL OR jsonb_typeof(before_state)='object'),
 CHECK(after_state IS NULL OR jsonb_typeof(after_state)='object'),
 CHECK(octet_length(coalesce(before_state::text,''))+octet_length(coalesce(after_state::text,''))<=65536)
);
CREATE INDEX supplier_workspace_history ON srm.supplier_workspace_events(organization_id,supplier_id,id);
CREATE TABLE srm.supplier_workspace_receipts(
 organization_id uuid NOT NULL REFERENCES srm.organizations(id),actor_account_id uuid NOT NULL,
 root_decision_id uuid NOT NULL DEFAULT (profitia_supplier_workspace.current_scope()).decision_id,
 idempotency_key text NOT NULL CHECK(idempotency_key~'^[a-zA-Z0-9_-]{8,128}$'),
 command_digest text NOT NULL CHECK(command_digest~'^[a-f0-9]{64}$'),command_name text NOT NULL CHECK(command_name~'^[A-Z_]{3,64}$'),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object' AND octet_length(result::text)<=262144),
 committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(organization_id,actor_account_id,idempotency_key)
);

CREATE FUNCTION srm.workspace_membership_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE n text;life timestamptz;stage_life timestamptz;profile_life timestamptz;
BEGIN
 IF NEW.ended_at IS NOT NULL THEN RETURN NEW;END IF;
 -- The closed writer must acquire the same organisation transaction lock for
 -- membership/stage/lifecycle commands before reaching any of these rows.
 PERFORM pg_advisory_xact_lock(hashtextextended('srm-workspace:'||NEW.organization_id::text,0));
 SELECT s.nip,p.archived_at INTO n,profile_life FROM srm.suppliers s
  LEFT JOIN srm.supplier_workspace_profiles p ON p.organization_id=s.organization_id AND p.supplier_id=s.id
  WHERE s.organization_id=NEW.organization_id AND s.id=NEW.supplier_id FOR UPDATE OF s;
 IF NOT FOUND OR n IS NULL OR NOT srm.workspace_valid_nip(n) THEN
  RAISE EXCEPTION 'SCP:INVALID_NIP' USING ERRCODE='23514';END IF;
 IF profile_life IS NOT NULL THEN RAISE EXCEPTION 'SCP:RECORD_ARCHIVED' USING ERRCODE='23514';END IF;
 SELECT archived_at INTO life FROM srm.supplier_pipelines
  WHERE organization_id=NEW.organization_id AND id=NEW.pipeline_id AND kind=NEW.kind FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SCP:NOT_FOUND' USING ERRCODE='23503';END IF;
 IF life IS NOT NULL THEN RAISE EXCEPTION 'SCP:RECORD_ARCHIVED' USING ERRCODE='23514';END IF;
 SELECT deleted_at INTO stage_life FROM srm.supplier_pipeline_stages
  WHERE organization_id=NEW.organization_id AND pipeline_id=NEW.pipeline_id AND id=NEW.stage_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SCP:NOT_FOUND' USING ERRCODE='23503';END IF;
 IF stage_life IS NOT NULL THEN RAISE EXCEPTION 'SCP:RECORD_ARCHIVED' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION srm.workspace_membership_guard() FROM PUBLIC;
CREATE TRIGGER supplier_workspace_membership_guard BEFORE INSERT OR UPDATE OF supplier_id,pipeline_id,stage_id,kind,ended_at
 ON srm.supplier_pipeline_memberships FOR EACH ROW EXECUTE FUNCTION srm.workspace_membership_guard();

CREATE FUNCTION srm.workspace_profile_owner_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF NEW.relationship_owner_account_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.relationship_owner_account_id IS DISTINCT FROM OLD.relationship_owner_account_id) AND NOT profitia_supplier_workspace.member_allowed(NEW.organization_id,NEW.relationship_owner_account_id) THEN
  RAISE EXCEPTION 'SCP:FIELD_INVALID' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION srm.workspace_profile_owner_guard() FROM PUBLIC;
CREATE TRIGGER supplier_workspace_profile_owner BEFORE INSERT OR UPDATE OF relationship_owner_account_id
 ON srm.supplier_workspace_profiles FOR EACH ROW EXECUTE FUNCTION srm.workspace_profile_owner_guard();


-- Closed SRM table policy adapter. Authority stays in the native producer.
CREATE FUNCTION srm.workspace_table_scope(p_table text,p_mode text,p_org uuid,p_resource uuid,p_actor uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;BEGIN
 s:=profitia_supplier_workspace.current_scope();
 IF s.scope_id IS NULL OR s.organisation_id IS DISTINCT FROM p_org OR p_mode NOT IN('READ','WRITE') THEN RETURN false;END IF;
 IF p_table IN('supplier_workspace_receipts','supplier_workspace_events') AND p_mode='WRITE'
  OR p_table='supplier_workspace_receipts' THEN
  RETURN s.access_mode='WRITE' AND s.actor_id=p_actor
   AND profitia_supplier_workspace.scope_allows(p_org,s.operation,NULL);
 END IF;
 IF p_mode='READ' THEN
  RETURN CASE p_table
   WHEN 'supplier_workspace_profiles' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.catalog.read',p_resource)
   WHEN 'supplier_categories' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.category.read',p_resource)
   WHEN 'supplier_category_links' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.category.read',NULL)
    AND profitia_supplier_workspace.scope_allows(p_org,'supplier.catalog.read',p_resource)
   WHEN 'supplier_pipelines' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.pipeline.read',p_resource)
   WHEN 'supplier_pipeline_stages' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.pipeline.read',p_resource)
   WHEN 'supplier_pipeline_memberships' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.assignment.read',p_resource)
   WHEN 'supplier_workspace_events' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.catalog.read',p_resource)
    AND profitia_supplier_workspace.scope_allows(p_org,'supplier.category.read',NULL)
    AND profitia_supplier_workspace.scope_allows(p_org,'supplier.pipeline.read',NULL)
    AND profitia_supplier_workspace.scope_allows(p_org,'supplier.assignment.read',NULL)
   ELSE false END;
 END IF;
 RETURN CASE p_table
  WHEN 'supplier_workspace_profiles' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.catalog.write',p_resource)
   OR profitia_supplier_workspace.scope_allows(p_org,'supplier.category.write',NULL)
  WHEN 'supplier_categories' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.category.write',p_resource)
  WHEN 'supplier_category_links' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.category.write',NULL)
   AND profitia_supplier_workspace.scope_allows(p_org,'supplier.catalog.read',p_resource)
  WHEN 'supplier_pipelines' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.pipeline.write',p_resource)
   OR profitia_supplier_workspace.scope_allows(p_org,'supplier.assignment.write',NULL)
  WHEN 'supplier_pipeline_stages' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.pipeline.write',p_resource)
  WHEN 'supplier_pipeline_memberships' THEN profitia_supplier_workspace.scope_allows(p_org,'supplier.assignment.write',p_resource)
  ELSE false END;
END $fn$;
REVOKE ALL ON FUNCTION srm.workspace_table_scope(text,text,uuid,uuid,uuid) FROM PUBLIC;

CREATE FUNCTION srm.workspace_identity_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;before jsonb;after jsonb;
BEGIN
 IF TG_OP='DELETE' OR TG_OP<>'INSERT' AND TG_TABLE_NAME IN('supplier_workspace_events','supplier_workspace_receipts')
  THEN RAISE EXCEPTION 'Workspace history is immutable' USING ERRCODE='42501';END IF;
 s:=profitia_supplier_workspace.current_scope();
 IF s.scope_id IS NULL OR s.organisation_id IS DISTINCT FROM NEW.organization_id THEN
  RAISE EXCEPTION 'Workspace organization scope required' USING ERRCODE='42501';END IF;
 before:=to_jsonb(OLD);after:=to_jsonb(NEW);
 IF TG_OP='INSERT' THEN
  IF after ? 'created_by_account_id' AND after->>'created_by_account_id' IS DISTINCT FROM s.actor_id::text
   OR after ? 'actor_account_id' AND after->>'actor_account_id' IS DISTINCT FROM s.actor_id::text
  THEN RAISE EXCEPTION 'Workspace actor must come from native scope' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='supplier_pipelines' AND profitia_supplier_workspace.scope_allows(NEW.organization_id,'supplier.pipeline.write',(after->>'id')::uuid) IS NOT TRUE
   THEN RAISE EXCEPTION 'Pipeline creation requires pipeline WRITE' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='supplier_workspace_profiles'
   AND profitia_supplier_workspace.scope_allows(NEW.organization_id,'supplier.catalog.write',(after->>'supplier_id')::uuid) IS NOT TRUE
   AND(after->'contacts'<>'[]'::jsonb OR after->>'relationship_owner_account_id' IS NOT NULL OR after->>'archived_at' IS NOT NULL)
   THEN RAISE EXCEPTION 'Initial catalogue fields require catalogue WRITE' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 IF after ? 'version' AND(after->>'version')::bigint<>(before->>'version')::bigint+1
  OR after ? 'updated_by_account_id' AND after->>'updated_by_account_id' IS DISTINCT FROM s.actor_id::text
 THEN RAISE EXCEPTION 'Workspace version and updater must advance canonically' USING ERRCODE='42501';END IF;

 IF(after->>'organization_id') IS DISTINCT FROM(before->>'organization_id')
  OR(after->>'id') IS DISTINCT FROM(before->>'id')
  OR(after->>'created_by_account_id') IS DISTINCT FROM(before->>'created_by_account_id')
  OR(after->>'created_at') IS DISTINCT FROM(before->>'created_at') THEN
  RAISE EXCEPTION 'Workspace identity and author immutable' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='supplier_workspace_profiles' THEN
  IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id OR (
   profitia_supplier_workspace.scope_allows(NEW.organization_id,'supplier.catalog.write',NEW.supplier_id) IS NOT TRUE
   AND(after-ARRAY['version','updated_by_account_id','updated_at']) IS DISTINCT FROM(before-ARRAY['version','updated_by_account_id','updated_at']))
   THEN RAISE EXCEPTION 'Catalogue fields require catalogue WRITE' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='supplier_pipelines' THEN
  IF NEW.kind IS DISTINCT FROM OLD.kind OR NEW.category_id IS DISTINCT FROM OLD.category_id OR (
   profitia_supplier_workspace.scope_allows(NEW.organization_id,'supplier.pipeline.write',NEW.id) IS NOT TRUE
   AND(after-ARRAY['version','updated_by_account_id','updated_at']) IS DISTINCT FROM(before-ARRAY['version','updated_by_account_id','updated_at']))
   THEN RAISE EXCEPTION 'Pipeline definition requires pipeline WRITE' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='supplier_pipeline_stages' THEN
  IF NEW.pipeline_id IS DISTINCT FROM OLD.pipeline_id THEN RAISE EXCEPTION 'Stage parent immutable' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='supplier_pipeline_memberships' THEN
  IF OLD.ended_at IS NOT NULL OR (after-ARRAY['stage_id','version','ended_at','end_reason','updated_by_account_id','pipeline_name_at_end','stage_name_at_end'])
   IS DISTINCT FROM(before-ARRAY['stage_id','version','ended_at','end_reason','updated_by_account_id','pipeline_name_at_end','stage_name_at_end'])
   THEN RAISE EXCEPTION 'Participation identity/history immutable' USING ERRCODE='42501';END IF;
 ELSIF TG_TABLE_NAME='supplier_category_links' THEN
  IF OLD.ended_at IS NOT NULL OR(after-ARRAY['ended_at','ended_by_account_id']) IS DISTINCT FROM(before-ARRAY['ended_at','ended_by_account_id'])
   THEN RAISE EXCEPTION 'Category relation history immutable' USING ERRCODE='42501';END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION srm.workspace_identity_guard() FROM PUBLIC;
DO $policies$
DECLARE t text;r text;a text;predicate text;
BEGIN
 FOREACH t IN ARRAY ARRAY['supplier_workspace_profiles','supplier_categories','supplier_category_links','supplier_pipelines','supplier_pipeline_stages','supplier_pipeline_memberships','supplier_workspace_events','supplier_workspace_receipts'] LOOP
  EXECUTE format('ALTER TABLE srm.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE srm.%I FORCE ROW LEVEL SECURITY',t);
  r:=CASE t WHEN 'supplier_workspace_profiles' THEN 'supplier_id' WHEN 'supplier_category_links' THEN 'supplier_id'
   WHEN 'supplier_pipeline_stages' THEN 'pipeline_id' WHEN 'supplier_workspace_events' THEN 'supplier_id'
   WHEN 'supplier_workspace_receipts' THEN 'NULL::uuid' ELSE 'id' END;
  a:=CASE t WHEN 'supplier_workspace_events' THEN 'actor_account_id' WHEN 'supplier_workspace_receipts' THEN 'actor_account_id' ELSE 'NULL::uuid' END;
  predicate:=format('srm.workspace_table_scope(%L,%L,organization_id,%s,%s)',t,'READ',r,a);
  EXECUTE format('CREATE POLICY workspace_read ON srm.%I FOR SELECT TO profitia_access_owner USING(%s)',t,predicate);
  predicate:=format('srm.workspace_table_scope(%L,%L,organization_id,%s,%s)',t,'WRITE',r,a);
  EXECUTE format('CREATE POLICY workspace_insert ON srm.%I FOR INSERT TO profitia_access_owner WITH CHECK(%s)',t,predicate);
  IF t NOT IN('supplier_workspace_events','supplier_workspace_receipts') THEN
   EXECUTE format('CREATE POLICY workspace_update ON srm.%I FOR UPDATE TO profitia_access_owner USING(%s) WITH CHECK(%s)',t,predicate,predicate);
  END IF;
  EXECUTE format('CREATE TRIGGER workspace_identity BEFORE INSERT OR UPDATE OR DELETE ON srm.%I FOR EACH ROW EXECUTE FUNCTION srm.workspace_identity_guard()',t);
  EXECUTE format('REVOKE ALL ON srm.%I FROM PUBLIC',t);
 END LOOP;
END $policies$;
CREATE POLICY workspace_stage_lock ON srm.supplier_pipeline_stages FOR UPDATE TO profitia_access_owner
 USING(profitia_supplier_workspace.scope_allows(organization_id,'supplier.assignment.write',pipeline_id)) WITH CHECK(false);

CREATE TABLE srm.supplier_workspace_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),contract_version text NOT NULL CHECK(contract_version='1.0.0'),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$'),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 installed_at timestamptz NOT NULL DEFAULT clock_timestamp(),installed_by text NOT NULL DEFAULT session_user
);
ALTER TABLE srm.supplier_workspace_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE srm.supplier_workspace_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_installation_owner ON srm.supplier_workspace_installation TO profitia_access_owner
 USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
REVOKE ALL ON srm.supplier_workspace_installation FROM PUBLIC;
INSERT INTO srm.supplier_workspace_installation(contract_version,source_ref,schema_digest)
 VALUES('1.0.0',current_setting('profitia.install.source_sha'),current_setting('profitia.install.schema_digest'));
