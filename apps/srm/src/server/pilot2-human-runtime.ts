import {instrumentDiagnosticPool} from './diagnostic-pg'
import operationAcceptance from '../../operation-integration.json'
import pg from 'pg'
import {createHash} from 'node:crypto'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {currentReportAdmission,reportAdmissionEvidence} from '@profitia/platform-contracts/report-admission'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest,type Json,type Application,type OperationContext} from '@profitia/platform-contracts/operation-context'
import type {AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import type {PublicIdentityApplication} from '@profitia/platform-contracts/public-request'
import {createSrmSupplierRequestOperationHost} from './supplier-request-host'
import {createSrmPrivateOperationHost} from './private-operation-host'
import {createSrmReportAdmissionRuntime,prepareSrmReportAdmission,reportAdmissionConfiguration,type ReportPreparationOptions} from './report-admission-runtime'
import {persistSupplierRequest,readSupplierRequest,supplierRequestResourceId} from './supplier-request-operation'
import {readPilot2PublicCard} from './pilot2-public-catalog'
import {toPublicSection} from './xray-lookup'
import {validateReportSelection,type ReportSelection} from './report-data'
import {readSharedFinancialReport,projectSharedFinancialResponse} from './shared-financial-read'
import {measureSupplierStage} from './supplier-telemetry'
import {createSrmClerkClient,readSrmIdentityRuntime} from './identity-runtime'
import target from '../../deployment/pilot2-human-targets.json'
import privateTargets from '../../deployment/private-runtime-targets.json'
import nativeTargets from '../../deployment/supplier-native-targets.json'

type Human=Parameters<typeof createSrmSupplierRequestOperationHost>[0]
type Pilot2Configuration=Readonly<{provider:'clerk';databaseUrl:string;application:Application;identity:PublicIdentityApplication;
 binding:AccessStoreBinding;module:{id:'supplier_report';schemaDigest:string;auditSchemaDigest:string}}>
export type Pilot2PrivateProjection=Readonly<{
 project:(context:OperationContext,privateClient:pg.PoolClient,publicClient:pg.PoolClient,selection:ReportSelection,version:string)=>Promise<Response>;
 output:(value:unknown,context:OperationContext)=>Promise<Response>
}>
export type Pilot2HumanOptions=Readonly<{config:Pilot2Configuration;human:Human;work:ReportPreparationOptions;catalog:pg.Pool;
 registryProvider?:'KRS'|'MGBI';
 privateProjection?:Pilot2PrivateProjection;
 cacheMiss?:Readonly<{search:(request:Request,nip:string)=>Promise<Response>;report:(request:Request,input:ReportSelection)=>Promise<Response>}>}>
const deny=():never=>{throw new OperationDenied('ACCESS_BASIS_INVALID')}
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
type Env=Readonly<Record<string,string|undefined>>
type Role='srm_private_development_runtime'|'srm_pilot2_jobs'|'srm_pilot2_catalog_reader'|'srm_pilot2_source'|'srm_pilot2_corporate'

/** Physical isolation is server configuration, never an incoming tenant or
 * a cookie. Parsing into pg fields retains strict TLS regardless of URL flags. */
export function pilot2HumanConnection(value:string|undefined,role:Role){
 if(!['srm_private_development_runtime','srm_pilot2_jobs','srm_pilot2_catalog_reader','srm_pilot2_source','srm_pilot2_corporate'].includes(role)||!value||value!==value.trim())return deny()
 let u:URL;try{u=new URL(value);decodeURIComponent(u.password)}catch{return deny()}
 const publicRead=role===target.publicCatalog.readerRole
 const expected=publicRead?target.publicCatalog:privateTargets.environments.development
 const hosts=publicRead?[target.publicCatalog.host]:privateTargets.environments.development.hosts
 if(!['postgres:','postgresql:'].includes(u.protocol)||!hosts.includes(u.hostname)||u.username!==role
  ||!u.password||u.pathname!=='/'+expected.databaseName||u.hash||u.port&&u.port!=='5432'
  ||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))
  ||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='require'
  ||u.searchParams.getAll('channel_binding').length>1||u.searchParams.has('channel_binding')&&u.searchParams.get('channel_binding')!=='require')return deny()
 return {host:u.hostname,port:5432,database:expected.databaseName,user:role,password:decodeURIComponent(u.password),
  ssl:{rejectUnauthorized:true},enableChannelBinding:true,max:3,connectionTimeoutMillis:3000,idleTimeoutMillis:10000,
  statement_timeout:15000,query_timeout:15000,lock_timeout:3000,application_name:'profitia-srm-pilot2-human'}
}

export function readPilot2HumanConfiguration(env:Env=process.env){
 if(typeof window!=='undefined'||env.TARGET_ENVIRONMENT!=='development'||env.RENDER_SERVICE_ID!==target.renderServiceId
  ||env.PROFITIA_AUTH_PROVIDER!=='clerk'||env.SRM_PILOT2_FORM_ADMISSION!=='true'
  ||!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT??'')||!uuid.test(env.PROFITIA_FIXED_ORGANISATION_ID??''))return deny()
 const identity=readSrmIdentityRuntime(env)
 if(identity.provider!=='clerk'||identity.application.authorizedParties.length!==1
  ||identity.application.authorizedParties[0]!==target.publicOrigin)return deny()
 const human=pilot2HumanConnection(env.PILOT2_E1_DATABASE_URL,'srm_private_development_runtime')
 const jobs=pilot2HumanConnection(env.PILOT2_E1_JOBS_URL,'srm_pilot2_jobs')
 const catalog=pilot2HumanConnection(env.PILOT2_PUBLIC_CATALOG_URL,'srm_pilot2_catalog_reader')
 const existing=privateTargets.environments.development
 if(['projectId','branchId','databaseName'].some(k=>target.privateAuthority[k as keyof typeof target.privateAuthority]!==existing[k as keyof typeof existing]))return deny()
 const config:Pilot2Configuration={provider:'clerk',databaseUrl:env.PILOT2_E1_DATABASE_URL!,
  identity:{...identity.application,requestBoundary:{publicOrigins:[target.publicOrigin],internalOrigins:['http://0.0.0.0:10000','https://0.0.0.0:10000']}},
  application:{appId:'srm',profileId:'PORR_SUITE',environment:'development',deploymentId:target.renderServiceId+':'+env.RENDER_GIT_COMMIT,
   configurationVersion:nativeTargets.configurationVersion,identityIssuer:identity.application.issuer,
   organisationId:env.PROFITIA_FIXED_ORGANISATION_ID!,features:['supplier_report'],operations:['supplier.report.refresh']},
  binding:{applicationId:'srm',environment:'development',projectId:existing.projectId,branchId:existing.branchId,
   databaseName:existing.databaseName,role:human.user,schemaDigest:existing.accessSchemaDigest},
  module:{id:'supplier_report',schemaDigest:existing.moduleSchemaDigest,auditSchemaDigest:existing.auditSchemaDigest}}
 return {config,human,jobs,catalog}
}

/** Resource pool memoization only. No principal, admission, selected company,
 * authority decision or report body survives between requests here. */
export function instantiatePilot2HumanOptions(env:Env=process.env):Pilot2HumanOptions{
 const selected=readPilot2HumanConfiguration(env),{config}=selected
 const pair=(configuration:ReturnType<typeof pilot2HumanConnection>,foreground=false)=>{
  // The canonical application has one existing HUMAN entry. Do not rotate its
  // credentials, change its four-connection ceiling or retain idle PILOT2
  // connections. Technical execution has its own independent PILOT2 login.
  const selected=foreground?{...configuration,max:1,idleTimeoutMillis:10}:configuration
  const pool=instrumentDiagnosticPool(new pg.Pool(selected),foreground?'HUMAN':'JOBS'),audit=instrumentDiagnosticPool(new pg.Pool({...selected,max:1}),'INDEPENDENT_AUDIT')
  for(const p of[pool,audit])p.on('error',()=>console.error('PILOT2 authorization database unavailable'))
  return {pool,audit}
 }
 const human=pair(selected.human,true),jobs=pair(selected.jobs),catalog=instrumentDiagnosticPool(new pg.Pool(selected.catalog),'PUBLIC_CATALOG')
 catalog.on('error',()=>console.error('PILOT2 public catalog unavailable'))
 catalog.on('connect',client=>{
  const query=client.query.bind(client)
  client.query=((...args:unknown[])=>measureSupplierStage('DOMAIN_SQL',()=>Reflect.apply(query,client,args))) as typeof client.query
 })
 const clerk=createSrmClerkClient(env),core=nativeTargets.coreSchemaDigests,own=nativeTargets.businessBoundaryDigests
 const reportAdmission=reportAdmissionConfiguration();if(!reportAdmission)return deny()
 const jobApplication={appId:'srm-jobs',profileId:'PLATFORM_INTERNAL' as const,environment:'development' as const,
  deploymentId:config.application.deploymentId+':srm-jobs',configurationVersion:nativeTargets.configurationVersion,
  identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features:['job_execution'],operations:['job.execute' as const]}
 return {config,catalog,
  human:{pool:human.pool,auditPool:human.audit,clerk,identity:config.identity,application:config.application,binding:config.binding,module:config.module,
   requestLedger:{schemaDigest:core['006-request-reservation.sql'],externalSchemaDigest:core['010-external-request-admission.sql'],quotaSchemaDigest:operationAcceptance.requestQuotaSourceCompatibility.schemaDigest},commandBoundaryDigest:own['001-supplier-requests.sql']},
  work:{pool:jobs.pool,auditPool:jobs.audit,clerk,application:jobApplication,
   binding:{...config.binding,applicationId:'srm-jobs',role:selected.jobs.user,service:{schemaDigest:core['005-service-read.sql'],profileId:'PLATFORM_INTERNAL',
    deploymentId:jobApplication.deploymentId,configurationVersion:jobApplication.configurationVersion}},
   job:{schemaDigest:core['007-delegated-jobs.sql'],targetOperation:'supplier.report.refresh',supplierSchemaDigest:core['013-supplier-delegation.sql']},
   accountIdentity:{environment:'development',issuer:config.identity.issuer},
   workSchemaDigest:core['016-delegated-native-work.sql'],reportAdmission}}
}

export function instantiatePilot2HumanRuntime(env:Env=process.env){return createPilot2HumanRuntime(instantiatePilot2HumanOptions(env))}
let runtime:ReturnType<typeof createPilot2HumanRuntime>|undefined,resources:Pilot2HumanOptions|undefined,configuration:string|undefined
export function getPilot2HumanOptions(env:Env=process.env){
 const key=createHash('sha256').update(JSON.stringify(readPilot2HumanConfiguration(env))).digest('hex')
 if(configuration&&configuration!==key)return deny()
 configuration=key
 return resources??=instantiatePilot2HumanOptions(env)
}
export function getPilot2HumanRuntime(env:Env=process.env){
 const options=getPilot2HumanOptions(env)
 return runtime??=createPilot2HumanRuntime(options)
}

/** Composition of the accepted form admission, Root, native Work and public
 * projector. No actor/ALLOW cache, identity directory, copied tenant or SQL
 * authorization implementation is introduced by this consumer. */
export function createPilot2HumanRuntime(options:Pilot2HumanOptions){
 const {config,human,work,catalog}=options
 if(options.registryProvider!==undefined&&!['KRS','MGBI'].includes(options.registryProvider))return deny()
 if(config.provider!=='clerk'||!work.reportAdmission||work.privateAcquisition
  ||human.application.operations.join(',')!=='supplier.report.refresh'
  ||work.job.targetOperation!=='supplier.report.refresh'||work.application.environment!=='development'
  ||config.application.organisationId!==human.application.organisationId
  ||['projectId','branchId','databaseName'].some(k=>human.binding[k as keyof typeof human.binding]!==work.binding[k as keyof typeof work.binding]))return deny()
 const requestHost=createSrmSupplierRequestOperationHost(human)
 const jobs=createDelegatedJobStore({binding:human.binding,...work.job})
 const admission=createSrmReportAdmissionRuntime({config,pool:human.pool,api:{async prepareReport(input){
  if(currentReportAdmission()||input.organisationId!==config.application.organisationId)return deny()
  const command=readSupplierRequest(input.command)
  const key='srm-http-'+createHash('sha256').update(JSON.stringify(['srm-native-http-v1',input.idempotencyKey,'COMPANY:FORM-ADMISSION'])).digest('hex')
  const result=await requestHost.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:'supplier.report.refresh',organisationId:input.organisationId,resourceId:supplierRequestResourceId(command),payload:command,
   idempotencyKey:key,request:input.request},async(context,client)=>{
    const accepted=await persistSupplierRequest(context,client)
    const dispatch=await jobs.createDispatch(client.query.bind(client),context)
    if(dispatch.requestId!==accepted.requestId)return deny()
    return accepted
   })
  const published:unknown=result.value
  if(!(published instanceof Response)||published.status!==202)return deny()
  const accepted=await published.json()
  if(!accepted||Object.keys(accepted).sort().join(',')!=='requestId,status'||accepted.status!=='ACCEPTED'||!uuid.test(accepted.requestId))return deny()
  input.request.signal.throwIfAborted()
  return prepareSrmReportAdmission(work,{requestId:accepted.requestId,organisationId:input.organisationId,command})
 }}})
 const acceptedNip=(request:Request,nip:string)=>{
  const proof=reportAdmissionEvidence(currentReportAdmission())
  if(!proof||request.method!=='POST'||new URL(request.url).search||proof.nip!==nip
   ||proof.organisationId!==config.application.organisationId)return deny()
  return proof
 }
 const read=async(request:Request,nip:string,report:boolean)=>{
  const proof=acceptedNip(request,nip),privateProjection=report?options.privateProjection:undefined
  const operation=privateProjection?'supplier.report.project' as const:'supplier.report.read' as const
  let selected:Awaited<ReturnType<typeof readPilot2PublicCard>>=null
  const host=createSrmPrivateOperationHost({...human,requestLedger:undefined,
   application:{...human.application,operations:privateProjection?['supplier.report.read','supplier.report.project']:[operation]},reportAdmission:work.reportAdmission,
   readResources:async({actor,scope,request:bound})=>{
    if(actor.kind!=='HUMAN'||scope.userId!==actor.actorId||scope.organisationId!==proof.organisationId
     ||bound.operation!==operation||bound.resourceId!=='supplier-report:COMPANY:'+nip)return deny()
    // This cloned public reader contains accepted KRS cards only. MGBI mode
    // retains the same Root admission, then uses the native MGBI cache/engine.
    if(options.registryProvider!=='MGBI'){
     const client=await measureSupplierStage('POOL_WAIT',()=>catalog.connect())
     try{selected=await readPilot2PublicCard(client,nip)}finally{client.release()}
    }
    const shared={id:bound.resourceId,type:'supplier_report',dataClass:'SHARED_KNOWLEDGE',environment:'development',
     ownerOrganisationId:null,ownerUserId:null,version:selected?.version??'pilot2-cache-miss-v1',
     projectionVersion:report?'srm-shared-financial-dto-v1':'srm-pilot2-company-card-v1',approvedSharedProjection:true}as const
    return privateProjection?{resource:{id:bound.resourceId,type:'supplier_projection',dataClass:'ORGANISATION_PRIVATE',
     environment:'development',ownerOrganisationId:proof.organisationId,ownerUserId:null,
     version:'srm-private-report-collection-v1',projectionVersion:'srm-report-dto-v1'},
     inputs:[{...shared,id:'stored-financial-view:COMPANY:'+nip,projectionVersion:'srm-stored-corporate-financial-v1'}]}:{resource:shared}
   },
   projectOutput:async(value,context)=>{
    if(!selected&&options.cacheMiss){
     if(!(value instanceof Response)||value.status!==204||await value.clone().text()!==''
      ||context.resourceId!=='supplier-report:COMPANY:'+nip)return deny()
     return value
    }
    if(privateProjection)return privateProjection.output(value,context)
    if(context.resource.version!==(selected?.version??'pilot2-cache-miss-v1'))return deny()
    if(report)return projectSharedFinancialResponse(value,context)
    if(!selected||value!==selected.card||operationPayloadDigest(value as unknown as Json)!==selected.bodyDigest)return deny()
    return Response.json({entityType:'COMPANY',card:{identity:selected.card.identity,
     general:toPublicSection(selected.card.general),financial:toPublicSection(selected.card.financial),kys:toPublicSection(selected.card.kys)}},{headers})
   }})
  const result=await host.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation,organisationId:proof.organisationId,resourceId:'supplier-report:COMPANY:'+nip,
   payload:{nip,entityType:'COMPANY'},request},async(context,privateClient)=>{
    if(!selected){
     if(options.cacheMiss)return new Response(null,{status:204,headers})
     throw new OperationDenied('POLICY_UNAVAILABLE')
    }
    if(!report)return selected.card
    const client=await measureSupplierStage('POOL_WAIT',()=>catalog.connect())
    try{
     const version=(await client.query<{financial_sha256:string}>('SELECT financial_sha256 FROM srm.catalog_companies WHERE nip=$1',[nip])).rows[0]?.financial_sha256
     if(!version||!/^[a-f0-9]{64}$/.test(version))return deny()
     const body=privateProjection?await privateProjection.project(context,privateClient,client,{nip,entityType:'COMPANY'},version)
      :await readSharedFinancialReport(client,proof.organisationId,{nip,entityType:'COMPANY'},version)
     const current=await readPilot2PublicCard(client,nip)
     if(current?.version!==selected.version)return deny()
     return body instanceof Response?body:Response.json(body,{headers})
    }finally{client.release()}
   })
  if(!(result.value instanceof Response))return deny()
  return result.value
 }
 return Object.freeze({
  prepare:admission.prepare,
  search:(request:Request,nip:string)=>admission.run(request,async()=>{
   const selected=readSupplierRequest({kind:'SUPPLIER_REPORT',nip}).nip,response=await read(request,selected,false)
   // The neutral miss commits before network or delegated Work begins.
   return response.status===204&&options.cacheMiss?options.cacheMiss.search(request,selected):response
  }),
  report:(request:Request,input:unknown)=>admission.run(request,async()=>{
   const selection=validateReportSelection(input);if(selection.entityType!=='COMPANY')return deny()
   const response=await read(request,selection.nip,true)
   return response.status===204&&options.cacheMiss?options.cacheMiss.report(request,selection):response
  }),
 })
}
