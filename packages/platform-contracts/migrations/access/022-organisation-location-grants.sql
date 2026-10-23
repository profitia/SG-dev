-- Optional exact organization grants, consumed by the existing E1 authority.
-- No seeded policy, account, user grant, SDK change or provider permission.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM profitia_requests.location_admission_installation WHERE singleton AND schema_version='1.0.0'
   AND schema_digest='90ac1d28103f689edc8d11979210ce83cd6218e9f3549f37150fd307d165e9cc') THEN
  RAISE EXCEPTION 'Controlled owner and exact SQL020 required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM profitia_access.installation WHERE singleton FOR UPDATE;
END $guard$;
CREATE TABLE profitia_access.organisation_location_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$')
);
CREATE TABLE profitia_access.organisation_location_policies(
 policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),application_id text NOT NULL REFERENCES profitia_access.applications,
 organisation_id uuid NOT NULL REFERENCES profitia_access.organisations,
 operation text NOT NULL CHECK(operation IN('supplier.location.read','supplier.location.write','supplier.location.sync')),
 resource_id text NOT NULL CHECK(resource_id~'^supplier-locations:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'),
 status text NOT NULL CHECK(status IN('ACTIVE','REVOKED')),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
 UNIQUE(application_id,organisation_id,operation,resource_id)
);
-- Immutable domain-owned identity metadata, never an HTTP permission claim.
CREATE TABLE profitia_access.organisation_location_children(
 application_id text NOT NULL REFERENCES profitia_access.applications,organisation_id uuid NOT NULL REFERENCES profitia_access.organisations,
 collection_id text NOT NULL CHECK(collection_id~'^supplier-locations:[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'),location_id uuid NOT NULL,
 PRIMARY KEY(application_id,organisation_id,location_id)
);
DO $rls$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['organisation_location_installation','organisation_location_policies','organisation_location_children'] LOOP
  EXECUTE format('ALTER TABLE profitia_access.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE profitia_access.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY owner ON profitia_access.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
  EXECUTE format('CREATE POLICY owner_fence ON profitia_access.%I AS RESTRICTIVE TO PUBLIC USING(current_user=''profitia_access_owner'') WITH CHECK(current_user=''profitia_access_owner'')',t);
  EXECUTE format('REVOKE ALL ON profitia_access.%I FROM PUBLIC',t);
 END LOOP;
END $rls$;
CREATE FUNCTION profitia_access.organisation_location_permissions(p_app text,p_org uuid,p_user uuid)
RETURNS TABLE(grant_id uuid,operation text,feature text,resource_id text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 WITH allowed AS(
  SELECT p.* FROM profitia_access.organisation_location_policies p
  WHERE p.application_id=p_app AND p.organisation_id=p_org AND p.status='ACTIVE' AND p.expires_at>clock_timestamp()
   AND NOT EXISTS(SELECT 1 FROM profitia_access.permission_grants denied WHERE denied.application_id=p_app AND denied.organisation_id=p_org
    AND denied.user_id=p_user AND denied.effect='DENY' AND denied.operation=p.operation AND denied.feature='supplier_report'
    AND(denied.resource_id IS NULL OR denied.resource_id=p.resource_id))
   AND EXISTS(SELECT 1 FROM profitia_access.organisation_location_installation WHERE singleton AND schema_version='1.0.0')
   AND EXISTS(SELECT 1 FROM profitia_access.memberships m JOIN profitia_access.accounts a USING(user_id)
    JOIN profitia_access.organisations o USING(organisation_id) WHERE m.organisation_id=p_org AND m.user_id=p_user
     AND m.status='ACTIVE' AND a.status='ACTIVE' AND o.status='ACTIVE' AND m.expires_at>clock_timestamp())
 )
 SELECT policy_id,operation,'supplier_report',resource_id FROM allowed
 UNION ALL
 SELECT a.policy_id,a.operation,'supplier_report',c.location_id::text FROM allowed a
 JOIN profitia_access.organisation_location_children c ON c.application_id=a.application_id AND c.organisation_id=a.organisation_id AND c.collection_id=a.resource_id
 WHERE a.operation='supplier.location.write';
$fn$;
CREATE FUNCTION profitia_access.validate_organisation_location_policy() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF(to_jsonb(NEW)-'status'-'version'-'source_ref'-'expires_at') IS DISTINCT FROM(to_jsonb(OLD)-'status'-'version'-'source_ref'-'expires_at') THEN
  RAISE EXCEPTION 'Revoke before changing policy identity' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER identity_guard BEFORE UPDATE ON profitia_access.organisation_location_policies FOR EACH ROW EXECUTE FUNCTION profitia_access.validate_organisation_location_policy();
CREATE TRIGGER advance_version BEFORE UPDATE ON profitia_access.organisation_location_policies FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version();
CREATE TRIGGER access_revision BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON profitia_access.organisation_location_policies FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE ON profitia_access.organisation_location_children FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_truncate BEFORE TRUNCATE ON profitia_access.organisation_location_children FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_installation BEFORE UPDATE OR DELETE ON profitia_access.organisation_location_installation FOR EACH ROW EXECUTE FUNCTION profitia_supplier_jobs.immutable();
CREATE TRIGGER immutable_installation_truncate BEFORE TRUNCATE ON profitia_access.organisation_location_installation FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_jobs.immutable();
REVOKE ALL ON FUNCTION profitia_access.organisation_location_permissions(text,uuid,uuid),profitia_access.validate_organisation_location_policy() FROM PUBLIC;

-- Preserve OIDs, owner, ACL, search_path and every existing identity, membership,
-- product, module and DENY check. Only the explicit ALLOW source is additive.
DO $adopt$ DECLARE original text;candidate text;needle text;replacement text;BEGIN
 original:=pg_get_functiondef('profitia_access.lock_access(uuid,uuid,text,text,text)'::regprocedure);
 needle:='INTO permissions,denies FROM profitia_access.permission_grants
      WHERE application_id=d->>''applicationId'' AND organisation_id=p_org AND user_id=p_user;';
 replacement:='INTO permissions,denies FROM (
      SELECT grant_id,operation,feature,resource_id,effect FROM profitia_access.permission_grants
       WHERE application_id=d->>''applicationId'' AND organisation_id=p_org AND user_id=p_user
      UNION ALL SELECT grant_id,operation,feature,resource_id,''ALLOW'' FROM profitia_access.organisation_location_permissions(d->>''applicationId'',p_org,p_user)
     ) effective;';
 candidate:=replace(original,needle,replacement);
 IF candidate=original OR length(original)-length(replace(original,needle,''))<>length(needle) THEN RAISE EXCEPTION 'Unexpected lock_access source';END IF;
 needle:='''expiresAt'',least(binding_expiry,m.expires_at,clock_timestamp()+interval ''30 seconds'')';
 replacement:='''expiresAt'',least(binding_expiry,m.expires_at,clock_timestamp()+interval ''30 seconds'',(SELECT min(expires_at) FROM profitia_access.organisation_location_policies WHERE application_id=d->>''applicationId'' AND organisation_id=p_org AND status=''ACTIVE'' AND expires_at>clock_timestamp()))';
 IF position(needle IN candidate)=0 THEN RAISE EXCEPTION 'Unexpected access expiry source';END IF;
 candidate:=replace(candidate,needle,replacement);
 EXECUTE candidate;
 original:=pg_get_functiondef('profitia_requests.location_permission(text,uuid,uuid,text,text)'::regprocedure);
 needle:='AND EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=p_app AND organisation_id=p_org AND user_id=p_user
  AND feature=''supplier_report'' AND operation=p_operation AND effect=''ALLOW'' AND(resource_id IS NULL OR resource_id=p_resource))';
 replacement:='AND (EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=p_app AND organisation_id=p_org AND user_id=p_user
  AND feature=''supplier_report'' AND operation=p_operation AND effect=''ALLOW'' AND(resource_id IS NULL OR resource_id=p_resource))
  OR EXISTS(SELECT 1 FROM profitia_access.organisation_location_permissions(p_app,p_org,p_user) p WHERE p.operation=p_operation AND p.resource_id=p_resource))';
 candidate:=replace(original,needle,replacement);
 IF candidate=original OR length(original)-length(replace(original,needle,''))<>length(needle) THEN RAISE EXCEPTION 'Unexpected location_permission source';END IF;
 EXECUTE candidate;
 original:=pg_get_functiondef('profitia_requests.location_access(text,uuid,uuid,text)'::regprocedure);
 needle:='AND EXISTS(SELECT 1 FROM profitia_access.permission_grants WHERE application_id=d->>''applicationId'' AND organisation_id=p_org AND user_id=p_user
      AND operation=p_operation AND feature=''supplier_report'' AND effect=''ALLOW'' AND resource_id=a->''parent''->>''collectionId'')';
 replacement:='AND profitia_requests.location_permission(d->>''applicationId'',p_org,p_user,p_operation,a->''parent''->>''collectionId'')';
 candidate:=replace(original,needle,replacement);
 IF candidate=original OR length(original)-length(replace(original,needle,''))<>length(needle) THEN RAISE EXCEPTION 'Unexpected location_access source';END IF;
 EXECUTE candidate;
END $adopt$;
