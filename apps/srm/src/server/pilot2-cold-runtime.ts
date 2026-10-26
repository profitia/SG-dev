import pg from 'pg'
import {createHash} from 'node:crypto'
import {OPERATION_CONTRACT,OperationDenied,type OperationExecutor} from '@profitia/platform-contracts/operation-context'
import {currentReportAdmission,reportAdmissionEvidence} from '@profitia/platform-contracts/report-admission'
import {createSrmNativeSupplierRuntime} from './supplier-native-runtime'
import {createSrmReportOperationHost,type PrivateConfiguration} from './private-runtime'
import {createSrmPrivateOperationHost} from './private-operation-host'
import {createOperationReportDataHandler} from './operation-report-data'
import {createOperationFinancialExcelHandler} from './financial-excel-runtime'
import {createPilot2PrivateRoutes} from './pilot2-private-runtime'
import {createKrsNipCompany} from './krs-nip-runtime'
import {createKrsNameHttpHandler,createKrsNameHttpRuntime} from './krs-name-runtime'
import {withCurrentPrivateAuthority,createSrmReportAdmissionRuntime} from './report-admission-runtime'
import {getPilot2Registry} from './pilot2-registry'
import {classifyPilot2PublicCard,type Pilot2PublicCardRow} from './pilot2-public-catalog'
import {createPilot2HumanRuntime,getPilot2HumanOptions,pilot2HumanConnection,type Pilot2HumanOptions} from './pilot2-human-runtime'
import {pilot2PrivateReportProjection} from './pilot2-report-projection'
import {toPublicSection} from './xray-lookup'
import type {MgbiFinancialResult} from './mgbi-financial'
import type {KrsFinancialRecheck} from './krs-native-financial'
import {measureSupplierStage} from './supplier-telemetry'
import {validateReportSelection,type ReportSelection} from './report-data'
import targets from '../../deployment/pilot2-human-targets.json'
import native from '../../deployment/supplier-native-targets.json'

type Env=Readonly<Record<string,string|undefined>>
const deny=():never=>{throw new OperationDenied('ACCESS_BASIS_INVALID')}
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
/** Operations-owned, Development-only composition setting. No browser input
 * selects a provider. Missing configuration preserves the accepted KRS LKG. */
export function readPilot2RegistryProvider(env:Env):'KRS'|'MGBI'{
 const provider=env.SRM_PILOT2_REGISTRY_PROVIDER??'KRS'
 if(provider!=='KRS'&&provider!=='MGBI')return deny()
 return provider
}
export const PILOT2_NATIVE_GENERAL_SQL=`SELECT snapshot.pilot2_registry_envelope AS general_json
 FROM srm.suppliers supplier JOIN srm.source_snapshots snapshot
 ON snapshot.organization_id=supplier.organization_id AND snapshot.supplier_id=supplier.id
 JOIN srm.provider_attempts attempt ON attempt.organization_id=snapshot.organization_id AND attempt.id=snapshot.attempt_id
 WHERE supplier.organization_id=$1::uuid AND supplier.nip=$2 AND snapshot.section='general'
 AND attempt.provider='KRS' AND attempt.status='SUCCESS' AND attempt.error_code IS NULL
 ORDER BY snapshot.retrieved_at DESC,snapshot.id DESC LIMIT 1`

/** A cache read of an actual organisation's accepted General, under the same
 * Root as its private report. Raw archives from the Staging clone are absent.
 * Fresh public Financial keeps its provider's original observation time. */
export function createPilot2NativeCache(options:Pilot2HumanOptions){
 const {human,work}=options
 return async(request:Request,nip:string):Promise<Response>=>{
  const proof=reportAdmissionEvidence(currentReportAdmission())
  if(!proof||proof.nip!==nip||proof.organisationId!==options.config.application.organisationId)return deny()
  let published:Response|undefined,version:string|null=null
  const host=createSrmPrivateOperationHost({...human,requestLedger:undefined,
   application:{...human.application,operations:['supplier.report.read','supplier.report.project']},reportAdmission:work.reportAdmission,
   readResources:async({actor,scope,request:bound,query})=>{
    if(actor.kind!=='HUMAN'||scope.userId!==actor.actorId||scope.organisationId!==proof.organisationId
     ||bound.resourceId!=='supplier-report:COMPANY:'+nip||bound.operation!=='supplier.report.project')return deny()
    version=(await query('SELECT financial_sha256 FROM srm.catalog_companies WHERE nip=$1',[nip])).rows[0]?.financial_sha256 as string??null
    if(version!==null&&!/^[a-f0-9]{64}$/.test(version))return deny()
    return {resource:{id:bound.resourceId,type:'supplier_projection',dataClass:'ORGANISATION_PRIVATE',environment:'development',
     ownerOrganisationId:proof.organisationId,ownerUserId:null,version:'srm-private-report-collection-v1',projectionVersion:'srm-report-dto-v1'},
     inputs:[{id:'stored-financial-view:COMPANY:'+nip,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',
      ownerOrganisationId:null,ownerUserId:null,version:version??'no-stored-financial-evidence-v1',projectionVersion:'srm-stored-corporate-financial-v1',approvedSharedProjection:true}]}
   },projectOutput:(value)=>{if(value!==published)return deny();return published!}})
  const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:'supplier.report.project',organisationId:proof.organisationId,resourceId:'supplier-report:COMPANY:'+nip,
   payload:{nip,entityType:'COMPANY'},request},async(context,client)=>{
    await client.query("SELECT set_config('srm.organization_id',$1,true)",[context.organisationId])
    const general=(await client.query<Pick<Pilot2PublicCardRow,'general_json'>>(PILOT2_NATIVE_GENERAL_SQL,[proof.organisationId,nip])).rows[0]?.general_json
    const financial=(await client.query<{financial_json:Pilot2PublicCardRow['financial_json'];financial_checked_at:Date|null;financial_sha256:string|null}>(
     'SELECT financial_json,financial_checked_at,financial_sha256 FROM srm.catalog_companies WHERE nip=$1',[nip])).rows[0]
    if((financial?.financial_sha256??null)!==version)return deny()
    const selected=general?classifyPilot2PublicCard({general_json:general,general_checked_at:general.retrievedAt,
     financial_json:financial?.financial_json??null,financial_checked_at:financial?.financial_checked_at??null},nip):null
    const card=selected?.card
    published=card?Response.json({entityType:'COMPANY',card:{identity:card.identity,general:toPublicSection(card.general),
     financial:toPublicSection(card.financial),kys:toPublicSection(card.kys)}},{headers}):new Response(null,{status:204,headers})
    return published
   })
  if(!(result.value instanceof Response))return deny();return result.value
 }
}

export function readPilot2ColdConfiguration(env:Env){
 if(env.SRM_PILOT2_COLD_ACQUISITION!=='true'||env.SRM_PILOT2_PRIVATE_SCANNER!=='true')return deny()
 const source=pilot2HumanConnection(env.PILOT2_E1_SOURCE_URL,'srm_pilot2_source')
 const corporate=pilot2HumanConnection(env.PILOT2_E1_CORPORATE_URL,'srm_pilot2_corporate')
 const mgbiKey=env.MGBI_API_KEY?.trim(),ceidgKey=(env.CEIDG_API_KEY??env.API_KEY_CEDG)?.trim(),verclyKey=env.VERCLY_API_KEY?.trim()
 let origin:URL;try{origin=new URL(env.VERCLY_API_BASE_URL??'')}catch{return deny()}
 if(!mgbiKey||!ceidgKey||!verclyKey||origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password||origin.port
  ||env.MGBI_AUTH_SCHEME!==undefined&&!['raw','bearer'].includes(env.MGBI_AUTH_SCHEME)
  ||!/^[a-f0-9]{64}$/.test(targets.coldAcquisition.registryEnvelopeBoundaryDigest))return deny()
 return {source,corporate,mgbiKey,ceidgKey,verclyKey,verclyOrigin:origin.origin,mgbiScheme:env.MGBI_AUTH_SCHEME==='bearer'?'bearer' as const:'raw' as const}
}

/** Composition only: the original native Request/Work/Financial/MSR engines,
 * their common Source transport and Root project/export are reused unchanged.
 * No network is performed in the form's admission or an open HUMAN SQL txn. */
function createRuntime(env:Env){
 const c=readPilot2ColdConfiguration(env),options=getPilot2HumanOptions(env),{human,work}=options,registryProvider=readPilot2RegistryProvider(env)
 const base:PrivateConfiguration={...options.config,application:{...options.config.application,
  operations:['supplier.report.read','supplier.report.project','supplier.report.export']}}
 const pair=(config:pg.PoolConfig)=>{
  const pool=new pg.Pool(config),audit=new pg.Pool({...config,max:1})
  for(const p of[pool,audit])p.on('error',()=>console.error('PILOT2 native Source unavailable'))
  return {pool,audit}
 }
 const source=pair(c.source),corporate=pair(c.corporate)
 const api=createSrmNativeSupplierRuntime({base,configurationVersion:native.configurationVersion,
  jobsUrl:env.PILOT2_E1_JOBS_URL!,providerSourceUrl:env.PILOT2_E1_SOURCE_URL!,corporateSourceUrl:env.PILOT2_E1_CORPORATE_URL!,
  runtimeRoles:{jobs:'srm_pilot2_jobs',providerSource:'srm_pilot2_source',corporateSource:'srm_pilot2_corporate'},
  registryEnvelopeBoundaryDigest:targets.coldAcquisition.registryEnvelopeBoundaryDigest,
  ...c,referenceSecret:env.SRM_DEMO_SESSION_SECRET!},
 {pool:human.pool,auditPool:human.auditPool,clerk:human.clerk,jobsPool:work.pool,jobsAudit:work.auditPool,
  sourcePool:source.pool,sourceAudit:source.audit,corporatePool:corporate.pool,corporateAudit:corporate.audit})
 const {requestLedger:_requestLedger,commandBoundaryDigest:_commandBoundaryDigest,...readOptions}=human
 const ordinary=createSrmReportOperationHost({...readOptions,application:base.application})
 const admitted=createSrmReportOperationHost({...readOptions,application:{...base.application,operations:['supplier.report.read','supplier.report.project']},reportAdmission:work.reportAdmission})
 const executor:OperationExecutor<pg.PoolClient>={contract:ordinary.contract,execute:(input,action)=>
  (currentReportAdmission()&&['supplier.report.read','supplier.report.project'].includes(input.operation)?admitted:ordinary).execute(input,action)}
 const report=createOperationReportDataHandler(executor,env,{defaultOrganisationId:base.application.organisationId!})
 const expected=(request:Request)=>{
  const proof=reportAdmissionEvidence(currentReportAdmission())
  if(!proof||proof.organisationId!==base.application.organisationId)return deny()
  request.signal.throwIfAborted();return proof
 }
 const input=(request:Request,nip:string)=>{
  const proof=expected(request);if(nip!==proof.nip)return deny()
  return {request,organisationId:proof.organisationId,command:{kind:'SUPPLIER_REPORT' as const,nip},idempotencyKey:request.headers.get('idempotency-key')??deny()}
 }
 const nip=createKrsNipCompany({primary:registryProvider,api:{...api,jdg:(...args)=>withCurrentPrivateAuthority(()=>api.jdg(...args))},
  observe:event=>console.info('SRM registry telemetry',event),resolve:async request=>{
   const proof=expected(request.request);if(request.command.nip!==proof.nip)return deny()
   const result=await (await getPilot2Registry(env)).resolve(proof.nip,request.request.signal)
   if(result.status==='FALLBACK')return result
   const {identity,general}=result.selection
   return {status:'PRIMARY',selection:{krs:identity.selectedKrs,nip:proof.nip,name:identity.identity.officialName,
    locality:null,selectionRef:identity.evidenceRef},general}
  }})
 const accepted=async(request:Request,ref:string)=>{
  const proof=expected(request),v=await (await getPilot2Registry(env)).accepted(ref,proof.nip,request.signal)
  return {snapshot:v.snapshot,identity:v.selection.identity,selection:v.selection}
 }
 const pending=new WeakMap<Request,Awaited<ReturnType<typeof api.prepareKrsFinancial>>>()
 const name=createKrsNameHttpRuntime({registry:{search:async()=>deny(),verify:async()=>deny(),
  readSelection:accepted,history:async(request,identity)=>({history:(await accepted(request,identity.evidenceRef)).selection.history,warnings:[]})},
  financial:{async acquire(request,identity,key,general){
   if(pending.has(request)||key!==input(request,identity.identity.nip).idempotencyKey)return deny()
   const recheck:KrsFinancialRecheck=async()=>{const current=await accepted(request,identity.evidenceRef)
    if(current.identity.identity.nip!==identity.identity.nip||current.identity.source.rawDigest!==identity.source.rawDigest)return deny()}
   const prepared=await api.prepareKrsFinancial(input(request,identity.identity.nip),identity,recheck,general)
   pending.set(request,prepared);return {...prepared.result,...(prepared.pending?{workPending:true as const}:{})}
  },async publishEligible(request,identity,result:MgbiFinancialResult){
   const prepared=pending.get(request);if(!prepared)return deny()
   try{await prepared.publish(result)
    const response=await report(new Request(new URL('/api/xray/report-data',request.url),{method:'POST',headers:request.headers,
     body:JSON.stringify({nip:identity.identity.nip,entityType:'COMPANY'}),signal:request.signal}))
    if(!response.ok)return deny();return response.json()
   }finally{pending.delete(request)}
  }}},async()=>false)
 const cached=createPilot2NativeCache(options)
 const cacheMiss={async search(request:Request,nipValue:string){
  // The native MGBI flow owns its original seven-day MGBI cache. A stored KRS
  // General must not silently satisfy an explicitly selected MGBI operation.
  if(registryProvider==='MGBI')return nip.search(input(request,nipValue))
  const found=await measureSupplierStage('CACHE_READ',()=>cached(request,nipValue))
  return found.status===204?nip.search(input(request,nipValue)):found
 },report:(request:Request,selection:ReportSelection)=>report(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(selection),signal:request.signal}))}
 const runtime=createPilot2HumanRuntime({...options,registryProvider,privateProjection:pilot2PrivateReportProjection(env.SRM_DEMO_SESSION_SECRET!),cacheMiss})
 const nameHandler=createKrsNameHttpHandler('lookup',()=>({...name,runReport:async(request,action)=>{
  // The single existing admission instance binds the continuation HTTP request.
  // Its report method is not used to enter the continuation recursively.
  return reportAdmission.run(request,action)
 }}))
 // Reuse the same admission reader; creation has no effects or online reads.
 const reportAdmission=createSrmReportAdmissionRuntimeForContinuation(options,api)
 return Object.freeze({...runtime,
  private:createPilot2PrivateRoutes(api,base.application.organisationId!,()=>env.SRM_PILOT2_PRIVATE_ROUTES==='true'),
  report:(request:Request,input:unknown)=>{
   const selection=validateReportSelection(input)
   // JDG remains a separately current HUMAN purpose. A public company form
   // admission never becomes authority to read a sole trader's private data.
   return selection.entityType==='JDG'?withCurrentPrivateAuthority(()=>report(new Request(request.url,{method:'POST',headers:request.headers,
    body:JSON.stringify(selection),signal:request.signal}))):runtime.report(request,selection)
  },lookup:nameHandler,
  excel:createOperationFinancialExcelHandler(ordinary,base.application.organisationId!)})
}

function createSrmReportAdmissionRuntimeForContinuation(options:Pilot2HumanOptions,api:ReturnType<typeof createSrmNativeSupplierRuntime>){
 return createSrmReportAdmissionRuntime({config:options.config,pool:options.human.pool,api})
}
let runtime:ReturnType<typeof createRuntime>|undefined,key:string|undefined
export function getPilot2ColdRuntime(env:Env=process.env){
 const options=getPilot2HumanOptions(env),c=readPilot2ColdConfiguration(env)
 const next=createHash('sha256').update(JSON.stringify([c,options.config.application.deploymentId,env.SRM_DEMO_SESSION_SECRET,readPilot2RegistryProvider(env)])).digest('hex')
 if(key&&key!==next)return deny();key=next
 return runtime??=createRuntime(env)
}
