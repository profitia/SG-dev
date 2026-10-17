-- Disposable integration fixture only; not a product migration or live repair.
GRANT USAGE ON SCHEMA sg_runtime_benchmarks TO sg2_operation_runtime,sg2_operation_reader;
GRANT SELECT,INSERT,UPDATE ON sg_runtime_benchmarks."BusinessBenchmark",sg_runtime_benchmarks."BenchmarkProviderMapping",sg_runtime_benchmarks."OrganizationBenchmarkSelection" TO sg2_operation_runtime;
GRANT SELECT ON sg_runtime_benchmarks."BusinessBenchmark",sg_runtime_benchmarks."BenchmarkProviderMapping",sg_runtime_benchmarks."OrganizationBenchmarkSelection" TO sg2_operation_reader;
ALTER TABLE sg_runtime_benchmarks."BusinessBenchmark" ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."BusinessBenchmark" FORCE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."BenchmarkProviderMapping" ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."BenchmarkProviderMapping" FORCE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."OrganizationBenchmarkSelection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks."OrganizationBenchmarkSelection" FORCE ROW LEVEL SECURITY;
CREATE POLICY benchmark_writer ON sg_runtime_benchmarks."BusinessBenchmark" TO sg2_operation_runtime USING("organizationId"=current_setting('operation.organisation_id',true)) WITH CHECK("organizationId"=current_setting('operation.organisation_id',true));
CREATE POLICY benchmark_reader ON sg_runtime_benchmarks."BusinessBenchmark" FOR SELECT TO sg2_operation_reader USING("organizationId"=current_setting('operation.organisation_id',true));
CREATE POLICY mapping_writer ON sg_runtime_benchmarks."BenchmarkProviderMapping" TO sg2_operation_runtime USING("organizationId"=current_setting('operation.organisation_id',true)) WITH CHECK("organizationId"=current_setting('operation.organisation_id',true) AND EXISTS(SELECT 1 FROM sg_runtime_benchmarks."BusinessBenchmark" b WHERE b.id="businessBenchmarkId" AND b."organizationId"=current_setting('operation.organisation_id',true)));
CREATE POLICY mapping_reader ON sg_runtime_benchmarks."BenchmarkProviderMapping" FOR SELECT TO sg2_operation_reader USING("organizationId"=current_setting('operation.organisation_id',true));
CREATE POLICY selection_writer ON sg_runtime_benchmarks."OrganizationBenchmarkSelection" TO sg2_operation_runtime USING("organizationId"=current_setting('operation.organisation_id',true)) WITH CHECK("organizationId"=current_setting('operation.organisation_id',true) AND EXISTS(SELECT 1 FROM sg_runtime_benchmarks."BusinessBenchmark" b WHERE b.id="businessBenchmarkId" AND b."organizationId"=current_setting('operation.organisation_id',true)));
CREATE POLICY selection_reader ON sg_runtime_benchmarks."OrganizationBenchmarkSelection" FOR SELECT TO sg2_operation_reader USING("organizationId"=current_setting('operation.organisation_id',true));
