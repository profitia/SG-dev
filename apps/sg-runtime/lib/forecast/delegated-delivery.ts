import type {Prisma,PrismaClient} from '@prisma/client'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {createDelegatedJobHost} from '@profitia/platform-contracts/private-operation-host'
import {createClerkAccountStatusReader,type ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {AccessStoreBinding,AccessQuery} from '@profitia/platform-contracts/access-store'
import type {PlatformDeliveryPort} from '@profitia/platform-contracts/platform-ingestion'
import {OPERATION_CONTRACT,OperationDenied,isOperationDenied,type Application,type OperationContext} from '@profitia/platform-contracts/operation-context'
import {persistForecastRequest,readForecastRequest} from './request-operation'

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const refuse=():never=>{throw new OperationDenied('DELEGATION_INVALID')}
type QueryClient=Pick<Prisma.TransactionClient,'$queryRawUnsafe'|'$executeRawUnsafe'>
const queryFor=(client:QueryClient):AccessQuery=>async(sql,values=[])=>{
  if(/^\s*SELECT\b/i.test(sql))return{rows:await client.$queryRawUnsafe<Record<string,unknown>[]>(sql,...values)}
  if(!/^SET LOCAL\b/.test(sql))return refuse()
  await client.$executeRawUnsafe(sql,...values);return{rows:[]}
}

/** Same HUMAN request transaction as the original private command and quota.
 * The shared store refuses historical ACCEPTED receipts and substituted scope.
 * No background effect occurs before the foreground transaction commits. */
export function createSg2ForecastDispatchPersister(options:{binding:AccessStoreBinding;jobSchemaDigest:string;now?:()=>number}){
  const store=createDelegatedJobStore({binding:options.binding,schemaDigest:options.jobSchemaDigest,now:options.now})
  return async(context:Readonly<OperationContext>,transaction:Prisma.TransactionClient)=>{
    const receipt=await persistForecastRequest(context,transaction)
    await store.createDispatch(queryFor(transaction),context)
    return receipt
  }
}

export function createSg2ForecastDelegatedDelivery(options:{
  application:Application;binding:AccessStoreBinding & {service:NonNullable<AccessStoreBinding['service']>}
  jobSchemaDigest:string;commandProjectionDigest:string;identityIssuer:string
  prisma:PrismaClient;auditPrisma:PrismaClient;clerk:Pick<ClerkIdentityClient,'users'>
  sourceDelivery:Readonly<PlatformDeliveryPort>;now?:()=>number
}){
  const {prisma,auditPrisma,now=Date.now}=options
  const boundaryDigest=options.commandProjectionDigest,application=structuredClone(options.application),binding=structuredClone(options.binding)
  if(!prisma||!auditPrisma||prisma===auditPrisma||application.appId!=='spendguru-forecast-dispatch'
    ||!/^[a-f0-9]{64}$/.test(boundaryDigest))throw TypeError('Explicit native private dispatch and independent audit pools required')
  const host=createDelegatedJobHost<Prisma.TransactionClient>({application,binding,job:{schemaDigest:options.jobSchemaDigest},now,
    independentQuery:queryFor(auditPrisma),sourceDelivery:options.sourceDelivery,
    readExternalAccount:createClerkAccountStatusReader({client:options.clerk,environment:application.environment,issuer:options.identityIssuer,now}),
    transact:(work,limits)=>prisma.$transaction(transaction=>work({transaction,query:queryFor(transaction)}),{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs}),
  })
  return Object.freeze({async deliver(jobId:string){
    if(!uuid.test(jobId))return refuse()
    const rows=await prisma.$transaction(async transaction=>{
      await transaction.$executeRawUnsafe("SET LOCAL statement_timeout='15000ms'")
      return transaction.$queryRawUnsafe<Array<{command:unknown}>>('SELECT profitia_forecast_dispatch.command($1::uuid) AS command',jobId)
    },{timeout:15000,maxWait:3000})
    const value=rows[0]?.command
    if(rows.length!==1||!value||typeof value!=='object'||Array.isArray(value))return refuse()
    const v=value as Record<string,unknown>
    if(Object.keys(v).sort().join(',')!=='boundaryDigest,jobId,organisationId,payload,schemaVersion'
      ||v.schemaVersion!=='1.0.0'||v.boundaryDigest!==boundaryDigest||v.jobId!==jobId
      ||typeof v.organisationId!=='string'||!uuid.test(v.organisationId))return refuse()
    const payload=await readForecastRequest(v.payload)
    const input={contractId:OPERATION_CONTRACT.id,contractVersion:OPERATION_CONTRACT.version,
      operation:'job.execute',organisationId:v.organisationId,resourceId:jobId,payload,request:null}
    const admission=await host.admit(input)
    if(admission.value.status!=='READY')return admission
    if(!host.deliver)return refuse()
    return host.deliver(input,admission.value)
  }})
}

/** One bounded iteration inside the existing worker. Discovery is not an
 * admission and never exposes commands or private owners to the source port. */
export function createSg2ForecastDispatchPoller(options:{
  prisma:PrismaClient;binding:AccessStoreBinding & {service:NonNullable<AccessStoreBinding['service']>}
  jobSchemaDigest:string;discoveryDigest:string;delivery:ReturnType<typeof createSg2ForecastDelegatedDelivery>
}){
  const {prisma,delivery,jobSchemaDigest,discoveryDigest}=options,b=structuredClone(options.binding)
  if(!prisma||!b.service||b.applicationId!=='spendguru-forecast-dispatch'
    ||![jobSchemaDigest,discoveryDigest].every(v=>/^[a-f0-9]{64}$/.test(v))
    ||typeof delivery?.deliver!=='function')throw TypeError('Explicit private discovery and delivery required')
  let after:string|null=null,busy=false
  return Object.freeze({async runOne():Promise<boolean>{
    if(busy)return false
    busy=true
    try{
      const rows=await prisma.$transaction(async transaction=>{
        await transaction.$executeRawUnsafe("SET LOCAL statement_timeout='15000ms'")
        return transaction.$queryRawUnsafe<Array<{database_name:string;role:string;login:string;discovery:unknown}>>(
          'SELECT current_database() AS database_name,current_user AS role,session_user AS login,profitia_forecast_dispatch.pending($1::uuid) AS discovery',after)
      },{timeout:15000,maxWait:3000})
      const d=rows[0]?.discovery
      if(rows.length!==1||rows[0].database_name!==b.databaseName||rows[0].role!==b.role||rows[0].login!==b.role
        ||!d||typeof d!=='object'||Array.isArray(d))return refuse()
      const v=d as Record<string,unknown>
      if(Object.keys(v).sort().join(',')!=='boundaryDigest,branchId,configurationVersion,databaseName,deploymentId,environment,jobIds,jobSchemaDigest,projectId,role,schemaVersion'
        ||v.schemaVersion!=='1.0.0'||v.boundaryDigest!==discoveryDigest||v.jobSchemaDigest!==jobSchemaDigest
        ||v.environment!==b.environment||v.projectId!==b.projectId||v.branchId!==b.branchId||v.databaseName!==b.databaseName||v.role!==b.role
        ||v.deploymentId!==b.service.deploymentId||v.configurationVersion!==b.service.configurationVersion
        ||!Array.isArray(v.jobIds)||v.jobIds.length>8||v.jobIds.some(id=>typeof id!=='string'||!uuid.test(id))
        ||new Set(v.jobIds).size!==v.jobIds.length)return refuse()
      for(const id of v.jobIds as string[]){
        after=id
        try{if((await delivery.deliver(id)).value.status==='CONFIRMED')return true}
        catch(error){
          // Revocation between discovery and admission is expected. Policy,
          // audit, budget and uncertain-delivery failures remain visible.
          if(!isOperationDenied(error)||!['DELEGATION_INVALID','ACCESS_BASIS_INVALID','PERMISSION_DENIED','EXPLICIT_DENY','PRODUCT_UNAVAILABLE'].includes(error.reasonCode))throw error
        }
      }
      return false
    }finally{busy=false}
  }})
}
