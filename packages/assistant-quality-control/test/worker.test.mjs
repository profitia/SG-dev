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

test('technical worker exposes connected disabled stores without opening the model ledger',async()=>{
 const {createQualityReadiness}=await import('../src/cli.mjs')
 let calls=0
 const readiness=createQualityReadiness({store:{descriptor:async()=>{calls++;return{enabled:false}}},
  budget:{status:async()=>{calls++;return{status:'DISABLED',pilotStartedAt:null,pilotExpiresAt:null,maximumNanoUsd:'50000000000',committedNanoUsd:'0'}}},
  sourceSha:'a'.repeat(40),serviceId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now:()=>Date.parse('2026-11-17T08:00:00Z')})
 const r=await readiness.check();assert.equal(r.status,'MONITORING_READY');assert.equal(r.paidRepairsEnabled,false)
 assert.equal(r.promotionEnabled,false);assert.equal(r.pilotStartedAt,null);assert.equal(calls,2)
})
test('technical readiness cannot reset an existing pilot, allow spending or accept enabled stores',async()=>{
 const {createQualityReadiness}=await import('../src/cli.mjs')
 for(const change of [{control:true},{status:'ENABLED'},{pilotStartedAt:'2026-11-17T08:00:00Z'},{pilotExpiresAt:'2026-12-01T08:00:00Z'},{committedNanoUsd:'1'},{maximumNanoUsd:'100000000000'}]){
  const readiness=createQualityReadiness({store:{descriptor:async()=>({enabled:change.control??false})},
   budget:{status:async()=>({status:'DISABLED',pilotStartedAt:null,pilotExpiresAt:null,maximumNanoUsd:'50000000000',committedNanoUsd:'0',...change})},
   sourceSha:'a'.repeat(40),serviceId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})
  await assert.rejects(()=>readiness.check(),{code:'READINESS_SAFETY_STATE_INVALID'})
 }
})
test('worker requires exact Development database roles, strict TLS, no model/publisher key and disabled switches',async()=>{
 const {readQualityReadinessConfiguration}=await import('../src/cli.mjs')
 const env={TARGET_ENVIRONMENT:'development',AQC_MODE:'TECHNICAL_READINESS',AQC_PAID_REPAIRS_ENABLED:'false',AQC_PROMOTION_ENABLED:'false',
  RENDER_SERVICE_ID:'srv-aaaaaaaaaaaaaaaaaaaa',RENDER_GIT_COMMIT:'a'.repeat(40),AQC_SERVICE_UUID:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  AQC_CONTROL_COMMAND_KEY:'b'.repeat(64),AQC_LIMITS_COMMAND_KEY:'c'.repeat(64),
  AQC_CONTROL_DATABASE_URL:'postgresql://sg2_assistant_quality_controller:synthetic@ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  AQC_LIMITS_DATABASE_URL:'postgresql://profitia_limits_quality_controller:synthetic@ep-muddy-surf-b9vpyy2d.c-7.eu-central-1.aws.neon.tech/neondb?sslmode=require'}
 const c=readQualityReadinessConfiguration(env)
 assert.equal(c.control.ssl.rejectUnauthorized,true);assert.equal(c.control.user,'sg2_assistant_quality_controller')
 assert.equal(c.limits.user,'profitia_limits_quality_controller')
 for(const change of [{TARGET_ENVIRONMENT:'production'},{AQC_PAID_REPAIRS_ENABLED:'true'},{AQC_PROMOTION_ENABLED:'true'},{AQC_MODE:'repair'},
  {OPENAI_API_KEY:'synthetic'},{RENDER_API_KEY:'synthetic'},{GITHUB_TOKEN:'synthetic'},
  {AQC_CONTROL_COMMAND_KEY:env.AQC_LIMITS_COMMAND_KEY},{AQC_CONTROL_DATABASE_URL:env.AQC_CONTROL_DATABASE_URL.replace('sg2_assistant_quality_controller','sg2_assistant_history_owner')},
  {AQC_CONTROL_DATABASE_URL:env.AQC_CONTROL_DATABASE_URL.replace('ep-muddy-pine-b22pdyqd.c-6.eu-central-1.aws.neon.tech','example.test')},
  {AQC_CONTROL_DATABASE_URL:env.AQC_CONTROL_DATABASE_URL.replace('sslmode=require','sslmode=disable')},
  {AQC_LIMITS_DATABASE_URL:env.AQC_LIMITS_DATABASE_URL+'&options=-csuperuser=on'}])
  assert.throws(()=>readQualityReadinessConfiguration({...env,...change}),{code:'READINESS_CONFIGURATION_INVALID',...(!['TARGET_ENVIRONMENT','AQC_PAID_REPAIRS_ENABLED','AQC_PROMOTION_ENABLED','AQC_MODE','OPENAI_API_KEY','RENDER_API_KEY','GITHUB_TOKEN','AQC_CONTROL_COMMAND_KEY'].some(k=>Object.hasOwn(change,k))?{code:'READINESS_DATABASE_BINDING_INVALID'}:{})})
})
