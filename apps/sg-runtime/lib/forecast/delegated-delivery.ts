import type {Prisma,PrismaClient} from '@prisma/client'
import {createDelegatedJobStore} from '@profitia/platform-contracts/delegated-job'
import {createDelegatedJobHost} from '@profitia/platform-contracts/private-operation-host'
import {createClerkAccountStatusReader,type ClerkIdentityClient} from '@profitia/platform-contracts/identity-provider'
import type {AccessStoreBinding,AccessQuery} from '@profitia/platform-contracts/access-store'
import type {PlatformDeliveryPort} from '@profitia/platform-contracts/platform-ingestion'
import {OPERATION_CONTRACT,OperationDenied,type Application,type OperationContext} from '@profitia/platform-contracts/operation-context'
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
    const rows=await prisma.$queryRawUnsafe<Array<{command:unknown}>>('SELECT profitia_forecast_dispatch.command($1::uuid) AS command',jobId)
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
