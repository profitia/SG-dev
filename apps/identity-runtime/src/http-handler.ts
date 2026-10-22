import { BoundaryError, type SessionBoundary } from './contracts.js'
import { checkRequest } from './session-boundary.js'
const headers = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff', vary: 'Cookie, Authorization, Origin', 'content-type': 'application/json' }
function json(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers }) }
async function body(request: Request): Promise<unknown> {
  const length = request.headers.get('content-length'); if (length && (!/^\d+$/.test(length) || Number(length) > 4096)) throw new BoundaryError(400, 'BODY_LIMIT')
  const reader = request.body?.getReader(); if (!reader) throw new BoundaryError(400, 'JSON_REQUIRED')
  const chunks: Uint8Array[] = []; let total = 0
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > 4096) { await reader.cancel(); throw new BoundaryError(400, 'BODY_LIMIT') } chunks.push(value) } }
  finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new BoundaryError(400, 'INVALID_JSON') }
}
/** A missing SDK/authority is an explicit health-only application, never an operational login. */
export function createHttpHandler(boundary: SessionBoundary | null) {
  return async (request: Request): Promise<Response> => {
    try {
      const url = new URL(request.url)
      if (url.search || url.hash || !['/healthz','/readyz','/v1/session','/v1/flows','/v1/flows/consume','/v1/session/logout'].includes(url.pathname)) return json(404, { error: 'NOT_FOUND' })
      const get = ['/healthz','/readyz','/v1/session'].includes(url.pathname)
      if (request.method !== (get ? 'GET' : 'POST')) return json(405, { error: 'METHOD_NOT_ALLOWED' })
      if (url.pathname === '/healthz') return json(200, { service: 'identity-runtime', status: 'ok' })
      if (url.pathname === '/readyz') return json(boundary && await boundary.ready() ? 200 : 503, { ready: Boolean(boundary && await boundary.ready()) })
      if (!boundary) return json(503, { error: 'IDENTITY_UNAVAILABLE' })
      checkRequest(request, boundary.configuration, !get)
      if (url.pathname === '/v1/session') { const result = await boundary.session(request); return json(result.status === 'authenticated' ? 200 : result.status === 'unavailable' ? 503 : 401, { authenticated: result.status === 'authenticated' }) }
      if (url.pathname === '/v1/session/logout') { const input = await body(request); if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) return json(400, { error: 'EMPTY_OBJECT_REQUIRED' }); await boundary.logout(request); return json(200, { session: 'revoked' }) }
      if (url.pathname === '/v1/flows') return json(201, await boundary.beginFlow(request, await body(request)))
      const location = await boundary.consumeFlow(request, await body(request)); return new Response(null, { status: 303, headers: { ...headers, location } })
    } catch (error) { return error instanceof BoundaryError ? json(error.status, { error: error.code }) : json(503, { error: 'IDENTITY_UNAVAILABLE' }) }
  }
}
