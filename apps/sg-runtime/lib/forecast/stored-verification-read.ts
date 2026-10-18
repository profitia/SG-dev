import type { PrismaClient, Prisma } from '@/generated/market-data-client'
import type { BenchmarkHistoricalSeriesResult } from '@/lib/benchmark/contracts'
import { BenchmarkAppError } from '@/lib/benchmark/errors'
import { createForecastCadence, normalizeForecastSourceFrequency } from './cadence'
import { resolveForecastCapabilities } from './capability-resolver'
import { buildLiveForecastBridgePayloadFromHistory } from './live-market-input'
import { buildForecastHistoryFingerprint, createForecastLibraryService, readVerificationRunFromPrisma, readLatestVerificationRunFromPrisma } from './service'
import { resolvePreparedForecastVerification } from './route-handlers'
import { createPreparedRollingDailyForecastVerificationReader, createPreparedRollingDailyFastForecastVerificationReader, createPreparedRollingDailyRecentForecastVerificationReader } from './rolling-daily-verification'
import { createStoredForecastSourceReader, type StoredForecastBinding } from './stored-current-read'
import { ForecastVerificationSelection, forecastVerificationUnavailable, validatePublicForecastVerification,
  type ForecastVerificationSelectionValue, type PublicForecastVerificationResult } from '@/lib/platform/forecast-verification'

/** Existing business dispatcher/readers, explicit source transaction and full
 * canonical Verification history. This is not an estimator or a job producer. */
async function readPrepared(
  transaction: Prisma.TransactionClient, history: BenchmarkHistoricalSeriesResult, selection: ForecastVerificationSelectionValue,
) {
  const sourceFrequency=normalizeForecastSourceFrequency(history.frequency)
  const targetSemantics=selection.targetBasis==='POINT_IN_TIME'?'ROLLING_DAILY_POINT_IN_TIME':selection.targetBasis
  const capability=resolveForecastCapabilities({seriesId:selection.seriesId,sourceFrequency,
    sourceObservationCount:history.historical.filter(point=>point.value!==null&&Number.isFinite(point.value)).length,
    preparedObservationCounts:{},provenance:[],preparedVariants:[]})
    .find(item=>item.identity.modelId===selection.modelId&&item.identity.targetSemantics===targetSemantics)
  if(!sourceFrequency||!capability?.targetCadence||capability.admissionState!=='ADMITTED'||capability.implementationState!=='SUPPORTED'
    ||selection.sourceFrequency&&(selection.sourceFrequency!==sourceFrequency||selection.targetCadence!==capability.targetCadence))return forecastVerificationUnavailable(selection)

  // Metadata describes an actual hit in the approved stored source. The old
  // readers consume only history; no provider freshness or hydration is claimed.
  const resolveHistory: NonNullable<Parameters<typeof createPreparedRollingDailyForecastVerificationReader>[0]>['resolveHistory']=async(seriesId,range)=>{
    if(seriesId!==selection.seriesId||range!=='ALL')throw new Error('Stored history scope mismatch')
    return {history,marketDataSource:'postgres',cacheStatus:'hit'}
  }
  const rollingDependencies={prisma:transaction,resolveHistory}
  const rollingFull=createPreparedRollingDailyForecastVerificationReader(rollingDependencies)
  const rollingFast=createPreparedRollingDailyFastForecastVerificationReader(rollingDependencies)
  const rollingRecent=createPreparedRollingDailyRecentForecastVerificationReader(rollingDependencies)
  if(selection.targetBasis==='POINT_IN_TIME'){
    if(sourceFrequency!=='DAILY')return forecastVerificationUnavailable(selection)
    return resolvePreparedForecastVerification(selection,{
      readRecentVerification:rollingRecent,readFastVerification:rollingFast,readRollingDailyVerification:rollingFull,
      readGenericPeriodVerification:async()=>{throw new Error('Period reader cannot serve a Rolling selection')},
    })
  }

  let payload
  try{
    payload=buildLiveForecastBridgePayloadFromHistory(selection.seriesId,history,{targetBasis:selection.targetBasis,
      targetCadence:capability.targetCadence,continuityPolicy:capability.targetCadence==='MONTHLY'?'ALLOW_GAPS':'REQUIRE_FULL'})
  }catch{return forecastVerificationUnavailable(selection)}
  // FULL history is intentional. Current's minimal training suffix cannot be
  // substituted for a Verification history fingerprint or an origin policy.
  const expectedHistoryFingerprint=buildForecastHistoryFingerprint(payload.history,createForecastCadence(sourceFrequency,capability.targetCadence))
  const authority={seriesId:selection.seriesId,modelId:selection.modelId,targetBasis:selection.targetBasis,sourceFrequency,
    targetCadence:capability.targetCadence,expectedHistoryFingerprint}
  const refuse=async():Promise<never>=>{throw new Error('Stored Verification cannot use an execution or source-mutation port')}
  const service=createForecastLibraryService({repository:{readCurrentRun:refuse,writeCurrentRun:refuse,writeVerificationRun:refuse,
    readVerificationRun:key=>readVerificationRunFromPrisma(key,{prisma:transaction}),
    readLatestVerificationRun:key=>readLatestVerificationRunFromPrisma(key,{prisma:transaction})},
    bridge:{exportHistory:refuse,exportCurrent:refuse,exportVerification:refuse},resolveExactPreparedCapability:refuse,executePreparedCurrent:refuse,
    executionLedger:{recordEvent:refuse,readExecution:refuse},
  })
  const request=(input:Parameters<typeof service.readPreparedVerificationRequest>[0])=>({...input,sourceFrequency,targetCadence:capability.targetCadence!,preparedReadAuthority:authority})
  return resolvePreparedForecastVerification(selection,{
    readRecentVerification:input=>service.readPreparedRecentVerificationRequest(request(input)),
    readFastVerification:input=>service.readPreparedVerificationRequest(request(input)),
    readGenericPeriodVerification:input=>service.readPreparedVerificationRequest(request(input)),readRollingDailyVerification:refuse,
  })
}

export function createStoredForecastVerificationReader(prisma:Pick<PrismaClient,'$transaction'>,binding:StoredForecastBinding){
  const readSource=createStoredForecastSourceReader(prisma,binding)
  return async(value:ForecastVerificationSelectionValue):Promise<PublicForecastVerificationResult>=>{
    const parsed=ForecastVerificationSelection.safeParse(value)
    if(!parsed.success)throw new BenchmarkAppError('VALIDATION_ERROR','Invalid stored verification selection.',400)
    const selection=parsed.data
    return readSource(selection.seriesId,async(transaction,history)=>{
      if(!history)return forecastVerificationUnavailable(selection)
      const result=await readPrepared(transaction,history,selection)
      if(result.status!=='AVAILABLE')return forecastVerificationUnavailable(selection)
      return validatePublicForecastVerification(result,selection)
    })
  }
}
