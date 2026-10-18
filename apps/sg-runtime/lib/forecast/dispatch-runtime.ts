import {PrismaClient} from '@prisma/client'
import {PrismaClient as MarketClient} from '@/generated/market-data-client'
import {createClerkClient} from '@clerk/backend'
import {readClerkConfiguration} from '@profitia/platform-contracts/clerk-configuration'
import type {Application} from '@profitia/platform-contracts/operation-context'
import type {AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import type {PlatformIngestionBinding} from '@profitia/platform-contracts/platform-ingestion'
import targets from '@/deployment/private-runtime-targets.json'
import {createSg2ForecastDelegatedDelivery,createSg2ForecastDispatchPoller} from './delegated-delivery'
import {createSg2ForecastSourceDelivery} from './source-delivery'
import {readSg2ForecastWorkerConfiguration} from './source-worker-runtime'

type Input=Readonly<Record<string,string|undefined>>
const unavailable=():never=>{throw Error('Private Forecast dispatch configuration unavailable')}
function connection(value:string|undefined,target:{hosts:readonly string[];runtimeRole:string;databaseName:string}){
  if(!value||value!==value.trim())return unavailable()
  let url:URL;try{url=new URL(value)}catch{return unavailable()}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!target.hosts.includes(url.hostname)||url.username!==target.runtimeRole||!url.password
    ||url.port&&url.port!=='5432'||url.pathname!==`/${target.databaseName}`||url.hash
    ||[...url.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))
    ||url.searchParams.getAll('sslmode').length!==1||url.searchParams.get('sslmode')!=='require'
    ||url.searchParams.getAll('channel_binding').length>1||url.searchParams.has('channel_binding')&&url.searchParams.get('channel_binding')!=='require')return unavailable()
  url.searchParams.set('connection_limit','1');url.searchParams.set('connect_timeout','10');url.searchParams.set('pool_timeout','3')
  return url.toString()
}

/** No caller selects the executor, source, login, organisation or environment.
 * This optional lane lives inside the existing single Current worker process. */
export function readSg2ForecastDispatchConfiguration(env:Input=process.env){
  const flag=env.PROFITIA_FORECAST_DISPATCH_ENABLED
  if(flag===undefined||flag==='false')return Object.freeze({provider:'disabled' as const})
  if(flag!=='true'||typeof window!=='undefined')return unavailable()
  const worker=readSg2ForecastWorkerConfiguration(env),t=targets.environments.development.forecastDispatch
  if(worker.provider!=='native'||worker.mode!=='CURRENT_ONLY'||env.RENDER_SERVICE_ID!==t.serviceId
    ||env.TARGET_ENVIRONMENT!=='development'||env.PROFITIA_FORECAST_DISPATCH_CONFIGURATION_VERSION!==t.configurationVersion
    ||env.PROFITIA_CLERK_ISSUER!==t.identityIssuer)return unavailable()
  let authorizedParties:unknown;try{authorizedParties=JSON.parse(env.PROFITIA_CLERK_AUTHORIZED_PARTIES??'')}catch{return unavailable()}
  const identity=readClerkConfiguration({applicationId:'spendguru-forecast-dispatch',environment:'development',issuer:env.PROFITIA_CLERK_ISSUER,
    publishableKey:env.PROFITIA_CLERK_PUBLISHABLE_KEY,secretKey:env.PROFITIA_CLERK_SECRET_KEY,authorizedParties})
  const privateDatabaseUrl=connection(env.PROFITIA_FORECAST_DISPATCH_DATABASE_URL,t.private)
  const sourceDatabaseUrl=connection(env.PROFITIA_FORECAST_QUEUE_DATABASE_URL,t.source)
  const deploymentId=`${t.serviceId}:${env.RENDER_GIT_COMMIT}`
  const application:Application={appId:'spendguru-forecast-dispatch',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId,
    configurationVersion:t.configurationVersion,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,
    operations:['job.execute'],features:['job_execution']}
  const binding:AccessStoreBinding & {service:NonNullable<AccessStoreBinding['service']>}={applicationId:application.appId,environment:'development',
    projectId:t.private.projectId,branchId:t.private.branchId,databaseName:t.private.databaseName,role:t.private.runtimeRole,schemaDigest:t.private.accessSchemaDigest,
    service:{profileId:'PLATFORM_INTERNAL',deploymentId,configurationVersion:t.configurationVersion,schemaDigest:t.private.serviceSchemaDigest}}
  const sourceApplication:Application={...application,appId:'spendguru-forecast-source',operations:['knowledge.ingest'],features:['knowledge_ingestion']}
  const sourceBinding:PlatformIngestionBinding={applicationId:sourceApplication.appId,environment:'development',deploymentId,configurationVersion:t.configurationVersion,
    projectId:t.source.projectId,branchId:t.source.branchId,databaseName:t.source.databaseName,role:t.source.runtimeRole,schemaDigest:t.source.sourceSchemaDigest}
  return Object.freeze({provider:'native' as const,application,binding,privateDatabaseUrl,sourceApplication,sourceBinding,sourceDatabaseUrl,
    publishableKey:identity.publishableKey,identityIssuer:identity.application.issuer,jobSchemaDigest:t.jobSchemaDigest,
    commandProjectionDigest:t.commandProjectionDigest,discoveryDigest:t.discoveryDigest,sourceBoundaryDigest:t.source.boundaryDigest})
}

export function createSg2ConfiguredForecastDispatch(env:Input=process.env){
  const c=readSg2ForecastDispatchConfiguration(env)
  if(c.provider==='disabled')return c
  const prisma=new PrismaClient({datasources:{db:{url:c.privateDatabaseUrl}}}),auditPrisma=new PrismaClient({datasources:{db:{url:c.privateDatabaseUrl}}})
  const source=new MarketClient({datasources:{db:{url:c.sourceDatabaseUrl}}}),sourceAudit=new MarketClient({datasources:{db:{url:c.sourceDatabaseUrl}}})
  const disconnect=async()=>{await Promise.allSettled([prisma.$disconnect(),auditPrisma.$disconnect(),source.$disconnect(),sourceAudit.$disconnect()])}
  try{
    const clerk=createClerkClient({publishableKey:c.publishableKey,secretKey:env.PROFITIA_CLERK_SECRET_KEY,telemetry:{disabled:true}})
    const sourceDelivery=createSg2ForecastSourceDelivery({application:c.sourceApplication,binding:c.sourceBinding,boundaryDigest:c.sourceBoundaryDigest,prisma:source,auditPrisma:sourceAudit})
    const delivery=createSg2ForecastDelegatedDelivery({...c,prisma,auditPrisma,clerk,sourceDelivery})
    const poller=createSg2ForecastDispatchPoller({...c,prisma,delivery})
    return Object.freeze({provider:'native' as const,poller,disconnect})
  }catch(error){void disconnect();throw error}
}
