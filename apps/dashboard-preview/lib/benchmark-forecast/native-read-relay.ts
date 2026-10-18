import targets from '../../deployment/native-forecast-targets.json'
import { DEFAULT_FORECAST_TARGET_BASIS, FORECAST_PORTFOLIO_MODELS, FORECAST_TARGET_BASES, isRenderableCurrentResult,
  type RollingDailyProductionForecastResult } from './forecast-contract'
import { resolveForecastMethodIdentity, evaluateRollingDailyCurrentForecastFreshness, toPointInTimeCurrentResult,
  toCurrentNotAvailableReason } from './current-publication'

export const NATIVE_FORECAST_API_PATHS = Object.freeze({
  current: '/api/benchmark-forecast/current', verification: '/api/benchmark-forecast/verification',
  capability: '/api/benchmark-forecast/current/capability', capabilities: '/api/benchmark-forecast/current/capabilities',
})
export type NativeForecastReadKind = keyof typeof NATIVE_FORECAST_API_PATHS
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

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const privateHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' }
const errorResponse = (status: number) => new Response(JSON.stringify({ error: 'Forecast data is unavailable.' }), { status, headers: privateHeaders })
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export const MAX_NATIVE_FORECAST_BYTES = 8 * 1024 * 1024

function select(kind: NativeForecastReadKind, request: Request) {
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

async function readBoundedJson(response: Response, maximum: number): Promise<unknown> {
  if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json' || !response.body) throw Error('Invalid upstream representation')
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let bytes = 0, text = ''
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > maximum) { await reader.cancel(); throw Error('Upstream representation too large') }
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode()
  } finally { reader.releaseLock() }
  return JSON.parse(text)
}

/** The pinned HTTPS native host owns full scientific/publication validation.
 * Its admitted context metadata is required before consuming the DTO. This
 * adapter preserves the existing UI projection; it grants no access itself. */
function mapCurrent(value: Record<string, unknown>, selected: NonNullable<ReturnType<typeof select>>) {
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

export function createNativeForecastReadHandler(kind: NativeForecastReadKind,
  options: { env?: () => Environment; fetch?: typeof fetch } = {}) {
  if (!Object.hasOwn(NATIVE_FORECAST_API_PATHS, kind)) throw new TypeError('Explicit native forecast read required')
  const fetchUpstream = options.fetch ?? ((input, init) => fetch(input, init))
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') { const result = errorResponse(405); result.headers.set('Allow', 'GET'); return result }
    const configuration = readNativeForecastConfiguration(options.env?.())
    if (!configuration) return errorResponse(503)
    const selected = select(kind, request)
    if (!selected) return errorResponse(400)
    const authorization = request.headers.get('authorization')?.trim()
    if (!authorization || authorization.length > 32768 || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(authorization)) return errorResponse(401)
    const path = kind === 'current' || kind === 'verification' ? `/api/benchmark/forecast/${kind}`
      : `/api/internal/forecast/${kind === 'capabilities' ? 'readiness' : 'capability'}`
    try {
      const response = await fetchUpstream(`${configuration.origin}${path}?${selected.parameters}`, {
        method: 'GET', headers: { Authorization: authorization }, cache: 'no-store', credentials: 'omit', redirect: 'manual',
        referrerPolicy: 'no-referrer', signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
      })
      if (response.status !== 200) {
        await response.body?.cancel()
        return errorResponse([400, 401, 403, 404, 409, 413, 429, 503].includes(response.status) ? response.status : 503)
      }
      if (response.headers.get('x-profitia-operation-contract') !== targets.operationContract
        || response.headers.get('x-profitia-application') !== configuration.applicationId
        || response.headers.get('x-profitia-environment') !== configuration.environment
        || response.headers.get('x-profitia-forecast-projection') !== targets.projections[kind]
        || response.headers.get('x-profitia-forecast-resource') !== selected.resource) {
        await response.body?.cancel(); return errorResponse(503)
      }
      const body = await readBoundedJson(response, kind === 'capability' || kind === 'capabilities' ? 65536
        : kind === 'current' ? 4 * 1024 * 1024 : MAX_NATIVE_FORECAST_BYTES)
      if (!isRecord(body)) return errorResponse(503)
      const value: Record<string, unknown> = kind === 'current' ? { ...mapCurrent(body, selected) } : body
      if (value.seriesId !== selected.seriesId || selected.modelId && value.modelId !== selected.modelId
        || !['AVAILABLE', 'NOT_AVAILABLE', 'UNSUPPORTED', 'FAILED', 'NOT_PREPARED', 'STALE', 'PREPARATION_REQUIRED',
          'INSUFFICIENT_HISTORY', 'DATA_NOT_AVAILABLE', 'NOT_IMPLEMENTED', 'PROVENANCE_REQUIRED', 'NOT_LAWFUL', 'READY'].includes(String(value.status))) return errorResponse(503)
      if (selected.targetBasis && (kind === 'capability'
        ? value.targetSemantics !== resolveForecastMethodIdentity(selected.targetBasis).targetSemantics
        : value.targetBasis !== selected.targetBasis)) return errorResponse(503)
      if (value.status === 'AVAILABLE' && (kind === 'current' && !isRecord(value.currentForecast)
        || kind === 'verification' && !isRecord(value.verification))) return errorResponse(503)
      if (kind === 'capabilities' && (!Array.isArray(value.variants) || value.variants.length !== 12
        || value.variants.some((item: unknown) => !isRecord(item) || item.seriesId !== selected.seriesId))) return errorResponse(503)
      const text = JSON.stringify(value)
      if (new TextEncoder().encode(text).byteLength > MAX_NATIVE_FORECAST_BYTES) return errorResponse(503)
      return new Response(text, { status: 200, headers: privateHeaders })
    } catch { return errorResponse(503) }
  }
}
