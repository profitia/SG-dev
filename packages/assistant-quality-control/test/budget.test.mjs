import test from 'node:test'
import assert from 'node:assert/strict'
import {createHmac,randomUUID} from 'node:crypto'
import {CODE_PRICING,quoteCodeRequest,readCodeUsage,createQualityBudget} from '../src/budget.mjs'

const key='a'.repeat(64),schema='b'.repeat(64),service=randomUUID(),role='profitia_limits_quality_controller'
const usage=()=>({input_tokens:100,output_tokens:10,total_tokens:110,input_tokens_details:{cached_tokens:10,cache_write_tokens:20,cache_write_tokens_details:{ttl_30m_tokens:20,ttl_12h_tokens:0}},output_tokens_details:{reasoning_tokens:5}})
test('Quote reserves the highest permitted cache tariff and all output including reasoning',()=>{
 assert.equal(quoteCodeRequest(100,10).maximumNanoUsd,'600000')
 assert.equal(readCodeUsage(usage(),{model:CODE_PRICING.model,serviceTier:'default',quote:quoteCodeRequest(100,10)}).nanoUsd,'291000')
 for(const n of [0,-1,200001,NaN,Infinity])assert.throws(()=>quoteCodeRequest(n))
 assert.throws(()=>quoteCodeRequest(100,8193))
})
test('Missing/invalid usage, unpriced tier/model and overrun never release reserved cost',()=>{
 const q=quoteCodeRequest(100,10),opts={model:CODE_PRICING.model,serviceTier:'default',quote:q}
 for(const change of [u=>delete u.input_tokens_details.cached_tokens,u=>delete u.input_tokens_details.cache_write_tokens_details,u=>u.input_tokens_details.cached_tokens=101,
  u=>u.output_tokens_details.reasoning_tokens=11,u=>u.total_tokens=111,u=>{u.input_tokens=101;u.total_tokens=111},u=>{u.output_tokens=11;u.total_tokens=111}]){
  const u=usage();change(u);assert.throws(()=>readCodeUsage(u,opts))
 }
 assert.throws(()=>readCodeUsage(usage(),{...opts,serviceTier:'priority'}));assert.throws(()=>readCodeUsage(usage(),{...opts,model:'unreviewed-model'}))
})
test('Limits adapter binds exact existing authority, role, service, digest and authenticated command',async()=>{
 let command
 const descriptor={applicationId:'spendguru',environment:'development',projectId:'lingering-thunder-05075810',branchId:'br-green-hall-b9s837k0',databaseName:'neondb',runtimeRole:role,schemaDigest:schema,serviceId:service}
 const query=async(sql,args)=>{
  assert.equal(sql,'SELECT profitia_limits.quality_usage($1::text,$2::text) AS result')
  assert.equal(args[1],createHmac('sha256',Buffer.from(key,'hex')).update(args[0]).digest('hex'))
  command=JSON.parse(args[0]);assert.equal(command.serviceId,service);assert.equal(command.schemaDigest,schema);assert.equal(command.until,11000)
  return {rows:[{result:{...descriptor,incidentId:command.incidentId,maximumNanoUsd:'5000000000',acceptanceNanoUsd:'1000000000',status:'HELD'}}]}
 }
 const b=createQualityBudget({query,commandKey:key,schemaDigest:schema,serviceId:service,role,now:()=>1000})
 const id=randomUUID();await b.ensureIncident(id,{repairClass:'C1',causeFingerprint:'c'.repeat(64),acceptanceRequired:true});assert.equal(command.action,'HOLD_INCIDENT')
 assert(!('prompt'in command)&&!('accountId'in command)&&!('output'in command))
 for(const changed of [{environment:'production'},{projectId:'other'},{runtimeRole:'owner'},{schemaDigest:'d'.repeat(64)}]){
  const bad=createQualityBudget({query:async()=>({rows:[{result:{...descriptor,...changed}}]}),commandKey:key,schemaDigest:schema,serviceId:service,role})
  await assert.rejects(()=>bad.status(),{code:'LIMITS_BINDING_MISMATCH'})
 }
})
test('Native limit refusal propagates without attempting another model request',async()=>{
 let calls=0;const b=createQualityBudget({query:async()=>{calls++;throw Object.assign(Error('LIMIT_EXCEEDED'),{code:'P0001'})},commandKey:key,schemaDigest:schema,serviceId:service,role})
 await assert.rejects(()=>b.ensureIncident(randomUUID(),{repairClass:'C1',causeFingerprint:'e'.repeat(64),acceptanceRequired:true}),{code:'LIMIT_EXCEEDED'});assert.equal(calls,1)
})
