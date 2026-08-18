import { setTimeout as delay } from "node:timers/promises";

import type { ExecutionLeaseRuntimeConfig } from "./execution-lease.ts";
import type { ExpectedExecutionLeaseInput, ExecutionLifecycleStore } from "./persistence/execution-lifecycle-store.ts";
import type { RuntimeState } from "./runtime-state.ts";

export interface ExecutionHeartbeatTimerHandle {
  unref?: () => void;
}

export interface ExecutionHeartbeatControllerOptions {
  now?: () => Date;
  delayFn?: (ms: number) => Promise<unknown>;
  setIntervalFn?: (callback: () => void, intervalMs: number) => ExecutionHeartbeatTimerHandle;
  clearIntervalFn?: (handle: ExecutionHeartbeatTimerHandle) => void;
  onLeaseLost?: (state: RuntimeState) => void;
}

export interface ExecutionHeartbeatControllerState {
  running: boolean;
  renewalInFlight: boolean;
}

type HeartbeatLeaseStore = Pick<ExecutionLifecycleStore, "renewRunningLease">;

export class ExecutionHeartbeatController {
  private heartbeatTimer: ExecutionHeartbeatTimerHandle | null = null;
  private renewalInFlight: Promise<void> | null = null;
  private readonly now: () => Date;
  private readonly delayFn: (ms: number) => Promise<unknown>;
  private readonly setIntervalFn: (callback: () => void, intervalMs: number) => ExecutionHeartbeatTimerHandle;
  private readonly clearIntervalFn: (handle: ExecutionHeartbeatTimerHandle) => void;
  private readonly onLeaseLost: (state: RuntimeState) => void;

  constructor(
    private readonly store: HeartbeatLeaseStore,
    private readonly leaseConfig: ExecutionLeaseRuntimeConfig,
    options: ExecutionHeartbeatControllerOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.delayFn = options.delayFn ?? ((ms) => delay(ms));
    this.setIntervalFn = options.setIntervalFn ?? ((callback, intervalMs) => setInterval(callback, intervalMs));
    this.clearIntervalFn = options.clearIntervalFn ?? ((handle) => clearInterval(handle as never));
    this.onLeaseLost = options.onLeaseLost ?? (() => undefined);
  }

  get currentState(): ExecutionHeartbeatControllerState {
    return {
      running: this.heartbeatTimer !== null,
      renewalInFlight: this.renewalInFlight !== null,
    };
  }

  start(state: RuntimeState): void {
    if (this.heartbeatTimer || !state.executionLease || !state.runId || !state.organizationId) {
      return;
    }

    this.heartbeatTimer = this.setIntervalFn(() => {
      void this.renewNow(state);
    }, this.leaseConfig.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  stop(): void {
    if (!this.heartbeatTimer) {
      return;
    }

    this.clearIntervalFn(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  async renewNow(state: RuntimeState): Promise<void> {
    if (this.renewalInFlight) {
      await this.renewalInFlight;
      return;
    }

    const renewal = this.renewLeaseWithRetries(state).finally(() => {
      if (this.renewalInFlight === renewal) {
        this.renewalInFlight = null;
      }
    });

    this.renewalInFlight = renewal;
    await renewal;
  }

  private async renewLeaseWithRetries(state: RuntimeState): Promise<void> {
    if (!state.executionLease || state.executionLease.lost || !state.runId || !state.organizationId) {
      return;
    }

    const expectedLease = toExpectedExecutionLease(state);

    if (!expectedLease) {
      this.emitLeaseLost(state);
      return;
    }

    for (let index = 0; index <= this.leaseConfig.maxImmediateRetries; index += 1) {
      try {
        const persisted = await this.store.renewRunningLease(
          state.runId,
          state.organizationId,
          expectedLease,
          this.leaseConfig.leaseDurationMs,
        );

        state.executionLease.epoch = persisted.epoch;
        state.executionLease.acquiredAt = persisted.acquiredAt;
        state.executionLease.heartbeatAt = persisted.heartbeatAt;
        state.executionLease.expiresAt = persisted.expiresAt;
        state.executionLease.releasedAt = persisted.releasedAt;
        return;
      } catch {
        const expiresAt = state.executionLease.expiresAt;

        if (!expiresAt || this.now().getTime() >= expiresAt.getTime() - this.leaseConfig.leaseLossMarginMs) {
          this.emitLeaseLost(state);
          return;
        }

        const delayMs = this.leaseConfig.retryDelaysMs[index];

        if (delayMs === undefined) {
          break;
        }

        await this.delayFn(delayMs);
      }
    }

    this.emitLeaseLost(state);
  }

  private emitLeaseLost(state: RuntimeState): void {
    this.stop();
    this.onLeaseLost(state);
  }
}

function toExpectedExecutionLease(state: RuntimeState): ExpectedExecutionLeaseInput | undefined {
  if (!state.executionLease?.ownerId || !state.executionLease.tokenHash) {
    return undefined;
  }

  return {
    ownerId: state.executionLease.ownerId,
    tokenHash: state.executionLease.tokenHash,
    epoch: state.executionLease.epoch,
  };
}