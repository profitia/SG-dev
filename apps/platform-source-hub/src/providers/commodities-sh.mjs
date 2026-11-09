import {parseCommodityRequest} from '../../../../packages/platform-source-hub-contracts/commodities-v1.mjs'
import {providerJson,fail} from '../transport.mjs'
import {answer,dataset,field,makeRecord,optional,utc,safeUrl} from './commodity-records.mjs'
import {commoditiesSchedule,scheduleRecord,scheduleAnswer} from './publication-schedules.mjs'
export const COMMODITIES_ORIGIN='https://api.commodities.sh'
export function prepareCommodities(request){
 const r=parseCommodityRequest(request)
 return {request:r,url:COMMODITIES_ORIGIN+(r.family==='publication-calendar'?'/v1/calendar':('endpoint' in r.criteria&&r.criteria.endpoint==='openapi')?'/openapi.json':'/v1/catalog')}
}
// Preserve discovery metadata, never observations or payment instructions as
// executable capabilities. Neither OpenAPI servers nor links choose transport.
function metadataJson(v,depth=0,schema=false){
 if(depth>15)fail('PROVIDER_SCHEMA_CHANGED',502)
 if(v===null||typeof v==='boolean'||typeof v==='string'||typeof v==='number'&&Number.isFinite(v))return v
 if(Array.isArray(v))return v.map(x=>metadataJson(x,depth+1,schema))
 if(v&&Object.getPrototypeOf(v)===Object.prototype){const out={};for(const [k,x]of Object.entries(v)){
  if(/^(?:__proto__|constructor|prototype)$/.test(k)||!schema&&/api.?key|token|secret|password|^value$|^prior$|short_history|pct_change/i.test(k))continue
  out[k]=metadataJson(x,depth+1,schema)
 }return out}
 fail('PROVIDER_SCHEMA_CHANGED',502)
}
export function openapiOperations(json){
 if(typeof json?.openapi!=='string'||!json.paths||typeof json.paths!=='object')fail('PROVIDER_SCHEMA_CHANGED',502)
 const free=new Set(['/health','/v1/catalog','/v1/calendar','/openapi.json','/llms.txt','/llms-full.txt','/SKILL.md','/.well-known/agent.json','/.well-known/x402.json','/terms.txt'])
 return Object.entries(json.paths).flatMap(([path,methods])=>Object.entries(methods).filter(([method])=>['get','post','put','patch','delete','head','options'].includes(method)).map(([method,op])=>{
  const observationResponse=JSON.stringify(op.responses??{}).includes('#/components/schemas/Observation');const rawPrice=op['x-price'],price=typeof rawPrice==='number'&&Number.isFinite(rawPrice)?rawPrice:null,stub=/curve|spreads\/calendar/.test(path),isPaid=price!==null&&price>0||rawPrice==='per-tool',isFree=method==='get'&&(free.has(path)||path==='/api/mcp')&&price===0&&!stub
  return dataset({kind:'OPERATION_METADATA',datasetId:method.toUpperCase()+' '+path,name:optional(op.summary)??path,description:optional(op.description),
   method:method.toUpperCase(),path,priceUsd:price,priceBasis:rawPrice??null,access:isFree?'FREE_DISCOVERY':isPaid?'PAID_NOT_ACTIVATED':stub?'STUB_NOT_ACTIVATED':'NOT_ACTIVATED',
   parameters:metadataJson(op.parameters??[],0,true),responseSchemas:metadataJson(op.responses??{},0,true),security:metadataJson(op.security??json.security??[],0,true),
   documentedStatus:isFree?'DOCUMENTED_NOT_TESTED':isPaid?'PAID_NOT_ACTIVATED':'UNAVAILABLE_OR_UNKNOWN',
   operationId:optional(op.operationId),fields:Object.entries(observationResponse?json.components?.schemas?.Observation?.properties??{}:{}).map(([k,v])=>field(k,optional(v.type),optional(v.description))),
   observationSchema:observationResponse?metadataJson(json.components?.schemas?.Observation??{},0,true):null,upstreamSpecVersion:optional(json.info?.version),paidExecutionAllowed:false})
 }))
}
/** @param {{fetchImpl?:Function}} options */
export function createCommoditiesProvider({fetchImpl}={}){return {/** @param {any} request @param {{signal?:AbortSignal}} options */async acquire(request,options={}){
 const {signal}=/** @type {{signal?:AbortSignal}} */(options)
 const p=prepareCommodities(request),json=await providerJson(fetchImpl,p.url,{}, {signal}),limit=request.criteria.limit??100
 if(request.family==='data-catalog'){
  const payloads=request.criteria.endpoint==='openapi'?openapiOperations(json):(()=>{
   if(!json||typeof json!=='object'||Array.isArray(json)||!Array.isArray(json.instruments))fail('PROVIDER_SCHEMA_CHANGED',502)
   return [dataset({datasetId:'catalog',name:'commodities.sh free discovery catalogue',catalogue:metadataJson(json),fields:[field('instruments','array'),field('pricing_usd','object')],paidExecutionAllowed:false})]
  })()
  return answer(request.family,'commodities-sh',payloads.map(v=>makeRecord(request.family,'commodities-sh',request.criteria.endpoint??'catalog',v,{sourceUrl:p.url,vendorRecordId:v.datasetId})),{limit,providerReturned:payloads.length})
 }
 const rows=Array.isArray(json)?json:Array.isArray(json?.events)?json.events:Array.isArray(json?.calendar)?json.calendar:Array.isArray(json?.releases)?json.releases:null
 if(!rows)fail('PROVIDER_SCHEMA_CHANGED',502)
 if(request.contractVersion==='1.2.0'){
  const items=rows.map(row=>scheduleRecord('commodities-sh','calendar',commoditiesSchedule(row),p.url))
  const ids=items.map(i=>i.metadata.vendorRecordId).filter(id=>id!==null)
  if(new Set(ids).size!==ids.length)fail('PROVIDER_SCHEMA_CHANGED',502)
  return scheduleAnswer('commodities-sh',items,{limit,providerReturned:rows.length})
 }
 const items=rows.map((r,i)=>{
  if(!r||typeof r!=='object')fail('PROVIDER_SCHEMA_CHANGED',502)
  const title=optional(r.title??r.name??r.event??r.report??r.label)
  if(!title)fail('PROVIDER_SCHEMA_CHANGED',502)
  const date=optional(r.scheduled_at??r.next_release??r.date??r.next_release_at),scheduledAt=utc(date),dateOnly=date&&/^\d{4}-\d\d-\d\d$/.test(date)?date:null
  return makeRecord(request.family,'commodities-sh','calendar',{kind:'PUBLICATION_SCHEDULE',scheduleId:optional(r.id??r.code)??String(i)+':'+title,title,scheduledAt,dateOnly,
   recurrence:optional(r.recurrence??r.frequency??r.schedule),timeZone:optional(r.timezone??r.time_zone),releaseStatus:'PROVIDER_SCHEDULE_ONLY',
   sourceName:optional(r.source??r.agency),sourceUrl:safeUrl(r.url??r.source_url),providerSchedule:metadataJson(r),actual:null,forecast:null,previous:null},
   {sourceUrl:p.url,vendorRecordId:optional(r.id??r.code)})
 })
 return answer(request.family,'commodities-sh',items,{limit,providerReturned:rows.length})
}}}
