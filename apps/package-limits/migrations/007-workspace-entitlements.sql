-- Additional read-only own-current assignment port. No operator/grant writes.
DO $guard$ BEGIN
 IF current_user<>'profitia_limits_owner' OR current_database()<>'neondb'
 OR NOT EXISTS(SELECT 1 FROM profitia_limits.installation WHERE singleton AND environment='development'
  AND project_id='lingering-thunder-05075810' AND branch_id='br-green-hall-b9s837k0')
 THEN RAISE EXCEPTION 'LIMITS_DEVELOPMENT_OWNER_REQUIRED';END IF;
END $guard$;
CREATE TABLE profitia_limits.workspace_entitlements_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 enabled boolean NOT NULL DEFAULT false);
ALTER TABLE profitia_limits.workspace_entitlements_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_limits.workspace_entitlements_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_limits.workspace_entitlements_installation TO profitia_limits_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_limits.workspace_entitlements_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits AS $fn$
DECLARE d jsonb;dg text;BEGIN
 d:=workspace_access_descriptor();
 SELECT schema_digest INTO dg FROM workspace_entitlements_installation WHERE singleton AND enabled;
 IF dg IS NULL OR dg<>'__WORKSPACE_ENTITLEMENTS_SCHEMA_DIGEST__' THEN RAISE EXCEPTION 'WORKSPACE_ENTITLEMENTS_UNAVAILABLE' USING ERRCODE='42501';END IF;
 RETURN d||jsonb_build_object('entitlementsSchemaDigest',dg);
END $fn$;
CREATE FUNCTION profitia_limits.workspace_entitlements(p_actor uuid,p_org uuid,p_application text,p_until bigint,p_tx text,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits AS $fn$
DECLARE a assignments%ROWTYPE;r record;k bytea;expected text;active boolean:=false;ref text;caps jsonb:='[]'::jsonb;assignment_until timestamptz;
BEGIN
 PERFORM workspace_entitlements_descriptor();
 IF p_actor IS NULL OR p_org IS NULL OR p_application IS DISTINCT FROM 'spendguru'
  OR p_tx IS DISTINCT FROM pg_current_xact_id()::text OR p_until IS NULL
  OR p_until<=floor(extract(epoch FROM clock_timestamp())*1000) OR p_until>floor(extract(epoch FROM clock_timestamp())*1000)+5000
 THEN RAISE EXCEPTION 'CURRENT_SCOPED_ENTITLEMENT_READ_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT command_key INTO k FROM workspace_access_installation WHERE singleton AND enabled FOR SHARE;
 expected:=encode(public.hmac(convert_to('workspace-entitlements-v1'||chr(31)||session_user||chr(31)||p_actor||chr(31)||p_org||chr(31)||p_application||chr(31)||p_until||chr(31)||p_tx,'UTF8'),k,'sha256'),'hex');
 IF p_proof IS NULL OR p_proof<>expected THEN RAISE EXCEPTION 'CURRENT_SCOPED_ENTITLEMENT_READ_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT ass.* INTO a FROM assignments ass WHERE ass.organisation_id=p_org AND ass.product_id='SPENDGURU'
  AND ass.active_from<=clock_timestamp() AND ass.active_until>clock_timestamp() ORDER BY ass.created_at DESC,ass.id LIMIT 1 FOR SHARE;
 IF FOUND THEN
  SELECT revision,payload INTO r FROM assignment_revisions WHERE assignment_id=a.id AND effective_at<=clock_timestamp()
   ORDER BY revision DESC LIMIT 1 FOR SHARE;
  IF FOUND AND status_of(r.payload)='ACTIVE' AND r.payload->>'commercialState'='OPERATOR_CONFIRMED'
   AND r.payload->>'productId'='SPENDGURU' AND r.payload->>'organisationId'=p_org::text
   AND jsonb_typeof(r.payload->'packageSnapshot'->'capabilities')='array'
   AND jsonb_array_length(r.payload->'packageSnapshot'->'capabilities') BETWEEN 1 AND 32
  THEN
   caps:=r.payload->'packageSnapshot'->'capabilities';
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(caps) c WHERE jsonb_typeof(c)<>'string'
    OR c#>>'{}' NOT IN('SEATS','BENCHMARK','FORECAST','REPORTS','OPENAI_ASSISTANCE','SUPPLIER_INTELLIGENCE','EXPORTS'))
   THEN RAISE EXCEPTION 'UNMAPPED_CAPABILITY_REQUIRES_REVIEW' USING ERRCODE='42501';END IF;
   active:=true;ref:='package-assignment:'||a.id::text||':'||r.revision::text;assignment_until:=a.active_until;
  END IF;
 END IF;
 RETURN jsonb_build_object('status',CASE WHEN active THEN 'ACTIVE' ELSE 'INACTIVE' END,'userId',p_actor,'organisationId',p_org,
  'applicationId',p_application,'assignmentRef',ref,'capabilities',caps,'expiresAt',to_timestamp(p_until::numeric/1000),'assignmentUntil',assignment_until);
END $fn$;
REVOKE ALL ON profitia_limits.workspace_entitlements_installation FROM PUBLIC,profitia_limits_runtime;
REVOKE ALL ON FUNCTION profitia_limits.workspace_entitlements_descriptor(),
 profitia_limits.workspace_entitlements(uuid,uuid,text,bigint,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profitia_limits.workspace_entitlements_descriptor(),
 profitia_limits.workspace_entitlements(uuid,uuid,text,bigint,text,text) TO profitia_limits_runtime;
