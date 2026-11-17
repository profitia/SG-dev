import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture, A, B, U, V, command, sourceResponse} from './fixtures.mjs'
import {createAuthorizer} from '../src/authorization.mjs'
import {createRepository, persistAcquisition} from '../src/repository.mjs'
test('Calendar Query batches the existing shared projections under one current E1 operation, with independent cursors and no private data',async()=>{
 const f=await fixture({seed:false})
 try{
  const source=sourceResponse();source.items=Array.from({length:100},(_,i)=>sourceResponse({id:'SYNTHETIC_QUERY_'+i,receipt:source.usage.receiptRef}).items[0]);source.coverage.providerReturned=100;source.coverage.matchedLocally=100;source.coverage.returned=100
  await persistAcquisition(f.ingest,command,source)
  const before=f.e1.transportState.calls,r=await f.api('query?limit=1')
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(f.e1.transportState.calls-before,2)
  assert.deepEqual(r.body.queryContract,{id:'profitia.calendar-query',version:'1.0.0'});assert.equal(r.body.events.items.length,1)
  assert(Array.isArray(r.body.publications.items));assert(Array.isArray(r.body.context.items));assert.equal('preferences'in r.body,false)
  const manyBefore=f.e1.transportState.calls,many=await f.api('query?limit=100');assert.equal(many.status,200,JSON.stringify(many.body));assert.equal(many.body.events.items.length,100);assert.equal(f.e1.transportState.calls-manyBefore,2)
  const page=await f.api('query?include=events&limit=1');assert.equal(page.status,200);assert.equal(page.body.publications,null);assert.equal(page.body.context,null)
  for(const q of ['include=preferences','include=events,events','include=events&publicationAfter=ecr_pub_'+'a'.repeat(64),'limit=501','userId='+V])assert.equal((await f.api('query?'+q)).status,400)
  f.e1.clerkState.sessionActive=false;assert.equal((await f.api('query')).status,403)
 }finally{await f.close()}
})
test('HTTP calendar read batches current E1; repeated reads/details never acquire provider data', async () => {
  const f = await fixture()
  try {
    const before = f.e1.transportState.calls
    const read = await f.api('events?country=Poland&indicator=CPI&importance=3')
    assert.equal(read.status, 200, JSON.stringify(read.body)); assert.equal(read.body.items.length, 1)
    assert.equal(f.e1.transportState.calls - before, 2)
    const item = read.body.items[0]; assert.equal(item.values.actual, '2.4%'); assert.equal(item.publishedAt, null); assert.equal(read.body.coverage.completeness, 'UNKNOWN')
    assert.equal((await f.api('events/' + item.eventId)).status, 200)
    assert.equal((await f.api('events')).status, 200)
    const ledger = await f.e1.calendar.asOwner('economic_calendar_development_owner', q => q.query('SELECT count(*) FROM economic_calendar.sync_runs'))
    assert.equal(Number(ledger.rows[0].count), 1)
    assert.equal((await f.api('events', {token: null})).status, 401)
    assert.equal((await f.api('events?userId=' + V)).status, 400)
    assert.equal((await f.api('events', {headers: {'x-user-id': V}})).status, 403)
  } finally {await f.close()}
})
test('preferences/favourites persist for canonical user across sessions, independent hosts and active organisation switches; another user is isolated', async () => {
  const f = await fixture()
  try {
    const id = (await f.api('events')).body.items[0].eventId
    const saved = {watchedCountries: ['Poland', 'United States'], watchedIndicators: ['CPI'], watchedTopics: [{kind: 'LOCAL_EVENT_TEXT_CONTAINS', text: 'oil'}], savedFilters: [{name: 'My calendar', filter: {countries: ['Poland'], importance: [3]}}], display: {timeZone: 'Europe/Warsaw', view: 'week'}}
    let r = await f.api('preferences', {method: 'PUT', body: {expectedVersion: 0, preferences: saved}})
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal((await f.api('favourites/' + id, {method: 'POST'})).status, 200)
    assert.equal((await f.api('favourites/' + id, {method: 'POST'})).body.changed, false)
    const anotherHost = await createAuthorizer(f.configuration, f.database, {fetch: f.e1.transport}), anotherRepository = createRepository(f.configuration, f.database)
    const restored = await anotherHost.execute({request: f.e1.calendar.request('SYNTHETIC_NEW_SESSION_A'), organisation: B, kind: 'preferences'}, (c, t) => anotherRepository.getPreferences(t, c))
    assert.deepEqual(restored.preferences.watchedCountries, saved.watchedCountries); assert.equal(restored.preferences.savedFilters[0].name, 'My calendar')
    const favourites = await f.api('favourites', {organisation: B}); assert.equal(favourites.body.items[0].eventId, id); assert.equal(favourites.body.eventContentIncluded, false)
    assert.deepEqual((await f.api('preferences', {token: 'SYNTHETIC_B'})).body.preferences.watchedCountries, [])
    assert.deepEqual((await f.api('favourites', {token: 'SYNTHETIC_B'})).body.items, [])
    assert.equal((await f.api('preferences', {method: 'PUT', body: {expectedVersion: 2, preferences: saved, userId: V}})).status, 400)
    assert.equal((await f.api('preferences', {method: 'PUT', body: {expectedVersion: 0, preferences: saved}})).status, 409)
    const isolated = await f.authorizer.execute({request: f.e1.calendar.request(), organisation: A, kind: 'preferences'}, async (_, t) => {
      await t.query("SELECT set_config('profitia.user_id',$1,true)", [V])
      return (await t.query('SELECT user_id FROM economic_calendar.preferences WHERE user_id=$1::uuid', [V])).rows
    }); assert.deepEqual(isolated, [])
    assert.equal((await f.api('favourites/' + id, {method:'DELETE',headers:{'if-match':'"0"'}})).status,409)
    const currentVersion=(await f.api('preferences')).body.version
    assert.equal((await f.api('favourites/' + id, {method: 'DELETE',headers:{'if-match':'"'+currentVersion+'"'}})).status, 200)
    assert.deepEqual((await f.api('favourites')).body.items, [])
  } finally {await f.close()}
})
test('current account/product/organisation revocation and unavailable authority deny protected event and private operations', async () => {
  const f = await fixture()
  try {
    await f.e1.asOwner(0, q => q.query("UPDATE profitia_access.product_grants SET features=ARRAY['personal_workspace'] WHERE application_id='spendguru' AND organisation_id=$1", [A]))
    assert.equal((await f.api('events')).status, 403)
    assert.equal((await f.api('preferences')).status, 200)
    await f.e1.asOwner(0, q => q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2", [B, U]))
    assert.equal((await f.api('preferences', {organisation: B})).status, 403)
    f.e1.clerkState.sessionActive = false
    assert.equal((await f.api('preferences')).status, 403)
    f.e1.clerkState.sessionActive = true; f.e1.transportState.offline = true
    assert.equal((await f.api('preferences')).status, 503)
    const noProof = await f.database.query('SELECT * FROM economic_calendar.preferences')
    assert.equal(noProof.rowCount, 0)
    const logs = JSON.stringify(f.logs)
    for (const secret of ['SYNTHETIC_A', 'Bearer', U, A, 'My calendar', '2.4%']) assert.equal(logs.includes(secret), false)
  } finally {await f.close()}
})
test('mid-operation revocation rolls back preference writes and post-operation audit is mandatory', async () => {
  const f = await fixture({seed: false})
  try {
    f.e1.transportState.afterInitial = () => f.e1.asOwner(0, q => q.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2", [A, U]))
    const r = await f.api('preferences', {method: 'PUT', body: {expectedVersion: 0, preferences: {watchedCountries: ['Poland']}}})
    assert.equal(r.status, 403)
    const rows = await f.e1.calendar.asOwner('economic_calendar_development_owner', q => q.query('SELECT * FROM economic_calendar.preferences'))
    assert.equal(rows.rowCount, 0)
  } finally {await f.close()}
})
