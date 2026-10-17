import type { Actor, AuditEvent, OperationState, Environment } from './operation-context.mjs'
export type DatabaseServiceActor = Actor & { kind: 'SERVICE'; serviceId: string; userId?: never }
export interface IdentityBinding {
  environment: Environment; issuer: string; subject: string; userId: string
  status: 'ACTIVE'; version: string; sourceRef: string; expiresAt: string
}
export interface AccessStoreBinding {
  applicationId: string; environment: Environment; projectId: string; branchId: string
  databaseName: string; role: string; schemaDigest: string
  /** Explicit separate SQL005 capability. Never silently selects a service host. */
  service?: { schemaDigest: string; profileId: string; deploymentId: string; configurationVersion: string }
}
/** A query bound to the host's single transaction, never a pool-level query. */
export type AccessQuery = (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>
export interface LockedAccess {
  readonly state: Readonly<Omit<OperationState,'resource'> & { identityBindingVersion: string; transactionId: string }>
  readonly userId: string; readonly organisationId: string | null
  readonly expiresAt: string; readonly transactionId: string
}
export interface LockedServiceRead {
  readonly state: Readonly<Omit<OperationState,'resource'> & { serviceBindingVersion: string; transactionId: string }>
  readonly userId: null; readonly serviceId: string; readonly organisationId: string
  readonly operation: 'knowledge.read' | 'forecast.read' | 'supplier.report.read'; readonly resourceId: string
  readonly expiresAt: string; readonly transactionId: string
}
export declare const ACCESS_STORE_CONTRACT: Readonly<{ id: 'profitia.access-store'; version: '1.2.0'; schemaVersion: '1.0.0' }>
export declare const DATABASE_SERVICE_ISSUER: 'urn:profitia:database-service-runtime:v1'
export declare const accessSchemaUrl: string
export declare const moduleAuditSchemaUrl: string
export declare const serviceReadSchemaUrl: string
export declare function createAccessStore(options: { binding: AccessStoreBinding; now?: () => number }): Readonly<{
  contract: typeof ACCESS_STORE_CONTRACT
  resolveBinding(query: AccessQuery, key: Pick<IdentityBinding,'environment'|'issuer'|'subject'>): Promise<Readonly<IdentityBinding> | null>
  lockAccess(query: AccessQuery, input: { actor: Actor; identityBinding: IdentityBinding | null; organisationId: string | null }): Promise<LockedAccess>
  /** Derived from the authenticated ordinary SQL login and current deployment binding; ignores HTTP claims. */
  resolveServiceActor(query: AccessQuery): Promise<Readonly<DatabaseServiceActor> | null>
  lockServiceRead(query: AccessQuery, input: {
    actor: DatabaseServiceActor; organisationId: string; operation: LockedServiceRead['operation']; resourceId: string
  }): Promise<LockedServiceRead>
  verifyScope(query: AccessQuery, lease: LockedAccess | LockedServiceRead): Promise<void>
  verifyModuleAudit(query: AccessQuery, expectedDigest: string): Promise<void>
  appendAudit(query: AccessQuery, event: AuditEvent, lease?: LockedAccess | LockedServiceRead): Promise<void>
}>
export declare function accessStoreSourceDigest(): Promise<string>
export declare function accessSchemaDigest(): Promise<string>
export declare function moduleAuditSchemaDigest(): Promise<string>
export declare function serviceReadSchemaDigest(): Promise<string>
