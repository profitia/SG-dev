import {test} from 'node:test'
import assert from 'node:assert/strict'
import {tracingChannel} from 'node:diagnostics_channel'
import {diagnosticAsync,diagnosticSync,DIAGNOSTIC_PHASE_CHANNEL} from '../src/diagnostic-phase.mjs'

test('disabled observation preserves promise identity,result,error and exactly one call',async()=>{
 const promise=Promise.resolve({accepted:true});let calls=0
 assert.equal(diagnosticAsync('E1_CONTEXT',()=>{calls++;return promise}),promise)
 assert.equal(await promise,await diagnosticAsync('unknown',()=>promise));assert.equal(calls,1)
 const error=Error('fixture');assert.throws(()=>diagnosticSync('E1_CONTEXT',()=>{throw error}),x=>x===error)
})
test('observer has finite category and original result/error behavior',async()=>{
 const channel=tracingChannel(DIAGNOSTIC_PHASE_CHANNEL),events=[]
 const handlers={start:message=>events.push({category:message.category,synchronous:message.synchronous}),error:()=>events.push({error:true})}
 channel.subscribe(handlers)
 try{
  const value=Object.freeze({fixture:true});let calls=0
  assert.equal(await diagnosticAsync('SOURCE_PLAN',async()=>{calls++;return value}),value)
  const error=Error('fixture-private-error')
  await assert.rejects(diagnosticAsync('SOURCE_ATTEMPT',async()=>{throw error}),x=>x===error)
  assert.equal(diagnosticSync('SOURCE_DIGEST',()=>3),3);assert.equal(calls,1)
  assert.deepEqual(events.filter(x=>x.category).map(x=>x.category),['SOURCE_PLAN','SOURCE_ATTEMPT','SOURCE_DIGEST'])
  assert.equal(JSON.stringify(events).includes('fixture-private-error'),false)
 }finally{channel.unsubscribe(handlers)}
})
