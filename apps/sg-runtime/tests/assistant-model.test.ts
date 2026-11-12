// Keep the actual chart regression in the existing required assistant test entry.
import './assistant-chart-context.test'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {createAssistantUsageStore} from '@profitia/platform-contracts/assistant-usage'
import {createAssistantModel,adaptAssistantUsageQuery} from '../lib/assistant/model'

test('native Limits denials survive Prisma wrapping without another query or exposing database text',async()=>{
 for(const reason of ['LIMIT_EXCEEDED','IDEMPOTENCY_CONFLICT','POLICY_UNAVAILABLE']){
  let queries=0
  const query=adaptAssistantUsageQuery(async()=>{queries++;throw Object.assign(Error('PRIVATE_DATABASE_DETAIL'),{code:'P2010',meta:{code:'P0001',message:'ERROR: '+reason}})})
  const usage=createAssistantUsageStore({query,schemaDigest:'a'.repeat(64),commandKey:'b'.repeat(64)})
  await assert.rejects(()=>usage.reserve({actorId:randomUUID(),organisationId:randomUUID(),commandId:randomUUID(),decisionId:randomUUID(),input:[{role:'user',content:'Synthetic question'}],expectedPolicy:{id:randomUUID(),assignmentId:randomUUID(),assignmentRevision:1}}),(error:any)=>error.code===reason&&!error.message.includes('PRIVATE_DATABASE_DETAIL'))
  assert.equal(queries,1)
 }
 for(const original of [Object.assign(Error('LIMIT_EXCEEDED'),{code:'OTHER',meta:{code:'P0001',message:'ERROR: LIMIT_EXCEEDED'}}),Object.assign(Error('unknown'),{code:'P2010',meta:{code:'42501',message:'ERROR: LIMIT_EXCEEDED'}}),Object.assign(Error('unknown'),{code:'P2010',meta:{code:'P0001',message:'ERROR: LIMIT_EXCEEDED private detail'}}),null]){
  const query=adaptAssistantUsageQuery(async()=>{throw original})
  await assert.rejects(()=>query('SELECT 1'),error=>error===original)
 }
})
test('reading disabled assistant configuration leaves legacy provider environment initialisation lazy',()=>{
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',`
  import assert from 'node:assert/strict';
  const {readAssistantConfiguration}=await import('./lib/assistant/runtime.ts');
  assert.equal(readAssistantConfiguration({}),null);
  process.env.MACROBOND_CLIENT_ID='SYNTHETIC_AFTER_CONFIGURATION_IMPORT';
  const {serverEnv}=await import('./lib/env.ts');
  assert.equal(serverEnv.MACROBOND_CLIENT_ID,'SYNTHETIC_AFTER_CONFIGURATION_IMPORT');
 `],{cwd:new URL('../',import.meta.url),encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
})
const input=()=>[{role:'user' as const,content:'SYNTHETIC question'}]
function fixture(events?:()=>AsyncIterable<unknown>){
 const commands:any[]=[],posts:any[]=[],executionId=randomUUID(),schemaDigest='a'.repeat(64)
 const usage=createAssistantUsageStore({schemaDigest,commandKey:'b'.repeat(64),query:async(_sql,values)=>{
  const d=JSON.parse(String(values[0]));commands.push(d)
  return {rows:[{result:{...d,environment:'development',applicationId:'spendguru',projectId:'lingering-thunder-05075810',branchId:'br-green-hall-b9s837k0',databaseName:'neondb',runtimeRole:'profitia_limits_assistant_runtime',schemaDigest,executionId,
   expiresAt:new Date(Date.now()+20000).toISOString(),status:({RESERVE:'RESERVED',DISPATCH:'DISPATCHED',SETTLE:'SETTLED',RELEASE:'RELEASED',PENDING:'PENDING_RECONCILIATION'} as Record<string,string>)[d.action]}}]}
 }})
 const client:any={responses:{inputTokens:{count:async()=>({object:'response.input_tokens',input_tokens:20})},create:async(body:any,options:any)=>{
  posts.push({body,options})
  return events?events():(async function*(){
   yield {type:'response.output_text.delta',delta:'Hello '};yield {type:'response.output_text.delta',delta:'world'}
   yield {type:'response.completed',response:{id:'resp_SYNTHETIC',model:'gpt-5.6-luna',status:'completed',service_tier:'default',usage:{input_tokens:20,output_tokens:6,total_tokens:26,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:0}}}}
  })()
 }}}
 const model=createAssistantModel(client,usage),signal=new AbortController()
 const prepare=async(value=input())=>{
  await model.validateInput(value,signal.signal)
  const admission=await usage.reserve({actorId:randomUUID(),organisationId:randomUUID(),commandId:randomUUID(),decisionId:randomUUID(),input:value,
   expectedPolicy:{id:randomUUID(),assignmentId:randomUUID(),assignmentRevision:1}})
  return {value,admission}
 }
 return {commands,posts,usage,model,client,signal,prepare,executionId}
}
test('isolated model protocol streams text and records actual usage once after durable dispatch',async()=>{
 const f=fixture(),{value,admission}=await f.prepare(),deltas:string[]=[]
 const result=await f.model.generate({input:value,admission,signal:f.signal.signal,beforeDispatch:async()=>{},publish:async text=>{deltas.push(text)}})
 assert.equal(result,'Hello world');assert.equal(deltas.join(''),'Hello world')
 assert.deepEqual(f.commands.map(c=>c.action),['RESERVE','DISPATCH','SETTLE']);assert.equal(f.posts.length,1)
 const {body,options}=f.posts[0];assert.equal(body.store,false);assert.equal(body.stream,true);assert.equal(body.max_output_tokens,2048)
 assert.equal(body.reasoning.effort,'none');assert.equal(body.prompt_cache_options.mode,'explicit');assert.equal(body.service_tier,'default')
 assert.equal(body.tools,undefined);assert.equal(body.previous_response_id,undefined);assert.equal(options.maxRetries,0)
 assert.equal(options.headers['X-Client-Request-Id'],f.executionId)
 assert.equal(f.commands[2].usage.totalTokens,26);assert.equal(f.commands[2].usage.nanoUsd,'11200')
 await assert.rejects(()=>f.model.generate({input:value,admission,signal:f.signal.signal,beforeDispatch:async()=>{},publish:async()=>{}}))
 assert.equal(f.posts.length,1,'a reused generation cannot create a second provider POST')
})
test('revocation before dispatch releases a known unused reservation without a provider POST',async()=>{
 const f=fixture(),{value,admission}=await f.prepare()
 await assert.rejects(()=>f.model.generate({input:value,admission,signal:f.signal.signal,beforeDispatch:async()=>{throw Object.assign(Error('SYNTHETIC'),{code:'DENIED'})},publish:async()=>{}}))
 assert.equal(f.posts.length,0);assert.deepEqual(f.commands.map(c=>c.action),['RESERVE','RELEASE'])
})
test('cancellation and changed access after dispatch retain the upper bound without automatic retry or zero settlement',async()=>{
 for(const reason of ['CANCELLED','CONTEXT_CHANGED','DENIED']){
  const f=fixture(),{value,admission}=await f.prepare()
  await assert.rejects(()=>f.model.generate({input:value,admission,signal:f.signal.signal,beforeDispatch:async()=>{},publish:async()=>{
   if(reason==='CANCELLED')f.signal.abort();else throw Object.assign(Error('SYNTHETIC'),{code:reason})
  }}))
  assert.equal(f.posts.length,1);assert.deepEqual(f.commands.map(c=>c.action),['RESERVE','DISPATCH','PENDING'])
  assert.equal(f.commands[2].reason,reason==='CONTEXT_CHANGED'?'INTERRUPTED':reason==='DENIED'?'AUTH_REVOKED':'CANCELLED')
  assert.equal(f.commands.some(c=>c.action==='RELEASE'||c.action==='SETTLE'),false)
 }
})
test('missing or inconsistent actual usage remains unverified instead of being billed as zero',async()=>{
 const f=fixture(async function*(){yield {type:'response.output_text.delta',delta:'partial'};yield {type:'response.completed',response:{id:'resp_SYNTHETIC',model:'gpt-5.6-luna',status:'completed',service_tier:'default'}}})
 const {value,admission}=await f.prepare()
 await assert.rejects(()=>f.model.generate({input:value,admission,signal:f.signal.signal,beforeDispatch:async()=>{},publish:async()=>{}}))
 assert.deepEqual(f.commands.map(c=>c.action),['RESERVE','DISPATCH','PENDING']);assert.equal(f.commands[2].reason,'USAGE_UNVERIFIED')
})
test('a changed counted input or an oversized provider count refuses before generation',async()=>{
 const f=fixture(),{value,admission}=await f.prepare();value[0].content='changed after counting'
 await assert.rejects(()=>f.model.generate({input:value,admission,signal:f.signal.signal,beforeDispatch:async()=>{},publish:async()=>{}}))
 assert.equal(f.posts.length,0);assert.deepEqual(f.commands.map(c=>c.action),['RESERVE','RELEASE'])
 const g=fixture();g.client.responses.inputTokens.count=async()=>({object:'response.input_tokens',input_tokens:1000000})
 await assert.rejects(()=>g.model.validateInput(input(),g.signal.signal));assert.equal(g.posts.length,0);assert.equal(g.commands.length,0)
})
