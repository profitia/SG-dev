-- CreateEnum
CREATE TYPE "RollingDailyVerificationMaturityStatus" AS ENUM ('MATURED', 'NOT_YET_MATURED');

-- CreateEnum
CREATE TYPE "RollingDailyCalibrationStatus" AS ENUM ('AVAILABLE', 'INSUFFICIENT_CALIBRATION_HISTORY');

-- CreateTable
CREATE TABLE "rolling_daily_verification_records" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "inputSource" TEXT NOT NULL,
    "inputRunId" TEXT,
    "targetBasis" "ForecastTargetBasis" NOT NULL DEFAULT 'MONTHLY_AVERAGE',
    "methodId" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "forecastOriginAt" TIMESTAMP(3) NOT NULL,
    "horizonLabel" TEXT NOT NULL,
    "horizonMonths" INTEGER NOT NULL,
    "horizonSteps" INTEGER NOT NULL,
    "targetCalendarDate" TIMESTAMP(3) NOT NULL,
    "verificationObservedAt" TIMESTAMP(3),
    "maturityStatus" "RollingDailyVerificationMaturityStatus" NOT NULL,
    "originValue" DECIMAL(24,8) NOT NULL,
    "forecastValue" DECIMAL(24,8) NOT NULL,
    "actualValue" DECIMAL(24,8),
    "errorValue" DECIMAL(24,8),
    "absoluteErrorValue" DECIMAL(24,8),
    "deltaValue" DECIMAL(24,8),
    "deltaPct" DOUBLE PRECISION,
    "residualValue" DECIMAL(24,8),
    "maseScale" DOUBLE PRECISION NOT NULL,
    "trainingHistoryStartAt" TIMESTAMP(3),
    "trainingHistoryEndAt" TIMESTAMP(3) NOT NULL,
    "trainingObservationCount" INTEGER NOT NULL,
    "sourceHistoryFingerprint" TEXT NOT NULL,
    "selectedVariant" TEXT,
    "selectionMetric" TEXT,
    "selectionScore" DOUBLE PRECISION,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rolling_daily_verification_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rolling_daily_calibration_groups" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "inputSource" TEXT NOT NULL,
    "inputRunId" TEXT,
    "targetBasis" "ForecastTargetBasis" NOT NULL DEFAULT 'MONTHLY_AVERAGE',
    "methodId" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "horizonLabel" TEXT NOT NULL,
    "horizonMonths" INTEGER NOT NULL,
    "calibrationOriginAt" TIMESTAMP(3) NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "residualP10" DECIMAL(24,8),
    "residualP90" DECIMAL(24,8),
    "quantileMethod" TEXT NOT NULL,
    "status" "RollingDailyCalibrationStatus" NOT NULL,
    "lastResidualObservedAt" TIMESTAMP(3),
    "refreshedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rolling_daily_calibration_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rolling_daily_maintenance_state" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "inputSource" TEXT NOT NULL,
    "inputRunId" TEXT,
    "targetBasis" "ForecastTargetBasis" NOT NULL DEFAULT 'MONTHLY_AVERAGE',
    "methodId" TEXT NOT NULL,
    "methodVersion" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "historicalOriginStartAt" TIMESTAMP(3) NOT NULL,
    "minimumTrainingObservations" INTEGER NOT NULL,
    "minimumCalibrationSamples" INTEGER NOT NULL,
    "latestSourceObservationAt" TIMESTAMP(3),
    "latestSourceHistoryStartAt" TIMESTAMP(3),
    "latestSourceObservationCount" INTEGER,
    "latestSourceHistoryFingerprint" TEXT,
    "lastProcessedOriginAt" TIMESTAMP(3),
    "lastMaturedObservedAt" TIMESTAMP(3),
    "lastMaintenanceAt" TIMESTAMP(3),
    "lastMaintenanceStatus" TEXT,
    "lastFailureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rolling_daily_maintenance_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rolling_daily_verification_records_identity_key"
ON "rolling_daily_verification_records"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId", "forecastOriginAt", "horizonLabel");

-- CreateIndex
CREATE INDEX "rolling_daily_verification_records_maturity_idx"
ON "rolling_daily_verification_records"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId", "maturityStatus", "verificationObservedAt");

-- CreateIndex
CREATE INDEX "rolling_daily_verification_records_origin_idx"
ON "rolling_daily_verification_records"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId", "forecastOriginAt");

-- CreateIndex
CREATE INDEX "rolling_daily_verification_records_horizon_idx"
ON "rolling_daily_verification_records"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId", "horizonLabel", "verificationObservedAt");

-- CreateIndex
CREATE UNIQUE INDEX "rolling_daily_calibration_groups_identity_key"
ON "rolling_daily_calibration_groups"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId", "horizonLabel");

-- CreateIndex
CREATE INDEX "rolling_daily_calibration_groups_refresh_idx"
ON "rolling_daily_calibration_groups"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId", "refreshedAt");

-- CreateIndex
CREATE UNIQUE INDEX "rolling_daily_maintenance_state_identity_key"
ON "rolling_daily_maintenance_state"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId");

-- CreateIndex
CREATE INDEX "rolling_daily_maintenance_state_updated_idx"
ON "rolling_daily_maintenance_state"("seriesId", "inputSource", "targetBasis", "methodId", "methodVersion", "modelId", "updatedAt");