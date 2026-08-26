-- CreateEnum
CREATE TYPE "WaveStatus" AS ENUM ('PLANNED', 'ACTIVE', 'BLOCKED', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ReadinessState" AS ENUM ('NOT_READY', 'PLANNING', 'READY', 'BLOCKED', 'IN_PROGRESS', 'VALIDATION', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ImplementationType" AS ENUM ('ARCHITECTURE', 'RUNTIME', 'BACKEND', 'FRONTEND', 'DATABASE', 'AUTH', 'AI', 'UX', 'INGESTION', 'OBSERVABILITY', 'EXPORT', 'GOVERNANCE', 'DEPLOYMENT');

-- CreateEnum
CREATE TYPE "ExecutionComplexity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "ImplementationWave" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WaveStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImplementationWave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplementationTask" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "buildPrompt" TEXT,
    "implementationType" "ImplementationType" NOT NULL,
    "readiness" "ReadinessState" NOT NULL DEFAULT 'NOT_READY',
    "complexity" "ExecutionComplexity" NOT NULL DEFAULT 'MEDIUM',
    "effort" INTEGER NOT NULL DEFAULT 3,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PLANNED',
    "systemId" TEXT,
    "streamId" TEXT,
    "etapId" TEXT,
    "waveId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImplementationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplTaskDependency" (
    "id" TEXT NOT NULL,
    "blockingTaskId" TEXT NOT NULL,
    "blockedTaskId" TEXT NOT NULL,

    CONSTRAINT "ImplTaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImplementationWave_order_key" ON "ImplementationWave"("order");

-- CreateIndex
CREATE UNIQUE INDEX "ImplementationWave_name_key" ON "ImplementationWave"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ImplementationTask_localId_key" ON "ImplementationTask"("localId");

-- CreateIndex
CREATE UNIQUE INDEX "ImplTaskDependency_blockingTaskId_blockedTaskId_key" ON "ImplTaskDependency"("blockingTaskId", "blockedTaskId");

-- AddForeignKey
ALTER TABLE "ImplementationTask" ADD CONSTRAINT "ImplementationTask_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "CoreSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationTask" ADD CONSTRAINT "ImplementationTask_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "ExecutionStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationTask" ADD CONSTRAINT "ImplementationTask_etapId_fkey" FOREIGN KEY ("etapId") REFERENCES "Etap"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplementationTask" ADD CONSTRAINT "ImplementationTask_waveId_fkey" FOREIGN KEY ("waveId") REFERENCES "ImplementationWave"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplTaskDependency" ADD CONSTRAINT "ImplTaskDependency_blockingTaskId_fkey" FOREIGN KEY ("blockingTaskId") REFERENCES "ImplementationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplTaskDependency" ADD CONSTRAINT "ImplTaskDependency_blockedTaskId_fkey" FOREIGN KEY ("blockedTaskId") REFERENCES "ImplementationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
