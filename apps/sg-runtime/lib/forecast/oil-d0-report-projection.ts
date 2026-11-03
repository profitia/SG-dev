import {createHash} from 'node:crypto'

export const FROZEN_OIL_D0_SHA256='ec11c696cdd4e9577c462fdadf45953aba57bb76d7281bf034363513dbde006b'
export const OIL_D0_CONTENT_FINGERPRINT='9b62e1e8ec6a04f4731a28993de3fcd4703d63d3d8783255cbc3fdd0e913e8ec'
export const FROZEN_OIL_LAST_CASE_SHA256='251b521a3fa71441eab299e946f0fb7ab706027d85a23c234cade92830944da7'
export const OIL_MODELS=['naive','damped_holt','ets','arima'] as const
export type OilModel=typeof OIL_MODELS[number]
export interface D0Point {forecast:{identity:{seriesId:string;modelId:string;originDate:string;targetDate:string};forecastValue:number;originValue:number};verification:{actualValue:number;verificationObservationDate:string;targetDate:string}}
export interface D0Model {current:{identity:{seriesId:string;modelId:string;originDate:string;targetDate:string;horizon:string;methodVersion:string;engineFingerprint:string;sourceCutoffFingerprint:string;trainingFingerprint:string};forecastValue:number;originValue:number;unit:string;bands:{status:string;lower:null;upper:null}};verification:{maturedSampleCount:number;metrics:{smape:number;directional_accuracy:number};records:D0Point[]}}
export interface D0Series {seriesId:string;provider:string;storedDescription:string;unit:string;currency:string;sourceFingerprint:string;quality:{lastLawfulObservation:string;lastLawfulValue:number};modelResults:Record<OilModel,D0Model>}
export interface D0Document {schemaVersion:string;status:string;asOf:string;series:D0Series[]}
export interface OilModelProjection {id:OilModel;point:number;delta:number;deltaPercent:number|null;sampleSize:number;smape:number;historicalAverageVerificationPercent:number;directionalAccuracyPercent:number;lastMatured:{origin:string;target:string;predicted:number;actual:number;verificationPercent?:number};intervals:'NOT_AVAILABLE';lineage:{methodVersion:string;engineFingerprint:string;sourceCutoffFingerprint:string;trainingFingerprint:string}}
export interface OilProjection {schemaVersion:'OilD0ReportProjection/1';inputSha256:string;contentFingerprint:string;status:'EXPERIMENTAL_7D/PARTIAL_READY';origin:'2026-10-30';target:'2026-11-06';comparisonCount:number;series:{id:string;name:string;identity:string;provider:string;unit:string;currency:string;sourceFingerprint:string;actual:number;observationDate:string;previousWeekValue:number;weekChange:number;weekChangePercent:number|null;models:OilModelProjection[]}[];limitations:readonly string[]}
const finite=(v:number)=>{if(!Number.isFinite(v))throw Error('D0_NUMBER_INVALID');return v}
const plus7=(d:string)=>new Date(Date.parse(d+'T00:00:00Z')+7*86400000).toISOString().slice(0,10)
const close=(a:number,b:number)=>Math.abs(a-b)<=1e-8
const frozenProjections=new WeakSet<object>()
export function assertFrozenOilProjection(value:OilProjection){if(!frozenProjections.has(value))throw Error('FROZEN_D0_PROJECTION_UNVERIFIED')}
/** Pure DTO projection, never fits a model. The byte-identity boundary below is
 * mandatory for the actual pilot; this document helper also accepts test data. */
export function projectOilD0Document(doc:D0Document,inputSha256:string):OilProjection {
 if(doc.schemaVersion!=='oil-d0-7calendar-day-experiment-v1'||doc.status!=='PARTIAL_READY'||doc.asOf!=='2026-11-02'
  ||doc.series.length!==2||new Set(doc.series.map(s=>s.seriesId)).size!==2)throw Error('D0_DOCUMENT_INVALID')
 let comparisonCount=0
 const series=['cl_c1_cl','b_c1_cl'].map(id=>{
  const s=doc.series.find(x=>x.seriesId===id)
  if(!s||s.provider!=='MACROBOND'||s.unit!=='USD/Barrel'||s.currency!=='USD'||s.quality.lastLawfulObservation!=='2026-10-30')throw Error('D0_SERIES_INVALID')
  const actual=finite(s.quality.lastLawfulValue)
  const models=OIL_MODELS.map(modelId=>{
   const m=s.modelResults[modelId],c=m?.current,v=m?.verification
   if(!c||!v||c.identity.seriesId!==id||c.identity.modelId!==modelId||c.identity.originDate!=='2026-10-30'||c.identity.targetDate!=='2026-11-06'
    ||c.identity.horizon!=='7D_CALENDAR'||c.unit!==s.unit||c.originValue!==actual||c.bands.status!=='NOT_AVAILABLE'||c.bands.lower!==null||c.bands.upper!==null
    ||v.maturedSampleCount!==40||v.records.length!==40)throw Error('D0_MODEL_INVALID')
   finite(c.forecastValue)
   const seen=new Set<string>();let smape=0,direction=0
   for(const r of v.records){
    const f=r.forecast,a=r.verification,identity=f.identity
    if(identity.seriesId!==id||identity.modelId!==modelId||identity.targetDate!==plus7(identity.originDate)||a.targetDate!==identity.targetDate
     ||a.verificationObservationDate!==identity.targetDate||a.targetDate>'2026-10-30'||seen.has(identity.originDate))throw Error('D0_VERIFICATION_DATE_INVALID')
    seen.add(identity.originDate)
    const predicted=finite(f.forecastValue),observed=finite(a.actualValue),origin=finite(f.originValue),den=Math.abs(predicted)+Math.abs(observed)
    smape+=den===0?0:200*Math.abs(predicted-observed)/den
    if(Math.sign(predicted-origin)===Math.sign(observed-origin))direction++
   }
   smape/=40;direction/=40
   if(!close(smape,v.metrics.smape)||!close(direction,v.metrics.directional_accuracy))throw Error('D0_METRIC_PARITY_FAILED')
   const last=[...v.records].sort((a,b)=>a.forecast.identity.originDate.localeCompare(b.forecast.identity.originDate)).at(-1)!
   if(last.forecast.identity.originDate!=='2026-10-23'||last.forecast.identity.targetDate!=='2026-10-30')throw Error('D0_LAST_MATURED_INVALID')
   comparisonCount+=40
   return {id:modelId,point:c.forecastValue,delta:c.forecastValue-actual,deltaPercent:actual===0?null:(c.forecastValue-actual)/actual*100,
    sampleSize:40,smape:v.metrics.smape,historicalAverageVerificationPercent:Math.max(0,Math.min(100,100-v.metrics.smape)),directionalAccuracyPercent:v.metrics.directional_accuracy*100,
    lastMatured:{origin:last.forecast.identity.originDate,target:last.verification.targetDate,predicted:last.forecast.forecastValue,actual:last.verification.actualValue},intervals:'NOT_AVAILABLE' as const,
    lineage:{methodVersion:c.identity.methodVersion,engineFingerprint:c.identity.engineFingerprint,sourceCutoffFingerprint:c.identity.sourceCutoffFingerprint,trainingFingerprint:c.identity.trainingFingerprint}}
  })
  const previous=s.modelResults.naive.verification.records.find(r=>r.forecast.identity.originDate==='2026-10-23')!,previousWeekValue=finite(previous.forecast.originValue)
  if(models.some(m=>m.lastMatured.actual!==actual)||OIL_MODELS.some(k=>s.modelResults[k].verification.records.find(r=>r.forecast.identity.originDate==='2026-10-23')?.forecast.originValue!==previousWeekValue))throw Error('D0_WEEKLY_OBSERVATION_PARITY_FAILED')
  return {id,name:id==='cl_c1_cl'?'WTI':'Brent',identity:s.storedDescription,provider:s.provider,unit:s.unit,currency:s.currency,sourceFingerprint:s.sourceFingerprint,actual,observationDate:s.quality.lastLawfulObservation,previousWeekValue,weekChange:actual-previousWeekValue,weekChangePercent:previousWeekValue===0?null:(actual-previousWeekValue)/previousWeekValue*100,models}
 })
 return {schemaVersion:'OilD0ReportProjection/1',inputSha256,contentFingerprint:OIL_D0_CONTENT_FINGERPRINT,status:'EXPERIMENTAL_7D/PARTIAL_READY',origin:'2026-10-30',target:'2026-11-06',comparisonCount,series,
  limitations:['INTERVALS_NOT_AVAILABLE','ROLLOVER_UNVERIFIED','LATEST_VINTAGE_NOT_CERTIFIED_POINT_IN_TIME','OBSERVED_WEEKDAYS_NOT_VERIFIED_EXCHANGE_CALENDAR','FROZEN_INTERNAL_PILOT_ONLY']}
}
/** The optional supplement is an immutable result of the existing Python
 * Forecast sMAPE and Finder quality projection. No second metric formula. */
export function projectFrozenOilD0(bytes:Uint8Array,lastCaseBytes?:Uint8Array):OilProjection {
 const sha=createHash('sha256').update(bytes).digest('hex')
 if(sha!==FROZEN_OIL_D0_SHA256)throw Error('FROZEN_D0_FINGERPRINT_MISMATCH')
 const projection=projectOilD0Document(JSON.parse(Buffer.from(bytes).toString('utf8')) as D0Document,sha)
 if(lastCaseBytes){
  if(createHash('sha256').update(lastCaseBytes).digest('hex')!==FROZEN_OIL_LAST_CASE_SHA256)throw Error('D0_LAST_CASE_FINGERPRINT_MISMATCH')
  const supplement=JSON.parse(Buffer.from(lastCaseBytes).toString('utf8'))
  if(supplement.inputSha256!==sha||supplement.rows.length!==8||supplement.fits!==0||supplement.productionCertification!==false)throw Error('D0_LAST_CASE_INVALID')
  for(const s of projection.series)for(const m of s.models){
   const rows=supplement.rows.filter((r:{seriesId:string;modelId:string})=>r.seriesId===s.id&&r.modelId===m.id)
   const r=rows[0]
   if(rows.length!==1||r.origin!==m.lastMatured.origin||r.target!==m.lastMatured.target||r.previousForecast!==m.lastMatured.predicted||r.observedActual!==m.lastMatured.actual
    ||!Number.isFinite(r.lastCaseVerificationPercent)||r.lastCaseVerificationPercent<0||r.lastCaseVerificationPercent>100)throw Error('D0_LAST_CASE_INVALID')
   Object.assign(m.lastMatured,{verificationPercent:r.lastCaseVerificationPercent})
  }
 }
 const freeze=(v:unknown):void=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}}
 freeze(projection);frozenProjections.add(projection);return projection
}
