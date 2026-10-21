import { createAccessStore } from './access-store.mjs'
import { createClerkIdentityAuthenticator } from './identity-provider.mjs'
import { createProfileSql, deny, unavailable } from './identity-profile-sql.mjs'

export const IDENTITY_PROVISIONING_CONTRACT = Object.freeze({ id: 'profitia.identity-provisioning', version: '1.0.0' })

/** Uses the EXISTING authenticator. Its binding callback is reached only after
 * official SDK/session/user checks. A real transaction cannot commit before the
 * authenticator's final proof/binding/expiry checks have also succeeded. */
export function createIdentityProvisioner({ client, identityApplication, binding, schemaDigest, proofKey, transact, now = Date.now }) {
  if (typeof transact !== 'function' || identityApplication?.appId !== binding?.applicationId || identityApplication?.environment !== binding?.environment
    || identityApplication?.bearerPeerReads?.length) throw new TypeError('Explicit same-receiver identity application, existing store and real transaction required')
  const application = structuredClone(identityApplication)
  const store = createAccessStore({ binding, now })
  const sql = createProfileSql({ binding, issuer: application.issuer, schemaDigest, proofKey, now })
  // Validate configuration now without running provider calls or provisioning.
  createClerkIdentityAuthenticator({ client, application, resolveBinding: async () => null, now })
  return Object.freeze({ contract: IDENTITY_PROVISIONING_CONTRACT,
    async ensureAccount(request) {
      if (!(request instanceof Request) || request.method !== 'POST') deny()
      let entered = false, finished = false, ownedResult
      try {
        const result = await transact(async ({ query }) => {
          if (entered || typeof query !== 'function') unavailable()
          entered = true
          await query("SET LOCAL statement_timeout='15000ms'")
          await query("SET LOCAL lock_timeout='5000ms'")
          await query("SET LOCAL idle_in_transaction_session_timeout='15000ms'")
          // Per-call observations; never cached, returned, or accepted from HTTP.
          let tokenUntil, sessionUntil
          const observedClient = {
            authenticateRequest: (...args) => client.authenticateRequest(...args),
            sessions: { getSession: async id => {
              const session = await client.sessions.getSession(id)
              sessionUntil = Math.min(session?.expireAt, session?.abandonAt)
              return session
            } },
            users: { getUser: id => client.users.getUser(id) },
          }
          observedClient.authenticateRequest = async (...args) => {
            const state = await client.authenticateRequest(...args)
            // Preserve the SDK receiver and the exact existing verifier checks.
            return state && { status: state.status, isAuthenticated: state.isAuthenticated,
              toAuth: () => { const auth = state.toAuth(); tokenUntil = auth?.sessionClaims?.exp * 1000; return auth } }
          }
          const authenticate = createClerkIdentityAuthenticator({ client: observedClient, application, now,
            resolveBinding: async identity => {
              const identityUntil = Math.min(tokenUntil, sessionUntil)
              if (!Number.isSafeInteger(identityUntil) || identityUntil <= now()) deny()
              const proof = await sql.attest(query, { operation: 'identity.provision', principal: identity.subject, issuer: identity.issuer, identityUntil, expiresAt: identityUntil })
              await sql.queryOne(query, 'SELECT profitia_profile.provision_account($1,$2,$3::bigint,$4::bigint,$5) AS user_id', [identity.issuer, identity.subject, identityUntil, proof.until, proof.signature])
              return store.resolveBinding(query, identity)
            },
          })
          const actor = await authenticate(request)
          if (!actor || !(Date.parse(actor.expiresAt) > now())) deny()
          finished = true
          ownedResult = Object.freeze({ userId: actor.userId })
          return ownedResult
        }, { timeoutMs: 15000, maxWaitMs: 5000 })
        if (!entered || !finished || result !== ownedResult || !/^[0-9a-f-]{36}$/i.test(result?.userId ?? '')) unavailable()
        return result
      } catch (error) {
        if (error?.name === 'OperationDenied') throw error
        unavailable()
      }
    },
  })
}
