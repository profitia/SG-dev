import { randomUUID } from 'node:crypto'
import { createClerkIdentityAuthenticator } from './identity-provider.mjs'
import { createPrivateOperationHost } from './private-operation-host.mjs'
import { OPERATION_CONTRACT, OperationDenied } from './operation-context.mjs'
import { closedObject, createProfileSql, deny, ProfileConflict } from './identity-profile-sql.mjs'
export { profileSchemaUrl, profileSchemaDigest, ProfileConflict } from './identity-profile-sql.mjs'

export const USER_PROFILE_CONTRACT = Object.freeze({ id: 'profitia.user-profile', version: '1.0.0' })
export function normalizeProfilePatch(value, phoneParser) {
  if (!closedObject(value) || Object.keys(value).length === 0 || Object.keys(value).some(k => !['avatar_sex', 'job', 'phone', 'communication_language', 'language_source'].includes(k))) throw new OperationDenied('PERMISSION_DENIED')
  if (Object.hasOwn(value, 'communication_language') !== Object.hasOwn(value, 'language_source')
    || Object.hasOwn(value, 'communication_language') && (!['pl', 'en'].includes(value.communication_language)
      || !['browser', 'user'].includes(value.language_source) || value.language_source === 'browser' && Object.keys(value).length !== 2)) throw new TypeError('Paired language and source required')
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === null) { out[key] = null; continue }
    if (typeof item !== 'string') throw new TypeError('Invalid profile field')
    if (key === 'avatar_sex') {
      if (!['male', 'female'].includes(item)) throw new TypeError('Invalid avatar preference')
      out[key] = item
    } else if (key === 'communication_language' || key === 'language_source') {
      out[key] = item
    } else if (key === 'job') {
      const normalized = item.normalize('NFC').trim()
      if ([...normalized].length > 160 || /[\p{Cc}\p{Cf}]/u.test(normalized)) throw new TypeError('Invalid job title')
      out[key] = normalized || null
    } else {
      const input = item.trim()
      if (!input) { out[key] = null; continue }
      if (input.length > 64 || !/^\+[0-9 ()\-.]+$/.test(input)) throw new TypeError('International phone required')
      let phone
      if (typeof phoneParser !== 'function') throw new TypeError('Explicit server-owned phone parser required')
      try { phone = phoneParser(input, { extract: false }) } catch { throw new TypeError('Invalid phone number') }
      if (!phone.isValid() || phone.ext || !/^\+[1-9][0-9]{1,14}$/.test(phone.number)) throw new TypeError('Invalid phone number')
      out[key] = phone.number
    }
  }
  return Object.freeze(out)
}

export function createUserProfileBackend(options) {
  return profileBackend(options, false)
}

/** Bounded account-self preference projection. Peer consumers never receive
 * job/phone and cannot use their peer session to mutate the central profile. */
export function createAssistantAvatarBackend(options) {
  const backend = profileBackend({ ...options, phoneParser: () => { throw new TypeError('Avatar-only projection') } }, true)
  const project = profile => profile === null ? null : Object.freeze({ userId: profile.user_id, avatarSex: profile.avatar_sex, version: profile.version })
  return Object.freeze({
    getAssistantAvatar: async request => project(await backend.getCurrentUserProfile(request)),
    ensureAssistantAvatar: async request => project(await backend.ensureInitialUserProfile(request)),
    async updateAssistantAvatar(request, input) {
      if (!closedObject(input) || Object.keys(input).sort().join(',') !== 'avatarSex,expectedVersion'
        || !['male', 'female'].includes(input.avatarSex)) throw new TypeError('Closed assistant avatar preference required')
      return project(await backend.updateCurrentUserProfile(request, { expectedVersion: input.expectedVersion, patch: { avatar_sex: input.avatarSex } }))
    },
  })
}

function profileBackend(options, avatarOnly) {
  const { client, identityApplication, application, binding, independentQuery, transact, schemaDigest, proofKey, phoneParser, now = Date.now } = options
  if (identityApplication?.appId !== application?.appId || identityApplication?.issuer !== application?.identityIssuer
    || identityApplication?.environment !== application?.environment || application?.organisationId !== null
    || application?.operations?.join(',') !== 'account.settings.read,account.settings.write'
    || application?.features?.join(',') !== 'account'
    || (identityApplication?.bearerPeerReads?.length && (!avatarOnly || identityApplication.bearerPeerReads.some(rule => rule.path !== '/v1/account/assistant-avatar')))
    || typeof phoneParser !== 'function') throw new TypeError('Explicit same-receiver account-self application and trusted phone parser required')
  const sql = createProfileSql({ binding, issuer: identityApplication.issuer, schemaDigest, proofKey, now })
  const queries = new WeakMap()
  const host = createPrivateOperationHost({ application, binding, independentQuery, now,
    createAuthenticator: ({ resolveBinding }) => createClerkIdentityAuthenticator({ client, application: identityApplication, resolveBinding, now }),
    transact: async (run, limits) => transact(async session => {
      if (!session?.transaction || typeof session.query !== 'function') deny()
      queries.set(session.transaction, session.query)
      try { return await run(session) } finally { queries.delete(session.transaction) }
    }, limits),
    readResources: async ({ actor, request, query }) => {
      const proof = await sql.attest(query, { operation: request.operation, principal: actor.userId, expiresAt: Date.parse(actor.expiresAt) })
      await query("SELECT set_config('profitia.profile.operation',$1,true),set_config('profitia.profile.expires_ms',$2,true),set_config('profitia.profile.signature',$3,true)", [request.operation, String(proof.until), proof.signature])
      return { resource: { id: 'current-user-profile', type: 'account_settings', dataClass: 'ACCOUNT_PRIVATE', ownerOrganisationId: null,
        ownerUserId: actor.userId, environment: binding.environment, version: 'profile-v1', projectionVersion: 'profile-v1' } }
    },
    projectOutput: value => value,
  })
  async function execute(request, kind, patch, version) {
    if (!(request instanceof Request) || (kind === 'read' ? request.method !== 'GET' : !['POST', 'PATCH'].includes(request.method))) deny()
    if (avatarOnly) {
      const url = new URL(request.url)
      if (url.pathname !== '/v1/account/assistant-avatar' || url.search || url.hash
        || (kind !== 'read' && request.headers.get('origin') !== url.origin)) deny()
    }
    const operation = kind === 'read' ? 'account.settings.read' : 'account.settings.write'
    // PII remains in this immutable closure. The canonical audit sees only a
    // random change reference, field names and expected version, never a phone
    // number or its unsalted digest (which could permit dictionary recovery).
    const payload = { changeId: randomUUID(), fields: patch ? Object.keys(patch) : [], expectedVersion: version ?? null }
    let conflict = false
    let result
    try { result = await host.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
      operation, resourceId: 'current-user-profile', organisationId: null, request, payload }, async (_context, transaction) => {
      const query = queries.get(transaction)
      const statement = kind === 'read' ? 'SELECT profitia_profile.read_current() AS profile'
        : kind === 'ensure' ? 'SELECT profitia_profile.ensure_current() AS profile'
          : 'SELECT profitia_profile.update_current($1::bigint,$2::jsonb) AS profile'
      try {
        const row = await sql.queryOne(query, statement, kind === 'update' ? [version, JSON.stringify(patch)] : [])
        return row.profile
      } catch (error) { if (error instanceof ProfileConflict) conflict = true; throw error }
    }) } catch (error) { if (conflict && error?.reasonCode === 'POLICY_UNAVAILABLE') throw new ProfileConflict(); throw error }
    return result.value
  }
  return Object.freeze({ contract: USER_PROFILE_CONTRACT,
    getCurrentUserProfile: request => execute(request, 'read'),
    ensureInitialUserProfile: request => execute(request, 'ensure'),
    updateCurrentUserProfile(request, input) {
      if (!closedObject(input) || Object.keys(input).sort().join(',') !== 'expectedVersion,patch'
        || typeof input.expectedVersion !== 'string' || !/^[1-9][0-9]{0,18}$/.test(input.expectedVersion)
        || BigInt(input.expectedVersion) > 9223372036854775807n) throw new TypeError('Explicit expected version and closed profile patch required')
      const patch = normalizeProfilePatch(input.patch, phoneParser)
      return execute(request, 'update', patch, input.expectedVersion)
    },
  })
}
