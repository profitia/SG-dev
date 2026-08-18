-- AlterTable
ALTER TABLE "dr_runs"
ADD COLUMN "lease_owner_id" VARCHAR(128),
ADD COLUMN "lease_token_hash" BYTEA,
ADD COLUMN "lease_epoch" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "lease_acquired_at" TIMESTAMPTZ(6),
ADD COLUMN "lease_heartbeat_at" TIMESTAMPTZ(6),
ADD COLUMN "lease_expires_at" TIMESTAMPTZ(6),
ADD COLUMN "lease_released_at" TIMESTAMPTZ(6),
ADD COLUMN "recovered_at" TIMESTAMPTZ(6),
ADD COLUMN "recovery_reason_code" VARCHAR(64);

-- CreateIndex
CREATE INDEX "dr_runs_organization_id_status_lease_expires_at_idx"
ON "dr_runs"("organization_id", "status", "lease_expires_at");

-- CreateIndex
CREATE INDEX "dr_runs_organization_id_pipeline_id_status_lease_expires_at_idx"
ON "dr_runs"("organization_id", "pipeline_id", "status", "lease_expires_at");