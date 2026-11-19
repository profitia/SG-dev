-- Additive read-only commercial projection. No package, membership or E1 grant is created.
DO $guard$ BEGIN
 IF current_user<>'profitia_limits_owner' OR current_database()<>'neondb'
 OR NOT EXISTS(SELECT 1 FROM profitia_limits.installation WHERE singleton AND environment='development'
  AND project_id='lingering-thunder-05075810' AND branch_id='br-green-hall-b9s837k0')
 THEN RAISE EXCEPTION 'LIMITS_DEVELOPMENT_OWNER_REQUIRED';END IF;
END $guard$;
CREATE TABLE profitia_limits.workspace_access_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),
 enabled boolean NOT NULL DEFAULT false,
 command_key bytea NOT NULL CHECK(octet_length(command_key)=32),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256)
);
ALTER TABLE profitia_limits.workspace_access_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_limits.workspace_access_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_limits.workspace_access_installation TO profitia_limits_owner USING(true) WITH CHECK(true);
CREATE FUNCTION profitia_limits.workspace_access_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits AS $fn$
DECLARE i workspace_access_installation%ROWTYPE;
BEGIN
 IF session_user<>'profitia_limits_runtime'
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND(NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolinherit))
 OR pg_has_role(session_user,'profitia_limits_owner','MEMBER')
 OR NOT EXISTS(SELECT 1 FROM installation WHERE singleton AND environment='development'
  AND project_id='lingering-thunder-05075810' AND branch_id='br-green-hall-b9s837k0' AND database_name=current_database())
 THEN RAISE EXCEPTION 'ORDINARY_LIMITS_READ_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO i FROM workspace_access_installation WHERE singleton AND enabled;
 IF NOT FOUND OR i.schema_digest<>'__WORKSPACE_ACCESS_SCHEMA_DIGEST__' THEN RAISE EXCEPTION 'WORKSPACE_ACCESS_UNAVAILABLE' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('schemaDigest',i.schema_digest,'environment','development','role',session_user,
  'projectId','lingering-thunder-05075810','branchId','br-green-hall-b9s837k0','databaseName',current_database(),
  'commandKeyFingerprint',encode(public.digest(i.command_key,'sha256'),'hex'),'sourceRef',i.source_ref);
END $fn$;
CREATE FUNCTION profitia_limits.workspace_access(p_actor uuid,p_org uuid,p_application text,p_until bigint,p_tx text,p_projection_ref text,p_proof text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits AS $fn$
DECLARE i workspace_access_installation%ROWTYPE;a assignments%ROWTYPE;r record;expected text;state text;expiry timestamptz;
BEGIN
 PERFORM workspace_access_descriptor();
 SELECT * INTO i FROM workspace_access_installation WHERE singleton AND enabled FOR SHARE;
 IF p_actor IS NULL OR p_org IS NULL OR p_application<>'spendguru' OR p_projection_ref IS NULL OR length(p_projection_ref)>256
 OR p_until<=floor(extract(epoch FROM clock_timestamp())*1000) OR p_until>floor(extract(epoch FROM clock_timestamp())*1000)+10000
 OR p_tx<>pg_current_xact_id()::text THEN RAISE EXCEPTION 'CURRENT_SCOPED_READ_REQUIRED' USING ERRCODE='42501';END IF;
 expected:=encode(public.hmac(convert_to('workspace-access-v1'||chr(31)||session_user||chr(31)||p_actor||chr(31)||p_org||chr(31)||p_application||chr(31)||p_until||chr(31)||p_tx||chr(31)||p_projection_ref,'UTF8'),i.command_key,'sha256'),'hex');
 IF p_proof IS NULL OR p_proof<>expected THEN RAISE EXCEPTION 'CURRENT_SCOPED_READ_REQUIRED' USING ERRCODE='42501';END IF;
 -- Read the immutable effective revision; a future amendment never erases the current one.
 SELECT ass.* INTO a FROM assignments ass WHERE ass.organisation_id=p_org AND ass.product_id='SPENDGURU'
  AND ass.active_from<=clock_timestamp() AND ass.active_until>clock_timestamp() ORDER BY ass.created_at DESC LIMIT 1 FOR SHARE;
 state:='PENDING_PACKAGE';expiry:=to_timestamp(p_until::numeric/1000);
 IF FOUND THEN
  SELECT revision,payload INTO r FROM assignment_revisions WHERE assignment_id=a.id AND effective_at<=clock_timestamp()
   ORDER BY revision DESC LIMIT 1 FOR SHARE;
  IF FOUND AND status_of(r.payload)='ACTIVE'
   AND r.payload->>'commercialState'='OPERATOR_CONFIRMED'
   AND r.payload->>'productId'='SPENDGURU' AND r.payload->>'organisationId'=p_org::text
   AND jsonb_array_length(r.payload->'packageSnapshot'->'capabilities')>0
   -- Existing technical rights remain independent. Only an exact current assignment projection proves this commercial path.
   AND p_projection_ref='package-assignment:'||a.id::text||':'||r.revision::text
  THEN state:='READY';expiry:=least(expiry,a.active_until);END IF;
 END IF;
 RETURN jsonb_build_object('status',state,'userId',p_actor,'organisationId',p_org,'applicationId',p_application,'expiresAt',expiry);
END $fn$;
REVOKE ALL ON profitia_limits.workspace_access_installation FROM PUBLIC,profitia_limits_runtime;
REVOKE ALL ON FUNCTION profitia_limits.workspace_access_descriptor(),profitia_limits.workspace_access(uuid,uuid,text,bigint,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profitia_limits.workspace_access_descriptor(),profitia_limits.workspace_access(uuid,uuid,text,bigint,text,text,text) TO profitia_limits_runtime;
