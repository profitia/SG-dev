import { z } from 'zod'
import { OperationDenied, operationPayloadDigest } from '@profitia/platform-contracts/operation-context'
import { FORECAST_NATIVE_FREQUENCIES } from '@/lib/forecast/cadence'
import { resolveForecastMethodContract, createFullVerificationStatisticalCompatibility, createRecentVerificationStatisticalCompatibility } from '@/lib/forecast/identity'
import { createUnavailableHistoricalVerificationSummary } from '@/lib/forecast/historical-verification-policy'
import { attachExactUncertaintyBandIdentity } from '@/lib/forecast/uncertainty-band-policy'
import { ForecastCurrentSelection, hasPublicForecastModelParameters } from './forecast-current'
import { hasPublicPeriodVariant } from './period-forecast-current'

export const FORECAST_VERIFICATION_PROJECTION = 'sg2-stored-verification-v1'
export const MAX_FORECAST_VERIFICATION_BYTES = 8 * 1024 * 1024
const model = z.enum(['naive','damped_holt','ets','arima'])
const basis = z.enum(['MONTHLY_AVERAGE','END_OF_PERIOD','POINT_IN_TIME'])
const semantics = z.enum(['MONTHLY_AVERAGE','END_OF_PERIOD','ROLLING_DAILY_POINT_IN_TIME'])
const method = z.enum(['MONTHLY_AVERAGE','END_OF_PERIOD','ROLLING_DAILY_POINT_IN_TIME'])
const frequency = z.enum(FORECAST_NATIVE_FREQUENCIES)
const finite = z.number().finite(), count = finite.int().nonnegative()
const instant = z.string().datetime({offset:true})
const failureDate = z.union([instant,z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)))])
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const horizonLabel = /^[1-9][0-9]{0,2}[MDQWY]$/

/** Reuse the Current selection's exact common validators. The additional scope
 * is explicit in both payload and resource identity; legacy default is FAST. */
export const ForecastVerificationSelection = z.object({
  seriesId:z.unknown(),modelId:z.unknown(),targetBasis:z.unknown(),
  verificationScope:z.enum(['FAST','FULL','RECENT']).default('FAST'),
  sourceFrequency:z.unknown().optional(),targetCadence:z.unknown().optional(),
}).strict().transform(({verificationScope,...selection},context)=>{
  const parsed=ForecastCurrentSelection.safeParse(selection)
  if(!parsed.success){context.addIssue({code:z.ZodIssueCode.custom,message:'Invalid forecast selection.'});return z.NEVER}
  return {...parsed.data,verificationScope}
})
export type ForecastVerificationSelectionValue=z.infer<typeof ForecastVerificationSelection>
export function readForecastVerificationSelection(value:unknown):ForecastVerificationSelectionValue {
  const parsed=ForecastVerificationSelection.safeParse(value)
  if(!parsed.success)throw new OperationDenied('CONTEXT_INVALID')
  return parsed.data
}
export const forecastVerificationResourceId=(selection:ForecastVerificationSelectionValue)=>
  `forecast-verification:${selection.seriesId}:${selection.modelId}:${selection.targetBasis}:${selection.verificationScope}`
    +(selection.sourceFrequency?`:${selection.sourceFrequency}:${selection.targetCadence}`:'')

const bandIdentity=z.object({
  forecastIdentity:z.object({seriesId:z.string(),modelId:model,targetSemantics:semantics,methodId:method,methodVersion:z.string()}).strict(),
  inputSource:z.literal('DYNAMIC_MARKET_DATA_STORE'),sourceFrequency:frequency,targetCadence:frequency,horizonLabel:z.string().regex(horizonLabel),
  horizonSteps:finite.int().positive().max(10000),targetDate:instant,sourceHistoryFingerprint:hash,
  trainingWindowPolicyId:z.string().max(512),effectiveTrainingPolicyId:z.string().max(512),
  bandPolicyVersion:z.literal('ADAPTIVE_UNCERTAINTY_BANDS_V1'),bandSource:z.enum(['EMPIRICAL_EXACT_RESIDUALS','MODEL_NATIVE_SHORT_HISTORY']).nullable(),
  calibrationMethod:z.string().max(128),calibrationVersion:z.string().max(128),calibrationCutoff:instant.nullable(),
}).strict()
const band=z.object({
  status:z.enum(['AVAILABLE','NOT_AVAILABLE']),source:z.enum(['EMPIRICAL_EXACT_RESIDUALS','MODEL_NATIVE_SHORT_HISTORY']).nullable(),
  policyVersion:z.literal('ADAPTIVE_UNCERTAINTY_BANDS_V1'),coverage:z.literal(0.8),lower:finite.nullable(),upper:finite.nullable(),sampleCount:count,
  calibrationStatus:z.enum(['CALIBRATED','INSUFFICIENT_SAMPLE','NOT_AVAILABLE']),
  calibrationMethod:z.enum(['EMPIRICAL_RESIDUAL_QUANTILES_HF7','NAIVE_RANDOM_WALK_INNOVATION_RMS_NORMAL','STATSMODELS_ETS_SIMULATION','STATSMODELS_DAMPED_HOLT_SIMULATION']).nullable(),
  calibrationVersion:z.enum(['empirical-exact-residual-quantiles-v1','naive-random-walk-innovation-rms-normal-v1','statsmodels-ets-simulation-seed-1729-r1000-v1','statsmodels-damped-holt-simulation-seed-1729-r1000-v1']).nullable(),
  reasonCode:z.enum(['INSUFFICIENT_EXACT_RESIDUALS','INSUFFICIENT_BAND_HISTORY','NON_FINITE_MODEL_NATIVE_SCALE','MODEL_NATIVE_INTERVAL_FAILED']).nullable(),identity:bandIdentity.optional(),
}).strict()
const metadata=z.object({modelFamily:model,selectedVariant:z.string().max(64),selectedParameters:z.record(z.unknown()),selectionScore:finite.nullable(),
  selectionMetric:z.literal('AICc').nullable(),fitStatus:z.enum(['SUCCEEDED','FAILED']),failureReason:z.null(),uncertaintyBand:band.nullable().optional(),
  verificationIdentityVersion:z.literal('ROLLING_DAILY_VERIFICATION_IDENTITY_V2').optional(),trainingHistoryFingerprint:hash.optional(),
}).strict().refine(value=>(value.verificationIdentityVersion===undefined)===(value.trainingHistoryFingerprint===undefined))
const metrics=z.object({mae:finite.nullable(),rmse:finite.nullable(),mase:finite.nullable(),smape:finite.nullable(),directionalAccuracy:finite.nullable(),bias:finite.nullable()}).strict()
const record=z.object({benchmarkId:z.string(),modelId:model,forecastOrigin:instant,horizon:z.string().regex(horizonLabel),horizonSteps:finite.int().positive().max(10000),
  forecastDate:instant,actualObservedAt:instant.nullable(),originValue:finite,forecastValue:finite,actualValue:finite,error:finite,absoluteError:finite,
  delta:finite,deltaPct:finite.nullable(),maseScale:finite,metadata:metadata.nullable()}).strict()
const failure=z.object({benchmarkId:z.string(),modelId:model,forecastOrigin:failureDate,horizon:z.string().regex(horizonLabel),
  horizonSteps:finite.int().positive().max(10000),forecastDate:failureDate,failureReason:z.literal('FORECAST_FIT_FAILED')}).strict()
const quality=z.object({policyVersion:z.literal('FORECAST_VERIFICATION_QUALITY_V1'),averageVerificationPercent:finite.nullable(),directionalAccuracyPercent:finite.nullable(),
  confidenceCode:z.enum(['LIMITED','MODERATE','SUFFICIENT','UNAVAILABLE']),confidenceLevel:z.union([z.literal(1),z.literal(2),z.literal(3)]).nullable(),
  comparableOriginCount:count,requiredOriginCount:count,sampleCompletenessPercent:finite}).strict()
const horizon=z.object({horizon:z.string().regex(horizonLabel),horizonSteps:finite.int().positive().max(10000),origins:count,expectedOrigins:count,successfulOrigins:count,
  failedOrigins:count,pendingOrigins:count.optional(),coverage:finite,metrics:metrics.nullable(),quality:quality.optional(),records:z.array(record).max(20000),failures:z.array(failure).max(20000)}).strict()
const historicalHorizon=z.object({status:z.enum(['AVAILABLE','LIMITED_SAMPLE','INSUFFICIENT_HISTORY','FAILED']),originCount:count,expectedOriginCount:count,failedOriginCount:count,
  pendingOriginCount:count,minimumOriginCount:count,coverage:finite,warningCode:z.enum(['SMALL_SAMPLE','NO_LAWFUL_OUT_OF_SAMPLE_ORIGIN','ALL_ORIGINS_FAILED']).nullable()}).strict()
const historical=z.object({contractVersion:z.literal('HISTORICAL_VERIFICATION_V2'),preparationState:z.enum(['FAST_READY','FULL_READY']).nullable(),fullHistoryReady:z.boolean(),
  status:z.enum(['AVAILABLE','LIMITED_SAMPLE','INSUFFICIENT_HISTORY','NOT_PREPARED','FAILED']),originCount:count,expectedOriginCount:count,failedOriginCount:count,pendingOriginCount:count,
  coverage:finite,horizons:z.record(historicalHorizon)}).strict()
const statistical=z.object({artifactScope:z.enum(['FULL_VERIFICATION','RECENT_VERIFICATION']),trainingWindowPolicyId:z.string().max(512),effectiveTrainingPolicyId:z.string().max(512),
  calibrationPolicy:z.literal('EXACT_STATISTICAL_MATCH_ONLY')}).strict()
const available=z.object({status:z.literal('AVAILABLE'),seriesId:z.string(),modelId:model,targetBasis:basis,targetSemantics:semantics,methodId:method,methodVersion:z.string(),
  userFacingModel:z.literal(true),displayName:z.string().max(2048),description:z.string().max(2048).nullable(),source:z.object({kind:z.literal('DYNAMIC_MARKET_DATA_STORE'),runId:z.null()}).strict(),
  lineage:z.object({inputSource:z.literal('DYNAMIC_MARKET_DATA_STORE'),inputRunId:z.null(),sourceSeriesId:z.string(),sourceFrequency:frequency,historyFingerprint:hash,preparation:z.null(),statisticalCompatibility:statistical}).strict(),
  historyFingerprint:hash,history:z.object({frequency,start:instant.nullable(),end:instant.nullable(),observations:count}).strict(),forecastOrigin:instant.nullable(),runtimeSeconds:finite.nonnegative().nullable(),
  cacheStatus:z.literal('hit'),verification:z.record(horizon),historicalVerification:historical}).strict()
const reason='PREPARATION_REQUIRED: Exact stored Historical Verification unavailable.' as const
const missing=z.object({status:z.literal('NOT_AVAILABLE'),seriesId:z.string(),modelId:model,targetBasis:basis,targetSemantics:semantics,methodId:method,reason:z.literal(reason),historicalVerification:historical}).strict()
export type PublicForecastVerificationResult=z.infer<typeof available>|z.infer<typeof missing>
export function forecastVerificationUnavailable(selection:ForecastVerificationSelectionValue):z.infer<typeof missing> {
  const contract=resolveForecastMethodContract(selection.targetBasis)
  return {status:'NOT_AVAILABLE',seriesId:selection.seriesId,modelId:selection.modelId,targetBasis:selection.targetBasis,targetSemantics:contract.targetSemantics,
    methodId:contract.methodId,reason,historicalVerification:createUnavailableHistoricalVerificationSummary('NOT_PREPARED')}
}
const digest=(value:unknown)=>operationPayloadDigest(JSON.parse(JSON.stringify(value)))
export function validatePublicForecastVerification(value:unknown,selection:ForecastVerificationSelectionValue):PublicForecastVerificationResult {
  const noData=missing.safeParse(value)
  if(noData.success){if(digest(noData.data)!==digest(forecastVerificationUnavailable(selection)))throw new OperationDenied('RESOURCE_SCOPE_MISMATCH');return noData.data}
  const parsed=available.safeParse(value)
  if(!parsed.success)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const data=parsed.data,contract=resolveForecastMethodContract(selection.targetBasis)
  const expected=(selection.verificationScope==='RECENT'?createRecentVerificationStatisticalCompatibility:createFullVerificationStatisticalCompatibility)({
    sourceFrequency:data.lineage.sourceFrequency,targetCadence:data.history.frequency,targetSemantics:contract.targetSemantics})
  if(data.seriesId!==selection.seriesId||data.modelId!==selection.modelId||data.targetBasis!==selection.targetBasis||data.targetSemantics!==contract.targetSemantics
    ||data.methodId!==contract.methodId||data.methodVersion!==contract.methodVersion||data.lineage.sourceSeriesId!==selection.seriesId
    ||data.historyFingerprint!==data.lineage.historyFingerprint||digest(expected)!==digest(data.lineage.statisticalCompatibility)
    ||selection.sourceFrequency&&(data.lineage.sourceFrequency!==selection.sourceFrequency||data.history.frequency!==selection.targetCadence)
    ||Object.keys(data.verification).length===0||Object.keys(data.verification).length>512||Object.keys(data.historicalVerification.horizons).some(key=>!horizonLabel.test(key))
    ||digest(data)!==digest(value))throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  let records=0
  for(const [label,item] of Object.entries(data.verification)){
    if(!horizonLabel.test(label)||item.horizon!==label)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
    records+=item.records.length+item.failures.length
    for(const point of [...item.records,...item.failures])if(point.benchmarkId!==data.seriesId||point.modelId!==data.modelId||point.horizon!==label)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
    // Rolling calendar horizons may have different step counts at each origin.
    for(const point of item.records){
      const meta=point.metadata
      if(meta&&(meta.modelFamily!==data.modelId||!hasPublicPeriodVariant(data.modelId,meta.selectedVariant)||!hasPublicForecastModelParameters(meta.selectedParameters)))throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
      if(meta?.uncertaintyBand){
        if(data.targetBasis==='POINT_IN_TIME')throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
        try {
        const derived=attachExactUncertaintyBandIdentity({seriesId:data.seriesId,modelId:data.modelId,targetBasis:data.targetBasis,methodVersion:data.methodVersion,
          inputSource:data.source.kind,sourceFrequency:data.lineage.sourceFrequency,targetCadence:data.history.frequency,sourceHistoryFingerprint:data.historyFingerprint,
          trainingWindowPolicyId:expected.trainingWindowPolicyId,effectiveTrainingPolicyId:expected.effectiveTrainingPolicyId,forecastOrigin:point.forecastOrigin},
        {...point,failureReason:null,metadata:{...meta,uncertaintyBand:{...meta.uncertaintyBand,identity:undefined}}})
        if(meta.uncertaintyBand.identity&&digest(meta.uncertaintyBand.identity)!==digest(derived.metadata?.uncertaintyBand?.identity))throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
        } catch { throw new OperationDenied('RESOURCE_SCOPE_MISMATCH') }
        // Return the original safe object. Validation never publishes the derived
        // identity when its producer did not persist one.
      }
    }
  }
  if(records>20000)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  return data
}
export async function projectForecastVerificationResponse(value:unknown,context:{payload?:unknown;resource:{id:string}}):Promise<Response> {
  const selection=readForecastVerificationSelection(context.payload)
  if(!(value instanceof Response)||!value.ok||context.resource.id!==forecastVerificationResourceId(selection))throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  const text=await value.clone().text()
  if(Buffer.byteLength(text)>MAX_FORECAST_VERIFICATION_BYTES)throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')
  let body:unknown
  try{body=JSON.parse(text)}catch{throw new OperationDenied('RESOURCE_SCOPE_MISMATCH')}
  validatePublicForecastVerification(body,selection)
  return value
}
