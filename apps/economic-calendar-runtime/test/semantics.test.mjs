// SYNTHETIC_ONLY: actual local PostgreSQL/E1; no provider requests or LIVE claim.
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {fixture,A,B} from './fixtures.mjs'
import {curate,semanticSnapshot} from '../src/semantics.mjs'
import {semanticChange} from '../../../packages/economic-calendar-contracts/semantic.mjs'
import {persistAcquisition} from '../src/repository.mjs'
import {persistResults} from '../src/results.mjs'
import {fingerprint} from '@profitia/economic-calendar-contracts'
import {schedulePayload,scheduleRecord,scheduleAnswer} from '../../platform-source-hub/src/providers/publication-schedules.mjs'
const seed=JSON.parse(readFileSync(new URL('../operations/semantic-bootstrap.json',import.meta.url)))
export async function curateSeed(f){return f.e1.calendar.asOwner('economic_calendar_development_owner',async t=>{for(const e of seed)await curate(t,e)})}
export function syntheticSchedule(provider='eia',period='2026-11-06'){
 const command={contractVersion:'1.3.0',provider,family:'publication-calendar',operation:'calendar',criteria:provider==='eia'?{publication:'wpsr',from:'2026-10-01',to:'2026-12-31',limit:1000}:{limit:1000}}
 const receipt=randomUUID(),p=schedulePayload({title:'SYNTHETIC_ONLY WPSR',publicationRef:provider==='eia'?'eia:wpsr':'commodities-sh:eia-wpsr',correlationKey:fingerprint({provider,period}),
  scheduleId:provider==='eia'?null:'eia-wpsr',identityStatus:provider==='eia'?'OFFICIAL_PUBLICATION_DEFINITION':'PROVIDER_ID',timeZone:'America/New_York',timePrecision:provider==='eia'?'INSTANT':'DATE',
  scheduledAt:provider==='eia'?'2026-11-12T17:00:00.000Z':null,dateOnly:'2026-11-12',referencePeriod:provider==='eia'?period:null,recurrence:'weekly',officialSource:provider==='eia',scheduleStatus:provider==='eia'?'OFFICIAL_EXCEPTION':'PROVIDER_REPORTED',exception:provider==='eia'?{reason:'SYNTHETIC_ONLY holiday',standardDate:'2026-11-11'}:null})
 const item=scheduleRecord(provider,'SYNTHETIC_ONLY',p,provider==='eia'?'https://www.eia.gov/petroleum/supply/weekly/schedule.php':'https://api.commodities.sh/v1/calendar')
 Object.assign(item.metadata,{retrievedAt:'2026-11-10T00:00:00.000Z',licenceRef:'SYNTHETIC_ONLY_'+provider,usageReceiptRef:receipt,retentionUntil:null,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY',consumerStorage:{mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:'SYNTHETIC_ONLY_STORAGE',licenceVersion:'1',rightsVersion:'1',consumerApplicationId:'profitia-economic-calendar-runtime-development',retentionMode:'DURABLE_NO_FIXED_EXPIRY',redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY'}})
 const response=scheduleAnswer(provider,[item],{contractVersion:'1.3.0',limit:1000});response.provenance={retrievedAt:item.metadata.retrievedAt,licenceRef:item.metadata.licenceRef,qualityStatus:'UNKNOWN'};response.usage={receiptRef:receipt,upstreamAttempts:1,cacheHit:false};return {command,response}
}
export async function storeSchedules(f){
 await f.e1.calendar.asOwner('economic_calendar_development_owner',async q=>{for(const p of ['eia','commodities-sh'])await q.query("SELECT economic_calendar.set_storage_policy(0,$1,$2,'SYNTHETIC_ONLY_STORAGE','ACTIVE')",[p,'SYNTHETIC_ONLY_'+p])})
 for(const p of ['eia','commodities-sh']){const {command,response}=syntheticSchedule(p);await persistAcquisition(f.ingest,command,response)}
}
export function syntheticResults({value='0',retrieved='2026-11-10T01:00:00.000Z',period='2026-11-06'}={}){
 const command={contractVersion:'1.4.0',provider:'eia',family:'series-observations',operation:'observations',criteria:{path:'petroleum/stoc/wstk',frequency:'weekly',data:['value'],facets:{series:['WCESTUS1','WGTSTUS1'],duoarea:['NUS']},limit:10}}
 const receipt=randomUUID(),items=['WCESTUS1','WGTSTUS1'].map((series,i)=>{const p={datasetId:'petroleum/stoc/wstk',referencePeriod:period,frequency:'weekly',dimensions:{series,duoarea:'NUS'},measures:[{field:'value',value:i?null:value,unit:'MBBL',currency:null}],observedAt:null,publishedAt:null,revisionStatus:'PROVIDER_CURRENT_SNAPSHOT_NOT_VINTAGE',upstreamApiVersion:'SYNTHETIC_ONLY'};return {payload:p,metadata:{contractFamily:'series-observations',contractVersion:'1.4.0',providerId:'eia',apiFamily:'series-observations',endpointVersion:'v2-data',vendorRecordId:null,sourceRecordRef:'SYNTHETIC_ONLY_'+series,sourceUrl:'https://api.eia.gov/v2/petroleum/stoc/wstk/data/',retrievedAt:retrieved,availableAt:null,asOf:null,licenceRef:'SYNTHETIC_ONLY_RESULTS',qualityStatus:'UNKNOWN',contentFingerprint:fingerprint(p),usageReceiptRef:receipt,retentionUntil:null,redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY',consumerStorage:{mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:'SYNTHETIC_ONLY_RESULTS_OWNER',licenceVersion:'1',rightsVersion:'1',consumerApplicationId:'profitia-economic-calendar-runtime-development',retentionMode:'DURABLE_NO_FIXED_EXPIRY',redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY',scope:{datasetId:'petroleum/stoc/wstk',seriesIds:['WCESTUS1','WGTSTUS1'],fields:['value'],frequency:'weekly',geography:'NUS'}}}}})
 return {command,response:{contractVersion:'1.4.0',provider:'eia',family:'series-observations',status:'ok',items,page:{page:1,pageSize:10,total:2,more:false,truncated:false},provenance:{retrievedAt:retrieved,licenceRef:'SYNTHETIC_ONLY_RESULTS',qualityStatus:'UNKNOWN'},usage:{receiptRef:receipt,upstreamAttempts:1,cacheHit:false},coverage:{scope:'PROVIDER_RETURNED_SUBSET',completeness:'UNKNOWN',providerReturned:2,matchedLocally:2,returned:2,nativeFilters:['series'],localFilters:[]}}}
}
test('semantic contract rejects tenant ownership, unsupported fields and unconfirmed accepted source equivalence',()=>{
 assert(seed.every(e=>semanticChange(e)))
 assert.throws(()=>semanticChange({...seed[0],data:{...seed[0].data,organisationId:A}}))
 const m=seed.find(e=>e.kind==='mapping');assert.throws(()=>semanticChange({...m,data:{...m.data,certainty:'SUGGESTED'}}))
 assert.throws(()=>semanticChange({...seed[0],evidence:[]}))
})
test('global meaning and versioned relevance survive independent users/orgs, replay, retirement and historical cutoffs',async()=>{
 const f=await fixture({seed:false});try{
  await storeSchedules(f);const before=new Date().toISOString();await curateSeed(f)
  assert.equal((await f.api('knowledge?asKnownAt='+encodeURIComponent(before))).body.items.length,0)
  const k=(await f.api('knowledge')).body;assert.equal(k.items.length,21)
  await assert.rejects(f.ingest.query('INSERT INTO economic_calendar.semantic_revisions SELECT * FROM economic_calendar.semantic_revisions'),e=>e.code==='42501')
  await f.e1.calendar.asOwner('economic_calendar_development_owner',async t=>{for(const e of seed){const r=await curate(t,{...e,expectedVersion:1});assert.equal(r.changed,false)}})
  const q='?targetType=BENCHMARK_SERIES&targetId='+encodeURIComponent('MACROBOND:b_c1_cl')+'&from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z'
  const count=f.e1.transportState.calls,clerk=f.e1.clerkState.calls.length,a=await f.api('timeline'+q)
  assert.equal(a.status,200,JSON.stringify(a.body));assert.equal(a.body.items.length,1);assert.equal(a.body.unresolvedSchedules.length,1)
  assert.equal(a.body.items[0].relevance[0].data.level,'STRONG');assert.equal(a.body.items[0].results.length,0)
  assert.equal(f.e1.transportState.calls-count,2);assert.equal(f.e1.clerkState.calls.length-clerk,6)
  const b=await f.api('timeline'+q,{organisation:B});assert.deepEqual(a.body.items,b.body.items)
  const c=await f.api('context'+q);assert.deepEqual(c.body.items,a.body.items);assert.equal(c.body.causalityClaim,false)
  assert.equal((await f.api('timeline'+q,{organisation:'33333333-3333-4333-8333-333333333333'})).status,403)
  const cutoff=new Date().toISOString(),rel=seed.find(e=>e.id==='ecr.relevance.wpsr.brent-ice')
  await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>curate(q,{...rel,expectedVersion:1,status:'retired'}))
  assert.equal((await f.api('timeline'+q)).body.items.length,0)
  assert.equal((await f.api('timeline'+q+'&asKnownAt='+encodeURIComponent(cutoff))).body.items.length,1)
  const history=await f.api('knowledge/'+rel.id+'/revisions');assert.equal(history.body.items.length,2)
  await assert.rejects(f.e1.calendar.asOwner('economic_calendar_development_owner',q=>curate(q,{...rel,expectedVersion:1})),{code:'SEMANTIC_VERSION_CONFLICT'})
 }finally{await f.close()}
})
test('licensed multi-measure results correlate only exact reference periods; zero/null, revisions, rollback, stale data and revocation remain distinct',async()=>{
 const f=await fixture({seed:false});try{
  await storeSchedules(f);await curateSeed(f)
  const input=syntheticResults(),persist=x=>persistResults(f.ingest,x.command,x.response,{intentDigest:fingerprint(x.response.usage.receiptRef)})
  await assert.rejects(persist(input),{code:'ECR_RESULT_STORAGE_NOT_ADMITTED'})
  await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query("INSERT INTO economic_calendar.result_storage_policies VALUES('eia','series-observations','petroleum/stoc/wstk',ARRAY['WCESTUS1','WGTSTUS1'],'SYNTHETIC_ONLY_RESULTS','SYNTHETIC_ONLY_RESULTS_OWNER',1,'ACTIVE','DURABLE_NO_FIXED_EXPIRY','PRIVATE_AUTHORISED_CONSUMER_ONLY')"))
  const r=await persist(input);assert.equal(r.created,2);assert.equal(r.matched,2);assert.equal((await persist(input)).replay,true)
  let timeline=await f.api('timeline'),id=timeline.body.items[0].eventId
  assert.equal(timeline.body.items[0].results.length,2);assert(timeline.body.items[0].results.some(r=>r.actual==='0'));assert(timeline.body.items[0].results.some(r=>r.actual===null))
  assert(timeline.body.items[0].results.every(r=>r.publishedAt===null&&r.previous===null&&r.forecast===null&&r.revised===null))
  const cutoff=new Date().toISOString();assert.equal((await persist(syntheticResults({value:'0.0',retrieved:'2026-11-10T02:00:00Z'}))).unchanged,2)
  assert.equal((await persist(syntheticResults({value:'4',retrieved:'2026-11-10T03:00:00Z'}))).changed,1)
  assert.equal((await persist(syntheticResults({value:'2',retrieved:'2026-11-10T01:30:00Z'}))).stale,1)
  timeline=await f.api('timeline?asKnownAt='+encodeURIComponent(cutoff));assert(timeline.body.items[0].results.some(r=>r.actual==='0'))
  assert.equal((await f.api('evidence/'+id)).body.results.find(r=>r.seriesId==='WCESTUS1').actual,'4')
  const outside=syntheticResults({period:'2020-01-03'});assert.equal((await persist(outside)).unresolved,2)
  const sourceVersionsBefore=(await f.ingest.query('SELECT count(*) FROM economic_calendar.result_observations')).rows[0].count
  const late=syntheticSchedule('eia','2020-01-03');await persistAcquisition(f.ingest,late.command,late.response)
  assert.equal((await f.ingest.query('SELECT count(*) FROM economic_calendar.result_observations')).rows[0].count,sourceVersionsBefore)
  const linked=await f.ingest.query("SELECT l.status FROM economic_calendar.result_links l JOIN economic_calendar.result_observations o ON o.observation_id=l.observation_id AND o.sequence=l.source_sequence WHERE o.reference_period='2020-01-03' ORDER BY l.version")
  assert(linked.rows.some(r=>r.status==='UNRESOLVED_EDITION'));assert(linked.rows.some(r=>r.status==='MATCHED_REFERENCE_PERIOD'))
  const history=await f.api('evidence/'+id+'/revisions');assert.equal(history.status,200);assert(history.body.items.some(r=>r.change_kind==='VALUE_CHANGED'));assert(history.body.editionLinkHistory.length)
  const malformed=syntheticResults();malformed.response.items[0].payload.secret='REFUSE';await assert.rejects(persist(malformed))
  await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query("UPDATE economic_calendar.result_storage_policies SET status='REVOKED',version=version+1"))
  assert.equal((await f.api('evidence/'+id)).body.results.length,0);await assert.rejects(persist(syntheticResults()),{code:'ECR_RESULT_STORAGE_NOT_ADMITTED'})
  await assert.rejects(f.ingest.query('SELECT * FROM economic_calendar.preferences'),e=>e.code==='42501')
 }finally{await f.close()}
})
test('exact owner activation SQL installs only four durable jobs and one result policy, and refuses drift, foreign targets and replay',async()=>{
 const f=await fixture({seed:false});try{
  const plan=JSON.parse(readFileSync(new URL('../operations/stage04-05-owner-plan.json',import.meta.url))),sql=readFileSync(new URL('../operations/activate-stage04-05.sql',import.meta.url),'utf8')
  assert.deepEqual(JSON.parse(sql.match(/expected jsonb:=\$plan\$([\s\S]*?)\$plan\$::jsonb/)[1]),plan)
  const decision='owner-decision:sha256:'+'1'.repeat(64)
  const activate=(p=plan,source=sql)=>f.e1.calendar.asOwner('economic_calendar_development_owner',async t=>{await t.query("SELECT set_config('ecr.stage0405_plan',$1,true),set_config('ecr.stage0405_owner_ref',$2,true)",[JSON.stringify(p),decision]);await t.query(source)})
  await assert.rejects(activate(),/EXACT_ECR_STAGE0405_STORAGE_REQUIRED/)
  await f.e1.calendar.asOwner('economic_calendar_development_owner',t=>t.query('UPDATE economic_calendar.installation SET project_id=$1,branch_id=$2',[plan.store.projectId,plan.store.branchId]))
  const syntheticSql=sql.replace("current_database()<>'economic_calendar_development'","current_database()<>'"+f.configuration.databaseName+"'")
  await assert.rejects(activate({...plan,numericStorage:{...plan.numericStorage,seriesIds:['UNAPPROVED']}},syntheticSql),/EXACT_STAGE0405_OWNER_DECISION_REQUIRED/)
  await activate(plan,syntheticSql)
  assert.equal((await f.ingest.query('SELECT count(*) FROM economic_calendar.sync_jobs')).rows[0].count,'4')
  const policies=(await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query('SELECT * FROM economic_calendar.result_storage_policies'))).rows
  assert.equal(policies.length,1);assert.deepEqual(policies[0].series_ids,['WCESTUS1','WGTSTUS1'])
  assert.equal((await f.e1.calendar.asOwner('economic_calendar_development_owner',q=>q.query('SELECT count(*) FROM economic_calendar.result_storage_policy_history'))).rows[0].count,'1')
  await assert.rejects(activate(plan,syntheticSql),/STAGE0405_ALREADY_PRESENT_RECONCILE/)
 }finally{await f.close()}
})
