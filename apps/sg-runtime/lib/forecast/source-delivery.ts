import { createPlatformDeliveryPort, createPlatformIngestionHost, type PlatformIngestionBinding } from '@profitia/platform-contracts/platform-ingestion'
import { OperationDenied, operationPayloadDigest, type Application } from '@profitia/platform-contracts/operation-context'
import type { AccessQuery } from '@profitia/platform-contracts/access-store'
import type { Prisma, PrismaClient } from '@/generated/market-data-client'
import { readStoredMarketHistory } from '@/lib/market-data/stored-read'
import { readForecastRequest } from './request-operation'
import { createForecastPreparationQueueService } from './preparation-queue'
import { createStoredForecastReadinessPolicy } from './stored-readiness-read'

export const FORECAST_QUEUE_SOURCE = Object.freeze({ id:'sg2.forecast.queue',payloadSchema:'sg2-forecast-command-v1',
  qualityVersion:'stored-forecast-authority-v1',classificationVersion:'shared-market-command-v1' })
const sourceRef = (value:unknown) => typeof value==='string'&&value.length>0&&value.length<=256
const refuse=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
type QueryClient=Pick<Prisma.TransactionClient,'$queryRawUnsafe'|'$executeRawUnsafe'>
const queryFor=(client:QueryClient):AccessQuery=>async(sql,values=[])=>{
  // SDK audit calls project a real boolean row, never a PostgreSQL void column.
  if(/^\s*SELECT\b/i.test(sql))return{rows:await client.$queryRawUnsafe<Record<string,unknown>[]>(sql,...values)}
  if(!/^SET LOCAL\b/.test(sql))return refuse()
  await client.$executeRawUnsafe(sql,...values);return{rows:[]}
}

type NativeQueueReceipt={schemaVersion:string;boundaryDigest:string;sourceSchemaDigest:string;projectId:string;branchId:string
  databaseName:string;role:string;sourceId:string;payloadSchema:string;qualityVersion:string;classificationVersion:string
  fencesInstalled:boolean;expiresAt:string}
export type Sg2ForecastSourceOptions={
  application:Application;binding:PlatformIngestionBinding;boundaryDigest:string
  /** Genuine generated Market clients, same ordinary source login, separate
   * business/audit pools. A readonly projection role is not a writer role. */
  prisma:PrismaClient;auditPrisma:PrismaClient;now?:()=>number
}

/** Fixed native receiver of the shared source contract. No new queue, model,
 * forecast algorithm, HTTP provider, file, identity or background runtime. */
export function createSg2ForecastSourceDelivery(options:Sg2ForecastSourceOptions){
  const {prisma,auditPrisma,now=Date.now}=options
  const application=structuredClone(options.application),binding=structuredClone(options.binding),boundaryDigest=options.boundaryDigest
  if(!prisma||!auditPrisma||prisma===auditPrisma||!/^[a-f0-9]{64}$/.test(boundaryDigest)
    ||application.appId!=='spendguru-forecast-source'||binding.applicationId!==application.appId
    ||application.features.join(',')!=='knowledge_ingestion'||application.operations.join(',')!=='knowledge.ingest')throw TypeError('Explicit SG2 native source identity and independent pools required')
  const verifyBoundary=async(transaction:Prisma.TransactionClient)=>{
    const rows=await transaction.$queryRawUnsafe<Array<{descriptor:NativeQueueReceipt|null}>>('SELECT profitia_forecast_admission.runtime_descriptor() AS descriptor')
    const d=rows[0]?.descriptor
    if(rows.length!==1||!d||d.schemaVersion!=='1.0.0'||d.boundaryDigest!==boundaryDigest||d.sourceSchemaDigest!==binding.schemaDigest
      ||d.projectId!==binding.projectId||d.branchId!==binding.branchId||d.databaseName!==binding.databaseName||d.role!==binding.role
      ||d.sourceId!==FORECAST_QUEUE_SOURCE.id||d.payloadSchema!==FORECAST_QUEUE_SOURCE.payloadSchema
      ||d.qualityVersion!==FORECAST_QUEUE_SOURCE.qualityVersion||d.classificationVersion!==FORECAST_QUEUE_SOURCE.classificationVersion
      ||d.fencesInstalled!==true||!sourceRef(d.expiresAt)||!(Date.parse(d.expiresAt)>now()))return refuse()
  }
  const host=createPlatformIngestionHost<Prisma.TransactionClient>({application,binding,source:FORECAST_QUEUE_SOURCE,now,
    independentQuery:queryFor(auditPrisma),
    transact:(work,limits)=>prisma.$transaction(async transaction=>{
      // Original generated models deliberately resolve approved read views
      // before legacy public persistence. The role cannot create in either.
      await transaction.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
      await transaction.$executeRawUnsafe('SET LOCAL search_path=pg_catalog,profitia_forecast_read,public,pg_temp')
      return work({query:queryFor(transaction),transaction})
    },{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs}),
    validateSharedPayload:async(value,{transaction})=>{
      const command=await readForecastRequest(value)
      await verifyBoundary(transaction)
      // Existing query/formatter, one exact stored source. Missing or
      // unclassified history cannot hydrate a provider or select another DB.
      const {history}=await readStoredMarketHistory(transaction,command.seriesId)
      return history.providerSeries.providerSeriesId===command.seriesId
    },
  })
  return createPlatformDeliveryPort({host,resourceId:value=>{
    if(!value||typeof value!=='object'||Array.isArray(value)||!('seriesId'in value)||typeof value.seriesId!=='string')return refuse()
    return value.seriesId
  },write:async(value,transaction,context)=>{
    const command=await readForecastRequest(value)
    await verifyBoundary(transaction)
    const {history}=await readStoredMarketHistory(transaction,command.seriesId)
    const policy=createStoredForecastReadinessPolicy(transaction,history,command.seriesId)
    const reservation=context.platformReservation
    if(!reservation||reservation.replay||context.resourceId!==command.seriesId||context.sourceId!==FORECAST_QUEUE_SOURCE.id)return refuse()
    const scope=await transaction.$queryRawUnsafe<Array<{bound:boolean}>>(
      'SELECT profitia_forecast_admission.bind_effect($1::uuid,$2::uuid,$3) AS bound',reservation.effectId,context.decisionId,context.payloadDigest)
    if(scope.length!==1||scope[0].bound!==true)return refuse()
    const assertSeries=(seriesId:string)=>{if(seriesId!==command.seriesId)return refuse()}
    const queue=createForecastPreparationQueueService({source:{transaction,authority:{
      resolveInteractiveCapability:policy.capability,resolveExactCapability:policy.resolveExact,
      resolveHistoricalSeries:async(seriesId,range)=>{assertSeries(seriesId);if(range!=='ALL')return refuse();return{history,marketDataSource:'postgres',cacheStatus:'hit'}},
      loadRollingHistory:async seriesId=>{assertSeries(seriesId);return{seriesId,displayName:history.displayName,description:history.displayName,
        frequency:history.frequency??'',source:history.source??null,points:history.historical}},
    }}})
    const result=await queue.enqueue(command,{correlationId:context.correlationId})
    if(result.state==='UNSUPPORTED')throw new OperationDenied('APPLICATION_FEATURE_UNAVAILABLE')
    if(result.state==='FAILED')return refuse()
    const commandText=JSON.stringify(Object.fromEntries(Object.keys(command).sort().map(key=>[key,command[key as keyof typeof command]])))
    if(operationPayloadDigest(command)!==operationPayloadDigest(value))return refuse()
    const recorded=await transaction.$queryRawUnsafe<Array<{recorded:boolean}>>(
      'SELECT profitia_forecast_admission.record_delivery($1::uuid,$2::uuid,$3,$4,$5) AS recorded',
      reservation.effectId,context.decisionId,commandText,result.job?.jobKey??null,result.state)
    if(recorded.length!==1||recorded[0].recorded!==true)return refuse()
  }})
}
