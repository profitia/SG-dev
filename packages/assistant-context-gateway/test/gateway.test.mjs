import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {benchmarkSnapshotBytes} from '../../assistant-context-contracts/src/index.mjs'
import {createAssistantContextGateway,createBenchmarkContextAdapter} from '../src/index.mjs'
const data={providerSeries:{providerSeriesId:'test'},displayName:'Oil',unit:'barrel',currency:'USD',source:'Stored provider',frequency:'MONTHLY',historical:[{date:'2026-01-01',value:60},{date:'2026-02-01',value:65}]}
const reference={version:'1.0.0',source:'BENCHMARK_CHART',seriesId:'test',from:'2026-01-01',to:'2026-02-01',fingerprint:createHash('sha256').update(benchmarkSnapshotBytes({seriesId:'test',...data,points:data.historical})).digest('hex')}
const input={plan:[{source:'BENCHMARK_CHART',selection:'ACTIVE_VIEW'}],reference,request:{},organisationId:'org'}
test('gateway only reads demanded context, reauthorises every read and freezes source values',async()=>{
 let calls=0
 const gateway=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async()=>{calls++;return data}})]})
 assert.deepEqual((await gateway.resolve({...input,plan:[]})).contexts,[]);assert.equal(calls,0)
 const first=(await gateway.resolve(input)).contexts[0]
 assert.equal(first.status,'OK');assert.equal(first.data.unit,'barrel');assert.equal(first.data.maximum.value,65);assert.ok(Object.isFrozen(first.data.points))
 await gateway.resolve(input);assert.equal(calls,2)
})
test('changed data is stale and never substituted for the viewed version',async()=>{
 const g=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async()=>({...data,historical:[{date:'2026-01-01',value:70}]})})]})
 const result=(await g.resolve(input)).contexts[0];assert.equal(result.status,'STALE');assert.equal(result.data,undefined)
})
test('denial, empty and unavailable remain distinct without leaking exception text',async()=>{
 for(const [reasonCode,status] of [['PERMISSION_DENIED','DENIED'],['POLICY_UNAVAILABLE','UNAVAILABLE']]){
  const g=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async()=>{throw Object.assign(Error('private secret'),{reasonCode})}})]})
  assert.deepEqual((await g.resolve(input)).contexts,[{source:'BENCHMARK_CHART',status}])
 }
 const g=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async()=>{throw Error('Must not read')}})]})
 assert.equal((await g.resolve({...input,reference:null})).contexts[0].status,'EMPTY')
})
