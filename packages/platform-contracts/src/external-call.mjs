import {createHash,createHmac} from 'node:crypto'
import {createPlatformDeliveryPort,platformDeliveryEvidence,platformReceiptEvidence} from './platform-ingestion.mjs'
import {operationPayloadDigest} from './operation-context.mjs'
import {readPresentationJson} from './embedded-read-channel.mjs'
import {NATIVE_EXTERNAL_TRANSPORT,nativeExternalTransportSchemaUrl,captureNativeTransport,assertNativeDescriptor,
 nativeRequestRule,validateNativeRequestBody,readNativeProviderResponse,nativeResponseDigest,responseFromNativeResult} from './native-external-transport.mjs'
import {publicUrl,publicWebHop} from './public-web-transport.mjs'
export {NATIVE_EXTERNAL_TRANSPORT,nativeExternalTransportSchemaUrl}
export const publicWebTransportSchemaUrl=new URL('../migrations/access/018-public-web-transport.sql',import.meta.url).href

export const EXTERNAL_CALL_CONTRACT=Object.freeze({id:'profitia.external-call',version:'1.0.0',unit:'UPSTREAM_ATTEMPT_ADMISSION'})
export const externalCallSchemaUrl=new URL('../migrations/access/009-external-call-admission.sql',import.meta.url).href
const evidence=new WeakMap(),hex=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const record=v=>v&&Object.getPrototypeOf(v)===Object.prototype
const exact=(v,keys)=>record(v)&&Object.keys(v).sort().join(',')===keys
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v}
const hmac=(key,value)=>createHmac('sha256',Buffer.from(key,'hex')).update(value).digest('hex')
const hash=value=>createHash('sha256').update(value).digest('hex')
const safeText=value=>typeof value==='string'&&/^[A-Za-z0-9._:-]{1,256}$/.test(value)
const validPaths=value=>Array.isArray(value)&&value.length>0&&value.length<=32&&value.every(v=>exact(v,'method,path')&&['GET','POST'].includes(v.method)&&typeof v.path==='string'&&/^\/[A-Za-z0-9/._-]{0,255}$/.test(v.path)&&!v.path.includes('..')&&!v.path.includes('//'))

/** Certainty describes this observer, never vendor billing or a safe retry.
 * No raw provider diagnostic, response, credential or private intent is exposed. */
export class ExternalCallUnavailable extends Error{
  constructor(certainty='UNVERIFIED'){super('External result unavailable');this.name='ExternalCallUnavailable';this.certainty=['NOT_SENT','UNVERIFIED','RESULT_NOT_RETAINED'].includes(certainty)?certainty:'UNVERIFIED';this.retryAllowed=false}
}
export function externalCallEvidence(value){return value&&typeof value==='object'?evidence.get(value)??null:null}
/** Internal unclassified provider bytes, only after the original host settled.
 * Neither this Response nor its observation is a HUMAN or field-access grant. */
export function externalNativeResponse(value){
 if(externalCallEvidence(value)?.transportProtocol!==NATIVE_EXTERNAL_TRANSPORT.id)throw TypeError('Settled native provider response required')
 return responseFromNativeResult(value)
}

/** A server-owned source control adapter. It grants no HUMAN operation or
 * tenant read. The caller must separately admit its actor, purpose, data and
 * product before passing a private, stable 256-bit intent. No transport retry. */
export function createExternalCallHost(options){
  const {sourceHost,sourceId,resourceId,independentQuery,query,parseCommand,buildRequest,projectResponse,getHeaders=async()=>({}),now=Date.now}=options??{}
  let b;try{b=freeze(structuredClone(options.binding))}catch{throw TypeError('Explicit external source binding required')}
  const publicWeb=b.transport==='PUBLIC_WEB'
  const publicConfig=options?.publicWebTransport
  if(publicWeb?!(record(publicConfig)&&['schemaDigest','schemaDigest,syntheticOrigin'].includes(Object.keys(publicConfig).sort().join(','))
   &&hex.test(publicConfig.schemaDigest??'')&&(publicConfig.syntheticOrigin===undefined||typeof publicConfig.syntheticOrigin==='string')):Object.hasOwn(options??{},'publicWebTransport'))throw TypeError('Explicit public network policy required')
  const publicBinding=publicWeb?freeze(structuredClone(publicConfig)):null
  const native=Object.hasOwn(options??{},'nativeTransport')?captureNativeTransport(options.nativeTransport,b.transport,publicWeb):null
  if(!exact(b,'configurationVersion,origin,pathRules,role,schemaDigest,transport')||!['role','configurationVersion','schemaDigest'].every(k=>typeof b[k]==='string')||(!publicWeb&&typeof b.origin!=='string')
    ||!/^[a-z][a-z0-9_]*$/.test(b.role)||!safeText(b.configurationVersion)||!hex.test(b.schemaDigest)||!validPaths(b.pathRules)
    ||!['HTTPS','LOCAL_SYNTHETIC_HTTP','PUBLIC_WEB'].includes(b.transport)||publicWeb&&(!native||b.origin!==null||operationPayloadDigest(b.pathRules)!==operationPayloadDigest([{method:'GET',path:'/'}]))||!safeText(sourceId)||!safeText(resourceId)
    ||[independentQuery,query,parseCommand,buildRequest,getHeaders,now].some(v=>typeof v!=='function')
    ||(native?Object.hasOwn(options,'projectResponse')||native.credentialMode==='NONE'&&Object.hasOwn(options,'getHeaders'):typeof projectResponse!=='function'))throw TypeError('Explicit external source binding required')
  let origin;if(!publicWeb){try{origin=new URL(b.origin)}catch{throw TypeError('Fixed external origin required')}
  if(origin.origin!==b.origin||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash
    ||(b.transport==='HTTPS'?origin.protocol!=='https:':origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||!origin.port))throw TypeError('Fixed external origin required')}
  // The port rejects a fabricated/serialized host before any database lookup.
  const makePort=write=>createPlatformDeliveryPort({host:sourceHost,resourceId:()=>resourceId,write})
  const port=makePort(()=>{throw new ExternalCallUnavailable()})
  const source=platformDeliveryEvidence(port)
  if(source.sourceId!==sourceId||source.payloadSchema!=='external-call-control-v1'
    ||b.transport==='LOCAL_SYNTHETIC_HTTP'&&source.environment!=='development')throw TypeError('Accepted external control source required')
  const descriptor=async()=>{
    let result;try{result=await independentQuery(`SELECT current_database() AS database_name,current_user AS role,session_user AS login,${publicWeb?'profitia_public_web':native?'profitia_external_native':'profitia_external_call'}.descriptor($1,$2) AS descriptor`,[sourceId,resourceId])}catch{throw new ExternalCallUnavailable('NOT_SENT')}
    const row=result?.rows?.length===1?result.rows[0]:null,d=row?.descriptor
    const quotaValid=d?.quotaMode==='UNMETERED'
      ?d.capacity===null&&!!source.unmeteredSchemaDigest&&d.unmeteredSchemaDigest===source.unmeteredSchemaDigest
      :(d?.quotaMode===undefined||d.quotaMode==='METERED')&&Number.isSafeInteger(d?.capacity)&&d.capacity>=1&&d.capacity<=1000000&&d.admittedCount<=d.capacity
    if(!d||row.database_name!==source.databaseName||row.role!==b.role||row.login!==b.role||d.schemaVersion!=='1.0.0'
      ||d.schemaDigest!==b.schemaDigest||d.sourceSchemaDigest!==source.schemaDigest||d.role!==b.role
      ||!['applicationId','environment','projectId','branchId','databaseName','sourceId'].every(k=>d[k]===source[k])
      ||d.resourceId!==resourceId||d.configurationVersion!==b.configurationVersion||d.origin!==b.origin||d.transport!==b.transport
      ||operationPayloadDigest(d.pathRules)!==operationPayloadDigest(b.pathRules)||d.unit!==EXTERNAL_CALL_CONTRACT.unit
      ||!uuid.test(d.policyId??'')||!uuid.test(d.serviceId??'')||!/^database-service:[a-f0-9-]{36}:[1-9][0-9]*$/i.test(d.serviceBindingVersion??'')
      ||!/^source-v1:[1-9][0-9]*$/.test(d.sourcePolicyVersion??'')||!quotaValid
      ||!Number.isSafeInteger(d.admittedCount)||d.admittedCount<0||!/^[1-9][0-9]*$/.test(d.policyVersion??'')
      ||!Number.isSafeInteger(d.maximumRequestBytes)||d.maximumRequestBytes<1||d.maximumRequestBytes>1048576
      ||!Number.isSafeInteger(d.maximumResponseBytes)||d.maximumResponseBytes<1||d.maximumResponseBytes>8388608
      ||!Number.isSafeInteger(d.timeoutMs)||d.timeoutMs<100||d.timeoutMs>120000
      ||!(Date.parse(d.expiresAt)>now())||Date.parse(d.expiresAt)>now()+30000
      ||b.transport==='LOCAL_SYNTHETIC_HTTP'&&d.sourceRef!=='SYNTHETIC_ONLY')throw new ExternalCallUnavailable('NOT_SENT')
    if(native){try{assertNativeDescriptor(native,d);if(!(Date.parse(d.nativeExpiresAt)>now()))throw Error()}catch{throw new ExternalCallUnavailable('NOT_SENT')}}
    if(publicWeb&&(d.publicWebSchemaVersion!=='1.0.0'||d.publicWebSchemaDigest!==publicBinding.schemaDigest
      ||!/^[1-9][0-9]*$/.test(d.publicWebPolicyVersion??'')||d.publicWebMaximumRedirects!==4
      ||d.publicWebSyntheticOrigin!==(publicBinding.syntheticOrigin??null)||!(Date.parse(d.publicWebExpiresAt)>now())
      ||d.maximumRequestBytes>8192||d.maximumResponseBytes>2000000||d.timeoutMs>8000
      ||typeof d.publicWebSourceRef!=='string'||!d.publicWebSourceRef.length
      ||publicBinding.syntheticOrigin!==undefined&&(source.environment!=='development'||d.sourceRef!=='SYNTHETIC_ONLY'
       ||d.nativeSourceRef!=='SYNTHETIC_ONLY'||d.publicWebSourceRef!=='SYNTHETIC_ONLY')))throw new ExternalCallUnavailable('NOT_SENT')
    return freeze(d)
  }
  const same=(a,b)=>['quotaMode','unmeteredSchemaDigest','policyId','policyVersion','configurationVersion','serviceId','serviceBindingVersion','sourcePolicyVersion','origin','transport',
    'maximumRequestBytes','maximumResponseBytes','timeoutMs'].every(k=>a[k]===b[k])&&operationPayloadDigest(a.pathRules)===operationPayloadDigest(b.pathRules)
    &&(!native||['nativeSchemaDigest','nativePolicyVersion','nativeCompletionMode','nativeCredentialMode','nativeMaximumResponseBytes','nativeExpiresAt'].every(k=>a[k]===b[k])
      &&operationPayloadDigest(a.nativePathRules)===operationPayloadDigest(b.nativePathRules)&&operationPayloadDigest(a.nativeRedirectOrigins)===operationPayloadDigest(b.nativeRedirectOrigins))
    &&(!publicWeb||['publicWebSchemaDigest','publicWebPolicyVersion','publicWebMaximumRedirects','publicWebSyntheticOrigin','publicWebSourceRef','publicWebExpiresAt'].every(k=>a[k]===b[k]))
  const control=async(action,callId,status,httpStatus,responseDigest,requestDigest,intentKey)=>{
    const intentDigest=hmac(intentKey,JSON.stringify({scope:'intent-v1',applicationId:source.applicationId,environment:source.environment,sourceId,resourceId}))
    // Exactly eight sorted keys: identical to the existing root canonical JSON.
    const payload=Object.freeze({action,callId,configurationVersion:b.configurationVersion,httpStatus,intentDigest,requestDigest,responseDigest,status}),holder={}
    const deliveryKey=hmac(intentKey,JSON.stringify({applicationId:source.applicationId,environment:source.environment,sourceId,resourceId,configurationVersion:b.configurationVersion,action}))
    const phasePort=makePort(async(content,transaction,context)=>{
      if(operationPayloadDigest(content)!==operationPayloadDigest(payload))throw new ExternalCallUnavailable()
      const envelope=JSON.stringify({content:payload,sourceId})
      const r=await query(transaction,'SELECT profitia_external_call.apply_control($1::uuid,$2::uuid,$3) AS control',
        [context.platformReservation.effectId,context.decisionId,envelope])
      const value=r?.rows?.length===1?r.rows[0].control:null
      if(!value||value.fresh!==true||!uuid.test(value.callId??''))throw new ExternalCallUnavailable()
      holder.value=value
    })
    const receipt=await phasePort.deliver({sourceId,deliveryKey,payload}),proof=platformReceiptEvidence(receipt)
    if(!proof||proof.sourceId!==sourceId||proof.resourceId!==resourceId||proof.applicationId!==source.applicationId||proof.environment!==source.environment
      ||proof.contentDigest!==operationPayloadDigest(payload)||proof.idempotencyKeyDigest!==hash(deliveryKey)||proof.effectId!==receipt.effectId)throw new ExternalCallUnavailable()
    return {receipt,fresh:holder.value??null}
  }

  const status=async callId=>{
    let r;try{r=await independentQuery('SELECT profitia_external_call.read_status($1::uuid,$2,$3) AS control',[callId,sourceId,resourceId])}catch{throw new ExternalCallUnavailable()}
    if(r?.rows?.length!==1||r.rows[0].control?.callId!==callId)throw new ExternalCallUnavailable()
    return r.rows[0].control.status
  }
  return Object.freeze({contract:EXTERNAL_CALL_CONTRACT,async execute(input,options={}){
    let supplied,signal
    try{
      if(!exact(input,'command,intentKey')||!record(options)||Object.keys(options).some(k=>k!=='signal'))throw Error()
      supplied=structuredClone(input);signal=options.signal
      if(!exact(supplied,'command,intentKey')||!hex.test(supplied.intentKey??'')||signal!=null&&!(signal instanceof AbortSignal))throw Error()
    }catch{throw new ExternalCallUnavailable('NOT_SENT')}
    const {intentKey}=supplied
    if(signal?.aborted)throw new ExternalCallUnavailable('NOT_SENT')
    let command,request,d,nativeContentType
    try{
      command=freeze(structuredClone(parseCommand(supplied.command)));d=await descriptor();request=buildRequest(command)
      if(!exact(request,'body,method,url')||!['GET','POST'].includes(request.method)||typeof request.url!=='string'||request.url.length>8192
        ||!(request.body===null||typeof request.body==='string')||request.method==='GET'&&request.body!==null)throw Error()
      const url=new URL(request.url)
      if(url.href!==request.url||(publicWeb?request.method!=='GET'||request.body!==null||publicUrl(request.url).href!==request.url:url.origin!==b.origin)||url.username||url.password||url.hash||(!native&&(!b.pathRules.some(p=>p.method===request.method&&p.path===url.pathname)
        ||!/^\/[A-Za-z0-9/._-]{0,255}$/.test(url.pathname)||url.pathname.includes('..')||url.pathname.includes('//')))
        ||Buffer.byteLength(request.url)+Buffer.byteLength(request.body??'')>d.maximumRequestBytes)throw Error()
      if(native)nativeContentType=await validateNativeRequestBody(request,nativeRequestRule(native,url,request.method),d.maximumRequestBytes)
      else if(request.body!==null)await readPresentationJson(new Response(request.body,{headers:{'content-type':'application/json'}}),d.maximumRequestBytes)
      request=Object.freeze({...request})
    }catch{throw new ExternalCallUnavailable('NOT_SENT')}
    const requestDigest=hmac(intentKey,JSON.stringify({body:request.body,method:request.method,url:request.url}))
    let plan,attempt
    try{
      plan=await control('PLAN',null,null,null,null,requestDigest,intentKey)
      if(await status(plan.receipt.effectId)!=='PLANNED')throw new ExternalCallUnavailable('RESULT_NOT_RETAINED')
      if(!same(d,await descriptor()))throw new ExternalCallUnavailable('NOT_SENT')
      if(signal?.aborted)throw new ExternalCallUnavailable('NOT_SENT')
      attempt=await control('ATTEMPT',plan.receipt.effectId,null,null,null,requestDigest,intentKey)
      if(!attempt.fresh||attempt.fresh.status!=='ATTEMPT_RESERVED'||attempt.fresh.callId!==plan.receipt.effectId)throw new ExternalCallUnavailable('UNVERIFIED')
    }catch(error){if(error instanceof ExternalCallUnavailable)throw error;throw new ExternalCallUnavailable('UNVERIFIED')}
    // An explicit native policy authorizes bounded completion of an admitted
    // upstream attempt, with CURRENT checks immediately before send and at
    // settlement. Its deadline is not a renewed HUMAN/private SQL lease.
    const abort=new AbortController(),deadline=Math.min(now()+d.timeoutMs,Date.parse(native?d.nativeExpiresAt:d.expiresAt),publicWeb?Date.parse(d.publicWebExpiresAt):Infinity);let timer,listener,sent=false,result,settledStatus='NOT_SENT'
    const assertActive=()=>{if(abort.signal.aborted||now()>=deadline)throw new ExternalCallUnavailable(sent?'UNVERIFIED':'NOT_SENT')}
    try{
      result=await Promise.race([
        (async()=>{
          // Credential acquisition is deferred and does not mint permission.
          // This callback must not perform an unadmitted token-exchange request.
          assertActive()
          const supplied=native?.credentialMode==='NONE'?{}:await getHeaders(command,{signal:abort.signal});assertActive()
          if(!record(supplied)||Object.keys(supplied).length>16)throw new ExternalCallUnavailable('NOT_SENT')
          const headers=new Headers()
          for(const [key,value] of Object.entries(supplied)){
            if(!/^[A-Za-z0-9-]{1,64}$/.test(key)||/^(cookie|host|connection|content-length|transfer-encoding|proxy-.*|sec-.*)$/i.test(key)
              ||typeof value!=='string'||Buffer.byteLength(value)>8192||/[\r\n]/.test(value))throw new ExternalCallUnavailable('NOT_SENT')
            headers.set(key,value)
          }
          if(native){if(!headers.has('accept'))headers.set('accept','*/*');if(nativeContentType)headers.set('content-type',nativeContentType);else headers.delete('content-type')}
          else{headers.set('accept','application/json');if(request.body!==null)headers.set('content-type','application/json')}
          if(!same(d,await descriptor()))throw new ExternalCallUnavailable('NOT_SENT');assertActive()
          sent=true
          const response=publicWeb?await publicWebHop(request.url,{signal:abort.signal,maxBytes:native.maximumResponseBytes},publicBinding.syntheticOrigin):await fetch(request.url,{method:request.method,body:request.body,headers,signal:abort.signal,redirect:'manual',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'})
          if(abort.signal.aborted||response.redirected||response.url!==request.url||response.status<200||response.status>599||!native&&response.status>=300&&response.status<400){try{await response.body?.cancel()}catch{};throw new ExternalCallUnavailable()}
          if(native)return await readNativeProviderResponse(response,{config:native,requestUrl:request.url,assertActive,signal:abort.signal,publicWeb})
          const body=await readPresentationJson(response,d.maximumResponseBytes);assertActive()
          const projected=await projectResponse(body,{status:response.status,signal:abort.signal});assertActive()
          // Reuse the same bounded/depth/prototype JSON reader for publication.
          const encoded=JSON.stringify(projected)
          if(typeof encoded!=='string'||Buffer.byteLength(encoded)>d.maximumResponseBytes)throw new ExternalCallUnavailable()
          const safe=await readPresentationJson(new Response(encoded,{headers:{'content-type':'application/json'}}),d.maximumResponseBytes);assertActive()
          return freeze({status:response.status,body:safe})
        })(),
        new Promise((_,reject)=>{
          listener=()=>{abort.abort();reject(new ExternalCallUnavailable(sent?'UNVERIFIED':'NOT_SENT'))}
          timer=setTimeout(listener,Math.max(0,deadline-now()));signal?.addEventListener('abort',listener,{once:true});if(signal?.aborted)listener()
        }),
      ])
      settledStatus='RESPONSE'
    }catch{settledStatus=sent?'UNVERIFIED':'NOT_SENT'}finally{clearTimeout(timer);signal?.removeEventListener('abort',listener);abort.abort()}
    try{
      if(!same(d,await descriptor()))throw new ExternalCallUnavailable()
      const settlement=await control('SETTLE',plan.receipt.effectId,settledStatus,result?.status??null,result?(native?nativeResponseDigest(result,intentKey):hmac(intentKey,JSON.stringify(result))):null,requestDigest,intentKey)
      if(!settlement.fresh||settlement.fresh.status!==settledStatus||await status(plan.receipt.effectId)!==settledStatus)throw new ExternalCallUnavailable()
      if(settledStatus!=='RESPONSE')throw new ExternalCallUnavailable(settledStatus==='NOT_SENT'?'NOT_SENT':'UNVERIFIED')
      evidence.set(result,freeze({sourceId,resourceId,applicationId:source.applicationId,environment:source.environment,callId:plan.receipt.effectId,
        attemptEffectId:attempt.receipt.effectId,settlementEffectId:settlement.receipt.effectId,unit:EXTERNAL_CALL_CONTRACT.unit,status:'RESPONSE',...(native?{transportProtocol:NATIVE_EXTERNAL_TRANSPORT.id}:{})}))
      return result
    }catch(error){if(error instanceof ExternalCallUnavailable)throw error;throw new ExternalCallUnavailable()}
  }})
}
export async function externalCallSchemaDigest(){const fs=await import('node:fs');return hash(fs.readFileSync(new URL(externalCallSchemaUrl)))}
export async function nativeExternalTransportSchemaDigest(){const fs=await import('node:fs');return hash(fs.readFileSync(new URL(nativeExternalTransportSchemaUrl)))}
export async function publicWebTransportSchemaDigest(){const fs=await import('node:fs');return hash(fs.readFileSync(new URL(publicWebTransportSchemaUrl)))}
export async function externalCallSourceDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL('./external-call.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./external-call.d.mts',import.meta.url))).update(await externalCallSchemaDigest())
  .update(fs.readFileSync(new URL('./native-external-transport.mjs',import.meta.url))).update(fs.readFileSync(new URL('./native-external-transport.d.mts',import.meta.url)))
  .update(await nativeExternalTransportSchemaDigest())
  .update(fs.readFileSync(new URL('./public-web-transport.mjs',import.meta.url))).update(fs.readFileSync(new URL('./public-web-transport.d.mts',import.meta.url)))
  .update(await publicWebTransportSchemaDigest()).digest('hex')}
