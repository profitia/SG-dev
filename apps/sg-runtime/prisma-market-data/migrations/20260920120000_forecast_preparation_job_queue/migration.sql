CREATE TABLE "forecast_preparation_job" (
  "id" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "jobKind" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "priority" INTEGER NOT NULL,
  "seriesId" TEXT NOT NULL,
  "targetBasis" "ForecastTargetBasis" NOT NULL,
  "targetSemantics" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "sourceFrequency" TEXT NOT NULL,
  "targetCadence" TEXT NOT NULL,
  "historyFingerprint" TEXT NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 1,
  "sliceCount" INTEGER NOT NULL DEFAULT 0,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "maxFailureCount" INTEGER NOT NULL DEFAULT 5,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwnerToken" TEXT,
  "leaseVersion" INTEGER NOT NULL DEFAULT 0,
  "leaseAcquiredAt" TIMESTAMP(3),
  "leaseExpiresAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "dependencyJobKey" TEXT,
  "checkpointJson" JSONB,
  "failureCode" TEXT,
  "failureReason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "forecast_preparation_job_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "forecast_preparation_job_kind_check" CHECK ("jobKind" IN ('CURRENT', 'VERIFICATION')),
  CONSTRAINT "forecast_preparation_job_status_check" CHECK ("status" IN ('QUEUED', 'RUNNING', 'RETRY_WAIT', 'SUCCEEDED', 'FAILED', 'SUPERSEDED')),
  CONSTRAINT "forecast_preparation_job_priority_check" CHECK ("priority" >= 0),
  CONSTRAINT "forecast_preparation_job_counters_check" CHECK ("requestCount" >= 1 AND "sliceCount" >= 0 AND "failureCount" >= 0 AND "maxFailureCount" >= 1)
);

CREATE UNIQUE INDEX "forecast_preparation_job_jobKey_key"
ON "forecast_preparation_job"("jobKey");

CREATE INDEX "forecast_preparation_job_claim_idx"
ON "forecast_preparation_job"("status", "priority", "availableAt", "requestedAt");

CREATE INDEX "forecast_preparation_job_identity_idx"
ON "forecast_preparation_job"("seriesId", "targetSemantics", "modelId", "jobKind", "updatedAt");

CREATE INDEX "forecast_preparation_job_dependency_idx"
ON "forecast_preparation_job"("dependencyJobKey", "status");

CREATE INDEX "forecast_preparation_job_lease_idx"
ON "forecast_preparation_job"("leaseExpiresAt", "status");
