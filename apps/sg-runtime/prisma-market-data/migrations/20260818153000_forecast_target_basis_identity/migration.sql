-- CreateEnum
CREATE TYPE "ForecastTargetBasis" AS ENUM ('MONTHLY_AVERAGE', 'END_OF_PERIOD');

-- AlterTable
ALTER TABLE "forecast_current_runs"
ADD COLUMN "targetBasis" "ForecastTargetBasis" NOT NULL DEFAULT 'MONTHLY_AVERAGE';

-- AlterTable
ALTER TABLE "forecast_verification_runs"
ADD COLUMN "targetBasis" "ForecastTargetBasis" NOT NULL DEFAULT 'MONTHLY_AVERAGE';

-- AlterTable
ALTER TABLE "forecast_verification_points"
ADD COLUMN "actualObservedAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX "forecast_current_runs_seriesId_inputSource_historyFingerprint_modelId_methodVersion_key";

-- DropIndex
DROP INDEX "forecast_current_runs_seriesId_modelId_updatedAt_idx";

-- DropIndex
DROP INDEX "forecast_verification_runs_seriesId_inputSource_historyFingerprint_m_key";

-- DropIndex
DROP INDEX "forecast_verification_runs_seriesId_modelId_updatedAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "forecast_current_runs_seriesId_inputSource_historyFingerprint_t_key"
ON "forecast_current_runs"("seriesId", "inputSource", "historyFingerprint", "targetBasis", "modelId", "methodVersion");

-- CreateIndex
CREATE INDEX "forecast_current_runs_seriesId_targetBasis_modelId_updatedAt_idx"
ON "forecast_current_runs"("seriesId", "targetBasis", "modelId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_verification_runs_seriesId_inputSource_historyFin_key"
ON "forecast_verification_runs"("seriesId", "inputSource", "historyFingerprint", "targetBasis", "modelId", "methodVersion");

-- CreateIndex
CREATE INDEX "forecast_verification_runs_seriesId_targetBasis_modelId_upd_idx"
ON "forecast_verification_runs"("seriesId", "targetBasis", "modelId", "updatedAt");