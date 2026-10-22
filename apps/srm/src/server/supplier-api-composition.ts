import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import {createHash} from 'node:crypto'
import type {PoolClient} from 'pg'
import {OPERATION_CONTRACT,OperationDenied} from '@profitia/platform-contracts/operation-context'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {createSrmSupplierRequestOperationHost} from './supplier-request-host'
import {createSrmNativeCompanyLookup} from './supplier-native-company'
import {createSrmNativeSensitiveLookup} from './supplier-native-sensitive'
import {createSrmCompanyCardRead,createSrmKnownCompanyRead,type CompanyReadOptions} from './supplier-company-read'
import {createSrmSensitiveOperationHost,readPrivateSupplier,revealPrivateSupplier,exportPrivateKys,preparePrivateKrs,completePrivateKrs,privateSupplierReportId,privateSupplierExportId,type PrivateKrsAuthorization} from './supplier-sensitive-operation'
import {persistSupplierRequest,readSupplierRequest,supplierRequestResourceId,privateSupplierRequestResourceId,type SupplierPrivateTarget,type SupplierRequestCommand} from './supplier-request-operation'
import type {SupplierNativeWorkSelection,SupplierNativeWorkOptions} from './supplier-request-work'
import {createSrmNativeWebLookup} from './supplier-native-web'
import {createSrmWebOperationHost,privateWebResourceId,readPrivateWeb,type WebReadOptions} from './supplier-web-operation'
import {validateKysPdfSelection} from './kys-pdf'
import {createSrmKrsSourceTransport,guardOriginalProviderCall} from './provider-source-transport'
import {downloadVerclyKrsPdf} from './vercly-krs'
import {operationPayloadDigest} from '@profitia/platform-contracts/operation-context'

type RequestOptions=Parameters<typeof createSrmSupplierRequestOperationHost>[0]
type CompanyOptions=Parameters<typeof createSrmNativeCompanyLookup>[0]
type SensitiveOptions=Parameters<typeof createSrmNativeSensitiveLookup>[0]
type PrivateReadOptions=Parameters<typeof createSrmSensitiveOperationHost>[0]
type PrivateFlow=Readonly<{request:RequestOptions;lookup:SensitiveOptions}>
export type SupplierApiOptions=Readonly<{
 company:Readonly<{request:RequestOptions;lookup:CompanyOptions;read:CompanyReadOptions}>
 companyKys:PrivateFlow;jdgKys:PrivateFlow;jdgRegistry:PrivateFlow;privateRead:PrivateReadOptions
 web?:Readonly<{company:Readonly<{request:RequestOptions;lookup:Parameters<typeof createSrmNativeWebLookup>[0]}>;jdg:Readonly<{request:RequestOptions;lookup:Parameters<typeof createSrmNativeWebLookup>[0]}>;read:WebReadOptions}>
 krs?:Readonly<{source:Omit<Parameters<typeof createSrmKrsSourceTransport>[0],'reference'|'operationKey'|'nip'|'headers'>;apiKey:string}>
}>
export type SupplierHttpInput=Readonly<{request:Request;organisationId:string;command:SupplierRequestCommand;idempotencyKey:string}>
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
const publication=(value:unknown):Response=>{if(!(value instanceof Response))throw new OperationDenied('POLICY_UNAVAILABLE');return value}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
/** A stable child key binds a logical browser request to each fixed purpose.
 * Retry reuses the canonical Root intent; it never starts a second ledger. */
export function supplierChildIdempotencyKey(key:string,purpose:string){
 return 'srm-http-'+createHash('sha256').update(JSON.stringify(['srm-native-http-v1',key,purpose])).digest('hex')
}
function requestFlow(request:RequestOptions,work:SupplierNativeWorkOptions,target?:SupplierPrivateTarget){
 const expected=target?'supplier.private.refresh':'supplier.report.refresh'
 if(request.application.operations.length!==1||request.application.operations[0]!==expected||work.job.targetOperation!==expected
  ||request.application.environment!==work.application.environment
  ||['projectId','branchId','databaseName'].some(k=>request.binding[k as keyof typeof request.binding]!==work.binding[k as keyof typeof work.binding])
  ||target&&(!request.privateAcquisition||!work.privateAcquisition
    ||request.privateAcquisition.entityType!==target.entityType||request.privateAcquisition.section!==target.section
    ||['entityType','section','boundaryDigest','webBoundaryDigest'].some(k=>request.privateAcquisition![k as keyof NonNullable<typeof request.privateAcquisition>]!==work.privateAcquisition![k as keyof NonNullable<typeof work.privateAcquisition>]))
  ||!target&&(request.privateAcquisition!==undefined||work.privateAcquisition!==undefined))return refuse()
 const human=createSrmSupplierRequestOperationHost(request),jobs=createDelegatedJobStore({binding:request.binding,...work.job})
 return async(input:SupplierHttpInput,purpose:string):Promise<SupplierNativeWorkSelection>=>{
  const command=readSupplierRequest(input.command),resourceId=target?privateSupplierRequestResourceId(command,target):supplierRequestResourceId(command)
  const result=await human.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:expected,organisationId:input.organisationId,resourceId,payload:command,
   idempotencyKey:supplierChildIdempotencyKey(input.idempotencyKey,purpose),request:input.request},async(context,client)=>{
    const receipt=await persistSupplierRequest(context,client)
    const dispatch=await jobs.createDispatch(client.query.bind(client),context)
    if(dispatch.requestId!==receipt.requestId)return refuse()
    return receipt
   })
  const published=publication(result.value)
  if(published.status!==202)return refuse()
  const accepted=await published.json()
  if(!accepted||Object.keys(accepted).sort().join(',')!=='requestId,status'||accepted.status!=='ACCEPTED'||!uuid.test(accepted.requestId))return refuse()
  return Object.freeze({requestId:accepted.requestId,organisationId:input.organisationId,command})
 }
}

/** Application orchestration over the original engines and actual native
 * hosts. Neither an incoming actor nor a caller-provided work callback exists.
 * Each asynchronous acquisition is followed by a fresh HUMAN read. */
export function createSrmSupplierApi(options:SupplierApiOptions){
 const company=createSrmNativeCompanyLookup(options.company.lookup)
 const known=createSrmKnownCompanyRead(options.company.read)
 const admitCompany=requestFlow(options.company.request,options.company.lookup.work)
 const privateRead=createSrmSensitiveOperationHost(options.privateRead),secret=options.privateRead.secret
 const krsPrepare=createSrmSensitiveOperationHost({...options.privateRead,exportMode:'KRS_PREPARE'})
 const krsFinal=createSrmSensitiveOperationHost({...options.privateRead,exportMode:'KRS_PDF'})
 const krs=options.krs
 if(krs&&(!krs.apiKey?.trim()||krs.source.external.maximumResponseBytes!==24*1024*1024))return refuse()
 const capture=(flow:PrivateFlow,entityType:'COMPANY'|'JDG',section:'jdg'|'kys')=>{
  if(flow.lookup.entityType!==entityType||flow.lookup.section!==section)return refuse()
  return {native:createSrmNativeSensitiveLookup(flow.lookup),
   admit:requestFlow(flow.request,flow.lookup.work,{entityType,section})}
 }
 const companyKys=capture(options.companyKys,'COMPANY','kys'),jdgKys=capture(options.jdgKys,'JDG','kys'),jdgRegistry=capture(options.jdgRegistry,'JDG','jdg')
 const web=options.web?{company:{native:createSrmNativeWebLookup(options.web.company.lookup),admit:requestFlow(options.web.company.request,options.web.company.lookup.work,{entityType:'COMPANY',section:'web'})},
  jdg:{native:createSrmNativeWebLookup(options.web.jdg.lookup),admit:requestFlow(options.web.jdg.request,options.web.jdg.lookup.work,{entityType:'JDG',section:'web'})},read:createSrmWebOperationHost(options.web.read)}:undefined
 const read=async(input:Pick<SupplierHttpInput,'request'|'organisationId'>,nip:string,entityType:'COMPANY'|'JDG',section:'jdg'|'kys')=>{
  const payload={nip,entityType,section}
  return publication((await privateRead.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:'supplier.private.read',organisationId:input.organisationId,resourceId:privateSupplierReportId(payload),payload,request:input.request},
   (context,client)=>readPrivateSupplier(context,client,secret))).value)
 }
 const sensitive=async(input:SupplierHttpInput,flow:typeof companyKys,entityType:'COMPANY'|'JDG',section:'jdg'|'kys')=>{
  const selection=await flow.admit(input,entityType+':'+section)
  input.request.signal.throwIfAborted()
  const outcome=await flow.native.run(selection,input.request.signal)
  input.request.signal.throwIfAborted()
  // A suppressed/deregistered report has no snapshot and must not accidentally
  // reveal an older one. A current native read still gates a real snapshot.
  if(!outcome.snapshotId){
   // No private snapshot/body is disclosed. Revalidate the same accepted
   // logical intent before returning only its neutral workflow status.
   await flow.admit(input,entityType+':'+section)
   if(!['EMPTY','PENDING','ERROR','NOT_REQUESTED'].includes(outcome.status))throw new OperationDenied('POLICY_UNAVAILABLE')
   return Response.json({section:{status:outcome.status,retrievedAt:null,effectiveAt:null,data:null,warnings:[]},privateReport:null},
    {status:outcome.status==='PENDING'?202:200,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})
  }
  return read(input,input.command.nip,entityType,section)
 }
 return Object.freeze({
  readAcceptedKys:(request:Request,organisationId:string,nip:string)=>read({request,organisationId},nip,'COMPANY','kys'),
  known:(input:Pick<SupplierHttpInput,'request'|'organisationId'>,nip:string)=>known.read(input.request,input.organisationId,nip),
  async prepareKrsFinancial(input:SupplierHttpInput,identity:VerifiedIdentityV1,recheck:()=>Promise<void>){
   if(input.command.nip!==identity.identity.nip)return refuse()
   await recheck()
   const selected=await admitCompany(input,'COMPANY:KRS-FINANCIAL:'+identity.selectedKrs+':'+identity.evidenceRef)
   input.request.signal.throwIfAborted()
   return company.prepareFinancial(selected,identity,recheck)
  },
  async company(input:SupplierHttpInput){
   const selected=await admitCompany(input,'COMPANY:report')
   input.request.signal.throwIfAborted()
   const card=await company.run(selected)
   input.request.signal.throwIfAborted()
   return createSrmCompanyCardRead(options.company.read,card).read(input.request,input.organisationId)
  },
  jdg:(input:SupplierHttpInput)=>sensitive(input,jdgRegistry,'JDG','jdg'),
  kys:(input:SupplierHttpInput,entityType:'COMPANY'|'JDG')=>sensitive(input,entityType==='COMPANY'?companyKys:jdgKys,entityType,'kys'),
  async web(input:SupplierHttpInput,entityType:'COMPANY'|'JDG'){
   if(!web||!['COMPANY','JDG'].includes(entityType))throw new OperationDenied('POLICY_UNAVAILABLE')
   const flow=entityType==='COMPANY'?web.company:web.jdg,purpose=entityType+':web'
   const selected=await flow.admit(input,purpose),status=await flow.native.run(selected,input.request.signal)
   input.request.signal.throwIfAborted()
   if(status!=='AVAILABLE'){
    await flow.admit(input,purpose)
    return Response.json({status,websiteUrl:null,logoDataUrl:null,evidenceUrl:null,logoSourceUrl:null,method:null,checkedAt:null},{status:status==='PENDING'?202:404,headers:{'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}})
   }
   const payload={nip:input.command.nip,entityType}
   return publication((await web.read.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
    operation:'supplier.private.read',organisationId:input.organisationId,resourceId:privateWebResourceId(payload.nip,entityType),payload,request:input.request},readPrivateWeb)).value)
  },
  async reveal(input:Pick<SupplierHttpInput,'request'|'organisationId'>,token:string){
   return publication((await privateRead.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
    operation:'supplier.private.reveal',organisationId:input.organisationId,resourceId:'supplier-private-identifier',payload:{token},request:input.request},
    (context,client)=>revealPrivateSupplier(context,client,secret))).value)
  },
  async pdf(input:Pick<SupplierHttpInput,'request'|'organisationId'>,value:unknown){
   const payload=validateKysPdfSelection(value)
   return publication((await privateRead.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
    operation:'supplier.private.export',organisationId:input.organisationId,resourceId:privateSupplierExportId(payload.nip,payload.entityType),payload,request:input.request},
    (context,client)=>exportPrivateKys(context,client,secret))).value)
  },
  async krs(input:Pick<SupplierHttpInput,'request'|'organisationId'>,value:unknown){
   if(!krs)throw new OperationDenied('POLICY_UNAVAILABLE')
   const payload=validateKysPdfSelection(value)
   if(payload.entityType!=='COMPANY')return refuse()
   const operation={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
    operation:'supplier.private.export' as const,organisationId:input.organisationId,
    resourceId:privateSupplierExportId(payload.nip,payload.entityType),payload,request:input.request}
   const admitted=await krsPrepare.execute(operation,(context,client)=>preparePrivateKrs(context,client,secret))
   const raw:unknown=admitted.value
   if(raw instanceof Response)return raw
   if(!raw||typeof raw!=='object'||Object.getPrototypeOf(raw)!==Object.prototype||!('kind'in raw)||raw.kind!=='KRS_AUTHORIZATION')return refuse()
   const prepared=raw as PrivateKrsAuthorization
   const operationKey=operationPayloadDigest({version:'srm-native-krs-download-v1',decisionId:prepared.decisionId,snapshotId:prepared.snapshotId})
   const source=createSrmKrsSourceTransport({...krs.source,nip:payload.nip,reference:prepared.reference,operationKey,
    headers:{authorization:'Bearer '+krs.apiKey,accept:'application/pdf'}})
   input.request.signal.throwIfAborted()
   const downloaded=await guardOriginalProviderCall(source.fetcher,fetcher=>downloadVerclyKrsPdf(prepared.reference,payload.nip,
    {apiKey:krs.apiKey,baseUrl:krs.source.providerOrigin,fetcher,signal:input.request.signal}))
   const bytes=new Uint8Array(await downloaded.arrayBuffer())
   input.request.signal.throwIfAborted()
   return publication((await krsFinal.execute(operation,(context,client)=>completePrivateKrs(context,client,secret,prepared,bytes))).value)
  },
 })
}
export type SrmSupplierApi=ReturnType<typeof createSrmSupplierApi>
