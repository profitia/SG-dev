import snowflakeSdk from "snowflake-sdk";
import type { Connection, ConnectionOptions, SnowflakeError } from "snowflake-sdk";

import type { ConnectorPayload } from "./connector-contracts.ts";

const { createConnection } = snowflakeSdk;

interface SnowflakeProbeConfig {
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

interface ProbePayload {
  config: SnowflakeProbeConfig;
  probeQuery: string;
  payloadQuery: string;
}

const CONNECTOR_RESULT_PREFIX = "__DATA_RUNTIME_CONNECTOR_RESULT__";

type ProbeRow = {
  SNOWFLAKE_VERSION?: string;
  WAREHOUSE_NAME?: string;
  DATABASE_NAME?: string;
  SCHEMA_NAME?: string;
  SOURCE_ROW_ID?: unknown;
  SOURCE_UPDATED_AT?: unknown;
} & Record<string, unknown>;

function toConnectorPayloadValue(value: unknown): string | number | boolean | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
}

function toNullableString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

function toConnectorPayload(query: string, rows: ProbeRow[]): ConnectorPayload {
  return {
    query,
    records: rows.map((row) => ({
      values: Object.fromEntries(
        Object.entries(row)
          .filter(([key]) => key !== "SOURCE_ROW_ID" && key !== "SOURCE_UPDATED_AT")
          .map(([key, value]) => [key, toConnectorPayloadValue(value)]),
      ),
      sourceRowId: toNullableString(row.SOURCE_ROW_ID),
      sourceUpdatedAt: toNullableString(row.SOURCE_UPDATED_AT),
    })),
    recordCount: rows.length,
  };
}

function connect(connection: Connection): Promise<void> {
  return connection.connectAsync().then(() => undefined);
}

function destroy(connection: Connection): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    connection.destroy((error: SnowflakeError | undefined) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function execute(connection: Connection, query: string): Promise<ProbeRow[]> {
  return new Promise<ProbeRow[]>((resolve, reject) => {
    connection.execute({
      sqlText: query,
      complete: (error, _statement, rows) => {
        if (error) {
          reject(error);
          return;
        }

        resolve((rows ?? []) as ProbeRow[]);
      },
    });
  });
}

function createOptions(config: SnowflakeProbeConfig): ConnectionOptions {
  const options: ConnectionOptions = {
    account: config.account,
    username: config.username,
    warehouse: config.warehouse,
    database: config.database,
  };

  if (config.schema) {
    options.schema = config.schema;
  }

  if (config.role) {
    options.role = config.role;
  }

  if (config.authMethod === "password") {
    if (!config.password) {
      throw new Error("SNOWFLAKE_PASSWORD is required when SNOWFLAKE_AUTH_METHOD=password.");
    }

    options.password = config.password;
  } else {
    if (!config.privateKeyPath) {
      throw new Error("SNOWFLAKE_PRIVATE_KEY_PATH is required when SNOWFLAKE_AUTH_METHOD=key_pair.");
    }

    options.privateKeyPath = config.privateKeyPath;

    if (config.privateKeyPass) {
      options.privateKeyPass = config.privateKeyPass;
    }
  }

  return options;
}

async function main(): Promise<void> {
  const rawPayload = process.env["DATA_RUNTIME_CONNECTOR_PROBE_PAYLOAD"];

  if (!rawPayload) {
    throw new Error("Missing DATA_RUNTIME_CONNECTOR_PROBE_PAYLOAD.");
  }

  const payload = JSON.parse(rawPayload) as ProbePayload;
  const connection = createConnection(createOptions(payload.config));

  try {
    await connect(connection);
    const probeRows = await execute(connection, payload.probeQuery);
    const payloadRows = await execute(connection, payload.payloadQuery);
    const firstRow = probeRows[0] ?? {};

    process.stdout.write(
      `${CONNECTOR_RESULT_PREFIX}${JSON.stringify({
        version: firstRow.SNOWFLAKE_VERSION ?? null,
        warehouse: firstRow.WAREHOUSE_NAME ?? payload.config.warehouse,
        database: firstRow.DATABASE_NAME ?? payload.config.database,
        schema: firstRow.SCHEMA_NAME ?? payload.config.schema,
        payload: toConnectorPayload(payload.payloadQuery, payloadRows),
      })}`,
    );
  } finally {
    await destroy(connection).catch(() => undefined);
  }
}

void main();