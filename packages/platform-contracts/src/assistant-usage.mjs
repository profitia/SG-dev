import {createHash,createHmac} from 'node:crypto'

export const ASSISTANT_USAGE_CONTRACT=Object.freeze({id:'profitia.assistant-usage',version:'1.0.0'})
// Verified 2026-11-09: https://developers.openai.com/api/docs/models/gpt-5.6-luna
// Cache writes replace ordinary input billing; reasoning is part of output.
export const ASSISTANT_PRICING=Object.freeze({version:'openai-gpt-5.6-luna-standard-20261109',model:'gpt-5.6-luna',
 inputNanoUsd:200,cachedNanoUsd:20,write30mNanoUsd:250,write12hNanoUsd:500,outputNanoUsd:1200})
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const sha=/^[a-f0-9]{64}$/
const admissions=new WeakMap()
const fail=(code='LIMIT_POLICY_UNAVAILABLE')=>{const error=Error('Assistant usage unavailable');error.code=code;throw error}
const count=(v,max=1000000)=>{if(!Number.isSafeInteger(v)||v<0||v>max)fail();return v}
const immutable=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(immutable);Object.freeze(v)}return v}

export function assistantInputBound(input){
 if(!Array.isArray(input)||input.length<1||input.length>32)fail()
 for(const m of input)if(!m||Object.keys(m).sort().join(',')!=='content,role'
  ||!['developer','user','assistant'].includes(m.role)||typeof m.content!=='string')fail()
 const canonicalInput=JSON.stringify(input.map(m=>({role:m.role,content:m.content})))
 const bytes=Buffer.byteLength(canonicalInput,'utf8')
 if(bytes>32768)fail('LIMIT_EXCEEDED')
 // Plain text only: UTF-8 bytes bound BPE pieces, with a conservative envelope
 // for message framing. Tools, files, images, prior-response IDs and compaction
 // cannot introduce unbounded input through this execution contract.
 const inputTokens=bytes+input.length*512+8192,outputTokens=2048
 const nanoUsd=BigInt(inputTokens)*500n+BigInt(outputTokens)*1200n
 if(nanoUsd>500000000n||inputTokens+outputTokens>200000)fail('LIMIT_EXCEEDED')
 return Object.freeze({inputTokens,outputTokens,nanoUsd:nanoUsd.toString(),
  inputDigest:createHash('sha256').update(canonicalInput).digest('hex')})
}

export function readAssistantUsage(usage,model){
 if(model!==ASSISTANT_PRICING.model||!usage||typeof usage!=='object')fail()
 const input=count(usage.input_tokens),output=count(usage.output_tokens),total=count(usage.total_tokens)
 const cached=count(usage.input_tokens_details?.cached_tokens),write=count(usage.input_tokens_details?.cache_write_tokens)
 const reasoning=count(usage.output_tokens_details?.reasoning_tokens)
 const details=usage.input_tokens_details?.cache_write_tokens_details
 const write12h=details===undefined?0:count(details.ttl_12h_tokens)
 const write30m=details===undefined?write:count(details.ttl_30m_tokens)
 if(input+output!==total||cached+write>input||reasoning>output||write12h+write30m!==write)fail()
 const nanoUsd=BigInt(input-cached-write)*200n+BigInt(cached)*20n+BigInt(write30m)*250n+BigInt(write12h)*500n+BigInt(output)*1200n
 return immutable({model,pricingVersion:ASSISTANT_PRICING.version,inputTokens:input,outputTokens:output,totalTokens:total,
  cachedTokens:cached,cacheWriteTokens:write,cacheWrite30mTokens:write30m,cacheWrite12hTokens:write12h,reasoningTokens:reasoning,nanoUsd:nanoUsd.toString()})
}

/** The sole model dispatch consumes a receipt issued by a real successful
 * reservation. A JSON body, replay, copied receipt or second use cannot dispatch. */
export function takeAssistantAdmission(value,{inputDigest,now=Date.now()}={}){
 const r=admissions.get(value)
 if(!r||!r.dispatched||r.taken||r.expiresAt<=now||r.inputDigest!==inputDigest)fail('IDEMPOTENCY_CONFLICT')
 r.taken=true
 return Object.freeze({...r.public})
}

/** E1 accepts only a receipt returned by this real Limits adapter, bound to
 * this authenticated actor, organisation, command and exact model input. */
export function assertAssistantUsageReservation(value,context){
 const r=admissions.get(value),p=context?.payload
 if(!r||!p||p.kind!=='GENERATE'||r.scope.actorId!==context.actorId||r.scope.organisationId!==context.organisationId
  ||r.scope.decisionId!==context.decisionId||value.commandId!==p.commandId
  ||value.inputDigest!==assistantInputBound(p.input).inputDigest)fail()
 return value
}

export function createAssistantUsageStore({query,commandKey,schemaDigest,now=Date.now}){
 if(typeof query!=='function'||typeof now!=='function'||typeof commandKey!=='string'||!sha.test(commandKey)||!sha.test(schemaDigest))throw TypeError('Explicit Assistant usage binding required')
 const key=Buffer.from(commandKey,'hex')
 async function call(command){
  const body=JSON.stringify({...command,contract:ASSISTANT_USAGE_CONTRACT.version,schemaDigest,until:now()+10000})
  const proof=createHmac('sha256',key).update(body).digest('hex')
  let rows
  try{rows=(await query('SELECT profitia_limits.assistant_usage($1::text,$2::text) AS result',[body,proof])).rows}catch(error){
   if(error?.code==='P0001'&&['LIMIT_EXCEEDED','IDEMPOTENCY_CONFLICT','POLICY_UNAVAILABLE'].includes(error.message))fail(error.message)
   fail()
  }
  const r=rows?.[0]?.result
  if(rows?.length!==1||!r||r.environment!=='development'||r.applicationId!=='spendguru'
   ||r.projectId!=='lingering-thunder-05075810'||r.branchId!=='br-green-hall-b9s837k0'
   ||r.databaseName!=='neondb'||r.runtimeRole!=='profitia_limits_assistant_runtime'||r.schemaDigest!==schemaDigest)fail()
  return r
 }
 return Object.freeze({contract:ASSISTANT_USAGE_CONTRACT,
  async reserve({actorId,organisationId,commandId,decisionId,input,expectedPolicy}){
   if(![actorId,organisationId,commandId,decisionId].every(v=>uuid.test(v??'')))fail()
   if(!expectedPolicy||![expectedPolicy.id,expectedPolicy.assignmentId].every(v=>uuid.test(v??''))
    ||!Number.isSafeInteger(expectedPolicy.assignmentRevision)||expectedPolicy.assignmentRevision<1)fail()
   const bound=assistantInputBound(input)
   const r=await call({action:'RESERVE',actorId,organisationId,commandId,decisionId,model:ASSISTANT_PRICING.model,pricingVersion:ASSISTANT_PRICING.version,
    inputDigest:bound.inputDigest,inputTokens:bound.inputTokens,outputTokens:bound.outputTokens,nanoUsd:bound.nanoUsd,
    policyId:expectedPolicy.id,assignmentId:expectedPolicy.assignmentId,assignmentRevision:expectedPolicy.assignmentRevision})
   if(!uuid.test(r.executionId??'')||r.commandId!==commandId||r.actorId!==actorId||r.organisationId!==organisationId
    ||r.inputDigest!==bound.inputDigest||!['RESERVED','REPLAY'].includes(r.status))fail()
   const publicValue=Object.freeze({executionId:r.executionId,commandId,inputDigest:bound.inputDigest,inputTokens:bound.inputTokens,
    outputTokens:bound.outputTokens,nanoUsd:bound.nanoUsd,model:ASSISTANT_PRICING.model,pricingVersion:ASSISTANT_PRICING.version})
   const value=Object.freeze({status:r.status,...publicValue})
   const receipt={public:publicValue,inputDigest:bound.inputDigest,expiresAt:0,taken:false,scope:{actorId,organisationId,decisionId}}
   if(r.status==='RESERVED'){
    const expiresAt=Date.parse(r.expiresAt)
    if(!Number.isFinite(expiresAt)||expiresAt<=now()||expiresAt>now()+30000)fail()
    receipt.expiresAt=expiresAt
   }
   admissions.set(value,receipt)
   return value
  },
  async settle(admission,{usage,model,responseId}){
   const receipt=admissions.get(admission)
   if(!receipt?.taken||typeof responseId!=='string'||!/^resp_[a-zA-Z0-9_-]{1,160}$/.test(responseId))fail()
   const actual=readAssistantUsage(usage,model)
   if(actual.inputTokens>admission.inputTokens||actual.outputTokens>admission.outputTokens
    ||BigInt(actual.nanoUsd)>BigInt(admission.nanoUsd))fail('LIMIT_EXCEEDED')
   const r=await call({action:'SETTLE',executionId:admission.executionId,commandId:admission.commandId,responseId,usage:actual})
   if(r.status!=='SETTLED'||r.executionId!==admission.executionId)fail()
   return actual
  },
  async dispatch(admission){
   const receipt=admissions.get(admission)
   if(!receipt||admission.status!=='RESERVED'||receipt.dispatching||receipt.dispatched||receipt.taken||receipt.expiresAt<=now())fail('IDEMPOTENCY_CONFLICT')
   receipt.dispatching=true
   const r=await call({action:'DISPATCH',executionId:admission.executionId,commandId:admission.commandId})
   if(r.status!=='DISPATCHED'||r.executionId!==admission.executionId)fail()
   receipt.dispatched=true
  },
  async release(admission){
   const receipt=admissions.get(admission)
   if(!receipt||admission.status!=='RESERVED'||receipt.dispatching||receipt.dispatched||receipt.taken)fail('IDEMPOTENCY_CONFLICT')
   const r=await call({action:'RELEASE',executionId:admission.executionId,commandId:admission.commandId})
   if(r.status!=='RELEASED'||r.executionId!==admission.executionId)fail()
   admissions.delete(admission)
  },
  async pending(admission,reason){
   if(!admissions.has(admission)||!['CANCELLED','INTERRUPTED','PROVIDER_ERROR','USAGE_UNVERIFIED','AUTH_REVOKED'].includes(reason))fail()
   const r=await call({action:'PENDING',executionId:admission.executionId,commandId:admission.commandId,reason})
   if(!['PENDING_RECONCILIATION','SETTLED'].includes(r.status)||r.executionId!==admission.executionId)fail()
  },
 })
}
