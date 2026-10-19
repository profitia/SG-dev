import type {AccessQuery,AccessStoreBinding} from './access-store.mjs'
import type {OperationContext} from './operation-context.mjs'
import type {SupplierPrivatePhaseId} from './request-continuation.mjs'
export declare const REQUEST_INSPECTION_CONTRACT:Readonly<{id:'profitia.request-inspection';version:'1.0.0';effect:'PRIVATE_SQL_READ';anchor:'ACCEPTED_PRIVATE_PHASE'}>
export declare const requestInspectionSchemaUrl:string
export declare function requestInspectionSchemaDigest():Promise<string>
export declare function requestInspectionSourceDigest():Promise<string>
export interface RequestInspectionEvidence {
 readonly requestId:string;readonly phaseId:SupplierPrivatePhaseId;readonly inputDigest:string;readonly policyVersion:string
 readonly schemaDigest:string;readonly continuationSchemaDigest:string;readonly delegatedSchemaDigest:string
 readonly transactionId:string;readonly acceptedTransactionId:string
}
export interface RequestInspectionBinding {
 readonly requestId:string;readonly phaseId:SupplierPrivatePhaseId;readonly schemaDigest:string
 readonly continuationSchemaDigest:string;readonly delegatedSchemaDigest:string
}
export interface RequestInspectionHandle extends Readonly<Record<string,unknown>> {
 readonly requestId:string;readonly phaseId:SupplierPrivatePhaseId;readonly inputDigest:string;readonly policyVersion:string
 readonly transactionId:string;readonly acceptedTransactionId:string
}
export declare function createRequestInspection(options:{binding:AccessStoreBinding&{service:NonNullable<AccessStoreBinding['service']>};inspection:RequestInspectionBinding;now?:()=>number}):Readonly<{
 load(query:AccessQuery,input:{request:{operation:string;resourceId:string};lease:{state?:{delegation?:{target?:{operation?:string}}}}}):Promise<Readonly<RequestInspectionHandle>>
 evidence(handle:Readonly<RequestInspectionHandle>):Readonly<RequestInspectionEvidence>
 bind(query:AccessQuery,handle:Readonly<RequestInspectionHandle>,context:Readonly<OperationContext>):Promise<void>
 verify(query:AccessQuery,handle:Readonly<RequestInspectionHandle>,context:Readonly<OperationContext>):Promise<void>
}>
