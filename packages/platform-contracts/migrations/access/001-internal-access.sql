-- Candidate schema. Execute once in a transaction as the separately provisioned
-- NOLOGIN, NOINHERIT, NOBYPASSRLS profitia_access_owner role. No live bootstrap.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' THEN
    RAISE EXCEPTION 'Explicit access-schema owner required';
  END IF;
END $guard$;
CREATE SCHEMA profitia_access AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_access FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE profitia_access.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  schema_version text NOT NULL CHECK (schema_version = '1.0.0'),
  schema_digest text NOT NULL CHECK (schema_digest ~ '^[a-f0-9]{64}$'),
  environment text NOT NULL CHECK (environment IN ('development','staging','production')),
  project_id text NOT NULL CHECK (length(project_id) BETWEEN 3 AND 128),
  branch_id text NOT NULL CHECK (length(branch_id) BETWEEN 3 AND 128),
  database_name name NOT NULL,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0)
);
CREATE TABLE profitia_access.accounts (
  user_id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('ACTIVE','DISABLED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE TABLE profitia_access.external_identities (
  binding_id uuid NOT NULL UNIQUE,
  issuer text NOT NULL CHECK (issuer ~ '^https://[^/?#]+$'),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 256),
  user_id uuid NOT NULL REFERENCES profitia_access.accounts(user_id),
  status text NOT NULL CHECK (status IN ('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at)),
  PRIMARY KEY (issuer,subject)
);
CREATE TABLE profitia_access.organisations (
  organisation_id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE TABLE profitia_access.applications (
  application_id text PRIMARY KEY CHECK (length(application_id) BETWEEN 1 AND 128),
  status text NOT NULL CHECK (status IN ('ACTIVE','DISABLED')),
  fixed_organisation_id uuid REFERENCES profitia_access.organisations(organisation_id)
);
CREATE TABLE profitia_access.runtime_bindings (
  login_role name PRIMARY KEY,
  application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
  status text NOT NULL CHECK (status IN ('ACTIVE','DISABLED'))
);
CREATE TABLE profitia_access.memberships (
  organisation_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),
  user_id uuid NOT NULL REFERENCES profitia_access.accounts(user_id),
  status text NOT NULL CHECK (status IN ('ACTIVE','SUSPENDED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at)),
  PRIMARY KEY (organisation_id,user_id)
);
-- Role labels do not confer implicit rights. These are explicit per-app grants.
CREATE TABLE profitia_access.permission_grants (
  grant_id uuid PRIMARY KEY,
  application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
  organisation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  effect text NOT NULL CHECK (effect IN ('ALLOW','DENY')),
  operation text NOT NULL CHECK (length(operation) BETWEEN 1 AND 128 AND operation NOT LIKE '%*%'),
  feature text NOT NULL CHECK (length(feature) BETWEEN 1 AND 128 AND feature NOT LIKE '%*%'),
  resource_id text CHECK (length(resource_id) BETWEEN 1 AND 256),
  FOREIGN KEY (organisation_id,user_id) REFERENCES profitia_access.memberships(organisation_id,user_id),
  UNIQUE NULLS NOT DISTINCT (application_id,organisation_id,user_id,effect,operation,feature,resource_id)
);
CREATE TABLE profitia_access.product_grants (
  application_id text NOT NULL REFERENCES profitia_access.applications(application_id),
  organisation_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),
  product text NOT NULL CHECK (product IN ('SPENDGURU','SUPPLIER_INTELLIGENCE')),
  features text[] NOT NULL CHECK (cardinality(features) > 0 AND array_position(features,NULL) IS NULL),
  status text NOT NULL CHECK (status IN ('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  source text NOT NULL CHECK (source IN ('CONTRACT','VERIFIED_BILLING','EXPLICIT_OFFER')),
  source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 256),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at)),
  PRIMARY KEY (application_id,organisation_id,product)
);
CREATE TABLE profitia_access.security_events (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  application_id text NOT NULL,
  environment text NOT NULL,
  decision_id uuid NOT NULL,
  phase text NOT NULL CHECK (phase IN ('INTENT','OUTCOME','DECISION','FAILURE')),
  event jsonb NOT NULL CHECK (jsonb_typeof(event) = 'object' AND octet_length(event::text) <= 16384),
  UNIQUE (application_id,environment,decision_id,phase)
);

-- All access mutations, including newly inserted DENY rows, conflict with the
-- shared installation fence held until the product transaction commits.
CREATE FUNCTION profitia_access.bump_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, profitia_access AS $fn$
BEGIN
  UPDATE profitia_access.installation SET revision=revision+1 WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'Installation must be initialized first'; END IF;
  RETURN NULL;
END $fn$;
CREATE FUNCTION profitia_access.advance_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, profitia_access AS $fn$
BEGIN NEW.version := OLD.version+1; RETURN NEW; END $fn$;
DO $policies$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['installation','accounts','external_identities','organisations','applications','runtime_bindings','memberships','permission_grants','product_grants','security_events'] LOOP
    EXECUTE format('ALTER TABLE profitia_access.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_access.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_access.%I TO profitia_access_owner USING (true) WITH CHECK (true)',t);
    IF t NOT IN ('installation','security_events') THEN
      EXECUTE format('CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_access.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
      EXECUTE format('CREATE TRIGGER authority_truncate_fence BEFORE TRUNCATE ON profitia_access.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
    END IF;
    IF t IN ('accounts','external_identities','organisations','memberships','product_grants') THEN
      EXECUTE format('CREATE TRIGGER advance_version BEFORE UPDATE ON profitia_access.%I FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version()',t);
    END IF;
  END LOOP;
END $policies$;

-- SECURITY DEFINER has the explicitly scoped NOLOGIN owner policy above.
-- Runtime cannot assume this role, access tables or change these functions.
CREATE FUNCTION profitia_access.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, profitia_access AS $fn$
DECLARE d jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit))
    OR pg_has_role(session_user,'profitia_access_owner','MEMBER')
    OR EXISTS (SELECT 1 FROM pg_roles n WHERE n.rolname='neon_superuser' AND pg_has_role(session_user,n.oid,'MEMBER')) THEN
    RAISE EXCEPTION 'Ordinary isolated runtime required' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object('applicationId',b.application_id,'environment',i.environment,
    'projectId',i.project_id,'branchId',i.branch_id,'databaseName',i.database_name,
    'schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,'revision',i.revision,'role',session_user,
    'fixedOrganisationId',a.fixed_organisation_id)
    INTO d FROM profitia_access.installation i
    JOIN profitia_access.runtime_bindings b ON b.login_role=session_user AND b.status='ACTIVE'
    JOIN profitia_access.applications a ON a.application_id=b.application_id AND a.status='ACTIVE'
    WHERE i.singleton AND i.database_name=current_database();
  IF d IS NULL THEN RAISE EXCEPTION 'Runtime binding unavailable' USING ERRCODE='42501'; END IF;
  RETURN d;
END $fn$;

CREATE FUNCTION profitia_access.identity_binding(p_issuer text,p_subject text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, profitia_access AS $fn$
DECLARE d jsonb; result jsonb;
BEGIN
  d := profitia_access.runtime_descriptor();
  SELECT jsonb_build_object('environment',d->>'environment','issuer',e.issuer,'subject',e.subject,
    'userId',e.user_id,'status','ACTIVE','version',e.binding_id::text||':'||e.version::text||':'||u.version::text,
    'sourceRef',e.source_ref,'expiresAt',e.expires_at)
    INTO result FROM profitia_access.external_identities e
    JOIN profitia_access.accounts u USING(user_id)
    WHERE e.issuer=p_issuer AND e.subject=p_subject AND e.status='ACTIVE'
      AND u.status='ACTIVE' AND e.expires_at>clock_timestamp();
  RETURN result;
END $fn$;

CREATE FUNCTION profitia_access.lock_access(p_user uuid,p_org uuid,p_issuer text,p_subject text,p_binding_version text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, profitia_access AS $fn$
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
      INTO permissions,denies FROM profitia_access.permission_grants
      WHERE application_id=d->>'applicationId' AND organisation_id=p_org AND user_id=p_user;
    access := jsonb_build_object('type','MEMBERSHIP','actorId',p_user,'organisationId',p_org,
      'status','ACTIVE','version',m.version::text||':'||v_revision::text,'sourceRef',m.source_ref,
      'expiresAt',least(binding_expiry,m.expires_at,clock_timestamp()+interval '30 seconds'),'permissions',permissions,'denies',denies);
    SELECT coalesce(jsonb_agg(jsonb_build_object('product',product,'features',features,'organisationId',organisation_id,
      'environment',d->>'environment','applicationId',application_id,'status',status,
      'version',version::text,'sourceRef',source_ref,'source',source,'expiresAt',expires_at) ORDER BY product),'[]'::jsonb)
      INTO products FROM profitia_access.product_grants
      WHERE application_id=d->>'applicationId' AND organisation_id=p_org;
  END IF;
  RETURN jsonb_build_object('applicationId',d->>'applicationId','environment',d->>'environment',
    'policyVersion','access-v1:'||v_revision::text,'identityBindingVersion',p_binding_version,
    'access',access,'products',products,'usagePolicy','NOT_APPLICABLE','transactionId',txid_current()::text);
END $fn$;

-- This helper adds row boundaries to product tables; it does not authenticate
-- a SQL credential or grant the operation. Only trusted backend sets LOCAL GUCs.
CREATE FUNCTION profitia_access.scope_allows(p_application text,p_org uuid,p_user uuid DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, profitia_access AS $fn$
DECLARE d jsonb; uid uuid; oid uuid;
BEGIN
  d := profitia_access.runtime_descriptor();
  uid := nullif(current_setting('profitia.user_id',true),'')::uuid;
  oid := nullif(current_setting('profitia.organisation_id',true),'')::uuid;
  IF uid IS NULL OR p_application IS DISTINCT FROM d->>'applicationId'
    OR current_setting('profitia.application_id',true) IS DISTINCT FROM d->>'applicationId'
    OR current_setting('profitia.environment',true) IS DISTINCT FROM d->>'environment'
    OR current_setting('profitia.policy_version',true) IS DISTINCT FROM 'access-v1:'||(d->>'revision')
    OR current_setting('profitia.transaction_id',true) IS DISTINCT FROM txid_current()::text
    OR coalesce(isfinite(nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz)
      AND nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz>clock_timestamp()
      AND nullif(current_setting('profitia.scope_expires_at',true),'')::timestamptz<=clock_timestamp()+interval '30 seconds',false) IS NOT TRUE
    OR NOT EXISTS(SELECT 1 FROM profitia_access.accounts WHERE user_id=uid AND status='ACTIVE') THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM profitia_access.external_identities e JOIN profitia_access.accounts a USING(user_id)
    WHERE e.user_id=uid AND e.status='ACTIVE' AND e.expires_at>clock_timestamp()
      AND e.binding_id::text||':'||e.version::text||':'||a.version::text=current_setting('profitia.identity_binding_version',true)) THEN RETURN false; END IF;
  IF p_org IS NULL THEN RETURN oid IS NULL AND p_user=uid; END IF;
  RETURN oid=p_org AND (p_user IS NULL OR p_user=uid)
    AND (d->>'fixedOrganisationId' IS NULL OR (d->>'fixedOrganisationId')::uuid=oid)
    AND EXISTS(SELECT 1 FROM profitia_access.memberships m JOIN profitia_access.organisations o USING(organisation_id)
      WHERE m.organisation_id=oid AND m.user_id=uid AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE');
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $fn$;

CREATE FUNCTION profitia_access.append_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, profitia_access AS $fn$
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
    OR EXISTS(SELECT 1 FROM jsonb_each(p_event) v WHERE v.key<>'productEvidence'
      AND (jsonb_typeof(v.value) NOT IN ('string','null') OR length(v.value#>>'{}')>512))
    OR (p_event ? 'productEvidence' AND jsonb_typeof(p_event->'productEvidence') IS DISTINCT FROM 'array')
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_event) k WHERE k NOT IN (
      'decisionId','contractId','contractVersion','implementationVersion','applicationId','applicationProfile',
      'deploymentId','configurationVersion','environment','operationStartedAt','occurredAt','operation',
      'actorId','actorKind','subjectUserId','organisationId','identityProofRef','identityIssuer','identityAudience',
      'resourceId','payloadDigest','mode','policyVersion','accessBasisType','accessVersion','accessSourceRef',
      'feature','effect','correlationId','resourceType','dataClass','ownerOrganisationId','ownerUserId',
      'resourceVersion','projectionVersion','productEvidence','usagePolicy','phase','decision','reasonCode')) THEN
    RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
  END IF;
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
  INSERT INTO profitia_access.security_events(application_id,environment,decision_id,phase,event)
    VALUES(d->>'applicationId',d->>'environment',(p_event->>'decisionId')::uuid,p_event->>'phase',p_event);
END $fn$;

REVOKE ALL ON ALL TABLES IN SCHEMA profitia_access FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA profitia_access FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_access FROM PUBLIC;
