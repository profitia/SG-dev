import './load-env'

import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

import type { ForecastSourceFrequency, ForecastTargetCadence } from '@/lib/forecast/cadence'
import type { ForecastTargetBasis, UserFacingForecastModelId } from '@/lib/forecast/contracts'
import type { ForecastTargetSemantics } from '@/lib/forecast/identity'
import {
  prepareRollingDailyCurrentOwnership,
} from '@/lib/forecast/rolling-daily-current-ownership'
import { createRollingDailyProductionOperationsService } from '@/lib/forecast/rolling-daily-production-operations'
import {
  getActiveCurrentForecastSingleFlightEntryCount,
  runCurrentForecastSingleFlight,
  resolveBenchmarkCurrentForecast,
  resolveBenchmarkForecastVerification,
} from '@/lib/forecast/service'
import {
  forecastStressTelemetry,
  type ForecastStressContext,
  type ForecastStressTelemetry,
} from '@/lib/forecast/stress-telemetry'

type OperationKind = 'CURRENT' | 'VERIFICATION'

export type OperationRequest = ForecastStressContext & {
  operation: OperationKind
  seriesId: string
  modelId: UserFacingForecastModelId
  targetBasis: ForecastTargetBasis
  targetSemantics?: ForecastTargetSemantics
  sourceFrequency?: ForecastSourceFrequency
  targetCadence?: ForecastTargetCadence
}

type OperationDependencies = {
  telemetry: Pick<ForecastStressTelemetry, 'run' | 'sampleResources'> & Partial<Pick<ForecastStressTelemetry, 'emit'>>
  resolveCurrent: typeof resolveBenchmarkCurrentForecast
  prepareRollingDailyCurrent: typeof prepareRollingDailyCurrentOwnership
  resolveRollingDailyCurrent: (input: {
    seriesId: string
    modelId: UserFacingForecastModelId
    preparedHistory: Awaited<ReturnType<typeof prepareRollingDailyCurrentOwnership>>['history']
  }) => Promise<unknown>
  resolveVerification: typeof resolveBenchmarkForecastVerification
}

function isRollingDailyCurrent(request: OperationRequest) {
  return request.operation === 'CURRENT'
    && request.targetBasis === 'POINT_IN_TIME'
    && request.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
    && request.sourceFrequency === 'DAILY'
    && request.targetCadence === 'DAILY'
}

export async function runForecastStressOperationWave(
  requests: readonly OperationRequest[],
  dependencies: Partial<OperationDependencies> = {},
) {
  const rollingDailyOperations = createRollingDailyProductionOperationsService()
  const resolved: OperationDependencies = {
    telemetry: dependencies.telemetry ?? forecastStressTelemetry,
    resolveCurrent: dependencies.resolveCurrent ?? resolveBenchmarkCurrentForecast,
    prepareRollingDailyCurrent: dependencies.prepareRollingDailyCurrent ?? prepareRollingDailyCurrentOwnership,
    resolveRollingDailyCurrent: dependencies.resolveRollingDailyCurrent
      ?? ((input) => rollingDailyOperations.run({
        seriesId: input.seriesId,
        modelIds: [input.modelId],
        preparedHistory: input.preparedHistory,
      })),
    resolveVerification: dependencies.resolveVerification ?? resolveBenchmarkForecastVerification,
  }
  let release: () => void = () => undefined
  const barrier = new Promise<void>((resolve) => {
    release = resolve
  })

  const waiting = requests.map(async (request) => {
    await barrier
    const startedMonotonicMs = performance.now()
    const context: ForecastStressContext = {
      stressRunId: request.stressRunId,
      scenarioId: request.scenarioId,
      virtualUserId: request.virtualUserId,
      requestId: request.requestId,
      forecastIdentity: request.forecastIdentity,
      logicalArtifactKey: request.logicalArtifactKey,
    }

    try {
      const value = await resolved.telemetry.run(context, async () => {
        resolved.telemetry.sampleResources()
        const input = {
          seriesId: request.seriesId,
          modelId: request.modelId,
          targetBasis: request.targetBasis,
          sourceFrequency: request.sourceFrequency,
          targetCadence: request.targetCadence,
        }
        const rollingDaily = isRollingDailyCurrent(request)
        const rollingOwnership = rollingDaily
          ? await resolved.prepareRollingDailyCurrent({ seriesId: request.seriesId, modelId: request.modelId })
          : null
        const rollingResult = rollingOwnership
          ? await runCurrentForecastSingleFlight<Record<string, unknown>>({
              logicalArtifactKey: rollingOwnership.logicalArtifactKey,
              requestId: request.requestId,
              emit(event, eventData) {
                resolved.telemetry.emit?.(event, {
                  ...eventData,
                  seriesId: request.seriesId,
                  modelId: request.modelId,
                  targetSemantics: request.targetSemantics ?? null,
                  sourceFrequency: request.sourceFrequency ?? null,
                  targetCadence: request.targetCadence ?? null,
                })
              },
              operation: async () => {
                resolved.telemetry.emit?.('current_compute_start', {
                  operation: 'rolling_daily_production_operations',
                  logicalArtifactKey: rollingOwnership.logicalArtifactKey,
                })
                const result = await resolved.resolveRollingDailyCurrent({
                  seriesId: request.seriesId,
                  modelId: request.modelId,
                  preparedHistory: rollingOwnership.history,
                }) as Record<string, unknown>
                const failed = result.status === 'FAILED'
                resolved.telemetry.emit?.('current_compute_end', {
                  operation: 'rolling_daily_production_operations',
                  logicalArtifactKey: rollingOwnership.logicalArtifactKey,
                  failed,
                })
                resolved.telemetry.emit?.('model_fit', { modelId: request.modelId, count: 1, failed })
                resolved.telemetry.emit?.('persistence', {
                  operation: 'rolling_daily_current_snapshot',
                  artifactWrites: Number(result.refreshedSnapshotCount ?? 0) + Number(result.recoveredSnapshotCount ?? 0),
                  pointWrites: 0,
                  verificationRecordWrites: 0,
                  writeFailures: failed ? 1 : 0,
                })
                return result
              },
            })
          : null
        const result = rollingDaily
          ? {
              ...rollingResult,
              executionFamily: 'ROLLING_DAILY_PRODUCTION_OPERATIONS',
              ...rollingOwnership?.identity,
            }
          : request.operation === 'CURRENT'
            ? {
                ...await resolved.resolveCurrent(input),
                executionFamily: 'GENERIC_PERIOD_CURRENT',
              }
            : await resolved.resolveVerification(input)
        resolved.telemetry.sampleResources()
        return result
      })
      return {
        requestId: request.requestId,
        virtualUserId: request.virtualUserId,
        startedMonotonicMs,
        endedMonotonicMs: performance.now(),
        ok: true,
        value,
      }
    } catch (error) {
      return {
        requestId: request.requestId,
        virtualUserId: request.virtualUserId,
        startedMonotonicMs,
        endedMonotonicMs: performance.now(),
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  release()
  return Promise.all(waiting)
}

async function main() {
  const requestFile = process.argv.find((argument) => argument.startsWith('--requests-file='))
    ?.slice('--requests-file='.length)
  const encoded = process.argv.find((argument) => argument.startsWith('--requests-base64='))
    ?.slice('--requests-base64='.length)
  if ((!requestFile && !encoded) || (requestFile && encoded)) {
    throw new Error('Provide exactly one of --requests-file or --requests-base64.')
  }

  const serialized = requestFile
    ? await readFile(requestFile, 'utf8')
    : Buffer.from(encoded!, 'base64url').toString('utf8')
  const requests = JSON.parse(serialized) as OperationRequest[]
  const precheck = process.argv.includes('--precheck')
  const measurementControlProbe = process.argv.includes('--mc-probe')
  const validPrecheck = precheck
    && requests.length >= 2
    && requests.length < 10
    && requests.every((request) => request.scenarioId === 'P05' || request.scenarioId === 'P08')
  const validMeasurementControlProbe = measurementControlProbe
    && requests.length === 3
    && requests.every((request) => request.scenarioId === 'P04')
  if (![10, 100, 1000].includes(requests.length) && !validPrecheck && !validMeasurementControlProbe) {
    throw new Error('Phase 2.1B operation wave must contain exactly 10, 100, or 1000 requests.')
  }
  if (requests.some((request) => !/^P(0[3-5]|08)$/.test(request.scenarioId))) {
    throw new Error('Operation adapter permits only compute scenarios P03, P04, P05, and P08.')
  }

  const results = await runForecastStressOperationWave(requests)
  const firstRequest = requests[0]!
  forecastStressTelemetry.run({
    stressRunId: firstRequest.stressRunId,
    scenarioId: firstRequest.scenarioId,
    virtualUserId: firstRequest.virtualUserId,
    requestId: firstRequest.requestId,
    forecastIdentity: firstRequest.forecastIdentity,
    logicalArtifactKey: firstRequest.logicalArtifactKey,
  }, () => {
    forecastStressTelemetry.emit('current_single_flight_registry_settled', {
      activeEntryCount: getActiveCurrentForecastSingleFlightEntryCount(),
    })
  })
  process.stdout.write(`[FORECAST_STRESS_WORKER_RESULT] ${JSON.stringify(results)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
