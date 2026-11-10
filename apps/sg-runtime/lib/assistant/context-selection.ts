import {createHash} from 'node:crypto'
import {planAnalyticalConversation} from '@profitia/cic-core'
import {contextReferences,readContextReference,type ContextReference,type ContextSelection,type ChartReference,type SupplierReference,type NewsfeedReference} from '../../../../packages/assistant-context-contracts/src/index.mjs'
import type {ContextEntry} from '../../../../packages/assistant-context-gateway/src/index.mjs'
import type {HistoryScope,StoredConversation} from './history'
export type AssistantTurnSelection={message:string;locale:'pl'|'en';module:'appshell'|'benchmark_finder'|'xray'|'adp'|'procurement_insights';reference:ChartReference|SupplierReference|NewsfeedReference|null}
export function referenceIdentity(r:ContextReference):string{
 switch(r.source){
  case 'BENCHMARK_CHART':return JSON.stringify([r.source,r.seriesId,r.from,r.to,r.fingerprint,r.range??'ALL'])
  case 'FORECAST_CORE':return JSON.stringify([r.source,r.seriesId,[...r.modelIds],r.targetBasis,r.sourceFrequency,r.targetCadence,r.verification])
  case 'SRM_XRAY':return JSON.stringify([r.source,r.nip,r.entityType,r.krs,r.year,r.comparisonYear,r.statementScope,r.sourceVersion])
  case 'NEWSFEED':return JSON.stringify([r.source,r.observationId,r.supplierNip])
 }
}
export function selectConversationContext(turn:AssistantTurnSelection,stored:StoredConversation|null,organisationId:string){
 const viewIdentity=createHash('sha256').update(JSON.stringify([turn.module,turn.reference===null?null:referenceIdentity(turn.reference)])).digest('hex')
 const latest=[...(stored?.turns??[])].reverse().find(t=>t.status==='COMPLETE')
 const sameView=!!latest?.scopes.length&&latest.scopes.every(s=>s.organisationId===organisationId
  &&(s.viewIdentity===viewIdentity||s.viewIdentity===undefined&&turn.reference?.source==='BENCHMARK_CHART'
   &&s.source==='BENCHMARK_CHART'&&referenceIdentity(s.reference)===referenceIdentity(turn.reference)))
 const previous=sameView?latest!.scopes.map(s=>s.reference):[]
 const planned=planAnalyticalConversation({message:turn.message,locale:turn.locale,userTurnCount:(stored?.turns.length??0)+1,
  activeModule:turn.module==='procurement_insights'?'appshell':turn.module,continuingBenchmarkDiscussion:turn.reference?.source==='BENCHMARK_CHART',
  previousSources:[...new Set(previous.map(r=>r.source))]})
 // The gateway already accepts this read-only reference. In PI only the
 // explicit selection is retrieved, and only after the user sends a message.
 const policy=turn.module==='procurement_insights'?{...planned,contextPlan:turn.reference?.source==='NEWSFEED'?[{source:'NEWSFEED' as const,selection:'ACTIVE_VIEW' as const}]:[]}:planned
 const refs=new Map<ContextReference['source'],ContextReference>(previous.map(r=>[r.source,r]))
 if(turn.reference)refs.set(turn.reference.source,turn.reference)
 const explicitNip=/(?<!\p{L})NIP[:\s]+([0-9][0-9 -]{8,15}[0-9])(?![0-9])/iu.exec(turn.message)?.[1]?.replace(/[ -]/g,'')
 if(explicitNip?.length===10){
  const active=refs.get('SRM_XRAY')
  const sameSupplier=active?.source==='SRM_XRAY'&&active.nip===explicitNip?active:null
  refs.set('SRM_XRAY',readContextReference({version:'2.0.0',source:'SRM_XRAY',nip:explicitNip,entityType:sameSupplier?.entityType??'COMPANY',krs:sameSupplier?.krs??null,
   year:active?.source==='SRM_XRAY'&&active.nip===explicitNip?active.year:null,
   comparisonYear:active?.source==='SRM_XRAY'&&active.nip===explicitNip?active.comparisonYear:null,
   statementScope:active?.source==='SRM_XRAY'&&active.nip===explicitNip?active.statementScope:'standalone',sourceVersion:null}))
 }
 const benchmark=refs.get('BENCHMARK_CHART'),oldForecast=refs.get('FORECAST_CORE')
 if(benchmark?.source==='BENCHMARK_CHART'&&policy.contextPlan.some(p=>p.source==='FORECAST_CORE')){
  const prior=sameView&&oldForecast?.source==='FORECAST_CORE'&&oldForecast.seriesId===benchmark.seriesId?oldForecast:null
  const models=policy.forecastSelection==='CONTINUE'&&prior?prior.modelIds:policy.forecastModels
  const basis=!policy.forecastBasisExplicit&&prior?prior.targetBasis:policy.forecastTargetBasis
  refs.set('FORECAST_CORE',readContextReference({version:'2.0.0',source:'FORECAST_CORE',seriesId:benchmark.seriesId,
   modelIds:models,targetBasis:basis,sourceFrequency:prior?.sourceFrequency??null,targetCadence:prior?.targetCadence??null,verification:true}))
 }
 if(policy.contextPlan.some(p=>p.source==='NEWSFEED')){
  const supplier=refs.get('SRM_XRAY'),old=refs.get('NEWSFEED')
  refs.set('NEWSFEED',readContextReference({version:'2.0.0',source:'NEWSFEED',
   observationId:old?.source==='NEWSFEED'&&old.supplierNip===(supplier?.source==='SRM_XRAY'?supplier.nip:null)?old.observationId:null,
   supplierNip:supplier?.source==='SRM_XRAY'?supplier.nip:null}))
 }
 const references=policy.contextPlan.map(p=>refs.get(p.source)).filter((r):r is ContextReference=>!!r)
 const reference:ContextSelection|null=references.length?{version:'2.0.0',source:'CONTEXT_SELECTION',references}:null
 return {policy,reference,viewIdentity,references}
}
const data=(entry:ContextEntry)=>entry.data as {kys?:{status?:string;retentionUntil?:string};observations?:Array<{id:string;publications:Array<{id:string}>}>}|undefined
export function contextSatisfiesScope(scope:HistoryScope,entry:ContextEntry|undefined):boolean{
 if(!entry||!['OK','PARTIAL','STALE','EMPTY'].includes(entry.status))return false
 if(scope.privateKys&&(!['OK','PARTIAL'].includes(data(entry)?.kys?.status??'')||!scope.privateKysUntil
  ||!Number.isFinite(Date.parse(scope.privateKysUntil))||Date.parse(scope.privateKysUntil)<=Date.now()))return false
 if(scope.requiredRecordIds?.length){
  const records=new Set((data(entry)?.observations??[]).flatMap(o=>['O:'+o.id,...o.publications.map(p=>'P:'+p.id)]))
  if(scope.requiredRecordIds.some(id=>!records.has(id)))return false
 }
 return true
}
export function contextHistoryScopes(selection:ReturnType<typeof selectConversationContext>,contexts:readonly ContextEntry[],organisationId:string):HistoryScope[]{
 return selection.references.map(reference=>{
  const entry=contexts.find(c=>c.source===reference.source),value=entry?data(entry):undefined
  if(reference.source==='SRM_XRAY'&&['OK','PARTIAL'].includes(value?.kys?.status??'')
   &&(!value?.kys?.retentionUntil||!Number.isFinite(Date.parse(value.kys.retentionUntil))||Date.parse(value.kys.retentionUntil)<=Date.now()))throw Error('Private context retention unavailable')
  return {source:reference.source,organisationId,reference,viewIdentity:selection.viewIdentity,sourceVersion:entry?.sourceVersion??null,
   ...(reference.source==='SRM_XRAY'?{privateKys:['OK','PARTIAL'].includes(value?.kys?.status??''),
    ...(['OK','PARTIAL'].includes(value?.kys?.status??'')?{privateKysUntil:value?.kys?.retentionUntil}:{})}:{}),
   ...(reference.source==='NEWSFEED'?{requiredRecordIds:(value?.observations??[]).flatMap(o=>['O:'+o.id,...o.publications.map(p=>'P:'+p.id)])}:{}),
  }
 })
}
