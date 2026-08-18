import type { ExecutionLifecycleStore } from "../runtime/persistence/execution-lifecycle-store.ts";
import { resolveExecutionLeaseRuntimeConfig } from "../runtime/execution-lease.ts";
import { planStaleHydrationExecutions } from "../runtime/stale-hydration-recovery.ts";

export const HYDRATION_STALE_RECOVERY_APPLY_NOT_AVAILABLE = "HYDRATION_STALE_RECOVERY_APPLY_NOT_AVAILABLE";
export const RECOVERY_CONCURRENCY_CONFLICT = "RECOVERY_CONCURRENCY_CONFLICT";

export interface RecoverStaleCliDependencies {
  createStore: () => ExecutionLifecycleStore;
  writeStdout?: (line: string) => void;
  writeStderr?: (line: string) => void;
}

export const RECOVERY_APPLY_CONFIRMATION_MISMATCH = "RECOVERY_APPLY_CONFIRMATION_MISMATCH";

export async function runRecoverStaleCli(
  args: readonly string[],
  dependencies: RecoverStaleCliDependencies,
): Promise<number> {
  const stdout = dependencies.writeStdout ?? console.log;
  const stderr = dependencies.writeStderr ?? console.error;

  try {
    const parsed = parseRecoverStaleArgs(args);

    const store = dependencies.createStore();

    try {
      if (parsed.mode === "apply") {
        const leaseConfig = resolveExecutionLeaseRuntimeConfig();

        if (!leaseConfig.recoveryApplyEnabled || process.env["ALLOW_STALE_HYDRATION_RECOVERY_APPLY"] !== "true") {
          stderr(`${HYDRATION_STALE_RECOVERY_APPLY_NOT_AVAILABLE}: Recovery Apply requires DATA_RUNTIME_RECOVERY_APPLY_ENABLED=true and ALLOW_STALE_HYDRATION_RECOVERY_APPLY=true.`);
          return 1;
        }

        try {
          const result = await store.recoverStaleExecutionApply({
            organizationId: parsed.organizationId,
            runId: parsed.runId,
            staleThresholdMs: parsed.staleThresholdMs,
            recoveryGraceMs: leaseConfig.recoveryGraceMs,
            recoveryReasonCode: "STALE_HYDRATION_RECOVERY_APPLY",
          });

          stdout(JSON.stringify({
            mode: "apply",
            organizationId: parsed.organizationId,
            runId: parsed.runId,
            runStatus: result.run.status,
            recoveredAt: result.run.recoveredAt?.toISOString() ?? null,
            recoveryReasonCode: result.run.recoveryReasonCode,
            datasetStatuses: result.runDatasets.map((dataset) => ({
              runDatasetId: dataset.id,
              status: dataset.status,
            })),
          }, null, 2));
          return 0;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Recovery apply failed.";
          stderr(`${RECOVERY_CONCURRENCY_CONFLICT}: ${message}`);
          return 1;
        }
      }

      const plan = await planStaleHydrationExecutions(store, {
        organizationId: parsed.organizationId,
        staleThresholdMs: parsed.staleThresholdMs,
        limit: parsed.limit,
        pipelineCode: parsed.pipelineCode,
      });

      stdout(JSON.stringify(plan, null, 2));
      return 0;
    } finally {
      await store.disconnect();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hydration stale recovery planning failed.";
    stderr(message);
    return 1;
  }
}

interface ParsedPlanArgs {
  mode: "plan-only";
  organizationId: string;
  staleThresholdMs: number;
  pipelineCode?: string;
  limit?: number;
}

interface ParsedApplyArgs {
  mode: "apply";
  organizationId: string;
  runId: string;
  staleThresholdMs: number;
}

type ParsedRecoverStaleArgs = ParsedPlanArgs | ParsedApplyArgs;

function parseRecoverStaleArgs(args: readonly string[]): ParsedRecoverStaleArgs {
  let organizationId: string | null = null;
  let staleAfterSeconds: string | null = null;
  let limit: string | null = null;
  let pipelineCode: string | null = null;
  let runId: string | null = null;
  let confirmRunId: string | null = null;
  let apply = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg?.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg ?? "<empty>"}`);
    }

    switch (arg) {
      case "--organization": {
        organizationId = readRequiredValue(args, index, arg);
        index += 1;
        break;
      }
      case "--organization-id": {
        organizationId = readRequiredValue(args, index, arg);
        index += 1;
        break;
      }
      case "--stale-after-seconds": {
        staleAfterSeconds = readRequiredValue(args, index, arg);
        index += 1;
        break;
      }
      case "--pipeline": {
        pipelineCode = readRequiredValue(args, index, arg);
        index += 1;
        break;
      }
      case "--run-id": {
        runId = readRequiredValue(args, index, arg);
        index += 1;
        break;
      }
      case "--confirm-run-id": {
        confirmRunId = readRequiredValue(args, index, arg);
        index += 1;
        break;
      }
      case "--limit": {
        limit = readRequiredValue(args, index, arg);
        index += 1;
        break;
      }
      case "--apply": {
        apply = true;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!organizationId?.trim()) {
    throw new Error("run:recover-stale requires --organization-id <id>.");
  }

  if (!staleAfterSeconds) {
    throw new Error("run:recover-stale requires --stale-after-seconds <positive-number>.");
  }

  const staleThresholdValue = Number(staleAfterSeconds);

  if (!Number.isFinite(staleThresholdValue) || staleThresholdValue <= 0) {
    throw new Error("run:recover-stale requires --stale-after-seconds <positive-number>.");
  }

  if (apply) {
    if (!runId?.trim()) {
      throw new Error("run:recover-stale --apply requires --run-id <exact-run-id>.");
    }

    if (!confirmRunId?.trim()) {
      throw new Error("run:recover-stale --apply requires --confirm-run-id <exact-run-id>.");
    }

    if (confirmRunId.trim() !== runId.trim()) {
      throw new Error(`${RECOVERY_APPLY_CONFIRMATION_MISMATCH}: run:recover-stale --confirm-run-id must exactly match --run-id.`);
    }

    return {
      mode: "apply",
      organizationId: organizationId.trim(),
      runId: runId.trim(),
      staleThresholdMs: staleThresholdValue * 1_000,
    };
  }

  const parsedLimit = parseOptionalPositiveInteger(limit, "--limit");

  return {
    mode: "plan-only",
    organizationId: organizationId.trim(),
    staleThresholdMs: staleThresholdValue * 1_000,
    pipelineCode: pipelineCode?.trim() || undefined,
    limit: parsedLimit,
  };
}

function readRequiredValue(args: readonly string[], index: number, flagName: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flagName}.`);
  }

  return value;
}

function parseOptionalPositiveInteger(value: string | null, flagName: string): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} requires a positive integer.`);
  }

  return parsed;
}