-- CreateTable
CREATE TABLE "forecast_current_runs" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT,
    "currency" TEXT,
    "unit" TEXT,
    "sourceLabel" TEXT,
    "inputSource" TEXT NOT NULL,
    "inputRunId" TEXT,
    "historyFingerprint" TEXT NOT NULL,
    "historyStartAt" TIMESTAMP(3),
    "historyEndAt" TIMESTAMP(3),
    "observationCount" INTEGER NOT NULL,
    "forecastOriginAt" TIMESTAMP(3),
    "modelId" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "runtimeSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_current_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_current_points" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "horizonLabel" TEXT NOT NULL,
    "horizonSteps" INTEGER NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "forecastValue" DECIMAL(24,8),
    "fitStatus" TEXT,
    "failureReason" TEXT,
    "selectedVariant" TEXT,
    "selectionMetric" TEXT,
    "selectionScore" DOUBLE PRECISION,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_current_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_verification_runs" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT,
    "currency" TEXT,
    "unit" TEXT,
    "sourceLabel" TEXT,
    "inputSource" TEXT NOT NULL,
    "inputRunId" TEXT,
    "historyFingerprint" TEXT NOT NULL,
    "historyStartAt" TIMESTAMP(3),
    "historyEndAt" TIMESTAMP(3),
    "observationCount" INTEGER NOT NULL,
    "forecastOriginAt" TIMESTAMP(3),
    "modelId" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "runtimeSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_verification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_verification_metrics" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "horizonLabel" TEXT NOT NULL,
    "horizonSteps" INTEGER NOT NULL,
    "origins" INTEGER NOT NULL,
    "expectedOrigins" INTEGER NOT NULL,
    "failedOrigins" INTEGER NOT NULL,
    "coverage" DOUBLE PRECISION NOT NULL,
    "mae" DOUBLE PRECISION,
    "rmse" DOUBLE PRECISION,
    "mase" DOUBLE PRECISION,
    "smape" DOUBLE PRECISION,
    "directionalAccuracy" DOUBLE PRECISION,
    "bias" DOUBLE PRECISION,
    "failureSummaryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_verification_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forecast_verification_points" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "horizonLabel" TEXT NOT NULL,
    "horizonSteps" INTEGER NOT NULL,
    "forecastOriginAt" TIMESTAMP(3) NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "originValue" DECIMAL(24,8) NOT NULL,
    "forecastValue" DECIMAL(24,8) NOT NULL,
    "actualValue" DECIMAL(24,8) NOT NULL,
    "errorValue" DECIMAL(24,8) NOT NULL,
    "absoluteErrorValue" DECIMAL(24,8) NOT NULL,
    "deltaValue" DECIMAL(24,8) NOT NULL,
    "deltaPct" DOUBLE PRECISION,
    "maseScale" DOUBLE PRECISION NOT NULL,
    "selectedVariant" TEXT,
    "selectionMetric" TEXT,
    "selectionScore" DOUBLE PRECISION,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forecast_verification_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forecast_current_runs_seriesId_inputSource_historyFingerprint_modelId_methodVersion_key" ON "forecast_current_runs"("seriesId", "inputSource", "historyFingerprint", "modelId", "methodVersion");

-- CreateIndex
CREATE INDEX "forecast_current_runs_seriesId_modelId_updatedAt_idx" ON "forecast_current_runs"("seriesId", "modelId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_current_points_runId_horizonLabel_key" ON "forecast_current_points"("runId", "horizonLabel");

-- CreateIndex
CREATE INDEX "forecast_current_points_runId_horizonSteps_idx" ON "forecast_current_points"("runId", "horizonSteps");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_verification_runs_seriesId_inputSource_historyFingerprint_m_key" ON "forecast_verification_runs"("seriesId", "inputSource", "historyFingerprint", "modelId", "methodVersion");

-- CreateIndex
CREATE INDEX "forecast_verification_runs_seriesId_modelId_updatedAt_idx" ON "forecast_verification_runs"("seriesId", "modelId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_verification_metrics_runId_horizonLabel_key" ON "forecast_verification_metrics"("runId", "horizonLabel");

-- CreateIndex
CREATE INDEX "forecast_verification_metrics_runId_horizonSteps_idx" ON "forecast_verification_metrics"("runId", "horizonSteps");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_verification_points_runId_horizonLabel_forecastOriginA_key" ON "forecast_verification_points"("runId", "horizonLabel", "forecastOriginAt", "targetDate");

-- CreateIndex
CREATE INDEX "forecast_verification_points_runId_horizonLabel_targetDate_idx" ON "forecast_verification_points"("runId", "horizonLabel", "targetDate");

-- AddForeignKey
ALTER TABLE "forecast_current_points" ADD CONSTRAINT "forecast_current_points_runId_fkey" FOREIGN KEY ("runId") REFERENCES "forecast_current_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_verification_metrics" ADD CONSTRAINT "forecast_verification_metrics_runId_fkey" FOREIGN KEY ("runId") REFERENCES "forecast_verification_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_verification_points" ADD CONSTRAINT "forecast_verification_points_runId_fkey" FOREIGN KEY ("runId") REFERENCES "forecast_verification_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;