import './load-env'

import { execFile as execFileCallback } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import path from 'node:path'
import { promisify } from 'node:util'

import { Prisma } from '@/generated/market-data-client'
import { resolveForecastTechnicalMinimumObservations } from '@/lib/forecast/current-fast-policy'
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
  type ProfiledPhaseName,
  classifyDominantBottleneck,
  NOT_SEPARATELY_MEASURABLE,
  resolveConservativeLatencyMs,
  resolveFastReadyProfilerGate,
  resolveRollingDailyExactReadGate,
  resolveWarmReuseGate,
  resolveGlobalNFastDecision,
  summarizeNumericSamples,
  summarizeOptionalPhaseSamples,
} from '@/lib/forecast/fast-ready-profiler'
import {
  createInteractiveForecastPreparationService,
  type InteractiveForecastIdentity,
} from '@/lib/forecast/interactive-preparation'
import { buildForecastHistoryFingerprint } from '@/lib/forecast/history-fingerprint'
import {
  buildForecastArtifactCadenceIdentity,
  createCurrentForecastStatisticalCompatibility,
  resolveForecastMethodContract,
} from '@/lib/forecast/identity'
import {
  buildLiveForecastBridgePayloadFromHistory,
  buildCurrentForecastExecutionPlan,
  selectMinimalLawfulCurrentTrainingPayload,
} from '@/lib/forecast/live-market-input'
import { selectMinimalLawfulCurrentTrainingSuffix } from '@/lib/forecast/current-fast-policy'
import { buildRollingDailyHistoryFingerprint } from '@/lib/forecast/rolling-daily-maintenance'
import { readRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import {
  createForecastLibraryService,
  executePreparedForecastBridge,
  type ForecastServiceRequest,
  readCurrentRunFromPrisma,
} from '@/lib/forecast/service'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import { resolveBenchmarkHistoricalSeries } from '@/lib/market-data/service'

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
  'ppf1-stage6-fast-ready-profiler.json',
)
const RESULT_MD_PATH = path.resolve(
  process.cwd(),
  '..',
  '..',
  'tooling',
  'Benchmark-Forecasting',
  'validation',
  'ppf1-stage6-fast-ready-profiler.md',
)

const DEFAULT_COLD_SAMPLES = 5
const DEFAULT_WARM_SAMPLES = 20
const DEFAULT_RECENT_CANDIDATES = [1, 3, 6, 12] as const
const FAST_READY_BUDGET_MS = 15_000
const MACROBOND_PROVIDER_CODE = 'MACROBOND'
const DAILY_SERIES_ID = 'ppf1-stage6-daily-profile-v1'
const WEEKLY_SERIES_ID = 'ppf1-stage6-weekly-profile-v1'
const MONTHLY_SERIES_ID = 'ppf1-stage6-monthly-profile-v1'
const QUARTERLY_SERIES_ID = 'ppf1-stage6-quarterly-profile-v1'
const SEMIANNUAL_SERIES_ID = 'ppf1-stage6-semiannual-profile-v1'

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

type CurrentSample = {
  prepareStatus: string
  exactReadStatus: string
  exactReadGate: 'PASS' | 'FAIL'
  ownerAcquiredCount: number
  cacheStatus: string | null
  totalRenderableReadyMs: number
  exactReadMs: number
  phases: Partial<Record<ProfiledPhaseName, number | null>>
  runtimeSeconds: number | null
  policyId: string | null
  effectivePolicyId: string | null
}

type WarmSample = {
  prepareStatus: string
  durationMs: number
  modelComputeCount: number
  bridgeCurrentComputeCount: number
  newExecutionCount: number
  newArtifactWriteCount: number
  warmReuseGate: 'PASS' | 'FAIL'
  warmReuseReason: string | null
}

type SyntheticSeriesHistory = ReturnType<typeof buildDailyHistory>

type FullVerificationMeasurement = {
  status: 'MEASURED' | 'INSUFFICIENT_ORIGIN_DIAGNOSTIC'
  measurementMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN'
  selectedOriginDates: string[]
  originCount: number
  originSamples: Array<{
    forecastOrigin: string
    totalWallMs: number
    runtimeSeconds: number | null
    selectedObservationCount: number
    extendedBeyondDefaultWindow: boolean
  }>
  measuredCandidates: Array<{
    candidateN: number
    recentVerificationMs: number
    currentConservativeMs: number
    reservedServingOverheadMs: number
    estimatedTotalFastReadyMs: number
    within15s: boolean
    selectedOriginDates: string[]
  }>
  maxInlineCandidate: number
  measuredServingHeadroomMs: number
  reason: string | null
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

function roundMs(value: number) {
  return Number(value.toFixed(3))
}

function readIntArg(flag: string, fallback: number) {
  const rawValue = process.argv.find((argument) => argument.startsWith(`${flag}=`))
  if (!rawValue) {
    return fallback
  }

  const parsed = Number.parseInt(rawValue.slice(flag.length + 1), 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`)
  }
  return parsed
}

function readCandidateNs() {
  const rawValue = process.argv.find((argument) => argument.startsWith('--recent-candidates='))
  if (!rawValue) {
    return [...DEFAULT_RECENT_CANDIDATES]
  }

  const parsed = rawValue
    .slice('--recent-candidates='.length)
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0)

  if (parsed.length === 0) {
    throw new Error('--recent-candidates must contain at least one positive integer.')
  }

  return Array.from(new Set(parsed)).sort((left, right) => left - right)
}

function readPassFailArg(flag: string, fallback: 'PASS' | 'FAIL' = 'FAIL') {
  const rawValue = process.argv.find((argument) => argument.startsWith(`${flag}=`))
  if (!rawValue) {
    return fallback
  }

  const value = rawValue.slice(flag.length + 1).trim().toUpperCase()
  if (value !== 'PASS' && value !== 'FAIL') {
    throw new Error(`${flag} must be PASS or FAIL.`)
  }

  return value
}

function readStringArg(flag: string) {
  const rawValue = process.argv.find((argument) => argument.startsWith(`${flag}=`))
  if (!rawValue) {
    return null
  }

  const value = rawValue.slice(flag.length + 1).trim()
  return value.length > 0 ? value : null
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
    source: 'PPF1_STAGE6_PROFILER_SEED',
    historical,
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
    source: 'PPF1_STAGE6_PROFILER_SEED',
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
      version: 'ppf1-stage6-synthetic-provenance-v1',
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
        version: 'ppf1-stage6-synthetic-provenance-v1',
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

async function clearProfilerArtifacts(seriesIds: readonly string[]) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

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
}

async function clearProfilerProfileArtifacts(profile: ProfilerProfile) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const method = resolveForecastMethodContract(profile.targetBasis)

  await prisma.$transaction(async (tx) => {
    await tx.rollingDailyCurrentForecastSnapshot.deleteMany({
      where: {
        seriesId: profile.seriesId,
        modelId: profile.modelId,
        targetBasis: profile.targetBasis,
        methodId: method.methodId,
        methodVersion: method.methodVersion,
      },
    })
    await tx.forecastVerificationRun.deleteMany({
      where: {
        seriesId: profile.seriesId,
        modelId: profile.modelId,
        targetBasis: profile.targetBasis,
        methodId: method.methodId,
        methodVersion: method.methodVersion,
      },
    })
    await tx.forecastCurrentRun.deleteMany({
      where: {
        seriesId: profile.seriesId,
        modelId: profile.modelId,
        targetBasis: profile.targetBasis,
        methodId: method.methodId,
        methodVersion: method.methodVersion,
      },
    })
    await tx.forecastPreparationExecutionLedger.deleteMany({
      where: {
        seriesId: profile.seriesId,
        modelId: profile.modelId,
        targetBasis: profile.targetBasis,
        targetSemantics: profile.targetSemantics,
        methodId: method.methodId,
        methodVersion: method.methodVersion,
      },
    })
  })
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

function buildServiceRequest(profile: ProfilerProfile): ForecastServiceRequest {
  return {
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    targetBasis: profile.targetBasis,
    sourceFrequency: profile.sourceFrequency,
    targetCadence: profile.targetCadence,
  }
}

function buildInteractiveIdentity(profile: ProfilerProfile): InteractiveForecastIdentity {
  return {
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    targetSemantics: profile.targetSemantics,
  }
}

function requireAvailableCurrent(result: BenchmarkForecastCurrentResult, profile: ProfilerProfile) {
  if (result.status !== 'AVAILABLE') {
    throw new Error(`Current read failed for ${profile.profileId}: ${result.reason}`)
  }
  return result
}

function requireAvailableVerification(result: BenchmarkForecastVerificationResult, profile: ProfilerProfile) {
  if (result.status !== 'AVAILABLE') {
    throw new Error(`Verification failed for ${profile.profileId}: ${result.reason}`)
  }
  return result
}

function findLatestNumericMetric(events: readonly RecorderEvent[], eventName: string, metricName: string) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const candidate = events[index]
    if (!candidate || candidate.event !== eventName) {
      continue
    }
    const value = candidate.metrics[metricName]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return null
}

function countEvents(
  events: readonly RecorderEvent[],
  eventName: string,
  predicate?: (event: RecorderEvent) => boolean,
) {
  return events.filter((event) => event.event === eventName && (predicate ? predicate(event) : true)).length
}

function sumNumericMetric(
  events: readonly RecorderEvent[],
  eventName: string,
  metricName: string,
  predicate?: (event: RecorderEvent) => boolean,
) {
  return events.reduce((sum, event) => {
    if (event.event !== eventName || (predicate && !predicate(event))) {
      return sum
    }
    const value = event.metrics[metricName]
    return typeof value === 'number' && Number.isFinite(value)
      ? sum + value
      : sum
  }, 0)
}

async function readRollingDailyPreparedCurrent(profile: ProfilerProfile) {
  const history = await resolveBenchmarkHistoricalSeries(profile.seriesId, 'ALL')
  const sourceHistoryFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: profile.seriesId,
    displayName: history.history.displayName,
    description: history.history.displayName,
    frequency: 'DAILY',
    source: history.history.source,
    points: history.history.historical,
  })
  const result = await readRollingDailyCurrentForecastSnapshot({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    sourceHistoryFingerprint,
  })

  if (result.status === 'MISS') {
    return result
  }

  return {
    status: result.status,
    cacheStatus: 'hit' as const,
    runtimeSeconds: null,
  }
}

async function readPeriodicPreparedCurrent(profile: ProfilerProfile) {
  const history = await resolveBenchmarkHistoricalSeries(profile.seriesId, 'ALL')
  const basePayload = buildLiveForecastBridgePayloadFromHistory(profile.seriesId, history.history, {
    targetBasis: profile.targetBasis,
    targetCadence: profile.targetCadence,
    continuityPolicy: profile.targetCadence === 'MONTHLY' ? 'ALLOW_GAPS' : 'REQUIRE_FULL',
  })
  const method = resolveForecastMethodContract(profile.targetBasis)
  const currentPayload = selectMinimalLawfulCurrentTrainingPayload(
    basePayload,
    resolveForecastTechnicalMinimumObservations({
      targetSemantics: profile.targetSemantics,
      modelId: profile.modelId,
    }),
  )
  const compatibility = createCurrentForecastStatisticalCompatibility({
    sourceFrequency: profile.sourceFrequency,
    targetCadence: profile.targetCadence,
    targetSemantics: method.targetSemantics,
  })
  const persisted = await readCurrentRunFromPrisma({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    targetSemantics: method.targetSemantics,
    methodId: method.methodId,
    methodVersion: method.methodVersion,
    inputSource: currentPayload.source.kind,
    historyFingerprint: buildForecastHistoryFingerprint({
      ...currentPayload.history,
      cadence: {
        sourceFrequency: profile.sourceFrequency,
        targetCadence: profile.targetCadence,
      },
    }),
    targetBasis: profile.targetBasis,
    frequencyIdentity: buildForecastArtifactCadenceIdentity({
      sourceFrequency: profile.sourceFrequency,
      targetCadence: profile.targetCadence,
    }),
    trainingWindowPolicyId: compatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: compatibility.effectiveTrainingPolicyId,
  })

  if (!persisted) {
    throw new Error(`Prepared Current artifact is missing for ${profile.profileId}.`)
  }

  return {
    status: 'AVAILABLE' as const,
    cacheStatus: 'hit' as const,
    runtimeSeconds: persisted.runtimeSeconds,
    lineage: {
      statisticalCompatibility: persisted.statisticalCompatibility,
    },
  }
}

async function measurePeriodicPreparationSurface(profile: ProfilerProfile) {
  const historyLoadStartedAt = performance.now()
  const history = await resolveBenchmarkHistoricalSeries(profile.seriesId, 'ALL')
  const historyLoadMs = performance.now() - historyLoadStartedAt

  const historyPreparationStartedAt = performance.now()
  const payload = buildLiveForecastBridgePayloadFromHistory(profile.seriesId, history.history, {
    targetBasis: profile.targetBasis,
    targetCadence: profile.targetCadence,
    continuityPolicy: profile.targetCadence === 'MONTHLY' ? 'ALLOW_GAPS' : 'REQUIRE_FULL',
  })
  const historyPreparationMs = performance.now() - historyPreparationStartedAt

  const fastSuffixStartedAt = performance.now()
  selectMinimalLawfulCurrentTrainingPayload(
    payload,
    resolveForecastTechnicalMinimumObservations({
      targetSemantics: profile.targetSemantics,
      modelId: profile.modelId,
    }),
  )
  const fastSuffixSelectionMs = performance.now() - fastSuffixStartedAt

  return {
    historyLoadMs: roundMs(historyLoadMs),
    historyPreparationMs: roundMs(historyPreparationMs),
    fastSuffixSelectionMs: roundMs(fastSuffixSelectionMs),
  }
}

async function measureCurrentSamples(
  profile: ProfilerProfile,
  coldSampleCount: number,
  warmSampleCount: number,
) {
  const recorder = new TelemetryRecorder()
  const libraryService = createForecastLibraryService({
    telemetry: recorder,
    logEvent: (event, metrics) => recorder.log(event, metrics),
  })
  const interactiveService = createInteractiveForecastPreparationService({
    resolveExactCapability: profilerCapabilityService.resolveExact,
    prepareMonthlyCurrent: (input) => libraryService.resolveCurrentForecastRequest(input),
  })

  const identity = buildInteractiveIdentity(profile)
  const request = buildServiceRequest(profile)
  const coldSamples: CurrentSample[] = []
  const warmSamples: WarmSample[] = []

  for (let index = 0; index < coldSampleCount; index += 1) {
    await clearProfilerProfileArtifacts(profile)

    const capability = await interactiveService.capability(identity)
    const periodicSurface = profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? null
      : await measurePeriodicPreparationSurface(profile)

    recorder.drain()

    const prepareStartedAt = performance.now()
    const preparation = await interactiveService.prepareCurrent(identity)
    const prepareMs = performance.now() - prepareStartedAt
    const currentEvents = recorder.drain()
    const ownerAcquiredCount = countEvents(
      currentEvents,
      'FORECAST_PREPARATION_EXECUTION_LEDGER',
      (event) => event.kind === 'log' && event.metrics.eventType === 'single_flight_owner_acquired',
    )

    if (!['READY', 'REUSED'].includes(preparation.status)) {
      throw new Error(`Current preparation failed for ${profile.profileId}: ${preparation.status} ${preparation.reason ?? ''}`.trim())
    }

    if (profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') {
      const exactReadStartedAt = performance.now()
      const exactRead = await readRollingDailyPreparedCurrent(profile)
      const exactReadMs = performance.now() - exactReadStartedAt
      if (exactRead.status !== 'HIT' && exactRead.status !== 'STALE') {
        throw new Error(`Rolling Daily prepared read failed for ${profile.profileId}: ${exactRead.status}`)
      }
      const exactReadGate = resolveRollingDailyExactReadGate(exactRead.status)
      const rollingDailyCompatibility = createCurrentForecastStatisticalCompatibility({
        sourceFrequency: 'DAILY',
        targetCadence: 'DAILY',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      })
      coldSamples.push({
        prepareStatus: preparation.status,
        exactReadStatus: exactRead.status,
        exactReadGate: exactReadGate.status,
        ownerAcquiredCount,
        cacheStatus: exactRead.cacheStatus,
        totalRenderableReadyMs: roundMs(prepareMs + exactReadMs),
        exactReadMs: roundMs(exactReadMs),
        phases: {
          CAPABILITY_RESOLUTION_MS: capability.trace?.capabilityTotalMs ?? capability.timingMs,
          HISTORY_LOAD_MS: null,
          HISTORY_PREPARATION_MS: null,
          FAST_SUFFIX_SELECTION_MS: null,
          PREPARED_LOOKUP_MS: roundMs(exactReadMs),
          EXECUTION_ADMISSION_MS: null,
          OWNER_WAIT_MS: null,
          MODEL_BRIDGE_MS: null,
          MODEL_COMPUTE_MS: exactRead.runtimeSeconds === null ? null : roundMs(exactRead.runtimeSeconds * 1000),
          PERSISTENCE_MS: null,
          POST_PERSIST_EXACT_READ_MS: roundMs(exactReadMs),
          CONSUMER_ADAPTER_MS: null,
          TOTAL_RENDERABLE_READY_MS: roundMs(prepareMs + exactReadMs),
          ROLLING_DAILY_OWNERSHIP_PREPARATION_MS: capability.timingMs,
          ROLLING_DAILY_SNAPSHOT_PERSIST_MS: null,
        },
        runtimeSeconds: exactRead.runtimeSeconds,
        policyId: rollingDailyCompatibility.trainingWindowPolicyId,
        effectivePolicyId: rollingDailyCompatibility.effectiveTrainingPolicyId,
      })
    } else {
      const exactReadStartedAt = performance.now()
      const exactRead = await readPeriodicPreparedCurrent(profile)
      const exactReadMs = performance.now() - exactReadStartedAt
      const computeDurationMs = findLatestNumericMetric(currentEvents, 'current_compute_end', 'durationMs')
      const persistenceDurationMs = findLatestNumericMetric(currentEvents, 'persistence', 'durationMs')
      const runtimeMs = exactRead.runtimeSeconds === null ? null : roundMs(exactRead.runtimeSeconds * 1000)

      coldSamples.push({
        prepareStatus: preparation.status,
        exactReadStatus: exactRead.status,
        exactReadGate: 'PASS',
        ownerAcquiredCount,
        cacheStatus: exactRead.cacheStatus,
        totalRenderableReadyMs: roundMs(prepareMs + exactReadMs),
        exactReadMs: roundMs(exactReadMs),
        phases: {
          CAPABILITY_RESOLUTION_MS: capability.trace?.capabilityTotalMs ?? capability.timingMs,
          HISTORY_LOAD_MS: periodicSurface?.historyLoadMs ?? null,
          HISTORY_PREPARATION_MS: periodicSurface?.historyPreparationMs ?? null,
          FAST_SUFFIX_SELECTION_MS: periodicSurface?.fastSuffixSelectionMs ?? null,
          PREPARED_LOOKUP_MS: roundMs(exactReadMs),
          EXECUTION_ADMISSION_MS: null,
          OWNER_WAIT_MS: null,
          MODEL_BRIDGE_MS: computeDurationMs !== null && runtimeMs !== null
            ? roundMs(Math.max(computeDurationMs - runtimeMs, 0))
            : null,
          MODEL_COMPUTE_MS: runtimeMs,
          PERSISTENCE_MS: persistenceDurationMs === null ? null : roundMs(persistenceDurationMs),
          POST_PERSIST_EXACT_READ_MS: roundMs(exactReadMs),
          CONSUMER_ADAPTER_MS: null,
          TOTAL_RENDERABLE_READY_MS: roundMs(prepareMs + exactReadMs),
        },
        runtimeSeconds: exactRead.runtimeSeconds,
        policyId: exactRead.lineage.statisticalCompatibility.trainingWindowPolicyId,
        effectivePolicyId: exactRead.lineage.statisticalCompatibility.effectiveTrainingPolicyId,
      })
    }
  }

  for (let index = 0; index < warmSampleCount; index += 1) {
    recorder.drain()
    const warmStartedAt = performance.now()
    const warmPreparation = await interactiveService.prepareCurrent(identity)
    const warmDurationMs = performance.now() - warmStartedAt
    const warmEvents = recorder.drain()

    if (warmPreparation.status !== 'REUSED') {
      throw new Error(`Warm Current preparation did not reuse prepared state for ${profile.profileId}: ${warmPreparation.status} ${warmPreparation.reason ?? ''}`.trim())
    }

    const warmReuseGate = resolveWarmReuseGate({
      modelComputeCount: sumNumericMetric(warmEvents, 'model_fit', 'count', (event) => event.kind === 'telemetry' && event.metrics.operation === 'current'),
      bridgeCurrentComputeCount: countEvents(warmEvents, 'current_compute_end', (event) => event.kind === 'telemetry'),
      newExecutionCount: countEvents(
        warmEvents,
        'FORECAST_PREPARATION_EXECUTION_LEDGER',
        (event) => event.kind === 'log' && event.metrics.eventType === 'single_flight_owner_acquired',
      ),
      newArtifactWriteCount: sumNumericMetric(
        warmEvents,
        'persistence',
        'artifactWrites',
        (event) => event.kind === 'telemetry' && event.metrics.operation === 'current',
      ),
    })

    warmSamples.push({
      prepareStatus: warmPreparation.status,
      durationMs: roundMs(warmDurationMs),
      modelComputeCount: sumNumericMetric(warmEvents, 'model_fit', 'count', (event) => event.kind === 'telemetry' && event.metrics.operation === 'current'),
      bridgeCurrentComputeCount: countEvents(warmEvents, 'current_compute_end', (event) => event.kind === 'telemetry'),
      newExecutionCount: countEvents(
        warmEvents,
        'FORECAST_PREPARATION_EXECUTION_LEDGER',
        (event) => event.kind === 'log' && event.metrics.eventType === 'single_flight_owner_acquired',
      ),
      newArtifactWriteCount: sumNumericMetric(
        warmEvents,
        'persistence',
        'artifactWrites',
        (event) => event.kind === 'telemetry' && event.metrics.operation === 'current',
      ),
      warmReuseGate: warmReuseGate.status,
      warmReuseReason: warmReuseGate.reason,
    })
  }

  return {
    coldSamples,
    warmSamples,
  }
}

async function measureFullVerification(
  profile: ProfilerProfile,
  candidateNs: readonly number[],
  currentConservativeMs: number,
) {
  const history = await resolveBenchmarkHistoricalSeries(profile.seriesId, 'ALL')
  const basePayload = buildLiveForecastBridgePayloadFromHistory(profile.seriesId, history.history, {
    targetBasis: profile.targetBasis,
    targetCadence: profile.targetCadence,
    continuityPolicy: profile.targetCadence === 'MONTHLY' ? 'ALLOW_GAPS' : 'REQUIRE_FULL',
  })
  const latestHistoricalDate = basePayload.history.end
  const maxCandidateN = Math.max(...candidateNs)
  const eligibleOrigins = basePayload.history.points
    .slice(0, -1)
    .filter((point) => {
      const plan = buildCurrentForecastExecutionPlan(point.date, profile.targetCadence)
      const farthestTargetDate = plan.currentTargetDates['12M']
      return typeof farthestTargetDate === 'string' && farthestTargetDate <= latestHistoricalDate
    })

  if (eligibleOrigins.length === 0) {
    return {
      status: 'INSUFFICIENT_ORIGIN_DIAGNOSTIC',
      measurementMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
      selectedOriginDates: [],
      originCount: 0,
      originSamples: [],
      measuredCandidates: [],
      maxInlineCandidate: 0,
      measuredServingHeadroomMs: 0,
      reason: 'No matured historical origins were available for direct same-policy Recent profiling.',
    } satisfies FullVerificationMeasurement
  }

  const selectedOrigins = eligibleOrigins.slice(-maxCandidateN).reverse()
  const minimumRequiredObservations = resolveForecastTechnicalMinimumObservations({
    targetSemantics: profile.targetSemantics,
    modelId: profile.modelId,
  })

  const originSamples: FullVerificationMeasurement['originSamples'] = []
  for (const origin of selectedOrigins) {
    const selection = selectMinimalLawfulCurrentTrainingSuffix({
      points: basePayload.history.points,
      forecastOrigin: origin.date,
      minimumRequiredObservations,
    })
    if (!selection.minimumRequirementSatisfied) {
      throw new Error(`Recent same-policy origin ${origin.date} does not satisfy the minimum training requirement for ${profile.profileId}.`)
    }

    const firstPoint = selection.points[0]
    const lastPoint = selection.points.at(-1)
    if (!firstPoint || !lastPoint) {
      throw new Error(`Recent same-policy origin ${origin.date} produced an empty training suffix for ${profile.profileId}.`)
    }

    const executionPlan = buildCurrentForecastExecutionPlan(origin.date, profile.targetCadence)
    const preparedPayload = {
      ...basePayload,
      benchmark: {
        ...basePayload.benchmark,
        expectedObservations: selection.points.length,
      },
      execution: {
        ...basePayload.execution,
        historicalPeriodStarts: selection.points.map((point) => point.date),
        horizons: executionPlan.horizons,
        currentTargetDates: executionPlan.currentTargetDates,
      },
      history: {
        ...basePayload.history,
        start: firstPoint.date,
        end: lastPoint.date,
        observations: selection.points.length,
        points: selection.points,
      },
    }

    const startedAt = performance.now()
    const bridgeResult = await executePreparedForecastBridge(preparedPayload, 'current', profile.seriesId, profile.modelId)
    const totalWallMs = performance.now() - startedAt
    if (bridgeResult.status !== 'AVAILABLE') {
      throw new Error(`Recent same-policy direct Current execution failed for ${profile.profileId} at origin ${origin.date}: ${bridgeResult.reason}`)
    }
    if (!('result' in bridgeResult)) {
      throw new Error(`Recent same-policy direct Current execution returned a non-current payload for ${profile.profileId} at origin ${origin.date}.`)
    }

    originSamples.push({
      forecastOrigin: origin.date,
      totalWallMs: roundMs(totalWallMs),
      runtimeSeconds: bridgeResult.result.runtimeSeconds,
      selectedObservationCount: selection.selectedObservationCount,
      extendedBeyondDefaultWindow: selection.extendedBeyondDefaultWindow,
    })
  }

  const measuredCandidates = candidateNs.map((candidateN) => {
    const candidateOrigins = originSamples.slice(0, candidateN)
    const recentVerificationMs = candidateOrigins.reduce((sum, sample) => sum + sample.totalWallMs, 0)
    const estimatedTotalFastReadyMs = currentConservativeMs + recentVerificationMs
    const measuredServingHeadroomMs = Math.max(FAST_READY_BUDGET_MS - estimatedTotalFastReadyMs, 0)
    return {
      candidateN,
      recentVerificationMs: roundMs(recentVerificationMs),
      currentConservativeMs: roundMs(currentConservativeMs),
      reservedServingOverheadMs: roundMs(measuredServingHeadroomMs),
      estimatedTotalFastReadyMs: roundMs(estimatedTotalFastReadyMs),
      within15s: estimatedTotalFastReadyMs <= FAST_READY_BUDGET_MS,
      selectedOriginDates: candidateOrigins.map((sample) => sample.forecastOrigin),
    }
  })
  const maxInlineCandidate = Math.max(0, ...measuredCandidates.filter((item) => item.within15s).map((item) => item.candidateN))
  const selectedHeadroom = maxInlineCandidate > 0
    ? measuredCandidates.find((item) => item.candidateN === maxInlineCandidate)?.reservedServingOverheadMs ?? 0
    : 0

  return {
    status: 'MEASURED',
    measurementMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
    selectedOriginDates: originSamples.map((sample) => sample.forecastOrigin),
    originCount: originSamples.length,
    originSamples,
    measuredCandidates,
    maxInlineCandidate,
    measuredServingHeadroomMs: roundMs(selectedHeadroom),
    reason: null,
  } satisfies FullVerificationMeasurement
}

function summarizeProfile(
  profile: ProfilerProfile,
  currentMeasurements: Awaited<ReturnType<typeof measureCurrentSamples>>,
  fullVerification: FullVerificationMeasurement | null,
  gateContext: {
    gitHead: string | null
    expectedSourceSha: string | null
    stage4NonRegression: 'PASS' | 'FAIL'
    stage5NonRegression: 'PASS' | 'FAIL'
  },
) {
  const totalRenderableReadySummary = summarizeNumericSamples(
    currentMeasurements.coldSamples.map((sample) => sample.totalRenderableReadyMs),
  )
  const exactReadSummary = summarizeNumericSamples(
    currentMeasurements.coldSamples.map((sample) => sample.exactReadMs),
  )
  const warmPreparedHitSummary = summarizeNumericSamples(currentMeasurements.warmSamples.map((sample) => sample.durationMs))

  const summarizePhase = (phase: ProfiledPhaseName) => summarizeOptionalPhaseSamples(
    currentMeasurements.coldSamples.map((sample) => sample.phases[phase] ?? null),
  )

  const phaseSummaries = {
    CAPABILITY_RESOLUTION_MS: summarizePhase('CAPABILITY_RESOLUTION_MS'),
    HISTORY_LOAD_MS: summarizePhase('HISTORY_LOAD_MS'),
    HISTORY_PREPARATION_MS: summarizePhase('HISTORY_PREPARATION_MS'),
    FAST_SUFFIX_SELECTION_MS: summarizePhase('FAST_SUFFIX_SELECTION_MS'),
    PREPARED_LOOKUP_MS: summarizePhase('PREPARED_LOOKUP_MS'),
    EXECUTION_ADMISSION_MS: summarizePhase('EXECUTION_ADMISSION_MS'),
    OWNER_WAIT_MS: summarizePhase('OWNER_WAIT_MS'),
    MODEL_BRIDGE_MS: summarizePhase('MODEL_BRIDGE_MS'),
    MODEL_COMPUTE_MS: summarizePhase('MODEL_COMPUTE_MS'),
    PERSISTENCE_MS: summarizePhase('PERSISTENCE_MS'),
    POST_PERSIST_EXACT_READ_MS: summarizePhase('POST_PERSIST_EXACT_READ_MS'),
    CONSUMER_ADAPTER_MS: summarizePhase('CONSUMER_ADAPTER_MS'),
    TOTAL_RENDERABLE_READY_MS: totalRenderableReadySummary,
    ROLLING_DAILY_OWNERSHIP_PREPARATION_MS: summarizePhase('ROLLING_DAILY_OWNERSHIP_PREPARATION_MS'),
    ROLLING_DAILY_SNAPSHOT_PERSIST_MS: summarizePhase('ROLLING_DAILY_SNAPSHOT_PERSIST_MS'),
  }

  const conservativePhaseSnapshot = Object.fromEntries(
    Object.entries(phaseSummaries).map(([phase, summary]) => {
      if (summary === NOT_SEPARATELY_MEASURABLE) {
        return [phase, null]
      }
      return [phase, resolveConservativeLatencyMs(summary)]
    }),
  ) as Partial<Record<ProfiledPhaseName, number | null>>

  const currentConservativeMs = resolveConservativeLatencyMs(totalRenderableReadySummary)
  const warmReuseGate = currentMeasurements.warmSamples.every((sample) => sample.warmReuseGate === 'PASS') ? 'PASS' : 'FAIL'
  const currentIsolationGate = currentMeasurements.coldSamples.every((sample) => sample.exactReadGate === 'PASS') ? 'PASS' : 'FAIL'
  const concurrentOneGlobalComputeGate = currentMeasurements.coldSamples.every((sample) => sample.ownerAcquiredCount <= 1) ? 'PASS' : 'FAIL'
  const recentProfileGate = fullVerification === null
    ? 'PASS'
    : fullVerification.status === 'MEASURED' && fullVerification.measuredCandidates.length > 0
      ? 'PASS'
      : 'FAIL'
  const reservedServingOverheadMs = fullVerification === null
    ? roundMs(Math.max(FAST_READY_BUDGET_MS - currentConservativeMs, 0))
    : fullVerification.measuredServingHeadroomMs
  const profileArtifactSourceShaMatch = gateContext.expectedSourceSha === null
    ? true
    : gateContext.gitHead === gateContext.expectedSourceSha
  const finalGateDecision = resolveFastReadyProfilerGate({
    currentFastLatencyGate: currentConservativeMs <= FAST_READY_BUDGET_MS ? 'PASS' : 'FAIL',
    warmReuseGate,
    concurrentOneGlobalComputeGate,
    currentIsolationGate,
    recentProfileGate,
    reservedServingOverheadMs,
    profileArtifactSourceShaMatch,
    stage5NonRegression: gateContext.stage5NonRegression,
    stage4NonRegression: gateContext.stage4NonRegression,
    currentFastPolicyChanged: false,
    stage7ScopeLeakage: false,
  })

  return {
    profileId: profile.profileId,
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    targetSemantics: profile.targetSemantics,
    targetBasis: profile.targetBasis,
    sourceFrequency: profile.sourceFrequency,
    targetCadence: profile.targetCadence,
    statisticalCompatibility: {
      trainingWindowPolicyId: currentMeasurements.coldSamples[0]?.policyId ?? null,
      effectiveTrainingPolicyId: currentMeasurements.coldSamples[0]?.effectivePolicyId ?? null,
    },
    coldCurrent: {
      sampleCount: currentMeasurements.coldSamples.length,
      statusesObserved: Array.from(new Set(currentMeasurements.coldSamples.map((sample) => sample.prepareStatus))),
      exactReadStatusesObserved: Array.from(new Set(currentMeasurements.coldSamples.map((sample) => sample.exactReadStatus))),
      ownerAcquiredCountsObserved: currentMeasurements.coldSamples.map((sample) => sample.ownerAcquiredCount),
      cacheStatusesObserved: Array.from(new Set(currentMeasurements.coldSamples.map((sample) => sample.cacheStatus).filter(Boolean))),
      totalRenderableReady: totalRenderableReadySummary,
      exactPreparedRead: exactReadSummary,
      warmPreparedHit: warmPreparedHitSummary,
      warmReuseStatusesObserved: Array.from(new Set(currentMeasurements.warmSamples.map((sample) => sample.warmReuseGate))),
      warmPrepareStatusesObserved: Array.from(new Set(currentMeasurements.warmSamples.map((sample) => sample.prepareStatus))),
      warmReuseProof: {
        modelComputeCount: Math.max(0, ...currentMeasurements.warmSamples.map((sample) => sample.modelComputeCount)),
        bridgeCurrentComputeCount: Math.max(0, ...currentMeasurements.warmSamples.map((sample) => sample.bridgeCurrentComputeCount)),
        newExecutionCount: Math.max(0, ...currentMeasurements.warmSamples.map((sample) => sample.newExecutionCount)),
        newArtifactWriteCount: Math.max(0, ...currentMeasurements.warmSamples.map((sample) => sample.newArtifactWriteCount)),
        status: warmReuseGate,
        reasons: currentMeasurements.warmSamples.map((sample) => sample.warmReuseReason).filter((reason): reason is string => Boolean(reason)),
      },
      phaseSummaries,
      dominantBottleneck: classifyDominantBottleneck(conservativePhaseSnapshot),
      conservativeLatencyMs: currentConservativeMs,
    },
    recentVerification: fullVerification === null
      ? {
          mode: 'NOT_APPLICABLE',
        }
      : {
          mode: fullVerification.measurementMode,
          directMeasurement: {
            status: fullVerification.status,
            measurementMode: fullVerification.measurementMode,
            selectedOriginDates: fullVerification.selectedOriginDates,
            originCount: fullVerification.originCount,
            originSamples: fullVerification.originSamples,
            measuredServingHeadroomMs: fullVerification.measuredServingHeadroomMs,
            reason: fullVerification.reason,
          },
          measuredCandidates: fullVerification.measuredCandidates,
          maxInlineCandidate: fullVerification.maxInlineCandidate,
        },
    finalGate: {
      currentFastLatencyGate: currentConservativeMs <= FAST_READY_BUDGET_MS ? 'PASS' : 'FAIL',
      warmReuseGate,
      concurrentOneGlobalComputeGate,
      currentIsolationGate,
      recentProfileGate,
      reservedServingOverheadMs,
      profileArtifactSourceShaMatch,
      stage4NonRegression: gateContext.stage4NonRegression,
      stage5NonRegression: gateContext.stage5NonRegression,
      currentFastPolicyChanged: false,
      stage7ScopeLeakage: false,
      fastReadyProfilerGate: finalGateDecision.fastReadyProfilerGate,
      performanceCorrectiveRequired: finalGateDecision.performanceCorrectiveRequired,
    },
  }
}

function renderMarkdown(result: {
  generatedAt: string
  gitHead: string | null
  branch: string | null
  evidence: {
    expectedSourceSha: string | null
  }
  regressions: {
    stage4NonRegression: 'PASS' | 'FAIL'
    stage5NonRegression: 'PASS' | 'FAIL'
  }
  configuration: {
    coldSamples: number
    warmSamples: number
    recentCandidates: readonly number[]
    fastReadyBudgetMs: number
  }
  profiles: ReturnType<typeof summarizeProfile>[]
  globalDecision: ReturnType<typeof resolveGlobalNFastDecision>
  finalGate: {
    fastReadyProfilerGate: 'PASS' | 'FAIL'
    performanceCorrectiveRequired: boolean
    profilesPassing: number
    profilesFailing: number
  }
}) {
  const lines = [
    '# PPF-1 Stage 6 FAST_READY Profiler',
    '',
    `Generated at: ${result.generatedAt}`,
    `Branch: ${result.branch ?? 'UNKNOWN'}`,
    `Git HEAD: ${result.gitHead ?? 'UNKNOWN'}`,
    `Expected source SHA: ${result.evidence.expectedSourceSha ?? 'UNSPECIFIED'}`,
    `Cold samples per profile: ${result.configuration.coldSamples}`,
    `Warm prepared-hit samples per profile: ${result.configuration.warmSamples}`,
    `Recent Verification candidates: ${result.configuration.recentCandidates.join(', ')}`,
    `FAST_READY budget: ${result.configuration.fastReadyBudgetMs} ms`,
    '',
    '## Final Gate',
    '',
    `FAST_READY profiler gate: ${result.finalGate.fastReadyProfilerGate}`,
    `Performance corrective required: ${result.finalGate.performanceCorrectiveRequired}`,
    `Profiles passing: ${result.finalGate.profilesPassing}`,
    `Profiles failing: ${result.finalGate.profilesFailing}`,
    `Stage 4 non-regression: ${result.regressions.stage4NonRegression}`,
    `Stage 5 non-regression: ${result.regressions.stage5NonRegression}`,
    '',
    '## Global Decision',
    '',
    `Recommendation: ${result.globalDecision.recommendation}`,
    `Global N_FAST: ${String(result.globalDecision.globalRecommendation)}`,
    `Profile-specific controls required: ${result.globalDecision.profileSpecificRequired}`,
    '',
    '## Profiles',
    '',
    '| Profile | Gate | Cold conservative ms | Warm hit p95/max ms | Dominant bottleneck | Max inline recent N |',
    '| --- | --- | ---: | ---: | --- | ---: |',
  ]

  for (const profile of result.profiles) {
    const warm = typeof profile.coldCurrent.warmPreparedHit.p95Ms === 'number'
      ? profile.coldCurrent.warmPreparedHit.p95Ms
      : profile.coldCurrent.warmPreparedHit.maxMs
    const maxInline = profile.recentVerification.mode === 'NOT_APPLICABLE'
      ? 'N/A'
      : String(profile.recentVerification.maxInlineCandidate)
    lines.push(
      `| ${profile.profileId} | ${profile.finalGate.fastReadyProfilerGate} | ${profile.coldCurrent.conservativeLatencyMs} | ${warm} | ${profile.coldCurrent.dominantBottleneck.category} | ${maxInline} |`,
    )
  }

  lines.push('', '## Notes', '')
  lines.push('- Period Current uses exact SG Runtime Current preparation plus exact prepared-read confirmation.')
  lines.push('- Rolling Daily phase gaps remain explicitly marked as NOT_SEPARATELY_MEASURABLE where the runtime does not expose an isolated lawful timing boundary.')
  lines.push('- Recent Verification capacity is measured directly from repeated same-policy prepared Current executions over the latest matured historical origins, rather than estimated from Full Verification scaling.')

  return `${lines.join('\n')}\n`
}

async function readGitValue(args: string[]) {
  try {
    const { stdout } = await execFile('git', args, { cwd: process.cwd() })
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function main() {
  const coldSamples = readIntArg('--cold-samples', DEFAULT_COLD_SAMPLES)
  const warmSamples = readIntArg('--warm-samples', DEFAULT_WARM_SAMPLES)
  const recentCandidates = readCandidateNs()
  const stage4NonRegression = readPassFailArg('--stage4-non-regression')
  const stage5NonRegression = readPassFailArg('--stage5-non-regression')
  const gitHead = await readGitValue(['rev-parse', 'HEAD'])
  const branch = await readGitValue(['rev-parse', '--abbrev-ref', 'HEAD'])
  const expectedSourceSha = readStringArg('--expected-source-sha') ?? gitHead

  for (const definition of SYNTHETIC_SERIES_DEFINITIONS) {
    await seedHistory(buildSyntheticHistory(definition))
  }
  await clearProfilerArtifacts(SYNTHETIC_SERIES_DEFINITIONS.map((definition) => definition.seriesId))

  const profiles = await buildProfiles()
  const summarizedProfiles: ReturnType<typeof summarizeProfile>[] = []
  const recentMaxima: number[] = []

  for (const profile of profiles) {
    const currentMeasurements = await measureCurrentSamples(profile, coldSamples, warmSamples)
    const currentConservativeMs = resolveConservativeLatencyMs(
      summarizeNumericSamples(currentMeasurements.coldSamples.map((sample) => sample.totalRenderableReadyMs)),
    )

    const fullVerification = profile.recentVerificationMode === 'NOT_APPLICABLE'
      ? null
      : await measureFullVerification(profile, recentCandidates, currentConservativeMs)

    if (fullVerification) {
      recentMaxima.push(fullVerification.maxInlineCandidate)
    }

    summarizedProfiles.push(summarizeProfile(profile, currentMeasurements, fullVerification, {
      gitHead,
      expectedSourceSha,
      stage4NonRegression,
      stage5NonRegression,
    }))
  }

  const profilesPassing = summarizedProfiles.filter((profile) => profile.finalGate.fastReadyProfilerGate === 'PASS').length
  const profilesFailing = summarizedProfiles.length - profilesPassing
  const overallFastReadyProfilerGate: 'PASS' | 'FAIL' = profilesFailing === 0 ? 'PASS' : 'FAIL'

  const result = {
    task: 'PPF1_STAGE6_FAST_READY_PROFILER',
    generatedAt: new Date().toISOString(),
    gitHead,
    branch,
    evidence: {
      expectedSourceSha,
    },
    regressions: {
      stage4NonRegression,
      stage5NonRegression,
    },
    configuration: {
      coldSamples,
      warmSamples,
      recentCandidates,
      fastReadyBudgetMs: FAST_READY_BUDGET_MS,
    },
    methodology: {
      currentMeasurementMode: 'CANONICAL_PREPARE_CURRENT_PLUS_EXACT_PREPARED_READ',
      rollingDailyPhaseIsolation: 'BEST_EFFORT_WITH_EXPLICIT_NOT_SEPARATELY_MEASURABLE_GAPS',
      recentVerificationMeasurementMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
      seedSeriesIds: SYNTHETIC_SERIES_DEFINITIONS.map((definition) => definition.seriesId),
    },
    profiles: summarizedProfiles,
    globalDecision: resolveGlobalNFastDecision(recentMaxima),
    finalGate: {
      fastReadyProfilerGate: overallFastReadyProfilerGate,
      performanceCorrectiveRequired: profilesFailing !== 0,
      profilesPassing,
      profilesFailing,
    },
  }

  await writeFile(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`)
  await writeFile(RESULT_MD_PATH, renderMarkdown(result))

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    outputJson: RESULT_JSON_PATH,
    outputMarkdown: RESULT_MD_PATH,
    globalDecision: result.globalDecision,
    profiledProfiles: summarizedProfiles.length,
  })}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
  process.exitCode = 1
})