import type {Resource,Environment} from './operation-context.mjs'
export type SupplierLocationOperation='supplier.location.read'|'supplier.location.write'|'supplier.location.sync'|'supplier.location.geocode'
export interface SupplierLocationSource {readonly kind:'MGBI'|'KYS';readonly accepted:true;readonly entityType:'COMPANY';readonly retentionUntil:string|null;readonly resource:Readonly<Resource>}
export interface SupplierLocationEvidence {
 readonly supplierId:string;readonly locationId:string|null;readonly group:'ALL'|'SUPPLIER_LOCATIONS'|'RELATED_ENTITIES'|'USER_LOCATIONS'
 readonly origin:'COLLECTION'|'SOURCE'|'MANUAL';readonly addressVersion:string|null;readonly targetVersion:string;readonly exists:boolean
 readonly serverAssignedId:boolean;readonly commandDigest:string;readonly executorApplicationId:string|null;readonly sources:readonly SupplierLocationSource[]
}
export declare const SUPPLIER_LOCATION_CONTRACT:Readonly<{id:'profitia.supplier-location-operation';version:'1.0.0';defaultPaidGeocodingAllowance:0}>
export declare const SUPPLIER_LOCATION_OPERATIONS:readonly SupplierLocationOperation[]
export declare const supplierLocationSchemaUrl:string
export declare function normalizeSupplierLocationEvidence(value:unknown,options:{environment:Environment;organisationId:string;now?:()=>number}):Readonly<SupplierLocationEvidence>
export declare function supplierLocationSchemaDigest():Promise<string>
