import {createExternalCallHost,externalNativeResponse,type ExternalCallOptions,type NativeExternalTransport} from '../../src/external-call.mjs'
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
