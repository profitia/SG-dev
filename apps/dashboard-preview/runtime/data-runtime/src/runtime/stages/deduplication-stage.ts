import { ComposedPipelineStage } from "./composed-stage.ts";
import type { ExecutionContext } from "../execution-context.ts";
import type {
  DeduplicationAcceptedRecord,
  DeduplicationDuplicateRecord,
  DeduplicationResult,
} from "../deduplication-result.ts";
import type { MappedPayloadRecord } from "../mapped-payload.ts";
import type { RuntimeState } from "../runtime-state.ts";
import {
  StubPipelineStageEngine,
  StubPipelineStageRepository,
  StubPipelineStageResolver,
  StubPipelineStageWriter,
} from "./stub-stage-components.ts";

const DUPLICATE_REASON = "duplicate-record-content";
const DUPLICATE_STATUS_UNIQUE = "UNIQUE" as const;
const DUPLICATE_STATUS_DUPLICATE = "DUPLICATE" as const;

export class DeduplicationStageRepository extends StubPipelineStageRepository {
  constructor() {
    super("deduplication");
  }
}

export class DeduplicationStageResolver extends StubPipelineStageResolver {
  constructor(repository: DeduplicationStageRepository) {
    super("deduplication", repository);
  }

  override resolve(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    const mappedPayload = state.mappedPayload;

    if (!mappedPayload) {
      throw new Error("Deduplication stage requires mappedPayload from MappingStage.");
    }

    if (mappedPayload.recordCount !== mappedPayload.records.length) {
      throw new Error("Deduplication stage requires mappedPayload with a consistent recordCount.");
    }
  }
}

export class DeduplicationStageEngine extends StubPipelineStageEngine {
  constructor(repository: DeduplicationStageRepository) {
    super("deduplication", repository);
  }

  override run(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    const mappedPayload = state.mappedPayload;

    if (!mappedPayload) {
      throw new Error("Deduplication stage requires mappedPayload prepared by MappingStage.");
    }

    state.deduplicationResult = createDeduplicationResult(mappedPayload.sourceRecordCount, mappedPayload.records);
    state.rowsDeduplicated = state.deduplicationResult.statistics.duplicateRecordCount;
  }
}

export class DeduplicationStageWriter extends StubPipelineStageWriter {
  constructor(repository: DeduplicationStageRepository) {
    super("deduplication", repository);
  }

  override write(_context: ExecutionContext, state: RuntimeState): void {
    if (!state.deduplicationResult) {
      throw new Error("Deduplication stage writer requires deduplicationResult produced by DeduplicationStageEngine.");
    }
  }
}

export class DeduplicationStage extends ComposedPipelineStage {
  constructor() {
    const repository = new DeduplicationStageRepository();

    super("deduplication", {
      resolver: new DeduplicationStageResolver(repository),
      engine: new DeduplicationStageEngine(repository),
      writer: new DeduplicationStageWriter(repository),
    });
  }
}

function createDeduplicationResult(
  sourceRecordCount: number,
  records: MappedPayloadRecord[],
): DeduplicationResult {
  const acceptedRecords: DeduplicationAcceptedRecord[] = [];
  const duplicateRecords: DeduplicationDuplicateRecord[] = [];
  const duplicateKeyCounts = countDuplicateKeys(records);
  const seenDuplicateKeys = new Set<string>();

  for (const record of records) {
    const duplicateKey = createDuplicateKey(record);
    const duplicateStatus = duplicateKeyCounts.get(duplicateKey)! > 1 ? DUPLICATE_STATUS_DUPLICATE : DUPLICATE_STATUS_UNIQUE;

    if (!seenDuplicateKeys.has(duplicateKey)) {
      seenDuplicateKeys.add(duplicateKey);
      acceptedRecords.push({
        position: record.position,
        duplicateKey,
        duplicateStatus,
        fields: { ...record.fields },
      });
      continue;
    }

    duplicateRecords.push({
      position: record.position,
      fields: { ...record.fields },
      duplicateKey,
      duplicateStatus: DUPLICATE_STATUS_DUPLICATE,
      duplicateReason: DUPLICATE_REASON,
    });
  }

  const duplicateKeys = Array.from(new Set(duplicateRecords.map((record) => record.duplicateKey).filter(isPresent)));
  const duplicateReasons = Array.from(new Set(duplicateRecords.map((record) => record.duplicateReason).filter(isPresent)));

  return {
    acceptedRecords,
    duplicateRecords,
    duplicateKeys,
    duplicateReasons,
    statistics: {
      sourceRecordCount,
      acceptedRecordCount: acceptedRecords.length,
      duplicateRecordCount: duplicateRecords.length,
      duplicateKeyCount: duplicateKeys.length,
      duplicateReasonCount: duplicateReasons.length,
    },
  };
}

function countDuplicateKeys(records: MappedPayloadRecord[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const record of records) {
    const duplicateKey = createDuplicateKey(record);
    counts.set(duplicateKey, (counts.get(duplicateKey) ?? 0) + 1);
  }

  return counts;
}

function createDuplicateKey(record: MappedPayloadRecord): string {
  const orderedEntries = Object.entries(record.fields).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return JSON.stringify(orderedEntries);
}

function isPresent(value: string | null): value is string {
  return value !== null;
}