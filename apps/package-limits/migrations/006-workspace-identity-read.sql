-- Minimal own-current workspace read; no organisation directory or grants are changed.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR current_database()<>'platform_private'
 OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development'
  AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database())
 OR NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='profitia_profile')
 THEN RAISE EXCEPTION 'PRIVATE_DEVELOPMENT_OWNER_REQUIRED';END IF;
END $guard$;
CREATE TABLE profitia_limits_identity_read.workspace_installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$')
);
ALTER TABLE profitia_limits_identity_read.workspace_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_limits_identity_read.workspace_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_limits_identity_read.workspace_installation TO profitia_access_owner USING(true) WITH CHECK(true);
INSERT INTO profitia_limits_identity_read.workspace_installation VALUES(true,'__WORKSPACE_IDENTITY_SCHEMA_DIGEST__');
CREATE FUNCTION profitia_limits_identity_read.workspace_descriptor() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_limits_identity_read AS $fn$
BEGIN
 PERFORM descriptor();
 IF NOT EXISTS(SELECT 1 FROM workspace_installation WHERE singleton AND schema_digest='__WORKSPACE_IDENTITY_SCHEMA_DIGEST__')
 THEN RAISE EXCEPTION 'WORKSPACE_IDENTITY_UNAVAILABLE';END IF;
 RETURN jsonb_build_object('schemaDigest','__WORKSPACE_IDENTITY_SCHEMA_DIGEST__','environment','development','role',session_user);
END $fn$;
CREATE FUNCTION profitia_limits_identity_read.workspace_context(p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_profile,profitia_limits_identity_read AS $fn$
DECLARE oid uuid;ref text;
BEGIN
 PERFORM workspace_descriptor();
 IF NOT EXISTS(SELECT 1 FROM accounts WHERE user_id=p_actor AND status='ACTIVE') THEN RETURN NULL;END IF;
 SELECT p.organisation_id INTO oid FROM organisation_profiles p JOIN memberships m USING(organisation_id)
 JOIN organisations o USING(organisation_id) LEFT JOIN organisation_user_context c ON c.user_id=m.user_id
 WHERE m.user_id=p_actor AND m.status='ACTIVE' AND m.expires_at>clock_timestamp() AND o.status='ACTIVE'
 ORDER BY(p.organisation_id=c.organisation_id) DESC NULLS LAST,p.created_at DESC,p.organisation_id LIMIT 1 FOR SHARE OF p,m,o;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT source_ref INTO ref FROM product_grants WHERE application_id='spendguru' AND organisation_id=oid
  AND product='SPENDGURU' AND status='ACTIVE' AND expires_at>clock_timestamp()
  AND source_ref~'^package-assignment:[a-f0-9-]{36}:[1-9][0-9]*$' FOR SHARE;
 RETURN jsonb_build_object('userId',p_actor,'organisationId',oid,'applicationId','spendguru','projectionRef',coalesce(ref,''));
END $fn$;
REVOKE ALL ON profitia_limits_identity_read.workspace_installation FROM PUBLIC,profitia_limits_identity_reader;
REVOKE ALL ON FUNCTION profitia_limits_identity_read.workspace_descriptor(),profitia_limits_identity_read.workspace_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION profitia_limits_identity_read.workspace_descriptor(),profitia_limits_identity_read.workspace_context(uuid) TO profitia_limits_identity_reader;
