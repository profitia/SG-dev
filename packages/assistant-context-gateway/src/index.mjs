import {createHash} from 'node:crypto'
import {ASSISTANT_CONTEXT_CONTRACT,readChartReference,benchmarkSnapshotBytes,contextDate,CONTEXT_STATUSES} from '../../assistant-context-contracts/src/index.mjs'
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const hash=v=>createHash('sha256').update(v).digest('hex')
function historicalComparison(from,to){
 const absoluteChange=to.value-from.value
 return {from:from.date,to:to.date,fromValue:from.value,toValue:to.value,absoluteChange,
  percentChange:from.value>0?absoluteChange/from.value*100:null}
}
function historicalChanges(observations){
 const first=observations[0],last=observations.at(-1)
 const recent=observations.filter(point=>point.date.slice(0,7)===last.date.slice(0,7))
 const minimum=recent.reduce((a,b)=>b.value<a.value?b:a),maximum=recent.reduce((a,b)=>b.value>a.value?b:a)
 return {entirePeriod:historicalComparison(first,last),finalCalendarMonth:{
  period:historicalComparison(recent[0],last),latestVersusMinimum:historicalComparison(minimum,last),latestVersusMaximum:historicalComparison(maximum,last)},
  meaning:'Deterministic changes in the verified stored historical observations. Absolute changes use the benchmark unit; percentChange is a percentage with a positive base, otherwise null. These calculations are not a forecast.'}
}
export const ASSISTANT_GATEWAY_CONTRACT=Object.freeze({id:'profitia.assistant-context-gateway',version:'1.1.0'})
/** Producers own reads, data and E1 authorisation. The gateway never accepts a
 * client ALLOW, cached permission, browser values or provider credentials. */
export function createAssistantContextGateway({adapters,now=Date.now}){
 if(!Array.isArray(adapters)||!adapters.length||new Set(adapters.map(a=>a.source)).size!==adapters.length
  ||adapters.some(a=>typeof a.source!=='string'||typeof a.read!=='function'))throw TypeError('Explicit context producers required')
 const sources=new Map(adapters.map(a=>[a.source,a]))
 return Object.freeze({contract:ASSISTANT_GATEWAY_CONTRACT,async resolve({plan,reference,request,organisationId,signal}){
  if(!Array.isArray(plan)||plan.length>4||plan.some(p=>!p||Object.keys(p).sort().join(',')!=='selection,source'||p.selection!=='ACTIVE_VIEW'))throw TypeError('Invalid context demand')
  const results=[]
  for(const demand of plan){
   if(signal?.aborted)throw signal.reason??Error('Context cancelled')
   const adapter=sources.get(demand.source)
   if(!adapter){results.push(freeze({source:demand.source,status:'UNAVAILABLE'}));continue}
   try{
    const value=await adapter.read({reference,request,organisationId,signal,observedAt:new Date(now()).toISOString()})
    if(signal?.aborted)throw signal.reason??Error('Context cancelled')
    if(!value||value.source!==demand.source||!CONTEXT_STATUSES.includes(value.status))throw TypeError('Invalid producer response')
    if(Buffer.byteLength(JSON.stringify(value),'utf8')>16000)throw TypeError('Oversized context')
    results.push(freeze(value))
   }catch(error){
    if(signal?.aborted)throw signal.reason??error
    results.push(freeze({source:demand.source,status:['UNVERIFIED_IDENTITY','PERMISSION_DENIED','ACCESS_BASIS_INVALID','PRODUCT_UNAVAILABLE','RESOURCE_SCOPE_MISMATCH','EXPLICIT_DENY','APPLICATION_FEATURE_UNAVAILABLE'].includes(error?.reasonCode)?'DENIED':'UNAVAILABLE'}))
   }
  }
  return freeze({contract:ASSISTANT_CONTEXT_CONTRACT,contexts:results})
 }})
}

/** The host's readAuthorised callback must use the existing producer's native
 * operation executor and ordinary stored-read role, on every read/recheck. */
export function createBenchmarkContextAdapter({readAuthorised}){
 if(typeof readAuthorised!=='function')throw TypeError('Authorised benchmark producer required')
 return Object.freeze({source:'BENCHMARK_CHART',async read({reference,request,organisationId,signal,observedAt}){
  if(reference===null)return {source:'BENCHMARK_CHART',status:'EMPTY'}
  const selected=readChartReference(reference)
  const data=await readAuthorised({seriesId:selected.seriesId,range:selected.range??'ALL',organisationId,request,signal})
  if(!data||data.providerSeries?.providerSeriesId!==selected.seriesId||!Array.isArray(data.historical)
   ||typeof data.displayName!=='string'||data.displayName.length>1024)throw TypeError('Invalid benchmark publication')
  const points=data.historical.map(p=>({date:contextDate(p.date),value:p.value})).filter(p=>p.date>=selected.from&&p.date<=selected.to)
  const bytes=benchmarkSnapshotBytes({seriesId:selected.seriesId,unit:data.unit,currency:data.currency,source:data.source,points})
  const version=hash(bytes),base={source:'BENCHMARK_CHART',id:'benchmark:'+selected.seriesId,label:data.displayName,
   sourceVersion:version,contractVersion:ASSISTANT_CONTEXT_CONTRACT.version,observedAt,asOf:points.at(-1)?.date??null}
  if(version!==selected.fingerprint)return {...base,status:'STALE'}
  if(!points.length||points.every(p=>p.value===null))return {...base,status:'EMPTY'}
  // Deterministic sampling is explicit. Never misrepresent sampled values as
  // the complete chart, or historical data as a current Forecast publication.
  const sampled=points.length<=128?points:Array.from(new Set(Array.from({length:128},(_,i)=>Math.round(i*(points.length-1)/127)))).map(i=>points[i])
  const numeric=points.filter(p=>p.value!==null)
  const minimum=numeric.reduce((a,b)=>b.value<a.value?b:a),maximum=numeric.reduce((a,b)=>b.value>a.value?b:a)
  return {...base,status:sampled.length<points.length||points.some(p=>p.value===null)||data.unit===null?'PARTIAL':'OK',
   selection:{seriesId:selected.seriesId,range:selected.range??'ALL',from:selected.from,to:selected.to,series:['historical']},
   data:{name:data.displayName,unit:data.unit,currency:data.currency,provider:data.source,frequency:data.frequency,
    observationCount:points.length,sampled:sampled.length<points.length,points:sampled,minimum,maximum,historicalChanges:historicalChanges(numeric),
    meaning:'Stored historical benchmark observations; no Forecast Core forecast or guaranteed latest provider refresh.'}}
 }})
}
