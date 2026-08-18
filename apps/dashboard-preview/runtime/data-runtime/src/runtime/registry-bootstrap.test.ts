import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@prisma/client";

import {
  NeonRegistryBootstrapTargetIdentityVerifier,
  PRODUCTION_EXPECTED_NEON_BRANCH_ID,
  PRODUCTION_EXPECTED_DATABASE_NAME,
  PRODUCTION_EXPECTED_NEON_PROJECT_ID,
  RegistryBootstrapError,
  areJsonValuesSemanticallyEqual,
  buildCanonicalRegistryDefinitions,
  createRegistryBootstrapTargetIdentityVerifier,
  createRegistryBootstrapPlan,
  evaluateSchemaPreflight,
  executeRegistryBootstrap,
  formatRegistryBootstrapFailure,
  redactSensitiveText,
  resolveRegistryBootstrapEnvironment,
  validateCanonicalRegistryDefinitions,
  type CanonicalRegistryDefinitions,
  type RegistryBootstrapInput,
  type RegistryBootstrapPlan,
  type RegistryBootstrapStore,
  type RegistryDatabaseMetadata,
  type RegistrySnapshot,
  type RegistryBootstrapTargetIdentityVerificationContext,
  type RegistryBootstrapTargetIdentityVerifier,
  type RegistryBootstrapVerifiedIdentity,
} from "./registry-bootstrap.ts";
import { OFFICIAL_NEON_API_BASE_URL } from "./neon-provider-client.ts";

const FIXTURE_CONNECTION_URI = ["postgresql", "://runtime:secret@example.invalid/neondb"].join("");
const FIXTURE_CONNECTION_URI_WITH_PORT = ["postgresql", "://runtime:secret@example.invalid:5432/neondb?sslmode=require"].join("");

class FakeRegistryBootstrapStore implements RegistryBootstrapStore {
  public applyCalls = 0;

  constructor(
    public metadata: RegistryDatabaseMetadata,
    public snapshot: RegistrySnapshot,
    private readonly options: { throwOnApply?: Error } = {},
  ) {}

  async readDatabaseMetadata(): Promise<RegistryDatabaseMetadata> {
    return structuredClone(this.metadata);
  }

  async readRegistrySnapshot(): Promise<RegistrySnapshot> {
    return structuredClone(this.snapshot);
  }

  async applyRegistryDefinitions(definitions: CanonicalRegistryDefinitions, plan: RegistryBootstrapPlan): Promise<void> {
    this.applyCalls += 1;

    if (this.options.throwOnApply) {
      throw this.options.throwOnApply;
    }

    if (plan.createCount === 0 && plan.updateCount === 0) {
      return;
    }

    this.snapshot = {
      connector: structuredClone(definitions.connector),
      source: structuredClone(definitions.source),
      datasets: structuredClone(definitions.datasets),
      pipelines: structuredClone(definitions.pipelines),
    };
  }

  async disconnect(): Promise<void> {
    return;
  }
}

class FakeTargetIdentityVerifier implements RegistryBootstrapTargetIdentityVerifier {
  constructor(
    private readonly options: {
      error?: RegistryBootstrapError;
      identityOverrides?: Partial<RegistryBootstrapVerifiedIdentity>;
    } = {},
  ) {}

  async verifyTargetIdentity(
    context: RegistryBootstrapTargetIdentityVerificationContext,
  ): Promise<RegistryBootstrapVerifiedIdentity> {
    if (this.options.error) {
      throw this.options.error;
    }

    return {
      databaseName: context.metadata.databaseName,
      schemaName: context.metadata.schemaName,
      endpointHost: context.metadata.endpointHost,
      endpointId: "ep-runtime-bootstrap",
      projectId: PRODUCTION_EXPECTED_NEON_PROJECT_ID,
      branchId: PRODUCTION_EXPECTED_NEON_BRANCH_ID,
      ...this.options.identityOverrides,
    };
  }
}

function buildCompleteMetadata(overrides: Partial<RegistryDatabaseMetadata> = {}): RegistryDatabaseMetadata {
  return {
    databaseName: PRODUCTION_EXPECTED_DATABASE_NAME,
    schemaName: "public",
    tableNames: [
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
    ],
    endpointHost: "ep-runtime-bootstrap.us-east-2.aws.neon.tech",
    projectId: null,
    branchId: null,
    ...overrides,
  };
}

function buildEmptySnapshot(): RegistrySnapshot {
  return {
    connector: null,
    source: null,
    datasets: [],
    pipelines: [],
  };
}

function buildInput(overrides: Partial<RegistryBootstrapInput["environment"]> = {}, mode: RegistryBootstrapInput["mode"] = "dry-run"): RegistryBootstrapInput {
  return {
    environment: {
      environment: "STAGING",
      organizationId: "org-test",
      databaseUrl: FIXTURE_CONNECTION_URI,
      directUrl: null,
      allowProductionRegistryBootstrap: false,
      expectedProjectId: null,
      expectedBranchId: null,
      neonApiKey: null,
      neonApiBaseUrl: "https://console.neon.tech/api/v2",
      ...overrides,
    },
    mode,
  };
}

async function assertBootstrapError(promise: Promise<unknown>, code: string): Promise<RegistryBootstrapError> {
  try {
    await promise;
    assert.fail(`Expected ${code} to be thrown.`);
  } catch (error) {
    assert.ok(error instanceof RegistryBootstrapError);
    assert.equal(error.code, code);
    return error;
  }
}

function buildProductionVerifier(
  overrides: ConstructorParameters<typeof FakeTargetIdentityVerifier>[0] = {},
): RegistryBootstrapTargetIdentityVerifier {
  return new FakeTargetIdentityVerifier(overrides);
}

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createTextResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createMockedProductionVerifierTestContext(
  handler: (request: Request, url: URL) => Response | Promise<Response>,
): {
  restore(): void;
  calls: Array<{ method: string; pathname: string }>;
} {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ method: string; pathname: string }> = [];

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    calls.push({ method: request.method, pathname: url.pathname });
    return await handler(request, url);
  }) as typeof fetch;

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

function reverseObjectKeys<T extends Prisma.JsonObject>(value: T): T {
  const entries = Object.entries(value).reverse();
  return Object.fromEntries(entries) as T;
}

test("missing environment is rejected", () => {
  assert.throws(
    () => resolveRegistryBootstrapEnvironment({ DATA_RUNTIME_ORGANIZATION_ID: "org-test" }),
    /Missing DATA_RUNTIME_ENV/,
  );
});

test("unknown environment is rejected", () => {
  assert.throws(
    () => resolveRegistryBootstrapEnvironment({ DATA_RUNTIME_ENV: "DEV", DATA_RUNTIME_ORGANIZATION_ID: "org-test" }),
    /Unsupported DATA_RUNTIME_ENV/,
  );
});

test("staging dry-run computes creates and performs zero writes", async () => {
  const store = new FakeRegistryBootstrapStore(
    buildCompleteMetadata({ databaseName: "stagingdb" }),
    buildEmptySnapshot(),
  );

  const summary = await executeRegistryBootstrap(buildInput(), store);

  assert.equal(summary.mode, "dry-run");
  assert.equal(summary.createCount, 6);
  assert.equal(summary.updateCount, 0);
  assert.equal(summary.rowsInserted, 0);
  assert.equal(summary.rowsUpdated, 0);
  assert.equal(summary.rowsDeleted, 0);
  assert.equal(summary.transactionCommitted, false);
  assert.equal(store.applyCalls, 0);
});

test("production dry-run is supported without confirmation", async () => {
  const store = new FakeRegistryBootstrapStore(buildCompleteMetadata(), buildEmptySnapshot());

  await assertBootstrapError(
    executeRegistryBootstrap(
      buildInput({ environment: "PRODUCTION" }, "dry-run"),
      store,
    ),
    "PROVIDER_TARGET_IDENTITY_VERIFIER_UNAVAILABLE",
  );
});

test("production dry-run is supported with provider verification", async () => {
  const store = new FakeRegistryBootstrapStore(buildCompleteMetadata(), buildEmptySnapshot());

  const summary = await executeRegistryBootstrap(
    buildInput({ environment: "PRODUCTION" }, "dry-run"),
    store,
    { targetIdentityVerifier: buildProductionVerifier() },
  );

  assert.equal(summary.environment, "PRODUCTION");
  assert.equal(summary.mode, "dry-run");
  assert.equal(summary.finalStatus, "REGISTRY_BOOTSTRAP_DRY_RUN_READY");
  assert.equal(summary.database.verificationSource, "neon-api");
});

test("production apply without confirmation is rejected before writes", async () => {
  const store = new FakeRegistryBootstrapStore(buildCompleteMetadata(), buildEmptySnapshot());

  await assertBootstrapError(
    executeRegistryBootstrap(buildInput({ environment: "PRODUCTION" }, "apply"), store),
    "PRODUCTION_BOOTSTRAP_CONFIRMATION_MISSING",
  );
  assert.equal(store.applyCalls, 0);
});

test("production apply with confirmation succeeds", async () => {
  const store = new FakeRegistryBootstrapStore(buildCompleteMetadata(), buildEmptySnapshot());

  const summary = await executeRegistryBootstrap(
    buildInput({ environment: "PRODUCTION", allowProductionRegistryBootstrap: true }, "apply"),
    store,
    { targetIdentityVerifier: buildProductionVerifier() },
  );

  assert.equal(summary.transactionCommitted, true);
  assert.equal(summary.rowsInserted, 6);
  assert.equal(store.applyCalls, 1);
});

test("database target mismatch is rejected", async () => {
  const store = new FakeRegistryBootstrapStore(
    buildCompleteMetadata({ databaseName: "wrongdb" }),
    buildEmptySnapshot(),
  );

  await assertBootstrapError(
    executeRegistryBootstrap(
      buildInput({ environment: "PRODUCTION" }, "dry-run"),
      store,
      { targetIdentityVerifier: buildProductionVerifier() },
    ),
    "DATABASE_TARGET_IDENTITY_MISMATCH",
  );
});

test("missing schema is rejected for production", async () => {
  const store = new FakeRegistryBootstrapStore(
    buildCompleteMetadata({ tableNames: [] }),
    buildEmptySnapshot(),
  );

  const error = await assertBootstrapError(
    executeRegistryBootstrap(
      buildInput({ environment: "PRODUCTION" }, "dry-run"),
      store,
      { targetIdentityVerifier: buildProductionVerifier() },
    ),
    "PRODUCTION_SCHEMA_NOT_READY",
  );

  assert.deepEqual(error.details, { missingTables: buildCompleteMetadata().tableNames });
});

test("partial schema is rejected for production", async () => {
  const partialTables = buildCompleteMetadata().tableNames.filter((tableName) => tableName !== "dr_pipelines");
  const store = new FakeRegistryBootstrapStore(
    buildCompleteMetadata({ tableNames: partialTables }),
    buildEmptySnapshot(),
  );

  const error = await assertBootstrapError(
    executeRegistryBootstrap(
      buildInput({ environment: "PRODUCTION" }, "dry-run"),
      store,
      { targetIdentityVerifier: buildProductionVerifier() },
    ),
    "PRODUCTION_SCHEMA_NOT_READY",
  );

  assert.deepEqual(error.details, { missingTables: ["dr_pipelines"] });
});

test("schema preflight reports complete schema", () => {
  const result = evaluateSchemaPreflight(buildCompleteMetadata().tableNames);

  assert.equal(result.ready, true);
  assert.deepEqual(result.missingTables, []);
});

test("idempotent second apply produces only unchanged entries", async () => {
  const store = new FakeRegistryBootstrapStore(buildCompleteMetadata(), buildEmptySnapshot());
  const input = buildInput({ environment: "PRODUCTION", allowProductionRegistryBootstrap: true }, "apply");

  const firstSummary = await executeRegistryBootstrap(input, store, { targetIdentityVerifier: buildProductionVerifier() });
  const secondSummary = await executeRegistryBootstrap(input, store, { targetIdentityVerifier: buildProductionVerifier() });

  assert.equal(firstSummary.createCount, 6);
  assert.equal(secondSummary.createCount, 0);
  assert.equal(secondSummary.updateCount, 0);
  assert.equal(secondSummary.unchangedCount, 6);
});

test("conflicting canonical registry definitions are rejected", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  definitions.datasets.push(structuredClone(definitions.datasets[0]!));

  assert.throws(
    () => validateCanonicalRegistryDefinitions(definitions),
    /Duplicate canonical dataset definition/,
  );
});

test("transaction rollback surfaces a redacted error", async () => {
  const store = new FakeRegistryBootstrapStore(
    buildCompleteMetadata(),
    buildEmptySnapshot(),
    { throwOnApply: new Error(`${FIXTURE_CONNECTION_URI} transaction failed`) },
  );

  const error = await assertBootstrapError(
    executeRegistryBootstrap(
      buildInput({ environment: "PRODUCTION", allowProductionRegistryBootstrap: true }, "apply"),
      store,
      { targetIdentityVerifier: buildProductionVerifier() },
    ),
    "REGISTRY_BOOTSTRAP_TRANSACTION_FAILED",
  );

  assert.equal(store.applyCalls, 1);
  assert.match(error.message, /\[REDACTED_DATABASE_URL\]/);
});

test("secret redaction removes connection strings", () => {
  const redacted = redactSensitiveText(FIXTURE_CONNECTION_URI_WITH_PORT);

  assert.equal(redacted, "[REDACTED_DATABASE_URL]");
});

test("failure formatter returns structured redacted output", () => {
  const output = formatRegistryBootstrapFailure(
    new RegistryBootstrapError(
      "REGISTRY_BOOTSTRAP_TRANSACTION_FAILED",
      `${FIXTURE_CONNECTION_URI} failed`,
    ),
  );
  const parsed = JSON.parse(output) as { finalStatus: string; message: string };

  assert.equal(parsed.finalStatus, "REGISTRY_BOOTSTRAP_TRANSACTION_FAILED");
  assert.match(parsed.message, /\[REDACTED_DATABASE_URL\]/);
  assert.equal(parsed.message.includes("secret"), false);
});

test("structured summary contains bootstrap counts and metadata", async () => {
  const store = new FakeRegistryBootstrapStore(
    buildCompleteMetadata({ databaseName: "stagingdb" }),
    buildEmptySnapshot(),
  );

  const summary = await executeRegistryBootstrap(buildInput(), store);

  assert.equal(summary.registryDefinitionsDiscovered.path, "runtime/data-runtime/src/runtime/runtime-configuration.ts");
  assert.equal(summary.registryDefinitionsDiscovered.total, 6);
  assert.equal(summary.schemaStatus.ready, true);
  assert.equal(summary.durationMs >= 0, true);
});

test("plan detects unchanged registry state", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const plan = createRegistryBootstrapPlan(definitions, {
    connector: structuredClone(definitions.connector),
    source: structuredClone(definitions.source),
    datasets: structuredClone(definitions.datasets),
    pipelines: structuredClone(definitions.pipelines),
  });

  assert.equal(plan.createCount, 0);
  assert.equal(plan.updateCount, 0);
  assert.equal(plan.unchangedCount, 6);
  assert.equal(plan.conflictCount, 0);
});

test("production accuracy-data key order drift is treated as unchanged", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const accuracyDataset = definitions.datasets.find((dataset) => dataset.code === "accuracy-data");

  assert.ok(accuracyDataset);
  assert.deepEqual(accuracyDataset.fetchConfigJson, {
    selectColumns: [
      "TARGET_DATE",
      "WARTOSC_RZECZYWISTA",
      "PROGNOZA_1M",
      "PROGNOZA_3M",
      "PROGNOZA_6M",
      "PROGNOZA_12M",
      "ROZNICA_1M",
      "ROZNICA_3M",
      "ROZNICA_6M",
      "ROZNICA_12M",
      "RODZAJ_BLEDU_1M",
      "RODZAJ_BLEDU_3M",
      "RODZAJ_BLEDU_6M",
      "RODZAJ_BLEDU_12M",
      "ORG_TABLE_NAME",
      "TABLE_NAME",
    ],
    orderBy: ["TABLE_NAME ASC", "TARGET_DATE ASC"],
  });

  const storedSnapshot = {
    connector: structuredClone(definitions.connector),
    source: structuredClone(definitions.source),
    datasets: definitions.datasets.map((dataset) => dataset.code === "accuracy-data"
      ? {
        ...structuredClone(dataset),
        fetchConfigJson: {
          orderBy: ["TABLE_NAME ASC", "TARGET_DATE ASC"],
          selectColumns: [
            "TARGET_DATE",
            "WARTOSC_RZECZYWISTA",
            "PROGNOZA_1M",
          ],
        },
      }
      : structuredClone(dataset)),
    pipelines: structuredClone(definitions.pipelines),
  } satisfies RegistrySnapshot;

  const canonicalDefinitions = {
    ...definitions,
    datasets: definitions.datasets.map((dataset) => dataset.code === "accuracy-data"
      ? {
        ...structuredClone(dataset),
        fetchConfigJson: {
          selectColumns: [
            "TARGET_DATE",
            "WARTOSC_RZECZYWISTA",
            "PROGNOZA_1M",
          ],
          orderBy: ["TABLE_NAME ASC", "TARGET_DATE ASC"],
        },
      }
      : structuredClone(dataset)),
  } satisfies CanonicalRegistryDefinitions;

  const plan = createRegistryBootstrapPlan(canonicalDefinitions, storedSnapshot);

  assert.equal(plan.createCount, 0);
  assert.equal(plan.updateCount, 0);
  assert.equal(plan.unchangedCount, 6);
  assert.equal(plan.conflictCount, 0);
  assert.deepEqual(plan.entries.filter((entry) => entry.action === "update"), []);
});

test("semantic JSON comparator ignores object key order", () => {
  assert.equal(
    areJsonValuesSemanticallyEqual(
      { a: 1, b: 2 },
      { b: 2, a: 1 },
    ),
    true,
  );
});

test("semantic JSON comparator ignores nested object key order", () => {
  assert.equal(
    areJsonValuesSemanticallyEqual(
      { outer: { a: 1, b: 2 } },
      { outer: { b: 2, a: 1 } },
    ),
    true,
  );
});

test("semantic JSON comparator preserves array order", () => {
  assert.equal(
    areJsonValuesSemanticallyEqual(
      ["a", "b"],
      ["b", "a"],
    ),
    false,
  );
});

test("semantic JSON comparator ignores object key order inside arrays", () => {
  assert.equal(
    areJsonValuesSemanticallyEqual(
      [{ a: 1, b: 2 }],
      [{ b: 2, a: 1 }],
    ),
    true,
  );
});

test("semantic JSON comparator detects array length changes", () => {
  assert.equal(
    areJsonValuesSemanticallyEqual(
      ["a"],
      ["a", "b"],
    ),
    false,
  );
});

test("semantic JSON comparator keeps null distinct from missing property", () => {
  assert.equal(
    areJsonValuesSemanticallyEqual(
      { a: null },
      {},
    ),
    false,
  );
});

test("semantic JSON comparator keeps null distinct from empty object", () => {
  assert.equal(
    areJsonValuesSemanticallyEqual(
      null,
      {},
    ),
    false,
  );
});

test("semantic JSON comparator keeps empty object distinct from empty array", () => {
  assert.equal(
    areJsonValuesSemanticallyEqual(
      {},
      [],
    ),
    false,
  );
});

test("semantic JSON comparator preserves primitive types", () => {
  assert.equal(areJsonValuesSemanticallyEqual(1, "1"), false);
  assert.equal(areJsonValuesSemanticallyEqual(false, 0), false);
  assert.equal(areJsonValuesSemanticallyEqual("", null), false);
});

test("semantic JSON comparator does not mutate inputs", () => {
  const left = {
    outer: {
      b: 2,
      a: [{ d: 4, c: 3 }],
    },
  };
  const right = {
    outer: {
      a: [{ c: 3, d: 4 }],
      b: 2,
    },
  };
  const leftBefore = structuredClone(left);
  const rightBefore = structuredClone(right);

  assert.equal(areJsonValuesSemanticallyEqual(left, right), true);
  assert.deepEqual(left, leftBefore);
  assert.deepEqual(right, rightBefore);
});

test("changed selectColumns order still produces dataset update", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const plan = createRegistryBootstrapPlan(definitions, {
    connector: structuredClone(definitions.connector),
    source: structuredClone(definitions.source),
    datasets: definitions.datasets.map((dataset) => dataset.code === "accuracy-data"
      ? {
        ...structuredClone(dataset),
        fetchConfigJson: {
          selectColumns: [
            "PROGNOZA_1M",
            "WARTOSC_RZECZYWISTA",
            "TARGET_DATE",
          ],
          orderBy: ["TABLE_NAME ASC", "TARGET_DATE ASC"],
        },
      }
      : structuredClone(dataset)),
    pipelines: structuredClone(definitions.pipelines),
  });

  assert.equal(plan.createCount, 0);
  assert.equal(plan.updateCount, 1);
  assert.equal(plan.unchangedCount, 5);
  assert.equal(plan.conflictCount, 0);
  assert.deepEqual(plan.entries.filter((entry) => entry.action === "update"), [
    {
      entityType: "dataset",
      key: "market-indexes:accuracy-data",
      action: "update",
      details: {
        changedFields: ["fetchConfigJson"],
        fieldDiffs: [
          {
            field: "fetchConfigJson",
            before: "object(keys=2)",
            after: "object(keys=2)",
          },
        ],
      },
    },
  ]);
});

test("changed orderBy order still produces dataset update", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const plan = createRegistryBootstrapPlan(definitions, {
    connector: structuredClone(definitions.connector),
    source: structuredClone(definitions.source),
    datasets: definitions.datasets.map((dataset) => dataset.code === "accuracy-data"
      ? {
        ...structuredClone(dataset),
        fetchConfigJson: {
          selectColumns: [
            "TARGET_DATE",
            "WARTOSC_RZECZYWISTA",
            "PROGNOZA_1M",
          ],
          orderBy: ["TARGET_DATE ASC", "TABLE_NAME ASC"],
        },
      }
      : structuredClone(dataset)),
    pipelines: structuredClone(definitions.pipelines),
  });

  assert.equal(plan.updateCount, 1);
  assert.deepEqual(plan.entries.filter((entry) => entry.action === "update"), [
    {
      entityType: "dataset",
      key: "market-indexes:accuracy-data",
      action: "update",
      details: {
        changedFields: ["fetchConfigJson"],
        fieldDiffs: [
          {
            field: "fetchConfigJson",
            before: "object(keys=2)",
            after: "object(keys=2)",
          },
        ],
      },
    },
  ]);
});

test("missing orderBy still produces dataset update", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const plan = createRegistryBootstrapPlan(definitions, {
    connector: structuredClone(definitions.connector),
    source: structuredClone(definitions.source),
    datasets: definitions.datasets.map((dataset) => dataset.code === "accuracy-data"
      ? {
        ...structuredClone(dataset),
        fetchConfigJson: {
          selectColumns: [
            "TARGET_DATE",
            "WARTOSC_RZECZYWISTA",
            "PROGNOZA_1M",
          ],
        },
      }
      : structuredClone(dataset)),
    pipelines: structuredClone(definitions.pipelines),
  });

  assert.equal(plan.updateCount, 1);
});

test("null orderBy still produces dataset update", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const plan = createRegistryBootstrapPlan(definitions, {
    connector: structuredClone(definitions.connector),
    source: structuredClone(definitions.source),
    datasets: definitions.datasets.map((dataset) => dataset.code === "accuracy-data"
      ? {
        ...structuredClone(dataset),
        fetchConfigJson: {
          selectColumns: [
            "TARGET_DATE",
            "WARTOSC_RZECZYWISTA",
            "PROGNOZA_1M",
          ],
          orderBy: null,
        },
      }
      : structuredClone(dataset)),
    pipelines: structuredClone(definitions.pipelines),
  });

  assert.equal(plan.updateCount, 1);
});

test("extra fetchConfigJson property still produces dataset update", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const plan = createRegistryBootstrapPlan(definitions, {
    connector: structuredClone(definitions.connector),
    source: structuredClone(definitions.source),
    datasets: definitions.datasets.map((dataset) => dataset.code === "accuracy-data"
      ? {
        ...structuredClone(dataset),
        fetchConfigJson: {
          selectColumns: [
            "TARGET_DATE",
            "WARTOSC_RZECZYWISTA",
            "PROGNOZA_1M",
          ],
          orderBy: ["TABLE_NAME ASC", "TARGET_DATE ASC"],
          extra: true,
        },
      }
      : structuredClone(dataset)),
    pipelines: structuredClone(definitions.pipelines),
  });

  assert.equal(plan.updateCount, 1);
});

test("nested object key reorder inside JSON does not produce update", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const nestedDefinitions = {
    ...definitions,
    connector: {
      ...structuredClone(definitions.connector),
      configJson: {
        nested: {
          first: 1,
          second: 2,
        },
      },
    },
  } satisfies CanonicalRegistryDefinitions;
  const plan = createRegistryBootstrapPlan(nestedDefinitions, {
    connector: {
      ...structuredClone(nestedDefinitions.connector),
      configJson: {
        nested: {
          second: 2,
          first: 1,
        },
      },
    },
    source: structuredClone(nestedDefinitions.source),
    datasets: structuredClone(nestedDefinitions.datasets),
    pipelines: structuredClone(nestedDefinitions.pipelines),
  });

  assert.equal(plan.updateCount, 0);
  assert.equal(plan.unchangedCount, 6);
});

test("full production-style snapshot with reordered JSON keys yields six unchanged", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const plan = createRegistryBootstrapPlan(definitions, {
    connector: structuredClone(definitions.connector),
    source: {
      ...structuredClone(definitions.source),
      configJson: reverseObjectKeys(structuredClone(definitions.source.configJson) as Prisma.JsonObject),
    },
    datasets: definitions.datasets.map((dataset) => dataset.code === "accuracy-data"
      ? {
        ...structuredClone(dataset),
        fetchConfigJson: reverseObjectKeys(structuredClone(dataset.fetchConfigJson) as Prisma.JsonObject),
      }
      : structuredClone(dataset)),
    pipelines: definitions.pipelines.map((pipeline) => ({
      ...structuredClone(pipeline),
      configJson: reverseObjectKeys(structuredClone(pipeline.configJson) as Prisma.JsonObject),
    })),
  });

  assert.equal(plan.createCount, 0);
  assert.equal(plan.updateCount, 0);
  assert.equal(plan.unchangedCount, 6);
  assert.equal(plan.conflictCount, 0);
});

test("apply blocks when source parent relationship conflicts", async () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const store = new FakeRegistryBootstrapStore(
    buildCompleteMetadata({ databaseName: "stagingdb" }),
    {
      connector: structuredClone(definitions.connector),
      source: {
        ...structuredClone(definitions.source),
        connectorCode: "legacy-connector",
      },
      datasets: structuredClone(definitions.datasets),
      pipelines: structuredClone(definitions.pipelines),
    },
  );

  const error = await assertBootstrapError(
    executeRegistryBootstrap(buildInput({}, "apply"), store),
    "REGISTRY_BOOTSTRAP_CONFLICTS_DETECTED",
  );

  assert.equal(store.applyCalls, 0);
  assert.match(JSON.stringify(error.details), /PARENT_RELATIONSHIP_MISMATCH/);
});

test("plan detects target store mismatch as conflict", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const plan = createRegistryBootstrapPlan(definitions, {
    connector: structuredClone(definitions.connector),
    source: structuredClone(definitions.source),
    datasets: structuredClone(definitions.datasets),
    pipelines: definitions.pipelines.map((pipeline, index) => index === 0
      ? { ...structuredClone(pipeline), targetStore: "FORECAST_ACCURACY" }
      : structuredClone(pipeline)),
  });

  assert.equal(plan.conflictCount, 1);
  assert.equal(plan.entries.some((entry) => entry.conflictCode === "TARGET_STORE_MISMATCH"), true);
});

test("plan detects duplicate existing pipeline code across datasets", () => {
  const definitions = buildCanonicalRegistryDefinitions();
  const dashboardPipeline = definitions.pipelines[0];
  const forecastPipeline = definitions.pipelines[1];

  assert.ok(dashboardPipeline);
  assert.ok(forecastPipeline);

  const plan = createRegistryBootstrapPlan(definitions, {
    connector: structuredClone(definitions.connector),
    source: structuredClone(definitions.source),
    datasets: structuredClone(definitions.datasets),
    pipelines: [
      structuredClone(dashboardPipeline),
      {
        ...structuredClone(dashboardPipeline),
        datasetCode: forecastPipeline!.datasetCode,
      },
      structuredClone(forecastPipeline),
    ],
  });

  assert.equal(plan.conflictCount, 1);
  assert.equal(plan.entries.some((entry) => entry.conflictCode === "DUPLICATE_EXISTING_KEY"), true);
});

test("production verifier factory is null outside production", () => {
  const verifier = createRegistryBootstrapTargetIdentityVerifier(buildInput().environment);

  assert.equal(verifier, null);
});

test("production verifier uses canonical /api/v2 project route", async () => {
  const mocked = createMockedProductionVerifierTestContext((_request, url) => {

    if (url.pathname === "/api/v2/projects/rough-field-86336647") {
      return createJsonResponse({ project: { id: PRODUCTION_EXPECTED_NEON_PROJECT_ID } });
    }

    if (url.pathname === "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t/endpoints") {
      return createJsonResponse({ endpoints: [{ id: "ep-runtime-bootstrap", project_id: PRODUCTION_EXPECTED_NEON_PROJECT_ID, branch_id: PRODUCTION_EXPECTED_NEON_BRANCH_ID, host: "ep-runtime-bootstrap.us-east-2.aws.neon.tech" }] });
    }

    if (url.pathname === "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t") {
      return createJsonResponse({ branch: { id: PRODUCTION_EXPECTED_NEON_BRANCH_ID, project_id: PRODUCTION_EXPECTED_NEON_PROJECT_ID } });
    }

    if (url.pathname === "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t/databases") {
      return createJsonResponse({ databases: [{ name: PRODUCTION_EXPECTED_DATABASE_NAME, branch_id: PRODUCTION_EXPECTED_NEON_BRANCH_ID }] });
    }

    return createJsonResponse({ message: "not found" }, 404);
  });

  try {
    const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({
      apiKey: "test-token",
      apiBaseUrl: OFFICIAL_NEON_API_BASE_URL,
    });

    const identity = await verifier.verifyTargetIdentity({
      environment: buildInput({ environment: "PRODUCTION" }).environment,
      metadata: buildCompleteMetadata(),
    });

    assert.equal(identity.projectId, PRODUCTION_EXPECTED_NEON_PROJECT_ID);

    assert.deepEqual(mocked.calls[0], {
      method: "GET",
      pathname: "/api/v2/projects/rough-field-86336647",
    });

    assert.deepEqual(mocked.calls.map((call) => call.pathname), [
      "/api/v2/projects/rough-field-86336647",
      "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t/endpoints",
      "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t",
      "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t/databases",
    ]);

    assert.deepEqual(mocked.calls.map((call) => call.method), ["GET", "GET", "GET", "GET"]);
  } finally {
    mocked.restore();
  }
});

test("production verifier rejects custom production api origin before request", () => {
  assert.throws(
    () => createRegistryBootstrapTargetIdentityVerifier(buildInput({
      environment: "PRODUCTION",
      neonApiKey: "test-token",
      neonApiBaseUrl: "https://example.invalid/api/v2",
    }).environment),
    (error: unknown) => error instanceof RegistryBootstrapError && error.code === "PROVIDER_TARGET_IDENTITY_BASE_URL_INVALID",
  );
});

test("explicit DATA_RUNTIME_NEON_API_KEY wins over fallback NEON_API_KEY", () => {
  const environment = resolveRegistryBootstrapEnvironment({
    DATA_RUNTIME_ENV: "PRODUCTION",
    DATA_RUNTIME_ORGANIZATION_ID: "org-test",
    DATA_RUNTIME_NEON_API_KEY: "primary-token",
    NEON_API_KEY: "fallback-token",
  });

  assert.equal(environment.neonApiKey, "primary-token");
});

test("fallback NEON_API_KEY is used when dedicated key is absent", () => {
  const environment = resolveRegistryBootstrapEnvironment({
    DATA_RUNTIME_ENV: "PRODUCTION",
    DATA_RUNTIME_ORGANIZATION_ID: "org-test",
    NEON_API_KEY: "fallback-token",
  });

  assert.equal(environment.neonApiKey, "fallback-token");
});

test("project 404 is classified only at project lookup", async () => {
  const mocked = createMockedProductionVerifierTestContext(() => createJsonResponse({ message: "missing project" }, 404));

  try {
    const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({ apiKey: "test-token", apiBaseUrl: OFFICIAL_NEON_API_BASE_URL });
    const error = await assertBootstrapError(
      verifier.verifyTargetIdentity({ environment: buildInput({ environment: "PRODUCTION" }).environment, metadata: buildCompleteMetadata() }),
      "PROVIDER_TARGET_IDENTITY_PROJECT_NOT_FOUND",
    );

    assert.equal((error.details as Record<string, unknown>)["requestStage"], "PROJECT_LOOKUP");
    assert.equal((error.details as Record<string, unknown>)["resourceKind"], "project");
    assert.equal((error.details as Record<string, unknown>)["httpStatus"], 404);
    assert.equal((error.details as Record<string, unknown>)["providerErrorCode"], "PROVIDER_PROJECT_NOT_FOUND");
    assert.equal((error.details as Record<string, unknown>)["retryable"], false);
  } finally {
    mocked.restore();
  }
});

test("endpoint 404 is not misclassified as project not found", async () => {
  const mocked = createMockedProductionVerifierTestContext((_request, url) => {
    if (url.pathname === "/api/v2/projects/rough-field-86336647") {
      return createJsonResponse({ project: { id: PRODUCTION_EXPECTED_NEON_PROJECT_ID } });
    }

    if (url.pathname === "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t/endpoints") {
      return createJsonResponse({ message: "missing endpoint list" }, 404);
    }

    return createJsonResponse({ message: "unexpected" }, 500);
  });

  try {
    const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({ apiKey: "test-token", apiBaseUrl: OFFICIAL_NEON_API_BASE_URL });
    const error = await assertBootstrapError(
      verifier.verifyTargetIdentity({ environment: buildInput({ environment: "PRODUCTION" }).environment, metadata: buildCompleteMetadata() }),
      "PROVIDER_TARGET_IDENTITY_ENDPOINT_NOT_FOUND",
    );

    assert.equal((error.details as Record<string, unknown>)["requestStage"], "ENDPOINT_LOOKUP");
    assert.equal((error.details as Record<string, unknown>)["resourceKind"], "endpoint");
    assert.equal((error.details as Record<string, unknown>)["httpStatus"], 404);
    assert.equal((error.details as Record<string, unknown>)["providerErrorCode"], "PROVIDER_ENDPOINT_NOT_FOUND");
    assert.equal((error.details as Record<string, unknown>)["retryable"], false);
  } finally {
    mocked.restore();
  }
});

test("branch 404 is classified as branch-specific failure", async () => {
  const mocked = createMockedProductionVerifierTestContext((_request, url) => {
    if (url.pathname === "/api/v2/projects/rough-field-86336647") {
      return createJsonResponse({ project: { id: PRODUCTION_EXPECTED_NEON_PROJECT_ID } });
    }

    if (url.pathname === "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t/endpoints") {
      return createJsonResponse({ endpoints: [] });
    }

    if (url.pathname === "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t") {
      return createJsonResponse({ message: "missing branch" }, 404);
    }

    return createJsonResponse({ message: "unexpected" }, 500);
  });

  try {
    const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({ apiKey: "test-token", apiBaseUrl: OFFICIAL_NEON_API_BASE_URL });
    const error = await assertBootstrapError(
      verifier.verifyTargetIdentity({ environment: buildInput({ environment: "PRODUCTION" }).environment, metadata: buildCompleteMetadata() }),
      "PROVIDER_TARGET_IDENTITY_BRANCH_NOT_FOUND",
    );

    assert.equal((error.details as Record<string, unknown>)["requestStage"], "BRANCH_LOOKUP");
    assert.equal((error.details as Record<string, unknown>)["resourceKind"], "branch");
    assert.equal((error.details as Record<string, unknown>)["httpStatus"], 404);
    assert.equal((error.details as Record<string, unknown>)["providerErrorCode"], "PROVIDER_BRANCH_NOT_FOUND");
    assert.equal((error.details as Record<string, unknown>)["retryable"], false);
  } finally {
    mocked.restore();
  }
});

test("database absence is classified as database-specific failure", async () => {
  const mocked = createMockedProductionVerifierTestContext((_request, url) => {
    if (url.pathname === "/api/v2/projects/rough-field-86336647") {
      return createJsonResponse({ project: { id: PRODUCTION_EXPECTED_NEON_PROJECT_ID } });
    }

    if (url.pathname === "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t/endpoints") {
      return createJsonResponse({ endpoints: [{ id: "ep-runtime-bootstrap", project_id: PRODUCTION_EXPECTED_NEON_PROJECT_ID, branch_id: PRODUCTION_EXPECTED_NEON_BRANCH_ID, host: "ep-runtime-bootstrap.us-east-2.aws.neon.tech" }] });
    }

    if (url.pathname === "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t") {
      return createJsonResponse({ branch: { id: PRODUCTION_EXPECTED_NEON_BRANCH_ID, project_id: PRODUCTION_EXPECTED_NEON_PROJECT_ID } });
    }

    if (url.pathname === "/api/v2/projects/rough-field-86336647/branches/br-crimson-moon-asiphd7t/databases") {
      return createJsonResponse({ databases: [{ name: "otherdb", branch_id: PRODUCTION_EXPECTED_NEON_BRANCH_ID }] });
    }

    return createJsonResponse({ message: "unexpected" }, 500);
  });

  try {
    const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({ apiKey: "test-token", apiBaseUrl: OFFICIAL_NEON_API_BASE_URL });
    const error = await assertBootstrapError(
      verifier.verifyTargetIdentity({ environment: buildInput({ environment: "PRODUCTION" }).environment, metadata: buildCompleteMetadata() }),
      "PROVIDER_TARGET_IDENTITY_DATABASE_NOT_FOUND",
    );

    assert.equal((error.details as Record<string, unknown>)["requestStage"], "DATABASE_LOOKUP");
    assert.equal((error.details as Record<string, unknown>)["providerErrorCode"], "PROVIDER_DATABASE_NOT_FOUND");
  } finally {
    mocked.restore();
  }
});

test("401 fails closed with structured diagnostics", async () => {
  const mocked = createMockedProductionVerifierTestContext(() => createJsonResponse({ message: "Bearer secret-token" }, 401));

  try {
    const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({ apiKey: "test-token", apiBaseUrl: OFFICIAL_NEON_API_BASE_URL });
    const error = await assertBootstrapError(
      verifier.verifyTargetIdentity({ environment: buildInput({ environment: "PRODUCTION" }).environment, metadata: buildCompleteMetadata() }),
      "PROVIDER_TARGET_IDENTITY_CREDENTIAL_INVALID",
    );

    assert.equal(error.message.includes("secret-token"), false);
    assert.equal(error.message.includes("Authorization"), false);
    assert.equal((error.details as Record<string, unknown>)["httpStatus"], 401);
  } finally {
    mocked.restore();
  }
});

test("403, 429, and 500 fail closed with correct retryability", async () => {
  const scenarios = [
    { status: 403, code: "PROVIDER_TARGET_IDENTITY_ACCESS_DENIED", retryable: false },
    { status: 429, code: "PROVIDER_TARGET_IDENTITY_RATE_LIMITED", retryable: true },
    { status: 500, code: "PROVIDER_TARGET_IDENTITY_VERIFICATION_FAILED", retryable: true },
  ] as const;

  for (const scenario of scenarios) {
    const mocked = createMockedProductionVerifierTestContext(() => createJsonResponse({ message: "request failed" }, scenario.status));

    try {
      const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({ apiKey: "test-token", apiBaseUrl: OFFICIAL_NEON_API_BASE_URL });
      const error = await assertBootstrapError(
        verifier.verifyTargetIdentity({ environment: buildInput({ environment: "PRODUCTION" }).environment, metadata: buildCompleteMetadata() }),
        scenario.code,
      );

      assert.equal((error.details as Record<string, unknown>)["retryable"], scenario.retryable);
    } finally {
      mocked.restore();
    }
  }
});

test("network failure fails closed with no raw provider response", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;

  try {
    const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({ apiKey: "test-token", apiBaseUrl: OFFICIAL_NEON_API_BASE_URL });
    const error = await assertBootstrapError(
      verifier.verifyTargetIdentity({ environment: buildInput({ environment: "PRODUCTION" }).environment, metadata: buildCompleteMetadata() }),
      "PROVIDER_TARGET_IDENTITY_NETWORK_ERROR",
    );

    assert.equal(error.message.includes("fetch failed"), false);
    assert.equal((error.details as Record<string, unknown>)["requestStage"], "PROJECT_LOOKUP");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("malformed json and missing expected response field fail closed", async () => {
  {
    const mocked = createMockedProductionVerifierTestContext(() => createTextResponse("{", 200));

    try {
      const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({ apiKey: "test-token", apiBaseUrl: OFFICIAL_NEON_API_BASE_URL });
      await assertBootstrapError(
        verifier.verifyTargetIdentity({ environment: buildInput({ environment: "PRODUCTION" }).environment, metadata: buildCompleteMetadata() }),
        "PROVIDER_TARGET_IDENTITY_MALFORMED_RESPONSE",
      );
    } finally {
      mocked.restore();
    }
  }

  {
    const mocked = createMockedProductionVerifierTestContext(() => createJsonResponse({ project: {} }, 200));

    try {
      const verifier = new NeonRegistryBootstrapTargetIdentityVerifier({ apiKey: "test-token", apiBaseUrl: OFFICIAL_NEON_API_BASE_URL });
      const error = await assertBootstrapError(
        verifier.verifyTargetIdentity({ environment: buildInput({ environment: "PRODUCTION" }).environment, metadata: buildCompleteMetadata() }),
        "PROVIDER_TARGET_IDENTITY_MALFORMED_RESPONSE",
      );

      assert.equal((error.details as Record<string, unknown>)["requestStage"], "PROJECT_LOOKUP");
    } finally {
      mocked.restore();
    }
  }
});