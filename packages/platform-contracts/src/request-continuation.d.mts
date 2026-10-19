import type {AccessStoreBinding} from './access-store.mjs'
import type {createRequestLedger} from './request-ledger.mjs'
export declare const REQUEST_CONTINUATION_CONTRACT:Readonly<{id:'profitia.request-continuation';version:'1.1.0';effect:'PRIVATE_SQL_PHASE'}>
export interface RequestContinuationBinding{readonly requestId:string;readonly phaseId:string;readonly inputDigest:string;readonly schemaDigest:string}
export interface RequestContinuationEvidence extends RequestContinuationBinding{readonly policyVersion:string;readonly transactionId:string;readonly delegatedSchemaDigest?:string}
export declare const requestContinuationSchemaUrl:string
export declare function requestContinuationSchemaDigest():Promise<string>
export declare function requestContinuationSourceDigest():Promise<string>
export declare function createRequestContinuationLedger(options:{ledger:ReturnType<typeof createRequestLedger>;binding:AccessStoreBinding;continuation:RequestContinuationBinding;now?:()=>number}):ReturnType<typeof createRequestLedger>&{evidence(policy:import('./request-ledger.mjs').RequestPolicy):Readonly<RequestContinuationEvidence>}

export declare const delegatedPrivatePhasesSchemaUrl:string
export declare function delegatedPrivatePhasesSchemaDigest():Promise<string>
export type SupplierPrivatePhaseId='REGISTER_LOOKUP'|'STORE_GENERAL'|'STORE_FINANCIAL'|'RECORD_INTEREST'
export interface DelegatedPhaseHandle {readonly requestId:string;readonly phaseId:SupplierPrivatePhaseId;readonly policyVersion:string;readonly transactionId:string;readonly expiresAt:string;readonly executorServiceId:string;readonly subjectUserId:string;readonly organisationId:string;readonly delegationId:string;readonly resourceId:string;readonly payloadDigest:string}
export interface DelegatedPhaseReservation {readonly status:'NEW'|'REPLAY';readonly requestId:string;readonly transactionId:string;readonly value?:import('./request-ledger.mjs').RequestReceipt}
export declare function createRequestContinuationLedger(options:{executionMode:'DELEGATED_SERVICE';ledger?:never;binding:AccessStoreBinding&{service:NonNullable<AccessStoreBinding['service']>};continuation:RequestContinuationBinding&{phaseId:SupplierPrivatePhaseId;delegatedSchemaDigest:string};now?:()=>number}):Readonly<{
 contract:typeof REQUEST_CONTINUATION_CONTRACT
 loadPhase(query:import('./access-store.mjs').AccessQuery,input:{actor:Readonly<import('./operation-context.mjs').Actor>;request:Readonly<import('./operation-context.mjs').BoundRequest>;lease:import('./delegated-job.mjs').DelegatedJobLease}):Promise<Readonly<DelegatedPhaseHandle>>
 evidence(handle:Readonly<DelegatedPhaseHandle>):Readonly<RequestContinuationEvidence&{delegatedSchemaDigest:string}>
 reserve(query:import('./access-store.mjs').AccessQuery,handle:Readonly<DelegatedPhaseHandle>,context:Readonly<import('./operation-context.mjs').OperationContext>):Promise<Readonly<DelegatedPhaseReservation>>
 complete(query:import('./access-store.mjs').AccessQuery,handle:Readonly<DelegatedPhaseHandle>,reservation:Readonly<DelegatedPhaseReservation>,context:Readonly<import('./operation-context.mjs').OperationContext>,value:import('./request-ledger.mjs').RequestReceipt):Promise<void>
}>
