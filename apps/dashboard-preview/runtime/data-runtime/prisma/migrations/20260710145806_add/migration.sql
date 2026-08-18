-- AlterEnum
ALTER TYPE "DrPipelineTargetStore" ADD VALUE 'FORECAST_ACCURACY';

-- CreateTable
CREATE TABLE "dr_forecast_accuracy_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "latest_run_id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "benchmark_code" TEXT NOT NULL,
    "source_table_name" TEXT NOT NULL,
    "org_table_name" TEXT,
    "target_date" TIMESTAMP(3) NOT NULL,
    "horizon_months" INTEGER NOT NULL,
    "actual_value" DECIMAL(18,6),
    "forecast_value" DECIMAL(18,6) NOT NULL,
    "difference_value" DECIMAL(18,6),
    "error_type" TEXT,
    "duplicate_status" TEXT,
    "raw_record_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "lineage_json" JSONB,
    "metadata_json" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dr_forecast_accuracy_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dr_forecast_accuracy_records_organization_id_pipeline_id_be_idx" ON "dr_forecast_accuracy_records"("organization_id", "pipeline_id", "benchmark_code", "target_date");

-- CreateIndex
CREATE INDEX "dr_forecast_accuracy_records_organization_id_pipeline_id_ta_idx" ON "dr_forecast_accuracy_records"("organization_id", "pipeline_id", "target_date");

-- CreateIndex
CREATE INDEX "dr_forecast_accuracy_records_organization_id_pipeline_id_ho_idx" ON "dr_forecast_accuracy_records"("organization_id", "pipeline_id", "horizon_months", "target_date");

-- CreateIndex
CREATE INDEX "dr_forecast_accuracy_records_latest_run_id_idx" ON "dr_forecast_accuracy_records"("latest_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "dr_forecast_accuracy_records_organization_id_pipeline_id_de_key" ON "dr_forecast_accuracy_records"("organization_id", "pipeline_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "dr_forecast_accuracy_records" ADD CONSTRAINT "dr_forecast_accuracy_records_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "dr_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_forecast_accuracy_records" ADD CONSTRAINT "dr_forecast_accuracy_records_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "dr_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_forecast_accuracy_records" ADD CONSTRAINT "dr_forecast_accuracy_records_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "dr_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_forecast_accuracy_records" ADD CONSTRAINT "dr_forecast_accuracy_records_latest_run_id_fkey" FOREIGN KEY ("latest_run_id") REFERENCES "dr_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
