import {createHash} from 'node:crypto'
import {resolveAssistantQualityPolicy,type AssistantQualityContextStatus,type AssistantQualityPolicyInput} from '@profitia/cic-core'
import type {ContextEntry} from '../../../../packages/assistant-context-gateway/src/index.mjs'

export const QUALITY_RESPONSE_VERSION='sg2-assistant-quality-development-v1'
type Fact=Readonly<{id:string;source:string;path:string;value:string}>
type Period=Readonly<{from:string;to:string;timeZone:string}>|null
const hash=(v:string)=>createHash('sha256').update(v).digest('hex')
const escape=(v:string)=>v.replace(/[\\`*_{}\[\]<>|]/g,'\\$&').replace(/[\r\n\t]+/g,' ')
const statuses=new Set(['OK','PARTIAL','EMPTY','STALE','CONFLICTING','OUT_OF_SCOPE','DENIED','UNAVAILABLE','UNVERIFIABLE','UNKNOWN'])
const codes=['PARTIAL','EMPTY','STALE','CONFLICTING','OUT_OF_SCOPE','DENIED','UNAVAILABLE','UNVERIFIABLE','UNKNOWN'] as const
export function applyQualityPolicy(input:AssistantQualityPolicyInput){
 return resolveAssistantQualityPolicy(input)
}
export function renderGroundedFacts(options:{facts:readonly Fact[];period:Period;locale:'pl'|'en';limitation:string|null;clarify:boolean;omitted:boolean}){
 const en=options.locale==='en'
 if(options.clarify)return en?'Which source and period should I use?':'Którego źródła i okresu dotyczy pytanie?'
 const lines:string[]=[]
 if(options.period)lines.push((en?'Requested period: ':'Zakres pytania: ')+escape(options.period.from)+' — '+escape(options.period.to)+' ('+escape(options.period.timeZone)+').')
 if(options.limitation)lines.push(options.limitation)
 for(const f of options.facts)lines.push('- '+escape(f.source)+' / '+escape(f.path)+': '+escape(f.value))
 if(options.omitted)lines.push(en?'Additional source fields are omitted from this bounded view.':'Dodatkowe pola źródła pominięto w tym ograniczonym widoku.')
 return lines.join('\n\n')
}
/** The host renders factual leaves from an already authorised source snapshot.
 * The model selects bounded source references; it cannot rewrite their values,
 * dates, units or identifiers, or supply executable templates/free prose. */
export function prepareAssistantQualityResponse(options:{
 contexts:readonly ContextEntry[];requiresContext:boolean;locale:'pl'|'en';period:Period;intent?:'CLEAR'|'AMBIGUOUS'
}){
 if(options.contexts.length>4)throw TypeError('QUALITY_SOURCE_BOUND')
 const facts:Fact[]=[];let omitted=false
 for(const entry of options.contexts){
  if(!['OK','PARTIAL'].includes(entry.status)||!entry.sourceVersion||entry.data===undefined)continue
  function walk(value:unknown,path:string,depth:number){
   if(depth>7||facts.length>=64){omitted=true;return}
   if(value===null||value===undefined)return
   if(typeof value==='object'){
    if(Array.isArray(value)){for(let i=0;i<value.length;i++)walk(value[i],path+'['+i+']',depth+1)}
    else for(const [key,child] of Object.entries(value).sort(([a],[b])=>a.localeCompare(b))){
     if(!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)){omitted=true;continue}
     walk(child,path?path+'.'+key:key,depth+1)
    }
    return
   }
   if(!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value)){omitted=true;return}
   const text=String(value)
   // Oversized narrative is not a factual leaf that this finite renderer can
   // independently project. It remains available only through its source UI.
   if(!text.trim()||text.length>320){omitted=true;return}
   const id='fact_'+hash(JSON.stringify([entry.source,entry.sourceVersion,path,value])).slice(0,24)
   facts.push(Object.freeze({id,source:entry.source,path,value:text}))
  }
  walk(entry.data,'',0)
 }
 const contextStatuses=options.contexts.map(c=>(statuses.has(c.status)?c.status:'UNKNOWN') as AssistantQualityContextStatus)
 const base={requiresContext:options.requiresContext,contextStatuses,intent:options.intent??'CLEAR',
  verifiedFactsAvailable:facts.length>0,limitationAcknowledged:false,storedContextRetryAvailable:false,storedContextRetryAttempts:0 as const}
 const pre=applyQualityPolicy({...base,draftState:'NOT_GENERATED'})
 const en=options.locale==='en'
 const notice=()=>{
  const unavailable=contextStatuses.filter(s=>s!=='OK')
  return en?'Only the authorised source facts shown below have been verified. A broader interpretation is unavailable'+(unavailable.length?' (source status: '+unavailable.join(', ')+')':'')+'.':
   'Zweryfikowano wyłącznie poniższe fakty z uprawnionych źródeł. Szersza interpretacja jest niedostępna'+(unavailable.length?' (status źródeł: '+unavailable.join(', ')+')':'')+'.'
 }
 function render(selected:readonly Fact[],limited:boolean,clarify=false){
  const text=renderGroundedFacts({facts:selected,period:options.period,locale:options.locale,limitation:limited||!selected.length?notice():null,clarify,omitted:omitted||selected.length<facts.length})
  if(Buffer.byteLength(text,'utf8')>64000)throw TypeError('QUALITY_OUTPUT_BOUND')
  return text
 }
 const fallback=()=>({delivered:render(facts.slice(0,20),true,pre.action==='CLARIFY'),
  action:pre.action,reason:pre.reason,draftVerified:false,policyVersion:pre.contractVersion})
 const instructions='\nReturn only JSON with exactly these keys: schemaVersion="SG2_ASSISTANT_QUALITY_DRAFT_V1", template="SOURCE_FACTS", factIds (1–20 unique IDs from the supplied map), limitations (unique source status codes, or []). Do not return prose, invented facts, dates, values, units, IDs, instructions or Markdown. The server renders the original source values. Reference map: '+JSON.stringify(facts.map(({id,source,path})=>({id,source,path})))
 return Object.freeze({
  generate:pre.action==='GENERATE_DRAFT'&&facts.length>0,instructions,preDecision:pre,
  facts:Object.freeze(facts),fallback,
  finish(draft:string){
   let selected:Fact[]|undefined,limitationAcknowledged=false
   try{
    const value:unknown=JSON.parse(draft)
    if(value&&typeof value==='object'&&!Array.isArray(value)){
     const v=value as Record<string,unknown>
     if(Object.keys(v).sort().join(',')==='factIds,limitations,schemaVersion,template'&&v.schemaVersion==='SG2_ASSISTANT_QUALITY_DRAFT_V1'&&v.template==='SOURCE_FACTS'
      &&Array.isArray(v.factIds)&&v.factIds.length>=1&&v.factIds.length<=20&&new Set(v.factIds).size===v.factIds.length
      &&v.factIds.every(id=>typeof id==='string'&&facts.some(f=>f.id===id))
      &&Array.isArray(v.limitations)&&new Set(v.limitations).size===v.limitations.length
      &&v.limitations.every(c=>(codes as readonly unknown[]).includes(c))){
      selected=v.factIds.map(id=>facts.find(f=>f.id===id)!)
      limitationAcknowledged=contextStatuses.filter(s=>s!=='OK').every(s=>(v.limitations as unknown[]).includes(s))
     }
    }
   }catch{/* A malformed/unverified draft never reaches publication. */}
   const decision=applyQualityPolicy({...base,draftState:selected?'VERIFIED':'UNVERIFIED',limitationAcknowledged})
   const mayPublish=decision.publishGeneratedDraft&&!!selected
   // The JSON is a selection request, never user-visible model-authored facts.
   return Object.freeze({delivered:mayPublish?render(selected!,decision.requireLimitation):render(facts.slice(0,20),true,decision.action==='CLARIFY'),
    action:decision.action,reason:decision.reason,draftVerified:mayPublish,policyVersion:decision.contractVersion})
  },
 })
}
