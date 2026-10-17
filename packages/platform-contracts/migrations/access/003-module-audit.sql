-- Additive module audit envelope, applied AFTER SQL001 and SQL002 by the
-- controlled NOLOGIN owner. No roles, applications, memberships or grants are
-- provisioned. Existing ordinary append_audit ACLs are preserved on replacement.
DO $owner$
BEGIN
  IF current_user<>'profitia_access_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles
    WHERE rolname=current_user AND NOT rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb) THEN
    RAISE EXCEPTION 'Controlled module audit owner required' USING ERRCODE='42501';
  END IF;
END $owner$;
CREATE TABLE profitia_modules.audit_installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  envelope_version text NOT NULL CHECK(envelope_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
ALTER TABLE profitia_modules.audit_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_modules.audit_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_modules.audit_installation TO profitia_access_owner USING(true) WITH CHECK(true);
CREATE TRIGGER audit_installation_revision AFTER INSERT OR UPDATE OR DELETE ON profitia_modules.audit_installation
  FOR EACH STATEMENT EXECUTE FUNCTION profitia_access.bump_revision();
CREATE FUNCTION profitia_modules.audit_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_modules,profitia_access,pg_temp AS $fn$
DECLARE result jsonb;
BEGIN
  PERFORM profitia_access.runtime_descriptor();
  SELECT jsonb_build_object('version',envelope_version,'schemaDigest',schema_digest)
    INTO result FROM profitia_modules.audit_installation WHERE singleton;
  RETURN result;
END $fn$;
REVOKE ALL ON TABLE profitia_modules.audit_installation FROM PUBLIC;
REVOKE ALL ON FUNCTION profitia_modules.audit_descriptor() FROM PUBLIC;

CREATE OR REPLACE FUNCTION profitia_access.append_audit(p_event jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, profitia_access, profitia_modules, pg_temp AS $fn$
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
    OR EXISTS(SELECT 1 FROM jsonb_each(p_event) v WHERE v.key NOT IN ('productEvidence','moduleEvidence')
      AND (jsonb_typeof(v.value) NOT IN ('string','null') OR length(v.value#>>'{}')>512))
    OR (p_event ? 'productEvidence' AND jsonb_typeof(p_event->'productEvidence') IS DISTINCT FROM 'array')
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_event) k WHERE k NOT IN (
      'decisionId','contractId','contractVersion','implementationVersion','applicationId','applicationProfile',
      'deploymentId','configurationVersion','environment','operationStartedAt','occurredAt','operation',
      'actorId','actorKind','subjectUserId','organisationId','identityProofRef','identityIssuer','identityAudience',
      'resourceId','payloadDigest','mode','policyVersion','accessBasisType','accessVersion','accessSourceRef',
      'feature','effect','correlationId','resourceType','dataClass','ownerOrganisationId','ownerUserId',
      'resourceVersion','projectionVersion','productEvidence','moduleEvidence','usagePolicy','phase','decision','reasonCode')) THEN
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
  IF p_event ? 'moduleEvidence' THEN
    IF jsonb_typeof(p_event->'moduleEvidence') IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Module audit evidence invalid' USING ERRCODE='42501';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_event->'moduleEvidence'))<>8
      OR EXISTS(SELECT 1 FROM jsonb_each(p_event->'moduleEvidence') v
        WHERE v.key NOT IN ('moduleId','moduleBindingId','version','sourceRef','expiresAt','transactionId','moduleSchemaDigest','auditSchemaDigest')
          OR jsonb_typeof(v.value) IS DISTINCT FROM 'string' OR length(v.value#>>'{}') NOT BETWEEN 1 AND 256)
      OR coalesce(p_event->'moduleEvidence'->>'moduleId','') NOT IN ('benchmark','category','supplier_report')
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
            AND g.product=CASE WHEN m.module_id='supplier_report' THEN 'SUPPLIER_INTELLIGENCE' ELSE 'SPENDGURU' END
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
  INSERT INTO profitia_access.security_events(application_id,environment,decision_id,phase,event)
    VALUES(d->>'applicationId',d->>'environment',(p_event->>'decisionId')::uuid,p_event->>'phase',p_event);
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'Audit envelope invalid' USING ERRCODE='42501';
END $fn$;

