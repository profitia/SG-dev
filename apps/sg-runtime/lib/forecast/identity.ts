import type { ForecastTargetBasis, UserFacingForecastModelId } from '@/lib/forecast/contracts'
import type {
  ForecastCadence,
  ForecastSourceFrequency,
  ForecastTargetCadence,
} from '@/lib/forecast/cadence'
import { normalizeForecastSourceFrequency } from '@/lib/forecast/cadence'

export const FORECAST_TARGET_SEMANTICS = [
  'END_OF_PERIOD',
  'MONTHLY_AVERAGE',
  'ROLLING_DAILY_POINT_IN_TIME',
] as const

export const FORECAST_METHOD_IDS = [
  'END_OF_PERIOD',
  'MONTHLY_AVERAGE',
  'ROLLING_DAILY_POINT_IN_TIME',
] as const

export const MONTHLY_FORECAST_METHOD_VERSION = 'benchmark-forecasting-mvp-phase2-v1'
export const ROLLING_DAILY_FORECAST_METHOD_VERSION = 'rolling-daily-point-in-time-v1'
export const LEGACY_UNRESOLVED_FORECAST_METHOD_ID = 'LEGACY_UNRESOLVED'
export const FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION = 'FORECAST_CADENCE_V1'
export const LEGACY_MONTHLY_ARTIFACT_FREQUENCY = 'MONTHLY'

export type ForecastTargetSemantics = (typeof FORECAST_TARGET_SEMANTICS)[number]
export type ForecastMethodId = (typeof FORECAST_METHOD_IDS)[number]

export type ForecastIdentity = {
  seriesId: string
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
  methodVersion: string
  modelId: UserFacingForecastModelId
}

export type ForecastPersistenceIdentity = ForecastIdentity & {
  targetBasis: ForecastTargetBasis
  inputSource: string
  historyFingerprint: string
}

export type ForecastArtifactIdentity = ForecastIdentity & ForecastCadence

export type ParsedForecastArtifactCadenceIdentity =
  | {
      identityVersion: typeof FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION
      sourceFrequency: ForecastSourceFrequency
      targetCadence: ForecastTargetCadence
      legacyMonthly: false
    }
  | {
      identityVersion: 'LEGACY_MONTHLY'
      sourceFrequency: null
      targetCadence: 'MONTHLY'
      legacyMonthly: true
    }

export type ForecastPreparationIdentity = {
  method: string
  version: string
  provenanceStatus: 'PROVEN' | 'NOT_REQUIRED' | 'LEGACY_UNRESOLVED'
}

export type ForecastSourceLineage = {
  inputSource: string
  inputRunId: string | null
  sourceSeriesId: string
  sourceFrequency: string | null
  historyFingerprint: string
  preparation: ForecastPreparationIdentity | null
}

export type ForecastCapabilityState =
  | 'AVAILABLE'
  | 'NOT_LAWFUL'
  | 'INSUFFICIENT_HISTORY'
  | 'DATA_NOT_AVAILABLE'
  | 'NOT_PREPARED'
  | 'PREPARATION_REQUIRED'
  | 'FAILED'

export type ForecastPredictionBandIdentity = {
  forecastIdentity: ForecastIdentity
  horizon: string
  targetDate: string | null
  calibrationMethod: string
  calibrationVersion: string
}

export type ForecastPreparedSnapshotIdentity = {
  forecastIdentity: ForecastIdentity
  inputSource: string
  sourceHistoryFingerprint: string
  forecastOrigin: string | null
}

export type ForecastFreshness = {
  identity: ForecastPreparedSnapshotIdentity
  status: 'FRESH' | 'STALE' | 'MISS'
  reason: string | null
}

type ForecastMethodContract = {
  targetBasis: ForecastTargetBasis
  targetSemantics: ForecastTargetSemantics
  methodId: ForecastMethodId
  methodVersion: string
}

const METHOD_CONTRACT_BY_TARGET_BASIS: Record<ForecastTargetBasis, ForecastMethodContract> = {
  END_OF_PERIOD: {
    targetBasis: 'END_OF_PERIOD',
    targetSemantics: 'END_OF_PERIOD',
    methodId: 'END_OF_PERIOD',
    methodVersion: MONTHLY_FORECAST_METHOD_VERSION,
  },
  MONTHLY_AVERAGE: {
    targetBasis: 'MONTHLY_AVERAGE',
    targetSemantics: 'MONTHLY_AVERAGE',
    methodId: 'MONTHLY_AVERAGE',
    methodVersion: MONTHLY_FORECAST_METHOD_VERSION,
  },
  POINT_IN_TIME: {
    targetBasis: 'POINT_IN_TIME',
    targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME',
    methodId: 'ROLLING_DAILY_POINT_IN_TIME',
    methodVersion: ROLLING_DAILY_FORECAST_METHOD_VERSION,
  },
}

export function resolveForecastMethodContract(targetBasis: ForecastTargetBasis): ForecastMethodContract {
  return METHOD_CONTRACT_BY_TARGET_BASIS[targetBasis]
}

export function createForecastIdentity(input: {
  seriesId: string
  targetBasis: ForecastTargetBasis
  modelId: UserFacingForecastModelId
  methodVersion?: string
}): ForecastIdentity {
  const method = resolveForecastMethodContract(input.targetBasis)

  return {
    seriesId: input.seriesId,
    targetSemantics: method.targetSemantics,
    methodId: method.methodId,
    methodVersion: input.methodVersion ?? method.methodVersion,
    modelId: input.modelId,
  }
}

export function buildForecastIdentityKey(identity: ForecastIdentity): string {
  return [
    identity.seriesId,
    identity.targetSemantics,
    identity.methodId,
    identity.methodVersion,
    identity.modelId,
  ].join('|')
}

export function buildForecastArtifactCadenceIdentity(cadence: ForecastCadence): string {
  return [
    FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION,
    `source=${cadence.sourceFrequency}`,
    `target=${cadence.targetCadence}`,
  ].join('|')
}

export function parseForecastArtifactCadenceIdentity(
  value: string | null | undefined,
): ParsedForecastArtifactCadenceIdentity | null {
  if (value === LEGACY_MONTHLY_ARTIFACT_FREQUENCY) {
    return {
      identityVersion: 'LEGACY_MONTHLY',
      sourceFrequency: null,
      targetCadence: 'MONTHLY',
      legacyMonthly: true,
    }
  }

  const [version, sourcePart, targetPart, unexpectedPart] = value?.split('|') ?? []
  if (
    version !== FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION
    || unexpectedPart !== undefined
    || !sourcePart?.startsWith('source=')
    || !targetPart?.startsWith('target=')
  ) {
    return null
  }

  const sourceFrequency = normalizeForecastSourceFrequency(sourcePart.slice('source='.length))
  const targetCadence = normalizeForecastSourceFrequency(targetPart.slice('target='.length))
  if (!sourceFrequency || !targetCadence) return null

  return {
    identityVersion: FORECAST_ARTIFACT_CADENCE_IDENTITY_VERSION,
    sourceFrequency,
    targetCadence,
    legacyMonthly: false,
  }
}

export function buildForecastArtifactIdentityKey(identity: ForecastArtifactIdentity): string {
  return [
    buildForecastIdentityKey(identity),
    buildForecastArtifactCadenceIdentity(identity),
  ].join('|')
}
