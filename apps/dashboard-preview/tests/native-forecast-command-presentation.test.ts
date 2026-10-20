import assert from 'node:assert/strict'
import test from 'node:test'
import {nativeForecastCommandFromUi,nativeForecastCommandOutcome,parseNativeForecastCommand,nativeForecastCompletionPlan} from '../lib/benchmark-forecast/native-command-presentation'
import {createEmbeddedForecastSubmitter} from '../lib/platform/native-embedded-command'
import type {EmbeddedCommandRequest} from '@profitia/platform-contracts/embedded-command-channel'
const current={kind:'CURRENT',modelId:'naive',targetSemantics:'MONTHLY_AVERAGE'} as const
test('existing four models and target choices map only to the original CURRENT or VERIFICATION domain fields',()=>{
  for(const model of['naive','damped_holt','ets','arima'] as const)for(const kind of['CURRENT','VERIFICATION'] as const){
    assert.deepEqual(nativeForecastCommandFromUi(model,'POINT_IN_TIME',kind),{kind,modelId:model,targetSemantics:'ROLLING_DAILY_POINT_IN_TIME'})
    assert.equal(nativeForecastCommandFromUi(model,'END_OF_PERIOD',kind)?.targetSemantics,'END_OF_PERIOD')
  }
  for(const patch of[{kind:'INGEST'},{modelId:'unknown'},{targetSemantics:'UNKNOWN'},{organisationId:'forged'},{userId:'forged'},{seriesId:'another'},{endpoint:'https://foreign.test'}])assert.equal(parseNativeForecastCommand({...current,...patch}),null)
})
test('only a closed202 acceptance means ACCEPTED, never a queued, preparing or ready scientific state',()=>{
  assert.equal(nativeForecastCommandOutcome(202,{status:'ACCEPTED'}),'ACCEPTED')
  for(const body of[null,{status:'READY'},{status:'QUEUED'},{status:'ACCEPTED',requestId:'private'}])assert.equal(nativeForecastCommandOutcome(202,body),'UNKNOWN')
  assert.equal(nativeForecastCommandOutcome(200,{status:'ACCEPTED'}),'UNKNOWN')
  for(const status of[401,403])assert.equal(nativeForecastCommandOutcome(status,null),'DENIED')
  assert.equal(nativeForecastCommandOutcome(429,null),'LIMIT_REACHED');assert.equal(nativeForecastCommandOutcome(409,null),'UNKNOWN')
})
test('explicit ambiguous retries retain intent across model/kind changes; only observed completion allows a fresh later request',async()=>{
  const requests:EmbeddedCommandRequest[]=[],ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333']
  let generated=0
  const submitter=createEmbeddedForecastSubmitter({async submit(request){requests.push(request);return{status:503,body:null}}},()=>ids[generated++])
  assert.equal(await submitter.submit(current),'UNKNOWN');assert.equal(requests.length,1)
  assert.equal(await submitter.submit({...current,kind:'VERIFICATION'}),'UNKNOWN')
  assert.equal(await submitter.submit(current),'UNKNOWN')
  assert.equal(requests[0].intentId,requests[2].intentId);assert.notEqual(requests[0].intentId,requests[1].intentId)
  assert.equal(generated,2,'No automatic retry or replacement of an ambiguous intent')
  submitter.observeCompletion({...current,modelId:'arima'});await submitter.submit(current);assert.equal(generated,2)
  submitter.observeCompletion(current);await submitter.submit(current);assert.equal(generated,3)
})
test('abort observation is propagated without replacing intent or presenting acceptance',async()=>{
  const seen:string[]=[];let generated=0
  const submitter=createEmbeddedForecastSubmitter({async submit(request){seen.push(request.intentId);throw new DOMException('cancelled','AbortError')}},()=>{generated++;return'11111111-1111-4111-8111-111111111111'})
  await assert.rejects(submitter.submit(current),e=>e instanceof Error&&e.name==='AbortError');await assert.rejects(submitter.submit(current),e=>e instanceof Error&&e.name==='AbortError')
  assert.equal(generated,1);assert.equal(seen[0],seen[1])
})

test('accepted Current is read again only after scientific readiness; idle presentation does not poll for unrequested verification',async()=>{
  const requests:EmbeddedCommandRequest[]=[],ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222']
  let generated=0
  const submitter=createEmbeddedForecastSubmitter({async submit(request){requests.push(request);return{status:202,body:{status:'ACCEPTED'}}}},()=>ids[generated++])
  const selection={modelId:'naive',targetBasis:'MONTHLY_AVERAGE'} as const
  const idle=nativeForecastCompletionPlan({...selection,currentReadiness:'READY',pending:null})
  assert.equal(idle.poll,false);assert.equal(idle.refreshCurrent,false)
  const state=await submitter.submit(current)
  const pending={kind:'CURRENT',state} as const
  const waiting=nativeForecastCompletionPlan({...selection,currentReadiness:'NOT_PREPARED',pending})
  assert.equal(waiting.poll,true);assert.equal(waiting.refreshCurrent,false);assert.equal(waiting.clearPending,false)
  const ready=nativeForecastCompletionPlan({...selection,currentReadiness:'READY',fullVerificationReadiness:'NOT_PREPARED',pending})
  assert.equal(ready.poll,false);assert.equal(ready.refreshCurrent,true);assert.equal(ready.clearPending,true)
  for(const command of ready.completed)submitter.observeCompletion(command)
  const displayed=nativeForecastCompletionPlan({...selection,currentReadiness:'READY',pending:null})
  assert.equal(displayed.poll,false);assert.equal(displayed.refreshCurrent,false,'Clearing the observed intent prevents repeated reads')
  assert.equal(requests.length,1,'Readiness must not create another preparation request')
  await submitter.submit(current);assert.notEqual(requests[0].intentId,requests[1].intentId)
})

test('Fast verification does not complete a full command; completed daily calibration refreshes Current without new work',()=>{
  const selection={modelId:'naive',targetBasis:'POINT_IN_TIME',currentReadiness:'READY',pending:{kind:'VERIFICATION',state:'ACCEPTED'}} as const
  const fast=nativeForecastCompletionPlan({...selection,fullVerificationReadiness:'NOT_PREPARED'})
  assert.equal(fast.poll,true);assert.equal(fast.clearPending,false);assert.equal(fast.refreshCurrent,false)
  assert.equal(fast.refreshVerification,false)
  assert.deepEqual(fast.completed.map(command=>command.kind),['CURRENT'])
  const full=nativeForecastCompletionPlan({...selection,fullVerificationReadiness:'READY'})
  assert.equal(full.poll,false);assert.equal(full.clearPending,true);assert.equal(full.refreshCurrent,true)
  assert.equal(full.refreshVerification,true)
  assert.deepEqual(full.completed.map(command=>command.kind),['CURRENT','VERIFICATION'])
  assert.equal(nativeForecastCompletionPlan({...selection,targetBasis:'MONTHLY_AVERAGE',fullVerificationReadiness:'READY'}).refreshCurrent,false)
})

test('full monthly verification replaces the Fast view once, without refreshing Current or submitting new scientific work',()=>{
  const selection={modelId:'naive',targetBasis:'MONTHLY_AVERAGE',currentReadiness:'READY',fullVerificationReadiness:'READY'} as const
  const completed=nativeForecastCompletionPlan({...selection,pending:{kind:'VERIFICATION',state:'ACCEPTED'}})
  assert.equal(completed.refreshVerification,true);assert.equal(completed.refreshCurrent,false);assert.equal(completed.clearPending,true)
  const displayed=nativeForecastCompletionPlan({...selection,pending:null})
  assert.equal(displayed.refreshVerification,false);assert.equal(displayed.poll,false)
  for(const state of ['SENDING','DENIED','INVALID','LIMIT_REACHED'] as const){
    assert.equal(nativeForecastCompletionPlan({...selection,pending:{kind:'VERIFICATION',state}}).refreshVerification,false)
  }
  assert.equal(nativeForecastCompletionPlan({...selection,pending:{kind:'CURRENT',state:'ACCEPTED'}}).refreshVerification,false)
})

test('sending, denied and limited commands are never polled or promoted by acknowledgement; ambiguous intent waits for actual readiness',()=>{
  for(const state of ['SENDING','DENIED','LIMIT_REACHED','INVALID'] as const){
    const plan=nativeForecastCompletionPlan({modelId:'ets',targetBasis:'POINT_IN_TIME',currentReadiness:'READY',pending:{kind:'CURRENT',state}})
    assert.equal(plan.poll,false);assert.equal(plan.refreshCurrent,false)
    if(state==='SENDING')assert.equal(plan.clearPending,false)
  }
  for(const readiness of ['NOT_PREPARED','STALE','FAILED']){
    const plan=nativeForecastCompletionPlan({modelId:'ets',targetBasis:'POINT_IN_TIME',currentReadiness:readiness,pending:{kind:'CURRENT',state:'UNKNOWN'}})
    assert.equal(plan.poll,true);assert.equal(plan.refreshCurrent,false);assert.equal(plan.clearPending,false)
  }
  const completed=nativeForecastCompletionPlan({modelId:'ets',targetBasis:'POINT_IN_TIME',currentReadiness:'READY',pending:{kind:'CURRENT',state:'UNKNOWN'}})
  assert.equal(completed.refreshCurrent,true);assert.equal(completed.poll,false)
})
