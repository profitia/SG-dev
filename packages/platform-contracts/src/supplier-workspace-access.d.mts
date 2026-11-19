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

import type {OperationContext,Application,OperationId} from './operation-context.mjs';
import type {AccessQuery} from './access-store.mjs';
export const SUPPLIER_WORKSPACE_ROOT_IMPLEMENTATION:'1.0.0-candidate.26';
export const SUPPLIER_WORKSPACE_OPERATIONS:readonly SupplierWorkspaceOperation[];
export const SUPPLIER_WORKSPACE_NEW_OPERATIONS:readonly SupplierWorkspaceOperation[];
export const SUPPLIER_WORKSPACE_OPERATION_RULES:Readonly<Record<string,Readonly<{feature:'supplier_workspace';resourceType:string;dataClass:'ORGANISATION_PRIVATE';effect:'READ'|'WRITE';product:null;mode:'ORGANISATION'}>>>;
export function supplierWorkspaceOperationPolicy(operation:string):SupplierWorkspaceOperationDescription|null;
export function validateSupplierWorkspaceAdoption(options:{application?:Application;supplierWorkspaceSchemaDigest?:string;[key:string]:unknown}):boolean;
export function supplierWorkspaceRequiredPermissions(operation:string,payload:unknown):readonly SupplierWorkspaceOperation[];
export const supplierWorkspaceSchemaUrl:string;
export interface SupplierWorkspaceLease extends SupplierWorkspaceNativeDescriptor {
 readonly decisionId:string;readonly resourceId:string;readonly accessPolicyVersion:string;
}
export function createSupplierWorkspaceScopeStore(options:{schemaDigest:string;sourceRef:string;now?:()=>number}):Readonly<{
 bind(query:AccessQuery,context:Readonly<OperationContext>):Promise<Readonly<SupplierWorkspaceLease>>;
 verify(query:AccessQuery,lease:Readonly<SupplierWorkspaceLease>,context:Readonly<OperationContext>):Promise<void>;
 execute(query:AccessQuery,lease:Readonly<SupplierWorkspaceLease>,context:Readonly<OperationContext>):Promise<unknown>;
}>;
export function supplierWorkspaceSourceDigest():Promise<string>;
