import { NextRequest } from 'next/server'
import type { SavedBenchmark, BenchmarkAnalyticsSeriesResult } from '../benchmark/contracts'
import { analysePriceChangeIndex } from './price-change-index-host'
import { preparePriceChangeIndex } from './price-change-index-preparation'
import { pciAnalysisRequest } from './price-change-index-contracts'
import { PCI_SMART_VERSION, pciOperationRequest } from './pci-smart-preparation-contracts'
import { analyseSmartPci } from './pci-smart-analysis'
import { prepareSmartPci, smartSelectionIssues } from './pci-smart-preparation'

export const PCI_PRIVATE_HEADERS = Object.freeze({'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'})
type Options = { isClerk:()=>boolean; selections:(request:NextRequest)=>Promise<Response>;
  history:(request:NextRequest)=>Promise<Response>; now:()=>string }
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:PCI_PRIVATE_HEADERS})
const unavailable=(status:number)=>reply({error:'Operation unavailable'},status)
async function body(request:Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim()!=='application/json' || !request.body) throw Error('INVALID_BODY')
  const reader=request.body.getReader(), chunks:Uint8Array[]=[];let bytes=0
  try {while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.length;
    if(bytes>32768 || request.signal.aborted)throw Error('INVALID_BODY');chunks.push(item.value)}}
  finally {await reader.cancel().catch(()=>{});reader.releaseLock()}
  const all=new Uint8Array(bytes);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length}
  return pciOperationRequest.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all)))
}
/** Stateless BFF composition. Every private selection and shared history read
 * still executes its existing accepted E1 operation. No new permission/cache,
 * database write, HTTP self-fetch or forecast request is introduced. */
export function createPriceChangeIndexHandler(options:Options) {
  return async(request:Request):Promise<Response>=>{
    if(request.method!=='POST')return unavailable(405)
    if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(request.headers.get('authorization')??''))return unavailable(401)
    if(!options.isClerk())return unavailable(503)
    if(new URL(request.url).search)return unavailable(400)
    let input:ReturnType<typeof pciOperationRequest.parse>
    try {input=await body(request)}catch{return unavailable(400)}
    const subrequest=(path:string)=>{
      const headers=new Headers()
      for(const key of ['authorization','host','origin']){const value=request.headers.get(key);if(value!==null)headers.set(key,value)}
      return new NextRequest(new URL(path,request.url),{method:'GET',headers,signal:request.signal})
    }
    try {
      const scope='organisationId='+encodeURIComponent(input.organisationId)
      const selectedResponse=await options.selections(subrequest('/api/benchmark/selection?'+scope))
      if(!selectedResponse.ok)return unavailable(selectedResponse.status)
      const selected=await selectedResponse.json() as {items:SavedBenchmark[]}
      if(!Array.isArray(selected.items) || selected.items.some(b=>b.organizationId!==input.organisationId))return unavailable(403)
      const wanted=input.category.components.map(c=>selected.items.find(b=>b.businessBenchmarkId===c.businessBenchmarkId))
      if(wanted.some(b=>!b))return unavailable(403)
      if(input.contractVersion===PCI_SMART_VERSION){
        const issues=smartSelectionIssues(input,selected.items)
        if(issues.length)return reply({contractVersion:PCI_SMART_VERSION,status:input.mode==='PREPARE'?'PREPARED':'REFUSED',
          preparation:prepareSmartPci(input,selected.items,new Map(),options.now()).preparation,...(input.mode==='PREPARE'?{}:{issues})},input.mode==='PREPARE'?200:422)
      }
      const histories=new Map<string,BenchmarkAnalyticsSeriesResult>()
      // Bounded parallel reads use the same existing E1 handler as Finder.
      const active=input.contractVersion===PCI_SMART_VERSION?wanted.filter((_,i)=>input.category.components[i].weightPercent>0):wanted
      const unique=[...new Map(active.map(b=>[b!.businessBenchmarkId,b!])).values()]
      for(let i=0;i<unique.length;i+=3){
        const results=await Promise.all(unique.slice(i,i+3).map(async benchmark=>{
          if(request.signal.aborted)throw new DOMException('Aborted','AbortError')
          const response=await options.history(subrequest('/api/benchmark/analytics-series?'+scope+'&range=ALL&seriesId='+encodeURIComponent(benchmark!.providerSeries.providerSeriesId)))
          if(!response.ok)return {status:response.status}
          const history=await response.json() as BenchmarkAnalyticsSeriesResult
          if(history.providerSeries?.providerSeriesId!==benchmark!.providerSeries.providerSeriesId || !Array.isArray(history.historical))return {status:503}
          histories.set(benchmark!.businessBenchmarkId,history);return {status:200}
        }))
        const failed=results.find(r=>r.status!==200);if(failed)return unavailable(failed.status)
      }
      if(request.signal.aborted)return unavailable(499)
      if(input.contractVersion===PCI_SMART_VERSION){
        const result=analyseSmartPci(input,selected.items,histories,options.now())
        return reply(result,result.status==='REFUSED'?422:200)
      }
      if(input.mode==='PREPARE')return reply(preparePriceChangeIndex(input,selected.items,histories,options.now()))
      const result=analysePriceChangeIndex(input,selected.items,histories,options.now())
      return reply(result,result.status==='CALCULATED'?200:422)
    }catch{return unavailable(request.signal.aborted?499:503)}
  }
}
