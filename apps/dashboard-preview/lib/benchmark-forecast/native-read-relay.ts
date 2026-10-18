import { NativeReadFailure, privateNativeReadHeaders, readNativeStoredPublication } from '../platform/native-read-transport'
import targets from '../../deployment/native-forecast-targets.json'
import { NATIVE_FORECAST_API_PATHS, selectNativeForecastRead, mapNativeForecastRead, type NativeForecastReadKind } from '../platform/native-chart-publication'
export { NATIVE_FORECAST_API_PATHS, type NativeForecastReadKind } from '../platform/native-chart-publication'

type Environment = Readonly<Record<string, string | undefined>>
export function nativeForecastApiKind(path: string): NativeForecastReadKind | undefined {
  return (Object.keys(NATIVE_FORECAST_API_PATHS) as NativeForecastReadKind[]).find(kind => NATIVE_FORECAST_API_PATHS[kind] === path)
}

/** Deployment configuration only. No user, organisation, credential or grant is
 * cached here. Staging needs its own verified release binding; no URL fallback. */
export function readNativeForecastConfiguration(env: Environment = process.env) {
  const target = targets.environments.development
  if (env.PROFITIA_AUTH_PROVIDER !== 'clerk' || env.APP_ENV !== 'development' || env.TARGET_ENVIRONMENT !== 'development'
    || env.RENDER_SERVICE_ID !== undefined && env.RENDER_SERVICE_ID !== target.consumerServiceId
    || env.PROFITIA_FORECAST_API_CONFIGURATION_VERSION !== target.configurationVersion
    || env.PROFITIA_FORECAST_API_ORIGIN !== target.origin) return null
  return Object.freeze({ environment: 'development' as const, origin: target.origin,
    configurationVersion: target.configurationVersion, applicationId: targets.applicationId })
}

const privateHeaders = privateNativeReadHeaders
const errorResponse = (status: number) => new Response(JSON.stringify({ error: 'Forecast data is unavailable.' }), { status, headers: privateHeaders })
export const MAX_NATIVE_FORECAST_BYTES = 8 * 1024 * 1024

export function createNativeForecastReadHandler(kind: NativeForecastReadKind,
  options: { env?: () => Environment; fetch?: typeof fetch } = {}) {
  if (!Object.hasOwn(NATIVE_FORECAST_API_PATHS, kind)) throw new TypeError('Explicit native forecast read required')
  const fetchUpstream = options.fetch ?? ((input, init) => fetch(input, init))
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') { const result = errorResponse(405); result.headers.set('Allow', 'GET'); return result }
    const configuration = readNativeForecastConfiguration(options.env?.())
    if (!configuration) return errorResponse(503)
    const selected = selectNativeForecastRead(kind, request)
    if (!selected) return errorResponse(400)
    const path = kind === 'current' || kind === 'verification' ? `/api/benchmark/forecast/${kind}`
      : `/api/internal/forecast/${kind === 'capabilities' ? 'readiness' : 'capability'}`
    try {
      const body = await readNativeStoredPublication(request, { configuration, operationContract: targets.operationContract,
        feature: 'forecast', projection: targets.projections[kind], resource: selected.resource, path, parameters: selected.parameters,
        maximumBytes: kind === 'capability' || kind === 'capabilities' ? 65536
          : kind === 'current' ? 4 * 1024 * 1024 : MAX_NATIVE_FORECAST_BYTES }, fetchUpstream)
      const value = mapNativeForecastRead(kind, body, selected)
      if (value === null) return errorResponse(503)
      const text = JSON.stringify(value)
      if (new TextEncoder().encode(text).byteLength > MAX_NATIVE_FORECAST_BYTES) return errorResponse(503)
      return new Response(text, { status: 200, headers: privateHeaders })
    } catch (error) { return errorResponse(error instanceof NativeReadFailure ? error.status : 503) }
  }
}
