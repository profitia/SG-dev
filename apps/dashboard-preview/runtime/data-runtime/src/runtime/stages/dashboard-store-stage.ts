import { Prisma } from "@prisma/client";

import { ComposedPipelineStage } from "./composed-stage.ts";
import { throwIfExecutionAborted, type ExecutionContext } from "../execution-context.ts";
import { ExecutionLeaseStageGuard } from "../execution-lease-stage-guard.ts";
import type {
  DashboardStoreError,
  DashboardStoreRecord,
  DashboardStoreResult,
  DashboardStoreWarning,
} from "../dashboard-store-result.ts";
import type { DeduplicationResult } from "../deduplication-result.ts";
import type { NormalizedRecord } from "../normalization-result.ts";
import { DashboardStoreRepository, type DashboardStoreRecordInput } from "../persistence/dashboard-store-repository.ts";
import { WatermarkRepository } from "../persistence/watermark-repository.ts";
import type { RuntimeState } from "../runtime-state.ts";
import {
  StubPipelineStageEngine,
  StubPipelineStageRepository,
  StubPipelineStageResolver,
  StubPipelineStageWriter,
} from "./stub-stage-components.ts";

const EMPTY_RECORD_WARNING = "dashboard-store-empty-record";
const DEFAULT_SCENARIO_TYPE = "UNCLASSIFIED";
const DEFAULT_QUALITY_STATUS = "UNASSESSED";

export class DashboardStoreStageRepository extends StubPipelineStageRepository {
  private readonly dashboardStoreRepository = new DashboardStoreRepository();
  private readonly watermarkRepository = new WatermarkRepository();
  private readonly executionLeaseGuard = new ExecutionLeaseStageGuard();

  constructor() {
    super("dashboard-store");
  }

  createDashboardStoreRepository(): DashboardStoreRepository {
    return this.dashboardStoreRepository;
  }

  createWatermarkRepository(): WatermarkRepository {
    return this.watermarkRepository;
  }

  createExecutionLeaseGuard(): ExecutionLeaseStageGuard {
    return this.executionLeaseGuard;
  }

  async disconnect(): Promise<void> {
    await this.dashboardStoreRepository.disconnect();
    await this.watermarkRepository.disconnect();
    await this.executionLeaseGuard.disconnect();
  }
}

export class DashboardStoreStageResolver extends StubPipelineStageResolver {
  constructor(repository: DashboardStoreStageRepository) {
    super("dashboard-store", repository);
  }

  override resolve(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    if (!isDashboardPipeline(state)) {
      return;
    }

    const normalizationResult = state.normalizationResult;

    if (!normalizationResult) {
      throw new Error("Dashboard Store stage requires normalizationResult from NormalizationStage.");
    }

    if (normalizationResult.statistics.normalizedRecordCount !== normalizationResult.normalizedRecords.length) {
      throw new Error("Dashboard Store stage requires normalizationResult with a consistent normalizedRecordCount.");
    }
  }
}

export class DashboardStoreStageEngine extends StubPipelineStageEngine {
  constructor(repository: DashboardStoreStageRepository) {
    super("dashboard-store", repository);
  }

  override run(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    if (!isDashboardPipeline(state)) {
      return;
    }

    const normalizationResult = state.normalizationResult;
    const deduplicationResult = state.deduplicationResult;

    if (!normalizationResult || !deduplicationResult) {
      throw new Error("Dashboard Store stage requires normalizationResult prepared by NormalizationStage.");
    }

    state.dashboardStoreResult = createDashboardStoreResult(normalizationResult.normalizedRecords, deduplicationResult);
    state.rowsWrittenDashboard = state.dashboardStoreResult.statistics.dashboardRecordCount;
  }
}

export class DashboardStoreStageWriter extends StubPipelineStageWriter {
  constructor(repository: DashboardStoreStageRepository) {
    super("dashboard-store", repository);
  }

  override async write(context: ExecutionContext, state: RuntimeState): Promise<void> {
    if (!isDashboardPipeline(state)) {
      return;
    }

    if (!state.dashboardStoreResult) {
      throw new Error("Dashboard Store stage writer requires dashboardStoreResult produced by DashboardStoreStageEngine.");
    }

    if (
      !state.organizationId ||
      !state.sourceId ||
      !state.datasetId ||
      !state.pipelineId ||
      !state.runId ||
      !state.watermarkColumn ||
      !state.watermarkType
    ) {
      throw new Error("Dashboard Store stage writer requires persisted lifecycle and watermark metadata before Step 7 persistence.");
    }

    state.rowsFailed += state.dashboardStoreResult.statistics.errorCount;

    const repository = this.repository as DashboardStoreStageRepository;
    const dashboardStoreRepository = repository.createDashboardStoreRepository();
    const watermarkRepository = repository.createWatermarkRepository();
    const executionLeaseGuard = repository.createExecutionLeaseGuard();

    try {
      throwIfExecutionAborted(context);
      await executionLeaseGuard.assertActive(state);

      const existingWatermark = await watermarkRepository.getWatermark({
        organizationId: state.organizationId,
        sourceId: state.sourceId,
        datasetId: state.datasetId,
        pipelineId: state.pipelineId,
      });

      state.watermarkBefore = existingWatermark?.lastValue ?? null;

      const dashboardRecords = toDashboardStoreRecordInputs(state);
      const persistedDashboardRecords = await dashboardStoreRepository.upsertBatch(dashboardRecords);

      state.dashboardStoreResult.affectedRows = persistedDashboardRecords.length;
      state.rowsWrittenDashboard = persistedDashboardRecords.length;

      throwIfExecutionAborted(context);
      await executionLeaseGuard.assertActive(state);

      if (!state.executionLease?.ownerId || !state.executionLease.tokenHash) {
        throw new Error("Dashboard Store stage writer requires an active execution lease before watermark persistence.");
      }

      await watermarkRepository.upsertWatermarkWithExecutionLease({
        organizationId: state.organizationId,
        sourceId: state.sourceId,
        datasetId: state.datasetId,
        pipelineId: state.pipelineId,
        watermarkColumn: state.watermarkColumn,
        watermarkType: state.watermarkType,
        lastValue: state.watermarkValue,
        lastSyncedAt: state.watermarkLastSyncedAt,
        updatedByRunId: state.runId,
        expectedExecutionLease: {
          ownerId: state.executionLease.ownerId,
          tokenHash: state.executionLease.tokenHash,
          epoch: state.executionLease.epoch,
        },
      });

      state.watermarkAfter = state.watermarkValue;
      state.watermarkLastSyncedAt = new Date();
    } finally {
      await repository.disconnect();
    }
  }
}

function toDashboardStoreRecordInputs(state: RuntimeState): DashboardStoreRecordInput[] {
  const dashboardRecords = state.dashboardStoreResult?.dashboardRecords;

  if (!dashboardRecords || !state.organizationId || !state.sourceId || !state.datasetId || !state.pipelineId || !state.runId) {
    throw new Error("Dashboard Store stage requires complete runtime lifecycle before dashboard persistence mapping.");
  }

  return dashboardRecords.map((record) => ({
    organizationId: state.organizationId!,
    sourceId: state.sourceId!,
    datasetId: state.datasetId!,
    pipelineId: state.pipelineId!,
    latestRunId: state.runId!,
    dedupeKey: record.dedupeKey,
    scenarioType: record.scenarioType,
    componentId: record.componentId,
    componentName: record.componentName,
    componentCode: record.componentCode,
    metricValue: record.metricValue,
    unit: record.unit,
    currency: record.currency,
    sourceDate: record.sourceDate,
    market: record.market,
    country: record.country,
    qualityStatus: record.qualityStatus,
    duplicateStatus: record.duplicateStatus,
    rawRecordCount: record.rawRecordCount,
    duplicateCount: record.duplicateCount,
    lineageJson: record.lineageJson === null ? Prisma.JsonNull : (record.lineageJson as Prisma.InputJsonValue),
    metadataJson: record.metadataJson === null ? Prisma.JsonNull : (record.metadataJson as Prisma.InputJsonValue),
    lastSyncedAt: record.lastSyncedAt,
  }));
}

export class DashboardStoreStage extends ComposedPipelineStage {
  constructor() {
    const repository = new DashboardStoreStageRepository();

    super("dashboard-store", {
      resolver: new DashboardStoreStageResolver(repository),
      engine: new DashboardStoreStageEngine(repository),
      writer: new DashboardStoreStageWriter(repository),
    });
  }
}

function isDashboardPipeline(state: RuntimeState): boolean {
  return state.resolvedConfiguration?.pipeline.code === "dashboard";
}

function createDashboardStoreResult(
  normalizedRecords: NormalizedRecord[],
  deduplicationResult: DeduplicationResult,
): DashboardStoreResult {
  const warnings: DashboardStoreWarning[] = [];
  const errors: DashboardStoreError[] = [];
  const duplicateCounts = countDuplicateRecordsByKey(deduplicationResult);
  const preparedAt = new Date();

  const preparedRecords: DashboardStoreRecord[] = normalizedRecords.map((record) =>
    prepareDashboardStoreRecord(record, duplicateCounts, preparedAt, warnings),
  );

  return {
    preparedRecords,
    preparedRecordCount: preparedRecords.length,
    dashboardRecords: preparedRecords,
    affectedRows: 0,
    statistics: {
      normalizedRecordCount: normalizedRecords.length,
      preparedRecordCount: preparedRecords.length,
      dashboardRecordCount: preparedRecords.length,
      warningCount: warnings.length,
      errorCount: errors.length,
    },
    warnings,
    errors,
  };
}

function prepareDashboardStoreRecord(
  record: NormalizedRecord,
  duplicateCounts: Map<string, number>,
  preparedAt: Date,
  warnings: DashboardStoreWarning[],
): DashboardStoreRecord {
  const orderedFields = Object.fromEntries(
    Object.entries(record.fields).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );
  const duplicateCount = duplicateCounts.get(record.duplicateKey) ?? 0;
  const componentName = readStringField(orderedFields, ["componentName", "component", "sourceKind"]) ?? `record-${record.position}`;
  const semanticRecord: DashboardStoreRecord = {
    position: record.position,
    dedupeKey: record.duplicateKey,
    scenarioType: readStringField(orderedFields, ["scenarioType"]) ?? DEFAULT_SCENARIO_TYPE,
    componentId: readStringField(orderedFields, ["componentId", "componentCode"]) ?? record.duplicateKey,
    componentName,
    componentCode: readStringField(orderedFields, ["componentCode"]),
    metricValue: readScalarField(orderedFields, ["metricValue", "value", "sampleNumber"]),
    unit: readStringField(orderedFields, ["unit"]),
    currency: readStringField(orderedFields, ["currency"]),
    sourceDate: readDateField(orderedFields, ["sourceDate"]),
    market: readStringField(orderedFields, ["market"]),
    country: readStringField(orderedFields, ["country"]),
    qualityStatus: readStringField(orderedFields, ["qualityStatus"]) ?? DEFAULT_QUALITY_STATUS,
    duplicateStatus: record.duplicateStatus,
    rawRecordCount: duplicateCount + 1,
    duplicateCount,
    lineageJson: {
      normalizedPosition: record.position,
      duplicateKey: record.duplicateKey,
      duplicateStatus: record.duplicateStatus,
    },
    metadataJson: {
      normalizedFieldNames: Object.keys(orderedFields),
      semanticCarryVersion: 1,
    },
    lastSyncedAt: preparedAt,
    fields: orderedFields,
  };

  if (Object.keys(orderedFields).length === 0) {
    warnings.push({
      code: EMPTY_RECORD_WARNING,
      message: "Dashboard Store preparation produced an empty record.",
      position: record.position,
    });
  }

  return semanticRecord;
}

function countDuplicateRecordsByKey(deduplicationResult: DeduplicationResult): Map<string, number> {
  const duplicateCounts = new Map<string, number>();

  for (const duplicateRecord of deduplicationResult.duplicateRecords) {
    duplicateCounts.set(duplicateRecord.duplicateKey, (duplicateCounts.get(duplicateRecord.duplicateKey) ?? 0) + 1);
  }

  return duplicateCounts;
}

function readScalarField(
  fields: Record<string, string | number | boolean | null>,
  candidateNames: string[],
): string | number | null {
  for (const candidateName of candidateNames) {
    const value = fields[candidateName];

    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
  }

  return null;
}

function readStringField(
  fields: Record<string, string | number | boolean | null>,
  candidateNames: string[],
): string | null {
  for (const candidateName of candidateNames) {
    const value = fields[candidateName];

    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

function readDateField(
  fields: Record<string, string | number | boolean | null>,
  candidateNames: string[],
): Date | null {
  for (const candidateName of candidateNames) {
    const value = fields[candidateName];

    if (typeof value !== "string" || value.length === 0) {
      continue;
    }

    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}