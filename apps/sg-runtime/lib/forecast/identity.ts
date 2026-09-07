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
export const FORECAST_ARTIFACT_SCOPES = [
  'CURRENT_FORECAST',
  'RECENT_VERIFICATION',
  'FULL_VERIFICATION',
] as const
export const CURRENT_FORECAST_TRAINING_WINDOW_POLICY_ID =
  'CURRENT_POLICY_FREQUENCY_SPECIFIC@current-policy-frequency-specific-v1'
export const CURRENT_FAST_TRAILING_12M_TRAINING_WINDOW_POLICY_ID =
  'CURRENT_FAST_TRAILING_12M@current-fast-trailing-12m-v1'
export const CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID =
  'CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX@current-fast-minimal-lawful-suffix-v1'
export const RECENT_VERIFICATION_TRAINING_WINDOW_POLICY_ID =
  'RECENT_SAME_POLICY_AS_CURRENT@recent-same-policy-as-current-v1'
export const FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID =
  'FULL_EXPANDING_HISTORY_PER_ORIGIN@full-expanding-history-per-origin-v1'
export const LEGACY_UNRESOLVED_TRAINING_WINDOW_POLICY_ID = 'LEGACY_UNRESOLVED'
export const FORECAST_EFFECTIVE_TRAINING_POLICY_ID_VERSION = 'forecast-effective-training-policy-v1'
export const FORECAST_CALIBRATION_POLICIES = [
  'EXACT_STATISTICAL_MATCH_ONLY',
  'CONDITIONAL_POLICY_MATCH_ONLY',
] as const

export type ForecastTargetSemantics = (typeof FORECAST_TARGET_SEMANTICS)[number]
export type ForecastMethodId = (typeof FORECAST_METHOD_IDS)[number]
export type ForecastArtifactScope = (typeof FORECAST_ARTIFACT_SCOPES)[number]
export type ForecastTrainingWindowPolicyId =
  | typeof CURRENT_FORECAST_TRAINING_WINDOW_POLICY_ID
  | typeof CURRENT_FAST_TRAILING_12M_TRAINING_WINDOW_POLICY_ID
  | typeof CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID
  | typeof RECENT_VERIFICATION_TRAINING_WINDOW_POLICY_ID
  | typeof FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID
  | typeof LEGACY_UNRESOLVED_TRAINING_WINDOW_POLICY_ID
export type ForecastCalibrationPolicy = (typeof FORECAST_CALIBRATION_POLICIES)[number]
export type ForecastEffectiveTrainingPolicyId = string

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

export type ForecastStatisticalCompatibility = {
  artifactScope: ForecastArtifactScope
  trainingWindowPolicyId: ForecastTrainingWindowPolicyId
  effectiveTrainingPolicyId: ForecastEffectiveTrainingPolicyId
  calibrationPolicy: ForecastCalibrationPolicy
}

export type ForecastTrainingPolicyResolutionContext = {
  sourceFrequency: ForecastSourceFrequency
  targetCadence: ForecastTargetCadence
  targetSemantics: ForecastTargetSemantics
}

export type ForecastCalibrationIdentity = {
  artifactScope: ForecastArtifactScope
  seriesId: string
  sourceSeriesId: string
  inputSource: string
  sourceFrequency: string
  targetCadence: string
  targetSemantics: ForecastTargetSemantics
  modelId: string
  methodId: string
  methodVersion: string
  trainingWindowPolicyId: ForecastTrainingWindowPolicyId
  effectiveTrainingPolicyId: ForecastEffectiveTrainingPolicyId
  historyFingerprint: string
  horizonLabel: string
  forecastOrigin: string | null
  actualObservedAt: string | null
  calibrationPolicy: ForecastCalibrationPolicy
}

export type ForecastCalibrationLineageProof = {
  canonicalHistoryFingerprintAtResidualOrigin?: string | null
}

export type ForecastVerificationReuseIdentity = {
  artifactScope: Extract<ForecastArtifactScope, 'RECENT_VERIFICATION' | 'FULL_VERIFICATION'>
  seriesId: string
  sourceSeriesId: string
  inputSource: string
  sourceFrequency: string
  targetCadence: string
  targetSemantics: ForecastTargetSemantics
  modelId: string
  methodId: string
  methodVersion: string
  trainingWindowPolicyId: ForecastTrainingWindowPolicyId
  effectiveTrainingPolicyId: ForecastEffectiveTrainingPolicyId
  historyFingerprint: string
  horizonLabel: string
  forecastOrigin: string | null
}

const CALIBRATION_IDENTITY_FIELDS = [
  'seriesId',
  'inputSource',
  'sourceFrequency',
  'targetCadence',
  'targetSemantics',
  'modelId',
  'methodId',
  'methodVersion',
  'effectiveTrainingPolicyId',
  'horizonLabel',
] as const

const VERIFICATION_REUSE_FIELDS = [
  'seriesId',
  'inputSource',
  'sourceFrequency',
  'targetCadence',
  'targetSemantics',
  'modelId',
  'methodId',
  'methodVersion',
  'effectiveTrainingPolicyId',
  'horizonLabel',
  'forecastOrigin',
] as const

export type ForecastSourceLineage = {
  inputSource: string
  inputRunId: string | null
  sourceSeriesId: string
  sourceFrequency: string | null
  historyFingerprint: string
  preparation: ForecastPreparationIdentity | null
  statisticalCompatibility: ForecastStatisticalCompatibility
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

function buildEffectiveTrainingPolicyId(
  policyFamily: 'CURRENT_FREQUENCY_SPECIFIC' | 'CURRENT_FAST_TRAILING_12M' | 'CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX' | 'FULL_EXPANDING_HISTORY_PER_ORIGIN',
  context: ForecastTrainingPolicyResolutionContext,
): ForecastEffectiveTrainingPolicyId {
  return [
    `${policyFamily}@${FORECAST_EFFECTIVE_TRAINING_POLICY_ID_VERSION}`,
    `source=${context.sourceFrequency}`,
    `target=${context.targetCadence}`,
    `semantics=${context.targetSemantics}`,
  ].join('|')
}

export function resolveEffectiveTrainingPolicyId(
  trainingWindowPolicyId: ForecastTrainingWindowPolicyId,
  context: ForecastTrainingPolicyResolutionContext,
): ForecastEffectiveTrainingPolicyId {
  if (
    trainingWindowPolicyId === CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID
    || trainingWindowPolicyId === RECENT_VERIFICATION_TRAINING_WINDOW_POLICY_ID
  ) {
    return buildEffectiveTrainingPolicyId('CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX', context)
  }

  if (trainingWindowPolicyId === CURRENT_FAST_TRAILING_12M_TRAINING_WINDOW_POLICY_ID) {
    return buildEffectiveTrainingPolicyId('CURRENT_FAST_TRAILING_12M', context)
  }

  if (
    trainingWindowPolicyId === CURRENT_FORECAST_TRAINING_WINDOW_POLICY_ID
  ) {
    return buildEffectiveTrainingPolicyId('CURRENT_FREQUENCY_SPECIFIC', context)
  }

  if (trainingWindowPolicyId === FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID) {
    return buildEffectiveTrainingPolicyId('FULL_EXPANDING_HISTORY_PER_ORIGIN', context)
  }

  return [
    `${LEGACY_UNRESOLVED_TRAINING_WINDOW_POLICY_ID}@${FORECAST_EFFECTIVE_TRAINING_POLICY_ID_VERSION}`,
    `source=${context.sourceFrequency}`,
    `target=${context.targetCadence}`,
    `semantics=${context.targetSemantics}`,
  ].join('|')
}

export function createCurrentForecastStatisticalCompatibility(
  context: ForecastTrainingPolicyResolutionContext,
): ForecastStatisticalCompatibility {
  return {
    artifactScope: 'CURRENT_FORECAST',
    trainingWindowPolicyId: CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID,
    effectiveTrainingPolicyId: resolveEffectiveTrainingPolicyId(
      CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID,
      context,
    ),
    calibrationPolicy: 'EXACT_STATISTICAL_MATCH_ONLY',
  }
}

export function createStrictTrailing12MCurrentForecastStatisticalCompatibility(
  context: ForecastTrainingPolicyResolutionContext,
): ForecastStatisticalCompatibility {
  return {
    artifactScope: 'CURRENT_FORECAST',
    trainingWindowPolicyId: CURRENT_FAST_TRAILING_12M_TRAINING_WINDOW_POLICY_ID,
    effectiveTrainingPolicyId: resolveEffectiveTrainingPolicyId(
      CURRENT_FAST_TRAILING_12M_TRAINING_WINDOW_POLICY_ID,
      context,
    ),
    calibrationPolicy: 'EXACT_STATISTICAL_MATCH_ONLY',
  }
}

export function createLegacyFrequencySpecificCurrentForecastStatisticalCompatibility(
  context: ForecastTrainingPolicyResolutionContext,
): ForecastStatisticalCompatibility {
  return {
    artifactScope: 'CURRENT_FORECAST',
    trainingWindowPolicyId: CURRENT_FORECAST_TRAINING_WINDOW_POLICY_ID,
    effectiveTrainingPolicyId: resolveEffectiveTrainingPolicyId(
      CURRENT_FORECAST_TRAINING_WINDOW_POLICY_ID,
      context,
    ),
    calibrationPolicy: 'EXACT_STATISTICAL_MATCH_ONLY',
  }
}

export function createRecentVerificationStatisticalCompatibility(
  context: ForecastTrainingPolicyResolutionContext,
): ForecastStatisticalCompatibility {
  return {
    artifactScope: 'RECENT_VERIFICATION',
    trainingWindowPolicyId: RECENT_VERIFICATION_TRAINING_WINDOW_POLICY_ID,
    effectiveTrainingPolicyId: resolveEffectiveTrainingPolicyId(
      RECENT_VERIFICATION_TRAINING_WINDOW_POLICY_ID,
      context,
    ),
    calibrationPolicy: 'EXACT_STATISTICAL_MATCH_ONLY',
  }
}

export function createFullVerificationStatisticalCompatibility(
  context: ForecastTrainingPolicyResolutionContext,
): ForecastStatisticalCompatibility {
  return {
    artifactScope: 'FULL_VERIFICATION',
    trainingWindowPolicyId: FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID,
    effectiveTrainingPolicyId: resolveEffectiveTrainingPolicyId(
      FULL_VERIFICATION_TRAINING_WINDOW_POLICY_ID,
      context,
    ),
    calibrationPolicy: 'EXACT_STATISTICAL_MATCH_ONLY',
  }
}

export function createLegacyVerificationStatisticalCompatibility(
  context: ForecastTrainingPolicyResolutionContext,
): ForecastStatisticalCompatibility {
  return createLegacyUnresolvedForecastStatisticalCompatibility('VERIFICATION', context)
}

export function createLegacyUnresolvedForecastStatisticalCompatibility(
  artifactFamily: 'CURRENT' | 'VERIFICATION',
  context: ForecastTrainingPolicyResolutionContext,
): ForecastStatisticalCompatibility {
  return {
    artifactScope: artifactFamily === 'CURRENT' ? 'CURRENT_FORECAST' : 'FULL_VERIFICATION',
    trainingWindowPolicyId: LEGACY_UNRESOLVED_TRAINING_WINDOW_POLICY_ID,
    effectiveTrainingPolicyId: resolveEffectiveTrainingPolicyId(
      LEGACY_UNRESOLVED_TRAINING_WINDOW_POLICY_ID,
      context,
    ),
    calibrationPolicy: 'CONDITIONAL_POLICY_MATCH_ONLY',
  }
}

export function resolveLegacyForecastStatisticalCompatibility(
  artifactFamily: 'CURRENT' | 'VERIFICATION',
  context: ForecastTrainingPolicyResolutionContext,
): ForecastStatisticalCompatibility {
  return createLegacyUnresolvedForecastStatisticalCompatibility(artifactFamily, context)
}

export function areForecastStatisticalCompatibilitiesEqual(
  left: ForecastStatisticalCompatibility,
  right: ForecastStatisticalCompatibility,
): boolean {
  return left.artifactScope === right.artifactScope
    && left.trainingWindowPolicyId === right.trainingWindowPolicyId
    && left.effectiveTrainingPolicyId === right.effectiveTrainingPolicyId
    && left.calibrationPolicy === right.calibrationPolicy
}

export function doesForecastArtifactSatisfyRequest(
  available: ForecastStatisticalCompatibility,
  requested: ForecastStatisticalCompatibility,
): boolean {
  return areForecastStatisticalCompatibilitiesEqual(available, requested)
}

export function isRecentVerificationReusableForFullVerification(
  available: ForecastVerificationReuseIdentity,
  requested: ForecastVerificationReuseIdentity,
): boolean {
  if (available.artifactScope !== 'RECENT_VERIFICATION' || requested.artifactScope !== 'FULL_VERIFICATION') {
    return false
  }

  return VERIFICATION_REUSE_FIELDS.every((fieldName) => available[fieldName] === requested[fieldName])
    && available.sourceSeriesId === requested.sourceSeriesId
    && available.inputSource === requested.inputSource
    && available.sourceFrequency === requested.sourceFrequency
    && available.historyFingerprint === requested.historyFingerprint
}

function parseComparableTimestamp(value: string | null): number | null {
  if (!value) {
    return null
  }

  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

function hasExplicitButMalformedTimestamp(value: string | null) {
  return value !== null && value !== '' && parseComparableTimestamp(value) === null
}

function isCalibrationSourceLineageCompatible(
  residual: ForecastCalibrationIdentity,
  current: ForecastCalibrationIdentity,
  lineageProof?: ForecastCalibrationLineageProof,
) {
  if (
    residual.sourceSeriesId !== current.sourceSeriesId
    || residual.inputSource !== current.inputSource
    || residual.sourceFrequency !== current.sourceFrequency
  ) {
    return false
  }

  if (
    hasExplicitButMalformedTimestamp(residual.forecastOrigin)
    || hasExplicitButMalformedTimestamp(current.forecastOrigin)
  ) {
    return false
  }

  const residualOrigin = parseComparableTimestamp(residual.forecastOrigin)
  const currentOrigin = parseComparableTimestamp(current.forecastOrigin)
  const canonicalHistoryFingerprintAtResidualOrigin =
    lineageProof?.canonicalHistoryFingerprintAtResidualOrigin ?? null

  if (residualOrigin === null) {
    return canonicalHistoryFingerprintAtResidualOrigin !== null
      && canonicalHistoryFingerprintAtResidualOrigin === residual.historyFingerprint
  }

  if (currentOrigin === null) {
    return false
  }

  if (residualOrigin === currentOrigin) {
    return residual.historyFingerprint === current.historyFingerprint
  }

  if (residualOrigin > currentOrigin) {
    return false
  }

  return canonicalHistoryFingerprintAtResidualOrigin !== null
    && canonicalHistoryFingerprintAtResidualOrigin === residual.historyFingerprint
}

export function canResidualCalibrateCurrent(
  residual: ForecastCalibrationIdentity,
  current: ForecastCalibrationIdentity,
  lineageProof?: ForecastCalibrationLineageProof,
): boolean {
  if (
    residual.calibrationPolicy !== 'EXACT_STATISTICAL_MATCH_ONLY'
    || current.calibrationPolicy !== 'EXACT_STATISTICAL_MATCH_ONLY'
  ) {
    return false
  }

  if (residual.actualObservedAt === null) {
    return false
  }

  return CALIBRATION_IDENTITY_FIELDS.every((fieldName) => residual[fieldName] === current[fieldName])
    && isCalibrationSourceLineageCompatible(residual, current, lineageProof)
}
