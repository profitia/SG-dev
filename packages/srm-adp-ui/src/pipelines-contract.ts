/**
 * Public, transport-free DTOs for SRM supplier pipelines 1.0.0.
 * This declares no workspace UI or automatic adoption by an existing host.
 */
export const SUPPLIER_PIPELINES_CONTRACT_ID = 'srm.supplier-pipelines' as const;
export const SUPPLIER_PIPELINES_CONTRACT_VERSION = '1.0.0' as const;
export type SupplierLifecycle = 'ACTIVE' | 'ARCHIVED';
export type SupplierPipelineKind = 'SUPPLIER' | 'CATEGORY';
export interface SupplierCategory {
  categoryId: string; name: string; lifecycle: SupplierLifecycle; version: number;
}
export interface SupplierContact { contactId: string; name: string; role: string | null; email: string | null; phone: string | null }
export interface SupplierMembership {
  membershipId: string; supplierId: string; pipelineId: string; pipelineName: string;
  stageId: string; stageName: string; kind: SupplierPipelineKind; version: number;
  startedAt: string; endedAt: string | null; endReason: string | null;
}
export interface SupplierPipeline {
  pipelineId: string; kind: SupplierPipelineKind; name: string; categoryId: string | null;
  stages: readonly { stageId: string; name: string; order: number; activeCount: number }[];
  activeCount: number; lifecycle: SupplierLifecycle; version: number;
}
export interface SupplierAdpStatusSnapshot {
  status: 'UNKNOWN' | 'MISSING' | 'CURRENT' | 'OUTDATED' | 'RENEWAL_REQUIRED';
  projectionVersion: 1; sourceLabel?: string; confirmedAt?: string; asOf?: string; signedAt?: string; validUntil?: string;
}
export interface SupplierCard {
  supplierId: string; nipNormalized: string | null; displayName: string;
  contacts: readonly SupplierContact[];
  relationshipOwner: { accountId: string; displayName: string | null; state: 'ACTIVE' | 'UNAVAILABLE' } | null;
  cardCategories: readonly SupplierCategory[]; memberships: readonly SupplierMembership[];
  adp: SupplierAdpStatusSnapshot; lifecycle: SupplierLifecycle; version: number; updatedAt: string;
}
export interface SupplierPage<T> { items: readonly T[]; nextCursor: string | null; totalCount: number }
export interface SupplierWorkspaceEvent {
  eventId: string; actorAccountId: string; commandId: string; occurredAt: string; action: string;
  supplierId: string | null; pipelineId: string | null; before: unknown; after: unknown;
}
export interface SupplierPipelineSuccess<T> {
  contractId: typeof SUPPLIER_PIPELINES_CONTRACT_ID; contractVersion: typeof SUPPLIER_PIPELINES_CONTRACT_VERSION;
  requestId: string; serverTime: string; result: T;
}
export interface SupplierPipelineFailure {
  contractId: typeof SUPPLIER_PIPELINES_CONTRACT_ID; contractVersion: typeof SUPPLIER_PIPELINES_CONTRACT_VERSION;
  requestId: string; error: { code: string; message: string; retryable: boolean;
    fieldErrors?: Readonly<Record<string,string>>;
    existingSupplier?: { supplierId: string; displayName: string; lifecycle: SupplierLifecycle } };
}

/** Participant page and counts are server projections, never derived from a partial UI page. */
export interface SupplierPipelineDetails extends SupplierPipeline {
  memberships: SupplierPage<SupplierMembership & {supplierDisplayName: string; nipNormalized: string}>;
}
