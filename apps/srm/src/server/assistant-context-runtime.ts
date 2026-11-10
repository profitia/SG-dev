import {OPERATION_CONTRACT,isOperationDenied,type OperationExecutor} from '@profitia/platform-contracts/operation-context'
import {projectSupplierAssistantSummary,readSupplierAssistantSelection,type AssistantKysRead} from '@profitia/srm-xray/assistant-summary'
import type {PoolClient} from 'pg'
import {readSharedFinancialReport} from './shared-financial-read'
import {validateReportSelection} from './report-data'
import {getSrmReportRuntime} from './private-runtime'
import type {SrmSupplierApi} from './supplier-api-composition'

export const SRM_ASSISTANT_READ_VERSION='srm-assistant-context-peer-development-v1'
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const respond=(status:number)=>Response.json({error:'Operation unavailable'},{status,headers})
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
type Options={executor:OperationExecutor<PoolClient>;defaultOrganisationId:string;api?:Pick<SrmSupplierApi,'readAcceptedKys'>}
export function createSrmAssistantContextHandler(options:Options,env:Readonly<Record<string,string|undefined>>={}){
 return async(request:Request):Promise<Response>=>{
  if(request.method!=='GET'){const r=respond(405);r.headers.set('Allow','GET');return r}
  if(request.headers.has('cookie')||request.headers.has('origin')||!/^Bearer [^\s]{1,8192}$/.test(request.headers.get('authorization')??''))return respond(401)
  try{
   const params=new URL(request.url).searchParams,keys=['nip','entityType','krs','year','comparisonYear','statementScope','organisationId']
   if([...params.keys()].some(k=>!keys.includes(k))||[...new Set(params.keys())].some(k=>params.getAll(k).length!==1))return respond(400)
   const nullableYear=(key:string)=>params.has(key)?Number(params.get(key)):null
   const selection=readSupplierAssistantSelection({nip:params.get('nip'),entityType:params.get('entityType')??'COMPANY',krs:params.get('krs'),
    year:nullableYear('year'),comparisonYear:nullableYear('comparisonYear'),statementScope:params.get('statementScope')??'standalone'})
   const organisationId=params.get('organisationId')??options.defaultOrganisationId
   if(!uuid.test(organisationId))return respond(400)
   const native=validateReportSelection({nip:selection.nip,entityType:selection.entityType})
   let kys:AssistantKysRead={status:'UNAVAILABLE'}
   // The ordinary shared read must publish its original financial DTO through
   // its existing output fence. Private KYS keeps its own native read fence.
   const result=await options.executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
    operation:'supplier.report.read',organisationId,resourceId:'supplier-report:'+selection.entityType+':'+selection.nip,payload:native,request},
    async(context,client)=>{
   const financial=await readSharedFinancialReport(client,context.organisationId!,native,context.resource.version,new Date(),env)
   if(options.api){
    try{
     // Existing native current HUMAN supplier.private.read only. No lookup,
     // refresh, PDF, reveal or acquisition method is reachable here.
     const r=await options.api.readAcceptedKys(request,organisationId,selection.nip,selection.entityType)
     if(r.status!==200){await r.body?.cancel();kys={status:r.status===401||r.status===403?'DENIED':'UNAVAILABLE'}}
     else{
      const value=await r.json()
      if(value?.privateReport?.nip!==selection.nip||value.privateReport.entityType!==selection.entityType||!value.section
       ||value.section.data?.company?.nip!=null&&value.section.data.company.nip!==selection.nip)throw Error('Invalid private source identity')
      kys={status:value.section.data?value.section.status==='SUCCESS'?'OK':'PARTIAL':'EMPTY',section:value.section,retentionUntil:value.privateReport.retentionUntil}
     }
    }catch(error){if(request.signal.aborted)throw error;kys={status:isOperationDenied(error)&&!['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(error.reasonCode)?'DENIED':'UNAVAILABLE'}}
   }
   request.signal.throwIfAborted()
   // Recheck ordinary financial authority after the separately authorised KYS
   // read, without passing private data as a shared financial publication.
   return Response.json(financial,{headers})
    })
   if(!(result.value instanceof Response)||result.value.status!==200)throw Error('Unavailable financial publication')
   const financial=await result.value.json()
   request.signal.throwIfAborted()
   // Compose only the successfully fenced producer output. Never fall back
   // to the callback's unfenced financial value if its final check fails.
   return Response.json(projectSupplierAssistantSummary({selection,financial,kys}),{headers})
  }catch(error){
   const reason=isOperationDenied(error)?error.reasonCode:null
   return respond(reason==='UNVERIFIED_IDENTITY'?401:reason&&!['POLICY_UNAVAILABLE','AUDIT_UNAVAILABLE'].includes(reason)?403:error instanceof TypeError?400:503)
  }
 }
}
export function createRuntimeSrmAssistantContextHandler(){
 return async(request:Request)=>{
  if(process.env.PROFITIA_ASSISTANT_CONTEXT_PEER_READ_VERSION!==SRM_ASSISTANT_READ_VERSION)return respond(503)
  try{const runtime=getSrmReportRuntime();if(runtime.provider!=='clerk')return respond(503)
   return await createSrmAssistantContextHandler({executor:runtime.executor,defaultOrganisationId:runtime.defaultOrganisationId,api:runtime.supplierApi},process.env)(request)
  }catch{return respond(503)}
 }
}
