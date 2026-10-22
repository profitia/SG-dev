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

export interface SupplierLocationParent {readonly supplierId:string;readonly organisationId:string;readonly collectionId:string;readonly version:string}
export interface SupplierLocationAdmission {readonly contractVersion:'1.0.0';readonly schemaDigest:string;readonly transactionId:string;readonly organisationId:string;readonly userId:string;readonly resourceId:string;readonly payloadDigest:string;readonly operation:'supplier.location.write'|'supplier.location.sync';readonly action:'CREATE'|'UPDATE'|'DEACTIVATE'|'SYNC';readonly parent:Readonly<SupplierLocationParent>}
export interface SupplierLocationAdmissionOptions {
 schemaDigest:string;proofKey:Uint8Array
 /** Must select and hold the actual current parent using this same transaction. No HTTP facts. */
 readParent(input:{query:import('./access-store.mjs').AccessQuery;actor:Readonly<import('./operation-context.mjs').Actor>;request:Readonly<import('./operation-context.mjs').BoundRequest>;resource:Readonly<Resource>}):Promise<Readonly<SupplierLocationParent>|null>
}
export declare const SUPPLIER_LOCATION_ADMISSION_CONTRACT:Readonly<{id:'profitia.supplier-location-admission';version:'1.0.0';rollingHours:24;capacity:100}>
export declare const supplierLocationAdmissionSchemaUrl:string
export declare function supplierLocationAdmissionSchemaDigest():Promise<string>
export declare function isSupplierLocationAdmission(value:unknown):value is Readonly<SupplierLocationAdmission>
export declare function createSupplierLocationAdmission(options:SupplierLocationAdmissionOptions&{binding:import('./access-store.mjs').AccessStoreBinding}):Readonly<{
 contract:typeof SUPPLIER_LOCATION_ADMISSION_CONTRACT
 locationId(input:{organisationId:string;userId:string;supplierId:string;idempotencyKey:string}):string
 bind(query:import('./access-store.mjs').AccessQuery,input:{actor:Readonly<import('./operation-context.mjs').Actor>;request:Readonly<import('./operation-context.mjs').BoundRequest>;resource:Readonly<Resource>}):Promise<Readonly<SupplierLocationAdmission>>
}>
