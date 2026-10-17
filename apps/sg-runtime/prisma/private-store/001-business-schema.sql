-- NEW private store only. Exact Prisma 5.22 model DDL, no customer data.
-- Execute as profitia_access_owner inside one checked transaction, together
-- with the accepted benchmark-private-boundaries.sql and operator receipt.
-- Existing namespaces are never adopted, reset or silently replayed.
DO $guard$ BEGIN
  IF current_user <> 'profitia_access_owner' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Controlled private schema owner required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='sg_runtime_benchmarks') THEN
    RAISE EXCEPTION 'Private SG2 namespace already exists; reconcile its receipt instead of replay';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profitia_access.installation WHERE singleton
    AND database_name=current_database() AND schema_version='1.0.0'
    AND schema_digest='356463492c3304ca11fa533f6e99f1d41628a3ab830488142c6030fb9a920ff2')
    OR NOT EXISTS (SELECT 1 FROM profitia_modules.installation WHERE singleton
      AND schema_version='1.0.0' AND schema_digest='c4ea1883af310934b1e83dfcf936ba15dfc32a3f4be206c752efe2d69a55b9ed')
    OR NOT EXISTS (SELECT 1 FROM profitia_modules.audit_installation WHERE singleton
      AND envelope_version='1.0.0' AND schema_digest='af296074b8b4dab2f952e1d2e0553e17d6567f480152870d151dc36c9302e6ac') THEN
    RAISE EXCEPTION 'Accepted access, module and audit installations required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
    WHERE d.defaclrole=current_user::regrole AND d.defaclnamespace=0
      AND d.defaclobjtype IN ('r','S') AND a.grantee<>current_user::regrole::oid) THEN
    RAISE EXCEPTION 'Unexpected global default ACL; no implicit business grants allowed';
  END IF;
END $guard$;

CREATE SCHEMA sg_runtime_benchmarks AUTHORIZATION profitia_access_owner;
SET LOCAL search_path = sg_runtime_benchmarks, pg_catalog;
REVOKE ALL ON SCHEMA sg_runtime_benchmarks FROM PUBLIC;

-- CreateTable
CREATE TABLE "BusinessBenchmark" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "concept" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessBenchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BenchmarkProviderMapping" (
    "id" TEXT NOT NULL,
    "businessBenchmarkId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "providerDisplayName" TEXT NOT NULL,
    "providerSeriesId" TEXT NOT NULL,
    "providerSeriesKey" TEXT,
    "title" TEXT,
    "frequency" TEXT,
    "currency" TEXT,
    "unit" TEXT,
    "sourceLabel" TEXT,
    "region" TEXT,
    "metadataJson" JSONB,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkProviderMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationBenchmarkSelection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "businessBenchmarkId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationBenchmarkSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryCostComponent" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessBenchmarkId" TEXT NOT NULL,
    "weightPercent" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryCostComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessBenchmark_organizationId_createdAt_idx" ON "BusinessBenchmark"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessBenchmark_id_organizationId_key" ON "BusinessBenchmark"("id", "organizationId");

-- CreateIndex
CREATE INDEX "BenchmarkProviderMapping_businessBenchmarkId_idx" ON "BenchmarkProviderMapping"("businessBenchmarkId");

-- CreateIndex
CREATE INDEX "BenchmarkProviderMapping_organizationId_idx" ON "BenchmarkProviderMapping"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "BenchmarkProviderMapping_organizationId_providerCode_provid_key" ON "BenchmarkProviderMapping"("organizationId", "providerCode", "providerSeriesId");

-- CreateIndex
CREATE INDEX "OrganizationBenchmarkSelection_organizationId_createdAt_idx" ON "OrganizationBenchmarkSelection"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationBenchmarkSelection_organizationId_businessBench_key" ON "OrganizationBenchmarkSelection"("organizationId", "businessBenchmarkId");

-- CreateIndex
CREATE INDEX "Category_organizationId_updatedAt_idx" ON "Category"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "CategoryCostComponent_categoryId_position_idx" ON "CategoryCostComponent"("categoryId", "position");

-- CreateIndex
CREATE INDEX "CategoryCostComponent_businessBenchmarkId_idx" ON "CategoryCostComponent"("businessBenchmarkId");

-- AddForeignKey
ALTER TABLE "BenchmarkProviderMapping" ADD CONSTRAINT "BenchmarkProviderMapping_businessBenchmarkId_organizationI_fkey" FOREIGN KEY ("businessBenchmarkId", "organizationId") REFERENCES "BusinessBenchmark"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationBenchmarkSelection" ADD CONSTRAINT "OrganizationBenchmarkSelection_businessBenchmarkId_organiz_fkey" FOREIGN KEY ("businessBenchmarkId", "organizationId") REFERENCES "BusinessBenchmark"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCostComponent" ADD CONSTRAINT "CategoryCostComponent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCostComponent" ADD CONSTRAINT "CategoryCostComponent_businessBenchmarkId_fkey" FOREIGN KEY ("businessBenchmarkId") REFERENCES "BusinessBenchmark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- All five models are closed before any separately accepted table ACLs.
-- Category functionality has not yet adopted this private host and intentionally
-- receives no admission policy or grants in this migration.
DO $rls$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['BusinessBenchmark','BenchmarkProviderMapping',
    'OrganizationBenchmarkSelection','Category','CategoryCostComponent'] LOOP
    EXECUTE format('ALTER TABLE sg_runtime_benchmarks.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('ALTER TABLE sg_runtime_benchmarks.%I FORCE ROW LEVEL SECURITY',name);
  END LOOP;
END $rls$;

-- Technical receipt only. The checked operator transaction supplies hashes and
-- source reference after installing the separately hash-verified boundary SQL.
CREATE TABLE sg_runtime_benchmarks.private_installation (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  schema_version text NOT NULL CHECK(schema_version='1.0.0'),
  schema_digest text NOT NULL CHECK(schema_digest ~ '^[a-f0-9]{64}$'),
  boundary_digest text NOT NULL CHECK(boundary_digest ~ '^[a-f0-9]{64}$'),
  source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 1 AND 256),
  installed_by text NOT NULL DEFAULT session_user,
  installed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE sg_runtime_benchmarks.private_installation ENABLE ROW LEVEL SECURITY;
ALTER TABLE sg_runtime_benchmarks.private_installation FORCE ROW LEVEL SECURITY;
CREATE POLICY controlled_installation_owner ON sg_runtime_benchmarks.private_installation
  USING(current_user='profitia_access_owner') WITH CHECK(current_user='profitia_access_owner');
REVOKE ALL ON ALL TABLES IN SCHEMA sg_runtime_benchmarks FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA sg_runtime_benchmarks FROM PUBLIC;
