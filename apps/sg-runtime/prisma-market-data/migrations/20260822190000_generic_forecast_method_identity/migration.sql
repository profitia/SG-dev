-- Existing monthly Forecast rows predate canonical method identity. Keep them
-- explicit and non-reusable until their target provenance is proven separately.
ALTER TABLE "forecast_current_runs"
ADD COLUMN "methodId" TEXT NOT NULL DEFAULT 'LEGACY_UNRESOLVED';

ALTER TABLE "forecast_verification_runs"
ADD COLUMN "methodId" TEXT NOT NULL DEFAULT 'LEGACY_UNRESOLVED';

DROP INDEX "forecast_current_runs_seriesId_inputSource_historyFingerprint_t_key";
DROP INDEX "forecast_current_runs_seriesId_targetBasis_modelId_updatedAt_idx";
DROP INDEX "forecast_verification_runs_seriesId_inputSource_historyFin_key";
DROP INDEX "forecast_verification_runs_seriesId_targetBasis_modelId_upd_idx";

CREATE UNIQUE INDEX "forecast_current_runs_identity_key"
ON "forecast_current_runs"("seriesId", "inputSource", "historyFingerprint", "targetBasis", "methodId", "modelId", "methodVersion");

CREATE UNIQUE INDEX "forecast_verification_runs_identity_key"
ON "forecast_verification_runs"("seriesId", "inputSource", "historyFingerprint", "targetBasis", "methodId", "modelId", "methodVersion");

CREATE INDEX "forecast_current_runs_lookup_idx"
ON "forecast_current_runs"("seriesId", "targetBasis", "methodId", "modelId", "updatedAt");

CREATE INDEX "forecast_verification_runs_lookup_idx"
ON "forecast_verification_runs"("seriesId", "targetBasis", "methodId", "modelId", "updatedAt");

ALTER TABLE "forecast_current_runs" ALTER COLUMN "methodId" DROP DEFAULT;
ALTER TABLE "forecast_verification_runs" ALTER COLUMN "methodId" DROP DEFAULT;