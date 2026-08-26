import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import {
  isForecastExecutableNativeSparseFrequency,
  normalizeForecastSourceFrequency,
} from '@/lib/forecast/cadence'
import { USER_FACING_FORECAST_MODELS } from '@/lib/forecast/contracts'
import { buildForecastHistoryFingerprint } from '@/lib/forecast/history-fingerprint'
import {
  buildForecastArtifactCadenceIdentity,
  createForecastIdentity,
  LEGACY_MONTHLY_ARTIFACT_FREQUENCY,
} from '@/lib/forecast/identity'
import { buildLiveForecastBridgePayloadFromHistory } from '@/lib/forecast/live-market-input'
import {
  buildRollingDailyHistoryFingerprint,
  ROLLING_DAILY_INPUT_SOURCE,
} from '@/lib/forecast/rolling-daily-maintenance'
import type { ForecastPreparedState, ForecastPreparedVariant } from '@/lib/forecast/capability-resolver'
import { getMarketDataPrisma } from '@/lib/market-data/client'

const MONTHLY_TARGETS = ['END_OF_PERIOD', 'MONTHLY_AVERAGE'] as const

type MarketDataPrismaClient = NonNullable<ReturnType<typeof getMarketDataPrisma>>

function stateForRun(
  run: { status: string, historyFingerprint: string, frequency: string | null } | null,
  expectedFingerprints: { legacy: string, cadence: string },
): ForecastPreparedState {
  if (!run) return 'NOT_PREPARED'
  const expectedFingerprint = run.frequency === LEGACY_MONTHLY_ARTIFACT_FREQUENCY
    ? expectedFingerprints.legacy
    : expectedFingerprints.cadence
  return run.status === 'AVAILABLE' && run.historyFingerprint === expectedFingerprint
    ? 'READY'
    : 'STALE'
}

function stateForFingerprint(
  storedFingerprint: string | null | undefined,
  expectedFingerprint: string,
  exists: boolean,
): ForecastPreparedState {
  if (!exists) return 'NOT_PREPARED'
  return storedFingerprint === expectedFingerprint ? 'READY' : 'STALE'
}

export async function readForecastPreparedVariants(
  seriesId: string,
  history: BenchmarkHistoricalSeriesResult,
  options: { prisma?: MarketDataPrismaClient, now?: Date } = {},
): Promise<ForecastPreparedVariant[]> {
  const prisma = options.prisma ?? getMarketDataPrisma()
  if (!prisma) return []

  const sourceFrequency = normalizeForecastSourceFrequency(history.frequency)
  if (sourceFrequency !== 'DAILY' && !isForecastExecutableNativeSparseFrequency(sourceFrequency)) return []
  const targetCadence = sourceFrequency === 'DAILY' ? 'MONTHLY' : sourceFrequency
  const artifactFrequency = buildForecastArtifactCadenceIdentity({ sourceFrequency, targetCadence })
  const acceptedArtifactFrequencies = targetCadence === 'MONTHLY'
    ? [artifactFrequency, LEGACY_MONTHLY_ARTIFACT_FREQUENCY]
    : [artifactFrequency]

  const monthlyCandidates = MONTHLY_TARGETS.map((targetBasis) => {
    const payload = buildLiveForecastBridgePayloadFromHistory(seriesId, history, {
      targetBasis,
      targetCadence,
      now: options.now,
    })
    return {
      targetBasis,
      historyFingerprints: {
        legacy: buildForecastHistoryFingerprint(payload.history),
        cadence: buildForecastHistoryFingerprint({
          ...payload.history,
          cadence: { sourceFrequency, targetCadence },
        }),
      },
    }
  })
  const rollingHistory = {
    seriesId,
    displayName: history.displayName,
    description: history.displayName,
    frequency: 'DAILY',
    source: history.source,
    points: history.historical,
  }
  const rollingFingerprint = buildRollingDailyHistoryFingerprint(rollingHistory)
  const variants: ForecastPreparedVariant[] = []

  for (const candidate of monthlyCandidates) {
    for (const modelId of USER_FACING_FORECAST_MODELS) {
      const identity = createForecastIdentity({ seriesId, targetBasis: candidate.targetBasis, modelId })
      const [current, historical] = await Promise.all([
        prisma.forecastCurrentRun.findFirst({
          where: {
            seriesId,
            frequency: { in: acceptedArtifactFrequencies },
            targetBasis: candidate.targetBasis,
            methodId: identity.methodId,
            methodVersion: identity.methodVersion,
            modelId,
          },
          select: { status: true, historyFingerprint: true, frequency: true },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.forecastVerificationRun.findFirst({
          where: {
            seriesId,
            frequency: { in: acceptedArtifactFrequencies },
            targetBasis: candidate.targetBasis,
            methodId: identity.methodId,
            methodVersion: identity.methodVersion,
            modelId,
          },
          select: { status: true, historyFingerprint: true, frequency: true },
          orderBy: { updatedAt: 'desc' },
        }),
      ])

      variants.push({
        identity,
        current: stateForRun(current, candidate.historyFingerprints),
        historical: stateForRun(historical, candidate.historyFingerprints),
      })
    }
  }

  if (sourceFrequency !== 'DAILY') return variants

  for (const modelId of USER_FACING_FORECAST_MODELS) {
    const identity = createForecastIdentity({ seriesId, targetBasis: 'POINT_IN_TIME', modelId })
    const [snapshot, maintenance, verificationCount] = await Promise.all([
      prisma.rollingDailyCurrentForecastSnapshot.findFirst({
        where: {
          seriesId,
          inputSource: ROLLING_DAILY_INPUT_SOURCE,
          targetBasis: 'POINT_IN_TIME',
          methodId: identity.methodId,
          methodVersion: identity.methodVersion,
          modelId,
        },
        select: { status: true, payloadJson: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.rollingDailyMaintenanceState.findUnique({
        where: {
          seriesId_inputSource_targetBasis_methodId_methodVersion_modelId: {
            seriesId,
            inputSource: ROLLING_DAILY_INPUT_SOURCE,
            targetBasis: 'POINT_IN_TIME',
            methodId: identity.methodId,
            methodVersion: identity.methodVersion,
            modelId,
          },
        },
        select: { latestSourceHistoryFingerprint: true },
      }),
      prisma.rollingDailyVerificationRecord.count({
        where: {
          seriesId,
          inputSource: ROLLING_DAILY_INPUT_SOURCE,
          targetBasis: 'POINT_IN_TIME',
          methodId: identity.methodId,
          methodVersion: identity.methodVersion,
          modelId,
        },
      }),
    ])
    const snapshotFingerprint = (
      snapshot?.payloadJson as { audit?: { sourceHistoryFingerprint?: string | null } } | null
    )?.audit?.sourceHistoryFingerprint

    variants.push({
      identity,
      current: stateForFingerprint(
        snapshotFingerprint,
        rollingFingerprint,
        snapshot?.status === 'AVAILABLE',
      ),
      historical: stateForFingerprint(
        maintenance?.latestSourceHistoryFingerprint,
        rollingFingerprint,
        verificationCount > 0,
      ),
    })
  }

  return variants
}