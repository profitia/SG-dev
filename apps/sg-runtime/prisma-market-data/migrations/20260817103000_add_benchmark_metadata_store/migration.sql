CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "benchmark_metadata_facets" (
    "id" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "searchable" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT NOT NULL,
    "controlType" TEXT NOT NULL,
    "allowMultipleValues" BOOLEAN NOT NULL DEFAULT false,
    "providerKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncStartedAt" TIMESTAMP(3),
    "lastSyncSucceededAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "valueCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_metadata_facets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_metadata_values" (
    "id" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "facetKey" TEXT NOT NULL,
    "providerValueId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmark_metadata_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_metadata_facets_providerCode_key_key" ON "benchmark_metadata_facets"("providerCode", "key");

-- CreateIndex
CREATE INDEX "benchmark_metadata_facets_providerCode_active_featured_idx" ON "benchmark_metadata_facets"("providerCode", "active", "featured");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_metadata_values_providerCode_facetKey_providerValueId_key" ON "benchmark_metadata_values"("providerCode", "facetKey", "providerValueId");

-- CreateIndex
CREATE INDEX "benchmark_metadata_values_providerCode_facetKey_active_idx" ON "benchmark_metadata_values"("providerCode", "facetKey", "active");

-- CreateIndex
CREATE INDEX "benchmark_metadata_values_providerCode_facetKey_label_idx" ON "benchmark_metadata_values"("providerCode", "facetKey", "label");

-- CreateIndex
CREATE INDEX "benchmark_metadata_values_normalizedLabel_trgm_idx" ON "benchmark_metadata_values" USING GIN ("normalizedLabel" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "benchmark_metadata_values_providerValueId_trgm_idx" ON "benchmark_metadata_values" USING GIN (lower("providerValueId") gin_trgm_ops);