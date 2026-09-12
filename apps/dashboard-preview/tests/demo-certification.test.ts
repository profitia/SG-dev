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
import type {
  ForecastAcceptanceCell,
  ForecastAcceptanceMatrixEvaluationOptions,
  ForecastAcceptanceMatrixReport,
} from '@/lib/benchmark-forecast/acceptance-matrix'

const MODELS: readonly ForecastPortfolioModelId[] = ['naive', 'damped_holt', 'ets', 'arima']
const TARGET_BASES: readonly ForecastTargetBasis[] = ['MONTHLY_AVERAGE', 'POINT_IN_TIME', 'END_OF_PERIOD']
const HORIZONS = ['1M', '3M', '6M', '12M'] as const
type MaybePromise<T> = T | Promise<T>

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, resolve, reject }
}

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
    targetCadence: null,
    sourceAvailability: 'AVAILABLE',
    lawfulTargetSemantics: semantics(input.targetBasis),
    status: 'READY',
    currentReadiness: 'READY',
    verificationReadiness: 'READY',
    recentVerificationReadiness: 'READY',
    fullVerificationReadiness: 'READY',
    readiness: {
      fastReady: true,
      calibratedReady: true,
      fullReady: true,
      blockers: [],
    },
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
  capabilityResolver?: (input: BenchmarkForecastCurrentPreparationRequest, options?: { signal?: AbortSignal }) => MaybePromise<InteractiveForecastCapabilityResult>
  prepareResolver?: (input: BenchmarkForecastCurrentPreparationRequest, options?: { signal?: AbortSignal }) => MaybePromise<BenchmarkForecastCurrentPreparationResult>
  verificationPrepareResolver?: (
    input: BenchmarkForecastCurrentPreparationRequest,
    cadence?: { sourceFrequency: string, targetCadence: string },
    options?: { signal?: AbortSignal },
  ) => MaybePromise<BenchmarkForecastVerificationResult>
  currentResolver?: (
    input: BenchmarkForecastCurrentPreparationRequest,
    cadence?: { sourceFrequency: string, targetCadence: string },
  ) => MaybePromise<BenchmarkForecastCurrentResult>
  verificationResolver?: (
    input: BenchmarkForecastCurrentPreparationRequest,
    cadence?: { sourceFrequency: string, targetCadence: string },
  ) => MaybePromise<BenchmarkForecastVerificationResult>
  matrixResolver?: (seriesId: string, allowPrepare: boolean, options?: ForecastAcceptanceMatrixEvaluationOptions) => MaybePromise<ForecastAcceptanceMatrixReport>
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
    readCapability: async (input, requestOptions) => options.capabilityResolver ? options.capabilityResolver(input, requestOptions) : capability(input),
    prepareCurrent: async (input, requestOptions) => {
      options.prepareCalls?.push(`${input.seriesId}:${input.modelId}:${input.targetBasis}`)
      return options.prepareResolver ? options.prepareResolver(input, requestOptions) : preparation(input)
    },
    prepareVerification: async (input, cadence, requestOptions) => (
      options.verificationPrepareResolver
        ? options.verificationPrepareResolver(input, cadence, requestOptions)
        : verificationResult(input)
    ),
    readCurrent: async (seriesId, modelId, targetBasis, cadence) => (
      options.currentResolver
        ? options.currentResolver({ seriesId, modelId, targetBasis }, cadence)
        : currentResult({ seriesId, modelId, targetBasis })
    ),
    readVerification: async (seriesId, modelId, targetBasis, cadence) => (
      options.verificationResolver
        ? options.verificationResolver({ seriesId, modelId, targetBasis }, cadence)
        : verificationResult({ seriesId, modelId, targetBasis })
    ),
    evaluateMatrix: async (seriesId, allowPrepare, requestOptions) => (
      options.matrixResolver
        ? options.matrixResolver(seriesId, allowPrepare, requestOptions)
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

test('A3. exact full historical verification readiness is required for fast-path certification and revalidation', async () => {
  const capabilityResolver = (input: BenchmarkForecastCurrentPreparationRequest) => capability(input, {
    verificationReadiness: 'READY',
    recentVerificationReadiness: 'READY',
    fullVerificationReadiness: 'NOT_PREPARED',
    readiness: {
      fastReady: true,
      calibratedReady: false,
      fullReady: false,
      blockers: ['FULL_HISTORICAL_MISSING'],
    },
    reason: 'No exact-identity prepared Historical Verification is available.',
  })

  const certifyReport = await createService({
    capabilityResolver,
  }).run({ includeFallback: false })
  const revalidateReport = await createService({
    capabilityResolver,
  }).run({ mode: 'REVALIDATE', includeFallback: false })

  assert.equal(certifyReport.benchmarks[0]?.demoSafe, 'NO')
  assert.equal(certifyReport.benchmarks[0]?.precompute.status, 'FAIL')
  assert.equal(certifyReport.benchmarks[0]?.reason, 'PRECOMPUTE_FAIL')
  assert.equal(certifyReport.benchmarks[0]?.precompute.variants[0]?.fullVerificationReadiness, 'NOT_PREPARED')

  assert.equal(revalidateReport.benchmarks[0]?.demoSafe, 'NO')
  assert.equal(revalidateReport.benchmarks[0]?.precompute.status, 'FAIL')
  assert.equal(revalidateReport.benchmarks[0]?.reason, 'PRECOMPUTE_FAIL')
})

test('A4. certify mode can recover exact full historical readiness through SG Runtime verification materialization', async () => {
  const verifiedVariants = new Set<string>()
  const verificationPrepareCalls: string[] = []
  const keyOf = (input: BenchmarkForecastCurrentPreparationRequest) => `${input.seriesId}:${input.modelId}:${input.targetBasis}`

  const report = await createService({
    cohort: [{
      seriesId: 'lmeofcucashask',
      benchmarkName: 'Copper',
      group: 'PRIMARY',
      requiredModels: ['naive'],
      requiredTargetBases: ['MONTHLY_AVERAGE'],
      requiredVerificationHorizons: ['1M'],
    }],
    capabilityResolver: (input) => capability(input, verifiedVariants.has(keyOf(input))
      ? {}
      : {
          sourceFrequency: 'DAILY',
          targetCadence: 'MONTHLY',
          verificationReadiness: 'READY',
          recentVerificationReadiness: 'READY',
          fullVerificationReadiness: 'NOT_PREPARED',
          readiness: {
            fastReady: true,
            calibratedReady: false,
            fullReady: false,
            blockers: ['FULL_HISTORICAL_MISSING'],
          },
          reason: 'No exact-identity prepared Historical Verification is available.',
        }),
    verificationPrepareResolver: (input, cadence) => {
      verificationPrepareCalls.push(`${keyOf(input)}:${cadence?.sourceFrequency ?? 'none'}:${cadence?.targetCadence ?? 'none'}`)
      verifiedVariants.add(keyOf(input))
      return verificationResult(input)
    },
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
  assert.equal(report.benchmarks[0]?.precompute.status, 'PASS')
  assert.deepEqual(verificationPrepareCalls, ['lmeofcucashask:naive:MONTHLY_AVERAGE:DAILY:MONTHLY'])
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

test('G2. stale capability triggers preparation and can recover precompute', async () => {
  const prepareCalls: string[] = []
  const warmedVariants = new Set<string>()
  const keyOf = (input: BenchmarkForecastCurrentPreparationRequest) => `${input.seriesId}:${input.modelId}:${input.targetBasis}`
  const report = await createService({
    prepareCalls,
    capabilityResolver: (input) => capability(input, {
      ...(warmedVariants.has(keyOf(input)) ? {} : {
        status: 'STALE' as never,
        currentReadiness: 'STALE',
        verificationReadiness: 'STALE',
        recentVerificationReadiness: 'STALE',
        fullVerificationReadiness: 'STALE',
        readiness: {
          fastReady: false,
          calibratedReady: false,
          fullReady: false,
          blockers: ['CURRENT_STALE', 'FULL_HISTORICAL_STALE'],
        },
        reason: 'STALE',
      }),
    }),
    prepareResolver: (input) => {
      warmedVariants.add(keyOf(input))
      return preparation(input)
    },
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
  assert.equal(report.benchmarks[0]?.reason, null)
  assert.equal(report.benchmarks[0]?.precompute.status, 'PASS')
  assert.deepEqual(prepareCalls, [
    'wocaes0074:naive:MONTHLY_AVERAGE',
    'wocaes0074:naive:POINT_IN_TIME',
    'wocaes0074:naive:END_OF_PERIOD',
    'wocaes0074:damped_holt:MONTHLY_AVERAGE',
    'wocaes0074:damped_holt:POINT_IN_TIME',
    'wocaes0074:damped_holt:END_OF_PERIOD',
    'wocaes0074:ets:MONTHLY_AVERAGE',
    'wocaes0074:ets:POINT_IN_TIME',
    'wocaes0074:ets:END_OF_PERIOD',
    'wocaes0074:arima:MONTHLY_AVERAGE',
    'wocaes0074:arima:POINT_IN_TIME',
    'wocaes0074:arima:END_OF_PERIOD',
  ])
})

test('G3. current preparation does not recover certification when exact historical verification remains missing', async () => {
  const prepareCalls: string[] = []
  const warmedVariants = new Set<string>()
  const keyOf = (input: BenchmarkForecastCurrentPreparationRequest) => `${input.seriesId}:${input.modelId}:${input.targetBasis}`

  const report = await createService({
    prepareCalls,
    capabilityResolver: (input) => {
      const key = keyOf(input)
      if (!warmedVariants.has(key)) {
        return capability(input, {
          status: 'STALE' as never,
          currentReadiness: 'STALE',
          verificationReadiness: 'STALE',
          recentVerificationReadiness: 'STALE',
          fullVerificationReadiness: 'STALE',
          readiness: {
            fastReady: false,
            calibratedReady: false,
            fullReady: false,
            blockers: ['CURRENT_STALE', 'FULL_HISTORICAL_STALE'],
          },
          reason: 'STALE',
        })
      }

      return capability(input, {
        verificationReadiness: 'READY',
        recentVerificationReadiness: 'READY',
        fullVerificationReadiness: 'NOT_PREPARED',
        readiness: {
          fastReady: true,
          calibratedReady: false,
          fullReady: false,
          blockers: ['FULL_HISTORICAL_MISSING'],
        },
        reason: 'No exact-identity prepared Historical Verification is available.',
      })
    },
    prepareResolver: (input) => {
      warmedVariants.add(keyOf(input))
      return preparation(input)
    },
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'NO')
  assert.equal(report.benchmarks[0]?.precompute.status, 'FAIL')
  assert.equal(report.benchmarks[0]?.reason, 'PRECOMPUTE_FAIL')
  assert.equal(report.benchmarks[0]?.precompute.variants[0]?.fullVerificationReadiness, 'NOT_PREPARED')
  assert.equal(prepareCalls.length, MODELS.length * TARGET_BASES.length)
})

test('G4. current preparation can be followed by exact verification materialization to recover certification', async () => {
  const prepareCalls: string[] = []
  const verifiedVariants = new Set<string>()
  const warmedVariants = new Set<string>()
  const keyOf = (input: BenchmarkForecastCurrentPreparationRequest) => `${input.seriesId}:${input.modelId}:${input.targetBasis}`

  const report = await createService({
    cohort: [{
      seriesId: 'lmeofalcashask',
      benchmarkName: 'Aluminium',
      group: 'PRIMARY',
      requiredModels: ['naive'],
      requiredTargetBases: ['POINT_IN_TIME'],
      requiredVerificationHorizons: ['1M'],
    }],
    prepareCalls,
    capabilityResolver: (input) => {
      const key = keyOf(input)
      if (!warmedVariants.has(key)) {
        return capability(input, {
          sourceFrequency: 'DAILY',
          targetCadence: 'DAILY',
          status: 'STALE' as never,
          currentReadiness: 'STALE',
          verificationReadiness: 'STALE',
          recentVerificationReadiness: 'STALE',
          fullVerificationReadiness: 'STALE',
          readiness: {
            fastReady: false,
            calibratedReady: false,
            fullReady: false,
            blockers: ['CURRENT_STALE', 'FULL_HISTORICAL_STALE'],
          },
          reason: 'STALE',
        })
      }

      return capability(input, verifiedVariants.has(key)
        ? {
            sourceFrequency: 'DAILY',
            targetCadence: 'DAILY',
          }
        : {
            sourceFrequency: 'DAILY',
            targetCadence: 'DAILY',
            verificationReadiness: 'READY',
            recentVerificationReadiness: 'READY',
            fullVerificationReadiness: 'STALE',
            readiness: {
              fastReady: true,
              calibratedReady: false,
              fullReady: false,
              blockers: ['FULL_HISTORICAL_STALE'],
            },
            reason: 'Prepared Rolling Daily Historical Verification is incomplete for the latest lawful source observation.',
          })
    },
    prepareResolver: (input) => {
      warmedVariants.add(keyOf(input))
      return preparation(input)
    },
    verificationPrepareResolver: (input) => {
      verifiedVariants.add(keyOf(input))
      return verificationResult(input)
    },
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
  assert.equal(report.benchmarks[0]?.precompute.status, 'PASS')
  assert.deepEqual(prepareCalls, ['lmeofalcashask:naive:POINT_IN_TIME'])
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

test('J. sparse-series cadence is preserved for certification rereads', async () => {
  const currentCadenceCalls: string[] = []
  const verificationCadenceCalls: string[] = []

  const report = await createService({
    cohort: [{
      seriesId: 'lmeofcucashask',
      benchmarkName: 'Copper',
      group: 'PRIMARY',
      requiredModels: ['naive'],
      requiredTargetBases: ['MONTHLY_AVERAGE', 'END_OF_PERIOD'],
      requiredVerificationHorizons: ['1M'],
    }],
    capabilityResolver: (input) => capability(input, {
      sourceFrequency: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'WEEKLY',
      targetCadence: input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY',
    }),
    currentResolver: (input, cadence) => {
      currentCadenceCalls.push(`${input.modelId}:${input.targetBasis}:${cadence?.sourceFrequency ?? 'none'}:${cadence?.targetCadence ?? 'none'}`)
      return currentResult(input, {
        lineage: {
          inputSource: 'DYNAMIC_MARKET_DATA_STORE',
          inputRunId: null,
          sourceSeriesId: input.seriesId,
          sourceFrequency: cadence?.sourceFrequency ?? (input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY'),
          historyFingerprint: `${input.seriesId}:${input.modelId}:${input.targetBasis}:fp`,
          preparation: {
            method: 'prepare',
            version: 'v1',
            provenanceStatus: 'PROVEN',
          },
        },
      })
    },
    verificationResolver: (input, cadence) => {
      verificationCadenceCalls.push(`${input.modelId}:${input.targetBasis}:${cadence?.sourceFrequency ?? 'none'}:${cadence?.targetCadence ?? 'none'}`)
      if (input.targetBasis !== 'POINT_IN_TIME' && (!cadence || cadence.sourceFrequency !== 'WEEKLY' || cadence.targetCadence !== 'MONTHLY')) {
        return {
          status: 'NOT_AVAILABLE',
          seriesId: input.seriesId,
          modelId: input.modelId,
          targetBasis: input.targetBasis,
          targetSemantics: semantics(input.targetBasis),
          methodId: semantics(input.targetBasis),
          reason: 'PREPARATION_REQUIRED: Missing sparse-series cadence identity.',
        }
      }

      return verificationResult(input, {
        lineage: {
          inputSource: 'DYNAMIC_MARKET_DATA_STORE',
          inputRunId: null,
          sourceSeriesId: input.seriesId,
          sourceFrequency: cadence?.sourceFrequency ?? (input.targetBasis === 'POINT_IN_TIME' ? 'DAILY' : 'MONTHLY'),
          historyFingerprint: `${input.seriesId}:${input.modelId}:${input.targetBasis}:fp`,
          preparation: {
            method: 'prepare',
            version: 'v1',
            provenanceStatus: 'PROVEN',
          },
        },
      })
    },
  }).run({ seriesIds: ['lmeofcucashask'], includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
  assert.equal(report.benchmarks[0]?.matrix.status, 'PASS')
  assert.equal(report.benchmarks[0]?.warmRehearsal.verification, 'PASS')
  assert.ok(currentCadenceCalls.includes('naive:MONTHLY_AVERAGE:WEEKLY:MONTHLY'))
  assert.ok(currentCadenceCalls.includes('naive:END_OF_PERIOD:WEEKLY:MONTHLY'))
  assert.ok(verificationCadenceCalls.includes('naive:MONTHLY_AVERAGE:WEEKLY:MONTHLY'))
  assert.ok(verificationCadenceCalls.includes('naive:END_OF_PERIOD:WEEKLY:MONTHLY'))
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

test('I4. one benchmark timeout aborts in-flight SG Runtime-backed capability work', async () => {
  let capturedSignal: AbortSignal | undefined

  const report = await createService({
    benchmarkTimeoutMs: 1,
    capabilityResolver: (input, options) => {
      if (input.seriesId !== 'lmeofcucashask') {
        return capability(input)
      }

      capturedSignal = options?.signal

      return new Promise<InteractiveForecastCapabilityResult>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const aborted = new Error('capability aborted') as Error & { name: string }
          aborted.name = 'AbortError'
          reject(aborted)
        }, { once: true })
      }) as never
    },
  }).run({ seriesIds: ['wocaes0074', 'lmeofcucashask'] })

  assert.equal(report.benchmarks[1]?.reason, 'ENVIRONMENT_NOT_READY')
  assert.equal(capturedSignal?.aborted, true)
})

test('I4b. timed out benchmark reports the timeout reason instead of leaking abort errors', async () => {
  const report = await createService({
    benchmarkTimeoutMs: 1,
    capabilityResolver: (input, options) => {
      if (input.seriesId !== 'lmeofcucashask') {
        return capability(input)
      }

      return new Promise<InteractiveForecastCapabilityResult>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const aborted = new Error('This operation was aborted') as Error & { name: string }
          aborted.name = 'AbortError'
          reject(aborted)
        }, { once: true })
      }) as never
    },
  }).run({ seriesIds: ['wocaes0074', 'lmeofcucashask'] })

  assert.equal(report.benchmarks[1]?.reason, 'ENVIRONMENT_NOT_READY')
  assert.match(report.benchmarks[1]?.precompute.reason ?? '', /timed out/i)
})

test('I5. warm rehearsal reuses reads and completes within the benchmark timeout budget', async () => {
  let currentCalls = 0
  let verificationCalls = 0

  const report = await createService({
    benchmarkTimeoutMs: 80,
    currentResolver: async (input) => {
      currentCalls += 1
      return await new Promise<BenchmarkForecastCurrentResult>((resolve) => {
        setTimeout(() => resolve(currentResult(input)), 10)
      })
    },
    verificationResolver: async (input) => {
      verificationCalls += 1
      return await new Promise<BenchmarkForecastVerificationResult>((resolve) => {
        setTimeout(() => resolve(verificationResult(input)), 10)
      })
    },
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
  assert.equal(report.benchmarks[0]?.reason, null)
  assert.equal(currentCalls, MODELS.length * TARGET_BASES.length)
  assert.equal(verificationCalls, MODELS.length * TARGET_BASES.length)
})

test('I6. benchmark evaluations run concurrently across the cohort', async () => {
  const started: string[] = []
  const released = new Map<string, () => void>()
  const matrixCalls = new Map<string, number>()

  const reportPromise = createService({
    cohort: [
      { seriesId: 'wocaes0074', benchmarkName: 'Brent', group: 'PRIMARY' },
      { seriesId: 'lmeofcucashask', benchmarkName: 'Copper', group: 'PRIMARY' },
    ],
    matrixResolver: async (seriesId) => {
      const nextCalls = (matrixCalls.get(seriesId) ?? 0) + 1
      matrixCalls.set(seriesId, nextCalls)

      if (nextCalls > 1) {
        return matrixReport(seriesId)
      }

      started.push(seriesId)

      await new Promise<void>((resolve) => {
        released.set(seriesId, resolve)
      })

      return matrixReport(seriesId)
    },
  }).run({ includeFallback: false })

  await new Promise<void>((resolve, reject) => {
    setImmediate(() => {
      try {
        assert.deepEqual(started, ['wocaes0074', 'lmeofcucashask'])
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })

  released.get('wocaes0074')?.()
  released.get('lmeofcucashask')?.()

  const report = await reportPromise
  assert.equal(report.summary.demoCohort, 2)
  assert.equal(report.benchmarks[0]?.seriesId, 'wocaes0074')
  assert.equal(report.benchmarks[1]?.seriesId, 'lmeofcucashask')
})

test('I7. precompute and matrix reuse the same preparation for a stale variant', async () => {
  const preparedVariants = new Set<string>()
  const prepareCalls: string[] = []
  const capabilityCalls = new Map<string, number>()
  const keyOf = (input: BenchmarkForecastCurrentPreparationRequest) => `${input.seriesId}:${input.modelId}:${input.targetBasis}`
  const originalRenderExternalUrl = process.env.RENDER_EXTERNAL_URL

  process.env.RENDER_EXTERNAL_URL = 'https://dashboards-library.onrender.com'

  try {
    const report = await createDemoCertificationService({
      now: () => '2026-09-04T18:30:00.000Z',
      benchmarkTimeoutMs: 100,
      cohort: [{
        seriesId: 'wocaes0074',
        benchmarkName: 'Brent',
        group: 'PRIMARY',
        requiredModels: ['naive'],
        requiredTargetBases: ['MONTHLY_AVERAGE'],
      }],
      resolveReleaseSnapshot: (cohort) => ({
        sourceRevision: 'rev-a',
        deployedRevision: 'rev-a',
        environment: 'render',
        environmentUrl: 'https://dashboards-library.onrender.com',
        acceptedAt: '2026-09-04T18:30:00.000Z',
        cohort: cohort.map((entry) => ({ seriesId: entry.seriesId, benchmarkName: entry.benchmarkName, group: entry.group })),
      }),
      readCapability: async (input) => {
        capabilityCalls.set(keyOf(input), (capabilityCalls.get(keyOf(input)) ?? 0) + 1)

        if (input.modelId !== 'naive' || input.targetBasis !== 'MONTHLY_AVERAGE') {
          return capability(input)
        }

        return preparedVariants.has(keyOf(input))
          ? capability(input)
          : capability(input, {
              status: 'STALE' as never,
              currentReadiness: 'STALE',
              verificationReadiness: 'STALE',
              reason: 'STALE',
            })
      },
      prepareCurrent: async (input) => {
        prepareCalls.push(keyOf(input))
        preparedVariants.add(keyOf(input))
        return preparation(input)
      },
      readCurrent: async (seriesId, modelId, targetBasis) => currentResult({ seriesId, modelId, targetBasis }),
      readVerification: async (seriesId, modelId, targetBasis) => verificationResult({ seriesId, modelId, targetBasis }),
    }).run({ includeFallback: false })

    assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
    assert.deepEqual(prepareCalls, ['wocaes0074:naive:MONTHLY_AVERAGE'])
    assert.equal(capabilityCalls.get('wocaes0074:naive:MONTHLY_AVERAGE'), 2)
  } finally {
    if (originalRenderExternalUrl === undefined) {
      delete process.env.RENDER_EXTERNAL_URL
    } else {
      process.env.RENDER_EXTERNAL_URL = originalRenderExternalUrl
    }
  }
})

test('I8. certification overlaps PIT materialization with non-PIT matrix and waits before PIT evaluation', async () => {
  const events: string[] = []
  const pipelineStarted = createDeferred<void>()
  const releasePipeline = createDeferred<void>()
  let pitReady = false

  const reportPromise = createService({
    cohort: [{
      seriesId: 'wocaes0074',
      benchmarkName: 'Brent',
      group: 'PRIMARY',
      requiredModels: ['naive'],
      requiredTargetBases: ['MONTHLY_AVERAGE', 'POINT_IN_TIME'],
    }],
    capabilityResolver: (input) => {
      if (input.targetBasis !== 'POINT_IN_TIME') {
        return capability(input)
      }

      return capability(input, {
        sourceFrequency: 'DAILY',
        targetCadence: 'DAILY',
        verificationReadiness: pitReady ? 'READY' : 'NOT_PREPARED',
        fullVerificationReadiness: pitReady ? 'READY' : 'NOT_PREPARED',
        readiness: {
          fastReady: true,
          calibratedReady: true,
          fullReady: pitReady,
          blockers: pitReady ? [] : ['PIT_VERIFICATION_NOT_READY'],
        },
      } as never)
    },
    verificationPrepareResolver: async (input) => {
      events.push(`pit-pipeline:start:${input.modelId}`)
      pipelineStarted.resolve()
      await releasePipeline.promise
      pitReady = true
      events.push(`pit-pipeline:end:${input.modelId}`)
      return verificationResult(input)
    },
    matrixResolver: async (seriesId, _allowPrepare, requestOptions) => {
      events.push('non-pit:start')
      await pipelineStarted.promise
      events.push('non-pit:end')
      await requestOptions?.beforePointInTimeEvaluation?.()
      events.push('pit:start')
      return matrixReport(seriesId)
    },
  }).run({ includeFallback: false, diagnostics: { enabled: true } })

  await pipelineStarted.promise
  await new Promise<void>((resolve) => setImmediate(resolve))
  releasePipeline.resolve()

  const report = await reportPromise
  const benchmark = report.benchmarks[0]
  const timeline = benchmark?.diagnostics?.timeline ?? []

  assert.equal(benchmark?.demoSafe, 'YES')
  assert.ok(events.indexOf('pit-pipeline:start:naive') < events.indexOf('non-pit:end'))
  assert.ok(events.indexOf('pit:start') > events.indexOf('pit-pipeline:end:naive'))
  assert.equal(timeline.filter((event) => event.eventType === 'PHASE' && event.phase === 'PIT_MATERIALIZATION').length, 1)
})

test('I9. PIT materialization remains serial across models and does not dispatch duplicate preparation', async () => {
  const prepareCalls: string[] = []
  let inFlight = 0
  let maxInFlight = 0
  const pitReady = new Set<string>()

  const report = await createService({
    cohort: [{
      seriesId: 'wocaes0074',
      benchmarkName: 'Brent',
      group: 'PRIMARY',
      requiredModels: [...MODELS],
      requiredTargetBases: ['POINT_IN_TIME'],
    }],
    capabilityResolver: (input) => {
      if (input.targetBasis !== 'POINT_IN_TIME') {
        return capability(input)
      }

      const ready = pitReady.has(input.modelId)
      return capability(input, {
        sourceFrequency: 'DAILY',
        targetCadence: 'DAILY',
        verificationReadiness: ready ? 'READY' : 'NOT_PREPARED',
        fullVerificationReadiness: ready ? 'READY' : 'NOT_PREPARED',
        readiness: {
          fastReady: true,
          calibratedReady: true,
          fullReady: ready,
          blockers: ready ? [] : ['PIT_VERIFICATION_NOT_READY'],
        },
      } as never)
    },
    verificationPrepareResolver: async (input) => {
      prepareCalls.push(input.modelId)
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Promise.resolve()
      pitReady.add(input.modelId)
      inFlight -= 1
      return verificationResult(input)
    },
    matrixResolver: async (seriesId, _allowPrepare, requestOptions) => {
      await requestOptions?.beforePointInTimeEvaluation?.()
      return matrixReport(seriesId)
    },
  }).run({ includeFallback: false, diagnostics: { enabled: true } })

  const benchmark = report.benchmarks[0]
  const timeline = benchmark?.diagnostics?.timeline ?? []

  assert.equal(benchmark?.demoSafe, 'YES')
  assert.deepEqual(prepareCalls, [...MODELS])
  assert.equal(maxInFlight, 1)
  assert.equal(timeline.filter((event) => event.eventType === 'PHASE' && event.phase === 'PIT_MATERIALIZATION').length, 1)
})

test('I10. PIT materialization failure propagates and prevents PIT matrix evaluation', async () => {
  let pitEvaluationStarted = false

  const report = await createService({
    cohort: [{
      seriesId: 'wocaes0074',
      benchmarkName: 'Brent',
      group: 'PRIMARY',
      requiredModels: ['naive'],
      requiredTargetBases: ['POINT_IN_TIME'],
    }],
    capabilityResolver: (input) => capability(input, {
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
      verificationReadiness: 'NOT_PREPARED',
      fullVerificationReadiness: 'NOT_PREPARED',
      readiness: {
        fastReady: true,
        calibratedReady: true,
        fullReady: false,
        blockers: ['PIT_VERIFICATION_NOT_READY'],
      },
    } as never),
    verificationPrepareResolver: async () => {
      throw new Error('point-in-time materialization failed')
    },
    matrixResolver: async (seriesId, _allowPrepare, requestOptions) => {
      await requestOptions?.beforePointInTimeEvaluation?.()
      pitEvaluationStarted = true
      return matrixReport(seriesId)
    },
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.reason, 'ENVIRONMENT_NOT_READY')
  assert.match(report.benchmarks[0]?.precompute.reason ?? '', /point-in-time materialization failed/i)
  assert.equal(pitEvaluationStarted, false)
})

test('I11. benchmark timeout aborts the PIT materialization pipeline', async () => {
  let capturedSignal: AbortSignal | undefined

  const report = await createService({
    cohort: [{
      seriesId: 'wocaes0074',
      benchmarkName: 'Brent',
      group: 'PRIMARY',
      requiredModels: ['naive'],
      requiredTargetBases: ['POINT_IN_TIME'],
    }],
    benchmarkTimeoutMs: 1,
    capabilityResolver: (input) => capability(input, {
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
      verificationReadiness: 'NOT_PREPARED',
      fullVerificationReadiness: 'NOT_PREPARED',
      readiness: {
        fastReady: true,
        calibratedReady: true,
        fullReady: false,
        blockers: ['PIT_VERIFICATION_NOT_READY'],
      },
    } as never),
    verificationPrepareResolver: async (_input, _cadence, requestOptions) => {
      capturedSignal = requestOptions?.signal

      return await new Promise<BenchmarkForecastVerificationResult>((_resolve, reject) => {
        requestOptions?.signal?.addEventListener('abort', () => {
          const aborted = new Error('pit pipeline aborted') as Error & { name: string }
          aborted.name = 'AbortError'
          reject(aborted)
        }, { once: true })
      })
    },
    matrixResolver: async (seriesId, _allowPrepare, requestOptions) => {
      await requestOptions?.beforePointInTimeEvaluation?.()
      return matrixReport(seriesId)
    },
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.reason, 'ENVIRONMENT_NOT_READY')
  assert.match(report.benchmarks[0]?.precompute.reason ?? '', /timed out/i)
  assert.equal(capturedSignal?.aborted, true)
})

test('I12. rejected PIT preparation cache entries do not poison a later lawful certification run', async () => {
  let failOnce = true
  const pitReady = new Set<string>()

  const service = createDemoCertificationService({
    now: () => '2026-09-04T18:30:00.000Z',
    benchmarkTimeoutMs: 100,
    cohort: [{
      seriesId: 'wocaes0074',
      benchmarkName: 'Brent',
      group: 'PRIMARY',
      requiredModels: ['naive'],
      requiredTargetBases: ['POINT_IN_TIME'],
    }],
    resolveReleaseSnapshot: (cohort) => ({
      sourceRevision: 'rev-a',
      deployedRevision: 'rev-a',
      environment: 'test',
      environmentUrl: 'https://analytics-demo-sg-porr.spendguru.app',
      acceptedAt: '2026-09-04T18:30:00.000Z',
      cohort: cohort.map((entry) => ({ seriesId: entry.seriesId, benchmarkName: entry.benchmarkName, group: entry.group })),
    }),
    readCapability: async (input) => {
      const ready = pitReady.has(input.modelId)
      return capability(input, {
        sourceFrequency: 'DAILY',
        targetCadence: 'DAILY',
        verificationReadiness: ready ? 'READY' : 'NOT_PREPARED',
        fullVerificationReadiness: ready ? 'READY' : 'NOT_PREPARED',
        readiness: {
          fastReady: true,
          calibratedReady: true,
          fullReady: ready,
          blockers: ready ? [] : ['PIT_VERIFICATION_NOT_READY'],
        },
      } as never)
    },
    prepareCurrent: async (input) => preparation(input),
    prepareVerification: async (input) => {
      if (failOnce) {
        failOnce = false
        throw new Error('transient pit preparation failure')
      }

      pitReady.add(input.modelId)
      return verificationResult(input)
    },
    readCurrent: async (seriesId, modelId, targetBasis) => currentResult({ seriesId, modelId, targetBasis }),
    readVerification: async (seriesId, modelId, targetBasis) => verificationResult({ seriesId, modelId, targetBasis }),
    evaluateMatrix: async (seriesId, _allowPrepare, requestOptions) => {
      await requestOptions?.beforePointInTimeEvaluation?.()
      return matrixReport(seriesId)
    },
  })

  const firstReport = await service.run({ includeFallback: false })
  const secondReport = await service.run({ includeFallback: false })

  assert.equal(firstReport.benchmarks[0]?.reason, 'ENVIRONMENT_NOT_READY')
  assert.equal(secondReport.benchmarks[0]?.demoSafe, 'YES')
})

test('I13. diagnostics remain optional for the PIT pipeline corrective path', async () => {
  let pitReady = false

  const report = await createService({
    cohort: [{
      seriesId: 'wocaes0074',
      benchmarkName: 'Brent',
      group: 'PRIMARY',
      requiredModels: ['naive'],
      requiredTargetBases: ['POINT_IN_TIME'],
    }],
    capabilityResolver: (input) => capability(input, {
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
      verificationReadiness: pitReady ? 'READY' : 'NOT_PREPARED',
      fullVerificationReadiness: pitReady ? 'READY' : 'NOT_PREPARED',
      readiness: {
        fastReady: true,
        calibratedReady: true,
        fullReady: pitReady,
        blockers: pitReady ? [] : ['PIT_VERIFICATION_NOT_READY'],
      },
    } as never),
    verificationPrepareResolver: async (input) => {
      pitReady = true
      return verificationResult(input)
    },
    matrixResolver: async (seriesId, _allowPrepare, requestOptions) => {
      await requestOptions?.beforePointInTimeEvaluation?.()
      return matrixReport(seriesId)
    },
  }).run({ includeFallback: false })

  assert.equal(report.benchmarks[0]?.demoSafe, 'YES')
  assert.equal(report.benchmarks[0]?.diagnostics, undefined)
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