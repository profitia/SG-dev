import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel'
import type {ChartReference,SupplierReference} from '../../../../packages/assistant-context-contracts/src/index.mjs'
import type {AssistantConversationTransport,AssistantConversationError,AssistantStreamEvent,AssistantSource,AssistantMessage} from './assistant-conversation-session'
type View={locale:'pl'|'en';module:'appshell'|'benchmark_finder'|'xray'|'adp';reference:ChartReference|SupplierReference|null}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const fail=(code:AssistantConversationError='UNAVAILABLE'):never=>{throw Object.assign(Error('Conversation unavailable'),{code})}
function sources(v:unknown):readonly AssistantSource[]{
 if(!Array.isArray(v)||v.length>4||v.some(s=>!record(s)||typeof s.id!=='string'||s.id.length>512||typeof s.label!=='string'||s.label.length>1024
  ||s.asOf!==null&&(typeof s.asOf!=='string'||s.asOf.length>40)||!['OK','EMPTY','PARTIAL','DENIED','UNAVAILABLE','STALE'].includes(String(s.status))))return fail()
 return v as AssistantSource[]
}
function message(v:unknown):AssistantMessage{
 if(!record(v)||!uuid(v.id)||!['user','assistant'].includes(String(v.role))||typeof v.content!=='string'||v.content.length>64000
  ||!['complete','interrupted','failed'].includes(String(v.status)))return fail()
 return {id:v.id,role:v.role as 'user'|'assistant',content:v.content,status:v.status as 'complete'|'interrupted'|'failed',sources:sources(v.sources)}
}
/** Same-origin bearer-only transport. References select views, never authority. */
export function createAssistantConversationTransport(options:{getToken:()=>Promise<string|null>;view:()=>View;fetch?:typeof fetch}):AssistantConversationTransport{
 const send=options.fetch??globalThis.fetch
 async function request(path:string,signal:AbortSignal,body?:unknown,method?:'DELETE'){
  const token=await options.getToken()
  if(signal.aborted)throw signal.reason
  if(!token)return fail('AUTH_REQUIRED')
  const response=await send('/api/assistant/'+path,{method:method??(body===undefined?'GET':'POST'),headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},
   body:body===undefined?undefined:JSON.stringify(body),signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'})
  if(!response.ok){await response.body?.cancel();return fail(response.status===401?'AUTH_REQUIRED':response.status===403?'DENIED':response.status===429?'LIMIT_EXCEEDED':response.status===409?'INTERRUPTED':'UNAVAILABLE')}
  return response
 }
 return {
  async remove(id,signal){if(!uuid(id))return fail();const v=await readPresentationJson(await request('history/'+id,signal,undefined,'DELETE'),4096);if(!record(v)||v.deleted!==true)return fail()},
  async list(signal){
   const v=await readPresentationJson(await request('history',signal),1048576)
   if(!record(v)||!Array.isArray(v.items)||v.items.length>200)return fail()
   return v.items.map(item=>{if(!record(item)||!uuid(item.id)||typeof item.title!=='string'||item.title.length>200||typeof item.updatedAt!=='string'||!Number.isFinite(Date.parse(item.updatedAt)))return fail()
    return {id:item.id,title:item.title,updatedAt:item.updatedAt}})
  },
  async load(id,signal){
   if(!uuid(id))return fail()
   const v=await readPresentationJson(await request('history/'+id,signal),4194304)
   if(!record(v)||v.id!==id||!Array.isArray(v.messages)||v.messages.length>400)return fail()
   return {id,messages:v.messages.map(message)}
  },
  async *send(input,signal){
   const view=options.view(),response=await request('conversation',signal,{...input,...view})
   if(response.headers.get('content-type')?.split(';')[0]!=='application/x-ndjson'){await response.body?.cancel();return fail()}
   const reader=response.body?.getReader();if(!reader)return fail()
   const decoder=new TextDecoder('utf-8',{fatal:true});let buffer='',bytes=0
   try{for(;;){
    const part=await reader.read();if(signal.aborted)throw signal.reason
    if(part.done){buffer+=decoder.decode();if(buffer.trim())return fail();break}
    bytes+=part.value.byteLength;if(bytes>1048576)return fail()
    buffer+=decoder.decode(part.value,{stream:true});if(buffer.length>70000)return fail()
    let end:number
    while((end=buffer.indexOf('\n'))>=0){
     const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line)continue
     const event:unknown=JSON.parse(line);if(!record(event))return fail()
     if(event.type==='started'&&uuid(event.conversationId)&&uuid(event.turnId))yield {type:'started',conversationId:event.conversationId,turnId:event.turnId}
     else if(event.type==='delta'&&typeof event.text==='string'&&event.text.length<=64000)yield {type:'delta',text:event.text}
     else if(event.type==='completed')yield {type:'completed',sources:sources(event.sources)}
     else if(event.type==='error'&&['AUTH_REQUIRED','DENIED','LIMIT_EXCEEDED','UNAVAILABLE','INTERRUPTED','CONTEXT_CHANGED'].includes(String(event.code)))yield event as AssistantStreamEvent
     else return fail()
    }
   }}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
  },
 }
}
