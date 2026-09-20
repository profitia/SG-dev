-- Durable correlation belongs to the user intent/job, not to a reusable forecast artifact.
ALTER TABLE "forecast_preparation_job"
  ADD COLUMN "originCorrelationId" TEXT,
  ADD COLUMN "latestCorrelationId" TEXT;

CREATE INDEX "forecast_preparation_job_correlation_idx"
  ON "forecast_preparation_job"("latestCorrelationId", "updatedAt");
