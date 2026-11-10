import test from 'node:test'
import assert from 'node:assert/strict'
import {createAssistantSourceAdapters} from '../lib/assistant/sources'
import targets from '../deployment/assistant-m2-targets.json'
import {currentForecastUnavailable} from '../lib/platform/forecast-current'
import {forecastVerificationUnavailable} from '../lib/platform/forecast-verification'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'

const organisationId='11111111-1111-4111-8111-111111111111'
const supplier={version:'2.0.0',source:'SRM_XRAY',nip:'8650004194',entityType:'COMPANY',krs:null,year:2025,comparisonYear:2024,statementScope:'standalone',sourceVersion:null}
const news={version:'2.0.0',source:'NEWSFEED',observationId:null,supplierNip:supplier.nip}
const request=new Request('https://app.fixture.test/api/assistant/conversation',{headers:{authorization:'Bearer synthetic-test-token',cookie:'private=must-not-cross',origin:'https://untrusted.fixture.test','x-actor-id':'untrusted','x-profitia-organisation-id':'untrusted'}})
const observedAt='2026-11-10T00:00:00.000Z'
const privacy={'cache-control':'private, no-store',vary:'Cookie, Authorization'}
const response=(value:unknown,headers:Record<string,string>=privacy)=>Response.json(value,{headers})
const summary={version:'srm-assistant-summary-v1',identity:{nip:supplier.nip,entityType:'COMPANY',krs:null},selection:{year:2025,comparisonYear:2024,statementScope:'standalone'},status:'PARTIAL',asOf:null,kys:{status:'DENIED'}}
const demand=(reference:unknown,changes:Record<string,unknown>={})=>({reference,organisationId,request,observedAt,...changes})

test('peer reads use pinned producer GET routes and the original bearer; browser authority and cookies never cross',async()=>{
 const calls:Array<{url:URL;init:RequestInit}>=[]
 const adapters=createAssistantSourceAdapters({enabled:true,organisationId,fetcher:async(input,init)=>{
  calls.push({url:new URL(String(input)),init:init!})
  return response(calls.length===1?summary:{version:'newsfeed-assistant-read-v1',status:'EMPTY',observations:[]})
 }})
 assert.equal((await adapters[1].read(demand(supplier))).status,'PARTIAL')
 assert.equal((await adapters[2].read(demand(news))).status,'EMPTY')
 for(const [i,source]of ['srm','newsfeed'].entries()){
  const call=calls[i],target=targets.sources[source as 'srm'|'newsfeed']
  assert.equal(call.url.origin,target.origin);assert.equal(call.url.pathname,target.path)
  assert.equal(call.init.method,'GET');assert.equal(call.init.credentials,'omit');assert.equal(call.init.cache,'no-store');assert.equal(call.init.redirect,'error')
  const headers=new Headers(call.init.headers)
  assert.deepEqual([...headers.keys()].sort(),i===0?['authorization']:['authorization','x-profitia-organisation-id'])
  assert.equal(headers.get('authorization'),'Bearer synthetic-test-token')
  assert.equal(i===0?call.url.searchParams.get('organisationId'):headers.get('x-profitia-organisation-id'),organisationId)
 }
 assert.equal(calls[0].url.searchParams.get('comparisonYear'),'2024')
 assert.equal(calls[1].url.searchParams.get('supplierNip'),supplier.nip)
})
test('disabled configuration, foreign organisation, missing bearer and cancellation stop before any producer request',async()=>{
 let calls=0
 const fetcher:typeof fetch=async()=>{calls++;return response(summary)}
 const make=(enabled=true)=>createAssistantSourceAdapters({enabled,organisationId,fetcher})
 for(const [adapters,input]of [
  [make(false),demand(supplier)],[make(),demand(supplier,{organisationId:'22222222-2222-4222-8222-222222222222'})],
  [make(),demand(supplier,{request:new Request('https://app.fixture.test')})],
  [make(),demand(supplier,{signal:AbortSignal.abort()})],
 ]as const)await assert.rejects(()=>adapters[1].read(input))
 await assert.rejects(()=>make(false)[0].read(demand({version:'2.0.0',source:'FORECAST_CORE',seriesId:'synthetic',modelIds:['arima'],targetBasis:'POINT_IN_TIME',sourceFrequency:null,targetCadence:null,verification:true})))
 assert.equal(calls,0)
})

test('Forecast uses the current native authorizer for each exact stored model and verification; honest misses never invoke computation',async()=>{
 const calls:any[]=[],reads:any[]=[]
 const executor:any={execute:async(input:any,action:any)=>{calls.push(input);return {value:await action()}}}
 const reference={version:'2.0.0',source:'FORECAST_CORE',seriesId:'synthetic',modelIds:['arima','ets'],targetBasis:'POINT_IN_TIME',sourceFrequency:null,targetCadence:null,verification:true}
 const forecast:any={executor,current:async(s:any)=>{reads.push(s);return currentForecastUnavailable(s,'MISS')},
  verification:{executor,read:async(s:any)=>{reads.push(s);return forecastVerificationUnavailable(s)}}}
 const adapters=createAssistantSourceAdapters({enabled:true,organisationId,forecast,fetcher:async()=>{throw Error('No network acquisition')}})
 const result=await adapters[0].read(demand(reference))
 assert.equal(result.status,'EMPTY');assert.equal(calls.length,4);assert.equal(reads.length,4)
 for(const call of calls){assert.equal(call.operation,'forecast.read');assert.equal(call.organisationId,organisationId);assert.equal(call.request,request)}
 assert.deepEqual(calls.map(c=>c.resourceId),['forecast-current:synthetic:arima:POINT_IN_TIME','forecast-verification:synthetic:arima:POINT_IN_TIME:FAST','forecast-current:synthetic:ets:POINT_IN_TIME','forecast-verification:synthetic:ets:POINT_IN_TIME:FAST'])
 assert.equal((result.data as any).models.length,2);assert((result.data as any).models.every((m:any)=>m.status==='NOT_AVAILABLE'))
})
test('Forecast denial precedes the native read and a substituted subject is rejected by the producer validator',async()=>{
 const reference={version:'2.0.0',source:'FORECAST_CORE',seriesId:'synthetic',modelIds:['arima'],targetBasis:'POINT_IN_TIME',sourceFrequency:null,targetCadence:null,verification:false}
 let reads=0
 const denied:any={executor:{execute:async()=>{throw new OperationDenied('PERMISSION_DENIED')}},current:async()=>{reads++;throw Error('Forbidden read')}}
 await assert.rejects(()=>createAssistantSourceAdapters({enabled:true,organisationId,forecast:denied})[0].read(demand(reference)),OperationDenied)
 assert.equal(reads,0)
 const substituted:any={executor:{execute:async(_i:any,action:any)=>({value:await action()})},current:async(s:any)=>currentForecastUnavailable({...s,seriesId:'foreign'},'MISS')}
 await assert.rejects(()=>createAssistantSourceAdapters({enabled:true,organisationId,forecast:substituted})[0].read(demand(reference)),OperationDenied)
})
test('producer denial, redirects, privacy headers, cookies and excessive response sizes fail closed without a retry',async()=>{
 const invalid=[
  ()=>new Response(null,{status:403}),()=>new Response(null,{status:404}),()=>new Response(null,{status:503}),
  ()=>response(summary,{'cache-control':'public',vary:'Cookie, Authorization'}),
  ()=>response(summary,{'cache-control':'private, no-store',vary:'Authorization'}),
  ()=>response(summary,{...privacy,'set-cookie':'private=unexpected'}),
  ()=>{const r=response(summary);Object.defineProperty(r,'redirected',{value:true});return r},
  ()=>{const r=response(summary);Object.defineProperty(r,'url',{value:'https://foreign.fixture.test/data'});return r},
  ()=>new Response(' '.repeat(256*1024+1),{headers:privacy}),
 ]
 for(const make of invalid){let calls=0
  const adapters=createAssistantSourceAdapters({enabled:true,organisationId,fetcher:async()=>{calls++;return make()}})
  await assert.rejects(()=>adapters[1].read(demand(supplier)));assert.equal(calls,1)
 }
})
