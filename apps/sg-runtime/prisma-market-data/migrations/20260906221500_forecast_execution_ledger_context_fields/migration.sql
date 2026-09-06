ALTER TABLE "forecast_preparation_execution_ledger"
ADD COLUMN "executionMode" TEXT NOT NULL DEFAULT 'PRIMARY',
ADD COLUMN "ownerToken" TEXT NOT NULL DEFAULT '',
ADD COLUMN "leaseVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "leaseAcquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "recoveredFromExecutionId" TEXT,
ADD COLUMN "lastProgressAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "failurePhase" TEXT;

UPDATE "forecast_preparation_execution_ledger"
SET
  "ownerToken" = CASE
    WHEN "ownerToken" = '' THEN "executionId"
    ELSE "ownerToken"
  END,
  "leaseAcquiredAt" = COALESCE("leaseAcquiredAt", "startedAt"),
  "leaseExpiresAt" = COALESCE("leaseExpiresAt", COALESCE("completedAt", "lastEventAt")),
  "lastProgressAt" = COALESCE(
    "persistenceCompletedAt",
    "persistenceStartedAt",
    "computeCompletedAt",
    "computeStartedAt",
    "startedAt"
  );

CREATE INDEX "forecast_preparation_execution_ledger_recovery_idx"
ON "forecast_preparation_execution_ledger"("recoveredFromExecutionId");