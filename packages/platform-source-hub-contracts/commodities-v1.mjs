import {SourceHubError} from './index.mjs'
export const COMMODITY_CONTRACT_VERSION='1.1.0'
export const PUBLICATION_SCHEDULE_CONTRACT_VERSION='1.2.0'
export const DURABLE_SCHEDULE_CONTRACT_VERSION='1.3.0'
const scheduleVersion=v=>[PUBLICATION_SCHEDULE_CONTRACT_VERSION,DURABLE_SCHEDULE_CONTRACT_VERSION].includes(v)
export const COMMODITY_FAMILIES=Object.freeze(['data-catalog','series-observations','positioning-observations','publication-calendar'])
export const COMMODITY_PROVIDERS=Object.freeze({eia:['data-catalog','series-observations'],cftc:['data-catalog','positioning-observations'],'commodities-sh':['data-catalog','publication-calendar']})
const plain=v=>v!==null&&Object.getPrototypeOf(v)===Object.prototype
const closed=(v,keys)=>plain(v)&&Object.keys(v).every(k=>keys.includes(k)&&!['__proto__','constructor','prototype'].includes(k))
const fail=(code='INVALID_CONTRACT')=>{throw new SourceHubError(code)}
const name=v=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,99}$/.test(v)
const names=v=>Array.isArray(v)&&v.length>0&&v.length<=200&&v.every(name)&&new Set(v).size===v.length
export function parseCommodityRequest(v){
 if(scheduleVersion(v?.contractVersion))return parsePublicationScheduleRequest(v)
 if(!closed(v,['contractVersion','provider','family','operation','criteria'])||v.contractVersion!==COMMODITY_CONTRACT_VERSION
  ||!Object.hasOwn(COMMODITY_PROVIDERS,v.provider)||!COMMODITY_PROVIDERS[v.provider].includes(v.family)||!plain(v.criteria))fail()
 const c=v.criteria,fields=v.family==='data-catalog'?['path','datasetId','endpoint','facet','offset','limit']:v.provider==='eia'?['path','frequency','data','facets','start','end','sort','offset','limit']:v.provider==='cftc'?['datasetId','columns','filters','orderBy','direction','offset','limit']:['limit']
 if(!closed(c,fields))fail('UNSUPPORTED_CRITERIA')
 const operations=v.family==='data-catalog'?['catalog','metadata']:v.family==='publication-calendar'?['calendar']:['observations']
 if(!operations.includes(v.operation))fail('UNSUPPORTED_OPERATION')
 for(const k of ['offset','limit'])if(c[k]!==undefined&&(!Number.isSafeInteger(c[k])||c[k]<(k==='limit'?1:0)||c[k]>(k==='limit'?1000:Number.MAX_SAFE_INTEGER)))fail('INVALID_CRITERIA')
 if(v.provider==='eia'){
  if(c.path!==undefined&&(typeof c.path!=='string'||c.path.length>1024||c.path!==''&&!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(c.path)))fail('INVALID_CRITERIA')
  if(c.facet!==undefined&&!name(c.facet)||c.frequency!==undefined&&!name(c.frequency)||c.data!==undefined&&!names(c.data))fail('INVALID_CRITERIA')
  if(c.facets!==undefined&&(!plain(c.facets)||Object.keys(c.facets).length>30||Object.entries(c.facets).some(([k,a])=>!name(k)||!Array.isArray(a)||!a.length||a.length>100||a.some(x=>typeof x!=='string'||!x.length||x.length>200||/[\x00-\x1f]/.test(x)))))fail('INVALID_CRITERIA')
  for(const k of ['start','end'])if(c[k]!==undefined&&(typeof c[k]!=='string'||!/^\d[0-9QTZ:+.-]{0,39}$/.test(c[k])))fail('INVALID_CRITERIA')
  if(c.sort!==undefined&&(!Array.isArray(c.sort)||!c.sort.length||c.sort.length>5||c.sort.some(s=>!closed(s,['column','direction'])||!name(s.column)||!['asc','desc'].includes(s.direction))))fail('INVALID_CRITERIA')
  if(v.family==='series-observations'&&(!c.path||!c.frequency||!c.data))fail('MISSING_CRITERIA')
 }else if(v.provider==='cftc'){
  if(c.datasetId!==undefined&&(typeof c.datasetId!=='string'||!/^[a-z0-9]{4}-[a-z0-9]{4}$/.test(c.datasetId)))fail('INVALID_CRITERIA')
  if((v.operation==='metadata'||v.operation==='observations')&&!c.datasetId)fail('MISSING_CRITERIA')
  if(c.columns!==undefined&&!names(c.columns)||c.orderBy!==undefined&&!name(c.orderBy)||c.direction!==undefined&&!['asc','desc'].includes(c.direction))fail('INVALID_CRITERIA')
  if(c.filters!==undefined&&(!Array.isArray(c.filters)||c.filters.length>20||c.filters.some(f=>!closed(f,['field','op','value'])||!name(f.field)||!['eq','gte','lte'].includes(f.op)||!['string','number','boolean'].includes(typeof f.value)||typeof f.value==='string'&&(f.value.length>500||/[\x00-\x1f]/.test(f.value))||typeof f.value==='number'&&!Number.isFinite(f.value))))fail('INVALID_CRITERIA')
 }else if(c.endpoint!==undefined&&!['catalog','openapi'].includes(c.endpoint))fail('PAID_OPERATION_NOT_ACTIVATED')
 // A family never becomes a generic URL/proxy/SoQL or payment capability.
 if(v.provider!=='eia'&&['path','facet','frequency','data','facets','start','end','sort'].some(k=>k in c)
  ||v.provider!=='cftc'&&['datasetId','columns','filters','orderBy','direction'].some(k=>k in c)
  ||v.provider!=='commodities-sh'&&'endpoint' in c)fail('UNSUPPORTED_CRITERIA')
 return structuredClone(v)
}
export function parsePublicationScheduleRequest(v){
 if(!closed(v,['contractVersion','provider','family','operation','criteria'])||!scheduleVersion(v.contractVersion)||!['eia','commodities-sh'].includes(v.provider)||v.family!=='publication-calendar'||v.operation!=='calendar')fail()
 const c=v.criteria
 if(!closed(c,v.provider==='eia'?['publication','from','to','limit']:['limit']))fail('UNSUPPORTED_CRITERIA')
 if(c.limit!==undefined&&(!Number.isSafeInteger(c.limit)||c.limit<1||c.limit>1000))fail('INVALID_CRITERIA')
 if(v.provider==='eia'){
  const day=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
  if(!['wpsr','steo'].includes(c.publication)||!day(c.from)||!day(c.to)||c.from>c.to||(Date.parse(c.to)-Date.parse(c.from))/86400000>366)fail('INVALID_CRITERIA')
 }
 return structuredClone(v)
}
const scalar=v=>v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)
const text=v=>typeof v==='string'&&v.length<=16384
const time=v=>v===null||typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v))
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export function assertCommodityResponse(v,expected){
 const reject=()=>{throw new SourceHubError('INVALID_UPSTREAM_RESPONSE',502)}
 parseCommodityRequest(expected)
 if(!closed(v,['contractVersion','provider','family','status','items','page','provenance','usage','coverage'])||v.contractVersion!==expected.contractVersion
  ||v.provider!==expected.provider||v.family!==expected.family||!['ok','empty'].includes(v.status)||!Array.isArray(v.items)||v.items.length>1000||v.status!==(v.items.length?'ok':'empty')
  ||!closed(v.provenance,['retrievedAt','licenceRef','qualityStatus'])||!time(v.provenance.retrievedAt)||!v.provenance.retrievedAt||!text(v.provenance.licenceRef)||v.provenance.licenceRef==='PENDING_ADMISSION'
  ||!v.usage||![0,1].includes(v.usage.upstreamAttempts)||typeof v.usage.cacheHit!=='boolean'||!/^[a-f0-9-]{36}$/i.test(v.usage.receiptRef??'')
  ||!v.page||!['page','pageSize','total'].every(k=>v.page[k]===null||Number.isSafeInteger(v.page[k])&&v.page[k]>=0)||![true,false,null].includes(v.page.more)||typeof v.page.truncated!=='boolean')reject()
 const c=v.coverage
 if(scheduleVersion(expected.contractVersion)){
  if(!closed(c,['scope','completeness','providerRows','projected','ruleDerived','returned','nativeFilters','localFilters'])||c.scope!=='SOURCE_SCHEDULE_PROJECTION'||!['UNKNOWN','INCOMPLETE'].includes(c.completeness)
   ||!(c.providerRows===null||Number.isSafeInteger(c.providerRows)&&c.providerRows>=0)||!['projected','ruleDerived','returned'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0)||c.returned!==v.items.length||c.returned>c.projected||c.ruleDerived>c.projected||!['nativeFilters','localFilters'].every(k=>Array.isArray(c[k])&&c[k].every(text)))reject()
 }else if(!closed(c,['scope','completeness','providerReturned','matchedLocally','returned','nativeFilters','localFilters'])||c.scope!=='PROVIDER_RETURNED_SUBSET'||!['UNKNOWN','INCOMPLETE'].includes(c.completeness)
  ||!['providerReturned','matchedLocally','returned'].every(k=>Number.isSafeInteger(c[k])&&c[k]>=0)||c.returned!==v.items.length||c.returned>c.matchedLocally||c.matchedLocally>c.providerReturned
  ||!['nativeFilters','localFilters'].every(k=>Array.isArray(c[k])&&c[k].every(text)))reject()
 for(const {metadata:m,payload:p} of v.items){
  if(!plain(p)||!m||m.contractVersion!==expected.contractVersion||m.contractFamily!==v.family||m.apiFamily!==v.family||m.providerId!==v.provider
   ||!text(m.sourceRecordRef)||!hex(m.contentFingerprint)||m.usageReceiptRef!==v.usage.receiptRef||m.licenceRef!==v.provenance.licenceRef
   ||!['PROVIDER_REPORTED','UNKNOWN'].includes(m.qualityStatus)||!time(m.retrievedAt)||!m.retrievedAt||!time(m.availableAt)||!time(m.asOf)||!time(m.retentionUntil)
   ||m.redistribution!=='PRIVATE_AUTHORISED_CONSUMER_ONLY'||!(m.vendorRecordId===null||text(m.vendorRecordId)))reject()
  try{const u=new URL(m.sourceUrl);if(u.protocol!=='https:'||u.username||u.password||[...u.searchParams.keys()].some(k=>/api.?key|token|secret/i.test(k)))reject()}catch{reject()}
  if(v.family==='data-catalog'){
   if(!['DATASET_METADATA','OPERATION_METADATA','INSTRUMENT_METADATA','FACET_METADATA'].includes(p.kind)||!text(p.datasetId)||!text(p.name)||!Array.isArray(p.fields)||!Array.isArray(p.children)||!Array.isArray(p.frequencies)||!Array.isArray(p.facets))reject()
   if(p.fields.some(f=>!plain(f)||!text(f.name)||!(f.unit===null||text(f.unit))))reject()
   if(m.consumerStorage!==undefined&&(!closed(m.consumerStorage,['mode','basisRef','licenceVersion'])||m.consumerStorage.mode!=='CATALOG_METADATA_ONLY'||!text(m.consumerStorage.basisRef)||!/^[1-9][0-9]*$/.test(m.consumerStorage.licenceVersion)))reject()
  }else{
   if(expected.contractVersion===DURABLE_SCHEDULE_CONTRACT_VERSION){if(!validScheduleStorageRights(m.consumerStorage))reject()}
   else if(m.consumerStorage!==undefined)reject()
   if(v.family==='series-observations'&&(!text(p.datasetId)||!text(p.referencePeriod)||!text(p.frequency)||!plain(p.dimensions)||!Array.isArray(p.measures)||!p.measures.length||p.measures.some(x=>!text(x.field)||!scalar(x.value)||!(x.unit===null||text(x.unit)))||!time(p.observedAt)||!time(p.publishedAt)))reject()
   if(v.family==='positioning-observations'&&(!text(p.datasetId)||!text(p.reportDate)||!text(p.contractCode)||!plain(p.columns)||!Object.values(p.columns).every(scalar)||p.uniqueness!=='NOT_ASSERTED'||p.publicationAt!==null||p.unitBasis!=='PROVIDER_COLUMN_DEFINITION_REQUIRED'))reject()
   if(v.family==='publication-calendar'){
    if(scheduleVersion(expected.contractVersion)){
     if(expected.contractVersion===DURABLE_SCHEDULE_CONTRACT_VERSION&&!closed(p,['kind','scheduleId','title','publicationRef','correlationKey','identityStatus','scheduledAt','scheduledUntil','dateOnly','localDateTime','timeZone','timePrecision','recurrence','referencePeriod','releaseStatus','scheduleStatus','sourceName','sourceUrl','officialSource','sourceUpdatedAt','lastVerifiedAt','standardSchedule','exception','sourceTiming','qualityFlags','actual','previous','forecast','publishedAt']))reject()
     assertPublicationSchedule(p,reject)
    }
    else if(!text(p.scheduleId)||!text(p.title)||!time(p.scheduledAt)||!(p.dateOnly===null||text(p.dateOnly))||!(p.recurrence===null||text(p.recurrence))||p.kind!=='PUBLICATION_SCHEDULE'||p.releaseStatus!=='PROVIDER_SCHEDULE_ONLY')reject()
   }
  }
 }
 return v
}
export function validScheduleStorageRights(r){
 return closed(r,['mode','basisRef','licenceVersion','rightsVersion','consumerApplicationId','retentionMode','redistribution'])
  &&r.mode==='DURABLE_OWNER_ENTITLEMENT'&&typeof r.basisRef==='string'&&r.basisRef.length>0&&r.basisRef.length<=256
  &&typeof r.licenceVersion==='string'&&/^[1-9][0-9]*$/.test(r.licenceVersion)&&typeof r.rightsVersion==='string'&&/^[1-9][0-9]*$/.test(r.rightsVersion)
  &&r.consumerApplicationId==='profitia-economic-calendar-runtime-development'&&r.retentionMode==='DURABLE_NO_FIXED_EXPIRY'&&r.redistribution==='PRIVATE_AUTHORISED_CONSUMER_ONLY'
}
function assertPublicationSchedule(p,reject){
 const nullable=x=>x===null||text(x)
 const date=x=>x===null||typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x
 if(p.kind!=='PUBLICATION_SCHEDULE'||p.releaseStatus!=='PROVIDER_SCHEDULE_ONLY'||!nullable(p.scheduleId)||!text(p.title)||!text(p.publicationRef)||!hex(p.correlationKey)
  ||!['PROVIDER_ID','CORRELATION_ONLY','OFFICIAL_PUBLICATION_DEFINITION'].includes(p.identityStatus)||p.identityStatus==='PROVIDER_ID'&&p.scheduleId===null
  ||!time(p.scheduledAt)||!time(p.scheduledUntil)||!date(p.dateOnly)||!nullable(p.localDateTime)||!nullable(p.timeZone)||!nullable(p.recurrence)||!nullable(p.referencePeriod)
  ||!['INSTANT','DATE','TIME_WINDOW','RECURRENCE_ONLY','UNKNOWN'].includes(p.timePrecision)||!['OFFICIAL_EXCEPTION','OFFICIAL_DATED','RULE_DERIVED_UNCONFIRMED','PROVIDER_REPORTED','UNDATED'].includes(p.scheduleStatus)
  ||typeof p.officialSource!=='boolean'||!nullable(p.sourceName)||!nullable(p.sourceUrl)||p.lastVerifiedAt!=='metadata.retrievedAt'||p.sourceUpdatedAt!==null
  ||!closed(p.sourceTiming,['rawDate','typicalTime','nextHint'])||!['rawDate','typicalTime','nextHint'].every(k=>nullable(p.sourceTiming[k]))
  ||!Array.isArray(p.qualityFlags)||!p.qualityFlags.every(text)||!p.qualityFlags.includes('SCHEDULE_NOT_RESULT')||!['actual','previous','forecast','publishedAt'].every(k=>p[k]===null))reject()
 if(p.timeZone!==null){try{new Intl.DateTimeFormat('en',{timeZone:p.timeZone})}catch{reject()}}
 if(p.timePrecision==='INSTANT'&&p.scheduledAt===null||p.timePrecision==='TIME_WINDOW'&&(p.scheduledAt===null||p.scheduledUntil===null||p.scheduledUntil<=p.scheduledAt)||p.timePrecision==='DATE'&&(p.dateOnly===null||p.scheduledAt!==null)||['RECURRENCE_ONLY','UNKNOWN'].includes(p.timePrecision)&&p.scheduledAt!==null)reject()
 if(p.scheduleStatus==='OFFICIAL_EXCEPTION'&&(!plain(p.exception)||!text(p.exception.reason)||!date(p.exception.standardDate)))reject()
}
