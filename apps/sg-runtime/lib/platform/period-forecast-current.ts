import { z } from 'zod'
import { OperationDenied, operationPayloadDigest } from '@profitia/platform-contracts/operation-context'
import { FORECAST_NATIVE_FREQUENCIES } from '@/lib/forecast/cadence'
import { createCurrentForecastStatisticalCompatibility, CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID,
  resolveForecastMethodContract } from '@/lib/forecast/identity'
import { attachExactUncertaintyBandIdentity } from '@/lib/forecast/uncertainty-band-policy'
import { hasPublicForecastModelParameters, type ForecastCurrentSelectionValue } from './forecast-current'

const model = z.enum(['naive', 'damped_holt', 'ets', 'arima'])
const basis = z.enum(['MONTHLY_AVERAGE', 'END_OF_PERIOD'])
const frequency = z.enum(FORECAST_NATIVE_FREQUENCIES)
const finite = z.number().finite()
const date = z.string().datetime({ offset: true })
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/)
const method = z.enum(['EMPIRICAL_RESIDUAL_QUANTILES_HF7', 'NAIVE_RANDOM_WALK_INNOVATION_RMS_NORMAL',
  'STATSMODELS_ETS_SIMULATION', 'STATSMODELS_DAMPED_HOLT_SIMULATION', 'STATSMODELS_ARIMA_FORECAST_DISTRIBUTION'])
const calibrationVersion = z.enum(['empirical-exact-residual-quantiles-v1', 'naive-random-walk-innovation-rms-normal-v1',
  'statsmodels-ets-simulation-seed-1729-r1000-v1', 'statsmodels-damped-holt-simulation-seed-1729-r1000-v1', 'statsmodels-arima-conf-int-alpha-0.2-v1'])
const bandSource = z.enum(['EMPIRICAL_EXACT_RESIDUALS', 'MODEL_NATIVE_SHORT_HISTORY'])
const bandIdentity = z.object({
  forecastIdentity: z.object({ seriesId: z.string(), modelId: model, targetSemantics: basis, methodId: basis, methodVersion: z.string() }).strict(),
  inputSource: z.literal('DYNAMIC_MARKET_DATA_STORE'), sourceFrequency: frequency, targetCadence: frequency,
  horizonLabel: z.string(), horizonSteps: z.number().int().positive(), targetDate: date.nullable(),
  sourceHistoryFingerprint: fingerprint, trainingWindowPolicyId: z.string(), effectiveTrainingPolicyId: z.string(),
  bandPolicyVersion: z.literal('ADAPTIVE_UNCERTAINTY_BANDS_V1'), bandSource: bandSource.nullable(),
  calibrationMethod: method, calibrationVersion, calibrationCutoff: date.nullable(),
}).strict()
const band = z.object({
  status: z.enum(['AVAILABLE', 'NOT_AVAILABLE']), source: bandSource.nullable(), policyVersion: z.literal('ADAPTIVE_UNCERTAINTY_BANDS_V1'),
  coverage: z.literal(0.8), lower: finite.nullable(), upper: finite.nullable(), sampleCount: z.number().int().nonnegative(),
  calibrationStatus: z.enum(['CALIBRATED', 'INSUFFICIENT_SAMPLE', 'NOT_AVAILABLE']),
  calibrationMethod: method.nullable(), calibrationVersion: calibrationVersion.nullable(),
  reasonCode: z.enum(['INSUFFICIENT_EXACT_RESIDUALS', 'INSUFFICIENT_BAND_HISTORY', 'NON_FINITE_MODEL_NATIVE_SCALE', 'MODEL_NATIVE_INTERVAL_FAILED']).nullable(),
  identity: bandIdentity.optional(),
}).strict()
const point = z.object({
  horizon: z.string().regex(/^[1-9][0-9]{0,2}[MDQWY]$/), horizonSteps: z.number().int().positive().max(10000),
  forecastDate: date, forecastValue: finite.nullable(), failureReason: z.null(),
  metadata: z.object({
    modelFamily: model, selectedVariant: z.string().max(64), selectedParameters: z.record(z.unknown()),
    selectionScore: finite.nullable(), selectionMetric: z.literal('AICc').nullable(),
    fitStatus: z.enum(['SUCCEEDED', 'FAILED']), failureReason: z.null(), uncertaintyBand: band.nullable().optional(),
  }).strict().nullable(),
}).strict()
const statistical = z.object({
  artifactScope: z.literal('CURRENT_FORECAST'), trainingWindowPolicyId: z.literal(CURRENT_FAST_MINIMAL_LAWFUL_SUFFIX_TRAINING_WINDOW_POLICY_ID),
  effectiveTrainingPolicyId: z.string().max(512), calibrationPolicy: z.literal('EXACT_STATISTICAL_MATCH_ONLY'),
}).strict()
const available = z.object({
  status: z.literal('AVAILABLE'), seriesId: z.string(), modelId: model, targetBasis: basis, targetSemantics: basis, methodId: basis,
  methodVersion: z.string(), userFacingModel: z.literal(true), displayName: z.string().max(2048), description: z.string().max(2048).nullable(),
  source: z.object({ kind: z.literal('DYNAMIC_MARKET_DATA_STORE'), runId: z.null() }).strict(),
  lineage: z.object({ inputSource: z.literal('DYNAMIC_MARKET_DATA_STORE'), inputRunId: z.null(), sourceSeriesId: z.string(),
    sourceFrequency: frequency, historyFingerprint: fingerprint, preparation: z.null(), statisticalCompatibility: statistical }).strict(),
  historyFingerprint: fingerprint,
  history: z.object({ frequency, start: date.nullable(), end: date.nullable(), observations: z.number().int().positive() }).strict(),
  forecastOrigin: date.nullable(), runtimeSeconds: finite.nonnegative().nullable(), cacheStatus: z.literal('hit'),
  alignment: z.object({ status: z.enum(['ALIGNED', 'UNALIGNED', 'INDETERMINATE']), trainingFrequency: frequency,
    lastHistoricalPeriod: date.nullable(), forecastOrigin: date.nullable(), firstForecastTarget: date.nullable() }).strict(),
  currentForecast: z.record(point).refine(value => Object.keys(value).length > 0 && Object.keys(value).length <= 366
    && Object.values(value).some(item => item.forecastValue !== null)),
}).strict()
const missingReason = 'PREPARATION_REQUIRED: Exact stored period Current Forecast unavailable.' as const
const missing = z.object({ status: z.literal('NOT_AVAILABLE'), seriesId: z.string(), modelId: model,
  targetBasis: basis, targetSemantics: basis, methodId: basis, reason: z.literal(missingReason) }).strict()
export type PublicPeriodCurrentForecast = z.infer<typeof available> | z.infer<typeof missing>

export function periodCurrentUnavailable(selection: ForecastCurrentSelectionValue): z.infer<typeof missing> {
  if (selection.targetBasis === 'POINT_IN_TIME') throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  return { status: 'NOT_AVAILABLE', seriesId: selection.seriesId, modelId: selection.modelId, targetBasis: selection.targetBasis,
    targetSemantics: selection.targetBasis, methodId: selection.targetBasis, reason: missingReason }
}
const digest = (value: unknown) => operationPayloadDigest(JSON.parse(JSON.stringify(value)))
export function hasPublicPeriodVariant(modelId: string, variant: unknown): boolean {
  if (typeof variant !== 'string') return false
  return modelId === 'naive' ? variant === 'NAIVE_LAST_VALUE'
    : modelId === 'damped_holt' ? variant === 'DAMPED_HOLT_ADDITIVE'
      : modelId === 'ets' ? /^ETS\(A,(?:N|A|Ad),(?:N|A)\)$/.test(variant)
        : modelId === 'arima' && /^ARIMA\([0-9],[0-9],[0-9]\)$/.test(variant)
}

/** Closed publication validation only. Statistical and uncertainty-band rules
 * are delegated to the existing business policy; no model is recomputed. */
export function validatePublicPeriodCurrentForecast(value: unknown, selection: ForecastCurrentSelectionValue): PublicPeriodCurrentForecast {
  const noData = missing.safeParse(value)
  if (noData.success) {
    if (digest(noData.data) !== digest(periodCurrentUnavailable(selection))) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
    return noData.data
  }
  const parsed = available.safeParse(value)
  if (!parsed.success || selection.targetBasis === 'POINT_IN_TIME') throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const data = parsed.data
  const identity = resolveForecastMethodContract(selection.targetBasis)
  const expected = createCurrentForecastStatisticalCompatibility({ sourceFrequency: data.lineage.sourceFrequency,
    targetCadence: data.history.frequency, targetSemantics: selection.targetBasis })
  if (data.seriesId !== selection.seriesId || data.modelId !== selection.modelId || data.targetBasis !== selection.targetBasis
    || data.targetSemantics !== identity.targetSemantics || data.methodId !== identity.methodId || data.methodVersion !== identity.methodVersion
    || data.lineage.sourceSeriesId !== selection.seriesId || data.historyFingerprint !== data.lineage.historyFingerprint
    || digest(data.lineage.statisticalCompatibility) !== digest(expected)
    || selection.sourceFrequency && (selection.sourceFrequency !== data.lineage.sourceFrequency || selection.targetCadence !== data.history.frequency)
    || digest(data) !== digest(value)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  for (const [horizon, item] of Object.entries(data.currentForecast)) {
    const metadata = item.metadata
    if (horizon !== item.horizon || metadata && (metadata.modelFamily !== data.modelId
      || !hasPublicPeriodVariant(data.modelId, metadata.selectedVariant) || !hasPublicForecastModelParameters(metadata.selectedParameters))) {
      throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
    }
    if (metadata?.uncertaintyBand) {
      const b=metadata.uncertaintyBand
      if ((b.calibrationMethod==='STATSMODELS_ARIMA_FORECAST_DISTRIBUTION'||b.calibrationVersion==='statsmodels-arima-conf-int-alpha-0.2-v1')
        && (data.modelId!=='arima'||b.source!=='MODEL_NATIVE_SHORT_HISTORY'||b.calibrationMethod!=='STATSMODELS_ARIMA_FORECAST_DISTRIBUTION'
          ||b.calibrationVersion!=='statsmodels-arima-conf-int-alpha-0.2-v1')) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      try {
        const derived = attachExactUncertaintyBandIdentity({ seriesId: data.seriesId, modelId: data.modelId,
          targetBasis: data.targetBasis, methodVersion: data.methodVersion, inputSource: data.source.kind,
          sourceFrequency: data.lineage.sourceFrequency, targetCadence: data.history.frequency,
          sourceHistoryFingerprint: data.historyFingerprint, trainingWindowPolicyId: expected.trainingWindowPolicyId,
          effectiveTrainingPolicyId: expected.effectiveTrainingPolicyId, forecastOrigin: data.forecastOrigin },
        { ...item, metadata: { ...metadata, uncertaintyBand: { ...metadata.uncertaintyBand, identity: undefined } } })
        if (metadata.uncertaintyBand.identity && digest(metadata.uncertaintyBand.identity) !== digest(derived.metadata?.uncertaintyBand?.identity)) {
          throw new Error('Stored band identity mismatch')
        }
      } catch { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }
    }
  }
  return data
}
