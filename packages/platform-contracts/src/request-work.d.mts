import type {AccessQuery,AccessStoreBinding} from './access-store.mjs'
import type {BoundRequest,OperationContext} from './operation-context.mjs'
import type {DelegatedJobLease} from './delegated-job.mjs'
export type NativeWorkAccessMode='READ'|'WRITE'
export interface RequestWorkBinding {
 readonly requestId:string;readonly unitId:string;readonly accessMode:NativeWorkAccessMode
 readonly inputDigest:string;readonly schemaDigest:string
}
export interface RequestWorkEvidence extends RequestWorkBinding {readonly policyVersion:string;readonly policySourceRef:string;readonly policyExpiresAt:string;readonly transactionId:string}
export declare const REQUEST_WORK_CONTRACT:Readonly<{id:'profitia.request-work';version:'1.0.0';effect:'PRIVATE_SQL_WORK';replayOwner:'EXISTING_DOMAIN_STATE'}>
export declare const requestWorkSchemaUrl:string
export declare function requestWorkSchemaDigest():Promise<string>
export declare function requestWorkSourceDigest():Promise<string>
declare const handle:unique symbol
export interface RequestWorkHandle {readonly [handle]:true}
export declare function createRequestWorkScope(options:{binding:AccessStoreBinding&{service:NonNullable<AccessStoreBinding['service']>};work:RequestWorkBinding;now?:()=>number}):Readonly<{
 load(query:AccessQuery,input:{request:Readonly<BoundRequest>;lease:Readonly<DelegatedJobLease>}):Promise<Readonly<RequestWorkHandle>>
 evidence(handle:Readonly<RequestWorkHandle>):Readonly<RequestWorkEvidence>
 bind(query:AccessQuery,handle:Readonly<RequestWorkHandle>,context:Readonly<OperationContext>):Promise<void>
 verify(query:AccessQuery,handle:Readonly<RequestWorkHandle>,context:Readonly<OperationContext>):Promise<void>
}>
