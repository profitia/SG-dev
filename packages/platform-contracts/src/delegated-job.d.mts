import type {Actor,AuditEvent,BoundRequest,OperationContext,OperationState} from './operation-context.mjs'
import type {AccessStoreBinding, AccessQuery as Query} from './access-store.mjs'
export interface DelegatedJobLease {
  readonly state: Readonly<OperationState>;readonly serviceId:string;readonly userId:string;readonly organisationId:string
  readonly operation:'job.execute';readonly resourceId:string;readonly transactionId:string;readonly expiresAt:string
}
export type DispatchAdmission = Readonly<{jobId:string;status:'BUSY'|'CONFIRMED'|'RECONCILE_REQUIRED'} | {
  jobId:string;requestId:string;status:'READY';sourceId:string;deliveryKey:string;leaseId:string;expiresAt:string;attempt:number
}>
export declare const DELEGATED_JOB_CONTRACT:Readonly<{id:'profitia.delegated-job';version:'1.1.0'}>
export type DelegatedJobTargetOptions = {targetOperation?:'forecast.request';supplierSchemaDigest?:never}|{targetOperation:'supplier.report.refresh';supplierSchemaDigest:string}
export declare const supplierDelegationSchemaUrl:string
export declare function supplierDelegationSchemaDigest():Promise<string>
export declare const delegatedJobSchemaUrl:string
export declare function delegatedJobSchemaDigest():Promise<string>
export declare function delegatedJobSourceDigest():Promise<string>
export declare function createDelegatedJobStore(options:{binding:AccessStoreBinding;schemaDigest:string;now?:()=>number}&DelegatedJobTargetOptions):Readonly<{
  contract:typeof DELEGATED_JOB_CONTRACT
  createDispatch(query:Query,context:Readonly<OperationContext>):Promise<Readonly<{jobId:string;requestId:string;status:'PENDING'}>>
  lockJob(query:Query,input:{actor:Readonly<Actor>;request:Readonly<BoundRequest>}):Promise<DelegatedJobLease>
  verifyScope(query:Query,lease:DelegatedJobLease):Promise<void>
  claimDispatch(query:Query,lease:DelegatedJobLease):Promise<DispatchAdmission>
  prepareDelivery(query:Query,lease:DelegatedJobLease,admission:Extract<DispatchAdmission,{status:'READY'}>,port:Readonly<import('./platform-ingestion.mjs').PlatformDeliveryPort>):Promise<Readonly<{jobId:string;status:'READY'|'CONFIRMED'}>>
  observeCommitted(query:Query,lease:DelegatedJobLease,admission:Extract<DispatchAdmission,{status:'READY'}>,receipt:Readonly<import('./platform-ingestion.mjs').PlatformReceipt>):Promise<Readonly<{jobId:string;status:'CONFIRMED'}>>
  appendAudit(query:Query,event:AuditEvent,lease?:DelegatedJobLease):Promise<void>
}>
