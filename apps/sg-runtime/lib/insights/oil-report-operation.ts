import {OIL_REPORT_PROFILE} from './oil-report-profile'
import {prepareOilResponsesCommand,OIL_B1,assertOilEvaluationSource,validateOilEvaluationGo,type OilEvaluationSource} from './oil-report-source'
import {oilEvidenceCoverage,type OilEvidenceBundle} from './oil-report-evidence'
import {renderOilReport} from './oil-report-renderer'
import type {OilNarrative} from './oil-report-contract'
import type {OilTrace} from './oil-report-observability'
import {traceOilReport} from './oil-report-observability'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import {externalCallFailureEvidence} from '@profitia/platform-contracts/external-call'
/** Deliberately no live executor. Installing this preparation candidate alone
 * cannot turn user booleans, environment variables or an API key into authority.
 * A future exact accepted release supplies the real current E1/Source bindings. */
export function prepareOilReportOperation(bundle:OilEvidenceBundle,mode:'PRODUCT'|'B1'='PRODUCT'){
 return {status:'BLOCKED_FOR_LIVE_EXECUTION' as const,operation:mode==='B1'?OIL_B1.operation:OIL_REPORT_PROFILE.operation,command:prepareOilResponsesCommand(bundle),coverage:oilEvidenceCoverage(bundle),
  purposeAdmission:mode==='B1'?OIL_B1.admissionSha256:null,liveRuntimeChecked:false,
  blockers:[mode==='B1'?'B1_SOURCE_BINDING_NOT_INSTALLED':'E1_OPERATION_NOT_ADOPTED','SOURCE_MODEL_COST_POLICY_NOT_INSTALLED','TOKEN_COUNT_NOT_VERIFIED','ACTIVE_PROCESS_KEY_PROJECT_NOT_VERIFIED','PREVIOUS_UNVERIFIED_NOT_RECONCILED','EXACT_CANDIDATE_NOT_ACCEPTED_OR_RELEASED','FINAL_OWNER_GO_NOT_GRANTED'],
  modelCalls:0,publicationAllowed:false,globalOpenAiModelChanged:false}
}
export function executeOilReportLive():never{throw Error('OIL_REPORT_LIVE_EXECUTION_NOT_ADMITTED')}
export {validateOilEvaluationGo,type OilEvaluationGo} from './oil-report-source'
/** Called only by a separately accepted/released operator composition after
 * final GO. This module has no CLI auto-run, env switch, key or HTTP path. */
export async function executeOilOwnerEvaluation(source:OilEvaluationSource,goBytes:Uint8Array,approvedGoSha256:string,outputDirectory:string,trace:OilTrace=traceOilReport){
 const go=validateOilEvaluationGo(goBytes,approvedGoSha256,source)
 if(!path.isAbsolute(outputDirectory))throw Error('OIL_B1_ABSOLUTE_OUTPUT_REQUIRED')
 // A new private directory is the durable no-overwrite attempt marker. Source
 // additionally blocks every later attempt, including with another directory.
 fs.mkdirSync(outputDirectory,{mode:0o700})
 const save=(name:string,value:string|Uint8Array)=>fs.writeFileSync(path.join(outputDirectory,name),value,{flag:'wx',mode:0o400})
 save('OPENAI_RESPONSES_REQUEST_EXACT.json',source.command.body)
 save('FINAL_GO_USED.json',goBytes)
 save('ATTEMPT_STARTED.json',JSON.stringify({operation:OIL_B1.operation,startedAt:new Date().toISOString(),requestSha256:source.command.bodySha256,approvedGoSha256,intentKey:go.intentKey,retryAllowed:false}))
 const started=performance.now()
 return trace('run',async()=>{
  let result:Awaited<ReturnType<OilEvaluationSource['execute']>>
  try{result=await trace('source',()=>trace('author',()=>source.execute(go,AbortSignal.timeout(OIL_REPORT_PROFILE.operationDeadlineMs))))}
  catch(error){
   const certainty=error&&typeof error==='object'&&'certainty'in error&&['NOT_SENT','UNVERIFIED','RESULT_NOT_RETAINED'].includes(String(error.certainty))?String(error.certainty):'UNVERIFIED'
   const outcome={status:certainty,source:externalCallFailureEvidence(error),model:OIL_REPORT_PROFILE.model,requestId:null,responseId:null,usage:null,reportedCostUSD:'UNKNOWN',latencyMs:performance.now()-started,retryAllowed:false,originalApiOutputExists:false}
   save('OIL_MARKET_OUTLOOK_RAW_API_OUTPUT.json',JSON.stringify(outcome,null,2)+'\n');return outcome
  }
  // Preserve exact response bytes before any JSON validation or editorial work.
  save('OPENAI_RESPONSE_BODY.raw',result.bytes)
  const requestId=result.response.headers.get('x-request-id')
  const review=await reviewOilRawApiResponse(Buffer.from(result.bytes).toString('utf8'),source.bundle,requestId,trace,result.response.status)
  const outcome={...review,source:result.evidence,httpStatus:result.response.status,latencyMs:performance.now()-started,requestSha256:source.command.bodySha256,retryAllowed:false,originalApiOutputExists:true,publicationStatus:'HUMAN_REVIEW_REQUIRED'}
  save('OIL_MARKET_OUTLOOK_RAW_API_OUTPUT.json',JSON.stringify(outcome,null,2)+'\n')
  const usage=review.usage as {input_tokens?:number;output_tokens?:number;input_tokens_details?:{cached_tokens?:number}}|null
  if(usage&&requestId&&'responseId'in review&&typeof review.responseId==='string'){
   const u={inputTokens:usage.input_tokens,outputTokens:usage.output_tokens,cachedInputTokens:usage.input_tokens_details?.cached_tokens??0}
   if(Object.values(u).every(v=>Number.isSafeInteger(v)&&Number(v)>=0)){
    try{const receipt=await source.recordUsage(result.evidence.callId,u as {inputTokens:number;outputTokens:number;cachedInputTokens:number},requestId,review.responseId);save('SOURCE_USAGE_RECEIPT.json',JSON.stringify(receipt,null,2)+'\n')}
    catch{save('SOURCE_USAGE_RECONCILIATION_REQUIRED.json',JSON.stringify({status:'RECONCILIATION_REQUIRED',retainedHoldMicroUsd:150000,reportedCostUSD:'UNKNOWN',retryAllowed:false})+'\n')}
   }
  }
  if(review.report){
   save('OIL_MARKET_OUTLOOK_FIRST_REAL_API_REPORT_PL.md',review.report.body+'\n')
   save('OIL_MARKET_OUTLOOK_VISIBLE_SERIALIZATION.txt',review.report.visibleBody)
   for(const chart of review.report.charts)save(chart.name,chart.svg)
   save('OIL_MARKET_OUTLOOK_REPORT_METADATA.json',JSON.stringify(review.report.metadata,null,2)+'\n')
  }
  return outcome
 })
}
/** Pure processing of a retained provider body, not proof that an API call was
 * made. The sole future admitted Source transport must supply its provenance.
 * Exact raw bytes-as-UTF8 are retained beside any deterministic report rendering. */
export async function reviewOilRawApiResponse(rawBody:string,bundle:OilEvidenceBundle,requestId:string|null,trace:OilTrace,httpStatus=200){
 if(Buffer.byteLength(rawBody)>4000000)throw Error('REPORT_RESPONSE_TOO_LARGE')
 const raw={body:rawBody,requestId:requestId&&/^[A-Za-z0-9._:-]{1,512}$/.test(requestId)?requestId:null}
 return trace('run',async()=>{
  let value:Record<string,unknown>
  try{value=JSON.parse(rawBody)}catch{return {status:'UNVERIFIED' as const,raw,report:null,usage:null,reportedCostUSD:'UNKNOWN' as const}}
  if(!value||typeof value!=='object')return {status:'UNVERIFIED' as const,raw,report:null,usage:null,reportedCostUSD:'UNKNOWN' as const}
  const usage=value.usage??null
  const output=Array.isArray(value.output)?value.output:[]
  const content=output.flatMap(o=>o?.type==='message'&&Array.isArray(o.content)?o.content:[])
  const status=httpStatus<200||httpStatus>=300?'FAILED':content.some(c=>c?.type==='refusal')?'REFUSED':({completed:'COMPLETED',incomplete:'INCOMPLETE',failed:'FAILED'} as Record<string,string>)[String(value.status)]??'UNVERIFIED'
  const metadata={responseId:typeof value.id==='string'?value.id:null,model:typeof value.model==='string'?value.model:null,usage,reportedCostUSD:'UNKNOWN' as const}
  if(status!=='COMPLETED')return {status,raw,report:null,...metadata}
  if(value.model!==OIL_REPORT_PROFILE.model)return {status:'UNVERIFIED',raw,report:null,...metadata}
  const texts=content.filter(c=>c?.type==='output_text'&&typeof c.text==='string')
  try{
   if(texts.length!==1)throw Error('REPORT_STRUCTURED_OUTPUT_MISSING')
   const narrative=JSON.parse(texts[0].text) as OilNarrative
   const report=await trace('validation',async()=>renderOilReport(narrative,bundle))
   return trace('review',async()=>({status:'COMPLETED' as const,raw,report,...metadata,humanReviewRequired:true,sourceCallProvenance:'MUST_BE_PROVIDED_BY_ADMITTED_SOURCE' as const}))
  }catch(error){
   const codes=['REPORT_CHARACTER_LIMIT_EXCEEDED','REPORT_CLAIM_UNGROUNDED','REPORT_MARKET_REFERENCE_REQUIRED','REPORT_CERTAINTY_EXAGGERATED','REPORT_SECTIONS_INVALID','REPORT_STATEMENTS_INVALID','REPORT_STRUCTURED_OUTPUT_MISSING','REPORT_HEADING_MISSING']
   const code=error instanceof Error&&codes.includes(error.message)?error.message:'REPORT_STRUCTURED_OUTPUT_INVALID'
   const actual=error&&typeof error==='object'&&'actualCharacters'in error&&Number.isSafeInteger(error.actualCharacters)?Number(error.actualCharacters):null
   return {status:'OUTPUT_REJECTED' as const,raw,report:null,...metadata,validationFailure:{code,actualCharacters:actual,maximumCharacters:4000},humanReviewRequired:true}
  }
 })
}
