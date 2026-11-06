import {parseCommodityRequest} from '../../../../packages/platform-source-hub-contracts/commodities-v1.mjs'
import {providerJson,fail} from '../transport.mjs'
import {answer,dataset,field,makeRecord,optional,value,schemaFingerprint} from './commodity-records.mjs'
export const CFTC_ORIGIN='https://publicreporting.cftc.gov'
const literal=v=>typeof v==='string'?"'"+v.replaceAll("'","''")+"'":String(v)
export function prepareCftc(request){
 const r=parseCommodityRequest(request),c=/** @type {any} */(r.criteria),limit=c.limit??100,offset=c.offset??0
 const path=r.operation==='catalog'?'/api/views.json':r.operation==='metadata'?'/api/views/'+c.datasetId+'.json':'/resource/'+c.datasetId+'.json',u=new URL(CFTC_ORIGIN+path)
 if(r.operation==='catalog'){u.searchParams.set('limit',String(limit));u.searchParams.set('offset',String(offset))}
 if(r.operation==='observations'){
  u.searchParams.set('$limit',String(limit));u.searchParams.set('$offset',String(offset));u.searchParams.set('$order',(c.orderBy??'report_date_as_yyyy_mm_dd')+' '+(c.direction??'desc'))
  if(c.columns)u.searchParams.set('$select',[...new Set(['report_date_as_yyyy_mm_dd','cftc_contract_market_code','market_and_exchange_names','open_interest_all',...c.columns])].join(','))
  if(c.filters?.length)u.searchParams.set('$where',c.filters.map(f=>f.field+({eq:' = ',gte:' >= ',lte:' <= '}[f.op])+literal(f.value)).join(' AND '))
 }
 return {url:u.href,request:r}
}
function metadata(v){
 if(!/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(v.id??''))fail('PROVIDER_SCHEMA_CHANGED',502)
 const fields=(v.columns??[]).filter(f=>!String(f.fieldName??'').startsWith(':')).map(f=>({...field(String(f.fieldName??f.name),optional(f.dataTypeName),optional(f.description),null),displayName:optional(f.name),statistics:{smallest:optional(f.cachedContents?.smallest),largest:optional(f.cachedContents?.largest),nullCount:optional(f.cachedContents?.null),nonNullCount:optional(f.cachedContents?.non_null)}}))
 return dataset({datasetId:String(v.id),name:optional(v.name)??String(v.id),description:optional(v.description),fields,schemaFingerprint:schemaFingerprint(fields),
  frequencies:[{id:'weekly',description:'COT positions as of Tuesday; generally published Friday. Holidays may alter the schedule.'}],
  periodRange:{start:fields.find(f=>f.name==='report_date_as_yyyy_mm_dd')?.statistics.smallest??null,end:fields.find(f=>f.name==='report_date_as_yyyy_mm_dd')?.statistics.largest??null},viewType:optional(v.viewType),displayType:optional(v.displayType),parentDatasetIds:v.parentId?[String(v.parentId)]:[],primaryKey:'NOT_ASSERTED',
  providerDatasetUpdatedAt:Number.isFinite(v.rowsUpdatedAt)?new Date(v.rowsUpdatedAt*1000).toISOString():null,
  categories:(v.tags??[]).filter(v=>typeof v==='string'),geography:['REPORTED_CONTRACT_MARKETS'],publicationTimingSource:'https://publicreporting.cftc.gov/stories/s/COT-Help/p2fg-u73y/'})
}
/** @param {{fetchImpl?:Function}} options */
export function createCftcProvider({fetchImpl}={}){return {/** @param {any} request @param {{signal?:AbortSignal}} options */async acquire(request,options={}){
 const {signal}=/** @type {{signal?:AbortSignal}} */(options)
 const p=prepareCftc(request),c=/** @type {any} */(p.request.criteria),rows=await providerJson(fetchImpl,p.url,{}, {signal}),limit=c.limit??100
 if(request.family==='data-catalog'){
  const list=request.operation==='catalog'?rows:[rows]
  if(!Array.isArray(list)||list.some(v=>!v||!v.id||!v.name))fail('PROVIDER_SCHEMA_CHANGED',502)
  const items=list.map(v=>makeRecord(request.family,'cftc','socrata-metadata',metadata(v),{sourceUrl:CFTC_ORIGIN+'/api/views/'+v.id+'.json',vendorRecordId:String(v.id)}))
  return answer(request.family,'cftc',items,{limit:request.operation==='metadata'?1:limit,offset:c.offset??0,providerReturned:list.length,nativeFilters:Object.keys(c)})
 }
 if(!Array.isArray(rows))fail('PROVIDER_SCHEMA_CHANGED',502)
 const items=rows.map(row=>{
  const date=optional(row.report_date_as_yyyy_mm_dd),contract=optional(row.cftc_contract_market_code)
  if(!date||!/^\d{4}-\d\d-\d\d/.test(date)||!contract||!Object.hasOwn(row,'open_interest_all'))fail('PROVIDER_SCHEMA_CHANGED',502)
  const columns=Object.fromEntries(Object.entries(row).map(([k,v])=>[k,value(v)]))
  return makeRecord(request.family,'cftc','socrata-cot',{datasetId:c.datasetId,reportDate:date.slice(0,10),contractCode:contract,contractName:optional(row.market_and_exchange_names??row.contract_market_name),
   reportVariant:optional(row.futonly_or_combined),providerRowId:optional(row.id),columns,uniqueness:'NOT_ASSERTED',unitBasis:'PROVIDER_COLUMN_DEFINITION_REQUIRED',publicationAt:null,revisionStatus:'PROVIDER_CURRENT_REPORT_SNAPSHOT'},
   {sourceUrl:p.url,vendorRecordId:optional(row.id)})
 })
 return answer(request.family,'cftc',items,{limit,offset:c.offset??0,providerReturned:rows.length,nativeFilters:Object.keys(c)})
}}}
