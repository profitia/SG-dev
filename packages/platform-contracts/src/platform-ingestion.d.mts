import type {Application,Environment,Json,OperationContext} from './operation-context.mjs'
import type {AccessQuery} from './access-store.mjs'
import type {PrivateTransactionOptions} from './private-operation-host.mjs'
export interface PlatformIngestionBinding {
  applicationId:string;environment:Environment;projectId:string;branchId:string;databaseName:string;role:string
  deploymentId:string;configurationVersion:string;schemaDigest:string;unmeteredSchemaDigest?:string
}
export interface PlatformReceipt {readonly effectId:string;readonly status:'COMMITTED'}
export interface PlatformSourceBinding {
  readonly sourceId:string;readonly applicationId:string;readonly environment:Environment;readonly projectId:string;readonly branchId:string;readonly databaseName:string
  readonly schemaDigest:string;readonly unmeteredSchemaDigest?:string;readonly payloadSchema:string;readonly qualityVersion:string;readonly classificationVersion:string
}
export interface PlatformReceiptEvidence extends PlatformSourceBinding {
  readonly sourceId:string;readonly resourceId:string;readonly contentDigest:string;readonly idempotencyKeyDigest:string
  readonly effectId:string;readonly status:'COMMITTED';readonly verifiedAt:string
}
export interface PlatformDeliveryPort {deliver(input:Readonly<{sourceId:string;deliveryKey:string;payload:Json}>):Promise<Readonly<PlatformReceipt>>}
export declare function platformDeliveryEvidence(value:unknown):Readonly<PlatformSourceBinding>|null
export declare function createPlatformDeliveryPort<Transaction>(options:{
  host:ReturnType<typeof createPlatformIngestionHost<Transaction>>;resourceId:(payload:Json)=>string
  write:(payload:Json,transaction:Transaction,context:Readonly<OperationContext>)=>void|Promise<void>
}):Readonly<PlatformDeliveryPort>
export declare const PLATFORM_INGESTION_CONTRACT:Readonly<{id:'profitia.platform-ingestion';version:'1.0.0'}>
export declare const unmeteredSourceSchemaUrl:string
export declare function unmeteredSourceSchemaDigest():Promise<string>
export declare const platformIngestionSchemaUrl:string
export declare function platformIngestionSchemaDigest():Promise<string>
export declare function platformIngestionSourceDigest():Promise<string>
export declare function platformReceiptEvidence(value:unknown):Readonly<PlatformReceiptEvidence>|null
export declare function createPlatformIngestionHost<Transaction>(options:{
  application:Application;binding:PlatformIngestionBinding;source:{id:string;payloadSchema:string;qualityVersion:string;classificationVersion:string}
  independentQuery:AccessQuery;now?:()=>number;transactionTimeoutMs?:number
  transact<T>(action:(session:{query:AccessQuery;transaction:Transaction})=>Promise<T>,limits:PrivateTransactionOptions):Promise<T>
  /** Pure current source/catalog validation; must reject private fields and unsupported versions. */
  validateSharedPayload(payload:Json,session:{query:AccessQuery;transaction:Transaction}):boolean|Promise<boolean>
}):Readonly<{contract:typeof PLATFORM_INGESTION_CONTRACT
  ingest(input:{resourceId:string;payload:Json;idempotencyKey:string},write:(payload:Json,transaction:Transaction,context:Readonly<OperationContext>)=>void|Promise<void>):Promise<Readonly<{
    decision:'ALLOW';decisionId:string;contractId:string;contractVersion:string;value:Readonly<PlatformReceipt>
  }>>
}>
