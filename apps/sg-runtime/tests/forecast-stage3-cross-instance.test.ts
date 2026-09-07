process.env.MARKET_DATA_DATABASE_URL = process.env.MARKET_DATA_DATABASE_URL ?? 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data'

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { createForecastCadence } from '../lib/forecast/cadence'
import { type CurrentLogicalArtifactIdentity } from '../lib/forecast/current-single-flight'
import {
  createCurrentForecastStatisticalCompatibility,
} from '../lib/forecast/identity'
import {
  createDefaultForecastPreparationExecutionAdmission,
  type ForecastPreparationOwnedExecutionContext,
} from '../lib/forecast/execution-ledger'
import { getMarketDataPrisma } from '../lib/market-data/client'
import {
  type ForecastPersistenceOwnership,
  type PersistedCurrentArtifact,
  writeCurrentRunWithPrisma,
} from '../lib/forecast/service'

const prisma = getMarketDataPrisma()

if (!prisma) {
  throw new Error('Stage 3 cross-instance tests require MARKET_DATA_DATABASE_URL to target the isolated PostgreSQL authority.')
}

const marketDataPrisma = prisma

function requirePrisma() {
  return marketDataPrisma
}

const workerPath = fileURLToPath(new URL('./helpers/forecast-stage3-instance-worker.ts', import.meta.url))
const appRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))

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

function runWorker(env: Record<string, string>) {
  return new Promise<{ status: string; cacheStatus?: string }>((resolve, reject) => {
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
      if (code !== 0) {
        reject(new Error(stderr || `Worker exited with code ${code}.`))
        return
      }

      try {
        resolve(JSON.parse(stdout.trim()) as { status: string; cacheStatus?: string })
      } catch (error) {
        reject(error)
      }
    })
  })
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

function createCurrentArtifact(seriesId: string, modelId: string): PersistedCurrentArtifact {
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
    historyFingerprint: 'stage3-history-fingerprint',
    cadence: createForecastCadence('MONTHLY', 'MONTHLY'),
    frequencyIdentity: 'MONTHLY:MONTHLY',
    statisticalCompatibility: createCurrentForecastStatisticalCompatibility({
      sourceFrequency: 'MONTHLY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'MONTHLY_AVERAGE',
    }),
    history: {
      frequency: 'MONTHLY',
      start: '2021-01-01T00:00:00.000Z',
      end: '2026-04-01T00:00:00.000Z',
      observations: 64,
    },
    forecastOrigin: '2026-04-01T00:00:00.000Z',
    runtimeSeconds: 0.084,
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-05-01T00:00:00.000Z',
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
    },
  }
}

test.beforeEach(async () => {
  await resetForecastTables()
})

test.after(async () => {
  await requirePrisma().$disconnect()
})

test('db-backed current requests converge to one owner, one compute, and one persisted artifact', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-current-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const [first, second] = await Promise.all([
      runWorker({
        STAGE3_MODE: 'current',
        STAGE3_SERIES_ID: 'stage3-current-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '200',
      }),
      runWorker({
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

    const computeLines = (await readFile(computeLogPath, 'utf8'))
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    assert.equal(computeLines.length, 1)

    const runs = await requirePrisma().forecastCurrentRun.findMany({ where: { seriesId: 'stage3-current-series' } })
    assert.equal(runs.length, 1)
    const currentRun = runs[0]
    assert.ok(currentRun)

    const points = await requirePrisma().forecastCurrentPoint.findMany({ where: { runId: currentRun.id } })
    assert.equal(points.length, 2)

    const executions = await requirePrisma().forecastPreparationExecutionLedger.findMany({
      where: {
        seriesId: 'stage3-current-series',
        operationFamily: 'CURRENT',
      },
      orderBy: { startedAt: 'asc' },
    })
    assert.equal(executions.length, 1)
    const currentExecution = executions[0]
    assert.ok(currentExecution)
    assert.equal(currentExecution.executionStatus, 'COMPLETED')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('db-backed verification requests converge to one owner, one compute, and one persisted artifact', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sg-stage3-verification-'))
  const computeLogPath = path.join(tempDir, 'compute.log')
  await writeFile(computeLogPath, '')

  try {
    const [first, second] = await Promise.all([
      runWorker({
        STAGE3_MODE: 'verification',
        STAGE3_SERIES_ID: 'stage3-verification-series',
        STAGE3_MODEL_ID: 'ets',
        STAGE3_TARGET_BASIS: 'MONTHLY_AVERAGE',
        STAGE3_COMPUTE_LOG_PATH: computeLogPath,
        STAGE3_COMPUTE_DELAY_MS: '200',
      }),
      runWorker({
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

    const computeLines = (await readFile(computeLogPath, 'utf8'))
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    assert.equal(computeLines.length, 1)

    const runs = await requirePrisma().forecastVerificationRun.findMany({ where: { seriesId: 'stage3-verification-series' } })
    assert.equal(runs.length, 1)
    const verificationRun = runs[0]
    assert.ok(verificationRun)

    const metrics = await requirePrisma().forecastVerificationMetric.findMany({ where: { runId: verificationRun.id } })
    const points = await requirePrisma().forecastVerificationPoint.findMany({ where: { runId: verificationRun.id } })
    assert.equal(metrics.length, 1)
    assert.equal(points.length, 1)

    const executions = await requirePrisma().forecastPreparationExecutionLedger.findMany({
      where: {
        seriesId: 'stage3-verification-series',
        operationFamily: 'VERIFICATION',
      },
      orderBy: { startedAt: 'asc' },
    })
    assert.equal(executions.length, 1)
    const verificationExecution = executions[0]
    assert.ok(verificationExecution)
    assert.equal(verificationExecution.executionStatus, 'COMPLETED')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('db-backed recovery fences stale current owners out of persistence after takeover', async () => {
  const admission = createDefaultForecastPreparationExecutionAdmission()
  const logicalArtifactIdentity: CurrentLogicalArtifactIdentity = {
    artifactScope: 'CURRENT_FORECAST',
    seriesId: 'stage3-fencing-series',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: 'benchmark-forecasting-mvp-phase2-v1',
    trainingWindowPolicyId: 'CURRENT_TRAINING_WINDOW',
    modelId: 'ets',
    inputSource: 'POSTGRES_RUNTIME_SNAPSHOT',
    historyFingerprint: 'stage3-history-fingerprint',
    sourceFrequency: 'MONTHLY',
    targetCadence: 'MONTHLY',
    frequencyIdentity: 'MONTHLY:MONTHLY',
    forecastOrigin: '2026-04-01T00:00:00.000Z',
    horizonConfigurationId: 'current-monthly-standard',
  }
  const logicalArtifactKey = 'stage3:fencing:current'

  const owner = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'req-owner-stage3',
    ownerRequestId: 'req-owner-stage3',
    observedAt: '2026-09-07T10:00:00.000Z',
  })
  assert.equal(owner.role, 'OWNER')
  if (owner.role !== 'OWNER') {
    throw new Error('Expected the first Stage 3 admission to become OWNER.')
  }

  const recovery = await admission.acquireExecution({
    operationFamily: 'CURRENT',
    logicalArtifactKey,
    logicalArtifactIdentity,
    requestId: 'req-recovery-stage3',
    ownerRequestId: 'req-recovery-stage3',
    observedAt: '2026-09-07T10:01:01.000Z',
  })
  assert.equal(recovery.role, 'RECOVERY_OWNER')
  if (recovery.role !== 'RECOVERY_OWNER') {
    throw new Error('Expected the expired Stage 3 admission to recover as RECOVERY_OWNER.')
  }

  await assert.rejects(
    () => writeCurrentRunWithPrisma(
      createCurrentArtifact('stage3-fencing-series', 'ets'),
      { ownership: createOwnedPersistence(logicalArtifactKey, owner.ownership) },
    ),
    (error: unknown) => error instanceof Error
      && error.name === 'ForecastExecutionControlError'
      && 'code' in error
      && error.code === 'STALE_OWNER',
  )

  await writeCurrentRunWithPrisma(
    createCurrentArtifact('stage3-fencing-series', 'ets'),
    { ownership: createOwnedPersistence(logicalArtifactKey, recovery.ownership) },
  )

  const runs = await requirePrisma().forecastCurrentRun.findMany({ where: { seriesId: 'stage3-fencing-series' } })
  assert.equal(runs.length, 1)
})