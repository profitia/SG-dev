export const ASSISTANT_CONTEXT_CONTRACT=Object.freeze({id:'profitia.assistant-context',version:'2.1.0'})
export const CONTEXT_STATUSES=Object.freeze(['OK','EMPTY','PARTIAL','DENIED','UNAVAILABLE','STALE'])
const record=v=>!!v&&typeof v==='object'&&!Array.isArray(v)
const exact=(v,keys)=>record(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',')
export function contextDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(value))throw TypeError('Invalid context date')
 const day=value.slice(0,10)
 if(!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day)throw TypeError('Invalid context date')
 return day
}
export function readChartReference(value){
 if(!exact(value,['version','source','seriesId','from','to','fingerprint',...(value?.version==='1.1.0'?['range']:[])])||!['1.0.0','1.1.0'].includes(value.version)||value.source!=='BENCHMARK_CHART'
  ||value.version==='1.1.0'&&!['1M','3M','6M','1Y','3Y','5Y','ALL'].includes(value.range)
  ||typeof value.seriesId!=='string'||!/^[a-z0-9_./-]{1,256}$/i.test(value.seriesId)||!/^[a-f0-9]{64}$/.test(value.fingerprint??''))throw TypeError('Invalid chart reference')
 const from=contextDate(value.from),to=contextDate(value.to)
 if(from>to)throw TypeError('Invalid chart period')
 return Object.freeze({...value,from,to})
}

const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const frequencies=['DAILY','WEEKLY','MONTHLY','BIMONTHLY','QUARTERLY','QUADMONTHLY','SEMIANNUAL','ANNUAL']
/** Selections carry identifiers, never browser facts, identity or permission.
 * Each producer must resolve these hints under the current server authority. */
export function readContextReference(value){
 if(value?.source==='BENCHMARK_CHART')return readChartReference(value)
 if(value?.version==='2.1.0'&&value.source==='PUBLISHED_REPORT'){
  if(!exact(value,['version','source','producerJobId','pdfSha256','markdownSha256'])||!uuid(value.producerJobId)||![value.pdfSha256,value.markdownSha256].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)))throw TypeError('Invalid published report reference')
  return Object.freeze({...value})
 }
 if(value?.version==='2.1.0'&&value.source==='NEWSFEED'){
  if(!exact(value,['version','source','observationId','supplierNip','runId','publicationId'])||!uuid(value.observationId)||value.supplierNip!==null||[value.runId,value.publicationId].some(v=>v!==null&&!uuid(v)))throw TypeError('Invalid selected Newsfeed reference')
  return Object.freeze({...value})
 }
 if(value?.version!=='2.0.0')throw TypeError('Invalid context reference')
 if(value.source==='FORECAST_CORE'){
  if(!exact(value,['version','source','seriesId','modelIds','targetBasis','sourceFrequency','targetCadence','verification'])
   ||typeof value.seriesId!=='string'||!/^[a-z0-9_./-]{1,256}$/i.test(value.seriesId)
   ||!Array.isArray(value.modelIds)||!value.modelIds.length||value.modelIds.length>4||new Set(value.modelIds).size!==value.modelIds.length
   ||value.modelIds.some(m=>!['naive','damped_holt','ets','arima'].includes(m))
   ||!['POINT_IN_TIME','MONTHLY_AVERAGE','END_OF_PERIOD'].includes(value.targetBasis)||typeof value.verification!=='boolean'
   ||(value.sourceFrequency===null)!==(value.targetCadence===null)
   ||value.sourceFrequency!==null&&(!frequencies.includes(value.sourceFrequency)||!frequencies.includes(value.targetCadence))
   ||value.targetBasis==='POINT_IN_TIME'&&value.sourceFrequency!==null&&(value.sourceFrequency!=='DAILY'||value.targetCadence!=='DAILY'))throw TypeError('Invalid Forecast reference')
  return Object.freeze({...value,modelIds:Object.freeze([...value.modelIds])})
 }
 if(value.source==='SRM_XRAY'){
  if(!exact(value,['version','source','nip','entityType','krs','year','comparisonYear','statementScope','sourceVersion'])
   ||typeof value.nip!=='string'||!/^\d{10}$/.test(value.nip)||!['COMPANY','JDG'].includes(value.entityType)
   ||value.krs!==null&&(typeof value.krs!=='string'||!/^\d{10}$/.test(value.krs))
   ||value.year!==null&&(!Number.isInteger(value.year)||value.year<1800||value.year>2200)
   ||value.comparisonYear!==null&&(!Number.isInteger(value.comparisonYear)||value.comparisonYear<1800||value.comparisonYear>2200)
   ||!['standalone','consolidated'].includes(value.statementScope)
   ||value.sourceVersion!==null&&(typeof value.sourceVersion!=='string'||value.sourceVersion.length>256||!value.sourceVersion.length))throw TypeError('Invalid supplier reference')
  return Object.freeze({...value})
 }
 if(value.source==='NEWSFEED'){
  if(!exact(value,['version','source','observationId','supplierNip'])||value.observationId!==null&&!uuid(value.observationId)
   ||value.supplierNip!==null&&(typeof value.supplierNip!=='string'||!/^\d{10}$/.test(value.supplierNip)))throw TypeError('Invalid Newsfeed reference')
  return Object.freeze({...value})
 }
 throw TypeError('Unknown context producer')
}
export function readContextSelection(value){
 if(value===null)return null
 if(value?.source!=='CONTEXT_SELECTION')return readContextReference(value)
 if(!exact(value,['version','source','references'])||value.version!=='2.0.0'||!Array.isArray(value.references)
  ||!value.references.length||value.references.length>4)throw TypeError('Invalid context selection')
 const references=value.references.map(readContextReference)
 if(new Set(references.map(r=>r.source)).size!==references.length)throw TypeError('Duplicate context producer')
 return Object.freeze({version:'2.0.0',source:'CONTEXT_SELECTION',references:Object.freeze(references)})
}
export function contextReferences(value){
 const selected=readContextSelection(value)
 return selected===null?[]:selected.source==='CONTEXT_SELECTION'?selected.references:[selected]
}
/** Shared canonical bytes, not an authority assertion. Both the actual chart
 * and the authorised producer hash the same visible historical observations. */
export function benchmarkSnapshotBytes({seriesId,unit,currency,source,points}){
 if(typeof seriesId!=='string'||!/^[a-z0-9_./-]{1,256}$/i.test(seriesId)||!Array.isArray(points)||points.length>20000
  ||[unit,currency,source].some(v=>v!==null&&(typeof v!=='string'||v.length>512)))throw TypeError('Invalid benchmark snapshot')
 let previous=''
 const values=points.map(p=>{
  if(!record(p)||typeof p.value!=='number'&&p.value!==null||p.value!==null&&!Number.isFinite(p.value))throw TypeError('Invalid observation')
  const date=contextDate(p.date)
  if(date<=previous)throw TypeError('Unordered observation');previous=date
  return [date,p.value]
 })
 return JSON.stringify([seriesId,unit,currency,source,values])
}
