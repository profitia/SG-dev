import type {Json} from './operation-context.mjs'
import type {AccessQuery} from './access-store.mjs'
import type {createPlatformIngestionHost} from './platform-ingestion.mjs'
export declare const EXTERNAL_CALL_CONTRACT:Readonly<{id:'profitia.external-call';version:'1.0.0';unit:'UPSTREAM_ATTEMPT_ADMISSION'}>
export declare const externalCallSchemaUrl:string
export declare function externalCallSchemaDigest():Promise<string>
export declare function externalCallSourceDigest():Promise<string>
export declare class ExternalCallUnavailable extends Error{
  readonly certainty:'NOT_SENT'|'UNVERIFIED'|'RESULT_NOT_RETAINED';readonly retryAllowed:false
  constructor(certainty?:'NOT_SENT'|'UNVERIFIED'|'RESULT_NOT_RETAINED')
}
export interface ExternalCallResult{readonly status:number;readonly body:Json}
export interface ExternalCallEvidence{
 readonly sourceId:string;readonly resourceId:string;readonly applicationId:string;readonly environment:string
 readonly callId:string;readonly attemptEffectId:string;readonly settlementEffectId:string
 readonly unit:'UPSTREAM_ATTEMPT_ADMISSION';readonly status:'RESPONSE'
}
export declare function externalCallEvidence(value:unknown):Readonly<ExternalCallEvidence>|null
export declare function createExternalCallHost<Transaction,Command>(options:{
 sourceHost:ReturnType<typeof createPlatformIngestionHost<Transaction>>;sourceId:string;resourceId:string
 binding:{role:string;configurationVersion:string;schemaDigest:string;origin:string;transport:'HTTPS'|'LOCAL_SYNTHETIC_HTTP';pathRules:readonly Readonly<{method:'GET'|'POST';path:string}>[]}
 independentQuery:AccessQuery;query(transaction:Transaction,sql:string,values?:unknown[]):ReturnType<AccessQuery>;now?:()=>number
 /** Closed server-owned command parser; never receives authority from the browser. */
 parseCommand(command:unknown):Command
 /** Fixed destination policy; this builder cannot expand the installed path rules. */
 buildRequest(command:Command):Readonly<{method:'GET'|'POST';url:string;body:string|null}>
 /** Return existing credentials only. Any token-exchange I/O needs separate admission. */
 getHeaders?(command:Command,options:{signal:AbortSignal}):Promise<Record<string,string>>|Record<string,string>
 /** Pure bounded projection only; no unadmitted network, persistence or other side effects. */
 projectResponse(value:Json,options:{status:number;signal:AbortSignal}):Json|Promise<Json>
}):Readonly<{contract:typeof EXTERNAL_CALL_CONTRACT
 execute(input:Readonly<{command:unknown;intentKey:string}>,options?:Readonly<{signal?:AbortSignal}>):Promise<Readonly<ExternalCallResult>>
}>
