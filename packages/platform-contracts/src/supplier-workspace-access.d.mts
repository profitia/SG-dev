export type SupplierWorkspaceOperation =
 |'supplier.catalog.read'|'supplier.catalog.write'|'supplier.category.read'|'supplier.category.write'
 |'supplier.pipeline.read'|'supplier.pipeline.write'|'supplier.assignment.read'|'supplier.assignment.write'
 |'supplier.adp-status.read';
export interface SupplierWorkspaceOperationDescription {
 readonly operation:SupplierWorkspaceOperation;readonly resourceType:string;
 readonly accessMode:'READ'|'WRITE';readonly newRootOperation:boolean;
 readonly nativeUnitId:'SUPPLIER_WORKSPACE_READ'|'SUPPLIER_WORKSPACE_WRITE';
}
export interface SupplierWorkspaceNativeDescriptor {
 applicationId:'srm';environment:'development';runtimeRole:string;databaseName:string;transactionId:string;
 organisationId:string;actorAccountId:string;operation:SupplierWorkspaceOperation;
 nativeUnitId:'SUPPLIER_WORKSPACE_READ'|'SUPPLIER_WORKSPACE_WRITE';accessMode:'READ'|'WRITE';
 payloadDigest:string;schemaDigest:string;sourceRef:string;policyVersion:string;expiresAt:string;
}
export const SUPPLIER_WORKSPACE_ACCESS_PROPOSAL:Readonly<{
 id:'platform.supplier-workspace-access';version:'1.0.0';status:'PROPOSED_NOT_ADOPTED';
 initiativeId:string;baseline:string;moduleId:'supplier_workspace';feature:'supplier_workspace';
 dataClass:'ORGANISATION_PRIVATE';operations:readonly SupplierWorkspaceOperationDescription[];
 actorBoundary:string;capabilities:string;preserves:readonly string[];
 sqlBoundary:Readonly<{scopeSignature:string;memberSignature:string;descriptorSignature:string;
 runtimeRights:string;scopeBinding:readonly string[];master:string;masterFenceChange:string}>;
 developmentBinding:Readonly<{serviceId:string;projectId:string;branchId:string;databaseName:string;schema:string;runtimeRole:string}>;
 requiresOwnerDecision:readonly string[];exclusions:readonly string[];
}>;
export function describeSupplierWorkspaceOperation(operation:string):SupplierWorkspaceOperationDescription;
/** Checks metadata agreement only; it is not an authorization proof. */
export function assertSupplierWorkspaceDescriptorMatches(actual:unknown,expected:SupplierWorkspaceNativeDescriptor,options?:{now?:()=>number}):void;
