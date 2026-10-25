import type pg from 'pg'
import {createReportAdmissionStore,currentReportAdmission,withoutReportAdmission} from '@profitia/platform-contracts/report-admission'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {validRequestIdempotencyKey} from '@profitia/platform-contracts/request-ledger'
import {readPresentationJson} from '@profitia/platform-contracts/embedded-read-channel'
import type {Application} from '@profitia/platform-contracts/operation-context'
import type {AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import type {DelegatedJobTargetOptions} from '@profitia/platform-contracts/delegated-job'
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import {isSameOriginRequest} from './request-origin'
import {readSupplierRequest,type SupplierRequestCommand} from './supplier-request-operation'
import {withSupplierTelemetry,measureSupplierWork} from './supplier-telemetry'
import targets from '../../deployment/krs-name-pilot-targets.json'
import {createDelegatedNativeWorkHost} from '@profitia/platform-contracts/private-operation-host'
import {createClerkAccountStatusReader} from '@profitia/platform-contracts/identity-provider'
import {OPERATION_CONTRACT,operationPayloadDigest} from '@profitia/platform-contracts/operation-context'
import {createSrmNativePgDriver} from './native-pg-driver'

/** Only the accepted preparation host's dependencies. Read/publication users
 * need not import the complete private acquisition engine to prepare a form. */
export type ReportPreparationOptions=Readonly<{
 application:Application;binding:AccessStoreBinding&{service:NonNullable<AccessStoreBinding['service']>}
 pool:pg.Pool;auditPool:pg.Pool;clerk:Pick<ClerkIdentityClient,'users'>
 accountIdentity:Readonly<{environment:Application['environment'];issuer:string}>
 job:DelegatedJobTargetOptions&{schemaDigest:string};workSchemaDigest:string
 reportAdmission?:Readonly<{schemaDigest:string}>;privateAcquisition?:unknown
}>

const allowed=new Set(['/api/xray/search','/api/xray/lookup','/api/xray/krs/lookup','/api/xray/report-data'])
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization, X-SRM-Report-Admission'}
const deny=():never=>{throw new OperationDenied('ACCESS_BASIS_INVALID')}
/** Technical admission only: no supplier/lookup business row, Source delivery,
 * GUS/KRS request or paid acquisition is created while the user is typing. */
export async function prepareSrmReportAdmission(options:ReportPreparationOptions,selection:Readonly<{organisationId:string;requestId:string;command:SupplierRequestCommand}>){
 if(!options.reportAdmission||options.privateAcquisition||options.job.targetOperation!=='supplier.report.refresh')return deny()
 const store=createReportAdmissionStore({binding:options.binding,...options.reportAdmission})
 const host=createDelegatedNativeWorkHost<pg.PoolClient>({application:options.application,binding:options.binding,job:options.job,
  reportAdmission:options.reportAdmission,privateWork:{schemaDigest:options.workSchemaDigest},revalidateExternalAccountBeforeOutcome:true,
  readExternalAccount:createClerkAccountStatusReader({client:options.clerk,...options.accountIdentity}),
  ...createSrmNativePgDriver(options.pool,options.auditPool)})
 let grant:Awaited<ReturnType<typeof store.issue>>|undefined
 await measureSupplierWork('FORM_REPORT_ADMISSION',()=>host.runSqlWork({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',
  organisationId:selection.organisationId,resourceId:selection.requestId,payload:selection.command,request:null},
 {unitId:'FORM_REPORT_ADMISSION',accessMode:'WRITE',inputDigest:operationPayloadDigest({nip:selection.command.nip})},async(context,client)=>{
  if(context.delegation?.target.operation!=='supplier.report.refresh'||context.payloadDigest!==operationPayloadDigest(selection.command)
   ||context.organisationId!==selection.organisationId||context.requestWork?.unitId!=='FORM_REPORT_ADMISSION')return deny()
  grant=await store.issue(client.query.bind(client),{requestId:selection.requestId,nip:selection.command.nip})
 }))
 if(!grant)return deny();return grant
}
export function reportAdmissionConfiguration(){
 const v=(targets as unknown as {formReportAdmission?:{schemaDigest:string}}).formReportAdmission
 return v&&/^[a-f0-9]{64}$/.test(v.schemaDigest)?Object.freeze({schemaDigest:v.schemaDigest}):undefined
}
/** One request-scoped, opaque capability. No process-wide Actor/ALLOW cache.
 * The durable admission was minted by the ordinary job role inside the real
 * admission Work, after the current HUMAN Root and before its audited commit. */
export function createSrmReportAdmissionRuntime(options:{config:Readonly<{binding:AccessStoreBinding;application:Application}>;pool:pg.Pool;
 api:Readonly<{prepareReport(input:Readonly<{request:Request;organisationId:string;command:SupplierRequestCommand;idempotencyKey:string}>):ReturnType<typeof prepareSrmReportAdmission>}>}){
 const configuration=reportAdmissionConfiguration();if(!configuration)return deny()
 const store=createReportAdmissionStore({binding:options.config.binding,...configuration})
 const query=async(sql:string,values?:readonly unknown[])=>{
  const client=await options.pool.connect()
  try{return await client.query(sql,values as unknown[])}finally{client.release()}
 }
 return Object.freeze({
  async prepare(request:Request):Promise<Response>{
   if(request.method!=='POST'||!isSameOriginRequest(request)||new URL(request.url).search
     ||request.headers.has('X-SRM-Report-Admission')||request.headers.get('content-type')?.split(';')[0]!=='application/json')return deny()
   const key=request.headers.get('idempotency-key');if(!validRequestIdempotencyKey(key))return deny()
   if(!request.body)return deny()
   let body;try{body=await readPresentationJson(new Response(request.body.pipeThrough(new TransformStream(),
    {signal:AbortSignal.any([request.signal,AbortSignal.timeout(3000)])}),{headers:{'content-type':'application/json'}}),256)}catch{return deny()}
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='nip')return deny()
   const command=readSupplierRequest({kind:'SUPPLIER_REPORT',nip:body.nip})
   const grant=await options.api.prepareReport({request,organisationId:options.config.application.organisationId!,command,idempotencyKey:key!})
   return Response.json(grant,{headers})
  },
  async run<T>(request:Request,action:()=>Promise<T>):Promise<T>{
   const token=request.headers.get('X-SRM-Report-Admission')
   if(!token)return action()
   if(currentReportAdmission()||request.method!=='POST'||!isSameOriginRequest(request)||!allowed.has(new URL(request.url).pathname))return deny()
   const proof=await store.load(query,token)
   // Commit the bounded start before a host holds its Work transaction. The
   // independent canonical dispatch INTENT must never wait on that same row.
   await store.start(query,proof)
   return store.run(proof,request,action)
  },
 })
}
export type SrmReportAdmissionRuntime=ReturnType<typeof createSrmReportAdmissionRuntime>
/** Private JDG/KYS retains its separate current authority. It cannot inherit a
 * public company report's captured human authority. */
export const withCurrentPrivateAuthority=withoutReportAdmission
export const reportAdmissionTelemetry=(action:()=>Promise<Response>)=>withSupplierTelemetry('form_admission',action)
