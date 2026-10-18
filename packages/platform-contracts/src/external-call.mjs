import {createHash,createHmac} from 'node:crypto'
import {createPlatformDeliveryPort,platformDeliveryEvidence,platformReceiptEvidence} from './platform-ingestion.mjs'
import {operationPayloadDigest} from './operation-context.mjs'
import {readPresentationJson} from './embedded-read-channel.mjs'

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

/** A server-owned source control adapter. It grants no HUMAN operation or
 * tenant read. The caller must separately admit its actor, purpose, data and
 * product before passing a private, stable 256-bit intent. No transport retry. */
export function createExternalCallHost(options){
  const {sourceHost,sourceId,resourceId,independentQuery,query,parseCommand,buildRequest,projectResponse,getHeaders=async()=>({}),now=Date.now}=options??{}
  let b;try{b=freeze(structuredClone(options.binding))}catch{throw TypeError('Explicit external source binding required')}
  if(!exact(b,'configurationVersion,origin,pathRules,role,schemaDigest,transport')||!['role','configurationVersion','origin','schemaDigest'].every(k=>typeof b[k]==='string')
    ||!/^[a-z][a-z0-9_]*$/.test(b.role)||!safeText(b.configurationVersion)||!hex.test(b.schemaDigest)||!validPaths(b.pathRules)
    ||!['HTTPS','LOCAL_SYNTHETIC_HTTP'].includes(b.transport)||!safeText(sourceId)||!safeText(resourceId)
    ||[independentQuery,query,parseCommand,buildRequest,projectResponse,getHeaders,now].some(v=>typeof v!=='function'))throw TypeError('Explicit external source binding required')
  let origin;try{origin=new URL(b.origin)}catch{throw TypeError('Fixed external origin required')}
  if(origin.origin!==b.origin||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash
    ||(b.transport==='HTTPS'?origin.protocol!=='https:':origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||!origin.port))throw TypeError('Fixed external origin required')
  // The port rejects a fabricated/serialized host before any database lookup.
  const makePort=write=>createPlatformDeliveryPort({host:sourceHost,resourceId:()=>resourceId,write})
  const port=makePort(()=>{throw new ExternalCallUnavailable()})
  const source=platformDeliveryEvidence(port)
  if(source.sourceId!==sourceId||source.payloadSchema!=='external-call-control-v1'
    ||b.transport==='LOCAL_SYNTHETIC_HTTP'&&source.environment!=='development')throw TypeError('Accepted external control source required')
  const descriptor=async()=>{
    let result;try{result=await independentQuery('SELECT current_database() AS database_name,current_user AS role,session_user AS login,profitia_external_call.descriptor($1,$2) AS descriptor',[sourceId,resourceId])}catch{throw new ExternalCallUnavailable('NOT_SENT')}
    const row=result?.rows?.length===1?result.rows[0]:null,d=row?.descriptor
    if(!d||row.database_name!==source.databaseName||row.role!==b.role||row.login!==b.role||d.schemaVersion!=='1.0.0'
      ||d.schemaDigest!==b.schemaDigest||d.sourceSchemaDigest!==source.schemaDigest||d.role!==b.role
      ||!['applicationId','environment','projectId','branchId','databaseName','sourceId'].every(k=>d[k]===source[k])
      ||d.resourceId!==resourceId||d.configurationVersion!==b.configurationVersion||d.origin!==b.origin||d.transport!==b.transport
      ||operationPayloadDigest(d.pathRules)!==operationPayloadDigest(b.pathRules)||d.unit!==EXTERNAL_CALL_CONTRACT.unit
      ||!uuid.test(d.policyId??'')||!uuid.test(d.serviceId??'')||!/^database-service:[a-f0-9-]{36}:[1-9][0-9]*$/i.test(d.serviceBindingVersion??'')
      ||!/^source-v1:[1-9][0-9]*$/.test(d.sourcePolicyVersion??'')||!Number.isSafeInteger(d.capacity)||d.capacity<1||d.capacity>1000000
      ||!Number.isSafeInteger(d.admittedCount)||d.admittedCount<0||d.admittedCount>d.capacity||!/^[1-9][0-9]*$/.test(d.policyVersion??'')
      ||!Number.isSafeInteger(d.maximumRequestBytes)||d.maximumRequestBytes<1||d.maximumRequestBytes>1048576
      ||!Number.isSafeInteger(d.maximumResponseBytes)||d.maximumResponseBytes<1||d.maximumResponseBytes>8388608
      ||!Number.isSafeInteger(d.timeoutMs)||d.timeoutMs<100||d.timeoutMs>120000
      ||!(Date.parse(d.expiresAt)>now())||Date.parse(d.expiresAt)>now()+30000
      ||b.transport==='LOCAL_SYNTHETIC_HTTP'&&d.sourceRef!=='SYNTHETIC_ONLY')throw new ExternalCallUnavailable('NOT_SENT')
    return freeze(d)
  }
  const same=(a,b)=>['policyId','policyVersion','configurationVersion','serviceId','serviceBindingVersion','sourcePolicyVersion','origin','transport',
    'maximumRequestBytes','maximumResponseBytes','timeoutMs'].every(k=>a[k]===b[k])&&operationPayloadDigest(a.pathRules)===operationPayloadDigest(b.pathRules)
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
    if(!exact(input,'command,intentKey')||!hex.test(input.intentKey??'')||!record(options)||Object.keys(options).some(k=>k!=='signal')
      ||options.signal!=null&&!(options.signal instanceof AbortSignal))throw new ExternalCallUnavailable('NOT_SENT')
    if(options.signal?.aborted)throw new ExternalCallUnavailable('NOT_SENT')
    let command,request,d
    try{
      command=freeze(structuredClone(parseCommand(input.command)));d=await descriptor();request=buildRequest(command)
      if(!exact(request,'body,method,url')||!['GET','POST'].includes(request.method)||typeof request.url!=='string'||request.url.length>8192
        ||!(request.body===null||typeof request.body==='string')||request.method==='GET'&&request.body!==null)throw Error()
      const url=new URL(request.url)
      if(url.href!==request.url||url.origin!==b.origin||url.username||url.password||url.hash||!b.pathRules.some(p=>p.method===request.method&&p.path===url.pathname)
        ||!/^\/[A-Za-z0-9/._-]{0,255}$/.test(url.pathname)||url.pathname.includes('..')||url.pathname.includes('//')
        ||Buffer.byteLength(request.url)+Buffer.byteLength(request.body??'')>d.maximumRequestBytes)throw Error()
      if(request.body!==null)await readPresentationJson(new Response(request.body,{headers:{'content-type':'application/json'}}),d.maximumRequestBytes)
      request=Object.freeze({...request})
    }catch{throw new ExternalCallUnavailable('NOT_SENT')}
    const requestDigest=hmac(input.intentKey,JSON.stringify({body:request.body,method:request.method,url:request.url}))
    let plan,attempt
    try{
      plan=await control('PLAN',null,null,null,null,requestDigest,input.intentKey)
      if(await status(plan.receipt.effectId)!=='PLANNED')throw new ExternalCallUnavailable('RESULT_NOT_RETAINED')
      if(!same(d,await descriptor()))throw new ExternalCallUnavailable('NOT_SENT')
      if(options.signal?.aborted)throw new ExternalCallUnavailable('NOT_SENT')
      attempt=await control('ATTEMPT',plan.receipt.effectId,null,null,null,requestDigest,input.intentKey)
      if(!attempt.fresh||attempt.fresh.status!=='ATTEMPT_RESERVED'||attempt.fresh.callId!==plan.receipt.effectId)throw new ExternalCallUnavailable('UNVERIFIED')
    }catch(error){if(error instanceof ExternalCallUnavailable)throw error;throw new ExternalCallUnavailable('UNVERIFIED')}
    const abort=new AbortController(),deadline=Math.min(now()+d.timeoutMs,Date.parse(d.expiresAt));let timer,listener,sent=false,result,settledStatus='NOT_SENT'
    const assertActive=()=>{if(abort.signal.aborted||now()>=deadline)throw new ExternalCallUnavailable(sent?'UNVERIFIED':'NOT_SENT')}
    try{
      result=await Promise.race([
        (async()=>{
          // Credential acquisition is deferred and does not mint permission.
          // This callback must not perform an unadmitted token-exchange request.
          assertActive()
          const supplied=await getHeaders(command,{signal:abort.signal});assertActive()
          if(!record(supplied)||Object.keys(supplied).length>16)throw new ExternalCallUnavailable('NOT_SENT')
          const headers=new Headers()
          for(const [key,value] of Object.entries(supplied)){
            if(!/^[A-Za-z0-9-]{1,64}$/.test(key)||/^(cookie|host|connection|content-length|transfer-encoding|proxy-.*|sec-.*)$/i.test(key)
              ||typeof value!=='string'||Buffer.byteLength(value)>8192||/[\r\n]/.test(value))throw new ExternalCallUnavailable('NOT_SENT')
            headers.set(key,value)
          }
          headers.set('accept','application/json');if(request.body!==null)headers.set('content-type','application/json')
          if(!same(d,await descriptor()))throw new ExternalCallUnavailable('NOT_SENT');assertActive()
          sent=true
          const response=await fetch(request.url,{method:request.method,body:request.body,headers,signal:abort.signal,redirect:'manual',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'})
          if(abort.signal.aborted||response.redirected||response.url!==request.url||response.status<200||response.status>599||response.status>=300&&response.status<400){try{await response.body?.cancel()}catch{};throw new ExternalCallUnavailable()}
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
          timer=setTimeout(listener,Math.max(0,deadline-now()));options.signal?.addEventListener('abort',listener,{once:true});if(options.signal?.aborted)listener()
        }),
      ])
      settledStatus='RESPONSE'
    }catch{settledStatus=sent?'UNVERIFIED':'NOT_SENT'}finally{clearTimeout(timer);options.signal?.removeEventListener('abort',listener);abort.abort()}
    try{
      if(!same(d,await descriptor()))throw new ExternalCallUnavailable()
      const settlement=await control('SETTLE',plan.receipt.effectId,settledStatus,result?.status??null,result?hmac(input.intentKey,JSON.stringify(result)):null,requestDigest,input.intentKey)
      if(!settlement.fresh||settlement.fresh.status!==settledStatus||await status(plan.receipt.effectId)!==settledStatus)throw new ExternalCallUnavailable()
      if(settledStatus!=='RESPONSE')throw new ExternalCallUnavailable(settledStatus==='NOT_SENT'?'NOT_SENT':'UNVERIFIED')
      evidence.set(result,freeze({sourceId,resourceId,applicationId:source.applicationId,environment:source.environment,callId:plan.receipt.effectId,
        attemptEffectId:attempt.receipt.effectId,settlementEffectId:settlement.receipt.effectId,unit:EXTERNAL_CALL_CONTRACT.unit,status:'RESPONSE'}))
      return result
    }catch(error){if(error instanceof ExternalCallUnavailable)throw error;throw new ExternalCallUnavailable()}
  }})
}
export async function externalCallSchemaDigest(){const fs=await import('node:fs');return hash(fs.readFileSync(new URL(externalCallSchemaUrl)))}
export async function externalCallSourceDigest(){const fs=await import('node:fs');return createHash('sha256').update(fs.readFileSync(new URL('./external-call.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./external-call.d.mts',import.meta.url))).update(await externalCallSchemaDigest()).digest('hex')}
