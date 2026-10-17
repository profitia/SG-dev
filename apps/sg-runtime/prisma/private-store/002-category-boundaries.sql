-- NEW private store only, inside an explicit controlled owner transaction.
-- No role provisioning, legacy-schema change, copied history or activation.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' THEN RAISE EXCEPTION 'Controlled private owner required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM profitia_access.installation WHERE singleton
      AND database_name=current_database() AND schema_version='1.0.0'
      AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2')
    OR NOT EXISTS(SELECT 1 FROM profitia_modules.installation WHERE singleton AND schema_version='1.0.0'
      AND schema_digest='c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed')
    OR NOT EXISTS(SELECT 1 FROM profitia_modules.audit_installation WHERE singleton AND envelope_version='1.0.0'
      AND schema_digest='af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac') THEN
    RAISE EXCEPTION 'Accepted private access/module/audit schemas required';
  END IF;
END $guard$;

CREATE SCHEMA profitia_category AUTHORIZATION profitia_access_owner;
REVOKE ALL ON SCHEMA profitia_category FROM PUBLIC;
CREATE TABLE profitia_category.installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  boundary_digest text NOT NULL CHECK(boundary_digest ~ '^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  installed_by text NOT NULL DEFAULT session_user,
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE profitia_category.installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE profitia_category.installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_category_receipt ON profitia_category.installation
  USING(CASE WHEN current_user='profitia_access_owner' THEN true
    ELSE (profitia_access.runtime_descriptor()->>'applicationId')='spendguru' END)
  WITH CHECK(current_user='profitia_access_owner');
REVOKE ALL ON profitia_category.installation FROM PUBLIC;

-- This tenant column exists only in the new private store. The unchanged
-- legacy Prisma model/old database never acquire a missing required field.
ALTER TABLE sg_runtime_benchmarks."CategoryCostComponent" ADD COLUMN "organizationId" text;
ALTER TABLE sg_runtime_benchmarks."Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."Category" FORCE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."CategoryCostComponent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."CategoryCostComponent" FORCE ROW LEVEL SECURITY;
CREATE POLICY private_category_scope ON sg_runtime_benchmarks."Category"
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('category',"organizationId"::uuid) END)
  WITH CHECK(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('category',"organizationId"::uuid) END);
CREATE POLICY private_category_fence ON sg_runtime_benchmarks."Category" AS RESTRICTIVE TO PUBLIC
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('category',"organizationId"::uuid) END)
  WITH CHECK(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('category',"organizationId"::uuid) END);
CREATE POLICY private_category_component_scope ON sg_runtime_benchmarks."CategoryCostComponent"
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('category',"organizationId"::uuid) END)
  WITH CHECK(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('category',"organizationId"::uuid) END);
CREATE POLICY private_category_component_fence ON sg_runtime_benchmarks."CategoryCostComponent" AS RESTRICTIVE TO PUBLIC
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('category',"organizationId"::uuid) END)
  WITH CHECK(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('category',"organizationId"::uuid) END);

UPDATE sg_runtime_benchmarks."CategoryCostComponent" AS component
  SET "organizationId"=category."organizationId"
  FROM sg_runtime_benchmarks."Category" AS category WHERE category.id=component."categoryId";
DO $existing$ BEGIN
  IF EXISTS(SELECT 1 FROM sg_runtime_benchmarks."CategoryCostComponent" AS component
    LEFT JOIN sg_runtime_benchmarks."BusinessBenchmark" AS benchmark ON benchmark.id=component."businessBenchmarkId"
    WHERE component."organizationId" IS NULL OR benchmark.id IS NULL
      OR benchmark."organizationId"<>component."organizationId") THEN
    RAISE EXCEPTION 'Existing category reference integrity must be resolved without reassignment';
  END IF;
END $existing$;
ALTER TABLE sg_runtime_benchmarks."CategoryCostComponent" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE UNIQUE INDEX private_category_id_organisation_key ON sg_runtime_benchmarks."Category"(id,"organizationId");
ALTER TABLE sg_runtime_benchmarks."CategoryCostComponent" ADD CONSTRAINT private_component_category_organisation_fk
  FOREIGN KEY("categoryId","organizationId") REFERENCES sg_runtime_benchmarks."Category"(id,"organizationId") ON DELETE CASCADE;
ALTER TABLE sg_runtime_benchmarks."CategoryCostComponent" ADD CONSTRAINT private_component_benchmark_organisation_fk
  FOREIGN KEY("businessBenchmarkId","organizationId") REFERENCES sg_runtime_benchmarks."BusinessBenchmark"(id,"organizationId") ON DELETE RESTRICT;
CREATE INDEX private_category_component_organisation_idx ON sg_runtime_benchmarks."CategoryCostComponent"("organizationId","categoryId");

CREATE FUNCTION profitia_category.enforce_component_organisation() RETURNS trigger
  LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
DECLARE parent_organisation text;
BEGIN
  SELECT category."organizationId" INTO parent_organisation
    FROM sg_runtime_benchmarks."Category" AS category WHERE category.id=NEW."categoryId";
  IF NOT FOUND OR (NEW."organizationId" IS NOT NULL AND NEW."organizationId"<>parent_organisation) THEN
    RAISE EXCEPTION 'Category reference unavailable' USING ERRCODE='23503';
  END IF;
  NEW."organizationId":=parent_organisation;
  RETURN NEW;
END $body$;
REVOKE ALL ON FUNCTION profitia_category.enforce_component_organisation() FROM PUBLIC;
CREATE TRIGGER private_component_organisation BEFORE INSERT OR UPDATE OF "categoryId","organizationId","businessBenchmarkId"
  ON sg_runtime_benchmarks."CategoryCostComponent" FOR EACH ROW EXECUTE FUNCTION profitia_category.enforce_component_organisation();

-- Category composition needs the organisation's benchmark reference catalog.
-- This is explicit SELECT-only input access, not a benchmark-selection grant.
-- Separate command-specific restrictive fences keep INSERT/UPDATE/DELETE
-- benchmark-only even if a legacy permissive ALL policy is introduced. A
-- SELECT allowance must never become a DELETE allowance through FOR ALL.
DROP POLICY private_benchmark_fence ON sg_runtime_benchmarks."BusinessBenchmark";
CREATE POLICY private_benchmark_fence ON sg_runtime_benchmarks."BusinessBenchmark" AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) OR profitia_modules.scope_allows('category',"organizationId"::uuid) END);
CREATE POLICY private_benchmark_insert_fence ON sg_runtime_benchmarks."BusinessBenchmark" AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
CREATE POLICY private_benchmark_update_fence ON sg_runtime_benchmarks."BusinessBenchmark" AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END) WITH CHECK(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
CREATE POLICY private_benchmark_delete_fence ON sg_runtime_benchmarks."BusinessBenchmark" AS RESTRICTIVE FOR DELETE TO PUBLIC
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
DROP POLICY private_mapping_fence ON sg_runtime_benchmarks."BenchmarkProviderMapping";
CREATE POLICY private_mapping_fence ON sg_runtime_benchmarks."BenchmarkProviderMapping" AS RESTRICTIVE FOR SELECT TO PUBLIC
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) OR profitia_modules.scope_allows('category',"organizationId"::uuid) END);
CREATE POLICY private_mapping_insert_fence ON sg_runtime_benchmarks."BenchmarkProviderMapping" AS RESTRICTIVE FOR INSERT TO PUBLIC
  WITH CHECK(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
CREATE POLICY private_mapping_update_fence ON sg_runtime_benchmarks."BenchmarkProviderMapping" AS RESTRICTIVE FOR UPDATE TO PUBLIC
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END) WITH CHECK(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
CREATE POLICY private_mapping_delete_fence ON sg_runtime_benchmarks."BenchmarkProviderMapping" AS RESTRICTIVE FOR DELETE TO PUBLIC
  USING(CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
CREATE POLICY private_category_benchmark_input ON sg_runtime_benchmarks."BusinessBenchmark" FOR SELECT TO PUBLIC
  USING(profitia_modules.scope_allows('category',"organizationId"::uuid));
CREATE POLICY private_category_mapping_input ON sg_runtime_benchmarks."BenchmarkProviderMapping" FOR SELECT TO PUBLIC
  USING(profitia_modules.scope_allows('category',"organizationId"::uuid));

-- ACLs, verified source digest/receipt and current module/product/grants are
-- separate controlled initialization/release steps. No defaults to PUBLIC.
