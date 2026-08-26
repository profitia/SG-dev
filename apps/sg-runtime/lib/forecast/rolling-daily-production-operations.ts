import {
  persistRollingDailyCurrentForecastSnapshot,
  readRollingDailyCurrentForecastSnapshot,
  type RollingDailyCurrentForecastSnapshotModelId,
  type RollingDailyCurrentForecastSnapshotPersistenceResult,
  type RollingDailyCurrentForecastSnapshotReadResult,
  type RollingDailyCurrentForecastSnapshotRequest,
} from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import {
  createRollingDailyMaintenanceService,
  type RollingDailyHistoryPayload,
  type RollingDailyMaintenanceRequest,
  type RollingDailyMaintenanceResult,
} from '@/lib/forecast/rolling-daily-maintenance'

export const DEFAULT_ROLLING_DAILY_PRODUCTION_OPERATIONS_SERIES_ID = 'wocaes0074'
export const ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const

export type RollingDailyProductionOperationsModelId = (typeof ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS)[number]

export type RollingDailyProductionOperationsRequest = {
  seriesId: string
  modelIds?: readonly RollingDailyProductionOperationsModelId[]
  preparedHistory?: RollingDailyHistoryPayload
}

export type RollingDailyProductionOperationsSnapshotResult =
  | {
      status: 'REFRESHED_AFTER_MAINTENANCE'
      reason: 'MAINTENANCE_DELTA_APPLIED'
      parityStatus: RollingDailyCurrentForecastSnapshotPersistenceResult['parityStatus']
    }
  | {
      status: 'REFRESHED_AFTER_RECOVERY'
      reason: 'SNAPSHOT_MISS' | 'SOURCE_HISTORY_FINGERPRINT_MISSING' | 'SOURCE_HISTORY_FINGERPRINT_MISMATCH'
      parityStatus: RollingDailyCurrentForecastSnapshotPersistenceResult['parityStatus']
    }
  | {
      status: 'SKIPPED_ALREADY_FRESH'
      reason: null
      parityStatus: null
    }
  | {
      status: 'SKIPPED_MAINTENANCE_FAILURE'
      reason: 'MAINTENANCE_FAILED'
      parityStatus: null
    }
  | {
      status: 'SKIPPED_REBUILD_REQUIRED'
      reason: 'SOURCE_HISTORY_REVISION_DETECTED'
      parityStatus: null
    }

export type RollingDailyProductionOperationsModelResult = {
  status: 'SUCCEEDED' | 'NO_OP' | 'RECOVERED' | 'REBUILD_REQUIRED' | 'FAILED'
  modelId: RollingDailyProductionOperationsModelId
  maintenance: RollingDailyMaintenanceResult | null
  snapshot: RollingDailyProductionOperationsSnapshotResult
  error: string | null
}

export type RollingDailyProductionOperationsResult = {
  status: 'SUCCEEDED' | 'NO_OP' | 'FAILED'
  seriesId: string
  results: RollingDailyProductionOperationsModelResult[]
  refreshedSnapshotCount: number
  recoveredSnapshotCount: number
  noOpModelCount: number
  failedModelCount: number
}

type RollingDailyProductionOperationsDependencies = {
  runMaintenance?: (request: RollingDailyMaintenanceRequest) => Promise<RollingDailyMaintenanceResult>
  persistSnapshot?: (request: RollingDailyCurrentForecastSnapshotRequest) => Promise<RollingDailyCurrentForecastSnapshotPersistenceResult>
  readSnapshot?: (request: {
    seriesId: string
    modelId: RollingDailyCurrentForecastSnapshotModelId
    sourceHistoryFingerprint: string
  }) => Promise<RollingDailyCurrentForecastSnapshotReadResult>
  logEvent?: (event: string, data: Record<string, string | number | boolean | null>) => void
}

function logProductionOperationsEvent(event: string, data: Record<string, string | number | boolean | null>) {
  const payload = Object.entries(data)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')

  console.info(`[${event}] ${payload}`)
}

async function refreshSnapshot(
  persistSnapshot: NonNullable<RollingDailyProductionOperationsDependencies['persistSnapshot']>,
  request: RollingDailyCurrentForecastSnapshotRequest,
  status: 'REFRESHED_AFTER_MAINTENANCE',
  reason: 'MAINTENANCE_DELTA_APPLIED',
): Promise<Extract<RollingDailyProductionOperationsSnapshotResult, { status: 'REFRESHED_AFTER_MAINTENANCE' }>>
async function refreshSnapshot(
  persistSnapshot: NonNullable<RollingDailyProductionOperationsDependencies['persistSnapshot']>,
  request: RollingDailyCurrentForecastSnapshotRequest,
  status: 'REFRESHED_AFTER_RECOVERY',
  reason: 'SNAPSHOT_MISS' | 'SOURCE_HISTORY_FINGERPRINT_MISSING' | 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
): Promise<Extract<RollingDailyProductionOperationsSnapshotResult, { status: 'REFRESHED_AFTER_RECOVERY' }>>
async function refreshSnapshot(
  persistSnapshot: NonNullable<RollingDailyProductionOperationsDependencies['persistSnapshot']>,
  request: RollingDailyCurrentForecastSnapshotRequest,
  status: 'REFRESHED_AFTER_MAINTENANCE' | 'REFRESHED_AFTER_RECOVERY',
  reason: 'MAINTENANCE_DELTA_APPLIED' | 'SNAPSHOT_MISS' | 'SOURCE_HISTORY_FINGERPRINT_MISSING' | 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
): Promise<Extract<RollingDailyProductionOperationsSnapshotResult, { status: 'REFRESHED_AFTER_MAINTENANCE' | 'REFRESHED_AFTER_RECOVERY' }>> {
  const persisted = await persistSnapshot(request)

  if (status === 'REFRESHED_AFTER_MAINTENANCE') {
    return {
      status,
      reason: 'MAINTENANCE_DELTA_APPLIED',
      parityStatus: persisted.parityStatus,
    }
  }

  return {
    status,
    reason: reason as 'SNAPSHOT_MISS' | 'SOURCE_HISTORY_FINGERPRINT_MISSING' | 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
    parityStatus: persisted.parityStatus,
  }
}

export function createRollingDailyProductionOperationsService(
  dependencies: RollingDailyProductionOperationsDependencies = {},
) {
  const maintenanceService = createRollingDailyMaintenanceService()
  const runMaintenance = dependencies.runMaintenance
    ?? ((request: RollingDailyMaintenanceRequest) => maintenanceService.runIncrementalMaintenance(request))
  const persistSnapshot = dependencies.persistSnapshot ?? persistRollingDailyCurrentForecastSnapshot
  const readSnapshot = dependencies.readSnapshot ?? readRollingDailyCurrentForecastSnapshot
  const logEvent = dependencies.logEvent ?? logProductionOperationsEvent

  return {
    async run(request: RollingDailyProductionOperationsRequest): Promise<RollingDailyProductionOperationsResult> {
      const modelIds = request.modelIds?.length
        ? [...request.modelIds]
        : [...ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS]

      const results: RollingDailyProductionOperationsModelResult[] = []

      for (const modelId of modelIds) {
        try {
          const maintenance = await runMaintenance({
            seriesId: request.seriesId,
            modelId,
            preparedHistory: request.preparedHistory,
          })

          if (maintenance.status === 'REBUILD_REQUIRED') {
            results.push({
              status: 'REBUILD_REQUIRED',
              modelId,
              maintenance,
              snapshot: {
                status: 'SKIPPED_REBUILD_REQUIRED',
                reason: 'SOURCE_HISTORY_REVISION_DETECTED',
                parityStatus: null,
              },
              error: maintenance.reasonCode,
            })
            continue
          }

          if (maintenance.status === 'SUCCEEDED') {
            const snapshot = await refreshSnapshot(
              persistSnapshot,
              { seriesId: request.seriesId, modelId },
              'REFRESHED_AFTER_MAINTENANCE',
              'MAINTENANCE_DELTA_APPLIED',
            )

            results.push({
              status: 'SUCCEEDED',
              modelId,
              maintenance,
              snapshot,
              error: null,
            })
            continue
          }

          const snapshotState = await readSnapshot({
            seriesId: request.seriesId,
            modelId,
            sourceHistoryFingerprint: maintenance.sourceHistoryFingerprint,
          })

          if (snapshotState.status === 'HIT') {
            results.push({
              status: 'NO_OP',
              modelId,
              maintenance,
              snapshot: {
                status: 'SKIPPED_ALREADY_FRESH',
                reason: null,
                parityStatus: null,
              },
              error: null,
            })
            continue
          }

          const snapshot = await refreshSnapshot(
            persistSnapshot,
            { seriesId: request.seriesId, modelId },
            'REFRESHED_AFTER_RECOVERY',
            snapshotState.status === 'MISS' ? 'SNAPSHOT_MISS' : snapshotState.reason,
          )

          results.push({
            status: 'RECOVERED',
            modelId,
            maintenance,
            snapshot,
            error: null,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          results.push({
            status: 'FAILED',
            modelId,
            maintenance: null,
            snapshot: {
              status: 'SKIPPED_MAINTENANCE_FAILURE',
              reason: 'MAINTENANCE_FAILED',
              parityStatus: null,
            },
            error: message,
          })
          logEvent('ROLLING_DAILY_PRODUCTION_OPERATIONS_FAILURE', {
            seriesId: request.seriesId,
            modelId,
            error: message,
          })
        }
      }

      const refreshedSnapshotCount = results.filter((result) => result.snapshot.status === 'REFRESHED_AFTER_MAINTENANCE').length
      const recoveredSnapshotCount = results.filter((result) => result.snapshot.status === 'REFRESHED_AFTER_RECOVERY').length
      const noOpModelCount = results.filter((result) => result.status === 'NO_OP').length
      const failedModelCount = results.filter((result) => result.status === 'FAILED' || result.status === 'REBUILD_REQUIRED').length
      const status: RollingDailyProductionOperationsResult['status'] = failedModelCount > 0
        ? 'FAILED'
        : results.every((result) => result.status === 'NO_OP')
          ? 'NO_OP'
          : 'SUCCEEDED'

      logEvent('ROLLING_DAILY_PRODUCTION_OPERATIONS', {
        seriesId: request.seriesId,
        status,
        refreshedSnapshotCount,
        recoveredSnapshotCount,
        noOpModelCount,
        failedModelCount,
      })

      return {
        status,
        seriesId: request.seriesId,
        results,
        refreshedSnapshotCount,
        recoveredSnapshotCount,
        noOpModelCount,
        failedModelCount,
      }
    },
  }
}