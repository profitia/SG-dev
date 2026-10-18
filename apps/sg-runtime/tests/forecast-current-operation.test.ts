import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { OPERATION_CONTRACT, OperationDenied, type OperationExecutor, type OperationInput } from '@profitia/platform-contracts/operation-context'
import { createLegacyForecastCurrentHandler, createOperationForecastCurrentHandler, createRuntimeForecastCurrentHandler } from '../lib/forecast/current-operation-handlers'
import { createCurrentForecastRouteHandler } from '../lib/forecast/route-handlers'
import { FORECAST_CURRENT_PROJECTION, forecastCurrentResourceId, readForecastCurrentSelection,
  currentForecastUnavailable, hasPublicForecastModelParameters, projectForecastCurrentResponse, MAX_FORECAST_CURRENT_BYTES } from '../lib/platform/forecast-current'
import { buildRollingDailyHistoryFingerprint } from '../lib/forecast/rolling-daily-maintenance'
import { GET as mountedGET } from '../app/api/benchmark/forecast/current/route'
import { createCurrentForecastStatisticalCompatibility, resolveForecastMethodContract } from '../lib/forecast/identity'
import { attachExactUncertaintyBandIdentity } from '../lib/forecast/uncertainty-band-policy'
import { periodCurrentUnavailable } from '../lib/platform/period-forecast-current'

const A = '11111111-1111-4111-8111-111111111111'
const selection = { seriesId: 'stored_series', modelId: 'naive', targetBasis: 'POINT_IN_TIME' } as const
const resource = { id: forecastCurrentResourceId(selection), type: 'market_forecast', dataClass: 'SHARED_KNOWLEDGE',
  environment: 'development' as const, ownerOrganisationId: null, ownerUserId: null, approvedSharedProjection: true,
  version: FORECAST_CURRENT_PROJECTION, projectionVersion: FORECAST_CURRENT_PROJECTION }
const context = { payload: selection, resource }
const request = (query = 'seriesId=stored_series&model=naive&targetBasis=POINT_IN_TIME', method = 'GET', headers: Record<string,string> = {}) =>
  new NextRequest(`https://app.fixture.test/api/benchmark/forecast/current?${query}`, { method, headers })

test('prepared current reuses the original legacy factory and preserves the original canonical fingerprint function', () => {
  assert.equal(createLegacyForecastCurrentHandler, createCurrentForecastRouteHandler)
  const input = { seriesId: selection.seriesId, displayName: 'Shared', description: 'Shared', frequency: 'DAILY', source: 'Synthetic',
    points: [{ date: '2025-01-01', value: 0 }, { date: '2025-01-02', value: 1 }] }
  assert.equal(buildRollingDailyHistoryFingerprint(input), buildRollingDailyHistoryFingerprint(structuredClone(input)))
  assert.notEqual(buildRollingDailyHistoryFingerprint(input), buildRollingDailyHistoryFingerprint({ ...input, points: [{ date:'2025-01-01',value:1 },input.points[1]!] }))
})

test('honest MISS and STALE envelopes are bounded, selected and contain no fabricated path or private field', async () => {
  for (const status of ['MISS','STALE'] as const) {
    const missing = currentForecastUnavailable(selection, status)
    assert.equal(missing.status, 'NOT_AVAILABLE'); assert(missing.reason.endsWith(`${status}.`)); assert.equal('path' in missing, false)
    assert(await projectForecastCurrentResponse(Response.json(missing), context) instanceof Response)
    for (const bad of [{ ...missing, userId: A }, { ...missing, modelId: 'ets' }, { ...missing, seriesId:'other' },
      { ...missing, reason:'raw private diagnostic' }]) await assert.rejects(projectForecastCurrentResponse(Response.json(bad), context), OperationDenied)
  }
  await assert.rejects(projectForecastCurrentResponse(new Response(' '.repeat(MAX_FORECAST_CURRENT_BYTES) + '{}'), context), OperationDenied)
  await assert.rejects(projectForecastCurrentResponse(Response.json(currentForecastUnavailable(selection,'MISS')), { ...context, resource:{...resource,id:'foreign'} }),OperationDenied)
  assert.throws(() => readForecastCurrentSelection({ ...selection, actorId:A }),OperationDenied)
})

test('only reviewed finite model parameters and bounded statistical policy metadata are publishable', () => {
  for(const value of [null,{}, { alpha:0, beta:0.5, phi:1, 'ar.L1':0, sigma2:0 },
    { order:[1,0,1], seasonal_order:[0,0,0,0], trend:null, policyIdentity:'ARIMA_NON_SEASONAL_BOUNDED_AICC_V1',
      fitImplementation:'STATSMODELS_ARIMA_STATESPACE', candidateCount:3 }]) assert.equal(hasPublicForecastModelParameters(value),true)
  for(const value of [[],undefined,{alpha:Infinity},{alpha:NaN},{userId:A},{alpha:'0'}, {order:[1,2]},
    {order:[1,-1,0]},{seasonal_order:[0,0,0,367]},{trend:'private'}, {policyIdentity:'unknown'}, {toString:'private'},
    Object.create({alpha:0}),JSON.parse('{"__proto__":"private"}'),Object.fromEntries(Array.from({length:513},(_,i)=>[`param_${i}`,0]))]) assert.equal(hasPublicForecastModelParameters(value),false)
})

test('native current pins forecast.read and server-derived identity before entering the stored read callback', async () => {
  const calls:OperationInput[]=[];let reads=0
  const executor:OperationExecutor<Prisma.TransactionClient>={contract:OPERATION_CONTRACT,async execute(input){calls.push(input);throw new OperationDenied('PERMISSION_DENIED')}}
  const handler=createOperationForecastCurrentHandler(executor,A,async()=>{reads++;return{}})
  assert.equal((await handler(request())).status,403)
  assert.equal(calls[0]?.operation,'forecast.read');assert.equal(calls[0]?.resourceId,resource.id)
  assert.equal(calls[0]?.organisationId,A);assert.deepEqual(calls[0]?.payload,selection);assert.equal(reads,0)
  for(const query of ['seriesId=x&model=naive&targetBasis=POINT_IN_TIME&seriesId=y','seriesId=x&model=unknown&targetBasis=POINT_IN_TIME',
    'seriesId=*&model=naive&targetBasis=POINT_IN_TIME','seriesId=x&model=naive&targetBasis=POINT_IN_TIME&organisationId=',
    'seriesId=x&model=naive&targetBasis=POINT_IN_TIME&actorId=forged','seriesId=x&model=naive&targetBasis=POINT_IN_TIME&verificationScope=FULL',
    'seriesId=x&model=naive&targetBasis=POINT_IN_TIME&sourceFrequency=DAILY',`seriesId=${'a'.repeat(257)}&model=naive&targetBasis=POINT_IN_TIME`]) assert.equal((await handler(request(query))).status,400)
  assert.equal((await handler(request(undefined,'GET',{'x-sg-prepared-history-fingerprint':'forged'}))).status,400)
  for(const query of ['seriesId=x&model=naive','seriesId=x&model=naive&targetBasis=END_OF_PERIOD']) assert.equal((await handler(request(query))).status,403)
  assert.deepEqual(calls[1]?.payload,{seriesId:'x',modelId:'naive',targetBasis:'MONTHLY_AVERAGE'})
  assert.deepEqual(calls[2]?.payload,{seriesId:'x',modelId:'naive',targetBasis:'END_OF_PERIOD'})
  assert.equal((await handler(request('seriesId=x&model=naive&targetBasis=POINT_IN_TIME&sourceFrequency=MONTHLY&targetCadence=MONTHLY'))).status,400)
  const method=await handler(request(undefined,'POST'));assert.equal(method.status,405);assert.equal(method.headers.get('allow'),'GET')
  assert.equal(calls.length,3);assert.equal(reads,0)
})

function periodFixture(targetBasis: 'MONTHLY_AVERAGE'|'END_OF_PERIOD') {
  const selected={seriesId:'period_source',modelId:'naive' as const,targetBasis}
  const method=resolveForecastMethodContract(targetBasis),hash='a'.repeat(64)
  const statistical=createCurrentForecastStatisticalCompatibility({sourceFrequency:'DAILY',targetCadence:'MONTHLY',targetSemantics:targetBasis})
  const point=attachExactUncertaintyBandIdentity({seriesId:selected.seriesId,modelId:'naive',targetBasis,methodVersion:method.methodVersion,
    inputSource:'DYNAMIC_MARKET_DATA_STORE',sourceFrequency:'DAILY',targetCadence:'MONTHLY',sourceHistoryFingerprint:hash,
    trainingWindowPolicyId:statistical.trainingWindowPolicyId,effectiveTrainingPolicyId:statistical.effectiveTrainingPolicyId,forecastOrigin:'2024-12-01T00:00:00.000Z'},
  {horizon:'1M',horizonSteps:1,forecastDate:'2025-01-01T00:00:00.000Z',forecastValue:0,failureReason:null,
    metadata:{modelFamily:'naive',selectedVariant:'NAIVE_LAST_VALUE',selectedParameters:{},selectionScore:0,selectionMetric:null,fitStatus:'SUCCEEDED',failureReason:null,
      uncertaintyBand:{status:'AVAILABLE',source:'MODEL_NATIVE_SHORT_HISTORY',policyVersion:'ADAPTIVE_UNCERTAINTY_BANDS_V1',coverage:0.8,
        lower:0,upper:0,sampleCount:12,calibrationStatus:'NOT_AVAILABLE',calibrationMethod:'NAIVE_RANDOM_WALK_INNOVATION_RMS_NORMAL',
        calibrationVersion:'naive-random-walk-innovation-rms-normal-v1',reasonCode:null}}})
  const result={status:'AVAILABLE',...selected,targetSemantics:targetBasis,methodId:method.methodId,methodVersion:method.methodVersion,userFacingModel:true,
    displayName:'Shared period source',description:'Shared period source',source:{kind:'DYNAMIC_MARKET_DATA_STORE',runId:null},
    lineage:{inputSource:'DYNAMIC_MARKET_DATA_STORE',inputRunId:null,sourceSeriesId:selected.seriesId,sourceFrequency:'DAILY',historyFingerprint:hash,
      preparation:null,statisticalCompatibility:statistical},historyFingerprint:hash,
    history:{frequency:'MONTHLY',start:'2024-01-01T00:00:00.000Z',end:'2024-12-01T00:00:00.000Z',observations:12},
    forecastOrigin:'2024-12-01T00:00:00.000Z',runtimeSeconds:0,cacheStatus:'hit',alignment:{status:'ALIGNED',trainingFrequency:'MONTHLY',
      lastHistoricalPeriod:'2024-12-01T00:00:00.000Z',forecastOrigin:'2024-12-01T00:00:00.000Z',firstForecastTarget:'2025-01-01T00:00:00.000Z'},
    currentForecast:{'1M':point}}
  const selectedContext={payload:selected,resource:{...resource,id:forecastCurrentResourceId(selected)}}
  return{selected,result,selectedContext}
}

test('closed period projection preserves zero, business meaning and the existing exact band identity for both bases',async()=>{
  for(const basis of ['MONTHLY_AVERAGE','END_OF_PERIOD'] as const){
    const{selected,result,selectedContext}=periodFixture(basis)
    const response=Response.json(result);assert.equal(await projectForecastCurrentResponse(response,selectedContext),response)
    const missing=Response.json(periodCurrentUnavailable(selected));assert.equal(await projectForecastCurrentResponse(missing,selectedContext),missing)
    const changes:Array<(value:typeof result)=>void>=[v=>{v.source.runId='private' as never},v=>{v.lineage.inputRunId='private' as never},
      v=>{v.historyFingerprint='b'.repeat(64)},v=>{v.currentForecast['1M'].forecastValue=null},v=>{v.methodVersion='foreign'},
      v=>{v.currentForecast['1M'].metadata!.selectedParameters={userId:A}},v=>{v.currentForecast['1M'].metadata!.selectedVariant='PRIVATE_NOTE'},
      v=>{v.currentForecast['1M'].metadata!.uncertaintyBand!.identity!.sourceHistoryFingerprint='b'.repeat(64)}]
    for(const change of changes){
      const bad=structuredClone(result);change(bad);await assert.rejects(projectForecastCurrentResponse(Response.json(bad),selectedContext),OperationDenied)
    }
    for(const bad of [{...result,userId:A},{...result,source:{...result.source,requester:A}},
      {...result,currentForecast:{'1M':{...result.currentForecast['1M'],metadata:{...result.currentForecast['1M'].metadata,organisationId:A}}}}]){
      await assert.rejects(projectForecastCurrentResponse(Response.json(bad),selectedContext),OperationDenied)
    }
    await assert.rejects(projectForecastCurrentResponse(Response.json(result),{...selectedContext,payload:{...selected,sourceFrequency:'MONTHLY',targetCadence:'MONTHLY'}}),OperationDenied)
  }
})

test('native failures retain authentication/permission/configuration distinctions and private cache headers',async()=>{
  for(const[reason,status]of[['UNVERIFIED_IDENTITY',401],['PERMISSION_DENIED',403],['CONTEXT_INVALID',400],['AUDIT_UNAVAILABLE',503],['POLICY_UNAVAILABLE',503]]as const){
    const executor:OperationExecutor<Prisma.TransactionClient>={contract:OPERATION_CONTRACT,async execute(){throw new OperationDenied(reason)}}
    const result=await createOperationForecastCurrentHandler(executor,A,async()=>{throw Error('must not run')})(request())
    assert.equal(result.status,status);assert.equal(result.headers.get('cache-control'),'private, no-store');assert.equal(result.headers.get('vary'),'Cookie, Authorization')
  }
})

test('native configuration failure never borrows legacy computation and exact legacy mode returns the original response',async()=>{
  let calls=0
  const response=NextResponse.json({unchanged:true},{status:202});const legacy=async()=>{calls++;return response}
  const executor:OperationExecutor<Prisma.TransactionClient>={contract:OPERATION_CONTRACT,async execute(){throw new OperationDenied('PERMISSION_DENIED')}}
  const native=createRuntimeForecastCurrentHandler(()=>({provider:'clerk',executor,defaultOrganisationId:A}),legacy)
  assert.equal((await native(request())).status,503);assert.equal(calls,0)
  const failure=await createRuntimeForecastCurrentHandler(()=>{throw Error('private config detail')},legacy)(request())
  assert.equal(failure.status,503);assert(!(await failure.text()).includes('private config detail'));assert.equal(calls,0)
  assert.equal(await createRuntimeForecastCurrentHandler(()=>({provider:'legacy_demo'}),legacy)(request()),response);assert.equal(calls,1)
})

test('actual mounted current API refuses incomplete Clerk configuration without any network or legacy fallback',async()=>{
  const prior=process.env.PROFITIA_AUTH_PROVIDER,fetch=globalThis.fetch;let calls=0
  process.env.PROFITIA_AUTH_PROVIDER='clerk';globalThis.fetch=async()=>{calls++;throw Error('No network')}
  try{const response=await mountedGET(request());assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(calls,0)}
  finally{globalThis.fetch=fetch;if(prior===undefined)delete process.env.PROFITIA_AUTH_PROVIDER;else process.env.PROFITIA_AUTH_PROVIDER=prior}
})
