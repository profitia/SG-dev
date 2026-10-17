-- Candidate for the NEW private store only. Apply after the matching Prisma
-- schema and accepted profitia_access schema, with a controlled schema owner.
-- No role provisioning, customer data migration or activation occurs here.
DO $guard$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM profitia_access.installation
    WHERE singleton AND database_name=current_database() AND schema_version='1.0.0'
      AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2') THEN
    RAISE EXCEPTION 'Verified private access schema required';
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
  USING (profitia_access.scope_allows('spendguru',"organizationId"::uuid))
  WITH CHECK (profitia_access.scope_allows('spendguru',"organizationId"::uuid));
CREATE POLICY private_mapping_scope ON sg_runtime_benchmarks."BenchmarkProviderMapping"
  USING (profitia_access.scope_allows('spendguru',"organizationId"::uuid))
  WITH CHECK (profitia_access.scope_allows('spendguru',"organizationId"::uuid));
CREATE POLICY private_selection_scope ON sg_runtime_benchmarks."OrganizationBenchmarkSelection"
  USING (profitia_access.scope_allows('spendguru',"organizationId"::uuid))
  WITH CHECK (profitia_access.scope_allows('spendguru',"organizationId"::uuid));
