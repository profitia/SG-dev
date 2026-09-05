import assert from 'node:assert/strict'
import test from 'node:test'

import { createForecastAcceptanceMatrixService } from '@/lib/benchmark-forecast/acceptance-matrix'
import type {
  BenchmarkForecastCurrentPreparationResult,
  BenchmarkForecastCurrentResult,
  BenchmarkForecastVerificationResult,
  InteractiveForecastCapabilityResult,
} from '@/lib/benchmark-forecast/forecast-contract'

function capability(overrides: Partial<InteractiveForecastCapabilityResult> = {}): InteractiveForecastCapabilityResult {
  return {
    seriesId: 'brent',
    targetSemantics: 'MONTHLY_AVERAGE',
    modelId: 'naive',
    sourceFrequency: 'MONTHLY',
    sourceAvailability: 'AVAILABLE',
    lawfulTargetSemantics: 'LAWFUL',
    status: 'READY',
    currentReadiness: 'READY',
    verificationReadiness: 'READY',
    targetedDataScope: 'SINGLE_SERIES',
    timingMs: 5,
    reason: null,
    ...overrides,
  }
}

function currentResult(overrides: Partial<Extract<BenchmarkForecastCurrentResult, { status: 'AVAILABLE' }>> = {}): BenchmarkForecastCurrentResult {
  return {
    status: 'AVAILABLE',
    seriesId: 'brent',
    modelId: 'naive',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    displayName: 'Brent',
    description: null,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    lineage: {
      inputSource: 'DYNAMIC_MARKET_DATA_STORE',
      inputRunId: 'run-1',
      sourceSeriesId: 'brent',
      sourceFrequency: 'MONTHLY',
      historyFingerprint: 'fp-current',
      preparation: null,
    },
    history: { frequency: 'MONTHLY', start: '2020-01-01T00:00:00.000Z', end: '2025-01-01T00:00:00.000Z', observations: 60 },
    forecastOrigin: '2025-01-01T00:00:00.000Z',
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2025-02-01T00:00:00.000Z',
        forecastValue: 101,
      },
    },
    ...overrides,
  }
}

function preparationResult(overrides: Partial<BenchmarkForecastCurrentPreparationResult> = {}): BenchmarkForecastCurrentPreparationResult {
  return {
    seriesId: 'brent',
    modelId: 'naive',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    state: 'READY',
    capabilityStatus: 'PREPARATION_REQUIRED',
    currentReadiness: 'NOT_PREPARED',
    prepareAttempted: true,
    prepareStatus: 'READY',
    reason: null,
    timingMs: 10,
    ...overrides,
  }
}

function verificationResult(overrides: Partial<Extract<BenchmarkForecastVerificationResult, { status: 'AVAILABLE' }>> = {}): BenchmarkForecastVerificationResult {
  return {
    status: 'AVAILABLE',
    seriesId: 'brent',
    modelId: 'naive',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    displayName: 'Brent',
    description: null,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    lineage: {
      inputSource: 'DYNAMIC_MARKET_DATA_STORE',
      inputRunId: 'verification-1',
      sourceSeriesId: 'brent',
      sourceFrequency: 'MONTHLY',
      historyFingerprint: 'fp-verification',
      preparation: null,
    },
    history: { frequency: 'MONTHLY', start: '2020-01-01T00:00:00.000Z', end: '2025-01-01T00:00:00.000Z', observations: 60 },
    forecastOrigin: '2025-01-01T00:00:00.000Z',
    verification: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        origins: 10,
        expectedOrigins: 10,
        successfulOrigins: 10,
        failedOrigins: 0,
        coverage: 1,
        records: [{
          benchmarkId: 'brent',
          modelId: 'naive',
          forecastOrigin: '2025-01-01T00:00:00.000Z',
          horizon: '1M',
          horizonSteps: 1,
          forecastDate: '2025-02-01T00:00:00.000Z',
          actualObservedAt: '2025-02-28T00:00:00.000Z',
          originValue: 100,
          forecastValue: 101,
          actualValue: 102,
          error: -1,
          absoluteError: 1,
          delta: 1,
          deltaPct: 1,
          maseScale: 1,
        }],
      },
      '3M': {
        horizon: '3M',
        horizonSteps: 3,
        origins: 10,
        expectedOrigins: 10,
        successfulOrigins: 10,
        failedOrigins: 0,
        coverage: 1,
        records: [{
          benchmarkId: 'brent',
          modelId: 'naive',
          forecastOrigin: '2025-01-01T00:00:00.000Z',
          horizon: '3M',
          horizonSteps: 3,
          forecastDate: '2025-04-01T00:00:00.000Z',
          actualObservedAt: '2025-04-30T00:00:00.000Z',
          originValue: 100,
          forecastValue: 103,
          actualValue: 104,
          error: -1,
          absoluteError: 1,
          delta: 1,
          deltaPct: 1,
          maseScale: 1,
        }],
      },
      '6M': { horizon: '6M', horizonSteps: 6, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [{ benchmarkId: 'brent', modelId: 'naive', forecastOrigin: '2025-01-01T00:00:00.000Z', horizon: '6M', horizonSteps: 6, forecastDate: '2025-07-01T00:00:00.000Z', actualObservedAt: '2025-07-31T00:00:00.000Z', originValue: 100, forecastValue: 106, actualValue: 107, error: -1, absoluteError: 1, delta: 1, deltaPct: 1, maseScale: 1 }] },
      '12M': { horizon: '12M', horizonSteps: 12, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [{ benchmarkId: 'brent', modelId: 'naive', forecastOrigin: '2025-01-01T00:00:00.000Z', horizon: '12M', horizonSteps: 12, forecastDate: '2026-01-01T00:00:00.000Z', actualObservedAt: '2026-01-31T00:00:00.000Z', originValue: 100, forecastValue: 112, actualValue: 113, error: -1, absoluteError: 1, delta: 1, deltaPct: 1, maseScale: 1 }] },
    },
    ...overrides,
  }
}

test('matrix marks lawful exact current and verification identities as PASS', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability(),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async () => currentResult(),
    readVerification: async () => verificationResult(),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-current', points: [{ forecastValue: 101 }] }) },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => null },
      forecastVerificationRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-verification', metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
      rollingDailyVerificationRecord: { findMany: async () => [] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const monthlyCurrent = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')
  const monthlyVerification = report.verification.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE' && cell.identity.verificationHorizon === '1M')

  assert.equal(monthlyCurrent?.state, 'PASS')
  assert.equal(monthlyVerification?.state, 'PASS')
})

test('matrix accepts live-shaped AVAILABLE capability truth when readiness is READY', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability({ status: 'AVAILABLE' as never }),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async () => currentResult(),
    readVerification: async () => verificationResult(),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-current', points: [{ forecastValue: 101 }] }) },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => null },
      forecastVerificationRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-verification', metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
      rollingDailyVerificationRecord: { findMany: async () => [] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const monthlyCurrent = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')
  const monthlyVerification = report.verification.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE' && cell.identity.verificationHorizon === '1M')

  assert.equal(monthlyCurrent?.state, 'PASS')
  assert.equal(monthlyVerification?.state, 'PASS')
})

test('matrix returns UNSUPPORTED from capability without reading artifacts', async () => {
  let currentReads = 0
  let verificationReads = 0
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability({ status: 'NOT_LAWFUL', reason: 'UNSUPPORTED_FREQUENCY', sourceFrequency: 'QUARTERLY', currentReadiness: 'NOT_PREPARED', verificationReadiness: 'NOT_PREPARED' }),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async () => {
      currentReads += 1
      return currentResult()
    },
    readVerification: async () => {
      verificationReads += 1
      return verificationResult()
    },
    getPrisma: () => null,
  })

  const report = await service.evaluateSeries('brent')
  const pointInTimeCurrent = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')

  assert.equal(pointInTimeCurrent?.state, 'UNSUPPORTED')
  assert.equal(pointInTimeCurrent?.failingLayer, 'CAPABILITY')
  assert.equal(pointInTimeCurrent?.reasonCode, 'UNSUPPORTED_COMBINATION')
  assert.equal(currentReads, 0)
  assert.equal(verificationReads, 0)
})

test('matrix fails the current cell when readiness stays not prepared after capability evaluation', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability({ status: 'AVAILABLE' as never, currentReadiness: 'NOT_PREPARED', verificationReadiness: 'READY' }),
    prepareCurrent: async () => preparationResult({ prepareAttempted: false, prepareStatus: null }),
    readCurrent: async () => currentResult(),
    readVerification: async () => verificationResult(),
    getPrisma: () => null,
  })

  const report = await service.evaluateSeries('brent')
  const currentCell = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')

  assert.equal(currentCell?.state, 'FAIL')
  assert.equal(currentCell?.failingLayer, 'PREPARED_STATE')
  assert.equal(currentCell?.reasonCode, 'PREPARED_STATE_NOT_READY')
})

test('matrix fails the verification cell when verification readiness stays not prepared', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability({ status: 'AVAILABLE' as never, currentReadiness: 'READY', verificationReadiness: 'NOT_PREPARED' }),
    prepareCurrent: async () => preparationResult({ prepareAttempted: false, prepareStatus: null }),
    readCurrent: async () => currentResult(),
    readVerification: async () => verificationResult(),
    getPrisma: () => null,
  })

  const report = await service.evaluateSeries('brent')
  const verificationCell = report.verification.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE' && cell.identity.verificationHorizon === '1M')

  assert.equal(verificationCell?.state, 'FAIL')
  assert.equal(verificationCell?.failingLayer, 'PREPARED_STATE')
  assert.equal(verificationCell?.reasonCode, 'VERIFICATION_NOT_READY')
})

test('matrix fails at persisted layer when prepared state is READY but exact artifact is missing', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability(),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async () => currentResult(),
    readVerification: async () => verificationResult(),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async () => null },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => null },
      forecastVerificationRun: { findFirst: async () => null },
      rollingDailyVerificationRecord: { findMany: async () => [] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const currentCell = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')
  const verificationCell = report.verification.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE' && cell.identity.verificationHorizon === '1M')

  assert.equal(currentCell?.state, 'FAIL')
  assert.equal(currentCell?.failingLayer, 'POSTGRES_ARTIFACT')
  assert.equal(currentCell?.reasonCode, 'MISSING_ARTIFACT')
  assert.equal(verificationCell?.state, 'FAIL')
  assert.equal(verificationCell?.reasonCode, 'MISSING_ARTIFACT')
})

test('matrix surfaces empty point-in-time snapshot paths as EMPTY_PATH without attempting a canonical read', async () => {
  let currentReads = 0

  const service = createForecastAcceptanceMatrixService({
    readCapability: async (input) => capability({ modelId: input.modelId, targetSemantics: input.targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : input.targetBasis, sourceFrequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY' }),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async () => {
      currentReads += 1
      return currentResult()
    },
    readVerification: async (_seriesId, modelId, targetBasis) => verificationResult({ modelId, targetBasis, targetSemantics: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodId: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodVersion: targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1', lineage: { inputSource: 'DYNAMIC_MARKET_DATA_STORE', inputRunId: 'verification-1', sourceSeriesId: 'brent', sourceFrequency: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY', historyFingerprint: `${modelId}-${targetBasis}-verification`, preparation: null } }),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-current', points: [{ forecastValue: 1 }] }) },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => ({ status: 'AVAILABLE', payloadJson: { status: 'AVAILABLE', audit: { sourceHistoryFingerprint: 'fp-pit-current' }, path: [] } }) },
      forecastVerificationRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-verification', metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
      rollingDailyVerificationRecord: { findMany: async () => [{ actualValue: 1, maturityStatus: 'MATURED', sourceHistoryFingerprint: 'fp-pit-verification' }] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const pointInTimeCurrent = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'POINT_IN_TIME')

  assert.equal(pointInTimeCurrent?.state, 'FAIL')
  assert.equal(pointInTimeCurrent?.failingLayer, 'POSTGRES_ARTIFACT')
  assert.equal(pointInTimeCurrent?.reasonCode, 'EMPTY_PATH')
  assert.equal(currentReads, 8)
})

test('matrix preserves exact identity isolation across model, target basis, and verification horizon', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async (input) => capability({ modelId: input.modelId, targetSemantics: input.targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : input.targetBasis, sourceFrequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY' }),
    prepareCurrent: async (input) => preparationResult({ modelId: input.modelId, targetBasis: input.targetBasis, targetSemantics: input.targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : input.targetBasis }),
    readCurrent: async (_seriesId, modelId, targetBasis) => currentResult({ modelId, targetBasis, targetSemantics: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodId: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodVersion: targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1', lineage: { inputSource: 'DYNAMIC_MARKET_DATA_STORE', inputRunId: 'run-1', sourceSeriesId: 'brent', sourceFrequency: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY', historyFingerprint: `${modelId}-${targetBasis}`, preparation: null } }),
    readVerification: async (_seriesId, modelId, targetBasis) => verificationResult({ modelId, targetBasis, targetSemantics: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodId: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodVersion: targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1', lineage: { inputSource: 'DYNAMIC_MARKET_DATA_STORE', inputRunId: 'verification-1', sourceSeriesId: 'brent', sourceFrequency: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY', historyFingerprint: `${modelId}-${targetBasis}-verification`, preparation: null } }),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async ({ where }: { where: { modelId: string, targetBasis: string } }) => ({ status: 'AVAILABLE', historyFingerprint: `${where.modelId}-${where.targetBasis}`, points: [{ forecastValue: 1 }] }) },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => ({ status: 'AVAILABLE', payloadJson: { status: 'AVAILABLE', audit: { sourceHistoryFingerprint: 'arima-POINT_IN_TIME' }, path: [{ pointForecast: 1 }] } }) },
      forecastVerificationRun: { findFirst: async ({ where }: { where: { modelId: string, targetBasis: string } }) => ({ status: 'AVAILABLE', historyFingerprint: `${where.modelId}-${where.targetBasis}-verification`, metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
      rollingDailyVerificationRecord: { findMany: async () => [{ actualValue: 1, maturityStatus: 'MATURED', sourceHistoryFingerprint: 'arima-POINT_IN_TIME-verification' }] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const monthly = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')
  const pointInTime = report.current.cells.find((cell) => cell.identity.modelId === 'arima' && cell.identity.targetBasis === 'POINT_IN_TIME')
  const verification1m = report.verification.cells.find((cell) => cell.identity.modelId === 'arima' && cell.identity.targetBasis === 'POINT_IN_TIME' && cell.identity.verificationHorizon === '1M')
  const verification12m = report.verification.cells.find((cell) => cell.identity.modelId === 'arima' && cell.identity.targetBasis === 'POINT_IN_TIME' && cell.identity.verificationHorizon === '12M')

  assert.notEqual(monthly?.identity.historyFingerprint, pointInTime?.identity.historyFingerprint)
  assert.equal(verification1m?.identity.verificationHorizon, '1M')
  assert.equal(verification12m?.identity.verificationHorizon, '12M')
})

test('matrix rejects stale point-in-time current fingerprints deterministically', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async (input) => capability({ modelId: input.modelId, targetSemantics: input.targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : input.targetBasis, sourceFrequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY' }),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async (_seriesId, modelId, targetBasis) => (
      targetBasis === 'POINT_IN_TIME'
        ? currentResult({
            modelId,
            targetBasis,
            targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
            methodId: 'ROLLING_DAILY_POINT_IN_TIME',
            methodVersion: 'rolling-daily-point-in-time-v1',
            lineage: {
              inputSource: 'DYNAMIC_MARKET_DATA_STORE',
              inputRunId: 'run-1',
              sourceSeriesId: 'brent',
              sourceFrequency: 'DAILY',
              historyFingerprint: 'snapshot-fingerprint',
              preparation: null,
            },
            freshness: {
              identity: {
                forecastIdentity: {
                  seriesId: 'brent',
                  modelId,
                  targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
                  methodId: 'ROLLING_DAILY_POINT_IN_TIME',
                  methodVersion: 'rolling-daily-point-in-time-v1',
                },
                inputSource: 'DYNAMIC_MARKET_DATA_STORE',
                sourceHistoryFingerprint: 'snapshot-fingerprint',
                forecastOrigin: '2025-01-01T00:00:00.000Z',
              },
              status: 'STALE',
              reason: 'SOURCE_HISTORY_FINGERPRINT_MISMATCH',
              snapshotSourceHistoryFingerprint: 'snapshot-fingerprint',
              currentSourceHistoryFingerprint: 'current-fingerprint',
            },
          })
        : currentResult({ modelId, targetBasis, targetSemantics: targetBasis, methodId: targetBasis, lineage: { inputSource: 'DYNAMIC_MARKET_DATA_STORE', inputRunId: 'run-1', sourceSeriesId: 'brent', sourceFrequency: 'MONTHLY', historyFingerprint: `${modelId}-${targetBasis}`, preparation: null } })
    ),
    readVerification: async (_seriesId, modelId, targetBasis) => verificationResult({ modelId, targetBasis, targetSemantics: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodId: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodVersion: targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1', lineage: { inputSource: 'DYNAMIC_MARKET_DATA_STORE', inputRunId: 'verification-1', sourceSeriesId: 'brent', sourceFrequency: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY', historyFingerprint: `${modelId}-${targetBasis}-verification`, preparation: null } }),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async ({ where }: { where: { modelId: string, targetBasis: string } }) => ({ status: 'AVAILABLE', historyFingerprint: `${where.modelId}-${where.targetBasis}`, points: [{ forecastValue: 1 }] }) },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => ({ status: 'AVAILABLE', payloadJson: { status: 'AVAILABLE', audit: { sourceHistoryFingerprint: 'snapshot-fingerprint' }, path: [{ pointForecast: 1 }] } }) },
      forecastVerificationRun: { findFirst: async ({ where }: { where: { modelId: string, targetBasis: string } }) => ({ status: 'AVAILABLE', historyFingerprint: `${where.modelId}-${where.targetBasis}-verification`, metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
      rollingDailyVerificationRecord: { findMany: async () => [{ actualValue: 1, maturityStatus: 'MATURED', sourceHistoryFingerprint: 'fp-pit-verification' }] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const pointInTimeCurrent = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'POINT_IN_TIME')

  assert.equal(pointInTimeCurrent?.state, 'FAIL')
  assert.equal(pointInTimeCurrent?.failingLayer, 'POSTGRES_ARTIFACT')
  assert.equal(pointInTimeCurrent?.reasonCode, 'STALE_FINGERPRINT')
})

test('matrix rejects available reads that do not match the requested forecast identity', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability(),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async () => currentResult({ modelId: 'ets', lineage: { inputSource: 'DYNAMIC_MARKET_DATA_STORE', inputRunId: 'run-1', sourceSeriesId: 'brent', sourceFrequency: 'MONTHLY', historyFingerprint: 'fp-current', preparation: null } }),
    readVerification: async () => verificationResult(),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-current', points: [{ forecastValue: 101 }] }) },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => null },
      forecastVerificationRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-verification', metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
      rollingDailyVerificationRecord: { findMany: async () => [] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const currentCell = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')

  assert.equal(currentCell?.state, 'FAIL')
  assert.equal(currentCell?.failingLayer, 'DASHBOARD_ADAPTER')
  assert.equal(currentCell?.reasonCode, 'IDENTITY_MISMATCH')
})

test('matrix surfaces canonical read misses as READ_NOT_AVAILABLE after persisted artifacts pass', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability(),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async () => ({
      status: 'NOT_AVAILABLE',
      seriesId: 'brent',
      modelId: 'naive',
      targetBasis: 'MONTHLY_AVERAGE',
      targetSemantics: 'MONTHLY_AVERAGE',
      methodId: 'MONTHLY_AVERAGE',
      reason: 'Current forecast not available.',
    }),
    readVerification: async () => ({
      status: 'NOT_AVAILABLE',
      seriesId: 'brent',
      modelId: 'naive',
      targetBasis: 'MONTHLY_AVERAGE',
      targetSemantics: 'MONTHLY_AVERAGE',
      methodId: 'MONTHLY_AVERAGE',
      reason: 'Verification forecast not available.',
    }),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-current', points: [{ forecastValue: 101 }] }) },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => null },
      forecastVerificationRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-verification', metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
      rollingDailyVerificationRecord: { findMany: async () => [] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const currentCell = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')
  const verificationCell = report.verification.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE' && cell.identity.verificationHorizon === '1M')

  assert.equal(currentCell?.state, 'FAIL')
  assert.equal(currentCell?.failingLayer, 'CANONICAL_READ')
  assert.equal(currentCell?.reasonCode, 'READ_NOT_AVAILABLE')
  assert.equal(verificationCell?.state, 'FAIL')
  assert.equal(verificationCell?.failingLayer, 'CANONICAL_READ')
  assert.equal(verificationCell?.reasonCode, 'READ_NOT_AVAILABLE')
})

test('matrix uses deterministic failure taxonomy for non-renderable current and empty verification horizon', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability(),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async () => currentResult({ currentForecast: { '1M': { horizon: '1M', horizonSteps: 1, forecastDate: '2025-02-01T00:00:00.000Z', forecastValue: null } } }),
    readVerification: async () => verificationResult({ verification: { '1M': { horizon: '1M', horizonSteps: 1, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [] }, '3M': { horizon: '3M', horizonSteps: 3, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [] }, '6M': { horizon: '6M', horizonSteps: 6, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [] }, '12M': { horizon: '12M', horizonSteps: 12, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [] } } }),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-current', points: [{ forecastValue: 1 }] }) },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => null },
      forecastVerificationRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-verification', metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
      rollingDailyVerificationRecord: { findMany: async () => [] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const currentCell = report.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')
  const verificationCell = report.verification.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE' && cell.identity.verificationHorizon === '1M')

  assert.equal(currentCell?.reasonCode, 'INVALID_PAYLOAD')
  assert.equal(currentCell?.failingLayer, 'RENDERABLE_PAYLOAD')
  assert.equal(verificationCell?.reasonCode, 'MISSING_REQUIRED_POINTS')
  assert.equal(verificationCell?.failingLayer, 'RENDERABLE_PAYLOAD')
})

test('matrix rejects verification payloads that omit the requested horizon from the dashboard contract', async () => {
  const service = createForecastAcceptanceMatrixService({
    readCapability: async () => capability(),
    prepareCurrent: async () => preparationResult(),
    readCurrent: async () => currentResult(),
    readVerification: async () => verificationResult({ verification: { '3M': { horizon: '3M', horizonSteps: 3, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [{ benchmarkId: 'brent', modelId: 'naive', forecastOrigin: '2025-01-01T00:00:00.000Z', horizon: '3M', horizonSteps: 3, forecastDate: '2025-04-01T00:00:00.000Z', actualObservedAt: '2025-04-30T00:00:00.000Z', originValue: 100, forecastValue: 103, actualValue: 104, error: -1, absoluteError: 1, delta: 1, deltaPct: 1, maseScale: 1 }] }, '6M': { horizon: '6M', horizonSteps: 6, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [{ benchmarkId: 'brent', modelId: 'naive', forecastOrigin: '2025-01-01T00:00:00.000Z', horizon: '6M', horizonSteps: 6, forecastDate: '2025-07-01T00:00:00.000Z', actualObservedAt: '2025-07-31T00:00:00.000Z', originValue: 100, forecastValue: 106, actualValue: 107, error: -1, absoluteError: 1, delta: 1, deltaPct: 1, maseScale: 1 }] }, '12M': { horizon: '12M', horizonSteps: 12, origins: 1, expectedOrigins: 1, successfulOrigins: 1, failedOrigins: 0, coverage: 1, records: [{ benchmarkId: 'brent', modelId: 'naive', forecastOrigin: '2025-01-01T00:00:00.000Z', horizon: '12M', horizonSteps: 12, forecastDate: '2026-01-01T00:00:00.000Z', actualObservedAt: '2026-01-31T00:00:00.000Z', originValue: 100, forecastValue: 112, actualValue: 113, error: -1, absoluteError: 1, delta: 1, deltaPct: 1, maseScale: 1 }] } } }),
    getPrisma: () => ({
      forecastCurrentRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-current', points: [{ forecastValue: 101 }] }) },
      rollingDailyCurrentForecastSnapshot: { findFirst: async () => null },
      forecastVerificationRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-verification', metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
      rollingDailyVerificationRecord: { findMany: async () => [] },
    } as never),
  })

  const report = await service.evaluateSeries('brent')
  const verificationCell = report.verification.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE' && cell.identity.verificationHorizon === '1M')

  assert.equal(verificationCell?.state, 'FAIL')
  assert.equal(verificationCell?.failingLayer, 'DASHBOARD_ADAPTER')
  assert.equal(verificationCell?.reasonCode, 'ADAPTER_REJECTED')
})

test('matrix performs one cold prepare on first evaluation and zero prepares on warm reread', async () => {
  let prepareCalls = 0
  let targetVariantCapabilityReads = 0
  let targetPrepared = false

  function createService() {
    return createForecastAcceptanceMatrixService({
      readCapability: async (input) => {
        const isTargetVariant = input.modelId === 'naive' && input.targetBasis === 'MONTHLY_AVERAGE'
        if (!isTargetVariant) {
          return capability({ modelId: input.modelId, targetSemantics: input.targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : input.targetBasis, sourceFrequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY' })
        }

        targetVariantCapabilityReads += 1
        return targetPrepared
          ? capability()
          : capability({ status: 'PREPARATION_REQUIRED', currentReadiness: 'NOT_PREPARED', verificationReadiness: 'NOT_PREPARED' })
      },
      prepareCurrent: async (input) => {
        if (input.modelId === 'naive' && input.targetBasis === 'MONTHLY_AVERAGE') {
          prepareCalls += 1
          targetPrepared = true
        }

      test('matrix reads verification once per variant across all horizons', async () => {
        let verificationReads = 0

        const service = createForecastAcceptanceMatrixService({
          readCapability: async (input) => capability({
            modelId: input.modelId,
            targetSemantics: input.targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : input.targetBasis,
            sourceFrequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
          }),
          prepareCurrent: async (input) => preparationResult({
            modelId: input.modelId,
            targetBasis: input.targetBasis,
            targetSemantics: input.targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : input.targetBasis,
          }),
          readCurrent: async (_seriesId, modelId, targetBasis) => currentResult({
            modelId,
            targetBasis,
            targetSemantics: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis,
            methodId: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis,
            methodVersion: targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1',
            lineage: {
              inputSource: 'DYNAMIC_MARKET_DATA_STORE',
              inputRunId: 'run-1',
              sourceSeriesId: 'brent',
              sourceFrequency: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
              historyFingerprint: `${modelId}-${targetBasis}`,
              preparation: null,
            },
          }),
          readVerification: async (_seriesId, modelId, targetBasis) => {
            verificationReads += 1
            return verificationResult({
              modelId,
              targetBasis,
              targetSemantics: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis,
              methodId: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis,
              methodVersion: targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1',
              lineage: {
                inputSource: 'DYNAMIC_MARKET_DATA_STORE',
                inputRunId: 'verification-1',
                sourceSeriesId: 'brent',
                sourceFrequency: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
                historyFingerprint: `${modelId}-${targetBasis}-verification`,
                preparation: null,
              },
            })
          },
          getPrisma: () => ({
            forecastCurrentRun: { findFirst: async ({ where }: { where: { modelId: string, targetBasis: string } }) => ({ status: 'AVAILABLE', historyFingerprint: `${where.modelId}-${where.targetBasis}`, points: [{ forecastValue: 1 }] }) },
            rollingDailyCurrentForecastSnapshot: { findFirst: async () => ({ status: 'AVAILABLE', payloadJson: { status: 'AVAILABLE', audit: { sourceHistoryFingerprint: 'arima-POINT_IN_TIME' }, path: [{ pointForecast: 1 }] } }) },
            forecastVerificationRun: { findFirst: async ({ where }: { where: { modelId: string, targetBasis: string } }) => ({ status: 'AVAILABLE', historyFingerprint: `${where.modelId}-${where.targetBasis}-verification`, metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
            rollingDailyVerificationRecord: { findMany: async () => [{ actualValue: 1, maturityStatus: 'MATURED', sourceHistoryFingerprint: 'arima-POINT_IN_TIME-verification' }] },
          } as never),
        })

        const report = await service.evaluateSeries('brent')

        assert.equal(report.verification.cells.length, 48)
        assert.equal(verificationReads, 12)
      })

        return preparationResult({ modelId: input.modelId, targetBasis: input.targetBasis, targetSemantics: input.targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : input.targetBasis })
      },
      readCurrent: async (_seriesId, modelId, targetBasis) => currentResult({ modelId, targetBasis, targetSemantics: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodId: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodVersion: targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1' }),
      readVerification: async (_seriesId, modelId, targetBasis) => verificationResult({ modelId, targetBasis, targetSemantics: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodId: targetBasis === 'POINT_IN_TIME' ? 'ROLLING_DAILY_POINT_IN_TIME' : targetBasis, methodVersion: targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1' }),
      getPrisma: () => ({
        forecastCurrentRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-current', points: [{ forecastValue: 101 }] }) },
        rollingDailyCurrentForecastSnapshot: { findFirst: async () => ({ status: 'AVAILABLE', payloadJson: { status: 'AVAILABLE', audit: { sourceHistoryFingerprint: 'fp-pit-current' }, path: [{ pointForecast: 1 }] } }) },
        forecastVerificationRun: { findFirst: async () => ({ status: 'AVAILABLE', historyFingerprint: 'fp-verification', metrics: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }], points: [{ horizonLabel: '1M' }, { horizonLabel: '3M' }, { horizonLabel: '6M' }, { horizonLabel: '12M' }] }) },
        rollingDailyVerificationRecord: { findMany: async () => [{ actualValue: 1, maturityStatus: 'MATURED', sourceHistoryFingerprint: 'fp-pit-verification' }] },
      } as never),
    })
  }

  const firstReport = await createService().evaluateSeries('brent')
  const firstCurrentCell = firstReport.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')
  const firstVerificationCell = firstReport.verification.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE' && cell.identity.verificationHorizon === '1M')

  assert.equal(firstCurrentCell?.state, 'PASS')
  assert.equal(firstCurrentCell?.preparation.attempted, true)
  assert.equal(firstCurrentCell?.preparation.warmReadinessVerified, true)
  assert.equal(firstVerificationCell?.state, 'PASS')
  assert.equal(firstVerificationCell?.preparation.attempted, true)
  assert.equal(prepareCalls, 1)
  assert.equal(targetVariantCapabilityReads, 2)

  const secondReport = await createService().evaluateSeries('brent')
  const secondCurrentCell = secondReport.current.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE')
  const secondVerificationCell = secondReport.verification.cells.find((cell) => cell.identity.modelId === 'naive' && cell.identity.targetBasis === 'MONTHLY_AVERAGE' && cell.identity.verificationHorizon === '1M')

  assert.equal(secondCurrentCell?.state, 'PASS')
  assert.equal(secondCurrentCell?.preparation.attempted, false)
  assert.equal(secondCurrentCell?.preparation.warmReadinessVerified, false)
  assert.equal(secondVerificationCell?.state, 'PASS')
  assert.equal(secondVerificationCell?.preparation.attempted, false)
  assert.equal(prepareCalls, 1)
  assert.equal(targetVariantCapabilityReads, 3)
})