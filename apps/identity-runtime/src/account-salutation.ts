import { createHmac, randomUUID } from 'node:crypto'
import type pg from 'pg'
import { createPrivateOperationHost } from '@profitia/platform-contracts/private-operation-host'
import { createClerkIdentityAuthenticator } from '@profitia/platform-contracts/identity-provider'
import { OPERATION_CONTRACT } from '@profitia/platform-contracts/operation-context'
import type { AccessQuery } from '@profitia/platform-contracts/access-store'
import { BoundaryError } from './contracts.js'
import { readConfiguration } from './config.js'
import { checkRequest } from './session-boundary.js'
import { verifiedEmailClient } from './account-provisioning.js'
import type { createAssistantAvatarSurface } from './assistant-avatar.js'

export type AccountSalutation = Readonly<{ userId: string; firstName: string | null; vocative: string | null; dictionaryVersion: string | null; version: string }>
export interface AccountSalutationSurface { read(request: Request): Promise<AccountSalutation | null> }

/** Only the persisted ACCOUNT_PRIVATE salutation, never Clerk metadata or a new
 * name inflector. This projection cannot mutate a profile or grant membership. */
export function projectAccountSalutation(value: unknown): AccountSalutation | null {
  if (value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BoundaryError(503, 'SALUTATION_UNAVAILABLE')
  const p = value as Record<string, unknown>
  const name = (v: unknown) => v === null || typeof v === 'string' && v.length > 0 && [...v].length <= 160 && v === v.trim() && !/[\p{Cc}\p{Cf}]/u.test(v)
  if (typeof p.user_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(p.user_id)
    || typeof p.version !== 'string' || !/^[1-9][0-9]{0,18}$/.test(p.version) || BigInt(p.version) > 9223372036854775807n
    || !name(p.first_name) || !name(p.name_vocative)
    || !(p.name_dictionary_version === null || typeof p.name_dictionary_version === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(p.name_dictionary_version))
    || p.name_vocative !== null && (p.first_name === null || p.name_dictionary_version === null)) throw new BoundaryError(503, 'SALUTATION_UNAVAILABLE')
  return Object.freeze({ userId: p.user_id, firstName: p.first_name as string | null, vocative: p.name_vocative as string | null,
    dictionaryVersion: p.name_dictionary_version as string | null, version: p.version })
}

export function createAccountSalutationSurface(options: Parameters<typeof createAssistantAvatarSurface>[0]): AccountSalutationSurface {
  const config = readConfiguration(options.configuration), binding = structuredClone(options.binding), proofKey = Buffer.from(options.proofKey), now = options.now ?? Date.now
  if (proofKey.length !== 32) throw new BoundaryError(503, 'SALUTATION_UNAVAILABLE')
  const peer = config.targets.sg2
  const peers = peer && peer.origin !== config.origin ? [peer.origin] : []
  return Object.freeze({ async read(request: Request) {
    const url = new URL(request.url)
    checkRequest(request, config)
    if (request.method !== 'GET' || url.pathname !== '/v1/account/salutation' || url.search || url.hash) throw new BoundaryError(403, 'SALUTATION_READ_ONLY')
    const queries = new WeakMap<pg.PoolClient, AccessQuery>()
    const host = createPrivateOperationHost<pg.PoolClient>({ binding, now, independentQuery: options.independentQuery,
      application: { appId: config.applicationId, profileId: 'SPENDGURU_SAAS', environment: config.environment,
        deploymentId: options.deploymentId, configurationVersion: options.configurationVersion, identityIssuer: config.issuer,
        organisationId: null, features: ['account'], operations: ['account.settings.read'] },
      createAuthenticator: ({ resolveBinding }) => createClerkIdentityAuthenticator({ client: verifiedEmailClient(options.client), resolveBinding, now,
        application: { appId: config.applicationId, environment: config.environment, issuer: config.issuer,
          authorizedParties: [config.origin, ...peers], bearerPeerReads: peers.map(sourceOrigin => ({ sourceOrigin, targetOrigin: config.origin, path: '/v1/account/salutation' })) } }),
      transact: (run, limits) => options.transact(async session => {
        queries.set(session.transaction, session.query)
        try { return await run(session) } finally { queries.delete(session.transaction) }
      }, limits, request.signal),
      readResources: async ({ actor, request: bound, query }) => {
        const d = (await query('SELECT profitia_profile.runtime_descriptor() AS descriptor')).rows[0]?.descriptor as Record<string, unknown> | undefined
        if (!d || d.enabled !== true || d.issuer !== config.issuer || d.profileSchemaDigest !== options.schemaDigest
          || ['applicationId', 'environment', 'projectId', 'branchId', 'databaseName', 'role', 'schemaDigest'].some(k => d[k] !== binding[k as keyof typeof binding])) throw new BoundaryError(503, 'SALUTATION_UNAVAILABLE')
        const tx = (await query('SELECT txid_current()::text AS tx')).rows[0]?.tx
        if (actor.kind !== 'HUMAN' || !actor.userId || typeof tx !== 'string') throw new BoundaryError(403, 'PROFILE_ACCESS_DENIED')
        // Existing transaction-bound profile attestation protocol, shared with
        // the owned communication-language surface. No new SQL or grants.
        const until = Math.min(now() + 5000, Date.parse(actor.expiresAt)), parts = [binding.environment, binding.applicationId, binding.role, bound.operation, tx, actor.userId, '', String(until), '0']
        if (!/^[1-9][0-9]*$/.test(tx) || !Number.isSafeInteger(until) || until <= now() || parts.some(v => typeof v !== 'string' || /[\u0000-\u001f\u007f]/u.test(v))) throw new BoundaryError(403, 'PROFILE_ACCESS_DENIED')
        const signature = createHmac('sha256', proofKey).update(parts.join('\u001f')).digest('hex')
        await query("SELECT set_config('profitia.profile.operation',$1,true),set_config('profitia.profile.expires_ms',$2,true),set_config('profitia.profile.signature',$3,true)", [bound.operation, String(until), signature])
        return { resource: { id: 'current-user-profile', type: 'account_settings', dataClass: 'ACCOUNT_PRIVATE', ownerOrganisationId: null,
          ownerUserId: actor.userId, environment: binding.environment, version: 'profile-v1', projectionVersion: 'profile-v1' } }
      }, projectOutput: value => value,
    })
    try {
      const result = await host.execute({ contractId: OPERATION_CONTRACT.id, contractVersion: OPERATION_CONTRACT.version,
        operation: 'account.settings.read', resourceId: 'current-user-profile', organisationId: null, request,
        payload: { changeId: randomUUID(), fields: [], expectedVersion: null } }, async (_context, transaction) => {
        const row = await queries.get(transaction)!('SELECT profitia_profile.read_current() AS profile')
        if (row.rows.length !== 1) throw new BoundaryError(503, 'SALUTATION_UNAVAILABLE')
        return projectAccountSalutation(row.rows[0]!.profile)
      })
      return result.value as AccountSalutation | null
    } catch (error) {
      if (error instanceof BoundaryError) throw error
      const reason = (error as { reasonCode?: string })?.reasonCode
      if (reason === 'UNVERIFIED_IDENTITY') throw new BoundaryError(401, 'ACCOUNT_REQUIRED')
      if (reason && reason !== 'POLICY_UNAVAILABLE') throw new BoundaryError(403, 'PROFILE_ACCESS_DENIED')
      throw new BoundaryError(503, 'SALUTATION_UNAVAILABLE')
    }
  } })
}
