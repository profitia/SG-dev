import type { AccessQuery, AccessStoreBinding } from './access-store.mjs'
import type { Actor, BoundRequest, OperationContext } from './operation-context.mjs'
export declare const REQUEST_LEDGER_CONTRACT: Readonly<{id:'profitia.request-ledger';version:'1.0.0';schemaVersion:'1.0.0'}>
export declare const requestReservationSchemaUrl: string
export declare const externalRequestSchemaUrl: string
export interface RequestPolicyCommon {
  readonly locationAdmission?:Readonly<import('./supplier-location.mjs').SupplierLocationAdmission>
  readonly status:'AVAILABLE';readonly policyId:string;readonly version:string;readonly sourceRef:string
  readonly used:number
  readonly applicationId:string;readonly environment:AccessStoreBinding['environment'];readonly organisationId:string
  readonly operation:import('./request-operations.mjs').RequestOperation;readonly transactionId:string
}
export type RequestPolicy = RequestPolicyCommon & (Readonly<{quotaMode?:'FIXED';quotaSchemaDigest?:string;expiresAt:string;windowStart:string;windowEnd:string;capacity:number}> | Readonly<{quotaMode:'UNMETERED';quotaSchemaDigest:string;expiresAt:null;windowStart:null;windowEnd:null;capacity:null}>)
export interface RequestReceipt {readonly requestId:string;readonly status:'ACCEPTED'}
export type RequestReservation = Readonly<{status:'NEW';requestId:string;policyId:string;policyVersion:string;transactionId:string}>
  | Readonly<{status:'REPLAY';requestId:string;policyId:string;policyVersion:string;transactionId:string;value:RequestReceipt}>
export declare function validRequestIdempotencyKey(value:unknown):value is string
export declare function createRequestLedger(options:{binding:AccessStoreBinding;schemaDigest:string;now?:()=>number;locationAdmission?:import('./supplier-location.mjs').SupplierLocationAdmissionOptions}&({operation?:'forecast.request';externalSchemaDigest?:never;operationSchemaDigest?:never;locationSchemaDigest?:never;quotaSchemaDigest?:never}|{operation:'supplier.report.refresh';externalSchemaDigest:string;operationSchemaDigest?:never;locationSchemaDigest?:never;quotaSchemaDigest?:string}|{operation:'supplier.private.refresh';externalSchemaDigest:string;operationSchemaDigest:string;locationSchemaDigest?:never;quotaSchemaDigest?:string}|{operation:'benchmark.discovery.request';externalSchemaDigest:string;operationSchemaDigest:string;locationSchemaDigest?:never;quotaSchemaDigest?:never}|{operation:import('./request-operations.mjs').LocationRequestOperation;externalSchemaDigest:string;operationSchemaDigest:string;locationSchemaDigest:string;quotaSchemaDigest?:never})):Readonly<{
  contract:typeof REQUEST_LEDGER_CONTRACT
  loadPolicy(query:AccessQuery,input:{actor:Readonly<Actor>;request:Readonly<BoundRequest>;resource?:Readonly<import('./operation-context.mjs').Resource>}):Promise<Readonly<RequestPolicy>>
  reserve(query:AccessQuery,policy:Readonly<RequestPolicy>,context:Readonly<OperationContext>):Promise<RequestReservation>
  complete(query:AccessQuery,policy:Readonly<RequestPolicy>,reservation:RequestReservation,context:Readonly<OperationContext>,value:unknown):Promise<void>
}>
export declare function requestLedgerSourceDigest():Promise<string>
export declare function requestReservationSchemaDigest():Promise<string>

export declare function externalRequestSchemaDigest():Promise<string>

export declare const requestQuotaSchemaUrl:string
export declare function requestQuotaSchemaDigest():Promise<string>
