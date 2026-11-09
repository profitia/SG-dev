export const ASSISTANT_CONTEXT_CONTRACT=Object.freeze({id:'profitia.assistant-context',version:'1.0.0'})
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
 if(!exact(value,['version','source','seriesId','from','to','fingerprint'])||value.version!=='1.0.0'||value.source!=='BENCHMARK_CHART'
  ||typeof value.seriesId!=='string'||!/^[a-z0-9_./-]{1,256}$/i.test(value.seriesId)||!/^[a-f0-9]{64}$/.test(value.fingerprint??''))throw TypeError('Invalid chart reference')
 const from=contextDate(value.from),to=contextDate(value.to)
 if(from>to)throw TypeError('Invalid chart period')
 return Object.freeze({...value,from,to})
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
