export const OIL_REPORT_PROFILE=Object.freeze({id:'oil-market-outlook-pilot-v0.1-candidate.1',operation:'insight.report.compose',
 status:'CANDIDATE_NOT_ACTIVE',model:'gpt-6.1-sol',reasoningEffort:'medium',store:false,serviceTier:'default',
 maximumInputTokens:15000,maximumOutputTokens:8000,maximumBodyBytes:65536,reservationMicroUsd:150000,
 maximumAttempts:1,sourceTimeoutMs:120000,operationDeadlineMs:150000,tools:false,background:false,retry:false,fallback:false,
 globalOpenAiModelChanged:false,liveExecutionEnabled:false} as const)
export function assertOilBodyBudget(body:string,tokenCount:{count:number;model:string;bodySha256:string;verified:boolean},bodySha256:string){
 if(Buffer.byteLength(body,'utf8')>OIL_REPORT_PROFILE.maximumBodyBytes)throw Error('REPORT_BODY_TOO_LARGE')
 if(!tokenCount.verified||tokenCount.model!==OIL_REPORT_PROFILE.model||tokenCount.bodySha256!==bodySha256
  ||!Number.isSafeInteger(tokenCount.count)||tokenCount.count<1||tokenCount.count>OIL_REPORT_PROFILE.maximumInputTokens)throw Error('REPORT_TOKEN_BUDGET_UNVERIFIED')
}
