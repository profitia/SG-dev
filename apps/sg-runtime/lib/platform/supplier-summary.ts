import { OperationDenied, type OperationContext } from '@profitia/platform-contracts/operation-context'
import { readSharedFinancialSummary } from '@profitia/srm-xray/shared-financial-summary'

export const SUPPLIER_SUMMARY_HEADERS = Object.freeze({ 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' })
export const SUPPLIER_SUMMARY_PROJECTION = 'shared-financial-summary-envelope-v1'
export type SupplierSummarySelection = { nip: string; entityType: 'COMPANY' | 'JDG' }
const refused = (reason: 'CONTEXT_INVALID' | 'RESOURCE_SCOPE_MISMATCH' | 'POLICY_UNAVAILABLE' | 'UNVERIFIED_IDENTITY' | 'PERMISSION_DENIED' = 'POLICY_UNAVAILABLE'): never => { throw new OperationDenied(reason) }

export function readSupplierSummarySelection(value: unknown): SupplierSummarySelection {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2
    || Object.keys(value).some(key => !['nip','entityType'].includes(key))
    || !('nip' in value) || typeof value.nip !== 'string' || !/^\d{10}$/.test(value.nip)
    || !('entityType' in value) || typeof value.entityType !== 'string' || !['COMPANY','JDG'].includes(value.entityType)) return refused('CONTEXT_INVALID')
  return { nip: value.nip, entityType: value.entityType as SupplierSummarySelection['entityType'] }
}

/** The host pins the peer; no HTTP caller supplies a URL, cookies, role or
 * identity header. Both applications independently verify this session. */
export async function fetchSupplierSummary(options: {
  origin: string; authorization: string; context: Readonly<OperationContext>; signal: AbortSignal
  fetcher?: typeof fetch; timeoutMs?: number; maximumBytes?: number
}): Promise<Response> {
  const { context, authorization, signal, fetcher = fetch, timeoutMs = 5000, maximumBytes = 4 * 1024 * 1024 } = options
  const selection = readSupplierSummarySelection(context.payload)
  if (!/^Bearer [^\s]{1,8192}$/.test(authorization) || !context.organisationId
    || context.operation !== 'supplier.report.read' || context.resourceId !== `supplier-report:${selection.entityType}:${selection.nip}`
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5000
    || !Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 4 * 1024 * 1024) return refused()
  let origin: URL
  try { origin = new URL(options.origin) } catch { return refused() }
  if (origin.origin !== options.origin || origin.protocol !== 'https:') return refused()
  const url = new URL('/api/xray/financial-summary', origin)
  url.searchParams.set('nip', selection.nip); url.searchParams.set('entityType', selection.entityType)
  url.searchParams.set('organisationId', context.organisationId)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const combined = AbortSignal.any([signal, controller.signal])
  let upstream: Response | undefined
  try {
    if (combined.aborted) return refused()
    upstream = await fetcher(url, { method: 'GET', headers: { authorization }, credentials: 'omit',
      cache: 'no-store', redirect: 'error', signal: combined })
    if (upstream.status !== 200) {
      await upstream.body?.cancel()
      return refused(upstream.status === 401 ? 'UNVERIFIED_IDENTITY' : upstream.status === 403 ? 'PERMISSION_DENIED' : 'POLICY_UNAVAILABLE')
    }
    if (upstream.redirected || upstream.url && new URL(upstream.url).origin !== origin.origin
      || upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
      || upstream.headers.get('cache-control') !== 'private, no-store' || upstream.headers.has('set-cookie')
      || !['cookie','authorization'].every(key => upstream!.headers.get('vary')?.toLowerCase().split(',').map(value => value.trim()).includes(key))
      || upstream.headers.has('location') || !upstream.body) return refused()
    const length = upstream.headers.get('content-length')
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumBytes)) return refused()
    const reader = upstream.body.getReader(), chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const item = await reader.read()
        if (combined.aborted) return refused()
        if (item.done) break
        size += item.value.byteLength
        if (size > maximumBytes) return refused()
        chunks.push(item.value)
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const body = readSharedFinancialSummary(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), selection)
    return Response.json(body, { headers: SUPPLIER_SUMMARY_HEADERS })
  } finally {
    clearTimeout(timer)
    if (upstream?.body && !upstream.body.locked) await upstream.body.cancel().catch(() => {})
  }
}

export async function projectSupplierSummaryResponse(value: unknown, context: Readonly<OperationContext>): Promise<Response> {
  if (!(value instanceof Response) || value.status !== 200
    || value.headers.get('cache-control') !== 'private, no-store' || value.headers.get('vary') !== 'Cookie, Authorization'
    || value.headers.get('content-type') !== 'application/json'
    || [...value.headers.keys()].some(key => !['cache-control','vary','content-type'].includes(key))) return refused('RESOURCE_SCOPE_MISMATCH')
  try { readSharedFinancialSummary(await value.clone().json(), readSupplierSummarySelection(context.payload)) }
  catch { return refused('RESOURCE_SCOPE_MISMATCH') }
  return value
}
