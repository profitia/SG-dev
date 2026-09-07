CREATE UNIQUE INDEX "forecast_preparation_execution_ledger_active_owner_uidx"
ON "forecast_preparation_execution_ledger" ("logicalArtifactKey")
WHERE "executionStatus" = 'STARTED';

CREATE INDEX "forecast_preparation_execution_ledger_active_lookup_idx"
ON "forecast_preparation_execution_ledger" ("logicalArtifactKey", "executionStatus", "leaseExpiresAt", "startedAt");