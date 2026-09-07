ALTER TABLE "forecast_current_runs"
ADD COLUMN "trainingWindowPolicyId" TEXT,
ADD COLUMN "effectiveTrainingPolicyId" TEXT;

ALTER TABLE "forecast_verification_runs"
ADD COLUMN "trainingWindowPolicyId" TEXT,
ADD COLUMN "effectiveTrainingPolicyId" TEXT;

DROP INDEX "forecast_current_runs_identity_key";
DROP INDEX "forecast_current_runs_lookup_idx";
DROP INDEX "forecast_verification_runs_identity_key";
DROP INDEX "forecast_verification_runs_lookup_idx";

CREATE UNIQUE INDEX "forecast_current_runs_identity_key"
ON "forecast_current_runs"(
  "seriesId",
  "inputSource",
  "historyFingerprint",
  "targetBasis",
  "methodId",
  "modelId",
  "methodVersion",
  "trainingWindowPolicyId",
  "effectiveTrainingPolicyId"
);

CREATE UNIQUE INDEX "forecast_verification_runs_identity_key"
ON "forecast_verification_runs"(
  "seriesId",
  "inputSource",
  "historyFingerprint",
  "targetBasis",
  "methodId",
  "modelId",
  "methodVersion",
  "trainingWindowPolicyId",
  "effectiveTrainingPolicyId"
);

CREATE INDEX "forecast_current_runs_lookup_idx"
ON "forecast_current_runs"(
  "seriesId",
  "targetBasis",
  "methodId",
  "modelId",
  "trainingWindowPolicyId",
  "effectiveTrainingPolicyId",
  "updatedAt"
);

CREATE INDEX "forecast_verification_runs_lookup_idx"
ON "forecast_verification_runs"(
  "seriesId",
  "targetBasis",
  "methodId",
  "modelId",
  "trainingWindowPolicyId",
  "effectiveTrainingPolicyId",
  "updatedAt"
);