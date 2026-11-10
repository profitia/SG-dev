// SYNTHETIC_ONLY. Real PostgreSQL/E1 with offline normalized source records.
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {fixture,A,B} from './fixtures.mjs'
import {persistAcquisition} from '../src/repository.mjs'
import {createRepository} from '../src/repository.mjs'
import {createDatabase} from '../src/database.mjs'
import {createAuthorizer} from '../src/authorization.mjs'
import {publicationScheduleObservation,fingerprint} from '@profitia/economic-calendar-contracts'
import {schedulePayload,scheduleRecord,scheduleAnswer} from '../../platform-source-hub/src/providers/publication-schedules.mjs'

export function scheduleResponse(provider,{day='2026-11-12',retrieved='2026-11-10T00:00:00.000Z',receipt=randomUUID(),period='2026-11-06',count=1}={}){
 const command={contractVersion:'1.3.0',provider,family:'publication-calendar',operation:'calendar',criteria:provider==='eia'?{publication:'wpsr',from:'2026-11-01',to:'2026-12-31',limit:1000}:{limit:1000}}
 const items=Array.from({length:count},(_,i)=>{
  const ref=provider+':SYNTHETIC_ONLY_PUBLICATION_'+i
  const p=schedulePayload({title:'SYNTHETIC_ONLY publication '+i,publicationRef:ref,correlationKey:fingerprint({provider,ref}),scheduleId:provider==='eia'?null:'SYNTHETIC_ONLY_'+i,
   identityStatus:provider==='eia'?'OFFICIAL_PUBLICATION_DEFINITION':'PROVIDER_ID',timeZone:'America/New_York',timePrecision:provider==='eia'?'INSTANT':'DATE',scheduledAt:provider==='eia'?day+'T16:00:00.000Z':null,
   dateOnly:day,referencePeriod:provider==='eia'?period:null,recurrence:'weekly',officialSource:provider==='eia',scheduleStatus:provider==='eia'?'OFFICIAL_EXCEPTION':'PROVIDER_REPORTED',exception:provider==='eia'?{reason:'SYNTHETIC_ONLY holiday',standardDate:'2026-11-11'}:null})
  const item=scheduleRecord(provider,'SYNTHETIC_ONLY',p,provider==='eia'?'https://www.eia.gov/petroleum/supply/weekly/schedule.php':'https://api.commodities.sh/v1/calendar')
  Object.assign(item.metadata,{retrievedAt:retrieved,licenceRef:'SYNTHETIC_ONLY_'+provider,usageReceiptRef:receipt,retentionUntil:null,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY',consumerStorage:{mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:'SYNTHETIC_ONLY_OWNER_STORAGE',licenceVersion:'1',rightsVersion:'1',consumerApplicationId:'profitia-economic-calendar-runtime-development',retentionMode:'DURABLE_NO_FIXED_EXPIRY',redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY'}})
  return item
 })
 const response=scheduleAnswer(provider,items,{contractVersion:'1.3.0',limit:1000});response.provenance={retrievedAt:retrieved,licenceRef:'SYNTHETIC_ONLY_'+provider,qualityStatus:'UNKNOWN'};response.usage={receiptRef:receipt,upstreamAttempts:1,cacheHit:false}
 return {command,response}
}
async function activate(f,provider){return f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query("SELECT economic_calendar.set_storage_policy(0,$1,$2,'SYNTHETIC_ONLY_OWNER_STORAGE','ACTIVE')",[provider,'SYNTHETIC_ONLY_'+provider]))}
test('publication identity never equates an aggregator next date with an immutable release; EIA uses the supplied reference period',()=>{
 const e=scheduleResponse('eia'),a=publicationScheduleObservation(e.response.items[0]);assert(a.event);assert.equal(a.event.data.values.actual,null)
 const moved=scheduleResponse('eia',{day:'2026-11-13'}),b=publicationScheduleObservation(moved.response.items[0]);assert.equal(b.event.eventId,a.event.eventId);assert.notEqual(b.event.fingerprint,a.event.fingerprint)
 const sh=publicationScheduleObservation(scheduleResponse('commodities-sh').response.items[0]);assert.equal(sh.event,null);assert.equal(sh.publication.data.unresolvedNextSchedule.timePrecision,'DATE');assert.equal(sh.publication.data.unresolvedNextSchedule.scheduledAt,null)
 for(const mutate of [i=>delete i.metadata.consumerStorage,i=>i.metadata.consumerStorage.consumerApplicationId='another-app',i=>i.payload.secret='MUST_NOT_RETAIN']){const item=structuredClone(e.response.items[0]);mutate(item);assert.throws(()=>publicationScheduleObservation(item))}
})
test('both source families persist, reconnect/read, refresh without duplication, and retain real observed changes only',async()=>{
 const f=await fixture({seed:false})
 try{
  const e=scheduleResponse('eia'),sh=scheduleResponse('commodities-sh')
  await assert.rejects(persistAcquisition(f.ingest,e.command,e.response),{code:'ECR_STORAGE_POLICY_NOT_ADMITTED'})
  await activate(f,'eia');await activate(f,'commodities-sh')
  assert.equal((await persistAcquisition(f.ingest,e.command,e.response)).created,1)
  assert.equal((await persistAcquisition(f.ingest,sh.command,sh.response)).publicationCreated,1)
  assert.equal((await f.api('events')).body.items.length,1)
  const list=await f.api('publications');assert.equal(list.status,200,JSON.stringify(list.body));assert.equal(list.body.items.length,2)
  // New pools, new SQL sessions and a new operation-bound E1 host; no ingestion
  // connection, acquisition response or in-memory store is reused by this read.
  const p=f.e1.calendar.admin.connectionParameters
  const url=new URL('postgresql://127.0.0.1');url.port=String(p.port);url.username=f.configuration.runtimeRole;url.password=p.password;url.pathname='/'+p.database
  for(let n=0;n<2;n++){
   const db=createDatabase({connectionString:url.href,binding:{databaseName:p.database,role:f.configuration.runtimeRole},ssl:false})
   try{await db.verifyLogin();const authorizer=await createAuthorizer(f.configuration,db,{fetch:f.e1.transport}),repo=createRepository(f.configuration,db)
    const retained=await authorizer.execute({request:f.e1.calendar.request(),organisation:A,kind:'events'},(_context,tx)=>repo.listPublications(tx,{}));assert.equal(retained.items.length,2)
   }finally{await db.close()}
  }
  const before=await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query('SELECT count(*) FROM economic_calendar.publication_observations'))
  for(const provider of ['eia','commodities-sh']){const repeat=scheduleResponse(provider,{retrieved:'2026-11-10T00:01:00.000Z'});const result=await persistAcquisition(f.ingest,repeat.command,repeat.response);assert.equal(result.publicationUnchanged,1);assert.equal(result.changed,0)}
  assert.equal(Number((await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query('SELECT count(*) FROM economic_calendar.publication_observations'))).rows[0].count),Number(before.rows[0].count))
  assert.equal((await persistAcquisition(f.ingest,sh.command,sh.response)).replay,true)
  const cutoff=new Date().toISOString();await new Promise(r=>setTimeout(r,5))
  const changed=scheduleResponse('commodities-sh',{day:'2026-11-19',retrieved:'2026-11-10T00:02:00.000Z'});assert.equal((await persistAcquisition(f.ingest,changed.command,changed.response)).publicationChanged,1)
  const publication=list.body.items.find(p=>p.source.provider==='commodities-sh')
  assert.equal((await f.api('publications/'+publication.publicationId)).body.publication.unresolvedNextSchedule.dateOnly,'2026-11-19')
  assert.equal((await f.api('publications/'+publication.publicationId+'?asKnownAt='+encodeURIComponent(cutoff))).body.publication.unresolvedNextSchedule.dateOnly,'2026-11-12')
  assert.equal((await f.api('publications/'+publication.publicationId+'/revisions')).body.items.length,2)
  // An older identical refresh cannot move the source-time fence backwards.
  for(const options of [{day:'2026-11-19',retrieved:'2026-11-10T00:00:30.000Z'},{day:'2026-11-15',retrieved:'2026-11-10T00:01:30.000Z'}]){const old=scheduleResponse('commodities-sh',options);await persistAcquisition(f.ingest,old.command,old.response)}
  const history=(await f.api('publications/'+publication.publicationId+'/revisions')).body.items;assert.equal(history.length,3);assert.equal(history.at(-1).adoptedAsCurrent,false)
  assert.equal((await f.api('publications/'+publication.publicationId)).body.publication.unresolvedNextSchedule.dateOnly,'2026-11-19')
  const moved=scheduleResponse('eia',{day:'2026-11-13',retrieved:'2026-11-10T00:03:00.000Z'});assert.equal((await persistAcquisition(f.ingest,moved.command,moved.response)).changed,1)
  assert.equal((await f.api('events')).body.items.length,1)
  // A failed acquisition leaves neither a definition nor an event behind.
  const broken=scheduleResponse('eia',{count:2,retrieved:'2026-11-10T00:04:00.000Z'}),real=f.ingest.transact.bind(f.ingest)
  const failing={...f.ingest,transact:(action,opts)=>real(({query,transaction})=>action({transaction,query:async(sql,args)=>{if(sql.startsWith('INSERT INTO economic_calendar.sync_runs'))throw Error('SYNTHETIC_ONLY_ROLLBACK');return query(sql,args)}}),opts)}
  await assert.rejects(persistAcquisition(failing,broken.command,broken.response),/SYNTHETIC_ONLY_ROLLBACK/)
  assert.equal((await f.api('publications')).body.items.length,2)
  assert.equal((await f.api('events')).body.items.length,1)
  // Shared licensed facts are reusable in another currently entitled org;
  // knowing an unrelated organisation ID is not an entitlement.
  assert.equal((await f.api('publications',{organisation:B})).status,200)
  assert.equal((await f.api('publications',{organisation:'33333333-3333-4333-8333-333333333333'})).status,403)
  await assert.rejects(f.ingest.query("SELECT economic_calendar.set_storage_policy(1,'eia','x','x','REVOKED')"),e=>e.code==='42501')
  await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query("SELECT economic_calendar.set_storage_policy(1,'eia','SYNTHETIC_ONLY_eia','SYNTHETIC_ONLY_OWNER_STORAGE','REVOKED')"))
  assert.equal((await f.api('events')).body.items.length,0);assert.equal((await f.api('publications')).body.items.length,1)
  await assert.rejects(persistAcquisition(f.ingest,e.command,e.response),{code:'ECR_STORAGE_POLICY_NOT_ADMITTED'})
 }finally{await f.close()}
})
test('one operation has two current E1 observations for 1 or 100 publications, without a provider call or a per-record Clerk loop',async()=>{
 const f=await fixture({seed:false})
 try{
  await activate(f,'commodities-sh')
  const sample=scheduleResponse('commodities-sh',{count:100});await persistAcquisition(f.ingest,sample.command,sample.response)
  const measurements=[]
  for(const limit of [1,100]){const e1=f.e1.transportState.calls,clerk=f.e1.clerkState.calls.length,start=performance.now();const r=await f.api('publications?limit='+limit);assert.equal(r.status,200);assert.equal(r.body.items.length,limit);measurements.push({returned:limit,e1Observations:f.e1.transportState.calls-e1,centralClerkCalls:f.e1.clerkState.calls.length-clerk,durationMs:performance.now()-start})}
  assert(measurements.every(m=>m.e1Observations===2));assert.equal(measurements[0].centralClerkCalls,measurements[1].centralClerkCalls)
  const log=f.logs.filter(e=>e.operation==='publications').at(-1);assert.equal(log.recordsReturned,100);assert.equal(log.acquisitionPath,'LOCAL_ECR_STORE');assert(Number.isFinite(log.databaseOperationMs))
  console.log(JSON.stringify({kind:'SYNTHETIC_ONLY_AUTHORIZATION_MEASUREMENT',measurements,live:false}))
 }finally{await f.close()}
})

test('product owner activation installs only its exact receiver and two policies; ordinary roles cannot activate or overwrite it',async()=>{
 const {readFileSync}=await import('node:fs'),{createHash}=await import('node:crypto'),f=await fixture({seed:false})
 try{
  const planBytes=readFileSync(new URL('../operations/stage03-owner-plan.json',import.meta.url)),hubPlan=JSON.parse(readFileSync(new URL('../../platform-source-hub/operations/calendar-consumer-storage-owner-plan.json',import.meta.url))),plan=JSON.parse(planBytes)
  assert.equal(hubPlan.ownerPacketSha256,createHash('sha256').update(planBytes).digest('hex'));assert.equal(hubPlan.globalLicenceMutation,false)
  const sql=readFileSync(new URL('../operations/activate-calendar-storage.sql',import.meta.url),'utf8'),c=f.e1.calendar.admin
  await f.e1.calendar.asOwner('profitia_access_owner',async q=>{await q.query('DELETE FROM profitia_e1_receiver.installation');await q.query("UPDATE profitia_access.installation SET project_id='delicate-queen-44677134',branch_id='br-synthetic-only-product'")})
  const binding={...f.e1.calendar.binding,projectId:'delicate-queen-44677134',branchId:'br-synthetic-only-product'}
  await c.query("SELECT set_config('ecr.stage03_binding',$1,false),set_config('ecr.stage03_proof_key_hex',$2,false),set_config('ecr.stage03_owner_ref',$3,false)",[JSON.stringify(binding),'1'.repeat(64),'owner-decision:sha256:'+'2'.repeat(64)])
  await assert.rejects(f.ingest.query(sql),e=>e.code==='42501');await f.ingest.query('ROLLBACK')
  await c.query(sql)
  const policies=await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query('SELECT provider_id,licence_ref,retention_mode,redistribution FROM economic_calendar.storage_policies ORDER BY provider_id'))
  assert.deepEqual(policies.rows.map(r=>r.provider_id),['commodities-sh','eia']);assert(policies.rows.every(r=>r.retention_mode==='DURABLE_NO_FIXED_EXPIRY'&&r.redistribution==='PRIVATE_AUTHORISED_CONSUMER_ONLY'))
  const receiver=(await f.e1.calendar.asOwner('profitia_access_owner',q=>q.query('SELECT authority_origin,binding FROM profitia_e1_receiver.installation'))).rows[0];assert.equal(receiver.authority_origin,'https://identity-runtime-development.onrender.com');assert.deepEqual(receiver.binding,binding)
  await assert.rejects(c.query(sql),/RECEIVER_EXISTS_RECONCILE/);await c.query('ROLLBACK')
 }finally{await f.close()}
})
