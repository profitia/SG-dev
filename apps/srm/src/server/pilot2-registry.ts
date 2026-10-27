import {instrumentDiagnosticPool} from './diagnostic-pg'
import {diagnosticRun} from './diagnostic-trace'
import pg from 'pg'
import {createHash,randomUUID} from 'node:crypto'
import {AsyncLocalStorage} from 'node:async_hooks'
import type {GeneralCompanyData,FinancialData,SectionEnvelope} from '@profitia/srm-xray'
import type {VerifiedIdentityV1} from '@profitia/krs-registry-contracts'
import {OperationDenied} from '@profitia/platform-contracts/operation-context'
import {createSrmNativePgDriver} from './native-pg-driver'
import {measureSupplierStage} from './supplier-telemetry'
import {krsGeneral} from './krs-general'
import {krsContinuity} from './krs-continuity'
import {reconcileKrsFinancial} from './krs-financial'
import type {MgbiFinancialResult} from './mgbi-financial'
import type {RegistryHistory} from './company-continuity'
import {readFreshCompany} from './shared-catalog'
import {FINANCIAL_QUALITY_RULE} from '@profitia/srm-xray'
import {FINANCIAL_REVISION_RULE} from './financial-revisions'
import {COMPANY_IDENTITY_VERSION} from './company-continuity'
import {runXrayLookup,type XrayLookupRequest} from './xray-lookup'
import {runJdgLookup} from './jdg-lookup'
import type {RegistrySearchResult} from './registry-search'
import target from '../../deployment/pilot2-registry-targets.json'
import development from '../../deployment/development-pilot2-targets.json'

type Env=Readonly<Record<string,string|undefined>>
export type Pilot2RegistrySelection=Readonly<{general:SectionEnvelope<GeneralCompanyData>;identity:VerifiedIdentityV1;history:RegistryHistory}>
const deny=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const selections=new AsyncLocalStorage<Pilot2RegistrySelection>()
const readyReport=new AsyncLocalStorage<boolean>(),skipCache=new AsyncLocalStorage<boolean>()
class FreshFinancialIdentityRequired extends Error{}
export const pilot2SkipCompanyCache=()=>skipCache.getStore()===true
/** Cached knowledge cannot acquire a new RDF response or licensed original.
 * This guard runs before a claim or provider call and changes no receipt. */
export function requirePilot2FinancialAcquisition(){
 if(readyReport.getStore()&&!selections.getStore())throw new FreshFinancialIdentityRequired('Fresh company evidence required')
}
export const withPilot2ReadyReport=<T>(action:()=>Promise<T>)=>readyReport.run(true,action)
const issuedSelections=new WeakMap<object,string>()
export const currentPilot2RegistrySelection=()=>selections.getStore()
/** Request-local company evidence, never a user actor or an ALLOW decision.
 * Only this process's settled Source result can enter the original engine. */
export function withPilot2RegistrySelection<T>(selection:Pilot2RegistrySelection,action:()=>Promise<T>):Promise<T>{
 if(selections.getStore()||issuedSelections.get(selection)!==JSON.stringify(selection))return deny()
 return selections.run(selection,action)
}
/** The same physical target is checked again at boot. No request may choose a
 * provider, database, role, organisation, registry identity or Source binding. */
export function pilot2RegistryConnection(value:string|undefined,role:'krs_reader'|'krs_ingest'|'srm_development_krs_source'|'srm_development_krs_reader'){
 if(!value||value!==value.trim())return deny()
 let u:URL;try{u=new URL(value);decodeURIComponent(u.password)}catch{return deny()}
 if(!['krs_reader','krs_ingest',development.registrySourceRole,development.registryReaderRole].includes(role)||!['postgres:','postgresql:'].includes(u.protocol)||u.hostname!==target.catalog.host||u.pathname!=='/'+target.catalog.databaseName
  ||u.username!==role||!u.password||u.hash||u.port&&u.port!=='5432'
  ||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))
  ||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='require'
  ||u.searchParams.getAll('channel_binding').length>1||u.searchParams.has('channel_binding')&&u.searchParams.get('channel_binding')!=='require')return deny()
 return {host:u.hostname,port:5432,database:decodeURIComponent(u.pathname.slice(1)),user:role,password:decodeURIComponent(u.password),
  ssl:{rejectUnauthorized:true},enableChannelBinding:true,max:3,connectionTimeoutMillis:3000,idleTimeoutMillis:10000,
  statement_timeout:15000,query_timeout:15000,lock_timeout:3000,application_name:'profitia-srm-pilot2-registry'}
}
/** Ready knowledge is not a fresh acquisition capability. Its existing seven
 * day freshness was checked by readFreshCompany; no identity expiry is renewed
 * and a stored report cannot authorize a new paid Financial request. */
export function readyPilot2RegistryReport(value:{general:SectionEnvelope<GeneralCompanyData>;financial:SectionEnvelope<FinancialData>}|null,nip:string){
 const g=value?.general,f=value?.financial,d=g?.data,h=d?.registryHistory,source=d?.registrySource
 if(!g||!f||g.source.provider!=='KRS'||d?.nip!==nip||!d.krs||source?.provider!=='KRS'
  ||source.evidenceRef!==g.source.recordId||!/^KRS:[0-9]{10}:[a-f0-9]{64}$/.test(source.evidenceRef)||source.evidenceRef.split(':')[1]!==d.krs
  ||!h||h.version!=='KRS_CONTINUITY_V1'||!Array.isArray(h.members)||!Array.isArray(h.unlinkedKrs)
  ||h.currentKrs!==d.krs||h.unlinkedKrs.length||h.members[0]?.krs!==d.krs
  ||!['SUCCESS','PARTIAL'].includes(g.status)||f.source.provider!=='MGBI'||!['SUCCESS','PARTIAL','EMPTY'].includes(f.status))return false
 if(f.data&&(f.data.revisionRule!==FINANCIAL_REVISION_RULE||f.data.qualityRule!==FINANCIAL_QUALITY_RULE
  ||f.data.registryHistoryVersion!==COMPANY_IDENTITY_VERSION))return false
 const allowed=new Set(h.members.map(m=>m.krs))
 return !f.data||Array.isArray(f.data.periods)&&f.data.periods.every(p=>!!p.sourceRegistration&&allowed.has(p.sourceRegistration.krs))
}
export const reconcilePilot2Financial=(selection:Pilot2RegistrySelection,result:MgbiFinancialResult)=>
 reconcileKrsFinancial(selection.identity,result,Date.now(),selection.history)

async function createRuntime(env:Env){
 const main=env.RENDER_SERVICE_ID===development.serviceId&&env.SRM_DEVELOPMENT_PILOT2_LOOKUP==='true'
 const sourceRole=main?'srm_development_krs_source' as const:'krs_ingest' as const
 const readerRole=main?'srm_development_krs_reader' as const:'krs_reader' as const
 const serviceId=main?development.serviceId:target.render.serviceId
 const transportProfile=target.runtime.transportProfile
 if(env.RENDER_SERVICE_ID!==serviceId||env.TARGET_ENVIRONMENT!=='development'
  ||transportProfile!=='EXTRACTS_ONLY'
  ||!env.RENDER_GIT_COMMIT||!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT)||!/^[A-Za-z0-9]{20}$/.test(env.GUS_BIR_API_KEY??''))return deny()
 // Construct the host through the same ESM package instance as its external
 // transport. A CJS/bundled host cannot carry the ESM module's private brand.
 const [{createPlatformIngestionHost},{resolveIdentity},{Catalog},{createNativeNipRegistrySource},
  {createAdmittedGusSource,createGusMapper,GusError,GUS_ORIGIN,GUS_PATH},{createNipResolver}]=await Promise.all([
  import('@profitia/platform-contracts/platform-ingestion'),import('@profitia/krs-registry-runtime/identity'),import('@profitia/krs-registry-runtime/catalog'),
  import('@profitia/krs-registry-runtime/native'),import('@profitia/krs-registry-runtime/gus'),import('@profitia/krs-registry-runtime/nip-resolver')])
 const reader=instrumentDiagnosticPool(new pg.Pool(pilot2RegistryConnection(env.KRS_PILOT2_READER_URL,readerRole)),'REGISTRY_READER')
 const sourceOptions=pilot2RegistryConnection(env.KRS_PILOT2_SOURCE_URL,sourceRole)
 const source=instrumentDiagnosticPool(new pg.Pool(sourceOptions),'REGISTRY_SOURCE'),audit=instrumentDiagnosticPool(new pg.Pool({...sourceOptions,max:1}),'INDEPENDENT_AUDIT'),catalog=new Catalog(reader)
 for(const pool of [reader,source,audit])pool.on('error',()=>console.error('PILOT2 registry database unavailable'))
 const host={...createSrmNativePgDriver(source,audit),
  application:{appId:'krs-registry-source',profileId:'PLATFORM_INTERNAL' as const,environment:'development' as const,
   deploymentId:serviceId+':'+env.RENDER_GIT_COMMIT+':krs-registry-source',configurationVersion:target.runtime.configurationVersion,
   identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['knowledge_ingestion'],operations:['knowledge.ingest' as const]},
  binding:{applicationId:'krs-registry-source',environment:'development' as const,projectId:target.catalog.projectId,branchId:target.catalog.branchId,
   databaseName:target.catalog.databaseName,role:sourceRole,deploymentId:serviceId+':'+env.RENDER_GIT_COMMIT+':krs-registry-source',
   configurationVersion:target.runtime.configurationVersion,schemaDigest:target.runtime.schemaDigests.ingestion,
   unmeteredSchemaDigest:target.runtime.unmeteredSchemaDigest}}
 const gusHost=createPlatformIngestionHost({...host,source:{id:'krs.registry.gus',payloadSchema:'external-call-control-v1',
  qualityVersion:'gus-bir12-source-v1',classificationVersion:'technical-source-control-v1'},validateSharedPayload:value=>!!value&&typeof value==='object'
   &&!Array.isArray(value)&&Object.keys(value).sort().join(',')==='action,callId,configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status'})
 let sid:string|null=null
 const permit=async(signal:AbortSignal)=>{
  for(;;){signal.throwIfAborted();const row=(await source.query<{wait_ms:number}>('SELECT profitia_external_native.reserve_gus_slot() AS wait_ms')).rows[0]
   if(!row||!Number.isInteger(row.wait_ms)||row.wait_ms<0||row.wait_ms>3600001)return deny()
   if(!row.wait_ms)return
   await new Promise<void>((resolve,reject)=>{const timer=setTimeout(done,row.wait_ms);function done(){signal.removeEventListener('abort',abort);resolve()}function abort(){clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason)}signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()})
  }
 }
 const gus=await createAdmittedGusSource<pg.PoolClient>({sourceHost:gusHost,sourceId:'krs.registry.gus',resourceId:'krs-gus:nip-map',
  apiKey:env.GUS_BIR_API_KEY!,readSid:()=>sid,permit,
  binding:{role:sourceRole,configurationVersion:target.runtime.configurationVersion,schemaDigest:target.runtime.schemaDigests.external,origin:GUS_ORIGIN,transport:'HTTPS',pathRules:[{method:'POST',path:GUS_PATH}]},
  independentQuery:host.independentQuery,query:async(tx,sql,args)=>({rows:(await tx.query(sql,args)).rows})})
 const mapper=createGusMapper({source:gus,readSid:()=>sid,writeSid:value=>{sid=value}})
 const official=await createNativeNipRegistrySource({host,externalSchemaDigest:target.runtime.schemaDigests.external,transportProfile})
 const resolver=createNipResolver({gus:(nip,key,signal)=>measureSupplierStage('GUS_RESOLUTION',()=>mapper.resolve(nip,key,signal)),
  krs:async(mapping,key,signal)=>{try{return await measureSupplierStage('KRS_CURRENT',()=>official.acquire(mapping,key,signal))}
   catch(error){const code=(error as {code?:string})?.code;if(code&&/^KRS_HTTP_(404|429|5[0-9]{2})$/.test(code))throw new GusError(code);throw error}},
  timeoutMs:target.providerRouting.primaryTimeoutMs,telemetry:event=>console.info('SRM registry telemetry',event)})
 async function selectedObserved(snapshot:Awaited<ReturnType<InstanceType<typeof Catalog>['read']>>,nip:string,signal:AbortSignal){
  if(!snapshot||snapshot.nip!==nip)return deny()
  const identity=await resolveIdentity({selectedKrs:snapshot.canonicalKrs},catalog,Date.now())
  if(identity.status!=='VERIFIED'||identity.identity.nip!==nip||identity.evidenceRef!==snapshot.evidenceRef)return deny()
  const continuity=await krsContinuity(await measureSupplierStage('KRS_CONTINUITY',()=>official.continuity(identity.evidenceRef,signal)),identity,Date.now())
  const history=continuity.history
  const base=await krsGeneral(snapshot,identity,Date.now());if(!base.data)return deny()
  const selection:Pilot2RegistrySelection={identity,history,general:{...base,data:{...base.data,registryHistory:history}}}
  issuedSelections.set(selection,JSON.stringify(selection))
  return {snapshot,selection}
 }
 const selected:typeof selectedObserved=(...args)=>diagnosticRun('KRS_SELECTED',()=>selectedObserved(...args))
 return Object.freeze({async identify(reference:string){
  if(!/^KRS:[0-9]{10}:[a-f0-9]{64}$/.test(reference))return deny()
  const snapshot=await catalog.read(reference.split(':')[1])
  if(!snapshot?.nip||snapshot.evidenceRef!==reference)return deny()
  return snapshot.nip
 },async resolve(nip:string,signal:AbortSignal){
  const key=createHash('sha256').update('srm-pilot2-nip:'+randomUUID()+':'+nip).digest('hex')
  const result=await resolver.resolve(nip,key,signal);if(result.status==='FALLBACK')return result
  const snapshot=await catalog.read(result.value.snapshot.canonicalKrs)
  if(!snapshot||snapshot.evidenceRef!==result.value.snapshot.evidenceRef||snapshot.nip!==nip)return deny()
  return {status:'PRIMARY' as const,selection:(await selected(snapshot,nip,signal)).selection}
 },async accepted(reference:string,nip:string,signal:AbortSignal){return diagnosticRun('KRS_ACCEPTED',async()=>{
  if(!/^KRS:[0-9]{10}:[a-f0-9]{64}$/.test(reference)||!/^\d{10}$/.test(nip))return deny()
  const snapshot=await catalog.read(reference.split(':')[1])
  if(!snapshot||snapshot.evidenceRef!==reference||snapshot.nip!==nip)return deny()
  return selected(snapshot,nip,signal)
 })}})
}
let runtime:ReturnType<typeof createRuntime>|undefined,configuration:string|undefined
export function getPilot2Registry(env:Env=process.env){
 const key=createHash('sha256').update(JSON.stringify([env.RENDER_SERVICE_ID,env.TARGET_ENVIRONMENT,env.RENDER_GIT_COMMIT,
  env.GUS_BIR_API_KEY,env.KRS_PILOT2_READER_URL,env.KRS_PILOT2_SOURCE_URL,env.SRM_DEVELOPMENT_PILOT2_LOOKUP])).digest('hex')
 if(configuration&&configuration!==key)return deny()
 configuration=key;return runtime??=createRuntime(env)
}

const registryAbsence=new Set(['GUS_NO_RECORD','GUS_NOT_LEGAL_ENTITY','GUS_LOCAL_UNIT_UNSUPPORTED','GUS_REPORT_EMPTY','GUS_KRS_MISSING','GUS_REGISTER_NOT_KRS_ENTREPRENEURS','GUS_REGON_MISSING'])
/** Compatibility adapter for the existing NIP handler, form and report engine.
 * It adds no lookup endpoint, paid client or company matching algorithm. */
export async function searchPilot2RegistryByNip(organisationId:string,request:XrayLookupRequest,signal:AbortSignal):Promise<RegistrySearchResult>{
 const nip=request.identifier.value,cached=await readFreshCompany(organisationId,nip)
 if(readyPilot2RegistryReport(cached,nip)){
  try{return {entityType:'COMPANY',card:await withPilot2ReadyReport(()=>runXrayLookup(organisationId,request))}}
  catch(error){if(!(error instanceof FreshFinancialIdentityRequired))throw error}
 }
 const result=await (await getPilot2Registry()).resolve(nip,signal)
 signal.throwIfAborted()
 if(result.status==='PRIMARY')return withPilot2RegistrySelection(result.selection,async()=>({entityType:'COMPANY' as const,card:await runXrayLookup(organisationId,request)}))
 let ceidgEmpty=false
 const classify=async():Promise<RegistrySearchResult|null>=>{
  const section=await measureSupplierStage('CEIDG_LOOKUP',()=>runJdgLookup(organisationId,nip))
  if(['SUCCESS','PARTIAL'].includes(section.status)&&section.data?.entries.some(e=>e.nip===nip))return {entityType:'JDG',nip,section}
  if(section.status!=='EMPTY')return {entityType:'UNAVAILABLE',unavailableProvider:'CEIDG'}
  ceidgEmpty=true;return null
 }
 if(registryAbsence.has(result.reason)){const classified=await classify();if(classified)return classified}
 // An unavailable primary may reuse the ordinary MGBI cache. A KRS cache that
 // needs new Financial work must instead enter the original MGBI identity flow.
 const card=await skipCache.run(cached?.general.source.provider==='KRS',()=>runXrayLookup(organisationId,request))
 console.info('SRM registry telemetry',{event:'REGISTRY_ROUTE',provider:'MGBI',reason:result.reason})
 if(card.general.data?.nip===nip&&['SUCCESS','PARTIAL'].includes(card.general.status))return {entityType:'COMPANY',card}
 if(card.general.status==='EMPTY'){
  if(!ceidgEmpty){const classified=await classify();if(classified)return classified}
  return {entityType:'NOT_FOUND'}
 }
 return {entityType:'UNAVAILABLE',unavailableProvider:null}
}
