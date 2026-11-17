import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {supplierLocationFixture} from './fixtures/supplier-location-postgres.mjs'

const sql=fs.readFileSync(new URL('../migrations/access/023-current-work-audit-index.sql',import.meta.url),'utf8')
const index='native_work_current_transaction_idx'
const probe="SELECT EXISTS(SELECT 1 FROM profitia_access.security_events WHERE application_id='p1-app-0' AND environment='development' AND phase='INTENT' AND event->'requestWork'->>'transactionId'='-1') AS present"
const nodes=p=>[p,...(p.Plans??[]).flatMap(nodes)]

const auditSnapshot=async f=>({
  functions:(await f.admin.query("SELECT oid,proowner,proacl,prosecdef,proconfig,prosrc FROM pg_proc WHERE pronamespace IN(SELECT oid FROM pg_namespace WHERE nspname LIKE 'profitia_%') ORDER BY oid")).rows,
  tables:(await f.admin.query("SELECT oid,relowner,relacl,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relkind='r' AND relnamespace IN(SELECT oid FROM pg_namespace WHERE nspname LIKE 'profitia_%') ORDER BY oid")).rows,
  policies:(await f.admin.query("SELECT * FROM pg_policies WHERE schemaname LIKE 'profitia_%' ORDER BY schemaname,tablename,policyname")).rows,
  members:(await f.admin.query('SELECT * FROM pg_auth_members ORDER BY roleid,member,grantor')).rows,
  receipt:(await f.admin.query('SELECT * FROM profitia_access.installation')).rows,
  rows:(await f.admin.query("SELECT count(*)::int n,md5(string_agg(event_id::text||event::text,',' ORDER BY event_id)) digest FROM profitia_access.security_events")).rows,
 })

test('one physical audit index accelerates the unchanged query without authority changes',async t=>{
 const f=await supplierLocationFixture(),snapshot=()=>auditSnapshot(f)
 let beforePlan,afterPlan
 try{
  // Synthetic historical rows only in disposable PostgreSQL16. They contain
  // no authority evidence and never enter a provider or deployed database.
  await f.controlled(c=>c.query("INSERT INTO profitia_access.security_events(application_id,environment,decision_id,phase,event) SELECT 'p1-app-0','development',gen_random_uuid(),'INTENT',jsonb_build_object('syntheticHistory',n,'padding',repeat('fixture',80)) FROM generate_series(1,5000) n"))
  await f.controlled(c=>c.query('ANALYZE profitia_access.security_events'))
  const before=await snapshot()
  const explain=async()=>f.controlled(async c=>(await c.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+probe)).rows[0]['QUERY PLAN'][0])
  beforePlan=await explain()
  await t.test('operator and ordinary runtime cannot install or gain audit-table access',async()=>{
   await assert.rejects(f.admin.query(sql),e=>e.code==='42501')
   await assert.rejects(f.pools[0].query(sql),e=>e.code==='42501')
   await assert.rejects(f.pools[0].query('SELECT * FROM profitia_access.security_events'),e=>e.code==='42501')
   assert.equal((await f.admin.query("SELECT to_regclass('profitia_access.'||$1) value",[index])).rows[0].value,null)
  })
  await t.test('transaction rollback removes only the new physical index',async()=>{
   await f.controlled(async c=>{await c.query('SAVEPOINT optional_index');await c.query(sql);await c.query('ROLLBACK TO SAVEPOINT optional_index')})
   assert.equal((await f.admin.query("SELECT to_regclass('profitia_access.'||$1) value",[index])).rows[0].value,null)
   assert.deepEqual(await snapshot(),before)
  })
  await t.test('accepted index is idempotent and every old authority byte and row stays unchanged',async()=>{
   await f.controlled(c=>c.query(sql));await f.controlled(c=>c.query(sql))
   assert.deepEqual(await snapshot(),before)
   assert.equal((await f.controlled(c=>c.query(probe))).rows[0].present,false)
   afterPlan=await explain()
   assert(nodes(afterPlan.Plan).some(n=>n['Index Name']===index),'actual unchanged lookup must use the new index')
   assert(afterPlan.Plan['Shared Hit Blocks']<beforePlan.Plan['Shared Hit Blocks'],'fewer audited pages, without a flaky wall-clock threshold')
   await assert.rejects(f.pools[0].query('SELECT * FROM profitia_access.security_events'),e=>e.code==='42501')
   t.diagnostic(JSON.stringify({syntheticRows:5000,beforeMs:beforePlan['Execution Time'],afterMs:afterPlan['Execution Time'],beforeBuffers:beforePlan.Plan['Shared Hit Blocks'],afterBuffers:afterPlan.Plan['Shared Hit Blocks']}))
  })
  await t.test('a same-name conflicting object fails closed without replacing it',async()=>{
   await f.controlled(async c=>{
    await c.query('SAVEPOINT conflicting_index');await c.query('DROP INDEX profitia_access.'+index)
    await c.query('CREATE INDEX '+index+' ON profitia_access.security_events(environment)')
    await c.query('SAVEPOINT rejected_install')
    await assert.rejects(c.query(sql),e=>e.code==='42501');await c.query('ROLLBACK TO SAVEPOINT rejected_install')
    assert.match((await c.query("SELECT pg_get_indexdef(to_regclass('profitia_access.'||$1)) definition",[index])).rows[0].definition,/USING btree \(environment\)$/)
    await c.query('ROLLBACK TO SAVEPOINT conflicting_index')
   })
   assert.deepEqual(await snapshot(),before)
  })
  await t.test('actual protected E1 user effect and membership revocation retain their original decisions',async()=>{
   await f.policy('supplier.location.write');await f.grant('supplier.location.write')
   assert.equal((await f.execute(f.host(),f.input())).decision,'ALLOW')
   await f.controlled(c=>c.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U]))
   await assert.rejects(f.execute(f.host(),f.input()))
  })
 }finally{await f.close()}
})

const phaseSql=fs.readFileSync(new URL('../migrations/access/033-native-phase-audit-indexes.sql',import.meta.url),'utf8')
const phaseIndexes=['native_inspection_transaction_idx','native_continuation_transaction_idx']
const phaseProbe="SELECT EXISTS(SELECT 1 FROM profitia_access.security_events s WHERE s.phase='INTENT' AND (s.event->'requestInspection'->>'transactionId'=txid_current()::text OR s.event->'requestContinuation'->>'transactionId'=txid_current()::text)) AS present"

test('native audit mixing checks use both global transaction indexes with unchanged authority and decisions',async t=>{
 const f=await supplierLocationFixture(),snapshot=()=>auditSnapshot(f)
 const installed=async()=>(await f.admin.query('SELECT count(*)::int n FROM pg_indexes WHERE schemaname=$1 AND indexname=ANY($2)',['profitia_access',phaseIndexes])).rows[0].n
 const explain=async()=>f.controlled(async c=>(await c.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+phaseProbe)).rows[0]['QUERY PLAN'][0])
 try{
  await f.controlled(c=>c.query("INSERT INTO profitia_access.security_events(application_id,environment,decision_id,phase,event) SELECT 'p1-app-'||(n%2),'development',gen_random_uuid(),'INTENT',jsonb_build_object('syntheticHistory',n,'padding',repeat('fixture',80)) FROM generate_series(1,5000) n"))
  await f.controlled(c=>c.query('ANALYZE profitia_access.security_events'))
  const before=await snapshot(),beforePlan=await explain()
  await t.test('ordinary and administrative logins cannot install the optimization',async()=>{
   await assert.rejects(f.admin.query(phaseSql),e=>e.code==='42501')
   await assert.rejects(f.pools[0].query(phaseSql),e=>e.code==='42501')
   assert.equal(await installed(),0)
  })
  await t.test('interruption rolls back both indexes without changing existing audit evidence',async()=>{
   await f.controlled(async c=>{await c.query('SAVEPOINT phase_indexes');await c.query(phaseSql);await c.query('ROLLBACK TO SAVEPOINT phase_indexes')})
   assert.equal(await installed(),0);assert.deepEqual(await snapshot(),before)
  })
  await t.test('idempotent physical installation accelerates the exact unscoped OR query',async()=>{
   await f.controlled(c=>c.query(phaseSql));await f.controlled(c=>c.query(phaseSql))
   assert.equal(await installed(),2);assert.deepEqual(await snapshot(),before)
   assert.equal((await f.controlled(c=>c.query(phaseProbe))).rows[0].present,false)
   const afterPlan=await explain(),used=nodes(afterPlan.Plan).map(n=>n['Index Name'])
   for(const name of phaseIndexes)assert(used.includes(name),'unchanged mixing query must use '+name)
   assert(afterPlan.Plan['Shared Hit Blocks']<beforePlan.Plan['Shared Hit Blocks'])
   t.diagnostic(JSON.stringify({syntheticRows:5000,beforeMs:beforePlan['Execution Time'],afterMs:afterPlan['Execution Time'],beforeBuffers:beforePlan.Plan['Shared Hit Blocks'],afterBuffers:afterPlan.Plan['Shared Hit Blocks']}))
  })
  await t.test('either phase in another application still blocks mixing in the current transaction',async()=>{
   for(const field of ['requestInspection','requestContinuation'])await f.controlled(async c=>{
    await c.query('SAVEPOINT current_phase')
    await c.query("INSERT INTO profitia_access.security_events(application_id,environment,decision_id,phase,event) VALUES('p1-app-1','development',gen_random_uuid(),'INTENT',jsonb_build_object($1::text,jsonb_build_object('transactionId',txid_current()::text)))",[field])
    assert.equal((await c.query(phaseProbe)).rows[0].present,true)
    await c.query('ROLLBACK TO SAVEPOINT current_phase')
   })
   assert.deepEqual(await snapshot(),before)
  })
  await t.test('conflicting index definitions are preserved and refused before any installation',async()=>{
   for(const name of phaseIndexes)await f.controlled(async c=>{
    await c.query('SAVEPOINT conflict');await c.query('DROP INDEX profitia_access.'+name)
    await c.query('CREATE INDEX '+name+' ON profitia_access.security_events(environment)')
    await c.query('SAVEPOINT rejected_install');await assert.rejects(c.query(phaseSql),e=>e.code==='42501');await c.query('ROLLBACK TO SAVEPOINT rejected_install')
    assert.match((await c.query('SELECT pg_get_indexdef(to_regclass($1)) definition',['profitia_access.'+name])).rows[0].definition,/USING btree \(environment\)$/)
    await c.query('ROLLBACK TO SAVEPOINT conflict')
   })
   assert.deepEqual(await snapshot(),before)
   await assert.rejects(f.pools[0].query('SELECT * FROM profitia_access.security_events'),e=>e.code==='42501')
  })
  await t.test('protected effects and current membership revocation keep their original outcomes',async()=>{
   await f.policy('supplier.location.write');await f.grant('supplier.location.write')
   assert.equal((await f.execute(f.host(),f.input())).decision,'ALLOW')
   await f.controlled(c=>c.query("UPDATE profitia_access.memberships SET status='SUSPENDED' WHERE organisation_id=$1 AND user_id=$2",[f.A,f.U]))
   await assert.rejects(f.execute(f.host(),f.input()))
  })
 }finally{await f.close()}
})
