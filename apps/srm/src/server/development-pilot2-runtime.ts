import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import type {SrmSupplierApi,SupplierHttpInput} from './supplier-api-composition'
import type {PrivateConfiguration,SrmReportRuntime} from './private-runtime'
import {createKrsNipCompany} from './krs-nip-runtime'
import {createKrsNameHttpRuntime} from './krs-name-runtime'
import {getPilot2Registry} from './pilot2-registry'
import {createOperationReportDataHandler} from './operation-report-data'
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

/** The main application keeps its existing current HUMAN entry and native
 * Request/Work/Source/report writer. Only registry and Financial orchestration
 * are selected from PILOT2; private routes, page and Maps are untouched. */
export function composeDevelopmentPilot2(options:{api:SrmSupplierApi;organisationId:string;
 registry:()=>Promise<Registry>;readReport:(request:Request,nip:string)=>Promise<Response>}){
 const {api,organisationId}=options
 const current=async(request:Request,nip:string)=>{await api.known({request,organisationId},nip);request.signal.throwIfAborted()}
 const input=(request:Request,nip:string,key:string):SupplierHttpInput=>({request,organisationId,command:{kind:'SUPPLIER_REPORT',nip},idempotencyKey:key})
 const accepted=async(request:Request,reference:string)=>{
  const registry=await options.registry(),nip=await registry.identify(reference)
  await current(request,nip)
  const value=await registry.accepted(reference,nip,request.signal)
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
  await current(selection.request,selection.command.nip)
  const result=await (await options.registry()).resolve(selection.command.nip,selection.request.signal)
  if(result.status==='FALLBACK')return result
  const {identity,general}=result.selection
  return {status:'PRIMARY',selection:{krs:identity.selectedKrs,nip:identity.identity.nip,name:identity.identity.officialName,
   locality:null,selectionRef:identity.evidenceRef},general}
 }})
 return Object.freeze({...name,nip})
}

export function createDevelopmentPilot2Runtime(config:PrivateConfiguration,runtime:MainRuntime,env:Env){
 if(!developmentPilot2Enabled(env)||!runtime.supplierApi||config.application.organisationId!==runtime.defaultOrganisationId)return deny()
 const report=createOperationReportDataHandler(runtime.executor,env,{defaultOrganisationId:runtime.defaultOrganisationId})
 return composeDevelopmentPilot2({api:runtime.supplierApi,organisationId:runtime.defaultOrganisationId,
  registry:()=>getPilot2Registry(env),readReport:(request,nip)=>report(new Request(new URL('/api/xray/report-data',request.url),{
   method:'POST',headers:request.headers,body:JSON.stringify({nip,entityType:'COMPANY'}),signal:request.signal}))})
}
