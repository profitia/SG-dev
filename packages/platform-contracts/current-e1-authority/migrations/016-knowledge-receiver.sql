-- Native receiving binding only, not a copy of users, grants or product E1.
DO $$ BEGIN IF current_user<>'platform_knowledge_owner' OR current_database()<>'platform_knowledge'
 THEN RAISE EXCEPTION 'EXACT_PK_OWNER_REQUIRED';END IF;END $$;
CREATE TABLE platform_knowledge.authority_bindings(
 login_role name PRIMARY KEY CHECK(login_role IN ('platform_knowledge_api','platform_knowledge_worker')),
 kind text NOT NULL CHECK(kind IN ('API','WORKER')), binding jsonb NOT NULL,
 origin text NOT NULL CHECK(origin='https://platform-knowledge-development-api.onrender.com'),
 authority_origin text NOT NULL CHECK(authority_origin~'^https://[^/?#*]+$'),
 status text NOT NULL CHECK(status IN ('ACTIVE','REVOKED')), expires_at timestamptz NOT NULL,
 CHECK(binding->>'environment'='development' AND binding->>'projectId'='sparkling-sky-79692560'
 AND binding->>'branchId'='br-billowing-grass-b9ko5s4f' AND binding->>'databaseName'='platform_knowledge'
 AND binding->>'role'=login_role::text AND binding->>'knowledgeSchemaDigest'~'^[a-f0-9]{64}$')
);
ALTER TABLE platform_knowledge.authority_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_knowledge.authority_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_binding ON platform_knowledge.authority_bindings TO platform_knowledge_owner USING(true) WITH CHECK(true);
CREATE FUNCTION platform_knowledge.authority_descriptor() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('contract','profitia.current-e1-knowledge/1.0.0','binding',binding,'kind',kind,'origin',origin,'authorityOrigin',authority_origin)
 FROM platform_knowledge.authority_bindings WHERE login_role=session_user AND status='ACTIVE' AND expires_at>clock_timestamp()
 AND binding->>'databaseName'=current_database() $$;
REVOKE ALL ON platform_knowledge.authority_bindings FROM PUBLIC;
REVOKE ALL ON FUNCTION platform_knowledge.authority_descriptor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION platform_knowledge.authority_descriptor() TO platform_knowledge_api,platform_knowledge_worker;
