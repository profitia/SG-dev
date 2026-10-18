import type { AccessQuery, AccessStoreBinding, IdentityBinding, DatabaseServiceActor } from './access-store.mjs'
import type { Actor, Application, BoundRequest, OperationContext, OperationExecutor, OperationOutcome, Resource } from './operation-context.mjs'
import type { ModuleId } from './module-scope.mjs'

export declare const PRIVATE_OPERATION_HOST_CONTRACT: Readonly<{ id: 'profitia.private-operation-host'; version: '1.6.0' }>
export interface PrivateOperationScope {
  applicationId: string; environment: AccessStoreBinding['environment']; userId: string; organisationId: string | null
}
export interface PrivateTransactionOptions { readonly timeoutMs: number; readonly maxWaitMs: number }
export declare function createPrivateOperationHost<Transaction>(options: {
  application: Application; binding: AccessStoreBinding; now?: () => number; transactionTimeoutMs?: number
  /** Optional, deployment-owned module boundary. Requires SQL002 + accepted SQL003 and the extra descriptor ACL. */
  module?: { id: ModuleId; schemaDigest: string; auditSchemaDigest: string }
  /** AM20 uses SQL006; bounded HUMAN AM23 additionally requires accepted SQL010. No remote dispatch. */
  requestLedger?: { schemaDigest: string; externalSchemaDigest?: string }
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
}): Readonly<OperationExecutor<Transaction> & { hostContract: typeof PRIVATE_OPERATION_HOST_CONTRACT }>
export declare function privateOperationHostSourceDigest(): Promise<string>

/** Private AM27 admission; does not execute a science/source effect. */
export declare function createDelegatedJobHost<Transaction>(options:{
  application:Application;binding:AccessStoreBinding & {service:NonNullable<AccessStoreBinding['service']>}
  job:{schemaDigest:string};now?:()=>number;transactionTimeoutMs?:number;independentQuery:AccessQuery
  transact<T>(action:(session:{query:AccessQuery;transaction:Transaction})=>Promise<T>,limits:PrivateTransactionOptions):Promise<T>
  readExternalAccount(key:Readonly<import('./identity-provider.mjs').ExternalIdentityKey>):Promise<Readonly<import('./identity-provider.mjs').ExternalAccountObservation>|null>
  /** Fixed source adapter. Receives universal payload/key only, never a private actor or transaction. */
  sourceDelivery?:Readonly<import('./platform-ingestion.mjs').PlatformDeliveryPort>
}):Readonly<{contract:OperationExecutor['contract'];hostContract:typeof PRIVATE_OPERATION_HOST_CONTRACT
  admit(input:import('./operation-context.mjs').OperationInput):Promise<Readonly<{decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:import('./delegated-job.mjs').DispatchAdmission}>>
  deliver?(input:import('./operation-context.mjs').OperationInput,admission:Extract<import('./delegated-job.mjs').DispatchAdmission,{status:'READY'}>):Promise<Readonly<{decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:import('./delegated-job.mjs').DispatchAdmission}>>
}>

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
