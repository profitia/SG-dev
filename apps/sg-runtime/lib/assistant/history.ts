import {createHmac} from 'node:crypto'
import type {OperationContext} from '@profitia/platform-contracts/operation-context'
import type {AccessQuery} from '@profitia/platform-contracts/access-store'
import {readContextReference,type ContextReference} from '../../../../packages/assistant-context-contracts/src/index.mjs'
import type {AssistantSource} from '@/components/appshell/assistant-conversation-session'
export type HistoryScope=Readonly<{source:ContextReference['source'];organisationId:string;reference:ContextReference;viewIdentity?:string;sourceVersion?:string|null;privateKys?:boolean;privateKysUntil?:string;requiredRecordIds?:readonly string[]}>
export type StoredTurn=Readonly<{id:string;commandId:string;assistantMessageId:string;message:string;response:string;status:'QUEUED'|'COMPLETE'|'INTERRUPTED'|'FAILED';scopes:readonly HistoryScope[];sources:readonly AssistantSource[];createdAt:string}>
export type StoredConversation=Readonly<{id:string;revision:number;turns:readonly StoredTurn[]}>
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const fail=(code='UNAVAILABLE'):never=>{throw Object.assign(Error('Conversation history unavailable'),{code})}
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
// The same admitted LOAD operation, projected before returning database bytes.
// No table access, schema change, persisted title or extra model call is needed.
const previewQuery=`SELECT result || jsonb_build_object('turns',CASE WHEN jsonb_array_length(result->'turns')>0
 THEN jsonb_build_array((result->'turns'->0) || '{"response":"","sources":[]}'::jsonb)
 ELSE '[]'::jsonb END) AS result,binding FROM (
 WITH history_reply AS MATERIALIZED (
 SELECT sg2_assistant_history.apply($1::text,$2::text) AS result,sg2_assistant_history.descriptor() AS binding
 ) SELECT result,binding FROM history_reply
) AS history_projection`
export function createAssistantHistory(options:{query:AccessQuery;commandKey:string;schemaDigest:string;now?:()=>number}){
 if(!/^[a-f0-9]{64}$/.test(options.commandKey)||!/^[a-f0-9]{64}$/.test(options.schemaDigest))throw TypeError('Explicit private history binding required')
 const key=Buffer.from(options.commandKey,'hex'),now=options.now??Date.now
 async function call(context:Readonly<OperationContext>,action:string,payload:Record<string,unknown>={},previewOnly=false){
  const operation=action==='CHECK'?'assistant.converse':['LIST','LOAD'].includes(action)?'assistant.history.read':'assistant.history.write'
  if(context.applicationId!=='spendguru'||context.environment!=='development'||context.actor.kind!=='HUMAN'||!uuid(context.actorId)
   ||context.actor.actorId!==context.actorId||context.operation!==operation||operation!=='assistant.converse'&&context.organisationId!==null)return fail('DENIED')
  const body=JSON.stringify({...payload,action,userId:context.actorId,contract:'1.0.0',schemaDigest:options.schemaDigest,until:now()+10000})
  const proof=createHmac('sha256',key).update(body).digest('hex')
  let rows
  try{rows=(await options.query(previewOnly&&action==='LOAD'?previewQuery:'SELECT sg2_assistant_history.apply($1::text,$2::text) AS result,sg2_assistant_history.descriptor() AS binding',[body,proof])).rows}
  catch(error){const e=error as {code?:string;message?:string;meta?:{message?:string}}
   if((e.code==='P0001'||e.code==='P2010')&&/HISTORY_CONFLICT/.test(e.meta?.message??e.message??''))return fail('INTERRUPTED')
   if((e.code==='P0001'||e.code==='P2010')&&/HISTORY_UNAVAILABLE/.test(e.meta?.message??e.message??''))return fail('DENIED')
   return fail()
  }
  const r=rows?.[0],b=r?.binding
  if(rows?.length!==1||!record(b)||b.applicationId!=='spendguru'||b.environment!=='development'||b.projectId!=='autumn-waterfall-65938876'
   ||b.branchId!=='br-dry-hall-b294222f'||b.databaseName!=='neondb'||b.runtimeRole!=='sg2_assistant_history_runtime'||b.userId!==context.actorId||b.schemaDigest!==options.schemaDigest||!record(r.result))return fail()
  return r.result
 }
 return Object.freeze({
  async list(context:Readonly<OperationContext>){const r=await call(context,'LIST');if(!Array.isArray(r.items)||r.items.length>200)return fail()
   return r.items.map(item=>{if(!record(item)||!uuid(item.id)||typeof item.updatedAt!=='string'||!Number.isFinite(Date.parse(item.updatedAt)))return fail()
    return {id:item.id,title:(item.locale==='en'?'Conversation ':'Rozmowa ')+new Date(item.updatedAt).toISOString().slice(0,10),updatedAt:item.updatedAt}})
  },
  async load(context:Readonly<OperationContext>,id:string,previewOnly=false):Promise<StoredConversation>{
   if(!uuid(id))return fail()
   const r=await call(context,'LOAD',{conversationId:id},previewOnly);if(r.id!==id||!Number.isSafeInteger(r.revision)||Number(r.revision)<0||!Array.isArray(r.turns)||r.turns.length>50)return fail()
   const turns=r.turns.map(t=>{
    if(!record(t)||![t.id,t.commandId,t.assistantMessageId].every(uuid)||typeof t.message!=='string'||t.message.length>8000
     ||typeof t.response!=='string'||t.response.length>64000||typeof t.createdAt!=='string'||!['QUEUED','COMPLETE','INTERRUPTED','FAILED'].includes(String(t.status))
     ||!Array.isArray(t.scopes)||t.scopes.length>4||!Array.isArray(t.sources)||t.sources.length>4)return fail()
    const scopes=t.scopes.map(s=>{
     if(!record(s)||!uuid(s.organisationId)||Object.keys(s).some(k=>!['source','organisationId','reference','viewIdentity','sourceVersion','privateKys','privateKysUntil','requiredRecordIds'].includes(k)))return fail()
     const reference=readContextReference(s.reference)
     if(reference.source!==s.source||s.viewIdentity!==undefined&&(typeof s.viewIdentity!=='string'||!/^[a-f0-9]{64}$/.test(s.viewIdentity))
      ||s.sourceVersion!==undefined&&s.sourceVersion!==null&&(typeof s.sourceVersion!=='string'||!/^[a-f0-9]{64}$/.test(s.sourceVersion))
      ||s.privateKys!==undefined&&(reference.source!=='SRM_XRAY'||typeof s.privateKys!=='boolean')
      ||s.privateKys===true&&(typeof s.privateKysUntil!=='string'||s.privateKysUntil.length>40||!Number.isFinite(Date.parse(s.privateKysUntil)))
      ||s.privateKysUntil!==undefined&&s.privateKys!==true
      ||s.requiredRecordIds!==undefined&&(reference.source!=='NEWSFEED'||!Array.isArray(s.requiredRecordIds)||s.requiredRecordIds.length>32||s.requiredRecordIds.some(id=>typeof id!=='string'||!/^[OP]:[a-f0-9-]{36}$/i.test(id))))return fail()
     return {...s,source:reference.source,organisationId:s.organisationId,reference} as HistoryScope
    })
    const sources:AssistantSource[]=t.sources.map(s=>{
     if(!record(s)||typeof s.id!=='string'||s.id.length>512||typeof s.label!=='string'||s.label.length>1024
      ||s.asOf!==null&&(typeof s.asOf!=='string'||s.asOf.length>40)||!['OK','EMPTY','PARTIAL','DENIED','UNAVAILABLE','STALE'].includes(String(s.status)))return fail()
     return {id:s.id,label:s.label,asOf:s.asOf as string|null,status:s.status as AssistantSource['status']}
    })
    return {id:String(t.id),commandId:String(t.commandId),assistantMessageId:String(t.assistantMessageId),message:t.message,response:t.response,
     status:t.status as StoredTurn['status'],scopes,sources,createdAt:t.createdAt}
   });return {id,revision:Number(r.revision),turns}
  },
  async begin(context:Readonly<OperationContext>,input:{conversationId:string|null;commandId:string;message:string;locale:'pl'|'en';scopes:readonly HistoryScope[];expectedRevision:number|null}){
   const r=await call(context,'BEGIN',input)
   if(!uuid(r.conversationId)||!uuid(r.turnId)||!['NEW','REPLAY'].includes(String(r.status)))return fail()
   return r as {conversationId:string;turnId:string;status:'NEW'|'REPLAY'}
  },
  async complete(context:Readonly<OperationContext>,input:{conversationId:string;commandId:string;response:string;sources:readonly AssistantSource[]}){
   if((await call(context,'COMPLETE',input)).complete!==true)return fail()
  },
  async interrupt(context:Readonly<OperationContext>,input:{conversationId:string;commandId:string}){await call(context,'INTERRUPT',input)},
  async check(context:Readonly<OperationContext>,input:{conversationId:string;commandId:string}){if((await call(context,'CHECK',input)).active!==true)return fail()},
  async delete(context:Readonly<OperationContext>,id:string){if(!uuid(id))return fail();await call(context,'DELETE',{conversationId:id})},
 })
}
export type AssistantHistory=ReturnType<typeof createAssistantHistory>
