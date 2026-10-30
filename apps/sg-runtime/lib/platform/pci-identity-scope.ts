import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'

type Scope = { authorization: string | null; signal: AbortSignal; active: boolean; verifiedTokens: Map<string, Promise<unknown>> }
const scopes = new AsyncLocalStorage<Scope>()

/** One incoming PCI request only. Never stores an Actor, access decision, current session/user or E1 context. */
export async function withinPciIdentityScope<T>(request: Request, work: () => Promise<T>): Promise<T> {
  const scope: Scope = { authorization: request.headers.get('authorization'), signal: request.signal, active: true, verifiedTokens: new Map() }
  return scopes.run(scope, async () => {
    try { return await work() }
    finally { scope.active = false; scope.verifiedTokens.clear() }
  })
}

/** Reuse only official SDK token verification. Its caller still performs fresh
 * sessions.getSession, users.getUser, binding, E1 and outcome checks on EVERY operation. */
export function reusePciTokenVerification<T>(request: Request, options: unknown, verify: () => Promise<T>): Promise<T> {
  const scope = scopes.getStore()
  if (!scope?.active || scope.signal.aborted || request.signal.aborted || !scope.authorization
    || request.headers.get('authorization') !== scope.authorization) return verify()
  let key: string
  try {
    key = createHash('sha256').update(JSON.stringify({ method: request.method, origin: new URL(request.url).origin,
      authorization: request.headers.get('authorization'), cookie: request.headers.get('cookie'),
      browserOrigin: request.headers.get('origin'), host: request.headers.get('host'), options })).digest('hex')
  } catch { return verify() }
  const existing = scope.verifiedTokens.get(key)
  if (existing) return existing as Promise<T>
  const result = Promise.resolve().then(verify)
  scope.verifiedTokens.set(key, result)
  void result.catch(() => { if (scope.verifiedTokens.get(key) === result) scope.verifiedTokens.delete(key) })
  return result
}

export function withPciTokenReuse<T extends { authenticateRequest: (...args: any[]) => any }>(client: T): T {
  return new Proxy(client, { get(target, property, receiver) {
    if (property !== 'authenticateRequest') return Reflect.get(target, property, receiver)
    return (request: Request, options: unknown) => reusePciTokenVerification(request, options, () => target.authenticateRequest(request, options))
  } })
}
