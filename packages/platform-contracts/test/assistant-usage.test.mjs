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

function countedFixture({tokens=1000,counter,onDenied,denial,clock=()=>now}={}){
 const commands=[],counts=[];
 const descriptor={environment:'development',applicationId:'spendguru',projectId:'lingering-thunder-05075810',branchId:'br-green-hall-b9s837k0',databaseName:'neondb',runtimeRole:'profitia_limits_assistant_runtime',schemaDigest};
 const store=createAssistantUsageStore({commandKey:'b'.repeat(64),schemaDigest,now:clock,onDenied,
  countInputTokens:async value=>{counts.push(value);return counter?counter(value):{object:'response.input_tokens',input_tokens:tokens}},
  query:async(sql,args)=>{
   assert.equal(sql,'SELECT profitia_limits.assistant_usage($1::text,$2::text) AS result')
   const d=JSON.parse(args[0]);commands.push(d);assert(!args[0].includes('private prompt never in the ledger'))
   return {rows:[{result:{...descriptor,...d,...(denial?{status:'DENIED',reason:'LIMIT_EXCEEDED',diagnostics:denial(d)}:
    {status:d.action==='DISPATCH'?'DISPATCHED':d.action==='SETTLE'?'SETTLED':'RESERVED',executionId:id('5'),expiresAt:new Date(clock()+20000).toISOString()})}}]}
  }});
 return {store,commands,counts}
}
test('exact server count reserves the full 2048 output while a large textual context fits available capacity',async()=>{
 const f=countedFixture({tokens:5211}),large={...request,input:[{role:'developer',content:'x'.repeat(20000)},{role:'user',content:'Synthetic ECR context'},{role:'user',content:'Synthetic calendar question'}]}
 const p=await f.store.prepareInput(large),a=await f.store.reserve(large)
 assert.equal(p.inputTokens,5211);assert.equal(a.inputTokens,5211);assert.equal(a.outputTokens,2048)
 assert.equal(a.inputTokens+a.outputTokens,7259);assert(a.inputTokens+a.outputTokens<=26777)
 assert(assistantInputBound(large.input).inputTokens+2048>26777)
 assert.equal(f.commands[0].inputTokens,5211);assert.equal(f.commands[0].outputTokens,2048)
 assert.equal(f.commands[0].nanoUsd,(5211n*500n+2048n*1200n).toString())
 assert.equal(f.counts.length,1);assert.equal(f.counts[0].model,ASSISTANT_PRICING.model)
 assert(Object.isFrozen(f.counts[0].input));assert(Object.isFrozen(f.counts[0].input[0]))
 await f.store.dispatch(a);takeAssistantAdmission(a,{inputDigest:a.inputDigest,now})
 const actual={input_tokens:5211,output_tokens:377,total_tokens:5588,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}
 assert.equal((await f.store.settle(a,{usage:actual,model:ASSISTANT_PRICING.model,responseId:'resp_exact'})).totalTokens,5588)
})
test('JSON token counts cannot mint admission; count records bind actor, organisation, command and exact input',async()=>{
 for(const edit of [r=>r.actorId=id('9'),r=>r.organisationId=id('9'),r=>r.commandId=id('9'),r=>r.input=[{role:'user',content:'different'}]]){
  const f=countedFixture();await f.store.prepareInput(request)
  const changed={...request};edit(changed)
  await assert.rejects(()=>f.store.reserve(changed),e=>e.code==='IDEMPOTENCY_CONFLICT');assert.equal(f.commands.length,0)
 }
 const f=countedFixture()
 await assert.rejects(()=>f.store.reserve({...request,inputTokens:1}),e=>e.code==='IDEMPOTENCY_CONFLICT')
 assert.equal(f.commands.length,0);assert.equal(f.counts.length,0)
})
test('invalid, unavailable, cancelled or mutated provider counting fails closed without falling back to bytes',async()=>{
 for(const result of [{object:'wrong',input_tokens:1},{object:'response.input_tokens',input_tokens:0},{object:'response.input_tokens',input_tokens:1.5},{object:'response.input_tokens',input_tokens:1000000}]){
  const f=countedFixture({counter:async()=>result});await assert.rejects(()=>f.store.prepareInput(request));assert.equal(f.commands.length,0)
  await assert.rejects(()=>f.store.reserve(request));assert.equal(f.commands.length,0)
 }
 const unavailable=countedFixture({counter:async()=>{throw Error('Synthetic unavailable')}})
 await assert.rejects(()=>unavailable.store.prepareInput(request));assert.equal(unavailable.commands.length,0)
 const cancelled=countedFixture(),signal=new AbortController();signal.abort()
 await assert.rejects(()=>cancelled.store.prepareInput({...request,signal:signal.signal}));assert.equal(cancelled.counts.length,0)
 const changed={...request,input:[{role:'user',content:'mutable synthetic'}]}
 const mutation=countedFixture({counter:async()=>{changed.input[0].content='changed during count';return{object:'response.input_tokens',input_tokens:1}}})
 await assert.rejects(()=>mutation.store.prepareInput(changed));assert.equal(mutation.commands.length,0)
})
test('count leases expire and cannot be consumed twice or recounted while the same operation is in flight',async()=>{
 let time=now;const expired=countedFixture({clock:()=>time});await expired.store.prepareInput(request);time+=25001
 await assert.rejects(()=>expired.store.reserve(request));assert.equal(expired.commands.length,0)
 const f=countedFixture();await f.store.prepareInput(request);await f.store.prepareInput(request);assert.equal(f.counts.length,1)
 await f.store.reserve(request);await assert.rejects(()=>f.store.reserve(request));assert.equal(f.commands.length,1)
 await assert.rejects(()=>f.store.prepareInput(request));assert.equal(f.counts.length,1)
 let finish;const parallel=countedFixture({counter:()=>new Promise(resolve=>{finish=resolve})})
 const pending=parallel.store.prepareInput(request)
 await assert.rejects(()=>parallel.store.prepareInput(request));assert.equal(parallel.counts.length,1)
 finish({object:'response.input_tokens',input_tokens:1000});await pending
})
test('native quota diagnostics retain only closed numerical fields and never create an admission or leak content',async()=>{
 const captured=[],diagnostics=d=>({version:'1.0.0',scope:'ASSIGNMENT',metric:'OPENAI_TOTAL_TOKENS',unit:'TOKENS',available:'2000',consumed:'118000',limit:'120000',required:String(d.inputTokens+d.outputTokens),inputTokens:d.inputTokens,outputTokens:d.outputTokens})
 const f=countedFixture({onDenied:d=>captured.push(d),denial:diagnostics});await f.store.prepareInput(request)
 await assert.rejects(()=>f.store.reserve(request),e=>e.code==='LIMIT_EXCEEDED')
 assert.equal(captured.length,1);assert.equal(captured[0].required,'3048');assert.equal(captured[0].available,'2000')
 assert.equal(captured[0].commandId,request.commandId);assert.equal(captured[0].model,ASSISTANT_PRICING.model)
 assert(!JSON.stringify(captured).includes(input[0].content));assert(Object.isFrozen(captured[0]))
 assert.equal(f.commands.length,1);assert.equal(f.commands[0].action,'RESERVE')
 for(const edit of [d=>({...d,privateText:'MUST_NOT_LOG'}),d=>({...d,available:'private data'}),d=>({...d,inputTokens:1}),d=>({...d,metric:'ARBITRARY'}),d=>({...d,scope:'OTHER'})]){
  const bad=countedFixture({onDenied:d=>captured.push(d),denial:d=>edit(diagnostics(d))});await bad.store.prepareInput(request)
  await assert.rejects(()=>bad.store.reserve(request),e=>e.code==='LIMIT_EXCEEDED');assert.equal(captured.length,1)
 }
 const unavailableLog=countedFixture({onDenied:()=>{throw Error('Synthetic log failure')},denial:diagnostics});await unavailableLog.store.prepareInput(request)
 await assert.rejects(()=>unavailableLog.store.reserve(request),e=>e.code==='LIMIT_EXCEEDED')
})
