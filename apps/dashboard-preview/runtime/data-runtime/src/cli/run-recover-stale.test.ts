import assert from "node:assert/strict";
import test from "node:test";

import type {
  CreateRunningLifecycleInput,
  ExecutionLifecycleStore,
  PersistTerminalLifecycleInput,
  PersistedLifecycleTransitionResult,
  RecoverStaleExecutionApplyInput,
  RecoverStaleExecutionApplyResult,
  StaleExecutionQueryInput,
  StaleExecutionRecord,
} from "../runtime/persistence/execution-lifecycle-store.ts";
import type { PersistedExecutionLease } from "../runtime/execution-lease.ts";
import {
  HYDRATION_STALE_RECOVERY_APPLY_NOT_AVAILABLE,
  RECOVERY_APPLY_CONFIRMATION_MISMATCH,
  RECOVERY_CONCURRENCY_CONFLICT,
  runRecoverStaleCli,
} from "./recover-stale-cli.ts";
import { main } from "./run-recover-stale.ts";

class FakeRecoveryCliStore implements ExecutionLifecycleStore {
  public listCalls: StaleExecutionQueryInput[] = [];
  public applyCalls: RecoverStaleExecutionApplyInput[] = [];
  public applyResult: RecoverStaleExecutionApplyResult | null = null;
  public applyError: Error | null = null;
  public databaseNow = new Date("2026-07-22T12:00:00.000Z");

  constructor(private readonly records: StaleExecutionRecord[] = []) {}

  async getDatabaseNow(): Promise<Date> {
    return this.databaseNow;
  }

  async createRunningLifecycle(_: CreateRunningLifecycleInput): Promise<PersistedLifecycleTransitionResult> {
    throw new Error("Not used in CLI tests.");
  }

  async persistTerminalLifecycle(_: PersistTerminalLifecycleInput): Promise<PersistedLifecycleTransitionResult> {
    throw new Error("CLI recovery scope is read-only and must not mutate lifecycle state.");
  }

  async renewRunningLease(): Promise<PersistedExecutionLease> {
    throw new Error("Not used in CLI tests.");
  }

  async assertActiveRunLease(): Promise<boolean> {
    throw new Error("Not used in CLI tests.");
  }

  async listStaleRunningExecutions(input: StaleExecutionQueryInput): Promise<StaleExecutionRecord[]> {
    this.listCalls.push(input);
    return this.records;
  }

  async recoverStaleExecutionApply(input: RecoverStaleExecutionApplyInput): Promise<RecoverStaleExecutionApplyResult> {
    this.applyCalls.push(input);

    if (this.applyError) {
      throw this.applyError;
    }

    if (!this.applyResult) {
      throw new Error("No apply result configured.");
    }

    return this.applyResult;
  }

  async disconnect(): Promise<void> {
    return;
  }
}

function createDependencies(store: FakeRecoveryCliStore) {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    stdout,
    stderr,
    deps: {
      createStore: () => store,
      writeStdout: (line: string) => stdout.push(line),
      writeStderr: (line: string) => stderr.push(line),
    },
  };
}

const CONTROLLED_ENV_KEYS = [
  "DATA_RUNTIME_RECOVERY_APPLY_ENABLED",
  "ALLOW_STALE_HYDRATION_RECOVERY_APPLY",
  "ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS",
  "TEST_DATABASE_URL",
  "DATABASE_URL",
  "DIRECT_URL",
] as const;

type ControlledEnvKey = (typeof CONTROLLED_ENV_KEYS)[number];
type ControlledEnvOverrides = Partial<Record<ControlledEnvKey, string | null>>;

async function withControlledEnvironment<T>(
  overrides: ControlledEnvOverrides,
  run: () => Promise<T>,
): Promise<T> {
  const previous = new Map<ControlledEnvKey, string | undefined>();

  for (const key of CONTROLLED_ENV_KEYS) {
    previous.set(key, process.env[key]);

    if (!(key in overrides) || overrides[key] === null) {
      delete process.env[key];
      continue;
    }

    process.env[key] = overrides[key];
  }

  try {
    return await run();
  } finally {
    for (const key of CONTROLLED_ENV_KEYS) {
      const value = previous.get(key);

      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("valid plan-only arguments execute a read-only plan", async () => {
  const store = new FakeRecoveryCliStore([
    {
      runId: "run-1",
      runStatus: "RUNNING",
      runStartedAt: new Date("2026-07-22T10:00:00.000Z"),
      runCompletedAt: null,
      runFailedAt: null,
      leaseOwnerId: "worker-1",
      leaseTokenHashPresent: true,
      leaseEpoch: BigInt(1),
      leaseHeartbeatAt: new Date("2026-07-22T10:30:00.000Z"),
      leaseExpiresAt: new Date("2026-07-22T10:32:00.000Z"),
      leaseReleasedAt: null,
      recoveredAt: null,
      recoveryReasonCode: null,
      sourceCode: "market-indexes",
      pipelineCode: "dashboard",
      runDatasetId: "dataset-1",
      runDatasetStatus: "RUNNING",
      datasetCode: "index-data",
    },
  ]);
  const { stdout, stderr, deps } = createDependencies(store);

  const exitCode = await runRecoverStaleCli([
    "--organization-id",
    "profitia",
    "--stale-after-seconds",
    "3600",
  ], deps);

  assert.equal(exitCode, 0);
  assert.equal(store.listCalls.length, 1);
  assert.equal(stderr.length, 0);
  assert.equal(stdout.length, 1);
  assert.doesNotMatch(stdout[0] ?? "", /token|password|postgresql:\/\//i);
  assert.match(stdout[0] ?? "", /"mode":\s*"plan-only"/);
});

test("missing organization returns non-zero", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  const exitCode = await runRecoverStaleCli(["--stale-after-seconds", "3600"], deps);

  assert.equal(exitCode, 1);
  assert.equal(store.listCalls.length, 0);
  assert.match(stderr[0] ?? "", /requires --organization/i);
});

test("missing threshold returns non-zero", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  const exitCode = await runRecoverStaleCli(["--organization-id", "profitia"], deps);

  assert.equal(exitCode, 1);
  assert.equal(store.listCalls.length, 0);
  assert.match(stderr[0] ?? "", /requires --stale-after-seconds/i);
});

test("invalid threshold values return non-zero", async () => {
  for (const invalid of ["0", "-1", "NaN", "abc"]) {
    const store = new FakeRecoveryCliStore();
    const { stderr, deps } = createDependencies(store);

    const exitCode = await runRecoverStaleCli([
      "--organization-id",
      "profitia",
      "--stale-after-seconds",
      invalid,
    ], deps);

    assert.equal(exitCode, 1);
    assert.equal(store.listCalls.length, 0);
    assert.match(stderr[0] ?? "", /positive-number/i);
  }
});

test("apply argument is rejected without required feature gate", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  await withControlledEnvironment({}, async () => {
    const exitCode = await runRecoverStaleCli([
      "--organization-id",
      "profitia",
      "--stale-after-seconds",
      "3600",
      "--apply",
      "--run-id",
      "run-1",
      "--confirm-run-id",
      "run-1",
    ], deps);

    assert.equal(exitCode, 1);
    assert.equal(store.applyCalls.length, 0);
    assert.match(stderr[0] ?? "", new RegExp(HYDRATION_STALE_RECOVERY_APPLY_NOT_AVAILABLE));
  });
});

test("apply argument is rejected when primary recovery apply gate is false", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  await withControlledEnvironment({
    DATA_RUNTIME_RECOVERY_APPLY_ENABLED: "false",
    ALLOW_STALE_HYDRATION_RECOVERY_APPLY: "true",
  }, async () => {
    const exitCode = await runRecoverStaleCli([
      "--organization-id",
      "profitia",
      "--stale-after-seconds",
      "3600",
      "--apply",
      "--run-id",
      "run-1",
      "--confirm-run-id",
      "run-1",
    ], deps);

    assert.equal(exitCode, 1);
    assert.equal(store.applyCalls.length, 0);
    assert.match(stderr[0] ?? "", new RegExp(HYDRATION_STALE_RECOVERY_APPLY_NOT_AVAILABLE));
  });
});

test("apply argument is rejected when recovery safety gate is false", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  await withControlledEnvironment({
    DATA_RUNTIME_RECOVERY_APPLY_ENABLED: "true",
    ALLOW_STALE_HYDRATION_RECOVERY_APPLY: "false",
  }, async () => {
    const exitCode = await runRecoverStaleCli([
      "--organization-id",
      "profitia",
      "--stale-after-seconds",
      "3600",
      "--apply",
      "--run-id",
      "run-1",
      "--confirm-run-id",
      "run-1",
    ], deps);

    assert.equal(exitCode, 1);
    assert.equal(store.applyCalls.length, 0);
    assert.match(stderr[0] ?? "", new RegExp(HYDRATION_STALE_RECOVERY_APPLY_NOT_AVAILABLE));
  });
});

test("apply gate rejection is isolated from enabled parent feature gates", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  await withControlledEnvironment({
    DATA_RUNTIME_RECOVERY_APPLY_ENABLED: "true",
    ALLOW_STALE_HYDRATION_RECOVERY_APPLY: "true",
    ALLOW_LOCAL_DATA_RUNTIME_DB_TESTS: "true",
    TEST_DATABASE_URL: "postgresql://parent:test@127.0.0.1:5432/parent",
    DATABASE_URL: "postgresql://parent:test@127.0.0.1:5432/parent",
    DIRECT_URL: "postgresql://parent:test@127.0.0.1:5432/parent",
  }, async () => {
    await withControlledEnvironment({}, async () => {
      const exitCode = await runRecoverStaleCli([
        "--organization-id",
        "profitia",
        "--stale-after-seconds",
        "3600",
        "--apply",
        "--run-id",
        "run-1",
        "--confirm-run-id",
        "run-1",
      ], deps);

      assert.equal(exitCode, 1);
      assert.equal(store.applyCalls.length, 0);
      assert.match(stderr[0] ?? "", new RegExp(HYDRATION_STALE_RECOVERY_APPLY_NOT_AVAILABLE));
    });
  });
});

test("apply argument is rejected without explicit run confirmation", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  await withControlledEnvironment({
    DATA_RUNTIME_RECOVERY_APPLY_ENABLED: "true",
    ALLOW_STALE_HYDRATION_RECOVERY_APPLY: "true",
  }, async () => {
    const exitCode = await runRecoverStaleCli([
      "--organization-id",
      "profitia",
      "--stale-after-seconds",
      "3600",
      "--apply",
      "--run-id",
      "run-1",
    ], deps);

    assert.equal(exitCode, 1);
    assert.equal(store.applyCalls.length, 0);
    assert.match(stderr[0] ?? "", /requires --confirm-run-id/i);
  });
});

test("apply argument is rejected when explicit confirmation does not match run id", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  await withControlledEnvironment({
    DATA_RUNTIME_RECOVERY_APPLY_ENABLED: "true",
    ALLOW_STALE_HYDRATION_RECOVERY_APPLY: "true",
  }, async () => {
    const exitCode = await runRecoverStaleCli([
      "--organization-id",
      "profitia",
      "--stale-after-seconds",
      "3600",
      "--apply",
      "--run-id",
      "run-1",
      "--confirm-run-id",
      "run-2",
    ], deps);

    assert.equal(exitCode, 1);
    assert.equal(store.applyCalls.length, 0);
    assert.match(stderr[0] ?? "", new RegExp(RECOVERY_APPLY_CONFIRMATION_MISMATCH));
  });
});

test("unknown arguments are rejected", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  const exitCode = await runRecoverStaleCli([
    "--organization-id",
    "profitia",
    "--stale-after-seconds",
    "3600",
    "--unknown",
  ], deps);

  assert.equal(exitCode, 1);
  assert.equal(store.listCalls.length, 0);
  assert.match(stderr[0] ?? "", /Unknown argument/i);
});

test("safe plan output excludes sensitive fields", async () => {
  const store = new FakeRecoveryCliStore([
    {
      runId: "run-1",
      runStatus: "RUNNING",
      runStartedAt: new Date("2026-07-22T10:00:00.000Z"),
      runCompletedAt: null,
      runFailedAt: null,
      leaseOwnerId: "worker-1",
      leaseTokenHashPresent: true,
      leaseEpoch: BigInt(1),
      leaseHeartbeatAt: new Date("2026-07-22T10:30:00.000Z"),
      leaseExpiresAt: new Date("2026-07-22T10:32:00.000Z"),
      leaseReleasedAt: null,
      recoveredAt: null,
      recoveryReasonCode: null,
      sourceCode: "market-indexes",
      pipelineCode: "dashboard",
      runDatasetId: "dataset-1",
      runDatasetStatus: "RUNNING",
      datasetCode: "index-data",
    },
  ]);
  const { stdout, deps } = createDependencies(store);

  const exitCode = await runRecoverStaleCli([
    "--organization-id",
    "profitia",
    "--stale-after-seconds",
    "3600",
    "--limit",
    "1",
  ], deps);

  assert.equal(exitCode, 0);
  assert.equal(stdout.length, 1);
  assert.doesNotMatch(stdout[0] ?? "", /Authorization|Bearer|password|token|postgresql:\/\//i);
});

test("main returns non-zero for validation failures", async () => {
  const store = new FakeRecoveryCliStore();
  const { stderr, deps } = createDependencies(store);

  const exitCode = await main(["--organization-id", "profitia"], deps);

  assert.equal(exitCode, 1);
  assert.equal(store.listCalls.length, 0);
  assert.match(stderr[0] ?? "", /requires --stale-after-seconds/i);
});

test("main returns zero for successful read-only planning", async () => {
  const store = new FakeRecoveryCliStore();
  const { stdout, deps } = createDependencies(store);

  const exitCode = await main([
    "--organization-id",
    "profitia",
    "--stale-after-seconds",
    "3600",
  ], deps);

  assert.equal(exitCode, 0);
  assert.equal(store.listCalls.length, 1);
  assert.equal(stdout.length, 1);
});

test("apply executes single-run recovery when both gates are enabled", async () => {
  const store = new FakeRecoveryCliStore();
  store.applyResult = {
    run: {
      id: "run-1",
      status: "FAILED",
      recoveredAt: new Date("2026-07-22T12:30:00.000Z"),
      recoveryReasonCode: "STALE_HYDRATION_RECOVERY_APPLY",
    },
    runDatasets: [
      { id: "dataset-1", status: "FAILED" },
    ],
  } as never;
  const { stdout, stderr, deps } = createDependencies(store);

  await withControlledEnvironment({
    DATA_RUNTIME_RECOVERY_APPLY_ENABLED: "true",
    ALLOW_STALE_HYDRATION_RECOVERY_APPLY: "true",
  }, async () => {
    const exitCode = await runRecoverStaleCli([
      "--organization-id",
      "profitia",
      "--run-id",
      "run-1",
      "--confirm-run-id",
      "run-1",
      "--stale-after-seconds",
      "3600",
      "--apply",
    ], deps);

    assert.equal(exitCode, 0);
    assert.equal(stderr.length, 0);
    assert.equal(store.applyCalls.length, 1);
    assert.match(stdout[0] ?? "", /"mode":\s*"apply"/);
  });
});

test("apply surfaces recovery concurrency conflict on transactional rejection", async () => {
  const store = new FakeRecoveryCliStore();
  store.applyError = new Error("run no longer satisfies recovery preconditions");
  const { stderr, deps } = createDependencies(store);

  await withControlledEnvironment({
    DATA_RUNTIME_RECOVERY_APPLY_ENABLED: "true",
    ALLOW_STALE_HYDRATION_RECOVERY_APPLY: "true",
  }, async () => {
    const exitCode = await runRecoverStaleCli([
      "--organization-id",
      "profitia",
      "--run-id",
      "run-1",
      "--confirm-run-id",
      "run-1",
      "--stale-after-seconds",
      "3600",
      "--apply",
    ], deps);

    assert.equal(exitCode, 1);
    assert.equal(store.applyCalls.length, 1);
    assert.match(stderr[0] ?? "", new RegExp(RECOVERY_CONCURRENCY_CONFLICT));
  });
});