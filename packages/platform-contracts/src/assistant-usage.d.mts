export declare const ASSISTANT_USAGE_CONTRACT:Readonly<{id:'profitia.assistant-usage';version:'1.0.0'}>
export declare const ASSISTANT_PRICING:Readonly<{version:string;model:'gpt-5.6-luna';inputNanoUsd:number;cachedNanoUsd:number;write30mNanoUsd:number;write12hNanoUsd:number;outputNanoUsd:number}>
export type AssistantModelInput=ReadonlyArray<Readonly<{role:'developer'|'user'|'assistant';content:string}>>
export type AssistantActualUsage=Readonly<{model:string;pricingVersion:string;inputTokens:number;outputTokens:number;totalTokens:number;cachedTokens:number;cacheWriteTokens:number;cacheWrite30mTokens:number;cacheWrite12hTokens:number;reasoningTokens:number;nanoUsd:string}>
export type AssistantUsageAdmission=Readonly<{status:'RESERVED'|'REPLAY';executionId:string;commandId:string;inputDigest:string;inputTokens:number;outputTokens:number;nanoUsd:string;model:string;pricingVersion:string}>
export declare function assistantInputBound(input:AssistantModelInput):Readonly<{inputTokens:number;outputTokens:2048;nanoUsd:string;inputDigest:string}>
export declare function readAssistantUsage(usage:unknown,model:string):AssistantActualUsage
export declare function takeAssistantAdmission(value:AssistantUsageAdmission,options:{inputDigest:string;now?:number}):Omit<AssistantUsageAdmission,'status'>
export declare function assertAssistantUsageReservation(value:AssistantUsageAdmission,context:Readonly<import('./operation-context.mjs').OperationContext>):AssistantUsageAdmission
export declare function createAssistantUsageStore(options:{query:(sql:string,values:unknown[])=>Promise<{rows:Record<string,unknown>[]}>,commandKey:string;schemaDigest:string;now?:()=>number}):Readonly<{
 contract:typeof ASSISTANT_USAGE_CONTRACT
 reserve(input:{actorId:string;organisationId:string;commandId:string;decisionId:string;input:AssistantModelInput;expectedPolicy:{id:string;assignmentId:string;assignmentRevision:number}}):Promise<AssistantUsageAdmission>
 settle(admission:AssistantUsageAdmission,result:{usage:unknown;model:string;responseId:string}):Promise<AssistantActualUsage>
 dispatch(admission:AssistantUsageAdmission):Promise<void>
 release(admission:AssistantUsageAdmission):Promise<void>
 pending(admission:AssistantUsageAdmission,reason:'CANCELLED'|'INTERRUPTED'|'PROVIDER_ERROR'|'USAGE_UNVERIFIED'|'AUTH_REVOKED'):Promise<void>
}>
