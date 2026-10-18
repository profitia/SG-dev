import assert from 'node:assert/strict'
import test from 'node:test'
import {NextRequest,NextResponse} from 'next/server'
import type {Prisma} from '@prisma/client'
import {OPERATION_CONTRACT,OperationDenied,type OperationExecutor,type OperationInput} from '@profitia/platform-contracts/operation-context'
import {createLegacyForecastVerificationHandler,createOperationForecastVerificationHandler,createRuntimeForecastVerificationHandler} from '../lib/forecast/verification-operation-handlers'
import {createForecastVerificationRouteHandler} from '../lib/forecast/route-handlers'
import {forecastVerificationResourceId,forecastVerificationUnavailable,readForecastVerificationSelection,validatePublicForecastVerification,projectForecastVerificationResponse,MAX_FORECAST_VERIFICATION_BYTES} from '../lib/platform/forecast-verification'
import {createFullVerificationStatisticalCompatibility,createRecentVerificationStatisticalCompatibility,resolveForecastMethodContract} from '../lib/forecast/identity'
import type {ForecastVerificationHorizon} from '../lib/forecast/contracts'
import {resolveHistoricalVerificationSummary,ensureHistoricalVerificationContract} from '../lib/forecast/historical-verification-policy'
import {GET as mountedGET} from '../app/api/benchmark/forecast/verification/route'
const A='11111111-1111-4111-8111-111111111111'
const selection={seriesId:'stored_series',modelId:'naive',targetBasis:'MONTHLY_AVERAGE',verificationScope:'FULL'} as const
const request=(query='seriesId=stored_series&model=naive',method='GET',headers:Record<string,string>={})=>new NextRequest(`https://app.fixture.test/api/benchmark/forecast/verification?${query}`,{method,headers})
const context=(payload=selection)=>({payload,resource:{id:forecastVerificationResourceId(payload)}})
function available(scope:'FULL'|'FAST'|'RECENT'='FULL'){
  const method=resolveForecastMethodContract(selection.targetBasis),hash='a'.repeat(64)
  const verification:Record<string,ForecastVerificationHorizon>={'1M':{horizon:'1M',horizonSteps:1,origins:1,expectedOrigins:1,successfulOrigins:1,failedOrigins:0,coverage:1,
      metrics:{mae:0,rmse:0,mase:0,smape:0,directionalAccuracy:0,bias:0},records:[{benchmarkId:selection.seriesId,modelId:'naive',forecastOrigin:'2024-01-01T00:00:00.000Z',horizon:'1M',horizonSteps:1,
        forecastDate:'2024-02-01T00:00:00.000Z',actualObservedAt:null,originValue:0,forecastValue:0,actualValue:0,error:0,absoluteError:0,delta:0,deltaPct:null,maseScale:0,metadata:null}],failures:[]}}
  return ensureHistoricalVerificationContract({status:'AVAILABLE',...{seriesId:selection.seriesId,modelId:selection.modelId,targetBasis:selection.targetBasis},targetSemantics:method.targetSemantics,methodId:method.methodId,methodVersion:method.methodVersion,userFacingModel:true,
    displayName:'Shared stored series',description:null,source:{kind:'DYNAMIC_MARKET_DATA_STORE',runId:null},
    lineage:{inputSource:'DYNAMIC_MARKET_DATA_STORE',inputRunId:null,sourceSeriesId:selection.seriesId,sourceFrequency:'DAILY',historyFingerprint:hash,preparation:null,
      statisticalCompatibility:(scope==='RECENT'?createRecentVerificationStatisticalCompatibility:createFullVerificationStatisticalCompatibility)({sourceFrequency:'DAILY',targetCadence:'MONTHLY',targetSemantics:method.targetSemantics})},
    historyFingerprint:hash,history:{frequency:'MONTHLY',start:null,end:null,observations:24},forecastOrigin:null,runtimeSeconds:0,cacheStatus:'hit',
    verification,historicalVerification:resolveHistoricalVerificationSummary(verification,{fullHistoryReady:true})})
}
// Selection scope belongs to the request/resource, not to the legacy result DTO.
function fixture(scope:'FULL'|'FAST'|'RECENT'='FULL'){
  const value=available(scope)
  if(value.status!=='AVAILABLE')throw Error('Synthetic available fixture required')
  return value
}
test('Verification preserves the original handler and default FAST while all scopes and cadence pairs have different resource identities',()=>{
  assert.equal(createLegacyForecastVerificationHandler,createForecastVerificationRouteHandler)
  assert.equal(readForecastVerificationSelection({seriesId:'stored_series',modelId:'naive',targetBasis:'MONTHLY_AVERAGE'}).verificationScope,'FAST')
  const ids=['FAST','FULL','RECENT'].map(verificationScope=>forecastVerificationResourceId(readForecastVerificationSelection({...selection,verificationScope})))
  assert.equal(new Set(ids).size,3)
  assert.notEqual(ids[1],forecastVerificationResourceId({...selection,sourceFrequency:'DAILY',targetCadence:'MONTHLY'}))
  for(const bad of[{...selection,actorId:A},{...selection,verificationScope:'LATEST'},{...selection,sourceFrequency:'DAILY'},{...selection,seriesId:'*'}])assert.throws(()=>readForecastVerificationSelection(bad),OperationDenied)
})
test('closed available and honest unavailable envelopes preserve zeros/nulls and refuse private fields, lineage, scope and malformed data',async()=>{
  for(const verificationScope of['FULL','FAST','RECENT']as const){
    const selected={...selection,verificationScope},body=fixture(verificationScope),ctx={payload:selected,resource:{id:forecastVerificationResourceId(selected)}}
    assert.equal(validatePublicForecastVerification(body,selected).status,'AVAILABLE')
    const response=Response.json(body);assert.equal(await projectForecastVerificationResponse(response,ctx),response)
    assert.equal(body.verification['1M']!.metrics!.mae,0);assert.equal(body.verification['1M']!.records[0]!.deltaPct,null)
    for(const bad of[{...body,userId:A},{...body,source:{...body.source,runId:A}},{...body,methodVersion:'foreign'},
      {...body,historyFingerprint:'b'.repeat(64)},{...body,verification:{'1M':{...body.verification['1M'],records:[{...body.verification['1M']!.records[0],benchmarkId:'foreign'}]}}}])await assert.rejects(projectForecastVerificationResponse(Response.json(bad),ctx),OperationDenied)
    assert.throws(()=>validatePublicForecastVerification(body,{...selected,verificationScope:verificationScope==='RECENT'?'FULL':'RECENT'}),OperationDenied)
    const missing=forecastVerificationUnavailable(selected);assert.equal(validatePublicForecastVerification(missing,selected).status,'NOT_AVAILABLE')
    assert.throws(()=>validatePublicForecastVerification({...missing,reason:'raw failure'},selected),OperationDenied)
  }
  await assert.rejects(projectForecastVerificationResponse(new Response(' '.repeat(MAX_FORECAST_VERIFICATION_BYTES)+'{}'),context()),OperationDenied)
  await assert.rejects(projectForecastVerificationResponse(Response.json(fixture()),{...context(),resource:{id:'foreign'}}),OperationDenied)
  await assert.rejects(projectForecastVerificationResponse(new Response('invalid JSON'),context()),OperationDenied)
})
test('native Verification pins current forecast authority and rejects caller identities, duplicate parameters and prepared headers before source use',async()=>{
  const calls:OperationInput[]=[];let reads=0
  const executor:OperationExecutor<Prisma.TransactionClient>={contract:OPERATION_CONTRACT,async execute(input){calls.push(input);throw new OperationDenied('PERMISSION_DENIED')}}
  const handler=createOperationForecastVerificationHandler(executor,A,async()=>{reads++;return{}})
  for(const scope of['','&verificationScope=FULL','&verificationScope=RECENT'])assert.equal((await handler(request('seriesId=stored_series&model=naive'+scope))).status,403)
  assert.deepEqual(calls.map(x=>(x.payload as {verificationScope:string}).verificationScope),['FAST','FULL','RECENT'])
  assert(calls.every(x=>x.operation==='forecast.read'&&x.organisationId===A));assert.equal(reads,0)
  for(const query of['seriesId=x&model=naive&seriesId=y','seriesId=x&model=unknown','seriesId=x&model=naive&verificationScope=LATEST',
    'seriesId=x&model=naive&organisationId=','seriesId=x&model=naive&actorId=forged','seriesId=x&model=naive&sourceFrequency=DAILY'])assert.equal((await handler(request(query))).status,400)
  assert.equal((await handler(request(undefined,'GET',{'x-sg-prepared-history-fingerprint':'forged'}))).status,400)
  const method=await handler(request(undefined,'POST'));assert.equal(method.status,405);assert.equal(method.headers.get('allow'),'GET');assert.equal(calls.length,3)
})
test('authentication, permission and audit failures remain private; native misconfiguration never falls back and legacy remains explicit',async()=>{
  for(const[reason,status]of[['UNVERIFIED_IDENTITY',401],['PERMISSION_DENIED',403],['CONTEXT_INVALID',400],['AUDIT_UNAVAILABLE',503],['POLICY_UNAVAILABLE',503]]as const){
    const executor:OperationExecutor<Prisma.TransactionClient>={contract:OPERATION_CONTRACT,async execute(){throw new OperationDenied(reason)}}
    const result=await createOperationForecastVerificationHandler(executor,A,async()=>{throw Error('must not run')})(request())
    assert.equal(result.status,status);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('vary'),'Cookie, Authorization')
  }
  let calls=0;const response=NextResponse.json({unchanged:true},{status:202}),legacy=async()=>{calls++;return response}
  const executor:OperationExecutor<Prisma.TransactionClient>={contract:OPERATION_CONTRACT,async execute(){throw new OperationDenied('PERMISSION_DENIED')}}
  assert.equal((await createRuntimeForecastVerificationHandler(()=>({provider:'clerk',executor,defaultOrganisationId:A}),legacy)(request())).status,503)
  assert.equal((await createRuntimeForecastVerificationHandler(()=>{throw Error('private configuration')},legacy)(request())).status,503);assert.equal(calls,0)
  assert.equal(await createRuntimeForecastVerificationHandler(()=>({provider:'legacy_demo'}),legacy)(request()),response);assert.equal(calls,1)
})
test('actual mounted Verification API refuses incomplete Clerk configuration without network or legacy fallback',async()=>{
  const prior=process.env.PROFITIA_AUTH_PROVIDER,fetch=globalThis.fetch;let calls=0
  process.env.PROFITIA_AUTH_PROVIDER='clerk';globalThis.fetch=async()=>{calls++;throw Error('No network')}
  try{const result=await mountedGET(request());assert.equal(result.status,503);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(calls,0)}
  finally{globalThis.fetch=fetch;if(prior===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=prior}
})
