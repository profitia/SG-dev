import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest,type Json} from '@profitia/platform-contracts/operation-context'
import type {SrmSupplierApi,SupplierHttpInput} from './supplier-api-composition'
import type {PrivateConfiguration,SrmReportRuntime} from './private-runtime'
import {createKrsNipCompany} from './krs-nip-runtime'
import {createKrsNameHttpRuntime} from './krs-name-runtime'
import {getPilot2Registry} from './pilot2-registry'
import {createOperationReportDataHandler} from './operation-report-data'
import {createSrmPrivateOperationHost} from './private-operation-host'
import type {SupplierReportData} from '@profitia/srm-xray'
import type {KrsFinancialRecheck} from './krs-native-financial'
import target from '../../deployment/development-pilot2-targets.json'

type Env=Readonly<Record<string,string|undefined>>
const deny=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
export function developmentPilot2Enabled(env:Env){
 const flag=env.SRM_DEVELOPMENT_PILOT2_LOOKUP??'false'
 if(flag==='false')return false
 if(flag!=='true'||env.TARGET_ENVIRONMENT!=='development'||env.RENDER_SERVICE_ID!==target.serviceId
  ||!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT??''))return deny()
 return true
}
type Registry=Pick<Awaited<ReturnType<typeof getPilot2Registry>>,'resolve'|'identify'|'accepted'>
type MainRuntime=Extract<SrmReportRuntime,{provider:'clerk'}>
type RegistryValue=Awaited<ReturnType<Registry['accepted']>>|Pick<Awaited<ReturnType<Registry['accepted']>>,'selection'>
type ProjectionOptions=Pick<Parameters<typeof createSrmPrivateOperationHost>[0],
 'pool'|'auditPool'|'clerk'|'identity'|'application'|'binding'|'module'>

/** The settled public Source result gets its own current HUMAN read and
 * physical OUTCOME. The preliminary known-company boolean is not a licence
 * to publish a subsequently acquired body. No network acquisition is in SQL. */
export function createDevelopmentKrsProjection(options:ProjectionOptions){
 const {pool,auditPool,clerk,identity,application,binding,module}=options
 return async<T extends RegistryValue>(request:Request,nip:string,input:T):Promise<T>=>{
  const value=structuredClone(input),s=value.selection,i=s.identity,g=s.general
  if(i.status!=='VERIFIED'||i.identity.nip!==nip||g.source.provider!=='KRS'||g.data?.nip!==nip
   ||g.data.krs!==i.selectedKrs||g.source.recordId!==i.evidenceRef)return deny()
  const version=operationPayloadDigest(value as unknown as Json),resourceId='supplier-report:COMPANY:'+nip
  const host=createSrmPrivateOperationHost({pool,auditPool,clerk,identity,binding,module,
   application:{...application,operations:['supplier.report.read']},
   readResources:async({actor,scope,request:bound})=>{
    if(actor.kind!=='HUMAN'||scope.userId!==actor.actorId||scope.organisationId!==application.organisationId
     ||bound.operation!=='supplier.report.read'||bound.resourceId!==resourceId)return deny()
    return {resource:{id:resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',
     ownerOrganisationId:null,ownerUserId:null,version,projectionVersion:'srm-main-krs-selection-v1',approvedSharedProjection:true}}
   },projectOutput:(result,context)=>{
    if(result!==value||context.resource.version!==version||operationPayloadDigest(result as Json)!==version)return deny()
    return result
   }})
  const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:'supplier.report.read',organisationId:application.organisationId!,resourceId,payload:{nip,entityType:'COMPANY'},request},async()=>value)
  return result.value as T
 }
}

/** The main application keeps its existing current HUMAN entry and native
 * Request/Work/Source/report writer. Only registry and Financial orchestration
 * are selected from PILOT2; private routes, page and Maps are untouched. */
export function composeDevelopmentPilot2(options:{api:SrmSupplierApi;organisationId:string;
 registry:()=>Promise<Registry>;project:<T extends RegistryValue>(request:Request,nip:string,value:T)=>Promise<T>;
 readReport:(request:Request,nip:string)=>Promise<Response>}){
 const {api,organisationId}=options
 const current=async(request:Request,nip:string)=>{await api.known({request,organisationId},nip);request.signal.throwIfAborted()}
 const input=(request:Request,nip:string,key:string):SupplierHttpInput=>({request,organisationId,command:{kind:'SUPPLIER_REPORT',nip},idempotencyKey:key})
 const accepted=async(request:Request,reference:string)=>{
  const registry=await options.registry(),nip=await registry.identify(reference)
  await current(request,nip)
  const value=await options.project(request,nip,await registry.accepted(reference,nip,request.signal))
  return {...value,identity:value.selection.identity}
 }
 const pending=new WeakMap<Request,Awaited<ReturnType<SrmSupplierApi['prepareKrsFinancial']>>>()
 const name=createKrsNameHttpRuntime({registry:{search:async()=>deny(),verify:async()=>deny(),
  readSelection:accepted,history:async(request,identity)=>({history:(await accepted(request,identity.evidenceRef)).selection.history,warnings:[]})},
  financial:{async acquire(request,identity,key,general){
   if(pending.has(request))return deny()
   const recheck:KrsFinancialRecheck=async()=>{
    const current=await accepted(request,identity.evidenceRef)
    if(current.identity.identity.nip!==identity.identity.nip||current.identity.source.rawDigest!==identity.source.rawDigest)return deny()
   }
   const prepared=await api.prepareKrsFinancial(input(request,identity.identity.nip,key),identity,recheck,general,'COMPLETE_IN_REQUEST')
   pending.set(request,prepared)
   return {...prepared.result,...(prepared.pending?{workPending:true as const}:{})}
  },async publishEligible(request,identity,result){
   const prepared=pending.get(request);if(!prepared)return deny()
   try{
    await prepared.publish(result)
    const response=await options.readReport(request,identity.identity.nip)
    if(!response.ok)return deny()
    return await response.json() as SupplierReportData
   }finally{pending.delete(request)}
  }}},async()=>false)
 const nip=createKrsNipCompany({api,observe:event=>console.info('SRM registry telemetry',event),resolve:async selection=>{
  if(selection.organisationId!==organisationId)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  await current(selection.request,selection.command.nip)
  const result=await (await options.registry()).resolve(selection.command.nip,selection.request.signal)
  if(result.status==='FALLBACK')return result
  const {identity,general}=(await options.project(selection.request,selection.command.nip,{selection:result.selection})).selection
  return {status:'PRIMARY',selection:{krs:identity.selectedKrs,nip:identity.identity.nip,name:identity.identity.officialName,
   locality:null,selectionRef:identity.evidenceRef},general}
 }})
 return Object.freeze({...name,nip})
}

export function createDevelopmentPilot2Runtime(config:PrivateConfiguration,runtime:MainRuntime,env:Env,pools:Pick<ProjectionOptions,'pool'|'auditPool'|'clerk'>){
 if(!developmentPilot2Enabled(env)||!runtime.supplierApi||config.application.organisationId!==runtime.defaultOrganisationId)return deny()
 const report=createOperationReportDataHandler(runtime.executor,env,{defaultOrganisationId:runtime.defaultOrganisationId})
 return composeDevelopmentPilot2({api:runtime.supplierApi,organisationId:runtime.defaultOrganisationId,
  project:createDevelopmentKrsProjection({...config,...pools}),
  registry:()=>getPilot2Registry(env),readReport:(request,nip)=>report(new Request(new URL('/api/xray/report-data',request.url),{
   method:'POST',headers:request.headers,body:JSON.stringify({nip,entityType:'COMPANY'}),signal:request.signal}))})
}
