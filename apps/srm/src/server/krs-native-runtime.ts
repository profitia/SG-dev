import {createKrsNipCompany} from './krs-nip-runtime'
import {refreshCatalogSelection} from './krs-name-search'
import {krsContinuity} from './krs-continuity'
import type {RegistryHistory} from './company-continuity'
import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import {krsGeneral} from './krs-general'
import {createPlatformIngestionHost} from '@profitia/platform-contracts/platform-ingestion'
import type pg from 'pg'
import type {PrivateConfiguration,SrmReportRuntime} from './private-runtime'
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import {createClerkIdentityAuthenticator} from '@profitia/platform-contracts/identity-provider'
import {bindPublicIdentityAuthenticator} from '@profitia/platform-contracts/public-request'
import {createSrmNativePgDriver} from './native-pg-driver'
import {createKrsNameHttpRuntime} from './krs-name-runtime'
import type {MgbiFinancialResult} from './mgbi-financial'
import {createOperationReportDataHandler} from './operation-report-data'
import type {SupplierReportData} from '@profitia/srm-xray'
import pilot from '../../deployment/krs-live-pilot.json'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {randomUUID,createHash} from 'node:crypto'
import {measureSupplierStage} from './supplier-telemetry'
const deny=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
type Env=Readonly<Record<string,string|undefined>>
/** Immutable deployment target selection, never a request-selected profile. */
export function srmKrsPilotTarget(env:Env){
 if(env.RENDER_SERVICE_ID!==pilot.render.serviceId)return null
 if(!pilot.render.serviceId||env.TARGET_ENVIRONMENT!=='development'
  ||pilot.state!=='ACCEPTED_RUNTIME_BINDINGS'||pilot.ownerApprovalRef!=='USER-20261022-KRS-ISOLATED-PILOT')return deny()
 return pilot
}
export function krsPilotDatabaseUrl(value:string|undefined,role:'krs_reader'|'krs_ingest'){
 if(!value||value!==value.trim())return deny()
 let url:URL;try{url=new URL(value);decodeURIComponent(url.password)}catch{return deny()}
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.hostname!=='ep-dry-hat-bafvyimb.c-8.eu-central-1.aws.neon.tech'
  ||url.username!==role||!url.password||url.pathname!=='/krs_registry_pilot'||url.hash||url.port&&url.port!=='5432'
  ||[...url.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))
  ||url.searchParams.getAll('sslmode').length!==1||url.searchParams.get('sslmode')!=='require'
  ||url.searchParams.getAll('channel_binding').length>1||url.searchParams.has('channel_binding')&&url.searchParams.get('channel_binding')!=='require')return deny()
 return url.href
}
type Pools={pool:pg.Pool;auditPool:pg.Pool;catalog:pg.Pool;source:pg.Pool;sourceAudit:pg.Pool;clerk:ClerkIdentityClient}
/** All adapters are built here from real native pools and the existing Clerk
 * client. No JSON authority, injected HTTP ports or alternative Financial client. */
export async function createSrmKrsNativeRuntime(config:PrivateConfiguration,pools:Pools,
 runtime:Extract<SrmReportRuntime,{provider:'clerk'}>,environment:Env){
 const target=srmKrsPilotTarget(environment)
 if(!target||!runtime.supplierApi||config.application.organisationId!==runtime.defaultOrganisationId)return deny()
 const [{createNativeRegistryAccess,createNativeRegistrySource},{Catalog}]=await Promise.all([
  import('@profitia/krs-registry-runtime/native'),import('@profitia/krs-registry-runtime/catalog')])
 const registry=createNativeRegistryAccess({catalog:new Catalog(pools.catalog),organisationId:runtime.defaultOrganisationId,
  host:{application:{...config.application,operations:['supplier.report.read']},binding:config.binding,module:config.module,
   ...createSrmNativePgDriver(pools.pool,pools.auditPool),createAuthenticator:({resolveBinding})=>{
    const authenticate=createClerkIdentityAuthenticator({client:pools.clerk,application:config.identity,resolveBinding})
    return config.identity.requestBoundary?bindPublicIdentityAuthenticator(authenticate,config.identity.requestBoundary):authenticate
   }}})
 const sourceVersion='krs-native-pilot-v1',deploymentId=config.application.deploymentId+':krs-registry-source'
 const seed=await createNativeRegistrySource({host:{...createSrmNativePgDriver(pools.source,pools.sourceAudit),
  application:{appId:'krs-registry-source',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId,
   configurationVersion:sourceVersion,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,
   features:['knowledge_ingestion'],operations:['knowledge.ingest' as const]},
  binding:{applicationId:'krs-registry-source',environment:'development',projectId:target.catalog.projectId,branchId:target.catalog.branchId,
   databaseName:target.catalog.databaseName,role:'krs_ingest',deploymentId,configurationVersion:sourceVersion,
   schemaDigest:'14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b',unmeteredSchemaDigest:target.unmeteredSource.schemaDigest}},
  externalSchemaDigest:'69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206',approvedKrs:['0000028860'],approvalRef:target.ownerApprovalRef})
 let historyFor:((request:Request,identity:VerifiedIdentityV1)=>Promise<RegistryHistory|undefined>)=async()=>undefined
 const pending=new WeakMap<Request,{reference:string;prepared:Awaited<ReturnType<NonNullable<typeof runtime.supplierApi>['prepareKrsFinancial']>>}>()
 let verifyCompany=async(request:Request,krs:string)=>{await registry.snapshot(request,krs);await seed.acquire(krs,'P',randomUUID());return registry.selected(request,krs)}
 const nameRuntime=createKrsNameHttpRuntime({registry:{
  search:async(request,query)=>(await registry.search(request,query)).candidates.map(c=>({krs:c.krs,name:c.officialName??'',nip:c.nip,locality:c.locality})),
  verify:(request,krs)=>verifyCompany(request,krs),
  readSelection:(request,reference)=>registry.accepted(request,reference),
  history:(request,identity)=>historyFor(request,identity),
 },financial:{
  acquire:async(request,identity,key,general)=>{
   if(pending.has(request))return deny()
   const recheck=async()=>{const current=await registry.accepted(request,identity.evidenceRef)
    if(current.identity.identity.nip!==identity.identity.nip||current.identity.source.rawDigest!==identity.source.rawDigest)return deny()}
   const prepared=await runtime.supplierApi!.prepareKrsFinancial({request,organisationId:runtime.defaultOrganisationId,
    command:{kind:'SUPPLIER_REPORT',nip:identity.identity.nip},idempotencyKey:key},identity,recheck,general??await krsGeneral((await registry.accepted(request,identity.evidenceRef)).snapshot,identity,Date.now()))
   pending.set(request,{reference:identity.evidenceRef,prepared});return {...prepared.result,...(prepared.pending?{workPending:true as const}:{})}
  },
  publishEligible:async(request,identity,result:MgbiFinancialResult)=>{
   const state=pending.get(request);if(!state||state.reference!==identity.evidenceRef)return deny()
   try{
    await registry.accepted(request,identity.evidenceRef);await state.prepared.publish(result)
    const reportRequest=new Request(new URL('/api/xray/report-data',request.url),{method:'POST',headers:request.headers,
     body:JSON.stringify({nip:identity.identity.nip,entityType:'COMPANY'}),signal:request.signal})
    const response=await createOperationReportDataHandler(runtime.executor,environment,{defaultOrganisationId:runtime.defaultOrganisationId})(reportRequest)
    if(!response.ok)return deny()
    return await response.json() as SupplierReportData
   }finally{pending.delete(request)}
  },
 }},async request=>{await registry.search(request,'__');return true})
 const disabledNip={async company():Promise<Response>{return deny()},async search():Promise<Response>{return deny()}}
 if(environment.SRM_KRS_NIP_ENABLED!=='true')return Object.freeze({...nameRuntime,nip:disabledNip})
 if(!/^[A-Za-z0-9]{20}$/.test(environment.GUS_BIR_API_KEY??''))return deny()
 const [{createAdmittedGusSource,createGusMapper,GusError,GUS_ORIGIN,GUS_PATH},{createNipResolver},{createNativeNipRegistrySource}]=await Promise.all([
  import('@profitia/krs-registry-runtime/gus'),import('@profitia/krs-registry-runtime/nip-resolver'),import('@profitia/krs-registry-runtime/native')])
 const sourceHostOptions={...createSrmNativePgDriver(pools.source,pools.sourceAudit),
  application:{appId:'krs-registry-source',profileId:'PLATFORM_INTERNAL' as const,environment:'development' as const,deploymentId,
   configurationVersion:sourceVersion,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,
   features:['knowledge_ingestion'],operations:['knowledge.ingest' as const]},
  binding:{applicationId:'krs-registry-source',environment:'development' as const,projectId:target.catalog.projectId,branchId:target.catalog.branchId,
   databaseName:target.catalog.databaseName,role:'krs_ingest',deploymentId,configurationVersion:sourceVersion,
   schemaDigest:'14d46ec280e624d79930833b022a46866864557cecbf2e3b55b1a1143fb9d66b',unmeteredSchemaDigest:target.unmeteredSource.schemaDigest}}
 let sid:string|null=null
 const gusHost=createPlatformIngestionHost({...sourceHostOptions,
  source:{id:'krs.registry.gus',payloadSchema:'external-call-control-v1',qualityVersion:'gus-bir12-source-v1',classificationVersion:'technical-source-control-v1'},
  validateSharedPayload:value=>!!value&&typeof value==='object'&&!Array.isArray(value)
   &&Object.keys(value).sort().join(',')==='action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status'})
 async function permit(signal:AbortSignal){
  for(;;){
   signal.throwIfAborted()
   const row=(await pools.source.query<{wait_ms:number}>('SELECT profitia_external_native.reserve_gus_slot() AS wait_ms')).rows[0]
   if(!row||!Number.isInteger(row.wait_ms)||row.wait_ms<0||row.wait_ms>3600001)return deny()
   if(row.wait_ms===0)return
   await new Promise<void>((resolve,reject)=>{const timer=setTimeout(done,row.wait_ms);function done(){signal.removeEventListener('abort',abort);resolve()}function abort(){clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason)}signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()})
  }
 }
 const gusSource=await createAdmittedGusSource<pg.PoolClient>({sourceHost:gusHost,sourceId:'krs.registry.gus',resourceId:'krs-gus:nip-map',apiKey:environment.GUS_BIR_API_KEY!,readSid:()=>sid,permit,
  binding:{role:'krs_ingest',configurationVersion:sourceVersion,schemaDigest:'69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206',origin:GUS_ORIGIN,transport:'HTTPS',pathRules:[{method:'POST',path:GUS_PATH}]},
  independentQuery:sourceHostOptions.independentQuery,query:async(tx,sql,args)=>({rows:(await tx.query(sql,args)).rows})})
 const mapper=createGusMapper({source:gusSource,readSid:()=>sid,writeSid:value=>{sid=value}})
 const official=await createNativeNipRegistrySource({host:sourceHostOptions,externalSchemaDigest:'69db4ec3787937b24922f7acfc267e5aae400ddc44e0799eff09fa7e6d87e206'})
 historyFor=async(request,identity)=>{
  await registry.accepted(request,identity.evidenceRef)
  const evidence=await measureSupplierStage('KRS_CONTINUITY',()=>official.continuity(identity.evidenceRef,request.signal))
  await registry.accepted(request,identity.evidenceRef)
  return evidence?krsContinuity(evidence,identity,Date.now()):undefined
 }
 const observe=(event:unknown)=>console.info('SRM registry telemetry',event)
 const resolver=createNipResolver({gus:(n,key,signal)=>measureSupplierStage('GUS_RESOLUTION',()=>mapper.resolve(n,key,signal)),
  krs:async(mapping,key,signal)=>{
   const at=Date.now()
   try{return await measureSupplierStage('KRS_CURRENT',()=>official.acquire(mapping,key,signal))}catch(error){
    // Classified provider responses qualify; E1/identity/budget refusals do not.
    const code=(error as {code?:string})?.code
    if(code&&/^KRS_HTTP_(404|429|5[0-9]{2})$/.test(code))throw new GusError(code)
    throw error
   }finally{observe({event:'KRS_CURRENT',durationMs:Date.now()-at})}
  },telemetry:observe,timeoutMs:3000})
 // Newly discovered catalog companies remain selectable by name. Refresh only
 // after explicit selection, through the same GUS/KRS identity proof and deadline.
 const verifySeed=verifyCompany
 verifyCompany=async(request,krs)=>{
  if(krs==='0000028860')return verifySeed(request,krs)
  return refreshCatalogSelection(request,krs,{
   snapshot:(request,krs)=>registry.snapshot(request,krs),
   resolve:(nip,request)=>resolver.resolve(nip,createHash('sha256').update(randomUUID()).digest('hex'),request.signal),
   selected:(request,krs)=>registry.selected(request,krs),
  })
 }
 const nip=createKrsNipCompany({api:runtime.supplierApi,observe,resolve:async input=>{
  if(input.organisationId!==runtime.defaultOrganisationId)return deny()
  await registry.search(input.request,'__')
  const key=createHash('sha256').update('srm-nip-primary-v1:'+input.idempotencyKey+':'+input.command.nip).digest('hex')
  const result=await resolver.resolve(input.command.nip,key,input.request.signal)
  if(result.status==='FALLBACK')return result
  const accepted=await registry.selected(input.request,result.value.snapshot.canonicalKrs)
  if(accepted.identity.identity.nip!==input.command.nip)return deny()
  const general=await krsGeneral(accepted.snapshot,accepted.identity,Date.now())
  return {status:'PRIMARY',selection:{krs:accepted.identity.selectedKrs,nip:input.command.nip,name:accepted.identity.identity.officialName,
   locality:accepted.snapshot.address?.city??null,selectionRef:accepted.identity.evidenceRef},general}
 }})
 return Object.freeze({...nameRuntime,nip})
}
