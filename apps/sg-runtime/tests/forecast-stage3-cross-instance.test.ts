process.env.MARKET_DATA_DATABASE_URL = process.env.MARKET_DATA_DATABASE_URL ?? 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data'

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import test, { type TestContext } from 'node:test'
import { fileURLToPath } from 'node:url'

import { createForecastCadence } from '../lib/forecast/cadence'
import {
  buildCurrentLogicalArtifactKey,
  type CurrentLogicalArtifactIdentity,
} from '../lib/forecast/current-single-flight'
import {
  buildForecastArtifactCadenceIdentity,
  createCurrentForecastStatisticalCompatibility,
  createFullVerificationStatisticalCompatibility,
  createRecentVerificationStatisticalCompatibility,
  LEGACY_MONTHLY_ARTIFACT_FREQUENCY,
} from '../lib/forecast/identity'
import { buildForecastHistoryFingerprint } from '../lib/forecast/history-fingerprint'
import { buildCurrentHorizonConfigurationId } from '../lib/forecast/live-market-input'
import { PrismaClient } from '../generated/market-data-client'
import type { ExactForecastCapabilityResolution } from '../lib/forecast/capability-resolver'
import type { UserFacingForecastModelId } from '../lib/forecast/contracts'
import type { ForecastPreparationOwnedExecutionContext } from '../lib/forecast/execution-ledger'
import type {
  ForecastBridge,
  ForecastLibraryServiceDependencies,
  ForecastPersistenceOwnership,
  PersistedCurrentArtifact,
  PersistedVerificationArtifact,
} from '../lib/forecast/service'

const marketDataDatabaseUrl = process.env.MARKET_DATA_DATABASE_URL?.trim()

if (!marketDataDatabaseUrl) {
  throw new Error('Stage 3 cross-instance tests require MARKET_DATA_DATABASE_URL to target the isolated PostgreSQL authority.')
}

const marketDataPrisma = new PrismaClient({
  datasources: {
    db: {
      url: marketDataDatabaseUrl,
    },
  },
})

let createDefaultForecastPreparationExecutionAdmission: typeof import('../lib/forecast/execution-ledger')['createDefaultForecastPreparationExecutionAdmission']
let createForecastPreparationExecutionLedger: typeof import('../lib/forecast/execution-ledger')['createForecastPreparationExecutionLedger']
let setForecastPreparationExecutionLedgerTestHooks: typeof import('../lib/forecast/execution-ledger')['setForecastPreparationExecutionLedgerTestHooks']
let createForecastLibraryService: typeof import('../lib/forecast/service')['createForecastLibraryService']
let readCurrentRunFromPrisma: typeof import('../lib/forecast/service')['readCurrentRunFromPrisma']
let setForecastPersistenceTestHooks: typeof import('../lib/forecast/service')['setForecastPersistenceTestHooks']
let writeCurrentRunWithPrisma: typeof import('../lib/forecast/service')['writeCurrentRunWithPrisma']
let writeVerificationRunWithPrisma: typeof import('../lib/forecast/service')['writeVerificationRunWithPrisma']

function requirePrisma() {
  return marketDataPrisma
}

const workerPath = fileURLToPath(new URL('./helpers/forecast-stage3-instance-worker.ts', import.meta.url))
const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

type WorkerResult = {
  status: string
  cacheStatus?: string
  reason?: string
  methodVersion?: string
  historyFingerprint?: string
}

type WorkerRun = {
  exitCode: number
  stdout: string
  stderr: string
  result: WorkerResult | null
}

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
            modelFamily: modelId,
            selectedVariant: modelId === 'arima' ? 'ARIMA(0,1,1)' : 'ETS(A,N,N)',
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
          forecastValue: modelId === 'arima' ? 1151.5 : 1144.5,
          metadata: {
            modelFamily: modelId,
            selectedVariant: modelId === 'arima' ? 'ARIMA(0,1,1)' : 'ETS(A,N,N)',
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

function createPeriodicHistoryResponse(
  seriesId: string,
  sourceFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY',
  targetCadence: 'MONTHLY' | 'QUARTERLY',
  targetBasis: 'MONTHLY_AVERAGE' | 'END_OF_PERIOD',
  observations = 40,
) {
  const stepMonths = targetCadence === 'MONTHLY' ? 1 : 3
  const points = Array.from({ length: observations }, (_, index) => {
    const date = new Date(Date.UTC(2022, index * stepMonths, 1)).toISOString()
    return {
      date,
      value: 1000 + index,
      sourceObservedAt: targetBasis === 'END_OF_PERIOD'
        ? new Date(Date.UTC(2022, index * stepMonths, 28)).toISOString()
        : undefined,
    }
  })
  const start = points[0]?.date ?? null
  const end = points[points.length - 1]?.date ?? null

  return {
    status: 'AVAILABLE' as const,
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: `prepared-${seriesId}`,
    },
    benchmark: {
      seriesId,
      component: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: targetCadence,
      expectedObservations: observations,
    },
    history: {
      seriesId,
      benchmarkName: 'FRACHT_DRY',
      description: 'Baltic Exchange, Dry Index (BDI), USD',
      frequency: targetCadence,
      start,
      end,
      observations,
      points,
    },
    sourceFrequency,
    targetCadence,
  }
}

function createPreparedCurrentArtifact(
  historyResponse: ReturnType<typeof createPeriodicHistoryResponse>,
  modelId: UserFacingForecastModelId,
  targetBasis: 'MONTHLY_AVERAGE' | 'END_OF_PERIOD',
  options: {
    methodVersion?: string
    historyFingerprint?: string
  } = {},
): PersistedCurrentArtifact {
  const targetSemantics = targetBasis
  const cadence = createForecastCadence(historyResponse.sourceFrequency, historyResponse.targetCadence)
  const historyFingerprint = options.historyFingerprint
    ?? buildForecastHistoryFingerprint({
      ...historyResponse.history,
      cadence,
    })

  return {
    seriesId: historyResponse.history.seriesId,
    modelId,
    displayName: 'FRACHT_DRY',
    description: 'Baltic Exchange, Dry Index (BDI), USD',
    targetBasis,
    targetSemantics,
    methodId: targetBasis,
    methodVersion: options.methodVersion ?? historyResponse.methodVersion,
    source: historyResponse.source,
    preparation: null,
    historyFingerprint,
    cadence,
    frequencyIdentity: buildForecastArtifactCadenceIdentity(cadence),
    statisticalCompatibility: createCurrentForecastStatisticalCompatibility({
      sourceFrequency: historyResponse.sourceFrequency,
      targetCadence: historyResponse.targetCadence,
      targetSemantics,
    }),
    history: {
      frequency: historyResponse.history.frequency,
      start: historyResponse.history.start,
      end: historyResponse.history.end,
      observations: historyResponse.history.observations,
    },
    forecastOrigin: historyResponse.history.end,
    runtimeSeconds: 0.084,
    currentForecast: {
      [`1${historyResponse.targetCadence === 'MONTHLY' ? 'M' : 'Q'}`]: {
        horizon: `1${historyResponse.targetCadence === 'MONTHLY' ? 'M' : 'Q'}`,
        horizonSteps: 1,
        forecastDate: new Date(Date.UTC(2025, historyResponse.targetCadence === 'MONTHLY' ? 10 : 11, 1)).toISOString(),
        forecastValue: modelId === 'arima' ? 1151.5 : 1144.5,
        metadata: {
          modelFamily: modelId,
          selectedVariant: modelId === 'arima' ? 'ARIMA(0,1,1)' : 'ETS(A,N,N)',
          selectedParameters: {},
          selectionScore: 0.12,
          selectionMetric: 'rmse',
          fitStatus: 'SUCCEEDED',
          failureReason: null,
        },
        failureReason: null,
      },
    },
  }
}

function createPreparedVerificationArtifact(
  historyResponse: ReturnType<typeof createPeriodicHistoryResponse>,
  modelId: UserFacingForecastModelId,
  targetBasis: 'MONTHLY_AVERAGE' | 'END_OF_PERIOD',
  options: {
    methodVersion?: string
    historyFingerprint?: string
  } = {},
): PersistedVerificationArtifact {
  const targetSemantics = targetBasis
  const cadence = createForecastCadence(historyResponse.sourceFrequency, historyResponse.targetCadence)
  const historyFingerprint = options.historyFingerprint
    ?? buildForecastHistoryFingerprint({
      ...historyResponse.history,
      cadence,
    })

  return {
    seriesId: historyResponse.history.seriesId,
    modelId,
    displayName: 'FRACHT_DRY',
    description: 'Baltic Exchange, Dry Index (BDI), USD',
    targetBasis,
    targetSemantics,
    methodId: targetBasis,
    methodVersion: options.methodVersion ?? historyResponse.methodVersion,
    source: historyResponse.source,
    preparation: null,
    historyFingerprint,
    cadence,
    frequencyIdentity: buildForecastArtifactCadenceIdentity(cadence),
    statisticalCompatibility: createFullVerificationStatisticalCompatibility({
      sourceFrequency: historyResponse.sourceFrequency,
      targetCadence: historyResponse.targetCadence,
      targetSemantics,
    }),
    history: {
      frequency: historyResponse.history.frequency,
      start: historyResponse.history.start,
      end: historyResponse.history.end,
      observations: historyResponse.history.observations,
    },
    forecastOrigin: historyResponse.history.end,
    runtimeSeconds: 0.084,
    verification: {
      [`1${historyResponse.targetCadence === 'MONTHLY' ? 'M' : 'Q'}`]: {
        horizon: `1${historyResponse.targetCadence === 'MONTHLY' ? 'M' : 'Q'}`,
        horizonSteps: 1,
        origins: 24,
        expectedOrigins: 24,
        successfulOrigins: 24,
        failedOrigins: 0,
        coverage: 1,
        metrics: {
          mae: 1,
          rmse: 1.2,
          mase: 0.4,
          smape: 0.02,
          directionalAccuracy: 0.75,
          bias: 0.1,
        },
        records: [
          {
            benchmarkId: historyResponse.history.seriesId,
            modelId,
            forecastOrigin: historyResponse.history.end ?? '2025-10-01T00:00:00.000Z',
            horizon: `1${historyResponse.targetCadence === 'MONTHLY' ? 'M' : 'Q'}`,
            horizonSteps: 1,
            forecastDate: new Date(Date.UTC(2025, historyResponse.targetCadence === 'MONTHLY' ? 10 : 11, 1)).toISOString(),
            actualObservedAt: targetBasis === 'END_OF_PERIOD'
              ? new Date(Date.UTC(2025, historyResponse.targetCadence === 'MONTHLY' ? 10 : 11, 28)).toISOString()
              : null,
            originValue: 1100,
            forecastValue: 1110,
            actualValue: 1112,
            error: -2,
            absoluteError: 2,
            delta: 10,
            deltaPct: 0.009,
            maseScale: 5,
            metadata: {
              modelFamily: modelId,
              selectedVariant: modelId === 'arima' ? 'ARIMA(0,1,1)' : 'ETS(A,N,N)',
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
  }
}

function createCurrentLogicalArtifactIdentity(seriesId: string, modelId = 'ets'): CurrentLogicalArtifactIdentity {
  const statisticalCompatibility = createCurrentForecastStatisticalCompatibility({
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'MONTHLY_AVERAGE',
  })
  const history = createHistoryResponse(seriesId).history

  return {
    artifactScope: statisticalCompatibility.artifactScope,
    seriesId,
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    trainingWindowPolicyId: statisticalCompatibility.trainingWindowPolicyId,
    modelId,
    inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
    historyFingerprint: buildForecastHistoryFingerprint(history),
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    frequencyIdentity: 'MONTHLY',
    forecastOrigin: history.end,
    horizonConfigurationId: buildCurrentHorizonConfigurationId(history.end, 'MONTHLY'),
  }
}

function buildCurrentStage3LogicalArtifactKey(seriesId: string, modelId = 'ets') {
  return buildCurrentLogicalArtifactKey(createCurrentLogicalArtifactIdentity(seriesId, modelId))
}

function createCurrentArtifact(seriesId: string, modelId: string): PersistedCurrentArtifact {
  const history = createHistoryResponse(seriesId).history
  return {
    seriesId,
    modelId,
    displayName: 'FRACHT_DRY',
    description: 'Baltic Exchange, Dry Index (BDI), USD',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    source: {
      kind: 'POSTGRES_RUNTIME_SNAPSHOT',
      runId: 'cmrd3xvlu0000cedt8gczw378',
    },
    preparation: null,
    historyFingerprint: buildForecastHistoryFingerprint(history),
    cadence: null,
    frequencyIdentity: LEGACY_MONTHLY_ARTIFACT_FREQUENCY,
    statisticalCompatibility: createCurrentForecastStatisticalCompatibility({
      sourceFrequency: 'MONTHLY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'MONTHLY_AVERAGE',
    }),
    history: {
      frequency: history.frequency,
      start: history.start,
      end: history.end,
      observations: history.observations,
    },
    forecastOrigin: history.end,
    runtimeSeconds: 0.084,
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-05-01T00:00:00.000Z',
        forecastValue: 1132.5,
        metadata: {
          modelFamily: modelId,
          selectedVariant: modelId === 'arima' ? 'ARIMA(0,1,1)' : 'ETS(A,N,N)',
          selectedParameters: {},
          selectionScore: 0.12,
          selectionMetric: 'rmse',
          fitStatus: 'SUCCEEDED',
          failureReason: null,
        },
        failureReason: null,
      },
    },
  }
}

function createOwnedPersistence(
  logicalArtifactKey: string,
  ownership: ForecastPreparationOwnedExecutionContext,
): ForecastPersistenceOwnership {
  return {
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    executionId: ownership.executionId,
    ownerToken: ownership.ownerToken,
    leaseVersion: ownership.leaseVersion,
    requestId: ownership.requestId,
    ownerRequestId: ownership.ownerRequestId,
    role: ownership.role,
  }
}

function buildCurrentCacheLookupKey(artifact: PersistedCurrentArtifact) {
  return {
    seriesId: artifact.seriesId,
    modelId: artifact.modelId,
    targetSemantics: artifact.targetSemantics,
    methodId: artifact.methodId,
    methodVersion: artifact.methodVersion,
    inputSource: artifact.source.kind,
    historyFingerprint: artifact.historyFingerprint,
    targetBasis: artifact.targetBasis,
    frequencyIdentity: artifact.frequencyIdentity,
    trainingWindowPolicyId: artifact.statisticalCompatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: artifact.statisticalCompatibility.effectiveTrainingPolicyId,
  } as const
}

async function resetForecastTables() {
  await requirePrisma().$executeRawUnsafe(`
    TRUNCATE TABLE
      "forecast_current_points",
      "forecast_current_runs",
      "forecast_verification_points",
      "forecast_verification_metrics",
      "forecast_verification_runs",
      "forecast_preparation_execution_ledger"
    RESTART IDENTITY CASCADE
  `)
}

function parseWorkerResult(stdout: string) {
  const trimmed = stdout.trim()
  if (!trimmed) {
    return null
  }

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean)
  const lastLine = lines[lines.length - 1]
  return lastLine ? JSON.parse(lastLine) as WorkerResult : null
}

function runWorker(env: Record<string, string>) {
  return new Promise<WorkerRun>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', workerPath], {
      cwd: appRoot,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      resolve({
        exitCode: code ?? -1,
        stdout,
        stderr,
        result: parseWorkerResult(stdout),
      })
    })
  })
}

async function runSuccessfulWorker(env: Record<string, string>) {
  const run = await runWorker(env)
  if (run.exitCode !== 0 || !run.result) {
    throw new Error(run.stderr || run.stdout || `Worker exited with code ${run.exitCode}.`)
  }
  return run.result
}

async function readComputeCount(filePath: string) {
  const lines = (await readFile(filePath, 'utf8'))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.length
}

async function waitForExecution(logicalArtifactKey: string, timeoutMs = 5_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const record = await requirePrisma().forecastPreparationExecutionLedger.findFirst({
      where: { logicalArtifactKey },
      orderBy: [{ startedAt: 'desc' }, { updatedAt: 'desc' }],
    })
    if (record) {
      return record
    }
    await delay(25)
  }

  throw new Error(`Timed out waiting for execution ${logicalArtifactKey}.`)
}

async function waitForExecutionStatus(
  logicalArtifactKey: string,
  executionStatus: 'STARTED' | 'COMPLETED' | 'FAILED',
  timeoutMs = 5_000,
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const record = await requirePrisma().forecastPreparationExecutionLedger.findFirst({
      where: { logicalArtifactKey },
      orderBy: [{ startedAt: 'desc' }, { updatedAt: 'desc' }],
    })
    if (record?.executionStatus === executionStatus) {
      return record
    }
    await delay(25)
  }

  throw new Error(`Timed out waiting for execution ${logicalArtifactKey} to reach ${executionStatus}.`)
}

function createBarrier() {
  let release: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })

  return {
    promise,
    release() {
      release?.()
    },
  }
}

function createDbBackedService(
  bridgeOverrides: Partial<ForecastBridge> = {},
  serviceOverrides: Partial<ForecastLibraryServiceDependencies> = {},
) {
  const bridge: ForecastBridge = {
    async exportHistory(input) {
      return createHistoryResponse(input.seriesId)
    },
    async exportCurrent(input) {
      return createCurrentResponse(input.seriesId, String(input.modelId))
    },
    async exportVerification(input) {
      return {
        status: 'FAILED' as const,
        reason: 'unused-verification-path',
        seriesId: input.seriesId,
        model: String(input.modelId),
        methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
        source: {
          kind: 'POSTGRES_RUNTIME_SNAPSHOT',
          runId: 'cmrd3xvlu0000cedt8gczw378',
        },
      }
    },
    ...bridgeOverrides,
  }

  const resolveExactPreparedCapability: ForecastLibraryServiceDependencies['resolveExactPreparedCapability'] = serviceOverrides.resolveExactPreparedCapability ?? (async ({ seriesId, modelId, targetSemantics }) => {
      const historyResponse = await bridge.exportHistory({
        seriesId,
        targetBasis: targetSemantics === 'END_OF_PERIOD' ? 'END_OF_PERIOD' : 'MONTHLY_AVERAGE',
      }) as ReturnType<typeof createPeriodicHistoryResponse>

      if (historyResponse.status !== 'AVAILABLE') {
        throw new Error(`Expected AVAILABLE history response for exact prepared capability on ${seriesId}.`)
      }

      return createExactPreparedCapability(
        seriesId,
        modelId,
        targetSemantics as 'MONTHLY_AVERAGE' | 'END_OF_PERIOD',
        historyResponse.sourceFrequency as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY',
        historyResponse.targetCadence as 'MONTHLY' | 'QUARTERLY',
        historyResponse.history.observations,
      )
    })

  return createForecastLibraryService({
    ...serviceOverrides,
    bridge,
    resolveExactPreparedCapability,
    logEvent: () => {},
    telemetry: {
      emit() {},
    },
  })
}

function createExactPreparedCapability(
  seriesId: string,
  modelId: UserFacingForecastModelId,
  targetSemantics: 'MONTHLY_AVERAGE' | 'END_OF_PERIOD',
  sourceFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY',
  targetCadence: 'MONTHLY' | 'QUARTERLY',
  availableObservations: number,
): ExactForecastCapabilityResolution {
  const businessTarget = targetSemantics === 'END_OF_PERIOD' ? 'END_OF_PERIOD' : 'AVERAGE'

  return {
    resolution: {} as never,
    capability: {
      identity: {
        seriesId,
        modelId,
        targetSemantics,
        methodId: targetSemantics,
        methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
      },
      sourceFrequency,
      sourceFrequencyRecognized: true,
      businessTarget,
      targetCadence,
      targetSemanticsSupported: true,
      horizonSupportState: 'NOT_REQUESTED',
      horizonMonths: null,
      horizonSteps: null,
      semanticLawfulness: sourceFrequency === 'MONTHLY' ? 'LAWFUL_WITH_PROVENANCE' : 'LAWFUL_WITH_PROVENANCE',
      admissionState: 'ADMITTED',
      provenanceStatus: 'PROVEN',
      implementationState: 'SUPPORTED',
      historyEligibility: 'ELIGIBLE',
      minimumRequiredObservations: 36,
      availableObservations,
      modelEligible: true,
      currentForecastEligible: true,
      verificationOriginCount: 24,
      verificationEvidenceState: 'SUFFICIENT',
      predictionBandResidualCount: 30,
      predictionBandState: 'AVAILABLE',
      targetPreparationState: 'PREPARED',
      currentPreparedState: 'READY',
      historicalPreparedState: 'READY',
      capabilityState: 'AVAILABLE',
    },
    trace: {} as never,
  }
}

const serialTest = (name: string, fn: (context: TestContext) => Promise<void> | void) =>
  test(name, { concurrency: false }, fn)

test.before(async () => {
  const executionLedgerModule = await import('../lib/forecast/execution-ledger')
  const serviceModule = await import('../lib/forecast/service')

  createDefaultForecastPreparationExecutionAdmission = executionLedgerModule.createDefaultForecastPreparationExecutionAdmission
  createForecastPreparationExecutionLedger = executionLedgerModule.createForecastPreparationExecutionLedger
  setForecastPreparationExecutionLedgerTestHooks = executionLedgerModule.setForecastPreparationExecutionLedgerTestHooks
  createForecastLibraryService = serviceModule.createForecastLibraryService
  readCurrentRunFromPrisma = serviceModule.readCurrentRunFromPrisma
  setForecastPersistenceTestHooks = serviceModule.setForecastPersistenceTestHooks
  writeCurrentRunWithPrisma = serviceModule.writeCurrentRunWithPrisma
  writeVerificationRunWithPrisma = serviceModule.writeVerificationRunWithPrisma
})

test.beforeEach(async () => {
  await resetForecastTables()
  setForecastPreparationExecutionLedgerTestHooks(null)
  setForecastPersistenceTestHooks(null)
})

test.after(async () => {
  setForecastPreparationExecutionLedgerTestHooks(null)
  setForecastPersistenceTestHooks(null)
  await requirePrisma().$disconnect()
})

serialTest('db-backed current requests use the production composition and converge to one authoritative execution, one compute, and one artifact', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-current-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const [first, second] = await Promise.all([
      runSuccessfulWorker({
        STAGE3_MODE: 'current',
        STAGE3_SERIES_ID: 'stage3-current-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '200',
      }),
      runSuccessfulWorker({
        STAGE3_MODE: 'current',
        STAGE3_SERIES_ID: 'stage3-current-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '200',
      }),
    ])

    assert.deepEqual([first.status, second.status], ['AVAILABLE', 'AVAILABLE'])
    assert.deepEqual([first.cacheStatus, second.cacheStatus].sort(), ['hit', 'miss'])
    assert.equal(await readComputeCount(computeLogPath), 1)

    const runs = await requirePrisma().forecastCurrentRun.findMany({ where: { seriesId: 'stage3-current-series' } })
    assert.equal(runs.length, 1)

    const executions = await requirePrisma().forecastPreparationExecutionLedger.findMany({
      where: {
        seriesId: 'stage3-current-series',
        operationFamily: 'CURRENT',
      },
    })
    assert.equal(executions.length, 1)
    assert.equal(executions[0]?.executionStatus, 'COMPLETED')
    assert.ok((executions[0]?.eventCount ?? 0) > 0)
    assert.equal(executions[0]?.waiterCount, 1)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed verification requests use the production composition and converge to one authoritative execution, one compute, and one artifact', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-verification-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const [first, second] = await Promise.all([
      runSuccessfulWorker({
        STAGE3_MODE: 'verification',
        STAGE3_SERIES_ID: 'stage3-verification-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '200',
      }),
      runSuccessfulWorker({
        STAGE3_MODE: 'verification',
        STAGE3_SERIES_ID: 'stage3-verification-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '200',
      }),
    ])

    assert.deepEqual([first.status, second.status], ['AVAILABLE', 'AVAILABLE'])
    assert.deepEqual([first.cacheStatus, second.cacheStatus].sort(), ['hit', 'miss'])
    assert.equal(await readComputeCount(computeLogPath), 1)

    const executions = await requirePrisma().forecastPreparationExecutionLedger.findMany({
      where: {
        seriesId: 'stage3-verification-series',
        operationFamily: 'VERIFICATION',
      },
    })
    assert.equal(executions.length, 1)
    assert.equal(executions[0]?.executionStatus, 'COMPLETED')
    assert.ok((executions[0]?.eventCount ?? 0) > 0)
    assert.equal(executions[0]?.waiterCount, 1)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed high concurrency produces one authoritative owner, one compute, and one artifact across twenty requests', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-high-concurrency-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const logicalArtifactKey = buildCurrentStage3LogicalArtifactKey('stage3-high-concurrency-series')
    const results = await Promise.all(
      Array.from({ length: 20 }, () => runSuccessfulWorker({
        STAGE3_MODE: 'current',
        STAGE3_SERIES_ID: 'stage3-high-concurrency-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '300',
      })),
    )

    assert.ok(results.every((result) => result.status === 'AVAILABLE'))
    assert.equal(results.filter((result) => result.cacheStatus === 'miss').length, 1)
    assert.equal(results.filter((result) => result.cacheStatus === 'hit').length, 19)
    assert.equal(await readComputeCount(computeLogPath), 1)

    const runs = await requirePrisma().forecastCurrentRun.findMany({ where: { seriesId: 'stage3-high-concurrency-series' } })
    assert.equal(runs.length, 1)
    const completedExecution = await waitForExecutionStatus(logicalArtifactKey, 'COMPLETED')
    const executions = await requirePrisma().forecastPreparationExecutionLedger.findMany({
      where: {
        seriesId: 'stage3-high-concurrency-series',
        operationFamily: 'CURRENT',
      },
    })
    assert.equal(executions.length, 1)
    assert.equal(completedExecution.executionStatus, 'COMPLETED')
    assert.ok(completedExecution.waiterCount >= 1)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed different logical identities compute independently without global serialization', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-identities-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const [ets, arima] = await Promise.all([
      runSuccessfulWorker({
        STAGE3_MODE: 'current',
        STAGE3_SERIES_ID: 'stage3-different-identity-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '300',
      }),
      runSuccessfulWorker({
        STAGE3_MODE: 'current',
        STAGE3_SERIES_ID: 'stage3-different-identity-series',
        STAGE3_MODEL_ID: 'arima',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '300',
      }),
    ])

    assert.deepEqual([ets.status, arima.status], ['AVAILABLE', 'AVAILABLE'])
    assert.deepEqual([ets.cacheStatus, arima.cacheStatus], ['miss', 'miss'])
    assert.equal(await readComputeCount(computeLogPath), 2)

    const runs = await requirePrisma().forecastCurrentRun.findMany({ where: { seriesId: 'stage3-different-identity-series' } })
    assert.equal(runs.length, 2)
    const executions = await requirePrisma().forecastPreparationExecutionLedger.findMany({
      where: {
        seriesId: 'stage3-different-identity-series',
        operationFamily: 'CURRENT',
      },
    })
    assert.equal(executions.length, 2)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed prepared artifact hits require zero compute and zero new execution rows', async () => {
  const seriesId = 'stage3-prepared-hit-series'
  await writeCurrentRunWithPrisma(createCurrentArtifact(seriesId, 'ets'))

  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-prepared-hit-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const results = await Promise.all(
      Array.from({ length: 4 }, () => runSuccessfulWorker({
        STAGE3_MODE: 'current',
        STAGE3_SERIES_ID: seriesId,
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '200',
      })),
    )

    assert.ok(results.every((result) => result.status === 'AVAILABLE'))
    assert.ok(results.every((result) => result.cacheStatus === 'hit'))
    assert.equal(await readComputeCount(computeLogPath), 0)

    const executionCount = await requirePrisma().forecastPreparationExecutionLedger.count({
      where: { seriesId },
    })
    assert.equal(executionCount, 0)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed current persistence keeps policy-distinct artifacts separate and round-trips persisted policy identity', async () => {
  const history = createPeriodicHistoryResponse('stage4-current-policy-roundtrip-series', 'MONTHLY', 'MONTHLY', 'MONTHLY_AVERAGE', 48)
  const currentArtifact = createPreparedCurrentArtifact(history, 'ets', 'MONTHLY_AVERAGE')
  const recentCompatibility = createRecentVerificationStatisticalCompatibility({
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    targetSemantics: 'MONTHLY_AVERAGE',
  })
  const recentPolicyArtifact: PersistedCurrentArtifact = {
    ...currentArtifact,
    statisticalCompatibility: recentCompatibility,
    currentForecast: {
      ...currentArtifact.currentForecast,
      '1M': {
        ...currentArtifact.currentForecast['1M'],
        forecastValue: 2048.25,
      },
    },
  }

  await writeCurrentRunWithPrisma(currentArtifact)
  await writeCurrentRunWithPrisma(recentPolicyArtifact)

  const runCount = await requirePrisma().forecastCurrentRun.count({
    where: { seriesId: history.history.seriesId },
  })
  assert.equal(runCount, 2)

  const exactCurrent = await readCurrentRunFromPrisma(buildCurrentCacheLookupKey(currentArtifact))
  const exactRecent = await readCurrentRunFromPrisma(buildCurrentCacheLookupKey(recentPolicyArtifact))

  assert.ok(exactCurrent)
  assert.ok(exactRecent)
  assert.equal(exactCurrent?.statisticalCompatibility.trainingWindowPolicyId, currentArtifact.statisticalCompatibility.trainingWindowPolicyId)
  assert.equal(exactCurrent?.statisticalCompatibility.effectiveTrainingPolicyId, currentArtifact.statisticalCompatibility.effectiveTrainingPolicyId)
  assert.equal(exactCurrent?.currentForecast['1M']?.forecastValue, currentArtifact.currentForecast['1M']?.forecastValue)
  assert.equal(exactRecent?.statisticalCompatibility.trainingWindowPolicyId, recentPolicyArtifact.statisticalCompatibility.trainingWindowPolicyId)
  assert.equal(exactRecent?.statisticalCompatibility.effectiveTrainingPolicyId, recentPolicyArtifact.statisticalCompatibility.effectiveTrainingPolicyId)
  assert.equal(exactRecent?.currentForecast['1M']?.forecastValue, 2048.25)
})

serialTest('db-backed prepared current reads surface weekly, native monthly, and quarterly artifacts with zero compute and zero execution rows', async () => {
  const weeklyHistory = createPeriodicHistoryResponse('stage4-weekly-current-series', 'WEEKLY', 'MONTHLY', 'END_OF_PERIOD')
  const monthlyHistory = createPeriodicHistoryResponse('stage4-native-monthly-current-series', 'MONTHLY', 'MONTHLY', 'MONTHLY_AVERAGE')
  const quarterlyHistory = createPeriodicHistoryResponse('stage4-quarterly-current-series', 'QUARTERLY', 'QUARTERLY', 'MONTHLY_AVERAGE')

  await writeCurrentRunWithPrisma(createPreparedCurrentArtifact(weeklyHistory, 'ets', 'END_OF_PERIOD'))
  await writeCurrentRunWithPrisma(createPreparedCurrentArtifact(monthlyHistory, 'ets', 'MONTHLY_AVERAGE'))
  await writeCurrentRunWithPrisma(createPreparedCurrentArtifact(quarterlyHistory, 'ets', 'MONTHLY_AVERAGE'))

  const service = createDbBackedService({
    async exportHistory(input) {
      if (input.seriesId === weeklyHistory.history.seriesId) return weeklyHistory
      if (input.seriesId === monthlyHistory.history.seriesId) return monthlyHistory
      if (input.seriesId === quarterlyHistory.history.seriesId) return quarterlyHistory
      throw new Error(`Unexpected prepared current history lookup for ${input.seriesId}.`)
    },
    async exportCurrent() {
      throw new Error('Prepared current read must not invoke compute exportCurrent.')
    },
    async exportVerification() {
      throw new Error('Prepared current read must not invoke compute exportVerification.')
    },
  })

  const weekly = await service.readPreparedCurrentForecastRequest({
    seriesId: weeklyHistory.history.seriesId,
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
    sourceFrequency: 'WEEKLY',
    targetCadence: 'MONTHLY',
  })
  const monthly = await service.readPreparedCurrentForecastRequest({
    seriesId: monthlyHistory.history.seriesId,
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
  })
  const quarterly = await service.readPreparedCurrentForecastRequest({
    seriesId: quarterlyHistory.history.seriesId,
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })

  assert.equal(weekly.status, 'AVAILABLE')
  assert.equal(monthly.status, 'AVAILABLE')
  assert.equal(quarterly.status, 'AVAILABLE')

  if (weekly.status === 'AVAILABLE') {
    assert.equal(weekly.lineage.sourceFrequency, 'WEEKLY')
    assert.equal(weekly.history.frequency, 'MONTHLY')
    assert.ok(Object.values(weekly.currentForecast).some((point) => point.forecastValue !== null))
  }

  if (monthly.status === 'AVAILABLE') {
    assert.equal(monthly.lineage.sourceFrequency, 'MONTHLY')
    assert.equal(monthly.history.frequency, 'MONTHLY')
    assert.ok(Object.values(monthly.currentForecast).some((point) => point.forecastValue !== null))
  }

  if (quarterly.status === 'AVAILABLE') {
    assert.equal(quarterly.lineage.sourceFrequency, 'QUARTERLY')
    assert.equal(quarterly.history.frequency, 'QUARTERLY')
    assert.ok(Object.values(quarterly.currentForecast).some((point) => point.forecastValue !== null))
  }

  const executionCount = await requirePrisma().forecastPreparationExecutionLedger.count()
  assert.equal(executionCount, 0)
})

serialTest('db-backed prepared current reads fail closed for persisted training policy mismatches without compute or execution rows', async () => {
  const history = createPeriodicHistoryResponse('stage4-current-policy-mismatch-series', 'MONTHLY', 'MONTHLY', 'MONTHLY_AVERAGE', 48)
  const mismatchedArtifact: PersistedCurrentArtifact = {
    ...createPreparedCurrentArtifact(history, 'ets', 'MONTHLY_AVERAGE'),
    statisticalCompatibility: createRecentVerificationStatisticalCompatibility({
      sourceFrequency: 'MONTHLY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'MONTHLY_AVERAGE',
    }),
  }

  await writeCurrentRunWithPrisma(mismatchedArtifact)

  const service = createDbBackedService({
    async exportHistory(input) {
      if (input.seriesId === history.history.seriesId) return history
      throw new Error(`Unexpected prepared current history lookup for ${input.seriesId}.`)
    },
    async exportCurrent() {
      throw new Error('Prepared current read must not invoke compute exportCurrent.')
    },
    async exportVerification() {
      throw new Error('Prepared current read must not invoke compute exportVerification.')
    },
  })

  const result = await service.readPreparedCurrentForecastRequest({
    seriesId: history.history.seriesId,
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
  })

  assert.equal(result.status, 'NOT_AVAILABLE')

  const executionCount = await requirePrisma().forecastPreparationExecutionLedger.count({
    where: { seriesId: history.history.seriesId },
  })
  assert.equal(executionCount, 0)
})

serialTest('db-backed prepared current reads fail closed for unlawful explicit cadence and non-renderable payloads without compute or execution rows', async () => {
  const unlawfulHistory = createPeriodicHistoryResponse('stage4-unlawful-explicit-current-series', 'QUARTERLY', 'QUARTERLY', 'MONTHLY_AVERAGE', 48)
  const emptyArtifact = {
    ...createPreparedCurrentArtifact(
      createPeriodicHistoryResponse('stage4-empty-current-series', 'MONTHLY', 'MONTHLY', 'MONTHLY_AVERAGE', 48),
      'ets',
      'MONTHLY_AVERAGE',
    ),
    currentForecast: {},
  }
  const nullPointArtifactBase = createPreparedCurrentArtifact(
    createPeriodicHistoryResponse('stage4-null-point-current-series', 'MONTHLY', 'MONTHLY', 'END_OF_PERIOD', 48),
    'ets',
    'END_OF_PERIOD',
  )
  const nullPointArtifact = {
    ...nullPointArtifactBase,
    currentForecast: {
      '1M': {
        ...nullPointArtifactBase.currentForecast['1M'],
        forecastValue: null,
      },
    },
  }

  await writeCurrentRunWithPrisma(createPreparedCurrentArtifact(unlawfulHistory, 'ets', 'MONTHLY_AVERAGE'))
  await writeCurrentRunWithPrisma(emptyArtifact)
  await writeCurrentRunWithPrisma(nullPointArtifact)

  const service = createDbBackedService({
    async exportHistory(input) {
      if (input.seriesId === unlawfulHistory.history.seriesId) return unlawfulHistory
      if (input.seriesId === emptyArtifact.seriesId) return createPeriodicHistoryResponse(emptyArtifact.seriesId, 'MONTHLY', 'MONTHLY', 'MONTHLY_AVERAGE', 48)
      if (input.seriesId === nullPointArtifact.seriesId) return createPeriodicHistoryResponse(nullPointArtifact.seriesId, 'MONTHLY', 'MONTHLY', 'END_OF_PERIOD', 48)
      throw new Error(`Unexpected prepared current history lookup for ${input.seriesId}.`)
    },
    async exportCurrent() {
      throw new Error('Prepared current read must not invoke compute exportCurrent.')
    },
    async exportVerification() {
      throw new Error('Prepared current read must not invoke compute exportVerification.')
    },
  }, {
    resolveExactPreparedCapability: async ({ seriesId, modelId, targetSemantics }) => {
      if (seriesId === unlawfulHistory.history.seriesId) {
        return createExactPreparedCapability(seriesId, modelId, targetSemantics as 'MONTHLY_AVERAGE', 'MONTHLY', 'MONTHLY', 48)
      }

      return createExactPreparedCapability(
        seriesId,
        modelId,
        targetSemantics as 'MONTHLY_AVERAGE' | 'END_OF_PERIOD',
        'MONTHLY',
        'MONTHLY',
        48,
      )
    },
  })

  const unlawfulCadence = await service.readPreparedCurrentForecastRequest({
    seriesId: unlawfulHistory.history.seriesId,
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })
  const emptyCurrent = await service.readPreparedCurrentForecastRequest({
    seriesId: emptyArtifact.seriesId,
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
  })
  const nullPointCurrent = await service.readPreparedCurrentForecastRequest({
    seriesId: nullPointArtifact.seriesId,
    modelId: 'ets',
    targetBasis: 'END_OF_PERIOD',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
  })

  assert.equal(unlawfulCadence.status, 'NOT_AVAILABLE')
  assert.equal(emptyCurrent.status, 'NOT_AVAILABLE')
  assert.equal(nullPointCurrent.status, 'NOT_AVAILABLE')
  if (unlawfulCadence.status === 'NOT_AVAILABLE') {
    assert.match(unlawfulCadence.reason, /Explicit cadence does not match the canonical prepared-read capability/)
  }
  if (emptyCurrent.status === 'NOT_AVAILABLE') {
    assert.match(emptyCurrent.reason, /not renderable/i)
  }
  if (nullPointCurrent.status === 'NOT_AVAILABLE') {
    assert.match(nullPointCurrent.reason, /not renderable/i)
  }

  const executionCount = await requirePrisma().forecastPreparationExecutionLedger.count()
  assert.equal(executionCount, 0)
})

serialTest('db-backed prepared verification reads require exact identity and create zero execution rows on hits or misses', async () => {
  const exactHistory = createPeriodicHistoryResponse('stage4-quarterly-verification-series', 'QUARTERLY', 'QUARTERLY', 'MONTHLY_AVERAGE', 48)
  const exactMonthlyHistory = createPeriodicHistoryResponse('stage4-quarterly-verification-series', 'MONTHLY', 'MONTHLY', 'MONTHLY_AVERAGE', 48)
  const staleHistory = createPeriodicHistoryResponse('stage4-stale-history-series', 'QUARTERLY', 'QUARTERLY', 'MONTHLY_AVERAGE', 48)
  const wrongMethodHistory = createPeriodicHistoryResponse('stage4-wrong-method-series', 'QUARTERLY', 'QUARTERLY', 'MONTHLY_AVERAGE', 48)
  const wrongPolicyHistory = createPeriodicHistoryResponse('stage4-wrong-policy-series', 'QUARTERLY', 'QUARTERLY', 'MONTHLY_AVERAGE', 48)

  await writeVerificationRunWithPrisma(createPreparedVerificationArtifact(exactHistory, 'arima', 'MONTHLY_AVERAGE'))
  await writeVerificationRunWithPrisma(createPreparedVerificationArtifact(staleHistory, 'arima', 'MONTHLY_AVERAGE', {
    historyFingerprint: 'stale-history-fingerprint',
  }))
  await writeVerificationRunWithPrisma(createPreparedVerificationArtifact(wrongMethodHistory, 'arima', 'MONTHLY_AVERAGE', {
    methodVersion: 'benchmark-forecasting-mvp-phase2-v2',
  }))
  await writeVerificationRunWithPrisma({
    ...createPreparedVerificationArtifact(wrongPolicyHistory, 'arima', 'MONTHLY_AVERAGE'),
    statisticalCompatibility: createRecentVerificationStatisticalCompatibility({
      sourceFrequency: 'QUARTERLY',
      targetCadence: 'QUARTERLY',
      targetSemantics: 'MONTHLY_AVERAGE',
    }),
  })

  const service = createDbBackedService({
    async exportHistory(input) {
      if (input.seriesId === exactHistory.history.seriesId) {
        return input.sourceFrequency === 'MONTHLY' && input.targetCadence === 'MONTHLY'
          ? exactMonthlyHistory
          : exactHistory
      }
      if (input.seriesId === staleHistory.history.seriesId) return staleHistory
      if (input.seriesId === wrongMethodHistory.history.seriesId) return wrongMethodHistory
      if (input.seriesId === wrongPolicyHistory.history.seriesId) return wrongPolicyHistory
      throw new Error(`Unexpected prepared verification history lookup for ${input.seriesId}.`)
    },
    async exportCurrent() {
      throw new Error('Prepared verification read must not invoke compute exportCurrent.')
    },
    async exportVerification() {
      throw new Error('Prepared verification read must not invoke compute exportVerification.')
    },
  })

  const exact = await service.readPreparedVerificationRequest({
    seriesId: exactHistory.history.seriesId,
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })
  const wrongModel = await service.readPreparedVerificationRequest({
    seriesId: exactHistory.history.seriesId,
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })
  const wrongTarget = await service.readPreparedVerificationRequest({
    seriesId: exactHistory.history.seriesId,
    modelId: 'arima',
    targetBasis: 'END_OF_PERIOD',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })
  const wrongSourceFrequency = await service.readPreparedVerificationRequest({
    seriesId: exactHistory.history.seriesId,
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
  })
  const wrongHistoryFingerprint = await service.readPreparedVerificationRequest({
    seriesId: staleHistory.history.seriesId,
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })
  const wrongMethodVersion = await service.readPreparedVerificationRequest({
    seriesId: wrongMethodHistory.history.seriesId,
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })
  const wrongTrainingPolicy = await service.readPreparedVerificationRequest({
    seriesId: wrongPolicyHistory.history.seriesId,
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })

  assert.equal(exact.status, 'AVAILABLE')
  if (exact.status === 'AVAILABLE') {
    assert.equal(exact.lineage.sourceFrequency, 'QUARTERLY')
    assert.equal(exact.history.frequency, 'QUARTERLY')
    assert.ok(Object.values(exact.verification).length > 0)
  }

  assert.equal(wrongModel.status, 'NOT_AVAILABLE')
  assert.equal(wrongTarget.status, 'NOT_AVAILABLE')
  assert.equal(wrongSourceFrequency.status, 'NOT_AVAILABLE')
  assert.equal(wrongHistoryFingerprint.status, 'NOT_AVAILABLE')
  assert.equal(wrongMethodVersion.status, 'NOT_AVAILABLE')
  assert.equal(wrongTrainingPolicy.status, 'NOT_AVAILABLE')

  const executionCount = await requirePrisma().forecastPreparationExecutionLedger.count()
  assert.equal(executionCount, 0)
})

serialTest('db-backed prepared verification reads fail closed for empty payloads and preserve lawful non-daily prepared hits', async () => {
  const exactHistory = createPeriodicHistoryResponse('stage4-verification-renderable-series', 'QUARTERLY', 'QUARTERLY', 'MONTHLY_AVERAGE', 48)
  const emptyVerificationHistory = createPeriodicHistoryResponse('stage4-verification-empty-series', 'QUARTERLY', 'QUARTERLY', 'MONTHLY_AVERAGE', 48)
  const renderableArtifact = createPreparedVerificationArtifact(exactHistory, 'arima', 'MONTHLY_AVERAGE')
  const emptyArtifact = {
    ...createPreparedVerificationArtifact(emptyVerificationHistory, 'arima', 'MONTHLY_AVERAGE'),
    verification: {},
  }

  await writeVerificationRunWithPrisma(renderableArtifact)
  await writeVerificationRunWithPrisma(emptyArtifact)

  const service = createDbBackedService({
    async exportHistory(input) {
      if (input.seriesId === exactHistory.history.seriesId) return exactHistory
      if (input.seriesId === emptyVerificationHistory.history.seriesId) return emptyVerificationHistory
      throw new Error(`Unexpected prepared verification history lookup for ${input.seriesId}.`)
    },
    async exportCurrent() {
      throw new Error('Prepared verification read must not invoke compute exportCurrent.')
    },
    async exportVerification() {
      throw new Error('Prepared verification read must not invoke compute exportVerification.')
    },
  })

  const renderable = await service.readPreparedVerificationRequest({
    seriesId: exactHistory.history.seriesId,
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })
  const empty = await service.readPreparedVerificationRequest({
    seriesId: emptyVerificationHistory.history.seriesId,
    modelId: 'arima',
    targetBasis: 'MONTHLY_AVERAGE',
    sourceFrequency: 'QUARTERLY',
    targetCadence: 'QUARTERLY',
  })

  assert.equal(renderable.status, 'AVAILABLE')
  assert.equal(empty.status, 'NOT_AVAILABLE')
  if (empty.status === 'NOT_AVAILABLE') {
    assert.match(empty.reason, /not renderable/i)
  }

  const executionCount = await requirePrisma().forecastPreparationExecutionLedger.count()
  assert.equal(executionCount, 0)
})

serialTest('db-backed simultaneous recovery elects one recovery owner and preserves predecessor lineage', async () => {
  const logicalArtifactIdentity = createCurrentLogicalArtifactIdentity('stage3-simultaneous-recovery-series')
  const logicalArtifactKey = buildCurrentStage3LogicalArtifactKey('stage3-simultaneous-recovery-series')
  const ownerAdmission = createDefaultForecastPreparationExecutionAdmission()
  const owner = await ownerAdmission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'stage3-recovery-owner',
    ownerRequestId: 'stage3-recovery-owner',
    observedAt: '2026-09-07T10:00:00.000Z',
  })

  assert.equal(owner.role, 'OWNER')
  if (owner.role !== 'OWNER') {
    throw new Error('Expected primary owner acquisition.')
  }

  const contenders = await Promise.all(
    Array.from({ length: 4 }, (_, index) => createDefaultForecastPreparationExecutionAdmission().acquireExecution({
      operationFamily: 'CURRENT',
      logicalArtifactKey,
      logicalArtifactIdentity,
      requestId: `stage3-recovery-contender-${index}`,
      ownerRequestId: `stage3-recovery-contender-${index}`,
      observedAt: '2026-09-07T10:01:01.000Z',
    })),
  )

  assert.equal(contenders.filter((result) => result.role === 'RECOVERY_OWNER').length, 1)
  assert.equal(contenders.filter((result) => result.role === 'WAITER').length, 3)

  const executions = await requirePrisma().forecastPreparationExecutionLedger.findMany({
    where: { logicalArtifactKey },
    orderBy: { startedAt: 'asc' },
  })
  assert.equal(executions.length, 2)
  assert.equal(executions[0]?.executionStatus, 'FAILED')
  assert.equal(executions[1]?.attemptKind, 'RECOVERY')
  assert.equal(executions[1]?.recoveredFromExecutionId, executions[0]?.executionId ?? null)
  assert.notEqual(executions[1]?.executionId, executions[0]?.executionId)
  assert.notEqual(executions[1]?.ownerToken, executions[0]?.ownerToken)
  assert.equal(executions[1]?.leaseVersion, (executions[0]?.leaseVersion ?? 0) + 1)
})

serialTest('db-backed terminal fencing rejects expired predecessors and allows the recovery owner to terminalize', async () => {
  const logicalArtifactIdentity = createCurrentLogicalArtifactIdentity('stage3-terminal-fencing-series')
  const logicalArtifactKey = buildCurrentStage3LogicalArtifactKey('stage3-terminal-fencing-series')
  const admission = createDefaultForecastPreparationExecutionAdmission()
  const owner = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'stage3-terminal-owner',
    ownerRequestId: 'stage3-terminal-owner',
    observedAt: '2026-09-07T11:00:00.000Z',
  })

  assert.equal(owner.role, 'OWNER')
  if (owner.role !== 'OWNER') {
    throw new Error('Expected primary owner acquisition.')
  }

  await assert.rejects(
    () => admission.markExecutionCompleted({
      executionId: owner.ownership.executionId,
      logicalArtifactKey,
      ownerToken: owner.ownership.ownerToken,
      leaseVersion: owner.ownership.leaseVersion,
      requestId: 'stage3-terminal-owner',
      ownerRequestId: owner.ownership.ownerRequestId,
      resultStatus: 'AVAILABLE',
      cacheStatus: 'miss',
      observedAt: '2026-09-07T11:01:01.000Z',
    }),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'STALE_OWNER',
  )

  await assert.rejects(
    () => admission.markExecutionFailed({
      executionId: owner.ownership.executionId,
      logicalArtifactKey,
      ownerToken: owner.ownership.ownerToken,
      leaseVersion: owner.ownership.leaseVersion,
      requestId: 'stage3-terminal-owner',
      ownerRequestId: owner.ownership.ownerRequestId,
      failurePhase: 'COMPUTE',
      failureReason: 'expired-before-terminalization',
      resultStatus: 'FAILED',
      cacheStatus: 'miss',
      observedAt: '2026-09-07T11:01:01.000Z',
    }),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'STALE_OWNER',
  )

  const recovery = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'stage3-terminal-recovery',
    ownerRequestId: 'stage3-terminal-recovery',
    observedAt: '2026-09-07T11:01:01.000Z',
  })

  assert.equal(recovery.role, 'RECOVERY_OWNER')
  if (recovery.role !== 'RECOVERY_OWNER') {
    throw new Error('Expected recovery owner acquisition.')
  }

  await admission.markExecutionCompleted({
    executionId: recovery.ownership.executionId,
    logicalArtifactKey,
    ownerToken: recovery.ownership.ownerToken,
    leaseVersion: recovery.ownership.leaseVersion,
    requestId: 'stage3-terminal-recovery',
    ownerRequestId: recovery.ownership.ownerRequestId,
    resultStatus: 'AVAILABLE',
    cacheStatus: 'hit',
    observedAt: '2026-09-07T11:01:02.000Z',
  })

  await assert.rejects(
    () => admission.markExecutionCompleted({
      executionId: owner.ownership.executionId,
      logicalArtifactKey,
      ownerToken: owner.ownership.ownerToken,
      leaseVersion: owner.ownership.leaseVersion,
      requestId: 'stage3-terminal-owner-late',
      ownerRequestId: owner.ownership.ownerRequestId,
      resultStatus: 'AVAILABLE',
      cacheStatus: 'miss',
      observedAt: '2026-09-07T11:01:03.000Z',
    }),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'STALE_OWNER',
  )
})

serialTest('db-backed long compute heartbeat keeps one global owner and one compute beyond the original lease window', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-heartbeat-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const ownerPromise = runSuccessfulWorker({
      STAGE3_MODE: 'current',
      STAGE3_SERIES_ID: 'stage3-heartbeat-series',
      STAGE3_MODEL_ID: 'ets',
      STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
      STAGE3_COMPUTE_LOG_PATH: computeLogPath,
      STAGE3_COMPUTE_DELAY_MS: '4500',
      FORECAST_STAGE3_LEASE_DURATION_MS: '3000',
    })

    await delay(3500)

    const contenderPromise = runSuccessfulWorker({
      STAGE3_MODE: 'current',
      STAGE3_SERIES_ID: 'stage3-heartbeat-series',
      STAGE3_MODEL_ID: 'ets',
      STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
      STAGE3_COMPUTE_LOG_PATH: computeLogPath,
      STAGE3_COMPUTE_DELAY_MS: '4500',
      FORECAST_STAGE3_LEASE_DURATION_MS: '3000',
    })

    const [owner, contender] = await Promise.all([ownerPromise, contenderPromise])

    assert.deepEqual([owner.status, contender.status], ['AVAILABLE', 'AVAILABLE'])
    assert.deepEqual([owner.cacheStatus, contender.cacheStatus].sort(), ['hit', 'miss'])
    assert.equal(await readComputeCount(computeLogPath), 1)

    const executions = await requirePrisma().forecastPreparationExecutionLedger.findMany({
      where: { seriesId: 'stage3-heartbeat-series' },
    })
    assert.equal(executions.length, 1)
    assert.equal(executions[0]?.executionStatus, 'COMPLETED')
    assert.equal(executions[0]?.attemptKind, 'PRIMARY')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed passive waiter ledger writes cannot overwrite authoritative lease state', async () => {
  const executionId = 'b0feef7e-7f90-4f9b-a2aa-4ce0247ea85e'
  const logicalArtifactIdentity = createCurrentLogicalArtifactIdentity('stage3-passive-ledger-series')
  const ledger = createForecastPreparationExecutionLedger()

  await ledger.recordEvent({
    executionId,
    logicalArtifactKey: buildCurrentStage3LogicalArtifactKey('stage3-passive-ledger-series'),
    operationFamily: 'CURRENT',
    logicalArtifactIdentity,
    requestId: 'stage3-passive-owner',
    ownerRequestId: 'stage3-passive-owner',
    role: 'OWNER',
    eventType: 'single_flight_owner_acquired',
    observedAt: '2026-09-07T12:10:00.000Z',
    attemptKind: 'PRIMARY',
    executionMode: 'PRE_STAGE3_PREPARATION',
    ownerToken: 'stage3-passive-owner-token',
    leaseVersion: 1,
    leaseAcquiredAt: '2026-09-07T12:10:00.000Z',
    leaseExpiresAt: '2026-09-07T12:15:00.000Z',
  })

  await ledger.recordEvent({
    executionId,
    logicalArtifactKey: buildCurrentStage3LogicalArtifactKey('stage3-passive-ledger-series'),
    operationFamily: 'CURRENT',
    logicalArtifactIdentity,
    requestId: 'stage3-passive-waiter',
    ownerRequestId: 'stage3-passive-owner',
    role: 'WAITER',
    eventType: 'single_flight_waiter_joined',
    observedAt: '2026-09-07T12:10:01.000Z',
    leaseVersion: 99,
    leaseAcquiredAt: '2026-09-07T12:10:01.000Z',
    leaseExpiresAt: '2026-09-07T13:10:00.000Z',
    recoveredFromExecutionId: 'spoofed-recovery',
  })

  const execution = await requirePrisma().forecastPreparationExecutionLedger.findUnique({
    where: { executionId },
  })

  assert.ok(execution)
  assert.equal(execution?.leaseVersion, 1)
  assert.equal(execution?.leaseAcquiredAt.toISOString(), '2026-09-07T12:10:00.000Z')
  assert.equal(execution?.leaseExpiresAt.toISOString(), '2026-09-07T12:15:00.000Z')
  assert.equal(execution?.recoveredFromExecutionId, null)
  assert.equal(execution?.waiterCount, 1)
  assert.equal(execution?.latestRole, 'WAITER')
})

serialTest('db-backed delayed telemetry cannot regress authoritative COMPLETED state', async () => {
  const logicalArtifactIdentity = createCurrentLogicalArtifactIdentity('stage3-telemetry-terminal-race-series')
  const logicalArtifactKey = buildCurrentStage3LogicalArtifactKey('stage3-telemetry-terminal-race-series')
  const admission = createDefaultForecastPreparationExecutionAdmission()
  const ledger = createForecastPreparationExecutionLedger()
  const owner = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'stage3-telemetry-terminal-owner',
    ownerRequestId: 'stage3-telemetry-terminal-owner',
    observedAt: '2026-09-07T12:20:00.000Z',
  })

  assert.equal(owner.role, 'OWNER')
  if (owner.role !== 'OWNER') {
    throw new Error('Expected primary owner acquisition.')
  }

  const telemetryReadBarrier = createBarrier()
  const telemetryResumeBarrier = createBarrier()
  let barrierArmed = true
  setForecastPreparationExecutionLedgerTestHooks({
    async beforePersistExistingExecutionEvent({ input }) {
      if (!barrierArmed || input.executionId !== owner.ownership.executionId) {
        return
      }

      barrierArmed = false
      telemetryReadBarrier.release()
      await telemetryResumeBarrier.promise
    },
  })

  const telemetryPromise = ledger.recordEvent({
    executionId: owner.ownership.executionId,
    logicalArtifactKey,
    operationFamily: 'CURRENT',
    logicalArtifactIdentity,
    requestId: 'stage3-telemetry-terminal-waiter',
    ownerRequestId: owner.ownership.ownerRequestId,
    role: 'WAITER',
    eventType: 'single_flight_waiter_joined',
    observedAt: '2026-09-07T12:20:01.000Z',
  })

  await telemetryReadBarrier.promise

  await admission.markExecutionCompleted({
    executionId: owner.ownership.executionId,
    logicalArtifactKey,
    ownerToken: owner.ownership.ownerToken,
    leaseVersion: owner.ownership.leaseVersion,
    requestId: 'stage3-telemetry-terminal-owner',
    ownerRequestId: owner.ownership.ownerRequestId,
    resultStatus: 'AVAILABLE',
    cacheStatus: 'miss',
    observedAt: '2026-09-07T12:20:02.000Z',
  })

  telemetryResumeBarrier.release()
  await telemetryPromise

  const execution = await requirePrisma().forecastPreparationExecutionLedger.findUnique({
    where: { executionId: owner.ownership.executionId },
  })

  assert.ok(execution)
  assert.equal(execution?.executionStatus, 'COMPLETED')
  assert.equal(execution?.completedAt?.toISOString(), '2026-09-07T12:20:02.000Z')
  assert.equal(execution?.resultStatus, 'AVAILABLE')
  assert.equal(execution?.cacheStatus, 'miss')
  assert.equal(execution?.waiterCount, 1)
})

serialTest('db-backed delayed telemetry cannot regress renewed lease state', async () => {
  const logicalArtifactIdentity = createCurrentLogicalArtifactIdentity('stage3-telemetry-lease-race-series')
  const logicalArtifactKey = buildCurrentStage3LogicalArtifactKey('stage3-telemetry-lease-race-series')
  const admission = createDefaultForecastPreparationExecutionAdmission()
  const ledger = createForecastPreparationExecutionLedger()
  const owner = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'stage3-telemetry-lease-owner',
    ownerRequestId: 'stage3-telemetry-lease-owner',
    observedAt: '2026-09-07T12:30:00.000Z',
  })

  assert.equal(owner.role, 'OWNER')
  if (owner.role !== 'OWNER') {
    throw new Error('Expected primary owner acquisition.')
  }

  const initialLeaseExpiresAt = owner.ownership.leaseExpiresAt
  const telemetryReadBarrier = createBarrier()
  const telemetryResumeBarrier = createBarrier()
  let barrierArmed = true
  setForecastPreparationExecutionLedgerTestHooks({
    async beforePersistExistingExecutionEvent({ input }) {
      if (!barrierArmed || input.executionId !== owner.ownership.executionId) {
        return
      }

      barrierArmed = false
      telemetryReadBarrier.release()
      await telemetryResumeBarrier.promise
    },
  })

  const telemetryPromise = ledger.recordEvent({
    executionId: owner.ownership.executionId,
    logicalArtifactKey,
    operationFamily: 'CURRENT',
    logicalArtifactIdentity,
    requestId: 'stage3-telemetry-lease-waiter',
    ownerRequestId: owner.ownership.ownerRequestId,
    role: 'WAITER',
    eventType: 'single_flight_waiter_joined',
    observedAt: '2026-09-07T12:30:01.000Z',
  })

  await telemetryReadBarrier.promise

  const renewed = await admission.renewLease({
    executionId: owner.ownership.executionId,
    logicalArtifactKey,
    ownerToken: owner.ownership.ownerToken,
    leaseVersion: owner.ownership.leaseVersion,
    requestId: 'stage3-telemetry-lease-owner',
    observedAt: '2026-09-07T12:30:30.000Z',
  })

  telemetryResumeBarrier.release()
  await telemetryPromise

  const execution = await requirePrisma().forecastPreparationExecutionLedger.findUnique({
    where: { executionId: owner.ownership.executionId },
  })

  assert.ok(execution)
  assert.equal(execution?.executionStatus, 'STARTED')
  assert.equal(execution?.leaseVersion, owner.ownership.leaseVersion)
  assert.notEqual(renewed.leaseExpiresAt, initialLeaseExpiresAt)
  assert.equal(execution?.leaseExpiresAt.toISOString(), renewed.leaseExpiresAt)
  assert.equal(execution?.latestRole, 'OWNER')
})

serialTest('db-backed delayed telemetry cannot regress authoritative FAILED state', async () => {
  const logicalArtifactIdentity = createCurrentLogicalArtifactIdentity('stage3-telemetry-failed-race-series')
  const logicalArtifactKey = buildCurrentStage3LogicalArtifactKey('stage3-telemetry-failed-race-series')
  const admission = createDefaultForecastPreparationExecutionAdmission()
  const ledger = createForecastPreparationExecutionLedger()
  const owner = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'stage3-telemetry-failed-owner',
    ownerRequestId: 'stage3-telemetry-failed-owner',
    observedAt: '2026-09-07T12:40:00.000Z',
  })

  assert.equal(owner.role, 'OWNER')
  if (owner.role !== 'OWNER') {
    throw new Error('Expected primary owner acquisition.')
  }

  const telemetryReadBarrier = createBarrier()
  const telemetryResumeBarrier = createBarrier()
  let barrierArmed = true
  setForecastPreparationExecutionLedgerTestHooks({
    async beforePersistExistingExecutionEvent({ input }) {
      if (!barrierArmed || input.executionId !== owner.ownership.executionId) {
        return
      }

      barrierArmed = false
      telemetryReadBarrier.release()
      await telemetryResumeBarrier.promise
    },
  })

  const telemetryPromise = ledger.recordEvent({
    executionId: owner.ownership.executionId,
    logicalArtifactKey,
    operationFamily: 'CURRENT',
    logicalArtifactIdentity,
    requestId: 'stage3-telemetry-failed-waiter',
    ownerRequestId: owner.ownership.ownerRequestId,
    role: 'WAITER',
    eventType: 'single_flight_waiter_joined',
    observedAt: '2026-09-07T12:40:01.000Z',
  })

  await telemetryReadBarrier.promise

  await admission.markExecutionFailed({
    executionId: owner.ownership.executionId,
    logicalArtifactKey,
    ownerToken: owner.ownership.ownerToken,
    leaseVersion: owner.ownership.leaseVersion,
    requestId: 'stage3-telemetry-failed-owner',
    ownerRequestId: owner.ownership.ownerRequestId,
    failurePhase: 'PERSISTENCE',
    failureReason: 'simulated-terminal-failure',
    resultStatus: 'FAILED',
    cacheStatus: 'miss',
    observedAt: '2026-09-07T12:40:02.000Z',
  })

  telemetryResumeBarrier.release()
  await telemetryPromise

  const execution = await requirePrisma().forecastPreparationExecutionLedger.findUnique({
    where: { executionId: owner.ownership.executionId },
  })

  assert.ok(execution)
  assert.equal(execution?.executionStatus, 'FAILED')
  assert.equal(execution?.failurePhase, 'PERSISTENCE')
  assert.equal(execution?.failureReason, 'simulated-terminal-failure')
  assert.equal(execution?.completedAt?.toISOString(), '2026-09-07T12:40:02.000Z')
  assert.equal(execution?.waiterCount, 1)
})

serialTest('db-backed stale predecessor telemetry cannot damage recovery truth', async () => {
  const logicalArtifactIdentity = createCurrentLogicalArtifactIdentity('stage3-telemetry-recovery-race-series')
  const logicalArtifactKey = buildCurrentStage3LogicalArtifactKey('stage3-telemetry-recovery-race-series')
  const admission = createDefaultForecastPreparationExecutionAdmission()
  const ledger = createForecastPreparationExecutionLedger()
  const owner = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'stage3-telemetry-recovery-owner-a',
    ownerRequestId: 'stage3-telemetry-recovery-owner-a',
    observedAt: '2026-09-07T12:50:00.000Z',
  })

  assert.equal(owner.role, 'OWNER')
  if (owner.role !== 'OWNER') {
    throw new Error('Expected primary owner acquisition.')
  }

  const telemetryReadBarrier = createBarrier()
  const telemetryResumeBarrier = createBarrier()
  let barrierArmed = true
  setForecastPreparationExecutionLedgerTestHooks({
    async beforePersistExistingExecutionEvent({ input }) {
      if (!barrierArmed || input.executionId !== owner.ownership.executionId) {
        return
      }

      barrierArmed = false
      telemetryReadBarrier.release()
      await telemetryResumeBarrier.promise
    },
  })

  const telemetryPromise = ledger.recordEvent({
    executionId: owner.ownership.executionId,
    logicalArtifactKey,
    operationFamily: 'CURRENT',
    logicalArtifactIdentity,
    requestId: 'stage3-telemetry-recovery-waiter-a',
    ownerRequestId: owner.ownership.ownerRequestId,
    role: 'WAITER',
    eventType: 'single_flight_waiter_joined',
    observedAt: '2026-09-07T12:50:30.000Z',
  })

  await telemetryReadBarrier.promise

  const recovery = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'stage3-telemetry-recovery-owner-b',
    ownerRequestId: 'stage3-telemetry-recovery-owner-b',
    observedAt: '2026-09-07T12:51:01.000Z',
  })

  assert.equal(recovery.role, 'RECOVERY_OWNER')
  if (recovery.role !== 'RECOVERY_OWNER') {
    throw new Error('Expected recovery owner acquisition.')
  }

  telemetryResumeBarrier.release()
  await telemetryPromise

  const executions = await requirePrisma().forecastPreparationExecutionLedger.findMany({
    where: { logicalArtifactKey },
    orderBy: { startedAt: 'asc' },
  })

  assert.equal(executions.length, 2)
  assert.equal(executions[0]?.executionId, owner.ownership.executionId)
  assert.equal(executions[0]?.executionStatus, 'FAILED')
  assert.equal(executions[1]?.executionId, recovery.ownership.executionId)
  assert.equal(executions[1]?.executionStatus, 'STARTED')
  assert.equal(executions[1]?.attemptKind, 'RECOVERY')
  assert.equal(executions[1]?.ownerToken, recovery.ownership.ownerToken)
  assert.equal(executions[1]?.leaseVersion, recovery.ownership.leaseVersion)
  assert.equal(executions[1]?.leaseExpiresAt.toISOString(), recovery.ownership.leaseExpiresAt)
  assert.equal(executions[1]?.recoveredFromExecutionId, owner.ownership.executionId)
})

serialTest('db-backed waiter cancellation exits promptly without starting compute or cancelling the owner', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-waiter-cancel-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const ownerPromise = runSuccessfulWorker({
      STAGE3_MODE: 'current',
      STAGE3_SERIES_ID: 'stage3-waiter-cancel-series',
      STAGE3_MODEL_ID: 'ets',
      STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
      STAGE3_COMPUTE_LOG_PATH: computeLogPath,
      STAGE3_COMPUTE_DELAY_MS: '2000',
    })

    await waitForExecution(buildCurrentStage3LogicalArtifactKey('stage3-waiter-cancel-series'))

    let waiterComputeCount = 0
    const service = createDbBackedService({
      async exportCurrent() {
        waiterComputeCount += 1
        return createCurrentResponse('stage3-waiter-cancel-series', 'ets')
      },
    })
    const controller = new AbortController()
    const waiterPromise = service.resolveCurrentForecastRequest({
      seriesId: 'stage3-waiter-cancel-series',
      modelId: 'ets',
      targetBasis: 'MONTHLY_AVERAGE',
      signal: controller.signal,
    })

    await delay(150)
    controller.abort()

    await assert.rejects(
      waiterPromise,
      (error: unknown) => error instanceof Error && error.name === 'AbortError',
    )

    const ownerResult = await ownerPromise
    assert.equal(ownerResult.status, 'AVAILABLE')
    assert.equal(await readComputeCount(computeLogPath), 1)
    assert.equal(waiterComputeCount, 0)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed completed-without-artifact remains fail-closed for waiters', async () => {
  const logicalArtifactIdentity = createCurrentLogicalArtifactIdentity('stage3-completed-without-artifact-series')
  const logicalArtifactKey = buildCurrentStage3LogicalArtifactKey('stage3-completed-without-artifact-series')
  const admission = createDefaultForecastPreparationExecutionAdmission()
  const observedAt = new Date().toISOString()
  const owner = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'stage3-completed-without-artifact-owner',
    ownerRequestId: 'stage3-completed-without-artifact-owner',
    observedAt,
  })

  assert.equal(owner.role, 'OWNER')
  if (owner.role !== 'OWNER') {
    throw new Error('Expected primary owner acquisition.')
  }

  let waiterComputeCount = 0
  const service = createDbBackedService({
    async exportCurrent() {
      waiterComputeCount += 1
      return createCurrentResponse('stage3-completed-without-artifact-series', 'ets')
    },
  })

  const waiterPromise = service.resolveCurrentForecastRequest({
    seriesId: 'stage3-completed-without-artifact-series',
    modelId: 'ets',
    targetBasis: 'MONTHLY_AVERAGE',
  })

  await delay(100)
  await admission.markExecutionCompleted({
    executionId: owner.ownership.executionId,
    logicalArtifactKey,
    ownerToken: owner.ownership.ownerToken,
    leaseVersion: owner.ownership.leaseVersion,
    requestId: 'stage3-completed-without-artifact-owner',
    ownerRequestId: owner.ownership.ownerRequestId,
    resultStatus: 'AVAILABLE',
    cacheStatus: 'miss',
    observedAt: new Date(Date.now() + 100).toISOString(),
  })

  await assert.rejects(waiterPromise, /completed without a canonical artifact/i)
  assert.equal(waiterComputeCount, 0)
})

serialTest('db-backed current compute failure produces a FAILED execution with no artifact and no parallel waiter compute', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-current-failed-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const [first, second] = await Promise.all([
      runSuccessfulWorker({
        STAGE3_MODE: 'current',
        STAGE3_RESULT_MODE: 'FAILED',
        STAGE3_SERIES_ID: 'stage3-current-failed-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '250',
      }),
      runSuccessfulWorker({
        STAGE3_MODE: 'current',
        STAGE3_RESULT_MODE: 'FAILED',
        STAGE3_SERIES_ID: 'stage3-current-failed-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '250',
      }),
    ])

    assert.deepEqual([first.status, second.status], ['FAILED', 'FAILED'])
    assert.equal(await readComputeCount(computeLogPath), 1)

    const runs = await requirePrisma().forecastCurrentRun.findMany({ where: { seriesId: 'stage3-current-failed-series' } })
    assert.equal(runs.length, 0)

    const execution = await requirePrisma().forecastPreparationExecutionLedger.findFirst({
      where: { seriesId: 'stage3-current-failed-series' },
    })
    assert.ok(execution)
    assert.equal(execution?.executionStatus, 'FAILED')
    assert.equal(execution?.resultStatus, 'FAILED')
    assert.equal(execution?.failurePhase, 'COMPUTE')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed verification compute failure produces a FAILED execution with no artifact and no parallel waiter compute', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-verification-failed-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const [first, second] = await Promise.all([
      runSuccessfulWorker({
        STAGE3_MODE: 'verification',
        STAGE3_RESULT_MODE: 'FAILED',
        STAGE3_SERIES_ID: 'stage3-verification-failed-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '250',
      }),
      runSuccessfulWorker({
        STAGE3_MODE: 'verification',
        STAGE3_RESULT_MODE: 'FAILED',
        STAGE3_SERIES_ID: 'stage3-verification-failed-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '250',
      }),
    ])

    assert.deepEqual([first.status, second.status], ['FAILED', 'FAILED'])
    assert.equal(await readComputeCount(computeLogPath), 1)

    const runs = await requirePrisma().forecastVerificationRun.findMany({ where: { seriesId: 'stage3-verification-failed-series' } })
    assert.equal(runs.length, 0)

    const execution = await requirePrisma().forecastPreparationExecutionLedger.findFirst({
      where: { seriesId: 'stage3-verification-failed-series' },
    })
    assert.ok(execution)
    assert.equal(execution?.executionStatus, 'FAILED')
    assert.equal(execution?.resultStatus, 'FAILED')
    assert.equal(execution?.failurePhase, 'COMPUTE')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed control DB failure stays fail-closed and performs zero compute', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-db-failure-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const result = await runWorker({
      STAGE3_MODE: 'current',
      STAGE3_SERIES_ID: 'stage3-db-failure-series',
      STAGE3_MODEL_ID: 'ets',
      STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
      STAGE3_COMPUTE_LOG_PATH: computeLogPath,
      MARKET_DATA_DATABASE_URL: 'postgresql://phase21@127.0.0.1:1/sg_phase_2_1_market_data',
    })

    assert.notEqual(result.exitCode, 0)
    assert.match(result.stderr, /CONTROL_DB_UNAVAILABLE|datastore is unavailable|Can't reach database server/i)
    assert.equal(await readComputeCount(computeLogPath), 0)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

serialTest('db-backed fenced persistence blocks concurrent recovery until the owner transaction leaves the row-lock boundary', async () => {
  const previousLease = process.env.FORECAST_STAGE3_LEASE_DURATION_MS
  process.env.FORECAST_STAGE3_LEASE_DURATION_MS = '1000'

  let releaseFence: (() => void) | undefined
  const fenceRelease = new Promise<void>((resolve) => {
    releaseFence = resolve
  })
  let signalFenceEntered: (() => void) | undefined
  const fenceEntered = new Promise<void>((resolve) => {
    signalFenceEntered = resolve
  })

  try {
    const logicalArtifactIdentity = createCurrentLogicalArtifactIdentity('stage3-fence-race-series')
    const logicalArtifactKey = buildCurrentStage3LogicalArtifactKey('stage3-fence-race-series')
    const admission = createDefaultForecastPreparationExecutionAdmission()
    const owner = await admission.acquireExecution({
      operationFamily: 'CURRENT',
      logicalArtifactKey,
      logicalArtifactIdentity,
      requestId: 'stage3-fence-owner',
      ownerRequestId: 'stage3-fence-owner',
      observedAt: new Date().toISOString(),
    })

    assert.equal(owner.role, 'OWNER')
    if (owner.role !== 'OWNER') {
      throw new Error('Expected primary owner acquisition.')
    }

    setForecastPersistenceTestHooks({
      afterOwnerFenceAcquired: async () => {
        signalFenceEntered?.()
        await fenceRelease
      },
    })

    const writePromise = writeCurrentRunWithPrisma(
      createCurrentArtifact('stage3-fence-race-series', 'ets'),
      { ownership: createOwnedPersistence(logicalArtifactKey, owner.ownership) },
    )

    await fenceEntered
    await delay(1_200)

    let contenderResolved = false
    const contenderPromise = createDefaultForecastPreparationExecutionAdmission().acquireExecution({
      operationFamily: 'CURRENT',
      logicalArtifactKey,
      logicalArtifactIdentity,
      requestId: 'stage3-fence-contender',
      ownerRequestId: 'stage3-fence-contender',
      observedAt: new Date().toISOString(),
    }).then((result) => {
      contenderResolved = true
      return result
    })

    await delay(100)
    assert.equal(contenderResolved, false)

    releaseFence?.()
    await writePromise

    const recovery = await contenderPromise
    assert.equal(recovery.role, 'RECOVERY_OWNER')
    const runs = await requirePrisma().forecastCurrentRun.findMany({ where: { seriesId: 'stage3-fence-race-series' } })
    assert.equal(runs.length, 1)
  } finally {
    setForecastPersistenceTestHooks(null)
    if (previousLease === undefined) {
      delete process.env.FORECAST_STAGE3_LEASE_DURATION_MS
    } else {
      process.env.FORECAST_STAGE3_LEASE_DURATION_MS = previousLease
    }
  }
})
