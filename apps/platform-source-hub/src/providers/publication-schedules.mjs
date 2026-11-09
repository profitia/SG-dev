import {fingerprint,fail,day} from '../transport.mjs'
import {makeRecord,answer,safeUrl,optional,utc} from './commodity-records.mjs'
export const SCHEDULE_VERSION='1.2.0'
// This is a correlation hint, never a claim of vendor event identity. It is
// independent of row order, retrieval time and a moving next-release timestamp.
export const correlationKey=(provider,publicationRef,sourceUrl)=>fingerprint({provider,publicationRef,sourceUrl})
export function schedulePayload(values){return {kind:'PUBLICATION_SCHEDULE',scheduleId:null,title:'',publicationRef:'',correlationKey:'',identityStatus:'CORRELATION_ONLY',
 scheduledAt:null,scheduledUntil:null,dateOnly:null,localDateTime:null,timeZone:null,timePrecision:'UNKNOWN',recurrence:null,referencePeriod:null,
 releaseStatus:'PROVIDER_SCHEDULE_ONLY',scheduleStatus:'UNDATED',sourceName:null,sourceUrl:null,officialSource:false,sourceUpdatedAt:null,lastVerifiedAt:'metadata.retrievedAt',
 standardSchedule:null,exception:null,sourceTiming:{rawDate:null,typicalTime:null,nextHint:null},qualityFlags:['SCHEDULE_NOT_RESULT','COVERAGE_NOT_EXHAUSTIVE'],actual:null,previous:null,forecast:null,publishedAt:null,...values}}
export function scheduleRecord(provider,endpoint,payload,sourceUrl){
 const r=makeRecord('publication-calendar',provider,endpoint,payload,{sourceUrl,vendorRecordId:payload.identityStatus==='PROVIDER_ID'?payload.scheduleId:null});r.metadata.contractVersion=SCHEDULE_VERSION;return r
}
export function scheduleAnswer(provider,items,options={}){
 const out=answer('publication-calendar',provider,items,options)
 return {...out,contractVersion:SCHEDULE_VERSION,coverage:{scope:'SOURCE_SCHEDULE_PROJECTION',completeness:out.page.truncated?'INCOMPLETE':'UNKNOWN',providerRows:provider==='commodities-sh'?items.length:null,
  projected:items.length,ruleDerived:items.filter(i=>i.payload.scheduleStatus==='RULE_DERIVED_UNCONFIRMED').length,returned:out.items.length,nativeFilters:[],localFilters:options.localFilters??[]}}
}
export function commoditiesSchedule(row){
 if(!row||Object.getPrototypeOf(row)!==Object.prototype)fail('PROVIDER_SCHEMA_CHANGED',502)
 const title=optional(row.title??row.name??row.event??row.report??row.label)
 if(!title)fail('PROVIDER_SCHEMA_CHANGED',502)
 const id=optional(row.id??row.code),sourceUrl=safeUrl(row.url??row.source_url),sourceName=optional(row.source??row.agency),recurrence=optional(row.recurrence??row.frequency??row.schedule??row.cadence)
 const raw=optional(row.scheduled_at??row.next_release??row.date??row.next_release_at),zone=optional(row.timezone??row.time_zone)??(optional(row.typical_time_et)?'America/New_York':null)
 let timeZone=zone,scheduledAt=null,dateOnly=null,timePrecision=recurrence?'RECURRENCE_ONLY':'UNKNOWN',localDateTime=null
 if(zone){try{new Intl.DateTimeFormat('en',{timeZone:zone})}catch{timeZone=null}}
 if(raw){
  if(/^\d{4}-\d\d-\d\d$/.test(raw)){try{dateOnly=day(raw)}catch{fail('PROVIDER_SCHEMA_CHANGED',502)}timePrecision='DATE'}
  else if(utc(raw)){scheduledAt=utc(raw);timePrecision='INSTANT'}
  else if(/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(raw)&&timeZone){localDateTime=raw;scheduledAt=zonedInstant(raw,timeZone);timePrecision='INSTANT'}
 }
 const publicationRef='commodities-sh:'+(id??title.trim().toLowerCase())
 return schedulePayload({title,scheduleId:id,publicationRef,identityStatus:id?'PROVIDER_ID':'CORRELATION_ONLY',correlationKey:correlationKey('commodities-sh',publicationRef,sourceUrl),
  sourceUrl,sourceName,recurrence,scheduledAt,dateOnly,timeZone,localDateTime,timePrecision,scheduleStatus:raw||recurrence?'PROVIDER_REPORTED':'UNDATED',sourceTiming:{rawDate:raw,typicalTime:optional(row.typical_time_et),nextHint:optional(row.next_hint)},
  qualityFlags:['SCHEDULE_NOT_RESULT','COVERAGE_NOT_EXHAUSTIVE',...(id?['PROVIDER_ID_STABILITY_UNVERIFIED']:['NO_PROVIDER_STABLE_EVENT_ID']),...(row.typical_time_et&&!row.timezone&&!row.time_zone?['TIME_ZONE_FROM_SOURCE_ET_LABEL']:[]),...(zone&&!timeZone?['UNRECOGNISED_SOURCE_TIME_ZONE']:[]),...(raw&&!scheduledAt&&!dateOnly?['UNINTERPRETED_SOURCE_DATE']:[])]})
}
// Resolve a wall clock by IANA rules. Round-trip matching rejects nonexistent
// spring-forward times and ambiguous autumn times instead of guessing offsets.
export function zonedInstant(local,timeZone='America/New_York'){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(local))fail('PROVIDER_SCHEMA_CHANGED',502)
 const normalized=local.length===16?local+':00':local,naive=Date.parse(normalized+'Z')
 if(!Number.isFinite(naive)||new Date(naive).toISOString().slice(0,19)!==normalized)fail('PROVIDER_SCHEMA_CHANGED',502)
 const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
 const wall=n=>{const p=Object.fromEntries(fmt.formatToParts(n).map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`}
 const offsets=new Set([-86400000,0,86400000].map(delta=>Date.parse(wall(naive+delta)+'Z')-(naive+delta)))
 const matches=[...offsets].map(offset=>naive-offset).filter(n=>wall(n)===normalized)
 if(matches.length!==1)fail('AMBIGUOUS_SOURCE_TIME',502)
 return new Date(matches[0]).toISOString()
}
