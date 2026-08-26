-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('PLANNING', 'EXECUTION', 'COGNITION', 'AI', 'TOPOLOGY', 'GOVERNANCE');

-- CreateEnum
CREATE TYPE "RuntimeExportStatus" AS ENUM ('PENDING', 'INGESTED', 'CONFLICT', 'STALE', 'REJECTED');

-- CreateTable
CREATE TABLE "ExecutionEvent" (
    "id" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "type" TEXT NOT NULL,
    "workspaceId" TEXT,
    "projectId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'vector',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuntimeExport" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "source" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "payload" JSONB NOT NULL,
    "status" "RuntimeExportStatus" NOT NULL DEFAULT 'PENDING',
    "ingestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceProtocol" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "runtimeVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "identity" JSONB NOT NULL DEFAULT '{}',
    "conventions" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "template" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceProtocol_workspaceId_key" ON "WorkspaceProtocol"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_name_key" ON "PromptTemplate"("name");

-- AddForeignKey
ALTER TABLE "WorkspaceProtocol" ADD CONSTRAINT "WorkspaceProtocol_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
