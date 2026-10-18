import { EMBEDDED_READ_CONTRACT, EmbeddedReadUnavailable, openEmbeddedReadHost, readPresentationJson,
  type EmbeddedSelection, type EmbeddedReadPort } from '@profitia/platform-contracts/embedded-read-channel'
import placement from '../../../dashboard-preview/deployment/native-forecast-targets.json'
import { selectNativeEmbedPage } from '../../../dashboard-preview/lib/platform/native-chart-publication'

// One public placement descriptor shared by the two SG2 hosts. The browser
// never imports the private database/role deployment descriptor.
const embed = placement.environments.development.embedding
const target = { ...embed, origin: embed.childOrigin, operationContract: placement.operationContract,
  projections: { history: embed.historyProjection, ...placement.projections } }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const exact = (value: unknown, keys: string[]) => record(value) && Object.keys(value).sort().join(',') === keys.sort().join(',')
const kindPaths = Object.freeze({ history: '/api/benchmark/analytics-series', current: '/api/benchmark/forecast/current',
  verification: '/api/benchmark/forecast/verification', capability: '/api/internal/forecast/capability', capabilities: '/api/internal/forecast/readiness' })
type Kind = keyof typeof kindPaths
type Selection = { kind: Kind; parameters: Record<string, string> }
export type NativeDashboardContext = Readonly<{ parentOrigin: string; childOrigin: string; seriesId: string; organisationId: string }>

/** Public deployment/subject binding, never an account, grant or cached decision. */
export function nativeDashboardContext(analyticsUrl: string, parentOrigin: string): NativeDashboardContext {
  try {
    const url = new URL(analyticsUrl), selected = selectNativeEmbedPage(analyticsUrl)
    if (!selected || !target.parentOrigins.includes(parentOrigin) || url.origin !== target.origin) throw new Error('Binding unavailable')
    return Object.freeze({ parentOrigin, childOrigin: url.origin, seriesId: selected.seriesId, organisationId: selected.organisationId })
  } catch { throw new EmbeddedReadUnavailable() }
}

function select(value: EmbeddedSelection): Selection | null {
  if (!exact(value, ['kind','parameters']) || typeof value.kind !== 'string' || !Object.hasOwn(kindPaths, value.kind) || !record(value.parameters)) return null
  const kind = value.kind as Kind, parameters = value.parameters
  const keys = kind === 'history' ? ['range'] : kind === 'capabilities' ? []
    : kind === 'capability' ? ['modelId','targetSemantics'] : ['model','targetBasis','sourceFrequency','targetCadence']
  if (Object.keys(parameters).some(key => !keys.includes(key))
    || Object.values(parameters).some(item => typeof item !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(item))) return null
  if (kind === 'history' && !['1M','3M','6M','1Y','3Y','5Y','ALL'].includes(String(parameters.range))) return null
  if (kind === 'capability' && (typeof parameters.modelId !== 'string'
    || !['MONTHLY_AVERAGE','END_OF_PERIOD','ROLLING_DAILY_POINT_IN_TIME'].includes(String(parameters.targetSemantics)))) return null
  if (kind === 'current' || kind === 'verification') {
    if (typeof parameters.model !== 'string' || !['MONTHLY_AVERAGE','END_OF_PERIOD','POINT_IN_TIME'].includes(String(parameters.targetBasis))
      || Object.hasOwn(parameters,'sourceFrequency') !== Object.hasOwn(parameters,'targetCadence')
      || parameters.sourceFrequency !== undefined && (!/^[A-Z]{5,12}$/.test(String(parameters.sourceFrequency)) || !/^[A-Z]{5,12}$/.test(String(parameters.targetCadence)))) return null
  }
  return { kind, parameters: parameters as Record<string,string> }
}

function publication(context: NativeDashboardContext, selection: Selection) {
  const { kind, parameters: p } = selection, seriesId = context.seriesId
  const parameters = new URLSearchParams({ seriesId, organisationId: context.organisationId, ...p })
  if (kind === 'verification') parameters.set('verificationScope','FAST')
  const resource = kind === 'history' ? `market-analytics:${seriesId}` : kind === 'capabilities' ? `forecast-readiness:${seriesId}`
    : kind === 'capability' ? `forecast-capability:${seriesId}:${p.modelId}:${p.targetSemantics}`
      : `forecast-${kind}:${seriesId}:${p.model}:${p.targetBasis}` + (kind === 'verification' ? ':FAST' : '')
        + (p.sourceFrequency ? `:${p.sourceFrequency}:${p.targetCadence}` : '')
  return { path: kindPaths[kind], parameters, resource, feature: kind === 'history' ? 'market' : 'forecast',
    projection: target.projections[kind], maximumBytes: kind === 'capability' || kind === 'capabilities' ? 65536 : kind === 'verification' ? 8388608 : 4194304 }
}

export function openNativeDashboardReadHost(options: { port: EmbeddedReadPort; instanceId: string; context: NativeDashboardContext;
  getToken: () => Promise<string | null>; fetch?: typeof fetch }) {
  const context = Object.freeze({ ...options.context })
  // Do not let a different caller substitute a new origin or widen this binding.
  if (!target.parentOrigins.includes(context.parentOrigin) || context.childOrigin !== target.origin
    || !/^[a-z0-9_./-]{1,256}$/i.test(context.seriesId) || !uuid.test(context.organisationId)) throw new EmbeddedReadUnavailable()
  const fetchRead = options.fetch ?? ((input, init) => fetch(input, init))
  return openEmbeddedReadHost({ port: options.port, instanceId: options.instanceId, parseSelection: select,
    read: async (selected, { signal }) => {
      const unavailable = (status: number) => ({ status, body: { error: 'Read unavailable.' } })
      if (signal.aborted) return unavailable(503)
      const token = await options.getToken()
      if (signal.aborted) return unavailable(503)
      if (!token || token.length > 32761 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return unavailable(401)
      const expected = publication(context, selected)
      const response = await fetchRead(`${context.parentOrigin}${expected.path}?${expected.parameters}`, { method: 'GET',
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', credentials: 'omit', redirect: 'manual', referrerPolicy: 'no-referrer', signal })
      if (response.status !== 200) {
        await response.body?.cancel()
        return unavailable([400,401,403,404,409,413,429,503].includes(response.status) ? response.status : 503)
      }
      if (response.headers.get('x-profitia-operation-contract') !== target.operationContract
        || response.headers.get('x-profitia-application') !== 'spendguru' || response.headers.get('x-profitia-environment') !== 'development'
        || response.headers.get(`x-profitia-${expected.feature}-projection`) !== expected.projection
        || response.headers.get(`x-profitia-${expected.feature}-resource`) !== expected.resource) {
        await response.body?.cancel(); return unavailable(503)
      }
      return { status: 200, body: await readPresentationJson(response, expected.maximumBytes) }
    } })
}

export function attachNativeDashboardEmbed(options: { iframe: Pick<HTMLIFrameElement,'contentWindow'>; analyticsUrl: string;
  hostWindow: Pick<Window,'location'|'addEventListener'|'removeEventListener'>; getToken: () => Promise<string | null>;
  fetch?: typeof fetch; onResize?: (height: number) => void; channelFactory?: () => MessageChannel }) {
  const context = nativeDashboardContext(options.analyticsUrl, options.hostWindow.location.origin)
  let currentDocument: string | null = null, host: ReturnType<typeof openNativeDashboardReadHost> | null = null, closed = false
  const listener = (event: MessageEvent) => {
    if (closed || !options.iframe.contentWindow || event.source !== options.iframe.contentWindow || event.origin !== context.childOrigin) return
    const data = event.data
    if (exact(data, ['type','seriesId','height']) && data.type === 'sg-dashboard-preview:resize' && data.seriesId === context.seriesId
      && typeof data.height === 'number' && Number.isFinite(data.height)) {
      options.onResize?.(Math.min(12000,Math.max(320,Math.ceil(data.height)))); return
    }
    if (!exact(data,['type','version','documentId']) || data.type !== 'profitia.dashboard-read.ready'
      || data.version !== EMBEDDED_READ_CONTRACT.version || typeof data.documentId !== 'string' || !uuid.test(data.documentId)
      || data.documentId === currentDocument) return
    host?.close(); host = null
    const channel = options.channelFactory?.() ?? new MessageChannel(), instanceId = crypto.randomUUID()
    try {
      host = openNativeDashboardReadHost({ port: channel.port1, instanceId, context, getToken: options.getToken, fetch: options.fetch })
      currentDocument = data.documentId
      options.iframe.contentWindow.postMessage({ type:'profitia.dashboard-read.init', version:EMBEDDED_READ_CONTRACT.version,
        instanceId, documentId:currentDocument }, context.childOrigin, [channel.port2])
    } catch { host?.close(); channel.port1.close(); channel.port2.close(); currentDocument = null }
  }
  options.hostWindow.addEventListener('message',listener as EventListener)
  return Object.freeze({ close() {
    if (closed) return
    closed = true; host?.close(); host = null
    options.hostWindow.removeEventListener('message',listener as EventListener)
  } })
}
