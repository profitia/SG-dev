import { randomUUID } from "node:crypto";

import type {
  DrDataset,
  DrRun,
  DrRunDataset,
  DrRunDatasetStatus,
  DrRunStatus,
} from "@prisma/client";

import {
  DEFAULT_EXECUTION_LEASE_DURATION_MS,
  createExecutionLeaseIdentity,
  type ExecutionLeaseIdentity,
} from "../execution-lease.ts";
import {
  PrismaExecutionLifecycleStore,
  type ExpectedExecutionLeaseInput,
  type ExecutionLifecycleStore,
} from "../persistence/execution-lifecycle-store.ts";
import { WatermarkRepository } from "../persistence/watermark-repository.ts";
import {
  createLocalIntegrationPrismaClient,
  type LocalIntegrationPrismaClient,
} from "./local-postgres-test-gate.ts";

interface DatabaseNowRow {
  current_time: Date;
}

export interface IntegrationRuntimeHarness {
  prisma: LocalIntegrationPrismaClient;
  store: PrismaExecutionLifecycleStore;
  watermarkRepository: WatermarkRepository;
  disconnect(): Promise<void>;
}

export interface SyntheticDatasetFixture {
  id: string;
  code: string;
}

export interface SyntheticRuntimeFixture {
  namespace: string;
  organizationId: string;
  connectorId: string;
  sourceId: string;
  pipelineId: string;
  sourceCode: string;
  pipelineCode: string;
  primaryDataset: SyntheticDatasetFixture;
  datasetIds: string[];
}

export interface RunningRunFixture {
  run: DrRun;
  runDataset: DrRunDataset;
  leaseIdentity: ExecutionLeaseIdentity;
  expectedLease: ExpectedExecutionLeaseInput;
}

export interface RunTimingWindowInput {
  startedAgoMs: number;
  acquiredAgoMs?: number;
  heartbeatAgoMs: number;
  expiresInMs: number;
}

export function createIntegrationRuntimeHarness(databaseUrl: string): IntegrationRuntimeHarness {
  const prisma = createLocalIntegrationPrismaClient(databaseUrl);

  return {
    prisma,
    store: new PrismaExecutionLifecycleStore(prisma),
    watermarkRepository: new WatermarkRepository(prisma),
    async disconnect() {
      await prisma.$disconnect();
    },
  };
}

export async function createSyntheticRuntimeFixture(
  prisma: LocalIntegrationPrismaClient,
  label: string,
): Promise<SyntheticRuntimeFixture> {
  const namespace = `${label}-${randomUUID().replace(/-/g, "")}`;
  const connectorId = randomUUID();
  const sourceId = randomUUID();
  const datasetId = randomUUID();
  const pipelineId = randomUUID();
  const sourceCode = `source-${namespace}`;
  const datasetCode = `dataset-${namespace}`;
  const pipelineCode = `pipeline-${namespace}`;

  await prisma.drConnector.create({
    data: {
      id: connectorId,
      code: `connector-${namespace}`,
      name: `Connector ${namespace}`,
      kind: "SNOWFLAKE",
    },
  });

  await prisma.drSource.create({
    data: {
      id: sourceId,
      connectorId,
      code: sourceCode,
      name: `Source ${namespace}`,
    },
  });

  await prisma.drDataset.create({
    data: {
      id: datasetId,
      sourceId,
      code: datasetCode,
      name: `Dataset ${namespace}`,
      datasetType: "BUSINESS",
      sourceDatabase: `db_${namespace}`,
      sourceSchema: "public",
      sourceObject: `object_${namespace}`,
      watermarkColumn: "source_updated_at",
      watermarkType: "TIMESTAMP",
    },
  });

  await prisma.drPipeline.create({
    data: {
      id: pipelineId,
      sourceId,
      datasetId,
      code: pipelineCode,
      name: `Pipeline ${namespace}`,
      targetStore: "DASHBOARD_INDEX",
      configFingerprint: `cfg-${namespace}`,
    },
  });

  return {
    namespace,
    organizationId: `org-${namespace}`,
    connectorId,
    sourceId,
    pipelineId,
    sourceCode,
    pipelineCode,
    primaryDataset: {
      id: datasetId,
      code: datasetCode,
    },
    datasetIds: [datasetId],
  };
}

export async function createSecondaryDataset(
  prisma: LocalIntegrationPrismaClient,
  fixture: SyntheticRuntimeFixture,
  label: string,
): Promise<SyntheticDatasetFixture> {
  const datasetId = randomUUID();
  const code = `${label}-${fixture.namespace}`;

  await prisma.drDataset.create({
    data: {
      id: datasetId,
      sourceId: fixture.sourceId,
      code,
      name: `Dataset ${code}`,
      datasetType: "BUSINESS",
      sourceDatabase: `db_${fixture.namespace}`,
      sourceSchema: "public",
      sourceObject: `object_${code}`,
      watermarkColumn: "source_updated_at",
      watermarkType: "TIMESTAMP",
    },
  });

  fixture.datasetIds.push(datasetId);

  return { id: datasetId, code };
}

export async function createRunningRunWithLease(
  store: ExecutionLifecycleStore,
  fixture: SyntheticRuntimeFixture,
  options: {
    dataset?: SyntheticDatasetFixture;
    runDatasetId?: string;
    startedAt?: Date;
  } = {},
): Promise<RunningRunFixture> {
  const leaseIdentity = createExecutionLeaseIdentity();
  const runDatasetId = options.runDatasetId ?? randomUUID();
  const dataset = options.dataset ?? fixture.primaryDataset;
  const persisted = await store.createRunningLifecycle({
    organizationId: fixture.organizationId,
    sourceId: fixture.sourceId,
    datasetId: dataset.id,
    datasetType: "BUSINESS",
    pipelineId: fixture.pipelineId,
    runMode: "MANUAL",
    triggeredBy: "test:integration",
    pipelineConfigFingerprint: `cfg-${fixture.namespace}`,
    pipelineVersion: "1.0.0-test",
    startedAt: options.startedAt ?? new Date("2026-07-22T12:00:00.000Z"),
    runDatasetId,
    executionLease: {
      ownerId: leaseIdentity.ownerId,
      tokenHash: leaseIdentity.tokenHash,
      leaseDurationMs: DEFAULT_EXECUTION_LEASE_DURATION_MS,
    },
  });

  if (!persisted.executionLease) {
    throw new Error("Expected createRunningLifecycle to persist an execution lease.");
  }

  return {
    run: persisted.run,
    runDataset: persisted.runDataset,
    leaseIdentity,
    expectedLease: {
      ownerId: leaseIdentity.ownerId,
      tokenHash: leaseIdentity.tokenHash,
      epoch: persisted.executionLease.epoch,
    },
  };
}

export async function createLegacyRunningRun(
  prisma: LocalIntegrationPrismaClient,
  fixture: SyntheticRuntimeFixture,
  options: {
    dataset?: SyntheticDatasetFixture;
    startedAt?: Date;
  } = {},
): Promise<{ run: DrRun; runDataset: DrRunDataset }> {
  const dataset = options.dataset ?? fixture.primaryDataset;
  const run = await prisma.drRun.create({
    data: {
      id: randomUUID(),
      organizationId: fixture.organizationId,
      sourceId: fixture.sourceId,
      pipelineId: fixture.pipelineId,
      runMode: "MANUAL",
      status: "RUNNING",
      triggeredBy: "test:integration",
      pipelineConfigFingerprint: `cfg-${fixture.namespace}`,
      pipelineVersion: "1.0.0-test",
      startedAt: options.startedAt ?? new Date("2026-07-22T12:00:00.000Z"),
      leaseEpoch: BigInt(0),
    },
  });

  const runDataset = await prisma.drRunDataset.create({
    data: {
      id: randomUUID(),
      organizationId: fixture.organizationId,
      runId: run.id,
      sourceId: fixture.sourceId,
      datasetId: dataset.id,
      datasetType: "BUSINESS",
      status: "RUNNING",
      rowsRead: 0,
      rowsWrittenRaw: 0,
      rowsWrittenDashboard: 0,
      rowsDeduplicated: 0,
      rowsFailed: 0,
      startedAt: run.startedAt,
    },
  });

  return { run, runDataset };
}

export async function addRunDataset(
  prisma: LocalIntegrationPrismaClient,
  fixture: SyntheticRuntimeFixture,
  input: {
    runId: string;
    dataset: SyntheticDatasetFixture;
    status: DrRunDatasetStatus;
  },
): Promise<DrRunDataset> {
  const completedAt = input.status === "RUNNING" || input.status === "PENDING" ? null : new Date("2026-07-22T12:05:00.000Z");

  return await prisma.drRunDataset.create({
    data: {
      id: randomUUID(),
      organizationId: fixture.organizationId,
      runId: input.runId,
      sourceId: fixture.sourceId,
      datasetId: input.dataset.id,
      datasetType: "BUSINESS",
      status: input.status,
      rowsRead: 0,
      rowsWrittenRaw: 0,
      rowsWrittenDashboard: 0,
      rowsDeduplicated: 0,
      rowsFailed: 0,
      startedAt: new Date("2026-07-22T12:00:00.000Z"),
      completedAt,
    },
  });
}

export async function getDatabaseNow(prisma: LocalIntegrationPrismaClient): Promise<Date> {
  const rows = await prisma.$queryRaw<DatabaseNowRow[]>`SELECT clock_timestamp() AS current_time`;
  const currentTime = rows[0]?.current_time;

  if (!(currentTime instanceof Date)) {
    throw new Error("Expected clock_timestamp() to return a Date.");
  }

  return currentTime;
}

export async function setRunTimingWindowRelativeToNow(
  prisma: LocalIntegrationPrismaClient,
  runId: string,
  input: RunTimingWindowInput,
): Promise<void> {
  const acquiredAgoMs = input.acquiredAgoMs ?? input.heartbeatAgoMs;

  await prisma.$executeRaw`
    UPDATE "dr_runs"
    SET "started_at" = clock_timestamp() - (${input.startedAgoMs} * interval '1 millisecond'),
        "lease_acquired_at" = clock_timestamp() - (${acquiredAgoMs} * interval '1 millisecond'),
        "lease_heartbeat_at" = clock_timestamp() - (${input.heartbeatAgoMs} * interval '1 millisecond'),
        "lease_expires_at" = clock_timestamp() + (${input.expiresInMs} * interval '1 millisecond'),
        "lease_released_at" = NULL
    WHERE "id" = ${runId}
  `;
}

export async function readRun(
  prisma: LocalIntegrationPrismaClient,
  runId: string,
): Promise<DrRun> {
  return await prisma.drRun.findUniqueOrThrow({ where: { id: runId } });
}

export async function readRunWithDatasets(
  prisma: LocalIntegrationPrismaClient,
  runId: string,
): Promise<DrRun & { runDatasets: DrRunDataset[] }> {
  return await prisma.drRun.findUniqueOrThrow({
    where: { id: runId },
    include: {
      runDatasets: {
        where: { deletedAt: null },
        orderBy: { id: "asc" },
      },
    },
  });
}

export async function updateRunStatus(
  prisma: LocalIntegrationPrismaClient,
  runId: string,
  status: DrRunStatus,
): Promise<void> {
  await prisma.drRun.update({
    where: { id: runId },
    data: {
      status,
      completedAt: status === "RUNNING" ? null : new Date("2026-07-22T12:10:00.000Z"),
      failedAt: status === "FAILED" ? new Date("2026-07-22T12:10:00.000Z") : null,
    },
  });
}

export async function cleanupSyntheticRuntimeFixture(
  prisma: LocalIntegrationPrismaClient,
  fixture: SyntheticRuntimeFixture,
): Promise<void> {
  await prisma.drWatermark.deleteMany({
    where: {
      organizationId: fixture.organizationId,
      sourceId: fixture.sourceId,
      pipelineId: fixture.pipelineId,
    },
  });

  await prisma.drRunDataset.deleteMany({
    where: {
      organizationId: fixture.organizationId,
      sourceId: fixture.sourceId,
    },
  });

  await prisma.drRun.deleteMany({
    where: {
      organizationId: fixture.organizationId,
      sourceId: fixture.sourceId,
      pipelineId: fixture.pipelineId,
    },
  });

  await prisma.drPipeline.deleteMany({
    where: {
      id: fixture.pipelineId,
    },
  });

  await prisma.drDataset.deleteMany({
    where: {
      id: { in: fixture.datasetIds },
    },
  });

  await prisma.drSource.deleteMany({
    where: {
      id: fixture.sourceId,
    },
  });

  await prisma.drConnector.deleteMany({
    where: {
      id: fixture.connectorId,
    },
  });
}

export function createBarrier(participants: number) {
  let arrived = 0;
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    async wait(): Promise<void> {
      arrived += 1;

      if (arrived === participants) {
        release?.();
      }

      await gate;
    },
  };
}