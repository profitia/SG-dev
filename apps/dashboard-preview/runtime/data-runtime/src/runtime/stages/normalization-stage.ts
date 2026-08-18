import { ComposedPipelineStage } from "./composed-stage.ts";
import type { ExecutionContext } from "../execution-context.ts";
import type { DeduplicationAcceptedRecord } from "../deduplication-result.ts";
import type {
  NormalizationIssue,
  NormalizationResult,
  NormalizedRecord,
  NormalizedValue,
} from "../normalization-result.ts";
import type { RuntimeState } from "../runtime-state.ts";
import {
  StubPipelineStageEngine,
  StubPipelineStageRepository,
  StubPipelineStageResolver,
  StubPipelineStageWriter,
} from "./stub-stage-components.ts";

const FIELD_NAME_COLLISION_WARNING = "normalized-field-name-collision";
const UNSUPPORTED_VALUE_WARNING = "unsupported-normalization-value";

export class NormalizationStageRepository extends StubPipelineStageRepository {
  constructor() {
    super("normalization");
  }
}

export class NormalizationStageResolver extends StubPipelineStageResolver {
  constructor(repository: NormalizationStageRepository) {
    super("normalization", repository);
  }

  override resolve(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    const deduplicationResult = state.deduplicationResult;

    if (!deduplicationResult) {
      throw new Error("Normalization stage requires deduplicationResult from DeduplicationStage.");
    }

    if (deduplicationResult.statistics.acceptedRecordCount !== deduplicationResult.acceptedRecords.length) {
      throw new Error("Normalization stage requires deduplicationResult with a consistent acceptedRecordCount.");
    }
  }
}

export class NormalizationStageEngine extends StubPipelineStageEngine {
  constructor(repository: NormalizationStageRepository) {
    super("normalization", repository);
  }

  override run(_context: ExecutionContext, state: RuntimeState): void {
    void this.repository;

    const deduplicationResult = state.deduplicationResult;

    if (!deduplicationResult) {
      throw new Error("Normalization stage requires deduplicationResult prepared by DeduplicationStage.");
    }

    state.normalizationResult = createNormalizationResult(deduplicationResult.acceptedRecords);
  }
}

export class NormalizationStageWriter extends StubPipelineStageWriter {
  constructor(repository: NormalizationStageRepository) {
    super("normalization", repository);
  }

  override write(_context: ExecutionContext, state: RuntimeState): void {
    if (!state.normalizationResult) {
      throw new Error("Normalization stage writer requires normalizationResult produced by NormalizationStageEngine.");
    }

    state.rowsFailed = state.normalizationResult.statistics.errorCount;
  }
}

export class NormalizationStage extends ComposedPipelineStage {
  constructor() {
    const repository = new NormalizationStageRepository();

    super("normalization", {
      resolver: new NormalizationStageResolver(repository),
      engine: new NormalizationStageEngine(repository),
      writer: new NormalizationStageWriter(repository),
    });
  }
}

function createNormalizationResult(acceptedRecords: DeduplicationAcceptedRecord[]): NormalizationResult {
  const warnings: NormalizationIssue[] = [];
  const errors: NormalizationIssue[] = [];

  const normalizedRecords: NormalizedRecord[] = acceptedRecords.map((record) =>
    normalizeRecord(record, warnings),
  );

  return {
    normalizedRecords,
    warnings,
    errors,
    statistics: {
      acceptedRecordCount: acceptedRecords.length,
      normalizedRecordCount: normalizedRecords.length,
      warningCount: warnings.length,
      errorCount: errors.length,
    },
  };
}

function normalizeRecord(
  record: DeduplicationAcceptedRecord,
  warnings: NormalizationIssue[],
): NormalizedRecord {
  const normalizedEntries = Object.entries(record.fields)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .flatMap(([fieldName, rawValue]) => {
      const normalizedField = normalizeFieldName(fieldName);

      if (rawValue === undefined) {
        return [];
      }

      const { value, warning } = normalizeValue(rawValue, record.position, normalizedField);

      if (warning) {
        warnings.push(warning);
      }

      return [[normalizedField, value] as const];
    });

  const normalizedFields: Record<string, NormalizedValue> = {};

  for (const [fieldName, value] of normalizedEntries) {
    if (fieldName in normalizedFields) {
      warnings.push({
        code: FIELD_NAME_COLLISION_WARNING,
        message: `Normalization collapsed multiple source fields into "${fieldName}".`,
        position: record.position,
        field: fieldName,
      });
      continue;
    }

    normalizedFields[fieldName] = value;
  }

  const orderedFields = Object.fromEntries(
    Object.entries(normalizedFields).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  ) as Record<string, NormalizedValue>;

  return {
    position: record.position,
    duplicateKey: record.duplicateKey,
    duplicateStatus: record.duplicateStatus,
    fields: orderedFields,
  };
}

function normalizeFieldName(fieldName: string): string {
  const preparedFieldName = fieldName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();

  if (!preparedFieldName) {
    return fieldName;
  }

  const parts = preparedFieldName
    .split(/\s+/)
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 0);

  const [firstPart, ...restParts] = parts;

  if (!firstPart) {
    return fieldName;
  }

  return firstPart + restParts.map(capitalize).join("");
}

function normalizeValue(
  value: unknown,
  position: number,
  fieldName: string,
): { value: NormalizedValue; warning: NormalizationIssue | null } {
  if (value === null) {
    return { value: null, warning: null };
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return { value, warning: null };
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return { value, warning: null };
    }

    return {
      value: String(value),
      warning: {
        code: UNSUPPORTED_VALUE_WARNING,
        message: `Normalization converted a non-finite number in field "${fieldName}" to string form.`,
        position,
        field: fieldName,
      },
    };
  }

  return {
    value: String(value),
    warning: {
      code: UNSUPPORTED_VALUE_WARNING,
      message: `Normalization converted an unsupported value in field "${fieldName}" to string form.`,
      position,
      field: fieldName,
    },
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}