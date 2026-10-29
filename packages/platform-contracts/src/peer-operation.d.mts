export const PEER_OPERATION_CONTRACT:Readonly<{id:'profitia.peer-operation';version:'1.0.0'}>
export const PEER_OPERATION_HEADER:'x-profitia-peer-operation'
export type PeerOperationRoute=Readonly<{method:'GET'|'POST';path:string;maximumRequestBytes:number;requireIdempotencyKey:boolean}>
/** Server configuration only. This transport grants no end-user authority. */
export type PeerOperationConfiguration=Readonly<{
 environment:'development';callerApplicationId:string;receiverApplicationId:string
 sourceOrigin:string;targetOrigin:string;keyId:string;key:Uint8Array
 routes:readonly PeerOperationRoute[];internalOrigins:readonly string[]
}>
export function createPeerOperationSigner(configuration:PeerOperationConfiguration,dependencies?:Readonly<{now?:()=>number;newRequestId?:()=>string}>):(request:Request)=>Promise<Request>
export function createPeerOperationVerifier(configuration:PeerOperationConfiguration,dependencies?:Readonly<{now?:()=>number}>):(request:Request)=>Promise<boolean>
export function hasVerifiedPeerOperation(request:Request):boolean
export function peerOperationAttribution(request:Request):Readonly<{callerApplicationId:string;receiverApplicationId:string;requestId:string}>|null
/** Header-only SDK input; MUST NOT replace the actual business Request. */
export function peerOperationIdentityRequest(request:Request):Request|null
export function peerOperationSourceDigest():Promise<string>
