import {srmKrsPilotTarget} from './krs-native-runtime'
import {reportAdmissionConfiguration} from './report-admission-runtime'
import type pg from 'pg'
import type {ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {PrivateConfiguration} from './private-runtime'
import {IdentityConfigurationUnavailable} from './identity-runtime'
import {createSrmSupplierApi} from './supplier-api-composition'
import {createSrmSupplierSourceRequest} from './supplier-source-request'
import targets from '../../deployment/supplier-native-targets.json'
import mgbiPolicy from '../../deployment/mgbi-unmetered-policy.json'
import privateTargets from '../../deployment/private-runtime-targets.json'
type Env=Readonly<Record<string,string|undefined>>
type Configuration=Readonly<{base:PrivateConfiguration;configurationVersion:string;jobsUrl:string;providerSourceUrl:string;corporateSourceUrl:string;
 runtimeRoles?:typeof targets.runtimeRoles;mgbiKey:string;mgbiScheme:'raw'|'bearer';ceidgKey:string;verclyKey:string;verclyOrigin:string;referenceSecret:string}>
const unavailable=():never=>{throw new IdentityConfigurationUnavailable()}
function roleUrl(value:string|undefined,role:string){
 if(!value||value!==value.trim())return unavailable()
 let url:URL;try{url=new URL(value);decodeURIComponent(url.password)}catch{return unavailable()}
 if(!['postgresql:','postgres:'].includes(url.protocol)||!privateTargets.environments.development.hosts.includes(url.hostname)
  ||url.username!==role||!url.password||url.port&&url.port!=='5432'||url.pathname!=='/'+targets.databaseName||url.hash
  ||[...url.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))
  ||url.searchParams.getAll('sslmode').length!==1||url.searchParams.get('sslmode')!=='require'
  ||url.searchParams.getAll('channel_binding').length>1||url.searchParams.has('channel_binding')&&url.searchParams.get('channel_binding')!=='require')return unavailable()
 return url.toString()
}
export function readSrmNativeSupplierConfiguration(base:PrivateConfiguration,env:Env=process.env):Configuration|undefined{
 const enabled=env.PROFITIA_SUPPLIER_API_ENABLED??'false'
 if(!['true','false'].includes(enabled))return unavailable()
 if(enabled==='false')return undefined
 const pilot=srmKrsPilotTarget(env)
 if(typeof window!=='undefined'||base.provider!=='clerk'||base.application.environment!=='development'
  ||base.binding.projectId!==targets.projectId||base.binding.branchId!==targets.branchId||base.binding.databaseName!==targets.databaseName
  ||env.RENDER_SERVICE_ID!==(pilot?.render.serviceId??targets.serviceId)||env.PROFITIA_SUPPLIER_API_CONFIGURATION_VERSION!==targets.configurationVersion
  ||!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT??'')
  ||typeof env.SRM_DEMO_SESSION_SECRET!=='string'||env.SRM_DEMO_SESSION_SECRET.length<32)return unavailable()
 const runtimeRoles=pilot?.runtimeRoles??targets.runtimeRoles
 const jobsUrl=roleUrl(env.PROFITIA_SUPPLIER_JOBS_DATABASE_URL,runtimeRoles.jobs)
 const providerSourceUrl=roleUrl(env.PROFITIA_SUPPLIER_SOURCE_DATABASE_URL,runtimeRoles.providerSource)
 const corporateSourceUrl=roleUrl(env.PROFITIA_CORPORATE_SOURCE_DATABASE_URL,runtimeRoles.corporateSource)
 const mgbiKey=env.MGBI_API_KEY?.trim(),ceidgKey=(env.CEIDG_API_KEY??env.API_KEY_CEDG)?.trim(),verclyKey=env.VERCLY_API_KEY?.trim()
 let origin:URL;try{origin=new URL(env.VERCLY_API_BASE_URL??'')}catch{return unavailable()}
 if(!mgbiKey||!ceidgKey||!verclyKey||env.MGBI_AUTH_SCHEME!==undefined&&!['raw','bearer'].includes(env.MGBI_AUTH_SCHEME)
  ||origin.protocol!=='https:'||origin.pathname!=='/'||origin.port||origin.username||origin.password||origin.search||origin.hash)return unavailable()
 return Object.freeze({base,...(pilot?{runtimeRoles}:{}),configurationVersion:targets.configurationVersion,jobsUrl,providerSourceUrl,corporateSourceUrl,
  mgbiKey,mgbiScheme:env.MGBI_AUTH_SCHEME==='bearer'?'bearer':'raw',ceidgKey,verclyKey,verclyOrigin:origin.origin,referenceSecret:env.SRM_DEMO_SESSION_SECRET})
}
type Pools={pool:pg.Pool;auditPool:pg.Pool;jobsPool:pg.Pool;jobsAudit:pg.Pool;sourcePool:pg.Pool;sourceAudit:pg.Pool;corporatePool:pg.Pool;corporateAudit:pg.Pool;clerk:ClerkIdentityClient}
/** All connections are server-selected ordinary logins. Source owns only
 * classified universal publication/control; it cannot stand in for a HUMAN. */
export function createSrmNativeSupplierRuntime(config:Configuration,pools:Pools){
 const roles=config.runtimeRoles??targets.runtimeRoles
 const reportAdmission=config.runtimeRoles?reportAdmissionConfiguration():undefined
 const c=config.base,core=targets.coreSchemaDigests,own=targets.businessBoundaryDigests,version=config.configurationVersion
 const human={pool:pools.pool,auditPool:pools.auditPool,clerk:pools.clerk,identity:c.identity,binding:c.binding,module:c.module}
 const app=(operations:typeof c.application.operations)=>({...c.application,configurationVersion:version,operations})
 const ledger={schemaDigest:core['006-request-reservation.sql'],externalSchemaDigest:core['010-external-request-admission.sql']}
 const publicJob={schemaDigest:core['007-delegated-jobs.sql'],targetOperation:'supplier.report.refresh' as const,supplierSchemaDigest:core['013-supplier-delegation.sql']}
 const privateJob={...publicJob,targetOperation:'supplier.private.refresh' as const,operationSchemaDigest:core['017-additional-request-operations.sql']}
 const serviceApplication=(appId:string,configurationVersion:string,features:string[],operations:typeof c.application.operations)=>({
  appId,profileId:'PLATFORM_INTERNAL' as const,environment:'development' as const,deploymentId:c.application.deploymentId+':'+appId,
  configurationVersion,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,features,operations})
 const jobApplication=serviceApplication('srm-jobs',version,['job_execution'],['job.execute'])
 const workBase={pool:pools.jobsPool,auditPool:pools.jobsAudit,clerk:pools.clerk,application:jobApplication,
  binding:{...c.binding,applicationId:'srm-jobs',role:roles.jobs,service:{schemaDigest:core['005-service-read.sql'],profileId:'PLATFORM_INTERNAL' as const,
   deploymentId:jobApplication.deploymentId,configurationVersion:version}},
  commandBoundaryDigest:own['001-supplier-requests.sql'],accountIdentity:{environment:'development' as const,issuer:c.identity.issuer},
  workSchemaDigest:core['016-delegated-native-work.sql'],workBusinessBoundaryDigest:own['010-supplier-sensitive-work.sql']}
 const sourceApplication=serviceApplication('srm-provider-source',version,['knowledge_ingestion'],['knowledge.ingest'])
 const sourceOptions={pool:pools.sourcePool,auditPool:pools.sourceAudit,application:sourceApplication,
  binding:{applicationId:sourceApplication.appId,environment:'development' as const,projectId:targets.projectId,branchId:targets.branchId,
   databaseName:targets.databaseName,role:roles.providerSource,deploymentId:sourceApplication.deploymentId,
   configurationVersion:version,schemaDigest:core['008-platform-ingestion.sql'],...(config.runtimeRoles?{unmeteredSchemaDigest:mgbiPolicy.unmeteredSchemaDigest}:{})},requestSchemaDigest:own['009-supplier-source-request.sql']}
 const source=createSrmSupplierSourceRequest(sourceOptions)
 const external={configurationVersion:version,schemaDigest:core['009-external-call-admission.sql'],nativeSchemaDigest:core['012-native-external-transport.sql'],maximumResponseBytes:1024*1024}
 const provider={...sourceOptions,external}
 const corporateApplication=serviceApplication('srm-corporate-source',version,['knowledge_ingestion'],['knowledge.ingest'])
 const corporate={application:corporateApplication,binding:{...sourceOptions.binding,applicationId:corporateApplication.appId,
  role:roles.corporateSource,deploymentId:corporateApplication.deploymentId},pool:pools.corporatePool,auditPool:pools.corporateAudit,
  publicationSchemaDigest:targets.corporatePublicationSchemaDigest}
 const requestBase={...human,requestLedger:ledger,commandBoundaryDigest:own['001-supplier-requests.sql']}
 const privateFlow=(entityType:'COMPANY'|'JDG',section:'kys'|'jdg')=>{
  const privateAcquisition={entityType,section,boundaryDigest:own['011-supplier-private-acquisition.sql']}
  return {request:{...requestBase,application:app(['supplier.private.refresh']),privateAcquisition,
   requestLedger:{...ledger,operationSchemaDigest:core['017-additional-request-operations.sql']}},
   lookup:{work:{...workBase,job:privateJob,privateAcquisition},namedInterestBoundaryDigest:own['003-named-supplier-interest.sql'],source,
    entityType,section,provider:{apiKey:section==='jdg'?config.ceidgKey:config.verclyKey,
     origin:section==='jdg'?'https://dane.biznes.gov.pl':config.verclyOrigin,source:provider}}}
 }
 const webFlow=(entityType:'COMPANY'|'JDG')=>{
  const privateAcquisition={entityType,section:'web' as const,boundaryDigest:own['011-supplier-private-acquisition.sql'],webBoundaryDigest:own['012-supplier-web-identity.sql']}
  return {request:{...requestBase,application:app(['supplier.private.refresh']),privateAcquisition,
    requestLedger:{...ledger,operationSchemaDigest:core['017-additional-request-operations.sql']}},
   lookup:{entityType,work:{...workBase,job:privateJob,privateAcquisition,workBusinessBoundaryDigest:own['012-supplier-web-identity.sql']},
    source:{application:sourceOptions.application,binding:sourceOptions.binding,pool:pools.sourcePool,auditPool:pools.sourceAudit,
     external:{configurationVersion:version,schemaDigest:core['009-external-call-admission.sql'],nativeSchemaDigest:core['012-native-external-transport.sql'],publicWebSchemaDigest:core['018-public-web-transport.sql']}}}}
 }
 return createSrmSupplierApi({
  company:{request:{...requestBase,application:app(['supplier.report.refresh'])},
   lookup:{work:{...workBase,job:publicJob,workBusinessBoundaryDigest:own['008-supplier-native-work.sql'],...(reportAdmission?{reportAdmission}:{})},namedInterestBoundaryDigest:own['003-named-supplier-interest.sql'],source,corporate,
    mgbi:{apiKey:config.mgbiKey,authScheme:config.mgbiScheme,source:{...provider,external:{...external,maximumResponseBytes:config.runtimeRoles?mgbiPolicy.maximumInventoryResponseBytes:external.maximumResponseBytes}},msrExternal:{...external,maximumResponseBytes:20*1024*1024}}},
   read:{...human,application:app(['supplier.report.read']),...(reportAdmission?{reportAdmission}:{})}},
  companyKys:privateFlow('COMPANY','kys'),jdgKys:privateFlow('JDG','kys'),jdgRegistry:privateFlow('JDG','jdg'),
  web:{company:webFlow('COMPANY'),jdg:webFlow('JDG'),read:{...human,application:app(['supplier.private.read']),webBoundaryDigest:own['012-supplier-web-identity.sql']}},
  privateRead:{...human,application:app(['supplier.private.read','supplier.private.reveal','supplier.private.export']),
   sensitiveBoundaryDigest:own['010-supplier-sensitive-work.sql'],secret:config.referenceSecret},
  krs:{source:{...sourceOptions,providerOrigin:config.verclyOrigin,external:{...external,maximumResponseBytes:24*1024*1024}},apiKey:config.verclyKey},
 })
}
