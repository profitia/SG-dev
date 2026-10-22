import { exactOrigin } from './config.js'
import { BoundaryError } from './contracts.js'

/** Deployment-owned public origin; request and forwarded headers never select it. */
export function readDeploymentOrigin(input: unknown, localFallback: string): string {
  const origin = input === undefined ? localFallback : input
  if (!exactOrigin(origin)) throw new BoundaryError(503, 'CONFIGURATION_UNAVAILABLE')
  return origin
}
