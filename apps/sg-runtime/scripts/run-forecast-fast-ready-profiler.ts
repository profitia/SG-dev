import './load-env'

import { execFile as execFileCallback } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import path from 'node:path'
import { promisify } from 'node:util'

import { Prisma } from '@/generated/market-data-client'
import { resolveForecastTechnicalMinimumObservations } from '@/lib/forecast/current-fast-policy'
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
  evaluateRecentBudgetCandidates,
  NOT_SEPARATELY_MEASURABLE,
  resolveConservativeLatencyMs,
  resolveGlobalNFastDecision,
  summarizeNumericSamples,
  summarizeOptionalPhaseSamples,
} from '@/lib/forecast/fast-ready-profiler'
import {
  createInteractiveForecastPreparationService,
  type InteractiveForecastIdentity,
  resolveInteractiveForecastCapability,
} from '@/lib/forecast/interactive-preparation'
import { buildForecastHistoryFingerprint } from '@/lib/forecast/history-fingerprint'
import {
  buildForecastArtifactCadenceIdentity,
  createCurrentForecastStatisticalCompatibility,
  resolveForecastMethodContract,
} from '@/lib/forecast/identity'
import {
  buildLiveForecastBridgePayloadFromHistory,
  selectMinimalLawfulCurrentTrainingPayload,
} from '@/lib/forecast/live-market-input'
import { buildRollingDailyHistoryFingerprint } from '@/lib/forecast/rolling-daily-maintenance'
import { readRollingDailyCurrentForecastSnapshot } from '@/lib/forecast/rolling-daily-current-forecast-snapshot'
import {
  createForecastLibraryService,
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
const DEFAULT_WARM_SAMPLES = 10
const DEFAULT_RECENT_CANDIDATES = [1, 3, 6, 12] as const
const FAST_READY_BUDGET_MS = 15_000
const RESERVED_SERVING_OVERHEAD_MS = 0
const MACROBOND_PROVIDER_CODE = 'MACROBOND'
const DAILY_SERIES_ID = 'ppf1-stage6-daily-profile-v1'

type TargetSemantics = 'MONTHLY_AVERAGE' | 'END_OF_PERIOD' | 'ROLLING_DAILY_POINT_IN_TIME'

type ProfilerProfile = {
  profileId: string
  seriesId: string
  modelId: UserFacingForecastModelId
  targetSemantics: TargetSemantics
  targetBasis: ForecastTargetBasis
  sourceFrequency: 'MONTHLY' | 'DAILY'
  targetCadence: 'MONTHLY' | 'DAILY'
  recentVerificationMode: 'LINEAR_FULL_VERIFICATION_ORIGIN_SCALING' | 'NOT_APPLICABLE'
}

type RecorderEvent = {
  event: string
  metrics: Record<string, unknown>
}

type CurrentSample = {
  prepareStatus: string
  exactReadStatus: string
  cacheStatus: string | null
  totalRenderableReadyMs: number
  exactReadMs: number
  phases: Partial<Record<ProfiledPhaseName, number | null>>
  runtimeSeconds: number | null
  policyId: string | null
  effectivePolicyId: string | null
}

type FullVerificationMeasurement = {
  status: 'MEASURED' | 'ZERO_ORIGIN_DIAGNOSTIC'
  totalWallMs: number
  computeMs: number
  persistenceMs: number | null
  originCount: number
  cacheStatus: string
  runtimeSeconds: number | null
  estimatedRecentCandidates: ReturnType<typeof evaluateRecentBudgetCandidates>
  maxInlineCandidate: number
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
    this.events.push({ event, metrics })
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

async function seedHistory(history: ReturnType<typeof buildMonthlyHistory> | ReturnType<typeof buildDailyHistory>) {
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

function buildProfiles() {
  const profiles: ProfilerProfile[] = []

  for (const modelId of USER_FACING_FORECAST_MODELS) {
    profiles.push({
      profileId: `${DAILY_SERIES_ID}|MONTHLY_AVERAGE|${modelId}`,
      seriesId: DAILY_SERIES_ID,
      modelId,
      targetSemantics: 'MONTHLY_AVERAGE',
      targetBasis: 'MONTHLY_AVERAGE',
      sourceFrequency: 'DAILY',
      targetCadence: 'MONTHLY',
      recentVerificationMode: 'LINEAR_FULL_VERIFICATION_ORIGIN_SCALING',
    })
    profiles.push({
      profileId: `${DAILY_SERIES_ID}|END_OF_PERIOD|${modelId}`,
      seriesId: DAILY_SERIES_ID,
      modelId,
      targetSemantics: 'END_OF_PERIOD',
      targetBasis: 'END_OF_PERIOD',
      sourceFrequency: 'DAILY',
      targetCadence: 'MONTHLY',
      recentVerificationMode: 'LINEAR_FULL_VERIFICATION_ORIGIN_SCALING',
    })
    profiles.push({
      profileId: `${DAILY_SERIES_ID}|ROLLING_DAILY_POINT_IN_TIME|${modelId}`,
      seriesId: DAILY_SERIES_ID,
      modelId,
      targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      targetBasis: 'POINT_IN_TIME',
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
      recentVerificationMode: 'NOT_APPLICABLE',
    })
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

async function readRollingDailyPreparedCurrent(profile: ProfilerProfile) {
  const history = await resolveBenchmarkHistoricalSeries(profile.seriesId, 'ALL')
  const sourceHistoryFingerprint = buildRollingDailyHistoryFingerprint({
    seriesId: profile.seriesId,
    displayName: history.history.displayName,
    description: history.history.displayName,
    frequency: 'DAILY',
    source: history.source,
    points: history.history.historical,
  })
  return readRollingDailyCurrentForecastSnapshot({
    seriesId: profile.seriesId,
    modelId: profile.modelId,
    sourceHistoryFingerprint,
  })
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
    logEvent: () => {},
  })
  const interactiveService = createInteractiveForecastPreparationService({
    prepareMonthlyCurrent: (input) => libraryService.resolveCurrentForecastRequest(input),
  })

  const identity = buildInteractiveIdentity(profile)
  const request = buildServiceRequest(profile)
  const coldSamples: CurrentSample[] = []
  const warmReadSamples: number[] = []

  for (let index = 0; index < coldSampleCount; index += 1) {
    await clearProfilerArtifacts([profile.seriesId])

    const capability = await resolveInteractiveForecastCapability(identity)
    const periodicSurface = profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? null
      : await measurePeriodicPreparationSurface(profile)

    recorder.drain()

    const prepareStartedAt = performance.now()
    const preparation = await interactiveService.prepareCurrent(identity)
    const prepareMs = performance.now() - prepareStartedAt
    const currentEvents = recorder.drain()

    if (!['READY', 'REUSED'].includes(preparation.status)) {
      throw new Error(`Current preparation failed for ${profile.profileId}: ${preparation.status} ${preparation.reason ?? ''}`.trim())
    }

    const exactReadStartedAt = performance.now()
    const exactRead = profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME'
      ? await readRollingDailyPreparedCurrent(profile)
      : await readPeriodicPreparedCurrent(profile)
    const exactReadMs = performance.now() - exactReadStartedAt

    if (profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') {
      if (exactRead.status !== 'HIT' && exactRead.status !== 'STALE') {
        throw new Error(`Rolling Daily prepared read failed for ${profile.profileId}: ${exactRead.status}`)
      }
      const rollingDailyCompatibility = createCurrentForecastStatisticalCompatibility({
        sourceFrequency: 'DAILY',
        targetCadence: 'DAILY',
        targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
      })
      coldSamples.push({
        prepareStatus: preparation.status,
        exactReadStatus: exactRead.status,
        cacheStatus: exactRead.payload.cacheStatus,
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
          MODEL_COMPUTE_MS: exactRead.payload.runtimeSeconds === null ? null : roundMs(exactRead.payload.runtimeSeconds * 1000),
          PERSISTENCE_MS: null,
          POST_PERSIST_EXACT_READ_MS: roundMs(exactReadMs),
          CONSUMER_ADAPTER_MS: null,
          TOTAL_RENDERABLE_READY_MS: roundMs(prepareMs + exactReadMs),
          ROLLING_DAILY_OWNERSHIP_PREPARATION_MS: capability.timingMs,
          ROLLING_DAILY_SNAPSHOT_PERSIST_MS: null,
        },
        runtimeSeconds: exactRead.payload.runtimeSeconds,
        policyId: rollingDailyCompatibility.trainingWindowPolicyId,
        effectivePolicyId: rollingDailyCompatibility.effectiveTrainingPolicyId,
      })
    } else {
      const computeDurationMs = findLatestNumericMetric(currentEvents, 'current_compute_end', 'durationMs')
      const persistenceDurationMs = findLatestNumericMetric(currentEvents, 'persistence', 'durationMs')
      const runtimeMs = exactRead.runtimeSeconds === null ? null : roundMs(exactRead.runtimeSeconds * 1000)

      coldSamples.push({
        prepareStatus: preparation.status,
        exactReadStatus: exactRead.status,
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
    const warmReadStartedAt = performance.now()
    if (profile.targetSemantics === 'ROLLING_DAILY_POINT_IN_TIME') {
      const exactRead = await readRollingDailyPreparedCurrent(profile)
      if (exactRead.status !== 'HIT' && exactRead.status !== 'STALE') {
        throw new Error(`Rolling Daily warm prepared read failed for ${profile.profileId}: ${exactRead.status}`)
      }
    } else {
      await readPeriodicPreparedCurrent(profile)
    }
    warmReadSamples.push(roundMs(performance.now() - warmReadStartedAt))
  }

  return {
    coldSamples,
    warmReadSamples,
  }
}

async function measureFullVerification(
  profile: ProfilerProfile,
  candidateNs: readonly number[],
  currentConservativeMs: number,
) {
  const recorder = new TelemetryRecorder()
  const libraryService = createForecastLibraryService({
    telemetry: recorder,
    logEvent: () => {},
  })

  await clearProfilerArtifacts([profile.seriesId])

  const verificationStartedAt = performance.now()
  const verificationResult = await libraryService.resolveVerificationRequest(buildServiceRequest(profile))
  const totalWallMs = performance.now() - verificationStartedAt
  const verificationEvents = recorder.drain()
  const available = requireAvailableVerification(verificationResult, profile)
  const verificationComputeMs = findLatestNumericMetric(verificationEvents, 'verification_compute_end', 'durationMs')
  const persistenceMs = findLatestNumericMetric(verificationEvents, 'persistence', 'durationMs')
  const eventOriginCount = findLatestNumericMetric(verificationEvents, 'verification_compute_end', 'originCount')
  const originCount = eventOriginCount === null
    ? Object.values(available.verification).reduce((sum, horizon) => sum + horizon.origins, 0)
    : eventOriginCount
  const computeMs = verificationComputeMs === null ? totalWallMs : verificationComputeMs

  if (originCount <= 0) {
    return {
      status: 'ZERO_ORIGIN_DIAGNOSTIC',
      totalWallMs: roundMs(totalWallMs),
      computeMs: roundMs(computeMs),
      persistenceMs: persistenceMs === null ? null : roundMs(persistenceMs),
      originCount,
      cacheStatus: available.cacheStatus,
      runtimeSeconds: available.runtimeSeconds,
      estimatedRecentCandidates: [],
      maxInlineCandidate: 0,
      reason: 'Full Verification resolved with zero origins on the profiled seeded path.',
    } satisfies FullVerificationMeasurement
  }

  const fixedVerificationOverheadMs = Math.max(totalWallMs - computeMs, 0)
  const recentVerificationMsByCandidate = new Map<number, number>(
    candidateNs.map((candidateN) => [
      candidateN,
      fixedVerificationOverheadMs + ((computeMs / originCount) * candidateN),
    ]),
  )
  const estimatedRecentCandidates = evaluateRecentBudgetCandidates({
    candidateNs,
    recentVerificationMsByCandidate,
    currentConservativeMs,
    reservedServingOverheadMs: RESERVED_SERVING_OVERHEAD_MS,
    totalBudgetMs: FAST_READY_BUDGET_MS,
  })

  return {
    status: 'MEASURED',
    totalWallMs: roundMs(totalWallMs),
    computeMs: roundMs(computeMs),
    persistenceMs: persistenceMs === null ? null : roundMs(persistenceMs),
    originCount,
    cacheStatus: available.cacheStatus,
    runtimeSeconds: available.runtimeSeconds,
    estimatedRecentCandidates,
    maxInlineCandidate: Math.max(0, ...estimatedRecentCandidates.filter((item) => item.within15s).map((item) => item.candidateN)),
    reason: null,
  } satisfies FullVerificationMeasurement
}

function summarizeProfile(profile: ProfilerProfile, currentMeasurements: Awaited<ReturnType<typeof measureCurrentSamples>>, fullVerification: FullVerificationMeasurement | null) {
  const totalRenderableReadySummary = summarizeNumericSamples(
    currentMeasurements.coldSamples.map((sample) => sample.totalRenderableReadyMs),
  )
  const exactReadSummary = summarizeNumericSamples(
    currentMeasurements.coldSamples.map((sample) => sample.exactReadMs),
  )
  const warmPreparedHitSummary = summarizeNumericSamples(currentMeasurements.warmReadSamples)

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
      cacheStatusesObserved: Array.from(new Set(currentMeasurements.coldSamples.map((sample) => sample.cacheStatus).filter(Boolean))),
      totalRenderableReady: totalRenderableReadySummary,
      exactPreparedRead: exactReadSummary,
      warmPreparedHit: warmPreparedHitSummary,
      phaseSummaries,
      dominantBottleneck: classifyDominantBottleneck(conservativePhaseSnapshot),
      conservativeLatencyMs: currentConservativeMs,
    },
    recentVerification: fullVerification === null
      ? {
          mode: 'NOT_APPLICABLE',
        }
      : {
          mode: profile.recentVerificationMode,
          fullVerification: {
            status: fullVerification.status,
            totalWallMs: fullVerification.totalWallMs,
            computeMs: fullVerification.computeMs,
            persistenceMs: fullVerification.persistenceMs,
            originCount: fullVerification.originCount,
            cacheStatus: fullVerification.cacheStatus,
            runtimeSeconds: fullVerification.runtimeSeconds,
            reason: fullVerification.reason,
          },
          estimatedCandidates: fullVerification.estimatedRecentCandidates,
          maxInlineCandidate: fullVerification.maxInlineCandidate,
        },
  }
}

function renderMarkdown(result: {
  generatedAt: string
  gitHead: string | null
  branch: string | null
  configuration: {
    coldSamples: number
    warmSamples: number
    recentCandidates: readonly number[]
    fastReadyBudgetMs: number
    reservedServingOverheadMs: number
  }
  profiles: ReturnType<typeof summarizeProfile>[]
  globalDecision: ReturnType<typeof resolveGlobalNFastDecision>
}) {
  const lines = [
    '# PPF-1 Stage 6 FAST_READY Profiler',
    '',
    `Generated at: ${result.generatedAt}`,
    `Branch: ${result.branch ?? 'UNKNOWN'}`,
    `Git HEAD: ${result.gitHead ?? 'UNKNOWN'}`,
    `Cold samples per profile: ${result.configuration.coldSamples}`,
    `Warm prepared-hit samples per profile: ${result.configuration.warmSamples}`,
    `Recent Verification candidates: ${result.configuration.recentCandidates.join(', ')}`,
    `FAST_READY budget: ${result.configuration.fastReadyBudgetMs} ms`,
    '',
    '## Global Decision',
    '',
    `Recommendation: ${result.globalDecision.recommendation}`,
    `Global N_FAST: ${String(result.globalDecision.globalRecommendation)}`,
    `Profile-specific controls required: ${result.globalDecision.profileSpecificRequired}`,
    '',
    '## Profiles',
    '',
    '| Profile | Cold conservative ms | Warm hit p95/max ms | Dominant bottleneck | Max inline recent N |',
    '| --- | ---: | ---: | --- | ---: |',
  ]

  for (const profile of result.profiles) {
    const warm = typeof profile.coldCurrent.warmPreparedHit.p95Ms === 'number'
      ? profile.coldCurrent.warmPreparedHit.p95Ms
      : profile.coldCurrent.warmPreparedHit.maxMs
    const maxInline = profile.recentVerification.mode === 'NOT_APPLICABLE'
      ? 'N/A'
      : String(profile.recentVerification.maxInlineCandidate)
    lines.push(
      `| ${profile.profileId} | ${profile.coldCurrent.conservativeLatencyMs} | ${warm} | ${profile.coldCurrent.dominantBottleneck.category} | ${maxInline} |`,
    )
  }

  lines.push('', '## Notes', '')
  lines.push('- Period Current uses exact SG Runtime Current preparation plus exact prepared-read confirmation.')
  lines.push('- Rolling Daily phase gaps remain explicitly marked as NOT_SEPARATELY_MEASURABLE where the runtime does not expose an isolated lawful timing boundary.')
  lines.push('- Recent Verification capacity is estimated from measured full Verification wall time and explicit origin-count scaling, matching the existing repository rule that validation-origin count is a workload bound and does not alter the full training history.')

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

  await seedHistory(buildDailyHistory())
  await clearProfilerArtifacts([DAILY_SERIES_ID])

  const profiles = buildProfiles()
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

    summarizedProfiles.push(summarizeProfile(profile, currentMeasurements, fullVerification))
  }

  const result = {
    task: 'PPF1_STAGE6_FAST_READY_PROFILER',
    generatedAt: new Date().toISOString(),
    gitHead: await readGitValue(['rev-parse', 'HEAD']),
    branch: await readGitValue(['rev-parse', '--abbrev-ref', 'HEAD']),
    configuration: {
      coldSamples,
      warmSamples,
      recentCandidates,
      fastReadyBudgetMs: FAST_READY_BUDGET_MS,
      reservedServingOverheadMs: RESERVED_SERVING_OVERHEAD_MS,
    },
    methodology: {
      currentMeasurementMode: 'CANONICAL_PREPARE_CURRENT_PLUS_EXACT_PREPARED_READ',
      rollingDailyPhaseIsolation: 'BEST_EFFORT_WITH_EXPLICIT_NOT_SEPARATELY_MEASURABLE_GAPS',
      recentVerificationMeasurementMode: 'MEASURED_FULL_VERIFICATION_WITH_LINEAR_ORIGIN_SCALING',
      seedSeriesIds: [DAILY_SERIES_ID],
    },
    profiles: summarizedProfiles,
    globalDecision: resolveGlobalNFastDecision(recentMaxima),
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