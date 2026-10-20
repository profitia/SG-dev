-- Shared universal metadata projection for the ORIGINAL Finder ORM. No login,
-- runtime ACL, receipt, source write or private query history is created here.
SET LOCAL search_path=pg_catalog,pg_temp;
DO $$ BEGIN
 IF current_user<>'profitia_market_read_owner' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole OR rolreplication)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=oid)) THEN
  RAISE EXCEPTION 'Controlled shared metadata projection owner required' USING ERRCODE='42501';END IF;
END $$;
CREATE SCHEMA profitia_metadata_read AUTHORIZATION profitia_market_read_owner;
REVOKE ALL ON SCHEMA profitia_metadata_read FROM PUBLIC;
CREATE TABLE profitia_metadata_read.installation(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),schema_version text NOT NULL CHECK(schema_version='1.0.0'),
 schema_digest text NOT NULL CHECK(schema_digest~'^[a-f0-9]{64}$'),project_id text NOT NULL,branch_id text NOT NULL,
 database_name text NOT NULL,runtime_role name NOT NULL,source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
 expires_at timestamptz NOT NULL CHECK(isfinite(expires_at))
);
ALTER TABLE profitia_metadata_read.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_metadata_read.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_owner ON profitia_metadata_read.installation TO profitia_market_read_owner USING(true) WITH CHECK(true);
CREATE POLICY runtime_receipt ON profitia_metadata_read.installation FOR SELECT USING(runtime_role::text=session_user AND database_name=current_database());
CREATE POLICY read_fence ON profitia_metadata_read.installation AS RESTRICTIVE FOR SELECT TO PUBLIC
 USING(current_user='profitia_market_read_owner' OR(runtime_role::text=session_user AND database_name=current_database()));
CREATE POLICY insert_fence ON profitia_metadata_read.installation AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK(current_user='profitia_market_read_owner');
CREATE POLICY update_fence ON profitia_metadata_read.installation AS RESTRICTIVE FOR UPDATE TO PUBLIC USING(current_user='profitia_market_read_owner') WITH CHECK(current_user='profitia_market_read_owner');
CREATE POLICY delete_fence ON profitia_metadata_read.installation AS RESTRICTIVE FOR DELETE TO PUBLIC USING(current_user='profitia_market_read_owner');
CREATE VIEW profitia_metadata_read.benchmark_metadata_facets WITH(security_barrier=true) AS
 SELECT "id","providerCode","key","label","description","searchable","featured","category","controlType","allowMultipleValues","providerKey","active"
 FROM public.benchmark_metadata_facets WHERE "providerCode"='MACROBOND' AND "active"
 AND EXISTS(SELECT 1 FROM profitia_metadata_read.installation i WHERE i.singleton AND i.runtime_role::text=session_user
  AND i.database_name=current_database() AND i.expires_at>clock_timestamp());
CREATE VIEW profitia_metadata_read.benchmark_metadata_values WITH(security_barrier=true) AS
 SELECT "id","providerCode","facetKey","providerValueId","label","normalizedLabel","active"
 FROM public.benchmark_metadata_values WHERE "providerCode"='MACROBOND' AND "active"
 AND EXISTS(SELECT 1 FROM profitia_metadata_read.installation i WHERE i.singleton AND i.runtime_role::text=session_user
  AND i.database_name=current_database() AND i.expires_at>clock_timestamp());
REVOKE ALL ON ALL TABLES IN SCHEMA profitia_metadata_read FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profitia_metadata_read FROM PUBLIC;
