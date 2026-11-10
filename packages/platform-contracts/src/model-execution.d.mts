export interface ModelExecutionPolicy {
 readonly schemaDigest:string;readonly profileId:string;readonly model:string
 readonly maximumInputTokens:number;readonly maximumOutputTokens:number;readonly maximumBodyBytes:number
 readonly reservationMicroUsd:number;readonly timeoutMs:120000|600000
}
export interface ModelUsage {input_tokens:number;output_tokens:number;input_tokens_details?:{cached_tokens?:number};output_tokens_details?:{reasoning_tokens?:number}}
export declare const MODEL_EXECUTION_CONTRACT:Readonly<{id:'profitia.model-execution';version:'1.0.0';currency:'USD'}>
export declare const modelExecutionSchemaUrl:string
export declare function modelExecutionSchemaDigest():string
export declare function captureModelExecution(value:unknown):Readonly<ModelExecutionPolicy>
export declare function assertModelDescriptor(policy:ModelExecutionPolicy,descriptor:unknown):void
export declare function assertModelRequest(policy:ModelExecutionPolicy,body:unknown):unknown
export declare function standardModelCostMicroUsd(usage:unknown):number|null
export declare function modelResponseObservation(response:unknown):Readonly<{status:'COMPLETED'|'INCOMPLETE'|'REFUSED'|'FAILED'|'UNVERIFIED';responseId?:string|null;model?:string|null;usage:ModelUsage|null;costMicroUsd:number|null}>
