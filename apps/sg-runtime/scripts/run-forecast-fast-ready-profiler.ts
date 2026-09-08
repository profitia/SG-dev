import './load-env'

import { execFile as execFileCallback } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import path from 'node:path'
import { promisify } from 'node:util'

import { Prisma } from '@/generated/market-data-client'
import { addCalendarMonthsClamped, resolveForecastTechnicalMinimumObservations } from '@/lib/forecast/current-fast-policy'
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
  calculatePhaseAccounting,
  type ProfiledPhaseName,
  classifyQuarterlyArimaOutlier,
  classifyDominantBottleneck,
  type ProfileMode,
  FINAL_PROFILE_COLD_SAMPLES,
  FINAL_PROFILE_WARM_SAMPLES,
  FINAL_PROFILE_RECENT_CANDIDATES,
  NOT_SEPARATELY_MEASURABLE,
  NOT_STATISTICALLY_MEANINGFUL,
  resolveConcurrentGlobalComputeGate,
  resolveConservativeLatencyMs,
  resolveEvidenceBasedServingHeadroom,
  resolveFastReadyProfilerGate,
  resolveRollingDailyExactReadGate,
  resolveWarmReuseGate,
  resolveGlobalNFastDecision,
  resolveProfilerConfigurationContract,
  resolveStage6FinalDecision,
  summarizeNumericSamples,
  summarizeOptionalPhaseSamples,
  validateExpectedSourceSha,
  validateProfileEnvironmentMetadata,
} from '@/lib/forecast/fast-ready-profiler'
import {
  createInteractiveForecastPreparationService,
  type InteractiveForecastIdentity,
} from '@/lib/forecast/interactive-preparation'
import { buildCurrentLogicalArtifactKey } from '@/lib/forecast/current-single-flight'
import { createDefaultForecastPreparationExecutionAdmission } from '@/lib/forecast/execution-ledger'
import { buildForecastHistoryFingerprint } from '@/lib/forecast/history-fingerprint'
import {
  buildForecastArtifactCadenceIdentity,
  createCurrentForecastStatisticalCompatibility,
  resolveForecastMethodContract,
} from '@/lib/forecast/identity'
import {
  buildLiveForecastBridgePayloadFromHistory,
  buildCurrentHorizonConfigurationId,
  buildCurrentForecastExecutionPlan,
  selectMinimalLawfulCurrentTrainingPayload,
} from '@/lib/forecast/live-market-input'
import { selectMinimalLawfulCurrentTrainingSuffix } from '@/lib/forecast/current-fast-policy'
import { buildRollingDailyHistoryFingerprint } from '@/lib/forecast/rolling-daily-maintenance'
import { readRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import { prepareRollingDailyCurrentOwnership } from '@/lib/forecast/rolling-daily-current-ownership'
import { createRollingDailyProductionOperationsService } from '@/lib/forecast/rolling-daily-production-operations'
import {
  createForecastLibraryService,
  executePreparedForecastBridge,
  type ForecastServiceRequest,
  readCurrentRunFromPrisma,
  setForecastPersistenceTestHooks,
} from '@/lib/forecast/service'
import { resolveForecastStage3HeartbeatIntervalMs } from '@/lib/forecast/stage3-lease-heartbeat'
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

const DEFAULT_PROFILE_MODE: ProfileMode = 'FINAL'
const DEFAULT_COLD_SAMPLES = FINAL_PROFILE_COLD_SAMPLES
const DEFAULT_WARM_SAMPLES = FINAL_PROFILE_WARM_SAMPLES
const DEFAULT_RECENT_CANDIDATES = FINAL_PROFILE_RECENT_CANDIDATES
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

type ProfileWorktreeMode = 'CLEAN_DEDICATED_WORKTREE' | 'CLEAN_PRIMARY_WORKTREE' | 'DIRTY_PRIMARY_WORKTREE'

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
  inputMetadata: CurrentInputMetadata
  currentIsolation: CurrentIsolationCounters
  rollingDailyIdentityDiagnostic: RollingDailyIdentityDiagnostic | null
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

type CurrentIsolationCounters = {
  fullVerificationComputeCount: number
  recentVerificationProductionComputeCount: number
  calibrationBuildCount: number
  bandBuildCount: number
}

type CurrentInputMetadata = {
  inputSource: string
  sourceHistoryObservationCount: number
  default12MObservationCount: number
  modelTechnicalMinimumObservations: number
  selectedTrainingObservationCount: number
  selectedHistoryStart: string
  selectedHistoryEnd: string
  extendedBeyond12M: boolean
  trainingWindowPolicyId: string
  effectiveTrainingPolicyId: string
  historyFingerprint: string
  forecastOrigin: string
}

type RollingDailyIdentityDiagnostic = {
  rootCauseClassification:
    | 'PROFILER_FINGERPRINT_RECONSTRUCTION_DEFECT'
    | 'PROFILER_EXACT_IDENTITY_RECONSTRUCTION_DEFECT'
    | 'PROFILER_FRESHNESS_ASSUMPTION_DEFECT'
    | 'ROLLING_DAILY_PRODUCTION_PERSISTENCE_IDENTITY_DEFECT'
    | 'ROLLING_DAILY_STAGE5_RUNTIME_REGRESSION'
    | 'OTHER_WITH_EVIDENCE'
  profilerFingerprintMatchesCanonicalWrite: boolean
  canonicalReadStatus: 'HIT' | 'STALE' | 'MISS'
  legacyProfilerReadStatus: 'HIT' | 'STALE' | 'MISS'
  legacyProfilerReadReason: string | null
  canonicalWriteIdentity: {
    seriesId: string
    modelId: string
    inputSource: string
    sourceFrequency: SourceFrequency
    targetCadence: 'DAILY'
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME'
    targetBasis: 'POINT_IN_TIME'
    methodId: string
    methodVersion: string
    trainingWindowPolicyId: string
    effectiveTrainingPolicyId: string
    selectedHistoryStart: string
    selectedHistoryEnd: string
    selectedObservationCount: number
    sourceHistoryFingerprint: string
    forecastOrigin: string
    sourceLatestObservationDate: string
  }
  legacyProfilerReconstruction: {
    selectedHistoryStart: string
    selectedHistoryEnd: string
    selectedObservationCount: number
    sourceHistoryFingerprint: string
    sourceLatestObservationDate: string
  }
}

type ConcurrentProfileMeasurement = {
  requestCount: number
  ownerCount: number
  waiterCount: number
  modelComputeCount: number
  bridgeComputeCount: number
  artifactWriteCount: number
  executionCount: number
  terminalArtifactCount: number
  requestLatenciesMs: number[]
  ownerLatencyMs: number | null
  waiterLatencySummary: ReturnType<typeof summarizeNumericSamples> | typeof NOT_STATISTICALLY_MEANINGFUL
  allRequestsSucceeded: boolean
  finalExactReadStatus: 'AVAILABLE' | 'HIT' | 'MISS' | 'STALE'
  gate: 'PASS' | 'FAIL'
  reasons: string[]
}

type ConcurrentMeasurementResult = Awaited<ReturnType<ReturnType<typeof createInstrumentedInteractiveService>['prepareCurrent']>>
  | Awaited<ReturnType<ReturnType<typeof createForecastLibraryService>['resolveCurrentForecastRequest']>>

type SyntheticSeriesHistory = ReturnType<typeof buildDailyHistory>

type FullVerificationMeasurement = {
  status: 'MEASURED' | 'INSUFFICIENT_ORIGIN_DIAGNOSTIC'
  measurementMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN'
  selectedOriginDates: string[]
  originCount: number
  latestLawfulMaturedOrigin: string | null
  recentWindowStartExclusive: string | null
  recentWindowEndInclusive: string | null
  lawfulRecentOriginCount: number
  originSamples: Array<{
    forecastOrigin: string
    totalWallMs: number
    runtimeSeconds: number | null
    selectedObservationCount: number
    extendedBeyondDefaultWindow: boolean
    selectedHistoryStart: string
    selectedHistoryEnd: string
    trainingWindowPolicyId: string
    effectiveTrainingPolicyId: string
  }>
  measuredCandidates: Array<{
    candidateN: number
    status: 'MEASURED' | 'INSUFFICIENT_LAWFUL_ORIGINS'
    actualOriginCount: number
    originDates: string[]
    recentVerificationMs: number | null
    currentConservativeMs: number | null
    reservedServingOverheadMs: number | null
    estimatedTotalFastReadyMs: number | null
    within15s: boolean | null
  }>
  maxInlineCandidate: number
  reservedServingOverheadMs: number
  reservedServingOverheadBasis: 'MEASURED_POST_RECENT_HANDOFF' | 'MEASURED_CANONICAL_HANDOFF_PROXY'
  reservedServingOverheadComponents: Array<{
    component: string
    valueMs: number
    sourceMeasurement: string
    alreadyIncludedInCurrent: boolean
    alreadyIncludedInRecent: boolean
  }>
  servingHeadroomDoubleCounted: false
  effectivePolicyMatchesCurrent: boolean
  lookaheadLeakage: false
  originsSensiblySpaced: boolean
  recentFullHistoryFallback: false
  measuredCandidateOriginCountEqualsN: boolean
  recentProductionArtifactWriteCount: number
  reason: string | null
}

type FocusedQuarterlyDiagnostic = {
  profileId: string
  sampleCount: number
  medianMs: number
  maxMs: number
  countOver15s: number
  countOver30s: number
  countOver60s: number
  outlierClassification: ReturnType<typeof classifyQuarterlyArimaOutlier>
  accountedPhaseTotalMs: number
  unattributedMs: number
  unattributedSharePct: number
  rootCauseResolution: 'RESOLVED' | 'UNRESOLVED'
  performanceCorrectiveRequired: boolean
  slowestSample: CurrentSample | null
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

function readProfileModeArg() {
  const rawValue = process.argv.find((argument) => argument.startsWith('--profile-mode='))
  if (!rawValue) {
    return DEFAULT_PROFILE_MODE
  }

  const value = rawValue.slice('--profile-mode='.length).trim().toUpperCase()
  if (value !== 'SMOKE' && value !== 'FINAL') {
    throw new Error('--profile-mode must be SMOKE or FINAL.')
  }

  return value satisfies ProfileMode
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

function readBooleanArg(flag: string, fallback = false) {
  const rawValue = process.argv.find((argument) => argument.startsWith(`${flag}=`))
  if (!rawValue) {
    return fallback
  }

  const value = rawValue.slice(flag.length + 1).trim().toLowerCase()
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${flag} must be true or false.`)
  }

  return value === 'true'
}

function readProfileWorktreeModeArg() {
  const rawValue = readStringArg('--profile-worktree-mode')
  if (rawValue === null) {
    return null
  }
  if (!['CLEAN_DEDICATED_WORKTREE', 'CLEAN_PRIMARY_WORKTREE', 'DIRTY_PRIMARY_WORKTREE'].includes(rawValue)) {
    throw new Error('--profile-worktree-mode must be CLEAN_DEDICATED_WORKTREE, CLEAN_PRIMARY_WORKTREE, or DIRTY_PRIMARY_WORKTREE.')
  }

  return rawValue as ProfileWorktreeMode
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

function summarizeCurrentIsolation(events: readonly RecorderEvent[]): CurrentIsolationCounters {
  return {
    fullVerificationComputeCount: countEvents(events, 'verification_compute_start', (event) => event.kind === 'telemetry'),
    recentVerificationProductionComputeCount: countEvents(events, 'verification_compute_start', (event) => (
      event.kind === 'telemetry'
      && typeof event.metrics.trainingWindowPolicyId === 'string'
      && event.metrics.trainingWindowPolicyId.includes('RECENT_VERIFICATION')
    )),
    calibrationBuildCount: countEvents(events, 'ROLLING_DAILY_CURRENT_ONLY', (event) => event.kind === 'log' && event.metrics.calibrationTriggeredInline === true),
    bandBuildCount: 0,
  }
}

function buildProfilerCommand() {
  return ['node', '--import', 'tsx', 'scripts/run-forecast-fast-ready-profiler.ts', ...process.argv.slice(2)].join(' ')
}

async function readCommandVersion(command: string, args: string[]) {
  try {
    const { stdout, stderr } = await execFile(command, args, { cwd: process.cwd() })
    return (stdout || stderr).trim() || 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

async function isWorkingTreeClean() {
  const output = await readGitValue(['status', '--short'])
  return (output ?? '').trim().length === 0
}

async function readGitDiffAtProfileStart() {
  const output = await readGitValue(['status', '--short'])
  const normalized = (output ?? '').trim()
  return normalized.length === 0 ? 'EMPTY' : normalized
}

function createInstrumentedInteractiveService(recorder: TelemetryRecorder) {
  const libraryService = createForecastLibraryService({
    telemetry: recorder,
    logEvent: (event, metrics) => recorder.log(event, metrics),
  })
  const rollingDailyService = createRollingDailyProductionOperationsService({
    logEvent: (event, data) => recorder.log(event, data),
  })

  return createInteractiveForecastPreparationService({
    resolveExactCapability: profilerCapabilityService.resolveExact,
    prepareMonthlyCurrent: (input) => libraryService.resolveCurrentForecastRequest(input),
    prepareRollingCurrent: (request) => rollingDailyService.runCurrentOnly(request),
  })
}

async function countPersistedArtifacts(profile: ProfilerProfile) {
  const prisma = getMarketDataPrisma()
  if (!prisma) {
    throw new Error('MARKET_DATA_DATABASE_URL is not configured.')
  }

  const method = resolveForecastMethodContract(profile.targetBasis)
  if (profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') {
    return prisma.rollingDailyCurrentForecastSnapshot.count({
      where: {
        seriesId: profile.seriesId,
        modelId: profile.modelId,
        targetBasis: profile.targetBasis,
        methodId: method.methodId,
        methodVersion: method.methodVersion,
      },
    })
  }

  return prisma.forecastCurrentRun.count({
    where: {
      seriesId: profile.seriesId,
      modelId: profile.modelId,
      targetBasis: profile.targetBasis,
      methodId: method.methodId,
      methodVersion: method.methodVersion,
    },
  })
}

async function resolveProfileInputMetadata(profile: ProfilerProfile): Promise<CurrentInputMetadata> {
  if (profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') {
    const resolved = await resolveBenchmarkHistoricalSeries(profile.seriesId, 'ALL')
    const fullHistory = {
      seriesId: profile.seriesId,
      displayName: resolved.history.displayName,
      description: resolved.history.displayName,
      frequency: 'DAILY',
      source: resolved.history.source,
      points: resolved.history.historical.map((point) => ({
        date: point.date.slice(0, 10),
        value: point.value,
      })),
    }
    const selection = selectMinimalLawfulCurrentTrainingSuffix({
      points: fullHistory.points,
      minimumRequiredObservations: resolveForecastTechnicalMinimumObservations({
        targetSemantics: profile.targetSemantics,
        modelId: profile.modelId,
      }),
    })
    const ownership = await prepareRollingDailyCurrentOwnership({
      seriesId: profile.seriesId,
      modelId: profile.modelId,
    })
    const firstPoint = ownership.history.points[0]
    const lastPoint = ownership.history.points.at(-1)
    if (!firstPoint || !lastPoint || !ownership.identity.forecastOrigin) {
      throw new Error(`Rolling Daily input metadata requires canonical selected history for ${profile.profileId}.`)
    }

    return {
      inputSource: ownership.identity.inputSource ?? 'DYNAMIC_MARKET_DATA_STORE',
      sourceHistoryObservationCount: fullHistory.points.length,
      default12MObservationCount: selection.defaultWindowObservationCount,
      modelTechnicalMinimumObservations: selection.minimumRequiredObservations,
      selectedTrainingObservationCount: ownership.history.points.length,
      selectedHistoryStart: firstPoint.date,
      selectedHistoryEnd: lastPoint.date,
      extendedBeyond12M: selection.extendedBeyondDefaultWindow,
      trainingWindowPolicyId: ownership.identity.trainingWindowPolicyId,
      effectiveTrainingPolicyId: createCurrentForecastStatisticalCompatibility({
        sourceFrequency: 'DAILY',
        targetCadence: 'DAILY',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      }).effectiveTrainingPolicyId,
      historyFingerprint: ownership.identity.historyFingerprint,
      forecastOrigin: ownership.identity.forecastOrigin,
    }
  }

  const history = await resolveBenchmarkHistoricalSeries(profile.seriesId, 'ALL')
  const basePayload = buildLiveForecastBridgePayloadFromHistory(profile.seriesId, history.history, {
    targetBasis: profile.targetBasis,
    targetCadence: profile.targetCadence,
    continuityPolicy: profile.targetCadence === 'MONTHLY' ? 'ALLOW_GAPS' : 'REQUIRE_FULL',
  })
  const minimumRequiredObservations = resolveForecastTechnicalMinimumObservations({
    targetSemantics: profile.targetSemantics,
    modelId: profile.modelId,
  })
  const selection = selectMinimalLawfulCurrentTrainingSuffix({
    points: basePayload.history.points,
    forecastOrigin: basePayload.history.end,
    minimumRequiredObservations,
  })
  const selectedPayload = selectMinimalLawfulCurrentTrainingPayload(basePayload, minimumRequiredObservations)
  const compatibility = createCurrentForecastStatisticalCompatibility({
    sourceFrequency: profile.sourceFrequency,
    targetCadence: profile.targetCadence,
    targetSemantics: profile.targetSemantics,
  })

  return {
    inputSource: selectedPayload.source.kind,
    sourceHistoryObservationCount: basePayload.history.points.length,
    default12MObservationCount: selection.defaultWindowObservationCount,
    modelTechnicalMinimumObservations: selection.minimumRequiredObservations,
    selectedTrainingObservationCount: selection.selectedObservationCount,
    selectedHistoryStart: selectedPayload.history.start,
    selectedHistoryEnd: selectedPayload.history.end,
    extendedBeyond12M: selection.extendedBeyondDefaultWindow,
    trainingWindowPolicyId: compatibility.trainingWindowPolicyId,
    effectiveTrainingPolicyId: compatibility.effectiveTrainingPolicyId,
    historyFingerprint: buildForecastHistoryFingerprint({
      ...selectedPayload.history,
      cadence: {
        sourceFrequency: profile.sourceFrequency,
        targetCadence: profile.targetCadence,
      },
    }),
    forecastOrigin: selectedPayload.history.end,
  }
}

async function diagnoseRollingDailyIdentity(profile: ProfilerProfile): Promise<RollingDailyIdentityDiagnostic> {
  const resolved = await resolveBenchmarkHistoricalSeries(profile.seriesId, 'ALL')
  const fullHistory = {
    seriesId: profile.seriesId,
    displayName: resolved.history.displayName,
    description: resolved.history.displayName,
    frequency: 'DAILY',
    source: resolved.history.source,
    points: resolved.history.historical.map((point) => ({
      date: point.date.slice(0, 10),
      value: point.value,
    })),
  }
  const legacyProfilerFingerprint = buildRollingDailyHistoryFingerprint(fullHistory)
  const ownership = await prepareRollingDailyCurrentOwnership({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
  })
  const canonicalRead = await readRollingDailyCurrentForecastSnapshot({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    sourceHistoryFingerprint: ownership.identity.historyFingerprint,
  })
  const canonicalProfilerFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: profile.seriesId,
    displayName: resolved.history.displayName,
    description: resolved.history.displayName,
    frequency: 'DAILY',
    source: resolved.history.source,
    points: ownership.history.points,
  })
  const legacyRead = await readRollingDailyCurrentForecastSnapshot({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    sourceHistoryFingerprint: legacyProfilerFingerprint,
  })
  const firstPoint = ownership.history.points[0]
  const lastPoint = ownership.history.points.at(-1)
  if (!firstPoint || !lastPoint || !ownership.identity.forecastOrigin) {
    throw new Error(`Rolling Daily identity diagnosis requires selected history for ${profile.profileId}.`)
  }

  return {
    rootCauseClassification: ownership.identity.historyFingerprint !== legacyProfilerFingerprint
      && canonicalRead.status === 'HIT'
      && legacyRead.status === 'STALE'
        ? 'PROFILER_FINGERPRINT_RECONSTRUCTION_DEFECT'
        : canonicalRead.status === 'HIT'
          ? 'OTHER_WITH_EVIDENCE'
          : 'ROLLING_DAILY_STAGE5_RUNTIME_REGRESSION',
    profilerFingerprintMatchesCanonicalWrite: canonicalProfilerFingerprint === ownership.identity.historyFingerprint,
    canonicalReadStatus: canonicalRead.status,
    legacyProfilerReadStatus: legacyRead.status,
    legacyProfilerReadReason: 'reason' in legacyRead ? legacyRead.reason : null,
    canonicalWriteIdentity: {
      seriesId: profile.seriesId,
      modelId: profile.modelId,
      inputSource: ownership.identity.inputSource ?? 'DYNAMIC_MARKET_DATA_STORE',
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      targetBasis: 'POINT_IN_TIME',
      methodId: ownership.identity.methodId,
      methodVersion: ownership.identity.methodVersion,
      trainingWindowPolicyId: ownership.identity.trainingWindowPolicyId,
      effectiveTrainingPolicyId: createCurrentForecastStatisticalCompatibility({
        sourceFrequency: 'DAILY',
        targetCadence: 'DAILY',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      }).effectiveTrainingPolicyId,
      selectedHistoryStart: firstPoint.date,
      selectedHistoryEnd: lastPoint.date,
      selectedObservationCount: ownership.history.points.length,
      sourceHistoryFingerprint: ownership.identity.historyFingerprint,
      forecastOrigin: ownership.identity.forecastOrigin,
      sourceLatestObservationDate: lastPoint.date,
    },
    legacyProfilerReconstruction: {
      selectedHistoryStart: fullHistory.points[0]?.date ?? '',
      selectedHistoryEnd: fullHistory.points.at(-1)?.date ?? '',
      selectedObservationCount: fullHistory.points.length,
      sourceHistoryFingerprint: legacyProfilerFingerprint,
      sourceLatestObservationDate: fullHistory.points.at(-1)?.date ?? '',
    },
  }
}

function selectEvenlySpacedOrigins<TPoint extends { date: string }>(points: readonly TPoint[], count: number) {
  if (count >= points.length) {
    return [...points]
  }
  if (count === 1) {
    return [points.at(-1)!]
  }

  const selectedIndices = new Set<number>()
  for (let index = 0; index < count; index += 1) {
    const ratio = index / (count - 1)
    selectedIndices.add(Math.round((points.length - 1) * ratio))
  }

  for (let index = points.length - 1; selectedIndices.size < count && index >= 0; index -= 1) {
    selectedIndices.add(index)
  }

  return [...selectedIndices]
    .sort((left, right) => left - right)
    .slice(0, count)
    .map((index) => points[index]!)
}

async function readEnvironmentMetadata(input: {
  profileMode: ProfileMode
  coldSamples: number
  warmSamples: number
  recentCandidates: readonly number[]
  expectedSourceSha: string | null
  profiledSourceSha: string | null
  profileWorktreeMode: ProfileWorktreeMode | null
}) {
  const admission = createDefaultForecastPreparationExecutionAdmission()
  const forecastHeartbeatIntervalMs = resolveForecastStage3HeartbeatIntervalMs(admission.leaseDurationMs)
  const workingTreeCleanAtProfileStart = await isWorkingTreeClean()
  const gitDiffAtProfileStart = await readGitDiffAtProfileStart()
  const inferredWorktreeMode: ProfileWorktreeMode = workingTreeCleanAtProfileStart
    ? 'CLEAN_PRIMARY_WORKTREE'
    : 'DIRTY_PRIMARY_WORKTREE'

  return {
    profileEnvironmentClass: 'CONTROLLED_SYNTHETIC_DB_BACKED',
    nodeVersion: process.version,
    pythonVersion: await readCommandVersion(path.resolve(process.cwd(), '..', '..', 'tooling', 'Benchmark-Forecasting', '.venv', 'bin', 'python'), ['--version']),
    platform: process.platform,
    architecture: process.arch,
    databaseClassification: 'CONTROLLED_SYNTHETIC_DB_BACKED',
    processConcurrency: Number.parseInt(process.env.WEB_CONCURRENCY ?? '1', 10),
    webConcurrency: process.env.WEB_CONCURRENCY ?? null,
    forecastLeaseDurationMs: admission.leaseDurationMs,
    forecastHeartbeatIntervalMs,
    workingTreeCleanAtProfileStart,
    gitDiffAtProfileStart,
    profileWorktreeMode: input.profileWorktreeMode ?? inferredWorktreeMode,
    profileCommand: buildProfilerCommand(),
    profileMode: input.profileMode,
    coldSamples: input.coldSamples,
    warmSamples: input.warmSamples,
    recentCandidates: [...input.recentCandidates],
    expectedSourceSha: input.expectedSourceSha,
    profiledSourceSha: input.profiledSourceSha,
    syntheticSeriesDefinitions: SYNTHETIC_SERIES_DEFINITIONS,
  }
}

async function runFocusedQuarterlyArimaDiagnostic(profile: ProfilerProfile): Promise<FocusedQuarterlyDiagnostic> {
  const measurement = await measureCurrentSamples(profile, 10, 0)
  const totals = measurement.coldSamples.map((sample) => sample.totalRenderableReadyMs)
  const summary = summarizeNumericSamples(totals)
  const slowestSample = [...measurement.coldSamples].sort((left, right) => right.totalRenderableReadyMs - left.totalRenderableReadyMs)[0] ?? null
  const accounting = slowestSample === null
    ? { accountedPhaseTotalMs: 0, unattributedMs: 0, unattributedSharePct: 0 }
    : calculatePhaseAccounting(slowestSample.phases)
  const outlierClassification = slowestSample === null
    ? 'UNRESOLVED'
    : classifyQuarterlyArimaOutlier({
        phases: slowestSample.phases,
        unattributedSharePct: accounting.unattributedSharePct,
      })

  return {
    profileId: profile.profileId,
    sampleCount: measurement.coldSamples.length,
    medianMs: summary.medianMs,
    maxMs: summary.maxMs,
    countOver15s: totals.filter((value) => value > 15_000).length,
    countOver30s: totals.filter((value) => value > 30_000).length,
    countOver60s: totals.filter((value) => value > 60_000).length,
    outlierClassification,
    accountedPhaseTotalMs: accounting.accountedPhaseTotalMs,
    unattributedMs: accounting.unattributedMs,
    unattributedSharePct: accounting.unattributedSharePct,
    rootCauseResolution: accounting.unattributedSharePct <= 20 ? 'RESOLVED' : 'UNRESOLVED',
    performanceCorrectiveRequired: summary.maxMs > FAST_READY_BUDGET_MS,
    slowestSample,
  }
}

async function readRollingDailyPreparedCurrent(profile: ProfilerProfile) {
  const ownership = await prepareRollingDailyCurrentOwnership({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
  })
  const result = await readRollingDailyCurrentForecastSnapshot({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    sourceHistoryFingerprint: ownership.identity.historyFingerprint,
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

async function resolvePeriodicCurrentLogicalArtifactKey(profile: ProfilerProfile) {
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
  const historyFingerprint = buildForecastHistoryFingerprint({
    ...currentPayload.history,
    cadence: {
      sourceFrequency: profile.sourceFrequency,
      targetCadence: profile.targetCadence,
    },
  })
  const logicalArtifactKey = buildCurrentLogicalArtifactKey({
    artifactScope: compatibility.artifactScope,
    seriesId: profile.seriesId,
    targetBasis: profile.targetBasis,
    targetSemantics: method.targetSemantics,
    methodId: method.methodId,
    methodVersion: method.methodVersion,
    trainingWindowPolicyId: compatibility.trainingWindowPolicyId,
    modelId: profile.modelId,
    inputSource: currentPayload.source.kind,
    historyFingerprint,
    sourceFrequency: profile.sourceFrequency,
    targetCadence: profile.targetCadence,
    frequencyIdentity: buildForecastArtifactCadenceIdentity({
      sourceFrequency: profile.sourceFrequency,
      targetCadence: profile.targetCadence,
    }),
    forecastOrigin: currentPayload.history.end,
    horizonConfigurationId: buildCurrentHorizonConfigurationId(currentPayload.history.end, profile.targetCadence),
  })

  return logicalArtifactKey
}

async function readLatestPeriodicCurrentExecution(profile: ProfilerProfile) {
  const logicalArtifactKey = await resolvePeriodicCurrentLogicalArtifactKey(profile)

  return createDefaultForecastPreparationExecutionAdmission().readLatestExecutionForLogicalArtifact(logicalArtifactKey)
}

async function waitForAuthoritativeWaiters(logicalArtifactKey: string, minimumWaiterCount: number, timeoutMs = 1_000) {
  const admission = createDefaultForecastPreparationExecutionAdmission()
  const deadline = Date.now() + timeoutMs

  while (Date.now() <= deadline) {
    const latestExecution = await admission.readLatestExecutionForLogicalArtifact(logicalArtifactKey)
    if (latestExecution?.waiterCount && latestExecution.waiterCount >= minimumWaiterCount) {
      return
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 10)
    })
  }

  return
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
  const interactiveService = createInstrumentedInteractiveService(recorder)

  const identity = buildInteractiveIdentity(profile)
  const coldSamples: CurrentSample[] = []
  const warmSamples: WarmSample[] = []
  const inputMetadata = await resolveProfileInputMetadata(profile)
  let rollingDailyIdentityDiagnostic: RollingDailyIdentityDiagnostic | null = null

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
    const currentIsolation = summarizeCurrentIsolation(currentEvents)
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
      const historyLoadMs = findLatestNumericMetric(currentEvents, 'current_history_load', 'durationMs')
      const admissionMs = findLatestNumericMetric(currentEvents, 'current_execution_admission', 'durationMs')
      const waiterWaitMs = findLatestNumericMetric(currentEvents, 'current_waiter_wait', 'durationMs')
      const terminalMarkMs = findLatestNumericMetric(currentEvents, 'current_terminal_mark', 'durationMs')
      if (exactRead.status !== 'HIT' && exactRead.status !== 'STALE') {
        throw new Error(`Rolling Daily prepared read failed for ${profile.profileId}: ${exactRead.status}`)
      }
      if (rollingDailyIdentityDiagnostic === null) {
        rollingDailyIdentityDiagnostic = await diagnoseRollingDailyIdentity(profile)
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
          REQUEST_ENTRY_TO_CAPABILITY_RESOLUTION_MS: capability.trace?.capabilityTotalMs ?? capability.timingMs,
          CAPABILITY_RESOLUTION_MS: capability.trace?.capabilityTotalMs ?? capability.timingMs,
          HISTORY_LOAD_MS: historyLoadMs === null ? null : roundMs(historyLoadMs),
          HISTORY_PREPARATION_MS: null,
          FAST_SUFFIX_SELECTION_MS: null,
          PREPARED_LOOKUP_MS: null,
          EXECUTION_ADMISSION_MS: admissionMs === null ? null : roundMs(admissionMs),
          EXECUTION_OWNER_ACQUIRE_MS: admissionMs === null ? null : roundMs(admissionMs),
          EXECUTION_WAITER_OR_RECOVERY_WAIT_MS: waiterWaitMs === null ? null : roundMs(waiterWaitMs),
          OWNER_WAIT_MS: waiterWaitMs === null ? null : roundMs(waiterWaitMs),
          BRIDGE_PROCESS_SPAWN_MS: null,
          BRIDGE_STDIN_SERIALIZATION_MS: null,
          PYTHON_BOOTSTRAP_MS: null,
          MODEL_BRIDGE_MS: null,
          MODEL_COMPUTE_MS: exactRead.runtimeSeconds === null ? null : roundMs(exactRead.runtimeSeconds * 1000),
          BRIDGE_STDOUT_WAIT_MS: null,
          PERSISTENCE_FENCE_MS: null,
          PERSISTENCE_WRITE_MS: null,
          PERSISTENCE_MS: null,
          EXECUTION_TERMINAL_MARK_MS: terminalMarkMs === null ? null : roundMs(terminalMarkMs),
          POST_PERSIST_EXACT_READ_MS: roundMs(exactReadMs),
          RETURN_PATH_MS: null,
          CONSUMER_ADAPTER_MS: null,
          TOTAL_RENDERABLE_READY_MS: roundMs(prepareMs + exactReadMs),
          ROLLING_DAILY_OWNERSHIP_PREPARATION_MS: capability.timingMs,
          ROLLING_DAILY_SNAPSHOT_PERSIST_MS: null,
        },
        runtimeSeconds: exactRead.runtimeSeconds,
        policyId: rollingDailyCompatibility.trainingWindowPolicyId,
        effectivePolicyId: rollingDailyCompatibility.effectiveTrainingPolicyId,
        inputMetadata,
        currentIsolation,
        rollingDailyIdentityDiagnostic,
      })
    } else {
      const exactReadStartedAt = performance.now()
      const exactRead = await readPeriodicPreparedCurrent(profile)
      const exactReadMs = performance.now() - exactReadStartedAt
      const historyLoadMs = findLatestNumericMetric(currentEvents, 'current_history_load', 'durationMs')
      const admissionMs = findLatestNumericMetric(currentEvents, 'current_execution_admission', 'durationMs')
      const waiterWaitMs = findLatestNumericMetric(currentEvents, 'current_waiter_wait', 'durationMs')
      const terminalMarkMs = findLatestNumericMetric(currentEvents, 'current_terminal_mark', 'durationMs')
      const ownerTotalMs = findLatestNumericMetric(currentEvents, 'single_flight_owner_completed', 'durationMs')
      const computeDurationMs = findLatestNumericMetric(currentEvents, 'current_compute_end', 'durationMs')
      const persistenceDurationMs = findLatestNumericMetric(currentEvents, 'persistence', 'durationMs')
      const runtimeMs = exactRead.runtimeSeconds === null ? null : roundMs(exactRead.runtimeSeconds * 1000)
      const modeledAccountedMs = [
        admissionMs,
        waiterWaitMs,
        computeDurationMs,
        persistenceDurationMs,
        terminalMarkMs,
      ].reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0)
      const returnPathMs = ownerTotalMs === null
        ? null
        : roundMs(Math.max(ownerTotalMs - modeledAccountedMs, 0))

      coldSamples.push({
        prepareStatus: preparation.status,
        exactReadStatus: exactRead.status,
        exactReadGate: 'PASS',
        ownerAcquiredCount,
        cacheStatus: exactRead.cacheStatus,
        totalRenderableReadyMs: roundMs(prepareMs + exactReadMs),
        exactReadMs: roundMs(exactReadMs),
        phases: {
          REQUEST_ENTRY_TO_CAPABILITY_RESOLUTION_MS: capability.trace?.capabilityTotalMs ?? capability.timingMs,
          CAPABILITY_RESOLUTION_MS: capability.trace?.capabilityTotalMs ?? capability.timingMs,
          HISTORY_LOAD_MS: historyLoadMs === null
            ? periodicSurface?.historyLoadMs ?? null
            : roundMs(historyLoadMs),
          HISTORY_PREPARATION_MS: periodicSurface?.historyPreparationMs ?? null,
          FAST_SUFFIX_SELECTION_MS: periodicSurface?.fastSuffixSelectionMs ?? null,
          PREPARED_LOOKUP_MS: null,
          EXECUTION_ADMISSION_MS: admissionMs === null ? null : roundMs(admissionMs),
          EXECUTION_OWNER_ACQUIRE_MS: admissionMs === null ? null : roundMs(admissionMs),
          EXECUTION_WAITER_OR_RECOVERY_WAIT_MS: waiterWaitMs === null ? null : roundMs(waiterWaitMs),
          OWNER_WAIT_MS: waiterWaitMs === null ? null : roundMs(waiterWaitMs),
          BRIDGE_PROCESS_SPAWN_MS: null,
          BRIDGE_STDIN_SERIALIZATION_MS: null,
          PYTHON_BOOTSTRAP_MS: null,
          MODEL_BRIDGE_MS: computeDurationMs !== null && runtimeMs !== null
            ? roundMs(Math.max(computeDurationMs - runtimeMs, 0))
            : null,
          MODEL_COMPUTE_MS: runtimeMs,
          BRIDGE_STDOUT_WAIT_MS: null,
          PERSISTENCE_FENCE_MS: null,
          PERSISTENCE_WRITE_MS: persistenceDurationMs === null ? null : roundMs(persistenceDurationMs),
          PERSISTENCE_MS: persistenceDurationMs === null ? null : roundMs(persistenceDurationMs),
          EXECUTION_TERMINAL_MARK_MS: terminalMarkMs === null ? null : roundMs(terminalMarkMs),
          POST_PERSIST_EXACT_READ_MS: roundMs(exactReadMs),
          RETURN_PATH_MS: returnPathMs,
          CONSUMER_ADAPTER_MS: null,
          TOTAL_RENDERABLE_READY_MS: roundMs(prepareMs + exactReadMs),
        },
        runtimeSeconds: exactRead.runtimeSeconds,
        policyId: exactRead.lineage.statisticalCompatibility.trainingWindowPolicyId,
        effectivePolicyId: exactRead.lineage.statisticalCompatibility.effectiveTrainingPolicyId,
        inputMetadata,
        currentIsolation,
        rollingDailyIdentityDiagnostic: null,
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
  reservedServingDecision: ReturnType<typeof resolveEvidenceBasedServingHeadroom>,
) {
  const history = await resolveBenchmarkHistoricalSeries(profile.seriesId, 'ALL')
  const basePayload = buildLiveForecastBridgePayloadFromHistory(profile.seriesId, history.history, {
    targetBasis: profile.targetBasis,
    targetCadence: profile.targetCadence,
    continuityPolicy: profile.targetCadence === 'MONTHLY' ? 'ALLOW_GAPS' : 'REQUIRE_FULL',
  })
  const latestHistoricalDate = basePayload.history.end
  const minimumRequiredObservations = resolveForecastTechnicalMinimumObservations({
    targetSemantics: profile.targetSemantics,
    modelId: profile.modelId,
  })
  const eligibleOrigins = basePayload.history.points
    .slice(0, -1)
    .filter((point) => {
      const plan = buildCurrentForecastExecutionPlan(point.date, profile.targetCadence)
      const farthestTargetDate = plan.currentTargetDates['12M']
      if (!(typeof farthestTargetDate === 'string' && farthestTargetDate <= latestHistoricalDate)) {
        return false
      }

      return selectMinimalLawfulCurrentTrainingSuffix({
        points: basePayload.history.points,
        forecastOrigin: point.date,
        minimumRequiredObservations,
      }).minimumRequirementSatisfied
    })

  if (eligibleOrigins.length === 0) {
    return {
      status: 'INSUFFICIENT_ORIGIN_DIAGNOSTIC',
      measurementMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
      selectedOriginDates: [],
      originCount: 0,
      latestLawfulMaturedOrigin: null,
      recentWindowStartExclusive: null,
      recentWindowEndInclusive: null,
      lawfulRecentOriginCount: 0,
      originSamples: [],
      measuredCandidates: [],
      maxInlineCandidate: 0,
      reservedServingOverheadMs: reservedServingDecision.reservedServingOverheadMs,
      reservedServingOverheadBasis: reservedServingDecision.reservedServingOverheadBasis,
      reservedServingOverheadComponents: reservedServingDecision.components,
      servingHeadroomDoubleCounted: reservedServingDecision.servingHeadroomDoubleCounted,
      effectivePolicyMatchesCurrent: true,
      lookaheadLeakage: false,
      originsSensiblySpaced: false,
      recentFullHistoryFallback: false,
      measuredCandidateOriginCountEqualsN: true,
      recentProductionArtifactWriteCount: 0,
      reason: 'No matured historical origins were available for direct same-policy Recent profiling.',
    } satisfies FullVerificationMeasurement
  }

  const latestLawfulMaturedOrigin = eligibleOrigins.at(-1)?.date ?? null
  const recentWindowStartExclusive = latestLawfulMaturedOrigin === null
    ? null
    : addCalendarMonthsClamped(latestLawfulMaturedOrigin, -12)
  const recentWindowEndInclusive = latestLawfulMaturedOrigin
  const recentWindowOrigins = recentWindowStartExclusive === null || recentWindowEndInclusive === null
    ? []
    : eligibleOrigins.filter((point) => point.date > recentWindowStartExclusive && point.date <= recentWindowEndInclusive)
  const originPool = recentWindowOrigins
  const candidateOriginMap = new Map<number, typeof originPool>()
  for (const candidateN of candidateNs) {
    candidateOriginMap.set(candidateN, selectEvenlySpacedOrigins(originPool, Math.min(candidateN, originPool.length)))
  }
  const selectedOrigins = Array.from(
    new Map(
      candidateNs.flatMap((candidateN) => (candidateOriginMap.get(candidateN) ?? []).map((origin) => [origin.date, origin])),
    ).values(),
  )
  const compatibility = createCurrentForecastStatisticalCompatibility({
    sourceFrequency: profile.sourceFrequency,
    targetCadence: profile.targetCadence,
    targetSemantics: profile.targetSemantics,
  })
  const artifactCountBefore = await countPersistedArtifacts(profile)

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
      selectedHistoryStart: firstPoint.date,
      selectedHistoryEnd: lastPoint.date,
      trainingWindowPolicyId: compatibility.trainingWindowPolicyId,
      effectiveTrainingPolicyId: compatibility.effectiveTrainingPolicyId,
    })
  }

  const originSamplesByDate = new Map(originSamples.map((sample) => [sample.forecastOrigin, sample]))
  const recentProductionArtifactWriteCount = (await countPersistedArtifacts(profile)) - artifactCountBefore

  const measuredCandidates = candidateNs.map((candidateN) => {
    const candidateOrigins = (candidateOriginMap.get(candidateN) ?? [])
      .map((origin) => originSamplesByDate.get(origin.date))
      .filter((sample): sample is NonNullable<typeof sample> => sample !== undefined)
    if (candidateOrigins.length !== candidateN) {
      return {
        candidateN,
        status: 'INSUFFICIENT_LAWFUL_ORIGINS' as const,
        actualOriginCount: candidateOrigins.length,
        originDates: candidateOrigins.map((sample) => sample.forecastOrigin),
        recentVerificationMs: null,
        currentConservativeMs: null,
        reservedServingOverheadMs: null,
        estimatedTotalFastReadyMs: null,
        within15s: null,
      }
    }

    const recentVerificationMs = candidateOrigins.reduce((sum, sample) => sum + sample.totalWallMs, 0)
    const estimatedTotalFastReadyMs = currentConservativeMs + recentVerificationMs + reservedServingDecision.reservedServingOverheadMs
    return {
      candidateN,
      status: 'MEASURED' as const,
      actualOriginCount: candidateOrigins.length,
      originDates: candidateOrigins.map((sample) => sample.forecastOrigin),
      recentVerificationMs: roundMs(recentVerificationMs),
      currentConservativeMs: roundMs(currentConservativeMs),
      reservedServingOverheadMs: reservedServingDecision.reservedServingOverheadMs,
      estimatedTotalFastReadyMs: roundMs(estimatedTotalFastReadyMs),
      within15s: estimatedTotalFastReadyMs <= FAST_READY_BUDGET_MS,
    }
  })
  const maxInlineCandidate = Math.max(0, ...measuredCandidates
    .filter((item) => item.status === 'MEASURED' && item.within15s === true)
    .map((item) => item.candidateN))

  return {
    status: 'MEASURED',
    measurementMode: 'DIRECT_SAME_POLICY_PREPARED_CURRENT_BY_ORIGIN',
    selectedOriginDates: originSamples.map((sample) => sample.forecastOrigin),
    originCount: originSamples.length,
    latestLawfulMaturedOrigin,
    recentWindowStartExclusive,
    recentWindowEndInclusive,
    lawfulRecentOriginCount: originPool.length,
    originSamples,
    measuredCandidates,
    maxInlineCandidate,
    reservedServingOverheadMs: reservedServingDecision.reservedServingOverheadMs,
    reservedServingOverheadBasis: reservedServingDecision.reservedServingOverheadBasis,
    reservedServingOverheadComponents: reservedServingDecision.components,
    servingHeadroomDoubleCounted: reservedServingDecision.servingHeadroomDoubleCounted,
    effectivePolicyMatchesCurrent: originSamples.every((sample) => (
      sample.trainingWindowPolicyId === compatibility.trainingWindowPolicyId
      && sample.effectiveTrainingPolicyId === compatibility.effectiveTrainingPolicyId
    )),
    lookaheadLeakage: false,
    originsSensiblySpaced: measuredCandidates.every((candidate) => {
      const points = candidateOriginMap.get(candidate.candidateN) ?? []
      return points.every((point) => point.date > (recentWindowStartExclusive ?? '') && point.date <= (latestLawfulMaturedOrigin ?? ''))
    }),
    recentFullHistoryFallback: false,
    measuredCandidateOriginCountEqualsN: measuredCandidates.every((candidate) => candidate.status !== 'MEASURED' || candidate.actualOriginCount === candidate.candidateN),
    recentProductionArtifactWriteCount,
    reason: originPool.length === 0 ? 'INSUFFICIENT_RECENT_ORIGINS' : null,
  } satisfies FullVerificationMeasurement
}

async function measureConcurrentCurrentProfile(
  profile: ProfilerProfile,
  expectedFinalExactReadStatus: 'AVAILABLE' | 'HIT',
): Promise<ConcurrentProfileMeasurement> {
  await clearProfilerProfileArtifacts(profile)

  const recorder = new TelemetryRecorder()
  const libraryService = createForecastLibraryService({
    telemetry: recorder,
    logEvent: (event, metrics) => recorder.log(event, metrics),
  })
  const interactiveService = createInstrumentedInteractiveService(recorder)
  const identity = buildInteractiveIdentity(profile)
  const periodLogicalArtifactKey = profile.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME'
    ? await resolvePeriodicCurrentLogicalArtifactKey(profile)
    : null
  const artifactCountBefore = await countPersistedArtifacts(profile)
  recorder.drain()
  let releaseStart!: () => void
  const startBarrier = new Promise<void>((resolve) => {
    releaseStart = resolve
  })

  if (periodLogicalArtifactKey) {
    setForecastPersistenceTestHooks({
      afterOwnerFenceAcquired: async (ownership) => {
        if (ownership.logicalArtifactKey !== periodLogicalArtifactKey) {
          return
        }

        await waitForAuthoritativeWaiters(periodLogicalArtifactKey, 4)
      },
    })
  }

  const isRollingDailyPreparationResult = (result: ConcurrentMeasurementResult): result is Awaited<ReturnType<typeof interactiveService.prepareCurrent>> => {
    return result.status === 'READY' || result.status === 'REUSED'
  }

  let results: Array<{ result: ConcurrentMeasurementResult; durationMs: number }>

  try {
    const requests = Array.from({ length: 5 }, async () => {
      await startBarrier
      const startedAt = performance.now()
      const result = profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
        ? await interactiveService.prepareCurrent(identity)
        : await libraryService.resolveCurrentForecastRequest({
            seriesId: profile.seriesId,
            modelId: profile.modelId,
            targetBasis: profile.targetBasis,
            sourceFrequency: profile.sourceFrequency,
            targetCadence: profile.targetCadence,
          })
      const durationMs = roundMs(performance.now() - startedAt)
      return {
        result,
        durationMs,
      }
    })
    releaseStart()
    results = await Promise.all(requests)
  } finally {
    if (periodLogicalArtifactKey) {
      setForecastPersistenceTestHooks(null)
    }
  }

  const allEvents = recorder.drain()
  const ownerCountFromLedgerLogs = countEvents(allEvents, 'FORECAST_PREPARATION_EXECUTION_LEDGER', (event) => event.kind === 'log' && event.metrics.eventType === 'single_flight_owner_acquired')
  const waiterCountFromLedgerLogs = countEvents(allEvents, 'FORECAST_PREPARATION_EXECUTION_LEDGER', (event) => event.kind === 'log' && event.metrics.eventType === 'single_flight_waiter_joined')
  const ownerCountFromTelemetry = countEvents(allEvents, 'single_flight_owner_acquired', (event) => event.kind === 'telemetry' && event.metrics.operationFamily === 'CURRENT')
  const waiterCountFromTelemetry = countEvents(allEvents, 'single_flight_waiter_joined', (event) => event.kind === 'telemetry' && event.metrics.operationFamily === 'CURRENT')
  const ownerCountFromEvents = Math.max(ownerCountFromLedgerLogs, ownerCountFromTelemetry)
  const waiterCountFromEvents = Math.max(waiterCountFromLedgerLogs, waiterCountFromTelemetry)
  const modelComputeCountFromTelemetry = sumNumericMetric(allEvents, 'model_fit', 'count', (event) => event.kind === 'telemetry' && event.metrics.operation === 'current')
  const bridgeComputeCountFromTelemetry = countEvents(allEvents, 'current_compute_end', (event) => event.kind === 'telemetry')
  const authoritativeExecution = ownerCountFromEvents === 0 && waiterCountFromEvents === 0 && profile.targetSemantics !== 'ROLLING_DAILY_POINT_IN_TIME'
    ? await readLatestPeriodicCurrentExecution(profile)
    : null
  const ownerCount = ownerCountFromEvents > 0
    ? ownerCountFromEvents
    : authoritativeExecution
      ? 1
      : results.filter((result) => isRollingDailyPreparationResult(result.result) && result.result.status === 'READY').length
  const waiterCount = waiterCountFromEvents > 0
    ? waiterCountFromEvents
    : authoritativeExecution
      ? authoritativeExecution.waiterCount
      : results.filter((result) => isRollingDailyPreparationResult(result.result) && result.result.status === 'REUSED').length
  const executionCount = ownerCount + waiterCount
  const artifactWriteCount = Math.max((await countPersistedArtifacts(profile)) - artifactCountBefore, 0)
  const ownerLatencyMs = profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
    ? results.find((result) => isRollingDailyPreparationResult(result.result) && result.result.status === 'READY')?.durationMs ?? null
    : null
  const waiterLatencies = profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
    ? results.filter((result) => isRollingDailyPreparationResult(result.result) && result.result.status === 'REUSED').map((result) => result.durationMs)
    : []
  const finalExactRead = profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
    ? await readRollingDailyPreparedCurrent(profile)
    : await readPeriodicPreparedCurrent(profile)
  const finalExactReadStatus = finalExactRead.status === 'AVAILABLE'
    ? 'AVAILABLE'
    : finalExactRead.status
  const terminalArtifactCount = await countPersistedArtifacts(profile)
  const modelComputeCount = modelComputeCountFromTelemetry > 0
    ? modelComputeCountFromTelemetry
    : results.filter((result) => isRollingDailyPreparationResult(result.result) && result.result.status === 'READY').length
  const bridgeComputeCount = bridgeComputeCountFromTelemetry > 0
    ? bridgeComputeCountFromTelemetry
    : results.filter((result) => isRollingDailyPreparationResult(result.result) && result.result.status === 'READY').length
  const gateDecision = resolveConcurrentGlobalComputeGate({
    requestCount: results.length,
    ownerCount,
    waiterCount,
    modelComputeCount,
    bridgeComputeCount,
    artifactWriteCount,
    terminalArtifactCount,
    allRequestsSucceeded: profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? results.every((result) => isRollingDailyPreparationResult(result.result) && ['READY', 'REUSED'].includes(result.result.status))
      : results.every((result) => result.result.status === 'AVAILABLE'),
    finalExactReadStatus,
    expectedFinalExactReadStatus,
  })

  return {
    requestCount: results.length,
    ownerCount,
    waiterCount,
    modelComputeCount,
    bridgeComputeCount,
    artifactWriteCount,
    executionCount,
    terminalArtifactCount,
    requestLatenciesMs: results.map((result) => result.durationMs),
    ownerLatencyMs,
    waiterLatencySummary: waiterLatencies.length > 0
      ? summarizeNumericSamples(waiterLatencies)
      : NOT_STATISTICALLY_MEANINGFUL,
    allRequestsSucceeded: profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? results.every((result) => isRollingDailyPreparationResult(result.result) && ['READY', 'REUSED'].includes(result.result.status))
      : results.every((result) => result.result.status === 'AVAILABLE'),
    finalExactReadStatus,
    gate: gateDecision.gate,
    reasons: gateDecision.reasons,
  }
}

function summarizeProfile(
  profile: ProfilerProfile,
  currentMeasurements: Awaited<ReturnType<typeof measureCurrentSamples>>,
  fullVerification: FullVerificationMeasurement | null,
  concurrentOneGlobalComputeGate: 'PASS' | 'FAIL',
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
    REQUEST_ENTRY_TO_CAPABILITY_RESOLUTION_MS: summarizePhase('REQUEST_ENTRY_TO_CAPABILITY_RESOLUTION_MS'),
    CAPABILITY_RESOLUTION_MS: summarizePhase('CAPABILITY_RESOLUTION_MS'),
    HISTORY_LOAD_MS: summarizePhase('HISTORY_LOAD_MS'),
    HISTORY_PREPARATION_MS: summarizePhase('HISTORY_PREPARATION_MS'),
    FAST_SUFFIX_SELECTION_MS: summarizePhase('FAST_SUFFIX_SELECTION_MS'),
    PREPARED_LOOKUP_MS: summarizePhase('PREPARED_LOOKUP_MS'),
    EXECUTION_ADMISSION_MS: summarizePhase('EXECUTION_ADMISSION_MS'),
    EXECUTION_OWNER_ACQUIRE_MS: summarizePhase('EXECUTION_OWNER_ACQUIRE_MS'),
    EXECUTION_WAITER_OR_RECOVERY_WAIT_MS: summarizePhase('EXECUTION_WAITER_OR_RECOVERY_WAIT_MS'),
    OWNER_WAIT_MS: summarizePhase('OWNER_WAIT_MS'),
    BRIDGE_PROCESS_SPAWN_MS: summarizePhase('BRIDGE_PROCESS_SPAWN_MS'),
    BRIDGE_STDIN_SERIALIZATION_MS: summarizePhase('BRIDGE_STDIN_SERIALIZATION_MS'),
    PYTHON_BOOTSTRAP_MS: summarizePhase('PYTHON_BOOTSTRAP_MS'),
    MODEL_BRIDGE_MS: summarizePhase('MODEL_BRIDGE_MS'),
    MODEL_COMPUTE_MS: summarizePhase('MODEL_COMPUTE_MS'),
    BRIDGE_STDOUT_WAIT_MS: summarizePhase('BRIDGE_STDOUT_WAIT_MS'),
    PERSISTENCE_FENCE_MS: summarizePhase('PERSISTENCE_FENCE_MS'),
    PERSISTENCE_WRITE_MS: summarizePhase('PERSISTENCE_WRITE_MS'),
    PERSISTENCE_MS: summarizePhase('PERSISTENCE_MS'),
    EXECUTION_TERMINAL_MARK_MS: summarizePhase('EXECUTION_TERMINAL_MARK_MS'),
    POST_PERSIST_EXACT_READ_MS: summarizePhase('POST_PERSIST_EXACT_READ_MS'),
    RETURN_PATH_MS: summarizePhase('RETURN_PATH_MS'),
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
  const phaseAccounting = calculatePhaseAccounting(conservativePhaseSnapshot)
  const exactReadGateStatusesObserved = Array.from(new Set(currentMeasurements.coldSamples.map((sample) => sample.exactReadGate)))
  const warmReuseGate = currentMeasurements.warmSamples.every((sample) => sample.warmReuseGate === 'PASS') ? 'PASS' : 'FAIL'
  const currentIsolationGate = currentMeasurements.coldSamples.every((sample) => (
    sample.exactReadGate === 'PASS'
    && sample.currentIsolation.fullVerificationComputeCount === 0
    && sample.currentIsolation.recentVerificationProductionComputeCount === 0
    && sample.currentIsolation.calibrationBuildCount === 0
    && sample.currentIsolation.bandBuildCount === 0
  )) ? 'PASS' : 'FAIL'
  const reservedServingDecision = resolveEvidenceBasedServingHeadroom({
    currentSummary: totalRenderableReadySummary,
    exactPreparedReadSummary: exactReadSummary,
  })
  const recentProfileGate = fullVerification === null
    ? 'PASS'
    : fullVerification.status === 'MEASURED'
      && fullVerification.effectivePolicyMatchesCurrent
      && !fullVerification.lookaheadLeakage
      && fullVerification.originsSensiblySpaced
      && !fullVerification.recentFullHistoryFallback
      && fullVerification.measuredCandidateOriginCountEqualsN
      && fullVerification.recentProductionArtifactWriteCount === 0
      ? 'PASS'
      : 'FAIL'
  const reservedServingOverheadMs = fullVerification === null
    ? reservedServingDecision.reservedServingOverheadMs
    : fullVerification.reservedServingOverheadMs
  const sourceShaValidation = validateExpectedSourceSha({
    expectedSourceSha: gateContext.expectedSourceSha,
    profiledSourceSha: gateContext.gitHead,
  })
  const profileArtifactSourceShaMatch = sourceShaValidation.profileArtifactSourceShaMatch
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
    fastInputMetadata: currentMeasurements.coldSamples[0]?.inputMetadata ?? null,
    rollingDailyDiagnosis: currentMeasurements.coldSamples[0]?.rollingDailyIdentityDiagnostic ?? null,
    coldCurrent: {
      sampleCount: currentMeasurements.coldSamples.length,
      statusesObserved: Array.from(new Set(currentMeasurements.coldSamples.map((sample) => sample.prepareStatus))),
      exactReadStatusesObserved: Array.from(new Set(currentMeasurements.coldSamples.map((sample) => sample.exactReadStatus))),
      exactReadGateStatusesObserved,
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
      currentIsolation: {
        fullVerificationComputeCount: Math.max(0, ...currentMeasurements.coldSamples.map((sample) => sample.currentIsolation.fullVerificationComputeCount)),
        recentVerificationProductionComputeCount: Math.max(0, ...currentMeasurements.coldSamples.map((sample) => sample.currentIsolation.recentVerificationProductionComputeCount)),
        calibrationBuildCount: Math.max(0, ...currentMeasurements.coldSamples.map((sample) => sample.currentIsolation.calibrationBuildCount)),
        bandBuildCount: Math.max(0, ...currentMeasurements.coldSamples.map((sample) => sample.currentIsolation.bandBuildCount)),
      },
      phaseSummaries,
      dominantBottleneck: classifyDominantBottleneck(conservativePhaseSnapshot),
      conservativeLatencyMs: currentConservativeMs,
      phaseAccounting,
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
            latestLawfulMaturedOrigin: fullVerification.latestLawfulMaturedOrigin,
            recentWindowStartExclusive: fullVerification.recentWindowStartExclusive,
            recentWindowEndInclusive: fullVerification.recentWindowEndInclusive,
            lawfulRecentOriginCount: fullVerification.lawfulRecentOriginCount,
            selectedOriginDates: fullVerification.selectedOriginDates,
            originCount: fullVerification.originCount,
            originSamples: fullVerification.originSamples,
            reservedServingOverheadMs: fullVerification.reservedServingOverheadMs,
            reservedServingOverheadBasis: fullVerification.reservedServingOverheadBasis,
            reservedServingOverheadComponents: fullVerification.reservedServingOverheadComponents,
            servingHeadroomDoubleCounted: fullVerification.servingHeadroomDoubleCounted,
            effectivePolicyMatchesCurrent: fullVerification.effectivePolicyMatchesCurrent,
            lookaheadLeakage: fullVerification.lookaheadLeakage,
            originsSensiblySpaced: fullVerification.originsSensiblySpaced,
            recentFullHistoryFallback: fullVerification.recentFullHistoryFallback,
            measuredCandidateOriginCountEqualsN: fullVerification.measuredCandidateOriginCountEqualsN,
            recentProductionArtifactWriteCount: fullVerification.recentProductionArtifactWriteCount,
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
      reservedServingOverheadBasis: fullVerification === null
        ? reservedServingDecision.reservedServingOverheadBasis
        : fullVerification.reservedServingOverheadBasis,
      servingHeadroomDoubleCounted: fullVerification === null
        ? reservedServingDecision.servingHeadroomDoubleCounted
        : fullVerification.servingHeadroomDoubleCounted,
      currentRuntimeVarianceIncludedInReserve: false,
      expectedSourceShaFormat: sourceShaValidation.expectedSourceShaFormat,
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
    profiledSourceSha: string | null
    expectedSourceShaFormat: string
    profileArtifactSourceShaMatch: boolean
  }
  configuration: {
    profileMode: ProfileMode
    coldSamples: number
    warmSamples: number
    recentCandidates: readonly number[]
    fastReadyBudgetMs: number
  }
  regressions: {
    stage4NonRegression: 'PASS' | 'FAIL'
    stage5NonRegression: 'PASS' | 'FAIL'
  }
  profiles: ReturnType<typeof summarizeProfile>[]
  finalDecision: ReturnType<typeof resolveStage6FinalDecision>
  focusedQuarterlyDiagnostic: FocusedQuarterlyDiagnostic
  concurrencyEvidence: {
    period: ConcurrentProfileMeasurement
    rollingDaily: ConcurrentProfileMeasurement
    concurrentOneGlobalComputeGate: 'PASS' | 'FAIL'
  }
}) {
  const lines = [
    '# PPF-1 Stage 6 FAST_READY Profiler',
    '',
    `Generated at: ${result.generatedAt}`,
    `Branch: ${result.branch ?? 'UNKNOWN'}`,
    `Git HEAD: ${result.gitHead ?? 'UNKNOWN'}`,
    `Expected source SHA: ${result.evidence.expectedSourceSha ?? 'UNSPECIFIED'}`,
    `Profiled source SHA: ${result.evidence.profiledSourceSha ?? 'UNSPECIFIED'}`,
    `Expected source SHA format: ${result.evidence.expectedSourceShaFormat}`,
    `Profile artifact source SHA match: ${result.evidence.profileArtifactSourceShaMatch ? 'YES' : 'NO'}`,
    `Profile mode: ${result.configuration.profileMode}`,
    `Cold samples per profile: ${result.configuration.coldSamples}`,
    `Warm prepared-hit samples per profile: ${result.configuration.warmSamples}`,
    `Recent Verification candidates: ${result.configuration.recentCandidates.join(', ')}`,
    '',
    '## Final Decision',
    '',
    `STAGE6_COMPLETION = ${result.finalDecision.stage6Completion}`,
    `CURRENT_FAST_LATENCY_GATE = ${result.finalDecision.currentFastLatencyGate}`,
    `ROLLING_DAILY_EXACT_READ_GATE = ${result.finalDecision.rollingDailyExactReadGate}`,
    `WARM_REUSE_GATE = ${result.finalDecision.warmReuseGate}`,
    `CONCURRENT_ONE_GLOBAL_COMPUTE_GATE = ${result.finalDecision.concurrentOneGlobalComputeGate}`,
    `CURRENT_ISOLATION_GATE = ${result.finalDecision.currentIsolationGate}`,
    `RECENT_PROFILE_GATE = ${result.finalDecision.recentProfileGate}`,
    `FAST_READY_PROFILER_GATE = ${result.finalDecision.fastReadyProfilerGate}`,
    `GLOBAL_N_FAST_RECOMMENDATION = ${String(result.finalDecision.globalNFastRecommendation)}`,
    `RECENT_SYNC_RECOMMENDATION = ${result.finalDecision.recentSyncRecommendation}`,
    `RESERVED_SERVING_OVERHEAD_MS = ${result.finalDecision.reservedServingOverheadMs}`,
    `PERFORMANCE_CORRECTIVE_REQUIRED = ${result.finalDecision.performanceCorrectiveRequired ? 'YES' : 'NO'}`,
    `READY_FOR_STAGE7 = ${result.finalDecision.readyForStage7 ? 'YES' : 'NO'}`,
    '',
    '## Focused Quarterly ARIMA Diagnostic',
    '',
    `Sample count: ${result.focusedQuarterlyDiagnostic.sampleCount}`,
    `Median ms: ${result.focusedQuarterlyDiagnostic.medianMs}`,
    `Max ms: ${result.focusedQuarterlyDiagnostic.maxMs}`,
    `Over 15s: ${result.focusedQuarterlyDiagnostic.countOver15s}`,
    `Over 30s: ${result.focusedQuarterlyDiagnostic.countOver30s}`,
    `Over 60s: ${result.focusedQuarterlyDiagnostic.countOver60s}`,
    `Outlier classification: ${result.focusedQuarterlyDiagnostic.outlierClassification}`,
    `Accounted phase total ms: ${result.focusedQuarterlyDiagnostic.accountedPhaseTotalMs}`,
    `Unattributed ms: ${result.focusedQuarterlyDiagnostic.unattributedMs}`,
    `Unattributed share pct: ${result.focusedQuarterlyDiagnostic.unattributedSharePct}`,
    `Root cause resolution: ${result.focusedQuarterlyDiagnostic.rootCauseResolution}`,
    '',
    '## Full Final Profile Table',
    '',
    '| Profile | Series | Model | Frequency | Cadence | Selected obs | Extended 12M | Cold n | Cold median | Cold max | Cold p95 | Warm p95/max | Exact read | Current gate | Recent max N |',
    '| --- | --- | --- | --- | --- | ---: | --- | ---: | ---: | ---: | --- | ---: | --- | --- | ---: |',
  ]

  for (const profile of result.profiles) {
    const coldP95 = typeof profile.coldCurrent.totalRenderableReady.p95Ms === 'number'
      ? profile.coldCurrent.totalRenderableReady.p95Ms
      : 'NOT_STATISTICALLY_MEANINGFUL'
    const warm = typeof profile.coldCurrent.warmPreparedHit.p95Ms === 'number'
      ? profile.coldCurrent.warmPreparedHit.p95Ms
      : profile.coldCurrent.warmPreparedHit.maxMs
    const maxInline = profile.recentVerification.mode === 'NOT_APPLICABLE' ? 'N/A' : String(profile.recentVerification.maxInlineCandidate)
    lines.push(`| ${profile.profileId} | ${profile.seriesId} | ${profile.modelId} | ${profile.sourceFrequency} | ${profile.targetCadence} | ${profile.fastInputMetadata?.selectedTrainingObservationCount ?? 'N/A'} | ${profile.fastInputMetadata?.extendedBeyond12M ? 'YES' : 'NO'} | ${profile.coldCurrent.sampleCount} | ${profile.coldCurrent.totalRenderableReady.medianMs} | ${profile.coldCurrent.totalRenderableReady.maxMs} | ${coldP95} | ${warm} | ${profile.coldCurrent.exactReadStatusesObserved.join(', ')} | ${profile.finalGate.currentFastLatencyGate} | ${maxInline} |`)
  }

  lines.push('', '## Final Recent Table', '')
  lines.push('| Profile | Candidate N | Status | Origins | Origin dates | Direct recent ms | Current conservative ms | Reserved headroom ms | Estimated total ms | Within 15s |')
  lines.push('| --- | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |')
  for (const profile of result.profiles) {
    if (!('measuredCandidates' in profile.recentVerification)) {
      continue
    }
    for (const candidate of profile.recentVerification.measuredCandidates ?? []) {
      lines.push(`| ${profile.profileId} | ${candidate.candidateN} | ${candidate.status} | ${candidate.actualOriginCount} | ${candidate.originDates.join(', ')} | ${candidate.recentVerificationMs ?? 'N/A'} | ${candidate.currentConservativeMs ?? 'N/A'} | ${candidate.reservedServingOverheadMs ?? 'N/A'} | ${candidate.estimatedTotalFastReadyMs ?? 'N/A'} | ${candidate.within15s === null ? 'N/A' : candidate.within15s ? 'YES' : 'NO'} |`)
    }
  }

  lines.push('', '## Final Concurrency Section', '')
  lines.push(`PERIOD_CONCURRENCY: requestCount=${result.concurrencyEvidence.period.requestCount} ownerCount=${result.concurrencyEvidence.period.ownerCount} waiterCount=${result.concurrencyEvidence.period.waiterCount} computeCount=${result.concurrencyEvidence.period.modelComputeCount} artifactWriteCount=${result.concurrencyEvidence.period.artifactWriteCount} terminalArtifactCount=${result.concurrencyEvidence.period.terminalArtifactCount} finalExactReadStatus=${result.concurrencyEvidence.period.finalExactReadStatus} gate=${result.concurrencyEvidence.period.gate}`)
  lines.push(`ROLLING_DAILY_CONCURRENCY: requestCount=${result.concurrencyEvidence.rollingDaily.requestCount} ownerCount=${result.concurrencyEvidence.rollingDaily.ownerCount} waiterCount=${result.concurrencyEvidence.rollingDaily.waiterCount} computeCount=${result.concurrencyEvidence.rollingDaily.modelComputeCount} artifactWriteCount=${result.concurrencyEvidence.rollingDaily.artifactWriteCount} terminalArtifactCount=${result.concurrencyEvidence.rollingDaily.terminalArtifactCount} finalExactReadStatus=${result.concurrencyEvidence.rollingDaily.finalExactReadStatus} gate=${result.concurrencyEvidence.rollingDaily.gate}`)

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
  const profileMode = readProfileModeArg()
  const coldSamples = readIntArg('--cold-samples', DEFAULT_COLD_SAMPLES)
  const warmSamples = readIntArg('--warm-samples', DEFAULT_WARM_SAMPLES)
  const recentCandidates = readCandidateNs()
  const stage4NonRegression = readPassFailArg('--stage4-non-regression')
  const stage5NonRegression = readPassFailArg('--stage5-non-regression')
  const focusedQuarterlyDiagnosticOnly = readBooleanArg('--focused-quarterly-diagnostic-only')
  const skipRecentVerification = readBooleanArg('--skip-recent-verification')
  const requestedProfileWorktreeMode = readProfileWorktreeModeArg()
  const configurationContract = resolveProfilerConfigurationContract({
    profileMode,
    coldSamples,
    warmSamples,
    recentCandidates,
  })
  if (profileMode === 'FINAL' && !configurationContract.validForRequestedMode) {
    throw new Error(configurationContract.reason ?? 'Final profiler configuration is invalid.')
  }
  const gitHead = await readGitValue(['rev-parse', 'HEAD'])
  const branch = await readGitValue(['rev-parse', '--abbrev-ref', 'HEAD'])
  const expectedSourceSha = readStringArg('--expected-source-sha')
  const sourceShaValidation = validateExpectedSourceSha({
    expectedSourceSha,
    profiledSourceSha: gitHead,
  })
  if (profileMode === 'FINAL' && sourceShaValidation.expectedSourceShaFormat !== 'FULL_40_CHAR_SHA') {
    throw new Error('Final profiler mode requires --expected-source-sha with the exact full 40-character source commit SHA.')
  }

  for (const definition of SYNTHETIC_SERIES_DEFINITIONS) {
    await seedHistory(buildSyntheticHistory(definition))
  }
  await clearProfilerArtifacts(SYNTHETIC_SERIES_DEFINITIONS.map((definition) => definition.seriesId))

  const profiles = await buildProfiles()
  const quarterlyArimaProfile = profiles.find((profile) => profile.profileId === `${QUARTERLY_SERIES_ID}|END_OF_PERIOD|arima`)
  if (!quarterlyArimaProfile) {
    throw new Error('Required quarterly ARIMA profile is unavailable for the Stage 6 diagnostic.')
  }
  const focusedQuarterlyDiagnostic = await runFocusedQuarterlyArimaDiagnostic(quarterlyArimaProfile)
  if (focusedQuarterlyDiagnosticOnly) {
    process.stdout.write(`${JSON.stringify({ status: 'PASS', focusedQuarterlyDiagnostic }, null, 2)}\n`)
    return
  }
  const rawProfiles: Array<{
    profile: ProfilerProfile
    currentMeasurements: Awaited<ReturnType<typeof measureCurrentSamples>>
    fullVerification: FullVerificationMeasurement | null
  }> = []

  for (const profile of profiles) {
    const currentMeasurements = await measureCurrentSamples(profile, coldSamples, warmSamples)
    const currentSummary = summarizeNumericSamples(currentMeasurements.coldSamples.map((sample) => sample.totalRenderableReadyMs))
    const exactPreparedReadSummary = summarizeNumericSamples(currentMeasurements.coldSamples.map((sample) => sample.exactReadMs))
    const currentConservativeMs = resolveConservativeLatencyMs(currentSummary)
    const reservedServingDecision = resolveEvidenceBasedServingHeadroom({
      currentSummary,
      exactPreparedReadSummary,
    })

    const fullVerification = profile.recentVerificationMode === 'NOT_APPLICABLE' || skipRecentVerification
      ? null
      : await measureFullVerification(profile, recentCandidates, currentConservativeMs, reservedServingDecision)

    rawProfiles.push({
      profile,
      currentMeasurements,
      fullVerification,
    })
  }

  const periodConcurrencyProfile = rawProfiles.find((entry) => entry.profile.seriesId === MONTHLY_SERIES_ID && entry.profile.modelId === 'arima' && entry.profile.targetSemantics === 'END_OF_PERIOD')?.profile
  const rollingDailyConcurrencyProfile = rawProfiles.find((entry) => entry.profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME' && entry.profile.modelId === 'arima')?.profile
  if (!periodConcurrencyProfile || !rollingDailyConcurrencyProfile) {
    throw new Error('Required concurrency cohorts were not available for Stage 6 profiling.')
  }

  const periodConcurrency = await measureConcurrentCurrentProfile(periodConcurrencyProfile, 'AVAILABLE')
  const rollingDailyConcurrency = await measureConcurrentCurrentProfile(rollingDailyConcurrencyProfile, 'HIT')
  const concurrentOneGlobalComputeGate: 'PASS' | 'FAIL' = periodConcurrency.gate === 'PASS' && rollingDailyConcurrency.gate === 'PASS'
    ? 'PASS'
    : 'FAIL'

  const summarizedProfiles = rawProfiles.map(({ profile, currentMeasurements, fullVerification }) => summarizeProfile(
    profile,
    currentMeasurements,
    fullVerification,
    concurrentOneGlobalComputeGate,
    {
      gitHead,
      expectedSourceSha,
      stage4NonRegression,
      stage5NonRegression,
    },
  ))

  const recentMaxima = summarizedProfiles
    .filter((profile) => profile.recentVerification.mode !== 'NOT_APPLICABLE')
    .map((profile) => profile.recentVerification.maxInlineCandidate)
    .filter((value): value is number => typeof value === 'number')

  const globalDecision = resolveGlobalNFastDecision(recentMaxima)
  const rollingDailyProfiles = summarizedProfiles.filter((profile) => profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME')
  const rollingDailyExactReadGate = rollingDailyProfiles.every((profile) => profile.coldCurrent.exactReadStatusesObserved.every((status: string) => status === 'HIT'))
    ? 'PASS'
    : 'FAIL'
  const currentFastLatencyGate = summarizedProfiles.every((profile) => profile.finalGate.currentFastLatencyGate === 'PASS') ? 'PASS' : 'FAIL'
  const warmReuseGate = summarizedProfiles.every((profile) => profile.finalGate.warmReuseGate === 'PASS') ? 'PASS' : 'FAIL'
  const currentIsolationGate = summarizedProfiles.every((profile) => profile.finalGate.currentIsolationGate === 'PASS') ? 'PASS' : 'FAIL'
  const recentProfileGate = summarizedProfiles.every((profile) => profile.finalGate.recentProfileGate === 'PASS') ? 'PASS' : 'FAIL'
  const profilesPassing = summarizedProfiles.filter((profile) => profile.finalGate.fastReadyProfilerGate === 'PASS').length
  const profilesFailing = summarizedProfiles.length - profilesPassing
  const overallFastReadyProfilerGate: 'PASS' | 'FAIL' = profilesFailing === 0 ? 'PASS' : 'FAIL'
  const reservedServingOverheadMs = Math.max(...summarizedProfiles.map((profile) => profile.finalGate.reservedServingOverheadMs))
  const environment = await readEnvironmentMetadata({
    profileMode,
    coldSamples,
    warmSamples,
    recentCandidates,
    expectedSourceSha,
    profiledSourceSha: gitHead,
    profileWorktreeMode: requestedProfileWorktreeMode,
  })
  const environmentValidation = validateProfileEnvironmentMetadata(environment as Record<string, unknown>)
  const finalDecision = resolveStage6FinalDecision({
    profileMode,
    configurationContract,
    currentFastLatencyGate,
    rollingDailyExactReadGate,
    warmReuseGate,
    concurrentOneGlobalComputeGate,
    currentIsolationGate,
    recentProfileGate,
    fastReadyProfilerGate: overallFastReadyProfilerGate,
    globalNFastRecommendation: globalDecision.globalRecommendation,
    profileSpecificNFastRequired: globalDecision.profileSpecificRequired,
    recentSyncRecommendation: globalDecision.recommendation,
    reservedServingOverheadMs,
    reservedServingOverheadBasis: 'MEASURED_CANONICAL_HANDOFF_PROXY',
    profileArtifactSourceShaMatch: sourceShaValidation.profileArtifactSourceShaMatch,
    fastInputMetadataComplete: summarizedProfiles.every((profile) => profile.fastInputMetadata !== null),
    profileEnvironmentMetadataComplete: environmentValidation.complete,
    stage4NonRegression,
    stage5NonRegression,
    currentFastPolicyChanged: false,
    modelMinHistoryChanged: false,
    methodVersionChanged: false,
    recentVerificationProductionActivated: false,
    stage7ScopeLeakage: false,
    stage8PlusScopeLeakage: false,
  })

  const result = {
    task: 'PPF1_STAGE6_FAST_READY_PROFILER',
    generatedAt: new Date().toISOString(),
    gitHead,
    branch,
    evidence: {
      expectedSourceSha,
      profiledSourceSha: gitHead,
      expectedSourceShaFormat: sourceShaValidation.expectedSourceShaFormat,
      profileArtifactSourceShaMatch: sourceShaValidation.profileArtifactSourceShaMatch,
      sourceTreeExactlyMatchesProfiledSourceSha: sourceShaValidation.sourceTreeExactlyMatchesProfiledSourceSha && environment.workingTreeCleanAtProfileStart,
    },
    regressions: {
      stage4NonRegression,
      stage5NonRegression,
    },
    configuration: {
      profileMode,
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
    environment,
    profiles: summarizedProfiles,
    focusedQuarterlyDiagnostic,
    rollingDailyDiagnosis: rollingDailyProfiles.map((profile) => profile.rollingDailyDiagnosis),
    globalDecision,
    currentIsolation: {
      fullVerificationComputeCount: Math.max(0, ...summarizedProfiles.map((profile) => profile.coldCurrent.currentIsolation.fullVerificationComputeCount)),
      recentVerificationProductionComputeCount: Math.max(0, ...summarizedProfiles.map((profile) => profile.coldCurrent.currentIsolation.recentVerificationProductionComputeCount)),
      calibrationBuildCount: Math.max(0, ...summarizedProfiles.map((profile) => profile.coldCurrent.currentIsolation.calibrationBuildCount)),
      bandBuildCount: Math.max(0, ...summarizedProfiles.map((profile) => profile.coldCurrent.currentIsolation.bandBuildCount)),
    },
    concurrencyEvidence: {
      period: periodConcurrency,
      rollingDaily: rollingDailyConcurrency,
      concurrentOneGlobalComputeGate,
    },
    validation: {
      configurationContract,
      profileEnvironmentMetadataComplete: environmentValidation.complete,
      environmentMissingFields: environmentValidation.missingFields,
      stage6FinalCorrectiveTests: null,
    },
    finalGate: {
      fastReadyProfilerGate: overallFastReadyProfilerGate,
      performanceCorrectiveRequired: finalDecision.performanceCorrectiveRequired,
      profilesPassing,
      profilesFailing,
    },
    finalDecision,
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