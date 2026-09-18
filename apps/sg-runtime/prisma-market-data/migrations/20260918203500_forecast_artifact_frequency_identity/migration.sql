DROP INDEX "forecast_current_runs_identity_key";
DROP INDEX "forecast_verification_runs_identity_key";

CREATE UNIQUE INDEX "forecast_current_runs_identity_key"
ON "forecast_current_runs"(
  "seriesId",
  "inputSource",
  "historyFingerprint",
  "targetBasis",
  "methodId",
  "modelId",
  "methodVersion",
  "frequency",
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
  "frequency",
  "trainingWindowPolicyId",
  "effectiveTrainingPolicyId"
);
