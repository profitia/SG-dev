export interface NativeFixedPathRule {readonly method:'GET'|'POST';readonly path:string;readonly requestFormat:'NONE'|'JSON'|'FORM'}
export interface NativeTemplatePathRule {readonly method:'GET'|'POST';readonly prefix:string;readonly parameter:'HEX24'|'UUID'|'OPAQUE'|'STORAGE_PATH'|'PUBLIC_PATH';readonly suffix:string;readonly requestFormat:'NONE'|'JSON'|'FORM'}
export type NativePathRule=NativeFixedPathRule|NativeTemplatePathRule
export interface NativeExternalTransport {
 readonly schemaDigest:string;readonly pathRules:readonly NativePathRule[];readonly redirectOrigins:readonly string[]
 readonly maximumResponseBytes:number;readonly credentialMode:'NONE'|'SERVER_HEADERS'
 readonly completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'
}
/** Unclassified internal provider data. This is not a HUMAN access grant. */
export interface NativeExternalResult {
 readonly status:number;readonly url:string;readonly headers:Readonly<Record<string,string>>;readonly bytes:Uint8Array
 toJSON():{protocol:'profitia.external-native-http';status:number;byteLength:number}
}
export declare const NATIVE_EXTERNAL_TRANSPORT:Readonly<{id:'profitia.external-native-http';version:'1.0.0';completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'}>
export declare const nativeExternalTransportSchemaUrl:string
