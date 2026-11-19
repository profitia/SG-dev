-- Supplier Workspace v1: DEC-24 bounded scope, NOT an activation/enrollment.
-- Execute only in the separately admitted exact-source installation transaction.
-- Existing immutable migrations are untouched. No ordinary runtime grant is made.
DO $guard$
BEGIN
 IF current_user<>'profitia_access_owner' OR current_database()<>'platform_private'
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND
   (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication))
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=current_user))
  OR to_regnamespace('profitia_supplier_workspace') IS NOT NULL
  OR coalesce(current_setting('profitia.install.supplier_workspace_digest',true),'')!~'^[a-f0-9]{64}$'
  OR coalesce(current_setting('profitia.install.supplier_workspace_source',true),'')!~'^[a-f0-9]{40}$'
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.suppliers'::regclass AND relforcerowsecurity
    AND relowner=(SELECT oid FROM pg_roles WHERE rolname='profitia_access_owner'))
  OR EXISTS(SELECT 1 FROM profitia_modules.application_bindings WHERE module_id='supplier_workspace')
 THEN RAISE EXCEPTION 'Exact controlled workspace installation required' USING ERRCODE='42501';END IF;
 IF encode(sha256(convert_to(pg_get_functiondef('profitia_access.append_audit(jsonb)'::regprocedure),'UTF8')),'hex')<>'cbaee0d7289a875b5e5d3a8354270322201e3128328869f89285d18c3f295c4e' THEN RAISE EXCEPTION 'Accepted base function changed: profitia_access.append_audit(jsonb)' USING ERRCODE='42501';END IF;
 IF encode(sha256(convert_to(pg_get_functiondef('profitia_modules.bind_scope(text)'::regprocedure),'UTF8')),'hex')<>'ab4ba94b623c7777385bdb69259bc894fcf5e7627cefd264ff66493ae15160ca' THEN RAISE EXCEPTION 'Accepted base function changed: profitia_modules.bind_scope(text)' USING ERRCODE='42501';END IF;
 IF encode(sha256(convert_to(pg_get_functiondef('profitia_modules.scope_allows(text,uuid,uuid)'::regprocedure),'UTF8')),'hex')<>'4c539a6ce2d9b2600043ae0f4e8bf45ee35662ffe438b8da47c1c182b5fc64dd' THEN RAISE EXCEPTION 'Accepted base function changed: profitia_modules.scope_allows(text,uuid,uuid)' USING ERRCODE='42501';END IF;
 IF encode(sha256(convert_to(pg_get_functiondef('profitia_access.lock_access(uuid,uuid,text,text,text)'::regprocedure),'UTF8')),'hex')<>'df239ec7747b0946ee421c8f9be440fafd1ba2e357b6e9d250972f73c6452120' THEN RAISE EXCEPTION 'Accepted canonical membership resolver changed' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='profitia_modules.application_bindings'::regclass AND conname='application_bindings_module_id_check' AND encode(sha256(convert_to(pg_get_constraintdef(oid),'UTF8')),'hex')='474c638a8ce2fd099ada3ff732c08440f2df0f0bb5c4da4a2b701ba07f06b36d') THEN RAISE EXCEPTION 'Accepted module constraint changed' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='srm.suppliers'::regclass AND polname='private_operation_fence' AND encode(sha256(convert_to(pg_get_expr(polqual,polrelid),'UTF8')),'hex')='8d106afe23a3257a2e11e19d1315fd488abe7ab65d558c038ecc2ffea46b43ef' AND encode(sha256(convert_to(pg_get_expr(polwithcheck,polrelid),'UTF8')),'hex')='14322c706822014bd99833771b61695a1a6e631aa0f11ea47302067af1c66da2') THEN RAISE EXCEPTION 'Accepted master fence changed: private_operation_fence' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='srm.suppliers'::regclass AND polname='inspected_update_fence' AND encode(sha256(convert_to(pg_get_expr(polqual,polrelid),'UTF8')),'hex')='801a272af6086b6244d64b1bac9abfe6d606ff6fc1e97f26855a90111484b98c' AND encode(sha256(convert_to(pg_get_expr(polwithcheck,polrelid),'UTF8')),'hex')='957b021e006117999a67cf05d15ab9fc51dceec5acb0e17455a78e9fc8ad848c') THEN RAISE EXCEPTION 'Accepted master fence changed: inspected_update_fence' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='srm.organizations'::regclass AND relforcerowsecurity AND relowner='profitia_access_owner'::regrole)
 OR NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='srm.organizations'::regclass AND polname='private_operation_fence'
 AND encode(sha256(convert_to(pg_get_expr(polwithcheck,polrelid),'UTF8')),'hex')='1134694daca19d93b6ebeb3baf5ec2614b95f81ab7c8c4f59c82c4594cce8088')
 THEN RAISE EXCEPTION 'Accepted organization parent fence required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='srm.guard_supplier_business_write()'::regprocedure AND prosecdef AND proowner='profitia_access_owner'::regrole AND encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex')='32123680240e42ff01ae45a957bea7ccf4edb4fb8071da7c1072fbcaa3e11337') THEN RAISE EXCEPTION 'Exact accepted supplier trigger required' USING ERRCODE='42501';END IF;
END $guard$;

CREATE SCHEMA profitia_supplier_workspace AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_supplier_workspace FROM PUBLIC;
CREATE TABLE profitia_supplier_workspace.installation(
 singleton boolean PRIMARY KEY CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(source_ref~'^[a-f0-9]{40}$'),policy_version bigint NOT NULL DEFAULT 1 CHECK(policy_version>0));
INSERT INTO profitia_supplier_workspace.installation VALUES(true,'1.0.0',
 current_setting('profitia.install.supplier_workspace_digest'),current_setting('profitia.install.supplier_workspace_source'),1);
CREATE TABLE profitia_supplier_workspace.scopes(
 scope_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),login_role name NOT NULL,backend_pid integer NOT NULL,
 transaction_id text NOT NULL,decision_id uuid NOT NULL,organisation_id uuid NOT NULL,actor_id uuid NOT NULL,
 policy_id uuid NOT NULL,policy_version bigint NOT NULL,
 operation text NOT NULL,resource_id text NOT NULL,payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
 access_mode text NOT NULL CHECK(access_mode IN('READ','WRITE')),allowed_write_operations text[] NOT NULL,access_state jsonb NOT NULL,
 access_policy_version text NOT NULL,expires_at timestamptz NOT NULL,
 UNIQUE(login_role,backend_pid,transaction_id));
ALTER TABLE profitia_supplier_workspace.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_supplier_workspace.installation FORCE ROW LEVEL SECURITY;
ALTER TABLE profitia_supplier_workspace.scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_supplier_workspace.scopes FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_supplier_workspace.installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE POLICY controlled_owner ON profitia_supplier_workspace.scopes TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_supplier_workspace.immutable() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 RAISE EXCEPTION 'Workspace authority history is immutable' USING ERRCODE='42501';END $fn$;
CREATE TRIGGER installation_immutable BEFORE UPDATE OR DELETE ON profitia_supplier_workspace.installation
 FOR EACH ROW EXECUTE FUNCTION profitia_supplier_workspace.immutable();
CREATE TRIGGER installation_truncate BEFORE TRUNCATE ON profitia_supplier_workspace.installation
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_workspace.immutable();
CREATE TRIGGER scope_immutable BEFORE UPDATE OR DELETE ON profitia_supplier_workspace.scopes
 FOR EACH ROW EXECUTE FUNCTION profitia_supplier_workspace.immutable();
CREATE TRIGGER scope_truncate BEFORE TRUNCATE ON profitia_supplier_workspace.scopes
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_workspace.immutable();

-- Explicit organisation feature enrollment; installation deliberately adds no row.
CREATE TABLE profitia_supplier_workspace.organisation_policies(
 application_id text NOT NULL CHECK(application_id='srm'),organisation_id uuid NOT NULL REFERENCES profitia_access.organisations,
 policy_id uuid NOT NULL UNIQUE,status text NOT NULL CHECK(status IN('ACTIVE','DISABLED','REVOKED')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
 expires_at timestamptz NOT NULL,PRIMARY KEY(application_id,organisation_id));
ALTER TABLE profitia_supplier_workspace.organisation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_supplier_workspace.organisation_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_supplier_workspace.organisation_policies TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_supplier_workspace.policy_change() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN
 IF current_user<>'profitia_access_owner' OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Controlled revocation only' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
  IF(NEW.application_id,NEW.organisation_id,NEW.policy_id) IS DISTINCT FROM(OLD.application_id,OLD.organisation_id,OLD.policy_id)
   THEN RAISE EXCEPTION 'Workspace policy identity immutable' USING ERRCODE='42501';END IF;
  NEW.version:=OLD.version+1;
 END IF;
 UPDATE profitia_access.installation SET revision=revision+1 WHERE singleton;
 RETURN NEW;
END $fn$;
CREATE TRIGGER policy_version BEFORE INSERT OR UPDATE OR DELETE ON profitia_supplier_workspace.organisation_policies
 FOR EACH ROW EXECUTE FUNCTION profitia_supplier_workspace.policy_change();
CREATE TRIGGER policy_truncate BEFORE TRUNCATE ON profitia_supplier_workspace.organisation_policies
 FOR EACH STATEMENT EXECUTE FUNCTION profitia_supplier_workspace.immutable();

CREATE FUNCTION profitia_supplier_workspace.permissions(p_app text,p_org uuid,p_user uuid)
 RETURNS TABLE(grant_id uuid,operation text,feature text,resource_id text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT md5(p.policy_id::text||'|'||p_user::text||'|'||op)::uuid,op,'supplier_workspace'::text,NULL::text
 FROM profitia_supplier_workspace.organisation_policies p
 CROSS JOIN unnest(ARRAY['supplier.catalog.read','supplier.catalog.write','supplier.category.read','supplier.category.write',
  'supplier.pipeline.read','supplier.pipeline.write','supplier.assignment.read','supplier.assignment.write','supplier.adp-status.read']) op
 WHERE p.application_id=p_app AND p_app='srm' AND p.organisation_id=p_org AND p.status='ACTIVE' AND p.expires_at>clock_timestamp()
  AND (profitia_access.runtime_descriptor())->>'applicationId'=p_app
  AND (profitia_access.runtime_descriptor())->>'environment'='development'
  AND EXISTS(SELECT 1 FROM profitia_access.memberships m JOIN profitia_access.accounts a USING(user_id)
    JOIN profitia_access.organisations o USING(organisation_id)
    WHERE m.organisation_id=p_org AND m.user_id=p_user AND m.status='ACTIVE' AND a.status='ACTIVE'
     AND o.status='ACTIVE' AND m.expires_at>clock_timestamp())
  AND EXISTS(SELECT 1 FROM profitia_access.product_grants g WHERE g.application_id=p_app AND g.organisation_id=p_org
   AND g.product IN('SPENDGURU','SUPPLIER_INTELLIGENCE') AND g.status='ACTIVE' AND g.expires_at>clock_timestamp()
   AND 'supplier_workspace'=ANY(g.features));
$fn$;

CREATE OR REPLACE FUNCTION profitia_access.lock_access(p_user uuid, p_org uuid, p_issuer text, p_subject text, p_binding_version text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'profitia_access'
AS $function$
DECLARE d jsonb; u profitia_access.accounts%ROWTYPE; m profitia_access.memberships%ROWTYPE;
  v_revision bigint; permissions jsonb; denies jsonb; products jsonb; access jsonb; binding_expiry timestamptz;
BEGIN
  SELECT revision INTO v_revision FROM profitia_access.installation WHERE singleton FOR SHARE;
  d := profitia_access.runtime_descriptor();
  SELECT * INTO u FROM profitia_access.accounts WHERE user_id=p_user AND status='ACTIVE';
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT e.expires_at INTO binding_expiry FROM profitia_access.external_identities e
    WHERE e.issuer=p_issuer AND e.subject=p_subject AND e.user_id=p_user AND e.status='ACTIVE'
      AND e.binding_id::text||':'||e.version::text||':'||u.version::text=p_binding_version
      AND e.expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_org IS NULL THEN
    access := jsonb_build_object('type','ACCOUNT_SELF','actorId',p_user,'organisationId',NULL,
      'status','ACTIVE','version',u.version::text,'sourceRef','account:'||p_user,
      'expiresAt',least(binding_expiry,clock_timestamp()+interval '30 seconds'),
      'permissions',jsonb_build_array(jsonb_build_object('operation','account.settings.read','feature','account','resourceId',NULL),jsonb_build_object('operation','account.settings.write','feature','account','resourceId',NULL)),'denies','[]'::jsonb);
    products := '[]'::jsonb;
  ELSE
    IF d->>'fixedOrganisationId' IS NOT NULL AND (d->>'fixedOrganisationId')::uuid<>p_org THEN RETURN NULL; END IF;
    SELECT mm.* INTO m FROM profitia_access.memberships mm JOIN profitia_access.organisations o USING(organisation_id)
      WHERE mm.organisation_id=p_org AND mm.user_id=p_user AND mm.status='ACTIVE'
        AND o.status='ACTIVE' AND mm.expires_at>clock_timestamp();
    IF NOT FOUND THEN RETURN NULL; END IF;
    SELECT coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='ALLOW'),'[]'::jsonb),
      coalesce(jsonb_agg(jsonb_build_object('operation',operation,'feature',feature,'resourceId',resource_id) ORDER BY grant_id) FILTER(WHERE effect='DENY'),'[]'::jsonb)
      INTO permissions,denies FROM (
      SELECT grant_id,operation,feature,resource_id,effect FROM profitia_access.permission_grants
       WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND user_id=p_user
      UNION ALL SELECT grant_id,operation,feature,resource_id,'ALLOW' FROM profitia_access.organisation_location_permissions(d->>'applicationId',p_org,p_user)
      UNION ALL SELECT grant_id,operation,feature,resource_id,'ALLOW' FROM profitia_supplier_workspace.permissions(d->>'applicationId',p_org,p_user)
     ) effective;
    access := jsonb_build_object('type','MEMBERSHIP','actorId',p_user,'organisationId',p_org,
      'status','ACTIVE','version',m.version::text||':'||v_revision::text,'sourceRef',m.source_ref,
      'expiresAt',least(binding_expiry,m.expires_at,clock_timestamp()+interval '30 seconds',(SELECT min(expires_at) FROM profitia_access.organisation_location_policies WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND status='ACTIVE' AND expires_at>clock_timestamp()),(SELECT min(expires_at) FROM profitia_supplier_workspace.organisation_policies WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND status='ACTIVE' AND expires_at>clock_timestamp())),'permissions',permissions,'denies',denies);
    SELECT coalesce(jsonb_agg(jsonb_build_object('product',product,'features',features,'organisationId',organisation_id,
      'environment',d->>'environment','applicationId',application_id,'status',status,
      'version',version::text,'sourceRef',source_ref,'source',source,'expiresAt',expires_at) ORDER BY product),'[]'::jsonb)
      INTO products FROM profitia_access.product_grants
      WHERE application_id=d->>'applicationId' AND organisation_id=p_org;
  END IF;
  RETURN jsonb_build_object('applicationId',d->>'applicationId','environment',d->>'environment',
    'policyVersion','access-v1:'||v_revision::text,'identityBindingVersion',p_binding_version,
    'access',access,'products',products,'usagePolicy','NOT_APPLICABLE','transactionId',txid_current()::text);
END $function$
;

ALTER TABLE profitia_modules.application_bindings DROP CONSTRAINT application_bindings_module_id_check;
ALTER TABLE profitia_modules.application_bindings ADD CONSTRAINT application_bindings_module_id_check
 CHECK(module_id IN('benchmark','category','supplier_report','supplier_workspace'));
CREATE OR REPLACE FUNCTION profitia_access.append_audit(p_event jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'profitia_access', 'profitia_modules', 'pg_temp'
AS $function$
DECLARE d jsonb;
BEGIN
  d := profitia_access.runtime_descriptor();
  IF jsonb_typeof(p_event) IS DISTINCT FROM 'object' OR octet_length(p_event::text)>16384
    OR p_event->>'applicationId' IS DISTINCT FROM d->>'applicationId'
    OR p_event->>'environment' IS DISTINCT FROM d->>'environment'
    OR coalesce(p_event->>'phase','') NOT IN ('INTENT','OUTCOME','DECISION','FAILURE')
    OR coalesce(p_event->>'decision','') NOT IN ('ALLOW','DENY')
    OR coalesce(p_event->>'reasonCode','') !~ '^[A-Z_]{1,64}$'
    OR p_event::text ~* '(gh[pousr]_|sk_(live|test)_|postgres(ql)?://|Bearer[[:space:]])'
    OR EXISTS(SELECT 1 FROM jsonb_each(p_event) v WHERE v.key NOT IN ('productEvidence','moduleEvidence','requestContinuation','requestInspection','requestWork')
      AND (jsonb_typeof(v.value) NOT IN ('string','null') OR length(v.value#>>'{}')>512))
    OR (p_event ? 'productEvidence' AND jsonb_typeof(p_event->'productEvidence') IS DISTINCT FROM 'array')
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_event) k WHERE k NOT IN (
      'decisionId','contractId','contractVersion','implementationVersion','applicationId','applicationProfile',
      'deploymentId','configurationVersion','environment','operationStartedAt','occurredAt','operation',
      'actorId','actorKind','subjectUserId','organisationId','identityProofRef','identityIssuer','identityAudience',
      'resourceId','payloadDigest','mode','policyVersion','accessBasisType','accessVersion','accessSourceRef',
      'feature','effect','correlationId','resourceType','dataClass','ownerOrganisationId','ownerUserId',
      'resourceVersion','projectionVersion','productEvidence','moduleEvidence','requestContinuation','requestInspection','requestWork','usagePolicy','phase','decision','reasonCode')) THEN
    RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
  END IF;
  IF p_event ? 'requestWork' AND profitia_request_work.audit_allows(p_event) IS NOT TRUE THEN
    RAISE EXCEPTION 'Native SQL work evidence invalid' USING ERRCODE='42501';END IF;
  IF p_event->>'decision'='ALLOW' AND (
    (p_event ? 'requestWork' AND EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.phase='INTENT'
      AND (s.event->'requestInspection'->>'transactionId'=txid_current()::text OR s.event->'requestContinuation'->>'transactionId'=txid_current()::text)))
    OR ((p_event ? 'requestInspection' OR p_event ? 'requestContinuation') AND EXISTS(SELECT 1 FROM profitia_access.security_events s
      WHERE s.phase='INTENT' AND s.event->'requestWork'->>'transactionId'=txid_current()::text))) THEN
    RAISE EXCEPTION 'Native work cannot mix with a phase or inspection transaction' USING ERRCODE='42501';END IF;
  IF p_event ? 'requestInspection' AND profitia_request_inspection.audit_allows(p_event) IS NOT TRUE THEN
    RAISE EXCEPTION 'Private inspection evidence invalid' USING ERRCODE='42501';END IF;
  IF p_event ? 'requestContinuation' AND EXISTS(SELECT 1 FROM profitia_access.security_events s
    WHERE s.phase='INTENT' AND s.application_id=p_event->>'applicationId' AND s.environment=p_event->>'environment'
      AND s.event->>'resourceId'=p_event->>'resourceId' AND s.event->'requestInspection'->>'transactionId'=txid_current()::text) THEN
    RAISE EXCEPTION 'Private inspection cannot become a write phase' USING ERRCODE='42501';END IF;
  IF p_event ? 'requestContinuation' AND profitia_request_phases.audit_allows(p_event) IS NOT TRUE THEN
    RAISE EXCEPTION 'Delegated private phase evidence invalid' USING ERRCODE='42501';END IF;
  IF p_event ? 'productEvidence' THEN
    IF jsonb_array_length(p_event->'productEvidence')>32 THEN RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_event->'productEvidence') item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object') THEN RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_event->'productEvidence') item,
      LATERAL jsonb_each(item) v WHERE v.key NOT IN ('product','version','sourceRef','source','expiresAt','feature')
        OR jsonb_typeof(v.value) IS DISTINCT FROM 'string' OR length(v.value#>>'{}') NOT BETWEEN 1 AND 256) THEN
      RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
    END IF;
  END IF;
  IF p_event ? 'moduleEvidence' THEN
    IF jsonb_typeof(p_event->'moduleEvidence') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Module audit evidence invalid' USING ERRCODE='42501';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_event->'moduleEvidence'))<>8
      OR EXISTS(SELECT 1 FROM jsonb_each(p_event->'moduleEvidence') v
        WHERE v.key NOT IN ('moduleId','moduleBindingId','version','sourceRef','expiresAt','transactionId','moduleSchemaDigest','auditSchemaDigest')
          OR jsonb_typeof(v.value) IS DISTINCT FROM 'string' OR length(v.value#>>'{}') NOT BETWEEN 1 AND 256)
      OR coalesce(p_event->'moduleEvidence'->>'moduleId','') NOT IN ('benchmark','category','supplier_report','supplier_workspace')
      OR coalesce(p_event->'moduleEvidence'->>'moduleBindingId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR coalesce(p_event->'moduleEvidence'->>'version','') !~ '^[1-9][0-9]*$'
      OR coalesce(p_event->'moduleEvidence'->>'transactionId','') !~ '^[0-9]+$'
      OR coalesce(p_event->'moduleEvidence'->>'moduleSchemaDigest','') !~ '^[a-f0-9]{64}$'
      OR coalesce(p_event->'moduleEvidence'->>'auditSchemaDigest','') !~ '^[a-f0-9]{64}$'
      OR coalesce(p_event->>'actorId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR coalesce(p_event->>'organisationId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      OR p_event->>'actorKind' IS DISTINCT FROM 'HUMAN'
      OR p_event->>'subjectUserId' IS DISTINCT FROM p_event->>'actorId'
      OR isfinite((p_event->'moduleEvidence'->>'expiresAt')::timestamptz) IS NOT TRUE THEN
      RAISE EXCEPTION 'Module audit evidence invalid' USING ERRCODE='42501';
    END IF;
    -- DENY/FAILURE retains the historical accepted provenance after rollback or
    -- revocation. ALLOW must still match the current installation and binding.
    IF p_event->>'decision'='ALLOW' THEN
      IF (p_event->'moduleEvidence'->>'expiresAt')::timestamptz<=clock_timestamp() THEN
        RAISE EXCEPTION 'Current module access expired' USING ERRCODE='PT403';
      END IF;
      IF p_event->>'phase' NOT IN ('INTENT','OUTCOME')
        OR p_event->>'policyVersion' IS DISTINCT FROM 'access-v1:'||(d->>'revision')
        OR (p_event->'moduleEvidence'->>'expiresAt')::timestamptz>clock_timestamp()+interval '30 seconds'
        OR NOT EXISTS(SELECT 1 FROM profitia_modules.installation i,profitia_modules.audit_installation a,
          profitia_modules.application_bindings m JOIN profitia_access.product_grants g ON g.application_id=m.application_id
          WHERE i.singleton AND a.singleton AND i.schema_digest=p_event->'moduleEvidence'->>'moduleSchemaDigest'
            AND a.schema_digest=p_event->'moduleEvidence'->>'auditSchemaDigest'
            AND m.application_id=d->>'applicationId' AND m.module_id=p_event->'moduleEvidence'->>'moduleId'
            AND m.binding_id::text=p_event->'moduleEvidence'->>'moduleBindingId'
            AND m.version::text=p_event->'moduleEvidence'->>'version'
            AND m.source_ref=p_event->'moduleEvidence'->>'sourceRef'
            AND m.status='ACTIVE' AND m.expires_at>= (p_event->'moduleEvidence'->>'expiresAt')::timestamptz
            AND g.organisation_id=(p_event->>'organisationId')::uuid AND g.status='ACTIVE'
            AND (g.product=CASE WHEN m.module_id='supplier_report' THEN 'SUPPLIER_INTELLIGENCE' ELSE 'SPENDGURU' END OR m.module_id='supplier_workspace' AND g.product IN('SPENDGURU','SUPPLIER_INTELLIGENCE'))
            AND g.features @> ARRAY[m.module_id]
            AND g.expires_at>= (p_event->'moduleEvidence'->>'expiresAt')::timestamptz) THEN
        RAISE EXCEPTION 'Current module audit scope unavailable' USING ERRCODE='42501';
      END IF;
      IF p_event->>'phase'='OUTCOME' AND (
        p_event->'moduleEvidence'->>'transactionId' IS DISTINCT FROM txid_current()::text
        OR profitia_modules.scope_allows(p_event->'moduleEvidence'->>'moduleId',(p_event->>'organisationId')::uuid,(p_event->>'actorId')::uuid) IS NOT TRUE
        OR current_setting('profitia.module.'||(p_event->'moduleEvidence'->>'moduleId'),true)::jsonb->>3 IS DISTINCT FROM p_event->'moduleEvidence'->>'moduleBindingId'
        OR current_setting('profitia.module.'||(p_event->'moduleEvidence'->>'moduleId'),true)::jsonb->>4 IS DISTINCT FROM p_event->'moduleEvidence'->>'version') THEN
        RAISE EXCEPTION 'Module outcome scope unavailable' USING ERRCODE='42501';
      END IF;
    END IF;
  END IF;
  IF p_event->'moduleEvidence'->>'moduleId'='supplier_workspace' AND p_event->>'decision'='ALLOW' AND (
p_event->>'applicationId' IS DISTINCT FROM 'srm' OR p_event->>'environment' IS DISTINCT FROM 'development' OR p_event->>'implementationVersion' IS DISTINCT FROM '1.0.0-candidate.26'
OR p_event->>'feature' IS DISTINCT FROM 'supplier_workspace' OR p_event->>'mode' IS DISTINCT FROM 'ORGANISATION' OR p_event->>'dataClass' IS DISTINCT FROM 'ORGANISATION_PRIVATE'
OR p_event->>'ownerOrganisationId' IS DISTINCT FROM p_event->>'organisationId' OR p_event->>'ownerUserId' IS NOT NULL
OR p_event ? 'requestWork' OR p_event ? 'requestInspection' OR p_event ? 'requestContinuation'
OR p_event->>'operation' NOT IN('supplier.catalog.read','supplier.catalog.write','supplier.category.read','supplier.category.write','supplier.pipeline.read','supplier.pipeline.write','supplier.assignment.read','supplier.assignment.write','supplier.adp-status.read')
OR p_event->>'effect' IS DISTINCT FROM CASE WHEN p_event->>'operation' LIKE '%.read' THEN 'READ' ELSE 'WRITE' END) THEN
RAISE EXCEPTION 'Explicit bounded workspace Root required' USING ERRCODE='42501';END IF;
  INSERT INTO profitia_access.security_events(application_id,environment,decision_id,phase,event)
    VALUES(d->>'applicationId',d->>'environment',(p_event->>'decisionId')::uuid,p_event->>'phase',p_event);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
END $function$
;

CREATE OR REPLACE FUNCTION profitia_modules.bind_scope(p_module text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'profitia_modules', 'profitia_access', 'pg_temp'
AS $function$
DECLARE d jsonb; uid uuid; org uuid; module_grant profitia_modules.application_bindings%ROWTYPE;
  required_product text; product_expiry timestamptz; deadline timestamptz; transaction_id text; marker text; previous_marker text;
BEGIN
  d:=profitia_modules.runtime_descriptor();
  uid:=nullif(current_setting('profitia.user_id',true),'')::uuid;
  org:=nullif(current_setting('profitia.organisation_id',true),'')::uuid;
  IF org IS NULL OR profitia_access.scope_allows(d->>'applicationId',org,uid) IS NOT TRUE THEN RETURN NULL; END IF;
  required_product:=CASE p_module WHEN 'benchmark' THEN 'SPENDGURU' WHEN 'category' THEN 'SPENDGURU'
    WHEN 'supplier_report' THEN 'SUPPLIER_INTELLIGENCE' WHEN 'supplier_workspace' THEN 'WORKSPACE_ELIGIBLE' ELSE NULL END;
  IF required_product IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO module_grant FROM profitia_modules.application_bindings
    WHERE application_id=d->>'applicationId' AND module_id=p_module AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT expires_at INTO product_expiry FROM profitia_access.product_grants
    WHERE application_id=d->>'applicationId' AND organisation_id=org AND (product=required_product OR p_module='supplier_workspace' AND product IN('SPENDGURU','SUPPLIER_INTELLIGENCE'))
      AND status='ACTIVE' AND expires_at>clock_timestamp() AND p_module=ANY(features) ORDER BY expires_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  deadline:=least(current_setting('profitia.scope_expires_at')::timestamptz,module_grant.expires_at,product_expiry);
  IF deadline<=clock_timestamp() THEN RETURN NULL; END IF;
  transaction_id:=txid_current()::text;
  marker:=jsonb_build_array(d->>'applicationId',uid,org,module_grant.binding_id,module_grant.version,
    transaction_id,current_setting('profitia.identity_binding_version'),current_setting('profitia.policy_version'))::text;
  previous_marker:=nullif(current_setting('profitia.module.'||p_module,true),'');
  IF previous_marker IS NOT NULL AND previous_marker IS DISTINCT FROM marker THEN RETURN NULL; END IF;
  -- Narrow the existing lease. Its unchanged verifyScope will reject expiry
  -- before OUTCOME/commit, even after the business callback performed a write.
  PERFORM set_config('profitia.scope_expires_at',deadline::text,true);
  PERFORM set_config('profitia.module.'||p_module,marker,true);
  RETURN d || jsonb_build_object('moduleId',p_module,'organisationId',org,'userId',uid,
    'moduleBindingId',module_grant.binding_id,'moduleBindingVersion',module_grant.version::text,
    'moduleSourceRef',module_grant.source_ref,'expiresAt',deadline,'transactionId',transaction_id);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END $function$
;

CREATE OR REPLACE FUNCTION profitia_modules.scope_allows(p_module text, p_org uuid, p_user uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'profitia_modules', 'profitia_access', 'pg_temp'
AS $function$
DECLARE d jsonb; b profitia_modules.application_bindings%ROWTYPE; required_product text;
BEGIN
  d:=profitia_modules.runtime_descriptor();
  IF p_org IS NULL OR profitia_access.scope_allows(d->>'applicationId',p_org,p_user) IS NOT TRUE THEN RETURN false; END IF;
  required_product:=CASE p_module WHEN 'benchmark' THEN 'SPENDGURU' WHEN 'category' THEN 'SPENDGURU'
    WHEN 'supplier_report' THEN 'SUPPLIER_INTELLIGENCE' WHEN 'supplier_workspace' THEN 'WORKSPACE_ELIGIBLE' ELSE NULL END;
  IF required_product IS NULL THEN RETURN false; END IF;
  SELECT * INTO b FROM profitia_modules.application_bindings WHERE application_id=d->>'applicationId'
    AND module_id=p_module AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND OR current_setting('profitia.module.'||p_module,true) IS DISTINCT FROM
    jsonb_build_array(d->>'applicationId',nullif(current_setting('profitia.user_id',true),'')::uuid,p_org,
      b.binding_id,b.version,txid_current()::text,current_setting('profitia.identity_binding_version'),
      current_setting('profitia.policy_version'))::text THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM profitia_access.product_grants WHERE application_id=d->>'applicationId'
    AND organisation_id=p_org AND (product=required_product OR p_module='supplier_workspace' AND product IN('SPENDGURU','SUPPLIER_INTELLIGENCE')) AND status='ACTIVE'
    AND expires_at>clock_timestamp() AND p_module=ANY(features));
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $function$
;

CREATE FUNCTION profitia_supplier_workspace.operation_mode(p_operation text) RETURNS text
 LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT CASE WHEN p_operation IN('supplier.catalog.read','supplier.category.read','supplier.pipeline.read',
  'supplier.assignment.read','supplier.adp-status.read') THEN 'READ'
 WHEN p_operation IN('supplier.catalog.write','supplier.category.write','supplier.pipeline.write',
  'supplier.assignment.write') THEN 'WRITE' END $fn$;

CREATE FUNCTION profitia_supplier_workspace.current_scope() RETURNS profitia_supplier_workspace.scopes
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;marker uuid;d jsonb;
BEGIN
 marker:=nullif(current_setting('profitia.supplier_workspace.scope',true),'')::uuid;
 IF marker IS NULL OR session_user<>'srm_private_development_runtime' OR current_database()<>'platform_private' THEN RETURN NULL;END IF;
 SELECT * INTO s FROM profitia_supplier_workspace.scopes WHERE scope_id=marker AND login_role=session_user
  AND backend_pid=pg_backend_pid() AND transaction_id=txid_current()::text AND expires_at>clock_timestamp();
 IF NOT FOUND OR profitia_modules.scope_allows('supplier_workspace',s.organisation_id,s.actor_id) IS NOT TRUE THEN RETURN NULL;END IF;
 d:=profitia_access.runtime_descriptor();
 IF d->>'applicationId'<>'srm' OR d->>'environment'<>'development'
  OR s.access_policy_version IS DISTINCT FROM 'access-v1:'||(d->>'revision')
 OR NOT EXISTS(SELECT 1 FROM profitia_supplier_workspace.organisation_policies p WHERE p.application_id='srm'
  AND p.organisation_id=s.organisation_id AND p.policy_id=s.policy_id AND p.version=s.policy_version
  AND p.status='ACTIVE' AND p.expires_at>clock_timestamp()) THEN RETURN NULL;END IF;
 RETURN s;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END $fn$;

CREATE FUNCTION profitia_supplier_workspace.descriptor() RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;i profitia_supplier_workspace.installation%ROWTYPE;
BEGIN
 s:=profitia_supplier_workspace.current_scope();IF s.scope_id IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO STRICT i FROM profitia_supplier_workspace.installation WHERE singleton;
 RETURN jsonb_build_object('applicationId','srm','environment','development','runtimeRole',s.login_role::text,
  'databaseName',current_database(),'transactionId',s.transaction_id,'organisationId',s.organisation_id::text,
  'actorAccountId',s.actor_id::text,'operation',s.operation,'nativeUnitId','SUPPLIER_WORKSPACE_'||s.access_mode,
  'accessMode',s.access_mode,'payloadDigest',s.payload_digest,'schemaDigest',i.schema_digest,
  'sourceRef',i.source_ref,'policyVersion',s.policy_version::text,'accessPolicyVersion',s.access_policy_version,
  'expiresAt',s.expires_at::text,'decisionId',s.decision_id::text,'resourceId',s.resource_id);
END $fn$;

CREATE FUNCTION profitia_supplier_workspace.bind_operation(p_decision uuid,p_digest text,p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e jsonb;d jsonb;identity_row profitia_access.external_identities%ROWTYPE;state jsonb;
 mode text;writes text[];command_operation text;deadline timestamptz;id uuid;existing profitia_supplier_workspace.scopes%ROWTYPE;policy profitia_supplier_workspace.organisation_policies%ROWTYPE;
BEGIN
 IF session_user<>'srm_private_development_runtime' OR current_database()<>'platform_private'
  OR p_decision IS NULL OR p_digest!~'^[a-f0-9]{64}$' THEN RETURN NULL;END IF;
 d:=profitia_access.runtime_descriptor();
 IF d->>'applicationId'<>'srm' OR d->>'environment'<>'development' THEN RETURN NULL;END IF;
 SELECT event INTO e FROM profitia_access.security_events WHERE decision_id=p_decision AND phase='INTENT'
  AND application_id='srm' AND environment='development' AND event->>'decision'='ALLOW';
 IF NOT FOUND OR e->>'implementationVersion' IS DISTINCT FROM '1.0.0-candidate.26'
  OR e->>'payloadDigest' IS DISTINCT FROM p_digest OR e->>'actorKind' IS DISTINCT FROM 'HUMAN'
  OR e->>'subjectUserId' IS DISTINCT FROM e->>'actorId'
  OR e->'moduleEvidence'->>'moduleId' IS DISTINCT FROM 'supplier_workspace'
  OR e->'moduleEvidence'->>'transactionId' IS DISTINCT FROM txid_current()::text
  OR e->>'dataClass' IS DISTINCT FROM 'ORGANISATION_PRIVATE' OR e->>'ownerUserId' IS NOT NULL
  OR e->>'ownerOrganisationId' IS DISTINCT FROM e->>'organisationId'
  OR e->>'feature' IS DISTINCT FROM 'supplier_workspace' OR e->>'mode' IS DISTINCT FROM 'ORGANISATION'
  OR e ? 'requestWork' OR e ? 'requestInspection' OR e ? 'requestContinuation'
  OR profitia_modules.scope_allows('supplier_workspace',(e->>'organisationId')::uuid,(e->>'actorId')::uuid) IS NOT TRUE
  OR coalesce(current_setting('profitia.module.supplier_report',true),'')<>''
  OR EXISTS(SELECT 1 FROM profitia_access.security_events other WHERE other.phase='INTENT'
    AND other.event->'moduleEvidence'->>'transactionId'=txid_current()::text
    AND other.event->'moduleEvidence'->>'moduleId'<>'supplier_workspace')
 THEN RETURN NULL;END IF;
 SELECT * INTO policy FROM profitia_supplier_workspace.organisation_policies WHERE application_id='srm'
  AND organisation_id=(e->>'organisationId')::uuid AND status='ACTIVE' AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL;END IF;
 mode:=profitia_supplier_workspace.operation_mode(e->>'operation');
 IF mode IS NULL OR e->>'effect' IS DISTINCT FROM mode
  OR p_payload IS NULL OR octet_length(p_payload::text)>131072
  OR encode(sha256(convert_to(profitia_supplier_workspace.canonical_json(p_payload),'UTF8')),'hex') IS DISTINCT FROM p_digest
 THEN RETURN NULL;END IF;
 writes:=ARRAY[]::text[];
 IF mode='WRITE' THEN
  command_operation:=CASE
   WHEN p_payload->>'command' IN('SUPPLIER_CREATE','SUPPLIER_UPDATE','SUPPLIER_ARCHIVE','SUPPLIER_RESTORE') THEN 'supplier.catalog.write'
   WHEN p_payload->>'command' IN('CATEGORY_CREATE','CATEGORY_UPDATE','CATEGORY_ARCHIVE','CATEGORY_RESTORE','SUPPLIER_CATEGORY_ADD','SUPPLIER_CATEGORY_REMOVE') THEN 'supplier.category.write'
   WHEN p_payload->>'command' IN('PIPELINE_CREATE','PIPELINE_UPDATE','PIPELINE_ARCHIVE','PIPELINE_RESTORE','STAGE_ADD','STAGES_UPDATE','STAGE_REMOVE') THEN 'supplier.pipeline.write'
   WHEN p_payload->>'command' IN('MEMBERSHIP_ADD','MEMBERSHIP_MOVE','MEMBERSHIP_END','SUPPLIER_TRANSFER') THEN 'supplier.assignment.write' END;
  IF command_operation IS DISTINCT FROM e->>'operation' THEN RETURN NULL;END IF;
  writes:=ARRAY[command_operation];
  IF p_payload->>'command' IN('SUPPLIER_ARCHIVE','PIPELINE_ARCHIVE','STAGE_REMOVE')
   AND jsonb_typeof(p_payload->'data'->'expectedCount')='number'
   AND (p_payload->'data'->>'expectedCount')::numeric>0 THEN writes:=array_append(writes,'supplier.assignment.write');END IF;
  IF p_payload->>'command'='SUPPLIER_CREATE' AND jsonb_typeof(p_payload->'data'->'categoryIds')='array'
   AND jsonb_array_length(p_payload->'data'->'categoryIds')>0 THEN writes:=array_append(writes,'supplier.category.write');END IF;
 END IF;
 SELECT ex.* INTO identity_row FROM profitia_access.external_identities ex
 JOIN profitia_access.accounts a ON a.user_id=ex.user_id
 WHERE ex.user_id=(e->>'actorId')::uuid AND ex.issuer=e->>'identityIssuer'
  AND ex.binding_id::text||':'||ex.version::text||':'||a.version::text=current_setting('profitia.identity_binding_version',true)
  AND ex.status='ACTIVE' AND a.status='ACTIVE' AND ex.expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL;END IF;
 -- Reuse the canonical SQL membership/permission resolver, never roles from JSON.
 state:=profitia_access.lock_access(identity_row.user_id,(e->>'organisationId')::uuid,identity_row.issuer,
  identity_row.subject,current_setting('profitia.identity_binding_version'));
 IF state IS NULL OR state->>'policyVersion' IS DISTINCT FROM e->>'policyVersion'
  OR state->'access'->>'type'<>'MEMBERSHIP' OR state->'access'->>'status'<>'ACTIVE'
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(state->'access'->'permissions') p
    WHERE p->>'operation'=e->>'operation' AND p->>'feature'='supplier_workspace'
      AND(p->>'resourceId' IS NULL OR p->>'resourceId'=e->>'resourceId'))
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(state->'access'->'denies') p
    WHERE p->>'operation'=e->>'operation' AND p->>'feature'='supplier_workspace')
 THEN RETURN NULL;END IF;
 deadline:=least(current_setting('profitia.scope_expires_at')::timestamptz,
  (e->'moduleEvidence'->>'expiresAt')::timestamptz,(state->'access'->>'expiresAt')::timestamptz,policy.expires_at);
 IF deadline<=clock_timestamp() THEN RETURN NULL;END IF;
 SELECT * INTO existing FROM profitia_supplier_workspace.scopes WHERE login_role=session_user
  AND backend_pid=pg_backend_pid() AND transaction_id=txid_current()::text;
 IF FOUND THEN
  IF existing.decision_id<>p_decision OR existing.payload_digest<>p_digest THEN RETURN NULL;END IF;
  id:=existing.scope_id;
 ELSE
  INSERT INTO profitia_supplier_workspace.scopes(login_role,backend_pid,transaction_id,decision_id,
   organisation_id,actor_id,policy_id,policy_version,operation,resource_id,payload_digest,access_mode,allowed_write_operations,access_state,access_policy_version,expires_at)
  VALUES(session_user,pg_backend_pid(),txid_current()::text,p_decision,(e->>'organisationId')::uuid,
   (e->>'actorId')::uuid,policy.policy_id,policy.version,e->>'operation',e->>'resourceId',p_digest,mode,writes,state->'access',state->>'policyVersion',deadline)
  RETURNING scope_id INTO id;
 END IF;
 PERFORM set_config('profitia.supplier_workspace.scope',id::text,true);
 RETURN profitia_supplier_workspace.descriptor();
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN NULL;
END $fn$;

CREATE FUNCTION profitia_supplier_workspace.scope_allows(p_org uuid,p_operation text,p_resource uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;mode text;
BEGIN
 s:=profitia_supplier_workspace.current_scope();mode:=profitia_supplier_workspace.operation_mode(p_operation);
 IF s.scope_id IS NULL OR p_org IS NULL OR s.organisation_id<>p_org OR mode IS NULL
  OR mode='WRITE' AND (s.access_mode<>'WRITE' OR NOT(p_operation=ANY(s.allowed_write_operations))) THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM jsonb_array_elements(s.access_state->'permissions') p
   WHERE p->>'operation'=p_operation AND p->>'feature'='supplier_workspace'
    AND(p->>'resourceId' IS NULL OR p->>'resourceId'=CASE WHEN p_resource IS NULL THEN s.resource_id ELSE p_resource::text END))
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.access_state->'denies') p
   WHERE p->>'operation'=p_operation AND p->>'feature'='supplier_workspace');
END $fn$;

CREATE FUNCTION profitia_supplier_workspace.member_allowed(p_org uuid,p_account uuid) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT coalesce((profitia_supplier_workspace.current_scope()).organisation_id=p_org AND EXISTS(
  SELECT 1 FROM profitia_access.memberships m JOIN profitia_access.accounts a USING(user_id)
   JOIN profitia_access.organisations o USING(organisation_id)
  WHERE m.organisation_id=p_org AND m.user_id=p_account AND m.status='ACTIVE' AND a.status='ACTIVE'
   AND o.status='ACTIVE' AND m.expires_at>clock_timestamp()),false) $fn$;

CREATE FUNCTION profitia_supplier_workspace.canonical_json(p_value jsonb) RETURNS text
 LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE result text;
BEGIN
 CASE jsonb_typeof(p_value)
 WHEN 'object' THEN SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||
  profitia_supplier_workspace.canonical_json(value),',' ORDER BY key COLLATE "C"),'')||'}' INTO result FROM jsonb_each(p_value);
 WHEN 'array' THEN SELECT '['||coalesce(string_agg(profitia_supplier_workspace.canonical_json(value),',' ORDER BY ord),'')||']'
  INTO result FROM jsonb_array_elements(p_value) WITH ORDINALITY t(value,ord);
 WHEN 'number' THEN result:=trim_scale((p_value#>>'{}')::numeric)::text;
 ELSE result:=p_value::text;
 END CASE;
 RETURN result;
END $fn$;

CREATE FUNCTION profitia_supplier_workspace.assert_payload(p_payload jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;BEGIN
 d:=profitia_supplier_workspace.descriptor();
 IF d IS NULL OR octet_length(p_payload::text)>131072
  OR encode(sha256(convert_to(profitia_supplier_workspace.canonical_json(p_payload),'UTF8')),'hex') IS DISTINCT FROM d->>'payloadDigest'
 THEN RAISE EXCEPTION 'Current exact workspace command required' USING ERRCODE='42501';END IF;
 RETURN d;
END $fn$;

CREATE FUNCTION profitia_supplier_workspace.enforce_outcome() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF (profitia_supplier_workspace.current_scope()).scope_id IS DISTINCT FROM NEW.scope_id
  OR NOT EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.decision_id=NEW.decision_id
    AND s.application_id='srm' AND s.environment='development' AND s.phase='OUTCOME'
    AND s.event->>'decision'='ALLOW' AND s.event->>'reasonCode' IN('SUCCEEDED','NO_DATA')
    AND s.event->>'implementationVersion'='1.0.0-candidate.26'
    AND s.event->>'operation'=NEW.operation AND s.event->>'payloadDigest'=NEW.payload_digest
    AND s.event->>'organisationId'=NEW.organisation_id::text AND s.event->>'subjectUserId'=NEW.actor_id::text
    AND s.event->'moduleEvidence'->>'moduleId'='supplier_workspace'
    AND s.event->'moduleEvidence'->>'transactionId'=NEW.transaction_id)
 THEN RAISE EXCEPTION 'Workspace unit requires current canonical same-transaction OUTCOME' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $fn$;
CREATE CONSTRAINT TRIGGER workspace_outcome AFTER INSERT ON profitia_supplier_workspace.scopes
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION profitia_supplier_workspace.enforce_outcome();

-- Only the controlled, closed domain entry point (SECURITY DEFINER) receives a
-- new master path. Ordinary runtime DML retains exactly its prior report path.
ALTER POLICY private_operation_fence ON srm.suppliers USING (((
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN true
    ELSE (
    CASE
        WHEN ((profitia_access.runtime_descriptor() ->> 'applicationId'::text) = 'srm'::text) THEN profitia_modules.scope_allows('supplier_report'::text, organization_id)
        ELSE srm.delegated_supplier_row('suppliers'::text, organization_id, id, NULL::uuid, NULL::uuid, nip, NULL::text)
    END OR srm.inspected_supplier_row('suppliers'::text, organization_id, id, NULL::uuid, NULL::uuid, nip, NULL::text))
END OR
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN false
    ELSE srm.native_supplier_row('suppliers'::text, organization_id, id, NULL::uuid, NULL::uuid, nip, NULL::text, 'READ'::text)
END)) OR (CURRENT_USER='profitia_access_owner'::name AND profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.write',id))) WITH CHECK (((
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN false
    ELSE
    CASE
        WHEN ((profitia_access.runtime_descriptor() ->> 'applicationId'::text) = 'srm'::text) THEN profitia_modules.scope_allows('supplier_report'::text, organization_id)
        ELSE srm.delegated_supplier_row('suppliers'::text, organization_id, id, NULL::uuid, NULL::uuid, nip, NULL::text)
    END
END OR
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN false
    ELSE srm.native_supplier_row('suppliers'::text, organization_id, id, NULL::uuid, NULL::uuid, nip, NULL::text, 'WRITE'::text)
END OR ((CURRENT_USER = 'profitia_access_owner'::name) AND srm.ready_report_metadata_scope(organization_id, nip)))) OR (CURRENT_USER='profitia_access_owner'::name AND profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.write',id)));
ALTER POLICY inspected_update_fence ON srm.suppliers USING (((
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN false
    ELSE
    CASE
        WHEN ((profitia_access.runtime_descriptor() ->> 'applicationId'::text) = 'srm'::text) THEN profitia_modules.scope_allows('supplier_report'::text, organization_id)
        ELSE srm.delegated_supplier_row('suppliers'::text, organization_id, id, NULL::uuid, NULL::uuid, nip, NULL::text)
    END
END OR
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN false
    ELSE srm.native_supplier_row('suppliers'::text, organization_id, id, NULL::uuid, NULL::uuid, nip, NULL::text, 'WRITE'::text)
END OR ((CURRENT_USER = 'profitia_access_owner'::name) AND (srm.location_admission_installation_descriptor() IS NOT NULL) AND profitia_access.scope_allows('srm'::text, organization_id, (NULLIF(current_setting('profitia.user_id'::text, true), ''::text))::uuid) AND profitia_modules.scope_allows('supplier_report'::text, organization_id, (NULLIF(current_setting('profitia.user_id'::text, true), ''::text))::uuid)))) OR (CURRENT_USER='profitia_access_owner'::name AND profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.write',id)) OR (CURRENT_USER='profitia_access_owner'::name AND (profitia_supplier_workspace.current_scope()).access_mode='WRITE' AND profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.read',id))) WITH CHECK (((
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN false
    ELSE
    CASE
        WHEN ((profitia_access.runtime_descriptor() ->> 'applicationId'::text) = 'srm'::text) THEN profitia_modules.scope_allows('supplier_report'::text, organization_id)
        ELSE srm.delegated_supplier_row('suppliers'::text, organization_id, id, NULL::uuid, NULL::uuid, nip, NULL::text)
    END
END OR
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN false
    ELSE srm.native_supplier_row('suppliers'::text, organization_id, id, NULL::uuid, NULL::uuid, nip, NULL::text, 'WRITE'::text)
END)) OR (CURRENT_USER='profitia_access_owner'::name AND profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.write',id)));
CREATE POLICY workspace_master_lock ON srm.suppliers FOR UPDATE TO profitia_access_owner USING(CURRENT_USER='profitia_access_owner'::name AND (profitia_supplier_workspace.current_scope()).access_mode='WRITE' AND profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.read',id)) WITH CHECK(false);
CREATE POLICY workspace_closed_insert ON srm.suppliers FOR INSERT TO profitia_access_owner
 WITH CHECK(current_user='profitia_access_owner' AND profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.write',id));
CREATE POLICY workspace_closed_update ON srm.suppliers FOR UPDATE TO profitia_access_owner
 USING(current_user='profitia_access_owner' AND profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.write',id))
 WITH CHECK(current_user='profitia_access_owner' AND profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.write',id));
CREATE POLICY workspace_closed_read_isolation ON srm.suppliers AS RESTRICTIVE FOR SELECT TO profitia_access_owner
 USING(CASE WHEN coalesce(current_setting('profitia.supplier_workspace.scope',true),'')<>'' THEN
  profitia_supplier_workspace.scope_allows(organization_id,'supplier.catalog.read',id) ELSE true END);
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_supplier_workspace FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_supplier_workspace FROM PUBLIC;

-- Parent bootstrap: current verified organization in the same native WRITE.
CREATE FUNCTION profitia_supplier_workspace.ensure_organisation() RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s profitia_supplier_workspace.scopes%ROWTYPE;BEGIN
 s:=profitia_supplier_workspace.current_scope();
 IF s.scope_id IS NULL OR s.access_mode<>'WRITE'
  OR profitia_supplier_workspace.scope_allows(s.organisation_id,s.operation,NULL) IS NOT TRUE
 THEN RAISE EXCEPTION 'Current workspace write required' USING ERRCODE='42501';END IF;
 INSERT INTO srm.organizations(id,slug) VALUES(s.organisation_id,'org-'||s.organisation_id::text)
  ON CONFLICT(id) DO NOTHING;
END $fn$;
ALTER POLICY private_operation_fence ON srm.organizations WITH CHECK(((
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN false
    ELSE
    CASE
        WHEN ((profitia_access.runtime_descriptor() ->> 'applicationId'::text) = 'srm'::text) THEN profitia_modules.scope_allows('supplier_report'::text, id)
        ELSE srm.delegated_supplier_row('organizations'::text, id, id, NULL::uuid, NULL::uuid, NULL::text, NULL::text)
    END
END OR
CASE
    WHEN (CURRENT_USER = 'profitia_access_owner'::name) THEN false
    ELSE srm.native_supplier_row('organizations'::text, id, id, NULL::uuid, NULL::uuid, NULL::text, NULL::text, 'WRITE'::text)
END)) OR
 (CURRENT_USER='profitia_access_owner'::name
  AND (profitia_supplier_workspace.current_scope()).access_mode='WRITE'
  AND profitia_supplier_workspace.scope_allows(id,(profitia_supplier_workspace.current_scope()).operation,NULL)));
CREATE POLICY workspace_parent_insert ON srm.organizations FOR INSERT TO profitia_access_owner
 WITH CHECK(CURRENT_USER='profitia_access_owner'::name
  AND (profitia_supplier_workspace.current_scope()).access_mode='WRITE'
  AND profitia_supplier_workspace.scope_allows(id,(profitia_supplier_workspace.current_scope()).operation,NULL));
REVOKE ALL ON FUNCTION profitia_supplier_workspace.ensure_organisation() FROM PUBLIC;

CREATE OR REPLACE FUNCTION srm.guard_supplier_business_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE nip text; lookup_id uuid; section text; phases text[]; d jsonb;
BEGIN
 -- Bounded workspace catalogue lane; original report/sensitive lanes below stay intact.
 IF TG_TABLE_SCHEMA='srm' AND TG_TABLE_NAME='suppliers' THEN
 IF TG_OP IN('INSERT','UPDATE') AND current_user='profitia_access_owner'
  AND profitia_supplier_workspace.scope_allows(NEW.organization_id,'supplier.catalog.write',NEW.id) THEN
  IF (TG_OP='INSERT' OR NEW.nip IS DISTINCT FROM OLD.nip) AND (
   NEW.nip IS NULL OR NEW.nip!~'^[0-9]{10}$' OR NEW.nip='0000000000'
   OR (substr(NEW.nip,1,1)::int*6+substr(NEW.nip,2,1)::int*5+substr(NEW.nip,3,1)::int*7
    +substr(NEW.nip,4,1)::int*2+substr(NEW.nip,5,1)::int*3+substr(NEW.nip,6,1)::int*4
    +substr(NEW.nip,7,1)::int*5+substr(NEW.nip,8,1)::int*6+substr(NEW.nip,9,1)::int*7)%11<>substr(NEW.nip,10,1)::int)
   OR TG_OP='INSERT' AND NEW.krs IS NOT NULL
   OR TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['nip','display_name','updated_at'])
    IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['nip','display_name','updated_at'])
  THEN RAISE EXCEPTION 'Bound catalogue fields and formal NIP required' USING ERRCODE='42501';END IF;
  RETURN NEW;
 END IF;
 END IF;
 IF TG_TABLE_NAME<>'financial_facts' THEN d:=srm.current_supplier_work();END IF;
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
END $function$
;
