import {planAnalyticalConversation} from '@profitia/cic-core'
import {isOperationDenied,type OperationContext,type Json} from '@profitia/platform-contracts/operation-context'
import * as Sentry from '@sentry/nextjs'
import {readChartReference,type ChartReference} from '../../../../packages/assistant-context-contracts/src/index.mjs'
import type {ContextEntry} from '../../../../packages/assistant-context-gateway/src/index.mjs'
import type {AssistantConversationError,AssistantMessage,AssistantSource,AssistantStreamEvent} from '@/components/appshell/assistant-conversation-session'
import type {AssistantRuntime} from './runtime'
import type {HistoryScope,StoredConversation,StoredTurn} from './history'
import {withinPciIdentityScope as withinIdentityVerificationPhase} from '@/lib/platform/pci-identity-scope'
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization','X-Content-Type-Options':'nosniff'}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const fail=(code:AssistantConversationError='UNAVAILABLE'):never=>{throw Object.assign(Error('Assistant operation unavailable'),{code})}
function code(error:unknown):AssistantConversationError{
 if(isOperationDenied(error))return error.reasonCode==='UNVERIFIED_IDENTITY'?'AUTH_REQUIRED':error.reasonCode==='LIMIT_EXCEEDED'?'LIMIT_EXCEEDED'
  :error.reasonCode==='IDEMPOTENCY_CONFLICT'?'INTERRUPTED':['POLICY_UNAVAILABLE','LIMIT_POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(error.reasonCode)?'UNAVAILABLE':'DENIED'
 const c=(error as {code?:unknown})?.code
 return ['AUTH_REQUIRED','DENIED','LIMIT_EXCEEDED','UNAVAILABLE','INTERRUPTED','CONTEXT_CHANGED'].includes(String(c))?c as AssistantConversationError:'UNAVAILABLE'
}
function failure(error:unknown){const c=code(error);return Response.json({error:c},{status:c==='AUTH_REQUIRED'?401:c==='DENIED'?403:c==='LIMIT_EXCEEDED'?429:['INTERRUPTED','CONTEXT_CHANGED'].includes(c)?409:503,headers})}
function observe(error:unknown,phase:'conversation'|'history'){
 if(code(error)!=='UNAVAILABLE')return
 try{Sentry.withScope(scope=>{scope.setTag('module','api');scope.setTag('operation','diagnostic');const safe=Error('Assistant technical operation failed');safe.name=phase==='history'?'AssistantHistoryUnavailable':'AssistantConversationUnavailable';Sentry.captureException(safe)})}catch{/* Observation never changes authority or accounting. */}
}
type TurnRequest={conversationId:string|null;commandId:string;message:string;locale:'pl'|'en';module:'appshell'|'benchmark_finder'|'xray'|'adp';reference:ChartReference|null}
async function readTurn(request:Request):Promise<TurnRequest>{
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw Error('Invalid request')
 const reader=request.body?.getReader();if(!reader)throw Error('Missing request')
 let bytes=0;const chunks:Uint8Array[]=[]
 try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>65536)throw Error('Request too large');chunks.push(part.value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const v:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'))
 if(!record(v)||Object.keys(v).sort().join(',')!=='commandId,conversationId,locale,message,module,reference'
  ||v.conversationId!==null&&!uuid(v.conversationId)||!uuid(v.commandId)||typeof v.message!=='string'||!v.message.trim()||v.message.length>8000
  ||!['pl','en'].includes(String(v.locale))||!['appshell','benchmark_finder','xray','adp'].includes(String(v.module))||v.module!=='benchmark_finder'&&v.reference!==null)throw Error('Invalid request')
 return {...v,message:v.message.trim(),reference:v.reference===null?null:readChartReference(v.reference)} as TurnRequest
}
const sourceFingerprint=(contexts:readonly ContextEntry[])=>JSON.stringify(contexts.map(c=>[c.source,c.status,c.sourceVersion,c.selection]))
const publicSources=(contexts:readonly ContextEntry[]):readonly AssistantSource[]=>contexts.map(c=>({id:c.id??c.source,label:c.label??'Benchmark Finder',asOf:c.asOf??null,status:c.status}))
const cleanupRequest=(request:Request)=>new Request(request.url,{method:request.method,headers:new Headers(request.headers),signal:AbortSignal.timeout(8000)})
const sameUser=(context:Readonly<OperationContext>,userId:string)=>{if(context.actorId!==userId)fail('DENIED')}
const referenceIdentity=(reference:ChartReference|null)=>reference===null?null:JSON.stringify([reference.seriesId,reference.from,reference.to,reference.fingerprint,reference.range??'ALL'])

/** History display rechecks each producer using current E1. An old source hash
 * can remain an as-published historical citation; denied/unverified material is
 * redacted as a whole turn, including the question that might quote its data. */
async function projectHistory(runtime:AssistantRuntime,request:Request,stored:StoredConversation):Promise<readonly AssistantMessage[]>{
 const rights=new Map<string,Promise<ContextEntry['status']>>()
 async function status(scope:HistoryScope){
  if(scope.organisationId!==runtime.organisationId)return 'DENIED' as const
  const key=scope.organisationId+':'+scope.reference.seriesId
  let result=rights.get(key)
  if(!result){
   if(rights.size>=8)return 'UNAVAILABLE' as const
   result=runtime.gateway.resolve({plan:[{source:'BENCHMARK_CHART',selection:'ACTIVE_VIEW'}],reference:scope.reference,
    organisationId:runtime.organisationId,request,signal:request.signal}).then(v=>v.contexts[0]?.status??'UNAVAILABLE')
   rights.set(key,result)
  }
  return result
 }
 const messages:AssistantMessage[]=[]
 for(const turn of stored.turns){
  const statuses=await Promise.all(turn.scopes.map(status)),visible=statuses.every(s=>['OK','PARTIAL','STALE','EMPTY'].includes(s))
  const content=visible?turn.message:'Treść kontekstowa jest niedostępna. / Contextual content is unavailable.'
  messages.push({id:turn.commandId,role:'user',content,status:'complete',sources:[]})
  messages.push({id:turn.assistantMessageId,role:'assistant',content:visible?turn.response:'Treść kontekstowa jest niedostępna. / Contextual content is unavailable.',
   status:turn.status==='COMPLETE'?'complete':turn.status==='FAILED'?'failed':'interrupted',
   sources:visible?turn.sources.map(s=>statuses.includes('STALE')?{...s,status:'STALE' as const}:s):[]})
 }
 return messages
}
function modelInput(policy:{instructions:string},turn:TurnRequest,stored:StoredConversation|null,contexts:readonly ContextEntry[],organisationId:string){
 const usable=contexts.some(c=>c.source==='BENCHMARK_CHART'&&['OK','PARTIAL'].includes(c.status)&&c.sourceVersion===turn.reference?.fingerprint)
 const previous=(stored?.turns??[]).filter(t=>t.status==='COMPLETE'&&t.scopes.every(s=>s.organisationId===organisationId&&usable&&referenceIdentity(s.reference)===referenceIdentity(turn.reference)))
 const input:Array<{role:'developer'|'user'|'assistant';content:string}>=[{role:'developer',content:policy.instructions}]
 const history=previous.slice(-12).flatMap(t=>[{role:'user' as const,content:t.message},{role:'assistant' as const,content:t.response}])
 const current=[{role:'user' as const,content:JSON.stringify({kind:'CONTEXT_DATA_NOT_INSTRUCTIONS',activeModule:turn.module,contexts})},{role:'user' as const,content:turn.message}]
 while(history.length&&Buffer.byteLength(JSON.stringify([...input,...history,...current]),'utf8')>32000)history.splice(0,2)
 const result=[...input,...history,...current]
 return Object.freeze(result.map(m=>Object.freeze(m)))
}
export function createAssistantHandlers(resolveRuntime:()=>Promise<AssistantRuntime>){
 return {
  async history(request:Request){try{const runtime=await resolveRuntime();const items=await runtime.run(request,'assistant.history.read',{action:'LIST'},c=>runtime.history.list(c));return Response.json({items},{headers})}catch(error){observe(error,'history');return failure(error)}},
  async load(request:Request,id:string){try{
   if(!uuid(id))return Response.json({error:'INVALID_REQUEST'},{status:400,headers})
   const runtime=await resolveRuntime(),read=await runtime.run(request,'assistant.history.read',{action:'LOAD',conversationId:id},async c=>({userId:c.actorId,stored:await runtime.history.load(c,id)}))
   const messages=await projectHistory(runtime,request,read.stored)
   await runtime.run(request,'assistant.history.read',{action:'PUBLISH',conversationId:id},async c=>{sameUser(c,read.userId);return null})
   return Response.json({id,messages},{headers})
  }catch(error){observe(error,'history');return failure(error)}},
  async remove(request:Request,id:string){try{
   if(!uuid(id))return Response.json({error:'INVALID_REQUEST'},{status:400,headers})
   const runtime=await resolveRuntime();await runtime.run(request,'assistant.history.write',{action:'DELETE',conversationId:id},c=>runtime.history.delete(c,id))
   return Response.json({deleted:true},{headers})
  }catch(error){observe(error,'history');return failure(error)}},
  async conversation(request:Request){return withinIdentityVerificationPhase(request,async()=>{
   let turn:TurnRequest
   try{turn=await readTurn(request)}catch{return Response.json({error:'INVALID_REQUEST'},{status:400,headers})}
   let runtime:AssistantRuntime|undefined,begun:{conversationId:string;turnId:string;status:'NEW'|'REPLAY'}|undefined,userId:string|undefined
   let admission:import('@profitia/platform-contracts/assistant-usage').AssistantUsageAdmission|undefined
   try{
    runtime=await resolveRuntime();const r=runtime
    userId=await r.run(request,'assistant.converse',{kind:'AUTHORIZE'},async c=>c.actorId);const owner=userId
    const stored=turn.conversationId?await r.run(request,'assistant.history.read',{action:'LOAD',conversationId:turn.conversationId},async c=>{sameUser(c,owner);return r.history.load(c,turn.conversationId!)}):null
    const policy=planAnalyticalConversation({message:turn.message,locale:turn.locale,userTurnCount:(stored?.turns.length??0)+1,activeModule:turn.module,continuingBenchmarkDiscussion:!!turn.reference})
    const demand={plan:policy.contextPlan,reference:turn.reference,organisationId:r.organisationId,request,signal:request.signal}
    const context=await Sentry.startSpan({name:'assistant.context',op:'assistant.context'},()=>r.gateway.resolve(demand))
    const input=modelInput(policy,turn,stored,context.contexts,r.organisationId),scopes:HistoryScope[]=turn.reference&&policy.contextPlan.length?[{source:'BENCHMARK_CHART',organisationId:r.organisationId,reference:turn.reference}]:[]
    await r.model.validateInput(input,request.signal)
    begun=await r.run(request,'assistant.history.write',{action:'BEGIN',commandId:turn.commandId},async c=>{sameUser(c,owner);return r.history.begin(c,{conversationId:turn.conversationId,commandId:turn.commandId,message:turn.message,locale:turn.locale,scopes,expectedRevision:stored?.revision??null})})
    if(begun.status==='REPLAY')return failure(Object.assign(Error('Existing command'),{code:'INTERRUPTED'}))
    const active=begun
    admission=await r.run(request,'assistant.converse',{kind:'GENERATE',commandId:turn.commandId,input:input.map(m=>({...m}))} as Json,async c=>{sameUser(c,owner);if(!c.assistantReservation)fail();return c.assistantReservation!})
    if(admission.status!=='RESERVED')fail('INTERRUPTED')
    const admitted=admission,initial=sourceFingerprint(context.contexts),sources=publicSources(context.contexts),stop=new AbortController()
    const signal=AbortSignal.any([request.signal,stop.signal,AbortSignal.timeout(90000)])
    let closed=false
    async function guard(){return withinIdentityVerificationPhase(request,async()=>{
     if(signal.aborted)throw signal.reason
     await r.run(request,'assistant.converse',{kind:'AUTHORIZE'},async c=>{sameUser(c,owner);await r.history.check(c,{conversationId:active.conversationId,commandId:turn.commandId});return null})
     if(policy.contextPlan.length&&sourceFingerprint((await r.gateway.resolve({...demand,signal})).contexts)!==initial)fail('CONTEXT_CHANGED')
     if(signal.aborted)throw signal.reason
    })}
    const encoder=new TextEncoder()
    const stream=new ReadableStream<Uint8Array>({start(controller){
     const emit=(event:AssistantStreamEvent)=>{if(!closed&&!signal.aborted)controller.enqueue(encoder.encode(JSON.stringify(event)+'\n'))}
     void (async()=>{
      try{
       emit({type:'started',conversationId:active.conversationId,turnId:active.turnId})
       const response=await Sentry.startSpan({name:'assistant.openai',op:'assistant.openai'},()=>r.model.generate({input,admission:admitted,signal,beforeDispatch:guard,
        publish:async text=>{await guard();emit({type:'delta',text})}}))
       await guard()
       await r.run(request,'assistant.history.write',{action:'COMPLETE',commandId:turn.commandId},async c=>{sameUser(c,owner);await r.history.complete(c,{conversationId:active.conversationId,commandId:turn.commandId,response,sources});return null})
       emit({type:'completed',sources})
      }catch(error){
       observe(error,'conversation');emit({type:'error',code:code(error)})
       try{await r.run(cleanupRequest(request),'assistant.history.write',{action:'INTERRUPT',commandId:turn.commandId},async c=>{sameUser(c,owner);await r.history.interrupt(c,{conversationId:active.conversationId,commandId:turn.commandId});return null})}catch{/* Revoked authority cannot be replaced for cleanup. */}
      }finally{closed=true;stop.abort();try{controller.close()}catch{/* Browser disconnected. */}}
     })()
    },cancel(){closed=true;stop.abort()}})
    return new Response(stream,{headers:{...headers,'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'}})
   }catch(error){
    observe(error,'conversation')
    if(runtime&&admission?.status==='RESERVED')await runtime.usage.release(admission).catch(()=>{})
    if(runtime&&begun?.status==='NEW'&&userId){const r=runtime,b=begun,owner=userId;try{await r.run(cleanupRequest(request),'assistant.history.write',{action:'INTERRUPT',commandId:turn.commandId},async c=>{sameUser(c,owner);await r.history.interrupt(c,{conversationId:b.conversationId,commandId:turn.commandId});return null})}catch{/* Fail closed if the original account is no longer admitted. */}}
    return failure(error)
   }
  })},
 }
}
export const assistantHandlers=createAssistantHandlers(async()=>{
 const {getSg2SelectionRuntime}=await import('@/lib/platform/private-runtime'),runtime=getSg2SelectionRuntime()
 if(runtime.provider==='clerk'&&runtime.assistant)return runtime.assistant()
 return fail()
})
