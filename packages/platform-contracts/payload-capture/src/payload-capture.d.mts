export type ReadonlyJson=null|boolean|number|string|readonly ReadonlyJson[]|{readonly [key:string]:ReadonlyJson}
export interface PayloadCaptureLimits {maximumBytes?:number;maximumDepth?:number;maximumNodes?:number}
export interface CapturedPayload {
 readonly value:ReadonlyJson
 readonly digest:string
 readonly byteLength:number
 readonly depth:number
 readonly nodeCount:number
}
export declare const PAYLOAD_CAPTURE_CONTRACT:Readonly<{id:'profitia.finite-payload-capture';version:'1.0.0';purpose:'DATA_ONLY';digest:'operationPayloadDigest'}>
/** Plain finite data only. Rejects accessors, custom prototypes, unsupported
 * values and cycles. Does not authenticate, authorize or classify the data. */
export declare function captureFinitePayload(input:unknown,options?:Readonly<PayloadCaptureLimits>):Readonly<CapturedPayload>
