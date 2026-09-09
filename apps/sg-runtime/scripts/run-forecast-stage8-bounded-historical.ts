import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { createForecastProductionOperationsService } from '@/lib/forecast/production-operations'
import {
  buildRollingDailyHistoryFingerprint,
  createRollingDailyMaintenanceService,
  isRollingDailyHistoricalPreparationComplete,
  ROLLING_DAILY_INPUT_SOURCE,
  ROLLING_DAILY_METHOD_ID,
  ROLLING_DAILY_METHOD_VERSION,
  ROLLING_DAILY_TARGET_BASIS,
  type RollingDailyCalibrationGroupArtifact,
  type RollingDailyMaintenanceRepository,
  type RollingDailyMaintenanceResult,
  type RollingDailyMaintenanceRunner,
  type RollingDailyMaintenanceStateArtifact,
  type RollingDailyVerificationRecordArtifact,
} from '@/lib/forecast/rolling-daily-maintenance'
import { createRollingDailyProductionOperationsService } from '@/lib/forecast/rolling-daily-production-operations'
import { createPreparedRollingDailyForecastVerificationReader } from '@/lib/forecast/rolling-daily-verification'

const OUTPUT_JSON = path.resolve(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting', 'validation', 'ppf1-stage8-bounded-rolling-daily-historical.json')
const OUTPUT_MD = path.resolve(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting', 'validation', 'ppf1-stage8-bounded-rolling-daily-historical.md')

function createHistory() {
  return {
    seriesId: 'wocaes0074',
    displayName: 'Brent, Spot, FOB North Sea',
    description: 'Brent, Spot, FOB North Sea',
    frequency: 'DAILY',
    source: 'controlled-source',
    points: [
      { date: '2024-01-01', value: 100 },
      { date: '2024-01-02', value: 101 },
      { date: '2024-01-03', value: 102 },
      { date: '2024-01-04', value: 103 },
      { date: '2024-01-05', value: 104 },
    ],
  }
}

function createPersistedRecord(overrides: Partial<RollingDailyVerificationRecordArtifact> = {}): RollingDailyVerificationRecordArtifact {
  return {
    seriesId: 'wocaes0074',
    inputSource: ROLLING_DAILY_INPUT_SOURCE,
    inputRunId: null,
    targetBasis: ROLLING_DAILY_TARGET_BASIS,
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: ROLLING_DAILY_METHOD_VERSION,
    modelId: 'naive',
    forecastOriginAt: '2024-01-04',
    horizonLabel: '1M',
    horizonMonths: 1,
    horizonSteps: 21,
    targetCalendarDate: '2024-02-05',
    verificationObservedAt: '2024-02-05',
    maturityStatus: 'MATURED',
    originValue: 103,
    forecastValue: 104,
    actualValue: 105,
    errorValue: -1,
    absoluteErrorValue: 1,
    deltaValue: 1,
    deltaPct: 0.01,
    residualValue: 1,
    maseScale: 1,
    trainingHistoryStartAt: '2024-01-01',
    trainingHistoryEndAt: '2024-01-04',
    trainingObservationCount: 4,
    sourceHistoryFingerprint: 'ignored-in-proof',
    metadata: {
      modelFamily: 'naive',
      selectedVariant: 'NAIVE_LAST_VALUE',
      selectedParameters: {},
      fitStatus: 'SUCCEEDED',
    },
    selectedVariant: 'NAIVE_LAST_VALUE',
    selectionMetric: null,
    selectionScore: null,
    ...overrides,
  }
}

function createCalibrationGroup(): RollingDailyCalibrationGroupArtifact {
  return {
    seriesId: 'wocaes0074',
    inputSource: ROLLING_DAILY_INPUT_SOURCE,
    inputRunId: null,
    targetBasis: ROLLING_DAILY_TARGET_BASIS,
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: ROLLING_DAILY_METHOD_VERSION,
    modelId: 'naive',
    horizonLabel: '1M',
    horizonMonths: 1,
    calibrationOriginAt: '2024-01-04',
    sampleCount: 1,
    residualP10: null,
    residualP90: null,
    quantileMethod: 'HF7_LINEAR_INTERPOLATION',
    status: 'INSUFFICIENT_CALIBRATION_HISTORY',
    lastResidualObservedAt: null,
    refreshedAt: '2024-01-04',
  }
}

function createVerificationDbRecord() {
  return {
    seriesId: 'wocaes0074',
    inputSource: ROLLING_DAILY_INPUT_SOURCE,
    inputRunId: null,
    targetBasis: 'POINT_IN_TIME',
    methodId: ROLLING_DAILY_METHOD_ID,
    methodVersion: ROLLING_DAILY_METHOD_VERSION,
    modelId: 'naive',
    forecastOriginAt: new Date('2024-01-04T00:00:00.000Z'),
    horizonLabel: '1M',
    horizonMonths: 1,
    horizonSteps: 21,
    targetCalendarDate: new Date('2024-02-05T00:00:00.000Z'),
    verificationObservedAt: new Date('2024-02-05T00:00:00.000Z'),
    maturityStatus: 'MATURED',
    originValue: 103,
    forecastValue: 104,
    actualValue: 105,
    errorValue: -1,
    absoluteErrorValue: 1,
    deltaValue: 1,
    deltaPct: 0.01,
    residualValue: 1,
    maseScale: 1,
    trainingHistoryStartAt: new Date('2024-01-01T00:00:00.000Z'),
    trainingHistoryEndAt: new Date('2024-01-04T00:00:00.000Z'),
    trainingObservationCount: 4,
    sourceHistoryFingerprint: 'ignored-in-proof',
    metadataJson: null,
  }
}

function createCurrentForecastResult(modelId: string) {
  return {
    contractVersion: '1',
    status: 'AVAILABLE' as const,
    benchmark: {
      benchmarkId: 'wocaes0074',
      displayName: 'Brent',
      frequency: 'DAILY',
      unit: 'USD/bbl',
      currency: 'USD',
      provider: 'macrobond',
      providerSeriesId: 'wocaes0074',
    },
    forecastMethod: {
      id: ROLLING_DAILY_METHOD_ID,
      version: ROLLING_DAILY_METHOD_VERSION,
    },
    model: {
      id: modelId,
      selectedCandidate: 'stub',
      selectionMetric: null,
      selectionScore: null,
      selectedParameters: {},
    },
    origin: {
      date: '2024-01-05',
      value: 104,
    },
    maxHorizonMonths: 12,
    anchors: [],
    path: [{ date: '2024-01-08', pointForecast: 104 }],
    calibration: {
      availabilityStatus: 'NOT_AVAILABLE',
      freshnessStatus: null,
      quantileConvention: 'HF7_LINEAR_INTERPOLATION',
      coverageLabel: '80% empirical prediction band',
      methodologicalMinimumStatus: 'OPEN_REQUIRES_MORE_BENCHMARK_VALIDATION',
      updatedAt: null,
      processedThrough: null,
      lastResidualAvailabilityDate: null,
    },
    audit: {
      sourceHistoryFingerprint: 'hist-proof',
      generatedAt: '2024-01-05T00:00:00.000Z',
      sourceLatestObservationDate: '2024-01-05',
      calendarProjectionMode: 'ROLLING_DAILY_BUSINESS_CALENDAR_V1',
      projectionCalendarStrategy: 'ROLLING_DAILY_BUSINESS_CALENDAR_V1',
      technicalMinimumTrainingObservations: 60,
      methodologicalTrainingEligibilityStatus: 'OPEN_REQUIRES_CROSS_BENCHMARK_VALIDATION',
      calibrationUpdatedAt: null,
      calibrationLastResidualAvailabilityDate: null,
      inputSource: ROLLING_DAILY_INPUT_SOURCE,
    },
    warnings: [],
  }
}

async function runBoundedMaintenanceProof() {
  let persistedState: string | null = null
  let receivedMaxOriginsPerRun: number | undefined
  let receivedLastProcessedOrigin: string | null = null
  const priorFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: 'wocaes0074',
    displayName: 'Brent, Spot, FOB North Sea',
    description: 'Brent, Spot, FOB North Sea',
    frequency: 'DAILY',
    source: 'controlled-source',
    points: createHistory().points.slice(0, 3).map((point) => ({ date: `${point.date}T00:00:00.000Z`, value: point.value })),
  })

  const repository: RollingDailyMaintenanceRepository = {
    async readState(): Promise<RollingDailyMaintenanceStateArtifact | null> {
      return {
        seriesId: 'wocaes0074',
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        inputRunId: null,
        targetBasis: ROLLING_DAILY_TARGET_BASIS,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        modelId: 'naive',
        historicalOriginStartAt: '2024-01-01T00:00:00.000Z',
        minimumTrainingObservations: 4,
        minimumCalibrationSamples: 20,
        latestSourceObservationAt: '2024-01-03T00:00:00.000Z',
        latestSourceHistoryStartAt: '2024-01-01T00:00:00.000Z',
        latestSourceObservationCount: 3,
        latestSourceHistoryFingerprint: priorFingerprint,
        lastProcessedOriginAt: '2024-01-03T00:00:00.000Z',
        lastMaturedObservedAt: null,
        lastMaintenanceAt: '2024-01-03T00:00:00.000Z',
        lastMaintenanceStatus: 'SUCCEEDED',
        lastFailureReason: null,
      }
    },
    async listVerificationRecords() {
      return [createPersistedRecord({ forecastOriginAt: '2024-01-03', trainingHistoryEndAt: '2024-01-03' })]
    },
    async applyMaintenanceUpdate(input) {
      persistedState = input.lastProcessedOriginAt
    },
    async recordMaintenanceFailure() {
      throw new Error('recordMaintenanceFailure should not be called in bounded proof')
    },
  }

  const runner: RollingDailyMaintenanceRunner = {
    async run(request) {
      receivedMaxOriginsPerRun = request.maxOriginsPerRun
      receivedLastProcessedOrigin = request.lastProcessedOriginDate
      return {
        status: 'AVAILABLE',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        sourceHistory: {
          startDate: '2024-01-01',
          endDate: '2024-01-05',
          latestObservationDate: '2024-01-05',
          observationCount: 5,
          filteredNullCount: 0,
          filteredDuplicateCount: 0,
          historyFingerprint: 'hist-after',
        },
        maintenance: {
          newOriginCount: 1,
          maturedRecordCount: 0,
          affectedCalibrationGroupCount: 1,
          calibrationRefreshCount: 1,
          lastProcessedOriginDate: '2024-01-04',
          lastMaturedObservedAt: null,
          newOriginDates: ['2024-01-04'],
        },
        newRecords: [createPersistedRecord({ forecastOriginAt: '2024-01-04', trainingHistoryEndAt: '2024-01-04' })],
        maturedRecords: [],
        calibrationGroups: [createCalibrationGroup()],
      }
    },
  }

  const service = createRollingDailyMaintenanceService({
    repository,
    runner,
    loadHistory: async () => createHistory(),
    now: () => new Date('2024-01-05T00:00:00.000Z'),
    logEvent: () => {},
  })

  const result = await service.runIncrementalMaintenance({
    seriesId: 'wocaes0074',
    modelId: 'naive',
    maxOriginsPerRun: 1,
  })

  return {
    status: result.status === 'SUCCEEDED' && persistedState === '2024-01-04' && receivedMaxOriginsPerRun === 1 && receivedLastProcessedOrigin === '2024-01-03'
      ? 'PASS'
      : 'FAIL',
    requestedMaxOriginsPerRun: 1,
    forwardedMaxOriginsPerRun: receivedMaxOriginsPerRun ?? null,
    previousLastProcessedOriginAt: receivedLastProcessedOrigin,
    persistedLastProcessedOriginAt: persistedState,
    latestSourceObservationAt: result.latestSourceObservationAt,
    newOriginCount: result.newOriginCount,
    maintenanceStatus: result.status,
  }
}

async function runOwnerForwardingProof() {
  let rollingOwnerMaxOriginsPerRun: number | undefined
  let productionOwnerMaxOriginsPerRun: number | undefined

  const rollingDaily = createRollingDailyProductionOperationsService({
    async runMaintenance(request) {
      rollingOwnerMaxOriginsPerRun = request.maxOriginsPerRun
      return {
        status: 'SUCCEEDED',
        seriesId: request.seriesId,
        modelId: request.modelId,
        targetBasis: 'POINT_IN_TIME',
        inputSource: ROLLING_DAILY_INPUT_SOURCE,
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        reasonCode: null,
        sourceHistoryFingerprint: 'hist-proof',
        latestSourceObservationAt: '2024-01-05',
        sourceObservationCount: 5,
        filteredNullCount: 0,
        filteredDuplicateCount: 0,
        newOriginCount: 1,
        maturedRecordCount: 0,
        calibrationRefreshCount: 0,
        affectedCalibrationGroupCount: 0,
        lastProcessedOriginAt: '2024-01-04',
        lastMaturedObservedAt: null,
        runtimeMs: 1,
      } satisfies RollingDailyMaintenanceResult
    },
    async resolveCurrentForecast(request) {
      return createCurrentForecastResult(request.modelId)
    },
    async persistSnapshot(request) {
      return {
        seriesId: request.seriesId,
        modelId: request.modelId,
        targetBasis: 'POINT_IN_TIME',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
        methodId: ROLLING_DAILY_METHOD_ID,
        methodVersion: ROLLING_DAILY_METHOD_VERSION,
        contractVersion: '1',
        status: 'AVAILABLE',
        reasonCode: null,
        parityStatus: 'MATCHED',
      }
    },
    async readSnapshot() {
      return { status: 'MISS' as const }
    },
    logEvent: () => {},
  })

  await rollingDaily.run({
    seriesId: 'wocaes0074',
    modelIds: ['naive'],
    preparedHistory: createHistory(),
    maxOriginsPerRun: 1,
  })

  const production = createForecastProductionOperationsService({
    async resolveCapabilities() {
      return {
        status: 'AVAILABLE' as const,
        reason: null,
        sourceMetadata: {
          seriesId: 'wocaes0074',
          providerCode: 'MACROBOND',
          source: 'controlled',
          sourceFrequency: 'DAILY' as const,
          rawFrequency: 'daily',
          sourceObservationCount: 120,
          fullHistoryObservationCount: 120,
        },
        targetedHydration: {
          scope: 'SINGLE_SERIES' as const,
          requestedSeriesId: 'wocaes0074',
          source: 'postgres' as const,
          cacheStatus: 'hit' as const,
        },
        preparationFailures: {},
        capabilities: [],
      }
    },
    async prepareMonthlyCurrent() {
      throw new Error('Monthly preparation should not run in Stage 8 proof')
    },
    async prepareMonthlyHistorical() {
      throw new Error('Monthly historical preparation should not run in Stage 8 proof')
    },
    async runRollingDaily(request) {
      productionOwnerMaxOriginsPerRun = request.maxOriginsPerRun
      return {
        status: 'SUCCEEDED' as const,
        seriesId: request.seriesId,
        results: [{
          status: 'SUCCEEDED' as const,
          modelId: 'naive',
          maintenance: { status: 'SUCCEEDED', sourceHistoryFingerprint: 'hist-proof' } as never,
          snapshot: { status: 'REFRESHED_AFTER_MAINTENANCE', reason: 'MAINTENANCE_DELTA_APPLIED', parityStatus: 'MATCHED' as const },
          error: null,
        }],
        refreshedSnapshotCount: 1,
        recoveredSnapshotCount: 0,
        noOpModelCount: 0,
        failedModelCount: 0,
      }
    },
  })

  await production.run({
    seriesId: 'wocaes0074',
    targetSemantics: ['ROLLING_DAILY_POINT_IN_TIME'],
    modelIds: ['naive'],
    prepareHistorical: true,
    maxOriginsPerRun: 1,
  })

  return {
    status: rollingOwnerMaxOriginsPerRun === 1 && productionOwnerMaxOriginsPerRun === 1 ? 'PASS' : 'FAIL',
    rollingDailyOwnerForwarding: rollingOwnerMaxOriginsPerRun ?? null,
    productionOwnerForwarding: productionOwnerMaxOriginsPerRun ?? null,
  }
}

async function runVerificationProof() {
  const events: Array<{ event: string, metrics: Record<string, unknown> }> = []
  const exactFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: 'wocaes0074',
    displayName: 'Brent, Spot, FOB North Sea',
    description: 'Brent, Spot, FOB North Sea',
    frequency: 'DAILY',
    source: 'controlled-source',
    points: createHistory().points.map((point) => ({ date: `${point.date}T00:00:00.000Z`, value: point.value })),
  })
  const partialReader = createPreparedRollingDailyForecastVerificationReader({
    prisma: {
      rollingDailyVerificationRecord: {
        async findMany() {
          return [createVerificationDbRecord()]
        },
      },
      rollingDailyMaintenanceState: {
        async findUnique() {
          return {
            latestSourceHistoryFingerprint: exactFingerprint,
            latestSourceObservationAt: '2024-01-05T00:00:00.000Z',
            lastProcessedOriginAt: '2024-01-04T00:00:00.000Z',
            lastMaintenanceStatus: 'SUCCEEDED',
          }
        },
      },
    } as never,
    resolveHistory: async () => ({
      history: {
        providerSeries: {
          provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' },
          providerSeriesId: 'wocaes0074',
          providerSeriesKey: 'wocaes0074',
        },
        displayName: 'Brent, Spot, FOB North Sea',
        frequency: 'DAILY',
        currency: null,
        unit: null,
        source: 'controlled-source',
        historical: createHistory().points.map((point) => ({ date: `${point.date}T00:00:00.000Z`, value: point.value })),
      },
    }) as never,
    emitPreparedRead(event, metrics) {
      events.push({ event, metrics: metrics as Record<string, unknown> })
    },
  })

  const completeReader = createPreparedRollingDailyForecastVerificationReader({
    prisma: {
      rollingDailyVerificationRecord: {
        async findMany() {
          return [createVerificationDbRecord()]
        },
      },
      rollingDailyMaintenanceState: {
        async findUnique() {
          return {
            latestSourceHistoryFingerprint: exactFingerprint,
            latestSourceObservationAt: '2024-01-05T00:00:00.000Z',
            lastProcessedOriginAt: '2024-01-05T00:00:00.000Z',
            lastMaintenanceStatus: 'SUCCEEDED',
          }
        },
      },
    } as never,
    resolveHistory: async () => ({
      history: {
        providerSeries: {
          provider: { providerCode: 'MACROBOND', displayName: 'Macrobond' },
          providerSeriesId: 'wocaes0074',
          providerSeriesKey: 'wocaes0074',
        },
        displayName: 'Brent, Spot, FOB North Sea',
        frequency: 'DAILY',
        currency: null,
        unit: null,
        source: 'controlled-source',
        historical: createHistory().points.map((point) => ({ date: `${point.date}T00:00:00.000Z`, value: point.value })),
      },
    }) as never,
  })

  const partial = await partialReader({ seriesId: 'wocaes0074', modelId: 'naive', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' } as never)
  const complete = await completeReader({ seriesId: 'wocaes0074', modelId: 'naive', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME' } as never)
  const completenessCheck = isRollingDailyHistoricalPreparationComplete({
    state: {
      latestSourceHistoryFingerprint: 'hist-proof',
      latestSourceObservationAt: '2024-01-05T00:00:00.000Z',
      lastProcessedOriginAt: '2024-01-04T00:00:00.000Z',
      lastMaintenanceStatus: 'SUCCEEDED',
    },
    expectedSourceHistoryFingerprint: 'hist-proof',
    latestSourceObservationDate: '2024-01-05T00:00:00.000Z',
    verificationRecordCount: 1,
  })

  return {
    status: partial.status === 'NOT_AVAILABLE' && complete.status === 'AVAILABLE' && completenessCheck === false ? 'PASS' : 'FAIL',
    partialPreparedRead: partial.status,
    partialReason: partial.status === 'NOT_AVAILABLE' ? partial.reason : null,
    completePreparedRead: complete.status,
    completeCoverage: complete.status === 'AVAILABLE' ? complete.verification['1M']?.coverage ?? null : null,
    readinessAfterPartialCheckpoint: completenessCheck ? 'READY' : 'STALE',
    preparedReadTelemetry: events,
  }
}

function renderMarkdown(payload: Record<string, any>) {
  return [
    '# PPF-1 Stage 8 Bounded Rolling-Daily Historical',
    '',
    `Status: ${payload.overall.status}`,
    `Ready For Stage 9: ${payload.overall.readyForStage9}`,
    '',
    '## Bounded Checkpoint',
    '',
    `Status: ${payload.boundedCheckpoint.status}`,
    `Requested Max Origins Per Run: ${payload.boundedCheckpoint.requestedMaxOriginsPerRun}`,
    `Persisted Last Processed Origin: ${payload.boundedCheckpoint.persistedLastProcessedOriginAt}`,
    `Latest Source Observation: ${payload.boundedCheckpoint.latestSourceObservationAt}`,
    '',
    '## Prepared Read Guard',
    '',
    `Status: ${payload.preparedReadGuard.status}`,
    `Partial Prepared Read: ${payload.preparedReadGuard.partialPreparedRead}`,
    `Partial Reason: ${payload.preparedReadGuard.partialReason}`,
    `Complete Prepared Read: ${payload.preparedReadGuard.completePreparedRead}`,
    `Readiness After Partial Checkpoint: ${payload.preparedReadGuard.readinessAfterPartialCheckpoint}`,
    '',
    '## Owner Forwarding',
    '',
    `Status: ${payload.ownerForwarding.status}`,
    `Rolling Daily Owner Forwarding: ${payload.ownerForwarding.rollingDailyOwnerForwarding}`,
    `Production Owner Forwarding: ${payload.ownerForwarding.productionOwnerForwarding}`,
    '',
    '## Scope Guardrails',
    '',
    '- No statistical methodology changes',
    '- No new schema migration required',
    '- Partial history remains non-renderable until checkpoint completion',
    '- Bounded runs advance only to the last actually processed origin',
    '',
  ].join('\n')
}

async function main() {
  const boundedCheckpoint = await runBoundedMaintenanceProof()
  const preparedReadGuard = await runVerificationProof()
  const ownerForwarding = await runOwnerForwardingProof()
  const overallStatus = [boundedCheckpoint.status, preparedReadGuard.status, ownerForwarding.status].every((status) => status === 'PASS')
    ? 'PASS'
    : 'FAIL'
  const payload = {
    identity: {
      task: 'PPF1_STAGE8_BOUNDED_ROLLING_DAILY_HISTORICAL',
      seriesId: 'wocaes0074',
      forecastMethod: ROLLING_DAILY_METHOD_ID,
      targetBasis: ROLLING_DAILY_TARGET_BASIS,
      models: ['naive'],
    },
    boundedCheckpoint,
    preparedReadGuard,
    ownerForwarding,
    overall: {
      status: overallStatus,
      readyForStage9: overallStatus === 'PASS' ? 'YES' : 'NO',
    },
    generatedAt: new Date().toISOString(),
  }

  await writeFile(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  await writeFile(OUTPUT_MD, renderMarkdown(payload), 'utf8')
  console.log(JSON.stringify({ status: overallStatus, outputJson: OUTPUT_JSON, outputMd: OUTPUT_MD }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})