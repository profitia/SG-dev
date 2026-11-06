import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {fixture, command, sourceResponse} from './fixtures.mjs'
import {persistAcquisition} from '../src/repository.mjs'
import {migrate} from '../scripts/migrate.mjs'
import fs from 'node:fs'
import {generateKeyPairSync} from 'node:crypto'
import {consumerFixture} from '../../platform-source-hub/test/first-party-fixtures.mjs'
import {createSynchronizer} from '../src/synchronization.mjs'
test('concurrent receipt replay, unchanged refresh, observed actual/revision changes and stale snapshots preserve one stable release', async () => {
  const f = await fixture({seed: false})
  try {
    const response = sourceResponse(), results = await Promise.all([persistAcquisition(f.ingest, command, response), persistAcquisition(f.ingest, command, structuredClone(response))])
    assert.equal(results.filter(r => r.replay).length, 1)
    assert.equal(results.filter(r => r.created === 1).length, 2)
    const first = (await f.api('events')).body.items[0], id = first.eventId
    await f.api('favourites/' + id, {method: 'POST'})
    await new Promise(resolve => setTimeout(resolve, 10)); const cutoff = new Date().toISOString()
    await new Promise(resolve => setTimeout(resolve, 10))
    const changed = sourceResponse({actual: 0, previous: '2.2%', revised: '2.1%', updated: '2026-01-21T00:00:00.000Z'})
    assert.equal((await persistAcquisition(f.ingest, command, changed)).changed, 1)
    assert.equal((await persistAcquisition(f.ingest, command, sourceResponse({actual: 0, previous: '2.2%', revised: '2.1%', updated: '2026-01-21T00:00:00.000Z', retrieved: '2026-11-06T01:00:00.000Z'}))).unchanged, 1)
    assert.equal((await persistAcquisition(f.ingest, command, sourceResponse({actual: 99, updated: '2026-01-19T00:00:00.000Z'}))).stale, 1)
    const current = await f.api('events/' + id)
    assert.equal(current.status, 200); assert.equal(current.body.event.values.actual, 0); assert.equal(current.body.event.eventId, id)
    const historical = await f.api('events/' + id + '?asKnownAt=' + encodeURIComponent(cutoff))
    assert.equal(historical.status, 200); assert.equal(historical.body.event.values.actual, '2.4%')
    assert.equal((await f.api('events/' + id + '?asKnownAt=2020-01-01T00%3A00%3A00Z')).status, 404)
    const history = await f.api('events/' + id + '/revisions')
    assert.equal(history.body.items.length, 3); assert.deepEqual(history.body.items[1].changeKinds, ['ACTUAL_CHANGED', 'PREVIOUS_REVISED'])
    assert.equal(history.body.items[2].adoptedAsCurrent, false); assert.deepEqual(history.body.items[2].changeKinds, ['STALE_SOURCE_OBSERVATION'])
    assert.equal((await f.api('favourites')).body.items[0].eventId, id)
    const rows = await f.e1.calendar.asOwner('economic_calendar_development_owner', q => q.query('SELECT (SELECT count(*) FROM economic_calendar.events) AS events,(SELECT count(*) FROM economic_calendar.sync_runs) AS syncs'))
    assert.equal(Number(rows.rows[0].events), 1); assert.equal(Number(rows.rows[0].syncs), 4)
  } finally {await f.close()}
})
test('conflicting duplicate or altered same-receipt content is refused; distinct provider IDs create distinct releases', async () => {
  const f = await fixture({seed: false})
  try {
    const a = sourceResponse(), b = sourceResponse({actual: '10%'})
    const conflict = structuredClone(a); conflict.items.push(b.items[0]); conflict.items[1].metadata.usageReceiptRef = a.usage.receiptRef
    await assert.rejects(persistAcquisition(f.ingest, command, conflict), e => e.code === 'CONFLICTING_SOURCE_DUPLICATE')
    await persistAcquisition(f.ingest, command, a)
    const altered = sourceResponse({receipt: a.usage.receiptRef, actual: '10%'})
    await assert.rejects(persistAcquisition(f.ingest, command, altered), e => e.code === 'ACQUISITION_RECEIPT_CONFLICT')
    await persistAcquisition(f.ingest, command, sourceResponse({id: '1002'}))
    assert.equal((await f.api('events')).body.items.length, 2)
  } finally {await f.close()}
})
test('SQL failure after event writes rolls back the entire acquisition; ingestion login cannot read private preferences', async () => {
  const f = await fixture({seed: false})
  try {
    await f.e1.calendar.asOwner('economic_calendar_development_owner', async q => {
      await q.query("CREATE FUNCTION economic_calendar.synthetic_reject_sync() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_ONLY_SQL_FAILURE'; END $$")
      await q.query('CREATE TRIGGER synthetic_reject BEFORE INSERT ON economic_calendar.sync_runs FOR EACH ROW EXECUTE FUNCTION economic_calendar.synthetic_reject_sync()')
    })
    await assert.rejects(persistAcquisition(f.ingest, command, sourceResponse()))
    const rows = await f.e1.calendar.asOwner('economic_calendar_development_owner', q => q.query('SELECT (SELECT count(*) FROM economic_calendar.events) AS events,(SELECT count(*) FROM economic_calendar.observations) AS observations,(SELECT count(*) FROM economic_calendar.sync_runs) AS syncs'))
    assert.deepEqual(Object.values(rows.rows[0]).map(Number), [0, 0, 0])
    await assert.rejects(f.ingest.query('SELECT * FROM economic_calendar.preferences'), e => e.code === '42501')
    assert.equal((await f.database.query('SELECT * FROM economic_calendar.events')).rowCount, 0)
  } finally {await f.close()}
})
test('migration verifies idempotently and refuses digest/binding drift; installed storage disable denies reads', async () => {
  const f = await fixture()
  try {
    const client = await f.e1.calendar.migratorPool.connect()
    try {assert.equal((await migrate(client, f.configuration)).status, 'INSTALLED_OR_VERIFIED')} finally {client.release()}
    assert.equal(await f.repository.ready(), true)
    await f.e1.calendar.asOwner('economic_calendar_development_owner', q => q.query("UPDATE economic_calendar.installation SET status='DISABLED'"))
    assert.equal(await f.repository.ready(), false)
    assert.equal((await f.api('events')).status,503)
    await f.e1.calendar.asOwner('economic_calendar_development_owner', q => q.query('UPDATE economic_calendar.installation SET schema_digest=$1', ['0'.repeat(64)]))
    const connection = await f.e1.calendar.migratorPool.connect()
    try {await assert.rejects(migrate(connection, f.configuration), /EXISTING_PRODUCT_SCHEMA_MISMATCH/)} finally {connection.release()}
  } finally {await f.close()}
})
test('SYNTHETIC_ONLY full SourceHub -> durable ECR -> current-authorized API with independent component/service identity and no upstream reads', async () => {
  const hub = await consumerFixture(); let f
  try {
    f = await fixture({seed: false, baseE1: hub.e1})
    const app = f.configuration.applicationId, role = 'economic_calendar_development_ingest', serviceId = randomUUID(), grantId = randomUUID(), key = generateKeyPairSync('ed25519'), componentId = 'SYNTHETIC_ONLY_ECR_COMPONENT', sourceOrigin = 'urn:profitia:service:synthetic-calendar:development'
    await hub.e1.asOwner(0, async q => {
      await q.query("INSERT INTO profitia_access.runtime_bindings(login_role,application_id,status) VALUES($1,$2,'ACTIVE')", [role, app])
      await q.query("INSERT INTO profitia_services.runtime_bindings(login_role,binding_id,service_id,profile_id,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,$2,$3,'SPENDGURU_SAAS','SYNTHETIC_ONLY','synthetic-calendar-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [role, randomUUID(), serviceId])
      await q.query("INSERT INTO profitia_services.read_grants(grant_id,login_role,organisation_id,operation,feature,resource_id,effect,status,source_ref,expires_at) VALUES($1,$2,$3,'knowledge.read','market','api.trading-economics.economic-calendar','ALLOW','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [grantId, role, '11111111-1111-4111-8111-111111111111'])
      await q.query("INSERT INTO profitia_e1_authority.source_components(component_id,key_id,application_id,login_role,receiver_application_id,source_origin,public_key,deployment_id,configuration_version,status,source_ref,expires_at) VALUES($1,'SYNTHETIC_ONLY_KEY',$2,$3,$4,$5,$6,'SYNTHETIC_ONLY','synthetic-calendar-v1','ACTIVE','SYNTHETIC_ONLY',now()+interval '1 hour')", [componentId, app, role, hub.e1.apps[1], sourceOrigin, key.publicKey.export({type: 'spki', format: 'pem'})])
    })
    const sql = fs.readFileSync(new URL('../../platform-source-hub/migrations/005-calendar-storage-rights.sql', import.meta.url), 'utf8')
    await hub.e1.asOwner(1, q => q.query(sql), 'source_hub_development_owner')
    const sync = createSynchronizer({configuration: {...f.configuration, runtimeRole: role}, database: f.ingest,
      sourceConfiguration: {environment: 'development', componentId, consumerApplicationId: app, receiverApplicationId: hub.e1.apps[1], sourceOrigin, targetOrigin: hub.e1.targetOrigin, keyId: 'SYNTHETIC_ONLY_KEY', privateKey: key.privateKey}, fetchImpl: request => hub.app.handle(request)})
    const args = {criteria: {countries: ['Poland'], indicators: ['Inflation Rate']}, organisation: '11111111-1111-4111-8111-111111111111', grantId, idempotencyKey: 'SYNTHETIC_ONLY_ECR_TRANSIENT_0001'}
    await assert.rejects(sync.synchronize(args), e => e.code === 'DURABLE_STORAGE_NOT_ADMITTED')
    assert.equal((await f.api('events')).body.items.length, 0)
    await hub.e1.asOwner(1, async q => {
      const {rows: [r]} = await q.query("SELECT version FROM source_hub.provider_licences WHERE provider_id='trading-economics' AND family='economic-calendar'")
      await q.query("SELECT source_hub.set_calendar_storage_rights($1,'DURABLE_OWNER_ENTITLEMENT','SYNTHETIC_ONLY_OWNER_BUSINESS_RIGHTS')", [r.version])
    }, 'source_hub_development_owner')
    const accepted = {...args, idempotencyKey: 'SYNTHETIC_ONLY_ECR_DURABLE_0002'}
    const result = await sync.synchronize(accepted); assert.equal(result.created, 1)
    const upstream = hub.source.state.providerCalls.length
    assert.equal((await sync.synchronize(accepted)).replay, true); assert.equal(hub.source.state.providerCalls.length, upstream)
    const read = await f.api('events'); assert.equal(read.status, 200); assert.equal(read.body.items.length, 1)
    const id = read.body.items[0].eventId
    assert.equal((await f.api('favourites/' + id, {method: 'POST'})).status, 200)
    assert.equal((await f.api('events/' + id)).status, 200); assert.equal(hub.source.state.providerCalls.length, upstream)
    const ledger = await hub.e1.asOwner(1, q => q.query('SELECT component_id,actor_id,consumer_application_id FROM source_hub.first_party_acquisitions'), 'source_hub_development_owner')
    assert(ledger.rows.every(r => r.component_id === componentId && r.actor_id === serviceId && r.consumer_application_id === app))
    await hub.e1.asOwner(0, q => q.query("UPDATE profitia_services.read_grants SET status='REVOKED' WHERE grant_id=$1", [grantId]))
    await assert.rejects(sync.synchronize({...accepted, idempotencyKey: 'SYNTHETIC_ONLY_ECR_REVOKED_0003'}))
    assert.equal(hub.source.state.providerCalls.length, upstream)
    assert.equal((await f.api('events/' + id)).status, 200)
  } finally {if (f) await f.close(); await hub.close()}
})
