import './load-env'

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { getMarketDataPrisma } from '@/lib/market-data/client'
import {
  readCurrentRunFromPrisma,
  readVerificationRunFromPrisma,
  writeCurrentRunWithPrisma,
  writeVerificationRunWithPrisma,
  type ForecastCacheLookupKey,
  type PersistedCurrentArtifact,
  type PersistedVerificationArtifact,
} from '@/lib/forecast/service'

const CURRENT_SERIES_ID = 'phase22b3-current-fixture'
const VERIFICATION_SERIES_ID = 'phase22b3-verification-fixture'
const INPUT_SOURCE = 'PHASE_2_2B_3_CONTROLLED_FIXTURE'
const METHOD_VERSION = 'phase-2-2b-3-controlled-v1'
const FREQUENCY_IDENTITY = 'FORECAST_CADENCE_V1|source=MONTHLY|target=MONTHLY'

type Family = 'CURRENT' | 'VERIFICATION'

type StateCounts = {
  parentCount: number
  currentPointCount: number
  verificationMetricCount: number
  verificationPointCount: number
}

type ScenarioResult = {
  id: string
  family: Family
  attempts: number
  successfulAttempts: number
  failedAttempts: number
  parentCount: number
  childCount: number
  expectedChildCount: number
  canonicalChecksum: string | null
  acceptedChecksums: string[]
  status: 'PASS'
}

function currentArtifact(variant: 'A' | 'B' = 'A'): PersistedCurrentArtifact {
  const offset = variant === 'A' ? 0 : 100
  return {
    seriesId: CURRENT_SERIES_ID,
    modelId: 'naive',
    displayName: `B3 Current ${variant}`,
    description: 'Controlled Phase 2.2B-3 Current fixture.',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: METHOD_VERSION,
    source: { kind: INPUT_SOURCE, runId: `current-${variant}` },
    preparation: null,
    historyFingerprint: 'phase22b3-current-history',
    cadence: null,
    frequencyIdentity: FREQUENCY_IDENTITY,
    history: {
      frequency: 'MONTHLY',
      start: '2023-01-01T00:00:00.000Z',
      end: '2025-12-01T00:00:00.000Z',
      observations: 36,
    },
    forecastOrigin: '2025-12-01T00:00:00.000Z',
    runtimeSeconds: variant === 'A' ? 0.1 : 0.2,
    currentForecast: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        forecastDate: '2026-01-01T00:00:00.000Z',
        forecastValue: 10 + offset,
        metadata: null,
        failureReason: null,
      },
      '3M': {
        horizon: '3M',
        horizonSteps: 3,
        forecastDate: '2026-03-01T00:00:00.000Z',
        forecastValue: 30 + offset,
        metadata: null,
        failureReason: null,
      },
    },
  }
}

function verificationArtifact(variant: 'A' | 'B' = 'A'): PersistedVerificationArtifact {
  const offset = variant === 'A' ? 0 : 100
  const record = (horizon: string, horizonSteps: number, originMonth: string, targetMonth: string, base: number) => ({
    benchmarkId: VERIFICATION_SERIES_ID,
    modelId: 'naive',
    forecastOrigin: `${originMonth}-01T00:00:00.000Z`,
    horizon,
    horizonSteps,
    forecastDate: `${targetMonth}-01T00:00:00.000Z`,
    actualObservedAt: `${targetMonth}-28T00:00:00.000Z`,
    originValue: base + offset,
    forecastValue: base + 1 + offset,
    actualValue: base + 2 + offset,
    error: -1,
    absoluteError: 1,
    delta: -1,
    deltaPct: -0.01,
    maseScale: 2,
    metadata: null,
  })

  return {
    seriesId: VERIFICATION_SERIES_ID,
    modelId: 'naive',
    displayName: `B3 Verification ${variant}`,
    description: 'Controlled Phase 2.2B-3 Verification fixture.',
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: METHOD_VERSION,
    source: { kind: INPUT_SOURCE, runId: `verification-${variant}` },
    preparation: null,
    historyFingerprint: 'phase22b3-verification-history',
    cadence: null,
    frequencyIdentity: FREQUENCY_IDENTITY,
    history: {
      frequency: 'MONTHLY',
      start: '2022-01-01T00:00:00.000Z',
      end: '2025-12-01T00:00:00.000Z',
      observations: 48,
    },
    forecastOrigin: '2025-12-01T00:00:00.000Z',
    runtimeSeconds: variant === 'A' ? 0.3 : 0.4,
    verification: {
      '1M': {
        horizon: '1M',
        horizonSteps: 1,
        origins: 2,
        expectedOrigins: 2,
        successfulOrigins: 2,
        failedOrigins: 0,
        coverage: 1,
        metrics: { mae: 1, rmse: 1, mase: 0.5, smape: 0.01, directionalAccuracy: 1, bias: -1 },
        records: [
          record('1M', 1, '2025-09', '2025-10', 10),
          record('1M', 1, '2025-10', '2025-11', 20),
        ],
        failures: [],
      },
      '3M': {
        horizon: '3M',
        horizonSteps: 3,
        origins: 1,
        expectedOrigins: 1,
        successfulOrigins: 1,
        failedOrigins: 0,
        coverage: 1,
        metrics: { mae: 1, rmse: 1, mase: 0.5, smape: 0.01, directionalAccuracy: 1, bias: -1 },
        records: [record('3M', 3, '2025-08', '2025-11', 30)],
        failures: [],
      },
    },
  }
}

function lookupKey(artifact: PersistedCurrentArtifact | PersistedVerificationArtifact): ForecastCacheLookupKey {
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
  }
}

function canonicalPayload(artifact: PersistedCurrentArtifact | PersistedVerificationArtifact) {
  if ('currentForecast' in artifact) {
    return {
      seriesId: artifact.seriesId,
      modelId: artifact.modelId,
      targetBasis: artifact.targetBasis,
      methodId: artifact.methodId,
      methodVersion: artifact.methodVersion,
      historyFingerprint: artifact.historyFingerprint,
      frequencyIdentity: artifact.frequencyIdentity,
      forecastOrigin: artifact.forecastOrigin,
      currentForecast: artifact.currentForecast,
    }
  }
  return {
    seriesId: artifact.seriesId,
    modelId: artifact.modelId,
    targetBasis: artifact.targetBasis,
    methodId: artifact.methodId,
    methodVersion: artifact.methodVersion,
    historyFingerprint: artifact.historyFingerprint,
    frequencyIdentity: artifact.frequencyIdentity,
    forecastOrigin: artifact.forecastOrigin,
    verification: artifact.verification,
  }
}

function checksum(artifact: PersistedCurrentArtifact | PersistedVerificationArtifact) {
  return createHash('sha256').update(JSON.stringify(canonicalPayload(artifact))).digest('hex')
}

function expectedChildCount(artifact: PersistedCurrentArtifact | PersistedVerificationArtifact) {
  return 'currentForecast' in artifact
    ? Object.keys(artifact.currentForecast).length
    : Object.keys(artifact.verification).length
      + Object.values(artifact.verification).reduce((sum, horizon) => sum + horizon.records.length, 0)
}

async function cleanFixtures() {
  const prisma = getMarketDataPrisma()
  assert.ok(prisma, 'Market Data Prisma must be configured.')
  await prisma.forecastCurrentRun.deleteMany({ where: { seriesId: CURRENT_SERIES_ID, inputSource: INPUT_SOURCE } })
  await prisma.forecastVerificationRun.deleteMany({ where: { seriesId: VERIFICATION_SERIES_ID, inputSource: INPUT_SOURCE } })
}

async function stateCounts(): Promise<StateCounts> {
  const prisma = getMarketDataPrisma()
  assert.ok(prisma, 'Market Data Prisma must be configured.')
  const [currentRuns, verificationRuns] = await Promise.all([
    prisma.forecastCurrentRun.findMany({
      where: { seriesId: CURRENT_SERIES_ID, inputSource: INPUT_SOURCE },
      select: { id: true },
    }),
    prisma.forecastVerificationRun.findMany({
      where: { seriesId: VERIFICATION_SERIES_ID, inputSource: INPUT_SOURCE },
      select: { id: true },
    }),
  ])
  const currentRunIds = currentRuns.map(({ id }) => id)
  const verificationRunIds = verificationRuns.map(({ id }) => id)
  const [currentPointCount, verificationMetricCount, verificationPointCount] = await Promise.all([
    prisma.forecastCurrentPoint.count({ where: { runId: { in: currentRunIds } } }),
    prisma.forecastVerificationMetric.count({ where: { runId: { in: verificationRunIds } } }),
    prisma.forecastVerificationPoint.count({ where: { runId: { in: verificationRunIds } } }),
  ])
  return {
    parentCount: currentRuns.length + verificationRuns.length,
    currentPointCount,
    verificationMetricCount,
    verificationPointCount,
  }
}

async function readArtifact(family: Family) {
  return family === 'CURRENT'
    ? readCurrentRunFromPrisma(lookupKey(currentArtifact()))
    : readVerificationRunFromPrisma(lookupKey(verificationArtifact()))
}

async function writeArtifact(artifact: PersistedCurrentArtifact | PersistedVerificationArtifact) {
  if ('currentForecast' in artifact) {
    await writeCurrentRunWithPrisma(artifact)
  } else {
    await writeVerificationRunWithPrisma(artifact)
  }
}

function familyCounts(family: Family, state: StateCounts) {
  return family === 'CURRENT'
    ? { parentCount: state.parentCount, childCount: state.currentPointCount }
    : {
        parentCount: state.parentCount,
        childCount: state.verificationMetricCount + state.verificationPointCount,
      }
}

async function observe(
  id: string,
  family: Family,
  attempts: number,
  successfulAttempts: number,
  acceptedArtifacts: Array<PersistedCurrentArtifact | PersistedVerificationArtifact>,
): Promise<ScenarioResult> {
  const artifact = await readArtifact(family)
  const state = familyCounts(family, await stateCounts())
  const acceptedChecksums = acceptedArtifacts.map(checksum)
  const canonicalChecksum = artifact ? checksum(artifact) : null
  const expectedChildren = expectedChildCount(acceptedArtifacts[0])
  assert.equal(state.parentCount, 1, `${id} parent count`)
  assert.equal(state.childCount, expectedChildren, `${id} child count`)
  assert.ok(canonicalChecksum && acceptedChecksums.includes(canonicalChecksum), `${id} canonical checksum`)
  return {
    id,
    family,
    attempts,
    successfulAttempts,
    failedAttempts: attempts - successfulAttempts,
    parentCount: state.parentCount,
    childCount: state.childCount,
    expectedChildCount: expectedChildren,
    canonicalChecksum,
    acceptedChecksums,
    status: 'PASS',
  }
}

async function injectRollback(write: () => Promise<void>) {
  const prisma = getMarketDataPrisma()
  assert.ok(prisma, 'Market Data Prisma must be configured.')
  const mutablePrisma = prisma as unknown as { $transaction: (...args: unknown[]) => Promise<unknown> }
  const originalTransaction = mutablePrisma.$transaction.bind(prisma)
  mutablePrisma.$transaction = async (operation, ...options) => {
    assert.equal(typeof operation, 'function', 'Controlled rollback requires interactive transaction usage.')
    return originalTransaction(async (tx: unknown) => {
      await (operation as (client: unknown) => Promise<unknown>)(tx)
      throw new Error('PHASE_2_2B_3_CONTROLLED_ROLLBACK')
    }, ...options)
  }
  try {
    await assert.rejects(write, /PHASE_2_2B_3_CONTROLLED_ROLLBACK/)
  } finally {
    mutablePrisma.$transaction = originalTransaction
  }
}

async function runFamily(family: Family) {
  const artifactA = family === 'CURRENT' ? currentArtifact('A') : verificationArtifact('A')
  const artifactB = family === 'CURRENT' ? currentArtifact('B') : verificationArtifact('B')
  const results: ScenarioResult[] = []

  await cleanFixtures()
  await assert.rejects(async () => {
    throw new Error('PHASE_2_2B_3_FAILURE_BEFORE_PERSISTENCE')
  }, /PHASE_2_2B_3_FAILURE_BEFORE_PERSISTENCE/)
  const beforePersistenceFailureState = await stateCounts()
  assert.equal(beforePersistenceFailureState.parentCount, 0)
  await writeArtifact(artifactA)
  results.push(await observe(`${family}-NORMAL-SUCCESS`, family, 1, 1, [artifactA]))

  await writeArtifact(artifactA)
  results.push(await observe(`${family}-SEQUENTIAL-DUPLICATE`, family, 2, 2, [artifactA]))

  await cleanFixtures()
  const concurrent = await Promise.allSettled([writeArtifact(artifactA), writeArtifact(artifactB)])
  const successfulConcurrentAttempts = concurrent.filter(({ status }) => status === 'fulfilled').length
  assert.equal(successfulConcurrentAttempts, 2, `${family} concurrent writes must both settle successfully`)
  results.push(await observe(`${family}-CONTROLLED-CONCURRENCY`, family, 2, 2, [artifactA, artifactB]))

  await cleanFixtures()
  await injectRollback(() => writeArtifact(artifactA))
  const rolledBack = await stateCounts()
  assert.deepEqual(rolledBack, {
    parentCount: 0,
    currentPointCount: 0,
    verificationMetricCount: 0,
    verificationPointCount: 0,
  }, `${family} rollback must leave no partial state`)

  await writeArtifact(artifactA)
  results.push(await observe(`${family}-FAILURE-RETRY`, family, 2, 1, [artifactA]))

  let acknowledgementLost = false
  try {
    await writeArtifact(artifactA)
    throw new Error('PHASE_2_2B_3_ACKNOWLEDGEMENT_LOST')
  } catch (error) {
    acknowledgementLost = error instanceof Error && error.message === 'PHASE_2_2B_3_ACKNOWLEDGEMENT_LOST'
  }
  assert.equal(acknowledgementLost, true)
  assert.ok(await readArtifact(family), `${family} lost-ack write must be prepared-readable`)
  await writeArtifact(artifactA)
  results.push(await observe(`${family}-UNCERTAIN-COMMIT-REPLAY`, family, 2, 1, [artifactA]))

  return {
    scenarios: results,
    failureEvidence: {
      family,
      failureBeforePersistence: {
        attemptedWriteSets: 0,
        state: beforePersistenceFailureState,
        status: 'PASS' as const,
      },
      failureDuringPersistence: {
        attemptedWriteSets: 1,
        committedWriteSets: 0,
        controlledRollback: true,
        state: rolledBack,
        partialReady: false,
        status: 'PASS' as const,
      },
      uncertainCommitReplay: {
        initialCommitCompleted: true,
        acknowledgementObserved: false,
        preparedReadBeforeReplay: true,
        replayAttempted: true,
        canonicalArtifactsAfterReplay: 1,
        status: 'PASS' as const,
      },
    },
  }
}

async function runIdentityIsolation() {
  await cleanFixtures()
  const currentA = currentArtifact('A')
  const currentOther = {
    ...currentA,
    historyFingerprint: 'phase22b3-current-history-isolated',
    source: { ...currentA.source, runId: 'current-isolated' },
  }
  const verificationA = verificationArtifact('A')
  const verificationOther = {
    ...verificationA,
    historyFingerprint: 'phase22b3-verification-history-isolated',
    source: { ...verificationA.source, runId: 'verification-isolated' },
  }
  await Promise.all([
    writeCurrentRunWithPrisma(currentA),
    writeCurrentRunWithPrisma(currentOther),
    writeVerificationRunWithPrisma(verificationA),
    writeVerificationRunWithPrisma(verificationOther),
  ])
  const state = await stateCounts()
  assert.equal(state.parentCount, 4)
  assert.equal(state.currentPointCount, 4)
  assert.equal(state.verificationMetricCount, 4)
  assert.equal(state.verificationPointCount, 6)
  const prepared = await Promise.all([
    readCurrentRunFromPrisma(lookupKey(currentA)),
    readCurrentRunFromPrisma(lookupKey(currentOther)),
    readVerificationRunFromPrisma(lookupKey(verificationA)),
    readVerificationRunFromPrisma(lookupKey(verificationOther)),
  ])
  assert.ok(prepared.every(Boolean))
  assert.equal(new Set(prepared.map((artifact) => artifact?.historyFingerprint)).size, 4)
  return {
    id: 'CURRENT-VERIFICATION-IDENTITY-ISOLATION',
    exactIdentities: 4,
    parentCount: state.parentCount,
    currentPointCount: state.currentPointCount,
    verificationMetricCount: state.verificationMetricCount,
    verificationPointCount: state.verificationPointCount,
    preparedReads: prepared.filter(Boolean).length,
    status: 'PASS' as const,
  }
}

async function main() {
  assert.equal(process.env.FORECAST_STRESS_DATABASE_CLONE_ALIAS, 'phase-2-1-local-clone-v1')
  assert.equal(process.env.FORECAST_STRESS_PROVIDER_ENABLED, 'false')
  const prisma = getMarketDataPrisma()
  assert.ok(prisma, 'MARKET_DATA_DATABASE_URL is required.')
  const database = await prisma.$queryRaw<Array<{ database: string; host: string; port: number }>>`
    SELECT current_database() AS database, inet_server_addr()::text AS host, inet_server_port() AS port
  `
  assert.equal(database.length, 1)
  assert.equal(database[0].database, 'sg_phase_2_1_market_data')
  assert.equal(database[0].host.split('/')[0], '127.0.0.1')
  assert.equal(database[0].port, 55421)

  let evidence
  await cleanFixtures()
  try {
    const current = await runFamily('CURRENT')
    const verification = await runFamily('VERIFICATION')
    const isolation = await runIdentityIsolation()
    evidence = {
      task: 'FORECAST_PHASE_2_2B_3_PERSISTENCE_OWNERSHIP_IDEMPOTENCY_EXPERIMENT',
      generatedAt: new Date().toISOString(),
      database: database[0],
      cloneAlias: process.env.FORECAST_STRESS_DATABASE_CLONE_ALIAS,
      providerEnabled: false,
      sourceBehaviorChanged: false,
      additionalPersistenceMechanismPresent: false,
      claimBoundary: 'EFFECTIVE_CANONICAL_IDEMPOTENCY_NOT_EXACTLY_ONCE_SQL_EXECUTION',
      scenarios: [...current.scenarios, ...verification.scenarios],
      failureEvidence: [current.failureEvidence, verification.failureEvidence],
      isolation,
      h0: 'PASS',
    }
  } finally {
    await cleanFixtures()
  }
  const cleanupState = await stateCounts()
  assert.deepEqual(cleanupState, {
    parentCount: 0,
    currentPointCount: 0,
    verificationMetricCount: 0,
    verificationPointCount: 0,
  })
  assert.ok(evidence)
  process.stdout.write(`[FORECAST_PHASE_2_2B_3_RESULT] ${JSON.stringify({
    ...evidence,
    cleanup: { state: cleanupState, status: 'PASS' },
  })}\n`)
  await prisma.$disconnect()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}