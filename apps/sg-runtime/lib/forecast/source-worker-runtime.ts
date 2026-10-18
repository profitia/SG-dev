import { PrismaClient } from '@/generated/market-data-client'
import type { Application } from '@profitia/platform-contracts/operation-context'
import type { PlatformIngestionBinding } from '@profitia/platform-contracts/platform-ingestion'
import targets from '@/deployment/private-runtime-targets.json'
import { createSg2ForecastSourceWorker } from './source-worker'
import type { ForecastPreparationWorkerMode } from './preparation-queue'

type Input=Readonly<Record<string,string|undefined>>
const unavailable=():never=>{throw Error('Native Forecast worker configuration unavailable')}
export function readSg2ForecastWorkerConfiguration(env:Input=process.env){
  const flag=env.PROFITIA_FORECAST_WORKER_ENABLED
  if(flag===undefined||flag==='false')return Object.freeze({provider:'legacy' as const})
  if(flag!=='true'||typeof window!=='undefined')return unavailable()
  const t=targets.environments.development.forecastWorker
  const lane=t.lanes.find(candidate=>candidate.serviceId===env.RENDER_SERVICE_ID)
  if(!lane||env.APP_ENV!=='development'||env.PROFITIA_FORECAST_WORKER_CONFIGURATION_VERSION!==t.configurationVersion
    ||!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT??'')
    ||env.FORECAST_PREPARATION_WORKER_MODE!==undefined&&env.FORECAST_PREPARATION_WORKER_MODE!==lane.mode)return unavailable()
  const value=env.PROFITIA_FORECAST_WORKER_DATABASE_URL
  if(!value||value!==value.trim())return unavailable()
  let url:URL;try{url=new URL(value)}catch{return unavailable()}
  if(!['postgres:','postgresql:'].includes(url.protocol)||!t.hosts.includes(url.hostname)||url.username!==lane.runtimeRole||!url.password
    ||url.port&&url.port!=='5432'||url.pathname!==`/${t.databaseName}`||url.hash
    ||[...url.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))
    ||url.searchParams.getAll('sslmode').length!==1||url.searchParams.get('sslmode')!=='require'
    ||url.searchParams.getAll('channel_binding').length>1||url.searchParams.has('channel_binding')&&url.searchParams.get('channel_binding')!=='require')return unavailable()
  const deploymentId=`${lane.serviceId}:${env.RENDER_GIT_COMMIT}`
  const application:Application={appId:'spendguru-forecast-worker',profileId:'PLATFORM_INTERNAL',environment:'development',deploymentId,
    configurationVersion:t.configurationVersion,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,
    features:['knowledge_ingestion'],operations:['knowledge.ingest']}
  const binding:PlatformIngestionBinding={applicationId:application.appId,environment:'development',deploymentId,configurationVersion:t.configurationVersion,
    projectId:t.projectId,branchId:t.branchId,databaseName:t.databaseName,role:lane.runtimeRole,schemaDigest:t.sourceSchemaDigest}
  return Object.freeze({provider:'native' as const,application,binding,databaseUrl:url.toString(),boundaryDigest:t.boundaryDigest,
    mode:lane.mode as ForecastPreparationWorkerMode,workerId:env.RENDER_INSTANCE_ID?.trim()||lane.serviceId})
}
/** No client/secret is resolved during import or disabled configuration. Two
 * actual independent pools authenticate as the pinned ordinary source role. */
export function createSg2ConfiguredForecastWorker(env:Input=process.env){
  const config=readSg2ForecastWorkerConfiguration(env)
  if(config.provider==='legacy')return config
  const url=new URL(config.databaseUrl);url.searchParams.set('schema','public');url.searchParams.set('connection_limit','1')
  const prisma=new PrismaClient({datasources:{db:{url:url.toString()}}}),auditPrisma=new PrismaClient({datasources:{db:{url:url.toString()}}})
  try{
    const worker=createSg2ForecastSourceWorker({...config,prisma,auditPrisma})
    return Object.freeze({provider:'native' as const,worker,disconnect:async()=>{await prisma.$disconnect();await auditPrisma.$disconnect()}})
  }catch(error){void prisma.$disconnect();void auditPrisma.$disconnect();throw error}
}
