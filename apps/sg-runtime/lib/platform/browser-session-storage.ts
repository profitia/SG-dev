export type BrowserPersistencePolicy = 'legacy' | 'volatile'
export type BrowserSessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** This adapter grants no data access. Only the explicit legacy host may use
 * its historical unscoped keys. Unknown/individual context does not even resolve
 * the storage object, and never deletes another context's existing history. */
export function selectLegacySessionStorage(policy: unknown, resolve: () => BrowserSessionStorage | null): BrowserSessionStorage | null {
  if (policy !== 'legacy') return null
  try { return resolve() } catch { return null }
}
