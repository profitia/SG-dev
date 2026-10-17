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
  for(const query of ['seriesId=x&model=naive','seriesId=x&model=naive&targetBasis=END_OF_PERIOD',
    'seriesId=x&model=naive&targetBasis=POINT_IN_TIME&sourceFrequency=MONTHLY&targetCadence=MONTHLY']) assert.equal((await handler(request(query))).status,503)
  const method=await handler(request(undefined,'POST'));assert.equal(method.status,405);assert.equal(method.headers.get('allow'),'GET')
  assert.equal(calls.length,1);assert.equal(reads,0)
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
