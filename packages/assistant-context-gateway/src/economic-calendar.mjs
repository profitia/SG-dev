import {createHash} from 'node:crypto'
import {readContextReference,contextDate} from '../../assistant-context-contracts/src/index.mjs'
import {ECR_CONTRACT,eventId} from '../../economic-calendar-contracts/index.mjs'
import {SEMANTIC_CONTRACT,semanticId} from '../../economic-calendar-contracts/semantic.mjs'

export const ECONOMIC_CONTEXT_ADAPTER_CONTRACT=Object.freeze({id:'profitia.assistant-economic-context',version:'1.0.0'})
const object=v=>!!v&&Object.getPrototypeOf(v)===Object.prototype
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const text=(v,max=512)=>{if(typeof v!=='string'||!v.length||v.length>max)throw TypeError('Invalid ECR text');return v}
const optional=(v,max=512)=>v===null?null:text(v,max)
const stamp=v=>{if(v===null)return null;if(typeof v!=='string'||!Number.isFinite(Date.parse(v)))throw TypeError('Invalid ECR time');return new Date(v).toISOString()}
const version=v=>{if(!Number.isSafeInteger(v)||v<1)throw TypeError('Invalid ECR version');return v}
const scalar=v=>{if(v!==null&&!(typeof v==='number'&&Number.isFinite(v))&&!(typeof v==='string'&&v.length<=256))throw TypeError('Invalid ECR value');return v}
const url=v=>{if(v===null)return null;const u=new URL(text(v,4096));if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw TypeError('Invalid ECR source URL');return v}
const list=(v,max)=>{if(!Array.isArray(v)||v.length>max)throw TypeError('Invalid ECR list');return v}
function provenance(s){
 if(!object(s)||!['eia','commodities-sh','trading-economics'].includes(s.provider)
  ||s.redistribution!==undefined&&s.redistribution!=='PRIVATE_AUTHORISED_CONSUMER_ONLY')throw TypeError('Invalid ECR provenance')
 return {provider:s.provider,publicationRef:optional(s.publicationRef??null),sourceRecordRef:text(s.sourceRecordRef),
  licenceRef:text(s.licenceRef),storageBasisRef:text(s.storageBasisRef),rightsVersion:optional(s.rightsVersion??null),
  redistribution:s.redistribution??'CURRENT_ECR_ENTITLEMENT_REQUIRED'}
}
function definition(entry){
 if(!object(entry)||!['concept','measure'].includes(entry.kind)||entry.status!=='accepted'||!object(entry.data))throw TypeError('Invalid ECR definition')
 const d=entry.data
 return {kind:entry.kind,id:semanticId(entry.id),version:version(entry.version),namePl:text(d.namePl),nameEn:text(d.nameEn),
  description:text(d.description,4096),geography:text(d.geography),recordedAt:stamp(entry.recordedAt),
  ...(entry.kind==='measure'?{conceptId:semanticId(d.conceptId),unit:text(d.unit),frequency:text(d.frequency),valueMeaning:text(d.valueMeaning)}:{})}
}
function relevance(r,selection,versions){
 if(!object(r)||r.kind!=='relevance'||r.status!=='accepted'||!object(r.data))throw TypeError('Invalid ECR relevance')
 const d=r.data
 if(!['DIRECT','STRONG','CONTEXTUAL'].includes(d.level)||!['BENCHMARK_SERIES','MARKET','COMMODITY','CATEGORY'].includes(d.targetType)
  ||selection.targetId!==null&&(d.targetId!==selection.targetId||d.targetType!==selection.targetType)
  ||!versions.some(v=>v.kind==='rule'&&v.id===d.ruleId&&v.version===d.ruleVersion&&v.status==='accepted'))throw TypeError('Unconfirmed ECR relevance')
 return {id:semanticId(r.id),version:version(r.version),targetType:d.targetType,targetId:semanticId(d.targetId),
  level:d.level,reason:text(d.reason,4096),ruleId:semanticId(d.ruleId),ruleVersion:version(d.ruleVersion),targetEvidenceRef:text(d.targetEvidenceRef,4096)}
}
function observation(r,event){
 if(!object(r)||r.eventId!==event||typeof r.observationId!=='string'||!/^ecr_obs_[a-f0-9]{64}$/.test(r.observationId)
  ||r.valueMeaning!=='CURRENT_SNAPSHOT_NOT_PUBLICATION_VINTAGE')throw TypeError('Invalid ECR observation')
 return {observationId:r.observationId,sequence:version(r.sequence),measureId:semanticId(r.measureId),seriesId:text(r.seriesId),
  referencePeriod:text(r.referencePeriod),unit:text(r.unit),geography:text(r.geography),actual:scalar(r.actual),previous:scalar(r.previous),
  forecast:scalar(r.forecast),revised:scalar(r.revised),publishedAt:stamp(r.publishedAt),sourceUpdatedAt:stamp(r.sourceUpdatedAt),
  sourceRetrievedAt:stamp(r.sourceRetrievedAt),observedAt:stamp(r.observedAt),receiptRef:text(r.receiptRef),sourceRecordRef:text(r.sourceRecordRef),
  sourceUrl:url(r.sourceUrl),licenceRef:text(r.licenceRef),storageBasisRef:text(r.storageBasisRef),rightsVersion:text(r.rightsVersion),
  correlationStatus:text(r.correlationStatus),valueMeaning:r.valueMeaning}
}
function schedule(s){
 if(s===null)return null
 if(!object(s)||!['INSTANT','DATE','LOCAL_DATETIME','UNKNOWN'].includes(s.timePrecision))throw TypeError('Invalid ECR schedule')
 return {timePrecision:s.timePrecision,scheduledAt:stamp(s.scheduledAt),dateOnly:s.dateOnly===null?null:contextDate(s.dateOnly),
  localDateTime:optional(s.localDateTime),timeZone:optional(s.timeZone),scheduleStatus:text(s.scheduleStatus),
  qualityFlags:list(s.qualityFlags,30).map(v=>text(v)),officialSource:s.officialSource===true}
}
function event(item,selection,versions){
 if(!object(item)||!object(item.event)||item.event.eventId!==item.eventId||item.causalityClaim!==false
  ||item.timeMeaning!=='SOURCE_SCHEDULE_NOT_PUBLICATION_CONFIRMATION'||item.concept?.status!=='accepted'
  ||item.mapping?.status!=='accepted'||item.mapping?.data?.certainty!=='CONFIRMED'
  ||!['EQUIVALENT_DEFINITION','PART_OF'].includes(item.mapping.data.relation)
  ||item.mapping.data.conceptId!==item.concept.id||item.mapping.data.provider!==item.event.source?.provider
  ||item.mapping.data.publicationRef!==item.event.source?.publicationRef)throw TypeError('Invalid ECR event mapping')
 const e=item.event,id=eventId(item.eventId),at=stamp(e.eventAt)
 if(selection.targetId!==null&&!item.relevance?.length||item.relevance.some(r=>r.data?.conceptId!==item.concept.id))throw TypeError('ECR relevance subject mismatch')
 if(at!==null&&(at<selection.from||at>selection.to)||selection.asKnownAt!==null&&stamp(item.knownAt)>selection.asKnownAt)throw TypeError('ECR event outside selection')
 return {eventId:id,title:text(e.title,1200),eventAt:at,eventTimeZone:optional(e.eventTimeZone),knownAt:stamp(item.knownAt),
  publishedAt:stamp(e.publishedAt),schedule:schedule(e.schedule??null),referencePeriod:optional(e.reference?.providerValue??null),
  conceptId:semanticId(item.concept.id),source:provenance(e.source),sourceUrl:url(e.sourceUrl),
  values:{actual:scalar(e.values?.actual),previousAfterRevision:scalar(e.values?.previousAfterRevision),previousBeforeRevision:scalar(e.values?.previousBeforeRevision),
   consensusForecast:scalar(e.values?.consensusForecast),vendorForecast:scalar(e.values?.vendorForecast)},
  unit:optional(e.unit),currency:optional(e.currency),relevance:list(item.relevance,100).map(r=>relevance(r,selection,versions)),
  results:list(item.results,100).map(r=>observation(r,id)),timeMeaning:item.timeMeaning,causalityClaim:false}
}
function unresolved(item){
 if(!object(item)||!object(item.publication))throw TypeError('Invalid unresolved ECR schedule')
 const p=item.publication
 if(p.releaseIdentityStatus!=='UNRESOLVED_NEXT_RELEASE'||!/^ecr_pub_[a-f0-9]{64}$/.test(p.publicationId))throw TypeError('Invalid ECR publication')
 return {publicationId:p.publicationId,title:text(p.title,1200),knownAt:stamp(p.knownAt),source:provenance(p.source),sourceUrl:url(p.sourceUrl),
  schedule:schedule(p.unresolvedNextSchedule),releaseIdentityStatus:p.releaseIdentityStatus,
  scope:'PUBLICATION_DEFINITION_WITH_UNRESOLVED_NEXT_RELEASE_NOT_A_CONFIRMED_EVENT_IN_INTERVAL'}
}

/** The host performs one native ECR operation with current E1. This adapter
 * never acquires a provider, copies private preferences or invents semantics. */
export function createEconomicCalendarContextAdapter({readAuthorised}){
 if(typeof readAuthorised!=='function')throw TypeError('Authorised ECR producer required')
 return Object.freeze({source:'ECONOMIC_CALENDAR',async read({reference,request,organisationId,signal,observedAt}){
  if(reference===null)return {source:'ECONOMIC_CALENDAR',label:'Kalendarz makroekonomiczny (ECR)',status:'EMPTY'}
  const selection=readContextReference(reference)
  if(selection.source!=='ECONOMIC_CALENDAR')throw TypeError('Wrong ECR selection')
  signal?.throwIfAborted()
  const r=await readAuthorised({selection,request,organisationId,signal})
  if(!object(r)||r.contract?.id!==ECR_CONTRACT.id||r.contract.version!==ECR_CONTRACT.version||r.semanticContract!==SEMANTIC_CONTRACT
   ||r.projection!=='ECONOMIC_CONTEXT'||r.causalityClaim!==false||r.interpretationOwner!=='AUTHORISED_CONSUMER'
   ||r.missingValuesMeaning!=='UNKNOWN_NOT_ZERO'||r.order!=='CANONICAL_EVENT_ID'||!object(r.coverage)
   ||!['COMPLETE','INCOMPLETE','UNKNOWN'].includes(r.coverage.completeness)||r.coverage.numericHistory!=='OBSERVED_BY_ECR_ONLY'||r.coverage.publishedAtNotInferred!==true
   ||!['GLOBAL','RECOGNISED','NO_CONFIRMED_RELATION'].includes(r.targetStatus)
   ||(selection.targetId===null)!==(r.targetStatus==='GLOBAL')||r.nextAfter!==null&&!/^ecr_evt_[a-f0-9]{64}$/.test(r.nextAfter))throw TypeError('Invalid ECR Economic Context')
  const versions=list(r.semanticVersions,1000).map(v=>({kind:text(v.kind),id:semanticId(v.id),version:version(v.version),status:text(v.status)}))
  const events=list(r.items,8).map(i=>event(i,selection,versions))
  if(new Set(events.map(e=>e.eventId)).size!==events.length)throw TypeError('Duplicate ECR release')
  const data={contract:ECONOMIC_CONTEXT_ADAPTER_CONTRACT,events,definitions:list(r.definitions,1000).map(definition),
   unresolvedSchedules:list(r.unresolvedSchedules,500).map(unresolved),targetStatus:r.targetStatus,nextAfter:r.nextAfter,
   coverage:{completeness:text(r.coverage.completeness),numericHistory:'OBSERVED_BY_ECR_ONLY',publishedAtNotInferred:r.coverage.publishedAtNotInferred===true,
    unresolvedDefinitionPageMore:r.coverage.unresolvedDefinitionPageMore===true,unmappedDefinitionCount:list(r.coverage.unmappedDefinitions,500).length},
   semanticVersionFingerprint:hash(versions),omitted:{events:0,definitions:0,unresolvedSchedules:0},
   meaning:'Retained ECR facts and accepted global semantics only. Scheduled time is not confirmed publication or an actual result. Null is unknown, never zero. Numeric observations are source snapshots, not publication vintages. Relevance is not causation. Unknown or empty coverage is not evidence that no economic event occurred. No provider acquisition was run.'}
  // Keep the existing gateway/model byte budgets, with explicit omissions.
  for(const key of ['events','unresolvedSchedules','definitions'])while(Buffer.byteLength(JSON.stringify(data),'utf8')>14500&&data[key].length){data[key].pop();data.omitted[key]++}
  if(Buffer.byteLength(JSON.stringify(data),'utf8')>14500)throw TypeError('ECR metadata exceeds context budget')
  const omitted=Object.values(data.omitted).some(Boolean),hasFacts=data.events.length+data.unresolvedSchedules.length+data.definitions.length>0
  const status=!hasFacts&&!omitted?'EMPTY':r.coverage.completeness==='COMPLETE'&&!r.nextAfter&&!omitted&&!data.unresolvedSchedules.length&&!data.coverage.unmappedDefinitionCount?'OK':'PARTIAL'
  const dates=[...data.events.map(e=>e.knownAt),...data.unresolvedSchedules.map(p=>p.knownAt)].filter(Boolean).sort()
  return {source:'ECONOMIC_CALENDAR',id:'ecr:'+hash(selection).slice(0,24),label:'Kalendarz makroekonomiczny (ECR)',
   contractVersion:ECONOMIC_CONTEXT_ADAPTER_CONTRACT.version,status,selection,data,sourceVersion:hash([selection,data]),asOf:dates.at(-1)??null,observedAt}
 }})
}
