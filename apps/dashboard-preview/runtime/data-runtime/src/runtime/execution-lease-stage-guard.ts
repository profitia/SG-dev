import { abortExecutionLease, LeaseLostError } from "./execution-lease.ts";
import { PrismaExecutionLifecycleStore } from "./persistence/execution-lifecycle-store.ts";
import type { RuntimeState } from "./runtime-state.ts";

export class ExecutionLeaseStageGuard {
  private readonly store = new PrismaExecutionLifecycleStore();

  async assertActive(state: RuntimeState): Promise<void> {
    if (!state.executionLease || !state.runId || !state.organizationId) {
      return;
    }

    if (state.executionLease.lost || !state.executionLease.ownerId || !state.executionLease.tokenHash) {
      throw new LeaseLostError();
    }

    const active = await this.store.assertActiveRunLease(state.runId, state.organizationId, {
      ownerId: state.executionLease.ownerId,
      tokenHash: state.executionLease.tokenHash,
      epoch: state.executionLease.epoch,
    });

    if (!active) {
      state.executionLease.lost = true;
      abortExecutionLease(state.executionLease.abortController);
      throw new LeaseLostError();
    }
  }

  async disconnect(): Promise<void> {
    await this.store.disconnect();
  }
}