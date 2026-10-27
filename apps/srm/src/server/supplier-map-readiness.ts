import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel'
import targets from '../../deployment/supplier-location-targets.json'

const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
type Options={read:(request:Request,supplierId:string)=>Promise<void>;transport?:typeof fetch;pause?:(signal:AbortSignal)=>Promise<void>}
const pause=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 signal.throwIfAborted()
 const abort=()=>{clearTimeout(timer);reject(signal.reason)},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},3000)
 signal.addEventListener('abort',abort,{once:true})
})
/** Read authorization finishes before this public, fixed-origin health probe.
 * No token, location, provider key or caller-selected URL leaves SRM. */
export function createSupplierMapReadinessHandler(options:Options){
 return async(request:Request)=>{
  const reply=(status:number,ready=false)=>Response.json({ready},{status,headers})
  const query=new URL(request.url).searchParams,supplier=query.get('supplierId')
  if(request.method!=='GET')return reply(405)
  if(!supplier||!uuid.test(supplier)||query.getAll('supplierId').length!==1||[...query.keys()].some(k=>k!=='supplierId'))return reply(400)
  if(request.signal.aborted)return reply(503)
  try{await options.read(request,supplier)}catch(error){return reply(isOperationDenied(error)?error.reasonCode==='UNVERIFIED_IDENTITY'?401:error.reasonCode==='RESOURCE_SCOPE_MISMATCH'||error.reasonCode==='PERMISSION_DENIED'?403:503:503)}
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(60000)])
  for(let attempt=0;attempt<12;attempt++){
   if(signal.aborted)return reply(503)
   try{
    const response=await(options.transport??fetch)(targets.mapsRuntimeOrigin+'/api/health',{method:'GET',cache:'no-store',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(5000)])})
    if(response.ok&&response.headers.get('content-type')?.includes('application/json')){
     const value=await readPresentationJson(response,4096) as Record<string,unknown>
     if(value?.service==='maps-runtime'&&value.environment==='development'&&value.configured===true&&value.mode==='read-only'&&value.persistence===false)return reply(200,true)
    }else await response.body?.cancel()
   }catch{if(signal.aborted)return reply(503)}
   if(attempt<11)try{await(options.pause??pause)(signal)}catch{return reply(503)}
  }
  return reply(503)
 }
}
