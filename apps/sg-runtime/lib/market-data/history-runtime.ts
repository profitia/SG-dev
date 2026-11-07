import {PrismaClient} from '@prisma/client'
import type {Application} from '@profitia/platform-contracts/operation-context'
import {createStoredMarketHistoryReader} from './stored-read'
import {createMarketHistoryIngestion} from './history-ingestion'
import {MARKET_HISTORY_APPLICATION,MarketHistoryUnavailable} from './history-contract'
import targets from '@/deployment/market-history-targets.json'

type Env=Readonly<Record<string,string|undefined>>
const unavailable=():never=>{throw new MarketHistoryUnavailable('CONFIGURATION_UNAVAILABLE')}
function connection(value:string|undefined,role:string){
 if(!value||value!==value.trim())return unavailable()
 let u:URL;try{u=new URL(value)}catch{return unavailable()}
 if(!['postgresql:','postgres:'].includes(u.protocol)||!targets.hosts.includes(u.hostname)||u.username!==role||!u.password||u.pathname!=='/'+targets.databaseName||u.hash
  ||u.port&&u.port!=='5432'||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='require'
  ||u.searchParams.getAll('channel_binding').length>1||u.searchParams.has('channel_binding')&&u.searchParams.get('channel_binding')!=='require')return unavailable()
 return u.href
}
export function readMarketHistoryConfiguration(env:Env=process.env){
 const enabled=env.PROFITIA_MARKET_HISTORY_ENABLED
 if(enabled!==undefined&&!['false','true'].includes(enabled))return unavailable()
 if(enabled!=='true')return undefined
 if(env.TARGET_ENVIRONMENT!=='development'||env.APP_ENV!=='development'||env.RENDER_SERVICE_ID!==targets.serviceId||!env.RENDER_GIT_COMMIT||!/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT)
  ||env.PROFITIA_MARKET_HISTORY_CONFIGURATION_VERSION!==targets.configurationVersion
  ||env.MACROBOND_BASE_URL!==undefined&&env.MACROBOND_BASE_URL!=='https://api.macrobondfinancial.com'
  ||env.MACROBOND_TOKEN_URL!==undefined&&env.MACROBOND_TOKEN_URL!=='https://apiauth.macrobondfinancial.com/mbauth/connect/token'
  ||!env.MACROBOND_CLIENT_ID||!env.MACROBOND_CLIENT_SECRET||[env.MACROBOND_CLIENT_ID,env.MACROBOND_CLIENT_SECRET].some(v=>v!==v.trim()||v.length>8192||/[\r\n\0]/.test(v)))return unavailable()
 return Object.freeze({sourceUrl:connection(env.PROFITIA_MARKET_HISTORY_DATABASE_URL,targets.runtimeRole),readUrl:connection(env.MARKET_DATA_DATABASE_URL,targets.read.runtimeRole),
  deploymentId:targets.serviceId+':'+env.RENDER_GIT_COMMIT,credentials:Object.freeze({clientId:env.MACROBOND_CLIENT_ID,clientSecret:env.MACROBOND_CLIENT_SECRET})})
}
const pool=(value:string)=>{const u=new URL(value);u.searchParams.set('connection_limit','1');u.searchParams.set('sslaccept','strict');u.searchParams.set('pool_timeout','3');u.searchParams.set('connect_timeout','10');return u.href}
/** An internal operation in the existing SG Runtime; no new service, scheduler,
 * HUMAN identity or privileged database fallback. Caller owns the durable runId. */
export function createMarketHistoryRuntime(config:NonNullable<ReturnType<typeof readMarketHistoryConfiguration>>){
 const prisma=new PrismaClient({datasources:{db:{url:pool(config.sourceUrl)}}}),auditPrisma=new PrismaClient({datasources:{db:{url:pool(config.sourceUrl)}}}),readPrisma=new PrismaClient({datasources:{db:{url:pool(config.readUrl)}}})
 const application:Application={appId:MARKET_HISTORY_APPLICATION,profileId:'PLATFORM_INTERNAL' as const,environment:'development' as const,deploymentId:config.deploymentId,configurationVersion:targets.configurationVersion,identityIssuer:'urn:profitia:database-service-runtime:v1',organisationId:null,operations:['knowledge.ingest'],features:['knowledge_ingestion']}
 const binding={applicationId:application.appId,environment:'development' as const,projectId:targets.projectId,branchId:targets.branchId,databaseName:targets.databaseName,role:targets.runtimeRole,deploymentId:application.deploymentId,configurationVersion:application.configurationVersion,schemaDigest:targets.sourceSchemaDigest,unmeteredSchemaDigest:targets.unmeteredSchemaDigest}
 const readHistory=createStoredMarketHistoryReader(readPrisma,{projectId:targets.projectId,branchId:targets.branchId,databaseName:targets.databaseName,role:targets.read.runtimeRole,schemaDigest:targets.read.schemaDigest})
 const operation=createMarketHistoryIngestion({prisma,auditPrisma,application,binding,boundaryDigest:targets.boundaryDigest,external:{configurationVersion:targets.externalConfigurationVersion,schemaDigest:targets.externalSchemaDigest,nativeSchemaDigest:targets.nativeSchemaDigest},credentials:config.credentials,readHistory})
 return Object.freeze({...operation,async close(){await Promise.allSettled([prisma.$disconnect(),auditPrisma.$disconnect(),readPrisma.$disconnect()])}})
}
