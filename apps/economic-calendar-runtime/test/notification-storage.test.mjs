// SYNTHETIC_ONLY: real local PostgreSQL, real operation-bound E1, no mail/provider.
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import pg from 'pg'
import {fixture,A,B,U} from './fixtures.mjs'
import {persistAcquisition} from '../src/repository.mjs'
import {schedulePayload,scheduleRecord,scheduleAnswer} from '../../platform-source-hub/src/providers/publication-schedules.mjs'
const owner='economic_calendar_development_owner'
async function setup(){
 const f=await fixture({seed:false})
 const role='economic_calendar_synthetic_'+randomUUID().replaceAll('-',''),close=f.close
 let pool
 try{
 await f.e1.calendar.admin.query("CREATE ROLE "+role+" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'SYNTHETIC_ONLY'")
 pool=new pg.Pool({...f.e1.calendar.admin.connectionParameters,user:role,password:'SYNTHETIC_ONLY',max:2})
 await f.e1.calendar.asOwner(owner,async q=>{
  await q.query("SELECT economic_calendar.set_storage_policy(0,'eia','SYNTHETIC_ONLY_LICENSE','SYNTHETIC_ONLY_BASIS','ACTIVE')")
  await q.query("INSERT INTO economic_calendar.notification_delivery_policy VALUES(true,'ACTIVE',$1,$1,'SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour','SYNTHETIC_ONLY',1)",[role])
  await q.query('GRANT USAGE ON SCHEMA economic_calendar TO '+role)
  for(const signature of ['notification_descriptor()','notification_gate(uuid)','notification_claim(uuid,text)','notification_begin(uuid,uuid,text,text)','notification_settle(uuid,uuid,text,text)','notification_provider_event(jsonb)','qualify_reminders()','notification_health()'])await q.query('GRANT EXECUTE ON FUNCTION economic_calendar.'+signature+' TO '+role)
 })
 f.close=async()=>{await pool.end();await close()}
 const scalar=async(sql,args=[])=>Object.values((await pool.query(sql,args)).rows[0])[0]
 return {...f,pool,scalar}
 }catch(error){await pool?.end();await close();throw error}
}
function source({time=new Date(Date.now()+45*60000).toISOString(),receipt=randomUUID(),retrieved=new Date().toISOString()}={}){
 const date=time.slice(0,10),p=schedulePayload({title:'SYNTHETIC_ONLY EIA',publicationRef:'eia:wpsr',correlationKey:'a'.repeat(64),identityStatus:'OFFICIAL_PUBLICATION_DEFINITION',timeZone:'UTC',timePrecision:'INSTANT',scheduledAt:time,dateOnly:date,referencePeriod:'2026-11-06',recurrence:'weekly',officialSource:true,scheduleStatus:'OFFICIAL_DATED'})
 const i=scheduleRecord('eia','SYNTHETIC_ONLY',p,'https://www.eia.gov/petroleum/supply/weekly/schedule.php')
 Object.assign(i.metadata,{retrievedAt:retrieved,licenceRef:'SYNTHETIC_ONLY_LICENSE',usageReceiptRef:receipt,retentionUntil:null,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY',consumerStorage:{mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:'SYNTHETIC_ONLY_BASIS',licenceVersion:'1',rightsVersion:'1',consumerApplicationId:'profitia-economic-calendar-runtime-development',retentionMode:'DURABLE_NO_FIXED_EXPIRY',redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY'}})
 const response=scheduleAnswer('eia',[i],{contractVersion:'1.3.0',limit:100});response.usage={receiptRef:receipt,upstreamAttempts:1,cacheHit:false};response.provenance={retrievedAt:retrieved,licenceRef:i.metadata.licenceRef,qualityStatus:'UNKNOWN'}
 return {response,command:{contractVersion:'1.3.0',family:'publication-calendar',provider:'eia',operation:'calendar',criteria:{publication:'wpsr',from:date,to:date,limit:100}}}
}
async function store(f,input=source()) {await persistAcquisition(f.ingest,input.command,input.response);return (await f.api('events')).body.items[0]}
async function optin(f,event){
 const prefs=(await f.api('preferences')).body
 assert.equal((await f.api('preferences',{method:'PUT',body:{expectedVersion:prefs.version,preferences:{...prefs.preferences,publicationWatches:[{publicationId:event.publicationId,approaching:true,results:true,changes:true}]}}})).status,200)
 const r=await f.api('notifications',{method:'PUT',body:{expectedVersion:0,settings:{emailEnabled:true,timeZone:'Europe/Warsaw'}}});assert.equal(r.status,200,JSON.stringify(r.body));return r.body
}
const claim=f=>f.scalar('SELECT economic_calendar.notification_claim($1::uuid,$2)',[randomUUID(),'a'.repeat(64)])
test('explicit consent is private, versioned, independent of watch selection; no access through ordinary ingestion',async()=>{
 const f=await setup();try{
  const e=await store(f);assert.equal((await f.api('notifications')).body.settings.emailEnabled,false)
  const consent=await optin(f,e);assert.equal(consent.version,1)
  assert.equal((await f.api('notifications',{organisation:B})).body.settings.emailEnabled,false)
  assert.equal((await f.api('notifications',{token:'SYNTHETIC_B'})).body.settings.emailEnabled,false)
  assert.equal((await f.api('notifications',{method:'PUT',body:{expectedVersion:0,settings:{emailEnabled:false,timeZone:'UTC'}}})).status,409)
  assert.equal((await f.api('notifications',{method:'PUT',body:{expectedVersion:1,settings:{emailEnabled:true,timeZone:'UTC',recipient:'other@example.test'}}})).status,400)
  await assert.rejects(f.ingest.query('SELECT * FROM economic_calendar.notification_settings'),{code:'42501'})
  await assert.rejects(f.pool.query('SELECT * FROM economic_calendar.preferences'),{code:'42501'})
  await assert.rejects(f.pool.query('SELECT * FROM economic_calendar.notification_outbox'),{code:'42501'})
  const raw=await f.authorizer.execute({request:f.e1.calendar.request(),organisation:B,kind:'preferences'},async(_c,t)=>({count:(await t.query('SELECT * FROM economic_calendar.notification_settings WHERE user_id=$1',[U])).rows.length}))
  assert.equal(raw.count,0)
 }finally{await f.close()}
})
test('only real observed changes enqueue, replay does not duplicate; disable and rights withdrawal prevent begin',async()=>{
 const f=await setup();try{
  const initial=source(),e=await store(f,initial);await optin(f,e);assert.equal(await claim(f),null)
  const changed=source({time:new Date(Date.now()+90*60000).toISOString()});await store(f,changed)
  const c=await claim(f);assert.equal(c.payload.type,'changes')
  assert.equal(await f.scalar('SELECT economic_calendar.notification_gate($1)',[c.request.deliveryId]),true)
  const state=(await f.api('notifications')).body
  assert.equal((await f.api('notifications',{method:'PUT',body:{expectedVersion:state.version,settings:{emailEnabled:false,timeZone:'Europe/Warsaw'}}})).status,200)
  assert.equal(await f.scalar('SELECT economic_calendar.notification_begin($1,$2,$3,$4)',[c.request.deliveryId,c.request.leaseId,c.request.nonce,'b'.repeat(64)]),false)
  await f.scalar("SELECT economic_calendar.notification_settle($1,$2,'REJECTED',NULL)",[c.request.deliveryId,c.request.leaseId])
  assert.equal(await claim(f),null)
  await persistAcquisition(f.ingest,changed.command,changed.response)
  const count=await f.e1.calendar.asOwner(owner,q=>q.query('SELECT count(*)::integer AS count FROM economic_calendar.notification_outbox'))
  assert.equal(count.rows[0].count,1)
 }finally{await f.close()}
})
test('a crashed SENDING attempt becomes UNKNOWN and cannot be sent again; claim lease loss before begin is safe',async()=>{
 const f=await setup();try{
  const e=await store(f);await optin(f,e);await store(f,source({time:new Date(Date.now()+100*60000).toISOString()}))
  const c=await claim(f)
  assert.equal(await f.scalar('SELECT economic_calendar.notification_begin($1,$2,$3,$4)',[c.request.deliveryId,c.request.leaseId,c.request.nonce,'b'.repeat(64)]),true)
  assert.equal(await f.scalar('SELECT economic_calendar.notification_begin($1,$2,$3,$4)',[c.request.deliveryId,c.request.leaseId,c.request.nonce,'b'.repeat(64)]),false)
  await f.e1.calendar.asOwner(owner,q=>q.query("UPDATE economic_calendar.notification_outbox SET lease_until=clock_timestamp()-interval '1 second' WHERE delivery_id=$1",[c.request.deliveryId]))
  assert.equal(await claim(f),null)
  const r=await f.api('notifications');assert.equal(r.body.delivery.UNKNOWN,1);assert.equal(r.body.channel.providerAcceptanceIsDelivery,false)
  assert.equal((await f.scalar('SELECT economic_calendar.notification_health()')).newFailures,1)
  assert.equal((await f.scalar('SELECT economic_calendar.notification_health()')).newFailures,0)
  assert.equal(await f.scalar("SELECT economic_calendar.notification_settle($1,$2,'RELEASE',NULL)",[c.request.deliveryId,c.request.leaseId]),false)
 }finally{await f.close()}
})
test('late opt-in never sends a catch-up reminder; a due reminder is idempotent and reschedule invalidates its claim',async()=>{
 const f=await setup();try{
  const e=await store(f);await optin(f,e)
  assert.equal(await f.scalar('SELECT economic_calendar.qualify_reminders()'),0)
  // Move only the SYNTHETIC consent epoch back; source events remain real fixture
  // records and no historical message is inserted into an actual environment.
  await f.e1.calendar.asOwner(owner,async q=>{
   await q.query("UPDATE economic_calendar.notification_settings SET enabled_at=clock_timestamp()-interval '2 hours'")
   await q.query("UPDATE economic_calendar.notification_watches SET enabled_at=clock_timestamp()-interval '2 hours'")
  })
  assert.equal(await f.scalar('SELECT economic_calendar.qualify_reminders()'),1)
  assert.equal(await f.scalar('SELECT economic_calendar.qualify_reminders()'),0)
  const c=await claim(f);assert.equal(c.payload.type,'approaching')
  await store(f,source({time:new Date(Date.now()+120*60000).toISOString()}))
  assert.equal(await f.scalar('SELECT economic_calendar.notification_gate($1)',[c.request.deliveryId]),false)
 }finally{await f.close()}
})
test('durable provider receipts bind the exact attempt, reconcile an early callback and reject replay mutation without resending',async()=>{
 const f=await setup();try{
  const e=await store(f);await optin(f,e);await store(f,source({time:new Date(Date.now()+90*60000).toISOString()}));const c=await claim(f)
  assert.equal(await f.scalar('SELECT economic_calendar.notification_begin($1,$2,$3,$4)',[c.request.deliveryId,c.request.leaseId,c.request.nonce,'b'.repeat(64)]),true)
  const receipt={deliveryId:c.request.deliveryId,leaseId:c.request.leaseId,recipientDigest:'b'.repeat(64),messageDigest:'c'.repeat(64),eventDigest:'d'.repeat(64),status:'DEFERRED',occurredAt:new Date().toISOString(),tokenDigest:'e'.repeat(64),payloadDigest:'f'.repeat(64)}
  const record=p=>f.scalar('SELECT economic_calendar.notification_provider_event($1::jsonb)',[JSON.stringify(p)])
  assert.equal(await record({...receipt,recipientDigest:'1'.repeat(64)}),false)
  assert.equal(await record({...receipt,leaseId:randomUUID()}),false)
  assert.deepEqual(await Promise.all([record(receipt),record(receipt)]),[true,true])
  assert.equal(await record({...receipt,status:'DELIVERED',payloadDigest:'1'.repeat(64)}),false)
  assert.equal(await f.scalar("SELECT economic_calendar.notification_settle($1,$2,'UNKNOWN',NULL)",[c.request.deliveryId,c.request.leaseId]),true)
  assert.equal(await claim(f),null)
  const failed={...receipt,eventDigest:'1'.repeat(64),tokenDigest:'2'.repeat(64),payloadDigest:'3'.repeat(64),status:'FAILED',occurredAt:new Date().toISOString()}
  assert.equal(await record(failed),true)
  assert.equal((await f.scalar('SELECT economic_calendar.notification_health()')).newFailures,1)
  assert.equal(await record({...failed,tokenDigest:'4'.repeat(64)}),true)
  assert.equal((await f.scalar('SELECT economic_calendar.notification_health()')).newFailures,0)
  // Historical outcomes can still be recorded after owner revocation; no new
  // work may be claimed. The callback grants no sending authority.
  await f.e1.calendar.asOwner(owner,q=>q.query("UPDATE economic_calendar.notification_delivery_policy SET status='REVOKED'"))
  const delivered={...receipt,eventDigest:'5'.repeat(64),tokenDigest:'6'.repeat(64),payloadDigest:'7'.repeat(64),status:'DELIVERED',occurredAt:new Date().toISOString()}
  assert.equal(await record(delivered),true)
  assert.equal(await record({...failed,eventDigest:'8'.repeat(64),tokenDigest:'9'.repeat(64)}),true)
  assert.equal((await f.api('notifications')).body.delivery.DELIVERED,1)
  await assert.rejects(claim(f),{code:'42501'})
  await assert.rejects(f.ingest.query('SELECT economic_calendar.notification_provider_event($1::jsonb)',[JSON.stringify(delivered)]),{code:'42501'})
  await assert.rejects(f.pool.query('SELECT * FROM economic_calendar.notification_provider_receipts'),{code:'42501'})
 }finally{await f.close()}
})
test('owner rehearsal requires explicit consent, is replay-safe and does not invent a global source event or revision',async()=>{
 const f=await setup();try{
  const e=await store(f),key=randomUUID(),args=[U,A,e.eventId,'changes',key]
  const qualify=()=>f.e1.calendar.asOwner(owner,q=>q.query('SELECT economic_calendar.qualify_delivery_rehearsal($1,$2,$3,$4,$5) AS inserted',args))
  await assert.rejects(qualify())
  await optin(f,e)
  const before=await f.e1.calendar.asOwner(owner,q=>q.query('SELECT (SELECT count(*) FROM economic_calendar.events)::int AS events,(SELECT count(*) FROM economic_calendar.observations)::int AS versions'))
  assert.equal((await qualify()).rows[0].inserted,true);assert.equal((await qualify()).rows[0].inserted,false)
  const c=await claim(f);assert.equal(c.payload.controlTest,true);assert.equal(c.payload.eventId,e.eventId)
  const after=await f.e1.calendar.asOwner(owner,q=>q.query('SELECT (SELECT count(*) FROM economic_calendar.events)::int AS events,(SELECT count(*) FROM economic_calendar.observations)::int AS versions'))
  assert.deepEqual(after.rows,before.rows)
  await assert.rejects(f.ingest.query('SELECT economic_calendar.qualify_delivery_rehearsal($1,$2,$3,$4,$5)',args),{code:'42501'})
  await assert.rejects(f.pool.query('SELECT economic_calendar.qualify_delivery_rehearsal($1,$2,$3,$4,$5)',args),{code:'42501'})
 }finally{await f.close()}
})
test('exhausted pre-send lease retries become a visible failure, never a silent dropped attempt',async()=>{
 const f=await setup();try{
  const e=await store(f);await optin(f,e);await store(f,source({time:new Date(Date.now()+90*60000).toISOString()}))
  for(let i=0;i<3;i++){
   assert(await claim(f));await f.e1.calendar.asOwner(owner,q=>q.query("UPDATE economic_calendar.notification_outbox SET lease_until=clock_timestamp()-interval '1 second'"));assert.equal(await claim(f),null)
   await f.e1.calendar.asOwner(owner,q=>q.query("UPDATE economic_calendar.notification_outbox SET available_at=clock_timestamp()-interval '1 second'"))
  }
  assert.equal((await f.api('notifications')).body.delivery.REJECTED,1)
  assert.equal((await f.scalar('SELECT economic_calendar.notification_health()')).newFailures,1)
  assert.equal((await f.scalar('SELECT economic_calendar.notification_health()')).newFailures,0)
 }finally{await f.close()}
})
