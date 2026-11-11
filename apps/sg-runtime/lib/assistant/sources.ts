import type {Prisma} from '@prisma/client'
import {OPERATION_CONTRACT,OperationDenied,type OperationExecutor} from '@profitia/platform-contracts/operation-context'
import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel'
import {createForecastContextAdapter,createSupplierContextAdapter,createNewsfeedContextAdapter,createPublishedReportContextAdapter,createEconomicCalendarContextAdapter} from '../../../../packages/assistant-context-gateway/src/index.mjs'
import economicTargets from '@/deployment/assistant-ecr-targets.json'
import type {Sg2SelectionRuntime} from '@/lib/platform/private-runtime'
import targets from '@/deployment/assistant-m2-targets.json'
import type {BenchmarkRangePreset} from '@/lib/benchmark/contracts'
type Native=Extract<Sg2SelectionRuntime,{provider:'clerk'}>
type Options={enabled:boolean;economicCalendarEnabled?:boolean;organisationId:string;forecast?:Native['forecastRead'];market?:{executor:OperationExecutor<Prisma.TransactionClient>;series:(selection:{seriesName:string;range:BenchmarkRangePreset})=>Promise<unknown>};fetcher?:typeof fetch}
const unavailable=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
async function peerRead(options:Options,request:unknown,organisationId:string,source:'srm'|'newsfeed',parameters:Record<string,string>,signal?:AbortSignal){
 if(!options.enabled||organisationId!==options.organisationId||!(request instanceof Request)||signal?.aborted)return unavailable()
 const authorization=request.headers.get('authorization')
 if(!authorization||!/^Bearer [^\s]{1,8192}$/.test(authorization))throw new OperationDenied('UNVERIFIED_IDENTITY')
 const peer=targets.sources[source],url=new URL(peer.path,peer.origin)
 for(const [key,value]of Object.entries(parameters))url.searchParams.set(key,value)
 if(source==='srm')url.searchParams.set('organisationId',organisationId)
 const response=await(options.fetcher??fetch)(url,{method:'GET',headers:{authorization,...(source==='newsfeed'?{'x-profitia-organisation-id':organisationId}:{})},
  credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.any([request.signal,...(signal?[signal]:[]),AbortSignal.timeout(15000)])})
 if(response.status!==200){await response.body?.cancel();throw new OperationDenied(response.status===401?'UNVERIFIED_IDENTITY':response.status===403||response.status===404?'PERMISSION_DENIED':'POLICY_UNAVAILABLE')}
 if(response.redirected||response.url&&new URL(response.url).origin!==peer.origin||response.headers.get('cache-control')!=='private, no-store'
  ||!['cookie','authorization'].every(v=>response.headers.get('vary')?.toLowerCase().split(',').map(s=>s.trim()).includes(v))
  ||response.headers.has('set-cookie')){await response.body?.cancel();return unavailable()}
 return readPresentationJson(response,256*1024)
}
export function createAssistantSourceAdapters(options:Options){
 return [
  createForecastContextAdapter({readAuthorised:async({selection,organisationId,request,signal})=>{
   if(!options.enabled||organisationId!==options.organisationId||!(request instanceof Request)||!options.forecast||signal?.aborted)return unavailable()
   const [{readForecastCurrentSelection,forecastCurrentResourceId,validatePublicForecastCurrent},
    {readForecastVerificationSelection,forecastVerificationResourceId,validatePublicForecastVerification},{cognitionOk}]=await Promise.all([
     import('@/lib/platform/forecast-current'),import('@/lib/platform/forecast-verification'),import('@/lib/api/middleware')])
   const forecast=options.forecast,models=[]
   for(const modelId of selection.modelIds){
    signal?.throwIfAborted()
    const native=readForecastCurrentSelection({seriesId:selection.seriesId,modelId,targetBasis:selection.targetBasis,
     ...(selection.sourceFrequency?{sourceFrequency:selection.sourceFrequency,targetCadence:selection.targetCadence}:{})})
    const answer=await forecast.executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
     operation:'forecast.read',organisationId,resourceId:forecastCurrentResourceId(native),payload:native,request},
     async()=>cognitionOk(await forecast.current(native)))
    if(!(answer.value instanceof Response)||answer.value.status!==200)return unavailable()
    const current=await validatePublicForecastCurrent(await answer.value.json(),native)
    let verification
    if(selection.verification&&forecast.verification){
     const v=readForecastVerificationSelection({...native,verificationScope:'FAST'}),port=forecast.verification
     const result=await port.executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
      operation:'forecast.read',organisationId,resourceId:forecastVerificationResourceId(v),payload:v,request},
      async()=>cognitionOk(await port.read(v)))
     if(!(result.value instanceof Response)||result.value.status!==200)return unavailable()
     verification=validatePublicForecastVerification(await result.value.json(),v)
    }
    models.push({modelId,current,verification})
   }
   // Period publications omit units. Resolve only those missing descriptors
   // through the existing authorised stored market read, never a provider.
   let unit:string|null=null,currency:string|null=null
   if(selection.targetBasis!=='POINT_IN_TIME'&&options.market){
    const market=options.market
    const result=await market.executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
     operation:'knowledge.read',organisationId,resourceId:'market-analytics:'+selection.seriesId,payload:{seriesName:selection.seriesId,range:'1Y'},request},
     async()=>cognitionOk(await market.series({seriesName:selection.seriesId,range:'1Y'})))
    if(!(result.value instanceof Response)||result.value.status!==200)return unavailable()
    const data=await result.value.json()
    if(data?.providerSeries?.providerSeriesId!==selection.seriesId)return unavailable()
    unit=typeof data.unit==='string'?data.unit:null;currency=typeof data.currency==='string'?data.currency:null
   }
   return {models,unit,currency}
  }}),
  createSupplierContextAdapter({readAuthorised:async({selection,organisationId,request,signal})=>{
   const params:Record<string,string>={nip:selection.nip,entityType:selection.entityType,statementScope:selection.statementScope}
   if(selection.krs!==null)params.krs=selection.krs
   if(selection.year!==null)params.year=String(selection.year)
   if(selection.comparisonYear!==null)params.comparisonYear=String(selection.comparisonYear)
   return peerRead(options,request,organisationId,'srm',params,signal)
  }}),
  createNewsfeedContextAdapter({readAuthorised:async({selection,organisationId,request,signal})=>{
   const params:Record<string,string>={}
   if(selection.observationId!==null)params.observationId=selection.observationId
   if(selection.supplierNip!==null)params.supplierNip=selection.supplierNip
   if(selection.version==='2.1.0'){params.selectionVersion=selection.version;if(selection.runId)params.runId=selection.runId;if(selection.publicationId)params.publicationId=selection.publicationId}
   return peerRead(options,request,organisationId,'newsfeed',params,signal)
  }}),
  createEconomicCalendarContextAdapter({readAuthorised:async({selection,organisationId,request,signal})=>{
   if(!options.enabled||options.economicCalendarEnabled!==true||organisationId!==options.organisationId
    ||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(organisationId)
    ||!(request instanceof Request)||request.signal.aborted||signal?.aborted)return unavailable()
   const authorization=request.headers.get('authorization')
   if(!authorization||!/^Bearer [^\s]{1,8192}$/.test(authorization))throw new OperationDenied('UNVERIFIED_IDENTITY')
   const peer=economicTargets.producer,url=new URL(peer.pathPrefix+encodeURIComponent(organisationId)+peer.pathSuffix,peer.origin)
   url.searchParams.set('from',selection.from);url.searchParams.set('to',selection.to);url.searchParams.set('limit',String(economicTargets.pageSize))
   if(selection.targetType!==null&&selection.targetId!==null){url.searchParams.set('targetType',selection.targetType);url.searchParams.set('targetId',selection.targetId)}
   if(selection.asKnownAt!==null)url.searchParams.set('asKnownAt',selection.asKnownAt)
   if(selection.after!==null)url.searchParams.set('after',selection.after)
   const response=await(options.fetcher??fetch)(url,{method:'GET',headers:{authorization},credentials:'omit',cache:'no-store',redirect:'error',
    signal:AbortSignal.any([request.signal,...(signal?[signal]:[]),AbortSignal.timeout(15000)])})
   if(response.status!==200){await response.body?.cancel();throw new OperationDenied(response.status===401?'UNVERIFIED_IDENTITY':response.status===403?'PERMISSION_DENIED':'POLICY_UNAVAILABLE')}
   // ECR's existing native read contract is no-store. Other peer contracts
   // keep their stronger, separately adopted header checks above unchanged.
   if(response.redirected||response.url&&new URL(response.url).origin!==peer.origin
    ||!['no-store','private, no-store'].includes(response.headers.get('cache-control')??'')
    ||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||response.headers.has('set-cookie')){
    await response.body?.cancel();return unavailable()
   }
   return readPresentationJson(response,256*1024)
  }}),
  createPublishedReportContextAdapter({readAuthorised:async({selection,organisationId,request,signal})=>{
   if(!options.enabled||organisationId!==options.organisationId||!(request instanceof Request)||signal?.aborted)return unavailable()
   const authorization=request.headers.get('authorization');if(!authorization||!/^Bearer [^\s]{1,8192}$/.test(authorization))throw new OperationDenied('UNVERIFIED_IDENTITY')
   const {reportSubscriptionsHttp}=await import('@/lib/insights/subscriptions')
   const response=await reportSubscriptionsHttp(new Request(new URL('/api/v1/insights/subscriptions/editions/'+selection.producerJobId,request.url),{headers:{authorization},signal:AbortSignal.any([request.signal,...(signal?[signal]:[]),AbortSignal.timeout(15000)])}))
   if(response.status!==200){await response.body?.cancel();throw new OperationDenied([401,403,404].includes(response.status)?'PERMISSION_DENIED':'POLICY_UNAVAILABLE')}
   if(response.headers.get('cache-control')!=='private, no-store'||response.headers.has('set-cookie'))return unavailable()
   return readPresentationJson(response,2*1024*1024)
  }}),
 ]
}
