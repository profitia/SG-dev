ALTER TABLE "forecast_preparation_execution_ledger"
  ADD COLUMN "resourceCorrelationId" TEXT,
  ADD COLUMN "resourceMeasuredAt" TIMESTAMP(3),
  ADD COLUMN "resourceSummaryJson" JSONB;

CREATE INDEX "forecast_preparation_execution_ledger_resource_correlation_idx"
  ON "forecast_preparation_execution_ledger"("resourceCorrelationId", "resourceMeasuredAt");

CREATE TABLE "forecast_action_trace" (
  "id" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "targetBasis" "ForecastTargetBasis" NOT NULL,
  "targetSemantics" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "jobKey" TEXT,
  "executionId" TEXT,
  "actionRequestedAt" TIMESTAMP(3) NOT NULL,
  "queueAcceptedAt" TIMESTAMP(3),
  "artifactReadyAt" TIMESTAMP(3),
  "dashboardFirstReadyObservedAt" TIMESTAMP(3),
  "uiVisibleClientAt" TIMESTAMP(3),
  "uiAckReceivedAt" TIMESTAMP(3),
  "uiVisibilityState" TEXT NOT NULL DEFAULT 'NOT_OBSERVED',
  "pageInstanceId" TEXT,
  "responseToVisibleMs" DOUBLE PRECISION,
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "eventsJson" JSONB NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "forecast_action_trace_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "forecast_action_trace_correlationId_key"
  ON "forecast_action_trace"("correlationId");
CREATE INDEX "forecast_action_trace_job_ready_idx"
  ON "forecast_action_trace"("jobKey", "artifactReadyAt");
CREATE INDEX "forecast_action_trace_execution_idx"
  ON "forecast_action_trace"("executionId");
CREATE INDEX "forecast_action_trace_identity_idx"
  ON "forecast_action_trace"("seriesId", "targetSemantics", "modelId", "createdAt");
