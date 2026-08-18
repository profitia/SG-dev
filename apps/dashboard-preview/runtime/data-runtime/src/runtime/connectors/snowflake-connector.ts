import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { ConnectorPayload, ConnectorResult, RuntimeConnector } from "./connector-contracts.ts";
import type { ConnectorStageInput } from "./connector-contracts.ts";

const SNOWFLAKE_PROBE_QUERY =
  "SELECT CURRENT_VERSION() AS SNOWFLAKE_VERSION, CURRENT_WAREHOUSE() AS WAREHOUSE_NAME, CURRENT_DATABASE() AS DATABASE_NAME, CURRENT_SCHEMA() AS SCHEMA_NAME";
const CONNECTOR_RESULT_PREFIX = "__DATA_RUNTIME_CONNECTOR_RESULT__";
const CONNECTOR_MAX_BUFFER_BYTES = 1024 * 1024 * 256;

interface SnowflakeRuntimeCredentials {
  account: string;
  username: string;
  authMethod: "password" | "key_pair";
  password: string | null;
  privateKeyPath: string | null;
  privateKeyPass: string | null;
  warehouse: string;
  database: string;
  schema: string | null;
  role: string | null;
}

interface SnowflakeProbeOutput {
  version: string | null;
  warehouse: string | null;
  database: string | null;
  schema: string | null;
  payload: ConnectorPayload;
}

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function resolveSnowflakeCredentials(): { credentials: SnowflakeRuntimeCredentials | null; message: string | null } {
  const account = readOptionalEnv("SNOWFLAKE_ACCOUNT");
  const username = readOptionalEnv("SNOWFLAKE_USERNAME");
  const authMethod = (readOptionalEnv("SNOWFLAKE_AUTH_METHOD") ?? "password") as "password" | "key_pair";
  const warehouse = readOptionalEnv("SNOWFLAKE_WAREHOUSE");
  const database = readOptionalEnv("SNOWFLAKE_DATABASE");

  if (!account || !username || !warehouse || !database) {
    return {
      credentials: null,
      message:
        "Snowflake connector is not fully configured. Expected SNOWFLAKE_ACCOUNT, SNOWFLAKE_USERNAME, SNOWFLAKE_WAREHOUSE and SNOWFLAKE_DATABASE.",
    };
  }

  const password = readOptionalEnv("SNOWFLAKE_PASSWORD");
  const privateKeyPath = readOptionalEnv("SNOWFLAKE_PRIVATE_KEY_PATH");

  if (authMethod === "password" && !password) {
    return {
      credentials: null,
      message: "Snowflake connector requires SNOWFLAKE_PASSWORD when SNOWFLAKE_AUTH_METHOD=password.",
    };
  }

  if (authMethod === "key_pair" && !privateKeyPath) {
    return {
      credentials: null,
      message:
        "Snowflake connector requires SNOWFLAKE_PRIVATE_KEY_PATH when SNOWFLAKE_AUTH_METHOD=key_pair.",
    };
  }

  return {
    credentials: {
      account,
      username,
      authMethod,
      password,
      privateKeyPath,
      privateKeyPass: readOptionalEnv("SNOWFLAKE_PRIVATE_KEY_PASS"),
      warehouse,
      database,
      schema: readOptionalEnv("SNOWFLAKE_SCHEMA"),
      role: readOptionalEnv("SNOWFLAKE_ROLE"),
    },
    message: null,
  };
}

function getTsxCliPath(): string {
  return fileURLToPath(import.meta.resolve("tsx/cli"));
}

function getProbeScriptPath(): string {
  return fileURLToPath(new URL("./snowflake-probe.ts", import.meta.url));
}

function quoteSnowflakeIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function buildPayloadQuery(input: ConnectorStageInput): string {
  const { sourceDatabase, sourceSchema, sourceObject } = input.dataset;
  const qualifiedSource = [sourceDatabase, sourceSchema, sourceObject].map(quoteSnowflakeIdentifier).join(".");
  const projectedColumns = input.dataset.fetchConfig?.selectColumns?.length
    ? input.dataset.fetchConfig.selectColumns.map(
        (columnName) => `  src.${quoteSnowflakeIdentifier(columnName)} AS ${quoteSnowflakeIdentifier(columnName)}`,
      )
    : ["  src.*"];
  const orderByClause = input.dataset.fetchConfig?.orderBy?.length
    ? `\nORDER BY ${input.dataset.fetchConfig.orderBy.join(", ")}`
    : "";

  return (
    [
      "SELECT",
      "  TO_VARCHAR(SEQ8()) AS SOURCE_ROW_ID,",
      "  TO_VARCHAR(CURRENT_TIMESTAMP()) AS SOURCE_UPDATED_AT,",
      projectedColumns.join(",\n"),
      `FROM ${qualifiedSource} AS src`,
    ].join("\n") + orderByClause
  );
}

export class SnowflakeConnector implements RuntimeConnector {
  constructor(private readonly input: ConnectorStageInput) {}

  run(): ConnectorResult {
    const testedAt = new Date().toISOString();
    const resolved = resolveSnowflakeCredentials();
    const payloadQuery = buildPayloadQuery(this.input);

    if (!resolved.credentials) {
      return {
        status: "unconfigured",
        message: resolved.message ?? "Snowflake connector is not configured.",
        metadata: {
          connectorCode: this.input.connector.code,
          connectorKind: this.input.connector.kind,
          testedAt,
          environment: this.input.environment,
          probeQuery: null,
          account: null,
          warehouse: null,
          database: null,
          schema: null,
          version: null,
        },
        payload: null,
      };
    }

    try {
      const output = execFileSync(
        process.execPath,
        [getTsxCliPath(), getProbeScriptPath()],
        {
          encoding: "utf8",
          maxBuffer: CONNECTOR_MAX_BUFFER_BYTES,
          env: {
            ...process.env,
            DATA_RUNTIME_CONNECTOR_PROBE_PAYLOAD: JSON.stringify({
              config: resolved.credentials,
              probeQuery: SNOWFLAKE_PROBE_QUERY,
              payloadQuery,
            }),
          },
        },
      );

      const probeLine = output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith(CONNECTOR_RESULT_PREFIX));

      if (!probeLine) {
        throw new Error("Snowflake connector probe did not emit a parseable result payload.");
      }

      const probe = JSON.parse(probeLine.slice(CONNECTOR_RESULT_PREFIX.length)) as SnowflakeProbeOutput;

      return {
        status: "connected",
        message: "Snowflake connector validated configuration and executed the probe query successfully.",
        metadata: {
          connectorCode: this.input.connector.code,
          connectorKind: this.input.connector.kind,
          testedAt,
          environment: this.input.environment,
          probeQuery: SNOWFLAKE_PROBE_QUERY,
          account: resolved.credentials.account,
          warehouse: probe.warehouse,
          database: probe.database,
          schema: probe.schema,
          version: probe.version,
        },
        payload: probe.payload,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        status: "failed",
        message: `Snowflake connector probe failed: ${message}`,
        metadata: {
          connectorCode: this.input.connector.code,
          connectorKind: this.input.connector.kind,
          testedAt,
          environment: this.input.environment,
          probeQuery: SNOWFLAKE_PROBE_QUERY,
          account: resolved.credentials.account,
          warehouse: resolved.credentials.warehouse,
          database: resolved.credentials.database,
          schema: resolved.credentials.schema,
          version: null,
        },
        payload: null,
      };
    }
  }
}