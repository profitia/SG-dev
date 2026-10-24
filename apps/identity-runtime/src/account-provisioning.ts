import type pg from 'pg'
import { createIdentityProvisioner, type IdentityProvisioningOptions } from '@profitia/platform-contracts/identity-provisioning'
import { createClerkIdentityAuthenticator } from '@profitia/platform-contracts/identity-provider'
import { BoundaryError, type RuntimeConfiguration, type RuntimeSdk, type IdentityAuthority } from './contracts.js'
import { checkRequest } from './session-boundary.js'
import { readConfiguration } from './config.js'

/** A timed-out connection is destroyed, never returned to the pool while work
 * may still be running. PostgreSQL rolls back on disconnect. No automatic retry. */
export function accountTransactions(pool: Pick<pg.Pool, 'connect'>) {
  return async function transact<T>(action: (session: { query: import('@profitia/platform-contracts/access-store').AccessQuery; transaction: pg.PoolClient }) => Promise<T>, limits: { timeoutMs: number; maxWaitMs: number }, signal?: AbortSignal): Promise<T> {
    // Provisioning allows 5s acquisition; the private profile host allows 3s.
    // Both use the same 15s transaction deadline and ordinary runtime role.
    if (limits.timeoutMs !== 15000 || ![3000, 5000].includes(limits.maxWaitMs) || signal?.aborted) throw new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')
    const connection = await new Promise<pg.PoolClient>((resolve, reject) => {
      let pending = true
      const cleanup = () => { clearTimeout(waitTimer); signal?.removeEventListener('abort', cancel) }
      const cancel = () => { if (!pending) return; pending = false; cleanup(); reject(new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')) }
      const waitTimer = setTimeout(cancel, limits.maxWaitMs)
      signal?.addEventListener('abort', cancel, { once: true })
      if (signal?.aborted) { cancel(); return }
      void pool.connect().then(client => {
        // pg acquisition cannot be cancelled; destroy a late connection so
        // timed-out or aborted work can never begin on a pooled connection.
        if (!pending) { client.release(true); return }
        pending = false; cleanup(); resolve(client)
      }, cancel)
    })
    let open = true, released = false, timer: ReturnType<typeof setTimeout>, abort: () => void = () => {}
    const deadline = new Promise<never>((_resolve, reject) => {
      abort = () => { if (!open) return; open = false; released = true; connection.release(true); reject(new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')) }
      timer = setTimeout(abort, limits.timeoutMs); signal?.addEventListener('abort', abort, { once: true })
      if (signal?.aborted) abort()
    })
    const query: import('@profitia/platform-contracts/access-store').AccessQuery = async (sql, values) => {
      if (!open) throw new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')
      const result = await connection.query(sql, values as unknown[])
      if (!open) throw new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')
      return result
    }
    try {
      return await Promise.race([deadline, (async () => {
        await query('BEGIN'); const result = await action({ query, transaction: connection })
        await query('COMMIT'); return result
      })()])
    } catch (error) {
      if (open) { try { await connection.query('ROLLBACK') } catch { released = true; connection.release(true) } }
      throw error
    } finally {
      clearTimeout(timer!); signal?.removeEventListener('abort', abort); open = false
      if (!released) connection.release()
    }
  }
}

/** The existing authenticator still owns all identity/session checks. This
 * projection additionally requires a currently verified PRIMARY email. */
export function verifiedEmailClient(client: RuntimeSdk): RuntimeSdk {
  return { authenticateRequest: (request, options) => client.authenticateRequest(request, options),
    sessions: { getSession: id => client.sessions.getSession(id), revokeSession: id => client.sessions.revokeSession(id) },
    users: { async getUser(id) {
      const user = await client.users.getUser(id)
      const email = user as typeof user & { primaryEmailAddressId?: string; emailAddresses?: { id: string; verification?: { status?: string } }[] }
      if (!email.primaryEmailAddressId || !Array.isArray(email.emailAddresses)
        || !email.emailAddresses.some(e => e.id === email.primaryEmailAddressId && e.verification?.status === 'verified')) throw new BoundaryError(401, 'VERIFIED_EMAIL_REQUIRED')
      return user
    } } }
}

export interface AccountSurface {
  readonly configuration: RuntimeConfiguration
  ensure(request: Request): Promise<Readonly<{ authenticated: true; userId: string; expiresAt: string }>>
  read(request: Request): Promise<Readonly<{ authenticated: true; userId: string; expiresAt: string }>>
}
export function createAccountSurface({ configuration: inputConfiguration, client, authority, binding, schemaDigest, renewalSchemaDigest, proofKey, transact, finalizeRegistration, now = Date.now }: {
  configuration: RuntimeConfiguration; client: RuntimeSdk; authority: IdentityAuthority
  binding: IdentityProvisioningOptions<pg.PoolClient>['binding']; schemaDigest: string; renewalSchemaDigest?: string; proofKey: Uint8Array
  finalizeRegistration?: (query: import('./registration-store.js').RegistrationQuery, userId: string, token: string|null) => Promise<void>
  transact: ReturnType<typeof accountTransactions>; now?: () => number
}): AccountSurface {
  if (!(proofKey instanceof Uint8Array) || proofKey.byteLength !== 32) throw new BoundaryError(503, 'PROFILE_CONFIGURATION_REQUIRED')
  const configuration = readConfiguration(inputConfiguration), ownBinding = structuredClone(binding), ownKey = Buffer.from(proofKey)
  const verifiedClient = verifiedEmailClient(client)
  const provisionerFor = (signal?: AbortSignal, receipt: string|null = null) => createIdentityProvisioner({ client: verifiedClient,
    identityApplication: { appId: configuration.applicationId, environment: configuration.environment, issuer: configuration.issuer, authorizedParties: [configuration.origin] },
    binding: ownBinding, schemaDigest, ...(renewalSchemaDigest === undefined ? {} : { renewalSchemaDigest }), proofKey: ownKey, now,
    transact: (action, limits) => transact(async tx => {
      const result = await action(tx)
      if (finalizeRegistration) {
        const userId = (result as { userId?: string })?.userId
        if (typeof userId !== 'string') throw new BoundaryError(503, 'REGISTRATION_FINALIZATION_REQUIRED')
        await finalizeRegistration(tx.query, userId, receipt)
      }
      return result
    }, limits, signal) })
  provisionerFor() // Validate the private binding without provider/SQL calls.
  const peers = [...new Set(Object.values(configuration.targets).map(t => t.origin))].filter(origin => origin !== configuration.origin)
  const authenticate = createClerkIdentityAuthenticator({ client: verifiedClient,
    application: { appId: configuration.applicationId, environment: configuration.environment, issuer: configuration.issuer,
      authorizedParties: [configuration.origin, ...peers], bearerPeerReads: peers.map(sourceOrigin => ({ sourceOrigin, targetOrigin: configuration.origin, path: '/v1/account' })) },
    resolveBinding: key => authority.resolveBinding(key), now })
  async function read(request: Request) {
    checkRequest(request, configuration)
    if (request.method !== 'GET') throw new BoundaryError(403, 'ACCOUNT_READ_ONLY')
    const actor = await authenticate(request)
    if (!actor || actor.kind !== 'HUMAN' || !actor.userId || request.signal.aborted) throw new BoundaryError(401, 'ACCOUNT_REQUIRED')
    return Object.freeze({ authenticated: true as const, userId: actor.userId, expiresAt: actor.expiresAt })
  }
  return Object.freeze({ configuration, read, async ensure(request: Request) {
    checkRequest(request, configuration, true)
    // Provisioning is ONLY same-origin. Peer GET admission never permits POST.
    const receipt = request.headers.get('x-registration-receipt')
    if (receipt !== null && !/^[A-Za-z0-9_-]{43}$/.test(receipt)) throw new BoundaryError(400, 'INVALID_REGISTRATION')
    const provisioner = provisionerFor(request.signal, receipt)
    const result = await provisioner.ensureAccount(request)
    const current = await read(new Request(configuration.origin + '/v1/account', { headers: request.headers, signal: request.signal }))
    if (current.userId !== result.userId) throw new BoundaryError(409, 'ACCOUNT_CHANGED')
    return current
  } })
}
