import type pg from 'pg'
import { createIdentityProvisioner, type IdentityProvisioningOptions } from '@profitia/platform-contracts/identity-provisioning'
import { createClerkIdentityAuthenticator } from '@profitia/platform-contracts/identity-provider'
import { BoundaryError, type RuntimeConfiguration, type RuntimeSdk, type IdentityAuthority } from './contracts.js'
import { checkRequest } from './session-boundary.js'
import { readConfiguration } from './config.js'

export type AccountTransactionDiagnostic = Readonly<{
  phase: 'acquire' | 'query' | 'action' | 'commit'
  operation: string
  code: string
}>
const accountSqlStates = new Set(['PT403', 'PT409', '28P01', '28000', '42501', '42883', '42P01', '42703',
  '3D000', '3F000', '23502', '23503', '23505', '23514', '40001', '40P01', '53300', '53400', '57014',
  '57P01', '57P02', '57P03', '08000', '08001', '08003', '08004', '08006', '08007', '08P01',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'])
const accountFailureCodes = new Set(['ACCESS_BASIS_INVALID', 'POLICY_UNAVAILABLE', 'ACCOUNT_UNAVAILABLE',
  'VERIFIED_EMAIL_REQUIRED', 'REGISTRATION_FINALIZATION_REQUIRED', 'REGISTRATION_UNAVAILABLE', 'VOCATIVE_UNAVAILABLE'])
function accountFailureCode(error: unknown): string {
  // Never forward messages, SQL, parameters, provider data or arbitrary codes.
  try {
    const e = error as { code?: unknown; reasonCode?: unknown; message?: unknown } | null
    if (typeof e?.code === 'string' && accountSqlStates.has(e.code)) return e.code
    for (const value of [e?.reasonCode, e?.code, e?.message]) {
      if (typeof value === 'string' && accountFailureCodes.has(value)) return value
    }
  } catch { /* Diagnostics cannot replace the original failure. */ }
  return 'UNCLASSIFIED'
}
function accountQueryOperation(sql: string): string {
  for (const [name, operation] of [
    ['profitia_profile.runtime_descriptor(', 'profile-descriptor'],
    ['profitia_profile.binding_renewal_descriptor(', 'renewal-descriptor'],
    ['profitia_profile.binding_renewal_metadata(', 'binding-metadata'],
    ['profitia_profile.renew_binding(', 'binding-renewal'],
    ['profitia_access.runtime_descriptor(', 'access-descriptor'],
    ['profitia_access.identity_binding(', 'binding-read'],
    ['profitia_profile.provision_account(', 'account-provision'],
    ['profitia_profile.vocative_descriptor(', 'vocative-descriptor'],
    ['profitia_profile.registration_descriptor(', 'registration-descriptor'],
    ['profitia_profile.registration_command(', 'registration-command'],
    ['txid_current(', 'transaction-id'],
  ]) if (sql.includes(name!)) return operation!
  return /^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)\b/.test(sql) ? 'transaction' : 'other'
}

/** A timed-out connection is destroyed, never returned to the pool while work
 * may still be running. PostgreSQL rolls back on disconnect. No automatic retry. */
export function accountTransactions(pool: Pick<pg.Pool, 'connect'>, diagnostic?: (event: AccountTransactionDiagnostic) => void) {
  const report = (event: AccountTransactionDiagnostic) => {
    try { diagnostic?.(Object.freeze(event)) } catch { /* Preserve denial and transaction cleanup. */ }
  }
  return async function transact<T>(action: (session: { query: import('@profitia/platform-contracts/access-store').AccessQuery; transaction: pg.PoolClient }) => Promise<T>, limits: { timeoutMs: number; maxWaitMs: number }, signal?: AbortSignal): Promise<T> {
    // Provisioning allows 5s acquisition; the private profile host allows 3s.
    // Both use the same 15s transaction deadline and ordinary runtime role.
    if (limits.timeoutMs !== 15000 || ![3000, 5000].includes(limits.maxWaitMs) || signal?.aborted) throw new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')
    const connection = await new Promise<pg.PoolClient>((resolve, reject) => {
      let pending = true
      const cleanup = () => { clearTimeout(waitTimer); signal?.removeEventListener('abort', cancel) }
      const cancel = (error?: unknown) => { if (!pending) return; pending = false; cleanup();
        report({ phase: 'acquire', operation: 'connection', code: accountFailureCode(error) })
        reject(new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')) }
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
    let queryFailure: AccountTransactionDiagnostic | null = null, lastCompletedOperation = 'transaction'
    const query: import('@profitia/platform-contracts/access-store').AccessQuery = async (sql, values) => {
      if (!open) throw new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')
      let result
      try { result = await connection.query(sql, values as unknown[]) }
      catch (error) {
        queryFailure = { phase: sql === 'COMMIT' ? 'commit' : 'query', operation: accountQueryOperation(sql), code: accountFailureCode(error) }
        throw error
      }
      if (!open) throw new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')
      lastCompletedOperation = accountQueryOperation(sql)
      return result
    }
    try {
      return await Promise.race([deadline, (async () => {
        await query('BEGIN'); const result = await action({ query, transaction: connection })
        await query('COMMIT'); return result
      })()])
    } catch (error) {
      report(queryFailure ?? { phase: 'action', operation: lastCompletedOperation, code: accountFailureCode(error) })
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
  renew(request: Request): Promise<Readonly<{ authenticated: true; userId: string; expiresAt: string }>>
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
  const peers = [...new Set(Object.values(configuration.targets).map(t => t.origin))].filter(origin => origin !== configuration.origin)
  const provisionerFor = (signal?: AbortSignal, receipt: string|null = null, existingOnly = false, selectedClient: RuntimeSdk = verifiedClient) => createIdentityProvisioner({ client: selectedClient,
    identityApplication: { appId: configuration.applicationId, environment: configuration.environment, issuer: configuration.issuer, authorizedParties: existingOnly ? [configuration.origin, ...peers] : [configuration.origin],
      ...(existingOnly ? { bearerPeerRenewals: peers.map(sourceOrigin => ({ sourceOrigin, targetOrigin: configuration.origin, path: '/v1/account/renew' as const })) } : {}) },
    existingOnly,
    binding: ownBinding, schemaDigest, ...(renewalSchemaDigest === undefined ? {} : { renewalSchemaDigest }), proofKey: ownKey, now,
    transact: (action, limits) => transact(async tx => {
      const result = await action(tx)
      if (finalizeRegistration && !existingOnly) {
        const userId = (result as { userId?: string })?.userId
        if (typeof userId !== 'string') throw new BoundaryError(503, 'REGISTRATION_FINALIZATION_REQUIRED')
        await finalizeRegistration(tx.query, userId, receipt)
      }
      return result
    }, limits, signal) })
  provisionerFor() // Validate the private binding without provider/SQL calls.
  const authenticateFor = (selectedClient: RuntimeSdk) => createClerkIdentityAuthenticator({ client: selectedClient,
    application: { appId: configuration.applicationId, environment: configuration.environment, issuer: configuration.issuer,
      authorizedParties: [configuration.origin, ...peers], bearerPeerReads: peers.map(sourceOrigin => ({ sourceOrigin, targetOrigin: configuration.origin, path: '/v1/account' })) },
    resolveBinding: key => authority.resolveBinding(key), now })
  const authenticate = authenticateFor(verifiedClient)
  async function read(request: Request, verify = authenticate) {
    checkRequest(request, configuration)
    if (request.method !== 'GET') throw new BoundaryError(403, 'ACCOUNT_READ_ONLY')
    const actor = await verify(request)
    if (!actor || actor.kind !== 'HUMAN' || !actor.userId || request.signal.aborted) throw new BoundaryError(401, 'ACCOUNT_REQUIRED')
    return Object.freeze({ authenticated: true as const, userId: actor.userId, expiresAt: actor.expiresAt })
  }
  return Object.freeze({ configuration, read, async renew(request: Request) {
    checkRequest(request, configuration)
    if (!renewalSchemaDigest || request.method !== 'POST' || request.headers.has('origin') || request.headers.has('cookie')
      || !/^Bearer [\x21-\x7e]{1,16384}$/i.test(request.headers.get('authorization') ?? '')) throw new BoundaryError(403, 'ACCOUNT_RENEWAL_REFUSED')
    // Keep provider/transport failures distinct from a healthy denial. Both
    // remain fail closed; only a verified denial asks the browser to sign in.
    let providerFailed = false, identityDenied = false
    const observe = async <T>(call: () => Promise<T>) => {
      try { return await call() } catch (error) {
        if (error instanceof BoundaryError && error.status === 401) identityDenied = true
        else providerFailed = true
        throw error
      }
    }
    const observedClient: RuntimeSdk = {
      authenticateRequest: (request, options) => observe(() => verifiedClient.authenticateRequest(request, options)),
      sessions: { getSession: id => observe(() => verifiedClient.sessions.getSession(id)), revokeSession: id => verifiedClient.sessions.revokeSession(id) },
      users: { getUser: id => observe(() => verifiedClient.users.getUser(id)) },
    }
    try {
      const result = await provisionerFor(request.signal, null, true, observedClient).ensureAccount(request)
      const current = await read(new Request(configuration.origin + '/v1/account', { headers: { authorization: request.headers.get('authorization')! }, signal: request.signal }), authenticateFor(observedClient))
      if (current.userId !== result.userId) throw new BoundaryError(409, 'ACCOUNT_CHANGED')
      return current
    } catch (error) {
      if (providerFailed) throw new BoundaryError(503, 'ACCOUNT_UNAVAILABLE')
      if (identityDenied) throw new BoundaryError(401, 'ACCOUNT_REQUIRED')
      const denied = error as { name?: string; reasonCode?: string } | null
      if (denied?.name === 'OperationDenied' && denied.reasonCode === 'ACCESS_BASIS_INVALID') throw new BoundaryError(401, 'ACCOUNT_REQUIRED')
      throw error
    }
  }, async ensure(request: Request) {
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
