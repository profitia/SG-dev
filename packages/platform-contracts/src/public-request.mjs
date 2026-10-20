import { createHash } from 'node:crypto'

function exactOrigin(value) {
  try {
    const url = new URL(value)
    return typeof value === 'string' && url.origin === value && !url.username && !url.password && !url.hostname.includes('*')
      && (url.protocol === 'https:' || url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname))
  } catch { return false }
}

/** An explicit host adapter for identity verification behind a reverse proxy.
 * Host is matched against deployment-owned PUBLIC origins, never trusted as an
 * arbitrary URL. Forwarded headers confer no authority. The returned request is
 * header-only, for the existing authenticator, not a business transport: the
 * original body may already be consumed and is neither read nor replaced here.
 * No identity, permission, membership or session is granted by normalization. */
export function createPublicIdentityRequestBoundary(input) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype
    || Object.keys(input).sort().join(',') !== 'internalOrigins,publicOrigins') throw TypeError('Explicit public request boundary required')
  const { publicOrigins, internalOrigins } = structuredClone(input)
  for (const origins of [publicOrigins, internalOrigins]) {
    if (!Array.isArray(origins) || !origins.length || origins.length > 16 || origins.some(value => !exactOrigin(value))
      || new Set(origins).size !== origins.length) throw TypeError('Exact unique origins required')
  }
  if (internalOrigins.some(value => !['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(new URL(value).hostname))
    || publicOrigins.some(value => internalOrigins.includes(value))
    || new Set(publicOrigins.map(value => new URL(value).host)).size !== publicOrigins.length) throw TypeError('Unambiguous explicit proxy boundary required')
  const byHost = new Map(publicOrigins.map(value => [new URL(value).host, value]))
  return request => {
    if (!(request instanceof Request) || request.signal.aborted) return null
    let url
    try { url = new URL(request.url) } catch { return null }
    if (url.username || url.password || url.hash) return null
    const host = request.headers.get('host')
    let publicOrigin
    if (publicOrigins.includes(url.origin)) {
      if (host !== null && host !== url.host) return null
      publicOrigin = url.origin
    } else {
      if (!internalOrigins.includes(url.origin) || !host || !byHost.has(host)) return null
      publicOrigin = byHost.get(host)
    }
    if (request.headers.has('origin') && request.headers.get('origin') !== publicOrigin) return null
    // Set only the authority. Path/query are preserved exactly as URL parsed
    // them, including paths starting with //; they cannot replace the host.
    const target = new URL(publicOrigin)
    target.pathname = url.pathname; target.search = url.search
    return new Request(target, { method: request.method, headers: new Headers(request.headers), signal: request.signal })
  }
}

/** Adapt only the request passed to the existing verifier. Its result and all
 * subsequent private-store authority checks remain unchanged. */
export function bindPublicIdentityAuthenticator(authenticate, input) {
  if (typeof authenticate !== 'function') throw TypeError('Existing authenticator required')
  const normalize = createPublicIdentityRequestBoundary(input)
  return async request => {
    const normalized = normalize(request)
    return normalized ? authenticate(normalized) : null
  }
}

export async function publicIdentityRequestSourceDigest() {
  const fs = await import('node:fs')
  return createHash('sha256').update(fs.readFileSync(new URL('./public-request.mjs', import.meta.url)))
    .update(fs.readFileSync(new URL('./public-request.d.mts', import.meta.url))).digest('hex')
}
