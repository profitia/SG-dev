ALTER TABLE "forecast_current_runs"
ADD CONSTRAINT "forecast_current_runs_policy_identity_null_pair_chk"
CHECK (("trainingWindowPolicyId" IS NULL AND "effectiveTrainingPolicyId" IS NULL) OR ("trainingWindowPolicyId" IS NOT NULL AND "effectiveTrainingPolicyId" IS NOT NULL));

ALTER TABLE "forecast_verification_runs"
ADD CONSTRAINT "forecast_verification_runs_policy_identity_null_pair_chk"
CHECK (("trainingWindowPolicyId" IS NULL AND "effectiveTrainingPolicyId" IS NULL) OR ("trainingWindowPolicyId" IS NOT NULL AND "effectiveTrainingPolicyId" IS NOT NULL));

CREATE UNIQUE INDEX "forecast_current_runs_legacy_identity_uidx"
ON "forecast_current_runs"(
  "seriesId",
  "inputSource",
  "historyFingerprint",
  "targetBasis",
  "methodId",
  "modelId",
  "methodVersion"
)
WHERE "trainingWindowPolicyId" IS NULL
  AND "effectiveTrainingPolicyId" IS NULL;

CREATE UNIQUE INDEX "forecast_verification_runs_legacy_identity_uidx"
ON "forecast_verification_runs"(
  "seriesId",
  "inputSource",
  "historyFingerprint",
  "targetBasis",
  "methodId",
  "modelId",
  "methodVersion"
)
WHERE "trainingWindowPolicyId" IS NULL
  AND "effectiveTrainingPolicyId" IS NULL;