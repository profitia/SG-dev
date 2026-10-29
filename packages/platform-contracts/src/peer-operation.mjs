/** Server-caller transport proof only. It never creates a HUMAN, membership,
 * permission or ALLOW. Receivers MUST retain ordinary Clerk and E1 checks.
 * No caller-selected URL, identity header or cookie is trusted. */
import {createHash, createHmac, randomUUID, timingSafeEqual} from 'node:crypto'

export const PEER_OPERATION_CONTRACT = Object.freeze({id:'profitia.peer-operation',version:'1.0.0'})
export const PEER_OPERATION_HEADER = 'x-profitia-peer-operation'
const receipts = new WeakMap()
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const hash = value => createHash('sha256').update(value).digest('hex')
const closed = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',')
const origin = value => {
  try {const url=new URL(value);return url.origin===value&&url.protocol==='https:'&&!url.username&&!url.password&&!url.hostname.includes('*')}
  catch {return false}
}
const headerSnapshot = request => JSON.stringify([...request.headers].sort(([a],[b])=>a.localeCompare(b)))
function configuration(input) {
  if (!closed(input,['environment','callerApplicationId','receiverApplicationId','sourceOrigin','targetOrigin','keyId','key','routes','internalOrigins'])
    || input.environment!=='development' || ![input.callerApplicationId,input.receiverApplicationId,input.keyId].every(v=>typeof v==='string'&&/^[a-z][a-z0-9-]{1,63}$/.test(v))
    || input.callerApplicationId===input.receiverApplicationId || !origin(input.sourceOrigin)||!origin(input.targetOrigin)||input.sourceOrigin===input.targetOrigin
    || !(input.key instanceof Uint8Array)||input.key.length<32||input.key.length>128
    || !Array.isArray(input.routes)||!input.routes.length||input.routes.length>16
    || !Array.isArray(input.internalOrigins)||input.internalOrigins.length>4) throw TypeError('Explicit Development peer-operation configuration required')
  const copy=structuredClone(input), keys=new Set()
  for(const route of copy.routes) {
    if(!closed(route,['method','path','maximumRequestBytes','requireIdempotencyKey'])||!['GET','POST'].includes(route.method)
      ||typeof route.path!=='string'||!/^\/[a-z0-9/_-]+$/.test(route.path)||route.path.includes('//')
      ||!Number.isSafeInteger(route.maximumRequestBytes)||route.maximumRequestBytes<0||route.maximumRequestBytes>16384
      ||typeof route.requireIdempotencyKey!=='boolean'||route.method==='GET'&&route.maximumRequestBytes!==0
      ||keys.has(route.method+':'+route.path)) throw TypeError('Closed unique peer routes required')
    keys.add(route.method+':'+route.path)
  }
  if(new Set(copy.internalOrigins).size!==copy.internalOrigins.length||copy.internalOrigins.some(value=>{
    try {const url=new URL(value);return url.origin!==value||!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]','0.0.0.0'].includes(url.hostname)}catch{return true}
  }))throw TypeError('Explicit local reverse-proxy authorities required')
  return copy
}
function selectedRequest(config,request,signing=false) {
  if(!(request instanceof Request)||request.signal.aborted||request.headers.has('cookie')||request.headers.has('origin')
    ||!/^Bearer [\x21-\x7e]{1,16384}$/.test(request.headers.get('authorization')??'')
    ||[...request.headers.keys()].some(name=>/^x-(?:clerk-|user-|org(?:anisation|anization)?-|srm-)/i.test(name)))return null
  let url;try{url=new URL(request.url)}catch{return null}
  if(url.username||url.password||url.search||url.hash)return null
  const target=new URL(config.targetOrigin),host=request.headers.get('host')
  if(url.origin===config.targetOrigin){if(host!==null&&host!==target.host)return null}
  else if(signing||!config.internalOrigins.includes(url.origin)||host!==target.host)return null
  const route=config.routes.find(value=>value.method===request.method&&value.path===url.pathname)
  if(!route||request.method==='POST'&&request.headers.get('content-type')?.toLowerCase()!=='application/json'
    ||route.requireIdempotencyKey&&!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(request.headers.get('idempotency-key')??''))return null
  return {url,route}
}
async function bodyHash(request,maximum) {
  const copy=request.clone()
  if(!copy.body)return hash('')
  const reader=copy.body.pipeThrough(new TransformStream(),{signal:AbortSignal.any([request.signal,AbortSignal.timeout(3000)])}).getReader()
  const chunks=[];let size=0
  try {for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>maximum)throw Error('Peer request refused');chunks.push(item.value)}
    return hash(Buffer.concat(chunks))
  }finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
}
const proofKeys=['v','kid','caller','receiver','source','target','method','path','body','authorization','idempotency','requestId','issuedAt','expiresAt']
const encode = value => Buffer.from(value).toString('base64url')
function decode(value) {
  if(typeof value!=='string'||!value.length||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Peer request refused')
  const bytes=Buffer.from(value,'base64url');if(bytes.toString('base64url')!==value)throw Error('Peer request refused');return bytes
}
function options(input) {
  const now=input?.now??Date.now,newRequestId=input?.newRequestId??randomUUID
  if(typeof now!=='function'||typeof newRequestId!=='function')throw TypeError('Explicit peer clock/identifier functions required')
  return {now,newRequestId}
}

/** The BFF supplies its own policy/key and the captured user bearer. No secret
 * or grant is returned to browser code. The body remains the exact signed body. */
export function createPeerOperationSigner(input,dependencies={}) {
  const config=configuration(input),{now,newRequestId}=options(dependencies)
  return async request=>{
    const selected=selectedRequest(config,request,true)
    if(!selected||request.headers.has(PEER_OPERATION_HEADER))throw Error('Peer request refused')
    const snapshot=headerSnapshot(request),issuedAt=now(),requestId=newRequestId()
    if(!Number.isSafeInteger(issuedAt)||!uuid.test(requestId))throw Error('Peer request refused')
    const body=await bodyHash(request,selected.route.maximumRequestBytes)
    if(request.signal.aborted||snapshot!==headerSnapshot(request)||now()-issuedAt>=60000)throw Error('Peer request refused')
    const proof={v:'1.0.0',kid:config.keyId,caller:config.callerApplicationId,receiver:config.receiverApplicationId,
      source:config.sourceOrigin,target:config.targetOrigin,method:request.method,path:selected.url.pathname,body,
      authorization:hash(request.headers.get('authorization')),idempotency:request.headers.get('idempotency-key'),requestId,issuedAt,expiresAt:issuedAt+60000}
    const bytes=encode(JSON.stringify(proof)),signature=createHmac('sha256',config.key).update(bytes).digest('base64url')
    const headers=new Headers(request.headers);headers.set(PEER_OPERATION_HEADER,bytes+'.'+signature)
    return new Request(request,{headers,credentials:'omit',cache:'no-store',redirect:'error'})
  }
}

/** Validate the actual receiver request before any business/identity dispatch.
 * A receipt is bound to this Request object, its body, all headers and deadline;
 * copying HTTP headers to another object does not copy verification authority. */
export function createPeerOperationVerifier(input,dependencies={}) {
  const config=configuration(input),{now}=options(dependencies)
  return async request=>{
    receipts.delete(request)
    try {
      const selected=selectedRequest(config,request)
      if(!selected)return false
      const header=request.headers.get(PEER_OPERATION_HEADER)
      if(!header||header.length>4096)return false
      const parts=header.split('.');if(parts.length!==2)return false
      const signature=decode(parts[1]),expected=createHmac('sha256',config.key).update(parts[0]).digest()
      if(signature.length!==expected.length||!timingSafeEqual(signature,expected))return false
      const proof=JSON.parse(decode(parts[0]).toString('utf8')),at=now(),snapshot=headerSnapshot(request)
      if(!closed(proof,proofKeys)||proof.v!=='1.0.0'||proof.kid!==config.keyId||proof.caller!==config.callerApplicationId||proof.receiver!==config.receiverApplicationId
        ||proof.source!==config.sourceOrigin||proof.target!==config.targetOrigin||proof.method!==request.method||proof.path!==selected.url.pathname
        ||proof.authorization!==hash(request.headers.get('authorization'))||proof.idempotency!==request.headers.get('idempotency-key')||!uuid.test(proof.requestId)
        ||!Number.isSafeInteger(proof.issuedAt)||!Number.isSafeInteger(proof.expiresAt)||proof.issuedAt>at+2000
        ||proof.expiresAt<=at||proof.expiresAt-proof.issuedAt!==60000||!/^[a-f0-9]{64}$/.test(proof.body))return false
      if(await bodyHash(request,selected.route.maximumRequestBytes)!==proof.body||request.signal.aborted||snapshot!==headerSnapshot(request)||proof.expiresAt<=now())return false
      receipts.set(request,Object.freeze({snapshot,url:request.url,method:request.method,sourceOrigin:config.sourceOrigin,
        callerApplicationId:config.callerApplicationId,receiverApplicationId:config.receiverApplicationId,requestId:proof.requestId,expiresAt:proof.expiresAt,now}))
      return true
    } catch {return false}
  }
}
function receipt(request) {
  if(!(request instanceof Request))return null
  const value=receipts.get(request)
  return value&&!request.signal.aborted&&value.expiresAt>value.now()&&value.url===request.url&&value.method===request.method&&value.snapshot===headerSnapshot(request)?value:null
}
export function hasVerifiedPeerOperation(request) {return receipt(request)!==null}
export function peerOperationAttribution(request) {
  const value=receipt(request)
  return value?Object.freeze({callerApplicationId:value.callerApplicationId,receiverApplicationId:value.receiverApplicationId,requestId:value.requestId}):null
}
/** Identity-verifier input ONLY, never a business request or a new session.
 * A separately authenticated BFF has bound the exact end-user bearer to this
 * receiver operation. The ordinary SDK still verifies that bearer's original
 * source azp, issuer, current session/account and binding; E1 still owns access. */
export function peerOperationIdentityRequest(request) {
  const value=receipt(request);if(!value)return null
  const url=new URL(value.sourceOrigin);url.pathname=new URL(request.url).pathname
  const headers=new Headers({authorization:request.headers.get('authorization'),host:url.host})
  return new Request(url,{method:request.method,headers,signal:request.signal})
}
export async function peerOperationSourceDigest() {
  const fs=await import('node:fs')
  return createHash('sha256').update(fs.readFileSync(new URL('./peer-operation.mjs',import.meta.url)))
    .update(fs.readFileSync(new URL('./peer-operation.d.mts',import.meta.url))).digest('hex')
}
