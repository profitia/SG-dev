ALTER TABLE "forecast_preparation_execution_ledger"
ADD COLUMN "attemptKind" TEXT;

UPDATE "forecast_preparation_execution_ledger"
SET
  "attemptKind" = CASE
    WHEN "executionMode" = 'RECOVERY' THEN 'RECOVERY'
    ELSE 'PRIMARY'
  END,
  "executionMode" = CASE
    WHEN "executionMode" = 'RECOVERY' THEN 'RECOVERY_RESUME'
    ELSE 'PRE_STAGE3_PREPARATION'
  END,
  "ownerToken" = CASE
    WHEN "ownerToken" = '' THEN "executionId"
    ELSE "ownerToken"
  END,
  "leaseAcquiredAt" = "startedAt",
  "leaseExpiresAt" = "startedAt",
  "lastProgressAt" = COALESCE(
    "persistenceCompletedAt",
    "persistenceStartedAt",
    "computeCompletedAt",
    "computeStartedAt",
    "startedAt"
  )
WHERE "attemptKind" IS NULL;

ALTER TABLE "forecast_preparation_execution_ledger"
ALTER COLUMN "attemptKind" SET NOT NULL,
ALTER COLUMN "executionMode" DROP DEFAULT,
ALTER COLUMN "ownerToken" DROP DEFAULT,
ALTER COLUMN "leaseAcquiredAt" DROP DEFAULT,
ALTER COLUMN "leaseExpiresAt" DROP DEFAULT,
ALTER COLUMN "lastProgressAt" DROP DEFAULT;