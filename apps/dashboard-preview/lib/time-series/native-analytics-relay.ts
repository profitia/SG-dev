import targets from '../../deployment/native-forecast-targets.json'
import { readNativeForecastConfiguration } from '../benchmark-forecast/native-read-relay'
import { NativeReadFailure, privateNativeReadHeaders, readNativeStoredPublication } from '../platform/native-read-transport'
import { selectNativeMarketRead, mapNativeMarketRead } from '../platform/native-chart-publication'

export const NATIVE_MARKET_ANALYTICS_PATH = '/api/series'
export const NATIVE_MARKET_ANALYTICS_PROJECTION = 'sg2-stored-market-analytics-v1'
const errorResponse = (status: number) => new Response(JSON.stringify({ error: 'Market data is unavailable.' }), { status, headers: privateNativeReadHeaders })

/** The same explicitly verified Development host serves the historical inputs
 * of the forecast chart. No separate origin or legacy datastore fallback. */
export function createNativeMarketAnalyticsHandler(options: { env?: () => Readonly<Record<string, string | undefined>>; fetch?: typeof fetch } = {}) {
  const fetchUpstream = options.fetch ?? ((input, init) => fetch(input, init))
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') { const result = errorResponse(405); result.headers.set('Allow', 'GET'); return result }
    const configuration = readNativeForecastConfiguration(options.env?.())
    if (!configuration) return errorResponse(503)
    const selection = selectNativeMarketRead(request)
    if (!selection) return errorResponse(400)
    try {
      const body = await readNativeStoredPublication(request, { configuration, operationContract: targets.operationContract,
        feature: 'market', projection: NATIVE_MARKET_ANALYTICS_PROJECTION, resource: `market-analytics:${selection.seriesId}`,
        path: '/api/benchmark/analytics-series', parameters: selection.parameters, maximumBytes: 4 * 1024 * 1024 }, fetchUpstream)
      const mapped = mapNativeMarketRead(body, selection)
      if (mapped === null) return errorResponse(503)
      const text = JSON.stringify(mapped)
      if (new TextEncoder().encode(text).byteLength > 8 * 1024 * 1024) return errorResponse(503)
      return new Response(text, { status: 200, headers: privateNativeReadHeaders })
    } catch (error) { return errorResponse(error instanceof NativeReadFailure ? error.status : 503) }
  }
}
