import { createPublicIdentityRequestBoundary } from '@profitia/platform-contracts/public-request'
import { readSg2IdentityRuntime } from './identity-runtime'

type Environment = Readonly<Record<string, string | undefined>>
const origin = (value: string | undefined) => {
  if (!value || /[\s%\\*]/.test(value)) throw Error('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  const u = new URL(value)
  if (u.origin !== value || u.username || u.password || !(u.protocol === 'https:' || u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))) throw Error('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  return value
}
/** Deployment-selected only. This opt-in neither activates Identity nor grants
 * product access. No private database connection is used by this consumer. */
export function readSelfServiceAccountConfiguration(env: Environment = process.env) {
  const enabled = env.PROFITIA_SELF_SERVICE_ENABLED
  if (enabled === undefined || enabled === 'false') return null
  if (enabled !== 'true' || env.TARGET_ENVIRONMENT !== 'development' || env.PROFITIA_SELF_SERVICE_SATELLITE_ENABLED !== 'true') throw Error('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  const identity = readSg2IdentityRuntime(env)
  if (identity.provider !== 'clerk') throw Error('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  const publicOrigin = origin(env.PROFITIA_SELF_SERVICE_PUBLIC_ORIGIN), runtimeOrigin = origin(env.PROFITIA_IDENTITY_RUNTIME_ORIGIN)
  if (!identity.application.authorizedParties.includes(publicOrigin) || publicOrigin === runtimeOrigin) throw Error('ACCOUNT_CONFIGURATION_UNAVAILABLE')
  return Object.freeze({ publicOrigin, runtimeOrigin })
}
export function accountCompletionUrl(config: NonNullable<ReturnType<typeof readSelfServiceAccountConfiguration>>, locale: 'pl' | 'en', flow: 'registration' | 'login') {
  return `${config.runtimeOrigin}/account/sg2/account-${locale}/${flow}`
}
const headers = { 'cache-control': 'private, no-store', vary: 'Cookie, Authorization, Origin', 'content-type': 'application/json', 'x-content-type-options': 'nosniff' }
export function accountUnavailable(status = 503) { return new Response(JSON.stringify({ authenticated: false }), { status, headers }) }
async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader(); if (!reader) throw Error('ACCOUNT_UNAVAILABLE')
  const chunks: Uint8Array[] = []; let size = 0
  try { for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength
    if (size > 4096) { await reader.cancel(); throw Error('ACCOUNT_UNAVAILABLE') } chunks.push(item.value) } }
  finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
/** Existing accepted bearer-only peer READ. Never proxies browser cookies,
 * mutations, user/organisation IDs, return URLs or caller-selected endpoints. */
export async function readSelfServiceAccount(request: Request, { env = process.env, transport = fetch, now = Date.now }: {
  env?: Environment; transport?: typeof fetch; now?: () => number
} = {}): Promise<Response> {
  try {
    if (request.method !== 'GET') return accountUnavailable(405)
    const config = readSelfServiceAccountConfiguration(env)
    if (!config) return accountUnavailable()
    const normalize = createPublicIdentityRequestBoundary({ publicOrigins: [config.publicOrigin],
      internalOrigins: ['http://0.0.0.0:10000', 'https://0.0.0.0:10000', 'http://localhost:10000', 'https://localhost:10000'] })
    const current = normalize(request)
    if (!current) return accountUnavailable(403)
    const u = new URL(current.url), credential = current.headers.get('authorization')
    if (u.pathname !== '/api/account' || u.search || u.hash || current.headers.has('origin') && current.headers.get('origin') !== config.publicOrigin) return accountUnavailable(403)
    if (!/^Bearer [\x21-\x7e]{1,16384}$/i.test(credential ?? '')) return accountUnavailable(401)
    const read = (path: '/v1/account' | '/v1/account/assistant-avatar' | '/v1/account/salutation') => transport(config.runtimeOrigin + path, { method: 'GET',
      headers: { authorization: credential! }, credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(4000)]) })
    const response = await read('/v1/account')
    if (!response.ok) { await response.body?.cancel(); return accountUnavailable(response.status === 401 ? 401 : response.status === 403 ? 403 : 503) }
    const result = await boundedJson(response) as { authenticated: boolean; userId: string; expiresAt: string }
    if (!result || Object.keys(result).sort().join(',') !== 'authenticated,expiresAt,userId' || result.authenticated !== true
      || typeof result.userId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(result.userId)
      || typeof result.expiresAt !== 'string' || !(Date.parse(result.expiresAt) > now()) || request.signal.aborted) return accountUnavailable()
    const avatarResponse = await read('/v1/account/assistant-avatar')
    if (!avatarResponse.ok) { await avatarResponse.body?.cancel(); return accountUnavailable(avatarResponse.status === 401 ? 401 : avatarResponse.status === 403 ? 403 : 503) }
    const avatar = await boundedJson(avatarResponse) as { userId: string; avatarSex: 'male' | 'female' | null; version: string } | null
    if (avatar !== null && (!avatar || Array.isArray(avatar) || Object.keys(avatar).sort().join(',') !== 'avatarSex,userId,version'
      || avatar.userId !== result.userId || ![null, 'male', 'female'].includes(avatar.avatarSex)
      || typeof avatar.version !== 'string' || !/^[1-9][0-9]{0,18}$/.test(avatar.version) || BigInt(avatar.version) > 9223372036854775807n)) return accountUnavailable()
    const salutationResponse = await read('/v1/account/salutation')
    if (!salutationResponse.ok) { await salutationResponse.body?.cancel(); return accountUnavailable(salutationResponse.status === 401 ? 401 : salutationResponse.status === 403 ? 403 : 503) }
    const salutation = await boundedJson(salutationResponse) as { userId: string; firstName: string | null; vocative: string | null; dictionaryVersion: string | null; version: string } | null
    const name = (value: unknown) => value === null || typeof value === 'string' && value.length > 0 && [...value].length <= 160 && value === value.trim() && !/[\p{Cc}\p{Cf}]/u.test(value)
    if (salutation !== null && (!salutation || Array.isArray(salutation)
      || Object.keys(salutation).sort().join(',') !== 'dictionaryVersion,firstName,userId,version,vocative'
      || salutation.userId !== result.userId || !name(salutation.firstName) || !name(salutation.vocative)
      || !(salutation.dictionaryVersion === null || typeof salutation.dictionaryVersion === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(salutation.dictionaryVersion))
      || salutation.vocative !== null && (salutation.firstName === null || salutation.dictionaryVersion === null)
      || typeof salutation.version !== 'string' || !/^[1-9][0-9]{0,18}$/.test(salutation.version) || BigInt(salutation.version) > 9223372036854775807n)) return accountUnavailable()
    if (request.signal.aborted || !(Date.parse(result.expiresAt) > now())) return accountUnavailable()
    return new Response(JSON.stringify({ ...result, assistantAvatar: avatar?.avatarSex ?? null,
      salutation: salutation ? { firstName: salutation.firstName, vocative: salutation.vocative, dictionaryVersion: salutation.dictionaryVersion } : null }), { status: 200, headers })
  } catch { return accountUnavailable() }
}
