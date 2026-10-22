import { randomBytes, createHash } from 'node:crypto'
import { BoundaryError, type FlowRecord, type FlowStore } from './contracts.js'
/** Atomic within ONE process only. Restart loses pending navigation, never creates a session. */
export function createFlowStore({ maximum = 4096, now = Date.now }: { maximum?: number; now?: () => number } = {}): FlowStore {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 4096) throw new TypeError('Bounded flow capacity required')
  const flows = new Map<string, FlowRecord>(), denied = new Map<string, number>(), digest = (s: string) => createHash('sha256').update(s).digest('hex')
  function prune() { for (const [k,v] of flows) if (v.expiresAt <= now()) flows.delete(k); for (const [k,v] of denied) if (v <= now()) denied.delete(k) }
  return Object.freeze({ mode: 'single-process' as const,
    issue(record: FlowRecord) { prune(); if (flows.size >= maximum || record.expiresAt <= now() || record.expiresAt > now() + 60_000) throw new BoundaryError(429, 'FLOW_CAPACITY_OR_EXPIRY')
      const state = randomBytes(32).toString('base64url'); flows.set(digest(state), Object.freeze(structuredClone(record))); return state },
    take(state: string) { prune(); if (!/^[A-Za-z0-9_-]{43}$/.test(state)) return null; const k = digest(state), record = flows.get(k); flows.delete(k); return record ?? null },
    denySession(key: string, expiresAt: number) { prune(); if (denied.size >= maximum && !denied.has(digest(key))) throw new BoundaryError(503, 'REVOCATION_CAPACITY'); denied.set(digest(key), expiresAt) },
    sessionDenied(key: string) { prune(); return denied.has(digest(key)) },
    clearPrincipal(userId: string) { for (const [k,r] of flows) if (r.userId === userId) flows.delete(k) },
  })
}
