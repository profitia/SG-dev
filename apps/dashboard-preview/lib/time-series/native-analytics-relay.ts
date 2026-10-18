import targets from '../../deployment/native-forecast-targets.json'
import { readNativeForecastConfiguration } from '../benchmark-forecast/native-read-relay'
import { NativeReadFailure, privateNativeReadHeaders, readNativeStoredPublication } from '../platform/native-read-transport'
import { toBenchmarkSeriesResponse, type BenchmarkAnalyticsRange, type BenchmarkAnalyticsSeriesResponse } from './benchmark-series-publication'

export const NATIVE_MARKET_ANALYTICS_PATH = '/api/series'
export const NATIVE_MARKET_ANALYTICS_PROJECTION = 'sg2-stored-market-analytics-v1'
const ranges: readonly BenchmarkAnalyticsRange[] = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const errorResponse = (status: number) => new Response(JSON.stringify({ error: 'Market data is unavailable.' }), { status, headers: privateNativeReadHeaders })
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

function select(request: Request) {
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

/** The same explicitly verified Development host serves the historical inputs
 * of the forecast chart. No separate origin or legacy datastore fallback. */
export function createNativeMarketAnalyticsHandler(options: { env?: () => Readonly<Record<string, string | undefined>>; fetch?: typeof fetch } = {}) {
  const fetchUpstream = options.fetch ?? ((input, init) => fetch(input, init))
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') { const result = errorResponse(405); result.headers.set('Allow', 'GET'); return result }
    const configuration = readNativeForecastConfiguration(options.env?.())
    if (!configuration) return errorResponse(503)
    const selection = select(request)
    if (!selection) return errorResponse(400)
    try {
      const body = await readNativeStoredPublication(request, { configuration, operationContract: targets.operationContract,
        feature: 'market', projection: NATIVE_MARKET_ANALYTICS_PROJECTION, resource: `market-analytics:${selection.seriesId}`,
        path: '/api/benchmark/analytics-series', parameters: selection.parameters, maximumBytes: 4 * 1024 * 1024 }, fetchUpstream)
      // Full scientific/data-class validation belongs to the verified native
      // publication. Check selection identity before the unchanged UI mapper.
      if (!record(body) || !record(body.providerSeries) || body.providerSeries.providerSeriesId !== selection.seriesId
        || body.range !== selection.range || !Array.isArray(body.historical)) return errorResponse(503)
      const mapped = toBenchmarkSeriesResponse(body as BenchmarkAnalyticsSeriesResponse, selection.locale, selection.displayName)
      const text = JSON.stringify(mapped)
      if (new TextEncoder().encode(text).byteLength > 8 * 1024 * 1024) return errorResponse(503)
      return new Response(text, { status: 200, headers: privateNativeReadHeaders })
    } catch (error) { return errorResponse(error instanceof NativeReadFailure ? error.status : 503) }
  }
}
