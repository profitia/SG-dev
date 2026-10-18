import {readCurrentRunFromPrisma,readLatestCurrentRunFromPrisma,readVerificationRunFromPrisma,readLatestVerificationRunFromPrisma} from '../lib/forecast/service'
import {createPreparedRollingDailyForecastVerificationReader} from '../lib/forecast/rolling-daily-verification'
import assert from 'node:assert/strict'
import test from 'node:test'
import type {BenchmarkHistoricalSeriesResult} from '../lib/benchmark/contracts'
import {readForecastPreparedVariantsFromPort,type ForecastPreparedStateDataPort,type PreparedPeriodStateKey,type PreparedHistoricalStateKey,type PreparedRollingSnapshotKey,type PreparedRollingStateKey} from '../lib/forecast/prepared-state'

const now=new Date('2025-01-15T00:00:00.000Z')
const history:BenchmarkHistoricalSeriesResult={providerSeries:{provider:{providerCode:'MACROBOND',displayName:'Macrobond'},providerSeriesId:'prepared_port_source',providerSeriesKey:null},
  displayName:'Synthetic prepared state',frequency:'DAILY',currency:null,unit:null,source:'controlled-source',
  historical:Array.from({length:96},(_,i)=>({date:new Date(Date.UTC(2016,i,20)).toISOString(),value:0}))}
const id=history.providerSeries.providerSeriesId
const emptyPort=():ForecastPreparedStateDataPort=>({readLatestCurrent:async()=>null,readLatestHistorical:async()=>null,readRollingSnapshot:async()=>null,readRollingMaintenance:async()=>null,countRollingVerification:async()=>0})
async function withoutGlobal(work:()=>Promise<void>){
  const key='__sgRuntimeMarketDataPrisma__',descriptor=Object.getOwnPropertyDescriptor(globalThis,key),fetch=globalThis.fetch
  let globals=0,network=0
  Object.defineProperty(globalThis,key,{configurable:true,get(){globals++;throw Error('Explicit neutral port must not resolve global ORM')}})
  globalThis.fetch=async()=>{network++;throw Error('Explicit neutral port must not fetch a provider')}
  try{await work();assert.equal(globals,0);assert.equal(network,0)}
  finally{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);globalThis.fetch=fetch}
}

test('neutral source contract carries bounded scientific identity, not ORM delegates or caller authority',async()=>withoutGlobal(async()=>{
  const current:PreparedPeriodStateKey[]=[],historical:PreparedHistoricalStateKey[]=[],snapshots:PreparedRollingSnapshotKey[]=[],maintenance:PreparedRollingStateKey[]=[],counts:PreparedRollingStateKey[]=[]
  const port:ForecastPreparedStateDataPort={
    readLatestCurrent:async key=>{current.push(key);return null},readLatestHistorical:async key=>{historical.push(key);return null},
    readRollingSnapshot:async key=>{snapshots.push(key);return null},readRollingMaintenance:async key=>{maintenance.push(key);return null},countRollingVerification:async key=>{counts.push(key);return 0},
  }
  const values=await readForecastPreparedVariantsFromPort(id,history,port,{now})
  assert.equal(values.length,12);assert(values.every(v=>v.current==='NOT_PREPARED'&&v.historical==='NOT_PREPARED'))
  assert.deepEqual([current.length,historical.length,snapshots.length,maintenance.length,counts.length],[8,8,4,4,4])
  for(const key of[...current,...historical,...snapshots,...maintenance,...counts]){
    assert.equal(key.seriesId,id);assert(['naive','ets','arima','damped_holt'].includes(key.modelId));assert.equal(typeof key.methodVersion,'string')
    assert(!Object.keys(key).some(k=>['prisma','actorId','organisationId','userId','applicationId','request'].includes(k)))
  }
  for(const key of historical)assert.deepEqual(Object.keys(key).sort(),['seriesId','modelId','targetBasis','methodId','methodVersion','frequencies','trainingWindowPolicyId','effectiveTrainingPolicyId'].sort())
  for(const key of current){assert(key.frequencies.length>0);assert(key.frequencies.every(f=>f==='MONTHLY'||f.startsWith('FORECAST_CADENCE_V1|source=DAILY|target=MONTHLY')))}
  for(const key of snapshots){assert.match(key.sourceHistoryFingerprint,/^[a-f0-9]{64}$/);assert.equal(key.inputSource,'DYNAMIC_MARKET_DATA_STORE');assert.equal(key.targetBasis,'POINT_IN_TIME')}
}))

test('zero, null and a later failed attempt keep distinct preparedness states without caching a prior success',async()=>withoutGlobal(async()=>{
  const baseline=await readForecastPreparedVariantsFromPort(id,history,emptyPort(),{now})
  const identity=baseline.find(v=>v.identity.targetSemantics==='MONTHLY_AVERAGE'&&v.identity.modelId==='naive')!
  assert(identity.preparedReadAuthority)
  let status='AVAILABLE',point:unknown=0
  const port:ForecastPreparedStateDataPort={...emptyPort(),readLatestCurrent:async key=>key.targetBasis==='MONTHLY_AVERAGE'&&key.modelId==='naive'
    ?{status,frequency:key.frequencies[0]!,historyFingerprint:identity.preparedReadAuthority!.expectedHistoryFingerprint,points:[{forecastValue:point}]}:null}
  const read=async()=>(await readForecastPreparedVariantsFromPort(id,history,port,{now})).find(v=>v.identity.targetSemantics==='MONTHLY_AVERAGE'&&v.identity.modelId==='naive')!
  assert.equal((await read()).current,'READY')
  status='FAILED';assert.equal((await read()).current,'STALE')
  status='AVAILABLE';point=null;assert.equal((await read()).current,'STALE')
  point=0;assert.equal((await read()).current,'READY')
}))

test('malformed explicit ports and read errors refuse without a global or provider fallback',async()=>withoutGlobal(async()=>{
  for(const value of[null,undefined,{}, {...emptyPort(),readLatestHistorical:null},{...emptyPort(),countRollingVerification:0}]){
    await assert.rejects(readForecastPreparedVariantsFromPort(id,history,value as ForecastPreparedStateDataPort,{now}),/Explicit forecast preparedness data port required/)
  }
  const failure=new Error('Synthetic read refusal')
  await assert.rejects(readForecastPreparedVariantsFromPort(id,history,{...emptyPort(),readLatestCurrent:async()=>{throw failure}},{now}),error=>error===failure)
}))

test('unsupported source frequency produces no fabricated readiness and does not query the explicit source',async()=>withoutGlobal(async()=>{
  let calls=0;const refuse=async():Promise<never>=>{calls++;throw Error('Unsupported frequency must not read data')}
  const port:ForecastPreparedStateDataPort={readLatestCurrent:refuse,readLatestHistorical:refuse,readRollingSnapshot:refuse,readRollingMaintenance:refuse,countRollingVerification:refuse}
  assert.deepEqual(await readForecastPreparedVariantsFromPort(id,{...history,frequency:'UNKNOWN'},port,{now}),[]);assert.equal(calls,0)
}))

test('explicit native projection rejects missing, malformed, root or unknown clients before a global or ORM fallback',async()=>withoutGlobal(async()=>{
  const never=()=>{assert.fail('Invalid projection cannot invoke a data port')}
  for(const fn of [readCurrentRunFromPrisma,readLatestCurrentRunFromPrisma,readVerificationRunFromPrisma,readLatestVerificationRunFromPrisma]){
    const call=fn as unknown as (key:unknown,input:unknown)=>Promise<unknown>
    for(const input of [
      {prisma:null,projection:'STORED_SHARED'},
      {prisma:{forecastCurrentRun:{findFirst:never}},projection:'STORED_SHARED'},
      {prisma:{$queryRawUnsafe:never,$executeRawUnsafe:never,$transaction:never},projection:'STORED_SHARED'},
      {prisma:{$queryRawUnsafe:never,$executeRawUnsafe:never},projection:'UNREVIEWED'},
    ])await assert.rejects(call({},input),/live stored .* projection transaction/)
  }
  for(const input of [
    {prisma:null,projection:'STORED_SHARED'},
    {prisma:{$queryRawUnsafe:never,$executeRawUnsafe:never,$transaction:never},projection:'STORED_SHARED'},
    {prisma:{$queryRawUnsafe:never,$executeRawUnsafe:never},projection:'UNREVIEWED'},
  ])await assert.rejects(createPreparedRollingDailyForecastVerificationReader(input as never)({seriesId:id,modelId:'naive',targetBasis:'POINT_IN_TIME'}),/live Rolling projection transaction/)
}))
