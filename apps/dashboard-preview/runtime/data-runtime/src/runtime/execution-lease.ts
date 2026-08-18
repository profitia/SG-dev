import { createHash, randomBytes, randomUUID } from "node:crypto";

export const DEFAULT_EXECUTION_LEASE_HEARTBEAT_INTERVAL_MS = 30_000;
export const DEFAULT_EXECUTION_LEASE_DURATION_MS = 120_000;
export const DEFAULT_EXECUTION_LEASE_RECOVERY_GRACE_MS = 30_000;
export const DEFAULT_EXECUTION_LEASE_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;
export const DEFAULT_EXECUTION_LEASE_MAX_IMMEDIATE_RETRIES = 3;
export const DEFAULT_EXECUTION_LEASE_LOSS_MARGIN_MS = 15_000;

export interface ExecutionLeaseRuntimeConfig {
  enabled: boolean;
  recoveryApplyEnabled: boolean;
  heartbeatIntervalMs: number;
  leaseDurationMs: number;
  recoveryGraceMs: number;
  retryDelaysMs: readonly number[];
  maxImmediateRetries: number;
  leaseLossMarginMs: number;
}

export interface ExecutionLeaseEnvShape {
  DATA_RUNTIME_EXECUTION_LEASES_ENABLED?: string;
  DATA_RUNTIME_RECOVERY_APPLY_ENABLED?: string;
}

export interface ExecutionLeaseIdentity {
  ownerId: string;
  rawToken: Buffer;
  tokenHash: Uint8Array;
}

export interface PersistedExecutionLease {
  ownerId: string;
  tokenHash: Uint8Array;
  epoch: bigint;
  acquiredAt: Date;
  heartbeatAt: Date;
  expiresAt: Date;
  releasedAt: Date | null;
}

export class LeaseLostError extends Error {
  constructor(message = "Hydration execution lease was lost before the run could continue.") {
    super(message);
    this.name = "LeaseLostError";
  }
}

export function abortExecutionLease(abortController: AbortController | null | undefined): void {
  if (!abortController || abortController.signal.aborted) {
    return;
  }

  abortController.abort(new LeaseLostError());
}

export function throwIfExecutionLeaseAborted(signal: AbortSignal | null | undefined): void {
  if (!signal?.aborted) {
    return;
  }

  if (signal.reason instanceof Error) {
    throw signal.reason;
  }

  throw new LeaseLostError();
}

export function toPrismaBytes(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(value.byteLength));
  bytes.set(value);
  return bytes;
}

function readBooleanEnv(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function resolveExecutionLeaseRuntimeConfig(
  env: ExecutionLeaseEnvShape = process.env,
): ExecutionLeaseRuntimeConfig {
  return {
    enabled: readBooleanEnv(env.DATA_RUNTIME_EXECUTION_LEASES_ENABLED),
    recoveryApplyEnabled: readBooleanEnv(env.DATA_RUNTIME_RECOVERY_APPLY_ENABLED),
    heartbeatIntervalMs: DEFAULT_EXECUTION_LEASE_HEARTBEAT_INTERVAL_MS,
    leaseDurationMs: DEFAULT_EXECUTION_LEASE_DURATION_MS,
    recoveryGraceMs: DEFAULT_EXECUTION_LEASE_RECOVERY_GRACE_MS,
    retryDelaysMs: DEFAULT_EXECUTION_LEASE_RETRY_DELAYS_MS,
    maxImmediateRetries: DEFAULT_EXECUTION_LEASE_MAX_IMMEDIATE_RETRIES,
    leaseLossMarginMs: DEFAULT_EXECUTION_LEASE_LOSS_MARGIN_MS,
  };
}

export function createExecutionLeaseIdentity(): ExecutionLeaseIdentity {
  const rawToken = randomBytes(32);

  return {
    ownerId: randomUUID(),
    rawToken,
    tokenHash: toPrismaBytes(createHash("sha256").update(rawToken).digest()),
  };
}