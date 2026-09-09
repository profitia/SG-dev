import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import {
  isForecastExecutableNativeSparseFrequency,
  normalizeForecastSourceFrequency,
} from '@/lib/forecast/cadence'
import { USER_FACING_FORECAST_MODELS } from '@/lib/forecast/contracts'
import { buildForecastHistoryFingerprint } from '@/lib/forecast/history-fingerprint'
import {
  buildForecastArtifactCadenceIdentity,
  createCurrentForecastStatisticalCompatibility,
  createForecastIdentity,
  createRecentVerificationStatisticalCompatibility,
  LEGACY_MONTHLY_ARTIFACT_FREQUENCY,
} from '@/lib/forecast/identity'
import { buildLiveForecastBridgePayloadFromHistory } from '@/lib/forecast/live-market-input'
import { resolveForecastTechnicalMinimumObservations } from '@/lib/forecast/current-fast-policy'
import {
  buildRollingDailyHistoryFingerprint,
  isRollingDailyHistoricalPreparationComplete,
  ROLLING_DAILY_INPUT_SOURCE,
} from '@/lib/forecast/rolling-daily-maintenance'
import { selectTrailingRollingDailyCurrentHistory } from '@/lib/forecast/rolling-daily-current-ownership'
import type { ForecastPreparedState, ForecastPreparedVariant } from '@/lib/forecast/capability-resolver'
import { getMarketDataPrisma } from '@/lib/market-data/client'
import { selectMinimalLawfulCurrentTrainingPayload } from '@/lib/forecast/live-market-input'

const MONTHLY_TARGETS = ['END_OF_PERIOD', 'MONTHLY_AVERAGE'] as const

type MarketDataPrismaClient = NonNullable<ReturnType<typeof getMarketDataPrisma>>

function hasRenderableCurrentPoints(points: Array<{ forecastValue: unknown }> | undefined) {
  return (points ?? []).some((point) => point.forecastValue !== null)
}

function hasRenderableRollingDailyPath(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('path' in payload) || !Array.isArray(payload.path)) {
    return false
  }

  return payload.path.some((point) => (
    point
    && typeof point === 'object'
    && 'pointForecast' in point
    && typeof point.pointForecast === 'number'
    && Number.isFinite(point.pointForecast)
  ))
}

function stateForCurrentRun(
  run: {
    status: string
    historyFingerprint: string
    frequency: string | null
    points?: Array<{ forecastValue: unknown }>
  } | null,
  expectedFingerprints: { legacy: string, cadence: string },
): ForecastPreparedState {
  if (!run) return 'NOT_PREPARED'
  const expectedFingerprint = run.frequency === LEGACY_MONTHLY_ARTIFACT_FREQUENCY
    ? expectedFingerprints.legacy
    : expectedFingerprints.cadence
  return run.status === 'AVAILABLE'
    && run.historyFingerprint === expectedFingerprint
    && hasRenderableCurrentPoints(run.points)
    ? 'READY'
    : 'STALE'
}

function stateForHistoricalRun(
  run: {
    status: string
    historyFingerprint: string
    frequency: string | null
    metrics?: Array<{ origins: number, expectedOrigins: number, failedOrigins: number }>
  } | null,
  expectedFingerprints: { legacy: string, cadence: string },
): ForecastPreparedState {
  if (!run) return 'NOT_PREPARED'
  const expectedFingerprint = run.frequency === LEGACY_MONTHLY_ARTIFACT_FREQUENCY
    ? expectedFingerprints.legacy
    : expectedFingerprints.cadence
  const complete = !run.metrics || run.metrics.length === 0
    ? true
    : run.metrics.every((metric) => metric.origins + metric.failedOrigins >= metric.expectedOrigins)
  return run.status === 'AVAILABLE' && run.historyFingerprint === expectedFingerprint && complete
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

function stateForRollingDailyHistoricalRun(input: {
  maintenance: {
    latestSourceHistoryFingerprint: string | null
    latestSourceObservationAt: string | null
    lastProcessedOriginAt: string | null
    lastMaintenanceStatus: string | null
  } | null
  expectedFingerprint: string
  latestSourceObservationDate: string | null
  verificationCount: number
}): ForecastPreparedState {
  if (input.verificationCount < 1) {
    return 'NOT_PREPARED'
  }

  return isRollingDailyHistoricalPreparationComplete({
    state: input.maintenance,
    expectedSourceHistoryFingerprint: input.expectedFingerprint,
    latestSourceObservationDate: input.latestSourceObservationDate,
    verificationRecordCount: input.verificationCount,
  })
    ? 'READY'
    : 'STALE'
}

function resolvePreparedTargetCadence(
  sourceFrequency: ReturnType<typeof normalizeForecastSourceFrequency>,
  targetBasis: (typeof MONTHLY_TARGETS)[number],
) {
  if (sourceFrequency === 'DAILY' || sourceFrequency === 'MONTHLY') {
    return 'MONTHLY' as const
  }

  if (sourceFrequency === 'WEEKLY' && targetBasis === 'END_OF_PERIOD') {
    return 'MONTHLY' as const
  }

  return sourceFrequency
}

export async function readForecastPreparedVariants(
  seriesId: string,
  history: BenchmarkHistoricalSeriesResult,
  options: { prisma?: MarketDataPrismaClient, now?: Date } = {},
): Promise<ForecastPreparedVariant[]> {
  const prisma = options.prisma ?? getMarketDataPrisma()
  if (!prisma) return []

  const sourceFrequency = normalizeForecastSourceFrequency(history.frequency)
  if (
    sourceFrequency !== 'DAILY'
    && sourceFrequency !== 'WEEKLY'
    && sourceFrequency !== 'MONTHLY'
    && !isForecastExecutableNativeSparseFrequency(sourceFrequency)
  ) return []
  const resolvedSourceFrequency = sourceFrequency
  const monthlyCandidates = sourceFrequency === 'WEEKLY'
    ? [{ targetBasis: 'END_OF_PERIOD' as const }]
    : MONTHLY_TARGETS.map((targetBasis) => ({ targetBasis }))
  const currentBasePayloadByTarget = new Map(monthlyCandidates.map(({ targetBasis }) => {
    const targetCadence = resolvePreparedTargetCadence(resolvedSourceFrequency, targetBasis)

    return [
      targetBasis,
      buildLiveForecastBridgePayloadFromHistory(seriesId, history, {
        targetBasis,
        targetCadence,
        now: options.now,
        continuityPolicy: targetCadence === 'MONTHLY' ? 'ALLOW_GAPS' : 'REQUIRE_FULL',
      }),
    ] as const
  }))

  const rollingHistory = {
    seriesId,
    displayName: history.displayName,
    description: history.displayName,
    frequency: 'DAILY',
    source: history.source,
    points: history.historical,
  }
  const rollingCurrentFingerprint = buildRollingDailyHistoryFingerprint(
    selectTrailingRollingDailyCurrentHistory(rollingHistory),
  )
  const rollingHistoricalFingerprint = buildRollingDailyHistoryFingerprint(rollingHistory)
  const variants: ForecastPreparedVariant[] = []

  for (const candidate of monthlyCandidates) {
    for (const modelId of USER_FACING_FORECAST_MODELS) {
      const targetCadence = resolvePreparedTargetCadence(resolvedSourceFrequency, candidate.targetBasis)
      const artifactFrequency = buildForecastArtifactCadenceIdentity({ sourceFrequency: resolvedSourceFrequency, targetCadence })
      const acceptedArtifactFrequencies = targetCadence === 'MONTHLY'
        ? [artifactFrequency, LEGACY_MONTHLY_ARTIFACT_FREQUENCY]
        : [artifactFrequency]
      const identity = createForecastIdentity({ seriesId, targetBasis: candidate.targetBasis, modelId })
      const currentPayload = selectMinimalLawfulCurrentTrainingPayload(
        currentBasePayloadByTarget.get(candidate.targetBasis)!,
        resolveForecastTechnicalMinimumObservations({
          targetSemantics: identity.targetSemantics,
          modelId,
        }),
      )
      const currentHistoryFingerprints = {
        legacy: buildForecastHistoryFingerprint(currentPayload.history),
        cadence: buildForecastHistoryFingerprint({
          ...currentPayload.history,
          cadence: { sourceFrequency: resolvedSourceFrequency, targetCadence },
        }),
      }
      const recentVerificationCompatibility = createRecentVerificationStatisticalCompatibility({
        sourceFrequency: resolvedSourceFrequency,
        targetCadence,
        targetSemantics: identity.targetSemantics,
      })
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
          select: {
            status: true,
            historyFingerprint: true,
            frequency: true,
            points: {
              select: {
                forecastValue: true,
              },
            },
          },
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
            trainingWindowPolicyId: recentVerificationCompatibility.trainingWindowPolicyId,
            effectiveTrainingPolicyId: recentVerificationCompatibility.effectiveTrainingPolicyId,
          },
          select: {
            status: true,
            historyFingerprint: true,
            frequency: true,
            metrics: {
              select: {
                origins: true,
                expectedOrigins: true,
                failedOrigins: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
      ])

      variants.push({
        identity,
        current: stateForCurrentRun(current, currentHistoryFingerprints),
        historical: stateForHistoricalRun(historical, currentHistoryFingerprints),
      })
    }
  }

  if (sourceFrequency !== 'DAILY') return variants

  for (const modelId of USER_FACING_FORECAST_MODELS) {
    const identity = createForecastIdentity({ seriesId, targetBasis: 'POINT_IN_TIME', modelId })
    const rollingDailyCompatibility = createCurrentForecastStatisticalCompatibility({
      sourceFrequency: 'DAILY',
      targetCadence: 'DAILY',
      targetSemantics: identity.targetSemantics,
    })
    const [snapshot, maintenance, verificationCount] = await Promise.all([
      prisma.rollingDailyCurrentForecastSnapshot.findUnique({
        where: {
          seriesId_inputSource_targetBasis_methodId_methodVersion_modelId_trainingWindowPolicyId_effectiveTrainingPolicyId_sourceHistoryFingerprint: {
            seriesId,
            inputSource: ROLLING_DAILY_INPUT_SOURCE,
            targetBasis: 'POINT_IN_TIME',
            methodId: identity.methodId,
            methodVersion: identity.methodVersion,
            modelId,
            trainingWindowPolicyId: rollingDailyCompatibility.trainingWindowPolicyId,
            effectiveTrainingPolicyId: rollingDailyCompatibility.effectiveTrainingPolicyId,
            sourceHistoryFingerprint: rollingCurrentFingerprint,
          },
        },
        select: { status: true, payloadJson: true },
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
        select: {
          latestSourceHistoryFingerprint: true,
          latestSourceObservationAt: true,
          lastProcessedOriginAt: true,
          lastMaintenanceStatus: true,
        },
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
    const normalizedMaintenance = maintenance ? {
      latestSourceHistoryFingerprint: maintenance.latestSourceHistoryFingerprint,
      latestSourceObservationAt: maintenance.latestSourceObservationAt?.toISOString() ?? null,
      lastProcessedOriginAt: maintenance.lastProcessedOriginAt?.toISOString() ?? null,
      lastMaintenanceStatus: maintenance.lastMaintenanceStatus,
    } : null

    variants.push({
      identity,
      current: stateForFingerprint(
        snapshot?.status === 'AVAILABLE' && hasRenderableRollingDailyPath(snapshot.payloadJson)
          ? snapshotFingerprint
          : null,
        rollingCurrentFingerprint,
        snapshot?.status === 'AVAILABLE',
      ),
      historical: stateForRollingDailyHistoricalRun({
        maintenance: normalizedMaintenance,
        expectedFingerprint: rollingHistoricalFingerprint,
        latestSourceObservationDate: rollingHistory.points[rollingHistory.points.length - 1]?.date ?? null,
        verificationCount,
      }),
    })
  }

  return variants
}