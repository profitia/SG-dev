import { OperationDenied } from './operation-context.mjs'
import { createHash } from 'node:crypto'

export const IDENTITY_ADAPTER_CONTRACT = Object.freeze({ id: 'profitia.identity-provider', version: '1.0.0' })
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const text = value => typeof value === 'string' && value.length > 0 && value.length <= 256
const future = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) > now
function exactOrigin(value) {
  try { const url = new URL(value); return url.origin === value && !url.hostname.includes('*') && !url.username && !url.password && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) }
  catch { return false }
}
const activeClerkUser = (user, subject) => user?.id === subject && user.banned === false && user.locked === false && user.deprovisioned === false

/** Current external ACCOUNT status for an already authorised delegation. This
 * does not authenticate a person, return an Actor, or grant membership. The
 * authoritative private store must supply the exact issuer/subject binding.
 * No session credential is accepted or retained, and no ALLOW is cached. */
export function createClerkAccountStatusReader({ client, environment, issuer, now = Date.now }) {
  if (typeof client?.users?.getUser !== 'function' || typeof now !== 'function'
    || !['development','staging','production'].includes(environment) || !exactOrigin(issuer) || !issuer.startsWith('https://')
    || environment !== 'development' && new URL(issuer).hostname.endsWith('.accounts.dev')) throw new TypeError('Explicit official account reader and environment issuer required')
  return async key => {
    if (!key || Object.getPrototypeOf(key) !== Object.prototype
      || Object.keys(key).sort().join(',') !== 'environment,issuer,subject'
      || key.environment !== environment || key.issuer !== issuer || !text(key.subject)
      || /\s|gh[pousr]_|sk_(?:live|test)_|postgres(?:ql)?:\/\//i.test(key.subject)) return null
    // Snapshot before the provider await. Mutating the caller's object cannot
    // change which identity the returned observation describes.
    const subject = key.subject, observedAt = now()
    let user
    try { user = await client.users.getUser(subject) }
    catch { throw new OperationDenied('POLICY_UNAVAILABLE') }
    const expiresAt = observedAt + 5000
    if (!activeClerkUser(user, subject) || now() >= expiresAt) return null
    return Object.freeze({ environment, issuer, subject, status:'ACTIVE',
      observedAt:new Date(observedAt).toISOString(), expiresAt:new Date(expiresAt).toISOString() })
  }
}

/** Server-owned official SDK and binding reader only. This adapter never provisions users or grants access. */
export function createClerkIdentityAuthenticator({ client, application, resolveBinding, now = Date.now }) {
  const config = structuredClone(application)
  if (!client || typeof client.authenticateRequest !== 'function' || typeof client.sessions?.getSession !== 'function' || typeof client.users?.getUser !== 'function' || typeof resolveBinding !== 'function' || typeof now !== 'function') throw new TypeError('Official SDK and authoritative identity binding reader are required')
  if (!text(config?.appId) || !['development', 'staging', 'production'].includes(config.environment) || !exactOrigin(config.issuer) || !config.issuer.startsWith('https://') || !Array.isArray(config.authorizedParties) || !config.authorizedParties.length || config.authorizedParties.some(value => !exactOrigin(value))) throw new TypeError('Explicit application, environment, issuer and exact authorized origins are required')
  if (config.environment !== 'development' && (new URL(config.issuer).hostname.endsWith('.accounts.dev') || config.authorizedParties.some(value => !value.startsWith('https://')))) throw new TypeError('Development identity configuration cannot be used for a release environment')
  Object.freeze(config.authorizedParties); Object.freeze(config)

  return async function authenticate(request) {
    if (!(request instanceof Request)) return null
    const origin = new URL(request.url).origin
    if (!config.authorizedParties.includes(origin) || (request.headers.has('origin') && request.headers.get('origin') !== origin)) return null
    // A browser cookie alone does not authorize a cross-site mutation. Bearer
    // tokens are verified by the SDK; no custom JWT or cookie protocol lives here.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !request.headers.has('origin') && !/^Bearer\s+\S+$/i.test(request.headers.get('authorization') ?? '')) return null
    let state, auth, session, user
    try {
      state = await client.authenticateRequest(request, { acceptsToken: 'session_token', authorizedParties: config.authorizedParties, clockSkewInMs: 0 })
      if (state?.status !== 'signed-in' || state.isAuthenticated !== true || typeof state.toAuth !== 'function') return null
      auth = state.toAuth()
      const claims = auth?.sessionClaims
      if (auth?.isAuthenticated !== true || auth.tokenType !== 'session_token' || !text(auth.userId) || !text(auth.sessionId) || claims?.iss !== config.issuer || claims.sub !== auth.userId || claims.sid !== auth.sessionId || !config.authorizedParties.includes(claims.azp) || claims.azp !== origin || claims.act != null || auth.actor != null || !Number.isSafeInteger(claims.exp) || claims.exp * 1000 <= now()) return null
      // JWT signature/expiry alone does not prove that a session or account is
      // still active. Do not cache these authority reads or return stale ALLOW.
      session = await client.sessions.getSession(auth.sessionId)
      if (session?.id !== auth.sessionId || session.userId !== auth.userId || session.status !== 'active' || session.actor != null || !Number.isFinite(session.expireAt) || session.expireAt <= now() || !Number.isFinite(session.abandonAt) || session.abandonAt <= now()) return null
      user = await client.users.getUser(auth.userId)
      if (!activeClerkUser(user, auth.userId)) return null
    } catch { throw new OperationDenied('POLICY_UNAVAILABLE') }

    const key = Object.freeze({ environment: config.environment, issuer: config.issuer, subject: auth.userId })
    let binding
    try { binding = await resolveBinding(key) }
    catch { throw new OperationDenied('POLICY_UNAVAILABLE') }
    const time = now()
    if (!binding || binding.environment !== key.environment || binding.issuer !== key.issuer || binding.subject !== key.subject || binding.status !== 'ACTIVE' || !uuid.test(binding.userId) || !text(binding.version) || !text(binding.sourceRef) || !future(binding.expiresAt, time)) return null
    const expiry = Math.min(auth.sessionClaims.exp * 1000, session.expireAt, session.abandonAt, Date.parse(binding.expiresAt))
    if (expiry <= time) return null
    // The audience is the server binding to this application, not a fabricated
    // JWT aud claim. SDK-verified azp + exact issuer bind its authentication proof.
    return Object.freeze({ kind: 'HUMAN', actorId: binding.userId, userId: binding.userId,
      proofRef: `clerk-session:${auth.sessionId}:binding:${binding.version}`,
      issuer: config.issuer, audience: config.appId, environment: config.environment, expiresAt: new Date(expiry).toISOString() })
  }
}

/** Separate acceptance fingerprint; changing identity code never rewrites the operation contract digest. */
export function identitySourceDigest() {
  return import('node:fs').then(fs => createHash('sha256').update(fs.readFileSync(new URL('./identity-provider.mjs', import.meta.url))).update(fs.readFileSync(new URL('./identity-provider.d.mts', import.meta.url))).digest('hex'))
}
