import assert from "node:assert/strict";
import test from "node:test";

import { createExecutionContext, type ExecutionContext, type PipelineStageName } from "./execution-context.ts";
import { abortExecutionLease } from "./execution-lease.ts";
import type { PersistedExecutionLease } from "./execution-lease.ts";
import { LeaseLostError } from "./execution-lease.ts";
import { DefaultHydrationExecutionLifecycle, deriveRunTerminalStatus } from "./execution-lifecycle.ts";
import { HydrationFailureFinalizationError } from "./hydration-execution-error.ts";
import { PipelineExecutor } from "./pipeline-runner.ts";
import type { PipelineStage } from "./pipeline-stage.ts";
import type {
  CreateRunningLifecycleInput,
  ExecutionLifecycleStore,
  PersistTerminalLifecycleInput,
  RecoverStaleExecutionApplyInput,
  RecoverStaleExecutionApplyResult,
  StaleExecutionQueryInput,
  StaleExecutionRecord,
} from "./persistence/execution-lifecycle-store.ts";
import { ensureRuntimeLifecycle, type RuntimeState } from "./runtime-state.ts";
import { ComposedPipelineStage } from "./stages/composed-stage.ts";

interface PersistedLifecycleSnapshot {
  runStatus: string | null;
  datasetStatus: string | null;
  completedAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  failedStage: string | null;
}

class FakeLifecycleStore implements ExecutionLifecycleStore {
  public run: PersistedLifecycleSnapshot = emptyLifecycleSnapshot();
  public dataset: PersistedLifecycleSnapshot = emptyLifecycleSnapshot();
  public successFinalizationCalls = 0;
  public failureFinalizationCalls = 0;
  public targetWriteCount = 0;
  public watermarkWriteCount = 0;
  public failFailureFinalization = false;
  public activeLease = true;

  async getDatabaseNow(): Promise<Date> {
    return new Date("2026-07-22T10:00:00.000Z");
  }

  async createRunningLifecycle(_input: CreateRunningLifecycleInput) {
    return {
      run: { id: "run-1" },
      runDataset: { id: "run-dataset-1" },
      executionLease: _input.executionLease
        ? {
            ownerId: _input.executionLease.ownerId,
            tokenHash: _input.executionLease.tokenHash,
            epoch: BigInt(1),
            acquiredAt: new Date("2026-07-22T10:00:00.000Z"),
            heartbeatAt: new Date("2026-07-22T10:00:00.000Z"),
            expiresAt: new Date("2026-07-22T10:02:00.000Z"),
            releasedAt: null,
          }
        : null,
    } as never;
  }

  async persistTerminalLifecycle(input: PersistTerminalLifecycleInput) {
    if (this.failFailureFinalization && input.runStatus === "FAILED") {
      throw new Error("failure finalization persistence exploded");
    }

    if (input.runStatus === "SUCCEEDED") {
      this.successFinalizationCalls += 1;
    }

    if (input.runStatus === "FAILED") {
      this.failureFinalizationCalls += 1;
    }

    this.run = {
      runStatus: input.runStatus,
      datasetStatus: null,
      completedAt: input.runCompletedAt,
      failedAt: input.runFailedAt,
      errorMessage: input.runErrorMessage,
      failedStage: extractFailedStage(input),
    };

    this.dataset = {
      runStatus: null,
      datasetStatus: input.runDatasetStatus,
      completedAt: input.runDatasetCompletedAt,
      failedAt: input.runFailedAt,
      errorMessage: input.runDatasetErrorMessage,
      failedStage: extractFailedStage(input),
    };

    return {
      run: { id: input.runId },
      runDataset: { id: input.runDatasetId },
      executionLease: null,
    } as never;
  }

  async renewRunningLease(): Promise<PersistedExecutionLease> {
    throw new Error("Not used in pipeline runner tests.");
  }

  async assertActiveRunLease(): Promise<boolean> {
    return this.activeLease;
  }

  async listStaleRunningExecutions(_input: StaleExecutionQueryInput): Promise<StaleExecutionRecord[]> {
    return [];
  }

  async recoverStaleExecutionApply(_input: RecoverStaleExecutionApplyInput): Promise<RecoverStaleExecutionApplyResult> {
    throw new Error("Not used in pipeline runner tests.");
  }

  async disconnect(): Promise<void> {
    return;
  }
}

function extractFailedStage(input: PersistTerminalLifecycleInput): string | null {
  const lifecycle = input.statsJson && typeof input.statsJson === "object" && !Array.isArray(input.statsJson)
    ? (input.statsJson as Record<string, unknown>)["lifecycle"]
    : null;

  if (lifecycle && typeof lifecycle === "object" && !Array.isArray(lifecycle)) {
    const failedStage = (lifecycle as Record<string, unknown>)["failedStage"];
    return typeof failedStage === "string" ? failedStage : null;
  }

  return null;
}

function emptyLifecycleSnapshot(): PersistedLifecycleSnapshot {
  return {
    runStatus: null,
    datasetStatus: null,
    completedAt: null,
    failedAt: null,
    errorMessage: null,
    failedStage: null,
  };
}

function createTestExecutionContext(): ExecutionContext {
  return createExecutionContext({
    action: "run-pipeline",
    source: "market-indexes",
    pipeline: "dashboard",
    mode: "full",
    environment: {
      environment: "STAGING",
      organizationId: "org-test",
      databaseUrl: null,
      directUrl: null,
    },
    organizationId: "org-test",
    triggeredBy: "test:pipeline-runner",
    runMode: "MANUAL",
    replayOfRunId: null,
  });
}

function createLifecycleSeedStage(store: FakeLifecycleStore): PipelineStage {
  return new ComposedPipelineStage("registry", {
    resolver: {
      stage: "registry",
      resolve(_context, state) {
        ensureRuntimeLifecycle(state, new Date("2026-07-22T10:00:00.000Z"));
        state.runDatasetId = "run-dataset-1";
        state.resolvedConfiguration = {
          connector: { code: "snowflake", kind: "snowflake", name: "Snowflake" },
          source: {
            id: "source-1",
            code: "market-indexes",
            name: "Market Indexes",
            connectorCode: "snowflake",
            datasetCodes: ["index-data"],
            pipelineCodes: ["dashboard"],
          },
          dataset: {
            id: "dataset-1",
            code: "index-data",
            name: "Index Data",
            sourceCode: "market-indexes",
            datasetType: "BUSINESS",
            sourceDatabase: "PROFITIA_DWH",
            sourceSchema: "PUBLIC",
            sourceObject: "INDEX_DATA",
            watermarkColumn: "sourceUpdatedAt",
            watermarkType: "TIMESTAMP",
            fetchConfig: null,
            pipelineCodes: ["dashboard"],
          },
          pipeline: {
            id: "pipeline-1",
            code: "dashboard",
            name: "Dashboard",
            targetStore: "DASHBOARD_INDEX",
            configFingerprint: "cfg-1",
            version: "1.0.0",
            datasetCodes: ["index-data"],
          },
        } as RuntimeState["resolvedConfiguration"];
        state.runStatsJson = { sourceCode: "market-indexes", datasetCode: "index-data", pipelineCode: "dashboard" };
      },
    },
    engine: {
      stage: "registry",
      run() {
        return;
      },
    },
    writer: {
      stage: "registry",
      write() {
        void store;
      },
    },
  });
}

function createThrowingStage(
  stage: PipelineStageName,
  error: Error,
  hooks: {
    beforeThrow?: (state: RuntimeState, store: FakeLifecycleStore) => void;
  } = {},
  store?: FakeLifecycleStore,
): PipelineStage {
  return new ComposedPipelineStage(stage, {
    resolver: {
      stage,
      resolve() {
        return;
      },
    },
    engine: {
      stage,
      run(_context, state) {
        hooks.beforeThrow?.(state, store!);
        throw error;
      },
    },
    writer: {
      stage,
      write() {
        return;
      },
    },
  });
}

function createSuccessStage(stage: PipelineStageName, store: FakeLifecycleStore): PipelineStage {
  return new ComposedPipelineStage(stage, {
    resolver: {
      stage,
      resolve() {
        return;
      },
    },
    engine: {
      stage,
      run() {
        return;
      },
    },
    writer: {
      stage,
      write(_context, state) {
        state.rowsWrittenDashboard = 1;
        state.watermarkAfter = state.watermarkValue;
        void store;
      },
    },
  });
}

test("finalizes run and dataset as FAILED when a later stage throws", async () => {
  const store = new FakeLifecycleStore();
  let observedState: RuntimeState | null = null;
  const error = new Error("postgresql://runtime:secret@example.invalid/neondb stage failure");
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, { now: () => new Date("2026-07-22T10:10:00.000Z") });

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createThrowingStage(
      "mapping",
      error,
      {
        beforeThrow(state) {
          observedState = state;
        },
      },
      store,
    ),
  ], lifecycle);

  await assert.rejects(() => executor.execute(createTestExecutionContext()), error);

  assert.ok(observedState);
  const state = observedState as RuntimeState;
  assert.equal(state.currentStage, "mapping");
  assert.equal(store.successFinalizationCalls, 0);
  assert.equal(store.failureFinalizationCalls, 1);

  assert.equal(store.dataset.datasetStatus, "FAILED");
  assert.equal(store.run.runStatus, "FAILED");
  assert.equal(store.run.failedStage, "mapping");
  assert.match(store.run.errorMessage ?? "", /stage failure/i);
  assert.ok(store.run.completedAt instanceof Date);
});

test("does not report SUCCEEDED when failure happens after target write and before watermark success", async () => {
  const store = new FakeLifecycleStore();
  let observedState: RuntimeState | null = null;
  const error = new Error("Authorization: Bearer top-secret-token watermark write failed");
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, { now: () => new Date("2026-07-22T10:11:00.000Z") });

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createThrowingStage(
      "dashboard-store",
      error,
      {
        beforeThrow(state, lifecycleStore) {
          observedState = state;
          lifecycleStore.targetWriteCount += 1;
          state.rowsWrittenDashboard = 1;
        },
      },
      store,
    ),
  ], lifecycle);

  await assert.rejects(() => executor.execute(createTestExecutionContext()), error);

  assert.ok(observedState);
  assert.equal(store.targetWriteCount, 1);
  assert.equal(store.watermarkWriteCount, 0);
  assert.equal(store.run.runStatus, "FAILED");
  assert.equal(store.dataset.datasetStatus, "FAILED");
  assert.equal(store.successFinalizationCalls, 0);
  assert.equal(store.failureFinalizationCalls, 1);
  assert.doesNotMatch(store.run.errorMessage ?? "", /top-secret-token/i);
});

test("persists FAILED when connector stage throws after lifecycle was durably created", async () => {
  const store = new FakeLifecycleStore();
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, { now: () => new Date("2026-07-22T10:13:00.000Z") });
  const error = new Error("connector probe timed out");

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createThrowingStage("connector", error, {}, store),
  ], lifecycle);

  await assert.rejects(() => executor.execute(createTestExecutionContext()), error);

  assert.equal(store.run.runStatus, "FAILED");
  assert.equal(store.dataset.datasetStatus, "FAILED");
  assert.equal(store.run.failedStage, "connector");
});

test("keeps watermark unchanged when raw persistence fails", async () => {
  const store = new FakeLifecycleStore();
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, { now: () => new Date("2026-07-22T10:14:00.000Z") });
  const error = new Error("raw batch insert failed");

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createSuccessStage("connector", store),
    createThrowingStage("raw", error, {}, store),
  ], lifecycle);

  await assert.rejects(() => executor.execute(createTestExecutionContext()), error);

  assert.equal(store.run.runStatus, "FAILED");
  assert.equal(store.dataset.datasetStatus, "FAILED");
  assert.equal(store.watermarkWriteCount, 0);
});

test("does not invoke target write when mapping fails", async () => {
  const store = new FakeLifecycleStore();
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, { now: () => new Date("2026-07-22T10:15:00.000Z") });
  const error = new Error("mapping failed due to invalid targetDate");

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createSuccessStage("connector", store),
    createThrowingStage("mapping", error, {}, store),
  ], lifecycle);

  await assert.rejects(() => executor.execute(createTestExecutionContext()), error);

  assert.equal(store.targetWriteCount, 0);
  assert.equal(store.watermarkWriteCount, 0);
});

test("persists FAILED when target persistence throws", async () => {
  const store = new FakeLifecycleStore();
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, { now: () => new Date("2026-07-22T10:16:00.000Z") });
  const error = new Error("dashboard upsert failed");

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createThrowingStage(
      "dashboard-store",
      error,
      {
        beforeThrow(_state, lifecycleStore) {
          lifecycleStore.targetWriteCount += 1;
        },
      },
      store,
    ),
  ], lifecycle);

  await assert.rejects(() => executor.execute(createTestExecutionContext()), error);

  assert.equal(store.targetWriteCount, 1);
  assert.equal(store.run.runStatus, "FAILED");
});

test("finalizes run and dataset as SUCCEEDED exactly once after all stages succeed", async () => {
  const store = new FakeLifecycleStore();
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, { now: () => new Date("2026-07-22T10:12:00.000Z") });

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createSuccessStage("connector", store),
  ], lifecycle);

  const result = await executor.execute(createTestExecutionContext());

  assert.equal(result.state.runStatus, "SUCCEEDED");
  assert.equal(result.state.runDatasetStatus, "SUCCEEDED");
  assert.equal(store.successFinalizationCalls, 1);
  assert.equal(store.failureFinalizationCalls, 0);
  assert.ok(store.run.completedAt instanceof Date);
  assert.equal(store.run.errorMessage, null);
});

test("stops the run with LeaseLostError before success finalization when authority is lost", async () => {
  const store = new FakeLifecycleStore();
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, {
    now: () => new Date("2026-07-22T10:12:00.000Z"),
    leaseConfig: {
      enabled: true,
      recoveryApplyEnabled: false,
      heartbeatIntervalMs: 30_000,
      leaseDurationMs: 120_000,
      recoveryGraceMs: 30_000,
      retryDelaysMs: [2_000, 5_000, 10_000],
      maxImmediateRetries: 3,
      leaseLossMarginMs: 15_000,
    },
  });

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createSuccessStage("connector", store),
    new ComposedPipelineStage("mapping", {
      resolver: {
        stage: "mapping",
        resolve() {
          return;
        },
      },
      engine: {
        stage: "mapping",
        run() {
          store.activeLease = false;
        },
      },
      writer: {
        stage: "mapping",
        write() {
          return;
        },
      },
    }),
  ], lifecycle);

  await assert.rejects(() => executor.execute(createTestExecutionContext()), LeaseLostError);
  assert.equal(store.successFinalizationCalls, 0);
  assert.equal(store.failureFinalizationCalls, 0);
});

test("propagates abort signal through a stage and blocks writer and next-stage continuation", async () => {
  const store = new FakeLifecycleStore();
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, {
    now: () => new Date("2026-07-22T10:12:30.000Z"),
    leaseConfig: {
      enabled: true,
      recoveryApplyEnabled: false,
      heartbeatIntervalMs: 30_000,
      leaseDurationMs: 120_000,
      recoveryGraceMs: 30_000,
      retryDelaysMs: [2_000, 5_000, 10_000],
      maxImmediateRetries: 3,
      leaseLossMarginMs: 15_000,
    },
  });
  let observedAbortSignal: AbortSignal | undefined;
  let writerStarted = false;
  let nextStageStarted = false;

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createSuccessStage("connector", store),
    new ComposedPipelineStage("mapping", {
      resolver: {
        stage: "mapping",
        resolve() {
          return;
        },
      },
      engine: {
        stage: "mapping",
        run(context, state) {
          observedAbortSignal = context.abortSignal;
          state.executionLease!.lost = true;
          abortExecutionLease(state.executionLease?.abortController);
        },
      },
      writer: {
        stage: "mapping",
        write() {
          writerStarted = true;
        },
      },
    }),
    new ComposedPipelineStage("normalization", {
      resolver: {
        stage: "normalization",
        resolve() {
          nextStageStarted = true;
        },
      },
      engine: {
        stage: "normalization",
        run() {
          return;
        },
      },
      writer: {
        stage: "normalization",
        write() {
          return;
        },
      },
    }),
  ], lifecycle);

  await assert.rejects(() => executor.execute(createTestExecutionContext()), LeaseLostError);
  assert.ok(observedAbortSignal);
  assert.equal(observedAbortSignal.aborted, true);
  assert.equal(writerStarted, false);
  assert.equal(nextStageStarted, false);
  assert.equal(store.successFinalizationCalls, 0);
  assert.equal(store.failureFinalizationCalls, 0);
});

test("surfaces FAILURE_FINALIZATION_FAILED when stage throws and failure finalization also fails", async () => {
  const store = new FakeLifecycleStore();
  store.failFailureFinalization = true;
  const lifecycle = new DefaultHydrationExecutionLifecycle(store, { now: () => new Date("2026-07-22T10:17:00.000Z") });
  const error = new Error("connector write exploded");

  const executor = new PipelineExecutor([
    createLifecycleSeedStage(store),
    createThrowingStage("connector", error, {}, store),
  ], lifecycle);

  await assert.rejects(
    () => executor.execute(createTestExecutionContext()),
    (caught) => caught instanceof HydrationFailureFinalizationError && caught.originalError === error,
  );

  assert.equal(store.successFinalizationCalls, 0);
});

test("derives PARTIAL for mixed dataset outcomes when schema already supports it", () => {
  assert.equal(deriveRunTerminalStatus(["SUCCEEDED", "FAILED"]), "PARTIAL");
  assert.equal(deriveRunTerminalStatus(["FAILED"]), "FAILED");
  assert.equal(deriveRunTerminalStatus(["SUCCEEDED", "SUCCEEDED"]), "SUCCEEDED");
});