import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {boundAgentRequest,createCostBroker} from '../src/openai-broker.mjs'
import {CODE_PRICING} from '../src/budget.mjs'

const token='a'.repeat(64),request=()=>({model:CODE_PRICING.model,input:[{role:'user',content:'Synthetic coding fixture'}],stream:true})
const complete=()=>({id:'resp_synthetic',model:CODE_PRICING.model,service_tier:'default',usage:{input_tokens:100,output_tokens:10,total_tokens:110,input_tokens_details:{cached_tokens:0,cache_write_tokens:0},output_tokens_details:{reasoning_tokens:5}}})
test('Broker bounds model/tier/cache/output and rejects project files, remote conversations and hosted tools',()=>{
 const r=boundAgentRequest({...request(),store:true,max_output_tokens:100000});assert.equal(r.store,false);assert.equal(r.max_output_tokens,8192);assert.equal(r.service_tier,'default')
 for(const change of [r=>r.model='other',r=>r.service_tier='priority',r=>r.previous_response_id='resp_other',r=>r.conversation='other',r=>r.input=[{type:'item_reference',id:'other'}],
  r=>r.input=[{role:'user',content:[{type:'input_file',file_id:'file_other_project'}]}],r=>r.tools=[{type:'web_search'}],r=>r.tools=[{type:'namespace',tools:[{type:'code_interpreter'}]}]]){
  const v=request();change(v);assert.throws(()=>boundAgentRequest(v))
 }
 assert.equal(boundAgentRequest({...request(),tools:[{type:'function',name:'local_shell',parameters:{type:'object'}}]}).tools[0].type,'function')
})
async function exercise({limit=false,uncertain=false,missingUsage=false,wrongAuth=false,crlf=false,streamError=false}={}){
 const events=[];let inference=0
 const budget={assertPermit:async()=>{events.push('permit');if(limit)throw Object.assign(Error('Limit'),{code:'LIMIT_EXCEEDED'})},reserveRequest:async(_,r)=>(events.push('reserve'),{...r,status:'RESERVED'}),dispatchRequest:async()=>{events.push('dispatch')},settleRequest:async()=>{events.push('settle')},markUnknown:async(_,r)=>{events.push('unknown:'+r)}}
 const broker=createCostBroker({budget,permit:{permitId:randomUUID()},bearerToken:token,openaiKey:'synthetic-upstream-key-not-a-credential',fetcher:async(url,o)=>{
  assert.equal(o.redirect,'error');assert.equal(o.headers.Authorization,'Bearer synthetic-upstream-key-not-a-credential')
  if(url.endsWith('/input_tokens')){events.push('count');return Response.json({object:'response.input_tokens',input_tokens:100})}
  assert.equal(url,'https://api.openai.com/v1/responses');inference++;events.push('post');assert(events.indexOf('dispatch')<events.indexOf('post'))
  if(uncertain)throw Error('Synthetic lost reply')
  const r=complete();if(missingUsage)delete r.usage.input_tokens_details.cached_tokens
  const eol=crlf?'\r\n':'\n'
  const payload=streamError?{type:'error',message:'synthetic-sensitive-provider-detail'}:{type:'response.completed',response:r}
  return new Response('event: '+payload.type+eol+'data: '+JSON.stringify(payload)+eol+eol,{headers:{'content-type':'text/event-stream'}})
 }})
 const url=await broker.listen()
 try{
  const r=await fetch(url+'/responses',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+(wrongAuth?'b'.repeat(64):token)},body:JSON.stringify(request())});const text=await r.text()
  return {status:r.status,events,inference,text}
 }finally{await broker.close()}
}
test('OFFLINE loopback: native reservation and dispatch precede the only model POST; exact terminal usage settles',async()=>{
 const r=await exercise();assert.equal(r.status,200);assert.equal(r.inference,1);assert.deepEqual(r.events,['permit','count','reserve','dispatch','post','settle'])
})
test('OFFLINE loopback: exhausted budget or wrong local token makes zero provider requests',async()=>{
 for(const options of [{limit:true},{wrongAuth:true}]){const r=await exercise(options);assert.equal(r.inference,0);assert(!r.events.includes('count'))}
})
test('OFFLINE loopback: unknown delivery or usage retains the reservation without a hidden retry',async()=>{
 const a=await exercise({uncertain:true});assert.equal(a.inference,1);assert(a.events.includes('unknown:PROVIDER_ERROR'));assert(!a.events.includes('settle'))
 const b=await exercise({missingUsage:true});assert.equal(b.inference,1);assert(b.events.includes('unknown:USAGE_UNVERIFIED'));assert(!b.events.includes('settle'))
})
test('OFFLINE loopback: CRLF streams settle and provider errors never expose upstream details',async()=>{
 const good=await exercise({crlf:true});assert(good.events.includes('settle'));assert(good.text.includes('response.completed'))
 const bad=await exercise({streamError:true});assert(!bad.text.includes('synthetic-sensitive-provider-detail'));assert(bad.text.includes('AQC_UPSTREAM_ERROR'));assert(bad.events.includes('unknown:STREAM_INCOMPLETE'))
})
