import {createHash} from 'node:crypto';
export const V04_PROFILE=Object.freeze({id:'oil-asphalt-v04-internal-20261105',canonVersion:'0.4',canonSha256:'7ad7d1695e7fa608a38ae17b01b26cd9fd43e201e6b79d64a9a555d762399c4d',status:'PREPARED_NOT_ADMITTED',category:'Asfalt drogowy',maximumInputTokens:15000,maximumOutputTokens:16000,maximumBodyBytes:65536,timeoutMs:600000,model:'gpt-6.1-sol',reasoning:'high',retryAllowed:false,hostedTools:false});
export const SECTION_KEYS=Object.freeze(['executive','statistical','events','macro','outlook','calendar','asphalt','procurement']);
export const SECTION_TITLES=Object.freeze(['Executive Summary','Brent i WTI — ceny i Forecast D7','Wydarzenia i czynniki cenowe','Odczyty makroekonomiczne','Perspektywa kolejnego tygodnia','Kalendarz zaplanowanych publikacji','Mechanizm wpływu na bitum i asfalt','Procurement Outlook — decyzje warunkowe']);
export const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
export function requireThat(ok,code){if(!ok)throw new Error(code);}
const instant=value=>{const n=Date.parse(value);requireThat(typeof value==='string'&&Number.isFinite(n),'INVALID_INSTANT');return n;};
/** Calendar midnight in an explicit IANA zone; DST is retained. */
function localMidnight(date,zone){
 const target=Date.parse(date+'T00:00:00Z');let t=target;
 const f=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<4;i++){const p=Object.fromEntries(f.formatToParts(new Date(t)).map(x=>[x.type,x.value]));const displayed=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);const delta=target-displayed;if(!delta)return new Date(t).toISOString();t+=delta;}
 throw new Error('UNRESOLVED_LOCAL_MIDNIGHT');
}
export function reportWindows(asOf,timeZone='Europe/Warsaw',mode='TUESDAY_MONDAY'){
 const now=instant(asOf);new Intl.DateTimeFormat('en',{timeZone}).format(now);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const day=Date.parse(date+'T00:00:00Z'),weekday=new Date(day).getUTCDay();
 const tuesday=day-((weekday+5)%7)*86400000,add=n=>new Date(tuesday+n*86400000).toISOString().slice(0,10);
 const calendar={fromInclusive:localMidnight(add(0),timeZone),toExclusive:localMidnight(add(7),timeZone)};
 if(mode==='ROLLING_168H')return {mode,timeZone,asOf,exceptionApprovalRequired:true,fromInclusive:new Date(now-168*3600000).toISOString(),toExclusive:asOf,upcomingFromInclusive:asOf,upcomingToExclusive:new Date(now+168*3600000).toISOString(),canonicalCalendar:calendar};
 requireThat(mode==='TUESDAY_MONDAY','INVALID_WINDOW_MODE');
 return {mode,timeZone,asOf,exceptionApprovalRequired:false,...calendar,knowledgeToExclusive:asOf,partialWeek:now<instant(calendar.toExclusive),upcomingFromInclusive:calendar.toExclusive,upcomingToExclusive:localMidnight(add(14),timeZone)};
}
/** Pure projection of accepted Forecast results, never a model fit. */
export function projectForecast(d0,sourceSha256,lastCase=null){
 requireThat(/^[a-f0-9]{64}$/.test(sourceSha256),'FORECAST_FINGERPRINT_REQUIRED');
 const modelNames={naive:'Naive',damped_holt:'Damped Holt',ets:'ETS',arima:'ARIMA'};
 const series=['cl_c1_cl','b_c1_cl'].map(id=>{
  const s=d0.series?.find(x=>x.seriesId===id);requireThat(s&&s.provider==='MACROBOND'&&s.unit==='USD/Barrel','CANONICAL_FUTURES_REQUIRED');
  const models=Object.entries(modelNames).map(([modelId,name])=>{
   const r=s.modelResults[modelId],c=r?.current,v=r?.verification;requireThat(c&&v&&c.identity.seriesId===id&&Number.isFinite(c.forecastValue),'INVALID_FORECAST_ARTIFACT');
   requireThat(instant(c.identity.targetDate)-instant(c.identity.originDate)===7*86400000,'NOT_7_CALENDAR_DAY_FORECAST');
   requireThat(c.identity.originDate===s.quality.lastLawfulObservation&&c.originValue===s.quality.lastLawfulValue,'FORECAST_ORIGIN_MISMATCH');
   const records=v.records??[],mature=records.filter(x=>Number.isFinite(x.verification?.actualValue));
   const last=[...mature].sort((a,b)=>a.forecast.identity.targetDate.localeCompare(b.forecast.identity.targetDate)).at(-1);
   const extra=lastCase?.rows?.find(x=>x.seriesId===id&&x.modelId===modelId);
   return {modelId,name,origin:c.identity.originDate,target:c.identity.targetDate,point:c.forecastValue,originValue:c.originValue,bands:{status:'NOT_AVAILABLE',lower:null,upper:null},verification:{...v.metrics,sampleSize:v.maturedSampleCount,lastCase:last?{origin:last.forecast.identity.originDate,target:last.forecast.identity.targetDate,originValue:last.forecast.originValue,predicted:last.forecast.forecastValue,actual:last.verification.actualValue,verificationPercent:extra?.lastCaseVerificationPercent??null}:null}};
  });
  const first=models[0].verification.lastCase;
  return {seriesId:id,label:id==='cl_c1_cl'?'WTI':'Brent',instrumentType:'FUTURES',provider:s.provider,unit:'USD/bbl',observationDate:s.quality.lastLawfulObservation,last:s.quality.lastLawfulValue,previousDate:first?.origin??null,previous:first?.originValue??null,models};
 });
 return {sourceSha256,classification:'EXPERIMENTAL_7D',readiness:'PARTIAL_READY',pointInTimeCertified:false,rolloverConfirmed:false,intervals:'NOT_AVAILABLE',series};
}
/** Only approved derived material can be persisted; raw/native provider fields
 * and private operation context are rejected rather than silently retained. */
export function createEvidenceBundle({asOf,timeZone,windowMode,forecast,evidence,coverage,admissionRef}){
 requireThat(typeof admissionRef==='string'&&admissionRef.length>0,'ADMISSION_REFERENCE_REQUIRED');
 const windows=reportWindows(asOf,timeZone,windowMode),allowed=new Set(['id','sourceRecordRef','provider','family','publisher','title','url','publishedAt','eventAt','referencePeriod','retrievedAt','availableAt','availableAtBasis','licenceRef','contentFingerprint','derivedSummary','materialDepth','verification','claimType','facts','limitations']);
 const ids=new Set();
 for(const e of evidence){
  requireThat(e&&Object.keys(e).every(k=>allowed.has(k))&&!ids.has(e.id)&&/^EV\d{3}$/.test(e.id),'INVALID_EVIDENCE_PROJECTION');ids.add(e.id);
  requireThat(typeof e.licenceRef==='string'&&typeof e.sourceRecordRef==='string'&&/^[a-f0-9]{64}$/.test(e.contentFingerprint),'EVIDENCE_LINEAGE_REQUIRED');
  requireThat(instant(e.retrievedAt)<=instant(asOf)&&instant(e.availableAt)<=instant(asOf),'LATER_EVIDENCE');
  if(e.publishedAt)requireThat(instant(e.publishedAt)<=instant(asOf),'FUTURE_PUBLICATION');
  requireThat(['FACT','INTERPRETATION','FORECAST','HYPOTHESIS'].includes(e.claimType),'CLAIM_CLASS_REQUIRED');
  requireThat(['FULL_PUBLICATION','PUBLISHED_SUMMARY','SNIPPET','STRUCTURED_DATA'].includes(e.materialDepth),'MATERIAL_DEPTH_REQUIRED');
  requireThat(typeof e.derivedSummary==='string'&&e.derivedSummary.length<=1500,'DERIVED_SUMMARY_REQUIRED');
  if(e.facts){
   const keys=new Set(['actual','consensusForecast','vendorForecast','previous','revised','releaseStatus','dateSpan','importance','unit','currency','country','indicator','value','referencePeriod','lastUpdate','vendorModel','forecastCorePrediction','points']);
   requireThat(Object.keys(e.facts).every(k=>keys.has(k)),'RAW_FACTS_FORBIDDEN');
   for(const [k,v] of Object.entries(e.facts))if(k!=='points')requireThat(v===null||['string','number','boolean'].includes(typeof v),'NESTED_RAW_FACTS_FORBIDDEN');
   if(e.facts.points)requireThat(Array.isArray(e.facts.points)&&e.facts.points.length<=7&&e.facts.points.every(p=>Object.keys(p).every(k=>['horizon','value','targetDate'].includes(k))&&Object.values(p).every(v=>v===null||['string','number'].includes(typeof v))),'INVALID_VENDOR_FORECAST_POINTS');
  }
  if(e.eventAt&&instant(e.eventAt)>instant(asOf))requireThat(e.facts?.actual==null,'FUTURE_ACTUAL_FORBIDDEN');
 }
 const body={schemaVersion:'ReportEvidenceBundle/OilAsphalt/0.4',profileId:V04_PROFILE.id,canonSha256:V04_PROFILE.canonSha256,asOf,windows,category:'Asfalt drogowy',region:'UNSPECIFIED',exposure:'UNSPECIFIED',priceFormula:'UNSPECIFIED',admissionRef,forecast,evidence,coverage,providerPayloadRetentionSeconds:0};
 return Object.freeze({...body,fingerprint:hash(body)});
}
export function validateNarrative(output,bundle){
 requireThat(output&&Object.keys(output).sort().join(',')===[...SECTION_KEYS].sort().join(','),'EIGHT_SECTIONS_REQUIRED');
 const ids=new Set(bundle.evidence.map(e=>e.id));ids.add('FORECAST');
 for(const key of SECTION_KEYS){requireThat(Array.isArray(output[key])&&output[key].length>0&&output[key].length<=5,'INVALID_STATEMENTS');for(const s of output[key]){
  requireThat(s&&Object.keys(s).sort().join(',')==='refs,text'&&typeof s.text==='string'&&s.text.length<=1600,'INVALID_STATEMENT');
  requireThat(Array.isArray(s.refs)&&s.refs.length>0&&s.refs.every(x=>ids.has(x)),'UNKNOWN_OR_MISSING_CITATION');
  requireThat(!/\d|https?:\/\//.test(s.text),'NUMBERS_BELONG_TO_DETERMINISTIC_RENDERER');
 }}return output;
}
