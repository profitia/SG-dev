import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel'
import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {getSrmReportRuntime,type SrmReportRuntime} from './private-runtime'
import {readCompanySourcePolicy} from './company-source-policy'
import {readSupplierRequest} from './supplier-request-operation'
import {isSameOriginRequest} from './request-origin'
import {withSupplierTelemetry} from './supplier-telemetry'
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const unavailable=(status:number)=>Response.json({error:'Dane dostawcy są obecnie niedostępne.'},{status,headers})
export function createCachedSupplierIdentityHttpHandler(getRuntime:()=>SrmReportRuntime|Promise<SrmReportRuntime>=getSrmReportRuntime,env:Readonly<Record<string,string|undefined>>=process.env){
 return async(request:Request):Promise<Response>=>withSupplierTelemetry('cached_supplier_identity',async()=>{
  if(request.method!=='POST')return unavailable(405)
  if(new URL(request.url).search)return unavailable(400)
  if(!isSameOriginRequest(request))return unavailable(403)
  try{
   if(env.TARGET_ENVIRONMENT!==undefined&&env.TARGET_ENVIRONMENT!=='development'||readCompanySourcePolicy(env)!=='MGBI_ONLY')return unavailable(503)
   if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!request.body)return unavailable(400)
   const stream=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>(),{signal:AbortSignal.any([request.signal,AbortSignal.timeout(3000)])})
   let body:unknown
   try{body=await readPresentationJson(new Response(stream,{headers:{'content-type':'application/json'}}),2048)}catch{return unavailable(400)}
   if(!body||Object.getPrototypeOf(body)!==Object.prototype||Object.keys(body).join(',')!=='nip')return unavailable(400)
   let nip:string
   try{nip=readSupplierRequest({kind:'SUPPLIER_REPORT',nip:(body as {nip:unknown}).nip}).nip}catch{return unavailable(400)}
   const runtime=await getRuntime()
   if(runtime.provider!=='clerk'||!runtime.supplierApi)return unavailable(503)
   // Keep the original signed receiver request: its peer evidence is not a header.
   return await runtime.supplierApi.cachedIdentity({request,organisationId:runtime.defaultOrganisationId},nip)
  }catch(error){
   const reason=isOperationDenied(error)?error.reasonCode:'POLICY_UNAVAILABLE'
   return unavailable(reason==='UNVERIFIED_IDENTITY'?401:['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE','LIMIT_POLICY_UNAVAILABLE','DELIVERY_UNCERTAIN'].includes(reason)?503:403)
  }
 })
}
