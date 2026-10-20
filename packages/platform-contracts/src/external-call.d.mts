import type {Json} from './operation-context.mjs'
import type {AccessQuery} from './access-store.mjs'
import type {createPlatformIngestionHost} from './platform-ingestion.mjs'
import type {NativeExternalTransport,NativeExternalResult} from './native-external-transport.mjs'
export {NATIVE_EXTERNAL_TRANSPORT,nativeExternalTransportSchemaUrl} from './native-external-transport.mjs'
export type {NativeExternalTransport,NativeExternalResult,NativePathRule} from './native-external-transport.mjs'
export declare const EXTERNAL_CALL_CONTRACT:Readonly<{id:'profitia.external-call';version:'1.0.0';unit:'UPSTREAM_ATTEMPT_ADMISSION'}>
export declare const publicWebTransportSchemaUrl:string
export declare function publicWebTransportSchemaDigest():Promise<string>
export declare const externalCallSchemaUrl:string
export declare function externalCallSchemaDigest():Promise<string>
export declare function externalCallSourceDigest():Promise<string>
export declare function nativeExternalTransportSchemaDigest():Promise<string>
export declare class ExternalCallUnavailable extends Error{
  readonly certainty:'NOT_SENT'|'UNVERIFIED'|'RESULT_NOT_RETAINED';readonly retryAllowed:false
  constructor(certainty?:'NOT_SENT'|'UNVERIFIED'|'RESULT_NOT_RETAINED')
}
export interface ExternalCallResult{readonly status:number;readonly body:Json}
export interface ExternalCallEvidence{
 readonly sourceId:string;readonly resourceId:string;readonly applicationId:string;readonly environment:string
 readonly callId:string;readonly attemptEffectId:string;readonly settlementEffectId:string
 readonly unit:'UPSTREAM_ATTEMPT_ADMISSION';readonly status:'RESPONSE'
 readonly transportProtocol?:'profitia.external-native-http'
}
export declare function externalCallEvidence(value:unknown):Readonly<ExternalCallEvidence>|null
/** Runtime verifies the original successful settlement, including result identity. */
export declare function externalNativeResponse(value:NativeExternalResult):Response
export interface ExternalCallOptions<Transaction,Command>{
 sourceHost:ReturnType<typeof createPlatformIngestionHost<Transaction>>;sourceId:string;resourceId:string
 binding:{role:string;configurationVersion:string;schemaDigest:string;origin:string|null;transport:'HTTPS'|'LOCAL_SYNTHETIC_HTTP'|'PUBLIC_WEB';pathRules:readonly Readonly<{method:'GET'|'POST';path:string}>[]}
 /** Opt-in credential-free public GET. Any synthetic origin requires matching actual Development-only SQL authority. */
 publicWebTransport?:Readonly<{schemaDigest:string;syntheticOrigin?:string}>
 independentQuery:AccessQuery;query(transaction:Transaction,sql:string,values?:unknown[]):ReturnType<AccessQuery>;now?:()=>number
 /** Closed server-owned command parser; never receives authority from the browser. */
 parseCommand(command:unknown):Command
 /** Fixed destination policy; this builder cannot expand the installed path rules. */
 buildRequest(command:Command):Readonly<{method:'GET'|'POST';url:string;body:string|null}>
 /** Return existing credentials only. Any token-exchange I/O needs separate admission. */
 getHeaders?(command:Command,options:{signal:AbortSignal}):Promise<Record<string,string>>|Record<string,string>
}
type ExecuteHost<Result>=Readonly<{contract:typeof EXTERNAL_CALL_CONTRACT
 execute(input:Readonly<{command:unknown;intentKey:string}>,options?:Readonly<{signal?:AbortSignal}>):Promise<Readonly<Result>>}>
type NativeCredentialOptions=({nativeTransport:NativeExternalTransport&{readonly credentialMode:'NONE'};getHeaders?:never}
 |{nativeTransport:NativeExternalTransport&{readonly credentialMode:'SERVER_HEADERS'}})
export declare function createExternalCallHost<Transaction,Command>(options:ExternalCallOptions<Transaction,Command>&NativeCredentialOptions&{
 projectResponse?:never
}):ExecuteHost<NativeExternalResult>
export declare function createExternalCallHost<Transaction,Command>(options:ExternalCallOptions<Transaction,Command>&{
 nativeTransport?:never
 /** Pure bounded projection; no unadmitted I/O or other side effects. */
 projectResponse(value:Json,options:{status:number;signal:AbortSignal}):Json|Promise<Json>
}):ExecuteHost<ExternalCallResult>
