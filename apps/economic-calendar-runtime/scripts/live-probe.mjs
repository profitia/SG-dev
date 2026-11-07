import {randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'
/** Genuine Development smoke only. No test-user creation, grants, provider
 * adapter, session fabrication or credentials in output. Owner supplies two
 * real sessions of one canonical user and another entitled real user.
 */
export async function runLiveProbe(env = process.env) {
  const origin = env.ECR_PROBE_ORIGIN, org = env.ECR_PROBE_ORGANISATION_ID, expectedSha = env.ECR_PROBE_EXPECTED_SHA
  const tokens = {a: env.ECR_PROBE_TOKEN_A, next: env.ECR_PROBE_TOKEN_A_NEW_SESSION, b: env.ECR_PROBE_TOKEN_B}
  const u = new URL(origin ?? '')
  if (u.protocol !== 'https:' || u.origin !== origin || !/^[a-f0-9]{40}$/.test(expectedSha ?? '') || !/^[a-f0-9-]{36}$/.test(org ?? '') || Object.values(tokens).some(v => typeof v !== 'string' || !v.length) || env.ECR_PROBE_ALLOW_USER_WRITES !== 'true') throw Error('EXPLICIT_GENUINE_PROBE_CONFIGURATION_REQUIRED')
  // Session IDs are compared only to prevent accidentally reusing a session.
  // They confer no trust: every API request must pass real current Identity/E1.
  const session = token => {try {const id = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sid; if (typeof id === 'string' && id.length) return id} catch {} throw Error('DISTINCT_SESSION_EVIDENCE_REQUIRED')}
  if (tokens.a === tokens.next || session(tokens.a) === session(tokens.next)) throw Error('A_NEW_AUTHENTICATED_SESSION_REQUIRED')
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  async function request(path, token, {method = 'GET', body, version} = {}) {
    const response = await fetch(origin + path, {method, redirect: 'error', signal: AbortSignal.timeout(20000), headers: {...(token ? {authorization: 'Bearer ' + token} : {}), ...(body !== undefined ? {'content-type': 'application/json'} : {}), ...(version !== undefined ? {'if-match': '"' + version + '"'} : {})}, ...(body !== undefined ? {body: JSON.stringify(body)} : {})})
    let value; try {value = await response.json()} catch {throw Error('PROBE_INVALID_RESPONSE')}
    if (response.status !== 200) throw Error('PROBE_HTTP_' + response.status)
    return value
  }
  const base = '/v1/organisations/' + org + '/calendar/', health = await request('/health', null)
  if (health.sourceSha !== expectedSha || (await request('/ready', null)).ready !== true) throw Error('EXACT_SHA_READY_RUNTIME_REQUIRED')
  const a = await request(base + 'preferences', tokens.a), b = await request(base + 'preferences', tokens.b)
  const favouriteList = async token => {const items = []; let after
    do {const page = await request(base + 'favourites?limit=500' + (after ? '&after=' + after : ''), token); items.push(...page.items); after = page.nextAfter} while (after)
    return items
  }
  const before = await favouriteList(tokens.a), beforeB = await favouriteList(tokens.b), existing = new Set(before.map(x => x.eventId))
  let selected, after
  do {
    const page = await request(base + 'events?limit=500' + (after ? '&after=' + after : ''), tokens.a)
    selected = page.items.find(x => !existing.has(x.eventId)); after = page.nextAfter
  } while (!selected && after)
  if (!selected || String(selected.source?.licenceRef).includes('SYNTHETIC_ONLY')) throw Error('GENUINE_RETAINED_EVENT_NOT_ALREADY_FAVOURITED_REQUIRED')
  const name = 'ECR verification ' + randomUUID(), desired = {...a.preferences, savedFilters: [...a.preferences.savedFilters, {name, filter: {eventIds: [selected.eventId]}}]}
  let lastVersion = a.version, wrotePreferences = false, addedFavourite = false, cleanup = 'NOT_REQUIRED'
  try {
    const saved = await request(base + 'preferences', tokens.a, {method: 'PUT', body: {expectedVersion: lastVersion, preferences: desired}})
    lastVersion = saved.version; wrotePreferences = true
    const favourite = await request(base + 'favourites/' + selected.eventId, tokens.a, {method: 'POST', version: lastVersion})
    lastVersion = favourite.version; addedFavourite = favourite.changed
    const restored = await request(base + 'preferences', tokens.next), restoredFavourites = await favouriteList(tokens.next)
    if (!same(restored.preferences, saved.preferences) || !restoredFavourites.some(x => x.eventId === selected.eventId)) throw Error('CROSS_SESSION_RESTORATION_FAILED')
    const other = await request(base + 'preferences', tokens.b), otherFavourites = await favouriteList(tokens.b)
    if (other.preferences.savedFilters.some(x => x.name === name) || !same(otherFavourites, beforeB) || !same(other.preferences, b.preferences)) throw Error('OTHER_USER_ISOLATION_NOT_VERIFIED')
    const detail = await request(base + 'events/' + selected.eventId, tokens.next)
    if (detail.event.eventId !== selected.eventId || !detail.event.observation?.receiptRef) throw Error('RETAINED_EVENT_PROVENANCE_REQUIRED')
    // Required cleanup uses CAS throughout and never replaces concurrent edits.
    const removed = await request(base + 'favourites/' + selected.eventId, tokens.next, {method: 'DELETE', version: lastVersion})
    lastVersion = removed.version; addedFavourite = false
    await request(base + 'preferences', tokens.next, {method: 'PUT', body: {expectedVersion: lastVersion, preferences: a.preferences}})
    wrotePreferences = false; cleanup = 'RESTORED_BY_CAS'
    return {status: 'GENUINE_BACKEND_SMOKE_VERIFIED', sourceSha: expectedSha, canonicalUserSessions: 'TWO_DISTINCT_CURRENT_SESSIONS', preferences: 'PERSISTED_RESTORED_AND_REMOVED', crossUserIsolation: 'VERIFIED', eventProvenance: 'RETAINED_SOURCE_HUB_RECEIPT', cleanup,
      sourceHubUpstreamCounterReadback: 'REQUIRED_INDEPENDENTLY', realRevocationAndUnavailableAuthority: 'REQUIRED_INDEPENDENTLY', businessCompletion: 'NOT_ASSERTED_BY_SMOKE_ALONE'}
  } finally {
    if (addedFavourite || wrotePreferences) {
      try {
        const current = await request(base + 'preferences', tokens.next)
        if (current.version !== lastVersion) throw Error('CONCURRENT_PRIVATE_STATE_CHANGED')
        if (addedFavourite) {const removed = await request(base + 'favourites/' + selected.eventId, tokens.next, {method: 'DELETE', version: lastVersion}); lastVersion = removed.version}
        if (wrotePreferences) await request(base + 'preferences', tokens.next, {method: 'PUT', body: {expectedVersion: lastVersion, preferences: a.preferences}})
      } catch {process.stderr.write('{"error":"PROBE_CLEANUP_REQUIRES_OWNER_REVIEW_NO_OVERWRITE_PERFORMED"}\n')}
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runLiveProbe().then(value => process.stdout.write(JSON.stringify(value) + '\n')).catch(() => {process.stderr.write('{"error":"ECR_GENUINE_PROBE_FAILED"}\n'); process.exitCode = 1})
