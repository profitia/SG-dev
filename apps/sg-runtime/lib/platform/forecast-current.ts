import { z } from 'zod'
import { OperationDenied, operationPayloadDigest, type OperationContext } from '@profitia/platform-contracts/operation-context'
import type { RollingDailyProductionForecastResult } from '@/lib/forecast/rolling-daily-production-forecast'
import { ROLLING_DAILY_METHOD_VERSION } from '@/lib/forecast/rolling-daily-policy'
import { FORECAST_NATIVE_FREQUENCIES } from '@/lib/forecast/cadence'
import type { PublicPeriodCurrentForecast } from './period-forecast-current'

export const FORECAST_CURRENT_PROJECTION = 'sg2-stored-current-v2'
export const MAX_FORECAST_CURRENT_BYTES = 4 * 1024 * 1024
export const MAX_FORECAST_CURRENT_PATH_POINTS = 366
export const MAX_FORECAST_MODEL_PARAMETERS = 512

const model = z.enum(['naive', 'damped_holt', 'ets', 'arima'])
export const ForecastCurrentSelection = z.object({
  seriesId: z.string().trim().min(1).max(256).regex(/^[a-z0-9_./-]+$/i),
  modelId: model,
  targetBasis: z.enum(['POINT_IN_TIME', 'MONTHLY_AVERAGE', 'END_OF_PERIOD']),
  sourceFrequency: z.enum(FORECAST_NATIVE_FREQUENCIES).optional(),
  targetCadence: z.enum(FORECAST_NATIVE_FREQUENCIES).optional(),
}).strict().refine(value => (value.sourceFrequency === undefined) === (value.targetCadence === undefined)
  && (value.targetBasis !== 'POINT_IN_TIME' || value.sourceFrequency === undefined
    || value.sourceFrequency === 'DAILY' && value.targetCadence === 'DAILY'))
export type ForecastCurrentSelectionValue = z.infer<typeof ForecastCurrentSelection>
export const forecastCurrentResourceId = (selection: ForecastCurrentSelectionValue) =>
  `forecast-current:${selection.seriesId}:${selection.modelId}:${selection.targetBasis}`
  + (selection.sourceFrequency ? `:${selection.sourceFrequency}:${selection.targetCadence}` : '')

const unavailableReasons = [
  'PREPARATION_REQUIRED: Rolling Daily prepared Current snapshot is MISS.',
  'PREPARATION_REQUIRED: Rolling Daily prepared Current snapshot is STALE.',
] as const
const unavailable = z.object({
  status: z.literal('NOT_AVAILABLE'), seriesId: z.string(),
  modelId: model,
  targetBasis: z.literal('POINT_IN_TIME'), targetSemantics: z.literal('ROLLING_DAILY_POINT_IN_TIME'),
  methodId: z.literal('ROLLING_DAILY_POINT_IN_TIME'), reason: z.enum(unavailableReasons),
}).strict()
export type StoredCurrentForecastResult = RollingDailyProductionForecastResult | z.infer<typeof unavailable> | PublicPeriodCurrentForecast
export function currentForecastUnavailable(selection: ForecastCurrentSelectionValue, state: 'MISS' | 'STALE'): z.infer<typeof unavailable> {
  if (selection.targetBasis !== 'POINT_IN_TIME' || state !== 'MISS' && state !== 'STALE') throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  return { status: 'NOT_AVAILABLE', seriesId: selection.seriesId, modelId: selection.modelId,
    targetBasis: 'POINT_IN_TIME', targetSemantics: 'ROLLING_DAILY_POINT_IN_TIME', methodId: 'ROLLING_DAILY_POINT_IN_TIME',
    reason: state === 'MISS' ? unavailableReasons[0] : unavailableReasons[1] }
}
export function readForecastCurrentSelection(value: unknown): ForecastCurrentSelectionValue {
  const selected = ForecastCurrentSelection.safeParse(value)
  if (!selected.success) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  return selected.data
}

/** Reviewed producer fields: Damped Holt's scalar map, ETS/statsmodels' named
 * finite coefficients, and the bounded ARIMA candidate/policy metadata. This
 * is a publication boundary, not a new model estimator or parameter policy. */
const numericParameters = new Set([
  'alpha', 'beta', 'phi', 'initial_level', 'initial_trend', 'smoothing_level', 'smoothing_trend',
  'smoothing_seasonal', 'damping_trend', 'seasonal_periods', 'sigma2', 'const', 'intercept', 'drift',
  'lamda', 'lambda', 'candidateCount',
])
const coefficient = /^(?:(?:ar|ma)(?:\.S)?\.L[1-9][0-9]{0,2}|initial_seasonal\.[0-9]{1,3}|param_[0-9]{1,3})$/
const publicPolicies: Readonly<Record<string, readonly string[]>> = {
  policyIdentity: ['ARIMA_NON_SEASONAL_BOUNDED_AICC_V1'],
  tieBreakPolicy: ['LOWER_D_THEN_LOWER_P_PLUS_Q_THEN_P_THEN_Q'],
  estimationPolicyIdentity: ['ARIMA_SAMPLE_SIZE_ADAPTIVE_EXACT_MLE_V1'],
  fitImplementation: ['STATSMODELS_ARIMA_INNOVATIONS_MLE', 'STATSMODELS_ARIMA_STATESPACE', 'STATSMODELS_ARIMA_STATESPACE_FALLBACK'],
}
export function hasPublicForecastModelParameters(value: unknown): boolean {
  if (value === null) return true
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) return false
  const entries = Object.entries(value)
  if (entries.length > MAX_FORECAST_MODEL_PARAMETERS) return false
  return entries.every(([key, item]) => {
    if (numericParameters.has(key) || coefficient.test(key)) return typeof item === 'number' && Number.isFinite(item)
    if (key === 'trend') return item === null || typeof item === 'string' && ['n', 'c', 't', 'ct'].includes(item)
    if (key === 'order' || key === 'seasonal_order') return Array.isArray(item) && item.length === (key === 'order' ? 3 : 4)
      && item.every(number => Number.isInteger(number) && number >= 0 && number <= 366)
    return typeof item === 'string' && Object.hasOwn(publicPolicies, key) && publicPolicies[key]!.includes(item)
  })
}

/** Business schema stays lazy: other native modules and legacy defaults do not
 * initialize the forecasting/Python module graph merely to compose a host. */
export async function validatePublicForecastCurrent(value: unknown, selection: ForecastCurrentSelectionValue): Promise<StoredCurrentForecastResult> {
  if (selection.targetBasis !== 'POINT_IN_TIME') {
    const { validatePublicPeriodCurrentForecast } = await import('./period-forecast-current')
    return validatePublicPeriodCurrentForecast(value, selection)
  }
  const missing = unavailable.safeParse(value)
  if (missing.success) {
    if (missing.data.seriesId !== selection.seriesId || missing.data.modelId !== selection.modelId) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
    return missing.data
  }
  const { RollingDailyProductionForecastResultSchema } = await import('@/lib/forecast/rolling-daily-production-forecast')
  const parsed = RollingDailyProductionForecastResultSchema.safeParse(value)
  if (!parsed.success) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const data = parsed.data
  let sameProjection = false
  try {
    sameProjection = operationPayloadDigest(value as Parameters<typeof operationPayloadDigest>[0])
      === operationPayloadDigest(JSON.parse(JSON.stringify(data)))
  } catch { /* Unsupported/non-finite JSON is refused below. */ }
  if (data.benchmark.benchmarkId !== selection.seriesId || data.benchmark.providerSeriesId !== selection.seriesId
    || data.model.id !== selection.modelId || data.forecastMethod.version !== ROLLING_DAILY_METHOD_VERSION
    || !hasPublicForecastModelParameters(data.model.selectedParameters)
    || typeof data.audit.sourceHistoryFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(data.audit.sourceHistoryFingerprint)
    || data.status === 'AVAILABLE' && data.path.length > MAX_FORECAST_CURRENT_PATH_POINTS
    || !sameProjection) {
    throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  }
  return data
}

export async function projectForecastCurrentResponse(value: unknown, context: Pick<OperationContext, 'payload' | 'resource'>) {
  const selection = readForecastCurrentSelection(context.payload)
  if (!(value instanceof Response) || !value.ok || context.resource.id !== forecastCurrentResourceId(selection)) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const text = await value.clone().text()
  if (Buffer.byteLength(text) > MAX_FORECAST_CURRENT_BYTES) throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  let body: unknown
  try { body = JSON.parse(text) } catch { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }
  await validatePublicForecastCurrent(body, selection)
  return value
}
