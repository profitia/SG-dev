import type { Actor, AuditEvent, OperationState, Environment } from './operation-context.mjs'
export interface IdentityBinding {
  environment: Environment; issuer: string; subject: string; userId: string
  status: 'ACTIVE'; version: string; sourceRef: string; expiresAt: string
}
export interface AccessStoreBinding {
  applicationId: string; environment: Environment; projectId: string; branchId: string
  databaseName: string; role: string; schemaDigest: string
}
/** A query bound to the host's single transaction, never a pool-level query. */
export type AccessQuery = (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
export interface LockedAccess {
  readonly state: Readonly<Omit<OperationState,'resource'> & { identityBindingVersion: string; transactionId: string }>
  readonly userId: string; readonly organisationId: string | null
  readonly expiresAt: string; readonly transactionId: string
}
export declare const ACCESS_STORE_CONTRACT: Readonly<{ id: 'profitia.access-store'; version: '1.1.0'; schemaVersion: '1.0.0' }>
export declare const accessSchemaUrl: string
export declare const moduleAuditSchemaUrl: string
export declare function createAccessStore(options: { binding: AccessStoreBinding; now?: () => number }): Readonly<{
  contract: typeof ACCESS_STORE_CONTRACT
  resolveBinding(query: AccessQuery, key: Pick<IdentityBinding,'environment'|'issuer'|'subject'>): Promise<Readonly<IdentityBinding> | null>
  lockAccess(query: AccessQuery, input: { actor: Actor; identityBinding: IdentityBinding | null; organisationId: string | null }): Promise<LockedAccess>
  verifyScope(query: AccessQuery, lease: LockedAccess): Promise<void>
  verifyModuleAudit(query: AccessQuery, expectedDigest: string): Promise<void>
  appendAudit(query: AccessQuery, event: AuditEvent, lease?: LockedAccess): Promise<void>
}>
export declare function accessStoreSourceDigest(): Promise<string>
export declare function accessSchemaDigest(): Promise<string>
export declare function moduleAuditSchemaDigest(): Promise<string>
