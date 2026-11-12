import {createHmac} from 'node:crypto'
import {documentDigest} from './manifest.mjs'

// Standard, short-context tariff verified in the official OpenAI model/pricing
// pages on 2026-11-12. Hosted tools, non-default tiers and >200K inputs refused.
// Reserve the highest cache-write input tariff, never an assumed cache discount.
export const CODE_PRICING=Object.freeze({model:'gpt-6.1-sol',version:'openai-gpt-6.1-sol-standard-20261112',
 inputNano:2000n,cachedNano:100n,write30mNano:2500n,write12hNano:5000n,outputNano:10000n,maxInputTokens:200000,maxOutputTokens:8192})
const fail=code=>{throw Object.assign(Error('QA budget unavailable'),{code})}
const require=(v,code='POLICY_UNAVAILABLE')=>{if(!v)fail(code)}
const count=v=>{require(Number.isSafeInteger(v)&&v>=0,'USAGE_UNVERIFIED');return v}
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const object=v=>v!==null&&Object.getPrototypeOf(v)===Object.prototype
const roles=Object.freeze(['profitia_limits_quality_controller','profitia_limits_quality_broker','profitia_limits_quality_capture'])

export function quoteCodeRequest(inputTokens,outputTokens=CODE_PRICING.maxOutputTokens){
 require(Number.isSafeInteger(inputTokens)&&inputTokens>0&&inputTokens<=CODE_PRICING.maxInputTokens,'INPUT_BOUND_EXCEEDED')
 require(Number.isSafeInteger(outputTokens)&&outputTokens>0&&outputTokens<=CODE_PRICING.maxOutputTokens,'OUTPUT_BOUND_EXCEEDED')
 return Object.freeze({model:CODE_PRICING.model,pricingVersion:CODE_PRICING.version,inputTokens,outputTokens,
  maximumNanoUsd:(BigInt(inputTokens)*CODE_PRICING.write12hNano+BigInt(outputTokens)*CODE_PRICING.outputNano).toString()})
}

/** Usage comes only from the broker's fixed authenticated upstream transport.
 * Missing cache accounting remains unknown; cancellation never refunds it. */
export function readCodeUsage(usage,{model,serviceTier,quote}){
 require(model===CODE_PRICING.model&&serviceTier==='default'&&quote?.pricingVersion===CODE_PRICING.version,'USAGE_UNVERIFIED')
 require(object(usage)&&object(usage.input_tokens_details)&&object(usage.output_tokens_details),'USAGE_UNVERIFIED')
 const input=count(usage.input_tokens),output=count(usage.output_tokens),total=count(usage.total_tokens)
 const cached=count(usage.input_tokens_details.cached_tokens),write=count(usage.input_tokens_details.cache_write_tokens),reasoning=count(usage.output_tokens_details.reasoning_tokens)
 const ttl=usage.input_tokens_details.cache_write_tokens_details
 require(write===0||object(ttl),'USAGE_UNVERIFIED')
 const w30=ttl===undefined?0:count(ttl.ttl_30m_tokens),w12=ttl===undefined?0:count(ttl.ttl_12h_tokens)
 require(input+output===total&&cached+write<=input&&w30+w12===write&&reasoning<=output,'USAGE_UNVERIFIED')
 require(input<=quote.inputTokens&&output<=quote.outputTokens,'USAGE_BOUND_EXCEEDED')
 const nano=BigInt(input-cached-write)*CODE_PRICING.inputNano+BigInt(cached)*CODE_PRICING.cachedNano
  +BigInt(w30)*CODE_PRICING.write30mNano+BigInt(w12)*CODE_PRICING.write12hNano+BigInt(output)*CODE_PRICING.outputNano
 require(nano<=BigInt(quote.maximumNanoUsd),'USAGE_BOUND_EXCEEDED')
 return Object.freeze({model,pricingVersion:CODE_PRICING.version,inputTokens:input,outputTokens:output,totalTokens:total,
  cachedTokens:cached,write30mTokens:w30,write12hTokens:w12,reasoningTokens:reasoning,nanoUsd:nano.toString()})
}

/** No raw QA prompt or response is ever sent to the cost authority. The adapter
 * is a client of existing Package & Limits, not another spendable wallet. */
export function createQualityBudget({query,commandKey,schemaDigest,serviceId,role,now=Date.now}){
 require(typeof query==='function'&&typeof now==='function'&&digest(commandKey)&&digest(schemaDigest)&&uuid(serviceId)&&roles.includes(role),'EXPLICIT_LIMITS_BINDING_REQUIRED')
 const key=Buffer.from(commandKey,'hex')
 async function call(action,payload={}){
  const body=JSON.stringify({contract:'QualityUsage/1.0.0',action,...payload,serviceId,schemaDigest,until:now()+10000})
  require(Buffer.byteLength(body)<=16384)
  const proof=createHmac('sha256',key).update(body).digest('hex')
  let rows
  try{rows=(await query('SELECT profitia_limits.quality_usage($1::text,$2::text) AS result',[body,proof])).rows}
  catch(e){if(e?.code==='P0001'&&['LIMIT_EXCEEDED','IDEMPOTENCY_CONFLICT','POLICY_UNAVAILABLE','ATTEMPTS_EXHAUSTED'].includes(e.message))fail(e.message);fail('POLICY_UNAVAILABLE')}
  const r=rows?.[0]?.result
  require(rows?.length===1&&object(r)&&r.applicationId==='spendguru'&&r.environment==='development'
   &&r.projectId==='lingering-thunder-05075810'&&r.branchId==='br-green-hall-b9s837k0'&&r.databaseName==='neondb'
   &&r.runtimeRole===role&&r.schemaDigest===schemaDigest&&r.serviceId===serviceId,'LIMITS_BINDING_MISMATCH')
  return r
 }
 const incident=id=>require(uuid(id),'INVALID_INCIDENT')
 return Object.freeze({
  async assertPermit(permit){
   require(uuid(permit?.permitId));const r=await call('CHECK_PERMIT',{permitId:permit.permitId});require(r.status==='ACTIVE'&&r.permitId===permit.permitId)
   return r
  },
  async ensureIncident(id,{repairClass,causeFingerprint,acceptanceRequired}={}){
   incident(id);require(['C1','C2','C3'].includes(repairClass)&&digest(causeFingerprint)&&acceptanceRequired===true)
   const r=await call('HOLD_INCIDENT',{incidentId:id,repairClass,causeFingerprint,maximumNanoUsd:'5000000000',acceptanceNanoUsd:'1000000000'})
   require(r.incidentId===id&&r.maximumNanoUsd==='5000000000'&&r.acceptanceNanoUsd==='1000000000'&&['HELD','REPLAY'].includes(r.status))
   return Object.freeze({incidentId:id,maximumNanoUsd:r.maximumNanoUsd})
  },
  async openAttempt(id,{attemptId,ordinal,expiresAt}){
   incident(id);require(uuid(attemptId)&&[1,2].includes(ordinal)&&typeof expiresAt==='string'&&Date.parse(expiresAt)>now()&&Date.parse(expiresAt)<=now()+1800000)
   const r=await call('OPEN_ATTEMPT',{incidentId:id,attemptId,ordinal,expiresAt});require(r.incidentId===id&&r.attemptId===attemptId&&uuid(r.permitId)&&r.ordinal===ordinal)
   return Object.freeze({incidentId:id,attemptId,permitId:r.permitId,ordinal,expiresAt:r.expiresAt})
  },
  async closeAttempt(id,{attemptId,stoppedProofSha256}){
   incident(id);require(uuid(attemptId)&&digest(stoppedProofSha256))
   const r=await call('CLOSE_ATTEMPT',{incidentId:id,attemptId,stoppedProofSha256});require(r.status==='STOPPED'&&r.attemptId===attemptId)
  },
  async reserveRequest(permit,{requestId,inputDigest,quote}){
   require(uuid(permit?.permitId)&&uuid(requestId)&&digest(inputDigest)&&quote?.model===CODE_PRICING.model)
   const expected=quoteCodeRequest(quote.inputTokens,quote.outputTokens);require(documentDigest(quote)===documentDigest(expected))
   const r=await call('RESERVE_REQUEST',{permitId:permit.permitId,requestId,inputDigest,...expected})
   require(r.requestId===requestId&&r.inputDigest===inputDigest&&r.maximumNanoUsd===quote.maximumNanoUsd&&['RESERVED','REPLAY'].includes(r.status))
   return Object.freeze({requestId,inputDigest,quote,status:r.status})
  },
  async dispatchRequest(reservation){
   require(uuid(reservation?.requestId)&&reservation.status==='RESERVED')
   const r=await call('DISPATCH_REQUEST',{requestId:reservation.requestId,inputDigest:reservation.inputDigest});require(r.status==='DISPATCHED'&&r.requestId===reservation.requestId)
  },
  async settleRequest(reservation,actual){
   require(uuid(reservation?.requestId)&&object(actual)&&actual.model===CODE_PRICING.model)
   const r=await call('SETTLE_REQUEST',{requestId:reservation.requestId,usage:actual});require(r.status==='SETTLED'&&r.requestId===reservation.requestId)
  },
  async markUnknown(reservation,reason){
   require(uuid(reservation?.requestId)&&['PROVIDER_ERROR','STREAM_INCOMPLETE','CANCELLED','USAGE_UNVERIFIED'].includes(reason))
   const r=await call('UNKNOWN_REQUEST',{requestId:reservation.requestId,reason});require(r.status==='PENDING_RECONCILIATION')
  },
  async releaseUndispatched(reservation){
   require(uuid(reservation?.requestId));const r=await call('RELEASE_REQUEST',{requestId:reservation.requestId});require(r.status==='RELEASED')
  },
  async closeIncident(id){incident(id);const r=await call('CLOSE_INCIDENT',{incidentId:id});require(r.incidentId===id&&r.status==='CLOSED');return r},
  async reserveAssistant(id,executionId){incident(id);require(uuid(executionId));return call('RESERVE_ASSISTANT',{incidentId:id,executionId})},
  async reconcileAssistant(id,executionId){incident(id);require(uuid(executionId));return call('RECONCILE_ASSISTANT',{incidentId:id,executionId})},
  async status(){return call('STATUS')},
 })
}
