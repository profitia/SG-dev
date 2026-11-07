import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {calendarStorageProjection} from '../src/repository.mjs'
import {consumerFixture} from './first-party-fixtures.mjs'
import {A} from '../../../packages/platform-contracts/test/fixtures/first-party-source-postgres.mjs'
test('durable calendar projection is explicit, separate from cache TTL, and unavailable to other API families', () => {
  const base = {version: '2', retention_seconds: 0, consumer_access_mode: 'SPENDGURU_PRODUCT'}
  assert.equal(calendarStorageProjection(base, 'economic-calendar'), null)
  const licensed = {...base, consumer_storage_mode: 'DURABLE_OWNER_ENTITLEMENT', consumer_storage_basis_ref: 'SYNTHETIC_ONLY'}
  assert.deepEqual(calendarStorageProjection(licensed, 'economic-calendar'), {mode: 'DURABLE_OWNER_ENTITLEMENT', basisRef: 'SYNTHETIC_ONLY', licenceVersion: '2'})
  assert.equal(calendarStorageProjection(licensed, 'news-discovery'), null)
  assert.throws(() => calendarStorageProjection({...licensed, consumer_storage_basis_ref: null}, 'economic-calendar'))
})
test('actual Hub/E1/Source SQL flow emits durable rights only after explicit licence-owner CAS; runtime cannot activate them', async () => {
  const f = await consumerFixture()
  try {
    const {e1} = f, sql = fs.readFileSync(new URL('../migrations/005-calendar-storage-rights.sql', import.meta.url), 'utf8')
    await e1.asOwner(1, q => q.query(sql), 'source_hub_development_owner')
    const before = await e1.asOwner(1, q => q.query("SELECT provider_id,family,version,retention_seconds,consumer_storage_mode FROM source_hub.provider_licences ORDER BY provider_id,family"), 'source_hub_development_owner')
    assert(before.rows.every(r => r.consumer_storage_mode === 'TRANSIENT_ONLY'))
    await assert.rejects(e1.pools[1].query("SELECT source_hub.set_calendar_storage_rights(1,'DURABLE_OWNER_ENTITLEMENT','SYNTHETIC_ONLY')"), e => e.code === '42501')
    const row = before.rows.find(r => r.family === 'economic-calendar')
    await e1.asOwner(1, q => q.query("SELECT source_hub.set_calendar_storage_rights($1,'DURABLE_OWNER_ENTITLEMENT','SYNTHETIC_ONLY')", [row.version]), 'source_hub_development_owner')
    await assert.rejects(e1.asOwner(1, q => q.query("SELECT source_hub.set_calendar_storage_rights($1,'TRANSIENT_ONLY',NULL)", [row.version]), 'source_hub_development_owner'), /expected version changed/)
    const client = await f.client(), command = {contractVersion: '1.0.0', provider: 'trading-economics', family: 'economic-calendar', operation: 'search', criteria: {countries: ['Poland'], indicators: ['Inflation Rate']}}
    const result = await client.acquire({command, execution: {kind: 'SERVICE', organisationId: A, grantId: e1.grantId}, idempotencyKey: 'SYNTHETIC_ONLY_calendar_durable'})
    assert.equal(result.items[0].metadata.retentionUntil, null)
    assert.equal(result.items[0].metadata.consumerStorage.mode, 'DURABLE_OWNER_ENTITLEMENT')
    assert.equal(result.items[0].metadata.consumerStorage.licenceVersion, String(Number(row.version) + 1))
    const after = await e1.asOwner(1, q => q.query('SELECT provider_id,family,version,retention_seconds,consumer_storage_mode FROM source_hub.provider_licences ORDER BY provider_id,family'), 'source_hub_development_owner')
    assert.deepEqual(after.rows.filter(r => r.family !== 'economic-calendar'), before.rows.filter(r => r.family !== 'economic-calendar'))
    assert.equal(after.rows.find(r => r.family === 'economic-calendar').retention_seconds, 0)
    const retained = await e1.asOwner(1, q => q.query('SELECT count(*) FROM source_hub.first_party_records'), 'source_hub_development_owner')
    assert.equal(Number(retained.rows[0].count), 0)
  } finally {await f.close()}
})
