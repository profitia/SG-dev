// SYNTHETIC_ONLY. Real local HTTP/PostgreSQL/E1 mechanics; no provider or Neon.
import {randomUUID} from 'node:crypto'
import {calendarE1Fixture, U, V, A, B} from '../../../packages/platform-contracts/test/fixtures/calendar-current-e1-postgres.mjs'
import {fingerprint} from '@profitia/economic-calendar-contracts'
import {migrate} from '../scripts/migrate.mjs'
import {createRepository, persistAcquisition} from '../src/repository.mjs'
import {createAuthorizer} from '../src/authorization.mjs'
import {createServer} from '../src/server.mjs'
export {U, V, A, B}
export const command = {contractVersion: '1.0.0', family: 'economic-calendar', provider: 'trading-economics', operation: 'search', criteria: {countries: ['Poland'], from: '2026-01-01', to: '2026-12-31', limit: 100}}
export function sourceResponse({id = '1001', actual = '2.4%', previous = '2.3%', revised = '2.2%', forecast = '2.5%', vendorForecast = null, eventAt = '2026-01-20T13:30:00.000Z', updated = '2026-01-20T13:30:01.000Z', retrieved = '2026-11-06T00:00:00.000Z', receipt = randomUUID(), country = 'Poland'} = {}) {
  const payload = {eventId: id, eventAt, eventTimezone: eventAt ? 'UTC' : null, country, indicator: 'CPI', event: 'SYNTHETIC_ONLY CPI release', actual, previous, revised, consensusForecast: forecast, vendorForecast,
    dateSpan: 0, importance: 3, lastUpdate: updated, referencePeriod: '2026-01-01', unit: '%', currency: 'PLN', releaseStatus: actual === null ? 'UNKNOWN' : 'REPORTED', temporalPosition: 'PAST', source: 'SYNTHETIC_ONLY', sourceUrl: 'https://synthetic.example/cpi', native: {Reference: 'JAN2026', ReferenceDate: '2026-01-01', Ticker: 'SYNTHETIC_ONLY_CPI'}}
  const metadata = {contractFamily: 'economic-calendar', contractVersion: '1.0.0', providerId: 'trading-economics', apiFamily: 'economic-calendar', endpointVersion: 'calendar', vendorRecordId: id, sourceRecordRef: 'SYNTHETIC_ONLY:' + id, sourceUrl: payload.sourceUrl,
    retrievedAt: retrieved, availableAt: null, asOf: updated, licenceRef: 'SYNTHETIC_ONLY_LICENSE', qualityStatus: 'PROVIDER_REPORTED', contentFingerprint: fingerprint(payload), usageReceiptRef: receipt, retentionUntil: null, redistribution: 'PRIVATE_AUTHORISED_CONSUMER_ONLY', consumerStorage: {mode: 'DURABLE_OWNER_ENTITLEMENT', basisRef: 'SYNTHETIC_ONLY_OWNER_DECLARATION', licenceVersion: '1'}}
  return {contractVersion: '1.0.0', family: 'economic-calendar', provider: 'trading-economics', status: 'ok', items: [{metadata, payload}], page: {page: 1, pageSize: 100, more: null, total: null, truncated: false}, provenance: {retrievedAt: retrieved, licenceRef: metadata.licenceRef, qualityStatus: 'PROVIDER_REPORTED'}, usage: {receiptRef: receipt, upstreamAttempts: 1, cacheHit: false}, coverage: {scope: 'PROVIDER_RETURNED_SUBSET', completeness: 'UNKNOWN', providerReturned: 1, matchedLocally: 1, returned: 1, nativeFilters: ['countries', 'from', 'to'], localFilters: []}}
}
export async function fixture({seed = true, baseE1 = null} = {}) {
  const e1 = await calendarE1Fixture({base:baseE1,closeBase:false}); let server
  try {
    const c = e1.calendar, client = await c.migratorPool.connect()
    try {await migrate(client, c.configuration)} finally {client.release()}
    const authorizer = await createAuthorizer(c.configuration, c.runtime, {fetch: e1.transport}), repository = createRepository(c.configuration, c.runtime), logs = []
    if (seed) await persistAcquisition(c.ingest, command, sourceResponse())
    server = createServer({configuration: c.configuration, authorizer, repository, report: event => logs.push(event)})
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + server.address().port
    const api = async (path, {token = 'SYNTHETIC_A', organisation = A, method = 'GET', body, headers = {}} = {}) => {
      const response = await fetch(origin + '/v1/organisations/' + organisation + '/calendar/' + path, {method, headers: {...(token ? {authorization: 'Bearer ' + token} : {}), ...(body !== undefined ? {'content-type': 'application/json'} : {}), ...headers}, ...(body !== undefined ? {body: JSON.stringify(body)} : {})})
      return {status: response.status, body: await response.json()}
    }
    const close = async () => {await new Promise(resolve => {server.close(resolve); server.closeAllConnections()}); await e1.close()}
    return {e1, configuration: c.configuration, database: c.runtime, ingest: c.ingest, repository, authorizer, api, logs, origin, close}
  } catch (error) {if (server) {server.close(); server.closeAllConnections()} await e1.close(); throw error}
}
