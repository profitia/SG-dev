import test from 'node:test'
import assert from 'node:assert/strict'
import {expiryNotices,reconcileExpiryNotices,maintainSourceAccess,monitorAccess} from '../src/access-continuity.mjs'

const end='2026-12-04T22:19:09.000Z',dependency={id:'source:source-hub.eia.publication-calendar',kind:'SOURCE_ADMISSION',source:'EIA WPSR/STEO',status:'ACTIVE',expiresAt:end,expiryMode:'FINITE'}
const before=days=>new Date(Date.parse(end)-days*86400000)
test('expiry bands use actual UTC deadlines, signal once per band and clear after renewal',()=>{
 let state
 for(const days of [14,7,3,1]){
  const r=reconcileExpiryNotices(state,[dependency],{at:before(days)});assert.equal(r.alerts.length,1);assert.equal(r.alerts[0].thresholdDays,days);assert.equal(r.alerts[0].remainingDays,days);state=r.state
  assert.equal(reconcileExpiryNotices(state,[dependency],{at:before(days-0.1)}).alerts.length,0)
 }
 const renewed={...dependency,expiresAt:'2027-01-04T22:19:09.000Z'},r=reconcileExpiryNotices(state,[renewed],{at:before(0.9)});assert.deepEqual(r.resolved,[dependency.id]);assert.deepEqual(r.state.incidents,{})
 assert.equal(expiryNotices([dependency],before(15)).length,0)
})
test('revocation, real expiry, renewal failure and unknown rights are distinct; a null date is never inferred to be perpetual',()=>{
 assert.equal(expiryNotices([{...dependency,status:'REVOKED'}],before(25))[0].reason,'ACCESS_LOST')
 assert.equal(expiryNotices([dependency],before(-1))[0].reason,'ACCESS_EXPIRED')
 assert.equal(expiryNotices([{...dependency,status:'ERROR'}],before(25))[0].reason,'TECHNICAL_FAILURE')
 assert.equal(expiryNotices([{...dependency,expiresAt:null}],before(25))[0].reason,'VALIDITY_UNKNOWN')
 assert.deepEqual(expiryNotices([{...dependency,expiresAt:null,expiryMode:'NO_FIXED_EXPIRY'}],before(25)),[])
 assert.throws(()=>expiryNotices([{...dependency,id:'private value with spaces'}]),/INVALID_ACCESS_DEPENDENCY/)
 assert.throws(()=>expiryNotices([dependency,dependency]),/INVALID_ACCESS_SNAPSHOT/)
})
test('persistent failures get a daily reminder and successful recovery suppresses further alarms',()=>{
 const d={...dependency,status:'REVOKED'},a=reconcileExpiryNotices(null,[d],{at:before(20)})
 assert.equal(a.alerts.length,1);assert.equal(reconcileExpiryNotices(a.state,[d],{at:before(19.99)}).alerts.length,0)
 assert.equal(reconcileExpiryNotices(a.state,[d],{at:before(19)}).alerts.length,1)
 const clear=reconcileExpiryNotices(a.state,[dependency],{at:before(19.5)});assert.equal(clear.resolved.length,1);assert.equal(clear.alerts.length,0)
})
test('a bounded explicit delivery rehearsal does not fabricate real expiry and is idempotent',()=>{
 const at=before(20),deliveryTest={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',until:new Date(at.getTime()+1800000).toISOString()}
 const a=reconcileExpiryNotices(null,[dependency],{at,deliveryTest});assert.equal(a.alerts.length,1);assert.equal(a.alerts[0].reason,'CONTROLLED_DELIVERY_TEST');assert.equal(a.alerts[0].remainingDays,20);assert.equal(a.alerts[0].simulatedThresholdDays,14)
 assert.equal(reconcileExpiryNotices(a.state,[dependency],{at,deliveryTest}).alerts.length,0)
 assert.equal(reconcileExpiryNotices(null,[dependency],{at:new Date(at.getTime()+3600000),deliveryTest}).alerts.length,0)
})
test('a failed source renewal is observable even when status reading also fails, without provider access',async()=>{
 let calls=0;const r=await maintainSourceAccess(async sql=>{assert(sql.startsWith('SELECT '));calls++;throw Object.assign(Error('private diagnostics must not escape'),{code:'ECONNREFUSED'})})
 assert.equal(calls,2);assert.equal(r.status,'FAILED');assert.equal(r.dependencies[0].kind,'RENEWAL');assert(!JSON.stringify(r).includes('private diagnostics'))
})
test('monitoring stores only control metadata in the existing job, preserves its sync result and does not acquire data',async()=>{
 let row={received:4,receiptRef:'original-sync-receipt'},writes=0
 const database={async query(){return{rows:[]}},async transact(fn){return fn({async query(sql,values){if(sql.startsWith('SELECT last_result'))return{rows:[{last_result:row}]};assert(sql.startsWith('UPDATE economic_calendar.sync_jobs'));writes++;row={...row,accessMonitoring:JSON.parse(values[0])};return{rows:[]}}})}}
 const sourceState={status:'CURRENT',dependencies:[dependency]},identityQuery=async()=>({rows:[{result:{dependencies:[]}}]}),options={database,sourceState,identityQuery,serviceRenewal:{status:'CURRENT'},at:before(7)}
 const a=await monitorAccess(options),b=await monitorAccess(options);assert.equal(a.alerts.length,1);assert.equal(b.alerts.length,0);assert.equal(row.received,4);assert.equal(row.receiptRef,'original-sync-receipt');assert.equal(writes,2)
 const denied=await monitorAccess({...options,serviceRenewal:null});assert(denied.alerts.some(x=>x.dependency==='service-renewal'))
})

test('real synchronization preserves existing alert deduplication metadata without changing the result ledger',async()=>{
 const {fixture,A}=await import('./fixtures.mjs'),{createContinuousRuntime}=await import('../src/continuous.mjs'),{randomUUID}=await import('node:crypto')
 const f=await fixture({seed:false});try{
  const monitoring={version:1,incidents:{'source-renewal':{fingerprint:'SYNTHETIC_ONLY',lastSignalledAt:new Date().toISOString()}},deliveryTestId:null}
  await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query("INSERT INTO economic_calendar.sync_jobs(job_id,provider_id,command_template,organisation_id,grant_id,interval_seconds,status,next_due_at,last_result) VALUES('eia-wpsr-results','eia',$1::jsonb,$2::uuid,$3::uuid,86400,'ACTIVE',clock_timestamp(),$4::jsonb)",[{command:{contractVersion:'1.3.0',provider:'eia',family:'publication-calendar',operation:'calendar',criteria:{publication:'wpsr',from:'2026-01-01',to:'2026-12-31',limit:1000}}},A,randomUUID(),{accessMonitoring:monitoring}]))
  const result={receiptRef:randomUUID(),received:4,replay:false},runtime=createContinuousRuntime({database:f.ingest,synchronizer:{async synchronize(){return result}}})
  assert.equal((await runtime.tick()).jobs[0].status,'SUCCEEDED')
  const saved=(await f.ingest.query("SELECT last_result FROM economic_calendar.sync_jobs WHERE job_id='eia-wpsr-results'")).rows[0].last_result
  assert.deepEqual(saved.accessMonitoring,monitoring);assert.equal(saved.received,4);assert.equal(saved.receiptRef,result.receiptRef)
  assert.equal((await f.ingest.query('SELECT count(*)::int AS n FROM economic_calendar.result_observations')).rows[0].n,0)
 }finally{await f.close()}
})
