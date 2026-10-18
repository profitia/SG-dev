import type { AccessQuery, AccessStoreBinding } from './access-store.mjs'
import type { Actor, BoundRequest, OperationContext } from './operation-context.mjs'
export declare const REQUEST_LEDGER_CONTRACT: Readonly<{id:'profitia.request-ledger';version:'1.0.0';schemaVersion:'1.0.0'}>
export declare const requestReservationSchemaUrl: string
export declare const externalRequestSchemaUrl: string
export interface RequestPolicy {
  readonly status:'AVAILABLE';readonly policyId:string;readonly version:string;readonly sourceRef:string
  readonly expiresAt:string;readonly windowStart:string;readonly windowEnd:string;readonly capacity:number;readonly used:number
  readonly applicationId:string;readonly environment:AccessStoreBinding['environment'];readonly organisationId:string
  readonly operation:'forecast.request'|'supplier.report.refresh';readonly transactionId:string
}
export interface RequestReceipt {readonly requestId:string;readonly status:'ACCEPTED'}
export type RequestReservation = Readonly<{status:'NEW';requestId:string;policyId:string;policyVersion:string;transactionId:string}>
  | Readonly<{status:'REPLAY';requestId:string;policyId:string;policyVersion:string;transactionId:string;value:RequestReceipt}>
export declare function validRequestIdempotencyKey(value:unknown):value is string
export declare function createRequestLedger(options:{binding:AccessStoreBinding;schemaDigest:string;now?:()=>number}&({operation?:'forecast.request';externalSchemaDigest?:never}|{operation:'supplier.report.refresh';externalSchemaDigest:string})):Readonly<{
  contract:typeof REQUEST_LEDGER_CONTRACT
  loadPolicy(query:AccessQuery,input:{actor:Readonly<Actor>;request:Readonly<BoundRequest>}):Promise<Readonly<RequestPolicy>>
  reserve(query:AccessQuery,policy:Readonly<RequestPolicy>,context:Readonly<OperationContext>):Promise<RequestReservation>
  complete(query:AccessQuery,policy:Readonly<RequestPolicy>,reservation:RequestReservation,context:Readonly<OperationContext>,value:unknown):Promise<void>
}>
export declare function requestLedgerSourceDigest():Promise<string>
export declare function requestReservationSchemaDigest():Promise<string>

export declare function externalRequestSchemaDigest():Promise<string>
