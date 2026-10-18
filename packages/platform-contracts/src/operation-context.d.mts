import type { RequestPolicy, RequestReservation, RequestReceipt } from './request-ledger.mjs'
export type OperationId = 'account.settings.read' | 'account.settings.write' | 'knowledge.read' | 'benchmark.selection.read' | 'benchmark.selection.write' | 'category.read' | 'category.write' | 'supplier.assignment.read' | 'supplier.assignment.write' | 'forecast.read' | 'forecast.request' | 'job.execute' | 'knowledge.ingest' | 'personal.list.read' | 'personal.list.write' | 'supplier.report.read' | 'supplier.report.project' | 'supplier.report.export'
export type OperationOutcome = 'SUCCEEDED' | 'NO_DATA' | 'SELECTION_UNAVAILABLE'
export type Environment = 'development' | 'staging' | 'production'
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export interface Actor {
  kind: 'HUMAN' | 'SERVICE'; actorId: string; userId?: string; serviceId?: string
  proofRef: string; issuer: string; audience: string; environment: Environment; expiresAt: string
}
export interface Application {
  appId: string; profileId: 'PORR_SUITE' | 'SPENDGURU_SAAS' | 'SUPPLIER_INTELLIGENCE_STANDALONE' | 'PLATFORM_INTERNAL'
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
  access: AccessBasis; resource: Resource; products: ProductGrant[]; usagePolicy: 'NOT_APPLICABLE' | 'PRODUCT_POLICY' | 'PLATFORM_BUDGET'; requestPolicy?: Readonly<RequestPolicy>; inputs?: Resource[]
  ingestion?: Readonly<IngestionPolicy>
  delegation?: Readonly<DelegatedJob>
  dispatchAdmission?: import('./delegated-job.mjs').DispatchAdmission
}
export interface IngestionPolicy {
  sourceId:string;effectKind:'STORED_SQL_TRANSACTION';sourceVersion:string;sourceRef:string;payloadSchema:string
  qualityVersion:string;classificationVersion:string;expiresAt:string;policyId:string;policyVersion:string
  unit:'SOURCE_TRANSACTION';capacity:number;used:number;windowStart:string;windowEnd:string;policySourceRef:string
}
export interface DelegatedJob {
  delegationId: string; jobId: string; requestId: string; sourceId: string; deliveryKey: string
  status: 'PENDING' | 'READY' | 'CONFIRMED' | 'UNCERTAIN'; payloadDigest: string
  subjectUserId: string; organisationId: string; executorApplicationId: string
  sourceBinding:Pick<import('./platform-ingestion.mjs').PlatformSourceBinding,'projectId'|'branchId'|'databaseName'|'applicationId'|'schemaDigest'|'payloadSchema'|'qualityVersion'|'classificationVersion'>
  bindingId: string; bindingVersion: string; expiresAt: string
  identityKey: Readonly<import('./identity-provider.mjs').ExternalIdentityKey>
  externalAccountObservation: Readonly<import('./identity-provider.mjs').ExternalAccountObservation>
  target: { application: Pick<Application,'appId'|'environment'|'profileId'|'configurationVersion'|'organisationId'|'features'|'operations'>
    operation: 'forecast.request'; resourceId: string; policyVersion: string; access: AccessBasis; resource: Resource; products: ProductGrant[]
    module: {id:'benchmark';bindingId:string;version:string;sourceRef:string;expiresAt:string} }
}
/** Trusted module binding provenance; carries no credential or permission. */
export interface ModuleEvidence {
  moduleId: 'benchmark' | 'category' | 'supplier_report'; moduleBindingId: string
  version: string; sourceRef: string; expiresAt: string; transactionId: string
  moduleSchemaDigest: string; auditSchemaDigest: string
}
export interface OperationContext {
  decisionId: string; contractId: string; contractVersion: string; implementationVersion: string; applicationId: string
  applicationProfile: string; occurredAt: string; operationStartedAt: string
  deploymentId: string; configurationVersion: string; environment: Environment; operation: OperationId
  actorId: string; actorKind: 'HUMAN' | 'SERVICE'; actor: Readonly<Actor>; subjectUserId: string | null
  organisationId: string | null; mode: 'ORGANISATION' | 'ACCOUNT' | 'PLATFORM'; policyVersion: string; accessVersion: string
  accessSourceRef: string; accessBasisType: AccessBasis['type']; feature: string; effect: 'READ' | 'WRITE' | 'EXPORT' | 'REQUEST_COMPUTE' | 'EXECUTE_BOUND_OPERATION'; resourceId: string; resource: Readonly<Resource>
  productEvidence: ReadonlyArray<Pick<ProductGrant, 'product' | 'version' | 'sourceRef' | 'source' | 'expiresAt'> & { feature: string }>; usagePolicy: 'NOT_APPLICABLE' | 'PRODUCT_POLICY' | 'PLATFORM_BUDGET'
  platformReservation?:Readonly<{effectId:string;replay:boolean;policyId:string;policyVersion:string}>
  sourceId?:string;sourceVersion?:string;qualityVersion?:string;classificationVersion?:string;payloadSchema?:string
  budgetPolicyId?:string;budgetPolicyVersion?:string;budgetUnit?:'SOURCE_TRANSACTION'
  requestReservation?: Readonly<{requestId:string;replay:boolean;policyId:string;policyVersion:string}>
  moduleEvidence?: Readonly<ModuleEvidence>
  delegation?: Readonly<DelegatedJob>
  dispatchAdmission?: import('./delegated-job.mjs').DispatchAdmission
  payload: Json; payloadDigest: string; correlationId: string
}
export interface AuditEvent {
  decisionId: string; occurredAt: string; operationStartedAt: string; applicationId: string; environment: Environment; operation: string | null
  actorId: string | null; actorKind: string | null; subjectUserId: string | null; organisationId: string | null
  phase: 'INTENT' | 'OUTCOME' | 'DECISION' | 'FAILURE'; decision: 'ALLOW' | 'DENY'; reasonCode: string
  moduleEvidence?: Readonly<ModuleEvidence>
  [key: string]: unknown
}
export interface OperationInput {
  contractId: string; contractVersion: string; operation: string; organisationId: string | null
  resourceId: string; payload: Json; request: unknown; idempotencyKey?: string
}
export interface BoundRequest {
  operation: OperationId; resourceId: string; organisationId: string | null; payload: Json; payloadDigest: string; idempotencyKey?: string
}
export interface OperationSession<Transaction> {
  state: OperationState; transaction: Transaction; transactionalEffects: true; outputBoundaryVersion: string
  recordOutcome(event: AuditEvent): Promise<void>
  /** Required for AM20; same current private transaction, no external compute. */
  reserveUsage?(context: Readonly<OperationContext>): Promise<RequestReservation>
  completeRequest?(context: Readonly<OperationContext>, value: RequestReceipt): Promise<void>
  /** Private dispatch only; source delivery is a separate transaction/authority. */
  admitDispatch?(context: Readonly<OperationContext>): Promise<import('./delegated-job.mjs').DispatchAdmission>
  reserveIngestion?(context:Readonly<OperationContext>):Promise<{status:'NEW'|'REPLAY';effectId:string;policyId:string;policyVersion:string;receipt?:{effectId:string;status:'COMMITTED'}}>
  completeIngestion?(context:Readonly<OperationContext>,receipt:{effectId:string;status:'COMMITTED'}):Promise<void>
  moduleEvidence?: Readonly<ModuleEvidence>
  projectOutput(value: unknown, context: Readonly<OperationContext>): unknown | Promise<unknown>
  /** Export only: separately authorised/audited local SQL preparation in this transaction. No external effects. */
  prepareInputs?(context: Readonly<OperationContext>): void | Promise<void>
  /** Server-owned interpretation after output validation; never an HTTP-supplied decision. */
  describeOutcome?(value: unknown, context: Readonly<OperationContext>): OperationOutcome | Promise<OperationOutcome>
}
export interface OperationExecutor<Transaction = unknown> {
  contract: Readonly<{ id: string; version: string; implementation: string }>
  execute<T>(input: OperationInput, action: (context: Readonly<OperationContext>, transaction: Transaction) => T | Promise<T>): Promise<Readonly<{ decision: 'ALLOW'; decisionId: string; contractId: string; contractVersion: string; value: T }>>
}
export declare const OPERATION_CONTRACT: Readonly<{ id: 'profitia.operation-context'; version: '1.0.0'; implementation: '1.0.0-candidate.7' }>
export declare const IMPLEMENTED_OPERATIONS: readonly OperationId[]
export declare class OperationDenied extends Error { reasonCode: string; decisionId: string; constructor(reasonCode: string, decisionId?: string) }
export declare function isOperationDenied(error: unknown): error is OperationDenied
export declare function operationPayloadDigest(payload: Json): string
export declare function operationSourceDigest(): Promise<string>
export declare function normalizeModuleEvidence(value: unknown, options?: { now?: () => number; allowExpired?: boolean }): Readonly<ModuleEvidence>
export declare function createOperationExecutor<Transaction>(options: {
  application: Application; now?: () => number
  authenticate(request: unknown): Promise<Actor | null>
  /** Locks authoritative state and commits effects + OUTCOME atomically; rollback on throw. */
  withTransaction<T>(binding: { actor: Readonly<Actor>; request: Readonly<BoundRequest> }, action: (session: OperationSession<Transaction>) => Promise<T>): Promise<T>
  /** Independent durable append: INTENT before effect, DENY/FAILURE after rollback. */
  recordAudit(event: AuditEvent): Promise<void>
}): OperationExecutor<Transaction>
