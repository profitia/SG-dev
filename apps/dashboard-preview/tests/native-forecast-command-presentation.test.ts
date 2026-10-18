import assert from 'node:assert/strict'
import test from 'node:test'
import {nativeForecastCommandFromUi,nativeForecastCommandOutcome,parseNativeForecastCommand} from '../lib/benchmark-forecast/native-command-presentation'
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
