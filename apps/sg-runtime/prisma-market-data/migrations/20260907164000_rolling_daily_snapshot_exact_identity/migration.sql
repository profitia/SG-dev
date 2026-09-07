ALTER TABLE "rolling_daily_current_forecast_snapshots"
ADD COLUMN "trainingWindowPolicyId" TEXT,
ADD COLUMN "effectiveTrainingPolicyId" TEXT,
ADD COLUMN "sourceHistoryFingerprint" TEXT;

DROP INDEX IF EXISTS "rolling_daily_current_forecast_snapshots_identity_key";
DROP INDEX IF EXISTS "rolling_daily_current_forecast_snapshots_updated_idx";

CREATE UNIQUE INDEX "rolling_daily_current_forecast_snapshots_identity_key"
ON "rolling_daily_current_forecast_snapshots"(
  "seriesId",
  "inputSource",
  "targetBasis",
  "methodId",
  "methodVersion",
  "modelId",
  "trainingWindowPolicyId",
  "effectiveTrainingPolicyId",
  "sourceHistoryFingerprint"
);

CREATE INDEX "rolling_daily_current_forecast_snapshots_updated_idx"
ON "rolling_daily_current_forecast_snapshots"(
  "seriesId",
  "inputSource",
  "targetBasis",
  "methodId",
  "methodVersion",
  "modelId",
  "trainingWindowPolicyId",
  "effectiveTrainingPolicyId",
  "sourceHistoryFingerprint",
  "updatedAt"
);