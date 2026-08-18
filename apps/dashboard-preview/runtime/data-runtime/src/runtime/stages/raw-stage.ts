import { createHash } from "node:crypto";

import { ComposedPipelineStage } from "./composed-stage.ts";
import { throwIfExecutionAborted, type ExecutionContext } from "../execution-context.ts";
import type { ConnectorPayloadRecord } from "../connectors/connector-contracts.ts";
import { ExecutionLeaseStageGuard } from "../execution-lease-stage-guard.ts";
import { RawRepository } from "../persistence/raw-repository.ts";
import type { RawPayload, RawPayloadRecord } from "../raw-payload.ts";
import type { RuntimeState } from "../runtime-state.ts";
import {
  StubPipelineStageEngine,
  StubPipelineStageRepository,
  StubPipelineStageResolver,
  StubPipelineStageWriter,
} from "./stub-stage-components.ts";

const FALLBACK_WATERMARK_COLUMN = "sourceUpdatedAt";

export class RawStageRepository extends StubPipelineStageRepository {
  private readonly rawRepository = new RawRepository();
  private readonly executionLeaseGuard = new ExecutionLeaseStageGuard();

  constructor() {
    super("raw");
  }

  createRawRepository(): RawRepository {
    return this.rawRepository;
  }

  createExecutionLeaseGuard(): ExecutionLeaseStageGuard {
    return this.executionLeaseGuard;
  }

  async disconnect(): Promise<void> {
    await this.rawRepository.disconnect();
    await this.executionLeaseGuard.disconnect();
  }
}

export class RawStageResolver extends StubPipelineStageResolver {
  constructor(repository: RawStageRepository) {
    super("raw", repository);
  }

  override resolve(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    const connectorPayload = state.connectorPayload;

    if (!connectorPayload) {
      throw new Error("RAW stage requires connectorPayload from ConnectorStage.");
    }

    if (connectorPayload.recordCount !== connectorPayload.records.length) {
      throw new Error("RAW stage requires connectorPayload with a consistent recordCount.");
    }
  }
}

export class RawStageEngine extends StubPipelineStageEngine {
  constructor(repository: RawStageRepository) {
    super("raw", repository);
  }

  override run(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    const connectorPayload = state.connectorPayload;

    if (!connectorPayload) {
      throw new Error("RAW stage requires connectorPayload prepared by ConnectorStage.");
    }

    state.rawPayload = createRawPayload(connectorPayload.query, connectorPayload.records);
    state.rowsRead = state.rawPayload.sourceRecordCount;
    state.watermarkValue = readWatermarkValue(state);
  }
}

export class RawStageWriter extends StubPipelineStageWriter {
  constructor(repository: RawStageRepository) {
    super("raw", repository);
  }

  override async write(context: ExecutionContext, state: RuntimeState): Promise<void> {
    if (!state.rawPayload) {
      throw new Error("RAW stage writer requires rawPayload produced by RawStageEngine.");
    }

    const connectorInput = state.connectorInput;

    if (
      !state.organizationId ||
      !state.runId ||
      !state.runDatasetId ||
      !state.sourceId ||
      !state.datasetId ||
      !state.pipelineId ||
      !connectorInput
    ) {
      throw new Error("RAW stage writer requires persisted lifecycle and connector inputs before RawRepository activation.");
    }

    const ingestedAt = state.rawIngestedAt ?? new Date();
    state.rawIngestedAt = ingestedAt;

    const repository = this.repository as RawStageRepository;
    const rawRepository = repository.createRawRepository();
    const executionLeaseGuard = repository.createExecutionLeaseGuard();

    try {
      throwIfExecutionAborted(context);
      await executionLeaseGuard.assertActive(state);

      const result = await rawRepository.insertRawBatch(
        state.rawPayload.records.map((record) => ({
          organizationId: state.organizationId!,
          runId: state.runId!,
          runDatasetId: state.runDatasetId!,
          sourceId: state.sourceId!,
          datasetId: state.datasetId!,
          pipelineId: state.pipelineId!,
          connectorKey: connectorInput.connector.code,
          sourceDatabase: connectorInput.dataset.sourceDatabase,
          sourceSchema: connectorInput.dataset.sourceSchema,
          sourceObject: connectorInput.dataset.sourceObject,
          sourceRowId: record.sourceRowId,
          sourceUpdatedAt: parseSourceUpdatedAt(record.sourceUpdatedAt, record.position),
          payloadJson: record.values,
          payloadHash: record.payloadHash,
          ingestedAt,
          isReplayed: Boolean(state.replayOfRunId),
          replayOfRunId: state.replayOfRunId,
        })),
      );

      state.rowsWrittenRaw = result.count;
      throwIfExecutionAborted(context);
      await executionLeaseGuard.assertActive(state);
    } finally {
      await repository.disconnect();
    }
  }
}

export class RawStage extends ComposedPipelineStage {
  constructor() {
    const repository = new RawStageRepository();

    super("raw", {
      resolver: new RawStageResolver(repository),
      engine: new RawStageEngine(repository),
      writer: new RawStageWriter(repository),
    });
  }
}

function createRawPayload(sourceQuery: string | null, records: ConnectorPayloadRecord[]): RawPayload {
  const rawRecords: RawPayloadRecord[] = records.map((record, index) => ({
    position: index,
    sourceRowId: record.sourceRowId,
    sourceUpdatedAt: record.sourceUpdatedAt,
    payloadHash: createPayloadHash(record),
    values: { ...record.values },
  }));

  return {
    sourceQuery,
    sourceRecordCount: records.length,
    records: rawRecords,
    recordCount: rawRecords.length,
  };
}

function createPayloadHash(record: ConnectorPayloadRecord): string {
  const sortedValues = Object.fromEntries(
    Object.entries(record.values).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );

  const payload = JSON.stringify({
    sourceRowId: record.sourceRowId,
    sourceUpdatedAt: record.sourceUpdatedAt,
    values: sortedValues,
  });

  return createHash("sha256").update(payload).digest("hex");
}

function parseSourceUpdatedAt(sourceUpdatedAt: string | null, position: number): Date | null {
  if (!sourceUpdatedAt) {
    return null;
  }

  const parsed = new Date(sourceUpdatedAt);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`RAW stage writer received invalid sourceUpdatedAt at position ${position}.`);
  }

  return parsed;
}

function readWatermarkValue(state: RuntimeState): string | null {
  const watermarkColumn = state.watermarkColumn;
  const rawPayload = state.rawPayload;

  if (!watermarkColumn || !rawPayload || rawPayload.records.length === 0) {
    return null;
  }

  const lastRecord = rawPayload.records[rawPayload.records.length - 1];

  if (watermarkColumn === FALLBACK_WATERMARK_COLUMN) {
    return lastRecord?.sourceUpdatedAt ?? null;
  }

  const rawValue = lastRecord?.values[watermarkColumn];

  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  return String(rawValue);
}