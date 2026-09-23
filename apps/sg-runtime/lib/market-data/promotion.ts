import { createHash } from 'node:crypto'

export type PromotionEnvironment = 'development' | 'staging' | 'production'

export type PromotionRoute = {
  from: PromotionEnvironment
  to: PromotionEnvironment
  reconciliation: boolean
}

const FORWARD_ROUTES = new Set(['development:staging', 'staging:production'])

export function assertPromotionRoute(route: PromotionRoute) {
  const key = `${route.from}:${route.to}`
  if (FORWARD_ROUTES.has(key) && !route.reconciliation) return
  if (key === 'staging:development' && route.reconciliation) return
  throw new Error(`Unlawful SG2 data-promotion route: ${key}; reconciliation=${route.reconciliation}`)
}

export function assertPromotionEndpoint(url: string, expectedHost: string, label: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`${label} database URL is invalid.`)
  }
  const pooledHost = expectedHost.replace(/^([^.]+)(\..+)$/, '$1-pooler$2')
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !parsed.hostname.endsWith('.neon.tech')
    || (parsed.hostname !== expectedHost && parsed.hostname !== pooledHost)
    || parsed.pathname !== '/neondb'
    || !['require', 'verify-ca', 'verify-full'].includes(parsed.searchParams.get('sslmode') ?? '')) {
    throw new Error(`${label} database endpoint does not match the approved Neon host and database.`)
  }
  return parsed.hostname
}

export function assertNeonBranchEndpoint(branchId: string, endpoints: unknown, label: string) {
  if (!Array.isArray(endpoints)) throw new Error(`${label} Neon endpoint inventory is invalid.`)
  const endpoint = endpoints.find((item) => item && typeof item === 'object'
    && (item as Record<string, unknown>).branch_id === branchId
    && (item as Record<string, unknown>).type === 'read_write') as Record<string, unknown> | undefined
  if (!endpoint || typeof endpoint.host !== 'string' || !endpoint.host.endsWith('.neon.tech')) {
    throw new Error(`${label} has no verified read-write Neon endpoint for branch ${branchId}.`)
  }
  return endpoint.host
}

function canonicalize(value: unknown, ignoredKeys: ReadonlySet<string>): unknown {
  if (value === null || value === undefined) return value ?? null
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, ignoredKeys))
  if (typeof value === 'object') {
    const serializable = value as { toJSON?: () => unknown }
    if (typeof serializable.toJSON === 'function') return canonicalize(serializable.toJSON(), ignoredKeys)
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !ignoredKeys.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry, ignoredKeys)]))
  }
  return value
}

export function semanticDigest(value: unknown, ignoredKeys: readonly string[] = []) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value, new Set(ignoredKeys)))).digest('hex')
}

export function assertSameSemanticRecord(source: unknown, destination: unknown, label: string, ignoredKeys: readonly string[] = ['createdAt', 'updatedAt']) {
  if (semanticDigest(source, ignoredKeys) !== semanticDigest(destination, ignoredKeys)) {
    throw new Error(`${label} conflicts with an existing destination row; promotion is fail-closed.`)
  }
}

export function exactKey(row: Record<string, unknown>, columns: readonly string[]) {
  return JSON.stringify(columns.map((column) => canonicalize(row[column], new Set())))
}
