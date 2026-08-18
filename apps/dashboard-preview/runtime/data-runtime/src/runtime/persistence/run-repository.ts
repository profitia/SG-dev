import type { DrRun, DrRunMode, DrRunStatus, Prisma } from "@prisma/client";

import { createDataRuntimePrismaClient, type DataRuntimePrismaClient } from "./prisma-client.ts";

export interface CreateRunInput {
  organizationId: string;
  sourceId: string;
  pipelineId: string;
  runMode: DrRunMode;
  status?: DrRunStatus;
  triggeredBy?: string | null;
  pipelineConfigFingerprint?: string | null;
  pipelineVersion?: string | null;
  registrySnapshotJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  statsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
}

export interface UpdateRunStatusInput {
  runId: string;
  status: DrRunStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  errorMessage?: string | null;
}

export interface SaveRunCompletionInput {
  runId: string;
  status: DrRunStatus;
  completedAt?: Date | null;
  failedAt?: Date | null;
  statsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  errorMessage?: string | null;
}

export interface UpdateRunExecutionMetadataInput {
  runId: string;
  pipelineConfigFingerprint?: string | null;
  pipelineVersion?: string | null;
  registrySnapshotJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  statsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  errorMessage?: string | null;
}

export class RunRepository {
  constructor(private readonly prisma: DataRuntimePrismaClient = createDataRuntimePrismaClient()) {}

  async createRun(input: CreateRunInput): Promise<DrRun> {
    return this.prisma.drRun.create({
      data: {
        organizationId: input.organizationId,
        sourceId: input.sourceId,
        pipelineId: input.pipelineId,
        runMode: input.runMode,
        status: input.status,
        triggeredBy: input.triggeredBy,
        pipelineConfigFingerprint: input.pipelineConfigFingerprint,
        pipelineVersion: input.pipelineVersion,
        registrySnapshotJson: input.registrySnapshotJson,
        statsJson: input.statsJson,
        errorMessage: input.errorMessage,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        failedAt: input.failedAt,
      },
    });
  }

  async getRunById(runId: string): Promise<DrRun | null> {
    return this.prisma.drRun.findUnique({ where: { id: runId } });
  }

  async updateRunStatus(input: UpdateRunStatusInput): Promise<DrRun> {
    return this.prisma.drRun.update({
      where: { id: input.runId },
      data: {
        status: input.status,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        failedAt: input.failedAt,
        errorMessage: input.errorMessage,
      },
    });
  }

  async saveRunCompletion(input: SaveRunCompletionInput): Promise<DrRun> {
    return this.prisma.drRun.update({
      where: { id: input.runId },
      data: {
        status: input.status,
        completedAt: input.completedAt,
        failedAt: input.failedAt,
        statsJson: input.statsJson,
        errorMessage: input.errorMessage,
      },
    });
  }

  async updateReplayReference(_: { runId: string; replayOfRunId: string | null }): Promise<never> {
    throw new Error("RunRepository cannot persist replayOfRunId because DrRun does not expose a replayOfRunId column in the active Prisma schema.");
  }

  async updateConfigFingerprint(runId: string, pipelineConfigFingerprint: string | null): Promise<DrRun> {
    return this.prisma.drRun.update({
      where: { id: runId },
      data: { pipelineConfigFingerprint },
    });
  }

  async updateRegistrySnapshot(
    runId: string,
    registrySnapshotJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
  ): Promise<DrRun> {
    return this.prisma.drRun.update({
      where: { id: runId },
      data: { registrySnapshotJson },
    });
  }

  async updateMetrics(
    runId: string,
    statsJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput,
  ): Promise<DrRun> {
    return this.prisma.drRun.update({
      where: { id: runId },
      data: { statsJson },
    });
  }

  async updateExecutionError(runId: string, errorMessage: string | null, failedAt?: Date | null): Promise<DrRun> {
    return this.prisma.drRun.update({
      where: { id: runId },
      data: {
        errorMessage,
        failedAt,
      },
    });
  }

  async updateRunExecutionMetadata(input: UpdateRunExecutionMetadataInput): Promise<DrRun> {
    return this.prisma.drRun.update({
      where: { id: input.runId },
      data: {
        pipelineConfigFingerprint: input.pipelineConfigFingerprint,
        pipelineVersion: input.pipelineVersion,
        registrySnapshotJson: input.registrySnapshotJson,
        statsJson: input.statsJson,
        errorMessage: input.errorMessage,
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}