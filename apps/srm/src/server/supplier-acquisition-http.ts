import {isOperationDenied} from '@profitia/platform-contracts/operation-context'
import {validRequestIdempotencyKey} from '@profitia/platform-contracts/request-ledger'
import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel'
import {readSupplierRequest} from './supplier-request-operation'
import {validateXrayRequest} from './xray-lookup'
import {searchRegistryByNip} from './registry-search'
import {isSameOriginRequest} from './request-origin'
import type {SrmSupplierApi,SupplierHttpInput} from './supplier-api-composition'
import type {SrmReportRuntime} from './private-runtime'
import {getSrmReportRuntime} from './private-runtime'
import {KysPdfError} from './kys-pdf-access'
import {validateKysPdfSelection} from './kys-pdf'
type Route='search'|'company'|'jdg'|'company-kys'|'jdg-kys'|'reveal'|'pdf'|'krs'
const privateHeaders={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const response=(status:number,error='Operation unavailable')=>Response.json({error},{status,headers:privateHeaders})
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
function closed(value:unknown,keys:string[]):value is Record<string,unknown>{
 return !!value&&Object.getPrototypeOf(value)===Object.prototype
  &&Object.keys(value).sort().join(',')===[...keys].sort().join(',')
}
export function supplierHttpFailure(error:unknown){
 if(error instanceof KysPdfError&&[404,409,410,502,503].includes(error.status))return response(error.status,error.message)
 const reason=isOperationDenied(error)?error.reasonCode:'POLICY_UNAVAILABLE'
 return response(reason==='UNVERIFIED_IDENTITY'?401:['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE','LIMIT_POLICY_UNAVAILABLE','DELIVERY_UNCERTAIN'].includes(reason)?503
  :reason==='CONTEXT_INVALID'?400:reason==='IDEMPOTENCY_CONFLICT'?409:reason==='LIMIT_EXCEEDED'?429:403)
}

/** The existing business URLs use this same bounded dispatcher in real tests.
 * Query/body never choose an identity, provider, role, transport or work host. */
export function createSrmSupplierOperationHandler(route:Route,api:SrmSupplierApi,defaultOrganisationId:string){
 if(!uuid.test(defaultOrganisationId)||!['search','company','jdg','company-kys','jdg-kys','reveal','pdf','krs'].includes(route))throw TypeError('Explicit supplier HTTP route required')
 return async(request:Request):Promise<Response>=>{
  if(request.method!=='POST'){const r=response(405);r.headers.set('Allow','POST');return r}
  if(!isSameOriginRequest(request))return response(403)
  const query=new URL(request.url).searchParams
  if([...query.keys()].some(k=>k!=='organisationId')||query.getAll('organisationId').length>1)return response(400)
  const organisationId=query.get('organisationId')??defaultOrganisationId
  if(!uuid.test(organisationId)||request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return response(400)
  let body:unknown
  try{
   if(!request.body||request.signal.aborted)return response(400)
   const stream=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>(),{signal:AbortSignal.any([request.signal,AbortSignal.timeout(3000)])})
   body=await readPresentationJson(new Response(stream,{headers:{'content-type':'application/json'}}),2048)
  }catch{return response(400)}
  try{
   const scope={request,organisationId}
   if(route==='reveal'){
    if(!closed(body,['token'])||typeof body.token!=='string'||body.token.length>1000)return response(400)
    return await api.reveal(scope,body.token)
   }
   if(route==='pdf'||route==='krs'){
    if(!closed(body,['nip','entityType','retrievedAt','exportRef']))return response(400)
    if(route==='krs'&&body.entityType!=='COMPANY')return response(400)
    try{const selected=validateKysPdfSelection(body);readSupplierRequest({kind:'SUPPLIER_REPORT',nip:selected.nip})}catch{return response(400)}
    return route==='pdf'?await api.pdf(scope,body):await api.krs(scope,body)
   }
   const idempotencyKey=request.headers.get('idempotency-key')
   if(!validRequestIdempotencyKey(idempotencyKey)||!closed(body,['identifier']))return response(400)
   let command
   try{command=readSupplierRequest({kind:'SUPPLIER_REPORT',nip:validateXrayRequest(body).identifier.value})}catch{return response(400)}
   const input:SupplierHttpInput={...scope,command,idempotencyKey}
   if(route==='company')return await api.company(input)
   if(route==='jdg'){
    const r=await api.jdg(input)
    if(!r.ok)return r
    return Response.json({nip:command.nip,...await r.json()},{status:r.status,headers:r.headers})
   }
   if(route==='company-kys'||route==='jdg-kys')return await api.kys(input,route==='company-kys'?'COMPANY':'JDG')
   // The routing algorithm reads only status/data/nip. Its native ports here
   // provide already authorized public DTOs, without reintroducing provenance
   // or unmasked personal data to satisfy a legacy TypeScript interface.
   let problem:Response|undefined
   const value=async(r:Response)=>{if(!r.ok){problem=r;throw Error('Supplier API refused')}return r.json()}
   const result=await searchRegistryByNip(organisationId,{identifier:{type:'NIP',value:command.nip}},{
    catalog:async(org,nip)=>{if(org!==organisationId||nip!==command.nip)throw Error('Wrong routing scope');return api.known(scope,nip)},
    jdg:async(org,nip)=>{if(org!==organisationId||nip!==command.nip)throw Error('Wrong routing scope');return (await value(await api.jdg(input))).section},
    company:async(org,selected)=>{if(org!==organisationId||selected.identifier.value!==command.nip)throw Error('Wrong routing scope');return value(await api.company(input))},
   }).catch(error=>{if(problem)return {entityType:'HTTP_FAILURE' as const,response:problem};throw error})
   if(result.entityType==='HTTP_FAILURE')return result.response
   if(result.entityType==='JDG')return Response.json({entityType:'JDG',nip:command.nip,section:result.section},{headers:privateHeaders})
   if(result.entityType==='COMPANY')return Response.json({entityType:'COMPANY',card:result.card},{headers:privateHeaders})
   return response(result.entityType==='NOT_FOUND'?404:503,result.entityType==='NOT_FOUND'?'Nie znaleziono podmiotu o podanym numerze NIP.':result.unavailableProvider==='CEIDG'?'Baza CEIDG chwilowo niedostępna. Spróbuj później.':'Nie udało się ustalić typu podmiotu. Spróbuj ponownie później.')
  }catch(error){return supplierHttpFailure(error)}
 }
}
/** Explicit Clerk failure never invokes legacy. Default deployed legacy
 * remains the original complete handler until controlled activation. */
export function createRuntimeSupplierOperationHandler(route:Route,legacy:(request:Request)=>Promise<Response>,resolve:()=>SrmReportRuntime=getSrmReportRuntime){
 return async(request:Request):Promise<Response>=>{
  try{
   const runtime=resolve()
   if(runtime.provider==='legacy_demo')return await legacy(request)
   if(runtime.provider!=='clerk')return response(503)
   if(!runtime.supplierApi)return response(503)
   return await createSrmSupplierOperationHandler(route,runtime.supplierApi,runtime.defaultOrganisationId)(request)
  }catch{return response(503)}
 }
}
