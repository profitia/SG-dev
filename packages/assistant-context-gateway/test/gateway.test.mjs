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
 for(const [reasonCode,status] of [['PERMISSION_DENIED','DENIED'],['ACCESS_BASIS_INVALID','DENIED'],['PRODUCT_UNAVAILABLE','DENIED'],['POLICY_UNAVAILABLE','UNAVAILABLE']]){
  const g=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async()=>{throw Object.assign(Error('private secret'),{reasonCode})}})]})
  assert.deepEqual((await g.resolve(input)).contexts,[{source:'BENCHMARK_CHART',status}])
 }
 const g=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async()=>{throw Error('Must not read')}})]})
 assert.equal((await g.resolve({...input,reference:null})).contexts[0].status,'EMPTY')
})
test('the actual chart server range is preserved, so zoom never broadens the producer read',async()=>{
 let selected
 const g=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async input=>{selected=input;return data}})]})
 const result=await g.resolve({...input,reference:{...reference,version:'1.1.0',range:'3M'}})
 assert.equal(selected.range,'3M');assert.equal(result.contexts[0].status,'OK');assert.equal(result.contexts[0].selection.range,'3M')
 const previous=selected,invalid=await g.resolve({...input,reference:{...reference,version:'1.1.0',range:'unbounded'}})
 assert.equal(invalid.contexts[0].status,'UNAVAILABLE');assert.equal(selected,previous)
})
test('historical percentages come from verified observations, distinguish the final month from the full window and preserve missing values',async()=>{
 const historical=[{date:'2026-01-01',value:12000},{date:'2026-02-01',value:9500},{date:'2026-02-08',value:10000},
  {date:'2026-02-10',value:null},{date:'2026-02-14',value:9000},{date:'2026-02-17',value:9800}]
 const publication={...data,historical},ref={...reference,to:'2026-02-17',fingerprint:createHash('sha256').update(benchmarkSnapshotBytes({seriesId:'test',...publication,points:historical})).digest('hex')}
 const g=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async()=>publication})]})
 const result=(await g.resolve({...input,reference:ref})).contexts[0],changes=result.data.historicalChanges
 assert.equal(result.status,'PARTIAL');assert.equal(result.data.points[3].value,null)
 assert.equal(result.data.maximum.value,12000)
 assert.deepEqual(changes.finalCalendarMonth.latestVersusMaximum,{from:'2026-02-08',to:'2026-02-17',fromValue:10000,toValue:9800,absoluteChange:-200,percentChange:-2})
 assert.equal(changes.entirePeriod.percentChange,(9800-12000)/12000*100)
 assert.equal(changes.finalCalendarMonth.period.percentChange,(9800-9500)/9500*100)
 assert.equal(changes.finalCalendarMonth.latestVersusMinimum.percentChange,(9800-9000)/9000*100)
 assert(Object.isFrozen(changes.finalCalendarMonth.latestVersusMaximum))
})
test('a zero or negative historical comparison base has no misleading percentage or division by zero',async()=>{
 for(const value of [0,-10]){
  const historical=[{date:'2026-01-01',value},{date:'2026-02-01',value:5}],publication={...data,historical}
  const ref={...reference,fingerprint:createHash('sha256').update(benchmarkSnapshotBytes({seriesId:'test',...publication,points:historical})).digest('hex')}
  const g=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async()=>publication})]})
  const result=(await g.resolve({...input,reference:ref})).contexts[0]
  assert.equal(result.data.historicalChanges.entirePeriod.percentChange,null)
  assert.equal(result.data.historicalChanges.entirePeriod.absoluteChange,5-value)
 }
})
