import { randomUUID } from 'node:crypto'
import { createClerkIdentityAuthenticator } from '@profitia/platform-contracts/identity-provider'
import { createAccessStore, type AccessStoreBinding, type AccessQuery } from '@profitia/platform-contracts/access-store'
import { BoundaryError, type RuntimeConfiguration, type RuntimeSdk, type IdentityAuthority, type HumanActor, type SessionDecision, type SessionBoundary, type FlowStore } from './contracts.js'
import { closed } from './config.js'
import { createFlowStore } from './flow-store.js'
import { resolveReturnRoute } from './return-routes.js'
export function createDatabaseAuthority(binding: AccessStoreBinding, query: AccessQuery, issuer: string): IdentityAuthority {
  const store = createAccessStore({ binding })
  return Object.freeze({ resolveBinding: key => store.resolveBinding(query, key),
    async ready() { try { await store.resolveBinding(query, { environment: binding.environment, issuer, subject: '__b2_readiness_probe__' }); return true } catch { return false } } })
}
export function checkRequest(request: Request, configuration: RuntimeConfiguration, mutation = false): void {
  const u = new URL(request.url), origin = request.headers.get('origin'), site = request.headers.get('sec-fetch-site')
  if (u.origin !== configuration.origin || u.username || u.password || u.hash || u.search || origin !== null && origin !== configuration.origin
    || site === 'cross-site' || site === 'same-site' || mutation && (request.method !== 'POST' || origin !== configuration.origin)) throw new BoundaryError(403, 'REQUEST_ORIGIN_REJECTED')
  if (mutation && request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new BoundaryError(400, 'JSON_REQUIRED')
}
const sessionKey = (actor: HumanActor) => actor.issuer + ':' + actor.proofRef.split(':binding:')[0]
export function createSessionBoundary({ configuration, client, authority, now = Date.now, flowStore }: {
  configuration: RuntimeConfiguration; client: RuntimeSdk; authority: IdentityAuthority; now?: () => number; flowStore?: FlowStore
}): SessionBoundary {
  const store = flowStore ?? createFlowStore({ maximum: configuration.maxPendingFlows, now })
  const authenticate = createClerkIdentityAuthenticator({ client, application: { appId: configuration.applicationId, environment: configuration.environment,
    issuer: configuration.issuer, authorizedParties: [configuration.origin] }, resolveBinding: key => authority.resolveBinding(key), now })
  async function session(request: Request): Promise<SessionDecision> {
    checkRequest(request, configuration)
    try { const actor = await authenticate(request)
      if (!actor || actor.kind !== 'HUMAN' || typeof actor.userId !== 'string' || actor.userId !== actor.actorId || actor.audience !== configuration.applicationId
        || actor.environment !== configuration.environment || actor.issuer !== configuration.issuer || Date.parse(actor.expiresAt) <= now() || request.signal.aborted) return Object.freeze({ status: 'unauthenticated' })
      const human = actor as HumanActor
      return store.sessionDenied(sessionKey(human)) ? Object.freeze({ status: 'unauthenticated' }) : Object.freeze({ status: 'authenticated', actor: human })
    } catch { return Object.freeze({ status: 'unavailable' }) }
  }
  async function requireSession(request: Request): Promise<HumanActor> { const s = await session(request); if (s.status !== 'authenticated') throw new BoundaryError(s.status === 'unavailable' ? 503 : 401, s.status === 'unavailable' ? 'IDENTITY_UNAVAILABLE' : 'SESSION_REQUIRED'); return s.actor }
  return Object.freeze({ configuration, session,
    async ready() { try { return await authority.ready() === true } catch { return false } },
    async beginFlow(request: Request, input: unknown) {
      checkRequest(request, configuration, true); const route = resolveReturnRoute(configuration, input), actor = await requireSession(request)
      const expiresAt = Math.min(now() + configuration.stateTtlMs, Date.parse(actor.expiresAt))
      const state = store.issue({ ...route, flowId: randomUUID(), receivingOrigin: configuration.origin, environment: configuration.environment, userId: actor.userId, proofRef: actor.proofRef, expiresAt })
      return { state, expiresAt: new Date(expiresAt).toISOString() }
    },
    async consumeFlow(request: Request, input: unknown) {
      checkRequest(request, configuration, true)
      if (!closed(input) || Object.keys(input).join(',') !== 'state' || typeof input.state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.state)) throw new BoundaryError(400, 'INVALID_FLOW_STATE')
      const state = input.state, actor = await requireSession(request), record = store.take(state)
      if (!record || record.expiresAt <= now() || record.userId !== actor.userId || record.proofRef !== actor.proofRef || record.environment !== configuration.environment
        || record.receivingOrigin !== configuration.origin) throw new BoundaryError(409, 'FLOW_STATE_UNAVAILABLE')
      const route = resolveReturnRoute(configuration, { targetId: record.targetId, routeKey: record.routeKey, flow: record.kind })
      if (route.returnTo !== record.returnTo || route.targetOrigin !== record.targetOrigin) throw new BoundaryError(409, 'FLOW_DESTINATION_CHANGED')
      const current = await requireSession(request)
      if (current.userId !== actor.userId || current.proofRef !== actor.proofRef || record.expiresAt <= now()) throw new BoundaryError(409, 'SESSION_CHANGED')
      return route.returnTo
    },
    async logout(request: Request) {
      checkRequest(request, configuration, true); const actor = await requireSession(request)
      store.clearPrincipal(actor.userId); store.denySession(sessionKey(actor), Date.parse(actor.expiresAt))
      const match = /^clerk-session:(sess_[A-Za-z0-9_-]+):binding:.+$/.exec(actor.proofRef)
      if (!match?.[1]) throw new BoundaryError(503, 'SESSION_REFERENCE_UNAVAILABLE')
      try { await client.sessions.revokeSession(match[1]); const current = await client.sessions.getSession(match[1]); if (current.id !== match[1] || current.status !== 'revoked') throw Error('REVOCATION_UNCONFIRMED') }
      catch { throw new BoundaryError(503, 'PROVIDER_REVOCATION_UNAVAILABLE') }
    },
  })
}
