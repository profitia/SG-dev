import {
  ForecastExecutionControlError,
  type ForecastPreparationExecutionAdmission,
  type ForecastPreparationOwnedExecutionContext,
} from '@/lib/forecast/execution-ledger'

const MIN_FORECAST_STAGE3_HEARTBEAT_INTERVAL_MS = 1_000
const MAX_FORECAST_STAGE3_HEARTBEAT_INTERVAL_MS = 15_000

export function resolveForecastStage3HeartbeatIntervalMs(leaseDurationMs: number) {
  if (leaseDurationMs <= MIN_FORECAST_STAGE3_HEARTBEAT_INTERVAL_MS) {
    throw new Error(
      'FORECAST_STAGE3_LEASE_DURATION_MS must be greater than 1000 milliseconds so heartbeatInterval can remain strictly below leaseDuration.',
    )
  }

  const rawValue = process.env.FORECAST_STAGE3_HEARTBEAT_INTERVAL_MS?.trim()
  if (rawValue) {
    const parsed = Number.parseInt(rawValue, 10)
    if (!Number.isFinite(parsed) || parsed < MIN_FORECAST_STAGE3_HEARTBEAT_INTERVAL_MS) {
      throw new Error('FORECAST_STAGE3_HEARTBEAT_INTERVAL_MS must be an integer >= 1000 milliseconds.')
    }
    if (parsed >= leaseDurationMs) {
      throw new Error('FORECAST_STAGE3_HEARTBEAT_INTERVAL_MS must be strictly less than FORECAST_STAGE3_LEASE_DURATION_MS.')
    }
    return parsed
  }

  const heartbeatIntervalMs = Math.max(
    MIN_FORECAST_STAGE3_HEARTBEAT_INTERVAL_MS,
    Math.min(Math.floor(leaseDurationMs / 3), MAX_FORECAST_STAGE3_HEARTBEAT_INTERVAL_MS),
  )

  if (heartbeatIntervalMs >= leaseDurationMs) {
    throw new Error('Derived Stage 3 heartbeat interval must remain strictly less than the lease duration.')
  }

  return heartbeatIntervalMs
}

export function startForecastExecutionLeaseHeartbeat(input: {
  executionAdmission: ForecastPreparationExecutionAdmission
  logicalArtifactKey: string
  ownership: ForecastPreparationOwnedExecutionContext
  requestId: string
  heartbeatIntervalMs: number
}) {
  let currentOwnership = input.ownership
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let activeRenewal: Promise<void> | null = null
  let ownershipLossError: Error | null = null

  const normalizeOwnershipLoss = (error: unknown) => {
    if (error instanceof Error) {
      return error
    }

    return new ForecastExecutionControlError(
      'CONTROL_DB_UNAVAILABLE',
      `Execution ${currentOwnership.executionId} lost PostgreSQL authority for ${input.logicalArtifactKey}.`,
    )
  }

  const schedule = () => {
    if (stopped) {
      return
    }

    timer = setTimeout(() => {
      activeRenewal = (async () => {
        try {
          currentOwnership = await input.executionAdmission.renewLease({
            executionId: currentOwnership.executionId,
            logicalArtifactKey: input.logicalArtifactKey,
            ownerToken: currentOwnership.ownerToken,
            leaseVersion: currentOwnership.leaseVersion,
            requestId: input.requestId,
          })
        } catch (error) {
          ownershipLossError = normalizeOwnershipLoss(error)
          stopped = true
          return
        }

        schedule()
      })().finally(() => {
        activeRenewal = null
      })
    }, input.heartbeatIntervalMs)
  }

  schedule()

  return {
    assertActive() {
      if (ownershipLossError) {
        throw ownershipLossError
      }
    },
    getOwnership() {
      if (ownershipLossError) {
        throw ownershipLossError
      }
      return currentOwnership
    },
    async renewNow() {
      if (ownershipLossError) {
        throw ownershipLossError
      }

      currentOwnership = await input.executionAdmission.renewLease({
        executionId: currentOwnership.executionId,
        logicalArtifactKey: input.logicalArtifactKey,
        ownerToken: currentOwnership.ownerToken,
        leaseVersion: currentOwnership.leaseVersion,
        requestId: input.requestId,
      })
      return currentOwnership
    },
    async stop() {
      stopped = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      await activeRenewal
    },
  }
}