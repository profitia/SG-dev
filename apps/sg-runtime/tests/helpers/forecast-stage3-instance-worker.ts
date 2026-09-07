process.env.MARKET_DATA_DATABASE_URL = process.env.MARKET_DATA_DATABASE_URL ?? 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data'

import { appendFile } from 'node:fs/promises'

import { createForecastLibraryService } from '../../lib/forecast/service'

type Stage3Mode = 'current' | 'verification'
type Stage3ResultMode = 'AVAILABLE' | 'FAILED'

function createHistoryResponse(seriesId: string) {
  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: 'cmrd3xvlu0000cedt8gczw378',
    },
    benchmark: {
      seriesId,
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      expectedObservations: 64,
    },
    history: {
      seriesId,
      benchmarkName: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      start: '2021-01-01T00:00:00',
      end: '2026-04-01T00:00:00',
      observations: 64,
      points: [
        { date: '2021-01-01T00:00:00', value: 1000, sourceObservedAt: '2021-01-31T00:00:00' },
        { date: '2026-04-01T00:00:00', value: 1125, sourceObservedAt: '2026-04-30T00:00:00' },
      ],
    },
  }
}

function createCurrentResponse(seriesId: string, modelId: string) {
  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: 'cmrd3xvlu0000cedt8gczw378',
    },
    benchmark: {
      seriesId,
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      expectedObservations: 64,
    },
    model: {
      id: modelId,
      userFacing: true,
    },
    result: {
      benchmarkId: seriesId,
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      model: modelId,
      history: createHistoryResponse(seriesId).history,
      currentForecast: {
        '1M': {
          horizon: '1M',
          horizonSteps: 1,
          forecastDate: '2026-05-01T00:00:00',
          forecastValue: 1132.5,
          metadata: {
            modelFamily: 'ets',
            selectedVariant: 'ETS(A,N,N)',
            selectedParameters: {},
            selectionScore: 0.12,
            selectionMetric: 'rmse',
            fitStatus: 'SUCCEEDED',
            failureReason: null,
          },
          failureReason: null,
        },
        '3M': {
          horizon: '3M',
          horizonSteps: 3,
          forecastDate: '2026-07-01T00:00:00',
          forecastValue: 1144.5,
          metadata: {
            modelFamily: 'ets',
            selectedVariant: 'ETS(A,N,N)',
            selectedParameters: {},
            selectionScore: 0.12,
            selectionMetric: 'rmse',
            fitStatus: 'SUCCEEDED',
            failureReason: null,
          },
          failureReason: null,
        },
      },
      runtimeSeconds: 0.084,
    },
  }
}

function createVerificationResponse(seriesId: string, modelId: string) {
  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: 'cmrd3xvlu0000cedt8gczw378',
    },
    benchmark: {
      seriesId,
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      expectedObservations: 64,
    },
    model: {
      id: modelId,
      userFacing: true,
    },
    result: {
      benchmarkId: seriesId,
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: 'MONTHLY',
      model: modelId,
      history: createHistoryResponse(seriesId).history,
      backtest: {
        '1M': {
          origins: 28,
          expectedOrigins: 28,
          successfulOrigins: 28,
          failedOrigins: 0,
          coverage: 1,
          metrics: {
            mae: 10.5,
            rmse: 12.4,
            mase: 0.81,
            smape: 0.073,
            directional_accuracy: 0.64,
            bias: -1.2,
          },
          records: [
            {
              benchmarkId: seriesId,
              modelId,
              forecastOrigin: '2025-01-31T00:00:00',
              horizon: '1M',
              horizonSteps: 1,
              forecastDate: '2025-02-28T00:00:00',
              actualObservedAt: '2025-02-28T00:00:00',
              originValue: 1000,
              forecastValue: 1008,
              actualValue: 1004,
              error: 4,
              absoluteError: 4,
              delta: 12,
              deltaPct: 0.012,
              maseScale: 14.2,
              metadata: {
                modelFamily: 'ets',
                selectedVariant: 'ETS(A,N,N)',
                selectedParameters: {},
                selectionScore: 0.12,
                selectionMetric: 'rmse',
                fitStatus: 'SUCCEEDED',
                failureReason: null,
              },
            },
          ],
          failures: [],
        },
      },
      runtimeSeconds: 2.48,
    },
  }
}

async function main() {
  const mode = (process.env.STAGE3_MODE ?? 'current') as Stage3Mode
  const resultMode = (process.env.STAGE3_RESULT_MODE ?? 'AVAILABLE') as Stage3ResultMode
  const seriesId = process.env.STAGE3_SERIES_ID ?? 'wocaes0280'
  const modelId = process.env.STAGE3_MODEL_ID ?? 'ets'
  const targetBasis = (process.env.STAGE3_TARGET_BASIS ?? 'MONTHLY_AVERAGE') as 'MONTHLY_AVERAGE' | 'END_OF_PERIOD'
  const computeLogPath = process.env.STAGE3_COMPUTE_LOG_PATH
  const computeDelayMs = Number.parseInt(process.env.STAGE3_COMPUTE_DELAY_MS ?? '200', 10)

  const service = createForecastLibraryService({
    bridge: {
      async exportHistory() {
        return createHistoryResponse(seriesId)
      },
      async exportCurrent() {
        if (computeLogPath) {
          await appendFile(computeLogPath, `${mode}:${seriesId}:${modelId}:${process.pid}\n`)
        }
        await new Promise((resolve) => setTimeout(resolve, computeDelayMs))
        if (resultMode === 'FAILED') {
          return {
            status: 'FAILED' as const,
            reason: `stage3-worker-${mode.toLowerCase()}-failed`,
            seriesId,
            model: modelId,
            methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
            source: {
              kind: 'POSTGRES_RUNTIME_SNAPSHOT',
              runId: 'cmrd3xvlu0000cedt8gczw378',
            },
          }
        }
        return createCurrentResponse(seriesId, modelId)
      },
      async exportVerification() {
        if (computeLogPath) {
          await appendFile(computeLogPath, `${mode}:${seriesId}:${modelId}:${process.pid}\n`)
        }
        await new Promise((resolve) => setTimeout(resolve, computeDelayMs))
        if (resultMode === 'FAILED') {
          return {
            status: 'FAILED' as const,
            reason: `stage3-worker-${mode.toLowerCase()}-failed`,
            seriesId,
            model: modelId,
            methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
            source: {
              kind: 'POSTGRES_RUNTIME_SNAPSHOT',
              runId: 'cmrd3xvlu0000cedt8gczw378',
            },
          }
        }
        return createVerificationResponse(seriesId, modelId)
      },
    },
    logEvent: () => {},
    telemetry: {
      emit() {},
    },
  })

  const result = mode === 'verification'
    ? await service.resolveVerificationRequest({ seriesId, modelId, targetBasis })
    : await service.resolveCurrentForecastRequest({ seriesId, modelId, targetBasis })

  process.stdout.write(`${JSON.stringify(result)}\n`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})