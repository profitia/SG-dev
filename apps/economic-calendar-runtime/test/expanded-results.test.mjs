// SYNTHETIC_ONLY normalized source records through real ECR PostgreSQL/E1.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {fixture,A} from './fixtures.mjs'
import {curate} from '../src/semantics.mjs'
import {persistAcquisition} from '../src/repository.mjs'
import {persistResults} from '../src/results.mjs'
import {fingerprint} from '@profitia/economic-calendar-contracts'
import {createEiaProvider} from '../../platform-source-hub/src/providers/eia.mjs'
import {schedulePayload,scheduleRecord,scheduleAnswer} from '../../platform-source-hub/src/providers/publication-schedules.mjs'
const old=JSON.parse(fs.readFileSync(new URL('../operations/semantic-bootstrap.json',import.meta.url))),expanded=JSON.parse(fs.readFileSync(new URL('../operations/expanded-semantic-bootstrap.json',import.meta.url)))
const measures=[...old,...expanded].filter(e=>e.kind==='measure'),owner='economic_calendar_development_owner'
const periods={'eia:wpsr':'2026-11-06','eia:gasdiesel':'2026-11-09','eia:heatingoilpropane':'2026-11-09'}
const pubFor=path=>path.includes('/stoc/')||path.includes('/sum/')?'eia:wpsr':path.endsWith('/gnd')?'eia:gasdiesel':'eia:heatingoilpropane'
const wireUnit={'Thousand Barrels':'MBBL','Thousand Barrels per Day':'MBBL/D','Percent':'%','Dollars per Gallon':'$/GAL'}
function rights(receipt,basis,licence,scope){return{retrievedAt:new Date().toISOString(),licenceRef:licence,usageReceiptRef:receipt,retentionUntil:null,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY',consumerStorage:{mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:basis,licenceVersion:'1',rightsVersion:'1',consumerApplicationId:'profitia-economic-calendar-runtime-development',retentionMode:'DURABLE_NO_FIXED_EXPIRY',redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY',...(scope?{scope}:{})}}}
async function setup({eventAt=new Date(Date.now()+3600000).toISOString()}={}){
 const f=await fixture({seed:false})
 await f.e1.calendar.asOwner(owner,async q=>{
  await q.query("SELECT economic_calendar.set_storage_policy(0,'eia','SYNTHETIC_CALENDAR','SYNTHETIC_CALENDAR_RIGHTS','ACTIVE')")
  for(const e of [...old,...expanded])await curate(q,e)
  for(const path of new Set(measures.map(m=>m.data.sourceSelector.path)))await q.query("INSERT INTO economic_calendar.result_storage_policies VALUES('eia','series-observations',$1,$2,'SYNTHETIC_RESULTS','SYNTHETIC_RESULT_RIGHTS',1,'ACTIVE','DURABLE_NO_FIXED_EXPIRY','PRIVATE_AUTHORISED_CONSUMER_ONLY')",[path,measures.filter(m=>m.data.sourceSelector.path===path).map(m=>m.data.sourceSelector.series)])
 })
 for(const [pub,period] of Object.entries(periods)){
  const receipt=randomUUID(),p=schedulePayload({title:'SYNTHETIC_ONLY '+pub,publicationRef:pub,correlationKey:fingerprint({pub}),identityStatus:'OFFICIAL_PUBLICATION_DEFINITION',timeZone:'America/New_York',timePrecision:'INSTANT',scheduledAt:eventAt,dateOnly:eventAt.slice(0,10),referencePeriod:period,recurrence:'weekly',officialSource:true,scheduleStatus:'RULE_DERIVED_UNCONFIRMED'})
  const item=scheduleRecord('eia','SYNTHETIC_ONLY',p,'https://www.eia.gov/petroleum/supply/weekly/schedule.php');Object.assign(item.metadata,rights(receipt,'SYNTHETIC_CALENDAR_RIGHTS','SYNTHETIC_CALENDAR'));item.metadata.contractVersion='1.5.0'
  const r=scheduleAnswer('eia',[item],{contractVersion:'1.5.0',limit:1000});r.usage={receiptRef:receipt,upstreamAttempts:1,cacheHit:false};r.provenance={retrievedAt:item.metadata.retrievedAt,licenceRef:item.metadata.licenceRef,qualityStatus:'UNKNOWN'}
  await persistAcquisition(f.ingest,{contractVersion:'1.5.0',family:'publication-calendar',provider:'eia',operation:'calendar',criteria:{publication:pub.slice(4),from:'2026-11-01',to:'2026-11-30',limit:1000}},r)
 }
 return f
}
async function response(path,{value='0',unitOverride=null,periodOverride=null,basis='SYNTHETIC_RESULT_RIGHTS'}={}){
 const subset=measures.filter(m=>m.data.sourceSelector.path===path),series=subset.map(m=>m.data.sourceSelector.series),receipt=randomUUID(),period=periodOverride??periods[pubFor(path)]
 const command={contractVersion:'1.4.0',provider:'eia',family:'series-observations',operation:'observations',criteria:{path,frequency:'weekly',data:['value'],facets:{series,duoarea:['NUS']},limit:1000}}
 const r=await createEiaProvider({fetchImpl:async()=>Response.json({response:{frequency:'weekly',total:String(subset.length),data:subset.map(m=>({period,series:m.data.sourceSelector.series,duoarea:'NUS',value,units:unitOverride??wireUnit[m.data.unit]}))}})}).acquire(command)
 r.usage={receiptRef:receipt,upstreamAttempts:1,cacheHit:false};r.provenance.licenceRef='SYNTHETIC_RESULTS'
 for(const i of r.items)Object.assign(i.metadata,rights(receipt,basis,'SYNTHETIC_RESULTS',{datasetId:path,seriesIds:series,fields:['value'],frequency:'weekly',geography:'NUS'}))
 return{command,response:r,intentDigest:fingerprint({receipt})}
}
const persist=(f,r)=>persistResults(f.ingest,r.command,r.response,{intentDigest:r.intentDigest})
test('four real dataset shapes retain fifteen typed measures, correct edition/units and no duplicate on replay or refresh',async()=>{
 const f=await setup();try{
  for(const path of new Set(measures.map(m=>m.data.sourceSelector.path))){const r=await response(path),n=await persist(f,r);assert.equal(n.matched,r.response.items.length);assert.equal((await persist(f,r)).replay,true);assert.equal((await persist(f,await response(path,{value:'0.00'}))).unchanged,r.response.items.length)}
  const events=(await f.api('events')).body.items;assert.equal(events.length,3)
  let total=0
  for(const e of events){const r=await f.api('evidence/'+e.eventId);assert.equal(r.status,200,JSON.stringify(r.body));const list=r.body.results??r.body.items??[];total+=list.length;assert(list.every(x=>x.actual==='0'&&x.previous===null&&x.forecast===null&&x.publishedAt===null));if(e.source.publicationRef!=='eia:wpsr')assert(list.every(x=>x.referencePeriod==='2026-11-09'&&x.unit==='$/GAL'))}
  assert.equal(total,15)
  await assert.rejects(persist(f,await response('petroleum/pri/gnd',{unitOverride:'MBBL'})),{code:'UNCONFIRMED_RESULT_SEMANTICS'})
  await assert.rejects(persist(f,await response('petroleum/pri/gnd',{periodOverride:'2026-11-06'})),{code:'UNCONFIRMED_RESULT_SEMANTICS'})
  await f.e1.calendar.asOwner(owner,q=>q.query("UPDATE economic_calendar.result_storage_policies SET status='REVOKED',version=version+1 WHERE dataset_id='petroleum/pri/gnd'"))
  await assert.rejects(persist(f,await response('petroleum/pri/gnd')),{code:'ECR_RESULT_STORAGE_NOT_ADMITTED'})
 }finally{await f.close()}
})
test('multiple measurements form one publication notification; replay and unchanged snapshots do not create messages',async()=>{
 const f=await setup();try{
  const e=(await f.api('events')).body.items.find(x=>x.source.publicationRef==='eia:wpsr'),p=(await f.api('preferences')).body
  await f.e1.calendar.asOwner(owner,q=>q.query("INSERT INTO economic_calendar.notification_delivery_policy VALUES(true,'ACTIVE','SYNTHETIC_TRANSPORT','SYNTHETIC_QUALIFIER','SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour','SYNTHETIC_ONLY',1)"))
  assert.equal((await f.api('preferences',{method:'PUT',body:{expectedVersion:p.version,preferences:{...p.preferences,publicationWatches:[{publicationId:e.publicationId,approaching:false,results:true,changes:true}]}}})).status,200)
  assert.equal((await f.api('notifications',{method:'PUT',body:{expectedVersion:0,settings:{emailEnabled:true,timeZone:'Europe/Warsaw'}}})).status,200)
  for(const path of ['petroleum/stoc/wstk','petroleum/sum/sndw']){const r=await response(path);await persist(f,r);await persist(f,r);await persist(f,await response(path))}
  const r=await f.e1.calendar.asOwner(owner,q=>q.query("SELECT type,payload,status FROM economic_calendar.notification_outbox"));assert.equal(r.rowCount,1);assert.equal(r.rows[0].type,'results');assert.equal(r.rows[0].status,'PENDING');assert.equal(r.rows[0].payload.results.length,9)
  const revision=await response('petroleum/stoc/wstk',{value:'2'});await persist(f,revision);await persist(f,revision)
  const statuses=(await f.api('notifications')).body.delivery;assert.equal(statuses.PENDING,2)
 }finally{await f.close()}
})
test('enabling email before a historical backfill does not send a backlog of old editions',async()=>{
 const f=await setup({eventAt:new Date(Date.now()-3*86400000).toISOString()});try{
  const e=(await f.api('events')).body.items.find(x=>x.source.publicationRef==='eia:wpsr'),p=(await f.api('preferences')).body
  await f.e1.calendar.asOwner(owner,q=>q.query("INSERT INTO economic_calendar.notification_delivery_policy VALUES(true,'ACTIVE','SYNTHETIC_TRANSPORT','SYNTHETIC_QUALIFIER','SYNTHETIC_ONLY',clock_timestamp()+interval '1 hour','SYNTHETIC_ONLY',1)"))
  await f.api('preferences',{method:'PUT',body:{expectedVersion:p.version,preferences:{...p.preferences,publicationWatches:[{publicationId:e.publicationId,approaching:false,results:true,changes:true}]}}})
  assert.equal((await f.api('notifications',{method:'PUT',body:{expectedVersion:0,settings:{emailEnabled:true,timeZone:'Europe/Warsaw'}}})).status,200)
  await persist(f,await response('petroleum/stoc/wstk'))
  const count=await f.e1.calendar.asOwner(owner,q=>q.query('SELECT count(*)::integer AS count FROM economic_calendar.notification_outbox'));assert.equal(count.rows[0].count,0)
 }finally{await f.close()}
})

// A new owner decision must not rewrite or hide legitimately retained history.
test('historical result bases remain readable only inside the current active licence and series scope',async()=>{
 const f=await setup(),path='petroleum/pri/gnd';try{
  await persist(f,await response(path,{value:'12'}));
  const e=(await f.api('events')).body.items.find(x=>x.source.publicationRef==='eia:gasdiesel');
  const before=await f.e1.calendar.asOwner(owner,q=>q.query("SELECT observation_id,sequence,basis_ref,fingerprint FROM economic_calendar.result_observations WHERE dataset_id=$1 ORDER BY observation_id,sequence",[path]));
  assert.equal(before.rowCount,2);
  await f.e1.calendar.asOwner(owner,q=>q.query("UPDATE economic_calendar.result_storage_policies SET basis_ref='SYNTHETIC_NEW_RESULT_RIGHTS',version=version+1 WHERE dataset_id=$1",[path]));
  const historical=await f.api('evidence/'+e.eventId);assert.equal(historical.status,200);assert.equal(historical.body.results.length,2,'prior legitimate basis stays readable after an owner rights update');
  const unchanged=await f.e1.calendar.asOwner(owner,q=>q.query("SELECT observation_id,sequence,basis_ref,fingerprint FROM economic_calendar.result_observations WHERE dataset_id=$1 ORDER BY observation_id,sequence",[path]));
  assert.deepEqual(unchanged.rows,before.rows,'stored provenance and facts are not rewritten');
  await assert.rejects(f.ingest.query("INSERT INTO economic_calendar.result_observations SELECT (jsonb_populate_record(NULL::economic_calendar.result_observations,to_jsonb(o)||jsonb_build_object('observation_id',o.observation_id||'-old-basis-write'))).* FROM economic_calendar.result_observations o WHERE dataset_id=$1 LIMIT 1",[path]),{code:'42501'},'history read cannot authorize a new write under an old basis');
  await assert.rejects(f.ingest.query('SELECT * FROM economic_calendar.result_storage_policy_history'),{code:'42501'});
  assert.equal((await f.ingest.query("SELECT economic_calendar.result_allowed('eia',$1,$2,'SYNTHETIC_RESULTS','FORGED_BASIS') AS allowed",[path,measures.find(m=>m.data.sourceSelector.path===path).data.sourceSelector.series])).rows[0].allowed,false);
  await persist(f,await response(path,{value:'13',basis:'SYNTHETIC_NEW_RESULT_RIGHTS'}));
  assert.equal((await f.ingest.query('SELECT count(*)::integer AS n FROM economic_calendar.result_observations WHERE dataset_id=$1',[path])).rows[0].n,4);
  const links=(await f.ingest.query('SELECT count(*)::integer AS n FROM economic_calendar.result_links')).rows[0].n;
  await persist(f,await response(path,{value:'13',basis:'SYNTHETIC_NEW_RESULT_RIGHTS'}));
  assert.equal((await f.ingest.query('SELECT count(*)::integer AS n FROM economic_calendar.result_links')).rows[0].n,links,'replayed unchanged values do not create artificial link versions');
  await f.e1.calendar.asOwner(owner,q=>q.query("UPDATE economic_calendar.result_storage_policies SET status='REVOKED',version=version+1 WHERE dataset_id=$1",[path]));
  assert.equal((await f.api('evidence/'+e.eventId)).body.results.length,0,'recorded historical rights never revive a revoked current scope');
  const first=measures.find(m=>m.data.sourceSelector.path===path).data.sourceSelector.series;
  await f.e1.calendar.asOwner(owner,q=>q.query("UPDATE economic_calendar.result_storage_policies SET status='ACTIVE',series_ids=ARRAY[$2]::text[],version=version+1 WHERE dataset_id=$1",[path,first]));
  const visible=(await f.api('evidence/'+e.eventId)).body.results;assert(visible.length>0);assert(visible.every(x=>x.seriesId===first),'historical policy cannot re-admit an excluded series');
  await f.e1.calendar.asOwner(owner,async q=>{
   await q.query("UPDATE economic_calendar.result_storage_policies SET basis_ref='SYNTHETIC_RESULT_RIGHTS',status='REVOKED',version=version+1 WHERE dataset_id=$1",[path]);
   await q.query("UPDATE economic_calendar.result_storage_policies SET basis_ref='SYNTHETIC_NEW_RESULT_RIGHTS',status='ACTIVE',series_ids=$2,version=version+1 WHERE dataset_id=$1",[path,measures.filter(m=>m.data.sourceSelector.path===path).map(m=>m.data.sourceSelector.series)]);
  });
  const afterBasisRevocation=(await f.api('evidence/'+e.eventId)).body.results;assert.equal(afterBasisRevocation.length,2);assert(afterBasisRevocation.every(x=>x.actual==='13'),'a revoked historical basis never revives through another active basis');
 }finally{await f.close()}
})
