import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { createPlatformIngestionHost, type PlatformIngestionBinding } from '@profitia/platform-contracts/platform-ingestion'
import { OperationDenied, operationPayloadDigest, type Application } from '@profitia/platform-contracts/operation-context'
import type { AccessQuery } from '@profitia/platform-contracts/access-store'
import type { Prisma, PrismaClient } from '@/generated/market-data-client'
import { readStoredMarketHistory } from '@/lib/market-data/stored-read'
import { createStoredForecastReadinessPolicy } from './stored-readiness-read'
import { createForecastPreparationQueueService, createForecastPreparationWorker, resolveForecastPreparationWorkerJobKinds,
  type ClaimedForecastPreparationJob, type ForecastPreparationWorkerMode } from './preparation-queue'
import { createSg2StoredWorkerScience } from './source-worker-science'

export const FORECAST_WORKER_SOURCE = Object.freeze({ id:'sg2.forecast.worker',payloadSchema:'sg2-forecast-worker-step-v1',
  qualityVersion:'stored-forecast-science-v1',classificationVersion:'shared-market-science-v1' })
const fail=():never=>{throw new OperationDenied('POLICY_UNAVAILABLE')}
const candidate=z.object({queueVersion:z.string().min(1).max(128),jobId:z.string().min(1).max(128),seriesId:z.string().min(1).max(256),modelId:z.enum(['naive','damped_holt','ets','arima']),
  targetSemantics:z.enum(['END_OF_PERIOD','MONTHLY_AVERAGE','ROLLING_DAILY_POINT_IN_TIME']),jobKind:z.enum(['CURRENT','VERIFICATION']),leaseVersion:z.number().int().nonnegative()}).strict()
const payloadSchema=candidate.extend({phase:z.enum(['CLAIM','STEP']),leaseOwnerToken:z.string().min(1).max(256).nullable(),
  step:z.enum(['CLAIM','QUEUE','QUEUE_CHILD','READ','ARTIFACT','ADMISSION','LEDGER','TELEMETRY']),argumentsDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict()
export type ForecastWorkerStep=Exclude<z.infer<typeof payloadSchema>['step'],'CLAIM'>
export type ForecastWorkerTransaction=<T>(step:ForecastWorkerStep,args:unknown,work:(transaction:Prisma.TransactionClient)=>Promise<T>)=>Promise<T>
type Options={application:Application;binding:PlatformIngestionBinding;boundaryDigest:string;prisma:PrismaClient;auditPrisma:PrismaClient;
  workerId:string;mode:ForecastPreparationWorkerMode;now?:()=>number}
const query=(client:Pick<Prisma.TransactionClient,'$queryRawUnsafe'|'$executeRawUnsafe'>):AccessQuery=>async(sql,values=[])=>{
  if(/^\s*SELECT\b/i.test(sql))return {rows:await client.$queryRawUnsafe<Record<string,unknown>[]>(sql,...values)}
  if(!/^SET LOCAL\b/.test(sql))return fail()
  await client.$executeRawUnsafe(sql,...values);return{rows:[]}
}
const canonical=(value:object)=>JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)))

/** A composition of the ORIGINAL worker, queue and science. The shared source
 * host funds short real SQL transactions. No SQL transaction spans CPU work.
 * A committed claim remains spent after a crash; an uncertain claim replay
 * NEVER starts computation again. Original leases own recovery. */
export function createSg2ForecastSourceWorker(options:Options){
  const {prisma,auditPrisma,workerId,mode,now=Date.now}=options
  const application=structuredClone(options.application),binding=structuredClone(options.binding),digest=options.boundaryDigest
  if(!prisma||!auditPrisma||prisma===auditPrisma||!workerId||workerId.length>128||!/^[a-f0-9]{64}$/.test(digest)
    ||application.appId!=='spendguru-forecast-worker'||binding.applicationId!==application.appId
    ||!['CURRENT_ONLY','VERIFICATION_ONLY'].includes(mode))throw TypeError('Explicit native scientific worker identity required')
  const verify=async(tx:Prisma.TransactionClient)=>{
    const r=await tx.$queryRawUnsafe<Array<{d:Record<string,unknown>|null}>>('SELECT profitia_forecast_worker.runtime_descriptor() AS d')
    const d=r[0]?.d
    if(r.length!==1||!d||d.schemaVersion!=='1.0.0'||d.boundaryDigest!==digest||d.projectId!==binding.projectId
      ||d.branchId!==binding.branchId||d.databaseName!==binding.databaseName||d.role!==binding.role
      ||d.jobKind!==(mode==='CURRENT_ONLY'?'CURRENT':'VERIFICATION')||d.fencesInstalled!==true
      ||typeof d.expiresAt!=='string'||!(Date.parse(d.expiresAt)>now()))return fail()
  }
  const host=createPlatformIngestionHost<Prisma.TransactionClient>({application,binding,source:FORECAST_WORKER_SOURCE,now,
    independentQuery:query(auditPrisma),transact:(work,limits)=>prisma.$transaction(async tx=>{
      await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'UTC'")
      // Public ORM models are the ORIGINAL scientific persistence; source
      // history and capability ports use fully-qualified approved views.
      await tx.$executeRawUnsafe('SET LOCAL search_path=public,pg_catalog,pg_temp')
      return work({query:query(tx),transaction:tx})
    },{timeout:limits.timeoutMs,maxWait:limits.maxWaitMs}),validateSharedPayload:async(value,{transaction})=>{
      const p=payloadSchema.parse(value);await verify(transaction)
      return p.phase==='CLAIM'?p.step==='CLAIM'&&p.leaseOwnerToken===null:p.step!=='CLAIM'&&p.leaseOwnerToken!==null
    }})
  let active:ClaimedForecastPreparationJob|null=null,busy=false
  const transact:ForecastWorkerTransaction=async(step,args,work)=>{
    const job=active;if(!job)return fail()
    const payload=payloadSchema.parse({phase:'STEP',step,jobId:job.id,seriesId:job.seriesId,modelId:job.modelId,
      targetSemantics:job.targetSemantics,jobKind:job.jobKind,leaseVersion:job.leaseVersion,leaseOwnerToken:job.leaseOwnerToken,
      queueVersion:`${job.updatedAt.toISOString()}:${job.status}`,argumentsDigest:operationPayloadDigest(JSON.parse(JSON.stringify(args)))})
    let result:{value:Awaited<ReturnType<typeof work>>}|undefined
    await host.ingest({resourceId:job.seriesId,payload,idempotencyKey:`worker_step_${randomUUID()}`},async(_,tx,context)=>{
      await verify(tx)
      const bound=await tx.$queryRawUnsafe<Array<{bound:boolean}>>('SELECT profitia_forecast_worker.bind_effect($1::uuid,$2::uuid,$3) AS bound',
        context.platformReservation?.effectId,context.decisionId,canonical(payload))
      if(bound.length!==1||bound[0].bound!==true)return fail()
      result={value:await work(tx)}
    })
    if(!result)return fail();return result.value
  }
  const queueAt=async(tx:Prisma.TransactionClient,seriesId:string)=>{
    const {history}=await readStoredMarketHistory(tx,seriesId),policy=createStoredForecastReadinessPolicy(tx,history,seriesId)
    const check=(series:string)=>{if(series!==seriesId)return fail()}
    return createForecastPreparationQueueService({source:{transaction:tx,authority:{resolveInteractiveCapability:policy.capability,
      resolveExactCapability:policy.resolveExact,resolveHistoricalSeries:async(series,range)=>{check(series);if(range!=='ALL')return fail();return{history,marketDataSource:'postgres',cacheStatus:'hit'}},
      loadRollingHistory:async series=>{check(series);return{seriesId,displayName:history.displayName,description:history.displayName,frequency:history.frequency??'',source:history.source??null,points:history.historical}}}}})
  }
  type OriginalQueue=ReturnType<typeof createForecastPreparationQueueService>
  const withQueue=<T>(job:ClaimedForecastPreparationJob,args:unknown,work:(queue:OriginalQueue)=>Promise<T>)=>transact('QUEUE',args,async tx=>{
    if(job!==active)return fail()
    return work(await queueAt(tx,job.seriesId))
  })
  const queue={
    async claimNext(id:string,kinds:readonly ('CURRENT'|'VERIFICATION')[]=resolveForecastPreparationWorkerJobKinds(mode)):Promise<ClaimedForecastPreparationJob|null>{
      if(active||id!==workerId)return fail()
      const r=await auditPrisma.$queryRawUnsafe<Array<{candidate:unknown}>>('SELECT profitia_forecast_worker.peek($1::text[]) AS candidate',[...kinds])
      if(r.length!==1)return fail();if(r[0].candidate===null)return null
      const selected=candidate.parse(r[0].candidate)
      const payload=payloadSchema.parse({...selected,phase:'CLAIM',step:'CLAIM',leaseOwnerToken:null,argumentsDigest:operationPayloadDigest([...kinds])})
      let claimed:ClaimedForecastPreparationJob|null=null
      await host.ingest({resourceId:selected.seriesId,payload,idempotencyKey:`worker_claim_${operationPayloadDigest(selected)}`},async(_,tx,context)=>{
        await verify(tx)
        const bound=await tx.$queryRawUnsafe<Array<{bound:boolean}>>('SELECT profitia_forecast_worker.bind_effect($1::uuid,$2::uuid,$3) AS bound',
          context.platformReservation?.effectId,context.decisionId,canonical(payload))
        if(bound.length!==1||bound[0].bound!==true)return fail()
        claimed=await(await queueAt(tx,selected.seriesId)).claimNext(id,kinds,{jobId:selected.jobId,expectedLeaseVersion:selected.leaseVersion})
        if(claimed){
          const recorded=await tx.$queryRawUnsafe<Array<{recorded:boolean}>>('SELECT profitia_forecast_worker.record_start($1::uuid,$2) AS recorded',context.platformReservation?.effectId,claimed.id)
          if(recorded.length!==1||recorded[0].recorded!==true)return fail()
        }
      })
      // An SDK replay deliberately does not call its write callback. It cannot
      // create a fresh CPU permission from an old committed start receipt.
      active=claimed;return claimed
    },
    enqueue:async(...args:Parameters<OriginalQueue['enqueue']>)=>transact('QUEUE_CHILD',{command:args[0]},async tx=>{
      const job=active;if(!job||job.jobKind!=='CURRENT'||job.modelId!=='naive'||job.targetSemantics!=='ROLLING_DAILY_POINT_IN_TIME'
        ||args[0].seriesId!==job.seriesId||args[0].modelId!==job.modelId||args[0].targetSemantics!==job.targetSemantics
        ||args[0].kind!=='VERIFICATION'||args[1]?.calibrationOnly!==true)return fail()
      const result=await(await queueAt(tx,job.seriesId)).enqueue(...args)
      if(result.job){
        const recorded=await tx.$queryRawUnsafe<Array<{recorded:boolean}>>('SELECT profitia_forecast_worker.record_child((current_setting(\'profitia.forecast.worker_scope\')::jsonb->>0)::uuid,$1) AS recorded',result.job.jobKey)
        if(recorded.length!==1||recorded[0].recorded!==true)return fail()
      }return result
    }),
    snapshot:async()=>fail(),
    heartbeat:(job:ClaimedForecastPreparationJob)=>withQueue(job,{method:'heartbeat'},q=>q.heartbeat(job)),
    complete:async(job:ClaimedForecastPreparationJob,checkpoint?:Record<string,unknown>)=>{await science.settleLedger();return withQueue(job,{method:'complete',checkpoint},q=>q.complete(job,checkpoint))},
    completeUnavailable:(job:ClaimedForecastPreparationJob,reason:string)=>withQueue(job,{method:'completeUnavailable',reason},q=>q.completeUnavailable(job,reason)),
    checkpointInLease:(job:ClaimedForecastPreparationJob,checkpoint:Record<string,unknown>)=>withQueue(job,{method:'checkpointInLease',checkpoint},q=>q.checkpointInLease(job,checkpoint)),
    continueAfterSlice:(job:ClaimedForecastPreparationJob,checkpoint:Record<string,unknown>)=>withQueue(job,{method:'continueAfterSlice',checkpoint},q=>q.continueAfterSlice(job,checkpoint)),
    failOrRetry:(job:ClaimedForecastPreparationJob,error:unknown,checkpoint?:Record<string,unknown>)=>withQueue(job,{method:'failOrRetry',checkpoint},q=>q.failOrRetry(job,error,checkpoint)),
    shouldCompleteCalibrationOnly:(job:ClaimedForecastPreparationJob)=>withQueue(job,{method:'shouldCompleteCalibrationOnly'},q=>q.shouldCompleteCalibrationOnly(job)),
  }
  const science=createSg2StoredWorkerScience(transact,()=>active??fail())
  const worker=createForecastPreparationWorker({dependencyMode:'CLOSED_SOURCE',workerId,mode,queue,...science})
  return Object.freeze({workerId,mode,async runOne(){
    if(busy)throw TypeError('One original worker invocation at a time')
    busy=true;try{return await worker.runOne()}finally{try{await science.settleLedger()}finally{active=null;busy=false}}
  }})
}
