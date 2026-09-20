CREATE TABLE "forecast_preparation_execution_ledger" (
  "id" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "logicalArtifactKey" TEXT NOT NULL,
  "operationFamily" TEXT NOT NULL,
  "executionStatus" TEXT NOT NULL,
  "resultStatus" TEXT,
  "cacheStatus" TEXT,
  "artifactScope" TEXT NOT NULL,
  "trainingWindowPolicyId" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "targetBasis" "ForecastTargetBasis" NOT NULL DEFAULT 'MONTHLY_AVERAGE',
  "targetSemantics" TEXT NOT NULL,
  "methodId" TEXT NOT NULL,
  "methodVersion" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "inputSource" TEXT NOT NULL,
  "historyFingerprint" TEXT NOT NULL,
  "sourceFrequency" TEXT NOT NULL,
  "targetCadence" TEXT NOT NULL,
  "frequencyIdentity" TEXT NOT NULL,
  "ownerRequestId" TEXT NOT NULL,
  "latestRequestId" TEXT NOT NULL,
  "latestRole" TEXT NOT NULL,
  "waiterCount" INTEGER NOT NULL DEFAULT 0,
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "lastEventAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "computeStartedAt" TIMESTAMP(3),
  "computeCompletedAt" TIMESTAMP(3),
  "persistenceStartedAt" TIMESTAMP(3),
  "persistenceCompletedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "logicalArtifactIdentityJson" JSONB NOT NULL,
  "eventsJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "forecast_preparation_execution_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "forecast_preparation_execution_ledger_execution_id_key"
ON "forecast_preparation_execution_ledger"("executionId");

CREATE INDEX "forecast_preparation_execution_ledger_logical_key_idx"
ON "forecast_preparation_execution_ledger"("logicalArtifactKey", "startedAt");

CREATE INDEX "forecast_preparation_execution_ledger_series_status_idx"
ON "forecast_preparation_execution_ledger"("seriesId", "operationFamily", "executionStatus", "updatedAt");