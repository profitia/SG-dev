import { DEFAULT_FORECAST_TARGET_BASIS, FORECAST_PORTFOLIO_MODELS, FORECAST_TARGET_BASES, isRenderableCurrentResult,
  type RollingDailyProductionForecastResult } from '../benchmark-forecast/forecast-contract'
import { resolveForecastMethodIdentity, evaluateRollingDailyCurrentForecastFreshness, toPointInTimeCurrentResult,
  toCurrentNotAvailableReason } from '../benchmark-forecast/current-publication'
import { toBenchmarkSeriesResponse, type BenchmarkAnalyticsRange, type BenchmarkAnalyticsSeriesResponse } from '../time-series/benchmark-series-publication'

/** Pure original selection and presentation only. No network, store, session or grant. */
export const NATIVE_FORECAST_API_PATHS = Object.freeze({
  current: '/api/benchmark-forecast/current', verification: '/api/benchmark-forecast/verification',
  capability: '/api/benchmark-forecast/current/capability', capabilities: '/api/benchmark-forecast/current/capabilities',
})
export type NativeForecastReadKind = keyof typeof NATIVE_FORECAST_API_PATHS

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const record = isRecord
const ranges: readonly BenchmarkAnalyticsRange[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']

export function selectNativeEmbedPage(value: string) {
  try {
    const url = new URL(value), query = url.searchParams
    const allowed = ['embed','variantId','showForecast','preparedReadsOnly','seriesId','range','displayName','organisationId']
    if (url.username || url.password || url.hash || !['/pl','/en'].includes(url.pathname)
      || [...query.keys()].some(key => !allowed.includes(key))
      || [...new Set(query.keys())].some(key => query.getAll(key).length !== 1)
      || query.get('embed') !== '1' || query.get('variantId') !== 'forecast-portfolio-v3' || query.get('showForecast') !== 'false'
      || query.get('preparedReadsOnly') !== '1' || query.get('range') !== '1Y'
      || !/^[a-z0-9_./-]{1,256}$/i.test(query.get('seriesId') ?? '') || !uuid.test(query.get('organisationId') ?? '')
      || (query.get('displayName')?.length ?? 0) > 4096) return null
    return Object.freeze({ locale: url.pathname.slice(1) as 'pl'|'en', seriesId: query.get('seriesId')!, organisationId: query.get('organisationId')! })
  } catch { return null }
}

export function selectNativeForecastRead(kind: NativeForecastReadKind, request: Request) {
  const query = new URL(request.url).searchParams
  const allowed = kind === 'capabilities' ? ['seriesId', 'organisationId']
    : kind === 'capability' ? ['seriesId', 'modelId', 'targetBasis', 'organisationId']
      : ['seriesId', 'model', 'targetBasis', 'sourceFrequency', 'targetCadence', 'organisationId']
  if ([...query.keys()].some(key => !allowed.includes(key)) || [...new Set(query.keys())].some(key => query.getAll(key).length !== 1)
    || [...request.headers.keys()].some(key => key.startsWith('x-sg-prepared-'))) return null
  const seriesId = query.get('seriesId')?.trim() ?? '', organisationId = query.get('organisationId')
  if (!/^[a-z0-9_./-]{1,256}$/i.test(seriesId) || organisationId !== null && !uuid.test(organisationId)) return null
  const parameters = new URLSearchParams({ seriesId })
  if (organisationId) parameters.set('organisationId', organisationId)
  if (kind === 'capabilities') return { parameters, resource: `forecast-readiness:${seriesId}`, seriesId }
  const modelId = FORECAST_PORTFOLIO_MODELS.find(value => value === query.get(kind === 'capability' ? 'modelId' : 'model'))
  const targetBasis = FORECAST_TARGET_BASES.find(value => value === (query.get('targetBasis')?.trim() || DEFAULT_FORECAST_TARGET_BASIS))
  if (!modelId || !targetBasis) return null
  if (kind === 'capability') {
    const semantics = resolveForecastMethodIdentity(targetBasis).targetSemantics
    parameters.set('modelId', modelId); parameters.set('targetSemantics', semantics)
    return { parameters, resource: `forecast-capability:${seriesId}:${modelId}:${semantics}`, seriesId, modelId, targetBasis }
  }
  parameters.set('model', modelId); parameters.set('targetBasis', targetBasis)
  const sourceFrequency = query.get('sourceFrequency'), targetCadence = query.get('targetCadence')
  if ((sourceFrequency !== null) !== (targetCadence !== null)
    || sourceFrequency !== null && (!/^[A-Z]{5,12}$/.test(sourceFrequency) || !/^[A-Z]{5,12}$/.test(targetCadence!))) return null
  if (sourceFrequency) { parameters.set('sourceFrequency', sourceFrequency); parameters.set('targetCadence', targetCadence!) }
  if (kind === 'verification') parameters.set('verificationScope', 'FAST')
  return { parameters, seriesId, modelId, targetBasis,
    resource: `forecast-${kind}:${seriesId}:${modelId}:${targetBasis}` + (kind === 'verification' ? ':FAST' : '')
      + (sourceFrequency ? `:${sourceFrequency}:${targetCadence}` : '') }
}


function mapCurrent(value: Record<string, unknown>, selected: NonNullable<ReturnType<typeof selectNativeForecastRead>>) {
  if (selected.targetBasis !== 'POINT_IN_TIME' || value.seriesId === selected.seriesId) return value
  if (!isRecord(value.benchmark) || value.benchmark.benchmarkId !== selected.seriesId || value.benchmark.providerSeriesId !== selected.seriesId
    || !isRecord(value.model) || value.model.id !== selected.modelId) throw Error('Invalid upstream Current identity')
  // This is a typed consumption of the required, verified native V2 publication,
  // not a validation/authority substitute or an emulated datastore model.
  const payload = value as unknown as RollingDailyProductionForecastResult
  if (!selected.modelId) throw Error('Missing model identity')
  if (payload.status !== 'AVAILABLE') {
    const method = resolveForecastMethodIdentity('POINT_IN_TIME')
    return { status: payload.status, seriesId: selected.seriesId, modelId: selected.modelId, targetBasis: 'POINT_IN_TIME',
      targetSemantics: method.targetSemantics, methodId: method.methodId,
      reason: 'reasonCode' in payload ? payload.reasonCode : 'Latest point-in-time current forecast snapshot is not available.' }
  }
  if (!payload.audit.sourceHistoryFingerprint || !/^[a-f0-9]{64}$/.test(payload.audit.sourceHistoryFingerprint)) throw Error('Missing source identity')
  // The upstream source gate already compared this hash with the actual source
  // history in its transaction. No owner datastore is consulted by the consumer.
  const result = toPointInTimeCurrentResult(selected.seriesId, selected.modelId, payload,
    evaluateRollingDailyCurrentForecastFreshness(selected.seriesId, selected.modelId, payload, payload.audit.sourceHistoryFingerprint))
  return isRenderableCurrentResult(result) ? result : toCurrentNotAvailableReason(selected.seriesId, selected.modelId, 'POINT_IN_TIME',
    'PREPARATION_REQUIRED: Exact prepared Current Forecast payload is missing a renderable point-in-time forecast path.')
}


export function mapNativeForecastRead(kind: NativeForecastReadKind, body: unknown, selected: NonNullable<ReturnType<typeof selectNativeForecastRead>>) {
      if (!isRecord(body)) return null
      const value: Record<string, unknown> = kind === 'current' ? { ...mapCurrent(body, selected) } : body
      if (value.seriesId !== selected.seriesId || selected.modelId && value.modelId !== selected.modelId
        || !['AVAILABLE', 'NOT_AVAILABLE', 'UNSUPPORTED', 'FAILED', 'NOT_PREPARED', 'STALE', 'PREPARATION_REQUIRED',
          'INSUFFICIENT_HISTORY', 'DATA_NOT_AVAILABLE', 'NOT_IMPLEMENTED', 'PROVENANCE_REQUIRED', 'NOT_LAWFUL', 'READY'].includes(String(value.status))) return null
      if (selected.targetBasis && (kind === 'capability'
        ? value.targetSemantics !== resolveForecastMethodIdentity(selected.targetBasis).targetSemantics
        : value.targetBasis !== selected.targetBasis)) return null
      if (value.status === 'AVAILABLE' && (kind === 'current' && !isRecord(value.currentForecast)
        || kind === 'verification' && !isRecord(value.verification))) return null
      if (kind === 'capabilities' && (!Array.isArray(value.variants) || value.variants.length !== 12
        || value.variants.some((item: unknown) => !isRecord(item) || item.seriesId !== selected.seriesId))) return null
  return value
}

export function selectNativeMarketRead(request: Request) {
  const query = new URL(request.url).searchParams, allowed = ['seriesId', 'range', 'locale', 'displayName', 'organisationId']
  if ([...query.keys()].some(key => !allowed.includes(key)) || [...new Set(query.keys())].some(key => query.getAll(key).length !== 1)) return null
  const seriesId = query.get('seriesId')?.trim() ?? '', range = query.get('range')?.trim().toUpperCase() || '1Y'
  const locale = query.get('locale') ?? 'pl', displayName = query.get('displayName'), organisationId = query.get('organisationId')
  if (!/^[a-z0-9_./-]{1,256}$/i.test(seriesId) || !ranges.includes(range as BenchmarkAnalyticsRange)
    || !['pl', 'en'].includes(locale) || displayName !== null && displayName.length > 4096
    || organisationId !== null && !uuid.test(organisationId)) return null
  const parameters = new URLSearchParams({ seriesId, range })
  if (organisationId) parameters.set('organisationId', organisationId)
  return { seriesId, range: range as BenchmarkAnalyticsRange, locale: locale as 'pl' | 'en', displayName, parameters }
}


export function mapNativeMarketRead(body: unknown, selected: NonNullable<ReturnType<typeof selectNativeMarketRead>>) {
  if (!record(body) || !record(body.providerSeries) || body.providerSeries.providerSeriesId !== selected.seriesId
    || body.range !== selected.range || !Array.isArray(body.historical)) return null
  return toBenchmarkSeriesResponse(body as BenchmarkAnalyticsSeriesResponse, selected.locale, selected.displayName)
}
