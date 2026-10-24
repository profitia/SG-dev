-- Optional ordinary-login quota isolation. Requires accepted SQL024.
-- No policy is enabled, no counter reset and no grant is changed here.
-- Existing application defaults retain their exact meaning for other logins.
DO $guard$ BEGIN
 IF current_user<>'profitia_ingestion_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
   AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
   AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid))
  OR EXISTS(SELECT 1 FROM profitia_ingestion.runtime_bindings WHERE status='ACTIVE')
  OR NOT EXISTS(SELECT 1 FROM profitia_ingestion.installation WHERE singleton AND schema_version='1.0.0'
    AND unmetered_schema_digest='9fe56c54c22fe54aa4869966cf00e7347e8c0d040b1d3d8110fc7952a78d5e13')
  OR coalesce(current_setting('profitia.install.role_source_quota_digest',true),'') !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Disabled Source bindings and accepted role-quota extension required' USING ERRCODE='42501';END IF;
END $guard$;
ALTER TABLE profitia_ingestion.installation ADD COLUMN role_quota_schema_digest text CHECK(role_quota_schema_digest~'^[a-f0-9]{64}$');
UPDATE profitia_ingestion.installation SET role_quota_schema_digest=current_setting('profitia.install.role_source_quota_digest'),revision=revision+1 WHERE singleton;
ALTER TABLE profitia_ingestion.budgets ADD COLUMN login_role name;
DROP INDEX profitia_ingestion.one_active_source_budget;
CREATE UNIQUE INDEX one_active_source_budget ON profitia_ingestion.budgets(application_id,source_id,login_role) NULLS NOT DISTINCT WHERE status='ACTIVE';

-- Recompile trigger plans after SQL024 changed counters from integer to bigint.
-- Definitions and authority semantics are identical to SQL008/009.
CREATE OR REPLACE FUNCTION profitia_ingestion.control_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
  IF TG_TABLE_NAME='budgets' AND TG_OP='UPDATE' THEN
    IF NEW.consumed_count<OLD.consumed_count THEN RAISE EXCEPTION 'Budget history cannot decrease' USING ERRCODE='42501'; END IF;
    IF (to_jsonb(NEW)-ARRAY['consumed_count','version'])=(to_jsonb(OLD)-ARRAY['consumed_count','version']) THEN
      NEW.version:=OLD.version;RETURN NEW;
    END IF;
  END IF;
  UPDATE profitia_ingestion.installation SET revision=revision+1 WHERE singleton;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source installation required' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' THEN NEW.version:=OLD.version+1;END IF;
  IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION profitia_external_call.policy_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.admitted_count<>0 THEN RAISE EXCEPTION 'Fresh external policy requires zero admissions' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 IF NEW.admitted_count<OLD.admitted_count THEN RAISE EXCEPTION 'External admissions cannot be refunded' USING ERRCODE='42501';END IF;
 IF NEW.admitted_count<>OLD.admitted_count THEN
  IF NEW.admitted_count<>OLD.admitted_count+1 OR NOT profitia_ingestion.scope_allows(OLD.source_id,OLD.resource_id)
    OR (to_jsonb(NEW)-ARRAY['admitted_count','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['admitted_count','version']) THEN
   RAISE EXCEPTION 'Current source admission required' USING ERRCODE='42501';END IF;NEW.version:=OLD.version;
 ELSE NEW.version:=OLD.version+1;END IF;RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION profitia_ingestion.current_state(p_source text,p_resource text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d jsonb;s profitia_ingestion.sources%ROWTYPE;b profitia_ingestion.budgets%ROWTYPE;deadline timestamptz;grant_expiry timestamptz;
BEGIN
  d:=profitia_ingestion.runtime_descriptor();
  IF d IS NULL OR p_resource IS NULL OR length(p_resource) NOT BETWEEN 1 AND 256 THEN RETURN NULL;END IF;
  SELECT * INTO s FROM profitia_ingestion.sources WHERE source_id=p_source AND status='ACTIVE' AND expires_at>clock_timestamp();
  IF NOT FOUND THEN RETURN NULL;END IF;
  SELECT min(expires_at) INTO grant_expiry FROM profitia_ingestion.grants WHERE login_role=session_user AND source_id=p_source
    AND status='ACTIVE' AND effect='ALLOW' AND expires_at>clock_timestamp() AND (resource_id IS NULL OR resource_id=p_resource);
  IF grant_expiry IS NULL OR EXISTS(SELECT 1 FROM profitia_ingestion.grants WHERE login_role=session_user AND source_id=p_source
    AND status='ACTIVE' AND effect='DENY' AND expires_at>clock_timestamp() AND (resource_id IS NULL OR resource_id=p_resource)) THEN RETURN NULL;END IF;
  -- Exact ordinary login wins over the retained application default. Select
  -- before checking expiry: an expired exact policy must not fall through.
  SELECT * INTO b FROM profitia_ingestion.budgets WHERE application_id=d->>'applicationId' AND source_id=p_source
    AND status='ACTIVE' AND (login_role IS NULL OR login_role=session_user)
    ORDER BY (login_role IS NOT NULL) DESC LIMIT 1;
  IF NOT FOUND OR NOT (b.quota_mode='UNMETERED' OR b.window_start<=clock_timestamp()
    AND b.window_end>clock_timestamp() AND b.expires_at>clock_timestamp()) THEN RETURN NULL;END IF;
  deadline:=least((d->>'expiresAt')::timestamptz,s.expires_at,grant_expiry,b.expires_at,b.window_end);
  RETURN jsonb_build_object('applicationId',d->>'applicationId','environment',d->>'environment','policyVersion','source-v1:'||(d->>'revision'),
    'transactionId',txid_current()::text,'serviceBindingVersion',d->>'proofRef','usagePolicy','PLATFORM_BUDGET','products','[]'::jsonb,
    'access',jsonb_build_object('type','SERVICE_GRANT','actorId',d->>'serviceId','organisationId',NULL,'status','ACTIVE',
      'version',(d->>'proofRef')||':'||(d->>'revision'),'sourceRef',d->>'sourceRef','expiresAt',deadline,
      'permissions',jsonb_build_array(jsonb_build_object('operation','knowledge.ingest','feature','knowledge_ingestion','resourceId',p_resource)),'denies','[]'::jsonb),
    'resource',jsonb_build_object('id',p_resource,'type','shared_knowledge','environment',d->>'environment','dataClass',s.data_class,
      'ownerOrganisationId',NULL,'ownerUserId',NULL,'version',s.version::text,'projectionVersion',s.projection_version,'approvedSharedProjection',true),
    'ingestion',jsonb_build_object('sourceId',s.source_id,'effectKind',s.effect_kind,'sourceVersion',s.version::text,'sourceRef',s.source_ref,
      'payloadSchema',s.payload_schema,'qualityVersion',s.quality_version,'classificationVersion',s.classification_version,'expiresAt',deadline,
      'quotaMode',b.quota_mode,'unmeteredSchemaDigest',d->>'unmeteredSchemaDigest','policyId',b.policy_id,'policyVersion',b.version::text,'unit',b.unit,'capacity',b.capacity,'used',b.consumed_count,
      'windowStart',b.window_start,'windowEnd',b.window_end,'policySourceRef',b.source_ref));
END $fn$;
REVOKE ALL ON FUNCTION profitia_ingestion.current_state(text,text) FROM PUBLIC;
