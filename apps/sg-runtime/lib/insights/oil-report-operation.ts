import {OIL_REPORT_PROFILE} from './oil-report-profile'
import {prepareOilResponsesCommand} from './oil-report-source'
import {oilEvidenceCoverage,type OilEvidenceBundle} from './oil-report-evidence'
import {renderOilReport} from './oil-report-renderer'
import type {OilNarrative} from './oil-report-contract'
import type {OilTrace} from './oil-report-observability'
/** Deliberately no live executor. Installing this preparation candidate alone
 * cannot turn user booleans, environment variables or an API key into authority.
 * A future exact accepted release supplies the real current E1/Source bindings. */
export function prepareOilReportOperation(bundle:OilEvidenceBundle){
 return {status:'BLOCKED_FOR_LIVE_EXECUTION' as const,operation:OIL_REPORT_PROFILE.operation,command:prepareOilResponsesCommand(bundle),coverage:oilEvidenceCoverage(bundle),
  blockers:['E1_OPERATION_NOT_ADOPTED','SOURCE_MODEL_COST_POLICY_NOT_INSTALLED','TOKEN_COUNT_NOT_VERIFIED','ACTIVE_KEY_PROJECT_NOT_VERIFIED','PREVIOUS_UNVERIFIED_NOT_RECONCILED','EXACT_CANDIDATE_NOT_ACCEPTED_OR_RELEASED','FINAL_OWNER_GO_NOT_GRANTED'],
  modelCalls:0,publicationAllowed:false,globalOpenAiModelChanged:false}
}
export function executeOilReportLive():never{throw Error('OIL_REPORT_LIVE_EXECUTION_NOT_ADMITTED')}
/** Pure processing of a retained provider body, not proof that an API call was
 * made. The sole future admitted Source transport must supply its provenance.
 * Exact raw bytes-as-UTF8 are retained beside any deterministic report rendering. */
export async function reviewOilRawApiResponse(rawBody:string,bundle:OilEvidenceBundle,requestId:string|null,trace:OilTrace){
 if(Buffer.byteLength(rawBody)>4000000)throw Error('REPORT_RESPONSE_TOO_LARGE')
 const raw={body:rawBody,requestId:requestId&&/^[A-Za-z0-9._:-]{1,512}$/.test(requestId)?requestId:null}
 return trace('run',async()=>{
  let value:Record<string,unknown>
  try{value=JSON.parse(rawBody)}catch{return {status:'UNVERIFIED' as const,raw,report:null,usage:null,reportedCostUSD:'UNKNOWN' as const}}
  if(!value||typeof value!=='object')return {status:'UNVERIFIED' as const,raw,report:null,usage:null,reportedCostUSD:'UNKNOWN' as const}
  const usage=value.usage??null
  const output=Array.isArray(value.output)?value.output:[]
  const content=output.flatMap(o=>o?.type==='message'&&Array.isArray(o.content)?o.content:[])
  const status=content.some(c=>c?.type==='refusal')?'REFUSED':({completed:'COMPLETED',incomplete:'INCOMPLETE',failed:'FAILED'} as Record<string,string>)[String(value.status)]??'UNVERIFIED'
  const metadata={responseId:typeof value.id==='string'?value.id:null,model:typeof value.model==='string'?value.model:null,usage,reportedCostUSD:'UNKNOWN' as const}
  if(status!=='COMPLETED')return {status,raw,report:null,...metadata}
  if(value.model!==OIL_REPORT_PROFILE.model)return {status:'UNVERIFIED',raw,report:null,...metadata}
  const texts=content.filter(c=>c?.type==='output_text'&&typeof c.text==='string')
  try{
   if(texts.length!==1)throw Error('REPORT_STRUCTURED_OUTPUT_MISSING')
   const narrative=JSON.parse(texts[0].text) as OilNarrative
   const report=await trace('validation',async()=>renderOilReport(narrative,bundle))
   return trace('review',async()=>({status:'COMPLETED' as const,raw,report,...metadata,humanReviewRequired:true,sourceCallProvenance:'MUST_BE_PROVIDED_BY_ADMITTED_SOURCE' as const}))
  }catch{return {status:'OUTPUT_REJECTED' as const,raw,report:null,...metadata,humanReviewRequired:true}}
 })
}
