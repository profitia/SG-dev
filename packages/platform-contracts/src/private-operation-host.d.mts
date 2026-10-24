import type { AccessQuery, AccessStoreBinding, IdentityBinding, DatabaseServiceActor } from './access-store.mjs'
import type { Actor, Application, BoundRequest, OperationContext, OperationExecutor, OperationOutcome, Resource } from './operation-context.mjs'
import type { ModuleId } from './module-scope.mjs'

export declare const PRIVATE_OPERATION_HOST_CONTRACT: Readonly<{ id: 'profitia.private-operation-host'; version: '1.11.0' }>
export interface PrivateOperationScope {
  applicationId: string; environment: AccessStoreBinding['environment']; userId: string; organisationId: string | null
}
export interface PrivateTransactionOptions { readonly timeoutMs: number; readonly maxWaitMs: number }
export declare function createPrivateOperationHost<Transaction>(options: {
  application: Application; binding: AccessStoreBinding; now?: () => number; transactionTimeoutMs?: number
  locationAdmission?:import('./supplier-location.mjs').SupplierLocationAdmissionOptions
  reportAdmission?:Readonly<{schemaDigest:string}>
  /** Optional, deployment-owned module boundary. Requires SQL002 + accepted SQL003 and the extra descriptor ACL. */
  module?: { id: ModuleId; schemaDigest: string; auditSchemaDigest: string }
  /** AM20 uses SQL006; bounded HUMAN AM23 additionally requires accepted SQL010. No remote dispatch. */
  requestLedger?: { schemaDigest: string; externalSchemaDigest?: string; operationSchemaDigest?: string; locationSchemaDigest?:string }
  /** Optional explicit current-authorised PRIVATE_SQL_PHASE of an accepted AM23 parent; never remote execution. */
  requestContinuation?: import('./request-continuation.mjs').RequestContinuationBinding
  /** Fresh authoritative reads and independently committed INTENT/DENY/FAILURE. */
  independentQuery: AccessQuery
  /** Real driver transaction: await callback once, commit its return, rollback on
   * error and enforce timeoutMs for its ENTIRE lifetime. Never pool-level SQL. */
  transact<T>(action: (session: { query: AccessQuery; transaction: Transaction }) => Promise<T>, limits: PrivateTransactionOptions): Promise<T>
  /** Called per execution; no binding may come from the HTTP caller. */
  createAuthenticator(options: {
    resolveBinding(key: Pick<IdentityBinding, 'environment' | 'issuer' | 'subject'>): Promise<Readonly<IdentityBinding> | null>
  }): (request: unknown) => Promise<Actor | null>
  /** Only resource descriptors/inputs; cannot override membership or products. */
  readResources(input: {
    actor: Readonly<Actor>; request: Readonly<BoundRequest>; scope: Readonly<PrivateOperationScope>
    query: AccessQuery; transaction: Transaction
  }): Promise<{ resource: Resource; inputs?: Resource[] }>
  projectOutput(value: unknown, context: Readonly<OperationContext>, transaction: Transaction): unknown | Promise<unknown>
  /** Export preparation only after all input/product/permission checks and durable
   * correlated INTENT. Use this same bounded SQL transaction; no provider calls. */
  prepareInputs?(input: { context: Readonly<OperationContext>; query: AccessQuery; transaction: Transaction }): void | Promise<void>
  describeOutcome?(value: unknown, context: Readonly<OperationContext>, transaction: Transaction): OperationOutcome | Promise<OperationOutcome>
}): Readonly<OperationExecutor<Transaction> & { hostContract: typeof PRIVATE_OPERATION_HOST_CONTRACT|typeof SUPPLIER_LOCATION_HOST_CONTRACT|typeof REPORT_ADMISSION_HOST_CONTRACT }>
export declare function privateOperationHostSourceDigest(): Promise<string>

/** The real SQL SERVICE remains distinct from the initiating account. */
export interface DelegatedJobHostOptions<Transaction>{
 reportAdmission?:Readonly<{schemaDigest:string}>
 application:Application;binding:AccessStoreBinding&{service:NonNullable<AccessStoreBinding['service']>}
 job:{schemaDigest:string}&import('./delegated-job.mjs').DelegatedJobTargetOptions
 now?:()=>number;transactionTimeoutMs?:number;independentQuery:AccessQuery
 transact<T>(action:(session:{query:AccessQuery;transaction:Transaction})=>Promise<T>,limits:PrivateTransactionOptions):Promise<T>
 readExternalAccount(key:Readonly<import('./identity-provider.mjs').ExternalIdentityKey>):Promise<Readonly<import('./identity-provider.mjs').ExternalAccountObservation>|null>
}
export interface DelegatedJobHost {
 readonly contract:OperationExecutor['contract'];readonly hostContract:typeof PRIVATE_OPERATION_HOST_CONTRACT|typeof REPORT_ADMISSION_HOST_CONTRACT
 admit(input:import('./operation-context.mjs').OperationInput):Promise<Readonly<{decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:import('./delegated-job.mjs').DispatchAdmission}>>
 deliver?(input:import('./operation-context.mjs').OperationInput,admission:Extract<import('./delegated-job.mjs').DispatchAdmission,{status:'READY'}>):Promise<Readonly<{decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:import('./delegated-job.mjs').DispatchAdmission}>>
}
export declare function createDelegatedJobHost<Transaction>(options:DelegatedJobHostOptions<Transaction>&{
 job:{schemaDigest:string;targetOperation:'supplier.report.refresh';supplierSchemaDigest:string}
 privateContinuation:{schemaDigest:string;delegatedSchemaDigest:string};sourceDelivery?:never;privateWork?:never;privateInspection?:never
}):Readonly<Omit<DelegatedJobHost,'deliver'>&{
 runPrivatePhase(input:import('./operation-context.mjs').OperationInput,phase:Readonly<{phaseId:import('./request-continuation.mjs').SupplierPrivatePhaseId;inputDigest:string}>,action:(context:Readonly<OperationContext>,transaction:Transaction)=>import('./request-ledger.mjs').RequestReceipt|Promise<import('./request-ledger.mjs').RequestReceipt>):Promise<Readonly<{decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:import('./request-ledger.mjs').RequestReceipt}>>
}>
export declare function createDelegatedJobHost<Transaction>(options:DelegatedJobHostOptions<Transaction>&{
 sourceDelivery?:Readonly<import('./platform-ingestion.mjs').PlatformDeliveryPort>;privateContinuation?:never;privateWork?:never;privateInspection?:never
}):Readonly<DelegatedJobHost>

export interface ServiceReadScope {
  applicationId: string; environment: AccessStoreBinding['environment']; userId: null; serviceId: string
  organisationId: string; operation: 'knowledge.read' | 'forecast.read' | 'supplier.report.read'; resourceId: string
}
/** Internal prepared-data read composition. Actual SQL login is the actor;
 * no caller/queue/user identity, delegated authority, writes or vendor calls. */
export declare function createServiceReadHost<Transaction>(options: {
  application: Application; binding: AccessStoreBinding & { service: NonNullable<AccessStoreBinding['service']> }
  now?: () => number; transactionTimeoutMs?: number; independentQuery: AccessQuery
  transact<T>(action: (session: { query: AccessQuery; transaction: Transaction }) => Promise<T>, limits: PrivateTransactionOptions): Promise<T>
  readResources(input: {
    actor: Readonly<DatabaseServiceActor>; request: Readonly<BoundRequest>; scope: Readonly<ServiceReadScope>
    query: AccessQuery; transaction: Transaction
  }): Promise<{ resource: Resource }>
  projectOutput(value: unknown, context: Readonly<OperationContext>, transaction: Transaction): unknown | Promise<unknown>
  describeOutcome?(value: unknown, context: Readonly<OperationContext>, transaction: Transaction): OperationOutcome | Promise<OperationOutcome>
}): Readonly<OperationExecutor<Transaction> & { hostContract: typeof PRIVATE_OPERATION_HOST_CONTRACT }>

/** Read-only inspection of an already committed Supplier phase. Uses current
 * original delegation/account checks, no write reserve or dispatch claim. */
export declare function createDelegatedPrivateInspectionHost<Transaction>(options:DelegatedJobHostOptions<Transaction>&{
 job:{schemaDigest:string;targetOperation:'supplier.report.refresh';supplierSchemaDigest:string}
 privateInspection:{schemaDigest:string;continuationSchemaDigest:string;delegatedSchemaDigest:string}
 privateContinuation?:never;sourceDelivery?:never;privateWork?:never
}):Readonly<{
 contract:OperationExecutor['contract'];hostContract:typeof PRIVATE_OPERATION_HOST_CONTRACT
 inspectPrivatePhase(input:import('./operation-context.mjs').OperationInput,phase:Readonly<{phaseId:import('./request-continuation.mjs').SupplierPrivatePhaseId}>,action:(context:Readonly<OperationContext>,transaction:Transaction)=>void|Promise<void>):Promise<Readonly<{decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:import('./request-ledger.mjs').RequestReceipt}>>
}>

/** Current reviewed SQL unit; callbacks return no public business output. */
export declare function createDelegatedNativeWorkHost<Transaction>(options:DelegatedJobHostOptions<Transaction>&{
 job:{schemaDigest:string}&({targetOperation:'supplier.report.refresh';supplierSchemaDigest:string;operationSchemaDigest?:never}|{targetOperation:import('./request-operations.mjs').AdditionalRequestOperation;supplierSchemaDigest:string;operationSchemaDigest:string}|{targetOperation:import('./request-operations.mjs').LocationDelegatedOperation;supplierSchemaDigest:string;operationSchemaDigest:string;locationSchemaDigest:string})
 privateWork:{schemaDigest:string};privateContinuation?:never;privateInspection?:never;sourceDelivery?:never
 /** Explicit adoption of host 1.13.0; fresh provider proof before the final
  * outcome. The 5s proof bound and 15s total driver timeout remain unchanged. */
 revalidateExternalAccountBeforeOutcome?:true
}):Readonly<{
 contract:OperationExecutor['contract'];hostContract:typeof PRIVATE_OPERATION_HOST_CONTRACT|typeof NATIVE_ACCOUNT_RECHECK_HOST_CONTRACT|typeof REPORT_ADMISSION_HOST_CONTRACT
 runSqlWork(input:import('./operation-context.mjs').OperationInput,unit:Readonly<{unitId:string;accessMode:import('./request-work.mjs').NativeWorkAccessMode;inputDigest:string}>,action:(context:Readonly<OperationContext>,transaction:Transaction)=>void|Promise<void>):Promise<Readonly<{decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:import('./request-ledger.mjs').RequestReceipt}>>
}>

export declare const SUPPLIER_LOCATION_HOST_CONTRACT:Readonly<{id:'profitia.private-operation-host';version:'1.12.0'}>
export declare const NATIVE_ACCOUNT_RECHECK_HOST_CONTRACT:Readonly<{id:'profitia.private-operation-host';version:'1.13.0'}>
export declare const REPORT_ADMISSION_HOST_CONTRACT:Readonly<{id:'profitia.private-operation-host';version:'1.14.0'}>
