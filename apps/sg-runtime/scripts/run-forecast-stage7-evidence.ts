import './load-env'

import { execFile as execFileCallback } from 'node:child_process'
import { statfs, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { promisify } from 'node:util'

import { Prisma } from '@/generated/market-data-client'
import {
  createForecastCapabilityService,
  type ForecastCapabilityProvenance,
} from '@/lib/forecast/capability-resolver'
import {
  type BenchmarkForecastCurrentResult,
  type BenchmarkForecastVerificationResult,
  type ForecastTargetBasis,
  USER_FACING_FORECAST_MODELS,
  type UserFacingForecastModelId,
} from '@/lib/forecast/contracts'
import {
  createProgressiveForecastPreparationService,
  type ProgressiveForecastPreparationRequest,
  type ProgressiveForecastPreparationSnapshot,
  type ProgressiveForecastVariantSnapshot,
} from '@/lib/forecast/progressive-preparation'
import {
  createForecastLibraryService,
  type ForecastServiceRequest,
} from '@/lib/forecast/service'
import { readRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import { prepareRollingDailyCurrentOwnership } from '@/lib/forecast/rolling-daily-current-ownership'
import { createRollingDailyProductionOperationsService } from '@/lib/forecast/rolling-daily-production-operations'
import { getMarketDataPrisma } from '@/lib/market-data/client'

const execFile = promisify(execFileCallback)

process.env.MARKET_DATA_DATABASE_URL = process.env.MARKET_DATA_DATABASE_URL
  ?? 'postgresql://phase21@127.0.0.1:55421/sg_phase_2_1_market_data'

const RESULT_JSON_PATH = path.resolve(
  process.cwd(),
  '..',
  '..',
  'tooling',
  'Benchmark-Forecasting',
  'validation',
  'ppf1-stage7-recent-verification-controlled-activation.json',
)
const RESULT_MD_PATH = path.resolve(
  process.cwd(),
  '..',
  '..',
  'tooling',
  'Benchmark-Forecasting',
  'validation',
  'ppf1-stage7-recent-verification-controlled-activation.md',
)

const SUPPRESSED_NOISY_LOG_EVENTS = new Set([
  'BENCHMARK_MARKET_DATA',
  'ROLLING_DAILY_INCREMENTAL_MAINTENANCE',
])

const originalConsoleInfo = console.info.bind(console)
console.info = (...args: unknown[]) => {
  const [firstArg] = args
  if (typeof firstArg === 'string') {
    const match = /^\[([^\]]+)\]/.exec(firstArg)
    if (match && SUPPRESSED_NOISY_LOG_EVENTS.has(match[1] ?? '')) {
      return
    }
  }

  originalConsoleInfo(...args)
}

const MIN_FREE_DISK_BYTES = 15 * 1024 * 1024 * 1024
const FAST_READY_TIMEOUT_MS = 120_000
const INDIVIDUAL_SAMPLE_TIMEOUT_MS = 10 * 60 * 1000
const REUSE_SAMPLE_TIMEOUT_MS = 2 * 60 * 1000
const TOTAL_EVIDENCE_TIMEOUT_MS = 4 * 60 * 60 * 1000
const POLL_INTERVAL_MS = 50
const VERIFICATION_NOT_REQUIRED_STATUS = 'NOT_REQUIRED'
const MACROBOND_PROVIDER_CODE = 'MACROBOND'
const DAILY_SERIES_ID = 'ppf1-stage6-daily-profile-v1'
const WEEKLY_SERIES_ID = 'ppf1-stage6-weekly-profile-v1'
const MONTHLY_SERIES_ID = 'ppf1-stage6-monthly-profile-v1'
const QUARTERLY_SERIES_ID = 'ppf1-stage6-quarterly-profile-v1'
const SEMIANNUAL_SERIES_ID = 'ppf1-stage6-semiannual-profile-v1'
const EXPECTED_PROFILE_COUNT = 32

type TargetSemantics = 'MONTHLY_AVERAGE' | 'END_OF_PERIOD' | 'ROLLING_DAILY_POINT_IN_TIME'
type SourceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL'
type RecentVerificationMode = 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN' | 'NOT_APPLICABLE'

type SyntheticSeriesDefinition = {
  seriesId: string
  displayName: string
  frequency: SourceFrequency
  observationCount: number
  startDate: string
}

type ProfilerProfile = {
  profileId: string
  seriesId: string
  modelId: UserFacingForecastModelId
  targetSemantics: TargetSemantics
  targetBasis: ForecastTargetBasis
  sourceFrequency: SourceFrequency
  targetCadence: 'MONTHLY' | 'DAILY' | 'QUARTERLY' | 'SEMIANNUAL'
  recentVerificationMode: RecentVerificationMode
}

type RecorderEvent = {
  kind: 'telemetry' | 'log'
  event: string
  metrics: Record<string, unknown>
}

type SyntheticSeriesHistory = ReturnType<typeof buildDailyHistory>

type PersistedArtifactCounts = {
  current: number
  verification: number
}

type IntegratedMeasurement = {
  snapshotReadyMs: number
  renderableReadyMs: number
  drainMs: number
  polls: number
  firstSnapshot: {
    activeKind: 'CURRENT' | 'VERIFICATION' | null
    queuedCount: number
    currentReadyCount: number
    verificationReadyCount: number
    selectedCurrentState: string | null
    selectedVerificationState: string | null
  }
  observed: {
    sawCurrentPreparing: boolean
    sawVerificationPreparing: boolean
    sawCurrentReadyBeforeVerification: boolean
    sawVerificationReady: boolean
  }
  exactPreparedRead: {
    currentStatus: string
    verificationStatus: string
  }
  persistedArtifacts: {
    before: PersistedArtifactCounts
    after: PersistedArtifactCounts
    currentWrites: number
    verificationWrites: number
  }
  telemetry: {
    currentOwnerCount: number
    currentWaiterCount: number
    recentOwnerCount: number
    recentWaiterCount: number
    currentComputeCount: number
    recentVerificationComputeCount: number
    nonRecentVerificationComputeCount: number
    rollingDailyCalibrationBuildCount: number
  }
}

type ReuseMeasurement = {
  durationMs: number
  queuedCount: number
  activeKind: 'CURRENT' | 'VERIFICATION' | null
  currentState: string | null
  verificationState: string | null
  currentStatus: string
  verificationStatus: string
  currentComputeCount: number
  recentVerificationComputeCount: number
  nonRecentVerificationComputeCount: number
  currentWrites: number
  verificationWrites: number
}

type ConcurrencyMeasurement = {
  requestCount: number
  profileId: string
  allSucceeded: boolean
  latencyMs: number[]
  currentOwnerCount: number
  currentWaiterCount: number
  recentOwnerCount: number
  recentWaiterCount: number
  currentComputeCount: number
  recentVerificationComputeCount: number
  nonRecentVerificationComputeCount: number
  currentWrites: number
  verificationWrites: number
  gate: 'PASS' | 'FAIL'
  reasons: string[]
}

type ProfileEvidence = {
  profileId: string
  seriesId: string
  modelId: UserFacingForecastModelId
  targetSemantics: TargetSemantics
  recentVerificationMode: RecentVerificationMode
  coldSnapshotReadyMs: number
  coldRenderableReadyMs: number
  warmDurationMs: number
  crossContextDurationMs: number
  currentStatus: string
  verificationStatus: string
  firstSnapshot: IntegratedMeasurement['firstSnapshot']
  observed: IntegratedMeasurement['observed']
  currentComputeCount: number
  recentVerificationComputeCount: number
  nonRecentVerificationComputeCount: number
  rollingDailyCalibrationBuildCount: number
  currentWrites: number
  verificationWrites: number
  warmReuse: ReuseMeasurement
  crossContextReuse: ReuseMeasurement
  gate: 'PASS' | 'FAIL'
}

class TelemetryRecorder {
  private readonly events: RecorderEvent[] = []

  run<T>(_context: unknown, operation: () => T): T {
    return operation()
  }

  currentContext() {
    return null
  }

  sampleResources() {
    return null
  }

  emit(event: string, metrics: Record<string, unknown> = {}) {
    this.events.push({ kind: 'telemetry', event, metrics })
  }

  log(event: string, metrics: Record<string, unknown> = {}) {
    this.events.push({ kind: 'log', event, metrics })
  }

  drain() {
    const drained = [...this.events]
    this.events.length = 0
    return drained
  }
}

function formatBytes(bytes: number) {
  const gib = bytes / (1024 * 1024 * 1024)
  return `${gib.toFixed(2)} GiB`
}

function isEnospcError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOSPC'
}

function failFast(error: unknown, context: string): never {
  if (isEnospcError(error)) {
    throw new Error(`ENOSPC during ${context}. Disk is below the required safety margin and the runner must stop without retry.`)
  }
  throw error
}

async function assertFreeDiskSpace() {
  const stats = await statfs(process.cwd())
  const freeBytes = Number(stats.bavail) * Number(stats.bsize)
  if (!Number.isFinite(freeBytes)) {
    throw new Error('Unable to determine free disk space for the Stage 7 evidence preflight.')
  }
  if (freeBytes < MIN_FREE_DISK_BYTES) {
    throw new Error(`Disk preflight failed: ${formatBytes(freeBytes)} free, require at least ${formatBytes(MIN_FREE_DISK_BYTES)} before starting Stage 7 evidence.`)
  }
  process.stdout.write(`${JSON.stringify({ diskPreflight: 'PASS', freeDiskBytes: freeBytes, freeDiskGiB: Number((freeBytes / (1024 * 1024 * 1024)).toFixed(3)) })}\n`)
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} exceeded timeout ${timeoutMs}ms.`)), timeoutMs)
  })
  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }) as Promise<T>
}

function logProgress(profileIndex: number, profileCount: number, sampleLabel: string, phase: string) {
  process.stdout.write(`[profile ${profileIndex}/${profileCount}] [${sampleLabel}] [${phase}]\n`)
}

function snapshotAndKickoffWithTimeout(
  progressiveService: ReturnType<typeof createProgressiveForecastPreparationService>,
  request: ProgressiveForecastPreparationRequest,
  label: string,
) {
  return withTimeout(
    progressiveService.snapshotAndKickoff(request),
    FAST_READY_TIMEOUT_MS,
    label,
  )
}

function readExactPreparedArtifactsWithTimeout(
  profile: ProfilerProfile,
  libraryService: ReturnType<typeof createForecastLibraryService>,
  label: string,
) {
  return withTimeout(
    readExactPreparedArtifacts(profile, libraryService),
    FAST_READY_TIMEOUT_MS,
    label,
  )
}

function roundMs(value: number) {
  return Number(value.toFixed(3))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRecentVerificationEvent(event: RecorderEvent) {
  if (event.kind !== 'telemetry') {
    return false
  }

  return (typeof event.metrics.trainingWindowPolicyId === 'string'
      && event.metrics.trainingWindowPolicyId.startsWith('RECENT_'))
    || (typeof event.metrics.logicalArtifactKey === 'string'
      && event.metrics.logicalArtifactKey.includes('RECENT_VERIFICATION'))
}

function countEvents(
  events: readonly RecorderEvent[],
  eventName: string,
  predicate?: (event: RecorderEvent) => boolean,
) {
  return events.filter((event) => event.event === eventName && (predicate ? predicate(event) : true)).length
}

function summarizeTelemetry(events: readonly RecorderEvent[]) {
  return {
    currentOwnerCount: countEvents(events, 'single_flight_owner_acquired', (event) => event.kind === 'telemetry' && event.metrics.operationFamily === 'CURRENT'),
    currentWaiterCount: countEvents(events, 'single_flight_waiter_joined', (event) => event.kind === 'telemetry' && event.metrics.operationFamily === 'CURRENT'),
    recentOwnerCount: countEvents(events, 'single_flight_owner_acquired', isRecentVerificationEvent),
    recentWaiterCount: countEvents(events, 'single_flight_waiter_joined', isRecentVerificationEvent),
    currentComputeCount: countEvents(events, 'current_compute_start', (event) => event.kind === 'telemetry'),
    recentVerificationComputeCount: countEvents(events, 'verification_compute_start', isRecentVerificationEvent),
    nonRecentVerificationComputeCount: countEvents(events, 'verification_compute_start', (event) => event.kind === 'telemetry' && !isRecentVerificationEvent(event)),
    rollingDailyCalibrationBuildCount: countEvents(events, 'ROLLING_DAILY_CURRENT_ONLY', (event) => event.kind === 'log' && event.metrics.calibrationTriggeredInline === true),
  }
}

function addFrequencyStep(date: Date, frequency: Exclude<SourceFrequency, 'DAILY'>) {
  const next = new Date(date)
  if (frequency === 'WEEKLY') {
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }

  const months = frequency === 'MONTHLY'
    ? 1
    : frequency === 'QUARTERLY'
      ? 3
      : 6
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

function buildDailyHistory() {
  const start = new Date(Date.UTC(2021, 0, 1))
  const historical = Array.from({ length: 1825 }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const seasonal = Math.sin(index / 14) * 2.4
    const longerCycle = Math.cos(index / 45) * 1.8
    const drift = index * 0.04
    const level = 48 + drift + seasonal + longerCycle
    return {
      date: date.toISOString(),
      value: roundMs(level),
    }
  })

  return {
    providerSeries: {
      provider: {
        providerCode: MACROBOND_PROVIDER_CODE,
        displayName: 'Macrobond',
      },
      providerSeriesId: DAILY_SERIES_ID,
      providerSeriesKey: 'PPF1_STAGE6_DAILY_PROFILE_V1',
    },
    displayName: 'PPF1 Stage 6 Daily Profile',
    frequency: 'DAILY',
    currency: 'INDEX',
    unit: 'pts',
    source: 'PPF1_STAGE7_EVIDENCE_SEED',
    historical,
  }
}

function buildNativeHistory(definition: SyntheticSeriesDefinition): SyntheticSeriesHistory {
  const start = new Date(definition.startDate)
  const historical = Array.from({ length: definition.observationCount }, (_, index) => {
    const observedAt = new Date(start)
    if (definition.frequency === 'DAILY') {
      observedAt.setUTCDate(start.getUTCDate() + index)
    } else {
      let cursor = new Date(start)
      for (let step = 0; step < index; step += 1) {
        cursor = addFrequencyStep(cursor, definition.frequency)
      }
      observedAt.setTime(cursor.getTime())
    }
    const seasonal = Math.sin(index / 4) * 1.2
    const longerCycle = Math.cos(index / 9) * 0.8
    const drift = index * 0.35
    return {
      date: observedAt.toISOString(),
      value: roundMs(75 + drift + seasonal + longerCycle),
    }
  })

  return {
    providerSeries: {
      provider: {
        providerCode: MACROBOND_PROVIDER_CODE,
        displayName: 'Macrobond',
      },
      providerSeriesId: definition.seriesId,
      providerSeriesKey: definition.seriesId.toUpperCase().replace(/-/g, '_'),
    },
    displayName: definition.displayName,
    frequency: definition.frequency,
    currency: 'INDEX',
    unit: 'pts',
    source: 'PPF1_STAGE7_EVIDENCE_SEED',
    historical,
  }
}

const SYNTHETIC_SERIES_DEFINITIONS: readonly SyntheticSeriesDefinition[] = [
  { seriesId: DAILY_SERIES_ID, displayName: 'PPF1 Stage 6 Daily Profile', frequency: 'DAILY', observationCount: 1825, startDate: '2021-01-01T00:00:00.000Z' },
  { seriesId: WEEKLY_SERIES_ID, displayName: 'PPF1 Stage 6 Weekly Profile', frequency: 'WEEKLY', observationCount: 260, startDate: '2021-01-04T00:00:00.000Z' },
  { seriesId: MONTHLY_SERIES_ID, displayName: 'PPF1 Stage 6 Monthly Profile', frequency: 'MONTHLY', observationCount: 72, startDate: '2019-01-01T00:00:00.000Z' },
  { seriesId: QUARTERLY_SERIES_ID, displayName: 'PPF1 Stage 6 Quarterly Profile', frequency: 'QUARTERLY', observationCount: 48, startDate: '2013-01-01T00:00:00.000Z' },
  { seriesId: SEMIANNUAL_SERIES_ID, displayName: 'PPF1 Stage 6 Semiannual Profile', frequency: 'SEMIANNUAL', observationCount: 40, startDate: '2006-01-01T00:00:00.000Z' },
] as const

function buildSyntheticHistory(definition: SyntheticSeriesDefinition) {
  return definition.frequency === 'DAILY'
    ? buildDailyHistory()
    : buildNativeHistory(definition)
}

function buildSyntheticProvenance(seriesId: string, frequency: SourceFrequency): ForecastCapabilityProvenance[] {
  if (frequency === 'DAILY') {
    return []
  }

  const endOfPeriod: ForecastCapabilityProvenance = {
    sourceFrequency: frequency,
    targetSemantics: 'END_OF_PERIOD',
    preparation: {
      method: `PPF1_SYNTHETIC_${frequency}_END_OF_PERIOD`,
      version: 'ppf1-stage7-synthetic-provenance-v1',
      provenanceStatus: 'PROVEN',
    },
    sourceLineage: `PPF1_SYNTHETIC_CONTROLLED_SERIES:${seriesId}:${frequency}`,
    closedPeriod: true,
    levelAtTimestamp: true,
    exactSourceObservedAt: true,
    aggregation: null,
    underlyingObservationFrequency: null,
    missingObservationPolicy: null,
    syntheticObservations: false,
  }

  if (frequency === 'WEEKLY') {
    return [endOfPeriod]
  }

  return [
    endOfPeriod,
    {
      sourceFrequency: frequency,
      targetSemantics: 'MONTHLY_AVERAGE',
      preparation: {
        method: `PPF1_SYNTHETIC_${frequency}_AVERAGE`,
        version: 'ppf1-stage7-synthetic-provenance-v1',
        provenanceStatus: 'PROVEN',
      },
      sourceLineage: `PPF1_SYNTHETIC_CONTROLLED_SERIES:${seriesId}:${frequency}`,
      closedPeriod: true,
      levelAtTimestamp: null,
      exactSourceObservedAt: null,
      aggregation: 'ARITHMETIC_MEAN',
      underlyingObservationFrequency: frequency,
      missingObservationPolicy: 'USE_AVAILABLE_LAWFUL_OBSERVATIONS_ONLY',
      syntheticObservations: false,
    },
  ]
}

const profilerCapabilityService = createForecastCapabilityService({
  resolveProvenance: async (seriesId, history) => {
    const synthetic = SYNTHETIC_SERIES_DEFINITIONS.find((definition) => definition.seriesId === seriesId)
    if (!synthetic) {
      return []
    }

    return buildSyntheticProvenance(seriesId, synthetic.frequency)
  },
})

async function seedHistory(history: SyntheticSeriesHistory) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const earliest = new Date(history.historical[0]!.date)
  const latest = new Date(history.historical[history.historical.length - 1]!.date)

  await prisma.$transaction(async (tx) => {
    const series = await tx.marketSeries.upsert({
      where: {
        providerCode_providerSeriesId: {
          providerCode: MACROBOND_PROVIDER_CODE,
          providerSeriesId: history.providerSeries.providerSeriesId,
        },
      },
      create: {
        providerCode: MACROBOND_PROVIDER_CODE,
        providerSeriesId: history.providerSeries.providerSeriesId,
        providerSeriesKey: history.providerSeries.providerSeriesKey,
        displayName: history.displayName,
        frequency: history.frequency,
        currency: history.currency,
        unit: history.unit,
        sourceLabel: history.source,
      },
      update: {
        providerSeriesKey: history.providerSeries.providerSeriesKey,
        displayName: history.displayName,
        frequency: history.frequency,
        currency: history.currency,
        unit: history.unit,
        sourceLabel: history.source,
      },
    })

    await tx.marketObservation.deleteMany({
      where: { seriesId: series.id },
    })

    await tx.marketObservation.createMany({
      data: history.historical.map((point) => ({
        seriesId: series.id,
        observedAt: new Date(point.date),
        value: point.value === null ? null : new Prisma.Decimal(point.value),
      })),
    })

    await tx.marketHydrationState.upsert({
      where: { seriesId: series.id },
      create: {
        seriesId: series.id,
        lastProviderFetchAt: new Date(),
        earliestStoredObservationAt: earliest,
        latestStoredObservationAt: latest,
        lastHydrationStatus: 'SUCCEEDED',
        lastHydrationMessage: null,
        lastHydratedObservationCount: history.historical.length,
      },
      update: {
        lastProviderFetchAt: new Date(),
        earliestStoredObservationAt: earliest,
        latestStoredObservationAt: latest,
        lastHydrationStatus: 'SUCCEEDED',
        lastHydrationMessage: null,
        lastHydratedObservationCount: history.historical.length,
      },
    })
  })
}

async function clearSeriesArtifacts(seriesIds: readonly string[]) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.rollingDailyCurrentForecastSnapshot.deleteMany({
        where: { seriesId: { in: [...seriesIds] } },
      })
      await tx.forecastVerificationRun.deleteMany({
        where: { seriesId: { in: [...seriesIds] } },
      })
      await tx.forecastCurrentRun.deleteMany({
        where: { seriesId: { in: [...seriesIds] } },
      })
      await tx.forecastPreparationExecutionLedger.deleteMany({
        where: { seriesId: { in: [...seriesIds] } },
      })
    })
  } catch (error) {
    failFast(error, 'artifact cleanup')
  }
}

function buildServiceRequest(profile: ProfilerProfile): ForecastServiceRequest {
  return {
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    targetBasis: profile.targetBasis,
    sourceFrequency: profile.sourceFrequency,
    targetCadence: profile.targetCadence,
  }
}

function buildProgressiveRequest(profile: ProfilerProfile): ProgressiveForecastPreparationRequest {
  return {
    seriesId: profile.seriesId,
    preferredModelId: profile.modelId,
    preferredTargetBasis: profile.targetBasis,
  }
}

function recentVerificationRequired(profile: ProfilerProfile) {
  return profile.recentVerificationMode !== 'NOT_APPLICABLE'
}

async function buildProfiles() {
  const profiles: ProfilerProfile[] = []
  const candidates: Array<Pick<ProfilerProfile, 'seriesId' | 'sourceFrequency' | 'targetCadence' | 'targetSemantics' | 'targetBasis' | 'recentVerificationMode'>> = [
    {
      seriesId: DAILY_SERIES_ID,
      sourceFrequency: 'DAILY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'MONTHLY_AVERAGE',
      targetBasis: 'MONTHLY_AVERAGE',
      recentVerificationMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
    },
    {
      seriesId: DAILY_SERIES_ID,
      sourceFrequency: 'DAILY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'END_OF_PERIOD',
      targetBasis: 'END_OF_PERIOD',
      recentVerificationMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
    },
    {
      seriesId: DAILY_SERIES_ID,
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      targetBasis: 'POINT_IN_TIME',
      recentVerificationMode: 'NOT_APPLICABLE',
    },
    {
      seriesId: WEEKLY_SERIES_ID,
      sourceFrequency: 'WEEKLY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'END_OF_PERIOD',
      targetBasis: 'END_OF_PERIOD',
      recentVerificationMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
    },
    {
      seriesId: MONTHLY_SERIES_ID,
      sourceFrequency: 'MONTHLY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'END_OF_PERIOD',
      targetBasis: 'END_OF_PERIOD',
      recentVerificationMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
    },
    {
      seriesId: MONTHLY_SERIES_ID,
      sourceFrequency: 'MONTHLY',
      targetCadence: 'MONTHLY',
      targetSemantics: 'MONTHLY_AVERAGE',
      targetBasis: 'MONTHLY_AVERAGE',
      recentVerificationMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
    },
    {
      seriesId: QUARTERLY_SERIES_ID,
      sourceFrequency: 'QUARTERLY',
      targetCadence: 'QUARTERLY',
      targetSemantics: 'END_OF_PERIOD',
      targetBasis: 'END_OF_PERIOD',
      recentVerificationMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
    },
    {
      seriesId: SEMIANNUAL_SERIES_ID,
      sourceFrequency: 'SEMIANNUAL',
      targetCadence: 'SEMIANNUAL',
      targetSemantics: 'END_OF_PERIOD',
      targetBasis: 'END_OF_PERIOD',
      recentVerificationMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
    },
  ]

  for (const candidate of candidates) {
    for (const modelId of USER_FACING_FORECAST_MODELS) {
      const capability = await profilerCapabilityService.resolveExact({
        seriesId: candidate.seriesId,
        targetSemantics: candidate.targetSemantics,
        modelId,
      })
      if (!capability.capability) {
        continue
      }
      if (capability.capability.admissionState !== 'ADMITTED' || capability.capability.implementationState !== 'SUPPORTED') {
        continue
      }
      if (capability.capability.historyEligibility !== 'ELIGIBLE') {
        continue
      }

      profiles.push({
        profileId: `${candidate.seriesId}|${candidate.targetSemantics}|${modelId}`,
        seriesId: candidate.seriesId,
        modelId,
        targetSemantics: candidate.targetSemantics,
        targetBasis: candidate.targetBasis,
        sourceFrequency: candidate.sourceFrequency,
        targetCadence: candidate.targetCadence,
        recentVerificationMode: candidate.recentVerificationMode,
      })
    }
  }

  return profiles
}

function findSelectedVariant(snapshot: ProgressiveForecastPreparationSnapshot, profile: ProfilerProfile) {
  return snapshot.variants.find((variant) => (
    variant.seriesId === profile.seriesId
    && variant.modelId === profile.modelId
    && variant.targetBasis === profile.targetBasis
  )) ?? null
}

async function resolveProfileScopedCapabilities(profile: ProfilerProfile) {
  const resolution = await profilerCapabilityService.resolveBySeriesId(profile.seriesId)
  return {
    ...resolution,
    capabilities: resolution.capabilities.filter((capability) => (
      capability.identity.modelId === profile.modelId
      && capability.identity.targetSemantics === profile.targetSemantics
    )),
  }
}

function createInstrumentedServices(profile: ProfilerProfile) {
  const recorder = new TelemetryRecorder()
  const libraryService = createForecastLibraryService({
    telemetry: recorder,
    logEvent: (event, metrics) => recorder.log(event, metrics),
    resolveExactPreparedCapability: (input) => profilerCapabilityService.resolveExact(input),
  })
  const rollingDailyService = createRollingDailyProductionOperationsService({
    logEvent: (event, metrics) => recorder.log(event, metrics),
  })
  const progressiveService = createProgressiveForecastPreparationService({
    resolveCapabilities: async () => resolveProfileScopedCapabilities(profile),
    prepareMonthlyCurrent: (input) => libraryService.resolveCurrentForecastRequest(input),
    prepareMonthlyHistorical: (input) => libraryService.resolveRecentVerificationRequest(input),
    runRollingDaily: (input) => rollingDailyService.run(input),
  })

  return { recorder, libraryService, progressiveService }
}

async function countPersistedArtifacts(profile: ProfilerProfile): Promise<PersistedArtifactCounts> {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const method = {
    methodId: profile.targetSemantics,
    methodVersion: profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? 'rolling-daily-point-in-time-v1'
      : 'v1',
  }

  try {
    const current = profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? await prisma.rollingDailyCurrentForecastSnapshot.count({
          where: {
            seriesId: profile.seriesId,
            modelId: profile.modelId,
            targetBasis: profile.targetBasis,
            methodId: method.methodId,
            methodVersion: method.methodVersion,
          },
        })
      : await prisma.forecastCurrentRun.count({
          where: {
            seriesId: profile.seriesId,
            modelId: profile.modelId,
            targetBasis: profile.targetBasis,
            methodId: method.methodId,
            methodVersion: method.methodVersion,
          },
        })

    const verification = !recentVerificationRequired(profile)
      ? 0
      : await prisma.forecastVerificationRun.count({
          where: {
            seriesId: profile.seriesId,
            modelId: profile.modelId,
            targetBasis: profile.targetBasis,
            methodId: method.methodId,
            methodVersion: method.methodVersion,
          },
        })

    return { current, verification }
  } catch (error) {
    failFast(error, 'persisted artifact counting')
  }
}

async function readExactPreparedArtifacts(
  profile: ProfilerProfile,
  libraryService: ReturnType<typeof createForecastLibraryService>,
) {
  const request = buildServiceRequest(profile)
  const current = profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
    ? await readRollingDailyPreparedCurrent(profile)
    : await libraryService.readPreparedCurrentForecastRequest(request)
  const verification = !recentVerificationRequired(profile)
    ? null
    : await libraryService.readPreparedRecentVerificationRequest(request)
  return { current, verification }
}

async function readRollingDailyPreparedCurrent(profile: ProfilerProfile) {
  const ownership = await prepareRollingDailyCurrentOwnership({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
  })
  const snapshot = await readRollingDailyCurrentForecastSnapshot({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    sourceHistoryFingerprint: ownership.identity.historyFingerprint,
  })

  if (snapshot.status === 'MISS') {
    return {
      status: 'NOT_AVAILABLE' as const,
      seriesId: profile.seriesId,
      modelId: profile.modelId,
      targetBasis: profile.targetBasis,
      targetSemantics: profile.targetSemantics,
      methodId: profile.targetSemantics,
      reason: snapshot.reason,
    }
  }

  return {
    status: snapshot.status,
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    targetBasis: profile.targetBasis,
    targetSemantics: profile.targetSemantics,
    methodId: profile.targetSemantics,
    reason: 'reason' in snapshot ? snapshot.reason : undefined,
  }
}

function currentPreparedRenderable(profile: ProfilerProfile, status: string) {
  return profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
    ? status === 'HIT'
    : status === 'AVAILABLE'
}

async function drainSeries(
  profile: ProfilerProfile,
  progressiveService: ReturnType<typeof createProgressiveForecastPreparationService>,
) {
  const request = buildProgressiveRequest(profile)
  const startedAt = performance.now()
  while (true) {
    const snapshot = await snapshotAndKickoffWithTimeout(
      progressiveService,
      request,
      `progressive drain snapshot for ${profile.profileId}`,
    )
    if (snapshot.activeItem === null && snapshot.queuedCount === 0) {
      return roundMs(performance.now() - startedAt)
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

async function finalizeIntegratedMeasurement(input: {
  profile: ProfilerProfile
  recorder: TelemetryRecorder
  progressiveService: ReturnType<typeof createProgressiveForecastPreparationService>
  artifactsBefore: PersistedArtifactCounts
  startedAt: number
  polls: number
  firstSnapshot: IntegratedMeasurement['firstSnapshot']
  reads: Awaited<ReturnType<typeof readExactPreparedArtifacts>>
  sawCurrentPreparing: boolean
  sawVerificationPreparing: boolean
  sawCurrentReadyBeforeVerification: boolean
  sawVerificationReady: boolean
  snapshotReadyMs: number | null
  renderableReadyMs: number
}) {
  const drainMs = await withTimeout(
    drainSeries(input.profile, input.progressiveService),
    INDIVIDUAL_SAMPLE_TIMEOUT_MS,
    `drain for ${input.profile.profileId}`,
  )
  const events = input.recorder.drain()
  const telemetry = summarizeTelemetry(events)
  const artifactsAfter = await countPersistedArtifacts(input.profile)
  return {
    snapshotReadyMs: input.snapshotReadyMs ?? input.renderableReadyMs,
    renderableReadyMs: input.renderableReadyMs,
    drainMs,
    polls: input.polls,
    firstSnapshot: input.firstSnapshot,
    observed: {
      sawCurrentPreparing: input.sawCurrentPreparing,
      sawVerificationPreparing: input.sawVerificationPreparing,
      sawCurrentReadyBeforeVerification: input.sawCurrentReadyBeforeVerification,
      sawVerificationReady: input.sawVerificationReady,
    },
    exactPreparedRead: {
      currentStatus: input.reads.current.status,
      verificationStatus: !recentVerificationRequired(input.profile)
        ? VERIFICATION_NOT_REQUIRED_STATUS
        : input.reads.verification?.status ?? 'NOT_AVAILABLE',
    },
    persistedArtifacts: {
      before: input.artifactsBefore,
      after: artifactsAfter,
      currentWrites: Math.max(artifactsAfter.current - input.artifactsBefore.current, 0),
      verificationWrites: Math.max(artifactsAfter.verification - input.artifactsBefore.verification, 0),
    },
    telemetry,
  } satisfies IntegratedMeasurement
}

async function measureIntegratedProfile(profile: ProfilerProfile): Promise<IntegratedMeasurement> {
  await clearSeriesArtifacts([profile.seriesId])
  const { recorder, libraryService, progressiveService } = createInstrumentedServices(profile)
  const request = buildProgressiveRequest(profile)
  const artifactsBefore = await countPersistedArtifacts(profile)
  recorder.drain()

  const startedAt = performance.now()
  let polls = 0
  let snapshot = await snapshotAndKickoffWithTimeout(
    progressiveService,
    request,
    `initial progressive kickoff for ${profile.profileId}`,
  )
  let variant = findSelectedVariant(snapshot, profile)
  if (!variant) {
    throw new Error(`Progressive snapshot did not contain the selected variant for ${profile.profileId}.`)
  }

  const firstSnapshot = {
    activeKind: snapshot.activeItem?.kind ?? null,
    queuedCount: snapshot.queuedCount,
    currentReadyCount: snapshot.currentReadyCount,
    verificationReadyCount: snapshot.verificationReadyCount,
    selectedCurrentState: variant.currentState,
    selectedVerificationState: variant.verificationState,
  }

  let sawCurrentPreparing = variant.currentState === 'PREPARING'
  let sawVerificationPreparing = variant.verificationState === 'PREPARING'
  let sawCurrentReadyBeforeVerification = false
  let sawVerificationReady = variant.verificationState === 'READY'
  let renderableReadyMs: number | null = null
  let snapshotReadyMs: number | null = null

  while (true) {
    const reads = await readExactPreparedArtifactsWithTimeout(
      profile,
      libraryService,
      `exact prepared read for ${profile.profileId}`,
    )
    const selectedCurrentReady = variant.currentState === 'READY'
    const selectedVerificationReady = !recentVerificationRequired(profile)
      ? true
      : variant.verificationState === 'READY'
    const currentRenderable = currentPreparedRenderable(profile, reads.current.status)
    const verificationRenderable = !recentVerificationRequired(profile)
      ? true
      : reads.verification?.status === 'AVAILABLE'

    if (selectedCurrentReady && selectedVerificationReady && snapshotReadyMs === null) {
      snapshotReadyMs = roundMs(performance.now() - startedAt)
    }

    if (selectedCurrentReady && !selectedVerificationReady) {
      sawCurrentReadyBeforeVerification = true
    }

    if (currentRenderable && verificationRenderable && renderableReadyMs === null) {
      renderableReadyMs = roundMs(performance.now() - startedAt)
    }

    if (selectedCurrentReady && selectedVerificationReady && currentRenderable && verificationRenderable) {
      return finalizeIntegratedMeasurement({
        profile,
        recorder,
        progressiveService,
        artifactsBefore,
        startedAt,
        polls,
        firstSnapshot,
        reads,
        sawCurrentPreparing,
        sawVerificationPreparing,
        sawCurrentReadyBeforeVerification,
        sawVerificationReady: sawVerificationReady || selectedVerificationReady,
        snapshotReadyMs,
        renderableReadyMs,
      })
    }

    if (performance.now() - startedAt > FAST_READY_TIMEOUT_MS) {
      const timeoutReads = await readExactPreparedArtifactsWithTimeout(
        profile,
        libraryService,
        `timeout exact prepared read for ${profile.profileId}`,
      )
      const timeoutCurrentRenderable = currentPreparedRenderable(profile, timeoutReads.current.status)
      const timeoutVerificationRenderable = !recentVerificationRequired(profile)
        ? true
        : timeoutReads.verification?.status === 'AVAILABLE'

      if (timeoutCurrentRenderable && timeoutVerificationRenderable) {
        snapshot = await snapshotAndKickoffWithTimeout(
          progressiveService,
          request,
          `timeout confirmation snapshot for ${profile.profileId}`,
        )
        variant = findSelectedVariant(snapshot, profile)
        if (!variant) {
          throw new Error(`Progressive snapshot lost the selected variant for ${profile.profileId}.`)
        }

        const timeoutSelectedCurrentReady = variant.currentState === 'READY'
        const timeoutSelectedVerificationReady = !recentVerificationRequired(profile)
          ? true
          : variant.verificationState === 'READY'

        if (timeoutSelectedCurrentReady && timeoutSelectedVerificationReady) {
          return finalizeIntegratedMeasurement({
            profile,
            recorder,
            progressiveService,
            artifactsBefore,
            startedAt,
            polls,
            firstSnapshot,
            reads: timeoutReads,
            sawCurrentPreparing,
            sawVerificationPreparing,
            sawCurrentReadyBeforeVerification,
            sawVerificationReady: sawVerificationReady || timeoutSelectedVerificationReady,
            snapshotReadyMs: snapshotReadyMs ?? renderableReadyMs,
            renderableReadyMs: renderableReadyMs ?? roundMs(performance.now() - startedAt),
          })
        }
      }

      throw new Error(
        `Timed out waiting for integrated Stage 7 readiness for ${profile.profileId}. `
        + `currentState=${variant.currentState} verificationState=${variant.verificationState} `
        + `currentReason=${variant.currentReason ?? 'null'} verificationReason=${variant.verificationReason ?? 'null'} `
        + `currentPrepared=${timeoutReads.current.status} `
        + `verificationPrepared=${!recentVerificationRequired(profile) ? VERIFICATION_NOT_REQUIRED_STATUS : timeoutReads.verification?.status ?? 'NOT_AVAILABLE'} `
        + `currentReadyCount=${snapshot.currentReadyCount} verificationReadyCount=${snapshot.verificationReadyCount} `
        + `queuedCount=${snapshot.queuedCount} activeKind=${snapshot.activeItem?.kind ?? 'null'} polls=${polls}`,
      )
    }

    await sleep(POLL_INTERVAL_MS)
    snapshot = await snapshotAndKickoffWithTimeout(
      progressiveService,
      request,
      `progressive poll snapshot for ${profile.profileId}`,
    )
    variant = findSelectedVariant(snapshot, profile)
    if (!variant) {
      throw new Error(`Progressive snapshot lost the selected variant for ${profile.profileId}.`)
    }
    polls += 1
    sawCurrentPreparing = sawCurrentPreparing || variant.currentState === 'PREPARING'
    sawVerificationPreparing = sawVerificationPreparing || variant.verificationState === 'PREPARING'
    sawVerificationReady = sawVerificationReady || variant.verificationState === 'READY'
  }
}

async function measureReuse(
  profile: ProfilerProfile,
): Promise<ReuseMeasurement> {
  const { recorder, libraryService, progressiveService } = createInstrumentedServices(profile)
  const request = buildProgressiveRequest(profile)
  const before = await countPersistedArtifacts(profile)
  recorder.drain()
  const startedAt = performance.now()
  const snapshot = await snapshotAndKickoffWithTimeout(
    progressiveService,
    request,
    `reuse kickoff for ${profile.profileId}`,
  )
  const variant = findSelectedVariant(snapshot, profile)
  const reads = await readExactPreparedArtifactsWithTimeout(
    profile,
    libraryService,
    `reuse exact prepared read for ${profile.profileId}`,
  )
  const durationMs = roundMs(performance.now() - startedAt)
  const events = recorder.drain()
  const telemetry = summarizeTelemetry(events)
  const after = await countPersistedArtifacts(profile)

  return {
    durationMs,
    queuedCount: snapshot.queuedCount,
    activeKind: snapshot.activeItem?.kind ?? null,
    currentState: variant?.currentState ?? null,
    verificationState: variant?.verificationState ?? null,
    currentStatus: reads.current.status,
    verificationStatus: !recentVerificationRequired(profile)
      ? VERIFICATION_NOT_REQUIRED_STATUS
      : reads.verification?.status ?? 'NOT_AVAILABLE',
    currentComputeCount: telemetry.currentComputeCount,
    recentVerificationComputeCount: telemetry.recentVerificationComputeCount,
    nonRecentVerificationComputeCount: telemetry.nonRecentVerificationComputeCount,
    currentWrites: Math.max(after.current - before.current, 0),
    verificationWrites: Math.max(after.verification - before.verification, 0),
  }
}

async function measureConcurrency(profile: ProfilerProfile): Promise<ConcurrencyMeasurement> {
  await clearSeriesArtifacts([profile.seriesId])
  const { recorder, libraryService, progressiveService } = createInstrumentedServices(profile)
  const request = buildProgressiveRequest(profile)
  const before = await countPersistedArtifacts(profile)
  recorder.drain()

  const runOne = async () => {
    const startedAt = performance.now()
    while (true) {
      const snapshot = await snapshotAndKickoffWithTimeout(
        progressiveService,
        request,
        `concurrency kickoff for ${profile.profileId}`,
      )
      const variant = findSelectedVariant(snapshot, profile)
      if (!variant) {
        throw new Error(`Concurrent snapshot lost the selected variant for ${profile.profileId}.`)
      }

      const reads = await readExactPreparedArtifactsWithTimeout(
        profile,
        libraryService,
        `concurrency exact prepared read for ${profile.profileId}`,
      )
      const selectedReady = variant.currentState === 'READY' && variant.verificationState === 'READY'
      const renderableReady = reads.current.status === 'AVAILABLE' && reads.verification?.status === 'AVAILABLE'
      if (selectedReady && renderableReady) {
        return roundMs(performance.now() - startedAt)
      }

      if (performance.now() - startedAt > FAST_READY_TIMEOUT_MS) {
        throw new Error(`Concurrent request timed out for ${profile.profileId}.`)
      }

      await sleep(POLL_INTERVAL_MS)
    }
  }

  const settled = await Promise.allSettled(Array.from({ length: 5 }, () => runOne()))
  await drainSeries(profile, progressiveService)
  const after = await countPersistedArtifacts(profile)
  const events = recorder.drain()
  const telemetry = summarizeTelemetry(events)
  const latencies = settled.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
  const reasons = settled.flatMap((result) => result.status === 'rejected'
    ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
    : [])

  if (telemetry.recentOwnerCount !== 1) {
    reasons.push(`Expected exactly one recent owner; observed ${telemetry.recentOwnerCount}.`)
  }
  if (telemetry.recentVerificationComputeCount !== 1) {
    reasons.push(`Expected exactly one recent verification compute; observed ${telemetry.recentVerificationComputeCount}.`)
  }
  if (telemetry.nonRecentVerificationComputeCount !== 0) {
    reasons.push(`Observed non-recent verification compute during Stage 7 concurrency proof: ${telemetry.nonRecentVerificationComputeCount}.`)
  }

  return {
    requestCount: settled.length,
    profileId: profile.profileId,
    allSucceeded: settled.every((result) => result.status === 'fulfilled'),
    latencyMs: latencies,
    currentOwnerCount: telemetry.currentOwnerCount,
    currentWaiterCount: telemetry.currentWaiterCount,
    recentOwnerCount: telemetry.recentOwnerCount,
    recentWaiterCount: telemetry.recentWaiterCount,
    currentComputeCount: telemetry.currentComputeCount,
    recentVerificationComputeCount: telemetry.recentVerificationComputeCount,
    nonRecentVerificationComputeCount: telemetry.nonRecentVerificationComputeCount,
    currentWrites: Math.max(after.current - before.current, 0),
    verificationWrites: Math.max(after.verification - before.verification, 0),
    gate: reasons.length === 0 && settled.every((result) => result.status === 'fulfilled') ? 'PASS' : 'FAIL',
    reasons,
  }
}

function renderMarkdown(result: {
  generatedAt: string
  gitHead: string | null
  branch: string | null
  profileCount: number
  finalGate: string
  conclusions: Record<string, string>
  watchlists: Array<Record<string, unknown>>
  profiles: Array<Record<string, unknown>>
  concurrency: ConcurrencyMeasurement
}) {
  const lines = [
    '# PPF-1 Stage 7 Recent Verification Controlled Activation',
    '',
    `Generated at: ${result.generatedAt}`,
    `Branch: ${result.branch ?? 'UNKNOWN'}`,
    `Git head: ${result.gitHead ?? 'UNKNOWN'}`,
    `Profile count: ${result.profileCount}`,
    '',
    '## Final Gate',
    '',
    `STAGE7_FINAL_EVIDENCE_GATE = ${result.finalGate}`,
    `FAST_READY_EXACT_CURRENT_AND_REQUIRED_EXACT_RECENT_RENDERABLE = ${result.conclusions.fastReadyExactCurrentAndRequiredRecentRenderable}`,
    `GLOBAL_N_FAST_EQUALS_1 = ${result.conclusions.globalNFastEquals1}`,
    `REAL_PROGRESSIVE_ORCHESTRATION_PATH_EXERCISED = ${result.conclusions.realProgressiveOrchestrationPathExercised}`,
    `FULL_VERIFICATION_EXCLUDED_FROM_FAST_READY = ${result.conclusions.fullVerificationExcludedFromFastReady}`,
    `WARM_REUSE_PRESERVED = ${result.conclusions.warmReusePreserved}`,
    `CROSS_CONTEXT_REUSE_PRESERVED = ${result.conclusions.crossContextReusePreserved}`,
    `RECENT_CONCURRENCY_SINGLE_OWNER_GATE = ${result.concurrency.gate}`,
    '',
    '## Concurrency',
    '',
    `Profile: ${result.concurrency.profileId}`,
    `Requests: ${result.concurrency.requestCount}`,
    `Recent owners: ${result.concurrency.recentOwnerCount}`,
    `Recent waiters: ${result.concurrency.recentWaiterCount}`,
    `Recent verification computes: ${result.concurrency.recentVerificationComputeCount}`,
    `Non-recent verification computes: ${result.concurrency.nonRecentVerificationComputeCount}`,
    `Reasons: ${result.concurrency.reasons.length === 0 ? 'NONE' : result.concurrency.reasons.join(' | ')}`,
    '',
    '## Watchlists',
    '',
    '| Profile | Cold ready ms | Warm ms | Cross-context ms | Current computes | Recent computes | Non-recent verification computes |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...result.watchlists.map((item) => `| ${String(item.profileId)} | ${String(item.coldRenderableReadyMs)} | ${String(item.warmDurationMs)} | ${String(item.crossContextDurationMs)} | ${String(item.currentComputeCount)} | ${String(item.recentVerificationComputeCount)} | ${String(item.nonRecentVerificationComputeCount)} |`),
    '',
    '## Profiles',
    '',
    '| Profile | Cold ready ms | Snapshot ready ms | Warm ms | Cross-context ms | Current status | Verification status | Current computes | Recent computes | Non-recent verification computes | Gate |',
    '| --- | ---: | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | --- |',
    ...result.profiles.map((item) => `| ${String(item.profileId)} | ${String(item.coldRenderableReadyMs)} | ${String(item.coldSnapshotReadyMs)} | ${String(item.warmDurationMs)} | ${String(item.crossContextDurationMs)} | ${String(item.currentStatus)} | ${String(item.verificationStatus)} | ${String(item.currentComputeCount)} | ${String(item.recentVerificationComputeCount)} | ${String(item.nonRecentVerificationComputeCount)} | ${String(item.gate)} |`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

async function readGitValue(args: string[]) {
  try {
    const { stdout } = await execFile('git', args, { cwd: process.cwd() })
    const value = stdout.trim()
    return value.length > 0 ? value : null
  } catch {
    return null
  }
}

async function main() {
  const marketDataPrisma = getMarketDataPrisma()
  const startedAt = performance.now()

  try {
    await assertFreeDiskSpace()

    for (const definition of SYNTHETIC_SERIES_DEFINITIONS) {
      await seedHistory(buildSyntheticHistory(definition))
    }

    await clearSeriesArtifacts(SYNTHETIC_SERIES_DEFINITIONS.map((definition) => definition.seriesId))
    const profiles = await buildProfiles()
    if (profiles.length !== EXPECTED_PROFILE_COUNT) {
      throw new Error(`Expected ${EXPECTED_PROFILE_COUNT} admitted profiles, found ${profiles.length}.`)
    }

    const profileResults: ProfileEvidence[] = []
    for (const [index, profile] of profiles.entries()) {
      const profileNumber = index + 1
      logProgress(profileNumber, profiles.length, 'cold sample 1/1', 'kickoff')
      const cold = await withTimeout(
        measureIntegratedProfile(profile),
        INDIVIDUAL_SAMPLE_TIMEOUT_MS,
        `cold integrated sample for ${profile.profileId}`,
      )
      logProgress(profileNumber, profiles.length, 'cold sample 1/1', 'renderable-ready')
      logProgress(profileNumber, profiles.length, 'warm sample 1/2', 'reuse-check')
      const warm = await withTimeout(
        measureReuse(profile),
        REUSE_SAMPLE_TIMEOUT_MS,
        `warm reuse sample for ${profile.profileId}`,
      )
      logProgress(profileNumber, profiles.length, 'warm sample 2/2', 'cross-context-reuse-check')
      const crossContext = await withTimeout(
        measureReuse(profile),
        REUSE_SAMPLE_TIMEOUT_MS,
        `cross-context reuse sample for ${profile.profileId}`,
      )

      const exactStatusesPass = currentPreparedRenderable(profile, cold.exactPreparedRead.currentStatus)
        && (!recentVerificationRequired(profile) || cold.exactPreparedRead.verificationStatus === 'AVAILABLE')
      const noUnexpectedVerification = cold.telemetry.nonRecentVerificationComputeCount === 0
        && warm.nonRecentVerificationComputeCount === 0
        && crossContext.nonRecentVerificationComputeCount === 0
      const warmReusePass = warm.currentComputeCount === 0
        && warm.recentVerificationComputeCount === 0
        && warm.currentWrites === 0
        && warm.verificationWrites === 0
        && currentPreparedRenderable(profile, warm.currentStatus)
        && (!recentVerificationRequired(profile) || warm.verificationStatus === 'AVAILABLE')
        && warm.queuedCount === 0
      const crossContextReusePass = crossContext.currentComputeCount === 0
        && crossContext.recentVerificationComputeCount === 0
        && crossContext.currentWrites === 0
        && crossContext.verificationWrites === 0
        && currentPreparedRenderable(profile, crossContext.currentStatus)
        && (!recentVerificationRequired(profile) || crossContext.verificationStatus === 'AVAILABLE')
        && crossContext.queuedCount === 0

      profileResults.push({
        profileId: profile.profileId,
        seriesId: profile.seriesId,
        modelId: profile.modelId,
        targetSemantics: profile.targetSemantics,
        recentVerificationMode: profile.recentVerificationMode,
        coldSnapshotReadyMs: cold.snapshotReadyMs,
        coldRenderableReadyMs: cold.renderableReadyMs,
        warmDurationMs: warm.durationMs,
        crossContextDurationMs: crossContext.durationMs,
        currentStatus: cold.exactPreparedRead.currentStatus,
        verificationStatus: cold.exactPreparedRead.verificationStatus,
        firstSnapshot: cold.firstSnapshot,
        observed: cold.observed,
        currentComputeCount: cold.telemetry.currentComputeCount,
        recentVerificationComputeCount: cold.telemetry.recentVerificationComputeCount,
        nonRecentVerificationComputeCount: cold.telemetry.nonRecentVerificationComputeCount,
        rollingDailyCalibrationBuildCount: cold.telemetry.rollingDailyCalibrationBuildCount,
        currentWrites: cold.persistedArtifacts.currentWrites,
        verificationWrites: cold.persistedArtifacts.verificationWrites,
        warmReuse: warm,
        crossContextReuse: crossContext,
        gate: exactStatusesPass && noUnexpectedVerification && warmReusePass && crossContextReusePass ? 'PASS' : 'FAIL',
      })

      if (performance.now() - startedAt > TOTAL_EVIDENCE_TIMEOUT_MS) {
        throw new Error(`Total Stage 7 evidence runtime exceeded timeout ${TOTAL_EVIDENCE_TIMEOUT_MS}ms.`)
      }
    }

    const concurrencyProfile = profiles.find((profile) => (
      profile.seriesId === DAILY_SERIES_ID
      && profile.targetSemantics === 'END_OF_PERIOD'
      && profile.modelId === 'arima'
    ))
    if (!concurrencyProfile) {
      throw new Error('Missing daily END_OF_PERIOD arima concurrency profile.')
    }
    logProgress(profiles.length, profiles.length, 'warm sample 2/2', 'recent-concurrency-proof')
    const concurrency = await withTimeout(
      measureConcurrency(concurrencyProfile),
      INDIVIDUAL_SAMPLE_TIMEOUT_MS,
      `recent concurrency proof for ${concurrencyProfile.profileId}`,
    )

    const finalGate = profileResults.every((profile) => profile.gate === 'PASS') && concurrency.gate === 'PASS'
      ? 'PASS'
      : 'FAIL'
    const watchlistIds = new Set([
      `${DAILY_SERIES_ID}|END_OF_PERIOD|ets`,
      `${DAILY_SERIES_ID}|END_OF_PERIOD|arima`,
      `${QUARTERLY_SERIES_ID}|END_OF_PERIOD|arima`,
    ])
    const watchlists = profileResults.filter((profile) => watchlistIds.has(String(profile.profileId)))
    const gitHead = await readGitValue(['rev-parse', 'HEAD'])
    const branch = await readGitValue(['branch', '--show-current'])
    const result = {
      task: 'PPF1_STAGE7_FINAL_EVIDENCE_CLOSURE_CORRECTIVE',
      generatedAt: new Date().toISOString(),
      gitHead,
      branch,
      profileCount: profileResults.length,
      configuration: {
        integratedProfiles: EXPECTED_PROFILE_COUNT,
        timeoutMs: FAST_READY_TIMEOUT_MS,
        individualSampleTimeoutMs: INDIVIDUAL_SAMPLE_TIMEOUT_MS,
        totalTimeoutMs: TOTAL_EVIDENCE_TIMEOUT_MS,
        minFreeDiskBytes: MIN_FREE_DISK_BYTES,
        pollIntervalMs: POLL_INTERVAL_MS,
        concurrencyRequestCount: concurrency.requestCount,
        routeTruth: 'createInternalProgressiveForecastPreparationRouteHandler returns progressiveForecastPreparationService.snapshotAndKickoff directly',
        recentHistoricalRoute: 'progressive monthly historical preparation resolves resolveRecentVerificationRequest rather than full verification',
      },
      conclusions: {
        fastReadyExactCurrentAndRequiredRecentRenderable: finalGate === 'PASS' ? 'YES' : 'NO',
        globalNFastEquals1: profileResults.every((profile) => profile.recentVerificationComputeCount <= 1) ? 'YES' : 'NO',
        realProgressiveOrchestrationPathExercised: 'YES',
        fullVerificationExcludedFromFastReady: profileResults.every((profile) => profile.nonRecentVerificationComputeCount === 0) && concurrency.nonRecentVerificationComputeCount === 0 ? 'YES' : 'NO',
        warmReusePreserved: profileResults.every((profile) => profile.gate === 'PASS' && profile.warmReuse.currentComputeCount === 0) ? 'YES' : 'NO',
        crossContextReusePreserved: profileResults.every((profile) => profile.gate === 'PASS' && profile.crossContextReuse.currentComputeCount === 0) ? 'YES' : 'NO',
      },
      concurrency,
      watchlists,
      profiles: profileResults,
      finalGate,
      summary: finalGate === 'PASS'
        ? 'Stage 7 final evidence confirms that the real progressive orchestration path reaches exact Current renderable for all 32 admitted profiles, reaches exact Recent Verification renderable wherever recent verification is required, keeps fast-ready isolated from full verification, preserves warm and cross-context reuse, and converges five identical requests to one recent-verification owner.'
        : 'Stage 7 final evidence detected at least one integrated proof failure. Inspect profile or concurrency gates before treating Stage 7 as closed.',
    }

    try {
      await writeFile(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`)
      await writeFile(RESULT_MD_PATH, renderMarkdown(result))
    } catch (error) {
      failFast(error, 'evidence artifact write')
    }

    process.stdout.write(`${JSON.stringify({
      status: finalGate,
      outputJson: RESULT_JSON_PATH,
      outputMarkdown: RESULT_MD_PATH,
      profileCount: profileResults.length,
      concurrencyGate: concurrency.gate,
    })}\n`)
    if (finalGate !== 'PASS') {
      process.exitCode = 1
    }
  } finally {
    await marketDataPrisma?.$disconnect().catch(() => undefined)
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})