CREATE UNIQUE INDEX "rolling_daily_current_forecast_snapshots_legacy_identity_key"
ON "rolling_daily_current_forecast_snapshots"(
  "seriesId",
  "inputSource",
  "targetBasis",
  "methodId",
  "methodVersion",
  "modelId"
)
WHERE "trainingWindowPolicyId" IS NULL
  AND "effectiveTrainingPolicyId" IS NULL
  AND "sourceHistoryFingerprint" IS NULL;

ALTER TABLE "rolling_daily_current_forecast_snapshots"
ADD CONSTRAINT "rolling_daily_current_forecast_snapshots_identity_triplet_chk"
CHECK (
  (
    "trainingWindowPolicyId" IS NULL
    AND "effectiveTrainingPolicyId" IS NULL
    AND "sourceHistoryFingerprint" IS NULL
  )
  OR (
    "trainingWindowPolicyId" IS NOT NULL
    AND "effectiveTrainingPolicyId" IS NOT NULL
    AND "sourceHistoryFingerprint" IS NOT NULL
  )
);