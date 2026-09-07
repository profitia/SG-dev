import {
  persistResolvedRollingDailyCurrentForecastSnapshot,
  readRollingDailyCurrentForecastSnapshot,
  type RollingDailyCurrentForecastSnapshotModelId,
  type RollingDailyCurrentForecastSnapshotPersistenceResult,
  type RollingDailyCurrentForecastSnapshotReadResult,
  type RollingDailyCurrentForecastSnapshotRequest,
} from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import {
  createRollingDailyMaintenanceService,
  buildRollingDailyHistoryFingerprint,
  type RollingDailyHistoryPayload,
  type RollingDailyHistoricalTraceConfig,
  type RollingDailyHistoricalTraceInput,
  type RollingDailyMaintenanceRequest,
  type RollingDailyMaintenanceResult,
  resolveRollingDailyHistoricalTraceConfig,
} from '@/lib/forecast/rolling-daily-maintenance'
import {
  createRollingDailyProductionForecastService,
  type RollingDailyProductionForecastResult,
} from '@/lib/forecast/rolling-daily-production-forecast'
import type { ForecastPersistenceOwnership } from '@/lib/forecast/service'

export const DEFAULT_ROLLING_DAILY_PRODUCTION_OPERATIONS_SERIES_ID = 'wocaes0074'
export const ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS = ['naive', 'damped_holt', 'ets', 'arima'] as const

export type RollingDailyProductionOperationsModelId = (typeof ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS)[number]

export type RollingDailyProductionOperationsRequest = {
  seriesId: string
  modelIds?: readonly RollingDailyProductionOperationsModelId[]
  preparedHistory?: RollingDailyHistoryPayload
  prepareHistorical?: boolean
  trace?: RollingDailyHistoricalTraceInput | RollingDailyHistoricalTraceConfig
  resolvePersistenceOwnership?: () => Promise<ForecastPersistenceOwnership>
}

const ROLLING_DAILY_HISTORICAL_TRACE_PREFIX = '[ROLLING_DAILY_HISTORICAL_TRACE]'

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
      status: 'SKIPPED_CURRENT_FAILURE'
      reason: 'CURRENT_FAILED'
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
  resolveCurrentForecast?: (request: RollingDailyCurrentForecastSnapshotRequest) => Promise<RollingDailyProductionForecastResult>
  persistSnapshot?: (
    request: RollingDailyCurrentForecastSnapshotRequest,
    result: RollingDailyProductionForecastResult & { productionMethod: 'ROLLING_DAILY_POINT_IN_TIME' },
    options?: { ownership?: ForecastPersistenceOwnership },
  ) => Promise<RollingDailyCurrentForecastSnapshotPersistenceResult>
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
  resolveCurrentForecast: NonNullable<RollingDailyProductionOperationsDependencies['resolveCurrentForecast']>,
  persistSnapshot: NonNullable<RollingDailyProductionOperationsDependencies['persistSnapshot']>,
  request: RollingDailyCurrentForecastSnapshotRequest,
  options: { resolvePersistenceOwnership?: () => Promise<ForecastPersistenceOwnership> },
  trace: RollingDailyHistoricalTraceConfig | null,
  status: 'REFRESHED_AFTER_MAINTENANCE',
  reason: 'MAINTENANCE_DELTA_APPLIED',
): Promise<Extract<RollingDailyProductionOperationsSnapshotResult, { status: 'REFRESHED_AFTER_MAINTENANCE' }>>
async function refreshSnapshot(
  resolveCurrentForecast: NonNullable<RollingDailyProductionOperationsDependencies['resolveCurrentForecast']>,
  persistSnapshot: NonNullable<RollingDailyProductionOperationsDependencies['persistSnapshot']>,
  request: RollingDailyCurrentForecastSnapshotRequest,
  options: { resolvePersistenceOwnership?: () => Promise<ForecastPersistenceOwnership> },
  trace: RollingDailyHistoricalTraceConfig | null,
  status: 'REFRESHED_AFTER_RECOVERY',
  reason: 'SNAPSHOT_MISS' | 'SOURCE_HISTORY_FINGERPRINT_MISSING' | 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
): Promise<Extract<RollingDailyProductionOperationsSnapshotResult, { status: 'REFRESHED_AFTER_RECOVERY' }>>
async function refreshSnapshot(
  resolveCurrentForecast: NonNullable<RollingDailyProductionOperationsDependencies['resolveCurrentForecast']>,
  persistSnapshot: NonNullable<RollingDailyProductionOperationsDependencies['persistSnapshot']>,
  request: RollingDailyCurrentForecastSnapshotRequest,
  options: { resolvePersistenceOwnership?: () => Promise<ForecastPersistenceOwnership> },
  trace: RollingDailyHistoricalTraceConfig | null,
  status: 'REFRESHED_AFTER_MAINTENANCE' | 'REFRESHED_AFTER_RECOVERY',
  reason: 'MAINTENANCE_DELTA_APPLIED' | 'SNAPSHOT_MISS' | 'SOURCE_HISTORY_FINGERPRINT_MISSING' | 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
): Promise<Extract<RollingDailyProductionOperationsSnapshotResult, { status: 'REFRESHED_AFTER_MAINTENANCE' | 'REFRESHED_AFTER_RECOVERY' }>> {
  const refreshStartedAt = performance.now()
  if (trace) {
    console.info(`${ROLLING_DAILY_HISTORICAL_TRACE_PREFIX} ${JSON.stringify({
      event: 'current_refresh_started',
      seriesId: request.seriesId,
      modelId: request.modelId,
      reason,
      refreshStatus: status,
    })}`)
  }
  const result = await resolveCurrentForecast(request)
  const ownership = options.resolvePersistenceOwnership
    ? await options.resolvePersistenceOwnership()
    : undefined
  const persisted = await persistSnapshot(request, {
    ...result,
    productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
  }, ownership ? { ownership } : undefined)

  if (trace) {
    console.info(`${ROLLING_DAILY_HISTORICAL_TRACE_PREFIX} ${JSON.stringify({
      event: 'current_refresh_completed',
      seriesId: request.seriesId,
      modelId: request.modelId,
      reason,
      refreshStatus: status,
      durationMs: Math.round(performance.now() - refreshStartedAt),
      parityStatus: persisted.parityStatus,
    })}`)
  }

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
  const productionForecastService = createRollingDailyProductionForecastService()
  const runMaintenance = dependencies.runMaintenance
    ?? ((request: RollingDailyMaintenanceRequest) => maintenanceService.runIncrementalMaintenance(request))
  const resolveCurrentForecast = dependencies.resolveCurrentForecast
    ?? ((request: RollingDailyCurrentForecastSnapshotRequest) => productionForecastService.getRollingDailyProductionForecast(request))
  const persistSnapshot = dependencies.persistSnapshot
    ?? ((request, result) => persistResolvedRollingDailyCurrentForecastSnapshot(request, result))
  const readSnapshot = dependencies.readSnapshot ?? readRollingDailyCurrentForecastSnapshot
  const logEvent = dependencies.logEvent ?? logProductionOperationsEvent

  function summarizeResultSet(results: RollingDailyProductionOperationsModelResult[]) {
    const refreshedSnapshotCount = results.filter((result) => result.snapshot.status === 'REFRESHED_AFTER_MAINTENANCE').length
    const recoveredSnapshotCount = results.filter((result) => result.snapshot.status === 'REFRESHED_AFTER_RECOVERY').length
    const noOpModelCount = results.filter((result) => result.status === 'NO_OP').length
    const failedModelCount = results.filter((result) => result.status === 'FAILED' || result.status === 'REBUILD_REQUIRED').length
    const status: RollingDailyProductionOperationsResult['status'] = failedModelCount > 0
      ? 'FAILED'
      : results.every((result) => result.status === 'NO_OP')
        ? 'NO_OP'
        : 'SUCCEEDED'

    return {
      status,
      refreshedSnapshotCount,
      recoveredSnapshotCount,
      noOpModelCount,
      failedModelCount,
    }
  }

  return {
    async run(request: RollingDailyProductionOperationsRequest): Promise<RollingDailyProductionOperationsResult> {
      const trace = resolveRollingDailyHistoricalTraceConfig(request.trace)
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
            bootstrapHistoricalIfMissing: request.prepareHistorical,
            trace: trace ?? undefined,
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
              resolveCurrentForecast,
              persistSnapshot,
              { seriesId: request.seriesId, modelId, preparedHistory: request.preparedHistory },
              { resolvePersistenceOwnership: request.resolvePersistenceOwnership },
              trace,
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
            resolveCurrentForecast,
            persistSnapshot,
            { seriesId: request.seriesId, modelId, preparedHistory: request.preparedHistory },
            { resolvePersistenceOwnership: request.resolvePersistenceOwnership },
            trace,
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

      const {
        status,
        refreshedSnapshotCount,
        recoveredSnapshotCount,
        noOpModelCount,
        failedModelCount,
      } = summarizeResultSet(results)

      logEvent('ROLLING_DAILY_PRODUCTION_OPERATIONS', {
        seriesId: request.seriesId,
        status,
        refreshedSnapshotCount,
        recoveredSnapshotCount,
        noOpModelCount,
        failedModelCount,
        historicalVerificationTriggeredInline: true,
        calibrationTriggeredInline: true,
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

    async runCurrentOnly(request: RollingDailyProductionOperationsRequest): Promise<RollingDailyProductionOperationsResult> {
      const trace = resolveRollingDailyHistoricalTraceConfig(request.trace)
      const modelIds = request.modelIds?.length
        ? [...request.modelIds]
        : [...ROLLING_DAILY_PRODUCTION_OPERATIONS_MODELS]

      const results: RollingDailyProductionOperationsModelResult[] = []
      const sourceHistoryFingerprint = request.preparedHistory
        ? buildRollingDailyHistoryFingerprint(request.preparedHistory)
        : null

      for (const modelId of modelIds) {
        try {
          const snapshotState = sourceHistoryFingerprint
            ? await readSnapshot({
                seriesId: request.seriesId,
                modelId,
                sourceHistoryFingerprint,
              })
            : { status: 'MISS' as const }

          if (snapshotState.status === 'HIT') {
            results.push({
              status: 'NO_OP',
              modelId,
              maintenance: null,
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
            resolveCurrentForecast,
            persistSnapshot,
            { seriesId: request.seriesId, modelId, preparedHistory: request.preparedHistory },
            { resolvePersistenceOwnership: request.resolvePersistenceOwnership },
            trace,
            'REFRESHED_AFTER_RECOVERY',
            snapshotState.status === 'MISS' ? 'SNAPSHOT_MISS' : snapshotState.reason,
          )

          results.push({
            status: 'RECOVERED',
            modelId,
            maintenance: null,
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
              status: 'SKIPPED_CURRENT_FAILURE',
              reason: 'CURRENT_FAILED',
              parityStatus: null,
            },
            error: message,
          })
          logEvent('ROLLING_DAILY_CURRENT_ONLY_FAILURE', {
            seriesId: request.seriesId,
            modelId,
            error: message,
            historicalVerificationTriggeredInline: false,
            calibrationTriggeredInline: false,
          })
        }
      }

      const {
        status,
        refreshedSnapshotCount,
        recoveredSnapshotCount,
        noOpModelCount,
        failedModelCount,
      } = summarizeResultSet(results)

      logEvent('ROLLING_DAILY_CURRENT_ONLY', {
        seriesId: request.seriesId,
        status,
        refreshedSnapshotCount,
        recoveredSnapshotCount,
        noOpModelCount,
        failedModelCount,
        historicalVerificationTriggeredInline: false,
        calibrationTriggeredInline: false,
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