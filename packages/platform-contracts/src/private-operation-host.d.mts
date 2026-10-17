import type { AccessQuery, AccessStoreBinding, IdentityBinding } from './access-store.mjs'
import type { Actor, Application, BoundRequest, OperationContext, OperationExecutor, Resource } from './operation-context.mjs'
import type { ModuleId } from './module-scope.mjs'

export declare const PRIVATE_OPERATION_HOST_CONTRACT: Readonly<{ id: 'profitia.private-operation-host'; version: '1.1.0' }>
export interface PrivateOperationScope {
  applicationId: string; environment: AccessStoreBinding['environment']; userId: string; organisationId: string | null
}
export interface PrivateTransactionOptions { readonly timeoutMs: number; readonly maxWaitMs: number }
export declare function createPrivateOperationHost<Transaction>(options: {
  application: Application; binding: AccessStoreBinding; now?: () => number; transactionTimeoutMs?: number
  /** Optional, deployment-owned module boundary. Requires SQL002 + accepted SQL003 and the extra descriptor ACL. */
  module?: { id: ModuleId; schemaDigest: string; auditSchemaDigest: string }
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
}): Readonly<OperationExecutor<Transaction> & { hostContract: typeof PRIVATE_OPERATION_HOST_CONTRACT }>
export declare function privateOperationHostSourceDigest(): Promise<string>
