import {createExternalCallHost,externalNativeResponse,type ExternalCallOptions,type NativeExternalTransport} from '../../src/external-call.mjs'
import type {ModelExecutionPolicy} from '../../src/model-execution.mjs'
declare const base:Omit<ExternalCallOptions<unknown,{path:string}>, 'getHeaders'>
const policy:NativeExternalTransport&{credentialMode:'NONE'}={schemaDigest:'a'.repeat(64),pathRules:[{method:'GET',prefix:'/records/',parameter:'HEX24',suffix:'/files/main_document_uri',requestFormat:'NONE'}],redirectOrigins:[],maximumResponseBytes:1024,credentialMode:'NONE',completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'}
const native=createExternalCallHost({...base,nativeTransport:policy})
const result=await native.execute({command:{path:'/data'},intentKey:'a'.repeat(64)})
const bytes:Uint8Array=result.bytes
const response:Response=externalNativeResponse(result)
// @ts-expect-error native bytes have not passed a JSON field projection
result.body
const json=createExternalCallHost({...base,projectResponse:v=>v})
const legacy=await json.execute({command:{path:'/data'},intentKey:'b'.repeat(64)})
// @ts-expect-error legacy JSON is not a native transport result
externalNativeResponse(legacy)
// @ts-expect-error NONE never accepts a credential callback
createExternalCallHost({...base,nativeTransport:policy,getHeaders:()=>({authorization:'untrusted'})})
// @ts-expect-error native and JSON projection protocols cannot be silently combined
createExternalCallHost({...base,nativeTransport:policy,projectResponse:v=>v})
// @ts-expect-error no caller-supplied regular expressions
const invalid:NativeExternalTransport={...policy,pathRules:[{method:'GET',prefix:'/data/',parameter:'REGEX',suffix:'',requestFormat:'NONE'}]}
void bytes;void response;void invalid
declare const modelPolicy:ModelExecutionPolicy
const credentialed={...policy,credentialMode:'SERVER_HEADERS' as const}
createExternalCallHost({...base,nativeTransport:credentialed,modelExecution:modelPolicy,countModelInputTokens:()=>10,getHeaders:()=>({authorization:'Bearer SYNTHETIC_ONLY'})})
// @ts-expect-error a model policy cannot omit its server-owned token counter
createExternalCallHost({...base,nativeTransport:credentialed,modelExecution:modelPolicy,getHeaders:()=>({authorization:'Bearer SYNTHETIC_ONLY'})})
// @ts-expect-error model execution cannot be installed on a legacy JSON projection
createExternalCallHost({...base,modelExecution:modelPolicy,countModelInputTokens:()=>10,projectResponse:v=>v})
