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
  createCurrentForecastStatisticalCompatibility,
  LEGACY_MONTHLY_ARTIFACT_FREQUENCY,
} from '../lib/forecast/identity'
import { buildForecastHistoryFingerprint } from '../lib/forecast/history-fingerprint'
import { buildCurrentHorizonConfigurationId } from '../lib/forecast/live-market-input'
import { PrismaClient } from '../generated/market-data-client'
import type { ForecastPreparationOwnedExecutionContext } from '../lib/forecast/execution-ledger'
import type {
  ForecastBridge,
  ForecastPersistenceOwnership,
  PersistedCurrentArtifact,
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
let createForecastLibraryService: typeof import('../lib/forecast/service')['createForecastLibraryService']
let setForecastPersistenceTestHooks: typeof import('../lib/forecast/service')['setForecastPersistenceTestHooks']
let writeCurrentRunWithPrisma: typeof import('../lib/forecast/service')['writeCurrentRunWithPrisma']

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

function createDbBackedService(bridgeOverrides: Partial<ForecastBridge> = {}) {
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

  return createForecastLibraryService({
    bridge,
    logEvent: () => {},
    telemetry: {
      emit() {},
    },
  })
}

const serialTest = (name: string, fn: (context: TestContext) => Promise<void> | void) =>
  test(name, { concurrency: false }, fn)

test.before(async () => {
  const executionLedgerModule = await import('../lib/forecast/execution-ledger')
  const serviceModule = await import('../lib/forecast/service')

  createDefaultForecastPreparationExecutionAdmission = executionLedgerModule.createDefaultForecastPreparationExecutionAdmission
  createForecastPreparationExecutionLedger = executionLedgerModule.createForecastPreparationExecutionLedger
  createForecastLibraryService = serviceModule.createForecastLibraryService
  setForecastPersistenceTestHooks = serviceModule.setForecastPersistenceTestHooks
  writeCurrentRunWithPrisma = serviceModule.writeCurrentRunWithPrisma
})

test.beforeEach(async () => {
  await resetForecastTables()
  setForecastPersistenceTestHooks(null)
})

test.after(async () => {
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
