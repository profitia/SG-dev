import { closed } from './config.js'
import { BoundaryError, type FlowKind, type RuntimeConfiguration } from './contracts.js'
export function resolveReturnRoute(config: RuntimeConfiguration, input: unknown): { targetId: string; routeKey: string; kind: FlowKind; targetOrigin: string; returnTo: string } {
  if (!closed(input) || Object.keys(input).sort().join(',') !== 'flow,routeKey,targetId' || typeof input.targetId !== 'string'
    || typeof input.routeKey !== 'string' || !['registration','login','recovery'].includes(String(input.flow))) throw new BoundaryError(400, 'INVALID_NAVIGATION_INTENT')
  if (!Object.hasOwn(config.targets, input.targetId)) throw new BoundaryError(400, 'UNKNOWN_TARGET')
  const target = config.targets[input.targetId]!
  if (!Object.hasOwn(target.routes, input.routeKey)) throw new BoundaryError(400, 'UNKNOWN_ROUTE')
  return { targetId: input.targetId, routeKey: input.routeKey, kind: input.flow as FlowKind, targetOrigin: target.origin, returnTo: target.origin + target.routes[input.routeKey]! }
}
