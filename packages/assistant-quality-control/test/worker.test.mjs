import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createQualityWorker} from '../src/worker.mjs'

test('Shutdown completes the outstanding durable tick and never starts another incident',async()=>{
 const ids=[randomUUID(),randomUUID()],stop=new AbortController(),events=[];let count=0,resolve,started
 const began=new Promise(r=>{started=r}),pending=new Promise(r=>{resolve=r})
 const worker=createQualityWorker({store:{listDue:async()=>ids},controller:{tick:async id=>{count++;assert.equal(id,ids[0]);started();await pending;return {status:'PATCH_READY'}}},onEvent:e=>events.push(e)})
 const running=worker.run({signal:stop.signal});await began
 await assert.rejects(worker.step(),{code:'WORKER_ALREADY_RUNNING'})
 await assert.rejects(worker.run({signal:stop.signal}),{code:'WORKER_ALREADY_RUNNING'})
 stop.abort();assert.equal(count,1);resolve();assert.deepEqual(await running,{status:'STOPPED'})
 assert.deepEqual(events,[{event:'QUALITY_TICK_COMPLETED',incidentId:ids[0],status:'PATCH_READY'}])
 assert.deepEqual(await worker.step({signal:stop.signal}),{status:'STOPPED',processed:0})
})

test('An unknown dispatch is not retried in memory; restart presents the same native incident for reconciliation',async()=>{
 const id=randomUUID(),nonce=randomUUID(),stop=new AbortController(),events=[];let pending=null,calls=0,dispatches=0
 const store={listDue:async()=>[id]}
 const controller={tick:async actual=>{assert.equal(actual,id);calls++;if(!pending){pending={nonce};dispatches++;throw Error('private input must not reach telemetry')}
  assert.equal(pending.nonce,nonce);stop.abort();return {status:'REPRODUCED'}}}
 const worker=createQualityWorker({store,controller,onEvent:e=>events.push(e)})
 await assert.rejects(worker.run({signal:stop.signal}),{code:'WORKER_TICK_FAILED'})
 assert.equal(calls,1);assert.equal(dispatches,1)
 assert.deepEqual(await worker.run({signal:stop.signal}),{status:'STOPPED'})
 assert.equal(calls,2);assert.equal(dispatches,1)
 assert(!JSON.stringify(events).includes('private input'))
})

test('Queue substitution and duplicate incidents stop before dispatch; telemetry failure does not repeat a tick',async()=>{
 const id=randomUUID();let calls=0
 for(const ids of [[id,id],['foreign-id'],Array.from({length:21},()=>randomUUID())]){
  const worker=createQualityWorker({store:{listDue:async()=>ids},controller:{tick:async()=>{calls++;return {status:'BUSY'}}}})
  await assert.rejects(worker.step(),{code:'WORKER_QUEUE_INVALID'})
 }
 assert.equal(calls,0)
 const worker=createQualityWorker({store:{listDue:async()=>[id]},controller:{tick:async()=>{calls++;return {status:'BUSY'}}},onEvent:()=>{throw Error('monitor unavailable')}})
 assert.deepEqual(await worker.step(),{status:'COMPLETE',processed:1});assert.equal(calls,1)
})

test('The poll is bounded and abortable and requires an explicit shutdown signal',async()=>{
 const stop=new AbortController();let calls=0,pauses=0
 const store={listDue:async()=>{calls++;return []}},controller={tick:async()=>{throw Error('no incident')}}
 const worker=createQualityWorker({store,controller,pollMs:1000,wait:async(ms,signal)=>{assert.equal(ms,1000);assert.equal(signal,stop.signal);pauses++;stop.abort()}})
 await assert.rejects(worker.run(),{code:'WORKER_STOP_SIGNAL_REQUIRED'})
 assert.deepEqual(await worker.run({signal:stop.signal}),{status:'STOPPED'});assert.equal(calls,1);assert.equal(pauses,1)
 for(const pollMs of [0,999,30001,NaN])assert.throws(()=>createQualityWorker({store,controller,pollMs}),{code:'WORKER_CONFIGURATION_REQUIRED'})
})
