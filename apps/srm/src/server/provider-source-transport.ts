import type pg from 'pg'
import type { PoolClient } from 'pg'
import { createHmac } from 'node:crypto'
import { createPlatformIngestionHost } from '@profitia/platform-contracts/platform-ingestion'
import { createExternalCallHost, externalNativeResponse, ExternalCallUnavailable, type NativePathRule } from '@profitia/platform-contracts/external-call'
import { createSrmNativePgDriver } from './native-pg-driver'
import { readSupplierRequest } from './supplier-request-operation'

export type SrmProvider = 'MGBI' | 'VERCLY' | 'CEIDG' | 'MGBI_MSR_API' | 'MGBI_MSR_STORAGE'
type SourceOptions = Parameters<typeof createPlatformIngestionHost<PoolClient>>[0]
type Command = Readonly<{ url: string; method: 'GET' | 'POST'; body: string | null }>
const paths = ['/v1/models/pl-krs-wp-record/records', '/v1/models/pl-krs-rdf-record/records'] as const
const MSR_LIMITS = '/v1/models/pl-krs-rdf-record/limits'
const MSR_RECORDS = '/v1/models/pl-krs-rdf-record/records/'
export const SRM_MSR_STORAGE_ORIGIN = 'https://mgbi-prod-krs-rdf-main-content-files.s3.amazonaws.com'
const refuse = (): never => { throw new ExternalCallUnavailable('NOT_SENT') }
const sources = {
  MGBI: 'srm.provider.mgbi', VERCLY: 'srm.provider.vercly', CEIDG: 'srm.provider.ceidg',
  MGBI_MSR_API: 'srm.provider.mgbi', MGBI_MSR_STORAGE: 'srm.provider.mgbi',
} as const
export function srmProviderSourcePolicy(provider: SrmProvider) {
  if (!Object.hasOwn(sources, provider)) throw new TypeError('Explicit SRM source required')
  const pathRules: NativePathRule[] = provider === 'MGBI'
    ? paths.map(path => ({ method: 'GET', path, requestFormat: 'NONE' }))
    : provider === 'MGBI_MSR_API' ? [{ method: 'GET', path: MSR_LIMITS, requestFormat: 'NONE' },
        { method: 'GET', prefix: MSR_RECORDS, parameter: 'HEX24', suffix: '/files/main_document_uri', requestFormat: 'NONE' }]
    : provider === 'MGBI_MSR_STORAGE' ? [{ method: 'GET', prefix: '/', parameter: 'STORAGE_PATH', suffix: '', requestFormat: 'NONE' }]
    : provider === 'CEIDG' ? [{ method: 'GET', path: '/api/ceidg/v3/firma', requestFormat: 'NONE' }]
      : [{ method: 'POST', path: '/api/verifications', requestFormat: 'JSON' },
        { method: 'GET', prefix: '/api/verifications/', parameter: 'OPAQUE', suffix: '', requestFormat: 'NONE' }]
  return {
    source: { id: sources[provider], payloadSchema: 'external-call-control-v1', qualityVersion: 'srm-source-control-v1', classificationVersion: 'technical-source-control-v1' },
    resourceId: provider === 'MGBI_MSR_API' ? 'srm-provider:mgbi-files-api'
      : provider === 'MGBI_MSR_STORAGE' ? 'srm-provider:mgbi-files-storage' : `srm-provider:${provider.toLowerCase()}`,
    pathRules,
    basePathRules: provider === 'VERCLY' ? [{ method: 'POST' as const, path: '/api/verifications' }, { method: 'GET' as const, path: '/api/verifications' }]
      : provider === 'MGBI_MSR_API' ? [{ method: 'GET' as const, path: MSR_LIMITS }, { method: 'GET' as const, path: MSR_RECORDS.slice(0,-1) }]
      : provider === 'MGBI_MSR_STORAGE' ? [{ method: 'GET' as const, path: '/' }]
      : pathRules.map(rule => ({ method: rule.method, path: 'path' in rule ? rule.path : refuse() })),
  }
}

/** Source transport only. A committed source receipt is neither HUMAN access
 * nor permission to deliver personal fields. Original provider clients own
 * parsing, pagination, polling and domain validation. No fetch/retry fallback. */
type ProviderSourceOptions = {
  provider: SrmProvider; providerOrigin: string; nip: string; operationKey: string
  application: SourceOptions['application']; binding: SourceOptions['binding']
  pool: pg.Pool; auditPool: pg.Pool; now?: () => number
  external: { configurationVersion: string; schemaDigest: string; nativeSchemaDigest: string; maximumResponseBytes: number }
  /** Existing server-owned credentials; never obtained from incoming HTTP. */
  headers: Readonly<Record<string, string>>
  /** Explicit loopback fixture only; never a cloud or user-supplied redirect. */
  syntheticOrigin?: string
  /** Only the original server-selected MSR candidate, never an HTTP parameter. */
  recordId?: string
  /** Consumed redirect captured by the closed MSR composition below. */
  allowedStorageUrl?: () => string | null
}
function createProviderSourceTransport(options: ProviderSourceOptions) {
  const { provider, pool, auditPool, now } = options
  const policy = srmProviderSourcePolicy(provider), root = structuredClone({ application: options.application, binding: options.binding, external: options.external })
  const nip = readSupplierRequest({ kind: 'SUPPLIER_REPORT', nip: options.nip }).nip
  const operationKey = options.operationKey, providerOrigin = options.providerOrigin
  const recordId = options.recordId, allowedStorageUrl = options.allowedStorageUrl
  const credentialFree = provider === 'MGBI_MSR_STORAGE'
  let configured: URL, network: URL
  try { configured = new URL(providerOrigin); network = new URL(options.syntheticOrigin ?? providerOrigin) } catch { throw new TypeError('Fixed provider origin required') }
  if (typeof window !== 'undefined' || !/^[a-f0-9]{64}$/.test(operationKey)
    || configured.origin !== providerOrigin || configured.protocol !== 'https:'
    || ['MGBI','MGBI_MSR_API'].includes(provider) && providerOrigin !== 'https://api.mgbi.pl'
    || credentialFree && providerOrigin !== SRM_MSR_STORAGE_ORIGIN
    || provider === 'MGBI_MSR_API' && !/^[a-f0-9]{24}$/.test(recordId ?? '')
    || provider !== 'MGBI_MSR_API' && recordId !== undefined
    || credentialFree && typeof allowedStorageUrl !== 'function'
    || !credentialFree && allowedStorageUrl !== undefined
    || provider === 'CEIDG' && providerOrigin !== 'https://dane.biznes.gov.pl'
    || root.application.appId !== 'srm-provider-source' || root.binding.applicationId !== root.application.appId
    || options.syntheticOrigin !== undefined && (root.application.environment !== 'development'
      || network.origin !== options.syntheticOrigin || network.protocol !== 'http:' || network.hostname !== '127.0.0.1' || !network.port)) {
    throw new TypeError('Explicit server-owned SRM source binding required')
  }
  const headers = Object.fromEntries(new Headers(options.headers).entries())
  if ((credentialFree ? Object.keys(headers).length !== 0 : !headers.authorization)
    || Object.keys(headers).some(key => !['authorization', 'accept', 'content-type'].includes(key))) throw new TypeError('Explicit source credential required')
  const driver = createSrmNativePgDriver(pool, auditPool)
  const sourceHost = createPlatformIngestionHost<PoolClient>({ ...root, source: policy.source, now, ...driver,
    validateSharedPayload: value => !!value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).sort().join(',') === 'action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status',
  })
  const parseCommand = (value: unknown): Command => {
    if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).sort().join(',') !== 'body,method,url') return refuse()
    const c = value as Command
    if (typeof c.url !== 'string' || c.url.length > 4096 || !['GET', 'POST'].includes(c.method)
      || !(c.body === null || typeof c.body === 'string') || c.method === 'GET' && c.body !== null) return refuse()
    let url: URL
    try { url = new URL(c.url) } catch { return refuse() }
    if (url.origin !== providerOrigin || url.username || url.password || url.hash || url.href !== c.url) return refuse()
    const entries = [...url.searchParams], keys = entries.map(([key]) => key)
    if (new Set(keys).size !== keys.length) return refuse()
    if (provider === 'MGBI_MSR_API') {
      if (c.method !== 'GET' || entries.length || c.url !== providerOrigin + url.pathname
        || ![MSR_LIMITS,MSR_RECORDS + recordId + '/files/main_document_uri'].includes(url.pathname)) return refuse()
    } else if (credentialFree) {
      if (c.method !== 'GET' || c.url !== allowedStorageUrl!()) return refuse()
    } else if (provider === 'MGBI') {
      if (c.method !== 'GET' || !paths.includes(url.pathname as typeof paths[number])
        || keys.some(key => !['identifiers.pl_nip', 'page', 'per_page'].includes(key))
        || url.searchParams.get('identifiers.pl_nip') !== nip
        || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(url.searchParams.get('page') ?? '')
        || url.searchParams.get('per_page') !== '100') return refuse()
    } else if (provider === 'CEIDG') {
      if (c.method !== 'GET' || url.pathname !== '/api/ceidg/v3/firma' || keys.join(',') !== 'nip' || url.searchParams.get('nip') !== nip) return refuse()
    } else {
      if (entries.length) return refuse()
      if (c.method === 'POST') {
        if (url.pathname !== '/api/verifications' || c.body !== JSON.stringify([{ Id: nip, Country: 'PL' }])) return refuse()
      } else if (!/^\/api\/verifications\/[A-Za-z0-9_-]{8,100}$/.test(url.pathname)) return refuse()
    }
    return Object.freeze({ url: url.href, method: c.method, body: c.body })
  }
  const nativeTransport = { schemaDigest: root.external.nativeSchemaDigest, pathRules: policy.pathRules,
    redirectOrigins: provider === 'MGBI_MSR_API' || credentialFree ? [SRM_MSR_STORAGE_ORIGIN] : [],
    maximumResponseBytes: root.external.maximumResponseBytes, completionMode: 'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT' as const }
  const credentials = credentialFree ? {nativeTransport:{...nativeTransport,credentialMode:'NONE' as const}}
    : {nativeTransport:{...nativeTransport,credentialMode:'SERVER_HEADERS' as const},getHeaders:()=>({...headers})}
  const host = createExternalCallHost<PoolClient, Command>({ sourceHost, sourceId: policy.source.id, resourceId: policy.resourceId, now,
    binding: { role: root.binding.role, configurationVersion: root.external.configurationVersion, schemaDigest: root.external.schemaDigest,
      origin: network.origin, transport: options.syntheticOrigin ? 'LOCAL_SYNTHETIC_HTTP' : 'HTTPS', pathRules: policy.basePathRules },
    ...credentials,
    independentQuery: driver.independentQuery, query: async (client, sql, values = []) => ({ rows: (await client.query(sql, values)).rows }),
    parseCommand, buildRequest: c => ({ method: c.method, url: network.origin + new URL(c.url).pathname + new URL(c.url).search, body: c.body }),
  })
  let ordinal = 0, busy = false, unavailable = false, postAttempted = false, correlation: string | null = null
  let msrLimitsSeen = false, msrFileAttempted = false
  const nextPage = new Map<string, number>()
  const fetcher: typeof fetch = async (input, init = {}) => {
    if (busy || unavailable || input instanceof Request || Object.keys(init).some(key => !['method', 'headers', 'body', 'signal', 'cache', 'redirect'].includes(key))
      || init.redirect !== undefined && init.redirect !== 'manual' && !(provider === 'MGBI_MSR_API' && init.redirect === 'error')
      || init.cache !== undefined && init.cache !== 'no-store'
      || init.body != null && typeof init.body !== 'string') return refuse()
    const suppliedHeaders = new Headers(init.headers)
    for (const [key, value] of suppliedHeaders) {
      if (!['authorization', 'accept', 'content-type'].includes(key) || key === 'authorization' && value !== headers.authorization) return refuse()
    }
    const command = parseCommand({ url: String(input), method: init.method ?? 'GET', body: init.body ?? null })
    const url = new URL(command.url)
    if (provider === 'MGBI_MSR_API') {
      if (init.redirect === 'error' && url.pathname !== MSR_LIMITS) return refuse()
      if (url.pathname === MSR_LIMITS) { if (msrLimitsSeen || msrFileAttempted) return refuse() }
      else { if (!msrLimitsSeen || msrFileAttempted) return refuse(); msrFileAttempted = true }
    }
    if (provider === 'VERCLY') {
      if (command.method === 'POST') { if (postAttempted) return refuse(); postAttempted = true }
      else if (correlation === null || url.pathname !== `/api/verifications/${correlation}`) return refuse()
    }
    if (provider === 'MGBI') {
      const page = Number(url.searchParams.get('page'))
      if (page !== (nextPage.get(url.pathname) ?? 1)) return refuse()
      nextPage.set(url.pathname, page + 1)
    }
    // The ordinal, not the command, owns the stable intent. Changed payload at
    // the same position conflicts with the old receipt instead of buying anew.
    const intentKey = createHmac('sha256', Buffer.from(operationKey, 'hex')).update(JSON.stringify({ sourceId: policy.source.id, ordinal: ordinal++ })).digest('hex')
    busy = true
    try {
      const response = externalNativeResponse(await host.execute({ command, intentKey }, { signal: init.signal ?? undefined }))
      if (provider === 'MGBI_MSR_API' && url.pathname === MSR_LIMITS) msrLimitsSeen = response.ok
      if (provider === 'VERCLY' && command.method === 'POST') {
        if (response.ok) {
          let value: unknown
          try { value = await response.clone().json() } catch { unavailable = true }
          if (Array.isArray(value) && typeof value[0] === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value[0])) correlation = value[0]
          else unavailable = true
        } else unavailable = true
      }
      return response
    }
    catch (error) { unavailable = true; throw error }
    finally { busy = false }
  }
  return Object.freeze({ fetcher })
}

/** Existing public clients cannot instantiate a storage transport or supply a
 * redirect predicate. The closed MSR composition owns those internal options. */
export function createSrmProviderSourceTransport(options:Omit<ProviderSourceOptions,
  'provider'|'recordId'|'allowedStorageUrl'> & {provider:'MGBI'|'VERCLY'|'CEIDG'}) {
  if (!['MGBI','VERCLY','CEIDG'].includes(options?.provider)) throw TypeError('Explicit original provider required')
  return createProviderSourceTransport(options)
}

/** Routes the unchanged original MSR client through the same Source transport.
 * Storage can consume only a redirect observed from its own admitted response.
 * No credential or browser-supplied URL becomes storage authority. */
export function createSrmMsrSourceTransport(options: Omit<ProviderSourceOptions,
  'provider'|'providerOrigin'|'allowedStorageUrl'|'recordId'> & {recordId:string;syntheticStorageOrigin?:string}) {
  if (typeof window !== 'undefined' || !/^[a-f0-9]{24}$/.test(options.recordId)) throw TypeError('Explicit original MSR selection required')
  const {recordId,syntheticStorageOrigin,...common} = options
  let expectedStorageUrl: string | null = null, activeStorageUrl: string | null = null, failed = false, busy = false, storageRequests = 0
  const api = createProviderSourceTransport({...common,provider:'MGBI_MSR_API',providerOrigin:'https://api.mgbi.pl',recordId})
  const storage = createProviderSourceTransport({...common,provider:'MGBI_MSR_STORAGE',providerOrigin:SRM_MSR_STORAGE_ORIGIN,
    headers:{},syntheticOrigin:syntheticStorageOrigin ?? common.syntheticOrigin,allowedStorageUrl:()=>activeStorageUrl})
  const fetcher:typeof fetch = async(input,init={})=>{
    if (failed || busy || input instanceof Request) return refuse()
    const selectedInput=typeof input==='string'?input:input instanceof URL?input.href:refuse()
    let url:URL
    try { url=new URL(selectedInput) } catch { return refuse() }
    const isStorage=url.origin===SRM_MSR_STORAGE_ORIGIN
    if (isStorage && (selectedInput!==expectedStorageUrl || storageRequests>=3)
      || !isStorage && url.origin!=='https://api.mgbi.pl') return refuse()
    busy=true
    try {
      let response:Response
      if (isStorage) {
        activeStorageUrl=expectedStorageUrl;expectedStorageUrl=null;storageRequests++
        try { response=await storage.fetcher(selectedInput,init) } finally { activeStorageUrl=null }
      } else response=await api.fetcher(selectedInput,init)
      if ([302,307].includes(response.status)) {
        if (!isStorage && url.pathname!==MSR_RECORDS+recordId+'/files/main_document_uri') return refuse()
        const location=response.headers.get('location')
        if (!location || new URL(location).origin!==SRM_MSR_STORAGE_ORIGIN) return refuse()
        expectedStorageUrl=location
      }
      return response
    } catch(error) {failed=true;expectedStorageUrl=null;throw error}
    finally {busy=false}
  }
  return Object.freeze({fetcher})
}
