import {randomUUID} from 'node:crypto'
import type {Prisma,PrismaClient} from '@prisma/client'
import {createDelegatedNativeWorkHost} from '@profitia/platform-contracts/private-operation-host'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {createClerkAccountStatusReader,type ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {AccessStoreBinding} from '@profitia/platform-contracts/access-store'
import {OPERATION_CONTRACT,OperationDenied,operationPayloadDigest,type Application,type Json,type OperationContext,type Environment} from '@profitia/platform-contracts/operation-context'
import {discoveryQuery} from './discovery-host'
import {readDiscoveryCommand,readDiscoveryResult,discoveryRequestResourceId,discoveryUuid,persistDiscoveryRequest,type DiscoveryCommand} from './discovery-operation'

export type DiscoveryJob={schemaDigest:string;targetOperation:'benchmark.discovery.request';supplierSchemaDigest:string;operationSchemaDigest:string}
export type DiscoveryNativeOptions={prisma:PrismaClient;auditPrisma:PrismaClient;clerk:Pick<ClerkIdentityClient,'users'>;
 application:Application;binding:AccessStoreBinding&{service:NonNullable<AccessStoreBinding['service']>};job:DiscoveryJob;
 workSchemaDigest:string;boundaryDigest:string;accountIdentity:{environment:Environment;issuer:string};now?:()=>number}
export type DiscoverySelection=Readonly<{requestId:string;organisationId:string;command:Readonly<DiscoveryCommand>}>
const refuse=():never=>{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
export function createDiscoveryRequestPersister(binding:AccessStoreBinding,job:DiscoveryJob){
 const store=createDelegatedJobStore({binding,...job})
 return async(context:Readonly<OperationContext>,transaction:Prisma.TransactionClient)=>{
  const receipt=await persistDiscoveryRequest(context,transaction),dispatch=await store.createDispatch(discoveryQuery(transaction),context)
  if(dispatch.requestId!==receipt.requestId)return refuse();return receipt
 }
}
/** A domain result is not an effect receipt. The sole Root/job/Source engines
 * still own permission, current grants, quota and actual external uncertainty. */
export function createSg2DiscoveryNativeStore(options:DiscoveryNativeOptions){
 if(typeof window!=='undefined'||!options.prisma||!options.auditPrisma||options.prisma===options.auditPrisma
  ||options.application.appId!=='spendguru-benchmark-dispatch'||options.binding.applicationId!==options.application.appId
  ||options.job.targetOperation!=='benchmark.discovery.request'||options.accountIdentity.environment!==options.application.environment
  ||!['boundaryDigest','workSchemaDigest'].every(k=>/^[a-f0-9]{64}$/.test(options[k as 'boundaryDigest'|'workSchemaDigest'])))throw TypeError('Explicit native Finder work binding required')
 const {prisma,auditPrisma,now=Date.now}=options
 const fixed=structuredClone({application:options.application,binding:options.binding,job:options.job,boundaryDigest:options.boundaryDigest})
 const host=createDelegatedNativeWorkHost<Prisma.TransactionClient>({...fixed,privateWork:{schemaDigest:options.workSchemaDigest},now,
  independentQuery:discoveryQuery(auditPrisma),readExternalAccount:createClerkAccountStatusReader({client:options.clerk,...options.accountIdentity,now}),
  transact:(work,limits)=>prisma.$transaction(tx=>work({query:discoveryQuery(tx),transaction:tx}),{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs})})
 async function run<T>(input:DiscoverySelection,unitId:'SG2_DISCOVERY_READ'|'SG2_DISCOVERY_SAVE',data:Json,action:(context:Readonly<OperationContext>,tx:Prisma.TransactionClient,descriptor:Record<string,unknown>)=>Promise<T>):Promise<T>{
  if(!input||Object.getPrototypeOf(input)!==Object.prototype||Reflect.ownKeys(input).length!==3
   ||Object.keys(input).sort().join(',')!=='command,organisationId,requestId'||!discoveryUuid.test(input.requestId)||!discoveryUuid.test(input.organisationId))return refuse()
  const selected={...input,command:readDiscoveryCommand(input.command)},accessMode=unitId==='SG2_DISCOVERY_READ'?'READ':'WRITE'
  let performed=false,result:T|undefined
  const receipt=await host.runSqlWork({contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,operation:'job.execute',organisationId:selected.organisationId,
   resourceId:selected.requestId,payload:selected.command as Json,request:null},{unitId,accessMode,inputDigest:operationPayloadDigest(data)},async(context,tx)=>{
   const current=context.requestWork
   if(performed||context.actorKind!=='SERVICE'||context.applicationId!==fixed.application.appId||context.organisationId!==selected.organisationId
    ||context.subjectUserId===context.actorId||!context.subjectUserId||context.delegation?.subjectUserId!==context.subjectUserId
    ||context.delegation.target.application.appId!=='spendguru'||context.delegation.target.operation!=='benchmark.discovery.request'
    ||context.delegation.target.resourceId!==discoveryRequestResourceId(selected.command)||context.payloadDigest!==operationPayloadDigest(selected.command as Json)
    ||current?.requestId!==selected.requestId||current.unitId!==unitId||current.accessMode!==accessMode||current.schemaDigest!==options.workSchemaDigest)return refuse()
   const rows=await tx.$queryRawUnsafe<Array<{descriptor:Record<string,unknown>}>>('SELECT profitia_benchmark_discovery.current_work($1::uuid,$2,$3::uuid,$4::uuid) AS descriptor',selected.requestId,unitId,selected.organisationId,context.subjectUserId)
   const d=rows[0]?.descriptor
   if(rows.length!==1||!d||d.discoverySchemaVersion!=='1.0.0'||d.discoveryBoundaryDigest!==fixed.boundaryDigest
    ||d.payloadDigest!==context.payloadDigest||d.subjectUserId!==context.subjectUserId||d.requestId!==selected.requestId||d.unitId!==unitId||d.accessMode!==accessMode)return refuse()
   result=await action(context,tx,d);performed=true
  })
  if(!performed||receipt.value.requestId!==selected.requestId||receipt.value.status!=='ACCEPTED')return refuse();return result as T
 }
 return Object.freeze({
  async read(selected:DiscoverySelection){return run(selected,'SG2_DISCOVERY_READ',{version:'sg2-discovery-read-v1'},async(context,tx)=>{
   const commands=await tx.$queryRawUnsafe<Array<{command_json:unknown}>>('SELECT command_json FROM profitia_benchmark_discovery.commands WHERE request_id=$1::uuid AND organisation_id=$2::uuid AND user_id=$3::uuid',selected.requestId,selected.organisationId,context.subjectUserId)
   if(commands.length!==1||operationPayloadDigest(readDiscoveryCommand(commands[0].command_json) as Json)!==context.payloadDigest)return refuse()
   const rows=await tx.$queryRawUnsafe<Array<{result_version:string;result_json:unknown;retention_until:Date}>>('SELECT result_version,result_json,retention_until FROM profitia_benchmark_discovery.results WHERE request_id=$1::uuid AND organisation_id=$2::uuid AND user_id=$3::uuid',selected.requestId,selected.organisationId,context.subjectUserId)
   if(rows.length>1)return refuse();if(rows.length===0)return null
   // A retained expired result cannot fund another hidden provider attempt.
   if(rows[0].retention_until.getTime()<=now())throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
   return Object.freeze({requestId:selected.requestId,resultVersion:rows[0].result_version,data:readDiscoveryResult(rows[0].result_json,selected.command)})
  })},
  async save(selected:DiscoverySelection,value:unknown){
   const data=readDiscoveryResult(value,selected.command)
   return run(selected,'SG2_DISCOVERY_SAVE',{resultDigest:operationPayloadDigest(data)},async(context,tx,d)=>{
    const seconds=d.retentionSeconds;if(!Number.isSafeInteger(seconds)||Number(seconds)<60||Number(seconds)>604800)return refuse()
    const resultVersion=randomUUID(),until=new Date(Math.min(now()+Number(seconds)*1000,Date.parse(String(d.retentionPolicyExpiresAt))))
    if(!(until.getTime()>now()))return refuse()
    const changed=await tx.$executeRawUnsafe('INSERT INTO profitia_benchmark_discovery.results(request_id,application_id,environment,organisation_id,user_id,result_version,result_json,retention_until) VALUES($1::uuid,$2,$3,$4::uuid,$5::uuid,$6::uuid,$7::jsonb,$8::timestamptz)',selected.requestId,'spendguru',context.environment,selected.organisationId,context.subjectUserId,resultVersion,JSON.stringify(data),until)
    if(changed!==1)return refuse();return Object.freeze({requestId:selected.requestId,resultVersion})
   })
  },
 })
}
