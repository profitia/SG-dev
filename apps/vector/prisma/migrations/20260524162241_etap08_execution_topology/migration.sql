-- CreateEnum
CREATE TYPE "PhaseStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "SystemStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE');

-- AlterTable
ALTER TABLE "Etap" ADD COLUMN     "description" TEXT,
ADD COLUMN     "phaseId" TEXT;

-- AlterTable
ALTER TABLE "Subetap" ADD COLUMN     "description" TEXT,
ADD COLUMN     "streamId" TEXT;

-- CreateTable
CREATE TABLE "ExecutionPhase" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PhaseStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionStream" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoreSystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domainId" TEXT,
    "streamId" TEXT,
    "phaseId" TEXT,
    "status" "SystemStatus" NOT NULL DEFAULT 'PLANNED',
    "criticality" "Criticality" NOT NULL DEFAULT 'MEDIUM',
    "isBlocking" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoreSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemDependency" (
    "id" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "targetSystemId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL DEFAULT 'runtime',
    "criticality" "Criticality" NOT NULL DEFAULT 'MEDIUM',
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriticalPathNode" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "rationale" TEXT,
    "isBlocker" BOOLEAN NOT NULL DEFAULT false,
    "systemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriticalPathNode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionPhase_order_key" ON "ExecutionPhase"("order");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionPhase_name_key" ON "ExecutionPhase"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionStream_name_key" ON "ExecutionStream"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CoreSystem_name_key" ON "CoreSystem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SystemDependency_sourceSystemId_targetSystemId_dependencyTy_key" ON "SystemDependency"("sourceSystemId", "targetSystemId", "dependencyType");

-- CreateIndex
CREATE UNIQUE INDEX "CriticalPathNode_order_key" ON "CriticalPathNode"("order");

-- AddForeignKey
ALTER TABLE "Etap" ADD CONSTRAINT "Etap_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ExecutionPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subetap" ADD CONSTRAINT "Subetap_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "ExecutionStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoreSystem" ADD CONSTRAINT "CoreSystem_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ExecutionDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoreSystem" ADD CONSTRAINT "CoreSystem_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "ExecutionStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoreSystem" ADD CONSTRAINT "CoreSystem_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ExecutionPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemDependency" ADD CONSTRAINT "SystemDependency_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "CoreSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemDependency" ADD CONSTRAINT "SystemDependency_targetSystemId_fkey" FOREIGN KEY ("targetSystemId") REFERENCES "CoreSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriticalPathNode" ADD CONSTRAINT "CriticalPathNode_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "CoreSystem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
