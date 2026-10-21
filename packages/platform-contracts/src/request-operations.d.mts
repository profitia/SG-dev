export type AdditionalRequestOperation='supplier.private.refresh'|'benchmark.discovery.request'
export type LocationRequestOperation='supplier.location.write'|'supplier.location.sync'|'supplier.location.geocode'
export type LocationDelegatedOperation=Exclude<LocationRequestOperation,'supplier.location.write'>
export type RequestOperation=LocationRequestOperation|'forecast.request'|'supplier.report.refresh'|AdditionalRequestOperation
export interface RequestOperationPolicy {
 readonly feature:'forecast'|'supplier_report'|'benchmark';readonly module:'benchmark'|'supplier_report'
 readonly product:'SPENDGURU'|'SUPPLIER_INTELLIGENCE';readonly resourceType:string;readonly projectionVersion:string
 readonly profiles:readonly ('PORR_SUITE'|'SPENDGURU_SAAS'|'SUPPLIER_INTELLIGENCE_STANDALONE')[]
 readonly location?:boolean;readonly delegated?:boolean;readonly external:boolean;readonly additional:boolean;readonly nativeWork:boolean
}
export declare const REQUEST_OPERATIONS:readonly RequestOperation[]
export declare function requestOperationPolicy(operation:unknown):Readonly<RequestOperationPolicy>|null
export declare const additionalRequestSchemaUrl:string
export declare function additionalRequestSchemaDigest():Promise<string>
export declare function requestOperationsSourceDigest():Promise<string>
