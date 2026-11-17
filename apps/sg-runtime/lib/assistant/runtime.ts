import {PrismaClient,type Prisma} from '@prisma/client'
import OpenAI from 'openai'
import {createAssistantOperationHost} from '@profitia/platform-contracts/assistant-operation-host'
import {createAssistantUsageStore} from '@profitia/platform-contracts/assistant-usage'
import {createClerkIdentityAuthenticator,type ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import {bindPublicIdentityAuthenticator,type PublicIdentityApplication} from '@profitia/platform-contracts/public-request'
import {OPERATION_CONTRACT,OperationDenied,type Application,type OperationContext,type Json,type OperationExecutor} from '@profitia/platform-contracts/operation-context'
import type {AccessStoreBinding,AccessQuery} from '@profitia/platform-contracts/access-store'
import {createAssistantContextGateway,createBenchmarkContextAdapter} from '../../../../packages/assistant-context-gateway/src/index.mjs'
import {createAssistantHistory} from './history'
import {createAssistantModel,adaptAssistantUsageQuery} from './model'
import {createAssistantSourceAdapters} from './sources'
import {QUALITY_RESPONSE_VERSION} from './quality-response'
import {QUALITY_EVIDENCE_VERSION,createAssistantQualityCapture,createQualityHistoryContainment} from './quality-evidence'
import m2Targets from '@/deployment/assistant-m2-targets.json'
import economicTargets from '@/deployment/assistant-ecr-targets.json'
import type {Sg2SelectionRuntime} from '@/lib/platform/private-runtime'
import targets from '@/deployment/assistant-m1-targets.json'
import type {BenchmarkRangePreset} from '@/lib/benchmark/contracts'
type Env=Readonly<Record<string,string|undefined>>
const unavailable=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const queryFor=(client:Pick<Prisma.TransactionClient,'$queryRawUnsafe'|'$executeRawUnsafe'>):AccessQuery=>async(sql,values=[])=>{
 if(/^\s*SELECT\b/i.test(sql)&&sql!=='SELECT profitia_access.append_audit($1::jsonb)')return {rows:await client.$queryRawUnsafe<Record<string,unknown>[]>(sql,...values)}
 await client.$executeRawUnsafe(sql,...values);return {rows:[]}
}
function storeUrl(value:string|undefined,target:{hosts:string[];runtimeRole:string;databaseName:string}){
 try{
  if(!value||value!==value.trim())return unavailable()
  const u=new URL(value)
  if(!['postgres:','postgresql:'].includes(u.protocol)||!target.hosts.includes(u.hostname)||decodeURIComponent(u.username)!==target.runtimeRole
   ||!u.password||u.port&&u.port!=='5432'||u.pathname!=='/'+target.databaseName||u.hash
   ||[...u.searchParams.keys()].some(k=>!['sslmode','channel_binding'].includes(k))||u.searchParams.getAll('sslmode').length!==1||u.searchParams.get('sslmode')!=='require'
   ||u.searchParams.getAll('channel_binding').length>1||u.searchParams.has('channel_binding')&&u.searchParams.get('channel_binding')!=='require')return unavailable()
  return u.href
 }catch{return unavailable()}
}
export function readAssistantConfiguration(env:Env){
 if(env.PROFITIA_ASSISTANT_ENABLED===undefined||env.PROFITIA_ASSISTANT_ENABLED==='false')return null
 if(env.PROFITIA_ASSISTANT_ENABLED!=='true'||env.TARGET_ENVIRONMENT!=='development'||env.RENDER_SERVICE_ID!==targets.serviceId
  ||env.PROFITIA_ASSISTANT_CONFIGURATION_VERSION!==targets.configurationVersion||env.PROFITIA_AUTH_PROVIDER!=='clerk'
  ||!env.OPENAI_API_KEY||env.OPENAI_MODEL!==undefined&&env.OPENAI_MODEL!==targets.model)return unavailable()
 const historyKey=env.PROFITIA_ASSISTANT_HISTORY_COMMAND_KEY,usageKey=env.PROFITIA_ASSISTANT_USAGE_COMMAND_KEY
 if(!/^[a-f0-9]{64}$/.test(historyKey??'')||!/^[a-f0-9]{64}$/.test(usageKey??'')||historyKey===usageKey)return unavailable()
 if(env.PROFITIA_ASSISTANT_M2_CONFIGURATION_VERSION!==undefined&&env.PROFITIA_ASSISTANT_M2_CONFIGURATION_VERSION!==m2Targets.configurationVersion)return unavailable()
 if(env.PROFITIA_ASSISTANT_ECR_CONFIGURATION_VERSION!==undefined
  &&(env.PROFITIA_ASSISTANT_ECR_CONFIGURATION_VERSION!==economicTargets.configurationVersion
   ||env.PROFITIA_ASSISTANT_M2_CONFIGURATION_VERSION!==m2Targets.configurationVersion))return unavailable()
 const timeZone=env.PROFITIA_ASSISTANT_TIME_ZONE
 // Trusted application configuration, never a browser header or model guess.
 // Existing installations keep their explicit legacy UTC behaviour until set.
 if(timeZone!==undefined){try{if(!timeZone||timeZone!==timeZone.trim())return unavailable();new Intl.DateTimeFormat('en',{timeZone}).format(0)}catch{return unavailable()}}
 const qualityVersion=env.PROFITIA_ASSISTANT_QUALITY_RESPONSE_VERSION,qualityAccount=env.PROFITIA_ASSISTANT_QUALITY_ACCOUNT_ID
 if(qualityVersion!==undefined&&(qualityVersion!==QUALITY_RESPONSE_VERSION||timeZone===undefined
  ||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(qualityAccount??''))
  ||qualityVersion===undefined&&qualityAccount!==undefined)return unavailable()
 const evidenceVersion=env.PROFITIA_ASSISTANT_QUALITY_EVIDENCE_VERSION
 let qualityEvidence:null|{url:string;purposeKey:string;evidenceKey:string;storageKey:string;serviceId:string;storageGeneration:string;applicationSha:string}=null
 if(evidenceVersion!==undefined){
  const purposeKey=env.PROFITIA_ASSISTANT_QUALITY_PURPOSE_KEY,evidenceKey=env.PROFITIA_ASSISTANT_QUALITY_EVIDENCE_KEY,storageKey=env.PROFITIA_ASSISTANT_QUALITY_STORAGE_KEY,
   serviceId=env.PROFITIA_ASSISTANT_QUALITY_SERVICE_UUID,storageGeneration=env.PROFITIA_ASSISTANT_QUALITY_STORAGE_GENERATION,applicationSha=env.RENDER_GIT_COMMIT
  const id=(v:string|undefined)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v??'')
  if(evidenceVersion!==QUALITY_EVIDENCE_VERSION||qualityVersion!==QUALITY_RESPONSE_VERSION||![purposeKey,evidenceKey,storageKey].every(k=>/^[a-f0-9]{64}$/.test(k??''))
   ||new Set([historyKey,usageKey,purposeKey,evidenceKey,storageKey]).size!==5||!id(serviceId)||!id(storageGeneration)||!/^[a-f0-9]{40}$/.test(applicationSha??''))return unavailable()
  qualityEvidence={url:storeUrl(env.PROFITIA_ASSISTANT_QUALITY_EVIDENCE_DATABASE_URL,{...targets.history,runtimeRole:'sg2_assistant_quality_capture'}),
   purposeKey:purposeKey!,evidenceKey:evidenceKey!,storageKey:storageKey!,serviceId:serviceId!,storageGeneration:storageGeneration!,applicationSha:applicationSha!}
 }
 return Object.freeze({historyKey:historyKey!,usageKey:usageKey!,openaiKey:env.OPENAI_API_KEY,qualityEvidence,
  qualityResponseAccountId:qualityVersion===QUALITY_RESPONSE_VERSION?qualityAccount!:null,
  ...(timeZone!==undefined?{timeZone}:{}),
  multiSource:env.PROFITIA_ASSISTANT_M2_CONFIGURATION_VERSION===m2Targets.configurationVersion,
  economicCalendar:env.PROFITIA_ASSISTANT_ECR_CONFIGURATION_VERSION===economicTargets.configurationVersion,
  historyUrl:storeUrl(env.PROFITIA_ASSISTANT_HISTORY_DATABASE_URL,targets.history),
  usageUrl:storeUrl(env.PROFITIA_ASSISTANT_USAGE_DATABASE_URL,targets.usage)})
}
export type AssistantConfiguration=NonNullable<ReturnType<typeof readAssistantConfiguration>>
const pooled=(input:string,schema:string)=>{const u=new URL(input);u.searchParams.set('schema',schema);u.searchParams.set('connection_limit','1');u.searchParams.set('pool_timeout','3');u.searchParams.set('connect_timeout','10');u.searchParams.set('sslaccept','strict');return u.href}
export function createSg2AssistantRuntime(config:AssistantConfiguration,options:{
 prisma:PrismaClient;auditPrisma:PrismaClient;clerk:ClerkIdentityClient;application:Application;identity:PublicIdentityApplication;binding:AccessStoreBinding
 market?:{executor:OperationExecutor<Prisma.TransactionClient>;series:(selection:{seriesName:string;range:BenchmarkRangePreset})=>Promise<unknown>}
 forecast?:Extract<Sg2SelectionRuntime,{provider:'clerk'}>['forecastRead']
}){
 const {prisma,auditPrisma,clerk,identity,binding}=options
 if(options.application.environment!=='development'||options.application.appId!=='spendguru'||options.application.profileId!=='PORR_SUITE'
  ||!options.application.organisationId||prisma===auditPrisma)return unavailable()
 const organisationId=options.application.organisationId
 // Reuse the existing three business + one audit connections to central E1.
 // Each new product role gets one connection and execute-only functions.
 const historyDb=new PrismaClient({datasources:{db:{url:pooled(config.historyUrl,'sg2_assistant_history')}}})
 const usageDb=new PrismaClient({datasources:{db:{url:pooled(config.usageUrl,'profitia_limits')}}})
 const usage=createAssistantUsageStore({query:adaptAssistantUsageQuery(queryFor(usageDb)),commandKey:config.usageKey,schemaDigest:targets.usage.schemaDigest})
 const history=createAssistantHistory({query:queryFor(historyDb),commandKey:config.historyKey,schemaDigest:targets.history.schemaDigest})
 const qa=config.qualityEvidence
 const evidenceDb=qa?new PrismaClient({datasources:{db:{url:pooled(qa.url,'sg2_assistant_quality_evidence')}}}):null
 const qualityEvidence=qa&&evidenceDb?createAssistantQualityCapture({purposeQuery:queryFor(prisma),evidenceQuery:queryFor(evidenceDb),
  purposeKey:qa.purposeKey,evidenceKey:qa.evidenceKey,storageKey:qa.storageKey,serviceId:qa.serviceId,storageGeneration:qa.storageGeneration,accountId:config.qualityResponseAccountId!,
  purposeSchemaDigest:'1da8abda37255639bdaf0f1710184ef06e489487c66beafe4354b09c529d987d',evidenceSchemaDigest:'15d7aaa57e5db10df0bcf5c2062791fdbddd978a7ffe78880e009283f4885cb9'}):null
 const historyContainment=createQualityHistoryContainment(queryFor(prisma))
 const guardedHistory=Object.freeze({...history,async delete(context:Readonly<OperationContext>,id:string){
  // Independent E1 tombstone is committed before deleting product history.
  // If containment fails, deletion fails visibly instead of leaving a restorable QA copy.
  await historyContainment.invalidate(context)
  await history.delete(context,id)
 }})
 const executor=createAssistantOperationHost<Prisma.TransactionClient>({
  application:{...options.application,features:['assistant'],operations:['assistant.converse','assistant.history.read','assistant.history.write'],configurationVersion:targets.configurationVersion},binding,
  assistantSchemaDigest:targets.accessSchemaDigest,usage,independentQuery:queryFor(auditPrisma),
  transact:(work,limits)=>prisma.$transaction(transaction=>work({query:queryFor(transaction),transaction}),{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs}),
  createAuthenticator:({resolveBinding})=>{const authenticate=createClerkIdentityAuthenticator({client:clerk,application:identity,resolveBinding});return identity.requestBoundary?bindPublicIdentityAuthenticator(authenticate,identity.requestBoundary):authenticate},
  readResources:async({actor,request,scope})=>{
   const converse=request.operation==='assistant.converse',id=converse?'assistant-turn':'assistant-history'
   if(request.resourceId!==id)return unavailable()
   return {resource:{id,type:converse?'assistant_turn':'assistant_history',dataClass:converse?'OPERATION_AUDIT':'ACCOUNT_PRIVATE',environment:'development',
    ownerOrganisationId:scope.organisationId,ownerUserId:actor.actorId,version:'assistant-m1-v1',projectionVersion:'assistant-m1-v1'}}
  },
  projectOutput:async value=>value,
 })
 const gateway=createAssistantContextGateway({adapters:[createBenchmarkContextAdapter({readAuthorised:async({seriesId,range,organisationId:selected,request,signal})=>{
  if(selected!==organisationId||!options.market||!(request instanceof Request)||signal?.aborted)return unavailable()
  const a=options.market,result=await a.executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
   operation:'knowledge.read',organisationId,resourceId:'market-analytics:'+seriesId,payload:{seriesName:seriesId,range},request},
   async()=>{
    const {cognitionOk}=await import('@/lib/api/middleware')
    return cognitionOk(await a.series({seriesName:seriesId,range}))
   })
  if(!(result.value instanceof Response)||!result.value.ok)return unavailable()
  return result.value.json()
 }}),...createAssistantSourceAdapters({enabled:config.multiSource,economicCalendarEnabled:config.economicCalendar,organisationId,forecast:options.forecast,market:options.market})]})
 const prune=()=>{void historyDb.$queryRawUnsafe('SELECT sg2_assistant_history.prune()').catch(()=>{});void qualityEvidence?.purge().catch(()=>{})}
 prune();const retention=setInterval(prune,10*60*1000);retention.unref()
 const model=createAssistantModel(new OpenAI({apiKey:config.openaiKey,baseURL:'https://api.openai.com/v1',organization:null,project:null,maxRetries:0,timeout:60000}),usage)
 return Object.freeze({organisationId,history:guardedHistory,gateway,model,usage,qualityEvidence,qualityApplicationSha:qa?.applicationSha??null,timeZone:config.timeZone??'UTC',qualityResponseAccountId:config.qualityResponseAccountId,
  async ready(){
   await historyContainment.ready()
   if(qualityEvidence)await qualityEvidence.ready()
   const h=await queryFor(historyDb)('SELECT sg2_assistant_history.descriptor() AS binding'),b=h.rows[0]?.binding as Record<string,unknown>|undefined
   if(h.rows.length!==1||!b||b.applicationId!=='spendguru'||b.environment!=='development'||b.projectId!==targets.history.projectId
    ||b.branchId!==targets.history.branchId||b.databaseName!=='neondb'||b.runtimeRole!==targets.history.runtimeRole||b.schemaDigest!==targets.history.schemaDigest)return unavailable()
   const u=await queryFor(usageDb)(`SELECT current_database() AS database_name,current_user AS role,session_user AS login,
    r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolinherit,
    pg_has_role(session_user,'profitia_limits_owner','MEMBER') AS owner_member,
    to_regprocedure('profitia_limits.assistant_usage(text,text)') IS NOT NULL AS installed,
    has_function_privilege(session_user,'profitia_limits.assistant_usage(text,text)','EXECUTE') AS executable
    FROM pg_roles r WHERE r.rolname=current_user`),row=u.rows[0]
   if(u.rows.length!==1||row.database_name!=='neondb'||row.role!==targets.usage.runtimeRole||row.login!==targets.usage.runtimeRole
    ||['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolinherit','owner_member'].some(k=>row[k]!==false)||row.installed!==true||row.executable!==true)return unavailable()
  },
  async run<T>(request:Request,operation:'assistant.converse'|'assistant.history.read'|'assistant.history.write',payload:Json,action:(context:Readonly<OperationContext>)=>Promise<T>){
   const result=await executor.execute({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation,
    organisationId:operation==='assistant.converse'?organisationId:null,resourceId:operation==='assistant.converse'?'assistant-turn':'assistant-history',payload,request},action)
   return result.value
  },
 })
}
export type AssistantRuntime=ReturnType<typeof createSg2AssistantRuntime>
