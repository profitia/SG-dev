import { Prisma } from "@prisma/client";

import { ComposedPipelineStage } from "./composed-stage.ts";
import { throwIfExecutionAborted, type ExecutionContext } from "../execution-context.ts";
import { ExecutionLeaseStageGuard } from "../execution-lease-stage-guard.ts";
import { createForecastAccuracyStoreResult } from "../forecast-accuracy-records.ts";
import { ForecastAccuracyStoreRepository, type ForecastAccuracyStoreRecordInput } from "../persistence/forecast-accuracy-store-repository.ts";
import type { RuntimeState } from "../runtime-state.ts";
import {
  StubPipelineStageEngine,
  StubPipelineStageRepository,
  StubPipelineStageResolver,
  StubPipelineStageWriter,
} from "./stub-stage-components.ts";

export class ForecastAccuracyStoreStageRepository extends StubPipelineStageRepository {
  private readonly forecastAccuracyStoreRepository = new ForecastAccuracyStoreRepository();
  private readonly executionLeaseGuard = new ExecutionLeaseStageGuard();

  constructor() {
    super("forecast-accuracy-store");
  }

  createForecastAccuracyStoreRepository(): ForecastAccuracyStoreRepository {
    return this.forecastAccuracyStoreRepository;
  }

  createExecutionLeaseGuard(): ExecutionLeaseStageGuard {
    return this.executionLeaseGuard;
  }

  async disconnect(): Promise<void> {
    await this.forecastAccuracyStoreRepository.disconnect();
    await this.executionLeaseGuard.disconnect();
  }
}

export class ForecastAccuracyStoreStageResolver extends StubPipelineStageResolver {
  constructor(repository: ForecastAccuracyStoreStageRepository) {
    super("forecast-accuracy-store", repository);
  }

  override resolve(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    if (!isForecastAccuracyPipeline(state)) {
      return;
    }

    const normalizationResult = state.normalizationResult;

    if (!normalizationResult) {
      throw new Error("Forecast Accuracy Store stage requires normalizationResult from NormalizationStage.");
    }

    if (normalizationResult.statistics.normalizedRecordCount !== normalizationResult.normalizedRecords.length) {
      throw new Error("Forecast Accuracy Store stage requires normalizationResult with a consistent normalizedRecordCount.");
    }
  }
}

export class ForecastAccuracyStoreStageEngine extends StubPipelineStageEngine {
  constructor(repository: ForecastAccuracyStoreStageRepository) {
    super("forecast-accuracy-store", repository);
  }

  override run(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    if (!isForecastAccuracyPipeline(state)) {
      return;
    }

    const normalizationResult = state.normalizationResult;
    const deduplicationResult = state.deduplicationResult;

    if (!normalizationResult || !deduplicationResult) {
      throw new Error("Forecast Accuracy Store stage requires normalizationResult prepared by NormalizationStage.");
    }

    state.forecastAccuracyStoreResult = createForecastAccuracyStoreResult(
      normalizationResult.normalizedRecords,
      deduplicationResult,
    );
    state.rowsWrittenDashboard = state.forecastAccuracyStoreResult.statistics.forecastAccuracyRecordCount;
  }
}

export class ForecastAccuracyStoreStageWriter extends StubPipelineStageWriter {
  constructor(repository: ForecastAccuracyStoreStageRepository) {
    super("forecast-accuracy-store", repository);
  }

  override async write(context: ExecutionContext, state: RuntimeState): Promise<void> {
    if (!isForecastAccuracyPipeline(state)) {
      return;
    }

    if (!state.forecastAccuracyStoreResult) {
      throw new Error("Forecast Accuracy Store stage writer requires forecastAccuracyStoreResult produced by ForecastAccuracyStoreStageEngine.");
    }

    if (!state.organizationId || !state.sourceId || !state.datasetId || !state.pipelineId || !state.runId) {
      throw new Error("Forecast Accuracy Store stage writer requires persisted lifecycle before forecast accuracy persistence.");
    }

    state.rowsFailed += state.forecastAccuracyStoreResult.statistics.errorCount;

    const repository = this.repository as ForecastAccuracyStoreStageRepository;
    const forecastAccuracyStoreRepository = repository.createForecastAccuracyStoreRepository();
    const executionLeaseGuard = repository.createExecutionLeaseGuard();

    try {
      throwIfExecutionAborted(context);
      await executionLeaseGuard.assertActive(state);

      const forecastAccuracyRecords = toForecastAccuracyStoreRecordInputs(state);
      const persistedForecastAccuracyRecords = await forecastAccuracyStoreRepository.upsertBatch(forecastAccuracyRecords);

      state.forecastAccuracyStoreResult.affectedRows = persistedForecastAccuracyRecords.length;
      state.rowsWrittenDashboard = persistedForecastAccuracyRecords.length;
      throwIfExecutionAborted(context);
      await executionLeaseGuard.assertActive(state);
    } finally {
      await repository.disconnect();
    }
  }
}

function toForecastAccuracyStoreRecordInputs(state: RuntimeState): ForecastAccuracyStoreRecordInput[] {
  const forecastAccuracyRecords = state.forecastAccuracyStoreResult?.forecastAccuracyRecords;

  if (!forecastAccuracyRecords || !state.organizationId || !state.sourceId || !state.datasetId || !state.pipelineId || !state.runId) {
    throw new Error("Forecast Accuracy Store stage requires complete runtime lifecycle before persistence mapping.");
  }

  return forecastAccuracyRecords.map((record) => ({
    organizationId: state.organizationId!,
    sourceId: state.sourceId!,
    datasetId: state.datasetId!,
    pipelineId: state.pipelineId!,
    latestRunId: state.runId!,
    dedupeKey: record.dedupeKey,
    benchmarkCode: record.benchmarkCode,
    sourceTableName: record.sourceTableName,
    orgTableName: record.orgTableName,
    targetDate: record.targetDate,
    horizonMonths: record.horizonMonths,
    actualValue: record.actualValue,
    forecastValue: record.forecastValue,
    differenceValue: record.differenceValue,
    errorType: record.errorType,
    duplicateStatus: record.duplicateStatus,
    rawRecordCount: record.rawRecordCount,
    duplicateCount: record.duplicateCount,
    lineageJson: record.lineageJson as Prisma.InputJsonValue,
    metadataJson: record.metadataJson as Prisma.InputJsonValue,
    lastSyncedAt: record.lastSyncedAt,
  }));
}

export class ForecastAccuracyStoreStage extends ComposedPipelineStage {
  constructor() {
    const repository = new ForecastAccuracyStoreStageRepository();

    super("forecast-accuracy-store", {
      resolver: new ForecastAccuracyStoreStageResolver(repository),
      engine: new ForecastAccuracyStoreStageEngine(repository),
      writer: new ForecastAccuracyStoreStageWriter(repository),
    });
  }
}

function isForecastAccuracyPipeline(state: RuntimeState): boolean {
  return state.resolvedConfiguration?.pipeline.code === "forecast-accuracy";
}