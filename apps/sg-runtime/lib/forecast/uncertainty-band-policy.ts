import type {
  ForecastCurrentPoint,
  ForecastTargetBasis,
  ForecastUncertaintyBand,
  UserFacingForecastModelId,
} from '@/lib/forecast/contracts'
import type {
  ForecastEffectiveTrainingPolicyId,
  ForecastTrainingWindowPolicyId,
} from '@/lib/forecast/identity'
import {
  createForecastIdentity,
  type ForecastPredictionBandIdentity,
} from '@/lib/forecast/identity'
import type {
  ForecastSourceFrequency,
  ForecastTargetCadence,
} from '@/lib/forecast/cadence'

export const ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION = 'ADAPTIVE_UNCERTAINTY_BANDS_V1'
export const FORECAST_UNCERTAINTY_BAND_COVERAGE = 0.8 as const
export const MIN_EMPIRICAL_EXACT_RESIDUALS = 30

type ExactBandIdentityContext = {
  seriesId: string
  modelId: UserFacingForecastModelId
  targetBasis: ForecastTargetBasis
  methodVersion: string
  inputSource: string
  sourceFrequency: ForecastSourceFrequency
  targetCadence: ForecastTargetCadence
  sourceHistoryFingerprint: string
  trainingWindowPolicyId: ForecastTrainingWindowPolicyId
  effectiveTrainingPolicyId: ForecastEffectiveTrainingPolicyId
  forecastOrigin: string | null
}

function assertLawfulBand(band: ForecastUncertaintyBand) {
  if (band.policyVersion !== ADAPTIVE_UNCERTAINTY_BANDS_POLICY_VERSION) {
    throw new Error(`Unsupported uncertainty-band policy version: ${band.policyVersion}`)
  }
  if (band.coverage !== FORECAST_UNCERTAINTY_BAND_COVERAGE) {
    throw new Error('Uncertainty-band coverage must equal 0.8.')
  }
  if (!Number.isInteger(band.sampleCount) || band.sampleCount < 0) {
    throw new Error('Uncertainty-band sampleCount must be a non-negative integer.')
  }

  if (band.status === 'AVAILABLE') {
    if (
      typeof band.lower !== 'number'
      || !Number.isFinite(band.lower)
      || typeof band.upper !== 'number'
      || !Number.isFinite(band.upper)
      || band.lower > band.upper
      || band.source === null
      || band.reasonCode !== null
    ) {
      throw new Error('AVAILABLE uncertainty band requires lawful finite bounds, source, and no reasonCode.')
    }
  } else if (band.lower !== null || band.upper !== null || band.reasonCode === null) {
    throw new Error('NOT_AVAILABLE uncertainty band requires null bounds and a factual reasonCode.')
  }

  if (band.source === 'MODEL_NATIVE_SHORT_HISTORY' && band.calibrationStatus === 'CALIBRATED') {
    throw new Error('Model-native uncertainty band cannot report CALIBRATED.')
  }
  if (
    band.source === 'EMPIRICAL_EXACT_RESIDUALS'
    && band.status === 'AVAILABLE'
    && (band.sampleCount < MIN_EMPIRICAL_EXACT_RESIDUALS || band.calibrationStatus !== 'CALIBRATED')
  ) {
    throw new Error('Available empirical uncertainty band requires at least 30 exact residuals and CALIBRATED status.')
  }
}

export function buildExactForecastPredictionBandIdentity(
  context: ExactBandIdentityContext,
  point: ForecastCurrentPoint,
  band: ForecastUncertaintyBand,
): ForecastPredictionBandIdentity {
  if (!band.calibrationMethod || !band.calibrationVersion) {
    throw new Error('Uncertainty-band identity requires calibration method and version.')
  }

  return {
    forecastIdentity: createForecastIdentity({
      seriesId: context.seriesId,
      targetBasis: context.targetBasis,
      modelId: context.modelId,
      methodVersion: context.methodVersion,
    }),
    inputSource: context.inputSource,
    sourceFrequency: context.sourceFrequency,
    targetCadence: context.targetCadence,
    horizonLabel: point.horizon,
    horizonSteps: point.horizonSteps,
    targetDate: point.forecastDate,
    sourceHistoryFingerprint: context.sourceHistoryFingerprint,
    trainingWindowPolicyId: context.trainingWindowPolicyId,
    effectiveTrainingPolicyId: context.effectiveTrainingPolicyId,
    bandPolicyVersion: band.policyVersion,
    bandSource: band.source,
    calibrationMethod: band.calibrationMethod,
    calibrationVersion: band.calibrationVersion,
    calibrationCutoff: context.forecastOrigin,
  }
}

export function attachExactUncertaintyBandIdentity(
  context: ExactBandIdentityContext,
  point: ForecastCurrentPoint,
): ForecastCurrentPoint {
  const metadata = point.metadata
  const band = metadata?.uncertaintyBand
  if (!metadata || !band) return point

  assertLawfulBand(band)
  return {
    ...point,
    metadata: {
      ...metadata,
      uncertaintyBand: {
        ...band,
        identity: buildExactForecastPredictionBandIdentity(context, point, band),
      },
    },
  }
}
