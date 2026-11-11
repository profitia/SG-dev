// SYNTHETIC_ONLY: native ECR HTTP projection shape; no provider, account or model request.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createEconomicCalendarContextAdapter,createAssistantContextGateway} from '../src/index.mjs'
import {schedulePayload,correlationKey} from '../../../apps/platform-source-hub/src/providers/publication-schedules.mjs'
import {publicationScheduleObservation,ECR_APPLICATION} from '../../economic-calendar-contracts/index.mjs'
const id='ecr_evt_'+'a'.repeat(64),observationId='ecr_obs_'+'b'.repeat(64)
const reference={version:'2.1.0',source:'ECONOMIC_CALENDAR',from:'2026-11-01T00:00:00.000Z',to:'2026-12-01T00:00:00.000Z',targetType:null,targetId:null,asKnownAt:null,after:null}
const source={provider:'eia',publicationRef:'eia:wpsr',sourceRecordRef:'SYNTHETIC_ONLY',licenceRef:'SYNTHETIC_ONLY',storageBasisRef:'SYNTHETIC_ONLY',rightsVersion:'1',redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY'}
const at='2026-11-10T00:00:00.000Z'
function publication(){return {contract:{id:'profitia.economic-calendar',version:'1.1.0'},semanticContract:'profitia.economic-calendar-semantics/1.0.0',
 projection:'ECONOMIC_CONTEXT',interpretationOwner:'AUTHORISED_CONSUMER',missingValuesMeaning:'UNKNOWN_NOT_ZERO',order:'CANONICAL_EVENT_ID',
 causalityClaim:false,targetStatus:'GLOBAL',nextAfter:null,unresolvedSchedules:[],
 coverage:{completeness:'UNKNOWN',numericHistory:'OBSERVED_BY_ECR_ONLY',publishedAtNotInferred:true,unmappedDefinitions:[],unresolvedDefinitionPageMore:false},
 semanticVersions:[{kind:'rule',id:'rule.synthetic',version:1,status:'accepted'}],
 definitions:[{kind:'concept',id:'concept.synthetic',version:1,status:'accepted',recordedAt:at,data:{namePl:'Dane testowe',nameEn:'Test data',description:'SYNTHETIC_ONLY',geography:'USA'}}],
 items:[{eventId:id,knownAt:at,causalityClaim:false,timeMeaning:'SOURCE_SCHEDULE_NOT_PUBLICATION_CONFIRMATION',
 concept:{id:'concept.synthetic',status:'accepted'},mapping:{status:'accepted',data:{conceptId:'concept.synthetic',provider:'eia',publicationRef:'eia:wpsr',certainty:'CONFIRMED',relation:'EQUIVALENT_DEFINITION'}},relevance:[],
 event:{eventId:id,title:'SYNTHETIC_ONLY WPSR',source,eventAt:'2026-11-12T17:00:00.000Z',eventTimeZone:'America/New_York',publishedAt:null,
  sourceUrl:'https://www.eia.gov/petroleum/supply/weekly/',reference:{providerValue:'2026-11-06'},unit:null,currency:null,
  values:{actual:null,previousAfterRevision:null,previousBeforeRevision:null,consensusForecast:null,vendorForecast:null},
  schedule:{timePrecision:'INSTANT',scheduledAt:'2026-11-12T17:00:00.000Z',dateOnly:'2026-11-12',localDateTime:null,timeZone:'America/New_York',scheduleStatus:'RULE_DERIVED_UNCONFIRMED',qualityFlags:['UNCONFIRMED_RULE'],officialSource:true}},
 results:[{observationId,sequence:1,eventId:id,measureId:'measure.synthetic',seriesId:'SYNTHETIC_ONLY',referencePeriod:'2026-11-06',unit:'MBBL',geography:'USA',actual:'0',previous:null,forecast:null,revised:null,
  publishedAt:null,sourceUpdatedAt:null,sourceRetrievedAt:at,observedAt:at,receiptRef:'SYNTHETIC_ONLY',sourceRecordRef:'SYNTHETIC_ONLY',sourceUrl:'https://api.eia.gov/v2/',licenceRef:'SYNTHETIC_ONLY',storageBasisRef:'SYNTHETIC_ONLY',rightsVersion:'1',correlationStatus:'CONFIRMED',valueMeaning:'CURRENT_SNAPSHOT_NOT_PUBLICATION_VINTAGE'}]}]}}
const input={reference,organisationId:'SYNTHETIC_ONLY',request:{},observedAt:at}
// Exercise the actual SourceHub -> ECR projection, without network or credentials.
function nativeSchedule(precision){
 const window=precision==='TIME_WINDOW',provider=window?'eia':'commodities-sh',publicationRef=window?'eia:steo':'SYNTHETIC_ONLY:monthly'
 const payload=schedulePayload({title:'SYNTHETIC_ONLY native schedule',publicationRef,
  correlationKey:correlationKey(provider,publicationRef,'https://www.eia.gov/outlooks/steo/'),
  timePrecision:precision,recurrence:'monthly',referencePeriod:window?'2026-11':null,
  scheduledAt:window?'2026-11-10T17:00:00.000Z':null,scheduledUntil:window?'2026-11-10T17:15:00.000Z':null,
  dateOnly:window?'2026-11-10':null,timeZone:window?'America/New_York':null,
  scheduleStatus:window?'OFFICIAL_DATED':'UNDATED',sourceUrl:'https://www.eia.gov/outlooks/steo/'})
 return publicationScheduleObservation({payload,metadata:{providerId:provider,contractVersion:'1.3.0',contractFamily:'publication-calendar',apiFamily:'publication-calendar',
  retrievedAt:at,usageReceiptRef:'12345678-1234-4123-8123-123456789abc',contentFingerprint:'c'.repeat(64),licenceRef:'SYNTHETIC_ONLY',sourceRecordRef:'SYNTHETIC_ONLY',
  consumerStorage:{mode:'DURABLE_OWNER_ENTITLEMENT',basisRef:'SYNTHETIC_ONLY',licenceVersion:'1',rightsVersion:'1',consumerApplicationId:ECR_APPLICATION,
   retentionMode:'DURABLE_NO_FIXED_EXPIRY',redistribution:'PRIVATE_AUTHORISED_CONSUMER_ONLY'}}})
}
test('native ECR release windows retain both endpoints and recurrence without becoming publication evidence',async()=>{
 const native=nativeSchedule('TIME_WINDOW'),raw=publication(),item=raw.items[0]
 item.eventId=native.event.eventId;item.event=native.event.data;item.results=[]
 item.mapping.data.publicationRef='eia:steo'
 const result=await createEconomicCalendarContextAdapter({readAuthorised:async()=>raw}).read(input),s=result.data.events[0].schedule
 assert.equal(s.timePrecision,'TIME_WINDOW');assert.equal(s.scheduledAt,'2026-11-10T17:00:00.000Z');assert.equal(s.scheduledUntil,'2026-11-10T17:15:00.000Z')
 assert.equal(s.recurrence,'monthly');assert.equal(result.data.events[0].publishedAt,null);assert.equal(result.status,'PARTIAL')
 for(const until of [null,'2026-11-10T17:00:00.000Z','2026-11-10T16:59:00.000Z']){
  const bad=structuredClone(raw);bad.items[0].event.schedule.scheduledUntil=until
  await assert.rejects(createEconomicCalendarContextAdapter({readAuthorised:async()=>bad}).read(input))
 }
})
test('native recurrence-only ECR definitions remain undated and do not suppress the whole context',async()=>{
 const native=nativeSchedule('RECURRENCE_ONLY'),raw=publication();assert.equal(native.event,null)
 raw.items=[];raw.definitions=[];raw.unresolvedSchedules=[{publication:{...native.publication.data,knownAt:at}}]
 const result=await createEconomicCalendarContextAdapter({readAuthorised:async()=>raw}).read(input),s=result.data.unresolvedSchedules[0].schedule
 assert.equal(s.timePrecision,'RECURRENCE_ONLY');assert.equal(s.recurrence,'monthly');assert.equal(s.scheduledAt,null);assert.equal(s.scheduledUntil,null)
 assert.equal(s.dateOnly,null);assert.equal(result.data.events.length,0);assert.equal(result.status,'PARTIAL')
})
test('undated publication definitions cannot displace dated ECR events from the bounded context',async()=>{
 const raw=publication(),definition=nativeSchedule('RECURRENCE_ONLY').publication.data
 raw.unresolvedSchedules=Array.from({length:30},(_,i)=>({publication:{...definition,
  publicationId:'ecr_pub_'+i.toString(16).padStart(64,'0'),title:'SYNTHETIC_ONLY '+String(i)+'x'.repeat(1000),knownAt:at}}))
 const result=await createEconomicCalendarContextAdapter({readAuthorised:async()=>raw}).read(input)
 assert.equal(result.data.events.length,1);assert.equal(result.data.events[0].eventId,id)
 assert.equal(result.data.omitted.events,0);assert(result.data.omitted.unresolvedSchedules>0)
 assert.equal(result.status,'PARTIAL');assert(Buffer.byteLength(JSON.stringify(result))<16000)
})
test('ECR preserves missing values, precision, native source evidence and stable versions across read clocks',async()=>{
 const raw=publication();raw.privatePreferences={secret:'NEVER_RELEASE'};raw.items[0].event.identity={secret:'NEVER_RELEASE'}
 let calls=0
 const adapter=createEconomicCalendarContextAdapter({readAuthorised:async x=>{calls++;assert.equal(x.organisationId,input.organisationId);return raw}})
 const a=await adapter.read(input),b=await adapter.read({...input,observedAt:'2026-11-11T00:00:00.000Z'})
 assert.equal(calls,2);assert.equal(a.status,'PARTIAL');assert.equal(a.sourceVersion,b.sourceVersion)
 assert.equal(a.data.events[0].values.actual,null);assert.equal(a.data.events[0].results[0].actual,'0')
 assert.equal(a.data.events[0].results[0].publishedAt,null);assert.equal(a.data.events[0].schedule.scheduleStatus,'RULE_DERIVED_UNCONFIRMED')
 assert.equal(a.data.events[0].source.licenceRef,'SYNTHETIC_ONLY');assert.equal(a.data.coverage.completeness,'UNKNOWN')
 assert(!JSON.stringify(a).includes('NEVER_RELEASE'));assert(Buffer.byteLength(JSON.stringify(a))<16000)
 raw.items[0].results[0].actual='1';assert.notEqual((await adapter.read(input)).sourceVersion,a.sourceVersion)
})
test('ECR rejects incorrect contracts, provenance, causal claims, target mismatches, times and unsafe links',async()=>{
 const mutations=[r=>r.projection='TIMELINE',r=>r.contract.version='99',r=>r.causalityClaim=true,r=>r.missingValuesMeaning='ZERO',
  r=>r.items[0].mapping.data.provider='other',r=>r.items[0].mapping.data.relation='UNRESOLVED',r=>r.items[0].event.eventAt='2025-01-01T00:00:00Z',
  r=>r.items[0].event.sourceUrl='javascript:alert(1)',r=>r.items[0].results[0].eventId='other',r=>r.items[0].results[0].valueMeaning='NATIVE_PUBLICATION_VINTAGE',
  r=>r.items.push(structuredClone(r.items[0])),r=>r.targetStatus='RECOGNISED']
 for(const mutate of mutations){const raw=publication();mutate(raw);const adapter=createEconomicCalendarContextAdapter({readAuthorised:async()=>raw});await assert.rejects(adapter.read(input))}
 let calls=0;const adapter=createEconomicCalendarContextAdapter({readAuthorised:async()=>{calls++;return publication()}})
 assert.equal((await adapter.read({...input,reference:null})).status,'EMPTY');assert.equal(calls,0)
 const abort=new AbortController();abort.abort();await assert.rejects(adapter.read({...input,signal:abort.signal}));assert.equal(calls,0)
 await assert.rejects(adapter.read({...input,reference:{version:'2.0.0',source:'NEWSFEED',observationId:null,supplierNip:null}}));assert.equal(calls,0)
})
test('ECR retains explicit pagination and omissions within the model budget, without asserting complete coverage',async()=>{
 const raw=publication();raw.nextAfter='ecr_evt_'+'f'.repeat(64)
 raw.items=Array.from({length:8},(_,i)=>{const x=structuredClone(raw.items[0]);const n='ecr_evt_'+String(i).repeat(64);x.eventId=n;x.event.eventId=n;x.results[0].eventId=n;x.event.title='SYNTHETIC_ONLY '+'x'.repeat(1000);return x})
 const a=await createEconomicCalendarContextAdapter({readAuthorised:async()=>raw}).read(input)
 assert.equal(a.status,'PARTIAL');assert.equal(a.data.nextAfter,raw.nextAfter);assert(a.data.omitted.events>0)
 assert.equal(a.data.events.length+a.data.omitted.events,8);assert(Buffer.byteLength(JSON.stringify(a))<16000)
 const empty=publication();empty.items=[];empty.definitions=[]
 const e=await createEconomicCalendarContextAdapter({readAuthorised:async()=>empty}).read(input)
 assert.equal(e.status,'EMPTY');assert.equal(e.data.coverage.completeness,'UNKNOWN')
})
test('a revoked ECR read is DENIED at the gateway; no provider or knowledge fallback exists',async()=>{
 const adapter=createEconomicCalendarContextAdapter({readAuthorised:async()=>{throw {reasonCode:'PERMISSION_DENIED'}}})
 const g=createAssistantContextGateway({adapters:[adapter]})
 const r=await g.resolve({plan:[{source:'ECONOMIC_CALENDAR',selection:'ACTIVE_VIEW'}],reference,organisationId:'SYNTHETIC_ONLY',request:{}})
 assert.deepEqual(r.contexts,[{source:'ECONOMIC_CALENDAR',status:'DENIED'}])
})
test('the ECR projection fits the admitted history record bound as well as the byte bound',async()=>{
 const r=publication(),schedule={timePrecision:'DATE',scheduledAt:null,dateOnly:'2026-11-12',localDateTime:null,timeZone:null,scheduleStatus:'PROVIDER_REPORTED',qualityFlags:[],officialSource:false}
 r.unresolvedSchedules=Array.from({length:40},(_,i)=>({publication:{publicationId:'ecr_pub_'+i.toString(16).padStart(64,'0'),title:'SYNTHETIC_ONLY',knownAt:at,source,sourceUrl:'https://www.eia.gov/',releaseIdentityStatus:'UNRESOLVED_NEXT_RELEASE',unresolvedNextSchedule:schedule}}))
 const result=await createEconomicCalendarContextAdapter({readAuthorised:async()=>r}).read(input),d=result.data
 assert(d.events.length+d.events.reduce((n,e)=>n+e.results.length,0)+d.unresolvedSchedules.length<=32)
 assert(d.omitted.unresolvedSchedules>0);assert.equal(result.status,'PARTIAL');assert(Buffer.byteLength(JSON.stringify(result))<16000)
})
