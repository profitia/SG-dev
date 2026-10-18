import type { ClaimedForecastPreparationJob } from './preparation-queue'
import type { ForecastWorkerTransaction } from './source-worker'
import { readStoredMarketHistory } from '@/lib/market-data/stored-read'
import { createStoredForecastCapabilityPolicy,createStoredRollingSnapshotReadPort } from './stored-readiness-read'
import { createForecastLibraryService,readCurrentRunFromPrisma,writeCurrentRunWithPrisma,readVerificationRunFromPrisma,writeVerificationRunWithPrisma,
  readLatestCurrentRunFromPrisma,readLatestVerificationRunFromPrisma,executePreparedForecastBridge,prepareForecastExecutionContext,
  type ForecastBridge,type ForecastLibraryRepository,type ForecastServiceRequest } from './service'
import { createDefaultForecastPreparationExecutionAdmission,createForecastPreparationExecutionLedger,createForecastPreparationPrismaLedgerStore,
  createForecastPreparationExecutionContextRegistry,persistForecastExecutionResourceSummary,type ForecastPreparationExecutionAdmission } from './execution-ledger'
import { buildLiveForecastBridgePayloadFromHistory } from './live-market-input'
import { createInteractiveForecastPreparationService } from './interactive-preparation'
import { createForecastProductionOperationsService } from './production-operations'
import { createRollingDailyProductionOperationsService } from './rolling-daily-production-operations'
import { createRollingDailyMaintenanceRepository,createRollingDailyMaintenanceRunner,createRollingDailyMaintenanceService } from './rolling-daily-maintenance'
import { createRollingDailyProductionForecastService,createRollingDailyCurrentForecastRunner,readCalibrationAuthorityWithPrisma } from './rolling-daily-production-forecast'
import { prepareRollingDailyCurrentOwnership } from './rolling-daily-current-ownership'
import { persistResolvedRollingDailyCurrentForecastSnapshot,readRollingDailyCurrentForecastSnapshotFromPort } from './rolling-daily-current-forecast-snapshot'
import { recordForecastArtifactReady } from './forecast-action-trace'
import { readStoredVerificationFromSource } from './stored-verification-read'
import { ensureHistoricalVerificationContract } from './historical-verification-policy'
import { forecastStressTelemetry } from './stress-telemetry'
import {createLegacyPrismaPreparedStatePort} from './prepared-state'

/** Child kernels receive no database, registry, identity or vendor credential.
 * Their JSON input is mandatory; the accepted bridge never needs a provider.
 * This finite wall timeout is NOT a billing meter or immediate revocation. */
export function storedForecastProcessOptions(env:Readonly<Record<string,string|undefined>>=process.env){
  const child:NodeJS.ProcessEnv={NODE_ENV:'production',PYTHONNOUSERSITE:'1',PYTHONUTF8:'1',OPENBLAS_NUM_THREADS:'1',OMP_NUM_THREADS:'1',MKL_NUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1',TZ:'UTC'}
  for(const key of ['PATH','LANG','LC_ALL','TMPDIR'])if(env[key])child[key]=env[key]
  return Object.freeze({env:Object.freeze(child),timeoutMs:120_000})
}

/** Complete native dependency graph. All repositories receive the genuine
 * transaction supplied by the shared source host. Kernels receive stored
 * history explicitly; none may hydrate a provider or open a global client. */
export function createSg2StoredWorkerScience(run:ForecastWorkerTransaction,currentJob:()=>ClaimedForecastPreparationJob){
  const processOptions=storedForecastProcessOptions()
  const assertSeries=(series:string)=>{if(series!==currentJob().seriesId)throw Error('Worker scientific source mismatch')}
  const history=async(seriesId:string)=>{assertSeries(seriesId);return run('READ',{seriesId},async tx=>(await readStoredMarketHistory(tx,seriesId)).history)}
  const rollingHistory=async(seriesId:string)=>{const h=await history(seriesId);return{seriesId,displayName:h.displayName,description:h.displayName,
    frequency:h.frequency??'',source:h.source??null,points:h.historical}}
  const policy=async<T>(seriesId:string,work:(p:ReturnType<typeof createStoredForecastCapabilityPolicy>)=>Promise<T>)=>{
    assertSeries(seriesId);return run('READ',{seriesId},async tx=>work(createStoredForecastCapabilityPolicy(tx,(await readStoredMarketHistory(tx,seriesId)).history,seriesId,createLegacyPrismaPreparedStatePort(tx))))
  }
  const admission:ForecastPreparationExecutionAdmission={leaseDurationMs:createDefaultForecastPreparationExecutionAdmission().leaseDurationMs,
    acquireExecution:input=>run('ADMISSION',{method:'acquireExecution',input},tx=>createDefaultForecastPreparationExecutionAdmission(tx).acquireExecution(input)),
    renewLease:input=>run('ADMISSION',{method:'renewLease',input},tx=>createDefaultForecastPreparationExecutionAdmission(tx).renewLease(input)),
    markExecutionCompleted:input=>run('ADMISSION',{method:'markExecutionCompleted',input},tx=>createDefaultForecastPreparationExecutionAdmission(tx).markExecutionCompleted(input)),
    markExecutionFailed:input=>run('ADMISSION',{method:'markExecutionFailed',input},tx=>createDefaultForecastPreparationExecutionAdmission(tx).markExecutionFailed(input)),
    readLatestExecutionForLogicalArtifact:key=>run('ADMISSION',{method:'readLatestExecutionForLogicalArtifact',key},tx=>createDefaultForecastPreparationExecutionAdmission(tx).readLatestExecutionForLogicalArtifact(key)),
  }
  const nativeLedger=createForecastPreparationExecutionLedger({store:{
    readExecution:id=>run('LEDGER',{read:id},tx=>createForecastPreparationPrismaLedgerStore(tx).readExecution(id)),
    writeExecution:value=>run('LEDGER',{write:value.executionId},tx=>createForecastPreparationPrismaLedgerStore(tx).writeExecution(value)),
    appendExecutionTelemetry:value=>run('LEDGER',{append:value.input.executionId},async tx=>{
      const store=createForecastPreparationPrismaLedgerStore(tx);if(!store.appendExecutionTelemetry)throw Error('Native telemetry store unavailable')
      return store.appendExecutionTelemetry(value)
    }),
  }})
  const pending=new Set<Promise<void>>()
  let ledgerFailure:unknown
  const ledger={
    recordEvent:(input:Parameters<typeof nativeLedger.recordEvent>[0])=>{
      const value=nativeLedger.recordEvent(input);pending.add(value)
      void value.then(()=>pending.delete(value),error=>{ledgerFailure=error;pending.delete(value)})
      return value
    },
    readExecution:nativeLedger.readExecution,
  }
  const settleLedger=async()=>{
    while(pending.size)await Promise.all([...pending])
    if(ledgerFailure){const error=ledgerFailure;ledgerFailure=undefined;throw error}
  }
  const repository:ForecastLibraryRepository={
    readCurrentRun:key=>run('READ',{key},tx=>readCurrentRunFromPrisma(key,{prisma:tx})),
    readVerificationRun:key=>run('READ',{key},tx=>readVerificationRunFromPrisma(key,{prisma:tx})),
    readLatestCurrentRun:key=>run('READ',{key},tx=>readLatestCurrentRunFromPrisma(key,{prisma:tx})),
    readLatestVerificationRun:key=>run('READ',{key},tx=>readLatestVerificationRunFromPrisma(key,{prisma:tx})),
    writeCurrentRun:(artifact,options)=>run('ARTIFACT',{artifact,options},tx=>writeCurrentRunWithPrisma(artifact,options,{transaction:tx})),
    writeVerificationRun:(artifact,options)=>run('ARTIFACT',{artifact,options},tx=>writeVerificationRunWithPrisma(artifact,options,{transaction:tx})),
  }
  const loadPayload=async(seriesId:string,options:Parameters<typeof buildLiveForecastBridgePayloadFromHistory>[2])=>
    buildLiveForecastBridgePayloadFromHistory(seriesId,await history(seriesId),options)
  const bridge:ForecastBridge={
    prepareExecutionContext:input=>prepareForecastExecutionContext(input,{loadPayload,processOptions}),
    exportHistory:async input=>executePreparedForecastBridge(await loadPayload(input.seriesId,{targetBasis:input.targetBasis,targetCadence:input.targetCadence,
      continuityPolicy:'ALLOW_GAPS'}),'history',input.seriesId,undefined,undefined,processOptions) as ReturnType<ForecastBridge['exportHistory']>,
    exportCurrent:async input=>executePreparedForecastBridge(await loadPayload(input.seriesId,{targetBasis:input.targetBasis,targetCadence:input.targetCadence,
      continuityPolicy:'ALLOW_GAPS'}),'current',input.seriesId,input.modelId,undefined,processOptions) as ReturnType<ForecastBridge['exportCurrent']>,
    exportVerification:async input=>executePreparedForecastBridge(await loadPayload(input.seriesId,{targetBasis:input.targetBasis,targetCadence:input.targetCadence,
      continuityPolicy:'ALLOW_GAPS'}),'verification',input.seriesId,input.modelId,input,processOptions) as ReturnType<ForecastBridge['exportVerification']>,
  }
  const library=createForecastLibraryService({repository,bridge,executionAdmission:admission,executionLedger:ledger,
    executionContextRegistry:createForecastPreparationExecutionContextRegistry(),telemetry:forecastStressTelemetry,
    logEvent:(event,data)=>console.info('[forecast-source-science]',event,data),executePreparedCurrent:(payload,mode,seriesId,modelId,options)=>executePreparedForecastBridge(payload,mode,seriesId,modelId,options,processOptions),
    resolveExactPreparedCapability:input=>policy(input.seriesId,p=>p.resolveExact(input))})
  const maintenanceRepository={
    readState:(...args:Parameters<ReturnType<typeof createRollingDailyMaintenanceRepository>['readState']>)=>run('READ',{args},tx=>createRollingDailyMaintenanceRepository(tx).readState(...args)),
    listVerificationRecords:(...args:Parameters<ReturnType<typeof createRollingDailyMaintenanceRepository>['listVerificationRecords']>)=>run('READ',{args},tx=>createRollingDailyMaintenanceRepository(tx).listVerificationRecords(...args)),
    applyMaintenanceUpdate:(...args:Parameters<ReturnType<typeof createRollingDailyMaintenanceRepository>['applyMaintenanceUpdate']>)=>run('ARTIFACT',{args},tx=>createRollingDailyMaintenanceRepository(tx).applyMaintenanceUpdate(...args)),
    recordMaintenanceFailure:(...args:Parameters<ReturnType<typeof createRollingDailyMaintenanceRepository>['recordMaintenanceFailure']>)=>run('ARTIFACT',{args},tx=>createRollingDailyMaintenanceRepository(tx).recordMaintenanceFailure(...args)),
  }
  const maintenance=createRollingDailyMaintenanceService({repository:maintenanceRepository,runner:createRollingDailyMaintenanceRunner(processOptions),loadHistory:rollingHistory,
    executionAdmission:admission,executionLedger:ledger,now:()=>new Date(),logEvent:(event,data)=>console.info('[forecast-source-maintenance]',event,data)})
  const rolling=createRollingDailyProductionForecastService({repository:{readCalibrationAuthority:identity=>run('READ',{identity},tx=>readCalibrationAuthorityWithPrisma(identity,tx))},
    runner:createRollingDailyCurrentForecastRunner(processOptions),loadBenchmarkContext:async seriesId=>{
      const h=await history(seriesId),points=h.historical.filter(p=>p.value!==null),latest=points.at(-1)
      return{benchmark:{benchmarkId:seriesId,displayName:h.displayName,frequency:'DAILY',unit:h.unit,currency:h.currency,
        provider:h.providerSeries.provider.providerCode,providerSeriesId:seriesId},history:await rollingHistory(seriesId),
        sourceLatestObservationDate:latest?.date.slice(0,10)??null,sourceLatestObservationValue:latest?.value??null}
    },now:()=>new Date()})
  const readSnapshot=(input:Parameters<typeof readRollingDailyCurrentForecastSnapshotFromPort>[0])=>run('READ',{input},tx=>readRollingDailyCurrentForecastSnapshotFromPort(input,createStoredRollingSnapshotReadPort(tx)))
  const rollingOperations=createRollingDailyProductionOperationsService({runMaintenance:input=>maintenance.runIncrementalMaintenance(input),
    runRecentMaintenance:input=>maintenance.runRecentVerification(input),resolveCurrentForecast:input=>rolling.getRollingDailyProductionForecast(input),
    persistSnapshot:(input,result,options)=>run('ARTIFACT',{input,result,options},tx=>persistResolvedRollingDailyCurrentForecastSnapshot(input,result,{prisma:tx},options)),
    readSnapshot,logEvent:(event,data)=>console.info('[forecast-source-rolling]',event,data)})
  const verification=(scope:'FAST'|'FULL'|'RECENT')=>async(input:ForecastServiceRequest)=>run('READ',{input,scope},async tx=>{
    assertSeries(input.seriesId);return ensureHistoricalVerificationContract(await readStoredVerificationFromSource(tx,(await readStoredMarketHistory(tx,input.seriesId)).history,{seriesId:input.seriesId,modelId:input.modelId as 'naive'|'damped_holt'|'ets'|'arima',targetBasis:input.targetBasis,verificationScope:scope,
      ...(input.sourceFrequency?{sourceFrequency:input.sourceFrequency,targetCadence:input.targetCadence}:{})}))
  })
  const preparation=createInteractiveForecastPreparationService({resolveExactCapability:input=>policy(input.seriesId,p=>p.resolveExact(input)),
    resolveCapabilitiesBySeriesId:seriesId=>policy(seriesId,async p=>(await p.resolveExact({seriesId,modelId:currentJob().modelId as 'naive'|'damped_holt'|'ets'|'arima',
      targetSemantics:currentJob().targetSemantics as 'END_OF_PERIOD'|'MONTHLY_AVERAGE'|'ROLLING_DAILY_POINT_IN_TIME'})).resolution),
    prepareMonthlyCurrent:input=>library.resolveCurrentForecastRequest(input),prepareRollingCurrent:input=>rollingOperations.runCurrentOnly(input),
    prepareRollingDailyOwnership:input=>prepareRollingDailyCurrentOwnership({...input,loadHistory:rollingHistory}),readRollingCurrentSnapshot:readSnapshot,
    readPreparedCurrent:input=>library.readPreparedCurrentForecastRequest(input),readPreparedFullVerification:verification('FULL'),readPreparedFastVerification:verification('FAST'),
    readPreparedRecentVerification:verification('RECENT'),readPreparedRollingDailyFullVerification:verification('FULL'),readPreparedRollingDailyFastVerification:verification('FAST'),
    executionAdmission:admission,now:()=>performance.now()})
  const production=createForecastProductionOperationsService({resolveCapabilities:seriesId=>policy(seriesId,async p=>(await p.resolveExact({seriesId,
      modelId:currentJob().modelId as 'naive'|'damped_holt'|'ets'|'arima',targetSemantics:currentJob().targetSemantics as 'END_OF_PERIOD'|'MONTHLY_AVERAGE'|'ROLLING_DAILY_POINT_IN_TIME'})).resolution),
    prepareMonthlyCurrent:input=>library.resolveCurrentForecastRequest(input),prepareMonthlyHistorical:async input=>ensureHistoricalVerificationContract(await library.resolveVerificationRequest(input)),
    prepareMonthlyRecentVerification:async input=>ensureHistoricalVerificationContract(await library.resolveRecentVerificationRequest(input)),runRollingDaily:input=>rollingOperations.run(input)})
  return {
    settleLedger,
    prepareCurrent:preparation.prepareCurrent,
    prepareVerificationSlice:async(job:ClaimedForecastPreparationJob,slice:{maxOriginsPerRun:number})=>{
      const result=await production.run({seriesId:job.seriesId,targetSemantics:[job.targetSemantics as 'END_OF_PERIOD'|'MONTHLY_AVERAGE'|'ROLLING_DAILY_POINT_IN_TIME'],
        modelIds:[job.modelId as 'naive'|'damped_holt'|'ets'|'arima'],prepareHistorical:true,verificationScope:'FULL',maxOriginsPerRun:slice.maxOriginsPerRun,
        rollingDailySnapshotRefreshMode:'WHEN_REQUIRED'})
      if(result.status==='FAILED')throw Error(result.results[0]?.error??'Stored verification failed');return result
    },
    resolveReadiness:preparation.capability,
    refreshCurrentAfterCalibration:async(job:ClaimedForecastPreparationJob)=>rollingOperations.runCurrentOnly({seriesId:job.seriesId,
      modelIds:[job.modelId as 'naive'|'damped_holt'|'ets'|'arima'],forceSnapshotRefresh:true}),
    recordArtifactReady:(jobKey:string,kind:'CURRENT'|'VERIFICATION',observedAt?:Date)=>run('TELEMETRY',{jobKey,kind},tx=>recordForecastArtifactReady(jobKey,kind,observedAt,tx)),
    persistResourceSummary:(correlationId:string,summary:Parameters<typeof persistForecastExecutionResourceSummary>[1])=>run('TELEMETRY',{correlationId},tx=>persistForecastExecutionResourceSummary(correlationId,summary,tx)),
  }
}
