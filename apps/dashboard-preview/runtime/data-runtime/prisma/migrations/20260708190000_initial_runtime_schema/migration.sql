-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DrConnectorKind" AS ENUM ('SNOWFLAKE', 'REST_API', 'CSV', 'EXCEL', 'S3');

-- CreateEnum
CREATE TYPE "DrDatasetType" AS ENUM ('BUSINESS', 'REFERENCE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DrPipelineTargetStore" AS ENUM ('DASHBOARD_INDEX');

-- CreateEnum
CREATE TYPE "DrRunMode" AS ENUM ('MANUAL', 'INCREMENTAL', 'REPLAY', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "DrRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "DrRunDatasetStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DrWatermarkType" AS ENUM ('TIMESTAMP', 'DATE', 'NUMBER', 'STRING');

-- CreateTable
CREATE TABLE "dr_connectors" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DrConnectorKind" NOT NULL,
    "config_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dr_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dr_sources" (
    "id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dr_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dr_datasets" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataset_type" "DrDatasetType" NOT NULL,
    "source_database" TEXT NOT NULL,
    "source_schema" TEXT NOT NULL,
    "source_object" TEXT NOT NULL,
    "watermark_column" TEXT,
    "watermark_type" "DrWatermarkType",
    "fetch_config_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dr_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dr_pipelines" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_store" "DrPipelineTargetStore" NOT NULL,
    "config_json" JSONB,
    "config_fingerprint" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dr_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dr_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "run_mode" "DrRunMode" NOT NULL,
    "status" "DrRunStatus" NOT NULL DEFAULT 'PENDING',
    "triggered_by" TEXT,
    "pipeline_config_fingerprint" TEXT,
    "pipeline_version" TEXT,
    "registry_snapshot_json" JSONB,
    "stats_json" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dr_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dr_run_datasets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "dataset_type" "DrDatasetType" NOT NULL,
    "status" "DrRunDatasetStatus" NOT NULL DEFAULT 'PENDING',
    "rows_read" INTEGER NOT NULL DEFAULT 0,
    "rows_written_raw" INTEGER NOT NULL DEFAULT 0,
    "rows_written_dashboard" INTEGER NOT NULL DEFAULT 0,
    "rows_deduplicated" INTEGER NOT NULL DEFAULT 0,
    "rows_failed" INTEGER NOT NULL DEFAULT 0,
    "watermark_before" TEXT,
    "watermark_after" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dr_run_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dr_watermarks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "watermark_column" TEXT NOT NULL,
    "watermark_type" "DrWatermarkType" NOT NULL,
    "last_value" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "updated_by_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dr_watermarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dr_raw_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "run_dataset_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "connector_key" TEXT NOT NULL,
    "source_database" TEXT NOT NULL,
    "source_schema" TEXT NOT NULL,
    "source_object" TEXT NOT NULL,
    "source_row_id" TEXT,
    "source_updated_at" TIMESTAMP(3),
    "payload_json" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL,
    "is_replayed" BOOLEAN NOT NULL DEFAULT false,
    "replay_of_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dr_raw_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dr_dashboard_index_records" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "pipeline_id" TEXT NOT NULL,
    "latest_run_id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "scenario_type" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "component_name" TEXT NOT NULL,
    "component_code" TEXT,
    "metric_value" DECIMAL(18,6),
    "unit" TEXT,
    "currency" TEXT,
    "source_date" TIMESTAMP(3),
    "market" TEXT,
    "country" TEXT,
    "quality_status" TEXT,
    "duplicate_status" TEXT,
    "raw_record_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "lineage_json" JSONB,
    "metadata_json" JSONB,
    "last_synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dr_dashboard_index_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dr_connectors_code_key" ON "dr_connectors"("code");

-- CreateIndex
CREATE INDEX "dr_connectors_kind_idx" ON "dr_connectors"("kind");

-- CreateIndex
CREATE INDEX "dr_connectors_is_active_idx" ON "dr_connectors"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "dr_sources_code_key" ON "dr_sources"("code");

-- CreateIndex
CREATE INDEX "dr_sources_connector_id_idx" ON "dr_sources"("connector_id");

-- CreateIndex
CREATE INDEX "dr_sources_is_active_idx" ON "dr_sources"("is_active");

-- CreateIndex
CREATE INDEX "dr_datasets_source_id_idx" ON "dr_datasets"("source_id");

-- CreateIndex
CREATE INDEX "dr_datasets_dataset_type_idx" ON "dr_datasets"("dataset_type");

-- CreateIndex
CREATE INDEX "dr_datasets_is_active_idx" ON "dr_datasets"("is_active");

-- CreateIndex
CREATE INDEX "dr_datasets_source_database_source_schema_source_object_idx" ON "dr_datasets"("source_database", "source_schema", "source_object");

-- CreateIndex
CREATE UNIQUE INDEX "dr_datasets_source_id_code_key" ON "dr_datasets"("source_id", "code");

-- CreateIndex
CREATE INDEX "dr_pipelines_source_id_idx" ON "dr_pipelines"("source_id");

-- CreateIndex
CREATE INDEX "dr_pipelines_dataset_id_idx" ON "dr_pipelines"("dataset_id");

-- CreateIndex
CREATE INDEX "dr_pipelines_target_store_idx" ON "dr_pipelines"("target_store");

-- CreateIndex
CREATE INDEX "dr_pipelines_is_active_idx" ON "dr_pipelines"("is_active");

-- CreateIndex
CREATE INDEX "dr_pipelines_config_fingerprint_idx" ON "dr_pipelines"("config_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "dr_pipelines_source_id_dataset_id_code_key" ON "dr_pipelines"("source_id", "dataset_id", "code");

-- CreateIndex
CREATE INDEX "dr_runs_organization_id_idx" ON "dr_runs"("organization_id");

-- CreateIndex
CREATE INDEX "dr_runs_organization_id_pipeline_id_started_at_idx" ON "dr_runs"("organization_id", "pipeline_id", "started_at");

-- CreateIndex
CREATE INDEX "dr_runs_organization_id_status_idx" ON "dr_runs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "dr_runs_source_id_idx" ON "dr_runs"("source_id");

-- CreateIndex
CREATE INDEX "dr_runs_pipeline_id_idx" ON "dr_runs"("pipeline_id");

-- CreateIndex
CREATE INDEX "dr_runs_pipeline_version_idx" ON "dr_runs"("pipeline_version");

-- CreateIndex
CREATE INDEX "dr_run_datasets_organization_id_idx" ON "dr_run_datasets"("organization_id");

-- CreateIndex
CREATE INDEX "dr_run_datasets_run_id_idx" ON "dr_run_datasets"("run_id");

-- CreateIndex
CREATE INDEX "dr_run_datasets_dataset_id_idx" ON "dr_run_datasets"("dataset_id");

-- CreateIndex
CREATE INDEX "dr_run_datasets_organization_id_dataset_id_status_idx" ON "dr_run_datasets"("organization_id", "dataset_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dr_run_datasets_run_id_dataset_id_key" ON "dr_run_datasets"("run_id", "dataset_id");

-- CreateIndex
CREATE INDEX "dr_watermarks_organization_id_idx" ON "dr_watermarks"("organization_id");

-- CreateIndex
CREATE INDEX "dr_watermarks_pipeline_id_idx" ON "dr_watermarks"("pipeline_id");

-- CreateIndex
CREATE INDEX "dr_watermarks_updated_by_run_id_idx" ON "dr_watermarks"("updated_by_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "dr_watermarks_organization_id_source_id_dataset_id_pipeline_key" ON "dr_watermarks"("organization_id", "source_id", "dataset_id", "pipeline_id");

-- CreateIndex
CREATE INDEX "dr_raw_records_organization_id_run_id_idx" ON "dr_raw_records"("organization_id", "run_id");

-- CreateIndex
CREATE INDEX "dr_raw_records_organization_id_run_dataset_id_idx" ON "dr_raw_records"("organization_id", "run_dataset_id");

-- CreateIndex
CREATE INDEX "dr_raw_records_organization_id_dataset_id_source_updated_at_idx" ON "dr_raw_records"("organization_id", "dataset_id", "source_updated_at");

-- CreateIndex
CREATE INDEX "dr_raw_records_organization_id_dataset_id_payload_hash_idx" ON "dr_raw_records"("organization_id", "dataset_id", "payload_hash");

-- CreateIndex
CREATE INDEX "dr_raw_records_organization_id_pipeline_id_ingested_at_idx" ON "dr_raw_records"("organization_id", "pipeline_id", "ingested_at");

-- CreateIndex
CREATE INDEX "dr_raw_records_replay_of_run_id_idx" ON "dr_raw_records"("replay_of_run_id");

-- CreateIndex
CREATE INDEX "dr_raw_records_organization_id_replay_of_run_id_idx" ON "dr_raw_records"("organization_id", "replay_of_run_id");

-- CreateIndex
CREATE INDEX "dr_dashboard_index_records_organization_id_pipeline_id_sour_idx" ON "dr_dashboard_index_records"("organization_id", "pipeline_id", "source_date");

-- CreateIndex
CREATE INDEX "dr_dashboard_index_records_organization_id_pipeline_id_scen_idx" ON "dr_dashboard_index_records"("organization_id", "pipeline_id", "scenario_type", "source_date");

-- CreateIndex
CREATE INDEX "dr_dashboard_index_records_organization_id_pipeline_id_comp_idx" ON "dr_dashboard_index_records"("organization_id", "pipeline_id", "component_id");

-- CreateIndex
CREATE INDEX "dr_dashboard_index_records_organization_id_pipeline_id_mark_idx" ON "dr_dashboard_index_records"("organization_id", "pipeline_id", "market", "source_date");

-- CreateIndex
CREATE INDEX "dr_dashboard_index_records_latest_run_id_idx" ON "dr_dashboard_index_records"("latest_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "dr_dashboard_index_records_organization_id_pipeline_id_dedu_key" ON "dr_dashboard_index_records"("organization_id", "pipeline_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "dr_sources" ADD CONSTRAINT "dr_sources_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "dr_connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_datasets" ADD CONSTRAINT "dr_datasets_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "dr_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_pipelines" ADD CONSTRAINT "dr_pipelines_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "dr_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_pipelines" ADD CONSTRAINT "dr_pipelines_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "dr_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_runs" ADD CONSTRAINT "dr_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "dr_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_runs" ADD CONSTRAINT "dr_runs_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "dr_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_run_datasets" ADD CONSTRAINT "dr_run_datasets_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "dr_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_run_datasets" ADD CONSTRAINT "dr_run_datasets_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "dr_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_run_datasets" ADD CONSTRAINT "dr_run_datasets_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "dr_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_watermarks" ADD CONSTRAINT "dr_watermarks_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "dr_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_watermarks" ADD CONSTRAINT "dr_watermarks_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "dr_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_watermarks" ADD CONSTRAINT "dr_watermarks_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "dr_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_watermarks" ADD CONSTRAINT "dr_watermarks_updated_by_run_id_fkey" FOREIGN KEY ("updated_by_run_id") REFERENCES "dr_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_raw_records" ADD CONSTRAINT "dr_raw_records_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "dr_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_raw_records" ADD CONSTRAINT "dr_raw_records_run_dataset_id_fkey" FOREIGN KEY ("run_dataset_id") REFERENCES "dr_run_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_raw_records" ADD CONSTRAINT "dr_raw_records_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "dr_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_raw_records" ADD CONSTRAINT "dr_raw_records_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "dr_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_raw_records" ADD CONSTRAINT "dr_raw_records_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "dr_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_raw_records" ADD CONSTRAINT "dr_raw_records_replay_of_run_id_fkey" FOREIGN KEY ("replay_of_run_id") REFERENCES "dr_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_dashboard_index_records" ADD CONSTRAINT "dr_dashboard_index_records_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "dr_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_dashboard_index_records" ADD CONSTRAINT "dr_dashboard_index_records_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "dr_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_dashboard_index_records" ADD CONSTRAINT "dr_dashboard_index_records_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "dr_pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_dashboard_index_records" ADD CONSTRAINT "dr_dashboard_index_records_latest_run_id_fkey" FOREIGN KEY ("latest_run_id") REFERENCES "dr_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
