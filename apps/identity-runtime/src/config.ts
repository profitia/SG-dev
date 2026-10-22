import { BoundaryError, type RuntimeConfiguration, type Target } from './contracts.js'
export function closed(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
    && Reflect.ownKeys(value).length === Object.keys(value).length
    && Object.values(Object.getOwnPropertyDescriptors(value)).every(d => 'value' in d && d.enumerable)
}
export function exactOrigin(value: unknown): value is string {
  if (typeof value !== 'string' || /[\s%\\*\u0000-\u001f\u007f]/u.test(value)) return false
  try { const u = new URL(value); return u.origin === value && !u.username && !u.password
    && (u.protocol === 'https:' || u.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname)) } catch { return false }
}
export function routePath(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 && /^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(value)
}
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[a-z][a-z0-9_-]{0,63}$/.test(v)
export function readConfiguration(input: unknown): RuntimeConfiguration {
  const fail = (): never => { throw new BoundaryError(503, 'CONFIGURATION_UNAVAILABLE') }
  if (!closed(input) || Object.keys(input).some(k => !['applicationId','environment','origin','issuer','publishableKey','targets','stateTtlMs','maxPendingFlows'].includes(k))) fail()
  if (!identifier(input.applicationId) || input.environment !== 'development' || !exactOrigin(input.origin)
    || !exactOrigin(input.issuer) || !input.issuer.startsWith('https:') || typeof input.publishableKey !== 'string' || !/^pk_test_[A-Za-z0-9_-]+$/.test(input.publishableKey)) fail()
  if (Buffer.from(input.publishableKey.slice(8), 'base64url').toString('utf8') !== new URL(input.issuer).host + '$') fail()
  if (!closed(input.targets) || !Object.keys(input.targets).length || Object.keys(input.targets).length > 16) fail()
  const targetEntries: [string, Target][] = [], apps = new Set<string>()
  for (const [id, t] of Object.entries(input.targets)) {
    if (!identifier(id) || !closed(t) || Object.keys(t).sort().join(',') !== 'applicationId,origin,routes'
      || !identifier(t.applicationId) || apps.has(t.applicationId) || t.applicationId === input.applicationId || !exactOrigin(t.origin)
      || !closed(t.routes) || !Object.keys(t.routes).length || Object.keys(t.routes).length > 32) fail()
    for (const [key, path] of Object.entries(t.routes)) if (!identifier(key) || !routePath(path)) fail()
    apps.add(t.applicationId)
    targetEntries.push([id, Object.freeze({ applicationId: t.applicationId, origin: t.origin, routes: Object.freeze({ ...t.routes } as Record<string, string>) })])
  }
  const ttl = input.stateTtlMs ?? 60_000, maximum = input.maxPendingFlows ?? 4096
  if (!Number.isInteger(ttl) || Number(ttl) < 1000 || Number(ttl) > 60_000 || !Number.isInteger(maximum) || Number(maximum) < 1 || Number(maximum) > 4096) fail()
  return Object.freeze({ applicationId: input.applicationId, environment: 'development', origin: input.origin, issuer: input.issuer,
    publishableKey: input.publishableKey, targets: Object.freeze(Object.fromEntries(targetEntries)), stateTtlMs: Number(ttl), maxPendingFlows: Number(maximum) })
}
