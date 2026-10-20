import {PrismaClient} from '@prisma/client'
import type {Application} from '@profitia/platform-contracts/operation-context'
import type {AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import type {DiscoveryHostOptions} from './discovery-host'
import {createSg2DiscoveryRequestHost,createSg2DiscoveryReadHost} from './discovery-host'
import {createDiscoveryRequestPersister,createSg2DiscoveryNativeStore} from './discovery-native'
import {createFinderSourceTransport} from './discovery-source'
import {createDiscoveryMetadataLoader} from './discovery-metadata'
import {createSg2DiscoveryApi} from './discovery-api'
import {IdentityConfigurationUnavailable} from '@/lib/platform/identity-runtime'
import targets from '@/deployment/benchmark-discovery-targets.json'

type Env=Readonly<Record<string,string|undefined>>
const unavailable=():never=>{throw new IdentityConfigurationUnavailable()}
const S='urn:profitia:database-service-runtime:v1'
function connection(input:string|undefined,target:{hosts:string[];databaseName:string;runtimeRole:string}){
 if(!input||input!==input.trim())return unavailable()
 let u:URL;try{u=new URL(input)}catch{return unavailable()}
 if(!['postgresql:','postgres:'].includes(u.protocol)||!target.hosts.includes(u.hostname)||u.username!==target.runtimeRole||!u.password
  ||u.port&&u.port!=='5432'||u.pathname!=='/'+target.databaseName||u.hash||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))
  ||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='require'||u.searchParams.getAll('channel_binding').length>1
  ||u.searchParams.has('channel_binding')&&u.searchParams.get('channel_binding')!=='require')return unavailable()
 return u.toString()
}
export function readDiscoveryConfiguration(env:Env=process.env){
 const enabled=env.PROFITIA_BENCHMARK_DISCOVERY_ENABLED
 if(enabled!==undefined&&!['false','true'].includes(enabled))return unavailable()
 if(enabled!=='true')return undefined
 if(env.TARGET_ENVIRONMENT!=='development'||env.RENDER_SERVICE_ID!==targets.serviceId
  ||env.PROFITIA_BENCHMARK_DISCOVERY_CONFIGURATION_VERSION!==targets.configurationVersion
  ||env.MACROBOND_BASE_URL!==undefined&&env.MACROBOND_BASE_URL!==targets.source.origins.MACROBOND_API
  ||env.MACROBOND_TOKEN_URL!==undefined&&env.MACROBOND_TOKEN_URL!==targets.source.origins.MACROBOND_TOKEN+'/mbauth/connect/token')return unavailable()
 const credentials={macrobondClientId:env.MACROBOND_CLIENT_ID??null,macrobondClientSecret:env.MACROBOND_CLIENT_SECRET??null,
  openAiKey:env.OPENAI_API_KEY??null,openAiModel:env.OPENAI_MODEL??'gpt-5.6-luna'}
 if((credentials.macrobondClientId===null)!==(credentials.macrobondClientSecret===null)
  ||Object.values(credentials).some(v=>v!==null&&(!v.trim()||v!==v.trim()||v.length>8192||/[\r\n\0]/.test(v))))return unavailable()
 return Object.freeze({configurationVersion:targets.configurationVersion,
  workUrl:connection(env.PROFITIA_BENCHMARK_WORK_DATABASE_URL,{...targets.privateStore,runtimeRole:targets.nativeWork.runtimeRole}),
  sourceUrl:connection(env.PROFITIA_BENCHMARK_SOURCE_DATABASE_URL,targets.source),
  metadataUrl:connection(env.PROFITIA_BENCHMARK_METADATA_DATABASE_URL,targets.metadataRead),credentials:Object.freeze(credentials)})
}
function poolUrl(input:string,limit:number,schema:string){
 const u=new URL(input);u.searchParams.set('schema',schema);u.searchParams.set('connection_limit',String(limit));
 u.searchParams.set('sslaccept','strict');u.searchParams.set('pool_timeout','3');u.searchParams.set('connect_timeout','10');return u.toString()
}
/** This is a composition inside the existing app process. HUMAN connections
 * and identity are supplied by its existing runtime; no second HUMAN pool,
 * request ledger, scheduler or identity cache is introduced. */
export async function createDiscoveryRuntime(config:NonNullable<ReturnType<typeof readDiscoveryConfiguration>>,human:Omit<DiscoveryHostOptions,'boundaryDigest'>){
 if(human.application.environment!=='development'||human.application.appId!=='spendguru'
  ||human.binding.projectId!==targets.privateStore.projectId||human.binding.branchId!==targets.privateStore.branchId
  ||human.binding.databaseName!==targets.privateStore.databaseName||human.binding.role!==targets.privateStore.runtimeRole)return unavailable()
 const workPrisma=new PrismaClient({datasources:{db:{url:poolUrl(config.workUrl,2,'profitia_benchmark_discovery')}}})
 const workAudit=new PrismaClient({datasources:{db:{url:poolUrl(config.workUrl,1,'profitia_benchmark_discovery')}}})
 const sourcePrisma=new PrismaClient({datasources:{db:{url:poolUrl(config.sourceUrl,2,'profitia_ingestion')}}})
 const sourceAudit=new PrismaClient({datasources:{db:{url:poolUrl(config.sourceUrl,1,'profitia_ingestion')}}})
 const {PrismaClient:MarketClient}=await import('@/generated/market-data-client')
 const metadataPrisma=new MarketClient({datasources:{db:{url:poolUrl(config.metadataUrl,1,targets.metadataRead.schemaName)}}})
 const sql=targets.requiredSharedSql
 const job={schemaDigest:sql['007-delegated-jobs.sql'],targetOperation:'benchmark.discovery.request' as const,
  supplierSchemaDigest:sql['013-supplier-delegation.sql'],operationSchemaDigest:sql['017-additional-request-operations.sql']}
 const foreground={...human,boundaryDigest:targets.nativeWork.boundaryDigest}
 const requestHost=createSg2DiscoveryRequestHost({...foreground,
  application:{...human.application,configurationVersion:config.configurationVersion,operations:['benchmark.discovery.request'],features:['benchmark']},
  requestLedger:{schemaDigest:sql['006-request-reservation.sql'],externalSchemaDigest:sql['010-external-request-admission.sql'],operationSchemaDigest:sql['017-additional-request-operations.sql']}})
 const readHost=createSg2DiscoveryReadHost({...foreground,
  application:{...human.application,configurationVersion:config.configurationVersion,operations:['benchmark.discovery.read'],features:['benchmark']}})
 const service=(appId:string,configurationVersion:string,operations:Application['operations'],features:string[]):Application=>({appId,profileId:'PLATFORM_INTERNAL',environment:'development',
  deploymentId:human.application.deploymentId,configurationVersion,identityIssuer:S,organisationId:null,operations,features})
 const workApp=service(targets.nativeWork.applicationId,targets.nativeWork.configurationVersion,['job.execute'],['job_execution'])
 const workBinding:AccessStoreBinding&{service:NonNullable<AccessStoreBinding['service']>}={...human.binding,applicationId:workApp.appId,role:targets.nativeWork.runtimeRole,
  service:{schemaDigest:targets.serviceSchemaDigest,profileId:'PLATFORM_INTERNAL',deploymentId:workApp.deploymentId,configurationVersion:workApp.configurationVersion}}
 const work=createSg2DiscoveryNativeStore({prisma:workPrisma,auditPrisma:workAudit,clerk:human.clerk,application:workApp,binding:workBinding,job,
  workSchemaDigest:sql['016-delegated-native-work.sql'],boundaryDigest:targets.nativeWork.boundaryDigest,
  accountIdentity:{environment:'development',issuer:human.identity.issuer}})
 const sourceApp=service(targets.source.applicationId,targets.source.runtimeConfigurationVersion,['knowledge.ingest'],['knowledge_ingestion'])
 const sourceBinding={applicationId:sourceApp.appId,environment:'development' as const,projectId:targets.source.projectId,branchId:targets.source.branchId,
  databaseName:targets.source.databaseName,role:targets.source.runtimeRole,schemaDigest:targets.source.sourceSqlDigest,
  deploymentId:sourceApp.deploymentId,configurationVersion:sourceApp.configurationVersion}
 const loadMetadataClient=createDiscoveryMetadataLoader(metadataPrisma,{...targets.metadataRead,role:targets.metadataRead.runtimeRole})
 return createSg2DiscoveryApi({requestHost,readHost,persist:createDiscoveryRequestPersister(human.binding,job),work,
  providerPorts:operationKey=>({...createFinderSourceTransport({prisma:sourcePrisma,auditPrisma:sourceAudit,application:sourceApp,binding:sourceBinding,
   external:{configurationVersion:targets.source.externalConfigurationVersion,schemaDigest:targets.source.externalSqlDigest,nativeSchemaDigest:targets.source.nativeSqlDigest},
   operationKey,credentials:config.credentials}),loadMetadataClient})})
}
