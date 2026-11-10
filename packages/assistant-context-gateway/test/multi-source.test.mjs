import test from 'node:test'
import assert from 'node:assert/strict'
import {contextReferences,readContextReference,readContextSelection} from '../../assistant-context-contracts/src/index.mjs'
import {createAssistantContextGateway,createForecastContextAdapter,createSupplierContextAdapter,createNewsfeedContextAdapter} from '../src/index.mjs'
const supplier={version:'2.0.0',source:'SRM_XRAY',nip:'5250001009',entityType:'COMPANY',krs:'0000000001',year:2025,comparisonYear:2024,statementScope:'standalone',sourceVersion:null}
const forecast={version:'2.0.0',source:'FORECAST_CORE',seriesId:'oil',modelIds:['arima','ets'],targetBasis:'POINT_IN_TIME',sourceFrequency:null,targetCadence:null,verification:true}
const news={version:'2.0.0',source:'NEWSFEED',observationId:null,supplierNip:supplier.nip}
const reference={version:'2.0.0',source:'CONTEXT_SELECTION',references:[supplier,forecast,news]}
const plan=sources=>sources.map(source=>({source,selection:'ACTIVE_VIEW'}))
const input={reference,request:{verifiedSession:'host-only'},organisationId:'org',plan:plan(['SRM_XRAY','FORECAST_CORE','NEWSFEED'])}
test('versioned references refuse browser facts, grants, duplicate producers and invalid selections',()=>{
 assert.equal(contextReferences(reference).length,3)
 for(const key of ['allow','organisationId','financialSummary','values'])assert.throws(()=>readContextReference({...supplier,[key]:true}))
 assert.throws(()=>readContextSelection({...reference,references:[supplier,supplier]}))
 assert.throws(()=>readContextReference({...forecast,modelIds:['ets','ets']}))
 assert.throws(()=>readContextReference({...forecast,targetBasis:'POINT_IN_TIME',sourceFrequency:'MONTHLY',targetCadence:'MONTHLY'}))
 assert.throws(()=>readContextReference({...news,supplierNip:'same company name'}))
})
test('one demand reads only its matching selection and reauthorises on each resolve',async()=>{
 let calls=0
 const g=createAssistantContextGateway({adapters:[{source:'SRM_XRAY',async read(i){calls++;assert.deepEqual(i.reference,supplier);assert.equal(i.request,input.request);return {source:'SRM_XRAY',status:'OK'}}},
  {source:'NEWSFEED',read:async()=>assert.fail('Undemanded source read')}]})
 await g.resolve({...input,plan:plan(['SRM_XRAY'])});await g.resolve({...input,plan:plan(['SRM_XRAY'])});assert.equal(calls,2)
 assert.throws(()=>readContextSelection({...reference,actorId:'someone-else'}))
 await assert.rejects(()=>g.resolve({...input,plan:plan(['SRM_XRAY','SRM_XRAY'])}))
})
test('denied producer does not leak its exception or stop a healthy producer; aggregate context is bounded',async()=>{
 const g=createAssistantContextGateway({adapters:[{source:'SRM_XRAY',read:async()=>{throw Object.assign(Error('private financial value'),{reasonCode:'PERMISSION_DENIED'})}},
  {source:'NEWSFEED',read:async()=>({source:'NEWSFEED',status:'EMPTY'})}]})
 const r=await g.resolve({...input,plan:plan(['SRM_XRAY','NEWSFEED'])})
 assert.deepEqual(r.contexts,[{source:'SRM_XRAY',status:'DENIED'},{source:'NEWSFEED',status:'EMPTY'}])
 const large=createAssistantContextGateway({adapters:['SRM_XRAY','NEWSFEED'].map(source=>({source,read:async()=>({source,status:'OK',data:'x'.repeat(13000)})}))})
 const bounded=await large.resolve({...input,plan:plan(['SRM_XRAY','NEWSFEED'])})
 assert.equal(bounded.contexts[0].status,'OK');assert.deepEqual(bounded.contexts[1],{source:'NEWSFEED',status:'UNAVAILABLE'})
})
test('forecast preserves model, input date, generation, horizon, units and verification without a recomputation',async()=>{
 const current=modelId=>({status:'AVAILABLE',benchmark:{benchmarkId:'oil',unit:'barrel',currency:'USD'},model:{id:modelId,selectedCandidate:'producer variant'},
  forecastMethod:{id:'ROLLING_DAILY_POINT_IN_TIME',version:'producer-v1'},audit:{generatedAt:'2026-11-09T10:00:00Z',sourceLatestObservationDate:'2026-11-08',sourceHistoryFingerprint:'a'.repeat(64)},
  origin:{date:'2026-11-08',value:100},anchors:[{horizon:'1M',targetCalendarDate:'2026-12-08',pointForecast:modelId==='arima'?105:103,band:null}]})
 const adapter=createForecastContextAdapter({readAuthorised:async()=>({models:forecast.modelIds.map(modelId=>({modelId,current:current(modelId),verification:{status:'NOT_AVAILABLE',seriesId:'oil',modelId,reason:'Not prepared',historicalVerification:{status:'NOT_PREPARED'}}}))})})
 const g=createAssistantContextGateway({adapters:[adapter]})
 const value=(await g.resolve({...input,plan:plan(['FORECAST_CORE'])})).contexts[0]
 assert.equal(value.status,'OK');assert.equal(value.data.models[0].targets[0].value,105);assert.equal(value.data.models[1].targets[0].value,103)
 assert.equal(value.data.models[0].unit,'barrel');assert.equal(value.data.models[0].inputAsOf,'2026-11-08');assert.equal(value.asOf,'2026-11-09T10:00:00Z')
 assert.equal(value.data.models[0].verification.status,'NOT_AVAILABLE')
})
test('SRM requires authoritative identity and exact selected year and statement scope',async()=>{
 let publication={version:'srm-assistant-summary-v1',identity:{nip:supplier.nip,krs:supplier.krs,entityType:'COMPANY'},selection:{year:2025,comparisonYear:2024,statementScope:'standalone'},status:'PARTIAL',asOf:null,financial:{},kys:{status:'DENIED'}}
 const g=createAssistantContextGateway({adapters:[createSupplierContextAdapter({readAuthorised:async()=>publication})]})
 assert.equal((await g.resolve({...input,plan:plan(['SRM_XRAY'])})).contexts[0].status,'PARTIAL')
 publication={...publication,selection:{...publication.selection,statementScope:'consolidated'}}
 const rejected=(await g.resolve({...input,plan:plan(['SRM_XRAY'])})).contexts[0]
 assert.equal(rejected.status,'UNAVAILABLE');assert.equal(rejected.data,undefined)
})
test('Newsfeed matches exact NIP only; similar names stay unconfirmed, all four dates retain their meaning',async()=>{
 const observation=subject=>({id:'abc',name:'Observation',subjectKind:'company',subject,status:'ACTIVE',version:1,
  createdAt:'2026-11-01T00:00:00Z',updatedAt:'2026-11-02T00:00:00Z',runs:[{createdAt:'2026-11-02T00:00:00Z',status:'SUCCEEDED'}],
  publications:[{id:'publication',provider:'stored',url:'https://example.com/article',headline:'Registered publication',
   publishedAt:'2026-10-31T00:00:00Z',discoveredAt:'2026-11-01T00:00:00Z',detectedAt:'2026-11-02T00:00:00Z',publicationStatus:'SEEN'}]})
 let subject='Company with similar name'
 const g=createAssistantContextGateway({adapters:[createNewsfeedContextAdapter({readAuthorised:async()=>({version:'newsfeed-assistant-read-v1',status:'OK',observations:[observation(subject)]})})]})
 assert.equal((await g.resolve({...input,plan:plan(['NEWSFEED'])})).contexts[0].status,'EMPTY')
 subject='NIP: '+supplier.nip
 const value=(await g.resolve({...input,plan:plan(['NEWSFEED'])})).contexts[0],o=value.data.observations[0]
 assert.equal(o.identityMatch,'EXACT_NIP');assert.equal(o.publications[0].publishedAt,'2026-10-31T00:00:00Z')
 assert.equal(o.publications[0].acquiredAt,'2026-11-01T00:00:00Z');assert.equal(o.publications[0].observedAt,'2026-11-02T00:00:00Z')
 assert.equal(o.runs[0].createdAt,'2026-11-02T00:00:00Z')
})

