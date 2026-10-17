-- Candidate for the NEW private store only. Apply after the matching Prisma
-- schema and accepted access/module/audit schemas, with a controlled schema owner.
-- No role provisioning, customer data migration or activation occurs here.
DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM profitia_access.installation
    WHERE singleton AND database_name=current_database() AND schema_version='1.0.0'
      AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2') THEN
    RAISE EXCEPTION 'Verified private access schema required';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM profitia_modules.installation WHERE singleton AND schema_version='1.0.0' AND schema_digest='c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed') OR NOT EXISTS(SELECT 1 FROM profitia_modules.audit_installation WHERE singleton AND envelope_version='1.0.0' AND schema_digest='af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac') THEN
    RAISE EXCEPTION 'Verified module and audit schemas required';
  END IF;
END $guard$;

ALTER TABLE sg_runtime_benchmarks."BusinessBenchmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."BusinessBenchmark" FORCE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."BenchmarkProviderMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."BenchmarkProviderMapping" FORCE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."OrganizationBenchmarkSelection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."OrganizationBenchmarkSelection" FORCE ROW LEVEL SECURITY;

-- TO PUBLIC does not grant table access. Ordinary role ACLs are provisioned
-- separately; scope_allows also checks the current login/application binding.
CREATE POLICY private_benchmark_scope ON sg_runtime_benchmarks."BusinessBenchmark"
  USING (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END)
  WITH CHECK (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
CREATE POLICY private_mapping_scope ON sg_runtime_benchmarks."BenchmarkProviderMapping"
  USING (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END)
  WITH CHECK (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
CREATE POLICY private_selection_scope ON sg_runtime_benchmarks."OrganizationBenchmarkSelection"
  USING (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END)
  WITH CHECK (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);

-- A restrictive boundary cannot be widened by a legacy permissive OR policy.
-- The controlled migration owner is separate from every ordinary login.
CREATE POLICY private_benchmark_fence ON sg_runtime_benchmarks."BusinessBenchmark" AS RESTRICTIVE TO PUBLIC
  USING (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END)
  WITH CHECK (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
CREATE POLICY private_mapping_fence ON sg_runtime_benchmarks."BenchmarkProviderMapping" AS RESTRICTIVE TO PUBLIC
  USING (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END)
  WITH CHECK (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
CREATE POLICY private_selection_fence ON sg_runtime_benchmarks."OrganizationBenchmarkSelection" AS RESTRICTIVE TO PUBLIC
  USING (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END)
  WITH CHECK (CASE WHEN current_user='profitia_access_owner' THEN true ELSE profitia_modules.scope_allows('benchmark',"organizationId"::uuid) END);
