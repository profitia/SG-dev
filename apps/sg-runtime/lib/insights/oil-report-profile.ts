export const OIL_REPORT_PROFILE=Object.freeze({id:'oil-market-outlook-e2e-v1',operation:'insight.report.compose',
 status:'CANDIDATE_NOT_ACTIVE',model:'gpt-6.1-sol',reasoningEffort:'high',store:false,serviceTier:'default',
 maximumInputTokens:15000,maximumOutputTokens:32000,maximumBodyBytes:65536,reservationMicroUsd:4900000,
 maximumAttempts:1,sourceTimeoutMs:600000,operationDeadlineMs:660000,tools:false,background:false,retry:false,fallback:false,
 globalOpenAiModelChanged:false,liveExecutionEnabled:false} as const)
export function assertOilBodyBudget(body:string,tokenCount:{count:number;model:string;bodySha256:string;verified:boolean},bodySha256:string){
 if(Buffer.byteLength(body,'utf8')>OIL_REPORT_PROFILE.maximumBodyBytes)throw Error('REPORT_BODY_TOO_LARGE')
 if(!tokenCount.verified||tokenCount.model!==OIL_REPORT_PROFILE.model||tokenCount.bodySha256!==bodySha256
  ||!Number.isSafeInteger(tokenCount.count)||tokenCount.count<1||tokenCount.count>OIL_REPORT_PROFILE.maximumInputTokens)throw Error('REPORT_TOKEN_BUDGET_UNVERIFIED')
}
