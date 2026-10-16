-- CreateTable
CREATE TABLE "market_series" (
    "id" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "providerSeriesId" TEXT NOT NULL,
    "providerSeriesKey" TEXT,
    "displayName" TEXT NOT NULL,
    "frequency" TEXT,
    "currency" TEXT,
    "unit" TEXT,
    "sourceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_observations" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(24,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_hydration_state" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "lastProviderFetchAt" TIMESTAMP(3),
    "earliestStoredObservationAt" TIMESTAMP(3),
    "latestStoredObservationAt" TIMESTAMP(3),
    "lastHydrationStatus" TEXT,
    "lastHydrationMessage" TEXT,
    "lastHydratedObservationCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_hydration_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_series_providerCode_providerSeriesId_idx" ON "market_series"("providerCode", "providerSeriesId");

-- CreateIndex
CREATE UNIQUE INDEX "market_series_providerCode_providerSeriesId_key" ON "market_series"("providerCode", "providerSeriesId");

-- CreateIndex
CREATE INDEX "market_observations_seriesId_observedAt_idx" ON "market_observations"("seriesId", "observedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_observations_seriesId_observedAt_key" ON "market_observations"("seriesId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "market_hydration_state_seriesId_key" ON "market_hydration_state"("seriesId");

-- AddForeignKey
ALTER TABLE "market_observations" ADD CONSTRAINT "market_observations_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "market_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_hydration_state" ADD CONSTRAINT "market_hydration_state_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "market_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
