-- Additive candidate for database-authenticated, organisation-scoped SERVICE
-- reads. No runtime, role, grant, account, product or business table is created.
-- SQL001-004 remain immutable. A controlled operator records the exact digest.
DO $owner$ BEGIN
  IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolinherit) THEN
    RAISE EXCEPTION 'Controlled service-schema owner required' USING ERRCODE='42501';
  END IF;
END $owner$;
CREATE SCHEMA profitia_services AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_services FROM PUBLIC;
CREATE TABLE profitia_services.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton)
    REFERENCES profitia_access.installation(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256
    AND source_ref !~* '(gh[pousr]_|sk_(live|test)_|postgres(ql)?://|Bearer[[:space:]])')
);
CREATE TABLE profitia_services.runtime_bindings (
  login_role name PRIMARY KEY REFERENCES profitia_access.runtime_bindings(login_role),
  binding_id uuid NOT NULL UNIQUE,
  service_id uuid NOT NULL,
  profile_id text NOT NULL CHECK(profile_id IN ('PORR_SUITE','SPENDGURU_SAAS','SUPPLIER_INTELLIGENCE_STANDALONE')),
  deployment_id text NOT NULL CHECK(length(deployment_id) BETWEEN 1 AND 256),
  configuration_version text NOT NULL CHECK(length(configuration_version) BETWEEN 1 AND 256),
  status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256
    AND source_ref !~* '(gh[pousr]_|sk_(live|test)_|postgres(ql)?://|Bearer[[:space:]])'),
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
CREATE TABLE profitia_services.read_grants (
  grant_id uuid PRIMARY KEY,
  login_role name NOT NULL REFERENCES profitia_services.runtime_bindings(login_role),
  organisation_id uuid NOT NULL REFERENCES profitia_access.organisations(organisation_id),
  operation text NOT NULL CHECK(operation IN ('knowledge.read','forecast.read','supplier.report.read')),
  feature text NOT NULL CHECK(feature IN ('market','forecast','supplier_report')),
  resource_id text CHECK(length(resource_id) BETWEEN 1 AND 256 AND resource_id NOT LIKE '%*%'),
  effect text NOT NULL CHECK(effect IN ('ALLOW','DENY')),
  status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256
    AND source_ref !~* '(gh[pousr]_|sk_(live|test)_|postgres(ql)?://|Bearer[[:space:]])'),
  expires_at timestamptz NOT NULL CHECK(isfinite(expires_at)),
  CHECK(feature=CASE operation WHEN 'knowledge.read' THEN 'market'
    WHEN 'forecast.read' THEN 'forecast' WHEN 'supplier.report.read' THEN 'supplier_report' END),
  UNIQUE NULLS NOT DISTINCT(login_role,organisation_id,operation,feature,resource_id,effect)
);
DO $policies$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['installation','runtime_bindings','read_grants'] LOOP
    EXECUTE format('ALTER TABLE profitia_services.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE profitia_services.%I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY controlled_owner ON profitia_services.%I TO profitia_access_owner USING(true) WITH CHECK(true)',t);
    EXECUTE format('CREATE TRIGGER authority_fence BEFORE INSERT OR UPDATE OR DELETE ON profitia_services.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
    EXECUTE format('CREATE TRIGGER authority_truncate_fence BEFORE TRUNCATE ON profitia_services.%I FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision()',t);
    IF t<>'installation' THEN
      EXECUTE format('CREATE TRIGGER advance_version BEFORE UPDATE ON profitia_services.%I FOR EACH ROW EXECUTE FUNCTION profitia_access.advance_version()',t);
    END IF;
  END LOOP;
END $policies$;

CREATE FUNCTION profitia_services.runtime_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_services,pg_temp AS $fn$
DECLARE d jsonb; result jsonb;
BEGIN
  -- Uses session_user and the registered ordinary login, not a supplied ID or GUC.
  d:=profitia_access.runtime_descriptor();
  SELECT jsonb_build_object('schemaVersion',i.schema_version,'schemaDigest',i.schema_digest,
    'serviceId',b.service_id,'profileId',b.profile_id,'deploymentId',b.deployment_id,
    'configurationVersion',b.configuration_version,'sourceRef',b.source_ref,
    'proofRef','database-service:'||b.binding_id::text||':'||b.version::text,
    'expiresAt',least(b.expires_at,clock_timestamp()+interval '30 seconds')) INTO result
    FROM profitia_services.installation i,profitia_services.runtime_bindings b
    WHERE i.singleton AND b.login_role=session_user AND b.status='ACTIVE' AND b.expires_at>clock_timestamp();
  RETURN result;
END $fn$;

-- This check is also used by consumer-owned restrictive SELECT policies. It
-- never grants DML, private data, a paid fetch or permission to execute a job.
CREATE FUNCTION profitia_services.read_allowed(p_org uuid,p_operation text,p_resource text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_services,pg_temp AS $fn$
DECLARE d jsonb; s jsonb; f text; required_product text;
BEGIN
  -- lock_read/scope_allows hold the transaction fence. This pure current-state
  -- check also serves independently committed INTENT and must not enqueue a
  -- second SHARE lock behind a revocation waiting on that product transaction.
  d:=profitia_access.runtime_descriptor();s:=profitia_services.runtime_descriptor();
  f:=CASE p_operation WHEN 'knowledge.read' THEN 'market' WHEN 'forecast.read' THEN 'forecast'
    WHEN 'supplier.report.read' THEN 'supplier_report' END;
  required_product:=CASE WHEN p_operation='supplier.report.read' THEN 'SUPPLIER_INTELLIGENCE' ELSE 'SPENDGURU' END;
  IF s IS NULL OR f IS NULL OR p_resource IS NULL OR length(p_resource) NOT BETWEEN 1 AND 256
    OR p_org IS NULL OR (d->>'fixedOrganisationId' IS NOT NULL AND (d->>'fixedOrganisationId')::uuid<>p_org)
    OR (s->>'profileId'='PORR_SUITE' AND d->>'fixedOrganisationId' IS NULL)
    OR (s->>'profileId'<>'PORR_SUITE' AND d->>'fixedOrganisationId' IS NOT NULL)
    OR (s->>'profileId'='SUPPLIER_INTELLIGENCE_STANDALONE' AND required_product<>'SUPPLIER_INTELLIGENCE')
    OR NOT EXISTS(SELECT 1 FROM profitia_access.organisations WHERE organisation_id=p_org AND status='ACTIVE')
    OR NOT EXISTS(SELECT 1 FROM profitia_access.product_grants g WHERE g.application_id=d->>'applicationId'
      AND g.organisation_id=p_org AND g.product=required_product AND g.features @> ARRAY[f]
      AND g.status='ACTIVE' AND g.expires_at>clock_timestamp()) THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM profitia_services.read_grants g WHERE g.login_role=session_user
      AND g.organisation_id=p_org AND g.operation=p_operation AND g.feature=f AND g.effect='ALLOW'
      AND g.status='ACTIVE' AND g.expires_at>clock_timestamp() AND (g.resource_id IS NULL OR g.resource_id=p_resource))
    AND NOT EXISTS(SELECT 1 FROM profitia_services.read_grants g WHERE g.login_role=session_user
      AND g.organisation_id=p_org AND g.operation=p_operation AND g.feature=f AND g.effect='DENY'
      AND g.status='ACTIVE' AND g.expires_at>clock_timestamp() AND (g.resource_id IS NULL OR g.resource_id=p_resource));
END $fn$;

CREATE FUNCTION profitia_services.lock_read(p_org uuid,p_operation text,p_resource text,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_services,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;products jsonb;deadline timestamptz;f text;
BEGIN
  PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
  d:=profitia_access.runtime_descriptor();s:=profitia_services.runtime_descriptor();
  IF s IS NULL OR s->>'proofRef' IS DISTINCT FROM p_proof
    OR profitia_services.read_allowed(p_org,p_operation,p_resource) IS NOT TRUE THEN RETURN NULL; END IF;
  f:=CASE p_operation WHEN 'knowledge.read' THEN 'market' WHEN 'forecast.read' THEN 'forecast' ELSE 'supplier_report' END;
  SELECT least((s->>'expiresAt')::timestamptz,min(expires_at)) INTO deadline
    FROM profitia_services.read_grants WHERE login_role=session_user AND organisation_id=p_org
      AND operation=p_operation AND status='ACTIVE' AND expires_at>clock_timestamp()
      AND (resource_id IS NULL OR resource_id=p_resource);
  SELECT coalesce(jsonb_agg(jsonb_build_object('product',product,'features',features,'organisationId',organisation_id,
    'environment',d->>'environment','applicationId',application_id,'status',status,'version',version::text,
    'sourceRef',source_ref,'source',source,'expiresAt',expires_at) ORDER BY product),'[]'::jsonb) INTO products
    FROM profitia_access.product_grants WHERE application_id=d->>'applicationId' AND organisation_id=p_org;
  RETURN jsonb_build_object('applicationId',d->>'applicationId','environment',d->>'environment',
    'policyVersion','access-v1:'||(d->>'revision'),'transactionId',txid_current()::text,
    'serviceBindingVersion',p_proof,'products',products,'usagePolicy','NOT_APPLICABLE',
    'access',jsonb_build_object('type','SERVICE_GRANT','actorId',s->>'serviceId','organisationId',p_org,
      'status','ACTIVE','version',p_proof||':'||(d->>'revision'),'sourceRef',s->>'sourceRef','expiresAt',deadline,
      'permissions',jsonb_build_array(jsonb_build_object('operation',p_operation,'feature',f,'resourceId',p_resource)),
      'denies','[]'::jsonb));
END $fn$;

CREATE FUNCTION profitia_services.scope_allows(p_application text,p_org uuid,p_operation text,p_resource text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_services,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;deadline timestamptz;
BEGIN
  PERFORM 1 FROM profitia_access.installation WHERE singleton FOR SHARE;
  d:=profitia_access.runtime_descriptor();s:=profitia_services.runtime_descriptor();
  deadline:=nullif(current_setting('profitia.service.expires_at',true),'')::timestamptz;
  RETURN coalesce(s IS NOT NULL AND p_application=d->>'applicationId'
    AND current_setting('profitia.service.environment',true)=d->>'environment'
    AND current_setting('profitia.service.application_id',true)=d->>'applicationId'
    AND current_setting('profitia.service.service_id',true)=s->>'serviceId'
    AND current_setting('profitia.service.proof_ref',true)=s->>'proofRef'
    AND current_setting('profitia.service.organisation_id',true)=p_org::text
    AND current_setting('profitia.service.operation',true)=p_operation
    AND current_setting('profitia.service.resource_id',true)=p_resource
    AND current_setting('profitia.service.policy_version',true)='access-v1:'||(d->>'revision')
    AND current_setting('profitia.service.transaction_id',true)=txid_current()::text
    AND current_setting('profitia.service.schema_digest',true)=s->>'schemaDigest'
    AND isfinite(deadline) AND deadline>clock_timestamp()
    AND deadline<=clock_timestamp()+interval '30 seconds'
    AND profitia_services.read_allowed(p_org,p_operation,p_resource),false);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $fn$;
-- Constrained entry to the SAME canonical security-event writer. Service roles
-- receive this ACL, never the unrestricted append_audit(jsonb) entry directly.
CREATE FUNCTION profitia_services.append_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_services,pg_temp AS $fn$
DECLARE d jsonb;s jsonb;b profitia_services.runtime_bindings%ROWTYPE;f text;rt text;
BEGIN
  d:=profitia_access.runtime_descriptor();s:=profitia_services.runtime_descriptor();
  SELECT * INTO b FROM profitia_services.runtime_bindings WHERE login_role=session_user;
  IF jsonb_typeof(p_event) IS DISTINCT FROM 'object'
    OR p_event->>'applicationId' IS DISTINCT FROM d->>'applicationId'
    OR p_event->>'environment' IS DISTINCT FROM d->>'environment'
    OR p_event->>'subjectUserId' IS NOT NULL OR p_event ? 'moduleEvidence'
    OR (p_event->>'actorId' IS NULL AND (p_event->>'actorKind' IS NOT NULL OR p_event->>'decision' IS DISTINCT FROM 'DENY'))
    OR (p_event->>'actorId' IS NOT NULL AND (p_event->>'actorKind' IS DISTINCT FROM 'SERVICE'
      OR b.service_id IS NULL OR p_event->>'actorId' IS DISTINCT FROM b.service_id::text
      OR p_event->>'identityIssuer' IS DISTINCT FROM 'urn:profitia:database-service-runtime:v1'
      OR p_event->>'identityAudience' IS DISTINCT FROM d->>'applicationId')) THEN
    RAISE EXCEPTION 'Service audit envelope unavailable' USING ERRCODE='42501';
  END IF;
  IF p_event->>'decision'='ALLOW' THEN
    f:=CASE p_event->>'operation' WHEN 'knowledge.read' THEN 'market' WHEN 'forecast.read' THEN 'forecast' WHEN 'supplier.report.read' THEN 'supplier_report' END;
    rt:=CASE p_event->>'operation' WHEN 'knowledge.read' THEN 'market_knowledge' WHEN 'forecast.read' THEN 'market_forecast' WHEN 'supplier.report.read' THEN 'supplier_report' END;
    IF s IS NULL OR f IS NULL OR p_event->>'phase' NOT IN ('INTENT','OUTCOME')
      OR p_event->>'actorId' IS NULL OR p_event->>'organisationId' IS NULL
      OR p_event->>'applicationProfile' IS DISTINCT FROM s->>'profileId'
      OR p_event->>'deploymentId' IS DISTINCT FROM s->>'deploymentId'
      OR p_event->>'configurationVersion' IS DISTINCT FROM s->>'configurationVersion'
      OR p_event->>'identityProofRef' IS DISTINCT FROM s->>'proofRef'
      OR p_event->>'mode' IS DISTINCT FROM 'ORGANISATION'
      OR p_event->>'accessBasisType' IS DISTINCT FROM 'SERVICE_GRANT'
      OR p_event->>'accessSourceRef' IS DISTINCT FROM s->>'sourceRef'
      OR p_event->>'policyVersion' IS DISTINCT FROM 'access-v1:'||(d->>'revision')
      OR p_event->>'accessVersion' IS DISTINCT FROM (s->>'proofRef')||':'||(d->>'revision')
      OR p_event->>'feature' IS DISTINCT FROM f OR p_event->>'resourceType' IS DISTINCT FROM rt
      OR p_event->>'usagePolicy' IS DISTINCT FROM 'NOT_APPLICABLE' OR p_event->>'effect' IS DISTINCT FROM 'READ'
      OR p_event->>'dataClass' IS DISTINCT FROM 'SHARED_KNOWLEDGE'
      OR p_event->>'ownerOrganisationId' IS NOT NULL OR p_event->>'ownerUserId' IS NOT NULL
      OR profitia_services.read_allowed((p_event->>'organisationId')::uuid,p_event->>'operation',p_event->>'resourceId') IS NOT TRUE THEN
      RAISE EXCEPTION 'Current service audit scope unavailable' USING ERRCODE='42501';
    END IF;
    IF p_event->>'phase'='OUTCOME' AND profitia_services.scope_allows(d->>'applicationId',
      (p_event->>'organisationId')::uuid,p_event->>'operation',p_event->>'resourceId') IS NOT TRUE THEN
      RAISE EXCEPTION 'Service outcome transaction unavailable' USING ERRCODE='42501';
    END IF;
  ELSIF p_event->>'decision' IS DISTINCT FROM 'DENY' OR p_event->>'phase' NOT IN ('DECISION','FAILURE') THEN
    RAISE EXCEPTION 'Service audit decision unavailable' USING ERRCODE='42501';
  END IF;
  PERFORM profitia_access.append_audit(p_event);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'Service audit envelope unavailable' USING ERRCODE='42501';
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_services FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_services FROM PUBLIC;
