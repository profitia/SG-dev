import { createHash } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  DrConnectorKind,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import {
  resolveDataRuntimeEnvironment,
  type DataRuntimeEnvironment,
  type DataRuntimeEnvironmentConfig,
  type RuntimeEnvShape,
} from "./env.ts";
import {
  IN_MEMORY_RUNTIME_REGISTRY,
  type ResolvedDatasetConfig,
  type ResolvedPipelineConfig,
  type ResolvedSourceConfig,
} from "./runtime-configuration.ts";
import {
  buildNeonApiUrl,
  describeNeonProviderHttpFailure,
  describeNeonProviderMalformedResponse,
  describeNeonProviderNetworkFailure,
  type NeonProviderRequestStage,
  NeonProviderConfigurationError,
  normalizeNeonApiBaseUrl,
  OFFICIAL_NEON_API_BASE_URL,
} from "./neon-provider-client.ts";

export const PRODUCTION_REGISTRY_BOOTSTRAP_CONFIRMATION_ENV = "ALLOW_PRODUCTION_REGISTRY_BOOTSTRAP";
export const PRODUCTION_EXPECTED_NEON_PROJECT_ID = "rough-field-86336647";
export const PRODUCTION_EXPECTED_NEON_BRANCH_ID = "br-crimson-moon-asiphd7t";
export const PRODUCTION_EXPECTED_DATABASE_NAME = "neondb";
export const REGISTRY_BOOTSTRAP_DEFINITION_PATH = "runtime/data-runtime/src/runtime/runtime-configuration.ts";
export const REQUIRED_RUNTIME_SCHEMA_TABLES = [
  "dr_connectors",
  "dr_sources",
  "dr_datasets",
  "dr_pipelines",
  "dr_runs",
  "dr_run_datasets",
  "dr_watermarks",
  "dr_raw_records",
  "dr_dashboard_index_records",
  "dr_forecast_accuracy_records",
] as const;
export const REQUIRED_REGISTRY_TABLES = ["dr_connectors", "dr_sources", "dr_datasets", "dr_pipelines"] as const;
export const REQUIRED_LIFECYCLE_TABLES = ["dr_runs", "dr_run_datasets", "dr_watermarks", "dr_raw_records"] as const;
export const REQUIRED_READ_MODEL_TABLES = ["dr_dashboard_index_records", "dr_forecast_accuracy_records"] as const;

export type RegistryBootstrapMode = "dry-run" | "apply";

export interface RegistryBootstrapEnvShape extends RuntimeEnvShape {
  ALLOW_PRODUCTION_REGISTRY_BOOTSTRAP?: string;
  DATA_RUNTIME_EXPECTED_PROJECT_ID?: string;
  DATA_RUNTIME_EXPECTED_BRANCH_ID?: string;
  DATA_RUNTIME_NEON_API_KEY?: string;
  DATA_RUNTIME_NEON_API_BASE_URL?: string;
  NEON_API_KEY?: string;
}

export interface RegistryBootstrapEnvironmentConfig extends DataRuntimeEnvironmentConfig {
  allowProductionRegistryBootstrap: boolean;
  expectedProjectId: string | null;
  expectedBranchId: string | null;
  neonApiKey: string | null;
  neonApiBaseUrl: string;
}

export interface CanonicalConnectorDefinition {
  code: string;
  name: string;
  kind: DrConnectorKind;
  configJson: Prisma.JsonValue | null;
  isActive: boolean;
}

export interface CanonicalSourceDefinition {
  code: string;
  name: string;
  connectorCode: string;
  configJson: Prisma.JsonValue;
  datasetCodes: string[];
  pipelineCodes: string[];
  isActive: boolean;
}

export interface CanonicalDatasetDefinition {
  code: string;
  name: string;
  sourceCode: string;
  datasetType: ResolvedDatasetConfig["datasetType"];
  sourceDatabase: string;
  sourceSchema: string;
  sourceObject: string;
  watermarkColumn: string | null;
  watermarkType: ResolvedDatasetConfig["watermarkType"];
  fetchConfigJson: Prisma.JsonValue | null;
  pipelineCodes: string[];
  isActive: boolean;
}

export interface CanonicalPipelineDefinition {
  code: string;
  name: string;
  sourceCode: string;
  datasetCode: string;
  targetStore: ResolvedPipelineConfig["targetStore"];
  configJson: Prisma.JsonValue;
  configFingerprint: string;
  isActive: boolean;
}

export interface CanonicalRegistryDefinitions {
  connector: CanonicalConnectorDefinition;
  source: CanonicalSourceDefinition;
  datasets: CanonicalDatasetDefinition[];
  pipelines: CanonicalPipelineDefinition[];
}

export interface RegistryDatabaseMetadata {
  databaseName: string | null;
  schemaName: string | null;
  tableNames: string[];
  endpointHost: string | null;
  projectId: string | null;
  branchId: string | null;
}

export interface RegistryConnectorState extends CanonicalConnectorDefinition {}

export interface RegistrySourceState extends CanonicalSourceDefinition {}

export interface RegistryDatasetState extends CanonicalDatasetDefinition {}

export interface RegistryPipelineState extends CanonicalPipelineDefinition {}

export interface RegistrySnapshot {
  connector: RegistryConnectorState | null;
  source: RegistrySourceState | null;
  datasets: RegistryDatasetState[];
  pipelines: RegistryPipelineState[];
}

export type RegistryBootstrapConflictCode =
  | "DUPLICATE_CANONICAL_KEY"
  | "DUPLICATE_EXISTING_KEY"
  | "IMMUTABLE_IDENTITY_MISMATCH"
  | "PARENT_RELATIONSHIP_MISMATCH"
  | "DATASET_RELATIONSHIP_MISMATCH"
  | "TARGET_STORE_MISMATCH"
  | "AMBIGUOUS_EXISTING_STATE"
  | "CONFLICT_EVALUATION_INCOMPLETE";

export interface RegistryBootstrapConflict {
  entityType: "connector" | "source" | "dataset" | "pipeline";
  key: string;
  code: RegistryBootstrapConflictCode;
  message: string;
  details: Record<string, unknown>;
}

export interface RegistryBootstrapPlanEntry {
  entityType: "connector" | "source" | "dataset" | "pipeline";
  key: string;
  action: "create" | "update" | "unchanged" | "conflict";
  conflictCode?: RegistryBootstrapConflictCode;
  details?: Record<string, unknown>;
}

export interface RegistryBootstrapPlan {
  entries: RegistryBootstrapPlanEntry[];
  createCount: number;
  updateCount: number;
  unchangedCount: number;
  conflictCount: number;
  conflicts: RegistryBootstrapConflict[];
  evaluationComplete: boolean;
}

export interface SchemaPreflightResult {
  ready: boolean;
  missingTables: string[];
  requiredTables: string[];
  registryTables: string[];
  lifecycleTables: string[];
  readModelTables: string[];
}

export interface RegistryBootstrapTargetIdentity {
  databaseName: string | null;
  schemaName: string | null;
  endpointHost: string | null;
  endpointId: string | null;
  projectId: string | null;
  branchId: string | null;
  expectedDatabaseName: string | null;
  expectedProjectId: string | null;
  expectedBranchId: string | null;
  databaseVerified: boolean;
  projectVerified: boolean;
  branchVerified: boolean;
  verificationSource: "database-only" | "neon-api";
}

export interface RegistryBootstrapTargetIdentityVerificationContext {
  environment: RegistryBootstrapEnvironmentConfig;
  metadata: RegistryDatabaseMetadata;
}

export interface RegistryBootstrapVerifiedIdentity {
  databaseName: string | null;
  schemaName: string | null;
  endpointHost: string | null;
  endpointId: string | null;
  projectId: string;
  branchId: string;
}

export interface RegistryBootstrapTargetIdentityVerifier {
  verifyTargetIdentity(
    context: RegistryBootstrapTargetIdentityVerificationContext,
  ): Promise<RegistryBootstrapVerifiedIdentity>;
}

export interface RegistryBootstrapSummary {
  environment: DataRuntimeEnvironment;
  mode: RegistryBootstrapMode;
  database: RegistryBootstrapTargetIdentity;
  schemaStatus: SchemaPreflightResult;
  registryDefinitionsDiscovered: {
    path: string;
    format: "tracked-typescript";
    connectorCount: number;
    sourceCount: number;
    datasetCount: number;
    pipelineCount: number;
    total: number;
  };
  createCount: number;
  updateCount: number;
  unchangedCount: number;
  conflictCount: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsDeleted: number;
  transactionCommitted: boolean;
  durationMs: number;
  finalStatus: string;
}

export interface RegistryBootstrapInput {
  environment: RegistryBootstrapEnvironmentConfig;
  mode: RegistryBootstrapMode;
}

export interface ExecuteRegistryBootstrapOptions {
  targetIdentityVerifier?: RegistryBootstrapTargetIdentityVerifier | null;
}

export interface RegistryBootstrapStore {
  readDatabaseMetadata(): Promise<RegistryDatabaseMetadata>;
  readRegistrySnapshot(definitions: CanonicalRegistryDefinitions): Promise<RegistrySnapshot>;
  applyRegistryDefinitions(definitions: CanonicalRegistryDefinitions, plan: RegistryBootstrapPlan): Promise<void>;
  disconnect(): Promise<void>;
}

export class RegistryBootstrapError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "RegistryBootstrapError";
  }
}

interface RegistryFieldChange {
  field: string;
  before: string;
  after: string;
}

function readTrimmedValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isJsonArray(value: Prisma.JsonValue | null): value is Prisma.JsonArray {
  return Array.isArray(value);
}

function isJsonObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function areJsonValuesSemanticallyEqual(
  left: Prisma.JsonValue | null,
  right: Prisma.JsonValue | null,
): boolean {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return left === right;
  }

  if (isJsonArray(left) || isJsonArray(right)) {
    if (!isJsonArray(left) || !isJsonArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => areJsonValuesSemanticallyEqual(value, right[index] ?? null));
  }

  if (isJsonObject(left) || isJsonObject(right)) {
    if (!isJsonObject(left) || !isJsonObject(right)) {
      return false;
    }

    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!Object.hasOwn(right, key)) {
        return false;
      }

      if (!areJsonValuesSemanticallyEqual(left[key] ?? null, right[key] ?? null)) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function classifyRegistryValue(value: unknown): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `array(length=${value.length})`;
  }

  if (typeof value === "string") {
    return value.length === 0 ? "string(empty)" : "string(non-empty)";
  }

  if (typeof value === "number") {
    return "number";
  }

  if (typeof value === "boolean") {
    return `boolean(${value ? "true" : "false"})`;
  }

  if (typeof value === "object") {
    return `object(keys=${Object.keys(value as Record<string, unknown>).length})`;
  }

  return typeof value;
}

function createUpdateDetails(changes: RegistryFieldChange[]): Record<string, unknown> {
  return {
    changedFields: changes.map((change) => change.field),
    fieldDiffs: changes,
  };
}

function describeFieldChange(field: string, before: unknown, after: unknown): RegistryFieldChange {
  return {
    field,
    before: classifyRegistryValue(before),
    after: classifyRegistryValue(after),
  };
}

function normalizeEndpointHost(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  const [firstLabel, ...rest] = normalized.split(".");

  if (!firstLabel) {
    return null;
  }

  const normalizedFirstLabel = firstLabel.endsWith("-pooler")
    ? firstLabel.slice(0, -"-pooler".length)
    : firstLabel;

  return [normalizedFirstLabel, ...rest].join(".");
}

function parseDatabaseUrl(databaseUrl: string | null | undefined): { endpointHost: string | null } {
  if (!databaseUrl) {
    return { endpointHost: null };
  }

  try {
    const parsed = new URL(databaseUrl);

    return {
      endpointHost: normalizeEndpointHost(parsed.hostname),
    };
  } catch {
    return { endpointHost: null };
  }
}

function cloneJsonValue(value: unknown): Prisma.JsonValue | null {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.JsonValue | null;
}

function toNullableJsonInput(value: Prisma.JsonValue | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function createConfigFingerprint(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function toErrorDetails(details: object): Record<string, unknown> {
  return { ...details };
}

function toSourceConfigJson(source: ResolvedSourceConfig): Prisma.JsonValue {
  return cloneJsonValue({
    datasetCodes: [...source.datasetCodes],
    pipelineCodes: [...source.pipelineCodes],
  });
}

function toPipelineConfigJson(pipeline: ResolvedPipelineConfig): Prisma.JsonValue {
  return cloneJsonValue({
    datasetCodes: [...pipeline.datasetCodes],
  });
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/bearer\s+[a-z0-9._\-~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/password\s*=\s*[^\s'"`]+/gi, "password=[REDACTED]")
    .replace(/user(name)?\s*=\s*[^\s'"`]+/gi, "username=[REDACTED]")
    .replace(/(api[_ -]?key\s*[=:]\s*)[^\s'"`]+/gi, "$1[REDACTED]");
}

export function parseRegistryBootstrapMode(argv: string[] = process.argv.slice(2)): RegistryBootstrapMode {
  const wantsDryRun = argv.includes("--dry-run");
  const wantsApply = argv.includes("--apply");

  if (wantsDryRun === wantsApply) {
    throw new RegistryBootstrapError(
      "INVALID_BOOTSTRAP_MODE",
      "Registry bootstrap requires exactly one explicit mode flag: --dry-run or --apply.",
    );
  }

  return wantsApply ? "apply" : "dry-run";
}

export function resolveRegistryBootstrapEnvironment(
  env: RegistryBootstrapEnvShape = process.env,
): RegistryBootstrapEnvironmentConfig {
  const runtimeEnvironment = resolveDataRuntimeEnvironment(env, { requireExplicitEnvironment: true });

  return {
    ...runtimeEnvironment,
    allowProductionRegistryBootstrap: readTrimmedValue(env.ALLOW_PRODUCTION_REGISTRY_BOOTSTRAP) === "true",
    expectedProjectId: readTrimmedValue(env.DATA_RUNTIME_EXPECTED_PROJECT_ID),
    expectedBranchId: readTrimmedValue(env.DATA_RUNTIME_EXPECTED_BRANCH_ID),
    neonApiKey: readTrimmedValue(env.DATA_RUNTIME_NEON_API_KEY) ?? readTrimmedValue(env.NEON_API_KEY),
    neonApiBaseUrl: readTrimmedValue(env.DATA_RUNTIME_NEON_API_BASE_URL) ?? OFFICIAL_NEON_API_BASE_URL,
  };
}

export function buildCanonicalRegistryDefinitions(): CanonicalRegistryDefinitions {
  const connector = IN_MEMORY_RUNTIME_REGISTRY.connectors.snowflake;
  const source = IN_MEMORY_RUNTIME_REGISTRY.sources["market-indexes"];
  const datasets = [
    IN_MEMORY_RUNTIME_REGISTRY.datasets["index-data"],
    IN_MEMORY_RUNTIME_REGISTRY.datasets["accuracy-data"],
  ];
  const pipelines = [
    IN_MEMORY_RUNTIME_REGISTRY.pipelines.dashboard,
    IN_MEMORY_RUNTIME_REGISTRY.pipelines["forecast-accuracy"],
  ];

  return {
    connector: {
      code: connector.code,
      name: connector.name,
      kind: DrConnectorKind.SNOWFLAKE,
      configJson: null,
      isActive: true,
    },
    source: {
      code: source.code,
      name: source.name,
      connectorCode: source.connectorCode,
      configJson: toSourceConfigJson(source),
      datasetCodes: [...source.datasetCodes],
      pipelineCodes: [...source.pipelineCodes],
      isActive: true,
    },
    datasets: datasets.map((dataset) => ({
      code: dataset.code,
      name: dataset.name,
      sourceCode: dataset.sourceCode,
      datasetType: dataset.datasetType,
      sourceDatabase: dataset.sourceDatabase,
      sourceSchema: dataset.sourceSchema,
      sourceObject: dataset.sourceObject,
      watermarkColumn: dataset.watermarkColumn,
      watermarkType: dataset.watermarkType,
      fetchConfigJson: cloneJsonValue(dataset.fetchConfig),
      pipelineCodes: [...dataset.pipelineCodes],
      isActive: true,
    })),
    pipelines: pipelines.map((pipeline) => ({
      code: pipeline.code,
      name: pipeline.name,
      sourceCode: source.code,
      datasetCode: pipeline.datasetCodes[0],
      targetStore: pipeline.targetStore,
      configJson: toPipelineConfigJson(pipeline),
      configFingerprint: createConfigFingerprint({
        sourceCode: source.code,
        datasetCode: pipeline.datasetCodes[0],
        pipelineCode: pipeline.code,
        targetStore: pipeline.targetStore,
        configJson: toPipelineConfigJson(pipeline),
      }),
      isActive: true,
    })),
  };
}

export function validateCanonicalRegistryDefinitions(definitions: CanonicalRegistryDefinitions): void {
  const datasetKeys = new Set<string>();
  const pipelineKeys = new Set<string>();
  const datasetCodes = new Set(definitions.datasets.map((dataset) => dataset.code));

  for (const dataset of definitions.datasets) {
    const key = `${dataset.sourceCode}:${dataset.code}`;

    if (datasetKeys.has(key)) {
      throw new RegistryBootstrapError(
        "CANONICAL_REGISTRY_DEFINITION_CONFLICT",
        `Duplicate canonical dataset definition detected for ${key}.`,
      );
    }

    datasetKeys.add(key);
  }

  for (const pipeline of definitions.pipelines) {
    const key = `${pipeline.sourceCode}:${pipeline.datasetCode}:${pipeline.code}`;

    if (pipelineKeys.has(key)) {
      throw new RegistryBootstrapError(
        "CANONICAL_REGISTRY_DEFINITION_CONFLICT",
        `Duplicate canonical pipeline definition detected for ${key}.`,
      );
    }

    if (!datasetCodes.has(pipeline.datasetCode)) {
      throw new RegistryBootstrapError(
        "CANONICAL_REGISTRY_DEFINITION_CONFLICT",
        `Pipeline ${pipeline.code} references missing dataset ${pipeline.datasetCode}.`,
      );
    }

    pipelineKeys.add(key);
  }
}

export function evaluateSchemaPreflight(tableNames: string[]): SchemaPreflightResult {
  const normalizedTableNames = new Set(tableNames);
  const missingTables = REQUIRED_RUNTIME_SCHEMA_TABLES.filter((tableName) => !normalizedTableNames.has(tableName));

  return {
    ready: missingTables.length === 0,
    missingTables: [...missingTables],
    requiredTables: [...REQUIRED_RUNTIME_SCHEMA_TABLES],
    registryTables: [...REQUIRED_REGISTRY_TABLES],
    lifecycleTables: [...REQUIRED_LIFECYCLE_TABLES],
    readModelTables: [...REQUIRED_READ_MODEL_TABLES],
  };
}

function compareConnector(definition: CanonicalConnectorDefinition, current: RegistryConnectorState | null): RegistryBootstrapPlanEntry {
  if (!current) {
    return { entityType: "connector", key: definition.code, action: "create" };
  }

  if (current.kind !== definition.kind) {
    return {
      entityType: "connector",
      key: definition.code,
      action: "conflict",
      conflictCode: "IMMUTABLE_IDENTITY_MISMATCH",
      details: {
        actualKind: current.kind,
        expectedKind: definition.kind,
      },
    };
  }

  const changes: RegistryFieldChange[] = [];

  if (current.name !== definition.name) {
    changes.push(describeFieldChange("name", current.name, definition.name));
  }

  if (current.isActive !== definition.isActive) {
    changes.push(describeFieldChange("isActive", current.isActive, definition.isActive));
  }

  if (!areJsonValuesSemanticallyEqual(current.configJson, definition.configJson)) {
    changes.push(describeFieldChange("configJson", current.configJson, definition.configJson));
  }

  return {
    entityType: "connector",
    key: definition.code,
    action: changes.length === 0 ? "unchanged" : "update",
    details: changes.length === 0 ? undefined : createUpdateDetails(changes),
  };
}

function compareSource(definition: CanonicalSourceDefinition, current: RegistrySourceState | null): RegistryBootstrapPlanEntry {
  if (!current) {
    return { entityType: "source", key: definition.code, action: "create" };
  }

  if (current.connectorCode !== definition.connectorCode) {
    return {
      entityType: "source",
      key: definition.code,
      action: "conflict",
      conflictCode: "PARENT_RELATIONSHIP_MISMATCH",
      details: {
        actualConnectorCode: current.connectorCode,
        expectedConnectorCode: definition.connectorCode,
      },
    };
  }

  const changes: RegistryFieldChange[] = [];

  if (current.name !== definition.name) {
    changes.push(describeFieldChange("name", current.name, definition.name));
  }

  if (current.isActive !== definition.isActive) {
    changes.push(describeFieldChange("isActive", current.isActive, definition.isActive));
  }

  if (!areJsonValuesSemanticallyEqual(current.configJson, definition.configJson)) {
    changes.push(describeFieldChange("configJson", current.configJson, definition.configJson));
  }

  if (!areJsonValuesSemanticallyEqual(current.datasetCodes, definition.datasetCodes)) {
    changes.push(describeFieldChange("datasetCodes", current.datasetCodes, definition.datasetCodes));
  }

  if (!areJsonValuesSemanticallyEqual(current.pipelineCodes, definition.pipelineCodes)) {
    changes.push(describeFieldChange("pipelineCodes", current.pipelineCodes, definition.pipelineCodes));
  }

  return {
    entityType: "source",
    key: definition.code,
    action: changes.length === 0 ? "unchanged" : "update",
    details: changes.length === 0 ? undefined : createUpdateDetails(changes),
  };
}

function compareDataset(definition: CanonicalDatasetDefinition, current: RegistryDatasetState | null): RegistryBootstrapPlanEntry {
  const key = `${definition.sourceCode}:${definition.code}`;

  if (!current) {
    return { entityType: "dataset", key, action: "create" };
  }

  if (
    current.datasetType !== definition.datasetType
    || current.sourceDatabase !== definition.sourceDatabase
    || current.sourceSchema !== definition.sourceSchema
    || current.sourceObject !== definition.sourceObject
  ) {
    return {
      entityType: "dataset",
      key,
      action: "conflict",
      conflictCode: "IMMUTABLE_IDENTITY_MISMATCH",
      details: {
        actualDatasetType: current.datasetType,
        expectedDatasetType: definition.datasetType,
        actualSourceDatabase: current.sourceDatabase,
        expectedSourceDatabase: definition.sourceDatabase,
        actualSourceSchema: current.sourceSchema,
        expectedSourceSchema: definition.sourceSchema,
        actualSourceObject: current.sourceObject,
        expectedSourceObject: definition.sourceObject,
      },
    };
  }

  const changes: RegistryFieldChange[] = [];

  if (current.name !== definition.name) {
    changes.push(describeFieldChange("name", current.name, definition.name));
  }

  if (current.watermarkColumn !== definition.watermarkColumn) {
    changes.push(describeFieldChange("watermarkColumn", current.watermarkColumn, definition.watermarkColumn));
  }

  if (current.watermarkType !== definition.watermarkType) {
    changes.push(describeFieldChange("watermarkType", current.watermarkType, definition.watermarkType));
  }

  if (current.isActive !== definition.isActive) {
    changes.push(describeFieldChange("isActive", current.isActive, definition.isActive));
  }

  if (!areJsonValuesSemanticallyEqual(current.fetchConfigJson, definition.fetchConfigJson)) {
    changes.push(describeFieldChange("fetchConfigJson", current.fetchConfigJson, definition.fetchConfigJson));
  }

  if (!areJsonValuesSemanticallyEqual(current.pipelineCodes, definition.pipelineCodes)) {
    changes.push(describeFieldChange("pipelineCodes", current.pipelineCodes, definition.pipelineCodes));
  }

  return {
    entityType: "dataset",
    key,
    action: changes.length === 0 ? "unchanged" : "update",
    details: changes.length === 0 ? undefined : createUpdateDetails(changes),
  };
}

function comparePipeline(definition: CanonicalPipelineDefinition, current: RegistryPipelineState | null): RegistryBootstrapPlanEntry {
  const key = `${definition.sourceCode}:${definition.datasetCode}:${definition.code}`;

  if (!current) {
    return { entityType: "pipeline", key, action: "create" };
  }

  if (current.datasetCode !== definition.datasetCode) {
    return {
      entityType: "pipeline",
      key,
      action: "conflict",
      conflictCode: "DATASET_RELATIONSHIP_MISMATCH",
      details: {
        actualDatasetCode: current.datasetCode,
        expectedDatasetCode: definition.datasetCode,
      },
    };
  }

  if (current.targetStore !== definition.targetStore) {
    return {
      entityType: "pipeline",
      key,
      action: "conflict",
      conflictCode: "TARGET_STORE_MISMATCH",
      details: {
        actualTargetStore: current.targetStore,
        expectedTargetStore: definition.targetStore,
      },
    };
  }

  const changes: RegistryFieldChange[] = [];

  if (current.name !== definition.name) {
    changes.push(describeFieldChange("name", current.name, definition.name));
  }

  if (current.isActive !== definition.isActive) {
    changes.push(describeFieldChange("isActive", current.isActive, definition.isActive));
  }

  if (current.configFingerprint !== definition.configFingerprint) {
    changes.push(describeFieldChange("configFingerprint", current.configFingerprint, definition.configFingerprint));
  }

  if (!areJsonValuesSemanticallyEqual(current.configJson, definition.configJson)) {
    changes.push(describeFieldChange("configJson", current.configJson, definition.configJson));
  }

  return {
    entityType: "pipeline",
    key,
    action: changes.length === 0 ? "unchanged" : "update",
    details: changes.length === 0 ? undefined : createUpdateDetails(changes),
  };
}

function createConflict(
  entityType: RegistryBootstrapPlanEntry["entityType"],
  key: string,
  code: RegistryBootstrapConflictCode,
  message: string,
  details: Record<string, unknown>,
): RegistryBootstrapConflict {
  return { entityType, key, code, message, details };
}

export function createRegistryBootstrapPlan(
  definitions: CanonicalRegistryDefinitions,
  snapshot: RegistrySnapshot,
): RegistryBootstrapPlan {
  const entries: RegistryBootstrapPlanEntry[] = [];
  const conflicts: RegistryBootstrapConflict[] = [];

  const addEntry = (entry: RegistryBootstrapPlanEntry): void => {
    entries.push(entry);

    if (entry.action !== "conflict" || !entry.conflictCode) {
      return;
    }

    conflicts.push(
      createConflict(
        entry.entityType,
        entry.key,
        entry.conflictCode,
        `Registry bootstrap conflict for ${entry.entityType} ${entry.key}.`,
        entry.details ?? {},
      ),
    );
  };

  const pipelineCandidatesBySourceAndCode = new Map<string, RegistryPipelineState[]>();

  for (const pipeline of snapshot.pipelines) {
    const candidateKey = `${pipeline.sourceCode}:${pipeline.code}`;
    const candidates = pipelineCandidatesBySourceAndCode.get(candidateKey) ?? [];
    candidates.push(pipeline);
    pipelineCandidatesBySourceAndCode.set(candidateKey, candidates);
  }

  addEntry(compareConnector(definitions.connector, snapshot.connector));
  addEntry(compareSource(definitions.source, snapshot.source));

  for (const dataset of definitions.datasets) {
    const current = snapshot.datasets.find((candidate) => candidate.sourceCode === dataset.sourceCode && candidate.code === dataset.code) ?? null;
    addEntry(compareDataset(dataset, current));
  }

  for (const pipeline of definitions.pipelines) {
    const candidateKey = `${pipeline.sourceCode}:${pipeline.code}`;
    const candidates = pipelineCandidatesBySourceAndCode.get(candidateKey) ?? [];

    if (candidates.length > 1) {
      addEntry({
        entityType: "pipeline",
        key: `${pipeline.sourceCode}:${pipeline.datasetCode}:${pipeline.code}`,
        action: "conflict",
        conflictCode: "DUPLICATE_EXISTING_KEY",
        details: {
          sourceCode: pipeline.sourceCode,
          pipelineCode: pipeline.code,
          datasetCodes: candidates.map((candidate) => candidate.datasetCode).sort(),
        },
      });
      continue;
    }

    addEntry(comparePipeline(pipeline, candidates[0] ?? null));
  }

  return {
    entries,
    createCount: entries.filter((entry) => entry.action === "create").length,
    updateCount: entries.filter((entry) => entry.action === "update").length,
    unchangedCount: entries.filter((entry) => entry.action === "unchanged").length,
    conflictCount: conflicts.length,
    conflicts,
    evaluationComplete: true,
  };
}

export async function verifyRegistryBootstrapTargetIdentity(
  environment: RegistryBootstrapEnvironmentConfig,
  metadata: RegistryDatabaseMetadata,
  targetIdentityVerifier: RegistryBootstrapTargetIdentityVerifier | null,
): Promise<RegistryBootstrapTargetIdentity> {
  const expectedDatabaseName = environment.environment === "PRODUCTION" ? PRODUCTION_EXPECTED_DATABASE_NAME : null;
  const expectedProjectId = environment.environment === "PRODUCTION"
    ? (environment.expectedProjectId ?? PRODUCTION_EXPECTED_NEON_PROJECT_ID)
    : environment.expectedProjectId;
  const expectedBranchId = environment.environment === "PRODUCTION"
    ? (environment.expectedBranchId ?? PRODUCTION_EXPECTED_NEON_BRANCH_ID)
    : environment.expectedBranchId;

  let resolvedProjectId = metadata.projectId;
  let resolvedBranchId = metadata.branchId;
  let resolvedEndpointHost = metadata.endpointHost;
  let resolvedEndpointId: string | null = null;
  let verificationSource: RegistryBootstrapTargetIdentity["verificationSource"] = "database-only";

  if (environment.environment === "PRODUCTION") {
    if (!targetIdentityVerifier) {
      throw new RegistryBootstrapError(
        "PROVIDER_TARGET_IDENTITY_VERIFIER_UNAVAILABLE",
        "Production registry bootstrap requires provider-backed Neon target identity verification.",
      );
    }

    const verifiedIdentity = await targetIdentityVerifier.verifyTargetIdentity({ environment, metadata });

    resolvedProjectId = verifiedIdentity.projectId;
    resolvedBranchId = verifiedIdentity.branchId;
    resolvedEndpointHost = verifiedIdentity.endpointHost;
    resolvedEndpointId = verifiedIdentity.endpointId;
    verificationSource = "neon-api";
  }

  if (expectedDatabaseName && metadata.databaseName !== expectedDatabaseName) {
    throw new RegistryBootstrapError(
      "DATABASE_TARGET_IDENTITY_MISMATCH",
      `Resolved database ${metadata.databaseName ?? "unknown"} does not match expected ${expectedDatabaseName}.`,
      { databaseName: metadata.databaseName, expectedDatabaseName },
    );
  }

  if (!resolvedProjectId && expectedProjectId) {
    throw new RegistryBootstrapError(
      "DATABASE_TARGET_IDENTITY_MISMATCH",
      `Resolved project identity is unavailable but expected ${expectedProjectId}.`,
      { projectId: resolvedProjectId, expectedProjectId },
    );
  }

  if (resolvedProjectId && expectedProjectId && resolvedProjectId !== expectedProjectId) {
    throw new RegistryBootstrapError(
      "DATABASE_TARGET_IDENTITY_MISMATCH",
      `Resolved project identity ${resolvedProjectId} does not match expected ${expectedProjectId}.`,
      { projectId: resolvedProjectId, expectedProjectId },
    );
  }

  if (!resolvedBranchId && expectedBranchId) {
    throw new RegistryBootstrapError(
      "DATABASE_TARGET_IDENTITY_MISMATCH",
      `Resolved branch identity is unavailable but expected ${expectedBranchId}.`,
      { branchId: resolvedBranchId, expectedBranchId },
    );
  }

  if (resolvedBranchId && expectedBranchId && resolvedBranchId !== expectedBranchId) {
    throw new RegistryBootstrapError(
      "DATABASE_TARGET_IDENTITY_MISMATCH",
      `Resolved branch identity ${resolvedBranchId} does not match expected ${expectedBranchId}.`,
      { branchId: resolvedBranchId, expectedBranchId },
    );
  }

  return {
    databaseName: metadata.databaseName,
    schemaName: metadata.schemaName,
    endpointHost: resolvedEndpointHost,
    endpointId: resolvedEndpointId,
    projectId: resolvedProjectId,
    branchId: resolvedBranchId,
    expectedDatabaseName,
    expectedProjectId,
    expectedBranchId,
    databaseVerified: Boolean(expectedDatabaseName ? metadata.databaseName === expectedDatabaseName : metadata.databaseName),
    projectVerified: Boolean(resolvedProjectId && expectedProjectId ? resolvedProjectId === expectedProjectId : false),
    branchVerified: Boolean(resolvedBranchId && expectedBranchId ? resolvedBranchId === expectedBranchId : false),
    verificationSource,
  };
}

function ensureBootstrapModeAllowed(input: RegistryBootstrapInput): void {
  if (input.environment.environment === "PRODUCTION" && input.mode === "apply" && !input.environment.allowProductionRegistryBootstrap) {
    throw new RegistryBootstrapError(
      "PRODUCTION_BOOTSTRAP_CONFIRMATION_MISSING",
      `Production registry bootstrap apply requires ${PRODUCTION_REGISTRY_BOOTSTRAP_CONFIRMATION_ENV}=true and --apply.`,
    );
  }
}

function ensureSchemaReady(input: RegistryBootstrapInput, schemaStatus: SchemaPreflightResult): void {
  if (schemaStatus.ready) {
    return;
  }

  const code = input.environment.environment === "PRODUCTION" ? "PRODUCTION_SCHEMA_NOT_READY" : "SCHEMA_NOT_READY";

  throw new RegistryBootstrapError(
    code,
    `Registry bootstrap requires runtime schema initialization before execution. Missing tables: ${schemaStatus.missingTables.join(", ")}.`,
    { missingTables: schemaStatus.missingTables },
  );
}

function ensurePlanSafeForApply(input: RegistryBootstrapInput, plan: RegistryBootstrapPlan): void {
  if (!plan.evaluationComplete) {
    throw new RegistryBootstrapError(
      "REGISTRY_BOOTSTRAP_CONFLICT_EVALUATION_INCOMPLETE",
      "Registry bootstrap apply cannot continue because conflict evaluation is incomplete.",
    );
  }

  if (plan.conflictCount === 0) {
    return;
  }

  throw new RegistryBootstrapError(
    input.environment.environment === "PRODUCTION"
      ? "PRODUCTION_REGISTRY_BOOTSTRAP_CONFLICTS_DETECTED"
      : "REGISTRY_BOOTSTRAP_CONFLICTS_DETECTED",
    `Registry bootstrap apply blocked because ${plan.conflictCount} conflict(s) were detected.`,
    { conflicts: plan.conflicts },
  );
}

function buildSummary(
  input: RegistryBootstrapInput,
  targetIdentity: RegistryBootstrapTargetIdentity,
  schemaStatus: SchemaPreflightResult,
  plan: RegistryBootstrapPlan,
  durationMs: number,
  transactionCommitted: boolean,
): RegistryBootstrapSummary {
  const definitionCount = 2 + definitionsDatasetCount() + definitionsPipelineCount();
  const finalStatus = plan.conflictCount > 0
    ? "REGISTRY_BOOTSTRAP_CONFLICTS_DETECTED"
    : transactionCommitted
    ? "REGISTRY_BOOTSTRAP_APPLY_COMPLETED"
    : "REGISTRY_BOOTSTRAP_DRY_RUN_READY";

  return {
    environment: input.environment.environment,
    mode: input.mode,
    database: targetIdentity,
    schemaStatus,
    registryDefinitionsDiscovered: {
      path: REGISTRY_BOOTSTRAP_DEFINITION_PATH,
      format: "tracked-typescript",
      connectorCount: 1,
      sourceCount: 1,
      datasetCount: definitionsDatasetCount(),
      pipelineCount: definitionsPipelineCount(),
      total: definitionCount,
    },
    createCount: plan.createCount,
    updateCount: plan.updateCount,
    unchangedCount: plan.unchangedCount,
    conflictCount: plan.conflictCount,
    rowsInserted: transactionCommitted ? plan.createCount : 0,
    rowsUpdated: transactionCommitted ? plan.updateCount : 0,
    rowsDeleted: 0,
    transactionCommitted,
    durationMs,
    finalStatus,
  };
}

function definitionsDatasetCount(): number {
  return Object.keys(IN_MEMORY_RUNTIME_REGISTRY.datasets).length;
}

function definitionsPipelineCount(): number {
  return Object.keys(IN_MEMORY_RUNTIME_REGISTRY.pipelines).length;
}

export async function executeRegistryBootstrap(
  input: RegistryBootstrapInput,
  store: RegistryBootstrapStore,
  options: ExecuteRegistryBootstrapOptions = {},
): Promise<RegistryBootstrapSummary> {
  const startedAt = Date.now();

  try {
    if (!input.environment.databaseUrl) {
      throw new RegistryBootstrapError(
        "DATABASE_URL_MISSING",
        "Registry bootstrap requires DATABASE_URL in runtime/data-runtime/.env.local or the active environment.",
      );
    }

    ensureBootstrapModeAllowed(input);

    const definitions = buildCanonicalRegistryDefinitions();
    validateCanonicalRegistryDefinitions(definitions);

    const metadata = await store.readDatabaseMetadata();
    const targetIdentity = await verifyRegistryBootstrapTargetIdentity(
      input.environment,
      metadata,
      options.targetIdentityVerifier ?? null,
    );
    const schemaStatus = evaluateSchemaPreflight(metadata.tableNames);
    ensureSchemaReady(input, schemaStatus);

    const snapshot = await store.readRegistrySnapshot(definitions);
    const plan = createRegistryBootstrapPlan(definitions, snapshot);

    if (input.mode === "dry-run") {
      return buildSummary(input, targetIdentity, schemaStatus, plan, Date.now() - startedAt, false);
    }

    ensurePlanSafeForApply(input, plan);

    try {
      await store.applyRegistryDefinitions(definitions, plan);
    } catch (error) {
      throw new RegistryBootstrapError(
        "REGISTRY_BOOTSTRAP_TRANSACTION_FAILED",
        redactSensitiveText((error as Error).message),
      );
    }

    return buildSummary(input, targetIdentity, schemaStatus, plan, Date.now() - startedAt, true);
  } finally {
    await store.disconnect();
  }
}

export function formatRegistryBootstrapSummary(summary: RegistryBootstrapSummary): string {
  return JSON.stringify(summary, null, 2);
}

export function formatRegistryBootstrapFailure(error: unknown): string {
  if (error instanceof RegistryBootstrapError) {
    return JSON.stringify(
      {
        finalStatus: error.code,
        message: redactSensitiveText(error.message),
        details: error.details,
      },
      null,
      2,
    );
  }

  const message = error instanceof Error ? redactSensitiveText(error.message) : "Unknown registry bootstrap failure.";

  return JSON.stringify(
    {
      finalStatus: "REGISTRY_BOOTSTRAP_FAILED",
      message,
    },
    null,
    2,
  );
}

interface NeonProjectResponse {
  project: {
    id: string;
  };
}

interface NeonBranchResponse {
  branch: {
    id: string;
    project_id: string;
    name?: string;
  };
}

interface NeonEndpointsResponse {
  endpoints: Array<{
    id: string;
    project_id: string;
    branch_id: string;
    host: string;
  }>;
}

interface NeonDatabasesResponse {
  databases: Array<{
    name: string;
    branch_id: string;
  }>;
}

export class NeonRegistryBootstrapTargetIdentityVerifier implements RegistryBootstrapTargetIdentityVerifier {
  constructor(
    private readonly options: {
      apiKey: string | null;
      apiBaseUrl: string;
    },
  ) {}

  async verifyTargetIdentity(
    context: RegistryBootstrapTargetIdentityVerificationContext,
  ): Promise<RegistryBootstrapVerifiedIdentity> {
    const expectedProjectId = context.environment.expectedProjectId ?? PRODUCTION_EXPECTED_NEON_PROJECT_ID;
    const expectedBranchId = context.environment.expectedBranchId ?? PRODUCTION_EXPECTED_NEON_BRANCH_ID;
    const endpointHost = normalizeEndpointHost(context.metadata.endpointHost);

    if (!this.options.apiKey) {
      throw new RegistryBootstrapError(
        "PROVIDER_TARGET_IDENTITY_CREDENTIAL_MISSING",
        "Production registry bootstrap requires a Neon API key for provider-backed target verification.",
      );
    }

    if (!endpointHost) {
      throw new RegistryBootstrapError(
        "PROVIDER_TARGET_IDENTITY_ENDPOINT_UNRESOLVED",
        "Production registry bootstrap could not resolve the Neon endpoint host from DATABASE_URL.",
      );
    }

    const project = await this.requestJson<NeonProjectResponse>("PROJECT_LOOKUP", `projects/${expectedProjectId}`);
    const endpoints = await this.requestJson<NeonEndpointsResponse>("ENDPOINT_LOOKUP", `projects/${expectedProjectId}/branches/${expectedBranchId}/endpoints`);
    const branch = await this.requestJson<NeonBranchResponse>("BRANCH_LOOKUP", `projects/${expectedProjectId}/branches/${expectedBranchId}`);
    const databases = await this.requestJson<NeonDatabasesResponse>("DATABASE_LOOKUP", `projects/${expectedProjectId}/branches/${expectedBranchId}/databases`);

    this.assertProjectResponse(project, "PROJECT_LOOKUP");
    this.assertBranchResponse(branch, "BRANCH_LOOKUP");
    this.assertEndpointsResponse(endpoints, "ENDPOINT_LOOKUP");
    this.assertDatabasesResponse(databases, "DATABASE_LOOKUP");

    if (branch.branch.project_id !== project.project.id) {
      throw new RegistryBootstrapError(
        "PROVIDER_TARGET_IDENTITY_BRANCH_PROJECT_MISMATCH",
        `Resolved branch ${branch.branch.id} does not belong to expected project ${project.project.id}.`,
        {
          requestStage: "BRANCH_LOOKUP",
          resourceKind: "branch",
          httpStatus: null,
          providerErrorCode: "PROVIDER_BRANCH_PROJECT_MISMATCH",
          retryable: false,
          branchProjectId: branch.branch.project_id,
          expectedProjectId: project.project.id,
        },
      );
    }

    const endpoint = endpoints.endpoints.find((candidate) => normalizeEndpointHost(candidate.host) === endpointHost) ?? null;

    if (!endpoint) {
      throw new RegistryBootstrapError(
        "PROVIDER_TARGET_IDENTITY_ENDPOINT_NOT_FOUND",
        `Resolved endpoint host ${endpointHost} was not found on Neon branch ${expectedBranchId}.`,
        {
          requestStage: "ENDPOINT_LOOKUP",
          resourceKind: "endpoint",
          httpStatus: null,
          providerErrorCode: "PROVIDER_ENDPOINT_NOT_FOUND",
          retryable: false,
          endpointHost,
          expectedProjectId,
          expectedBranchId,
        },
      );
    }

    if (!context.metadata.databaseName) {
      throw new RegistryBootstrapError(
        "PROVIDER_TARGET_IDENTITY_DATABASE_UNRESOLVED",
        "Production registry bootstrap could not resolve the active database name from the target connection.",
      );
    }

    const databaseExists = databases.databases.some((database) => database.name === context.metadata.databaseName);

    if (!databaseExists) {
      throw new RegistryBootstrapError(
        "PROVIDER_TARGET_IDENTITY_DATABASE_NOT_FOUND",
        `Resolved database ${context.metadata.databaseName} was not found on Neon branch ${expectedBranchId}.`,
        {
          requestStage: "DATABASE_LOOKUP",
          resourceKind: "database",
          httpStatus: null,
          providerErrorCode: "PROVIDER_DATABASE_NOT_FOUND",
          retryable: false,
          databaseName: context.metadata.databaseName,
          expectedProjectId,
          expectedBranchId,
        },
      );
    }

    return {
      databaseName: context.metadata.databaseName,
      schemaName: context.metadata.schemaName,
      endpointHost,
      endpointId: endpoint.id,
      projectId: endpoint.project_id,
      branchId: endpoint.branch_id,
    };
  }

  private async requestJson<T>(requestStage: NeonProviderRequestStage, path: string): Promise<T> {
    const url = buildNeonApiUrl(this.options.apiBaseUrl, path);
    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          Accept: "application/json",
        },
      });
    } catch (error) {
      const details = describeNeonProviderNetworkFailure(requestStage);

      throw new RegistryBootstrapError(
        details.code,
        `Neon ${details.resourceKind} verification request failed before receiving a response.`,
        toErrorDetails(details),
      );
    }

    if (!response.ok) {
      const errorBody = await this.readErrorBody(response);
      const details = describeNeonProviderHttpFailure(requestStage, response.status);

      throw new RegistryBootstrapError(
        details.code,
        `Neon ${details.resourceKind} verification request failed with status ${response.status}. ${errorBody}`.trim(),
        toErrorDetails(details),
      );
    }

    try {
      return await response.json() as T;
    } catch {
      const details = describeNeonProviderMalformedResponse(requestStage);

      throw new RegistryBootstrapError(
        details.code,
        `Neon ${details.resourceKind} verification response was not valid JSON.`,
        toErrorDetails(details),
      );
    }
  }

  private assertProjectResponse(response: NeonProjectResponse, requestStage: NeonProviderRequestStage): void {
    if (typeof response?.project?.id === "string" && response.project.id) {
      return;
    }

    const details = describeNeonProviderMalformedResponse(requestStage);
    throw new RegistryBootstrapError(details.code, "Neon project verification response is missing the expected project id.", toErrorDetails(details));
  }

  private assertBranchResponse(response: NeonBranchResponse, requestStage: NeonProviderRequestStage): void {
    if (
      typeof response?.branch?.id === "string"
      && response.branch.id
      && typeof response.branch.project_id === "string"
      && response.branch.project_id
    ) {
      return;
    }

    const details = describeNeonProviderMalformedResponse(requestStage);
    throw new RegistryBootstrapError(details.code, "Neon branch verification response is missing expected branch fields.", toErrorDetails(details));
  }

  private assertEndpointsResponse(response: NeonEndpointsResponse, requestStage: NeonProviderRequestStage): void {
    if (Array.isArray(response?.endpoints)) {
      return;
    }

    const details = describeNeonProviderMalformedResponse(requestStage);
    throw new RegistryBootstrapError(details.code, "Neon endpoint verification response is missing the endpoint list.", toErrorDetails(details));
  }

  private assertDatabasesResponse(response: NeonDatabasesResponse, requestStage: NeonProviderRequestStage): void {
    if (Array.isArray(response?.databases)) {
      return;
    }

    const details = describeNeonProviderMalformedResponse(requestStage);
    throw new RegistryBootstrapError(details.code, "Neon database verification response is missing the database list.", toErrorDetails(details));
  }

  private async readErrorBody(response: Response): Promise<string> {
    try {
      const payload = await response.json() as { message?: string };
      return payload.message ? redactSensitiveText(payload.message) : "";
    } catch {
      return "";
    }
  }
}

export function createRegistryBootstrapTargetIdentityVerifier(
  environment: RegistryBootstrapEnvironmentConfig,
): RegistryBootstrapTargetIdentityVerifier | null {
  if (environment.environment !== "PRODUCTION") {
    return null;
  }

  try {
    normalizeNeonApiBaseUrl(environment.neonApiBaseUrl);
  } catch (error) {
    if (error instanceof NeonProviderConfigurationError) {
      throw new RegistryBootstrapError(error.code, error.message, error.details);
    }

    throw error;
  }

  return new NeonRegistryBootstrapTargetIdentityVerifier({
    apiKey: environment.neonApiKey,
    apiBaseUrl: environment.neonApiBaseUrl,
  });
}

export class PrismaRegistryBootstrapStore implements RegistryBootstrapStore {
  private readonly prisma: PrismaClient;
  private readonly databaseUrl: string;

  constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    this.prisma = new PrismaClient({ adapter });
  }

  async readDatabaseMetadata(): Promise<RegistryDatabaseMetadata> {
    const identityRows = await this.prisma.$queryRaw<Array<{ current_database: string | null; current_schema: string | null }>>`
      SELECT current_database() AS current_database, current_schema() AS current_schema
    `;
    const tableRows = await this.prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    return {
      databaseName: identityRows[0]?.current_database ?? null,
      schemaName: identityRows[0]?.current_schema ?? null,
      tableNames: tableRows.map((row) => row.table_name),
      endpointHost: parseDatabaseUrl(this.databaseUrl).endpointHost,
      projectId: null,
      branchId: null,
    };
  }

  async readRegistrySnapshot(definitions: CanonicalRegistryDefinitions): Promise<RegistrySnapshot> {
    const connector = await this.prisma.drConnector.findUnique({
      where: { code: definitions.connector.code },
    });
    const source = await this.prisma.drSource.findUnique({
      where: { code: definitions.source.code },
      include: { connector: true },
    });

    const datasets = source
      ? await this.prisma.drDataset.findMany({
        where: {
          sourceId: source.id,
          code: { in: definitions.datasets.map((dataset) => dataset.code) },
        },
      })
      : [];

    const pipelines = source
      ? await this.prisma.drPipeline.findMany({
        where: {
          sourceId: source.id,
          code: { in: definitions.pipelines.map((pipeline) => pipeline.code) },
        },
        include: { dataset: true },
      })
      : [];

    return {
      connector: connector
        ? {
          code: connector.code,
          name: connector.name,
          kind: connector.kind,
          configJson: connector.configJson,
          isActive: connector.isActive,
        }
        : null,
      source: source
        ? {
          code: source.code,
          name: source.name,
          connectorCode: source.connector.code,
          configJson: source.configJson ?? null,
          datasetCodes: [...definitions.source.datasetCodes],
          pipelineCodes: [...definitions.source.pipelineCodes],
          isActive: source.isActive,
        }
        : null,
      datasets: datasets.map((dataset) => ({
        code: dataset.code,
        name: dataset.name,
        sourceCode: definitions.source.code,
        datasetType: dataset.datasetType,
        sourceDatabase: dataset.sourceDatabase,
        sourceSchema: dataset.sourceSchema,
        sourceObject: dataset.sourceObject,
        watermarkColumn: dataset.watermarkColumn,
        watermarkType: dataset.watermarkType,
        fetchConfigJson: dataset.fetchConfigJson,
        pipelineCodes: definitions.pipelines
          .filter((pipeline) => pipeline.datasetCode === dataset.code)
          .map((pipeline) => pipeline.code),
        isActive: dataset.isActive,
      })),
      pipelines: pipelines.map((pipeline) => ({
        code: pipeline.code,
        name: pipeline.name,
        sourceCode: definitions.source.code,
        datasetCode: pipeline.dataset.code,
        targetStore: pipeline.targetStore,
        configJson: pipeline.configJson ?? null,
        configFingerprint: pipeline.configFingerprint ?? "",
        isActive: pipeline.isActive,
      })),
    };
  }

  async applyRegistryDefinitions(definitions: CanonicalRegistryDefinitions, _plan: RegistryBootstrapPlan): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const connector = await tx.drConnector.upsert({
        where: { code: definitions.connector.code },
        update: {
          name: definitions.connector.name,
          kind: definitions.connector.kind,
          configJson: toNullableJsonInput(definitions.connector.configJson),
          isActive: definitions.connector.isActive,
        },
        create: {
          code: definitions.connector.code,
          name: definitions.connector.name,
          kind: definitions.connector.kind,
          configJson: toNullableJsonInput(definitions.connector.configJson),
          isActive: definitions.connector.isActive,
        },
      });

      const source = await tx.drSource.upsert({
        where: { code: definitions.source.code },
        update: {
          connectorId: connector.id,
          name: definitions.source.name,
          configJson: toNullableJsonInput(definitions.source.configJson),
          isActive: definitions.source.isActive,
        },
        create: {
          connectorId: connector.id,
          code: definitions.source.code,
          name: definitions.source.name,
          configJson: toNullableJsonInput(definitions.source.configJson),
          isActive: definitions.source.isActive,
        },
      });

      const datasetIds = new Map<string, string>();

      for (const dataset of definitions.datasets) {
        const upsertedDataset = await tx.drDataset.upsert({
          where: {
            sourceId_code: {
              sourceId: source.id,
              code: dataset.code,
            },
          },
          update: {
            name: dataset.name,
            datasetType: dataset.datasetType,
            sourceDatabase: dataset.sourceDatabase,
            sourceSchema: dataset.sourceSchema,
            sourceObject: dataset.sourceObject,
            watermarkColumn: dataset.watermarkColumn,
            watermarkType: dataset.watermarkType,
            fetchConfigJson: toNullableJsonInput(dataset.fetchConfigJson),
            isActive: dataset.isActive,
          },
          create: {
            sourceId: source.id,
            code: dataset.code,
            name: dataset.name,
            datasetType: dataset.datasetType,
            sourceDatabase: dataset.sourceDatabase,
            sourceSchema: dataset.sourceSchema,
            sourceObject: dataset.sourceObject,
            watermarkColumn: dataset.watermarkColumn,
            watermarkType: dataset.watermarkType,
            fetchConfigJson: toNullableJsonInput(dataset.fetchConfigJson),
            isActive: dataset.isActive,
          },
        });

        datasetIds.set(dataset.code, upsertedDataset.id);
      }

      for (const pipeline of definitions.pipelines) {
        await tx.drPipeline.upsert({
          where: {
            sourceId_datasetId_code: {
              sourceId: source.id,
              datasetId: datasetIds.get(pipeline.datasetCode)!,
              code: pipeline.code,
            },
          },
          update: {
            name: pipeline.name,
            targetStore: pipeline.targetStore,
            configJson: toNullableJsonInput(pipeline.configJson),
            configFingerprint: pipeline.configFingerprint,
            isActive: pipeline.isActive,
          },
          create: {
            sourceId: source.id,
            datasetId: datasetIds.get(pipeline.datasetCode)!,
            code: pipeline.code,
            name: pipeline.name,
            targetStore: pipeline.targetStore,
            configJson: toNullableJsonInput(pipeline.configJson),
            configFingerprint: pipeline.configFingerprint,
            isActive: pipeline.isActive,
          },
        });
      }
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}