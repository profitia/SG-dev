import type {AccessStoreBinding} from './access-store.mjs'
import type {createRequestLedger} from './request-ledger.mjs'
export declare const REQUEST_CONTINUATION_CONTRACT:Readonly<{id:'profitia.request-continuation';version:'1.0.0';effect:'PRIVATE_SQL_PHASE'}>
export interface RequestContinuationBinding{readonly requestId:string;readonly phaseId:string;readonly inputDigest:string;readonly schemaDigest:string}
export interface RequestContinuationEvidence extends RequestContinuationBinding{readonly policyVersion:string;readonly transactionId:string}
export declare const requestContinuationSchemaUrl:string
export declare function requestContinuationSchemaDigest():Promise<string>
export declare function requestContinuationSourceDigest():Promise<string>
export declare function createRequestContinuationLedger(options:{ledger:ReturnType<typeof createRequestLedger>;binding:AccessStoreBinding;continuation:RequestContinuationBinding;now?:()=>number}):ReturnType<typeof createRequestLedger>&{evidence(policy:import('./request-ledger.mjs').RequestPolicy):Readonly<RequestContinuationEvidence>}
