import {createHash} from 'node:crypto'
import {OIL_REPORT_PROFILE as p,assertOilBodyBudget} from './oil-report-profile'
import {OIL_NARRATIVE_FORMAT,OIL_REPORT_PROMPT} from './oil-report-contract'
import type {OilEvidenceBundle} from './oil-report-evidence'
export interface TokenBudgetReceipt {count:number;model:string;bodySha256:string;verified:boolean}
/** No fetch/SDK/client/credential here. This exact closed command must later be
 * bound to the separately adopted, current E1+Source native host, never raw HTTP. */
export function prepareOilResponsesCommand(bundle:OilEvidenceBundle){
 const body=JSON.stringify({model:p.model,store:false,reasoning:{effort:p.reasoningEffort},service_tier:p.serviceTier,max_output_tokens:p.maximumOutputTokens,
  input:[{role:'developer',content:OIL_REPORT_PROMPT},{role:'user',content:JSON.stringify(bundle)}],text:{format:OIL_NARRATIVE_FORMAT}})
 if(Buffer.byteLength(body)>p.maximumBodyBytes)throw Error('REPORT_BODY_TOO_LARGE')
 return Object.freeze({url:'https://api.openai.com/v1/responses',method:'POST' as const,body,bodySha256:createHash('sha256').update(body).digest('hex'),bodyBytes:Buffer.byteLength(body),model:p.model})
}
export function validateOilTokenReceipt(command:ReturnType<typeof prepareOilResponsesCommand>,receipt:TokenBudgetReceipt){assertOilBodyBudget(command.body,receipt,command.bodySha256)}
export function oilReportSourceCandidate(){return Object.freeze({sourceId:'sg2.oil-report.openai',resourceId:'sg2-oil-report:compose',method:'POST',path:'/v1/responses',origin:'https://api.openai.com',
 status:'PROPOSED_NOT_ADMITTED',timeoutMs:p.sourceTimeoutMs,maximumBodyBytes:p.maximumBodyBytes,maximumRequestBytes:p.maximumBodyBytes+Buffer.byteLength('https://api.openai.com/v1/responses'),maximumResponseBytes:4000000,
 requestHeaders:['authorization','accept','content-type','x-client-request-id'],responseHeaders:['content-type','retry-after','x-request-id'],model:p.model,
 requires:['CURRENT_HUMAN_E1','SQL028_SOURCE_COST_POLICY','VERIFIED_EXISTING_KEY_PROJECT','RECONCILED_PREVIOUS_UNVERIFIED','CONTROLLED_RELEASE','FINAL_OWNER_GO']})}
