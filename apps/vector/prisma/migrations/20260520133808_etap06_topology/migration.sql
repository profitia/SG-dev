-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('runtime', 'orchestration', 'ui', 'infra', 'cognition', 'ai', 'localization', 'deployment');

-- CreateEnum
CREATE TYPE "Criticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "ProjectDependency" (
    "id" TEXT NOT NULL,
    "sourceProjectId" TEXT NOT NULL,
    "targetProjectId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL DEFAULT 'runtime',
    "criticality" "Criticality" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDomain" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExecutionDomain" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executionDomainId" TEXT NOT NULL,

    CONSTRAINT "ProjectExecutionDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedBlocker" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" "Criticality" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedBlocker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedBlockerProject" (
    "id" TEXT NOT NULL,
    "sharedBlockerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "SharedBlockerProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDependency_sourceProjectId_targetProjectId_dependenc_key" ON "ProjectDependency"("sourceProjectId", "targetProjectId", "dependencyType");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionDomain_name_key" ON "ExecutionDomain"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectExecutionDomain_projectId_executionDomainId_key" ON "ProjectExecutionDomain"("projectId", "executionDomainId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedBlockerProject_sharedBlockerId_projectId_key" ON "SharedBlockerProject"("sharedBlockerId", "projectId");

-- AddForeignKey
ALTER TABLE "ProjectDependency" ADD CONSTRAINT "ProjectDependency_sourceProjectId_fkey" FOREIGN KEY ("sourceProjectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDependency" ADD CONSTRAINT "ProjectDependency_targetProjectId_fkey" FOREIGN KEY ("targetProjectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExecutionDomain" ADD CONSTRAINT "ProjectExecutionDomain_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExecutionDomain" ADD CONSTRAINT "ProjectExecutionDomain_executionDomainId_fkey" FOREIGN KEY ("executionDomainId") REFERENCES "ExecutionDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedBlockerProject" ADD CONSTRAINT "SharedBlockerProject_sharedBlockerId_fkey" FOREIGN KEY ("sharedBlockerId") REFERENCES "SharedBlocker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedBlockerProject" ADD CONSTRAINT "SharedBlockerProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
