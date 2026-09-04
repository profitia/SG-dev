import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createDemoCertificationService,
  getDefaultDemoCertificationCohort,
  type DemoCohortEntry,
  type DemoCertificationSnapshot,
} from '@/lib/benchmark-forecast/demo-certification'
import type {
  BenchmarkForecastCurrentPreparationRequest,
  BenchmarkForecastCurrentPreparationResult,
  BenchmarkForecastCurrentResult,
  BenchmarkForecastVerificationResult,
  ForecastPortfolioModelId,
  ForecastTargetBasis,
  ForecastTargetSemantics,
  InteractiveForecastCapabilityResult,
} from '@/lib/benchmark-forecast/forecast-contract'
import type { ForecastAcceptanceCell, ForecastAcceptanceMatrixReport } from '@/lib/benchmark-forecast/acceptance-matrix'

const MODELS: readonly ForecastPortfolioModelId[] = ['naive', 'damped_holt', 'ets', 'arima']
const TARGET_BASES: readonly ForecastTargetBasis[] = ['MONTHLY_AVERAGE', 'POINT_IN_TIME', 'END_OF_PERIOD']
const HORIZONS = ['1M', '3M', '6M', '12M'] as const

function semantics(targetBasis: ForecastTargetBasis): ForecastTargetSemantics {
  if (targetBasis === 'POINT_IN_TIME') return 'ROLLING_DAILY_POINT_IN_TIME'
  if (targetBasis === 'END_OF_PERIOD') return 'END_OF_PERIOD'
  return 'MONTHLY_AVERAGE'
}

function capability(input: BenchmarkForecastCurrentPreparationRequest, overrides: Partial<InteractiveForecastCapabilityResult> = {}): InteractiveForecastCapabilityResult {
  return {
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetSemantics: semantics(input.targetBasis),
    sourceFrequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
    sourceAvailability: 'AVAILABLE',
    lawfulTargetSemantics: semantics(input.targetBasis),
    status: 'READY',
    currentReadiness: 'READY',
    verificationReadiness: 'READY',
    targetedDataScope: 'SINGLE_SERIES',
    timingMs: 1,
    reason: null,
    ...overrides,
  }
}

function preparation(input: BenchmarkForecastCurrentPreparationRequest, overrides: Partial<BenchmarkForecastCurrentPreparationResult> = {}): BenchmarkForecastCurrentPreparationResult {
  return {
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
    targetSemantics: semantics(input.targetBasis),
    state: 'READY',
    capabilityStatus: 'PREPARATION_REQUIRED',
    currentReadiness: 'NOT_PREPARED',
    prepareAttempted: true,
    prepareStatus: 'READY',
    reason: null,
    timingMs: 1,
    ...overrides,
  }
}

function currentResult(input: BenchmarkForecastCurrentPreparationRequest, overrides: Partial<Extract<BenchmarkForecastCurrentResult, { status: 'AVAILABLE' }>> = {}): BenchmarkForecastCurrentResult {
  return {
    status: 'AVAILABLE',
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
    targetSemantics: semantics(input.targetBasis),
    methodId: semantics(input.targetBasis),
    displayName: 'Brent',
    description: 'Demo benchmark',
    methodVersion: input.targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1',
    lineage: {
      inputSource: 'DYNAMIC_MARKET_DATA_STORE',
      inputRunId: null,
      sourceSeriesId: input.seriesId,
      sourceFrequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
      historyFingerprint: `${input.seriesId}:${input.modelId}:${input.targetBasis}:fp`,
      preparation: {
        method: 'prepare',
        version: 'v1',
        provenanceStatus: 'PROVEN',
      },
    },
    history: {
      frequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
      start: '2024-01-01T00:00:00.000Z',
      end: '2026-09-01T00:00:00.000Z',
      observations: 100,
    },
    forecastOrigin: '2026-09-01T00:00:00.000Z',
    currentForecast: input.targetBasis === 'POINT_IN_TIME'
      ? {}
      : { '1M': { horizon: '1M', horizonSteps: 1, forecastDate: '2026-10-01T00:00:00.000Z', forecastValue: 100 } },
    rollingDailySnapshot: input.targetBasis === 'POINT_IN_TIME'
      ? {
          productionMethod: 'ROLLING_DAILY_POINT_IN_TIME',
          contractVersion: 'v1',
          status: 'AVAILABLE',
          benchmark: {
            benchmarkId: input.seriesId,
            displayName: 'Brent',
            frequency: 'DAILY',
            unit: 'USD',
            currency: 'USD',
            provider: 'Macrobond',
            providerSeriesId: input.seriesId,
          },
          forecastMethod: { id: 'ROLLING_DAILY_POINT_IN_TIME', version: 'v1' },
          model: { id: input.modelId, selectedCandidate: input.modelId },
          origin: { date: '2026-09-01T00:00:00.000Z', value: 100 },
          maxHorizonMonths: 12,
          anchors: [],
          path: [{ date: '2026-09-02T00:00:00.000Z', pointForecast: 101, band: { status: 'NOT_AVAILABLE', reasonCode: null, source: null, lower: null, upper: null } }],
          calibration: {
            availabilityStatus: 'AVAILABLE',
            freshnessStatus: 'FRESH',
            quantileConvention: 'P10/P90',
            coverageLabel: '80%',
            methodologicalMinimumStatus: 'MET',
            updatedAt: '2026-09-01T00:00:00.000Z',
            processedThrough: '2026-09-01T00:00:00.000Z',
            lastResidualAvailabilityDate: '2026-09-01T00:00:00.000Z',
          },
          audit: {
            sourceHistoryFingerprint: `${input.seriesId}:${input.modelId}:${input.targetBasis}:fp`,
            generatedAt: '2026-09-01T00:00:00.000Z',
            sourceLatestObservationDate: '2026-09-01T00:00:00.000Z',
            calendarProjectionMode: 'daily',
            projectionCalendarStrategy: 'trading-days',
            technicalMinimumTrainingObservations: 60,
            methodologicalTrainingEligibilityStatus: 'MET',
            calibrationUpdatedAt: '2026-09-01T00:00:00.000Z',
            calibrationLastResidualAvailabilityDate: '2026-09-01T00:00:00.000Z',
            inputSource: 'DYNAMIC_MARKET_DATA_STORE',
          },
          warnings: [],
        }
      : null,
    freshness: input.targetBasis === 'POINT_IN_TIME'
      ? {
          identity: {
            forecastIdentity: {
              seriesId: input.seriesId,
              targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
              methodId: 'ROLLING_DAILY_POINT_IN_TIME',
              methodVersion: 'rolling-daily-point-in-time-v1',
              modelId: input.modelId,
            },
            inputSource: 'DYNAMIC_MARKET_DATA_STORE',
            sourceHistoryFingerprint: `${input.seriesId}:${input.modelId}:${input.targetBasis}:fp`,
            forecastOrigin: '2026-09-01T00:00:00.000Z',
          },
          status: 'FRESH',
          reason: null,
          snapshotSourceHistoryFingerprint: `${input.seriesId}:${input.modelId}:${input.targetBasis}:fp`,
          currentSourceHistoryFingerprint: `${input.seriesId}:${input.modelId}:${input.targetBasis}:fp`,
        }
      : null,
    ...overrides,
  }
}

function verificationResult(input: BenchmarkForecastCurrentPreparationRequest, overrides: Partial<Extract<BenchmarkForecastVerificationResult, { status: 'AVAILABLE' }>> = {}): BenchmarkForecastVerificationResult {
  return {
    status: 'AVAILABLE',
    seriesId: input.seriesId,
    modelId: input.modelId,
    targetBasis: input.targetBasis,
    targetSemantics: semantics(input.targetBasis),
    methodId: semantics(input.targetBasis),
    displayName: 'Brent',
    description: 'Demo benchmark',
    methodVersion: input.targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1',
    lineage: {
      inputSource: 'DYNAMIC_MARKET_DATA_STORE',
      inputRunId: null,
      sourceSeriesId: input.seriesId,
      sourceFrequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
      historyFingerprint: `${input.seriesId}:${input.modelId}:${input.targetBasis}:fp`,
      preparation: {
        method: 'prepare',
        version: 'v1',
        provenanceStatus: 'PROVEN',
      },
    },
    history: {
      frequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
      start: '2024-01-01T00:00:00.000Z',
      end: '2026-09-01T00:00:00.000Z',
      observations: 100,
    },
    forecastOrigin: '2026-09-01T00:00:00.000Z',
    verification: Object.fromEntries(HORIZONS.map((horizon) => [horizon, {
      horizon,
      horizonSteps: 1,
      origins: 1,
      expectedOrigins: 1,
      successfulOrigins: 1,
      failedOrigins: 0,
      coverage: 1,
      records: [{
        benchmarkId: input.seriesId,
        modelId: input.modelId,
        forecastOrigin: '2026-09-01T00:00:00.000Z',
        horizon,
        horizonSteps: 1,
        forecastDate: '2026-10-01T00:00:00.000Z',
        actualObservedAt: '2026-10-01T00:00:00.000Z',
        originValue: 100,
        forecastValue: 101,
        actualValue: 100,
        error: 1,
        absoluteError: 1,
        delta: 1,
        deltaPct: 0.01,
        maseScale: 1,
      }],
    }])) as Record<string, any>,
    ...overrides,
  }
}

function matrixCell(
  seriesId: string,
  modelId: ForecastPortfolioModelId,
  targetBasis: ForecastTargetBasis,
  kind: 'CURRENT' | 'VERIFICATION',
  horizon: string | null,
  state: 'PASS' | 'FAIL' | 'UNSUPPORTED' = 'PASS',
  reasonCode: string | null = null,
): ForecastAcceptanceCell {
  return {
    identity: {
      seriesId,
      kind,
      modelId,
      targetBasis,
      targetSemantics: semantics(targetBasis),
      methodId: semantics(targetBasis),
      methodVersion: targetBasis === 'POINT_IN_TIME' ? 'rolling-daily-point-in-time-v1' : 'benchmark-forecasting-mvp-phase2-v1',
      sourceFrequency: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
      targetCadence: targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
      historyFingerprint: `${seriesId}:${modelId}:${targetBasis}:fp`,
      verificationHorizon: horizon,
    },
    state,
    failingLayer: state === 'PASS' ? null : 'POSTGRES_ARTIFACT',
    reasonCode: reasonCode as any,
    diagnostic: reasonCode,
    preparation: {
      attempted: false,
      prepareStatus: null,
      warmReadinessVerified: true,
    },
  }
}

function matrixReport(seriesId: string, overrides?: {
  current?: Partial<Record<`${ForecastPortfolioModelId}:${ForecastTargetBasis}`, { state: 'PASS' | 'FAIL' | 'UNSUPPORTED'; reasonCode: string | null }>>
  verification?: Partial<Record<`${ForecastPortfolioModelId}:${ForecastTargetBasis}:${string}`, { state: 'PASS' | 'FAIL' | 'UNSUPPORTED'; reasonCode: string | null }>>
}): ForecastAcceptanceMatrixReport {
  const current = [] as ForecastAcceptanceCell[]
  const verification = [] as ForecastAcceptanceCell[]

  for (const modelId of MODELS) {
    for (const targetBasis of TARGET_BASES) {
      const currentOverride = overrides?.current?.[`${modelId}:${targetBasis}`]
      current.push(matrixCell(seriesId, modelId, targetBasis, 'CURRENT', null, currentOverride?.state, currentOverride?.reasonCode ?? null))

      for (const horizon of HORIZONS) {
        const verificationOverride = overrides?.verification?.[`${modelId}:${targetBasis}:${horizon}`]
        verification.push(matrixCell(seriesId, modelId, targetBasis, 'VERIFICATION', horizon, verificationOverride?.state, verificationOverride?.reasonCode ?? null))
      }
    }
  }

  return {
    seriesId,
    generatedAt: '2026-09-04T18:30:00.000Z',
    current: { pass: current.filter((cell) => cell.state === 'PASS').length, fail: current.filter((cell) => cell.state === 'FAIL').length, unsupported: current.filter((cell) => cell.state === 'UNSUPPORTED').length, cells: current },
    verification: { pass: verification.filter((cell) => cell.state === 'PASS').length, fail: verification.filter((cell) => cell.state === 'FAIL').length, unsupported: verification.filter((cell) => cell.state === 'UNSUPPORTED').length, cells: verification },
    overall: current.some((cell) => cell.state === 'FAIL') || verification.some((cell) => cell.state === 'FAIL') ? 'FAIL' : 'PASS',
  }
}

function createService(options: {
  cohort?: DemoCohortEntry[]
  capabilityResolver?: (input: BenchmarkForecastCurrentPreparationRequest) => InteractiveForecastCapabilityResult
  prepareResolver?: (input: BenchmarkForecastCurrentPreparationRequest) => BenchmarkForecastCurrentPreparationResult
  currentResolver?: (input: BenchmarkForecastCurrentPreparationRequest) => BenchmarkForecastCurrentResult
  verificationResolver?: (input: BenchmarkForecastCurrentPreparationRequest) => BenchmarkForecastVerificationResult
  matrixResolver?: (seriesId: string, allowPrepare: boolean) => ForecastAcceptanceMatrixReport
  benchmarkTimeoutMs?: number
  deployedRevision?: string | null
  prepareCalls?: string[]
}) {
  return createDemoCertificationService({
    now: () => '2026-09-04T18:30:00.000Z',
    benchmarkTimeoutMs: options.benchmarkTimeoutMs,
    cohort: options.cohort ?? [{ seriesId: 'wocaes0074', benchmarkName: 'Brent', group: 'PRIMARY' }],
    resolveReleaseSnapshot: (cohort, mode) => ({
      sourceRevision: options.deployedRevision ?? 'rev-a',
      deployedRevision: options.deployedRevision ?? 'rev-a',
      environment: 'test',
      environmentUrl: 'https://analytics-demo-sg-porr.spendguru.app',
      acceptedAt: '2026-09-04T18:30:00.000Z',
      cohort: cohort.map((entry) => ({ seriesId: entry.seriesId, benchmarkName: entry.benchmarkName, group: entry.group })),
    }),
    readCapability: async (input) => options.capabilityResolver ? options.capabilityResolver(input) : capability(input),
    prepareCurrent: async (input) => {
      options.prepareCalls?.push(`${input.seriesId}:${input.modelId}:${input.targetBasis}`)
      return options.prepareResolver ? options.prepareResolver(input) : preparation(input)
    },
    readCurrent: async (seriesId, modelId, targetBasis) => (
      options.currentResolver
        ? options.currentResolver({ seriesId, modelId, targetBasis })
        : currentResult({ seriesId, modelId, targetBasis })
    ),
    readVerification: async (seriesId, modelId, targetBasis) => (
      options.verificationResolver
        ? options.verificationResolver({ seriesId, modelId, targetBasis })
        : verificationResult({ seriesId, modelId, targetBasis })
    ),
    evaluateMatrix: async (seriesId, allowPrepare) => (
      options.matrixResolver
        ? options.matrixResolver(seriesId, allowPrepare)
        : matrixReport(seriesId)
    ),
  })
}

test('A. full pass certifies the benchmark as demo-safe', async () => {
  const report = await createService({}).run()
  const benchmark = report.benchmarks[0]

  assert.equal(report.demoCohortDefined, 'YES')
  assert.equal(benchmark.demoSafe, 'YES')
  assert.equal(benchmark.precompute.status, 'PASS')
  assert.equal(benchmark.matrix.status, 'PASS')
  assert.equal(benchmark.freshness.status, 'PASS')
  assert.equal(benchmark.warmRehearsal.status, 'PASS')
})

test('A2. available warm-ready capability still certifies as demo-safe', async () => {
  const report = await createService({
    capabilityResolver: (input) => capability(input, { status: 'AVAILABLE' }),
  }).run()
  const benchmark = report.benchmarks[0]

  assert.equal(benchmark.demoSafe, 'YES')
  assert.equal(benchmark.precompute.status, 'PASS')
  assert.equal(benchmark.reason, null)
})

test('B. one lawful matrix fail blocks demo certification', async () => {
  const report = await createService({
    matrixResolver: (seriesId) => matrixReport(seriesId, {
      current: {
        'naive:MONTHLY_AVERAGE': { state: 'FAIL', reasonCode: 'READ_NOT_AVAILABLE' },
      },
    }),
  }).run()

  assert.equal(report.benchmarks[0]?.demoSafe, 'NO')
  assert.equal(report.benchmarks[0]?.reason, 'REREAD_FAIL')
  assert.equal(report.benchmarks[0]?.matrix.status, 'FAIL')
})

test('C. unsupported non-required identity does not block certification', async () => {
  const report = await createService({
    cohort: [{
      seriesId: 'wocaes0074',
      benchmarkName: 'Brent',
      group: 'PRIMARY',
      requiredTargetBases: ['MONTHLY_AVERAGE'],
      optionalTargetBases: ['POINT_IN_TIME'],
    }],
    capabilityResolver: (input) => (
      input.targetBasis === 'POINT_IN_TIME'
        ? capability(input, { status: 'NOT_IMPLEMENTED', currentReadiness: 'NOT_PREPARED', verificationReadiness: 'NOT_PREPARED', reason: 'Unsupported point-in-time demo path.' })
        : capability(input)
    ),
    matrixResolver: (seriesId) => matrixReport(seriesId),
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
  assert.equal(report.benchmarks[0]?.precompute.variants.some((variant) => variant.targetBasis === 'POINT_IN_TIME' && variant.status === 'UNSUPPORTED'), true)
})

test('D. required unsupported identity fails certification', async () => {
  const report = await createService({
    cohort: [{
      seriesId: 'wocaes0074',
      benchmarkName: 'Brent',
      group: 'PRIMARY',
      requiredTargetBases: ['POINT_IN_TIME'],
    }],
    capabilityResolver: (input) => capability(input, {
      status: 'NOT_IMPLEMENTED',
      currentReadiness: 'NOT_PREPARED',
      verificationReadiness: 'NOT_PREPARED',
      reason: 'Unsupported demo path.',
    }),
    matrixResolver: (seriesId) => matrixReport(seriesId, {
      current: {
        'naive:POINT_IN_TIME': { state: 'UNSUPPORTED', reasonCode: 'UNSUPPORTED_COMBINATION' },
        'damped_holt:POINT_IN_TIME': { state: 'UNSUPPORTED', reasonCode: 'UNSUPPORTED_COMBINATION' },
        'ets:POINT_IN_TIME': { state: 'UNSUPPORTED', reasonCode: 'UNSUPPORTED_COMBINATION' },
        'arima:POINT_IN_TIME': { state: 'UNSUPPORTED', reasonCode: 'UNSUPPORTED_COMBINATION' },
      },
      verification: {
        'naive:POINT_IN_TIME:1M': { state: 'UNSUPPORTED', reasonCode: 'UNSUPPORTED_COMBINATION' },
      },
    }),
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'NO')
  assert.equal(report.benchmarks[0]?.reason, 'PRECOMPUTE_FAIL')
})

test('E. stale fingerprint fails the explicit freshness gate', async () => {
  const report = await createService({
    matrixResolver: (seriesId) => matrixReport(seriesId, {
      current: {
        'naive:POINT_IN_TIME': { state: 'FAIL', reasonCode: 'STALE_FINGERPRINT' },
      },
    }),
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'NO')
  assert.equal(report.benchmarks[0]?.reason, 'REREAD_FAIL')
  assert.equal(report.benchmarks[0]?.freshness.status, 'FAIL')
})

test('F. revision changes invalidate a previous certification', async () => {
  const priorSnapshots: DemoCertificationSnapshot[] = [{
    mode: 'CERTIFY',
    seriesId: 'wocaes0074',
    deployedRevision: 'rev-old',
    fingerprintDigest: 'wocaes0074:naive:MONTHLY_AVERAGE:fp',
  }]

  const report = await createService({ deployedRevision: 'rev-new' }).run({ priorSnapshots, includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'NO')
  assert.equal(report.benchmarks[0]?.reason, 'REVISION_CHANGED')
  assert.deepEqual(report.certificationInvalidation.reasons, [{ seriesId: 'wocaes0074', reason: 'REVISION_CHANGED' }])
})

test('G. warm revalidation stays pass without new prepare calls', async () => {
  const prepareCalls: string[] = []
  const report = await createService({ prepareCalls }).run({ mode: 'REVALIDATE', includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
  assert.equal(report.benchmarks[0]?.warmRehearsal.warmReuse, 'PASS')
  assert.deepEqual(prepareCalls, [])
})

test('H. rehearsal failure blocks demo certification', async () => {
  const report = await createService({
    currentResolver: (input) => (
      input.modelId === 'arima' && input.targetBasis === 'POINT_IN_TIME'
        ? currentResult(input, { freshness: { ...(currentResult(input) as Extract<BenchmarkForecastCurrentResult, { status: 'AVAILABLE' }>).freshness!, status: 'STALE', reason: 'SOURCE_HISTORY_FINGERPRINT_MISMATCH' } })
        : currentResult(input)
    ),
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'NO')
  assert.equal(report.benchmarks[0]?.reason, 'WARM_REHEARSAL_FAIL')
})

test('I. Stage 2 verification regression blocks demo certification', async () => {
  const report = await createService({
    matrixResolver: (seriesId) => matrixReport(seriesId, {
      verification: {
        'ets:END_OF_PERIOD:12M': { state: 'FAIL', reasonCode: 'MISSING_REQUIRED_POINTS' },
      },
    }),
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'NO')
  assert.equal(report.benchmarks[0]?.matrix.status, 'FAIL')
})

test('I2. one benchmark runtime failure degrades to ENVIRONMENT_NOT_READY instead of aborting the report', async () => {
  const report = await createService({
    verificationResolver: (input) => {
      if (input.seriesId === 'lmeofcucashask' && input.modelId === 'arima' && input.targetBasis === 'POINT_IN_TIME') {
        throw new Error('No persisted point-in-time forecast verification is available for the selected series and model.')
      }

      return verificationResult(input)
    },
  }).run({ seriesIds: ['wocaes0074', 'lmeofcucashask'] })

  assert.equal(report.summary.demoCohort, 2)
  assert.equal(report.summary.demoSafe, 1)
  assert.equal(report.summary.notDemoSafe, 1)
  assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
  assert.equal(report.benchmarks[1]?.demoSafe, 'NO')
  assert.equal(report.benchmarks[1]?.reason, 'ENVIRONMENT_NOT_READY')
  assert.equal(report.benchmarks[1]?.precompute.status, 'FAIL')
  assert.match(report.benchmarks[1]?.precompute.reason ?? '', /No persisted point-in-time forecast verification/i)
})

test('I3. one benchmark timeout degrades to ENVIRONMENT_NOT_READY instead of timing out the whole report', async () => {
  const report = await createService({
    benchmarkTimeoutMs: 1,
    verificationResolver: async (input) => {
      if (input.seriesId === 'lmeofcucashask') {
        return new Promise(() => {}) as Promise<BenchmarkForecastVerificationResult>
      }

      return verificationResult(input)
    },
  }).run({ seriesIds: ['wocaes0074', 'lmeofcucashask'] })

  assert.equal(report.summary.demoCohort, 2)
  assert.equal(report.summary.demoSafe, 1)
  assert.equal(report.summary.notDemoSafe, 1)
  assert.equal(report.benchmarks[1]?.demoSafe, 'NO')
  assert.equal(report.benchmarks[1]?.reason, 'ENVIRONMENT_NOT_READY')
  assert.match(report.benchmarks[1]?.precompute.reason ?? '', /timed out/i)
})

test('J. Stage 3 cohort config does not restrict product capability', async () => {
  const report = await createService({}).run({ includeFallback: true, seriesIds: ['custom-non-cohort-series'] })
  const defaultCohort = getDefaultDemoCertificationCohort()

  assert.equal(report.productSafety.benchmarkFinderRestricted, 'NO')
  assert.equal(report.productSafety.nonDemoBenchmarksHidden, 'NO')
  assert.equal(report.productSafety.productCapabilityRestricted, 'NO')
  assert.equal(defaultCohort.some((entry) => entry.seriesId === 'custom-non-cohort-series'), false)
  assert.equal(report.benchmarks[0]?.seriesId, 'custom-non-cohort-series')
})