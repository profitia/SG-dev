import {parseCommodityRequest} from '../../../../packages/platform-source-hub-contracts/commodities-v1.mjs'
import {providerJson,credential,fail} from '../transport.mjs'
import {answer,dataset,field,makeRecord,optional,value,schemaFingerprint} from './commodity-records.mjs'
import {prepareEiaSchedule,acquireEiaSchedule} from './eia-schedules.mjs'
export const EIA_ORIGIN='https://api.eia.gov'
export function prepareEia(request){
 if(request.family==='publication-calendar')return prepareEiaSchedule(request)
 const r=parseCommodityRequest(request),c=/** @type {any} */(r.criteria),u=new URL(EIA_ORIGIN+'/v2/'+(c.path?c.path+'/':''))
 if(r.family==='series-observations'){
  u.pathname+='data/';u.searchParams.set('frequency',c.frequency)
  for(const d of c.data)u.searchParams.append('data[]',d)
  for(const [key,values] of Object.entries(c.facets??{}))for(const v of values)u.searchParams.append('facets['+key+'][]',v)
  for(const name of ['start','end'])if(c[name]!==undefined)u.searchParams.set(name,c[name])
  for(const [n,s] of (c.sort??[{column:'period',direction:'desc'}]).entries()){u.searchParams.set('sort['+n+'][column]',s.column);u.searchParams.set('sort['+n+'][direction]',s.direction)}
  u.searchParams.set('offset',String(c.offset??0));u.searchParams.set('length',String(c.limit??100))
 }else if(c.facet)u.pathname+='facet/'+encodeURIComponent(c.facet)+'/'
 return {url:u.href,request:r}
}
/** Called exclusively by the existing admitted host's server-owned builder.
 * The key is never a consumer criterion, control payload, ledger URL or log.
 * Existing native GET binds the full private request via intent-keyed HMAC.
 */
export function eiaWireUrl(url,apiKey){const u=new URL(url);if(u.origin!==EIA_ORIGIN||!u.pathname.startsWith('/v2/')||u.searchParams.has('api_key'))fail('INVALID_PROVIDER_COMMAND');u.searchParams.set('api_key',credential(apiKey));return u.href}
/** @param {{fetchImpl?:Function}} options */
export function createEiaProvider({fetchImpl}={}){return {/** @param {any} request @param {{signal?:AbortSignal}} options */async acquire(request,options={}){
 const {signal}=/** @type {{signal?:AbortSignal}} */(options)
 if(request.family==='publication-calendar')return acquireEiaSchedule(request,{fetchImpl,signal})
 const p=prepareEia(request),c=/** @type {any} */(p.request.criteria),json=await providerJson(fetchImpl,p.url,{}, {signal}),r=json?.response
 if(json?.error||!r||typeof r!=='object'||Array.isArray(r))fail('PROVIDER_SCHEMA_CHANGED',502)
 const sourceUrl=p.url,limit=c.limit??100
 if(request.family==='data-catalog'){
  if(c.facet){
   if(!Array.isArray(r.facets))fail('PROVIDER_SCHEMA_CHANGED',502)
   const item=dataset({kind:'FACET_METADATA',datasetId:c.path+'/facet/'+c.facet,name:c.facet,values:r.facets.map(f=>({id:optional(f.id),name:optional(f.name),alias:optional(f.alias)})),totalValues:optional(r.totalFacets)})
   return answer(request.family,'eia',[makeRecord(request.family,'eia','v2-facets',item,{sourceUrl,vendorRecordId:item.datasetId})],{limit})
  }
  const fields=Object.entries(r.data??{}).map(([key,m])=>field(key,'number|string|null',optional(m?.alias??m?.name),optional(m?.units)))
  const item=dataset({datasetId:c.path??'',name:optional(r.name??r.id)??'EIA API v2',description:optional(r.description),
   children:(r.routes??[]).map(v=>({id:String(v.id),name:optional(v.name),description:optional(v.description)})),
   fields,frequencies:(r.frequency??[]).map(v=>({id:String(v.id),description:optional(v.description),format:optional(v.format),query:optional(v.query)})),
   facets:(r.facets??[]).map(v=>({id:String(v.id),description:optional(v.description)})),periodRange:{start:optional(r.startPeriod),end:optional(r.endPeriod)},
   defaultFrequency:optional(r.defaultFrequency),defaultDateFormat:optional(r.defaultDateFormat),schemaFingerprint:schemaFingerprint(fields),upstreamApiVersion:optional(json.apiVersion)})
  return answer(request.family,'eia',[makeRecord(request.family,'eia','v2-metadata',item,{sourceUrl,vendorRecordId:c.path||null})],{limit})
 }
 if(!Array.isArray(r.data))fail('PROVIDER_SCHEMA_CHANGED',502)
 const units=new Set(c.data.flatMap(k=>[k,k+'-units',k+'_units'])),items=r.data.map(row=>{
  if(!row||typeof row.period!=='string'||c.data.some(k=>!Object.hasOwn(row,k)))fail('PROVIDER_SCHEMA_CHANGED',502)
  const dimensions=Object.fromEntries(Object.entries(row).filter(([k])=>k!=='period'&&!units.has(k)&&!['units','unit'].includes(k)).map(([k,v])=>[k,value(v)]))
  const measures=c.data.map(k=>({field:k,value:value(row[k]),unit:optional(row[k+'-units']??row[k+'_units']??row.units??row.unit),currency:null}))
  return makeRecord(request.family,'eia','v2-data',{datasetId:c.path,referencePeriod:row.period,frequency:optional(r.frequency)??c.frequency,dimensions,measures,observedAt:null,publishedAt:null,revisionStatus:'PROVIDER_CURRENT_SNAPSHOT_NOT_VINTAGE',upstreamApiVersion:optional(json.apiVersion)},{sourceUrl})
 })
 const total=/^\d+$/.test(String(r.total))&&Number.isSafeInteger(Number(r.total))?Number(r.total):null
 const result=answer(request.family,'eia',items,{limit,offset:c.offset??0,total,nativeFilters:Object.keys(c),providerReturned:r.data.length})
 if(request.contractVersion==='1.4.0'){result.contractVersion='1.4.0';for(const item of result.items)item.metadata.contractVersion='1.4.0'}
 return result
}}}
