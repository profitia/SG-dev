import type {KeyObject} from 'node:crypto'
export declare const FIRST_PARTY_SOURCE_CONTRACT:Readonly<{id:'profitia.first-party-source-access';version:'1.0.0'}>
export declare const FIRST_PARTY_SOURCE_HEADER:'x-profitia-source-consumer'
export interface FirstPartySourceConfiguration {
 environment:'development';componentId:string;consumerApplicationId:string;receiverApplicationId:string;sourceOrigin:string;targetOrigin:string;keyId:string;privateKey:string|Buffer|KeyObject
}
export interface FirstPartySourceClaim {
 readonly payload:Readonly<{contract:string;environment:'development';componentId:string;consumerApplicationId:string;receiverApplicationId:string;sourceOrigin:string;targetOrigin:string;keyId:string;requestId:string;issuedAt:number;expiresAt:number;method:'POST';path:'/v1/acquire';bodyDigest:string;credentialDigest:string;idempotencyDigest:string}>
 readonly raw:string;readonly signature:string
}
export declare function sourceAccessDigest(value:string|Uint8Array):string
export declare function createFirstPartySourceSigner(configuration:FirstPartySourceConfiguration,dependencies?:{now?:()=>number;newRequestId?:()=>string}):(request:Request)=>Promise<Request>
export declare function readFirstPartySourceClaim(request:Request,options:{receiverApplicationId:string;targetOrigin:string;now?:()=>number}):Promise<FirstPartySourceClaim>
export declare function assertFirstPartySourceClaim(claim:FirstPartySourceClaim,options:{receiverApplicationId:string;targetOrigin:string;now?:()=>number}):FirstPartySourceClaim['payload']
export declare function verifyFirstPartySourceClaim(claim:FirstPartySourceClaim,registered:{status:string;componentId:string;consumerApplicationId:string;receiverApplicationId:string;sourceOrigin:string;targetOrigin:string;keyId:string;publicKey:string;expiresAt:string},options:{receiverApplicationId:string;targetOrigin:string;now?:()=>number}):boolean
export declare function createFirstPartySourceAuthority(options:{query:import('@profitia/platform-contracts/access-store').AccessQuery;client:import('@profitia/platform-contracts/identity-provider').ClerkIdentityClient;binding:import('@profitia/platform-contracts/access-store').AccessStoreBinding;now?:()=>number}):Readonly<{ready():Promise<boolean>;authorize(request:Request,input:unknown):Promise<Readonly<{payload:string;signature:string}>>}>
export interface VerifiedSourceConsumer{readonly componentId:string;readonly applicationId:string;readonly keyId:string;readonly origin:string;readonly deploymentId:string;readonly configurationVersion:string}
export type SourceExecution={kind:'HUMAN';organisationId:string}|{kind:'SERVICE';organisationId:string;grantId:string}
export declare function createFirstPartySourceHost(options:{application:import('@profitia/platform-contracts/operation-context').Application&{publicOrigin:string};binding:import('@profitia/platform-contracts/access-store').AccessStoreBinding;independentQuery:import('@profitia/platform-contracts/access-store').AccessQuery;transact:(action:(db:{query:import('@profitia/platform-contracts/access-store').AccessQuery;transaction:any})=>Promise<any>,options?:{timeoutMs:number;maxWaitMs:number})=>Promise<any>;fetch?:typeof fetch;now?:()=>number}):Readonly<{contract:typeof FIRST_PARTY_SOURCE_CONTRACT;ready():Promise<boolean>;execute<T>(args:{request:Request;execution:SourceExecution;resourceId:string},action:(context:import('@profitia/platform-contracts/operation-context').OperationContext,transaction:any,consumer:VerifiedSourceConsumer)=>T|Promise<T>):Promise<T>}>
