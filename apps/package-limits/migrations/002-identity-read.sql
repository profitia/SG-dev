-- A separate namespace, created transactionally by the controlled private-store administrator.
-- No canonical account/organisation/membership/grant/policy is changed.
DO $guard$ BEGIN
 IF current_user<>'profitia_access_owner' OR current_database()<>'platform_private' OR NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development' AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database()) THEN RAISE EXCEPTION 'PRIVATE_INSTALLATION_REQUIRED';END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='profitia_limits_identity_read') THEN RAISE EXCEPTION 'EXISTING_ADAPTER_REQUIRES_EXACT_RECEIPT';END IF;
END $guard$;
SET LOCAL search_path=profitia_limits_identity_read,pg_catalog;
CREATE TABLE installation(singleton boolean PRIMARY KEY CHECK(singleton),schema_digest text NOT NULL,installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE installation ENABLE ROW LEVEL SECURITY;ALTER TABLE installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON installation TO profitia_access_owner USING(true) WITH CHECK(true);
INSERT INTO installation(singleton,schema_digest) VALUES(true,'__IDENTITY_SCHEMA_DIGEST__');
CREATE FUNCTION descriptor() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_limits_identity_read AS $fn$
BEGIN
 IF session_user<>'profitia_limits_identity_reader' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (NOT rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit))
 OR pg_has_role(session_user,'profitia_access_owner','MEMBER') OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='neon_superuser' AND pg_has_role(session_user,oid,'MEMBER')) THEN RAISE EXCEPTION 'ORDINARY_IDENTITY_READER_REQUIRED' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton AND environment='development' AND project_id='spring-bread-28217539' AND branch_id='br-sparkling-term-b99l107x' AND database_name=current_database()) OR NOT EXISTS(SELECT 1 FROM profitia_limits_identity_read.installation WHERE singleton AND schema_digest='__IDENTITY_SCHEMA_DIGEST__') THEN RAISE EXCEPTION 'CANONICAL_AUTHORITY_UNAVAILABLE';END IF;
 RETURN jsonb_build_object('projectId','spring-bread-28217539','branchId','br-sparkling-term-b99l107x','database',current_database(),'role',session_user,'schemaDigest','__IDENTITY_SCHEMA_DIGEST__');
END $fn$;
CREATE FUNCTION binding(p_issuer text,p_subject text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_limits_identity_read AS $fn$
DECLARE e record;
BEGIN
 PERFORM profitia_limits_identity_read.descriptor();
 IF p_issuer<>'https://unified-drum-7191.clerk.accounts.dev' OR length(p_subject)>256 THEN RETURN NULL;END IF;
 -- Hold current canonical identity rows through the bounded Limits operation.
 SELECT x.issuer,x.subject,x.user_id,x.binding_id,x.version AS binding_version,a.version AS account_version,x.source_ref,x.expires_at INTO e FROM profitia_access.external_identities x JOIN profitia_access.accounts a USING(user_id)
 WHERE x.issuer=p_issuer AND x.subject=p_subject AND x.status='ACTIVE' AND a.status='ACTIVE' AND x.expires_at>clock_timestamp() FOR SHARE OF x,a;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('environment','development','issuer',e.issuer,'subject',e.subject,'userId',e.user_id,'status','ACTIVE','version',e.binding_id::text||':'||e.binding_version::text||':'||e.account_version::text,'sourceRef',e.source_ref,'expiresAt',e.expires_at);
END $fn$;
CREATE FUNCTION organisations(p_search text,p_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_limits_identity_read AS $fn$
DECLARE r jsonb;
BEGIN PERFORM profitia_limits_identity_read.descriptor();
 IF length(p_search)>256 OR cardinality(p_ids)>100 THEN RAISE EXCEPTION 'BOUNDED_DIRECTORY_REQUIRED';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO r FROM (SELECT organisation_id,display_name,status,version FROM profitia_access.organisations WHERE (p_ids IS NOT NULL AND organisation_id=ANY(p_ids)) OR (p_ids IS NULL AND status='ACTIVE' AND (position(lower(p_search) IN lower(coalesce(display_name,'')))>0 OR organisation_id::text=p_search)) ORDER BY display_name NULLS LAST,organisation_id LIMIT 100) t;
 RETURN r;
END $fn$;
CREATE FUNCTION lock_organisation(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profitia_access,profitia_limits_identity_read AS $fn$
DECLARE o record;
BEGIN PERFORM profitia_limits_identity_read.descriptor();
 SELECT organisation_id,display_name,status,version INTO o FROM profitia_access.organisations WHERE organisation_id=p_id AND status='ACTIVE' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'CANONICAL_ORGANISATION_REQUIRED' USING ERRCODE='23514';END IF;
 RETURN to_jsonb(o);
END $fn$;
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_limits_identity_read FROM PUBLIC,profitia_limits_identity_reader;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_limits_identity_read FROM PUBLIC,profitia_limits_identity_reader;
GRANT USAGE ON SCHEMA profitia_limits_identity_read TO profitia_limits_identity_reader;
GRANT EXECUTE ON FUNCTION profitia_limits_identity_read.descriptor(),profitia_limits_identity_read.binding(text,text),profitia_limits_identity_read.organisations(text,uuid[]),profitia_limits_identity_read.lock_organisation(uuid) TO profitia_limits_identity_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA profitia_limits_identity_read REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
