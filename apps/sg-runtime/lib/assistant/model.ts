import OpenAI from 'openai'
import {assistantInputBound,takeAssistantAdmission,ASSISTANT_PRICING,type AssistantUsageAdmission,createAssistantUsageStore} from '@profitia/platform-contracts/assistant-usage'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
import type {AccessQuery} from '@profitia/platform-contracts/access-store'
type Input=readonly {role:'developer'|'user'|'assistant';content:string}[]
type Usage=ReturnType<typeof createAssistantUsageStore>
const fail=(code='UNAVAILABLE'):never=>{throw Object.assign(Error('Assistant model unavailable'),{code})}
/** Preserve the native Limits refusal across Prisma's raw-query wrapper.
 * Only an exact, known PostgreSQL application error can cross this adapter. */
export function adaptAssistantUsageQuery(query:AccessQuery):AccessQuery{
 return async(sql,values=[])=>{
  try{return await query(sql,values)}catch(error){
   const e=error as {code?:unknown;meta?:{code?:unknown;message?:unknown}}
   if(e?.code==='P2010'&&e.meta?.code==='P0001'&&typeof e.meta.message==='string'){
    const reason=/^(?:ERROR:\s*)?(LIMIT_EXCEEDED|IDEMPOTENCY_CONFLICT|POLICY_UNAVAILABLE)$/.exec(e.meta.message.trim())?.[1]
    if(reason)throw Object.assign(Error(reason),{code:'P0001'})
   }
   throw error
  }
 }
}
/** Exactly one generation, no automatic retry, tools, remote conversation,
 * response storage or variable private-content cache write. */
export function createAssistantModel(client:OpenAI,usage:Usage){
 const prepared=new WeakMap<object,{digest:string;expiresAt:number}>()
 return Object.freeze({
  async validateInput(input:Input,signal:AbortSignal){
   const bound=assistantInputBound(input)
   const counted=await client.responses.inputTokens.count({model:ASSISTANT_PRICING.model,input:[...input],reasoning:{effort:'none'}},{signal,maxRetries:0,timeout:10000})
   if(counted.object!=='response.input_tokens'||!Number.isSafeInteger(counted.input_tokens)||counted.input_tokens<1||counted.input_tokens>bound.inputTokens)return fail('LIMIT_EXCEEDED')
   prepared.set(input,{digest:bound.inputDigest,expiresAt:Date.now()+25000})
   return bound
  },
  async generate(options:{input:Input;admission:AssistantUsageAdmission;signal:AbortSignal;beforeDispatch:()=>Promise<void>;publish:(delta:string)=>Promise<void>}){
   let dispatched=false,taken=false,settled=false,usageUnverified=false,responseText=''
   try{
    const bound=assistantInputBound(options.input),checked=prepared.get(options.input)
    if(!checked||checked.digest!==bound.inputDigest||checked.expiresAt<=Date.now())return fail()
    prepared.delete(options.input)
    const input=options.input.map(m=>Object.freeze({...m}))
    await options.beforeDispatch()
    if(options.signal.aborted)throw options.signal.reason
    // DISPATCH is durable before the only model POST. An uncertain dispatch
    // response cannot release the upper bound or automatically execute again.
    dispatched=true;await usage.dispatch(options.admission)
    takeAssistantAdmission(options.admission,{inputDigest:bound.inputDigest});taken=true
    const stream=await client.responses.create({model:ASSISTANT_PRICING.model,input,stream:true,store:false,
     max_output_tokens:bound.outputTokens,reasoning:{effort:'none'},service_tier:'default',prompt_cache_options:{mode:'explicit',ttl:'30m'},
    },{signal:options.signal,maxRetries:0,timeout:60000,headers:{'X-Client-Request-Id':options.admission.executionId}})
    let terminal=false,successful=false,pending='',lastFlush=0
    for await(const event of stream){
     if(options.signal.aborted)throw options.signal.reason
     if(terminal)return fail()
     if(event.type==='response.output_text.delta'){
      if(typeof event.delta!=='string'||responseText.length+event.delta.length>64000)return fail()
      responseText+=event.delta;pending+=event.delta
      // One authorised flush per batch; the host performs fresh current E1
      // and producer checks before any buffered text reaches the browser.
      if(lastFlush===0||Date.now()-lastFlush>=1000){await options.publish(pending);pending='';lastFlush=Date.now()}
     }else if(['response.completed','response.incomplete','response.failed'].includes(event.type)){
      const r=(event as {response:OpenAI.Responses.Response}).response;terminal=true
      usageUnverified=true
      if(!r?.usage||r.service_tier!=='default')return fail()
      await usage.settle(options.admission,{usage:r.usage,model:r.model,responseId:r.id});settled=true
      usageUnverified=false
      successful=event.type==='response.completed'&&r.status==='completed'
     }else if(event.type==='error')return fail()
    }
    if(!terminal||!successful||!responseText.trim())return fail('INTERRUPTED')
    if(pending)await options.publish(pending)
    return responseText
   }catch(error){
    if(!settled){
     if(!dispatched){await usage.release(options.admission).catch(()=>{})}
     else {
      const c=(error as {code?:string})?.code,revoked=isOperationDenied(error)&&!['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(error.reasonCode)||c==='DENIED'||c==='AUTH_REQUIRED'
      await usage.pending(options.admission,options.signal.aborted?'CANCELLED':revoked?'AUTH_REVOKED':c==='CONTEXT_CHANGED'?'INTERRUPTED':usageUnverified||!taken?'USAGE_UNVERIFIED':'PROVIDER_ERROR').catch(()=>{})
     }
    }
    throw error
   }
  },
 })
}
export type AssistantModel=ReturnType<typeof createAssistantModel>
