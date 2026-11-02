import test from 'node:test'
import assert from 'node:assert/strict'
import {captureModelExecution,assertModelRequest,assertModelDescriptor,standardModelCostMicroUsd,modelResponseObservation} from '../src/model-execution.mjs'
const policy={schemaDigest:'a'.repeat(64),profileId:'oil-pilot-v1',model:'gpt-6.1-sol',maximumInputTokens:15000,maximumOutputTokens:8000,maximumBodyBytes:65536,reservationMicroUsd:150000,timeoutMs:120000}
const body={model:policy.model,store:false,reasoning:{effort:'medium'},service_tier:'default',max_output_tokens:8000,input:[{role:'user',content:'evidence'}],text:{format:{type:'json_schema',strict:true,name:'report',schema:{type:'object',properties:{},additionalProperties:false}}}}
test('closed policy is immutable, bounded and has no global model fallback',()=>{
 assert(Object.isFrozen(captureModelExecution(policy)))
 for(const patch of [{model:'gpt-5.6-luna'},{maximumInputTokens:15001},{maximumOutputTokens:8001},{maximumBodyBytes:65537},{reservationMicroUsd:150001},{timeoutMs:20000},{tools:[]}])assert.throws(()=>captureModelExecution({...policy,...patch}))
})
test('strict Responses body refuses tools, background, storage, fallback and excess bytes',()=>{
 assertModelRequest(policy,JSON.stringify(body))
 for(const patch of [{tools:[]},{background:false},{store:true},{model:'gpt-5.6-luna'},{max_output_tokens:8001},{service_tier:'priority'},{reasoning:{effort:'high'}},{input:[{role:'user',content:'x'.repeat(65536)}]}])assert.throws(()=>assertModelRequest(policy,JSON.stringify({...body,...patch})))
})
test('descriptor must independently confirm exact policy and USD hold',()=>{
 const d={modelSchemaVersion:'1.0.0',modelSchemaDigest:policy.schemaDigest,modelPolicyVersion:'1',modelProfileId:policy.profileId,model:policy.model,modelMaximumInputTokens:15000,modelMaximumOutputTokens:8000,modelMaximumBodyBytes:65536,modelReservationMicroUsd:150000,timeoutMs:120000,modelMaximumAttempts:1,modelExpiresAt:new Date(Date.now()+3600000).toISOString(),modelRequestIdHeader:'x-request-id',modelClientRequestIdHeader:'x-client-request-id'}
 assertModelDescriptor(policy,d)
 for(const patch of [{modelMaximumAttempts:2},{timeoutMs:20000},{modelSchemaDigest:'b'.repeat(64)},{modelReservationMicroUsd:0},{modelExpiresAt:'unconfirmed'}])assert.throws(()=>assertModelDescriptor(policy,{...d,...patch}))
})
test('integer USD upper estimate includes output reasoning; unknown usage stays unknown',()=>{
 assert.equal(standardModelCostMicroUsd({input_tokens:15000,output_tokens:8000}),117500)
 assert.equal(standardModelCostMicroUsd({input_tokens:15000,output_tokens:8000,input_tokens_details:{cached_tokens:15000}}),81500)
 for(const usage of [null,{}, {input_tokens:-1,output_tokens:1},{input_tokens:1,output_tokens:1,input_tokens_details:{cached_tokens:2}}])assert.equal(standardModelCostMicroUsd(usage),null)
 assert.equal(modelResponseObservation({status:'completed',usage:null}).costMicroUsd,null)
 assert.equal(modelResponseObservation({status:'incomplete'}).status,'INCOMPLETE')
 assert.equal(modelResponseObservation({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]}).status,'REFUSED')
})
