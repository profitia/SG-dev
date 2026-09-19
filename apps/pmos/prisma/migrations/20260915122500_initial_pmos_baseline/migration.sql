-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('backlog', 'in_progress', 'blocked', 'done', 'archived');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "CanonicalAlignment" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "WarningSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "WarningType" AS ENUM ('dashboard_gravity', 'runtime_boundary', 'business_logic_leak', 'orchestration_drift', 'overengineering', 'prompt_coupling', 'architecture_debt');

-- CreateEnum
CREATE TYPE "NodeScope" AS ENUM ('active', 'strategic_backlog');

-- CreateEnum
CREATE TYPE "PromptStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'archived');

-- CreateEnum
CREATE TYPE "BlueprintSourceType" AS ENUM ('document', 'specification', 'decision_record', 'principle_set');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('created', 'updated', 'deleted', 'renamed', 'migrated');

-- CreateEnum
CREATE TYPE "ImpactLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('implementation', 'refactor', 'migration', 'architecture', 'debugging', 'runtime_analysis', 'performance', 'infra', 'warning_resolution');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('implementation', 'architecture', 'debugging', 'philosophy', 'runtime_analysis', 'orchestration', 'ux', 'continuity', 'governance', 'infrastructure');

-- CreateEnum
CREATE TYPE "ImportanceLevel" AS ENUM ('low', 'medium', 'high', 'foundational');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('CLOSEOUT', 'EXECUTION_TRAIL', 'HANDOFF', 'PUBLICATION', 'RUNTIME_SNAPSHOT');

-- CreateEnum
CREATE TYPE "ArtifactNature" AS ENUM ('PRIMARY', 'DERIVED');

-- CreateEnum
CREATE TYPE "ArtifactStatus" AS ENUM ('GENERATED', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "roadmap_nodes" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "NodeStatus" NOT NULL DEFAULT 'backlog',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "order" INTEGER NOT NULL DEFAULT 0,
    "sort_key" TEXT NOT NULL DEFAULT '',
    "scope" "NodeScope" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roadmap_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "prompt" TEXT,
    "changed_files" TEXT[],
    "architectural_impact" TEXT,
    "blockers" TEXT,
    "next_steps" TEXT,
    "canonical_alignment" "CanonicalAlignment" NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "impact" TEXT,
    "affected_systems" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_node_tags" (
    "node_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "roadmap_node_tags_pkey" PRIMARY KEY ("node_id","tag_id")
);

-- CreateTable
CREATE TABLE "log_tags" (
    "log_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "log_tags_pkey" PRIMARY KEY ("log_id","tag_id")
);

-- CreateTable
CREATE TABLE "roadmap_node_logs" (
    "node_id" TEXT NOT NULL,
    "log_id" TEXT NOT NULL,

    CONSTRAINT "roadmap_node_logs_pkey" PRIMARY KEY ("node_id","log_id")
);

-- CreateTable
CREATE TABLE "roadmap_node_decisions" (
    "node_id" TEXT NOT NULL,
    "decision_id" TEXT NOT NULL,

    CONSTRAINT "roadmap_node_decisions_pkey" PRIMARY KEY ("node_id","decision_id")
);

-- CreateTable
CREATE TABLE "architecture_warnings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "WarningSeverity" NOT NULL DEFAULT 'medium',
    "type" "WarningType" NOT NULL,
    "affected_area" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "related_log_id" TEXT,
    "related_roadmap_node_id" TEXT,
    "related_principle_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "architecture_warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_principles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_principles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_node_principles" (
    "node_id" TEXT NOT NULL,
    "principle_id" TEXT NOT NULL,

    CONSTRAINT "roadmap_node_principles_pkey" PRIMARY KEY ("node_id","principle_id")
);

-- CreateTable
CREATE TABLE "decision_principles" (
    "decision_id" TEXT NOT NULL,
    "principle_id" TEXT NOT NULL,

    CONSTRAINT "decision_principles_pkey" PRIMARY KEY ("decision_id","principle_id")
);

-- CreateTable
CREATE TABLE "prompt_executions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "etap" TEXT,
    "subetap" TEXT,
    "node" TEXT,
    "domain" TEXT,
    "prompt_type" TEXT,
    "prompt_content" TEXT NOT NULL,
    "execution_summary" TEXT,
    "architectural_impact" TEXT,
    "changed_files" TEXT[],
    "blockers" TEXT,
    "next_steps" TEXT,
    "status" "PromptStatus" NOT NULL DEFAULT 'queued',
    "roadmap_node_id" TEXT,
    "execution_log_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changed_files" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "change_type" "ChangeType" NOT NULL DEFAULT 'updated',
    "impact_level" "ImpactLevel" NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "execution_log_id" TEXT,
    "prompt_execution_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "changed_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template_type" "TemplateType" NOT NULL,
    "template_content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint_sources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_type" "BlueprintSourceType" NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blueprint_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_artifacts" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "project" TEXT NOT NULL DEFAULT 'project',
    "task_id" TEXT,
    "scope" TEXT,
    "etap" TEXT,
    "subetap" TEXT,
    "domains" TEXT[],
    "conversation_type" "ConversationType",
    "importance_level" "ImportanceLevel",
    "user_prompt" TEXT NOT NULL,
    "llm_response" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tags" TEXT[],
    "chronology_order" INTEGER NOT NULL DEFAULT 0,
    "flight_record_json" JSONB,
    "files_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "artifact_kind" "ArtifactKind" NOT NULL,
    "artifact_nature" "ArtifactNature" NOT NULL,
    "version" TEXT NOT NULL,
    "status" "ArtifactStatus" NOT NULL DEFAULT 'GENERATED',
    "task_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "source_refs" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "copy_ready_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_decisions" (
    "conversation_id" TEXT NOT NULL,
    "decision_id" TEXT NOT NULL,

    CONSTRAINT "conversation_decisions_pkey" PRIMARY KEY ("conversation_id","decision_id")
);

-- CreateTable
CREATE TABLE "conversation_warnings" (
    "conversation_id" TEXT NOT NULL,
    "warning_id" TEXT NOT NULL,

    CONSTRAINT "conversation_warnings_pkey" PRIMARY KEY ("conversation_id","warning_id")
);

-- CreateTable
CREATE TABLE "conversation_roadmap_nodes" (
    "conversation_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,

    CONSTRAINT "conversation_roadmap_nodes_pkey" PRIMARY KEY ("conversation_id","node_id")
);

-- CreateTable
CREATE TABLE "conversation_logs" (
    "conversation_id" TEXT NOT NULL,
    "log_id" TEXT NOT NULL,

    CONSTRAINT "conversation_logs_pkey" PRIMARY KEY ("conversation_id","log_id")
);

-- CreateTable
CREATE TABLE "conversation_principles" (
    "conversation_id" TEXT NOT NULL,
    "principle_id" TEXT NOT NULL,

    CONSTRAINT "conversation_principles_pkey" PRIMARY KEY ("conversation_id","principle_id")
);

-- CreateTable
CREATE TABLE "conversation_prompts" (
    "conversation_id" TEXT NOT NULL,
    "prompt_execution_id" TEXT NOT NULL,

    CONSTRAINT "conversation_prompts_pkey" PRIMARY KEY ("conversation_id","prompt_execution_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "decisions_number_key" ON "decisions"("number");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_executions_execution_log_id_key" ON "prompt_executions"("execution_log_id");

-- CreateIndex
CREATE INDEX "changed_files_path_idx" ON "changed_files"("path");

-- CreateIndex
CREATE INDEX "changed_files_impact_level_idx" ON "changed_files"("impact_level");

-- CreateIndex
CREATE INDEX "changed_files_change_type_idx" ON "changed_files"("change_type");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_artifacts_conversation_id_key" ON "conversation_artifacts"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_artifacts_timestamp_idx" ON "conversation_artifacts"("timestamp");

-- CreateIndex
CREATE INDEX "conversation_artifacts_etap_idx" ON "conversation_artifacts"("etap");

-- CreateIndex
CREATE INDEX "conversation_artifacts_scope_idx" ON "conversation_artifacts"("scope");

-- CreateIndex
CREATE INDEX "conversation_artifacts_importance_level_idx" ON "conversation_artifacts"("importance_level");

-- CreateIndex
CREATE INDEX "conversation_artifacts_conversation_type_idx" ON "conversation_artifacts"("conversation_type");

-- CreateIndex
CREATE INDEX "artifacts_artifact_kind_idx" ON "artifacts"("artifact_kind");

-- CreateIndex
CREATE INDEX "artifacts_artifact_nature_idx" ON "artifacts"("artifact_nature");

-- CreateIndex
CREATE INDEX "artifacts_status_idx" ON "artifacts"("status");

-- CreateIndex
CREATE INDEX "artifacts_task_id_idx" ON "artifacts"("task_id");

-- CreateIndex
CREATE INDEX "artifacts_conversation_id_idx" ON "artifacts"("conversation_id");

-- CreateIndex
CREATE INDEX "artifacts_created_at_idx" ON "artifacts"("created_at");

-- AddForeignKey
ALTER TABLE "roadmap_nodes" ADD CONSTRAINT "roadmap_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "roadmap_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_tags" ADD CONSTRAINT "roadmap_node_tags_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_tags" ADD CONSTRAINT "roadmap_node_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_tags" ADD CONSTRAINT "log_tags_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "execution_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_tags" ADD CONSTRAINT "log_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_logs" ADD CONSTRAINT "roadmap_node_logs_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_logs" ADD CONSTRAINT "roadmap_node_logs_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "execution_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_decisions" ADD CONSTRAINT "roadmap_node_decisions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_decisions" ADD CONSTRAINT "roadmap_node_decisions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_warnings" ADD CONSTRAINT "architecture_warnings_related_log_id_fkey" FOREIGN KEY ("related_log_id") REFERENCES "execution_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_warnings" ADD CONSTRAINT "architecture_warnings_related_roadmap_node_id_fkey" FOREIGN KEY ("related_roadmap_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_warnings" ADD CONSTRAINT "architecture_warnings_related_principle_id_fkey" FOREIGN KEY ("related_principle_id") REFERENCES "canonical_principles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_principles" ADD CONSTRAINT "roadmap_node_principles_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_node_principles" ADD CONSTRAINT "roadmap_node_principles_principle_id_fkey" FOREIGN KEY ("principle_id") REFERENCES "canonical_principles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_principles" ADD CONSTRAINT "decision_principles_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_principles" ADD CONSTRAINT "decision_principles_principle_id_fkey" FOREIGN KEY ("principle_id") REFERENCES "canonical_principles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_executions" ADD CONSTRAINT "prompt_executions_roadmap_node_id_fkey" FOREIGN KEY ("roadmap_node_id") REFERENCES "roadmap_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_executions" ADD CONSTRAINT "prompt_executions_execution_log_id_fkey" FOREIGN KEY ("execution_log_id") REFERENCES "execution_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changed_files" ADD CONSTRAINT "changed_files_execution_log_id_fkey" FOREIGN KEY ("execution_log_id") REFERENCES "execution_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "changed_files" ADD CONSTRAINT "changed_files_prompt_execution_id_fkey" FOREIGN KEY ("prompt_execution_id") REFERENCES "prompt_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation_artifacts"("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_decisions" ADD CONSTRAINT "conversation_decisions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_decisions" ADD CONSTRAINT "conversation_decisions_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_warnings" ADD CONSTRAINT "conversation_warnings_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_warnings" ADD CONSTRAINT "conversation_warnings_warning_id_fkey" FOREIGN KEY ("warning_id") REFERENCES "architecture_warnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_roadmap_nodes" ADD CONSTRAINT "conversation_roadmap_nodes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_roadmap_nodes" ADD CONSTRAINT "conversation_roadmap_nodes_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "roadmap_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_logs" ADD CONSTRAINT "conversation_logs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_logs" ADD CONSTRAINT "conversation_logs_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "execution_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_principles" ADD CONSTRAINT "conversation_principles_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_principles" ADD CONSTRAINT "conversation_principles_principle_id_fkey" FOREIGN KEY ("principle_id") REFERENCES "canonical_principles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_prompts" ADD CONSTRAINT "conversation_prompts_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_prompts" ADD CONSTRAINT "conversation_prompts_prompt_execution_id_fkey" FOREIGN KEY ("prompt_execution_id") REFERENCES "prompt_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
