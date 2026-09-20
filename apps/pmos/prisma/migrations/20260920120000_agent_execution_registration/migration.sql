ALTER TABLE "prompt_executions"
  ADD COLUMN "task_id" TEXT,
  ADD COLUMN "conversation_id" TEXT,
  ADD COLUMN "project" TEXT,
  ADD COLUMN "workspace" TEXT,
  ADD COLUMN "execution_environment" TEXT,
  ADD COLUMN "scope" TEXT,
  ADD COLUMN "declared_target_paths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "gate_snapshot" JSONB,
  ADD COLUMN "started_at" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "prompt_executions_task_id_key" ON "prompt_executions"("task_id");
CREATE UNIQUE INDEX "prompt_executions_conversation_id_key" ON "prompt_executions"("conversation_id");
