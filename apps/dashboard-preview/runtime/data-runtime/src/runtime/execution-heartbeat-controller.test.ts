import assert from "node:assert/strict";
import test from "node:test";

import {
  abortExecutionLease,
  LeaseLostError,
  resolveExecutionLeaseRuntimeConfig,
} from "./execution-lease.ts";
import { ExecutionHeartbeatController, type ExecutionHeartbeatTimerHandle } from "./execution-heartbeat-controller.ts";
import type { ExpectedExecutionLeaseInput } from "./persistence/execution-lifecycle-store.ts";
import { createRuntimeState, ensureRuntimeLifecycle } from "./runtime-state.ts";

class FakeHeartbeatStore {
  public renewCalls: Array<{
    runId: string;
    organizationId: string;
    expectedLease: ExpectedExecutionLeaseInput;
    leaseDurationMs: number;
  }> = [];
  public renewError: Error | null = null;

  async renewRunningLease(
    runId: string,
    organizationId: string,
    expectedLease: ExpectedExecutionLeaseInput,
    leaseDurationMs: number,
  ) {
    this.renewCalls.push({ runId, organizationId, expectedLease, leaseDurationMs });

    if (this.renewError) {
      throw this.renewError;
    }

    return {
      ownerId: expectedLease.ownerId,
      tokenHash: expectedLease.tokenHash,
      epoch: expectedLease.epoch,
      acquiredAt: new Date("2026-07-22T10:00:00.000Z"),
      heartbeatAt: new Date("2026-07-22T10:00:30.000Z"),
      expiresAt: new Date("2026-07-22T10:02:30.000Z"),
      releasedAt: null,
    };
  }
}

function createLeaseState() {
  const state = createRuntimeState({
    organizationId: "org-test",
    triggeredBy: "test:heartbeat",
    runMode: "MANUAL",
    replayOfRunId: null,
  });
  ensureRuntimeLifecycle(state, new Date("2026-07-22T10:00:00.000Z"));
  state.runId = "run-1";
  state.executionLease = {
    config: resolveExecutionLeaseRuntimeConfig(),
    ownerId: "worker-1",
    rawToken: Buffer.from("raw-token"),
    tokenHash: new Uint8Array([1, 2, 3, 4]),
    epoch: BigInt(1),
    acquiredAt: new Date("2026-07-22T10:00:00.000Z"),
    heartbeatAt: new Date("2026-07-22T10:00:00.000Z"),
    expiresAt: new Date("2026-07-22T10:02:00.000Z"),
    releasedAt: null,
    lost: false,
    abortController: new AbortController(),
  };

  return state;
}

test("heartbeat controller starts once and stops idempotently", () => {
  const store = new FakeHeartbeatStore();
  const state = createLeaseState();
  const intervalCallbacks: Array<() => void> = [];
  let clearCalls = 0;
  let unrefCalls = 0;

  const controller = new ExecutionHeartbeatController(store, resolveExecutionLeaseRuntimeConfig(), {
    setIntervalFn(callback): ExecutionHeartbeatTimerHandle {
      intervalCallbacks.push(callback);
      return {
        unref() {
          unrefCalls += 1;
        },
      };
    },
    clearIntervalFn() {
      clearCalls += 1;
    },
  });

  controller.start(state);
  controller.start(state);
  assert.equal(intervalCallbacks.length, 1);
  assert.equal(unrefCalls, 1);
  assert.equal(controller.currentState.running, true);

  controller.stop();
  controller.stop();
  assert.equal(clearCalls, 1);
  assert.equal(controller.currentState.running, false);
});

test("heartbeat controller renews lease without changing epoch", async () => {
  const store = new FakeHeartbeatStore();
  const state = createLeaseState();
  const controller = new ExecutionHeartbeatController(store, resolveExecutionLeaseRuntimeConfig());

  await controller.renewNow(state);

  assert.equal(store.renewCalls.length, 1);
  assert.equal(state.executionLease?.epoch, BigInt(1));
  assert.equal(state.executionLease?.heartbeatAt?.toISOString(), "2026-07-22T10:00:30.000Z");
  assert.equal(state.executionLease?.expiresAt?.toISOString(), "2026-07-22T10:02:30.000Z");
  assert.equal(state.executionLease?.lost, false);
});

test("heartbeat controller retries boundedly and emits lease-loss abort", async () => {
  const store = new FakeHeartbeatStore();
  store.renewError = new Error("temporary renewal failure");
  const state = createLeaseState();
  const delays: number[] = [];
  let leaseLossCount = 0;
  const controller = new ExecutionHeartbeatController(store, resolveExecutionLeaseRuntimeConfig(), {
    now: () => new Date("2026-07-22T10:00:00.000Z"),
    delayFn: async (ms) => {
      delays.push(ms);
    },
    onLeaseLost: (runtimeState) => {
      runtimeState.executionLease!.lost = true;
      abortExecutionLease(runtimeState.executionLease?.abortController);
      leaseLossCount += 1;
    },
  });

  await controller.renewNow(state);

  assert.deepEqual(delays, [2_000, 5_000, 10_000]);
  assert.equal(leaseLossCount, 1);
  assert.equal(state.executionLease?.lost, true);
  assert.equal(state.executionLease?.abortController?.signal.aborted, true);
  assert.ok(state.executionLease?.abortController?.signal.reason instanceof LeaseLostError);
});