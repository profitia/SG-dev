import {createHmac} from 'node:crypto'
import {readPresentationJson} from './embedded-read-channel.mjs'
import {operationPayloadDigest} from './operation-context.mjs'
import {publicUrl} from './public-web-transport.mjs'

// Protocol helpers only. The existing external host owns the sole HTTP send,
// source authority, counters, control transactions, audit and settlement.
export const NATIVE_EXTERNAL_TRANSPORT=Object.freeze({id:'profitia.external-native-http',version:'1.0.0',
 completionMode:'ADMITTED_ATTEMPT_CURRENT_SETTLEMENT'})
export const nativeExternalTransportSchemaUrl=new URL('../migrations/access/012-native-external-transport.sql',import.meta.url).href
const bodies=new WeakMap(),hex=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const record=v=>v&&Object.getPrototypeOf(v)===Object.prototype
const exact=(v,keys)=>record(v)&&Object.keys(v).sort().join(',')===keys
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const invalid=()=>{throw new TypeError('Explicit native external protocol required')}
const pathPart=v=>typeof v==='string'&&v.length<=255&&/^[A-Za-z0-9/._-]*$/.test(v)&&!v.includes('..')&&!v.includes('//')
const formats=['NONE','JSON','FORM'],parameters=['HEX24','UUID','OPAQUE','STORAGE_PATH']

export function validNativePathRules(rules,publicWeb=false){
 return Array.isArray(rules)&&rules.length>0&&rules.length<=32&&rules.every(r=>{
  if(!record(r)||!['GET','POST'].includes(r.method)||!formats.includes(r.requestFormat)||r.method==='GET'&&r.requestFormat!=='NONE')return false
  if(exact(r,'method,path,requestFormat'))return pathPart(r.path)&&r.path.startsWith('/')
  return exact(r,'method,parameter,prefix,requestFormat,suffix')&&pathPart(r.prefix)&&r.prefix.startsWith('/')
   &&pathPart(r.suffix)&&(parameters.includes(r.parameter)||publicWeb&&r.parameter==='PUBLIC_PATH'&&r.method==='GET'&&r.prefix==='/'&&r.suffix===''&&r.requestFormat==='NONE')
 })&&new Set(rules.map(r=>operationPayloadDigest(r))).size===rules.length
}
function origin(value,transport){
 try{const u=new URL(value);return u.origin===value&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash
   &&(u.protocol==='https:'||transport==='LOCAL_SYNTHETIC_HTTP'&&u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port)}catch{return false}
}
export function captureNativeTransport(value,transport,publicWeb=false){
 if(!exact(value,'completionMode,credentialMode,maximumResponseBytes,pathRules,redirectOrigins,schemaDigest')
   ||!hex.test(value.schemaDigest??'')||value.completionMode!==NATIVE_EXTERNAL_TRANSPORT.completionMode
   ||!['NONE','SERVER_HEADERS'].includes(value.credentialMode)||!validNativePathRules(value.pathRules,publicWeb)
   ||!Number.isInteger(value.maximumResponseBytes)||value.maximumResponseBytes<1||value.maximumResponseBytes>33554432
   ||!Array.isArray(value.redirectOrigins)||value.redirectOrigins.length>3
   ||new Set(value.redirectOrigins).size!==value.redirectOrigins.length||!value.redirectOrigins.every(o=>origin(o,transport))
   ||publicWeb&&(transport!=='PUBLIC_WEB'||value.credentialMode!=='NONE'||value.maximumResponseBytes>2000000||value.redirectOrigins.length!==0
    ||operationPayloadDigest(value.pathRules)!==operationPayloadDigest([{method:'GET',prefix:'/',parameter:'PUBLIC_PATH',suffix:'',requestFormat:'NONE'}])))invalid()
 return freeze(structuredClone(value))
}
export function assertNativeDescriptor(config,descriptor){
 if(descriptor?.nativeSchemaVersion!=='1.0.0'||descriptor.nativeSchemaDigest!==config.schemaDigest
   ||!/^[1-9][0-9]*$/.test(descriptor.nativePolicyVersion??'')
   ||descriptor.nativeCompletionMode!==config.completionMode||descriptor.nativeCredentialMode!==config.credentialMode
   ||descriptor.nativeMaximumResponseBytes!==config.maximumResponseBytes
   ||operationPayloadDigest(descriptor.nativePathRules)!==operationPayloadDigest(config.pathRules)
   ||operationPayloadDigest(descriptor.nativeRedirectOrigins)!==operationPayloadDigest(config.redirectOrigins)
   ||typeof descriptor.nativeSourceRef!=='string'||descriptor.nativeSourceRef.length<1||descriptor.nativeSourceRef.length>256
   ||!Number.isFinite(Date.parse(descriptor.nativeExpiresAt)))invalid()
}
function parameter(value,kind){
 if(kind==='PUBLIC_PATH')return value.length<=2047&&!/[\u0000-\u0020\u007f\\]/.test(value)
 if(kind==='HEX24')return /^[a-f0-9]{24}$/i.test(value)
 if(kind==='UUID')return uuid.test(value)
 if(kind==='OPAQUE')return /^[A-Za-z0-9_-]{1,128}$/.test(value)
 return kind==='STORAGE_PATH'&&value.length>0&&value.length<=1024&&value.split('/').every(s=>s.length>0&&s.length<=255&&/^[A-Za-z0-9._=-]+$/.test(s)&&!s.includes('..'))
}
export function nativeRequestRule(config,url,method){
 if(url.pathname.includes('..')||url.pathname.includes('//')||url.pathname.length>2048)invalid()
 const matches=config.pathRules.filter(r=>r.method===method&&(r.path!==undefined?r.path===url.pathname
   :url.pathname.startsWith(r.prefix)&&url.pathname.endsWith(r.suffix)
    &&parameter(url.pathname.slice(r.prefix.length,r.suffix.length?-r.suffix.length:undefined),r.parameter)))
 // Ambiguous policy is refused rather than choosing a more permissive rule.
 if(matches.length!==1)invalid()
 return matches[0]
}
export async function validateNativeRequestBody(request,rule,max){
 if(Buffer.byteLength(request.url)+Buffer.byteLength(request.body??'')>max)invalid()
 if(rule.requestFormat==='NONE'){if(request.body!==null)invalid();return null}
 if(typeof request.body!=='string'||request.method!=='POST'||!request.body.length)invalid()
 if(rule.requestFormat==='JSON'){
  await readPresentationJson(new Response(request.body,{headers:{'content-type':'application/json'}}),max)
  return 'application/json'
 }
 // Preserve native OAuth form encoding. No raw secret enters the control
 // payload; the existing host binds the request through its private HMAC.
 if(!/^[\x20-\x7e]+$/.test(request.body)||/%(?![a-f0-9]{2})/i.test(request.body))invalid()
 const pairs=[...new URLSearchParams(request.body)];if(!pairs.length||pairs.length>32
   ||pairs.some(([k,v])=>!k||k.length>128||/[\r\n\0]/.test(k+v)))invalid()
 return 'application/x-www-form-urlencoded'
}
function boundedHeader(response,key,max){
 const value=response.headers.get(key)
 if(value===null)return null
 if(Buffer.byteLength(value)>max||/[\r\n\0]/.test(value))invalid()
 return value
}
export async function readNativeProviderResponse(response,{config,requestUrl,assertActive,signal,publicWeb=false}){
 if(!(signal instanceof AbortSignal))invalid()
 assertActive()
 const headers={}
 const type=boundedHeader(response,'content-type',256),retry=boundedHeader(response,'retry-after',256)
 if(type!==null)headers['content-type']=type
 if(retry!==null)headers['retry-after']=retry
 if(response.status>=300&&response.status<400&&response.status!==304){
  if(![301,302,303,307,308].includes(response.status))invalid()
  const location=boundedHeader(response,'location',8192);if(!location)invalid()
  const u=new URL(location,requestUrl)
  if(u.username||u.password||u.hash||(publicWeb?publicUrl(u.href).href!==u.href:!config.redirectOrigins.includes(u.origin)))invalid()
  headers.location=u.href
 }
 const length=boundedHeader(response,'content-length',32)
 if(length!==null&&(!/^[0-9]+$/.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>config.maximumResponseBytes)){
  await response.body?.cancel();invalid()
 }
 const reader=response.body?.getReader(),chunks=[];let size=0,finished=false
 const abort=()=>{if(reader)reader.cancel().catch(()=>{})}
 signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()
 try{
  if(reader)while(true){
   assertActive();const part=await reader.read();assertActive()
   if(part.done)break
   if(!(part.value instanceof Uint8Array)||size+part.value.byteLength>config.maximumResponseBytes)invalid()
   chunks.push(part.value.slice());size+=part.value.byteLength
  }
  if([204,205,304].includes(response.status)&&size!==0)invalid()
  const bytes=new Uint8Array(size);let offset=0
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  // Standard Fetch may have decoded HTTP compression. A reconstructed Response
  // reports the bytes supplied to the native parser, not an obsolete wire size.
  headers['content-length']=String(size)
  const safeHeaders=Object.freeze(headers)
  const result=Object.freeze({status:response.status,get url(){return requestUrl},get headers(){return safeHeaders},get bytes(){return bytes.slice()},
   toJSON(){return{protocol:NATIVE_EXTERNAL_TRANSPORT.id,status:response.status,byteLength:size}}})
  bodies.set(result,bytes);finished=true;return result
 }finally{signal.removeEventListener('abort',abort);if(reader){if(!finished)try{await reader.cancel()}catch{};reader.releaseLock()}}
}
export function nativeResponseDigest(result,key){
 const bytes=bodies.get(result);if(!bytes)invalid()
 return createHmac('sha256',Buffer.from(key,'hex')).update(JSON.stringify({status:result.status,headers:result.headers})).update('\0').update(bytes).digest('hex')
}
/** Caller must first verify the original host's successful settlement brand. */
export function responseFromNativeResult(result){
 const bytes=bodies.get(result);if(!bytes)invalid()
 const response=new Response([204,205,304].includes(result.status)?null:bytes.slice(),{status:result.status,headers:result.headers})
 Object.defineProperty(response,'url',{value:result.url})
 return response
}
