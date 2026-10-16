export type OperationId = 'account.settings.read' | 'account.settings.write' | 'knowledge.read' | 'benchmark.selection.read' | 'benchmark.selection.write' | 'personal.list.read' | 'personal.list.write' | 'supplier.report.read' | 'supplier.report.project'
export type Environment = 'development' | 'staging' | 'production'
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export interface Actor {
  kind: 'HUMAN' | 'SERVICE'; actorId: string; userId?: string; serviceId?: string
  proofRef: string; issuer: string; audience: string; environment: Environment; expiresAt: string
}
export interface Application {
  appId: string; profileId: 'PORR_SUITE' | 'SPENDGURU_SAAS' | 'SUPPLIER_INTELLIGENCE_STANDALONE'
  deploymentId: string; configurationVersion: string; environment: Environment; identityIssuer: string
  organisationId: string | null; operations: OperationId[]; features: string[]
}
export interface Permission { operation: string; feature: string; resourceId: string | null }
export interface AccessBasis {
  type: 'MEMBERSHIP' | 'SERVICE_GRANT' | 'DELEGATED_USER' | 'ACCOUNT_SELF'; actorId: string
  organisationId: string | null; status: string; version: string; sourceRef: string; expiresAt: string
  permissions: Permission[]; denies: Permission[]
}
export interface Resource {
  id: string; type: string; dataClass: string; environment: Environment
  ownerOrganisationId: string | null; ownerUserId: string | null; version: string; projectionVersion: string
  approvedSharedProjection?: boolean; contentRequirements?: Array<{ product: string; feature: string }>
}
export interface ProductGrant {
  product: string; features: string[]; organisationId: string; environment: Environment; applicationId: string
  status: string; version: string; sourceRef: string; source: 'CONTRACT' | 'VERIFIED_BILLING' | 'EXPLICIT_OFFER'; expiresAt: string
}
export interface OperationState {
  policyVersion: string; applicationId: string; environment: Environment
  access: AccessBasis; resource: Resource; products: ProductGrant[]; usagePolicy: 'NOT_APPLICABLE'; inputs?: Resource[]
}
export interface OperationContext {
  decisionId: string; contractVersion: string; implementationVersion: string; applicationId: string
  deploymentId: string; configurationVersion: string; environment: Environment; operation: OperationId
  actorId: string; actorKind: 'HUMAN' | 'SERVICE'; actor: Readonly<Actor>; subjectUserId: string | null
  organisationId: string | null; mode: 'ORGANISATION' | 'ACCOUNT'; policyVersion: string; accessVersion: string
  accessSourceRef: string; feature: string; effect: 'READ' | 'WRITE'; resourceId: string; resource: Readonly<Resource>
  payload: Json; payloadDigest: string; correlationId: string
}
export interface AuditEvent {
  decisionId: string; applicationId: string; environment: Environment; operation: string | null
  actorId: string | null; actorKind: string | null; subjectUserId: string | null; organisationId: string | null
  phase: 'INTENT' | 'OUTCOME' | 'DECISION' | 'FAILURE'; decision: 'ALLOW' | 'DENY'; reasonCode: string
  [key: string]: unknown
}
export interface OperationInput {
  contractId: string; contractVersion: string; operation: string; organisationId: string | null
  resourceId: string; payload: Json; request: unknown
}
export interface BoundRequest {
  operation: OperationId; resourceId: string; organisationId: string | null; payload: Json; payloadDigest: string
}
export interface OperationSession<Transaction> {
  state: OperationState; transaction: Transaction; transactionalEffects: true; outputBoundaryVersion: string
  recordOutcome(event: AuditEvent): Promise<void>
  projectOutput(value: unknown, context: Readonly<OperationContext>): unknown | Promise<unknown>
}
export interface OperationExecutor<Transaction = unknown> {
  contract: Readonly<{ id: string; version: string; implementation: string }>
  execute<T>(input: OperationInput, action: (context: Readonly<OperationContext>, transaction: Transaction) => T | Promise<T>): Promise<Readonly<{ decision: 'ALLOW'; decisionId: string; contractVersion: string; value: T }>>
}
export declare const OPERATION_CONTRACT: Readonly<{ id: 'profitia.operation-context'; version: '1.0.0'; implementation: '1.0.0-candidate.1' }>
export declare const IMPLEMENTED_OPERATIONS: readonly OperationId[]
export declare class OperationDenied extends Error { reasonCode: string; decisionId: string; constructor(reasonCode: string, decisionId?: string) }
export declare function operationPayloadDigest(payload: Json): string
export declare function operationSourceDigest(): Promise<string>
export declare function createOperationExecutor<Transaction>(options: {
  application: Application; now?: () => number
  authenticate(request: unknown): Promise<Actor | null>
  /** Locks authoritative state and commits effects + OUTCOME atomically; rollback on throw. */
  withTransaction<T>(binding: { actor: Readonly<Actor>; request: Readonly<BoundRequest> }, action: (session: OperationSession<Transaction>) => Promise<T>): Promise<T>
  /** Independent durable append: INTENT before effect, DENY/FAILURE after rollback. */
  recordAudit(event: AuditEvent): Promise<void>
}): OperationExecutor<Transaction>
