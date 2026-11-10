// SYNTHETIC_ONLY. Real durable work state, no provider network or timer mock.
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {fixture,A} from './fixtures.mjs'
import {createContinuousRuntime,scheduledCommand} from '../src/continuous.mjs'
import {CalendarError} from '@profitia/economic-calendar-contracts'
const template={window:true,command:{contractVersion:'1.3.0',provider:'eia',family:'publication-calendar',operation:'calendar',criteria:{publication:'wpsr',from:'2026-01-01',to:'2026-12-31',limit:1000}}}
async function job(f,id='SYNTHETIC_ONLY_WPSR',interval=86400){await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query("INSERT INTO economic_calendar.sync_jobs(job_id,provider_id,command_template,organisation_id,grant_id,interval_seconds,status,next_due_at) VALUES($1,'eia',$2::jsonb,$3::uuid,$4::uuid,$5,'ACTIVE',clock_timestamp())",[id,JSON.stringify(template),A,randomUUID(),interval]))}
test('durable due times survive new runner instances, preserve source cadence and skip duplicate/overlapping ticks',async()=>{
 const f=await fixture({seed:false});try{
  await job(f);await job(f,'SYNTHETIC_ONLY_STEO',604800)
  const calls=[],logs=[];let renewals=0
  const sync={async synchronize(input){await f.ingest.transact(t=>input.assertLease(t));calls.push(input);return {receiptRef:randomUUID(),replay:false}}}
  const make=()=>createContinuousRuntime({database:f.ingest,synchronizer:sync,renewAccess:async()=>{renewals++;return {status:'CURRENT'}},report:e=>logs.push(e)})
  const result=await make().tick();assert.equal(result.triggerKind,'SCHEDULED');assert.equal(result.jobs.length,2);assert(!result.failed)
  assert.equal((await make().tick()).jobs.length,0);assert.equal(calls.length,2);assert.equal(renewals,2)
  const {rows}=await f.ingest.query('SELECT job_id,next_due_at,last_success_at FROM economic_calendar.sync_jobs ORDER BY job_id')
  assert(new Date(rows[0].next_due_at)-new Date(rows[0].last_success_at)>600000000)
  assert(new Date(rows[1].next_due_at)-new Date(rows[1].last_success_at)>86000000)
  assert(logs.every(l=>l.event==='ecr_service_continuity'||l.sourcePath==='SOURCE_HUB_ONLY'))
  assert.equal((await f.api('freshness')).body.items.length,2)
  await f.ingest.query("UPDATE economic_calendar.sync_jobs SET next_due_at=clock_timestamp(),lease_token=$1,lease_until=clock_timestamp()+interval '1 minute'",[randomUUID()])
  assert.equal((await make().tick()).jobs.length,0)
 }finally{await f.close()}
})
test('a restarted process resumes the original intent; expired fencing prevents late writes and preserves interrupted history',async()=>{
 const f=await fixture({seed:false});try{
  await job(f);const intent=randomUUID(),attempt=randomUUID()
  await f.ingest.query("UPDATE economic_calendar.sync_jobs SET intent_id=$1::uuid,active_command=$2::jsonb,lease_token=$3,lease_until=clock_timestamp()-interval '1 second',attempts=1",[intent,JSON.stringify(template.command),randomUUID()])
  await f.ingest.query("INSERT INTO economic_calendar.sync_attempts(attempt_id,job_id,intent_id,trigger_kind,outcome) VALUES($1,'SYNTHETIC_ONLY_WPSR',$2,'SCHEDULED','RUNNING')",[attempt,intent])
  let late=true;const seen=[]
  const make=()=>createContinuousRuntime({database:f.ingest,synchronizer:{async synchronize(input){seen.push(input.idempotencyKey)
   if(late){late=false;await f.ingest.query("UPDATE economic_calendar.sync_jobs SET lease_until=clock_timestamp()-interval '1 second'")}
   await f.ingest.transact(t=>input.assertLease(t));return {receiptRef:randomUUID(),replay:true}
  }}})
  assert.equal((await make().tick()).jobs[0].status,'LEASE_LOST')
  assert.equal((await make().tick()).jobs[0].status,'SUCCEEDED')
  assert.deepEqual(seen,['ecr-continuous:'+intent,'ecr-continuous:'+intent])
  const {rows}=await f.ingest.query('SELECT outcome FROM economic_calendar.sync_attempts ORDER BY started_at');assert.deepEqual(rows.map(r=>r.outcome),['INTERRUPTED','INTERRUPTED','SUCCEEDED'])
 }finally{await f.close()}
})
test('uncertain delivery pauses without a fresh intent; definitive failure retries are bounded and auditable',async()=>{
 const f=await fixture({seed:false});try{
  await job(f,'SYNTHETIC_ONLY_UNCERTAIN');let count=0
  const uncertain=createContinuousRuntime({database:f.ingest,synchronizer:{async synchronize(){count++;throw new CalendarError('EXTERNAL_RESULT_UNVERIFIED',409)}}})
  assert.equal((await uncertain.tick()).jobs[0].status,'BLOCKED');assert.equal((await uncertain.tick()).jobs.length,0);assert.equal(count,1)
  await job(f,'SYNTHETIC_ONLY_RETRY');const intents=[]
  const retry=createContinuousRuntime({database:f.ingest,synchronizer:{async synchronize(input){intents.push(input.idempotencyKey);throw new CalendarError('PREVIOUS_ATTEMPT_FAILED',409)}}})
  for(let n=0;n<3;n++){
   const r=await retry.tick();assert.equal(r.jobs[0].status,n===2?'BLOCKED':'RETRY')
   if(n<2)await f.ingest.query("UPDATE economic_calendar.sync_jobs SET next_due_at=clock_timestamp() WHERE job_id='SYNTHETIC_ONLY_RETRY'")
  }
  assert.equal(new Set(intents).size,3);assert.equal((await retry.tick()).jobs.length,0)
 }finally{await f.close()}
})
test('source windows are bounded observations, not an unbounded historical download',()=>{
 const c=scheduledCommand(template,'2026-11-10T23:00:00Z');assert.equal(c.criteria.from,'2026-10-06');assert.equal(c.criteria.to,'2027-10-06')
 assert.equal((Date.parse(c.criteria.to)-Date.parse(c.criteria.from))/86400000,365)
})
