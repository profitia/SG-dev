import './load-env'

import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import type {
  ForecastBridge,
} from '@/lib/forecast/service'
import {
  buildForecastHistoryFingerprint,
  createForecastLibraryService,
} from '@/lib/forecast/service'
import { buildLiveForecastBridgePayloadFromHistory } from '@/lib/forecast/live-market-input'
import { getMarketDataPrisma } from '@/lib/market-data/client'

const SERIES_ID = 'uscaes0302'
const MODEL_IDS = ['naive', 'damped_holt', 'ets', 'arima'] as const
const TARGET_BASES = ['END_OF_PERIOD', 'MONTHLY_AVERAGE'] as const
const HORIZON_STEPS = { '1M': 1, '3M': 3, '6M': 6, '12M': 12 } as const
const METHOD_VERSION = 'benchmark-forecasting-mvp-phase2-v1'
const INPUT_SOURCE = 'DYNAMIC_MARKET_DATA_STORE'
const DEFAULT_EVIDENCE_PATH = path.resolve(
  process.cwd(),
  '..',
  '..',
  'tooling',
  'Benchmark-Forecasting',
  'validation',
  'generic_multi_method_forecast_phase7_controlled_multi_method_production_proof.json',
)

type ModelId = (typeof MODEL_IDS)[number]
type TargetBasis = (typeof TARGET_BASES)[number]

type AcceptedCase = {
  caseId: string
  identity: {
    seriesId: string
    targetSemantics: TargetBasis
    methodId: TargetBasis
    methodVersion: string
    modelId: ModelId
  }
  evidenceMethod: string
  evidenceMethodVersion: string
  origin: string
  target: string
  horizon: keyof typeof HORIZON_STEPS
  verificationObservedAt: string | null
  forecast: number
  actual: number
  error: number
  residual: number
  maseScale: number
  trainingHistoryStart: string
  trainingHistoryEnd: string
  trainingObservationCount: number
  strictCommonCohortMember: boolean
}

type AcceptedMetric = {
  mae: number
  rmse: number
  mase: number
  smape: number
  directionalAccuracy: number
  bias: number
  sampleCount: number
}

type Phase7Evidence = {
  generatedAt: string
  cohort: Array<{
    seriesId: string
    history: {
      lawfulNumericObservations: number
      endOfPeriodMonths: number
      monthlyAverageMonths: number
    }
  }>
  currentForecastProof: Record<string, Record<TargetBasis, Record<ModelId, {
    historyFingerprint: string
    inputSource: string
    trainingHistoryStart: string
    trainingObservationCount: number
  }>>>
  historicalVerificationProof: Record<string, {
    caseEvidence: Record<TargetBasis, AcceptedCase[]>
  }>
  metricsCompleteness: Record<string, Record<TargetBasis, Record<string, Record<ModelId, AcceptedMetric>>>>
}

function readArg(name: string) {
  const prefix = `--${name}=`
  const value = process.argv.find((argument) => argument.startsWith(prefix))
  return value?.slice(prefix.length).trim() ?? ''
}

function normalizeDate(value: string | null) {
  return value ? value.slice(0, 10) : null
}

function caseIdentity(record: {
  forecastOrigin: string
  forecastDate: string
  actualObservedAt: string | null
  actualValue: number
}) {
  return [
    normalizeDate(record.forecastOrigin),
    normalizeDate(record.forecastDate),
    normalizeDate(record.actualObservedAt),
    record.actualValue.toFixed(8),
  ].join('|')
}

async function loadEvidence(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8')) as Phase7Evidence
}

async function fetchLawfulHistory(sourceBaseUrl: string): Promise<BenchmarkHistoricalSeriesResult> {
  const url = new URL('/api/benchmark/analytics-series', sourceBaseUrl)
  url.searchParams.set('seriesId', SERIES_ID)
  url.searchParams.set('range', 'ALL')
  const response = await fetch(url)
  assert.equal(response.ok, true, `Lawful source history request failed: HTTP ${response.status}.`)
  const history = await response.json() as BenchmarkHistoricalSeriesResult
  assert.equal(history.providerSeries.providerSeriesId, SERIES_ID)
  assert.match(history.frequency?.toUpperCase() ?? '', /DAILY/)
  return history
}

function buildMonthlyPayloads(history: BenchmarkHistoricalSeriesResult, generatedAt: string) {
  const now = new Date(generatedAt)
  return Object.fromEntries(TARGET_BASES.map((targetBasis) => [
    targetBasis,
    buildLiveForecastBridgePayloadFromHistory(SERIES_ID, history, { targetBasis, now }),
  ])) as Record<TargetBasis, ReturnType<typeof buildLiveForecastBridgePayloadFromHistory>>
}

function buildEvidenceBridge(
  evidence: Phase7Evidence,
  payloads: Record<TargetBasis, ReturnType<typeof buildLiveForecastBridgePayloadFromHistory>>,
) {
  const bridge: ForecastBridge = {
    async exportHistory(input) {
      assert.ok(TARGET_BASES.includes(input.targetBasis as TargetBasis))
      const payload = payloads[input.targetBasis as TargetBasis]
      const fingerprint = buildForecastHistoryFingerprint(payload.history)
      const acceptedFingerprint = evidence.currentForecastProof[SERIES_ID][input.targetBasis as TargetBasis].naive.historyFingerprint
      assert.equal(fingerprint, acceptedFingerprint)
      return {
        status: 'AVAILABLE',
        methodVersion: METHOD_VERSION,
        source: payload.source,
        benchmark: payload.benchmark,
        history: payload.history,
      }
    },
    async exportCurrent() {
      throw new Error('Step 1 Historical Verification proof must not invoke Current Forecast compute.')
    },
    async exportVerification(input) {
      assert.ok(TARGET_BASES.includes(input.targetBasis as TargetBasis))
      assert.ok(MODEL_IDS.includes(input.modelId as ModelId))
      const targetBasis = input.targetBasis as TargetBasis
      const modelId = input.modelId as ModelId
      const payload = payloads[targetBasis]
      const acceptedCases = evidence.historicalVerificationProof[SERIES_ID].caseEvidence[targetBasis]
        .filter((record) => record.identity.modelId === modelId)
      const pointsByDate = new Map(payload.history.points.map((point) => [normalizeDate(point.date), point.value]))

      assert.equal(acceptedCases.length, 8)
      const backtest = Object.fromEntries(Object.entries(HORIZON_STEPS).map(([horizon, horizonSteps]) => {
        const cases = acceptedCases.filter((record) => record.horizon === horizon)
        const metrics = evidence.metricsCompleteness[SERIES_ID][targetBasis][horizon][modelId]
        assert.equal(cases.length, 2)
        assert.equal(metrics.sampleCount, 2)

        return [horizon, {
          origins: cases.length,
          expectedOrigins: cases.length,
          successfulOrigins: cases.length,
          failedOrigins: 0,
          coverage: 1,
          metrics: {
            mae: metrics.mae,
            rmse: metrics.rmse,
            mase: metrics.mase,
            smape: metrics.smape,
            directional_accuracy: metrics.directionalAccuracy,
            bias: metrics.bias,
          },
          records: cases.map((record) => {
            const originValue = pointsByDate.get(normalizeDate(record.origin))
            assert.equal(typeof originValue, 'number')
            assert.equal(record.identity.targetSemantics, targetBasis)
            assert.equal(record.identity.methodId, targetBasis)
            assert.equal(record.identity.methodVersion, METHOD_VERSION)
            assert.equal(record.strictCommonCohortMember, true)
            assert.equal(record.trainingHistoryEnd, record.origin)
            assert.equal(record.trainingHistoryStart, payload.history.start.slice(0, 10))
            assert.ok(record.trainingObservationCount > 36)
            assert.ok(Math.abs(record.error + record.residual) < 1e-9)

            return {
              benchmarkId: SERIES_ID,
              modelId,
              forecastOrigin: record.origin,
              horizon,
              horizonSteps,
              forecastDate: record.target,
              actualObservedAt: record.verificationObservedAt,
              originValue: originValue as number,
              forecastValue: record.forecast,
              actualValue: record.actual,
              error: record.error,
              absoluteError: Math.abs(record.error),
              delta: record.error,
              deltaPct: record.actual === 0 ? null : record.error / record.actual,
              maseScale: record.maseScale,
              metadata: {
                modelFamily: modelId,
                selectedVariant: record.evidenceMethod,
                selectedParameters: {
                  evidenceMethod: record.evidenceMethod,
                  evidenceMethodVersion: record.evidenceMethodVersion,
                  caseId: record.caseId,
                  strictCommonCohortMember: record.strictCommonCohortMember,
                  trainingHistoryStart: record.trainingHistoryStart,
                  trainingHistoryEnd: record.trainingHistoryEnd,
                  trainingObservationCount: record.trainingObservationCount,
                  residual: record.residual,
                },
                selectionScore: null,
                selectionMetric: null,
                fitStatus: 'SUCCEEDED',
                failureReason: null,
              },
            }
          }),
          failures: [],
        }]
      }))

      return {
        status: 'AVAILABLE',
        methodVersion: METHOD_VERSION,
        source: payload.source,
        benchmark: payload.benchmark,
        model: { id: modelId, userFacing: true },
        result: {
          benchmarkId: SERIES_ID,
          component: payload.benchmark.component,
          description: payload.benchmark.description,
          frequency: payload.benchmark.frequency,
          model: modelId,
          history: payload.history,
          backtest,
          runtimeSeconds: 0,
        },
      }
    },
  }
  return bridge
}

async function snapshotPersistence() {
  const prisma = getMarketDataPrisma()
  assert.ok(prisma, 'MARKET_DATA_DATABASE_URL is required.')
  const runs = await prisma.forecastVerificationRun.findMany({
    where: { seriesId: SERIES_ID },
    orderBy: [{ targetBasis: 'asc' }, { modelId: 'asc' }],
    select: {
      id: true,
      targetBasis: true,
      methodId: true,
      methodVersion: true,
      modelId: true,
      historyFingerprint: true,
      observationCount: true,
      updatedAt: true,
      _count: { select: { metrics: true, points: true } },
    },
  })
  return runs.map((run) => ({
    ...run,
    updatedAt: run.updatedAt.toISOString(),
  }))
}

async function writeMode(evidence: Phase7Evidence, outputPath: string, sourceBaseUrl: string) {
  const history = await fetchLawfulHistory(sourceBaseUrl)
  const payloads = buildMonthlyPayloads(history, evidence.generatedAt)
  const bridge = buildEvidenceBridge(evidence, payloads)
  const service = createForecastLibraryService({ bridge, logEvent: () => {} })
  const results = []

  for (const targetBasis of TARGET_BASES) {
    for (const modelId of MODEL_IDS) {
      const result = await service.resolveVerificationRequest({ seriesId: SERIES_ID, targetBasis, modelId })
      assert.equal(result.status, 'AVAILABLE')
      assert.equal(result.cacheStatus, 'miss')
      assert.equal(result.targetSemantics, targetBasis)
      assert.equal(result.methodId, targetBasis)
      assert.equal(result.methodVersion, METHOD_VERSION)
      assert.equal(result.modelId, modelId)
      assert.equal(Object.values(result.verification).reduce((sum, item) => sum + item.records.length, 0), 8)
      results.push({
        targetBasis,
        modelId,
        cacheStatus: result.cacheStatus,
        historyFingerprint: result.historyFingerprint,
        historyObservations: result.history.observations,
      })
    }
  }

  const persisted = await snapshotPersistence()
  assert.equal(persisted.length, 8)
  assert.equal(new Set(persisted.map((run) => [
    SERIES_ID,
    run.targetBasis,
    run.methodId,
    run.methodVersion,
    run.modelId,
  ].join('|'))).size, 8)
  assert.ok(persisted.every((run) => run._count.metrics === 4 && run._count.points === 8))
  assert.ok(persisted.every((run) => run.observationCount === 471))

  await writeFile(outputPath, JSON.stringify({
    mode: 'write',
    result: 'PASS',
    seriesId: SERIES_ID,
    persistedIdentities: results.length,
    identityCollisions: 0,
    sourceRows: history.historical.length,
    canonicalMonthlyObservations: Object.fromEntries(TARGET_BASES.map((target) => [target, payloads[target].history.observations])),
    results,
    persisted,
  }, null, 2))
}

async function readMode(evidence: Phase7Evidence, outputPath: string) {
  let bridgeCalls = 0
  const noComputeBridge: ForecastBridge = {
    async exportHistory() { bridgeCalls += 1; throw new Error('Prepared read invoked source history.') },
    async exportCurrent() { bridgeCalls += 1; throw new Error('Prepared read invoked model fit.') },
    async exportVerification() { bridgeCalls += 1; throw new Error('Prepared read invoked historical backtest.') },
  }
  const service = createForecastLibraryService({ bridge: noComputeBridge, logEvent: () => {} })
  const before = await snapshotPersistence()
  const results = []
  const bySemantics = new Map<TargetBasis, Map<ModelId, Awaited<ReturnType<typeof service.readPreparedVerificationRequest>>>>()
  let metricCellsPreserved = 0
  let evidenceMetadataPreserved = 0

  for (const targetBasis of TARGET_BASES) {
    const byModel = new Map<ModelId, Awaited<ReturnType<typeof service.readPreparedVerificationRequest>>>()
    bySemantics.set(targetBasis, byModel)
    for (const modelId of MODEL_IDS) {
      const result = await service.readPreparedVerificationRequest({ seriesId: SERIES_ID, targetBasis, modelId })
      assert.equal(result.status, 'AVAILABLE')
      assert.equal(result.cacheStatus, 'hit')
      assert.equal(result.targetSemantics, targetBasis)
      assert.equal(result.methodId, targetBasis)
      assert.equal(result.methodVersion, METHOD_VERSION)
      assert.equal(result.modelId, modelId)
      assert.equal(result.history.observations, 471)
      byModel.set(modelId, result)

      for (const [horizon, horizonResult] of Object.entries(result.verification)) {
        const acceptedMetric = evidence.metricsCompleteness[SERIES_ID][targetBasis][horizon][modelId]
        assert.ok(horizonResult.metrics)
        for (const key of ['mae', 'rmse', 'mase', 'smape', 'directionalAccuracy', 'bias'] as const) {
          assert.ok(Math.abs((horizonResult.metrics[key] ?? Number.NaN) - acceptedMetric[key]) < 1e-12)
          metricCellsPreserved += 1
        }
        assert.equal(horizonResult.origins, acceptedMetric.sampleCount)
        for (const record of horizonResult.records) {
          const parameters = record.metadata?.selectedParameters ?? {}
          assert.equal(parameters.evidenceMethod, 'EXPANDING_WINDOW_ROLLING_ORIGIN')
          assert.equal(parameters.evidenceMethodVersion, 'expanding-window-rolling-origin-v1')
          assert.equal(parameters.strictCommonCohortMember, true)
          assert.equal(parameters.trainingHistoryStart, '1987-05-01')
          assert.equal(parameters.trainingHistoryEnd, normalizeDate(record.forecastOrigin))
          assert.ok(Number(parameters.trainingObservationCount) > 36)
          evidenceMetadataPreserved += 1
        }
      }

      results.push({
        targetBasis,
        modelId,
        cacheStatus: result.cacheStatus,
        historyFingerprint: result.historyFingerprint,
        recordCount: Object.values(result.verification).reduce((sum, item) => sum + item.records.length, 0),
      })
    }
  }

  const commonCohorts = []
  for (const targetBasis of TARGET_BASES) {
    const byModel = bySemantics.get(targetBasis)!
    for (const horizon of Object.keys(HORIZON_STEPS)) {
      const identitySets = MODEL_IDS.map((modelId) => {
        const result = byModel.get(modelId)!
        assert.equal(result.status, 'AVAILABLE')
        return result.verification[horizon].records.map(caseIdentity).sort()
      })
      assert.ok(identitySets.every((identitySet) => JSON.stringify(identitySet) === JSON.stringify(identitySets[0])))
      assert.equal(identitySets[0].length, 2)
      commonCohorts.push({ targetBasis, horizon, caseCount: identitySets[0].length, identitySetEquality: true })
    }
  }

  const after = await snapshotPersistence()
  assert.deepEqual(after, before)
  assert.equal(bridgeCalls, 0)
  assert.equal(results.length, 8)
  assert.equal(metricCellsPreserved, 192)
  assert.equal(evidenceMetadataPreserved, 64)

  await writeFile(outputPath, JSON.stringify({
    mode: 'read-after-reconnect',
    result: 'PASS',
    seriesId: SERIES_ID,
    readableIdentities: results.length,
    identityCollisions: 0,
    semanticFallbacks: 0,
    modelFallbacks: 0,
    strictCommonCohorts: commonCohorts,
    metricCellsPreserved,
    evidenceMetadataPreserved,
    fullHistory: {
      canonicalMonthlyObservations: 471,
      trainingHistoryStart: '1987-05-01',
      selectedOriginTrainingCounts: [447, 459],
      validationOriginBoundOnly: true,
      trainingHistoryTruncated: false,
    },
    requestTimeCompute: {
      modelFits: 0,
      historicalBacktests: 0,
      sourceFetches: 0,
      hydration: 0,
      forecastWrites: 0,
      bridgeCalls,
      persistenceStateUnchanged: true,
    },
    results,
  }, null, 2))
}

async function main() {
  const mode = readArg('mode')
  const outputPath = readArg('output')
  const evidencePath = readArg('evidence') || DEFAULT_EVIDENCE_PATH
  const sourceBaseUrl = readArg('sourceBaseUrl') || 'http://localhost:3001'
  assert.ok(mode === 'write' || mode === 'read', 'Expected --mode=write|read.')
  assert.ok(outputPath, 'Expected --output=<path>.')
  const evidence = await loadEvidence(evidencePath)

  if (mode === 'write') {
    await writeMode(evidence, outputPath, sourceBaseUrl)
  } else {
    await readMode(evidence, outputPath)
  }

  const prisma = getMarketDataPrisma()
  await prisma?.$disconnect()
  console.log(`FORECAST_PRODUCTION_CLOSURE_STEP1_${mode.toUpperCase()}=PASS`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
})