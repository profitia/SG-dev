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
import {createAssistantModel} from './model'
import {cognitionOk} from '@/lib/api/middleware'
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
 return Object.freeze({historyKey:historyKey!,usageKey:usageKey!,openaiKey:env.OPENAI_API_KEY,
  historyUrl:storeUrl(env.PROFITIA_ASSISTANT_HISTORY_DATABASE_URL,targets.history),
  usageUrl:storeUrl(env.PROFITIA_ASSISTANT_USAGE_DATABASE_URL,targets.usage)})
}
export type AssistantConfiguration=NonNullable<ReturnType<typeof readAssistantConfiguration>>
const pooled=(input:string,schema:string)=>{const u=new URL(input);u.searchParams.set('schema',schema);u.searchParams.set('connection_limit','1');u.searchParams.set('pool_timeout','3');u.searchParams.set('connect_timeout','10');u.searchParams.set('sslaccept','strict');return u.href}
export function createSg2AssistantRuntime(config:AssistantConfiguration,options:{
 prisma:PrismaClient;auditPrisma:PrismaClient;clerk:ClerkIdentityClient;application:Application;identity:PublicIdentityApplication;binding:AccessStoreBinding
 market?:{executor:OperationExecutor<Prisma.TransactionClient>;series:(selection:{seriesName:string;range:BenchmarkRangePreset})=>Promise<unknown>}
}){
 const {prisma,auditPrisma,clerk,identity,binding}=options
 if(options.application.environment!=='development'||options.application.appId!=='spendguru'||options.application.profileId!=='PORR_SUITE'
  ||!options.application.organisationId||prisma===auditPrisma)return unavailable()
 const organisationId=options.application.organisationId
 // Reuse the existing three business + one audit connections to central E1.
 // Each new product role gets one connection and execute-only functions.
 const historyDb=new PrismaClient({datasources:{db:{url:pooled(config.historyUrl,'sg2_assistant_history')}}})
 const usageDb=new PrismaClient({datasources:{db:{url:pooled(config.usageUrl,'profitia_limits')}}})
 const usage=createAssistantUsageStore({query:queryFor(usageDb),commandKey:config.usageKey,schemaDigest:targets.usage.schemaDigest})
 const history=createAssistantHistory({query:queryFor(historyDb),commandKey:config.historyKey,schemaDigest:targets.history.schemaDigest})
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
   async()=>cognitionOk(await a.series({seriesName:seriesId,range})))
  if(!(result.value instanceof Response)||!result.value.ok)return unavailable()
  return result.value.json()
 }})]})
 const prune=()=>{void historyDb.$queryRawUnsafe('SELECT sg2_assistant_history.prune()').catch(()=>{})}
 prune();const retention=setInterval(prune,10*60*1000);retention.unref()
 const model=createAssistantModel(new OpenAI({apiKey:config.openaiKey,baseURL:'https://api.openai.com/v1',organization:null,project:null,maxRetries:0,timeout:60000}),usage)
 return Object.freeze({organisationId,history,gateway,model,usage,
  async ready(){
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
