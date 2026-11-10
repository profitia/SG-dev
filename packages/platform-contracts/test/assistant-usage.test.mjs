import test from 'node:test'
import assert from 'node:assert/strict'
import {createAssistantUsageStore,assistantInputBound,readAssistantUsage,takeAssistantAdmission,ASSISTANT_PRICING} from '../src/assistant-usage.mjs'
const id=n=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`
const now=Date.parse('2026-11-09T12:00:00Z'),schemaDigest='a'.repeat(64),input=[{role:'user',content:'private prompt never in the ledger'}]
const request={actorId:id('1'),organisationId:id('2'),commandId:id('3'),decisionId:id('4'),input,expectedPolicy:{id:id('6'),assignmentId:id('7'),assignmentRevision:1}}
const usage=()=>({input_tokens:1000,output_tokens:200,total_tokens:1200,
 input_tokens_details:{cached_tokens:200,cache_write_tokens:300,cache_write_tokens_details:{ttl_30m_tokens:200,ttl_12h_tokens:100}},output_tokens_details:{reasoning_tokens:100}})
function fixture(){
 const commands=[],descriptor={environment:'development',applicationId:'spendguru',projectId:'lingering-thunder-05075810',branchId:'br-green-hall-b9s837k0',databaseName:'neondb',runtimeRole:'profitia_limits_assistant_runtime',schemaDigest}
 let status='RESERVED'
 const store=createAssistantUsageStore({commandKey:'b'.repeat(64),schemaDigest,now:()=>now,query:async(sql,args)=>{
  assert.equal(sql,'SELECT profitia_limits.assistant_usage($1::text,$2::text) AS result')
  const command=JSON.parse(args[0]);commands.push(command);assert(!args[0].includes(input[0].content));assert.match(args[1],/^[a-f0-9]{64}$/)
  if(command.action==='RESERVE')return{rows:[{result:{...descriptor,...command,status,executionId:id('5'),expiresAt:new Date(now+20000).toISOString()}}]}
  status=command.action==='DISPATCH'?'DISPATCHED':command.action==='SETTLE'?'SETTLED':command.action==='RELEASE'?'RELEASED':'PENDING_RECONCILIATION'
  return{rows:[{result:{...descriptor,status,executionId:id('5')}}]}
 }})
 return{store,commands}
}
test('actual price partitions input, cached reads and both writes without adding reasoning or cached tokens twice',()=>{
 const result=readAssistantUsage(usage(),ASSISTANT_PRICING.model)
 assert.equal(result.nanoUsd,'444000');assert.equal(result.totalTokens,1200);assert.equal(result.reasoningTokens,100)
 for(const edit of [u=>u.total_tokens++,u=>u.input_tokens_details.cached_tokens=900,u=>u.output_tokens_details.reasoning_tokens=201,
  u=>delete u.input_tokens_details.cache_write_tokens,u=>u.input_tokens_details.cache_write_tokens_details.ttl_12h_tokens=-1]){
  const changed=usage();edit(changed);assert.throws(()=>readAssistantUsage(changed,ASSISTANT_PRICING.model))
 }
 assert.throws(()=>readAssistantUsage(usage(),'unpriced-model'))
})
test('the bound covers the worst supported cache rate and bounded output; unsupported inputs deny before a provider call',()=>{
 const bound=assistantInputBound(input);assert.equal(bound.outputTokens,2048)
 assert.equal(BigInt(bound.nanoUsd),BigInt(bound.inputTokens)*500n+2048n*1200n)
 assert.throws(()=>assistantInputBound([{role:'user',content:'x'.repeat(32769)}]))
 assert.throws(()=>assistantInputBound([{role:'user',content:'x',tool:'hidden'}]))
 assert.throws(()=>assistantInputBound([{role:'tool',content:'x'}]))
})
test('real reserve and durable dispatch are required before the one model call, and copies/reuse cannot dispatch',async()=>{
 const{store,commands}=fixture(),admission=await store.reserve(request)
 assert.throws(()=>takeAssistantAdmission(admission,{inputDigest:admission.inputDigest,now}))
 await store.dispatch(admission)
 assert.throws(()=>takeAssistantAdmission({...admission},{inputDigest:admission.inputDigest,now}))
 assert.throws(()=>takeAssistantAdmission(admission,{inputDigest:'c'.repeat(64),now}))
 takeAssistantAdmission(admission,{inputDigest:admission.inputDigest,now})
 assert.throws(()=>takeAssistantAdmission(admission,{inputDigest:admission.inputDigest,now}))
 await assert.rejects(()=>store.dispatch(admission))
 const actual=await store.settle(admission,{usage:usage(),model:ASSISTANT_PRICING.model,responseId:'resp_example'})
 assert.equal(actual.nanoUsd,'444000');assert.deepEqual(commands.map(c=>c.action),['RESERVE','DISPATCH','SETTLE'])
})
test('known pre-dispatch failures release; dispatched uncertainty keeps its reservation for reconciliation',async()=>{
 const one=fixture(),unused=await one.store.reserve(request);await one.store.release(unused)
 assert.throws(()=>takeAssistantAdmission(unused,{inputDigest:unused.inputDigest,now}))
 const two=fixture(),used=await two.store.reserve(request);await two.store.dispatch(used)
 await assert.rejects(()=>two.store.release(used));await two.store.pending(used,'INTERRUPTED')
 assert.deepEqual(two.commands.map(c=>c.action),['RESERVE','DISPATCH','PENDING'])
})
test('another database/role binding or a replay cannot mint a model admission',async()=>{
 const store=createAssistantUsageStore({commandKey:'b'.repeat(64),schemaDigest,now:()=>now,query:async()=>({rows:[{result:{status:'RESERVED',environment:'production'}}]})})
 await assert.rejects(()=>store.reserve(request))
 assert.throws(()=>takeAssistantAdmission({status:'RESERVED'},{inputDigest:'a'.repeat(64),now}))
})
