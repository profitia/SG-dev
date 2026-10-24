import { BoundaryError, type RuntimeConfiguration } from './contracts.js'
import type { AccountSurface } from './account-provisioning.js'
import type { AssistantAvatarSurface } from './assistant-avatar.js'
import type { CommunicationLanguageSurface } from './communication-language.js'
import type { RegistrationSurface } from './registration.js'

export type EmbeddedAccountSurface = { account: AccountSurface; avatar: AssistantAvatarSurface; language: CommunicationLanguageSurface; registration: RegistrationSurface }

/** Opt-in consumer origins come exclusively from the closed deployment registry.
 * Being a navigation target alone never enables browser writes. */
export function embeddedTargets(configuration: RuntimeConfiguration, input: unknown): string[] {
  if (!Array.isArray(input) || input.length > 16 || new Set(input).size !== input.length
    || input.some(id => typeof id !== 'string' || !Object.hasOwn(configuration.targets, id)
      || configuration.targets[id]!.origin === configuration.origin)) throw Error('EMBEDDED_TARGET_CONFIGURATION')
  return [...input]
}

/** Narrow, bearer-only ACCOUNT_SELF adapter. No cookie forwarding, arbitrary
 * callback, user/organisation selector, permission grant or general API proxy. */
export function createEmbeddedAccountHandler(configuration: RuntimeConfiguration, surfaces: ReadonlyMap<string, EmbeddedAccountSurface>) {
  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/v1/embedded/')) return null
    const headers: Record<string, string> = { 'content-type': 'application/json', 'cache-control': 'no-store', vary: 'Origin', 'x-content-type-options': 'nosniff' }
    const json = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers })
    try {
      const match = /^\/v1\/embedded\/([a-z][a-z0-9_-]{0,63})\/(registration\/start|registration\/verify|account)$/.exec(url.pathname)
      if (!match || url.origin !== configuration.origin || url.username || url.password || url.search || url.hash) return json(404, { error: 'NOT_FOUND' })
      const target = configuration.targets[match[1]!], surface = surfaces.get(match[1]!)
      if (!target || !surface) return json(404, { error: 'NOT_FOUND' })
      if (request.headers.get('origin') !== target.origin || request.headers.has('cookie')) return json(403, { error: 'REQUEST_ORIGIN_REJECTED' })
      headers['access-control-allow-origin'] = target.origin
      // Deliberately no Access-Control-Allow-Credentials; the SDK owns the host session.
      if (request.method === 'OPTIONS') {
        const requested = (request.headers.get('access-control-request-headers') ?? '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean)
        if (request.headers.get('access-control-request-method') !== 'POST'
          || requested.some(x => !['content-type', 'authorization', 'x-registration-receipt'].includes(x))) return json(403, { error: 'PREFLIGHT_REJECTED' })
        return new Response(null, { status: 204, headers: { ...headers, 'access-control-allow-methods': 'POST',
          'access-control-allow-headers': 'Content-Type, Authorization, X-Registration-Receipt', 'access-control-max-age': '300' } })
      }
      if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' })
      if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return json(400, { error: 'JSON_REQUIRED' })
      const raw = await request.text()
      if (Buffer.byteLength(raw) > 16_384) return json(413, { error: 'BODY_TOO_LARGE' })
      let input: unknown
      try { input = JSON.parse(raw) } catch { return json(400, { error: 'INVALID_JSON' }) }
      if (match[2]!.startsWith('registration/')) {
        if (request.headers.has('authorization') || request.headers.has('x-registration-receipt')) return json(400, { error: 'INVALID_REGISTRATION_REQUEST' })
        return json(200, await (match[2]!.endsWith('/start') ? surface.registration.start(input) : surface.registration.verify(input)))
      }
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) return json(400, { error: 'EMPTY_OBJECT_REQUIRED' })
      const bearer = request.headers.get('authorization') ?? ''
      if (!/^Bearer [A-Za-z0-9_.-]{20,16000}$/.test(bearer)) return json(401, { error: 'SESSION_REQUIRED' })
      // The consumer adapter is constructed for this server-owned origin. The
      // shared authenticator MUST verify real Clerk iss/sub/sid/azp against it.
      // No client header can select the logical receiver or an internal owner.
      const logicalHeaders = new Headers({ origin: target.origin, 'content-type': 'application/json', authorization: bearer })
      const receipt = request.headers.get('x-registration-receipt')
      if (receipt !== null) logicalHeaders.set('x-registration-receipt', receipt)
      const logicalRequest = new Request(target.origin + '/v1/account', { method: 'POST', headers: logicalHeaders, body: '{}', signal: request.signal })
      const account = await surface.account.ensure(logicalRequest)
      const read = (path: string) => new Request(target.origin + path, { headers: logicalHeaders, signal: request.signal })
      const avatar = await surface.avatar.read(read('/v1/account/assistant-avatar'))
      const language = await surface.language.read(read('/v1/account/communication-language'))
      if (!language || (avatar && avatar.userId !== account.userId) || language.userId !== account.userId) throw new BoundaryError(409, 'ACCOUNT_CHANGED')
      return json(200, { ...account, assistantAvatar: avatar?.avatarSex ?? null, communicationLanguage: language.language })
    } catch (error) { return error instanceof BoundaryError ? json(error.status, { error: error.code }) : json(503, { error: 'IDENTITY_UNAVAILABLE' }) }
  }
}
